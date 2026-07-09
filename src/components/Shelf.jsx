import { useEffect, useMemo, useState } from 'react'
import { deleteGame, playedDaysAgo } from '../lib/catalog.js'

const agoLabel = (d) =>
  d === 0 ? 'today' : d === 1 ? 'yesterday' : d < 30 ? `${d} days ago`
    : d < 60 ? 'about a month ago' : `${Math.round(d / 30)} months ago`

const locGlyph = (l) => (l === 'couch' ? '🛋' : l === 'table' ? '🪑' : '🛋🪑')
const locLabel = (l) => (l === 'couch' ? 'Couch-friendly' : l === 'table' ? 'Needs a table' : 'Table or couch')
const attLabel = (a) =>
  a === 'background' ? 'Background-OK' : a === 'focus' ? 'Needs focus' : 'Light focus'

function GameBox({ g, onOpen }) {
  const cover = g.cover || { c1: '#3a3a3a', c2: '#222' }
  return (
    <div className="board">
      <button
        className="gbox"
        onClick={() => onOpen(g)}
        aria-label={`${g.name} — view details`}
        style={{ background: `linear-gradient(150deg, ${cover.c1}, ${cover.c2})` }}
      >
        <div className="art">
          <div className="kind">{g.kind || 'Game'}</div>
          <div className="name">{g.name}</div>
        </div>
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
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const cover = g.cover || { c1: '#3a3a3a', c2: '#222' }
  const spec = (k, v) => (v ? <div className="spec"><div className="k">{k}</div><div className="v">{v}</div></div> : null)

  return (
    <div className="scrim" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={g.name}>
        <div className="hero" style={{ background: `linear-gradient(150deg, ${cover.c1}, ${cover.c2})` }}>
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
            <button className="btn ghost" onClick={onClose}>Close</button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function Shelf({ games, onAdd }) {
  const [q, setQ] = useState('')
  const [selected, setSelected] = useState(null)

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase()
    return s ? games.filter((g) => g.name.toLowerCase().includes(s)) : games
  }, [games, q])

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

      {games.length === 0 ? (
        <div className="empty">
          <h3>Your shelf is empty</h3>
          <p>Add your first game and it'll appear here as a box on the shelf.</p>
          <button className="btn brass" style={{ marginTop: 14 }} onClick={onAdd}>＋ Add a game</button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty"><p>No games match “{q}”.</p></div>
      ) : (
        <div className="shelf">
          {filtered.map((g) => <GameBox key={g.id} g={g} onOpen={setSelected} />)}
        </div>
      )}

      {selected && <GameDetail g={selected} onClose={() => setSelected(null)} />}
    </section>
  )
}
