// The 11 built-in gallery surfaces used to live here as a hard-coded array.
// They are now rows in the stp_surfaces table (slugs: torus-knot, klein,
// mobius, catenoid-helicoid, enneper, saddle, trefoil, lorenz, rossler,
// vogel, modal-sphere) — one source of truth, manageable through
// /admin/surfaces. See db/surfaces_unify_builtins.sql for the seed.
//
// This file is kept for its localizedName / getSurface helpers, which are
// still imported by Gallery.jsx and Home.jsx for shared-row name display.

export const SURFACES = []

export const DEFAULT_SURFACE_ID = 'catenoid-helicoid'

export function getSurface(id) {
  return SURFACES.find((s) => s.id === id)
}

export function localizedName(surface, lang) {
  return surface?.[`name_${lang}`] ?? surface?.name_en ?? ''
}
