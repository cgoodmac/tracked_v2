// Inline "+ Track something new" button that expands into a form for
// adding a new metric (scale or periodic). Always creates a linked goal
// of the same name so the new metric shows up as something the user is
// explicitly working on.
//
// Visible on the daily check-in, right below the sliders.

import { useState } from 'react'
import { colorFromPalette } from '../../lib/constants.js'

// A curated icon set so the picker is cheap and touchable without needing
// an emoji keyboard. The user can also type any emoji in the free-form field.
const ICON_CHOICES = [
  '😌', '⚡', '🎯', '🌙', '🔥', '💪', '🧠', '🌊', '💧', '🥗',
  '🏃', '🫁', '❤️', '🩺', '⚖️', '📏', '🩸', '🌱', '✨', '📝',
]

export default function AddMetricForm({ existingCount = 0, onAdd }) {
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState('scale') // 'scale' | 'periodic'
  const [name, setName] = useState('')
  const [icon, setIcon] = useState('😌')
  const [direction, setDirection] = useState('up')
  const [low, setLow] = useState('')
  const [high, setHigh] = useState('')
  const [unit, setUnit] = useState('')
  const [cadence, setCadence] = useState('monthly')

  const reset = () => {
    setMode('scale')
    setName('')
    setIcon('😌')
    setDirection('up')
    setLow('')
    setHigh('')
    setUnit('')
    setCadence('monthly')
  }

  const handleCancel = () => {
    reset()
    setOpen(false)
  }

  const handleSave = () => {
    const trimmed = name.trim()
    if (!trimmed) return
    const color = colorFromPalette(existingCount)
    const payload = {
      name: trimmed.toLowerCase(),
      label: trimmed.charAt(0).toUpperCase() + trimmed.slice(1),
      type: mode,
      direction,
      icon,
      color,
    }
    if (mode === 'scale') {
      payload.low = low.trim() || (direction === 'down' ? 'bad' : 'low')
      payload.high = high.trim() || (direction === 'down' ? 'good' : 'high')
    } else {
      payload.unit = unit.trim()
      payload.cadence = cadence.trim()
    }
    onAdd(payload)
    reset()
    setOpen(false)
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={styles.trigger}
      >
        <span style={styles.plus} aria-hidden="true">+</span>
        <span>Track something new</span>
      </button>
    )
  }

  return (
    <div style={styles.form}>
      {/* Mode toggle — scale vs periodic */}
      <div style={styles.modeRow}>
        <button
          type="button"
          onClick={() => setMode('scale')}
          style={{
            ...styles.modeBtn,
            ...(mode === 'scale' ? styles.modeBtnActive : {}),
          }}
        >
          Daily 1–10
        </button>
        <button
          type="button"
          onClick={() => setMode('periodic')}
          style={{
            ...styles.modeBtn,
            ...(mode === 'periodic' ? styles.modeBtnActive : {}),
          }}
        >
          Measurement
        </button>
      </div>
      <div style={styles.modeHint}>
        {mode === 'scale'
          ? 'A subjective feeling you can rate daily on a 1–10 slider.'
          : 'An objective numeric value you log when you have new data.'}
      </div>

      <div style={styles.fields}>
        <label style={{ ...styles.field, flex: 2, minWidth: 160 }}>
          <span style={styles.fieldLabel}>Name</span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={mode === 'scale' ? 'e.g. pain, focus, mood' : 'e.g. body fat %, sleep score'}
            autoFocus
            className="tracked-input"
            style={styles.input}
          />
        </label>

        <label style={{ ...styles.field, minWidth: 120 }}>
          <span style={styles.fieldLabel}>Direction</span>
          <select
            value={direction}
            onChange={(e) => setDirection(e.target.value)}
            className="tracked-input"
            style={styles.input}
          >
            <option value="up">Higher is better</option>
            <option value="down">Lower is better</option>
          </select>
        </label>
      </div>

      {mode === 'scale' ? (
        <div style={styles.fields}>
          <label style={{ ...styles.field, minWidth: 120 }}>
            <span style={styles.fieldLabel}>At 1 (low)</span>
            <input
              type="text"
              value={low}
              onChange={(e) => setLow(e.target.value)}
              placeholder={direction === 'down' ? 'anxious' : 'drained'}
              className="tracked-input"
              style={styles.input}
            />
          </label>
          <label style={{ ...styles.field, minWidth: 120 }}>
            <span style={styles.fieldLabel}>At 10 (high)</span>
            <input
              type="text"
              value={high}
              onChange={(e) => setHigh(e.target.value)}
              placeholder={direction === 'down' ? 'calm' : 'energized'}
              className="tracked-input"
              style={styles.input}
            />
          </label>
        </div>
      ) : (
        <div style={styles.fields}>
          <label style={{ ...styles.field, minWidth: 100 }}>
            <span style={styles.fieldLabel}>Unit</span>
            <input
              type="text"
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              placeholder="e.g. %, lbs, ng/dL"
              className="tracked-input"
              style={styles.input}
            />
          </label>
          <label style={{ ...styles.field, minWidth: 140 }}>
            <span style={styles.fieldLabel}>Cadence</span>
            <select
              value={cadence}
              onChange={(e) => setCadence(e.target.value)}
              className="tracked-input"
              style={styles.input}
            >
              <option value="weekly">weekly</option>
              <option value="monthly">monthly</option>
              <option value="quarterly">quarterly</option>
              <option value="per lab result">per lab result</option>
              <option value="daily (from wearable)">daily (from wearable)</option>
            </select>
          </label>
        </div>
      )}

      <div style={styles.iconSection}>
        <span style={styles.fieldLabel}>Icon</span>
        <div style={styles.iconGrid}>
          {ICON_CHOICES.map(e => (
            <button
              key={e}
              type="button"
              onClick={() => setIcon(e)}
              style={{
                ...styles.iconBtn,
                ...(icon === e ? styles.iconBtnActive : {}),
              }}
              aria-label={`Icon ${e}`}
              aria-pressed={icon === e}
            >
              {e}
            </button>
          ))}
        </div>
      </div>

      <div style={styles.actions}>
        <button type="button" className="btn btn-ghost" style={styles.ghostBtn} onClick={handleCancel}>
          Cancel
        </button>
        <button
          type="button"
          className="btn btn-primary"
          style={styles.saveBtn}
          onClick={handleSave}
          disabled={!name.trim()}
        >
          Track it
        </button>
      </div>
    </div>
  )
}

