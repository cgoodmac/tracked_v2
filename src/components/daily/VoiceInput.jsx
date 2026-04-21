// The "lazy mode" shortcut that sits at the top of the check-in screen.
// User types or taps the mic and speaks. On send, the parent component sends
// the transcript to the AI; the AI returns actions that update sliders and
// checkboxes. The user then visually reviews and taps "Log day" to save.
//
// Voice is supplied via useVoiceInput — transcripts fill the text field for
// review/edit. No auto-send: the user still has to hit Send.

import { useEffect, useRef, useState } from 'react'
import { useVoiceInput } from '../../hooks/useVoiceInput.js'

const PLACEHOLDER = '"Took everything except fish oil, felt anxious…"'

export default function VoiceInput({ onSend, busy = false, disabled = false }) {
  const [text, setText] = useState('')
  const { supported, listening, start, stop, transcript, error } = useVoiceInput()
  const inputRef = useRef(null)

  // When a transcript comes in from the mic, push it into the text field.
  useEffect(() => {
    if (transcript) setText(transcript)
  }, [transcript])

  const handleSend = () => {
    const value = text.trim()
    if (!value || busy || disabled) return
    onSend(value)
    setText('')
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const canSend = text.trim().length > 0 && !busy && !disabled

  return (
    <div>
      <div
        style={{
          ...styles.bar,
          borderColor: listening ? 'var(--accent)' : 'var(--b1)',
          background: listening ? 'var(--accent-subtle)' : 'var(--s2)',
        }}
      >
        <span style={styles.leftIcon} aria-hidden="true">💬</span>

        <input
          ref={inputRef}
          type="text"
          value={text}
          placeholder={listening ? 'Listening…' : PLACEHOLDER}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          style={styles.input}
          aria-label="Describe how you feel and what you took"
        />

        {supported && (
          <button
            type="button"
            onClick={listening ? stop : start}
            disabled={disabled || busy}
            style={{
              ...styles.micBtn,
              color: listening ? 'var(--accent)' : 'var(--t2)',
              animation: listening ? 'pulse-dot 1.2s ease-in-out infinite' : 'none',
            }}
            aria-label={listening ? 'Stop listening' : 'Start voice input'}
            title={listening ? 'Stop listening' : 'Tap to speak'}
          >
            🎤
          </button>
        )}

        <button
          type="button"
          onClick={handleSend}
          disabled={!canSend}
          style={{
            ...styles.sendBtn,
            background: canSend ? 'var(--accent)' : 'var(--b1)',
            color: canSend ? 'var(--bg)' : 'var(--t3)',
            cursor: canSend ? 'pointer' : 'not-allowed',
          }}
          aria-label="Send to AI"
          title="Send"
        >
          {busy ? '…' : '↑'}
        </button>
      </div>

      {error && (
        <div style={styles.error}>
          {error === 'not-allowed'
            ? 'Microphone access was denied. Enable it in your browser settings.'
            : error === 'no-speech'
              ? "Didn't catch that — tap the mic and try again."
              : `Voice error: ${error}`}
        </div>
      )}
    </div>
  )
}

const styles = {
  bar: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '10px 10px 10px 14px',
    borderRadius: 100,
    border: '1px solid var(--b1)',
    transition: 'background 150ms ease, border-color 150ms ease',
  },
  leftIcon: { fontSize: 16, lineHeight: 1 },
  input: {
    flex: 1,
    minWidth: 0,
    fontSize: 14.5,
    padding: '4px 0',
    color: 'var(--t1)',
  },
  micBtn: {
    width: 36,
    height: 36,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '50%',
    fontSize: 16,
    flexShrink: 0,
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
    flexShrink: 0,
    transition: 'background 120ms ease, color 120ms ease',
  },
  error: {
    marginTop: 8,
    fontSize: 12.5,
    color: 'var(--t3)',
    paddingLeft: 14,
  },
}
