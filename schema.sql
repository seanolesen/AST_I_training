-- Run this in Supabase: Dashboard > SQL Editor > New query > paste > Run.
-- Safe to run again; uses "if not exists" and "or replace" where possible.

-- 1) Per-run history (used by the AST 1 trainer)
create table if not exists public.runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  payload jsonb not null,
  created_at timestamptz not null default now()
);
alter table public.runs enable row level security;
drop policy if exists "read own runs" on public.runs;
create policy "read own runs" on public.runs for select using (auth.uid() = user_id);
drop policy if exists "insert own runs" on public.runs;
create policy "insert own runs" on public.runs for insert with check (auth.uid() = user_id);
drop policy if exists "delete own runs" on public.runs;
create policy "delete own runs" on public.runs for delete using (auth.uid() = user_id);
create index if not exists runs_user_created_idx on public.runs (user_id, created_at);

-- 2) Per-user document store (used by the slope trainer's history blob)
create table if not exists public.docs (
  user_id uuid not null references auth.users (id) on delete cascade,
  app text not null,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, app)
);
alter table public.docs enable row level security;
drop policy if exists "read own docs" on public.docs;
create policy "read own docs" on public.docs for select using (auth.uid() = user_id);
drop policy if exists "insert own docs" on public.docs;
create policy "insert own docs" on public.docs for insert with check (auth.uid() = user_id);
drop policy if exists "update own docs" on public.docs;
create policy "update own docs" on public.docs for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "delete own docs" on public.docs;
create policy "delete own docs" on public.docs for delete using (auth.uid() = user_id);

-- 3) Opt-in practice leaderboard.
-- Only a summary row (display name + per-tool accuracy) is published here;
-- raw runs/docs remain private under their own policies above.
create table if not exists public.leaderboard (
  user_id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null,
  stats jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.leaderboard enable row level security;
-- Any signed-in user may read the board...
drop policy if exists "read leaderboard" on public.leaderboard;
create policy "read leaderboard" on public.leaderboard for select using (auth.role() = 'authenticated');
-- ...but may only write their own row.
drop policy if exists "insert own leaderboard" on public.leaderboard;
create policy "insert own leaderboard" on public.leaderboard for insert with check (auth.uid() = user_id);
drop policy if exists "update own leaderboard" on public.leaderboard;
create policy "update own leaderboard" on public.leaderboard for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "delete own leaderboard" on public.leaderboard;
create policy "delete own leaderboard" on public.leaderboard for delete using (auth.uid() = user_id);


-- 3a) Leaderboard moderation: let an admin reset/remove ANY row.
-- Admin = profiles.is_admin OR the super-admin email. SECURITY DEFINER so the
-- check can read profiles regardless of that table's own RLS.
create or replace function public.is_admin() returns boolean
  language sql security definer stable set search_path = public as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false)
      or coalesce((auth.jwt() ->> 'email'), '') = 'sean.olesen@gmail.com';
$$;
drop policy if exists "admin update leaderboard" on public.leaderboard;
create policy "admin update leaderboard" on public.leaderboard for update using (public.is_admin()) with check (true);
drop policy if exists "admin delete leaderboard" on public.leaderboard;
create policy "admin delete leaderboard" on public.leaderboard for delete using (public.is_admin());

-- 4) Editable question overrides (admin "Q&A master sheet").
-- Corrections to answers/explanations that apply to ALL users at runtime,
-- without a code redeploy. Readable by everyone; writable only by admins.
create table if not exists public.question_overrides (
  bank text not null,          -- "ast1" | "ast2"
  qid text not null,           -- question id within that bank
  answer jsonb,                -- corrected correct-answer (mc: index, tf: boolean)
  explain text,                -- corrected explanation
  q text,                      -- corrected question text (optional)
  updated_at timestamptz not null default now(),
  updated_by uuid,
  primary key (bank, qid)
);
alter table public.question_overrides enable row level security;
drop policy if exists "read overrides" on public.question_overrides;
create policy "read overrides" on public.question_overrides for select using (true);
drop policy if exists "admin write overrides" on public.question_overrides;
create policy "admin write overrides" on public.question_overrides for all using (public.is_admin()) with check (public.is_admin());

-- 5) Admin "delete user" (Site Administration): let admins remove another
-- user's data. (Leaderboard already has an admin-delete policy above.)
drop policy if exists "admin delete runs" on public.runs;
create policy "admin delete runs" on public.runs for delete using (public.is_admin());
drop policy if exists "admin delete docs" on public.docs;
create policy "admin delete docs" on public.docs for delete using (public.is_admin());
drop policy if exists "admin delete profiles" on public.profiles;
create policy "admin delete profiles" on public.profiles for delete using (public.is_admin());


