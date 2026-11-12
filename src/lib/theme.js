// Night mode: a darker look for the whole site and a night sky on the Play
// screen. The choice is remembered on this device.
const KEY = 'our-world.night';
const listeners = new Set();

export const isNight = () => document.documentElement.dataset.theme === 'night';

function apply(on) {
  if (on) document.documentElement.dataset.theme = 'night';
  else delete document.documentElement.dataset.theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', on ? '#141a3a' : '#46952f');
}

export function setNight(on) {
  try {
    localStorage.setItem(KEY, on ? '1' : '0');
  } catch {
    // Without storage the choice lasts until the page is closed.
  }
  apply(on);
  listeners.forEach((listener) => listener(on));
}

// Calls back whenever night mode is switched. Returns a function that stops it.
export function onThemeChange(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function installTheme() {
  let on = false;
  try {
    on = localStorage.getItem(KEY) === '1';
  } catch {
    // Day mode it is.
  }
  apply(on);
}

// The season of the Play screen's scene, also remembered on this device.
const SEASON_KEY = 'our-world.season';
export const SEASON_NAMES = { spring: 'Spring', summer: 'Summer', autumn: 'Autumn', winter: 'Winter' };

export function getSeason() {
  try {
    const saved = localStorage.getItem(SEASON_KEY);
    if (saved in SEASON_NAMES) return saved;
  } catch {
    // Spring it is.
  }
  return 'spring';
}

export function setSeason(season) {
  try {
    localStorage.setItem(SEASON_KEY, season);
  } catch {
    // Without storage the choice lasts until the page is closed.
  }
}

// The season after this one, for a button that steps through them.
export function nextSeason(season) {
  const order = Object.keys(SEASON_NAMES);
  return order[(order.indexOf(season) + 1) % order.length];
}

// The weather over the Play screen: clear unless you choose otherwise.
const WEATHER_KEY = 'our-world.weather';
export const WEATHER_NAMES = { clear: 'Clear', rain: 'Rain', rainbow: 'Rainbow' };

export function getWeather() {
  try {
    const saved = localStorage.getItem(WEATHER_KEY);
    if (saved in WEATHER_NAMES) return saved;
  } catch {
    // Clear skies it is.
  }
  return 'clear';
}

export function setWeather(weather) {
  try {
    localStorage.setItem(WEATHER_KEY, weather);
  } catch {
    // Without storage the choice lasts until the page is closed.
  }
}

export function nextWeather(weather) {
  const order = Object.keys(WEATHER_NAMES);
  return order[(order.indexOf(weather) + 1) % order.length];
}
