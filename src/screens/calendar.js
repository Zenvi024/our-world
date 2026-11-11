import { h, friendlyError, plural } from '../lib/dom.js';
import { pixelArt } from '../art/pixel.js';
import { LILY } from '../art/sprites.js';
import {
  todayManila,
  parts,
  toDate,
  daysInMonth,
  weekdayIndex,
  addMonths,
  monthLabel,
  longDate,
  isAnniversary,
  MONTH_NAMES,
} from '../lib/dates.js';
import {
  fetchMemoriesBetween,
  groupByDate,
  photosOf,
  coverOf,
  fetchFavorites,
  searchMemories,
  randomMemoryDate,
} from '../data/memories.js';
import { lilyLoader } from '../components/loader.js';
import { signedUrls } from '../data/photos.js';
import { openModal } from '../components/modal.js';
import { openChest } from './chest.js';
import { openBulkUpload } from './bulkUpload.js';
import { checkAdvancements } from '../data/advancements.js';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// The month being looked at is remembered while the app stays open.
let view = null;

function createDaySlot(date, today, onOpen) {
  const number = h('span', { class: 'day-number' }, String(parts(date).day));
  const el = h(
    'button',
    { class: 'day-slot', type: 'button', 'aria-label': longDate(date), onclick: () => onOpen(date) },
    number,
  );
  if (date === today) el.classList.add('day-slot--today');
  if (isAnniversary(date)) {
    el.classList.add('day-slot--anniversary');
    el.append(pixelArt(LILY, 'day-lily'));
  }

  // Puts the day's cover photo and stack count into the slot.
  function fill(memories, coverUrl) {
    const count = photosOf(memories).length;
    if (coverUrl) {
      el.prepend(h('img', { class: 'day-cover', src: coverUrl, alt: '', loading: 'lazy', decoding: 'async' }));
      el.classList.add('day-slot--filled');
    } else {
      el.classList.add('day-slot--note');
    }
    // Like item stacks, the number only shows from 2 up.
    if (count >= 2) el.append(h('span', { class: 'stack-count', 'aria-hidden': 'true' }, String(count)));
    el.setAttribute(
      'aria-label',
      `${longDate(date)}, ${count ? plural(count, 'photo') : 'a note'}${isAnniversary(date) ? ', our anniversary' : ''}`,
    );
  }

  return { el, fill };
}

