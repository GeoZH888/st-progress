-- ============================================================
-- Featured-on-home flag + static/animated display mode
-- Paste into the Supabase SQL editor AFTER surfaces_publish.sql.
-- Idempotent.
-- ============================================================
--
-- Lets the super-admin pick a handful of surfaces to spotlight on the
-- public Home page, and choose whether each one shows as a slowly
-- breathing "static" 3D view or as a fully animated, auto-rotating
-- preview.
-- ============================================================

alter table stp_surfaces
  add column if not exists featured     boolean not null default false,
  add column if not exists display_mode text    not null default 'animated';

alter table stp_surfaces
  drop constraint if exists stp_surfaces_display_mode_check;
alter table stp_surfaces
  add constraint stp_surfaces_display_mode_check
    check (display_mode in ('static', 'animated'));

create index if not exists stp_surfaces_featured_idx
  on stp_surfaces (featured) where featured = true;
