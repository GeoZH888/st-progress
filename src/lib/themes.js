// Visual themes for the /gallery viewer.
//
// A palette is an array of 2-9 hex colour stops — interpolated linearly
// across the surface's height (Y). MATLAB's classic + perceptually-uniform
// scientific colormaps are included because they're the gold standard for
// reading scalar fields by colour.

export const PALETTES = [
  // ---- ST-Progress originals ----
  { id: 'gold-violet', stops: ['#c9a85a', '#7a3b8c'],                                                              name_en: 'Gold → Violet',  name_it: 'Oro → Viola',     name_zh: '金 → 紫' },
  { id: 'sunset',      stops: ['#ff7e5f', '#feb47b'],                                                              name_en: 'Sunset',         name_it: 'Tramonto',        name_zh: '日落' },
  { id: 'ocean',       stops: ['#1e3c72', '#2a5298', '#56ccf2', '#2ecc71'],                                        name_en: 'Ocean → Reef',   name_it: 'Oceano',          name_zh: '海洋' },
  { id: 'ember',       stops: ['#7a1d12', '#c9492b', '#f5a44f', '#ffd54f'],                                        name_en: 'Ember',          name_it: 'Brace',           name_zh: '余烬' },
  { id: 'mono-gold',   stops: ['#fff3cd', '#e0b34a', '#6b4a14'],                                                   name_en: 'Mono gold',      name_it: 'Oro monocromo',   name_zh: '单色金' },

  // ---- MATLAB / scientific viz colormaps ----
  { id: 'viridis',     stops: ['#440154', '#3b528b', '#21918c', '#5ec962', '#fde725'],                             name_en: 'Viridis',        name_it: 'Viridis',         name_zh: 'Viridis（绿）' },
  { id: 'plasma',      stops: ['#0d0887', '#7e03a8', '#cc4778', '#f89540', '#f0f921'],                             name_en: 'Plasma',         name_it: 'Plasma',          name_zh: '等离子体' },
  { id: 'magma',       stops: ['#000004', '#3b0f70', '#8c2981', '#de4968', '#fe9f6d', '#fcfdbf'],                  name_en: 'Magma',          name_it: 'Magma',           name_zh: '岩浆' },
  { id: 'inferno',     stops: ['#000004', '#420a68', '#932667', '#dd513a', '#fca50a', '#fcffa4'],                  name_en: 'Inferno',        name_it: 'Inferno',         name_zh: '炼狱' },
  { id: 'turbo',       stops: ['#30123b', '#4145ab', '#26bce1', '#7df254', '#fb8022', '#7a0403'],                  name_en: 'Turbo',          name_it: 'Turbo',           name_zh: 'Turbo（高对比）' },
  { id: 'parula',      stops: ['#352a87', '#0363e1', '#1485d4', '#06a7c6', '#38b99e', '#92bf73', '#fcce2e', '#f9fb0e'], name_en: 'Parula (MATLAB)', name_it: 'Parula (MATLAB)', name_zh: 'Parula（MATLAB）' },
  { id: 'jet',         stops: ['#00007f', '#0000ff', '#00ffff', '#00ff00', '#ffff00', '#ff0000', '#7f0000'],       name_en: 'Jet',            name_it: 'Jet',             name_zh: 'Jet（经典彩虹）' },
  { id: 'hot',         stops: ['#0d0000', '#a30000', '#ff5000', '#ffd000', '#ffffff'],                             name_en: 'Hot',            name_it: 'Caldo',           name_zh: '热度' }
]

export const BACKGROUNDS = [
  { id: 'renaissance', color: '#1c1814', accent: '#7a3b8c', name_en: 'Renaissance dark', name_it: 'Buio Rinascimento', name_zh: '文艺复兴深色' },
  { id: 'midnight',    color: '#0a0e27', accent: '#5b6dca', name_en: 'Midnight blue',    name_it: 'Blu mezzanotte',    name_zh: '午夜蓝' },
  { id: 'space',       color: '#000000', accent: '#ffffff', name_en: 'Deep space',       name_it: 'Spazio profondo',   name_zh: '深空' },
  { id: 'graphite',    color: '#2a2a2a', accent: '#7a7a7a', name_en: 'Graphite',         name_it: 'Grafite',           name_zh: '石墨' },
  { id: 'forest',      color: '#0f1f15', accent: '#3f9a55', name_en: 'Forest',           name_it: 'Foresta',           name_zh: '森林' },
  { id: 'parchment',   color: '#e8d9b5', accent: '#c9a85a', name_en: 'Parchment',        name_it: 'Pergamena',         name_zh: '羊皮纸' },
  { id: 'paper',       color: '#f5f5f5', accent: '#8c8c8c', name_en: 'Paper white',      name_it: 'Bianco carta',      name_zh: '论文白' }
]

export const DEFAULT_PALETTE = 'viridis'         // MATLAB-feel out of the box
export const DEFAULT_BACKGROUND = 'renaissance'

const PAL_BY_ID = Object.fromEntries(PALETTES.map((p) => [p.id, p]))
const BG_BY_ID  = Object.fromEntries(BACKGROUNDS.map((b) => [b.id, b]))

export function paletteById(id) { return PAL_BY_ID[id] || PAL_BY_ID[DEFAULT_PALETTE] }
export function backgroundById(id) { return BG_BY_ID[id] || BG_BY_ID[DEFAULT_BACKGROUND] }

export function localizedThemeName(theme, lang) {
  return theme[`name_${lang}`] ?? theme.name_en
}

// CSS gradient string for a palette swatch (a horizontal strip of the stops).
export function paletteGradientCss(palette) {
  return `linear-gradient(90deg, ${palette.stops.join(', ')})`
}

// Pure-number helpers so the colormap interpolation can be called from
// SurfaceViewer without dragging THREE.Color into this file.
//
// stopsToRgb(stops) → [{r, g, b}, …] in [0,1]
// rgbAtT(rgbStops, t) → {r, g, b}
// where t is in [0,1] and the result is a smooth piecewise-linear blend.

function hexToRgb(hex) {
  const h = hex.replace('#', '')
  return {
    r: parseInt(h.slice(0, 2), 16) / 255,
    g: parseInt(h.slice(2, 4), 16) / 255,
    b: parseInt(h.slice(4, 6), 16) / 255
  }
}

export function stopsToRgb(stops) {
  return stops.map(hexToRgb)
}

export function rgbAtT(rgbStops, t) {
  if (rgbStops.length === 0) return { r: 0, g: 0, b: 0 }
  if (rgbStops.length === 1) return rgbStops[0]
  const x = Math.min(Math.max(t, 0), 1) * (rgbStops.length - 1)
  const i = Math.min(Math.floor(x), rgbStops.length - 2)
  const f = x - i
  const a = rgbStops[i]
  const b = rgbStops[i + 1]
  return {
    r: a.r + (b.r - a.r) * f,
    g: a.g + (b.g - a.g) * f,
    b: a.b + (b.b - a.b) * f
  }
}