-- ============================================================================
-- 6) SESSIONS / GROUPS, GATED SIGNUP, ACCESS EXPIRY   (invite-by-code system)
--    Safe to re-run. After running, enable the "Before User Created" hook:
--    Dashboard > Authentication > Hooks > Before User Created >
--    Postgres function: public.hook_gate_signup.  Leave public signups ON.
-- ============================================================================

-- 6a) profiles: keep existing shape (id, email, is_admin, created_at); add access.
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.profiles add column if not exists email text;
alter table public.profiles add column if not exists created_at timestamptz not null default now();
alter table public.profiles add column if not exists access_unlimited boolean not null default false;
alter table public.profiles add column if not exists access_override_until timestamptz;  -- admin-set; null = use default
alter table public.profiles enable row level security;
drop policy if exists "read own profile" on public.profiles;
create policy "read own profile" on public.profiles for select using (auth.uid() = id or public.is_admin());
drop policy if exists "admin update profiles" on public.profiles;
create policy "admin update profiles" on public.profiles for update using (public.is_admin()) with check (public.is_admin());

-- make sure the super-admin is flagged (used by is_active + is_admin)
insert into public.profiles (id, email, is_admin, created_at)
  select id, email, true, now() from auth.users where lower(email) = 'sean.olesen@gmail.com'
  on conflict (id) do update set is_admin = true;

-- 6b) global settings (default access window in weeks; changing it flows to all
--     users who don't have a per-user override).
create table if not exists public.app_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.app_settings enable row level security;
drop policy if exists "read settings" on public.app_settings;
create policy "read settings" on public.app_settings for select using (auth.role() = 'authenticated');
drop policy if exists "admin write settings" on public.app_settings;
create policy "admin write settings" on public.app_settings for all using (public.is_admin()) with check (public.is_admin());
insert into public.app_settings (key, value) values ('default_access_weeks', '6'::jsonb)
  on conflict (key) do nothing;

-- 6c) sessions (course groups). join_code is a SIGNUP SECRET: never world-readable.
create table if not exists public.sessions (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  join_code text not null unique,
  active boolean not null default true,
  is_legacy boolean not null default false,
  created_by uuid,
  created_at timestamptz not null default now()
);
alter table public.sessions enable row level security;
drop policy if exists "admin all sessions" on public.sessions;
create policy "admin all sessions" on public.sessions for all using (public.is_admin()) with check (public.is_admin());
-- (regular users never read this table directly; they use my_sessions() below,
--  which returns labels only, never the code.)

-- 6d) memberships (many-to-many: a user may be in several sessions over time).
create table if not exists public.memberships (
  user_id uuid not null references auth.users (id) on delete cascade,
  session_id uuid not null references public.sessions (id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (user_id, session_id)
);
alter table public.memberships enable row level security;
drop policy if exists "read own memberships" on public.memberships;
create policy "read own memberships" on public.memberships for select using (auth.uid() = user_id or public.is_admin());
drop policy if exists "admin write memberships" on public.memberships;
create policy "admin write memberships" on public.memberships for all using (public.is_admin()) with check (public.is_admin());

-- 6e) ACCESS: effective expiry + "is this user allowed to use the tools?"
create or replace function public.access_until(uid uuid) returns timestamptz
  language sql security definer stable set search_path = public as $$
  select case
    when coalesce((select access_unlimited from public.profiles where id = uid), false) then null
    when (select access_override_until from public.profiles where id = uid) is not null
      then (select access_override_until from public.profiles where id = uid)
    else (select created_at from public.profiles where id = uid)
       + (coalesce((select (value #>> '{}')::int from public.app_settings where key = 'default_access_weeks'), 6)
          * interval '7 days')
  end;
$$;

create or replace function public.is_active(uid uuid) returns boolean
  language sql security definer stable set search_path = public as $$
  select coalesce((select is_admin from public.profiles where id = uid), false)   -- admins never expire
      or public.access_until(uid) is null                                          -- unlimited
      or public.access_until(uid) > now();                                         -- not yet expired
$$;

-- app-facing helpers (current user)
create or replace function public.am_i_active() returns boolean
  language sql security definer stable set search_path = public as $$ select public.is_active(auth.uid()); $$;
create or replace function public.my_access() returns timestamptz
  language sql security definer stable set search_path = public as $$ select public.access_until(auth.uid()); $$;
create or replace function public.my_sessions() returns table(id uuid, label text, joined_at timestamptz)
  language sql security definer stable set search_path = public as $$
  select s.id, s.label, m.joined_at
  from public.memberships m join public.sessions s on s.id = m.session_id
  where m.user_id = auth.uid() order by m.joined_at desc;
$$;
grant execute on function public.am_i_active() to authenticated;
grant execute on function public.my_access() to authenticated;
grant execute on function public.my_sessions() to authenticated;

-- 6f) EXPIRY-AWARE RLS: an expired (non-admin) user can still READ and DELETE
--     their own data, but cannot WRITE new results (tools won't save).
drop policy if exists "insert own runs" on public.runs;
create policy "insert own runs" on public.runs for insert
  with check (auth.uid() = user_id and public.is_active(auth.uid()));
drop policy if exists "insert own docs" on public.docs;
create policy "insert own docs" on public.docs for insert
  with check (auth.uid() = user_id and public.is_active(auth.uid()));
drop policy if exists "update own docs" on public.docs;
create policy "update own docs" on public.docs for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id and public.is_active(auth.uid()));
drop policy if exists "insert own leaderboard" on public.leaderboard;
create policy "insert own leaderboard" on public.leaderboard for insert
  with check (auth.uid() = user_id and public.is_active(auth.uid()));
drop policy if exists "update own leaderboard" on public.leaderboard;
create policy "update own leaderboard" on public.leaderboard for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id and public.is_active(auth.uid()));

-- 6g) SIGNUP GATE: the Before-User-Created hook. Rejects any signup that does
--     not present a valid, active session code (super-admin email exempt).
create or replace function public.hook_gate_signup(event jsonb)
  returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_email text;
  v_code  text;
  v_ok    boolean;
