// App shell. When the user isn't onboarded we render the full 5-step
// onboarding wizard. After that, the daily check-in and bottom nav.
//
// The dev seed + reset buttons live tucked into the Insights stub so they're
// easy to find for testing but invisible during normal use.

import { useState } from 'react'
import { AppStateProvider, useAppState } from './hooks/useAppState.jsx'
import CheckinScreen from './components/daily/CheckinScreen.jsx'
import NavBar from './components/NavBar.jsx'
import OnboardingFlow from './components/onboarding/OnboardingFlow.jsx'

export default function App() {
  return (
    <AppStateProvider>
      <Shell />
    </AppStateProvider>
  )
}

function Shell() {
  const { onboarded } = useAppState()
  const [tab, setTab] = useState('today')

  if (!onboarded) return <OnboardingFlow />

  return (
    <div className="app">
      <div style={{ padding: '0 20px' }}>
        {tab === 'today' && <CheckinScreen />}
        {tab === 'insights' && <InsightsStub />}
      </div>
      <NavBar current={tab} onChange={setTab} />
    </div>
  )
}

// Placeholder for the Insights surface. Also hosts a small "dev tools" panel
// (sample data seed + reset all) until the real Insights screen is built.
function InsightsStub() {
  const { seedSampleData, resetAll, goals, metrics, interventions, pro, setPro } = useAppState()
  const [showDev, setShowDev] = useState(false)

  return (
    <div style={{ padding: '40px 0' }}>
      <div className="label-section" style={{ marginBottom: 8 }}>Insights</div>
      <h2 style={{ fontSize: 20, marginBottom: 12 }}>Coming soon</h2>
      <p style={{ color: 'var(--t2)', fontSize: 14, lineHeight: 1.5, marginBottom: 24 }}>
        Trend charts, AI analysis reports, and the stack timeline will live here.
        Next phase of the build.
      </p>

      <div style={{ fontSize: 13, color: 'var(--t3)', marginBottom: 16 }}>
        Right now you have <span className="mono">{goals.length}</span> goals,
        {' '}<span className="mono">{metrics.length}</span> metrics,
        and <span className="mono">{interventions.length}</span> interventions tracked.
      </div>

      <button
        type="button"
        className="btn btn-ghost"
        onClick={() => setShowDev(v => !v)}
        style={{ fontSize: 12, padding: '6px 10px', color: 'var(--t3)' }}
      >
        {showDev ? 'Hide' : 'Show'} dev tools
      </button>

      {showDev && (
        <div style={devStyles.panel}>
          <div className="label-section" style={{ marginBottom: 10 }}>Dev tools</div>

          <div style={devStyles.row}>
            <button
              type="button"
              className="btn btn-secondary"
              style={devStyles.btn}
              onClick={seedSampleData}
            >
              Seed sample data
            </button>
            <span style={devStyles.hint}>
              Adds 4 goals, 5 metrics, 8 interventions.
            </span>
          </div>

          <div style={devStyles.row}>
            <button
              type="button"
              className="btn btn-secondary"
              style={devStyles.btn}
              onClick={() => setPro(!pro)}
            >
              {pro ? 'Disable' : 'Enable'} Pro
            </button>
            <span style={devStyles.hint}>
              Toggles the paywall flags (notes field, etc).
            </span>
          </div>

          <div style={devStyles.row}>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ ...devStyles.btn, color: '#B42318' }}
              onClick={() => {
                if (confirm('Wipe all Tracked data and restart from onboarding?')) resetAll()
              }}
            >
              Reset all data
            </button>
            <span style={devStyles.hint}>
              Clears localStorage, kicks you back to the welcome screen.
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

const devStyles = {
  panel: {
    marginTop: 16,
    padding: 16,
    border: '1px solid var(--b1)',
    borderRadius: 12,
    background: 'var(--s2)',
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    marginBottom: 10,
    flexWrap: 'wrap',
  },
  btn: {
    fontSize: 13,
    padding: '8px 14px',
  },
  hint: {
    fontSize: 12,
    color: 'var(--t3)',
    flex: 1,
    minWidth: 140,
  },
}
