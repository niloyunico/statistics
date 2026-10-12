// The OPD Nurse Station Patient List of H360 (/prescription/appointments/opd-nurse-station):
// today's out-patients as cards, each with its status ("Appointed", "Appointed (Vitals
// Taken)", ...). Only read: the page is opened and, in a browser, its three list tabs are
// looked at. What comes out is the OPD census: how many were appointed, how many have had
// their vitals taken, how many have been seen.
//
// The page's layout is not known in advance, so a card is recognised by what it says: every
// card carries one "Appointment Date:" line, and the smallest box around that line that
// holds nothing of another card is the card.
const cheerio = require('cheerio');

const OPD_PATH = '/prescription/appointments/opd-nurse-station';
const TABS = [['appointed', /^appointed patients?$/i], ['prescribed', /^prescribed patients?$/i], ['all', /^all patients?$/i]];
const BUTTONS = /^(emr|vitals|blank prescription print|print|prescription|view|edit)$/i;
const text = (value) => (value === null || value === undefined ? '' : String(value).replace(/ /g, ' ').replace(/\s+/g, ' ').trim());
const tabOf = (label) => (TABS.find(([, pattern]) => pattern.test(text(label))) || [''])[0];

// "12-10-2026" or "12/10/2026" -> "2026-10-12"
function isoDate(value) {
  const m = text(value).match(/(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})/);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  const iso = text(value).match(/(\d{4})-(\d{2})-(\d{2})/);
  return iso ? iso[0] : '';
}

// One card, from its lines of text in the order they are shown.
function readCard(card) {
  const lines = (card.lines || []).map(text).filter(Boolean);
  const at = (pattern) => lines.findIndex((line) => pattern.test(line));
  const dateAt = at(/^appointment date\s*:/i);
  if (dateAt < 0) return null;
  const serialAt = at(/^serial\s*:/i);
  const ageAt = at(/^age\s*:/i);
  const age = ageAt >= 0 ? lines[ageAt].match(/^age\s*:\s*(.*?)(?:,\s*gender\s*:\s*(.*))?$/i) : null;
  const between = serialAt > dateAt ? lines.slice(dateAt + 1, serialAt) : lines.slice(dateAt + 1, dateAt + 3);
  const after = lines.slice((serialAt > dateAt ? serialAt : dateAt + between.length) + 1).filter((line) => !BUTTONS.test(line));
  const status = after.find((line) => /appoint|prescrib|vital|consult|cancel|complet|wait|visit/i.test(line)) || after[0] || '';
  const name = lines.slice(0, ageAt >= 0 ? ageAt : dateAt).filter((line) => !BUTTONS.test(line)).pop() || '';
  return {
    name,
    age: age ? text(age[1]) : '',
    gender: age ? text(age[2]) : '',
    date: isoDate(lines[dateAt]),
    department: text(between[0]),
    doctor: text(between[1]),
    serial: serialAt >= 0 ? text(lines[serialAt].replace(/^serial\s*:/i, '')) : '',
    status: text(status),
    vitals: /vitals?\s*taken/i.test(status),
    key: text(card.link) || [name, text(between[1]), serialAt >= 0 ? lines[serialAt] : ''].join('|'),
  };
}

