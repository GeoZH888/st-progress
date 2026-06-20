-- ============================================================
-- Per-category sub-admin grants for ST-Progress
-- Paste into the Supabase SQL editor AFTER admin_schema.sql.
-- Idempotent — safe to re-run.
-- ============================================================
--
-- Model:
--   - is_admin()  → still true only for the email allow-list (super-admin),
--                  can write to *everything*.
--   - Sub-admins  → rows in stp_admin_grants(user_id, category) let them edit
--                  milestones in that category, plus the figures and
--                  locations they themselves created. Shared resources
--                  (other admins' figures/locations, math RAG) stay
--                  super-admin-only.
--
-- To grant a sub-admin manually (until a /admin/users UI exists):
--
--     -- 1. Create the user in Supabase Dashboard → Auth → Users
--     --    (e.g. tech-admin@ci-world.com). Tick Auto Confirm.
--     -- 2. Look up their id:
--     --       select id from auth.users where email = 'tech-admin@ci-world.com';
--     -- 3. Grant categories:
--     --       insert into stp_admin_grants (user_id, category) values
--     --         ('00000000-...', 'science_tech');   -- or 'economy_industry'
-- ============================================================

-- ---------- 0. safety net: ensure is_admin() exists ----------
-- The grants table policies + can_edit_category() depend on is_admin().
-- It's normally created by db/admin_schema.sql, but we (re)create it here
-- so this file can be re-run standalone. Edit the allow-list array if you
-- want a different super-admin email — same value as in admin_schema.sql.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (auth.jwt() ->> 'email') = any(array['superadmin@ci-world.com']),
    false
  );
$$;

-- ---------- 1. grants table ----------
create table if not exists stp_admin_grants (
  user_id    uuid not null references auth.users(id) on delete cascade,
  category   text not null,
  granted_at timestamptz not null default now(),
  primary key (user_id, category),
  constraint stp_admin_grants_category_check
    check (category in ('science_tech', 'economy_industry'))
);

alter table stp_admin_grants enable row level security;

-- Users can read their own grants; super-admin can read everything.
drop policy if exists "grants read self or admin" on stp_admin_grants;
create policy "grants read self or admin" on stp_admin_grants
  for select to authenticated
  using (user_id = auth.uid() or is_admin());

-- Only super-admin can write grants.
drop policy if exists "grants write admin only" on stp_admin_grants;
create policy "grants write admin only" on stp_admin_grants
  for all to authenticated
  using (is_admin()) with check (is_admin());

-- ---------- 2. helpers ----------
create or replace function public.can_edit_category(cat text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select is_admin() or exists(
    select 1 from stp_admin_grants
     where user_id = auth.uid() and category = cat
  );
$$;

-- True if user has any admin role at all (super-admin OR has at least one grant).
create or replace function public.has_any_admin_role()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select is_admin() or exists(
    select 1 from stp_admin_grants where user_id = auth.uid()
  );
$$;

-- ---------- 3. ownership columns for figures + locations ----------
-- created_by auto-fills with the inserting user's id, so RLS can tell whose
-- row it is. Pre-existing rows stay NULL (super-admin still edits anything).
alter table stp_figures   add column if not exists created_by uuid references auth.users(id);
alter table stp_locations add column if not exists created_by uuid references auth.users(id);

alter table stp_figures   alter column created_by set default auth.uid();
alter table stp_locations alter column created_by set default auth.uid();

-- ---------- 4. replace milestone write policies (category-aware) ----------
drop policy if exists "admin insert milestones" on stp_milestones;
drop policy if exists "admin update milestones" on stp_milestones;
drop policy if exists "admin delete milestones" on stp_milestones;

create policy "admin insert milestones" on stp_milestones for insert
  to authenticated
  with check (can_edit_category(category));

create policy "admin update milestones" on stp_milestones for update
  to authenticated
  using (can_edit_category(category))
  with check (can_edit_category(category));

create policy "admin delete milestones" on stp_milestones for delete
  to authenticated
  using (can_edit_category(category));

-- ---------- 5. figures: super-admin all, sub-admins their own ----------
drop policy if exists "admin insert figures" on stp_figures;
drop policy if exists "admin update figures" on stp_figures;
drop policy if exists "admin delete figures" on stp_figures;

-- INSERT: any logged-in admin (super or sub) can add figures. The default on
-- created_by ensures sub-admins automatically own the rows they create.
create policy "admin insert figures" on stp_figures for insert
  to authenticated
  with check (
    has_any_admin_role()
    and (is_admin() or created_by = auth.uid())
  );

-- UPDATE/DELETE: super-admin can edit anything, sub-admin only their own.
create policy "admin update figures" on stp_figures for update
  to authenticated
  using (is_admin() or created_by = auth.uid())
  with check (is_admin() or created_by = auth.uid());

create policy "admin delete figures" on stp_figures for delete
  to authenticated
  using (is_admin() or created_by = auth.uid());

-- ---------- 6. locations: same ownership rules ----------
drop policy if exists "admin insert locations" on stp_locations;
drop policy if exists "admin update locations" on stp_locations;
drop policy if exists "admin delete locations" on stp_locations;

create policy "admin insert locations" on stp_locations for insert
  to authenticated
  with check (
    has_any_admin_role()
    and (is_admin() or created_by = auth.uid())
  );

create policy "admin update locations" on stp_locations for update
  to authenticated
  using (is_admin() or created_by = auth.uid())
  with check (is_admin() or created_by = auth.uid());

create policy "admin delete locations" on stp_locations for delete
  to authenticated
  using (is_admin() or created_by = auth.uid());

-- ---------- 7. math RAG stays super-admin-only ----------
-- (No change needed — admin_schema.sql already gates these on is_admin().)
