import { useState } from 'react'
import { addGame, coverFor, hasFirebase } from '../lib/catalog.js'

const KINDS = ['Card', 'Strategy', 'Party', 'Dice', 'Dominoes', 'Abstract', 'Family']
const blank = {
  name: '', kind: 'Card', time: 20, minP: 2, maxP: 4,
  loc: 'either', att: 'semi', setup: 'quick',
}

function Seg({ value, onChange, options }) {
  return (
    <div className="seg">
      {options.map(([v, label]) => (
        <button key={String(v)} type="button" aria-pressed={value === v} onClick={() => onChange(v)}>
          {label}
        </button>
      ))}
    </div>
  )
}

export default function AddGame({ onDone }) {
  const [f, setF] = useState(blank)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')
  const set = (k) => (v) => setF((s) => ({ ...s, [k]: v }))

  const canSave = f.name.trim().length > 0 && !saving

  async function save(addAnother) {
    if (!canSave) return
    setSaving(true)
    const name = f.name.trim()
    const players =
      f.minP && f.maxP ? (f.minP === f.maxP ? `${f.minP}` : `${f.minP}–${f.maxP}`) : ''
    await addGame({
      name,
      kind: f.kind,
      time: Number(f.time) || null,
      minPlayers: Number(f.minP) || null,
      maxPlayers: Number(f.maxP) || null,
      players,
      loc: f.loc,
      att: f.att,
      setup: f.setup,
      cover: coverFor(name),
      last: 999,        // never played yet
      plays: 0,
      source: 'manual',
    })
    setSaving(false)
    if (addAnother) {
      setF(blank)
      setToast(`Added “${name}”. Next one?`)
      setTimeout(() => setToast(''), 1800)
    } else {
      onDone()
    }
  }

  return (
    <section className="tab">
      <div className="eyebrow">Build the collection</div>
      <h2 className="big">Add a Game</h2>
      <p className="lead">
        Enter what you know and it lands on the shelf right away.
        {hasFirebase
          ? ' Saved to the cloud for the whole family.'
          : ' Saved on this device for now — it moves to the cloud once Firebase is connected.'}
        {' '}Auto-fill from BoardGameGeek (real box art + stats from just the name) arrives once the API token is approved.
      </p>

      <div className="panel">
        <div className="field">
          <label htmlFor="gname">Game name</label>
          <input
            id="gname" type="text" autoFocus placeholder="e.g. Carcassonne"
            value={f.name}
            onChange={(e) => set('name')(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') save(false) }}
          />
        </div>

        <div className="grid2">
          <div className="field">
            <label htmlFor="gkind">Type</label>
            <select id="gkind" value={f.kind} onChange={(e) => set('kind')(e.target.value)}>
              {KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="gtime">Typical play time (minutes)</label>
            <input id="gtime" type="number" min="1" max="480" value={f.time}
              onChange={(e) => set('time')(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="gmin">Min players</label>
            <input id="gmin" type="number" min="1" max="20" value={f.minP}
              onChange={(e) => set('minP')(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="gmax">Max players</label>
            <input id="gmax" type="number" min="1" max="20" value={f.maxP}
              onChange={(e) => set('maxP')(e.target.value)} />
          </div>
        </div>

        <div className="field">
          <label>Where do you play it?</label>
          <Seg value={f.loc} onChange={set('loc')} options={[
            ['couch', '🛋 Couch'], ['table', '🪑 Table'], ['either', 'Either'],
          ]} />
        </div>
        <div className="field">
          <label>Attention needed</label>
          <Seg value={f.att} onChange={set('att')} options={[
            ['background', '👀 Half-watch OK'], ['semi', 'Light focus'], ['focus', '🧠 All-in'],
          ]} />
        </div>
        <div className="field">
          <label>Time to set up</label>
          <Seg value={f.setup} onChange={set('setup')} options={[
            ['instant', 'Instant'], ['quick', 'Quick'], ['involved', 'Involved'],
          ]} />
        </div>

        <div className="actions">
          <button className="btn brass" disabled={!canSave} onClick={() => save(true)}>
            {saving ? 'Saving…' : 'Add & enter another'}
          </button>
          <button className="btn ghost" disabled={!canSave} onClick={() => save(false)}>
            Add & view shelf
          </button>
          {!f.name.trim() && <span className="hint">Give it a name to save.</span>}
        </div>
      </div>

      {toast && <div className="toast">{toast}</div>}
    </section>
  )
}
