-- =============================================================================
-- Our Little World: database add-on 3 (mood hearts, heart reactions, comments)
--
-- Run this AFTER migration.sql and migration-2.sql, once: Supabase dashboard >
-- SQL Editor > New query > paste this whole file > Run. It only adds new
-- things. It runs as one transaction, so if any step fails, nothing changes.
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- 1. Mood hearts: how each of you is feeling right now (0 to 5 hearts)
-- -----------------------------------------------------------------------------
create table public.moods (
  user_id uuid primary key default auth.uid()
    constraint moods_user_id_fkey references public.profiles (id) on delete cascade,
  hearts smallint not null check (hearts between 0 and 5),
  updated_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- 2. Hearts on goals
-- -----------------------------------------------------------------------------
create table public.goal_hearts (
  goal_id uuid not null
    constraint goal_hearts_goal_id_fkey references public.goals (id) on delete cascade,
  user_id uuid not null default auth.uid()
    constraint goal_hearts_user_id_fkey references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (goal_id, user_id)
);

-- -----------------------------------------------------------------------------
-- 3. Hearts and comments on letters
--    A person may only see or add these on letters they are allowed to see:
--    letters they sent, and letters sent to them that have been delivered.
-- -----------------------------------------------------------------------------
create function private.can_see_letter(p_letter_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.letters l
    where l.id = p_letter_id
      and (
        l.sender_id = (select auth.uid())
        or (
          l.recipient_id = (select auth.uid())
          and l.deliver_at <= now()
          and not l.cancelled
        )
      )
  );
$$;

revoke all on function private.can_see_letter(uuid) from public;
grant execute on function private.can_see_letter(uuid) to authenticated;

create table public.letter_hearts (
  letter_id uuid not null
    constraint letter_hearts_letter_id_fkey references public.letters (id) on delete cascade,
  user_id uuid not null default auth.uid()
    constraint letter_hearts_user_id_fkey references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (letter_id, user_id)
);

create table public.letter_comments (
  id uuid primary key default gen_random_uuid(),
  letter_id uuid not null
    constraint letter_comments_letter_id_fkey references public.letters (id) on delete cascade,
  author_id uuid not null default auth.uid()
    constraint letter_comments_author_id_fkey references public.profiles (id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 2000),
  created_at timestamptz not null default now()
);

create index letter_comments_letter_idx on public.letter_comments (letter_id, created_at);

-- -----------------------------------------------------------------------------
-- 4. Access rules
-- -----------------------------------------------------------------------------
alter table public.moods enable row level security;
alter table public.goal_hearts enable row level security;
alter table public.letter_hearts enable row level security;
alter table public.letter_comments enable row level security;

revoke all on table public.moods, public.goal_hearts, public.letter_hearts, public.letter_comments
from public, anon, authenticated;

grant select, insert on table public.moods to authenticated;
grant update (hearts, updated_at) on table public.moods to authenticated;
grant select, insert, delete on table public.goal_hearts to authenticated;
grant select, insert, delete on table public.letter_hearts to authenticated;
grant select, insert, delete on table public.letter_comments to authenticated;

-- moods: both of you can see both moods; each sets only their own.
create policy "Members can view moods"
  on public.moods for select to authenticated
  using ((select private.is_member()));

create policy "Members can set their own mood"
  on public.moods for insert to authenticated
  with check ((select private.is_member()) and user_id = (select auth.uid()));

create policy "Members can change their own mood"
  on public.moods for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- goal hearts: both can see them; each adds and removes only their own.
create policy "Members can view goal hearts"
  on public.goal_hearts for select to authenticated
  using ((select private.is_member()));

create policy "Members can heart goals"
  on public.goal_hearts for insert to authenticated
  with check ((select private.is_member()) and user_id = (select auth.uid()));

create policy "Members can remove their own goal hearts"
  on public.goal_hearts for delete to authenticated
  using (user_id = (select auth.uid()));

-- letter hearts and comments: only on letters you are allowed to see.
create policy "Members can view hearts on letters they can see"
  on public.letter_hearts for select to authenticated
  using ((select private.is_member()) and private.can_see_letter(letter_id));

create policy "Members can heart letters they can see"
  on public.letter_hearts for insert to authenticated
  with check (
    (select private.is_member())
    and user_id = (select auth.uid())
    and private.can_see_letter(letter_id)
  );

create policy "Members can remove their own letter hearts"
  on public.letter_hearts for delete to authenticated
  using (user_id = (select auth.uid()));

create policy "Members can view comments on letters they can see"
  on public.letter_comments for select to authenticated
  using ((select private.is_member()) and private.can_see_letter(letter_id));

create policy "Members can comment on letters they can see"
  on public.letter_comments for insert to authenticated
  with check (
    (select private.is_member())
    and author_id = (select auth.uid())
    and private.can_see_letter(letter_id)
  );

create policy "Members can remove their own comments"
  on public.letter_comments for delete to authenticated
  using (author_id = (select auth.uid()));

commit;

-- Confirmation: this should list the four new tables.
select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in ('moods', 'goal_hearts', 'letter_hearts', 'letter_comments')
order by table_name;
