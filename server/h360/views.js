// What the collector is allowed to open on H360, and how a page is turned
// into data. H360 uses plain GET links for some actions that change patient
// state, so nothing is requested unless it is on the lists below.
const cheerio = require('cheerio');

// The one data query the Nurse Station page itself makes when it loads.
const LIST_PATH = '/v2/ipd/nurse-station-received-patient';

// The IPD Admission list: opened as a page and only read. What it shows (admissions,
// discharges, how a patient left) backs up what the nurse station lists say.
const REGISTER_PATH = '/ipd/ipd-admission';

const PATIENT_PAGES = {
  note: '/v2/ipd/nurse-note/{admission}',
  nursesTab: '/v2/ipd/nurse-note/nurses-tab/{admission}',
  doctorsTab: '/v2/ipd/nurse-note/doctors-tab/{admission}',
};

// The other menu pages of a patient. Their buttons are only listed for now
// (in the debug samples), so the view-only ones can be approved one by one.
const MENU_PAGES = {
  'emergency-tab': '/v2/ipd/nurse-note/emergency-tab/{admission}',
  'bundle-tab': '/v2/ipd/nurse-note/bundle-tab/{admission}',
  'dietitian-tab': '/v2/ipd/nurse-note/dietitian-tab/{admission}',
  'physiotherapist-tab': '/ipd/physiotherapist-tab/{admission}',
  'blood-bank-tab': '/v2/ipd/blood-bank-tab/{admission}',
};

// Nurse's Tab buttons that open a chart or record for viewing.
const MODULE_PREFIXES = [
  '/v2/ipd/nurse-assessment-adult/',
  '/ipd/serum-bilirubin-monitoring-chart/',
  '/ipd/epidural-monitoring-chart/',
  '/patient-movement/',
  '/v1/ipd-daily-followup/',
  '/consultation-note/',
  '/nursing-endorsement/',
  '/ipd/pre-operative-checklist/',
  '/ipd/medication-administration/',
  '/ipd/blood-products-transfusion-monitorig-record/',
  '/ipd/vital-entry/',
  '/ipd/hemodialysis-record-bundle/',
  '/ipd/icu-critical-test-result/',
  '/ipd/procedure-sheet-without-sedation-cathlab-list/',
  '/procedure-sheet-under-sedation-cathlab/',
  '/ipd/haemodialysis-unit-personal-data-form/',
  '/ipd/nicu-flow-sheet-form/',
  '/glucose-monitoring-chart/',
  '/skin-care-plan/',
  '/ipd/nursing-initial-assessment-gynaecology-form/',
  '/ipd/surgical-site-prevention-bundle-form/',
  '/ipd/haemodialysis-unit-treatment-worksheet-form/',
  '/intake-output-chart/',
  '/nursing-care-plan/',
  '/ipd/patient-fall-risk/',
  '/ipd/pain-assessment/',
  '/emr/patient-emr/',
  '/fetal-heart-record/',
  // Doctors Tab: clinical notes, assessments and lists opened for viewing.
  // Left out on purpose and never opened: Discharge Summary, Patient Death
  // Certificate, Doctors In-House Transfer, Refer Doctor, OT / Diet
  // Requisition, Blood Transfusion / Indoor Dialysis / Non-Medication Order
  // and Face Sheet.
  '/v2/ipd/patient-assessment-bundle/',
  '/ipd/patient-clinical-records-form/',
  '/nurse-special-note/',
  '/progress-note/',
  '/ipd/counseling-form-critical-care/',
  '/ipd/neonatal-clinical-record-form/',
  '/problem-list/',
  '/ipd/crp-documentation-form/',
  '/ipd/sicu-investigation-chart/',
  '/v2/ipd/patient-medicine/',
  '/ipd/doctor-handover-sheet-bundle/',
  '/ipd/initial-cardiac-assessment/',
  '/v2/ipd/patient-investigation/',
  '/ot-procedure-note/',
  '/ipd/in-patient-investigation-profile/',
];

// Pages a record page links to for viewing its saved data: the six
// medication lists and the intake-output chart of each day.
const SUB_PAGES = [
  { prefix: '/ipd/medicine-reconciliation/', label: 'Medicine Reconciliation' },
  { prefix: '/ipd/sos-drugs/', label: 'SOS Drugs' },
  { prefix: '/ipd/premedication-drugs/', label: 'Premedication Drugs' },
  { prefix: '/ipd/routine-drugs/', label: 'Routine Drugs' },
  { prefix: '/ipd/intravenous-infusion-therapy/', label: 'Intravenous Infusion Therapy' },
  { prefix: '/ipd/verbal-order-record/', label: 'Verbal Order Record' },
  { prefix: '/ipd/date-wise-intake-output-chart/', label: 'Intake-Output', dated: true },
  // A saved form opened from its list ("Edit" shows the saved form). The form
  // number is required, so the "+ New" links, which have none, never match.
  { prefix: '/v2/ipd/patient-assessment/', label: 'Saved assessment form', form: true },
  { prefix: '/ipd/doctor-shift-handover-edit/', label: 'Latest handover form', form: true },
];
const DAYS_PER_PATIENT = 7;

