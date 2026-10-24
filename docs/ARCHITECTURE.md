# Architecture et décisions techniques

## Vue d'ensemble

- **Next.js 16 (App Router) sur Vercel** : pages rendues côté serveur, actions
  serveur pour toutes les mutations, une route `POST /api/exports` pour les CSV.
  Le navigateur ne parle **jamais** directement à Supabase : il n'appelle que
  l'application (CSP `connect-src 'self'`).
- **Supabase** : PostgreSQL + Auth. Les règles métier critiques vivent dans la base
  (fonctions transactionnelles), ce qui garantit leur respect quel que soit le client.
- **Rendu dynamique** : application entièrement authentifiée ; le mode
  « Cache Components » de Next.js 16 est désactivé (aucune donnée de session en cache partagé).

## Décisions

| Décision | Raison |
|---|---|
| Règles métier en fonctions PostgreSQL `SECURITY DEFINER` | Transactions, verrous et contraintes au plus près des données ; impossible à contourner par un appel API direct. |
| Aucune écriture directe sur les tables | Surface d'attaque minimale ; chaque écriture est validée et journalisée. |
| Vues `security_invoker` pour les listes | Les vues héritent de la RLS de l'utilisateur (un agent n'y voit rien). |
| Statut d'abonnement calculé, jamais stocké | Pas de désynchronisation ; dépend uniquement des dates, de l'état administratif et du fuseau. |
| Fin d'abonnement **incluse** | Règle explicite et intuitive (« valable jusqu'au 30 inclus »). |
| Renouvellement = nouvel abonnement | Historique intégral ; lien `renewed_from_id`. |
| Contrainte d'exclusion sur les périodes | Un seul abonnement en cours possible : statut non ambigu. |
| Codes d'erreur `ERR_*` traduits côté application | Messages clairs, aucune fuite d'information technique. |
| Filtres et recherches par actions serveur (POST) | Pas de matricule dans les URL ni les journaux d'accès. |
| Identifiants de connexion techniques `.invalid` | Connexion téléphone / mot de passe seul sans fournisseur SMS ni e-mail. |
| PWA plutôt qu'extension Chrome | Mécanisme standard d'installation « comme une application » sur ordinateur et téléphone. |
| Hors ligne « à la LAKOL » | Service worker réseau-d'abord pour la page de contrôle, scripts signalés par la page, file d'opérations à identifiant unique (IndexedDB) renvoyée au retour du réseau ; en plus : vérification locale sur instantané haché et revalidation serveur. |
| Polices auto-hébergées (Fontsource) | Aucune requête vers un tiers (confidentialité, CSP stricte). |
| Recharts pour les graphiques | Composable avec React, accessible (vue tableau proposée). |

## Modèle de données

```
profiles (personnel) ──┐
                       │ created_by / agents
athletes (matricule) ──┼── subscriptions (starts_on, ends_on, state, plan_id, renewed_from_id)
        │              │        └── payments (montant, devise, mode, statut)
        └──────────────┴── visits (entered_at, exited_at, status, entry/exit agent, correction)
subscription_plans (formules)    app_settings (ligne unique)    audit_logs (append-only)
private.rate_limits (limitation de débit, non exposée)
```

Migrations (ordre d'application) :

| Fichier | Contenu |
|---|---|
| `…0100_schema.sql` | Types, tables, contraintes, index, déclencheurs d'immutabilité |
| `…0200_security.sql` | Fonctions d'autorisation, RLS, privilèges, audit, limitation de débit |
| `…0300_functions.sql` | Vues de lecture, fonctions métier (sportifs, abonnements, paiements, contrôle, corrections, personnel, paramètres, exports) |
| `…0400_statistics.sql` | Statistiques |
| `…0500_phone_login.sql` | Connexion par téléphone (agents), fonctions de gestion des agents |
| `…0600_overview_plan.sql` | Formule de référence dans `athlete_overview` |
| `…0700_period_summary.sql` | Synthèse de période (rapports) |
| `…0800_audit_target.sql` | Nom du membre du personnel concerné dans le journal |
| `…0900_offline_mode.sql` | Mode hors ligne : instantané haché, synchronisation idempotente, opérations à vérifier |
| `…1000_visit_log_offline.sql` | Indicateurs « hors ligne » dans l'historique des passages |

## Système de design

Défini dans `src/app/globals.css` (`@theme` Tailwind 4) :

- **Couleurs** : vert « pelouse » (`pitch-*`) pour l'institution, neutres sable
  chauds (`canvas`, `surface`, `line`, `ink-*`), or (`gold-*`) en accent rare,
  couleurs de statut réservées (`success`, `danger`, `warning`, `info`),
  palette de graphiques validée (contraste et daltonisme).
- **Typographie** : Plus Jakarta Sans (texte et chiffres), Barlow Condensed
  (titres, matricules, verdicts — esprit « signalétique de stade »).
- **Composants** (`src/components/ui`) : boutons, champs avec libellés et erreurs
  reliés (`aria-describedby`), badges de statut (icône + libellé), cartes,
  tableaux, dialogues et confirmations (Radix), pagination, filtres, états vides,
  alertes, en-têtes de page.
- **Motif signature** : couloirs de piste d'athlétisme en filigrane.
- Accessibilité : focus visible, lien d'évitement, cibles tactiles ≥ 40 px,
  `prefers-reduced-motion`, statuts jamais signalés par la couleur seule.
