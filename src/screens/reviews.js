import { h, friendlyError, plural } from '../lib/dom.js';
import { pixelArt } from '../art/pixel.js';
import { ICON_ADVANCEMENTS } from '../art/sprites.js';
import { longDate, todayManila } from '../lib/dates.js';
import { getUserId, loadMembers } from '../session.js';
import { CATEGORIES, MAX_STARS, fetchReviews, saveReview, removeReview } from '../data/reviews.js';
import { openModal, confirmDialog } from '../components/modal.js';
import { lilyLoader } from '../components/loader.js';
import { playDone, playClick } from '../lib/sound.js';

const FILTER_KEY = 'our-world.reviews-filter';

// A row of five stars. `value` may be a fraction (an average); whole stars
// are gold and the rest are dim.
function starRow(value, label) {
  return h(
    'span',
    { class: 'stars', role: 'img', 'aria-label': label },
    Array.from({ length: MAX_STARS }, (_, i) => h('span', { class: `star${i < Math.round(value) ? '' : ' star--empty'}` }, pixelArt(ICON_ADVANCEMENTS))),
  );
}

// Five star buttons for choosing a rating. Returns { el, get }.
function starPicker(start = 0, onPick) {
  let value = start;
  const buttons = Array.from({ length: MAX_STARS }, (_, i) =>
    h(
      'button',
      {
        class: 'star star-button',
        type: 'button',
        'data-quiet': 'true',
        'aria-label': plural(i + 1, 'star'),
        onclick: () => {
          value = i + 1;
          playClick();
          paint();
          onPick?.();
        },
      },
      pixelArt(ICON_ADVANCEMENTS),
    ),
  );
  const paint = () =>
    buttons.forEach((button, i) => {
      button.classList.toggle('star--empty', i >= value);
      button.setAttribute('aria-pressed', String(i < value));
    });
  paint();
  return { el: h('div', { class: 'star-picker', role: 'group', 'aria-label': 'Your rating' }, buttons), get: () => value };
}

