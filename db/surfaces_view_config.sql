-- ============================================================
-- Per-surface view defaults
-- Run after surfaces_source.sql. Idempotent.
-- ============================================================
-- Stores the palette/background/motion/speed/render mode the admin
-- wants visitors to see for THIS surface on the public /gallery.
-- If NULL/empty, /gallery falls back to its global defaults.
--
-- Shape (JSON):
--   { "palette": "viridis", "background": "renaissance",
--     "motion":  0.35,      "speed":      1.0,
--     "mode":    "solid" }
-- ============================================================

alter table stp_surfaces
  add column if not exists view_config jsonb;
