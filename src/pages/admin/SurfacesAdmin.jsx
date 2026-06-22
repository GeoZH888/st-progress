import { Suspense, lazy, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  fetchSharedSurfaces, upsertSharedSurface, deleteSharedSurface,
  sharedRowToSurface
} from '../../lib/surfacesDb'
import {
  compileExpr,
  compileSource,
  compileMorphSource,
  compileAttractorSource,
  compilePointsSource
} from '../../lib/customSurfaces'
import { CATEGORIES } from '../../lib/categories'
import TrilingualField from '../../components/TrilingualField'

// Lazy: don't pull three.js into the admin bundle until the user actually
// expands a surface row.
const SurfaceViewer = lazy(() => import('../../components/SurfaceViewer'))

function blank() {
  return {
    id: null,
    category: 'science_tech',
    name_en: '', name_it: '', name_zh: '',
    equation: '',
    x_expr: 'sin(u)*cos(v)', y_expr: 'sin(u)*sin(v)', z_expr: 'cos(u)',
    source_code: '',
    sort_order: 100,
    published: false,
    featured: false,
    display_mode: 'animated',
    kind: 'parametric',
    slug: null,
    builtin_kind: null,
    point_count: null,
    params_schema: [],
    metadata: {}
  }
}

const KINDS = ['parametric', 'morph', 'attractor', 'points', 'builtin']
const BUILTIN_KINDS = ['torusKnot']
const KINDS_WITH_CODE = new Set(['parametric', 'morph', 'attractor', 'points'])
const KINDS_WITH_POINT_COUNT = new Set(['attractor', 'points'])

const STARTER_SOURCE = `// u, v ∈ [0, 2π].  Allowed: sin cos tan sinh cosh tanh sqrt cbrt
// abs exp log pow min max floor ceil PI E TAU
// Assign x, y, z below; intermediate locals are fine.
const R = 1.5, r = 0.4
const twist = sin(3 * u)
x = (R + r * cos(v) + 0.18 * twist) * cos(u)
y = (R + r * cos(v) + 0.18 * twist) * sin(u)
z = r * sin(v) + 0.18 * twist
`

// Per-kind starter bodies. Loaded into the textarea when the admin switches
// kind and the current source is empty (or via the "Load starter" button).
const STARTERS = {
  parametric: STARTER_SOURCE,
  morph: `// (u, v, time, p) — assign x, y, z. Use time to animate.
const phase = sin(time * 0.5) * PI
const r = 1 + 0.3 * cos(3 * u + phase)
x = r * cos(u) * sin(v)
y = r * cos(v)
z = r * sin(u) * sin(v)
`,
  attractor: `// (x, y, z, p) — state in; assign derivative dx, dy, dz.
// Wrapper integrates with fixed-step Euler. Lorenz example:
const sigma = (p && p.sigma != null) ? p.sigma : 10
const rho   = (p && p.rho   != null) ? p.rho   : 28
const beta  = (p && p.beta  != null) ? p.beta  : 8/3
dx = sigma * (y - x)
dy = x * (rho - z) - y
dz = x * y - beta * z
`,
  points: `// (i, n, p) — index in [0, n); assign x, y, z. Vogel example:
const angle = (i + 1) * (3 - sqrt(5)) * PI
const r = 0.06 * sqrt(i + 1)
x = r * cos(angle)
y = 0.06 * r * r
z = r * sin(angle)
`
}

function tryParseJson(raw, fallback) {
  if (typeof raw !== 'string') return raw ?? fallback
  if (!raw.trim()) return fallback
  try { return JSON.parse(raw) } catch { return fallback }
}

function stringifyForEditor(value, fallback) {
  if (value == null) return fallback
  if (typeof value === 'string') return value
  try { return JSON.stringify(value, null, 2) } catch { return fallback }
}

const PREVIEW_PALETTES = [
  'viridis', 'plasma', 'parula', 'turbo', 'jet', 'hot', 'magma',
  'inferno', 'gold-violet', 'sunset', 'ocean', 'ember', 'mono-gold'
]
const PREVIEW_BGS = ['renaissance', 'midnight', 'space', 'graphite', 'forest', 'parchment', 'paper']
const PREVIEW_MODES = ['solid', 'wireframe', 'both', 'points']
const PREVIEW_MOTIONS = [
  { id: 'off', value: 0 }, { id: 'gentle', value: 0.35 },
  { id: 'lively', value: 0.7 }, { id: 'wild', value: 1.0 }
]
const PREVIEW_SPEEDS = [
  { id: 'off',    value: 0    },
  { id: 'slow',   value: 0.4  },
  { id: 'normal', value: 1.0  },
  { id: 'fast',   value: 2.2  }
]

