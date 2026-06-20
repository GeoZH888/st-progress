// Visual themes for the /gallery viewer: surface color gradients (palettes)
// and background colors. Both are simple presets — pick by id, render as a
// swatch in the UI, pass the resolved colors to SurfaceViewer.

export const PALETTES = [
  { id: 'gold-violet', low: '#c9a85a', high: '#7a3b8c', name_en: 'Gold → Violet',  name_it: 'Oro → Viola',  name_zh: '金 → 紫' },
  { id: 'sunset',      low: '#ff7e5f', high: '#feb47b', name_en: 'Sunset',         name_it: 'Tramonto',     name_zh: '日落' },
  { id: 'ocean',       low: '#1e3c72', high: '#2ecc71', name_en: 'Ocean → Reef',   name_it: 'Oceano',       name_zh: '海洋' },
  { id: 'plasma',      low: '#0d0887', high: '#f0f921', name_en: 'Plasma',         name_it: 'Plasma',       name_zh: '等离子体' },
  { id: 'ember',       low: '#7a1d12', high: '#ffd54f', name_en: 'Ember',          name_it: 'Brace',        name_zh: '余烬' },
  { id: 'mono-gold',   low: '#fff3cd', high: '#6b4a14', name_en: 'Mono gold',      name_it: 'Oro monocromo', name_zh: '单色金' }
]

export const BACKGROUNDS = [
  // `color` is the scene clear color AND the fog colour, so distant geometry
  // fades smoothly into the background instead of clipping at the far plane.
  // `accent` is the second light's hue (the cool fill from the back).
  { id: 'renaissance', color: '#1c1814', accent: '#7a3b8c', name_en: 'Renaissance dark', name_it: 'Buio Rinascimento', name_zh: '文艺复兴深色' },
  { id: 'midnight',    color: '#0a0e27', accent: '#5b6dca', name_en: 'Midnight blue',    name_it: 'Blu mezzanotte',    name_zh: '午夜蓝' },
  { id: 'space',       color: '#000000', accent: '#ffffff', name_en: 'Deep space',       name_it: 'Spazio profondo',   name_zh: '深空' },
  { id: 'parchment',   color: '#e8d9b5', accent: '#c9a85a', name_en: 'Parchment',        name_it: 'Pergamena',         name_zh: '羊皮纸' },
  { id: 'forest',      color: '#0f1f15', accent: '#3f9a55', name_en: 'Forest',           name_it: 'Foresta',           name_zh: '森林' }
]

export const DEFAULT_PALETTE = 'gold-violet'
export const DEFAULT_BACKGROUND = 'renaissance'

const PAL_BY_ID = Object.fromEntries(PALETTES.map((p) => [p.id, p]))
const BG_BY_ID  = Object.fromEntries(BACKGROUNDS.map((b) => [b.id, b]))

export function paletteById(id) { return PAL_BY_ID[id] || PAL_BY_ID[DEFAULT_PALETTE] }
export function backgroundById(id) { return BG_BY_ID[id] || BG_BY_ID[DEFAULT_BACKGROUND] }

export function localizedThemeName(theme, lang) {
  return theme[`name_${lang}`] ?? theme.name_en
}
