-- ============================================================================
-- Migration: per-class (session) visibility for the three Home sections
--   AST 1 / AST 2 / Practical.
-- * Every EXISTING session defaults to showing all three (the ADD COLUMN default).
-- * New sessions inherit an admin-configurable default (default_sections).
-- Safe to run more than once. Runs as one transaction in the Supabase SQL editor.
-- ============================================================================

alter table public.sessions
  add column if not exists show_ast1 boolean not null default true,
  add column if not exists show_ast2 boolean not null default true,
  add column if not exists show_practical boolean not null default true;

-- Admin-configurable default applied to newly created sessions.
insert into public.app_settings (key, value)
  values ('default_sections', '{"ast1":true,"ast2":true,"practical":true}'::jsonb)
  on conflict (key) do nothing;

-- Drop the functions we redefine BEFORE recreating them. This is required
-- because admin_create_session returns public.sessions and admin_sessions()
-- changes its return columns; after ALTER TABLE, "create or replace" on a
-- function whose return type depends on the sessions row type would fail with
-- "cannot change return type of existing function". Dropping by signature is
-- safe regardless of the currently deployed body.
drop function if exists public.admin_create_session(text);
drop function if exists public.admin_sessions();
drop function if exists public.admin_set_session_sections(uuid, boolean, boolean, boolean);
drop function if exists public.admin_set_default_sections(boolean, boolean, boolean);
drop function if exists public.my_sections();

-- New session creation applies the default-sections setting.
create function public.admin_create_session(p_label text) returns public.sessions
  language plpgsql security definer set search_path = public as $$
declare v_row public.sessions; v_code text; v_def jsonb;
begin
  if not public.is_admin() then raise exception 'not authorized'; end if;
  v_def := coalesce((select value from public.app_settings where key = 'default_sections'),
                    '{"ast1":true,"ast2":true,"practical":true}'::jsonb);
  loop
    v_code := (select string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789',
                (floor(random()*32)+1)::int, 1), '') from generate_series(1,10));
    exit when not exists (select 1 from public.sessions where join_code = v_code);
  end loop;
  insert into public.sessions (label, join_code, created_by, show_ast1, show_ast2, show_practical)
    values (p_label, v_code, auth.uid(),
      coalesce((v_def->>'ast1')::boolean, true),
      coalesce((v_def->>'ast2')::boolean, true),
      coalesce((v_def->>'practical')::boolean, true))
    returning * into v_row;
  return v_row;
end;
$$;

-- Set a single session's visible sections.
create function public.admin_set_session_sections(
    p_session uuid, p_ast1 boolean, p_ast2 boolean, p_practical boolean) returns void
  language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not authorized'; end if;
  update public.sessions
     set show_ast1 = p_ast1, show_ast2 = p_ast2, show_practical = p_practical
   where id = p_session;
end;
$$;

-- Set the default sections for new sessions.
create function public.admin_set_default_sections(
    p_ast1 boolean, p_ast2 boolean, p_practical boolean) returns void
  language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not authorized'; end if;
  insert into public.app_settings (key, value)
    values ('default_sections', jsonb_build_object('ast1', p_ast1, 'ast2', p_ast2, 'practical', p_practical))
    on conflict (key) do update set value = excluded.value, updated_at = now();
end;
$$;

-- admin_sessions() now also returns the section flags.
create function public.admin_sessions()
  returns table(id uuid, label text, join_code text, active boolean, is_legacy boolean,
                created_at timestamptz, members bigint,
                show_ast1 boolean, show_ast2 boolean, show_practical boolean)
  language sql security definer stable set search_path = public as $$
  select s.id, s.label, s.join_code, s.active, s.is_legacy, s.created_at,
    (select count(*) from public.memberships m where m.session_id = s.id),
    s.show_ast1, s.show_ast2, s.show_practical
  from public.sessions s where public.is_admin() order by s.is_legacy, s.created_at desc;
$$;

-- Which sections the current user may see. Admins and users with no membership
-- see all three; otherwise it's the union across the user's sessions (being in a
-- less-restricted class grants the broader view).
create function public.my_sections() returns jsonb
  language plpgsql security definer stable set search_path = public as $$
declare a boolean; b boolean; c boolean; has_mem boolean;
begin
  if public.is_admin() then
    return '{"ast1":true,"ast2":true,"practical":true}'::jsonb;
  end if;
  select exists(select 1 from public.memberships m where m.user_id = auth.uid()) into has_mem;
  if not has_mem then
    return '{"ast1":true,"ast2":true,"practical":true}'::jsonb;
  end if;
  select coalesce(bool_or(s.show_ast1), true),
         coalesce(bool_or(s.show_ast2), true),
         coalesce(bool_or(s.show_practical), true)
    into a, b, c
  from public.sessions s
  join public.memberships m on m.session_id = s.id
  where m.user_id = auth.uid();
  return jsonb_build_object('ast1', a, 'ast2', b, 'practical', c);
end;
$$;

grant execute on function public.admin_create_session(text) to authenticated;
grant execute on function public.admin_sessions() to authenticated;
grant execute on function public.admin_set_session_sections(uuid, boolean, boolean, boolean) to authenticated;
grant execute on function public.admin_set_default_sections(boolean, boolean, boolean) to authenticated;
grant execute on function public.my_sections() to authenticated;
