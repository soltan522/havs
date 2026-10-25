-- Run once in the Supabase SQL editor.

create table if not exists public.orders (
  id           uuid primary key,
  plan_slug    text not null,
  provider     text not null check (provider in ('lemonsqueezy', 'stripe', 'paypal', 'crypto', 'bank')),
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

-- Upgrade for databases created before Lemon Squeezy and crypto payments were added:
-- alter table public.orders drop constraint if exists orders_provider_check;
-- alter table public.orders add constraint orders_provider_check
--   check (provider in ('lemonsqueezy', 'stripe', 'paypal', 'crypto', 'bank'));

-- Apartment plans sent by owners from the projects map (app/api/plan-request), for ready-made interior designs.
create table if not exists public.plan_requests (
  id             uuid primary key default gen_random_uuid(),
  building_id    text check (char_length(building_id) <= 80),
  building_label text check (char_length(building_label) <= 160),
  apartment      text check (char_length(apartment) <= 120),
  rooms          smallint check (rooms between 0 and 12),
  area           numeric(6, 1) check (area > 0 and area < 2000),
  name           text not null check (char_length(name) between 1 and 120),
  contact        text not null check (char_length(contact) between 3 and 160),
  note           text check (char_length(note) <= 2000),
  files          text[] not null default '{}',
  locale         text not null check (locale in ('az', 'en', 'ru')),
  status         text not null default 'uploading' check (status in ('uploading', 'new', 'designing', 'published', 'rejected')),
  created_at     timestamptz not null default now()
);
alter table public.plan_requests enable row level security;
grant select, insert, update, delete on public.plan_requests to authenticated;
grant all on public.plan_requests to service_role;
-- PRIVATE bucket for the uploaded plans (photos or PDFs, up to 15 MB each)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('plan-uploads', 'plan-uploads', false, 15728640,
        array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'application/pdf'])
on conflict (id) do nothing;

-- Sign-in link requests (app/api/auth/login, lib/store.ts): limits per visitor address and per e-mail address.
-- Server-only (service role); RLS on with no policies, so the grants give no other role any rows.
create table if not exists public.auth_attempts (
  id         bigint generated always as identity primary key,
  ip         text not null check (char_length(ip) <= 64),
  email      text not null check (char_length(email) <= 254),
  created_at timestamptz not null default now()
);
create index if not exists auth_attempts_ip_idx on public.auth_attempts (ip, created_at);
create index if not exists auth_attempts_email_idx on public.auth_attempts (email, created_at);
alter table public.auth_attempts enable row level security;
grant select, insert, update, delete on public.auth_attempts to authenticated;
grant all on public.auth_attempts to service_role;
