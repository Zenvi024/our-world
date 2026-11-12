// The two people of the storybook, drawn as small pixel characters. One is
// a little shorter with a round face and round silver glasses; the other is
// taller with swept-up hair and dark glasses. Everything about them can be
// posed: arms, mouth, eyes, clothes.

function rect(ctx, color, x, y, w, h) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), w, h);
}

function rows(ctx, sprite, x0, y0, colors) {
  sprite.forEach((row, y) => {
    for (let x = 0; x < row.length; x += 1) {
      const char = row[x];
      if (char !== '.') rect(ctx, colors[char], x0 + x, y0 + y, 1, 1);
    }
  });
}

const HAIR = '#1f1a1c';
const HAIR_SHINE = '#3a3136';

// h hair, H hair shine, s skin, d skin shade, g glasses
const LOOKS = {
  // The shorter one: a round face, a soft fringe, round silver glasses,
  // and a small mole under one eye.
  a: {
    head: [
      '.......hhhhhhhhhhh.......',
      '.....hhhhhhhhhhhhhhh.....',
      '....hhhhHHHhhhhhhhhhh....',
      '...hhhHHHhhhhhhhhhhhhh...',
      '..hhhhhhhhhhhhhhhhhhhhh..',
      '..hhhhhhhhhhhhhhhhhhhhh..',
      '.hhhhhhhhhhhhhhhhhhhhhhh.',
      '.hhhhhhhsshhhhhhhhhhhhhh.',
      '.hhhhsssssssshhhhssshhhh.',
      '.hhhsssssssssssssssssshh.',
      '.hhssssssssssssssssssshh.',
      'sshssgggsssssssssgggsshss',
      'ssssgsssgsssssssgsssgssss',
      'ssssgsssgGGGGGGGgsssgssss',
      'ssssgsssgsssssssgsssgssss',
      '.ssssgggsssssssssgggssss.',
      '.sssssssssssssssssssssss.',
      '.sssssssssssssssssssssss.',
      '..sssssssssssssssssssss..',
      '..dsssssssssssssssssssd..',
      '...dsssssssssssssssssd...',
      '....ddsssssssssssssdd....',
      '......dddssssssddd.......',
    ],
    skin: '#eebd93',
    shade: '#dba57c',
    frame: '#9aa6b5',
    bridge: '#b9c2ce',
    eyes: [[6, 13], [18, 13]],
    mole: [5, 17],
    mouth: [12, 19],
    blush: [[2, 17], [20, 17]],
    torso: 17,
    torsoH: 15,
    legs: 9,
  },
  // The taller one: a longer face, hair swept up and over, dark glasses.
  b: {
    head: [
      '........hhhhhhhhh......',
      '......hhhhhhhhhhhhh....',
      '....hhhhhHHHhhhhhhhh...',
      '...hhhhhHHHhhhhhhhhhh..',
      '..hhhhhhhhhhhhhhhhhhhh.',
      '.hhhhhhhhhhhhhhhhhhhhh.',
      '.hhhhhhhhhhhhhhhhhhhhh.',
      '.hhhhhhssshhhhhhhhhhhh.',
      '.hhhhsssssssshhhhhhhhh.',
      '.hhhssssssssssssshhhhh.',
      '.hhsssssssssssssssshhh.',
      '.hsssssssssssssssssshh.',
      'sssgggggsssssssgggggsss',
      'sssgsssgsssssssgsssgsss',
      'sssgsssgGGGGGGGgsssgsss',
      'sssgggggsssssssgggggsss',
      '.sssssssssssssssssssss.',
      '.sssssssssssssssssssss.',
      '.sssssssssssssssssssss.',
      '..sssssssssssssssssss..',
      '..dsssssssssssssssssd..',
      '...dsssssssssssssssd...',
      '....dsssssssssssssd....',
      '.....ddsssssssssdd.....',
      '.......dddsssddd.......',
    ],
    skin: '#e6b086',
    shade: '#cf9a70',
    frame: '#332d31',
    bridge: '#4a4348',
    eyes: [[5, 13], [17, 13]],
    mouth: [11, 20],
    blush: [[2, 18], [18, 18]],
    torso: 16,
    torsoH: 17,
    legs: 11,
  },
};

