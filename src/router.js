// Hash-based routing: '#/calendar' -> 'calendar', '' or '#/' -> ''.
export function currentRoute() {
  return window.location.hash.replace(/^#\/?/, '').split(/[/?]/)[0];
}

export function navigate(route) {
  window.location.hash = `#/${route}`;
}

export function onRouteChange(listener) {
  window.addEventListener('hashchange', listener);
}
