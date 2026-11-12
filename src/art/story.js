import { drawPerson } from './people.js';

// The pictures of the storybook. Each scene is drawn on a 160 x 120 canvas,
// ten times a second, from little rectangles: a room or a place, the two
// people, and something gently moving.

export const SCENE_W = 160;
export const SCENE_H = 120;

function rect(ctx, color, x, y, w, h) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), w, h);
}

function noise(x, y, seed = 0) {
  let n = (x * 374761393 + y * 668265263 + seed * 1442695041) | 0;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  n ^= n >>> 16;
  return (n >>> 0) / 4294967296;
}

// A sky in horizontal bands, top to bottom.
function bands(ctx, colors, height = SCENE_H) {
  const band = Math.ceil(height / colors.length);
  colors.forEach((color, i) => rect(ctx, color, 0, i * band, SCENE_W, band));
}

function stars(ctx, count, maxY, f, seed = 1) {
  for (let i = 0; i < count; i += 1) {
    const twinkle = (f + i * 7) % 40 < 34;
    if (twinkle) rect(ctx, noise(i, 3, seed) < 0.3 ? '#ffffff' : '#b9c6f2', Math.floor(noise(i, 1, seed) * SCENE_W), Math.floor(noise(i, 2, seed) * maxY), 1, 1);
  }
}

const HEART = ['.r.r.', 'rrrrr', 'rrrrr', '.rrr.', '..r..'];
function sprite(ctx, shape, x, y, colors) {
  shape.forEach((row, dy) => {
    for (let dx = 0; dx < row.length; dx += 1) if (row[dx] !== '.') rect(ctx, colors[row[dx]], x + dx, y + dy, 1, 1);
  });
}
const heart = (ctx, x, y, color = '#e2574c') => sprite(ctx, HEART, x, y, { r: color });

// Hearts that drift up and fade, one after another.
function risingHearts(ctx, x, y, f, count = 2) {
  for (let i = 0; i < count; i += 1) {
    const age = ((f + i * 17) % 34) / 34;
    ctx.globalAlpha = 1 - age;
    heart(ctx, x + Math.round(Math.sin(age * 5 + i) * 3) + i * 6, y - Math.round(age * 16));
  }
  ctx.globalAlpha = 1;
}

// A speech bubble with something small inside it.
function bubble(ctx, x, y, w, h, tailLeft, inside) {
  rect(ctx, '#2b2a26', x - 1, y, w + 2, h);
  rect(ctx, '#2b2a26', x, y - 1, w, h + 2);
  rect(ctx, '#ffffff', x, y, w, h);
  const tx = tailLeft ? x + 3 : x + w - 5;
  rect(ctx, '#2b2a26', tx - 1, y + h, 4, 2);
  rect(ctx, '#ffffff', tx, y + h - 1, 2, 2);
  rect(ctx, '#2b2a26', tx + (tailLeft ? -1 : 2), y + h + 2, 1, 1);
  inside(x, y);
}

const SCENES = {};

// A classmate in the background: simple, so the eye stays on the two of them.
function classmate(ctx, x, y, shirt, hair) {
  rect(ctx, shirt, x - 8, y - 14, 16, 14);
  rect(ctx, '#e3b48a', x - 7, y - 30, 14, 15);
  rect(ctx, hair, x - 8, y - 33, 16, 7);
  rect(ctx, hair, x - 8, y - 27, 2, 5);
  rect(ctx, '#1b1718', x - 4, y - 23, 2, 2);
  rect(ctx, '#1b1718', x + 2, y - 23, 2, 2);
  rect(ctx, '#8a3b3b', x - 2, y - 18, 4, 1);
}

function desk(ctx, x, y, w = 34) {
  rect(ctx, '#a9744a', x - w / 2, y, w, 5);
  rect(ctx, '#8a5a37', x - w / 2, y + 5, w, 1);
  rect(ctx, '#7b4f30', x - w / 2 + 2, y + 6, 3, 14);
  rect(ctx, '#7b4f30', x + w / 2 - 5, y + 6, 3, 14);
}

// ---------- First day: the introduction that made him laugh ----------
SCENES.classroom = (ctx, f) => {
  // Wall, floor, and windows with morning light.
  rect(ctx, '#f3e6c4', 0, 0, SCENE_W, 92);
  rect(ctx, '#e6d5ab', 0, 62, SCENE_W, 2);
  rect(ctx, '#c9a26a', 0, 92, SCENE_W, 28);
  for (let x = 0; x < SCENE_W; x += 16) rect(ctx, '#b88f58', x, 92, 1, 28);
  rect(ctx, '#b88f58', 0, 92, SCENE_W, 1);
  for (const wx of [110, 136]) {
    rect(ctx, '#7b5a3a', wx, 10, 20, 28);
    rect(ctx, '#bfe6fb', wx + 2, 12, 16, 24);
    rect(ctx, '#ffffff', wx + 4, 16, 8, 2);
    rect(ctx, '#7b5a3a', wx + 9, 12, 2, 24);
  }
  // The board.
  rect(ctx, '#6b4a2e', 6, 8, 74, 40);
  rect(ctx, '#2f5d46', 8, 10, 70, 36);
  rect(ctx, '#e9f3ea', 14, 17, 34, 1);
  rect(ctx, '#e9f3ea', 14, 23, 24, 1);
  rect(ctx, '#e9f3ea', 14, 29, 30, 1);
  heart(ctx, 64, 20, '#f6c1cf');
  rect(ctx, '#d9d9d9', 10, 46, 66, 2);

  // The one introducing himself, up front, waving.
  drawPerson(ctx, 'a', 34, 114, { pose: 'wave', mouth: 'smile', shirt: '#f4f4f4', jacket: '#8a2f3a', pants: '#2b2f3a', frame: f, blush: true });
  bubble(ctx, 52, 52, 26, 14, true, (x, y) => {
    heart(ctx, x + 4, y + 4);
    rect(ctx, '#2b2a26', x + 13, y + 3, 2, 6);
    rect(ctx, '#2b2a26', x + 13, y + 10, 2, 2);
    rect(ctx, '#2b2a26', x + 19, y + 3, 2, 6);
    rect(ctx, '#2b2a26', x + 19, y + 10, 2, 2);
  });

  // A classmate, and the one who cannot stop laughing.
  classmate(ctx, 86, 104, '#5d8fc9', '#3a2a1c');
  desk(ctx, 86, 100, 30);
  const shake = Math.floor(f / 2) % 2;
  drawPerson(ctx, 'b', 128 + shake, 106, { sit: true, pose: 'up', mouth: 'laugh', eyes: 'happy', shirt: '#2f3e63', frame: f, bob: shake });
  desk(ctx, 128, 100);
  if (f % 8 < 5) {
    // "Ha, ha!"
    for (const [hx, hy] of [[104, 60], [150, 54]]) {
      rect(ctx, '#2b2a26', hx, hy, 1, 5);
      rect(ctx, '#2b2a26', hx + 3, hy, 1, 5);
      rect(ctx, '#2b2a26', hx, hy + 2, 4, 1);
    }
  }
};

