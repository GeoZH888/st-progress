import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../../lib/supabase'
import { CATEGORIES } from '../../lib/categories'
import { FIELDS, fieldsForCategory } from '../../lib/fields'
import { ERA_ORDER } from '../../lib/eras'
import TrilingualField from '../../components/TrilingualField'

const TRILINGUAL_COLS = ['title_en', 'title_it', 'title_zh', 'desc_en', 'desc_it', 'desc_zh']

function blankMilestone() {
  return {
    id: null,
    category: 'science_tech',
    field: 'physics',
    year: null,
    era: '',
    title_en: '', title_it: '', title_zh: '',
    desc_en: '',  desc_it: '',  desc_zh: '',
    figure_id: '',
    location_id: '',
    image_url: ''
  }
}

function MilestoneEditor({ initial, figures, locations, onSave, onDelete, onClose }) {
  const { t } = useTranslation()
  const [form, setForm] = useState(initial)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const visibleFields = useMemo(() => fieldsForCategory(form.category) || FIELDS, [form.category])

  function patch(updates) { setForm((f) => ({ ...f, ...updates })) }
  function patchTri(field, lang, value) { patch({ [`${field}_${lang}`]: value }) }

  async function handleSave() {
    setSaving(true); setError(null)
    try {
      const payload = {
        category: form.category,
        field: form.field,
        year: form.year,
        era: form.era || null,
        title_en: form.title_en, title_it: form.title_it, title_zh: form.title_zh,
        desc_en: form.desc_en,   desc_it: form.desc_it,   desc_zh: form.desc_zh,
        figure_id: form.figure_id || null,
        location_id: form.location_id || null,
        image_url: form.image_url || null
      }
      const q = form.id
        ? supabase.from('stp_milestones').update(payload).eq('id', form.id).select().single()
        : supabase.from('stp_milestones').insert(payload).select().single()
      const { data, error } = await q
      if (error) throw error
      onSave(data)
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!window.confirm(t('admin.confirmDelete'))) return
    setSaving(true)
    try {
      const { error } = await supabase.from('stp_milestones').delete().eq('id', form.id)
      if (error) throw error
      onDelete(form.id)
    } catch (e) {
      setError(e.message); setSaving(false)
    }
  }

  return (
    <div className="admin-row-body">
      <div className="admin-field-grid">
        <label className="admin-field">
          <span>{t('admin.milestones.category')}</span>
          <select value={form.category} onChange={(e) => patch({ category: e.target.value })}>
            {CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.key}</option>)}
          </select>
        </label>
        <label className="admin-field">
          <span>{t('admin.milestones.field')}</span>
          <select value={form.field} onChange={(e) => patch({ field: e.target.value })}>
            {visibleFields.map((f) => <option key={f.key} value={f.key}>{f.emoji} {f.key}</option>)}
          </select>
        </label>
        <label className="admin-field">
          <span>{t('admin.milestones.year')}</span>
          <input type="number" value={form.year ?? ''}
            onChange={(e) => patch({ year: e.target.value === '' ? null : parseInt(e.target.value, 10) })}
            placeholder="negative = BCE" />
        </label>
        <label className="admin-field">
          <span>{t('admin.milestones.era')}</span>
          <select value={form.era ?? ''} onChange={(e) => patch({ era: e.target.value })}>
            <option value="">{t('admin.auto')}</option>
            {ERA_ORDER.map((e) => <option key={e} value={e}>{e}</option>)}
          </select>
        </label>
        <label className="admin-field">
          <span>{t('admin.milestones.figure')}</span>
          <select value={form.figure_id || ''} onChange={(e) => patch({ figure_id: e.target.value })}>
            <option value="">—</option>
            {figures.map((f) => (
              <option key={f.id} value={f.id}>{f.name_en || f.name_zh || f.name_it}</option>
            ))}
          </select>
        </label>
        <label className="admin-field">
          <span>{t('admin.milestones.location')}</span>
          <select value={form.location_id || ''} onChange={(e) => patch({ location_id: e.target.value })}>
            <option value="">—</option>
            {locations.map((l) => (
              <option key={l.id} value={l.id}>{l.name_en || l.city || l.name_zh}</option>
            ))}
          </select>
        </label>
      </div>

      <h4 className="admin-section-h">{t('admin.milestones.title')}</h4>
      <TrilingualField
        field="title"
        values={{ en: form.title_en, it: form.title_it, zh: form.title_zh }}
        onChange={(lang, v) => patchTri('title', lang, v)}
      />

      <h4 className="admin-section-h">{t('admin.milestones.desc')}</h4>
      <TrilingualField
        field="desc"
        multiline
        values={{ en: form.desc_en, it: form.desc_it, zh: form.desc_zh }}
        onChange={(lang, v) => patchTri('desc', lang, v)}
      />

      <label className="admin-field">
        <span>{t('admin.milestones.imageUrl')}</span>
        <input type="url" value={form.image_url || ''} onChange={(e) => patch({ image_url: e.target.value })} />
      </label>

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

