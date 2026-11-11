// Calendar dates are plain 'YYYY-MM-DD' strings, always meaning a day in
// Manila. Date math is done in UTC so no device time zone can shift a day.

const MANILA = 'Asia/Manila';
const pad = (n) => String(n).padStart(2, '0');

export function todayManila() {
  // The Canadian English format happens to be YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: MANILA,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

export function parts(date) {
  const [year, month, day] = date.split('-').map(Number);
  return { year, month, day };
}

export const toDate = (year, month, day) => `${year}-${pad(month)}-${pad(day)}`;

const asUtc = (date) => {
  const { year, month, day } = parts(date);
  return new Date(Date.UTC(year, month - 1, day));
};

export const daysInMonth = (year, month) => new Date(Date.UTC(year, month, 0)).getUTCDate();

// Monday = 0 ... Sunday = 6
export const weekdayIndex = (date) => (asUtc(date).getUTCDay() + 6) % 7;

export function addMonths(year, month, delta) {
  const index = year * 12 + (month - 1) + delta;
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
}

const format = (date, options) =>
  new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', ...options }).format(asUtc(date));

// "November 2026"
export const monthLabel = (year, month) =>
  format(toDate(year, month, 1), { month: 'long', year: 'numeric' });

// "Friday, November 13, 2026"
export const longDate = (date) =>
  format(date, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

// "November 13"
export const monthDay = (date) => format(date, { month: 'long', day: 'numeric' });

export const MONTH_NAMES = Array.from({ length: 12 }, (_, i) =>
  format(toDate(2024, i + 1, 1), { month: 'long' }),
);

export const isValidDate = (value) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return false;
  const { year, month, day } = parts(value);
  return month >= 1 && month <= 12 && day >= 1 && day <= daysInMonth(year, month);
};

// The anniversary is November 13, every year.
export const isAnniversary = (date) => date.endsWith('-11-13');

// The same month and day in other years (skipping February 29 where it does not exist).
export function sameDayInOtherYears(date, fromYear, toYear) {
  const { year, month, day } = parts(date);
  const dates = [];
  for (let y = fromYear; y <= toYear; y += 1) {
    if (y !== year && day <= daysInMonth(y, month)) dates.push(toDate(y, month, day));
  }
  return dates;
}

// The hour of the day in Manila, from 0 to 23.
export const manilaHour = () =>
  Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Manila', hour: 'numeric', hour12: false }).format(new Date())) % 24;