// ---------- The Ferris wheel: the question, and a queasy stomach ----------
SCENES.ferriswheel = (ctx, f) => {
  bands(ctx, ['#141a45', '#1b2358', '#252e6c', '#33397d', '#4a3f86', '#6a4a8c']);
  stars(ctx, 40, 70, f, 4);
  // Fairground lights along the bottom.
  rect(ctx, '#1a1433', 0, 110, SCENE_W, 10);
  rect(ctx, '#3a2f5c', 0, 109, SCENE_W, 1);
  for (let x = 2; x < SCENE_W; x += 7) {
    const on = (Math.floor(f / 4) + x) % 3 !== 0;
    rect(ctx, on ? ['#ffd83d', '#ff8fb8', '#7dd3fc'][Math.floor(x / 7) % 3] : '#4a3f6b', x, 112 + (Math.floor(x / 7) % 2), 2, 2);
  }
  // A striped tent.
  for (let i = 0; i < 12; i += 1) rect(ctx, i % 2 ? '#ffffff' : '#c8423a', 16 - i, 88 + i, i * 2 + 6, 1);
  rect(ctx, '#f3e6c4', 4, 100, 30, 9);

  // The wheel turns slowly behind them.
  const cx = 46;
  const cy = 54;
  const radius = 42;
  const turn = f / 60;
  for (let a = 0; a < 72; a += 1) {
    const angle = (a / 72) * Math.PI * 2;
    rect(ctx, '#c9c2e8', cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius, 1, 1);
    rect(ctx, '#8f88b8', cx + Math.cos(angle) * (radius - 7), cy + Math.sin(angle) * (radius - 7), 1, 1);
  }
  const cabins = ['#e2574c', '#ffd83d', '#6cc24a', '#5aa9e6', '#f28cb4', '#f28c1e', '#b197fc', '#7dd3fc'];
  cabins.forEach((color, i) => {
    const angle = turn + (i / cabins.length) * Math.PI * 2;
    for (let r = 0; r < radius; r += 2) rect(ctx, '#8f88b8', cx + Math.cos(angle) * r, cy + Math.sin(angle) * r, 1, 1);
    const x = cx + Math.cos(angle) * radius;
    const y = cy + Math.sin(angle) * radius;
    rect(ctx, '#5a5478', x, y, 1, 3);
    rect(ctx, color, x - 4, y + 3, 9, 7);
    rect(ctx, '#fff6c4', x - 2, y + 5, 5, 3);
  });
  rect(ctx, '#ffd83d', cx - 2, cy - 2, 5, 5);
  rect(ctx, '#8f88b8', cx - 1, cy + 3, 3, 52);

  // Their cabin, up close, swaying a little.
  const sway = Math.round(Math.sin(f / 9) * 1.5);
  const bx = 64 + sway;
  rect(ctx, '#5a5478', bx + 45, 0, 2, 40);
  rect(ctx, '#b5372f', bx, 38, 92, 6);
  rect(ctx, '#e0685c', bx, 38, 92, 1);
  rect(ctx, '#2a2350', bx + 3, 44, 86, 56);
  rect(ctx, '#3b3270', bx + 5, 46, 82, 54);
  drawPerson(ctx, 'a', bx + 27, 112, { sit: true, mouth: 'o', eyes: 'open', shirt: '#f4f4f4', jacket: '#2f3e63', frame: f, blush: true });
  drawPerson(ctx, 'b', bx + 63, 112, { sit: true, mouth: 'flat', eyes: 'open', shirt: '#f4f4f4', jacket: '#b9a37c', queasy: Math.floor(f / 12) % 2 === 0, frame: f });
  rect(ctx, '#c8423a', bx, 100, 92, 14);
  rect(ctx, '#e0685c', bx, 100, 92, 2);
  rect(ctx, '#8f2a25', bx, 112, 92, 2);
  for (let x = bx + 8; x < bx + 90; x += 12) rect(ctx, '#b5372f', x, 102, 1, 10);
  bubble(ctx, bx + 58, 48, 26, 14, false, (x, y) => {
    heart(ctx, x + 4, y + 4);
    // A little question mark.
    rect(ctx, '#2b2a26', x + 15, y + 2, 5, 2);
    rect(ctx, '#2b2a26', x + 19, y + 3, 2, 4);
    rect(ctx, '#2b2a26', x + 16, y + 6, 4, 2);
    rect(ctx, '#2b2a26', x + 16, y + 8, 2, 1);
    rect(ctx, '#2b2a26', x + 16, y + 10, 2, 2);
  });
  risingHearts(ctx, bx + 36, 66, f, 2);
};

