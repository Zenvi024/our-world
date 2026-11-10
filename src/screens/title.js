import { h, friendlyError } from '../lib/dom.js';
import { isConfigured } from '../supabase.js';
import { getSession, signIn } from '../session.js';
import { cachedSplash, fetchSplash } from '../data/splash.js';
import { startLandscape } from '../art/landscape.js';
import { pixelArt } from '../art/pixel.js';
import { ICON_HEART } from '../art/sprites.js';
import { playPoke } from '../lib/sound.js';
import { createMusicButton } from '../components/musicButton.js';
import { loadPartner, sendPoke } from '../data/pokes.js';

const SPLASH_SECONDS = 5;

// The yellow line beside the title. It takes turns through the splash texts.
function createSplash() {
  const el = h('p', { class: 'splash' });
  let lines = [];
  let index = 0;
  let timer = null;

  function show() {
    el.textContent = lines[index] ?? '';
    el.hidden = !lines.length;
    // Shrink long lines so they always fit on a phone.
    el.style.fontSize = '';
    const room = Math.min(window.innerWidth * 0.52, 420);
    if (room && el.scrollWidth > room) {
      const base = parseFloat(getComputedStyle(el).fontSize);
      el.style.fontSize = `${Math.max(11, (base * room) / el.scrollWidth)}px`;
    }
  }

  function setLines(next) {
    lines = next.filter(Boolean);
    index = Math.floor(Math.random() * lines.length);
    show();
    clearInterval(timer);
    if (lines.length > 1) {
      timer = setInterval(() => {
        index = (index + 1) % lines.length;
        show();
      }, SPLASH_SECONDS * 1000);
    }
  }

  return { el, setLines, stop: () => clearInterval(timer) };
}

function createLoginPanel({ onSignedIn, onClose }) {
  const email = h('input', {
    class: 'input',
    id: 'login-email',
    type: 'email',
    autocomplete: 'username',
    autocapitalize: 'none',
    spellcheck: 'false',
    required: true,
  });
  const password = h('input', {
    class: 'input',
    id: 'login-password',
    type: 'password',
    autocomplete: 'current-password',
    required: true,
  });
  const showPassword = h('input', {
    type: 'checkbox',
    id: 'login-show',
    onchange: () => {
      password.type = showPassword.checked ? 'text' : 'password';
    },
  });
  const status = h('p', { class: 'status status--error', role: 'alert' });
  const submit = h('button', { class: 'btn btn--green', type: 'submit' }, 'Enter');

  const form = h(
    'form',
    {
      class: 'panel login-panel',
      onsubmit: async (event) => {
        event.preventDefault();
        status.textContent = '';
        submit.disabled = true;
        submit.textContent = 'Entering…';
        try {
          await signIn(email.value.trim(), password.value);
          onSignedIn();
        } catch (error) {
          status.textContent = friendlyError(error);
          submit.disabled = false;
          submit.textContent = 'Enter';
        }
      },
    },
    h('h2', { class: 'panel-title', id: 'login-title' }, 'Who goes there?'),
    h('div', { class: 'field' }, h('label', { for: 'login-email' }, 'Email'), email),
    h('div', { class: 'field' }, h('label', { for: 'login-password' }, 'Password'), password),
    h('label', { class: 'check', for: 'login-show' }, showPassword, 'Show password'),
    status,
    h(
      'div',
      { class: 'button-row' },
      h('button', { class: 'btn', type: 'button', onclick: onClose }, 'Back'),
      submit,
    ),
  );

  const overlay = h(
    'div',
    {
      class: 'overlay',
      role: 'dialog',
      'aria-modal': 'true',
      'aria-labelledby': 'login-title',
      onclick: (event) => {
        if (event.target === overlay) onClose();
      },
      onkeydown: (event) => {
        if (event.key === 'Escape') onClose();
      },
    },
    form,
  );
  return { overlay, focus: () => email.focus() };
}

