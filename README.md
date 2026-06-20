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

1. Paste `db/admin_schema.sql` into the Supabase SQL editor (after the other migrations). It creates `is_admin()` and RLS policies on every `stp_*` table.
2. In the Supabase dashboard → Authentication → Users → **Add user**, set email = `superadmin@ci-world.com`, choose a strong password, and tick *Auto Confirm User*.
3. If you change the admin email, edit the allow-list inside `is_admin()` in `db/admin_schema.sql` and re-run the migration.
4. Add `ANTHROPIC_API_KEY` to `.env` and to Netlify env vars (Site settings → Environment variables) — powers Leonardo's translate/draft helpers.

**What's in the panel:**

- Dashboard — row counts per table
- Milestones / Figures / Locations — full trilingual editors with the ✨AI button on each field to translate from one language into the other two
- RAG library — list ingested PDFs, see chunk counts, view individual chunks, delete a doc (cascades to its chunks)

Browser-side PDF upload is intentionally out of scope — Marker needs Python. To add a PDF, drop it into `./pdfs/` locally and run `python scripts/ingest_pdfs.py`.

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
