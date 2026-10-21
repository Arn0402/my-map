// The Urban Explorer look: a pastel miniature diorama with soft light, gem markers,
// a glowing animated route and small celebrations. All positions come from the kit data.
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { Html, RoundedBox } from '@react-three/drei'

// Restrained palette: soft stone ground, ivory paths, a darker stone edge to the tile.
export const GAME_GROUND = '#d6cfc3'
const SLAB = '#a9a194'
const PATH = '#f6f2ea'

// --- Small generated textures -------------------------------------------------

function canvasTexture(w, h, draw) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  draw(c.getContext('2d'), w, h)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

const glowTexture = () =>
  canvasTexture(64, 64, (ctx, w) => {
    const g = ctx.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2)
    g.addColorStop(0, 'rgba(255,255,255,1)')
    g.addColorStop(0.35, 'rgba(255,250,235,0.75)')
    g.addColorStop(1, 'rgba(255,240,220,0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, w, w)
  })

const sparkleTexture = () =>
  canvasTexture(64, 64, (ctx, w) => {
    ctx.translate(w / 2, w / 2)
    ctx.fillStyle = '#fff'
    ctx.beginPath()
    for (let i = 0; i < 8; i++) {
      const r = i % 2 ? 7 : 30
      const a = (i * Math.PI) / 4
      ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r)
    }
    ctx.closePath()
    ctx.fill()
  })

// One glow texture shared by all markers.
let glowShared = null
const sharedGlow = () => (glowShared ??= glowTexture())

// --- World ----------------------------------------------------------------------

export function GameLights() {
  const sun = useRef()
  // The shadow camera's new bounds only take effect after this update.
  useEffect(() => {
    sun.current?.shadow.camera.updateProjectionMatrix()
  }, [])
  return (
    <>
      <fog attach="fog" args={['#ebe8e2', 2600, 7000]} />
      <hemisphereLight args={['#eef0f4', '#e6e0d5', 1.15]} />
      <ambientLight intensity={0.2} />
      <directionalLight
        ref={sun}
        color="#fff7ec"
        intensity={2.2}
        position={[-900, 1300, 700]}
        castShadow
        shadow-mapSize={[4096, 4096]}
        shadow-camera-left={-1400}
        shadow-camera-right={1400}
        shadow-camera-top={1400}
        shadow-camera-bottom={-1400}
        shadow-camera-near={100}
        shadow-camera-far={4000}
        shadow-bias={-0.0004}
        shadow-normalBias={0.6}
      />
    </>
  )
}

// The kit area as a thick rounded tile under the ground.
export function Diorama({ w, h }) {
  return (
    <>
      <RoundedBox args={[w + 320, 44, h + 320]} radius={22} smoothness={4} position={[0, -22.2, 0]} raycast={() => null}>
      <meshStandardMaterial color={SLAB} roughness={1} />
      </RoundedBox>
    </>
  )
}

// Streets as soft pale paths with rounded joins, one mesh.
export function Paths({ graph }) {
  const geometry = useMemo(() => {
    const pos = []
    const half = 2.3
    const y = 0.2
    graph.edgeXY.forEach((line) => {
      for (let i = 0; i < line.length - 1; i++) {
        const [ax, ay] = line[i]
        const [bx, by] = line[i + 1]
        const len = Math.hypot(bx - ax, by - ay) || 1
        const nx = (-(by - ay) / len) * half
        const ny = ((bx - ax) / len) * half
        const p = [
          [ax + nx, ay + ny],
          [ax - nx, ay - ny],
          [bx - nx, by - ny],
          [bx + nx, by + ny],
        ].map(([x, yy]) => [x, y, -yy])
        pos.push(...p[0], ...p[1], ...p[2], ...p[0], ...p[2], ...p[3])
      }
    })
    graph.nodeXY.forEach(([x, yy]) => {
      for (let s = 0; s < 10; s++) {
        const a0 = (s / 10) * Math.PI * 2
        const a1 = ((s + 1) / 10) * Math.PI * 2
        pos.push(x, y, -yy, x + Math.cos(a1) * half, y, -(yy + Math.sin(a1) * half), x + Math.cos(a0) * half, y, -(yy + Math.sin(a0) * half))
      }
    })
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
    g.computeVertexNormals()
    return g
  }, [graph])
  return (
    <mesh geometry={geometry} receiveShadow raycast={() => null}>
      <meshStandardMaterial color={PATH} roughness={1} side={THREE.DoubleSide} />
    </mesh>
  )
}

