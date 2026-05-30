// The fields of progress, each tagged with its super-category. `key` matches
// the stp_milestones.field CHECK and the i18n key under `fields.*`. `color`
// drives the timeline field tags, By-Field tiles, and map markers — kept here
// so all three views stay visually consistent.
export const FIELDS = [
  // ---------- Science & Technology ----------
  { key: 'physics',           category: 'science_tech', color: '#5b6dca', emoji: '⚛️' },
  { key: 'astronomy',         category: 'science_tech', color: '#7e57c2', emoji: '🔭' },
  { key: 'medicine',          category: 'science_tech', color: '#d6455a', emoji: '🩺' },
  { key: 'computing',         category: 'science_tech', color: '#1f9e8f', emoji: '💻' },
  { key: 'energy',            category: 'science_tech', color: '#e2952b', emoji: '⚡' },
  { key: 'transport',         category: 'science_tech', color: '#c1622d', emoji: '🧭' },
  { key: 'communication',     category: 'science_tech', color: '#3f9a55', emoji: '📡' },
  { key: 'biology_chemistry', category: 'science_tech', color: '#7a9a35', emoji: '🧬' },
  { key: 'space',             category: 'science_tech', color: '#2f3e74', emoji: '🚀' },
  // ---------- Economy & Industry ----------
  { key: 'agriculture',       category: 'economy_industry', color: '#b8862e', emoji: '🌾' },
  { key: 'trade',             category: 'economy_industry', color: '#a04f2e', emoji: '🐪' },
  { key: 'finance',           category: 'economy_industry', color: '#2f6d4a', emoji: '💰' },
  { key: 'industry',          category: 'economy_industry', color: '#4d5764', emoji: '🏭' },
  { key: 'labor',             category: 'economy_industry', color: '#884c5a', emoji: '👷' }
]

const BY_KEY = Object.fromEntries(FIELDS.map((f) => [f.key, f]))

export function fieldMeta(key) {
  return BY_KEY[key] || { key, category: null, color: '#888', emoji: '•' }
}

export function fieldsForCategory(catKey) {
  return FIELDS.filter((f) => f.category === catKey)
}
