/* A local HTTP server that speaks the Upstash REST protocol, for tests.
 *
 * Using this rather than stubbing server/redis.js means the tests exercise the REAL
 * wire format — single command AND pipeline, SET NX semantics, PX expiry — so a
 * protocol mistake fails a test instead of only failing in production.
 */
const http = require('http');

function create() {
  const store = new Map();           // key -> { v, exp }
  const seen = [];                   // every command, in order (for assertions)
  let commandCount = 0;
  let failNext = 0;                  // make the next N requests fail, to test degradation

  const get = (k) => {
    const e = store.get(k);
    if (!e) return null;
    if (e.exp && e.exp <= Date.now()) { store.delete(k); return null; }
    return e.v;
  };

  function exec(args) {
    commandCount++;
    seen.push(args.map(String));
    const op = String(args[0] || '').toUpperCase();
    switch (op) {
      case 'GET': return get(args[1]);
      case 'DEL': return store.delete(args[1]) ? 1 : 0;
      case 'TTL': {
        const e = store.get(args[1]);
        if (!e) return -2;
        return e.exp ? Math.ceil((e.exp - Date.now()) / 1000) : -1;
      }
      case 'EXPIRE': case 'PEXPIRE': {
        const e = store.get(args[1]);
        if (!e) return 0;
        e.exp = Date.now() + (parseInt(args[2], 10) || 0) * (op === 'EXPIRE' ? 1000 : 1);
        return 1;
      }
      case 'INCR': {
        const n = (parseInt(get(args[1]) || '0', 10) || 0) + 1;
        const e = store.get(args[1]);
        store.set(args[1], { v: String(n), exp: e && e.exp });
        return n;
      }
      case 'SET': {
        let px = 0, nx = false;
        for (let i = 3; i < args.length; i++) {
          const o = String(args[i]).toUpperCase();
          if (o === 'PX') px = parseInt(args[++i], 10) || 0;
          else if (o === 'EX') px = (parseInt(args[++i], 10) || 0) * 1000;
          else if (o === 'NX') nx = true;
        }
        if (nx && get(args[1]) != null) return null;
        store.set(args[1], { v: String(args[2]), exp: px ? Date.now() + px : 0 });
        return 'OK';
      }
      default: return null;
    }
  }

  const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', (d) => { body += d; });
    req.on('end', () => {
      if (failNext > 0) { failNext--; res.writeHead(500); return res.end('{"error":"induced"}'); }
      let payload;
      try { payload = JSON.parse(body || '[]'); } catch (e) { payload = []; }
      const out = req.url === '/pipeline'
        ? payload.map((c) => ({ result: exec(c) }))
        : { result: exec(payload) };
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(out));
    });
  });

  return {
    server,
    store,
    seen,
    raw: get,
    commands: () => commandCount,
    failFor: (n) => { failNext = n; },
    listen: () => new Promise((r) => server.listen(0, '127.0.0.1', () => r('http://127.0.0.1:' + server.address().port))),
    close: () => new Promise((r) => server.close(r)),
  };
}

module.exports = { create };
