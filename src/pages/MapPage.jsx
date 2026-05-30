import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'

import { getLocations } from '../lib/queries'
import { localized } from '../lib/supabase'
import { useFetch } from '../lib/useFetch'
import { haversineMeters, formatDistance, FLORENCE } from '../lib/geo'
import { fieldMeta, fieldsForCategory } from '../lib/fields'
import { CATEGORIES } from '../lib/categories'
import { formatYear } from '../lib/format'
import { Loading, ErrorState } from '../components/Status'
import './MapPage.css'

// Imperatively recenter the map when the user's position is found.
function Recenter({ center, zoom }) {
  const map = useMap()
  if (center) map.flyTo([center.lat, center.lng], zoom ?? map.getZoom(), { duration: 0.8 })
  return null
}

export default function MapPage() {
  const { t, i18n } = useTranslation()
  const lang = i18n.language
  const navigate = useNavigate()

  const { data: locations, loading, error } = useFetch(getLocations, [])

  const [userPos, setUserPos] = useState(null)
  const [geoStatus, setGeoStatus] = useState('idle') // idle | locating | ok | denied

  function handleNearMe() {
    if (!navigator.geolocation) {
      setGeoStatus('denied')
      return
    }
    setGeoStatus('locating')
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserPos({ lat: pos.coords.latitude, lng: pos.coords.longitude })
        setGeoStatus('ok')
      },
      () => setGeoStatus('denied'),
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }

  // One plottable point per location (each carries its milestone for color + link).
  const points = useMemo(
    () =>
      (locations ?? [])
        .filter((l) => l.lat != null && l.lng != null && l.milestones?.length)
        .map((l) => ({ ...l, milestone: l.milestones[0] })),
    [locations]
  )

  // Distance-sorted list, computed only once we have the user's position.
  const sorted = useMemo(() => {
    if (!userPos) return []
    return points
      .map((p) => ({ ...p, distance: haversineMeters(userPos.lat, userPos.lng, p.lat, p.lng) }))
      .sort((a, b) => a.distance - b.distance)
  }, [userPos, points])

  if (loading) return <div className="page"><Loading /></div>
  if (error) return <div className="page"><ErrorState error={error} /></div>

  const center = userPos ?? FLORENCE

  return (
    <div className="page map-page">
      <div className="map-head">
        <div>
          <h1 className="page-title" style={{ marginBottom: 0 }}>{t('map.title')}</h1>
          <p className="page-subtitle" style={{ marginTop: '0.2rem' }}>{t('map.subtitle')}</p>
        </div>
        <button className="btn" onClick={handleNearMe} disabled={geoStatus === 'locating'}>
          📍 {geoStatus === 'locating' ? t('map.locating') : t('map.nearMe')}
        </button>
      </div>

      {geoStatus === 'denied' && (
        <p className="muted" style={{ marginTop: 0 }}>⚠️ {t('map.denied')}</p>
      )}

      <div className="map-wrap">
        <MapContainer center={[center.lat, center.lng]} zoom={4} scrollWheelZoom className="leaflet-map">
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {userPos && <Recenter center={userPos} zoom={9} />}

          {userPos && (
            <CircleMarker
              center={[userPos.lat, userPos.lng]}
              radius={9}
              pathOptions={{ color: '#fff', weight: 2, fillColor: '#1f3a5f', fillOpacity: 0.85 }}
            >
              <Popup>{t('map.you')}</Popup>
            </CircleMarker>
          )}

          {points.map((p) => {
            const fm = fieldMeta(p.milestone.field)
            return (
              <CircleMarker
                key={p.id}
                center={[p.lat, p.lng]}
                radius={8}
                pathOptions={{ color: '#fff', weight: 2, fillColor: fm.color, fillOpacity: 0.9 }}
              >
                <Popup>
                  <strong>{localized(p.milestone, 'title', lang)}</strong>
                  <br />
                  <span className="muted">
                    {formatYear(p.milestone.year, t)} · {localized(p, 'name', lang)}
                  </span>
                  <br />
                  <button
                    className="btn btn-gold"
                    style={{ marginTop: '0.5rem', padding: '0.3rem 0.7rem', fontSize: '0.8rem' }}
                    onClick={() => navigate(`/milestone/${p.milestone.id}`)}
                  >
                    {t('map.details')}
                  </button>
                </Popup>
              </CircleMarker>
            )
          })}
        </MapContainer>
      </div>

      {/* legend: marker colors by field, grouped by super-category */}
      <div className="map-legend">
        {CATEGORIES.map((c) => (
          <div className="legend-group" key={c.key}>
            <span className="legend-group-label">
              <span aria-hidden="true">{c.emoji}</span> {t(`categories.${c.key}.title`)}
            </span>
            <div className="legend-items">
              {fieldsForCategory(c.key).map((f) => (
                <span key={f.key} className="legend-item">
                  <span className="legend-dot" style={{ background: f.color }} aria-hidden="true" />
                  {t(`fields.${f.key}`)}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>

      {sorted.length > 0 && (
        <section className="around">
          <h2>{t('map.nearTitle')}</h2>
          <div className="stack">
            {sorted.map((p) => (
              <button
                key={p.id}
                className="around-item"
                onClick={() => navigate(`/milestone/${p.milestone.id}`)}
                style={{ '--field-color': fieldMeta(p.milestone.field).color }}
              >
                <div>
                  <strong>{localized(p.milestone, 'title', lang)}</strong>
                  <div className="muted" style={{ fontSize: '0.85rem' }}>
                    {localized(p, 'name', lang)}{p.city ? `, ${p.city}` : ''}
                  </div>
                </div>
                <span className="distance-badge">{formatDistance(p.distance, t)}</span>
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
