// Multi-step wizard that strings the 5 onboarding screens together.
//
// State machine (steps):
//   welcome → goals-input → goals-confirm → stack-input → stack-confirm → done
//
// We keep the user's raw draft text at each input step so the back button
// restores exactly what they typed instead of a fresh empty field.
//
// On completion the wizard writes goals + interventions to app state and
// flips the onboarded flag.

import { useState } from 'react'
import { useAppState } from '../../hooks/useAppState.jsx'
import Welcome from './Welcome.jsx'
import GoalsInput from './GoalsInput.jsx'
import GoalsConfirm from './GoalsConfirm.jsx'
import StackInput from './StackInput.jsx'
import StackConfirm from './StackConfirm.jsx'

const uid = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : 'id-' + Math.random().toString(36).slice(2) + Date.now().toString(36)

export default function OnboardingFlow() {
  const { setGoals, setMetrics, setInterventions, setOnboarded } = useAppState()

  const [step, setStep] = useState('welcome')

  // Drafts — persist between back-and-forth so users don't retype.
  const [goalsDraft, setGoalsDraft] = useState('')
  const [parsedGoals, setParsedGoals] = useState([])
  const [parsedMetrics, setParsedMetrics] = useState([])

  const [stackDraft, setStackDraft] = useState('')
  const [parsedStack, setParsedStack] = useState([])

  // ---- Step transitions ----
  const goToGoalsInput = () => setStep('goals-input')
  const goToGoalsConfirm = ({ goals, metrics, rawText }) => {
    setParsedGoals(goals)
    setParsedMetrics(metrics || [])
    setGoalsDraft(rawText)
    setStep('goals-confirm')
  }
  const goToStackInput = () => setStep('stack-input')
  const goToStackConfirm = ({ interventions, rawText }) => {
    setParsedStack(interventions)
    setStackDraft(rawText)
    setStep('stack-confirm')
  }

  const removeGoalAt = (idx) => {
    setParsedGoals(prev => {
      const next = prev.filter((_, i) => i !== idx)
      // Also prune any metric no longer referenced.
      const stillUsed = new Set(next.map(g => g.metricId).filter(Boolean))
      setParsedMetrics(metrics => metrics.filter(m => stillUsed.has(m.id)))
      return next
    })
  }

  const finish = (finalStack) => {
    // Persist to app state + mark onboarded.
    setGoals(parsedGoals)
    setMetrics(parsedMetrics)
    const withIds = finalStack.map(it => ({ id: uid(), ...it }))
    setInterventions(withIds)
    setOnboarded(true)
  }

  switch (step) {
    case 'welcome':
      return <Welcome onNext={goToGoalsInput} />

    case 'goals-input':
      return (
        <GoalsInput
          initialText={goalsDraft}
          onBack={() => setStep('welcome')}
          onParsed={goToGoalsConfirm}
        />
      )

    case 'goals-confirm':
      return (
        <GoalsConfirm
          goals={parsedGoals}
          metrics={parsedMetrics}
          onBack={() => setStep('goals-input')}
          onRemoveGoal={removeGoalAt}
          onContinue={() => {
            if (parsedGoals.length === 0) {
              setStep('goals-input')
            } else {
              goToStackInput()
            }
          }}
        />
      )

    case 'stack-input':
      return (
        <StackInput
          initialText={stackDraft}
          onBack={() => setStep('goals-confirm')}
          onParsed={goToStackConfirm}
        />
      )

    case 'stack-confirm':
      return (
        <StackConfirm
          items={parsedStack}
          onBack={() => setStep('stack-input')}
          onContinue={finish}
        />
      )

    default:
      return null
  }
}
