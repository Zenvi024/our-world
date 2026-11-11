import { drawSprite } from './pixel.js';
import { LILY } from './sprites.js';

// The title-screen scene: an original blocky landscape drawn on a small
// canvas and scaled up with crisp pixels. A cozy cottage with a red roof and
// pale birch walls, cherry blossom trees behind it, lilies of the valley,
// drifting clouds and petals, chimney smoke, and capybaras out for a walk.

const BLOCK = 8;
const TICK_MS = 100;

const SKY = ['#63b0ea', '#74bcee', '#86c8f1', '#99d3f4', '#addef7', '#c2e8f9', '#d7f1fc'];
const GRASS = ['#6cc24a', '#5bb543', '#4fa63a', '#46952f'];
const DIRT = ['#9b6a42', '#8a5a37', '#7b4f30', '#6b4329'];
const STONE = ['#8f8f8f', '#858585', '#7a7a7a', '#6f6f6f'];
const BLOSSOM_LIGHT = ['#ffe3ee', '#ffd3e4', '#ffd3e4'];
const BLOSSOM = ['#f9b9d3', '#f7a8c9', '#f9b9d3', '#ffd3e4'];
const BLOSSOM_SHADE = ['#e884b0', '#d97aa8', '#c97aae'];
const BUSH = ['#3f8f2f', '#46952f', '#57a83c'];
const ROOF = ['#c8423a', '#b5372f'];
const PETAL = ['#ffd3e4', '#f7a8c9', '#ffffff'];
const BLOOMS = ['#ff8fb8', '#ffd83d', '#ffffff', '#f7a8c9'];

// The capybaras are modeled on the one at home: cream and round, with a
// brown snout, tiny ears, and something balanced on its head.
const CAPYBARA_COLORS = {
  C: '#f6e6a6', // cream coat
  c: '#e2cc80', // coat shade
  S: '#b08556', // snout
  N: '#7d5a36', // nose
  E: '#a37a4f', // ears
  P: '#d2b06e', // paws
  F: '#a37a4f', // feet
  k: '#2b2a26', // eyes
  O: '#f28c1e', // orange
  o: '#ffb648', // orange shine
  p: '#f7a8c9', // blossom
  w: '#ffe3ee', // blossom center
};

const CAPYBARA_BODY = [
  '.EE.CCCCC.EE.',
  '.EECCCCCCCEE.',
  '..CCCCCCCCC..',
  '.CCCCCCCCCCC.',
  '.CkCCSSSCCkC.',
  '.CCCSSSSSCCC.',
  '.CCCSSNSSCCC.',
  '.CCCCSSSCCCC.',
  '.CCCCCCCCCCC.',
  '.CCPCCCCCPCC.',
  '.cCCCCCCCCCc.',
  '..cCCCCCCCc..',
  '..FF.....FF..',
];
const CAPYBARA_HATS = [
  ['.....OoO.....', '.....OOO.....'], // an orange
  ['......p......', '.....pwp.....'], // a cherry blossom
];
const CAPYBARAS = CAPYBARA_HATS.map((hat) => [...hat, ...CAPYBARA_BODY]);
const CAPYBARA_WIDTH = CAPYBARA_BODY[0].length;
const CAPYBARA_HEIGHT = CAPYBARAS[0].length;
const HOP_TICKS = 7;
const flip = (rows) => rows.map((row) => [...row].reverse().join(''));
const LILY_FLIPPED = flip(LILY);

// A repeatable "random" number from 0 to 1 for any pixel, so the texture
// looks hand-placed but never changes between visits.
function noise(x, y, seed = 0) {
  let n = (x * 374761393 + y * 668265263 + seed * 1442695041) | 0;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  n ^= n >>> 16;
  return (n >>> 0) / 4294967296;
}

const pick = (colors, x, y, seed) => colors[Math.floor(noise(x, y, seed) * colors.length)];

function makeLayer(width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return [canvas, canvas.getContext('2d')];
}

