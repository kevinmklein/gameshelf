import { useEffect, useRef, useState } from 'react'
import { captainFor, constraintPills } from '../lib/night.js'
import { colorFor, FAMILY } from '../lib/family.js'
import { FALLBACK_COVER, playedDaysAgo, agoLabel, locLabel, attLabel, complexityLabel } from '../lib/catalog.js'

export function Meeple({ fill = '#fff', size = 20, className }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill={fill} aria-hidden="true">
      <path d="M12 2a3 3 0 0 0-3 3c0 1 .5 1.8 1.2 2.4C8.8 8.2 7 9.6 7 12v1l-3 1v3l4-1v6h8v-6l4 1v-3l-3-1v-1c0-2.4-1.8-3.8-3.2-4.6C13.5 6.8 14 6 14 5a3 3 0 0 0-2-3z" />
    </svg>
  )
}

// Segmented button row — shared by the Set the Table constraints and the game form.
export function Seg({ value, onChange, options }) {
  return (
    <div className="seg">
      {options.map(([v, label]) => (
        <button key={String(v)} type="button" aria-pressed={value === v}
          onClick={() => onChange(v)}>{label}</button>
      ))}
    </div>
  )
}

export function Avatar({ color, size = 34 }) {
  return (
    <span className="av" style={{ background: color, width: size, height: size }}>
      <Meeple size={size * 0.58} />
    </span>
  )
}

// "Who's voting?" — single-pick from the family roster or add yourself as a guest.
export function IdentityPicker({ onPick, title = 'Tap your name' }) {
  const [guest, setGuest] = useState('')
  const pickGuest = () => { const n = guest.trim(); if (n) onPick(n) }
  return (
    <div className="panel">
      <div className="eyebrow">Who’s voting?</div>
      <h3 className="stat-h">{title}</h3>
      <div className="chips">
        {FAMILY.map((n) => (
          <button key={n} type="button" className="chip idchip" onClick={() => onPick(n)}>{n}</button>
        ))}
      </div>
      <div className="guest-add">
        <input type="text" placeholder="Add yourself as a guest…" value={guest} maxLength={18}
          onChange={(e) => setGuest(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); pickGuest() } }} />
        <button type="button" className="btn ghost" onClick={pickGuest} disabled={!guest.trim()}>＋ Join</button>
      </div>
    </div>
  )
}

// Identity → ranked ballot → submit. Shared by the host ("cast my vote") and joiners.
export function VoteFlow({ ballot, existingVote, onSubmit }) {
  const [name, setName] = useState(existingVote?.name || '')
  const [ranking, setRanking] = useState(existingVote?.ranking || [])
  if (!name) return <IdentityPicker onPick={setName} />
  return (
    <div className="panel">
      <div className="voter-banner">
        <Avatar color={colorFor(name)} />
        <div>
          <h3>Voting as {name}</h3>
          <p>Rank up to three, then submit — you can change it until the reveal.</p>
        </div>
      </div>
      <BallotPicker
        ballot={ballot} value={ranking} onChange={setRanking}
        submitLabel={`Submit ${name}’s votes →`}
        onBack={() => setName('')} backLabel="← Not me"
        onSubmit={() => onSubmit({ name, color: colorFor(name), ranking })}
      />
    </div>
  )
}

