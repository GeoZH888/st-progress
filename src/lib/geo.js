// Haversine great-circle distance between two lat/lng points, in metres.
export function haversineMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000 // Earth radius (m)
  const toRad = (d) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(a))
}

// Human-friendly distance: "850 m" under 1 km, otherwise "12.3 km".
export function formatDistance(meters, t) {
  if (meters < 1000) return `${Math.round(meters)} ${t('common.m')}`
  return `${(meters / 1000).toFixed(1)} ${t('common.km')}`
}

// Florence (Duomo) — default map center when geolocation is denied/unavailable.
export const FLORENCE = { lat: 43.7696, lng: 11.2558 }
