-- =============================================================================
-- Our Little World: database add-on 6 (Happybara, the shared pet)
--
-- Run this AFTER the first five files, once: Supabase dashboard > SQL Editor >
-- New query > paste this whole file > Run. It only adds new things. It runs
-- as one transaction, so if any step fails, nothing changes.
--
-- How the pet works: the database remembers WHEN Happybara was last fed,
-- watered, played with, and bathed. Each need runs down as time passes, so
-- the pet keeps living even when the site is closed. Caring for it earns
-- coins; coins buy food, furniture, and hats. All changes go through the
-- functions below, so coins cannot be invented from the browser.
-- =============================================================================

begin;

create table public.pet (
  id smallint primary key default 1 check (id = 1),   -- there is only one Happybara
  name text not null default 'Happybara' check (char_length(btrim(name)) between 1 and 20),
  fed_at timestamptz not null default now(),
  watered_at timestamptz not null default now(),
  played_at timestamptz not null default now(),
  bathed_at timestamptz not null default now(),
  petted_at timestamptz,
  coins integer not null default 20 check (coins >= 0),
  food integer not null default 5 check (food >= 0),    -- meals in the pantry
  love integer not null default 0 check (love >= 0),    -- grows with every bit of care
  wearing text,                                          -- the hat it has on, if any
  created_at timestamptz not null default now()
);

insert into public.pet (id) values (1);

create table public.pet_items (
  item_key text primary key check (char_length(item_key) between 1 and 40),
  bought_by uuid
    constraint pet_items_bought_by_fkey references public.profiles (id) on delete set null,
  bought_at timestamptz not null default now()
);

create table public.pet_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid
    constraint pet_log_user_id_fkey references public.profiles (id) on delete set null,
  action text not null check (char_length(action) between 1 and 40),
  created_at timestamptz not null default now()
);

create index pet_log_recent_idx on public.pet_log (created_at desc);

-- Both members can look; only the functions below can change anything.
alter table public.pet enable row level security;
alter table public.pet_items enable row level security;
alter table public.pet_log enable row level security;

revoke all on table public.pet, public.pet_items, public.pet_log from public, anon, authenticated;
grant select on table public.pet, public.pet_items, public.pet_log to authenticated;

create policy "Members can see the pet"
  on public.pet for select to authenticated using ((select private.is_member()));
create policy "Members can see the pet's things"
  on public.pet_items for select to authenticated using ((select private.is_member()));
create policy "Members can see the pet's diary"
  on public.pet_log for select to authenticated using ((select private.is_member()));

