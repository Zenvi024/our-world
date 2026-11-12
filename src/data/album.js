import { supabase } from '../supabase.js';
import { getUserId } from '../session.js';
import { announce } from '../lib/live.js';
import { putFile, removeFiles } from './photos.js';

// The anniversary album: a storybook written by one of you for the other.
// The database lets only its author change it, and shows the other person
// nothing until it is published.

// Where each page's story happens: the sky and season behind the book.
export const PAGE_WORLDS = {
  cover: { phase: 'dawn', season: 'spring' },
  classroom: { phase: 'day', season: 'summer' },
  strength: { phase: 'dawn', season: 'spring' },
  pride: { phase: 'night', season: 'summer' },
  study: { phase: 'night', season: 'autumn' },
  bouquet: { phase: 'day', season: 'spring' },
  samepage: { phase: 'dusk', season: 'autumn' },
  ferriswheel: { phase: 'night', season: 'autumn' },
  home: { phase: 'day', season: 'spring' },
  grab: { phase: 'day', season: 'summer' },
  storm: { phase: 'dusk', season: 'autumn' },
  graduation: { phase: 'day', season: 'summer' },
  lawschool: { phase: 'night', season: 'autumn' },
  dinner: { phase: 'dusk', season: 'winter' },
  baguio: { phase: 'night', season: 'winter' },
  fireworks: { phase: 'night', season: 'winter', fireworks: true },
  blank: { phase: 'dawn', season: 'spring', fireworks: true },
};

// A name for each picture, shown only to the author while editing.
export const SCENE_NAMES = {
  cover: 'The cover',
  classroom: 'The first day',
  strength: 'The strongest person I know',
  pride: 'Our first photo',
  study: 'Best friends',
  bouquet: 'The bouquet',
  samepage: 'The same page',
  ferriswheel: 'The Ferris wheel',
  home: 'Ordinary days',
  grab: 'Lost in a Grab',
  storm: 'The hard part',
  graduation: 'Graduation',
  lawschool: 'Law school',
  dinner: 'Dinner with your parents',
  baguio: 'Baguio',
  fireworks: 'Fireworks',
  blank: 'The next chapter',
};

// Whether there is an album yet, who wrote it, and whether it has been given.
// Returns null if the album is not set up in the database.
export async function fetchAlbumCover() {
  const { data, error } = await supabase.from('album').select('author, published').eq('id', 1).maybeSingle();
  if (error || !data) return null;
  return { published: data.published, isAuthor: data.author === getUserId() };
}

// The pages, in order. (Before it is published, only the author gets any.)
export async function fetchAlbumPages() {
  const { data, error } = await supabase.from('album_pages').select('*').order('position');
  if (error) throw error;
  return data;
}

// fields: any of { date_label, body, hidden }.
export async function saveAlbumPage(id, fields) {
  const { error } = await supabase.from('album_pages').update({ ...fields, updated_at: new Date().toISOString() }).eq('id', id);
  if (error) throw error;
}

// Puts a real photo behind a page's picture (see imagePipeline.prepareImage).
export async function setAlbumPhoto(page, prepared) {
  const name = crypto.randomUUID();
  const extension = prepared.full.type === 'image/webp' ? 'webp' : 'jpg';
  const fields = { photo_path: `album/${page.id}/${name}.${extension}`, photo_thumb: `album/${page.id}/${name}_thumb.${extension}` };
  await putFile(fields.photo_path, prepared.full);
  await putFile(fields.photo_thumb, prepared.thumb);
  await saveAlbumPage(page.id, fields);
  if (page.photo_path) await removeFiles([{ storage_path: page.photo_path, thumb_path: page.photo_thumb }]).catch(() => {});
  return fields;
}

export async function removeAlbumPhoto(page) {
  await saveAlbumPage(page.id, { photo_path: null, photo_thumb: null });
  await removeFiles([{ storage_path: page.photo_path, thumb_path: page.photo_thumb }]).catch(() => {});
}

// Gives the album to the other person (or takes it back to keep working).
export async function publishAlbum(published) {
  const { error } = await supabase.from('album').update({ published, updated_at: new Date().toISOString() }).eq('id', 1);
  if (error) throw error;
  announce('album');
}
