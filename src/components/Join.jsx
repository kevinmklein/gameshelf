import { useEffect, useState } from 'react'
import { subscribeSession, subscribeVotes, submitVote } from '../lib/catalog.js'
import { tally, constraintPills } from '../lib/night.js'
import { VoteFlow, RevealResults, Avatar } from './gameNightBits.jsx'

export default function Join({ code, uid }) {
  const [session, setSession] = useState(undefined)   // undefined = loading, null = not found
  const [votes, setVotes] = useState([])
  const [editing, setEditing] = useState(false)

  useEffect(() => {
    const u1 = subscribeSession(code, setSession)
    const u2 = subscribeVotes(code, setVotes)
    return () => { u1(); u2() }
  }, [code])

  const myVote = votes.find((v) => v.id === uid)
  const revealed = session?.phase === 'revealed'

  async function submit(vote) {
    await submitVote(code, uid, vote)
    setEditing(false)
  }

  let body
  if (session === undefined) {
    body = <div className="soon">Finding table <b>{code}</b>…</div>
  } else if (session === null) {
    body = (
      <div className="empty">
        <h3>Table “{code}” not found</h3>
        <p>Double-check the link, or ask the host to share it again.</p>
      </div>
    )
  } else if (revealed) {
    body = (
      <>
        <RevealResults results={tally(session.ballot, votes)} voterNames={votes.map((v) => v.name)} />
        <p className="footnote">The host closed voting. See you at the table!</p>
      </>
    )
  } else if (myVote && !editing) {
    body = (
      <div className="panel waiting">
        <Avatar color={myVote.color} size={44} />
        <h3>Thanks, {myVote.name} — your vote’s in.</h3>
        <p>Hang tight while everyone else votes. The host reveals tonight’s pick when the table’s ready.</p>
        <div className="join-tally">{votes.length} vote{votes.length === 1 ? '' : 's'} so far</div>
        <button className="btn ghost" onClick={() => setEditing(true)}>Change my vote</button>
      </div>
    )
  } else {
    body = (
      <>
        <div className="constraint-summary" style={{ marginBottom: 4 }}>
          {constraintPills(session.constraints || {}).map((t) => <span className="cpill" key={t}>{t}</span>)}
        </div>
        <VoteFlow ballot={session.ballot} existingVote={editing ? myVote : undefined} onSubmit={submit} />
      </>
    )
  }

  return (
    <section className="tab">
      <div className="eyebrow">Game Night · Table {code}</div>
      <h2 className="big">Cast your vote</h2>
      {body}
    </section>
  )
}