-- Care for the pet: 'feed', 'water', 'play', 'bathe', or 'pet'.
-- Returns the coins earned. Zero means it did not need that right now
-- (or, for petting, that it was petted within the last hour).
create function public.pet_care(p_action text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pet public.pet;
  v_last timestamptz;
  v_hours numeric;   -- how long this need takes to run all the way down
  v_coins integer;
  v_level numeric;   -- how full the need is right now, 0 to 100
begin
  if not private.is_member() then
    raise exception 'Only members can care for the pet.' using errcode = '42501';
  end if;

  select * into v_pet from public.pet where id = 1 for update;

  if p_action = 'pet' then
    v_coins := case when v_pet.petted_at is null or v_pet.petted_at < now() - interval '1 hour' then 1 else 0 end;
    update public.pet
    set petted_at = case when v_coins > 0 then now() else petted_at end,
        coins = coins + v_coins,
        love = love + 1
    where id = 1;
    return v_coins;
  elsif p_action = 'feed' then
    v_last := v_pet.fed_at; v_hours := 10; v_coins := 2;
  elsif p_action = 'water' then
    v_last := v_pet.watered_at; v_hours := 6; v_coins := 3;
  elsif p_action = 'play' then
    v_last := v_pet.played_at; v_hours := 14; v_coins := 5;
  elsif p_action = 'bathe' then
    v_last := v_pet.bathed_at; v_hours := 30; v_coins := 8;
  else
    raise exception 'Unknown kind of care: %.', coalesce(p_action, '(none)');
  end if;

  v_level := greatest(0, 100 - extract(epoch from (now() - v_last)) / 3600 / v_hours * 100);
  if v_level >= 85 then
    return 0;   -- not needed yet
  end if;

  if p_action = 'feed' and v_pet.food <= 0 then
    raise exception 'The pantry is empty. Buy some food first.';
  end if;

  update public.pet
  set fed_at = case when p_action = 'feed' then now() else fed_at end,
      watered_at = case when p_action = 'water' then now() else watered_at end,
      played_at = case when p_action = 'play' then now() else played_at end,
      bathed_at = case when p_action = 'bathe' then now() else bathed_at end,
      food = food - case when p_action = 'feed' then 1 else 0 end,
      coins = coins + v_coins,
      love = love + 3
  where id = 1;

  insert into public.pet_log (user_id, action) values (auth.uid(), p_action);
  return v_coins;
end;
$$;

-- Buy something from the shop. Returns the coins left.
create function public.pet_buy(p_item text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_price integer;
  v_coins integer;
begin
  if not private.is_member() then
    raise exception 'Only members can shop for the pet.' using errcode = '42501';
  end if;

  v_price := case p_item
    when 'food_pack' then 8
    when 'plant' then 25
    when 'rug' then 30
    when 'lamp' then 35
    when 'painting' then 45
    when 'bed' then 60
    when 'bookshelf' then 70
    when 'tub' then 90
    when 'hat_orange' then 20
    when 'hat_blossom' then 25
    when 'hat_bow' then 30
    when 'hat_crown' then 100
    else null
  end;
  if v_price is null then
    raise exception 'The shop does not sell that.';
  end if;

  select coins into v_coins from public.pet where id = 1 for update;
  if v_coins < v_price then
    raise exception 'Not enough coins yet.';
  end if;

  if p_item = 'food_pack' then
    update public.pet set coins = coins - v_price, food = food + 3 where id = 1;
  else
    if exists (select 1 from public.pet_items i where i.item_key = p_item) then
      raise exception 'You already have that.';
    end if;
    insert into public.pet_items (item_key, bought_by) values (p_item, auth.uid());
    update public.pet set coins = coins - v_price where id = 1;
  end if;

  insert into public.pet_log (user_id, action) values (auth.uid(), 'buy:' || p_item);
  return v_coins - v_price;
end;
$$;

-- Put on a hat the pet owns, or take it off (pass null).
create function public.pet_wear(p_item text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_member() then
    raise exception 'Only members can dress the pet.' using errcode = '42501';
  end if;
  if p_item is not null and not (
    p_item like 'hat\_%' and exists (select 1 from public.pet_items i where i.item_key = p_item)
  ) then
    raise exception 'The pet does not own that hat.';
  end if;
  update public.pet set wearing = p_item where id = 1;
end;
$$;

create function public.pet_rename(p_name text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_member() then
    raise exception 'Only members can name the pet.' using errcode = '42501';
  end if;
  if p_name is null or char_length(btrim(p_name)) not between 1 and 20 then
    raise exception 'A name needs 1 to 20 letters.';
  end if;
  update public.pet set name = btrim(p_name) where id = 1;
end;
$$;

revoke all on function public.pet_care(text) from public, anon, authenticated;
revoke all on function public.pet_buy(text) from public, anon, authenticated;
revoke all on function public.pet_wear(text) from public, anon, authenticated;
revoke all on function public.pet_rename(text) from public, anon, authenticated;
grant execute on function public.pet_care(text) to authenticated;
grant execute on function public.pet_buy(text) to authenticated;
grant execute on function public.pet_wear(text) to authenticated;
grant execute on function public.pet_rename(text) to authenticated;

commit;

-- Confirmation: this should show Happybara with 20 coins and 5 meals.
select name, coins, food from public.pet;
