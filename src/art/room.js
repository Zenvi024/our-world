import { drawSprite } from './pixel.js';
import { CAPYBARA_BODY, HATS, ACCESSORIES, drawCapybara } from './outfits.js';
import {
  WIDTH,
  HEIGHT,
  rect,
  noise,
  drawRoom,
  drawGlows,
  drawBlanket,
  drawTubFront,
  furniturePreview,
  roomPreview,
  wallPreview,
  floorPreview,
} from './rooms.js';

// The live view of one room of Happybara's house: the room itself, the two
// bowls, and the capybara going about its day.

const TICK_MS = 120;
const SCALE = 2; // the capybara is drawn at twice its sprite size
const SCENE_TICKS = 26; // how long a feeding, bath, or game lasts

const withRows = (changes) => CAPYBARA_BODY.map((row, i) => changes[i] ?? row);
// A sad face has a tear under one eye; a sleeping one has its eyes closed.
const SAD_BODY = withRows({ 5: '.CTCSSSSSCCC.', 6: '.CTCSSNSSCCC.' });
const SLEEP_BODY = withRows({ 4: '.kkCCSSSCCkk.' });

const TREATS = {
  food_pack: {
    rows: ['...dddddd...', '..d......d..', '.d.rr.gg..d.', '.rrrrgggoo..', 'bbbbbbbbbbbb', 'bBbBbBbBbBbB', '.bBbBbBbBbB.', '.bbbbbbbbbb.'],
    colors: { d: '#7b4f30', r: '#e2574c', g: '#6cc24a', o: '#f28c1e', b: '#cf9b6a', B: '#a9744a' },
  },
  treat_watermelon: {
    rows: ['............', 'gggggggggggg', '.GwwwwwwwwG.', '.GrrrrrrrrG.', '..rrkrrkrr..', '...rrrrrr...', '....rkrr....', '.....rr.....'],
    colors: { g: '#2f6b22', G: '#6cc24a', w: '#f4fbe8', r: '#f0606b', k: '#2b2a26' },
  },
  treat_yuzu: {
    rows: ['.....gg.....', '....ggb.....', '...yyyyyy...', '..yyYyyyyy..', '..yYyyyyyy..', '..yyyyyyyy..', '..yyyyyyyo..', '...yyyyoo...'],
    colors: { g: '#46952f', b: '#5a3a22', y: '#ffd83d', Y: '#fff3a6', o: '#e9b21c' },
  },
  treat_cake: {
    rows: ['.....rr.....', '.....rr.....', '..wwwwwwww..', '..wpwwpwwp..', '..cccccccc..', '..pppppppp..', '..cccccccc..', '.wwwwwwwwww.'],
    colors: { r: '#e2574c', w: '#ffffff', p: '#f7a8c9', c: '#f0d9a0' },
  },
};

const HEART = ['.r.r.', 'rrrrr', '.rrr.', '..r..'];
const SPARK = ['..y..', '.yyy.', 'yyyyy', '.yyy.', '..y..'];
const BOOK = ['.wwwwww.wwwwww.', 'bwkkkkwbwkkkkwb', 'bwwwwwwbwwwwwwb', 'bbbbbbbbbbbbbbb'];

function drawBowl(ctx, x, level, fillColor) {
  rect(ctx, '#8f8f8f', x, 77, 12, 4);
  rect(ctx, '#6f6f6f', x + 1, 81, 10, 1);
  rect(ctx, '#3b3b3b', x + 1, 77, 10, 1);
  if (level > 5) rect(ctx, fillColor, x + 1, 77, Math.max(2, Math.round((level / 100) * 10)), 1);
  if (level > 55) rect(ctx, fillColor, x + 3, 76, 6, 1);
}

