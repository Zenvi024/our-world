-- =============================================================================
-- Our Little World: database add-on 9 (the anniversary album)
--
-- Run this AFTER the first eight files, once: Supabase dashboard > SQL Editor >
-- New query > paste this whole file > Run. It only adds new things. It runs
-- as one transaction, so if any step fails, nothing changes.
--
-- The album is a storybook written by one of you (its author) for the other.
-- Only the author can change it, and the other person cannot see a single
-- page until the author publishes it. The database enforces both.
-- =============================================================================

begin;

-- One row: who wrote the album, and whether it has been given yet.
create table public.album (
  id smallint primary key default 1 check (id = 1),
  author uuid
    constraint album_author_fkey references public.profiles (id) on delete set null,
  published boolean not null default false,
  updated_at timestamptz not null default now()
);

-- The author is Zen: the member called "Zen", or failing that, the member
-- who is not Jay.
insert into public.album (id, author)
values (
  1,
  coalesce(
    (select p.id from public.profiles p where lower(btrim(p.display_name)) = 'zen' limit 1),
    (select p.id from public.profiles p join auth.users u on u.id = p.id
     where lower(u.email) <> 'enricoangelo736@gmail.com' order by p.created_at limit 1)
  )
);

create function private.is_album_author()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.album a where a.id = 1 and a.author = (select auth.uid()));
$$;

create function private.album_is_open()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.album a where a.id = 1 and a.published);
$$;

revoke all on function private.is_album_author() from public, anon;
revoke all on function private.album_is_open() from public, anon;
grant execute on function private.is_album_author() to authenticated;
grant execute on function private.album_is_open() to authenticated;

-- The pages. `scene` names the animated picture drawn for the page; the
-- words, the date, and an optional real photo are the author's.
create table public.album_pages (
  id uuid primary key default gen_random_uuid(),
  position integer not null,
  scene text not null check (char_length(scene) between 1 and 40),
  date_label text check (date_label is null or char_length(date_label) <= 60),
  body text not null default '' check (char_length(body) <= 1200),
  hidden boolean not null default false,          -- skipped when the album is read
  photo_path text check (photo_path is null or photo_path like 'album/%'),
  photo_thumb text check (photo_thumb is null or photo_thumb like 'album/%'),
  updated_at timestamptz not null default now()
);

create index album_pages_position_idx on public.album_pages (position);

-- The story's pages, in order, with nothing written on them yet.
insert into public.album_pages (position, scene) values
  (10, 'cover'),
  (20, 'classroom'),
  (30, 'strength'),
  (40, 'pride'),
  (50, 'study'),
  (60, 'bouquet'),
  (70, 'samepage'),
  (80, 'ferriswheel'),
  (90, 'home'),
  (100, 'grab'),
  (110, 'storm'),
  (120, 'graduation'),
  (130, 'lawschool'),
  (140, 'dinner'),
  (150, 'baguio'),
  (160, 'fireworks'),
  (170, 'blank');

alter table public.album enable row level security;
alter table public.album_pages enable row level security;

revoke all on table public.album, public.album_pages from public, anon, authenticated;
grant select on table public.album to authenticated;
grant update (published, updated_at) on table public.album to authenticated;
grant select, insert, delete on table public.album_pages to authenticated;
grant update (position, scene, date_label, body, hidden, photo_path, photo_thumb, updated_at)
  on table public.album_pages to authenticated;

-- Both of you can see whether the album exists and is published; only the
-- author can publish it.
create policy "Members can see the album's cover"
  on public.album for select to authenticated using ((select private.is_member()));
create policy "The author can publish the album"
  on public.album for update to authenticated
  using (author = (select auth.uid()) and (select private.is_member()))
  with check (author = (select auth.uid()));

-- Pages: the author always; the other member only once it is published.
create policy "Pages are seen by the author, and by both once published"
  on public.album_pages for select to authenticated
  using ((select private.is_member()) and ((select private.is_album_author()) or (select private.album_is_open())));
create policy "The author can add pages"
  on public.album_pages for insert to authenticated
  with check ((select private.is_album_author()));
create policy "The author can change pages"
  on public.album_pages for update to authenticated
  using ((select private.is_album_author())) with check ((select private.is_album_author()));
create policy "The author can remove pages"
  on public.album_pages for delete to authenticated
  using ((select private.is_album_author()));

commit;

-- Confirmation: this should show the author's name, "false", and 17 pages.
select p.display_name as author, a.published, (select count(*) from public.album_pages) as pages
from public.album a left join public.profiles p on p.id = a.author;
