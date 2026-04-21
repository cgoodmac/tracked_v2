// Shared UI primitives used across the onboarding wizard.
// Each step is a separate component; these are the small pieces they share.

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useVoiceInput } from '../../hooks/useVoiceInput.js'

// ---------- Page shell ----------
// Every onboarding step uses this so layout, padding, and safe-area insets
// are consistent. The wizard owns the back button and any step label.
export function OnboardingPage({ children, footer }) {
  return (
    <div style={pageStyles.root}>
      <div style={pageStyles.content}>{children}</div>
      {footer && <div style={pageStyles.footer}>{footer}</div>}
    </div>
  )
}

const pageStyles = {
  root: {
    minHeight: '100vh',
    maxWidth: 480,
    margin: '0 auto',
    display: 'flex',
    flexDirection: 'column',
    padding: 'calc(env(safe-area-inset-top) + 16px) 20px calc(env(safe-area-inset-bottom) + 20px)',
  },
  content: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: 20,
    paddingBottom: 20,
  },
  footer: {
    paddingTop: 8,
  },
}

// ---------- Top row: back button ----------
export function BackRow({ onBack, show = true }) {
  if (!show) return <div style={{ height: 40 }} />
  return (
    <div style={backStyles.row}>
      <button
        type="button"
        onClick={onBack}
        style={backStyles.btn}
        aria-label="Go back"
      >
        <span style={backStyles.chevron}>‹</span>
        <span>Back</span>
      </button>
    </div>
  )
}

const backStyles = {
  row: {
    display: 'flex',
    alignItems: 'center',
    height: 40,
  },
  btn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    color: 'var(--t2)',
    fontSize: 14,
    fontWeight: 500,
    letterSpacing: '-0.01em',
    padding: '6px 8px 6px 0',
  },
  chevron: {
    fontSize: 22,
    lineHeight: 1,
    fontWeight: 400,
    marginTop: -2,
  },
}

// ---------- Step label ----------
export function StepLabel({ children }) {
  return <div className="label-section">{children}</div>
}

// ---------- Heading + subheading ----------
export function StepHeading({ title, subtitle }) {
  return (
    <div style={headingStyles.wrap}>
      <h1 style={headingStyles.title}>{title}</h1>
      {subtitle && <p style={headingStyles.sub}>{subtitle}</p>}
    </div>
  )
}

const headingStyles = {
  wrap: { display: 'flex', flexDirection: 'column', gap: 8 },
  title: {
    fontSize: 26,
    lineHeight: 1.2,
    letterSpacing: '-0.02em',
    fontWeight: 600,
    color: 'var(--t1)',
  },
  sub: {
    fontSize: 15,
    lineHeight: 1.45,
    color: 'var(--t2)',
    fontWeight: 400,
    letterSpacing: '-0.01em',
  },
}

// ---------- Suggestion chips ----------
// Tap a chip to pre-fill the input. No auto-send — the user still hits send.
export function SuggestionChips({ suggestions, onPick }) {
  if (!suggestions || suggestions.length === 0) return null
  return (
    <div style={chipsStyles.wrap}>
      {suggestions.map((s, i) => (
        <button
          key={i}
          type="button"
          onClick={() => onPick(s)}
          className="pill"
          style={chipsStyles.chip}
        >
          {s}
        </button>
      ))}
    </div>
  )
}

const chipsStyles = {
  wrap: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: 8,
  },
  chip: {
    textAlign: 'left',
    padding: '12px 14px',
    borderRadius: 12,
    fontSize: 14,
    background: 'var(--s2)',
    color: 'var(--t2)',
    width: '100%',
    whiteSpace: 'normal',
    lineHeight: 1.35,
    border: '1px solid transparent',
  },
}

