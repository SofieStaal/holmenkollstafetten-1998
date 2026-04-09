-- Holmenkollstafetten 2026 — Supabase setup
-- Run this once in your Supabase SQL editor.

create table if not exists picks (
  id          bigint generated always as identity primary key,
  leg_num     int not null check (leg_num between 1 and 15),
  runner_name text not null,
  picked_at   timestamptz not null default now(),
  unique (leg_num, runner_name)  -- same person can't wish for the same leg twice
);

-- Row Level Security: allow anyone with the anon key to read & write.
-- (Fine for an internal tool with 15 colleagues. Don't put secrets here.)
alter table picks enable row level security;

create policy "anyone can read picks"
  on picks for select
  using (true);

create policy "anyone can insert picks"
  on picks for insert
  with check (true);

create policy "anyone can update picks"
  on picks for update
  using (true)
  with check (true);

create policy "anyone can delete picks"
  on picks for delete
  using (true);

-- Enable Realtime so all browsers stay in sync.
alter publication supabase_realtime add table picks;
