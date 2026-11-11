-- =============================================================================
-- Our Little World: database add-on 8 (more for Our Reviews)
--
-- Run this AFTER the first seven files, once: Supabase dashboard > SQL Editor >
-- New query > paste this whole file > Run. It only adds new things: photos on
-- reviews, a price level, and "would go again." It runs as one transaction,
-- so if any step fails, nothing changes.
-- =============================================================================

begin;

-- How dear a place is: 1 (easy on the wallet) to 3 (a splurge). Optional.
alter table public.reviews
  add column price smallint check (price between 1 and 3);

grant update (price) on table public.reviews to authenticated;

-- Would you go (or watch) again? Each of you answers for yourself.
alter table public.review_ratings
  add column again boolean;

grant update (again) on table public.review_ratings to authenticated;

-- Photos on a review. The files live in the same private "photos" bucket as
-- your memories, under reviews/<review id>/.
create table public.review_photos (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null
    constraint review_photos_review_id_fkey references public.reviews (id) on delete cascade,
  storage_path text not null unique check (storage_path like 'reviews/%'),
  thumb_path text not null check (thumb_path like 'reviews/%'),
  width integer,
  height integer,
  bytes integer,
  created_by uuid default auth.uid()
    constraint review_photos_created_by_fkey references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index review_photos_review_idx on public.review_photos (review_id, created_at);

alter table public.review_photos enable row level security;

revoke all on table public.review_photos from public, anon, authenticated;
grant select, insert, delete on table public.review_photos to authenticated;

create policy "Members can view review photos"
  on public.review_photos for select to authenticated using ((select private.is_member()));
create policy "Members can add review photos"
  on public.review_photos for insert to authenticated
  with check ((select private.is_member()) and created_by = (select auth.uid()));
create policy "Members can remove review photos"
  on public.review_photos for delete to authenticated using ((select private.is_member()));

commit;

-- Confirmation: this should list price, again, and the review_photos table.
select table_name, column_name
from information_schema.columns
where table_schema = 'public'
  and ((table_name = 'reviews' and column_name = 'price')
    or (table_name = 'review_ratings' and column_name = 'again')
    or (table_name = 'review_photos' and column_name = 'storage_path'))
order by table_name;
