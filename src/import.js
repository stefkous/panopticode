const APP_PATTERN = /\/([^/]+)\.app\/Contents\/MacOS\//;
// Sessions in the Claude desktop app are managed there, so they are not offered for import.
const HIDDEN_SOURCES = new Set(['Claude']);

/** Parse `ps -A -o pid=,ppid=,comm=` output into a Map of pid -> { ppid, comm }. */
function parseProcTable(psOut) {
  const table = new Map();
  for (const line of psOut.split('\n')) {
    const match = line.trim().match(/^(\d+)\s+(\d+)\s+(.+)$/);
    if (match) table.set(Number(match[1]), { ppid: Number(match[2]), comm: match[3] });
  }
  return table;
}

function ancestors(pid, table) {
  const chain = [];
  for (let p = table.get(pid)?.ppid; p && table.has(p); p = table.get(p).ppid) chain.push(p);
  return chain;
}

/**
 * Running interactive Claude sessions that the app does not own (excluding the Claude desktop
 * app), each labelled with the macOS app it runs in. `deckPids` are the tmux pane PIDs of the
 * app's own sessions.
 */
function externalSessions(agents, deckPids, table) {
  return agents
    .filter((a) => a.kind === 'interactive' && !deckPids.has(a.pid))
    .filter((a) => !ancestors(a.pid, table).some((p) => deckPids.has(p)))
    .map(({ pid, sessionId, name, cwd, status }) => {
      const app = ancestors(pid, table)
        .map((p) => table.get(p).comm.match(APP_PATTERN)?.[1])
        .find(Boolean);
      return { pid, sessionId, name, cwd, status, source: app ?? 'Unknown' };
    })
    .filter((s) => !HIDDEN_SOURCES.has(s.source));
}

module.exports = { parseProcTable, externalSessions };
