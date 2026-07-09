// The catalog data layer. One interface, two backends:
//   • Firestore  — used automatically when Firebase env config is present
//   • localStorage — dev / pre-Firebase fallback so cataloging works immediately
// Swapping from local to cloud requires no changes in the UI code.
import { hasFirebase, db } from './firebase.js'
import {
  collection, onSnapshot, addDoc, deleteDoc, updateDoc, increment,
  doc, setDoc, query, orderBy, serverTimestamp,
} from 'firebase/firestore'

export { hasFirebase }

const LS_KEY = 'gameshelf.catalog'
const PLAYS_KEY = 'gameshelf.plays'
const SESS_KEY = 'gameshelf.sessions'

// A stable per-device id. Uses the anonymous Firebase uid when signed in, else a
// persisted random id — so a voter keeps the same identity across reloads and can
// edit their ballot. `user` is the resolved auth user (or null in localStorage mode).
export function getUid(user) {
  if (user?.uid) return user.uid
  try {
    let id = localStorage.getItem('gameshelf.uid')
    if (!id) { id = 'u-' + Math.random().toString(36).slice(2, 10); localStorage.setItem('gameshelf.uid', id) }
    return id
  } catch { return 'u-anon' }
}

// A game's box "cover" is a gradient derived from its name, so every game gets a
// distinct, stable box even before we have real art from BoardGameGeek.
export function coverFor(name = '') {
  let h = 5381
  for (const ch of name) h = (h * 33 + ch.charCodeAt(0)) >>> 0
  const hue = h % 360
  return { c1: `hsl(${hue} 46% 42%)`, c2: `hsl(${(hue + 26) % 360} 52% 25%)` }
}

// ---- localStorage backend ----
function lsRead() {
  try { return JSON.parse(localStorage.getItem(LS_KEY)) || [] } catch { return [] }
}
function lsWrite(list) {
  localStorage.setItem(LS_KEY, JSON.stringify(list))
  window.dispatchEvent(new Event('catalog-change'))
}

// ---- public API ----
// subscribeGames(cb) → returns an unsubscribe function. cb receives the full list
// (sorted by name) whenever the catalog changes.
export function subscribeGames(cb) {
  if (hasFirebase) {
    const q = query(collection(db, 'games'), orderBy('name'))
    return onSnapshot(q, (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))))
  }
  const emit = () => cb(lsRead().sort((a, b) => a.name.localeCompare(b.name)))
  emit()
  window.addEventListener('catalog-change', emit)
  return () => window.removeEventListener('catalog-change', emit)
}

export async function addGame(game) {
  const rec = { ...game, createdAt: hasFirebase ? serverTimestamp() : Date.now() }
  if (hasFirebase) { await addDoc(collection(db, 'games'), rec); return }
  const list = lsRead()
  list.push({ id: 'local-' + Date.now(), ...rec })
  lsWrite(list)
}

export async function updateGame(id, patch) {
  if (hasFirebase) { await updateDoc(doc(db, 'games', id), patch); return }
  const list = lsRead()
  const i = list.findIndex((g) => g.id === id)
  if (i >= 0) { list[i] = { ...list[i], ...patch }; lsWrite(list) }
}

export async function deleteGame(id) {
  if (hasFirebase) { await deleteDoc(doc(db, 'games', id)); return }
  lsWrite(lsRead().filter((g) => g.id !== id))
}

// ---- play log (stats feed) ----
// Normalize any stored "when" (millis, Firestore Timestamp, or ISO string) to millis.
function toMillis(v) {
  if (v == null) return null
  if (typeof v === 'number') return v
  if (typeof v === 'object' && typeof v.toMillis === 'function') return v.toMillis()
  if (typeof v === 'object' && typeof v.seconds === 'number') return v.seconds * 1000
  const t = Date.parse(v)
  return Number.isNaN(t) ? null : t
}

// Days since a game was last played, computed live from its `lastPlayed` timestamp.
// Falls back to the legacy static `last` number for games logged before timestamps
// existed. Returns null for never-played games (so callers can say "fresh face").
export function playedDaysAgo(game = {}) {
  const ms = toMillis(game.lastPlayed)
  if (ms != null) return Math.max(0, Math.floor((Date.now() - ms) / 86400000))
  if (typeof game.last === 'number' && game.last !== 999) return game.last
  return null
}

function lsReadPlays() {
  try { return JSON.parse(localStorage.getItem(PLAYS_KEY)) || [] } catch { return [] }
}
function lsWritePlays(list) {
  localStorage.setItem(PLAYS_KEY, JSON.stringify(list))
  window.dispatchEvent(new Event('plays-change'))
}

