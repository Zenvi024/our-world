// Every sound here is made on the spot with the browser's Web Audio tools:
// there are no audio files. The clicks are small woody "tocks"; the music is
// an original, gentle music-box loop.

const SFX_KEY = 'our-world.sfx';
const MUSIC_KEY = 'our-world.music';

const read = (key, fallback) => {
  try {
    const value = localStorage.getItem(key);
    return value === null ? fallback : value === 'on';
  } catch {
    return fallback;
  }
};
const write = (key, on) => {
  try {
    localStorage.setItem(key, on ? 'on' : 'off');
  } catch {
    // The choice just lasts for this visit.
  }
};

let sfxOn = read(SFX_KEY, true);
let musicOn = read(MUSIC_KEY, false);
const musicListeners = new Set();

let context = null;
let sfxBus = null;
let musicBus = null;

// Browsers only allow sound after a tap or click, so this is created lazily.
function audio() {
  if (!context) {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return null;
    context = new AudioContext();
    sfxBus = context.createGain();
    sfxBus.gain.value = 0.9;
    sfxBus.connect(context.destination);

    // The music runs through a soft echo for a cozy, roomy feel.
    musicBus = context.createGain();
    musicBus.gain.value = 0;
    const echo = context.createDelay(1);
    echo.delayTime.value = 0.36;
    const feedback = context.createGain();
    feedback.gain.value = 0.28;
    const echoLevel = context.createGain();
    echoLevel.gain.value = 0.3;
    musicBus.connect(context.destination);
    musicBus.connect(echo);
    echo.connect(feedback);
    feedback.connect(echo);
    echo.connect(echoLevel);
    echoLevel.connect(context.destination);
  }
  if (context.state === 'suspended') context.resume();
  return context;
}

const frequency = (midi) => 440 * 2 ** ((midi - 69) / 12);

// One plucked music-box note: a pure tone with a little shimmer that rings out.
function chime(bus, midi, when, { level = 0.2, ring = 1.4, type = 'sine' } = {}) {
  const ctx = context;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, when);
  gain.gain.exponentialRampToValueAtTime(level, when + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, when + ring);
  gain.connect(bus);
  for (const [multiple, share] of [[1, 1], [2, 0.22], [4, 0.06]]) {
    const voice = ctx.createOscillator();
    voice.type = type;
    voice.frequency.value = frequency(midi) * multiple;
    const part = ctx.createGain();
    part.gain.value = share;
    voice.connect(part);
    part.connect(gain);
    voice.start(when);
    voice.stop(when + ring + 0.05);
  }
}

// ---------- Sound effects ----------

export const isSfxOn = () => sfxOn;

export function setSfx(on) {
  sfxOn = on;
  write(SFX_KEY, on);
  if (on) playClick();
}

// A short, woody "tock" for buttons.
export function playClick() {
  if (!sfxOn) return;
  const ctx = audio();
  if (!ctx) return;
  const now = ctx.currentTime;
  const voice = ctx.createOscillator();
  voice.type = 'square';
  voice.frequency.setValueAtTime(560, now);
  voice.frequency.exponentialRampToValueAtTime(240, now + 0.045);
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 1500;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.16, now + 0.004);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.07);
  voice.connect(filter);
  filter.connect(gain);
  gain.connect(sfxBus);
  voice.start(now);
  voice.stop(now + 0.09);
}

function jingle(notes, spacing, options) {
  if (!sfxOn) return;
  const ctx = audio();
  if (!ctx) return;
  notes.forEach((midi, i) => chime(sfxBus, midi, ctx.currentTime + 0.02 + i * spacing, options));
}

// A bright rising sparkle for advancements and reached goals.
export const playAdvancement = () => jingle([72, 76, 79, 84], 0.09, { level: 0.2, ring: 0.9 });
// Two soft boops for a poke.
export const playPoke = () => jingle([79, 84], 0.11, { level: 0.2, ring: 0.5 });
// A gentle two-note confirmation.
export const playDone = () => jingle([76, 81], 0.1, { level: 0.16, ring: 0.6 });

// Plays the click for every button-like thing on the page.
export function installClickSounds() {
  document.addEventListener(
    'click',
    (event) => {
      const target = event.target.closest?.('button, a.slot, a.btn, summary');
      if (target && !target.disabled && !target.dataset.quiet) playClick();
    },
    true,
  );
}

// ---------- Music ----------
// An original 16-bar loop in C major at a slow, easy tempo: a music-box
// melody over rolling chords and a soft bass.

const STEP_SECONDS = 0.36; // one eighth note (about 83 beats per minute)
const BAR_STEPS = 8;

