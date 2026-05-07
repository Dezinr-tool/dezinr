create table if not exists public.qc_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  figma_url text not null,
  staging_url text not null,
  project_name text not null,
  total_issues integer not null,
  must_fix_count integer not null,
  minor_count integer not null,
  suggestion_count integer not null,
  comments jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists qc_reviews_user_id_created_at_idx
  on public.qc_reviews (user_id, created_at desc);

alter table public.qc_reviews enable row level security;

create policy "qc_reviews_select_own"
  on public.qc_reviews for select
  using (auth.uid() = user_id);

create policy "qc_reviews_insert_own"
  on public.qc_reviews for insert
  with check (auth.uid() = user_id);

create policy "qc_reviews_update_own"
  on public.qc_reviews for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
