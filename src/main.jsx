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

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
)