// ---------- Home: the small, ordinary mornings ----------
SCENES.home = (ctx, f) => {
  rect(ctx, '#f6ead0', 0, 0, SCENE_W, 100);
  for (let x = 15; x < SCENE_W; x += 16) rect(ctx, '#ecdcb8', x, 0, 1, 100);
  rect(ctx, '#c9a26a', 0, 100, SCENE_W, 20);
  for (let y = 106; y < SCENE_H; y += 7) rect(ctx, '#b88f58', 0, y, SCENE_W, 1);
  rect(ctx, '#8a6a44', 0, 98, SCENE_W, 2);
  // A window with the morning sun.
  rect(ctx, '#7b5a3a', 66, 8, 40, 34);
  rect(ctx, '#bfe6fb', 68, 10, 36, 30);
  rect(ctx, '#fff3a6', 88, 13, 10, 10);
  rect(ctx, '#ffffff', 71, 28, 13, 3);
  rect(ctx, '#7b5a3a', 85, 10, 2, 30);
  rect(ctx, '#8cc89b', 68, 35, 36, 5);
  rect(ctx, 'rgba(255, 243, 166, 0.16)', 58, 42, 56, 58);
  // Counter, stove, and a pan with an egg that flips.
  rect(ctx, '#b98556', 0, 84, 62, 16);
  rect(ctx, '#e9dcc0', 0, 80, 64, 4);
  rect(ctx, '#8a5a37', 20, 85, 1, 14);
  rect(ctx, '#8a5a37', 42, 85, 1, 14);
  rect(ctx, '#3b3b3b', 4, 78, 26, 2);
  rect(ctx, '#555555', 8, 73, 16, 5);
  rect(ctx, '#2b2a26', 24, 75, 9, 2);
  const flip = f % 30 < 6 ? 3 - Math.abs(3 - (f % 30)) : 0;
  rect(ctx, '#ffffff', 11, 71 - flip * 4, 9, 2);
  rect(ctx, '#ffd83d', 14, 71 - flip * 4, 3, 1);
  for (let i = 0; i < 3; i += 1) {
    const age = ((f + i * 9) % 27) / 27;
    ctx.globalAlpha = 0.7 * (1 - age);
    rect(ctx, '#ffffff', 12 + i * 3 + Math.round(Math.sin(age * 6 + i) * 2), 66 - age * 18, 2, 2);
  }
  ctx.globalAlpha = 1;
  // A plant in the corner.
  rect(ctx, '#b0603a', 144, 86, 11, 13);
  rect(ctx, '#46952f', 142, 68, 6, 18);
  rect(ctx, '#6cc24a', 148, 62, 6, 24);
  rect(ctx, '#46952f', 153, 72, 5, 14);
  // One cooks; the other carries the laundry.
  drawPerson(ctx, 'a', 46, 114, { pose: 'reach-left', mouth: 'smile', eyes: 'happy', shirt: '#f2c14e', pants: '#3a4a6b', frame: f });
  rect(ctx, '#f4f4f4', 39, 91, 15, 13); // an apron
  rect(ctx, '#e3e3e3', 39, 91, 15, 1);
  const step = Math.floor(f / 6) % 2;
  const b = drawPerson(ctx, 'b', 116, 114, { pose: 'hold', mouth: 'smile', eyes: 'happy', shirt: '#5ba58c', pants: '#2b2f3a', frame: f, bob: step });
  rect(ctx, '#cf9b6a', 102, b.handY - 1, 28, 10);
  rect(ctx, '#a9744a', 102, b.handY + 3, 28, 1);
  rect(ctx, '#ffffff', 104, b.handY - 6, 10, 6);
  rect(ctx, '#f7a8c9', 113, b.handY - 5, 8, 5);
  rect(ctx, '#7dd3fc', 120, b.handY - 6, 7, 6);
  risingHearts(ctx, 78, 60, f, 1);
};

// ---------- Baguio: the city lights, a laptop, and "I love you" ----------
SCENES.baguio = (ctx, f) => {
  bands(ctx, ['#0c1236', '#111a48', '#17245a', '#1f2f6c', '#2a3a7a', '#374684']);
  stars(ctx, 46, 40, f, 9);
  rect(ctx, '#f6f8ff', 132, 16, 9, 9);
  rect(ctx, '#111a48', 135, 16, 6, 6);
  // Mountains full of little lights.
  for (let x = 0; x < SCENE_W; x += 1) {
    const far = 46 + Math.round(Math.sin(x / 17) * 6 + Math.sin(x / 7) * 2);
    rect(ctx, '#1a2452', x, far, 1, 50);
    const near = 58 + Math.round(Math.sin(x / 23 + 2) * 7 + Math.sin(x / 9) * 2);
    rect(ctx, '#131a3f', x, near, 1, 40);
  }
  for (let i = 0; i < 80; i += 1) {
    const x = Math.floor(noise(i, 1, 12) * SCENE_W);
    const y = 52 + Math.floor(noise(i, 2, 12) * 30);
    if ((f + i * 5) % 50 < 44) rect(ctx, ['#ffe9a3', '#ffd83d', '#ffb86b', '#fff6dc'][i % 4], x, y, 1, 1);
  }
  // Pine trees at the edges.
  const pine = (x, tall) => {
    rect(ctx, '#2a1d14', x + 3, 86, 2, 8);
    for (let i = 0; i < tall; i += 1) {
      const w = 2 + Math.floor((i / tall) * 9);
      rect(ctx, i % 4 < 2 ? '#0f2a24' : '#14362e', x + 4 - Math.floor(w / 2), 88 - tall + i, w, 1);
    }
  };
  pine(2, 40);
  pine(15, 26);
  pine(147, 44);
  pine(135, 24);
  // The cafe's wooden deck and railing.
  rect(ctx, '#3a2a1c', 0, 94, SCENE_W, 26);
  rect(ctx, '#4a3624', 0, 94, SCENE_W, 2);
  for (let x = 0; x < SCENE_W; x += 14) rect(ctx, '#2a1d14', x, 96, 1, 24);
  rect(ctx, '#5a4430', 0, 78, SCENE_W, 2);
  for (let x = 6; x < SCENE_W; x += 12) rect(ctx, '#5a4430', x, 80, 2, 14);
  // A string of warm bulbs overhead.
  for (let x = 4; x < SCENE_W; x += 10) {
    const dip = Math.round(Math.sin((x / SCENE_W) * Math.PI) * 5);
    rect(ctx, '#4a3624', x - 4, 4 + dip, 10, 1);
    const glow = (f + x) % 30 < 26;
    rect(ctx, glow ? '#ffe9a3' : '#c9a85a', x, 6 + dip, 2, 2);
    if (glow) rect(ctx, 'rgba(255, 233, 163, 0.22)', x - 1, 5 + dip, 4, 4);
  }
  // The two of them, leaning toward each other.
  const lean = Math.round(Math.sin(f / 14));
  drawPerson(ctx, 'a', 54 + lean, 112, { sit: true, mouth: 'smile', eyes: 'happy', shirt: '#f4f4f4', jacket: '#8a2f3a', frame: f, blush: true });
  drawPerson(ctx, 'b', 106 - lean, 112, { sit: true, mouth: 'smile', eyes: 'happy', shirt: '#2b2f3a', jacket: '#6b6a4a', frame: f, blush: true });
  // The table, the laptop's glow, and two warm mugs.
  rect(ctx, '#6b4a2e', 30, 104, 100, 5);
  rect(ctx, '#4a3624', 30, 109, 100, 2);
  rect(ctx, '#4a3624', 36, 111, 4, 9);
  rect(ctx, '#4a3624', 120, 111, 4, 9);
  rect(ctx, '#2b2f3a', 69, 90, 22, 14);
  rect(ctx, f % 40 < 20 ? '#9fd0f5' : '#b9dcf7', 71, 92, 18, 10);
  rect(ctx, '#3b3f4a', 66, 103, 28, 1);
  rect(ctx, 'rgba(160, 208, 245, 0.12)', 58, 80, 44, 24);
  for (const mx of [38, 114]) {
    rect(ctx, '#f4f4f4', mx, 98, 7, 6);
    rect(ctx, '#f4f4f4', mx + 7, 99, 2, 3);
    for (let i = 0; i < 2; i += 1) {
      const age = ((f + i * 11 + mx) % 22) / 22;
      ctx.globalAlpha = 0.6 * (1 - age);
      rect(ctx, '#ffffff', mx + 2 + i * 2, 96 - age * 9, 1, 2);
    }
    ctx.globalAlpha = 1;
  }
  risingHearts(ctx, 74, 58, f, 2);
};

