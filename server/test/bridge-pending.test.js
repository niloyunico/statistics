// Page bridge (renderer/index.html) + web-native.js, run for real in a VM:
//  1. another tab hydrating/purging localStorage must not erase this tab's UNSAVED edit, and
//     saving must resume by itself (30 s retry) after the in-request retries give up;
//  2. the idle-tab overlay refresh (GET /api/data) applies only known, non-dirty keys that moved
//     on the server, and announces them with 'unico:overlay-merged'.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const read = (name) => fs.readFileSync(path.join(__dirname, '../../renderer', name), 'utf8');
const KEY = 'unico_store_v3';
const settle = async () => { for (let i = 0; i < 40; i++) await new Promise((r) => setTimeout(r, 1)); };

function page(snapshot) {
  const html = read('index.html'), at = html.indexOf('var n = window.unicoNative');
  const bridge = html.slice(html.lastIndexOf('<script>', at) + 8, html.indexOf('</script>', at));
  class Storage { constructor() { this.m = new Map(); } getItem(k) { return this.m.has(k) ? this.m.get(k) : null; } setItem(k, v) { this.m.set(k, String(v)); }
    removeItem(k) { this.m.delete(k); } clear() { this.m.clear(); } key(i) { return [...this.m.keys()][i] ?? null; } get length() { return this.m.size; } }
  const listeners = {}, events = [], puts = [];
  const RETRY = {};
  const t = { retry: null, online: false, server: Object.assign({}, snapshot), getData: null };
  const ctx = {
    console, setImmediate,
    // the 30 s retry is captured so the test can fire it; every other delay (debounce, backoff) runs at once
    setTimeout: (fn, ms) => { if (ms === 30000) { t.retry = fn; return RETRY; } return setTimeout(fn, 0); },
    clearTimeout: (id) => { if (id === RETRY) t.retry = null; else clearTimeout(id); },
    document: { visibilityState: 'visible', addEventListener() {}, body: { appendChild() {} }, createElement: () => ({ style: {}, setAttribute() {} }) },
    addEventListener: (name, fn) => { listeners[name] = fn; }, removeEventListener() {},
    dispatchEvent: (e) => { events.push(e); },
    CustomEvent: class { constructor(type, init) { this.type = type; this.detail = init && init.detail; } },
    __UNICO_SNAPSHOT__: Object.assign({}, snapshot), __UNICO_SNAPSHOT_AUTHORITATIVE__: true,
    fetch: async (url, opts = {}) => {
      if (opts.method === 'PUT') {
        const body = JSON.parse(opts.body); puts.push(body);
        if (!t.online) throw new Error('Failed to fetch');
        Object.assign(t.server, body.data); (body.removed || []).forEach((k) => delete t.server[k]);
        return { ok: true, status: 200, json: async () => ({ ok: true }) };
      }
      return { ok: true, status: 200, json: async () => ({ ok: true, data: t.getData ? t.getData() : t.server }) };
    },
  };
  ctx.window = ctx; ctx.localStorage = new Storage();
  vm.createContext(ctx);
  vm.runInContext(read('unico/web-native.js'), ctx);
  vm.runInContext(bridge, ctx);
  return { ctx, t, listeners, events, puts, ls: ctx.localStorage };
}

