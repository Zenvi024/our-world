import { h, friendlyError } from '../lib/dom.js';
import {
  loadProfile,
  saveDisplayName,
  changePassword,
  signOut,
  getSession,
} from '../session.js';
import { isSfxOn, setSfx, isMusicOn, setMusic } from '../lib/sound.js';
import {
  fetchSplash,
  addSplash,
  removeSplash,
  forgetSplash,
  SPLASH_MAX_LENGTH,
} from '../data/splash.js';

const SETUP_MESSAGE =
  'This part of the world is not set up yet. The database setup still needs to be run.';

// A status line under a form: say(message) for success, say(message, true) for errors.
function createStatus() {
  const el = h('p', { class: 'status', role: 'status' });
  const say = (message, isError = false) => {
    el.textContent = message;
    el.classList.toggle('status--error', isError);
  };
  return { el, say };
}

function section(title, ...children) {
  return h('section', { class: 'panel settings-section' }, h('h2', { class: 'panel-title' }, title), children);
}

function displayNameSection() {
  const status = createStatus();
  const input = h('input', {
    class: 'input',
    id: 'display-name',
    type: 'text',
    maxlength: '40',
    autocomplete: 'nickname',
    required: true,
    disabled: true,
  });
  const save = h('button', { class: 'btn btn--green', type: 'submit', disabled: true }, 'Save');

  loadProfile()
    .then((profile) => {
      if (!profile) {
        status.say(SETUP_MESSAGE, true);
        return;
      }
      input.value = profile.display_name;
      input.disabled = false;
      save.disabled = false;
    })
    .catch((error) => status.say(friendlyError(error), true));

  const form = h(
    'form',
    {
      onsubmit: async (event) => {
        event.preventDefault();
        const name = input.value.trim();
        if (!name) {
          status.say('Please enter a name.', true);
          return;
        }
        save.disabled = true;
        try {
          const profile = await saveDisplayName(name);
          input.value = profile.display_name;
          status.say('Saved.');
        } catch (error) {
          status.say(friendlyError(error), true);
        }
        save.disabled = false;
      },
    },
    h(
      'div',
      { class: 'field' },
      h('label', { for: 'display-name' }, 'What should the world call you?'),
      h('div', { class: 'input-row' }, input, save),
    ),
    status.el,
  );
  return section('Display name', form);
}

function splashSection() {
  const status = createStatus();
  const list = h('ul', { class: 'splash-list' });
  const input = h('input', {
    class: 'input',
    id: 'splash-new',
    type: 'text',
    maxlength: String(SPLASH_MAX_LENGTH),
    placeholder: 'A new inside joke',
    required: true,
  });
  const add = h('button', { class: 'btn btn--green', type: 'submit' }, 'Add');

  function render(rows) {
    list.replaceChildren(
      ...rows.map((row) =>
        h(
          'li',
          { class: 'splash-item' },
          h('span', { class: 'splash-item-text' }, row.body),
          h(
            'button',
            {
              class: 'btn btn--small btn--danger',
              type: 'button',
              'aria-label': `Remove “${row.body}”`,
              onclick: async (event) => {
                event.currentTarget.disabled = true;
                try {
                  render(await removeSplash(row.id));
                  status.say('Removed.');
                } catch (error) {
                  event.currentTarget.disabled = false;
                  status.say(friendlyError(error), true);
                }
              },
            },
            'Remove',
          ),
        ),
      ),
    );
    if (!rows.length) {
      list.append(h('li', { class: 'splash-empty' }, 'No splash texts yet. Add your first one below.'));
    }
  }

  fetchSplash()
    .then(render)
    .catch(() => status.say(SETUP_MESSAGE, true));

  const form = h(
    'form',
    {
      onsubmit: async (event) => {
        event.preventDefault();
        const body = input.value.trim();
        if (!body) {
          status.say('Please type something first.', true);
          return;
        }
        add.disabled = true;
        try {
          render(await addSplash(body));
          input.value = '';
          status.say('Added. It will take its turn on the title screen.');
        } catch (error) {
          status.say(friendlyError(error), true);
        }
        add.disabled = false;
      },
    },
    h(
      'div',
      { class: 'field' },
      h('label', { for: 'splash-new' }, `Add a line (up to ${SPLASH_MAX_LENGTH} characters)`),
      h('div', { class: 'input-row' }, input, add),
    ),
    status.el,
  );

  return section(
    'Splash texts',
    h('p', { class: 'hint' }, 'These yellow lines take turns beside the title on the Play screen.'),
    list,
    form,
  );
}

function soundSection() {
  const sfx = h('input', { type: 'checkbox', id: 'sound-sfx', checked: isSfxOn(), onchange: () => setSfx(sfx.checked) });
  const music = h('input', { type: 'checkbox', id: 'sound-music', checked: isMusicOn(), onchange: () => setMusic(music.checked) });
  return section(
    'Sound',
    h('p', { class: 'hint' }, 'These choices are remembered on this device.'),
    h('label', { class: 'check check--row', for: 'sound-sfx' }, sfx, 'Sound effects (button clicks and pop-ups)'),
    h('label', { class: 'check check--row', for: 'sound-music' }, music, 'Music (a soft music-box tune)'),
  );
}

function passwordSection() {
  const status = createStatus();
  const first = h('input', {
    class: 'input',
    id: 'new-password',
    type: 'password',
    autocomplete: 'new-password',
    minlength: '8',
    required: true,
  });
  const second = h('input', {
    class: 'input',
    id: 'confirm-password',
    type: 'password',
    autocomplete: 'new-password',
    minlength: '8',
    required: true,
  });
  const save = h('button', { class: 'btn btn--green', type: 'submit' }, 'Change password');
  // Hidden username field so password managers update the right account.
  const username = h('input', {
    type: 'email',
    autocomplete: 'username',
    value: getSession()?.user?.email ?? '',
    hidden: true,
    readonly: true,
  });

  const form = h(
    'form',
    {
      onsubmit: async (event) => {
        event.preventDefault();
        if (first.value.length < 8) {
          status.say('Please use at least 8 characters.', true);
          return;
        }
        if (first.value !== second.value) {
          status.say('The two passwords do not match.', true);
          return;
        }
        save.disabled = true;
        try {
          await changePassword(first.value);
          first.value = '';
          second.value = '';
          status.say('Your password has been changed.');
        } catch (error) {
          status.say(friendlyError(error), true);
        }
        save.disabled = false;
      },
    },
    username,
    h('div', { class: 'field' }, h('label', { for: 'new-password' }, 'New password'), first),
    h('div', { class: 'field' }, h('label', { for: 'confirm-password' }, 'New password again'), second),
    status.el,
    h('div', { class: 'button-row' }, save),
  );
  return section('Change password', form);
}

function signOutSection() {
  const status = createStatus();
  const button = h(
    'button',
    {
      class: 'btn',
      type: 'button',
      onclick: async () => {
        button.disabled = true;
        try {
          forgetSplash();
          await signOut();
          // main.js returns to the title screen when the session ends.
        } catch (error) {
          button.disabled = false;
          status.say(friendlyError(error), true);
        }
      },
    },
    'Sign out',
  );
  return section(
    'Leave the world',
    h('p', { class: 'hint' }, 'You will need your email and password to come back in on this device.'),
    status.el,
    h('div', { class: 'button-row' }, button),
  );
}

export function createSettings() {
  return h(
    'div',
    { class: 'settings' },
    displayNameSection(),
    soundSection(),
    splashSection(),
    passwordSection(),
    signOutSection(),
  );
}
