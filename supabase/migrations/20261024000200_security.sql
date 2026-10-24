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
