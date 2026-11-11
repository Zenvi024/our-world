import { supabase } from '../supabase.js';
import { getUserId } from '../session.js';
import { announce } from '../lib/live.js';

// Happybara, the pet you raise together. The database remembers when it was
// last cared for; each need runs down from there, so it keeps living while
// the site is closed. All changes go through database functions, and the
// prices live in the database too (the pet_shop table).

// How long each need takes to run from full to empty, in hours.
export const NEEDS = {
  hunger: { since: 'fed_at', hours: 10, label: 'Hunger', action: 'feed' },
  thirst: { since: 'watered_at', hours: 6, label: 'Thirst', action: 'water' },
  fun: { since: 'played_at', hours: 14, label: 'Fun', action: 'play' },
  clean: { since: 'bathed_at', hours: 30, label: 'Clean', action: 'bathe' },
};
export const CARE_COINS = { feed: 2, water: 3, play: 5, bathe: 8 };

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

// The rooms of the house, in the order of the tabs.
export const ROOM_NAMES = { living: 'Living room', kitchen: 'Kitchen', bedroom: 'Bedroom', bathroom: 'Bathroom', garden: 'Garden' };
export const ROOM_TABS = { living: 'Living', kitchen: 'Kitchen', bedroom: 'Bedroom', bathroom: 'Bath', garden: 'Garden' };

// What everything in the shop is called. Prices and levels come from the database.
const WORDS = {
  food_pack: ['Basket of food', 'Three meals for the pantry.'],
  treat_watermelon: ['Watermelon slice', 'A juicy treat. A little love.'],
  treat_yuzu: ['Yuzu', 'A capybara favorite. More love.'],
  treat_cake: ['Strawberry cake', 'For special days. Lots of love.'],
  room_kitchen: ['Kitchen', 'A place for bowls, snacks, and tea.'],
  room_bedroom: ['Bedroom', 'A quiet room for proper sleep.'],
  room_bathroom: ['Bathroom', 'For long, warm soaks.'],
  room_garden: ['Garden', 'Fresh air and room to play.'],
  plant: ['Potted plant', 'A leafy corner.'],
  rug: ['Soft rug', 'Cozy under little feet.'],
  lamp: ['Warm lamp', 'A gentle glow at night.'],
  painting: ['Painting', 'Mountains for the wall.'],
  bookshelf: ['Bookshelf', 'Full of bedtime stories.'],
  gramophone: ['Gramophone', 'Plays the old songs.'],
  sofa: ['Sofa', 'Room for three.'],
  aquarium: ['Aquarium', 'Two fish to watch.'],
  piano: ['Little piano', 'For rainy afternoons.'],
  fruit_bowl: ['Fruit bowl', 'Always something sweet.'],
  herbs: ['Window herbs', 'Basil, mint, and luck.'],
  tea_set: ['Tea set', 'Tea for two.'],
  jars: ['Jam shelf', 'Five flavors.'],
  table: ['Kitchen table', 'Breakfast is served.'],
  stove: ['Stove', 'Something is simmering.'],
  fridge: ['Fridge', 'With a heart magnet.'],
  plush: ['Plush friend', 'A tiny capybara to hug.'],
  nightstand: ['Nightstand', 'With a little clock.'],
  star_lights: ['Star lights', 'Twinkling along the wall.'],
  toy_chest: ['Toy chest', 'Never quite closes.'],
  bed: ['Little bed', 'For proper naps.'],
  moon_lamp: ['Moon lamp', 'A night light.'],
  wardrobe: ['Wardrobe', 'For all those hats.'],
  duck: ['Rubber duck', 'Squeak.'],
  bath_mat: ['Bath mat', 'No slipping.'],
  towels: ['Towels', 'Warm and fluffy.'],
  mirror: ['Mirror', 'Who is that handsome capybara?'],
  yuzu: ['Bath yuzu', 'They float in the tub.'],
  tub: ['Wooden tub', 'A hot soak, capybara style.'],
  flowers: ['Flower bed', 'Six kinds in bloom.'],
  birdhouse: ['Birdhouse', 'A bluebird moved in.'],
  picnic: ['Picnic blanket', 'With a full basket.'],
  lily_patch: ['Lilies of the valley', 'Jay’s favorite.'],
  lantern: ['Stone lantern', 'Lights up at night.'],
  swing: ['Garden swing', 'Built for two.'],
  pond: ['Pond', 'With a lily pad and a fish.'],
  sakura: ['Cherry tree', 'Always in bloom.'],
  wall_mint: ['Mint wallpaper', 'Fresh and calm.'],
  wall_pink: ['Pink wallpaper', 'Soft and sweet.'],
  wall_sky: ['Sky wallpaper', 'With little clouds.'],
  wall_wood: ['Wood paneling', 'Like a cabin.'],
  wall_stars: ['Starry wallpaper', 'A night sky indoors.'],
  floor_dark: ['Dark wood floor', 'Rich and warm.'],
  floor_tile: ['Checkered tiles', 'Clean and bright.'],
  floor_carpet: ['Pink carpet', 'Soft everywhere.'],
  floor_tatami: ['Tatami mats', 'Smells like summer.'],
  hat_leaf: ['Leaf', 'Simple and lucky.'],
  hat_orange: ['Orange', 'The classic.'],
  hat_blossom: ['Cherry blossom', 'A little spring.'],
  hat_lily: ['Lily of the valley', 'Tiny white bells.'],
  hat_bow: ['Red bow', 'Very dapper.'],
  hat_party: ['Party hat', 'Every day is a party.'],
  hat_strawberry: ['Strawberry', 'Sweet on top.'],
  hat_beanie: ['Beanie', 'For chilly mornings.'],
  hat_straw: ['Straw hat', 'Garden ready.'],
  hat_chef: ['Chef’s hat', 'Head of the kitchen.'],
  hat_frog: ['Frog hat', 'Ribbit.'],
  hat_santa: ['Santa hat', 'Ho, ho, ho.'],
  hat_grad: ['Graduation cap', 'Top of the class.'],
  hat_wizard: ['Wizard hat', 'A little magic.'],
  hat_halo: ['Halo', 'A perfect angel.'],
  hat_crown: ['Golden crown', 'Royalty.'],
  acc_blush: ['Rosy cheeks', 'Always blushing.'],
  acc_lei: ['Flower garland', 'Island days.'],
  acc_bell: ['Bell collar', 'Jingle, jingle.'],
  acc_bowtie: ['Bow tie', 'Dressed for dinner.'],
  acc_bandana: ['Bandana', 'Ready for adventure.'],
  acc_scarf: ['Scarf', 'Hand-knitted, surely.'],
  acc_glasses: ['Glasses', 'Studious.'],
  acc_sunglasses: ['Sunglasses', 'Too cool.'],
};

