import { useEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import { ParametricGeometry } from 'three/examples/jsm/geometries/ParametricGeometry.js'
import { paletteById, backgroundById, stopsToRgb, rgbAtT, DEFAULT_PALETTE, DEFAULT_BACKGROUND } from '../lib/themes'

// Default-only fallback used when a component is mounted without a palette prop.
const FALLBACK_PAL = paletteById(DEFAULT_PALETTE)
const AUTO_ROTATE_SPEED = 0.25

// Returns the palette's id (cache key for memoization) + its stops as RGB
// triples in [0,1] so the inner loops don't allocate THREE.Color instances.
function stopsOf(palette) {
  const p = palette || FALLBACK_PAL
  return { id: p.id, rgbStops: stopsToRgb(p.stops) }
}

// ----------------------------------------------------------------------
// Ambient motion: each mesh's group is gently swayed on X/Z, scale
// "breathes", and the whole thing jitters a tiny amount in the XZ plane.
// Phases + frequencies are randomised per mount so two visits look subtly
// different — the "random seeds" the user asked for.
// ----------------------------------------------------------------------

function newMotionSeed() {
  const r2pi = () => Math.random() * Math.PI * 2
  return {
    swayPhaseX:  r2pi(), swayPhaseZ:  r2pi(),
    breathPhase: r2pi(),
    jitterPhaseX: r2pi(), jitterPhaseZ: r2pi(),
    swayFreqX:  0.25 + Math.random() * 0.35,
    swayFreqZ:  0.20 + Math.random() * 0.30,
    breathFreq: 0.40 + Math.random() * 0.40,
    jitterFreq: 1.5  + Math.random() * 1.5
  }
}

/**
 * Apply ambient sway + breathing + jitter to a group.
 * `intensity` ∈ [0, 1] is the global motion level (Off → Wild).
 * `baseScale` lets the morph mesh combine its per-frame fit scale with the
 * breathing oscillation; defaults to 1.
 * Returns the resolved scale (callers don't have to read it back).
 */
function applyMotion(group, time, seed, intensity, baseScale = 1) {
  if (!group) return baseScale
  const I = intensity
  if (I <= 0) {
    group.rotation.x = 0
    group.rotation.z = 0
    group.position.x = 0
    group.position.z = 0
    group.scale.setScalar(baseScale)
    return baseScale
  }
  group.rotation.x = Math.sin(time * seed.swayFreqX + seed.swayPhaseX) * 0.18 * I
  group.rotation.z = Math.sin(time * seed.swayFreqZ + seed.swayPhaseZ) * 0.12 * I
  const breath = 1 + Math.sin(time * seed.breathFreq + seed.breathPhase) * 0.05 * I
  group.scale.setScalar(baseScale * breath)
  group.position.x = Math.sin(time * seed.jitterFreq + seed.jitterPhaseX) * 0.06 * I
  group.position.z = Math.cos(time * seed.jitterFreq * 1.1 + seed.jitterPhaseZ) * 0.06 * I
  return baseScale * breath
}

/**
 * Recolor every vertex by its world Y so the surface reads like a heightmap.
 * Cheap and runs once for static surfaces; the morph re-runs it each frame.
 * `rgbStops` is the palette pre-converted to RGB triples in [0,1].
 */
function applyHeightGradient(geometry, rgbStops) {
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
  for (let i = 0; i < count; i++) {
    const t = (pos.getY(i) - minY) / range
    const c = rgbAtT(rgbStops, t)
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

/**
 * Render the same geometry as solid mesh, wireframe overlay, both, or points.
 * Lets us share one geometry between layers (cheap; one draw call per layer).
 */
function SurfaceLayers({ geometry, renderMode = 'solid' }) {
  const showSolid = renderMode === 'solid' || renderMode === 'both'
  const showWire = renderMode === 'wireframe' || renderMode === 'both'
  const showPoints = renderMode === 'points'
  return (
    <>
      {showSolid && (
        <mesh geometry={geometry}>
          <meshStandardMaterial
            side={THREE.DoubleSide}
            metalness={0.1}
            roughness={0.35}
            envMapIntensity={0.8}
            vertexColors
            transparent={renderMode === 'both'}
            opacity={renderMode === 'both' ? 0.82 : 1}
          />
        </mesh>
      )}
      {showWire && (
        <mesh geometry={geometry} scale={renderMode === 'both' ? 1.003 : 1}>
          {/* wireframe-only uses vertexColors so the flow ripples through the
              wires too; "both" stays white so it reads as overlay. */}
          {renderMode === 'both'
            ? <meshBasicMaterial color="#ffffff" wireframe transparent opacity={0.32} />
            : <meshBasicMaterial vertexColors wireframe transparent opacity={0.9} />}
        </mesh>
      )}
      {showPoints && (
        <points geometry={geometry}>
          <pointsMaterial vertexColors size={0.045} sizeAttenuation />
        </points>
      )}
    </>
  )
}

function StaticSurface({ geometry, rgbStops, renderMode, motion = 0, autoRotate = true }) {
  const groupRef = useRef()
  const seed = useMemo(newMotionSeed, [])

  // Cache per-vertex height-t so each frame's recolour is just stops lookup
  // + the moving brightness peak — no Y read or min/max scan per frame.
  const heightTRef = useRef(null)
  const stopsRef = useRef(rgbStops)
  useEffect(() => { stopsRef.current = rgbStops }, [rgbStops])

  useEffect(() => {
    const pos = geometry.attributes.position
    const count = pos.count
    let minY = Infinity, maxY = -Infinity
    for (let i = 0; i < count; i++) {
      const y = pos.getY(i)
      if (y < minY) minY = y
      if (y > maxY) maxY = y
    }
    const range = maxY - minY || 1
    const ht = new Float32Array(count)
    for (let i = 0; i < count; i++) ht[i] = (pos.getY(i) - minY) / range
    heightTRef.current = ht
  }, [geometry])

  useFrame((state, delta) => {
    const g = groupRef.current
    if (!g) return
    const time = state.clock.elapsedTime
    if (autoRotate) g.rotation.y += delta * AUTO_ROTATE_SPEED
    applyMotion(g, time, seed, motion, 1)

    // Surface flow: gentler than on lines/points so the underlying
    // shape stays readable. Two slow brightness peaks chase across
    // the vertex order — on parametric grids this looks like a band
    // sweeping across the sphere / strip.
    const ht = heightTRef.current
    const stops = stopsRef.current
    if (!ht || !stops) return
    const col = geometry.attributes.color.array
    const count = ht.length
    const denom = Math.max(1, count - 1)
    const headPos = (time * 0.30) % 1
    const head2 = ((time * 0.20) + 0.5) % 1
    for (let i = 0; i < count; i++) {
      const c = rgbAtT(stops, ht[i])
      const pos = i / denom
      let d1 = Math.abs(pos - headPos); d1 = Math.min(d1, 1 - d1)
      let d2 = Math.abs(pos - head2);   d2 = Math.min(d2, 1 - d2)
      const boost = Math.exp(-d1 * d1 * 120) + 0.55 * Math.exp(-d2 * d2 * 120)
      const k = 0.72 + 0.28 * Math.min(1, boost)
      col[i * 3]     = Math.min(1, c.r * k + boost * (1 - c.r) * 0.4)
      col[i * 3 + 1] = Math.min(1, c.g * k + boost * (1 - c.g) * 0.4)
      col[i * 3 + 2] = Math.min(1, c.b * k + boost * (1 - c.b) * 0.4)
    }
    geometry.attributes.color.needsUpdate = true
  })

  useEffect(() => () => geometry.dispose(), [geometry])
  return (
    <group ref={groupRef}>
      <SurfaceLayers geometry={geometry} renderMode={renderMode} />
    </group>
  )
}

function ParametricSurfaceMesh({ surface, renderMode, palette, params, motion, autoRotate }) {
  const { id: palId, rgbStops } = stopsOf(palette)
  const paramsKey = JSON.stringify(params || {})
  const geometry = useMemo(() => {
    const sampler = (u, v, target) => surface.sampler(u, v, target, params)
    const g = new ParametricGeometry(sampler, surface.uvSegments, surface.uvSegments)
    fitGeometry(g)
    applyHeightGradient(g, rgbStops) // initial colours; useFrame overrides
    return g
  }, [surface, paramsKey]) // eslint-disable-line react-hooks/exhaustive-deps
  return <StaticSurface geometry={geometry} rgbStops={rgbStops} renderMode={renderMode} motion={motion} autoRotate={autoRotate} />
}

function BuiltinSurfaceMesh({ surface, renderMode, palette, params, motion, autoRotate }) {
  const { id: palId, rgbStops } = stopsOf(palette)
  const paramsKey = JSON.stringify(params || {})
  const geometry = useMemo(() => {
    const g = surface.build(THREE, params)
    fitGeometry(g)
    applyHeightGradient(g, rgbStops)
    return g
  }, [surface, paramsKey]) // eslint-disable-line react-hooks/exhaustive-deps
  return <StaticSurface geometry={geometry} rgbStops={rgbStops} renderMode={renderMode} motion={motion} autoRotate={autoRotate} />
}

/**
 * Animated minimal-surface morph. We build the index buffer once and rewrite
 * the position + color attributes every frame in place — no GC pressure even
 * at 60fps with ~25k vertices.
 */
function MorphingSurfaceMesh({ surface, renderMode, palette, params, motion = 0 }) {
  const groupRef = useRef()
  const seed = useMemo(newMotionSeed, [])
  const { rgbStops } = stopsOf(palette)
  // Keep params + stops in refs so the per-frame loop reads the latest values
  // without re-creating any closures or allocating extra buffers.
  const paramsRef = useRef(params)
  const stopsRef = useRef(rgbStops)
  const motionRef = useRef(motion)
  useEffect(() => { paramsRef.current = params }, [params])
  useEffect(() => { stopsRef.current = rgbStops }, [rgbStops])
  useEffect(() => { motionRef.current = motion }, [motion])

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

  useFrame((state, delta) => {
    if (!groupRef.current) return
    const N = surface.uvSegments
    const time = state.clock.elapsedTime

    const pos = geometry.attributes.position.array
    const col = geometry.attributes.color.array
    let idx = 0
    let minY = Infinity
    let maxY = -Infinity
    const p = paramsRef.current
    for (let i = 0; i <= N; i++) {
      for (let j = 0; j <= N; j++) {
        surface.sampler(i / N, j / N, time, tmp, p)
        pos[idx++] = tmp.x
        pos[idx++] = tmp.y
        pos[idx++] = tmp.z
        if (tmp.y < minY) minY = tmp.y
        if (tmp.y > maxY) maxY = tmp.y
      }
    }
    const range = maxY - minY || 1
    const verts = (N + 1) * (N + 1)
    const stops = stopsRef.current
    // Same surface-flow pattern as StaticSurface: two slow brightness
    // peaks chase across vertex order, giving Modal sphere / catenoid-
    // helicoid a visible flowing highlight as well.
    const denom = Math.max(1, verts - 1)
    const headPos = (time * 0.30) % 1
    const head2 = ((time * 0.20) + 0.5) % 1
    for (let i = 0; i < verts; i++) {
      const tt = (pos[i * 3 + 1] - minY) / range
      const c = rgbAtT(stops, tt)
      const p = i / denom
      let d1 = Math.abs(p - headPos); d1 = Math.min(d1, 1 - d1)
      let d2 = Math.abs(p - head2);   d2 = Math.min(d2, 1 - d2)
      const boost = Math.exp(-d1 * d1 * 120) + 0.55 * Math.exp(-d2 * d2 * 120)
      const k = 0.72 + 0.28 * Math.min(1, boost)
      col[i * 3]     = Math.min(1, c.r * k + boost * (1 - c.r) * 0.4)
      col[i * 3 + 1] = Math.min(1, c.g * k + boost * (1 - c.g) * 0.4)
      col[i * 3 + 2] = Math.min(1, c.b * k + boost * (1 - c.b) * 0.4)
    }
    geometry.attributes.position.needsUpdate = true
    geometry.attributes.color.needsUpdate = true
    geometry.computeVertexNormals()
    geometry.computeBoundingSphere()
    const r = geometry.boundingSphere?.radius || 1
    const baseScale = 2 / r
    groupRef.current.rotation.y += delta * AUTO_ROTATE_SPEED * 0.7
    applyMotion(groupRef.current, time, seed, motionRef.current, baseScale)
  })

  return (
    <group ref={groupRef}>
      <SurfaceLayers geometry={geometry} renderMode={renderMode} />
    </group>
  )
}

/**
 * Strange attractors / parametric curves rendered as a single continuous Line.
 * `surface.integrate(n)` returns a Float32Array (or array of numbers) of length
 * 3·n with sequential (x,y,z) triples; we color by progression along the path
 * (gold → violet) and rotate the whole thing slowly.
 */
function AttractorMesh({ surface, palette, params, motion = 0 }) {
  const meshRef = useRef()
  const seed = useMemo(newMotionSeed, [])
  const { id: palId, rgbStops } = stopsOf(palette)
  const stopsRef = useRef(rgbStops)
  useEffect(() => { stopsRef.current = rgbStops }, [rgbStops])
  const paramsKey = JSON.stringify(params || {})
  // Cache the original positions so the per-frame undulation can offset
  // *from rest* rather than drift cumulatively.
  const basePosRef = useRef(null)
  const geometry = useMemo(() => {
    const flat = surface.integrate(surface.points || 6000, params)
    const positions = flat instanceof Float32Array ? flat : new Float32Array(flat)
    const count = positions.length / 3
    const colors = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      const t = i / (count - 1)
      const c = rgbAtT(rgbStops, t)
      colors[i * 3] = c.r
      colors[i * 3 + 1] = c.g
      colors[i * 3 + 2] = c.b
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    fitGeometry(g)
    basePosRef.current = new Float32Array(g.attributes.position.array)
    return g
  }, [surface, palId, paramsKey]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => geometry.dispose(), [geometry])

  useFrame((state, delta) => {
    const g = meshRef.current
    if (!g) return
    const time = state.clock.elapsedTime
    g.rotation.y += delta * AUTO_ROTATE_SPEED
    applyMotion(g, time, seed, motion, 1)

    // Flow effect on attractor lines, now in three layers:
    //   1) Palette pattern shifts along the line (river of colour)
    //   2) Two bright "comet" peaks chase along at different speeds
    //   3) Per-vertex sinusoidal wobble in 3D — a wave that visibly
    //      ripples along the curve, making the whole attractor feel alive
    const col = geometry.attributes.color.array
    const pos = geometry.attributes.position.array
    const base = basePosRef.current
    const count = geometry.attributes.position.count
    const stops = stopsRef.current
    const colorOffset = (time * 0.35) % 1
    const headPos = (time * 0.55) % 1
    const head2 = (time * 0.32 + 0.5) % 1
    const denom = Math.max(1, count - 1)
    // Two undulation modes (different freq + axis) give the curve a sense
    // of "swimming" rather than just being a stiff line.
    const waveAmpY = 0.06, waveAmpX = 0.04
    const waveTimeY = time * 1.6
    const waveTimeX = time * 1.1
    for (let i = 0; i < count; i++) {
      // ----- COLOUR -----
      let p = (i / denom) - colorOffset
      p = p - Math.floor(p)
      const c = rgbAtT(stops, p)

      const pi = i / denom
      let d1 = Math.abs(pi - headPos); d1 = Math.min(d1, 1 - d1)
      let d2 = Math.abs(pi - head2);   d2 = Math.min(d2, 1 - d2)
      const boost = Math.exp(-d1 * d1 * 220) + 0.6 * Math.exp(-d2 * d2 * 220)

      const k = 0.55 + 0.45 * Math.min(1, boost)
      col[i * 3]     = Math.min(1, c.r * k + boost * (1 - c.r) * 0.55)
      col[i * 3 + 1] = Math.min(1, c.g * k + boost * (1 - c.g) * 0.55)
      col[i * 3 + 2] = Math.min(1, c.b * k + boost * (1 - c.b) * 0.55)

      // ----- UNDULATION -----  offset *from rest* so it doesn't drift.
      if (base) {
        const ix = i * 3, iy = i * 3 + 1, iz = i * 3 + 2
        const phY = i * 0.28 + waveTimeY
        const phX = i * 0.18 + waveTimeX
        pos[ix] = base[ix] + Math.cos(phX) * waveAmpX
        pos[iy] = base[iy] + Math.sin(phY) * waveAmpY
        pos[iz] = base[iz] + Math.sin(phX * 0.7) * waveAmpX
      }
    }
    geometry.attributes.color.needsUpdate = true
    if (base) geometry.attributes.position.needsUpdate = true
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
function PointsMesh({ surface, palette, params, motion = 0 }) {
  const meshRef = useRef()
  const seed = useMemo(newMotionSeed, [])
  const { id: palId, rgbStops } = stopsOf(palette)
  const stopsRef = useRef(rgbStops)
  useEffect(() => { stopsRef.current = rgbStops }, [rgbStops])
  const paramsKey = JSON.stringify(params || {})
  // Per-point random phase + base positions so each dot can twinkle and
  // drift slightly without losing its Vogel spiral position.
  const basePosRef = useRef(null)
  const phasesRef = useRef(null)
  const geometry = useMemo(() => {
    const flat = surface.generate(surface.pointCount || 2000, params)
    const positions = flat instanceof Float32Array ? flat : new Float32Array(flat)
    const count = positions.length / 3
    const colors = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      const t = count > 1 ? i / (count - 1) : 0
      const c = rgbAtT(rgbStops, t)
      colors[i * 3] = c.r
      colors[i * 3 + 1] = c.g
      colors[i * 3 + 2] = c.b
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    fitGeometry(g)
    if (surface.animated) g.setDrawRange(0, 0)
    basePosRef.current = new Float32Array(g.attributes.position.array)
    const phases = new Float32Array(count)
    for (let i = 0; i < count; i++) phases[i] = Math.random() * Math.PI * 2
    phasesRef.current = phases
    return g
  }, [surface, palId, paramsKey]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => geometry.dispose(), [geometry])

  useFrame((state, delta) => {
    if (!meshRef.current) return
    const time = state.clock.elapsedTime
    meshRef.current.rotation.y += delta * AUTO_ROTATE_SPEED * 0.6
    applyMotion(meshRef.current, time, seed, motion, 1)

    // Flow effect on point clouds — four layers stacked:
    //   1) Palette shifts radially through the cloud (river of colour)
    //   2) Two ripple rings expand outward from the centre
    //   3) Per-dot random-phase twinkle modulates brightness
    //   4) Per-dot tiny XY drift — each dot orbits a fraction of a unit
    //      around its base position, with random phase, so the spiral
    //      visibly shimmers rather than sitting frozen.
    const col = geometry.attributes.color.array
    const pos = geometry.attributes.position.array
    const base = basePosRef.current
    const phases = phasesRef.current
    const count = geometry.attributes.position.count
    const stops = stopsRef.current
    const colorOffset = (time * 0.22) % 1
    const ringPos = (time * 0.45) % 1.3
    const ring2 = ((time * 0.3) + 0.6) % 1.3
    const denom = Math.max(1, count - 1)
    const driftAmp = 0.025
    const driftT  = time * 2.0
    const twinkleT = time * 3.2
    for (let i = 0; i < count; i++) {
      let p = (i / denom) - colorOffset
      p = p - Math.floor(p)
      const c = rgbAtT(stops, p)

      const rPos = i / denom
      const d1 = Math.abs(rPos - ringPos)
      const d2 = Math.abs(rPos - ring2)
      const ringBoost = Math.exp(-d1 * d1 * 180) + 0.7 * Math.exp(-d2 * d2 * 180)

      const phase = phases ? phases[i] : (i * 0.31)
      const twinkle = 0.7 + 0.3 * Math.sin(twinkleT + phase * 1.7)

      const boost = Math.min(1.4, ringBoost + twinkle * 0.25)
      const k = 0.55 + 0.45 * Math.min(1, boost)
      col[i * 3]     = Math.min(1, c.r * k + boost * (1 - c.r) * 0.55)
      col[i * 3 + 1] = Math.min(1, c.g * k + boost * (1 - c.g) * 0.55)
      col[i * 3 + 2] = Math.min(1, c.b * k + boost * (1 - c.b) * 0.55)

      if (base) {
        const ix = i * 3, iy = i * 3 + 1, iz = i * 3 + 2
        const ph = driftT + phase
        pos[ix] = base[ix] + Math.cos(ph) * driftAmp
        pos[iy] = base[iy] + Math.sin(ph * 1.3) * driftAmp * 0.6
        pos[iz] = base[iz] + Math.sin(ph) * driftAmp
      }
    }
    geometry.attributes.color.needsUpdate = true
    if (base) geometry.attributes.position.needsUpdate = true

    if (surface.animated) {
      const total = geometry.attributes.position.count
      // 0 → 1 → 0 over ~14 seconds; cosine gives smooth eases at both ends.
      const t = (Math.cos(time * 0.45) * -0.5) + 0.5
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

function Surface({ surface, renderMode, palette, params, motion, autoRotate = true }) {
  if (surface.kind === 'morph')     return <MorphingSurfaceMesh   surface={surface} renderMode={renderMode} palette={palette} params={params} motion={motion} />
  if (surface.kind === 'builtin')   return <BuiltinSurfaceMesh    surface={surface} renderMode={renderMode} palette={palette} params={params} motion={motion} autoRotate={autoRotate} />
  if (surface.kind === 'attractor') return <AttractorMesh         surface={surface}                          palette={palette} params={params} motion={motion} />
  if (surface.kind === 'points')    return <PointsMesh            surface={surface}                          palette={palette} params={params} motion={motion} />
  return <ParametricSurfaceMesh surface={surface} renderMode={renderMode} palette={palette} params={params} motion={motion} autoRotate={autoRotate} />
}

// Which surface kinds respect the render-mode picker (solid / wireframe / both / points)?
// Lines and point clouds don't — they're already in a fixed visual form.
export function surfaceSupportsRenderMode(surface) {
  return surface.kind === 'morph' || surface.kind === 'builtin' || surface.kind === 'parametric' || !surface.kind
}

export default function SurfaceViewer({
  surface,
  renderMode = 'solid',
  paletteId = DEFAULT_PALETTE,
  backgroundId = DEFAULT_BACKGROUND,
  params = null,
  motion = 0,
  autoRotate = true,
  interactive = true
}) {
  const palette = paletteById(paletteId)
  const bg = backgroundById(backgroundId)
  // Light backgrounds (parchment / paper) bounce more light back at the
  // surface, so we lower the ambient to keep contrast; dark scenes get more.
  const isLight = bg.id === 'parchment' || bg.id === 'paper'
  const ambient = isLight ? 0.7 : 0.5
  return (
    <Canvas
      key={surface.id} // force a fresh canvas so geometries dispose cleanly
      camera={{ position: [4.5, 3, 4.5], fov: 42 }}
      dpr={[1, 2]}
      gl={{ antialias: true }}
    >
      <color attach="background" args={[bg.color]} />
      <fog attach="fog" args={[bg.color, 8, 18]} />
      <ambientLight intensity={ambient} />
      <directionalLight position={[5, 6, 4]} intensity={1.1} />
      <directionalLight position={[-5, -3, -5]} intensity={0.45} color={bg.accent} />
      <Surface surface={surface} renderMode={renderMode} palette={palette} params={params} motion={motion} autoRotate={autoRotate} />
      {interactive && <OrbitControls enablePan={false} minDistance={2.6} maxDistance={11} />}
    </Canvas>
  )
}
