import { supabase } from '../supabase.js';

const BUCKET = 'photos';
const URL_LIFETIME_SECONDS = 3600;

// Signed URLs are remembered for the session so each image is only signed once.
const signed = new Map(); // path -> { url, expires }

// Returns a Map of path -> temporary URL (or null if a file is missing).
export async function signedUrls(paths) {
  const now = Date.now();
  const missing = [...new Set(paths)].filter((path) => !(signed.get(path)?.expires > now + 60_000));
  for (let i = 0; i < missing.length; i += 200) {
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUrls(missing.slice(i, i + 200), URL_LIFETIME_SECONDS);
    if (error) throw error;
    for (const item of data) {
      if (item.signedUrl) {
        signed.set(item.path, { url: item.signedUrl, expires: now + URL_LIFETIME_SECONDS * 1000 });
      }
    }
  }
  return new Map(paths.map((path) => [path, signed.get(path)?.url ?? null]));
}

export async function putFile(path, blob) {
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, {
    contentType: blob.type,
    cacheControl: '31536000',
    upsert: true,
  });
  if (error) throw error;
}

// Stores one prepared photo (full image + thumbnail) and records it.
// The id is chosen up front so a retry overwrites the same files.
export async function savePhoto({ id, memoryId, prepared, takenAt, sortOrder }) {
  const extension = prepared.full.type === 'image/webp' ? 'webp' : 'jpg';
  const storagePath = `${memoryId}/${id}.${extension}`;
  const thumbPath = `${memoryId}/${id}_thumb.${extension}`;
  await putFile(storagePath, prepared.full);
  await putFile(thumbPath, prepared.thumb);
  const row = {
    id,
    memory_id: memoryId,
    storage_path: storagePath,
    thumb_path: thumbPath,
    taken_at: takenAt,
    width: prepared.width,
    height: prepared.height,
    sort_order: sortOrder,
  };
  let { error } = await supabase.from('photos').insert({ ...row, bytes: prepared.full.size + prepared.thumb.size });
  // Before sizes exist in the database, save the photo without one.
  if (error && /bytes/.test(error.message || '')) ({ error } = await supabase.from('photos').insert(row));
  // "Already exists" means an earlier attempt got through; that is a success.
  if (error && error.code !== '23505') throw error;
}

export async function removeFiles(photos) {
  const paths = photos.flatMap((photo) => [photo.storage_path, photo.thumb_path]);
  if (!paths.length) return;
  const { error } = await supabase.storage.from(BUCKET).remove(paths);
  if (error) throw error;
  paths.forEach((path) => signed.delete(path));
}

export async function deletePhoto(photo) {
  await removeFiles([photo]);
  const { error } = await supabase.from('photos').delete().eq('id', photo.id);
  if (error) throw error;
}

const TYPICAL_PHOTO_BYTES = 300_000; // for photos saved before sizes were recorded

// Roughly how much storage the photos use, in bytes.
export async function storageUsed() {
  let known = 0;
  let measured = 0;
  let total = 0;
  for (let from = 0; from < 50_000; from += 1000) {
    const { data, error } = await supabase.from('photos').select('*').range(from, from + 999);
    if (error) throw error;
    for (const photo of data) {
      total += 1;
      if (photo.bytes) {
        known += photo.bytes;
        measured += 1;
      }
    }
    if (data.length < 1000) break;
  }
  const typical = measured ? known / measured : TYPICAL_PHOTO_BYTES;
  // Photos on reviews count too (once that part of the database exists).
  const { data: extra } = await supabase.from('review_photos').select('bytes').limit(5000);
  const reviewBytes = (extra ?? []).reduce((sum, photo) => sum + (photo.bytes ?? TYPICAL_PHOTO_BYTES), 0);
  return { bytes: known + (total - measured) * typical + reviewBytes, photos: total + (extra?.length ?? 0) };
}