// ---------- Fireworks: the last picture ----------
SCENES.fireworks = (ctx, f) => {
  bands(ctx, ['#080c26', '#0c1236', '#111a48', '#17245a', '#1f2f6c', '#2a3a7a']);
  stars(ctx, 50, 80, f, 21);
  const colors = ['#ff8fb8', '#ffd83d', '#7dd3fc', '#b197fc', '#8ce99a', '#ffa94d'];
  for (let i = 0; i < 4; i += 1) {
    const lap = 38;
    const t = (f + i * 11) % lap;
    const round = Math.floor((f + i * 11) / lap);
    const x = 20 + noise(round, i, 31) * 120;
    const y = 12 + noise(round, i, 32) * 30;
    const color = colors[(round + i) % colors.length];
    if (t < 8) {
      rect(ctx, '#fff6dc', x, 90 - ((90 - y) * t) / 8, 1, 3);
    } else {
      const age = (t - 8) / (lap - 8);
      ctx.globalAlpha = Math.max(0, 1 - age * age);
      for (let p = 0; p < 20; p += 1) {
        const angle = (p / 20) * Math.PI * 2;
        const reach = age * (14 + (p % 3) * 5);
        rect(ctx, p % 4 === 0 ? '#ffffff' : color, x + Math.cos(angle) * reach, y + Math.sin(angle) * reach + age * age * 8, p % 3 === 0 ? 2 : 1, p % 3 === 0 ? 2 : 1);
      }
      ctx.globalAlpha = 1;
    }
  }
  // A hill, and the two of them watching, arms around each other.
  for (let x = 0; x < SCENE_W; x += 1) {
    const top = 110 - Math.round(Math.sin((x / SCENE_W) * Math.PI) * 6);
    rect(ctx, '#0d1a2a', x, top, 1, SCENE_H - top);
  }
  drawPerson(ctx, 'a', 66, 110, { pose: 'reach-right', mouth: 'smile', eyes: 'happy', shirt: '#f4f4f4', jacket: '#8a2f3a', frame: f, blush: true });
  drawPerson(ctx, 'b', 93, 110, { pose: 'reach-left', mouth: 'smile', eyes: 'happy', shirt: '#2b2f3a', jacket: '#6b6a4a', frame: f, blush: true });
  risingHearts(ctx, 72, 44, f, 1);
};

// Trees and a lawn, for the days spent on campus.
function campus(ctx, f, { leaves = '#5bb543', leafDark = '#46952f' } = {}) {
  bands(ctx, ['#8fd0f5', '#a3daf7', '#b9e4f9', '#cfeefb', '#e3f6fd', '#f2fbfe']);
  rect(ctx, '#e9eef2', 96, 30, 64, 60); // a building, far off
  for (let y = 36; y < 86; y += 10) for (let x = 102; x < 156; x += 10) rect(ctx, '#c9d6e0', x, y, 6, 5);
  for (const [tx, tall] of [[14, 70], [58, 62], [146, 74]]) {
    rect(ctx, '#6b4329', tx - 2, 96 - tall + 26, 5, tall - 26);
    for (const [dx, dy, w, h] of [[-14, 0, 28, 14], [-18, 10, 36, 14], [-12, 22, 26, 10]]) {
      rect(ctx, leaves, tx + dx, 96 - tall + dy, w, h);
      rect(ctx, leafDark, tx + dx, 96 - tall + dy + h - 3, w, 3);
    }
  }
  rect(ctx, '#8cc89b', 0, 96, SCENE_W, 24);
  rect(ctx, '#6cc24a', 0, 96, SCENE_W, 2);
  for (let i = 0; i < 6; i += 1) {
    const y = (noise(i, 2, 51) * 100 + f * 0.6) % 104;
    rect(ctx, '#ffd83d', (noise(i, 3, 51) * SCENE_W + Math.sin(f / 8 + i) * 4) % SCENE_W, y, 2, 1);
  }
}

// A bunch of flowers in paper, held at (x, y).
function bouquet(ctx, x, y, paper = '#a9d3f2') {
  rect(ctx, paper, x - 6, y - 4, 12, 12);
  rect(ctx, '#ffffff', x - 4, y + 4, 8, 6);
  rect(ctx, '#3d6fd6', x - 1, y + 8, 2, 4);
  for (const [dx, dy, color] of [[-5, -8, '#b197fc'], [0, -10, '#ffd83d'], [4, -8, '#b197fc'], [-2, -5, '#ffffff'], [3, -4, '#f7a8c9']]) {
    rect(ctx, color, x + dx - 1, y + dy, 4, 4);
    rect(ctx, '#ffffff', x + dx, y + dy + 1, 1, 1);
  }
}

// ---------- The strongest person I know ----------
SCENES.strength = (ctx, f) => {
  bands(ctx, ['#f6a5b6', '#f9b9ab', '#fccca4', '#fedda6', '#ffeab8', '#fff4d2']);
  // The sun coming up behind him, with slow rays.
  const sx = 104;
  const sy = 70;
  for (let i = 0; i < 12; i += 1) {
    const angle = (i / 12) * Math.PI * 2 + f / 90;
    for (let r = 20; r < 58; r += 2) rect(ctx, 'rgba(255, 246, 196, 0.5)', sx + Math.cos(angle) * r, sy + Math.sin(angle) * r, 2, 2);
  }
  rect(ctx, '#fff6c4', sx - 15, sy - 15, 30, 30);
  rect(ctx, '#ffffff', sx - 11, sy - 11, 22, 22);
  // Hills.
  for (let x = 0; x < SCENE_W; x += 1) {
    const far = 84 - Math.round(Math.sin(x / 26 + 1) * 6);
    rect(ctx, '#b9dcb0', x, far, 1, 40);
    const near = 98 - Math.round(Math.sin(((x - 50) / 110) * Math.PI) * (x > 50 ? 14 : 0));
    rect(ctx, '#7fbf73', x, near, 1, 30);
    rect(ctx, '#6cc24a', x, near, 1, 2);
  }
  // He stands at the top; a lily of the valley grows beside him.
  drawPerson(ctx, 'b', 106, 86, { mouth: 'smile', eyes: 'open', shirt: '#5ba58c', pants: '#3a4a6b', frame: f });
  rect(ctx, '#46952f', 128, 78, 1, 9);
  rect(ctx, '#6cc24a', 126, 82, 2, 5);
  rect(ctx, '#ffffff', 129, 77, 2, 2);
  rect(ctx, '#ffffff', 130, 80, 2, 2);
  // And someone looks up at him.
  drawPerson(ctx, 'a', 30, 112, { mouth: 'smile', eyes: 'open', shirt: '#f4f4f4', jacket: '#8a2f3a', frame: f, blush: true });
  risingHearts(ctx, 46, 52, f, 1);
  for (let i = 0; i < 8; i += 1) {
    const y = (noise(i, 2, 55) * SCENE_H + f * 0.5) % SCENE_H;
    rect(ctx, '#ffffff', (noise(i, 3, 55) * SCENE_W + f * 0.6 + Math.sin(f / 7 + i) * 3) % SCENE_W, y, 2, 1);
  }
};

