import { MAX_START_DISTANCE_M, MINUTES } from './reach.js'
import { QUESTS } from './game.js'
import { CHALLENGE_BUDGET_M, CHALLENGE_MINUTES, CHALLENGE_STOPS, CHALLENGES } from './challenge.js'
import { useLabel } from './buildings.js'
import { questIcon, StarIcon, StepsIcon, TrophyIcon } from './icons.jsx'

const fmt = (n) => Math.round(n).toLocaleString('en-GB')
const capitalise = (t) => t.charAt(0).toUpperCase() + t.slice(1)

function StartLine({ loading, error, game }) {
  if (error) return <p className="hint error">The city kit didn't load ({error}).</p>
  if (loading) return <p className="hint">Building the miniature city…</p>
  if (game.status === 'far')
    return (
      <p className="hint warn">
        No walkable street within {MAX_START_DISTANCE_M} m there (nearest {fmt(game.distance)} m). Try closer to a path.
      </p>
    )
  if (game.status === 'computing') return <p className="hint">Scouting the streets…</p>
  if (game.status === 'ready') return <p className="hint">Start set · click elsewhere on the map to move it.</p>
  return <p className="hint">Click a spot in the city to begin. Your walk starts at the nearest path.</p>
}

// The footstep meter: three steps of walking time, each with its number of targets.
function StepMeter({ counts, k, onTime, quest }) {
  return (
    <div className="meter" role="radiogroup" aria-label="Walking limit">
      {MINUTES.map((m, kk) => {
        const n = counts[kk]
        return (
          <button
            key={m}
            role="radio"
            aria-checked={k === kk}
            className={`meter-step${k === kk ? ' on' : ''}`}
            disabled={n === 0}
            title={n === 0 ? `No ${quest.what} within ${m} min from here` : `${n} within ${m} min`}
            onClick={() => onTime(kk)}
          >
            <span className="feet">
              {Array.from({ length: kk + 1 }, (_, i) => (
                <StepsIcon key={i} size={14} />
              ))}
            </span>
            <span className="meter-min">{m} min</span>
            <span className="meter-n">{n === 0 ? 'none' : `${n} ${n === 1 ? 'spot' : 'spots'}`}</span>
          </button>
        )
      })}
    </div>
  )
}

function QuestTiles({ quest, counts, onQuest, k }) {
  return (
    <div className="tiles">
      {QUESTS.map((q) => (
        <button
          key={q.id}
          className={`tile${quest?.id === q.id ? ' on' : ''}`}
          style={{ '--q': q.colour, '--q-deep': q.deep, '--q-soft': q.soft }}
          onClick={() => onQuest(q.id)}
          title={q.what}
        >
          <span className="tile-icon">{questIcon(q.id, { size: 26 })}</span>
          <span className="tile-name">{q.name}</span>
          <span className="tile-count">{counts ? `${counts[q.id][k ?? 2]} ${k === null ? 'in 15 min' : 'in reach'}` : '–'}</span>
        </button>
      ))}
    </div>
  )
}

function QuestsTab(props) {
  const { game, counts, quest, k, targets, collected } = props
  const ready = game.status === 'ready'
  const done = ready && quest && k !== null && collected.length === targets.length
  return (
    <>
      {ready && (
        <section className="step">
          <h3>Choose a quest</h3>
          <QuestTiles quest={quest} counts={counts} k={k} onQuest={props.onQuest} />
        </section>
      )}
      {ready && quest && (
        <section className="step">
          <h3>How far will you walk?</h3>
          <StepMeter counts={counts[quest.id]} k={k} onTime={props.onTime} quest={quest} />
          {counts[quest.id][0] === 0 && <p className="hint small">Nothing within 5 min from here: try a longer walk.</p>}
        </section>
      )}
      {ready && quest && k !== null && (
        <section className="step">
          <div className={`progress${done ? ' done' : ''}`}>
            <span className="ring" style={{ '--p': `${(100 * collected.length) / targets.length}%` }}>
              {questIcon(quest.id, { size: 18 })}
            </span>
            <div>
              <strong>
                {collected.length} / {targets.length}
              </strong>{' '}
              {quest.what} collected
              <div className="hint small">{done ? 'Quest complete! ✨' : 'Click a glowing building or its gem.'}</div>
            </div>
          </div>
        </section>
      )}
    </>
  )
}

