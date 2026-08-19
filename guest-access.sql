-- Guest-access control: let admins require sign-in globally (blocks guest mode).
-- Safe to re-run. After this, the toggle lives in Site Administration >
-- Sessions & access > "Require sign-in".

insert into public.app_settings (key, value) values ('require_login', 'false'::jsonb)
  on conflict (key) do nothing;

-- readable by anon so the login wall can apply before sign-in
create or replace function public.require_login() returns boolean
  language sql security definer stable set search_path = public as $$
  select coalesce((select (value #>> '{}')::boolean
                   from public.app_settings where key = 'require_login'), false);
$$;
grant execute on function public.require_login() to anon, authenticated;
