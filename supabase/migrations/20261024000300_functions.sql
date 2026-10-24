-- =============================================================================
-- Règles métier : fonctions transactionnelles appelées par l'application.
--
-- Toutes les fonctions :
--   * sont SECURITY DEFINER avec search_path vide (pas de détournement d'objets) ;
--   * vérifient le rôle de l'appelant AVANT toute lecture ou écriture ;
--   * signalent les erreurs métier par un code stable « ERR_… » traduit en
--     français par l'application ;
--   * journalisent les opérations administratives sensibles.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Utilitaires purs
-- -----------------------------------------------------------------------------

-- Normalisation : majuscules, suppression des espaces, tirets et points.
create function public.normalize_matricule(p_value text)
returns text
language sql
immutable
set search_path = ''
as $$
  select upper(regexp_replace(coalesce(p_value, ''), '[[:space:].-]', '', 'g'));
$$;

create function public.is_valid_matricule(p_value text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_value ~ '^[A-Z]{2}[0-9]{5}$';
$$;

-- Validité d'un abonnement à une date donnée (date locale du stade).
-- La date de fin est incluse : l'abonnement est valide jusqu'à 23:59:59.
create function public.subscription_validity(
  p_state public.subscription_state,
  p_starts_on date,
  p_ends_on date,
  p_today date
)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when p_state = 'cancelled' then 'cancelled'
    when p_today < p_starts_on then 'upcoming'
    when p_today > p_ends_on then 'expired'
    when p_state = 'suspended' then 'suspended'
    else 'active'
  end;
$$;

create function private.require_reason(p_reason text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_reason text := btrim(coalesce(p_reason, ''));
begin
  if char_length(v_reason) < 5 or char_length(v_reason) > 300 then
    raise exception 'ERR_REASON_REQUIRED' using errcode = 'P0001';
  end if;
  return v_reason;
end;
$$;

-- -----------------------------------------------------------------------------
-- Vues de lecture (soumises à la RLS de l'appelant : security_invoker)
-- -----------------------------------------------------------------------------

-- Synthèse par sportif : abonnement de référence et statut calculé.
-- Abonnement de référence = en cours, sinon prochain à venir, sinon dernier passé.
create view public.athlete_overview
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
  coalesce(vs.visit_count, 0)::integer as visit_count
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

create view public.subscription_overview
with (security_invoker = true)
as
select
  s.id,
  s.athlete_id,
  a.matricule,
  s.plan_id,
  pl.name as plan_name,
  s.starts_on,
  s.ends_on,
  (s.ends_on - s.starts_on + 1) as length_days,
  s.state,
  s.state_reason,
  s.state_changed_at,
  s.renewed_from_id,
  s.created_at,
  s.created_by,
  cb.display_name as created_by_name,
  public.subscription_validity(s.state, s.starts_on, s.ends_on, t.today) as validity,
  s.ends_on - t.today as days_remaining,
  exists (
    select 1 from public.subscriptions n
    where n.athlete_id = s.athlete_id
      and n.state <> 'cancelled'
      and n.starts_on > s.ends_on
  ) as has_successor,
  coalesce((
    select sum(p.amount) from public.payments p
    where p.subscription_id = s.id and p.status = 'recorded'
  ), 0) as paid_amount
from public.subscriptions s
join public.athletes a on a.id = s.athlete_id
left join public.subscription_plans pl on pl.id = s.plan_id
left join public.profiles cb on cb.id = s.created_by
cross join lateral (select public.app_today() as today) t;

create view public.visit_log
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
  v.correction_reason
from public.visits v
join public.athletes a on a.id = v.athlete_id
left join public.profiles ea on ea.id = v.entry_agent_id
left join public.profiles xa on xa.id = v.exit_agent_id
left join public.profiles ca on ca.id = v.corrected_by
cross join lateral (
  select coalesce((select s.timezone from public.app_settings s where s.id), 'Africa/Bamako') as tz
) private_tz;

create view public.payment_log
with (security_invoker = true)
as
select
  p.id,
  p.athlete_id,
  a.matricule,
  p.subscription_id,
  pl.name as plan_name,
  p.amount,
  p.currency,
  p.paid_on,
  p.method,
  p.reference,
  p.status,
  p.recorded_by,
  rb.display_name as recorded_by_name,
  p.created_at,
  p.cancelled_at,
  p.cancel_reason
from public.payments p
join public.athletes a on a.id = p.athlete_id
left join public.subscriptions s on s.id = p.subscription_id
left join public.subscription_plans pl on pl.id = s.plan_id
left join public.profiles rb on rb.id = p.recorded_by;

create view public.audit_log_view
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
  coalesce(a1.matricule, a2.matricule, a3.matricule, a4.matricule) as matricule
from public.audit_logs l
left join public.profiles pr on pr.id = l.actor_id
left join public.athletes a1 on l.entity_type = 'athlete' and a1.id = l.entity_id
left join public.subscriptions s on l.entity_type = 'subscription' and s.id = l.entity_id
left join public.athletes a2 on a2.id = s.athlete_id
left join public.visits v on l.entity_type = 'visit' and v.id = l.entity_id
left join public.athletes a3 on a3.id = v.athlete_id
left join public.payments p on l.entity_type = 'payment' and p.id = l.entity_id
left join public.athletes a4 on a4.id = p.athlete_id;

-- -----------------------------------------------------------------------------
-- Sportifs
-- -----------------------------------------------------------------------------
create function public.admin_create_athlete(
  p_matricule text,
  p_registered_on date default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := private.assert_admin();
  v_matricule text := public.normalize_matricule(p_matricule);
  v_registered_on date := coalesce(p_registered_on, public.app_today());
  v_id uuid;
begin
  perform private.enforce_rate_limit('admin_write', 120);

  if not public.is_valid_matricule(v_matricule) then
    raise exception 'ERR_MATRICULE_FORMAT' using errcode = 'P0001';
  end if;
  if v_registered_on > public.app_today() then
    raise exception 'ERR_DATE_FUTURE' using errcode = 'P0001';
  end if;

  begin
    insert into public.athletes (matricule, registered_on, created_by)
    values (v_matricule, v_registered_on, v_actor)
    returning id into v_id;
  exception when unique_violation then
    -- Jamais d'attribution silencieuse : l'administrateur doit résoudre le doublon.
    raise exception 'ERR_MATRICULE_DUPLICATE' using errcode = 'P0001';
  end;

  perform private.audit('athlete.created', 'athlete', v_id,
    jsonb_build_object('registered_on', v_registered_on));
  return v_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- Formules d'abonnement
-- -----------------------------------------------------------------------------
create function public.admin_save_plan(
  p_id uuid,
  p_name text,
  p_duration_days integer,
  p_price numeric,
  p_currency text,
  p_is_active boolean
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := private.assert_admin();
  v_id uuid;
  v_currency text := upper(btrim(coalesce(p_currency, '')));
begin
  perform private.enforce_rate_limit('admin_write', 120);

  if p_name is null or char_length(btrim(p_name)) not between 2 and 60
     or p_duration_days is null or p_duration_days not between 1 and 3660
     or (p_price is not null and p_price < 0)
     or v_currency !~ '^[A-Z]{3}$' then
    raise exception 'ERR_INVALID_INPUT' using errcode = 'P0001';
  end if;

  begin
    if p_id is null then
      insert into public.subscription_plans (name, duration_days, price, currency, is_active, created_by)
      values (btrim(p_name), p_duration_days, p_price, v_currency, coalesce(p_is_active, true), v_actor)
      returning id into v_id;
      perform private.audit('plan.created', 'plan', v_id,
        jsonb_build_object('name', btrim(p_name), 'duration_days', p_duration_days, 'price', p_price, 'currency', v_currency));
    else
      update public.subscription_plans
      set name = btrim(p_name),
          duration_days = p_duration_days,
          price = p_price,
          currency = v_currency,
          is_active = coalesce(p_is_active, true)
      where id = p_id
      returning id into v_id;
      if v_id is null then
        raise exception 'ERR_PLAN_NOT_FOUND' using errcode = 'P0001';
      end if;
      perform private.audit('plan.updated', 'plan', v_id,
        jsonb_build_object('name', btrim(p_name), 'duration_days', p_duration_days, 'price', p_price,
                           'currency', v_currency, 'is_active', coalesce(p_is_active, true)));
    end if;
  exception when unique_violation then
    raise exception 'ERR_PLAN_DUPLICATE' using errcode = 'P0001';
  end;

  return v_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- Abonnements et renouvellements
-- -----------------------------------------------------------------------------
create function public.admin_create_subscription(
  p_athlete_id uuid,
  p_plan_id uuid,
  p_starts_on date,
  p_ends_on date default null,
  p_renewed_from_id uuid default null,
  p_payment_amount numeric default null,
  p_payment_currency text default null,
  p_payment_method public.payment_method default null,
  p_payment_reference text default null,
  p_paid_on date default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := private.assert_admin();
  v_today date := public.app_today();
  v_plan public.subscription_plans;
  v_ends_on date := p_ends_on;
  v_previous public.subscriptions;
  v_id uuid;
  v_payment_id uuid;
  v_currency text;
  v_reference text := nullif(btrim(coalesce(p_payment_reference, '')), '');
begin
  perform private.enforce_rate_limit('admin_write', 120);

  -- Verrou sur le sportif : sérialise les créations concurrentes d'abonnements.
  perform 1 from public.athletes where id = p_athlete_id for update;
  if not found then
    raise exception 'ERR_ATHLETE_NOT_FOUND' using errcode = 'P0001';
  end if;

  if p_plan_id is not null then
    select * into v_plan from public.subscription_plans where id = p_plan_id;
    if not found then
      raise exception 'ERR_PLAN_NOT_FOUND' using errcode = 'P0001';
    end if;
    if not v_plan.is_active then
      raise exception 'ERR_PLAN_INACTIVE' using errcode = 'P0001';
    end if;
  end if;

  if p_starts_on is null then
    raise exception 'ERR_INVALID_INPUT' using errcode = 'P0001', detail = 'starts_on';
  end if;
  -- Saisie rétroactive limitée à un an pour éviter les erreurs de frappe.
  if p_starts_on < v_today - 366 or p_starts_on > v_today + 366 then
    raise exception 'ERR_DATE_INVALID' using errcode = 'P0001', detail = 'starts_on';
  end if;

  if v_ends_on is null then
    if v_plan.id is null then
      raise exception 'ERR_INVALID_INPUT' using errcode = 'P0001', detail = 'ends_on';
    end if;
    v_ends_on := p_starts_on + v_plan.duration_days - 1;
  end if;
  if v_ends_on < p_starts_on or v_ends_on - p_starts_on > 3660 then
    raise exception 'ERR_DATE_INVALID' using errcode = 'P0001', detail = 'ends_on';
  end if;

  if p_renewed_from_id is not null then
    select * into v_previous from public.subscriptions where id = p_renewed_from_id;
    if not found or v_previous.athlete_id <> p_athlete_id then
      raise exception 'ERR_SUBSCRIPTION_NOT_FOUND' using errcode = 'P0001';
    end if;
    if v_previous.state = 'cancelled' then
      raise exception 'ERR_INVALID_STATE_TRANSITION' using errcode = 'P0001';
    end if;
  end if;

  begin
    insert into public.subscriptions (athlete_id, plan_id, starts_on, ends_on, renewed_from_id, created_by)
    values (p_athlete_id, p_plan_id, p_starts_on, v_ends_on, p_renewed_from_id, v_actor)
    returning id into v_id;
  exception when exclusion_violation then
    raise exception 'ERR_SUBSCRIPTION_OVERLAP' using errcode = 'P0001';
  end;

  if p_payment_amount is not null then
    v_currency := upper(btrim(coalesce(p_payment_currency, v_plan.currency,
      (select s.default_currency from public.app_settings s where s.id))));
    if p_payment_amount <= 0 or p_payment_amount > 100000000
       or v_currency !~ '^[A-Z]{3}$'
       or p_payment_method is null
       or (v_reference is not null and char_length(v_reference) > 80) then
      raise exception 'ERR_INVALID_INPUT' using errcode = 'P0001', detail = 'payment';
    end if;
    if coalesce(p_paid_on, v_today) > v_today then
      raise exception 'ERR_DATE_FUTURE' using errcode = 'P0001';
    end if;

    insert into public.payments (athlete_id, subscription_id, amount, currency, paid_on, method, reference, recorded_by)
    values (p_athlete_id, v_id, p_payment_amount, v_currency, coalesce(p_paid_on, v_today), p_payment_method, v_reference, v_actor)
    returning id into v_payment_id;

    perform private.audit('payment.recorded', 'payment', v_payment_id,
      jsonb_build_object('subscription_id', v_id, 'amount', p_payment_amount, 'currency', v_currency, 'method', p_payment_method));
  end if;

  perform private.audit(
    case when p_renewed_from_id is null then 'subscription.created' else 'subscription.renewed' end,
    'subscription', v_id,
    jsonb_build_object(
      'athlete_id', p_athlete_id,
      'plan_id', p_plan_id,
      'starts_on', p_starts_on,
      'ends_on', v_ends_on,
      'renewed_from_id', p_renewed_from_id,
      'payment_id', v_payment_id
    ));

  return v_id;
end;
$$;

create function public.admin_set_subscription_state(
  p_subscription_id uuid,
  p_state public.subscription_state,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := private.assert_admin();
  v_reason text := private.require_reason(p_reason);
  v_current public.subscriptions;
begin
  perform private.enforce_rate_limit('admin_write', 120);

  select * into v_current from public.subscriptions where id = p_subscription_id for update;
  if not found then
    raise exception 'ERR_SUBSCRIPTION_NOT_FOUND' using errcode = 'P0001';
  end if;

  -- Transitions autorisées : actif ⇄ suspendu, actif|suspendu → annulé (définitif).
  if v_current.state = 'cancelled' or v_current.state = p_state then
    raise exception 'ERR_INVALID_STATE_TRANSITION' using errcode = 'P0001';
  end if;

  update public.subscriptions
  set state = p_state,
      state_reason = v_reason,
      state_changed_at = now(),
      state_changed_by = v_actor
  where id = p_subscription_id;

  perform private.audit('subscription.state_changed', 'subscription', p_subscription_id,
    jsonb_build_object('from', v_current.state, 'to', p_state, 'reason', v_reason));
end;
$$;

-- -----------------------------------------------------------------------------
-- Paiements (enregistrement manuel de paiements effectués hors application)
-- -----------------------------------------------------------------------------
create function public.admin_record_payment(
  p_athlete_id uuid,
  p_subscription_id uuid,
  p_amount numeric,
  p_currency text,
  p_paid_on date,
  p_method public.payment_method,
  p_reference text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := private.assert_admin();
  v_currency text := upper(btrim(coalesce(p_currency, '')));
  v_reference text := nullif(btrim(coalesce(p_reference, '')), '');
  v_id uuid;
begin
  perform private.enforce_rate_limit('admin_write', 120);

  if not exists (select 1 from public.athletes where id = p_athlete_id) then
    raise exception 'ERR_ATHLETE_NOT_FOUND' using errcode = 'P0001';
  end if;
  if p_subscription_id is not null and not exists (
    select 1 from public.subscriptions where id = p_subscription_id and athlete_id = p_athlete_id
  ) then
    raise exception 'ERR_SUBSCRIPTION_NOT_FOUND' using errcode = 'P0001';
  end if;
  if p_amount is null or p_amount <= 0 or p_amount > 100000000
     or v_currency !~ '^[A-Z]{3}$' or p_method is null or p_paid_on is null
     or (v_reference is not null and char_length(v_reference) > 80) then
    raise exception 'ERR_INVALID_INPUT' using errcode = 'P0001';
  end if;
  if p_paid_on > public.app_today() then
    raise exception 'ERR_DATE_FUTURE' using errcode = 'P0001';
  end if;

  insert into public.payments (athlete_id, subscription_id, amount, currency, paid_on, method, reference, recorded_by)
  values (p_athlete_id, p_subscription_id, p_amount, v_currency, p_paid_on, p_method, v_reference, v_actor)
  returning id into v_id;

  perform private.audit('payment.recorded', 'payment', v_id,
    jsonb_build_object('subscription_id', p_subscription_id, 'amount', p_amount, 'currency', v_currency, 'method', p_method));
  return v_id;
end;
$$;

create function public.admin_cancel_payment(p_payment_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := private.assert_admin();
  v_reason text := private.require_reason(p_reason);
  v_status public.payment_status;
begin
  perform private.enforce_rate_limit('admin_write', 120);

  select status into v_status from public.payments where id = p_payment_id for update;
  if not found then
    raise exception 'ERR_PAYMENT_NOT_FOUND' using errcode = 'P0001';
  end if;
  if v_status = 'cancelled' then
    raise exception 'ERR_INVALID_STATE_TRANSITION' using errcode = 'P0001';
  end if;

  update public.payments
  set status = 'cancelled', cancelled_at = now(), cancelled_by = v_actor, cancel_reason = v_reason
  where id = p_payment_id;

  perform private.audit('payment.cancelled', 'payment', p_payment_id, jsonb_build_object('reason', v_reason));
end;
$$;

-- -----------------------------------------------------------------------------
-- Contrôle d'accès au stade (agents et administrateurs)
-- -----------------------------------------------------------------------------

-- Vérification d'un matricule : ne renvoie que les informations nécessaires au
-- contrôle. Aucune écriture.
create function public.control_check(p_matricule text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_today date := public.app_today();
  v_matricule text := public.normalize_matricule(p_matricule);
  v_athlete_id uuid;
  v_sub record;
  v_open public.visits;
  v_validity text;
  v_outcome text;
begin
  perform private.assert_staff();
  perform private.enforce_rate_limit('control_read', 120);

  if not public.is_valid_matricule(v_matricule) then
    return jsonb_build_object('outcome', 'invalid_format', 'matricule', v_matricule, 'checked_at', now());
  end if;

  select id into v_athlete_id from public.athletes where matricule = v_matricule;
  if not found then
    return jsonb_build_object('outcome', 'not_found', 'matricule', v_matricule, 'checked_at', now());
  end if;

  select s.id, s.starts_on, s.ends_on, s.state, pl.name as plan_name
  into v_sub
  from public.subscriptions s
  left join public.subscription_plans pl on pl.id = s.plan_id
  where s.athlete_id = v_athlete_id and s.state <> 'cancelled'
  order by
    (v_today between s.starts_on and s.ends_on) desc,
    (s.starts_on > v_today) desc,
    case when s.starts_on > v_today then s.starts_on end asc,
    s.ends_on desc
  limit 1;

  if v_sub.id is null then
    v_validity := 'none';
  else
    v_validity := public.subscription_validity(v_sub.state, v_sub.starts_on, v_sub.ends_on, v_today);
  end if;

  select * into v_open from public.visits where athlete_id = v_athlete_id and status = 'open';

  v_outcome := case
    when v_open.id is not null then 'already_inside'
    when v_validity = 'active' then 'authorized'
    when v_validity = 'none' then 'no_subscription'
    else v_validity  -- expired | upcoming | suspended
  end;

  return jsonb_build_object(
    'outcome', v_outcome,
    'matricule', v_matricule,
    'validity', v_validity,
    'checked_at', now(),
    'subscription', case when v_sub.id is null then null else jsonb_build_object(
      'starts_on', v_sub.starts_on,
      'ends_on', v_sub.ends_on,
      'plan_name', v_sub.plan_name,
      'days_remaining', v_sub.ends_on - v_today
    ) end,
    'open_visit', case when v_open.id is null then null else jsonb_build_object(
      'entered_at', v_open.entered_at
    ) end
  );
end;
$$;

create function public.control_record_entry(p_matricule text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := private.assert_staff();
  v_today date := public.app_today();
  v_matricule text := public.normalize_matricule(p_matricule);
  v_athlete_id uuid;
  v_sub_id uuid;
  v_visit public.visits;
begin
  perform private.enforce_rate_limit('control_write', 60);

  if not public.is_valid_matricule(v_matricule) then
    raise exception 'ERR_MATRICULE_FORMAT' using errcode = 'P0001';
  end if;

  -- Verrou sur le sportif : deux agents ne peuvent pas enregistrer la même
  -- entrée simultanément.
  select id into v_athlete_id from public.athletes where matricule = v_matricule for update;
  if not found then
    raise exception 'ERR_ATHLETE_NOT_FOUND' using errcode = 'P0001';
  end if;

  if exists (select 1 from public.visits where athlete_id = v_athlete_id and status = 'open') then
    raise exception 'ERR_ALREADY_INSIDE' using errcode = 'P0001';
  end if;

  -- La validité est recalculée ici, côté serveur, au moment exact de l'entrée.
  select s.id into v_sub_id
  from public.subscriptions s
  where s.athlete_id = v_athlete_id
    and public.subscription_validity(s.state, s.starts_on, s.ends_on, v_today) = 'active'
  limit 1;
  if v_sub_id is null then
    raise exception 'ERR_SUBSCRIPTION_INVALID' using errcode = 'P0001';
  end if;

  begin
    insert into public.visits (athlete_id, subscription_id, entry_agent_id)
    values (v_athlete_id, v_sub_id, v_actor)
    returning * into v_visit;
  exception when unique_violation then
    raise exception 'ERR_ALREADY_INSIDE' using errcode = 'P0001';
  end;

  return jsonb_build_object('matricule', v_matricule, 'entered_at', v_visit.entered_at);
end;
$$;

create function public.control_record_exit(p_matricule text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := private.assert_staff();
  v_matricule text := public.normalize_matricule(p_matricule);
  v_athlete_id uuid;
  v_visit public.visits;
begin
  perform private.enforce_rate_limit('control_write', 60);

  if not public.is_valid_matricule(v_matricule) then
    raise exception 'ERR_MATRICULE_FORMAT' using errcode = 'P0001';
  end if;

  select id into v_athlete_id from public.athletes where matricule = v_matricule;
  if not found then
    raise exception 'ERR_ATHLETE_NOT_FOUND' using errcode = 'P0001';
  end if;

  -- Mise à jour atomique : une sortie ne peut être enregistrée qu'une fois.
  update public.visits
  set exited_at = now(), status = 'closed', exit_agent_id = v_actor
  where athlete_id = v_athlete_id and status = 'open'
  returning * into v_visit;

  if v_visit.id is null then
    raise exception 'ERR_NO_OPEN_VISIT' using errcode = 'P0001';
  end if;

  return jsonb_build_object(
    'matricule', v_matricule,
    'entered_at', v_visit.entered_at,
    'exited_at', v_visit.exited_at,
    'duration_seconds', v_visit.duration_seconds
  );
end;
$$;

-- Indicateurs utiles au poste de contrôle.
create function public.control_overview()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := private.assert_staff();
  v_tz text := private.app_timezone();
  v_day_start timestamptz := (public.app_today()::timestamp at time zone v_tz);
  v_long_hours integer := coalesce((select s.long_visit_hours from public.app_settings s where s.id), 6);
begin
  return jsonb_build_object(
    'present_now', (select count(*) from public.visits where status = 'open'),
    'long_open_visits', (select count(*) from public.visits
                         where status = 'open' and entered_at < now() - make_interval(hours => v_long_hours)),
    'entries_today', (select count(*) from public.visits
                      where status <> 'cancelled' and entered_at >= v_day_start),
    'my_entries_today', (select count(*) from public.visits
                         where entry_agent_id = v_actor and entered_at >= v_day_start),
    'my_exits_today', (select count(*) from public.visits
                       where exit_agent_id = v_actor and exited_at >= v_day_start)
  );
end;
$$;

-- Sportifs actuellement présents : matricule et heure d'entrée uniquement,
-- pour faciliter l'enregistrement des sorties.
create function public.control_present(p_limit integer default 50)
returns table (matricule text, entered_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.assert_staff();
  return query
    select a.matricule, v.entered_at
    from public.visits v
    join public.athletes a on a.id = v.athlete_id
    where v.status = 'open'
    order by v.entered_at desc
    limit least(greatest(coalesce(p_limit, 50), 1), 200);
end;
$$;

-- Dernières opérations de l'agent connecté (journée en cours).
create function public.control_my_activity(p_limit integer default 20)
returns table (kind text, matricule text, occurred_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := private.assert_staff();
  v_day_start timestamptz := (public.app_today()::timestamp at time zone private.app_timezone());
begin
  return query
    select ops.kind, ops.matricule, ops.occurred_at
    from (
      select 'entry'::text as kind, a.matricule, v.entered_at as occurred_at
      from public.visits v join public.athletes a on a.id = v.athlete_id
      where v.entry_agent_id = v_actor and v.entered_at >= v_day_start
      union all
      select 'exit'::text, a.matricule, v.exited_at
      from public.visits v join public.athletes a on a.id = v.athlete_id
      where v.exit_agent_id = v_actor and v.exited_at >= v_day_start
    ) ops
    order by ops.occurred_at desc
    limit least(greatest(coalesce(p_limit, 20), 1), 100);
end;
$$;

-- -----------------------------------------------------------------------------
-- Corrections administratives des passages
-- -----------------------------------------------------------------------------
create function public.admin_correct_visit(
  p_visit_id uuid,
  p_action text,
  p_exited_at timestamptz,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := private.assert_admin();
  v_reason text := private.require_reason(p_reason);
  v_visit public.visits;
begin
  perform private.enforce_rate_limit('admin_write', 120);

  select * into v_visit from public.visits where id = p_visit_id for update;
  if not found then
    raise exception 'ERR_VISIT_NOT_FOUND' using errcode = 'P0001';
  end if;
  if v_visit.status = 'cancelled' then
    raise exception 'ERR_INVALID_STATE_TRANSITION' using errcode = 'P0001';
  end if;

  if p_action = 'close' then
    if p_exited_at is null or p_exited_at < v_visit.entered_at or p_exited_at > now() then
      raise exception 'ERR_DATE_INVALID' using errcode = 'P0001';
    end if;
    update public.visits
    set exited_at = p_exited_at,
        status = 'closed',
        corrected_at = now(),
        corrected_by = v_actor,
        correction_reason = v_reason
    where id = p_visit_id;
  elsif p_action = 'cancel' then
    update public.visits
    set status = 'cancelled',
        corrected_at = now(),
        corrected_by = v_actor,
        correction_reason = v_reason
    where id = p_visit_id;
  else
    raise exception 'ERR_INVALID_INPUT' using errcode = 'P0001';
  end if;

  perform private.audit('visit.corrected', 'visit', p_visit_id, jsonb_build_object(
    'action', p_action,
    'previous_status', v_visit.status,
    'previous_exited_at', v_visit.exited_at,
    'new_exited_at', case when p_action = 'close' then p_exited_at else v_visit.exited_at end,
    'reason', v_reason
  ));
end;
$$;

-- -----------------------------------------------------------------------------
-- Personnel
-- -----------------------------------------------------------------------------

-- Appelée par le serveur de l'application juste après la création du compte
-- d'authentification (clé service_role côté serveur uniquement).
create function public.admin_register_staff(
  p_user_id uuid,
  p_display_name text,
  p_role public.app_role
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := private.assert_admin();
begin
  perform private.enforce_rate_limit('admin_write', 120);

  if p_user_id = v_actor then
    raise exception 'ERR_SELF_ACTION' using errcode = 'P0001';
  end if;
  if p_display_name is null or char_length(btrim(p_display_name)) not between 2 and 80 or p_role is null then
    raise exception 'ERR_INVALID_INPUT' using errcode = 'P0001';
  end if;
  if not exists (select 1 from auth.users where id = p_user_id) then
    raise exception 'ERR_USER_NOT_FOUND' using errcode = 'P0001';
  end if;

  begin
    insert into public.profiles (id, role, display_name)
    values (p_user_id, p_role, btrim(p_display_name));
  exception when unique_violation then
    raise exception 'ERR_PROFILE_EXISTS' using errcode = 'P0001';
  end;

  perform private.audit('staff.created', 'profile', p_user_id,
    jsonb_build_object('role', p_role, 'display_name', btrim(p_display_name)));
end;
$$;

create function public.admin_set_staff_active(p_user_id uuid, p_active boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := private.assert_admin();
  v_profile public.profiles;
begin
  perform private.enforce_rate_limit('admin_write', 120);

  -- Un administrateur ne peut pas modifier son propre accès.
  if p_user_id = v_actor then
    raise exception 'ERR_SELF_ACTION' using errcode = 'P0001';
  end if;

  select * into v_profile from public.profiles where id = p_user_id for update;
  if not found then
    raise exception 'ERR_USER_NOT_FOUND' using errcode = 'P0001';
  end if;
  if v_profile.is_active = p_active then
    return;
  end if;

  update public.profiles
  set is_active = p_active,
      deactivated_at = case when p_active then null else now() end
  where id = p_user_id;

  perform private.audit(
    case when p_active then 'staff.activated' else 'staff.deactivated' end,
    'profile', p_user_id, '{}'::jsonb);
end;
$$;

-- -----------------------------------------------------------------------------
-- Paramètres
-- -----------------------------------------------------------------------------
create function public.admin_update_settings(
  p_stadium_name text,
  p_timezone text,
  p_expiring_soon_days integer,
  p_long_visit_hours integer,
  p_default_currency text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := private.assert_admin();
  v_before public.app_settings;
begin
  perform private.enforce_rate_limit('admin_write', 120);

  if not exists (select 1 from pg_catalog.pg_timezone_names where name = p_timezone) then
    raise exception 'ERR_INVALID_INPUT' using errcode = 'P0001', detail = 'timezone';
  end if;

  select * into v_before from public.app_settings where id;

  begin
    update public.app_settings
    set stadium_name = btrim(p_stadium_name),
        timezone = p_timezone,
        expiring_soon_days = p_expiring_soon_days,
        long_visit_hours = p_long_visit_hours,
        default_currency = upper(btrim(p_default_currency)),
        updated_by = v_actor
    where id;
  exception when check_violation or not_null_violation then
    raise exception 'ERR_INVALID_INPUT' using errcode = 'P0001';
  end;

  perform private.audit('settings.updated', 'settings', null, jsonb_build_object(
    'before', jsonb_build_object('stadium_name', v_before.stadium_name, 'timezone', v_before.timezone,
      'expiring_soon_days', v_before.expiring_soon_days, 'long_visit_hours', v_before.long_visit_hours,
      'default_currency', v_before.default_currency),
    'after', jsonb_build_object('stadium_name', btrim(p_stadium_name), 'timezone', p_timezone,
      'expiring_soon_days', p_expiring_soon_days, 'long_visit_hours', p_long_visit_hours,
      'default_currency', upper(btrim(p_default_currency)))
  ));
end;
$$;

-- -----------------------------------------------------------------------------
-- Exports (journalisation + limitation de débit)
-- -----------------------------------------------------------------------------
create function public.admin_log_export(p_kind text, p_params jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.assert_admin();
  perform private.enforce_rate_limit('export', 20);
  if p_kind !~ '^[a-z_]{3,40}$' then
    raise exception 'ERR_INVALID_INPUT' using errcode = 'P0001';
  end if;
  perform private.audit('export.generated', 'export', null,
    jsonb_build_object('kind', p_kind, 'params', coalesce(p_params, '{}'::jsonb)));
end;
$$;

-- -----------------------------------------------------------------------------
-- Création du premier administrateur (à exécuter dans l'éditeur SQL Supabase,
-- avec le rôle postgres ; inaccessible depuis l'API).
-- -----------------------------------------------------------------------------
create function private.bootstrap_first_admin(p_email text, p_display_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
begin
  if exists (select 1 from public.profiles where role = 'admin') then
    raise exception 'Un administrateur existe déjà. Utilisez l''application pour créer les comptes suivants.';
  end if;

  select id into v_user_id from auth.users where lower(email) = lower(btrim(p_email));
  if v_user_id is null then
    raise exception 'Aucun utilisateur d''authentification avec cette adresse. Créez-le d''abord dans Authentication > Users.';
  end if;

  insert into public.profiles (id, role, display_name)
  values (v_user_id, 'admin', btrim(p_display_name));

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, details)
  values (null, 'staff.bootstrap_admin', 'profile', v_user_id, '{}'::jsonb);

  return v_user_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- Privilèges d'exécution
-- -----------------------------------------------------------------------------
revoke all on all functions in schema public from public, anon, authenticated;
revoke all on all functions in schema private from public, anon, authenticated;

grant select on
  public.athlete_overview,
  public.subscription_overview,
  public.visit_log,
  public.payment_log,
  public.audit_log_view
to authenticated;

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
  public.admin_log_export(text, jsonb)
to authenticated;
