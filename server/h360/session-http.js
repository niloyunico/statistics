// Reads H360 without a browser: plain web requests that keep the sign-in
// cookies, for the live server (which has no Chrome). It signs in through the
// same form a person uses and then asks for the same pages.
const views = require('./views');

const isLoginUrl = (url) => /\/login\/?(\?|#|$)/.test(url);
const AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';

function cookieJar() {
  const cookies = new Map();
  return {
    take(response) {
      const sent = typeof response.headers.getSetCookie === 'function' ? response.headers.getSetCookie() : [];
      for (const line of sent) {
        const pair = line.split(';')[0];
        const at = pair.indexOf('=');
        if (at > 0) cookies.set(pair.slice(0, at).trim(), pair.slice(at + 1).trim());
      }
    },
    header() {
      return [...cookies].map(([name, value]) => `${name}=${value}`).join('; ');
    },
    list() {
      return [...cookies];
    },
    put(pairs) {
      for (const [name, value] of pairs || []) cookies.set(name, value);
    },
  };
}

// cookies: the sign-in of an earlier session ([name, value] pairs), used while H360 still accepts it.
async function open(cfg, { fetchImpl, cookies } = {}) {
  const doFetch = fetchImpl || fetch;
  const origin = new URL(cfg.baseUrl).origin;
  const jar = cookieJar();
  jar.put(cookies);
  let csrf = '';

  // One request that stays on H360 and follows its redirects by hand, so the cookies are kept on the way.
  async function request(url, { method = 'GET', headers = {}, body, timeout = 30000 } = {}) {
    let target = new URL(url, cfg.baseUrl);
    for (let hop = 0; hop < 6; hop++) {
      if (target.origin !== origin) throw new Error(`Blocked: ${target.origin} is not H360.`);
      const response = await doFetch(target.href, {
        method,
        redirect: 'manual',
        headers: { 'User-Agent': AGENT, Cookie: jar.header(), ...headers },
        body,
        signal: AbortSignal.timeout(timeout),
      });
      jar.take(response);
      const next = response.headers.get('location');
      if (response.status >= 300 && response.status < 400 && next) {
        target = new URL(next, target);
        // After a redirect the next request is a plain page request.
        method = 'GET';
        body = undefined;
        headers = { Accept: 'text/html, */*; q=0.01' };
        continue;
      }
      return { status: response.status, url: target.href, text: await response.text() };
    }
    throw new Error('H360 kept redirecting.');
  }

  const first = await request(cfg.baseUrl + '/login', { headers: { Accept: 'text/html' } });
  if (isLoginUrl(first.url)) {
    const form = views.loginForm(first.text);
    if (first.status !== 200 || !form.found) throw new Error(`The H360 sign-in page could not be read (status ${first.status}).`);
    const sent = new URLSearchParams({ _token: form.token, email: cfg.user, password: cfg.pass });
    const after = await request(form.action || cfg.baseUrl + '/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'text/html', Referer: cfg.baseUrl + '/login', Origin: origin },
      body: sent.toString(),
    });
    if (isLoginUrl(after.url)) {
      const message = views.loginMessage(after.text);
      throw new Error('Login failed. Check the H360 user name and password.' + (message ? ` (${message})` : ''));
    }
    if (after.status >= 400) throw new Error(`H360 did not accept the sign-in (status ${after.status}).`);
  }

// H360 answers a page's address with an empty frame, and the frame's own script then asks
  // for the same address again, marked as coming from a script, to get the page itself (see
  // its custom.js: a[rel='tab'] and the loader at the top of every frame). A browser does
  // both by itself; here both are asked for: the frame (it carries the form token) and the
  // body (it carries the lists).
  const FROM_SCRIPT = { 'X-Requested-With': 'XMLHttpRequest', Accept: 'text/html, */*; q=0.01' };
  async function pageOf(url, what) {
    const frame = await request(url, { headers: { Accept: 'text/html' } });
    if (isLoginUrl(frame.url)) throw new Error(`H360 did not open the ${what} page for this login.`);
    if (frame.status !== 200) throw new Error(`The ${what} page could not be opened (status ${frame.status}).`);
    let body = '';
    try {
      const inner = await request(url, { headers: FROM_SCRIPT });
      if (inner.status === 200 && !isLoginUrl(inner.url)) body = inner.text;
    } catch (err) { /* the frame alone is looked at */ }
    return { frame: frame.text, body };
  }

  // What was learnt about pages that did not carry their list (see views.describePage).
  const notes = {};
  return {
    kind: 'http',
    notes,
    cookies: () => jar.list(),
    async stations() {
      const page = await pageOf(cfg.pageUrl, 'Nurse Station');
      csrf = views.csrfToken(page.frame) || views.csrfToken(page.body);
      const inBody = views.stationOptions(page.body);
      const options = inBody.length ? inBody : views.stationOptions(page.frame);
      if (!options.length) notes.stations = views.describePage(page.body || page.frame, /station|ajax|url\s*:/i);
      return options;
    },
    lists(stations) {
      return Promise.all(
        stations.map(async (station) => {
          try {
            const response = await request(cfg.baseUrl + views.LIST_PATH, {
              method: 'POST',
              headers: {
                'X-CSRF-TOKEN': csrf,
                'X-Requested-With': 'XMLHttpRequest',
                'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                Accept: 'application/json',
                Referer: cfg.pageUrl,
                Origin: origin,
              },
              body: 'nurse_station=' + encodeURIComponent(station.value),
            });
            return { status: isLoginUrl(response.url) ? 401 : response.status, body: response.text };
          } catch (err) {
            return { status: 0, body: '', error: err.message };
          }
        })
      );
    },
    async get(href) {
      const response = await request(href, { headers: { 'X-Requested-With': 'XMLHttpRequest', Accept: 'text/html, */*; q=0.01' } });
      if (isLoginUrl(response.url)) throw new Error('H360 signed us out during the collection.');
      return { status: response.status, html: response.text };
    },
    // Without a browser only a list drawn into the page itself can be read; a list the
    // page loads afterwards is read by the hospital PC's collection.
    async register() {
      const page = await pageOf(cfg.baseUrl + views.REGISTER_PATH, 'IPD Admission');
      const filled = (html) => views.plainTables(html).some((table) => table.rows.length);
      const html = filled(page.body) ? page.body : page.frame;
      if (!filled(html)) notes.admissions = views.describePage(page.body || page.frame, /ajax|url\s*:|datatable|admission/i);
      return { answers: [], html };
    },
    // The OPD Nurse Station Patient List as far as the page itself carries it; the lists it
    // links to on the same page are opened too.
    async opd() {
      const opd = require('./opd');
      const both = await pageOf(cfg.baseUrl + opd.OPD_PATH, 'OPD Nurse Station');
      const hasCards = (html) => opd.viewsOf(html).views.some((view) => view.cards.length);
      const page = { text: hasCards(both.body) ? both.body : both.frame };
      const read = opd.viewsOf(page.text);
      const links = opd.tabLinks(both.body + both.frame, cfg.baseUrl);
      if (links.length && read.views.every((view) => !view.tab)) {
        const views = [];
        for (const link of links) {
          const other = await request(link.href, { headers: FROM_SCRIPT });
          if (other.status === 200 && !isLoginUrl(other.url)) views.push({ tab: link.tab, cards: opd.viewsOf(other.text).views.flatMap((view) => view.cards) });
        }
        if (views.some((view) => view.cards.length)) return { views, date: read.date };
      }
      if (!read.views.some((view) => view.cards.length)) notes.opd = views.describePage(both.body || both.frame, /appoint|ajax|url\s*:|vital|tab/i);
      return read;
    },
    close() {
      return Promise.resolve();
    },
  };
}

module.exports = { open };
