import { supabase } from '../supabase.js';
import { getUserId, loadMembers } from '../session.js';
import { announce } from '../lib/live.js';
import { ICON_HEART, ICON_DRUMSTICK, ICON_WATER, ICON_BED } from '../art/sprites.js';

// The little messages you can send with one tap. The first six are offered
// in the menu; the last two are sent by the bed button.
export const POKES = {
  poke: { label: 'Poke', says: (name) => `${name} poked you.`, icon: ICON_HEART },
  hug: { label: 'Hug', says: (name) => `${name} sent you a hug.`, icon: ICON_HEART },
  kiss: { label: 'Kiss', says: (name) => `${name} sent you a kiss.`, icon: ICON_HEART },
  miss_you: { label: 'Miss you', says: (name) => `${name} misses you.`, icon: ICON_HEART },
  eat: { label: 'Eat na', says: (name) => `${name} says: eat na!`, icon: ICON_DRUMSTICK },
  water: { label: 'Drink your water', says: (name) => `${name} says: drink your water!`, icon: ICON_WATER },
  good_night: { says: (name) => `${name} went to bed. Good night!`, icon: ICON_BED },
  good_morning: { says: (name) => `${name} is awake. Good morning!`, icon: ICON_BED },
};
export const POKE_MENU = ['poke', 'hug', 'kiss', 'miss_you', 'eat', 'water'];

// The other member: { id, name, avatar }.
export async function loadPartner() {
  const members = await loadMembers();
  for (const [id, member] of members) {
    if (id !== getUserId()) return { id, ...member };
  }
  return null;
}

export async function sendPoke(recipientId, kind = 'poke') {
  let { error } = await supabase.from('pokes').insert({ recipient_id: recipientId, kind });
  // Before kinds exist in the database, every poke is a plain poke.
  if (error && /kind/.test(error.message || '')) ({ error } = await supabase.from('pokes').insert({ recipient_id: recipientId }));
  if (error) throw error;
  announce('pokes');
}

// Pokes sent to me that I have not seen yet; they are marked as seen here.
export async function collectPokes() {
  const { data, error } = await supabase
    .from('pokes')
    .select('*')
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
