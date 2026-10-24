-- =============================================================================
-- Stade du 26 Mars — installation de la base : PARTIE 1 SUR 2
--
-- Supabase → SQL Editor → New query → coller tout ce fichier → Run.
-- Exécuter les parties DANS L'ORDRE (1, puis 2…), une seule fois, sur un projet vide.
-- Fichier généré par « npm run sql:bundle ». Ne pas modifier à la main.
-- =============================================================================

-- >>>>> 20261024000100_schema.sql
-- =============================================================================
-- Stade du 26 Mars — Schéma relationnel
--
-- Principes :
--   * Un sportif n'est identifié QUE par son matricule (2 lettres + 5 chiffres).
--     Aucune colonne nom / prénom / téléphone / photo / adresse n'existe.
--   * Aucune suppression physique des données historiques : les abonnements,
--     passages et paiements sont annulés de manière traçable.
--   * Les écritures passent exclusivement par des fonctions SQL contrôlées
--     (voir 20261024000300_functions.sql) ; les tables n'ont aucune politique
--     d'écriture pour les rôles clients.
-- =============================================================================

create extension if not exists btree_gist with schema extensions;

-- Schéma interne : non exposé par l'API REST de Supabase.
create schema if not exists private;
revoke all on schema private from public;

-- -----------------------------------------------------------------------------
-- Types énumérés
-- -----------------------------------------------------------------------------
create type public.app_role as enum ('admin', 'agent');

-- État administratif d'un abonnement. La validité (actif / expiré / à venir)
-- est calculée à partir des dates, jamais stockée.
create type public.subscription_state as enum ('active', 'suspended', 'cancelled');

create type public.visit_status as enum ('open', 'closed', 'cancelled');

create type public.payment_method as enum ('cash', 'mobile_money', 'bank_transfer', 'card', 'other');

create type public.payment_status as enum ('recorded', 'cancelled');

-- -----------------------------------------------------------------------------
-- Profils du personnel (administrateurs et agents)
-- -----------------------------------------------------------------------------
create table public.profiles (
  id             uuid primary key references auth.users (id) on delete restrict,
  role           public.app_role not null default 'agent',
  display_name   text not null,
  is_active      boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  deactivated_at timestamptz,
  constraint profiles_display_name_length check (char_length(btrim(display_name)) between 2 and 80),
  constraint profiles_deactivation_consistency check (is_active or deactivated_at is not null)
);

comment on table public.profiles is
  'Comptes du personnel. Le rôle ne peut être modifié que par une fonction administrative ou par la clé service_role.';

-- -----------------------------------------------------------------------------
-- Paramètres de l'application (ligne unique)
-- -----------------------------------------------------------------------------
create table public.app_settings (
  id                 boolean primary key default true,
  stadium_name       text not null default 'Stade du 26 Mars',
  timezone           text not null default 'Africa/Bamako',
  expiring_soon_days integer not null default 7,
  long_visit_hours   integer not null default 6,
  default_currency   text not null default 'XOF',
  updated_at         timestamptz not null default now(),
  updated_by         uuid references public.profiles (id),
  constraint app_settings_singleton check (id),
  constraint app_settings_stadium_name_length check (char_length(btrim(stadium_name)) between 2 and 80),
  constraint app_settings_expiring_soon_range check (expiring_soon_days between 1 and 60),
  constraint app_settings_long_visit_range check (long_visit_hours between 1 and 24),
  constraint app_settings_currency_format check (default_currency ~ '^[A-Z]{3}$')
);

insert into public.app_settings (id) values (true);

-- -----------------------------------------------------------------------------
-- Formules d'abonnement (configurables par l'administrateur)
-- -----------------------------------------------------------------------------
create table public.subscription_plans (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  duration_days integer not null,
  price         numeric(12, 2),
  currency      text not null default 'XOF',
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  created_by    uuid references public.profiles (id),
  updated_at    timestamptz not null default now(),
  constraint subscription_plans_name_length check (char_length(btrim(name)) between 2 and 60),
  constraint subscription_plans_duration_range check (duration_days between 1 and 3660),
  constraint subscription_plans_price_positive check (price is null or price >= 0),
  constraint subscription_plans_currency_format check (currency ~ '^[A-Z]{3}$')
);

