// The main daily check-in view. This is what the user sees every time they
// open the app after onboarding. NOT a blank chat — a structured view with
// a voice/text shortcut above the sliders.
//
// Unlike v1, metrics are user-specific: they come from app state (derived
// from the user's goals during onboarding). The check-in iterates over
// whatever metrics the user ended up with, in the order the AI returned.
//
// Flow:
//  1. Sliders pre-fill from yesterday's values (or 5 on first run).
//  2. All active interventions pre-checked as taken.
//  3. User can (a) manually adjust, or (b) type/speak a sentence and let AI
//     update the sliders and checkboxes for them.
//  4. Tap "Log day" → persist + show success + flip to read-only.
//  5. Tapping "Edit" on the read-only view returns to edit mode for today.

import { useEffect, useMemo, useState } from 'react'
import { todayISO, formatDateFull, iconForType } from '../../lib/constants.js'
import { useAppState } from '../../hooks/useAppState.jsx'
import { parseCheckinText } from '../../lib/ai.js'
import { applyActions } from '../../lib/actions.js'
import MetricSlider from './MetricSlider.jsx'
import StackChecklist from './StackChecklist.jsx'
import VoiceInput from './VoiceInput.jsx'
import MeasurementsCard from './MeasurementsCard.jsx'
import AddInterventionForm from './AddInterventionForm.jsx'
import AddMetricForm from './AddMetricForm.jsx'
import LogConfirmation from './LogConfirmation.jsx'

// Default metric value on first-ever check-in — middle of the scale.
const DEFAULT_SCORE = 5