// ---------- The march, the flag, and the first photo together ----------
SCENES.pride = (ctx, f) => {
  bands(ctx, ['#1a1440', '#231a55', '#2f2168', '#3d2a78', '#4d3486', '#5e3f8f']);
  stars(ctx, 30, 50, f, 61);
  const rainbow = ['#e2574c', '#f28c1e', '#ffd83d', '#6cc24a', '#5aa9e6', '#b197fc'];
  // Pennants overhead.
  for (let x = 0; x < SCENE_W; x += 10) {
    const dip = Math.round(Math.sin((x / SCENE_W) * Math.PI) * 6);
    rect(ctx, '#d9d2f0', x, 8 + dip, 10, 1);
    for (let i = 0; i < 5; i += 1) rect(ctx, rainbow[(x / 10) % 6], x + 2 + Math.floor(i / 2), 9 + dip + i, 6 - i, 1);
  }
  // A cheering crowd behind, with little flags.
  for (let i = 0; i < 14; i += 1) {
    const x = i * 12 + 2;
    const hop = (Math.floor(f / 4) + i) % 3 === 0 ? 2 : 0;
    rect(ctx, '#241a4a', x, 84 - hop, 9, 30);
    rect(ctx, '#2d2158', x + 1, 76 - hop, 7, 8);
    if (i % 3 === 0) {
      rect(ctx, '#d9d2f0', x + 9, 64 - hop, 1, 14);
      for (let s = 0; s < 6; s += 1) rect(ctx, rainbow[s], x + 10, 64 - hop + s, 6, 1);
    }
  }
  rect(ctx, '#3a2f5c', 0, 108, SCENE_W, 12);
  // The two of them, and the flag he carried.
  const a = drawPerson(ctx, 'a', 62, 112, { pose: 'up', mouth: 'laugh', eyes: 'happy', shirt: '#f4f4f4', pants: '#2b2f3a', frame: f, blush: true });
  drawPerson(ctx, 'b', 96, 112, { pose: 'reach-left', mouth: 'smile', eyes: 'happy', shirt: '#2f3e63', pants: '#b9a37c', frame: f, blush: true });
  const poleX = a.torsoX - 3;
  rect(ctx, '#e9e4d4', poleX, 18, 2, a.torsoTop - 28);
  for (let x = 0; x < 34; x += 1) {
    const wave = Math.round(Math.sin(x / 5 + f / 3) * 2);
    rainbow.forEach((color, s) => rect(ctx, color, poleX - 34 + x, 20 + s * 3 + wave, 1, 3));
  }
  // Confetti, and the flash of the camera.
  for (let i = 0; i < 18; i += 1) {
    const y = (noise(i, 2, 62) * SCENE_H + f * (0.8 + noise(i, 1, 62))) % SCENE_H;
    rect(ctx, rainbow[i % 6], (noise(i, 3, 62) * SCENE_W + Math.sin(f / 6 + i) * 4) % SCENE_W, y, 2, 1);
  }
  const flash = f % 60;
  if (flash < 3) rect(ctx, `rgba(255, 255, 255, ${0.75 - flash * 0.25})`, 0, 0, SCENE_W, SCENE_H);
};

// ---------- Best friends: study nights ----------
SCENES.study = (ctx, f) => {
  rect(ctx, '#3b3558', 0, 0, SCENE_W, SCENE_H);
  for (let x = 15; x < SCENE_W; x += 16) rect(ctx, '#353050', x, 0, 1, 96);
  // A window with the moon and the city.
  rect(ctx, '#211c38', 96, 10, 50, 40);
  rect(ctx, '#141a45', 98, 12, 46, 36);
  rect(ctx, '#f6f8ff', 128, 16, 8, 8);
  rect(ctx, '#141a45', 131, 16, 5, 5);
  for (let i = 0; i < 12; i += 1) {
    const bx = 98 + i * 4;
    const tall = 6 + Math.floor(noise(i, 1, 71) * 12);
    rect(ctx, '#0d1230', bx, 48 - tall, 4, tall);
    if ((f + i * 9) % 60 < 50) rect(ctx, '#ffe9a3', bx + 1, 48 - tall + 2 + (i % 3) * 2, 1, 1);
  }
  rect(ctx, '#211c38', 120, 12, 2, 36);
  // A clock that is far too late, and a shelf.
  rect(ctx, '#f3e6c4', 22, 14, 14, 14);
  rect(ctx, '#2b2a26', 28, 17, 1, 5);
  rect(ctx, '#2b2a26', 28, 21, 4, 1);
  rect(ctx, '#6b4a2e', 46, 30, 34, 2);
  for (let i = 0; i < 8; i += 1) rect(ctx, ['#c8423a', '#5d8fc9', '#5ba548', '#d99a3c'][i % 4], 48 + i * 4, 21 + (i % 2), 3, 9 - (i % 2));
  // The two of them behind the desk.
  drawPerson(ctx, 'a', 56, 104, { sit: true, mouth: 'flat', eyes: f % 50 < 40 ? 'open' : 'closed', shirt: '#f2c14e', frame: f });
  drawPerson(ctx, 'b', 100, 104, { sit: true, mouth: 'smile', eyes: 'open', shirt: '#5ba58c', frame: f });
  rect(ctx, '#8a5a37', 14, 96, 132, 6);
  rect(ctx, '#6b4329', 14, 102, 132, 3);
  rect(ctx, '#5a3a22', 20, 105, 5, 15);
  rect(ctx, '#5a3a22', 135, 105, 5, 15);
  // Books, a lamp, two laptops, and two mugs.
  rect(ctx, '#2b2f3a', 44, 82, 24, 14);
  rect(ctx, '#b9dcf7', 46, 84, 20, 10);
  rect(ctx, '#2b2f3a', 90, 82, 24, 14);
  rect(ctx, f % 30 < 15 ? '#b9dcf7' : '#cfe6fa', 92, 84, 20, 10);
  rect(ctx, '#c8423a', 18, 90, 18, 3);
  rect(ctx, '#5d8fc9', 20, 87, 16, 3);
  rect(ctx, '#5ba548', 19, 84, 15, 3);
  rect(ctx, '#3b3b3b', 128, 76, 2, 20);
  rect(ctx, '#ffe9a3', 120, 68, 18, 9);
  rect(ctx, '#ffd83d', 120, 75, 18, 2);
  for (const mx of [74, 118]) {
    rect(ctx, '#f4f4f4', mx, 90, 6, 6);
    const age = ((f + mx) % 24) / 24;
    ctx.globalAlpha = 0.6 * (1 - age);
    rect(ctx, '#ffffff', mx + 2, 88 - age * 9, 1, 2);
    ctx.globalAlpha = 1;
  }
  // "zz": someone is about to nod off.
  if (f % 50 >= 40) {
    rect(ctx, '#ffffff', 70, 58, 4, 1);
    rect(ctx, '#ffffff', 72, 59, 1, 1);
    rect(ctx, '#ffffff', 71, 60, 1, 1);
    rect(ctx, '#ffffff', 70, 61, 4, 1);
  }
};

