// Per-intervention checkboxes for today's stack.
// Defaults every active intervention to taken (true). User unchecks skips.
// "All ✓" toggle in the header toggles every item at once.

import { iconForType } from '../../lib/constants.js'

export default function StackChecklist({ interventions, log, onToggle, onToggleAll, quantities = {}, onQuantityChange, disabled = false }) {
  const active = interventions.filter(i => i.status !== 'stopped')
  const allChecked = active.length > 0 && active.every(i => log[i.id] !== false)

  return (
    <div>
      <div style={styles.header}>
        <span className="label-section">Your stack</span>
        <button
          type="button"
          onClick={() => onToggleAll && onToggleAll(!allChecked)}
          disabled={disabled || active.length === 0}
          style={{
            ...styles.allToggle,
            color: allChecked ? 'var(--accent)' : 'var(--t3)',
          }}
        >
          All {allChecked ? '✓' : ''}
        </button>
      </div>

      {active.length === 0 ? (
        <div style={styles.empty}>No active interventions yet.</div>
      ) : (
        <ul style={styles.list}>
          {active.map(item => {
            const taken = log[item.id] !== false // default to taken
            const qty = quantities[item.id]
            return (
              <li key={item.id} style={item.trackQuantity ? styles.itemWithQty : styles.item}>
                <button
                  type="button"
                  className="tracked-check"
                  data-checked={taken ? 'true' : 'false'}
                  aria-pressed={taken}
                  aria-label={`${item.name} taken`}
                  onClick={() => !disabled && onToggle && onToggle(item.id, !taken)}
                  disabled={disabled}
                />
                <span style={styles.itemIcon} aria-hidden="true">{iconForType(item.type)}</span>
                <span style={{
                  ...styles.itemName,
                  textDecoration: taken ? 'none' : 'line-through',
                  color: taken ? 'var(--t1)' : 'var(--t3)',
                }}>
                  {item.name}
                </span>
                {item.trackQuantity ? (
                  <div style={styles.stepper}>
                    <button
                      type="button"
                      style={styles.stepBtn}
                      disabled={disabled || (qty || 0) <= 0}
                      onClick={() => onQuantityChange && onQuantityChange(item.id, Math.max(0, (qty || 0) - 1))}
                      aria-label="Decrease"
                    >−</button>
                    <span className="mono" style={styles.stepValue}>
                      {qty ?? 0}
                    </span>
                    <button
                      type="button"
                      style={styles.stepBtn}
                      disabled={disabled}
                      onClick={() => onQuantityChange && onQuantityChange(item.id, (qty || 0) + 1)}
                      aria-label="Increase"
                    >+</button>
                    {item.quantityLabel && (
                      <span style={styles.stepUnit}>{item.quantityLabel}</span>
                    )}
                  </div>
                ) : item.dose ? (
                  <span className="mono" style={styles.itemDose}>{item.dose}</span>
                ) : null}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

const styles = {
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  allToggle: {
    fontSize: 13,
    fontWeight: 500,
    letterSpacing: '-0.01em',
    padding: '4px 10px',
    borderRadius: 100,
    background: 'transparent',
  },
  empty: {
    color: 'var(--t3)',
    fontSize: 14,
    padding: '12px 0',
  },
  list: {
    listStyle: 'none',
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  item: {
    display: 'grid',
    gridTemplateColumns: '20px 20px 1fr auto',
    alignItems: 'center',
    gap: 10,
    padding: '8px 0',
  },
  itemIcon: {
    fontSize: 16,
    lineHeight: 1,
  },
  itemName: {
    fontSize: 14.5,
    fontWeight: 500,
    letterSpacing: '-0.01em',
  },
  itemWithQty: {
    display: 'grid',
    gridTemplateColumns: '20px 20px 1fr auto',
    alignItems: 'center',
    gap: 10,
    padding: '6px 0',
  },
  itemDose: {
    fontSize: 13,
    color: 'var(--t3)',
    fontVariantNumeric: 'tabular-nums',
  },
  stepper: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
  },
  stepBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    border: '1px solid var(--b1)',
    background: 'var(--s2)',
    color: 'var(--t1)',
    fontSize: 16,
    fontWeight: 600,
    lineHeight: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    padding: 0,
  },
  stepValue: {
    minWidth: 28,
    textAlign: 'center',
    fontSize: 14,
    fontWeight: 600,
    fontVariantNumeric: 'tabular-nums',
    color: 'var(--t1)',
  },
  stepUnit: {
    fontSize: 12,
    color: 'var(--t3)',
    marginLeft: 2,
    fontWeight: 500,
  },
}
