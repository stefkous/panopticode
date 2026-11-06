const fs = require('node:fs');
const path = require('node:path');

/**
 * Copy a file or folder from an old location to a new one, once: only when the old one exists
 * and the new one does not. The old copy is left in place. Returns true if anything was copied.
 */
function migrate(from, to) {
  if (fs.existsSync(to) || !fs.existsSync(from)) return false;
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.cpSync(from, to, { recursive: true });
  return true;
}

module.exports = { migrate };
