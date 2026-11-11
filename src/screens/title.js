import { h, friendlyError } from '../lib/dom.js';
import { isConfigured, supabase } from '../supabase.js';
import { getSession, signIn, loadMembers } from '../session.js';
import { AVATAR_HATS } from '../art/outfits.js';
import { cachedSplash, fetchSplash } from '../data/splash.js';
import { startLandscape } from '../art/landscape.js';
import { pixelArt } from '../art/pixel.js';
import { ICON_HEART, ICON_MOON, ICON_SUN, LILY } from '../art/sprites.js';
import { playPoke, playDone, playPop } from '../lib/sound.js';
import { createMusicButton } from '../components/musicButton.js';
import { openModal } from '../components/modal.js';
import { showToast } from '../components/toast.js';
import { plural } from '../lib/dom.js';
import { onLive, isPartnerOnline } from '../lib/live.js';
import { getUserId } from '../session.js';
import { loadPartner, sendPoke, POKES, POKE_MENU } from '../data/pokes.js';
import { fetchMoods, setAsleep, isAsleep } from '../data/moods.js';
import { isNight, setNight } from '../lib/theme.js';
import { recordVisit, campfireState } from '../data/visits.js';

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

// The row under Play: send a little something, and switch night mode.
function createGreetings(scene) {
  const sendLabel = h('span', null, 'Send…');
  const send = h('button', { class: 'btn greet-button', type: 'button' }, pixelArt(ICON_HEART), sendLabel);
  const night = createNightButton(scene);
  const note = h('p', { class: 'greet-note', role: 'status' });
  const row = h('div', { class: 'greet', hidden: true }, h('div', { class: 'greet-row' }, send, night), note);
  let partner = null;
  let moods = new Map();

  const say = (message) => {
    note.textContent = message;
    setTimeout(() => {
      if (note.textContent === message) showSleepers();
    }, 2600);
  };

  // Zs rise from the roof for each of you who has said good night.
  function showSleepers() {
    const mine = isAsleep(moods.get(getUserId()));
    const theirs = partner && isAsleep(moods.get(partner.id));
    note.textContent = theirs ? `${partner.name} is asleep.` : '';
    scene.setSleepers(Number(mine) + Number(Boolean(theirs)));
  }

  async function refresh() {
    try {
      moods = await fetchMoods();
      showSleepers();
    } catch {
      // The note simply stays empty until the meters are set up.
    }
  }

  async function sendOne(kind) {
    try {
      // Good night and good morning also tuck you in and wake you up.
      if (kind === 'good_night' || kind === 'good_morning') await setAsleep(kind === 'good_night');
      await sendPoke(partner.id, kind);
      if (kind === 'good_night') playDone();
      else playPoke();
      if (kind === 'good_night' || kind === 'good_morning') await refresh();
      say(kind === 'good_night' ? 'Sweet dreams!' : kind === 'good_morning' ? 'Good morning!' : `Sent to ${partner.name}!`);
    } catch {
      say('That could not be sent. Please try again.');
    }
  }

  send.addEventListener('click', () => {
    const modal = openModal(
      { label: `Send ${partner.name} something`, className: 'small-panel' },
      h('h2', { class: 'panel-title' }, `Send ${partner.name}…`),
      h(
        'div',
        { class: 'poke-menu' },
        POKE_MENU.map((kind) =>
          h(
            'button',
            {
              class: 'btn poke-choice',
              type: 'button',
              'data-quiet': 'true',
              onclick: () => {
                modal.close();
                sendOne(kind);
              },
            },
            pixelArt(POKES[kind].icon),
            POKES[kind].label,
          ),
        ),
      ),
      h('div', { class: 'button-row' }, h('button', { class: 'btn', type: 'button', onclick: () => modal.close() }, 'Cancel')),
    );
  });

  loadPartner()
    .then((found) => {
      if (!found) return;
      partner = found;
      sendLabel.textContent = `Send ${partner.name}…`;
      refresh();
    })
    .catch(() => {
      // Only the night switch shows if the partner cannot be loaded.
    })
    .finally(() => {
      send.hidden = !partner;
      row.hidden = false;
    });

  return { el: row, stop: onLive('moods', refresh) };
}

