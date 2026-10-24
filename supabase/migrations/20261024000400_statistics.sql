-- =============================================================================
-- Statistiques (administrateurs uniquement)
--
-- Définitions (voir docs/STATISTIQUES.md) :
--   * Entrée          : un passage non annulé, compté à sa date d'entrée locale.
--   * Sportif unique  : un matricule distinct parmi les entrées de la période.
--   * Visite terminée : un passage clôturé (sortie enregistrée ou corrigée).
--   * Durée           : sortie − entrée, uniquement pour les visites terminées.
--   * Jour / semaine / mois : calendrier local du stade (fuseau des paramètres),
--     semaine du lundi au dimanche (ISO 8601), mois civil.
-- =============================================================================

create function private.local_bounds(p_from date, p_to date)
returns table (from_ts timestamptz, to_ts timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select (p_from::timestamp at time zone private.app_timezone()),
         ((p_to + 1)::timestamp at time zone private.app_timezone());
$$;

create function private.assert_period(p_from date, p_to date)
returns void
language plpgsql
immutable
set search_path = ''
as $$
begin
  if p_from is null or p_to is null or p_to < p_from or p_to - p_from > 3660 then
    raise exception 'ERR_DATE_INVALID' using errcode = 'P0001';
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- Tableau de bord
-- -----------------------------------------------------------------------------
create function public.stats_dashboard()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_tz text;
  v_today date;
  v_week_start date;
  v_month_start date;
  v_day_ts timestamptz;
  v_week_ts timestamptz;
  v_month_ts timestamptz;
  v_long_hours integer;
  v_result jsonb;
begin
  perform private.assert_admin();

  v_tz := private.app_timezone();
  v_today := public.app_today();
  v_week_start := date_trunc('week', v_today::timestamp)::date;
  v_month_start := date_trunc('month', v_today::timestamp)::date;
  v_day_ts := v_today::timestamp at time zone v_tz;
  v_week_ts := v_week_start::timestamp at time zone v_tz;
  v_month_ts := v_month_start::timestamp at time zone v_tz;
  v_long_hours := coalesce((select s.long_visit_hours from public.app_settings s where s.id), 6);

  with status_counts as (
    select
      count(*) as total,
      count(*) filter (where o.status = 'active') as active,
      count(*) filter (where o.expiring_soon) as expiring_soon,
      count(*) filter (where o.status = 'expired') as expired,
      count(*) filter (where o.status = 'upcoming') as upcoming,
      count(*) filter (where o.status = 'suspended') as suspended,
      count(*) filter (where o.status = 'none') as without_subscription,
      count(*) filter (where o.registered_on >= v_month_start) as new_this_month
    from public.athlete_overview o
  ),
  period_visits as (
    select
      count(*) filter (where v.entered_at >= v_day_ts) as entries_today,
      count(distinct v.athlete_id) filter (where v.entered_at >= v_day_ts) as unique_today,
      count(*) filter (where v.entered_at >= v_day_ts and v.status = 'closed') as completed_today,
      count(*) filter (where v.entered_at >= v_week_ts) as entries_week,
      count(distinct v.athlete_id) filter (where v.entered_at >= v_week_ts) as unique_week,
      count(*) filter (where v.entered_at >= v_month_ts) as entries_month,
      count(distinct v.athlete_id) filter (where v.entered_at >= v_month_ts) as unique_month,
      count(*) filter (where v.entered_at >= v_month_ts and v.status = 'closed') as completed_month,
      avg(v.duration_seconds) filter (where v.entered_at >= v_month_ts and v.status = 'closed') as avg_duration_month
    from public.visits v
    where v.status <> 'cancelled'
      and v.entered_at >= least(v_week_ts, v_month_ts)
  ),
  presence as (
    select
      count(*) as present_now,
      count(*) filter (where v.entered_at < now() - make_interval(hours => v_long_hours)) as long_open
    from public.visits v
    where v.status = 'open'
  ),
  sales as (
    select
      count(*) filter (where s.renewed_from_id is null) as new_subscriptions_month,
      count(*) filter (where s.renewed_from_id is not null) as renewals_month
    from public.subscriptions s
    where s.state <> 'cancelled'
      and s.created_at >= v_month_ts
  ),
  revenue as (
    select coalesce(jsonb_agg(jsonb_build_object('currency', r.currency, 'total', r.total) order by r.currency), '[]'::jsonb) as items
    from (
      select p.currency, sum(p.amount) as total
      from public.payments p
      where p.status = 'recorded' and p.paid_on >= v_month_start and p.paid_on <= v_today
      group by p.currency
    ) r
  )
  select jsonb_build_object(
    'today', v_today,
    'week_start', v_week_start,
    'month_start', v_month_start,
    'timezone', v_tz,
    'athletes_total', sc.total,
    'athletes_new_month', sc.new_this_month,
    'status_active', sc.active,
    'status_expiring_soon', sc.expiring_soon,
    'status_expired', sc.expired,
    'status_upcoming', sc.upcoming,
    'status_suspended', sc.suspended,
    'status_none', sc.without_subscription,
    'entries_today', pv.entries_today,
    'unique_today', pv.unique_today,
    'completed_today', pv.completed_today,
    'entries_week', pv.entries_week,
    'unique_week', pv.unique_week,
    'entries_month', pv.entries_month,
    'unique_month', pv.unique_month,
    'completed_month', pv.completed_month,
    'avg_duration_month_seconds', round(pv.avg_duration_month),
    'present_now', pr.present_now,
    'long_open_visits', pr.long_open,
    'new_subscriptions_month', sa.new_subscriptions_month,
    'renewals_month', sa.renewals_month,
    'revenue_month', rv.items
  )
  into v_result
  from status_counts sc, period_visits pv, presence pr, sales sa, revenue rv;

  return v_result;
end;
$$;

-- -----------------------------------------------------------------------------
-- Fréquentation par jour / semaine / mois (optionnellement pour un sportif)
-- -----------------------------------------------------------------------------
create function public.stats_attendance(
  p_from date,
  p_to date,
  p_granularity text default 'day',
  p_athlete_id uuid default null
)
returns table (
  bucket date,
  entries integer,
  unique_athletes integer,
  completed integer,
  avg_duration_seconds integer,
  total_duration_seconds bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_tz text := private.app_timezone();
  v_unit text;
begin
  perform private.assert_admin();
  perform private.assert_period(p_from, p_to);

  v_unit := case p_granularity when 'day' then 'day' when 'week' then 'week' when 'month' then 'month' end;
  if v_unit is null then
    raise exception 'ERR_INVALID_INPUT' using errcode = 'P0001';
  end if;

  return query
  with buckets as (
    select gs::date as b
    from generate_series(
      date_trunc(v_unit, p_from::timestamp),
      date_trunc(v_unit, p_to::timestamp),
      ('1 ' || v_unit)::interval
    ) gs
  ),
  scoped as (
    select
      date_trunc(v_unit, (v.entered_at at time zone v_tz))::date as b,
      v.athlete_id,
      v.status,
      v.duration_seconds
    from public.visits v, private.local_bounds(p_from, p_to) lb
    where v.status <> 'cancelled'
      and v.entered_at >= lb.from_ts
      and v.entered_at < lb.to_ts
      and (p_athlete_id is null or v.athlete_id = p_athlete_id)
  )
  select
    bk.b,
    count(sc.athlete_id)::integer,
    count(distinct sc.athlete_id)::integer,
    count(*) filter (where sc.status = 'closed')::integer,
    round(avg(sc.duration_seconds) filter (where sc.status = 'closed'))::integer,
    coalesce(sum(sc.duration_seconds) filter (where sc.status = 'closed'), 0)::bigint
  from buckets bk
  left join scoped sc on sc.b = bk.b
  group by bk.b
  order by bk.b;
end;
$$;

-- -----------------------------------------------------------------------------
-- Périodes de forte fréquentation (jour de la semaine × heure)
-- -----------------------------------------------------------------------------
create function public.stats_peak_hours(p_from date, p_to date)
returns table (iso_dow integer, hour integer, entries integer)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_tz text := private.app_timezone();
begin
  perform private.assert_admin();
  perform private.assert_period(p_from, p_to);

  return query
  select
    extract(isodow from (v.entered_at at time zone v_tz))::integer,
    extract(hour from (v.entered_at at time zone v_tz))::integer,
    count(*)::integer
  from public.visits v, private.local_bounds(p_from, p_to) lb
  where v.status <> 'cancelled'
    and v.entered_at >= lb.from_ts
    and v.entered_at < lb.to_ts
  group by 1, 2
  order by 1, 2;
end;
$$;

-- -----------------------------------------------------------------------------
-- Activité des agents (supervision)
-- -----------------------------------------------------------------------------
create function public.stats_agents(p_from date, p_to date)
returns table (
  profile_id uuid,
  display_name text,
  role public.app_role,
  is_active boolean,
  entries_recorded integer,
  exits_recorded integer,
  last_activity_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.assert_admin();
  perform private.assert_period(p_from, p_to);

  return query
  with lb as (select * from private.local_bounds(p_from, p_to)),
  ent as (
    select v.entry_agent_id as pid, count(*) as n, max(v.entered_at) as last_at
    from public.visits v, lb
    where v.entered_at >= lb.from_ts and v.entered_at < lb.to_ts
    group by v.entry_agent_id
  ),
  ext as (
    select v.exit_agent_id as pid, count(*) as n, max(v.exited_at) as last_at
    from public.visits v, lb
    where v.exit_agent_id is not null and v.exited_at >= lb.from_ts and v.exited_at < lb.to_ts
    group by v.exit_agent_id
  )
  select
    p.id,
    p.display_name,
    p.role,
    p.is_active,
    coalesce(ent.n, 0)::integer,
    coalesce(ext.n, 0)::integer,
    greatest(ent.last_at, ext.last_at)
  from public.profiles p
  left join ent on ent.pid = p.id
  left join ext on ext.pid = p.id
  order by coalesce(ent.n, 0) + coalesce(ext.n, 0) desc, p.display_name;
end;
$$;

-- -----------------------------------------------------------------------------
-- Recettes enregistrées
-- -----------------------------------------------------------------------------
create function public.stats_revenue(p_from date, p_to date)
returns table (currency text, plan_name text, payments integer, total numeric)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.assert_admin();
  perform private.assert_period(p_from, p_to);

  return query
  select p.currency, coalesce(pl.name, 'Sans formule'), count(*)::integer, sum(p.amount)
  from public.payments p
  left join public.subscriptions s on s.id = p.subscription_id
  left join public.subscription_plans pl on pl.id = s.plan_id
  where p.status = 'recorded' and p.paid_on between p_from and p_to
  group by p.currency, coalesce(pl.name, 'Sans formule')
  order by p.currency, sum(p.amount) desc;
end;
$$;

-- -----------------------------------------------------------------------------
-- Fiche sportif : indicateurs de fréquentation
-- -----------------------------------------------------------------------------
create function public.stats_athlete(p_athlete_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_tz text := private.app_timezone();
  v_today date := public.app_today();
  v_day_ts timestamptz;
  v_week_ts timestamptz;
  v_month_ts timestamptz;
  v_result jsonb;
begin
  perform private.assert_admin();

  if not exists (select 1 from public.athletes where id = p_athlete_id) then
    raise exception 'ERR_ATHLETE_NOT_FOUND' using errcode = 'P0001';
  end if;

  v_day_ts := v_today::timestamp at time zone v_tz;
  v_week_ts := date_trunc('week', v_today::timestamp) at time zone v_tz;
  v_month_ts := date_trunc('month', v_today::timestamp) at time zone v_tz;

  select jsonb_build_object(
    'visits_today', count(*) filter (where v.entered_at >= v_day_ts),
    'visits_week', count(*) filter (where v.entered_at >= v_week_ts),
    'visits_month', count(*) filter (where v.entered_at >= v_month_ts),
    'visits_total', count(*),
    'completed_total', count(*) filter (where v.status = 'closed'),
    'total_duration_seconds', coalesce(sum(v.duration_seconds) filter (where v.status = 'closed'), 0),
    'avg_duration_seconds', round(avg(v.duration_seconds) filter (where v.status = 'closed')),
    'first_visit_at', min(v.entered_at),
    'last_visit_at', max(v.entered_at),
    'is_inside', bool_or(v.status = 'open')
  )
  into v_result
  from public.visits v
  where v.athlete_id = p_athlete_id and v.status <> 'cancelled';

  return v_result;
end;
$$;

revoke all on all functions in schema public from public, anon, authenticated;
revoke all on all functions in schema private from public, anon, authenticated;

grant execute on function
  public.current_app_role(),
  public.is_admin(),
  public.is_staff(),
  public.app_today(),
  public.normalize_matricule(text),
  public.is_valid_matricule(text),
  public.subscription_validity(public.subscription_state, date, date, date),
  public.admin_create_athlete(text, date),
  public.admin_save_plan(uuid, text, integer, numeric, text, boolean),
  public.admin_create_subscription(uuid, uuid, date, date, uuid, numeric, text, public.payment_method, text, date),
  public.admin_set_subscription_state(uuid, public.subscription_state, text),
  public.admin_record_payment(uuid, uuid, numeric, text, date, public.payment_method, text),
  public.admin_cancel_payment(uuid, text),
  public.control_check(text),
  public.control_record_entry(text),
  public.control_record_exit(text),
  public.control_overview(),
  public.control_present(integer),
  public.control_my_activity(integer),
  public.admin_correct_visit(uuid, text, timestamptz, text),
  public.admin_register_staff(uuid, text, public.app_role),
  public.admin_set_staff_active(uuid, boolean),
  public.admin_update_settings(text, text, integer, integer, text),
  public.admin_log_export(text, jsonb),
  public.stats_dashboard(),
  public.stats_attendance(date, date, text, uuid),
  public.stats_peak_hours(date, date),
  public.stats_agents(date, date),
  public.stats_revenue(date, date),
  public.stats_athlete(uuid)
to authenticated;
