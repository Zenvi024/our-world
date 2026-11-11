import { h, friendlyError } from '../lib/dom.js';
import {
  loadProfile,
  saveDisplayName,
  changePassword,
  signOut,
  getSession,
} from '../session.js';
import { isSfxOn, setSfx, getMusicLevel, setMusicLevel, nextTrack, onMusicChange } from '../lib/sound.js';
import { loadMembers, saveAvatar, getUserId } from '../session.js';
import { avatarArt, AVATAR_NAMES } from '../components/avatar.js';
import { storageUsed } from '../data/photos.js';
import { isNight, setNight } from '../lib/theme.js';
import { notificationsSupported, notificationsOn, setNotifications } from '../lib/notify.js';
import { downloadData, downloadPhotos } from '../lib/backup.js';
import { createProgressBar } from '../components/progressBar.js';
import { announce } from '../lib/live.js';
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
  const music = h(
    'select',
    { class: 'input', id: 'sound-music', onchange: () => setMusicLevel(Number(music.value)) },
    ['Off', 'Soft', 'Medium', 'Full'].map((label, level) => h('option', { value: String(level), selected: level === getMusicLevel() }, label)),
  );
  // Keep the menu in step with the speaker button in the corner.
  onMusicChange((level) => {
    music.value = String(level);
  });
  return section(
    'Sound',
    h('p', { class: 'hint' }, 'These choices are remembered on this device. The speaker button in the corner changes the music volume too.'),
    h('label', { class: 'check check--row', for: 'sound-sfx' }, sfx, 'Sound effects (button clicks and pop-ups)'),
    h(
      'div',
      { class: 'field' },
      h('label', { for: 'sound-music' }, 'Music volume'),
      h('div', { class: 'input-row' }, music, h('button', { class: 'btn', type: 'button', onclick: nextTrack }, 'Next tune')),
    ),
  );
}

function lookSection() {
  const night = h('input', { type: 'checkbox', id: 'look-night', checked: isNight(), onchange: () => setNight(night.checked) });
  return section(
    'Look',
    h('label', { class: 'check check--row', for: 'look-night' }, night, 'Night mode (a darker look and a night sky)'),
    h('p', { class: 'hint' }, 'Remembered on this device. The moon button on the Play screen does the same.'),
  );
}

function avatarSection() {
  const status = createStatus();
  const buttons = new Map();
  const choose = async (key) => {
    try {
      await saveAvatar(key);
      announce('moods'); // the meters show the new face
      for (const [name, button] of buttons) button.setAttribute('aria-pressed', String(name === key));
      status.say('That is you now.');
    } catch (error) {
      status.say(friendlyError(error), true);
    }
  };
  const grid = h(
    'div',
    { class: 'avatar-grid' },
    Object.keys(AVATAR_NAMES).map((key) => {
      const button = h(
        'button',
        { class: 'avatar-choice', type: 'button', 'aria-pressed': 'false', 'aria-label': AVATAR_NAMES[key], title: AVATAR_NAMES[key], onclick: () => choose(key) },
        avatarArt(key),
      );
      buttons.set(key, button);
      return button;
    }),
  );
  loadMembers()
    .then((members) => buttons.get(members.get(getUserId())?.avatar ?? 'orange')?.setAttribute('aria-pressed', 'true'))
    .catch(() => {});
  return section('Your capybara', h('p', { class: 'hint' }, 'Pick the capybara that appears beside your name.'), grid, status.el);
}

const PLAN_KEY = 'our-world.storage-gb';

