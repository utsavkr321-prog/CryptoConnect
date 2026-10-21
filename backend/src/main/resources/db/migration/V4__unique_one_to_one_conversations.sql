-- Abort before changing the schema if duplicate two-member pairs already exist.
-- Operators must reconcile those rows and their messages/memberships explicitly.
do $$
begin
  if exists (
    with participant_pairs as (
      select conversation_id,
             (array_agg(user_id order by user_id))[1] as participant_low_id,
             (array_agg(user_id order by user_id))[2] as participant_high_id
      from conversation_members
      group by conversation_id
      having count(*) = 2
    )
    select 1
    from participant_pairs
    group by participant_low_id, participant_high_id
    having count(*) > 1
  ) then
    raise exception 'Duplicate one-to-one conversations exist. Reconcile conversation data explicitly before applying V4.';
  end if;
end $$;

alter table conversations
  add column participant_low_id uuid references users(id),
  add column participant_high_id uuid references users(id),
  add constraint ck_conversations_canonical_pair check (
    (participant_low_id is null and participant_high_id is null)
    or (participant_low_id is not null and participant_high_id is not null and participant_low_id < participant_high_id)
  );

-- Rows with exactly two members are one-to-one. Other legacy rows are left
-- unclassified and outside the partial unique index, preserving group data.
with participant_pairs as (
  select conversation_id,
         (array_agg(user_id order by user_id))[1] as participant_low_id,
         (array_agg(user_id order by user_id))[2] as participant_high_id
  from conversation_members
  group by conversation_id
  having count(*) = 2
)
update conversations c
set participant_low_id = p.participant_low_id,
    participant_high_id = p.participant_high_id
from participant_pairs p
where c.id = p.conversation_id;

create unique index uk_conversations_one_to_one_pair
  on conversations(participant_low_id, participant_high_id)
  where participant_low_id is not null and participant_high_id is not null;
