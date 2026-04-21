// Full-screen celebratory confirmation that appears after the user taps
// "Log day". Replaces the tiny "Logged ✓" pill that flashed for 1.5s and was
// easy to miss.
//
// Behavior:
//   - Fades/scales in on mount with an animated checkmark (SVG stroke draw).
//   - Auto-dismisses after AUTO_DISMISS_MS.
//   - Tap anywhere (or press Esc) to dismiss early.
//   - Calls onDismiss so the parent can clear its "justLogged" flag.

import { useEffect } from 'react'
import { formatDateFull } from '../../lib/constants.js'

const AUTO_DISMISS_MS = 2600

export default function LogConfirmation({ date, onDismiss }) {
  useEffect(() => {
    const t = window.setTimeout(onDismiss, AUTO_DISMISS_MS)
    const onKey = (e) => { if (e.key === 'Escape') onDismiss() }
    window.addEventListener('keydown', onKey)
    return () => {
      window.clearTimeout(t)
      window.removeEventListener('keydown', onKey)
    }
  }, [onDismiss])

  return (
    <div
      className="log-confirm-backdrop"
      onClick={onDismiss}
      role="dialog"
      aria-live="polite"
      aria-label="Check-in logged"
    >
      <div className="log-confirm-card" onClick={(e) => e.stopPropagation()}>
        <div className="log-confirm-check-wrap">
          <svg
            className="log-confirm-check"
            viewBox="0 0 52 52"
            width="72"
            height="72"
            aria-hidden="true"
          >
            <circle
              className="log-confirm-check-circle"
              cx="26"
              cy="26"
              r="24"
              fill="none"
              strokeWidth="2.5"
            />
            <path
              className="log-confirm-check-path"
              fill="none"
              strokeWidth="4"
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M14 27 L23 36 L39 18"
            />
          </svg>
        </div>

        <div className="log-confirm-title">Logged for today</div>
        {date && (
          <time className="mono log-confirm-date" dateTime={date}>
            {formatDateFull(date)}
          </time>
        )}

        <button
          type="button"
          className="btn btn-ghost log-confirm-dismiss"
          onClick={onDismiss}
        >
          Tap to dismiss
        </button>
      </div>
    </div>
  )
}
