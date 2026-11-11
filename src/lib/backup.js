import { supabase } from '../supabase.js';
import { todayManila } from './dates.js';
import { signedUrls } from '../data/photos.js';

// Backups you can keep on your own computer: one file with all the words and
// numbers, and ZIP files with the photos.

function download(blob, name) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

async function everything(table, columns = '*') {
  const rows = [];
  for (let from = 0; from < 100_000; from += 1000) {
    const { data, error } = await supabase.from(table).select(columns).range(from, from + 999);
    if (error) throw error;
    rows.push(...data);
    if (data.length < 1000) break;
  }
  return rows;
}

const TABLES = ['profiles', 'memories', 'photos', 'goals', 'goal_steps', 'ledger_entries', 'lists', 'list_items', 'letter_comments', 'daily_answers', 'splash_texts', 'reviews', 'review_ratings', 'review_photos'];

// Saves every memory, quest, ledger line, list, letter, and answer as one file.
export async function downloadData() {
  const backup = { made_on: todayManila(), site: 'Our Little World' };
  for (const table of TABLES) {
    backup[table] = await everything(table).catch(() => []); // a table that is not set up yet is simply empty
  }
  const letters = await supabase.rpc('get_letters');
  backup.letters = letters.data ?? [];
  download(new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' }), `our-little-world-${todayManila()}.json`);
  return Object.fromEntries(Object.entries(backup).filter(([, value]) => Array.isArray(value)).map(([key, value]) => [key, value.length]));
}

// ----- A minimal ZIP writer (stored, not compressed: the photos already are) -----
const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(bytes) {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i += 1) crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function zip(files) {
  const encoder = new TextEncoder();
  const parts = [];
  const directory = [];
  let offset = 0;
  for (const file of files) {
    const name = encoder.encode(file.name);
    const crc = crc32(file.bytes);
    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true);
    local.setUint16(4, 20, true);
    local.setUint16(6, 0x0800, true); // names are UTF-8
    local.setUint32(14, crc, true);
    local.setUint32(18, file.bytes.length, true);
    local.setUint32(22, file.bytes.length, true);
    local.setUint16(26, name.length, true);
    parts.push(local, name, file.bytes);

    const central = new DataView(new ArrayBuffer(46));
    central.setUint32(0, 0x02014b50, true);
    central.setUint16(4, 20, true);
    central.setUint16(6, 20, true);
    central.setUint16(8, 0x0800, true);
    central.setUint32(16, crc, true);
    central.setUint32(20, file.bytes.length, true);
    central.setUint32(24, file.bytes.length, true);
    central.setUint16(28, name.length, true);
    central.setUint32(42, offset, true);
    directory.push(central, name);
    offset += 30 + name.length + file.bytes.length;
  }
  const directorySize = directory.reduce((sum, part) => sum + part.byteLength, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, files.length, true);
  end.setUint16(10, files.length, true);
  end.setUint32(12, directorySize, true);
  end.setUint32(16, offset, true);
  return new Blob([...parts, ...directory, end], { type: 'application/zip' });
}

const PHOTOS_PER_ZIP = 150; // keeps each file small enough for a phone

// Saves the full-size photos as ZIP files, in folders by date.
// onProgress(done, total) is called as photos are fetched.
export async function downloadPhotos(onProgress) {
  const { data: memories, error } = await supabase.from('memories').select('id, memory_date').limit(10_000);
  if (error) throw error;
  const dateOf = new Map(memories.map((memory) => [memory.id, memory.memory_date]));
  const photos = (await everything('photos', 'id, memory_id, storage_path')).sort((a, b) =>
    String(dateOf.get(a.memory_id)).localeCompare(String(dateOf.get(b.memory_id))),
  );
  let done = 0;
  let missed = 0;
  onProgress?.(0, photos.length);
  for (let start = 0; start < photos.length; start += PHOTOS_PER_ZIP) {
    const batch = photos.slice(start, start + PHOTOS_PER_ZIP);
    const urls = await signedUrls(batch.map((photo) => photo.storage_path));
    const files = [];
    for (const photo of batch) {
      try {
        const response = await fetch(urls.get(photo.storage_path));
        if (!response.ok) throw new Error('missing');
        const extension = photo.storage_path.split('.').pop();
        files.push({ name: `${dateOf.get(photo.memory_id) ?? 'undated'}/${photo.id}.${extension}`, bytes: new Uint8Array(await response.arrayBuffer()) });
      } catch {
        missed += 1;
      }
      done += 1;
      onProgress?.(done, photos.length);
    }
    if (files.length) download(zip(files), `our-little-world-photos-${todayManila()}-part-${start / PHOTOS_PER_ZIP + 1}.zip`);
  }
  return { saved: photos.length - missed, missed };
}
