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
import { ICON_HEART, ICON_MAP, ICON_LETTERS, ICON_DRUMSTICK, LILY } from '../art/sprites.js';
import { fetchMoods, LOW_METER, MAX_METER } from '../data/moods.js';
import { fetchLetters } from '../data/letters.js';

const MOOD_KEY = 'our-world.mood-seen';
const LETTERS_KEY = 'our-world.letters-seen';

// Tells you, once per change, when your partner's hearts or hunger run low.
async function showPartnerMood() {
  try {
    const partner = await loadPartner();
    const mood = partner && (await fetchMoods()).get(partner.id);
    if (!mood) return;
    const lowHearts = mood.hearts != null && mood.hearts <= LOW_METER;
    const lowHunger = mood.hunger != null && mood.hunger <= LOW_METER;
    if (!lowHearts && !lowHunger) return;
    if (localStorage.getItem(MOOD_KEY) === mood.updated_at) return;
    localStorage.setItem(MOOD_KEY, mood.updated_at);
    if (lowHearts) {
      showToast({
        header: `${partner.name} could use some love`,
        text: `Feeling ${mood.hearts} of ${MAX_METER} hearts right now.`,
        icon: ICON_HEART,
        sound: playPoke,
      });
    }
    if (lowHunger) {
      showToast({
        header: `${partner.name} is hungry`,
        text: `Down to ${mood.hunger} of ${MAX_METER} on the hunger bar.`,
        icon: ICON_DRUMSTICK,
        sound: playPoke,
      });
    }
  } catch {
    // The meters may not be set up yet.
  }
}

// Announces letters that have arrived since the last look.
async function showNewLetters(onOpenLetters) {
  try {
    const me = getUserId();
    const unread = (await fetchLetters()).filter((letter) => letter.recipient_id === me && !letter.read_at);
    const seen = new Set(JSON.parse(localStorage.getItem(LETTERS_KEY) || '[]'));
    const fresh = unread.filter((letter) => !seen.has(letter.id));
    if (!fresh.length) return;
    localStorage.setItem(LETTERS_KEY, JSON.stringify(unread.map((letter) => letter.id)));
    showToast({
      header: fresh.length === 1 ? 'A letter arrived!' : `${fresh.length} letters arrived!`,
      text: fresh[0].title || 'Tap to read it.',
      icon: ICON_LETTERS,
      sound: playPoke,
      onClick: onOpenLetters,
    });
  } catch {
    // Letters wait for the next check.
  }
}

const openLetters = () => {
  window.location.hash = '#/letters';
};

const SEEN_KEY = 'our-world.notices-day';
const POKE_CHECK_MS = 60_000;

// Shows what has arrived since the last look: pokes, a partner whose hearts
// are low, and new letters.
export async function showNewPokes() {
  if (!getUserId()) return;
  try {
    const pokes = await collectPokes();
    if (pokes.length) {
      const partner = await loadPartner();
      const name = partner?.name ?? 'Your partner';
      showToast({
        header: 'Poke!',
        text: pokes.length === 1 ? `${name} poked you.` : `${name} poked you ${pokes.length} times.`,
        icon: ICON_HEART,
        sound: playPoke,
      });
    }
  } catch {
    // Pokes wait for the next check.
  }
  await showPartnerMood();
  await showNewLetters(openLetters);
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
    if (goal) showToast({ header: 'A quest is in season', text: goal.title, icon: ICON_MAP });
  } catch {
    // Goals may not be set up yet.
  }
}
