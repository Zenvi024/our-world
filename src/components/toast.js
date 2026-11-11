import { h } from '../lib/dom.js';
import { pixelArt } from '../art/pixel.js';
import { systemNotify } from '../lib/notify.js';

// Dark pop-ups that slide in at the top of the screen, one at a time.
//   showToast({ header, text, icon: sprite rows, imageUrl, onClick, sound })
const SHOW_MS = 5200;
const queue = [];
let showing = false;
let holder = null;

function next() {
  const toast = queue.shift();
  if (!toast) {
    showing = false;
    return;
  }
  showing = true;
  holder ??= document.body.appendChild(h('div', { class: 'toast-holder', 'aria-live': 'polite' }));

  const picture = toast.imageUrl
    ? h('img', { class: 'toast-photo', src: toast.imageUrl, alt: '' })
    : toast.icon && pixelArt(toast.icon, 'toast-icon');
  const el = h(
    toast.onClick ? 'button' : 'div',
    { class: 'toast', type: toast.onClick ? 'button' : null, 'data-quiet': 'true' },
    h('span', { class: 'toast-slot' }, picture),
    h(
      'span',
      { class: 'toast-words' },
      h('span', { class: 'toast-header' }, toast.header),
      h('span', { class: 'toast-text' }, toast.text),
    ),
  );

  let gone = false;
  const leave = () => {
    if (gone) return;
    gone = true;
    el.classList.add('toast--leaving');
    setTimeout(() => {
      el.remove();
      next();
    }, 350);
  };
  el.addEventListener('click', () => {
    toast.onClick?.();
    leave();
  });
  holder.append(el);
  toast.sound?.();
  setTimeout(leave, SHOW_MS);
}

export function showToast(toast) {
  if (toast.notify) systemNotify(toast.header, toast.text);
  queue.push(toast);
  if (!showing) next();
}
