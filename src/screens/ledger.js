import { h, friendlyError } from '../lib/dom.js';
import { pixelArt } from '../art/pixel.js';
import { ICON_EMERALD, ICON_HEART } from '../art/sprites.js';
import { todayManila, isValidDate, parts, MONTH_NAMES } from '../lib/dates.js';
import { getUserId } from '../session.js';
import { loadPartner } from '../data/pokes.js';
import { fetchLedger, addLedgerEntry, updateLedgerEntry, removeLedgerEntry, balanceFor, pesos } from '../data/ledger.js';
import { lilyLoader } from '../components/loader.js';
import { playPage } from '../lib/sound.js';
import { openModal, confirmDialog } from '../components/modal.js';
import { playDone } from '../lib/sound.js';

const MONTH_LONG = (date) => MONTH_NAMES[parts(date).month - 1];

const shortDate = (date) => `${MONTH_NAMES[parts(date).month - 1].slice(0, 3)} ${parts(date).day}`;

// The ledger is an open book on a desk. The buttons sit beside it; the pages
// fill in as the two of you write things down.
export function createLedger() {
  const me = getUserId();
  let partner = { id: null, name: 'your partner' };
  let entries = [];

  const noteText = h('p', { class: 'sticky-text' }, 'Counting the emeralds…');
  const noteAmount = h('p', { class: 'sticky-amount' });
  const settleButton = h('button', { class: 'btn', type: 'button', hidden: true, onclick: () => openSettle() }, 'Settle up');
  const summary = h('div', { class: 'page-summary' });
  const lines = h('div', { class: 'book-lines' });
  const status = h('p', { class: 'status', role: 'status' });

  const say = (message, isError = false) => {
    status.textContent = message;
    status.classList.toggle('status--error', isError);
  };
  const who = (id) => (id === me ? 'You' : partner.name);

  function render() {
    const balance = balanceFor(entries, me);
    if (balance > 0) {
      noteText.textContent = `${partner.name} owes you`;
      noteAmount.textContent = pesos(balance);
    } else if (balance < 0) {
      noteText.textContent = `You owe ${partner.name}`;
      noteAmount.textContent = pesos(-balance);
    } else {
      noteText.textContent = 'All square!';
      noteAmount.textContent = '';
    }
    settleButton.hidden = balance === 0;

    const paid = (id) =>
      entries.filter((entry) => entry.kind === 'expense' && entry.paid_by === id).reduce((sum, entry) => sum + entry.amount, 0);
    const month = todayManila().slice(0, 7);
    const thisMonth = entries.filter((entry) => entry.kind === 'expense' && entry.entry_date.startsWith(month));
    const monthPaid = (id) => thisMonth.filter((entry) => entry.paid_by === id).reduce((sum, entry) => sum + entry.amount, 0);
    const treats = (id) => thisMonth.filter((entry) => entry.split === 'treat' && entry.paid_by === id).length;
    summary.replaceChildren(
      h('p', { class: 'summary-head' }, `This ${MONTH_LONG(todayManila())}`),
      h('p', { class: 'summary-line' }, h('span', null, 'You paid'), h('span', null, pesos(monthPaid(me)))),
      h('p', { class: 'summary-line' }, h('span', null, `${partner.name} paid`), h('span', null, pesos(monthPaid(partner.id)))),
      h('p', { class: 'summary-line' }, h('span', null, 'Together'), h('span', null, pesos(monthPaid(me) + monthPaid(partner.id)))),
      (treats(me) > 0 || treats(partner.id) > 0) &&
        h('p', { class: 'summary-line' }, h('span', null, 'Treats'), h('span', null, `You ${treats(me)}, ${partner.name} ${treats(partner.id)}`)),
      h('p', { class: 'summary-head' }, 'All time'),
      h('p', { class: 'summary-line' }, h('span', null, 'You have paid'), h('span', null, pesos(paid(me)))),
      h('p', { class: 'summary-line' }, h('span', null, `${partner.name} has paid`), h('span', null, pesos(paid(partner.id)))),
      h(
        'p',
        { class: 'summary-balance' },
        balance === 0
          ? 'Nobody owes anybody anything.'
          : balance > 0
            ? `${partner.name} owes you ${pesos(balance)}.`
            : `You owe ${partner.name} ${pesos(-balance)}.`,
      ),
    );

    lines.replaceChildren(
      ...(entries.length
        ? entries.map((entry) => {
            const settlement = entry.kind === 'settlement';
            const detail = settlement
              ? `${who(entry.paid_by)} paid ${entry.paid_by === me ? partner.name : 'you'} back`
              : entry.split === 'treat'
                ? `${entry.paid_by === me ? 'Your' : `${partner.name}’s`} treat`
                : `${who(entry.paid_by)} paid, ${entry.split === 'half' ? 'shared' : `${entry.paid_by === me ? `${partner.name} owes` : 'you owe'} it all`}`;
            return h(
              'div',
              { class: `book-line${settlement ? ' book-line--settlement' : ''}` },
              h('span', { class: 'line-date' }, shortDate(entry.entry_date)),
              h(
                settlement ? 'span' : 'button',
                settlement
                  ? { class: 'line-what' }
                  : { class: 'line-what line-edit', type: 'button', 'aria-label': `Edit ${entry.description || 'this entry'}`, onclick: () => openExpense(entry) },
                h('span', { class: 'line-title' }, settlement ? 'Settled up' : entry.description || 'Something nice'),
                h('span', { class: 'line-detail' }, detail),
              ),
              h('span', { class: 'line-amount' }, pesos(entry.amount)),
              h(
                'button',
                {
                  class: 'line-remove',
                  type: 'button',
                  'aria-label': `Cross out ${settlement ? 'this settlement' : entry.description || 'this entry'}`,
                  onclick: async () => {
                    const sure = await confirmDialog({ message: 'Cross this line out of the ledger?', confirmLabel: 'Cross it out', danger: true });
                    if (!sure) return;
                    try {
                      await removeLedgerEntry(entry.id);
                      await load();
                    } catch (error) {
                      say(friendlyError(error), true);
                    }
                  },
                },
                '×',
              ),
            );
          })
        : [h('p', { class: 'book-empty' }, 'These pages are still blank. Write down the first thing one of you paid for.')]),
    );
  }

  lines.append(lilyLoader('Opening the ledger…'));
  playPage();

  async function load() {
    try {
      const [rows, other] = await Promise.all([fetchLedger(), loadPartner()]);
      entries = rows;
      if (other) partner = other;
      render();
    } catch (error) {
      noteText.textContent = 'The ledger would not open.';
      say(friendlyError(error), true);
    }
  }

  // Adds a new expense, or edits one when an entry is passed in.
  function openExpense(entry = null) {
    const description = h('input', { class: 'input', id: 'ledger-what', type: 'text', maxlength: '200', placeholder: 'Dinner, movie tickets, groceries…', required: true, value: entry?.description ?? '' });
    const amount = h('input', { class: 'input', id: 'ledger-amount', type: 'number', inputmode: 'decimal', min: '0.01', step: '0.01', placeholder: '0.00', required: true, value: entry ? entry.amount.toFixed(2) : '' });
    const date = h('input', { class: 'input', id: 'ledger-date', type: 'date', value: entry?.entry_date ?? todayManila(), required: true });
    const iPaid = !entry || entry.paid_by === me;
    const split = entry?.split ?? 'half';
    const payerMe = h('input', { type: 'radio', name: 'ledger-payer', id: 'ledger-payer-me', checked: iPaid });
    const payerPartner = h('input', { type: 'radio', name: 'ledger-payer', id: 'ledger-payer-partner', checked: !iPaid });
    const splitHalf = h('input', { type: 'radio', name: 'ledger-split', id: 'ledger-split-half', checked: split === 'half' });
    const splitFull = h('input', { type: 'radio', name: 'ledger-split', id: 'ledger-split-full', checked: split === 'full' });
    const splitTreat = h('input', { type: 'radio', name: 'ledger-split', id: 'ledger-split-treat', checked: split === 'treat' });
    const fullLabel = h('span');
    const treatLabel = h('span');
    const error = h('p', { class: 'status status--error', role: 'alert' });
    const save = h('button', { class: 'btn btn--green', type: 'submit' }, entry ? 'Save' : 'Write it down');
    const nameSplit = () => {
      fullLabel.textContent = payerMe.checked ? `${partner.name} owes all of it` : 'I owe all of it';
      treatLabel.textContent = payerMe.checked ? 'My treat (nobody owes)' : `${partner.name}’s treat (nobody owes)`;
    };
    nameSplit();
    payerMe.addEventListener('change', nameSplit);
    payerPartner.addEventListener('change', nameSplit);

    const modal = openModal(
      { label: entry ? 'Edit this line' : 'Add an expense', className: 'small-panel' },
      h(
        'form',
        {
          onsubmit: async (event) => {
            event.preventDefault();
            const value = Math.round(Number(amount.value) * 100) / 100;
            if (!(value > 0)) {
              error.textContent = 'Please enter an amount greater than zero.';
              return;
            }
            if (!isValidDate(date.value)) {
              error.textContent = 'Please choose a date.';
              return;
            }
            if (!partner.id) {
              error.textContent = 'Your partner could not be found yet. Please try again in a moment.';
              return;
            }
            save.disabled = true;
            try {
              const fields = {
                description: description.value.trim() || null,
                amount: value,
                paid_by: payerMe.checked ? me : partner.id,
                split: splitTreat.checked ? 'treat' : splitHalf.checked ? 'half' : 'full',
                entry_date: date.value,
              };
              if (entry) await updateLedgerEntry(entry.id, fields);
              else await addLedgerEntry({ kind: 'expense', ...fields });
              modal.close();
              await load();
              say(entry ? 'The line was changed.' : 'Written into the ledger.');
            } catch (problem) {
              error.textContent = friendlyError(problem);
              save.disabled = false;
            }
          },
        },
        h('h2', { class: 'panel-title' }, entry ? 'Edit this line' : 'Add an expense'),
        h('div', { class: 'field' }, h('label', { for: 'ledger-what' }, 'What was it for?'), description),
        h(
          'div',
          { class: 'field-pair' },
          h('div', { class: 'field' }, h('label', { for: 'ledger-amount' }, 'Amount (₱)'), amount),
          h('div', { class: 'field' }, h('label', { for: 'ledger-date' }, 'Date'), date),
        ),
        h(
          'fieldset',
          { class: 'choice' },
          h('legend', null, 'Who paid?'),
          h('label', { class: 'check', for: 'ledger-payer-me' }, payerMe, 'I paid'),
          h('label', { class: 'check', for: 'ledger-payer-partner' }, payerPartner, `${partner.name} paid`),
        ),
        h(
          'fieldset',
          { class: 'choice' },
          h('legend', null, 'How is it shared?'),
          h('label', { class: 'check', for: 'ledger-split-half' }, splitHalf, 'Shared equally'),
          h('label', { class: 'check', for: 'ledger-split-full' }, splitFull, fullLabel),
          h('label', { class: 'check', for: 'ledger-split-treat' }, splitTreat, treatLabel),
        ),
        error,
        h(
          'div',
          { class: 'button-row' },
          h('button', { class: 'btn', type: 'button', onclick: () => modal.close() }, 'Cancel'),
          save,
        ),
      ),
    );
    description.focus();
  }

  // Settle all of it, or just a part.
  function openSettle() {
    const balance = balanceFor(entries, me);
    if (!balance || !partner.id) return;
    const iPay = balance < 0;
    const owed = Math.abs(balance);
    const amount = h('input', { class: 'input', id: 'settle-amount', type: 'number', inputmode: 'decimal', min: '0.01', step: '0.01', value: owed.toFixed(2), required: true });
    const error = h('p', { class: 'status status--error', role: 'alert' });
    const save = h('button', { class: 'btn btn--green', type: 'submit' }, 'Settle');

    const modal = openModal(
      { label: 'Settle up', className: 'small-panel' },
      h(
        'form',
        {
          onsubmit: async (event) => {
            event.preventDefault();
            const value = Math.round(Number(amount.value) * 100) / 100;
            if (!(value > 0)) {
              error.textContent = 'Please enter an amount greater than zero.';
              return;
            }
            if (value > owed) {
              error.textContent = `That is more than what is owed (${pesos(owed)}).`;
              return;
            }
            save.disabled = true;
            try {
              await addLedgerEntry({ kind: 'settlement', amount: value, paid_by: iPay ? me : partner.id, split: 'full', entry_date: todayManila() });
              playDone();
              modal.close();
              await load();
              say(value === owed ? 'Settled. You are all square!' : `${pesos(value)} settled. ${pesos(owed - value)} to go.`);
            } catch (problem) {
              error.textContent = friendlyError(problem);
              save.disabled = false;
            }
          },
        },
        h('h2', { class: 'panel-title' }, 'Settle up'),
        h(
          'p',
          { class: 'hint' },
          iPay
            ? `You owe ${partner.name} ${pesos(owed)}. How much are you paying back now?`
            : `${partner.name} owes you ${pesos(owed)}. How much did ${partner.name} pay back?`,
        ),
        h('div', { class: 'field' }, h('label', { for: 'settle-amount' }, 'Amount (₱)'), amount),
        h(
          'div',
          { class: 'quick-row' },
          h('button', { class: 'btn btn--small', type: 'button', onclick: () => (amount.value = (Math.round(owed * 50) / 100).toFixed(2)) }, 'Half'),
          h('button', { class: 'btn btn--small', type: 'button', onclick: () => (amount.value = owed.toFixed(2)) }, 'All of it'),
        ),
        error,
        h(
          'div',
          { class: 'button-row' },
          h('button', { class: 'btn', type: 'button', onclick: () => modal.close() }, 'Cancel'),
          save,
        ),
      ),
    );
    amount.select();
  }

  const el = h(
    'div',
    { class: 'desk' },
    h(
      'aside',
      { class: 'desk-tools' },
      h('div', { class: 'sticky-note' }, pixelArt(ICON_EMERALD, 'sticky-coin'), noteText, noteAmount),
      h('button', { class: 'btn btn--green', type: 'button', onclick: () => openExpense() }, 'Add an expense'),
      settleButton,
      status,
    ),
    h(
      'div',
      { class: 'book' },
      h(
        'section',
        { class: 'page page--left' },
        h('p', { class: 'page-label', 'aria-hidden': 'true' }, 'Page 1 of 2'),
        h('h2', { class: 'page-title' }, 'Our Ledger'),
        h('p', { class: 'page-date' }, 'Kept with love, in pesos'),
        summary,
        pixelArt(ICON_HEART, 'page-doodle'),
      ),
      h(
        'section',
        { class: 'page page--right' },
        h('p', { class: 'page-label', 'aria-hidden': 'true' }, 'Page 2 of 2'),
        h('h2', { class: 'page-title page-title--small' }, 'What we spent'),
        lines,
      ),
    ),
  );

  load();
  return el;
}