function rect(ctx, color, x, y, w, h) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
}

function drawSky(ctx, width, height, horizon, wide) {
  const band = Math.ceil(horizon / SKY.length);
  SKY.forEach((color, i) => rect(ctx, color, 0, i * band, width, band));
  rect(ctx, SKY[SKY.length - 1], 0, SKY.length * band, width, height);

  // Square sun with a soft halo.
  // Beside the title on wide screens; below the Play button on phones.
  const sunX = Math.round(width * (wide ? 0.7 : 0.88)) - 6;
  const sunY = Math.round(horizon * (wide ? 0.2 : 0.62));
  rect(ctx, 'rgba(255, 246, 176, 0.35)', sunX - 2, sunY - 2, 15, 15);
  rect(ctx, '#ffe98a', sunX, sunY, 11, 11);
  rect(ctx, '#fff6c4', sunX + 1, sunY + 1, 9, 9);
}

function drawHills(ctx, width, height, horizon) {
  const ridges = [
    { color: '#a9d8bb', base: 13, a: 7, b: 4, fa: 31, fb: 13, shift: 0 },
    { color: '#8cc89b', base: 6, a: 5, b: 3, fa: 19, fb: 9, shift: 40 },
  ];
  for (const ridge of ridges) {
    for (let x = 0; x < width; x += 2) {
      const wave =
        ridge.base +
        ridge.a * Math.sin((x + ridge.shift) / ridge.fa) +
        ridge.b * Math.sin((x + ridge.shift) / ridge.fb + 2);
      const top = horizon - Math.round(wave / 2) * 2;
      rect(ctx, ridge.color, x, top, 2, height - top);
    }
  }
}

// Height of the ground, in whole blocks, for each column of blocks. The
// columns from flatFrom to flatTo are leveled to make a yard for the house.
function groundLevels(columns, baseRow, flatFrom, flatTo) {
  const levels = [];
  for (let col = 0; col < columns; col += 1) {
    const wave = 1.1 * Math.sin(col / 2.7 + 0.6) + 0.7 * Math.sin(col / 1.3 + 2.1);
    levels.push(baseRow - Math.round(wave));
  }
  for (let col = flatFrom; col <= flatTo; col += 1) {
    if (col >= 0 && col < columns) levels[col] = baseRow;
  }
  // Soften any cliff taller than one block next to the yard.
  for (let col = flatFrom - 1; col >= 0; col -= 1) {
    levels[col] = Math.max(levels[col + 1] - 1, Math.min(levels[col + 1] + 1, levels[col]));
  }
  for (let col = flatTo + 1; col < columns; col += 1) {
    levels[col] = Math.max(levels[col - 1] - 1, Math.min(levels[col - 1] + 1, levels[col]));
  }
  return levels;
}

function drawGround(ctx, width, height, levels) {
  levels.forEach((topRow, col) => {
    const x0 = col * BLOCK;
    const y0 = topRow * BLOCK;
    for (let y = y0; y < height; y += 1) {
      const depth = y - y0;
      for (let x = x0; x < x0 + BLOCK; x += 1) {
        let color;
        if (depth < 2) color = pick(GRASS, x, y, 1);
        else if (depth < 4 && noise(x, y, 2) < (depth === 2 ? 0.6 : 0.25)) color = pick(GRASS, x, y, 1);
        else if (depth < BLOCK * 5 + Math.floor(noise(x, 0, 3) * 4)) color = pick(DIRT, x, y, 4);
        else color = pick(STONE, x, y, 5);
        rect(ctx, color, x, y, 1, 1);
      }
    }
  });
  // Soft shadow where a taller column meets a shorter one.
  levels.forEach((topRow, col) => {
    const left = levels[col - 1];
    if (left !== undefined && left < topRow) {
      rect(ctx, 'rgba(0, 0, 0, 0.18)', col * BLOCK, left * BLOCK, 1, (topRow - left) * BLOCK);
    }
  });
}

