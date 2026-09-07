create or replace function public.forge_list_tables()
returns jsonb
language sql
stable
security definer
set search_path = public, information_schema
as $$
  select coalesce(jsonb_agg(t), '[]'::jsonb)
  from (
    select
      c.table_name,
      jsonb_agg(jsonb_build_object(
        'column', c.column_name,
        'type', c.data_type,
        'nullable', c.is_nullable
      ) order by c.ordinal_position) as columns
    from information_schema.columns c
    where c.table_schema = 'public'
      and c.table_name not like 'pg_%'
    group by c.table_name
    order by c.table_name
  ) t;
$$;

create or replace function public.forge_list_policies()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'schema', n.nspname,
    'table', c.relname,
    'policy', p.polname,
    'cmd', p.polcmd,
    'qual', pg_get_expr(p.polqual, p.polrelid),
    'with_check', pg_get_expr(p.polwithcheck, p.polrelid)
  ) order by c.relname, p.polname), '[]'::jsonb)
  from pg_policy p
  join pg_class c on c.oid = p.polrelid
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public';
$$;

create or replace function public.forge_list_functions()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'name', p.proname,
    'args', pg_get_function_identity_arguments(p.oid)
  ) order by p.proname), '[]'::jsonb)
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public';
$$;

create or replace function public.forge_explain(q text)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  plan jsonb;
begin
  if q is null or length(q) > 4000 then
    raise exception 'invalid query';
  end if;
  execute format('explain (format json) %s', q) into plan;
  return plan;
end;
$$;

create or replace function public.forge_readonly(q text)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  result jsonb;
begin
  if q is null or length(q) > 4000 then
    raise exception 'invalid query';
  end if;
  execute 'set local default_transaction_read_only = on';
  execute format('select coalesce(jsonb_agg(t), ''[]''::jsonb) from (%s) t', q) into result;
  return result;
end;
$$;

revoke all on function public.forge_list_tables() from public;
revoke all on function public.forge_list_policies() from public;
revoke all on function public.forge_list_functions() from public;
grant execute on function public.forge_list_tables() to service_role;
grant execute on function public.forge_list_policies() to service_role;
grant execute on function public.forge_list_functions() to service_role;

grant execute on function public.forge_explain(text) to authenticated;
grant execute on function public.forge_readonly(text) to authenticated;
