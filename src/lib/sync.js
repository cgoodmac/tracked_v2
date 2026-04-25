// Sync layer between localStorage and Supabase's user_state table.
//
// Strategy: localStorage is the offline cache, Supabase is source of truth.
// On login we pull the server row and hydrate local state. On every change
// we push the full state back, debounced to avoid hammering the network.
//
// Conflict policy: last-write-wins. For a single user across phone + laptop
// this is fine in practice. If we ever need finer-grained conflict handling,
// we'll shard the JSONB into separate tables (logs, checkins, etc.).

import { supabase } from './supabase.js'
import * as storage from './storage.js'

const TABLE = 'user_state'

// ---------- Pull from server ----------
// Returns the server's `data` blob, or null if the user has no row yet.
// On any error, returns null so the caller can fall back to local data.
export async function pullState(userId) {
  if (!supabase || !userId) return null
  const { data, error } = await supabase
    .from(TABLE)
    .select('data, updated_at')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) {
    console.error('[tracked] pullState error', error)
    return null
  }
  return data || null  // { data, updated_at } or null
}

// ---------- Push to server ----------
// Upserts the user's row with the current localStorage snapshot.
// Returns the new updated_at on success, null on failure.
export async function pushState(userId) {
  if (!supabase || !userId) return null
  const snapshot = storage.exportAll()
  const { data, error } = await supabase
    .from(TABLE)
    .upsert(
      { user_id: userId, data: snapshot.data },
      { onConflict: 'user_id' }
    )
    .select('updated_at')
    .single()
  if (error) {
    console.error('[tracked] pushState error', error)
    return null
  }
  return data?.updated_at || null
}

// ---------- Hydrate localStorage from a server snapshot ----------
// Takes the `data` field from a pulled row (the payload of exportAll().data
// that we previously pushed) and writes each key into localStorage. Mirrors
// the shape used by storage.exportAll/importAll so nothing else has to change.
export function hydrateFromServer(serverData) {
  if (!serverData || typeof serverData !== 'object') return false
  storage.importAll({ app: 'tracked', version: 1, data: serverData })
  return true
}

// ---------- Debounced pusher factory ----------
// Returns a function you can call on every state change. It coalesces rapid
// successive changes into a single push after `delay` ms of quiet.
export function makeDebouncedPush(delay = 800) {
  let timer = null
  let pendingUserId = null
  let onResultCb = null

  const flush = async () => {
    timer = null
    const userId = pendingUserId
    pendingUserId = null
    if (!userId) return
    const result = await pushState(userId)
    if (onResultCb) onResultCb(result)
  }

  const push = (userId, onResult) => {
    pendingUserId = userId
    onResultCb = onResult || null
    if (timer) clearTimeout(timer)
    timer = setTimeout(flush, delay)
  }

  // For e.g. logout — push immediately then resolve.
  const flushNow = async () => {
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
    if (!pendingUserId) return null
    const userId = pendingUserId
    pendingUserId = null
    const result = await pushState(userId)
    if (onResultCb) onResultCb(result)
    return result
  }

  return { push, flushNow }
}
