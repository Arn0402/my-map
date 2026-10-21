import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { buildCity, buildingAt, paintCity, paintGame } from './buildings.js'
import { Diorama, GAME_GROUND, GameLights, Gem, GlowRoute, Halo, Paths, RoofPulse, SparkleBurst, StartBeacon, StopToken } from './GameWorld.jsx'

const GROUND = '#efece5'
const STREETS = '#7d7a73'

// Street network as thin lines, one draw call.
function Streets({ graph }) {
  const geometry = useMemo(() => {
    const pts = []
    graph.edgeXY.forEach((line) => {
      for (let i = 0; i < line.length - 1; i++) {
        pts.push(line[i][0], 1.2, -line[i][1], line[i + 1][0], 1.2, -line[i + 1][1])
      }
    })
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3))
    return g
  }, [graph])
  return (
    <lineSegments geometry={geometry}>
      <lineBasicMaterial color={STREETS} />
    </lineSegments>
  )
}

// One walking area as a flat shape just above the ground.
function Area({ shape, colour, height, opacity = 1, proj }) {
  const geometry = useMemo(() => {
    const polys = shape.geometry.type === 'Polygon' ? [shape.geometry.coordinates] : shape.geometry.coordinates
    const shapes = polys.map(([outer, ...holes]) => {
      const s = new THREE.Shape(outer.map((p) => new THREE.Vector2(...proj.toXY(p))))
      s.holes = holes.map((h) => new THREE.Path(h.map((p) => new THREE.Vector2(...proj.toXY(p)))))
      return s
    })
    const g = new THREE.ShapeGeometry(shapes)
    g.rotateX(-Math.PI / 2)
    return g
  }, [shape, proj])
  return (
    <mesh geometry={geometry} position={[0, height, 0]}>
      <meshBasicMaterial color={colour} transparent={opacity < 1} opacity={opacity} depthWrite={opacity === 1} />
    </mesh>
  )
}

// Glides the view so the focus point moves to the centre, keeping the viewing angle,
// and eases in to a comfortable distance if the camera is far away.
function CameraGlide({ focus }) {
  const { camera, controls } = useThree()
  const goal = useRef(null)
  useEffect(() => {
    goal.current = focus ? { at: new THREE.Vector3(focus[0], 0, -focus[1]), distance: 700 } : null
  }, [focus])
  useFrame((_, dt) => {
    if (!goal.current || !controls) return
    const { at, distance } = goal.current
    const f = Math.min(1, dt * 3)
    const step = at.clone().sub(controls.target)
    const offset = camera.position.clone().sub(controls.target)
    const len = offset.length()
    const wanted = Math.min(len, distance)
    if (step.length() < 0.5 && Math.abs(len - wanted) < 1) {
      goal.current = null
      return
    }
    controls.target.add(step.multiplyScalar(f))
    offset.setLength(len + (wanted - len) * f)
    camera.position.copy(controls.target).add(offset)
    controls.update()
  })
  return null
}

// look = 'map' is the Walking Map scene, unchanged. look = 'game' is the Urban Explorer diorama.
export default function City({ look = 'map', kit, buildings, graph, proj, paint, areas = [], start, game = {}, focus, onPick }) {
  const city = useMemo(() => buildCity(buildings, proj), [buildings, proj])
  const buildingMesh = useRef()
  useEffect(() => {
    if (paint?.kind === 'game') paintGame(city, paint)
    else paintCity(city, paint?.level ?? null)
  }, [city, paint])

  const [w, h] = kit.size_m
  const isGame = look === 'game'

  // A click (not a drag) on the ground or on a building picks that point (and that building).
  const handleClick = (e) => {
    e.stopPropagation()
    if (e.delta > 4) return
    // A gem under the pointer wins, even if a building is in front of it. If several gems
    // overlap, the one whose centre is closest to the pointer's ray is meant.
    const centre = new THREE.Vector3()
    const gems = e.intersections
      .filter((hit) => hit.object.userData.gem !== undefined)
      .map((hit) => ({ i: hit.object.userData.gem, d: e.ray.distanceToPoint(hit.object.getWorldPosition(centre)) }))
      .sort((a, b) => a.d - b.d)
    if (gems.length) {
      game.onSelect?.(gems[0].i)
      return
    }
    const building = e.object === buildingMesh.current ? buildingAt(city, e.faceIndex) : null
    onPick([e.point.x, -e.point.z], building)
  }

  return (
    <Canvas flat shadows dpr={[1, 2]} camera={{ position: [-300, 1500, 1400], fov: 40, near: 5, far: 20000 }}>
      {isGame ? (
        <GameLights />
      ) : (
        <>
          <color attach="background" args={['#f7f6f2']} />
          <ambientLight intensity={1.1} />
          <directionalLight position={[-800, 1500, 600]} intensity={1.3} />
        </>
      )}
      <group onClick={handleClick}>
        <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow={isGame}>
          <planeGeometry args={isGame ? [w + 300, h + 300] : [w + 400, h + 400]} />
          {isGame ? <meshStandardMaterial color={GAME_GROUND} roughness={1} /> : <meshBasicMaterial color={GROUND} />}
        </mesh>
        <mesh ref={buildingMesh} geometry={city.geometry} castShadow={isGame} receiveShadow={isGame}>
          {isGame ? <meshStandardMaterial key="game" vertexColors roughness={0.85} /> : <meshLambertMaterial key="map" vertexColors />}
        </mesh>
      </group>
      {isGame && <Diorama w={w} h={h} />}
      {areas.map((a) => (
        <Area key={a.key} shape={a.shape} colour={a.colour} height={a.height} opacity={a.opacity} proj={proj} />
      ))}
      {isGame ? <Paths graph={graph} /> : <Streets graph={graph} />}
      {start &&
        (isGame ? (
          <StartBeacon at={start} />
        ) : (
          <mesh position={[start[0], 6, -start[1]]}>
            <sphereGeometry args={[7, 24, 16]} />
            <meshBasicMaterial color="#c2410c" />
          </mesh>
        ))}
      {isGame && (
        <>
          {game.halos?.map((hl) => (
            <Halo key={hl.key} geometry={hl.geometry} colour={hl.colour} opacity={hl.opacity} pulse={hl.pulse} />
          ))}
          {game.markers?.map((m) => (
            <Gem key={m.i} marker={m} onClick={handleClick} />
          ))}
          {game.pulse && <RoofPulse {...game.pulse} />}
          {game.tokens?.map((t) => (
            <StopToken key={t.i} {...t} />
          ))}
          {game.route && <GlowRoute key={game.route.key} {...game.route} />}
          {game.burst && <SparkleBurst key={game.burst.key} {...game.burst} />}
        </>
      )}
      <CameraGlide focus={focus} />
      <OrbitControls makeDefault maxPolarAngle={1.45} minDistance={60} maxDistance={5000} />
    </Canvas>
  )
}
