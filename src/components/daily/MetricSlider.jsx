// A single metric's 1–10 slider row, shown stacked:
//   Row 1: icon + label on the left, current value on the right
//   Row 2: full-width slider track
//
// The stacked layout keeps long labels ("Body fat percentage", "Mental
// clarity") from colliding with the slider bar, and gives the track the
// full row width so the filled vs empty portion is easy to read.
//
// The filled portion of the track is tinted with the metric's color.

import { useId } from 'react'

export default function MetricSlider({ metric, value, onChange, disabled = false }) {
  const id = useId()
  const v = value ?? 5
  const pct = ((v - 1) / 9) * 100 // 1..10 → 0..100%

  const trackBg = `linear-gradient(
    to right,
    ${metric.color} 0%,
    ${metric.color} ${pct}%,
    var(--b1) ${pct}%,
    var(--b1) 100%
  )`

  return (
    <div style={styles.row}>
      <div style={styles.topRow}>
        <label htmlFor={id} style={styles.left} title={metric.label}>
          <span style={styles.icon} aria-hidden="true">{metric.icon}</span>
          <span style={styles.label}>{metric.label}</span>
        </label>
        <span className="mono" style={{ ...styles.score, color: metric.color }}>
          {v}
        </span>
      </div>

      <input
        id={id}
        type="range"
        min={1}
        max={10}
        step={1}
        value={v}
        disabled={disabled}
        onChange={(e) => onChange && onChange(Number(e.target.value))}
        className="tracked-slider"
        style={{ ...styles.slider, background: trackBg, ['--thumb' ]: metric.color }}
        aria-label={`${metric.label} score`}
        aria-valuemin={1}
        aria-valuemax={10}
        aria-valuenow={v}
      />
    </div>
  )
}

const styles = {
  row: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    padding: '10px 0',
  },
  topRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  left: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    color: 'var(--t1)',
    fontSize: 14,
    fontWeight: 500,
    letterSpacing: '-0.01em',
    cursor: 'pointer',
    userSelect: 'none',
    minWidth: 0, // lets the label truncate if ever extremely long
  },
  icon: { fontSize: 16, lineHeight: 1, flexShrink: 0 },
  label: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  slider: {
    WebkitAppearance: 'none',
    appearance: 'none',
    width: '100%',
    height: 6,
    borderRadius: 100,
    outline: 'none',
    cursor: 'pointer',
  },
  score: {
    fontSize: 15,
    fontWeight: 600,
    fontVariantNumeric: 'tabular-nums',
    flexShrink: 0,
  },
}
