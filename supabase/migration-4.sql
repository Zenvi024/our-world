-- =============================================================================
-- Our Little World: database add-on 4 (the hunger bar)
--
-- Run this AFTER the first three files, once: Supabase dashboard > SQL Editor >
-- New query > paste this whole file > Run. It adds one column to the moods
-- table and changes nothing else.
-- =============================================================================

begin;

-- How well fed each of you is, from 0 to 5 drumsticks. Empty until first set.
alter table public.moods
  add column hunger smallint check (hunger between 0 and 5);

grant update (hunger) on table public.moods to authenticated;

commit;

-- Confirmation: this should show the hunger column.
select column_name, data_type
from information_schema.columns
where table_schema = 'public' and table_name = 'moods'
order by ordinal_position;
