const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { stateForEvent } = require('../src/status');

const sessionId = process.env.PANOPTICODE_ID;
if (!sessionId) process.exit(0);

const event = JSON.parse(fs.readFileSync(0, 'utf8'));
const state = stateForEvent(event);
if (!state) process.exit(0);

const dir = path.join(os.homedir(), '.panopticode', 'status');
fs.mkdirSync(dir, { recursive: true });
// Write then rename so the app never reads a half-written file.
const tmp = path.join(dir, `${sessionId}.json.tmp`);
fs.writeFileSync(
  tmp,
  JSON.stringify({
    state,
    event: event.hook_event_name,
    type: event.notification_type,
    at: Date.now(),
  }),
);
fs.renameSync(tmp, path.join(dir, `${sessionId}.json`));