create unique index subscription_plans_name_unique on public.subscription_plans (lower(btrim(name)));

-- -----------------------------------------------------------------------------
-- Sportifs : uniquement le matricule
-- -----------------------------------------------------------------------------
create table public.athletes (
  id             uuid primary key default gen_random_uuid(),
  matricule      text not null,
  registered_on  date not null,
  created_at     timestamptz not null default now(),
  created_by     uuid references public.profiles (id),
  constraint athletes_matricule_unique unique (matricule),
  -- 2 lettres majuscules (initiales) + 5 chiffres (début du numéro de téléphone).
  constraint athletes_matricule_format check (matricule ~ '^[A-Z]{2}[0-9]{5}$')
);

comment on column public.athletes.matricule is
  'Matricule normalisé (ex. AD76214). Donnée pseudonyme mais potentiellement identifiante : à protéger.';

-- Recherche par préfixe (« AD7… »).
create index athletes_matricule_prefix_idx on public.athletes (matricule text_pattern_ops);
create index athletes_registered_on_idx on public.athletes (registered_on);

-- -----------------------------------------------------------------------------
-- Abonnements : historique complet, jamais écrasé
-- -----------------------------------------------------------------------------
create table public.subscriptions (
  id               uuid primary key default gen_random_uuid(),
  athlete_id       uuid not null references public.athletes (id) on delete restrict,
  plan_id          uuid references public.subscription_plans (id) on delete restrict,
  starts_on        date not null,
  -- Règle métier : l'abonnement est valide jusqu'à 23:59:59 (fuseau du stade)
  -- de la date de fin, incluse.
  ends_on          date not null,
  state            public.subscription_state not null default 'active',
  renewed_from_id  uuid references public.subscriptions (id) on delete restrict,
  state_reason     text,
  state_changed_at timestamptz,
  state_changed_by uuid references public.profiles (id),
  created_at       timestamptz not null default now(),
  created_by       uuid references public.profiles (id),
  constraint subscriptions_dates_order check (ends_on >= starts_on),
  constraint subscriptions_max_length check (ends_on - starts_on <= 3660),
  constraint subscriptions_reason_length check (state_reason is null or char_length(state_reason) <= 300),
  constraint subscriptions_not_self_renewal check (renewed_from_id is null or renewed_from_id <> id),
  -- Deux abonnements non annulés d'un même sportif ne peuvent pas se chevaucher :
  -- l'abonnement « en cours » est donc toujours unique.
  constraint subscriptions_no_overlap exclude using gist (
    athlete_id with =,
    daterange(starts_on, ends_on, '[]') with &&
  ) where (state <> 'cancelled')
);

create index subscriptions_athlete_idx on public.subscriptions (athlete_id, ends_on desc);
create index subscriptions_ends_on_idx on public.subscriptions (ends_on) where state <> 'cancelled';
create index subscriptions_created_at_idx on public.subscriptions (created_at);
create index subscriptions_renewed_from_idx on public.subscriptions (renewed_from_id);
create index subscriptions_plan_idx on public.subscriptions (plan_id);

-- -----------------------------------------------------------------------------
-- Passages (entrées / sorties)
-- -----------------------------------------------------------------------------
create table public.visits (
  id                uuid primary key default gen_random_uuid(),
  athlete_id        uuid not null references public.athletes (id) on delete restrict,
  subscription_id   uuid not null references public.subscriptions (id) on delete restrict,
  -- Horodatages générés par le serveur de base de données.
  entered_at        timestamptz not null default now(),
  exited_at         timestamptz,
  status            public.visit_status not null default 'open',
  entry_agent_id    uuid not null references public.profiles (id),
  exit_agent_id     uuid references public.profiles (id),
  corrected_at      timestamptz,
  corrected_by      uuid references public.profiles (id),
  correction_reason text,
  duration_seconds  integer generated always as (
    case when exited_at is null then null
         else floor(extract(epoch from (exited_at - entered_at)))::integer end
  ) stored,
  constraint visits_status_consistency check (
       (status = 'open' and exited_at is null)
    or (status = 'closed' and exited_at is not null)
    or (status = 'cancelled')
  ),
  constraint visits_exit_after_entry check (exited_at is null or exited_at >= entered_at),
  constraint visits_correction_reason check (
    (corrected_at is null and correction_reason is null)
    or (corrected_at is not null and char_length(btrim(correction_reason)) between 5 and 300)
  )
);

