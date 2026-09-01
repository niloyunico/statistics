/* Admin DATABASE BROWSER + ROW EDITOR for the Cloudflare D1 tables, behind
 * Settings → Database. The terminal equivalent is `node d1-rows.js` (read-only).
 *
 * NO CALLER SQL IS EVER EXECUTED. The browser sends a table name, column names
 * and values; this module builds every statement itself. The table name is
 * matched against the tables that actually exist (sqlite_master) and each column
 * against PRAGMA table_info, so neither can carry an injection — every value is
 * a bound parameter.
 *
 * EDITING IS A LAST RESORT, and is deliberately narrow:
 *   - one row at a time, addressed by its primary key (a table without one is
 *     read-only here — there would be no safe way to say which row to change);
 *   - the primary key itself can never be edited (it would orphan the row from
 *     whatever references it);
 *   - a JSON document column must still parse as JSON after the edit, so a
 *     supervisor report cannot be corrupted into something the app cannot read;
 *   - every change and deletion is written to the activity log, with the old
 *     value, so an accidental edit can be traced and undone by hand.
 * Normal corrections belong in the module that owns the data (Supervisor Reports,
 * Users & Roles) — this panel is for fixing what those screens cannot reach.
 *
 * Administrator only, on top of the normal API guard.
 */
const d1 = require('./d1');
const d1store = require('./d1-store');
const activity = require('./activity-log');

const MAX_LIMIT = 200;
// SQLite's own bookkeeping tables are noise in an admin panel — and _cf_KV is
// Cloudflare's internal store: D1 refuses to even SELECT it ("not authorized:
// SQLITE_AUTH"). It sorts first alphabetically, so listing it made the panel
// open straight onto that error.
const HIDDEN = /^(sqlite_|_cf_)/i;

async function listTables() {
  const rows = await d1.query("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name");
  return rows.map((r) => r.name).filter((n) => !HIDDEN.test(n));
}

async function columnsOf(table) {
  // PRAGMA cannot take a bound parameter; `table` is safe here because it has
  // already been matched against the real table list by the caller.
  const info = await d1.query('PRAGMA table_info("' + table + '")');
  return info.map((c) => ({ name: c.name, type: String(c.type || '').toUpperCase() }));
}

// Escape the LIKE wildcards so a user typing "%" searches for a literal "%".
const likeTerm = (q) => '%' + String(q).replace(/[\\%_]/g, (c) => '\\' + c) + '%';

// The single-column primary key of a table, or '' when it has none / a composite
// one — in which case the table cannot be edited from here.
async function primaryKeyOf(table) {
  const info = await d1.query('PRAGMA table_info("' + table + '")');
  const keys = info.filter((c) => Number(c.pk) > 0);
  return keys.length === 1 ? keys[0].name : '';
}

// A column that currently holds a JSON object/array must still hold one after an
// edit, or the owning module will fail to read the row back.
function jsonColumnsOf(row) {
  const out = [];
  for (const [k, v] of Object.entries(row || {})) {
    if (typeof v !== 'string' || v.length < 2) continue;
    const c = v[0];
    if (c !== '{' && c !== '[') continue;
    try { JSON.parse(v); out.push(k); } catch (e) { /* not JSON */ }
  }
  return out;
}

const short = (v) => { const t = v == null ? '' : String(v); return t.length > 120 ? t.slice(0, 119) + '…' : t; };

