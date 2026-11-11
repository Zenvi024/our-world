-- =============================================================================
-- Our Little World: database add-on 7
-- (a bigger Happybara, the focus timer, angry cats, and Our Reviews)
--
-- Run this AFTER the first six files, once: Supabase dashboard > SQL Editor >
-- New query > paste this whole file > Run. It only adds new things and
-- replaces two pet functions with bigger versions. It runs as one
-- transaction, so if any step fails, nothing changes.
-- =============================================================================

begin;

-- 1. Angry cats: how annoyed each of you is, from 0 (five happy cats) to 5 ----
alter table public.moods
  add column angry smallint not null default 0 check (angry between 0 and 5);

grant update (angry) on table public.moods to authenticated;

-- 2. Happybara: an accessory, rooms, and the shop's price list ----------------
alter table public.pet add column accessory text;

-- The price list. Prices and levels live here only, so they can be tuned later
-- with one UPDATE and the site follows.
create table public.pet_shop (
  item_key text primary key check (char_length(item_key) between 1 and 40),
  kind text not null check (kind in ('food', 'treat', 'room', 'furniture', 'wall', 'floor', 'hat', 'accessory')),
  room text check (room in ('living', 'kitchen', 'bedroom', 'bathroom', 'garden')),   -- for furniture
  price integer not null check (price > 0),
  min_level integer not null default 1 check (min_level >= 1),
  amount integer not null default 0,     -- meals for food, love for treats
  sort_order integer not null default 0
);

