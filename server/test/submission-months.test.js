const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require('node:path').join(__dirname, '../../renderer/unico/data-collection.jsx'), 'utf8');
const helpers = source.slice(source.indexOf('  function dcSubmissionWindow('), source.indexOf('  function staffNames()'));
const ctx = { Intl, Date, MONS_ABBR: ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'] };
vm.runInNewContext(helpers + '\nthis.windowFor = dcSubmissionWindow;', ctx);
for (const [date,current,latest] of [
 ['2026-10-29T17:59:59Z','Sep-26','Sep-26'],
 ['2026-10-29T18:00:00Z','Oct-26','Oct-26'],
 ['2026-10-31T17:59:59Z','Oct-26','Oct-26'],
 ['2026-10-31T18:00:00Z','Oct-26','Oct-26'],
 ['2026-11-28T17:59:59Z','Oct-26','Oct-26'],
 ['2026-11-28T18:00:00Z','Nov-26','Nov-26'],
 ['2026-12-29T18:00:00Z','Dec-26','Dec-26'],
 ['2026-12-31T18:00:00Z','Dec-26','Dec-26'],
 ['2027-02-25T18:00:00Z','Jan-27','Jan-27'],
 ['2027-02-26T18:00:00Z','Feb-27','Feb-27'],
 ['2028-02-26T18:00:00Z','Jan-28','Jan-28'],
 ['2028-02-27T18:00:00Z','Feb-28','Feb-28']
]) {
 const result = ctx.windowFor(new Date(date));
 assert.equal(result.current,current,date+' default');
 assert.equal(result.latest,latest,date+' available');
}
assert.match(source,/const monthOpts = dcSubmissionMonthOpts\(\[dcPatientStart\(dept, subs\)\]/);
assert.match(source,/const monthOpts = dcSubmissionMonthOpts\(dcAreaStarts\(area, \[\]\)/);
assert.match(source,/const defMonth = dcSubmissionWindow\(\).current/);
assert.match(source,/const dcRealMonthOpts = \(startMonths, keep, last = dcDefaultMonth\(\)\)/);
console.log('Submission calendar checks passed: Dhaka midnight, 28/29/30/31-day months, year rollover, both forms.');
