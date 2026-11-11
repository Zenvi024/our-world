import { h } from '../lib/dom.js';
import { pixelArt } from '../art/pixel.js';
import {
  ICON_CALENDAR,
  ICON_LETTERS,
  ICON_MAP,
  ICON_EMERALD,
  ICON_CHEST,
  ICON_SIGN,
  ICON_SETTINGS,
} from '../art/sprites.js';

// Nine slots, like a hotbar. Empty slots are saved for later features.
const SLOTS = [
  { route: 'calendar', label: 'Memory Chest', icon: ICON_CALENDAR },
  { route: 'letters', label: 'Letters', icon: ICON_LETTERS },
  { route: 'advancements', label: 'Quests', icon: ICON_MAP },
  { route: 'ledger', label: 'Ledger', icon: ICON_EMERALD },
  { route: 'lists', label: 'Lists', icon: ICON_CHEST },
  { route: 'question', label: 'Question of the Day', icon: ICON_SIGN },
  null,
  null,
  { route: 'settings', label: 'Settings', icon: ICON_SETTINGS },
];

const NAME_MS = 2200;

export function createHotbar() {
  const links = new Map();
  // The name of the selected item floats above the bar for a moment.
  const name = h('p', { class: 'hotbar-name', 'aria-hidden': 'true' });
  let nameTimer = null;

  const nav = h(
    'nav',
    { class: 'hotbar', 'aria-label': 'Main' },
    SLOTS.map((slot) => {
      if (!slot) return h('span', { class: 'slot', 'aria-hidden': 'true' });
      const link = h(
        'a',
        { class: 'slot slot--item', href: `#/${slot.route}`, 'aria-label': slot.label, title: slot.label },
        pixelArt(slot.icon),
      );
      links.set(slot.route, link);
      return link;
    }),
  );

  function setActive(route) {
    for (const [slotRoute, link] of links) {
      if (slotRoute === route) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    }
    const slot = SLOTS.find((item) => item?.route === route);
    name.textContent = slot?.label ?? '';
    name.classList.add('hotbar-name--showing');
    clearTimeout(nameTimer);
    nameTimer = setTimeout(() => name.classList.remove('hotbar-name--showing'), NAME_MS);
  }

  return { el: h('div', { class: 'hotbar-holder' }, name, nav), setActive };
}
