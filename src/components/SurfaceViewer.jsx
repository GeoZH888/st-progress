import { useEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import { ParametricGeometry } from 'three/examples/jsm/geometries/ParametricGeometry.js'

const COLOR_LOW = '#c9a85a'   // warm gold (matches the math-block accent on /math)
const COLOR_HIGH = '#7a3b8c'  // deep violet for the top of the gradient
const AUTO_ROTATE_SPEED = 0.25

/**
 * Recolor every vertex by its world Y so the surface reads like a heightmap.
 * Cheap and runs once for static surfaces; the morph re-runs it each frame.
 */
function applyHeightGradient(geometry, colorA, colorB) {
  const pos = geometry.attributes.position
  const count = pos.count
  const colors = geometry.attributes.color?.array ?? new Float32Array(count * 3)
  let minY = Infinity
  let maxY = -Infinity
  for (let i = 0; i < count; i++) {
    const y = pos.getY(i)
    if (y < minY) minY = y
    if (y > maxY) maxY = y
  }
  const range = maxY - minY || 1
  const a = new THREE.Color(colorA)
  const b = new THREE.Color(colorB)
  const c = new THREE.Color()
  for (let i = 0; i < count; i++) {
    const t = (pos.getY(i) - minY) / range
    c.copy(a).lerp(b, t)
    colors[i * 3] = c.r
    colors[i * 3 + 1] = c.g
    colors[i * 3 + 2] = c.b
  }
  if (!geometry.attributes.color) {
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  } else {
    geometry.attributes.color.needsUpdate = true
  }
}

function fitGeometry(geometry, targetRadius = 2.0) {
  geometry.computeBoundingSphere()
  geometry.computeBoundingBox()
  const r = geometry.boundingSphere?.radius || 1
  const s = targetRadius / r
  geometry.scale(s, s, s)
  geometry.center()
  geometry.computeVertexNormals()
}

function StaticSurface({ geometry }) {
  const meshRef = useRef()
  useFrame((_, delta) => {
    if (meshRef.current) meshRef.current.rotation.y += delta * AUTO_ROTATE_SPEED
  })
  useEffect(() => () => geometry.dispose(), [geometry])
  return (
    <mesh ref={meshRef} geometry={geometry}>
      <meshStandardMaterial
        side={THREE.DoubleSide}
        metalness={0.28}
        roughness={0.5}
        vertexColors
      />
    </mesh>
  )
}

function ParametricSurfaceMesh({ surface }) {
  const geometry = useMemo(() => {
    const g = new ParametricGeometry(surface.sampler, surface.uvSegments, surface.uvSegments)
    fitGeometry(g)
    applyHeightGradient(g, COLOR_LOW, COLOR_HIGH)
    return g
  }, [surface])
  return <StaticSurface geometry={geometry} />
}

function BuiltinSurfaceMesh({ surface }) {
  const geometry = useMemo(() => {
    const g = surface.build(THREE)
    fitGeometry(g)
    applyHeightGradient(g, COLOR_LOW, COLOR_HIGH)
    return g
  }, [surface])
  return <StaticSurface geometry={geometry} />
}

/**
 * Animated minimal-surface morph. We build the index buffer once and rewrite
 * the position + color attributes every frame in place — no GC pressure even
 * at 60fps with ~25k vertices.
 */
function MorphingSurfaceMesh({ surface }) {
  const meshRef = useRef()

  const geometry = useMemo(() => {
    const N = surface.uvSegments
    const verts = (N + 1) * (N + 1)
    const indices = new Uint32Array(N * N * 6)
    let k = 0
    for (let i = 0; i < N; i++) {
      for (let j = 0; j < N; j++) {
        const a = i * (N + 1) + j
        const b = a + 1
        const c = (i + 1) * (N + 1) + j
        const d = c + 1
        indices[k++] = a
        indices[k++] = c
        indices[k++] = b
        indices[k++] = b
        indices[k++] = c
        indices[k++] = d
      }
    }
    const g = new THREE.BufferGeometry()
    g.setIndex(new THREE.BufferAttribute(indices, 1))
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(verts * 3), 3))
    g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(verts * 3), 3))
    return g
  }, [surface])

  useEffect(() => () => geometry.dispose(), [geometry])

  const tmp = useMemo(() => new THREE.Vector3(), [])
  const colorA = useMemo(() => new THREE.Color(COLOR_LOW), [])
  const colorB = useMemo(() => new THREE.Color(COLOR_HIGH), [])
  const colorTmp = useMemo(() => new THREE.Color(), [])

  useFrame((state, delta) => {
    if (!meshRef.current) return
    const N = surface.uvSegments
    // Pass raw elapsed time; each surface decides how to derive its own
    // morph parameter from it (catenoid-helicoid cycles 0..π/2, the modal
    // sphere uses it to step integer (l, m) modes, etc.).
    const time = state.clock.elapsedTime

    const pos = geometry.attributes.position.array
    const col = geometry.attributes.color.array
    let idx = 0
    let minY = Infinity
    let maxY = -Infinity
    for (let i = 0; i <= N; i++) {
      for (let j = 0; j <= N; j++) {
        surface.sampler(i / N, j / N, time, tmp)
        pos[idx++] = tmp.x
        pos[idx++] = tmp.y
        pos[idx++] = tmp.z
        if (tmp.y < minY) minY = tmp.y
        if (tmp.y > maxY) maxY = tmp.y
      }
    }
    const range = maxY - minY || 1
    const verts = (N + 1) * (N + 1)
    for (let i = 0; i < verts; i++) {
      const tt = (pos[i * 3 + 1] - minY) / range
      colorTmp.copy(colorA).lerp(colorB, tt)
      col[i * 3] = colorTmp.r
      col[i * 3 + 1] = colorTmp.g
      col[i * 3 + 2] = colorTmp.b
    }
    geometry.attributes.position.needsUpdate = true
    geometry.attributes.color.needsUpdate = true
    geometry.computeVertexNormals()
    // Re-center + scale once positions are filled (cheap; bounding sphere only).
    geometry.computeBoundingSphere()
    const r = geometry.boundingSphere?.radius || 1
    const s = 2 / r
    meshRef.current.scale.setScalar(s)

    meshRef.current.rotation.y += delta * AUTO_ROTATE_SPEED * 0.7
  })

  return (
    <mesh ref={meshRef} geometry={geometry}>
      <meshStandardMaterial
        side={THREE.DoubleSide}
        metalness={0.28}
        roughness={0.55}
        vertexColors
      />
    </mesh>
  )
}

