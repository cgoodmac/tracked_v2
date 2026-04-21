// Step 1 — Welcome screen. Full-screen, vertically centered.
// No back button (this is the entry point).

export default function Welcome({ onNext }) {
  return (
    <div style={styles.root}>
      <div style={styles.brand}>TRACKED</div>

      <div style={styles.center}>
        <h1 style={styles.h1}>
          Just tell me<br />what you take<br />and how you feel.
        </h1>
        <p style={styles.tag}>I'll figure out what's actually working.</p>
      </div>

      <div>
        <button
          type="button"
          className="btn btn-primary btn-block"
          onClick={onNext}
        >
          Get started
        </button>
      </div>
    </div>
  )
}

const styles = {
  root: {
    minHeight: '100vh',
    maxWidth: 480,
    margin: '0 auto',
    display: 'flex',
    flexDirection: 'column',
    padding: 'calc(env(safe-area-inset-top) + 32px) 24px calc(env(safe-area-inset-bottom) + 24px)',
  },
  brand: {
    fontSize: 13,
    fontWeight: 600,
    letterSpacing: '0.12em',
    color: 'var(--t3)',
  },
  center: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    gap: 20,
  },
  h1: {
    fontSize: 32,
    lineHeight: 1.15,
    letterSpacing: '-0.03em',
    fontWeight: 600,
  },
  tag: {
    fontSize: 16,
    color: 'var(--t2)',
    lineHeight: 1.5,
    letterSpacing: '-0.01em',
  },
}
