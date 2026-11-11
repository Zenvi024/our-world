import { h } from '../lib/dom.js';
import { pixelArt } from '../art/pixel.js';
import { ICON_HEART, ICON_DRUMSTICK } from '../art/sprites.js';
import { getUserId, loadProfile } from '../session.js';
import { fetchMoods, setMeter, MAX_METER } from '../data/moods.js';
import { loadPartner } from '../data/pokes.js';
import { playClick } from '../lib/sound.js';

const TURN_MS = 6000; // how long each person's meters stay on screen
const HOLD_MS = 15000; // after you set yours, they stay a little longer
const REFRESH_MS = 60000;

// Health and hunger, above the XP bar: hearts on the left, drumsticks on the
// right, and the name of whose they are in the middle. The display takes
// turns between the two of you; tap the name to switch right away. You can
// only set your own.
export function createMeters() {
  const me = getUserId();
  let moods = new Map();
  let people = [{ id: me, name: 'Me' }];
  let showing = 0;
  let turnTimer = null;

  const row = (field, sprite, label) =>
    Array.from({ length: MAX_METER }, (_, i) =>
      h(
        'button',
        { class: 'meter-icon', type: 'button', 'data-quiet': 'true', 'aria-label': `${label}: ${i + 1} of ${MAX_METER}`, onclick: () => choose(field, i + 1) },
        pixelArt(sprite),
      ),
    );
  const hearts = row('hearts', ICON_HEART, 'My hearts');
  const hunger = row('hunger', ICON_DRUMSTICK, 'My hunger');
  const name = h('button', { class: 'meter-name', type: 'button', 'data-quiet': 'true', onclick: () => turn(true) });
  const el = h(
    'div',
    { class: 'meters' },
    h('div', { class: 'meter meter--hearts' }, hearts),
    name,
    h('div', { class: 'meter meter--hunger' }, hunger),
  );

  function paint() {
    const person = people[showing];
    const mine = person.id === me;
    const mood = moods.get(person.id);
    const fill = (icons, value) =>
      icons.forEach((icon, i) => {
        icon.classList.toggle('meter-icon--empty', value == null || i >= value);
        icon.disabled = !mine;
      });
    fill(hearts, mood?.hearts);
    fill(hunger, mood?.hunger);
    name.textContent = person.name;
    name.setAttribute(
      'aria-label',
      `Showing ${person.name}: ${mood?.hearts ?? 'no'} of ${MAX_METER} hearts, ${mood?.hunger ?? 'no'} of ${MAX_METER} hunger. Tap to switch.`,
    );
    el.classList.toggle('meters--theirs', !mine);
  }

  function schedule(delay) {
    clearTimeout(turnTimer);
    if (people.length > 1) turnTimer = setTimeout(() => turn(false), delay);
  }

  function turn(byHand) {
    showing = (showing + 1) % people.length;
    if (byHand) playClick();
    paint();
    schedule(TURN_MS);
  }

  async function choose(field, value) {
    const mood = moods.get(me) ?? { hearts: null, hunger: null };
    // Tapping the icon you are already on takes one away, so zero is reachable.
    const next = mood[field] === value ? value - 1 : value;
    const before = mood[field];
    moods.set(me, { ...mood, [field]: next });
    paint();
    playClick();
    schedule(HOLD_MS);
    try {
      await setMeter(field, next);
    } catch {
      moods.set(me, { ...moods.get(me), [field]: before });
      paint();
    }
  }

  async function load() {
    try {
      const [rows, partner, profile] = await Promise.all([fetchMoods(), loadPartner(), loadProfile()]);
      moods = rows;
      people = [{ id: me, name: profile?.display_name ?? 'Me' }];
      if (partner) people.push(partner);
      showing = Math.min(showing, people.length - 1);
      paint();
      if (!turnTimer) schedule(TURN_MS);
    } catch {
      el.hidden = true; // the meters are not set up yet
    }
  }

  paint();
  load();
  const refresher = setInterval(() => {
    if (!document.hidden) load();
  }, REFRESH_MS);
  // Stop the timers if the bar is ever removed from the page.
  const stop = () => {
    clearTimeout(turnTimer);
    clearInterval(refresher);
  };
  return { el, stop };
}
