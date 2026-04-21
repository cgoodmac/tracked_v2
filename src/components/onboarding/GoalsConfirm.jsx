// Step 3 — Goals confirmation.
//
// Goals are shown as chips grouped by how we track them:
//   - solid color dot      → scale metric (rated daily 1-10)
//   - outlined color dot   → periodic metric (occasional measurement)
//   - no dot, dimmer chip  → aspirational (no metric)
//
// Below the chips, three sections describe the tracking plan:
//   - "We'll track these daily"        — scale metrics (live now)
//   - "Measurements (coming soon)"     — periodic metrics (planned)
//   - "Long-term aspirations"          — goals with no metric at all
//
// Tap the ✕ on any chip to remove it. Back returns to the input to rewrite.

import { OnboardingPage, BackRow, StepLabel, StepHeading } from './ui.jsx'

export default function GoalsConfirm({ goals, metrics = [], onBack, onContinue, onRemoveGoal }) {
  const count = goals.length
  const label = count === 1 ? 'Continue with 1 goal' : `Continue with ${count} goals`

  const metricById = new Map(metrics.map(m => [m.id, m]))
  const scaleMetrics = metrics.filter(m => (m.type || 'scale') === 'scale')
  const periodicMetrics = metrics.filter(m => m.type === 'periodic')
  const aspirationalGoals = goals.filter(g => !g.metricId)

  return (
    <OnboardingPage
      footer={
        <button
          type="button"
          className="btn btn-primary btn-block"
          onClick={onContinue}
          disabled={count === 0}
        >
          {count === 0 ? 'Go back to add goals' : label}
        </button>
      }
    >
      <BackRow onBack={onBack} />

      <StepLabel>Your goals</StepLabel>

      <StepHeading
        title="Does this look right?"
        subtitle="Tap any goal to remove it, or go back to rewrite."
      />

      {count === 0 ? (
        <div style={styles.empty}>
          No goals left. Go back and try again.
        </div>
      ) : (
        <>
          {/* ---- Mini legend: shows what each pill style means ---- */}
          <div style={styles.legend} role="group" aria-label="Pill style legend">
            <span style={{ ...styles.legendItem, ...styles.pillScale }}>
              <span
                aria-hidden="true"
                style={{ ...styles.legendDot, background: 'var(--accent)' }}
              />
              tracked daily
            </span>
            <span style={{ ...styles.legendItem, ...styles.pillPeriodic }}>
              <span
                aria-hidden="true"
                style={{
                  ...styles.legendDot,
                  background: 'transparent',
                  border: '2px solid var(--accent)',
                }}
              />
              measured periodically
            </span>
            <span style={{ ...styles.legendItem, ...styles.pillAspirational }}>
              long-term
            </span>
          </div>

          <div style={styles.pills}>
            {goals.map((goal, i) => {
              const metric = goal.metricId ? metricById.get(goal.metricId) : null
              const kind = !metric
                ? 'aspirational'
                : (metric.type === 'periodic' ? 'periodic' : 'scale')
              return (
                <button
                  key={goal.id || `${goal.name}-${i}`}
                  type="button"
                  onClick={() => onRemoveGoal(i)}
                  style={{
                    ...styles.pill,
                    ...(kind === 'scale' ? styles.pillScale : {}),
                    ...(kind === 'periodic' ? styles.pillPeriodic : {}),
                    ...(kind === 'aspirational' ? styles.pillAspirational : {}),
                  }}
                  aria-label={`Remove goal: ${goal.name}`}
                >
                  {metric && kind === 'scale' && (
                    <span
                      aria-hidden="true"
                      style={{ ...styles.dot, background: metric.color }}
                    />
                  )}
                  {metric && kind === 'periodic' && (
                    <span
                      aria-hidden="true"
                      style={{
                        ...styles.dot,
                        background: 'transparent',
                        border: `2px solid ${metric.color}`,
                      }}
                    />
                  )}
                  <span>{goal.name}</span>
                  <span style={styles.x}>✕</span>
                </button>
              )
            })}
          </div>

          {/* ---- Section 1: Daily metrics (live) ---- */}
          {scaleMetrics.length > 0 && (
            <section style={styles.section}>
              <div style={styles.sectionHeader}>
                <span className="label-section">We'll track these daily</span>
                <span style={styles.count}>{scaleMetrics.length}</span>
              </div>
              <div style={styles.metricList}>
                {scaleMetrics.map(m => (
                  <div key={m.id} style={styles.metricRow}>
                    <span style={{ ...styles.metricSwatch, background: m.color }} />
                    <span style={styles.metricIcon} aria-hidden="true">{m.icon}</span>
                    <span style={styles.metricLabel}>{m.label}</span>
                    <span style={styles.metricMeta}>
                      {m.low} → {m.high}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* ---- Section 2: Periodic measurements (coming soon) ---- */}
          {periodicMetrics.length > 0 && (
            <section style={styles.section}>
              <div style={styles.sectionHeader}>
                <span className="label-section">Measurements</span>
                <span style={styles.soonTag}>Coming soon</span>
                <span style={styles.count}>{periodicMetrics.length}</span>
              </div>
              <div style={styles.metricList}>
                {periodicMetrics.map(m => (
                  <div key={m.id} style={styles.metricRow}>
                    <span
                      style={{
                        ...styles.metricSwatch,
                        background: 'transparent',
                        border: `2px solid ${m.color}`,
                      }}
                    />
                    <span style={styles.metricIcon} aria-hidden="true">{m.icon}</span>
                    <span style={styles.metricLabel}>{m.label}</span>
                    <span style={styles.metricMeta}>
                      {m.unit}{m.cadence ? ` · ${m.cadence}` : ''}
                    </span>
                  </div>
                ))}
              </div>
              <div style={styles.note}>
                Enter values whenever you have them — from labs, the scale, a wearable, etc. Not live yet, but we'll hold onto the setup so it's ready when the feature ships.
              </div>
            </section>
          )}

          {/* ---- Section 3: Aspirational goals (no metric) ---- */}
          {aspirationalGoals.length > 0 && (
            <section style={styles.section}>
              <div style={styles.sectionHeader}>
                <span className="label-section">Long-term goals</span>
                <span style={styles.count}>{aspirationalGoals.length}</span>
              </div>
              <div style={styles.note}>
                {listWithAnd(aspirationalGoals.map(g => g.name))}
                {aspirationalGoals.length === 1 ? ' is' : ' are'} hard to reduce to a number.
                We'll keep {aspirationalGoals.length === 1 ? 'it' : 'them'} in context for AI recommendations about your stack, but {aspirationalGoals.length === 1 ? "it won't" : "they won't"} appear in regular tracking.
              </div>
            </section>
          )}
        </>
      )}
    </OnboardingPage>
  )
}

function listWithAnd(items) {
  if (!items || items.length === 0) return ''
  if (items.length === 1) return items[0]
  if (items.length === 2) return `${items[0]} and ${items[1]}`
  return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`
}

const styles = {
  empty: {
    color: 'var(--t3)',
    fontSize: 14,
    padding: 16,
    borderRadius: 12,
    background: 'var(--s2)',
  },
  legend: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: -8,
    marginBottom: 2,
  },
  legendItem: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 5,
    padding: '3px 9px',
    borderRadius: 100,
    fontSize: 11,
    fontWeight: 500,
    letterSpacing: '-0.005em',
    opacity: 0.9,
  },
  legendDot: {
    display: 'inline-block',
    width: 6,
    height: 6,
    borderRadius: '50%',
  },
  pills: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8,
  },
  pill: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    padding: '10px 12px 10px 14px',
    borderRadius: 100,
    fontSize: 14,
    fontWeight: 500,
    letterSpacing: '-0.01em',
    transition: 'opacity 120ms ease',
  },
  pillScale: {
    background: 'var(--accent-subtle)',
    color: 'var(--accent)',
    border: '1px solid var(--accent)',
  },
  pillPeriodic: {
    background: 'var(--s2)',
    color: 'var(--accent)',
    border: '1px dashed var(--accent)',
  },
  pillAspirational: {
    background: 'var(--s2)',
    color: 'var(--t2)',
    border: '1px solid var(--b1)',
  },
  dot: {
    display: 'inline-block',
    width: 8,
    height: 8,
    borderRadius: '50%',
  },
  x: {
    fontSize: 11,
    opacity: 0.7,
    marginLeft: 2,
  },
  section: {
    marginTop: 20,
  },
  sectionHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  soonTag: {
    fontSize: 10,
    fontWeight: 600,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    padding: '2px 8px',
    borderRadius: 100,
    background: 'var(--accent-subtle)',
    color: 'var(--accent)',
  },
  count: {
    marginLeft: 'auto',
    fontSize: 12,
    color: 'var(--t3)',
    fontFamily: 'var(--font-mono)',
    fontVariantNumeric: 'tabular-nums',
  },
  metricList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    padding: 4,
    borderRadius: 12,
    background: 'var(--s2)',
  },
  metricRow: {
    display: 'grid',
    gridTemplateColumns: '6px 22px 1fr auto',
    alignItems: 'center',
    gap: 10,
    padding: '10px 12px',
    borderRadius: 8,
  },
  metricSwatch: {
    width: 6,
    height: 22,
    borderRadius: 3,
  },
  metricIcon: {
    fontSize: 14,
    textAlign: 'center',
  },
  metricLabel: {
    fontSize: 14,
    fontWeight: 500,
    color: 'var(--t1)',
    letterSpacing: '-0.01em',
  },
  metricMeta: {
    fontSize: 12,
    color: 'var(--t3)',
    letterSpacing: '-0.005em',
  },
  note: {
    marginTop: 10,
    fontSize: 12.5,
    color: 'var(--t3)',
    lineHeight: 1.5,
    padding: '0 2px',
  },
}
