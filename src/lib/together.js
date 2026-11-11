import { todayManila, parts, toDate } from './dates.js';

// Together since November 13, 2024. The level is the number of full years;
// the bar fills from one anniversary to the next.
export const TOGETHER_SINCE = '2024-11-13';

const dayNumber = (date) => {
  const { year, month, day } = parts(date);
  return Date.UTC(year, month - 1, day) / 86_400_000;
};

export const daysBetween = (from, to) => Math.round(dayNumber(to) - dayNumber(from));

// Which monthsary a date is (1 for December 13, 2024; 12 for the first
// anniversary), or 0 if it is not the 13th or is before you were together.
export function monthsaryNumber(date) {
  const start = parts(TOGETHER_SINCE);
  const day = parts(date);
  if (day.day !== start.day) return 0;
  return Math.max(0, (day.year - start.year) * 12 + (day.month - start.month));
}

export function togetherStats(today = todayManila()) {
  const start = parts(TOGETHER_SINCE);
  const now = parts(today);
  const anniversaryIn = (year) => toDate(year, start.month, start.day);
  const reachedThisYear = today >= anniversaryIn(now.year);
  const last = anniversaryIn(reachedThisYear ? now.year : now.year - 1);
  const next = anniversaryIn(reachedThisYear ? now.year + 1 : now.year);
  return {
    level: Math.max(0, parts(last).year - start.year),
    days: daysBetween(TOGETHER_SINCE, today),
    progress: daysBetween(last, today) / daysBetween(last, next),
    next,
    daysUntilNext: daysBetween(today, next),
    isAnniversary: today === last && today !== TOGETHER_SINCE,
  };
}
