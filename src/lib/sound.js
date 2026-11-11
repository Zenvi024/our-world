// Every sound here is made on the spot with the browser's Web Audio tools:
// there are no audio files. The clicks are small woody "tocks"; the music is
// an original, gentle music-box loop.

const SFX_KEY = 'our-world.sfx';
const MUSIC_KEY = 'our-world.music-level';

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

const readLevel = () => {
  try {
    const level = Number(localStorage.getItem(MUSIC_KEY));
    return level >= 0 && level <= 3 ? Math.round(level) : 0;
  } catch {
    return 0;
  }
};

let sfxOn = read(SFX_KEY, true);
let musicLevel = readLevel(); // 0 = off, 1 = soft, 2 = medium, 3 = full
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

let noiseBuffer = null;

// A short burst of hiss, shaped by a filter: the raw material for creaks and swishes.
function hiss(seconds, shape) {
  const ctx = audio();
  if (!ctx) return null;
  if (!noiseBuffer) {
    noiseBuffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
  }
  const source = ctx.createBufferSource();
  source.buffer = noiseBuffer;
  const filter = ctx.createBiquadFilter();
  const gain = ctx.createGain();
  shape(ctx.currentTime, filter, gain);
  source.connect(filter);
  filter.connect(gain);
  gain.connect(sfxBus);
  source.start();
  source.stop(ctx.currentTime + seconds);
  return ctx;
}

// A wooden lid swinging open.
export function playCreak() {
  if (!sfxOn) return;
  const ctx = hiss(0.32, (now, filter, gain) => {
    filter.type = 'bandpass';
    filter.Q.value = 6;
    filter.frequency.setValueAtTime(260, now);
    filter.frequency.exponentialRampToValueAtTime(900, now + 0.28);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.5, now + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.3);
  });
  if (!ctx) return;
  const now = ctx.currentTime;
  const thud = ctx.createOscillator();
  thud.type = 'triangle';
  thud.frequency.setValueAtTime(120, now + 0.24);
  thud.frequency.exponentialRampToValueAtTime(70, now + 0.34);
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, now + 0.24);
  gain.gain.exponentialRampToValueAtTime(0.2, now + 0.26);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.38);
  thud.connect(gain);
  gain.connect(sfxBus);
  thud.start(now + 0.24);
  thud.stop(now + 0.4);
}

// A page turning.
export function playPage() {
  if (!sfxOn) return;
  hiss(0.2, (now, filter, gain) => {
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(1800, now);
    filter.frequency.exponentialRampToValueAtTime(4200, now + 0.16);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.16, now + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
  });
}

// A little pop, like picking something up.
export function playPop() {
  if (!sfxOn) return;
  const ctx = audio();
  if (!ctx) return;
  const now = ctx.currentTime;
  const voice = ctx.createOscillator();
  voice.type = 'sine';
  voice.frequency.setValueAtTime(420, now);
  voice.frequency.exponentialRampToValueAtTime(900, now + 0.06);
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.2, now + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.09);
  voice.connect(gain);
  gain.connect(sfxBus);
  voice.start(now);
  voice.stop(now + 0.1);
}

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
// Three original music-box pieces that take turns. Each is 16 bars: a melody
// over chords that roll gently up and down, with a soft bass underneath.

// Compact notation: a bar is [bass, chord, tune], where the tune is a list of
// [step, note, length in steps] and notes are MIDI numbers.
const C = [60, 64, 67, 71];
const Am = [57, 60, 64, 67];
const F = [57, 60, 65, 69];
const G = [59, 62, 67, 71];
const Em = [59, 64, 67, 71];

