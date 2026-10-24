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
