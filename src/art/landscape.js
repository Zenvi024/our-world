import { CAPYBARA_BODY, BABY_BODY, drawCapybara, hatRise } from './outfits.js';
import { drawSprite } from './pixel.js';
import { LILY } from './sprites.js';

// The title-screen scene: an original blocky landscape drawn on a small
// canvas and scaled up with crisp pixels. A cozy cottage with a red roof and
// pale birch walls, cherry blossom trees behind it, lilies of the valley,
// drifting clouds and petals, chimney smoke, and capybaras out for a walk.

const BLOCK = 8;
const TICK_MS = 100;

const SKY = ['#63b0ea', '#74bcee', '#86c8f1', '#99d3f4', '#addef7', '#c2e8f9', '#d7f1fc'];
const DIRT = ['#9b6a42', '#8a5a37', '#7b4f30', '#6b4329'];
const STONE = ['#8f8f8f', '#858585', '#7a7a7a', '#6f6f6f'];
const ROOF = ['#c8423a', '#b5372f'];

// The four seasons. Each is a set of colors for the grass, the trees, the
// bushes and flowers, the far hills, and whatever drifts through the air.
export const SEASONS = ['spring', 'summer', 'autumn', 'winter'];
const LOOKS = {
  spring: {
    grass: ['#6cc24a', '#5bb543', '#4fa63a', '#46952f'],
    leafLight: ['#ffe3ee', '#ffd3e4', '#ffd3e4'],
    leaf: ['#f9b9d3', '#f7a8c9', '#f9b9d3', '#ffd3e4'],
    leafShade: ['#e884b0', '#d97aa8', '#c97aae'],
    bush: ['#3f8f2f', '#46952f', '#57a83c'],
    blooms: ['#ff8fb8', '#ffd83d', '#ffffff', '#f7a8c9'],
    hills: ['#a9d8bb', '#8cc89b'],
    drift: { kind: 'petals', colors: ['#ffd3e4', '#f7a8c9', '#ffffff'], count: 12 },
    flowers: true,
  },
  summer: {
    grass: ['#7ad04e', '#63c043', '#52ad38', '#46952f'],
    leafLight: ['#b5e68a', '#9fdb6e', '#a8e07a'],
    leaf: ['#63b84a', '#57a83c', '#6cc24a', '#7acb58'],
    leafShade: ['#2f7a2a', '#35802d', '#2a6b25'],
    bush: ['#35802d', '#3f8f2f', '#4fa63a'],
    blooms: ['#ffd83d', '#ffffff', '#ff8fb8', '#f28c1e'],
    hills: ['#9fd68f', '#79c06e'],
    drift: { kind: 'none' },
    flowers: true,
  },
  autumn: {
    grass: ['#b9b04a', '#a8a03f', '#9a8f38', '#8a7f33'],
    leafLight: ['#ffd27a', '#ffc04d', '#ffcf66'],
    leaf: ['#f28c1e', '#e8792a', '#f5a033', '#d9541e'],
    leafShade: ['#b5451b', '#a03a18', '#8f3a1c'],
    bush: ['#8a7f33', '#a8702c', '#b5832f'],
    blooms: ['#f28c1e', '#ffd83d', '#d9541e', '#ffffff'],
    hills: ['#e0c98a', '#cfae6a'],
    drift: { kind: 'leaves', colors: ['#f28c1e', '#d9541e', '#ffc04d', '#b5451b'], count: 14 },
    flowers: false,
  },
  winter: {
    grass: ['#ffffff', '#f1f6fb', '#e3edf6', '#d5e3ef'],
    leafLight: ['#ffffff', '#f6fbff', '#ffffff'],
    leaf: ['#eef5fb', '#e3edf6', '#f6fbff', '#dbe7f2'],
    leafShade: ['#c3d3e3', '#b6c8dc', '#cbd9e8'],
    bush: ['#2f6b3a', '#35764a', '#3f8553'],
    blooms: ['#d63a30', '#ffffff', '#d63a30', '#e2574c'],
    hills: ['#e6eef6', '#d3e0ec'],
    drift: { kind: 'snow', colors: ['#ffffff', '#f1f6fb', '#ffffff'], count: 42 },
    flowers: true, // red berries on the bushes
    snow: true,
  },
};
// The season in use. (There is only ever one scene on screen.)
let look = LOOKS.spring;

// The capybaras are modeled on the one at home: cream and round, with a
// brown snout, tiny ears, and something balanced on its head. Their sprites
// and outfits live in outfits.js; the third, smaller one is Happybara.
const DEFAULT_CAST = [{ hat: 'hat_orange' }, { hat: 'hat_blossom' }, { baby: true }];
const CAST_SPOTS = [0.16, 0.74, 0.46];
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

