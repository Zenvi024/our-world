// A small original dirt texture, generated once and used as the background
// behind the in-world screens.
const COLORS = ['#8a5a37', '#7b4f30', '#6b4329', '#9b6a42', '#7b4f30', '#6b4329'];

export function installDirtTile() {
  const size = 16;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  let seed = 20241113;
  const next = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) | 0;
    return (seed >>> 0) / 4294967296;
  };
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      ctx.fillStyle = COLORS[Math.floor(next() * COLORS.length)];
      ctx.fillRect(x, y, 1, 1);
    }
  }
  document.documentElement.style.setProperty('--tile-dirt', `url(${canvas.toDataURL()})`);
}