-- Une seule visite ouverte par sportif : empêche les doubles entrées, y compris
-- en cas de requêtes simultanées.
create unique index visits_one_open_per_athlete on public.visits (athlete_id) where status = 'open';
create index visits_entered_at_idx on public.visits (entered_at);
create index visits_athlete_entered_idx on public.visits (athlete_id, entered_at desc);
create index visits_entry_agent_idx on public.visits (entry_agent_id, entered_at);
create index visits_exit_agent_idx on public.visits (exit_agent_id, exited_at);
create index visits_subscription_idx on public.visits (subscription_id);

-- -----------------------------------------------------------------------------
-- Paiements (enregistrement de paiements réalisés hors application)
-- -----------------------------------------------------------------------------
create table public.payments (
  id              uuid primary key default gen_random_uuid(),
  athlete_id      uuid not null references public.athletes (id) on delete restrict,
  subscription_id uuid references public.subscriptions (id) on delete restrict,
  amount          numeric(12, 2) not null,
  currency        text not null,
  paid_on         date not null,
  method          public.payment_method not null,
  reference       text,
  status          public.payment_status not null default 'recorded',
  recorded_by     uuid not null references public.profiles (id),
  created_at      timestamptz not null default now(),
  cancelled_at    timestamptz,
  cancelled_by    uuid references public.profiles (id),
  cancel_reason   text,
  constraint payments_amount_positive check (amount > 0),
  constraint payments_currency_format check (currency ~ '^[A-Z]{3}$'),
  constraint payments_reference_length check (reference is null or char_length(reference) <= 80),
  constraint payments_cancel_consistency check (
    (status = 'recorded' and cancelled_at is null)
    or (status = 'cancelled' and cancelled_at is not null and char_length(btrim(cancel_reason)) between 5 and 300)
  )
);

create index payments_paid_on_idx on public.payments (paid_on);
create index payments_athlete_idx on public.payments (athlete_id, paid_on desc);
create index payments_subscription_idx on public.payments (subscription_id);

-- -----------------------------------------------------------------------------
-- Journal d'audit (append-only)
-- -----------------------------------------------------------------------------
create table public.audit_logs (
  id          bigint generated always as identity primary key,
  occurred_at timestamptz not null default now(),
  actor_id    uuid references public.profiles (id),
  action      text not null,
  entity_type text not null,
  entity_id   uuid,
  -- Pas de matricule ici : les entités sont référencées par identifiant interne.
  details     jsonb not null default '{}'::jsonb,
  constraint audit_logs_action_format check (action ~ '^[a-z_]+\.[a-z_]+$')
);

create index audit_logs_occurred_at_idx on public.audit_logs (occurred_at desc);
create index audit_logs_entity_idx on public.audit_logs (entity_type, entity_id);
create index audit_logs_actor_idx on public.audit_logs (actor_id, occurred_at desc);

-- -----------------------------------------------------------------------------
-- Limitation de débit (interne)
-- -----------------------------------------------------------------------------
create table private.rate_limits (
  bucket       text not null,
  actor_id     uuid not null,
  window_start timestamptz not null,
  hits         integer not null default 0,
  primary key (bucket, actor_id, window_start)
);

-- -----------------------------------------------------------------------------
-- Horodatage automatique des mises à jour
-- -----------------------------------------------------------------------------
create function private.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_touch before update on public.profiles
  for each row execute function private.touch_updated_at();
create trigger subscription_plans_touch before update on public.subscription_plans
  for each row execute function private.touch_updated_at();
