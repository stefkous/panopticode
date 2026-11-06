const test = require('node:test');
const assert = require('node:assert/strict');
const { extendedPalette, PRESETS } = require('../src/colours');

test('xterm 256-colour palette for 16-255, with per-colour overrides', () => {
  const palette = extendedPalette({ 153: '#1f5fbf' });

  assert.equal(palette.length, 240);
  assert.equal(extendedPalette({})[153 - 16], '#afd7ff');
  assert.equal(palette[153 - 16], '#1f5fbf');
  assert.equal(palette[231 - 16], '#ffffff');
  assert.equal(palette[232 - 16], '#080808');
  assert.equal(palette[255 - 16], '#eeeeee');
});

test('presets start with violet and teal', () => {
  assert.deepEqual(PRESETS[0], { name: 'Violet and teal', todo: '#534ab7', session: '#0f6e56' });
});
