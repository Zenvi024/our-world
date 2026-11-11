import { h, friendlyError } from '../lib/dom.js';
import { monthDay, todayManila } from '../lib/dates.js';
import { loadPartner } from '../data/pokes.js';
import { fetchAnswers, saveAnswer, questionFor } from '../data/questions.js';
import { lilyLoader } from '../components/loader.js';
import { playDone } from '../lib/sound.js';

// One question a day. You see each other's answer once you have both answered.
export function createQuestion() {
  const today = todayManila();
  const body = h('div', { class: 'question-body' }, lilyLoader('Fetching today’s question…'));
  const earlier = h('div', { class: 'question-earlier' });
  let partnerName = 'your partner';

  function answerForm(existing) {
    const input = h('textarea', { class: 'input', id: 'question-answer', rows: '4', maxlength: '1000', placeholder: 'Your answer…', required: true }, existing ?? '');
    const error = h('p', { class: 'status status--error', role: 'alert' });
    const save = h('button', { class: 'btn btn--green', type: 'submit' }, existing ? 'Save' : 'Answer');
    return h(
      'form',
      {
        onsubmit: async (event) => {
          event.preventDefault();
          const answer = input.value.trim();
          if (!answer) return;
          save.disabled = true;
          try {
            await saveAnswer(today, answer, Boolean(existing));
            playDone();
            await load();
          } catch (problem) {
            error.textContent = friendlyError(problem);
            save.disabled = false;
          }
        },
      },
      h('label', { class: 'visually-hidden', for: 'question-answer' }, 'Your answer'),
      input,
      !existing && h('p', { class: 'hint' }, `You will see ${partnerName}’s answer after you send yours.`),
      error,
      h('div', { class: 'button-row' }, save),
    );
  }

  const answerCard = (who, text, waiting) =>
    h('div', { class: `answer${waiting ? ' answer--waiting' : ''}` }, h('p', { class: 'answer-who' }, who), h('p', { class: 'answer-text' }, text));

  function render(days) {
    const now = days[0];
    const parts = [h('h2', { class: 'sign-text' }, now.question)];
    if (now.mine === null) {
      parts.push(answerForm(null));
    } else {
      parts.push(
        answerCard('You', now.mine),
        answerCard(partnerName, now.theirs ?? `${partnerName} has not answered yet.`, now.theirs === null),
        h(
          'div',
          { class: 'button-row' },
          h('button', { class: 'btn btn--small', type: 'button', onclick: () => body.replaceChildren(h('h2', { class: 'sign-text' }, now.question), answerForm(now.mine)) }, 'Change my answer'),
        ),
      );
    }
    body.replaceChildren(...parts);

    const past = days.slice(1);
    earlier.replaceChildren(
      ...(past.length
        ? past.map((day) =>
            h(
              'article',
              { class: 'past-question' },
              h('p', { class: 'past-day' }, monthDay(day.day)),
              h('h3', { class: 'past-text' }, day.question),
              answerCard('You', day.mine),
              answerCard(partnerName, day.theirs ?? 'No answer that day.', day.theirs === null),
            ),
          )
        : [h('p', { class: 'hint' }, 'Your earlier questions will collect here.')]),
    );
  }

  async function load() {
    try {
      const [days, partner] = await Promise.all([fetchAnswers(), loadPartner()]);
      if (partner) partnerName = partner.name;
      render(days);
    } catch (error) {
      body.replaceChildren(h('h2', { class: 'sign-text' }, questionFor(today)), h('p', { class: 'status status--error' }, friendlyError(error)));
    }
  }

  load();
  return h(
    'div',
    { class: 'question-screen' },
    h('section', { class: 'sign' }, h('p', { class: 'sign-label' }, 'Question of the day'), body),
    h('section', { class: 'panel' }, h('h2', { class: 'panel-title' }, 'Earlier questions'), earlier),
  );
}
