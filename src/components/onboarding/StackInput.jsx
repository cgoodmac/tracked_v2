// Step 4 — Stack input. Same shape as goals input: free-text field with mic,
// suggestion chips, heading. Accepts anything from a one-liner to a full
// pasted health document.
//
// TODO: gate AI parsing at 20+ parsed items behind Pro (paywall screen
// isn't built yet). For now we let every size through.

import { useState } from 'react'
import { parseStackText } from '../../lib/ai.js'
import {
  OnboardingPage, BackRow, StepLabel, StepHeading,
  SuggestionChips, TextMicBar, Thinking,
} from './ui.jsx'

const SUGGESTIONS = [
  'I take magnesium, vitamin D, and omega-3 daily',
  "Here's my full supplement and medication list",
  'I run 3x a week and do CBT therapy',
]

export default function StackInput({ initialText = '', onBack, onParsed }) {
  const [text, setText] = useState(initialText)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [offlineNotice, setOfflineNotice] = useState(false)

  const handleSend = async (value) => {
    setBusy(true)
    setErr('')
    setOfflineNotice(false)
    try {
      const { interventions, offline } = await parseStackText({ userText: value })
      if (!interventions || interventions.length === 0) {
        setErr("I couldn't find any interventions in that. Try listing them out.")
        return
      }
      if (offline) setOfflineNotice(true)
      onParsed({ interventions, rawText: value })
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
          placeholder='e.g. "Magnesium 400mg, vitamin D, Trintellix 10mg, morning run…"'
          autoFocus
        />
      }
    >
      <BackRow onBack={onBack} />

      <StepLabel>Step 2</StepLabel>

      <StepHeading
        title="What are you doing to reach those goals?"
        subtitle="Supplements, medications, habits, exercises, therapies, devices, diet changes — anything. Type a quick list, or paste detailed notes — even a full health document."
      />

      <SuggestionChips suggestions={SUGGESTIONS} onPick={setText} />

      <div style={{ flex: 1 }} />

      {busy && <Thinking label="Organizing your stack…" />}
      {err && !busy && <div style={styles.error}>{err}</div>}
      {offlineNotice && !busy && (
        <div style={styles.notice}>
          AI unavailable — I pulled items from each line but couldn't detect doses or types. You can edit everything on the next screen.
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
