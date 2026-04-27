// Goals overview — shows each goal with a sparkline trend over the last 30 days.
// Grouped by tracking type: daily → periodic → long-term.
// Taps into checkins (daily scores) and measurements (periodic values) for data.

import { useMemo } from 'react'
import { useAppState } from '../hooks/useAppState.jsx'
import Sparkline from './Sparkline.jsx'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Return sorted ISO date strings for the last N days ending today. */
function lastNDays(n) {
  const days = []
  const now = new Date()
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    days.push(d.toISOString().slice(0, 10))
  }
  return days
}

/**
 * Extract a 30-day data series for a daily-scale metric.
 * Returns an array of 30 numbers (1–10) or nulls for missing days.
 */
function dailySeries(metricId, checkins, days) {
  return days.map(d => {
    const ck = checkins[d]
    if (!ck || !ck.scores) return null
    const v = ck.scores[metricId]
    return v != null ? v : null
  })
}

/**
 * Extract a sparse series for a periodic metric from measurements.
 * Returns an array of 30 slots, mostly null, with values placed at the right index.
 */
function periodicSeries(metricId, measurements, days) {
  const entries = (measurements[metricId] || [])
  const daySet = new Map(days.map((d, i) => [d, i]))
  const series = new Array(days.length).fill(null)
  entries.forEach(e => {
    const idx = daySet.get(e.date)
    if (idx != null) series[idx] = e.value
  })
  return series
}

/**
 * Calculate a trend summary from a data series.
 * Returns { trend: 'improving'|'declining'|'steady', delta: string, color: string }
 */
function calcTrend(series, direction = 'up') {
  const vals = series.filter(v => v != null)
  if (vals.length < 2) return { trend: 'steady', delta: '—', color: 'var(--t3)' }

  // Compare the average of the first third to the last third
  const third = Math.max(1, Math.floor(vals.length / 3))
  const early = vals.slice(0, third)
  const late = vals.slice(-third)
  const earlyAvg = early.reduce((a, b) => a + b, 0) / early.length
  const lateAvg = late.reduce((a, b) => a + b, 0) / late.length

  if (earlyAvg === 0) return { trend: 'steady', delta: '—', color: 'var(--t3)' }

  const pctChange = ((lateAvg - earlyAvg) / earlyAvg) * 100
  const sign = pctChange >= 0 ? '+' : ''
  const deltaStr = `${sign}${Math.round(pctChange)}%`

  // "Improving" depends on whether the metric direction is up or down
  const isPositive = direction === 'down' ? pctChange < -3 : pctChange > 3
  const isNegative = direction === 'down' ? pctChange > 3 : pctChange < -3

  if (isPositive) return { trend: 'improving', delta: deltaStr, color: 'var(--m-anxiety)' } // teal
  if (isNegative) return { trend: 'declining', delta: deltaStr, color: '#FF5A5F' }
  return { trend: 'steady', delta: deltaStr, color: 'var(--t3)' }
}

// Trend badge colors per theme
const TREND_STYLES = {
  improving: {
    bg: 'rgba(0, 166, 153, 0.1)',
    color: '#00A699',
    arrow: '↑',
  },
  declining: {
    bg: 'rgba(255, 90, 95, 0.1)',
    color: '#FF5A5F',
    arrow: '↓',
  },
  steady: {
    bg: 'var(--s2)',
    color: 'var(--t3)',
    arrow: '→',
  },
}

// ---------------------------------------------------------------------------
// Components
// ---------------------------------------------------------------------------

function TrendBadge({ trend, delta }) {
  const s = TREND_STYLES[trend] || TREND_STYLES.steady
  return (
    <span
      style={{
        fontSize: 11,
        fontWeight: 500,
        padding: '2px 8px',
        borderRadius: 100,
        background: s.bg,
        color: s.color,
        whiteSpace: 'nowrap',
        fontFamily: 'var(--font-mono)',
        fontVariantNumeric: 'tabular-nums',
      }}
    >
      {s.arrow} {delta} 30d
    </span>
  )
}