// Switches night mode: the sky turns to night and the whole site goes dark.
function createNightButton(scene) {
  const icon = h('span', { class: 'greet-icon' });
  const label = h('span');
  const button = h('button', { class: 'btn greet-button', type: 'button' }, icon, label);
  const show = () => {
    const on = isNight();
    icon.replaceChildren(pixelArt(on ? ICON_SUN : ICON_MOON));
    label.textContent = on ? 'Day mode' : 'Night mode';
    button.setAttribute('aria-pressed', String(on));
  };
  button.addEventListener('click', () => {
    setNight(!isNight());
    show();
    scene.refresh();
  });
  show();
  return button;
}

// Shows the title screen inside root. Returns a function that cleans it up.
export function mountTitle(root, { onEnter }) {
  const canvas = h('canvas', { class: 'landscape', 'aria-hidden': 'true' });
  const splash = createSplash();
  const music = createMusicButton();
  const signedIn = isConfigured && Boolean(getSession());
  const greetSlot = h('span', { hidden: true });
  let dialog = null;

  const closeDialog = () => {
    dialog?.remove();
    dialog = null;
    playButton.focus();
  };

  const playButton = h(
    'button',
    {
      class: 'btn play-button',
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
      greetSlot,
      h('p', { class: 'title-foot' }, 'Since November 13, 2024'),
    ),
    music.el,
  );

  root.replaceChildren(screen);
  // Name tags float above the capybaras: the two of you, and your pet.
  const tags = h('div', { class: 'name-tags', 'aria-hidden': 'true' });
  canvas.after(tags);
  const scene = startLandscape(canvas, {
    onMove(spots) {
      spots.forEach((spot, i) => {
        const tag = tags.children[i];
        if (tag) tag.style.transform = `translate(${Math.round(spot.x)}px, ${Math.round(spot.y)}px) translate(-50%, -100%)`;
      });
    },
  });
  const stops = [];

  // Who is in the scene: each of you wears your avatar's hat, and the little
  // one wears whatever Happybara has on.
  async function gatherCast() {
    try {
      const me = getUserId();
      const [members, pet] = await Promise.all([loadMembers(), supabase.from('pet').select('*').eq('id', 1).maybeSingle()]);
      const people = [...members].sort(([a], [b]) => Number(b === me) - Number(a === me)).slice(0, 2);
      const cast = people.map(([, person], i) => ({ name: person.name, hat: AVATAR_HATS[person.avatar] ?? (i ? 'hat_blossom' : 'hat_orange') }));
      while (cast.length < 2) cast.push({ name: '', hat: cast.length ? 'hat_blossom' : 'hat_orange' });
      cast.push({ name: pet.data?.name ?? 'Happybara', hat: pet.data?.wearing, accessory: pet.data?.accessory, baby: true });
      tags.replaceChildren(...cast.map((member) => h('span', { class: `name-tag${member.baby ? ' name-tag--pet' : ''}` }, member.name)));
      scene.setCast(cast);
    } catch {
      // The scene keeps its three unnamed capybaras.
    }
  }

  // The campfire burns on days you both visit, and roars while you are both here.
  let fireState = { lit: false, streak: 0 };
  async function tendFire() {
    try {
      fireState = await campfireState();
    } catch {
      // The fire waits until visits are set up.
    }
    scene.setCampfire({ lit: fireState.lit, roaring: fireState.lit && isPartnerOnline() });
  }
  if (signedIn) {
    const greetings = createGreetings(scene);
    greetSlot.replaceWith(greetings.el);
    stops.push(greetings.stop, onLive('visits', tendFire), onLive('presence', tendFire), onLive('pet', gatherCast), onLive('moods', gatherCast));
    gatherCast();
    recordVisit().catch(() => {}).then(tendFire);
  }

  // Tapping the scene: capybaras hop and blush, and the campfire tells its story.
  screen.addEventListener('click', (event) => {
    if (event.target.closest('button, a, input, .overlay')) return;
    const hit = scene.tap(event.clientX, event.clientY);
    if (hit === 'capybara') playPop();
    if (hit === 'campfire') {
      showToast({
        header: fireState.lit ? 'The campfire is burning' : 'The campfire is waiting',
        text: fireState.lit
          ? `Lit ${plural(fireState.streak, 'day')} in a row.`
          : signedIn
            ? 'It lights on days you both visit.'
            : 'It lights when you are both home.',
        icon: LILY,
      });
    }
  });

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
    scene.stop();
    stops.forEach((stop) => stop());
    splash.stop();
    music.stop();
  };
}
