import { h, friendlyError, pickPhotos, plural } from '../lib/dom.js';
import { longDate, isValidDate } from '../lib/dates.js';
import { uploadBatch } from '../lib/uploader.js';
import { openModal } from '../components/modal.js';
import { createProgressBar } from '../components/progressBar.js';

const PREVIEWS_PER_DAY = 8;

// Add many photos at once. Each photo is filed under the day it was taken;
// photos without a date ask for one. Nothing uploads until the list is approved.
export function openBulkUpload({ onDone } = {}) {
  let items = []; // { file, date, takenAt }
  let uploadedAny = false;
  const previewUrls = [];

  const body = h('div', { class: 'bulk-body' });
  const modal = openModal(
    {
      label: 'Add photos',
      className: 'bulk',
      dismissible: false,
      onClose: () => {
        clearPreviews();
        if (uploadedAny) onDone?.();
      },
    },
    h('h2', { class: 'panel-title' }, 'Add photos'),
    body,
  );

  function clearPreviews() {
    previewUrls.splice(0).forEach((url) => URL.revokeObjectURL(url));
  }

  function preview(file) {
    const url = URL.createObjectURL(file);
    previewUrls.push(url);
    const img = h('img', { src: url, alt: '', loading: 'lazy', decoding: 'async' });
    const tile = h('span', { class: 'bulk-thumb' }, img);
    // Some browsers cannot preview iPhone HEIC photos; they still upload fine.
    img.onerror = () => tile.replaceChildren(h('span', { class: 'bulk-thumb-type' }, 'HEIC'));
    return tile;
  }

  const closeButton = (label = 'Cancel') =>
    h('button', { class: 'btn', type: 'button', onclick: () => modal.close() }, label);

  function showStart() {
    body.replaceChildren(
      h(
        'p',
        { class: 'hint' },
        'Choose as many photos as you like. Each one goes into the day it was taken, and you can check the dates before anything is uploaded.',
      ),
      h(
        'div',
        { class: 'button-row' },
        closeButton(),
        h('button', { class: 'btn btn--green', type: 'button', onclick: () => pickPhotos(read) }, 'Choose photos'),
      ),
    );
  }

  async function read(files) {
    const bar = createProgressBar();
    body.replaceChildren(bar.el);
    bar.set(0, files.length, 'Reading the dates…');
    try {
      const { readCapture, isImage } = await import('../lib/imagePipeline.js');
      const images = files.filter(isImage);
      for (let i = 0; i < images.length; i += 1) {
        const capture = await readCapture(images[i]);
        items.push({ file: images[i], date: capture?.date ?? null, takenAt: capture?.takenAt ?? null });
        bar.set(i + 1, images.length, `Reading the dates… ${i + 1} of ${images.length}`);
      }
      showReview();
    } catch (error) {
      body.replaceChildren(
        h('p', { class: 'status status--error' }, friendlyError(error)),
        h('div', { class: 'button-row' }, closeButton('Close')),
      );
    }
  }

  function showReview() {
    clearPreviews();
    if (!items.length) {
      showStart();
      return;
    }
    const undated = items.filter((item) => !item.date);
    const days = new Map();
    for (const item of items) {
      if (!item.date) continue;
      if (!days.has(item.date)) days.set(item.date, []);
      days.get(item.date).push(item);
    }
    const sortedDays = [...days].sort(([a], [b]) => a.localeCompare(b));

    const sections = [];
    if (undated.length) {
      sections.push(
        h(
          'section',
          { class: 'bulk-group bulk-group--undated' },
          h('h3', { class: 'bulk-heading' }, `${plural(undated.length, 'photo')} with no date`),
          h('p', { class: 'hint' }, 'These did not come with a date (screenshots and saved photos often do not). Give each one a day, or leave it out.'),
          undated.map((item) =>
            h(
              'div',
              { class: 'bulk-row' },
              preview(item.file),
              h(
                'div',
                { class: 'bulk-row-main' },
                h('span', { class: 'bulk-name' }, item.file.name),
                h('input', {
                  class: 'input',
                  type: 'date',
                  'aria-label': `Date for ${item.file.name}`,
                  onchange: (event) => {
                    if (isValidDate(event.target.value)) {
                      item.date = event.target.value;
                      showReview();
                    }
                  },
                }),
              ),
              h(
                'button',
                {
                  class: 'btn btn--small',
                  type: 'button',
                  'aria-label': `Leave out ${item.file.name}`,
                  onclick: () => {
                    items = items.filter((other) => other !== item);
                    showReview();
                  },
                },
                'Leave out',
              ),
            ),
          ),
        ),
      );
    }
    for (const [date, list] of sortedDays) {
      sections.push(
        h(
          'section',
          { class: 'bulk-group' },
          h(
            'div',
            { class: 'bulk-group-head' },
            h('h3', { class: 'bulk-heading' }, longDate(date)),
            h('span', { class: 'bulk-count' }, plural(list.length, 'photo')),
          ),
          h(
            'div',
            { class: 'bulk-thumbs' },
            list.slice(0, PREVIEWS_PER_DAY).map((item) => preview(item.file)),
            list.length > PREVIEWS_PER_DAY &&
              h('span', { class: 'bulk-thumb bulk-thumb--more' }, `+${list.length - PREVIEWS_PER_DAY}`),
          ),
          h(
            'label',
            { class: 'bulk-move' },
            'Move these to another day:',
            h('input', {
              class: 'input',
              type: 'date',
              value: date,
              onchange: (event) => {
                if (isValidDate(event.target.value)) {
                  list.forEach((item) => (item.date = event.target.value));
                  showReview();
                }
              },
            }),
          ),
        ),
      );
    }

    const ready = items.length - undated.length;
    body.replaceChildren(
      h(
        'p',
        { class: 'hint' },
        `${plural(items.length, 'photo')} across ${plural(sortedDays.length, 'day')}. Check that the days look right.`,
      ),
      h('div', { class: 'bulk-list' }, sections),
      h(
        'div',
        { class: 'button-row bulk-footer' },
        closeButton(),
        h('button', { class: 'btn', type: 'button', onclick: () => pickPhotos(read) }, 'Add more'),
        h(
          'button',
          {
            class: 'btn btn--green',
            type: 'button',
            disabled: undated.length > 0 || ready === 0,
            title: undated.length ? 'Give every photo a date first' : null,
            onclick: () => upload(items),
          },
          `Upload ${plural(ready, 'photo')}`,
        ),
      ),
    );
  }

  async function upload(batch) {
    clearPreviews();
    const bar = createProgressBar();
    body.replaceChildren(
      bar.el,
      h('p', { class: 'hint' }, 'Please keep this screen open until it finishes. Large batches can take a few minutes.'),
    );
    bar.set(0, batch.length, 'Getting your photos ready…');
    let failed = batch;
    try {
      failed = await uploadBatch(batch, {
        onProgress: (done, total) => bar.set(done, total, `Uploaded ${done} of ${total}`),
      });
    } catch (error) {
      batch.forEach((item) => (item.error = error));
    }
    const saved = batch.length - failed.length;
    if (saved) uploadedAny = true;
    items = failed;

    body.replaceChildren(
      failed.length
        ? h(
            'p',
            { class: 'status status--error' },
            `${saved ? `${plural(saved, 'photo')} uploaded. ` : ''}${plural(failed.length, 'photo')} could not be uploaded. ${friendlyError(failed[0].error)}`,
          )
        : h('p', { class: 'status' }, `All done! ${plural(saved, 'photo')} tucked into the calendar.`),
      h(
        'div',
        { class: 'button-row' },
        closeButton(failed.length ? 'Close' : 'Done'),
        failed.length > 0 &&
          h('button', { class: 'btn btn--green', type: 'button', onclick: () => upload(failed) }, 'Try those again'),
      ),
    );
  }

  showStart();
}
