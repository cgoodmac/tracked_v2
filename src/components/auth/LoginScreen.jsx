// Email OTP login. User types their email, we send a 6-digit code, and
// they enter it right here in the app. No redirect needed — works perfectly
// inside a PWA on the home screen.

import { useRef, useState } from 'react'
import { supabase, isSupabaseConfigured } from '../../lib/supabase.js'

export default function LoginScreen() {
  const [email, setEmail] = useState('')
  const [pin, setPin] = useState(['', '', '', '', '', '', '', ''])
  const [status, setStatus] = useState('idle') // idle | sending | sent | verifying | error
  const [error, setError] = useState('')
  const pinRefs = useRef([])

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
    })
    if (err) {
      setStatus('error')
      setError(err.message || 'Could not send code.')
      return
    }
    setStatus('sent')
    // Focus the first PIN input after a tick
    setTimeout(() => pinRefs.current[0]?.focus(), 50)
  }

  const handlePinChange = (index, value) => {
    // Only accept digits
    const digit = value.replace(/\D/g, '').slice(-1)
    const next = [...pin]
    next[index] = digit
    setPin(next)
    setError('')

    // Auto-advance to next input
    if (digit && index < 7) {
      pinRefs.current[index + 1]?.focus()
    }

    // Auto-submit when all 6 digits are filled
    if (digit && index === 7 && next.every(d => d)) {
      verifyPin(next.join(''))
    }
  }

  const handlePinKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !pin[index] && index > 0) {
      pinRefs.current[index - 1]?.focus()
    }
  }

  const handlePinPaste = (e) => {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 8)
    if (pasted.length === 8) {
      e.preventDefault()
      const next = pasted.split('')
      setPin(next)
      pinRefs.current[7]?.focus()
      verifyPin(pasted)
    }
  }

  const verifyPin = async (code) => {
    setStatus('verifying')
    setError('')
    const { error: err } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token: code,
      type: 'email',
    })
    if (err) {
      setStatus('sent')
      setPin(['', '', '', '', '', '', '', ''])
      setError(err.message || 'Invalid code. Try again.')
      setTimeout(() => pinRefs.current[0]?.focus(), 50)
    }
    // On success, Supabase fires onAuthStateChange and useAppState picks it up
  }

  return (
    <div style={styles.root}>
      <div style={styles.brand}>TRACKED</div>

      <div style={styles.center}>
        {status === 'sent' || status === 'verifying' ? (
          <VerifyState
            email={email}
            pin={pin}
            pinRefs={pinRefs}
            error={error}
            verifying={status === 'verifying'}
            onPinChange={handlePinChange}
            onPinKeyDown={handlePinKeyDown}
            onPinPaste={handlePinPaste}
            onTryAgain={() => { setStatus('idle'); setEmail(''); setPin(['', '', '', '', '', '', '', '']); setError('') }}
            onResend={handleSubmit}
          />
        ) : (
          <>
            <h1 style={styles.h1}>
              Sign in to<br />sync across devices.
            </h1>
            <p style={styles.tag}>
              We'll email you a code. No password to remember.
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
                {status === 'sending' ? 'Sending…' : 'Send me a code'}
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

function VerifyState({ email, pin, pinRefs, error, verifying, onPinChange, onPinKeyDown, onPinPaste, onTryAgain, onResend }) {
  return (
    <>
      <h1 style={styles.h1}>
        Enter your code.
      </h1>
      <p style={styles.tag}>
        We sent a code to <strong style={{ color: 'var(--t1)' }}>{email}</strong>.
      </p>

      <div style={styles.pinRow} onPaste={onPinPaste}>
        {pin.map((digit, i) => (
          <input
            key={i}
            ref={el => pinRefs.current[i] = el}
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={1}
            value={digit}
            onChange={(e) => onPinChange(i, e.target.value)}
            onKeyDown={(e) => onPinKeyDown(i, e)}
            disabled={verifying}
            style={styles.pinInput}
          />
        ))}
      </div>

      {error && <div style={styles.error}>{error}</div>}
      {verifying && <div style={{ fontSize: 14, color: 'var(--t2)' }}>Verifying…</div>}

      <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={onResend}
          disabled={verifying}
          style={{ flex: 1, fontSize: 14, padding: '12px 16px' }}
        >
          Resend code
        </button>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={onTryAgain}
          disabled={verifying}
          style={{ flex: 1, fontSize: 14, padding: '12px 16px', color: 'var(--t2)' }}
        >
          Different email
        </button>
      </div>
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
  pinRow: {
    display: 'flex',
    gap: 8,
    justifyContent: 'center',
    marginTop: 8,
  },
  pinInput: {
    width: 38,
    height: 48,
    fontSize: 20,
    fontWeight: 600,
    textAlign: 'center',
    background: 'var(--s2)',
    border: '1px solid var(--b1)',
    borderRadius: 'var(--radius-md)',
    color: 'var(--t1)',
    outline: 'none',
    fontFamily: 'var(--font-sans)',
    caretColor: 'var(--t1)',
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
