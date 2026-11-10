import { supabase } from '../supabase.js';

// The ledger tracks shared spending in pesos.
//   expense    = someone paid for something (shared equally, or owed in full)
//   settlement = someone handed the other money to pay a debt back
export async function fetchLedger() {
  const { data, error } = await supabase
    .from('ledger_entries')
    .select('id, kind, description, amount, paid_by, split, entry_date, created_at')
    .order('entry_date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(500);
  if (error) throw error;
  return data.map((entry) => ({ ...entry, amount: Number(entry.amount) }));
}

export async function addLedgerEntry(entry) {
  const { error } = await supabase.from('ledger_entries').insert(entry);
  if (error) throw error;
}

export async function removeLedgerEntry(id) {
  const { error } = await supabase.from('ledger_entries').delete().eq('id', id);
  if (error) throw error;
}

// How much the other person owes "me", in centavos to avoid rounding drift.
// Positive: they owe me. Negative: I owe them.
export function balanceFor(entries, me) {
  let centavos = 0;
  for (const entry of entries) {
    const amount = Math.round(entry.amount * 100);
    const owed = entry.kind === 'settlement' || entry.split === 'full' ? amount : Math.round(amount / 2);
    centavos += entry.paid_by === me ? owed : -owed;
  }
  return centavos / 100;
}

export const pesos = (amount) =>
  new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(amount);
