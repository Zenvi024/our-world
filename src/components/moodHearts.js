import { h } from '../lib/dom.js';
import { pixelArt } from '../art/pixel.js';
import { ICON_HEART } from '../art/sprites.js';
import { getUserId } from '../session.js';
import { fetchMoods, setMood, MAX_HEARTS } from '../data/moods.js';
import { loadPartner } from '../data/pokes.js';
import { playClick } from '../lib/sound.js';

// The mood hearts under the screen title: yours on the left (tap to set how
// you are feeling), your partner's on the right.
export function createMoodHearts() {
  const mine = Array.from({ length: MAX_HEARTS }, (_, i) =>
    h(
      'button',
      {
        class: 'mood-heart',
        type: 'button',
        'data-quiet': 'true',
        'aria-label': `I am feeling ${i + 1} of ${MAX_HEARTS} hearts`,
        onclick: () => choose(i + 1),
      },
      pixelArt(ICON_HEART),
    ),
  );
  const theirs = Array.from({ length: MAX_HEARTS }, () => h('span', { class: 'mood-heart' }, pixelArt(ICON_HEART)));
  const theirName = h('span', { class: 'mood-name' });
  const theirSide = h('div', { class: 'mood-side mood-side--theirs', hidden: true }, theirName, theirs);
  const el = h(
    'div',
    { class: 'mood-row' },
    h('div', { class: 'mood-side', role: 'group', 'aria-label': 'How I am feeling' }, h('span', { class: 'mood-name' }, 'Me'), mine),
    theirSide,
  );
  let myHearts = null;

  const paint = (hearts, value) =>
    hearts.forEach((heart, i) => heart.classList.toggle('mood-heart--empty', value === null || i >= value));

  async function choose(value) {
    // Tapping the heart you are already on takes one away, so zero is reachable.
    const next = value === myHearts ? value - 1 : value;
    const before = myHearts;
    myHearts = next;
    paint(mine, myHearts);
    playClick();
    try {
      await setMood(next);
    } catch {
      myHearts = before;
      paint(mine, myHearts);
    }
  }

  async function load() {
    try {
      const [moods, partner] = await Promise.all([fetchMoods(), loadPartner()]);
      myHearts = moods.get(getUserId())?.hearts ?? null;
      paint(mine, myHearts);
      if (partner) {
        const mood = moods.get(partner.id);
        theirName.textContent = partner.name;
        theirSide.hidden = false;
        theirSide.setAttribute(
          'aria-label',
          mood ? `${partner.name} is feeling ${mood.hearts} of ${MAX_HEARTS} hearts` : `${partner.name} has not set a mood yet`,
        );
        paint(theirs, mood?.hearts ?? null);
      }
    } catch {
      el.hidden = true; // moods are not set up yet
    }
  }

  paint(mine, null);
  load();
  return { el, refresh: load };
}
