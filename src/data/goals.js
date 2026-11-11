import { supabase } from '../supabase.js';
import { getUserId } from '../session.js';
import { announce } from '../lib/live.js';

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
  announce('goals');
}

export async function updateGoal(id, fields) {
  const { error } = await supabase.from('goals').update(fields).eq('id', id);
  if (error) throw error;
  announce('goals');
}

export async function removeGoal(id) {
  const { error } = await supabase.from('goals').delete().eq('id', id);
  if (error) throw error;
  announce('goals');
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

// Steps are the checklist inside a quest. Returns a Map of goal id -> steps.
export async function fetchSteps() {
  const { data, error } = await supabase
    .from('goal_steps')
    .select('id, goal_id, body, done, created_at')
    .order('created_at');
  if (error) throw error;
  const steps = new Map();
  for (const step of data) {
    if (!steps.has(step.goal_id)) steps.set(step.goal_id, []);
    steps.get(step.goal_id).push(step);
  }
  return steps;
}

export async function addStep(goalId, body) {
  const { error } = await supabase.from('goal_steps').insert({ goal_id: goalId, body });
  if (error) throw error;
  announce('goals');
}

export async function setStepDone(id, done) {
  const { error } = await supabase.from('goal_steps').update({ done }).eq('id', id);
  if (error) throw error;
  announce('goals');
}

export async function removeStep(id) {
  const { error } = await supabase.from('goal_steps').delete().eq('id', id);
  if (error) throw error;
  announce('goals');
}
