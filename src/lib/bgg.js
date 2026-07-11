// Client-side BoardGameGeek helper. Talks ONLY to our own Netlify function
// (netlify/functions/bgg.js) — never to BGG directly (the token stays server-side
// and BGG sends no CORS headers). During local dev this needs `netlify dev`
// (port 8888); plain `vite` on 5173 doesn't serve functions.
const ENDPOINT = '/.netlify/functions/bgg'

async function call(params) {
  let res
  try {
    res = await fetch(`${ENDPOINT}?${params}`)
  } catch {
    // Network-level failure: usually the function isn't being served locally.
    throw new Error('offline')
  }
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`)
  return data
}

// BGG's search lists fan-expansions and promos alongside base games with no
// popularity signal, so we re-rank: exact/prefix name matches first, expansions
// last, shorter names ahead of longer ones, newer before older on ties.
function rankResults(results, query) {
  const q = query.trim().toLowerCase()
  const isExpansion = (n) => /\b(expansion|promo|fan expansion|mini expansion)\b/i.test(n)
  return [...results]
    .map((r) => {
      const n = (r.name || '').toLowerCase()
      let score = 0
      if (n === q) score -= 100
      else if (n.startsWith(q)) score -= 40
      else if (n.includes(q)) score -= 10
      if (isExpansion(r.name)) score += 50
      score += n.length * 0.05
      return { r, score }
    })
    .sort((a, b) => a.score - b.score || (b.r.year || 0) - (a.r.year || 0))
    .map((x) => x.r)
}

export async function bggSearch(query) {
  const { results = [] } = await call(`op=search&q=${encodeURIComponent(query)}`)
  return rankResults(results, query)
}

export async function bggThing(bggId) {
  const { game } = await call(`op=thing&id=${encodeURIComponent(bggId)}`)
  return game
}

// The BGG-derived fields we persist on a game doc. `bggImage` is kept SEPARATE
// from `image` so a (re-)sync never clobbers curated/uploaded art — coverImageFor
// prefers `image`, then falls back to `bggImage`. Single source of truth, shared by
// the Add/Edit form (GameForm) and the backfill tool.
export const BGG_META_KEYS = ['bggId', 'bggImage', 'weight', 'rating', 'rank', 'minAge',
  'description', 'year', 'categories', 'mechanics', 'bestPlayers', 'recommendedPlayers']

// Shape a freshly-fetched BGG "thing" into just those persisted metadata fields.
export function bggMetaFromThing(t) {
  return {
    bggId: t.bggId, bggImage: t.image || null,
    weight: t.weight ?? null, rating: t.rating ?? null, rank: t.rank ?? null,
    minAge: t.minAge ?? null, description: t.description || '', year: t.year ?? null,
    categories: t.categories || [], mechanics: t.mechanics || [],
    bestPlayers: t.bestPlayers ?? null, recommendedPlayers: t.recommendedPlayers || [],
  }
}
