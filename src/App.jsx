import { useEffect, useMemo, useRef, useState } from 'react'
import City from './City.jsx'
import Panel from './Panel.jsx'
import Legend from './Legend.jsx'
import GamePanel from './GamePanel.jsx'
import GameSide from './GameSide.jsx'
import TargetCard from './TargetCard.jsx'
import Confetti from './Confetti.jsx'
import { makeProjection } from './geo.js'
import { buildHalo, REACH_COLOURS } from './buildings.js'
import {
  computeReach,
  distanceToStreet,
  makeGraph,
  MAX_START_DISTANCE_M,
  nearestNode,
  prepareBuildings,
  prepareCells,
  routeToBuilding,
} from './reach.js'
import { GOLD, loadBadges, QUESTS, questById, questTotals, saveBadges, targetCounts, targetsFor } from './game.js'
import {
  CHALLENGE_BUDGET_M,
  CHALLENGE_STOPS,
  CHALLENGES,
  loadAchievements,
  makeAccessCache,
  prepareChallenge,
  saveAchievements,
  starsFor,
  trailRoute,
} from './challenge.js'
import { questIcon, TrophyIcon } from './icons.jsx'

const FILES = ['kit.json', 'buildings.geojson', 'streets.graph.json', 'zensus.geojson']

// Worded as in public/data/SOURCES.md.
const ATTRIBUTION =
  'Buildings: 3D building models LoD2 © GDI-Th (dl-de/by-2-0). Land use and pedestrian network: Egor Gaydukov, InfAU, Bauhaus-Universität Weimar. Census grid: Zensus 2022, © Statistische Ämter des Bundes und der Länder (dl-de/by-2-0).'

