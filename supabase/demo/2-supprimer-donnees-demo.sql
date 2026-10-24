-- =============================================================================
-- Stade du 26 Mars — SUPPRESSION DES DONNÉES DE DÉMONSTRATION
--
-- Efface uniquement les sportifs créés par 1-creer-donnees-demo.sql, avec leurs
-- abonnements, paiements et passages. Les vrais sportifs, les formules, les
-- comptes et le journal d'audit sont conservés.
--
-- L'historique est normalement protégé contre toute suppression : la protection
-- est levée le temps de cette opération, puis rétablie.
-- =============================================================================

begin;

alter table public.visits disable trigger visits_no_delete;
alter table public.payments disable trigger payments_no_delete;
alter table public.subscriptions disable trigger subscriptions_no_delete;
alter table public.athletes disable trigger athletes_no_delete;
alter table public.offline_operations disable trigger offline_operations_no_delete;

delete from public.offline_operations where athlete_id in (select athlete_id from private.demo_athletes);
delete from public.visits where athlete_id in (select athlete_id from private.demo_athletes);
delete from public.payments where athlete_id in (select athlete_id from private.demo_athletes);
delete from public.subscriptions where renewed_from_id is not null and athlete_id in (select athlete_id from private.demo_athletes);
delete from public.subscriptions where athlete_id in (select athlete_id from private.demo_athletes);
create temporary table demo_ids on commit drop as select athlete_id from private.demo_athletes;
delete from private.demo_athletes;
delete from public.athletes where id in (select athlete_id from demo_ids);

alter table public.visits enable trigger visits_no_delete;
alter table public.payments enable trigger payments_no_delete;
alter table public.subscriptions enable trigger subscriptions_no_delete;
alter table public.athletes enable trigger athletes_no_delete;
alter table public.offline_operations enable trigger offline_operations_no_delete;

commit;

select count(*) as sportifs_restants from public.athletes;
