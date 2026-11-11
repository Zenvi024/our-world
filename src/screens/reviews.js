import { h, friendlyError, plural, pickPhotos } from '../lib/dom.js';
import { pixelArt } from '../art/pixel.js';
import { ICON_ADVANCEMENTS, ICON_HEART, LILY } from '../art/sprites.js';
import { longDate, todayManila } from '../lib/dates.js';
import { navigate } from '../router.js';
import { getUserId, loadMembers } from '../session.js';
import { signedUrls } from '../data/photos.js';
import {
  CATEGORIES,
  MAX_STARS,
  MAX_PHOTOS,
  PRICES,
  againWords,
  fetchReviews,
  saveReview,
  removeReview,
  addReviewPhoto,
  removeReviewPhoto,
} from '../data/reviews.js';
import { openModal, confirmDialog } from '../components/modal.js';
import { lilyLoader } from '../components/loader.js';
import { openChest } from './chest.js';
import { playDone, playClick, playPop } from '../lib/sound.js';

const FILTER_KEY = 'our-world.reviews-filter';
const THUMBS_ON_CARD = 3;

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

// A little verdict when you have both rated something.
function verdict(review) {
  const stars = [...review.ratings.values()].map((rating) => rating.stars);
  if (stars.length < 2) return null;
  if (stars.every((value) => value === MAX_STARS)) return 'Both loved it!';
  if (Math.abs(stars[0] - stars[1]) >= 2) return 'Split decision!';
  return null;
}

// The review's photos, one at a time, in the snapshot frame.
function openReviewPhotos(review, start) {
  let index = start;
  const image = h('img', { class: 'viewer-image', alt: '' });
  const counter = h('p', { class: 'viewer-counter', 'aria-live': 'polite' });
  const status = h('p', { class: 'viewer-status', role: 'status' });
  const step = (by) => {
    index = (index + by + review.photos.length) % review.photos.length;
    show();
  };
  const previous = h('button', { class: 'btn viewer-step viewer-step--previous', type: 'button', 'aria-label': 'Previous photo', onclick: () => step(-1) }, '‹');
  const next = h('button', { class: 'btn viewer-step viewer-step--next', type: 'button', 'aria-label': 'Next photo', onclick: () => step(1) }, '›');
  const onKey = (event) => {
    if (event.key === 'ArrowLeft') step(-1);
    if (event.key === 'ArrowRight') step(1);
  };
  const modal = openModal(
    { label: 'Photo viewer', className: 'viewer', overlayClass: 'overlay--viewer', onClose: () => document.removeEventListener('keydown', onKey) },
    h('div', { class: 'viewer-bar' }, counter, h('button', { class: 'btn btn--small', type: 'button', 'aria-label': 'Close', onclick: () => modal.close() }, '×')),
    h(
      'div',
      { class: 'viewer-stage' },
      h(
        'figure',
        { class: 'frame' },
        h('span', { class: 'frame-tape', 'aria-hidden': 'true' }),
        image,
        h('figcaption', { class: 'frame-caption' }, h('span', { class: 'frame-title' }, review.title), h('span', { class: 'frame-date' }, longDate(review.visited_on))),
        pixelArt(LILY, 'frame-sticker'),
        pixelArt(ICON_HEART, 'frame-heart'),
      ),
      previous,
      next,
      status,
    ),
  );
  async function show() {
    const wanted = index;
    counter.textContent = `${index + 1} of ${review.photos.length}`;
    previous.hidden = review.photos.length < 2;
    next.hidden = review.photos.length < 2;
    status.textContent = 'Loading…';
    try {
      const path = review.photos[index].storage_path;
      const url = (await signedUrls([path])).get(path);
      if (wanted !== index) return;
      image.onload = () => {
        status.textContent = '';
      };
      image.src = url ?? '';
      if (!url) status.textContent = 'This photo could not be found.';
    } catch (error) {
      status.textContent = friendlyError(error);
    }
  }
  document.addEventListener('keydown', onKey);
  show();
}

