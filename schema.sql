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
