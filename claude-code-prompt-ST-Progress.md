# Claude Code Prompt — `ST-Progress`

> Paste everything below the line into Claude Code (in VS Code), opened at
> `C:\Users\Lun_z\Desktop\ST-Progress`. Self-contained brief.

---

## Project

Build **ST-Progress** (working title "Milestones of Human Progress") — a trilingual (中文 / Italiano / English) PWA that tells the story of **science & technology progress across the world**: the great discoveries, inventions, and the people behind them, organized so a curious visitor can browse by era, by field, or on a world map.

This is a sibling project to my `travel-in-italia` app — **use the same stack and the same architecture** so components (flag switcher, mascots, Leaflet map, i18n setup) stay consistent. If it helps, you may copy patterns from that project.

I work on Windows with PowerShell and deploy to Netlify with `netlify deploy --prod`. **Important:** PowerShell here-strings choke on Chinese characters — write any file containing Chinese text directly with the editor tools or via a Python `pathlib`/`shutil` script, never a PowerShell heredoc.

## Tech stack (use exactly this)

- **React 18 + Vite**, **react-router-dom**, **react-i18next**
- **Supabase** (`.env` placeholders `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`)
- **react-leaflet + Leaflet** with free **OpenStreetMap** tiles (no API key)
- **vite-plugin-pwa**
- Deploy: **Netlify**

Everything lives directly under `C:\Users\Lun_z\Desktop\ST-Progress` (don't nest the Vite project in a subfolder).

---

## Core features

### 1. Trilingual (中文 / Italiano / English)
- Header **flag switcher** 🇨🇳 ZH / 🇮🇹 IT / 🇬🇧 EN, default English, persisted to `localStorage`.
- UI strings in `react-i18next` locale files; **content** stored per-language in Supabase columns (`title_zh/title_it/title_en`, `desc_zh/...`, etc.).

### 2. Three ways to explore the same data
1. **Timeline** — a scrollable, filterable chronological view from antiquity to today (group by century/era). This is the hero feature: make it visually strong, with era bands and milestone cards.
2. **By Field** — browse milestones grouped into domains: `physics`, `astronomy`, `medicine`, `computing`, `energy`, `transport`, `communication`, `biology_chemistry`, `space`. Each field has a list + detail pages.
3. **World Map** — Leaflet map plotting *where* each milestone happened, with markers colored by field. Include a **"Near me"** button (geolocation + Haversine) → "Scientific landmarks around you," sorted by distance, with graceful fallback when permission is denied (default center: Florence).

### 3. Milestone detail
Each milestone shows: title, year/era, field, the **inventor(s)/scientist(s)**, a trilingual description of *what it was and why it mattered*, location (city/institution), and links to related milestones (e.g. "led to →").

### 4. Mascot system (shared with sibling app)
- A `<Mascot>` that switches by language: **巧巧 (female)** in ZH mode, **Claudio (male)** in IT/EN.
- Speech bubbles give short trilingual context per page ("Drag the timeline," "Tap Near me to find discoveries around you"), pulled from i18n files.
- Placeholder SVG/PNG avatars for now, structured so I can drop in final art later (comment where).

---

## Suggested Supabase schema (prefix `stp_`)

```sql
stp_figures (
  id uuid pk default gen_random_uuid(),
  name_zh text, name_it text, name_en text,
  bio_zh text, bio_it text, bio_en text,
  birth_year int, death_year int, nationality text,
  portrait_url text
)

stp_milestones (
  id uuid pk default gen_random_uuid(),
  field text check (field in ('physics','astronomy','medicine','computing',
    'energy','transport','communication','biology_chemistry','space')),
  title_zh text, title_it text, title_en text,
  desc_zh text, desc_it text, desc_en text,
  year int,                 -- negative for BCE
  era text,                 -- e.g. 'Ancient','Renaissance','Industrial','Modern','Digital'
  figure_id uuid references stp_figures(id),
  location_id uuid references stp_locations(id),
  image_url text,
  led_to uuid[]             -- related milestone ids
)

stp_locations (
  id uuid pk default gen_random_uuid(),
  name_zh text, name_it text, name_en text,
  lat double precision, lng double precision,
  city text, country text
)
```

Enable RLS with public read (no auth needed for v1).

### Seed data (fill all three languages)
Span eras and the whole world — not just the West. Suggested starter milestones:
- **Ancient:** Archimedes' principle (Syracuse), the Antikythera mechanism (Greece), papermaking 蔡伦 (Han China), gunpowder & compass & movable-type printing 毕昇 (China).
- **Renaissance / Early modern:** Galileo's telescope (Florence), Newton's laws (England), Copernicus heliocentrism (Poland).
- **Industrial:** Watt's steam engine (Scotland), Volta's battery (Italy), Faraday electromagnetism, Darwin evolution.
- **Modern:** Marconi radio (Italy), Curie radioactivity (France/Poland), Einstein relativity, penicillin (Fleming), DNA structure (Watson/Crick/Franklin), Fermi nuclear (Italy/USA).
- **Digital / Space:** Turing & the computer (UK), the transistor (Bell Labs), Apollo 11 Moon landing, the World Wide Web (Berners-Lee, CERN), CRISPR, deep learning.

Make sure Chinese contributions (四大发明 etc.) are well represented.

---

## Build order
1. Scaffold Vite + React + router + i18next; reuse `travel-in-italia` conventions.
2. Supabase client + i18n + flag switcher.
3. Schema SQL file (to paste into Supabase SQL editor) + seed script.
4. **Timeline** view (the centerpiece) → **By Field** views → milestone detail.
5. **World Map** with markers-by-field + "Near me" + Haversine sorting.
6. `<Mascot>` with language switching + trilingual bubbles.
7. `vite-plugin-pwa` (manifest, icons, offline shell).
8. `netlify.toml` with SPA redirect `/* /index.html 200`.

## Working style
- Move in large, complete batches; make sensible defaults and tell me what you assumed rather than asking after every step.
- After scaffolding, give me exact run commands and the SQL to paste.
- Mind the **PowerShell + Chinese characters** caveat for any file with Chinese text.

Start by scaffolding + i18n + flag switcher + the Timeline shell, then check in before building the rest.
