import { supabase } from '../supabase.js';
import { getUserId } from '../session.js';
import { announce } from '../lib/live.js';

// The two meters each of you sets for yourself, from 0 to 5: hearts (how you
// are feeling) and hunger (how well fed you are). The same row also remembers
// whether you have gone to bed.
export const MAX_METER = 5;
export const LOW_METER = 2; // at or below this, the other person is told

// A Map of member id -> { hearts, hunger, asleep_since, updated_at }.
export async function fetchMoods() {
  const { data, error } = await supabase.from('moods').select('*');
  if (error) throw error;
  return new Map(data.map((row) => [row.user_id, row]));
}

async function save(fields) {
  const { data, error } = await supabase.from('moods').update(fields).eq('user_id', getUserId()).select('user_id');
  if (error) throw error;
  if (!data.length) {
    // First time: hearts must have a value, so a full meter is assumed.
    const { error: insertError } = await supabase.from('moods').insert({ hearts: MAX_METER, ...fields });
    if (insertError) throw insertError;
  }
  announce('moods');
}

// Sets one of my meters: field is 'hearts' or 'hunger'.
export const setMeter = (field, value) => save({ [field]: value, updated_at: new Date().toISOString() });

// Going to bed, or waking up.
export const setAsleep = (asleep) => save({ asleep_since: asleep ? new Date().toISOString() : null });
