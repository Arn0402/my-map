import { buffer, multiLineString } from '@turf/turf'

export const SPEED_M_PER_MIN = 80 // 4.8 km/h
export const MINUTES = [5, 10, 15]
export const BAND_M = 25
export const MAX_START_DISTANCE_M = 100

// Builds the routing network from streets.graph.json, keeping only walkable edges.
export function makeGraph(graph, proj) {
  const edges = graph.edges.filter((e) => e.walkable)
  const index = new Map(graph.nodes.map((n, i) => [n.id, i]))
  const adj = graph.nodes.map(() => [])
  const onWalkable = new Uint8Array(graph.nodes.length)
  for (const e of edges) {
    const a = index.get(e.from)
    const b = index.get(e.to)
    adj[a].push([b, e.length])
    adj[b].push([a, e.length])
    onWalkable[a] = onWalkable[b] = 1
  }
  const nodeXY = graph.nodes.map((n) => proj.toXY([n.lon, n.lat]))
  const edgeXY = edges.map((e) => e.coords.map(proj.toXY))
  return { nodes: graph.nodes, edges, index, adj, onWalkable, nodeXY, edgeXY }
}

function distToSegment([px, py], [ax, ay], [bx, by]) {
  const dx = bx - ax
  const dy = by - ay
  const len2 = dx * dx + dy * dy
  const t = len2 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2)) : 0
  return Math.hypot(px - ax - t * dx, py - ay - t * dy)
}

// The distance in metres from a point to the nearest walkable street line.
export function distanceToStreet(g, xy) {
  let best = Infinity
  for (const line of g.edgeXY) {
    for (let i = 0; i < line.length - 1; i++) best = Math.min(best, distToSegment(xy, line[i], line[i + 1]))
  }
  return best
}

// The index of the nearest node that lies on a walkable edge.
export function nearestNode(g, [x, y]) {
  let best = -1
  let bestD = Infinity
  g.nodeXY.forEach(([nx, ny], i) => {
    if (!g.onWalkable[i]) return
    const d = Math.hypot(nx - x, ny - y)
    if (d < bestD) {
      bestD = d
      best = i
    }
  })
  return best
}

// Shortest walking distance in metres from the start node to every node (Dijkstra).
// If `prev` is given, it is filled with the node each shortest walk arrives from.
function walkDistances(g, start, limit, prev = null) {
  return dijkstra(g, [[start, 0]], limit, prev)
}

// Dijkstra from one or more seed nodes, each with a starting distance.
function dijkstra(g, seeds, limit, prev) {
  const dist = new Float64Array(g.nodes.length).fill(Infinity)
  const heap = []
  for (const [n, d] of seeds) {
    if (d < dist[n]) {
      dist[n] = d
      heap.push([d, n])
    }
  }
  heap.sort((a, b) => a[0] - b[0])
  const push = (item) => {
    heap.push(item)
    let i = heap.length - 1
    while (i > 0) {
      const p = (i - 1) >> 1
      if (heap[p][0] <= heap[i][0]) break
      ;[heap[p], heap[i]] = [heap[i], heap[p]]
      i = p
    }
  }
  const pop = () => {
    const top = heap[0]
    const last = heap.pop()
    if (heap.length) {
      heap[0] = last
      let i = 0
      for (;;) {
        const l = 2 * i + 1
        const r = l + 1
        let m = i
        if (l < heap.length && heap[l][0] < heap[m][0]) m = l
        if (r < heap.length && heap[r][0] < heap[m][0]) m = r
        if (m === i) break
        ;[heap[m], heap[i]] = [heap[i], heap[m]]
        i = m
      }
    }
    return top
  }
  while (heap.length) {
    const [d, u] = pop()
    if (d > dist[u] || d > limit) continue
    for (const [v, len] of g.adj[u]) {
      const nd = d + len
      if (nd < dist[v]) {
        dist[v] = nd
        if (prev) prev[v] = u
        push([nd, v])
      }
    }
  }
  return dist
}