// Ranked-approval ballot: tap up to three in order (1st/2nd/3rd), tap again to undo.
export function BallotPicker({ ballot, value, onChange, onSubmit, submitLabel, onBack, backLabel }) {
  const toggle = (id) => {
    const cur = [...value]
    const i = cur.indexOf(id)
    if (i >= 0) cur.splice(i, 1)
    else if (cur.length < 3) cur.push(id)
    onChange(cur)
  }
  return (
    <>
      <p className="vote-help">
        Tap your favorites in order — <b>1st, 2nd, 3rd</b>. First choice is worth the most.
        Tap again to undo.
      </p>
      <div className="ballot">
        {ballot.map((g) => {
          const rank = value.indexOf(g.id)
          const c = g.cover || FALLBACK_COVER
          return (
            <button key={g.id} type="button" className="bcard"
              data-rank={rank >= 0 ? rank + 1 : undefined} onClick={() => toggle(g.id)}>
              <span className="strip" style={{ background: `linear-gradient(90deg, ${c.c1}, ${c.c2})` }} />
              <span className="pick">{rank >= 0 ? rank + 1 : ''}</span>
              <span className="bin">
                <span className="bn">{g.name}</span>
                <span className="bmeta tnum">
                  {g.time ? `${g.time}m` : ''}{g.players ? ` · ${g.players}` : ''} · {g.kind}
                </span>
              </span>
            </button>
          )
        })}
      </div>
      <div className="actions">
        <button className="btn brass" disabled={value.length < 1} onClick={onSubmit}>{submitLabel}</button>
        {onBack && <button className="btn ghost" onClick={onBack}>{backLabel || '← Back'}</button>}
        {value.length < 1 && <span className="hint">Pick at least one.</span>}
      </div>
    </>
  )
}

// A read-only ballot list — tap a game to pop open its details. Shared by the
// "while you wait" panel and the lobby, for both the host and voters.
export function BallotBrowseList({ ballot, onOpen }) {
  return (
    <div className="ballot">
      {ballot.map((g) => {
        const c = g.cover || FALLBACK_COVER
        return (
          <button type="button" className="bcard" key={g.id} onClick={() => onOpen(g)}>
            <span className="strip" style={{ background: `linear-gradient(90deg, ${c.c1}, ${c.c2})` }} />
            <span className="bin">
              <span className="bn">{g.name}</span>
              <span className="bmeta tnum">
                {g.time ? `${g.time}m` : ''}{g.players ? ` · ${g.players}` : ''} · {g.kind}
              </span>
            </span>
          </button>
        )
      })}
    </div>
  )
}

// Read-only popup with a ballot game's details — no editing, just a closer look
// while people wait for votes to come in.
export function GameInfoModal({ g, onClose }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const cover = g.cover || FALLBACK_COVER
  const heroImg = g.image || g.bggImage || null
  const heroStyle = heroImg
    ? { backgroundImage: `url(${heroImg})`, backgroundSize: 'cover', backgroundPosition: 'center' }
    : { background: `linear-gradient(150deg, ${cover.c1}, ${cover.c2})` }
  const spec = (k, v) => (v ? <div className="spec"><div className="k">{k}</div><div className="v">{v}</div></div> : null)
  const d = playedDaysAgo(g)

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
            {spec('Best at', g.bestPlayers ? `${g.bestPlayers}${String(g.bestPlayers).endsWith('+') ? '' : ' players'}` : null)}
            {spec('Complexity', complexityLabel(g.weight))}
            {spec('Where', locLabel(g.loc))}
            {spec('Attention', attLabel(g.att))}
          </div>
          {g.description && <p className="gdesc">{g.description}</p>}
          <div className="played">
            {d == null
              ? 'Never played yet — a fresh face on the shelf.'
              : <>Last played <b>{agoLabel(d)}</b></>}
            {g.plays ? <> · played <b className="tnum">{g.plays}×</b> all-time</> : null}
          </div>
          <div className="modal-foot" style={{ justifyContent: 'flex-end' }}>
            <button className="btn ghost" onClick={onClose}>Close</button>
          </div>
        </div>
      </div>
    </div>
  )
}