export default function MilestonesAdmin() {
  const { t } = useTranslation()
  const [milestones, setMilestones] = useState([])
  const [figures, setFigures] = useState([])
  const [locations, setLocations] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [expanded, setExpanded] = useState(null)
  const [creating, setCreating] = useState(false)
  const [filter, setFilter] = useState('')
  const [filterCat, setFilterCat] = useState('all')

  useEffect(() => {
    let active = true
    Promise.all([
      supabase.from('stp_milestones').select('*').order('year', { ascending: true }),
      supabase.from('stp_figures').select('id, name_en, name_it, name_zh').order('name_en', { nullsFirst: false }),
      supabase.from('stp_locations').select('id, name_en, name_it, name_zh, city').order('city', { nullsFirst: false })
    ]).then(([m, f, l]) => {
      if (!active) return
      if (m.error) setError(m.error.message)
      else {
        setMilestones(m.data || [])
        setFigures(f.data || [])
        setLocations(l.data || [])
      }
      setLoading(false)
    })
    return () => { active = false }
  }, [])

  const filtered = useMemo(() => {
    const needle = filter.toLowerCase().trim()
    return milestones.filter((m) => {
      if (filterCat !== 'all' && m.category !== filterCat) return false
      if (!needle) return true
      const hay = TRILINGUAL_COLS.map((c) => m[c] || '').join(' ').toLowerCase()
      return hay.includes(needle)
    })
  }, [milestones, filter, filterCat])

  function handleSave(saved) {
    setMilestones((list) => {
      const i = list.findIndex((m) => m.id === saved.id)
      if (i === -1) return [...list, saved].sort((a, b) => (a.year ?? 0) - (b.year ?? 0))
      const next = [...list]; next[i] = saved; return next
    })
    setExpanded(null); setCreating(false)
  }

  function handleDelete(id) {
    setMilestones((list) => list.filter((m) => m.id !== id))
    setExpanded(null)
  }

  return (
    <div className="admin-page">
      <h1 className="admin-h1">{t('admin.milestones.heading')}</h1>
      <p className="admin-sub">{t('admin.milestones.count', { count: milestones.length })}</p>

      <div className="admin-toolbar">
        <input type="search" placeholder={t('admin.search')} value={filter} onChange={(e) => setFilter(e.target.value)} />
        <select value={filterCat} onChange={(e) => setFilterCat(e.target.value)}>
          <option value="all">{t('admin.allCategories')}</option>
          {CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.key}</option>)}
        </select>
        <button type="button" className="admin-btn admin-btn-primary" onClick={() => { setCreating(true); setExpanded(null) }}>
          + {t('admin.addNew')}
        </button>
      </div>

      {loading && <p>{t('common.loading')}</p>}
      {error && <div className="admin-error">{error}</div>}

      {creating && (
        <div className="admin-row">
          <MilestoneEditor
            initial={blankMilestone()}
            figures={figures}
            locations={locations}
            onSave={handleSave}
            onDelete={() => {}}
            onClose={() => setCreating(false)}
          />
        </div>
      )}

      <div className="admin-list">
        {filtered.map((m) => (
          <div key={m.id} className="admin-row">
            <button type="button" className="admin-row-head"
              onClick={() => setExpanded(expanded === m.id ? null : m.id)}>
              <span className="admin-row-title">{m.title_en || m.title_zh || m.title_it || '(untitled)'}</span>
              <span className="admin-row-meta">{m.year ?? '?'} · {m.field}</span>
            </button>
            {expanded === m.id && (
              <MilestoneEditor
                initial={m}
                figures={figures}
                locations={locations}
                onSave={handleSave}
                onDelete={handleDelete}
                onClose={() => setExpanded(null)}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
