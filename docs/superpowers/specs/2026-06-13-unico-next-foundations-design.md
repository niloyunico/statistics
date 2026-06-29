# UNICO Next.js — Sub-project 1: Foundations (design)

**Date:** 2026-06-13
**Status:** Approved architecture; this spec covers Foundations only.
**Parent goal:** Full 1:1 port of the UNICO Statistics Suite (Electron) to a
cloud-hosted **Next.js + MongoDB** web app — a live dashboard that also keeps
records.

## Context

The existing app (`c:\xampp\htdocs\unico-n`) is an offline Electron app: ~30
React `.jsx` screens compiled in-browser via Babel, hand-rolled SVG charts, and
three localStorage-backed stores (statistics, quality, workforce) each built as
"read-only seed + editable overlay". A small Express server already syncs the
whole app-state as one shared MongoDB document.

**Confirmed decisions for the port:**
- Host: **Vercel**; database: **MongoDB Atlas**.
- Data model: **proper normalized collections** (not one shared blob).
- Auth: **username/password + roles** (Admin / Editor / Viewer), bcrypt + JWT.
- UI: **port to real Next.js components in TypeScript + Tailwind**, reusing the
  existing SVG charts and screen logic.
- Seed: **import all existing real seed data** (16 departments, 86 quality
  indicators, 56 staff) into Atlas.
- Build is **decomposed into 5 sub-projects**; this spec is **#1 Foundations**.
  The other four (Statistics, Quality, Workforce, Reports & platform) each get
  their own spec → plan → implementation cycle later.

## Scope of Foundations (sub-project 1)

Foundations delivers the runnable skeleton every other module builds on. **No
business screens** (dashboards, entry forms) are built here beyond a minimal
authenticated home page that proves the stack works end-to-end.

In scope:
1. **Project scaffold** — new `unico-next/` Next.js 15 (App Router) + TypeScript
   + Tailwind project, configured for Vercel and Atlas.
2. **Database layer** (`lib/db/`) — typed MongoDB driver connection (Vercel-safe
   singleton), collection accessors, and index setup.
3. **Auth** (`lib/auth/`, middleware, login route + page) — bcrypt password
   verify, JWT in an httpOnly cookie, role-based route protection, login/logout.
4. **Seed scripts** (`seed/`) — idempotent import of departments, quality
   indicators, staff, and a first admin user from the existing data files.
5. **App shell** — root layout, navigation (sidebar/top-bar), theme (port
   `theme.css` into Tailwind tokens), and a minimal authenticated dashboard
   placeholder that reads a seeded count from Mongo to prove the wiring.
6. **Domain logic skeleton** (`lib/domain/`) — port the pure functions that
   later modules depend on: stats `recompute` (total/latest/delta/peak/avg) and
   quality quarter/month `rollup` + formula compute. Unit-tested here.
7. **Audit log** primitive — `auditLog` collection + a `writeAudit()` helper used
   by every future write ("keep record").

Out of scope (later sub-projects): all statistics/quality/workforce/reports
screens, charts gallery, PDF export, CAPA, user-management UI.

## Architecture

```
unico-next/
  app/
    (auth)/login/page.tsx          login screen (client form -> /api/auth/login)
    (app)/layout.tsx               authenticated shell (nav + theme); guards via middleware
    (app)/page.tsx                 placeholder dashboard: reads seeded counts (Server Component)
    api/
      auth/login/route.ts          POST {username,password} -> set cookie
      auth/logout/route.ts         POST -> clear cookie
      auth/me/route.ts             GET  -> current user from cookie
      health/route.ts              GET  -> { ok, db }
  lib/
    db/
      client.ts                    Mongo singleton (HMR-safe, Vercel-safe)
      collections.ts               typed accessors: users(), departments(), statEntries(), ...
      indexes.ts                   ensure indexes (idempotent)
    auth/
      password.ts                  bcrypt hash/verify
      token.ts                     JWT sign/verify (jose, edge-compatible)
      session.ts                   read/require session from cookie; role helpers
    domain/
      stats.ts                     recompute(series), period filters
      quality.ts                   rollupQuarter, qiFormulaCompute, isPct, computeQuarters
    types.ts                       shared TS types for all collections
  components/
    ui/                            buttons, cards, inputs (Tailwind)
    nav/                           Sidebar, TopBar
  seed/
    data/                         copied/transpiled seed sources (departments, quality, staff)
    seed.ts                        idempotent upsert importer + first admin
  middleware.ts                    protect (app) routes; redirect to /login if no valid cookie
  .env.example                    MONGODB_URI, DB_NAME, JWT_SECRET, SEED_ADMIN_*
```

### Database layer
- Use the official `mongodb` driver. A **module-level cached client** keyed on a
  global to survive Next.js HMR and Vercel lambda reuse (standard Next+Mongo
  pattern). `serverSelectionTimeoutMS: 8000`. Carry over the Atlas SRV/DNS
  workaround (`dns.setServers(['8.8.8.8','1.1.1.1'])`) for resilience.
- `collections.ts` exposes typed `Collection<T>` accessors for: `users`,
  `departments`, `statEntries`, `qualityDepts`, `qualityIndicators`, `capa`,
  `staff`, `auditLog`.
- `indexes.ts` ensures: `users.username` unique; `statEntries` unique on
  `{deptKey, month}`; `qualityIndicators` unique on `{deptKey, indId}`;
  `staff.emp_id` unique; `departments.key` unique. Run from `seed.ts` and a
  one-shot `ensureIndexes()` callable on cold start.

