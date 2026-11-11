import { pixelArt } from '../art/pixel.js';
import { AVATARS } from '../art/sprites.js';

export const AVATAR_NAMES = {
  orange: 'Orange',
  blossom: 'Cherry blossom',
  lily: 'Lily of the valley',
  crown: 'Crown',
  bow: 'Bow',
  leaf: 'Leaf',
};

export const avatarRows = (key) => AVATARS[key] ?? AVATARS.orange;

// A little capybara face for a member. Unknown or unset keys get the orange.
export const avatarArt = (key, className = '') => pixelArt(avatarRows(key), `avatar ${className}`.trim());
