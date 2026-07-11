import { useEffect, useRef, useState } from 'react'
import { subscribeGames, updateGame, coverImageFor, complexityLabel } from '../lib/catalog.js'
import { bggSearch, bggThing, bggMetaFromThing } from '../lib/bgg.js'

// One-time maintenance tool: match the games added before BGG auto-fill existed
// (they have no `bggId`) to BoardGameGeek and add the metadata that powers the new
// complexity / best-at-N filters + descriptions. Reviewable and NON-DESTRUCTIVE —
// it only writes the BGG_META fields (incl. a separate `bggImage`), so curated
// covers, names, tags, and hand-entered specs are never touched.

function friendly(e) {
  const m = String(e?.message || '')
  if (m === 'offline' || /Failed to fetch|404/i.test(m)) {
    return 'Couldn’t reach BoardGameGeek. Run the app with `netlify dev` (not `npm run dev`).'
  }
  return m || 'Something went wrong searching BoardGameGeek.'
}

// A compact preview of what a re-sync would add to a game.
function ProposedCard({ game, thing }) {
  const meta = bggMetaFromThing(thing)
  const rec = (thing.recommendedPlayers || []).join(', ')
  const row = (k, v) => (v ? <div className="bf-row"><span className="k">{k}</span><span className="v">{v}</span></div> : null)
  return (
    <div className="bf-proposed">
      {meta.bggImage && <img className="bf-thumb" src={thing.thumbnail || meta.bggImage} alt="" />}
      <div className="bf-fields">
        <div className="bf-matchname">
          {thing.name}{thing.year ? ` (${thing.year})` : ''}
          <span className="bf-id">BGG #{thing.bggId}</span>
        </div>
        {row('Complexity', complexityLabel(meta.weight) || '—')}
        {row('Best at', meta.bestPlayers ? `${meta.bestPlayers} players` : '—')}
        {row('Recommended', rec || '—')}
        {row('Geek rating', meta.rating ?? '—')}
        {row('Box art', meta.bggImage ? (coverImageFor(game) === game.image && game.image ? 'kept as fallback (curated art wins)' : 'will show') : '—')}
        {meta.description && <p className="bf-desc">{meta.description.slice(0, 220)}{meta.description.length > 220 ? '…' : ''}</p>}
      </div>
    </div>
  )
}

