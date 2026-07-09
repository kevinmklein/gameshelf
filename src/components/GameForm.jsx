import { useState } from 'react'
import { coverFor } from '../lib/catalog.js'

const KINDS = ['Card', 'Strategy', 'Party', 'Dice', 'Dominoes', 'Abstract', 'Family']
const BLANK = {
  name: '', kind: 'Card', time: 20, minP: 2, maxP: 4,
  loc: 'either', att: 'semi', setup: 'quick',
}

// Map a stored game doc back into the form's field shape (for editing).
function fromGame(g) {
  if (!g) return BLANK
  return {
    name: g.name || '', kind: g.kind || 'Card',
    time: g.time ?? 20, minP: g.minPlayers ?? '', maxP: g.maxPlayers ?? '',
    loc: g.loc || 'either', att: g.att || 'semi', setup: g.setup || 'quick',
  }
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

// Shared game intake form. `mode` = 'add' | 'edit'.
// `onSubmitCore(core)` receives just the editable fields (+ a name-derived cover);
// the caller decides whether that becomes a new doc or a patch.
export default function GameForm({ mode = 'add', initial, onSubmitCore, onDone, onCancel }) {
  const [f, setF] = useState(() => fromGame(initial))
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')
  const set = (k) => (v) => setF((s) => ({ ...s, [k]: v }))

  const canSave = f.name.trim().length > 0 && !saving

  function core() {
    const name = f.name.trim()
    const players =
      f.minP && f.maxP ? (Number(f.minP) === Number(f.maxP) ? `${f.minP}` : `${f.minP}–${f.maxP}`) : ''
    return {
      name, kind: f.kind,
      time: Number(f.time) || null,
      minPlayers: Number(f.minP) || null,
      maxPlayers: Number(f.maxP) || null,
      players,
      loc: f.loc, att: f.att, setup: f.setup,
      cover: coverFor(name),
    }
  }

  async function submit(again) {
    if (!canSave) return
    setSaving(true)
    const name = f.name.trim()
    await onSubmitCore(core())
    setSaving(false)
    if (mode === 'add' && again) {
      setF(BLANK)
      setToast(`Added “${name}”. Next one?`)
      setTimeout(() => setToast(''), 1800)
    } else {
      onDone?.()
    }
  }

  return (
    <>
      <div className="field">
        <label htmlFor="gf-name">Game name</label>
        <input
          id="gf-name" type="text" autoFocus placeholder="e.g. Carcassonne"
          value={f.name}
          onChange={(e) => set('name')(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') submit(false) }}
        />
      </div>

      <div className="grid2">
        <div className="field">
          <label htmlFor="gf-kind">Type</label>
          <select id="gf-kind" value={f.kind} onChange={(e) => set('kind')(e.target.value)}>
            {KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="gf-time">Typical play time (minutes)</label>
          <input id="gf-time" type="number" min="1" max="480" value={f.time}
            onChange={(e) => set('time')(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="gf-min">Min players</label>
          <input id="gf-min" type="number" min="1" max="20" value={f.minP}
            onChange={(e) => set('minP')(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="gf-max">Max players</label>
          <input id="gf-max" type="number" min="1" max="20" value={f.maxP}
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
        {mode === 'add' ? (
          <>
            <button className="btn brass" disabled={!canSave} onClick={() => submit(true)}>
              {saving ? 'Saving…' : 'Add & enter another'}
            </button>
            <button className="btn ghost" disabled={!canSave} onClick={() => submit(false)}>
              Add & view shelf
            </button>
          </>
        ) : (
          <>
            <button className="btn brass" disabled={!canSave} onClick={() => submit(false)}>
              {saving ? 'Saving…' : 'Save changes'}
            </button>
            <button className="btn ghost" onClick={onCancel}>Cancel</button>
          </>
        )}
        {!f.name.trim() && <span className="hint">Give it a name to save.</span>}
      </div>

      {toast && <div className="toast">{toast}</div>}
    </>
  )
}
