import { h, friendlyError, plural } from '../lib/dom.js';
import { pixelArt } from '../art/pixel.js';
import { ICON_COIN, ICON_DRUMSTICK } from '../art/sprites.js';
import { startRoom, itemPreview, manilaHour } from '../art/room.js';
import {
  NEEDS,
  SHOP,
  needLevel,
  petMood,
  petLevel,
  LOVE_PER_LEVEL,
  fetchPet,
  careForPet,
  buyForPet,
  dressPet,
  renamePet,
} from '../data/pet.js';
import { openModal } from '../components/modal.js';
import { lilyLoader } from '../components/loader.js';
import { loadMembers } from '../session.js';
import { onLive } from '../lib/live.js';
import { isNight } from '../lib/theme.js';
import { playDone, playPop } from '../lib/sound.js';

const SAY_MS = 3600;
const PET_GAP_MS = 1500; // taps closer together than this share one trip to the database

const CARE = {
  feed: { label: 'Feed', done: 'Yum!', full: (name) => `${name} is still full.` },
  water: { label: 'Water', done: 'Glug, glug.', full: (name) => `${name} is not thirsty yet.` },
  play: { label: 'Play', done: 'That was fun!', full: (name) => `${name} wants to rest first.` },
  bathe: { label: 'Bathe', done: 'Squeaky clean!', full: (name) => `${name} is still clean.` },
};
const LOW_WORDS = { hunger: 'is hungry', thirst: 'is thirsty', fun: 'is bored', clean: 'needs a bath' };
const REACTIONS = [
  'wiggles its ears.',
  'leans into your hand.',
  'squeaks softly.',
  'does a happy little hop.',
  'closes its eyes, content.',
  'nuzzles your fingers.',
];
const DIARY_WORDS = { feed: 'fed', water: 'gave water to', play: 'played with', bathe: 'bathed' };

// The database explains itself in plain sentences for these.
function petError(error) {
  const message = String(error?.message || '');
  return /pantry|coins|already have|does not sell|own that hat/i.test(message) ? message : friendlyError(error);
}

const diaryTime = (iso) =>
  new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(iso));

const coinTag = (amount) => h('span', { class: 'pet-coins' }, pixelArt(ICON_COIN), String(amount));

