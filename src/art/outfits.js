// The capybara and everything it can wear. Used by the title scene (small
// sprites) and by Happybara's room (the same sprites at twice the size).

export const CAPYBARA_COLORS = {
  C: '#f6e6a6', // cream coat
  c: '#e2cc80', // coat shade
  S: '#b08556', // snout
  N: '#7d5a36', // nose
  E: '#a37a4f', // ears
  P: '#d2b06e', // paws
  F: '#a37a4f', // feet
  k: '#2b2a26', // eyes
  T: '#7cc4ee', // a tear
};

export const CAPYBARA_BODY = [
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

// The little one: Happybara as seen on the title screen.
export const BABY_BODY = [
  'E.CCCCC.E',
  '.CCCCCCC.',
  'CkCSSSCkC',
  'CCSSNSSCC',
  'CCCSSSCCC',
  'CPCCCCCPC',
  'cCCCCCCCc',
  '.cCCCCCc.',
  '.FF...FF.',
];

// Hats are 13 pixels wide, like the body, and stay within the middle nine
// columns so they also fit the little one. `sink` is how many of a hat's
// bottom rows overlap the top of the head (a beanie is pulled down; an
// orange just balances on top).
export const HATS = {
  hat_orange: { rows: ['......g......', '.....OoO.....', '.....OOO.....'], colors: { O: '#f28c1e', o: '#ffb648', g: '#46952f' } },
  hat_blossom: { rows: ['......p......', '.....pwp.....', '......p......'], colors: { p: '#f7a8c9', w: '#fff3a6' } },
  hat_bow: { rows: ['...rr...rr...', '....rrRrr....'], colors: { r: '#e2574c', R: '#b5372f' } },
  hat_crown: { rows: ['...y.y.y.y...', '...yyyryyy...'], colors: { y: '#ffd83d', r: '#e2574c' } },
  hat_leaf: { rows: ['.....gg......', '......gG.....', '......g......'], colors: { g: '#46952f', G: '#6cc24a' } },
  hat_lily: { rows: ['......g......', '.....wgw.....', '....w.g.w....'], colors: { g: '#46952f', w: '#ffffff' } },
  hat_party: {
    rows: ['......y......', '......p......', '.....pbp.....', '.....bpb.....', '....pbpbp....'],
    colors: { y: '#ffd83d', p: '#f28cb4', b: '#5aa9e6' },
  },
  hat_strawberry: {
    rows: ['.....ggg.....', '....rrrrr....', '....ryrry....', '.....rrr.....'],
    colors: { g: '#46952f', r: '#e2574c', y: '#ffe9a3' },
  },
  hat_beanie: {
    rows: ['......w......', '....bbbbb....', '...bbbbbbb...', '...wwwwwww...'],
    colors: { b: '#5d8fc9', w: '#ffffff' },
    sink: 1,
  },
  hat_straw: {
    rows: ['....sssss....', '....rrrrr....', '..sssssssss..'],
    colors: { s: '#e9cf8a', r: '#e2574c' },
    sink: 1,
  },
  hat_chef: {
    rows: ['....wwwww....', '...wwwwwww...', '...wwwwwww...', '....wwwww....', '....wsssw....'],
    colors: { w: '#ffffff', s: '#d5dbe3' },
    sink: 1,
  },
  hat_frog: {
    rows: ['...ww...ww...', '...kw...wk...', '...ggggggg...', '...gGGGGGg...'],
    colors: { w: '#ffffff', k: '#2b2a26', g: '#6cc24a', G: '#46952f' },
    sink: 1,
  },
  hat_santa: {
    rows: ['.......rrw...', '.....rrrr....', '....rrrrr....', '...wwwwwww...'],
    colors: { r: '#d63a30', w: '#ffffff' },
    sink: 1,
  },
  hat_grad: { rows: ['..kkkkkkkkk..', '....kkkkk.y..'], colors: { k: '#2b2a26', y: '#ffd83d' }, sink: 1 },
  hat_wizard: {
    rows: ['......v......', '.....vv......', '.....vyv.....', '....vvvvv....', '..vvvvvvvvv..'],
    colors: { v: '#7c55b8', y: '#ffd83d' },
    sink: 1,
  },
  hat_halo: { rows: ['....yyyyy....', '...y.....y...', '....yyyyy....', '.............'], colors: { y: '#ffe36b' } },
};

// Accessories are drawn over the body: { row number: pixels }. Each has a
// version for the full-size body and one for the little one.
export const ACCESSORIES = {
  acc_blush: {
    colors: { p: '#f79ab8' },
    body: { 5: '.pp.......pp.' },
    baby: { 3: 'p.......p' },
  },
  acc_lei: {
    colors: { p: '#f79ab8', y: '#ffd83d', w: '#ffffff' },
    body: { 8: '.pywpywpywpy.' },
    baby: { 5: 'pywpywpyw' },
  },
  acc_bell: {
    colors: { r: '#d63a30', y: '#ffd83d' },
    body: { 8: '.rrrrrrrrrrr.', 9: '......y......' },
    baby: { 5: 'rrrrrrrrr', 6: '....y....' },
  },
  acc_bowtie: {
    colors: { r: '#d63a30', R: '#8f2019' },
    body: { 8: '....rrRrr....', 9: '....r...r....' },
    baby: { 5: '..rrRrr..' },
  },
  acc_bandana: {
    colors: { b: '#3d6fd6', w: '#ffffff' },
    body: { 8: '.bbwbbbbbwbb.', 9: '...bbbwbbb...', 10: '.....bbb.....' },
    baby: { 5: 'bbwbbbwbb', 6: '...bbb...' },
  },
  acc_scarf: {
    colors: { r: '#d63a30', w: '#ffffff' },
    body: { 8: '.rrwrrwrrwrr.', 9: '........rr...', 10: '........rw...' },
    baby: { 5: 'rrwrrwrrw', 6: '......rr.' },
  },
  acc_glasses: {
    colors: { b: '#5a3a22' },
    body: { 3: '.bbb.....bbb.', 4: '.b.b.....b.b.', 5: '.bbb.....bbb.' },
    baby: { 1: 'bbb...bbb', 2: 'b.b...b.b', 3: 'bbb...bbb' },
  },
  acc_sunglasses: {
    colors: { k: '#1b1b1b', w: '#8a8f99' },
    body: { 4: '.kwkk...kwkk.', 5: '.kkkk...kkkk.' },
    baby: { 2: 'kwk...kwk' },
  },
};

// The hats that match the avatars people choose in Settings.
export const AVATAR_HATS = {
  orange: 'hat_orange',
  blossom: 'hat_blossom',
  lily: 'hat_lily',
  crown: 'hat_crown',
  bow: 'hat_bow',
  leaf: 'hat_leaf',
};

function rect(ctx, color, x, y, w, h) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
}

