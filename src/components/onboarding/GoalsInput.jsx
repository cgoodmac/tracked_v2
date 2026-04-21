// Step 2 — Goals input. User types or speaks freely. Suggestion chips below
// the heading pre-fill the input (no auto-send).
//
// On send, we call parseGoalsText — AI with a local fallback. The parsed
// goals are handed to the parent; the parent transitions to GoalsConfirm.

import { useState } from 'react'
import { parseGoalsText } from '../../lib/ai.js'
import {
  OnboardingPage, BackRow, StepLabel, StepHeading,
  SuggestionChips, TextMicBar, Thinking,
} from './ui.jsx'

const SUGGESTIONS = [
  'Reduce my anxiety and feel calmer',
  'Better sleep and more energy',
  'Improve focus and mental sharpness',
  'Manage chronic pain',
  'Overall health and longevity',
]

export default function GoalsInput({ initialText = '', onBack, onParsed }) {
  const [text, setText] = useState(initialText)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [offlineNotice, setOfflineNotice] = useState(false)

  const handleSend = async (value) => {
    setBusy(true)
    setErr('')
    setOfflineNotice(false)
    try {
      const { goals, metrics, offline } = await parseGoalsText({ userText: value })
      if (!goals || goals.length === 0) {
        setErr("I couldn't pull any goals out of that. Try being a bit more specific.")
        return
      }
      if (offline) setOfflineNotice(true)
      onParsed({ goals, metrics: metrics || [], rawText: value })
    } catch (e) {
      console.error(e)
      setErr("Something went wrong. Tap send again.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <OnboardingPage
      footer={
        <TextMicBar
          value={text}
          onChange={setText}
          onSend={handleSend}
          busy={busy}
          placeholder='e.g. "Reduce my anxiety and sleep better"'
          autoFocus
        />
      }
    >
      <BackRow onBack={onBack} />

      <StepLabel>Step 1</StepLabel>

      <StepHeading
        title="What are your goals?"
        subtitle="Describe what you want to improve in your own words."
      />

      <SuggestionChips suggestions={SUGGESTIONS} onPick={setText} />

      <div style={{ flex: 1 }} />

      {busy && <Thinking label="Reading your goals…" />}
      {err && !busy && <div style={styles.error}>{err}</div>}
      {offlineNotice && !busy && (
        <div style={styles.notice}>
          AI unavailable — I used a basic split. You can edit the result on the next screen.
        </div>
      )}
    </OnboardingPage>
  )
}

const styles = {
  error: {
    fontSize: 13,
    color: '#B42318',
    padding: '8px 14px',
    borderRadius: 10,
    background: 'rgba(180, 35, 24, 0.06)',
  },
  notice: {
    fontSize: 12.5,
    color: 'var(--t3)',
    padding: '8px 14px',
    borderRadius: 10,
    background: 'var(--s2)',
  },
}
