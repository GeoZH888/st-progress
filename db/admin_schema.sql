-- ============================================================
-- Admin RLS for ST-Progress
-- Paste into the Supabase SQL editor AFTER schema.sql + math_schema.sql.
-- Idempotent: safe to re-run.
-- ============================================================
--
-- The site reads are PUBLIC (anon). Writes are gated to a single allow-
-- listed admin email. Update the array in is_admin() if you add more
-- admins. The check runs against the JWT issued by Supabase Auth — no
-- service-role key on the client.
-- ============================================================

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (auth.jwt() ->> 'email') = any(array[
      'superadmin@ci-world.com'
    ]),
    false
  );
$$;

-- ---------- writes on the public milestone content ----------
do $$ begin
  -- stp_milestones
  drop policy if exists "admin insert milestones" on stp_milestones;
  drop policy if exists "admin update milestones" on stp_milestones;
  drop policy if exists "admin delete milestones" on stp_milestones;
  create policy "admin insert milestones" on stp_milestones for insert
    to authenticated with check (is_admin());
  create policy "admin update milestones" on stp_milestones for update
    to authenticated using (is_admin()) with check (is_admin());
  create policy "admin delete milestones" on stp_milestones for delete
    to authenticated using (is_admin());

  -- stp_figures
  drop policy if exists "admin insert figures" on stp_figures;
  drop policy if exists "admin update figures" on stp_figures;
  drop policy if exists "admin delete figures" on stp_figures;
  create policy "admin insert figures" on stp_figures for insert
    to authenticated with check (is_admin());
  create policy "admin update figures" on stp_figures for update
    to authenticated using (is_admin()) with check (is_admin());
  create policy "admin delete figures" on stp_figures for delete
    to authenticated using (is_admin());

  -- stp_locations
  drop policy if exists "admin insert locations" on stp_locations;
  drop policy if exists "admin update locations" on stp_locations;
  drop policy if exists "admin delete locations" on stp_locations;
  create policy "admin insert locations" on stp_locations for insert
    to authenticated with check (is_admin());
  create policy "admin update locations" on stp_locations for update
    to authenticated using (is_admin()) with check (is_admin());
  create policy "admin delete locations" on stp_locations for delete
    to authenticated using (is_admin());

  -- stp_math_docs + stp_math_chunks (RAG cleanup operations)
  drop policy if exists "admin manage math docs"   on stp_math_docs;
  drop policy if exists "admin manage math chunks" on stp_math_chunks;
  create policy "admin manage math docs" on stp_math_docs for all
    to authenticated using (is_admin()) with check (is_admin());
  create policy "admin manage math chunks" on stp_math_chunks for all
    to authenticated using (is_admin()) with check (is_admin());
end $$;

-- ============================================================
-- chunk counts per doc — handy for the RAG admin page
-- ============================================================
create or replace view stp_math_docs_with_counts as
  select
    d.*,
    coalesce(c.cnt, 0) as chunk_count
  from stp_math_docs d
  left join (
    select doc_id, count(*) as cnt
    from stp_math_chunks
    group by doc_id
  ) c on c.doc_id = d.id;

-- Views inherit RLS from underlying tables, so anon can SELECT.
