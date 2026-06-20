import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../../lib/supabase'
import TrilingualField from '../../components/TrilingualField'

function blank() {
  return { id: null, name_en: '', name_it: '', name_zh: '', lat: null, lng: null, city: '', country: '' }
}

function LocationEditor({ initial, onSave, onDelete, onClose }) {
  const { t } = useTranslation()
  const [form, setForm] = useState(initial)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  function patch(u) { setForm((f) => ({ ...f, ...u })) }
  function patchTri(field, lang, value) { patch({ [`${field}_${lang}`]: value }) }

  async function handleSave() {
    setSaving(true); setError(null)
    try {
      const payload = {
        name_en: form.name_en, name_it: form.name_it, name_zh: form.name_zh,
        lat: form.lat, lng: form.lng,
        city: form.city || null, country: form.country || null
      }
      const q = form.id
        ? supabase.from('stp_locations').update(payload).eq('id', form.id).select().single()
        : supabase.from('stp_locations').insert(payload).select().single()
      const { data, error } = await q
      if (error) throw error
      onSave(data)
    } catch (e) { setError(e.message) }
    finally { setSaving(false) }
  }

  async function handleDelete() {
    if (!window.confirm(t('admin.confirmDelete'))) return
    setSaving(true)
    try {
      const { error } = await supabase.from('stp_locations').delete().eq('id', form.id)
      if (error) throw error
      onDelete(form.id)
    } catch (e) { setError(e.message); setSaving(false) }
  }

  return (
    <div className="admin-row-body">
      <h4 className="admin-section-h">{t('admin.locations.name')}</h4>
      <TrilingualField
        field="name"
        values={{ en: form.name_en, it: form.name_it, zh: form.name_zh }}
        onChange={(lang, v) => patchTri('name', lang, v)}
      />

      <div className="admin-field-grid">
        <label className="admin-field">
          <span>{t('admin.locations.lat')}</span>
          <input type="number" step="0.0001" value={form.lat ?? ''}
            onChange={(e) => patch({ lat: e.target.value === '' ? null : parseFloat(e.target.value) })} />
        </label>
        <label className="admin-field">
          <span>{t('admin.locations.lng')}</span>
          <input type="number" step="0.0001" value={form.lng ?? ''}
            onChange={(e) => patch({ lng: e.target.value === '' ? null : parseFloat(e.target.value) })} />
        </label>
        <label className="admin-field">
          <span>{t('admin.locations.city')}</span>
          <input type="text" value={form.city || ''} onChange={(e) => patch({ city: e.target.value })} />
        </label>
        <label className="admin-field">
          <span>{t('admin.locations.country')}</span>
          <input type="text" value={form.country || ''} onChange={(e) => patch({ country: e.target.value })} />
        </label>
      </div>

      {error && <div className="admin-error">{error}</div>}

      <div className="admin-row-actions">
        <button type="button" className="admin-btn admin-btn-ghost" onClick={onClose} disabled={saving}>{t('admin.cancel')}</button>
        {form.id && <button type="button" className="admin-btn admin-btn-danger" onClick={handleDelete} disabled={saving}>{t('admin.delete')}</button>}
        <button type="button" className="admin-btn admin-btn-primary" onClick={handleSave} disabled={saving}>
          {saving ? t('admin.saving') : t('admin.save')}
        </button>
      </div>
    </div>
  )
}

export default function LocationsAdmin() {
  const { t } = useTranslation()
  const [locations, setLocations] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [expanded, setExpanded] = useState(null)
  const [creating, setCreating] = useState(false)
  const [filter, setFilter] = useState('')

  useEffect(() => {
    let active = true
    supabase.from('stp_locations').select('*').order('city', { nullsFirst: false })
      .then(({ data, error }) => {
        if (!active) return
        if (error) setError(error.message)
        else setLocations(data || [])
        setLoading(false)
      })
    return () => { active = false }
  }, [])

  const filtered = useMemo(() => {
    const needle = filter.toLowerCase().trim()
    if (!needle) return locations
    return locations.filter((l) =>
      ((l.name_en || '') + ' ' + (l.city || '') + ' ' + (l.country || '') + ' ' + (l.name_zh || ''))
        .toLowerCase().includes(needle)
    )
  }, [locations, filter])

  function handleSave(saved) {
    setLocations((list) => {
      const i = list.findIndex((m) => m.id === saved.id)
      if (i === -1) return [...list, saved]
      const next = [...list]; next[i] = saved; return next
    })
    setExpanded(null); setCreating(false)
  }
  function handleDelete(id) { setLocations((l) => l.filter((m) => m.id !== id)); setExpanded(null) }

  return (
    <div className="admin-page">
      <h1 className="admin-h1">{t('admin.locations.heading')}</h1>
      <p className="admin-sub">{t('admin.locations.count', { count: locations.length })}</p>

      <div className="admin-toolbar">
        <input type="search" placeholder={t('admin.search')} value={filter} onChange={(e) => setFilter(e.target.value)} />
        <button type="button" className="admin-btn admin-btn-primary" onClick={() => { setCreating(true); setExpanded(null) }}>
          + {t('admin.addNew')}
        </button>
      </div>

      {loading && <p>{t('common.loading')}</p>}
      {error && <div className="admin-error">{error}</div>}

      {creating && (
        <div className="admin-row">
          <LocationEditor initial={blank()} onSave={handleSave} onDelete={() => {}} onClose={() => setCreating(false)} />
        </div>
      )}

      <div className="admin-list">
        {filtered.map((l) => (
          <div key={l.id} className="admin-row">
            <button type="button" className="admin-row-head"
              onClick={() => setExpanded(expanded === l.id ? null : l.id)}>
              <span className="admin-row-title">{l.name_en || l.city || l.name_zh || '(unnamed)'}</span>
              <span className="admin-row-meta">
                {l.city ? `${l.city}${l.country ? ', ' + l.country : ''}` : '—'}
                {l.lat != null && l.lng != null ? ` · ${l.lat.toFixed(2)}, ${l.lng.toFixed(2)}` : ''}
              </span>
            </button>
            {expanded === l.id && (
              <LocationEditor initial={l} onSave={handleSave} onDelete={handleDelete} onClose={() => setExpanded(null)} />
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