// A point a given fraction of the way along a polyline.
function pointAlong(coords, lengths, total, fraction) {
  let target = fraction * total
  for (let i = 0; i < lengths.length; i++) {
    if (target <= lengths[i] || i === lengths.length - 1) {
      const t = lengths[i] ? Math.min(1, target / lengths[i]) : 0
      const [ax, ay] = coords[i]
      const [bx, by] = coords[i + 1]
      return [ax + t * (bx - ax), ay + t * (by - ay)]
    }
    target -= lengths[i]
  }
  return coords[coords.length - 1]
}

// Part of a polyline from its start up to a fraction of its length.
function headOf(coords, lengths, total, fraction) {
  const out = [coords[0]]
  let target = fraction * total
  for (let i = 0; i < lengths.length; i++) {
    if (target < lengths[i]) {
      out.push(pointAlong([coords[i], coords[i + 1]], [lengths[i]], lengths[i], target / lengths[i]))
      return out
    }
    out.push(coords[i + 1])
    target -= lengths[i]
  }
  return out
}

// The street pieces reachable within a walking budget in metres, as lon/lat lines.
function reachedLines(g, dist, budget) {
  const lines = []
  g.edges.forEach((e, k) => {
    const du = dist[g.index.get(e.from)]
    const dv = dist[g.index.get(e.to)]
    const a = Math.max(0, budget - du) // metres walkable into the edge from its "from" end
    const b = Math.max(0, budget - dv) // and from its "to" end
    if (a === 0 && b === 0) return
    const coords = e.coords
    if (a + b >= e.length) {
      lines.push(coords)
      return
    }
    // The drawn line and the edge length differ by under 1 %, so we share them out by fraction.
    const xy = g.edgeXY[k]
    const lengths = xy.slice(1).map((p, i) => Math.hypot(p[0] - xy[i][0], p[1] - xy[i][1]))
    const total = lengths.reduce((s, l) => s + l, 0)
    if (a > 0) lines.push(headOf(coords, lengths, total, a / e.length))
    if (b > 0) {
      const rev = [...coords].reverse()
      lines.push(headOf(rev, [...lengths].reverse(), total, b / e.length))
    }
  })
  return lines
}

// --- Geometry in local metres ---------------------------------------------

function boxOf(points) {
  const b = [Infinity, Infinity, -Infinity, -Infinity]
  for (const [x, y] of points) {
    if (x < b[0]) b[0] = x
    if (y < b[1]) b[1] = y
    if (x > b[2]) b[2] = x
    if (y > b[3]) b[3] = y
  }
  return b
}

function boxesOverlap(a, b, pad = 0) {
  return a[0] - pad <= b[2] && a[2] + pad >= b[0] && a[1] - pad <= b[3] && a[3] + pad >= b[1]
}

function signedArea(ring) {
  let s = 0
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) s += (ring[j][0] - ring[i][0]) * (ring[j][1] + ring[i][1])
  return s / 2
}

function pointInRings([x, y], rings) {
  let inside = false
  for (const ring of rings) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i]
      const [xj, yj] = ring[j]
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside
    }
  }
  return inside
}

function cross(ax, ay, bx, by, cx, cy) {
  return (bx - ax) * (cy - ay) - (by - ay) * (cx - ax)
}

function segmentsCross(a, b, c, d) {
  const d1 = cross(c[0], c[1], d[0], d[1], a[0], a[1])
  const d2 = cross(c[0], c[1], d[0], d[1], b[0], b[1])
  const d3 = cross(a[0], a[1], b[0], b[1], c[0], c[1])
  const d4 = cross(a[0], a[1], b[0], b[1], d[0], d[1])
  return d1 * d2 <= 0 && d3 * d4 <= 0
}

function segmentDistance(a, b, c, d) {
  if (segmentsCross(a, b, c, d)) return 0
  return Math.min(distToSegment(a, c, d), distToSegment(b, c, d), distToSegment(c, a, b), distToSegment(d, a, b))
}

// Does a polygon (rings in metres) come within `band` metres of a street segment?
function polygonNearSegment(rings, a, b, band) {
  if (pointInRings(a, rings)) return true
  for (const ring of rings) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      if (segmentDistance(ring[j], ring[i], a, b) <= band) return true
    }
  }
  return false
}

