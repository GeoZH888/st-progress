// Super-categories group fields. `key` matches stp_milestones.category and
// the i18n keys under `categories.*`. `gradient` is used for the Home tiles
// and Timeline tab pills; `color` is the single-tone fallback.
export const CATEGORIES = [
  {
    key: 'science_tech',
    color: '#1f3a5f',
    emoji: '🔬',
    gradient: 'linear-gradient(140deg, #1f3a5f, #0f2440)'
  },
  {
    key: 'economy_industry',
    color: '#9c6b2f',
    emoji: '💰',
    gradient: 'linear-gradient(140deg, #9c6b2f, #5c3e15)'
  }
]

export const CATEGORY_KEYS = CATEGORIES.map((c) => c.key)

const BY_KEY = Object.fromEntries(CATEGORIES.map((c) => [c.key, c]))

export function categoryMeta(key) {
  return BY_KEY[key] || { key, color: '#888', emoji: '•', gradient: 'none' }
}