// The lobby: live vote count + who's voted + a browsable ballot, shared by the
// host (full controls) and voters (read-only + their own vote button) so
// everyone watching the table sees the same thing.
export function Lobby({
  code, c, ballot, votes, isHost, myVote, onShare, onVote, onReveal, onReset, onBack,
}) {
  const [openGame, setOpenGame] = useState(null)
  const canReveal = votes.length >= 1
  return (
    <>
      <div className="panel">
        <div className="lobby-head">
          <div>
            <div className="rc-lbl">Table {code}</div>
            <div className="lobby-count">{votes.length} vote{votes.length === 1 ? '' : 's'} in</div>
          </div>
          {isHost && <button className="btn ghost" onClick={onShare}>Show link</button>}
        </div>
        <div className="constraint-summary" style={{ marginTop: 8 }}>
          {constraintPills(c).map((t) => <span className="cpill" key={t}>{t}</span>)}
          <span className="cpill">🎲 {ballot.length} on the ballot</span>
        </div>
        {votes.length === 0 ? (
          <p className="hint" style={{ marginTop: 14 }}>
            Waiting for the first vote…{isHost ? ' share the link above.' : ''}
          </p>
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
      <div className="panel">
        <div className="eyebrow">Browse while you wait</div>
        <h3 className="stat-h">On the table tonight</h3>
        <p className="hint" style={{ marginTop: 0 }}>Tap a game for more details.</p>
        <BallotBrowseList ballot={ballot} onOpen={setOpenGame} />
      </div>
      <div className="actions">
        {isHost && (
          <button className="btn brass" disabled={!canReveal} onClick={onReveal}>Close voting & reveal →</button>
        )}
        <button className="btn ghost" onClick={onVote}>{myVote ? 'Edit my vote' : 'Cast my vote'}</button>
        {isHost && <button className="btn ghost" onClick={onReset}>Start over</button>}
        {!isHost && onBack && <button className="btn ghost" onClick={onBack}>← Back</button>}
        {isHost && !canReveal && <span className="hint">Need at least one vote in.</span>}
      </div>
      {openGame && <GameInfoModal g={openGame} onClose={() => setOpenGame(null)} />}
    </>
  )
}

// The reveal: winner hero, freshness-annotated results, weekly Captain tiebreak note.
export function RevealResults({ results, voterNames = [] }) {
  const barsRef = useRef(null)
  useEffect(() => {
    const el = barsRef.current
    if (el) requestAnimationFrame(() => el.querySelectorAll('.rbar').forEach((x) => { x.style.width = x.dataset.w + '%' }))
  }, [results])

  if (!results.length) {
    return <div className="soon">No votes are in yet — once people rank the ballot, tonight’s pick appears here.</div>
  }
  const max = Math.max(...results.map((r) => r.score), 1)
  const top = results[0], second = results[1]
  const tie = second && Math.abs(top.score - second.score) < 0.75
  const captain = captainFor(voterNames)
  const w = top.game

  return (
    <>
      <div className="winner-hero">
        <div className="eyebrow">Tonight we play</div>
        <h2>{w.name}</h2>
        <p>{w.time ? `${w.time} min` : ''}{w.players ? ` · ${w.players} players` : ''} · {w.kind}</p>
      </div>
      {tie && (
        <div className="tie-note">
          🤝 <b>Photo finish.</b> {top.game.name} and {second.game.name} tied.
          {captain ? <> <b>{captain}</b> is <b>tonight’s Captain</b> (it rotates weekly), so their call
            breaks it — and the dustier game gets the edge.</> : ' The dustier game gets the edge.'} {w.name} it is.
        </div>
      )}
      <div className="results" ref={barsRef}>
        {results.map((r, i) => (
          <div className={`rrow${i === 0 ? ' winner' : ''}`} key={r.id}>
            <div className="rank">{i + 1}</div>
            <div className="rinfo">
              <div className="rn">
                {r.game.name}
                {r.fresh > 0 && <span className="fresh">↑ {r.label}</span>}
                {r.fresh < 0 && <span className="fresh down">↓ {r.label}</span>}
              </div>
              <div className="rbar-wrap"><div className="rbar" data-w={Math.round(r.score / max * 100)} /></div>
            </div>
            <div className="rscore tnum">{r.score % 1 === 0 ? r.score : r.score.toFixed(1)}</div>
          </div>
        ))}
      </div>
      <p className="footnote">
        Score = ranked votes (3·2·1) ± a freshness nudge. Recently-played games lose a point;
        dusty ones gain one — so you rotate out of ruts without anyone having to argue for it.
      </p>
    </>
  )
}
