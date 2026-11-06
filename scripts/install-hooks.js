const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { addDeckHooks, removeDeckHooks } = require('../src/hook-settings');

const settingsPath = path.join(os.homedir(), '.claude', 'settings.json');
const hookScript = path.resolve(__dirname, '..', 'hooks', 'panopticode-hook.js');
const command = `node ${JSON.stringify(hookScript)}`;
const remove = process.argv.includes('--remove');

const settings = fs.existsSync(settingsPath)
  ? JSON.parse(fs.readFileSync(settingsPath, 'utf8'))
  : {};

if (fs.existsSync(settingsPath)) {
  const backup = `${settingsPath}.panopticode-backup-${Date.now()}`;
  fs.copyFileSync(settingsPath, backup);
  console.log(`Backup saved: ${backup}`);
}

const updated = remove ? removeDeckHooks(settings) : addDeckHooks(settings, command);
fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
fs.writeFileSync(settingsPath, `${JSON.stringify(updated, null, 2)}\n`);
console.log(remove ? 'Panopticode hooks removed.' : `Panopticode hooks installed: ${command}`);