function createNotice(message, onClose) {
  const overlay = h(
    'div',
    { class: 'overlay', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Notice' },
    h(
      'div',
      { class: 'panel login-panel' },
      h('p', { class: 'notice-text' }, message),
      h(
        'div',
        { class: 'button-row' },
        h('button', { class: 'btn', type: 'button', onclick: onClose }, 'Okay'),
      ),
    ),
  );
  return overlay;
}

// "Poke Jay": a tiny hello that pops up on the other person's screen.
function createPokeButton() {
  const label = h('span', null, 'Poke');
  const button = h('button', { class: 'btn poke-button', type: 'button', hidden: true, 'data-quiet': 'true' }, pixelArt(ICON_HEART), label);
  loadPartner()
    .then((partner) => {
      if (!partner) return;
      label.textContent = `Poke ${partner.name}`;
      button.hidden = false;
      button.addEventListener('click', async () => {
        button.disabled = true;
        try {
          await sendPoke(partner.id);
          playPoke();
          label.textContent = 'Poked!';
        } catch (error) {
          label.textContent = 'Could not poke';
        }
        setTimeout(() => {
          label.textContent = `Poke ${partner.name}`;
          button.disabled = false;
        }, 2500);
      });
    })
    .catch(() => {
      // The button stays hidden if the partner cannot be loaded.
    });
  return button;
}

// Shows the title screen inside root. Returns a function that cleans it up.
export function mountTitle(root, { onEnter }) {
  const canvas = h('canvas', { class: 'landscape', 'aria-hidden': 'true' });
  const splash = createSplash();
  const music = createMusicButton();
  const signedIn = isConfigured && Boolean(getSession());
  let dialog = null;

  const closeDialog = () => {
    dialog?.remove();
    dialog = null;
    playButton.focus();
  };

  const playButton = h(
    'button',
    {
      class: 'btn btn--green play-button',
      type: 'button',
      onclick: () => {
        if (!isConfigured) {
          dialog = createNotice(
            'This world is not connected to its database yet. Add the Supabase URL and key in Vercel, then redeploy.',
            closeDialog,
          );
          screen.append(dialog);
          return;
        }
        if (getSession()) {
          onEnter();
          return;
        }
        const login = createLoginPanel({ onSignedIn: onEnter, onClose: closeDialog });
        dialog = login.overlay;
        screen.append(dialog);
        login.focus();
      },
    },
    'Play',
  );

  const screen = h(
    'div',
    { class: 'title-screen' },
    h('div', { class: 'landscape-holder' }, canvas),
    h(
      'div',
      { class: 'title-content' },
      h(
        'div',
        { class: 'logo-block' },
        h(
          'div',
          { class: 'logo' },
          h(
            'h1',
            { class: 'logo-words', 'aria-label': 'Our Little World' },
            h('span', { class: 'logo-top', 'aria-hidden': 'true' }, 'Our Little'),
            h('span', { class: 'logo-main', 'aria-hidden': 'true' }, 'World'),
          ),
          splash.el,
        ),
        h('p', { class: 'logo-by' }, 'by Zen & Jay'),
      ),
      playButton,
      signedIn && createPokeButton(),
      h('p', { class: 'title-foot' }, 'Since November 13, 2024'),
    ),
    music.el,
  );

  root.replaceChildren(screen);
  const stopLandscape = startLandscape(canvas);

  splash.setLines(cachedSplash());
  if (isConfigured && getSession()) {
    fetchSplash()
      .then((rows) => splash.setLines(rows.map((row) => row.body)))
      .catch(() => {
        // The remembered lines stay on screen if the fetch fails.
      });
  }
  // Refit once the pixel font has loaded, since it changes the text width.
  document.fonts?.ready.then(() => splash.setLines(cachedSplash()));

  return () => {
    stopLandscape();
    splash.stop();
    music.stop();
  };
}
