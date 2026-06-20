// Six surfaces for the /gallery page. Each one has:
//   id              short slug used in the picker
//   name_{en,it,zh} trilingual display name
//   equation        LaTeX string (rendered with KaTeX)
//   kind            'parametric' | 'builtin' | 'morph'
//   sampler         (u, v, target) -> void   (parametric / morph)
//   build           (THREE) -> Geometry      (builtin)
//   uvSegments      grid resolution (parametric / morph)
//   uRange, vRange  optional [min,max] for u/v (default [0,1])
//
// Conventions: u and v are passed in [0,1] (the renderer already maps them).
// All sampler outputs are in scene units; we scale + center in the viewer.

const { PI, sin, cos, sinh, cosh } = Math

export const SURFACES = [
  // ----------------------------------------------------------------------
  {
    id: 'torus-knot',
    name_en: 'Torus knot (3, 2)',
    name_it: 'Nodo toroidale (3, 2)',
    name_zh: '环面纽结 (3, 2)',
    equation:
      '\\begin{aligned}x &= \\cos(pu)\\,(R + r\\cos(qu))\\\\ y &= \\sin(pu)\\,(R + r\\cos(qu))\\\\ z &= r\\sin(qu)\\end{aligned}',
    kind: 'builtin',
    build: (THREE) => new THREE.TorusKnotGeometry(1.1, 0.34, 240, 32, 3, 2)
  },

  // ----------------------------------------------------------------------
  {
    id: 'klein',
    name_en: 'Klein bottle',
    name_it: 'Bottiglia di Klein',
    name_zh: '克莱因瓶',
    equation:
      '\\begin{aligned}x &= (R + \\cos\\tfrac{u}{2}\\sin v - \\sin\\tfrac{u}{2}\\sin 2v)\\cos u\\\\ y &= (R + \\cos\\tfrac{u}{2}\\sin v - \\sin\\tfrac{u}{2}\\sin 2v)\\sin u\\\\ z &= \\sin\\tfrac{u}{2}\\sin v + \\cos\\tfrac{u}{2}\\sin 2v\\end{aligned}',
    kind: 'parametric',
    uvSegments: 160,
    sampler: (u, v, target) => {
      const U = u * 2 * PI
      const V = v * 2 * PI
      const R = 1.6
      const s = R + cos(U / 2) * sin(V) - sin(U / 2) * sin(2 * V)
      target.set(s * cos(U), s * sin(U), sin(U / 2) * sin(V) + cos(U / 2) * sin(2 * V))
    }
  },

  // ----------------------------------------------------------------------
  {
    id: 'mobius',
    name_en: 'Möbius strip',
    name_it: 'Nastro di Möbius',
    name_zh: '莫比乌斯带',
    equation:
      '\\begin{aligned}x &= \\bigl(1 + \\tfrac{v}{2}\\cos\\tfrac{u}{2}\\bigr)\\cos u\\\\ y &= \\bigl(1 + \\tfrac{v}{2}\\cos\\tfrac{u}{2}\\bigr)\\sin u\\\\ z &= \\tfrac{v}{2}\\sin\\tfrac{u}{2}\\end{aligned}',
    kind: 'parametric',
    uvSegments: 120,
    sampler: (u, v, target) => {
      const U = u * 2 * PI
      const V = (v - 0.5) * 2 // -1..1
      const r = 1.6 + (V / 2) * cos(U / 2)
      target.set(r * cos(U), r * sin(U), (V / 2) * sin(U / 2))
    }
  },

  // ----------------------------------------------------------------------
  // The signature animation: the Bonnet family of minimal surfaces.
  // t = 0  -> helicoid;  t = pi/2 -> catenoid. We cycle t over time so the
  // surface bends smoothly between the two while preserving its metric.
  {
    id: 'catenoid-helicoid',
    name_en: 'Catenoid ↔ Helicoid morph',
    name_it: 'Morph Catenoide ↔ Elicoide',
    name_zh: '悬链面 ↔ 螺旋面 形变',
    equation:
      '\\begin{aligned}x &= \\cos t\\,\\sinh v\\,\\sin u + \\sin t\\,\\cosh v\\,\\cos u\\\\ y &= -\\cos t\\,\\sinh v\\,\\cos u + \\sin t\\,\\cosh v\\,\\sin u\\\\ z &= u\\cos t + v\\sin t\\end{aligned}',
    kind: 'morph',
    uvSegments: 160,
    sampler: (u, v, time, target) => {
      // Smooth cosine cycle 0..π/2..0 — 0 is helicoid, π/2 is catenoid.
      const t = ((cos(time * 0.35) * -0.5) + 0.5) * (PI / 2)
      const U = u * 2 * PI
      const V = (v - 0.5) * 4
      const ct = cos(t)
      const st = sin(t)
      target.set(
        ct * sinh(V) * sin(U) + st * cosh(V) * cos(U),
        -ct * sinh(V) * cos(U) + st * cosh(V) * sin(U),
        U * ct + V * st
      )
    }
  },

  // ----------------------------------------------------------------------
  {
    id: 'enneper',
    name_en: 'Enneper surface',
    name_it: 'Superficie di Enneper',
    name_zh: '恩内佩尔曲面',
    equation:
      '\\begin{aligned}x &= u - \\tfrac{u^{3}}{3} + uv^{2}\\\\ y &= v - \\tfrac{v^{3}}{3} + vu^{2}\\\\ z &= u^{2} - v^{2}\\end{aligned}',
    kind: 'parametric',
    uvSegments: 100,
    sampler: (u, v, target) => {
      const U = (u - 0.5) * 4
      const V = (v - 0.5) * 4
      const s = 0.35
      target.set(
        s * (U - (U * U * U) / 3 + U * V * V),
        s * (V - (V * V * V) / 3 + V * U * U),
        s * (U * U - V * V)
      )
    }
  },

  // ----------------------------------------------------------------------
  {
    id: 'saddle',
    name_en: 'Hyperbolic paraboloid',
    name_it: 'Paraboloide iperbolico',
    name_zh: '双曲抛物面',
    equation: 'z = \\tfrac{x^{2}}{a^{2}} - \\tfrac{y^{2}}{b^{2}}',
    kind: 'parametric',
    uvSegments: 80,
    sampler: (u, v, target) => {
      const x = (u - 0.5) * 4
      const y = (v - 0.5) * 4
      const z = (x * x - y * y) * 0.18
      target.set(x, z, y) // swap so the saddle dip is up-down in scene
    }
  },

  // ----------------------------------------------------------------------
  // Trefoil knot — the simplest non-trivial knot. p=2 wraps twice around
  // the axis of the torus, q=3 wraps three times through its hole.
  {
    id: 'trefoil',
    name_en: 'Trefoil knot (2, 3)',
    name_it: 'Nodo trifoglio (2, 3)',
    name_zh: '三叶纽结 (2, 3)',
    equation: '\\text{Torus knot } T(2,3) \\;:\\; p=2,\\ q=3',
    kind: 'builtin',
    build: (THREE) => new THREE.TorusKnotGeometry(1.05, 0.36, 220, 28, 2, 3)
  },

  // ----------------------------------------------------------------------
  // Lorenz attractor — Edward Lorenz, 1963. The butterfly that launched
  // chaos theory. σ=10, ρ=28, β=8/3 give the classic two-lobed shape.
  {
    id: 'lorenz',
    name_en: 'Lorenz attractor',
    name_it: 'Attrattore di Lorenz',
    name_zh: '洛伦茨吸引子',
    equation:
      '\\begin{aligned}\\dot{x}&=\\sigma(y-x)\\\\ \\dot{y}&=x(\\rho-z)-y\\\\ \\dot{z}&=xy-\\beta z\\end{aligned}\\;\\;(\\sigma{=}10,\\rho{=}28,\\beta{=}\\tfrac{8}{3})',
    kind: 'attractor',
    points: 8000,
    integrate: (n) => {
      const dt = 0.01
      const sigma = 10
      const rho = 28
      const beta = 8 / 3
      const out = new Float32Array(n * 3)
      let x = 0.1, y = 0, z = 0
      for (let i = 0; i < n; i++) {
        const dx = sigma * (y - x)
        const dy = x * (rho - z) - y
        const dz = x * y - beta * z
        x += dx * dt
        y += dy * dt
        z += dz * dt
        // Swap y <-> z so the butterfly is upright in the scene.
        out[i * 3] = x
        out[i * 3 + 1] = z
        out[i * 3 + 2] = y
      }
      return out
    }
  },

  // ----------------------------------------------------------------------
  // Rössler attractor — Otto Rössler, 1976. Simpler than Lorenz, single
  // sweeping loop with a thin transient that pulls upward (the "tail").
  {
    id: 'rossler',
    name_en: 'Rössler attractor',
    name_it: 'Attrattore di Rössler',
    name_zh: '勒斯勒尔吸引子',
    equation:
      '\\begin{aligned}\\dot{x}&=-y-z\\\\ \\dot{y}&=x+ay\\\\ \\dot{z}&=b+z(x-c)\\end{aligned}\\;\\;(a{=}b{=}0.2,\\,c{=}5.7)',
    kind: 'attractor',
    points: 7000,
    integrate: (n) => {
      const dt = 0.035
      const a = 0.2, b = 0.2, c = 5.7
      const out = new Float32Array(n * 3)
      let x = 1, y = 1, z = 1
      for (let i = 0; i < n; i++) {
        const dx = -y - z
        const dy = x + a * y
        const dz = b + z * (x - c)
        x += dx * dt
        y += dy * dt
        z += dz * dt
        out[i * 3] = x
        out[i * 3 + 1] = z
        out[i * 3 + 2] = y
      }
      return out
    }
  },

  // ----------------------------------------------------------------------
  // Vogel's sunflower — the canonical phyllotaxis spiral. For the nth seed,
  // rotate by n × golden angle (≈137.5°) and step outward by √n. The
  // irrationality of the golden ratio packs the seeds without overlap and
  // without preferred direction — which is why real sunflowers use it.
  // We add a gentle dome (z = 0.06·r²) so the spiral reads as a 3D head,
  // not a flat disc.
  {
    id: 'vogel',
    name_en: "Vogel's sunflower (golden angle)",
    name_it: 'Girasole di Vogel (angolo aureo)',
    name_zh: '沃格尔螺旋（黄金角）',
    equation:
      '\\theta_n = n\\,\\phi,\\quad r_n = c\\sqrt{n},\\quad \\phi = (3-\\sqrt{5})\\pi \\approx 137.507°',
    kind: 'points',
    pointCount: 2200,
    pointSize: 0.06,
    animated: true,
    generate: (n) => {
      const GOLDEN_ANGLE = (3 - Math.sqrt(5)) * PI // ≈ 2.39996 rad ≈ 137.5°
      const c = 0.06
      const out = new Float32Array(n * 3)
      for (let i = 0; i < n; i++) {
        const r = c * Math.sqrt(i + 1)
        const theta = (i + 1) * GOLDEN_ANGLE
        out[i * 3] = r * cos(theta)
        out[i * 3 + 1] = 0.06 * r * r  // subtle dome so the head looks 3D
        out[i * 3 + 2] = r * sin(theta)
      }
      return out
    }
  },

  // ----------------------------------------------------------------------
  // Modal sphere — radius pulses by sin(l·θ)cos(m·φ); integer (l, m) modes
  // cycle slowly so the surface walks through different harmonics over
  // time. Visually close to the lower-order spherical harmonics.
  {
    id: 'modal-sphere',
    name_en: 'Modal sphere',
    name_it: 'Sfera modale',
    name_zh: '模态球面',
    equation:
      'r(\\theta,\\phi)=1+0.45\\sin(l\\theta)\\cos(m\\phi)\\;,\\;\\; l,m \\in \\{2,3,4,5,6\\}',
    kind: 'morph',
    uvSegments: 130,
    sampler: (u, v, time, target) => {
      // Step (l, m) through integers; the two phases are decorrelated so
      // the surface is constantly walking through new mode combinations.
      const l = 2 + Math.floor(((sin(time * 0.32) * 0.5) + 0.5) * 4.999)
      const m = 2 + Math.floor(((cos(time * 0.41) * 0.5) + 0.5) * 4.999)
      const theta = u * PI            // colatitude [0, π]
      const phi = v * 2 * PI          // longitude  [0, 2π]
      const r = 1 + 0.45 * sin(l * theta) * cos(m * phi)
      target.set(
        r * sin(theta) * cos(phi),
        r * cos(theta),
        r * sin(theta) * sin(phi)
      )
    }
  }
]

export const DEFAULT_SURFACE_ID = 'catenoid-helicoid'

export function getSurface(id) {
  return SURFACES.find((s) => s.id === id) ?? SURFACES[0]
}

export function localizedName(surface, lang) {
  return surface[`name_${lang}`] ?? surface.name_en
}