const MEADOW = {
  step: 0.36, // an easy four-beat stroll in C
  beats: 8,
  roll: [0, 1, 2, 3, 2, 1, 2, 1],
  bars: [
    [48, C, [[0, 76, 2], [2, 79, 2], [4, 84, 4]]],
    [45, Am, [[0, 81, 3], [3, 79, 1], [4, 76, 4]]],
    [41, F, [[0, 77, 2], [2, 81, 2], [4, 84, 2], [6, 81, 2]]],
    [43, G, [[0, 79, 4], [4, 74, 2], [6, 76, 2]]],
    [48, C, [[0, 76, 2], [2, 79, 2], [4, 88, 4]]],
    [40, Em, [[0, 86, 3], [3, 83, 1], [4, 79, 4]]],
    [41, F, [[0, 81, 2], [2, 84, 2], [4, 77, 2], [6, 81, 2]]],
    [43, [59, 62, 67, 69], [[0, 79, 2], [2, 74, 2], [4, 79, 4]]],
    [48, C, [[0, 79, 4], [4, 76, 4]]],
    [45, Am, [[0, 84, 2], [2, 81, 2], [4, 76, 4]]],
    [41, F, [[0, 81, 4], [4, 77, 2], [6, 79, 2]]],
    [43, G, [[0, 74, 2], [2, 79, 2], [4, 83, 4]]],
    [48, C, [[0, 84, 2], [2, 88, 2], [4, 79, 4]]],
    [40, Em, [[0, 83, 2], [2, 79, 2], [4, 76, 4]]],
    [41, F, [[0, 77, 2], [2, 81, 2], [4, 84, 4]]],
    [43, G, [[0, 86, 2], [2, 83, 2], [4, 79, 2], [6, 74, 2]]],
  ],
};

const Fmaj = [57, 60, 65, 69];
const Dm = [57, 62, 65, 69];
const Bb = [58, 62, 65, 70];
const Cmaj = [55, 60, 64, 67];
const Amin = [57, 60, 64, 69];
const C7 = [58, 60, 64, 67];

const PETALS = {
  step: 0.3, // a slow waltz in F
  beats: 6,
  roll: [0, 1, 2, 3, 2, 1],
  bars: [
    [41, Fmaj, [[0, 81, 2], [2, 84, 2], [4, 89, 2]]],
    [38, Dm, [[0, 86, 4], [4, 81, 2]]],
    [46, Bb, [[0, 82, 2], [2, 86, 2], [4, 89, 2]]],
    [48, Cmaj, [[0, 88, 4], [4, 84, 2]]],
    [41, Fmaj, [[0, 89, 2], [2, 84, 2], [4, 81, 2]]],
    [45, Amin, [[0, 84, 4], [4, 76, 2]]],
    [46, Bb, [[0, 86, 2], [2, 82, 2], [4, 79, 2]]],
    [48, C7, [[0, 84, 6]]],
    [41, Fmaj, [[0, 84, 4], [4, 81, 2]]],
    [38, Dm, [[0, 89, 2], [2, 86, 2], [4, 81, 2]]],
    [46, Bb, [[0, 86, 4], [4, 82, 2]]],
    [48, Cmaj, [[0, 79, 2], [2, 84, 2], [4, 88, 2]]],
    [41, Fmaj, [[0, 89, 4], [4, 81, 2]]],
    [45, Amin, [[0, 88, 2], [2, 84, 2], [4, 81, 2]]],
    [46, Bb, [[0, 82, 2], [2, 86, 2], [4, 89, 2]]],
    [48, C7, [[0, 88, 2], [2, 84, 2], [4, 79, 2]]],
  ],
};

const Gmaj = [59, 62, 67, 71];
const Emin = [59, 64, 67, 71];
const Cadd = [60, 64, 67, 72];
const D = [57, 62, 66, 69];
const Bm = [59, 62, 66, 71];

const LANTERN = {
  step: 0.42, // a sleepy lullaby in G
  beats: 8,
  roll: [0, 2, 1, 3, 2, 1, 2, 1],
  bars: [
    [43, Gmaj, [[0, 83, 4], [4, 86, 4]]],
    [40, Emin, [[0, 88, 2], [2, 86, 2], [4, 83, 4]]],
    [48, Cadd, [[0, 76, 2], [2, 79, 2], [4, 84, 4]]],
    [50, D, [[0, 81, 4], [4, 78, 2], [6, 81, 2]]],
    [43, Gmaj, [[0, 83, 2], [2, 86, 2], [4, 91, 4]]],
    [47, Bm, [[0, 90, 3], [3, 86, 1], [4, 83, 4]]],
    [48, Cadd, [[0, 88, 2], [2, 84, 2], [4, 79, 4]]],
    [50, D, [[0, 81, 2], [2, 86, 2], [4, 81, 4]]],
    [43, Gmaj, [[0, 86, 8]]],
    [40, Emin, [[0, 83, 4], [4, 79, 4]]],
    [48, Cadd, [[0, 84, 4], [4, 88, 4]]],
    [50, D, [[0, 86, 2], [2, 81, 2], [4, 78, 4]]],
    [43, Gmaj, [[0, 79, 2], [2, 83, 2], [4, 86, 4]]],
    [47, Bm, [[0, 86, 4], [4, 83, 4]]],
    [48, Cadd, [[0, 88, 2], [2, 91, 2], [4, 88, 4]]],
    [50, D, [[0, 86, 4], [4, 81, 4]]],
  ],
};

