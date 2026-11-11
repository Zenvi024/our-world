import { h } from '../lib/dom.js';
import { pixelArt } from '../art/pixel.js';
import { ICON_HEART } from '../art/sprites.js';
import { getUserId } from '../session.js';
import { setHeart } from '../data/hearts.js';
import { playDone } from '../lib/sound.js';

// A heart you can tap to react. Shows how many of you have hearted the thing.
//   kind: 'goal' or 'letter'; who: the list of member ids who already hearted it
export function createHeartButton(kind, id, who = []) {
  let people = [...who];
  const count = h('span', { class: 'heart-count' });
  const button = h(
    'button',
    { class: 'heart-button', type: 'button', 'data-quiet': 'true' },
    pixelArt(ICON_HEART),
    count,
  );

  function show() {
    const mine = people.includes(getUserId());
    button.classList.toggle('heart-button--on', mine);
    button.setAttribute('aria-pressed', String(mine));
    button.setAttribute('aria-label', mine ? 'Take back your heart' : 'Give this a heart');
    count.textContent = people.length ? String(people.length) : '';
  }

  button.addEventListener('click', async (event) => {
    event.stopPropagation();
    const me = getUserId();
    const turnOn = !people.includes(me);
    const before = people;
    people = turnOn ? [...people, me] : people.filter((person) => person !== me);
    show();
    if (turnOn) playDone();
    try {
      await setHeart(kind, id, turnOn);
    } catch {
      people = before; // put it back if it could not be saved
      show();
    }
  });

  show();
  return button;
}