function ChallengesTab(props) {
  const { game, challenge, prep, stops, trail, result, achievements, features } = props
  const ready = game.status === 'ready'
  if (!ready) return null
  const total = trail?.total ?? 0
  const over = total - CHALLENGE_BUDGET_M
  const quest = challenge ? QUESTS.find((q) => q.id === challenge.quest) : null
  return (
    <>
      <section className="step">
        <h3>Pick a trail</h3>
        <div className="trails">
          {CHALLENGES.map((c) => {
            const q = QUESTS.find((x) => x.id === c.quest)
            const got = achievements[c.id]
            return (
              <button
                key={c.id}
                className={`trail${challenge?.id === c.id ? ' on' : ''}`}
                style={{ '--q': q.colour, '--q-deep': q.deep, '--q-soft': q.soft }}
                onClick={() => props.onChallenge(c.id)}
              >
                <span className="tile-icon">{questIcon(q.id, { size: 22 })}</span>
                <span className="trail-text">
                  <strong>{c.name}</strong>
                  <span>
                    {CHALLENGE_STOPS} {q.what} · one walk ≤ {CHALLENGE_MINUTES} min
                  </span>
                </span>
                <span className="trail-stars" aria-label={got ? `${got.stars} stars` : 'not done yet'}>
                  {[1, 2, 3].map((s) => (
                    <StarIcon key={s} size={13} filled={!!got && got.stars >= s} />
                  ))}
                </span>
              </button>
            )
          })}
        </div>
      </section>
      {challenge && prep && !prep.best && (
        <p className="hint warn">
          From this start no {CHALLENGE_STOPS} {quest.what} fit into one {CHALLENGE_MINUTES}-minute walk. Try a start
          closer to the centre.
        </p>
      )}
      {challenge && prep?.best && (
        <section className="step">
          <h3>Plan your walk</h3>
          <ol className="stops">
            {Array.from({ length: CHALLENGE_STOPS }, (_, n) => {
              const s = stops[n]
              const legLen = trail?.legs[n]?.length
              return (
                <li key={n} className={s !== undefined ? 'filled' : ''}>
                  <span className="stop-n">{n + 1}</span>
                  {s !== undefined ? (
                    <>
                      <span className="stop-name">
                        {capitalise(useLabel(features[s].properties.use))} #{features[s].properties.id}
                      </span>
                      <span className="stop-leg">+{fmt(legLen)} m</span>
                      <button className="x" onClick={() => props.onToggleStop(s)} aria-label="Remove stop">
                        ×
                      </button>
                    </>
                  ) : (
                    <span className="stop-empty">click a glowing building</span>
                  )}
                </li>
              )
            })}
          </ol>
          <div className={`budget${over > 0 ? ' over' : ''}`}>
            <div className="budget-track">
              <span style={{ width: `${Math.min(100, (100 * total) / CHALLENGE_BUDGET_M)}%` }} />
            </div>
            <div className="budget-text">
              <StepsIcon size={16} />
              <strong>{fmt(total)} m</strong> / {fmt(CHALLENGE_BUDGET_M)} m · {(total / 80).toFixed(1)} of{' '}
              {CHALLENGE_MINUTES} min
            </div>
            {over > 0 && <div className="hint warn small">{fmt(over)} m over: try another order or stop.</div>}
          </div>
          {result ? (
            <div className="result">
              <TrophyIcon size={22} />
              <span>
                <strong>{result.stars === 3 ? 'Perfect route!' : result.stars === 2 ? 'Great walk!' : 'Trail done!'}</strong>{' '}
                {fmt(result.total)} m · best possible from here {fmt(result.best)} m
              </span>
              <span className="trail-stars">
                {[1, 2, 3].map((s) => (
                  <StarIcon key={s} size={15} filled={result.stars >= s} />
                ))}
              </span>
            </div>
          ) : (
            <div className="row">
              <button className="ghost" onClick={props.onClearStops} disabled={!stops.length}>
                Clear
              </button>
              <button className="primary" onClick={props.onComplete} disabled={stops.length < CHALLENGE_STOPS || over > 0}>
                <TrophyIcon size={16} /> Complete trail
              </button>
            </div>
          )}
        </section>
      )}
    </>
  )
}

export default function GamePanel(props) {
  const { loading, error, game, tab, quest, challengeQuest } = props
  const q = tab === 'quests' ? quest : challengeQuest
  const style = q ? { '--q': q.colour, '--q-deep': q.deep, '--q-soft': q.soft } : undefined
  return (
    <aside className="panel game" style={style}>
      <div className="brand">
        <span className="brand-mark">✦</span>
        <div>
          <h1>Urban Explorer</h1>
          <p className="tagline">Miniature Weimar, made from real city data</p>
        </div>
      </div>
      <div className="tabs" role="tablist">
        {['quests', 'challenges'].map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} className={tab === t ? 'on' : ''} onClick={() => props.onTab(t)}>
            {t === 'quests' ? 'Quests' : 'Challenges'}
          </button>
        ))}
      </div>
      <StartLine loading={loading} error={error} game={game} />
      <div className="tab-body" key={tab}>
        {tab === 'quests' ? <QuestsTab {...props} /> : <ChallengesTab {...props} />}
      </div>
      {game.status === 'ready' && (
        <button className="link" onClick={props.onNewWalk}>
          ↺ New start
        </button>
      )}
    </aside>
  )
}
