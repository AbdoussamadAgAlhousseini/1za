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
