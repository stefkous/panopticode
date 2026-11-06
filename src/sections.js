const SECTIONS = [
  ['waiting', 'Waiting for you'],
  ['errored', 'Error'],
  ['working', 'Working'],
  ['idle', 'Idle'],
];

/**
 * Sidebar sections in priority order, skipping empty ones. Each entry keeps the session's
 * position in the full list, which is its ⌘1–9 shortcut.
 */
function groupByStatus(sessions) {
  const indexed = sessions.map((session, index) => ({ session, index }));
  return SECTIONS.map(([state, label]) => ({
    state,
    label,
    sessions: indexed.filter(({ session }) => session.state === state),
  })).filter((section) => section.sessions.length);
}

// Also loaded as a plain script in the window, where `module` does not exist.
if (typeof module !== 'undefined') module.exports = { groupByStatus };