// A soft shell around buildings. `pulse` makes it breathe.
export function Halo({ geometry, colour, opacity = 0.4, pulse = false }) {
  const mat = useRef()
  useFrame(({ clock }) => {
    if (pulse && mat.current) mat.current.opacity = opacity * (0.65 + 0.35 * Math.sin(clock.elapsedTime * 4))
  })
  if (!geometry) return null
  return (
    <mesh geometry={geometry} raycast={() => null} renderOrder={2}>
      <meshBasicMaterial ref={mat} color={colour} transparent opacity={opacity} side={THREE.BackSide} depthWrite={false} />
    </mesh>
  )
}

// --- Markers ----------------------------------------------------------------------

const zoomScale = (camera, obj) => THREE.MathUtils.clamp(camera.position.distanceTo(obj.position) / 420, 0.5, 4.5)

const starShape = (() => {
  const s = new THREE.Shape()
  for (let i = 0; i < 10; i++) {
    const r = i % 2 ? 1.6 : 4
    const a = Math.PI / 2 + (i * Math.PI) / 5
    if (i === 0) s.moveTo(Math.cos(a) * r, Math.sin(a) * r)
    else s.lineTo(Math.cos(a) * r, Math.sin(a) * r)
  }
  s.closePath()
  return s
})()

// A small floating gem above a target; a gold star once collected.
export function Gem({ marker, onClick }) {
  const ref = useRef()
  const spin = useRef()
  const phase = useMemo(() => Math.random() * Math.PI * 2, [])
  const gemGlow = useMemo(sharedGlow, [])
  useFrame(({ clock, camera }, dt) => {
    if (!ref.current) return
    const z = zoomScale(camera, ref.current)
    const t = clock.elapsedTime
    const chosen = marker.state === 'chosen'
    const bob = marker.state === 'collected' ? 0 : chosen ? Math.abs(Math.sin(t * 4)) * 5 * z : Math.sin(t * 2 + phase) * 1.6 * z
    ref.current.position.y = marker.top + 6 * z + bob
    ref.current.scale.setScalar(z)
    if (spin.current) {
      // Only the gem itself grows when chosen; the click zone stays small so neighbours stay clickable.
      const s = chosen ? 1.6 : 1
      spin.current.scale.lerp(new THREE.Vector3(s, s, s), 0.15)
      spin.current.rotation.y += dt * (chosen ? 2.4 : 0.9)
    }
  })

  return (
    // Gems are drawn over the buildings, so they always show and can always be clicked.
    <group ref={ref} position={[marker.x, marker.top + 6, -marker.y]} onClick={onClick} renderOrder={10}>
      <group ref={spin}>
        {marker.state === 'collected' ? (
          <mesh>
            <extrudeGeometry args={[starShape, { depth: 1.2, bevelEnabled: true, bevelSize: 0.4, bevelThickness: 0.4, bevelSegments: 2 }]} />
            <meshStandardMaterial color="#d4ad62" emissive="#a9823a" emissiveIntensity={0.15} roughness={0.45} metalness={0.2} depthTest={false} />
          </mesh>
        ) : (
          <mesh scale={[1, 1.35, 1]}>
            <octahedronGeometry args={[3.8]} />
            <meshStandardMaterial color={marker.colour} emissive={marker.colour} emissiveIntensity={0.12} roughness={0.35} flatShading depthTest={false} />
          </mesh>
        )}
      </group>
      <sprite scale={[12, 12, 1]} raycast={() => null}>
        <spriteMaterial map={gemGlow} color={marker.state === 'collected' ? '#efdcae' : marker.colour} transparent opacity={0.25} depthWrite={false} depthTest={false} />
      </sprite>
      {/* A larger invisible target so small gems are easy to click. */}
      <mesh userData={{ gem: marker.i }}>
        <sphereGeometry args={[4.5, 8, 6]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
    </group>
  )
}

// Rings that spread out over the roof of the chosen building.
export function RoofPulse({ x, y, top, size, colour }) {
  const ref = useRef()
  const mat = useRef()
  useFrame(({ clock }) => {
    const f = (clock.elapsedTime * 0.8) % 1
    if (ref.current) ref.current.scale.setScalar(0.6 + f * 1.4)
    if (mat.current) mat.current.opacity = 0.7 * (1 - f)
  })
  return (
    <mesh ref={ref} position={[x, top + 0.6, -y]} rotation={[-Math.PI / 2, 0, 0]} raycast={() => null}>
      <ringGeometry args={[size * 0.85, size, 48]} />
      <meshBasicMaterial ref={mat} color={colour} transparent depthWrite={false} side={THREE.DoubleSide} />
    </mesh>
  )
}

// The start of the walk: a small coral beacon.
export function StartBeacon({ at }) {
  const ref = useRef()
  useFrame(({ clock, camera }) => {
    if (!ref.current) return
    const z = zoomScale(camera, ref.current)
    ref.current.scale.setScalar(z)
    ref.current.children[1].position.y = 6 + Math.abs(Math.sin(clock.elapsedTime * 3)) * 3
  })
  return (
    <group ref={ref} position={[at[0], 0.3, -at[1]]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} raycast={() => null}>
        <ringGeometry args={[3, 5.5, 32]} />
        <meshBasicMaterial color="#a85d44" side={THREE.DoubleSide} />
      </mesh>
      <mesh raycast={() => null}>
        <sphereGeometry args={[2.6, 20, 14]} />
        <meshStandardMaterial color="#a85d44" emissive="#a85d44" emissiveIntensity={0.1} />
      </mesh>
    </group>
  )
}

// Numbered tokens over challenge stops.
export function StopToken({ x, y, top, n, colour }) {
  return (
    <Html position={[x, top + 4, -y]} center zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
      <div className="stop-token" style={{ '--q-deep': colour }}>
        {n}
      </div>
    </Html>
  )
}

// --- Route ------------------------------------------------------------------------

// A glowing route along the network points: a dashed core that flows, a soft glow around it,
// and a little light that travels to the destination.
export function GlowRoute({ points, length, colour, deep }) {
  const core = useRef()
  const glow = useRef()
  const orb = useRef()
  const trail = useRef([])
  const started = useRef(null)

  const { curve, coreGeo, glowGeo, segments, radial } = useMemo(() => {
    const path = new THREE.CurvePath()
    const pts = points.length > 1 ? points : [points[0], [points[0][0] + 0.1, points[0][1]]]
    for (let i = 0; i < pts.length - 1; i++) {
      const a = new THREE.Vector3(pts[i][0], 3, -pts[i][1])
      const b = new THREE.Vector3(pts[i + 1][0], 3, -pts[i + 1][1])
      if (a.distanceTo(b) > 0.01) path.add(new THREE.LineCurve3(a, b))
    }
    if (!path.curves.length) path.add(new THREE.LineCurve3(new THREE.Vector3(pts[0][0], 3, -pts[0][1]), new THREE.Vector3(pts[0][0] + 0.1, 3, -pts[0][1])))
    const segments = THREE.MathUtils.clamp(Math.ceil(path.getLength() / 1.5), 8, 2400)
    const radial = 8
    return {
      curve: path,
      coreGeo: new THREE.TubeGeometry(path, segments, 1.3, radial, false),
      glowGeo: new THREE.TubeGeometry(path, segments, 4.2, radial, false),
      segments,
      radial,
    }
  }, [points])

  const dash = useMemo(() => {
    const t = canvasTexture(64, 8, (ctx, w, h) => {
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, w, h)
      ctx.fillStyle = deep
      ctx.fillRect(0, 0, w * 0.55, h)
    })
    t.wrapS = t.wrapT = THREE.RepeatWrapping
    t.repeat.set(Math.max(1, length / 12), 1)
    return t
  }, [deep, length])
  const glowTex = useMemo(glowTexture, [])

  useEffect(() => {
    started.current = null
    return () => {
      coreGeo.dispose()
      glowGeo.dispose()
    }
  }, [coreGeo, glowGeo])

  useFrame(({ clock }, dt) => {
    const now = clock.elapsedTime
    if (started.current === null) started.current = now
    const duration = Math.min(2.4, 0.7 + length / 500)
    const f = Math.min(1, (now - started.current) / duration)
    const eased = 1 - Math.pow(1 - f, 3)
    const count = Math.max(1, Math.round(eased * segments)) * radial * 6
    core.current?.geometry.setDrawRange(0, count)
    glow.current?.geometry.setDrawRange(0, count)
    dash.offset.x -= dt * 1.2
    // While drawing, the light leads the line; afterwards it walks the route again and again.
    const u = f < 1 ? eased : ((now - started.current - duration) * (80 / Math.max(length, 1)) * 2) % 1
    const p = curve.getPointAt(Math.max(0, Math.min(1, u)))
    orb.current?.position.set(p.x, p.y + 2.5, p.z)
    trail.current.forEach((s, i) => {
      if (!s) return
      const back = Math.max(0, u - ((i + 1) * 5) / Math.max(length, 1))
      const q = curve.getPointAt(back)
      s.position.set(q.x, q.y + 2.5, q.z)
      s.material.opacity = f < 1 && back === 0 ? 0 : 0.3 * (1 - i / 6)
    })
  })

  return (
    <group raycast={() => null}>
      <mesh ref={glow} geometry={glowGeo} renderOrder={3}>
        <meshBasicMaterial color={colour} transparent opacity={0.2} depthWrite={false} />
      </mesh>
      <mesh ref={core} geometry={coreGeo} renderOrder={4}>
        <meshBasicMaterial map={dash} />
      </mesh>
      <group ref={orb}>
        <sprite scale={[15, 15, 1]} renderOrder={5}>
          <spriteMaterial map={glowTex} color={colour} transparent opacity={0.6} depthWrite={false} />
        </sprite>
        <mesh renderOrder={6}>
          <sphereGeometry args={[2.4, 16, 12]} />
          <meshBasicMaterial color="#fffdf5" />
        </mesh>
      </group>
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <sprite key={i} ref={(s) => (trail.current[i] = s)} scale={[8 - i, 8 - i, 1]} renderOrder={5}>
          <spriteMaterial map={glowTex} color={colour} transparent opacity={0} depthWrite={false} />
        </sprite>
      ))}
    </group>
  )
}

