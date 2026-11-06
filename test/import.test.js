const test = require('node:test');
const assert = require('node:assert/strict');
const { parseProcTable, externalSessions } = require('../src/import');

const PS = `
    1     0 /sbin/launchd
  100     1 /Applications/iTerm.app/Contents/MacOS/iTerm2
  110   100 -zsh
  111   110 claude
  200     1 tmux
  211   200 claude
  300     1 /Applications/Claude.app/Contents/MacOS/Claude
  311   300 /Users/s/.local/bin/claude
`;

const agent = (pid, kind = 'interactive') => ({
  pid,
  kind,
  sessionId: `s${pid}`,
  name: `n${pid}`,
  cwd: `/w/${pid}`,
  status: 'idle',
});

test('lists interactive terminal sessions outside the app, hiding Claude desktop ones', () => {
  const agents = [agent(111), agent(211), agent(311), { ...agent(999, 'background'), pid: undefined }];

  assert.deepEqual(externalSessions(agents, new Set([211]), parseProcTable(PS)), [
    { pid: 111, sessionId: 's111', name: 'n111', cwd: '/w/111', status: 'idle', source: 'iTerm' },
  ]);
});
