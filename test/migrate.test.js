const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { migrate } = require('../src/migrate');

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'panopticode-'));

test('copies an old folder to a new location and keeps the original', () => {
  const root = tmp();
  const from = path.join(root, 'old', 'todos');
  const to = path.join(root, 'new', 'todos');
  fs.mkdirSync(from, { recursive: true });
  fs.writeFileSync(path.join(from, '2026-11-06.json'), '{"items":[]}');

  assert.equal(migrate(from, to), true);
  assert.equal(fs.readFileSync(path.join(to, '2026-11-06.json'), 'utf8'), '{"items":[]}');
  assert.ok(fs.existsSync(path.join(from, '2026-11-06.json')));
});

test('never overwrites existing data and skips a missing source', () => {
  const root = tmp();
  const from = path.join(root, 'old.json');
  const to = path.join(root, 'new.json');
  fs.writeFileSync(from, 'old');
  fs.writeFileSync(to, 'new');

  assert.equal(migrate(from, to), false);
  assert.equal(fs.readFileSync(to, 'utf8'), 'new');
  assert.equal(migrate(path.join(root, 'nope'), path.join(root, 'x')), false);
});
