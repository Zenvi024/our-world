import { supabase } from '../supabase.js';
import { getUserId } from '../session.js';
import { todayManila, parts, toDate } from '../lib/dates.js';
import { announce } from '../lib/live.js';

const dayBefore = (date) => {
  const { year, month, day } = parts(date);
  const previous = new Date(Date.UTC(year, month - 1, day - 1));
  return toDate(previous.getUTCFullYear(), previous.getUTCMonth() + 1, previous.getUTCDate());
};

// Notes that I visited today (once per day).
export async function recordVisit() {
  const { error } = await supabase.from('visits').insert({ day: todayManila() });
  if (error && error.code !== '23505') throw error;
  if (!error) announce('visits');
}

// The campfire burns on days you both visit. Returns whether it is lit today
// and how many days in a row it has been lit.
export async function campfireState() {
  const today = todayManila();
  let since = today;
  for (let i = 0; i < 120; i += 1) since = dayBefore(since);
  const { data, error } = await supabase.from('visits').select('user_id, day').gte('day', since);
  if (error) throw error;
  const me = getUserId();
  const mine = new Set(data.filter((row) => row.user_id === me).map((row) => row.day));
  const theirs = new Set(data.filter((row) => row.user_id !== me).map((row) => row.day));
  const both = (day) => mine.has(day) && theirs.has(day);
  const lit = both(today);
  let streak = 0;
  // Yesterday's fire still counts toward the streak until today is over.
  for (let day = lit ? today : dayBefore(today); both(day); day = dayBefore(day)) streak += 1;
  return { lit, streak };
}
