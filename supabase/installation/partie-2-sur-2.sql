-- =============================================================================
-- Stade du 26 Mars — installation de la base : PARTIE 2 SUR 2
--
-- Supabase → SQL Editor → New query → coller tout ce fichier → Run.
-- Exécuter les parties DANS L'ORDRE (1, puis 2…), une seule fois, sur un projet vide.
-- Fichier généré par « npm run sql:bundle ». Ne pas modifier à la main.
-- =============================================================================

-- >>>>> 20261024000800_audit_target.sql
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

-- >>>>> 20261024000900_offline_mode.sql
-- =============================================================================
-- Mode hors ligne du poste de contrôle
--
-- 1. En ligne, le téléphone de l'agent télécharge un « instantané » compact des
--    abonnements utiles au contrôle (matricules HACHÉS avec un sel aléatoire,
--    dates de validité, état), valable quelques heures.
-- 2. Sans réseau, la vérification se fait sur le téléphone ; les entrées et
--    sorties sont mises en file d'attente avec l'heure de l'appareil et un
--    identifiant unique.
-- 3. Au retour du réseau, la file est envoyée : le serveur RE-VALIDE chaque
--    opération. Celles qui ne respectent pas les règles ne sont pas appliquées
--    silencieusement : elles sont conservées « à vérifier » pour l'administrateur.
-- =============================================================================

alter table public.app_settings
  add column offline_snapshot_hours integer not null default 24,
  add constraint app_settings_offline_hours_range check (offline_snapshot_hours between 1 and 72);

alter table public.visits
  add column entry_offline boolean not null default false,
  add column exit_offline boolean not null default false;

create table public.offline_operations (
  -- Identifiant généré par le téléphone : garantit qu'une opération renvoyée
  -- plusieurs fois n'est appliquée qu'une seule fois.
  id            uuid primary key,
  agent_id      uuid not null references public.profiles (id),
  kind          text not null,
  athlete_id    uuid references public.athletes (id),
  occurred_at   timestamptz not null,
  received_at   timestamptz not null default now(),
  result        text not null,
  reason_code   text,
  visit_id      uuid references public.visits (id),
  reviewed_at   timestamptz,
  reviewed_by   uuid references public.profiles (id),
  review_note   text,
  constraint offline_operations_kind check (kind in ('entry', 'exit')),
  constraint offline_operations_result check (result in ('applied', 'conflict', 'rejected')),
  constraint offline_operations_review_note check (review_note is null or char_length(review_note) <= 300)
);

create index offline_operations_pending_idx on public.offline_operations (received_at desc)
  where result <> 'applied' and reviewed_at is null;
create index offline_operations_agent_idx on public.offline_operations (agent_id, received_at desc);

alter table public.offline_operations enable row level security;
create policy offline_operations_select on public.offline_operations
  for select to authenticated using ((select public.is_admin()));
revoke all on public.offline_operations from anon, authenticated;
grant select on public.offline_operations to authenticated;

create trigger offline_operations_no_delete before delete on public.offline_operations
  for each row execute function private.forbid_mutation();

-- -----------------------------------------------------------------------------
-- Hachage partagé avec le téléphone : SHA-256(sel || matricule), hexadécimal.
-- -----------------------------------------------------------------------------
create function private.offline_hash(p_salt text, p_matricule text)
returns text
language sql
immutable
set search_path = ''
as $$
  select encode(extensions.digest(p_salt || p_matricule, 'sha256'), 'hex');
$$;

-- -----------------------------------------------------------------------------
-- Instantané pour le contrôle hors ligne
-- -----------------------------------------------------------------------------
create function public.control_offline_snapshot()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := private.assert_staff();
  v_today date := public.app_today();
  v_hours integer := coalesce((select s.offline_snapshot_hours from public.app_settings s where s.id), 24);
  v_horizon date := v_today + (v_hours / 24) + 1;
  v_salt text := encode(extensions.gen_random_bytes(16), 'hex');
  v_subs jsonb;
  v_inside jsonb;
