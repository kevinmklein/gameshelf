// Game Night — the pure voting-engine logic (no Firestore, no React).
// Session persistence lives in catalog.js; this file is the rules from CLAUDE.md:
// eligibility gate → smart shortlist → ranked Borda vote → freshness nudge → tiebreak.
import { playedDaysAgo } from './catalog.js'

export const FAMILY = ['Kevin', 'Stacey', 'Sara', 'Sophia']
const PLAYER_COLOR = { Kevin: '#3f6d8f', Stacey: '#a06a4f', Sara: '#4b7a52', Sophia: '#8a6db0' }
const GUEST_COLORS = ['#c08a3e', '#3f8f8a', '#a06a4f', '#6a7a3f', '#7a5a9a', '#c26a6a']

export function colorFor(name = '') {
  if (PLAYER_COLOR[name]) return PLAYER_COLOR[name]
  let h = 0
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return GUEST_COLORS[h % GUEST_COLORS.length]
}

// Days-since for a ballot snapshot (never-played sorts as "dustiest").
const dust = (g) => { const d = playedDaysAgo(g); return d == null ? 1e9 : d }

const shuffle = (arr) => [...arr].sort(() => Math.random() - 0.5)

// Only the fields a voter's device needs — frozen onto the session so the ballot
// can't shift under people mid-vote and joiners need just one read.
function snapshot(g) {
  return {
    id: g.id, name: g.name, kind: g.kind, time: g.time || null,
    players: g.players || '', loc: g.loc || 'either', att: g.att || 'semi',
    cover: g.cover || { c1: '#3a3a3a', c2: '#222' },
    plays: g.plays || 0, last: g.last ?? null, lastPlayed: g.lastPlayed ?? null,
  }
}

// Hard "rule things out" gate → the set eligible tonight.
export function eligible(games, c = {}) {
  return games.filter((g) => {
    if (c.maxTime && g.time > c.maxTime) return false
    if (c.loc === 'couch' && g.loc === 'table') return false
    if (c.loc === 'table' && g.loc === 'couch') return false
    if (c.att === 'background' && g.att !== 'background') return false
    if (c.att === 'focus' && g.att === 'background') return false
    return true
  })
}

// Smart shortlist: ~8 games, deliberately mixed — some crowd favorites, some
// dusty ones to fight ruts, then variety of kinds — so the ballot is never all
// short/familiar games. Returns frozen snapshots.
export function buildBallot(games, c = {}, size = 8) {
  const elig = eligible(games, c)
  const byFav = [...elig].sort((a, b) => (b.plays || 0) - (a.plays || 0))
  const byDusty = [...elig].sort((a, b) => dust(b) - dust(a))
  const picked = []
  const add = (g) => { if (g && !picked.find((x) => x.id === g.id) && picked.length < size) picked.push(g) }
  byFav.slice(0, 3).forEach(add)
  byDusty.slice(0, 3).forEach(add)
  const kinds = new Set(picked.map((g) => g.kind))
  shuffle(elig).forEach((g) => { if (picked.length < size && !kinds.has(g.kind)) { add(g); kinds.add(g.kind) } })
  shuffle(elig).forEach(add)
  return picked.map(snapshot)
}

// Ranked-approval tally: Borda 3/2/1 across voters + the freshness nudge.
// `votes` is an array of { ranking: [gameId, gameId, gameId] }.
export function tally(ballot = [], votes = []) {
  const base = {}
  ballot.forEach((g) => { base[g.id] = 0 })
  votes.forEach((v) => (v.ranking || []).forEach((id, i) => {
    if (base[id] != null) base[id] += [3, 2, 1][i] || 0
  }))
  const results = ballot.map((g) => {
    const d = playedDaysAgo(g)
    let fresh = 0, label = ''
    if (d == null || d >= 30) { fresh = 1.5; label = 'Dusty-shelf boost' }
    else if (d >= 14) { fresh = 0.5; label = 'A while ago' }
    else if (d <= 3) { fresh = -1; label = 'Just played' }
    return { id: g.id, game: g, base: base[g.id], fresh, score: Math.max(0, base[g.id] + fresh), label }
  }).filter((r) => r.base > 0 || r.fresh !== 0)
  results.sort((a, b) => b.score - a.score || dust(b.game) - dust(a.game))
  return results
}

// Tiebreak helper: Captain of the Night rotates weekly among the people who voted.
export function captainFor(names = []) {
  if (!names.length) return null
  const sorted = [...names].sort()
  const week = Math.floor(Date.now() / (7 * 86400000))
  return sorted[week % sorted.length]
}

const CODE_WORDS = ['OWL', 'FOX', 'ELK', 'CROW', 'MOTH', 'LYNX', 'WREN', 'HARE', 'STAG', 'DOVE']
export function makeRoomCode() {
  return CODE_WORDS[Math.floor(Math.random() * CODE_WORDS.length)] + '-' +
    (100 + Math.floor(Math.random() * 899))
}

export function joinUrl(code) {
  const origin = typeof location !== 'undefined' ? location.origin : ''
  return `${origin}/#/join/${code}`
}

export function constraintPills(c = {}) {
  return [
    c.maxTime ? `⏱ Under ${c.maxTime}m` : '⏱ Any length',
    c.loc === 'couch' ? '🛋 Couch' : c.loc === 'table' ? '🪑 Table' : '🛋🪑 Either',
    c.att === 'background' ? '👀 Half-watch' : c.att === 'focus' ? '🧠 All-in' : '🎯 Any focus',
  ]
}
