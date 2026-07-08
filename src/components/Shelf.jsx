import { useMemo, useState } from 'react'
import { deleteGame } from '../lib/catalog.js'

const locGlyph = (l) => (l === 'couch' ? '🛋' : l === 'table' ? '🪑' : '🛋🪑')

function GameBox({ g }) {
  const cover = g.cover || { c1: '#3a3a3a', c2: '#222' }
  return (
    <div className="board">
      <div className="gbox" style={{ background: `linear-gradient(150deg, ${cover.c1}, ${cover.c2})` }}>
        <button
          className="del"
          title={`Remove ${g.name}`}
          aria-label={`Remove ${g.name}`}
          onClick={() => { if (confirm(`Remove "${g.name}" from the shelf?`)) deleteGame(g.id) }}
        >✕</button>
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
      </div>
    </div>
  )
}

export default function Shelf({ games, onAdd }) {
  const [q, setQ] = useState('')
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
          <input
            type="text"
            placeholder="Search the shelf…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            style={{ maxWidth: 220 }}
          />
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
          {filtered.map((g) => <GameBox key={g.id} g={g} />)}
        </div>
      )}
    </section>
  )
}
