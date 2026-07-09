import { useEffect, useState } from 'react'
import { subscribeGames, subscribePlays, getUid } from './lib/catalog.js'
import { ensureAuth } from './lib/firebase.js'
import Shelf from './components/Shelf.jsx'
import AddGame from './components/AddGame.jsx'
import Stats from './components/Stats.jsx'
import GameNight from './components/GameNight.jsx'
import Join from './components/Join.jsx'

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
  return m ? { name: 'join', code: m[1].toUpperCase() } : { name: 'home' }
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

  const tabs = [
    ['shelf', 'Our Shelf'],
    ['night', 'Game Time'],
    ['stats', 'Play Stats'],
    ['add', 'Add a Game'],
  ]

  const joining = route.name === 'join'

  return (
    <>
      <header className="top">
        <div className="brand">
          <img className="brand-logo" src="/brand/logo.png" alt="Game Shelf" />
          <div className="sub">The Klein family collection · Thursday Game Night HQ</div>
        </div>
        {!joining && (
          <nav className="tabs" role="tablist">
            {tabs.map(([id, label]) => (
              <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)}>
                {label}
              </button>
            ))}
          </nav>
        )}
      </header>

      <div className="wrap">
        {joining ? (
          uid ? <Join code={route.code} uid={uid} />
              : <section className="tab"><div className="soon">Connecting…</div></section>
        ) : (
          <>
            {tab === 'shelf' && <Shelf games={games} onAdd={() => setTab('add')} />}
            {tab === 'add' && <AddGame onDone={() => setTab('shelf')} />}
            {tab === 'night' && <GameNight games={games} uid={uid} />}
            {tab === 'stats' && <Stats games={games} plays={plays} />}
          </>
        )}
      </div>
    </>
  )
}