### Auth
- `password.ts`: `hash()` / `verify()` via `bcryptjs` (ports server/auth.js).
- `token.ts`: sign/verify JWT with **`jose`** (Web-Crypto, works in Edge
  middleware) — claims `{ sub, name, role }`, TTL 12h, `JWT_SECRET` from env.
- Login flow: `POST /api/auth/login` → verify against `users` → on success set an
  **httpOnly, Secure, SameSite=Lax** cookie `unico_session` with the JWT →
  return `{ ok, user }`. Logout clears the cookie.
- `middleware.ts` runs on `(app)/*`: verify cookie; no/invalid → redirect
  `/login`. Role gating: a `requireRole()` helper used by API routes (e.g. writes
  need `editor`+, user mgmt needs `admin`). Roles: `admin` > `editor` > `viewer`.
- `session.ts`: `getSession()` (nullable) and `requireSession()` for Server
  Components / route handlers.

### Roles
| Role | Can |
|---|---|
| `viewer` | read all dashboards/records |
| `editor` | viewer + create/update/delete stat/quality/staff records |
| `admin` | editor + manage users, view audit log, edit department/indicator definitions |

### Seed
- `seed/data/` holds the three seed sources converted to plain TS/JSON modules
  (exported arrays), transcribed from the existing `data.js`, `quality-data.js`
  (`window.QUALITY_SEED`), and `staff-seed.js`/`staff-data.js`.
- `seed.ts` (run via `npm run seed`, also usable as a Vercel one-off):
  - Upserts **departments** (16) by `key`.
  - Explodes each department's `months[]`+`data[]` into **statEntries** docs
    (one per `{deptKey, month}`), upsert by the unique key — re-running is safe.
  - Upserts **qualityDepts** (14) and **qualityIndicators** (86) by `{deptKey,indId}`.
  - Upserts **staff** (56) by `emp_id`.
  - Creates the first **admin** user from `SEED_ADMIN_USER/PASSWORD` (bcrypt),
    only if absent.
  - Ensures indexes first. Idempotent: safe to run repeatedly.

### Domain logic (ported, unit-tested)
- `stats.recompute(series, primary)` → `{ total, latest, prev, delta, peak, avg }`
  (ports the math in `data.js`/`store.js`).
- `quality`: `isPct`, `qiFormulaCompute(formula,num,den)`,
  `rollupQuarter(ind,q)`, and `computeQuarters(ind)` — the
  quarter-from-months/num-den aggregation from `quality-store.js`, as pure
  functions. (The overlay-*merge* logic from `quality-store.js` belongs to the
  Quality sub-project, not Foundations; only the pure compute pieces port here.)
- These have **no DB or React dependency** so they unit-test in isolation and are
  reused by later modules' API routes and components.

### Audit log
- `writeAudit({ userId, action, collection, docId, before?, after? })` inserts
  into `auditLog` with a server timestamp. Foundations provides the helper and
  collection; later write routes call it. The login route writes a `login` audit
  entry to exercise it.

## Data flow (proven by the placeholder)
1. User hits `/` → middleware checks cookie → if none, redirect `/login`.
2. Login posts creds → API verifies → sets cookie → redirects to `/`.
3. `(app)/page.tsx` is a Server Component: calls `lib/db` to count
   `departments`, `staff`, `qualityIndicators` and renders them in cards →
   proves DB read + auth + layout all work end-to-end.

## Error handling
- API routes return typed `{ ok: false, error }` with correct status (400 bad
  input, 401 unauthenticated, 403 wrong role, 500 server). Inputs validated with
  **zod**.
- DB connection failure surfaces on `/api/health` as `{ ok:false, db:'error' }`;
  the login page shows a friendly "database unreachable" message.
- Missing env (`MONGODB_URI`/`JWT_SECRET`) fails fast with a clear server log.

## Testing
- **Unit** (Vitest): `stats.recompute`, `quality` rollup/formula, `password`
  hash/verify, `token` sign/verify round-trip — pure, no DB.
- **Integration**: `seed.ts` against a disposable test DB (mongodb-memory-server
  or a test Atlas db) → asserts counts (16 depts, 86 indicators, 56 staff, 1
  admin) and idempotency (running twice yields same counts).
- **Smoke**: `next build` succeeds; a script boots the app, logs in with the seed
  admin, and confirms `/` renders the seeded counts with zero console errors.

## Deliverables (Definition of Done for Foundations)
- `unico-next/` builds (`next build`) and runs (`next dev`) with no errors.
- `npm run seed` populates Atlas with the real seed data + admin (idempotent).
- Logging in with the seed admin reaches `/`, which shows live counts from Mongo;
  logging out and hitting `/` redirects to `/login`.
- A non-admin/no cookie cannot reach `(app)` routes.
- Unit + integration tests pass; smoke check is green.
- `.env.example` documents every required variable; README explains local run +
  Vercel/Atlas deploy.

## Risks / decisions
- **Edge vs Node for JWT:** middleware runs on Edge, so token verify uses `jose`
  (not `jsonwebtoken`). bcrypt stays in Node-only route handlers.
- **Vercel + Mongo connection reuse:** cached global client to avoid exhausting
  Atlas connections across lambda invocations.
- **statEntries cardinality:** ~hundreds of docs now, fine; unique `{deptKey,
  month}` index keeps upserts clean and enables per-record history via auditLog.
- **Test DB:** prefer `mongodb-memory-server` for CI isolation; fall back to a
  dedicated Atlas `unico_test` db if the in-memory binary is unavailable on the
  dev machine.

## Next sub-projects (not built here)
2. Statistics · 3. Quality Indicators · 4. Workforce · 5. Reports & platform —
each consumes this Foundation (db layer, auth, domain fns, seed, shell).
