-- EPR-Simex PLATFORM development SQL (draft; NOT certified for production).
-- Adapted from the user's own connected Lovable EPR-Simex Platform foundation.
-- SECURITY: Do not insert real agency data until this migration is executed in a NEW
-- isolated test Supabase instance and all cross-tenant/team/role RLS tests pass.
-- Review all definer functions, object storage policies, rate limiting and backups.

-- ===== ENUMS =====
create type public.org_role as enum ('org_admin','facilitator','member');
create type public.membership_status as enum ('active','pending','suspended');
create type public.exercise_role as enum ('director','facilitator','participant','observer','support_actor');
create type public.exercise_status as enum ('draft','published','live','paused','completed','archived');
create type public.team_kind as enum ('team','support_cell');
create type public.inject_status as enum ('draft','scheduled','released');
create type public.submission_status as enum ('draft','submitted','returned','accepted');
create type public.doc_visibility as enum ('facilitators','team','exercise','org');
create type public.session_type as enum ('presentation','exercise','break','debrief','other');
create type public.message_channel as enum ('team','facilitators','support');
create type public.invite_status as enum ('pending','accepted','revoked');

-- ===== TABLES =====
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  email text not null default '',
  created_at timestamptz not null default now()
);

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 120),
  description text not null default '',
  created_by uuid not null,
  created_at timestamptz not null default now()
);

create table public.org_memberships (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null,
  role public.org_role not null default 'member',
  status public.membership_status not null default 'active',
  created_at timestamptz not null default now(),
  unique (org_id, user_id)
);
create index on public.org_memberships(user_id);

