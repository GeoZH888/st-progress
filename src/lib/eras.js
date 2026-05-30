// Eras give the timeline its bands. `key` matches stp_milestones.era and the
// i18n keys under `eras.*` / `eraRange.*`. `start` is the inclusive lower year
// bound (used to order bands and to derive an era when a row leaves it blank).
export const ERAS = [
  { key: 'Ancient', start: -10000, accent: '#7a5230' },
  { key: 'Renaissance', start: 1400, accent: '#9c5a2f' },
  { key: 'Industrial', start: 1700, accent: '#4a5568' },
  { key: 'Modern', start: 1900, accent: '#2f6d8c' },
  { key: 'Digital', start: 1970, accent: '#2a8c7a' }
]

export const ERA_ORDER = ERAS.map((e) => e.key)

const BY_KEY = Object.fromEntries(ERAS.map((e) => [e.key, e]))

export function eraMeta(key) {
  return BY_KEY[key] || { key, start: 0, accent: '#888' }
}

// Fallback when a milestone has no `era` set: bucket it by year.
export function eraForYear(year) {
  let current = ERAS[0].key
  for (const e of ERAS) {
    if (year >= e.start) current = e.key
  }
  return current
}

// Sort key for an era band, so bands always read antiquity -> present.
export function eraIndex(key) {
  const i = ERA_ORDER.indexOf(key)
  return i === -1 ? ERA_ORDER.length : i
}
