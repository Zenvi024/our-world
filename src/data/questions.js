import { supabase } from '../supabase.js';
import { getUserId } from '../session.js';
import { todayManila, parts, toDate } from '../lib/dates.js';
import { daysBetween, TOGETHER_SINCE } from '../lib/together.js';
import { announce } from '../lib/live.js';

// One question a day, the same for both of you. The other person's answer
// stays hidden until you have answered too.
const QUESTIONS = [
  'What made you smile today?',
  'What is one small thing I do that you love?',
  'If we could teleport anywhere for dinner tonight, where would we go?',
  'What song reminds you of us?',
  'What is your favorite memory of us from this year?',
  'What would our dream house have that no other house has?',
  'What is something you want us to try together soon?',
  'When did you first know you liked me?',
  'What is the best meal we have ever shared?',
  'What are you looking forward to this week?',
  'What is one thing that would make tomorrow easier for you?',
  'If we had a whole free day with no plans, how would we spend it?',
  'What is a tiny habit of mine that makes you laugh?',
  'What is something you are proud of yourself for lately?',
  'Which of our photos do you love most, and why?',
  'What would we name a pet we adopted tomorrow?',
  'What is a place nearby that you want to show me?',
  'What comfort food do you want right now?',
  'What is one thing you want to learn this year?',
  'What is the kindest thing someone did for you this week?',
  'What is your favorite way to be comforted on a hard day?',
  'What movie or show should we watch next?',
  'What is something I said that stuck with you?',
  'If our relationship were a Minecraft biome, which one would it be?',
  'What is the first thing we would build in a brand new world?',
  'What do you want our next date to be like?',
  'What is a little luxury you wish you had more often?',
  'What is one thing you want me to know today?',
  'What are three things you are grateful for right now?',
  'What is a tradition you want us to start?',
  'What trip would you take with me if money were no object?',
  'What is your favorite thing about our everyday routine?',
  'What do you want to be doing five years from now?',
  'What scares you a little that you still want to do?',
  'What is the funniest thing that has happened to us?',
  'What smell or taste takes you right back to a happy moment?',
  'What did you need more of this week: rest, fun, or quiet?',
  'What is something you want us to get better at together?',
  'Who in your life do you want me to know better?',
  'What would the perfect lazy Sunday with me look like?',
];

const dayBefore = (date, count) => {
  const { year, month, day } = parts(date);
  const earlier = new Date(Date.UTC(year, month - 1, day - count));
  return toDate(earlier.getUTCFullYear(), earlier.getUTCMonth() + 1, earlier.getUTCDate());
};

export const questionFor = (day) =>
  QUESTIONS[((daysBetween(TOGETHER_SINCE, day) % QUESTIONS.length) + QUESTIONS.length) % QUESTIONS.length];

// The last two weeks of answers I am allowed to see, grouped by day:
// [{ day, question, mine, theirs }], today first.
export async function fetchAnswers() {
  const today = todayManila();
  const { data, error } = await supabase
    .from('daily_answers')
    .select('day, user_id, answer')
    .gte('day', dayBefore(today, 13))
    .order('day', { ascending: false });
  if (error) throw error;
  const me = getUserId();
  const days = [];
  for (let i = 0; i < 14; i += 1) {
    const day = dayBefore(today, i);
    const rows = data.filter((row) => row.day === day);
    const mine = rows.find((row) => row.user_id === me)?.answer ?? null;
    if (i > 0 && mine === null) continue; // past days only show if you answered
    days.push({ day, question: questionFor(day), mine, theirs: rows.find((row) => row.user_id !== me)?.answer ?? null });
  }
  return days;
}

export async function saveAnswer(day, answer, isChange) {
  const result = isChange
    ? await supabase.from('daily_answers').update({ answer }).eq('day', day).eq('user_id', getUserId())
    : await supabase.from('daily_answers').insert({ day, answer });
  if (result.error) throw result.error;
  announce('question');
}
