alter table public.analyses
  drop constraint if exists analyses_input_type_check;

alter table public.analyses
  add constraint analyses_input_type_check
  check (input_type in ('url', 'screenshot', 'figma'));
