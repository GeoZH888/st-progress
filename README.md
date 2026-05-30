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

## Mascot art

`巧巧` (ZH) / `Claudio` (IT · EN) currently use inline placeholder SVGs in `src/components/Mascot.jsx`. Drop final artwork into `public/mascots/` and swap the `<*Avatar />` calls per the comment in that file.
