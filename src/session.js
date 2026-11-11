import { supabase } from './supabase.js';

let session = null;
let profile = null;
const listeners = new Set();

export const getSession = () => session;
export const getUserId = () => session?.user?.id ?? null;
export const getProfile = () => profile;

// Calls back whenever someone signs in or out.
export function onSessionChange(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function setSession(next) {
  const before = getUserId();
  session = next;
  if (getUserId() !== before) {
    profile = null;
    // Deferred so listeners never run inside Supabase's own auth callback.
    setTimeout(() => listeners.forEach((listener) => listener()), 0);
  }
}

export async function initSession() {
  if (!supabase) return;
  const { data } = await supabase.auth.getSession();
  session = data.session;
  supabase.auth.onAuthStateChange((_event, next) => setSession(next));
}

export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  setSession(data.session);
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
  setSession(null);
}

export async function changePassword(password) {
  const { error } = await supabase.auth.updateUser({ password });
  if (error) throw error;
}

// The signed-in member's profile row, or null if it does not exist yet.
export async function loadProfile() {
  if (profile) return profile;
  const { data, error } = await supabase
    .from('profiles')
    .select('id, display_name')
    .eq('id', getUserId())
    .maybeSingle();
  if (error) throw error;
  profile = data;
  return profile;
}

export async function saveDisplayName(displayName) {
  const { data, error } = await supabase
    .from('profiles')
    .update({ display_name: displayName })
    .eq('id', getUserId())
    .select('id, display_name')
    .single();
  if (error) throw error;
  profile = data;
  memberNames = null;
  return profile;
}

let memberNames = null;

// A Map of member id -> display name, for "Added by" labels.
export async function loadMemberNames() {
  if (!memberNames) {
    const { data, error } = await supabase.from('profiles').select('id, display_name');
    if (error) throw error;
    memberNames = new Map(data.map((row) => [row.id, row.display_name]));
  }
  return memberNames;
}
