-- =============================================================================
-- Our World: database setup for Batch 1
--
-- How to run: Supabase dashboard > SQL Editor > New query > paste this whole
-- file > Run. Run it once. Everything happens in a single transaction, so if
-- any step fails, nothing is changed and it is safe to fix and run again.
--
-- What it creates:
--   1. A "private" schema with the membership check used by every rule
--   2. Tables: profiles, memories, photos, letters, advancement_unlocks
--   3. Row Level Security so only the two members can read or write anything
--   4. Letter functions: send_letter, get_letters, mark_letter_read,
--      cancel_letter (undelivered letters stay invisible to the recipient,
--      and a surprise letter's arrival time stays hidden from everyone)
--   5. The private "photos" storage bucket and its rules
--   6. ping() for the keep-alive job
--   7. Profile rows for the two accounts that already exist
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- 0. Safety check: stop early unless exactly the two expected accounts exist
-- -----------------------------------------------------------------------------
do $$
declare
  v_users integer;
  v_jay integer;
begin
  select count(*) into v_users from auth.users;
  select count(*) into v_jay
  from auth.users
  where lower(email) = 'enricoangelo736@gmail.com';

  if v_users <> 2 then
    raise exception
      'Expected exactly 2 accounts under Authentication > Users, but found %. Nothing was changed.',
      v_users;
  end if;

  if v_jay <> 1 then
    raise exception
      'Could not find Jay''s account by its email address. Nothing was changed.';
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- 1. Private schema (not reachable through the API) and the membership check
-- -----------------------------------------------------------------------------
create schema private;

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null
    check (char_length(btrim(display_name)) between 1 and 40),
  created_at timestamptz not null default now()
);

comment on table public.profiles is
  'The two members. Having a row here is what makes an account a member. '
  'Rows are added by hand on purpose: there is no sign-up trigger, so a stray '
  'new account could never see anything.';

-- True only when the signed-in account has a profile row.
-- It is "security definer" so the rules on profiles can use it without
-- looping back into themselves.
create function private.is_member()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
  );
$$;

create function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function private.is_member() from public;
revoke all on function private.set_updated_at() from public;
grant usage on schema private to authenticated;
grant execute on function private.is_member() to authenticated;