// subscribePlays(cb) → unsubscribe. cb gets the full play log, newest first.
export function subscribePlays(cb) {
  if (hasFirebase) {
    const q = query(collection(db, 'plays'), orderBy('playedAt', 'desc'))
    return onSnapshot(q, (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))))
  }
  const emit = () => cb([...lsReadPlays()].sort((a, b) => (b.playedAt || 0) - (a.playedAt || 0)))
  emit()
  window.addEventListener('plays-change', emit)
  return () => window.removeEventListener('plays-change', emit)
}

// Log one play of one game: appends a play record AND freshens the game's
// lastPlayed / plays count (which drives the Shelf display and, later, Game
// Night's freshness engine). `winner` may be null for co-op / no-winner games.
export async function logPlay(play) {
  const rec = {
    gameId: play.gameId || null,
    gameName: play.gameName || '',
    players: Array.isArray(play.players) ? play.players : [],
    winner: play.winner ?? null,
    minutes: Number(play.minutes) || null,
    playedAt: play.playedAt || Date.now(),
  }
  if (hasFirebase) {
    await addDoc(collection(db, 'plays'), { ...rec, createdAt: serverTimestamp() })
    if (rec.gameId) {
      await updateDoc(doc(db, 'games', rec.gameId), {
        lastPlayed: rec.playedAt, plays: increment(1),
      })
    }
    return
  }
  const list = lsReadPlays()
  list.push({ id: 'local-' + Date.now(), ...rec, createdAt: Date.now() })
  lsWritePlays(list)
  if (rec.gameId) {
    const games = lsRead()
    const i = games.findIndex((g) => g.id === rec.gameId)
    if (i >= 0) {
      games[i] = { ...games[i], lastPlayed: rec.playedAt, plays: (games[i].plays || 0) + 1 }
      lsWrite(games)
    }
  }
}

// ---- Game Night sessions (real-time voting rooms) ----
// Firestore: sessions/{code} doc + sessions/{code}/votes/{voterId} subcollection.
// localStorage: one blob keyed by code, votes nested inside — so the flow still
// works single-device in dev (not cross-device, which needs the cloud).
function lsSessions() {
  try { return JSON.parse(localStorage.getItem(SESS_KEY)) || {} } catch { return {} }
}
function lsWriteSessions(map) {
  localStorage.setItem(SESS_KEY, JSON.stringify(map))
  window.dispatchEvent(new Event('sessions-change'))
}

export async function createSession(code, data) {
  if (hasFirebase) {
    await setDoc(doc(db, 'sessions', code), { ...data, createdAt: serverTimestamp() })
    return
  }
  const all = lsSessions()
  all[code] = { ...data, votes: {}, createdAt: Date.now() }
  lsWriteSessions(all)
}

export function subscribeSession(code, cb) {
  if (hasFirebase) {
    return onSnapshot(doc(db, 'sessions', code), (s) => cb(s.exists() ? { code, ...s.data() } : null))
  }
  const emit = () => { const s = lsSessions()[code]; cb(s ? { code, ...s } : null) }
  emit()
  window.addEventListener('sessions-change', emit)
  return () => window.removeEventListener('sessions-change', emit)
}

export function subscribeVotes(code, cb) {
  if (hasFirebase) {
    return onSnapshot(collection(db, 'sessions', code, 'votes'),
      (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))))
  }
  const emit = () => {
    const s = lsSessions()[code]
    cb(s ? Object.entries(s.votes || {}).map(([id, v]) => ({ id, ...v })) : [])
  }
  emit()
  window.addEventListener('sessions-change', emit)
  return () => window.removeEventListener('sessions-change', emit)
}

export async function submitVote(code, voterId, vote) {
  if (hasFirebase) {
    await setDoc(doc(db, 'sessions', code, 'votes', voterId), { ...vote, updatedAt: serverTimestamp() })
    return
  }
  const all = lsSessions()
  if (!all[code]) return
  all[code].votes = all[code].votes || {}
  all[code].votes[voterId] = { ...vote, updatedAt: Date.now() }
  lsWriteSessions(all)
}

export async function revealSession(code, extra = {}) {
  if (hasFirebase) {
    await updateDoc(doc(db, 'sessions', code), { phase: 'revealed', ...extra })
    return
  }
  const all = lsSessions()
  if (all[code]) { all[code] = { ...all[code], phase: 'revealed', ...extra }; lsWriteSessions(all) }
}