async function otherTabCannotEraseUnsavedEdit() {
  const p = page({ [KEY]: 'S0' });
  p.ls.setItem(KEY, 'A1');                       // this tab's edit — the database is unreachable
  await settle();
  assert.equal(p.puts.length, 4, 'one save + three quiet retries');
  assert.ok(p.t.retry, 'saving resumes automatically after the retries give up');

  // Tab B opens: hydration puts the server copy back into the SHARED localStorage.
  p.ls.m.set(KEY, 'S0');
  p.listeners.storage({ key: KEY, newValue: 'S0', storageArea: p.ls });
  assert.equal(p.ls.getItem(KEY), 'A1', "this tab's unsaved value is put back");

  // Even when the storage event is missed (clobbered again), a save sends the unconfirmed value.
  p.ls.m.set(KEY, 'S0');
  p.t.online = true;
  const r = await p.ctx.unicoFlushNow();
  assert.equal(r.ok, true);
  const last = p.puts[p.puts.length - 1];
  assert.equal(last.data[KEY], 'A1', 'the edit is saved, not dropped as "unchanged"');
  assert.equal(last.bases[KEY], 'S0', 'with the baseline, so the server merges');
  assert.equal(p.t.server[KEY], 'A1');
  await settle();
  assert.equal(p.t.retry, null, 'retry timer stops once everything is saved');

  // Confirmed: a later hydration by another tab is no longer fought.
  p.ls.m.set(KEY, 'S9');
  p.listeners.storage({ key: KEY, newValue: 'S9', storageArea: p.ls });
  assert.equal(p.ls.getItem(KEY), 'S9');
}

async function retryTimerSavesWithoutAnotherEdit() {
  const p = page({ [KEY]: 'S0' });
  p.ls.setItem(KEY, 'A1');
  await settle();
  assert.ok(p.t.retry);
  p.t.online = true;
  const fire = p.t.retry; p.t.retry = null; fire();
  await settle();
  assert.equal(p.t.server[KEY], 'A1', 'the 30 s retry saved the edit on its own');
  assert.equal(p.t.retry, null);
}

async function idleTabOverlayRefresh() {
  const p = page({ [KEY]: 'S0', unico_quality_v2: 'Q0', unico_capa_v1: 'C0' });
  p.t.online = true;
  // Another session saved Data Entry cells + a quality patch; an unknown key also appeared.
  p.t.getData = () => ({ [KEY]: 'S1', unico_quality_v2: 'Q1', unico_capa_v1: 'C0', unico_brand_new: 'N', unico_staff_v3: '[]' });
  p.ls.setItem('unico_quality_v2', 'Q-local');  // …while this tab has its own unsaved quality edit
  p.t.online = false;
  await settle();
  // Array.from: arrays made inside the VM have another realm's prototype, which deepEqual rejects.
  const keys = Array.from(await p.ctx.unicoRefreshAppData());
  assert.deepEqual(keys, [KEY], 'only the known, non-dirty key that moved is applied');
  assert.equal(p.ls.getItem(KEY), 'S1');
  assert.equal(p.ls.getItem('unico_quality_v2'), 'Q-local', 'an unsaved local edit is never replaced');
  assert.equal(p.ls.getItem('unico_brand_new'), null, 'keys the session did not receive at load are left out');
  assert.equal(p.ls.getItem('unico_staff_v3'), null, 'the staff register keeps its own refresh');
  const ev = p.events.filter((e) => e.type === 'unico:overlay-merged').pop();
  assert.deepEqual(Array.from(ev.detail.keys), [KEY]);
  // The applied value is now the baseline: saving the quality edit does not resend the stats key.
  p.t.online = true;
  await p.ctx.unicoFlushNow();
  const last = p.puts[p.puts.length - 1];
  assert.deepEqual(Object.keys(last.data), ['unico_quality_v2']);
  // A perms grant pulls newly allowed keys too.
  p.t.getData = () => ({ [KEY]: 'S1', unico_quality_v2: 'Q-local', unico_capa_v1: 'C0', unico_brand_new: 'N' });
  assert.deepEqual(Array.from(await p.ctx.unicoRefreshAppData({ includeNew: true })), ['unico_brand_new']);
}

(async () => {
  await otherTabCannotEraseUnsavedEdit();
  await retryTimerSavesWithoutAnotherEdit();
  await idleTabOverlayRefresh();
  console.log('BRIDGE_PENDING_TEST_PASS: unsaved edits survive other tabs, automatic retry, idle-tab overlay refresh');
})().catch((e) => { console.error(e); process.exitCode = 1; });
