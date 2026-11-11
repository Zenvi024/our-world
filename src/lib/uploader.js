import { fetchMemoriesOn, createMemory } from '../data/memories.js';
import { savePhoto } from '../data/photos.js';
import { playPop } from './sound.js';
import { announce } from './live.js';

const ATTEMPTS = 3;
const AT_ONCE = 2;
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Uploads a batch of picked photos.
//   items: [{ file, date, takenAt, memoryId? }]  (memoryId only when adding
//          to a specific memory; otherwise the day's first memory is used,
//          or a new one is made)
//   onProgress(finished, total) is called as photos finish or fail.
// Returns the items that could not be uploaded, so they can be retried.
export async function uploadBatch(items, { onProgress } = {}) {
  const { prepareImage } = await import('./imagePipeline.js');

  // Keeps the screen awake during long uploads, where the browser allows it.
  const wakeLock = await navigator.wakeLock?.request('screen').catch(() => null);

  // Oldest first, so photos land in the order they were taken.
  const queue = [...items].sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      String(a.takenAt || '').localeCompare(String(b.takenAt || '')) ||
      a.file.name.localeCompare(b.file.name),
  );

  // Find (or make) the memory for each day, and where its photos should continue.
  const dates = [...new Set(queue.map((item) => item.date))];
  const existing = await fetchMemoriesOn(dates);
  const nextOrder = new Map(); // memory id -> next sort_order
  const memoryForDate = new Map();
  for (const memory of existing) {
    nextOrder.set(memory.id, memory.photos.reduce((max, photo) => Math.max(max, photo.sort_order + 1), 0));
    if (!memoryForDate.has(memory.memory_date)) memoryForDate.set(memory.memory_date, memory.id);
  }
  for (const item of queue) {
    if (!item.memoryId) {
      if (!memoryForDate.has(item.date)) {
        const memory = await createMemory({ memory_date: item.date });
        memoryForDate.set(item.date, memory.id);
      }
      item.memoryId = memoryForDate.get(item.date);
    }
    item.photoId ??= crypto.randomUUID();
    item.sortOrder ??= nextOrder.get(item.memoryId) ?? 0;
    nextOrder.set(item.memoryId, Math.max(nextOrder.get(item.memoryId) ?? 0, item.sortOrder + 1));
  }

  const failed = [];
  let finished = 0;
  let cursor = 0;

  async function worker() {
    while (cursor < queue.length) {
      const item = queue[cursor];
      cursor += 1;
      let saved = false;
      for (let attempt = 1; attempt <= ATTEMPTS && !saved; attempt += 1) {
        try {
          // Converting and shrinking is done once and reused if a retry is needed.
          item.prepared ??= await prepareImage(item.file);
          await savePhoto({
            id: item.photoId,
            memoryId: item.memoryId,
            prepared: item.prepared,
            takenAt: item.takenAt ?? null,
            sortOrder: item.sortOrder,
          });
          saved = true;
          playPop();
          item.prepared = null; // free the memory
        } catch (error) {
          item.error = error;
          if (attempt < ATTEMPTS) await wait(800 * attempt);
        }
      }
      if (!saved) failed.push(item);
      finished += 1;
      onProgress?.(finished, queue.length);
    }
  }

  onProgress?.(0, queue.length);
  await Promise.all(Array.from({ length: Math.min(AT_ONCE, queue.length) }, worker));
  await wakeLock?.release().catch(() => {});
  if (failed.length < queue.length) announce('memories');
  return failed;
}