create trigger app_settings_touch before update on public.app_settings
  for each row execute function private.touch_updated_at();

-- Le journal d'audit est immuable, même pour les fonctions internes.
create function private.forbid_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'ERR_IMMUTABLE' using errcode = 'P0001';
end;
$$;

create trigger audit_logs_immutable before update or delete on public.audit_logs
  for each row execute function private.forbid_mutation();

-- Aucune suppression physique de l'historique métier.
create trigger athletes_no_delete before delete on public.athletes
  for each row execute function private.forbid_mutation();
create trigger subscriptions_no_delete before delete on public.subscriptions
  for each row execute function private.forbid_mutation();
create trigger visits_no_delete before delete on public.visits
  for each row execute function private.forbid_mutation();
create trigger payments_no_delete before delete on public.payments
  for each row execute function private.forbid_mutation();

-- Le matricule et les horodatages d'entrée sont immuables.
create function private.guard_athlete_immutable()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.matricule is distinct from old.matricule
     or new.registered_on is distinct from old.registered_on then
    raise exception 'ERR_IMMUTABLE' using errcode = 'P0001', detail = 'athlete';
  end if;
  return new;
end;
$$;

create function private.guard_visit_immutable()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.entered_at is distinct from old.entered_at
     or new.athlete_id is distinct from old.athlete_id
     or new.subscription_id is distinct from old.subscription_id
     or new.entry_agent_id is distinct from old.entry_agent_id then
    raise exception 'ERR_IMMUTABLE' using errcode = 'P0001', detail = 'visit';
  end if;
  return new;
end;
$$;

create trigger athletes_guard before update on public.athletes
  for each row execute function private.guard_athlete_immutable();
create trigger visits_guard before update on public.visits
  for each row execute function private.guard_visit_immutable();

-- >>>>> 20261024000200_security.sql
-- =============================================================================
-- Sécurité : fonctions d'autorisation, Row Level Security et privilèges
--
-- Modèle :
--   * anon          : aucun accès aux données.
--   * authenticated : lecture filtrée par RLS (administrateurs uniquement pour
--                     les données métier), AUCUNE écriture directe.
--   * Les écritures passent par des fonctions SECURITY DEFINER qui vérifient
--     le rôle, valident les données et journalisent l'opération.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Fonctions d'autorisation
-- -----------------------------------------------------------------------------

-- Rôle de l'utilisateur connecté, ou NULL si le compte n'a pas de profil ou est
-- désactivé.
create function public.current_app_role()
returns public.app_role
language sql
stable
security definer
set search_path = ''
as $$
  select p.role
  from public.profiles p
  where p.id = (select auth.uid())
    and p.is_active;
$$;

create function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(public.current_app_role() = 'admin', false);
$$;

create function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.current_app_role() is not null;
$$;

create function private.assert_admin()
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'ERR_FORBIDDEN' using errcode = 'P0001';
  end if;
  return auth.uid();
end;
$$;

create function private.assert_staff()
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_staff() then
    raise exception 'ERR_FORBIDDEN' using errcode = 'P0001';
  end if;
  return auth.uid();
end;
$$;

-- -----------------------------------------------------------------------------
-- Fuseau horaire et date du jour (du point de vue du stade)
-- -----------------------------------------------------------------------------
create function private.app_timezone()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select s.timezone from public.app_settings s where s.id), 'Africa/Bamako');
$$;

create function public.app_today()
returns date
language sql
stable
security definer
set search_path = ''
as $$
  select (now() at time zone private.app_timezone())::date;
$$;

-- -----------------------------------------------------------------------------
-- Journal d'audit et limitation de débit
-- -----------------------------------------------------------------------------
create function private.audit(
  p_action text,
  p_entity_type text,
  p_entity_id uuid,
  p_details jsonb default '{}'::jsonb
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, details)
  values (auth.uid(), p_action, p_entity_type, p_entity_id, coalesce(p_details, '{}'::jsonb));
$$;

