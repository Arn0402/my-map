// Urban Explorer: quests, targets and badges. Targets are buildings whose main `use`
// fits the quest and that the Walking Map's own calculation reaches in the chosen time.

export const QUESTS = [
  {
    id: 'culture',
    name: 'Culture Hunter',
    icon: '🎭',
    uses: ['culture', 'entertainment'],
    what: 'culture and entertainment buildings',
    colour: '#a99cc6',
    deep: '#5d5088',
    soft: '#eeebf3',
  },
  {
    id: 'food',
    name: 'Food Explorer',
    icon: '🍰',
    uses: ['food_and_drink'],
    what: 'food and drink buildings',
    colour: '#c98d72',
    deep: '#9a5034',
    soft: '#f4ebe5',
  },
  {
    id: 'knowledge',
    name: 'Knowledge Seeker',
    icon: '📚',
    uses: ['education'],
    what: 'education buildings',
    colour: '#8c9fb8',
    deep: '#43597a',
    soft: '#e8ecf1',
  },
]

export const questById = (id) => QUESTS.find((q) => q.id === id)

export const MUTED = '#f7f5f1'
export const GOLD = '#d4ad62'

// Indices of the quest's buildings reached within area k (0, 1, 2 for 5, 10, 15 min).
export function targetsFor(features, level, quest, k) {
  const out = []
  features.forEach((f, i) => {
    if (level[i] !== -1 && level[i] <= k && quest.uses.includes(f.properties.use)) out.push(i)
  })
  return out
}

// For each quest, how many targets there are within 5, 10 and 15 minutes.
export function targetCounts(features, level) {
  return Object.fromEntries(QUESTS.map((q) => [q.id, [0, 1, 2].map((k) => targetsFor(features, level, q, k).length)]))
}

// All buildings of a quest in the whole kit, for the badge collection.
export function questTotals(features) {
  return Object.fromEntries(QUESTS.map((q) => [q.id, features.filter((f) => q.uses.includes(f.properties.use)).length]))
}

// Badges are remembered in this browser only. If storage is blocked, the game still plays.
const KEY = 'urban-explorer-badges'

export function loadBadges() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY))
    return Object.fromEntries(QUESTS.map((q) => [q.id, Array.isArray(saved?.[q.id]) ? saved[q.id] : []]))
  } catch {
    return Object.fromEntries(QUESTS.map((q) => [q.id, []]))
  }
}

export function saveBadges(badges) {
  try {
    localStorage.setItem(KEY, JSON.stringify(badges))
  } catch {
    // Storage unavailable: badges last until the page is closed.
  }
}
