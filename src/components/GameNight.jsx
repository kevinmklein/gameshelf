import { useEffect, useMemo, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import {
  eligible, buildBallot, tally, makeRoomCode, joinUrl, constraintPills,
} from '../lib/night.js'
import {
  createSession, sessionExists, subscribeSession, subscribeVotes, submitVote, revealSession, logPlay,
} from '../lib/catalog.js'
import { BallotPicker, VoteFlow, RevealResults, Avatar, Seg } from './gameNightBits.jsx'

const STEPS = ['Set the Table', 'Everyone Votes', 'Tonight We Play']

function Stepper({ cur }) {
  return (
    <div className="stepper">
      {STEPS.map((s, i) => (
        <span key={s} className={`step ${cur === i ? 'on' : ''} ${cur > i ? 'done' : ''}`}>
          <span className="num">{cur > i ? '✓' : i + 1}</span>{s}
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
  const [c, setC] = useState({ maxTime: null, loc: null, att: null })
  const [busy, setBusy] = useState(false)
  const [logged, setLogged] = useState(false)

  useEffect(() => {
    if (!code) return
    const u1 = subscribeSession(code, setSession)
    const u2 = subscribeVotes(code, setVotes)
    return () => { u1(); u2() }
  }, [code])

  const eligibleCount = useMemo(() => eligible(games, c).length, [games, c])
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
    setC({ maxTime: null, loc: null, att: null })
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
        <SetTable c={c} setC={setC} count={eligibleCount} games={games}
          onOpen={openTable} busy={busy} />
      ) : step === 'vote' ? (
        <VoteFlow ballot={session.ballot} existingVote={myVote} onSubmit={castVote} />
      ) : step === 'share' ? (
        <Share code={code} c={c} ballot={session?.ballot || []}
          onLobby={() => setStep('lobby')} onBack={reset} />
      ) : (
        <Lobby code={code} c={c} session={session} votes={votes}
          onShare={() => setStep('share')} onVote={() => setStep('vote')}
          myVote={myVote} onReveal={reveal} onReset={reset} />
      )}
    </section>
  )
}

function SetTable({ c, setC, count, games, onOpen, busy }) {
  const set = (k) => (v) => setC((s) => ({ ...s, [k]: v }))
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
          <label>How long have we got?</label>
          <Seg value={c.maxTime} onChange={set('maxTime')} options={[
            [15, 'Quick · 15m'], [30, 'A bit · 30m'], [60, 'Full · 60m'], [null, 'No limit'],
          ]} />
        </div>
        <div className="field">
          <label>Where are we?</label>
          <Seg value={c.loc} onChange={set('loc')} options={[
            ['couch', '🛋 On the couch'], ['table', '🪑 At the table'], [null, 'Either'],
          ]} />
        </div>
        <div className="field">
          <label>Half-watching a movie?</label>
          <Seg value={c.att} onChange={set('att')} options={[
            ['background', '👀 Keep it light'], ['focus', '🧠 We’re all-in'], [null, 'Doesn’t matter'],
          ]} />
        </div>
        <div className="eligible-note">🎲 That leaves <b className="tnum">{count}</b> game{count === 1 ? '' : 's'} on the table tonight.</div>
      </div>
      <div className="actions">
        <button className="btn brass" disabled={count < 2 || busy} onClick={onOpen}>
          {busy ? 'Opening…' : 'Open the table →'}
        </button>
        {count < 2 && <span className="hint">Loosen a rule — need at least 2 eligible games.</span>}
      </div>
    </>
  )
}

function Share({ code, c, onLobby, onBack }) {
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
        <button className="btn brass" onClick={onLobby}>Go to the lobby →</button>
        <button className="btn ghost" onClick={onBack}>← Change the table</button>
      </div>
    </>
  )
}

function Lobby({ code, c, session, votes, onShare, onVote, myVote, onReveal, onReset }) {
  const ballotN = session?.ballot?.length || 0
  const canReveal = votes.length >= 1
  return (
    <>
      <div className="panel">
        <div className="lobby-head">
          <div>
            <div className="rc-lbl">Table {code}</div>
            <div className="lobby-count">{votes.length} vote{votes.length === 1 ? '' : 's'} in</div>
          </div>
          <button className="btn ghost" onClick={onShare}>Show link</button>
        </div>
        <div className="constraint-summary" style={{ marginTop: 8 }}>
          {constraintPills(c).map((t) => <span className="cpill" key={t}>{t}</span>)}
          <span className="cpill">🎲 {ballotN} on the ballot</span>
        </div>
        {votes.length === 0 ? (
          <p className="hint" style={{ marginTop: 14 }}>Waiting for the first vote… share the link above.</p>
        ) : (
          <div className="join-list">
            {votes.map((v) => (
              <div className="join-row" key={v.id}>
                <Avatar color={v.color} size={30} />
                <div className="jn">{v.name}</div>
                <span className="jstat voted">Voted ✓</span>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="actions">
        <button className="btn brass" disabled={!canReveal} onClick={onReveal}>Close voting & reveal →</button>
        <button className="btn ghost" onClick={onVote}>{myVote ? 'Edit my vote' : 'Cast my vote'}</button>
        <button className="btn ghost" onClick={onReset}>Start over</button>
        {!canReveal && <span className="hint">Need at least one vote in.</span>}
      </div>
    </>
  )
}
