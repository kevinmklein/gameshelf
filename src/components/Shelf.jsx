import { useEffect, useMemo, useState } from 'react'
import { deleteGame, updateGame, playedDaysAgo, coverImageFor } from '../lib/catalog.js'
import GameForm from './GameForm.jsx'

const agoLabel = (d) =>
  d === 0 ? 'today' : d === 1 ? 'yesterday' : d < 30 ? `${d} days ago`
    : d < 60 ? 'about a month ago' : `${Math.round(d / 30)} months ago`

const locGlyph = (l) => (l === 'couch' ? '🛋' : l === 'table' ? '🪑' : '🛋🪑')
const locLabel = (l) => (l === 'couch' ? 'Couch-friendly' : l === 'table' ? 'Needs a table' : 'Table or couch')
const attLabel = (a) =>
  a === 'background' ? 'Background-OK' : a === 'focus' ? 'Needs focus' : 'Light focus'

function GameBox({ g, onOpen }) {
  const cover = g.cover || { c1: '#3a3a3a', c2: '#222' }
  const img = coverImageFor(g)
  const [broken, setBroken] = useState(false)
  const showImg = img && !broken
  return (
    <div className="board">
      <button
        className={`gbox${showImg ? ' hasimg' : ''}`}
        onClick={() => onOpen(g)}
        aria-label={`${g.name} — view details`}
        style={{ background: `linear-gradient(150deg, ${cover.c1}, ${cover.c2})` }}
      >
        {showImg
          ? <img className="gbox-img" src={img} alt={g.name} loading="lazy" onError={() => setBroken(true)} />
          : (
            <div className="art">
              <div className="kind">{g.kind || 'Game'}</div>
              <div className="name">{g.name}</div>
            </div>
          )}
        <div className="plate">
          {g.time ? <span className="tnum">{g.time}m</span> : null}
          {g.time && g.players ? <span className="dot" /> : null}
          {g.players ? <span>{g.players}</span> : null}
          <span className="dot" />
          <span>{locGlyph(g.loc)}</span>
        </div>
      </button>
    </div>
  )
}

function GameDetail({ g, onClose }) {
  const [editing, setEditing] = useState(false)
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') { editing ? setEditing(false) : onClose() } }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, editing])

  const cover = g.cover || { c1: '#3a3a3a', c2: '#222' }
  const heroImg = coverImageFor(g)
  const heroStyle = heroImg
    ? { backgroundImage: `url(${heroImg})`, backgroundSize: 'cover', backgroundPosition: 'center' }
    : { background: `linear-gradient(150deg, ${cover.c1}, ${cover.c2})` }
  const spec = (k, v) => (v ? <div className="spec"><div className="k">{k}</div><div className="v">{v}</div></div> : null)

  if (editing) {
    return (
      <div className="scrim" onClick={(e) => { if (e.target === e.currentTarget) setEditing(false) }}>
        <div className="modal" role="dialog" aria-modal="true" aria-label={`Edit ${g.name}`}>
          <div className="hero" style={{ background: `linear-gradient(150deg, ${cover.c1}, ${cover.c2})` }}>
            <button className="x" onClick={() => setEditing(false)} aria-label="Cancel">✕</button>
            <div className="kind">Editing</div>
            <h3>{g.name}</h3>
          </div>
          <div className="body">
            <GameForm
              mode="edit" initial={g}
              onSubmitCore={(core) => updateGame(g.id, core)}
              onDone={onClose}
              onCancel={() => setEditing(false)}
            />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="scrim" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={g.name}>
        <div className={`hero${heroImg ? ' hasimg' : ''}`} style={heroStyle}>
          <button className="x" onClick={onClose} aria-label="Close">✕</button>
          <div className="kind">{g.kind || 'Game'}</div>
          <h3>{g.name}</h3>
        </div>
        <div className="body">
          <div className="specs">
            {spec('Play time', g.time ? `${g.time} min` : null)}
            {spec('Players', g.players)}
            {spec('Where', locLabel(g.loc))}
            {spec('Attention', attLabel(g.att))}
            {g.setup && (
              <div className="spec"><div className="k">Setup</div>
                <div className="v" style={{ textTransform: 'capitalize' }}>{g.setup}</div></div>
            )}
          </div>
          <div className="tags">
            {g.kind && <span className="tag">{g.kind}</span>}
            {g.source === 'manual' && <span className="tag">Hand-entered</span>}
          </div>
          <div className="played">
            {(() => {
              const d = playedDaysAgo(g)
              return d == null
                ? 'Never played yet — a fresh face on the shelf.'
                : <>Last played <b>{agoLabel(d)}</b></>
            })()}
            {g.plays ? <> · played <b className="tnum">{g.plays}×</b> all-time</> : null}
          </div>
          <div className="modal-foot">
            <button className="del-link" onClick={() => {
              if (confirm(`Remove "${g.name}" from the shelf?`)) { deleteGame(g.id); onClose() }
            }}>Remove from shelf</button>
            <div className="foot-right">
              <button className="btn ghost" onClick={() => setEditing(true)}>Edit</button>
              <button className="btn ghost" onClick={onClose}>Close</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

const NO_FILTERS = { players: '', loc: '', time: '', kind: '' }

// Does a game seat exactly `n` players? Lenient when a bound is missing.
function seatsPlayers(g, n) {
  const min = g.minPlayers, max = g.maxPlayers
  if (min != null && n < min) return false
  if (max != null && n > max) return false
  return true
}

function FilterBar({ f, setF, kinds, active, onClear }) {
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }))
  return (
    <div className="filterbar">
      <label className="filt">
        <span>Players</span>
        <select value={f.players} onChange={set('players')}>
          <option value="">Any</option>
          {[2, 3, 4, 5, 6, 7, 8].map((n) => <option key={n} value={n}>{n === 8 ? '8+' : n}</option>)}
        </select>
      </label>
      <label className="filt">
        <span>Where</span>
        <select value={f.loc} onChange={set('loc')}>
          <option value="">Anywhere</option>
          <option value="couch">🛋 Couch</option>
          <option value="table">🪑 Table</option>
        </select>
      </label>
      <label className="filt">
        <span>Length</span>
        <select value={f.time} onChange={set('time')}>
          <option value="">Any</option>
          <option value="15">Under 15m</option>
          <option value="30">Under 30m</option>
          <option value="60">Under 60m</option>
        </select>
      </label>
      <label className="filt">
        <span>Type</span>
        <select value={f.kind} onChange={set('kind')}>
          <option value="">All</option>
          {kinds.map((k) => <option key={k} value={k}>{k}</option>)}
        </select>
      </label>
      {active > 0 && (
        <button type="button" className="clear-filters" onClick={onClear}>Clear ✕</button>
      )}
    </div>
  )
}

