import { todayManila, parts, longDate, sameDayInOtherYears } from './dates.js';
import { togetherStats } from './together.js';
import { plural } from './dom.js';
import { getUserId } from '../session.js';
import { fetchMemoriesOn, groupByDate, coverOf } from '../data/memories.js';
import { signedUrls } from '../data/photos.js';
import { fetchGoals } from '../data/goals.js';
import { collectPokes, loadPartner, POKES } from '../data/pokes.js';
import { fetchSeals } from '../data/letters.js';
import { fetchAnswers } from '../data/questions.js';
import { ICON_SIGN, ICON_EGG } from '../art/sprites.js';
import { supabase } from '../supabase.js';
import { NEEDS, needLevel } from '../data/pet.js';
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
        notify: true,
      });
    }
    if (lowHunger) {
      showToast({
        header: `${partner.name} is hungry`,
        text: `Down to ${mood.hunger} of ${MAX_METER} on the hunger bar.`,
        icon: ICON_DRUMSTICK,
        sound: playPoke,
        notify: true,
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
      notify: true,
      onClick: onOpenLetters,
    });
  } catch {
    // Letters wait for the next check.
  }
}

const PET_KEY = 'our-world.pet-told';
const PET_QUIET_MS = 4 * 3_600_000;
const PET_LOW = 20;
const PET_WORDS = { hunger: 'is hungry', thirst: 'is thirsty', fun: 'is bored', clean: 'needs a bath' };

// Tells you when Happybara needs something, at most once every few hours.
async function showPetNeeds() {
  try {
    if (window.location.hash === '#/pet') return;
    if (Date.now() - Number(localStorage.getItem(PET_KEY) || 0) < PET_QUIET_MS) return;
    const { data: pet } = await supabase.from('pet').select('*').eq('id', 1).maybeSingle();
    if (!pet) return;
    const lowest = Object.keys(NEEDS).sort((a, b) => needLevel(pet, a) - needLevel(pet, b))[0];
    if (needLevel(pet, lowest) >= PET_LOW) return;
    localStorage.setItem(PET_KEY, String(Date.now()));
    showToast({
      header: `${pet.name} ${PET_WORDS[lowest]}`,
      text: 'Tap to visit.',
      icon: ICON_EGG,
      onClick: () => {
        window.location.hash = '#/pet';
      },
    });
  } catch {
    // The pet may not have moved in yet.
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
      // One pop-up per poke, newest last; a long pile is summed up instead.
      const shown = pokes.length > 4 ? pokes.slice(-3) : pokes;
      if (shown.length < pokes.length) {
        showToast({ header: 'Thinking of you', text: `${name} sent you ${pokes.length} little things.`, icon: ICON_HEART, sound: playPoke, notify: true });
      }
      for (const poke of shown) {
        const kind = POKES[poke.kind] ?? POKES.poke;
        showToast({ header: kind.label ?? name, text: kind.says(name), icon: kind.icon, sound: playPoke, notify: true });
      }
    }
  } catch {
    // Pokes wait for the next check.
  }
  await showPartnerMood();
  await showNewLetters(openLetters);
  await showPetNeeds();
}

// When your own hearts run low, points you to a letter saved for such a moment.
export async function suggestOpenWhen() {
  try {
    const me = getUserId();
    const [letters, seals] = await Promise.all([fetchLetters(), fetchSeals()]);
    const waiting = letters.find((letter) => letter.recipient_id === me && !letter.read_at && seals.has(letter.id));
    if (!waiting) return;
    const partner = await loadPartner();
    showToast({
      header: 'A letter for this moment',
      text: `${partner?.name ?? 'Someone'} left you one to open when ${seals.get(waiting.id)}.`,
      icon: ICON_LETTERS,
      onClick: openLetters,
    });
  } catch {
    // Nothing to suggest.
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
    const todays = (await fetchAnswers())[0];
    if (todays && todays.mine === null) {
      showToast({
        header: 'Question of the day',
        text: todays.question,
        icon: ICON_SIGN,
        onClick: () => {
          window.location.hash = '#/question';
        },
      });
    }
  } catch {
    // Questions may not be set up yet.
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
