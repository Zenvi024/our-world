import { drawSprite } from './pixel.js';
import { LILY } from './sprites.js';
import { drawCapybara } from './outfits.js';

// Happybara's house, room by room: walls, floors, and every piece of
// furniture, all drawn with little rectangles on a 128 x 84 canvas.

export const WIDTH = 128;
export const HEIGHT = 84;
export const FLOOR_Y = 56;

export function rect(ctx, color, x, y, w, h) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
}

export function noise(x, y, salt = 0) {
  let n = (x * 374761393 + y * 668265263 + salt * 2147483647) | 0;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

export const ROOMS = ['living', 'kitchen', 'bedroom', 'bathroom', 'garden'];

// ---------- Walls and floors ----------
const WALLS = {
  living: { base: '#efe1ba', line: '#d9c79a', speck: '#e6d6ad' },
  kitchen: { base: '#f6efd9', line: '#e5d9b8', speck: '#efe6c8' },
  bedroom: { base: '#e6def3', line: '#cfc3e6', speck: '#dbd1ee' },
  bathroom: { base: '#d9edf2', line: '#bcdbe4', speck: '#cbe5ec', tiles: true, every: 8 },
  wall_mint: { base: '#cfeedd', line: '#b3dfc8', speck: '#c2e7d3' },
  wall_pink: { base: '#ffdfe8', line: '#f6c3d2', speck: '#fbd2de' },
  wall_sky: { base: '#d4ecfb', line: '#c3e2f6', speck: '#cbe7f9', clouds: true },
  wall_wood: { base: '#c99a6a', line: '#a9744a', speck: '#bb8a5b', every: 8 },
  wall_stars: { base: '#232a5c', line: '#1e2452', speck: '#293168', stars: true },
};

const FLOORS = {
  wood: { kind: 'planks', base: '#a9744a', seam: '#8a5a37', speck: '#b98556' },
  floor_dark: { kind: 'planks', base: '#6f4a30', seam: '#4f321f', speck: '#7d5638' },
  floor_tile: { kind: 'checker', a: '#f3ecd8', b: '#b9cbd6', size: 8 },
  bathroom: { kind: 'checker', a: '#eef7f8', b: '#c5dfe6', size: 6 },
  floor_carpet: { kind: 'plain', base: '#f2a7bd', speck: '#f7bccd' },
  floor_tatami: { kind: 'tatami', base: '#cdd28a', seam: '#7a8540', speck: '#d9dda0' },
};

function drawWall(ctx, key, x0 = 0, y0 = 0, w = WIDTH, h = FLOOR_Y) {
  const wall = WALLS[key] ?? WALLS.living;
  const every = wall.every ?? 16;
  for (let y = y0; y < y0 + h; y += 1) {
    for (let x = x0; x < x0 + w; x += 1) {
      let color = wall.base;
      if (x % every === every - 1 || (wall.tiles && y % every === every - 1)) color = wall.line;
      else if (noise(x >> 1, y) < 0.06) color = wall.speck;
      if (wall.stars && noise(x, y, 5) < 0.012) color = noise(x, y, 6) < 0.5 ? '#ffe36b' : '#ffffff';
      rect(ctx, color, x, y, 1, 1);
    }
  }
  if (wall.clouds && w === WIDTH) {
    for (const [cx, cy] of [[6, 6], [46, 40], [84, 4], [108, 34]]) {
      rect(ctx, '#ffffff', cx, cy + 1, 12, 3);
      rect(ctx, '#ffffff', cx + 3, cy - 1, 6, 2);
    }
  }
}

function drawFloor(ctx, key, x0 = 0, y0 = FLOOR_Y, w = WIDTH, h = HEIGHT - FLOOR_Y) {
  const floor = FLOORS[key] ?? FLOORS.wood;
  for (let y = y0; y < y0 + h; y += 1) {
    for (let x = x0; x < x0 + w; x += 1) {
      const dy = y - FLOOR_Y;
      let color;
      if (floor.kind === 'planks') {
        const plank = Math.floor(dy / 7);
        const seam = dy % 7 === 6 || (x + plank * 11) % 26 === 0;
        color = seam ? floor.seam : noise(x, y) < 0.12 ? floor.speck : floor.base;
      } else if (floor.kind === 'checker') {
        color = (Math.floor(x / floor.size) + Math.floor(dy / floor.size)) % 2 ? floor.a : floor.b;
      } else if (floor.kind === 'tatami') {
        const seam = dy % 14 === 13 || (x + Math.floor(dy / 14) * 16) % 32 === 0;
        color = seam ? floor.seam : noise(x, y >> 1) < 0.2 ? floor.speck : floor.base;
      } else {
        color = noise(x, y) < 0.15 ? floor.speck : floor.base;
      }
      rect(ctx, color, x, y, 1, 1);
    }
  }
}

function drawWindow(ctx, x, y, w, h, { night, dusk }) {
  rect(ctx, '#5a3a22', x, y, w, h);
  rect(ctx, night ? '#141f50' : dusk ? '#f6b672' : '#86c8f1', x + 2, y + 2, w - 4, h - 4);
  if (night) {
    for (let i = 0; i < 6; i += 1) {
      rect(ctx, '#ffffff', x + 3 + Math.floor(noise(i, 1) * (w - 7)), y + 3 + Math.floor(noise(i, 2) * (h - 10)), 1, 1);
    }
    rect(ctx, '#f6f8ff', x + w - 10, y + 4, 4, 4);
    rect(ctx, '#141f50', x + w - 9, y + 4, 3, 3);
  } else {
    rect(ctx, '#ffffff', x + 5, y + 5, Math.min(9, w - 12), 2);
    rect(ctx, dusk ? '#5d9a55' : '#8cc89b', x + 2, y + h - 8, w - 4, 6);
  }
  rect(ctx, '#5a3a22', x + Math.floor(w / 2) - 1, y + 2, 2, h - 4);
  rect(ctx, '#5a3a22', x + 2, y + Math.floor(h / 2) - 1, w - 4, 2);
  rect(ctx, '#7b4f30', x - 2, y + h, w + 4, 2);
}

function drawGardenShell(ctx, { night, dusk }) {
  const sky = night ? ['#0b1238', '#141f50', '#22306e'] : dusk ? ['#f08a5d', '#f6b672', '#fbd9a0'] : ['#63b4ea', '#86c8f1', '#b9e1f8'];
  rect(ctx, sky[0], 0, 0, WIDTH, 14);
  rect(ctx, sky[1], 0, 14, WIDTH, 14);
  rect(ctx, sky[2], 0, 28, WIDTH, 22);
  if (night) {
    for (let i = 0; i < 26; i += 1) rect(ctx, '#ffffff', Math.floor(noise(i, 3) * WIDTH), Math.floor(noise(i, 4) * 30), 1, 1);
    rect(ctx, '#f6f8ff', 104, 6, 7, 7);
    rect(ctx, sky[0], 106, 6, 5, 5);
  } else {
    rect(ctx, '#ffffff', 60, 8, 16, 4);
    rect(ctx, '#ffffff', 64, 5, 8, 3);
    rect(ctx, '#ffffff', 102, 16, 12, 3);
    rect(ctx, dusk ? '#ffe9a3' : '#fff3a6', 112, 4, 7, 7);
  }
  // Far hills, then a wooden fence, then the lawn.
  for (let x = 0; x < WIDTH; x += 1) {
    const top = 34 + Math.round(Math.sin(x / 14) * 4 + Math.sin(x / 5) * 1.5);
    rect(ctx, night ? '#1d3b2a' : '#7fbf73', x, top, 1, 50 - top);
  }
  for (let x = 2; x < WIDTH; x += 8) {
    rect(ctx, '#cf9b6a', x, 38, 4, 12);
    rect(ctx, '#e3b98c', x + 1, 37, 2, 1);
  }
  rect(ctx, '#a9744a', 0, 42, WIDTH, 2);
  rect(ctx, '#a9744a', 0, 47, WIDTH, 2);
  for (let y = 50; y < HEIGHT; y += 1) {
    for (let x = 0; x < WIDTH; x += 1) {
      const roll = noise(x, y);
      rect(ctx, roll < 0.1 ? '#46952f' : roll > 0.93 ? '#8fe46a' : '#5bb543', x, y, 1, 1);
    }
  }
  rect(ctx, '#46952f', 0, 50, WIDTH, 1);
}

// The parts of each room that come with the house.
function drawShell(ctx, room, style, sky) {
  if (room === 'garden') {
    drawGardenShell(ctx, sky);
    return;
  }
  drawWall(ctx, style?.wall ?? room);
  drawFloor(ctx, style?.floor ?? (room === 'bathroom' ? 'bathroom' : 'wood'));
  rect(ctx, '#7b4f30', 0, FLOOR_Y - 2, WIDTH, 2);

  if (room === 'living') {
    drawWindow(ctx, 10, 10, 30, 26, sky);
  } else if (room === 'kitchen') {
    drawWindow(ctx, 88, 10, 30, 26, sky);
    // The counter under the window.
    rect(ctx, '#b98556', 50, 47, 38, 11);
    rect(ctx, '#e9dcc0', 49, 44, 40, 3);
    rect(ctx, '#8a5a37', 62, 48, 1, 9);
    rect(ctx, '#8a5a37', 75, 48, 1, 9);
    for (const x of [56, 68, 81]) rect(ctx, '#e9dcc0', x, 51, 2, 1);
  } else if (room === 'bedroom') {
    drawWindow(ctx, 50, 8, 28, 24, sky);
    // Curtains.
    rect(ctx, '#f7a8c9', 46, 6, 6, 28);
    rect(ctx, '#f7a8c9', 76, 6, 6, 28);
    rect(ctx, '#e98bb3', 46, 6, 36, 2);
    rect(ctx, '#e98bb3', 48, 8, 1, 26);
    rect(ctx, '#e98bb3', 79, 8, 1, 26);
  } else if (room === 'bathroom') {
    drawWindow(ctx, 56, 10, 16, 16, sky);
    // The sink.
    rect(ctx, '#ffffff', 8, 44, 24, 5);
    rect(ctx, '#d5e3e8', 8, 48, 24, 1);
    rect(ctx, '#ffffff', 16, 49, 8, 9);
    rect(ctx, '#d5e3e8', 23, 49, 1, 9);
    rect(ctx, '#8f8f8f', 19, 40, 2, 4);
    rect(ctx, '#8f8f8f', 19, 40, 5, 1);
  }
}

// ---------- Furniture ----------
function blanket(ctx, tucked) {
  if (tucked) {
    rect(ctx, '#f7a8c9', 90, 47, 32, 10);
    rect(ctx, '#ffd3e4', 90, 47, 32, 2);
  } else {
    rect(ctx, '#f7a8c9', 90, 50, 21, 7);
    rect(ctx, '#ffd3e4', 90, 50, 21, 2);
  }
}

function tubFront(ctx) {
  rect(ctx, '#a9744a', 78, 58, 46, 20);
  rect(ctx, '#cf9b6a', 78, 58, 46, 2);
  rect(ctx, '#7b4f30', 78, 64, 46, 1);
  rect(ctx, '#7b4f30', 78, 72, 46, 1);
  for (let x = 85; x < 124; x += 8) rect(ctx, '#8a5a37', x, 60, 1, 18);
  rect(ctx, '#5a3a22', 80, 78, 4, 2);
  rect(ctx, '#5a3a22', 118, 78, 4, 2);
}

const yuzuFruit = (ctx, x, y) => {
  rect(ctx, '#ffd83d', x, y, 4, 3);
  rect(ctx, '#fff3a6', x + 1, y, 1, 1);
  rect(ctx, '#46952f', x + 2, y - 1, 1, 1);
};

// Each piece: the room it belongs to, the box used for its shop picture,
// and how to draw it. `s` carries { night, items }.
export const FURNITURE = {
  // ----- living room -----
  painting: {
    room: 'living',
    box: [48, 8, 30, 23],
    draw(ctx) {
      rect(ctx, '#7b4f30', 50, 10, 26, 19);
      rect(ctx, '#c2e8f9', 52, 12, 22, 15);
      for (let i = 0; i < 9; i += 1) rect(ctx, i < 3 ? '#fbfdff' : '#a9bcd1', 62 - i, 15 + i, 2 + i * 2, 1);
      rect(ctx, '#6cc24a', 52, 24, 22, 3);
      rect(ctx, '#ffd83d', 69, 14, 3, 3);
    },
  },
  bookshelf: {
    room: 'living',
    box: [96, 12, 32, 46],
    draw(ctx) {
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
  },
  lamp: {
    room: 'living',
    box: [77, 29, 20, 30],
    draw(ctx) {
      rect(ctx, '#5a3a22', 86, 40, 2, 17);
      rect(ctx, '#5a3a22', 83, 56, 8, 2);
      rect(ctx, '#ffe9a3', 81, 31, 12, 9);
      rect(ctx, '#ffd83d', 81, 38, 12, 2);
    },
    glow(ctx) {
      rect(ctx, 'rgba(255, 221, 130, 0.2)', 71, 24, 32, 40);
      rect(ctx, 'rgba(255, 233, 163, 0.5)', 81, 31, 12, 9);
    },
  },
  plant: {
    room: 'living',
    box: [41, 31, 18, 28],
    draw(ctx) {
      rect(ctx, '#b0603a', 45, 49, 10, 9);
      rect(ctx, '#8a4528', 44, 48, 12, 2);
      for (const [dx, dy, w, h] of [[2, -11, 6, 11], [-2, -7, 5, 6], [6, -8, 6, 7], [3, -15, 4, 6]]) {
        rect(ctx, dy < -10 ? '#6cc24a' : '#46952f', 45 + dx, 48 + dy, w, h);
      }
    },
  },
  rug: {
    room: 'living',
    box: [32, 60, 64, 20],
    draw(ctx) {
      rect(ctx, '#c8423a', 34, 64, 60, 12);
      rect(ctx, '#e0685c', 36, 66, 56, 8);
      for (let x = 38; x < 90; x += 6) rect(ctx, '#ffe3ee', x, 69, 2, 2);
    },
  },
  sofa: {
    room: 'living',
    box: [2, 38, 42, 24],
    draw(ctx) {
      rect(ctx, '#3f8f7a', 6, 42, 34, 10);
      rect(ctx, '#56a892', 6, 42, 34, 2);
      rect(ctx, '#56a892', 9, 50, 28, 7);
      rect(ctx, '#3f8f7a', 22, 50, 1, 7);
      rect(ctx, '#357a68', 4, 46, 5, 12);
      rect(ctx, '#357a68', 37, 46, 5, 12);
      rect(ctx, '#5a3a22', 5, 58, 3, 2);
      rect(ctx, '#5a3a22', 38, 58, 3, 2);
      rect(ctx, '#ffd3e4', 11, 45, 6, 5);
      rect(ctx, '#f7a8c9', 11, 49, 6, 1);
    },
  },
  gramophone: {
    room: 'living',
    box: [58, 32, 22, 28],
    draw(ctx) {
      rect(ctx, '#7b4f30', 61, 50, 14, 2);
      rect(ctx, '#5a3a22', 62, 52, 2, 6);
      rect(ctx, '#5a3a22', 72, 52, 2, 6);
      rect(ctx, '#8a5a37', 63, 45, 10, 5);
      rect(ctx, '#2b2a26', 64, 44, 8, 1);
      rect(ctx, '#d99a1c', 69, 41, 2, 3);
      rect(ctx, '#d99a1c', 70, 38, 3, 3);
      rect(ctx, '#d99a1c', 72, 35, 5, 4);
      rect(ctx, '#ffd83d', 74, 33, 5, 3);
      rect(ctx, '#ffd83d', 77, 36, 2, 3);
    },
  },
  aquarium: {
    room: 'living',
    box: [2, 58, 30, 24],
    draw(ctx) {
      rect(ctx, '#6b4329', 5, 75, 24, 6);
      rect(ctx, '#3b3b3b', 4, 60, 26, 15);
      rect(ctx, '#7cc4ee', 5, 61, 24, 13);
      rect(ctx, '#b9e1f8', 5, 61, 24, 1);
      rect(ctx, '#e9cf8a', 5, 72, 24, 2);
      rect(ctx, '#46952f', 8, 65, 1, 7);
      rect(ctx, '#46952f', 10, 67, 1, 5);
      rect(ctx, '#6cc24a', 25, 66, 1, 6);
      rect(ctx, '#f28c1e', 15, 65, 3, 2);
      rect(ctx, '#f28c1e', 13, 65, 1, 2);
      rect(ctx, '#e2574c', 21, 69, 3, 2);
      rect(ctx, '#e2574c', 24, 69, 1, 2);
      rect(ctx, '#ffffff', 19, 63, 1, 1);
      rect(ctx, '#ffffff', 20, 61, 1, 1);
    },
  },
  piano: {
    room: 'living',
    box: [96, 58, 30, 24],
    draw(ctx) {
      rect(ctx, '#4a2f1c', 98, 60, 26, 18);
      rect(ctx, '#6b4329', 98, 60, 26, 2);
      rect(ctx, '#fbf5e3', 106, 62, 10, 5);
      rect(ctx, '#2b2a26', 108, 63, 1, 1);
      rect(ctx, '#2b2a26', 111, 64, 1, 1);
      rect(ctx, '#2b2a26', 113, 63, 1, 1);
      rect(ctx, '#fbf5e3', 99, 69, 24, 3);
      for (let x = 100; x < 122; x += 3) rect(ctx, '#2b2a26', x, 69, 1, 2);
      rect(ctx, '#3a2718', 98, 78, 3, 3);
      rect(ctx, '#3a2718', 121, 78, 3, 3);
    },
  },

  // ----- kitchen -----
  fridge: {
    room: 'kitchen',
    box: [2, 18, 24, 42],
    draw(ctx) {
      rect(ctx, '#dfeee8', 4, 20, 20, 38);
      rect(ctx, '#f4fbf8', 4, 20, 1, 38);
      rect(ctx, '#b9d3c9', 4, 20, 20, 1);
      rect(ctx, '#b9d3c9', 4, 33, 20, 1);
      rect(ctx, '#b9d3c9', 23, 20, 1, 38);
      rect(ctx, '#8b8b8b', 21, 25, 1, 5);
      rect(ctx, '#8b8b8b', 21, 36, 1, 8);
      rect(ctx, '#e2574c', 8, 24, 2, 2);
      rect(ctx, '#ffd83d', 12, 27, 2, 2);
      rect(ctx, '#555555', 5, 58, 3, 1);
      rect(ctx, '#555555', 20, 58, 3, 1);
    },
  },
  stove: {
    room: 'kitchen',
    box: [26, 28, 24, 32],
    draw(ctx) {
      rect(ctx, '#d6d6d6', 28, 44, 20, 14);
      rect(ctx, '#3b3b3b', 28, 42, 20, 2);
      for (const x of [30, 33, 36]) rect(ctx, '#555555', x, 45, 1, 1);
      rect(ctx, '#555555', 31, 48, 14, 8);
      rect(ctx, '#2b2a26', 33, 50, 10, 4);
      rect(ctx, '#f28c1e', 35, 52, 6, 1);
      rect(ctx, '#8f8f8f', 33, 37, 10, 5);
      rect(ctx, '#b4b4b4', 33, 37, 10, 1);
      rect(ctx, '#555555', 31, 38, 2, 1);
      rect(ctx, '#555555', 43, 38, 2, 1);
      rect(ctx, 'rgba(255, 255, 255, 0.8)', 36, 33, 2, 2);
      rect(ctx, 'rgba(255, 255, 255, 0.6)', 39, 31, 2, 2);
      rect(ctx, 'rgba(255, 255, 255, 0.4)', 37, 29, 1, 1);
    },
  },
  jars: {
    room: 'kitchen',
    box: [28, 12, 34, 16],
    draw(ctx) {
      rect(ctx, '#7b4f30', 30, 24, 30, 2);
      const jam = ['#e2574c', '#f28c1e', '#ffd83d', '#6cc24a', '#9a6bb5'];
      jam.forEach((color, i) => {
        rect(ctx, '#f4fbf8', 32 + i * 6, 18, 4, 6);
        rect(ctx, color, 32 + i * 6, 20, 4, 4);
        rect(ctx, '#5a3a22', 32 + i * 6, 17, 4, 1);
      });
    },
  },
  fruit_bowl: {
    room: 'kitchen',
    box: [52, 34, 14, 12],
    draw(ctx) {
      rect(ctx, '#f28c1e', 55, 38, 3, 3);
      rect(ctx, '#e2574c', 58, 37, 3, 4);
      rect(ctx, '#ffd83d', 61, 39, 3, 2);
      rect(ctx, '#5d8fc9', 54, 41, 10, 2);
      rect(ctx, '#3d6aa0', 55, 43, 8, 1);
    },
  },
  tea_set: {
    room: 'kitchen',
    box: [66, 34, 20, 12],
    draw(ctx) {
      rect(ctx, '#fbf5e3', 69, 38, 7, 6);
      rect(ctx, '#fbf5e3', 76, 40, 2, 2);
      rect(ctx, '#fbf5e3', 67, 39, 2, 3);
      rect(ctx, '#f7a8c9', 71, 37, 3, 1);
      rect(ctx, '#f7a8c9', 69, 41, 7, 1);
      rect(ctx, '#fbf5e3', 80, 41, 4, 3);
      rect(ctx, '#f7a8c9', 80, 42, 4, 1);
    },
  },
  herbs: {
    room: 'kitchen',
    box: [88, 24, 32, 14],
    draw(ctx) {
      for (const x of [91, 101, 111]) {
        rect(ctx, '#b0603a', x, 32, 6, 4);
        rect(ctx, '#8a4528', x, 32, 6, 1);
        rect(ctx, '#46952f', x, 28, 6, 4);
        rect(ctx, '#6cc24a', x + 1, 27, 2, 2);
        rect(ctx, '#6cc24a', x + 4, 28, 1, 2);
      }
    },
  },
  table: {
    room: 'kitchen',
    box: [94, 58, 32, 24],
    draw(ctx) {
      rect(ctx, '#8a5a37', 98, 67, 2, 13);
      rect(ctx, '#8a5a37', 120, 67, 2, 13);
      rect(ctx, '#cf9b6a', 96, 64, 28, 3);
      rect(ctx, '#fbf5e3', 100, 64, 20, 2);
      for (let x = 100; x < 120; x += 4) rect(ctx, '#e2574c', x, 64, 2, 1);
      rect(ctx, '#ffffff', 106, 62, 8, 2);
      rect(ctx, '#d99a3c', 108, 61, 4, 1);
    },
  },

  // ----- bedroom -----
  wardrobe: {
    room: 'bedroom',
    box: [2, 14, 28, 46],
    draw(ctx) {
      rect(ctx, '#8a5a37', 4, 16, 24, 42);
      rect(ctx, '#6b4329', 3, 15, 26, 2);
      rect(ctx, '#6b4329', 16, 18, 1, 38);
      rect(ctx, '#a9744a', 6, 19, 8, 36);
      rect(ctx, '#a9744a', 19, 19, 7, 36);
      rect(ctx, '#ffd83d', 14, 36, 1, 3);
      rect(ctx, '#ffd83d', 18, 36, 1, 3);
      rect(ctx, '#5a3a22', 5, 58, 3, 1);
      rect(ctx, '#5a3a22', 24, 58, 3, 1);
    },
  },
  toy_chest: {
    room: 'bedroom',
    box: [30, 40, 20, 20],
    draw(ctx) {
      rect(ctx, '#f28c1e', 35, 43, 4, 4);
      rect(ctx, '#6cc24a', 41, 44, 4, 3);
      rect(ctx, '#5d8fc9', 32, 48, 16, 10);
      rect(ctx, '#3d6aa0', 31, 46, 18, 3);
      rect(ctx, '#ffd83d', 39, 51, 2, 3);
      rect(ctx, '#ffd83d', 38, 52, 4, 1);
    },
  },
  nightstand: {
    room: 'bedroom',
    box: [72, 40, 16, 20],
    draw(ctx) {
      rect(ctx, '#8a5a37', 74, 48, 12, 10);
      rect(ctx, '#a9744a', 73, 47, 14, 2);
      rect(ctx, '#6b4329', 74, 53, 12, 1);
      rect(ctx, '#ffd83d', 79, 50, 2, 1);
      rect(ctx, '#ffd83d', 79, 55, 2, 1);
      rect(ctx, '#e2574c', 77, 42, 6, 5);
      rect(ctx, '#fbf5e3', 78, 43, 4, 3);
      rect(ctx, '#2b2a26', 80, 44, 1, 1);
    },
  },
  moon_lamp: {
    room: 'bedroom',
    box: [84, 18, 14, 16],
    draw(ctx) {
      drawSprite(ctx, ['..yyy.', '.yy...', 'yy....', 'yy....', 'yy....', '.yy...', '..yyy.'], 88, 22, { y: '#fff3a6' });
      rect(ctx, '#8b8b8b', 91, 19, 1, 3);
    },
    glow(ctx) {
      rect(ctx, 'rgba(255, 243, 166, 0.22)', 82, 16, 18, 20);
      drawSprite(ctx, ['..yyy.', '.yy...', 'yy....', 'yy....', 'yy....', '.yy...', '..yyy.'], 88, 22, { y: '#fff9d0' });
    },
  },
  star_lights: {
    room: 'bedroom',
    box: [84, 0, 40, 10],
    draw(ctx) {
      for (let i = 0; i < 14; i += 1) {
        rect(ctx, '#5a3a22', 1 + i * 9, 3 + (i % 2), 9, 1);
        rect(ctx, '#ffd83d', 5 + i * 9, 5 + (i % 2), 2, 2);
      }
    },
    glow(ctx) {
      for (let i = 0; i < 14; i += 1) {
        rect(ctx, 'rgba(255, 233, 130, 0.3)', 3 + i * 9, 3 + (i % 2), 6, 6);
        rect(ctx, '#fff3a6', 5 + i * 9, 5 + (i % 2), 2, 2);
      }
    },
  },
  plush: {
    room: 'bedroom',
    box: [6, 62, 14, 14],
    draw(ctx) {
      drawCapybara(ctx, 8, 65, { baby: true, accessory: 'acc_bowtie' });
    },
  },
  bed: {
    room: 'bedroom',
    box: [86, 36, 42, 30],
    draw(ctx) {
      rect(ctx, '#6b4329', 122, 38, 4, 24);
      rect(ctx, '#8a5a37', 122, 38, 4, 2);
      rect(ctx, '#6b4329', 88, 57, 36, 5);
      rect(ctx, '#6b4329', 88, 52, 2, 13);
      rect(ctx, '#6b4329', 122, 62, 3, 3);
      rect(ctx, '#fbf5e3', 90, 50, 32, 7);
      rect(ctx, '#ffffff', 112, 47, 9, 5);
      blanket(ctx, false);
    },
  },

  // ----- bathroom -----
  mirror: {
    room: 'bathroom',
    box: [8, 10, 24, 28],
    draw(ctx) {
      rect(ctx, '#cf9b6a', 10, 12, 20, 24);
      rect(ctx, '#cfeaf5', 12, 14, 16, 20);
      rect(ctx, '#ffffff', 14, 16, 2, 6);
      rect(ctx, '#ffffff', 17, 16, 1, 3);
    },
  },
  towels: {
    room: 'bathroom',
    box: [36, 26, 22, 22],
    draw(ctx) {
      rect(ctx, '#8f8f8f', 38, 30, 18, 1);
      rect(ctx, '#f7a8c9', 40, 31, 6, 12);
      rect(ctx, '#ffd3e4', 40, 40, 6, 1);
      rect(ctx, '#ffffff', 48, 31, 6, 10);
      rect(ctx, '#5aa9e6', 48, 38, 6, 1);
    },
  },
  tub: {
    room: 'bathroom',
    box: [76, 50, 50, 32],
    draw(ctx) {
      rect(ctx, '#86c8f1', 80, 55, 42, 4);
      rect(ctx, '#b9e1f8', 80, 55, 42, 1);
      tubFront(ctx);
      rect(ctx, 'rgba(255, 255, 255, 0.7)', 92, 50, 2, 2);
      rect(ctx, 'rgba(255, 255, 255, 0.5)', 106, 47, 2, 2);
      rect(ctx, 'rgba(255, 255, 255, 0.35)', 98, 44, 2, 2);
    },
  },
  yuzu: {
    room: 'bathroom',
    box: [78, 50, 22, 12],
    draw(ctx, s) {
      if (s.items.has('tub')) {
        yuzuFruit(ctx, 81, 55);
        yuzuFruit(ctx, 117, 54);
        yuzuFruit(ctx, 86, 54);
      } else {
        // No tub yet: they wait in a bowl.
        yuzuFruit(ctx, 82, 53);
        yuzuFruit(ctx, 87, 52);
        yuzuFruit(ctx, 91, 54);
        rect(ctx, '#cf9b6a', 80, 56, 16, 3);
        rect(ctx, '#a9744a', 82, 59, 12, 1);
      }
    },
  },
  duck: {
    room: 'bathroom',
    box: [6, 64, 14, 12],
    draw(ctx) {
      rect(ctx, '#ffd83d', 8, 70, 8, 4);
      rect(ctx, '#ffd83d', 13, 66, 4, 5);
      rect(ctx, '#f28c1e', 17, 68, 2, 1);
      rect(ctx, '#2b2a26', 15, 67, 1, 1);
      rect(ctx, '#f2c21c', 9, 71, 4, 1);
    },
  },
  bath_mat: {
    room: 'bathroom',
    box: [32, 62, 44, 18],
    draw(ctx) {
      rect(ctx, '#8cc7d6', 36, 66, 36, 10);
      rect(ctx, '#b5e0ea', 37, 67, 34, 8);
      for (let x = 40; x < 70; x += 6) rect(ctx, '#ffffff', x, 70, 2, 2);
    },
  },

  // ----- garden -----
  sakura: {
    room: 'garden',
    box: [0, 2, 44, 58],
    draw(ctx) {
      rect(ctx, '#6b4329', 17, 28, 6, 28);
      rect(ctx, '#8a5a37', 17, 28, 2, 28);
      rect(ctx, '#6b4329', 10, 26, 20, 3);
      rect(ctx, '#f7a8c9', 11, 4, 20, 3);
      rect(ctx, '#f7a8c9', 6, 7, 30, 4);
      rect(ctx, '#f7a8c9', 2, 11, 38, 10);
      rect(ctx, '#f7a8c9', 5, 21, 32, 4);
      rect(ctx, '#f7a8c9', 9, 25, 8, 2);
      rect(ctx, '#f7a8c9', 23, 25, 10, 2);
      for (let i = 0; i < 46; i += 1) {
        const x = 6 + Math.floor(noise(i, 7) * 28);
        const y = 7 + Math.floor(noise(i, 8) * 16);
        rect(ctx, i % 3 ? '#ffd3e4' : '#e98bb3', x, y, 2, 2);
      }
      for (const [x, y] of [[30, 34], [8, 40], [34, 46], [26, 52]]) rect(ctx, '#ffd3e4', x, y, 1, 1);
    },
  },
  birdhouse: {
    room: 'garden',
    box: [44, 14, 14, 40],
    draw(ctx) {
      rect(ctx, '#8a5a37', 50, 30, 2, 24);
      rect(ctx, '#fbf5e3', 46, 22, 10, 9);
      rect(ctx, '#c8423a', 45, 20, 12, 3);
      rect(ctx, '#c8423a', 47, 18, 8, 2);
      rect(ctx, '#3a2718', 50, 25, 2, 2);
      rect(ctx, '#5aa9e6', 51, 15, 4, 3);
      rect(ctx, '#f28c1e', 55, 16, 1, 1);
      rect(ctx, '#2b2a26', 53, 15, 1, 1);
    },
  },
  flowers: {
    room: 'garden',
    box: [56, 40, 28, 14],
    draw(ctx) {
      rect(ctx, '#6b4329', 58, 51, 24, 2);
      const blooms = ['#ff8fb8', '#ffd83d', '#ffffff', '#f28c1e', '#c79bf2', '#ff8fb8'];
      blooms.forEach((color, i) => {
        const x = 59 + i * 4;
        rect(ctx, '#46952f', x + 1, 47, 1, 4);
        rect(ctx, color, x, 44 + (i % 2), 3, 3);
        rect(ctx, '#fff3a6', x + 1, 45 + (i % 2), 1, 1);
      });
    },
  },
  lantern: {
    room: 'garden',
    box: [81, 30, 14, 26],
    draw(ctx, s) {
      rect(ctx, '#8f8f8f', 85, 51, 6, 3);
      rect(ctx, '#a3a3a3', 87, 44, 2, 7);
      rect(ctx, '#d6d6d6', 84, 38, 8, 6);
      rect(ctx, s.night ? '#ffd83d' : '#fff3a6', 86, 40, 4, 3);
      rect(ctx, '#6f6f6f', 83, 36, 10, 2);
      rect(ctx, '#6f6f6f', 86, 34, 4, 2);
    },
    glow(ctx) {
      rect(ctx, 'rgba(255, 221, 130, 0.25)', 78, 32, 20, 22);
      rect(ctx, '#ffe36b', 86, 40, 4, 3);
    },
  },
  swing: {
    room: 'garden',
    box: [94, 16, 32, 42],
    draw(ctx) {
      rect(ctx, '#8a5a37', 97, 22, 2, 34);
      rect(ctx, '#8a5a37', 121, 22, 2, 34);
      rect(ctx, '#a9744a', 95, 19, 30, 3);
      rect(ctx, '#e9cf8a', 104, 22, 1, 23);
      rect(ctx, '#e9cf8a', 115, 22, 1, 23);
      rect(ctx, '#cf9b6a', 102, 45, 16, 3);
      rect(ctx, '#a9744a', 102, 47, 16, 1);
    },
  },
  picnic: {
    room: 'garden',
    box: [34, 58, 40, 22],
    draw(ctx) {
      rect(ctx, '#e2574c', 36, 66, 36, 10);
      for (let y = 66; y < 76; y += 2) {
        for (let x = 36 + ((y / 2) % 2) * 2; x < 72; x += 4) rect(ctx, '#ffffff', x, y, 2, 2);
      }
      rect(ctx, '#a9744a', 63, 59, 6, 1);
      rect(ctx, '#a9744a', 62, 60, 1, 2);
      rect(ctx, '#a9744a', 69, 60, 1, 2);
      rect(ctx, '#cf9b6a', 61, 62, 10, 6);
      rect(ctx, '#a9744a', 61, 64, 10, 1);
    },
  },
  pond: {
    room: 'garden',
    box: [82, 58, 44, 24],
    draw(ctx) {
      rect(ctx, '#8f8f8f', 86, 63, 36, 15);
      rect(ctx, '#8f8f8f', 84, 66, 40, 9);
      rect(ctx, '#5aa9e6', 88, 64, 32, 13);
      rect(ctx, '#5aa9e6', 86, 67, 36, 7);
      rect(ctx, '#9fd0f5', 91, 66, 8, 1);
      rect(ctx, '#9fd0f5', 106, 74, 6, 1);
      rect(ctx, '#46952f', 96, 69, 6, 3);
      rect(ctx, '#f7a8c9', 98, 68, 2, 2);
      rect(ctx, '#46952f', 112, 66, 4, 2);
      rect(ctx, '#f28c1e', 107, 71, 3, 1);
      rect(ctx, '#f28c1e', 110, 70, 1, 3);
    },
  },
  lily_patch: {
    room: 'garden',
    box: [0, 60, 32, 22],
    draw(ctx) {
      drawSprite(ctx, LILY, 0, 62);
      drawSprite(ctx, LILY, 14, 66);
    },
  },
};

const ORDER = [
  'star_lights', 'painting', 'jars', 'mirror', 'moon_lamp', 'towels', 'bookshelf', 'wardrobe', 'fridge', 'sofa', 'lamp', 'plant',
  'gramophone', 'stove', 'toy_chest', 'nightstand', 'fruit_bowl', 'tea_set', 'herbs', 'sakura', 'birdhouse', 'flowers', 'lantern',
  'swing', 'rug', 'bath_mat', 'picnic', 'bed', 'tub', 'yuzu', 'aquarium', 'piano', 'table', 'plush', 'duck', 'pond', 'lily_patch',
];

// Draws a whole room: its shell, then whatever furniture is owned.
export function drawRoom(ctx, room, { items, style, night = false, dusk = false }) {
  drawShell(ctx, room, style, { night, dusk });
  for (const key of ORDER) {
    if (items.has(key) && FURNITURE[key].room === room) FURNITURE[key].draw(ctx, { items, night });
  }
}

// The warm light of lamps, drawn over the night's shadow.
export function drawGlows(ctx, room, items) {
  for (const key of ORDER) {
    if (items.has(key) && FURNITURE[key].room === room) FURNITURE[key].glow?.(ctx);
  }
}

export { blanket as drawBlanket, tubFront as drawTubFront };

function cropped(source, [x, y, w, h]) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  canvas.getContext('2d').drawImage(source, x, y, w, h, 0, 0, w, h);
  return canvas;
}

function scratch() {
  const canvas = document.createElement('canvas');
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  return canvas;
}

// Small pictures for the shop. Each room's empty shell is drawn once and reused.
const shells = new Map();
function shellOf(room) {
  if (!shells.has(room)) {
    const canvas = scratch();
    drawShell(canvas.getContext('2d'), room, null, { night: false, dusk: false });
    shells.set(room, canvas);
  }
  return shells.get(room);
}

export function furniturePreview(key) {
  const piece = FURNITURE[key];
  const canvas = scratch();
  const ctx = canvas.getContext('2d');
  ctx.drawImage(shellOf(piece.room), 0, 0);
  // The bath yuzu are shown floating in a tub.
  if (key === 'yuzu') FURNITURE.tub.draw(ctx, {});
  piece.draw(ctx, { items: new Set([key, 'tub']), night: false });
  return cropped(canvas, piece.box);
}

export function roomPreview(room) {
  return cropped(shellOf(room), [24, 4, 80, 80]);
}

export function wallPreview(key) {
  const canvas = scratch();
  drawWall(canvas.getContext('2d'), key);
  return cropped(canvas, [0, 0, 32, 32]);
}

export function floorPreview(key) {
  const canvas = scratch();
  drawFloor(canvas.getContext('2d'), key);
  return cropped(canvas, [0, FLOOR_Y, 28, 28]);
}
