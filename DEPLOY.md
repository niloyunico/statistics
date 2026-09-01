# Deploying the UNICO web edition to Vercel

This repo contains both the **Electron desktop app** (root `package.json`,
`main.js`, `renderer/`) and the **Express web edition** (`server/`) that serves
the same `renderer/` in any browser and persists to MongoDB Atlas. Vercel deploys
the **web edition** only.

## 0. What actually ships

Three sets of files, and they are not the same set:

| Set | Contents |
|-----|----------|
| **In git (GitHub)** | All app source + `renderer/dist/app.bundle.js` + `server/seed/**` + `scripts/data/bdmed/` (the CC0 drug dataset the offline importer reads). |
| **Uploaded to Vercel** | Everything in git minus `.vercelignore` (drops `scripts/`, `docs/`, `server/test/`, the Electron shell). |
| **Actually built/served** | Only what `vercel.json` names — see below. |

`vercel.json` builds exactly four things:

1. `server/web.js` → `@vercel/node`. Its `require()` graph is traced and bundled,
   so **every `server/*.js` it requires must be committed** or the function dies at
   import with `Cannot find module`. `includeFiles` adds `renderer/index.html` and
   `server/seed/**`, which are read at runtime and would otherwise be missed.
2. `api/report_pdf.py` → `@vercel/python` (deps from `api/requirements.txt`).
3. `renderer/dist/**`, `renderer/vendor/**`, `renderer/unico/**` → `@vercel/static`,
   served from the CDN edge.

**There is no build step on Vercel.** `scripts/build-renderer.js` never runs there,
so `renderer/dist/app.bundle.js` must be **rebuilt locally and committed** with any
`.jsx` change:

```bat
npm install @babel/standalone --no-save   REM once; it sits under a non-standard "dev" key
npm --prefix server run web               REM rebuilds the bundle, then serves :8080
git add renderer/dist/app.bundle.js renderer/index.html
```

`renderer/index.html` carries the `?v=<hash>` cache-buster, so it must be committed
alongside the bundle or the CDN keeps serving the old one.

> ⚠️ `.gitignore` has a blanket `dist/` rule. It is cancelled by an explicit
> `!renderer/dist/` — do not remove that negation, or `git add .` will silently skip
> the bundle and the live site will serve stale code.

Not deployed, on purpose: `main.js` / `preload.js` / `build/` (the Electron desktop
shell), `scripts/` (one-off DB maintenance and import tools), `docs/`, `server/test/`.

## 1. Push to GitHub
Already wired to `https://github.com/niloyunico/statistics`.

## 2. Import the project into Vercel
- Vercel → **Add New… → Project** → import the GitHub repo.
- **Root Directory:** leave it at the repository root — `vercel.json`, `server/`
  and `renderer/` all live at the top level of this repo. (Do **not** set it to
  `pc apps/unico-n`; that was the old two-folder layout and no longer exists.)
- Framework preset: **Other** (no build step — `vercel.json` does the work).

`vercel.json` builds `server/web.js` with `@vercel/node` (so it installs the
deps from `server/package.json`, not the Electron ones) and routes every request
to it. `web.js` is guarded with `require.main === module`, so on Vercel it
registers all routes and exports the Express app **without** binding a port.

## 3. Environment variables
Vercel → Project → **Settings → Environment Variables → Import .env**, then paste
`server/.env.production` (git-ignored). It sets:

| var | value |
|-----|-------|
| `MONGODB_URI` | Atlas connection string |
| `DB_NAME` | `unico` |
| `JWT_SECRET` | long random secret (login token signing) |
| `TOKEN_TTL` | `12h` |
| `SEED_ADMIN_USER` / `SEED_ADMIN_PASSWORD` | admin login |
| `REQUIRE_AUTH` | `true` (login portal ON) |
| `COOKIE_SECURE` | `true` (Vercel serves HTTPS) |
| `NODE_ENV` | `production` |

## 4. ⚠️ Security — do this BEFORE going live
- **Rotate the MongoDB password.** The current one was shared in chat and must be
  considered compromised. Atlas → Database Access → edit the user → update the
  password, then update `MONGODB_URI` in `server/.env.production` and in Vercel.
- **Change the admin password** (`SEED_ADMIN_PASSWORD`) from `Unico@2026`, then
  re-run the seed (`npm --prefix server run seed`) so the `users` collection
  matches.
- **Allow Vercel's egress in Atlas:** Network Access → add `0.0.0.0/0` (Vercel
  uses dynamic IPs) or Atlas's Vercel integration.
- `server/.env` and `server/.env.production` are git-ignored — never commit real
  secrets.

## 4b. Python PDF report service (`api/report_pdf.py`)
The report **PDF export** is generated server-side by a Python function using
**ReportLab** (`api/report_pdf.py`, deps in `api/requirements.txt`). `vercel.json`
builds it with `@vercel/python` and routes `POST /api/report-pdf` to it *before*
the catch-all. The browser (`renderer/unico/reports.jsx` → `tryServerPDF`) POSTs a
pre-resolved render model and downloads the returned PDF; **any failure silently
falls back** to the in-browser jsPDF vector exporter, so export never breaks.

- Adds a **second runtime** (`@vercel/python`) to the project. After deploy, check
  the build log shows both the Node function and the Python function building, and
  that the function bundle is well under the 250 MB limit (ReportLab ≈ 10–15 MB).
- `regions: ["bom1"]` applies to the Python function too.
- **Local dev (localhost:8080):** `web.js` now includes a **Python bridge** — a
  `POST /api/report-pdf` route (active only when `!process.env.VERCEL`) that spawns
  the same `api/report_pdf.py` script to generate the PDF. This gives the local app
  REAL Python output instead of falling back to the JS exporter. Requirements:
  - Python on PATH (or set `PYTHON_BIN`), with **`pip install reportlab`**
    (`pymongo dnspython` only if you POST Mongo-reading params — the app posts a
    resolved model, so those aren't needed locally).
  - The route streams request JSON to the script's stdin and returns its stdout PDF.
  - Alternatively, run the whole app through `vercel dev` to use the `@vercel/python`
    function exactly as in production.
  If Python isn't installed, the browser's content-type guard still falls back to the
  JS vector export, so local export never hard-breaks.
- Kill-switch: set `window.__UNICO_SERVER_PDF__ = false` (console/inline) to force
  the client-side vector exporter without touching the server.

## 5. Notes
- Pages and APIs (`/`, `/collect`, `/api/*`, `/login`) flow through the Express
  function; `/` injects the live DB snapshot into `index.html` per request.
- Static assets (`/dist`, `/vendor`, `/unico`) are served straight from Vercel's
  CDN edge (`@vercel/static` builds in `vercel.json`) — they never invoke the
  function.
- `"regions": ["bom1"]` pins the function to Mumbai, next to the Atlas cluster.
  If the cluster ever moves regions, update this to the closest Vercel region —
  a cross-continent function↔DB gap adds seconds to every page load.
- The deploy-log line "WARNING! Due to `builds` existing in your configuration
  file, the Build and Development Settings defined in your Project Settings will
  not apply" is EXPECTED and harmless: it just means `vercel.json` (not the
  dashboard UI) controls the build — which is exactly what we want.
- The data already lives in Atlas, so the cold-start auto-seed is intentionally
  skipped on Vercel.
