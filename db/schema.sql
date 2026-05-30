-- ============================================================
-- Milestones of Human Progress — schema (v2: super-categories)
-- Paste this into the Supabase SQL editor and run it once.
-- Safe to re-run; if a v1 DB already exists, the ALTERs upgrade it
-- in place (adds `category`, widens the `field` CHECK).
-- (Then run db/seed.sql for the starter dataset.)
-- ============================================================

-- ---------- locations: where milestones happened (for the map) ----------
create table if not exists stp_locations (
  id uuid primary key default gen_random_uuid(),
  name_zh text, name_it text, name_en text,
  lat double precision,
  lng double precision,
  city text,
  country text
);

-- ---------- figures: scientists, inventors, explorers, reformers… ----------
create table if not exists stp_figures (
  id uuid primary key default gen_random_uuid(),
  name_zh text, name_it text, name_en text,
  bio_zh text,  bio_it text,  bio_en text,
  birth_year int,
  death_year int,
  nationality text,
  portrait_url text,
  created_at timestamptz default now()
);

-- ---------- milestones: the discoveries, inventions, ideas, institutions ----------
create table if not exists stp_milestones (
  id uuid primary key default gen_random_uuid(),
  category text not null default 'science_tech',  -- super-category
  field text not null,                            -- sub-field
  title_zh text, title_it text, title_en text,
  desc_zh text,  desc_it text,  desc_en text,
  year int,                 -- negative for BCE
  era text,                 -- 'Ancient','Renaissance','Industrial','Modern','Digital'
  figure_id uuid references stp_figures(id) on delete set null,
  location_id uuid references stp_locations(id) on delete set null,
  image_url text,
  led_to uuid[] default '{}'  -- related milestone ids ("led to ->")
);

-- ============================================================
-- Migration shims (no-ops on a fresh DB, upgrade v1 DBs in place)
-- ============================================================
alter table stp_milestones add column if not exists category text not null default 'science_tech';

-- Rebuild the field CHECK so it admits the new economy_industry sub-fields.
alter table stp_milestones drop constraint if exists stp_milestones_field_check;
alter table stp_milestones add constraint stp_milestones_field_check
  check (field in (
    'physics','astronomy','medicine','computing','energy',
    'transport','communication','biology_chemistry','space',
    'agriculture','trade','finance','industry','labor'
  ));

-- Category CHECK — extend this list when adding super-categories.
alter table stp_milestones drop constraint if exists stp_milestones_category_check;
alter table stp_milestones add constraint stp_milestones_category_check
  check (category in ('science_tech','economy_industry'));

-- ---------- indexes ----------
create index if not exists stp_milestones_category_idx on stp_milestones (category);
create index if not exists stp_milestones_field_idx    on stp_milestones (field);
create index if not exists stp_milestones_year_idx     on stp_milestones (year);
create index if not exists stp_milestones_era_idx      on stp_milestones (era);
create index if not exists stp_milestones_figure_idx   on stp_milestones (figure_id);
create index if not exists stp_milestones_location_idx on stp_milestones (location_id);

-- ============================================================
-- Row Level Security: public read-only (no auth in v1)
-- ============================================================
alter table stp_locations  enable row level security;
alter table stp_figures    enable row level security;
alter table stp_milestones enable row level security;

drop policy if exists "public read locations"  on stp_locations;
drop policy if exists "public read figures"    on stp_figures;
drop policy if exists "public read milestones" on stp_milestones;

create policy "public read locations"  on stp_locations  for select using (true);
create policy "public read figures"    on stp_figures    for select using (true);
create policy "public read milestones" on stp_milestones for select using (true);
