import { h, friendlyError } from '../lib/dom.js';
import { pixelArt } from '../art/pixel.js';
import { ICON_MAP } from '../art/sprites.js';
import { parts, toDate, isValidDate, MONTH_NAMES } from '../lib/dates.js';
import { loadMemberNames } from '../session.js';
import { ADVANCEMENTS, fetchUnlocks, checkAdvancements } from '../data/advancements.js';
import {
  fetchGoals,
  addGoal,
  updateGoal,
  removeGoal,
  setGoalDone,
  saveGoalOrder,
  fetchSteps,
  addStep,
  setStepDone,
  removeStep,
} from '../data/goals.js';
import { openModal, confirmDialog } from '../components/modal.js';
import { fetchHearts } from '../data/hearts.js';
import { createHeartButton } from '../components/heartButton.js';

const monthYear = (date) => `${MONTH_NAMES[parts(date).month - 1]} ${parts(date).year}`;
const shortDay = (iso) => {
  const manila = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Manila', month: 'long', day: 'numeric', year: 'numeric' });
  return manila.format(new Date(iso));
};

// "March 2027 to December 2027", "By December 2027", "Whenever it happens", ...
function targetText(goal) {
  const { target_from: from, target_to: to } = goal;
  if (from && to) return monthYear(from) === monthYear(to) ? monthYear(from) : `${monthYear(from)} to ${monthYear(to)}`;
  if (from) return `From ${monthYear(from)}`;
  if (to) return `By ${monthYear(to)}`;
  return 'Whenever it happens';
}

