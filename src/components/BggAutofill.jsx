import { useEffect, useRef, useState } from 'react'
import { bggSearch, bggThing } from '../lib/bgg.js'

// Turn any error from the BGG helper into friendly guidance.
function friendly(e) {
  const m = String(e?.message || '')
  if (m === 'offline' || /Failed to fetch|404/i.test(m)) {
    return 'Couldn’t reach BoardGameGeek. If you’re running locally, start the app with `netlify dev` (not `npm run dev`).'
  }
  return m || 'Something went wrong searching BoardGameGeek.'
}

// A debounced BGG search box. On pick, fetches full game details and hands them
// to the parent via onPick(thing); the parent decides which fields to apply
// (see GameForm, which protects curated cover art).
export default function BggAutofill({ onPick, label = 'Auto-fill from BoardGameGeek' }) {
  const [q, setQ] = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [busyId, setBusyId] = useState(null)
  const [error, setError] = useState('')
  const [picked, setPicked] = useState(null)
  const reqRef = useRef(0)

  useEffect(() => {
    const query = q.trim()
    if (query.length < 2) { setResults([]); setError(''); setSearching(false); return }
    const myReq = ++reqRef.current
    setSearching(true)
    const t = setTimeout(async () => {
      try {
        const r = await bggSearch(query)
        if (reqRef.current === myReq) { setResults(r.slice(0, 10)); setError('') }
      } catch (e) {
        if (reqRef.current === myReq) { setResults([]); setError(friendly(e)) }
      } finally {
        if (reqRef.current === myReq) setSearching(false)
      }
    }, 400)
    return () => clearTimeout(t)
  }, [q])

  async function choose(r) {
    setBusyId(r.bggId); setError('')
    try {
      const thing = await bggThing(r.bggId)
      onPick(thing)
      setPicked(thing)
      setResults([]); setQ(''); reqRef.current++ // cancel any in-flight search
    } catch (e) {
      setError(friendly(e))
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="field bgg-autofill">
      <label htmlFor="bgg-q">{label}</label>
      <input
        id="bgg-q" type="text" autoComplete="off"
        placeholder="Search BoardGameGeek by name…"
        value={q}
        onChange={(e) => { setQ(e.target.value); setPicked(null) }}
      />

      {searching && <span className="hint">Searching BoardGameGeek…</span>}

      {results.length > 0 && (
        <ul className="bgg-results">
          {results.map((r) => (
            <li key={r.bggId}>
              <button type="button" disabled={busyId != null} onClick={() => choose(r)}>
                <span className="bgg-name">{r.name}</span>
                <span className="bgg-year">
                  {busyId === r.bggId ? 'Loading…' : r.year || ''}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {picked && (
        <div className="bgg-picked">
          {picked.thumbnail && <img src={picked.thumbnail} alt="" />}
          <span>
            ✓ Filled from <strong>{picked.name}</strong>
            {picked.year ? ` (${picked.year})` : ''}. Review the fields below before saving.
          </span>
        </div>
      )}

      {error && <span className="hint warn">{error}</span>}
      {!searching && !results.length && !error && !picked && (
        <span className="hint">Fills players, time, complexity, box art & more. You can still edit everything.</span>
      )}
    </div>
  )
}