const styles = {
  trigger: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '10px 12px',
    marginTop: 10,
    borderRadius: 8,
    background: 'transparent',
    border: '1px dashed var(--b1)',
    color: 'var(--t2)',
    fontSize: 13.5,
    fontWeight: 500,
    letterSpacing: '-0.01em',
    width: '100%',
    cursor: 'pointer',
  },
  plus: {
    fontSize: 16,
    fontWeight: 600,
    color: 'var(--t3)',
    lineHeight: 1,
  },
  form: {
    marginTop: 10,
    padding: 14,
    borderRadius: 12,
    background: 'var(--s2)',
    border: '1px solid var(--b1)',
  },
  modeRow: {
    display: 'flex',
    gap: 6,
    padding: 4,
    borderRadius: 100,
    background: 'var(--s1)',
    marginBottom: 8,
  },
  modeBtn: {
    flex: 1,
    fontSize: 13,
    fontWeight: 500,
    padding: '8px 12px',
    borderRadius: 100,
    color: 'var(--t2)',
    background: 'transparent',
    letterSpacing: '-0.01em',
  },
  modeBtnActive: {
    background: 'var(--accent-subtle)',
    color: 'var(--accent)',
    fontWeight: 600,
  },
  modeHint: {
    fontSize: 11.5,
    color: 'var(--t3)',
    lineHeight: 1.5,
    marginBottom: 12,
  },
  fields: {
    display: 'flex',
    gap: 10,
    flexWrap: 'wrap',
    marginBottom: 10,
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    flex: 1,
  },
  fieldLabel: {
    fontSize: 11,
    color: 'var(--t3)',
    fontWeight: 500,
    letterSpacing: '0.02em',
    textTransform: 'uppercase',
  },
  input: {
    width: '100%',
    padding: '8px 10px',
    borderRadius: 8,
    fontSize: 14,
    background: 'var(--s1)',
    color: 'var(--t1)',
    border: '1px solid var(--b1)',
    letterSpacing: '-0.01em',
  },
  iconSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    marginBottom: 12,
  },
  iconGrid: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 6,
  },
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: 8,
    background: 'var(--s1)',
    border: '1px solid var(--b1)',
    fontSize: 18,
    lineHeight: 1,
    cursor: 'pointer',
  },
  iconBtnActive: {
    background: 'var(--accent-subtle)',
    borderColor: 'var(--accent)',
  },
  actions: {
    display: 'flex',
    gap: 8,
    justifyContent: 'flex-end',
  },
  ghostBtn: {
    fontSize: 13,
    padding: '6px 12px',
  },
  saveBtn: {
    fontSize: 13,
    padding: '6px 16px',
  },
}