const groundAt = (levels, x) =>
  levels[Math.max(0, Math.min(levels.length - 1, Math.floor(x / BLOCK)))] * BLOCK;

// Draws a thick line of pixels from one point to another.
function limb(ctx, x0, y0, x1, y1, thickness, seed) {
  const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
  for (let i = 0; i <= steps; i += 1) {
    const x = Math.round(x0 + ((x1 - x0) * i) / steps);
    const y = Math.round(y0 + ((y1 - y0) * i) / steps);
    for (let t = 0; t < thickness; t += 1) {
      const px = x - Math.floor(thickness / 2) + t;
      let color = '#8a6038';
      if (t === 0) color = '#5f3f26';
      else if (t === thickness - 1 && thickness > 2) color = '#b08a52';
      else if (noise(px, y, seed) < 0.3) color = '#a37a48';
      rect(ctx, color, px, y, 1, 1);
    }
  }
}

// One cloud of blossoms: a puffy dome with a flat, shaded underside.
function blossomPad(ctx, cx, cy, rx, ry) {
  for (let px = -rx; px <= rx; px += 1) {
    const dome = ry * Math.sqrt(1 - (px * px) / (rx * rx + 1));
    const top = -Math.round(dome + noise(cx + px, cy, 11) * 1.2);
    const bottom = 1 + (noise(cx + px, cy, 12) < 0.35 ? 1 : 0);
    for (let py = top; py <= bottom; py += 1) {
      let colors = BLOSSOM;
      if (py <= top + 1) colors = BLOSSOM_LIGHT;
      else if (py >= bottom - 1) colors = BLOSSOM_SHADE;
      rect(ctx, pick(colors, cx + px, cy + py, 13), cx + px, cy + py, 1, 1);
    }
  }
}

// A cherry blossom tree shaped like a bonsai: a thick, winding trunk with
// spreading roots, and separate clouds of blossoms at the ends of its branches.
function drawCherryTree(ctx, x, groundY, size = 1, mirror = false) {
  const m = mirror ? -1 : 1;
  const at = (dx, dy) => [x + Math.round(dx * size * m), groundY + Math.round(dy * size)];
  const line = (from, to, thickness) =>
    limb(ctx, ...at(...from), ...at(...to), Math.max(1, Math.round(thickness * size)), 23);

  // Roots, then the winding trunk.
  line([-5, 0], [-1, -4], 2);
  line([5, 0], [1, -4], 2);
  line([0, 0], [-1, -5], 6);
  line([-1, -5], [-3, -10], 5);
  line([-3, -10], [0, -15], 4);
  line([0, -15], [3, -20], 3);
  line([3, -20], [1, -26], 2);
  line([1, -26], [2, -31], 2);
  // Branches.
  line([-3, -10], [-12, -13], 2);
  line([0, -15], [-8, -20], 2);
  line([3, -20], [13, -18], 2);
  line([3, -20], [10, -25], 1);
  line([1, -26], [-5, -29], 1);

  const pads = [
    [-13, -14, 9, 4],
    [-9, -21, 7, 3],
    [14, -19, 9, 4],
    [10, -26, 6, 3],
    [-5, -30, 6, 3],
    [3, -33, 7, 3],
    [1, -17, 5, 2],
  ];
  for (const [dx, dy, rx, ry] of pads) {
    const [cx, cy] = at(dx, dy);
    blossomPad(ctx, cx, cy, Math.round(rx * size), Math.max(2, Math.round(ry * size)));
  }
}

