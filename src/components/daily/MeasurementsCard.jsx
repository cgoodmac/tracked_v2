// Periodic measurements card. Shows one row per periodic metric with its
// most recent value + unit + cadence hint, plus an "Update" button that
// opens an inline form to log a new value.
//
// Only rendered when the user has at least one periodic metric configured.

import { useState } from 'react'

export default function MeasurementsCard({ metrics, measurements, onLog }) {
  const periodic = (metrics || []).filter(m => m.type === 'periodic')
  if (periodic.length === 0) return null

  return (
    <section>
      <div style={styles.header}>
        <span className="label-section">Measurements</span>
        <span style={styles.count}>{periodic.length}</span>
      </div>

      <ul style={styles.list}>
        {periodic.map(m => (
          <MeasurementRow
            key={m.id}
            metric={m}
            history={measurements?.[m.id] || []}
            onLog={onLog}
          />
        ))}
      </ul>
    </section>
  )
}

function MeasurementRow({ metric, history, onLog }) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState('')
  const [note, setNote] = useState('')

  const last = history[0] // already sorted newest-first
  const cadence = metric.cadence || '—'

  const handleSave = () => {
    if (!value) return
    onLog(metric.id, { value, note })
    setValue('')
    setNote('')
    setEditing(false)
  }

  const handleCancel = () => {
    setValue('')
    setNote('')
    setEditing(false)
  }

  return (
    <li style={styles.row}>
      <div style={styles.rowTop}>
        <span style={{ ...styles.swatch, background: metric.color }} aria-hidden="true" />
        <span style={styles.icon} aria-hidden="true">{metric.icon}</span>
        <span style={styles.label}>{metric.label}</span>
        <span style={styles.meta}>
          {last
            ? <><span className="mono">{last.value}</span>{metric.unit ? ` ${metric.unit}` : ''} · {last.date}</>
            : <em style={styles.empty}>no data yet</em>
          }
        </span>
        {!editing && (
          <button
            type="button"
            className="btn btn-ghost"
            style={styles.updateBtn}
            onClick={() => setEditing(true)}
          >
            Update
          </button>
        )}
      </div>

      {editing && (
        <div style={styles.form}>
          <div style={styles.formFields}>
            <label style={styles.field}>
              <span style={styles.fieldLabel}>Value</span>
              <div style={styles.inputWithUnit}>
                <input
                  type="number"
                  inputMode="decimal"
                  step="any"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  autoFocus
                  className="tracked-input"
                  style={styles.input}
                />
                {metric.unit && <span style={styles.unitSuffix}>{metric.unit}</span>}
              </div>
            </label>
            <label style={{ ...styles.field, flex: 2 }}>
              <span style={styles.fieldLabel}>Note (optional)</span>
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={`e.g. from ${metric.cadence || 'lab result'}`}
                className="tracked-input"
                style={styles.input}
              />
            </label>
          </div>
          <div style={styles.formActions}>
            <button type="button" className="btn btn-ghost" style={styles.ghostBtn} onClick={handleCancel}>
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary"
              style={styles.saveBtn}
              onClick={handleSave}
              disabled={!value}
            >
              Save
            </button>
          </div>
          <div style={styles.hint}>
            Typically measured {cadence.toLowerCase()}.
            {history.length > 0 && ` Last value: ${last.value}${metric.unit ? ' ' + metric.unit : ''} on ${last.date}.`}
          </div>
        </div>
      )}
    </li>
  )
}

const styles = {
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  count: {
    marginLeft: 'auto',
    fontSize: 12,
    color: 'var(--t3)',
    fontFamily: 'var(--font-mono)',
    fontVariantNumeric: 'tabular-nums',
  },
  list: {
    listStyle: 'none',
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    padding: 4,
    borderRadius: 12,
    background: 'var(--s2)',
  },
  row: {
    padding: '10px 12px',
    borderRadius: 8,
  },
  rowTop: {
    display: 'grid',
    gridTemplateColumns: '6px 22px 1fr auto auto',
    alignItems: 'center',
    gap: 10,
  },
  swatch: {
    width: 6,
    height: 22,
    borderRadius: 3,
  },
  icon: { fontSize: 14, textAlign: 'center' },
  label: {
    fontSize: 14,
    fontWeight: 500,
    color: 'var(--t1)',
    letterSpacing: '-0.01em',
  },
  meta: {
    fontSize: 12.5,
    color: 'var(--t3)',
    fontVariantNumeric: 'tabular-nums',
  },
  empty: {
    fontStyle: 'italic',
  },
  updateBtn: {
    fontSize: 12,
    padding: '4px 10px',
    color: 'var(--t2)',
  },
  form: {
    marginTop: 10,
    paddingTop: 10,
    borderTop: '1px solid var(--b1)',
  },
  formFields: {
    display: 'flex',
    gap: 10,
    flexWrap: 'wrap',
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    flex: 1,
    minWidth: 120,
  },
  fieldLabel: {
    fontSize: 11,
    color: 'var(--t3)',
    fontWeight: 500,
    letterSpacing: '0.02em',
    textTransform: 'uppercase',
  },
  inputWithUnit: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
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
  unitSuffix: {
    position: 'absolute',
    right: 10,
    fontSize: 12,
    color: 'var(--t3)',
    fontFamily: 'var(--font-mono)',
    pointerEvents: 'none',
  },
  formActions: {
    display: 'flex',
    gap: 8,
    justifyContent: 'flex-end',
    marginTop: 10,
  },
  ghostBtn: {
    fontSize: 13,
    padding: '6px 12px',
  },
  saveBtn: {
    fontSize: 13,
    padding: '6px 16px',
  },
  hint: {
    marginTop: 8,
    fontSize: 11.5,
    color: 'var(--t3)',
    lineHeight: 1.5,
  },
}
