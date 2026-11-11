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
