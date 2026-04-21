// Apply AI-parsed actions to local state.
// Action shapes come from the AI response contract in the spec:
//   { type: "action_type", data: { ... } }
// This module is pure-ish: it takes current state + an action and returns
// the new state. Caller is responsible for persisting via storage.js.

const uid = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : 'id-' + Math.random().toString(36).slice(2) + Date.now().toString(36)

const clampScore = (n) => {
  const x = Number(n)
  if (!Number.isFinite(x)) return null
  return Math.max(1, Math.min(10, Math.round(x)))
}

// Entry point — apply a single action to the state bundle.
// state shape: { goals, metrics, interventions, checkins, logs }
// todayISO: today's ISO date string (caller supplies so "today" stays stable
//   across timezone boundaries within a call).
export function applyAction(state, action, todayISO) {
  if (!action || typeof action !== 'object') return state
  const { type, data = {} } = action
  const s = { ...state }

  switch (type) {
    case 'set_goals': {
      // Goals may arrive either as objects (preferred) or as legacy strings.
      // Objects are taken as-is (just string-coerce the name); strings get
      // wrapped into a minimal untracked goal so we never crash.
      const goals = Array.isArray(data.goals)
        ? data.goals.map((g, i) => {
            if (g && typeof g === 'object' && typeof g.name === 'string') {
              return { ...g, name: g.name.trim() }
            }
            if (typeof g === 'string' && g.trim()) {
              return { id: `g-${i}`, name: g.trim(), metricId: null, tracked: false, priority: i + 1, note: null }
            }
            return null
          }).filter(Boolean)
        : s.goals
      return { ...s, goals }
    }

    case 'add_intervention': {
      const incoming = normalizeIntervention(data, todayISO)
      if (!incoming) return s
      // Dedupe on case-insensitive name match — if already present, merge.
      const idx = s.interventions.findIndex(
        i => i.name && incoming.name && i.name.toLowerCase() === incoming.name.toLowerCase()
      )
      const interventions = [...s.interventions]
      if (idx >= 0) {
        interventions[idx] = { ...interventions[idx], ...incoming, id: interventions[idx].id }
      } else {
        interventions.push({ id: uid(), ...incoming })
      }
      return { ...s, interventions }
    }

    case 'stop_intervention': {
      const { id, name, endDate } = data
      const interventions = s.interventions.map(i =>
        matchIntervention(i, id, name)
          ? { ...i, status: 'stopped', endDate: endDate || todayISO }
          : i
      )
      return { ...s, interventions }
    }

    case 'update_intervention': {
      const { id, name, ...patch } = data
      const interventions = s.interventions.map(i =>
        matchIntervention(i, id, name) ? { ...i, ...patch } : i
      )
      return { ...s, interventions }
    }

    case 'log_checkin':
    case 'update_checkin': {
      // New shape: data.scores is an object keyed by metric id OR metric name.
      // We resolve each key to a metric id via the user's metrics list, then
      // merge into checkins[today].scores.
      const metrics = Array.isArray(s.metrics) ? s.metrics : []
      const prev = s.checkins[todayISO] || {}
      const nextScores = { ...(prev.scores || {}) }

      const resolveMetricId = (key) => {
        if (!key) return null
        const k = String(key).trim()
        const byId = metrics.find(m => m.id === k)
        if (byId) return byId.id
        const byName = metrics.find(m => m.name && m.name.toLowerCase() === k.toLowerCase())
        if (byName) return byName.id
        const byLabel = metrics.find(m => m.label && m.label.toLowerCase() === k.toLowerCase())
        if (byLabel) return byLabel.id
        return null
      }

      // Preferred shape: { scores: { <metricId-or-name>: number } }
      if (data.scores && typeof data.scores === 'object') {
        for (const [key, raw] of Object.entries(data.scores)) {
          const id = resolveMetricId(key)
          if (!id) continue
          const v = clampScore(raw)
          if (v != null) nextScores[id] = v
        }
      }

      // Back-compat: accept top-level metric keys too (e.g. { anxiety: 5 }).
      // Skip reserved fields so we don't confuse them for metrics.
      const reserved = new Set(['scores', 'notes', 'date'])
      for (const [key, raw] of Object.entries(data)) {
        if (reserved.has(key)) continue
        if (typeof raw !== 'number' && typeof raw !== 'string') continue
        const id = resolveMetricId(key)
        if (!id) continue
        const v = clampScore(raw)
        if (v != null) nextScores[id] = v
      }

      const next = { ...prev, date: todayISO, scores: nextScores }
      if (typeof data.notes === 'string') next.notes = data.notes
      return { ...s, checkins: { ...s.checkins, [todayISO]: next } }
    }

    case 'add_metric': {
      // Data: { name, label?, type, direction, icon?, color?,
      //         low?, high? (scale)    unit?, cadence? (periodic),
      //         asGoal? (default true) }
      const incoming = normalizeMetric(data)
      if (!incoming) return s

      const metricsList = Array.isArray(s.metrics) ? s.metrics : []
      const dup = metricsList.find(m =>
        (m.name && incoming.name && m.name.toLowerCase() === incoming.name.toLowerCase()) ||
        (m.label && incoming.label && m.label.toLowerCase() === incoming.label.toLowerCase())
      )
      // If already present, don't duplicate — but do add a goal if asked.
      const metric = dup || { id: uid(), ...incoming }
      const nextMetrics = dup ? metricsList : [...metricsList, metric]

      let nextGoals = Array.isArray(s.goals) ? s.goals : []
      const asGoal = data.asGoal !== false
      if (asGoal) {
        const alreadyGoal = nextGoals.some(g => g.metricId === metric.id)
        if (!alreadyGoal) {
          nextGoals = [
            ...nextGoals,
            {
              id: uid(),
              name: metric.name,
              metricId: metric.id,
              tracked: true,
              priority: nextGoals.length + 1,
              note: null,
            },
          ]
        }
      }

      return { ...s, metrics: nextMetrics, goals: nextGoals }
    }

    case 'log_measurement': {
      // Data: { metricId?, metricName?, value, unit?, note?, date? }
      const metricsList = Array.isArray(s.metrics) ? s.metrics : []
      const metric = resolveMetric(metricsList, data.metricId, data.metricName)
      if (!metric) return s
      const num = Number(data.value)
      if (!Number.isFinite(num)) return s

      const date = isISODate(data.date) ? data.date : todayISO
      const entry = {
        id: uid(),
        date,
        value: num,
        note: typeof data.note === 'string' && data.note.trim() ? data.note.trim() : null,
      }
      const measurements = { ...(s.measurements || {}) }
      const existing = measurements[metric.id] || []
      measurements[metric.id] = [entry, ...existing].sort(
        (a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)
      )
      return { ...s, measurements }
    }

    case 'log_taken': {
      // data.items: [{ name?, id?, taken: boolean }, ...]  OR  data: { <id>: bool }
      const todayLog = { ...(s.logs[todayISO] || {}) }
      const items = Array.isArray(data.items) ? data.items : null
      if (items) {
        for (const it of items) {
          const hit = findIntervention(s.interventions, it.id, it.name)
          if (hit) todayLog[hit.id] = !!it.taken
        }
      } else {
        // Fallback: treat data as { id: bool }
        for (const [k, v] of Object.entries(data)) {
          if (typeof v === 'boolean') todayLog[k] = v
        }
      }
      return { ...s, logs: { ...s.logs, [todayISO]: todayLog } }
    }

    case 'answer_question':
      // No state change — handled at the UI layer (show the message).
      return s

    default:
      console.warn('tracked: unknown action type', type, data)
      return s
  }
}

