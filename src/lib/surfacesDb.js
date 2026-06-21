// Shared, site-wide gallery surfaces stored in Supabase (stp_surfaces table).
// Anyone visiting /gallery sees these on top of the built-ins; admins manage
// them at /admin/surfaces. Compiled into renderable parametric surfaces using
// the same whitelisted Math scope as the per-browser localStorage customs.

import { supabase } from './supabase'
import { compileExpr, compileSource } from './customSurfaces'

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

/**
 * Compile a stp_surfaces row into a render-ready surface object compatible
 * with SurfaceViewer (kind: 'parametric'). Throws on compile errors so the
 * caller can skip broken entries instead of crashing the gallery.
 */
export function sharedRowToSurface(row) {
  // Code mode wins when source_code is non-empty; otherwise fall back to
  // the three single-line expressions.
  const useSource = typeof row.source_code === 'string' && row.source_code.trim().length > 0

  let sampler
  if (useSource) {
    const fn = compileSource(row.source_code)
    sampler = (u, v, target) => {
      const r = fn(u * PI2, v * PI2)
      const [x, y, z] = r
      target.set(
        Number.isFinite(x) ? x : 0,
        Number.isFinite(z) ? z : 0,
        Number.isFinite(y) ? y : 0
      )
    }
  } else {
    const xFn = compileExpr(row.x_expr)
    const yFn = compileExpr(row.y_expr)
    const zFn = compileExpr(row.z_expr)
    sampler = (u, v, target) => {
      const U = u * PI2
      const V = v * PI2
      target.set(
        Number.isFinite(xFn(U, V)) ? xFn(U, V) : 0,
        Number.isFinite(zFn(U, V)) ? zFn(U, V) : 0,
        Number.isFinite(yFn(U, V)) ? yFn(U, V) : 0
      )
    }
  }

  return {
    id: `shared-${row.id}`,
    name_en: row.name_en || row.name_zh || row.name_it || '(untitled)',
    name_it: row.name_it || row.name_en || row.name_zh || '(senza nome)',
    name_zh: row.name_zh || row.name_en || row.name_it || '（未命名）',
    equation: row.equation || '',
    kind: 'parametric',
    uvSegments: 80,
    isShared: true,
    sharedId: row.id,
    sharedCategory: row.category,
    // Per-surface view defaults the admin saved (palette / background /
    // motion / speed / mode). Gallery merges with its global fallbacks.
    viewConfig: row.view_config || null,
    sampler
  }
}