// Far-off ranges of tall, snow-capped peaks, faded into the sky.
function drawRange(ctx, width, horizon, range) {
  const peaks = [];
  for (let i = -1; i * range.spacing < width + range.spacing; i += 1) {
    peaks.push({
      center: i * range.spacing + noise(i, 1, range.seed) * range.spacing * 0.6,
      tall: range.tall * (0.7 + noise(i, 2, range.seed) * 0.5),
      slope: 1.15 + noise(i, 3, range.seed) * 0.5,
    });
  }
  for (let x = 0; x < width; x += 1) {
    let rise = 0;
    let owner = null;
    for (const peak of peaks) {
      const here = peak.tall - Math.abs(x - peak.center) * peak.slope;
      if (here > rise) {
        rise = here;
        owner = peak;
      }
    }
    if (!owner) continue;
    rise = Math.round(rise + noise(Math.floor(x / 3), 3, range.seed) * 3);
    const top = horizon - rise;
    const sunny = x < owner.center; // the left faces catch the light
    rect(ctx, sunny ? range.rock : range.shade, x, top, 1, rise);
    // Snow caps the top third of each peak, with a ragged lower edge.
    const snow = rise - owner.tall * 0.62 - (x % 5 < 2 ? 2 : 0) - noise(x, 9, range.seed) * 3;
    if (snow > 0) rect(ctx, sunny ? '#fbfdff' : '#dde8f3', x, top, 1, Math.round(snow));
  }
}

function drawMountains(ctx, width, horizon) {
  // Tall on phones, a little lower on wide screens so the title stays clear.
  const tall = Math.min(62, horizon * 0.5);
  drawRange(ctx, width, horizon, { seed: 60, spacing: tall * 0.95, tall, rock: '#c5d5e6', shade: '#b6c8dc' });
  drawRange(ctx, width, horizon, { seed: 70, spacing: tall * 0.7, tall: tall * 0.7, rock: '#a9bcd1', shade: '#93a9c2' });
}

function drawBush(ctx, x, groundY, w) {
  for (let py = 0; py < 5; py += 1) {
    const inset = py === 0 ? 2 : py === 1 ? 1 : 0;
    for (let px = inset; px < w - inset; px += 1) {
      rect(ctx, pick(BUSH, x + px, groundY - 5 + py, 14), x + px, groundY - 5 + py, 1, 1);
    }
  }
  for (let px = 1; px < w - 1; px += 2) {
    if (noise(x + px, groundY, 15) < 0.6) {
      rect(ctx, pick(BLOOMS, x + px, groundY, 16), x + px, groundY - 4 + (px % 3), 1, 1);
    }
  }
}

