-- ============================================================
-- Optional source_code column for stp_surfaces
-- Run after surfaces_featured.sql. Idempotent.
-- ============================================================
-- When non-null, the surface is rendered from a multi-line JS body
-- (admin "Code mode") instead of from x_expr / y_expr / z_expr.
-- ============================================================

alter table stp_surfaces
  add column if not exists source_code text;
