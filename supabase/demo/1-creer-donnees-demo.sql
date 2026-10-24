-- =============================================================================
-- Stade du 26 Mars — DONNÉES DE DÉMONSTRATION (fictives)
--
-- Crée environ 120 sportifs aux matricules FICTIFS (générés au hasard, sans
-- rapport avec de vraies personnes), leurs abonnements, paiements et deux mois
-- de passages, pour présenter l'application.
--
-- Prérequis : base installée + compte administrateur créé.
-- Supabase → SQL Editor → New query → coller ce fichier → Run.
-- Pour tout effacer ensuite : 2-supprimer-donnees-demo.sql
-- =============================================================================

create table if not exists private.demo_athletes (
  athlete_id uuid primary key references public.athletes (id)
);
revoke all on private.demo_athletes from public, anon, authenticated;

do $$
declare
  v_tz        text := coalesce((select timezone from public.app_settings where id), 'Africa/Bamako');
  v_today     date := (now() at time zone coalesce((select timezone from public.app_settings where id), 'Africa/Bamako'))::date;
  v_admin     uuid;
  v_staff     uuid[];
  v_hours     int[] := array[6, 6, 7, 7, 7, 8, 9, 10, 16, 17, 17, 18, 18, 18, 19, 19, 20];
  v_methods   public.payment_method[] := array['cash', 'cash', 'mobile_money', 'mobile_money', 'bank_transfer']::public.payment_method[];
  v_plan      record;
  v_athlete   uuid;
  v_matricule text;
  v_reg       date;
  v_start     date;
  v_end       date;
  v_prev      uuid;
  v_sub       uuid;
  v_r         float;
  v_renew     boolean;
  v_plan_name text;
  v_intensity float;
  v_day       date;
  v_in        timestamptz;
  v_out       timestamptz;
  v_athletes  int := 0;
  v_visits    int := 0;
