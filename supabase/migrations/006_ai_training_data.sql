create table if not exists public.ai_training_data (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id),
  review_id uuid references qc_reviews(id),
  comment_id text,
  action text check (action in ('valid', 'edited', 'deleted', 'manual')),
  original_text text,
  edited_text text,
  element_selector text,
  element_text text,
  x_percent float,
  y_percent float,
  page_url text,
  site_category text,
  created_at timestamp default now()
);

create index if not exists ai_training_data_user_created_idx
  on public.ai_training_data (user_id, created_at desc);
