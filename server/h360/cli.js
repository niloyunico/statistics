// One H360 collection from the command line, for a scheduled task on the hospital PC:
//   node server/h360/cli.js          quick update
//   node server/h360/cli.js --full   reads every record again
//   node server/h360/cli.js --list   only the patient lists
// It uses the login saved in the app (Supervisor Reports > H360 Patients) and the same
// databases as the app, so what it collects shows up there.
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { createService } = require('./index');

const mode = process.argv.includes('--full') ? 'full' : process.argv.includes('--list') ? 'list' : 'quick';
createService()
  .collect(mode, (message) => console.log(message))
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Collection failed: ' + err.message);
    process.exit(1);
  });
