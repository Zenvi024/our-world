import { h, friendlyError, plural } from '../lib/dom.js';
import { pixelArt } from '../art/pixel.js';
import { ICON_CHEST } from '../art/sprites.js';
import { fetchLists, addList, removeList, addItem, setItemDone, removeItem } from '../data/lists.js';
import { openModal, confirmDialog } from '../components/modal.js';
import { lilyLoader } from '../components/loader.js';
import { playCreak, playPop } from '../lib/sound.js';

const IDEAS = ['Groceries', 'Watchlist', 'Places to eat', 'Things to pack'];

// Shared lists, each kept in its own chest.
export function createLists() {
  const shelf = h('div', { class: 'chest-shelf' }, lilyLoader('Opening the storeroom…'));
  const status = h('p', { class: 'status status--error', role: 'alert' });
  let lists = [];
  let openId = null; // the list whose chest is open, so it can refresh in place
  let renderOpen = null;

  async function load() {
    try {
      lists = await fetchLists();
      status.textContent = '';
      render();
      renderOpen?.();
    } catch (error) {
      shelf.replaceChildren();
      status.textContent = friendlyError(error);
    }
  }

  function openList(listId) {
    openId = listId;
    playCreak();
    const items = h('div', { class: 'list-items' });
    const title = h('h2', { class: 'chest-title' });
    const input = h('input', { class: 'input', type: 'text', maxlength: '200', placeholder: 'Add something…', 'aria-label': 'New item', required: true });
    const error = h('p', { class: 'status status--error', role: 'alert' });
    const run = async (work) => {
      try {
        await work();
        await load();
      } catch (problem) {
        error.textContent = friendlyError(problem);
      }
    };

    const modal = openModal(
      {
        label: 'A shared list',
        className: 'chest',
        onClose: () => {
          openId = null;
          renderOpen = null;
        },
      },
      h(
        'header',
        { class: 'chest-lid' },
        title,
        h('button', { class: 'btn chest-close', type: 'button', 'aria-label': 'Close', onclick: () => modal.close() }, '×'),
      ),
      h(
        'div',
        { class: 'chest-body' },
        items,
        h(
          'form',
          {
            class: 'input-row',
            onsubmit: (event) => {
              event.preventDefault();
              const body = input.value.trim();
              if (!body) return;
              input.value = '';
              run(async () => {
                await addItem(listId, body);
                playPop();
              });
            },
          },
          input,
          h('button', { class: 'btn btn--green', type: 'submit' }, 'Add'),
        ),
        error,
        h(
          'div',
          { class: 'button-row' },
          h(
            'button',
            {
              class: 'btn btn--danger form-delete',
              type: 'button',
              onclick: async () => {
                const sure = await confirmDialog({ message: 'Remove this whole list and everything on it?', confirmLabel: 'Remove', danger: true });
                if (!sure) return;
                modal.close();
                run(() => removeList(listId));
              },
            },
            'Remove list',
          ),
        ),
      ),
    );

    renderOpen = () => {
      const list = lists.find((item) => item.id === openId);
      if (!list) {
        modal.close();
        return;
      }
      title.textContent = list.title;
      items.replaceChildren(
        ...(list.list_items.length
          ? list.list_items.map((item) => {
              const box = h('input', { type: 'checkbox', checked: item.done, onchange: () => run(() => setItemDone(item.id, box.checked)) });
              return h(
                'div',
                { class: `list-item${item.done ? ' list-item--done' : ''}` },
                h('label', { class: 'check' }, box, h('span', null, item.body)),
                h('button', { class: 'line-remove', type: 'button', 'aria-label': `Remove ${item.body}`, onclick: () => run(() => removeItem(item.id)) }, '×'),
              );
            })
          : [h('p', { class: 'hint' }, 'This chest is empty. Add the first thing below.')]),
      );
    };
    renderOpen();
  }

  function newList() {
    const input = h('input', { class: 'input', id: 'list-title', type: 'text', maxlength: '60', placeholder: 'Groceries', required: true });
    const error = h('p', { class: 'status status--error', role: 'alert' });
    const modal = openModal(
      { label: 'New list', className: 'small-panel' },
      h(
        'form',
        {
          onsubmit: async (event) => {
            event.preventDefault();
            const title = input.value.trim();
            if (!title) return;
            try {
              await addList(title);
              modal.close();
              await load();
            } catch (problem) {
              error.textContent = friendlyError(problem);
            }
          },
        },
        h('h2', { class: 'panel-title' }, 'New list'),
        h('div', { class: 'field' }, h('label', { for: 'list-title' }, 'What is this list for?'), input),
        h(
          'div',
          { class: 'quick-row quick-row--wrap' },
          IDEAS.map((idea) => h('button', { class: 'btn btn--small', type: 'button', onclick: () => (input.value = idea) }, idea)),
        ),
        error,
        h(
          'div',
          { class: 'button-row' },
          h('button', { class: 'btn', type: 'button', onclick: () => modal.close() }, 'Cancel'),
          h('button', { class: 'btn btn--green', type: 'submit' }, 'Create'),
        ),
      ),
    );
    input.focus();
  }

  function render() {
    shelf.replaceChildren(
      ...lists.map((list) => {
        const left = list.list_items.filter((item) => !item.done).length;
        return h(
          'button',
          { class: 'list-chest', type: 'button', onclick: () => openList(list.id) },
          pixelArt(ICON_CHEST, 'list-chest-icon'),
          h('span', { class: 'list-chest-title' }, list.title),
          h('span', { class: 'list-chest-count' }, list.list_items.length ? (left ? `${plural(left, 'thing')} left` : 'All done!') : 'Empty'),
        );
      }),
      h('button', { class: 'list-chest list-chest--new', type: 'button', onclick: newList }, h('span', { class: 'list-chest-plus' }, '+'), h('span', { class: 'list-chest-title' }, 'New list')),
    );
  }

  load();
  return h('div', { class: 'lists-screen' }, h('section', { class: 'panel' }, h('h2', { class: 'panel-title' }, 'Our lists'), status, shelf));
}
