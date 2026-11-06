const test = require('node:test');
const assert = require('node:assert/strict');
const { SESSION_FORMAT, parseSessions } = require('../src/tmux-format');

const HOST = 'macbook.local';
const line = (created, id, name, cwd, title, custom = '') =>
  SESSION_FORMAT.replace('#{session_created}', created)
    .replace('#{session_name}', id)
    .replace('#{@deck_name}', name)
    .replace('#{session_path}', cwd)
    .replace('#{pane_title}', title)
    .replace('#{@deck_custom}', custom);

test('parses sessions oldest first, preferring the title Claude sets', () => {
  const out = [
    line('20', 'db', '', '/Users/s/b_c d', HOST),
    line('10', 'da', 'Alpha', '/Users/s/a', '✳ Tidy imports'),
  ].join('\n');

  assert.deepEqual(parseSessions(out, HOST), [
    { id: 'da', name: 'Tidy imports', cwd: '/Users/s/a' },
    { id: 'db', name: 'b_c d', cwd: '/Users/s/b_c d' },
  ]);
});

for (const [title, expected] of [
  ['⠂ Fixing tests', 'Fixing tests'],
  ['Claude Code', 'Alpha'],
  ['', 'Alpha'],
]) {
  test(`title ${JSON.stringify(title)} -> ${expected}`, () => {
    const [session] = parseSessions(line('1', 'da', 'Alpha', '/a', title), HOST);
    assert.equal(session.name, expected);
  });
}

test('a name set in the app wins over Claude\'s title', () => {
  const [session] = parseSessions(line('1', 'da', 'Alpha', '/a', '✳ Docs work', 'My name'), HOST);
  assert.equal(session.name, 'My name');
});
