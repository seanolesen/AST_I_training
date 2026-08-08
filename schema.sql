-- Run this once in Supabase: Dashboard > SQL Editor > New query > paste > Run.
-- Creates a per-user table of quiz runs, protected by Row Level Security.

create table if not exists public.runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  payload jsonb not null,
  created_at timestamptz not null default now()
);

alter table public.runs enable row level security;

-- Each signed-in user can read only their own runs.
create policy "read own runs"
  on public.runs for select
  using (auth.uid() = user_id);

-- Each signed-in user can insert runs only for themselves.
create policy "insert own runs"
  on public.runs for insert
  with check (auth.uid() = user_id);

create index if not exists runs_user_created_idx
  on public.runs (user_id, created_at);
