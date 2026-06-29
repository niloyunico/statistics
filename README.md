# UNICO Statistics Suite — Desktop App (v2.0.0)

Offline Windows desktop application (Electron) for UNICO Healthcare: hospital
statistics, data entry, nurse & PCA management, quality indicators, charts, and
reports. Runs fully offline — no internet, no server, no install required.

## Deliverable

**`dist/UNICO Statistics Suite 2.0.0.exe`** — a single portable executable.
Double-click to run, or copy it to any Windows PC / USB stick. Data is stored
locally on the PC (an on-disk database in the app's user-data folder).

> First launch may show a Windows SmartScreen prompt (unsigned app) →
> **More info → Run anyway**. This is expected and safe.

## Features

**Hospital Statistics**
- Dashboard with 3 layouts (Executive / Operational / Analytics) and a top-bar
  **reporting-period** filter (latest / last 3·6 / Q1 / custom).
- Department detail with a **breadcrumb department switcher**, KPI stats, a
  range control, and many chart styles (see Charts), plus a **Quick Entry**
  button and CSV **Export**.
- **Data Entry** — Quick Form / Grid / Wizard. **Lifetime months** (2024–2045)
  with a "New month" picker for any month/year; defaults to the next un-entered
  month. The Grid lets you **edit and delete existing months** inline, and an
  **Undo** reverts the last change. **Custom fields** can be added/removed per
  department and flow straight into the statistics.
- **Manage Departments** — add / rename / delete, custom metric columns.

**Charts**
- Bar · 3D · Line · **Area + target** · **Bar + Line combo (dual-axis)** ·
  Grouped · Stacked · **100% stacked** · Horizontal · Donut.
- Per-department **Charts Gallery** ("All Charts") showing every style at once,
  with **per-chart PNG download** and **Export-all-to-PDF**.

**Reports**
- Pick **multiple chart styles** (each renders per department), report type
  (Summary / Detailed / Comparison), reporting period, and page setup
  (**A4 / A3 / Letter · portrait / landscape**).
- **Header/Footer editor** — title, subtitle, hospital name, footer note,
  logo + Confidential toggles.
- **Export to PDF** (charts render solid, footer pinned to the page bottom) and
  **Print**. The top-bar Print button prints the current page.

**Quality Indicators** (real data imported from `unico-kpi`: 14 departments, 86
indicators — each department with its own indicator set, some shared)
- **Dashboard** (KPI cards, breaches-by-quarter, compliance mix, heatmap)
- **Scorecard** (hospital-wide RAG ranking + export)
- **Trends** (per-indicator trend vs benchmark + cross-department comparison)
- **Catalog** (formula, numerator/denominator, benchmark, goal direction)
- **Monthly Entry** (single / bulk / coverage + edit/delete) and per-dept edit
- **Action Plans (CAPA)** for breached indicators

**Workforce** — Nurse + PCA management (real roster) with directory, profiles,
compliance, add/edit, deactivate and permanent delete, and export.

**Platform** — on-disk database with **Backup / Restore** to a file, global
**search (Ctrl+K)**, **department comparison**, **app lock (PIN)**, and user
management.

## Run from source (development)

```powershell
npm install        # first time only
npm start          # opens the desktop window
```

> If `npm start` opens a console instead of the app, this machine has
> `ELECTRON_RUN_AS_NODE=1` set. Clear it first:
> `Remove-Item Env:ELECTRON_RUN_AS_NODE` then `npm start`.
> (The build and the test scripts below self-heal this automatically.)

## Build the portable .exe

```powershell
npm run build      # -> dist/UNICO Statistics Suite <version>.exe
```

## Verify

```powershell
npm run smoke      # headless: app mounts, fonts/data/localStorage, 0 errors
npm run verify     # launches the BUILT exe and checks it renders from asar
```

## Update the Quality data

Re-import the latest per-department KPI from `C:\xampp\htdocs\unico-kpi`:

```powershell
node scripts/import-quality.js   # regenerates renderer/unico/quality-data.js
```

## Project layout

```
main.js              Electron main: window, app:// file server, on-disk DB IPC, PDF export
preload.js           Secure bridge (DB get/persist/backup/restore, PDF export)
renderer/
  index.html         App entry (vendored libs + the unico/ UI)
  unico/             UI + real seeded data (charts, charts-extra, charts-gallery,
                     dashboard, department, input, reports, quality*, staff*, etc.)
  vendor/            React, ReactDOM, Babel, IBM Plex fonts (all offline)
build/icon.ico       App / exe icon
scripts/             vendor.js, make-icon.js, import-quality.js, smoke.js, verify-packaged.js
```

## Notes
- Data persists in the app's local database (`unico-database.json` in userData),
  shown under Settings → Data. Use **Backup** before big changes; **Undo** reverts
  the last data edit.
- Keyboard: **Ctrl+K** search · **F11** fullscreen · **Ctrl +/-/0** zoom · **Ctrl+R** reload.