function mount(app, opts) {
  const requireApi = (opts && opts.requireApi) || ((req, res, next) => { req.user = null; next(); });
  const adminOnly = (req, res, next) => {
    // Prefer the RESOLVED authority (req.access, read from the live user document by
    // server/access.js) over req.user.role, which is only a claim inside the token — a
    // snapshot of who the caller was when they signed in, not who they are now.
    if (req.access) {
      if (req.access.unrestricted) return next();
      return res.status(403).json({ ok: false, error: 'Administrator access required.' });
    }
    if (req.user && req.user.role && req.user.role !== 'Administrator') {
      return res.status(403).json({ ok: false, error: 'Administrator access required.' });
    }
    next();
  };
  const guard = [requireApi, adminOnly];

  // Resolve ?table= to a real table, or answer 404 — this is what makes the table
  // name safe to interpolate below.
  const resolveTable = async (req, res) => {
    const want = String(req.query.table || '');
    const tables = await listTables();
    const found = tables.find((t) => t === want);
    if (!found) { res.status(404).json({ ok: false, error: 'Unknown table.' }); return null; }
    return found;
  };

  // Overview: is D1 live, which modules it serves, and what each table holds.
  app.get('/api/d1/tables', guard, async (req, res) => {
    const st = d1.status();
    if (!st.configured) {
      return res.json({ ok: true, configured: false, modules: [], tables: [],
        hint: 'Set CLOUDFLARE_ACCOUNT_ID / CLOUDFLARE_D1_DATABASE_ID / CLOUDFLARE_API_TOKEN in server/.env, then run: node d1-migrate.js' });
    }
    try {
      const names = await listTables();
      const tables = [];
      for (const name of names) {
        const c = await d1.get('SELECT COUNT(*) AS n FROM "' + name + '"');
        tables.push({ name, rows: (c && c.n) || 0 });
      }
      res.json({ ok: true, configured: true, database: st.database, modules: d1store.activeModules(), tables });
    } catch (e) {
      res.status(500).json({ ok: false, error: String((e && e.message) || e) });
    }
  });

  // One page of rows, newest first where the table has an obvious ordering.
  app.get('/api/d1/rows', guard, async (req, res) => {
    if (!d1.status().configured) return res.status(400).json({ ok: false, error: 'Cloudflare D1 is not configured.' });
    try {
      const table = await resolveTable(req, res);
      if (!table) return;

      const cols = await columnsOf(table);
      const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(req.query.limit, 10) || 50));
      const offset = Math.max(0, parseInt(req.query.offset, 10) || 0);

      const where = [], params = [];
      const q = String(req.query.q || '').trim();
      if (q) {
        // Search every text-ish column. Numeric columns are cast so a search for
        // a timestamp or an id still matches.
        const parts = cols.map((c) => 'CAST("' + c.name + '" AS TEXT) LIKE ? ESCAPE \'\\\'');
        where.push('(' + parts.join(' OR ') + ')');
        for (let i = 0; i < cols.length; i++) params.push(likeTerm(q));
      }
      const whereSql = where.length ? ' WHERE ' + where.join(' AND ') : '';

      // Order by whichever recency column this table actually has.
      const names = cols.map((c) => c.name);
      let order = '';
      if (names.indexOf('ts') >= 0) order = ' ORDER BY ts DESC';
      else if (names.indexOf('date') >= 0 && names.indexOf('updated_at') >= 0) order = ' ORDER BY date DESC, updated_at DESC';
      else if (names.indexOf('updated_at') >= 0) order = ' ORDER BY updated_at DESC';
      else if (names.indexOf('id') >= 0) order = ' ORDER BY id DESC';

      const totalRow = await d1.get('SELECT COUNT(*) AS n FROM "' + table + '"' + whereSql, params);
      const rows = await d1.query(
        'SELECT * FROM "' + table + '"' + whereSql + order + ' LIMIT ? OFFSET ?',
        params.concat([limit, offset]));

      res.json({ ok: true, table, columns: cols, rows, total: (totalRow && totalRow.n) || 0, limit, offset });
    } catch (e) {
      res.status(500).json({ ok: false, error: String((e && e.message) || e) });
    }
  });

  // Update ONE column of ONE row, addressed by primary key.
  app.patch('/api/d1/row', guard, async (req, res) => {
    if (!d1.status().configured) return res.status(400).json({ ok: false, error: 'Cloudflare D1 is not configured.' });
    try {
      const table = await resolveTable(req, res);
      if (!table) return;

      const body = req.body || {};
      const column = String(body.column || '');
      const key = body.key;

      const pk = await primaryKeyOf(table);
      if (!pk) return res.status(400).json({ ok: false, error: 'This table has no single-column primary key, so it cannot be edited here.' });
      if (key == null || key === '') return res.status(400).json({ ok: false, error: 'Missing the row key.' });

      const cols = await columnsOf(table);
      const col = cols.find((c) => c.name === column);
      if (!col) return res.status(400).json({ ok: false, error: 'Unknown column.' });
      if (column === pk) return res.status(400).json({ ok: false, error: 'The primary key cannot be edited — it is what other records point at.' });

      const before = await d1.get('SELECT * FROM "' + table + '" WHERE "' + pk + '" = ?', [key]);
      if (!before) return res.status(404).json({ ok: false, error: 'Row not found.' });

      // Keep the column's storage class: a numeric column edited in a text box
      // would otherwise silently become a string and break ORDER BY.
      let value = body.value;
      if (value === null || value === '') {
        value = null;
      } else if (/INT|REAL|NUMER|DOUBLE|FLOAT/.test(col.type)) {
        const n = Number(value);
        if (!Number.isFinite(n)) return res.status(400).json({ ok: false, error: 'That column holds a number.' });
        value = n;
      } else {
        value = String(value);
        if (jsonColumnsOf(before).indexOf(column) >= 0) {
          try { JSON.parse(value); }
          catch (e) { return res.status(400).json({ ok: false, error: 'This column holds a JSON document and the new value is not valid JSON.' }); }
        }
      }

      await d1.run('UPDATE "' + table + '" SET "' + column + '" = ? WHERE "' + pk + '" = ?', [value, key]);
      activity.log(req, 'db_row_updated', {
        target: table + '.' + column + ' [' + key + ']',
        detail: 'was: ' + short(before[column]) + ' → now: ' + short(value),
      });

      const after = await d1.get('SELECT * FROM "' + table + '" WHERE "' + pk + '" = ?', [key]);
      res.json({ ok: true, row: after });
    } catch (e) {
      res.status(500).json({ ok: false, error: String((e && e.message) || e) });
    }
  });

  // Delete ONE row, addressed by primary key.
  app.delete('/api/d1/row', guard, async (req, res) => {
    if (!d1.status().configured) return res.status(400).json({ ok: false, error: 'Cloudflare D1 is not configured.' });
    try {
      const table = await resolveTable(req, res);
      if (!table) return;
      const key = req.query.key;
      const pk = await primaryKeyOf(table);
      if (!pk) return res.status(400).json({ ok: false, error: 'This table has no single-column primary key, so rows cannot be deleted here.' });
      if (key == null || key === '') return res.status(400).json({ ok: false, error: 'Missing the row key.' });

      const before = await d1.get('SELECT * FROM "' + table + '" WHERE "' + pk + '" = ?', [key]);
      if (!before) return res.status(404).json({ ok: false, error: 'Row not found.' });

      await d1.run('DELETE FROM "' + table + '" WHERE "' + pk + '" = ?', [key]);
      activity.log(req, 'db_row_deleted', { target: table + ' [' + key + ']', detail: short(JSON.stringify(before)) });
      res.json({ ok: true });
    } catch (e) {
      res.status(500).json({ ok: false, error: String((e && e.message) || e) });
    }
  });

  // Which columns this table allows editing (the panel greys out the rest).
  app.get('/api/d1/meta', guard, async (req, res) => {
    try {
      const table = await resolveTable(req, res);
      if (!table) return;
      const pk = await primaryKeyOf(table);
      res.json({ ok: true, table, primaryKey: pk, editable: !!pk });
    } catch (e) {
      res.status(500).json({ ok: false, error: String((e && e.message) || e) });
    }
  });

  return app;
}

module.exports = { mount, listTables };