begin
  v_email := lower(coalesce(event->'user'->>'email', ''));
  v_code  := upper(trim(coalesce(event->'user'->'user_metadata'->>'join_code', '')));

  if v_email = 'sean.olesen@gmail.com' then
    return '{}'::jsonb;                                -- super-admin always allowed
  end if;

  if v_code = '' then
    return jsonb_build_object('error', jsonb_build_object(
      'http_code', 400, 'message', 'A session code is required to create an account.'));
  end if;

  select exists(select 1 from public.sessions where upper(join_code) = v_code and active = true) into v_ok;
  if not v_ok then
    return jsonb_build_object('error', jsonb_build_object(
      'http_code', 403, 'message', 'That session code is invalid or no longer active.'));
  end if;

  return '{}'::jsonb;                                  -- allow
end;
$$;
grant execute on function public.hook_gate_signup(jsonb) to supabase_auth_admin;
revoke execute on function public.hook_gate_signup(jsonb) from authenticated, anon, public;

-- 6h) On signup: create the profile (never trusting client is_admin) and the
--     membership from the validated code.
create or replace function public.handle_new_user() returns trigger
  language plpgsql security definer set search_path = public as $$
declare
  v_code text;
  v_session uuid;
begin
  insert into public.profiles (id, email, is_admin, created_at)
    values (new.id, new.email, false, now())
    on conflict (id) do update set email = excluded.email;

  v_code := upper(trim(coalesce(new.raw_user_meta_data->>'join_code', '')));
  if v_code <> '' then
    select id into v_session from public.sessions where upper(join_code) = v_code limit 1;
    if v_session is not null then
      insert into public.memberships (user_id, session_id) values (new.id, v_session)
        on conflict do nothing;
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- 6i) ADMIN operations (each re-checks is_admin() inside; safe to grant to authenticated)
create or replace function public.admin_create_session(p_label text) returns public.sessions
  language plpgsql security definer set search_path = public as $$
declare v_row public.sessions; v_code text;
begin
  if not public.is_admin() then raise exception 'not authorized'; end if;
  loop
    v_code := (select string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789',
                (floor(random()*32)+1)::int, 1), '') from generate_series(1,10));
    exit when not exists (select 1 from public.sessions where join_code = v_code);
  end loop;
  insert into public.sessions (label, join_code, created_by)
    values (p_label, v_code, auth.uid()) returning * into v_row;
  return v_row;
end;
$$;

create or replace function public.admin_sessions()
  returns table(id uuid, label text, join_code text, active boolean, is_legacy boolean, created_at timestamptz, members bigint)
  language sql security definer stable set search_path = public as $$
  select s.id, s.label, s.join_code, s.active, s.is_legacy, s.created_at,
    (select count(*) from public.memberships m where m.session_id = s.id)
  from public.sessions s where public.is_admin() order by s.is_legacy, s.created_at desc;
$$;

