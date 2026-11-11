import { supabase } from '../supabase.js';
import { getUserId } from '../session.js';

// The two meters each of you sets for yourself, from 0 to 5: hearts (how you
// are feeling) and hunger (how well fed you are).
export const MAX_METER = 5;
export const LOW_METER = 2; // at or below this, the other person is told

// A Map of member id -> { hearts, hunger, updated_at }.
export async function fetchMoods() {
  let { data, error } = await supabase.from('moods').select('user_id, hearts, hunger, updated_at');
  if (error) {
    // Before the hunger column exists, fall back to hearts alone.
    ({ data, error } = await supabase.from('moods').select('user_id, hearts, updated_at'));
  }
  if (error) throw error;
  return new Map(data.map((row) => [row.user_id, row]));
}

// Sets one of my meters: field is 'hearts' or 'hunger'.
export async function setMeter(field, value) {
  const fields = { [field]: value, updated_at: new Date().toISOString() };
  const { data, error } = await supabase
    .from('moods')
    .update(fields)
    .eq('user_id', getUserId())
    .select('user_id');
  if (error) throw error;
  if (!data.length) {
    // First time: hearts must have a value, so a full meter is assumed.
    const { error: insertError } = await supabase.from('moods').insert({ hearts: MAX_METER, ...fields });
    if (insertError) throw insertError;
  }
}
