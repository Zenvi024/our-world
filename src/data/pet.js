import { supabase } from '../supabase.js';
import { announce } from '../lib/live.js';

// Happybara, the pet you raise together. The database remembers when it was
// last cared for; each need runs down from there, so it keeps living while
// the site is closed. All changes go through database functions.

// How long each need takes to run from full to empty, in hours.
export const NEEDS = {
  hunger: { since: 'fed_at', hours: 10, label: 'Hunger', action: 'feed' },
  thirst: { since: 'watered_at', hours: 6, label: 'Thirst', action: 'water' },
  fun: { since: 'played_at', hours: 14, label: 'Fun', action: 'play' },
  clean: { since: 'bathed_at', hours: 30, label: 'Clean', action: 'bathe' },
};

// How full a need is right now, from 0 to 100.
export function needLevel(pet, need, now = Date.now()) {
  const hours = (now - new Date(pet[NEEDS[need].since]).getTime()) / 3_600_000;
  return Math.max(0, Math.min(100, 100 - (hours / NEEDS[need].hours) * 100));
}

// The pet's overall mood: 'happy', 'okay', or 'sad'.
export function petMood(pet, now = Date.now()) {
  const levels = Object.keys(NEEDS).map((need) => needLevel(pet, need, now));
  const lowest = Math.min(...levels);
  const average = levels.reduce((sum, level) => sum + level, 0) / levels.length;
  if (lowest < 15 || average < 35) return 'sad';
  return average >= 65 ? 'happy' : 'okay';
}

// One level for every 30 points of love.
export const LOVE_PER_LEVEL = 30;
export const petLevel = (pet) => Math.floor(pet.love / LOVE_PER_LEVEL) + 1;

// The shop. Prices are checked again by the database.
export const SHOP = [
  { key: 'food_pack', name: 'Basket of food', price: 8, about: 'Three meals for the pantry.', kind: 'food' },
  { key: 'plant', name: 'Potted plant', price: 25, about: 'A leafy corner.', kind: 'furniture' },
  { key: 'rug', name: 'Soft rug', price: 30, about: 'Cozy under little feet.', kind: 'furniture' },
  { key: 'lamp', name: 'Warm lamp', price: 35, about: 'A gentle glow.', kind: 'furniture' },
  { key: 'painting', name: 'Painting', price: 45, about: 'Mountains for the wall.', kind: 'furniture' },
  { key: 'bed', name: 'Little bed', price: 60, about: 'For proper naps.', kind: 'furniture' },
  { key: 'bookshelf', name: 'Bookshelf', price: 70, about: 'Full of bedtime stories.', kind: 'furniture' },
  { key: 'tub', name: 'Wooden tub', price: 90, about: 'A hot soak, capybara style.', kind: 'furniture' },
  { key: 'hat_orange', name: 'Orange', price: 20, about: 'The classic.', kind: 'hat' },
  { key: 'hat_blossom', name: 'Cherry blossom', price: 25, about: 'A little spring.', kind: 'hat' },
  { key: 'hat_bow', name: 'Red bow', price: 30, about: 'Very dapper.', kind: 'hat' },
  { key: 'hat_crown', name: 'Golden crown', price: 100, about: 'Royalty.', kind: 'hat' },
];

// Everything about the pet: { pet, items: Set of owned keys, log: recent care }.
export async function fetchPet() {
  const [pet, items, log] = await Promise.all([
    supabase.from('pet').select('*').eq('id', 1).single(),
    supabase.from('pet_items').select('item_key'),
    supabase.from('pet_log').select('user_id, action, created_at').order('created_at', { ascending: false }).limit(12),
  ]);
  if (pet.error) throw pet.error;
  return {
    pet: pet.data,
    items: new Set((items.data ?? []).map((row) => row.item_key)),
    log: log.data ?? [],
  };
}

async function call(name, args) {
  const { data, error } = await supabase.rpc(name, args);
  if (error) throw error;
  announce('pet');
  return data;
}

// Returns the coins earned (0 if it was not needed just now).
export const careForPet = (action) => call('pet_care', { p_action: action });
export const buyForPet = (item) => call('pet_buy', { p_item: item });
export const dressPet = (item) => call('pet_wear', { p_item: item });
export const renamePet = (name) => call('pet_rename', { p_name: name });
