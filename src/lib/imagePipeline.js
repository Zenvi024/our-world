import imageCompression from 'browser-image-compression';
import exifr from 'exifr';

// Turns a picked file into what we store: a full image (long edge up to
// 1600 px) and a small thumbnail, both freshly re-encoded. Re-encoding also
// drops location and other metadata from the photo.

const FULL_EDGE = 1600;
const THUMB_EDGE = 320;
const HEIC_NAME = /\.(heic|heif)$/i;

export const isHeic = (file) => /image\/hei[cf]/i.test(file.type) || HEIC_NAME.test(file.name);
export const isImage = (file) => /^image\//.test(file.type) || isHeic(file);

const EXIF_DATE = /(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/;

// A last resort for HEIC files whose metadata the reader cannot follow:
// look for date stamps in the raw bytes and take the earliest (the capture;
// later ones are edits).
async function scanForDate(file) {
  const text = new TextDecoder('latin1').decode(await file.arrayBuffer());
  const stamps = text.match(new RegExp(`${EXIF_DATE.source}\\0`, 'g')) || [];
  return stamps.map((stamp) => stamp.slice(0, 19)).sort()[0] ?? '';
}

// When the photo was taken, read from the file before anything is re-encoded.
// The date is the camera's own wall-clock date, which is the day you remember.
export async function readCapture(file) {
  let raw = '';
  let offset = '';
  try {
    const tags = await exifr.parse(file, {
      pick: ['DateTimeOriginal', 'CreateDate', 'OffsetTimeOriginal'],
      reviveValues: false,
    });
    raw = String(tags?.DateTimeOriginal || tags?.CreateDate || '');
    offset = String(tags?.OffsetTimeOriginal || '');
  } catch {
    // Fall through to the checks below.
  }
  try {
    if (!EXIF_DATE.test(raw) && isHeic(file)) raw = await scanForDate(file);
  } catch {
    // No date; the person will be asked for one.
  }
  const match = EXIF_DATE.exec(raw);
  if (!match || Number(match[1]) < 1990 || Number(match[2]) > 12 || Number(match[3]) > 31) return null;
  const date = `${match[1]}-${match[2]}-${match[3]}`;
  // Manila time, when the camera did not record a time zone.
  const zone = /^[+-]\d{2}:\d{2}$/.test(offset) ? offset : '+08:00';
  return { date, takenAt: `${date}T${match[4]}:${match[5]}:${match[6]}${zone}` };
}

function loadImage(blob) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('This file could not be read as a photo.'));
    };
    image.src = url;
  });
}

let webpSupport;
// iPhone Safari cannot save WebP from a canvas, so it gets JPEG instead.
function outputType() {
  if (webpSupport === undefined) {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    webpSupport = canvas.toDataURL('image/webp').startsWith('data:image/webp');
  }
  return webpSupport ? 'image/webp' : 'image/jpeg';
}

// iPhone photos are often HEIC. Safari can open them directly; other
// browsers need them converted first (the converter is large, so it is
// only downloaded when it is actually needed).
async function readable(file) {
  if (!isHeic(file)) return file;
  const typed = file.type ? file : new File([file], file.name, { type: 'image/heic' });
  try {
    await loadImage(typed);
    return typed;
  } catch {
    const { default: heic2any } = await import('heic2any');
    const converted = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.92 });
    const blob = Array.isArray(converted) ? converted[0] : converted;
    return new File([blob], file.name.replace(HEIC_NAME, '.jpg'), { type: 'image/jpeg' });
  }
}

async function shrink(file, edge, quality, type) {
  const result = await imageCompression(file, {
    maxWidthOrHeight: edge,
    initialQuality: quality,
    fileType: type,
    maxSizeMB: edge === FULL_EDGE ? 1 : 0.15,
    useWebWorker: false,
  });
  // A browser that cannot write the requested type silently writes PNG.
  if (result.type !== type && type !== 'image/jpeg') return shrink(file, edge, quality, 'image/jpeg');
  return result;
}

export async function prepareImage(file) {
  const source = await readable(file);
  const type = outputType();
  const full = await shrink(source, FULL_EDGE, 0.8, type);
  const thumb = await shrink(full, THUMB_EDGE, 0.7, full.type);
  const image = await loadImage(full);
  return { full, thumb, width: image.naturalWidth, height: image.naturalHeight };
}