begin
  if exists (select 1 from private.demo_athletes) then
    raise exception 'Des données de démonstration existent déjà. Exécutez d''abord 2-supprimer-donnees-demo.sql pour les recréer.';
  end if;

  select id into v_admin from public.profiles where role = 'admin' and is_active order by created_at limit 1;
  if v_admin is null then
    raise exception 'Aucun administrateur : créez d''abord le compte administrateur.';
  end if;
  -- Les passages sont attribués aux agents existants (et à l'administrateur).
  select array_agg(id) into v_staff from public.profiles where is_active;

  -- Formules (créées seulement si elles n'existent pas déjà).
  insert into public.subscription_plans (name, duration_days, price, currency, created_by) values
    ('Hebdomadaire', 7, 2500, 'XOF', v_admin),
    ('Mensuel', 30, 7500, 'XOF', v_admin),
    ('Trimestriel', 90, 20000, 'XOF', v_admin),
    ('Annuel', 365, 70000, 'XOF', v_admin)
  on conflict do nothing;

  for i in 1..120 loop
    -- Matricule fictif unique : 2 lettres + 5 chiffres au hasard.
    loop
      v_matricule := chr(65 + floor(random() * 26)::int) || chr(65 + floor(random() * 26)::int)
                     || lpad(floor(random() * 100000)::int::text, 5, '0');
      exit when not exists (select 1 from public.athletes where matricule = v_matricule);
    end loop;

    v_r := random();
    v_renew := false;

    if v_r >= 0.06 then -- quelques sportifs restent sans abonnement
      -- Tirage au sort fait une seule fois (et non ligne par ligne dans la requête).
      v_plan_name := (array['mensuel', 'mensuel', 'mensuel', 'trimestriel', 'trimestriel', 'annuel'])[1 + floor(random() * 6)::int];
      select * into v_plan from public.subscription_plans where lower(name) = v_plan_name limit 1;

      if v_r < 0.62 then        -- actif
        -- Fin dans plus de 8 jours (les « expire bientôt » sont tirés à part).
        v_start := v_today - 3 - floor(random() * (v_plan.duration_days - 12))::int;
      elsif v_r < 0.80 then     -- expiré récemment
        v_start := v_today - v_plan.duration_days - 1 - floor(random() * 45)::int;
      elsif v_r < 0.88 then     -- pas encore valide
        v_start := v_today + 1 + floor(random() * 10)::int;
      else                      -- expire dans les prochains jours
        v_start := v_today - v_plan.duration_days + 1 + floor(random() * 5)::int;
      end if;
      v_end := v_start + v_plan.duration_days - 1;
      -- Environ un sur six est un renouvellement : abonnement précédent conservé.
      v_renew := v_r < 0.62 and random() < 0.18;
    end if;

    -- L'inscription précède toujours le premier abonnement.
    v_reg := v_today - floor(random() * 200)::int;
    if v_r >= 0.06 then
      v_reg := least(v_reg, v_today, case when v_renew then v_start - v_plan.duration_days else v_start end);
    end if;

    insert into public.athletes (matricule, registered_on, created_by)
    values (v_matricule, v_reg, v_admin)
    returning id into v_athlete;
    insert into private.demo_athletes values (v_athlete);
    v_athletes := v_athletes + 1;

    continue when v_r < 0.06;

    v_prev := null;
    if v_renew then
      insert into public.subscriptions (athlete_id, plan_id, starts_on, ends_on, created_by)
      values (v_athlete, v_plan.id, v_start - v_plan.duration_days, v_start - 1, v_admin)
      returning id into v_prev;
      insert into public.payments (athlete_id, subscription_id, amount, currency, paid_on, method, recorded_by)
      values (v_athlete, v_prev, v_plan.price, 'XOF', v_start - v_plan.duration_days, v_methods[1 + floor(random() * 5)::int], v_admin);
    end if;

    insert into public.subscriptions (athlete_id, plan_id, starts_on, ends_on, renewed_from_id, created_by)
    values (v_athlete, v_plan.id, v_start, v_end, v_prev, v_admin)
    returning id into v_sub;

    if v_start <= v_today and random() < 0.92 then
      insert into public.payments (athlete_id, subscription_id, amount, currency, paid_on, method, recorded_by)
      values (v_athlete, v_sub, v_plan.price, 'XOF', v_start, v_methods[1 + floor(random() * 5)::int], v_admin);
    end if;

    -- Quelques suspensions.
    if v_r < 0.62 and random() < 0.04 then
      update public.subscriptions
      set state = 'suspended', state_reason = 'Suspension de démonstration', state_changed_at = now(), state_changed_by = v_admin
      where id = v_sub;
    end if;

    -- Passages sur les 60 derniers jours, uniquement pendant les abonnements.
    v_intensity := 0.15 + random() * 0.45;
    for v_day in select generate_series(v_today - 60, v_today, interval '1 day')::date loop
      select s.id into v_sub from public.subscriptions s
      where s.athlete_id = v_athlete and v_day between s.starts_on and s.ends_on
      limit 1;
      continue when v_sub is null or random() > v_intensity;

      v_in := ((v_day + make_interval(hours => v_hours[1 + floor(random() * 17)::int], mins => floor(random() * 60)::int))::timestamp)
              at time zone v_tz;
      continue when v_in > now() - interval '5 minutes';
      v_out := v_in + make_interval(mins => 35 + floor(random() * 110)::int);

      insert into public.visits (athlete_id, subscription_id, entered_at, exited_at, status, entry_agent_id, exit_agent_id)
      values (
        v_athlete, v_sub, v_in,
        case when v_out > now() then null else v_out end,
        case when v_out > now() then 'open' else 'closed' end::public.visit_status,
        v_staff[1 + floor(random() * array_length(v_staff, 1))::int],
        case when v_out > now() then null else v_staff[1 + floor(random() * array_length(v_staff, 1))::int] end
      );
      v_visits := v_visits + 1;
    end loop;
  end loop;

  raise notice 'Démonstration : % sportifs fictifs et % passages créés.', v_athletes, v_visits;
end;
$$;

select count(*) as sportifs_demo from private.demo_athletes;