function openGoalForm({ goal, onSaved, nextOrder }) {
  const title = h('input', { class: 'input', id: 'goal-title', type: 'text', maxlength: '120', required: true, value: goal?.title ?? '', placeholder: 'Go to Japan' });
  const note = h('textarea', { class: 'input', id: 'goal-note', rows: '3', maxlength: '2000' }, goal?.note ?? '');
  const from = h('input', { class: 'input', id: 'goal-from', type: 'date', value: goal?.target_from ?? '' });
  const to = h('input', { class: 'input', id: 'goal-to', type: 'date', value: goal?.target_to ?? '' });
  const status = h('p', { class: 'status status--error', role: 'alert' });
  const save = h('button', { class: 'btn btn--green', type: 'submit' }, 'Save');

  const modal = openModal(
    { label: goal ? 'Edit quest' : 'New quest', className: 'small-panel' },
    h(
      'form',
      {
        onsubmit: async (event) => {
          event.preventDefault();
          const fields = {
            title: title.value.trim(),
            note: note.value.trim() || null,
            target_from: isValidDate(from.value) ? from.value : null,
            target_to: isValidDate(to.value) ? to.value : null,
          };
          if (!fields.title) {
            status.textContent = 'Please give the quest a name.';
            return;
          }
          if (fields.target_from && fields.target_to && fields.target_from > fields.target_to) {
            status.textContent = 'The first date should come before the second.';
            return;
          }
          save.disabled = true;
          try {
            if (goal) await updateGoal(goal.id, fields);
            else await addGoal(fields, nextOrder);
            modal.close();
            onSaved();
          } catch (error) {
            status.textContent = friendlyError(error);
            save.disabled = false;
          }
        },
      },
      h('h2', { class: 'panel-title' }, goal ? 'Edit quest' : 'New quest'),
      h('div', { class: 'field' }, h('label', { for: 'goal-title' }, 'What do we want to do?'), title),
      h('div', { class: 'field' }, h('label', { for: 'goal-note' }, 'Notes'), note),
      h('p', { class: 'hint' }, 'When would we like this to happen? Both dates are optional.'),
      h(
        'div',
        { class: 'field-pair' },
        h('div', { class: 'field' }, h('label', { for: 'goal-from' }, 'From'), from),
        h('div', { class: 'field' }, h('label', { for: 'goal-to' }, 'To'), to),
      ),
      status,
      h(
        'div',
        { class: 'button-row' },
        goal &&
          h(
            'button',
            {
              class: 'btn btn--danger form-delete',
              type: 'button',
              onclick: async () => {
                const sure = await confirmDialog({ message: `Remove “${goal.title}” from your quests?`, confirmLabel: 'Remove', danger: true });
                if (!sure) return;
                try {
                  await removeGoal(goal.id);
                  modal.close();
                  onSaved();
                } catch (error) {
                  status.textContent = friendlyError(error);
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
  if (!goal) title.focus();
}

// The quests screen: the shared bucket list in the order you choose, the
// goals already reached, and the built-in advancements.
export function createAdvancements() {
  const goalList = h('div', { class: 'goal-list' });
  const reachedList = h('div', { class: 'goal-list' });
  const reachedPanel = h('section', { class: 'board board--reached', hidden: true }, h('h2', { class: 'board-title' }, 'Reached together'), reachedList);
  const grid = h('div', { class: 'advancement-grid' });
  const status = h('p', { class: 'status status--error', role: 'alert' });
  let goals = [];
  let names = new Map();
  let hearts = new Map();
  let steps = new Map();

  const fail = (error) => {
    status.textContent = friendlyError(error);
  };

  async function load() {
    try {
      [goals, names, hearts, steps] = await Promise.all([
        fetchGoals(),
        loadMemberNames(),
        fetchHearts('goal').catch(() => new Map()),
        fetchSteps().catch(() => new Map()),
      ]);
      status.textContent = '';
      renderGoals();
    } catch (error) {
      fail(error);
    }
  }

  async function move(goal, delta) {
    const open = goals.filter((item) => !item.done_at);
    const index = open.indexOf(goal);
    const target = index + delta;
    if (target < 0 || target >= open.length) return;
    open.splice(index, 1);
    open.splice(target, 0, goal);
    try {
      await saveGoalOrder(open);
      goals = [...open, ...goals.filter((item) => item.done_at)];
      renderGoals();
    } catch (error) {
      fail(error);
      load();
    }
  }

  async function markDone(goal, done) {
    try {
      await setGoalDone(goal.id, done);
      await load();
      if (done) checkAdvancements(); // shows the "Goal Reached!" pop-up
    } catch (error) {
      fail(error);
    }
  }

  // The checklist inside a quest: tick steps off, add new ones, remove old ones.
  function stepList(goal, done) {
    const list = steps.get(goal.id) ?? [];
    const run = async (work) => {
      try {
        await work();
        await load();
      } catch (error) {
        fail(error);
      }
    };
    const input = h('input', { class: 'input', type: 'text', maxlength: '200', placeholder: 'Add a step…', 'aria-label': `Add a step to ${goal.title}`, required: true });
    return h(
      'div',
      { class: 'steps' },
      list.length > 0 && h('p', { class: 'steps-count' }, `${list.filter((step) => step.done).length} of ${list.length} steps done`),
      list.map((step) => {
        const box = h('input', { type: 'checkbox', checked: step.done, onchange: () => run(() => setStepDone(step.id, box.checked)) });
        return h(
          'div',
          { class: `step${step.done ? ' step--done' : ''}` },
          h('label', { class: 'check' }, box, h('span', null, step.body)),
          h('button', { class: 'line-remove', type: 'button', 'aria-label': `Remove the step ${step.body}`, onclick: () => run(() => removeStep(step.id)) }, '×'),
        );
      }),
      !done &&
        h(
          'form',
          {
            class: 'input-row step-add',
            onsubmit: (event) => {
              event.preventDefault();
              const body = input.value.trim();
              if (body) run(() => addStep(goal.id, body));
            },
          },
          input,
          h('button', { class: 'btn btn--small', type: 'submit', 'aria-label': 'Add step' }, '+'),
        ),
    );
  }

  function goalRow(goal, index, count) {
    const done = Boolean(goal.done_at);
    return h(
      'article',
      { class: `goal${done ? ' goal--done' : ''}` },
      h('span', { class: 'goal-pin', 'aria-hidden': 'true' }),
      createHeartButton('goal', goal.id, hearts.get(goal.id)),
      done && h('span', { class: 'goal-stamp', 'aria-hidden': 'true' }, 'Done!'),
      h(
        'div',
        { class: 'goal-main' },
        h('h3', { class: 'goal-title' }, goal.title),
        h(
          'p',
          { class: 'goal-when' },
          done
            ? `Reached on ${shortDay(goal.done_at)}${names.get(goal.done_by) ? `, marked by ${names.get(goal.done_by)}` : ''}`
            : targetText(goal),
        ),
        goal.note && h('p', { class: 'goal-note' }, goal.note),
        stepList(goal, done),
      ),
      h(
        'div',
        { class: 'goal-controls' },
        !done &&
          h('button', { class: 'btn btn--small goal-step', type: 'button', 'aria-label': `Move “${goal.title}” up`, disabled: index === 0, onclick: () => move(goal, -1) }, '▲'),
        !done &&
          h('button', { class: 'btn btn--small goal-step', type: 'button', 'aria-label': `Move “${goal.title}” down`, disabled: index === count - 1, onclick: () => move(goal, 1) }, '▼'),
        h('button', { class: 'btn btn--small', type: 'button', onclick: () => openGoalForm({ goal, onSaved: load }) }, 'Edit'),
        done
          ? h('button', { class: 'btn btn--small', type: 'button', onclick: () => markDone(goal, false) }, 'Not yet')
          : h('button', { class: 'btn btn--small btn--green', type: 'button', onclick: () => markDone(goal, true) }, 'Done!'),
      ),
    );
  }

  function renderGoals() {
    const open = goals.filter((goal) => !goal.done_at);
    const reached = goals
      .filter((goal) => goal.done_at)
      .sort((a, b) => b.done_at.localeCompare(a.done_at));
    goalList.replaceChildren(
      ...(open.length
        ? open.map((goal, index) => goalRow(goal, index, open.length))
        : [
            h(
              'div',
              { class: 'goal-empty' },
              pixelArt(ICON_MAP, 'goal-empty-icon'),
              h('p', null, 'No quests yet. What would you two love to do together?'),
            ),
          ]),
    );
    reachedPanel.hidden = reached.length === 0;
    reachedList.replaceChildren(...reached.map((goal) => goalRow(goal, 0, 1)));
  }

  async function loadAdvancements() {
    let unlocked = new Map();
    try {
      unlocked = await fetchUnlocks();
    } catch (error) {
      fail(error);
    }
    grid.replaceChildren(
      ...ADVANCEMENTS.map((advancement) => {
        const when = unlocked.get(advancement.key);
        return h(
          'article',
          { class: `advancement${when ? '' : ' advancement--locked'}` },
          h('span', { class: 'advancement-slot' }, pixelArt(advancement.icon)),
          h(
            'div',
            { class: 'advancement-words' },
            h('h3', { class: 'advancement-name' }, advancement.name),
            h('p', { class: 'advancement-how' }, advancement.how),
            h('p', { class: 'advancement-when' }, when ? `Unlocked on ${shortDay(when)}` : 'Locked'),
          ),
        );
      }),
    );
  }

  const el = h(
    'div',
    { class: 'goals-screen' },
    h(
      'section',
      { class: 'board' },
      h('h2', { class: 'board-title' }, 'Our quests'),
      h('p', { class: 'board-hint' }, 'The things we want to do together, in the order we want to do them.'),
      status,
      goalList,
      h(
        'div',
        { class: 'button-row' },
        h(
          'button',
          {
            class: 'btn btn--green',
            type: 'button',
            onclick: () =>
              openGoalForm({ onSaved: load, nextOrder: goals.reduce((max, goal) => Math.max(max, goal.sort_order + 1), 0) }),
          },
          'Add a quest',
        ),
      ),
    ),
    reachedPanel,
    h('section', { class: 'panel' }, h('h2', { class: 'panel-title' }, 'Advancements'), grid),
  );

  load();
  loadAdvancements();
  return el;
}
