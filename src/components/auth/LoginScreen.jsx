// Magic-link login. User types their email, we ask Supabase to send them a
// link, and the link signs them in on whatever device they tap it on.
// Designed to match the Welcome screen visually so the auth feels native.

import { useState } from 'react'
import { supabase, isSupabaseConfigured } from '../../lib/supabase.js'

export default function LoginScreen() {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState('idle') // idle | sending | sent | error
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!isSupabaseConfigured) {
      setStatus('error')
      setError('Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY to .env.local and rebuild.')
      return
    }
    const trimmed = email.trim()
    if (!trimmed || !trimmed.includes('@')) {
      setStatus('error')
      setError('Enter a valid email address.')
      return
    }
    setStatus('sending')
    setError('')
    const { error: err } = await supabase.auth.signInWithOtp({
      email: trimmed,
      options: {
        // Where Supabase sends the user after they click the link.
        // window.location.origin works in dev (localhost:5173) and prod (Vercel).
        emailRedirectTo: window.location.origin,
      },
    })
    if (err) {
      setStatus('error')
      setError(err.message || 'Could not send login link.')
      return
    }
    setStatus('sent')
  }

  return (
    <div style={styles.root}>
      <div style={styles.brand}>TRACKED</div>

      <div style={styles.center}>
        {status === 'sent' ? (
          <SentState email={email} onTryAgain={() => { setStatus('idle'); setEmail('') }} />
        ) : (
          <>
            <h1 style={styles.h1}>
              Sign in to<br />sync across devices.
            </h1>
            <p style={styles.tag}>
              We'll email you a link. No password to remember.
            </p>

            <form onSubmit={handleSubmit} style={styles.form}>
              <input
                type="email"
                inputMode="email"
                autoComplete="email"
                autoCapitalize="none"
                autoCorrect="off"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={status === 'sending'}
                style={styles.input}
                required
              />
              {error && <div style={styles.error}>{error}</div>}
              <button
                type="submit"
                className="btn btn-primary btn-block"
                disabled={status === 'sending' || !email.trim()}
              >
                {status === 'sending' ? 'Sending…' : 'Email me a link'}
              </button>
            </form>
          </>
        )}
      </div>

      <div style={styles.footer}>
        Your data is private and tied to your account.
      </div>
    </div>
  )
}

function SentState({ email, onTryAgain }) {
  return (
    <>
      <h1 style={styles.h1}>
        Check your inbox.
      </h1>
      <p style={styles.tag}>
        We sent a sign-in link to <strong style={{ color: 'var(--t1)' }}>{email}</strong>.
        Open it on this device to finish signing in.
      </p>
      <button
        type="button"
        className="btn btn-secondary btn-block"
        onClick={onTryAgain}
        style={{ marginTop: 12 }}
      >
        Use a different email
      </button>
    </>
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
  form: {
    marginTop: 12,
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  input: {
    width: '100%',
    padding: '14px 16px',
    fontSize: 16,
    background: 'var(--s2)',
    border: '1px solid var(--b1)',
    borderRadius: 'var(--radius-md)',
    color: 'var(--t1)',
    outline: 'none',
    fontFamily: 'var(--font-sans)',
  },
  error: {
    fontSize: 13,
    color: '#B42318',
    lineHeight: 1.4,
  },
  footer: {
    fontSize: 12,
    color: 'var(--t3)',
    textAlign: 'center',
  },
}
