import { supabase } from '../supabase.js';
import { getUserId } from '../session.js';
import { announce } from '../lib/live.js';
import { putFile, removeFiles } from './photos.js';

// Our Reviews: the cafés, restaurants, films, and places you have been to,
// each with a star rating and a few words from each of you, and photos.
export const CATEGORIES = {
  cafe: 'Café',
  restaurant: 'Restaurant',
  movie: 'Movie',
  show: 'Show',
  place: 'Place',
  other: 'Other',
};
export const MAX_STARS = 5;
export const MAX_PHOTOS = 6;
export const PRICES = ['', '₱', '₱₱', '₱₱₱'];
// Films and shows are watched again; everything else is gone to again.
export const againWords = (category) => (category === 'movie' || category === 'show' ? 'Would watch again' : 'Would go again');

const FULL = 'id, category, title, place, price, visited_on, created_at, review_ratings(user_id, stars, comment, again), review_photos(id, storage_path, thumb_path, created_at)';
const BASIC = 'id, category, title, place, visited_on, created_at, review_ratings(user_id, stars, comment)';

// Every review, newest visit first: { reviews, extras }. Each review has
// `ratings` (Map user id -> { stars, comment, again }), `photos`, and
// `average` (of whoever has rated it; null if nobody has). `extras` is false
// until photos, prices, and "again" are set up in the database.
export async function fetchReviews() {
  const query = (columns) =>
    supabase.from('reviews').select(columns).order('visited_on', { ascending: false }).order('created_at', { ascending: false });
  let extras = true;
  let { data, error } = await query(FULL);
  if (error) {
    extras = false;
    ({ data, error } = await query(BASIC));
  }
  if (error) throw error;
  const reviews = data.map(({ review_ratings: rows, review_photos: photos = [], ...review }) => ({
    ...review,
    ratings: new Map(rows.map((row) => [row.user_id, row])),
    photos: [...photos].sort((a, b) => a.created_at.localeCompare(b.created_at)),
    average: rows.length ? rows.reduce((sum, row) => sum + row.stars, 0) / rows.length : null,
  }));
  return { reviews, extras };
}

// Saves my stars and words for one review.
async function saveRating(reviewId, rating) {
  const fields = { ...rating, comment: rating.comment || null, updated_at: new Date().toISOString() };
  const { data, error } = await supabase.from('review_ratings').update(fields).eq('review_id', reviewId).eq('user_id', getUserId()).select('review_id');
  if (error) throw error;
  if (!data.length) {
    const { error: insertError } = await supabase.from('review_ratings').insert({ review_id: reviewId, ...fields });
    if (insertError) throw insertError;
  }
}

// details: { category, title, place, visited_on, price? }; rating: { stars, comment, again? }
// (or null to leave mine alone). Pass an id to change a review. Returns the review's id.
export async function saveReview(id, details, rating) {
  const fields = { ...details, place: details.place || null };
  let reviewId = id;
  if (id) {
    const { error } = await supabase.from('reviews').update(fields).eq('id', id);
    if (error) throw error;
  } else {
    const { data, error } = await supabase.from('reviews').insert(fields).select('id').single();
    if (error) throw error;
    reviewId = data.id;
  }
  if (rating?.stars) await saveRating(reviewId, rating);
  announce('reviews');
  return reviewId;
}

// Stores one prepared photo (see imagePipeline.prepareImage) on a review.
export async function addReviewPhoto(reviewId, prepared) {
  const id = crypto.randomUUID();
  const extension = prepared.full.type === 'image/webp' ? 'webp' : 'jpg';
  const storagePath = `reviews/${reviewId}/${id}.${extension}`;
  const thumbPath = `reviews/${reviewId}/${id}_thumb.${extension}`;
  await putFile(storagePath, prepared.full);
  await putFile(thumbPath, prepared.thumb);
  const { error } = await supabase.from('review_photos').insert({
    id,
    review_id: reviewId,
    storage_path: storagePath,
    thumb_path: thumbPath,
    width: prepared.width,
    height: prepared.height,
    bytes: prepared.full.size + prepared.thumb.size,
  });
  if (error) throw error;
  announce('reviews');
}

export async function removeReviewPhoto(photo) {
  await removeFiles([photo]);
  const { error } = await supabase.from('review_photos').delete().eq('id', photo.id);
  if (error) throw error;
  announce('reviews');
}

// Removes a review, its ratings, and its photos (files first, so none are orphaned).
export async function removeReview(review) {
  await removeFiles(review.photos ?? []);
  const { error } = await supabase.from('reviews').delete().eq('id', review.id);
  if (error) throw error;
  announce('reviews');
}
