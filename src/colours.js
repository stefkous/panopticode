const PRESETS = [
  { name: 'Violet and teal', todo: '#534ab7', session: '#0f6e56' },
  { name: 'Coral and blue', todo: '#d85a30', session: '#185fa5' },
  { name: 'Pink and green', todo: '#993556', session: '#3b6d11' },
];

const CUBE_LEVELS = [0, 95, 135, 175, 215, 255];
const hex = (...rgb) => `#${rgb.map((v) => v.toString(16).padStart(2, '0')).join('')}`;

/**
 * Standard xterm colours 16-255 (6×6×6 cube, then 24 greys) for xterm.js `extendedAnsi`,
 * with `overrides` mapping a colour number to a replacement hex.
 */
function extendedPalette(overrides) {
  return Array.from({ length: 240 }, (_, i) => {
    const n = i + 16;
    if (overrides[n]) return overrides[n];
    if (n >= 232) return hex(...Array(3).fill(8 + (n - 232) * 10));
    const c = n - 16;
    return hex(CUBE_LEVELS[Math.floor(c / 36)], CUBE_LEVELS[Math.floor(c / 6) % 6], CUBE_LEVELS[c % 6]);
  });
}

// Also loaded as a plain script in the window, where `module` does not exist.
if (typeof module !== 'undefined') module.exports = { PRESETS, extendedPalette };