insert into public.pet_shop (item_key, kind, room, price, min_level, amount, sort_order) values
  -- food and treats
  ('food_pack',        'food',  null, 12, 1, 3, 1),
  ('treat_watermelon', 'treat', null, 15, 1, 4, 2),
  ('treat_yuzu',       'treat', null, 25, 1, 7, 3),
  ('treat_cake',       'treat', null, 40, 1, 12, 4),
  -- rooms
  ('room_kitchen',  'room', null, 250, 3, 0, 10),
  ('room_bedroom',  'room', null, 450, 6, 0, 11),
  ('room_bathroom', 'room', null, 700, 10, 0, 12),
  ('room_garden',   'room', null, 1000, 15, 0, 13),
  -- living room
  ('plant',      'furniture', 'living', 40, 1, 0, 20),
  ('rug',        'furniture', 'living', 60, 1, 0, 21),
  ('lamp',       'furniture', 'living', 70, 1, 0, 22),
  ('painting',   'furniture', 'living', 90, 1, 0, 23),
  ('bookshelf',  'furniture', 'living', 140, 2, 0, 24),
  ('gramophone', 'furniture', 'living', 160, 4, 0, 25),
  ('sofa',       'furniture', 'living', 180, 5, 0, 26),
  ('aquarium',   'furniture', 'living', 220, 7, 0, 27),
  ('piano',      'furniture', 'living', 260, 9, 0, 28),
  -- kitchen
  ('fruit_bowl', 'furniture', 'kitchen', 50, 1, 0, 30),
  ('herbs',      'furniture', 'kitchen', 60, 1, 0, 31),
  ('tea_set',    'furniture', 'kitchen', 70, 1, 0, 32),
  ('jars',       'furniture', 'kitchen', 80, 1, 0, 33),
  ('table',      'furniture', 'kitchen', 110, 1, 0, 34),
  ('stove',      'furniture', 'kitchen', 130, 1, 0, 35),
  ('fridge',     'furniture', 'kitchen', 150, 1, 0, 36),
  -- bedroom
  ('plush',       'furniture', 'bedroom', 60, 1, 0, 40),
  ('nightstand',  'furniture', 'bedroom', 70, 1, 0, 41),
  ('star_lights', 'furniture', 'bedroom', 90, 1, 0, 42),
  ('toy_chest',   'furniture', 'bedroom', 110, 1, 0, 43),
  ('bed',         'furniture', 'bedroom', 120, 1, 0, 44),
  ('moon_lamp',   'furniture', 'bedroom', 140, 1, 0, 45),
  ('wardrobe',    'furniture', 'bedroom', 180, 1, 0, 46),
  -- bathroom
  ('duck',     'furniture', 'bathroom', 40, 1, 0, 50),
  ('bath_mat', 'furniture', 'bathroom', 50, 1, 0, 51),
  ('towels',   'furniture', 'bathroom', 60, 1, 0, 52),
  ('mirror',   'furniture', 'bathroom', 80, 1, 0, 53),
  ('yuzu',     'furniture', 'bathroom', 90, 1, 0, 54),
  ('tub',      'furniture', 'bathroom', 200, 1, 0, 55),
  -- garden
  ('flowers',    'furniture', 'garden', 60, 1, 0, 60),
  ('birdhouse',  'furniture', 'garden', 80, 1, 0, 61),
  ('picnic',     'furniture', 'garden', 90, 1, 0, 62),
  ('lily_patch', 'furniture', 'garden', 100, 1, 0, 63),
  ('lantern',    'furniture', 'garden', 120, 1, 0, 64),
  ('swing',      'furniture', 'garden', 180, 1, 0, 65),
  ('pond',       'furniture', 'garden', 220, 1, 0, 66),
  ('sakura',     'furniture', 'garden', 300, 20, 0, 67),
  -- wallpaper and floors
  ('wall_mint',  'wall', null, 80, 1, 0, 70),
  ('wall_pink',  'wall', null, 80, 1, 0, 71),
  ('wall_sky',   'wall', null, 80, 1, 0, 72),
  ('wall_wood',  'wall', null, 120, 4, 0, 73),
  ('wall_stars', 'wall', null, 200, 8, 0, 74),
  ('floor_dark',   'floor', null, 80, 1, 0, 80),
  ('floor_tile',   'floor', null, 100, 1, 0, 81),
  ('floor_carpet', 'floor', null, 110, 3, 0, 82),
  ('floor_tatami', 'floor', null, 120, 5, 0, 83),
  -- hats
  ('hat_leaf',       'hat', null, 50, 1, 0, 90),
  ('hat_orange',     'hat', null, 60, 1, 0, 91),
  ('hat_blossom',    'hat', null, 70, 1, 0, 92),
  ('hat_lily',       'hat', null, 80, 1, 0, 93),
  ('hat_bow',        'hat', null, 90, 1, 0, 94),
  ('hat_party',      'hat', null, 100, 2, 0, 95),
  ('hat_strawberry', 'hat', null, 110, 3, 0, 96),
  ('hat_beanie',     'hat', null, 120, 4, 0, 97),
  ('hat_straw',      'hat', null, 130, 5, 0, 98),
  ('hat_chef',       'hat', null, 150, 6, 0, 99),
  ('hat_frog',       'hat', null, 160, 7, 0, 100),
  ('hat_santa',      'hat', null, 180, 8, 0, 101),
  ('hat_grad',       'hat', null, 200, 10, 0, 102),
  ('hat_wizard',     'hat', null, 220, 12, 0, 103),
  ('hat_halo',       'hat', null, 300, 18, 0, 104),
  ('hat_crown',      'hat', null, 500, 25, 0, 105),
  -- accessories
  ('acc_blush',      'accessory', null, 50, 1, 0, 110),
  ('acc_lei',        'accessory', null, 60, 1, 0, 111),
  ('acc_bell',       'accessory', null, 65, 1, 0, 112),
  ('acc_bowtie',     'accessory', null, 70, 2, 0, 113),
  ('acc_bandana',    'accessory', null, 75, 3, 0, 114),
  ('acc_scarf',      'accessory', null, 80, 4, 0, 115),
  ('acc_glasses',    'accessory', null, 90, 6, 0, 116),
  ('acc_sunglasses', 'accessory', null, 120, 9, 0, 117);

