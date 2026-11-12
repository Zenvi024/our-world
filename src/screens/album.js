import { h, friendlyError, pickPhotos } from '../lib/dom.js';
import { pixelArt } from '../art/pixel.js';
import { ICON_SPEAKER } from '../art/sprites.js';
import { startLandscape } from '../art/landscape.js';
import { drawScene, SCENE_W, SCENE_H } from '../art/story.js';
import { signedUrls } from '../data/photos.js';
import {
  PAGE_WORLDS,
  SCENE_NAMES,
  fetchAlbumCover,
  fetchAlbumPages,
  saveAlbumPage,
  setAlbumPhoto,
  removeAlbumPhoto,
  publishAlbum,
} from '../data/album.js';
import { openModal, confirmDialog } from '../components/modal.js';
import { playPage, playDone, startAlbumMusic, stopAlbumMusic, isAlbumMuted, setAlbumMuted } from '../lib/sound.js';

const FRAME_MS = 100;
const TYPE_MS = 34; // one letter at a time
const SEEN_KEY = 'our-world.album-seen';

export const albumSeen = () => {
  try {
    return localStorage.getItem(SEEN_KEY) === '1';
  } catch {
    return true;
  }
};

// Opens the storybook over the whole screen. Must be called from a tap, so
// its music may start. Resolves once it has been closed.
export async function openAlbum() {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const cover = await fetchAlbumCover();
  if (!cover) throw new Error('The album is not set up yet.');
  let pages = await fetchAlbumPages();
  const { isAuthor } = cover;
  let published = cover.published;
  // The reader skips hidden pages; the author sees them, marked.
  const shown = () => pages.filter((page) => isAuthor || !page.hidden);
  if (!shown().length) throw new Error('The album has no pages yet.');
  try {
    if (!isAuthor) localStorage.setItem(SEEN_KEY, '1');
  } catch {
    // It will simply be offered as new again.
  }

  let index = 0;
  let frame = 0;
  let typed = 0; // letters shown so far
  let typeTimer = null;
  let photoShowing = false;

  // ----- the world behind the book
  const worldCanvas = h('canvas', { class: 'album-world', 'aria-hidden': 'true' });
  const worldHolder = h('div', { class: 'album-world-holder' }, worldCanvas);

  // ----- the book
  const art = h('canvas', { class: 'album-art', width: String(SCENE_W), height: String(SCENE_H), 'aria-hidden': 'true' });
  const artCtx = art.getContext('2d');
  const photo = h('img', { class: 'album-photo', alt: '', hidden: true });
  const photoButton = h('button', { class: 'album-photo-button', type: 'button', hidden: true });
  const hiddenTag = h('span', { class: 'album-hidden-tag', hidden: true }, 'Hidden from the album');
  const dateLine = h('p', { class: 'album-date' });
  const words = h('p', { class: 'album-words' });
  const hint = h('p', { class: 'album-hint', 'aria-hidden': 'true' });
  const counter = h('span', { class: 'album-counter', 'aria-live': 'polite' });
  // Page numbers at the foot of each page, like a real book.
  const folioArt = h('span', { class: 'album-folio', 'aria-hidden': 'true' });
  const folioWords = h('span', { class: 'album-folio', 'aria-hidden': 'true' });
  const artPage = h('div', { class: 'album-page album-page--art' }, h('div', { class: 'album-art-holder' }, art, photo), photoButton, hiddenTag, folioArt);
  const wordsPage = h('div', { class: 'album-page album-page--words' }, dateLine, words, hint, folioWords);
  const spread = h('div', { class: 'album-spread' }, artPage, h('span', { class: 'album-spine', 'aria-hidden': 'true' }), wordsPage);
  const previous = h('button', { class: 'btn album-step', type: 'button', 'aria-label': 'Previous page', onclick: () => go(-1) }, '‹');
  const next = h('button', { class: 'btn album-step', type: 'button', 'aria-label': 'Next page', onclick: () => advance() }, '›');
  const book = h('div', { class: 'album-book' }, spread);

  // ----- the bar along the top
  const mute = h('button', { class: 'btn album-tool', type: 'button', 'data-quiet': 'true', onclick: toggleMute }, pixelArt(ICON_SPEAKER));
  const editButton = h('button', { class: 'btn album-tool album-tool--wide', type: 'button', onclick: () => openEditor() }, 'Edit page');
  const giveButton = h('button', { class: 'btn album-tool album-tool--wide', type: 'button', onclick: give });
  const close = h('button', { class: 'btn album-tool', type: 'button', 'aria-label': 'Close the album', onclick: () => shut() }, '×');
  const bar = h('div', { class: 'album-bar' }, mute, isAuthor && editButton, isAuthor && giveButton, h('span', { class: 'album-bar-gap' }), counter, close);

  const root = h(
    'div',
    { class: 'album', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Our album' },
    worldHolder,
    bar,
    h('div', { class: 'album-stage' }, previous, book, next),
  );
  document.body.append(root);
  const world = startLandscape(worldCanvas, { phase: 'dawn', season: 'spring' });

  // The picture is scaled by a whole number so every pixel stays square.
  function fit() {
    const holder = art.parentElement;
    const style = getComputedStyle(artPage);
    const room = artPage.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight) - 4;
    const scale = Math.max(1, Math.floor(room / SCENE_W));
    holder.style.width = `${SCENE_W * scale}px`;
    holder.style.height = `${SCENE_H * scale}px`;
  }

  function showMute() {
    mute.classList.toggle('album-tool--off', isAlbumMuted());
    mute.setAttribute('aria-label', isAlbumMuted() ? 'Music is off. Tap to turn it on.' : 'Music is on. Tap to turn it off.');
  }
  function toggleMute() {
    setAlbumMuted(!isAlbumMuted());
    showMute();
  }
  function showGive() {
    giveButton.textContent = published ? 'Take it back' : 'Give it';
  }

  const page = () => shown()[index];
  const fullText = () => page().body || (isAuthor ? 'This page is waiting for your words. Tap "Edit page" above.' : '');

  function type() {
    clearInterval(typeTimer);
    const text = fullText();
    words.setAttribute('aria-label', text);
    if (reduceMotion) typed = text.length;
    const show = () => {
      words.textContent = text.slice(0, typed);
      words.classList.toggle('album-words--typing', typed < text.length);
      const last = index === shown().length - 1;
      hint.textContent = typed < text.length ? '' : last ? 'The end, for now.' : 'Tap to turn the page';
    };
    show();
    if (typed >= text.length) return;
    typeTimer = setInterval(() => {
      typed += 1;
      show();
      if (typed >= text.length) clearInterval(typeTimer);
    }, TYPE_MS);
  }

  async function showPhotoButton() {
    const current = page();
    photoShowing = false;
    photo.hidden = true;
    photo.classList.remove('album-photo--developing');
    photoButton.hidden = !current.photo_path;
    photoButton.textContent = 'See the real photo';
  }

  photoButton.addEventListener('click', async (event) => {
    event.stopPropagation();
    const current = page();
    if (photoShowing) {
      photoShowing = false;
      photo.hidden = true;
      photoButton.textContent = 'See the real photo';
      return;
    }
    try {
      const url = (await signedUrls([current.photo_path])).get(current.photo_path);
      if (!url || current !== page()) return;
      photo.src = url;
      photo.hidden = false;
      photoShowing = true;
      // It develops like instant film.
      photo.classList.remove('album-photo--developing');
      void photo.offsetWidth;
      photo.classList.add('album-photo--developing');
      photoButton.textContent = 'Back to the picture';
    } catch {
      // The picture stays.
    }
  });

  function render({ turn = 0 } = {}) {
    const current = page();
    typed = 0;
    counter.textContent = `${index + 1} of ${shown().length}`;
    folioArt.textContent = String(index * 2 + 1);
    folioWords.textContent = String(index * 2 + 2);
    dateLine.textContent = current.date_label || '';
    hiddenTag.hidden = !current.hidden;
    previous.disabled = index === 0;
    next.disabled = index === shown().length - 1;
    world.setLook(PAGE_WORLDS[current.scene] ?? PAGE_WORLDS.cover);
    showPhotoButton();
    if (turn && !reduceMotion) {
      spread.classList.remove('album-spread--next', 'album-spread--previous');
      void spread.offsetWidth;
      spread.classList.add(turn > 0 ? 'album-spread--next' : 'album-spread--previous');
    }
    drawScene(artCtx, current.scene, frame);
    type();
  }

  function go(by) {
    const target = index + by;
    if (target < 0 || target >= shown().length) return;
    index = target;
    playPage();
    render({ turn: by });
  }

  // A tap first finishes the sentence being written, then turns the page.
  function advance() {
    if (typed < fullText().length) {
      typed = fullText().length;
      type();
      return;
    }
    go(1);
  }

  book.addEventListener('click', (event) => {
    if (event.target.closest('button')) return;
    const box = book.getBoundingClientRect();
    // The outer third on the left goes back; everywhere else goes on.
    if (event.clientX - box.left < box.width * 0.28 && typed >= fullText().length) go(-1);
    else advance();
  });

  const onKey = (event) => {
    if (document.body.lastElementChild !== root) return; // a dialog is open on top
    if (event.key === 'ArrowRight' || event.key === ' ' || event.key === 'Enter') {
      event.preventDefault();
      advance();
    } else if (event.key === 'ArrowLeft') go(-1);
    else if (event.key === 'Escape') shut();
  };
  document.addEventListener('keydown', onKey);
  // The picture is refitted whenever its page changes size.
  const watcher = new ResizeObserver(fit);
  watcher.observe(artPage);

  const animation = reduceMotion
    ? null
    : setInterval(() => {
        frame += 1;
        drawScene(artCtx, page().scene, frame);
      }, FRAME_MS);

  // ----- the author's tools
  async function give() {
    const message = published
      ? 'Take the album back? It will be hidden again until you give it.'
      : 'Give the album now? The "Our album" button will light up on the Play screen for both of you.';
    if (!(await confirmDialog({ message, confirmLabel: published ? 'Take it back' : 'Give it' }))) return;
    try {
      await publishAlbum(!published);
      published = !published;
      playDone();
      showGive();
    } catch {
      // Nothing changed.
    }
  }

  function openEditor() {
    const current = page();
    const date = h('input', { class: 'input', id: 'album-date', type: 'text', maxlength: '60', placeholder: 'August 2021', value: current.date_label ?? '' });
    const body = h('textarea', { class: 'input', id: 'album-body', rows: '7', maxlength: '1200', placeholder: 'What happened, in your words…' }, current.body ?? '');
    const hide = h('input', { type: 'checkbox', id: 'album-hide', checked: current.hidden });
    const error = h('p', { class: 'status status--error', role: 'alert' });
    const photoNote = h('p', { class: 'hint' });
    const save = h('button', { class: 'btn btn--green', type: 'submit' }, 'Save');
    const showPhotoNote = () => {
      photoNote.textContent = current.photo_path ? 'A real photo is tucked behind this picture.' : 'No real photo behind this picture yet.';
      removePhoto.hidden = !current.photo_path;
      addPhoto.textContent = current.photo_path ? 'Change the photo' : 'Add a real photo';
    };
    const addPhoto = h(
      'button',
      {
        class: 'btn btn--small',
        type: 'button',
        onclick: () =>
          pickPhotos(async ([file]) => {
            addPhoto.disabled = true;
            addPhoto.textContent = 'Adding…';
            try {
              const { prepareImage } = await import('../lib/imagePipeline.js');
              Object.assign(current, await setAlbumPhoto(current, await prepareImage(file)));
            } catch (problem) {
              error.textContent = friendlyError(problem);
            }
            addPhoto.disabled = false;
            showPhotoNote();
            showPhotoButton();
          }),
      },
      'Add a real photo',
    );
    const removePhoto = h(
      'button',
      {
        class: 'btn btn--small btn--danger',
        type: 'button',
        onclick: async () => {
          try {
            await removeAlbumPhoto(current);
            Object.assign(current, { photo_path: null, photo_thumb: null });
          } catch (problem) {
            error.textContent = friendlyError(problem);
          }
          showPhotoNote();
          showPhotoButton();
        },
      },
      'Remove it',
    );
    showPhotoNote();
    const modal = openModal(
      { label: 'Edit this page', className: 'album-editor' },
      h(
        'form',
        {
          onsubmit: async (event) => {
            event.preventDefault();
            save.disabled = true;
            try {
              const fields = { date_label: date.value.trim() || null, body: body.value.trim(), hidden: hide.checked };
              await saveAlbumPage(current.id, fields);
              Object.assign(current, fields);
              playDone();
              modal.close();
              render();
            } catch (problem) {
              error.textContent = friendlyError(problem);
              save.disabled = false;
            }
          },
        },
        h('h2', { class: 'panel-title' }, SCENE_NAMES[current.scene] ?? 'This page'),
        h('div', { class: 'field' }, h('label', { for: 'album-date' }, 'The date line'), date),
        h('div', { class: 'field' }, h('label', { for: 'album-body' }, 'Your words'), body),
        h('div', { class: 'field' }, h('label', null, 'The real photo'), photoNote, h('div', { class: 'button-row album-photo-row' }, addPhoto, removePhoto)),
        h('label', { class: 'check check--row', for: 'album-hide' }, hide, 'Leave this page out of the album'),
        error,
        h('div', { class: 'button-row' }, h('button', { class: 'btn', type: 'button', onclick: () => modal.close() }, 'Cancel'), save),
      ),
    );
  }

  let finish;
  const closed = new Promise((resolve) => {
    finish = resolve;
  });
  function shut() {
    clearInterval(animation);
    clearInterval(typeTimer);
    document.removeEventListener('keydown', onKey);
    watcher.disconnect();
    world.stop();
    stopAlbumMusic();
    root.remove();
    finish({ published });
  }

  startAlbumMusic();
  showMute();
  showGive();
  fit();
  render();
  close.focus();
  return closed;
}