// ---------- Text + mic input bar ----------
// For onboarding we use a slightly larger multi-line input because users may
// paste long documents here. Mic fills the field; user hits Send to submit.
export function TextMicBar({ value, onChange, onSend, busy = false, placeholder, autoFocus = false }) {
  const { supported, listening, start, stop, transcript, error } = useVoiceInput()
  const inputRef = useRef(null)

  useEffect(() => {
    if (transcript) onChange(transcript)
  }, [transcript, onChange])

  useEffect(() => {
    if (autoFocus && inputRef.current) inputRef.current.focus()
  }, [autoFocus])

  // Auto-grow the textarea to fit its content. We reset height to 'auto' first
  // so scrollHeight shrinks when the user deletes text; then we clamp to the
  // maxHeight defined in CSS so very long pastes scroll instead of taking over
  // the screen.
  useLayoutEffect(() => {
    const el = inputRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [value])

  const handleSend = () => {
    const v = (value || '').trim()
    if (!v || busy) return
    onSend(v)
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.metaKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const canSend = (value || '').trim().length > 0 && !busy

  return (
    <div>
      <div style={{
        ...barStyles.wrap,
        borderColor: listening ? 'var(--accent)' : 'var(--b1)',
        background: listening ? 'var(--accent-subtle)' : 'var(--s2)',
      }}>
        <textarea
          ref={inputRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={listening ? 'Listening…' : placeholder}
          rows={1}
          style={barStyles.input}
          aria-label={placeholder}
        />
        <div style={barStyles.btnRow}>
          {supported && (
            <button
              type="button"
              onClick={listening ? stop : start}
              style={{
                ...barStyles.micBtn,
                color: listening ? 'var(--accent)' : 'var(--t2)',
                animation: listening ? 'pulse-dot 1.2s ease-in-out infinite' : 'none',
              }}
              aria-label={listening ? 'Stop listening' : 'Start voice input'}
            >
              🎤
            </button>
          )}
          <button
            type="button"
            onClick={handleSend}
            disabled={!canSend}
            style={{
              ...barStyles.sendBtn,
              background: canSend ? 'var(--accent)' : 'var(--b1)',
              color: canSend ? 'var(--bg)' : 'var(--t3)',
              cursor: canSend ? 'pointer' : 'not-allowed',
            }}
            aria-label="Send"
          >
            {busy ? '…' : '↑'}
          </button>
        </div>
      </div>
      {error && <div style={barStyles.error}>
        {error === 'not-allowed'
          ? 'Microphone access was denied. Enable it in your browser settings.'
          : error === 'no-speech'
            ? "Didn't catch that — tap the mic and try again."
            : `Voice error: ${error}`}
      </div>}
    </div>
  )
}

const barStyles = {
  wrap: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    padding: 12,
    border: '1px solid var(--b1)',
    borderRadius: 16,
    transition: 'background 150ms ease, border-color 150ms ease',
  },
  input: {
    width: '100%',
    minHeight: 44,
    // Cap growth so very long pastes don't push the send button off-screen.
    // JS in TextMicBar sets height to scrollHeight on every change; the cap
    // here makes the browser take over with a scrollbar past this point.
    maxHeight: '50vh',
    resize: 'none',
    overflowY: 'auto',
    background: 'transparent',
    color: 'var(--t1)',
    fontSize: 15,
    letterSpacing: '-0.01em',
    lineHeight: 1.45,
    fontFamily: 'var(--font-sans)',
    border: 'none',
    outline: 'none',
    padding: 0,
  },
  btnRow: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: 8,
  },
  micBtn: {
    width: 36,
    height: 36,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '50%',
    fontSize: 16,
  },
  sendBtn: {
    width: 36,
    height: 36,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '50%',
    fontSize: 16,
    fontWeight: 600,
    transition: 'background 120ms ease, color 120ms ease',
  },
  error: {
    marginTop: 8,
    fontSize: 12.5,
    color: 'var(--t3)',
    paddingLeft: 4,
  },
}

// ---------- Inline loading indicator ----------
export function Thinking({ label = 'Thinking…' }) {
  return (
    <div style={thinkStyles.wrap}>
      <span style={thinkStyles.dot} />
      <span>{label}</span>
    </div>
  )
}

const thinkStyles = {
  wrap: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    fontSize: 13,
    color: 'var(--t3)',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: '50%',
    background: 'var(--accent)',
    animation: 'pulse-dot 1.1s ease-in-out infinite',
  },
}

// ---------- Editable date chip ----------
// Used in the stack confirmation step. Displays a start date in teal;
// tapping reveals a native date input so the user can change it.
export function DateChip({ value, onChange }) {
  const [editing, setEditing] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (editing && ref.current) {
      ref.current.focus()
      ref.current.showPicker?.()
    }
  }, [editing])

  if (editing) {
    return (
      <input
        ref={ref}
        type="date"
        value={value || ''}
        onChange={(e) => {
          onChange(e.target.value || null)
        }}
        onBlur={() => setEditing(false)}
        style={dateStyles.input}
      />
    )
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className="mono"
      style={dateStyles.btn}
    >
      {value ? formatShortDate(value) : 'add start date'}
    </button>
  )
}

function formatShortDate(iso) {
  const d = new Date(iso + 'T00:00:00')
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

const dateStyles = {
  btn: {
    color: 'var(--m-anxiety)', // teal — matches Calm metric color
    fontSize: 12.5,
    fontWeight: 500,
    padding: 0,
    letterSpacing: '-0.005em',
  },
  input: {
    color: 'var(--m-anxiety)',
    fontSize: 12.5,
    fontFamily: 'var(--font-mono)',
    background: 'transparent',
    border: 'none',
    padding: 0,
  },
}
