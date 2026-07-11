// BoardGameGeek proxy — the ONLY place the BGG API token is used.
//
// Why a proxy at all:
//   1. Secrecy — the bearer token is read from process.env server-side and never
//      reaches the browser (unlike VITE_* vars, which Vite inlines into the public
//      bundle). It must NOT be prefixed VITE_.
//   2. CORS — BGG sends no CORS headers, so the browser can't call it directly.
//   3. Shape — BGG speaks XML; we parse it here and hand the client clean JSON.
//
// BGG now requires `Authorization: Bearer <token>` on every request. An authorized
// request is allowed from any IP (including this Lambda), which is why the proxy
// works even though anonymous datacenter traffic is blocked.
//
// Endpoints (Netlify v2 function, default path /.netlify/functions/bgg):
//   ?op=search&q=carcassonne  → { results: [{ bggId, name, year }] }
//   ?op=thing&id=822          → { game: { …normalized fields… } }
import { XMLParser } from 'fast-xml-parser'

const BASE = 'https://boardgamegeek.com/xmlapi2'

// Force the repeatable BGG elements to always parse as arrays, so downstream code
// never has to special-case "one child vs. many".
const REPEATABLE = ['item', 'name', 'link', 'results', 'result', 'rank', 'poll']
const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '',
  htmlEntities: true,
  // Only force ELEMENTS to arrays — not attributes. Both <name> elements and the
  // name="…" attribute on <poll>/<rank> share the key "name"; arrayifying the
  // attribute too would break the `.name === '…'` lookups below.
  isArray: (name, _jpath, _leaf, isAttribute) => !isAttribute && REPEATABLE.includes(name),
})

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status }
}

// Fetch a BGG path with the bearer token. BGG answers 202 ("queued, retry shortly")
// when a result isn't ready yet, so we poll a few times before giving up.
async function bggFetch(path, token) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(`${BASE}${path}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'text/xml' },
    })
    if (res.status === 202) { await sleep(1200); continue }
    if (res.status === 401 || res.status === 403) {
      throw new HttpError(502, 'BGG rejected the API token (check BGG_API_TOKEN).')
    }
    if (!res.ok) throw new HttpError(502, `BGG returned HTTP ${res.status}.`)
    return res.text()
  }
  throw new HttpError(504, 'BGG kept the request queued; please try again.')
}

// ---- XML → JSON normalizers ----
const numOf = (node) => (node && node.value != null && node.value !== '' ? Number(node.value) : null)

function primaryName(item) {
  const names = item.name || []
  return (names.find((n) => n.type === 'primary') || names[0])?.value || ''
}

// Strip leftover HTML tags and collapse whitespace from BGG's description blob.
function cleanText(s) {
  if (!s || typeof s !== 'string') return ''
  return s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

function linkValues(item, type) {
  return (item.link || []).filter((l) => l.type === type).map((l) => l.value)
}

// From the "suggested_numplayers" community poll, derive the single best count and
// the set of counts the community recommends (best + recommended outweigh "not").
function playerCounts(item) {
  const poll = (item.poll || []).find((p) => p.name === 'suggested_numplayers')
  if (!poll) return { best: null, recommended: [] }
  let best = null, bestVotes = 0
  const recommended = []
  for (const r of poll.results || []) {
    const v = Object.fromEntries((r.result || []).map((x) => [x.value, Number(x.numvotes) || 0]))
    const b = v['Best'] || 0, rec = v['Recommended'] || 0, no = v['Not Recommended'] || 0
    if (b > bestVotes) { bestVotes = b; best = r.numplayers }
    if (b + rec > no && b + rec > 0) recommended.push(r.numplayers)
  }
  return { best, recommended }
}

function parseThing(xml) {
  const items = parser.parse(xml)?.items?.item
  const item = Array.isArray(items) ? items[0] : items
  if (!item) return null
  const stats = item.statistics?.ratings || {}
  const ranks = stats.ranks?.rank || []
  const overall = ranks.find((r) => r.name === 'boardgame')
  const { best, recommended } = playerCounts(item)
  const weight = numOf(stats.averageweight)
  const rating = numOf(stats.bayesaverage) // BGG's "Geek Rating"
  return {
    bggId: String(item.id),
    name: primaryName(item),
    year: numOf(item.yearpublished),
    image: item.image || null,
    thumbnail: item.thumbnail || null,
    description: cleanText(item.description),
    minPlayers: numOf(item.minplayers),
    maxPlayers: numOf(item.maxplayers),
    playingTime: numOf(item.playingtime),
    minPlaytime: numOf(item.minplaytime),
    maxPlaytime: numOf(item.maxplaytime),
    minAge: numOf(item.minage),
    weight: weight != null ? Math.round(weight * 100) / 100 : null,
    rating: rating != null ? Math.round(rating * 10) / 10 : null,
    rank: overall && /^\d+$/.test(String(overall.value)) ? Number(overall.value) : null,
    categories: linkValues(item, 'boardgamecategory'),
    mechanics: linkValues(item, 'boardgamemechanic'),
    designers: linkValues(item, 'boardgamedesigner'),
    publishers: linkValues(item, 'boardgamepublisher'),
    bestPlayers: best,
    recommendedPlayers: recommended,
  }
}

function parseSearch(xml) {
  const items = parser.parse(xml)?.items?.item || []
  const seen = new Set()
  const out = []
  for (const it of items) {
    const bggId = String(it.id)
    if (seen.has(bggId)) continue // search can list a game once per matching name
    seen.add(bggId)
    out.push({ bggId, name: primaryName(it), year: numOf(it.yearpublished) })
  }
  return out
}

// ---- Netlify v2 handler ----
function json(body, status = 200, cache = 'no-store') {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': cache },
  })
}

export default async (req) => {
  const token = process.env.BGG_API_TOKEN
  if (!token) return json({ error: 'BGG_API_TOKEN is not configured on the server.' }, 500)

  const { searchParams } = new URL(req.url)
  const op = searchParams.get('op')
  try {
    if (op === 'search') {
      const q = (searchParams.get('q') || '').trim()
      if (!q) return json({ error: 'Missing search query (q).' }, 400)
      const xml = await bggFetch(`/search?type=boardgame&query=${encodeURIComponent(q)}`, token)
      return json({ results: parseSearch(xml) }, 200, 'public, max-age=3600')
    }
    if (op === 'thing') {
      const id = (searchParams.get('id') || '').trim()
      if (!/^\d+$/.test(id)) return json({ error: 'Missing or invalid game id.' }, 400)
      const xml = await bggFetch(`/thing?stats=1&id=${id}`, token)
      const game = parseThing(xml)
      if (!game) return json({ error: 'Game not found on BGG.' }, 404)
      // Game details rarely change — let the browser cache them for a day.
      return json({ game }, 200, 'public, max-age=86400')
    }
    return json({ error: 'Unknown op — use ?op=search or ?op=thing.' }, 400)
  } catch (e) {
    return json({ error: e.message || 'BGG request failed.' }, e.status || 502)
  }
}

// Exported for local unit-testing of the parsers (Netlify ignores extra exports).
export { parseThing, parseSearch }
