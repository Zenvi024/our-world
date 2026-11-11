import { h, friendlyError, plural } from '../lib/dom.js';
import { pixelArt } from '../art/pixel.js';
import { ICON_COIN, ICON_DRUMSTICK } from '../art/sprites.js';
import { startRoom, itemPreview } from '../art/room.js';
import { ROOMS } from '../art/rooms.js';
import {
  NEEDS,
  CARE_COINS,
  ROOM_NAMES,
  ROOM_TABS,
  LOVE_PER_LEVEL,
  FOCUS_MS,
  FOCUS_MINUTES,
  needLevel,
  petMood,
  petLevel,
  itemName,
  fetchPet,
  careForPet,
  buyForPet,
  dressPet,
  styleRoom,
  renamePet,
  dailyGift,
  startFocus,
  cancelFocus,
  finishFocus,
} from '../data/pet.js';
import { openModal, confirmDialog } from '../components/modal.js';
import { lilyLoader } from '../components/loader.js';
import { getUserId, loadMembers } from '../session.js';
import { onLive } from '../lib/live.js';
import { isNight } from '../lib/theme.js';
import { manilaHour, todayManila } from '../lib/dates.js';
import { playDone, playPop, playAdvancement } from '../lib/sound.js';
import { systemNotify } from '../lib/notify.js';

const SAY_MS = 3600;
const PET_GAP_MS = 1500; // taps closer together than this share one trip to the database
const ROOM_KEY = 'our-world.pet-room';

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
// Tricks are learned as the pet grows up.
const TRICKS = [
  { trick: 'hop', level: 1 },
  { trick: 'jump', level: 3, says: 'jumps for joy!' },
  { trick: 'wiggle', level: 6, says: 'does a wiggle dance!' },
  { trick: 'hearts', level: 10, says: 'is bursting with love!' },
  { trick: 'sparkle', level: 15, says: 'sparkles with happiness!' },
];
const DIARY_WORDS = { feed: 'fed', water: 'gave water to', play: 'played with', bathe: 'bathed' };
const SHOP_TABS = [
  ['food', 'Food'],
  ['rooms', 'Rooms'],
  ['furniture', 'Decor'],
  ['decor', 'Walls'],
  ['outfits', 'Outfits'],
];

// The database explains itself in plain sentences for these.
function petError(error) {
  const message = String(error?.message || '');
  return /pantry|coins|already have|does not sell|does not own|level \d|Unlock that room|do not have that|cannot be decorated|timer has not/i.test(message)
    ? message
    : friendlyError(error);
}

const diaryTime = (iso) =>
  new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(iso));
const manilaDay = (iso) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(new Date(iso));

const coinTag = (amount) => h('span', { class: 'pet-coins' }, pixelArt(ICON_COIN), String(amount));
const clock = (ms) => {
  const seconds = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
};