// Clips a ring to a convex polygon (Sutherland–Hodgman); the clipped ring's area
// is exactly the part of the ring's area inside the convex polygon.
function clipRing(ring, clip) {
  let out = ring
  const ccw = signedArea(clip) > 0
  for (let i = 0; i < clip.length && out.length; i++) {
    const p = clip[i]
    const q = clip[(i + 1) % clip.length]
    const inside = (pt) => (cross(p[0], p[1], q[0], q[1], pt[0], pt[1]) >= 0) === ccw
    const input = out
    out = []
    for (let k = 0; k < input.length; k++) {
      const cur = input[k]
      const prev = input[(k + input.length - 1) % input.length]
      const ci = inside(cur)
      if (ci !== inside(prev)) {
        const [x1, y1] = prev
        const [x2, y2] = cur
        const a1 = cross(p[0], p[1], q[0], q[1], x1, y1)
        const a2 = cross(p[0], p[1], q[0], q[1], x2, y2)
        const t = a1 / (a1 - a2)
        out.push([x1 + t * (x2 - x1), y1 + t * (y2 - y1)])
      }
      if (ci) out.push(cur)
    }
  }
  return out
}

function openRing(ring, proj) {
  const pts = ring.map(proj.toXY)
  const [fx, fy] = pts[0]
  const [lx, ly] = pts[pts.length - 1]
  if (fx === lx && fy === ly) pts.pop()
  return pts
}

function polygonsOf(geometry) {
  return geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.type === 'MultiPolygon' ? geometry.coordinates : []
}

// Buildings and census cells in metres, prepared once so each click is quick.
export function prepareBuildings(features, proj) {
  return features.map((f) => {
    const rings = polygonsOf(f.geometry)[0].map((r) => openRing(r, proj))
    return { rings, box: boxOf(rings[0]) }
  })
}

export function prepareCells(features, proj) {
  return features.map((f) => {
    const ring = openRing(polygonsOf(f.geometry)[0][0], proj)
    return { ring, box: boxOf(ring), area: Math.abs(signedArea(ring)), population: f.properties.population }
  })
}

// --- One click ------------------------------------------------------------

const GRID = 50 // metres per cell of the lookup grid for street pieces

// Everything for one click: the three areas, which buildings they touch, and the residents.
export function computeReach(g, startNode, buildings, cells, proj) {
  const budgets = MINUTES.map((m) => m * SPEED_M_PER_MIN)
  const prev = new Int32Array(g.nodes.length).fill(-1)
  const dist = walkDistances(g, startNode, Math.max(...budgets), prev)

  // level[i] = index of the smallest area building i touches, or -1. Areas are nested.
  const level = new Int8Array(buildings.length).fill(-1)
  let candidates = buildings.map((_, i) => i)

  const results = []
  for (let k = budgets.length - 1; k >= 0; k--) {
    const lines = reachedLines(g, dist, budgets[k])
    const shape = lines.length ? buffer(multiLineString(lines), BAND_M, { units: 'meters' }) : null

    // Street pieces in metres, in a grid so each building only checks pieces nearby.
    const grid = new Map()
    for (const line of lines) {
      const pts = line.map(proj.toXY)
      for (let i = 0; i < pts.length - 1; i++) {
        const seg = [pts[i], pts[i + 1]]
        const [x0, y0, x1, y1] = boxOf(seg)
        for (let gx = Math.floor((x0 - BAND_M) / GRID); gx <= Math.floor((x1 + BAND_M) / GRID); gx++) {
          for (let gy = Math.floor((y0 - BAND_M) / GRID); gy <= Math.floor((y1 + BAND_M) / GRID); gy++) {
            const key = gx + ',' + gy
            if (!grid.has(key)) grid.set(key, [])
            grid.get(key).push(seg)
          }
        }
      }
    }
    candidates = candidates.filter((i) => {
      const { rings, box } = buildings[i]
      const seen = new Set()
      for (let gx = Math.floor(box[0] / GRID); gx <= Math.floor(box[2] / GRID); gx++) {
        for (let gy = Math.floor(box[1] / GRID); gy <= Math.floor(box[3] / GRID); gy++) {
          for (const seg of grid.get(gx + ',' + gy) || []) {
            if (seen.has(seg)) continue
            seen.add(seg)
            if (boxesOverlap(box, boxOf(seg), BAND_M) && polygonNearSegment(rings, seg[0], seg[1], BAND_M)) return true
          }
        }
      }
      return false
    })
    for (const i of candidates) level[i] = k

    // Residents: each cell's population times the share of its area inside the shape.
    let residents = 0
    let cellsWithoutFigure = 0
    if (shape) {
      const polys = polygonsOf(shape.geometry).map((p) => p.map((r) => openRing(r, proj)))
      const shapeBox = boxOf(polys.flatMap((p) => p[0]))
      for (const cell of cells) {
        if (!boxesOverlap(cell.box, shapeBox)) continue
        let inside = 0
        for (const poly of polys) {
          if (!boxesOverlap(cell.box, boxOf(poly[0]))) continue
          // The outer ring's overlap minus the overlap of its holes.
          poly.forEach((ring, r) => {
            const a = Math.abs(signedArea(clipRing(ring, cell.ring)))
            inside += r === 0 ? a : -a
          })
        }
        const share = Math.min(1, inside / cell.area)
        if (share < 1e-9) continue
        if (cell.population === null || cell.population === undefined) cellsWithoutFigure++
        else residents += cell.population * share
      }
    }

    results[k] = {
      minutes: MINUTES[k],
      shape,
      buildings: candidates.length,
      residents: Math.round(residents / 10) * 10,
      cellsWithoutFigure,
    }
  }

  return { results, level, dist, prev }
}

