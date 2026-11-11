import { supabase } from '../supabase.js';
import { announce } from '../lib/live.js';

// Shared lists: groceries, a watchlist, places to eat. Each list holds items
// that either of you can tick off.
export async function fetchLists() {
  const { data, error } = await supabase
    .from('lists')
    .select('id, title, created_at, list_items(id, body, done, created_at)')
    .order('sort_order')
    .order('created_at');
  if (error) throw error;
  for (const list of data) {
    list.list_items.sort((a, b) => Number(a.done) - Number(b.done) || a.created_at.localeCompare(b.created_at));
  }
  return data;
}

async function change(run) {
  const { error } = await run;
  if (error) throw error;
  announce('lists');
}

export const addList = (title) => change(supabase.from('lists').insert({ title }));
export const removeList = (id) => change(supabase.from('lists').delete().eq('id', id));
export const addItem = (listId, body) => change(supabase.from('list_items').insert({ list_id: listId, body }));
export const setItemDone = (id, done) => change(supabase.from('list_items').update({ done }).eq('id', id));
export const removeItem = (id) => change(supabase.from('list_items').delete().eq('id', id));
