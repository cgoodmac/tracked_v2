// Central app state hook. Reads from localStorage on mount, exposes setters
// that persist back. When Supabase is configured and the user is signed in,
// also pulls the canonical state from the server on sign-in and pushes
// changes back debounced. All components share one instance via the context.

import { createContext, useContext, useEffect, useMemo, useState, useCallback, useRef } from 'react'
import * as storage from '../lib/storage.js'
import { applyActions } from '../lib/actions.js'
import { todayISO, SEED_GOALS, SEED_METRICS, SEED_INTERVENTIONS } from '../lib/constants.js'
import { supabase, isSupabaseConfigured } from '../lib/supabase.js'
import { pullState, pushState, hydrateFromServer, makeDebouncedPush } from '../lib/sync.js'

const AppStateContext = createContext(null)

export function AppStateProvider({ children }) {
  const [onboarded, setOnboardedState] = useState(() => storage.isOnboarded())
  const [pro, setProState]             = useState(() => storage.isPro())
  const [goals, setGoalsState]         = useState(() => storage.getGoals())
  const [metrics, setMetricsState]     = useState(() => storage.getMetrics())
  const [interventions, setInterventionsState] = useState(() => storage.getInterventions())
  const [checkins, setCheckinsState]   = useState(() => storage.getCheckins())
  const [logs, setLogsState]           = useState(() => storage.getLogs())
  const [measurements, setMeasurementsState] = useState(() => storage.getMeasurements())

  // ---- Auth + sync state ----
  // authStatus is 'loading' until Supabase tells us yes/no on the session.
  // When local-only (no Supabase configured), we resolve to 'localOnly' so
  // App.jsx can render the app directly without showing a login screen.
  const [authStatus, setAuthStatus] = useState(isSupabaseConfigured ? 'loading' : 'localOnly')
  const [authUser, setAuthUser] = useState(null)
  const [syncStatus, setSyncStatus] = useState('idle') // idle | syncing | synced | error
  const hydratedRef = useRef(false)
  const pusherRef = useRef(null)
  if (!pusherRef.current) pusherRef.current = makeDebouncedPush(800)

  // Reload all React state from whatever's currently in localStorage.
  // Used after we hydrate localStorage from a server pull, and after sign-out
  // when we wipe the cache.
  const reloadStateFromStorage = useCallback(() => {
    setOnboardedState(storage.isOnboarded())
    setProState(storage.isPro())
    setGoalsState(storage.getGoals())
    setMetricsState(storage.getMetrics())
    setInterventionsState(storage.getInterventions())
    setCheckinsState(storage.getCheckins())
    setLogsState(storage.getLogs())
    setMeasurementsState(storage.getMeasurements())
  }, [])

  // ---- Setters that also persist ----
  const setOnboarded = useCallback((v) => { storage.setOnboarded(v); setOnboardedState(!!v) }, [])
  const setPro = useCallback((v) => { storage.setPro(v); setProState(!!v) }, [])
  const setGoals = useCallback((g) => { storage.setGoals(g); setGoalsState(Array.isArray(g) ? g : []) }, [])
  const setMetrics = useCallback((m) => { storage.setMetrics(m); setMetricsState(Array.isArray(m) ? m : []) }, [])
  const setInterventions = useCallback((list) => { storage.setInterventions(list); setInterventionsState(Array.isArray(list) ? list : []) }, [])
  const setCheckins = useCallback((obj) => { storage.setCheckins(obj); setCheckinsState(obj || {}) }, [])
  const setLogs = useCallback((obj) => { storage.setLogs(obj); setLogsState(obj || {}) }, [])
  const setMeasurements = useCallback((obj) => { storage.setMeasurements(obj); setMeasurementsState(obj || {}) }, [])

  // ---- Convenience: upsert today's check-in and taken log ----
  const upsertCheckin = useCallback((partial, date = todayISO()) => {
    setCheckinsState(prev => {
      const next = { ...prev, [date]: { ...(prev[date] || {}), date, ...partial } }
      storage.setCheckins(next)
      return next
    })
  }, [])

  const upsertLog = useCallback((partial, date = todayISO()) => {
    setLogsState(prev => {
      const next = { ...prev, [date]: { ...(prev[date] || {}), ...partial } }
      storage.setLogs(next)
      return next
    })
  }, [])

  // ---- Inline add: intervention ----
  // Used by the check-in screen's "+ Add to stack" button. Accepts partial
  // data (just name is required), fills in reasonable defaults, mints an id.
  const addIntervention = useCallback((partial) => {
    if (!partial?.name) return null
    const id = 'id-' + Math.random().toString(36).slice(2) + Date.now().toString(36)
    const next = {
      id,
      name: String(partial.name).trim(),
      type: partial.type || 'other',
      dose: partial.dose ? String(partial.dose).trim() : null,
      frequency: partial.frequency || 'Daily',
      status: 'active',
      startDate: partial.startDate || todayISO(),
      endDate: null,
      notes: partial.notes ? String(partial.notes).trim() : null,
    }
    setInterventionsState(prev => {
      const list = [...(prev || []), next]
      storage.setInterventions(list)
      return list
    })
    return next
  }, [])

  // ---- Inline add: metric (and optional linked goal) ----
  // For scale: pass { name, label, low, high, direction, icon, color, type:'scale' }
  // For periodic: pass { name, label, unit, cadence, direction, icon, color, type:'periodic' }
  // If `asGoal` is true, also append a goal of the same name pointing to this metric.
  const addMetric = useCallback((partial, { asGoal = true } = {}) => {
    if (!partial?.name) return null
    const name = String(partial.name).trim().toLowerCase()
    const id = 'm-' + name.replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 24) + '-' + Date.now().toString(36)
    const type = partial.type === 'periodic' ? 'periodic' : 'scale'
    const metric = {
      id,
      name,
      label: partial.label || name.charAt(0).toUpperCase() + name.slice(1),
      type,
      direction: partial.direction === 'down' ? 'down' : 'up',
      icon: partial.icon || '•',
      color: partial.color || '#00A699',
    }
    if (type === 'scale') {
      metric.low = partial.low || (metric.direction === 'down' ? 'bad' : 'low')
      metric.high = partial.high || (metric.direction === 'down' ? 'good' : 'high')
    } else {
      metric.unit = partial.unit || ''
      metric.cadence = partial.cadence || ''
    }

    setMetricsState(prev => {
      const list = [...(prev || []), metric]
      storage.setMetrics(list)
      return list
    })

    if (asGoal) {
      setGoalsState(prev => {
        const existing = prev || []
        const gid = 'g-' + name.replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 24) + '-' + Date.now().toString(36)
        const goal = {
          id: gid,
          name,
          metricId: metric.id,
          tracked: true,
          priority: existing.length + 1,
          note: null,
        }
        const list = [...existing, goal]
        storage.setGoals(list)
        return list
      })
    }
    return metric
  }, [])

  // ---- Log a periodic measurement value ----
  // Appends a { date, value, note, id } entry to measurements[metricId] and
  // keeps the per-metric array sorted newest-first.
  const logMeasurement = useCallback((metricId, { value, note, date } = {}) => {
    if (!metricId || value == null || value === '') return null
    const num = Number(value)
    if (!Number.isFinite(num)) return null
    const entry = {
      id: 'x-' + Math.random().toString(36).slice(2) + Date.now().toString(36),
      date: date || todayISO(),
      value: num,
      note: note ? String(note).trim() : null,
    }
    setMeasurementsState(prev => {
      const existing = (prev && prev[metricId]) || []
      const merged = [entry, ...existing].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
      const next = { ...(prev || {}), [metricId]: merged }
      storage.setMeasurements(next)
      return next
    })
    return entry
  }, [])

  const removeMeasurement = useCallback((metricId, entryId) => {
    setMeasurementsState(prev => {
      const existing = (prev && prev[metricId]) || []
      const next = { ...(prev || {}), [metricId]: existing.filter(m => m.id !== entryId) }
      storage.setMeasurements(next)
      return next
    })
  }, [])

  // ---- Apply a batch of AI actions ----
  const applyAIActions = useCallback((actions) => {
    const date = todayISO()
    const current = { goals, metrics, interventions, checkins, logs, measurements }
    const next = applyActions(current, actions, date)
    if (next.goals !== current.goals) setGoals(next.goals)
    if (next.metrics !== current.metrics) setMetrics(next.metrics)
    if (next.interventions !== current.interventions) setInterventions(next.interventions)
    if (next.checkins !== current.checkins) setCheckins(next.checkins)
    if (next.logs !== current.logs) setLogs(next.logs)
    if (next.measurements !== current.measurements) setMeasurements(next.measurements)
    return next
  }, [goals, metrics, interventions, checkins, logs, measurements, setGoals, setMetrics, setInterventions, setCheckins, setLogs, setMeasurements])

  // ---- Dev seed: populate sample goals + metrics + stack for first-run testing.
  const seedSampleData = useCallback(() => {
    setGoals(SEED_GOALS)
    setMetrics(SEED_METRICS)
    setInterventions(SEED_INTERVENTIONS)
    setOnboarded(true)
  }, [setGoals, setMetrics, setInterventions, setOnboarded])

  const resetAll = useCallback(() => {
    storage.resetAll()
    setOnboardedState(false)
    setProState(false)
    setGoalsState([])
    setMetricsState([])
    setInterventionsState([])
    setCheckinsState({})
    setLogsState({})
    setMeasurementsState({})
  }, [])

  // ---- Sign out: flush any pending push, sign out of Supabase, wipe local cache ----
  const signOut = useCallback(async () => {
    if (!supabase) return
    try { await pusherRef.current?.flushNow() } catch { /* swallow */ }
    await supabase.auth.signOut()
    storage.resetAll()
    hydratedRef.current = false
    setOnboardedState(false)
    setProState(false)
    setGoalsState([])
    setMetricsState([])
    setInterventionsState([])
    setCheckinsState({})
    setLogsState({})
    setMeasurementsState({})
  }, [])

  // ---- Auth lifecycle ----
  // Establishes the initial session and subscribes to changes (sign-in via
  // magic link, sign-out, token refresh). Runs once on mount.
  useEffect(() => {
    if (!supabase) return
    let unsub = () => {}
    supabase.auth.getSession().then(({ data: { session } }) => {
      setAuthUser(session?.user ?? null)
      setAuthStatus(session?.user ? 'signedIn' : 'signedOut')
    })
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      setAuthUser(session?.user ?? null)
      setAuthStatus(session?.user ? 'signedIn' : 'signedOut')
      if (event === 'SIGNED_OUT') {
        hydratedRef.current = false
      }
    })
    unsub = () => data.subscription.unsubscribe()
    return unsub
  }, [])

  // ---- On sign-in: pull from server, hydrate local cache ----
  // First-time login (no server row yet): we push local data up so the user
  // doesn't lose anything they tracked before signing up. Subsequent logins:
  // server wins, local cache is rewritten to match.
  useEffect(() => {
    if (!authUser || hydratedRef.current) return
    let cancelled = false
    setSyncStatus('syncing')
    pullState(authUser.id).then(async (row) => {
      if (cancelled) return
      const serverData = row?.data
      const serverHasData = serverData && typeof serverData === 'object' &&
        Object.values(serverData).some(v => v !== null && v !== undefined &&
          !(Array.isArray(v) && v.length === 0) &&
          !(typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === 0))
      if (serverHasData) {
        hydrateFromServer(serverData)
        reloadStateFromStorage()
      } else {
        // First sync — push our local data up so it lives on the server.
        await pushState(authUser.id)
      }
      hydratedRef.current = true
      setSyncStatus('synced')
    }).catch((err) => {
      console.error('[tracked] hydration failed', err)
      if (!cancelled) {
        hydratedRef.current = true // don't loop on errors
        setSyncStatus('error')
      }
    })
    return () => { cancelled = true }
  }, [authUser, reloadStateFromStorage])

  // ---- Push-on-change ----
  // After hydration, schedule a debounced push whenever any tracked piece of
  // state changes. The pusher coalesces rapid edits into one network call.
  useEffect(() => {
    if (!authUser || !hydratedRef.current) return
    setSyncStatus('syncing')
    pusherRef.current.push(authUser.id, (result) => {
      setSyncStatus(result ? 'synced' : 'error')
    })
  }, [
    authUser,
    onboarded, pro,
    goals, metrics, interventions,
    checkins, logs, measurements,
  ])

  // Light derived helpers commonly needed by the UI
  const derived = useMemo(() => {
    const today = todayISO()
    return {
      today,
      todaysCheckin: checkins[today] || null,
      todaysLog: logs[today] || {},
      activeInterventions: interventions.filter(i => i.status !== 'stopped'),
    }
  }, [checkins, logs, interventions])

  // Cross-tab sync: if another tab writes to localStorage, re-read the key.
  useEffect(() => {
    const onStorage = (e) => {
      if (!e.key) return
      if (e.key === 'tracked_onboarded')     setOnboardedState(storage.isOnboarded())
      if (e.key === 'tracked_pro')           setProState(storage.isPro())
      if (e.key === 'tracked_goals')         setGoalsState(storage.getGoals())
      if (e.key === 'tracked_metrics')       setMetricsState(storage.getMetrics())
      if (e.key === 'tracked_interventions') setInterventionsState(storage.getInterventions())
      if (e.key === 'tracked_checkins')      setCheckinsState(storage.getCheckins())
      if (e.key === 'tracked_logs')          setLogsState(storage.getLogs())
      if (e.key === 'tracked_measurements')  setMeasurementsState(storage.getMeasurements())
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const value = {
    // state
    onboarded, pro, goals, metrics, interventions, checkins, logs, measurements,
    // setters
    setOnboarded, setPro, setGoals, setMetrics, setInterventions, setCheckins, setLogs, setMeasurements,
    // convenience
    upsertCheckin, upsertLog, applyAIActions,
    addIntervention, addMetric, logMeasurement, removeMeasurement,
    // dev
    seedSampleData, resetAll,
    // auth + sync
    authStatus, authUser, syncStatus, signOut,
    // derived
    ...derived,
  }

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>
}

export function useAppState() {
  const ctx = useContext(AppStateContext)
  if (!ctx) throw new Error('useAppState must be used inside <AppStateProvider>')
  return ctx
}
