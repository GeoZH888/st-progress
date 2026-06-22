// Shared, site-wide gallery surfaces stored in Supabase (stp_surfaces table).
// Anyone visiting /gallery sees these on top of the built-ins; admins manage
// them at /admin/surfaces. Compiled into renderable parametric / morph /
// attractor / points / builtin surfaces using the same whitelisted Math
// scope as the per-browser localStorage customs.

import { supabase } from './supabase'
import {
  compileExpr,
  compileSource,
  compileMorphSource,
  compileAttractorSource,
  compilePointsSource
} from './customSurfaces'

const PI2 = Math.PI * 2

export async function fetchSharedSurfaces() {
  const { data, error } = await supabase
    .from('stp_surfaces')
    .select('*')
    .order('sort_order', { ascending: true })
  if (error) throw error
  return data || []
}

// Only the rows the super-admin has marked as featured (and that are
// also published — anon RLS would filter drafts anyway, but be explicit).
export async function fetchFeaturedSurfaces(limit = 4) {
  const { data, error } = await supabase
    .from('stp_surfaces')
    .select('*')
    .eq('featured', true)
    .eq('published', true)
    .order('sort_order', { ascending: true })
    .limit(limit)
  if (error) throw error
  return data || []
}

export async function upsertSharedSurface(row) {
  const isUpdate = Boolean(row.id)
  const q = isUpdate
    ? supabase.from('stp_surfaces').update(row).eq('id', row.id).select().single()
    : supabase.from('stp_surfaces').insert(row).select().single()
  const { data, error } = await q
  if (error) throw error
  return data
}

export async function deleteSharedSurface(id) {
  const { error } = await supabase.from('stp_surfaces').delete().eq('id', id)
  if (error) throw error
}

// Geometry builders for kind='builtin'. Adding a new one means adding a
// builtin_kind value to the DB row + a builder here — that's it.
const BUILTIN_BUILDERS = {
  torusKnot: (THREE, p = {}) => {
    const pp = p.p != null ? p.p : 3
    const qq = p.q != null ? p.q : 2
    const R = p.R != null ? p.R : 1.1
    const r = p.r != null ? p.r : 0.34
    return new THREE.TorusKnotGeometry(R, r, 240, 32, pp, qq)
  }
}

function safeNum(v, fallback) {
  return Number.isFinite(v) ? v : fallback
}

/**
 * Compile a stp_surfaces row into a render-ready surface object compatible
 * with SurfaceViewer. Dispatches on row.kind. Throws on compile errors so the
 * caller can skip broken entries instead of crashing the gallery.
 */
export function sharedRowToSurface(row) {
  const slug = row.slug || null
  const params = Array.isArray(row.params_schema) ? row.params_schema : []
  const meta = (row.metadata && typeof row.metadata === 'object') ? row.metadata : {}
  const base = {
    // Slug-keyed rows get a stable id ('klein', 'lorenz') so Phase 3 of the
    // unify rollout can dedupe against the hard-coded SURFACES list. User-
    // created rows fall back to the uuid-prefixed form.
    id: slug ? slug : `shared-${row.id}`,
    name_en: row.name_en || row.name_zh || row.name_it || '(untitled)',
    name_it: row.name_it || row.name_en || row.name_zh || '(senza nome)',
    name_zh: row.name_zh || row.name_en || row.name_it || '（未命名）',
    equation: row.equation || '',
    params,
    isShared: true,
    sharedId: row.id,
    sharedSlug: slug,
    sharedCategory: row.category,
    viewConfig: row.view_config || null
  }

  const kind = row.kind || 'parametric'

  if (kind === 'builtin') {
    const builder = BUILTIN_BUILDERS[row.builtin_kind]
    if (!builder) throw new Error(`Unknown builtin_kind: ${row.builtin_kind}`)
    return { ...base, kind: 'builtin', build: builder }
  }

  if (kind === 'morph') {
    if (!row.source_code) throw new Error('Morph kind requires source_code')
    const fn = compileMorphSource(row.source_code)
    // Note the y/z swap on output — bodies are written in math (z-up)
    // convention so they read naturally; three.js wants y-up.
    const sampler = (u, v, time, target, p) => {
      const [x, y, z] = fn(u * PI2, v * PI2, time, p || {})
      target.set(safeNum(x, 0), safeNum(z, 0), safeNum(y, 0))
    }
    return {
      ...base,
      kind: 'morph',
      uvSegments: meta.uvSegments || 130,
      sampler
    }
  }

  if (kind === 'attractor') {
    if (!row.source_code) throw new Error('Attractor kind requires source_code')
    const deriv = compileAttractorSource(row.source_code)
    const points = row.point_count || 7000
    const dt  = meta.dt  != null ? meta.dt  : 0.01
    const x0  = meta.x0  != null ? meta.x0  : 0.1
    const y0  = meta.y0  != null ? meta.y0  : 0
    const z0  = meta.z0  != null ? meta.z0  : 0
    const integrate = (n, p = {}) => {
      const out = new Float32Array(n * 3)
      let x = x0, y = y0, z = z0
      for (let i = 0; i < n; i++) {
        const [dx, dy, dz] = deriv(x, y, z, p)
        x += dx * dt
        y += dy * dt
        z += dz * dt
        // Same upright-butterfly swap the original Lorenz integrator did:
        // y goes to scene Z (depth), z goes to scene Y (height).
        out[i * 3]     = x
        out[i * 3 + 1] = z
        out[i * 3 + 2] = y
      }
      return out
    }
    return { ...base, kind: 'attractor', points, integrate }
  }

  if (kind === 'points') {
    if (!row.source_code) throw new Error('Points kind requires source_code')
    const place = compilePointsSource(row.source_code)
    const pointCount = row.point_count || 2000
    const pointSize = meta.pointSize != null ? meta.pointSize : 0.06
    const animated  = meta.animated  != null ? meta.animated  : true
    const generate = (n, p = {}) => {
      const total = (p && p.pointCount != null) ? p.pointCount : n
      const out = new Float32Array(total * 3)
      for (let i = 0; i < total; i++) {
        const [x, y, z] = place(i, total, p || {})
        out[i * 3]     = safeNum(x, 0)
        out[i * 3 + 1] = safeNum(y, 0)
        out[i * 3 + 2] = safeNum(z, 0)
      }
      return out
    }
    return { ...base, kind: 'points', pointCount, pointSize, animated, generate }
  }

  // ---------- parametric (default) ----------
  // Code mode wins when source_code is non-empty; otherwise fall back to
  // the three single-line expressions (legacy x_expr/y_expr/z_expr).
  const useSource = typeof row.source_code === 'string' && row.source_code.trim().length > 0

  let sampler
  if (useSource) {
    const fn = compileSource(row.source_code)
    sampler = (u, v, target, p) => {
      const [x, y, z] = fn(u * PI2, v * PI2, p || {})
      target.set(safeNum(x, 0), safeNum(z, 0), safeNum(y, 0))
    }
  } else {
    const xFn = compileExpr(row.x_expr)
    const yFn = compileExpr(row.y_expr)
    const zFn = compileExpr(row.z_expr)
    sampler = (u, v, target) => {
      const U = u * PI2
      const V = v * PI2
      target.set(
        safeNum(xFn(U, V), 0),
        safeNum(zFn(U, V), 0),
        safeNum(yFn(U, V), 0)
      )
    }
  }

  return {
    ...base,
    kind: 'parametric',
    uvSegments: meta.uvSegments || 80,
    sampler
  }
}
