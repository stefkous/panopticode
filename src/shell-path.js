const os = require('node:os');
const path = require('node:path');

const MARK = '__PANOPTICODE_PATH__';

// Apps opened from Finder, the Dock or some launchers get a minimal PATH, without Homebrew or
// ~/.local/bin, so `tmux` and `claude` are not found. These are always added as a fallback.
const FALLBACK_DIRS = [
  path.join(os.homedir(), '.local', 'bin'),
  '/opt/homebrew/bin',
  '/usr/local/bin',
  '/usr/bin',
  '/bin',
];

/** The PATH printed between markers by a login shell, ignoring anything its startup files print. */
function parseShellOutput(out) {
  const match = out.match(new RegExp(`${MARK}(.*)${MARK}`));
  return match ? match[1] : null;
}

/** Join PATH strings and folder lists, dropping empties and duplicates, keeping first-seen order. */
function mergePaths(...parts) {
  const dirs = parts.flatMap((p) => (Array.isArray(p) ? p : (p ?? '').split(path.delimiter)));
  return [...new Set(dirs.filter(Boolean))].join(path.delimiter);
}

/**
 * The PATH the user's terminal would have: asks their login shell, then adds the current PATH and
 * the fallback folders. `run(file, args)` runs a command and returns its output.
 */
function userPath(run, shell = process.env.SHELL || '/bin/zsh', current = process.env.PATH) {
  let fromShell = null;
  try {
    fromShell = parseShellOutput(run(shell, ['-ilc', `printf '${MARK}%s${MARK}' "$PATH"`]));
  } catch {
    // A slow or broken shell profile shouldn't stop the app; the fallbacks still apply.
  }
  return mergePaths(fromShell, current, FALLBACK_DIRS);
}

module.exports = { parseShellOutput, mergePaths, userPath };
