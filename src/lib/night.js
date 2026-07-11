// Game Night — the pure voting-engine logic (no Firestore, no React).
// Session persistence lives in catalog.js; this file is the rules from CLAUDE.md:
// eligibility gate → smart shortlist → ranked Borda vote → freshness nudge → tiebreak.
import { playedDaysAgo, FALLBACK_COVER } from './catalog.js'

// Days-since for a ballot snapshot (never-played sorts as "dustiest").
const dust = (g) => { const d = playedDaysAgo(g); return d == null ? 1e9 : d }

const shuffle = (arr) => [...arr].sort(() => Math.random() - 0.5)

// Only the fields a voter's device needs — frozen onto the session so the ballot
// can't shift under people mid-vote and joiners need just one read.
function snapshot(g) {
  return {
    id: g.id, name: g.name, kind: g.kind, time: g.time || null,
    players: g.players || '', loc: g.loc || 'either', att: g.att || 'semi',
    cover: g.cover || FALLBACK_COVER, image: g.image || null, bggImage: g.bggImage || null,
    plays: g.plays || 0, last: g.last ?? null, lastPlayed: g.lastPlayed ?? null,
    // BGG extras (present once synced/backfilled) — for the read-only info popup.
    description: g.description || '', weight: g.weight ?? null,
    bestPlayers: g.bestPlayers ?? null, recommendedPlayers: g.recommendedPlayers || [],
  }
}

// Does a game seat exactly `n` players? Lenient when a bound is missing.
// Shared with the Shelf's player-count filter.
export function seatsPlayers(g, n) {
  const min = g.minPlayers, max = g.maxPlayers
  if (min != null && n < min) return false
  if (max != null && n > max) return false
  return true
}

// BGG "suggested players" poll tokens look like "4" or "6+". Does one cover n?
function countMatches(token, n) {
  const s = String(token).trim()
  if (s.endsWith('+')) return n >= parseInt(s, 10)
  return parseInt(s, 10) === n
}

// Community-preferred player counts, from BGG's poll (populated by auto-fill /
// backfill). Each returns null when the game has no BGG data yet, so callers can
// tell "no, doesn't fit n" apart from "we don't know". Shared by the Shelf's
// best-fit filter and Game Night's shortlist.
export function playsBestAt(g, n) {
  if (g.bestPlayers == null || g.bestPlayers === '') return null
  return countMatches(g.bestPlayers, n)
}
export function playsWellAt(g, n) {
  const rec = g.recommendedPlayers
  if (!Array.isArray(rec) || rec.length === 0) return null
  return rec.some((t) => countMatches(t, n))
}

// Hard "rule things out" gate → the set eligible tonight.
export function eligible(games, c = {}) {
  return games.filter((g) => {
    if (c.maxTime && g.time > c.maxTime) return false
    if (c.loc === 'couch' && g.loc === 'table') return false
    if (c.loc === 'table' && g.loc === 'couch') return false
    if (c.att === 'background' && g.att !== 'background') return false
    if (c.att === 'focus' && g.att === 'background') return false
    if (c.players && !seatsPlayers(g, c.players)) return false
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
  // When a player count is set, seed a couple of games the community says shine at
  // that count (best first, then merely-recommended) before the random variety fill.
  if (c.players) {
    elig.filter((g) => playsBestAt(g, c.players) === true).forEach(add)
    elig.filter((g) => playsWellAt(g, c.players) === true).forEach(add)
  }
  const kinds = new Set(picked.map((g) => g.kind))
  shuffle(elig).forEach((g) => { if (picked.length < size && !kinds.has(g.kind)) { add(g); kinds.add(g.kind) } })
  shuffle(elig).forEach(add)
  return picked.map(snapshot)
}

// Ranked-approval tally: Borda 3/2/1 across voters + the freshness nudge.
// `votes` is an array of { ranking: [gameId, gameId, gameId] }.
// Only games somebody actually voted for make the results — the freshness nudge
// reorders the voted set, it can never crown a game with zero votes.
export function tally(ballot = [], votes = []) {
  const base = {}
  ballot.forEach((g) => { base[g.id] = 0 })
  votes.forEach((v) => (v.ranking || []).forEach((id, i) => {
    if (base[id] != null) base[id] += [3, 2, 1][i] || 0
  }))
  const results = ballot.filter((g) => base[g.id] > 0).map((g) => {
    const d = playedDaysAgo(g)
    let fresh = 0, label = ''
    if (d == null || d >= 30) { fresh = 1.5; label = 'Dusty-shelf boost' }
    else if (d >= 14) { fresh = 0.5; label = 'A while ago' }
    else if (d <= 3) { fresh = -1; label = 'Just played' }
    return { id: g.id, game: g, base: base[g.id], fresh, score: Math.max(0, base[g.id] + fresh), label }
  })
  results.sort((a, b) => b.score - a.score || dust(b.game) - dust(a.game))
  return results
}

// Tiebreak helper: Captain of the Night rotates weekly among the people who voted.
// `weekOffset` lets callers preview future rotations (e.g. "next up: …").
export function captainFor(names = [], weekOffset = 0) {
  if (!names.length) return null
  const sorted = [...names].sort()
  const week = Math.floor(Date.now() / (7 * 86400000)) + weekOffset
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
    c.players ? `👥 ${c.players}${c.players >= 8 ? '+' : ''} playing` : '👥 Any # playing',
    c.maxTime ? `⏱ Under ${c.maxTime}m` : '⏱ Any length',
    c.loc === 'couch' ? '🛋 Couch' : c.loc === 'table' ? '🪑 Table' : '🛋🪑 Either',
    c.att === 'background' ? '👀 Half-watch' : c.att === 'focus' ? '🧠 All-in' : '🎯 Any focus',
  ]
}