function drawRows(ctx, rows, x0, y0, scale, colors) {
  rows.forEach((row, y) => {
    [...row].forEach((char, x) => {
      if (char !== '.') rect(ctx, colors[char], x0 + x * scale, y0 + y * scale, scale, scale);
    });
  });
}

// How many rows a hat rises above the top of the head.
export function hatRise(hatKey) {
  const hat = HATS[hatKey];
  return hat ? hat.rows.length - (hat.sink ?? 0) : 0;
}

// Draws a capybara with its top-left corner (of the body, not the hat) at
// (x, y). Options: body rows (to change the face), hat and accessory keys,
// baby (the little sprite), and scale.
export function drawCapybara(ctx, x, y, { body, hat, accessory, baby = false, scale = 1 } = {}) {
  const rows = body ?? (baby ? BABY_BODY : CAPYBARA_BODY);
  drawRows(ctx, rows, x, y, scale, CAPYBARA_COLORS);

  const worn = ACCESSORIES[accessory];
  if (worn) {
    for (const [row, pixels] of Object.entries(baby ? worn.baby : worn.body)) {
      drawRows(ctx, [pixels], x, y + Number(row) * scale, scale, worn.colors);
    }
  }

  const top = HATS[hat];
  if (top) {
    // The little one wears the middle nine columns of each hat.
    const hatRows = baby ? top.rows.map((row) => row.slice(2, 11)) : top.rows;
    drawRows(ctx, hatRows, x, y - hatRise(hat) * scale, scale, top.colors);
  }
}