export function createCalendar() {
  const today = todayManila();
  view ??= { year: parts(today).year, month: parts(today).month };

  const title = h('button', {
    class: 'btn month-title',
    type: 'button',
    title: 'Jump to another month',
    onclick: openJump,
  });
  const grid = h('div', { class: 'day-grid' });
  const note = h('p', { class: 'calendar-note', role: 'status' });
  let latestLoad = 0;

  function go(delta) {
    view = addMonths(view.year, view.month, delta);
    show();
  }

  // After photos or memories change, redraw and look for new advancements.
  function changed() {
    show();
    checkAdvancements();
  }

  function openDay(date) {
    openChest(date, { onChange: changed });
  }

  async function show() {
    const load = ++latestLoad;
    const { year, month } = view;
    title.textContent = monthLabel(year, month);

    // Draw the empty month right away, then fill in the photos.
    const first = toDate(year, month, 1);
    const dayCount = daysInMonth(year, month);
    const slots = new Map();
    const cells = [];
    const blank = () => h('span', { class: 'day-slot day-slot--blank', 'aria-hidden': 'true' });
    for (let i = 0; i < weekdayIndex(first); i += 1) cells.push(blank());
    for (let day = 1; day <= dayCount; day += 1) {
      const date = toDate(year, month, day);
      const slot = createDaySlot(date, today, openDay);
      slots.set(date, slot);
      cells.push(slot.el);
    }
    while (cells.length % 7) cells.push(blank());
    grid.replaceChildren(...cells);
    note.textContent = '';
    note.classList.remove('calendar-note--error');

    try {
      const memories = await fetchMemoriesBetween(first, toDate(year, month, dayCount));
      if (load !== latestLoad) return;
      const days = groupByDate(memories);
      const covers = new Map([...days].map(([date, list]) => [date, coverOf(list)]));
      const urls = await signedUrls([...covers.values()].filter(Boolean).map((photo) => photo.thumb_path));
      if (load !== latestLoad) return;
      for (const [date, list] of days) {
        const cover = covers.get(date);
        slots.get(date)?.fill(list, cover ? urls.get(cover.thumb_path) : null);
      }
      if (!memories.length) note.textContent = 'No memories here yet. Tap a day to add the first one.';
    } catch (error) {
      if (load !== latestLoad) return;
      note.textContent = friendlyError(error);
      note.classList.add('calendar-note--error');
    }
  }

  const note2 = h('p', { class: 'calendar-tip', role: 'status' });

  // Shows the month of a date, and optionally opens that day's chest.
  function goTo(date, open = true) {
    view = { year: parts(date).year, month: parts(date).month };
    show();
    if (open) openDay(date);
  }

  // Opens a random day that has a memory.
  async function takeMeBack() {
    try {
      const date = await randomMemoryDate();
      if (date) goTo(date);
      else note2.textContent = 'There are no memories to go back to yet.';
    } catch (error) {
      note2.textContent = friendlyError(error);
    }
  }

  // A list of memories to pick from (used by Favorites and Search).
  function openResults(heading, find, emptyText) {
    const list = h('div', { class: 'result-list' }, lilyLoader('Looking…'));
    const modal = openModal(
      { label: heading, className: 'results' },
      h('h2', { class: 'panel-title' }, heading),
      list,
      h('div', { class: 'button-row' }, h('button', { class: 'btn', type: 'button', onclick: () => modal.close() }, 'Close')),
    );
    find()
      .then(async (memories) => {
        const urls = await signedUrls(memories.map((memory) => coverOf([memory])?.thumb_path).filter(Boolean));
        list.replaceChildren(
          ...(memories.length
            ? memories.map((memory) => {
                const cover = coverOf([memory]);
                return h(
                  'button',
                  {
                    class: 'result',
                    type: 'button',
                    onclick: () => {
                      modal.close();
                      goTo(memory.memory_date);
                    },
                  },
                  h('span', { class: 'photo-slot result-slot' }, cover && h('img', { src: urls.get(cover.thumb_path) ?? '', alt: '', loading: 'lazy' })),
                  h(
                    'span',
                    { class: 'result-words' },
                    h('span', { class: 'result-title' }, `${memory.featured ? '★ ' : ''}${memory.title || 'Untitled memory'}`),
                    h('span', { class: 'result-date' }, longDate(memory.memory_date)),
                    memory.note && h('span', { class: 'result-note' }, memory.note),
                  ),
                );
              })
            : [h('p', { class: 'hint' }, emptyText)]),
        );
      })
      .catch((error) => list.replaceChildren(h('p', { class: 'status status--error' }, friendlyError(error))));
  }

  function openSearch() {
    const input = h('input', { class: 'input', id: 'search-words', type: 'search', maxlength: '80', placeholder: 'A word from a title or note', required: true });
    const modal = openModal(
      { label: 'Search memories', className: 'small-panel' },
      h(
        'form',
        {
          onsubmit: (event) => {
            event.preventDefault();
            const words = input.value.trim();
            if (!words) return;
            modal.close();
            openResults(`Memories with “${words}”`, () => searchMemories(words), 'Nothing matched. Try a different word.');
          },
        },
        h('h2', { class: 'panel-title' }, 'Search memories'),
        h('div', { class: 'field' }, h('label', { for: 'search-words' }, 'What are you looking for?'), input),
        h(
          'div',
          { class: 'button-row' },
          h('button', { class: 'btn', type: 'button', onclick: () => modal.close() }, 'Cancel'),
          h('button', { class: 'btn btn--green', type: 'submit' }, 'Search'),
        ),
      ),
    );
    input.focus();
  }

  function openJump() {
    const month = h(
      'select',
      { class: 'input', id: 'jump-month' },
      MONTH_NAMES.map((name, i) => h('option', { value: String(i + 1), selected: i + 1 === view.month }, name)),
    );
    const year = h('input', {
      class: 'input',
      id: 'jump-year',
      type: 'number',
      inputmode: 'numeric',
      min: '1990',
      max: '2100',
      value: String(view.year),
      required: true,
    });
    const modal = openModal(
      { label: 'Jump to a month', className: 'small-panel' },
      h(
        'form',
        {
          onsubmit: (event) => {
            event.preventDefault();
            const chosenYear = Math.min(2100, Math.max(1990, Number(year.value) || view.year));
            view = { year: chosenYear, month: Number(month.value) };
            modal.close();
            show();
          },
        },
        h('h2', { class: 'panel-title' }, 'Jump to a month'),
        h('div', { class: 'field' }, h('label', { for: 'jump-month' }, 'Month'), month),
        h('div', { class: 'field' }, h('label', { for: 'jump-year' }, 'Year'), year),
        h(
          'div',
          { class: 'button-row' },
          h('button', { class: 'btn', type: 'button', onclick: () => modal.close() }, 'Cancel'),
          h('button', { class: 'btn btn--green', type: 'submit' }, 'Go'),
        ),
      ),
    );
  }

  const el = h(
    'div',
    { class: 'calendar' },
    h(
      'section',
      { class: 'panel calendar-panel', 'aria-label': 'Memory Chest' },
      h(
        'div',
        { class: 'month-bar' },
        h('button', { class: 'btn month-step', type: 'button', 'aria-label': 'Previous month', onclick: () => go(-1) }, '‹'),
        title,
        h('button', { class: 'btn month-step', type: 'button', 'aria-label': 'Next month', onclick: () => go(1) }, '›'),
      ),
      h(
        'div',
        { class: 'weekday-row', 'aria-hidden': 'true' },
        WEEKDAYS.map((day) => h('span', null, day)),
      ),
      grid,
      note,
    ),
    h(
      'div',
      { class: 'calendar-actions' },
      h('button', { class: 'btn', type: 'button', onclick: () => goTo(today, false) }, 'Today'),
      h('button', { class: 'btn', type: 'button', onclick: takeMeBack }, 'Take me back'),
      h('button', { class: 'btn', type: 'button', onclick: () => openResults('Favorites', fetchFavorites, 'No favorites yet. Open a memory, tap Edit, and mark it as a favorite.') }, 'Favorites'),
      h('button', { class: 'btn', type: 'button', onclick: openSearch }, 'Search'),
      h(
        'button',
        { class: 'btn btn--green calendar-add', type: 'button', onclick: () => openBulkUpload({ onDone: changed }) },
        'Add photos',
      ),
    ),
    note2,
  );

  show();
  return el;
}
