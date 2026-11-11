import { supabase } from '../supabase.js';
import { removeFiles } from './photos.js';
import { announce } from '../lib/live.js';

// A memory is one entry on one date; it holds one or more photos.
const FIELDS =
  'id, memory_date, title, note, caption, featured, cover_photo_id, created_by, created_at, ' +
  'photos!photos_memory_id_fkey(id, memory_id, storage_path, thumb_path, taken_at, width, height, sort_order, created_at)';

const byOrder = (a, b) =>
  a.sort_order - b.sort_order || a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id);

function tidy(memory) {
  memory.photos = (memory.photos || []).sort(byOrder);
  return memory;
}

export async function fetchMemoriesBetween(from, to) {
  const { data, error } = await supabase
    .from('memories')
    .select(FIELDS)
    .gte('memory_date', from)
    .lte('memory_date', to)
    .order('created_at');
  if (error) throw error;
  return data.map(tidy);
}

export async function fetchMemoriesOn(dates) {
  if (!dates.length) return [];
  const { data, error } = await supabase
    .from('memories')
    .select(FIELDS)
    .in('memory_date', dates)
    .order('created_at');
  if (error) throw error;
  return data.map(tidy);
}

export async function createMemory({ memory_date, title = null, note = null }) {
  const { data, error } = await supabase
    .from('memories')
    .insert({ memory_date, title, note })
    .select(FIELDS)
    .single();
  if (error) throw error;
  announce('memories');
  return tidy(data);
}

export async function updateMemory(id, fields) {
  const { error } = await supabase.from('memories').update(fields).eq('id', id);
  if (error) throw error;
  announce('memories');
}

export async function deleteMemory(memory) {
  await removeFiles(memory.photos);
  const { error } = await supabase.from('memories').delete().eq('id', memory.id);
  if (error) throw error;
  announce('memories');
}

// Every photo on a day, across its memories, in display order.
export const photosOf = (memories) => memories.flatMap((memory) => memory.photos);

// The photo shown in the calendar slot: the chosen cover if there is one,
// otherwise the first photo of the day.
export function coverOf(memories) {
  const photos = photosOf(memories);
  const chosen = memories.map((memory) => memory.cover_photo_id).filter(Boolean);
  return photos.find((photo) => chosen.includes(photo.id)) ?? photos[0] ?? null;
}

// Makes one photo the cover for its whole day.
export async function chooseCover(memories, photo) {
  for (const memory of memories) {
    const wanted = memory.id === photo.memory_id ? photo.id : null;
    if (memory.cover_photo_id !== wanted) {
      await updateMemory(memory.id, { cover_photo_id: wanted });
    }
  }
}

// Groups a list of memories into a Map of date -> memories.
export function groupByDate(memories) {
  const days = new Map();
  for (const memory of memories) {
    if (!days.has(memory.memory_date)) days.set(memory.memory_date, []);
    days.get(memory.memory_date).push(memory);
  }
  return days;
}

// The memories marked as favorites, newest first.
export async function fetchFavorites() {
  const { data, error } = await supabase
    .from('memories')
    .select(FIELDS)
    .eq('featured', true)
    .order('memory_date', { ascending: false })
    .limit(200);
  if (error) throw error;
  return data.map(tidy);
}

// Memories whose title, note, or caption contains the words, newest first.
export async function searchMemories(words) {
  // Characters that would confuse the search filter are dropped.
  const safe = words.replace(/[%_,()*\\"']/g, ' ').trim();
  if (!safe) return [];
  const pattern = `%${safe.split(/\s+/).join('%')}%`;
  const { data, error } = await supabase
    .from('memories')
    .select(FIELDS)
    .or(`title.ilike.${pattern},note.ilike.${pattern},caption.ilike.${pattern}`)
    .order('memory_date', { ascending: false })
    .limit(60);
  if (error) throw error;
  return data.map(tidy);
}

// A random day that has a memory, or null if there are none yet.
export async function randomMemoryDate() {
  const { data, error } = await supabase.from('memories').select('memory_date').limit(3000);
  if (error) throw error;
  const days = [...new Set(data.map((row) => row.memory_date))];
  return days.length ? days[Math.floor(Math.random() * days.length)] : null;
}
