-- =============================================================================
-- Our Little World: database add-on 5 (the "daily life" features)
--
-- Run this AFTER the first four files, once: Supabase dashboard > SQL Editor >
-- New query > paste this whole file > Run. Supabase will warn that it contains
-- a "destructive" statement: that is the one line that widens the ledger's
-- sharing options, and it deletes no data. It runs as one transaction, so if
-- any step fails, nothing changes.
--
-- Adds: kinds of pokes, asleep/awake, avatars, daily visits (campfire),
-- question of the day, shared lists, "open when" letters, quest steps,
-- ledger editing and treats, photo sizes, and live updates.
-- =============================================================================

begin;

-- 1. Kinds of pokes ------------------------------------------------------------
alter table public.pokes
  add column kind text not null default 'poke'
  check (kind in ('poke', 'hug', 'kiss', 'miss_you', 'eat', 'water', 'good_morning', 'good_night'));

-- 2. Asleep or awake -----------------------------------------------------------
alter table public.moods add column asleep_since timestamptz;
grant update (asleep_since) on table public.moods to authenticated;

-- 3. Avatars -------------------------------------------------------------------
alter table public.profiles add column avatar text check (char_length(avatar) <= 24);
grant update (avatar) on table public.profiles to authenticated;

-- 4. Photo sizes, for the storage meter ---------------------------------------
alter table public.photos add column bytes integer check (bytes > 0);

-- 5. Ledger: editing, and treats that nobody owes -------------------------------
alter table public.ledger_entries drop constraint ledger_entries_split_check;
alter table public.ledger_entries
  add constraint ledger_entries_split_check check (split in ('half', 'full', 'treat'));
grant update (description, amount, paid_by, split, entry_date)
  on table public.ledger_entries to authenticated;

create policy "Members can edit ledger entries"
  on public.ledger_entries for update to authenticated
  using ((select private.is_member()))
  with check ((select private.is_member()));

-- 6. Visits: one row per person per day, for the campfire streak ----------------
create table public.visits (
  user_id uuid not null default auth.uid()
    constraint visits_user_id_fkey references public.profiles (id) on delete cascade,
  day date not null,                   -- the Manila calendar date
  primary key (user_id, day)
);

-- 7. Question of the day --------------------------------------------------------
create table public.daily_answers (
  day date not null,
  user_id uuid not null default auth.uid()
    constraint daily_answers_user_id_fkey references public.profiles (id) on delete cascade,
  answer text not null check (char_length(btrim(answer)) between 1 and 1000),
  created_at timestamptz not null default now(),
  primary key (day, user_id)
);

-- True once the signed-in member has answered that day's question. Until
-- then, the other person's answer stays hidden.
create function private.has_answered(p_day date)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.daily_answers a
    where a.day = p_day and a.user_id = (select auth.uid())
  );
$$;

revoke all on function private.has_answered(date) from public;
grant execute on function private.has_answered(date) to authenticated;

