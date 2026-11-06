const test = require('node:test');
const assert = require('node:assert/strict');
const { stateForEvent } = require('../src/status');

const cases = [
  [{ hook_event_name: 'SessionStart' }, 'idle'],
  [{ hook_event_name: 'UserPromptSubmit' }, 'working'],
  [{ hook_event_name: 'PreToolUse' }, 'working'],
  [{ hook_event_name: 'PostToolUse' }, 'working'],
  [{ hook_event_name: 'PermissionRequest' }, 'waiting'],
  [{ hook_event_name: 'Notification', notification_type: 'permission_prompt' }, 'waiting'],
  [{ hook_event_name: 'Stop' }, 'waiting'],
  [{ hook_event_name: 'StopFailure' }, 'errored'],
  [{ hook_event_name: 'CwdChanged' }, null],
];

for (const [event, expected] of cases) {
  test(`${event.hook_event_name} -> ${expected}`, () => {
    assert.equal(stateForEvent(event), expected);
  });
}