create or replace function public.admin_session_members(p_session uuid)
  returns table(user_id uuid, email text, is_admin boolean, access_until timestamptz, access_unlimited boolean, joined_at timestamptz)
  language sql security definer stable set search_path = public as $$
  select u.id, u.email, coalesce(p.is_admin,false), public.access_until(u.id),
         coalesce(p.access_unlimited,false), m.joined_at
  from public.memberships m
  join auth.users u on u.id = m.user_id
  left join public.profiles p on p.id = u.id
  where public.is_admin() and m.session_id = p_session order by u.email;
$$;

create or replace function public.admin_add_member(p_email text, p_session uuid) returns void
  language plpgsql security definer set search_path = public as $$
declare v_uid uuid;
begin
  if not public.is_admin() then raise exception 'not authorized'; end if;
  select id into v_uid from auth.users where lower(email) = lower(trim(p_email)) limit 1;
  if v_uid is null then raise exception 'No user with that email has an account yet.'; end if;
  insert into public.memberships (user_id, session_id) values (v_uid, p_session) on conflict do nothing;
end;
$$;

create or replace function public.admin_remove_member(p_user uuid, p_session uuid) returns void
  language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not authorized'; end if;
  delete from public.memberships where user_id = p_user and session_id = p_session;
end;
$$;

-- p_mode: 'unlimited' | 'default' | 'until' (p_until required for 'until')
create or replace function public.admin_set_access(p_user uuid, p_mode text, p_until timestamptz default null) returns void
  language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not authorized'; end if;
  if p_mode = 'unlimited' then
    update public.profiles set access_unlimited = true, access_override_until = null where id = p_user;
  elsif p_mode = 'until' then
    update public.profiles set access_unlimited = false, access_override_until = p_until where id = p_user;
  else
    update public.profiles set access_unlimited = false, access_override_until = null where id = p_user;
  end if;
end;
$$;

-- Leaderboard rows for the members of one session (admin: any; user: only own sessions).
create or replace function public.session_leaderboard(p_session uuid)
  returns table(user_id uuid, display_name text, stats jsonb)
  language sql security definer stable set search_path = public as $$
  select l.user_id, l.display_name, l.stats
  from public.leaderboard l
  where (public.is_admin() or exists (select 1 from public.memberships me where me.user_id = auth.uid() and me.session_id = p_session))
    and exists (select 1 from public.memberships m where m.user_id = l.user_id and m.session_id = p_session);
$$;

grant execute on function public.admin_create_session(text) to authenticated;
grant execute on function public.admin_sessions() to authenticated;
grant execute on function public.admin_session_members(uuid) to authenticated;
grant execute on function public.admin_add_member(text, uuid) to authenticated;
grant execute on function public.admin_remove_member(uuid, uuid) to authenticated;
grant execute on function public.admin_set_access(uuid, text, timestamptz) to authenticated;
grant execute on function public.session_leaderboard(uuid) to authenticated;

-- 6j) LEGACY group: grandfather every pre-existing user (no membership yet) into
--     a "Legacy" session with UNLIMITED access. Idempotent (skips anyone who
--     already has a membership).
insert into public.sessions (label, join_code, active, is_legacy)
  select 'Legacy (pre-invite users)', 'LEGACY-' || substr(md5(random()::text), 1, 8), false, true
  where not exists (select 1 from public.sessions where is_legacy = true);

do $$
declare v_legacy uuid; r record;
begin
  select id into v_legacy from public.sessions where is_legacy = true limit 1;
  if v_legacy is null then return; end if;
  for r in select p.id from public.profiles p
           where not exists (select 1 from public.memberships m where m.user_id = p.id)
  loop
    insert into public.memberships (user_id, session_id) values (r.id, v_legacy) on conflict do nothing;
    update public.profiles set access_unlimited = true where id = r.id;
  end loop;
end $$;

-- 6k) Self-service deletion (available even when expired; DELETE policies above
--     already allow a user to remove their own rows).
create or replace function public.delete_my_data() returns void
  language plpgsql security definer set search_path = public as $$
begin
  delete from public.runs where user_id = auth.uid();
  delete from public.docs where user_id = auth.uid();
  delete from public.leaderboard where user_id = auth.uid();
end;
$$;
create or replace function public.delete_my_account() returns void
  language plpgsql security definer set search_path = public as $$
begin
  delete from public.runs where user_id = auth.uid();
  delete from public.docs where user_id = auth.uid();
  delete from public.leaderboard where user_id = auth.uid();
  delete from public.memberships where user_id = auth.uid();
  delete from public.profiles where id = auth.uid();
end;
$$;
grant execute on function public.delete_my_data() to authenticated;
grant execute on function public.delete_my_account() to authenticated;
