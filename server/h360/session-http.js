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
  };
}

async function open(cfg, { fetchImpl } = {}) {
  const doFetch = fetchImpl || fetch;
  const origin = new URL(cfg.baseUrl).origin;
  const jar = cookieJar();
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

  // What was learnt about pages that did not carry their list (see views.describePage).
  const notes = {};
  return {
    kind: 'http',
    notes,
    async stations() {
      const page = await request(cfg.pageUrl, { headers: { Accept: 'text/html' } });
      if (isLoginUrl(page.url)) throw new Error('H360 sent us back to the login page after signing in.');
      if (page.status !== 200) throw new Error(`The Nurse Station page could not be opened (status ${page.status}).`);
      csrf = views.csrfToken(page.text);
      const options = views.stationOptions(page.text);
      if (!options.length) notes.stations = views.describePage(page.text, /station/i);
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
      const page = await request(cfg.baseUrl + views.REGISTER_PATH, { headers: { Accept: 'text/html' } });
      if (isLoginUrl(page.url)) throw new Error('H360 did not open the IPD Admission page for this login.');
      if (page.status !== 200) throw new Error(`The IPD Admission page could not be opened (status ${page.status}).`);
      if (!views.plainTables(page.text).some((table) => table.rows.length)) notes.admissions = views.describePage(page.text, /ajax|admission|datatable/i);
      return { answers: [], html: page.text };
    },
    close() {
      return Promise.resolve();
    },
  };
}

module.exports = { open };