// Happybara: the capybara you raise together.
export function createPet() {
  const me = getUserId();
  const canvas = h('canvas', { class: 'pet-canvas', role: 'button', tabindex: '0', 'aria-label': 'Pet Happybara', 'data-quiet': 'true' });
  const nameButton = h('button', { class: 'pet-name', type: 'button', title: 'Rename' }, 'Happybara');
  const level = h('span', { class: 'pet-level' });
  const coins = h('span', { class: 'pet-count' });
  const food = h('span', { class: 'pet-count' });
  const says = h('p', { class: 'pet-says', role: 'status' });
  const loveFill = h('span', { class: 'pet-love-fill' });
  const loveText = h('span', { class: 'pet-love-text' });
  const tabs = h('div', { class: 'pet-tabs', role: 'tablist', 'aria-label': 'Rooms' });
  const needsGrid = h('div', { class: 'pet-needs' });
  const focusTime = h('p', { class: 'focus-time', role: 'timer' }, clock(FOCUS_MS));
  const focusNote = h('p', { class: 'focus-note' });
  const focusButton = h('button', { class: 'btn btn--green focus-button', type: 'button', 'data-quiet': 'true' }, 'Start focusing');
  const body = h('div', { class: 'pet-body', hidden: true });
  const loading = lilyLoader('Waking Happybara…');
  const room = startRoom(canvas);

  let state = null; // see fetchPet()
  let members = new Map();
  let view = 'living';
  try {
    view = sessionStorage.getItem(ROOM_KEY) || 'living';
  } catch {
    // The living room it is.
  }
  let busy = false;
  let finishing = false;
  let retryAt = 0;
  let sayTimer = null;
  let lastPetCall = 0;
  const bars = {};
  const buttons = {};

  for (const [need, info] of Object.entries(NEEDS)) {
    const fill = h('span', { class: `pet-bar-fill pet-bar-fill--${need}` });
    const button = h('button', { class: 'btn pet-care-button', type: 'button', 'data-quiet': 'true', onclick: () => care(info.action) }, CARE[info.action].label);
    bars[need] = fill;
    buttons[info.action] = button;
    needsGrid.append(h('div', { class: 'pet-need' }, h('span', { class: 'pet-need-label' }, info.label), h('span', { class: 'pet-bar', role: 'img' }, fill), button));
  }

  const isAsleep = () => {
    const hour = manilaHour();
    return hour >= 22 || hour < 6;
  };
  const unlocked = (key) => key === 'living' || state.items.has(`room_${key}`);
  const partnerName = () => [...members].find(([id]) => id !== me)?.[1].name ?? 'Your partner';

  function moodLine() {
    const { pet } = state;
    if (state.focus.has(me)) return `${pet.name} is studying with you.`;
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

  function goTo(key) {
    view = key;
    try {
      sessionStorage.setItem(ROOM_KEY, key);
    } catch {
      // Not remembered, which is fine.
    }
    render();
  }

  function renderTabs() {
    const item = (key) => state.shop.find((thing) => thing.key === `room_${key}`);
    tabs.replaceChildren(
      ...ROOMS.map((key) => {
        const open = unlocked(key);
        return h(
          'button',
          {
            class: `pet-tab${open ? '' : ' pet-tab--locked'}`,
            type: 'button',
            role: 'tab',
            'aria-selected': String(view === key),
            'aria-label': open ? ROOM_NAMES[key] : `${ROOM_NAMES[key]} (locked)`,
            onclick: () => {
              if (open) goTo(key);
              else {
                const price = item(key);
                say(price ? `The ${ROOM_NAMES[key].toLowerCase()} opens at level ${price.minLevel} for ${plural(price.price, 'coin')}.` : 'That room is still locked.');
              }
            },
          },
          ROOM_TABS[key],
        );
      }),
    );
  }

  function render() {
    const { pet, items } = state;
    if (!unlocked(view)) view = 'living';
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

    renderTabs();
    const hour = manilaHour();
    const night = isNight() || hour >= 19 || hour < 6;
    room.update({
      room: view,
      items,
      style: state.styles.get(view) ?? null,
      wearing: pet.wearing,
      accessory: pet.accessory,
      mood: petMood(pet),
      hunger: needLevel(pet, 'hunger'),
      thirst: needLevel(pet, 'thirst'),
      bowls: view === (unlocked('kitchen') ? 'kitchen' : 'living'),
      asleep: isAsleep() && !state.focus.has(me),
      focusing: state.focus.has(me),
      night,
      dusk: !night && (hour >= 17 || hour < 7),
    });
    if (!sayTimer) says.textContent = moodLine();
    renderFocus();
  }

  async function load() {
    try {
      [state, members] = await Promise.all([fetchPet(), loadMembers().catch(() => members)]);
      loading.hidden = true;
      body.hidden = false;
      render();
      return true;
    } catch (error) {
      loading.hidden = false;
      loading.replaceChildren(h('p', { class: 'status status--error' }, friendlyError(error)));
      return false;
    }
  }

  // ---------- Care ----------
  async function care(action) {
    if (busy || !state) return;
    busy = true;
    Object.values(buttons).forEach((button) => (button.disabled = true));
    try {
      const earned = await careForPet(action);
      if (earned > 0) {
        // The pet goes where the thing happens, if that room is open.
        const place = { feed: 'kitchen', water: 'kitchen', bathe: 'bathroom', play: 'garden' }[action];
        if (unlocked(place) && (action !== 'bathe' || state.items.has('tub'))) view = place;
        else if ((action === 'feed' || action === 'water') && !unlocked('kitchen')) view = 'living';
        await load();
        room.play(action);
        playDone();
        const bonus = earned > CARE_COINS[action];
        say(`${bonus ? 'Teamwork bonus! ' : CARE[action].done + ' '}+${plural(earned, 'coin')}`);
      } else {
        say(CARE[action].full(state.pet.name));
        await load();
      }
    } catch (error) {
      say(petError(error));
    }
    busy = false;
    Object.values(buttons).forEach((button) => (button.disabled = false));
  }

  async function petIt() {
    if (!state) return;
    const known = TRICKS.filter((trick) => trick.level <= petLevel(state.pet));
    const trick = Math.random() < 0.55 ? known[0] : known[Math.floor(Math.random() * known.length)];
    room.play('pet', { trick: trick.trick });
    playPop();
    say(`${state.pet.name} ${trick.says ?? REACTIONS[Math.floor(Math.random() * REACTIONS.length)]}`);
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

  // ---------- The shop ----------
  function openShop(startTab = 'food') {
    let tab = startTab;
    let treat = null;
    const purse = h('p', { class: 'pet-shop-purse' });
    const status = h('p', { class: 'status', role: 'status' });
    const shelves = h('div', { class: 'pet-shop' });
    const tabRow = h('div', { class: 'pet-tabs pet-tabs--shop', role: 'tablist', 'aria-label': 'Shop sections' });

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
    const small = (label, onclick, extra = {}) => h('button', { class: 'btn btn--small', type: 'button', 'data-quiet': 'true', onclick, ...extra }, label);

    function buyButton(item, message) {
      const { pet } = state;
      if (petLevel(pet) < item.minLevel) return h('span', { class: 'pet-locked' }, `Level ${item.minLevel}`);
      return h(
        'button',
        {
          class: 'btn btn--small btn--green pet-buy',
          type: 'button',
          'data-quiet': 'true',
          disabled: pet.coins < item.price,
          'aria-label': `Buy ${item.name} for ${plural(item.price, 'coin')}`,
          onclick: () => act(() => buyForPet(item.key), message),
        },
        coinTag(item.price),
      );
    }

    function action(item) {
      const { pet, items } = state;
      const owned = items.has(item.key);
      if (item.kind === 'food') return buyButton(item, `${plural(item.amount, 'meal')} added to the pantry.`);
      if (item.kind === 'treat') {
        const button = buyButton(item, `${pet.name} loved it! +${item.amount} love`);
        // The treat is shown being eaten once the shop is closed.
        button.addEventListener('click', () => {
          treat = item.key;
        });
        return button;
      }
      if (!owned) {
        if (item.kind === 'furniture' && !unlocked(item.room)) return h('span', { class: 'pet-locked' }, 'Room locked');
        return buyButton(item, item.kind === 'room' ? `The ${item.name.toLowerCase()} is open!` : `${item.name}: yours!`);
      }
      if (item.kind === 'hat' || item.kind === 'accessory') {
        const on = (item.kind === 'hat' ? pet.wearing : pet.accessory) === item.key;
        return small(on ? 'Take off' : 'Wear', () => act(() => dressPet(item.kind, on ? null : item.key), on ? 'Off it comes.' : `${pet.name} looks wonderful.`));
      }
      if (item.kind === 'wall' || item.kind === 'floor') return useHere(item.kind, item.key);
      return h('span', { class: 'pet-owned' }, item.kind === 'room' ? 'Open' : 'In the house');
    }

    // Wallpaper and floors go in the room you are standing in.
    function useHere(kind, key) {
      if (view === 'garden') return h('span', { class: 'pet-locked' }, 'Indoors only');
      const style = state.styles.get(view) ?? { wall: null, floor: null };
      if ((style[kind] ?? null) === key) return h('span', { class: 'pet-owned' }, 'In use here');
      const next = { ...style, [kind]: key };
      return small('Use here', () => act(() => styleRoom(view, next.wall, next.floor), `The ${ROOM_NAMES[view].toLowerCase()} looks new.`));
    }

    const row = (item) =>
      h(
        'li',
        { class: 'pet-item' },
        h('span', { class: 'pet-item-frame' }, itemPreview(item)),
        h('span', { class: 'pet-item-words' }, h('span', { class: 'pet-item-name' }, item.name), h('span', { class: 'pet-item-about' }, item.about)),
        action(item),
      );
    const shelf = (title, items, note) => [
      h('h3', { class: 'pet-shelf-title' }, title),
      note && h('p', { class: 'hint' }, note),
      h('ul', { class: 'pet-items' }, items.map(row)),
    ];
    const ofKind = (kind) => state.shop.filter((item) => item.kind === kind);
    const plain = (kind, name, key) =>
      h(
        'li',
        { class: 'pet-item' },
        h('span', { class: 'pet-item-frame' }, itemPreview({ key, kind })),
        h('span', { class: 'pet-item-words' }, h('span', { class: 'pet-item-name' }, name), h('span', { class: 'pet-item-about' }, 'How the room came.')),
        useHere(kind, null),
      );

    function draw() {
      purse.replaceChildren('You have ', coinTag(state.pet.coins), ' and ', h('span', { class: 'pet-coins' }, pixelArt(ICON_DRUMSTICK), String(state.pet.food)), ' in the pantry.');
      tabRow.replaceChildren(
        ...SHOP_TABS.map(([key, label]) =>
          h(
            'button',
            {
              class: 'pet-tab',
              type: 'button',
              role: 'tab',
              'aria-selected': String(tab === key),
              onclick: () => {
                tab = key;
                status.textContent = '';
                draw();
                shelves.scrollTop = 0;
              },
            },
            label,
          ),
        ),
      );
      let parts = [];
      if (tab === 'food') {
        parts = [...shelf('Meals', ofKind('food')), ...shelf('Treats', ofKind('treat'), 'Treats are eaten right away and fill the heart, not the tummy.')];
      } else if (tab === 'rooms') {
        parts = shelf('More of the house', ofKind('room'), 'New rooms open as your pet grows up.');
      } else if (tab === 'furniture') {
        parts = ROOMS.flatMap((key) =>
          shelf(ROOM_NAMES[key], state.shop.filter((item) => item.kind === 'furniture' && item.room === key), unlocked(key) ? null : 'Open this room first.'),
        );
      } else if (tab === 'decor') {
        const here = view === 'garden' ? 'The garden has no walls to paper.' : `These go in the room you are in: the ${ROOM_NAMES[view].toLowerCase()}.`;
        const plainWall = view === 'garden' ? [] : [plain('wall', 'Plain wall', view)];
        const plainFloor = view === 'garden' ? [] : [plain('floor', 'Plain floor', view === 'bathroom' ? 'bathroom' : 'wood')];
        parts = [
          h('h3', { class: 'pet-shelf-title' }, 'Wallpaper'),
          h('p', { class: 'hint' }, here),
          h('ul', { class: 'pet-items' }, plainWall, ofKind('wall').map(row)),
          h('h3', { class: 'pet-shelf-title' }, 'Floors'),
          h('ul', { class: 'pet-items' }, plainFloor, ofKind('floor').map(row)),
        ];
      } else {
        parts = [...shelf('Hats', ofKind('hat')), ...shelf('Accessories', ofKind('accessory'))];
      }
      shelves.replaceChildren(...parts.flat().filter(Boolean));
    }

    draw();
    const modal = openModal(
      {
        label: 'Shop',
        className: 'pet-shop-panel',
        onClose: () => {
          if (treat) room.play('treat', { treat });
        },
      },
      h('h2', { class: 'panel-title' }, 'Shop'),
      purse,
      tabRow,
      shelves,
      status,
      h('div', { class: 'button-row' }, h('button', { class: 'btn', type: 'button', onclick: () => modal.close() }, 'Done')),
    );
  }

  // ---------- The diary ----------
  function openDiary() {
    const { pet } = state;
    const line = (entry) => {
      const who = members.get(entry.user_id)?.name ?? 'Someone';
      const action = entry.action;
      if (action === 'teamwork') return `Teamwork bonus! You both cared for ${pet.name}.`;
      if (action === 'focus') return `${who} focused for ${FOCUS_MINUTES} minutes.`;
      if (action.startsWith('buy:')) {
        const key = action.slice(4);
        if (key.startsWith('treat_')) return `${who} gave ${pet.name} a treat: ${itemName(key).toLowerCase()}.`;
        if (key.startsWith('room_')) return `${who} opened the ${itemName(key).toLowerCase()}.`;
        return `${who} bought: ${itemName(key).toLowerCase()}.`;
      }
      return `${who} ${DIARY_WORDS[action] ?? 'cared for'} ${pet.name}.`;
    };
    const entries = state.log.filter((entry) => !['daily', 'focus_extra'].includes(entry.action)).slice(0, 20);
    const modal = openModal(
      { label: 'Diary', className: 'small-panel' },
      h('h2', { class: 'panel-title' }, `${pet.name}’s diary`),
      h(
        'ul',
        { class: 'pet-diary' },
        entries.length
          ? entries.map((entry) => h('li', null, h('span', { class: 'pet-diary-line' }, line(entry)), h('span', { class: 'pet-diary-time' }, diaryTime(entry.created_at))))
          : h('li', { class: 'hint' }, 'Nothing yet. Every feeding, bath, and game is written here.'),
      ),
      h('div', { class: 'button-row' }, h('button', { class: 'btn', type: 'button', onclick: () => modal.close() }, 'Close')),
    );
  }

  // ---------- The focus timer ----------
  const remaining = (startedAt) => FOCUS_MS - (Date.now() - new Date(startedAt).getTime());

  function renderFocus() {
    if (!state) return;
    const mine = state.focus.get(me);
    const today = todayManila();
    const done = state.log.filter((entry) => entry.user_id === me && entry.action === 'focus' && manilaDay(entry.created_at) === today).length;
    focusTime.textContent = mine ? clock(remaining(mine)) : clock(FOCUS_MS);
    focusTime.classList.toggle('focus-time--running', Boolean(mine));
    focusButton.textContent = mine ? 'Give up' : 'Start focusing';
    focusButton.classList.toggle('btn--green', !mine);

    const theirs = [...state.focus].find(([id]) => id !== me);
    const notes = [];
    if (theirs) {
      const left = Math.ceil(remaining(theirs[1]) / 60_000);
      notes.push(left > 0 ? `${partnerName()} is focusing: ${plural(left, 'minute')} left.` : `${partnerName()} is finishing a session.`);
    }
    notes.push(done >= 6 ? 'All six paid sessions done today. Well done!' : `Sessions today: ${done} of 6.`);
    focusNote.textContent = notes.join(' ');
  }

  async function completeFocus() {
    if (finishing || Date.now() < retryAt) return;
    finishing = true;
    try {
      const earned = await finishFocus();
      playAdvancement();
      const message = earned > 0 ? `Focus complete! +${plural(earned, 'coin')}` : 'Focus complete! Today’s coins are all earned.';
      say(`${message} Take a five-minute break.`);
      systemNotify('Focus complete!', earned > 0 ? `+${plural(earned, 'coin')} for ${state.pet.name}. Time for a break.` : 'Time for a break.');
      await load();
    } catch (error) {
      // The database's clock may be a few seconds behind this one: try again soon.
      if (/not finished/i.test(error?.message || '')) retryAt = Date.now() + 10_000;
      else await load();
    }
    finishing = false;
  }

  focusButton.addEventListener('click', async () => {
    if (!state) return;
    focusButton.disabled = true;
    try {
      if (state.focus.has(me)) {
        if (await confirmDialog({ message: 'Give up this focus session? It will not earn coins.', confirmLabel: 'Give up', danger: true })) {
          await cancelFocus();
          say('No worries. Try again when you are ready.');
        }
      } else {
        await startFocus();
        playDone();
        say(`${FOCUS_MINUTES} minutes. ${state.pet.name} is studying with you!`);
      }
      await load();
    } catch (error) {
      say(petError(error));
    }
    focusButton.disabled = false;
  });

  body.append(
    h(
      'section',
      { class: 'panel pet-home' },
      h('div', { class: 'pet-head' }, nameButton, level, h('span', { class: 'pet-purse' }, coins, food)),
      tabs,
      h('div', { class: 'pet-room' }, canvas),
      says,
      h('div', { class: 'pet-love', title: 'Love grows every time you care for your pet.' }, h('span', { class: 'pet-love-bar' }, loveFill), loveText),
    ),
    h(
      'div',
      { class: 'pet-side' },
      h(
        'section',
        { class: 'panel pet-care' },
        needsGrid,
        h(
          'div',
          { class: 'button-row pet-extras' },
          h('button', { class: 'btn', type: 'button', onclick: () => openShop() }, 'Shop'),
          h('button', { class: 'btn', type: 'button', onclick: openDiary }, 'Diary'),
        ),
        h('p', { class: 'hint' }, 'Care earns coins when it is needed. Tap your pet to cuddle it.'),
      ),
      h(
        'section',
        { class: 'panel pet-focus' },
        h('h2', { class: 'panel-title' }, 'Focus timer'),
        h('div', { class: 'focus-row' }, focusTime, focusButton),
        focusNote,
        h('p', { class: 'hint' }, `Focus for ${FOCUS_MINUTES} minutes and earn 8 coins, up to six times a day each. The timer keeps going if you close the site.`),
      ),
    ),
  );

  const root = h('div', { class: 'pet-screen' }, loading, body);

  // Needs run down with the clock, and the other person may be caring too.
  const stopLive = onLive('pet', () => {
    if (!busy) load();
  });
  let seconds = 0;
  const ticker = setInterval(() => {
    if (!root.isConnected) {
      // The screen has been left: put everything away.
      clearInterval(ticker);
      clearTimeout(sayTimer);
      stopLive();
      room.stop();
      return;
    }
    if (!state) return;
    seconds += 1;
    const mine = state.focus.get(me);
    if (mine && remaining(mine) <= 0) completeFocus();
    // Every half minute the pet is fetched afresh, in case live updates are off.
    if (seconds % 30 === 0 && !busy && !document.hidden) load();
    else renderFocus();
  }, 1000);

  load().then(async (ok) => {
    if (!ok) return;
    // At night the pet is found in its bedroom.
    if (isAsleep() && unlocked('bedroom')) goTo('bedroom');
    try {
      const gift = await dailyGift();
      if (gift > 0) {
        say(`A daily gift! +${plural(gift, 'coin')}`);
        await load();
      }
    } catch {
      // No gift today.
    }
  });
  return root;
}