// The sky follows the clock in Manila: dawn, day, dusk, and night.
const SKIES = {
  day: SKY,
  dawn: ['#f4a3b5', '#f8b4ad', '#fbc6a6', '#fdd6a5', '#fee4b3', '#ffefc8', '#fff6dc'],
  dusk: ['#55488a', '#77589a', '#a3689c', '#cc7c8f', '#ec977b', '#f6b672', '#fbd48d'],
  night: ['#0b1030', '#0f1740', '#141f50', '#1a2860', '#21326f', '#293c7d', '#32478a'],
};
// A wash of color over the land, so it sits in the same light as the sky.
const LAND_TINT = {
  day: null,
  dawn: 'rgba(255, 190, 150, 0.14)',
  dusk: 'rgba(110, 60, 110, 0.26)',
  night: 'rgba(14, 22, 66, 0.52)',
};

function skyPhase() {
  // Night mode turns the scene to night whatever the hour.
  if (document.documentElement.dataset.theme === 'night') return 'night';
  const hour =
    Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Manila', hour: 'numeric', hour12: false }).format(new Date())) % 24;
  if (hour >= 19 || hour < 5) return 'night';
  if (hour < 7) return 'dawn';
  if (hour < 17) return 'day';
  return 'dusk';
}

function drawSky(ctx, width, height, horizon, wide, phase) {
  const colors = SKIES[phase];
  const band = Math.ceil(horizon / colors.length);
  colors.forEach((color, i) => rect(ctx, color, 0, i * band, width, band));
  rect(ctx, colors[colors.length - 1], 0, colors.length * band, width, height);

  if (phase === 'night') {
    // Stars, scattered the same way every night.
    for (let i = 0; i < Math.round(width * 0.5); i += 1) {
      const x = Math.floor(noise(i, 1, 80) * width);
      const y = Math.floor(noise(i, 2, 81) * horizon * 0.85);
      rect(ctx, noise(i, 3, 82) < 0.25 ? '#ffffff' : '#b9c6f2', x, y, 1, 1);
    }
  }

  // A square sun by day, a square moon by night.
  // Beside the title on wide screens; below the Play button on phones.
  const low = phase === 'dawn' || phase === 'dusk';
  const x = Math.round(width * (wide ? 0.7 : 0.88)) - 6;
  const y = Math.round(horizon * (wide ? (low ? 0.6 : 0.2) : low ? 0.8 : 0.62));
  if (phase === 'night') {
    rect(ctx, 'rgba(210, 222, 255, 0.2)', x - 2, y - 2, 15, 15);
    rect(ctx, '#dfe6ff', x, y, 11, 11);
    rect(ctx, '#f6f8ff', x + 1, y + 1, 9, 9);
    rect(ctx, '#c9d3f5', x + 6, y + 3, 3, 3);
    rect(ctx, '#c9d3f5', x + 2, y + 6, 2, 2);
  } else {
    rect(ctx, low ? 'rgba(255, 190, 120, 0.4)' : 'rgba(255, 246, 176, 0.35)', x - 2, y - 2, 15, 15);
    rect(ctx, low ? '#ffb85c' : '#ffe98a', x, y, 11, 11);
    rect(ctx, low ? '#ffd58a' : '#fff6c4', x + 1, y + 1, 9, 9);
  }
}

// After dark the windows glow again, on top of the evening tint.
function lightWindows(ctx, x, groundY) {
  for (const winX of [x + 4, x + 25]) {
    rect(ctx, 'rgba(255, 233, 163, 0.22)', winX - 1, groundY - 13, 9, 9);
    rect(ctx, '#ffe9a3', winX + 1, groundY - 11, 5, 5);
    rect(ctx, '#5a3a22', winX + 3, groundY - 11, 1, 5);
    rect(ctx, '#5a3a22', winX + 1, groundY - 9, 5, 1);
  }
  rect(ctx, '#ffe9a3', x + 17, groundY - 23, 2, 2);
}

// The campfire: two crossed logs and a ring of stones. The flames are drawn
// live, and only when the fire is lit.
function drawCampfireLogs(ctx, x, y) {
  rect(ctx, '#8f8f8f', x - 5, y - 1, 2, 1);
  rect(ctx, '#7a7a7a', x + 4, y - 1, 2, 1);
  rect(ctx, '#6b4329', x - 3, y - 2, 7, 2);
  rect(ctx, '#8a5a37', x - 2, y - 3, 5, 1);
  rect(ctx, '#3a2718', x - 1, y - 2, 1, 1);
  rect(ctx, '#3a2718', x + 2, y - 2, 1, 1);
}

function drawFlames(ctx, x, y, tick, roaring) {
  const tall = roaring ? 9 : 6;
  rect(ctx, roaring ? 'rgba(255, 170, 70, 0.22)' : 'rgba(255, 170, 70, 0.14)', x - 7, y - tall - 5, 15, tall + 6);
  for (let dx = -2; dx <= 2; dx += 1) {
    const reach = tall - Math.abs(dx) * 2 + Math.floor(noise(dx, tick, 60) * 3);
    for (let dy = 0; dy < reach; dy += 1) {
      const color = dy < reach * 0.35 ? '#fff6c4' : dy < reach * 0.7 ? '#ffd83d' : '#f28c1e';
      rect(ctx, color, x + dx, y - 3 - dy, 1, 1);
    }
  }
  if (roaring) {
    for (let i = 0; i < 3; i += 1) {
      const age = ((tick + i * 7) % 20) / 20;
      rect(ctx, '#ffd83d', x + Math.round(Math.sin(age * 6 + i) * 3), Math.round(y - tall - 2 - age * 10), 1, 1);
    }
  }
}