-- Fenêtre fixe d'une minute par utilisateur et par catégorie d'opération.
create function private.enforce_rate_limit(p_bucket text, p_max_per_minute integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_window timestamptz := date_trunc('minute', now());
  v_hits integer;
begin
  if auth.uid() is null then
    raise exception 'ERR_FORBIDDEN' using errcode = 'P0001';
  end if;

  insert into private.rate_limits as r (bucket, actor_id, window_start, hits)
  values (p_bucket, auth.uid(), v_window, 1)
  on conflict (bucket, actor_id, window_start)
  do update set hits = r.hits + 1
  returning hits into v_hits;

  if v_hits > p_max_per_minute then
    raise exception 'ERR_RATE_LIMITED' using errcode = 'P0001';
  end if;

  -- Nettoyage opportuniste des fenêtres expirées.
  if random() < 0.02 then
    delete from private.rate_limits where window_start < now() - interval '1 hour';
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- Row Level Security
-- -----------------------------------------------------------------------------
alter table public.profiles           enable row level security;
alter table public.app_settings       enable row level security;
alter table public.subscription_plans enable row level security;
alter table public.athletes           enable row level security;
alter table public.subscriptions      enable row level security;
alter table public.visits             enable row level security;
alter table public.payments           enable row level security;
alter table public.audit_logs         enable row level security;
alter table private.rate_limits       enable row level security;

-- Profils : chacun voit le sien, l'administrateur voit tout le personnel.
create policy profiles_select on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or (select public.is_admin()));

-- Paramètres : lisibles par tout le personnel actif (nom du stade, fuseau).
create policy app_settings_select on public.app_settings
  for select to authenticated
  using ((select public.is_staff()));

-- Données métier : lecture réservée aux administrateurs. Les agents passent
-- par les fonctions de contrôle, qui ne renvoient que le strict nécessaire.
create policy subscription_plans_select on public.subscription_plans
  for select to authenticated using ((select public.is_admin()));
create policy athletes_select on public.athletes
  for select to authenticated using ((select public.is_admin()));
create policy subscriptions_select on public.subscriptions
  for select to authenticated using ((select public.is_admin()));
create policy visits_select on public.visits
  for select to authenticated using ((select public.is_admin()));
create policy payments_select on public.payments
  for select to authenticated using ((select public.is_admin()));
create policy audit_logs_select on public.audit_logs
  for select to authenticated using ((select public.is_admin()));

-- Aucune politique INSERT / UPDATE / DELETE : toute écriture directe est refusée.

-- -----------------------------------------------------------------------------
-- Privilèges
-- -----------------------------------------------------------------------------
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke all on all functions in schema public from public, anon, authenticated;
revoke all on all tables in schema private from public, anon, authenticated;
revoke all on all functions in schema private from public, anon, authenticated;

grant select on
  public.profiles,
  public.app_settings,
  public.subscription_plans,
  public.athletes,
  public.subscriptions,
  public.visits,
  public.payments,
  public.audit_logs
to authenticated;

grant execute on function public.current_app_role() to authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.is_staff() to authenticated;
grant execute on function public.app_today() to authenticated;

-- Les objets créés ultérieurement ne doivent pas hériter de privilèges larges.
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on functions from public, anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;

-- >>>>> 20261024000300_functions.sql
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

-- >>>>> 20261024000400_statistics.sql
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

-- >>>>> 20261024000500_phone_login.sql
-- =============================================================================
-- Connexion par numéro de téléphone (agents) et administrateur unique
--
-- Décision métier (24/10/2026) :
--   * Les agents se connectent avec leur numéro de téléphone + mot de passe.
--   * L'administrateur se connecte avec un mot de passe seul.
--
-- Mise en œuvre : Supabase Auth reste le fournisseur d'identité. Chaque compte
-- possède un identifiant e-mail TECHNIQUE et non routable (domaine .invalid),
-- dérivé du numéro pour les agents et fixe pour l'administrateur. Aucun SMS ni
-- e-mail n'est envoyé. Le numéro de l'agent (donnée du personnel, nécessaire à
-- la connexion) est conservé dans profiles.login_phone.
-- =============================================================================

