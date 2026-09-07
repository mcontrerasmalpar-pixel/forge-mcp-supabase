-- Forge demo schema: orgs, memberships, documents.
-- RLS is the authorization layer.

create extension if not exists "pgcrypto";

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  created_at timestamptz not null default now()
);

create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'admin', 'member')),
  created_at timestamptz not null default now(),
  unique (org_id, user_id)
);

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  title text not null,
  body text not null default '',
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create index documents_org_id_idx on public.documents (org_id);

create table public.usage_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  tool text not null,
  created_at timestamptz not null default now()
);

create index usage_events_user_created_idx on public.usage_events (user_id, created_at desc);

create or replace function public.my_org_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select org_id from public.memberships where user_id = auth.uid();
$$;

alter table public.organizations enable row level security;
alter table public.memberships enable row level security;
alter table public.documents enable row level security;
alter table public.usage_events enable row level security;

create policy "orgs: member can select"
  on public.organizations for select
  using (id in (select public.my_org_ids()));

create policy "memberships: own org"
  on public.memberships for select
  using (org_id in (select public.my_org_ids()));

create policy "documents: select own org"
  on public.documents for select
  using (org_id in (select public.my_org_ids()));

create policy "documents: insert own org"
  on public.documents for insert
  with check (
    org_id in (select public.my_org_ids())
    and created_by = auth.uid()
  );

create policy "documents: update own org"
  on public.documents for update
  using (org_id in (select public.my_org_ids()))
  with check (org_id in (select public.my_org_ids()));

create policy "usage: insert own"
  on public.usage_events for insert
  with check (user_id = auth.uid());

create policy "usage: select own"
  on public.usage_events for select
  using (user_id = auth.uid());