create table public.exercises (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  title text not null check (char_length(title) between 2 and 200),
  description text not null default '',
  objectives text not null default '',
  scenario_summary text not null default '',
  start_date date,
  end_date date,
  num_days int not null default 1 check (num_days between 1 and 30),
  timezone text not null default 'UTC',
  status public.exercise_status not null default 'draft',
  current_stage_id uuid,
  template_key text,
  created_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.exercises(org_id);

create table public.exercise_memberships (
  id uuid primary key default gen_random_uuid(),
  exercise_id uuid not null references public.exercises(id) on delete cascade,
  org_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null,
  role public.exercise_role not null,
  created_at timestamptz not null default now(),
  unique (exercise_id, user_id)
);
create index on public.exercise_memberships(user_id);
create index on public.exercise_memberships(org_id);

create table public.teams (
  id uuid primary key default gen_random_uuid(),
  exercise_id uuid not null references public.exercises(id) on delete cascade,
  org_id uuid not null references public.organizations(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  kind public.team_kind not null default 'team',
  description text not null default '',
  created_at timestamptz not null default now()
);
create index on public.teams(exercise_id);

create table public.team_memberships (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  exercise_id uuid not null references public.exercises(id) on delete cascade,
  org_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null,
  team_role text not null default '',
  created_at timestamptz not null default now(),
  unique (team_id, user_id)
);
create index on public.team_memberships(user_id);
create index on public.team_memberships(exercise_id);

create table public.stages (
  id uuid primary key default gen_random_uuid(),
  exercise_id uuid not null references public.exercises(id) on delete cascade,
  org_id uuid not null references public.organizations(id) on delete cascade,
  position int not null default 0,
  code text not null default '',
  name text not null,
  description text not null default '',
  created_at timestamptz not null default now()
);
create index on public.stages(exercise_id);

create table public.injects (
  id uuid primary key default gen_random_uuid(),
  exercise_id uuid not null references public.exercises(id) on delete cascade,
  org_id uuid not null references public.organizations(id) on delete cascade,
  stage_id uuid references public.stages(id) on delete set null,
  position int not null default 0,
  title text not null check (char_length(title) between 1 and 200),
  body text not null default '',
  response_prompt text not null default '',
  requires_response boolean not null default true,
  status public.inject_status not null default 'draft',
  scheduled_at timestamptz,
  released_at timestamptz,
  due_at timestamptz,
  parent_inject_id uuid references public.injects(id) on delete set null,
  created_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.injects(exercise_id);
create index on public.injects(org_id);

create table public.inject_targets (
  id uuid primary key default gen_random_uuid(),
  inject_id uuid not null references public.injects(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  exercise_id uuid not null references public.exercises(id) on delete cascade,
  org_id uuid not null references public.organizations(id) on delete cascade,
  unique (inject_id, team_id)
);
create index on public.inject_targets(exercise_id);
create index on public.inject_targets(team_id);

create table public.private_notes (
  id uuid primary key default gen_random_uuid(),
  exercise_id uuid not null references public.exercises(id) on delete cascade,
  org_id uuid not null references public.organizations(id) on delete cascade,
  subject_type text not null check (subject_type in ('inject','session','slide')),
  subject_id uuid not null,
  body text not null default '',
  updated_at timestamptz not null default now(),
  unique (subject_type, subject_id)
);
create index on public.private_notes(exercise_id);

create table public.acknowledgments (
  id uuid primary key default gen_random_uuid(),
  inject_id uuid not null references public.injects(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  exercise_id uuid not null references public.exercises(id) on delete cascade,
  org_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null,
  created_at timestamptz not null default now(),
  unique (inject_id, team_id, user_id)
);
create index on public.acknowledgments(exercise_id);

create table public.agenda_days (
  id uuid primary key default gen_random_uuid(),
  exercise_id uuid not null references public.exercises(id) on delete cascade,
  org_id uuid not null references public.organizations(id) on delete cascade,
  day_number int not null default 1,
  title text not null default '',
  day_date date,
  unique (exercise_id, day_number)
);

create table public.agenda_sessions (
  id uuid primary key default gen_random_uuid(),
  day_id uuid not null references public.agenda_days(id) on delete cascade,
  exercise_id uuid not null references public.exercises(id) on delete cascade,
  org_id uuid not null references public.organizations(id) on delete cascade,
  position int not null default 0,
  start_time time,
  end_time time,
  title text not null,
  session_type public.session_type not null default 'presentation',
  learning_objectives text not null default '',
  instructions text not null default '',
  stage_id uuid references public.stages(id) on delete set null,
  created_at timestamptz not null default now()
);
create index on public.agenda_sessions(exercise_id);

create table public.slides (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.agenda_sessions(id) on delete cascade,
  exercise_id uuid not null references public.exercises(id) on delete cascade,
  org_id uuid not null references public.organizations(id) on delete cascade,
  position int not null default 0,
  title text not null default '',
  body text not null default ''
);
create index on public.slides(session_id);

create table public.document_records (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  exercise_id uuid references public.exercises(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  description text not null default '',
  kind text not null check (kind in ('link','file')),
  category text not null default 'reference',
  url text,
  storage_path text unique,
  mime_type text,
  size_bytes bigint,
  version text not null default '1.0',
  effective_date date,
  visibility public.doc_visibility not null default 'facilitators',
  team_id uuid references public.teams(id) on delete set null,
  inject_id uuid references public.injects(id) on delete set null,
  session_id uuid references public.agenda_sessions(id) on delete set null,
  owner_id uuid not null,
  created_at timestamptz not null default now()
);
create index on public.document_records(org_id);
create index on public.document_records(exercise_id);

create table public.submissions (
  id uuid primary key default gen_random_uuid(),
  inject_id uuid not null references public.injects(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  exercise_id uuid not null references public.exercises(id) on delete cascade,
  org_id uuid not null references public.organizations(id) on delete cascade,
  body text not null default '',
  status public.submission_status not null default 'draft',
  updated_by uuid,
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (inject_id, team_id)
);
create index on public.submissions(exercise_id);

create table public.submission_revisions (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.submissions(id) on delete cascade,
  exercise_id uuid not null references public.exercises(id) on delete cascade,
  org_id uuid not null references public.organizations(id) on delete cascade,
  team_id uuid not null,
  body text not null,
  status public.submission_status not null,
  actor_id uuid,
  created_at timestamptz not null default now()
);
create index on public.submission_revisions(submission_id);

create table public.decisions (
  id uuid primary key default gen_random_uuid(),
  exercise_id uuid not null references public.exercises(id) on delete cascade,
  org_id uuid not null references public.organizations(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  inject_id uuid references public.injects(id) on delete set null,
  decision text not null,
  rationale text not null default '',
  refs text not null default '',
  authority text not null default '',
  owner_name text not null default '',
  deadline timestamptz,
  residual_risk text not null default '',
  created_by uuid not null,
  created_at timestamptz not null default now()
);
create index on public.decisions(exercise_id);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  exercise_id uuid not null references public.exercises(id) on delete cascade,
  org_id uuid not null references public.organizations(id) on delete cascade,
  sender_id uuid not null,
  team_id uuid references public.teams(id) on delete cascade,
  to_team_id uuid references public.teams(id) on delete cascade,
  channel public.message_channel not null default 'team',
  persona text,
  body text not null check (char_length(body) between 1 and 4000),
  created_at timestamptz not null default now()
);
create index on public.messages(exercise_id);

create table public.observations (
  id uuid primary key default gen_random_uuid(),
  exercise_id uuid not null references public.exercises(id) on delete cascade,
  org_id uuid not null references public.organizations(id) on delete cascade,
  observer_id uuid not null,
  team_id uuid references public.teams(id) on delete set null,
  inject_id uuid references public.injects(id) on delete set null,
  competency text not null default '',
  rating int check (rating between 1 and 5),
  note text not null check (char_length(note) between 1 and 4000),
  observed_at timestamptz not null default now()
);
create index on public.observations(exercise_id);

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.submissions(id) on delete cascade,
  exercise_id uuid not null references public.exercises(id) on delete cascade,
  org_id uuid not null references public.organizations(id) on delete cascade,
  team_id uuid not null,
  reviewer_id uuid not null,
  decision text not null check (decision in ('accepted','returned','comment')),
  comment text not null default '',
  scores jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index on public.reviews(exercise_id);

create table public.action_items (
  id uuid primary key default gen_random_uuid(),
  exercise_id uuid not null references public.exercises(id) on delete cascade,
  org_id uuid not null references public.organizations(id) on delete cascade,
  horizon int not null check (horizon in (30,60,90)),
  action text not null,
  owner_name text not null default '',
  created_by uuid not null,
  created_at timestamptz not null default now()
);

create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  exercise_id uuid references public.exercises(id) on delete cascade,
  team_id uuid references public.teams(id) on delete set null,
  email text not null check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  org_role public.org_role not null default 'member',
  exercise_role public.exercise_role,
  token text not null unique default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  status public.invite_status not null default 'pending',
  invited_by uuid not null,
  expires_at timestamptz not null default now() + interval '14 days',
  created_at timestamptz not null default now()
);
create index on public.invitations(org_id);

create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  org_id uuid,
  exercise_id uuid,
  actor_id uuid,
  action text not null,
  target_id uuid,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index on public.audit_events(org_id);
create index on public.audit_events(exercise_id);

-- ===== GRANTS (no anon access anywhere) =====
do $$ declare t text; begin
  foreach t in array array['profiles','organizations','org_memberships','exercises','exercise_memberships','teams','team_memberships','stages','injects','inject_targets','private_notes','acknowledgments','agenda_days','agenda_sessions','slides','document_records','submissions','submission_revisions','decisions','messages','observations','reviews','action_items','invitations','audit_events'] loop
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('grant all on public.%I to service_role', t);
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;
revoke insert, update, delete on public.audit_events from authenticated;
revoke insert, update, delete on public.submission_revisions from authenticated;
revoke insert on public.organizations from authenticated;

-- ===== HELPER FUNCTIONS (minimal SECURITY DEFINER, read-only, fixed search_path) =====
create or replace function public.is_org_member(_org uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists(select 1 from org_memberships where org_id=_org and user_id=auth.uid() and status='active')
$$;
create or replace function public.has_org_role(_org uuid, _roles public.org_role[]) returns boolean
language sql stable security definer set search_path = public as $$
  select exists(select 1 from org_memberships where org_id=_org and user_id=auth.uid() and status='active' and role = any(_roles))
$$;
create or replace function public.user_in_org(_org uuid, _user uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists(select 1 from org_memberships where org_id=_org and user_id=_user and status='active')
$$;
create or replace function public.shares_org(_user uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists(select 1 from org_memberships a join org_memberships b on a.org_id=b.org_id
    where a.user_id=auth.uid() and a.status='active' and b.user_id=_user)
$$;
create or replace function public.exercise_role_of(_ex uuid) returns public.exercise_role
language sql stable security definer set search_path = public as $$
  select em.role from exercise_memberships em
  join exercises e on e.id=em.exercise_id
  join org_memberships om on om.org_id=e.org_id and om.user_id=em.user_id and om.status='active'
  where em.exercise_id=_ex and em.user_id=auth.uid() limit 1
$$;
create or replace function public.is_ex_member(_ex uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.exercise_role_of(_ex) is not null
$$;
create or replace function public.is_ex_staff(_ex uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.exercise_role_of(_ex) in ('director','facilitator'), false)
$$;
create or replace function public.is_ex_overseer(_ex uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.exercise_role_of(_ex) in ('director','facilitator','observer'), false)
$$;
create or replace function public.is_team_member(_team uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists(select 1 from team_memberships tm where tm.team_id=_team and tm.user_id=auth.uid()
    and public.is_ex_member(tm.exercise_id))
$$;
create or replace function public.team_kind_of(_team uuid) returns public.team_kind
language sql stable security definer set search_path = public as $$
  select kind from teams where id=_team
$$;
create or replace function public.inject_is_released(_status public.inject_status, _scheduled timestamptz) returns boolean
language sql immutable as $$
  select _status='released' or (_status='scheduled' and _scheduled is not null and _scheduled <= now())
$$;
-- note: uses now(), so mark stable instead of immutable
alter function public.inject_is_released(public.inject_status, timestamptz) stable;

create or replace function public.can_view_inject(_inject uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists(select 1 from injects i join exercises e on e.id=i.exercise_id where i.id=_inject and (
    public.is_ex_staff(i.exercise_id)
    or (e.status in ('live','paused','completed') and public.inject_is_released(i.status, i.scheduled_at) and (
      public.exercise_role_of(i.exercise_id)='observer'
      or exists(select 1 from inject_targets t join team_memberships tm on tm.team_id=t.team_id
                where t.inject_id=i.id and tm.user_id=auth.uid() and public.is_ex_member(i.exercise_id))
    ))))
$$;
create or replace function public.can_view_document(_doc uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists(select 1 from document_records d where d.id=_doc and public.is_org_member(d.org_id) and (
    (d.exercise_id is not null and public.is_ex_staff(d.exercise_id))
    or (d.exercise_id is null and public.has_org_role(d.org_id, array['org_admin','facilitator']::public.org_role[]))
    or ((d.inject_id is null or public.can_view_inject(d.inject_id)) and (
         d.visibility='org'
      or (d.visibility='exercise' and d.exercise_id is not null and public.is_ex_member(d.exercise_id))
      or (d.visibility='team' and d.team_id is not null and public.is_team_member(d.team_id))
    ))))
$$;
create or replace function public.can_manage_doc_scope(_org uuid, _ex uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select case when _ex is null then public.has_org_role(_org, array['org_admin','facilitator']::public.org_role[])
    else exists(select 1 from exercises where id=_ex and org_id=_org) and public.is_ex_staff(_ex) end
$$;
create or replace function public.can_read_storage_object(_name text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists(select 1 from document_records d where d.storage_path=_name and public.can_view_document(d.id))
$$;
create or replace function public.can_upload_storage_object(_name text) returns boolean
language plpgsql stable security definer set search_path = public as $$
declare p1 text := split_part(_name,'/',1); p2 text := split_part(_name,'/',2);
begin
  if p1 !~ '^[0-9a-f-]{36}$' then return false; end if;
  if p2 = 'org' then return public.can_manage_doc_scope(p1::uuid, null); end if;
  if p2 !~ '^[0-9a-f-]{36}$' then return false; end if;
  return public.can_manage_doc_scope(p1::uuid, p2::uuid);
end $$;

-- ===== TRIGGERS: tenant consistency, validation, audit =====
create or replace function public.set_org_from_exercise() returns trigger
language plpgsql security definer set search_path = public as $$
declare o uuid;
begin
  select org_id into o from exercises where id = new.exercise_id;
  if o is null then raise exception 'Exercise not found'; end if;
  new := jsonb_populate_record(new, jsonb_build_object('org_id', o));
  return new;
end $$;
do $$ declare t text; begin
  foreach t in array array['exercise_memberships','teams','team_memberships','stages','injects','inject_targets','private_notes','acknowledgments','agenda_days','agenda_sessions','slides','submissions','decisions','messages','observations','reviews','action_items'] loop
    execute format('create trigger %I before insert or update of exercise_id, org_id on public.%I for each row execute function public.set_org_from_exercise()', 'trg_org_'||t, t);
  end loop;
end $$;

-- child-row exercise consistency
create or replace function public.check_same_exercise() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if TG_TABLE_NAME = 'team_memberships' then
    if not exists(select 1 from teams where id=new.team_id and exercise_id=new.exercise_id) then raise exception 'Team not in exercise'; end if;
    if not exists(select 1 from exercise_memberships where exercise_id=new.exercise_id and user_id=new.user_id) then raise exception 'User must be an exercise member first'; end if;
  elsif TG_TABLE_NAME = 'inject_targets' then
    if not exists(select 1 from teams where id=new.team_id and exercise_id=new.exercise_id) or not exists(select 1 from injects where id=new.inject_id and exercise_id=new.exercise_id) then raise exception 'Target mismatch'; end if;
  elsif TG_TABLE_NAME in ('submissions','acknowledgments') then
    if not exists(select 1 from inject_targets where inject_id=new.inject_id and team_id=new.team_id and exercise_id=new.exercise_id) then raise exception 'Team is not a target of this inject'; end if;
  elsif TG_TABLE_NAME = 'agenda_sessions' then
    if not exists(select 1 from agenda_days where id=new.day_id and exercise_id=new.exercise_id) then raise exception 'Day mismatch'; end if;
  elsif TG_TABLE_NAME = 'slides' then
    if not exists(select 1 from agenda_sessions where id=new.session_id and exercise_id=new.exercise_id) then raise exception 'Session mismatch'; end if;
  elsif TG_TABLE_NAME = 'exercise_memberships' then
    if not public.user_in_org(new.org_id, new.user_id) then raise exception 'User is not an active member of this organization'; end if;
  end if;
  return new;
end $$;
do $$ declare t text; begin
  foreach t in array array['team_memberships','inject_targets','submissions','acknowledgments','agenda_sessions','slides','exercise_memberships'] loop
    execute format('create trigger %I before insert or update on public.%I for each row execute function public.check_same_exercise()', 'trg_same_'||t, t);
  end loop;
end $$;

create or replace function public.audit_row() returns trigger
language plpgsql security definer set search_path = public as $$
declare j jsonb := to_jsonb(coalesce(new, old)); oj jsonb := case when TG_OP='UPDATE' then to_jsonb(old) else null end;
begin
  insert into audit_events(org_id, exercise_id, actor_id, action, target_id, details)
  values (
    case when TG_TABLE_NAME='organizations' then (j->>'id')::uuid else (j->>'org_id')::uuid end,
    case when TG_TABLE_NAME='exercises' then (j->>'id')::uuid else nullif(j->>'exercise_id','')::uuid end,
    auth.uid(), TG_TABLE_NAME || '.' || lower(TG_OP), (j->>'id')::uuid,
    jsonb_strip_nulls(jsonb_build_object(
      'role', j->>'role', 'old_role', oj->>'role', 'status', j->>'status', 'old_status', oj->>'status',
      'title', coalesce(j->>'title', j->>'name'), 'user_id', j->>'user_id', 'email', j->>'email')));
  return coalesce(new, old);
end $$;
do $$ declare t text; begin
  foreach t in array array['org_memberships','exercise_memberships','team_memberships','injects','exercises','invitations','reviews','stages','inject_targets','document_records'] loop
    execute format('create trigger %I after insert or update or delete on public.%I for each row execute function public.audit_row()', 'trg_audit_'||t, t);
  end loop;
end $$;

-- exercise status machine
create or replace function public.exercise_transition() returns trigger
language plpgsql set search_path = public as $$
begin
  new.updated_at := now();
  if TG_OP='INSERT' then
    if new.status <> 'draft' then raise exception 'New exercises start as draft'; end if;
    return new;
  end if;
  if new.org_id <> old.org_id or new.created_by <> old.created_by then raise exception 'Immutable fields'; end if;
  if new.status <> old.status and not (
       (old.status='draft' and new.status in ('published','archived'))
    or (old.status='published' and new.status in ('draft','live','archived'))
    or (old.status='live' and new.status in ('paused','completed'))
    or (old.status='paused' and new.status in ('live','completed'))
    or (old.status='completed' and new.status in ('archived','live'))
    or (old.status='archived' and new.status = 'draft')) then
    raise exception 'Invalid exercise status transition % -> %', old.status, new.status;
  end if;
  return new;
end $$;
create trigger trg_exercise_transition before insert or update on public.exercises for each row execute function public.exercise_transition();

-- add creator as director
create or replace function public.exercise_add_creator() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into exercise_memberships(exercise_id, org_id, user_id, role) values (new.id, new.org_id, new.created_by, 'director')
  on conflict do nothing;
  return new;
end $$;
create trigger trg_exercise_add_creator after insert on public.exercises for each row execute function public.exercise_add_creator();

-- inject release rules
create or replace function public.inject_guard() returns trigger
language plpgsql set search_path = public as $$
declare st public.exercise_status;
begin
  new.updated_at := now();
  if TG_OP='UPDATE' and (new.exercise_id <> old.exercise_id) then raise exception 'Immutable fields'; end if;
  if new.status='released' and (TG_OP='INSERT' or old.status <> 'released') then
    select status into st from exercises where id=new.exercise_id;
    if st not in ('live','paused') then raise exception 'Injects can only be released while the exercise is live or paused'; end if;
    new.released_at := now();
  end if;
  if new.status='scheduled' and new.scheduled_at is null then raise exception 'Scheduled injects need a release time'; end if;
  if TG_OP='UPDATE' and old.status='released' and new.status <> 'released' then raise exception 'Released injects cannot be un-released; issue a follow-up instead'; end if;
  return new;
end $$;
create trigger trg_inject_guard before insert or update on public.injects for each row execute function public.inject_guard();

-- submission state machine + revisions + audit
create or replace function public.submission_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare staff boolean := public.is_ex_staff(new.exercise_id);
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  if TG_OP='INSERT' then
    if new.status not in ('draft','submitted') then raise exception 'Invalid initial status'; end if;
  else
    if new.inject_id<>old.inject_id or new.team_id<>old.team_id or new.exercise_id<>old.exercise_id then raise exception 'Immutable fields'; end if;
    if staff and not public.is_team_member(new.team_id) then
      if new.body <> old.body then raise exception 'Facilitators cannot edit team responses'; end if;
      if new.status <> old.status and not (old.status='submitted' and new.status in ('returned','accepted')) then
        raise exception 'Invalid review transition % -> %', old.status, new.status; end if;
    else
      if old.status in ('submitted','accepted') then raise exception 'Submission is locked (status %)', old.status; end if;
      if new.status not in ('draft','submitted') then raise exception 'Teams may only save or submit'; end if;
    end if;
  end if;
  if new.status='submitted' and (TG_OP='INSERT' or old.status<>'submitted') then new.submitted_at := now(); end if;
  if TG_OP='INSERT' or new.status <> old.status then
    insert into submission_revisions(submission_id, exercise_id, org_id, team_id, body, status, actor_id)
    values (new.id, new.exercise_id, new.org_id, new.team_id, new.body, new.status, auth.uid());
    if new.status <> 'draft' then
      insert into audit_events(org_id, exercise_id, actor_id, action, target_id, details)
      values (new.org_id, new.exercise_id, auth.uid(), 'submissions.'||new.status, new.id, jsonb_build_object('team_id', new.team_id, 'inject_id', new.inject_id));
    end if;
  end if;
  return new;
end $$;
-- revisions FK requires row to exist: run after set_org trigger (alphabetical: trg_org_ < trg_same_ < trg_sub_)
create trigger trg_sub_guard before insert or update on public.submissions for each row execute function public.submission_guard();
alter table public.submission_revisions drop constraint submission_revisions_submission_id_fkey;
alter table public.submission_revisions add constraint submission_revisions_submission_id_fkey foreign key (submission_id) references public.submissions(id) on delete cascade deferrable initially deferred;

-- document validation (backend-side)
create or replace function public.document_guard() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.exercise_id is not null and not exists(select 1 from exercises where id=new.exercise_id and org_id=new.org_id) then raise exception 'Exercise/org mismatch'; end if;
  if new.kind='link' then
    if new.url is null or new.url !~* '^https://[^\s<>"]+$' or char_length(new.url) > 2000 then raise exception 'Links must be https:// URLs'; end if;
    new.storage_path := null;
  else
    if new.storage_path is null then raise exception 'File path required'; end if;
    if split_part(new.storage_path,'/',1) <> new.org_id::text
       or split_part(new.storage_path,'/',2) <> coalesce(new.exercise_id::text,'org') then raise exception 'Storage path outside tenant scope'; end if;
    if new.size_bytes is null or new.size_bytes <= 0 or new.size_bytes > 20971520 then raise exception 'File must be 20 MB or less'; end if;
    if new.mime_type not in ('application/pdf',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/csv','image/png','image/jpeg') then raise exception 'File type not allowed'; end if;
    new.url := null;
  end if;
  if new.visibility='team' and new.team_id is null then raise exception 'Team visibility needs a team'; end if;
  return new;
end $$;
create trigger trg_doc_guard before insert or update on public.document_records for each row execute function public.document_guard();

-- profiles on signup
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles(id, email, display_name) values (new.id, coalesce(new.email,''), coalesce(new.raw_user_meta_data->>'display_name', split_part(coalesce(new.email,''),'@',1)))
  on conflict (id) do nothing;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- ===== RPCs (the only privileged write paths) =====
create or replace function public.create_organization(_name text, _description text default '') returns uuid
language plpgsql security definer set search_path = public as $$
declare oid uuid;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  insert into organizations(name, description, created_by) values (trim(_name), coalesce(_description,''), auth.uid()) returning id into oid;
  insert into org_memberships(org_id, user_id, role, status) values (oid, auth.uid(), 'org_admin', 'active');
  return oid;
end $$;
revoke execute on function public.create_organization(text, text) from public, anon;
grant execute on function public.create_organization(text, text) to authenticated;

create or replace function public.accept_invitation(_token text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare inv invitations; uemail text; confirmed timestamptz;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  select email, email_confirmed_at into uemail, confirmed from auth.users where id=auth.uid();
  if confirmed is null then raise exception 'Verify your email before accepting invitations'; end if;
  select * into inv from invitations where token=_token for update;
  if inv.id is null or inv.status <> 'pending' or inv.expires_at < now() then raise exception 'Invitation is invalid or expired'; end if;
  if lower(inv.email) <> lower(uemail) then raise exception 'This invitation was issued to a different email address'; end if;
  insert into org_memberships(org_id, user_id, role, status) values (inv.org_id, auth.uid(), inv.org_role, 'active')
    on conflict (org_id, user_id) do update set status='active';
  if inv.exercise_id is not null and inv.exercise_role is not null then
    insert into exercise_memberships(exercise_id, org_id, user_id, role) values (inv.exercise_id, inv.org_id, auth.uid(), inv.exercise_role)
      on conflict (exercise_id, user_id) do update set role=excluded.role;
    if inv.team_id is not null then
      insert into team_memberships(team_id, exercise_id, org_id, user_id) values (inv.team_id, inv.exercise_id, inv.org_id, auth.uid()) on conflict do nothing;
    end if;
  end if;
  update invitations set status='accepted' where id=inv.id;
  return jsonb_build_object('org_id', inv.org_id, 'exercise_id', inv.exercise_id);
end $$;
revoke execute on function public.accept_invitation(text) from public, anon;
grant execute on function public.accept_invitation(text) to authenticated;

-- helpers callable by authenticated only
do $$ declare f text; begin
  foreach f in array array['is_org_member(uuid)','has_org_role(uuid, public.org_role[])','user_in_org(uuid, uuid)','shares_org(uuid)','exercise_role_of(uuid)','is_ex_member(uuid)','is_ex_staff(uuid)','is_ex_overseer(uuid)','is_team_member(uuid)','team_kind_of(uuid)','can_view_inject(uuid)','can_view_document(uuid)','can_manage_doc_scope(uuid, uuid)','can_read_storage_object(text)','can_upload_storage_object(text)'] loop
    execute 'revoke execute on function public.'||f||' from public, anon';
    execute 'grant execute on function public.'||f||' to authenticated';
  end loop;
end $$;

-- ===== POLICIES =====
create policy profiles_select on public.profiles for select to authenticated using (id = auth.uid() or public.shares_org(id));
create policy profiles_update on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create policy orgs_select on public.organizations for select to authenticated using (public.is_org_member(id));
create policy orgs_update on public.organizations for update to authenticated using (public.has_org_role(id, array['org_admin']::org_role[])) with check (public.has_org_role(id, array['org_admin']::org_role[]));

create policy om_select on public.org_memberships for select to authenticated using (user_id = auth.uid() or public.is_org_member(org_id));
create policy om_insert on public.org_memberships for insert to authenticated with check (public.has_org_role(org_id, array['org_admin']::org_role[]));
create policy om_update on public.org_memberships for update to authenticated using (public.has_org_role(org_id, array['org_admin']::org_role[]) and user_id <> auth.uid()) with check (public.has_org_role(org_id, array['org_admin']::org_role[]));
create policy om_delete on public.org_memberships for delete to authenticated using (public.has_org_role(org_id, array['org_admin']::org_role[]) and user_id <> auth.uid());

create policy ex_select on public.exercises for select to authenticated using (public.is_ex_member(id) or public.has_org_role(org_id, array['org_admin']::org_role[]));
create policy ex_insert on public.exercises for insert to authenticated with check (created_by = auth.uid() and public.has_org_role(org_id, array['org_admin','facilitator']::org_role[]));
create policy ex_update on public.exercises for update to authenticated using (public.is_ex_staff(id)) with check (public.is_ex_staff(id));

create policy em_select on public.exercise_memberships for select to authenticated using (public.is_ex_member(exercise_id) or public.has_org_role(org_id, array['org_admin']::org_role[]));
create policy em_insert on public.exercise_memberships for insert to authenticated with check (
  public.has_org_role(org_id, array['org_admin']::org_role[])
  or (public.is_ex_staff(exercise_id) and (role <> 'director' or public.exercise_role_of(exercise_id)='director')));
create policy em_update on public.exercise_memberships for update to authenticated using (
  (public.has_org_role(org_id, array['org_admin']::org_role[]) or public.is_ex_staff(exercise_id)) and user_id <> auth.uid())
  with check (public.has_org_role(org_id, array['org_admin']::org_role[]) or (public.is_ex_staff(exercise_id) and (role <> 'director' or public.exercise_role_of(exercise_id)='director')));
create policy em_delete on public.exercise_memberships for delete to authenticated using (
  (public.has_org_role(org_id, array['org_admin']::org_role[]) or public.is_ex_staff(exercise_id)) and user_id <> auth.uid());

-- generic "members read, staff write" tables
do $$ declare t text; begin
  foreach t in array array['teams','stages','agenda_days','agenda_sessions','slides'] loop
    execute format('create policy %I on public.%I for select to authenticated using (public.is_ex_member(exercise_id))', t||'_select', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (public.is_ex_staff(exercise_id))', t||'_insert', t);
    execute format('create policy %I on public.%I for update to authenticated using (public.is_ex_staff(exercise_id)) with check (public.is_ex_staff(exercise_id))', t||'_update', t);
    execute format('create policy %I on public.%I for delete to authenticated using (public.is_ex_staff(exercise_id))', t||'_delete', t);
  end loop;
end $$;
create policy teams_org_admin_select on public.teams for select to authenticated using (public.has_org_role(org_id, array['org_admin']::org_role[]));

create policy tm_select on public.team_memberships for select to authenticated using (public.is_ex_member(exercise_id));
create policy tm_insert on public.team_memberships for insert to authenticated with check (public.is_ex_staff(exercise_id));
create policy tm_update on public.team_memberships for update to authenticated using (public.is_ex_staff(exercise_id)) with check (public.is_ex_staff(exercise_id));
create policy tm_delete on public.team_memberships for delete to authenticated using (public.is_ex_staff(exercise_id));

create policy inj_select on public.injects for select to authenticated using (public.can_view_inject(id));
create policy inj_insert on public.injects for insert to authenticated with check (public.is_ex_staff(exercise_id) and created_by = auth.uid());
create policy inj_update on public.injects for update to authenticated using (public.is_ex_staff(exercise_id)) with check (public.is_ex_staff(exercise_id));
create policy inj_delete on public.injects for delete to authenticated using (public.is_ex_staff(exercise_id) and status <> 'released');

create policy it_select on public.inject_targets for select to authenticated using (public.is_ex_staff(exercise_id) or public.can_view_inject(inject_id));
create policy it_insert on public.inject_targets for insert to authenticated with check (public.is_ex_staff(exercise_id));
create policy it_delete on public.inject_targets for delete to authenticated using (public.is_ex_staff(exercise_id));

create policy pn_all on public.private_notes for all to authenticated using (public.is_ex_staff(exercise_id)) with check (public.is_ex_staff(exercise_id));

create policy ack_select on public.acknowledgments for select to authenticated using (public.is_ex_overseer(exercise_id) or public.is_team_member(team_id));
create policy ack_insert on public.acknowledgments for insert to authenticated with check (user_id = auth.uid() and public.is_team_member(team_id) and public.can_view_inject(inject_id));

create policy doc_select on public.document_records for select to authenticated using (public.can_view_document(id));
create policy doc_insert on public.document_records for insert to authenticated with check (owner_id = auth.uid() and public.can_manage_doc_scope(org_id, exercise_id));
create policy doc_update on public.document_records for update to authenticated using (public.can_manage_doc_scope(org_id, exercise_id)) with check (public.can_manage_doc_scope(org_id, exercise_id));
create policy doc_delete on public.document_records for delete to authenticated using (public.can_manage_doc_scope(org_id, exercise_id));

create policy sub_select on public.submissions for select to authenticated using (public.is_ex_overseer(exercise_id) or public.is_team_member(team_id));
create policy sub_insert on public.submissions for insert to authenticated with check (public.is_team_member(team_id) and public.can_view_inject(inject_id));
create policy sub_update on public.submissions for update to authenticated using (public.is_ex_staff(exercise_id) or (public.is_team_member(team_id) and public.can_view_inject(inject_id))) with check (public.is_ex_staff(exercise_id) or public.is_team_member(team_id));

create policy subrev_select on public.submission_revisions for select to authenticated using (public.is_ex_overseer(exercise_id) or public.is_team_member(team_id));

create policy dec_select on public.decisions for select to authenticated using (public.is_ex_overseer(exercise_id) or public.is_team_member(team_id));
create policy dec_insert on public.decisions for insert to authenticated with check (created_by = auth.uid() and public.is_team_member(team_id));
create policy dec_update on public.decisions for update to authenticated using (public.is_team_member(team_id)) with check (public.is_team_member(team_id));
create policy dec_delete on public.decisions for delete to authenticated using (public.is_team_member(team_id) and created_by = auth.uid());

create policy msg_select on public.messages for select to authenticated using (
  public.is_ex_overseer(exercise_id) or sender_id = auth.uid()
  or (team_id is not null and public.is_team_member(team_id))
  or (to_team_id is not null and public.is_team_member(to_team_id)));
create policy msg_insert on public.messages for insert to authenticated with check (
  sender_id = auth.uid() and public.is_ex_member(exercise_id) and (
    public.is_ex_staff(exercise_id)
    or (team_id is not null and public.is_team_member(team_id)
        and (persona is null or public.team_kind_of(team_id) = 'support_cell')
        and (to_team_id is null or public.team_kind_of(to_team_id) = 'support_cell' or public.team_kind_of(team_id) = 'support_cell'))));

create policy obs_select on public.observations for select to authenticated using (public.is_ex_overseer(exercise_id));
create policy obs_insert on public.observations for insert to authenticated with check (observer_id = auth.uid() and public.is_ex_overseer(exercise_id));
create policy obs_delete on public.observations for delete to authenticated using (observer_id = auth.uid());

create policy rev_select on public.reviews for select to authenticated using (public.is_ex_overseer(exercise_id) or public.is_team_member(team_id));
create policy rev_insert on public.reviews for insert to authenticated with check (reviewer_id = auth.uid() and public.is_ex_staff(exercise_id)
  and exists(select 1 from public.submissions s where s.id = submission_id and s.team_id = reviews.team_id and s.exercise_id = reviews.exercise_id));

create policy ai_select on public.action_items for select to authenticated using (public.is_ex_overseer(exercise_id));
create policy ai_insert on public.action_items for insert to authenticated with check (created_by = auth.uid() and public.is_ex_staff(exercise_id));
create policy ai_delete on public.action_items for delete to authenticated using (public.is_ex_staff(exercise_id));

create policy inv_select on public.invitations for select to authenticated using (
  public.has_org_role(org_id, array['org_admin']::org_role[]) or (exercise_id is not null and public.is_ex_staff(exercise_id)));
create policy inv_insert on public.invitations for insert to authenticated with check (invited_by = auth.uid() and (
  public.has_org_role(org_id, array['org_admin']::org_role[])
  or (exercise_id is not null and org_role = 'member' and public.is_ex_staff(exercise_id)
      and exists(select 1 from public.exercises e where e.id = exercise_id and e.org_id = invitations.org_id)
      and (exercise_role <> 'director' or public.exercise_role_of(exercise_id) = 'director'))));
create policy inv_update on public.invitations for update to authenticated using (
  public.has_org_role(org_id, array['org_admin']::org_role[]) or (exercise_id is not null and public.is_ex_staff(exercise_id)))
  with check (status = 'revoked');

create policy audit_select on public.audit_events for select to authenticated using (
  (org_id is not null and public.has_org_role(org_id, array['org_admin']::org_role[])) or (exercise_id is not null and public.is_ex_staff(exercise_id)));

-- Supabase storage must be provisioned as part of the portable GitHub setup.
-- This is a PRIVATE bucket. Direct public object URLs must not work.
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('documents','documents',false,20971520,array[
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/csv','image/png','image/jpeg'
]) on conflict(id) do update
  set public=false, file_size_limit=excluded.file_size_limit,
      allowed_mime_types=excluded.allowed_mime_types;

-- ===== STORAGE POLICIES (private bucket) =====
create policy "documents read authorized" on storage.objects for select to authenticated using (bucket_id = 'documents' and public.can_read_storage_object(name));
create policy "documents upload scoped" on storage.objects for insert to authenticated with check (bucket_id = 'documents' and public.can_upload_storage_object(name));
create policy "documents delete scoped" on storage.objects for delete to authenticated using (bucket_id = 'documents' and public.can_upload_storage_object(name));

-- ===== REALTIME =====
alter publication supabase_realtime add table public.injects, public.submissions, public.messages, public.acknowledgments, public.exercises;