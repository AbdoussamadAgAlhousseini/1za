-- Expose la formule de l'abonnement de référence (préremplissage des renouvellements).
create or replace view public.athlete_overview
with (security_invoker = true)
as
select
  a.id,
  a.matricule,
  a.registered_on,
  a.created_at,
  ref.id as subscription_id,
  ref.starts_on,
  ref.ends_on,
  ref.state as subscription_state,
  pl.name as plan_name,
  case
    when ref.id is null then 'none'
    else public.subscription_validity(ref.state, ref.starts_on, ref.ends_on, t.today)
  end as status,
  case when ref.id is null then null else ref.ends_on - t.today end as days_remaining,
  coalesce(nxt.has_next, false) as has_next_subscription,
  (
    ref.id is not null
    and public.subscription_validity(ref.state, ref.starts_on, ref.ends_on, t.today) = 'active'
    and ref.ends_on - t.today < t.expiring_soon_days
    and not coalesce(nxt.has_next, false)
  ) as expiring_soon,
  vs.last_visit_at,
  coalesce(vs.visit_count, 0)::integer as visit_count,
  ref.plan_id
from public.athletes a
cross join lateral (
  select public.app_today() as today,
         coalesce((select s.expiring_soon_days from public.app_settings s where s.id), 7) as expiring_soon_days
) t
left join lateral (
  select s.*
  from public.subscriptions s
  where s.athlete_id = a.id
    and s.state <> 'cancelled'
  order by
    (t.today between s.starts_on and s.ends_on) desc,
    (s.starts_on > t.today) desc,
    case when s.starts_on > t.today then s.starts_on end asc,
    s.ends_on desc
  limit 1
) ref on true
left join public.subscription_plans pl on pl.id = ref.plan_id
left join lateral (
  select true as has_next
  from public.subscriptions n
  where n.athlete_id = a.id
    and n.state <> 'cancelled'
    and ref.id is not null
    and n.starts_on > ref.ends_on
  limit 1
) nxt on true
left join lateral (
  select max(v.entered_at) as last_visit_at, count(*) as visit_count
  from public.visits v
  where v.athlete_id = a.id
    and v.status <> 'cancelled'
) vs on true;

grant select on public.athlete_overview to authenticated;
