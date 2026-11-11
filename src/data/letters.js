import { supabase } from '../supabase.js';
import { announce } from '../lib/live.js';

// Letters only ever go through these database functions, so an undelivered
// letter stays invisible to its recipient and a surprise letter's arrival
// time stays hidden from everyone.
export async function fetchLetters() {
  const { data, error } = await supabase.rpc('get_letters');
  if (error) throw error;
  return data;
}

//   mode 'now' | 'scheduled' (with deliverAt, an ISO time) | 'surprise' (with days)
// openWhen (optional) seals the letter with a label: "Open when you are sad".
export async function sendLetter({ title, body, mode, deliverAt = null, days = null, openWhen = null }) {
  const { data, error } = await supabase.rpc('send_letter', {
    p_title: title,
    p_body: body,
    p_delivery_mode: mode,
    p_deliver_at: deliverAt,
    p_surprise_days: days,
  });
  if (error) throw error;
  if (openWhen) {
    const { error: sealError } = await supabase.from('letter_seals').insert({ letter_id: data, open_when: openWhen });
    if (sealError) throw sealError;
  }
  announce('letters');
}

// A Map of letter id -> the "open when" label on its envelope.
export async function fetchSeals() {
  const { data, error } = await supabase.from('letter_seals').select('letter_id, open_when');
  if (error) throw error;
  return new Map(data.map((row) => [row.letter_id, row.open_when]));
}

export async function markLetterRead(id) {
  const { error } = await supabase.rpc('mark_letter_read', { p_letter_id: id });
  if (error) throw error;
  announce('letters');
}

// Returns true if the letter was cancelled, false if it had already arrived.
export async function cancelLetter(id) {
  const { data, error } = await supabase.rpc('cancel_letter', { p_letter_id: id });
  if (error) throw error;
  return data === true;
}

export async function fetchComments(letterId) {
  const { data, error } = await supabase
    .from('letter_comments')
    .select('id, author_id, body, created_at')
    .eq('letter_id', letterId)
    .order('created_at');
  if (error) throw error;
  return data;
}

export async function addComment(letterId, body) {
  const { error } = await supabase.from('letter_comments').insert({ letter_id: letterId, body });
  if (error) throw error;
  announce('letters');
}

export async function removeComment(id) {
  const { error } = await supabase.from('letter_comments').delete().eq('id', id);
  if (error) throw error;
}
