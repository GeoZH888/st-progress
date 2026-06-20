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
    sampler: (u, v, t, target) => {
      // u in [0, 2pi], v in [-2, 2]
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
  }
]

export const DEFAULT_SURFACE_ID = 'catenoid-helicoid'

export function getSurface(id) {
  return SURFACES.find((s) => s.id === id) ?? SURFACES[0]
}

export function localizedName(surface, lang) {
  return surface[`name_${lang}`] ?? surface.name_en
}