function storageSection() {
  const status = createStatus();
  const fill = h('div', { class: 'progress-fill' });
  const text = h('p', { class: 'progress-text' }, 'Measuring…');
  let plan = 1;
  try {
    plan = Number(localStorage.getItem(PLAN_KEY)) || 1;
  } catch {
    // The free plan is assumed.
  }
  const size = h('input', { class: 'input', id: 'storage-plan', type: 'number', inputmode: 'decimal', min: '1', step: '1', value: String(plan) });
  let used = null;

  function show() {
    if (!used) return;
    const megabytes = used.bytes / 1_000_000;
    const share = Math.min(100, (megabytes / (plan * 1000)) * 100);
    fill.style.width = `${Math.max(1, share)}%`;
    const amount = megabytes >= 1000 ? `${(megabytes / 1000).toFixed(2)} GB` : `${megabytes.toFixed(0)} MB`;
    text.textContent = `About ${amount} of ${plan} GB used by ${used.photos.toLocaleString('en-US')} photos (${share.toFixed(share < 10 ? 1 : 0)}%).`;
  }

  storageUsed()
    .then((result) => {
      used = result;
      show();
    })
    .catch((error) => {
      text.textContent = '';
      status.say(friendlyError(error), true);
    });

  return section(
    'Storage',
    h('div', { class: 'progress' }, h('div', { class: 'progress-bar' }, fill), text),
    h(
      'div',
      { class: 'field' },
      h('label', { for: 'storage-plan' }, 'Storage in your Supabase plan (GB)'),
      h(
        'div',
        { class: 'input-row' },
        size,
        h(
          'button',
          {
            class: 'btn',
            type: 'button',
            onclick: () => {
              plan = Math.max(1, Math.round(Number(size.value)) || 1);
              size.value = String(plan);
              try {
                localStorage.setItem(PLAN_KEY, String(plan));
              } catch {
                // The number just lasts for this visit.
              }
              show();
              status.say('Updated.');
            },
          },
          'Update',
        ),
      ),
    ),
    h('p', { class: 'hint' }, 'The free plan has 1 GB. If you upgrade, type the new size here.'),
    status.el,
  );
}

function notificationSection() {
  const status = createStatus();
  const box = h('input', {
    type: 'checkbox',
    id: 'notify-on',
    checked: notificationsOn(),
    disabled: !notificationsSupported(),
    onchange: async () => {
      const on = await setNotifications(box.checked);
      if (box.checked && !on) {
        box.checked = false;
        status.say('Notifications are blocked for this site in your browser or phone settings.', true);
      } else {
        status.say(on ? 'Notifications are on for this device.' : 'Notifications are off for this device.');
      }
    },
  });
  return section(
    'Notifications',
    h('label', { class: 'check check--row', for: 'notify-on' }, box, 'Notify me about pokes, letters, and low hearts'),
    h(
      'p',
      { class: 'hint' },
      notificationsSupported()
        ? 'These appear while Our Little World is open in the background. On an iPhone, add the site to your Home Screen first. A fully closed site cannot send notifications yet.'
        : 'This browser cannot show notifications. On an iPhone, add the site to your Home Screen and open it from there.',
    ),
    status.el,
  );
}

function backupSection() {
  const status = createStatus();
  const bar = createProgressBar();
  bar.el.hidden = true;
  const dataButton = h(
    'button',
    {
      class: 'btn',
      type: 'button',
      onclick: async () => {
        dataButton.disabled = true;
        try {
          const counts = await downloadData();
          status.say(`Saved ${counts.memories} memories, ${counts.letters} letters, and everything else to one file.`);
        } catch (error) {
          status.say(friendlyError(error), true);
        }
        dataButton.disabled = false;
      },
    },
    'Download our data',
  );
  const photoButton = h(
    'button',
    {
      class: 'btn',
      type: 'button',
      onclick: async () => {
        photoButton.disabled = true;
        bar.el.hidden = false;
        try {
          const result = await downloadPhotos((done, total) => bar.set(done, total, `Packing photo ${done} of ${total}…`));
          status.say(
            result.missed
              ? `Saved ${result.saved} photos. ${result.missed} could not be fetched; try again later.`
              : `Saved all ${result.saved} photos.`,
            result.missed > 0,
          );
        } catch (error) {
          status.say(friendlyError(error), true);
        }
        bar.el.hidden = true;
        photoButton.disabled = false;
      },
    },
    'Download our photos',
  );
  return section(
    'Backup',
    h('p', { class: 'hint' }, 'Keep a copy on your own computer. The data is one file; the photos come as ZIP files of up to 150 photos each, sorted into folders by date.'),
    bar.el,
    status.el,
    h('div', { class: 'button-row' }, dataButton, photoButton),
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
    avatarSection(),
    lookSection(),
    soundSection(),
    notificationSection(),
    splashSection(),
    storageSection(),
    backupSection(),
    passwordSection(),
    signOutSection(),
  );
}