// A small picture of something from the shop: { key, kind }.
export function itemPreview({ key, kind }) {
  let canvas;
  if (kind === 'furniture') canvas = furniturePreview(key);
  else if (kind === 'room') canvas = roomPreview(key.replace('room_', ''));
  else if (kind === 'wall') canvas = wallPreview(key);
  else if (kind === 'floor') canvas = floorPreview(key);
  else {
    canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (TREATS[key]) {
      canvas.width = 12;
      canvas.height = 8;
      drawSprite(ctx, TREATS[key].rows, 0, 0, TREATS[key].colors);
    } else {
      // A hat or an accessory, shown on a capybara's head and shoulders.
      const rise = HATS[key] ? HATS[key].rows.length - (HATS[key].sink ?? 0) : 0;
      canvas.width = 13;
      canvas.height = 11 + rise;
      drawCapybara(ctx, 0, rise, {
        body: CAPYBARA_BODY.slice(0, 11),
        hat: HATS[key] ? key : null,
        accessory: ACCESSORIES[key] ? key : null,
      });
    }
  }
  canvas.className = 'pet-item-art';
  return canvas;
}

// Starts the room. Returns controls: stop(), update(state), play(kind, trick),
// and hit(clientX, clientY) -> true if the capybara was tapped.
export function startRoom(canvas) {
  const ctx = canvas.getContext('2d');
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const backdrop = document.createElement('canvas');
  backdrop.width = WIDTH;
  backdrop.height = HEIGHT;

  let state = {
    room: 'living',
    items: new Set(),
    style: null,
    wearing: null,
    accessory: null,
    mood: 'happy',
    hunger: 100,
    thirst: 100,
    bowls: true,
    asleep: false,
    focusing: false,
    night: false,
    dusk: false,
  };
  let act = { kind: 'idle', ticks: 0 };
  let floaters = []; // hearts and sparkles that drift up
  let tick = 0;
  let x = 52;
  let direction = 1;
  let last = { bodyX: 52, bodyY: 46 };
  let attached = false;

  function paint() {
    ctx.drawImage(backdrop, 0, 0);
    if (state.bowls) {
      drawBowl(ctx, 38, state.hunger, '#d99a3c');
      drawBowl(ctx, 78, state.thirst, '#5aa9e6');
    }

    // Where the capybara is, and how it moves, depends on what it is doing.
    const idle = act.kind === 'idle';
    const inBed = state.asleep && idle && state.room === 'bedroom' && state.items.has('bed');
    const inTub = act.kind === 'bathe' && state.room === 'bathroom' && state.items.has('tub');
    let bodyX = Math.round(x);
    let bodyY = 46;
    let body = CAPYBARA_BODY;
    if (state.asleep && idle) body = SLEEP_BODY;
    else if (state.mood === 'sad' && idle) body = SAD_BODY;
    const phase = act.ticks;

    if (inBed) {
      bodyX = 96;
      bodyY = 28;
    } else if (act.kind === 'feed') {
      bodyX = 31;
      bodyY += phase % 4 < 2 ? 2 : 0; // munching
    } else if (act.kind === 'water') {
      bodyX = 71;
      bodyY += phase % 6 < 3 ? 2 : 0;
    } else if (act.kind === 'treat') {
      bodyY += phase % 4 < 2 ? 1 : 0;
    } else if (act.kind === 'play' || act.trick === 'jump') {
      bodyY -= Math.round(Math.abs(Math.sin(phase / 2.2)) * (act.kind === 'play' ? 9 : 12));
    } else if (inTub) {
      bodyX = 88;
      bodyY = 36 + (phase % 6 < 3 ? 1 : 0);
    } else if (act.trick === 'wiggle') {
      bodyX += phase % 4 < 2 ? -2 : 2;
    } else if (act.kind === 'pet') {
      bodyY -= phase % 4 < 2 ? 2 : 0;
    } else if (state.focusing) {
      bodyX = 51;
    } else if (!state.asleep && state.mood !== 'sad' && !reduceMotion) {
      bodyY -= Math.round(Math.abs(Math.sin(tick / 6)) * 2); // a gentle bob
    }

    if (!inBed && !inTub) rect(ctx, 'rgba(0, 0, 0, 0.18)', bodyX + 2, 72, 22, 2);
    drawCapybara(ctx, bodyX, bodyY, { body, hat: state.wearing, accessory: state.accessory, scale: SCALE });
    if (inBed) drawBlanket(ctx, true);
    if (inTub) drawTubFront(ctx);

    if (state.focusing && idle) drawSprite(ctx, BOOK, bodyX + 6, bodyY + 21, { w: '#fbf5e3', k: '#b9b29a', b: '#8a4528' });
    if (act.kind === 'treat' && act.treat && phase < 16) {
      const treat = TREATS[act.treat];
      drawSprite(ctx, treat.rows, bodyX + 7, bodyY + 22 - Math.min(6, phase), treat.colors);
    }
    if (act.kind === 'play') {
      const ballX = bodyX + 30 + Math.round(Math.sin(phase / 2.2) * 6);
      const ballY = 68 - Math.round(Math.abs(Math.cos(phase / 2.2)) * 16);
      rect(ctx, '#e2574c', ballX, ballY, 5, 5);
      rect(ctx, '#ffffff', ballX + 1, ballY + 1, 2, 2);
    }
    if (act.kind === 'bathe') {
      for (let i = 0; i < 7; i += 1) {
        const age = ((phase + i * 5) % 24) / 24;
        ctx.globalAlpha = 1 - age;
        rect(ctx, '#ffffff', bodyX + 1 + Math.round(noise(i, 9) * 24), Math.round(bodyY + 16 - age * 22), 2, 2);
      }
      ctx.globalAlpha = 1;
    }
    if (state.asleep && idle) {
      for (let i = 0; i < 2; i += 1) {
        const age = ((tick + i * 14) % 28) / 28;
        ctx.globalAlpha = 1 - age;
        drawSprite(ctx, ['www', '.w.', 'www'], bodyX + 24 + i * 3 + Math.round(age * 4), Math.round(bodyY - 2 - age * 12), { w: '#ffffff' });
      }
      ctx.globalAlpha = 1;
    }
    for (const floater of floaters) {
      ctx.globalAlpha = Math.max(0, 1 - floater.age / 16);
      const sprite = floater.spark ? SPARK : HEART;
      drawSprite(ctx, sprite, floater.x, Math.round(floater.y - floater.age), { r: '#e2574c', y: '#ffe36b' });
    }
    ctx.globalAlpha = 1;

    if (state.night) {
      rect(ctx, 'rgba(14, 22, 66, 0.34)', 0, 0, WIDTH, HEIGHT);
      drawGlows(ctx, state.room, state.items);
    }
    last = { bodyX, bodyY };
  }

  function step() {
    // The room stops itself once its screen has been left.
    if (canvas.isConnected) attached = true;
    else if (attached) {
      clearInterval(timer);
      return;
    }
    tick += 1;
    floaters = floaters.filter((floater) => (floater.age += 1) < 16);
    if (act.kind !== 'idle') {
      act.ticks += 1;
      if (act.ticks > SCENE_TICKS) act = { kind: 'idle', ticks: 0 };
    } else if (!state.asleep && !state.focusing && state.mood !== 'sad') {
      // Wander a little.
      x += direction * 0.25;
      if (x > 68) direction = -1;
      if (x < 38) direction = 1;
    }
    paint();
  }

  function rebuild() {
    drawRoom(backdrop.getContext('2d'), state.room, state);
    paint();
  }

  rebuild();
  const timer = reduceMotion ? null : setInterval(step, TICK_MS);

  return {
    stop: () => clearInterval(timer),
    update(next) {
      state = { ...state, ...next };
      rebuild();
    },
    // Plays a short scene: 'feed', 'water', 'play', 'bathe', 'treat', or
    // 'pet' (with a trick: 'hop', 'jump', 'wiggle', 'hearts', or 'sparkle').
    play(kind, extra = {}) {
      act = { kind, ticks: 0, ...extra };
      const puff = (count, spark) => {
        for (let i = 0; i < count; i += 1) {
          floaters.push({ x: last.bodyX + 2 + Math.round(noise(tick, i, 11) * 20), y: last.bodyY - 4 - i * 2, age: -i, spark });
        }
      };
      if (kind === 'pet') puff(extra.trick === 'hearts' ? 5 : extra.trick === 'sparkle' ? 4 : 1, extra.trick === 'sparkle');
      if (kind === 'treat') puff(3, false);
      if (reduceMotion) paint();
    },
    hit(clientX, clientY) {
      const box = canvas.getBoundingClientRect();
      const px = ((clientX - box.left) / box.width) * WIDTH;
      const py = ((clientY - box.top) / box.height) * HEIGHT;
      return px >= last.bodyX - 3 && px <= last.bodyX + 29 && py >= last.bodyY - 10 && py <= last.bodyY + 30;
    },
  };
}
