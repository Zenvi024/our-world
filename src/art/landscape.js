import { drawSprite } from './pixel.js';
import { LILY } from './sprites.js';

// The title-screen landscape: an original blocky scene drawn on a small
// canvas and scaled up with crisp pixels. Sky, a square sun, drifting clouds,
// hazy hills, grass and dirt blocks, a tree, and lilies of the valley.

const BLOCK = 8;

const SKY = ['#63b0ea', '#74bcee', '#86c8f1', '#99d3f4', '#addef7', '#c2e8f9', '#d7f1fc'];
const GRASS = ['#6cc24a', '#5bb543', '#4fa63a', '#46952f'];
const DIRT = ['#9b6a42', '#8a5a37', '#7b4f30', '#6b4329'];
const STONE = ['#8f8f8f', '#858585', '#7a7a7a', '#6f6f6f'];
const LEAVES = ['#3f8f2f', '#46952f', '#2f7a26', '#57a83c'];

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

function drawSky(ctx, width, height, horizon) {
  const band = Math.ceil(horizon / SKY.length);
  SKY.forEach((color, i) => {
    ctx.fillStyle = color;
    ctx.fillRect(0, i * band, width, band);
  });
  ctx.fillStyle = SKY[SKY.length - 1];
  ctx.fillRect(0, SKY.length * band, width, height);

  // Square sun with a soft halo.
  const sunX = Math.round(width * 0.88) - 6;
  const sunY = Math.round(horizon * 0.7);
  ctx.fillStyle = 'rgba(255, 246, 176, 0.35)';
  ctx.fillRect(sunX - 2, sunY - 2, 15, 15);
  ctx.fillStyle = '#ffe98a';
  ctx.fillRect(sunX, sunY, 11, 11);
  ctx.fillStyle = '#fff6c4';
  ctx.fillRect(sunX + 1, sunY + 1, 9, 9);
}

function drawHills(ctx, width, height, horizon) {
  const ridges = [
    { color: '#9fd3b4', base: 13, a: 7, b: 4, fa: 31, fb: 13, shift: 0 },
    { color: '#7fbf8f', base: 6, a: 5, b: 3, fa: 19, fb: 9, shift: 40 },
  ];
  for (const ridge of ridges) {
    ctx.fillStyle = ridge.color;
    for (let x = 0; x < width; x += 2) {
      const wave =
        ridge.base +
        ridge.a * Math.sin((x + ridge.shift) / ridge.fa) +
        ridge.b * Math.sin((x + ridge.shift) / ridge.fb + 2);
      const top = horizon - Math.round(wave / 2) * 2;
      ctx.fillRect(x, top, 2, height - top);
    }
  }
}

// Height of the ground, in whole blocks, for each column of blocks.
function groundLevels(columns, baseRow) {
  const levels = [];
  for (let col = 0; col < columns; col += 1) {
    const wave = 1.1 * Math.sin(col / 2.7 + 0.6) + 0.7 * Math.sin(col / 1.3 + 2.1);
    levels.push(baseRow - Math.round(wave));
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
        ctx.fillStyle = color;
        ctx.fillRect(x, y, 1, 1);
      }
    }
  });
  // Soft shadow where a taller column meets a shorter one.
  ctx.fillStyle = 'rgba(0, 0, 0, 0.18)';
  levels.forEach((topRow, col) => {
    const left = levels[col - 1];
    if (left !== undefined && left < topRow) {
      ctx.fillRect(col * BLOCK, left * BLOCK, 1, (topRow - left) * BLOCK);
    }
  });
}

function drawTree(ctx, col, levels) {
  const groundY = levels[col] * BLOCK;
  const x = col * BLOCK + 2;
  // Trunk
  for (let y = groundY - 18; y < groundY; y += 1) {
    for (let dx = 0; dx < 4; dx += 1) {
      ctx.fillStyle = dx === 0 ? '#5a3a22' : dx === 3 ? '#6b4329' : '#7b4f30';
      ctx.fillRect(x + dx, y, 1, 1);
    }
  }
  // Canopy: stacked blocky layers
  const layers = [
    { dx: -10, dy: -26, w: 24, h: 8 },
    { dx: -8, dy: -32, w: 20, h: 6 },
    { dx: -4, dy: -37, w: 12, h: 5 },
    { dx: -12, dy: -20, w: 28, h: 4 },
  ];
  for (const layer of layers) {
    for (let y = 0; y < layer.h; y += 1) {
      for (let px = 0; px < layer.w; px += 1) {
        const ax = x + layer.dx + px;
        const ay = groundY + layer.dy + y;
        ctx.fillStyle = pick(LEAVES, ax, ay, 6);
        ctx.fillRect(ax, ay, 1, 1);
      }
    }
  }
}

function drawTufts(ctx, width, levels) {
  for (let x = 1; x < width - 1; x += 1) {
    if (noise(x, 7, 8) < 0.16) {
      const y = levels[Math.floor(x / BLOCK)] * BLOCK;
      ctx.fillStyle = noise(x, 3, 9) < 0.5 ? '#5bb543' : '#46952f';
      ctx.fillRect(x, y - 1 - Math.floor(noise(x, 5, 10) * 2), 1, 3);
    }
  }
}

const LILY_FLIPPED = LILY.map((row) => [...row].reverse().join(''));

// Lilies stand on single blocks and lean toward whichever side is open air,
// so a flower never pokes into a taller neighbor.
function drawLilies(ctx, width, levels) {
  const spots = [0.4, 0.55, 0.7, 0.85, 0.97];
  const used = new Set();
  for (const spot of spots) {
    const wanted = Math.round((width * spot) / BLOCK);
    for (const offset of [0, 1, -1, 2, -2]) {
      const col = wanted + offset;
      if (col < 1 || col > levels.length - 2 || used.has(col)) continue;
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
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x, y, cloud.w, 5);
    ctx.fillRect(x + 4, y - 3, Math.round(cloud.w * 0.55), 3);
    ctx.fillStyle = '#e4eef5';
    ctx.fillRect(x, y + 5, cloud.w, 1);
  }
}

// Draws the scene into the canvas and keeps the clouds drifting.
// Returns a function that stops everything.
export function startLandscape(canvas) {
  const ctx = canvas.getContext('2d');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let sky;
  let front;
  let horizon = 0;
  let timer = null;
  const startedAt = performance.now();

  function paint() {
    ctx.drawImage(sky, 0, 0);
    drawClouds(ctx, canvas.width, horizon, (performance.now() - startedAt) / 1000);
    ctx.drawImage(front, 0, 0);
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

    const baseRow = Math.round((height * 0.72) / BLOCK);
    const levels = groundLevels(Math.ceil(width / BLOCK), baseRow);
    horizon = baseRow * BLOCK;

    let skyCtx;
    let frontCtx;
    [sky, skyCtx] = makeLayer(width, height);
    [front, frontCtx] = makeLayer(width, height);
    drawSky(skyCtx, width, height, horizon);
    drawHills(frontCtx, width, height, horizon);
    drawGround(frontCtx, width, height, levels);
    drawTree(frontCtx, Math.max(1, Math.round(levels.length * 0.16)), levels);
    drawTufts(frontCtx, width, levels);
    drawLilies(frontCtx, width, levels);
    paint();
  }

  build();
  window.addEventListener('resize', build);
  if (!reduceMotion) timer = setInterval(paint, 200);

  return () => {
    window.removeEventListener('resize', build);
    if (timer) clearInterval(timer);
  };
}