/**
 * Strange attractors / parametric curves rendered as a single continuous Line.
 * `surface.integrate(n)` returns a Float32Array (or array of numbers) of length
 * 3·n with sequential (x,y,z) triples; we color by progression along the path
 * (gold → violet) and rotate the whole thing slowly.
 */
function AttractorMesh({ surface }) {
  const meshRef = useRef()
  const geometry = useMemo(() => {
    const flat = surface.integrate(surface.points || 6000)
    const positions = flat instanceof Float32Array ? flat : new Float32Array(flat)
    const count = positions.length / 3
    const colors = new Float32Array(count * 3)
    const cA = new THREE.Color(COLOR_LOW)
    const cB = new THREE.Color(COLOR_HIGH)
    const cTmp = new THREE.Color()
    for (let i = 0; i < count; i++) {
      const t = i / (count - 1)
      cTmp.copy(cA).lerp(cB, t)
      colors[i * 3] = cTmp.r
      colors[i * 3 + 1] = cTmp.g
      colors[i * 3 + 2] = cTmp.b
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    fitGeometry(g)
    return g
  }, [surface])

  useEffect(() => () => geometry.dispose(), [geometry])

  useFrame((_, delta) => {
    if (meshRef.current) meshRef.current.rotation.y += delta * AUTO_ROTATE_SPEED
  })

  return (
    <line ref={meshRef} geometry={geometry}>
      <lineBasicMaterial vertexColors transparent opacity={0.95} />
    </line>
  )
}

/**
 * Particle clouds — Fibonacci/Vogel patterns, lattices, point sets. The
 * surface provides `generate(n)` returning a Float32Array of n·3 (x,y,z)
 * triples. If `surface.animated` is truthy, a sinusoidal draw-range
 * oscillates 0..N..0 so the spiral visibly blooms.
 */
function PointsMesh({ surface }) {
  const meshRef = useRef()
  const geometry = useMemo(() => {
    const flat = surface.generate(surface.pointCount || 2000)
    const positions = flat instanceof Float32Array ? flat : new Float32Array(flat)
    const count = positions.length / 3
    const colors = new Float32Array(count * 3)
    const cA = new THREE.Color(COLOR_LOW)
    const cB = new THREE.Color(COLOR_HIGH)
    const cTmp = new THREE.Color()
    for (let i = 0; i < count; i++) {
      const t = count > 1 ? i / (count - 1) : 0
      cTmp.copy(cA).lerp(cB, t)
      colors[i * 3] = cTmp.r
      colors[i * 3 + 1] = cTmp.g
      colors[i * 3 + 2] = cTmp.b
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    fitGeometry(g)
    if (surface.animated) g.setDrawRange(0, 0)
    return g
  }, [surface])

  useEffect(() => () => geometry.dispose(), [geometry])

  useFrame((state, delta) => {
    if (!meshRef.current) return
    meshRef.current.rotation.y += delta * AUTO_ROTATE_SPEED * 0.6
    if (surface.animated) {
      const total = geometry.attributes.position.count
      // 0 → 1 → 0 over ~14 seconds; cosine gives smooth eases at both ends.
      const t = (Math.cos(state.clock.elapsedTime * 0.45) * -0.5) + 0.5
      const visible = Math.max(1, Math.floor(t * total))
      geometry.setDrawRange(0, visible)
    }
  })

  return (
    <points ref={meshRef} geometry={geometry}>
      <pointsMaterial
        size={surface.pointSize || 0.06}
        vertexColors
        sizeAttenuation
        transparent
        opacity={0.95}
      />
    </points>
  )
}

function Surface({ surface }) {
  if (surface.kind === 'morph') return <MorphingSurfaceMesh surface={surface} />
  if (surface.kind === 'builtin') return <BuiltinSurfaceMesh surface={surface} />
  if (surface.kind === 'attractor') return <AttractorMesh surface={surface} />
  if (surface.kind === 'points') return <PointsMesh surface={surface} />
  return <ParametricSurfaceMesh surface={surface} />
}

export default function SurfaceViewer({ surface }) {
  return (
    <Canvas
      key={surface.id} // force a fresh canvas so geometries dispose cleanly
      camera={{ position: [4.5, 3, 4.5], fov: 42 }}
      dpr={[1, 2]}
      gl={{ antialias: true }}
    >
      <color attach="background" args={['#1c1814']} />
      <fog attach="fog" args={['#1c1814', 8, 18]} />
      <ambientLight intensity={0.45} />
      <directionalLight position={[5, 6, 4]} intensity={1.1} />
      <directionalLight position={[-5, -3, -5]} intensity={0.45} color="#7a3b8c" />
      <Surface surface={surface} />
      <OrbitControls enablePan={false} minDistance={2.6} maxDistance={11} />
    </Canvas>
  )
}
