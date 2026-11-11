// Original pixel art is written as rows of characters: one character per
// pixel, '.' for transparent, and a palette that maps characters to colors.

export const PALETTE = {
  g: '#3f8f2f', // stem green
  G: '#6cc24a', // leaf green
  d: '#2d6a24', // deep green
  w: '#ffffff', // white
  s: '#d5e3cf', // soft shade for white
  k: '#2b2a26', // ink
  c: '#fbf5e3', // cream
  e: '#b9b29a', // cream shade
  b: '#5a3a22', // dark brown
  B: '#8a5a37', // brown
  n: '#a9744a', // light brown
  y: '#ffd83d', // yellow
  o: '#d99a1c', // amber
  r: '#e2574c', // red
  a: '#d6d6d6', // light gray
  m: '#8b8b8b', // mid gray
  M: '#555555', // dark gray
  E: '#2ecf6e', // gem green
  j: '#149a4b', // gem shade
  J: '#0a6b33', // gem edge
  L: '#c9fbd8', // gem shine
  u: '#3d6fd6', // sky blue
  Y: '#fff3a6', // pale gold
  O: '#9a6412', // deep gold
  t: '#e9dfae', // parchment
  T: '#cfc28a', // parchment shade
  q: '#8f8346', // parchment edge
  x: '#8a4528', // leather
  X: '#b0603a', // leather light
  z: '#4a2314', // leather dark
};

function runs(rows, visit) {
  rows.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const char = row[x];
      let length = 1;
      while (x + length < row.length && row[x + length] === char) length += 1;
      if (char !== '.') visit(x, y, length, char);
      x += length;
    }
  });
}

export function pixelSvgMarkup(rows, palette = PALETTE) {
  let rects = '';
  runs(rows, (x, y, length, char) => {
    rects += `<rect x="${x}" y="${y}" width="${length}" height="1" fill="${palette[char]}"/>`;
  });
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${rows[0].length} ${rows.length}" ` +
    `shape-rendering="crispEdges">${rects}</svg>`
  );
}

// A decorative inline SVG element (hidden from screen readers).
export function pixelArt(rows, className = '') {
  const holder = document.createElement('span');
  holder.className = `pixel-art ${className}`.trim();
  holder.setAttribute('aria-hidden', 'true');
  holder.innerHTML = pixelSvgMarkup(rows);
  return holder;
}

export function drawSprite(ctx, rows, x0, y0, palette = PALETTE) {
  runs(rows, (x, y, length, char) => {
    ctx.fillStyle = palette[char];
    ctx.fillRect(x0 + x, y0 + y, length, 1);
  });
}
