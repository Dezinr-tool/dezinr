create table if not exists public.review_shares (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references public.qc_reviews(id) on delete cascade,
  shared_by_user_id uuid not null references auth.users(id) on delete cascade,
  email text not null,
  created_at timestamptz not null default now()
);

create index if not exists review_shares_review_id_idx
  on public.review_shares (review_id);
