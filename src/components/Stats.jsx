import { useEffect, useMemo, useState } from 'react'
import { logPlay, playedDaysAgo, agoLabel, hasFirebase } from '../lib/catalog.js'
import { FAMILY, colorFor } from '../lib/family.js'
import { captainFor } from '../lib/night.js'
import { Avatar } from './gameNightBits.jsx'

const todayISO = () => new Date().toISOString().slice(0, 10)

function formatDur(min) {
  if (!min) return '0m'
  const h = Math.floor(min / 60)
  const m = min % 60
  return h ? (m ? `${h}h ${m}m` : `${h}h`) : `${m}m`
}

// Animate a number from 0 → target once (ease-out). Honors reduced-motion by
// jumping straight to the value. Used for the headline stat cards.
function useCountUp(target, duration = 900) {
  const [val, setVal] = useState(0)
  useEffect(() => {
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (reduce || !target) { setVal(target); return }
    let raf, start
    const tick = (t) => {
      if (!start) start = t
      const p = Math.min((t - start) / duration, 1)
      setVal(Math.round(target * (1 - Math.pow(1 - p, 3))))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, duration])
  return val
}

// ---- the "log a game night" form ----
function LogPlay({ games }) {
  const [gameId, setGameId] = useState('')
  const [date, setDate] = useState(todayISO())
  const [roster, setRoster] = useState(FAMILY)
  const [present, setPresent] = useState([])   // tap who actually played — nobody preselected
  const [winner, setWinner] = useState('')     // '' = co-op / no single winner
  const [minutes, setMinutes] = useState('')   // blank → falls back to the game's time
  const [guest, setGuest] = useState('')
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')

  const game = games.find((g) => g.id === gameId)
  const sorted = useMemo(() => [...games].sort((a, b) => a.name.localeCompare(b.name)), [games])
  const canSave = gameId && present.length > 0 && !saving

  function togglePresent(name) {
    setPresent((p) => {
      const next = p.includes(name) ? p.filter((n) => n !== name) : [...p, name]
      if (!next.includes(winner)) setWinner('')
      return next
    })
  }
  function addGuest() {
    const name = guest.trim()
    if (!name || roster.includes(name)) { setGuest(''); return }
    setRoster((r) => [...r, name])
    setPresent((p) => [...p, name])
    setGuest('')
  }

  async function save() {
    if (!canSave) return
    setSaving(true)
    await logPlay({
      gameId,
      gameName: game.name,
      players: present,
      winner: winner || null,
      minutes: Number(minutes) || game.time || null,
      playedAt: new Date(date + 'T12:00:00').getTime(),
    })
    setSaving(false)
    setToast(`Logged “${game.name}” 🎲`)
    setTimeout(() => setToast(''), 1900)
    // Reset for the next log, keeping the roster & date so back-to-back logs are quick.
    setGameId(''); setWinner(''); setMinutes(''); setPresent([])
  }

  return (
    <div className="panel">
      <div className="field">
        <label htmlFor="lg-game">What did you play?</label>
        <select id="lg-game" value={gameId} onChange={(e) => setGameId(e.target.value)}>
          <option value="">Pick a game from the shelf…</option>
          {sorted.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>
      </div>

      <div className="grid2">
        <div className="field">
          <label htmlFor="lg-date">When?</label>
          <input id="lg-date" type="date" max={todayISO()} value={date}
            onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="lg-min">How long? (minutes)</label>
          <input id="lg-min" type="number" min="1" max="600"
            placeholder={game?.time ? `${game.time} (typical)` : 'minutes'}
            value={minutes} onChange={(e) => setMinutes(e.target.value)} />
        </div>
      </div>

      <div className="field">
        <label>Who played?</label>
        <div className="chips">
          {roster.map((name) => (
            <button key={name} type="button" className="chip"
              aria-pressed={present.includes(name)} onClick={() => togglePresent(name)}>
              {name}
            </button>
          ))}
        </div>
        <div className="guest-add">
          <input type="text" placeholder="Add a guest…" value={guest}
            onChange={(e) => setGuest(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addGuest() } }} />
          <button type="button" className="btn ghost" onClick={addGuest} disabled={!guest.trim()}>
            ＋ Add
          </button>
        </div>
      </div>

      <div className="field">
        <label htmlFor="lg-win">Who won?</label>
        <select id="lg-win" value={winner} onChange={(e) => setWinner(e.target.value)}>
          <option value="">Co-op / no single winner</option>
          {present.map((name) => <option key={name} value={name}>{name}</option>)}
        </select>
      </div>

      <div className="actions">
        <button className="btn brass" disabled={!canSave} onClick={save}>
          {saving ? 'Logging…' : 'Log this Game Time'}
        </button>
        {!gameId && <span className="hint">Pick a game to log it.</span>}
      </div>

      {toast && <div className="toast">{toast}</div>}
      {!hasFirebase && (
        <p className="hint" style={{ marginTop: 12 }}>
          Saved on this device only — connect Firebase to share the log across everyone’s phones.
        </p>
      )}
    </div>
  )
}

// ---- the core-stats dashboard ----
function Dashboard({ games, plays }) {
  const s = useMemo(() => {
    const nights = plays.length
    const totalMin = plays.reduce((a, p) => a + (p.minutes || 0), 0)

    const wins = {}
    plays.forEach((p) => { if (p.winner) wins[p.winner] = (wins[p.winner] || 0) + 1 })
    const winRows = Object.entries(wins).sort((a, b) => b[1] - a[1])

    const counts = {}
    plays.forEach((p) => { const k = p.gameName; if (k) counts[k] = (counts[k] || 0) + 1 })
    const mostPlayed = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]

    const kindCounts = {}
    plays.forEach((p) => {
      const g = games.find((x) => x.id === p.gameId) || games.find((x) => x.name === p.gameName)
      if (g?.kind) kindCounts[g.kind] = (kindCounts[g.kind] || 0) + 1
    })
    const kindRows = Object.entries(kindCounts).sort((a, b) => b[1] - a[1])

    const dusty = [...games]
      .map((g) => ({ g, d: playedDaysAgo(g) }))
      .sort((a, b) => (b.d == null ? 1e9 : b.d) - (a.d == null ? 1e9 : a.d))
      .slice(0, 3)

    return { nights, totalMin, winRows, mostPlayed, kindRows, dusty }
  }, [games, plays])

  const nightsCount = useCountUp(s.nights)
  const minutesCount = useCountUp(s.totalMin)
  const maxWins = s.winRows[0]?.[1] || 1
  const maxKind = s.kindRows[0]?.[1] || 1
  const captain = useMemo(() => captainFor(FAMILY), [])
  const nextCaptain = useMemo(() => captainFor(FAMILY, 1), [])

  return (
    <>
      <div className="statgrid">
        <div className="statcard">
          <div className="num tnum">{nightsCount}</div>
          <div className="lbl">Game Times logged</div>
        </div>
        <div className="statcard">
          <div className="num tnum">{formatDur(minutesCount)}</div>
          <div className="lbl">Time at the table</div>
        </div>
        <div className="statcard">
          <div className="num">{s.mostPlayed ? s.mostPlayed[0] : '—'}</div>
          <div className="lbl">Most played{s.mostPlayed ? ` · ${s.mostPlayed[1]}×` : ''}</div>
        </div>
      </div>

      {captain && (
        <div className="panel">
          <div className="eyebrow">Tie-break power</div>
          <h3 className="stat-h">🧢 Captain of the Night</h3>
          <p className="hint" style={{ marginTop: 0 }}>
            Rotates weekly through the family, alphabetically — when Game Time’s top two
            picks are a photo finish, the Captain’s call breaks the tie.
          </p>
          <div className="captain-row">
            <Avatar color={colorFor(captain)} size={40} />
            <div>
              <div className="cap-name">{captain}</div>
              <div className="cap-next">Next up: {nextCaptain}</div>
            </div>
          </div>
        </div>
      )}

      {s.kindRows.length > 0 && (
        <div className="panel">
          <div className="eyebrow">By category</div>
          <h3 className="stat-h">🎲 Game Types Played</h3>
          <div className="lb">
            {s.kindRows.map(([kind, n]) => (
              <div className="lbrow" key={kind}>
                <div className="lbname">{kind}</div>
                <div className="lbbar-wrap">
                  <div className="lbbar" style={{ width: `${Math.round((n / maxKind) * 100)}%` }} />
                </div>
                <div className="lbval tnum">{n}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid2" style={{ marginTop: 18 }}>
        <div className="panel" style={{ marginTop: 0 }}>
          <div className="eyebrow">Family leaderboard</div>
          <h3 className="stat-h">Wins per person</h3>
          {s.winRows.length === 0 ? (
            <p className="hint">No wins recorded yet — log a Game Time with a winner.</p>
          ) : (
            <div className="lb">
              {s.winRows.map(([name, n], i) => (
                <div className={`lbrow${i === 0 ? ' lead' : ''}`} key={name}>
                  <div className="lbname">{i === 0 ? '👑 ' : ''}{name}</div>
                  <div className="lbbar-wrap">
                    <div className="lbbar" style={{ width: `${Math.round((n / maxWins) * 100)}%` }} />
                  </div>
                  <div className="lbval tnum">{n}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="panel" style={{ marginTop: 0 }}>
          <div className="eyebrow">Anti-rut radar</div>
          <h3 className="stat-h">🕸 Dusty Shelf</h3>
          <p className="hint" style={{ marginTop: 0 }}>Longest without a play — pull one out next time.</p>
          <div className="lb">
            {s.dusty.map(({ g, d }) => (
              <div className="dustrow" key={g.id}>
                <div className="lbname">{g.name}</div>
                <div className="dustval">{agoLabel(d)}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {plays.length > 0 && (
        <div className="panel">
          <div className="eyebrow">The log</div>
          <h3 className="stat-h">Recent Game Times</h3>
          <div className="lb">
            {plays.slice(0, 8).map((p) => (
              <div className="plrow" key={p.id}>
                <div className="plmain">
                  <b>{p.gameName}</b>
                  <span className="plmeta">
                    {p.players?.length ? ` · ${p.players.length} players` : ''}
                    {p.minutes ? ` · ${formatDur(p.minutes)}` : ''}
                  </span>
                </div>
                <div className="plwin">{p.winner ? `🏆 ${p.winner}` : 'co-op'}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  )
}

export default function Stats({ games, plays, onAddGame }) {
  return (
    <section className="tab">
      <div className="eyebrow">Since we started tracking</div>
      <h2 className="big">Play Stats</h2>
      <p className="lead">
        Who’s on a heater, what’s been loved to death, and which boxes are gathering dust.
        Scroll down to log a Game Time — it feeds the leaderboard and powers Game Time’s
        freshness nudges.
      </p>
      <Dashboard games={games} plays={plays} />
      <div className="log-head">
        <div className="eyebrow">Add to the record</div>
        <h3 className="stat-h">Log a Game Time</h3>
      </div>
      <LogPlay games={games} />

      {onAddGame && (
        <div className="panel add-cta">
          <div>
            <div className="eyebrow">Build the collection</div>
            <h3 className="stat-h">New game on the shelf?</h3>
            <p className="hint" style={{ margin: '4px 0 0' }}>
              Search BoardGameGeek to auto-fill the details, or enter it by hand.
            </p>
          </div>
          <button className="btn brass" onClick={onAddGame}>＋ Add a Game</button>
        </div>
      )}
    </section>
  )
}