export function applyActions(state, actions, todayISO) {
  if (!Array.isArray(actions)) return state
  return actions.reduce((acc, a) => applyAction(acc, a, todayISO), state)
}

// ---------- Helpers ----------
function matchIntervention(candidate, id, name) {
  if (id && candidate.id === id) return true
  if (name && candidate.name && candidate.name.toLowerCase() === String(name).toLowerCase()) return true
  return false
}

function findIntervention(list, id, name) {
  return list.find(i => matchIntervention(i, id, name)) || null
}

function normalizeMetric(data) {
  if (!data || typeof data.name !== 'string' || !data.name.trim()) return null
  const name = data.name.trim().toLowerCase()
  const type = data.type === 'periodic' ? 'periodic' : 'scale'
  const metric = {
    name,
    label: (typeof data.label === 'string' && data.label.trim())
      ? data.label.trim()
      : name.charAt(0).toUpperCase() + name.slice(1),
    type,
    direction: data.direction === 'down' ? 'down' : 'up',
    icon: (typeof data.icon === 'string' && data.icon.trim()) ? data.icon.trim() : '•',
    color: (typeof data.color === 'string' && data.color.trim()) ? data.color.trim() : '#00A699',
  }
  if (type === 'scale') {
    metric.low = (typeof data.low === 'string' && data.low.trim())
      ? data.low.trim()
      : (metric.direction === 'down' ? 'bad' : 'low')
    metric.high = (typeof data.high === 'string' && data.high.trim())
      ? data.high.trim()
      : (metric.direction === 'down' ? 'good' : 'high')
  } else {
    metric.unit = (typeof data.unit === 'string' && data.unit.trim()) ? data.unit.trim() : ''
    metric.cadence = (typeof data.cadence === 'string' && data.cadence.trim()) ? data.cadence.trim() : ''
  }
  return metric
}

function resolveMetric(list, id, name) {
  if (!Array.isArray(list)) return null
  if (id) {
    const byId = list.find(m => m.id === id)
    if (byId) return byId
  }
  if (name) {
    const lower = String(name).trim().toLowerCase()
    return list.find(m =>
      (m.name && m.name.toLowerCase() === lower) ||
      (m.label && m.label.toLowerCase() === lower)
    ) || null
  }
  return null
}

function isISODate(v) {
  return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)
}

function normalizeIntervention(data, todayISO) {
  if (!data || !data.name) return null
  return {
    name: String(data.name).trim(),
    type: data.type || 'other',
    dose: data.dose ?? null,
    frequency: data.frequency || 'Daily',
    status: data.status || 'active',
    startDate: data.startDate || todayISO,
    endDate: data.endDate ?? null,
    notes: data.notes ?? null,
  }
}
