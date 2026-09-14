// "Newest wins" between approved (database) data and manual overlay edits, on the CLIENT
// merge code (renderer/unico/quality-store.js + store.js) run in a sandbox. No DB, no network.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const read = (f) => fs.readFileSync(path.join(__dirname, '../../renderer/unico', f), 'utf8');

function sandbox(extra) {
  const store = {};
  const win = Object.assign({ addEventListener() {}, removeEventListener() {}, dispatchEvent() {} }, extra);
  const ctx = { window: win, localStorage: { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } }, console, React: { useState: () => [null, () => {}], useEffect() {}, useMemo: (f) => f(), useRef: () => ({}) } };
  ctx.globalThis = ctx; win.localStorage = ctx.localStorage;
  vm.createContext(ctx);
  return { ctx, win, store };
}

/* ---------------- quality: overlay patch vs approved month ---------------- */
{
  const T_OLD = 1000, T_APPROVED = 2000, T_NEW = 3000;
  const seed = [{ key: 'MICU', name: 'MICU', indicators: [
    { id: 'clabsi', name: 'CLABSI', formula: 'rate1000', months: { 'Aug-26': 0, 'Jul-26': 1.5 }, mNum: { 'Aug-26': 0, 'Jul-26': 3 }, mDen: { 'Aug-26': 400 }, mApprovedAt: { 'Aug-26': T_APPROVED } },
    { id: 'nsi', name: 'NSI', formula: 'rate100', months: { 'Aug-26': 2.17 }, mNum: { 'Aug-26': 3 }, mApprovedAt: { 'Aug-26': T_APPROVED } },
  ] }];
  const run = (overlay) => {
    const { ctx, win } = sandbox({ QUALITY_SEED: seed });
    // the overlay lives in localStorage under whatever key quality-store.js reads
    const src = read('quality-store.js');
    const key = (src.match(/['"](unico_quality_v\d+)['"]/) || [])[1];
    assert.ok(key, 'overlay key found in quality-store.js');
    ctx.localStorage.setItem(key, JSON.stringify(overlay));
    vm.runInContext(src, ctx);
    const d = win.qualityData().find((x) => x.key === 'MICU');
    return (id) => d.indicators.find((i) => i.id === id);
  };
  // A legacy (unstamped) clear from before the approval no longer hides the approved 0.
  let get = run({ depts: { MICU: { indPatches: { clabsi: { months: { 'Aug-26': null }, mNum: { 'Aug-26': null } } } } } });
  assert.equal(get('clabsi').months['Aug-26'], 0, 'approved value outranks an older clear');
  assert.equal(get('clabsi').mNum['Aug-26'], 0);
  // An edit made AFTER the approval still wins.
  get = run({ depts: { MICU: { indPatches: { clabsi: { months: { 'Aug-26': 9 }, mNum: { 'Aug-26': 9 }, mEditedAt: { 'Aug-26': T_NEW } } } } } });
  assert.equal(get('clabsi').months['Aug-26'], 9, 'a later manual edit still wins');
  // Months the approval did not touch keep their overlay value.
  get = run({ depts: { MICU: { indPatches: { clabsi: { months: { 'Jul-26': 7 }, mEditedAt: { 'Jul-26': T_OLD } } } } } });
  assert.equal(get('clabsi').months['Jul-26'], 7, 'a month without an approval stamp is untouched');
  // An admin-owned headcount the submission never carried is kept.
  get = run({ depts: { MICU: { indPatches: { nsi: { mDen: { 'Aug-26': 138 }, mEditedAt: { 'Aug-26': T_OLD } } } } } });
  assert.equal(get('nsi').mDen['Aug-26'], 138, 'admin headcount survives a newer approval');
  // patchIndicator stamps the edit time.
  {
    const { ctx, win } = sandbox({ QUALITY_SEED: seed });
    let state = { depts: {} };
    ctx.React.useState = (init) => [typeof init === 'function' ? init() : init, (u) => { state = typeof u === 'function' ? u(state) : u; }];
    vm.runInContext(read('quality-store.js'), ctx);
    const api = win.useQualityStore();
    const before = Date.now();
    api.patchIndicator('MICU', 'clabsi', { months: { 'Aug-26': 5 } });
    assert.ok(state.depts.MICU.indPatches.clabsi.mEditedAt['Aug-26'] >= before, 'console edit is stamped');
  }
}

/* ---------------- statistics: Data Entry overlay vs approved month ---------------- */
{
  const T_OLD = 1000, T_APPROVED = 2000, T_NEW = 3000;
  const { ctx, win } = sandbox();
  win.UNICO = { MONTHS_FULL: {}, MONTH_ORDER: ['Jun-26', 'Jul-26', 'Aug-26'], DEPARTMENTS: [
    { id: 'sicu', name: 'SICU', short: 'SICU', group: 'ICU', primary: 'adm', cols: [{ id: 'adm', label: 'Admissions' }], months: ['Jun-26', 'Jul-26'], data: [{ adm: 6 }, { adm: 8 }], approvedAt: { 'Jun-26': T_APPROVED, 'Jul-26': T_APPROVED } },
  ] };
  vm.runInContext(read('store.js'), ctx);
  const row = (store, m) => { const d = win.buildDepts(store).find((x) => x.id === 'sicu'); const i = d.months.indexOf(m); return i < 0 ? null : d.data[i]; };
  const base = { custom: [], renames: {}, deleted: [], order: [] };
  assert.equal(row({ ...base, entries: [{ dept: 'sicu', month: 'Jun-26', row: { adm: 0 }, ts: T_OLD }] }, 'Jun-26').adm, 6, 'approved value outranks an older typed entry');
  assert.equal(row({ ...base, entries: [{ dept: 'sicu', month: 'Jun-26', row: { adm: 0 }, ts: T_NEW }] }, 'Jun-26').adm, 0, 'a later typed entry still wins');
  assert.ok(row({ ...base, entries: [], removed: { sicu: ['Jul-26'] } }, 'Jul-26'), 'a legacy deletion does not hide a stamped approval');
  assert.equal(row({ ...base, entries: [], removed: { sicu: ['Jul-26'] }, removedAt: { sicu: { 'Jul-26': T_NEW } } }, 'Jul-26'), null, 'a deletion made after the approval still hides it');
}

console.log('Overlay newest-wins regression checks passed.');
