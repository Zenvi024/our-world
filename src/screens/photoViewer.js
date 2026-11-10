import { h, friendlyError } from '../lib/dom.js';
import { photosOf, coverOf, chooseCover } from '../data/memories.js';
import { signedUrls, deletePhoto } from '../data/photos.js';
import { openModal, confirmDialog } from '../components/modal.js';

// Full-screen viewer for one day's photos.
//   memories: the day's memories (their photo lists are kept up to date here)
//   startId:  the photo to open first
export function openPhotoViewer({ memories, startId, onChange }) {
  let photos = photosOf(memories);
  let index = Math.max(0, photos.findIndex((photo) => photo.id === startId));
  let changed = false;
  let latestShow = 0;

  const image = h('img', { class: 'viewer-image', alt: '' });
  const counter = h('p', { class: 'viewer-counter', 'aria-live': 'polite' });
  const status = h('p', { class: 'viewer-status', role: 'status' });
  const coverButton = h('button', { class: 'btn btn--small', type: 'button', onclick: makeCover });
  const previous = h('button', { class: 'btn viewer-step viewer-step--previous', type: 'button', 'aria-label': 'Previous photo', onclick: () => step(-1) }, '‹');
  const next = h('button', { class: 'btn viewer-step viewer-step--next', type: 'button', 'aria-label': 'Next photo', onclick: () => step(1) }, '›');

  const modal = openModal(
    {
      label: 'Photo viewer',
      className: 'viewer',
      overlayClass: 'overlay--viewer',
      onClose: () => {
        document.removeEventListener('keydown', onKey);
        if (changed) onChange?.();
      },
    },
    h(
      'div',
      { class: 'viewer-bar' },
      counter,
      h('button', { class: 'btn btn--small', type: 'button', 'aria-label': 'Close', onclick: () => modal.close() }, '×'),
    ),
    h('div', { class: 'viewer-stage' }, image, previous, next, status),
    h(
      'div',
      { class: 'viewer-bar' },
      h('button', { class: 'btn btn--small btn--danger', type: 'button', onclick: remove }, 'Delete'),
      coverButton,
    ),
  );

  async function show() {
    const load = ++latestShow;
    const photo = photos[index];
    counter.textContent = `${index + 1} of ${photos.length}`;
    previous.hidden = photos.length < 2;
    next.hidden = photos.length < 2;
    const isCover = coverOf(memories)?.id === photo.id;
    coverButton.textContent = isCover ? 'Cover photo ✓' : 'Set as cover';
    coverButton.disabled = isCover;
    status.textContent = 'Loading…';
    image.classList.add('viewer-image--loading');
    try {
      const urls = await signedUrls([photo.storage_path]);
      if (load !== latestShow) return;
      image.onload = () => {
        if (load !== latestShow) return;
        status.textContent = '';
        image.classList.remove('viewer-image--loading');
      };
      image.onerror = () => {
        if (load === latestShow) status.textContent = 'This photo could not be loaded.';
      };
      image.src = urls.get(photo.storage_path) ?? '';
    } catch (error) {
      if (load === latestShow) status.textContent = friendlyError(error);
    }
  }

  function step(delta) {
    if (photos.length < 2) return;
    index = (index + delta + photos.length) % photos.length;
    show();
  }

  async function makeCover() {
    coverButton.disabled = true;
    try {
      const photo = photos[index];
      await chooseCover(memories, photo);
      for (const memory of memories) memory.cover_photo_id = memory.id === photo.memory_id ? photo.id : null;
      changed = true;
      show();
    } catch (error) {
      coverButton.disabled = false;
      status.textContent = friendlyError(error);
    }
  }

  async function remove() {
    const sure = await confirmDialog({
      message: 'Delete this photo? This cannot be undone.',
      confirmLabel: 'Delete',
      danger: true,
    });
    if (!sure) return;
    try {
      const photo = photos[index];
      await deletePhoto(photo);
      changed = true;
      for (const memory of memories) {
        memory.photos = memory.photos.filter((other) => other.id !== photo.id);
        if (memory.cover_photo_id === photo.id) memory.cover_photo_id = null;
      }
      photos = photosOf(memories);
      if (!photos.length) {
        modal.close();
        return;
      }
      index = Math.min(index, photos.length - 1);
      show();
    } catch (error) {
      status.textContent = friendlyError(error);
    }
  }

  function onKey(event) {
    if (document.body.lastElementChild !== modal.overlay) return;
    if (event.key === 'ArrowLeft') step(-1);
    if (event.key === 'ArrowRight') step(1);
  }
  document.addEventListener('keydown', onKey);

  // Swipe left or right to move between photos.
  let touchX = null;
  modal.panel.addEventListener('touchstart', (event) => {
    touchX = event.touches.length === 1 ? event.touches[0].clientX : null;
  }, { passive: true });
  modal.panel.addEventListener('touchend', (event) => {
    if (touchX === null) return;
    const moved = event.changedTouches[0].clientX - touchX;
    touchX = null;
    if (Math.abs(moved) > 50) step(moved < 0 ? 1 : -1);
  }, { passive: true });

  show();
}