const MINI_HEART = ['.r.r.', 'rrrrr', '.rrr.', '..r..'];
const ZED = ['www', '.w.', 'www'];

function drawHills(ctx, width, height, horizon) {
  const ridges = [
    { color: look.hills[0], base: 13, a: 7, b: 4, fa: 31, fb: 13, shift: 0 },
    { color: look.hills[1], base: 6, a: 5, b: 3, fa: 19, fb: 9, shift: 40 },
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
        if (depth < 2) color = pick(look.grass, x, y, 1);
        else if (depth < 4 && noise(x, y, 2) < (depth === 2 ? 0.6 : 0.25)) color = pick(look.grass, x, y, 1);
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
      let colors = look.leaf;
      if (py <= top + 1) colors = look.leafLight;
      else if (py >= bottom - 1) colors = look.leafShade;
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
      rect(ctx, pick(look.bush, x + px, groundY - 5 + py, 14), x + px, groundY - 5 + py, 1, 1);
    }
  }
  if (look.snow) rect(ctx, '#ffffff', x + 2, groundY - 5, w - 4, 1);
  for (let px = 1; look.flowers && px < w - 1; px += 2) {
    if (noise(x + px, groundY, 15) < 0.6) {
      rect(ctx, pick(look.blooms, x + px, groundY, 16), x + px, groundY - 4 + (px % 3), 1, 1);
    }
  }
}