// ---------- The bouquet he thought was from someone else ----------
SCENES.bouquet = (ctx, f) => {
  campus(ctx, f);
  const give = Math.round(Math.sin(f / 10) * 1);
  const a = drawPerson(ctx, 'a', 52, 112, { pose: 'reach-right', mouth: 'smile', eyes: 'happy', shirt: '#f4f4f4', jacket: '#b9a37c', pants: '#2b2f3a', frame: f, blush: true });
  drawPerson(ctx, 'b', 108, 112, { mouth: 'o', eyes: 'open', shirt: '#2f3e63', pants: '#d9cfae', frame: f, blush: true });
  bouquet(ctx, 80 + give, a.torsoTop + 2);
  bubble(ctx, 116, 36, 14, 14, true, (x, y) => {
    rect(ctx, '#2b2a26', x + 4, y + 2, 5, 2);
    rect(ctx, '#2b2a26', x + 8, y + 3, 2, 4);
    rect(ctx, '#2b2a26', x + 5, y + 6, 4, 2);
    rect(ctx, '#2b2a26', x + 5, y + 8, 2, 1);
    rect(ctx, '#2b2a26', x + 5, y + 10, 2, 2);
  });
  risingHearts(ctx, 70, 54, f, 2);
};

// ---------- Not always on the same page, but always in the same story ----------
SCENES.samepage = (ctx, f) => {
  bands(ctx, ['#4b3f8a', '#6a4c97', '#96609d', '#c47896', '#ea967f', '#f8ba7a']);
  stars(ctx, 20, 40, f, 81);
  // A great open book.
  rect(ctx, '#6b4329', 6, 84, 148, 32);
  rect(ctx, '#fdf8e7', 10, 80, 68, 32);
  rect(ctx, '#fdf8e7', 82, 80, 68, 32);
  rect(ctx, '#d9c9a0', 78, 80, 4, 32);
  for (let y = 88; y < 108; y += 5) {
    rect(ctx, '#e6dab6', 16, y, 54, 1);
    rect(ctx, '#e6dab6', 88, y, 54, 1);
  }
  // He starts on one page, I on the other; then he crosses over.
  const t = f % 130;
  const cross = Math.max(0, Math.min(1, (t - 36) / 26));
  const hop = cross > 0 && cross < 1 ? Math.round(Math.abs(Math.sin(cross * Math.PI * 3)) * 5) : 0;
  const together = cross >= 1;
  drawPerson(ctx, 'b', 40 + Math.round(cross * 58), 92, { pose: together ? 'reach-right' : 'down', mouth: 'smile', eyes: together ? 'happy' : 'open', shirt: '#2f3e63', pants: '#b9a37c', frame: f, bob: hop, blush: together });
  drawPerson(ctx, 'a', 124, 92, { pose: together ? 'reach-left' : 'wave', mouth: 'smile', eyes: together ? 'happy' : 'open', shirt: '#f4f4f4', jacket: '#8a2f3a', frame: f, blush: true });
  if (together) risingHearts(ctx, 104, 26, f, 2);
  // A page lifts in the breeze.
  const lift = Math.round(Math.abs(Math.sin(f / 16)) * 4);
  rect(ctx, '#fffdf2', 60, 80 - lift, 18, 2 + lift);
};

// ---------- The only thing we ever fight about: directions ----------
SCENES.grab = (ctx, f) => {
  bands(ctx, ['#8fd0f5', '#a3daf7', '#b9e4f9', '#cfeefb', '#e3f6fd', '#f2fbfe']);
  // The city slides past.
  for (let i = 0; i < 9; i += 1) {
    const w = 22 + Math.floor(noise(i, 1, 91) * 12);
    const tall = 30 + Math.floor(noise(i, 2, 91) * 34);
    const x = ((i * 34 - f * 1.5) % 306 + 306) % 306 - 40;
    rect(ctx, ['#c9d6e0', '#b9c7d6', '#d6dfe8'][i % 3], x, 82 - tall, w, tall);
    for (let wy = 82 - tall + 4; wy < 78; wy += 7) for (let wx = x + 3; wx < x + w - 3; wx += 6) rect(ctx, '#eef4f8', wx, wy, 3, 4);
  }
  rect(ctx, '#6b6f7a', 0, 82, SCENE_W, 38);
  rect(ctx, '#565a65', 0, 82, SCENE_W, 2);
  for (let x = -((f * 4) % 28); x < SCENE_W; x += 28) rect(ctx, '#f2f2f2', x, 104, 14, 2);
  // The car, wobbling as its passengers argue.
  const wobble = Math.floor(f / 3) % 2;
  const cx = 22;
  const cy = 34 + wobble;
  // The two of them in the back seat, each sure of the way.
  drawPerson(ctx, 'a', cx + 44, cy + 62, { sit: true, pose: 'point-left', mouth: 'o', eyes: 'open', shirt: '#f2c14e', frame: f });
  drawPerson(ctx, 'b', cx + 80, cy + 62, { sit: true, pose: 'point-right', mouth: 'o', eyes: 'open', shirt: '#5ba58c', frame: f });
  rect(ctx, '#1f9d55', cx, cy + 46, 122, 26);
  rect(ctx, '#27b565', cx, cy + 46, 122, 2);
  rect(ctx, '#167a42', cx, cy + 68, 122, 4);
  rect(ctx, '#1f9d55', cx + 18, cy + 8, 88, 4);
  rect(ctx, '#1f9d55', cx + 14, cy + 10, 4, 38);
  rect(ctx, '#1f9d55', cx + 104, cy + 10, 4, 38);
  rect(ctx, '#1f9d55', cx + 60, cy + 10, 3, 38);
  rect(ctx, '#ffffff', cx + 6, cy + 52, 30, 8); // a sign on the door
  rect(ctx, '#1f9d55', cx + 9, cy + 55, 24, 2);
  rect(ctx, '#fff6c4', cx + 116, cy + 52, 6, 6);
  rect(ctx, '#e2574c', cx, cy + 52, 4, 6);
  for (const wx of [cx + 20, cx + 88]) {
    rect(ctx, '#2b2a26', wx, cy + 64, 18, 18);
    rect(ctx, '#8b8b8b', wx + 5, cy + 69, 8, 8);
    rect(ctx, '#2b2a26', wx + 8 + (Math.floor(f / 2) % 2), cy + 72, 2, 2);
  }
  // Left! No, right!
  const arrow = (x, y, dir) => {
    rect(ctx, '#2b2a26', x + 3, y + 5, 12, 3);
    for (let i = 0; i < 4; i += 1) rect(ctx, '#2b2a26', dir < 0 ? x + 3 + i : x + 14 - i, y + 6 - i - 1, 1, 3 + i * 2);
  };
  if (Math.floor(f / 8) % 2 === 0) bubble(ctx, 16, 8, 20, 14, false, (x, y) => arrow(x, y, -1));
  else bubble(ctx, 124, 8, 20, 14, true, (x, y) => arrow(x, y, 1));
  // A map pin, as lost as they are.
  const spin = Math.round(Math.sin(f / 4) * 3);
  rect(ctx, '#e2574c', 76 + spin, 10, 8, 8);
  rect(ctx, '#ffffff', 79 + spin, 13, 2, 2);
  rect(ctx, '#e2574c', 79 + spin, 18, 2, 4);
};

