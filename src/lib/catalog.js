// The catalog data layer. One interface, two backends:
//   • Firestore  — used automatically when Firebase env config is present
//   • localStorage — dev / pre-Firebase fallback so cataloging works immediately
// Swapping from local to cloud requires no changes in the UI code.
import { hasFirebase, db } from './firebase.js'
import {
  collection, onSnapshot, addDoc, deleteDoc, doc, query, orderBy, serverTimestamp,
} from 'firebase/firestore'

export { hasFirebase }

const LS_KEY = 'gameshelf.catalog'

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

export async function deleteGame(id) {
  if (hasFirebase) { await deleteDoc(doc(db, 'games', id)); return }
  lsWrite(lsRead().filter((g) => g.id !== id))
}
