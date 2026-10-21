import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

// Quiet colours for each main use, in the order of the legend (most common first).
export const USE_COLOURS = [
  ['residential', '#e4d8bf'],
  ['undefined', '#d3d1cb'],
  ['service', '#b7c3cb'],
  ['education', '#c4b8d4'],
  ['food_and_drink', '#dcae95'],
  ['office', '#a2b6b8'],
  ['retail', '#e2c0a3'],
  ['accommodation', '#d1c59d'],
  ['entertainment', '#d8b6c2'],
  ['civic', '#a9b4c8'],
  ['health', '#b7d0b4'],
  ['culture', '#bba8c6'],
  ['transport', '#a8a59d'],
  ['sport', '#acc5a3'],
  ['light_industrial', '#b4a48f'],
  [null, '#8f8f8f'], // one building has no use in the data
]

export const useLabel = (use) => (use === null ? 'no use given' : use.replaceAll('_', ' '))

// Three shades of one accent colour, for 5, 10 and 15 minutes.
export const REACH_COLOURS = ['#1d6a70', '#4f9ea3', '#a9d4d5']

const useColour = new Map(USE_COLOURS.map(([u, c]) => [u, new THREE.Color(c)]))
const reachColour = REACH_COLOURS.map((c) => new THREE.Color(c))

// Extrudes every footprint to its height and merges them into one geometry.
// ranges[i] = [first vertex, vertex count] of building i, so its colour can be changed later.
export function buildCity(features, proj) {
  const parts = []
  const ranges = []
  const base = []
  let offset = 0
  for (const f of features) {
    const rings = f.geometry.coordinates.map((ring) => {
      const pts = ring.map((p) => new THREE.Vector2(...proj.toXY(p)))
      if (pts.length > 1 && pts[0].equals(pts[pts.length - 1])) pts.pop()
      return pts
    })
    const shape = new THREE.Shape(rings[0])
    shape.holes = rings.slice(1).map((r) => new THREE.Path(r))
    const geo = new THREE.ExtrudeGeometry(shape, { depth: f.properties.height, bevelEnabled: false })
    // The shape lies in x (east) / y (north) and extrudes along z; turn it so z points up.
    geo.rotateX(-Math.PI / 2)
    const count = geo.attributes.position.count
    ranges.push([offset, count])
    base.push(useColour.get(f.properties.use ?? null) ?? useColour.get(null))
    offset += count
    parts.push(geo)
  }
  const geometry = mergeGeometries(parts, false)
  parts.forEach((g) => g.dispose())
  geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(offset * 3), 3))
  const uses = features.map((f) => f.properties.use ?? null)
  const ids = features.map((f) => f.properties.id)
  const city = { geometry, ranges, base, uses, ids }
  paintCity(city, null)
  return city
}

// Colours each building by its use, or by the shade of the smallest walking area it touches.
export function paintCity({ geometry, ranges, base }, level) {
  const colours = geometry.attributes.color
  ranges.forEach(([start, count], i) => {
    const c = level && level[i] !== -1 ? reachColour[level[i]] : base[i]
    for (let v = start; v < start + count; v++) colours.setXYZ(v, c.r, c.g, c.b)
  })
  colours.needsUpdate = true
}

// --- Urban Explorer look ------------------------------------------------------

// A restrained family for the miniature city: ivory, stone, slate blue and dusty lavender.
const GAME_USE = {
  residential: '#f1ece2',
  undefined: '#e4ded3',
  service: '#d3d7df',
  office: '#c8cfda',
  retail: '#e5d8cd',
  accommodation: '#e9e1cf',
  civic: '#cdd3da',
  health: '#d8dcda',
  sport: '#d9dbcf',
  transport: '#d0cbc3',
  light_industrial: '#d5cdc2',
  culture: '#dcd5e4',
  entertainment: '#ded5de',
  food_and_drink: '#e6d5c9',
  education: '#d1d8e1',
}
const GAME_NONE = '#d2ccc3'

// A small, stable variation per building so the city does not look flat.
function jitter(id) {
  let h = 2166136261
  for (const ch of String(id)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619)
  return ((h >>> 0) % 1000) / 1000 - 0.5
}

// Game colouring. Roofs (upward faces) are a little lighter, wall feet a little darker,
// which gives the miniature look. Targets take the quest colour, chosen ones its deep shade,
// collected ones warm gold.
export function paintGame(city, { targets, collected, chosen, colour, deep, gold }) {
  const { geometry, ranges, uses, ids } = city
  const colours = geometry.attributes.color
  const normals = geometry.attributes.normal
  const pos = geometry.attributes.position
  const tmp = new THREE.Color()
  const target = new THREE.Color(colour ?? '#ffffff')
  const deepC = new THREE.Color(deep ?? '#ffffff')
  const goldC = new THREE.Color(gold)
  const roofGold = new THREE.Color('#e8cf95')
  const white = new THREE.Color('#ffffff')
  const baseOf = (i) => new THREE.Color(GAME_USE[uses[i]] ?? GAME_NONE).offsetHSL(0, 0, jitter(ids[i]) * 0.05)
  ranges.forEach(([start, count], i) => {
    const state = chosen?.has(i) ? 'chosen' : collected?.has(i) ? 'collected' : targets?.has(i) ? 'target' : 'base'
    const wall = state === 'chosen' ? deepC : state === 'collected' ? goldC : state === 'target' ? target : baseOf(i)
    const roof = state === 'collected' ? roofGold : wall.clone().lerp(white, state === 'base' ? 0.45 : 0.3)
    let top = 0
    for (let v = start; v < start + count; v++) top = Math.max(top, pos.getY(v))
    for (let v = start; v < start + count; v++) {
      if (normals.getY(v) > 0.9) tmp.copy(roof)
      else {
        // Walls darken a little towards the ground, like soft ambient occlusion.
        const f = top > 0 ? pos.getY(v) / top : 1
        tmp.copy(wall).multiplyScalar(0.7 + 0.24 * f)
      }
      colours.setXYZ(v, tmp.r, tmp.g, tmp.b)
    }
  })
  colours.needsUpdate = true
}

// A soft shell around some buildings, slightly larger than each, drawn from the inside
// so it reads as a glow or outline around the building.
export function buildHalo(features, indices, proj, grow = 2.5) {
  if (!indices.length) return null
  const parts = indices.map((i) => {
    const f = features[i]
    const ring = f.geometry.coordinates[0].map(proj.toXY)
    const cx = ring.reduce((s, p) => s + p[0], 0) / ring.length
    const cy = ring.reduce((s, p) => s + p[1], 0) / ring.length
    const r = Math.max(4, ...ring.map(([x, y]) => Math.hypot(x - cx, y - cy)))
    const shape = new THREE.Shape(ring.map(([x, y]) => new THREE.Vector2(x, y)))
    const h = f.properties.height
    const geo = new THREE.ExtrudeGeometry(shape, { depth: h, bevelEnabled: false })
    geo.rotateX(-Math.PI / 2)
    const s = (r + grow) / r
    geo.translate(-cx, 0, cy)
    geo.scale(s, (h + grow) / h, s)
    geo.translate(cx, 0, -cy)
    return geo
  })
  const merged = mergeGeometries(parts, false)
  parts.forEach((g) => g.dispose())
  return merged
}

// Which building a point on the merged mesh belongs to, from the hit triangle.
export function buildingAt({ ranges }, faceIndex) {
  const vertex = faceIndex * 3
  let lo = 0
  let hi = ranges.length - 1
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1
    if (ranges[mid][0] <= vertex) lo = mid
    else hi = mid - 1
  }
  return lo
}