export default function App() {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [mode, setMode] = useState('map')
  const [state, setState] = useState({ status: 'idle' })

  // Urban Explorer state
  const [game, setGame] = useState({ status: 'idle' })
  const [tab, setTab] = useState('quests')
  const [questId, setQuestId] = useState(null)
  const [k, setK] = useState(null) // 0, 1, 2 for 5, 10, 15 minutes
  const [selected, setSelected] = useState(null)
  const [badges, setBadges] = useState(loadBadges)
  const [challengeId, setChallengeId] = useState(null)
  const [stops, setStops] = useState([])
  const [result, setResult] = useState(null)
  const [achievements, setAchievements] = useState(loadAchievements)
  const [toast, setToast] = useState(null)
  const [burst, setBurst] = useState(null)
  const [party, setParty] = useState(null) // big confetti moment
  const [popId, setPopId] = useState(null)
  const timers = useRef({})

  useEffect(() => {
    Promise.all(
      FILES.map((f) =>
        fetch(`${import.meta.env.BASE_URL}data/${f}`).then((r) => {
          if (!r.ok) throw new Error(`data/${f}: ${r.status}`)
          return r.json()
        }),
      ),
    )
      .then(([kit, buildings, graph, zensus]) => setData({ kit, buildings, graph, zensus }))
      .catch((e) => setError(e.message))
  }, [])

  const model = useMemo(() => {
    if (!data) return null
    const proj = makeProjection(data.kit.center)
    const buildings = prepareBuildings(data.buildings.features, proj)
    const graph = makeGraph(data.graph, proj)
    return {
      proj,
      graph,
      buildings,
      cells: prepareCells(data.zensus.features, proj),
      // Marker positions: middle of each footprint, on its roof, and its rough size.
      tops: buildings.map((b, i) => {
        const ring = b.rings[0]
        const x = ring.reduce((s, p) => s + p[0], 0) / ring.length
        const y = ring.reduce((s, p) => s + p[1], 0) / ring.length
        const r = Math.max(4, ...ring.map(([px, py]) => Math.hypot(px - x, py - y)))
        return { x, y, r, top: data.buildings.features[i].properties.height }
      }),
      totals: questTotals(data.buildings.features),
      access: makeAccessCache(graph, buildings),
    }
  }, [data])

  const features = data?.buildings.features

  // --- Walking Map (unchanged behaviour) ---
  const pickMap = (xy) => {
    const { graph, buildings, cells, proj } = model
    const distance = distanceToStreet(graph, xy)
    if (distance > MAX_START_DISTANCE_M) {
      setState({ status: 'far', distance })
      return
    }
    const node = nearestNode(graph, xy)
    const start = graph.nodeXY[node]
    setState({ status: 'computing', start })
    // Let the panel show "working out…" before the calculation runs.
    setTimeout(() => setState({ status: 'done', start, reach: computeReach(graph, node, buildings, cells, proj) }), 30)
  }

  // --- Urban Explorer: feedback helpers ---
  const later = (name, fn, ms) => {
    clearTimeout(timers.current[name])
    timers.current[name] = setTimeout(fn, ms)
  }
  const showToast = (t) => {
    setToast({ ...t, id: Date.now() })
    later('toast', () => setToast(null), t.big ? 3600 : 2400)
  }
  const celebrate = (big) => {
    if (!big) return
    setParty(Date.now())
    later('party', () => setParty(null), 2600)
  }
  const pop = (id) => {
    setPopId(id)
    later('pop', () => setPopId(null), 700)
  }

  // --- Urban Explorer: quests ---
  const quest = questId ? questById(questId) : null
  const ready = game.status === 'ready'
  const counts = useMemo(() => (ready ? targetCounts(features, game.reach.level) : null), [ready, game, features])
  const targets = useMemo(
    () => (ready && quest && k !== null ? targetsFor(features, game.reach.level, quest, k) : []),
    [ready, game, features, quest, k],
  )
  const collectedIds = useMemo(() => new Set(quest ? badges[quest.id] : []), [badges, quest])
  const collected = useMemo(() => targets.filter((i) => collectedIds.has(features[i].properties.id)), [targets, collectedIds, features])
  const route = useMemo(
    () => (selected !== null && ready ? routeToBuilding(model.graph, game.reach, model.buildings[selected]) : null),
    [selected, ready, game, model],
  )

  // --- Urban Explorer: challenges ---
  const challenge = challengeId ? CHALLENGES.find((c) => c.id === challengeId) : null
  const challengeQuest = challenge ? questById(challenge.quest) : null
  const prep = useMemo(
    () => (ready && challengeQuest ? prepareChallenge(model.graph, game.node, features, model.access, challengeQuest) : null),
    [ready, game, challengeQuest, model, features],
  )
  const eligible = useMemo(() => prep?.eligible ?? [], [prep])
  const trail = useMemo(() => (prep && stops.length ? trailRoute(model.graph, prep, stops, model.access) : null), [prep, stops, model])

  const resetPlay = () => {
    setSelected(null)
    setStops([])
    setResult(null)
  }

  const startGame = (xy) => {
    const { graph, buildings, cells, proj } = model
    const distance = distanceToStreet(graph, xy)
    resetPlay()
    if (distance > MAX_START_DISTANCE_M) {
      setGame({ status: 'far', distance })
      return
    }
    const node = nearestNode(graph, xy)
    const start = graph.nodeXY[node]
    setGame({ status: 'computing', start })
    setTimeout(() => {
      const reach = computeReach(graph, node, buildings, cells, proj)
      // Keep the chosen quest and time if they still have targets from here.
      const c = targetCounts(features, reach.level)
      if (questId && k !== null && c[questId][k] === 0) setK(null)
      setGame({ status: 'ready', start, node, reach })
    }, 30)
  }

  const toggleStop = (i) => {
    setResult(null)
    if (stops.includes(i)) setStops(stops.filter((s) => s !== i))
    else if (stops.length < CHALLENGE_STOPS) setStops([...stops, i])
    else showToast({ text: 'Three stops already: remove one to change your walk.' })
  }

  const pickGame = (xy, building) => {
    if (tab === 'quests' && building !== null && targets.includes(building)) setSelected(building)
    else if (tab === 'challenges' && prep?.best && building !== null && eligible.includes(building)) {
      // Clicking a building adds it; a chosen stop is removed with its gem or in the list.
      if (!stops.includes(building)) toggleStop(building)
    }
    else startGame(xy)
  }
  const selectMarker = (i) => (tab === 'quests' ? setSelected(i) : toggleStop(i))

  const collect = () => {
    if (selected === null || !quest) return
    const id = features[selected].properties.id
    if (collectedIds.has(id)) return
    const next = { ...badges, [quest.id]: [...badges[quest.id], id] }
    setBadges(next)
    saveBadges(next)
    const t = model.tops[selected]
    setBurst({ key: Date.now(), i: selected, x: t.x, y: t.y, top: t.top })
    pop(quest.id)
    const done = targets.every((i) => i === selected || collectedIds.has(features[i].properties.id))
    if (done) {
      celebrate(true)
      showToast({ icon: 'trophy', text: `Quest complete! All ${targets.length} ${quest.what} within ${[5, 10, 15][k]} min.`, big: true })
    } else showToast({ icon: quest.id, text: `Badge collected · ${collected.length + 1} of ${targets.length}` })
  }

  const completeTrail = () => {
    if (!prep?.best || !trail || stops.length < CHALLENGE_STOPS || trail.total > CHALLENGE_BUDGET_M) return
    const stars = starsFor(trail.total, prep.best.total)
    const old = achievements[challenge.id]
    const next = {
      ...achievements,
      [challenge.id]: {
        stars: Math.max(stars, old?.stars ?? 0),
        metres: Math.round(Math.min(trail.total, old?.metres ?? Infinity)),
      },
    }
    setAchievements(next)
    saveAchievements(next)
    setResult({ stars, total: trail.total, best: prep.best.total })
    pop(challenge.id)
    celebrate(true)
    showToast({ icon: 'trophy', text: `${challenge.name} complete! ${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}`, big: true })
  }

  const resetBadges = () => {
    if (!window.confirm('Reset all badges and trophies collected in this browser?')) return
    const empty = Object.fromEntries(QUESTS.map((q) => [q.id, []]))
    setBadges(empty)
    saveBadges(empty)
    setAchievements({})
    saveAchievements({})
    setResult(null)
  }

  const chooseQuest = (id) => {
    setQuestId(id)
    setSelected(null)
    if (k !== null && counts && counts[id][k] === 0) setK(null)
  }

  // --- What the 3D scene shows ---
  const questActive = tab === 'quests' && ready && !!quest && k !== null
  const trailActive = tab === 'challenges' && !!prep?.best
  const activeQuest = tab === 'quests' ? quest : challengeQuest

  const mapPaint = useMemo(() => ({ kind: 'reach', level: state.status === 'done' ? state.reach.level : null }), [state])
  const gamePaint = useMemo(() => {
    if (questActive)
      return { kind: 'game', targets: new Set(targets), collected: new Set(collected), chosen: new Set(selected !== null ? [selected] : []), colour: quest.colour, deep: quest.deep, gold: GOLD }
    if (trailActive)
      return { kind: 'game', targets: new Set(eligible), collected: new Set(), chosen: new Set(stops), colour: challengeQuest.colour, deep: challengeQuest.deep, gold: GOLD }
    return { kind: 'game', gold: GOLD }
  }, [questActive, trailActive, targets, collected, selected, quest, eligible, stops, challengeQuest])

  // Halos: soft shells around targets, gold around collected ones, a breathing one around the chosen.
  const glowIdx = questActive ? targets.filter((i) => !collected.includes(i) && i !== selected) : trailActive ? eligible.filter((i) => !stops.includes(i)) : []
  const goldIdx = questActive ? collected.filter((i) => i !== selected) : []
  const chosenIdx = questActive ? (selected !== null ? [selected] : []) : trailActive ? stops : []
  const glowKey = glowIdx.join(',')
  const goldKey = goldIdx.join(',')
  const chosenKey = chosenIdx.join(',')
  /* eslint-disable react-hooks/exhaustive-deps */
  const glowGeo = useMemo(() => model && buildHalo(features, glowIdx, model.proj, 2.2), [glowKey, model])
  const goldGeo = useMemo(() => model && buildHalo(features, goldIdx, model.proj, 2.6), [goldKey, model])
  const chosenGeo = useMemo(() => model && buildHalo(features, chosenIdx, model.proj, 3.4), [chosenKey, model])
  /* eslint-enable react-hooks/exhaustive-deps */

  let view
  if (mode === 'map') {
    const reach = state.status === 'done' ? state.reach : null
    view = {
      look: 'map',
      paint: mapPaint,
      areas: reach
        ? reach.results
            .map((r, kk) => r.shape && { key: `${state.start}-${kk}`, shape: r.shape, colour: REACH_COLOURS[kk], height: 0.9 - 0.3 * kk })
            .filter(Boolean)
        : [],
      start: state.start ?? null,
      onPick: (xy) => pickMap(xy),
    }
  } else {
    const markerIdx = questActive ? targets : trailActive ? eligible : []
    const markers = markerIdx.map((i) => {
      const state = (questActive ? i === selected : stops.includes(i)) ? 'chosen' : questActive && collected.includes(i) ? 'collected' : 'target'
      return { i, ...model.tops[i], state, colour: state === 'chosen' ? activeQuest.deep : activeQuest.colour }
    })
    const focusIdx = questActive ? selected : trailActive && stops.length ? stops[stops.length - 1] : null
    const gameRoute =
      questActive && route
        ? { key: `q-${game.start}-${selected}`, points: route.points, length: route.length, colour: quest.colour, deep: quest.deep }
        : trailActive && trail
          ? { key: `t-${game.start}-${stops.join('-')}`, points: trail.points, length: trail.total, colour: challengeQuest.colour, deep: challengeQuest.deep }
          : null
    view = {
      look: 'game',
      paint: gamePaint,
      areas:
        questActive && game.reach.results[k].shape
          ? [{ key: `${game.start}-${k}-${quest.id}`, shape: game.reach.results[k].shape, colour: quest.colour, height: 0.08, opacity: 0.1 }]
          : [],
      start: game.start ?? null,
      focus: focusIdx !== null ? [model.tops[focusIdx].x, model.tops[focusIdx].y] : null,
      onPick: pickGame,
      game: {
        halos: activeQuest
          ? [
              { key: 'glow', geometry: glowGeo, colour: activeQuest.colour, opacity: 0.22 },
              { key: 'gold', geometry: goldGeo, colour: GOLD, opacity: 0.32 },
              { key: 'chosen', geometry: chosenGeo, colour: activeQuest.deep, opacity: 0.38, pulse: true },
            ]
          : [],
        markers,
        onSelect: selectMarker,
        pulse:
          questActive && selected !== null
            ? { ...model.tops[selected], size: model.tops[selected].r + 6, colour: quest.deep }
            : null,
        tokens: trailActive ? stops.map((i, n) => ({ i, ...model.tops[i], n: n + 1, colour: challengeQuest.deep })) : [],
        route: gameRoute,
        burst: burst && { key: burst.key, x: burst.x, y: burst.y, top: burst.top },
      },
    }
  }

  return (
    <div className={`app mode-${mode}`}>
      {model && <City kit={data.kit} buildings={features} graph={model.graph} proj={model.proj} {...view} />}
      <div className="side">
        <div className="switch" role="tablist">
          <button role="tab" aria-selected={mode === 'map'} className={mode === 'map' ? 'on' : ''} onClick={() => setMode('map')}>
            Walking Map
          </button>
          <button role="tab" aria-selected={mode === 'game'} className={mode === 'game' ? 'on' : ''} onClick={() => setMode('game')}>
            Urban Explorer
          </button>
        </div>
        {mode === 'map' ? (
          <Panel loading={!model && !error} error={error} state={state} kit={data?.kit} />
        ) : (
          <GamePanel
            loading={!model && !error}
            error={error}
            game={game}
            tab={tab}
            onTab={(t) => {
              setTab(t)
              setSelected(null)
            }}
            counts={counts}
            quest={quest}
            k={k}
            targets={targets}
            collected={collected}
            onQuest={chooseQuest}
            onTime={(kk) => {
              setK(kk)
              setSelected(null)
            }}
            challenge={challenge}
            challengeQuest={challengeQuest}
            prep={prep}
            stops={stops}
            trail={trail}
            result={result}
            achievements={achievements}
            features={features}
            onChallenge={(id) => {
              setChallengeId(id)
              setStops([])
              setResult(null)
            }}
            onToggleStop={toggleStop}
            onClearStops={() => {
              setStops([])
              setResult(null)
            }}
            onComplete={completeTrail}
            onNewWalk={() => {
              setGame({ status: 'idle' })
              resetPlay()
            }}
          />
        )}
      </div>
      {model && mode === 'map' && <Legend />}
      {model && mode === 'game' && (
        <GameSide badges={badges} achievements={achievements} totals={model.totals} quest={activeQuest} popId={popId} onReset={resetBadges} />
      )}
      {mode === 'game' && questActive && selected !== null && (
        <TargetCard
          quest={quest}
          feature={features[selected]}
          route={route}
          isCollected={collectedIds.has(features[selected].properties.id)}
          onCollect={collect}
          onClose={() => setSelected(null)}
          burstKey={burst?.i === selected ? burst.key : null}
        />
      )}
      {mode === 'game' && toast && (
        <div key={toast.id} className={`toast${toast.big ? ' big' : ''}`}>
          <span className="toast-icon">{toast.icon === 'trophy' ? <TrophyIcon size={22} /> : toast.icon ? questIcon(toast.icon, { size: 20 }) : '✦'}</span>
          {toast.text}
        </div>
      )}
      {mode === 'game' && party && <Confetti key={party} big />}
      <p className="attribution">{ATTRIBUTION}</p>
    </div>
  )
}