-- -----------------------------------------------------------------------------
-- 2. Memories and photos (the inventory calendar)
-- -----------------------------------------------------------------------------
-- One memory = one entry on one calendar date (Asia/Manila) holding 1+ photos.
create table public.memories (
  id uuid primary key default gen_random_uuid(),
  memory_date date not null,
  title text check (char_length(title) <= 200),
  note text check (char_length(note) <= 10000),
  caption text check (char_length(caption) <= 500),   -- for Anniversary mode (Batch 2)
  featured boolean not null default false,            -- for Anniversary mode (Batch 2)
  cover_photo_id uuid,                                -- linked to photos below
  created_by uuid default auth.uid()
    constraint memories_created_by_fkey references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.photos (
  id uuid primary key default gen_random_uuid(),
  memory_id uuid not null
    constraint photos_memory_id_fkey references public.memories (id) on delete cascade,
  storage_path text not null unique,   -- full image (max 1600 px) in the photos bucket
  thumb_path text not null unique,     -- about 320 px thumbnail in the photos bucket
  taken_at timestamptz,                -- capture time from the photo, when available
  width integer check (width > 0),
  height integer check (height > 0),
  sort_order integer not null default 0,
  created_by uuid default auth.uid()
    constraint photos_created_by_fkey references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

-- If the cover photo is deleted, the memory simply falls back to no chosen cover.
alter table public.memories
  add constraint memories_cover_photo_id_fkey
  foreign key (cover_photo_id) references public.photos (id) on delete set null;

create index memories_memory_date_idx on public.memories (memory_date);
create index memories_cover_photo_id_idx on public.memories (cover_photo_id);
create index photos_memory_id_idx on public.photos (memory_id, sort_order);

create trigger memories_set_updated_at
  before update on public.memories
  for each row execute function private.set_updated_at();

-- -----------------------------------------------------------------------------
-- 3. Letters (book and quill)
-- -----------------------------------------------------------------------------
-- The app never reads or writes this table directly. It goes through the
-- functions in section 6, which is how an undelivered letter stays invisible
-- to its recipient and a surprise arrival time stays hidden from its sender.
create table public.letters (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null
    constraint letters_sender_id_fkey references public.profiles (id) on delete cascade,
  recipient_id uuid not null
    constraint letters_recipient_id_fkey references public.profiles (id) on delete cascade,
  title text check (char_length(title) <= 200),
  body text not null check (char_length(body) between 1 and 50000),
  delivery_mode text not null check (delivery_mode in ('now', 'scheduled', 'surprise')),
  deliver_at timestamptz not null,     -- chosen by send_letter; random for 'surprise'
  read_at timestamptz,
  cancelled boolean not null default false,
  created_at timestamptz not null default now(),
  constraint letters_not_to_self check (sender_id <> recipient_id)
);

create index letters_recipient_idx on public.letters (recipient_id, deliver_at);
create index letters_sender_idx on public.letters (sender_id, created_at);

-- -----------------------------------------------------------------------------
-- 4. Advancement unlocks (each advancement pops up once per person)
-- -----------------------------------------------------------------------------
create table public.advancement_unlocks (
  user_id uuid not null default auth.uid()
    constraint advancement_unlocks_user_id_fkey references public.profiles (id) on delete cascade,
  advancement_key text not null check (char_length(advancement_key) between 1 and 64),
  unlocked_at timestamptz not null default now(),
  primary key (user_id, advancement_key)
);

-- -----------------------------------------------------------------------------
-- 5. Access rules
--    Two locks on every table: (a) which roles may touch it at all (grants),
--    and (b) which rows they may touch (Row Level Security policies).
--    Visitors who are not signed in ("anon") get nothing.
-- -----------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.memories enable row level security;
alter table public.photos enable row level security;
alter table public.letters enable row level security;
alter table public.advancement_unlocks enable row level security;

-- (a) Grants. Start from zero so the result is the same on every project,
--     whatever its default privileges are.
revoke all on table
  public.profiles,
  public.memories,
  public.photos,
  public.letters,
  public.advancement_unlocks
from public, anon, authenticated;

grant select on table public.profiles to authenticated;
grant update (display_name) on table public.profiles to authenticated;

grant select, insert, delete on table public.memories to authenticated;
grant update (memory_date, title, note, caption, featured, cover_photo_id)
  on table public.memories to authenticated;

grant select, insert, delete on table public.photos to authenticated;
grant update (memory_id, sort_order) on table public.photos to authenticated;

grant select, insert on table public.advancement_unlocks to authenticated;

-- No grants on public.letters: see section 6.

-- (b) Policies.

-- profiles: both members can see both names; each can rename only themselves.
create policy "Members can view profiles"
  on public.profiles for select to authenticated
  using ((select private.is_member()));

create policy "Members can update their own profile"
  on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- memories: both members can view, add, edit, and delete everything.
create policy "Members can view memories"
  on public.memories for select to authenticated
  using ((select private.is_member()));

create policy "Members can add memories"
  on public.memories for insert to authenticated
  with check ((select private.is_member()) and created_by = (select auth.uid()));

create policy "Members can edit memories"
  on public.memories for update to authenticated
  using ((select private.is_member()))
  with check ((select private.is_member()));

create policy "Members can delete memories"
  on public.memories for delete to authenticated
  using ((select private.is_member()));

-- photos: same as memories.
create policy "Members can view photos"
  on public.photos for select to authenticated
  using ((select private.is_member()));

create policy "Members can add photos"
  on public.photos for insert to authenticated
  with check ((select private.is_member()) and created_by = (select auth.uid()));

create policy "Members can edit photos"
  on public.photos for update to authenticated
  using ((select private.is_member()))
  with check ((select private.is_member()));

create policy "Members can delete photos"
  on public.photos for delete to authenticated
  using ((select private.is_member()));

-- letters: a backstop only, since no role has direct access to this table.
-- Even if access were granted later, a recipient still could not see a letter
-- before it is delivered.
create policy "Senders see their letters; recipients see delivered ones"
  on public.letters for select to authenticated
  using (
    (select private.is_member())
    and (
      sender_id = (select auth.uid())
      or (
        recipient_id = (select auth.uid())
        and deliver_at <= now()
        and not cancelled
      )
    )
  );

-- advancement_unlocks: members can see all unlocks; each records only their own.
create policy "Members can view advancement unlocks"
  on public.advancement_unlocks for select to authenticated
  using ((select private.is_member()));

create policy "Members can record their own advancement unlocks"
  on public.advancement_unlocks for insert to authenticated
  with check ((select private.is_member()) and user_id = (select auth.uid()));

-- -----------------------------------------------------------------------------
-- 6. Letter functions (the only way the app touches letters)
-- -----------------------------------------------------------------------------

-- Send a letter to the other member.
--   p_delivery_mode = 'now'        delivered immediately
--   p_delivery_mode = 'scheduled'  delivered at p_deliver_at
--   p_delivery_mode = 'surprise'   the server picks a random moment within the
--                                  next p_surprise_days days, between 8:00 AM
--                                  and 10:00 PM Manila time, and tells no one
create function public.send_letter(
  p_title text,
  p_body text,
  p_delivery_mode text,
  p_deliver_at timestamptz default null,
  p_surprise_days integer default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sender uuid := auth.uid();
  v_recipient uuid;
  v_others integer;
  v_deliver_at timestamptz;
  v_candidate timestamptz;
  v_local time;
  v_id uuid;
begin
  if v_sender is null or not private.is_member() then
    raise exception 'Only members can send letters.' using errcode = '42501';
  end if;

  select count(*), min(p.id::text)::uuid
    into v_others, v_recipient
  from public.profiles p
  where p.id <> v_sender;

  if v_others <> 1 then
    raise exception 'Expected exactly one other member to write to, but found %.', v_others;
  end if;

  if p_body is null or btrim(p_body) = '' then
    raise exception 'A letter needs some words in it.';
  end if;

  if p_delivery_mode = 'now' then
    v_deliver_at := now();

  elsif p_delivery_mode = 'scheduled' then
    if p_deliver_at is null then
      raise exception 'Pick a date and time for a scheduled letter.';
    end if;
    v_deliver_at := greatest(p_deliver_at, now());

  elsif p_delivery_mode = 'surprise' then
    if p_surprise_days is null or p_surprise_days not between 1 and 365 then
      raise exception 'A surprise letter needs a range between 1 and 365 days.';
    end if;

    -- Draw random moments in the range until one lands between 8:00 AM and
    -- 10:00 PM in Manila (about 6 in 10 draws do).
    for i in 1..200 loop
      v_candidate := now() + random() * make_interval(days => p_surprise_days);
      v_local := (v_candidate at time zone 'Asia/Manila')::time;
      if v_local >= time '08:00' and v_local < time '22:00' then
        v_deliver_at := v_candidate;
        exit;
      end if;
    end loop;

    -- Practically unreachable fallback: 8:00 AM tomorrow, Manila time.
    if v_deliver_at is null then
      v_deliver_at :=
        (((now() at time zone 'Asia/Manila')::date + 1) + time '08:00')
        at time zone 'Asia/Manila';
    end if;

  else
    raise exception 'Unknown delivery mode: %.', coalesce(p_delivery_mode, '(none)');
  end if;

  insert into public.letters (sender_id, recipient_id, title, body, delivery_mode, deliver_at)
  values (v_sender, v_recipient, nullif(btrim(p_title), ''), p_body, p_delivery_mode, v_deliver_at)
  returning id into v_id;

  return v_id;
end;
$$;

-- Everything the signed-in member is allowed to see:
--   * letters they sent (the arrival time of a surprise still on its way is blank)
--   * letters sent to them that have been delivered and were not cancelled
create function public.get_letters()
returns table (
  id uuid,
  sender_id uuid,
  recipient_id uuid,
  title text,
  body text,
  delivery_mode text,
  deliver_at timestamptz,
  delivered boolean,
  read_at timestamptz,
  cancelled boolean,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    l.id,
    l.sender_id,
    l.recipient_id,
    l.title,
    l.body,
    l.delivery_mode,
    case
      when l.delivery_mode = 'surprise' and l.deliver_at > now() then null
      else l.deliver_at
    end as deliver_at,
    l.deliver_at <= now() as delivered,
    l.read_at,
    l.cancelled,
    l.created_at
  from public.letters l
  where (select private.is_member())
    and (
      l.sender_id = (select auth.uid())
      or (
        l.recipient_id = (select auth.uid())
        and l.deliver_at <= now()
        and not l.cancelled
      )
    )
  order by l.created_at desc;
$$;

-- The recipient opens a delivered letter. Returns true if it was newly marked read.
create function public.mark_letter_read(p_letter_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rows integer;
begin
  update public.letters l
  set read_at = now()
  where l.id = p_letter_id
    and l.recipient_id = auth.uid()
    and l.deliver_at <= now()
    and not l.cancelled
    and l.read_at is null;

  get diagnostics v_rows = row_count;
  return v_rows = 1;
end;
$$;

-- The sender takes back a letter that has not been delivered yet.
-- Returns true if it was cancelled; false if it was already delivered.
create function public.cancel_letter(p_letter_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rows integer;
begin
  update public.letters l
  set cancelled = true
  where l.id = p_letter_id
    and l.sender_id = auth.uid()
    and l.deliver_at > now()
    and not l.cancelled;

  get diagnostics v_rows = row_count;
  return v_rows = 1;
end;
$$;

-- Tiny function for the keep-alive job. It touches no data.
create function public.ping()
returns text
language sql
stable
set search_path = ''
as $$
  select 'pong'::text;
$$;

revoke all on function public.send_letter(text, text, text, timestamptz, integer) from public, anon, authenticated;
revoke all on function public.get_letters() from public, anon, authenticated;
revoke all on function public.mark_letter_read(uuid) from public, anon, authenticated;
revoke all on function public.cancel_letter(uuid) from public, anon, authenticated;
revoke all on function public.ping() from public, anon, authenticated;

grant execute on function public.send_letter(text, text, text, timestamptz, integer) to authenticated;
grant execute on function public.get_letters() to authenticated;
grant execute on function public.mark_letter_read(uuid) to authenticated;
grant execute on function public.cancel_letter(uuid) to authenticated;
grant execute on function public.ping() to anon, authenticated;

-- -----------------------------------------------------------------------------
-- 7. Photo storage: one private bucket, members only
-- -----------------------------------------------------------------------------
-- 5 MB per file is far above what a compressed photo needs (about 250 KB).
-- JPEG is allowed next to WebP for browsers that cannot save WebP.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photos', 'photos', false, 5242880, array['image/webp', 'image/jpeg'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy "Our World members can view photo files"
  on storage.objects for select to authenticated
  using (bucket_id = 'photos' and (select private.is_member()));

create policy "Our World members can upload photo files"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'photos' and (select private.is_member()));

create policy "Our World members can replace photo files"
  on storage.objects for update to authenticated
  using (bucket_id = 'photos' and (select private.is_member()))
  with check (bucket_id = 'photos' and (select private.is_member()));

create policy "Our World members can delete photo files"
  on storage.objects for delete to authenticated
  using (bucket_id = 'photos' and (select private.is_member()));

-- -----------------------------------------------------------------------------
-- 8. Profile rows for the two existing accounts
-- -----------------------------------------------------------------------------
insert into public.profiles (id, display_name)
select
  u.id,
  case
    when lower(u.email) = 'enricoangelo736@gmail.com' then 'Jay'
    else 'Zen'
  end
from auth.users u;

commit;

-- Confirmation: this should list exactly two rows, Jay and Zen.
select display_name, created_at
from public.profiles
order by display_name;
