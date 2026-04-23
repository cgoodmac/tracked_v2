// App shell. When the user isn't onboarded we render the full 5-step
// onboarding wizard. After that, the daily check-in and bottom nav.
//
// The dev seed + reset buttons live tucked into the Insights stub so they're
// easy to find for testing but invisible during normal use.

import { useRef, useState } from 'react'
import { AppStateProvider, useAppState } from './hooks/useAppState.jsx'
import CheckinScreen from './components/daily/CheckinScreen.jsx'
import NavBar from './components/NavBar.jsx'
import OnboardingFlow from './components/onboarding/OnboardingFlow.jsx'
import { exportAll, importAll } from './lib/storage.js'

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
  const fileInputRef = useRef(null)

  // Download a timestamped JSON snapshot of all Tracked data. Keep this file
  // somewhere safe (email to yourself, AirDrop off device) — it's the only
  // backup that survives a PWA delete-and-reinstall.
  const handleExport = () => {
    const snapshot = exportAll()
    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
    const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `tracked-backup-${stamp}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  // Restore from a previously-exported JSON file. Prompts for confirmation
  // because this overwrites everything currently in localStorage, then
  // reloads so the in-memory app state picks up the restored values.
  const handleImportFile = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const snapshot = JSON.parse(String(reader.result))
        if (!confirm('Restore from this backup? This will overwrite all current Tracked data.')) return
        const result = importAll(snapshot)
        if (!result.ok) {
          alert(`Import failed: ${result.error}`)
          return
        }
        alert(`Imported: ${result.imported.join(', ') || 'nothing'}. Reloading…`)
        window.location.reload()
      } catch (err) {
        alert(`Could not read backup file: ${err.message}`)
      } finally {
        // Allow selecting the same file again if needed
        if (fileInputRef.current) fileInputRef.current.value = ''
      }
    }
    reader.readAsText(file)
  }

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
              style={devStyles.btn}
              onClick={handleExport}
            >
              Export backup
            </button>
            <span style={devStyles.hint}>
              Downloads a JSON file with all your data. Save it somewhere safe.
            </span>
          </div>

          <div style={devStyles.row}>
            <button
              type="button"
              className="btn btn-secondary"
              style={devStyles.btn}
              onClick={() => fileInputRef.current?.click()}
            >
              Import backup
            </button>
            <span style={devStyles.hint}>
              Restores from a previously-exported JSON file. Overwrites current data.
            </span>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json,.json"
              style={{ display: 'none' }}
              onChange={handleImportFile}
            />
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
