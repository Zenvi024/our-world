import { h } from '../lib/dom.js';
import { pixelArt } from '../art/pixel.js';
import { ICON_HEART, ICON_CAT_HAPPY, ICON_CAT_ANGRY } from '../art/sprites.js';
import { getUserId, loadMembers } from '../session.js';
import { onLive } from '../lib/live.js';
import { avatarArt } from './avatar.js';
import { fetchMoods, setMeter, MAX_METER, isAsleep } from '../data/moods.js';
import { playClick } from '../lib/sound.js';

const TURN_MS = 6000; // how long each person's meters stay on screen
const HOLD_MS = 15000; // after you set yours, they stay a little longer
const REFRESH_MS = 60000;

// Hearts and cats, above the XP bar: hearts on the left (how you feel), five
// cats on the right (how annoyed you are: happy cats turn into angry red
// ones), and the name of whose they are in the middle. The display takes
// turns between the two of you; tap the name to switch right away. You can
// only set your own.
export function createMeters({ onLowHearts } = {}) {
  const me = getUserId();
  let moods = new Map();
  let people = [{ id: me, name: 'Me' }];
  let showing = 0;
  let turnTimer = null;

  const hearts = Array.from({ length: MAX_METER }, (_, i) =>
    h(
      'button',
      { class: 'meter-icon', type: 'button', 'data-quiet': 'true', 'aria-label': `My hearts: ${i + 1} of ${MAX_METER}`, onclick: () => choose('hearts', i + 1) },
      pixelArt(ICON_HEART),
    ),
  );
  // Each cat has two faces; the angry one shows when it is counted.
  const cats = Array.from({ length: MAX_METER }, (_, i) =>
    h(
      'button',
      { class: 'meter-icon meter-cat', type: 'button', 'data-quiet': 'true', 'aria-label': `Angry cats: ${i + 1} of ${MAX_METER}`, onclick: () => choose('angry', i + 1) },
      h('span', { class: 'cat-happy' }, pixelArt(ICON_CAT_HAPPY)),
      h('span', { class: 'cat-angry' }, pixelArt(ICON_CAT_ANGRY)),
    ),
  );
  const nameText = h('span');
  const face = h('span', { class: 'meter-face' });
  const name = h('button', { class: 'meter-name', type: 'button', 'data-quiet': 'true', onclick: () => turn(true) }, face, nameText);
  const el = h(
    'div',
    { class: 'meters' },
    h('div', { class: 'meter meter--hearts' }, hearts),
    name,
    h('div', { class: 'meter meter--cats' }, cats),
  );

  function paint() {
    const person = people[showing];
    const mine = person.id === me;
    const mood = moods.get(person.id);
    hearts.forEach((icon, i) => {
      icon.classList.toggle('meter-icon--empty', mood?.hearts == null || i >= mood.hearts);
      icon.disabled = !mine;
    });
    const angry = mood?.angry ?? 0;
    cats.forEach((cat, i) => {
      cat.classList.toggle('meter-cat--angry', i < angry);
      cat.disabled = !mine;
    });
    const asleep = isAsleep(mood);
    nameText.textContent = asleep ? `${person.name} zZ` : person.name;
    face.replaceChildren(avatarArt(person.avatar));
    name.setAttribute(
      'aria-label',
      `Showing ${person.name}${asleep ? ', asleep' : ''}: ${mood?.hearts ?? 'no'} of ${MAX_METER} hearts, ${angry} of ${MAX_METER} angry cats. Tap to switch.`,
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
    const mood = moods.get(me) ?? { hearts: null, angry: 0 };
    // Tapping the icon you are already on takes one away, so zero is reachable.
    const next = mood[field] === value ? value - 1 : value;
    const before = mood[field];
    moods.set(me, { ...mood, [field]: next });
    paint();
    playClick();
    schedule(HOLD_MS);
    try {
      await setMeter(field, next);
      if (field === 'hearts' && next <= 2) onLowHearts?.();
    } catch {
      moods.set(me, { ...moods.get(me), [field]: before });
      paint();
    }
  }

  async function load() {
    try {
      const [rows, members] = await Promise.all([fetchMoods(), loadMembers()]);
      moods = rows;
      people = [...members].map(([id, member]) => ({ id, ...member })).sort((a, b) => Number(b.id === me) - Number(a.id === me));
      if (!people.length) people = [{ id: me, name: 'Me' }];
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
  const stopLive = onLive('moods', load);
  // Stop the timers if the bar is ever removed from the page.
  const stop = () => {
    clearTimeout(turnTimer);
    clearInterval(refresher);
    stopLive();
  };
  return { el, stop };
}
