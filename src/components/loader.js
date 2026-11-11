import { h } from '../lib/dom.js';
import { pixelArt } from '../art/pixel.js';
import { LILY } from '../art/sprites.js';

// A swaying lily of the valley with a line of text, shown while things load.
export function lilyLoader(text = 'Loading…') {
  return h('div', { class: 'loader', role: 'status' }, pixelArt(LILY, 'loader-lily'), h('p', null, text));
}