// The cottage. (x, groundY) is the bottom-left corner of its walls.
// Returns where the chimney smoke should start.
function drawHouse(ctx, x, groundY, lightsOut) {
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
  if (look.snow) {
    // Snow settles on the ridge, the eaves, and the chimney.
    for (let i = 0; i < roofH; i += 1) {
      const half = 21 - Math.round(i * 1.6);
      const y = top - 1 - i;
      const cx = x + w / 2;
      if (i >= roofH - 3) rect(ctx, '#ffffff', cx - half, y, half * 2, 1);
      else {
        rect(ctx, '#ffffff', cx - half, y, 3 + (i % 2), 1);
        rect(ctx, '#ffffff', cx + half - 3 - (i % 2), y, 3 + (i % 2), 1);
      }
    }
    rect(ctx, '#ffffff', chimneyX - 1, chimneyTop - 1, 6, 1);
  }
  // Round attic window glowing under the ridge.
  rect(ctx, '#5a3a22', x + 16, top - 8, 4, 4);
  rect(ctx, lightsOut ? '#27304f' : '#ffe9a3', x + 17, top - 7, 2, 2);

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
    rect(ctx, lightsOut ? '#27304f' : '#ffe9a3', winX + 1, groundY - 11, 5, 5);
    rect(ctx, lightsOut ? '#34406a' : '#fff6c4', winX + 1, groundY - 11, 2, 2);
    rect(ctx, '#5a3a22', winX + 3, groundY - 11, 1, 5);
    rect(ctx, '#5a3a22', winX + 1, groundY - 9, 5, 1);
    rect(ctx, '#7b4f30', winX - 1, groundY - 5, 9, 2);
    for (let px = 0; px < 9; px += 1) {
      const bloom = px % 2 === 0;
      rect(ctx, bloom ? pick(look.blooms, winX + px, groundY, 22) : '#46952f', winX - 1 + px, groundY - 6, 1, 1);
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
      rect(ctx, noise(x, 3, 9) < 0.5 ? look.grass[1] : look.grass[3], x, y - 1 - Math.floor(noise(x, 5, 10) * 2), 1, 3);
    } else if (roll > 0.94 && look.flowers && !look.snow) {
      // A tiny wildflower: a stem with a colored dot.
      rect(ctx, '#46952f', x, y - 2, 1, 2);
      rect(ctx, pick(look.blooms, x, 1, 17), x, y - 3, 1, 1);
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

function drawClouds(ctx, width, horizon, seconds, phase) {
  ctx.globalAlpha = phase === 'night' ? 0.16 : phase === 'day' ? 1 : 0.7;
  const span = width + 60;
  for (const cloud of CLOUDS) {
    const travelled = cloud.x * span + seconds * cloud.speed * 1.2;
    const x = Math.round((travelled % span) - 30);
    const y = Math.round(horizon * cloud.y);
    rect(ctx, '#ffffff', x, y, cloud.w, 5);
    rect(ctx, '#ffffff', x + 4, y - 3, Math.round(cloud.w * 0.55), 3);
    rect(ctx, '#e4eef5', x, y + 5, cloud.w, 1);
  }
  ctx.globalAlpha = 1;
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

// Whatever the season sends drifting down: petals, leaves, or snow.
function drawDrift(ctx, width, horizon, seconds) {
  const drift = look.drift;
  if (drift.kind === 'none') return;
  const snow = drift.kind === 'snow';
  const leaves = drift.kind === 'leaves';
  for (let i = 0; i < drift.count; i += 1) {
    const fall = (snow ? 4 : 5) + noise(i, 1, 30) * (leaves ? 6 : 4);
    const y = (noise(i, 2, 31) * horizon + seconds * fall) % (horizon + 6);
    const sway = leaves ? 6 : 3;
    const x = (noise(i, 3, 32) * width + seconds * (snow ? 1 : 2) + Math.sin(seconds * 1.3 + i * 2) * sway + width) % (width + 4);
    rect(ctx, drift.colors[i % drift.colors.length], Math.round(x), Math.round(y), leaves && i % 3 === 0 ? 2 : 1, 1);
  }
}

// The weather changes every three hours and is the same for both of you:
// mostly clear, sometimes rain (snow in winter), now and then a rainbow.
function weatherNow() {
  const manila = new Date(Date.now() + 8 * 3_600_000);
  const block = Math.floor(manila.getTime() / (3 * 3_600_000));
  const roll = noise(block, 7, 90);
  if (roll < 0.14) return 'rain';
  if (roll < 0.22) return 'rainbow';
  return 'clear';
}

function drawRainbow(ctx, width, horizon) {
  const bands = ['#ff6b6b', '#ffa94d', '#ffe066', '#8ce99a', '#74c0fc', '#b197fc'];
  const cx = Math.round(width * 0.36);
  const radius = Math.round(Math.min(width * 0.62, horizon * 0.52));
  ctx.globalAlpha = 0.5;
  bands.forEach((color, i) => {
    const r = radius - i * 2;
    for (let x = cx - r; x <= cx + r; x += 1) {
      const y = Math.round(horizon - Math.sqrt(Math.max(0, r * r - (x - cx) * (x - cx))));
      rect(ctx, color, x, y, 1, 2);
    }
  });
  ctx.globalAlpha = 1;
}

function drawRain(ctx, width, height, seconds) {
  for (let i = 0; i < 46; i += 1) {
    const x = (noise(i, 1, 95) * (width + 20) + seconds * 22) % (width + 20) - 10;
    const y = (noise(i, 2, 96) * height + seconds * (110 + noise(i, 3, 97) * 50)) % height;
    rect(ctx, 'rgba(200, 222, 245, 0.75)', Math.round(x), Math.round(y), 1, 3);
  }
}

// Butterflies by day in the warm seasons.
function drawButterflies(ctx, width, horizon, seconds) {
  const colors = ['#fff3a6', '#ffffff', '#ffb3d1'];
  for (let i = 0; i < 3; i += 1) {
    const x = Math.round(((noise(i, 1, 100) * width + seconds * (2 + i)) % (width + 10)) - 5 + Math.sin(seconds * 0.9 + i * 2) * 6);
    const y = Math.round(horizon - 10 - noise(i, 2, 101) * 22 - Math.abs(Math.sin(seconds * 1.4 + i)) * 7);
    const open = Math.floor(seconds * 6 + i) % 2 === 0;
    rect(ctx, colors[i], x - (open ? 1 : 0), y, open ? 3 : 1, 1);
    rect(ctx, '#5a3a22', x, y + (open ? 0 : 1), 1, 1);
  }
}

// Now and then two birds cross the sky.
function drawBirds(ctx, width, horizon, seconds) {
  const lap = 47;
  const t = (seconds % lap) / 9;
  if (t >= 1) return;
  const flap = Math.floor(seconds * 4) % 2;
  for (let i = 0; i < 2; i += 1) {
    const x = Math.round(t * (width + 30) - 12 - i * 7);
    const y = Math.round(horizon * (0.22 + noise(Math.floor(seconds / lap), i, 105) * 0.2) + Math.sin(seconds * 2 + i) * 2 + i * 3);
    rect(ctx, '#3b3f55', x, y + flap, 1, 1);
    rect(ctx, '#3b3f55', x + 1, y + 1 - flap, 1, 1);
    rect(ctx, '#3b3f55', x + 2, y + flap, 1, 1);
  }
}

// Fireflies come out at dusk and stay through the night.
function drawFireflies(ctx, width, horizon, seconds) {
  for (let i = 0; i < 9; i += 1) {
    const x = Math.round(noise(i, 1, 110) * width + Math.sin(seconds * 0.5 + i * 1.7) * 7);
    const y = Math.round(horizon - 4 - noise(i, 2, 111) * 30 + Math.cos(seconds * 0.6 + i) * 4);
    const glow = (Math.sin(seconds * 2.2 + i * 2.4) + 1) / 2;
    if (glow < 0.25) continue;
    ctx.globalAlpha = glow;
    rect(ctx, 'rgba(255, 243, 166, 0.3)', x - 1, y - 1, 3, 3);
    rect(ctx, '#fff7b8', x, y, 1, 1);
  }
  ctx.globalAlpha = 1;
}

// A shooting star every half minute or so. Returns true while one is crossing.
const STAR_LAP = 27;
function drawShootingStar(ctx, width, horizon, seconds) {
  const t = seconds % STAR_LAP;
  if (t > 1.3) return false;
  const lap = Math.floor(seconds / STAR_LAP);
  const startX = width * (0.35 + noise(lap, 1, 115) * 0.6);
  const startY = horizon * (0.05 + noise(lap, 2, 116) * 0.25);
  const x = Math.round(startX - t * 34);
  const y = Math.round(startY + t * 17);
  for (let i = 0; i < 7; i += 1) {
    ctx.globalAlpha = 1 - i / 7;
    rect(ctx, i === 0 ? '#ffffff' : '#cfd9ff', x + i * 2, y - i, i === 0 ? 2 : 1, 1);
  }
  ctx.globalAlpha = 1;
  return true;
}

// Fireworks over the hills, for the end of the storybook.
function drawFireworks(ctx, width, horizon, tick) {
  const colors = ['#ff8fb8', '#ffd83d', '#7dd3fc', '#b197fc', '#8ce99a', '#ffa94d'];
  for (let i = 0; i < 5; i += 1) {
    const lap = 34;
    const t = (tick + i * 9) % lap;
    const round = Math.floor((tick + i * 9) / lap);
    const x = width * (0.08 + noise(round, i, 120) * 0.84);
    const y = horizon * (0.08 + noise(round, i, 121) * 0.45);
    if (t < 7) {
      rect(ctx, '#fff6dc', Math.round(x), Math.round(horizon * 0.8 - ((horizon * 0.8 - y) * t) / 7), 1, 3);
      continue;
    }
    const age = (t - 7) / (lap - 7);
    ctx.globalAlpha = Math.max(0, 1 - age * age);
    for (let p = 0; p < 16; p += 1) {
      const angle = (p / 16) * Math.PI * 2;
      const reach = age * (12 + (p % 3) * 4);
      rect(ctx, p % 4 === 0 ? '#ffffff' : colors[(round + i) % colors.length], Math.round(x + Math.cos(angle) * reach), Math.round(y + Math.sin(angle) * reach + age * age * 6), 1, 1);
    }
    ctx.globalAlpha = 1;
  }
}

// The mailbox stands on a post. When a letter waits, its yellow flag goes
// up and a white envelope peeks out.
function drawMailbox(ctx, x, groundY, flagUp) {
  rect(ctx, '#8a5a37', x + 3, groundY - 7, 2, 7);
  rect(ctx, '#6b4329', x + 3, groundY - 7, 1, 7);
  rect(ctx, '#d63a30', x, groundY - 12, 8, 5);
  rect(ctx, '#f0685c', x, groundY - 12, 8, 1);
  rect(ctx, '#a82a22', x, groundY - 8, 8, 1);
  rect(ctx, '#8f2019', x + 5, groundY - 11, 1, 3);
  if (look.snow) rect(ctx, '#ffffff', x, groundY - 13, 8, 1);
  if (flagUp) {
    rect(ctx, '#ffffff', x + 1, groundY - 11, 3, 2);
    rect(ctx, '#6b4329', x + 8, groundY - 17, 1, 7);
    rect(ctx, '#ffd83d', x + 9, groundY - 17, 3, 3);
  } else {
    rect(ctx, '#ffd83d', x + 8, groundY - 9, 3, 1);
  }
}

// A few things that belong to one season only, standing by the house.
function drawSeasonProps(ctx, season, houseX, groundY, levels) {
  if (season === 'autumn') {
    for (const px of [houseX + 9, houseX + 23]) {
      rect(ctx, '#f28c1e', px, groundY - 3, 4, 3);
      rect(ctx, '#ffb648', px + 1, groundY - 3, 1, 2);
      rect(ctx, '#46952f', px + 1, groundY - 4, 1, 1);
    }
  }
  const x = houseX - 15;
  const y = groundAt(levels, x + 2);
  if (season === 'winter') {
    // A small snowman with a red scarf.
    rect(ctx, '#ffffff', x, y - 4, 5, 4);
    rect(ctx, '#dbe6f0', x, y - 1, 5, 1);
    rect(ctx, '#ffffff', x + 1, y - 7, 3, 3);
    rect(ctx, '#2b2a26', x + 1, y - 6, 1, 1);
    rect(ctx, '#2b2a26', x + 3, y - 6, 1, 1);
    rect(ctx, '#f28c1e', x + 2, y - 5, 1, 1);
    rect(ctx, '#d63a30', x + 1, y - 4, 3, 1);
  } else if (season === 'summer') {
    // Two sunflowers.
    for (const [dx, tall] of [[0, 9], [4, 7]]) {
      rect(ctx, '#46952f', x + dx + 1, y - tall, 1, tall);
      rect(ctx, '#6cc24a', x + dx + 2, y - tall + 4, 1, 1);
      rect(ctx, '#ffd83d', x + dx, y - tall - 2, 3, 3);
      rect(ctx, '#7b4f30', x + dx + 1, y - tall - 1, 1, 1);
    }
  }
}

// Capybaras face you and get around in little hops, resting in between.
function createCapybaras(width, cast) {
  return cast.map((member, i) => {
    const body = member.baby ? BABY_BODY : CAPYBARA_BODY;
    return {
      ...member,
      w: body[0].length,
      h: body.length,
      x: width * CAST_SPOTS[i % CAST_SPOTS.length],
      direction: i % 2 ? -1 : 1,
      resting: 4 + i * 9,
      hop: 0,
      seed: i + 1,
      span: width,
    };
  });
}

// Each capybara may be asleep (it stays put, eyes closed) or have a place
// to be (`target`, an x position it hops toward and then stays at).
function moveCapybaras(herd, width, tick) {
  for (const capybara of herd) {
    if (capybara.asleep) {
      capybara.hop = 0;
      continue;
    }
    const hasTarget = capybara.target != null;
    const arrived = hasTarget && Math.abs(capybara.x - capybara.target) < 1;
    if (arrived) {
      capybara.x = capybara.target;
      capybara.hop = 0;
      continue;
    }
    if (capybara.resting > 0) {
      capybara.resting -= 1;
      continue;
    }
    if (hasTarget) capybara.direction = capybara.target > capybara.x ? 1 : -1;
    capybara.hop += 1;
    capybara.x += capybara.direction * (capybara.baby ? 0.55 : 0.7);
    if (capybara.x < 2) capybara.direction = 1;
    if (capybara.x > width - capybara.w - 2) capybara.direction = -1;
    if (capybara.hop >= HOP_TICKS) {
      // Landed: take a breath, sometimes a long one, sometimes turn around.
      capybara.hop = 0;
      const roll = noise(tick, capybara.seed, 40);
      capybara.resting = hasTarget ? 2 : roll < 0.2 ? 25 + Math.floor(roll * 150) : 3;
      if (!hasTarget && noise(tick, capybara.seed, 41) > 0.9) capybara.direction *= -1;
    }
  }
}

// Where a capybara's body is right now (top-left corner, in canvas pixels).
function capybaraSpot(capybara, levels) {
  const x = Math.round(capybara.x);
  const lift = Math.round(Math.sin((Math.PI * capybara.hop) / HOP_TICKS) * (capybara.baby ? 3 : 4));
  return { x, y: groundAt(levels, x + capybara.w / 2) - capybara.h - lift };
}

function drawCapybaras(ctx, herd, levels, seconds) {
  for (const capybara of herd) {
    const { x, y } = capybaraSpot(capybara, levels);
    drawCapybara(ctx, x, y, capybara);
    if (capybara.asleep) {
      // Little Zs drift up from a sleeper.
      for (let i = 0; i < 2; i += 1) {
        const age = (seconds / 3 + i / 2) % 1;
        ctx.globalAlpha = 1 - age;
        drawSprite(ctx, ZED, Math.round(x + capybara.w - 2 + age * 4 + i * 2), Math.round(y - 3 - hatRise(capybara.hat) - age * 9), { w: '#ffffff' });
      }
      ctx.globalAlpha = 1;
    }
  }
}

// Draws the scene into the canvas and keeps it gently alive.
// Options: `season` to start in; `phase` ('dawn', 'day', 'dusk', 'night') and
// `weather` to hold the sky still instead of following the clock (the
// storybook does this); and `onMove`, which is told where each capybara's
// head is (in CSS pixels) so name tags can follow them.
// Returns controls:
//   stop(), refresh()
//   tap(clientX, clientY) -> 'capybara' | 'campfire' | 'mailbox' | 'star' | null
//   setCampfire({ lit, roaring })
//   setCast(cast)
//   setPeople({ asleep: [first, second], together })
//   setMail(waiting)        raises the mailbox flag
//   setSeason(season)
export function startLandscape(canvas, { onMove, season: startSeason = 'spring', phase: startPhase = null, weather: fixedWeather = null } = {}) {
  const ctx = canvas.getContext('2d');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let sky;
  let front;
  let levels = [];
  let herd = [];
  let cast = DEFAULT_CAST;
  let hearts = []; // little hearts that float up when a capybara is tapped
  let chimney = { x: 0, y: 0 };
  let campfire = { x: 0, y: 0 };
  let mailbox = { x: 0, y: 0 };
  let fire = { lit: false, roaring: false };
  let people = { asleep: [false, false], together: false };
  let mail = false;
  let season = SEASONS.includes(startSeason) ? startSeason : 'spring';
  let forcedPhase = startPhase;
  let fireworks = false;
  let weather = fixedWeather ?? weatherNow();
  let horizon = 0;
  let scale = 3;
  let phase = forcedPhase ?? skyPhase();
  let tick = 0;
  let timer = null;
  let starSeenAt = -Infinity; // when a shooting star last crossed (ms)

  const lightsOut = () => people.asleep[0] && people.asleep[1];

  // Tells each capybara how its person is doing.
  function direct() {
    // Together by the fire: one on each side, or both on the left if the
    // fire is too near the edge.
    let seats = [campfire.x - 18, campfire.x + 6];
    if (seats[1] + 14 > canvas.width) seats = [campfire.x - 33, campfire.x - 18];
    herd.forEach((capybara, i) => {
      if (capybara.baby) return;
      capybara.asleep = Boolean(people.asleep[i]);
      capybara.target = people.together && !capybara.asleep ? Math.max(2, seats[i] ?? seats[0]) : null;
    });
  }

  function paint() {
    const seconds = (tick * TICK_MS) / 1000;
    const dark = phase === 'night' || phase === 'dusk';
    const wet = weather === 'rain' && !look.snow;
    ctx.drawImage(sky, 0, 0);
    if (phase === 'night' && !wet && !reduceMotion && drawShootingStar(ctx, canvas.width, horizon, seconds)) starSeenAt = Date.now();
    drawClouds(ctx, canvas.width, horizon, seconds, phase);
    if (fireworks) drawFireworks(ctx, canvas.width, horizon, tick);
    if (!dark && !wet) drawBirds(ctx, canvas.width, horizon, seconds);
    ctx.drawImage(front, 0, 0);
    drawSmoke(ctx, chimney, seconds);
    if (fire.lit) drawFlames(ctx, campfire.x, campfire.y, tick, fire.roaring);
    drawCapybaras(ctx, herd, levels, seconds);
    for (const heart of hearts) {
      ctx.globalAlpha = Math.max(0, 1 - heart.age / 14);
      drawSprite(ctx, MINI_HEART, Math.round(heart.x), Math.round(heart.y - heart.age), { r: '#e2574c' });
    }
    ctx.globalAlpha = 1;
    if (!dark && !wet && (season === 'spring' || season === 'summer')) drawButterflies(ctx, canvas.width, horizon, seconds);
    if (dark && !wet && season !== 'winter') drawFireflies(ctx, canvas.width, horizon, seconds);
    drawDrift(ctx, canvas.width, horizon, seconds);
    if (wet) {
      rect(ctx, 'rgba(70, 90, 120, 0.16)', 0, 0, canvas.width, canvas.height);
      drawRain(ctx, canvas.width, canvas.height, seconds);
    }
    onMove?.(
      herd.map((capybara) => {
        const { x, y } = capybaraSpot(capybara, levels);
        return { name: capybara.name, x: (x + capybara.w / 2) * scale, y: (y - hatRise(capybara.hat)) * scale };
      }),
    );
  }

  function build() {
    const box = canvas.parentElement.getBoundingClientRect();
    if (!box.width || !box.height) return;
    scale = Math.max(3, Math.round(Math.min(box.width, box.height) / 120));
    const width = Math.ceil(box.width / scale);
    const height = Math.ceil(box.height / scale);
    canvas.width = width;
    canvas.height = height;
    canvas.style.width = `${width * scale}px`;
    canvas.style.height = `${height * scale}px`;
    look = LOOKS[season];

    // On wide screens the house sits to the left of the Play button;
    // on phones it sits in the middle, below it.
    const wide = width > height * 1.1;
    const houseX = Math.round(width * (wide ? 0.27 : 0.5)) - 18;
    const mailX = Math.max(3, houseX - 26);
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
    phase = forcedPhase ?? skyPhase();
    weather = fixedWeather ?? weatherNow();
    drawSky(skyCtx, width, height, horizon, wide, phase);
    if (weather === 'rainbow' && phase !== 'night') drawRainbow(skyCtx, width, horizon);
    drawMountains(frontCtx, width, horizon);
    drawHills(frontCtx, width, height, horizon);

    // The trees stand behind the house, so they are drawn first.
    drawCherryTree(frontCtx, houseX - 7, groundAt(levels, houseX - 7), 1.15);
    drawCherryTree(frontCtx, houseX + 43, groundAt(levels, houseX + 43), 0.95, true);
    if (wide) {
      drawCherryTree(frontCtx, Math.round(width * 0.82), groundAt(levels, width * 0.82), 1.1);
    }

    drawGround(frontCtx, width, height, levels);
    chimney = drawHouse(frontCtx, houseX, yardY, lightsOut());
    drawBush(frontCtx, houseX - 5, yardY, 7);
    drawBush(frontCtx, houseX + 35, yardY, 6);
    drawTufts(frontCtx, width, levels, houseX);
    // Lilies keep clear of the yard, the mailbox, and whatever stands beside it.
    drawLilies(frontCtx, width, levels, { from: Math.floor((mailX - 2) / BLOCK), to: yard.to });
    drawSeasonProps(frontCtx, season, houseX, yardY, levels);
    mailbox = { x: mailX, y: groundAt(levels, mailX + 4) };
    drawMailbox(frontCtx, mailbox.x, mailbox.y, mail);

    // The campfire sits on the grass just past the trees.
    const fireX = Math.min(width - 9, houseX + 57);
    campfire = { x: fireX, y: groundAt(levels, fireX) };
    drawCampfireLogs(frontCtx, campfire.x, campfire.y);

    if (LAND_TINT[phase]) {
      frontCtx.globalCompositeOperation = 'source-atop';
      rect(frontCtx, LAND_TINT[phase], 0, 0, width, height);
      frontCtx.globalCompositeOperation = 'source-over';
      if (phase !== 'dawn' && !lightsOut()) lightWindows(frontCtx, houseX, yardY);
    }

    if (!herd.length || herd[0].span !== width) herd = createCapybaras(width, cast);
    direct();
    paint();
  }

  function step() {
    tick += 1;
    moveCapybaras(herd, canvas.width, tick);
    hearts = hearts.filter((heart) => (heart.age += 1) < 14);
    // Sitting together by the fire, a heart rises between them now and then.
    const [first, second] = herd;
    if (people.together && tick % 55 === 0 && first && second && [first, second].every((capybara) => capybara.target != null && capybara.x === capybara.target)) {
      const spot = capybaraSpot(first, levels);
      hearts.push({ x: (first.x + second.x + first.w) / 2 - 2, y: spot.y - 6, age: 0 });
    }
    paint();
  }

  build();
  window.addEventListener('resize', build);
  if (!reduceMotion) timer = setInterval(step, TICK_MS);
  // The sky changes with the hour, and the weather every few hours.
  const clock = setInterval(() => {
    if ((forcedPhase ?? skyPhase()) !== phase || (fixedWeather ?? weatherNow()) !== weather) build();
  }, 60_000);

  return {
    stop() {
      window.removeEventListener('resize', build);
      clearInterval(timer);
      clearInterval(clock);
    },
    // Tells you what was tapped: 'capybara', 'campfire', 'mailbox', 'star', or null.
    tap(clientX, clientY) {
      const box = canvas.getBoundingClientRect();
      const x = (clientX - box.left) / scale;
      const y = (clientY - box.top) / scale;
      // A tap right on the mailbox opens it, even with a capybara standing in front.
      if (x >= mailbox.x - 2 && x <= mailbox.x + 13 && y >= mailbox.y - 19 && y <= mailbox.y - 5) return 'mailbox';
      for (const capybara of herd) {
        const spot = capybaraSpot({ ...capybara, hop: 0 }, levels);
        if (x >= capybara.x - 3 && x <= capybara.x + capybara.w + 3 && y >= spot.y - 8 && y <= spot.y + capybara.h + 4) {
          if (!capybara.asleep) {
            capybara.resting = 0;
            capybara.hop = 1;
          }
          hearts.push({ x: capybara.x + capybara.w / 2 - 2, y: spot.y - 4 - hatRise(capybara.hat), age: 0 });
          if (reduceMotion) paint();
          return 'capybara';
        }
      }
      if (Math.abs(x - campfire.x) <= 8 && y >= campfire.y - 14 && y <= campfire.y + 4) return 'campfire';
      if (x >= mailbox.x - 5 && x <= mailbox.x + 16 && y >= mailbox.y - 22 && y <= mailbox.y + 4) return 'mailbox';
      // A tap on the sky just after a shooting star is a wish.
      if (y < horizon * 0.7 && Date.now() - starSeenAt < 6000) {
        starSeenAt = -Infinity;
        return 'star';
      }
      return null;
    },
    setCampfire(state) {
      fire = { ...fire, ...state };
      if (reduceMotion) paint();
    },
    // Who is in the scene: [{ name, hat, accessory, baby }], in the order
    // first person, second person, pet. Positions are kept where possible.
    setCast(next) {
      cast = next;
      const fresh = createCapybaras(canvas.width, cast);
      herd = fresh.map((capybara, i) => (herd[i] ? { ...capybara, x: herd[i].x, direction: herd[i].direction } : capybara));
      direct();
      paint();
    },
    // How the two people are: who has said good night, and whether both
    // are here right now. Their capybaras follow suit.
    setPeople(next) {
      const wasOut = lightsOut();
      people = { ...people, ...next };
      if (lightsOut() !== wasOut) build(); // the cottage lights go out, or come back on
      else {
        direct();
        if (reduceMotion) paint();
      }
    },
    setMail(waiting) {
      if (Boolean(waiting) === mail) return;
      mail = Boolean(waiting);
      build();
    },
    setSeason(next) {
      if (!SEASONS.includes(next) || next === season) return;
      season = next;
      build();
    },
    // The storybook's sky: a fixed time of day and season for each page, and
    // fireworks for the last ones.
    setLook({ phase: nextPhase = forcedPhase, season: nextSeason = season, fireworks: show = false }) {
      fireworks = show;
      if (nextPhase === forcedPhase && nextSeason === season) return;
      forcedPhase = nextPhase;
      if (SEASONS.includes(nextSeason)) season = nextSeason;
      build();
    },
    // Redraws the whole scene (for example, when night mode is switched).
    refresh: () => build(),
  };
}
