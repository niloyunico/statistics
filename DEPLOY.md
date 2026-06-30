# Deploying the UNICO web edition to Vercel

This repo contains both the **Electron desktop app** (root `package.json`,
`main.js`, `renderer/`) and the **Express web edition** (`server/`) that serves
the same `renderer/` in any browser and persists to MongoDB Atlas. Vercel deploys
the **web edition** only.

## 1. Push to GitHub
Already wired to `https://github.com/niloyunico/statistics`.

## 2. Import the project into Vercel
- Vercel → **Add New… → Project** → import the GitHub repo.
- **Root Directory:** `pc apps/unico-n` (the folder that contains `vercel.json`,
  `server/`, and `renderer/`).
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

## 5. Notes
- All requests (page, assets, `/api/*`, `/login`) flow through the single Express
  function; `/` injects the live DB snapshot into `index.html` per request.
- The data already lives in Atlas, so the cold-start auto-seed is intentionally
  skipped on Vercel.