// ---------- The hard part, and staying anyway ----------
SCENES.storm = (ctx, f) => {
  bands(ctx, ['#3a3f5c', '#454a68', '#515675', '#5e6382', '#6c718f', '#7a7f9c']);
  // Heavy clouds.
  for (const [x, y, w] of [[6, 10, 44], [58, 6, 52], [116, 14, 40]]) {
    rect(ctx, '#2f3350', x, y, w, 9);
    rect(ctx, '#2f3350', x + 6, y - 4, w - 14, 5);
  }
  rect(ctx, '#565b78', 0, 106, SCENE_W, 14);
  rect(ctx, '#4a4f6b', 0, 106, SCENE_W, 2);
  // Under one umbrella.
  const a = drawPerson(ctx, 'a', 66, 112, { mouth: 'smile', eyes: 'closed', shirt: '#f4f4f4', jacket: '#2f3e63', frame: f });
  drawPerson(ctx, 'b', 94, 112, { pose: 'reach-left', mouth: 'smile', eyes: 'closed', shirt: '#2b2f3a', jacket: '#6b6a4a', frame: f, blush: true });
  rect(ctx, '#3b3b3b', 79, 36, 2, a.torsoTop - 30);
  for (let row = 0; row < 12; row += 1) {
    const half = 14 + row * 3;
    rect(ctx, row < 2 ? '#f0685c' : '#e2574c', 80 - half, 24 + row, half * 2, 1);
  }
  for (let x = 46; x < 114; x += 12) rect(ctx, '#c8423a', x, 34, 1, 2);
  // Rain everywhere but here.
  for (let i = 0; i < 60; i += 1) {
    const x = Math.floor(noise(i, 1, 101) * SCENE_W);
    const y = (noise(i, 2, 101) * SCENE_H + f * (5 + noise(i, 3, 101) * 3)) % SCENE_H;
    if (x > 42 && x < 118 && y > 34) continue;
    rect(ctx, '#b9c6e6', x, y, 1, 3);
  }
  // A heart, mended.
  heart(ctx, 77, 8, '#f2a7b5');
  rect(ctx, '#ffffff', 78, 10, 3, 1);
};

// ---------- Graduation ----------
SCENES.graduation = (ctx, f) => {
  campus(ctx, f);
  const a = drawPerson(ctx, 'a', 60, 114, { pose: 'hold', mouth: 'laugh', eyes: 'happy', gown: '#232c57', pants: '#1f1f24', frame: f, blush: true });
  drawPerson(ctx, 'b', 96, 114, { pose: 'reach-left', mouth: 'smile', eyes: 'happy', gown: '#232c57', pants: '#1f1f24', frame: f, blush: true });
  bouquet(ctx, 60, a.handY + 3);
  // Confetti for the two graduates.
  const colors = ['#ffd83d', '#f7a8c9', '#7dd3fc', '#ffffff', '#b197fc'];
  for (let i = 0; i < 22; i += 1) {
    const y = (noise(i, 2, 111) * SCENE_H + f * (0.9 + noise(i, 1, 111))) % SCENE_H;
    rect(ctx, colors[i % colors.length], (noise(i, 3, 111) * SCENE_W + Math.sin(f / 6 + i) * 4) % SCENE_W, y, 2, 1);
  }
};

// ---------- Law school, and the visits that got me through it ----------
SCENES.lawschool = (ctx, f) => {
  rect(ctx, '#e9e2cf', 0, 0, SCENE_W, 96);
  rect(ctx, '#d9d0b8', 0, 60, SCENE_W, 2);
  rect(ctx, '#9a6a44', 0, 96, SCENE_W, 24);
  for (let x = 0; x < SCENE_W; x += 20) rect(ctx, '#86593a', x, 96, 1, 24);
  // A stone plaque on the wall.
  rect(ctx, '#8a6a44', 12, 8, 70, 30);
  rect(ctx, '#e3ddcf', 14, 10, 66, 26);
  for (let y = 15; y < 32; y += 4) rect(ctx, '#8f8a7c', 20, y, 54 - ((y / 4) % 2) * 10, 1);
  // The door he comes through, with dinner.
  rect(ctx, '#6b4a2e', 116, 20, 40, 76);
  rect(ctx, '#f6dfa6', 120, 24, 32, 72);
  const arrive = Math.round(Math.sin(f / 12) * 1);
  const b = drawPerson(ctx, 'b', 134 + arrive, 112, { pose: 'hold', mouth: 'smile', eyes: 'happy', shirt: '#5ba58c', pants: '#2b2f3a', frame: f, blush: true });
  rect(ctx, '#cf9b6a', 126 + arrive, b.handY - 6, 16, 14);
  rect(ctx, '#a9744a', 126 + arrive, b.handY - 6, 16, 2);
  rect(ctx, '#e2574c', 131 + arrive, b.handY - 1, 6, 5);
  // Me, behind towers of books.
  drawPerson(ctx, 'a', 58, 104, { sit: true, mouth: 'flat', eyes: f % 60 < 46 ? 'open' : 'closed', shirt: '#f4f4f4', jacket: '#8a2f3a', frame: f });
  rect(ctx, '#8a5a37', 8, 96, 100, 6);
  rect(ctx, '#6b4329', 8, 102, 100, 3);
  rect(ctx, '#5a3a22', 14, 105, 5, 15);
  rect(ctx, '#5a3a22', 97, 105, 5, 15);
  const spines = ['#7a2f2f', '#2f4a7a', '#3f6b3a', '#7a5a2f', '#5a3a6b'];
  for (let i = 0; i < 9; i += 1) rect(ctx, spines[i % 5], 12 + (i % 2), 92 - i * 5, 22 - (i % 3), 5);
  for (let i = 0; i < 6; i += 1) rect(ctx, spines[(i + 2) % 5], 84 - (i % 2), 92 - i * 5, 20 - (i % 3), 5);
  rect(ctx, '#fbf5e3', 40, 90, 34, 6);
  rect(ctx, '#d9d0b8', 56, 90, 1, 6);
  rect(ctx, '#3b3b3b', 78, 76, 2, 20);
  rect(ctx, '#ffe9a3', 70, 68, 16, 8);
  risingHearts(ctx, 100, 40, f, 1);
};