-- How each room is decorated (wallpaper and floor), once someone has chosen.
create table public.pet_rooms (
  room_key text primary key check (room_key in ('living', 'kitchen', 'bedroom', 'bathroom')),
  wall text,
  floor text
);

-- A running focus session: one per person at most.
create table public.pet_focus (
  user_id uuid primary key
    constraint pet_focus_user_id_fkey references public.profiles (id) on delete cascade,
  started_at timestamptz not null default now()
);

alter table public.pet_shop enable row level security;
alter table public.pet_rooms enable row level security;
alter table public.pet_focus enable row level security;

revoke all on table public.pet_shop, public.pet_rooms, public.pet_focus from public, anon, authenticated;
grant select on table public.pet_shop, public.pet_rooms, public.pet_focus to authenticated;

create policy "Members can see the price list"
  on public.pet_shop for select to authenticated using ((select private.is_member()));
create policy "Members can see the rooms"
  on public.pet_rooms for select to authenticated using ((select private.is_member()));
create policy "Members can see who is focusing"
  on public.pet_focus for select to authenticated using ((select private.is_member()));

-- 3. Caring, now with a teamwork bonus ----------------------------------------
-- The first time each day (Manila time) that BOTH of you have cared for the
-- pet, the one who completes the pair earns 10 extra coins for the household.
create or replace function public.pet_care(p_action text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pet public.pet%rowtype;
  v_last timestamptz;
  v_hours numeric;
  v_coins integer;
  v_level numeric;
  v_today date := (now() at time zone 'Asia/Manila')::date;
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

  insert into public.pet_log (user_id, action) values (auth.uid(), p_action);

  if not exists (
       select 1 from public.pet_log l
       where l.action = 'teamwork' and (l.created_at at time zone 'Asia/Manila')::date = v_today)
     and (select count(distinct l.user_id) from public.pet_log l
          where l.action in ('feed', 'water', 'play', 'bathe')
            and (l.created_at at time zone 'Asia/Manila')::date = v_today) >= 2 then
    v_coins := v_coins + 10;
    insert into public.pet_log (user_id, action) values (auth.uid(), 'teamwork');
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

  return v_coins;
end;
$$;

-- 4. The shop, now reading the price list --------------------------------------
create or replace function public.pet_buy(p_item text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item public.pet_shop%rowtype;
  v_pet public.pet%rowtype;
begin
  if not private.is_member() then
    raise exception 'Only members can shop for the pet.' using errcode = '42501';
  end if;

  select * into v_item from public.pet_shop s where s.item_key = p_item;
  if not found then
    raise exception 'The shop does not sell that.';
  end if;

  select * into v_pet from public.pet where id = 1 for update;
  if v_pet.love / 30 + 1 < v_item.min_level then
    raise exception 'Your pet needs to reach level % first.', v_item.min_level;
  end if;
  if v_pet.coins < v_item.price then
    raise exception 'Not enough coins yet.';
  end if;

  if v_item.kind = 'food' then
    update public.pet set coins = coins - v_item.price, food = food + v_item.amount where id = 1;
  elsif v_item.kind = 'treat' then
    update public.pet set coins = coins - v_item.price, love = love + v_item.amount where id = 1;
  else
    if exists (select 1 from public.pet_items i where i.item_key = p_item) then
      raise exception 'You already have that.';
    end if;
    if v_item.kind = 'furniture' and v_item.room <> 'living'
       and not exists (select 1 from public.pet_items i where i.item_key = 'room_' || v_item.room) then
      raise exception 'Unlock that room first.';
    end if;
    insert into public.pet_items (item_key, bought_by) values (p_item, auth.uid());
    update public.pet set coins = coins - v_item.price where id = 1;
  end if;

  insert into public.pet_log (user_id, action) values (auth.uid(), 'buy:' || p_item);
  return v_pet.coins - v_item.price;
end;
$$;

-- Put on a hat or an accessory the pet owns, or take it off (pass null).
create function public.pet_dress(p_slot text, p_item text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_member() then
    raise exception 'Only members can dress the pet.' using errcode = '42501';
  end if;
  if p_slot is null or p_slot not in ('hat', 'accessory') then
    raise exception 'The pet wears a hat and an accessory.';
  end if;
  if p_item is not null and not exists (
    select 1 from public.pet_items i join public.pet_shop s on s.item_key = i.item_key
    where i.item_key = p_item and s.kind = p_slot
  ) then
    raise exception 'The pet does not own that.';
  end if;
  if p_slot = 'hat' then
    update public.pet set wearing = p_item where id = 1;
  else
    update public.pet set accessory = p_item where id = 1;
  end if;
end;
$$;

-- Choose the wallpaper and floor of a room (null means the plain one).
create function public.pet_style(p_room text, p_wall text, p_floor text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_member() then
    raise exception 'Only members can decorate.' using errcode = '42501';
  end if;
  if p_room is null or p_room not in ('living', 'kitchen', 'bedroom', 'bathroom') then
    raise exception 'That room cannot be decorated.';
  end if;
  if p_room <> 'living' and not exists (select 1 from public.pet_items i where i.item_key = 'room_' || p_room) then
    raise exception 'Unlock that room first.';
  end if;
  if p_wall is not null and not exists (
    select 1 from public.pet_items i join public.pet_shop s on s.item_key = i.item_key
    where i.item_key = p_wall and s.kind = 'wall') then
    raise exception 'You do not have that wallpaper.';
  end if;
  if p_floor is not null and not exists (
    select 1 from public.pet_items i join public.pet_shop s on s.item_key = i.item_key
    where i.item_key = p_floor and s.kind = 'floor') then
    raise exception 'You do not have that floor.';
  end if;
  insert into public.pet_rooms (room_key, wall, floor) values (p_room, p_wall, p_floor)
  on conflict (room_key) do update set wall = excluded.wall, floor = excluded.floor;
end;
$$;

-- 5. The focus timer -----------------------------------------------------------
-- Start a 25-minute session. The clock is the database's, so closing the site
-- does not stop it. Finishing pays 8 coins, up to 6 times a day for each of you.
create function public.pet_focus_start()
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := now();
begin
  if not private.is_member() then
    raise exception 'Only members can focus here.' using errcode = '42501';
  end if;
  insert into public.pet_focus (user_id, started_at) values (auth.uid(), v_now)
  on conflict (user_id) do update set started_at = excluded.started_at;
  return v_now;
end;
$$;

create function public.pet_focus_cancel()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.pet_focus where user_id = auth.uid();
$$;

create function public.pet_focus_finish()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_started timestamptz;
  v_done integer;
  v_today date := (now() at time zone 'Asia/Manila')::date;
begin
  if not private.is_member() then
    raise exception 'Only members can focus here.' using errcode = '42501';
  end if;
  select started_at into v_started from public.pet_focus where user_id = auth.uid();
  if not found then
    raise exception 'No focus session is running.';
  end if;
  if now() - v_started < interval '24 minutes 30 seconds' then
    raise exception 'The timer has not finished yet.';
  end if;
  delete from public.pet_focus where user_id = auth.uid();

  perform 1 from public.pet where id = 1 for update;
  select count(*) into v_done from public.pet_log l
  where l.user_id = auth.uid() and l.action = 'focus'
    and (l.created_at at time zone 'Asia/Manila')::date = v_today;

  if v_done >= 6 then
    insert into public.pet_log (user_id, action) values (auth.uid(), 'focus_extra');
    update public.pet set love = love + 1 where id = 1;
    return 0;   -- today's coins are all earned; the pet still loved the company
  end if;

  insert into public.pet_log (user_id, action) values (auth.uid(), 'focus');
  update public.pet set coins = coins + 8, love = love + 2 where id = 1;
  return 8;
end;
$$;

-- 6. A small daily gift: 5 coins the first time each of you visits each day ----
create function public.pet_daily()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_today date := (now() at time zone 'Asia/Manila')::date;
begin
  if not private.is_member() then
    raise exception 'Only members can visit the pet.' using errcode = '42501';
  end if;
  perform 1 from public.pet where id = 1 for update;
  if exists (
    select 1 from public.pet_log l
    where l.user_id = auth.uid() and l.action = 'daily'
      and (l.created_at at time zone 'Asia/Manila')::date = v_today) then
    return 0;
  end if;
  insert into public.pet_log (user_id, action) values (auth.uid(), 'daily');
  update public.pet set coins = coins + 5 where id = 1;
  return 5;
end;
$$;

revoke all on function public.pet_dress(text, text) from public, anon, authenticated;
revoke all on function public.pet_style(text, text, text) from public, anon, authenticated;
revoke all on function public.pet_focus_start() from public, anon, authenticated;
revoke all on function public.pet_focus_cancel() from public, anon, authenticated;
revoke all on function public.pet_focus_finish() from public, anon, authenticated;
revoke all on function public.pet_daily() from public, anon, authenticated;
grant execute on function public.pet_dress(text, text) to authenticated;
grant execute on function public.pet_style(text, text, text) to authenticated;
grant execute on function public.pet_focus_start() to authenticated;
grant execute on function public.pet_focus_cancel() to authenticated;
grant execute on function public.pet_focus_finish() to authenticated;
grant execute on function public.pet_daily() to authenticated;

-- 7. Our Reviews: places you went and things you watched -----------------------
create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  category text not null check (category in ('cafe', 'restaurant', 'movie', 'show', 'place', 'other')),
  title text not null check (char_length(btrim(title)) between 1 and 120),
  place text check (place is null or char_length(place) <= 120),   -- where: a branch, a cinema, "at home"
  visited_on date not null,
  created_by uuid default auth.uid()
    constraint reviews_created_by_fkey references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index reviews_visited_idx on public.reviews (visited_on desc);

-- Each of you gives your own stars and words.
create table public.review_ratings (
  review_id uuid not null
    constraint review_ratings_review_id_fkey references public.reviews (id) on delete cascade,
  user_id uuid not null default auth.uid()
    constraint review_ratings_user_id_fkey references public.profiles (id) on delete cascade,
  stars smallint not null check (stars between 1 and 5),
  comment text check (comment is null or char_length(comment) <= 2000),
  updated_at timestamptz not null default now(),
  primary key (review_id, user_id)
);

alter table public.reviews enable row level security;
alter table public.review_ratings enable row level security;

revoke all on table public.reviews, public.review_ratings from public, anon, authenticated;
grant select, insert, delete on table public.reviews to authenticated;
grant update (category, title, place, visited_on) on table public.reviews to authenticated;
grant select, insert, delete on table public.review_ratings to authenticated;
grant update (stars, comment, updated_at) on table public.review_ratings to authenticated;

create policy "Members can view reviews"
  on public.reviews for select to authenticated using ((select private.is_member()));
create policy "Members can add reviews"
  on public.reviews for insert to authenticated
  with check ((select private.is_member()) and created_by = (select auth.uid()));
create policy "Members can edit reviews"
  on public.reviews for update to authenticated
  using ((select private.is_member())) with check ((select private.is_member()));
create policy "Members can remove reviews"
  on public.reviews for delete to authenticated using ((select private.is_member()));

create policy "Members can view ratings"
  on public.review_ratings for select to authenticated using ((select private.is_member()));
create policy "Members can add their own rating"
  on public.review_ratings for insert to authenticated
  with check ((select private.is_member()) and user_id = (select auth.uid()));
create policy "Members can change their own rating"
  on public.review_ratings for update to authenticated
  using (user_id = (select auth.uid()) and (select private.is_member()))
  with check (user_id = (select auth.uid()));
create policy "Members can remove their own rating"
  on public.review_ratings for delete to authenticated
  using (user_id = (select auth.uid()) and (select private.is_member()));

commit;

-- Confirmation: this should show 78 things in the shop.
select count(*) as things_in_the_shop from public.pet_shop;
