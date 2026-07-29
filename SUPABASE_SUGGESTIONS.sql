-- Run this in Supabase SQL Editor to add the suggestions table

create table suggestions (
  id uuid default gen_random_uuid() primary key,
  text text not null,
  read boolean default false,
  created_at timestamptz default now()
);

alter table suggestions enable row level security;
create policy "all_suggestions" on suggestions for all using (true) with check (true);
