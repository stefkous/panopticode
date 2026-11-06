const test = require('node:test');
const assert = require('node:assert/strict');
const { isAtPrompt, promptIsEmpty } = require('../src/rename');

const ESC = '\x1b';
const screen = (inputLine) =>
  [`❯ Reply with only ok`, '⏺ ok', `${ESC}[39m❯ ${inputLine}`, '  Opus 5.5'].join('\n');

for (const [inputLine, expected] of [
  [`${ESC}[2mTry "how does <filepath> work?"${ESC}[0m`, true],
  ['', true],
  ['half typed draft', false],
]) {
  test(`prompt ${JSON.stringify(inputLine)} empty -> ${expected}`, () => {
    assert.equal(promptIsEmpty(screen(inputLine)), expected);
  });
}

for (const [status, expected] of [
  [{ event: 'Stop' }, true],
  [{ event: 'SessionStart' }, true],
  [{ event: 'Notification', type: 'idle_prompt' }, true],
  [{ event: 'Notification', type: 'permission_prompt' }, false],
  [{ event: 'PermissionRequest' }, false],
  [{ event: 'PreToolUse' }, false],
  [null, false],
]) {
  test(`at prompt ${JSON.stringify(status)} -> ${expected}`, () => {
    assert.equal(isAtPrompt(status), expected);
  });
}
