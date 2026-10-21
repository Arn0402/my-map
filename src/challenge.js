// Challenges: visit three different buildings of a quest in one walk of at most 10 minutes.
// Each stop is reached at its access point, the network point nearest to its footprint.
// All distances are real walks along the pedestrian network.
import { accessPoint, BAND_M, distancesFrom, distanceTo, routeBetween, SPEED_M_PER_MIN } from './reach.js'

export const CHALLENGE_STOPS = 3
export const CHALLENGE_MINUTES = 10
export const CHALLENGE_BUDGET_M = CHALLENGE_MINUTES * SPEED_M_PER_MIN // 800 m

export const CHALLENGES = [
  { id: 'food-trail', quest: 'food', name: 'Food Trail' },
  { id: 'culture-trail', quest: 'culture', name: 'Culture Trail' },
  { id: 'knowledge-trail', quest: 'knowledge', name: 'Knowledge Trail' },
]

// Access points are found once per building and then kept.
export function makeAccessCache(graph, buildings) {
  const cache = new Map()
  return (i) => {
    if (!cache.has(i)) cache.set(i, accessPoint(graph, buildings[i]))
    return cache.get(i)
  }
}

// Everything a challenge needs from one start: eligible stops, the leg table and the best total.
export function prepareChallenge(graph, startNode, features, access, quest) {
  const startWalk = distancesFrom(graph, { node: startNode })
  const eligible = []
  const first = new Map()
  features.forEach((f, i) => {
    if (!quest.uses.includes(f.properties.use)) return
    const a = access(i)
    if (a.k === -1 || a.d > BAND_M) return
    const d = distanceTo(graph, startWalk, a)
    if (d <= CHALLENGE_BUDGET_M) {
      eligible.push(i)
      first.set(i, d)
    }
  })

  // Walks from every eligible stop, for legs between stops.
  const walks = new Map(eligible.map((i) => [i, distancesFrom(graph, access(i))]))
  const leg = (a, b) => distanceTo(graph, walks.get(a), access(b))
  const table = new Map()
  for (const a of eligible) for (const b of eligible) if (a !== b) table.set(a + ',' + b, leg(a, b))

  // The best possible order of three different stops (one way, from the start).
  let best = null
  for (const a of eligible) {
    const da = first.get(a)
    for (const b of eligible) {
      if (b === a) continue
      const db = da + table.get(a + ',' + b)
      if (db > CHALLENGE_BUDGET_M || (best && db >= best.total)) continue
      for (const c of eligible) {
        if (c === a || c === b) continue
        const total = db + table.get(b + ',' + c)
        if (total <= CHALLENGE_BUDGET_M && (!best || total < best.total)) best = { total, stops: [a, b, c] }
      }
    }
  }

  return { startNode, startWalk, eligible, first, walks, table, best, quest }
}

// The walk through the chosen stops in click order: one route per leg, and the total.
export function trailRoute(graph, prep, stops, access) {
  const legs = []
  let walk = prep.startWalk
  for (const s of stops) {
    legs.push(routeBetween(graph, walk, access(s)))
    walk = prep.walks.get(s)
  }
  const total = legs.reduce((sum, l) => sum + l.length, 0)
  return { legs, total, points: legs.flatMap((l, i) => (i === 0 ? l.points : l.points.slice(1))) }
}

// Stars by how close the walk is to the best possible from this start.
export function starsFor(total, best) {
  if (total <= best * 1.1) return 3
  if (total <= best * 1.3) return 2
  return 1
}

// Trophies, kept in this browser only, separate from the quest badges.
const KEY = 'urban-explorer-achievements'

export function loadAchievements() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY))
    return saved && typeof saved === 'object' ? saved : {}
  } catch {
    return {}
  }
}

export function saveAchievements(a) {
  try {
    localStorage.setItem(KEY, JSON.stringify(a))
  } catch {
    // Storage unavailable: trophies last until the page is closed.
  }
}
