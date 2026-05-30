# App icons

The PWA manifest (in `vite.config.js`) references three PNG icons that should
live in this folder. Drop the final artwork here when ready:

- `icon-192.png` — 192×192
- `icon-512.png` — 512×512
- `icon-512-maskable.png` — 512×512, with safe-zone padding (`purpose: maskable`)

Until these exist the app still builds and runs; only the installable-PWA icon
falls back to the browser default. A quick way to generate all three from a
single source image is https://maskable.app or any PWA-asset generator.
