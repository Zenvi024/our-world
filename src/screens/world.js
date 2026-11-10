import { h } from '../lib/dom.js';
import { pixelArt } from '../art/pixel.js';
import { LILY, ICON_HOME } from '../art/sprites.js';
import { createHotbar } from '../components/hotbar.js';
import { createSettings } from './settings.js';
import { createCalendar } from './calendar.js';

function comingSoon(message) {
  return () =>
    h(
      'div',
      { class: 'panel empty-state' },
      pixelArt(LILY, 'empty-lily'),
      h('p', null, message),
    );
}

const SCREENS = {
  calendar: { title: 'Calendar', create: createCalendar },
  letters: {
    title: 'Letters',
    create: comingSoon('The book and quill is not ready yet. Letters are coming soon.'),
  },
  advancements: {
    title: 'Advancements',
    create: comingSoon('Advancements are coming soon.'),
  },
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
      ),
      outlet,
      h('footer', { class: 'hud' }, hotbar.el),
    ),
  );

  return function show(route) {
    const screen = SCREENS[route];
    heading.textContent = screen.title;
    document.title = `${screen.title} · Our Little World`;
    outlet.replaceChildren(screen.create());
    outlet.scrollTop = 0;
    hotbar.setActive(route);
  };
}
