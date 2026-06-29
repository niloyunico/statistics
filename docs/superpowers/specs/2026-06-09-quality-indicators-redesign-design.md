# UNICO Quality Indicators — Connected, Editable, Per-Department Redesign

**Date:** 2026-06-09
**Status:** Approved (design) — building in phases

## Problem

The Quality module runs on two disconnected systems:

- **Dashboard + department reports** (`quality.jsx`) read `window.QUALITY_SEED` — rich, already per-department, quarterly data (benchmarks, remarks, executive summaries, sign-off). But it is **read-only seed**.
- **Data entry** (`quality-entry.jsx`) uses a **generic, fixed catalogue of 12 formula indicators** identical for every department, entered monthly into a **separate store** (`unico_qentries_v1`) that **never appears on the dashboard**.

A complete **CAPA** module (`quality-capa.jsx`, route `qualityCapa`) exists but isn't linked in the sidebar and reads breaches only from the read-only seed.

Result: entry isn't per-department, fields are limited, benchmarks aren't settable, and entered data goes nowhere.

## Goals

1. **Per-department indicators** in entry — each department shows *its own* real indicators, not the generic 12.
2. **Add / edit / remove indicators** per department, with **settable benchmark**, goal direction, and value type (Count / %).
3. **Connected:** edits flow into the dashboard, department reports, exports, and the CAPA breach radar.
4. **Both granularities:** quarterly headline + optional monthly drill-down.
5. **Editable executive summary + sign-off**, feeding exports.
6. **Export** (Word/Excel exist; add clean PDF) and **CAPA** surfaced in the Quality nav.
7. **More user-friendly** flow tying dashboard ↔ department ↔ entry ↔ CAPA together.

## Architecture — one editable layer over the seed

New `quality-store.js` providing:

- `window.qualityData()` → returns the **merged** departments array (`QUALITY_SEED ⊕ overrides`), **same shape as `QUALITY_SEED`** so existing readers keep working once pointed at it.
- `useQualityStore()` React hook → merged data + mutators, persisted to `localStorage['unico_quality_v1']` (auto-mirrored to disk by the existing preload bridge).

**Overlay shape** (`unico_quality_v1`):

```
{ depts: { <deptKey>: {
    executive?: { keyAchievements?, majorGaps?, overallStatus?, recommendations? },
    meta?: { preparedBy?, reviewedBy?, approvedBy? },
    indPatches?: { <indId>: { name?, valueType?, benchmark?, benchmarkValue?,
                              goalDirection?, quarters?, quarterRemarks?, remarks?, months? } },
    indAdded?:   [ { id, name, valueType, benchmark, benchmarkValue, goalDirection,
                     quarters, quarterRemarks, remarks, months } ],
    indRemoved?: [ <indId> ],
} } }
```

**Merge** (per department): start from seed indicators → apply `indPatches` by id → drop `indRemoved` → append `indAdded`; overlay `executive`/`meta`. Departments with no override pass through unchanged. A per-department **Reset to original** clears that department's override.

### Quarterly + monthly without drift

- Quarter value is the headline used by dashboard/reports.
- Each indicator-quarter can expand to a **monthly drill-down** (canonical mapping from `QMONTHS`: Q1=Aug–Oct 25, Q2=Nov–Dec 25, Q3=Jan–Mar 26, Q4=Apr–May 26).
- When months are entered for a quarter, the quarter **auto-computes** — **sum** for Count, **average** for % — and the quarter cell is read-only ("from N months"). No months → quarter entered directly. **Only one source of truth is active per quarter at a time.**

## Phases

### Phase 1 — Editable indicators + settable benchmarks (this slice)
- `quality-store.js`: overlay store, `qualityData()` merge, `useQualityStore()`.
- Point `quality.jsx` (QualityModule, QualityDept) and `quality-capa.jsx` (`capaScanBreaches`) at `qualityData()` so edits flow.
- **Configure UI** in QualityDept: add / edit / remove indicators; set name, value type, benchmark text + value, goal direction; per-department **Reset to original**.
- Verify headless: an edited benchmark flips an indicator's status and the dashboard zero-defect rate changes; add/remove indicator reflected; no console errors.

### Phase 2 — Per-department value entry, connected
- Rework `quality-entry.jsx`: pick department → grid of *its* indicators with Q1–Q4 editable cells, live benchmark status, per-quarter remarks, and the expandable monthly drill-down. Saves to the overlay. Retire the generic 12-indicator form (or keep as optional formula helper).

### Phase 3 — CAPA + export + polish
- Sidebar link to CAPA; "Create action plan" from breaches in QualityDept.
- Editable executive summary + sign-off per department feeding exports.
- Export polish: keep Word/Excel, add clean PDF via the existing print/`printToPDF` infrastructure.
- Friendlier cross-navigation.

## Non-goals (for now)
- Adding entirely new quality *departments* (indicator-level editing only).
- Changing the main hospital-statistics module.

## Testing
Each phase ends with a headless Electron verification (pattern: `scripts/verify-*.js`) plus no-console-error checks, consistent with the existing verifiers.
