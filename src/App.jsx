import { useEffect, useState } from 'react'
import { subscribeGames, subscribePlays, getUid } from './lib/catalog.js'
import { ensureAuth } from './lib/firebase.js'
import Shelf from './components/Shelf.jsx'
import AddGame from './components/AddGame.jsx'
import Stats from './components/Stats.jsx'
import GameNight from './components/GameNight.jsx'
import Join from './components/Join.jsx'
import Backfill from './components/Backfill.jsx'
import PullToRefresh from './components/PullToRefresh.jsx'

// Tiny hash router. `#/join/CODE` opens the voter view (shared link/QR target);
// everything else is the normal tabbed app.
function useRoute() {
  const [hash, setHash] = useState(() => window.location.hash)
  useEffect(() => {
    const on = () => setHash(window.location.hash)
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])
  const m = hash.match(/^#\/join\/([A-Za-z0-9-]+)/)
  if (m) return { name: 'join', code: m[1].toUpperCase() }
  if (/^#\/backfill/.test(hash)) return { name: 'backfill' }
  return { name: 'home' }
}

export default function App() {
  const [tab, setTab] = useState('shelf')
  const [games, setGames] = useState([])
  const [plays, setPlays] = useState([])
  const [uid, setUid] = useState(null)
  const route = useRoute()

  useEffect(() => {
    let unsubGames = () => {}
    let unsubPlays = () => {}
    let cancelled = false
    ensureAuth().then((user) => {
      if (cancelled) return
      setUid(getUid(user))
      unsubGames = subscribeGames(setGames)
      unsubPlays = subscribePlays(setPlays)
    })
    return () => { cancelled = true; unsubGames(); unsubPlays() }
  }, [])

  // 'add' is intentionally NOT a top-level tab — it's an occasional-use sub-view
  // reached from the Shelf's add button and a button at the bottom of Play Stats,
  // so the three headline features own the nav.
  const tabs = [
    ['shelf', 'Our Shelf'],
    ['night', 'Game Time'],
    ['stats', 'Play Stats'],
  ]

  const joining = route.name === 'join'
  const backfilling = route.name === 'backfill'

  return (
    <>
      <header className="top">
        <div className="brand">
          <button type="button" className="brand-home"
            onClick={() => { window.location.hash = ''; setTab('shelf') }}
            aria-label="Go to Our Shelf">
            <img className="brand-logo" src="/brand/logo.png" alt="Game Shelf" />
          </button>
          <div className="sub">The Klein family collection · Thursday Game Night HQ</div>
        </div>
        <nav className="tabs" role="tablist">
          {tabs.map(([id, label]) => (
            <button key={id} role="tab" data-tab={id} aria-selected={!joining && !backfilling && tab === id}
              onClick={() => { if (joining || backfilling) window.location.hash = ''; setTab(id) }}>
              {label}
            </button>
          ))}
        </nav>
      </header>

      <div className="wrap" data-section={joining ? 'join' : backfilling ? 'shelf' : tab}>
        {joining ? (
          uid ? <Join code={route.code} uid={uid} />
              : <section className="tab"><div className="soon">Connecting…</div></section>
        ) : backfilling ? (
          uid ? <Backfill />
              : <section className="tab"><div className="soon">Connecting…</div></section>
        ) : (
          <>
            {tab === 'shelf' && (
              <PullToRefresh><Shelf games={games} onAdd={() => setTab('add')} /></PullToRefresh>
            )}
            {tab === 'add' && <AddGame onDone={() => setTab('shelf')} />}
            {tab === 'night' && <GameNight games={games} uid={uid} />}
            {tab === 'stats' && <Stats games={games} plays={plays} onAddGame={() => setTab('add')} />}
          </>
        )}
      </div>
    </>
  )
}
