// Step 5 — Stack confirmation. The AI's parsed stack rendered as a
// checklist. Tap to include/exclude each item. Active items start checked,
// stopped items start unchecked with a "STOPPED" badge. Start dates render
// in teal and tap to edit.

import { useMemo, useState } from 'react'
import { iconForType } from '../../lib/constants.js'
import { OnboardingPage, BackRow, StepLabel, DateChip } from './ui.jsx'

export default function StackConfirm({ items, onBack, onContinue }) {
  // Each item in `items` came from the AI. We track two things per item:
  // `included` (whether it ends up in the final stack) and an editable
  // `startDate` that can be changed inline before continuing.
  const [state, setState] = useState(() =>
    items.map(it => ({
      ...it,
      included: it.status !== 'stopped', // stopped items unchecked by default
    }))
  )

  const includedCount = useMemo(
    () => state.filter(it => it.included).length,
    [state]
  )

  const toggle = (i) => {
    setState(prev => prev.map((it, idx) => (idx === i ? { ...it, included: !it.included } : it)))
  }

  const setDate = (i, value) => {
    setState(prev => prev.map((it, idx) => (idx === i ? { ...it, startDate: value } : it)))
  }

  const handleContinue = () => {
    const final = state.filter(it => it.included).map(({ included, ...rest }) => rest)
    onContinue(final)
  }

  const label = includedCount === 0
    ? 'Skip for now'
    : `Add ${includedCount} item${includedCount === 1 ? '' : 's'} and continue`

  return (
    <OnboardingPage
      footer={
        <button
          type="button"
          className="btn btn-primary btn-block"
          onClick={handleContinue}
        >
          {label}
        </button>
      }
    >
      <BackRow onBack={onBack} />

      <div>
        <StepLabel>Your stack</StepLabel>
        <div style={styles.countRow}>
          <span className="mono" style={styles.countNum}>{items.length}</span>
          <span style={styles.countWord}>
            {items.length === 1 ? 'item found' : 'items found'}
          </span>
        </div>
        <p style={styles.sub}>Tap to include or exclude. Go back to re-enter.</p>
      </div>

      <ul style={styles.list}>
        {state.map((item, i) => {
          const secondary = [item.dose, item.frequency].filter(Boolean).join(' · ')
          return (
            <li key={`${item.name}-${i}`} style={styles.item}>
              <button
                type="button"
                className="tracked-check"
                data-checked={item.included ? 'true' : 'false'}
                aria-pressed={item.included}
                aria-label={`Include ${item.name}`}
                onClick={() => toggle(i)}
              />
              <span style={styles.icon} aria-hidden="true">{iconForType(item.type)}</span>
              <div style={styles.body}>
                <div style={styles.rowTop}>
                  <span style={{
                    ...styles.name,
                    textDecoration: item.included ? 'none' : 'line-through',
                    color: item.included ? 'var(--t1)' : 'var(--t3)',
                  }}>
                    {item.name}
                  </span>
                  {item.status === 'stopped' && (
                    <span style={styles.stoppedBadge}>STOPPED</span>
                  )}
                </div>
                <div style={styles.meta}>
                  {secondary && (
                    <span className="mono" style={styles.metaText}>{secondary}</span>
                  )}
                  {secondary && <span style={styles.sep}>·</span>}
                  <DateChip
                    value={item.startDate}
                    onChange={(v) => setDate(i, v)}
                  />
                  {item.notes && (
                    <>
                      <span style={styles.sep}>·</span>
                      <span style={styles.notes}>{item.notes}</span>
                    </>
                  )}
                </div>
              </div>
            </li>
          )
        })}
      </ul>
    </OnboardingPage>
  )
}

const styles = {
  countRow: {
    display: 'flex',
    alignItems: 'baseline',
    gap: 8,
    marginTop: 8,
  },
  countNum: {
    fontSize: 28,
    fontWeight: 600,
    letterSpacing: '-0.02em',
    color: 'var(--t1)',
  },
  countWord: {
    fontSize: 15,
    color: 'var(--t2)',
    letterSpacing: '-0.01em',
  },
  sub: {
    fontSize: 14,
    color: 'var(--t2)',
    lineHeight: 1.45,
    marginTop: 6,
  },
  list: {
    listStyle: 'none',
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  item: {
    display: 'grid',
    gridTemplateColumns: '20px 22px 1fr',
    alignItems: 'start',
    gap: 10,
    padding: '10px 0',
    borderBottom: '1px solid var(--b1)',
  },
  icon: {
    fontSize: 16,
    lineHeight: 1.4,
    marginTop: 1,
  },
  body: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    minWidth: 0,
  },
  rowTop: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  name: {
    fontSize: 14.5,
    fontWeight: 500,
    letterSpacing: '-0.01em',
  },
  stoppedBadge: {
    fontSize: 10,
    fontWeight: 600,
    letterSpacing: '0.08em',
    padding: '2px 6px',
    borderRadius: 4,
    background: 'var(--s2)',
    color: 'var(--t3)',
  },
  meta: {
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    fontSize: 12.5,
  },
  metaText: {
    color: 'var(--t3)',
    fontVariantNumeric: 'tabular-nums',
  },
  sep: {
    color: 'var(--t3)',
    opacity: 0.6,
  },
  notes: {
    color: 'var(--t3)',
    fontSize: 12.5,
    fontStyle: 'italic',
  },
}
