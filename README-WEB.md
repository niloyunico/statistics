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

The whole app state is stored as **one shared document** in the `appdata`
collection (`_id: "shared"`) — a faithful port of the desktop app's single-file
store. The server reads it to hydrate the page and writes it back on every
(debounced) change. Concurrent editors are last-writer-wins, which suits a
single-team statistics tool; per-collection REST APIs can be layered on later if
multi-user merge becomes a requirement.

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