// The cottage. (x, groundY) is the bottom-left corner of its walls.
// Returns where the chimney smoke should start.
function drawHouse(ctx, x, groundY) {
  const w = 36;
  const wallH = 16;
  const top = groundY - wallH;

  // Birch-plank walls: pale boards with soft seams and a few dark flecks.
  for (let py = 0; py < wallH; py += 1) {
    for (let px = 0; px < w; px += 1) {
      let color = py % 4 === 3 ? '#d8ccb0' : '#f1e9d4';
      if (py % 4 !== 3 && noise(x + px, top + py, 20) < 0.03) color = '#8f8672';
      rect(ctx, color, x + px, top + py, 1, 1);
    }
  }
  // Birch-log corner posts.
  for (const postX of [x, x + w - 2]) {
    for (let py = 0; py < wallH; py += 1) {
      const dark = noise(postX, top + py, 21) < 0.22;
      rect(ctx, '#fbf7ec', postX, top + py, 2, 1);
      if (dark) rect(ctx, '#4a4338', postX + (py % 2), top + py, 1, 1);
    }
  }
  // Stone footing.
  rect(ctx, '#9a9a9a', x, groundY - 1, w, 1);

  // Chimney (drawn first so the roof overlaps its base).
  const chimneyX = x + 25;
  const chimneyTop = top - 13;
  for (let py = 0; py < 9; py += 1) {
    for (let px = 0; px < 4; px += 1) {
      rect(ctx, (px + py) % 2 ? '#9a5b4a' : '#86493b', chimneyX + px, chimneyTop + py, 1, 1);
    }
  }
  rect(ctx, '#6b3a2f', chimneyX - 1, chimneyTop, 6, 1);

  // Red gable roof, stepped like stairs, with a lighter ridge on each step.
  const roofH = 12;
  for (let i = 0; i < roofH; i += 1) {
    const half = 21 - Math.round(i * 1.6);
    const y = top - 1 - i;
    const cx = x + w / 2;
    rect(ctx, ROOF[i % 2], cx - half, y, half * 2, 1);
    rect(ctx, '#e0685c', cx - half, y, 1, 1);
    rect(ctx, '#e0685c', cx + half - 1, y, 1, 1);
  }
  rect(ctx, '#8f2a25', x - 3, top, w + 6, 1);
  // Round attic window glowing under the ridge.
  rect(ctx, '#5a3a22', x + 16, top - 8, 4, 4);
  rect(ctx, '#ffe9a3', x + 17, top - 7, 2, 2);

  // Door with a little step and a knob.
  const doorX = x + 15;
  rect(ctx, '#5a3a22', doorX - 1, groundY - 11, 8, 11);
  rect(ctx, '#9b6a42', doorX, groundY - 10, 6, 10);
  rect(ctx, '#8a5a37', doorX + 3, groundY - 10, 1, 10);
  rect(ctx, '#ffd83d', doorX + 4, groundY - 5, 1, 1);
  rect(ctx, '#b9b9b9', doorX - 2, groundY - 1, 10, 1);

  // Two warm windows with flower boxes.
  for (const winX of [x + 4, x + 25]) {
    rect(ctx, '#5a3a22', winX, groundY - 12, 7, 7);
    rect(ctx, '#ffe9a3', winX + 1, groundY - 11, 5, 5);
    rect(ctx, '#fff6c4', winX + 1, groundY - 11, 2, 2);
    rect(ctx, '#5a3a22', winX + 3, groundY - 11, 1, 5);
    rect(ctx, '#5a3a22', winX + 1, groundY - 9, 5, 1);
    rect(ctx, '#7b4f30', winX - 1, groundY - 5, 9, 2);
    for (let px = 0; px < 9; px += 1) {
      const bloom = px % 2 === 0;
      rect(ctx, bloom ? pick(BLOOMS, winX + px, groundY, 22) : '#46952f', winX - 1 + px, groundY - 6, 1, 1);
    }
  }
  // Stepping stones leading from the door.
  for (let i = 0; i < 3; i += 1) {
    rect(ctx, i % 2 ? '#b9b9b9' : '#a3a3a3', doorX + 1 + i, groundY + i, 4, 1);
  }

  return { x: chimneyX + 1, y: chimneyTop - 1 };
}

function drawTufts(ctx, width, levels, houseX) {
  for (let x = 1; x < width - 1; x += 1) {
    if (x >= houseX - 1 && x <= houseX + 36) continue; // not in front of the house
    const roll = noise(x, 7, 8);
    const y = groundAt(levels, x);
    if (roll < 0.16) {
      rect(ctx, noise(x, 3, 9) < 0.5 ? '#5bb543' : '#46952f', x, y - 1 - Math.floor(noise(x, 5, 10) * 2), 1, 3);
    } else if (roll > 0.94) {
      // A tiny wildflower: a stem with a colored dot.
      rect(ctx, '#46952f', x, y - 2, 1, 2);
      rect(ctx, pick(BLOOMS, x, 1, 17), x, y - 3, 1, 1);
    }
  }
}

