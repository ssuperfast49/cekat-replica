begin;

-- List non-contained conversations (not resolved by AI) for drilldown
create or replace function public.get_non_contained(
  p_from timestamptz,
  p_to timestamptz,
  p_limit int default 50,
  p_offset int default 0
) returns table(
  id uuid,
  created_at timestamptz,
  contact_name text,
  handover_reason text,
  status text
)
language sql
stable
security definer
set search_path = public
as $$
  select t.id,
         t.created_at,
         coalesce(c.name,'Unknown Contact') as contact_name,
         t.handover_reason,
         t.status::text
  from public.threads t
  left join public.contacts c on c.id = t.contact_id
  where t.created_at >= p_from and t.created_at < p_to
    and t.org_id in (select org_id from public.org_members where user_id = auth.uid())
    and coalesce(t.resolution,'') <> 'AI'
  order by t.created_at desc
  limit greatest(0, least(p_limit, 500)) offset greatest(0, p_offset);
$$;

commit;


