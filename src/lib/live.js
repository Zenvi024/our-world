import { supabase } from '../supabase.js';
import { getUserId } from '../session.js';

// Live updates between the two of you, over a private channel only members
// can join. Nothing personal travels on it: one side says "something changed"
// (for example 'pokes' or 'ledger'), and the other side fetches the change
// the normal, protected way. The channel also shows who is online right now.
//
// If the channel cannot be joined, everything still works: the site falls
// back to checking once a minute.

const handlers = new Map(); // topic -> Set of callbacks ('*' hears every topic)
let channel = null;
let joined = false;
let online = new Set();

function fire(topic) {
  handlers.get(topic)?.forEach((handler) => handler(topic));
  handlers.get('*')?.forEach((handler) => handler(topic));
}

// Calls back when the other person changes something of this kind.
export function onLive(topic, handler) {
  if (!handlers.has(topic)) handlers.set(topic, new Set());
  handlers.get(topic).add(handler);
  return () => handlers.get(topic)?.delete(handler);
}

export async function startLive() {
  if (channel || !supabase || !getUserId()) return;
  try {
    await supabase.realtime.setAuth();
    channel = supabase.channel('our-little-world', {
      config: { private: true, broadcast: { self: false }, presence: { key: getUserId() } },
    });
    channel
      .on('broadcast', { event: 'changed' }, ({ payload }) => fire(payload?.what))
      .on('presence', { event: 'sync' }, () => {
        online = new Set(Object.keys(channel.presenceState()));
        fire('presence');
      })
      .subscribe((status) => {
        joined = status === 'SUBSCRIBED';
        if (joined) channel.track({ since: Date.now() });
      });
  } catch {
    channel = null; // live updates are a nicety; the once-a-minute check remains
  }
}

export function stopLive() {
  if (channel) supabase.removeChannel(channel);
  channel = null;
  joined = false;
  online = new Set();
}

// Tells the other person that something of this kind changed.
export function announce(what) {
  if (joined) channel.send({ type: 'broadcast', event: 'changed', payload: { what } });
}

export const isPartnerOnline = () => [...online].some((id) => id !== getUserId());