// Reached by direct link (#/backfill), so it subscribes to the catalog itself and
// freezes the pending list at load: games with no BGG link yet. Approvals write to
// Firestore (which would shrink a live-derived list mid-review), so we track each
// item's status locally and walk the stable frozen list instead.
export default function Backfill() {
  const [all, setAll] = useState(null)
  const [queue, setQueue] = useState(null) // frozen list of pending games
  const [idx, setIdx] = useState(0)
  const [status, setStatus] = useState({}) // gameId -> 'approved' | 'skipped'
  const [thing, setThing] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [manualQ, setManualQ] = useState('')
  const [results, setResults] = useState([])
  const reqRef = useRef(0)

  // Load the catalog once, then freeze the pending list.
  useEffect(() => {
    const unsub = subscribeGames((games) => {
      setAll(games)
      setQueue((q) => q ?? games.filter((g) => !g.bggId))
    })
    return unsub
  }, [])

  const current = queue && idx < queue.length ? queue[idx] : null

  // Auto-search + fetch the top match whenever we land on a new game.
  useEffect(() => {
    if (!current) return
    const myReq = ++reqRef.current
    setThing(null); setError(''); setResults([]); setManualQ(''); setLoading(true)
    ;(async () => {
      try {
        const found = await bggSearch(current.name)
        if (reqRef.current !== myReq) return
        if (!found.length) { setError('No BoardGameGeek match found — search manually or skip.'); setLoading(false); return }
        const t = await bggThing(found[0].bggId)
        if (reqRef.current !== myReq) return
        setThing(t)
      } catch (e) {
        if (reqRef.current === myReq) setError(friendly(e))
      } finally {
        if (reqRef.current === myReq) setLoading(false)
      }
    })()
  }, [current])

  async function pickManual(r) {
    const myReq = ++reqRef.current
    setLoading(true); setError(''); setResults([])
    try {
      const t = await bggThing(r.bggId)
      if (reqRef.current === myReq) setThing(t)
    } catch (e) {
      if (reqRef.current === myReq) setError(friendly(e))
    } finally {
      if (reqRef.current === myReq) setLoading(false)
    }
  }

  async function runManualSearch() {
    const q = manualQ.trim()
    if (q.length < 2) return
    const myReq = ++reqRef.current
    setLoading(true); setError('')
    try {
      const found = await bggSearch(q)
      if (reqRef.current === myReq) { setResults(found.slice(0, 8)); if (!found.length) setError('No results.') }
    } catch (e) {
      if (reqRef.current === myReq) setError(friendly(e))
    } finally {
      if (reqRef.current === myReq) setLoading(false)
    }
  }

  function advance(gameId, mark) {
    setStatus((s) => ({ ...s, [gameId]: mark }))
    setIdx((i) => i + 1)
  }

  async function approve() {
    if (!current || !thing || saving) return
    setSaving(true)
    try {
      await updateGame(current.id, bggMetaFromThing(thing)) // additive only
      advance(current.id, 'approved')
    } catch (e) {
      setError(friendly(e))
    } finally {
      setSaving(false)
    }
  }

  if (all === null || queue === null) {
    return <section className="tab"><div className="soon">Loading the shelf…</div></section>
  }

  const done = queue.filter((g) => status[g.id]).length
  const approved = queue.filter((g) => status[g.id] === 'approved').length
  const skipped = queue.filter((g) => status[g.id] === 'skipped').length

  return (
    <section className="tab bf">
      <div className="h-row">
        <div>
          <div className="eyebrow">Maintenance</div>
          <h2 className="big">Backfill BoardGameGeek data</h2>
        </div>
        <a className="btn ghost" href="#/" onClick={() => { window.location.hash = '' }}>← Back to app</a>
      </div>

      {queue.length === 0 ? (
        <div className="empty">
          <h3>Every game is already linked 🎉</h3>
          <p>All {all.length} games have BoardGameGeek data. Nothing to backfill.</p>
        </div>
      ) : !current ? (
        <div className="empty">
          <h3>All done</h3>
          <p><b>{approved}</b> updated · <b>{skipped}</b> skipped, out of {queue.length}.</p>
          <a className="btn brass" href="#/" style={{ marginTop: 14 }}
            onClick={() => { window.location.hash = '' }}>Back to the shelf</a>
        </div>
      ) : (
        <>
          <div className="bf-progress">
            Game <b>{idx + 1}</b> of <b>{queue.length}</b> · {approved} updated · {skipped} skipped
            <div className="bf-bar"><div className="bf-fill" style={{ width: `${(done / queue.length) * 100}%` }} /></div>
          </div>

          <div className="panel bf-current">
            <div className="bf-game">
              <div className="eyebrow">Your game</div>
              <h3 className="stat-h">{current.name}</h3>
              <div className="hint">{current.kind}{current.players ? ` · ${current.players}` : ''}{current.time ? ` · ${current.time}m` : ''}</div>
            </div>

            {loading && <div className="hint">Searching BoardGameGeek…</div>}
            {error && <div className="hint warn">{error}</div>}
            {thing && !loading && <ProposedCard game={current} thing={thing} />}

            <details className="bf-manual">
              <summary>Wrong match? Search manually</summary>
              <div className="guest-add" style={{ marginTop: 8 }}>
                <input type="text" placeholder="Search BoardGameGeek…" value={manualQ}
                  onChange={(e) => setManualQ(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); runManualSearch() } }} />
                <button type="button" className="btn ghost" onClick={runManualSearch} disabled={manualQ.trim().length < 2}>Search</button>
              </div>
              {results.length > 0 && (
                <ul className="bgg-results" style={{ marginTop: 8 }}>
                  {results.map((r) => (
                    <li key={r.bggId}>
                      <button type="button" onClick={() => pickManual(r)}>
                        <span className="bgg-name">{r.name}</span>
                        <span className="bgg-year">{r.year || ''}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </details>

            <div className="actions">
              <button className="btn brass" disabled={!thing || saving} onClick={approve}>
                {saving ? 'Saving…' : 'Approve & add →'}
              </button>
              <button className="btn ghost" disabled={saving} onClick={() => advance(current.id, 'skipped')}>Skip</button>
            </div>
            <p className="hint">Only adds BoardGameGeek fields (complexity, best-at, description, box art fallback). Your covers, tags, and specs are never changed.</p>
          </div>
        </>
      )}
    </section>
  )
}
