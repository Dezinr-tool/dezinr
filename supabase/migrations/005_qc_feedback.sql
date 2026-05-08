create table if not exists public.qc_feedback (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references public.qc_reviews (id) on delete cascade,
  comment_id integer not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  is_valid boolean not null default false,
  is_edited boolean not null default false,
  original_text text,
  edited_text text,
  created_at timestamptz not null default now(),
  constraint qc_feedback_action_check check (is_valid or is_edited)
);

create index if not exists qc_feedback_review_id_idx
  on public.qc_feedback (review_id, created_at desc);

create index if not exists qc_feedback_user_id_idx
  on public.qc_feedback (user_id, created_at desc);

alter table public.qc_feedback enable row level security;

create policy "qc_feedback_select_own"
  on public.qc_feedback for select
  using (auth.uid() = user_id);

create policy "qc_feedback_insert_own"
  on public.qc_feedback for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1
      from public.qc_reviews r
      where r.id = review_id and r.user_id = auth.uid()
    )
  );
