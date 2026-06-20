# Milestones of Human Progress

A trilingual (中文 / Italiano / English) PWA about the discoveries, inventions and institutions that have moved humanity forward — explored by **Timeline**, **By Field**, or **World Map**.

Grouped into super-categories:
- 🔬 **Science & Technology** — physics, astronomy, medicine, computing, energy, transport, communication, biology & chemistry, space
- 💰 **Economy & Industry** — agriculture, trade, finance, industry, labor

## Stack

React 18 + Vite · react-router-dom · react-i18next · Supabase · react-leaflet (OpenStreetMap tiles) · vite-plugin-pwa · deployed to Netlify.

Sibling project to [`travel-in-italia`](https://github.com/GeoZH888/travel-in-italia) — shares the same component architecture (header, flag switcher, mascot, milestone card).

## Run locally

```powershell
npm install
Copy-Item .env.example .env   # then fill in your Supabase values
npm run dev
```

## Database

Paste in the Supabase SQL editor, in order:

1. `db/schema.sql` — creates the three `stp_*` tables (idempotent; safe to re-run).
2. `db/seed.sql` — loads the trilingual starter dataset (37 milestones, 29 figures, 37 locations).

## Deploy

`netlify deploy --build --prod` — `netlify.toml` already configures the SPA redirect. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` as Netlify environment variables.

## Adding a new super-category

1. Extend `CATEGORIES` in `src/lib/categories.js`.
2. Add the new sub-fields to `FIELDS` in `src/lib/fields.js` (with `category:` set).
3. Widen the two CHECK constraints in `db/schema.sql` (`stp_milestones_field_check`, `stp_milestones_category_check`).
4. Add the `categories.<key>` and new `fields.<key>` strings to all three locale files in `src/i18n/locales/`.
5. Append milestone INSERTs to `db/seed.sql` with the explicit `category` column.

## Admin panel

Hidden at `/admin` — Supabase Auth (email + password) protects the route, and Postgres RLS policies allow writes only for an allow-listed admin email (see `db/admin_schema.sql`).

**One-time setup:**

1. Paste `db/admin_schema.sql` into the Supabase SQL editor (after the other migrations). It creates `is_admin()` and RLS policies on every `stp_*` table. Then (optionally) paste `db/admin_grants_schema.sql` if you want per-category sub-admins.
2. Create the admin user. Either:
   - **From the dashboard** — Authentication → Users → **Add user**, email = `superadmin@ci-world.com`, choose a strong password, tick *Auto Confirm User*; **or**
   - **From the CLI** — make sure `SUPABASE_SERVICE_ROLE_KEY` is in `.env`, then run `python scripts/create_admin_user.py`. The script creates the user (or resets the password if it already exists) and auto-confirms the email so login works immediately. Edit the constants at the top of the file to change the email/password.
3. If you change the admin email, edit the allow-list inside `is_admin()` in `db/admin_schema.sql` and re-run the migration.
4. Add `ANTHROPIC_API_KEY` to `.env` and to Netlify env vars (Site settings → Environment variables) — powers Leonardo's translate/draft helpers.

**What's in the panel:**

- Dashboard — row counts per table
- Milestones / Figures / Locations — full trilingual editors with the ✨AI button on each field to translate from one language into the other two
- RAG library — list ingested PDFs, see chunk counts, view individual chunks, delete a doc (cascades to its chunks)

Two ways to ingest a PDF, both writing to the same `stp_math_chunks` table so search works identically:

- **From the browser**, in the RAG admin tab. PDF.js renders each page to an image, Claude Sonnet 4.6 vision extracts Markdown (with LaTeX), then chunks are embedded via Voyage. Needs `ANTHROPIC_API_KEY`, `VOYAGE_API_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` to be set in **Netlify** env (not just `.env`).
- **From the CLI**, for bulk runs or local-only PDFs. Drop the file into `./pdfs/` and run `python scripts/ingest_pdfs.py` (uses Marker locally — heavier, more accurate on dense math, no per-page API cost).

### Sub-admins (per super-category)

`db/admin_grants_schema.sql` adds a `stp_admin_grants(user_id, category)` table plus a `can_edit_category()` SQL helper. The super-admin email in `is_admin()` keeps full access; sub-admins can edit milestones inside their granted category (`science_tech` or `economy_industry`) and edit/delete the figures + locations they themselves create (`created_by = auth.uid()`). Math RAG stays super-admin-only.

To grant a sub-admin (no UI yet — SQL only):

```sql
-- 1. Create the user in Supabase Dashboard → Auth → Users (tick Auto Confirm).
-- 2. Look up their id:
select id from auth.users where email = 'tech-admin@ci-world.com';

-- 3. Grant one or both categories:
insert into stp_admin_grants (user_id, category) values
  ('00000000-...', 'science_tech');
```

## Mascot art

`Leonardo` is the single AI-assistant mascot across all three UI languages — a Renaissance polymath fits the site's "history of human progress" theme. The avatar is an inline placeholder SVG in `src/components/Mascot.jsx`. Drop final artwork into `public/mascots/leonardo.png` and swap the `<LeonardoAvatar />` call per the comment in that file.

## Math RAG

Ask questions about equations, theorems and methods from your own PDFs. Pipeline: **Marker** (PDF → Markdown+LaTeX) → chunk → **Voyage `voyage-3`** embeddings → **Supabase pgvector**. Search runs through a Netlify function so the Voyage key never ships to the browser. Results render with **KaTeX** at `/math`.

**1. Apply the schema** — paste `db/math_schema.sql` into the Supabase SQL editor (after `db/schema.sql`). It enables `pgvector`, creates `stp_math_docs` + `stp_math_chunks`, and defines the `match_math_chunks` RPC.

**2. Set the extra env vars** in `.env`:

```
SUPABASE_SERVICE_ROLE_KEY=…   # Supabase → Project settings → API → service_role (NEVER ship)
VOYAGE_API_KEY=…              # voyageai.com
```

Also add `VOYAGE_API_KEY` to your Netlify site env (Site settings → Environment variables) so the search function works in production.

**3. Install Python deps + ingest PDFs:**

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r scripts/requirements.txt

# drop your .pdf files into ./pdfs/, then:
python scripts/ingest_pdfs.py
```

Re-running is idempotent — a PDF with the same filename has its old chunks wiped before fresh ones are inserted.

**4. Run locally with the function attached:**

```powershell
npm install
netlify dev      # serves Vite + functions together at one port
```

Plain `npm run dev` skips the Netlify functions emulator, so the `/math` page will return an error.

**5. Deploy:** `netlify deploy --build --prod` — the function is bundled automatically from `netlify/functions/`.