export const itemName = (key) => WORDS[key]?.[0] ?? 'Something';

// Everything about the pet:
// { pet, items: Set of owned keys, log, shop: [{ key, kind, room, price, minLevel, amount, name, about }],
//   styles: Map room -> { wall, floor }, focus: Map user id -> started_at }.
export async function fetchPet() {
  const [pet, items, log, shop, rooms, focus] = await Promise.all([
    supabase.from('pet').select('*').eq('id', 1).single(),
    supabase.from('pet_items').select('item_key'),
    supabase.from('pet_log').select('user_id, action, created_at').order('created_at', { ascending: false }).limit(40),
    supabase.from('pet_shop').select('*').order('sort_order'),
    supabase.from('pet_rooms').select('*'),
    supabase.from('pet_focus').select('*'),
  ]);
  if (pet.error) throw pet.error;
  if (shop.error) throw shop.error;
  return {
    pet: pet.data,
    items: new Set((items.data ?? []).map((row) => row.item_key)),
    log: log.data ?? [],
    shop: shop.data
      .filter((row) => WORDS[row.item_key])
      .map((row) => ({
        key: row.item_key,
        kind: row.kind,
        room: row.room,
        price: row.price,
        minLevel: row.min_level,
        amount: row.amount,
        name: WORDS[row.item_key][0],
        about: WORDS[row.item_key][1],
      })),
    styles: new Map((rooms.data ?? []).map((row) => [row.room_key, { wall: row.wall, floor: row.floor }])),
    focus: new Map((focus.data ?? []).map((row) => [row.user_id, row.started_at])),
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
// slot is 'hat' or 'accessory'; item may be null to take it off.
export const dressPet = (slot, item) => call('pet_dress', { p_slot: slot, p_item: item });
export const styleRoom = (room, wall, floor) => call('pet_style', { p_room: room, p_wall: wall, p_floor: floor });
export const renamePet = (name) => call('pet_rename', { p_name: name });
// 5 coins the first time each of you visits each day; 0 after that.
export const dailyGift = () => call('pet_daily');

// ---------- The focus timer ----------
export const FOCUS_MINUTES = 25;
export const FOCUS_MS = FOCUS_MINUTES * 60_000;
export const FOCUS_COINS = 8;

export const startFocus = () => call('pet_focus_start');
export const cancelFocus = () => call('pet_focus_cancel');
// Returns the coins earned (0 once the day's six paid sessions are done).
export const finishFocus = () => call('pet_focus_finish');

// When my running session started, or null.
export async function myFocusStart() {
  const { data } = await supabase.from('pet_focus').select('started_at').eq('user_id', getUserId()).maybeSingle();
  return data?.started_at ?? null;
}