function GoalCard({ name, subtitle, series, color, trend, periodic }) {
  return (
    <div style={styles.card}>
      <div style={styles.cardTop}>
        <span style={styles.cardName}>{name}</span>
        <TrendBadge trend={trend.trend} delta={trend.delta} />
      </div>
      <div style={styles.cardBottom}>
        <span style={styles.cardSubtitle}>{subtitle}</span>
        <Sparkline
          data={series}
          color={color}
          periodic={periodic}
          width={100}
          height={32}
        />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------

export default function GoalsScreen() {
  const { goals, metrics, checkins, measurements } = useAppState()

  const metricById = useMemo(
    () => new Map(metrics.map(m => [m.id, m])),
    [metrics],
  )

  const days30 = useMemo(() => lastNDays(30), [])

  // Categorize goals
  const { daily, periodic, longTerm } = useMemo(() => {
    const daily = []
    const periodic = []
    const longTerm = []

    goals.forEach(goal => {
      const metric = goal.metricId ? metricById.get(goal.metricId) : null
      if (!metric) {
        longTerm.push({ goal, metric: null })
      } else if (metric.type === 'periodic') {
        periodic.push({ goal, metric })
      } else {
        daily.push({ goal, metric })
      }
    })

    return { daily, periodic, longTerm }
  }, [goals, metricById])

  // Pre-compute series + trends
  const dailyData = useMemo(() => {
    return daily.map(({ goal, metric }) => {
      const series = dailySeries(metric.id, checkins, days30)
      const trend = calcTrend(series, metric.direction)
      return { goal, metric, series, trend }
    })
  }, [daily, checkins, days30])

  const periodicData = useMemo(() => {
    return periodic.map(({ goal, metric }) => {
      const series = periodicSeries(metric.id, measurements, days30)
      const trend = calcTrend(series, metric.direction)
      return { goal, metric, series, trend }
    })
  }, [periodic, measurements, days30])

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
      <h2 style={{ fontSize: 20, marginBottom: 4 }}>Your goals</h2>
      <p style={{ color: 'var(--t2)', fontSize: 14, lineHeight: 1.5, marginBottom: 20 }}>
        {goals.length} {goals.length === 1 ? 'goal' : 'goals'} set during onboarding.
      </p>

      {/* ---- Daily tracked ---- */}
      {dailyData.length > 0 && (
        <section style={styles.section}>
          <div style={styles.sectionHeader}>
            <span className="label-section">Tracked daily</span>
            <span style={styles.count}>{dailyData.length}</span>
          </div>
          <div style={styles.cardList}>
            {dailyData.map(({ goal, metric, series, trend }) => (
              <GoalCard
                key={goal.id}
                name={goal.name}
                subtitle={`${metric.low} → ${metric.high}`}
                series={series}
                color={metric.color}
                trend={trend}
                periodic={false}
              />
            ))}
          </div>
        </section>
      )}

      {/* ---- Periodic ---- */}
      {periodicData.length > 0 && (
        <section style={styles.section}>
          <div style={styles.sectionHeader}>
            <span className="label-section">Measured periodically</span>
            <span style={styles.count}>{periodicData.length}</span>
          </div>
          <div style={styles.cardList}>
            {periodicData.map(({ goal, metric, series, trend }) => (
              <GoalCard
                key={goal.id}
                name={goal.name}
                subtitle={metric.unit ? `${metric.unit}${metric.cadence ? ` · ${metric.cadence}` : ''}` : metric.cadence || ''}
                series={series}
                color={metric.color}
                trend={trend}
                periodic={true}
              />
            ))}
          </div>
        </section>
      )}

      {/* ---- Long-term ---- */}
      {longTerm.length > 0 && (
        <section style={styles.section}>
          <div style={styles.sectionHeader}>
            <span className="label-section">Long-term</span>
            <span style={styles.count}>{longTerm.length}</span>
          </div>
          <div style={styles.cardList}>
            {longTerm.map(({ goal }) => (
              <div key={goal.id} style={styles.card}>
                <span style={styles.cardName}>{goal.name}</span>
                {goal.note && (
                  <span style={{ ...styles.cardSubtitle, marginTop: 4 }}>{goal.note}</span>
                )}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = {
  section: {
    marginBottom: 20,
  },
  sectionHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  count: {
    marginLeft: 'auto',
    fontSize: 12,
    color: 'var(--t3)',
    fontFamily: 'var(--font-mono)',
    fontVariantNumeric: 'tabular-nums',
  },
  cardList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  card: {
    padding: '12px 14px',
    borderRadius: 10,
    background: 'var(--s2)',
  },
  cardTop: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  cardBottom: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardName: {
    fontSize: 15,
    fontWeight: 500,
    letterSpacing: '-0.01em',
    color: 'var(--t1)',
  },
  cardSubtitle: {
    fontSize: 12,
    color: 'var(--t3)',
    letterSpacing: '-0.005em',
  },
}
