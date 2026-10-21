import { GOLD, QUESTS } from './game.js'
import { CHALLENGES } from './challenge.js'
import { questIcon, StarIcon, TrophyIcon } from './icons.jsx'

// The badge shelf: a medal per quest with a progress ring, trophies for the trails, and a small key.
export default function GameSide({ badges, achievements, totals, quest, popId, onReset }) {
  const any = QUESTS.some((q) => badges[q.id].length > 0) || Object.keys(achievements).length > 0
  return (
    <aside className="shelf">
      <h2>Badges</h2>
      <div className="medals">
        {QUESTS.map((q) => {
          const n = badges[q.id].length
          return (
            <div
              key={q.id}
              className={`medal${n ? ' has' : ''}${popId === q.id ? ' pop' : ''}`}
              style={{ '--q': q.colour, '--q-deep': q.deep, '--q-soft': q.soft, '--p': `${(100 * n) / totals[q.id]}%` }}
              title={`${q.name}: ${n} of ${totals[q.id]} ${q.what} in the kit`}
            >
              <span className="medal-face">{questIcon(q.id, { size: 22 })}</span>
              <span className="medal-n">{n}</span>
            </div>
          )
        })}
      </div>
      <h2>Trophies</h2>
      <div className="trophies">
        {CHALLENGES.map((c) => {
          const q = QUESTS.find((x) => x.id === c.quest)
          const got = achievements[c.id]
          return (
            <div key={c.id} className={`trophy${got ? ' has' : ''}${popId === c.id ? ' pop' : ''}`} style={{ '--q': q.colour, '--q-deep': q.deep }} title={c.name}>
              <TrophyIcon size={20} />
              <span className="trail-stars">
                {[1, 2, 3].map((s) => (
                  <StarIcon key={s} size={9} filled={!!got && got.stars >= s} />
                ))}
              </span>
            </div>
          )
        })}
      </div>
      <div className="key">
        <span>
          <i style={{ background: quest?.colour ?? '#cdbdf3' }} /> target
        </span>
        <span>
          <i style={{ background: quest?.deep ?? '#6f4fc4' }} /> chosen
        </span>
        <span>
          <i style={{ background: GOLD }} /> collected
        </span>
      </div>
      <button className="link small" onClick={onReset} disabled={!any}>
        Reset badges
      </button>
    </aside>
  )
}
