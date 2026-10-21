import { REACH_COLOURS, USE_COLOURS, useLabel } from './buildings.js'
import { MINUTES } from './reach.js'

export default function Legend() {
  return (
    <aside className="legend">
      <h2>Main use of building</h2>
      <ul>
        {USE_COLOURS.map(([use, colour]) => (
          <li key={use ?? 'none'}>
            <span className="swatch" style={{ background: colour }} />
            {useLabel(use)}
          </li>
        ))}
      </ul>
      <h2>Reached on foot</h2>
      <ul>
        {MINUTES.map((m, k) => (
          <li key={m}>
            <span className="swatch" style={{ background: REACH_COLOURS[k] }} />
            within {m} min
          </li>
        ))}
      </ul>
    </aside>
  )
}
