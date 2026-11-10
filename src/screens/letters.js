import { h, friendlyError } from '../lib/dom.js';
import { pixelArt } from '../art/pixel.js';
import { ICON_QUILL, LILY } from '../art/sprites.js';
import { todayManila, isValidDate } from '../lib/dates.js';
import { getUserId, loadMemberNames, loadProfile } from '../session.js';
import { fetchLetters, sendLetter, markLetterRead, cancelLetter, fetchComments, addComment, removeComment } from '../data/letters.js';
import { fetchHearts } from '../data/hearts.js';
import { checkAdvancements } from '../data/advancements.js';
import { openModal, confirmDialog } from '../components/modal.js';
import { createHeartButton } from '../components/heartButton.js';
import { playDone } from '../lib/sound.js';

const manila = (options) => new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Manila', ...options });
// "November 13, 2026"
const dayText = (iso) => manila({ month: 'long', day: 'numeric', year: 'numeric' }).format(new Date(iso));
// "November 13, 2026, 8:00 AM"
const momentText = (iso) =>
  `${dayText(iso)}, ${manila({ hour: 'numeric', minute: '2-digit', hour12: true }).format(new Date(iso))}`;

const COVERS = ['green', 'rose', 'blue', 'plum', 'amber'];

// Where a letter you sent is on its journey.
function journey(letter) {
  if (letter.cancelled) return { label: 'Taken back', tone: 'quiet' };
  if (letter.read_at) return { label: 'Read', tone: 'done' };
  if (letter.delivered) return { label: 'Delivered', tone: 'done' };
  if (letter.delivery_mode === 'surprise') return { label: 'Drifting…', tone: 'waiting' };
  return { label: `Arrives ${momentText(letter.deliver_at)}`, tone: 'waiting' };
}

// The open book where a letter is read, hearted, and answered with comments.
function openLetter({ letter, names, hearts, onChange }) {
  const me = getUserId();
  const comments = h('div', { class: 'comment-list' });
  const input = h('input', { class: 'input', type: 'text', maxlength: '2000', placeholder: 'Write a little reply…', 'aria-label': 'Add a comment', required: true });
  const status = h('p', { class: 'status status--error', role: 'alert' });
  let changed = false;

  const modal = openModal(
    {
      label: letter.title || 'A letter',
      className: 'book book--letter',
      onClose: () => {
        if (changed) onChange();
      },
    },
    h(
      'div',
      { class: 'page' },
      h(
        'div',
        { class: 'page-corner' },
        createHeartButton('letter', letter.id, hearts.get(letter.id)),
        h('button', { class: 'btn btn--small', type: 'button', 'aria-label': 'Close', onclick: () => modal.close() }, '×'),
      ),
      h('h2', { class: 'page-title' }, letter.title || 'A letter for you'),
      h('p', { class: 'page-date' }, letter.delivered ? dayText(letter.deliver_at) : `Written ${dayText(letter.created_at)}`),
      h('p', { class: 'page-body' }, letter.body),
      h('p', { class: 'page-sign' }, `With love, ${names.get(letter.sender_id) ?? 'me'}`),
      h(
        'section',
        { class: 'comments' },
        h('h3', { class: 'comments-title' }, 'Little replies'),
        comments,
        h(
          'form',
          {
            class: 'input-row',
            onsubmit: async (event) => {
              event.preventDefault();
              const body = input.value.trim();
              if (!body) return;
              try {
                await addComment(letter.id, body);
                input.value = '';
                status.textContent = '';
                await loadComments();
              } catch (error) {
                status.textContent = friendlyError(error);
              }
            },
          },
          input,
          h('button', { class: 'btn btn--green', type: 'submit' }, 'Send'),
        ),
        status,
      ),
    ),
  );

  async function loadComments() {
    try {
      const rows = await fetchComments(letter.id);
      comments.replaceChildren(
        ...(rows.length
          ? rows.map((comment) =>
              h(
                'p',
                { class: 'comment' },
                h('span', { class: 'comment-name' }, `${names.get(comment.author_id) ?? 'Someone'}: `),
                comment.body,
                comment.author_id === me &&
                  h(
                    'button',
                    {
                      class: 'comment-remove',
                      type: 'button',
                      'aria-label': 'Remove your reply',
                      onclick: async () => {
                        try {
                          await removeComment(comment.id);
                          await loadComments();
                        } catch (error) {
                          status.textContent = friendlyError(error);
                        }
                      },
                    },
                    '×',
                  ),
              ),
            )
          : [h('p', { class: 'comment comment--none' }, 'No replies yet.')]),
      );
    } catch (error) {
      status.textContent = friendlyError(error);
    }
  }

  loadComments();
  if (letter.recipient_id === me && letter.delivered && !letter.read_at) {
    markLetterRead(letter.id)
      .then(() => {
        changed = true;
        checkAdvancements();
      })
      .catch(() => {
        // It will be marked the next time it is opened.
      });
  }
}

