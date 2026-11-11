import { h } from '../lib/dom.js';
import { pixelArt } from '../art/pixel.js';
import { ICON_HOME } from '../art/sprites.js';
import { createHotbar } from '../components/hotbar.js';
import { createSettings } from './settings.js';
import { createCalendar } from './calendar.js';
import { createAdvancements } from './advancements.js';
import { createLedger } from './ledger.js';
import { createXpBar } from '../components/xpBar.js';
import { createLetters } from './letters.js';
import { createMusicButton } from '../components/musicButton.js';
import { createMeters } from '../components/meters.js';
import { createLists } from './lists.js';
import { createQuestion } from './question.js';
import { createPet } from './pet.js';
import { onLive } from '../lib/live.js';
import { suggestOpenWhen } from '../lib/notices.js';

const SCREENS = {
  calendar: { title: 'Memory Chest', create: createCalendar, live: 'memories' },
  letters: { title: 'Letters', create: createLetters, live: 'letters' },
  advancements: { title: 'Quests', create: createAdvancements, live: 'goals' },
  ledger: { title: 'Ledger', create: createLedger, live: 'ledger' },
  lists: { title: 'Lists', create: createLists, live: 'lists' },
  question: { title: 'Question', create: createQuestion, live: 'question' },
  pet: { title: 'Happybara', create: createPet }, // keeps itself up to date
  settings: { title: 'Settings', create: createSettings },
};

export const isWorldRoute = (route) => Object.hasOwn(SCREENS, route);

// The frame around every in-world screen: a heading, the screen itself, and
// the hotbar. Returns a function that switches screens.
export function mountWorld(root) {
  const heading = h('h1', { class: 'world-title' });
  const outlet = h('main', { class: 'world-main' });
  const hotbar = createHotbar();

  root.replaceChildren(
    h(
      'div',
      { class: 'world' },
      h(
        'header',
        { class: 'world-header' },
        h(
          'a',
          {
            class: 'btn home-link',
            href: '#/',
            'aria-label': 'Back to the title screen',
            title: 'Back to the title screen',
          },
          pixelArt(ICON_HOME),
        ),
        heading,
        createMusicButton().el,
      ),
      outlet,
      h('footer', { class: 'hud' }, createMeters({ onLowHearts: suggestOpenWhen }).el, createXpBar(), hotbar.el),
    ),
  );

  let current = null;
  // When the other person changes what this screen shows, redraw it, unless
  // a pop-up is open (so nothing shifts under your fingers).
  onLive('*', (topic) => {
    if (current && SCREENS[current].live === topic && !document.querySelector('body > .overlay')) show(current);
  });

  return show;

  function show(route) {
    current = route;
    const screen = SCREENS[route];
    heading.textContent = screen.title;
    document.title = `${screen.title} · Our Little World`;
    const keepScroll = outlet.dataset.route === route ? outlet.scrollTop : 0;
    outlet.replaceChildren(screen.create());
    outlet.dataset.route = route;
    outlet.scrollTop = keepScroll;
    hotbar.setActive(route);
  }
}