// The cards of a page that was fetched without a browser: { tab, cards } per list.
// Lists that sit side by side in the page (tab panes) are told apart by their pane.
function viewsOf(html) {
  const $ = cheerio.load(html);
  $('script, style, noscript, template').remove();
  const paneLabel = new Map();
  $('a[href^="#"], [data-target^="#"], [data-bs-target^="#"]').each((_, el) => {
    const id = ($(el).attr('href') || $(el).attr('data-target') || $(el).attr('data-bs-target') || '').slice(1);
    if (id && tabOf($(el).text())) paneLabel.set(id, tabOf($(el).text()));
  });
  const count = ($el) => ($el.text().match(/Appointment Date\s*:/gi) || []).length;
  const found = new Map();
  const taken = new Set();
  $('*').each((_, el) => {
    const $el = $(el);
    if ($el.children().length || !/Appointment Date\s*:/i.test($el.text())) return;
    let $card = $el;
    while ($card.parent().length && !$card.parent().is('body, .row, .tab-pane, .tab-content, form, main, section') && count($card.parent()) === 1) $card = $card.parent();
    if (taken.has($card[0])) return;
    taken.add($card[0]);
    const lines = [];
    $card.find('*').addBack().contents().each((__, node) => { if (node.type === 'text' && text(node.data)) lines.push(text(node.data)); });
    const pane = $card.closest('.tab-pane').attr('id') || '';
    const tab = paneLabel.get(pane) || '';
    if (!found.has(tab)) found.set(tab, []);
    found.get(tab).push({ lines, link: $card.find('a[href]').first().attr('href') || '' });
  });
  const from = $('input').filter((_, el) => /from/i.test(($(el).attr('name') || '') + ($(el).attr('id') || '') + ($(el).attr('placeholder') || ''))).first().attr('value') || '';
  return { views: [...found].map(([tab, cards]) => ({ tab, cards })), date: isoDate(from) };
}

// Links of the page that open another of its lists (the same page, another tab).
function tabLinks(html, baseUrl) {
  const $ = cheerio.load(html);
  const out = [];
  $('a[href]').each((_, el) => {
    const tab = tabOf($(el).text());
    if (!tab) return;
    try {
      const url = new URL($(el).attr('href'), baseUrl);
      if (url.origin === new URL(baseUrl).origin && url.pathname === OPD_PATH && url.search && !out.some((item) => item.tab === tab)) out.push({ tab, href: url.href });
    } catch (err) { /* not a link */ }
  });
  return out;
}

// views: [{ tab, cards: [{ lines, link }] }] as read from the page; date: the day the page showed.
function parse({ views = [], date = '' } = {}) {
  const byKey = new Map();
  const perTab = {};
  for (const view of views) {
    const tab = view.tab || 'appointed';
    const rows = (view.cards || []).map(readCard).filter(Boolean);
    perTab[tab] = (perTab[tab] || 0) + rows.length;
    for (const row of rows) {
      const seen = byKey.get(row.key);
      const prescribed = tab === 'prescribed' || /prescrib|consult|complet/i.test(row.status);
      if (!seen) byKey.set(row.key, { ...row, prescribed });
      else Object.assign(seen, { vitals: seen.vitals || row.vitals, prescribed: seen.prescribed || prescribed, status: seen.status || row.status });
    }
  }
  const rows = [...byKey.values()];
  const day = isoDate(date) || (rows.find((row) => row.date) || {}).date || '';
  if (!rows.length) return { found: false, date: day, counts: null, departments: [], rows: [] };
  const departments = new Map();
  for (const row of rows) {
    const name = row.department || '(no department)';
    if (!departments.has(name)) departments.set(name, { department: name, total: 0, vitals: 0, prescribed: 0 });
    const at = departments.get(name);
    at.total++;
    if (row.vitals) at.vitals++;
    if (row.prescribed) at.prescribed++;
  }
  const vitals = rows.filter((row) => row.vitals).length;
  const prescribed = perTab.prescribed !== undefined ? perTab.prescribed : rows.filter((row) => row.prescribed).length;
  return {
    found: true,
    date: day,
    counts: {
      // every out-patient of the day; those still waiting; those the doctor has seen;
      // those whose vitals are taken; and those who have come (vitals taken or seen).
      all: rows.length,
      appointed: perTab.appointed !== undefined ? perTab.appointed : rows.filter((row) => !row.prescribed).length,
      prescribed,
      vitals,
      attended: rows.filter((row) => row.vitals || row.prescribed).length,
    },
    tabs: Object.keys(perTab),
    departments: [...departments.values()].sort((a, b) => b.total - a.total),
    rows: rows.map(({ key, ...row }) => row).slice(0, 2000),
  };
}

module.exports = { OPD_PATH, TABS, parse, viewsOf, tabLinks, readCard, isoDate };
