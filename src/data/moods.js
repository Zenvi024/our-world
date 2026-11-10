import { supabase } from '../supabase.js';
import { getUserId } from '../session.js';

// Mood hearts: how each of you is feeling, from 0 to 5 hearts.
export const MAX_HEARTS = 5;
export const LOW_HEARTS = 2; // at or below this, the other person is told

// A Map of member id -> { hearts, updated_at }.
export async function fetchMoods() {
  const { data, error } = await supabase.from('moods').select('user_id, hearts, updated_at');
  if (error) throw error;
  return new Map(data.map((row) => [row.user_id, row]));
}

export async function setMood(hearts) {
  const fields = { hearts, updated_at: new Date().toISOString() };
  const { data, error } = await supabase
    .from('moods')
    .update(fields)
    .eq('user_id', getUserId())
    .select('user_id');
  if (error) throw error;
  if (!data.length) {
    const { error: insertError } = await supabase.from('moods').insert(fields);
    if (insertError) throw insertError;
  }
}
