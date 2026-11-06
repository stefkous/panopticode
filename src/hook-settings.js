const { STATE_BY_EVENT } = require('./status');

const HOOK_EVENTS = Object.keys(STATE_BY_EVENT);
// The second marker removes hooks installed under the app's old name, Claude Deck.
const MARKERS = ['panopticode-hook.js', 'deck-hook.js'];

const isDeckGroup = (group) => group.hooks?.some((h) => MARKERS.some((m) => h.command?.includes(m)));

/** Return a copy of Claude settings with the deck hook added to every status event, once. */
function addDeckHooks(settings, command) {
  const hooks = { ...removeDeckHooks(settings).hooks };
  for (const event of HOOK_EVENTS) {
    hooks[event] = [...(hooks[event] ?? []), { hooks: [{ type: 'command', command }] }];
  }
  return { ...settings, hooks };
}

/** Return a copy of Claude settings with every deck hook removed and empty keys dropped. */
function removeDeckHooks(settings) {
  const { hooks: current, ...rest } = settings;
  const hooks = Object.fromEntries(
    Object.entries(current ?? {})
      .map(([event, groups]) => [event, groups.filter((g) => !isDeckGroup(g))])
      .filter(([, groups]) => groups.length > 0),
  );
  return Object.keys(hooks).length ? { ...rest, hooks } : rest;
}

module.exports = { addDeckHooks, removeDeckHooks, HOOK_EVENTS };