alter table public.profiles
  add column login_phone text,
  add constraint profiles_login_phone_format check (login_phone is null or login_phone ~ '^[0-9]{8,15}$'),
  add constraint profiles_login_phone_unique unique (login_phone),
  add constraint profiles_agent_has_phone check (role <> 'agent' or login_phone is not null);

comment on column public.profiles.login_phone is
  'Numéro de téléphone de connexion de l''agent (chiffres uniquement, indicatif inclus, ex. 22376123456).';

-- Création d'un agent (le compte d'authentification est créé juste avant par le
-- serveur avec la clé service_role).
drop function public.admin_register_staff(uuid, text, public.app_role);

create function public.admin_register_agent(
  p_user_id uuid,
  p_display_name text,
  p_login_phone text
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
  if p_display_name is null or char_length(btrim(p_display_name)) not between 2 and 80
     or p_login_phone is null or p_login_phone !~ '^[0-9]{8,15}$' then
    raise exception 'ERR_INVALID_INPUT' using errcode = 'P0001';
  end if;
  if not exists (select 1 from auth.users where id = p_user_id) then
    raise exception 'ERR_USER_NOT_FOUND' using errcode = 'P0001';
  end if;

  begin
    insert into public.profiles (id, role, display_name, login_phone)
    values (p_user_id, 'agent', btrim(p_display_name), p_login_phone);
  exception when unique_violation then
    raise exception 'ERR_PHONE_DUPLICATE' using errcode = 'P0001';
  end;

  -- Numéro non recopié dans le journal : l'identifiant interne suffit.
  perform private.audit('staff.created', 'profile', p_user_id,
    jsonb_build_object('role', 'agent', 'display_name', btrim(p_display_name)));
end;
$$;

create function public.admin_update_agent(p_user_id uuid, p_display_name text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := private.assert_admin();
begin
  perform private.enforce_rate_limit('admin_write', 120);
  if p_display_name is null or char_length(btrim(p_display_name)) not between 2 and 80 then
    raise exception 'ERR_INVALID_INPUT' using errcode = 'P0001';
  end if;
  update public.profiles set display_name = btrim(p_display_name)
  where id = p_user_id and role = 'agent';
  if not found then
    raise exception 'ERR_USER_NOT_FOUND' using errcode = 'P0001';
  end if;
  perform private.audit('staff.renamed', 'profile', p_user_id, jsonb_build_object('display_name', btrim(p_display_name)));
end;
$$;

-- Journalisation des changements de mot de passe (le mot de passe lui-même
-- n'est jamais transmis à la base applicative).
create function public.admin_log_agent_password_reset(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.assert_admin();
  if not exists (select 1 from public.profiles where id = p_user_id and role = 'agent') then
    raise exception 'ERR_USER_NOT_FOUND' using errcode = 'P0001';
  end if;
  perform private.audit('staff.password_reset', 'profile', p_user_id, '{}'::jsonb);
end;
$$;

create function public.log_own_password_change()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.assert_staff();
  perform private.audit('staff.password_changed', 'profile', auth.uid(), '{}'::jsonb);
end;
$$;

revoke all on all functions in schema public from public, anon, authenticated;

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
  public.admin_register_agent(uuid, text, text),
  public.admin_update_agent(uuid, text),
  public.admin_log_agent_password_reset(uuid),
  public.log_own_password_change(),
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

-- >>>>> 20261024000600_overview_plan.sql
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

-- >>>>> 20261024000700_period_summary.sql
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

-- >>>>> Enregistrement des migrations appliquées (compatibilité « supabase db push »)
create schema if not exists supabase_migrations;
create table if not exists supabase_migrations.schema_migrations (version text primary key, statements text[], name text);
insert into supabase_migrations.schema_migrations (version, name) values
  ('20261024000100', 'schema'),
  ('20261024000200', 'security'),
  ('20261024000300', 'functions'),
  ('20261024000400', 'statistics'),
  ('20261024000500', 'phone_login'),
  ('20261024000600', 'overview_plan'),
  ('20261024000700', 'period_summary')
on conflict (version) do nothing;
