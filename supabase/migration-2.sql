-- =============================================================================
-- Our Little World: database add-on 2 (goals, money ledger, pokes)
--
-- Run this AFTER migration.sql, once: Supabase dashboard > SQL Editor >
-- New query > paste this whole file > Run. It only adds new things; nothing
-- that already exists is changed or removed. It runs as one transaction, so
-- if any step fails, nothing is changed.
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- 1. Goals: the shared bucket list (go to Japan, adopt a cat, ...)
-- -----------------------------------------------------------------------------
create table public.goals (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(btrim(title)) between 1 and 120),
  note text check (char_length(note) <= 2000),
  target_from date,                    -- "we hope to do this between ..."
  target_to date,                      -- "... and ..."
  sort_order integer not null default 0,
  done_at timestamptz,                 -- empty until the goal is reached
  done_by uuid
    constraint goals_done_by_fkey references public.profiles (id) on delete set null,
  created_by uuid default auth.uid()
    constraint goals_created_by_fkey references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint goals_target_order check (
    target_from is null or target_to is null or target_from <= target_to
  )
);

create index goals_sort_order_idx on public.goals (sort_order);

-- -----------------------------------------------------------------------------
-- 2. Ledger: who paid for what, and who owes whom (amounts in pesos)
-- -----------------------------------------------------------------------------
create table public.ledger_entries (
  id uuid primary key default gen_random_uuid(),
  -- 'expense'    = paid_by paid for something
  -- 'settlement' = paid_by handed money to the other person to pay a debt
  kind text not null check (kind in ('expense', 'settlement')),
  description text check (char_length(description) <= 200),
  amount numeric(12, 2) not null check (amount > 0 and amount <= 100000000),
  paid_by uuid not null
    constraint ledger_entries_paid_by_fkey references public.profiles (id) on delete cascade,
  -- For expenses: 'half' = shared equally, 'full' = the other person owes all of it
  split text not null default 'half' check (split in ('half', 'full')),
  entry_date date not null default ((now() at time zone 'Asia/Manila')::date),
  created_by uuid default auth.uid()
    constraint ledger_entries_created_by_fkey references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index ledger_entries_date_idx on public.ledger_entries (entry_date desc, created_at desc);

-- -----------------------------------------------------------------------------
-- 3. Pokes: a tiny "thinking of you"
-- -----------------------------------------------------------------------------
create table public.pokes (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null default auth.uid()
    constraint pokes_sender_id_fkey references public.profiles (id) on delete cascade,
  recipient_id uuid not null
    constraint pokes_recipient_id_fkey references public.profiles (id) on delete cascade,
  seen_at timestamptz,                 -- empty until the recipient has seen it
  created_at timestamptz not null default now(),
  constraint pokes_not_to_self check (sender_id <> recipient_id)
);

create index pokes_recipient_idx on public.pokes (recipient_id, seen_at);

-- -----------------------------------------------------------------------------
-- 4. Access rules (same two locks as before: grants, then row policies)
-- -----------------------------------------------------------------------------
alter table public.goals enable row level security;
alter table public.ledger_entries enable row level security;
alter table public.pokes enable row level security;

revoke all on table public.goals, public.ledger_entries, public.pokes
from public, anon, authenticated;

grant select, insert, delete on table public.goals to authenticated;
grant update (title, note, target_from, target_to, sort_order, done_at, done_by)
  on table public.goals to authenticated;

grant select, insert, delete on table public.ledger_entries to authenticated;

grant select, insert on table public.pokes to authenticated;
grant update (seen_at) on table public.pokes to authenticated;

-- goals: both members can view, add, edit, reorder, and remove.
create policy "Members can view goals"
  on public.goals for select to authenticated
  using ((select private.is_member()));

create policy "Members can add goals"
  on public.goals for insert to authenticated
  with check ((select private.is_member()) and created_by = (select auth.uid()));

create policy "Members can edit goals"
  on public.goals for update to authenticated
  using ((select private.is_member()))
  with check ((select private.is_member()));

create policy "Members can remove goals"
  on public.goals for delete to authenticated
  using ((select private.is_member()));

-- ledger: both members can view, add, and remove entries.
create policy "Members can view ledger entries"
  on public.ledger_entries for select to authenticated
  using ((select private.is_member()));

create policy "Members can add ledger entries"
  on public.ledger_entries for insert to authenticated
  with check ((select private.is_member()) and created_by = (select auth.uid()));

create policy "Members can remove ledger entries"
  on public.ledger_entries for delete to authenticated
  using ((select private.is_member()));

-- pokes: you can see pokes you sent or received, send as yourself, and
-- mark the ones sent to you as seen.
create policy "Members can view their pokes"
  on public.pokes for select to authenticated
  using (
    (select private.is_member())
    and (sender_id = (select auth.uid()) or recipient_id = (select auth.uid()))
  );

create policy "Members can send pokes"
  on public.pokes for insert to authenticated
  with check ((select private.is_member()) and sender_id = (select auth.uid()));

create policy "Recipients can mark pokes as seen"
  on public.pokes for update to authenticated
  using (recipient_id = (select auth.uid()))
  with check (recipient_id = (select auth.uid()));

commit;

-- Confirmation: this should list the three new tables.
select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in ('goals', 'ledger_entries', 'pokes')
order by table_name;
