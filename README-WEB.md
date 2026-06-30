# UNICO Statistics Suite — Web (Express) edition

This is the **Express.js** build of the UNICO Statistics Suite. It is the same
application that previously ran as an offline Electron desktop app, converted to
run as ordinary **PC software**: a small local web server you start on your
machine and open in any browser. All data lives in your **MongoDB Atlas**
database (cluster `unicostatics`, database `unico`) instead of a local file, so
every PC that points at the same database sees the same data.

---

## Run it

Double-click **`start-web.bat`** (in this folder).

It installs dependencies on the first run, starts the server, and opens
<http://localhost:8080> in your browser. Keep the console window open while you
use the app; close it (or press `Ctrl+C`) to stop the server.

Manual equivalent:

```bat
npm --prefix server install      REM first time only
npm --prefix server run web
```

Then browse to <http://localhost:8080>.

> The live MongoDB connection string lives only in `server/.env` (git-ignored).
> It never reaches the browser.

---

## How the conversion works

The Electron shell did three native things; each now has a browser equivalent,
so **none of the renderer (the React UI) had to be rewritten**:

| Electron desktop                                   | Web edition                                                            |
| -------------------------------------------------- | ---------------------------------------------------------------------- |
| Serve UI over a custom `app://` protocol           | `server/web.js` serves `renderer/` over HTTP                           |
| Load state from a local JSON file (`db:loadSync`)  | Server injects `window.__UNICO_SNAPSHOT__` (read from MongoDB) into the page |
| Mirror every change to that file (`db:persist`)    | `unico/web-native.js` mirrors every change via `PUT /api/data` → MongoDB |
| Export PDF via Chromium `printToPDF` + save dialog | `window.print()` → "Save as PDF" (same `@media print` layout)          |
| Back up / restore via OS file dialogs              | Browser file download / file-picker upload                             |

`renderer/unico/web-native.js` is a drop-in stand-in for the Electron
`window.unicoNative` bridge. If the app is ever opened inside the real desktop
shell, the shim detects the native bridge and steps aside.

### Modules included (full suite)

Dashboard · Department detail · Data input / quick entry · Manage departments ·
Staff & staff profiles · Quality suite (entry, edit, scorecard, trends, catalog,
CAPA, indicators) · Reports & PDF export · Charts (2D / 3D / gallery) ·
Cross-department comparison · Global search · Feedback. Every module persists
through the same MongoDB-backed sync.

---

## Data model

MongoDB collections in the `unico` database. The three datasets that used to be
hardcoded in the renderer now live in the database — the server injects each into
the page (synchronously, before the app scripts run) and also exposes a read API:

| Collection    | Was hardcoded in            | Injected as                  | Read API            |
| ------------- | --------------------------- | ---------------------------- | ------------------- |
| `departments` | `unico/data.js` (monthly stats) | `window.__UNICO_DEPARTMENTS__` | `GET /api/departments` |
| `staff`       | `unico/staff-seed.js` (nurse/PCA) | `window.__UNICO_STAFF__`       | `GET /api/staff`       |
| `quality`     | `unico/quality-data.js` (indicators) | `window.__UNICO_QUALITY__`   | `GET /api/quality`     |

Re-seed / refresh from the JSON snapshots in `server/seed/` with:
```bat
npm --prefix server run seed-departments            REM departments (insert if empty)
npm --prefix server run seed-departments -- --force REM departments (overwrite)
npm --prefix server run seed-data                   REM staff + quality (insert if empty)
npm --prefix server run seed-data -- staff --force  REM one dataset, overwrite
```
On first boot against an empty database the server auto-seeds all three.

Plus:

- **`appdata`** — one shared document (`_id: "shared"`) holding the rest of the
  app state (user edits/overrides, staff, quality entries, CAPA, custom columns,
  settings) as a mirror of the browser's `localStorage`. The server injects it as
  `window.__UNICO_SNAPSHOT__` and the web bridge writes it back via `PUT /api/data`
  on every (debounced) change. `PUT /api/data` accepts only a flat string→string
  map (the localStorage shape) and is capped to guard the shared doc.

Concurrent editors are last-writer-wins, which suits a single-team statistics
tool. Editing a department's monthly numbers in the app currently records an
override in `appdata` (also in the DB); a future enhancement can write those
edits straight back to the `departments` collection.

> Note: because the departments, staff, and quality data now come from the
> database, the app must be opened **through this server** (it no longer ships
> built-in records). Opening the renderer files outside the server yields empty
> lists by design. The staff config (departments/designations/qualifications used
> by the add-staff forms) and the synthetic-staff fallback generator remain in
> `staff-data.js` — those are logic, not the real records, which now live in the DB.

---

## Optional: require sign-in

By default the app runs in **open local mode** (`REQUIRE_AUTH=false` in
`server/.env`) — no login wall, ideal for a single trusted PC.

To require a username/password before data can be read or written:

1. In `server/.env`, set `REQUIRE_AUTH=true`.
2. Seed an admin account in MongoDB:
   ```bat
   npm --prefix server run seed
   ```
   (uses `SEED_ADMIN_USER` / `SEED_ADMIN_PASSWORD` from `.env` — default
   `admin` / `Unico@2026`).
3. Restart the server.

---

## Security notes

- **Rotate the database password.** The current `MONGODB_URI` password was
  shared in chat — treat it as compromised. In Atlas → *Database Access*, rotate
  it (or create a user scoped to `readWrite` on the `unico` db only) and update
  the `MONGODB_URI` line in `server/.env`.
- In Atlas → *Network Access*, only the IPs you allow can connect. Add the PCs
  that will run this app.
- `server/.env` is git-ignored. Never commit it.
- Open local mode leaves `/api/data` unauthenticated; only run it on a trusted
  machine/network, or switch on `REQUIRE_AUTH`.

---

## Ports

`WEB_PORT` in `server/.env` controls the web port (default `8080`). Change it if
something else is using that port.
