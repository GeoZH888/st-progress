// Shared year formatting. "-250" -> "250 BCE", "105" -> "105 CE", "1687" -> "1687".
export function formatYear(year, t) {
  if (year == null || year === '') return ''
  if (year < 0) return `${Math.abs(year)} ${t('timeline.bce')}`
  if (year < 1000) return `${year} ${t('timeline.ce')}`
  return `${year}`
}

// Figure lifespan, e.g. "1879 – 1955", "1955 – present", "287 BCE – 212 BCE".
// Returns '' for combined/anonymous figures with no years.
export function lifespan(figure, t) {
  if (!figure) return ''
  const { birth_year: b, death_year: d } = figure
  if (b == null && d == null) return ''
  const bs = b != null ? formatYear(b, t) : '?'
  const ds = d != null ? formatYear(d, t) : t('detail.present')
  return `${bs} – ${ds}`
}
