import { useLabel } from './buildings.js'
import { SPEED_M_PER_MIN } from './reach.js'
import { CloseIcon, questIcon, StarIcon, StepsIcon } from './icons.jsx'
import Confetti from './Confetti.jsx'

const fmt = (n) => Math.round(n).toLocaleString('en-GB')
const capitalise = (t) => t.charAt(0).toUpperCase() + t.slice(1)

// The chosen building, described only from the kit: use, id, height, floors, floor areas.
export default function TargetCard({ quest, feature, route, isCollected, onCollect, onClose, burstKey }) {
  const p = feature.properties
  const areas = Object.entries(p.floor_area_m2).sort((a, b) => b[1] - a[1])
  const total = areas.reduce((s, [, a]) => s + a, 0)
  const minutes = route ? Math.max(1, Math.round(route.length / SPEED_M_PER_MIN)) : null
  return (
    <div className="target-card" key={p.id} style={{ '--q': quest.colour, '--q-deep': quest.deep, '--q-soft': quest.soft }}>
      <button className="close" onClick={onClose} aria-label="Close">
        <CloseIcon size={16} />
      </button>
      <div className="target-head">
        <span className={`medallion${isCollected ? ' gold' : ''}`}>{questIcon(quest.id, { size: 26 })}</span>
        <div>
          <div className="target-title">{capitalise(useLabel(p.use))} building</div>
          <div className="chips-row">
            <span className="tag">#{p.id}</span>
            <span className="tag">{p.height} m tall</span>
            <span className="tag">
              {p.floors} {p.floors === 1 ? 'floor' : 'floors'}
            </span>
          </div>
        </div>
      </div>
      {route && (
        <div className="walk-line">
          <StepsIcon size={18} />
          <strong>{fmt(route.length)} m</strong> along the streets · about {minutes} min
        </div>
      )}
      {total > 0 && (
        <div className="floor-bars" title="Estimated floor area by use">
          {areas.slice(0, 3).map(([u, a]) => (
            <div key={u} className="floor-bar">
              <span className="floor-label">{capitalise(useLabel(u))}</span>
              <span className="floor-track">
                <span style={{ width: `${(100 * a) / total}%` }} />
              </span>
              <span className="floor-value">{fmt(a)} m²</span>
            </div>
          ))}
        </div>
      )}
      <div className="collect-wrap">
        <button className={`collect${isCollected ? ' got' : ''}`} onClick={onCollect} disabled={isCollected}>
          <StarIcon size={18} filled={isCollected} />
          {isCollected ? 'Badge collected' : 'Collect badge'}
        </button>
        {burstKey && <Confetti key={burstKey} />}
      </div>
    </div>
  )
}
