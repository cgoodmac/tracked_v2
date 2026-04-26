import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import './index.css'

// Ask the browser to treat our localStorage as persistent so it isn't purged
// under storage pressure or Safari's 7-day inactivity rule. Installed PWAs
// on iOS 16.4+ are typically granted this automatically. Safe no-op if the
// API isn't available or the grant is denied — we still function, we're just
// more exposed to eviction.
if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.persist) {
  navigator.storage.persist().then(
    (granted) => { if (granted) console.log('[tracked] persistent storage granted') },
    () => { /* ignore */ }
  )
}

// ---- Auto-update for iOS PWA ----
// iOS home-screen PWAs are slow to pick up new service workers. We fetch a
// cache-busted version.json on every launch and compare it to what we last
// saw. If the version changed, we unregister the old SW and hard-reload so
// the user always gets the latest build without manual intervention.
;(async () => {
  try {
    const res = await fetch('/version.json?_=' + Date.now(), { cache: 'no-store' })
    if (!res.ok) return
    const { v } = await res.json()
    const prev = localStorage.getItem('tracked_app_version')
    if (prev && prev !== v) {
      // New version deployed — flush the old service worker and reload
      const regs = await navigator.serviceWorker?.getRegistrations() || []
      await Promise.all(regs.map(r => r.unregister()))
      localStorage.setItem('tracked_app_version', v)
      window.location.reload()
      return
    }
    localStorage.setItem('tracked_app_version', v)
  } catch { /* offline or fetch failed — carry on with cached version */ }
})()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
)
