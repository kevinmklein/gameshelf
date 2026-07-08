import { useEffect, useState } from 'react'
import { subscribeGames, hasFirebase } from './lib/catalog.js'
import { ensureAuth } from './lib/firebase.js'
import Shelf from './components/Shelf.jsx'
import AddGame from './components/AddGame.jsx'

const Meeple = ({ size = 26, fill = '#e0aa4c' }) => (
  <svg className="meeple" width={size} height={size} viewBox="0 0 24 24" fill={fill} aria-hidden="true">
    <path d="M12 2a3 3 0 0 0-3 3c0 1 .5 1.8 1.2 2.4C8.8 8.2 7 9.6 7 12v1l-3 1v3l4-1v6h8v-6l4 1v-3l-3-1v-1c0-2.4-1.8-3.8-3.2-4.6C13.5 6.8 14 6 14 5a3 3 0 0 0-2-3z" />
  </svg>
)

export default function App() {
  const [tab, setTab] = useState('shelf')
  const [games, setGames] = useState([])
  const [theme, setTheme] = useState(null) // null = follow OS

  useEffect(() => {
    let unsub = () => {}
    let cancelled = false
    ensureAuth().then(() => { if (!cancelled) unsub = subscribeGames(setGames) })
    return () => { cancelled = true; unsub() }
  }, [])

  const dark =
    theme === 'dark' ||
    (theme === null && window.matchMedia('(prefers-color-scheme: dark)').matches)
  useEffect(() => {
    if (theme) document.documentElement.dataset.theme = theme
    else delete document.documentElement.dataset.theme
  }, [theme])

  const tabs = [
    ['shelf', 'The Shelf'],
    ['add', 'Add a Game'],
    ['night', 'Game Night'],
    ['stats', 'Stats'],
  ]

  return (
    <>
      <header className="top">
        <div className="brand">
          <div>
            <h1><Meeple /> Game Shelf</h1>
            <div className="sub">The Klein family collection · Thursday Game Night HQ</div>
          </div>
          <div className="hdr-right">
            <span
              className={`badge ${hasFirebase ? 'cloud' : 'local'}`}
              title={hasFirebase
                ? 'Saved to the cloud and shared across everyone’s devices.'
                : 'Saved only in this browser (no cloud config found).'}
            >
              {hasFirebase ? '☁ Cloud synced' : '💾 On this device'}
            </span>
            <button className="theme-btn" onClick={() => setTheme(dark ? 'light' : 'dark')}>
              {dark ? '☀️ Daylight' : '🌙 Evening'}
            </button>
          </div>
        </div>
        <nav className="tabs" role="tablist">
          {tabs.map(([id, label]) => (
            <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)}>
              {label}
            </button>
          ))}
        </nav>
      </header>

      <div className="wrap">
        {tab === 'shelf' && <Shelf games={games} onAdd={() => setTab('add')} />}
        {tab === 'add' && <AddGame onDone={() => setTab('shelf')} />}
        {tab === 'night' && (
          <section className="tab">
            <div className="eyebrow">The main event</div>
            <h2 className="big">Game Night</h2>
            <div className="soon">
              The voting engine lives in the <a href="/prototype/index.html">Phase 1 prototype</a> and
              gets wired to your real catalog once a few games are in. For now, add your collection on
              the <b>Add a Game</b> tab.
            </div>
          </section>
        )}
        {tab === 'stats' && (
          <section className="tab">
            <div className="eyebrow">Since we started tracking</div>
            <h2 className="big">Stats</h2>
            <div className="soon">Stats turn on once game nights are being logged. Coming next.</div>
          </section>
        )}
      </div>
    </>
  )
}
