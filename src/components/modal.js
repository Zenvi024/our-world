import { h } from '../lib/dom.js';

// Opens a dimmed layer with a panel in the middle. Returns { panel, close }.
// Escape and tapping outside the panel close it (unless dismissible is false).
export function openModal(
  { label, className = '', overlayClass = '', dismissible = true, onClose } = {},
  ...children
) {
  const previousFocus = document.activeElement;
  const panel = h('div', { class: `panel modal-panel ${className}`.trim(), tabindex: '-1' }, children);
  const overlay = h(
    'div',
    { class: `overlay ${overlayClass}`.trim(), role: 'dialog', 'aria-modal': 'true', 'aria-label': label },
    panel,
  );
  let closed = false;

  function close() {
    if (closed) return;
    closed = true;
    overlay.remove();
    document.removeEventListener('keydown', onKey, true);
    onClose?.();
    if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus();
  }

  function onKey(event) {
    // Only the topmost layer reacts.
    if (event.key === 'Escape' && dismissible && overlay === document.body.lastElementChild) {
      event.stopPropagation();
      close();
    }
  }

  overlay.addEventListener('click', (event) => {
    if (event.target === overlay && dismissible) close();
  });
  document.addEventListener('keydown', onKey, true);
  document.body.append(overlay);
  panel.focus();
  return { panel, overlay, close };
}

// Asks a yes/no question. Resolves to true only if the person confirms.
export function confirmDialog({ message, confirmLabel = 'Yes', danger = false }) {
  return new Promise((resolve) => {
    let answer = false;
    const modal = openModal(
      { label: 'Please confirm', className: 'confirm-panel', onClose: () => resolve(answer) },
      h('p', { class: 'confirm-text' }, message),
      h(
        'div',
        { class: 'button-row' },
        h('button', { class: 'btn', type: 'button', onclick: () => modal.close() }, 'Cancel'),
        h(
          'button',
          {
            class: `btn ${danger ? 'btn--danger' : 'btn--green'}`,
            type: 'button',
            onclick: () => {
              answer = true;
              modal.close();
            },
          },
          confirmLabel,
        ),
      ),
    );
  });
}
