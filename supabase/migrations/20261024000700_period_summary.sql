-- Synthèse d'une période (rapports). Les sportifs uniques sont comptés sur
-- l'ensemble de la période, et non additionnés jour par jour.
create function public.stats_period_summary(p_from date, p_to date)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
begin
  perform private.assert_admin();
  perform private.assert_period(p_from, p_to);

  select jsonb_build_object(
    'entries', count(*),
    'unique_athletes', count(distinct v.athlete_id),
    'completed', count(*) filter (where v.status = 'closed'),
    'open', count(*) filter (where v.status = 'open'),
    'avg_duration_seconds', round(avg(v.duration_seconds) filter (where v.status = 'closed')),
    'total_duration_seconds', coalesce(sum(v.duration_seconds) filter (where v.status = 'closed'), 0),
    'new_athletes', (select count(*) from public.athletes a where a.registered_on between p_from and p_to),
    'subscriptions_new', (select count(*) from public.subscriptions s
                          where s.state <> 'cancelled' and s.renewed_from_id is null and s.starts_on between p_from and p_to),
    'subscriptions_renewed', (select count(*) from public.subscriptions s
                              where s.state <> 'cancelled' and s.renewed_from_id is not null and s.starts_on between p_from and p_to)
  )
  into v_result
  from public.visits v, private.local_bounds(p_from, p_to) lb
  where v.status <> 'cancelled'
    and v.entered_at >= lb.from_ts
    and v.entered_at < lb.to_ts;

  return v_result;
end;
$$;

revoke all on function public.stats_period_summary(date, date) from public, anon;
grant execute on function public.stats_period_summary(date, date) to authenticated;
