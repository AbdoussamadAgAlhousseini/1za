-- Historique : indique les entrées / sorties enregistrées hors ligne.
create or replace view public.visit_log
with (security_invoker = true)
as
select
  v.id,
  v.athlete_id,
  a.matricule,
  v.subscription_id,
  v.entered_at,
  v.exited_at,
  v.status,
  v.duration_seconds,
  (v.entered_at at time zone private_tz.tz)::date as visit_date,
  v.entry_agent_id,
  ea.display_name as entry_agent_name,
  v.exit_agent_id,
  xa.display_name as exit_agent_name,
  v.corrected_at,
  v.corrected_by,
  ca.display_name as corrected_by_name,
  v.correction_reason,
  v.entry_offline,
  v.exit_offline
from public.visits v
join public.athletes a on a.id = v.athlete_id
left join public.profiles ea on ea.id = v.entry_agent_id
left join public.profiles xa on xa.id = v.exit_agent_id
left join public.profiles ca on ca.id = v.corrected_by
cross join lateral (
  select coalesce((select s.timezone from public.app_settings s where s.id), 'Africa/Bamako') as tz
) private_tz;

grant select on public.visit_log to authenticated;
