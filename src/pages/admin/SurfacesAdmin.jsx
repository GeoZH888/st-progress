import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { fetchSharedSurfaces, upsertSharedSurface, deleteSharedSurface } from '../../lib/surfacesDb'
import { compileExpr } from '../../lib/customSurfaces'
import { CATEGORIES } from '../../lib/categories'
import TrilingualField from '../../components/TrilingualField'

function blank() {
  return {
    id: null,
    category: 'science_tech',
    name_en: '', name_it: '', name_zh: '',
    equation: '',
    x_expr: 'sin(u)*cos(v)', y_expr: 'sin(u)*sin(v)', z_expr: 'cos(u)',
    sort_order: 100
  }
}

function SurfaceEditor({ initial, onSave, onDelete, onClose }) {
  const { t } = useTranslation()
  const [form, setForm] = useState(initial)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  function patch(u) { setForm((f) => ({ ...f, ...u })) }
  function patchTri(field, lang, value) { patch({ [`${field}_${lang}`]: value }) }

  function askLeoForFormula() {
    const prompt = `Give me a parametric surface for a beautiful shape (sphere variations, knots, minimal surfaces, shells, etc.).
Return ONLY a JSON object with these keys — x/y/z are JavaScript expressions in u and v (u, v ∈ [0, 2π]) using only sin, cos, sinh, cosh, sqrt, exp, log, pow, abs, PI:
{
  "name_en": "...", "name_it": "...", "name_zh": "...",
  "equation": "<LaTeX>",
  "x_expr": "...", "y_expr": "...", "z_expr": "..."
}`
    window.dispatchEvent(new CustomEvent('leonardo-open', { detail: { prompt } }))
  }

  async function handleSave() {
    setSaving(true); setError(null)
    try {
      // Validate compiles BEFORE saving so an admin doesn't ship a broken
      // surface to the public.
      compileExpr(form.x_expr)
      compileExpr(form.y_expr)
      compileExpr(form.z_expr)
      const payload = {
        category: form.category,
        name_en: form.name_en, name_it: form.name_it, name_zh: form.name_zh,
        equation: form.equation || null,
        x_expr: form.x_expr,
        y_expr: form.y_expr,
        z_expr: form.z_expr,
        sort_order: form.sort_order ?? 100
      }
      if (form.id) payload.id = form.id
      const saved = await upsertSharedSurface(payload)
      onSave(saved)
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
      await deleteSharedSurface(form.id)
      onDelete(form.id)
    } catch (e) { setError(e.message); setSaving(false) }
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
          <span>{t('admin.surfaces.sort')}</span>
          <input type="number" value={form.sort_order ?? 100}
            onChange={(e) => patch({ sort_order: e.target.value === '' ? 100 : parseInt(e.target.value, 10) })} />
        </label>
        <label className="admin-field">
          <span>&nbsp;</span>
          <button type="button" className="admin-btn admin-btn-ghost" onClick={askLeoForFormula}>
            ✨ {t('admin.surfaces.askLeo')}
          </button>
        </label>
      </div>

      <h4 className="admin-section-h">{t('admin.surfaces.name')}</h4>
      <TrilingualField
        field="name"
        values={{ en: form.name_en, it: form.name_it, zh: form.name_zh }}
        onChange={(lang, v) => patchTri('name', lang, v)}
      />

      <label className="admin-field">
        <span>{t('admin.surfaces.equation')}</span>
        <input type="text" value={form.equation || ''} onChange={(e) => patch({ equation: e.target.value })}
          placeholder="x = \sin u \cos v,\; y = \sin u \sin v,\; z = \cos u" />
      </label>

      <div className="admin-field-grid">
        <label className="admin-field">
          <span>x(u, v)</span>
          <input type="text" value={form.x_expr} onChange={(e) => patch({ x_expr: e.target.value })} />
        </label>
        <label className="admin-field">
          <span>y(u, v)</span>
          <input type="text" value={form.y_expr} onChange={(e) => patch({ y_expr: e.target.value })} />
        </label>
        <label className="admin-field">
          <span>z(u, v)</span>
          <input type="text" value={form.z_expr} onChange={(e) => patch({ z_expr: e.target.value })} />
        </label>
      </div>
      <p className="admin-sub">{t('admin.surfaces.hint')}</p>

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

export default function SurfacesAdmin() {
  const { t } = useTranslation()
  const [surfaces, setSurfaces] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [expanded, setExpanded] = useState(null)
  const [creating, setCreating] = useState(false)
  const [filter, setFilter] = useState('')
  const [filterCat, setFilterCat] = useState('all')

  useEffect(() => {
    let active = true
    fetchSharedSurfaces()
      .then((data) => { if (active) { setSurfaces(data); setLoading(false) } })
      .catch((e) => { if (active) { setError(e.message); setLoading(false) } })
    return () => { active = false }
  }, [])

  const filtered = useMemo(() => {
    const needle = filter.toLowerCase().trim()
    return surfaces.filter((s) => {
      if (filterCat !== 'all' && s.category !== filterCat) return false
      if (!needle) return true
      return ((s.name_en || '') + ' ' + (s.name_zh || '') + ' ' + (s.name_it || ''))
        .toLowerCase().includes(needle)
    })
  }, [surfaces, filter, filterCat])

  function handleSave(saved) {
    setSurfaces((list) => {
      const i = list.findIndex((s) => s.id === saved.id)
      if (i === -1) return [...list, saved].sort((a, b) => (a.sort_order ?? 100) - (b.sort_order ?? 100))
      const next = [...list]; next[i] = saved; return next
    })
    setExpanded(null); setCreating(false)
  }
  function handleDelete(id) { setSurfaces((l) => l.filter((s) => s.id !== id)); setExpanded(null) }

  return (
    <div className="admin-page">
      <h1 className="admin-h1">{t('admin.surfaces.heading')}</h1>
      <p className="admin-sub">{t('admin.surfaces.count', { count: surfaces.length })}</p>

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
          <SurfaceEditor initial={blank()} onSave={handleSave} onDelete={() => {}} onClose={() => setCreating(false)} />
        </div>
      )}

      <div className="admin-list">
        {filtered.map((s) => (
          <div key={s.id} className="admin-row">
            <button type="button" className="admin-row-head"
              onClick={() => setExpanded(expanded === s.id ? null : s.id)}>
              <span className="admin-row-title">{s.name_en || s.name_zh || '(untitled)'}</span>
              <span className="admin-row-meta">{s.category} · #{s.sort_order ?? 100}</span>
            </button>
            {expanded === s.id && (
              <SurfaceEditor initial={s} onSave={handleSave} onDelete={handleDelete} onClose={() => setExpanded(null)} />
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