export default function CheckinScreen() {
  const {
    goals, metrics: allMetrics, interventions, checkins, logs, pro, today, todaysCheckin,
    measurements,
    upsertCheckin, upsertLog,
    addIntervention, addMetric, logMeasurement,
    applyAIActions,
  } = useAppState()

  // Daily check-in only shows scale-type metrics. Periodic metrics live
  // elsewhere (coming soon) and don't appear as daily sliders.
  const metrics = useMemo(
    () => (allMetrics || []).filter(m => (m.type || 'scale') === 'scale'),
    [allMetrics],
  )

  // ----- Edit vs read-only -----
  const alreadyLogged = hasCompleteCheckin(todaysCheckin, metrics)
  const [editing, setEditing] = useState(!alreadyLogged)
  useEffect(() => { if (!alreadyLogged) setEditing(true) }, [alreadyLogged])

  // ----- Local working state (staged before "Log day") -----
  const initialScores = useMemo(() => seedScoresFor(today, checkins, metrics), [today, checkins, metrics])
  const [scores, setScores] = useState(initialScores)
  const [takenMap, setTakenMap] = useState(() => seedTakenFor(today, interventions, logs))
  const [quantityMap, setQuantityMap] = useState(() => (logs[today]?._quantities || {}))
  const [notes, setNotes] = useState(() => todaysCheckin?.notes ?? '')
  const [aiBusy, setAiBusy] = useState(false)
  const [aiMsg, setAiMsg] = useState('')
  const [aiError, setAiError] = useState('')
  const [justLogged, setJustLogged] = useState(false)

  // Re-seed if app state changes underneath us (e.g. dev seed, day rollover,
  // onboarding just finished).
  useEffect(() => { setScores(seedScoresFor(today, checkins, metrics)) }, [today, checkins, metrics])
  useEffect(() => { setTakenMap(seedTakenFor(today, interventions, logs)) }, [today, interventions, logs])
  useEffect(() => { setQuantityMap(logs[today]?._quantities || {}) }, [today, logs])

  const setMetric = (id, v) => setScores(prev => ({ ...prev, [id]: v }))
  const toggleItem = (id, taken) => setTakenMap(prev => ({ ...prev, [id]: taken }))
  const setQuantity = (id, qty) => setQuantityMap(prev => ({ ...prev, [id]: qty }))
  const toggleAll = (taken) => {
    const next = {}
    for (const i of interventions.filter(x => x.status !== 'stopped')) next[i.id] = !!taken
    setTakenMap(next)
  }

  // ----- Inline adds -----
  // Adding to the stack from here: save it and pre-check it for today.
  const handleAddIntervention = (data) => {
    const created = addIntervention(data)
    if (created) {
      setTakenMap(prev => ({ ...prev, [created.id]: true }))
      if (created.trackQuantity) setQuantityMap(prev => ({ ...prev, [created.id]: 0 }))
    }
  }

  // Adding a new metric from here: save it and seed today's score at 5 so
  // the slider appears immediately populated instead of blank.
  const handleAddMetric = (data) => {
    const created = addMetric(data, { asGoal: true })
    if (created && created.type === 'scale') {
      setScores(prev => ({ ...prev, [created.id]: DEFAULT_SCORE }))
    }
  }

  // ----- AI shortcut -----
  const handleAISend = async (userText) => {
    setAiBusy(true)
    setAiMsg('')
    setAiError('')
    try {
      const { message, actions } = await parseCheckinText({
        userText,
        goals,
        metrics,
        interventions,
        todaysCheckin: {
          ...todaysCheckin,
          scores: { ...(todaysCheckin?.scores || {}), ...scores },
        },
      })

      // Split actions into two buckets:
      //   persistent  → add_intervention, add_metric, log_measurement — apply
      //                 to global state + save to localStorage immediately.
      //   ephemeral   → log_checkin, log_taken — apply to local working copy
      //                 so the user can review before tapping "Log day".
      const persistentTypes = new Set(['add_intervention', 'add_metric', 'log_measurement', 'stop_intervention', 'update_intervention'])
      const persistent = actions.filter(a => persistentTypes.has(a?.type))
      const ephemeral  = actions.filter(a => !persistentTypes.has(a?.type))

      if (persistent.length) applyAIActions(persistent)

      // Now apply the ephemeral ones against a local copy of today's state.
      // We reference the post-persistent interventions/metrics so references
      // to newly-added ids/names resolve correctly.
      const current = {
        goals,
        metrics: allMetrics,
        interventions,
        checkins: {
          ...checkins,
          [today]: { ...(todaysCheckin || {}), date: today, scores: { ...scores } },
        },
        logs:     { ...logs,     [today]: { ...takenMap } },
        measurements,
      }
      const next = applyActions(current, ephemeral, today)

      // Pull values back into component state.
      const newCheckin = next.checkins[today] || {}
      const newScores = newCheckin.scores || {}
      const nextScores = {}
      for (const m of metrics) {
        nextScores[m.id] = newScores[m.id] ?? scores[m.id] ?? DEFAULT_SCORE
      }
      setScores(nextScores)
      setTakenMap({ ...takenMap, ...(next.logs[today] || {}) })

      if (message) setAiMsg(message)
    } catch (err) {
      console.error(err)
      setAiError(
        err?.status === 500
          ? "AI isn't configured yet — add ANTHROPIC_API_KEY to .env.local."
          : err?.message || 'Something went wrong talking to the AI.'
      )
    } finally {
      setAiBusy(false)
    }
  }

  // ----- Log day -----
  const handleLogDay = () => {
    const payload = { scores: { ...scores } }
    if (pro && notes.trim()) payload.notes = notes.trim()
    upsertCheckin(payload, today)
    const logPayload = { ...seedTakenFor(today, interventions, {}), ...takenMap }
    // Persist quantities for interventions that track them
    const activeQty = {}
    for (const i of interventions.filter(x => x.status !== 'stopped' && x.trackQuantity)) {
      if (quantityMap[i.id] != null) activeQty[i.id] = quantityMap[i.id]
    }
    if (Object.keys(activeQty).length) logPayload._quantities = activeQty
    upsertLog(logPayload, today)
    setJustLogged(true)
    setEditing(false)
    // The LogConfirmation overlay manages its own auto-dismiss timer and
    // calls onDismiss when it's done. No timer needed here.
  }

  // ===== Empty state: no metrics configured =====
  if (!metrics || metrics.length === 0) {
    return (
      <div className="fade-in">
        <Header date={today} />
        <div style={styles.empty}>
          No metrics set up yet. Finish onboarding or seed sample data in Insights → Dev tools.
        </div>
      </div>
    )
  }

  // ===== Read-only view (already checked in today) =====
  if (!editing) {
    return (
      <div className="fade-in">
        <Header date={today} />
        <ReadOnlySummary
          checkin={todaysCheckin}
          metrics={metrics}
          interventions={interventions}
          log={logs[today] || {}}
          today={today}
          checkins={checkins}
          logs={logs}
          onEdit={() => setEditing(true)}
        />
        {justLogged && (
          <LogConfirmation date={today} onDismiss={() => setJustLogged(false)} />
        )}
      </div>
    )
  }

  // ===== Edit view =====
  return (
    <div className="fade-in">
      <Header date={today} />

      <section style={{ marginBottom: 8 }}>
        <VoiceInput onSend={handleAISend} busy={aiBusy} />
        {aiMsg && <div style={styles.aiMsg}>{aiMsg}</div>}
        {aiError && <div style={styles.aiError}>{aiError}</div>}
      </section>

      <div className="divider" />

      <section>
        <div className="label-section" style={{ marginBottom: 8 }}>How are you feeling?</div>
        {metrics.map(m => (
          <MetricSlider
            key={m.id}
            metric={m}
            value={scores[m.id]}
            onChange={(v) => setMetric(m.id, v)}
          />
        ))}
        <AddMetricForm
          existingCount={allMetrics?.length || 0}
          onAdd={handleAddMetric}
        />
      </section>

      {(allMetrics || []).some(m => m.type === 'periodic') && (
        <>
          <div className="divider" />
          <MeasurementsCard
            metrics={allMetrics}
            measurements={measurements}
            onLog={logMeasurement}
          />
        </>
      )}

      <div className="divider" />

      <section>
        <StackChecklist
          interventions={interventions}
          log={takenMap}
          onToggle={toggleItem}
          onToggleAll={toggleAll}
          quantities={quantityMap}
          onQuantityChange={setQuantity}
        />
        <AddInterventionForm onAdd={handleAddIntervention} />
      </section>

      <div className="divider" />

      <section>
        <div style={styles.notesHeader}>
          <span className="label-section">Notes (optional)</span>
          {!pro && <span style={styles.proBadge}>🔒 Pro</span>}
        </div>
        <textarea
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder={pro ? 'Anything worth noting today?' : 'Notes are a Pro feature'}
          disabled={!pro}
          style={{
            ...styles.notes,
            opacity: pro ? 1 : 0.55,
            cursor: pro ? 'text' : 'not-allowed',
          }}
        />
      </section>

      <div style={{ height: 20 }} />

      <button
        type="button"
        className="btn btn-primary btn-block"
        onClick={handleLogDay}
      >
        Log day
      </button>
    </div>
  )
}