const TRACKS = [MEADOW, PETALS, LANTERN];
const LEVEL_GAIN = [0.0001, 0.3, 0.6, 1];
const REST_SECONDS = 2.5; // a breath between pieces

let trackIndex = Math.floor(Math.random() * TRACKS.length);
let step = 0;
let nextStepAt = 0;
let scheduler = null;

function scheduleStep(track, index, when) {
  const [bass, chord, tune] = track.bars[Math.floor(index / track.beats)];
  const beat = index % track.beats;
  chime(musicBus, chord[track.roll[beat]], when, { level: 0.05, ring: 0.9 });
  if (beat === 0 || beat * 2 === track.beats) {
    chime(musicBus, bass, when, { level: 0.11, ring: 1.6, type: 'triangle' });
  }
  for (const [at, midi, length] of tune) {
    if (at === beat) chime(musicBus, midi, when, { level: 0.1, ring: 0.5 + length * track.step });
  }
}

function pump() {
  // Queue up everything due in the next moment (timers can be late; audio cannot).
  while (nextStepAt < context.currentTime + 0.9) {
    const track = TRACKS[trackIndex];
    scheduleStep(track, step, nextStepAt);
    step += 1;
    nextStepAt += track.step;
    if (step >= track.bars.length * track.beats) {
      // The piece is over: rest, then play the next one.
      step = 0;
      trackIndex = (trackIndex + 1) % TRACKS.length;
      nextStepAt += REST_SECONDS;
    }
  }
}

function fadeTo(gain, seconds) {
  const now = context.currentTime;
  musicBus.gain.cancelScheduledValues(now);
  musicBus.gain.setValueAtTime(Math.max(musicBus.gain.value, 0.0001), now);
  musicBus.gain.exponentialRampToValueAtTime(gain, now + seconds);
}

function startMusic() {
  const ctx = audio();
  if (!ctx) return;
  fadeTo(LEVEL_GAIN[musicLevel], 0.8);
  if (scheduler) return;
  nextStepAt = ctx.currentTime + 0.15;
  pump();
  scheduler = setInterval(pump, 250);
}

function stopMusic() {
  if (!scheduler) return;
  clearInterval(scheduler);
  scheduler = null;
  fadeTo(0.0001, 0.3);
}

export const getMusicLevel = () => musicLevel;
export const isMusicOn = () => musicLevel > 0;

// Sets the music volume: 0 (off), 1, 2, or 3. Turning music on must happen
// inside a tap or click.
export function setMusicLevel(level) {
  musicLevel = level;
  try {
    localStorage.setItem(MUSIC_KEY, String(level));
  } catch {
    // The choice just lasts for this visit.
  }
  if (level > 0) startMusic();
  else stopMusic();
  musicListeners.forEach((listener) => listener(level));
}

// One button does it all: off, soft, medium, full, and back to off.
export const cycleMusicLevel = () => setMusicLevel((musicLevel + 1) % 4);

// Skips to the next piece.
export function nextTrack() {
  trackIndex = (trackIndex + 1) % TRACKS.length;
  step = 0;
  if (context) nextStepAt = context.currentTime + 0.3;
}

export function onMusicChange(listener) {
  musicListeners.add(listener);
  return () => musicListeners.delete(listener);
}

// If music was left on last time, it starts again at the first tap, and it
// rests whenever the page is in the background.
export function installMusic() {
  const wake = () => {
    if (musicLevel > 0) startMusic();
  };
  document.addEventListener('pointerdown', wake, { once: true, capture: true });
  document.addEventListener('visibilitychange', () => {
    if (!context) return;
    if (document.hidden) stopMusic();
    else if (musicLevel > 0) startMusic();
  });
}