// --- Routes (Urban Explorer) ----------------------------------------------

// The shortest walk from the start to a building: to the nearest point of the network that lies
// within the 25 m band of the building, the same rule that decides whether a building is reached.
// Returns the route as points in metres and its length in metres, or null if there is none.
export function routeToBuilding(g, reach, building) {
  const { dist, prev } = reach
  const { rings, box } = building
  let best = null
  g.edges.forEach((e, k) => {
    const xy = g.edgeXY[k]
    if (!boxesOverlap(box, boxOf(xy), BAND_M)) return
    const u = g.index.get(e.from)
    const v = g.index.get(e.to)
    if (dist[u] === Infinity && dist[v] === Infinity) return
    const lengths = xy.slice(1).map((p, i) => Math.hypot(p[0] - xy[i][0], p[1] - xy[i][1]))
    const total = lengths.reduce((s, l) => s + l, 0)
    const steps = Math.max(1, Math.ceil(total / 0.5))
    for (let s = 0; s <= steps; s++) {
      const t = s / steps
      const p = pointAlong(xy, lengths, total, t)
      if (!pointNearPolygon(p, rings, BAND_M)) continue
      const fromU = dist[u] + t * e.length
      const fromV = dist[v] + (1 - t) * e.length
      const walk = Math.min(fromU, fromV)
      if (!best || walk < best.length) best = { length: walk, node: fromU <= fromV ? u : v, k, t, fromU: fromU <= fromV }
    }
  })
  if (!best) return null

  // Nodes from the start to where the walk leaves the network, then the piece along the last edge.
  const nodes = []
  for (let n = best.node; n !== -1; n = prev[n]) nodes.push(n)
  const points = nodes.reverse().map((n) => g.nodeXY[n])
  const xy = g.edgeXY[best.k]
  const lengths = xy.slice(1).map((p, i) => Math.hypot(p[0] - xy[i][0], p[1] - xy[i][1]))
  const total = lengths.reduce((s, l) => s + l, 0)
  const piece = best.fromU
    ? headOf(xy, lengths, total, best.t)
    : headOf([...xy].reverse(), [...lengths].reverse(), total, 1 - best.t)
  points.push(...piece.slice(1))
  return { points, length: best.length }
}

function pointNearPolygon(p, rings, band) {
  if (pointInRings(p, rings)) return true
  for (const ring of rings) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      if (distToSegment(p, ring[j], ring[i]) <= band) return true
    }
  }
  return false
}

// --- Challenges: walks between points on the network ------------------------

