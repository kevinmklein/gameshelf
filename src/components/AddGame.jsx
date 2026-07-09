import { addGame, hasFirebase } from '../lib/catalog.js'
import GameForm from './GameForm.jsx'

export default function AddGame({ onDone }) {
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
        <GameForm
          mode="add"
          onSubmitCore={(core) => addGame({ ...core, last: 999, plays: 0, source: 'manual' })}
          onDone={onDone}
        />
      </div>
    </section>
  )
}
