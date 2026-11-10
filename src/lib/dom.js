// A tiny helper for building DOM nodes: h('button', { class: 'btn', onclick }, 'Play')
export function h(tag, props, ...children) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(props || {})) {
    if (value == null || value === false) continue;
    if (key === 'class') el.className = value;
    else if (key === 'html') el.innerHTML = value;
    else if (key.startsWith('on') && typeof value === 'function') {
      el.addEventListener(key.slice(2).toLowerCase(), value);
    } else if (value === true) el.setAttribute(key, '');
    else el.setAttribute(key, value);
  }
  el.append(...children.flat().filter((child) => child != null && child !== false));
  return el;
}

// Turns a Supabase or network error into a sentence a person can act on.
export function friendlyError(error) {
  const message = String(error?.message || error || '');
  if (/invalid login credentials/i.test(message)) {
    return 'That email or password is not right. Please try again.';
  }
  if (/failed to fetch|networkerror|load failed/i.test(message)) {
    return 'Could not reach the world. Check your connection and try again.';
  }
  if (/different from the old password/i.test(message)) {
    return 'The new password must be different from the current one.';
  }
  if (/password should be at least/i.test(message)) {
    return 'That password is too short. Please use at least 8 characters.';
  }
  if (/could not find the table|schema cache|does not exist/i.test(message)) {
    return 'This part of the world is not set up yet. The database setup still needs to be run.';
  }
  return 'Something went wrong. Please try again.';
}

// Opens the device's photo picker and calls back with the chosen files.
export function pickPhotos(onPicked) {
  const input = h('input', {
    type: 'file',
    accept: 'image/*,.heic,.heif',
    multiple: true,
    hidden: true,
    onchange: () => {
      const files = [...input.files];
      input.remove();
      if (files.length) onPicked(files);
    },
  });
  document.body.append(input);
  input.click();
}

export const plural = (count, word) => `${count} ${word}${count === 1 ? '' : 's'}`;