// The point of the network nearest to a building's footprint: edge k, fraction t along it,
// and its distance d in metres from the footprint (0 if the street touches or crosses it).
export function accessPoint(g, building) {
  const { rings, box } = building
  let best = { k: -1, t: 0, d: Infinity }
  const consider = (k, t, d) => {
    if (d < best.d) best = { k, t, d }
  }
  g.edges.forEach((e, k) => {
    const xy = g.edgeXY[k]
    if (!boxesOverlap(box, boxOf(xy), 60)) return
    const a = xy[0]
    const b = xy[xy.length - 1]
    const len2 = (b[0] - a[0]) ** 2 + (b[1] - a[1]) ** 2
    const tOf = (p) => (len2 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * (b[0] - a[0]) + (p[1] - a[1]) * (b[1] - a[1])) / len2)) : 0)
    if (pointInRings(a, rings)) consider(k, 0, 0)
    if (pointInRings(b, rings)) consider(k, 1, 0)
    for (const ring of rings) {
      for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const c = ring[j]
        const d = ring[i]
        if (segmentsCross(a, b, c, d)) {
          // Where the street crosses the wall.
          const den = (b[0] - a[0]) * (d[1] - c[1]) - (b[1] - a[1]) * (d[0] - c[0])
          const t = den ? ((c[0] - a[0]) * (d[1] - c[1]) - (c[1] - a[1]) * (d[0] - c[0])) / den : 0
          consider(k, Math.max(0, Math.min(1, t)), 0)
          continue
        }
        consider(k, tOf(c), distToSegment(c, a, b))
        consider(k, tOf(d), distToSegment(d, a, b))
        consider(k, 0, distToSegment(a, c, d))
        consider(k, 1, distToSegment(b, c, d))
      }
    }
  })
  return best
}

// Seeds for a walk starting at a node ({ node }) or at a point on an edge ({ k, t }).
function seedsOf(g, from) {
  if (from.node !== undefined) return [[from.node, 0]]
  const e = g.edges[from.k]
  return [
    [g.index.get(e.from), from.t * e.length],
    [g.index.get(e.to), (1 - from.t) * e.length],
  ]
}

// Shortest walking distances from a start (node or point on an edge) to every node.
export function distancesFrom(g, from) {
  const prev = new Int32Array(g.nodes.length).fill(-1)
  const dist = dijkstra(g, seedsOf(g, from), Infinity, prev)
  return { from, dist, prev }
}

// Walking distance in metres from the start of `walk` (made by distancesFrom) to a point on an edge.
export function distanceTo(g, walk, to) {
  const e = g.edges[to.k]
  let d = Math.min(walk.dist[g.index.get(e.from)] + to.t * e.length, walk.dist[g.index.get(e.to)] + (1 - to.t) * e.length)
  if (walk.from.k === to.k) d = Math.min(d, Math.abs(walk.from.t - to.t) * e.length)
  return d
}

function pointOnEdge(g, { k, t }) {
  const [a, b] = [g.edgeXY[k][0], g.edgeXY[k][g.edgeXY[k].length - 1]]
  return [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])]
}

// The shortest walk between two places along the network, as points in metres, with its length.
export function routeBetween(g, walk, to) {
  const from = walk.from
  const fromXY = from.node !== undefined ? g.nodeXY[from.node] : pointOnEdge(g, from)
  const toXY = pointOnEdge(g, to)
  const e = g.edges[to.k]
  if (from.k === to.k && Math.abs(from.t - to.t) * e.length <= distanceTo(g, walk, to) + 1e-9) {
    return { points: [fromXY, toXY], length: Math.abs(from.t - to.t) * e.length }
  }
  const u = g.index.get(e.from)
  const v = g.index.get(e.to)
  const viaU = walk.dist[u] + to.t * e.length <= walk.dist[v] + (1 - to.t) * e.length
  const nodes = []
  for (let n = viaU ? u : v; n !== -1; n = walk.prev[n]) nodes.push(n)
  nodes.reverse()
  const points = [fromXY, ...nodes.map((n) => g.nodeXY[n]), toXY]
  return { points, length: distanceTo(g, walk, to) }
}