// Our Reviews: where you went and what you watched, rated by each of you.
export function createReviews() {
  const me = getUserId();
  const list = h('div', { class: 'review-list' }, lilyLoader('Finding your reviews…'));
  const summary = h('p', { class: 'review-summary' });
  const filters = h('div', { class: 'review-filters', role: 'group', 'aria-label': 'Show' });
  const search = h('input', { class: 'input review-search', type: 'search', placeholder: 'Search by name or place…', 'aria-label': 'Search reviews', oninput: () => render() });
  const sort = h(
    'select',
    { class: 'input review-sort', 'aria-label': 'Sort by', onchange: () => render() },
    h('option', { value: 'recent' }, 'Newest first'),
    h('option', { value: 'best' }, 'Best first'),
  );
  let reviews = [];
  let extras = false; // photos, prices, and "again" need the latest database file
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
    const badge = verdict(review);
    const where = [review.place, PRICES[review.price ?? 0]].filter(Boolean).join(' · ');
    const extra = review.photos.length - THUMBS_ON_CARD;
    return h(
      'article',
      { class: 'review' },
      h(
        'button',
        { class: 'review-open', type: 'button', onclick: () => openEditor(review), 'aria-label': `${review.title}. Tap to open.` },
        h('span', { class: 'review-top' }, h('span', { class: `review-tag review-tag--${review.category}` }, CATEGORIES[review.category]), h('span', { class: 'review-date' }, longDate(review.visited_on))),
        h('span', { class: 'review-title' }, review.title),
        where && h('span', { class: 'review-place' }, where),
        badge && h('span', { class: 'review-badge' }, badge),
        people().map((id) => {
          const rating = review.ratings.get(id);
          return h(
            'span',
            { class: 'review-line' },
            h('span', { class: 'review-who' }, nameOf(id)),
            rating ? starRow(rating.stars, `${plural(rating.stars, 'star')} out of ${MAX_STARS}`) : h('span', { class: 'review-waiting' }, id === me ? 'Tap to add your stars' : 'Not rated yet'),
            rating?.again && h('span', { class: 'review-again' }, againWords(review.category)),
            rating?.comment && h('span', { class: 'review-words' }, rating.comment),
          );
        }),
        !mine && h('span', { class: 'review-nudge' }, 'Your turn to rate this one!'),
      ),
      review.photos.length > 0 &&
        h(
          'div',
          { class: 'review-photos' },
          review.photos.slice(0, THUMBS_ON_CARD).map((photo, i) =>
            h(
              'button',
              { class: 'review-thumb', type: 'button', 'aria-label': `Photo ${i + 1} of ${review.photos.length}`, onclick: () => openReviewPhotos(review, i) },
              h('img', { alt: '', loading: 'lazy', 'data-path': photo.thumb_path }),
              i === THUMBS_ON_CARD - 1 && extra > 0 && h('span', { class: 'review-more' }, `+${extra}`),
            ),
          ),
        ),
    );
  }

  // Fills in the thumbnails once their temporary links are ready.
  async function loadThumbs(root) {
    const images = [...root.querySelectorAll('img[data-path]')];
    if (!images.length) return;
    try {
      const urls = await signedUrls(images.map((image) => image.dataset.path));
      for (const image of images) image.src = urls.get(image.dataset.path) ?? '';
    } catch {
      // The slots stay empty until the next look.
    }
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

    const words = search.value.trim().toLowerCase();
    const matches = (review) =>
      !words || [review.title, review.place, ...[...review.ratings.values()].map((rating) => rating.comment)].some((text) => text?.toLowerCase().includes(words));
    const shown = reviews.filter((review) => (filter === 'all' || review.category === filter) && matches(review));
    if (sort.value === 'best') shown.sort((a, b) => (b.average ?? 0) - (a.average ?? 0) || b.visited_on.localeCompare(a.visited_on));
    const rated = shown.filter((review) => review.average != null);
    const average = rated.length ? rated.reduce((sum, review) => sum + review.average, 0) / rated.length : null;
    summary.textContent = !reviews.length ? '' : `${plural(shown.length, 'review')}${average == null ? '.' : `, ${average.toFixed(1)} stars on average.`}`;

    list.replaceChildren(
      ...(shown.length
        ? shown.map(card)
        : [
            h(
              'div',
              { class: 'review-empty' },
              pixelArt(ICON_ADVANCEMENTS, 'review-empty-star'),
              h('p', null, reviews.length ? 'Nothing matches that. Try another word.' : 'No reviews yet. Where did you two go last? What did you watch?'),
            ),
          ]),
    );
    loadThumbs(list);
  }

  function openEditor(review = null) {
    let savedId = review?.id ?? null;
    const mine = review?.ratings.get(me);
    const kept = [...(review?.photos ?? [])]; // photos already on the review
    const pending = []; // photos picked here, added when the review is saved
    const category = h(
      'select',
      { class: 'input', id: 'review-category', onchange: () => showAgain() },
      Object.entries(CATEGORIES).map(([key, label]) => h('option', { value: key, selected: (review?.category ?? (filter === 'all' ? 'cafe' : filter)) === key }, label)),
    );
    const title = h('input', { class: 'input', id: 'review-title', type: 'text', maxlength: '120', required: true, placeholder: 'The café, the film, the place…', value: review?.title ?? '' });
    const place = h('input', { class: 'input', id: 'review-place', type: 'text', maxlength: '120', placeholder: 'Where? (optional)', value: review?.place ?? '' });
    const date = h('input', { class: 'input', id: 'review-date', type: 'date', required: true, max: todayManila(), value: review?.visited_on ?? todayManila() });
    const price = h(
      'select',
      { class: 'input', id: 'review-price' },
      [['', 'Not set'], ['1', '₱ (easy on the wallet)'], ['2', '₱₱ (in the middle)'], ['3', '₱₱₱ (a splurge)']].map(([value, label]) =>
        h('option', { value, selected: String(review?.price ?? '') === value }, label),
      ),
    );
    const error = h('p', { class: 'status status--error', role: 'alert' });
    const stars = starPicker(mine?.stars ?? 0, () => {
      error.textContent = '';
    });
    const again = h('input', { type: 'checkbox', id: 'review-again', checked: Boolean(mine?.again) });
    const againLabel = h('span');
    const showAgain = () => {
      againLabel.textContent = `I ${againWords(category.value).toLowerCase()}`;
    };
    showAgain();
    const comment = h('textarea', { class: 'input', id: 'review-comment', rows: '3', maxlength: '2000', placeholder: 'What did you think?' }, mine?.comment ?? '');
    const save = h('button', { class: 'btn btn--green', type: 'submit' }, 'Save');
    const theirs = review && [...review.ratings].find(([id]) => id !== me);

    // ----- photos
    const photoGrid = h('div', { class: 'review-photo-grid' });
    const addPhotos = h(
      'button',
      {
        class: 'btn btn--small',
        type: 'button',
        onclick: () =>
          pickPhotos((files) => {
            const room = MAX_PHOTOS - kept.length - pending.length;
            for (const file of files.slice(0, room)) pending.push({ file, url: URL.createObjectURL(file) });
            if (files.length > room) error.textContent = `A review holds up to ${MAX_PHOTOS} photos.`;
            playPop();
            drawPhotos();
          }),
      },
      'Add photos',
    );
    function drawPhotos() {
      const tile = (image, label, onRemove) =>
        h('span', { class: 'review-thumb review-thumb--edit' }, image, h('button', { class: 'review-thumb-remove', type: 'button', 'aria-label': label, 'data-quiet': 'true', onclick: onRemove }, '×'));
      photoGrid.replaceChildren(
        ...kept.map((photo, i) =>
          tile(h('img', { alt: '', 'data-path': photo.thumb_path }), `Remove photo ${i + 1}`, async () => {
            if (!(await confirmDialog({ message: 'Remove this photo from the review?', confirmLabel: 'Remove', danger: true }))) return;
            try {
              await removeReviewPhoto(photo);
              kept.splice(kept.indexOf(photo), 1);
              review.photos = review.photos.filter((item) => item.id !== photo.id);
              drawPhotos();
              render();
            } catch (problem) {
              error.textContent = friendlyError(problem);
            }
          }),
        ),
        ...pending.map((item, i) =>
          tile(h('img', { alt: '', src: item.url }), `Remove new photo ${i + 1}`, () => {
            URL.revokeObjectURL(item.url);
            pending.splice(pending.indexOf(item), 1);
            drawPhotos();
          }),
        ),
      );
      addPhotos.disabled = kept.length + pending.length >= MAX_PHOTOS;
      loadThumbs(photoGrid);
    }
    drawPhotos();

    const modal = openModal(
      { label: review ? 'Review' : 'A new review', className: 'review-panel', onClose: () => pending.forEach((item) => URL.revokeObjectURL(item.url)) },
      h(
        'form',
        {
          onsubmit: async (event) => {
            event.preventDefault();
            if (!title.value.trim()) return;
            if (!stars.get() && !review) {
              error.textContent = 'Tap a star to give your rating.';
              return;
            }
            save.disabled = true;
            error.textContent = '';
            try {
              const details = { category: category.value, title: title.value.trim(), place: place.value.trim(), visited_on: date.value };
              if (extras) details.price = price.value ? Number(price.value) : null;
              const rating = stars.get() ? { stars: stars.get(), comment: comment.value.trim(), ...(extras ? { again: again.checked } : {}) } : null;
              savedId = await saveReview(savedId, details, rating);
              if (pending.length) {
                const { prepareImage } = await import('../lib/imagePipeline.js');
                const total = pending.length;
                while (pending.length) {
                  save.textContent = `Adding photo ${total - pending.length + 1} of ${total}…`;
                  await addReviewPhoto(savedId, await prepareImage(pending[0].file));
                  URL.revokeObjectURL(pending.shift().url);
                }
              }
              playDone();
              modal.close();
              await load();
            } catch (problem) {
              // The review itself may be saved by now; saving again finishes the photos.
              error.textContent = savedId && pending.length ? 'The review is saved, but a photo could not be added. Tap Save to try again.' : friendlyError(problem);
              save.disabled = false;
              save.textContent = 'Save';
              load();
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
        extras && h('div', { class: 'field' }, h('label', { for: 'review-price' }, 'Price'), price),
        h('div', { class: 'field' }, h('label', null, 'Your stars'), stars.el, extras && h('label', { class: 'check check--row', for: 'review-again' }, again, againLabel)),
        h('div', { class: 'field' }, h('label', { for: 'review-comment' }, 'Your words'), comment),
        extras && h('div', { class: 'field' }, h('label', null, `Photos (up to ${MAX_PHOTOS})`), photoGrid, addPhotos),
        theirs &&
          h(
            'div',
            { class: 'review-theirs' },
            h('span', { class: 'review-who' }, `${nameOf(theirs[0])} said`),
            starRow(theirs[1].stars, `${plural(theirs[1].stars, 'star')} out of ${MAX_STARS}`),
            theirs[1].again && h('span', { class: 'review-again' }, againWords(review.category)),
            theirs[1].comment && h('span', { class: 'review-words' }, theirs[1].comment),
          ),
        review &&
          h(
            'button',
            {
              class: 'btn btn--small review-day',
              type: 'button',
              onclick: () => {
                modal.close();
                navigate('calendar');
                openChest(review.visited_on);
              },
            },
            'See this day in the Memory Chest',
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
                    await removeReview(review);
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
      const [fetched, people] = await Promise.all([fetchReviews(), loadMembers()]);
      ({ reviews, extras } = fetched);
      members = people;
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
      h('div', { class: 'review-tools' }, search, sort),
      filters,
      summary,
      list,
    ),
  );
}
