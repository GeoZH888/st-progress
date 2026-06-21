-- ============================================================
-- Surfaces publish workflow
-- Paste into the Supabase SQL editor AFTER surfaces_schema.sql.
-- Idempotent.
-- ============================================================
--
-- Adds a `published` flag to stp_surfaces. Anonymous visitors only
-- see published rows on /gallery; admins (super-admin or sub-admin
-- with a grant for the row's category) see everything they can edit.
-- ============================================================

alter table stp_surfaces
  add column if not exists published boolean not null default false;

create index if not exists stp_surfaces_published_idx
  on stp_surfaces (published);

-- Replace the public-read policy with one that enforces the gate.
drop policy if exists "public read surfaces"  on stp_surfaces;
drop policy if exists "read published or admin" on stp_surfaces;

create policy "read published or admin" on stp_surfaces
  for select
  using (
    published = true
    or is_admin()
    or exists (
      select 1 from stp_admin_grants
      where user_id = auth.uid() and category = stp_surfaces.category
    )
  );

-- Mark the pre-seeded math-art surfaces as published so they keep
-- showing up after the gate goes live. (Comment out if you'd rather
-- review them yourself first.)
update stp_surfaces
   set published = true
 where name_en in (
   'Roman surface (Steiner)',
   'Möbius bracelet (5 twists)',
   'Rippled sphere',
   'Catalan surface',
   'Beltrami pseudosphere'
 );