export default function Shelf({ games, onAdd }) {
  const [q, setQ] = useState('')
  const [f, setF] = useState(NO_FILTERS)
  const [selected, setSelected] = useState(null)

  const kinds = useMemo(
    () => [...new Set(games.map((g) => g.kind).filter(Boolean))].sort(),
    [games],
  )
  const activeCount = Object.values(f).filter(Boolean).length

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase()
    return games.filter((g) => {
      if (s && !g.name.toLowerCase().includes(s)) return false
      if (f.players && !seatsPlayers(g, Number(f.players))) return false
      if (f.loc === 'couch' && g.loc === 'table') return false
      if (f.loc === 'table' && g.loc === 'couch') return false
      if (f.time && !(g.time && g.time <= Number(f.time))) return false
      if (f.kind && g.kind !== f.kind) return false
      return true
    })
  }, [games, q, f])

  return (
    <section className="tab">
      <div className="h-row">
        <div>
          <div className="eyebrow">Browse the collection</div>
          <h2 className="big">
            The Shelf <span className="count tnum">· {filtered.length} game{filtered.length === 1 ? '' : 's'}</span>
          </h2>
        </div>
        {games.length > 0 && (
          <div className="search-wrap">
            <span className="search-ic" aria-hidden="true">🔍</span>
            <input
              className="search" type="text" placeholder="Search the shelf…"
              value={q} onChange={(e) => setQ(e.target.value)}
            />
          </div>
        )}
      </div>

      {games.length > 0 && (
        <FilterBar f={f} setF={setF} kinds={kinds} active={activeCount}
          onClear={() => setF(NO_FILTERS)} />
      )}

      {games.length === 0 ? (
        <div className="empty">
          <h3>Your shelf is empty</h3>
          <p>Add your first game and it'll appear here as a box on the shelf.</p>
          <button className="btn brass" style={{ marginTop: 14 }} onClick={onAdd}>＋ Add a game</button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty">
          <p>No games match {q ? `“${q}”` : 'those filters'}.</p>
          {(activeCount > 0 || q) && (
            <button className="btn ghost" style={{ marginTop: 12 }}
              onClick={() => { setF(NO_FILTERS); setQ('') }}>Clear search & filters</button>
          )}
        </div>
      ) : (
        <div className="shelf">
          {filtered.map((g) => <GameBox key={g.id} g={g} onOpen={setSelected} />)}
        </div>
      )}

      {selected && <GameDetail g={selected} onClose={() => setSelected(null)} />}
    </section>
  )
}
