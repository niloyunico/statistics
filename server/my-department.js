/* My Department — one department's figures, approved duty roster and basic staff list,
 * read-only, for the departments an administrator picked for the person
 * (users.myDepartments, module 'mydept'). Printing is a separate grant ('mydept' print)
 * and every printout is written to the activity log BEFORE the page prints.
 *
 * This route never reaches the page snapshot: a person holding only this module receives
 * nothing about the department until they open the screen, and then only through here.
 * The staff list is deliberately thinner than the in-charge's (access.MYDEPT_STAFF_FIELDS):
 * no contact, licence, health or HR detail, and nothing from Performance.
 */
const access = require('./access');
const deptmap = require('./deptmap');
const activity = require('./activity-log');
const { getDbHandle, getDepartments, getAppData } = require('./db');

const MONS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const SECTIONS = ['patient', 'quality', 'roster', 'staff'];
const filled = (v) => v !== null && v !== '' && v !== undefined;
const parse = (v) => { if (typeof v !== 'string') return v; try { return JSON.parse(v); } catch (e) { return null; } };
const yearMonths = (year) => MONS.map((m) => m + '-' + String(year % 100).padStart(2, '0'));

async function overlays() {
  try {
    const snap = await getAppData();
    const d = (snap && snap.data) || {};
    return { store: parse(d.unico_store_v3) || {}, quality: parse(d.unico_quality_v2) || {} };
  } catch (e) { return { store: {}, quality: {} }; }
}

/* The department's statistics as the administrator's screen shows them (store.js buildDepts):
   the database rows, months deleted in the overlay dropped unless approved again after, and
   Data Entry rows merged on top — field by field, a value approved after the entry wins. */
function patientRows(dept, store, months) {
  const out = {};
  const removed = ((store.removed || {})[dept.id]) || [];
  const removedAt = ((store.removedAt || {})[dept.id]) || {};
  const approvedAt = dept.approvedAt || {};
  (dept.months || []).forEach((m, i) => {
    if (months.indexOf(m) < 0) return;
    if (removed.indexOf(m) >= 0 && !(Number(approvedAt[m]) > (Number(removedAt[m]) || 0))) return;
    out[m] = Object.assign({}, (dept.data || [])[i] || {});
  });
  (Array.isArray(store.entries) ? store.entries : []).forEach((e) => {
    if (!e || String(e.dept) !== String(dept.id) || months.indexOf(e.month) < 0) return;
    const row = e.row || {};
    if (!Object.keys(row).some((k) => filled(row[k]))) return;
    const newer = Number(approvedAt[e.month]) > (Number(e.ts) || 0);
    const cur = out[e.month] || {};
    Object.keys(row).forEach((k) => { if (filled(row[k]) && !(newer && Object.prototype.hasOwnProperty.call(cur, k))) cur[k] = row[k]; });
    out[e.month] = cur;
  });
  return out;
}

/* One indicator's month readings, the console's way (quality-store.js withoutSuperseded):
   an overlay cell wins unless an approval newer than it put a value in the database. */
const Q_MAPS = ['months', 'mNum', 'mDen', 'mNotObserved', 'monthRemarks'];
// The month maps `maps` of one indicator over `months`, database first, overlay layers on top
// (also used by server/kpi-link.js, with the hand-hygiene maps added).
function mergeLayers(base, layers, months, maps) {
  const b = base || {};
  const appr = b.mApprovedAt || {};
  const pick = {};
  (maps || Q_MAPS).forEach((k) => { pick[k] = {}; months.forEach((m) => { if (b[k] && filled(b[k][m])) pick[k][m] = b[k][m]; }); });
  (layers || []).filter(Boolean).forEach((l) => {
    const edited = l.mEditedAt || {};
    (maps || Q_MAPS).forEach((k) => months.forEach((m) => {
      if (!l[k] || !Object.prototype.hasOwnProperty.call(l[k], m)) return;
      if (Number(appr[m]) > (Number(edited[m]) || 0) && b[k] && Object.prototype.hasOwnProperty.call(b[k], m)) return;
      if (filled(l[k][m])) pick[k][m] = l[k][m]; else delete pick[k][m];
    }));
  });
  return pick;
}
function qualityIndicator(base, layers, months) {
  const b = base || {};
  const pick = mergeLayers(b, layers, months, Q_MAPS);
  const src = Object.assign({}, b, layers.filter(Boolean).reduce((a, l) => Object.assign(a, l), {}));
  return {
    id: b.id || src.id, name: src.name || b.name || src.id, formula: src.formula || null, unit: src.unit || '',
    benchmark: src.benchmark || '', benchmarkValue: filled(src.benchmarkValue) ? Number(src.benchmarkValue) : null,
    goalDirection: src.goalDirection || 'lower_is_better',
    months: pick.months, num: pick.mNum, den: pick.mDen, notObserved: pick.mNotObserved, remarks: pick.monthRemarks,
  };
}

