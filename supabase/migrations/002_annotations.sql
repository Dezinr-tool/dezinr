create table if not exists public.annotations (
  id uuid primary key default gen_random_uuid(),
  analysis_id uuid not null references public.analyses (id) on delete cascade,
  category text not null,
  original_text text,
  edited_text text,
  is_accurate boolean not null,
  added_by_user text,
  created_at timestamptz not null default now()
);

create index if not exists annotations_analysis_id_idx
  on public.annotations (analysis_id, created_at desc);

alter table public.annotations enable row level security;

create policy "annotations_select_own"
  on public.annotations for select
  using (
    exists (
      select 1
      from public.analyses a
      where a.id = analysis_id and a.user_id = auth.uid()
    )
  );

create policy "annotations_insert_own"
  on public.annotations for insert
  with check (
    exists (
      select 1
      from public.analyses a
      where a.id = analysis_id and a.user_id = auth.uid()
    )
  );