// Each bar: bass note, the chord the accompaniment rolls through, and the
// melody as [step, note, length in steps].
const BARS = [
  { bass: 48, chord: [60, 64, 67, 71], tune: [[0, 76, 2], [2, 79, 2], [4, 84, 4]] },
  { bass: 45, chord: [57, 60, 64, 67], tune: [[0, 81, 3], [3, 79, 1], [4, 76, 4]] },
  { bass: 41, chord: [57, 60, 65, 69], tune: [[0, 77, 2], [2, 81, 2], [4, 84, 2], [6, 81, 2]] },
  { bass: 43, chord: [59, 62, 67, 71], tune: [[0, 79, 4], [4, 74, 2], [6, 76, 2]] },
  { bass: 48, chord: [60, 64, 67, 71], tune: [[0, 76, 2], [2, 79, 2], [4, 88, 4]] },
  { bass: 40, chord: [59, 64, 67, 71], tune: [[0, 86, 3], [3, 83, 1], [4, 79, 4]] },
  { bass: 41, chord: [57, 60, 65, 69], tune: [[0, 81, 2], [2, 84, 2], [4, 77, 2], [6, 81, 2]] },
  { bass: 43, chord: [59, 62, 67, 69], tune: [[0, 79, 2], [2, 74, 2], [4, 79, 4]] },
  { bass: 48, chord: [60, 64, 67, 71], tune: [[0, 79, 4], [4, 76, 4]] },
  { bass: 45, chord: [57, 60, 64, 67], tune: [[0, 84, 2], [2, 81, 2], [4, 76, 4]] },
  { bass: 41, chord: [57, 60, 65, 69], tune: [[0, 81, 4], [4, 77, 2], [6, 79, 2]] },
  { bass: 43, chord: [59, 62, 67, 71], tune: [[0, 74, 2], [2, 79, 2], [4, 83, 4]] },
  { bass: 48, chord: [60, 64, 67, 71], tune: [[0, 84, 2], [2, 88, 2], [4, 79, 4]] },
  { bass: 40, chord: [59, 64, 67, 71], tune: [[0, 83, 2], [2, 79, 2], [4, 76, 4]] },
  { bass: 41, chord: [57, 60, 65, 69], tune: [[0, 77, 2], [2, 81, 2], [4, 84, 4]] },
  { bass: 43, chord: [59, 62, 67, 71], tune: [[0, 86, 2], [2, 83, 2], [4, 79, 2], [6, 74, 2]] },
];
// The accompaniment rolls up and back down through the chord.
const ROLL = [0, 1, 2, 3, 2, 1, 2, 1];

let step = 0;
let nextStepAt = 0;
let scheduler = null;

function scheduleStep(index, when) {
  const bar = BARS[Math.floor(index / BAR_STEPS) % BARS.length];
  const beat = index % BAR_STEPS;
  chime(musicBus, bar.chord[ROLL[beat]], when, { level: 0.05, ring: 0.9 });
  if (beat === 0 || beat === 4) chime(musicBus, bar.bass, when, { level: 0.11, ring: 1.6, type: 'triangle' });
  for (const [at, midi, length] of bar.tune) {
    if (at === beat) chime(musicBus, midi, when, { level: 0.1, ring: 0.5 + length * STEP_SECONDS });
  }
}

function pump() {
  // Queue up everything due in the next moment (timers can be late; audio cannot).
  while (nextStepAt < context.currentTime + 0.9) {
    scheduleStep(step, nextStepAt);
    step += 1;
    nextStepAt += STEP_SECONDS;
  }
}

function startMusic() {
  const ctx = audio();
  if (!ctx || scheduler) return;
  musicBus.gain.cancelScheduledValues(ctx.currentTime);
  musicBus.gain.setValueAtTime(0.0001, ctx.currentTime);
  musicBus.gain.exponentialRampToValueAtTime(0.8, ctx.currentTime + 1.2);
  nextStepAt = ctx.currentTime + 0.15;
  pump();
  scheduler = setInterval(pump, 250);
}

function stopMusic() {
  if (!scheduler) return;
  clearInterval(scheduler);
  scheduler = null;
  musicBus.gain.cancelScheduledValues(context.currentTime);
  musicBus.gain.setTargetAtTime(0.0001, context.currentTime, 0.15);
}

export const isMusicOn = () => musicOn;

// Turning music on must happen inside a tap or click.
export function setMusic(on) {
  musicOn = on;
  write(MUSIC_KEY, on);
  if (on) startMusic();
  else stopMusic();
  musicListeners.forEach((listener) => listener(on));
}

export function onMusicChange(listener) {
  musicListeners.add(listener);
  return () => musicListeners.delete(listener);
}

// If music was left on last time, it starts again at the first tap, and it
// rests whenever the page is in the background.
export function installMusic() {
  const wake = () => {
    if (musicOn) startMusic();
  };
  document.addEventListener('pointerdown', wake, { once: true, capture: true });
  document.addEventListener('visibilitychange', () => {
    if (!context) return;
    if (document.hidden) {
      stopMusic();
    } else if (musicOn) {
      startMusic();
    }
  });
}