export const personHeight = (who) => LOOKS[who].head.length + 1 + LOOKS[who].torsoH + LOOKS[who].legs + 2;

// Draws one person with their feet centered at (cx, footY).
//   who:    'a' (shorter) or 'b' (taller)
//   pose:   'down' | 'up' | 'wave' | 'hold' | 'reach-left' | 'reach-right' | 'point-left' | 'point-right'
//   mouth:  'smile' | 'laugh' | 'flat' | 'o' | 'sad'
//   eyes:   'open' | 'closed' | 'happy'
//   shirt, jacket (worn open over the shirt), pants, shoes: colors
//   gown:   a long graduation gown color
//   sit:    seated (no legs are drawn; whatever they sit on hides them)
//   blush, queasy (a green face), frame (for blinking), bob (pixels to lift)
export function drawPerson(ctx, who, cx, footY, options = {}) {
  const look = LOOKS[who];
  const {
    pose = 'down',
    mouth = 'smile',
    eyes = 'open',
    shirt = '#ffffff',
    jacket = null,
    pants = '#2b2f3a',
    shoes = '#1f1f24',
    gown = null,
    sit = false,
    blush = false,
    queasy = false,
    frame = 0,
    bob = 0,
    lanyard = null,
  } = options;
  const skin = queasy ? '#c9d49a' : look.skin;
  const shade = queasy ? '#aebb7f' : look.shade;
  const headW = look.head[0].length;
  const headH = look.head.length;
  const legH = sit ? 0 : look.legs + 2;
  const torsoTop = footY - legH - look.torsoH - bob;
  const torsoX = cx - Math.floor(look.torso / 2);
  const headX = cx - Math.floor(headW / 2);
  const headY = torsoTop - 1 - headH;
  const top = jacket ?? gown ?? shirt;
  const sleeve = jacket ?? gown ?? shirt;

  // Legs and shoes.
  if (!sit) {
    const legY = footY - legH;
    if (gown) {
      rect(ctx, gown, torsoX - 1, legY, look.torso + 2, look.legs - 2);
      rect(ctx, pants, torsoX + 1, legY + look.legs - 2, 6, 2);
      rect(ctx, pants, torsoX + look.torso - 7, legY + look.legs - 2, 6, 2);
    } else {
      rect(ctx, pants, torsoX + 1, legY, 7, look.legs);
      rect(ctx, pants, torsoX + look.torso - 8, legY, 7, look.legs);
    }
    rect(ctx, shoes, torsoX, footY - 2, 8, 2);
    rect(ctx, shoes, torsoX + look.torso - 8, footY - 2, 8, 2);
  }

  // Arms behind the body for most poses.
  const armY = torsoTop + 1;
  const leftX = torsoX - 4;
  const rightX = torsoX + look.torso;
  const arm = (x, y, w, h) => rect(ctx, sleeve, x, y, w, h);
  const hand = (x, y) => rect(ctx, skin, x, y, 4, 4);
  const down = (x) => {
    arm(x, armY, 4, 11);
    hand(x, armY + 11);
  };
  const raised = (x) => {
    arm(x, armY - 9, 4, 11);
    hand(x, armY - 13);
  };
  const out = (x, dir) => {
    // An arm stretched sideways (around a shoulder, or pointing).
    const from = dir < 0 ? x - 9 : x;
    arm(from, armY + 1, 13, 4);
    hand(dir < 0 ? from - 4 : from + 13, armY + 1);
  };
  if (pose === 'up') {
    raised(leftX);
    raised(rightX);
  } else if (pose === 'wave') {
    down(leftX);
    const sway = Math.floor(frame / 3) % 2;
    arm(rightX, armY - 8, 4, 10);
    hand(rightX + (sway ? 2 : -1), armY - 12);
  } else if (pose === 'reach-left' || pose === 'point-left') {
    out(leftX, -1);
    down(rightX);
  } else if (pose === 'reach-right' || pose === 'point-right') {
    down(leftX);
    out(rightX, 1);
  } else if (pose !== 'hold') {
    down(leftX);
    down(rightX);
  }

  // Torso.
  rect(ctx, top, torsoX, torsoTop, look.torso, look.torsoH);
  if (jacket) {
    const mid = torsoX + Math.floor(look.torso / 2) - 3;
    rect(ctx, shirt, mid, torsoTop, 6, look.torsoH);
  }
  if (gown) {
    rect(ctx, '#ffffff', torsoX + Math.floor(look.torso / 2) - 4, torsoTop, 8, 3);
    rect(ctx, '#f2f2f2', torsoX + Math.floor(look.torso / 2) - 1, torsoTop + 3, 2, 8);
    rect(ctx, '#f2c14e', torsoX + 2, torsoTop + 3, 4, 4); // the school's seal
  }
  if (lanyard) {
    const mid = torsoX + Math.floor(look.torso / 2);
    rect(ctx, lanyard, mid - 3, torsoTop, 1, 9);
    rect(ctx, lanyard, mid + 2, torsoTop, 1, 9);
    rect(ctx, '#f4f4f4', mid - 3, torsoTop + 9, 6, 5);
  }
  // Neck.
  rect(ctx, shade, cx - 3, torsoTop - 1, 6, 1);

  // Hands held in front.
  if (pose === 'hold') {
    arm(leftX, armY, 4, 8);
    arm(rightX, armY, 4, 8);
    arm(leftX + 3, armY + 6, 5, 4);
    arm(rightX - 4, armY + 6, 5, 4);
    rect(ctx, skin, cx - 4, armY + 6, 8, 4);
  }

  // Head.
  rows(ctx, look.head, headX, headY, { h: HAIR, H: HAIR_SHINE, s: skin, d: shade, g: look.frame, G: look.bridge });
  // Eyes: two pixels tall; they blink now and then.
  const blink = eyes === 'open' && frame % 46 > 43;
  for (const [ex, ey] of look.eyes) {
    if (eyes === 'open' && !blink) {
      rect(ctx, '#1b1718', headX + ex, headY + ey - 1, 1, 2);
      rect(ctx, '#1b1718', headX + ex + 1, headY + ey - 1, 1, 2);
    } else if (eyes === 'happy') {
      // Smiling eyes: a little arch.
      rect(ctx, '#1b1718', headX + ex - 1, headY + ey, 1, 1);
      rect(ctx, '#1b1718', headX + ex, headY + ey - 1, 2, 1);
      rect(ctx, '#1b1718', headX + ex + 2, headY + ey, 1, 1);
    } else rect(ctx, '#1b1718', headX + ex - 1, headY + ey, 4, 1);
  }
  if (look.mole) rect(ctx, '#7a5236', headX + look.mole[0], headY + look.mole[1], 1, 1);
  if (blush || mouth === 'laugh') {
    for (const [bx, by] of look.blush) rect(ctx, '#f29a9a', headX + bx, headY + by, 3, 2);
  }
  const [mx, my] = look.mouth;
  const lip = '#8a3b3b';
  if (mouth === 'smile') {
    rect(ctx, lip, headX + mx - 2, headY + my, 5, 1);
    rect(ctx, lip, headX + mx - 3, headY + my - 1, 1, 1);
    rect(ctx, lip, headX + mx + 3, headY + my - 1, 1, 1);
  } else if (mouth === 'laugh') {
    rect(ctx, lip, headX + mx - 3, headY + my - 2, 7, 4);
    rect(ctx, '#ffffff', headX + mx - 2, headY + my - 2, 5, 1);
    rect(ctx, '#e07a7a', headX + mx - 1, headY + my, 3, 2);
  } else if (mouth === 'o') {
    rect(ctx, lip, headX + mx - 1, headY + my - 2, 3, 3);
  } else if (mouth === 'sad') {
    rect(ctx, lip, headX + mx - 2, headY + my - 1, 5, 1);
    rect(ctx, lip, headX + mx - 3, headY + my, 1, 1);
    rect(ctx, lip, headX + mx + 3, headY + my, 1, 1);
  } else {
    rect(ctx, lip, headX + mx - 2, headY + my, 5, 1);
  }
  return { headX, headY, headW, torsoTop, torsoX, handY: armY + 6 };
}
