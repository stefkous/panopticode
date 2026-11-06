const test = require('node:test');
const assert = require('node:assert/strict');
const { parseShellOutput, mergePaths, userPath } = require('../src/shell-path');

test('reads the PATH between markers, ignoring shell startup noise', () => {
  const out = 'Welcome!\n__PANOPTICODE_PATH__/opt/homebrew/bin:/usr/bin__PANOPTICODE_PATH__';
  assert.equal(parseShellOutput(out), '/opt/homebrew/bin:/usr/bin');
  assert.equal(parseShellOutput('no markers here'), null);
});

test('merges without duplicates, first seen wins', () => {
  assert.equal(mergePaths('/a:/b', '/b:/c', ['/a', '/d']), '/a:/b:/c:/d');
  assert.equal(mergePaths(null, '', ['/x']), '/x');
});

test("uses the login shell's PATH first and survives a failing shell", () => {
  const ok = () => '__PANOPTICODE_PATH__/shell/bin__PANOPTICODE_PATH__';
  assert.ok(userPath(ok, '/bin/zsh', '/usr/bin').startsWith('/shell/bin:/usr/bin'));

  const broken = () => {
    throw new Error('timed out');
  };
  const p = userPath(broken, '/bin/zsh', '/usr/bin');
  assert.ok(p.startsWith('/usr/bin'));
  assert.ok(p.includes('/opt/homebrew/bin'));
});
