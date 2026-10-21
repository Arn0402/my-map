import { BAND_M, MAX_START_DISTANCE_M, MINUTES, SPEED_M_PER_MIN } from './reach.js'
import { REACH_COLOURS } from './buildings.js'

const fmt = (n) => n.toLocaleString('en-GB')

function Message({ loading, error, state }) {
  if (error) return <p className="message error">The city kit didn't load ({error}).</p>
  if (loading) return <p className="message">Loading the city kit…</p>
  if (state.status === 'far')
    return (
      <p className="message warn">
        No walkable street within {MAX_START_DISTANCE_M} m of this point (the nearest is {Math.round(state.distance)} m
        away). Click closer to a street.
      </p>
    )
  if (state.status === 'computing') return <p className="message">Working out the walk…</p>
  if (state.status === 'idle') return <p className="message">Click on the ground to start a walk from the nearest street node.</p>
  return null
}

export default function Panel({ loading, error, state, kit }) {
  const results = state.status === 'done' ? state.reach.results : null
  return (
    <aside className="panel">
      <h1>Walking map{kit ? ` · ${kit.label}` : ''}</h1>
      <Message loading={loading} error={error} state={state} />
      <table>
        <thead>
          <tr>
            <th>Walk</th>
            <th>Buildings</th>
            <th>Residents</th>
          </tr>
        </thead>
        <tbody>
          {MINUTES.map((m, k) => {
            const r = results?.[k]
            return (
              <tr key={m}>
                <td>
                  <span className="swatch" style={{ background: REACH_COLOURS[k] }} />
                  {m} min
                </td>
                <td>{r ? fmt(r.buildings) : '–'}</td>
                <td>
                  {r ? `about ${fmt(r.residents)}` : '–'}
                  {r && r.cellsWithoutFigure > 0 && (
                    <span className="note">
                      {r.cellsWithoutFigure} {r.cellsWithoutFigure === 1 ? 'cell' : 'cells'} without a figure, left out
                    </span>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <div className="method">
        <p>
          Walking speed 4.8 km/h, which is {SPEED_M_PER_MIN} m per minute, along the walkable streets and paths from the
          nearest street node.
        </p>
        <p>
          Each area is the street segments reached in that time, including the reachable part of the last segment, with
          a band of {BAND_M} m on each side. A building counts if it touches the area.
        </p>
        <p>
          Residents come from the 100 m cells of the Zensus 2022: for every cell that overlaps the area, its population
          times the share of the cell's area that lies inside, added up and rounded to the nearest 10.
        </p>
        <p>
          Cells without a published figure are left out of the sum, not counted as zero; their number is shown next to
          it.
        </p>
      </div>
    </aside>
  )
}
