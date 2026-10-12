// Reads H360 through Chrome or Edge on this computer (the hospital PC), the
// way the stand-alone collector always has. Not used on the live server, which
// has no browser: see session-http.js.
const views = require('./views');

const SKIPPED_RESOURCES = new Set(['image', 'font', 'media']);
const isLoginUrl = (url) => /\/login\/?(\?|#|$)/.test(url);

function playwright() {
  // Named indirectly so the live server's build does not try to carry a browser driver.
  const name = 'playwright-core';
  try {
    return require(name);
  } catch (err) {
    return null;
  }
}

const available = () => Boolean(playwright());

async function launchBrowser(headless) {
  const { chromium } = playwright();
  const errors = [];
  for (const channel of ['chrome', 'msedge']) {
    try {
      return await chromium.launch({ channel, headless });
    } catch (err) {
      errors.push(`${channel}: ${err.message.split('\n')[0]}`);
    }
  }
  throw new Error('Could not start Chrome or Edge on this computer. ' + errors.join(' | '));
}

async function login(page, cfg) {
  await page.goto(cfg.baseUrl + '/login', { waitUntil: 'domcontentloaded' });
  if (!isLoginUrl(page.url())) return;
  await page.fill('input[name="email"]', cfg.user);
  await page.fill('input[name="password"]', cfg.pass);
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'domcontentloaded' }),
    page.click('button[type="submit"]'),
  ]);
  if (isLoginUrl(page.url())) {
    const message = await page
      .locator('.invalid-feedback, .alert, .text-danger')
      .first()
      .innerText({ timeout: 1000 })
      .catch(() => '');
    throw new Error('Login failed. Check the H360 user name and password.' + (message ? ` (${message.trim()})` : ''));
  }
}

// Runs in the Nurse Station page.
function readStations() {
  const clean = (s) => (s || '').replace(/\s+/g, ' ').trim();
  const select =
    document.querySelector('#nurse_station_received') ||
    [...document.querySelectorAll('select')].find((s) => [...s.options].some((o) => /station/i.test(o.textContent)));
  if (!select) return [];
  return [...select.options]
    .filter((o) => o.value !== '' && !o.disabled)
    .map((o) => ({ value: o.value, text: clean(o.textContent) }));
}

// Runs in the Nurse Station page: the same list query the page makes itself,
// asked for every station at once.
function fetchLists({ listPath, stations }) {
  const token = (document.querySelector('meta[name="csrf-token"]') || {}).content || '';
  return Promise.all(
    stations.map(async (station) => {
      const response = await fetch(listPath, {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'X-CSRF-TOKEN': token,
          'X-Requested-With': 'XMLHttpRequest',
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          Accept: 'application/json',
        },
        body: 'nurse_station=' + encodeURIComponent(station.value),
      });
      return { status: response.status, body: await response.text() };
    })
  );
}

// Runs in the IPD Admission page: the page's own list query once more, asking
// for more rows of the same list. Nothing but the page size is changed.
function fetchMore({ url, method, body }) {
  const token = (document.querySelector('meta[name="csrf-token"]') || {}).content || '';
  return fetch(url, {
    method,
    credentials: 'same-origin',
    headers: {
      'X-CSRF-TOKEN': token,
      'X-Requested-With': 'XMLHttpRequest',
      Accept: 'application/json',
      ...(body ? { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' } : {}),
    },
    body: body || undefined,
  }).then(async (response) => ({ status: response.status, body: await response.text() }));
}

const MAX_ROWS = 1000;

async function open(cfg) {
  const browser = await launchBrowser(cfg.headless);
  let page;
  let context;
  try {
    context = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
    await context.route('**/*', (route) =>
      SKIPPED_RESOURCES.has(route.request().resourceType()) ? route.abort() : route.continue()
    );
    page = await context.newPage();
    page.setDefaultTimeout(30000);
    page.on('dialog', (dialog) => dialog.dismiss().catch(() => {}));
    await login(page, cfg);
  } catch (err) {
    await browser.close().catch(() => {});
    throw err;
  }

  return {
    kind: 'browser',
    async stations() {
      await page.goto(cfg.pageUrl, { waitUntil: 'domcontentloaded' });
      if (isLoginUrl(page.url())) throw new Error('H360 sent us back to the login page after signing in.');
      await page.waitForFunction(`(${readStations})().length > 0`, null, { timeout: 15000 }).catch(() => {});
      return page.evaluate(readStations);
    },
    lists(stations) {
      return page.evaluate(fetchLists, { listPath: views.LIST_PATH, stations });
    },
    async get(href) {
      const response = await context.request.get(href, {
        headers: { 'X-Requested-With': 'XMLHttpRequest', Accept: 'text/html, */*; q=0.01' },
        timeout: 30000,
      });
      if (isLoginUrl(response.url())) throw new Error('H360 signed us out during the collection.');
      return { status: response.status(), html: await response.text() };
    },
    // Opens the IPD Admission page in its own tab and keeps what the page loads by itself.
    async register() {
      const tab = await context.newPage();
      tab.setDefaultTimeout(30000);
      tab.on('dialog', (dialog) => dialog.dismiss().catch(() => {}));
      const origin = new URL(cfg.baseUrl).origin;
      const answers = [];
      const waiting = [];
      tab.on('response', (response) => {
        const request = response.request();
        if (!['xhr', 'fetch'].includes(request.resourceType())) return;
        if (!/json/i.test(response.headers()['content-type'] || '')) return;
        let url;
        try { url = new URL(response.url()); } catch { return; }
        if (url.origin !== origin) return;
        waiting.push(
          response.json()
            .then((body) => answers.push({ path: url.pathname, search: url.search, method: request.method(), post: request.postData() || '', body }))
            .catch(() => {})
        );
      });
      try {
        await tab.goto(cfg.baseUrl + views.REGISTER_PATH, { waitUntil: 'domcontentloaded' });
        if (isLoginUrl(tab.url())) throw new Error('H360 did not open the IPD Admission page for this login.');
        await tab.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
        await Promise.all(waiting);

        // A list shown a page at a time: ask the same query for the whole list (up to a limit).
        for (const answer of [...answers]) {
          const body = answer.body || {};
          const shown = Array.isArray(body.data) ? body.data.length : 0;
          const total = Number(body.recordsFiltered || body.recordsTotal) || 0;
          const params = new URLSearchParams(answer.method === 'GET' ? answer.search.replace(/^\?/, '') : answer.post);
          if (!shown || total <= shown || !params.has('length') || !params.has('draw')) continue;
          if (!['GET', 'POST'].includes(answer.method)) continue;
          params.set('start', '0');
          params.set('length', String(Math.min(total, MAX_ROWS)));
          const more = await tab.evaluate(fetchMore, {
            url: answer.path + (answer.method === 'GET' ? '?' + params.toString() : answer.search),
            method: answer.method,
            body: answer.method === 'POST' ? params.toString() : '',
          }).catch(() => null);
          if (!more || more.status !== 200) continue;
          try {
            const whole = JSON.parse(more.body);
            if (Array.isArray(whole.data) && whole.data.length > shown) answer.body = whole;
          } catch {
            // The first page of the list is kept.
          }
        }
        return { answers: answers.map(({ path, method, body }) => ({ path, method, body })), html: await tab.content() };
      } finally {
        await tab.close().catch(() => {});
      }
    },
    close() {
      return browser.close().catch(() => {});
    },
  };
}

module.exports = { open, available };
