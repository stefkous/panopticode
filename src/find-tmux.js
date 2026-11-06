const fs = require('node:fs');
const path = require('node:path');

// Apps opened from Finder or the Dock don't get the shell's PATH, so Homebrew's folders may be
// missing from it. These are where Homebrew installs tmux on Apple silicon and Intel Macs.
const FALLBACK_DIRS = ['/opt/homebrew/bin', '/usr/local/bin'];

/** Full path to the tmux binary, searching PATH and then Homebrew's folders; null if not found. */
function findTmux(envPath = process.env.PATH ?? '', exists = fs.existsSync) {
  const dirs = [...envPath.split(path.delimiter).filter(Boolean), ...FALLBACK_DIRS];
  return dirs.map((dir) => path.join(dir, 'tmux')).find((file) => exists(file)) ?? null;
}

module.exports = { findTmux };
