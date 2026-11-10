import { todayManila, parts, longDate, sameDayInOtherYears } from './dates.js';
import { togetherStats } from './together.js';
import { plural } from './dom.js';
import { getUserId } from '../session.js';
import { fetchMemoriesOn, groupByDate, coverOf } from '../data/memories.js';
import { signedUrls } from '../data/photos.js';
import { fetchGoals } from '../data/goals.js';
import { collectPokes, loadPartner } from '../data/pokes.js';
import { showToast } from '../components/toast.js';
import { playPoke } from './sound.js';
import { ICON_HEART, ICON_FLAG, LILY } from '../art/sprites.js';

const SEEN_KEY = 'our-world.notices-day';
const POKE_CHECK_MS = 60_000;

// Shows any pokes that arrived since the last look.
export async function showNewPokes() {
  if (!getUserId()) return;
  try {
    const pokes = await collectPokes();
    if (!pokes.length) return;
    const partner = await loadPartner();
    const name = partner?.name ?? 'Your partner';
    showToast({
      header: 'Poke!',
      text: pokes.length === 1 ? `${name} poked you.` : `${name} poked you ${pokes.length} times.`,
      icon: ICON_HEART,
      sound: playPoke,
    });
  } catch {
    // Pokes wait for the next check.
  }
}

let pokeTimer = null;

export function watchForPokes() {
  if (pokeTimer) return;
  pokeTimer = setInterval(() => {
    if (!document.hidden) showNewPokes();
  }, POKE_CHECK_MS);
}

// The gentle reminders on the Play screen. Pokes show every time; the rest
// show once a day on each device, so they stay a treat.
export async function showLandingNotices({ onOpenDay }) {
  if (!getUserId()) return;
  await showNewPokes();

  const today = todayManila();
  try {
    if (localStorage.getItem(SEEN_KEY) === today) return;
    localStorage.setItem(SEEN_KEY, today);
  } catch {
    // Without storage the reminders simply show on every visit.
  }

  const stats = togetherStats(today);
  if (stats.isAnniversary) {
    showToast({ header: 'Happy anniversary!', text: `${plural(stats.days, 'day')} together.`, icon: ICON_HEART });
  } else if (stats.daysUntilNext <= 30) {
    showToast({
      header: 'Coming up',
      text: `${plural(stats.daysUntilNext, 'day')} until your anniversary.`,
      icon: LILY,
    });
  }

  try {
    const memories = await fetchMemoriesOn(sameDayInOtherYears(today, 2000, parts(today).year));
    const days = [...groupByDate(memories)]
      .map(([date, list]) => ({ date, cover: coverOf(list) }))
      .filter((day) => day.cover)
      .sort((a, b) => b.date.localeCompare(a.date));
    if (days.length) {
      const day = days[0];
      const urls = await signedUrls([day.cover.thumb_path]);
      showToast({
        header: 'On this day',
        text: longDate(day.date),
        imageUrl: urls.get(day.cover.thumb_path),
        onClick: () => onOpenDay(day.date),
      });
    }
  } catch {
    // No reminder today.
  }

  try {
    const soon = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);
    const goal = (await fetchGoals()).find(
      (item) => !item.done_at && item.target_from && item.target_from <= soon && (!item.target_to || item.target_to >= today),
    );
    if (goal) showToast({ header: 'A goal is in season', text: goal.title, icon: ICON_FLAG });
  } catch {
    // Goals may not be set up yet.
  }
}
