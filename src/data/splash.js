import { supabase } from '../supabase.js';

// Splash texts are the yellow lines on the title screen. They live in the
// database (members only) and are remembered on this device so the title
// screen can show them instantly.
const CACHE_KEY = 'our-world.splash';
const SIGNED_OUT_SPLASH = ['Made with love!'];
export const SPLASH_MAX_LENGTH = 40;

export function cachedSplash() {
  try {
    const lines = JSON.parse(localStorage.getItem(CACHE_KEY));
    if (Array.isArray(lines)) return lines;
  } catch {
    // Storage can be unavailable in private windows; fall through.
  }
  return SIGNED_OUT_SPLASH;
}

function remember(rows) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(rows.map((row) => row.body)));
  } catch {
    // Nothing to do if storage is unavailable.
  }
}

export function forgetSplash() {
  try {
    localStorage.removeItem(CACHE_KEY);
  } catch {
    // Nothing to do if storage is unavailable.
  }
}

export async function fetchSplash() {
  const { data, error } = await supabase
    .from('splash_texts')
    .select('id, body')
    .order('created_at');
  if (error) throw error;
  remember(data);
  return data;
}

export async function addSplash(body) {
  const { error } = await supabase.from('splash_texts').insert({ body });
  if (error) throw error;
  return fetchSplash();
}

export async function removeSplash(id) {
  const { error } = await supabase.from('splash_texts').delete().eq('id', id);
  if (error) throw error;
  return fetchSplash();
}
