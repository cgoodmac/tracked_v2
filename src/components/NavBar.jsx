// Fixed bottom nav. Two items: Today (check-in) and Insights.
// Insights is stubbed in this milestone — it's wired up but the screen itself
// is a placeholder until we build it in the next phase.

export default function NavBar({ current, onChange }) {
  return (
    <nav style={styles.nav}>
      <div style={styles.inner}>
        <Tab id="today"    label="Today"    icon="○" current={current} onChange={onChange} />
        <Tab id="goals"   label="Goals"    icon="◎" current={current} onChange={onChange} />
        <Tab id="insights" label="Insights" icon="◐" current={current} onChange={onChange} />
      </div>
    </nav>
  )
}

function Tab({ id, label, icon, current, onChange }) {
  const active = current === id
  return (
    <button
      type="button"
      onClick={() => onChange(id)}
      style={{
        ...styles.tab,
        color: active ? 'var(--accent)' : 'var(--t3)',
      }}
      aria-current={active ? 'page' : undefined}
    >
      <span style={styles.icon} aria-hidden="true">{icon}</span>
      <span style={styles.label}>{label}</span>
    </button>
  )
}

const styles = {
  nav: {
    position: 'fixed',
    left: 0,
    right: 0,
    bottom: 0,
    background: 'var(--blur, var(--bg))',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    borderTop: '1px solid var(--b1)',
    paddingBottom: 'env(safe-area-inset-bottom)',
    zIndex: 20,
  },
  inner: {
    maxWidth: 480,
    margin: '0 auto',
    display: 'grid',
    gridTemplateColumns: '1fr 1fr 1fr',
    padding: '6px 8px',
  },
  tab: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 2,
    padding: '10px 0',
    borderRadius: 10,
    transition: 'color 120ms ease',
  },
  icon: { fontSize: 16, lineHeight: 1 },
  label: {
    fontSize: 11,
    fontWeight: 500,
    letterSpacing: '-0.005em',
  },
}
