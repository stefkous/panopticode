const path = require('node:path');

// tmux rewrites control characters (including tabs) in format output, so use a printable separator.
const SEP = '|deck|';
const SESSION_FORMAT = [
  '#{session_created}',
  '#{session_name}',
  '#{@deck_name}',
  '#{session_path}',
  '#{pane_title}',
  '#{@deck_custom}',
].join(SEP);

// Titles that are not a session topic: tmux defaults the pane title to the hostname.
const GENERIC_TITLES = new Set(['', 'Claude Code']);

/** The session title Claude sets on the terminal, without its leading status glyph. */
function sessionTitle(paneTitle, hostname) {
  const title = paneTitle.replace(/^[^\p{L}\p{N}]+/u, '').trim();
  return title === hostname || GENERIC_TITLES.has(title) ? '' : title;
}

/** Parse `tmux list-sessions -F SESSION_FORMAT` output into sessions, oldest first. */
function parseSessions(out, hostname) {
  return out
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((line) => line.split(SEP))
    .sort((a, b) => Number(a[0]) - Number(b[0]))
    .map(([, id, name, cwd, paneTitle, custom]) => ({
      id,
      name: custom || sessionTitle(paneTitle, hostname) || name || path.basename(cwd),
      cwd,
    }));
}

module.exports = { SESSION_FORMAT, parseSessions };