// ---------- Subcomponents ----------
function Header({ date }) {
  return (
    <header style={styles.header}>
      <div style={styles.brand}>TRACKED</div>
      <time className="mono" style={styles.date} dateTime={date}>
        {formatDateFull(date)}
      </time>
    </header>
  )
}

function ReadOnlySummary({ checkin, metrics, interventions, log, today, checkins, logs, onEdit }) {
  const active = interventions.filter(i => i.status !== 'stopped')
  const takenCount = active.filter(i => log[i.id] !== false).length
  const quantities = log._quantities || {}
  const scores = checkin?.scores || {}

  // Choose a responsive column count: 5 if the user has ≤5 metrics (matches
  // v1), else 4 columns for 6-8 metrics (keeps cells readable on 480px).
  const cols = Math.min(metrics.length || 1, 5)

  return (
    <div>
      <div style={styles.editRow}>
        <span className="label-section">Today's check-in</span>
        <button type="button" className="btn btn-ghost" style={styles.editBtn} onClick={onEdit}>
          Edit
        </button>
      </div>

      <div style={{ ...styles.scoresGrid, gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
        {metrics.map(m => (
          <div key={m.id} style={styles.scoreCell}>
            <span style={styles.scoreIcon} aria-hidden="true">{m.icon}</span>
            <span style={styles.scoreLabel}>{m.label}</span>
            <span className="mono" style={{ ...styles.scoreValue, color: m.color }}>
              {scores[m.id] ?? '—'}
            </span>
          </div>
        ))}
      </div>

      <div className="divider" />

      <div style={styles.stackSummary}>
        <span className="label-section">Stack</span>
        <span className="mono" style={styles.stackCount}>
          {takenCount} / {active.length} done
        </span>
      </div>

      {active.length > 0 && (
        <ul style={styles.readList}>
          {active.map(item => {
            const taken = log[item.id] !== false
            return (
              <li key={item.id} style={styles.readItem}>
                <span
                  aria-hidden="true"
                  style={{
                    ...styles.readMark,
                    background: taken ? 'var(--accent)' : 'transparent',
                    borderColor: taken ? 'var(--accent)' : 'var(--b1)',
                    color: taken ? 'var(--bg)' : 'var(--t3)',
                  }}
                >
                  {taken ? '✓' : ''}
                </span>
                <span style={styles.itemIcon} aria-hidden="true">{iconForType(item.type)}</span>
                <span
                  style={{
                    ...styles.readName,
                    textDecoration: taken ? 'none' : 'line-through',
                    color: taken ? 'var(--t1)' : 'var(--t3)',
                  }}
                >
                  {item.name}
                </span>
                {item.trackQuantity ? (
                  <span className="mono" style={styles.readDose}>
                    {quantities[item.id] ?? 0}{item.quantityLabel ? ` ${item.quantityLabel}` : ''}
                  </span>
                ) : item.dose ? (
                  <span className="mono" style={styles.readDose}>{item.dose}</span>
                ) : null}
              </li>
            )
          })}
        </ul>
      )}

      <div className="divider" />

      <SevenDayStrip
        today={today}
        checkins={checkins || {}}
        logs={logs || {}}
        metrics={metrics}
      />

      {checkin?.notes && (
        <>
          <div className="divider" />
          <div style={styles.notesRead}>{checkin.notes}</div>
        </>
      )}
    </div>
  )
}

// Seven-day completion strip. A day counts as "complete" if the user has a
// scores-complete check-in for it. A day with *some* data (partial scores or
// any stack log) counts as partial. Everything else is empty.
function SevenDayStrip({ today, checkins, logs, metrics }) {
  const days = []
  for (let i = 6; i >= 0; i--) {
    const iso = addDaysIso(today, -i)
    const ck = checkins[iso]
    const hasAllScores = metrics.length > 0 && ck?.scores
      && metrics.every(m => ck.scores[m.id] != null)
    const hasAnyData = !!ck?.scores && Object.keys(ck.scores).length > 0
      || (logs[iso] && Object.keys(logs[iso]).length > 0)
    const state = hasAllScores ? 'full' : (hasAnyData ? 'partial' : 'empty')
    days.push({
      iso,
      letter: weekdayLetter(iso),
      state,
      isToday: iso === today,
    })
  }

  return (
    <div>
      <div className="label-section" style={{ marginBottom: 12 }}>Last 7 days</div>
      <div style={styles.stripRow}>
        {days.map(d => {
          const fill = d.state === 'full'
            ? 'var(--accent)'
            : d.state === 'partial'
              ? 'var(--accent-subtle)'
              : 'transparent'
          const border = d.state === 'empty' ? 'var(--b1)' : 'var(--accent)'
          return (
            <div key={d.iso} style={styles.stripCell}>
              <div
                aria-label={`${d.iso} ${d.state}`}
                style={{
                  ...styles.stripDot,
                  background: fill,
                  borderColor: border,
                  boxShadow: d.isToday ? '0 0 0 3px var(--accent-subtle)' : 'none',
                }}
              />
              <span
                style={{
                  ...styles.stripLabel,
                  color: d.isToday ? 'var(--t1)' : 'var(--t3)',
                  fontWeight: d.isToday ? 600 : 400,
                }}
              >
                {d.letter}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ---------- Date math (local-time safe) ----------
function addDaysIso(iso, delta) {
  const d = new Date(iso + 'T00:00:00')
  d.setDate(d.getDate() + delta)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function weekdayLetter(iso) {
  const d = new Date(iso + 'T00:00:00')
  return d.toLocaleDateString(undefined, { weekday: 'narrow' })
}

// ---------- Helpers ----------
function hasCompleteCheckin(checkin, metrics) {
  if (!checkin || !metrics || metrics.length === 0) return false
  const scores = checkin.scores || {}
  return metrics.every(m => scores[m.id] != null)
}

function seedScoresFor(todayDate, checkins, metrics) {
  // Use today's existing check-in if present; otherwise yesterday's scores;
  // otherwise default to 5. Keyed by metric id.
  if (!metrics || metrics.length === 0) return {}

  const today = checkins[todayDate]
  if (today && today.scores) {
    const out = {}
    for (const m of metrics) out[m.id] = today.scores[m.id] ?? DEFAULT_SCORE
    return out
  }

  const dates = Object.keys(checkins).filter(d => d < todayDate).sort()
  const yesterday = dates.length ? checkins[dates[dates.length - 1]] : null
  const prevScores = yesterday?.scores || {}
  const out = {}
  for (const m of metrics) out[m.id] = prevScores[m.id] ?? DEFAULT_SCORE
  return out
}

function seedTakenFor(todayDate, interventions, logs) {
  const existing = logs[todayDate] || {}
  const map = {}
  for (const i of interventions.filter(x => x.status !== 'stopped')) {
    map[i.id] = existing[i.id] == null ? true : existing[i.id]
  }
  return map
}

// ---------- Styles ----------
const styles = {
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    padding: 'calc(env(safe-area-inset-top) + 16px) 0 16px',
    marginBottom: 8,
  },
  brand: {
    fontSize: 13,
    fontWeight: 600,
    letterSpacing: '0.12em',
    color: 'var(--t1)',
  },
  date: {
    fontSize: 13,
    color: 'var(--t3)',
    fontVariantNumeric: 'tabular-nums',
  },
  empty: {
    padding: 32,
    textAlign: 'center',
    color: 'var(--t3)',
    fontSize: 14,
    lineHeight: 1.5,
  },
  aiMsg: {
    marginTop: 10,
    fontSize: 13,
    color: 'var(--t2)',
    padding: '8px 14px',
    borderRadius: 10,
    background: 'var(--accent-subtle)',
  },
  aiError: {
    marginTop: 10,
    fontSize: 13,
    color: '#B42318',
    padding: '8px 14px',
    borderRadius: 10,
    background: 'rgba(180, 35, 24, 0.06)',
  },
  notesHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  proBadge: {
    fontSize: 11,
    fontWeight: 500,
    color: 'var(--t3)',
    padding: '2px 8px',
    borderRadius: 100,
    background: 'var(--s2)',
  },
  notes: {
    width: '100%',
    padding: 12,
    borderRadius: 10,
    background: 'var(--s2)',
    color: 'var(--t1)',
    fontSize: 14.5,
    resize: 'vertical',
    minHeight: 64,
    letterSpacing: '-0.01em',
  },
  editRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  editBtn: {
    padding: '6px 14px',
    fontSize: 13,
  },
  scoresGrid: {
    display: 'grid',
    gap: 6,
  },
  scoreCell: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 4,
    padding: '14px 4px',
    borderRadius: 10,
    background: 'var(--s2)',
  },
  scoreIcon: { fontSize: 16, lineHeight: 1 },
  scoreLabel: {
    fontSize: 11,
    color: 'var(--t3)',
    fontWeight: 500,
    letterSpacing: '-0.005em',
    textAlign: 'center',
  },
  scoreValue: {
    fontSize: 20,
    fontWeight: 600,
    fontVariantNumeric: 'tabular-nums',
  },
  stackSummary: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  stackCount: {
    fontSize: 14,
    color: 'var(--t2)',
    fontVariantNumeric: 'tabular-nums',
  },
  readList: {
    listStyle: 'none',
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    padding: 0,
    margin: 0,
  },
  readItem: {
    display: 'grid',
    gridTemplateColumns: '20px 20px 1fr auto',
    alignItems: 'center',
    gap: 10,
    padding: '6px 0',
  },
  readMark: {
    width: 20,
    height: 20,
    borderRadius: 6,
    border: '1px solid var(--b1)',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 12,
    fontWeight: 700,
    lineHeight: 1,
  },
  readName: {
    fontSize: 14.5,
    fontWeight: 500,
    letterSpacing: '-0.01em',
  },
  readDose: {
    fontSize: 13,
    color: 'var(--t3)',
    fontVariantNumeric: 'tabular-nums',
  },
  stripRow: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: 8,
  },
  stripCell: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 8,
  },
  stripDot: {
    width: 14,
    height: 14,
    borderRadius: '50%',
    border: '1.5px solid',
    transition: 'box-shadow 120ms ease',
  },
  stripLabel: {
    fontSize: 11,
    letterSpacing: '0.04em',
  },
  notesRead: {
    fontSize: 14,
    color: 'var(--t2)',
    lineHeight: 1.5,
    padding: '0 2px',
  },
}