// Never requested, whatever else matches: discharge, bed transfer, billing,
// requisitions and anything that sounds like it writes.
const NEVER = /discharg|death|certificate|transfer|refer-doctor|assign-bed|consultant-change|bill|invoice|requisition|requsition|transfusion-order|dialysis-order|medication-order|pay|delete|remove|cancel|approve|print|pdf|download|generate|create|store|update|save/i;

const IDS = /^\d+(\/\d+)?$/;
const IDS_AND_DATE = /^\d+\/\d+\/(\d{4}-\d{2}-\d{2})$/;
const IDS_AND_FORM = /^\d+\/\d+\/\d+$/;
const slug = (prefix) => prefix.replace(/^\/|\/$/g, '').replace(/\//g, '-');

function moduleKey(pathname) {
  const prefix = MODULE_PREFIXES.find((p) => pathname.startsWith(p) && IDS.test(pathname.slice(p.length)));
  return prefix ? slug(prefix) : null;
}

function subPage(pathname) {
  for (const page of SUB_PAGES) {
    if (!pathname.startsWith(page.prefix)) continue;
    const rest = pathname.slice(page.prefix.length);
    if (page.form) return IDS_AND_FORM.test(rest) ? { key: slug(page.prefix), label: page.label, form: true } : null;
    if (!page.dated) return IDS.test(rest) ? { key: slug(page.prefix), label: page.label } : null;
    const match = rest.match(IDS_AND_DATE);
    if (!match) return null;
    const [year, month, day] = match[1].split('-');
    return { key: `${slug(page.prefix)}-${match[1]}`, label: `${page.label} ${day}/${month}/${year}`, dated: true };
  }
  return null;
}

function isPatientPage(pathname) {
  return [...Object.values(PATIENT_PAGES), ...Object.values(MENU_PAGES)].some((pattern) =>
    new RegExp('^' + pattern.replace('{admission}', '\\d+') + '$').test(pathname)
  );
}

// Every page request goes through this check.
function assertReadOnly(url, baseUrl) {
  const target = new URL(url, baseUrl);
  const where = target.pathname + target.search;
  if (target.origin !== new URL(baseUrl).origin) throw new Error(`Blocked: ${target.origin} is not H360.`);
  if (NEVER.test(where)) throw new Error(`Blocked: ${where} is not a view-only page.`);
  if (target.search || !(isPatientPage(target.pathname) || moduleKey(target.pathname) || subPage(target.pathname))) {
    throw new Error(`Blocked: ${where} is not on the view-only list.`);
  }
  return target;
}

// A link is followed only when it is plain (no script attached), on H360, and on a list above.
function viewLink($el, baseUrl, classify) {
  const link = $el.attr('href') || $el.attr('data-action');
  if (!link || $el.attr('onclick')) return null;
  try {
    const url = new URL(link, baseUrl);
    if (url.origin !== new URL(baseUrl).origin || url.search || NEVER.test(url.pathname)) return null;
    const found = classify(url.pathname);
    return found ? { ...found, url: url.href } : null;
  } catch {
    return null;
  }
}

const clean = (s) => (s || '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
const withoutColon = (s) => clean(s).replace(/^:\s*/, '');
const asLabel = (s) => clean(s).replace(/[\s:*]+$/, '').slice(0, 120);
const fromName = (name) => clean((name || '').replace(/[_\[\]-]+/g, ' '));

function load(html) {
  const $ = cheerio.load(html);
  $('script, style, link, noscript, template').remove();
  return $;
}

// "Label" in one column and ": value" in the next, as in the patient header.
function labelPairs($) {
  const pairs = {};
  $('label').each((_, el) => {
    // Dots are left out because the label becomes a MongoDB field name.
    const label = clean($(el).text()).replace(/\./g, '');
    const next = clean($(el).parent().next().text());
    const value = withoutColon(next);
    if (label && next.startsWith(':') && value && !(label in pairs)) pairs[label] = value;
  });
  return pairs;
}

// Reads a menu page (Nurse's Tab, Doctors Tab): the patient header, the
// buttons that open an approved record, and the buttons left alone.
function parseMenu(html, baseUrl) {
  const $ = load(html);
  const modules = [];
  const skipped = [];
  $('a, button').each((_, el) => {
    const $el = $(el);
    const label = clean($el.text());
    if (!label || !($el.attr('href') || $el.attr('data-action') || $el.attr('onclick'))) return;
    const found = viewLink($el, baseUrl, (pathname) => (moduleKey(pathname) ? { key: moduleKey(pathname) } : null));
    if (!found) {
      if ($el.hasClass('btn') && !skipped.includes(label)) skipped.push(label);
    } else if (!modules.some((m) => m.key === found.key)) {
      modules.push({ key: found.key, label, url: found.url });
    }
  });
  return { profile: labelPairs($), modules, skipped };
}

// Every button on a menu page with where it leads, without opening any of them.
function listButtons(html) {
  const $ = load(html);
  return $('a, button')
    .map((_, el) => {
      const $el = $(el);
      const label = clean($el.text());
      const link = $el.attr('href') || $el.attr('data-action') || '';
      if (!label || !$el.hasClass('btn') || !(link || $el.attr('onclick'))) return null;
      return { label, link, opens: $el.attr('data-action') ? 'pop-up' : $el.attr('target') || 'page', script: $el.attr('onclick') || undefined };
    })
    .get();
}

// The viewing pages a record page links to (newest days first, a week at most).
function parseSubPages(html, baseUrl) {
  const $ = load(html);
  const pages = [];
  $('a').each((_, el) => {
    const found = viewLink($(el), baseUrl, subPage);
    if (!found || pages.some((p) => p.key === found.key)) return;
    if (found.dated && pages.filter((p) => p.dated).length >= DAYS_PER_PATIENT) return;
    pages.push(found);
  });
  return pages;
}

function parseAlerts(html) {
  const $ = load(html);
  const alerts = {};
  $('.alert').each((_, el) => {
    const heading = clean($(el).find('b, strong').first().text());
    const label = heading.replace(/[:.]/g, '').trim();
    const value = withoutColon(clean($(el).text()).slice(heading.length));
    if (label && value) alerts[label] = value;
  });
  return alerts;
}

const NO_DATA = /^(data not found|no\b.*\b(found|available|data|records?)|not found|n\/a)\.?$/i;
const ACTION_COLUMN = /^(actions?|edit|delete)$/i;
const HEADINGS = 'h1, h2, h3, h4, h5, h6, legend, .card-header, .card-title';

// The heading a table or field sits under.
function headingBefore($, $node) {
  for (let depth = 0, $at = $node; depth < 6 && $at.length; depth++, $at = $at.parent()) {
    const title = clean($at.prevAll(HEADINGS).first().text());
    if (title) return asLabel(title).slice(0, 80);
  }
  return '';
}

// Replaces every form control with a marker holding the value saved in it,
// and removes the choices that were not ticked, so only real data is left.
function resolveControls($) {
  const marker = (value, extra = '') => `<span data-c="1" data-f="${value ? 1 : 0}"${extra}>${$('<i>').text(value).html()}</span>`;
  const named = ($el) => ` data-n="${fromName($el.attr('name')).replace(/"/g, '')}"`;

  $('input').each((_, el) => {
    const $el = $(el);
    const type = ($el.attr('type') || 'text').toLowerCase();
    if (type !== 'checkbox' && type !== 'radio') {
      $el.replaceWith(marker(clean($el.attr('value')), named($el) + ' data-k="text"'));
      return;
    }
    const checked = $el.attr('checked') !== undefined;
    const id = $el.attr('id');
    const $wrap = $el.parent('label');
    const $for = id ? $(`label[for="${id.replace(/["\\]/g, '')}"]`).first() : $();
    const after = el.next && el.next.type === 'text' ? el.next : null;
    const own = clean($wrap.text()) || clean($for.text()) || clean(after && after.data) || '';
    if (!checked) {
      // An unticked choice is not data: drop it together with its caption.
      if ($wrap.length) $wrap.remove();
      else {
        if (after) $(after).remove();
        $for.remove();
        $el.remove();
      }
      return;
    }
    const value = own || (type === 'radio' ? clean($el.attr('value')) : '') || 'Yes';
    const html = marker(value, named($el) + ` data-k="${type}"`);
    if ($wrap.length) $wrap.replaceWith(html);
    else {
      if (after) $(after).remove();
      $for.remove();
      $el.replaceWith(html);
    }
  });
  $('select').each((_, el) => {
    const $el = $(el);
    const $chosen = $el.find('option[selected]').filter((_, o) => clean($(o).attr('value')) !== '').first();
    $el.replaceWith(marker(clean($chosen.text()), named($el) + ' data-k="select"'));
  });
  $('textarea').each((_, el) => {
    const $el = $(el);
    const lines = $el.text().split(/\r?\n/).map(clean).filter(Boolean);
    // The lines travel in an attribute, because text inside the page is later squeezed onto one line.
    const kept = lines.length > 1 ? ` data-v="${encodeURIComponent(lines.join('\n'))}"` : '';
    $el.replaceWith(marker(lines.join(' '), named($el) + ' data-k="text"' + kept));
  });
}

function fieldLabel($, $control) {
  const withoutValues = ($node) => {
    const $copy = $node.clone();
    $copy.find('[data-c]').remove();
    return asLabel($copy.text());
  };
  const $cell = $control.closest('td, th');
  if ($cell.length) {
    // The caption is the nearest earlier cell in the row that is text only.
    for (let $at = $cell.prev(); $at.length; $at = $at.prev()) {
      if (!$at.find('[data-c]').length && asLabel($at.text())) return asLabel($at.text());
    }
    return withoutValues($cell) || withoutValues($cell.parent().children().first());
  }
  for (let depth = 0, $at = $control.parent(); depth < 4 && $at.length; depth++, $at = $at.parent()) {
    const caption = asLabel($at.find('label').first().text()) || (depth < 2 ? withoutValues($at) : '');
    if (caption) return caption.slice(0, 120);
  }
  return '';
}

// Reads a table of "Label : value" cells (as on the EMR page) into fields, or
// returns null when the table is not of that kind.
function labelValueRows(rows, section) {
  const found = [];
  for (const cells of rows) {
    for (let i = 0; i < cells.length; ) {
      const label = asLabel(cells[i]);
      const next = cells[i + 1] || '';
      let value;
      if (next === ':') {
        value = cells[i + 2] || '';
        i += 3;
      } else if (next.startsWith(':')) {
        value = withoutColon(next);
        i += 2;
      } else if (!label && !next) {
        i += 1;
        continue;
      } else {
        return null;
      }
      if (label && value) found.push({ section, label, value, fixed: true });
    }
  }
  return found;
}

// Turns a record page into its saved data:
//   entries - rows of saved records (history tables and filled-in charts)
//   values  - the filled fields of an assessment form, under their section
// rows: 'filled' keeps chart rows only where something was entered; 'all'
// keeps every row (used for pages that list what is prescribed).
function extract(html, { rows: rowMode = 'filled' } = {}) {
  const $ = load(html);
  $('button, input[type=hidden], input[type=submit], input[type=button], input[type=file], .modal, .modal-footer, canvas, svg').remove();
  resolveControls($);

  const entries = [];
  const values = [];
  const cellText = (c) => clean($(c).text()).slice(0, 600);

  $('table').each((_, el) => {
    const $table = $(el);
    if ($table.find('table').length) return; // the inner tables are read on their own
    const hasControls = $table.find('[data-c]').length > 0;
    let headers = $table.find('thead tr').last().children('th, td').map((_, c) => cellText(c)).get();
    let bodyRows = $table.find('tr').filter((_, tr) => !$(tr).closest('thead').length).get();
    if (!headers.length && bodyRows.length > 1 && $(bodyRows[0]).children('td').length === 0) {
      headers = $(bodyRows.shift()).children().map((_, c) => cellText(c)).get();
    }
    const cellsOf = (tr) => $(tr).children('th, td').map((_, c) => cellText(c)).get();
    const fitting = bodyRows.filter((tr) => $(tr).children('th, td').length === headers.length).length;
    const isChart = headers.length > 1 && fitting * 2 >= bodyRows.length;

    // A form laid out as a table: its fields are read one by one below.
    if (hasControls && !isChart) return;
    if (!hasControls && !headers.length) {
      const found = labelValueRows(bodyRows.map(cellsOf), headingBefore($, $table));
      if (found) values.push(...found);
      if (found || rowMode !== 'all') return;
    }
    $table.attr('data-grid', '1');

    if (hasControls && rowMode === 'filled') bodyRows = bodyRows.filter((tr) => $(tr).find('[data-c][data-f="1"]').length);
    const keep = headers.map((name) => !ACTION_COLUMN.test(name));
    const rows = bodyRows
      .map(cellsOf)
      .map((row) => (headers.length && row.length === headers.length ? row.filter((_, i) => keep[i]) : row))
      .filter((row) => row.some(Boolean) && !(row.filter(Boolean).length === 1 && NO_DATA.test(row.find(Boolean))))
      .slice(0, 500);
    if (!rows.length) return;
    entries.push({
      title: headingBefore($, $table),
      columns: headers.filter((_, i) => keep[i]),
      rows,
      fromForm: hasControls,
    });
  });

  $('[data-c][data-f="1"]').each((_, el) => {
    const $control = $(el);
    if ($control.closest('table[data-grid]').length) return;
    const value = $control.attr('data-v') ? decodeURIComponent($control.attr('data-v')) : clean($control.text());
    const ticked = $control.attr('data-k') === 'checkbox';
    let label = fieldLabel($, $control) || asLabel($control.attr('data-n')) || '(unnamed)';
    if (label === value) label = asLabel($control.attr('data-n')) || label;
    const section = headingBefore($, $control.closest('table').length ? $control.closest('table') : $control);
    const same = values.find((v) => v.section === section && v.label === label);
    if (same) {
      if (!same.value.split(', ').includes(value)) same.value += ', ' + value;
    } else {
      values.push({ section, label, value: ticked && label === value ? 'Yes' : value });
    }
  });

  // An untouched entry form still shows its defaults ("No", "ML", the doctor's
  // name); it counts as saved data only when enough was really typed or chosen.
  const typed = $('[data-c][data-f="1"][data-k="text"]').length;
  const filled = $('[data-c][data-f="1"]').length;
  const formSaved = rowMode === 'all' || typed >= 3 || filled >= 8;
  return {
    entries: entries.filter((e) => formSaved || !e.fromForm).slice(0, 60),
    values: values.filter((v) => formSaved || v.fixed).map(({ section, label, value }) => ({ section, label, value })).slice(0, 600),
  };
}

// Addresses the page's own scripts load data from: kept in the debug samples
// to show which pages fill themselves in after opening.
function scriptAddresses(html) {
  const found = new Set();
  for (const match of html.matchAll(/url\s*:\s*["'`]([^"'`]+)["'`]/g)) found.add(match[1]);
  return [...found];
}

// The sign-in form and the Nurse Station page, read without a browser.
function loginForm(html) {
  const $ = cheerio.load(html);
  const $form = $('form').filter((_, el) => $(el).find('input[name="password"]').length > 0).first();
  return { found: $form.length > 0, token: $form.find('input[name="_token"]').attr('value') || '', action: $form.attr('action') || '' };
}

function loginMessage(html) {
  const $ = cheerio.load(html);
  return clean($('.invalid-feedback, .alert, .text-danger').first().text()).slice(0, 200);
}

const csrfToken = (html) => cheerio.load(html)('meta[name="csrf-token"]').attr('content') || '';

function stationOptions(html) {
  const $ = cheerio.load(html);
  let $select = $('#nurse_station_received');
  if (!$select.length) $select = $('select').filter((_, el) => $(el).find('option').filter((_, o) => /station/i.test($(o).text())).length > 0).first();
  return $select.find('option').filter((_, o) => ($(o).attr('value') || '') !== '' && $(o).attr('disabled') === undefined)
    .map((_, o) => ({ value: $(o).attr('value'), text: clean($(o).text()) })).get();
}

// Every table of a page as headers and rows of plain text (used for the IPD Admission list).
function plainTables(html) {
  const $ = load(html);
  return $('table').filter((_, el) => !$(el).find('table').length).map((_, el) => {
    const $table = $(el);
    let headers = $table.find('thead tr').last().children('th, td').map((_, c) => clean($(c).text())).get();
    let body = $table.find('tr').filter((_, tr) => !$(tr).closest('thead').length).get();
    if (!headers.length && body.length > 1 && $(body[0]).children('td').length === 0) headers = $(body.shift()).children().map((_, c) => clean($(c).text())).get();
    const rows = body.map((tr) => $(tr).children('th, td').map((_, c) => clean($(c).text()).slice(0, 600)).get()).filter((row) => row.length === headers.length && row.some(Boolean));
    return { headers, rows };
  }).get().filter((table) => table.headers.length > 1);
}

const plainText = (value) => (/[<&]/.test(String(value)) ? clean(cheerio.load('<i>' + String(value) + '</i>')('i').text()) : clean(String(value)));

module.exports = {
  LIST_PATH, REGISTER_PATH, PATIENT_PAGES, MENU_PAGES, listButtons, assertReadOnly, subPage, parseMenu, parseSubPages, parseAlerts, extract, scriptAddresses,
  loginForm, loginMessage, csrfToken, stationOptions, plainTables, plainText,
};
