import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../../lib/supabase'
import TrilingualField from '../../components/TrilingualField'

function blank() {
  return {
    id: null,
    name_en: '', name_it: '', name_zh: '',
    bio_en: '',  bio_it: '',  bio_zh: '',
    birth_year: null, death_year: null,
    nationality: '', portrait_url: ''
  }
}

function FigureEditor({ initial, onSave, onDelete, onClose }) {
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
        bio_en:  form.bio_en,  bio_it:  form.bio_it,  bio_zh:  form.bio_zh,
        birth_year: form.birth_year, death_year: form.death_year,
        nationality: form.nationality || null,
        portrait_url: form.portrait_url || null
      }
      const q = form.id
        ? supabase.from('stp_figures').update(payload).eq('id', form.id).select().single()
        : supabase.from('stp_figures').insert(payload).select().single()
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
      const { error } = await supabase.from('stp_figures').delete().eq('id', form.id)
      if (error) throw error
      onDelete(form.id)
    } catch (e) { setError(e.message); setSaving(false) }
  }

  return (
    <div className="admin-row-body">
      <h4 className="admin-section-h">{t('admin.figures.name')}</h4>
      <TrilingualField
        field="name"
        values={{ en: form.name_en, it: form.name_it, zh: form.name_zh }}
        onChange={(lang, v) => patchTri('name', lang, v)}
      />

      <h4 className="admin-section-h">{t('admin.figures.bio')}</h4>
      <TrilingualField
        field="bio"
        multiline
        values={{ en: form.bio_en, it: form.bio_it, zh: form.bio_zh }}
        onChange={(lang, v) => patchTri('bio', lang, v)}
      />

      <div className="admin-field-grid">
        <label className="admin-field">
          <span>{t('admin.figures.birth')}</span>
          <input type="number" value={form.birth_year ?? ''}
            onChange={(e) => patch({ birth_year: e.target.value === '' ? null : parseInt(e.target.value, 10) })} />
        </label>
        <label className="admin-field">
          <span>{t('admin.figures.death')}</span>
          <input type="number" value={form.death_year ?? ''}
            onChange={(e) => patch({ death_year: e.target.value === '' ? null : parseInt(e.target.value, 10) })} />
        </label>
        <label className="admin-field">
          <span>{t('admin.figures.nationality')}</span>
          <input type="text" value={form.nationality || ''} onChange={(e) => patch({ nationality: e.target.value })} />
        </label>
      </div>

      <label className="admin-field">
        <span>{t('admin.figures.portrait')}</span>
        <input type="url" value={form.portrait_url || ''} onChange={(e) => patch({ portrait_url: e.target.value })} />
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

export default function FiguresAdmin() {
  const { t } = useTranslation()
  const [figures, setFigures] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [expanded, setExpanded] = useState(null)
  const [creating, setCreating] = useState(false)
  const [filter, setFilter] = useState('')

  useEffect(() => {
    let active = true
    supabase.from('stp_figures').select('*').order('name_en', { nullsFirst: false })
      .then(({ data, error }) => {
        if (!active) return
        if (error) setError(error.message)
        else setFigures(data || [])
        setLoading(false)
      })
    return () => { active = false }
  }, [])

  const filtered = useMemo(() => {
    const needle = filter.toLowerCase().trim()
    if (!needle) return figures
    return figures.filter((f) =>
      ((f.name_en || '') + ' ' + (f.name_it || '') + ' ' + (f.name_zh || '') + ' ' + (f.nationality || ''))
        .toLowerCase().includes(needle)
    )
  }, [figures, filter])

  function handleSave(saved) {
    setFigures((list) => {
      const i = list.findIndex((m) => m.id === saved.id)
      if (i === -1) return [...list, saved]
      const next = [...list]; next[i] = saved; return next
    })
    setExpanded(null); setCreating(false)
  }
  function handleDelete(id) { setFigures((l) => l.filter((m) => m.id !== id)); setExpanded(null) }

  return (
    <div className="admin-page">
      <h1 className="admin-h1">{t('admin.figures.heading')}</h1>
      <p className="admin-sub">{t('admin.figures.count', { count: figures.length })}</p>

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
          <FigureEditor initial={blank()} onSave={handleSave} onDelete={() => {}} onClose={() => setCreating(false)} />
        </div>
      )}

      <div className="admin-list">
        {filtered.map((f) => (
          <div key={f.id} className="admin-row">
            <button type="button" className="admin-row-head"
              onClick={() => setExpanded(expanded === f.id ? null : f.id)}>
              <span className="admin-row-title">{f.name_en || f.name_zh || f.name_it || '(unnamed)'}</span>
              <span className="admin-row-meta">{f.birth_year ?? '?'}–{f.death_year ?? '?'} · {f.nationality || '—'}</span>
            </button>
            {expanded === f.id && (
              <FigureEditor initial={f} onSave={handleSave} onDelete={handleDelete} onClose={() => setExpanded(null)} />
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
