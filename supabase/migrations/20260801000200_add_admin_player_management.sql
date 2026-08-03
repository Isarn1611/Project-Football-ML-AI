grant select, update on table public.fm_players
  to service_role;

create or replace function public.admin_update_player(
  p_actor_user_id uuid,
  p_player_uid text,
  p_changes jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  actor_role public.app_role;
  previous_player public.fm_players%rowtype;
  proposed_player public.fm_players%rowtype;
  changed_player public.fm_players%rowtype;
  allowed_keys constant text[] := array[
    'Club',
    'Age',
    'Nationality',
    'Position',
    'ca',
    'pa',
    'Values',
    'Salary'
  ];
  before_snapshot jsonb;
  after_snapshot jsonb;
begin
  select role
  into actor_role
  from public.user_roles
  where user_id = p_actor_user_id;

  if actor_role is distinct from 'admin'::public.app_role then
    raise exception 'ACTOR_NOT_ADMIN' using errcode = 'P0001';
  end if;

  if p_player_uid is null or btrim(p_player_uid) = '' then
    raise exception 'INVALID_PLAYER_UID' using errcode = 'P0001';
  end if;

  if p_changes is null
    or jsonb_typeof(p_changes) <> 'object'
    or (p_changes - allowed_keys) <> '{}'::jsonb then
    raise exception 'INVALID_PLAYER_CHANGES' using errcode = 'P0001';
  end if;

  select *
  into previous_player
  from public.fm_players
  where "UID"::text = btrim(p_player_uid)
  for update;

  if not found then
    raise exception 'PLAYER_NOT_FOUND' using errcode = 'P0001';
  end if;

  select *
  into proposed_player
  from jsonb_populate_record(previous_player, p_changes);

  if char_length(coalesce(proposed_player."Club", '')) > 120
    or proposed_player."Nationality" is null
    or btrim(proposed_player."Nationality") = ''
    or char_length(proposed_player."Nationality") > 120
    or proposed_player."Position" is null
    or btrim(proposed_player."Position") = ''
    or char_length(proposed_player."Position") > 120 then
    raise exception 'INVALID_PLAYER_TEXT' using errcode = 'P0001';
  end if;

  if proposed_player."Age" is null
    or proposed_player."Age" < 15
    or proposed_player."Age" > 60 then
    raise exception 'INVALID_PLAYER_AGE' using errcode = 'P0001';
  end if;

  if proposed_player.ca is null
    or proposed_player.ca < 0
    or proposed_player.ca > 200
    or proposed_player.pa is null
    or proposed_player.pa < 0
    or proposed_player.pa > 200 then
    raise exception 'INVALID_PLAYER_ABILITY' using errcode = 'P0001';
  end if;

  if proposed_player."Values" is null
    or proposed_player."Values" < -1
    or proposed_player."Salary" is null
    or proposed_player."Salary" < 0 then
    raise exception 'INVALID_PLAYER_FINANCE' using errcode = 'P0001';
  end if;

  before_snapshot := jsonb_build_object(
    'UID', previous_player."UID",
    'Name', previous_player."Name",
    'Club', previous_player."Club",
    'Age', previous_player."Age",
    'Nationality', previous_player."Nationality",
    'Position', previous_player."Position",
    'ca', previous_player.ca,
    'pa', previous_player.pa,
    'Values', previous_player."Values",
    'Salary', previous_player."Salary"
  );

  update public.fm_players as player
  set
    "Club" = proposed_player."Club",
    "Age" = proposed_player."Age",
    "Nationality" = proposed_player."Nationality",
    "Position" = proposed_player."Position",
    ca = proposed_player.ca,
    pa = proposed_player.pa,
    "Values" = proposed_player."Values",
    "Salary" = proposed_player."Salary"
  where player."UID"::text = btrim(p_player_uid)
  returning player.* into changed_player;

  after_snapshot := jsonb_build_object(
    'UID', changed_player."UID",
    'Name', changed_player."Name",
    'Club', changed_player."Club",
    'Age', changed_player."Age",
    'Nationality', changed_player."Nationality",
    'Position', changed_player."Position",
    'ca', changed_player.ca,
    'pa', changed_player.pa,
    'Values', changed_player."Values",
    'Salary', changed_player."Salary"
  );

  if before_snapshot is distinct from after_snapshot then
    insert into public.admin_audit_logs (
      admin_user_id,
      action,
      target_type,
      target_id,
      before_data,
      after_data,
      metadata
    )
    values (
      p_actor_user_id,
      'player.updated',
      'player',
      changed_player."UID"::text,
      before_snapshot,
      after_snapshot,
      jsonb_build_object('source', 'admin_api')
    );
  end if;

  return after_snapshot;
end;
$$;

revoke execute on function public.admin_update_player(uuid, text, jsonb)
  from public, anon, authenticated;

grant execute on function public.admin_update_player(uuid, text, jsonb)
  to service_role;

comment on function public.admin_update_player(uuid, text, jsonb) is
  'Atomically updates approved player fields and records changed values.';
