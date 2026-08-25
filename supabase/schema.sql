-- Run this once in the Supabase SQL editor (Dashboard → SQL Editor → New query).

create table if not exists public.bookings (
  id          uuid primary key default gen_random_uuid(),
  date        date not null,
  hour        smallint not null check (hour between 0 and 23),
  name        text not null check (char_length(trim(name)) between 1 and 40),
  created_at  timestamptz not null default now(),
  unique (date, hour)          -- one booking per hour: double-booking fails at the DB
);

create index if not exists bookings_date_idx on public.bookings (date);

-- The page is a static site, so it talks to the API with the public "anon" key.
-- These policies deliberately allow anyone holding that key to read, book and
-- release slots — the shared password in front of the page is the only gate.
-- Don't put anything confidential in the name field.
alter table public.bookings enable row level security;

drop policy if exists "anon can read"    on public.bookings;
drop policy if exists "anon can insert"  on public.bookings;
drop policy if exists "anon can delete"  on public.bookings;

create policy "anon can read"   on public.bookings for select to anon using (true);
create policy "anon can insert" on public.bookings for insert to anon with check (true);
create policy "anon can delete" on public.bookings for delete to anon using (true);
