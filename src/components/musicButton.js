import { h } from '../lib/dom.js';
import { pixelArt } from '../art/pixel.js';
import { ICON_SPEAKER } from '../art/sprites.js';
import { getMusicLevel, cycleMusicLevel, onMusicChange } from '../lib/sound.js';

const NAMES = ['off', 'soft', 'medium', 'full'];

// One button for the music: each tap steps through off, soft, medium, full.
// The bars beside the speaker show the current volume.
export function createMusicButton() {
  const bars = [1, 2, 3].map((level) => h('span', { class: `music-bar music-bar--${level}` }));
  const button = h(
    'button',
    { class: 'btn music-button', type: 'button', 'data-quiet': 'true', onclick: cycleMusicLevel },
    pixelArt(ICON_SPEAKER),
    h('span', { class: 'music-bars', 'aria-hidden': 'true' }, bars),
  );
  const show = (level) => {
    button.dataset.level = String(level);
    button.setAttribute('aria-label', `Music volume: ${NAMES[level]}. Tap to change.`);
    button.title = `Music: ${NAMES[level]}`;
  };
  show(getMusicLevel());
  const stop = onMusicChange(show);
  return { el: button, stop };
}
