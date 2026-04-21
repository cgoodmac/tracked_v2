// localStorage helpers for Tracked's six top-level keys.
// All reads are defensive (return the documented shape on missing/corrupt data).
// Same schema will port to Supabase later.

const KEYS = {
  onboarded:     'tracked_onboarded',
  goals:         'tracked_goals',
  metrics:       'tracked_metrics',
  interventions: 'tracked_interventions',
  checkins:      'tracked_checkins',
  logs:          'tracked_logs',
  measurements:  'tracked_measurements',
  messages:      'tracked_messages',
  pro:           'tracked_pro',
}

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    if (raw == null) return fallback
    return JSON.parse(raw)
  } catch {
    return fallback
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch (e) {
    // Quota or serialization failure — surface to console, don't crash.
    console.error('tracked: failed to write', key, e)
  }
}

// ---------- Onboarding flag ----------
export const isOnboarded = () => read(KEYS.onboarded, false) === true
export const setOnboarded = (v) => write(KEYS.onboarded, !!v)

// ---------- Goals ----------
// Goals are objects: { id, name, metricId, priority, tracked, note? }
// Historical string[] values are migrated on read so pre-metrics users don't
// crash the app — each legacy string becomes a minimal untracked goal.
export const getGoals = () => {
  const raw = read(KEYS.goals, [])
  if (!Array.isArray(raw)) return []
  return raw.map((g, i) => {
    if (g && typeof g === 'object' && typeof g.name === 'string') return g
    if (typeof g === 'string') {
      return { id: `legacy-${i}`, name: g, metricId: null, priority: i + 1, tracked: false }
    }
    return null
  }).filter(Boolean)
}
export const setGoals = (goals) => write(KEYS.goals, Array.isArray(goals) ? goals : [])

// ---------- Metrics (user-defined, derived from goals) ----------
export const getMetrics = () => read(KEYS.metrics, [])
export const setMetrics = (list) => write(KEYS.metrics, Array.isArray(list) ? list : [])

// ---------- Interventions ----------
export const getInterventions = () => read(KEYS.interventions, [])
export const setInterventions = (list) => write(KEYS.interventions, Array.isArray(list) ? list : [])

// ---------- Check-ins (keyed by ISO date) ----------
export const getCheckins = () => read(KEYS.checkins, {})
export const setCheckins = (obj) => write(KEYS.checkins, obj && typeof obj === 'object' ? obj : {})
export const getCheckin = (isoDate) => getCheckins()[isoDate] || null
export const upsertCheckin = (isoDate, partial) => {
  const all = getCheckins()
  all[isoDate] = { ...(all[isoDate] || {}), date: isoDate, ...partial }
  setCheckins(all)
  return all[isoDate]
}

// ---------- Logs (per-intervention taken/skipped per day) ----------
export const getLogs = () => read(KEYS.logs, {})
export const setLogs = (obj) => write(KEYS.logs, obj && typeof obj === 'object' ? obj : {})
export const getLog = (isoDate) => getLogs()[isoDate] || {}
export const upsertLog = (isoDate, partial) => {
  const all = getLogs()
  all[isoDate] = { ...(all[isoDate] || {}), ...partial }
  setLogs(all)
  return all[isoDate]
}

// ---------- Periodic measurements ----------
// Shape: { [metricId]: [{ date: 'YYYY-MM-DD', value: number, note?: string, id }] }
// Per-metric array is kept sorted newest-first so the UI can show the last
// value cheaply. The `id` is only for React keys and delete operations.
export const getMeasurements = () => {
  const raw = read(KEYS.measurements, {})
  return raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}
}
export const setMeasurements = (obj) =>
  write(KEYS.measurements, obj && typeof obj === 'object' && !Array.isArray(obj) ? obj : {})

// ---------- Chat messages ----------
export const getMessages = () => read(KEYS.messages, [])
export const setMessages = (list) => write(KEYS.messages, Array.isArray(list) ? list : [])
export const appendMessage = (msg) => {
  const list = getMessages()
  list.push(msg)
  setMessages(list)
  return msg
}

// ---------- Pro flag ----------
export const isPro = () => read(KEYS.pro, false) === true
export const setPro = (v) => write(KEYS.pro, !!v)

// ---------- Dev utility ----------
export function resetAll() {
  Object.values(KEYS).forEach(k => localStorage.removeItem(k))
}

// Expose keys for debugging (e.g. inspecting in devtools)
export const STORAGE_KEYS = KEYS
