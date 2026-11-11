import { supabase } from '../supabase.js';
import { getUserId } from '../session.js';
import { todayManila, parts, toDate } from '../lib/dates.js';
import { showToast } from '../components/toast.js';
import { playAdvancement } from '../lib/sound.js';
import {
  ICON_HOME,
  ICON_HEART,
  ICON_CALENDAR,
  ICON_ADVANCEMENTS,
  ICON_LETTERS,
  ICON_MAP,
  LILY,
} from '../art/sprites.js';

// The built-in advancements. Each one is earned once per person.
export const ADVANCEMENTS = [
  { key: 'welcome_home', name: 'Welcome Home', how: 'Enter the world for the first time.', icon: ICON_HOME },
  { key: 'two_years_strong', name: 'Two Years Strong', how: 'Reach your second anniversary.', icon: ICON_HEART },
  { key: 'first_memory', name: 'First Memory', how: 'Add your first photo.', icon: LILY },
  { key: 'shutterbug', name: 'Shutterbug', how: 'Add 50 photos.', icon: ICON_ADVANCEMENTS },
  { key: 'every_month', name: 'Every Month', how: 'Keep a memory in all 12 months of the year.', icon: ICON_CALENDAR },
  { key: 'valentines', name: "Valentine's", how: 'Keep a memory on February 14.', icon: ICON_HEART },
  { key: 'pen_pal', name: 'Pen Pal', how: 'Send your first letter.', icon: ICON_LETTERS },
  { key: 'message_in_a_bottle', name: 'Message in a Bottle', how: 'Receive your first surprise letter.', icon: ICON_LETTERS },
];

export const goalKey = (goalId) => `goal:${goalId}`;

// A Map of advancement key -> when this person unlocked it.
export async function fetchUnlocks() {
  const { data, error } = await supabase
    .from('advancement_unlocks')
    .select('advancement_key, unlocked_at')
    .eq('user_id', getUserId());
  if (error) throw error;
  return new Map(data.map((row) => [row.advancement_key, row.unlocked_at]));
}

// Records an unlock. Returns true only the first time.
async function unlock(key) {
  const { error } = await supabase.from('advancement_unlocks').insert({ advancement_key: key });
  if (!error) return true;
  if (error.code === '23505') return false; // already unlocked
  throw error;
}

function celebrate(header, text, icon) {
  showToast({ header, text, icon, sound: playAdvancement });
}

async function monthsWithMemories() {
  const months = new Set();
  for (let from = 0; from < 10_000 && months.size < 12; from += 1000) {
    const { data, error } = await supabase
      .from('memories')
      .select('memory_date')
      .range(from, from + 999);
    if (error) throw error;
    data.forEach((row) => months.add(parts(row.memory_date).month));
    if (data.length < 1000) break;
  }
  return months.size;
}

const CHECKS = {
  welcome_home: async () => true,
  two_years_strong: async () => todayManila() >= '2026-11-13',
  first_memory: async (facts) => (await facts.photos()) >= 1,
  shutterbug: async (facts) => (await facts.photos()) >= 50,
  every_month: async () => (await monthsWithMemories()) === 12,
  valentines: async () => {
    const thisYear = parts(todayManila()).year;
    const dates = [];
    for (let year = 2000; year <= thisYear + 1; year += 1) dates.push(toDate(year, 2, 14));
    const { count, error } = await supabase
      .from('memories')
      .select('id', { count: 'exact', head: true })
      .in('memory_date', dates);
    if (error) throw error;
    return count > 0;
  },
  pen_pal: async (facts) => (await facts.letters()).some((letter) => letter.sender_id === getUserId()),
  message_in_a_bottle: async (facts) =>
    (await facts.letters()).some(
      (letter) => letter.recipient_id === getUserId() && letter.delivery_mode === 'surprise' && letter.delivered,
    ),
};

let checking = false;

// Looks for anything newly earned, records it, and shows a pop-up for each.
// Safe to call often; problems here never interrupt what the person is doing.
export async function checkAdvancements() {
  if (checking || !getUserId()) return;
  checking = true;
  try {
    const unlocked = await fetchUnlocks();
    let photoCount = null;
    let letters = null;
    const facts = {
      letters: async () => {
        if (!letters) {
          const { data, error } = await supabase.rpc('get_letters');
          if (error) throw error;
          letters = data;
        }
        return letters;
      },
      photos: async () => {
        if (photoCount === null) {
          const { count, error } = await supabase.from('photos').select('id', { count: 'exact', head: true });
          if (error) throw error;
          photoCount = count ?? 0;
        }
        return photoCount;
      },
    };
    for (const advancement of ADVANCEMENTS) {
      if (unlocked.has(advancement.key)) continue;
      if ((await CHECKS[advancement.key](facts)) && (await unlock(advancement.key))) {
        celebrate('Advancement Made!', advancement.name, advancement.icon);
      }
    }

    // Goals the two of you have reached: each person sees the pop-up once.
    const { data: reached, error } = await supabase
      .from('goals')
      .select('id, title')
      .not('done_at', 'is', null);
    if (error) throw error;
    for (const goal of reached) {
      if (!unlocked.has(goalKey(goal.id)) && (await unlock(goalKey(goal.id)))) {
        celebrate('Quest Complete!', goal.title, ICON_MAP);
      }
    }
  } catch {
    // Advancements are a nicety; they wait for the next check.
  } finally {
    checking = false;
  }
}