async function qualityFor(map, deptId, qov, months) {
  const key = map && map.byId[deptId] && map.byId[deptId].qualityKey;
  if (!key) return null;
  const db = await getDbHandle().catch(() => null);
  const doc = db ? await db.collection('departments').findOne({ 'quality.key': String(key) }) : null;
  const area = (doc && doc.quality) || { key, name: key, indicators: [] };
  const ov = ((qov && qov.depts) || {})[key] || {};
  const removed = new Set((ov.indRemoved || []).map(String));
  const patches = ov.indPatches || {};
  const added = Array.isArray(ov.indAdded) ? ov.indAdded : [];
  const inds = [];
  const seen = new Set();
  (area.indicators || []).forEach((i) => {
    if (!i || removed.has(String(i.id))) return;
    seen.add(String(i.id));
    inds.push(qualityIndicator(i, [added.find((a) => a && String(a.id) === String(i.id)), patches[i.id]], months));
  });
  added.forEach((a) => {
    if (!a || seen.has(String(a.id)) || removed.has(String(a.id))) return;
    inds.push(qualityIndicator(a, [patches[a.id]], months));
  });
  return { key, name: area.name || key, indicators: inds };
}

// The APPROVED sheet only — a draft or a sheet awaiting sign-off is never shown here.
async function rosterFor(deptId, year, month) {
  const db = await getDbHandle().catch(() => null);
  if (!db) return null;
  const keys = await access.scopedDeptNames({ departments: [deptId] }, { departmentsOnly: true });
  const docs = await db.collection(require('./duty-roster').COLL).find({ year, month, status: 'approved' }).toArray();
  const hit = docs.find((d) => access.rosterVisible(keys, d.dept));
  if (!hit) return null;
  return { dept: hit.dept, deptName: hit.deptName || hit.dept, year: hit.year, month: hit.month, grid: hit.grid || {}, order: hit.order || [], names: hit.names || {},
    preparedBy: hit.preparedBy || '', checkedBy: hit.checkedBy || '', approvedBy: hit.approvedBy || '' };
}

async function staffFor(map, deptId) {
  const roster = await require('./staff-roster').loadRoster({ cached: true });
  const keys = [deptId];
  const nm = map && map.byId[deptId] && map.byId[deptId].name;
  if (nm) keys.push(nm);
  return access.portalStaff(keys, roster, access.MYDEPT_STAFF_FIELDS)
    .sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
}

async function deptList(a) {
  const ids = access.myDeptIds(a);
  const [map, depts] = await Promise.all([deptmap.get().catch(() => null), getDepartments().catch(() => [])]);
  const byId = Object.assign({}, ...(depts || []).filter((d) => d && d.id).map((d) => ({ [d.id]: { id: d.id, name: d.name } })), (map && map.byId) || {});
  const list = ids === null ? Object.values(byId) : ids.map((id) => byId[id] || { id, name: id });
  return list.map((d) => ({ id: d.id, name: d.name || d.id })).sort((x, y) => String(x.name).localeCompare(String(y.name)));
}

