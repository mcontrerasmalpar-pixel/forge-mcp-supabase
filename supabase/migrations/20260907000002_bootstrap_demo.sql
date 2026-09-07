-- Puts the current user in org-alpha and creates org-beta docs they cannot see.

create or replace function public.forge_bootstrap_demo()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  org_a uuid;
  org_b uuid;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;

  insert into public.organizations (name, slug)
  values ('Acme Alpha', 'acme-alpha')
  on conflict (slug) do update set name = excluded.name
  returning id into org_a;

  if org_a is null then
    select id into org_a from public.organizations where slug = 'acme-alpha';
  end if;

  insert into public.organizations (name, slug)
  values ('Beta Shadow', 'beta-shadow')
  on conflict (slug) do update set name = excluded.name
  returning id into org_b;

  if org_b is null then
    select id into org_b from public.organizations where slug = 'beta-shadow';
  end if;

  insert into public.memberships (org_id, user_id, role)
  values (org_a, uid, 'owner')
  on conflict (org_id, user_id) do nothing;

  insert into public.documents (org_id, title, body, created_by)
  select org_a, x.title, x.body, uid
  from (values
    ('On-call runbook', 'Restart Edge Functions, then check pg_stat_activity.'),
    ('RLS checklist', 'Enable RLS before any table is reachable from anon/authenticated.')
  ) as x(title, body)
  where not exists (
    select 1 from public.documents d where d.org_id = org_a and d.title = x.title
  );

  insert into public.documents (org_id, title, body)
  select org_b, x.title, x.body
  from (values
    ('SECRET payroll', 'This row must never leak to Alpha users.'),
    ('Beta acquisition notes', 'Confidential. RLS demo fixture.')
  ) as x(title, body)
  where not exists (
    select 1 from public.documents d where d.org_id = org_b and d.title = x.title
  );

  return jsonb_build_object(
    'your_org', 'acme-alpha',
    'hidden_org', 'beta-shadow',
    'hint', 'SELECT title FROM documents should return only Alpha rows.'
  );
end;
$$;

grant execute on function public.forge_bootstrap_demo() to authenticated;