// Lilies stand on single blocks and lean toward whichever side is open air,
// so a flower never pokes into a taller neighbor. They keep clear of the house.
function drawLilies(ctx, width, levels, keepOut) {
  const spots = [0.06, 0.2, 0.34, 0.5, 0.66, 0.8, 0.94];
  const used = new Set();
  for (const spot of spots) {
    const wanted = Math.round((width * spot) / BLOCK);
    for (const offset of [0, 1, -1, 2, -2]) {
      const col = wanted + offset;
      if (col < 1 || col > levels.length - 2 || used.has(col)) continue;
      if (col >= keepOut.from && col <= keepOut.to) continue;
      const rightOpen = levels[col + 1] >= levels[col];
      const leftOpen = levels[col - 1] >= levels[col];
      if (!rightOpen && !leftOpen) continue;
      used.add(col).add(col - 1).add(col + 1);
      const y = levels[col] * BLOCK - 15;
      // The stem sits at x = 5 in the sprite (x = 10 when flipped).
      if (rightOpen) drawSprite(ctx, LILY, col * BLOCK - 1, y);
      else drawSprite(ctx, LILY_FLIPPED, col * BLOCK - 7, y);
      break;
    }
  }
}

// Clouds keep to the open sky between the title and the ground.
const CLOUDS = [
  { x: 0.05, y: 0.04, w: 22, speed: 0.7 },
  { x: 0.55, y: 0.6, w: 20, speed: 0.6 },
  { x: 0.85, y: 0.72, w: 28, speed: 0.8 },
  { x: 0.3, y: 0.84, w: 16, speed: 0.5 },
];

function drawClouds(ctx, width, horizon, seconds) {
  const span = width + 60;
  for (const cloud of CLOUDS) {
    const travelled = cloud.x * span + seconds * cloud.speed * 1.2;
    const x = Math.round((travelled % span) - 30);
    const y = Math.round(horizon * cloud.y);
    rect(ctx, '#ffffff', x, y, cloud.w, 5);
    rect(ctx, '#ffffff', x + 4, y - 3, Math.round(cloud.w * 0.55), 3);
    rect(ctx, '#e4eef5', x, y + 5, cloud.w, 1);
  }
}

function drawSmoke(ctx, origin, seconds) {
  for (let i = 0; i < 3; i += 1) {
    const age = (seconds / 4 + i / 3) % 1;
    const x = Math.round(origin.x + Math.sin(age * 5 + i) * 2 + age * 4);
    const y = Math.round(origin.y - age * 16);
    const size = age < 0.4 ? 2 : 3;
    rect(ctx, `rgba(255, 255, 255, ${(0.75 * (1 - age)).toFixed(2)})`, x, y, size, size);
  }
}

function drawPetals(ctx, width, horizon, seconds) {
  for (let i = 0; i < 12; i += 1) {
    const fall = 5 + noise(i, 1, 30) * 4;
    const y = (noise(i, 2, 31) * horizon + seconds * fall) % (horizon + 6);
    const x =
      (noise(i, 3, 32) * width + seconds * 2 + Math.sin(seconds * 1.3 + i * 2) * 3) % (width + 4);
    rect(ctx, PETAL[i % PETAL.length], Math.round(x), Math.round(y), 1, 1);
  }
}

// Capybaras face you and get around in little hops, resting in between.
function createCapybaras(width) {
  return [0.16, 0.74].map((spot, i) => ({
    x: width * spot,
    direction: i % 2 ? -1 : 1,
    resting: 4 + i * 9,
    hop: 0,
    seed: i + 1,
    sprite: CAPYBARAS[i % CAPYBARAS.length],
  }));
}

function moveCapybaras(herd, width, tick) {
  for (const capybara of herd) {
    if (capybara.resting > 0) {
      capybara.resting -= 1;
      continue;
    }
    capybara.hop += 1;
    capybara.x += capybara.direction * 0.7;
    if (capybara.x < 2) capybara.direction = 1;
    if (capybara.x > width - CAPYBARA_WIDTH - 2) capybara.direction = -1;
    if (capybara.hop >= HOP_TICKS) {
      // Landed: take a breath, sometimes a long one, sometimes turn around.
      capybara.hop = 0;
      const roll = noise(tick, capybara.seed, 40);
      capybara.resting = roll < 0.2 ? 25 + Math.floor(roll * 150) : 3;
      if (noise(tick, capybara.seed, 41) > 0.9) capybara.direction *= -1;
    }
  }
}