-- 8. Shared lists (groceries, a watchlist, places to eat, ...) -----------------
create table public.lists (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(btrim(title)) between 1 and 60),
  sort_order integer not null default 0,
  created_by uuid default auth.uid()
    constraint lists_created_by_fkey references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.list_items (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null
    constraint list_items_list_id_fkey references public.lists (id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 200),
  done boolean not null default false,
  created_by uuid default auth.uid()
    constraint list_items_created_by_fkey references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index list_items_list_idx on public.list_items (list_id, created_at);

-- 9. "Open when..." letters: a label on the envelope ----------------------------
create table public.letter_seals (
  letter_id uuid primary key
    constraint letter_seals_letter_id_fkey references public.letters (id) on delete cascade,
  open_when text not null check (char_length(btrim(open_when)) between 1 and 80),
  created_by uuid not null default auth.uid()
    constraint letter_seals_created_by_fkey references public.profiles (id) on delete cascade
);

-- 10. Quest steps --------------------------------------------------------------
create table public.goal_steps (
  id uuid primary key default gen_random_uuid(),
  goal_id uuid not null
    constraint goal_steps_goal_id_fkey references public.goals (id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 200),
  done boolean not null default false,
  created_at timestamptz not null default now()
);

create index goal_steps_goal_idx on public.goal_steps (goal_id, created_at);

-- 11. Access rules for the new tables -------------------------------------------
alter table public.visits enable row level security;
alter table public.daily_answers enable row level security;
alter table public.lists enable row level security;
alter table public.list_items enable row level security;
alter table public.letter_seals enable row level security;
alter table public.goal_steps enable row level security;

revoke all on table
  public.visits, public.daily_answers, public.lists, public.list_items,
  public.letter_seals, public.goal_steps
from public, anon, authenticated;

grant select, insert on table public.visits to authenticated;
grant select, insert on table public.daily_answers to authenticated;
grant update (answer) on table public.daily_answers to authenticated;
grant select, insert, delete on table public.lists to authenticated;
grant update (title, sort_order) on table public.lists to authenticated;
grant select, insert, delete on table public.list_items to authenticated;
grant update (body, done) on table public.list_items to authenticated;
grant select, insert on table public.letter_seals to authenticated;
grant select, insert, delete on table public.goal_steps to authenticated;
grant update (body, done) on table public.goal_steps to authenticated;

create policy "Members can view visits"
  on public.visits for select to authenticated
  using ((select private.is_member()));

create policy "Members can record their own visits"
  on public.visits for insert to authenticated
  with check ((select private.is_member()) and user_id = (select auth.uid()));

-- You always see your own answer; you see the other one once you have answered.
create policy "Members can view answers once they have answered"
  on public.daily_answers for select to authenticated
  using (
    (select private.is_member())
    and (user_id = (select auth.uid()) or private.has_answered(day))
  );

create policy "Members can answer as themselves"
  on public.daily_answers for insert to authenticated
  with check ((select private.is_member()) and user_id = (select auth.uid()));

create policy "Members can change their own answer"
  on public.daily_answers for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "Members can view lists"
  on public.lists for select to authenticated using ((select private.is_member()));
create policy "Members can add lists"
  on public.lists for insert to authenticated
  with check ((select private.is_member()) and created_by = (select auth.uid()));
create policy "Members can edit lists"
  on public.lists for update to authenticated
  using ((select private.is_member())) with check ((select private.is_member()));
create policy "Members can remove lists"
  on public.lists for delete to authenticated using ((select private.is_member()));

create policy "Members can view list items"
  on public.list_items for select to authenticated using ((select private.is_member()));
create policy "Members can add list items"
  on public.list_items for insert to authenticated
  with check ((select private.is_member()) and created_by = (select auth.uid()));
create policy "Members can edit list items"
  on public.list_items for update to authenticated
  using ((select private.is_member())) with check ((select private.is_member()));
create policy "Members can remove list items"
  on public.list_items for delete to authenticated using ((select private.is_member()));

create policy "Members can view seals on letters they can see"
  on public.letter_seals for select to authenticated
  using ((select private.is_member()) and private.can_see_letter(letter_id));
create policy "Members can seal letters they can see"
  on public.letter_seals for insert to authenticated
  with check (
    (select private.is_member())
    and created_by = (select auth.uid())
    and private.can_see_letter(letter_id)
  );

create policy "Members can view quest steps"
  on public.goal_steps for select to authenticated using ((select private.is_member()));
create policy "Members can add quest steps"
  on public.goal_steps for insert to authenticated with check ((select private.is_member()));
create policy "Members can edit quest steps"
  on public.goal_steps for update to authenticated
  using ((select private.is_member())) with check ((select private.is_member()));
create policy "Members can remove quest steps"
  on public.goal_steps for delete to authenticated using ((select private.is_member()));

-- 12. Live updates: let the two members (and nobody else) use the private
--     live channel. If this part cannot be applied on your project, it is
--     skipped with a notice and the site falls back to checking once a minute.
do $$
begin
  execute 'create policy "Our World members can listen live" on realtime.messages
           for select to authenticated using ((select private.is_member()))';
  execute 'create policy "Our World members can send live" on realtime.messages
           for insert to authenticated with check ((select private.is_member()))';
exception when others then
  raise notice 'Live updates were not set up (%). The site will check once a minute instead.', sqlerrm;
end;
$$;

commit;

-- Confirmation: this should list the six new tables.
select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in ('visits', 'daily_answers', 'lists', 'list_items', 'letter_seals', 'goal_steps')
order by table_name;
