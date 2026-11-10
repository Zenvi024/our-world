import { h, plural } from '../lib/dom.js';
import { longDate } from '../lib/dates.js';
import { togetherStats } from '../lib/together.js';
import { openModal } from './modal.js';

const SEGMENTS = 18;

// The experience bar above the hotbar: the level is the years together, and
// the bar fills from one anniversary to the next. Tap it for the numbers.
export function createXpBar() {
  const stats = togetherStats();
  const filled = Math.round(stats.progress * SEGMENTS);

  function openDetails() {
    const fresh = togetherStats();
    const modal = openModal(
      { label: 'Days together', className: 'small-panel xp-panel' },
      h('p', { class: 'xp-panel-level' }, `Level ${fresh.level}`),
      h('p', { class: 'xp-panel-days' }, `${plural(fresh.days, 'day').replace(/\B(?=(\d{3})+(?!\d))/g, ',')} together`),
      fresh.isAnniversary && h('p', { class: 'xp-panel-note' }, 'Happy anniversary!'),
      h(
        'p',
        { class: 'hint' },
        `${plural(fresh.daysUntilNext, 'day')} until Level ${fresh.level + 1} on ${longDate(fresh.next)}.`,
      ),
      h(
        'div',
        { class: 'button-row' },
        h('button', { class: 'btn', type: 'button', onclick: () => modal.close() }, 'Close'),
      ),
    );
  }

  return h(
    'button',
    {
      class: 'xp',
      type: 'button',
      'aria-label': `Level ${stats.level}. ${plural(stats.days, 'day')} together. Tap for details.`,
      onclick: openDetails,
    },
    h('span', { class: 'xp-level', 'aria-hidden': 'true' }, String(stats.level)),
    h(
      'span',
      { class: 'xp-bar', 'aria-hidden': 'true' },
      Array.from({ length: SEGMENTS }, (_, i) => h('span', { class: i < filled ? 'xp-segment xp-segment--full' : 'xp-segment' })),
    ),
  );
}
