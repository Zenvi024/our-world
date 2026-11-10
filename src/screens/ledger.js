import { h, friendlyError } from '../lib/dom.js';
import { pixelArt } from '../art/pixel.js';
import { ICON_COIN } from '../art/sprites.js';
import { todayManila, isValidDate, parts, MONTH_NAMES } from '../lib/dates.js';
import { getUserId } from '../session.js';
import { loadPartner } from '../data/pokes.js';
import { fetchLedger, addLedgerEntry, removeLedgerEntry, balanceFor, pesos } from '../data/ledger.js';
import { confirmDialog } from '../components/modal.js';
import { playDone } from '../lib/sound.js';

const shortDate = (date) => `${MONTH_NAMES[parts(date).month - 1].slice(0, 3)} ${parts(date).day}, ${parts(date).year}`;

// The ledger: what each of you paid for, and who owes whom right now.
export function createLedger() {
  const me = getUserId();
  let partner = { id: null, name: 'your partner' };
  let entries = [];

  const balanceText = h('p', { class: 'balance-text' }, 'Counting the coins…');
  const balanceNote = h('p', { class: 'hint balance-note' });
  const settle = h('button', { class: 'btn', type: 'button', hidden: true, onclick: settleUp }, 'Settle up');
  const list = h('div', { class: 'ledger-list' });
  const status = h('p', { class: 'status', role: 'status' });

  const description = h('input', { class: 'input', id: 'ledger-what', type: 'text', maxlength: '200', placeholder: 'Dinner, movie tickets, groceries…', required: true });
  const amount = h('input', { class: 'input', id: 'ledger-amount', type: 'number', inputmode: 'decimal', min: '0.01', step: '0.01', placeholder: '0.00', required: true });
  const date = h('input', { class: 'input', id: 'ledger-date', type: 'date', value: todayManila(), required: true });
  const payerMe = h('input', { type: 'radio', name: 'ledger-payer', id: 'ledger-payer-me', value: 'me', checked: true });
  const payerPartner = h('input', { type: 'radio', name: 'ledger-payer', id: 'ledger-payer-partner', value: 'partner' });
  const splitHalf = h('input', { type: 'radio', name: 'ledger-split', id: 'ledger-split-half', value: 'half', checked: true });
  const splitFull = h('input', { type: 'radio', name: 'ledger-split', id: 'ledger-split-full', value: 'full' });
  const partnerLabel = h('span', null, 'My partner paid');
  const fullLabel = h('span', null, 'My partner owes all of it');
  const add = h('button', { class: 'btn btn--green', type: 'submit' }, 'Add');

  // "Jay owes all of it" or "I owe all of it", depending on who paid.
  const nameSplit = () => {
    fullLabel.textContent = payerMe.checked ? `${partner.name} owes all of it` : 'I owe all of it';
  };
  payerMe.addEventListener('change', nameSplit);
  payerPartner.addEventListener('change', nameSplit);

  const say = (message, isError = false) => {
    status.textContent = message;
    status.classList.toggle('status--error', isError);
  };

  function render() {
    const balance = balanceFor(entries, me);
    if (balance > 0) balanceText.textContent = `${partner.name} owes you ${pesos(balance)}`;
    else if (balance < 0) balanceText.textContent = `You owe ${partner.name} ${pesos(-balance)}`;
    else balanceText.textContent = 'All square!';
    balanceNote.textContent = balance === 0 ? 'Nobody owes anybody anything.' : 'Settle up once the money has changed hands.';
    settle.hidden = balance === 0;

    const who = (id) => (id === me ? 'You' : partner.name);
    const other = (id) => (id === me ? partner.name : 'you');
    list.replaceChildren(
      ...(entries.length
        ? entries.map((entry) =>
            h(
              'article',
              { class: `ledger-entry${entry.kind === 'settlement' ? ' ledger-entry--settlement' : ''}` },
              h(
                'div',
                { class: 'ledger-entry-main' },
                h('h3', { class: 'ledger-entry-title' }, entry.kind === 'settlement' ? 'Settled up' : entry.description || 'Expense'),
                h(
                  'p',
                  { class: 'ledger-entry-detail' },
                  entry.kind === 'settlement'
                    ? `${who(entry.paid_by)} paid ${other(entry.paid_by)} back`
                    : `${who(entry.paid_by)} paid, ${entry.split === 'half' ? 'shared equally' : `${other(entry.paid_by)} ${entry.paid_by === me ? 'owes' : 'owe'} all of it`}`,
                ),
                h('p', { class: 'ledger-entry-date' }, shortDate(entry.entry_date)),
              ),
              h('span', { class: 'ledger-entry-amount' }, pesos(entry.amount)),
              h(
                'button',
                {
                  class: 'btn btn--small ledger-remove',
                  type: 'button',
                  'aria-label': `Remove ${entry.description || 'this entry'}`,
                  onclick: async () => {
                    const sure = await confirmDialog({ message: 'Remove this entry from the ledger?', confirmLabel: 'Remove', danger: true });
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
            ),
          )
        : [h('p', { class: 'hint ledger-empty' }, 'Nothing in the ledger yet. Add the first thing one of you paid for.')]),
    );
  }

  async function load() {
    try {
      const [rows, other] = await Promise.all([fetchLedger(), loadPartner()]);
      entries = rows;
      if (other) {
        partner = other;
        partnerLabel.textContent = `${partner.name} paid`;
        nameSplit();
      }
      render();
    } catch (error) {
      balanceText.textContent = 'The ledger could not be opened.';
      say(friendlyError(error), true);
    }
  }

  async function settleUp() {
    const balance = balanceFor(entries, me);
    if (!balance || !partner.id) return;
    const iPay = balance < 0;
    const sure = await confirmDialog({
      message: iPay
        ? `Record that you paid ${partner.name} ${pesos(-balance)}?`
        : `Record that ${partner.name} paid you ${pesos(balance)}?`,
      confirmLabel: 'Settle up',
    });
    if (!sure) return;
    try {
      await addLedgerEntry({
        kind: 'settlement',
        amount: Math.abs(balance),
        paid_by: iPay ? me : partner.id,
        split: 'full',
        entry_date: todayManila(),
      });
      playDone();
      await load();
      say('Settled. You are all square!');
    } catch (error) {
      say(friendlyError(error), true);
    }
  }

  const form = h(
    'form',
    {
      onsubmit: async (event) => {
        event.preventDefault();
        const value = Math.round(Number(amount.value) * 100) / 100;
        if (!(value > 0)) {
          say('Please enter an amount greater than zero.', true);
          return;
        }
        if (!isValidDate(date.value)) {
          say('Please choose a date.', true);
          return;
        }
        if (!partner.id) {
          say('Your partner could not be found yet. Please try again in a moment.', true);
          return;
        }
        add.disabled = true;
        try {
          await addLedgerEntry({
            kind: 'expense',
            description: description.value.trim() || null,
            amount: value,
            paid_by: payerMe.checked ? me : partner.id,
            split: splitHalf.checked ? 'half' : 'full',
            entry_date: date.value,
          });
          description.value = '';
          amount.value = '';
          await load();
          say('Added to the ledger.');
        } catch (error) {
          say(friendlyError(error), true);
        }
        add.disabled = false;
      },
    },
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
      h('label', { class: 'check', for: 'ledger-payer-partner' }, payerPartner, partnerLabel),
    ),
    h(
      'fieldset',
      { class: 'choice' },
      h('legend', null, 'How is it shared?'),
      h('label', { class: 'check', for: 'ledger-split-half' }, splitHalf, 'Shared equally'),
      h('label', { class: 'check', for: 'ledger-split-full' }, splitFull, fullLabel),
    ),
    status,
    h('div', { class: 'button-row' }, add),
  );

  const el = h(
    'div',
    { class: 'ledger' },
    h(
      'section',
      { class: 'panel balance-panel' },
      pixelArt(ICON_COIN, 'balance-coin'),
      h('div', { class: 'balance-words' }, balanceText, balanceNote),
      settle,
    ),
    h('section', { class: 'panel' }, h('h2', { class: 'panel-title' }, 'Add an expense'), form),
    h('section', { class: 'panel' }, h('h2', { class: 'panel-title' }, 'History'), list),
  );

  load();
  return el;
}
