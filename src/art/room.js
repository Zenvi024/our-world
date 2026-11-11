import { drawSprite } from './pixel.js';
import { CAPYBARA_BODY, CAPYBARA_COLORS } from './landscape.js';

// Happybara's room, drawn on a small canvas and scaled up with crisp pixels:
// a wooden floor, a window that shows the time of day, whatever furniture
// has been bought, two bowls, and the capybara itself.

const WIDTH = 128;
const HEIGHT = 84;
const FLOOR_Y = 56;
const TICK_MS = 120;
const SCALE = 2; // the capybara is drawn at twice its sprite size
const SCENE_TICKS = 26; // how long a feeding, bath, or game lasts

const HATS = {
  hat_orange: { rows: ['.....OoO.....', '.....OOO.....'], colors: { O: '#f28c1e', o: '#ffb648' } },
  hat_blossom: { rows: ['......p......', '.....pwp.....'], colors: { p: '#f7a8c9', w: '#ffe3ee' } },
  hat_bow: { rows: ['...rr...rr...', '....rrRrr....'], colors: { r: '#e2574c', R: '#b5372f' } },
  hat_crown: { rows: ['...y.y.y.y...', '...yyyryyy...'], colors: { y: '#ffd83d', r: '#e2574c' } },
};

const withRows = (changes) => CAPYBARA_BODY.map((row, i) => changes[i] ?? row);
// A sad face has lowered eyes; a sleeping one has them closed.
const SAD_BODY = withRows({ 4: '.CCCCSSSCCCC.', 5: '.CkCSSSSSCkC.' });
const SLEEP_BODY = withRows({ 4: '.kkCCSSSCCkk.' });

const BASKET = [
  '...dddddd...',
  '..d......d..',
  '.d.rr.gg..d.',
  '.rrrrgggoo..',
  'bbbbbbbbbbbb',
  'bBbBbBbBbBbB',
  '.bBbBbBbBbB.',
  '.bbbbbbbbbb.',
];
const BASKET_COLORS = { d: '#7b4f30', r: '#e2574c', g: '#6cc24a', o: '#f28c1e', b: '#cf9b6a', B: '#a9744a' };

function rect(ctx, color, x, y, w, h) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
}

