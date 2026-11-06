const test = require('node:test');
const assert = require('node:assert/strict');
const { findTmux } = require('../src/find-tmux');

test('prefers tmux on PATH', () => {
  const found = findTmux('/usr/bin:/custom/bin', (f) => f === '/custom/bin/tmux' || f === '/opt/homebrew/bin/tmux');
  assert.equal(found, '/custom/bin/tmux');
});

test('falls back to Homebrew folders when PATH lacks them', () => {
  assert.equal(findTmux('/usr/bin', (f) => f === '/opt/homebrew/bin/tmux'), '/opt/homebrew/bin/tmux');
  assert.equal(findTmux('', (f) => f === '/usr/local/bin/tmux'), '/usr/local/bin/tmux');
});

test('returns null when tmux is not installed', () => {
  assert.equal(findTmux('/usr/bin', () => false), null);
});
