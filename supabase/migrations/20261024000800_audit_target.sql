-- Journal d'audit : nom du membre du personnel concerné par une opération.
create or replace view public.audit_log_view
with (security_invoker = true)
as
select
  l.id,
  l.occurred_at,
  l.actor_id,
  pr.display_name as actor_name,
  pr.role as actor_role,
  l.action,
  l.entity_type,
  l.entity_id,
  l.details,
  coalesce(a1.matricule, a2.matricule, a3.matricule, a4.matricule) as matricule,
  tp.display_name as target_staff_name
from public.audit_logs l
left join public.profiles pr on pr.id = l.actor_id
left join public.athletes a1 on l.entity_type = 'athlete' and a1.id = l.entity_id
left join public.subscriptions s on l.entity_type = 'subscription' and s.id = l.entity_id
left join public.athletes a2 on a2.id = s.athlete_id
left join public.visits v on l.entity_type = 'visit' and v.id = l.entity_id
left join public.athletes a3 on a3.id = v.athlete_id
left join public.payments p on l.entity_type = 'payment' and p.id = l.entity_id
left join public.athletes a4 on a4.id = p.athlete_id
left join public.profiles tp on l.entity_type = 'profile' and tp.id = l.entity_id;

grant select on public.audit_log_view to authenticated;