function noise(x, y) {
  let n = (x * 374761393 + y * 668265263) | 0;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

export function manilaHour() {
  return Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Manila', hour: 'numeric', hour12: false }).format(new Date())) % 24;
}

function drawScaled(ctx, rows, x0, y0, scale, palette) {
  rows.forEach((row, y) => {
    [...row].forEach((char, x) => {
      if (char !== '.') rect(ctx, palette[char], x0 + x * scale, y0 + y * scale, scale, scale);
    });
  });
}

// Each piece of furniture has its own spot in the room.
const FURNITURE = {
  painting(ctx) {
    rect(ctx, '#7b4f30', 50, 10, 26, 19);
    rect(ctx, '#c2e8f9', 52, 12, 22, 15);
    for (let i = 0; i < 9; i += 1) rect(ctx, i < 3 ? '#fbfdff' : '#a9bcd1', 62 - i, 15 + i, 2 + i * 2, 1);
    rect(ctx, '#6cc24a', 52, 24, 22, 3);
    rect(ctx, '#ffd83d', 69, 14, 3, 3);
  },
  bookshelf(ctx) {
    rect(ctx, '#6b4329', 98, 14, 28, 42);
    const books = ['#c8423a', '#5d8fc9', '#5ba548', '#d99a3c', '#9a6bb5', '#efe1ba'];
    for (let shelf = 0; shelf < 3; shelf += 1) {
      rect(ctx, '#3a2718', 100, 17 + shelf * 13, 24, 10);
      for (let i = 0; i < 7; i += 1) {
        const short = (i + shelf) % 3 === 0 ? 2 : 0;
        rect(ctx, books[(i + shelf * 2) % books.length], 101 + i * 3, 19 + shelf * 13 + short, 2, 8 - short);
      }
    }
  },
  lamp(ctx) {
    rect(ctx, '#5a3a22', 86, 40, 2, 17);
    rect(ctx, '#5a3a22', 83, 56, 8, 2);
    rect(ctx, '#ffe9a3', 81, 31, 12, 9);
    rect(ctx, '#ffd83d', 81, 38, 12, 2);
  },
  plant(ctx) {
    rect(ctx, '#b0603a', 45, 49, 10, 9);
    rect(ctx, '#8a4528', 44, 48, 12, 2);
    for (const [dx, dy, w, h] of [[2, -11, 6, 11], [-2, -7, 5, 6], [6, -8, 6, 7], [3, -15, 4, 6]]) {
      rect(ctx, dy < -10 ? '#6cc24a' : '#46952f', 45 + dx, 48 + dy, w, h);
    }
  },
  rug(ctx) {
    rect(ctx, '#c8423a', 34, 64, 60, 12);
    rect(ctx, '#e0685c', 36, 66, 56, 8);
    for (let x = 38; x < 90; x += 6) rect(ctx, '#ffe3ee', x, 69, 2, 2);
  },
  bed(ctx) {
    rect(ctx, '#6b4329', 94, 60, 3, 16);
    rect(ctx, '#6b4329', 94, 70, 32, 5);
    rect(ctx, '#6b4329', 94, 74, 3, 4);
    rect(ctx, '#6b4329', 123, 74, 3, 4);
    rect(ctx, '#fbf5e3', 97, 64, 28, 7);
    rect(ctx, '#ffffff', 98, 63, 8, 5);
    drawBlanket(ctx);
  },
  tub(ctx) {
    drawTub(ctx);
  },
};
const FURNITURE_ORDER = ['painting', 'bookshelf', 'lamp', 'plant', 'rug', 'bed', 'tub'];

function drawBlanket(ctx) {
  rect(ctx, '#f7a8c9', 106, 64, 19, 7);
  rect(ctx, '#ffd3e4', 106, 64, 19, 2);
}

function drawTub(ctx) {
  rect(ctx, '#86c8f1', 5, 68, 24, 3);
  rect(ctx, '#a9744a', 4, 70, 26, 11);
  rect(ctx, '#cf9b6a', 4, 70, 26, 2);
  rect(ctx, '#7b4f30', 4, 74, 26, 1);
  rect(ctx, '#7b4f30', 4, 78, 26, 1);
  rect(ctx, '#5a3a22', 12, 70, 1, 11);
  rect(ctx, '#5a3a22', 21, 70, 1, 11);
}

function drawWallAndFloor(ctx, night, dusk) {
  for (let y = 0; y < FLOOR_Y; y += 1) {
    for (let x = 0; x < WIDTH; x += 1) {
      rect(ctx, x % 16 === 15 ? '#d9c79a' : noise(x >> 1, y) < 0.06 ? '#e6d6ad' : '#efe1ba', x, y, 1, 1);
    }
  }
  for (let y = FLOOR_Y; y < HEIGHT; y += 1) {
    for (let x = 0; x < WIDTH; x += 1) {
      const plank = Math.floor((y - FLOOR_Y) / 7);
      const seam = (y - FLOOR_Y) % 7 === 6 || (x + plank * 11) % 26 === 0;
      rect(ctx, seam ? '#8a5a37' : noise(x, y) < 0.12 ? '#b98556' : '#a9744a', x, y, 1, 1);
    }
  }
  rect(ctx, '#7b4f30', 0, FLOOR_Y - 2, WIDTH, 2);

  // The window shows the sky outside.
  rect(ctx, '#5a3a22', 10, 10, 30, 26);
  rect(ctx, night ? '#141f50' : dusk ? '#f6b672' : '#86c8f1', 12, 12, 26, 22);
  if (night) {
    for (let i = 0; i < 7; i += 1) rect(ctx, '#ffffff', 13 + Math.floor(noise(i, 1) * 24), 13 + Math.floor(noise(i, 2) * 14), 1, 1);
    rect(ctx, '#f6f8ff', 29, 15, 5, 5);
    rect(ctx, '#141f50', 31, 15, 3, 3);
  } else {
    rect(ctx, '#ffffff', 16, 16, 10, 3);
    rect(ctx, '#ffffff', 19, 14, 5, 2);
    rect(ctx, dusk ? '#5d9a55' : '#8cc89b', 12, 28, 26, 6);
  }
  rect(ctx, '#5a3a22', 24, 12, 2, 22);
  rect(ctx, '#5a3a22', 12, 22, 26, 2);
  rect(ctx, '#7b4f30', 8, 36, 34, 2);
}

function drawBackdrop(ctx, items, night, dusk) {
  drawWallAndFloor(ctx, night, dusk);
  for (const key of FURNITURE_ORDER) if (items.has(key)) FURNITURE[key](ctx);
}

function drawBowl(ctx, x, level, fillColor) {
  rect(ctx, '#8f8f8f', x, 77, 12, 4);
  rect(ctx, '#6f6f6f', x + 1, 81, 10, 1);
  rect(ctx, '#3b3b3b', x + 1, 77, 10, 1);
  if (level > 5) rect(ctx, fillColor, x + 1, 77, Math.max(2, Math.round((level / 100) * 10)), 1);
  if (level > 55) rect(ctx, fillColor, x + 3, 76, 6, 1);
}

// A small picture of something from the shop, cut from the room itself.
const PREVIEW_BOXES = {
  painting: [48, 8, 30, 23],
  bookshelf: [96, 12, 32, 46],
  lamp: [77, 29, 20, 30],
  plant: [41, 31, 18, 28],
  rug: [32, 60, 64, 20],
  bed: [92, 58, 36, 22],
  tub: [2, 64, 30, 19],
};

export function itemPreview(key) {
  const canvas = document.createElement('canvas');
  canvas.className = 'pet-item-art';
  const ctx = canvas.getContext('2d');
  if (key === 'food_pack') {
    canvas.width = 12;
    canvas.height = 8;
    drawSprite(ctx, BASKET, 0, 0, BASKET_COLORS);
  } else if (HATS[key]) {
    canvas.width = 13;
    canvas.height = 10;
    drawSprite(ctx, HATS[key].rows, 0, 0, HATS[key].colors);
    drawSprite(ctx, CAPYBARA_BODY.slice(0, 8), 0, 2, CAPYBARA_COLORS);
  } else {
    const [x, y, w, h] = PREVIEW_BOXES[key];
    const room = document.createElement('canvas');
    room.width = WIDTH;
    room.height = HEIGHT;
    const roomCtx = room.getContext('2d');
    drawWallAndFloor(roomCtx, false, false);
    FURNITURE[key](roomCtx);
    canvas.width = w;
    canvas.height = h;
    ctx.drawImage(room, x, y, w, h, 0, 0, w, h);
  }
  return canvas;
}

// Starts the room. Returns controls: stop(), update(state), play(kind),
// and hit(clientX, clientY) -> true if the capybara was tapped.
export function startRoom(canvas) {
  const ctx = canvas.getContext('2d');
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const backdrop = document.createElement('canvas');
  backdrop.width = WIDTH;
  backdrop.height = HEIGHT;

  let state = { items: new Set(), wearing: null, mood: 'happy', hunger: 100, thirst: 100, asleep: false, night: false, dusk: false };
  let act = { kind: 'idle', ticks: 0 };
  let hearts = [];
  let tick = 0;
  let x = 52;
  let direction = 1;
  let last = { bodyX: 52, bodyY: 46 };
  let attached = false;

  function paint() {
    ctx.drawImage(backdrop, 0, 0);
    drawBowl(ctx, 38, state.hunger, '#d99a3c');
    drawBowl(ctx, 78, state.thirst, '#5aa9e6');

    // Where the capybara is, and how it moves, depends on what it is doing.
    const inBed = state.asleep && act.kind === 'idle' && state.items.has('bed');
    const inTub = act.kind === 'bathe' && state.items.has('tub');
    let bodyX = Math.round(x);
    let bodyY = 46;
    let rows = CAPYBARA_BODY;
    if (state.asleep && act.kind === 'idle') rows = SLEEP_BODY;
    else if (state.mood === 'sad' && act.kind === 'idle') rows = SAD_BODY;
    const phase = act.ticks;

    if (inBed) {
      bodyX = 97;
      bodyY = 46;
    } else if (act.kind === 'feed') {
      bodyX = 31;
      bodyY += phase % 4 < 2 ? 2 : 0; // munching
    } else if (act.kind === 'water') {
      bodyX = 71;
      bodyY += phase % 6 < 3 ? 2 : 0;
    } else if (act.kind === 'play') {
      bodyY -= Math.round(Math.abs(Math.sin(phase / 2.2)) * 9);
    } else if (inTub) {
      bodyX = 4;
      bodyY = 50 + (phase % 6 < 3 ? 1 : 0);
    } else if (act.kind === 'pet') {
      bodyY -= phase % 4 < 2 ? 2 : 0;
    } else if (!state.asleep && state.mood !== 'sad' && !reduceMotion) {
      bodyY -= Math.round(Math.abs(Math.sin(tick / 6)) * 2); // a gentle bob
    }

    if (!inBed && !inTub) rect(ctx, 'rgba(0, 0, 0, 0.18)', bodyX + 2, 72, 22, 2);
    const hat = HATS[state.wearing];
    if (hat) drawScaled(ctx, hat.rows, bodyX, bodyY - 2 * SCALE, SCALE, hat.colors);
    drawScaled(ctx, rows, bodyX, bodyY, SCALE, CAPYBARA_COLORS);
    if (inBed) drawBlanket(ctx);
    if (inTub) drawTub(ctx);

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
    if (state.asleep && act.kind === 'idle') {
      for (let i = 0; i < 2; i += 1) {
        const age = ((tick + i * 14) % 28) / 28;
        ctx.globalAlpha = 1 - age;
        drawSprite(ctx, ['www', '.w.', 'www'], bodyX + 24 + i * 3 + Math.round(age * 4), Math.round(bodyY - 2 - age * 12), { w: '#ffffff' });
      }
      ctx.globalAlpha = 1;
    }
    for (const heart of hearts) {
      ctx.globalAlpha = Math.max(0, 1 - heart.age / 16);
      drawSprite(ctx, ['.r.r.', 'rrrrr', '.rrr.', '..r..'], heart.x, Math.round(heart.y - heart.age), { r: '#e2574c' });
    }
    ctx.globalAlpha = 1;

    if (state.night) {
      rect(ctx, 'rgba(14, 22, 66, 0.34)', 0, 0, WIDTH, HEIGHT);
      if (state.items.has('lamp')) {
        rect(ctx, 'rgba(255, 221, 130, 0.2)', 71, 24, 32, 40);
        rect(ctx, 'rgba(255, 233, 163, 0.5)', 81, 31, 12, 9);
      }
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
    hearts = hearts.filter((heart) => (heart.age += 1) < 16);
    if (act.kind !== 'idle') {
      act.ticks += 1;
      if (act.ticks > SCENE_TICKS) act = { kind: 'idle', ticks: 0 };
    } else if (!state.asleep && state.mood !== 'sad') {
      // Wander a little.
      x += direction * 0.25;
      if (x > 68) direction = -1;
      if (x < 38) direction = 1;
    }
    paint();
  }

  function rebuild() {
    drawBackdrop(backdrop.getContext('2d'), state.items, state.night, state.dusk);
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
    // Plays a short scene: 'feed', 'water', 'play', 'bathe', or 'pet'.
    play(kind) {
      act = { kind, ticks: 0 };
      if (kind === 'pet') hearts.push({ x: last.bodyX + 10, y: last.bodyY - 6, age: 0 });
      if (reduceMotion) paint();
    },
    hit(clientX, clientY) {
      const box = canvas.getBoundingClientRect();
      const px = ((clientX - box.left) / box.width) * WIDTH;
      const py = ((clientY - box.top) / box.height) * HEIGHT;
      return px >= last.bodyX - 3 && px <= last.bodyX + 29 && py >= last.bodyY - 8 && py <= last.bodyY + 30;
    },
  };
}
