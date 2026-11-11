// Phone and computer notifications for pokes, letters, and low meters.
// These can only appear while the site is open somewhere (a background tab,
// or the Home Screen app left open). A fully closed site cannot be reached
// without a push service, which this project does not run.

const KEY = 'our-world.notify';
let registration = null;

export const notificationsSupported = () => 'Notification' in window;

export function notificationsOn() {
  try {
    return notificationsSupported() && Notification.permission === 'granted' && localStorage.getItem(KEY) === 'on';
  } catch {
    return false;
  }
}

async function worker() {
  if (!registration && 'serviceWorker' in navigator) {
    registration = await navigator.serviceWorker.register('/sw.js').catch(() => null);
  }
  return registration;
}

// Must be called from a tap. Returns true if notifications are now on.
export async function setNotifications(on) {
  try {
    localStorage.setItem(KEY, on ? 'on' : 'off');
  } catch {
    // The choice just lasts for this visit.
  }
  if (!on || !notificationsSupported()) return false;
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return false;
  await worker();
  return true;
}

// Shows a system notification, but only when the site is not in front.
export async function systemNotify(title, body) {
  if (!document.hidden || !notificationsOn()) return;
  try {
    const options = { body, icon: '/icon-192.png', badge: '/icon-192.png', tag: title };
    const active = await worker();
    if (active?.showNotification) await active.showNotification(title, options);
    else new Notification(title, options);
  } catch {
    // Notifications are a nicety.
  }
}
