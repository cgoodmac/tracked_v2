// Read-only goals overview. Shows the user's goals grouped by tracking type
// (daily scale, periodic measurement, aspirational) using the same pill style
// as the onboarding confirmation screen.

import { useAppState } from '../hooks/useAppState.jsx'

export default function GoalsScreen() {
  const { goals, metrics } = useAppState()

  const metricById = new Map(metrics.map(m => [m.id, m]))
  const scaleMetrics = metrics.filter(m => (m.type || 'scale') === 'scale')
  const periodicMetrics = metrics.filter(m => m.type === 'periodic')
  const aspirationalGoals = goals.filter(g => !g.metricId)

  if (goals.length === 0) {
    return (
      <div style={{ padding: 'calc(env(safe-area-inset-top) + 16px) 0' }}>
        <div className="label-section" style={{ marginBottom: 8 }}>Goals</div>
        <p style={{ color: 'var(--t2)', fontSize: 14, lineHeight: 1.5 }}>
          No goals set up yet.
        </p>
      </div>
    )
  }

  return (
    <div style={{ padding: 'calc(env(safe-area-inset-top) + 16px) 0 120px' }}>
      <div className="label-section" style={{ marginBottom: 8 }}>Goals</div>
      <h2 style={{ fontSize: 20, marginBottom: 4 }}>What you're working toward</h2>
      <p style={{ color: 'var(--t2)', fontSize: 14, lineHeight: 1.5, marginBottom: 20 }}>
        {goals.length} {goals.length === 1 ? 'goal' : 'goals'} set during onboarding.
      </p>

      {/* ---- Legend ---- */}
      <div style={styles.legend} role="group" aria-label="Pill style legend">
        <span style={{ ...styles.legendItem, ...styles.pillScale }}>
          <span aria-hidden="true" style={{ ...styles.legendDot, background: 'var(--accent)' }} />
          tracked daily
        </span>
        <span style={{ ...styles.legendItem, ...styles.pillPeriodic }}>
          <span
            aria-hidden="true"
            style={{ ...styles.legendDot, background: 'transparent', border: '2px solid var(--accent)' }}
          />
          measured periodically
        </span>
        <span style={{ ...styles.legendItem, ...styles.pillAspirational }}>
          long-term
        </span>
      </div>

      {/* ---- Goal pills ---- */}
      <div style={styles.pills}>
        {goals.map((goal, i) => {
          const metric = goal.metricId ? metricById.get(goal.metricId) : null
          const kind = !metric
            ? 'aspirational'
            : (metric.type === 'periodic' ? 'periodic' : 'scale')
          return (
            <span
              key={goal.id || `${goal.name}-${i}`}
              style={{
                ...styles.pill,
                ...(kind === 'scale' ? styles.pillScale : {}),
                ...(kind === 'periodic' ? styles.pillPeriodic : {}),
                ...(kind === 'aspirational' ? styles.pillAspirational : {}),
              }}
            >
              {metric && kind === 'scale' && (
                <span aria-hidden="true" style={{ ...styles.dot, background: metric.color }} />
              )}
              {metric && kind === 'periodic' && (
                <span
                  aria-hidden="true"
                  style={{ ...styles.dot, background: 'transparent', border: `2px solid ${metric.color}` }}
                />
              )}
              <span>{goal.name}</span>
            </span>
          )
        })}
      </div>

      {/* ---- Section 1: Daily metrics ---- */}
      {scaleMetrics.length > 0 && (
        <section style={styles.section}>
          <div style={styles.sectionHeader}>
            <span className="label-section">Tracked daily</span>
            <span style={styles.count}>{scaleMetrics.length}</span>
          </div>
          <div style={styles.metricList}>
            {scaleMetrics.map(m => (
              <div key={m.id} style={styles.metricRow}>
                <span style={{ ...styles.metricSwatch, background: m.color }} />
                <span style={styles.metricIcon} aria-hidden="true">{m.icon}</span>
                <span style={styles.metricLabel}>{m.label}</span>
                <span style={styles.metricMeta}>{m.low} → {m.high}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ---- Section 2: Periodic measurements ---- */}
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
        </section>
      )}

      {/* ---- Section 3: Aspirational goals ---- */}
      {aspirationalGoals.length > 0 && (
        <section style={styles.section}>
          <div style={styles.sectionHeader}>
            <span className="label-section">Long-term goals</span>
            <span style={styles.count}>{aspirationalGoals.length}</span>
          </div>
          <div style={styles.note}>
            {listWithAnd(aspirationalGoals.map(g => g.name))}
            {aspirationalGoals.length === 1 ? ' is' : ' are'} kept in context for AI
            recommendations but {aspirationalGoals.length === 1 ? "won't" : "won't"} appear
            in daily tracking.
          </div>
        </section>
      )}
    </div>
  )
}

function listWithAnd(items) {
  if (!items || items.length === 0) return ''
  if (items.length === 1) return items[0]
  if (items.length === 2) return `${items[0]} and ${items[1]}`
  return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`
}

const styles = {
  legend: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 10,
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
    padding: '10px 14px',
    borderRadius: 100,
    fontSize: 14,
    fontWeight: 500,
    letterSpacing: '-0.01em',
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