// The writing desk: a blank page, and three ways to send it.
function openCompose({ partnerName, myName, onSent }) {
  const title = h('input', { class: 'input page-input', id: 'letter-title', type: 'text', maxlength: '200', placeholder: 'A title (optional)' });
  const body = h('textarea', { class: 'input page-input page-textarea', id: 'letter-body', rows: '9', maxlength: '50000', placeholder: `Dear ${partnerName},`, required: true });
  const status = h('p', { class: 'status status--error', role: 'alert' });
  const send = h('button', { class: 'btn btn--green', type: 'submit' }, 'Send');

  const radio = (value, checked = false) => h('input', { type: 'radio', name: 'letter-mode', id: `letter-mode-${value}`, value, checked });
  const modes = { now: radio('now', true), scheduled: radio('scheduled'), surprise: radio('surprise') };

  const date = h('input', { class: 'input', id: 'letter-date', type: 'date', value: todayManila(), min: todayManila() });
  const hour = h('select', { class: 'input', id: 'letter-hour', 'aria-label': 'Hour' }, Array.from({ length: 12 }, (_, i) => h('option', { value: String(i + 1), selected: i + 1 === 8 }, String(i + 1))));
  const minute = h('select', { class: 'input', id: 'letter-minute', 'aria-label': 'Minute' }, Array.from({ length: 12 }, (_, i) => h('option', { value: String(i * 5) }, String(i * 5).padStart(2, '0'))));
  const half = h('select', { class: 'input', id: 'letter-half', 'aria-label': 'AM or PM' }, h('option', { value: 'AM', selected: true }, 'AM'), h('option', { value: 'PM' }, 'PM'));
  const whenFields = h(
    'div',
    { class: 'when-fields', hidden: true },
    h('div', { class: 'field' }, h('label', { for: 'letter-date' }, 'Day'), date),
    h('div', { class: 'field' }, h('label', { for: 'letter-hour' }, 'Time (Manila)'), h('div', { class: 'time-row' }, hour, h('span', { 'aria-hidden': 'true' }, ':'), minute, half)),
  );

  const range = h(
    'select',
    { class: 'input', id: 'letter-range' },
    [[7, 'the next 7 days'], [30, 'the next 30 days'], [90, 'the next 90 days']].map(([days, label]) =>
      h('option', { value: String(days), selected: days === 30 }, `Sometime in ${label}`),
    ),
  );
  const surpriseFields = h(
    'div',
    { class: 'field', hidden: true },
    h('label', { for: 'letter-range' }, 'When should it wash ashore?'),
    range,
    h('p', { class: 'hint' }, 'The exact moment is picked in secret, between 8:00 AM and 10:00 PM. Not even you will know.'),
  );

  const showFields = () => {
    whenFields.hidden = !modes.scheduled.checked;
    surpriseFields.hidden = !modes.surprise.checked;
  };
  Object.values(modes).forEach((input) => input.addEventListener('change', showFields));

  const modal = openModal(
    { label: 'Write a letter', className: 'book book--letter', dismissible: false },
    h(
      'form',
      {
        class: 'page',
        onsubmit: async (event) => {
          event.preventDefault();
          const words = body.value.trim();
          if (!words) {
            status.textContent = 'A letter needs some words in it.';
            return;
          }
          const letter = { title: title.value.trim() || null, body: words, mode: 'now' };
          if (modes.scheduled.checked) {
            if (!isValidDate(date.value)) {
              status.textContent = 'Please choose a day for the letter to arrive.';
              return;
            }
            const hours = (Number(hour.value) % 12) + (half.value === 'PM' ? 12 : 0);
            letter.mode = 'scheduled';
            letter.deliverAt = `${date.value}T${String(hours).padStart(2, '0')}:${String(minute.value).padStart(2, '0')}:00+08:00`;
            if (new Date(letter.deliverAt) <= new Date()) {
              status.textContent = 'That time has already passed. Pick a later one, or send it now.';
              return;
            }
          } else if (modes.surprise.checked) {
            letter.mode = 'surprise';
            letter.days = Number(range.value);
          }
          send.disabled = true;
          try {
            await sendLetter(letter);
            playDone();
            modal.close();
            onSent(letter.mode);
          } catch (error) {
            status.textContent = friendlyError(error);
            send.disabled = false;
          }
        },
      },
      pixelArt(ICON_QUILL, 'page-quill'),
      h('h2', { class: 'page-title' }, `A letter to ${partnerName}`),
      h('label', { class: 'visually-hidden', for: 'letter-title' }, 'Title'),
      title,
      h('label', { class: 'visually-hidden', for: 'letter-body' }, 'Your letter'),
      body,
      h('p', { class: 'page-sign' }, `With love, ${myName}`),
      h(
        'fieldset',
        { class: 'choice' },
        h('legend', null, 'How should it travel?'),
        h('label', { class: 'check', for: 'letter-mode-now' }, modes.now, 'Deliver it now'),
        h('label', { class: 'check', for: 'letter-mode-scheduled' }, modes.scheduled, 'Deliver it on a day and time'),
        h('label', { class: 'check', for: 'letter-mode-surprise' }, modes.surprise, 'Surprise: a message in a bottle'),
      ),
      whenFields,
      surpriseFields,
      status,
      h(
        'div',
        { class: 'button-row' },
        h(
          'button',
          {
            class: 'btn',
            type: 'button',
            onclick: async () => {
              if (body.value.trim() && !(await confirmDialog({ message: 'Throw this letter away?', confirmLabel: 'Throw away', danger: true }))) return;
              modal.close();
            },
          },
          'Cancel',
        ),
        send,
      ),
    ),
  );
  body.focus();
}

