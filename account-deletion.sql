-- 1) Make "Delete my account" fully remove the login, so the email is freed
--    and the person can sign up fresh. (Deleting the auth.users row cascades to
--    runs/docs/leaderboard/memberships/profiles.) Safe to re-run.
create or replace function public.delete_my_account() returns void
  language plpgsql security definer set search_path = public as $$
begin
  delete from public.runs where user_id = auth.uid();
  delete from public.docs where user_id = auth.uid();
  delete from public.leaderboard where user_id = auth.uid();
  delete from public.memberships where user_id = auth.uid();
  delete from public.profiles where id = auth.uid();
  delete from auth.users where id = auth.uid();   -- frees the email
end;
$$;
grant execute on function public.delete_my_account() to authenticated;

-- 2) ONE-OFF: fully remove seanao@hotmail.com so you can reuse it as a test
--    account. Run once. (Change the email if needed.)
do $$
declare v_uid uuid;
begin
  select id into v_uid from auth.users where lower(email) = 'seanao@hotmail.com';
  if v_uid is null then raise notice 'No account found for that email.'; return; end if;
  delete from public.runs        where user_id = v_uid;
  delete from public.docs        where user_id = v_uid;
  delete from public.leaderboard where user_id = v_uid;
  delete from public.memberships where user_id = v_uid;
  delete from public.profiles    where id = v_uid;
  delete from auth.users         where id = v_uid;
  raise notice 'Removed seanao@hotmail.com and all its data.';
end $$;
