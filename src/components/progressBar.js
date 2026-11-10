import { h } from '../lib/dom.js';

// A chunky segmented bar with a line of text under it.
export function createProgressBar() {
  const fill = h('div', { class: 'progress-fill' });
  const text = h('p', { class: 'progress-text' });
  const bar = h(
    'div',
    { class: 'progress-bar', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': '100' },
    fill,
  );
  const el = h('div', { class: 'progress' }, bar, text);

  function set(done, total, message) {
    const percent = total ? Math.round((done / total) * 100) : 0;
    fill.style.width = `${percent}%`;
    bar.setAttribute('aria-valuenow', String(percent));
    text.textContent = message;
  }

  return { el, set };
}