// Our Reviews: where you went and what you watched, rated by each of you.
export function createReviews() {
  const me = getUserId();
  const list = h('div', { class: 'review-list' }, lilyLoader('Finding your reviews…'));
  const summary = h('p', { class: 'review-summary' });
  const filters = h('div', { class: 'review-filters', role: 'group', 'aria-label': 'Show' });
  const sort = h(
    'select',
    { class: 'input review-sort', 'aria-label': 'Sort by', onchange: () => render() },
    h('option', { value: 'recent' }, 'Newest first'),
    h('option', { value: 'best' }, 'Best first'),
  );
  let reviews = [];
  let members = new Map();
  let filter = 'all';
  try {
    filter = sessionStorage.getItem(FILTER_KEY) || 'all';
  } catch {
    // Everything is shown.
  }

  const nameOf = (id) => (id === me ? 'You' : (members.get(id)?.name ?? 'Your partner'));
  const people = () => [...members.keys()].sort((a, b) => Number(b === me) - Number(a === me));

  function card(review) {
    const mine = review.ratings.get(me);
    return h(
      'button',
      { class: 'review', type: 'button', onclick: () => openEditor(review), 'aria-label': `${review.title}. Tap to open.` },
      h('span', { class: 'review-top' }, h('span', { class: `review-tag review-tag--${review.category}` }, CATEGORIES[review.category]), h('span', { class: 'review-date' }, longDate(review.visited_on))),
      h('span', { class: 'review-title' }, review.title),
      review.place && h('span', { class: 'review-place' }, review.place),
      people().map((id) => {
        const rating = review.ratings.get(id);
        return h(
          'span',
          { class: 'review-line' },
          h('span', { class: 'review-who' }, nameOf(id)),
          rating ? starRow(rating.stars, `${plural(rating.stars, 'star')} out of ${MAX_STARS}`) : h('span', { class: 'review-waiting' }, id === me ? 'Tap to add your stars' : 'Not rated yet'),
          rating?.comment && h('span', { class: 'review-words' }, rating.comment),
        );
      }),
      !mine && h('span', { class: 'review-nudge' }, 'Your turn to rate this one!'),
    );
  }

  function render() {
    const counts = new Map();
    for (const review of reviews) counts.set(review.category, (counts.get(review.category) ?? 0) + 1);
    if (filter !== 'all' && !counts.has(filter)) filter = 'all';

    filters.replaceChildren(
      ...[['all', 'All'], ...Object.entries(CATEGORIES).filter(([key]) => counts.has(key))].map(([key, label]) =>
        h(
          'button',
          {
            class: 'btn btn--small review-filter',
            type: 'button',
            'aria-pressed': String(filter === key),
            onclick: () => {
              filter = key;
              try {
                sessionStorage.setItem(FILTER_KEY, key);
              } catch {
                // Not remembered, which is fine.
              }
              render();
            },
          },
          key === 'all' ? `All (${reviews.length})` : `${label} (${counts.get(key)})`,
        ),
      ),
    );

    const shown = reviews.filter((review) => filter === 'all' || review.category === filter);
    if (sort.value === 'best') shown.sort((a, b) => (b.average ?? 0) - (a.average ?? 0) || b.visited_on.localeCompare(a.visited_on));
    const rated = shown.filter((review) => review.average != null);
    const average = rated.length ? rated.reduce((sum, review) => sum + review.average, 0) / rated.length : null;
    summary.textContent = !reviews.length
      ? ''
      : `${plural(shown.length, 'review')}${average == null ? '.' : `, ${average.toFixed(1)} stars on average.`}`;

    list.replaceChildren(
      ...(shown.length
        ? shown.map(card)
        : [
            h(
              'div',
              { class: 'review-empty' },
              pixelArt(ICON_ADVANCEMENTS, 'review-empty-star'),
              h('p', null, 'No reviews yet. Where did you two go last? What did you watch?'),
            ),
          ]),
    );
  }

  function openEditor(review = null) {
    const mine = review?.ratings.get(me);
    const category = h(
      'select',
      { class: 'input', id: 'review-category' },
      Object.entries(CATEGORIES).map(([key, label]) => h('option', { value: key, selected: (review?.category ?? (filter === 'all' ? 'cafe' : filter)) === key }, label)),
    );
    const title = h('input', { class: 'input', id: 'review-title', type: 'text', maxlength: '120', required: true, placeholder: 'The café, the film, the place…', value: review?.title ?? '' });
    const place = h('input', { class: 'input', id: 'review-place', type: 'text', maxlength: '120', placeholder: 'Where? (optional)', value: review?.place ?? '' });
    const date = h('input', { class: 'input', id: 'review-date', type: 'date', required: true, max: todayManila(), value: review?.visited_on ?? todayManila() });
    const error = h('p', { class: 'status status--error', role: 'alert' });
    const stars = starPicker(mine?.stars ?? 0, () => {
      error.textContent = '';
    });
    const comment = h('textarea', { class: 'input', id: 'review-comment', rows: '3', maxlength: '2000', placeholder: 'What did you think?' }, mine?.comment ?? '');
    const save = h('button', { class: 'btn btn--green', type: 'submit' }, 'Save');
    const theirs = review && [...review.ratings].find(([id]) => id !== me);

    const modal = openModal(
      { label: review ? 'Review' : 'A new review', className: 'review-panel' },
      h(
        'form',
        {
          onsubmit: async (event) => {
            event.preventDefault();
            if (!title.value.trim()) return;
            if (!stars.get() && !mine && !review) {
              error.textContent = 'Tap a star to give your rating.';
              return;
            }
            save.disabled = true;
            try {
              await saveReview(
                review?.id ?? null,
                { category: category.value, title: title.value.trim(), place: place.value.trim(), visited_on: date.value },
                stars.get(),
                comment.value.trim(),
              );
              playDone();
              modal.close();
              await load();
            } catch (problem) {
              error.textContent = friendlyError(problem);
              save.disabled = false;
            }
          },
        },
        h('h2', { class: 'panel-title' }, review ? 'Review' : 'A new review'),
        h(
          'div',
          { class: 'field-pair' },
          h('div', { class: 'field' }, h('label', { for: 'review-category' }, 'Kind'), category),
          h('div', { class: 'field' }, h('label', { for: 'review-date' }, 'When'), date),
        ),
        h('div', { class: 'field' }, h('label', { for: 'review-title' }, 'Name'), title),
        h('div', { class: 'field' }, h('label', { for: 'review-place' }, 'Where'), place),
        h('div', { class: 'field' }, h('label', null, 'Your stars'), stars.el),
        h('div', { class: 'field' }, h('label', { for: 'review-comment' }, 'Your words'), comment),
        theirs &&
          h(
            'div',
            { class: 'review-theirs' },
            h('span', { class: 'review-who' }, `${nameOf(theirs[0])} said`),
            starRow(theirs[1].stars, `${plural(theirs[1].stars, 'star')} out of ${MAX_STARS}`),
            theirs[1].comment && h('span', { class: 'review-words' }, theirs[1].comment),
          ),
        error,
        h(
          'div',
          { class: 'button-row' },
          review &&
            h(
              'button',
              {
                class: 'btn btn--danger review-delete',
                type: 'button',
                onclick: async () => {
                  if (!(await confirmDialog({ message: `Remove the review of “${review.title}” for both of you?`, confirmLabel: 'Remove', danger: true }))) return;
                  try {
                    await removeReview(review.id);
                    modal.close();
                    await load();
                  } catch (problem) {
                    error.textContent = friendlyError(problem);
                  }
                },
              },
              'Remove',
            ),
          h('button', { class: 'btn', type: 'button', onclick: () => modal.close() }, 'Cancel'),
          save,
        ),
      ),
    );
    if (!review) title.focus();
  }

  async function load() {
    try {
      [reviews, members] = await Promise.all([fetchReviews(), loadMembers()]);
      render();
    } catch (error) {
      list.replaceChildren(h('p', { class: 'status status--error' }, friendlyError(error)));
    }
  }

  load();
  return h(
    'div',
    { class: 'reviews' },
    h(
      'section',
      { class: 'panel' },
      h(
        'div',
        { class: 'review-head' },
        h('h2', { class: 'panel-title' }, 'Places and films'),
        h('button', { class: 'btn btn--green', type: 'button', onclick: () => openEditor() }, 'Add a review'),
      ),
      h('div', { class: 'review-tools' }, filters, sort),
      summary,
      list,
    ),
  );
}