function mount(app, opts) {
  const guard = (opts && opts.requireApi) || [];
  const resolve = async (req, res, action) => {
    const a = req.access || await access.forRequest(req);
    if (!a) { res.status(401).json({ ok: false, error: 'Not authenticated.' }); return null; }
    req.access = a;
    if (!access.can(a, 'mydept', action)) {
      res.status(403).json({ ok: false, error: action === 'print' ? 'You do not have permission to print My Department.' : 'You do not have access to My Department.' });
      return null;
    }
    return a;
  };
  const inScope = (a, deptId) => { const ids = access.myDeptIds(a); return ids === null || ids.indexOf(String(deptId)) >= 0; };

  app.get('/api/my-department', guard, async (req, res) => {
    res.set('Cache-Control', 'no-store');
    try {
      const a = await resolve(req, res, 'view'); if (!a) return;
      res.json({ ok: true, departments: await deptList(a), canPrint: access.can(a, 'mydept', 'print') });
    } catch (e) { res.status(500).json({ ok: false, error: 'Could not load your departments.' }); }
  });

  app.get('/api/my-department/:dept', guard, async (req, res) => {
    res.set('Cache-Control', 'no-store');
    try {
      const a = await resolve(req, res, 'view'); if (!a) return;
      const deptId = String(req.params.dept || '');
      if (!inScope(a, deptId)) return res.status(403).json({ ok: false, error: 'This department is not one of yours.' });
      const now = new Date();
      const year = Math.min(Math.max(parseInt(req.query.year, 10) || now.getFullYear(), 2015), 2100);
      const month = Math.min(Math.max(parseInt(req.query.month, 10), 0), 11);
      const rMonth = Number.isFinite(month) ? month : now.getMonth();
      const months = yearMonths(year);
      const [map, ov, depts] = await Promise.all([deptmap.get().catch(() => null), overlays(), getDepartments().catch(() => [])]);
      let dept = (depts || []).find((d) => String(d.id) === deptId) || null;
      if (!dept) {
        const cd = (Array.isArray(ov.store.custom) ? ov.store.custom : []).find((d) => d && String(d.id) === deptId);
        if (cd) dept = Object.assign({ months: [], data: [], cols: [] }, cd, { id: deptId });
      }
      const info = (map && map.byId[deptId]) || null;
      if (!dept && !info) return res.status(404).json({ ok: false, error: 'Unknown department.' });
      const rn = ((ov.store.renames || {})[deptId]) || {};
      const name = rn.name || (info && info.name) || (dept && dept.name) || deptId;
      const cols = ((rn.cols || (dept && dept.cols)) || []).filter((c) => c && c.id && !c.hidden).map((c) => ({ id: c.id, label: c.label || c.id, pct: !!c.pct }));
      const [quality, roster, staff] = await Promise.all([
        qualityFor(map, deptId, ov.quality, months),
        rosterFor(deptId, year, rMonth),
        staffFor(map, deptId),
      ]);
      res.json({
        ok: true, dept: { id: deptId, name }, year, month: rMonth,
        patient: dept && !(info && info.qualityOnly) ? { cols, months, rows: patientRows(dept, ov.store, months) } : null,
        quality, roster, staff,
        canPrint: access.can(a, 'mydept', 'print'),
      });
    } catch (e) { res.status(500).json({ ok: false, error: 'Could not load the department.' }); }
  });

  // Printing takes the record out of the system: it needs its own grant, and it is logged
  // before the page is allowed to print.
  app.post('/api/my-department/print', guard, async (req, res) => {
    try {
      const a = await resolve(req, res, 'print'); if (!a) return;
      const b = (req.body && typeof req.body === 'object') ? req.body : {};
      const deptId = String(b.dept || '');
      if (!deptId || !inScope(a, deptId)) return res.status(403).json({ ok: false, error: 'This department is not one of yours.' });
      const sections = Array.isArray(b.sections) ? SECTIONS.filter((s) => b.sections.indexOf(s) >= 0) : [];
      if (!sections.length) return res.status(400).json({ ok: false, error: 'Choose what to print.' });
      const year = parseInt(b.year, 10) || '';
      const rm = parseInt(b.month, 10);
      activity.log(req, 'mydept_print', { target: deptId, detail: sections.join(', ') + ' · ' + year + (Number.isFinite(rm) && sections.indexOf('roster') >= 0 ? ' · roster ' + (MONS[rm] || '') : '') });
      res.json({ ok: true });
    } catch (e) { res.status(500).json({ ok: false, error: 'Could not record the print.' }); }
  });
}

module.exports = { mount, patientRows, qualityIndicator, mergeLayers, overlays, SECTIONS, Q_MAPS };
