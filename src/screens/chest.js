import { h, friendlyError, pickPhotos, plural } from '../lib/dom.js';
import { pixelArt } from '../art/pixel.js';
import { LILY } from '../art/sprites.js';
import { longDate, monthDay, parts, todayManila, sameDayInOtherYears, isValidDate } from '../lib/dates.js';
import {
  fetchMemoriesOn,
  createMemory,
  updateMemory,
  deleteMemory,
  photosOf,
  coverOf,
  groupByDate,
} from '../data/memories.js';
import { signedUrls } from '../data/photos.js';
import { loadMemberNames } from '../session.js';
import { uploadBatch } from '../lib/uploader.js';
import { openModal, confirmDialog } from '../components/modal.js';
import { createProgressBar } from '../components/progressBar.js';
import { openPhotoViewer } from './photoViewer.js';

// The form for writing or editing a memory's words.
function openMemoryForm({ memory, date, onSaved }) {
  const title = h('input', { class: 'input', id: 'memory-title', type: 'text', maxlength: '200', value: memory?.title ?? '' });
  const note = h('textarea', { class: 'input', id: 'memory-note', rows: '4', maxlength: '10000' }, memory?.note ?? '');
  const caption = h('input', { class: 'input', id: 'memory-caption', type: 'text', maxlength: '500', value: memory?.caption ?? '' });
  const day = h('input', { class: 'input', id: 'memory-date', type: 'date', value: memory?.memory_date ?? date, required: true });
  const featured = h('input', { type: 'checkbox', id: 'memory-featured', checked: Boolean(memory?.featured) });
  const status = h('p', { class: 'status status--error', role: 'alert' });
  const save = h('button', { class: 'btn btn--green', type: 'submit' }, 'Save');

  const modal = openModal(
    { label: memory ? 'Edit memory' : 'New memory', className: 'small-panel' },
    h(
      'form',
      {
        onsubmit: async (event) => {
          event.preventDefault();
          if (!isValidDate(day.value)) {
            status.textContent = 'Please choose a date.';
            return;
          }
          const fields = {
            memory_date: day.value,
            title: title.value.trim() || null,
            note: note.value.trim() || null,
          };
          save.disabled = true;
          try {
            if (memory) {
              await updateMemory(memory.id, { ...fields, caption: caption.value.trim() || null, featured: featured.checked });
            } else {
              const created = await createMemory(fields);
              if (caption.value.trim() || featured.checked) {
                await updateMemory(created.id, { caption: caption.value.trim() || null, featured: featured.checked });
              }
            }
            modal.close();
            onSaved();
          } catch (error) {
            status.textContent = friendlyError(error);
            save.disabled = false;
          }
        },
      },
      h('h2', { class: 'panel-title' }, memory ? 'Edit memory' : 'New memory'),
      h('div', { class: 'field' }, h('label', { for: 'memory-title' }, 'Title'), title),
      h('div', { class: 'field' }, h('label', { for: 'memory-note' }, 'Note'), note),
      h('div', { class: 'field' }, h('label', { for: 'memory-caption' }, 'Caption (a short line for later)'), caption),
      h('div', { class: 'field' }, h('label', { for: 'memory-date' }, 'Date'), day),
      h('label', { class: 'check', for: 'memory-featured' }, featured, 'Mark as a favorite'),
      status,
      h(
        'div',
        { class: 'button-row' },
        memory &&
          h(
            'button',
            {
              class: 'btn btn--danger form-delete',
              type: 'button',
              onclick: async () => {
                const count = memory.photos.length;
                const sure = await confirmDialog({
                  message: count
                    ? `Delete this memory and its ${plural(count, 'photo')}? This cannot be undone.`
                    : 'Delete this memory? This cannot be undone.',
                  confirmLabel: 'Delete',
                  danger: true,
                });
                if (!sure) return;
                try {
                  await deleteMemory(memory);
                  modal.close();
                  onSaved();
                } catch (error) {
                  status.textContent = friendlyError(error);
                }
              },
            },
            'Delete',
          ),
        h('button', { class: 'btn', type: 'button', onclick: () => modal.close() }, 'Cancel'),
        save,
      ),
    ),
  );
  if (!memory) title.focus();
}

