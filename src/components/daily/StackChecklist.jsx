// Per-intervention checkboxes for today's stack.
// Defaults every active intervention to taken (true). User unchecks skips.
// "All ✓" toggle in the header toggles every item at once.

import { iconForType } from '../../lib/constants.js'

export default function StackChecklist({ interventions, log, onToggle, onToggleAll, disabled = false }) {
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
            return (
              <li key={item.id} style={styles.item}>
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
                {item.dose && (
                  <span className="mono" style={styles.itemDose}>{item.dose}</span>
                )}
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
  itemDose: {
    fontSize: 13,
    color: 'var(--t3)',
    fontVariantNumeric: 'tabular-nums',
  },
}
