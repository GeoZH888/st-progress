-- ============================================================
-- Shared 3D-gallery surfaces (curated through /admin/surfaces)
-- Paste into the Supabase SQL editor AFTER admin_grants_schema.sql.
-- Idempotent.
-- ============================================================

create table if not exists stp_surfaces (
  id          uuid primary key default gen_random_uuid(),
  category    text not null,
  name_en     text, name_it text, name_zh text,
  equation    text,
  x_expr      text not null,
  y_expr      text not null,
  z_expr      text not null,
  sort_order  int not null default 100,
  created_by  uuid references auth.users(id) default auth.uid(),
  created_at  timestamptz not null default now(),
  constraint stp_surfaces_category_check
    check (category in ('science_tech', 'economy_industry'))
);

create index if not exists stp_surfaces_sort_idx     on stp_surfaces (sort_order);
create index if not exists stp_surfaces_category_idx on stp_surfaces (category);

-- ---------- RLS: public read; writes gated by can_edit_category() ----------
alter table stp_surfaces enable row level security;

drop policy if exists "public read surfaces"   on stp_surfaces;
drop policy if exists "admin insert surfaces"  on stp_surfaces;
drop policy if exists "admin update surfaces"  on stp_surfaces;
drop policy if exists "admin delete surfaces"  on stp_surfaces;

create policy "public read surfaces" on stp_surfaces
  for select using (true);

create policy "admin insert surfaces" on stp_surfaces
  for insert to authenticated
  with check (can_edit_category(category));

create policy "admin update surfaces" on stp_surfaces
  for update to authenticated
  using (can_edit_category(category))
  with check (can_edit_category(category));

create policy "admin delete surfaces" on stp_surfaces
  for delete to authenticated
  using (can_edit_category(category));