// --- Celebration --------------------------------------------------------------------

// A short burst of sparkles over a roof when a badge is collected.
export function SparkleBurst({ x, y, top }) {
  const N = 70
  const ref = useRef()
  const born = useRef(null)
  const { geometry, velocity } = useMemo(() => {
    const pos = new Float32Array(N * 3)
    const col = new Float32Array(N * 3)
    const vel = []
    const palette = ['#f6c544', '#ffffff', '#ffb3c7', '#b99cf0', '#7fd6b8'].map((c) => new THREE.Color(c))
    for (let i = 0; i < N; i++) {
      pos.set([x, top + 3, -y], i * 3)
      const a = Math.random() * Math.PI * 2
      const sp = 12 + Math.random() * 26
      vel.push([Math.cos(a) * sp, 30 + Math.random() * 40, Math.sin(a) * sp])
      const c = palette[i % palette.length]
      col.set([c.r, c.g, c.b], i * 3)
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    g.setAttribute('color', new THREE.BufferAttribute(col, 3))
    return { geometry: g, velocity: vel }
  }, [x, y, top])
  const tex = useMemo(sparkleTexture, [])
  useFrame(({ clock }, dt) => {
    if (!ref.current) return
    if (born.current === null) born.current = clock.elapsedTime
    const age = clock.elapsedTime - born.current
    const pos = geometry.attributes.position
    for (let i = 0; i < N; i++) {
      const v = velocity[i]
      v[1] -= 60 * dt
      pos.setXYZ(i, pos.getX(i) + v[0] * dt, Math.max(top, pos.getY(i) + v[1] * dt), pos.getZ(i) + v[2] * dt)
    }
    pos.needsUpdate = true
    ref.current.material.opacity = Math.max(0, 1 - age / 1.4)
    ref.current.visible = age < 1.4
  })
  return (
    <points ref={ref} geometry={geometry} raycast={() => null} renderOrder={6}>
      <pointsMaterial map={tex} size={9} vertexColors transparent depthWrite={false} alphaTest={0.05} />
    </points>
  )
}
