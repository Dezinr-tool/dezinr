-- Dezinr MVP — run in Supabase SQL Editor (Dashboard → SQL → New query)

create extension if not exists "pgcrypto";

create table if not exists public.analyses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  input_type text not null check (input_type in ('url', 'screenshot')),
  input_value text not null,
  ai_response jsonb not null,
  score integer not null,
  created_at timestamptz not null default now()
);

create index if not exists analyses_user_id_created_at_idx
  on public.analyses (user_id, created_at desc);

create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  analysis_id uuid not null references public.analyses (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  is_helpful boolean not null,
  user_comment text,
  created_at timestamptz not null default now()
);

create index if not exists feedback_analysis_id_idx on public.feedback (analysis_id);

alter table public.analyses enable row level security;
alter table public.feedback enable row level security;

create policy "analyses_select_own"
  on public.analyses for select
  using (auth.uid() = user_id);

create policy "analyses_insert_own"
  on public.analyses for insert
  with check (auth.uid() = user_id);

create policy "feedback_select_own"
  on public.feedback for select
  using (auth.uid() = user_id);

create policy "feedback_insert_own"
  on public.feedback for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.analyses a
      where a.id = analysis_id and a.user_id = auth.uid()
    )
  );
