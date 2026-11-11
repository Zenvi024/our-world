import { supabase } from '../supabase.js';
import { getUserId } from '../session.js';
import { announce } from '../lib/live.js';

// Our Reviews: the cafés, restaurants, films, and places you have been to,
// each with a star rating and a few words from each of you.
export const CATEGORIES = {
  cafe: 'Café',
  restaurant: 'Restaurant',
  movie: 'Movie',
  show: 'Show',
  place: 'Place',
  other: 'Other',
};
export const MAX_STARS = 5;

// Every review, newest visit first, each with `ratings`: Map user id -> { stars, comment }
// and `average` (of whoever has rated it; null if nobody has).
export async function fetchReviews() {
  const { data, error } = await supabase
    .from('reviews')
    .select('id, category, title, place, visited_on, created_at, review_ratings(user_id, stars, comment)')
    .order('visited_on', { ascending: false })
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data.map(({ review_ratings: rows, ...review }) => {
    const ratings = new Map(rows.map((row) => [row.user_id, row]));
    const average = rows.length ? rows.reduce((sum, row) => sum + row.stars, 0) / rows.length : null;
    return { ...review, ratings, average };
  });
}

// Saves my stars and words for one review.
async function saveRating(reviewId, stars, comment) {
  const fields = { stars, comment: comment || null, updated_at: new Date().toISOString() };
  const { data, error } = await supabase.from('review_ratings').update(fields).eq('review_id', reviewId).eq('user_id', getUserId()).select('review_id');
  if (error) throw error;
  if (!data.length) {
    const { error: insertError } = await supabase.from('review_ratings').insert({ review_id: reviewId, ...fields });
    if (insertError) throw insertError;
  }
}

// details: { category, title, place, visited_on }. Pass an id to change a review.
export async function saveReview(id, details, stars, comment) {
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
  if (stars) await saveRating(reviewId, stars, comment);
  announce('reviews');
}

export async function removeReview(id) {
  const { error } = await supabase.from('reviews').delete().eq('id', id);
  if (error) throw error;
  announce('reviews');
}
