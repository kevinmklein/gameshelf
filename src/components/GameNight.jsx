import { useEffect, useMemo, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import {
  eligible, buildBallot, tally, makeRoomCode, joinUrl, constraintPills,
} from '../lib/night.js'
import {
  createSession, sessionExists, subscribeSession, subscribeVotes, submitVote, revealSession, logPlay,
} from '../lib/catalog.js'
import { VoteFlow, RevealResults, Lobby, Seg, BallotBrowseList, GameInfoModal } from './gameNightBits.jsx'

const STEPS = ['Set the Table', 'Everyone Votes', 'Tonight We Play']

function Stepper({ cur }) {
  return (
    <div className="stepper">
      {STEPS.map((s, i) => (
        <span key={s} className={`step ${cur === i ? 'on' : ''} ${cur > i ? 'done' : ''}`}>
          <span className="num">{cur > i ? '✓' : i + 1}</span><span className="step-label">{s}</span>
        </span>
      ))}
    </div>
  )
}

export default function GameNight({ games, uid }) {
  const [code, setCode] = useState(null)
  const [session, setSession] = useState(null)
  const [votes, setVotes] = useState([])
  const [step, setStep] = useState('setup')       // setup | share | lobby | vote
  const [c, setC] = useState({ players: null, bestAtN: false, maxTime: null, loc: null, focus: null, kind: null, effort: null, vibe: null, setup: null })
  const [busy, setBusy] = useState(false)
  const [logged, setLogged] = useState(false)

  useEffect(() => {
    if (!code) return
    const u1 = subscribeSession(code, setSession)
    const u2 = subscribeVotes(code, setVotes)
    return () => { u1(); u2() }
  }, [code])

  const eligibleGames = useMemo(() => eligible(games, c), [games, c])
  const myVote = votes.find((v) => v.id === uid)
  const revealed = session?.phase === 'revealed'

  async function openTable() {
    setBusy(true)
    const ballot = buildBallot(games, c)
    // Re-roll on collision: codes get reused over time, and reusing a live one
    // would resurrect the old session's votes in the new lobby.
    let newCode = makeRoomCode()
    for (let tries = 0; tries < 8 && await sessionExists(newCode); tries++) newCode = makeRoomCode()
    await createSession(newCode, { phase: 'voting', constraints: c, ballot, host: uid })
    setCode(newCode)
    setStep('share')
    setBusy(false)
  }
  async function castVote(vote) {
    await submitVote(code, uid, vote)
    setStep('lobby')
  }
  async function reveal() { await revealSession(code) }
  function reset() {
    setCode(null); setSession(null); setVotes([]); setStep('setup'); setLogged(false)
    setC({ players: null, bestAtN: false, maxTime: null, loc: null, focus: null, kind: null, effort: null, vibe: null, setup: null })
  }

  async function logNight() {
    const results = tally(session.ballot, votes)
    const w = results[0]?.game
    if (!w) return
    await logPlay({
      gameId: w.id, gameName: w.name,
      players: votes.map((v) => v.name),
      winner: null, minutes: w.time || null, playedAt: Date.now(),
    })
    setLogged(true)
  }

  const stepIdx = revealed ? 2 : step === 'setup' ? 0 : step === 'vote' ? 1 : 1

  return (
    <section className="tab">
      <div className="eyebrow">The main event</div>
      <h2 className="big">Game Time</h2>
      <p className="lead">
        One person sets the table and shares a link. Everyone votes from their own phone whenever
        they’re ready — the engine finds the game the whole table agrees on and nudges you out of ruts.
      </p>
      <Stepper cur={stepIdx} />

      {/* ---- Reveal (any step, once the host closes voting) ---- */}
      {revealed ? (
        <>
          <RevealResults results={tally(session.ballot, votes)} voterNames={votes.map((v) => v.name)} />
          <div className="actions">
            {logged ? (
              <span className="badge cloud">✓ Logged to Play Stats — add who won on the Play Stats tab</span>
            ) : (
              <button className="btn brass" onClick={logNight}>✓ We’re playing this — log this Game Time</button>
            )}
            <button className="btn ghost" onClick={reset}>Start a new Game Time</button>
          </div>
        </>
      ) : step === 'setup' ? (
        <SetTable c={c} setC={setC} eligibleGames={eligibleGames} games={games}
          onOpen={openTable} busy={busy} />
      ) : step === 'vote' ? (
        <VoteFlow ballot={session.ballot} existingVote={myVote} onSubmit={castVote} />
      ) : step === 'share' ? (
        <Share code={code} c={c} ballot={session?.ballot || []}
          onLobby={() => setStep('lobby')} onVote={() => setStep('vote')} onBack={reset} />
      ) : (
        <Lobby code={code} c={c} ballot={session?.ballot || []} votes={votes} isHost
          onShare={() => setStep('share')} onVote={() => setStep('vote')}
          myVote={myVote} onReveal={reveal} onReset={reset} />
      )}
    </section>
  )
}

function SetTable({ c, setC, eligibleGames, games, onOpen, busy }) {
  const set = (k) => (v) => setC((s) => ({ ...s, [k]: v }))
  const [showList, setShowList] = useState(false)
  const [showMood, setShowMood] = useState(false)
  const [openGame, setOpenGame] = useState(null)
  const count = eligibleGames.length
  const moodSet = [c.effort, c.vibe, c.setup].filter(Boolean).length
  const kinds = [...new Set(games.map((g) => g.kind).filter(Boolean))].sort()
  if (!games.length) {
    return <div className="soon">Add a few games on the <b>Add a Game</b> tab first — Game Time
      votes on your real shelf.</div>
  }
  return (
    <>
      <div className="panel">
        <p style={{ margin: '0 0 6px', fontSize: 14, color: 'var(--ink-2)' }}>
          You’re the host. Set the ground rules — everyone else just votes on what’s left.
        </p>
        <div className="field">
          <label>How many are playing tonight?</label>
          <Seg value={c.players} onChange={(v) => setC((s) => ({ ...s, players: v, bestAtN: false }))} options={[
            [2, '2'], [3, '3'], [4, '4'], [5, '5'], [6, '6'], [7, '7'], [8, '8+'], [null, 'Any'],
          ]} />
        </div>
        <div className="field">
          <label>What kind of game?</label>
          <Seg value={c.kind} onChange={set('kind')} options={[
            ...kinds.map((k) => [k, k]), [null, 'Any'],
          ]} />
        </div>
        <div className="field">
          <label>How long have we got?</label>
          <Seg value={c.maxTime} onChange={set('maxTime')} options={[
            [15, 'Quick · 15m'], [30, 'A bit · 30m'], [60, 'An hour'], [120, 'Committed · 2hr'], [null, 'No limit'],
          ]} />
        </div>
        <div className="field">
          <label>Where are we?</label>
          <Seg value={c.loc} onChange={set('loc')} options={[
            ['couch', '🛋 On the couch'], ['table', '🪑 At the table'], [null, 'Either'],
          ]} />
        </div>
        <div className="field">
          <label>What focus are we after?</label>
          <Seg value={c.focus} onChange={set('focus')} options={[
            [1, 'Background'], [2, 'Casual'], [3, 'Focused'], [null, 'Any'],
          ]} />
        </div>
        {c.players && (
          <div className="field">
            <label>Which games shine at {c.players}?</label>
            <Seg value={c.bestAtN} onChange={set('bestAtN')} options={[
              [false, 'Any that fit'], [true, `★ Best at ${c.players}`],
            ]} />
          </div>
        )}
        <div className="eligible-note">
          🎲 That leaves <b className="tnum">{count}</b> game{count === 1 ? '' : 's'} on the table.
          {count > 0 && (
            <button type="button" className="link-toggle" onClick={() => setShowList((v) => !v)}>
              {showList ? 'Hide the list ▲' : 'See the list ▼'}
            </button>
          )}
        </div>
        {showList && count > 0 && (
          <div style={{ marginTop: 12 }}>
            <p className="hint" style={{ marginTop: 0 }}>Tap a game for more details.</p>
            <BallotBrowseList ballot={eligibleGames} onOpen={setOpenGame} />
          </div>
        )}
        <div className="soft-head">
          <button type="button" className="soft-toggle" aria-expanded={showMood}
            onClick={() => setShowMood((v) => !v)}>
            <span className="soft-eyebrow">
              Set the mood <span className="soft-tag">optional</span>
              {!showMood && moodSet > 0 && <span className="soft-tag on">{moodSet} on</span>}
            </span>
            <span className="soft-chev" aria-hidden="true">{showMood ? '▲' : '▼'}</span>
          </button>
          {showMood && (
            <p className="hint" style={{ margin: '8px 0 0' }}>
              These don’t rule anything out — they just tilt tonight’s shortlist toward what you’re in the mood for.
            </p>
          )}
        </div>
        {showMood && (
          <>
            <div className="field">
              <label>How much brain tonight?</label>
              <Seg value={c.effort} onChange={set('effort')} options={[
                ['light', '🪶 Chill'], ['medium', '⚖️ Medium'], ['heavy', '🧠 Big strategy'], [null, 'Any'],
              ]} />
            </div>
            <div className="field">
              <label>What’s the mood?</label>
              <Seg value={c.vibe} onChange={set('vibe')} options={[
                ['calm', '🌙 Calm & quiet'], ['lively', '🎉 Loud & laughing'], [null, 'Any'],
              ]} />
            </div>
            <div className="field">
              <label>How fast to get going?</label>
              <Seg value={c.setup} onChange={set('setup')} options={[
                ['instant', '⚡ Instant'], ['quick', '🎲 Quick'], ['involved', '🧩 Involved'], [null, 'Any'],
              ]} />
            </div>
          </>
        )}
      </div>
      <div className="actions setup-actions">
        <button className="btn brass" disabled={count < 2 || busy} onClick={onOpen}>
          {busy ? 'Opening…' : 'Open the table →'}
        </button>
        {count < 2 && <span className="hint">Loosen a rule — need at least 2 eligible games.</span>}
      </div>
      {openGame && <GameInfoModal g={openGame} onClose={() => setOpenGame(null)} />}
    </>
  )
}

function Share({ code, c, onLobby, onVote, onBack }) {
  const link = joinUrl(code)
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 1600) } catch { /* ignore */ }
  }
  return (
    <>
      <div className="panel">
        <div className="share">
          <div className="qr"><QRCodeSVG value={link} size={150} bgColor="#ffffff" fgColor="#20201c" /></div>
          <div className="share-info">
            <div className="rc-lbl">Table code</div>
            <div className="roomcode">{code}</div>
            <p style={{ margin: '4px 0 0', fontSize: 13.5, color: 'var(--ink-2)' }}>
              Everyone opens this on their own phone to join and vote.
            </p>
            <div className="linkbox">
              <input readOnly value={link} aria-label="Join link" onFocus={(e) => e.target.select()} />
              <button className="btn ghost" onClick={copy}>{copied ? 'Copied ✓' : 'Copy link'}</button>
            </div>
            <div className="constraint-summary">
              {constraintPills(c).map((t) => <span className="cpill" key={t}>{t}</span>)}
            </div>
          </div>
        </div>
      </div>
      <div className="actions">
        <button className="btn brass" onClick={onVote}>Cast my vote →</button>
        <button className="btn ghost" onClick={onLobby}>Go to the lobby</button>
        <button className="btn ghost" onClick={onBack}>← Change the table</button>
      </div>
    </>
  )
}

