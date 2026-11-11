import { supabase } from '../supabase.js';
import { getUserId } from '../session.js';

// Goals are the shared bucket list. They are kept in the order the two of
// you choose (sort_order), with reached goals moved to their own list.
export async function fetchGoals() {
  const { data, error } = await supabase
    .from('goals')
    .select('id, title, note, target_from, target_to, sort_order, done_at, done_by, created_by, created_at')
    .order('sort_order')
    .order('created_at');
  if (error) throw error;
  return data;
}

export async function addGoal(fields, sortOrder) {
  const { error } = await supabase.from('goals').insert({ ...fields, sort_order: sortOrder });
  if (error) throw error;
}

export async function updateGoal(id, fields) {
  const { error } = await supabase.from('goals').update(fields).eq('id', id);
  if (error) throw error;
}

export async function removeGoal(id) {
  const { error } = await supabase.from('goals').delete().eq('id', id);
  if (error) throw error;
}

export const setGoalDone = (id, done) =>
  updateGoal(id, done ? { done_at: new Date().toISOString(), done_by: getUserId() } : { done_at: null, done_by: null });

// Saves a new order by numbering the goals 0, 1, 2, ... as given.
export async function saveGoalOrder(goals) {
  for (const [index, goal] of goals.entries()) {
    if (goal.sort_order !== index) {
      await updateGoal(goal.id, { sort_order: index });
      goal.sort_order = index;
    }
  }
}
