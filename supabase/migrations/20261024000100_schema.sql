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