// ---------- Dinner with his parents ----------
SCENES.dinner = (ctx, f) => {
  rect(ctx, '#f2dcc0', 0, 0, SCENE_W, 100);
  for (let x = 19; x < SCENE_W; x += 20) rect(ctx, '#e8cfae', x, 0, 1, 100);
  rect(ctx, '#8a5a37', 0, 100, SCENE_W, 20);
  // A hanging lamp, and family photos on the wall.
  rect(ctx, '#3b3b3b', 79, 0, 2, 14);
  rect(ctx, '#f28c1e', 68, 14, 24, 8);
  rect(ctx, '#ffd83d', 70, 22, 20, 2);
  rect(ctx, 'rgba(255, 221, 130, 0.14)', 40, 24, 80, 76);
  for (const [px, py] of [[14, 14], [130, 12]]) {
    rect(ctx, '#6b4a2e', px, py, 18, 16);
    rect(ctx, '#fbf5e3', px + 2, py + 2, 14, 12);
    heart(ctx, px + 6, py + 5, '#f2a7b5');
  }
  // His parents at either end, and the two of us between them.
  const parent = (x, hair, shirt) => {
    rect(ctx, shirt, x - 9, 82, 18, 18);
    rect(ctx, '#e3b48a', x - 8, 62, 16, 19);
    rect(ctx, hair, x - 9, 58, 18, 8);
    rect(ctx, hair, x - 9, 64, 2, 8);
    rect(ctx, hair, x + 7, 64, 2, 8);
    rect(ctx, '#1b1718', x - 5, 71, 3, 1);
    rect(ctx, '#1b1718', x + 2, 71, 3, 1);
    rect(ctx, '#8a3b3b', x - 3, 76, 6, 1);
    rect(ctx, '#8a3b3b', x - 4, 75, 1, 1);
    rect(ctx, '#8a3b3b', x + 3, 75, 1, 1);
  };
  parent(18, '#8f8f95', '#7a5a8f');
  parent(142, '#5f5a5c', '#3d6aa0');
  drawPerson(ctx, 'a', 60, 104, { sit: true, mouth: 'laugh', eyes: 'happy', shirt: '#f4f4f4', jacket: '#b9a37c', frame: f, blush: true });
  drawPerson(ctx, 'b', 100, 104, { sit: true, mouth: 'smile', eyes: 'happy', shirt: '#5ba58c', frame: f, blush: true });
  // The table, laid for four.
  rect(ctx, '#fbf5e3', 4, 96, 152, 6);
  rect(ctx, '#e6dab6', 4, 102, 152, 2);
  rect(ctx, '#6b4329', 10, 104, 140, 16);
  for (const [dx, color] of [[22, '#d99a3c'], [62, '#c8423a'], [98, '#6cc24a'], [136, '#f2c14e']]) {
    rect(ctx, '#ffffff', dx - 8, 92, 16, 4);
    rect(ctx, color, dx - 5, 89, 10, 3);
    const age = ((f + dx) % 26) / 26;
    ctx.globalAlpha = 0.55 * (1 - age);
    rect(ctx, '#ffffff', dx + Math.round(Math.sin(age * 6) * 2), 86 - age * 10, 1, 2);
    ctx.globalAlpha = 1;
  }
  rect(ctx, '#7dd3fc', 78, 86, 5, 10);
  risingHearts(ctx, 76, 44, f, 1);
};

// ---------- The cover, and pages whose picture is not painted yet ----------
SCENES.cover = (ctx, f) => {
  bands(ctx, ['#f8c9d6', '#fbd6cf', '#fde3c8', '#feeccb', '#fff4d8', '#fffae8']);
  for (let i = 0; i < 16; i += 1) {
    const y = (noise(i, 2, 41) * SCENE_H + f * (0.5 + noise(i, 1, 41) * 0.5)) % (SCENE_H + 4);
    const x = (noise(i, 3, 41) * SCENE_W + f * 0.3 + Math.sin(f / 9 + i) * 3) % (SCENE_W + 4);
    rect(ctx, ['#f7a8c9', '#ffd3e4', '#ffffff'][i % 3], x, y, 2, 1);
  }
  rect(ctx, '#8cc89b', 0, 104, SCENE_W, 16);
  rect(ctx, '#6cc24a', 0, 104, SCENE_W, 2);
  const bob = Math.floor(f / 8) % 2;
  drawPerson(ctx, 'a', 66, 112, { pose: 'reach-right', mouth: 'smile', eyes: 'happy', shirt: '#f4f4f4', jacket: '#8a2f3a', frame: f, bob, blush: true });
  drawPerson(ctx, 'b', 93, 112, { pose: 'reach-left', mouth: 'smile', eyes: 'happy', shirt: '#2f3e63', frame: f, bob: 1 - bob, blush: true });
  risingHearts(ctx, 72, 40, f, 2);
};

SCENES.blank = (ctx, f) => {
  rect(ctx, '#fbf3df', 0, 0, SCENE_W, SCENE_H);
  for (let y = 26; y < 100; y += 10) rect(ctx, '#eadfbd', 24, y, 112, 1);
  // A quill, writing the first stroke of what comes next.
  const dx = Math.round(Math.sin(f / 7) * 5);
  const dy = Math.round(Math.cos(f / 5) * 1);
  const qx = 86 + dx;
  const qy = 28 + dy;
  for (let i = 0; i < 26; i += 1) {
    rect(ctx, i < 4 ? '#3a2a1c' : '#ffffff', qx + i, qy - i, i < 4 ? 1 : 3 + Math.floor(i / 6), 1);
    if (i >= 4) rect(ctx, '#d9d2c0', qx + i, qy - i, 1, 1);
  }
  rect(ctx, '#3a2a1c', 26, 26, Math.min(60, 4 + (f % 80)), 1);
  heart(ctx, 77, 104, '#f2a7b5');
};

export const hasScene = (key) => Object.hasOwn(SCENES, key);

// Draws one frame of a scene. Pages without a painted scene borrow the cover's.
export function drawScene(ctx, key, frame) {
  ctx.clearRect(0, 0, SCENE_W, SCENE_H);
  (SCENES[key] ?? SCENES.cover)(ctx, frame);
}