// Happybara: the capybara you raise together.
export function createPet() {
  const canvas = h('canvas', {
    class: 'pet-canvas',
    role: 'button',
    tabindex: '0',
    'aria-label': 'Pet Happybara',
    'data-quiet': 'true',
  });
  const nameButton = h('button', { class: 'pet-name', type: 'button', title: 'Rename' }, 'Happybara');
  const level = h('span', { class: 'pet-level' });
  const coins = h('span', { class: 'pet-count' });
  const food = h('span', { class: 'pet-count' });
  const says = h('p', { class: 'pet-says', role: 'status' });
  const loveFill = h('span', { class: 'pet-love-fill' });
  const loveText = h('span', { class: 'pet-love-text' });
  const needsGrid = h('div', { class: 'pet-needs' });
  const body = h('div', { class: 'pet-body', hidden: true });
  const loading = lilyLoader('Waking Happybara…');
  const room = startRoom(canvas);

  let state = null; // { pet, items, log }
  let busy = false;
  let sayTimer = null;
  let lastPetCall = 0;
  const bars = {};
  const buttons = {};

  for (const [need, info] of Object.entries(NEEDS)) {
    const fill = h('span', { class: `pet-bar-fill pet-bar-fill--${need}` });
    const button = h(
      'button',
      { class: 'btn pet-care-button', type: 'button', 'data-quiet': 'true', onclick: () => care(info.action) },
      CARE[info.action].label,
    );
    bars[need] = fill;
    buttons[info.action] = button;
    needsGrid.append(
      h(
        'div',
        { class: 'pet-need' },
        h('span', { class: 'pet-need-label' }, info.label),
        h('span', { class: 'pet-bar', role: 'img' }, fill),
        button,
      ),
    );
  }

  const isAsleep = () => {
    const hour = manilaHour();
    return hour >= 22 || hour < 6;
  };

  function moodLine() {
    const { pet } = state;
    if (isAsleep()) return `${pet.name} is fast asleep. Shh.`;
    const mood = petMood(pet);
    if (mood === 'happy') return `${pet.name} is happy and cozy.`;
    const lowest = Object.keys(NEEDS).sort((a, b) => needLevel(pet, a) - needLevel(pet, b))[0];
    return `${pet.name} ${LOW_WORDS[lowest]}.`;
  }

  function say(message) {
    says.textContent = message;
    clearTimeout(sayTimer);
    sayTimer = setTimeout(() => {
      sayTimer = null;
      if (state) says.textContent = moodLine();
    }, SAY_MS);
  }

  function render() {
    const { pet, items } = state;
    nameButton.textContent = pet.name;
    nameButton.setAttribute('aria-label', `${pet.name}. Tap to rename.`);
    canvas.setAttribute('aria-label', `Pet ${pet.name}`);
    level.textContent = `Level ${petLevel(pet)}`;
    coins.replaceChildren(pixelArt(ICON_COIN), String(pet.coins));
    coins.title = plural(pet.coins, 'coin');
    food.replaceChildren(pixelArt(ICON_DRUMSTICK), String(pet.food));
    food.title = `${plural(pet.food, 'meal')} in the pantry`;
    const intoLevel = pet.love % LOVE_PER_LEVEL;
    loveFill.style.width = `${(intoLevel / LOVE_PER_LEVEL) * 100}%`;
    loveText.textContent = `Love ${intoLevel} of ${LOVE_PER_LEVEL}`;

    for (const need of Object.keys(NEEDS)) {
      const value = needLevel(pet, need);
      bars[need].style.width = `${value}%`;
      bars[need].classList.toggle('pet-bar-fill--low', value < 25);
      bars[need].parentElement.setAttribute('aria-label', `${NEEDS[need].label}: ${Math.round(value)} out of 100`);
    }

    const hour = manilaHour();
    const night = isNight() || hour >= 19 || hour < 6;
    room.update({
      items,
      wearing: pet.wearing,
      mood: petMood(pet),
      hunger: needLevel(pet, 'hunger'),
      thirst: needLevel(pet, 'thirst'),
      asleep: isAsleep(),
      night,
      dusk: !night && (hour >= 17 || hour < 7),
    });
    if (!sayTimer) says.textContent = moodLine();
  }

  async function load() {
    try {
      state = await fetchPet();
      loading.hidden = true;
      body.hidden = false;
      render();
    } catch (error) {
      loading.replaceChildren(h('p', { class: 'status status--error' }, friendlyError(error)));
    }
  }

  async function care(action) {
    if (busy || !state) return;
    busy = true;
    Object.values(buttons).forEach((button) => (button.disabled = true));
    try {
      const earned = await careForPet(action);
      if (earned > 0) {
        room.play(action);
        playDone();
        say(`${CARE[action].done} +${plural(earned, 'coin')}`);
      } else {
        say(CARE[action].full(state.pet.name));
      }
      await load();
    } catch (error) {
      say(petError(error));
    }
    busy = false;
    Object.values(buttons).forEach((button) => (button.disabled = false));
  }

  async function petIt() {
    if (!state) return;
    room.play('pet');
    playPop();
    say(`${state.pet.name} ${REACTIONS[Math.floor(Math.random() * REACTIONS.length)]}`);
    if (Date.now() - lastPetCall < PET_GAP_MS) return;
    lastPetCall = Date.now();
    try {
      const earned = await careForPet('pet');
      state.pet.love += 1;
      state.pet.coins += earned;
      if (earned > 0) say(`${state.pet.name} loved that. +${plural(earned, 'coin')}`);
      render();
    } catch {
      // The cuddle still counted where it matters.
    }
  }

  canvas.addEventListener('click', (event) => {
    if (room.hit(event.clientX, event.clientY)) petIt();
  });
  canvas.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      petIt();
    }
  });

  nameButton.addEventListener('click', () => {
    if (!state) return;
    const input = h('input', { class: 'input', id: 'pet-new-name', maxlength: '20', required: true, value: state.pet.name });
    const error = h('p', { class: 'status status--error', role: 'alert' });
    const modal = openModal(
      { label: 'Rename your pet', className: 'small-panel' },
      h(
        'form',
        {
          onsubmit: async (event) => {
            event.preventDefault();
            const name = input.value.trim();
            if (!name) return;
            try {
              await renamePet(name);
              modal.close();
              await load();
            } catch (problem) {
              error.textContent = friendlyError(problem);
            }
          },
        },
        h('h2', { class: 'panel-title' }, 'A new name'),
        h('div', { class: 'field' }, h('label', { for: 'pet-new-name' }, 'Name (up to 20 letters)'), input),
        error,
        h(
          'div',
          { class: 'button-row' },
          h('button', { class: 'btn', type: 'button', onclick: () => modal.close() }, 'Cancel'),
          h('button', { class: 'btn btn--green', type: 'submit' }, 'Save'),
        ),
      ),
    );
    input.select();
  });

  function openShop() {
    const purse = h('p', { class: 'pet-shop-purse' });
    const status = h('p', { class: 'status', role: 'status' });
    const shelves = h('div', { class: 'pet-shop' });

    const act = async (work, message) => {
      status.classList.remove('status--error');
      try {
        await work();
        playDone();
        status.textContent = message;
        await load();
        draw();
      } catch (error) {
        status.classList.add('status--error');
        status.textContent = petError(error);
      }
    };

    function itemRow(item) {
      const { pet, items } = state;
      const owned = items.has(item.key);
      let button;
      if (item.kind === 'hat' && owned) {
        const wearing = pet.wearing === item.key;
        button = h(
          'button',
          {
            class: 'btn btn--small',
            type: 'button',
            'data-quiet': 'true',
            onclick: () => act(() => dressPet(wearing ? null : item.key), wearing ? 'Hat off.' : `${pet.name} looks wonderful.`),
          },
          wearing ? 'Take off' : 'Wear',
        );
      } else if (owned) {
        button = h('span', { class: 'pet-owned' }, 'In the room');
      } else {
        button = h(
          'button',
          {
            class: 'btn btn--small btn--green pet-buy',
            type: 'button',
            'data-quiet': 'true',
            disabled: pet.coins < item.price,
            'aria-label': `Buy ${item.name} for ${plural(item.price, 'coin')}`,
            onclick: () => act(() => buyForPet(item.key), item.kind === 'food' ? 'Three meals added to the pantry.' : `${item.name}: bought!`),
          },
          coinTag(item.price),
        );
      }
      return h(
        'li',
        { class: 'pet-item' },
        h('span', { class: 'pet-item-frame' }, itemPreview(item.key)),
        h('span', { class: 'pet-item-words' }, h('span', { class: 'pet-item-name' }, item.name), h('span', { class: 'pet-item-about' }, item.about)),
        button,
      );
    }

    function draw() {
      purse.replaceChildren('You have ', coinTag(state.pet.coins), ' and ', h('span', { class: 'pet-coins' }, pixelArt(ICON_DRUMSTICK), String(state.pet.food)), ' in the pantry.');
      const shelf = (title, kind) => [
        h('h3', { class: 'pet-shelf-title' }, title),
        h('ul', { class: 'pet-items' }, SHOP.filter((item) => item.kind === kind).map(itemRow)),
      ];
      shelves.replaceChildren(...shelf('Food', 'food'), ...shelf('For the room', 'furniture'), ...shelf('Hats', 'hat'));
    }

    draw();
    const modal = openModal(
      { label: 'Shop', className: 'pet-shop-panel' },
      h('h2', { class: 'panel-title' }, 'Shop'),
      purse,
      shelves,
      status,
      h('div', { class: 'button-row' }, h('button', { class: 'btn', type: 'button', onclick: () => modal.close() }, 'Done')),
    );
  }

  async function openDiary() {
    const list = h('ul', { class: 'pet-diary' });
    const modal = openModal(
      { label: 'Diary', className: 'small-panel' },
      h('h2', { class: 'panel-title' }, `${state.pet.name}’s diary`),
      list,
      h('div', { class: 'button-row' }, h('button', { class: 'btn', type: 'button', onclick: () => modal.close() }, 'Close')),
    );
    let members = new Map();
    try {
      members = await loadMembers();
    } catch {
      // Names fall back to "Someone".
    }
    const line = (entry) => {
      const who = members.get(entry.user_id)?.name ?? 'Someone';
      if (entry.action.startsWith('buy:')) {
        const item = SHOP.find((thing) => thing.key === entry.action.slice(4));
        return `${who} bought ${item ? item.name.toLowerCase() : 'something'}.`;
      }
      return `${who} ${DIARY_WORDS[entry.action] ?? 'cared for'} ${state.pet.name}.`;
    };
    list.replaceChildren(
      ...(state.log.length
        ? state.log.map((entry) => h('li', null, h('span', { class: 'pet-diary-line' }, line(entry)), h('span', { class: 'pet-diary-time' }, diaryTime(entry.created_at))))
        : [h('li', { class: 'hint' }, 'Nothing yet. Every feeding, bath, and game is written here.')]),
    );
  }

  body.append(
    h(
      'section',
      { class: 'panel pet-home' },
      h('div', { class: 'pet-head' }, nameButton, level, h('span', { class: 'pet-purse' }, coins, food)),
      h('div', { class: 'pet-room' }, canvas),
      says,
      h('div', { class: 'pet-love', title: 'Love grows every time you care for your pet.' }, h('span', { class: 'pet-love-bar' }, loveFill), loveText),
    ),
    h(
      'section',
      { class: 'panel pet-care' },
      needsGrid,
      h(
        'div',
        { class: 'button-row pet-extras' },
        h('button', { class: 'btn', type: 'button', onclick: openShop }, 'Shop'),
        h('button', { class: 'btn', type: 'button', onclick: openDiary }, 'Diary'),
      ),
      h('p', { class: 'hint' }, 'Care earns coins when it is needed. Tap your pet to cuddle it.'),
    ),
  );

  const root = h('div', { class: 'pet-screen' }, loading, body);

  // Needs run down with the clock, and the other person may be caring too.
  const stopLive = onLive('pet', () => {
    if (!busy) load();
  });
  const clock = setInterval(() => {
    if (!root.isConnected) {
      // The screen has been left: put everything away.
      clearInterval(clock);
      clearTimeout(sayTimer);
      stopLive();
      room.stop();
      return;
    }
    if (state) render();
  }, 30_000);

  load();
  return root;
}
