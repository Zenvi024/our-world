import { supabase } from '../supabase.js';
import { getUserId } from '../session.js';

// Heart reactions on goals and letters. Each person can leave one heart.
const TABLES = {
  goal: { table: 'goal_hearts', column: 'goal_id' },
  letter: { table: 'letter_hearts', column: 'letter_id' },
};

// A Map of item id -> list of the member ids who hearted it.
export async function fetchHearts(kind) {
  const { table, column } = TABLES[kind];
  const { data, error } = await supabase.from(table).select(`${column}, user_id`);
  if (error) throw error;
  const hearts = new Map();
  for (const row of data) {
    if (!hearts.has(row[column])) hearts.set(row[column], []);
    hearts.get(row[column]).push(row.user_id);
  }
  return hearts;
}

export async function setHeart(kind, id, on) {
  const { table, column } = TABLES[kind];
  const result = on
    ? await supabase.from(table).insert({ [column]: id })
    : await supabase.from(table).delete().eq(column, id).eq('user_id', getUserId());
  // "Already hearted" is fine.
  if (result.error && result.error.code !== '23505') throw result.error;
}
