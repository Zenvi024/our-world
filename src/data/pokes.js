import { supabase } from '../supabase.js';
import { getUserId, loadMemberNames } from '../session.js';

// The other member: { id, name }.
export async function loadPartner() {
  const names = await loadMemberNames();
  for (const [id, name] of names) {
    if (id !== getUserId()) return { id, name };
  }
  return null;
}

export async function sendPoke(recipientId) {
  const { error } = await supabase.from('pokes').insert({ recipient_id: recipientId });
  if (error) throw error;
}

// Pokes sent to me that I have not seen yet; they are marked as seen here.
export async function collectPokes() {
  const { data, error } = await supabase
    .from('pokes')
    .select('id, created_at')
    .eq('recipient_id', getUserId())
    .is('seen_at', null)
    .order('created_at');
  if (error) throw error;
  if (data.length) {
    const { error: seenError } = await supabase
      .from('pokes')
      .update({ seen_at: new Date().toISOString() })
      .in('id', data.map((poke) => poke.id));
    if (seenError) throw seenError;
  }
  return data;
}