// Opens the "chest" for one day: everything kept on that date.
// onChange is called after closing if anything was added, edited, or removed.
export function openChest(date, { onChange } = {}) {
  let memories = [];
  let onThisDay = [];
  let names = new Map();
  let thumbs = new Map();
  let changed = false;
  let busy = false;

  const body = h('div', { class: 'chest-body' });
  const tray = h('div', { class: 'chest-tray' }); // upload progress and messages
  const modal = openModal(
    {
      label: `Memories from ${longDate(date)}`,
      className: 'chest',
      onClose: () => {
        if (changed) onChange?.();
      },
    },
    h(
      'header',
      { class: 'chest-lid' },
      h('h2', { class: 'chest-title' }, longDate(date)),
      h('button', { class: 'btn chest-close', type: 'button', 'aria-label': 'Close', onclick: () => modal.close() }, '×'),
    ),
    tray,
    body,
  );

  const touched = () => {
    changed = true;
    return load();
  };

  async function load() {
    try {
      const others = sameDayInOtherYears(date, 2000, parts(todayManila()).year + 1);
      const [all, memberNames] = await Promise.all([fetchMemoriesOn([date, ...others]), loadMemberNames()]);
      names = memberNames;
      memories = all.filter((memory) => memory.memory_date === date);
      onThisDay = [...groupByDate(all.filter((memory) => memory.memory_date !== date))]
        .map(([otherDate, list]) => ({ date: otherDate, memories: list, cover: coverOf(list) }))
        .sort((a, b) => b.date.localeCompare(a.date));
      const paths = [
        ...photosOf(memories).map((photo) => photo.thumb_path),
        ...onThisDay.map((day) => day.cover?.thumb_path).filter(Boolean),
      ];
      thumbs = await signedUrls(paths);
      render();
    } catch (error) {
      body.replaceChildren(h('p', { class: 'status status--error' }, friendlyError(error)));
    }
  }

  async function upload(items) {
    if (!items.length || busy) return;
    busy = true;
    const bar = createProgressBar();
    tray.replaceChildren(bar.el);
    bar.set(0, items.length, 'Getting your photos ready…');
    let failed = items;
    try {
      failed = await uploadBatch(items, {
        onProgress: (done, total) => bar.set(done, total, `Adding photo ${Math.min(done + 1, total)} of ${total}…`),
      });
    } catch (error) {
      items.forEach((item) => (item.error = error));
    }
    busy = false;
    tray.replaceChildren();
    if (failed.length) {
      tray.append(
        h(
          'div',
          { class: 'tray-message' },
          h(
            'p',
            { class: 'status status--error' },
            `${plural(failed.length, 'photo')} could not be added. ${friendlyError(failed[0].error)}`,
          ),
          h('button', { class: 'btn btn--small', type: 'button', onclick: () => upload(failed) }, 'Try again'),
        ),
      );
    }
    await touched();
  }

  function addPhotos(memoryId) {
    pickPhotos(async (files) => {
      const { readCapture, isImage } = await import('../lib/imagePipeline.js');
      const items = [];
      for (const file of files.filter(isImage)) {
        const capture = await readCapture(file);
        items.push({ file, date, takenAt: capture?.takenAt ?? null, memoryId });
      }
      upload(items);
    });
  }

  function memoryCard(memory, dayPhotos) {
    const cover = coverOf(memories);
    return h(
      'section',
      { class: 'memory' },
      h(
        'div',
        { class: 'memory-head' },
        h('h3', { class: 'memory-title' }, `${memory.featured ? '★ ' : ''}${memory.title || 'Untitled memory'}`),
        h(
          'button',
          {
            class: 'btn btn--small',
            type: 'button',
            onclick: () => openMemoryForm({ memory, date, onSaved: touched }),
          },
          'Edit',
        ),
      ),
      memory.note && h('p', { class: 'memory-note' }, memory.note),
      memory.caption && h('p', { class: 'memory-caption' }, memory.caption),
      memory.photos.length > 0 &&
        h(
          'div',
          { class: 'photo-grid' },
          memory.photos.map((photo) =>
            h(
              'button',
              {
                class: `photo-slot${cover?.id === photo.id ? ' photo-slot--cover' : ''}`,
                type: 'button',
                'aria-label': `Open photo ${dayPhotos.indexOf(photo) + 1} of ${dayPhotos.length}${cover?.id === photo.id ? ' (cover photo)' : ''}`,
                onclick: () => openPhotoViewer({ memories, startId: photo.id, onChange: touched }),
              },
              h('img', { src: thumbs.get(photo.thumb_path) ?? '', alt: '', loading: 'lazy', decoding: 'async' }),
            ),
          ),
        ),
      h(
        'div',
        { class: 'memory-foot' },
        h('span', { class: 'memory-by' }, names.get(memory.created_by) ? `Added by ${names.get(memory.created_by)}` : ''),
        h('button', { class: 'btn btn--small btn--green', type: 'button', onclick: () => addPhotos(memory.id) }, 'Add photos'),
      ),
    );
  }

  function render() {
    const dayPhotos = photosOf(memories);
    const parts_ = [];

    if (memories.length) {
      parts_.push(...memories.map((memory) => memoryCard(memory, dayPhotos)));
    } else {
      parts_.push(
        h(
          'div',
          { class: 'chest-empty' },
          pixelArt(LILY, 'empty-lily'),
          h('p', null, 'This chest is empty. Put your first memory of the day inside.'),
        ),
      );
    }

    parts_.push(
      h(
        'div',
        { class: 'chest-actions' },
        h(
          'button',
          { class: 'btn', type: 'button', onclick: () => openMemoryForm({ date, onSaved: touched }) },
          memories.length ? 'New memory' : 'Write a note',
        ),
        !memories.length &&
          h('button', { class: 'btn btn--green', type: 'button', onclick: () => addPhotos() }, 'Add photos'),
      ),
    );

    parts_.push(
      h(
        'section',
        { class: 'on-this-day' },
        h('h3', { class: 'on-this-day-title' }, 'On this day'),
        onThisDay.length
          ? h(
              'div',
              { class: 'on-this-day-row' },
              onThisDay.map((day) =>
                h(
                  'button',
                  {
                    class: 'photo-slot year-slot',
                    type: 'button',
                    'aria-label': `Open ${longDate(day.date)}`,
                    onclick: () => {
                      modal.close();
                      openChest(day.date, { onChange });
                    },
                  },
                  day.cover && h('img', { src: thumbs.get(day.cover.thumb_path) ?? '', alt: '', loading: 'lazy' }),
                  h('span', { class: 'year-label' }, String(parts(day.date).year)),
                ),
              ),
            )
          : h('p', { class: 'hint' }, `No memories from other years on ${monthDay(date)} yet.`),
      ),
    );

    body.replaceChildren(...parts_);
  }

  body.append(h('p', { class: 'hint' }, 'Opening the chest…'));
  load();
}