// The letters screen: a shelf of letters you received, and the ones you sent.
export function createLetters() {
  const me = getUserId();
  const shelf = h('div', { class: 'shelf' });
  const sentList = h('div', { class: 'sent-list' });
  const status = h('p', { class: 'status', role: 'status' });
  let letters = [];
  let names = new Map();
  let hearts = new Map();
  let myName = 'me';

  const say = (message, isError = false) => {
    status.textContent = message;
    status.classList.toggle('status--error', isError);
  };

  const open = (letter) => openLetter({ letter, names, hearts, onChange: load });

  function render() {
    const inbox = letters.filter((letter) => letter.recipient_id === me);
    const sent = letters.filter((letter) => letter.sender_id === me);

    shelf.replaceChildren(
      ...(inbox.length
        ? inbox.map((letter, i) =>
            h(
              'button',
              {
                class: `letter-book letter-book--${COVERS[i % COVERS.length]}${letter.read_at ? '' : ' letter-book--new'}`,
                type: 'button',
                'aria-label': `${letter.read_at ? '' : 'New: '}${letter.title || 'A letter'} from ${names.get(letter.sender_id) ?? 'your partner'}, ${dayText(letter.deliver_at)}`,
                onclick: () => open(letter),
              },
              !letter.read_at && h('span', { class: 'letter-new' }, 'New'),
              h('span', { class: 'letter-label' }, letter.title || 'A letter'),
              h('span', { class: 'letter-date' }, dayText(letter.deliver_at)),
            ),
          )
        : [
            h(
              'div',
              { class: 'shelf-empty' },
              pixelArt(LILY, 'empty-lily'),
              h('p', null, 'No letters have arrived yet. Maybe one is on its way.'),
            ),
          ]),
    );

    sentList.replaceChildren(
      ...(sent.length
        ? sent.map((letter) => {
            const state = journey(letter);
            const waiting = !letter.delivered && !letter.cancelled;
            return h(
              'article',
              { class: 'sent-letter' },
              h(
                'button',
                { class: 'sent-open', type: 'button', onclick: () => open(letter) },
                h('span', { class: 'sent-title' }, letter.title || 'A letter'),
                h('span', { class: `sent-state sent-state--${state.tone}` }, state.label),
                h('span', { class: 'sent-date' }, `Written ${dayText(letter.created_at)}`),
              ),
              waiting &&
                h(
                  'button',
                  {
                    class: 'btn btn--small',
                    type: 'button',
                    onclick: async () => {
                      const sure = await confirmDialog({ message: 'Take this letter back before it arrives?', confirmLabel: 'Take it back', danger: true });
                      if (!sure) return;
                      try {
                        const cancelled = await cancelLetter(letter.id);
                        say(cancelled ? 'The letter was taken back.' : 'Too late: it has already arrived.', !cancelled);
                        await load();
                      } catch (error) {
                        say(friendlyError(error), true);
                      }
                    },
                  },
                  'Take back',
                ),
            );
          })
        : [h('p', { class: 'hint' }, 'You have not sent any letters yet.')]),
    );
  }

  async function load() {
    try {
      const [rows, memberNames, heartMap, profile] = await Promise.all([
        fetchLetters(),
        loadMemberNames(),
        fetchHearts('letter').catch(() => new Map()),
        loadProfile(),
      ]);
      letters = rows;
      names = memberNames;
      hearts = heartMap;
      myName = profile?.display_name ?? 'me';
      render();
    } catch (error) {
      say(friendlyError(error), true);
    }
  }

  const el = h(
    'div',
    { class: 'letters' },
    h(
      'div',
      { class: 'desk-tools desk-tools--row' },
      h(
        'button',
        {
          class: 'btn btn--green',
          type: 'button',
          onclick: () => {
            const partnerName = [...names].find(([id]) => id !== me)?.[1] ?? 'you';
            openCompose({
              partnerName,
              myName,
              onSent: async (mode) => {
                say(
                  mode === 'surprise'
                    ? 'Sealed in a bottle and set adrift.'
                    : mode === 'scheduled'
                      ? 'Your letter is waiting for its day.'
                      : 'Your letter was delivered.',
                );
                await load();
                checkAdvancements();
              },
            });
          },
        },
        pixelArt(ICON_QUILL, 'btn-icon'),
        'Write a letter',
      ),
    ),
    status,
    h('section', { class: 'panel shelf-panel' }, h('h2', { class: 'panel-title' }, 'Letters for you'), shelf),
    h('section', { class: 'panel' }, h('h2', { class: 'panel-title' }, 'Letters you sent'), sentList),
  );

  load();
  return el;
}
