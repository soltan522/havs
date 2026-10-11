-- Run once in the Supabase SQL editor.

create table if not exists public.orders (
  id           uuid primary key,
  plan_slug    text not null,
  provider     text not null check (provider in ('stripe', 'paypal', 'bank')),
  status       text not null default 'pending' check (status in ('pending', 'paid', 'failed')),
  amount_cents integer not null check (amount_cents >= 0),
  currency     text not null,
  locale       text not null,
  buyer_email  text,
  provider_ref text,
  created_at   timestamptz not null default now()
);

-- Only the server (service role) touches orders. No anon/public policies.
alter table public.orders enable row level security;

-- Create a PRIVATE bucket named plans-private (Storage > New bucket, "Public" OFF).
-- Upload files under keys such as modern-villa-01/plan.pdf (matching lib/plans.ts).

-- The server (service_role) must be able to read and update orders.
-- Needed when the project does not auto-expose new tables; without it the site returns 403 on order lookups.
grant usage on schema public to service_role;
grant select, insert, update, delete on public.orders to service_role;
