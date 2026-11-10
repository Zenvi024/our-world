import { createClient } from '@supabase/supabase-js';

// Only the public URL and the anon/publishable key are used here.
// They come from Vercel's environment variables at build time.
const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isConfigured = Boolean(url && key);
export const supabase = isConfigured ? createClient(url, key) : null;