function drawCapybaras(ctx, herd, levels) {
  for (const capybara of herd) {
    const x = Math.round(capybara.x);
    const lift = Math.round(Math.sin((Math.PI * capybara.hop) / HOP_TICKS) * 4);
    const y = groundAt(levels, x + CAPYBARA_WIDTH / 2) - CAPYBARA_HEIGHT - lift;
    drawSprite(ctx, capybara.sprite, x, y, CAPYBARA_COLORS);
  }
}

// Draws the scene into the canvas and keeps it gently alive.
// Returns a function that stops everything.
export function startLandscape(canvas) {
  const ctx = canvas.getContext('2d');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let sky;
  let front;
  let levels = [];
  let herd = [];
  let chimney = { x: 0, y: 0 };
  let horizon = 0;
  let tick = 0;
  let timer = null;

  function paint() {
    const seconds = (tick * TICK_MS) / 1000;
    ctx.drawImage(sky, 0, 0);
    drawClouds(ctx, canvas.width, horizon, seconds);
    ctx.drawImage(front, 0, 0);
    drawSmoke(ctx, chimney, seconds);
    drawCapybaras(ctx, herd, levels);
    drawPetals(ctx, canvas.width, horizon, seconds);
  }

  function build() {
    const box = canvas.parentElement.getBoundingClientRect();
    if (!box.width || !box.height) return;
    const scale = Math.max(3, Math.round(Math.min(box.width, box.height) / 120));
    const width = Math.ceil(box.width / scale);
    const height = Math.ceil(box.height / scale);
    canvas.width = width;
    canvas.height = height;
    canvas.style.width = `${width * scale}px`;
    canvas.style.height = `${height * scale}px`;

    // On wide screens the house sits to the left of the Play button;
    // on phones it sits in the middle, below it.
    const wide = width > height * 1.1;
    const houseX = Math.round(width * (wide ? 0.27 : 0.5)) - 18;
    const yard = {
      from: Math.floor((houseX - 6) / BLOCK),
      to: Math.floor((houseX + 36 + 5) / BLOCK),
    };
    const baseRow = Math.round((height * (wide ? 0.74 : 0.78)) / BLOCK);
    levels = groundLevels(Math.ceil(width / BLOCK), baseRow, yard.from, yard.to);
    horizon = baseRow * BLOCK;
    const yardY = baseRow * BLOCK;

    let skyCtx;
    let frontCtx;
    [sky, skyCtx] = makeLayer(width, height);
    [front, frontCtx] = makeLayer(width, height);
    drawSky(skyCtx, width, height, horizon, wide);
    drawMountains(frontCtx, width, horizon);
    drawHills(frontCtx, width, height, horizon);

    // Cherry blossom trees stand behind the house, so they are drawn first.
    drawCherryTree(frontCtx, houseX - 7, groundAt(levels, houseX - 7), 1.15);
    drawCherryTree(frontCtx, houseX + 43, groundAt(levels, houseX + 43), 0.95, true);
    if (wide) {
      drawCherryTree(frontCtx, Math.round(width * 0.82), groundAt(levels, width * 0.82), 1.1);
    }

    drawGround(frontCtx, width, height, levels);
    chimney = drawHouse(frontCtx, houseX, yardY);
    drawBush(frontCtx, houseX - 5, yardY, 7);
    drawBush(frontCtx, houseX + 35, yardY, 6);
    drawTufts(frontCtx, width, levels, houseX);
    drawLilies(frontCtx, width, levels, yard);

    herd = createCapybaras(width);
    paint();
  }

  build();
  window.addEventListener('resize', build);
  if (!reduceMotion) {
    timer = setInterval(() => {
      tick += 1;
      moveCapybaras(herd, canvas.width, tick);
      paint();
    }, TICK_MS);
  }

  return () => {
    window.removeEventListener('resize', build);
    if (timer) clearInterval(timer);
  };
}
