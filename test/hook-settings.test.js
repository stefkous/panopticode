const test = require('node:test');
const assert = require('node:assert/strict');
const { addDeckHooks, removeDeckHooks, HOOK_EVENTS } = require('../src/hook-settings');

const CMD = 'node /x/hooks/panopticode-hook.js';
const userHook = { matcher: 'Bash', hooks: [{ type: 'command', command: 'my-own-hook' }] };

test('add keeps user hooks and is idempotent; remove restores them', () => {
  const original = { model: 'opus', hooks: { PreToolUse: [userHook] } };

  const added = addDeckHooks(addDeckHooks(original, CMD), CMD);

  for (const event of HOOK_EVENTS) {
    const commands = added.hooks[event].flatMap((g) => g.hooks.map((h) => h.command));
    assert.equal(commands.filter((c) => c === CMD).length, 1, event);
  }
  assert.deepEqual(added.hooks.PreToolUse[0], userHook);
  assert.equal(added.model, 'opus');

  assert.deepEqual(removeDeckHooks(added), original);
});

test('remove also clears hooks installed under the old name', () => {
  const legacy = { hooks: { Stop: [{ hooks: [{ type: 'command', command: 'node /x/hooks/deck-hook.js' }] }] } };
  assert.deepEqual(removeDeckHooks(legacy), {});
});