function configFromRow(row) {
  const c = row?.view_config || {}
  return {
    palette: c.palette || 'viridis',
    background: c.background || 'renaissance',
    motionId: idForMotion(c.motion),
    speedId: idForSpeed(c.speed),
    mode: c.mode || 'solid'
  }
}
function idForMotion(v) {
  if (v == null) return 'gentle'
  const m = PREVIEW_MOTIONS.find((x) => Math.abs(x.value - v) < 0.001)
  return m ? m.id : 'gentle'
}
function idForSpeed(v) {
  if (v == null) return 'normal'
  const m = PREVIEW_SPEEDS.find((x) => Math.abs(x.value - v) < 0.001)
  return m ? m.id : 'normal'
}

// Compile + render a surface row inside the admin editor so the super-admin
// can see how it looks (with full controls) before clicking Publish.
function SurfacePreview({ row, onSavedDefaults }) {
  const { t } = useTranslation()
  const initial = useMemo(() => configFromRow(row), [row])
  const [renderMode, setRenderMode] = useState(initial.mode)
  const [paletteId, setPaletteId] = useState(initial.palette)
  const [backgroundId, setBackgroundId] = useState(initial.background)
  const [motionId, setMotionId] = useState(initial.motionId)
  const [speedId, setSpeedId] = useState(initial.speedId)
  const [savingDefaults, setSavingDefaults] = useState(false)
  const [savedMsg, setSavedMsg] = useState(null)

  const { compiled, compileError } = useMemo(() => {
    try { return { compiled: sharedRowToSurface(row), compileError: null } }
    catch (e) { return { compiled: null, compileError: e.message } }
  }, [row])

  const motion = PREVIEW_MOTIONS.find((m) => m.id === motionId)?.value ?? 0.35
  const speed  = PREVIEW_SPEEDS.find((m) => m.id === speedId)?.value  ?? 1.0

  async function saveAsDefault() {
    if (!row?.id) return
    setSavingDefaults(true); setSavedMsg(null)
    try {
      const saved = await upsertSharedSurface({
        id: row.id,
        category: row.category,
        name_en: row.name_en, name_it: row.name_it, name_zh: row.name_zh,
        equation: row.equation || null,
        x_expr: row.x_expr, y_expr: row.y_expr, z_expr: row.z_expr,
        source_code: row.source_code || null,
        sort_order: row.sort_order ?? 100,
        published: !!row.published,
        featured: !!row.featured,
        display_mode: row.display_mode || 'animated',
        view_config: {
          palette: paletteId,
          background: backgroundId,
          motion,
          speed,
          mode: renderMode
        }
      })
      setSavedMsg('✓ ' + t('admin.surfaces.viewSaved'))
      setTimeout(() => setSavedMsg(null), 2500)
      onSavedDefaults?.(saved)
    } catch (e) {
      setSavedMsg('✗ ' + e.message)
    } finally {
      setSavingDefaults(false)
    }
  }

  if (!compiled) {
    return (
      <div className="admin-error" style={{ marginTop: '0.5rem', fontFamily: 'ui-monospace, Consolas, monospace', fontSize: '0.85rem' }}>
        Cannot preview — {compileError || 'fix the expressions above.'}
        {row?.kind && row.kind !== 'parametric' && (
          <div style={{ marginTop: '0.3rem', opacity: 0.75 }}>
            (kind = <code>{row.kind}</code>{row.builtin_kind ? ` · builtin_kind = `: ''}{row.builtin_kind && <code>{row.builtin_kind}</code>})
          </div>
        )}
      </div>
    )
  }
  return (
    <div className="admin-preview-wrap" style={{ marginTop: '0.6rem' }}>
      <div className="admin-preview-controls">
        <div className="admin-preview-row">
          <span className="admin-preview-lbl">{t('gallery.style')}:</span>
          {PREVIEW_MODES.map((m) => (
            <button key={m} type="button" className={`admin-preview-chip${renderMode === m ? ' on' : ''}`} onClick={() => setRenderMode(m)}>
              {t(`gallery.styles.${m}`)}
            </button>
          ))}
        </div>
        <div className="admin-preview-row">
          <span className="admin-preview-lbl">{t('gallery.motion')}:</span>
          {PREVIEW_MOTIONS.map((m) => (
            <button key={m.id} type="button" className={`admin-preview-chip${motionId === m.id ? ' on' : ''}`} onClick={() => setMotionId(m.id)}>
              {t(`gallery.motions.${m.id}`)}
            </button>
          ))}
        </div>
        <div className="admin-preview-row">
          <span className="admin-preview-lbl">{t('gallery.speed')}:</span>
          {PREVIEW_SPEEDS.map((m) => (
            <button key={m.id} type="button" className={`admin-preview-chip${speedId === m.id ? ' on' : ''}`} onClick={() => setSpeedId(m.id)}>
              {t(`gallery.speeds.${m.id}`)}
            </button>
          ))}
        </div>
        <div className="admin-preview-row">
          <span className="admin-preview-lbl">{t('gallery.palette')}:</span>
          <select value={paletteId} onChange={(e) => setPaletteId(e.target.value)} className="admin-preview-select">
            {PREVIEW_PALETTES.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
          <span className="admin-preview-lbl" style={{ marginLeft: '0.6rem' }}>{t('gallery.background')}:</span>
          <select value={backgroundId} onChange={(e) => setBackgroundId(e.target.value)} className="admin-preview-select">
            {PREVIEW_BGS.map((b) => <option key={b} value={b}>{b}</option>)}
          </select>
        </div>
        <div className="admin-preview-row" style={{ justifyContent: 'flex-end' }}>
          {savedMsg && <span className="admin-preview-lbl" style={{ marginRight: 'auto', color: savedMsg.startsWith('✓') ? '#18794e' : '#b53620' }}>{savedMsg}</span>}
          <button
            type="button"
            className="admin-btn admin-btn-primary"
            onClick={saveAsDefault}
            disabled={savingDefaults || !row?.id}
            title={row?.id ? t('admin.surfaces.saveDefaultsTip') : t('admin.surfaces.saveFirst')}
          >
            {savingDefaults ? '…' : `★ ${t('admin.surfaces.saveDefaults')}`}
          </button>
        </div>
      </div>
      <div style={{ width: '100%', aspectRatio: '4 / 3', maxHeight: 420, background: '#1c1814', borderRadius: 10, overflow: 'hidden' }}>
        <Suspense fallback={<div style={{ color: '#888', padding: '1rem' }}>loading 3D…</div>}>
          <SurfaceViewer
            surface={compiled}
            renderMode={renderMode}
            paletteId={paletteId}
            backgroundId={backgroundId}
            motion={motion}
            rotationSpeed={speed}
          />
        </Suspense>
      </div>
    </div>
  )
}

function SurfaceEditor({ initial, onSave, onDelete, onClose }) {
  const { t } = useTranslation()
  // Editor state mirrors the DB row but holds params_schema / metadata as raw
  // JSON strings so the admin can type partial JSON without parse errors
  // wiping their work. We parse + validate on save and for the live preview.
  const [form, setForm] = useState(() => ({
    ...initial,
    params_schema_raw: stringifyForEditor(initial.params_schema, '[]'),
    metadata_raw: stringifyForEditor(initial.metadata, '{}')
  }))
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

  const kind = form.kind || 'parametric'
  // 'Code mode' only exists for parametric (legacy x/y/z exprs vs source_code).
  // Other kinds always use source_code — there is no expression mode for them.
  const useCode = kind !== 'parametric' || (form.source_code || '').trim().length > 0

  function onKindChange(nextKind) {
    setForm((f) => {
      const patchObj = { kind: nextKind }
      // If switching to a kind that requires code and the body is empty, load
      // the per-kind starter so the admin sees a working template.
      const needsCode = KINDS_WITH_CODE.has(nextKind)
      if (needsCode && !(f.source_code || '').trim()) {
        patchObj.source_code = STARTERS[nextKind] || ''
      }
      if (nextKind === 'builtin') {
        // Builtin doesn't use source_code or x/y/z exprs.
        patchObj.source_code = null
        if (!f.builtin_kind) patchObj.builtin_kind = BUILTIN_KINDS[0]
      } else {
        patchObj.builtin_kind = null
      }
      if (!KINDS_WITH_POINT_COUNT.has(nextKind)) {
        patchObj.point_count = null
      }
      return { ...f, ...patchObj }
    })
  }

  function loadStarter() {
    if (KINDS_WITH_CODE.has(kind)) {
      patch({ source_code: STARTERS[kind] || '' })
    }
  }

  // Parsed JSON for the live preview. Failures fall back silently so the
  // preview keeps rendering with the previous valid value while admin edits.
  const paramsSchemaParsed = useMemo(
    () => tryParseJson(form.params_schema_raw, []),
    [form.params_schema_raw]
  )
  const metadataParsed = useMemo(
    () => tryParseJson(form.metadata_raw, {}),
    [form.metadata_raw]
  )
  const previewRow = useMemo(() => ({
    ...form,
    params_schema: Array.isArray(paramsSchemaParsed) ? paramsSchemaParsed : [],
    metadata: (metadataParsed && typeof metadataParsed === 'object' && !Array.isArray(metadataParsed))
      ? metadataParsed
      : {}
  }), [form, paramsSchemaParsed, metadataParsed])

  async function handleSave() {
    setSaving(true); setError(null)
    try {
      // Validate JSON fields strictly on save (live preview was permissive).
      const ps = JSON.parse(form.params_schema_raw || '[]')
      if (!Array.isArray(ps)) throw new Error('params_schema must be a JSON array')
      const md = JSON.parse(form.metadata_raw || '{}')
      if (!md || typeof md !== 'object' || Array.isArray(md)) {
        throw new Error('metadata must be a JSON object')
      }

      // Validate the body / expressions compile, dispatching on kind.
      if (kind === 'parametric') {
        if ((form.source_code || '').trim()) compileSource(form.source_code)
        else { compileExpr(form.x_expr); compileExpr(form.y_expr); compileExpr(form.z_expr) }
      } else if (kind === 'morph') {
        compileMorphSource(form.source_code)
      } else if (kind === 'attractor') {
        compileAttractorSource(form.source_code)
      } else if (kind === 'points') {
        compilePointsSource(form.source_code)
      } else if (kind === 'builtin') {
        if (!form.builtin_kind) throw new Error('Pick a built-in geometry')
        if (!BUILTIN_KINDS.includes(form.builtin_kind)) {
          throw new Error(`Unknown built-in geometry: ${form.builtin_kind}`)
        }
      }

      const isParametricExprs = kind === 'parametric' && !(form.source_code || '').trim()
      const payload = {
        category: form.category,
        name_en: form.name_en, name_it: form.name_it, name_zh: form.name_zh,
        equation: form.equation || null,
        slug: (form.slug || '').trim() || null,
        kind,
        builtin_kind: kind === 'builtin' ? form.builtin_kind : null,
        params_schema: ps,
        point_count: KINDS_WITH_POINT_COUNT.has(kind)
          ? (form.point_count == null || form.point_count === '' ? null : Number(form.point_count))
          : null,
        metadata: md,
        x_expr: isParametricExprs ? form.x_expr : null,
        y_expr: isParametricExprs ? form.y_expr : null,
        z_expr: isParametricExprs ? form.z_expr : null,
        source_code: kind === 'builtin' || isParametricExprs ? null : (form.source_code || null),
        sort_order: form.sort_order ?? 100,
        published: !!form.published,
        featured: !!form.featured,
        display_mode: form.display_mode === 'static' ? 'static' : 'animated'
      }
      if (form.id) payload.id = form.id
      const saved = await upsertSharedSurface(payload)
      // Re-derive the raw strings so the textareas stay consistent with what
      // the server returned (e.g. NULLs become '[]' / '{}').
      setForm((f) => ({
        ...f,
        ...saved,
        params_schema_raw: stringifyForEditor(saved.params_schema, '[]'),
        metadata_raw: stringifyForEditor(saved.metadata, '{}')
      }))
      onSave(saved)
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  async function togglePublish() {
    if (!form.id) {
      setError(t('admin.surfaces.saveFirst'))
      return
    }
    setSaving(true); setError(null)
    try {
      // Partial update — only flips the publish flag; every other column stays.
      const saved = await upsertSharedSurface({
        id: form.id,
        published: !form.published
      })
      setForm((f) => ({ ...f, published: saved.published }))
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
        <label className="admin-field" style={{ flexDirection: 'row', alignItems: 'center', gap: '0.5rem' }}>
          <input
            type="checkbox"
            checked={!!form.featured}
            onChange={(e) => patch({ featured: e.target.checked })}
            style={{ width: 'auto', margin: 0 }}
          />
          <span style={{ textTransform: 'none', letterSpacing: 0, fontSize: '0.92rem', color: 'var(--admin-ink)' }}>
            {t('admin.surfaces.featuredLabel')}
          </span>
        </label>
        <label className="admin-field">
          <span>{t('admin.surfaces.displayMode')}</span>
          <select value={form.display_mode || 'animated'} onChange={(e) => patch({ display_mode: e.target.value })}>
            <option value="animated">{t('admin.surfaces.modeAnimated')}</option>
            <option value="static">{t('admin.surfaces.modeStatic')}</option>
          </select>
        </label>
      </div>

      {/* ---------- kind + kind-specific knobs ---------- */}
      <div className="admin-field-grid">
        <label className="admin-field">
          <span>{t('admin.surfaces.kind')}</span>
          <select value={kind} onChange={(e) => onKindChange(e.target.value)}>
            {KINDS.map((k) => (
              <option key={k} value={k}>{t(`admin.surfaces.kinds.${k}`)}</option>
            ))}
          </select>
        </label>
        {kind === 'builtin' && (
          <label className="admin-field">
            <span>{t('admin.surfaces.builtinKind')}</span>
            <select value={form.builtin_kind || ''} onChange={(e) => patch({ builtin_kind: e.target.value })}>
              {BUILTIN_KINDS.map((bk) => (
                <option key={bk} value={bk}>{t(`admin.surfaces.builtinKinds.${bk}`)}</option>
              ))}
            </select>
          </label>
        )}
        {KINDS_WITH_POINT_COUNT.has(kind) && (
          <label className="admin-field">
            <span>{t('admin.surfaces.pointCount')}</span>
            <input
              type="number"
              value={form.point_count ?? ''}
              onChange={(e) => patch({ point_count: e.target.value === '' ? null : parseInt(e.target.value, 10) })}
              placeholder={kind === 'attractor' ? '7000' : '2000'}
            />
          </label>
        )}
        <label className="admin-field">
          <span>{t('admin.surfaces.slug')}</span>
          <input
            type="text"
            value={form.slug || ''}
            onChange={(e) => patch({ slug: e.target.value })}
            placeholder="klein, lorenz, …"
          />
        </label>
      </div>

      {/* ---------- body editor (kind-dependent) ---------- */}
      {kind === 'parametric' && (
        <div className="admin-field-grid" style={{ marginBottom: '0.4rem' }}>
          <label className="admin-field" style={{ gridColumn: '1 / -1', flexDirection: 'row', alignItems: 'center', gap: '0.5rem' }}>
            <input
              type="checkbox"
              checked={useCode}
              onChange={(e) => patch({ source_code: e.target.checked ? (form.source_code || STARTER_SOURCE) : '' })}
              style={{ width: 'auto', margin: 0 }}
            />
            <span style={{ textTransform: 'none', letterSpacing: 0, fontSize: '0.92rem', color: 'var(--admin-ink)' }}>
              {t('admin.surfaces.codeMode')}
            </span>
          </label>
        </div>
      )}

      {kind === 'builtin' ? (
        <p className="admin-sub">{t('admin.surfaces.builtinHint')}</p>
      ) : useCode ? (
        <>
          <label className="admin-field">
            <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <span>{
                kind === 'morph'     ? t('admin.surfaces.codeLabelMorph') :
                kind === 'attractor' ? t('admin.surfaces.codeLabelAttractor') :
                kind === 'points'    ? t('admin.surfaces.codeLabelPoints') :
                                       t('admin.surfaces.codeLabel')
              }</span>
              <button
                type="button"
                className="admin-btn admin-btn-ghost"
                style={{ fontSize: '0.75rem', padding: '0.15rem 0.5rem' }}
                onClick={loadStarter}
                title={t('admin.surfaces.loadStarter')}
              >
                ↺ {t('admin.surfaces.loadStarter')}
              </button>
            </span>
            <textarea
              value={form.source_code || ''}
              onChange={(e) => patch({ source_code: e.target.value })}
              style={{
                minHeight: 200,
                fontFamily: "ui-monospace, 'SF Mono', Consolas, monospace",
                fontSize: '0.88rem',
                lineHeight: 1.5,
                whiteSpace: 'pre',
                tabSize: 2
              }}
              spellCheck={false}
            />
          </label>
          <p className="admin-sub">{
            kind === 'morph'     ? t('admin.surfaces.codeHintMorph') :
            kind === 'attractor' ? t('admin.surfaces.codeHintAttractor') :
            kind === 'points'    ? t('admin.surfaces.codeHintPoints') :
                                   t('admin.surfaces.codeHint')
          }</p>
        </>
      ) : (
        <>
          <div className="admin-field-grid">
            <label className="admin-field">
              <span>x(u, v)</span>
              <input type="text" value={form.x_expr || ''} onChange={(e) => patch({ x_expr: e.target.value })} />
            </label>
            <label className="admin-field">
              <span>y(u, v)</span>
              <input type="text" value={form.y_expr || ''} onChange={(e) => patch({ y_expr: e.target.value })} />
            </label>
            <label className="admin-field">
              <span>z(u, v)</span>
              <input type="text" value={form.z_expr || ''} onChange={(e) => patch({ z_expr: e.target.value })} />
            </label>
          </div>
          <p className="admin-sub">{t('admin.surfaces.hint')}</p>
        </>
      )}

      {/* ---------- params_schema + metadata (JSON) ---------- */}
      <label className="admin-field">
        <span>{t('admin.surfaces.paramsSchema')}</span>
        <textarea
          value={form.params_schema_raw}
          onChange={(e) => patch({ params_schema_raw: e.target.value })}
          style={{
            minHeight: 100,
            fontFamily: "ui-monospace, 'SF Mono', Consolas, monospace",
            fontSize: '0.82rem',
            whiteSpace: 'pre',
            tabSize: 2
          }}
          spellCheck={false}
          placeholder='[{"key":"R","label":"R","min":0.6,"max":2,"step":0.05,"default":1.1,"precision":2}]'
        />
      </label>
      <p className="admin-sub">{t('admin.surfaces.paramsSchemaHint')}</p>

      <label className="admin-field">
        <span>{t('admin.surfaces.metadata')}</span>
        <textarea
          value={form.metadata_raw}
          onChange={(e) => patch({ metadata_raw: e.target.value })}
          style={{
            minHeight: 70,
            fontFamily: "ui-monospace, 'SF Mono', Consolas, monospace",
            fontSize: '0.82rem',
            whiteSpace: 'pre',
            tabSize: 2
          }}
          spellCheck={false}
          placeholder='{"uvSegments": 120}'
        />
      </label>
      <p className="admin-sub">{t('admin.surfaces.metadataHint')}</p>

      <SurfacePreview row={previewRow} onSavedDefaults={(saved) => setForm((f) => ({ ...f, view_config: saved.view_config }))} />

      {error && <div className="admin-error">{error}</div>}

      <div className="admin-row-actions">
        <button type="button" className="admin-btn admin-btn-ghost" onClick={onClose} disabled={saving}>{t('admin.cancel')}</button>
        {form.id && <button type="button" className="admin-btn admin-btn-danger" onClick={handleDelete} disabled={saving}>{t('admin.delete')}</button>}
        {form.id && (
          <button
            type="button"
            className={`admin-btn ${form.published ? 'admin-btn-ghost' : 'admin-btn-primary'}`}
            onClick={togglePublish}
            disabled={saving}
            title={form.published ? t('admin.surfaces.unpublishTip') : t('admin.surfaces.publishTip')}
          >
            {form.published ? `● ${t('admin.surfaces.unpublish')}` : `○ ${t('admin.surfaces.publish')}`}
          </button>
        )}
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
              <span className="admin-row-meta">
                {s.category} · #{s.sort_order ?? 100} · {s.published
                  ? <span style={{ color: '#18794e' }}>● {t('admin.surfaces.published')}</span>
                  : <span style={{ color: '#b53620' }}>○ {t('admin.surfaces.draft')}</span>}
              </span>
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
