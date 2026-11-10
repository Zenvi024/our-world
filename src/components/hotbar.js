import { h } from '../lib/dom.js';
import { pixelArt } from '../art/pixel.js';
import {
  ICON_CALENDAR,
  ICON_LETTERS,
  ICON_ADVANCEMENTS,
  ICON_SETTINGS,
  ICON_COIN,
} from '../art/sprites.js';

// Nine slots, like a hotbar. Empty slots are saved for later features.
const SLOTS = [
  { route: 'calendar', label: 'Calendar', icon: ICON_CALENDAR },
  { route: 'letters', label: 'Letters', icon: ICON_LETTERS },
  { route: 'advancements', label: 'Goals', icon: ICON_ADVANCEMENTS },
  { route: 'ledger', label: 'Ledger', icon: ICON_COIN },
  null,
  null,
  null,
  null,
  { route: 'settings', label: 'Settings', icon: ICON_SETTINGS },
];

export function createHotbar() {
  const links = new Map();
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
    for (const [name, link] of links) {
      if (name === route) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    }
  }

  return { el: nav, setActive };
}
