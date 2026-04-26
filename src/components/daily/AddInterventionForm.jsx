// Inline "+ Add to stack" row that expands into a small form on click.
// Emits the finished intervention via onAdd; parent handles state + marking
// the new item as taken for today.

import { useState } from 'react'
import { INTERVENTION_TYPES, TYPE_BY_KEY } from '../../lib/constants.js'

const FREQUENCIES = ['Daily', '2x daily', '3x daily', 'Weekly', 'As needed']

export default function AddInterventionForm({ onAdd }) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [type, setType] = useState('supplement')
  const [dose, setDose] = useState('')
  const [frequency, setFrequency] = useState('Daily')
  const [trackQuantity, setTrackQuantity] = useState(false)
  const [quantityLabel, setQuantityLabel] = useState('')

  const reset = () => {
    setName('')
    setType('supplement')
    setDose('')
    setFrequency('Daily')
    setTrackQuantity(false)
    setQuantityLabel('')
  }

  const handleCancel = () => {
    reset()
    setOpen(false)
  }

  const handleSave = () => {
    const trimmed = name.trim()
    if (!trimmed) return
    onAdd({
      name: trimmed, type, dose: dose.trim() || null, frequency,
      trackQuantity: trackQuantity || false,
      quantityLabel: trackQuantity && quantityLabel.trim() ? quantityLabel.trim() : null,
    })
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
        <span>Add to stack</span>
      </button>
    )
  }

  const typeMeta = TYPE_BY_KEY[type]
  const showSecond = typeMeta?.secondField === 'dose' || typeMeta?.secondField === 'duration'

  return (
    <div style={styles.form}>
      <div style={styles.fields}>
        <label style={{ ...styles.field, flex: 2, minWidth: 160 }}>
          <span style={styles.fieldLabel}>Name</span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Magnesium Glycinate"
            autoFocus
            className="tracked-input"
            style={styles.input}
          />
        </label>

        <label style={{ ...styles.field, minWidth: 130 }}>
          <span style={styles.fieldLabel}>Type</span>
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="tracked-input"
            style={styles.input}
          >
            {INTERVENTION_TYPES.map(t => (
              <option key={t.key} value={t.key}>
                {t.icon} {t.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div style={styles.fields}>
        {showSecond && (
          <label style={{ ...styles.field, minWidth: 120 }}>
            <span style={styles.fieldLabel}>
              {typeMeta.secondField === 'duration' ? 'Duration' : 'Dose'}
            </span>
            <input
              type="text"
              value={dose}
              onChange={(e) => setDose(e.target.value)}
              placeholder={typeMeta.secondPlaceholder || ''}
              className="tracked-input"
              style={styles.input}
            />
          </label>
        )}

        <label style={{ ...styles.field, minWidth: 140 }}>
          <span style={styles.fieldLabel}>Frequency</span>
          <select
            value={frequency}
            onChange={(e) => setFrequency(e.target.value)}
            className="tracked-input"
            style={styles.input}
          >
            {FREQUENCIES.map(f => (
              <option key={f} value={f}>{f}</option>
            ))}
          </select>
        </label>
      </div>

      <div style={styles.quantityRow}>
        <label style={styles.quantityToggle}>
          <input
            type="checkbox"
            checked={trackQuantity}
            onChange={(e) => setTrackQuantity(e.target.checked)}
            style={{ accentColor: 'var(--accent)' }}
          />
          <span style={styles.quantityToggleLabel}>Track quantity</span>
        </label>
        {trackQuantity && (
          <input
            type="text"
            value={quantityLabel}
            onChange={(e) => setQuantityLabel(e.target.value)}
            placeholder="unit (e.g. drinks, mg)"
            className="tracked-input"
            style={{ ...styles.input, flex: 1, maxWidth: 180 }}
          />
        )}
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
          Add
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
    marginTop: 6,
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
    marginTop: 6,
    padding: 14,
    borderRadius: 12,
    background: 'var(--s2)',
    border: '1px solid var(--b1)',
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
  quantityRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  quantityToggle: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  quantityToggleLabel: {
    fontSize: 13,
    color: 'var(--t2)',
    fontWeight: 500,
  },
}