begin
  perform private.enforce_rate_limit('offline_snapshot', 20);

  -- Abonnements valides pendant la durée de l'instantané, à venir, ou expirés depuis moins de 60 jours.
  select coalesce(jsonb_agg(jsonb_build_object(
           'h', private.offline_hash(v_salt, a.matricule),
           's', s.starts_on,
           'e', s.ends_on,
           'st', s.state,
           'p', pl.name
         )), '[]'::jsonb)
  into v_subs
  from public.subscriptions s
  join public.athletes a on a.id = s.athlete_id
  left join public.subscription_plans pl on pl.id = s.plan_id
  where s.state <> 'cancelled'
    -- Expirés récents inclus : l'agent peut indiquer « abonnement expiré » plutôt que « inconnu ».
    and s.ends_on >= v_today - 60
    and s.starts_on <= v_horizon;

  select coalesce(jsonb_agg(jsonb_build_object('h', private.offline_hash(v_salt, a.matricule), 'at', v.entered_at)), '[]'::jsonb)
  into v_inside
  from public.visits v
  join public.athletes a on a.id = v.athlete_id
  where v.status = 'open';

  return jsonb_build_object(
    'version', 1,
    'agent_id', v_actor,
    'generated_at', now(),
    'valid_until', now() + make_interval(hours => v_hours),
    'today', v_today,
    'timezone', private.app_timezone(),
    'salt', v_salt,
    'subscriptions', v_subs,
    'inside', v_inside
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- Synchronisation des opérations enregistrées hors ligne
-- -----------------------------------------------------------------------------
create function public.control_sync_offline(p_ops jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := private.assert_staff();
  v_tz text := private.app_timezone();
  v_op jsonb;
  v_id uuid;
  v_kind text;
  v_matricule text;
  v_at timestamptz;
  v_athlete uuid;
  v_sub uuid;
  v_visit uuid;
  v_existing public.offline_operations;
  v_result text;
  v_reason text;
  v_results jsonb := '[]'::jsonb;
  v_applied integer := 0;
  v_conflicts integer := 0;
begin
  perform private.enforce_rate_limit('offline_sync', 30);

  if p_ops is null or jsonb_typeof(p_ops) <> 'array' or jsonb_array_length(p_ops) > 500 then
    raise exception 'ERR_INVALID_INPUT' using errcode = 'P0001';
  end if;

  -- Traitement dans l'ordre chronologique des opérations.
  for v_op in
    select value from jsonb_array_elements(p_ops) order by (value ->> 'occurred_at')
  loop
    v_result := null;
    v_reason := null;
    v_athlete := null;
    v_visit := null;

    begin
      v_id := (v_op ->> 'id')::uuid;
      v_kind := v_op ->> 'kind';
      v_matricule := public.normalize_matricule(v_op ->> 'matricule');
      v_at := (v_op ->> 'occurred_at')::timestamptz;
    exception when others then
      v_results := v_results || jsonb_build_object('id', v_op ->> 'id', 'result', 'rejected', 'reason', 'INVALID');
      continue;
    end;

    -- Idempotence : une opération déjà reçue renvoie son résultat initial.
    select * into v_existing from public.offline_operations where id = v_id;
    if found then
      if v_existing.agent_id <> v_actor then
        v_results := v_results || jsonb_build_object('id', v_id, 'result', 'rejected', 'reason', 'FORBIDDEN');
      else
        v_results := v_results || jsonb_build_object('id', v_id, 'result', v_existing.result, 'reason', v_existing.reason_code);
      end if;
      continue;
    end if;

    if v_kind is null or v_kind not in ('entry', 'exit') or v_at is null or not public.is_valid_matricule(v_matricule) then
      v_results := v_results || jsonb_build_object('id', v_id, 'result', 'rejected', 'reason', 'INVALID');
      continue;
    elsif v_at > now() + interval '5 minutes' then
      v_result := 'rejected'; v_reason := 'FUTURE_TIME';
    elsif v_at < now() - interval '72 hours' then
      v_result := 'rejected'; v_reason := 'TOO_OLD';
    else
      select id into v_athlete from public.athletes where matricule = v_matricule for update;
      if v_athlete is null then
        v_result := 'conflict'; v_reason := 'ATHLETE_NOT_FOUND';
      elsif v_kind = 'entry' then
        -- Validité recalculée par le serveur à la date locale de l'entrée.
        select s.id into v_sub
        from public.subscriptions s
        where s.athlete_id = v_athlete
          and public.subscription_validity(s.state, s.starts_on, s.ends_on, (v_at at time zone v_tz)::date) = 'active'
        limit 1;

        if exists (
          select 1 from public.visits v
          where v.athlete_id = v_athlete
            and v.status <> 'cancelled'
            and v.entered_at <= v_at
            and (v.exited_at is null or v.exited_at > v_at)
        ) then
          v_result := 'conflict'; v_reason := 'ALREADY_INSIDE';
        elsif v_sub is null then
          v_result := 'conflict'; v_reason := 'SUBSCRIPTION_INVALID';
        else
          begin
            insert into public.visits (athlete_id, subscription_id, entered_at, entry_agent_id, entry_offline)
            values (v_athlete, v_sub, v_at, v_actor, true)
            returning id into v_visit;
            v_result := 'applied';
          exception when unique_violation then
            v_result := 'conflict'; v_reason := 'ALREADY_INSIDE';
          end;
        end if;
      else
        update public.visits
        set exited_at = v_at, status = 'closed', exit_agent_id = v_actor, exit_offline = true
        where athlete_id = v_athlete and status = 'open' and entered_at <= v_at
        returning id into v_visit;
        if v_visit is null then
          v_result := 'conflict'; v_reason := 'NO_OPEN_VISIT';
        else
          v_result := 'applied';
        end if;
      end if;
    end if;

    insert into public.offline_operations (id, agent_id, kind, athlete_id, occurred_at, result, reason_code, visit_id)
    values (v_id, v_actor, v_kind, v_athlete, v_at, v_result, v_reason, v_visit);

    if v_result = 'applied' then v_applied := v_applied + 1; else v_conflicts := v_conflicts + 1; end if;
    v_results := v_results || jsonb_build_object('id', v_id, 'result', v_result, 'reason', v_reason);
  end loop;

  if v_applied + v_conflicts > 0 then
    perform private.audit('offline.synced', 'profile', v_actor,
      jsonb_build_object('applied', v_applied, 'to_review', v_conflicts));
  end if;

  return v_results;
end;
$$;

-- -----------------------------------------------------------------------------
-- Revue administrative des opérations hors ligne non appliquées
-- -----------------------------------------------------------------------------
create view public.offline_operation_log
with (security_invoker = true)
as
select
  o.id,
  o.kind,
  o.occurred_at,
  o.received_at,
  o.result,
  o.reason_code,
  o.athlete_id,
  a.matricule,
  o.agent_id,
  ag.display_name as agent_name,
  o.visit_id,
  o.reviewed_at,
  rv.display_name as reviewed_by_name,
  o.review_note
from public.offline_operations o
left join public.athletes a on a.id = o.athlete_id
left join public.profiles ag on ag.id = o.agent_id
left join public.profiles rv on rv.id = o.reviewed_by;

grant select on public.offline_operation_log to authenticated;

create function public.admin_review_offline_operation(p_id uuid, p_note text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := private.assert_admin();
  v_note text := private.require_reason(p_note);
begin
  update public.offline_operations
  set reviewed_at = now(), reviewed_by = v_actor, review_note = v_note
  where id = p_id and result <> 'applied' and reviewed_at is null;
  if not found then
    raise exception 'ERR_INVALID_STATE_TRANSITION' using errcode = 'P0001';
  end if;
  perform private.audit('offline.reviewed', 'offline_operation', p_id, jsonb_build_object('note', v_note));
end;
$$;

-- Paramètres : ajout de la durée de validité de l'instantané hors ligne.
drop function public.admin_update_settings(text, text, integer, integer, text);

create function public.admin_update_settings(
  p_stadium_name text,
  p_timezone text,
  p_expiring_soon_days integer,
  p_long_visit_hours integer,
  p_default_currency text,
  p_offline_snapshot_hours integer
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
        offline_snapshot_hours = p_offline_snapshot_hours,
        updated_by = v_actor
    where id;
  exception when check_violation or not_null_violation then
    raise exception 'ERR_INVALID_INPUT' using errcode = 'P0001';
  end;

  perform private.audit('settings.updated', 'settings', null, jsonb_build_object(
    'before', jsonb_build_object('stadium_name', v_before.stadium_name, 'timezone', v_before.timezone,
      'expiring_soon_days', v_before.expiring_soon_days, 'long_visit_hours', v_before.long_visit_hours,
      'default_currency', v_before.default_currency, 'offline_snapshot_hours', v_before.offline_snapshot_hours),
    'after', jsonb_build_object('stadium_name', btrim(p_stadium_name), 'timezone', p_timezone,
      'expiring_soon_days', p_expiring_soon_days, 'long_visit_hours', p_long_visit_hours,
      'default_currency', upper(btrim(p_default_currency)), 'offline_snapshot_hours', p_offline_snapshot_hours)
  ));
end;
$$;

-- Le journal d'audit accepte la nouvelle catégorie.
-- (aucune contrainte sur entity_type ; les actions suivent le format « x.y »)

revoke all on function public.control_offline_snapshot() from public, anon;
revoke all on function public.control_sync_offline(jsonb) from public, anon;
revoke all on function public.admin_review_offline_operation(uuid, text) from public, anon;
revoke all on function public.admin_update_settings(text, text, integer, integer, text, integer) from public, anon;
revoke all on function private.offline_hash(text, text) from public, anon, authenticated;

grant execute on function public.control_offline_snapshot() to authenticated;
grant execute on function public.control_sync_offline(jsonb) to authenticated;
grant execute on function public.admin_review_offline_operation(uuid, text) to authenticated;
grant execute on function public.admin_update_settings(text, text, integer, integer, text, integer) to authenticated;

-- >>>>> 20261024001000_visit_log_offline.sql
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

-- >>>>> 20261024001100_deletions.sql
-- =============================================================================
-- Suppressions administratives (décision du 24/10/2026)
--
-- * Sportif : suppression DÉFINITIVE du matricule et de toutes ses données
--   (abonnements, paiements, passages, opérations hors ligne). Sert aussi aux
--   demandes d'effacement. Motif obligatoire et matricule à ressaisir.
-- * Agent : suppression DÉFINITIVE du compte de connexion ; le numéro est
--   libéré. Son historique (entrées / sorties enregistrées) est conservé sous
--   son nom pour ne pas fausser les statistiques.
--
-- L'historique reste protégé contre toute autre suppression : seules les deux
-- fonctions ci-dessous peuvent lever la protection, le temps de leur transaction.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Protection de l'historique avec dérogation contrôlée
-- ---------------------------------------------------------------------------
create function private.forbid_history_delete()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- Dérogation positionnée uniquement par public.admin_delete_athlete (portée : transaction).
  if current_setting('stade26.effacement_autorise', true) = 'on' then
    return old;
  end if;
  raise exception 'ERR_IMMUTABLE' using errcode = 'P0001';
end;
$$;

drop trigger athletes_no_delete on public.athletes;
drop trigger subscriptions_no_delete on public.subscriptions;
drop trigger visits_no_delete on public.visits;
drop trigger payments_no_delete on public.payments;
drop trigger offline_operations_no_delete on public.offline_operations;

create trigger athletes_no_delete before delete on public.athletes
  for each row execute function private.forbid_history_delete();
create trigger subscriptions_no_delete before delete on public.subscriptions
  for each row execute function private.forbid_history_delete();
create trigger visits_no_delete before delete on public.visits
  for each row execute function private.forbid_history_delete();
create trigger payments_no_delete before delete on public.payments
  for each row execute function private.forbid_history_delete();
create trigger offline_operations_no_delete before delete on public.offline_operations
  for each row execute function private.forbid_history_delete();

-- Le journal d'audit, lui, reste strictement immuable (private.forbid_mutation).

-- ---------------------------------------------------------------------------
-- Profils d'agents supprimés : le profil devient une archive
-- ---------------------------------------------------------------------------
-- Le compte d'authentification peut être supprimé : le profil n'y est plus lié
-- par clé étrangère et conserve le nom pour l'historique.
alter table public.profiles drop constraint profiles_id_fkey;

alter table public.profiles
  add column deleted_at timestamptz,
  drop constraint profiles_agent_has_phone,
  add constraint profiles_agent_has_phone check (role <> 'agent' or login_phone is not null or deleted_at is not null),
  add constraint profiles_deleted_inactive check (deleted_at is null or not is_active);

-- Un profil supprimé ne peut pas être réactivé.
create or replace function public.admin_set_staff_active(p_user_id uuid, p_active boolean)
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

  if p_user_id = v_actor then
    raise exception 'ERR_SELF_ACTION' using errcode = 'P0001';
  end if;

  select * into v_profile from public.profiles where id = p_user_id for update;
  if not found or v_profile.deleted_at is not null then
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

-- ---------------------------------------------------------------------------
-- Suppression d'un sportif
-- ---------------------------------------------------------------------------
create function public.admin_delete_athlete(
  p_athlete_id uuid,
  p_matricule_confirmation text,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := private.assert_admin();
  v_reason text := private.require_reason(p_reason);
  v_matricule text;
  v_counts jsonb;
begin
  perform private.enforce_rate_limit('admin_write', 120);

  select matricule into v_matricule from public.athletes where id = p_athlete_id for update;
  if v_matricule is null then
    raise exception 'ERR_ATHLETE_NOT_FOUND' using errcode = 'P0001';
  end if;
  -- Confirmation explicite : le matricule doit être ressaisi.
  if public.normalize_matricule(p_matricule_confirmation) <> v_matricule then
    raise exception 'ERR_CONFIRMATION_MISMATCH' using errcode = 'P0001';
  end if;

  v_counts := jsonb_build_object(
    'subscriptions', (select count(*) from public.subscriptions where athlete_id = p_athlete_id),
    'payments', (select count(*) from public.payments where athlete_id = p_athlete_id),
    'visits', (select count(*) from public.visits where athlete_id = p_athlete_id)
  );

  perform set_config('stade26.effacement_autorise', 'on', true);

  delete from public.offline_operations where athlete_id = p_athlete_id;
  delete from public.visits where athlete_id = p_athlete_id;
  delete from public.payments where athlete_id = p_athlete_id;
  delete from public.subscriptions where athlete_id = p_athlete_id and renewed_from_id is not null;
  delete from public.subscriptions where athlete_id = p_athlete_id;
  delete from public.athletes where id = p_athlete_id;

  perform set_config('stade26.effacement_autorise', 'off', true);

  -- Trace sans le matricule (donnée effacée).
  perform private.audit('athlete.deleted', 'athlete', p_athlete_id,
    jsonb_build_object('reason', v_reason) || v_counts);
  return v_counts;
end;
$$;

-- ---------------------------------------------------------------------------
-- Suppression d'un agent (partie base de données ; le compte d'authentification
-- est supprimé ensuite par le serveur avec la clé service_role)
-- ---------------------------------------------------------------------------
create function public.admin_delete_agent(p_user_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := private.assert_admin();
  v_reason text := private.require_reason(p_reason);
  v_profile public.profiles;
begin
  perform private.enforce_rate_limit('admin_write', 120);

  if p_user_id = v_actor then
    raise exception 'ERR_SELF_ACTION' using errcode = 'P0001';
  end if;

  select * into v_profile from public.profiles where id = p_user_id for update;
  if not found or v_profile.role <> 'agent' or v_profile.deleted_at is not null then
    raise exception 'ERR_USER_NOT_FOUND' using errcode = 'P0001';
  end if;

  update public.profiles
  set is_active = false,
      deactivated_at = coalesce(deactivated_at, now()),
      deleted_at = now(),
      login_phone = null   -- numéro libéré, réutilisable pour un nouveau compte
  where id = p_user_id;

  perform private.audit('staff.deleted', 'profile', p_user_id, jsonb_build_object('reason', v_reason));
end;
$$;

revoke all on function public.admin_delete_athlete(uuid, text, text) from public, anon;
revoke all on function public.admin_delete_agent(uuid, text) from public, anon;
revoke all on function public.admin_set_staff_active(uuid, boolean) from public, anon;
revoke all on function private.forbid_history_delete() from public, anon, authenticated;
grant execute on function public.admin_delete_athlete(uuid, text, text) to authenticated;
grant execute on function public.admin_delete_agent(uuid, text) to authenticated;
grant execute on function public.admin_set_staff_active(uuid, boolean) to authenticated;

-- >>>>> Enregistrement des migrations appliquées (compatibilité « supabase db push »)
create schema if not exists supabase_migrations;
create table if not exists supabase_migrations.schema_migrations (version text primary key, statements text[], name text);
insert into supabase_migrations.schema_migrations (version, name) values
  ('20261024000800', 'audit_target'),
  ('20261024000900', 'offline_mode'),
  ('20261024001000', 'visit_log_offline'),
  ('20261024001100', 'deletions')
on conflict (version) do nothing;
