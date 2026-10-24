# Sécurité, autorisations et confidentialité

## 1. Principes

1. **Défense en profondeur** : chaque restriction est appliquée dans l'interface
   (confort), dans les actions serveur Next.js (`requireAdmin` / `requireStaff`),
   puis **dans PostgreSQL** (RLS + vérification du rôle dans chaque fonction).
   La base reste correcte même si un client appelle l'API Supabase directement.
2. **Aucune écriture directe** : les tables n'ont aucune politique RLS d'écriture
   et les privilèges `INSERT/UPDATE/DELETE` sont retirés aux rôles clients.
   Toute modification passe par une fonction `SECURITY DEFINER` qui vérifie le
   rôle, valide, applique la règle métier et journalise.
3. **Minimisation des données** : un sportif = un matricule. Les agents ne
   voient que ce qui est nécessaire au contrôle.
4. **Traçabilité** : pas de suppression physique de l'historique ; annulations
   motivées ; journal d'audit immuable.

## 2. Rôles

| Rôle | Attribution | Accès |
|---|---|---|
| `anon` | visiteur non connecté | aucun accès aux données ni aux fonctions |
| **agent** | créé par l'administrateur (page Personnel) | fonctions `control_*` uniquement, son propre profil, paramètres d'affichage |
| **admin** | script `npm run admin:create` | lecture complète via RLS, fonctions `admin_*` et `stats_*` |
| compte sans profil / désactivé | — | équivalent à `anon` pour les données (`current_app_role()` renvoie `NULL`) |

Le rôle est stocké dans `public.profiles.role`. Aucune politique ne permet de
modifier `profiles` depuis un client : **un utilisateur ne peut pas s'attribuer
de privilèges**. L'administrateur ne peut ni se désactiver ni agir sur son propre
compte via les fonctions de gestion.

### Matrice détaillée (appliquée en base)

| Opération | Fonction / table | admin | agent | anon |
|---|---|:-:|:-:|:-:|
| Vérifier un matricule | `control_check` | ✅ | ✅ | ❌ |
| Enregistrer une entrée / sortie | `control_record_entry` / `control_record_exit` | ✅ | ✅ | ❌ |
| Présents, mes opérations, compteurs | `control_present`, `control_my_activity`, `control_overview` | ✅ | ✅ | ❌ |
| Lire sportifs, abonnements, passages, paiements, journal | `SELECT` (RLS) | ✅ | ❌ (0 ligne) | ❌ |
| Créer un sportif | `admin_create_athlete` | ✅ | ❌ | ❌ |
| Créer / renouveler un abonnement (+ paiement) | `admin_create_subscription` | ✅ | ❌ | ❌ |
| Suspendre / réactiver / annuler | `admin_set_subscription_state` | ✅ | ❌ | ❌ |
| Paiements | `admin_record_payment`, `admin_cancel_payment` | ✅ | ❌ | ❌ |
| Corriger un passage | `admin_correct_visit` | ✅ | ❌ | ❌ |
| Personnel | `admin_register_agent`, `admin_update_agent`, `admin_set_staff_active`, `admin_log_agent_password_reset` | ✅ | ❌ | ❌ |
| Paramètres, formules | `admin_update_settings`, `admin_save_plan` | ✅ | ❌ | ❌ |
| Statistiques, exports | `stats_*`, `admin_log_export` | ✅ | ❌ | ❌ |
| Journaliser son changement de mot de passe | `log_own_password_change` | ✅ | ✅ | ❌ |

Les tests `tests/db/permissions.test.ts` et `tests/db/staff.test.ts` vérifient
ces règles par appels directs à l'API.

## 3. Intégrité des données

| Risque | Protection |
|---|---|
| Double entrée (y compris simultanée) | Verrou `FOR UPDATE` sur le sportif + index unique partiel « une visite ouverte par sportif » |
| Double sortie / sortie sans entrée | `UPDATE … WHERE status = 'open' RETURNING` atomique |
| Heure falsifiée par l'appareil | Horodatages `now()` générés par PostgreSQL ; `entered_at` immuable (déclencheur) |
| Abonnement rendu valide par un agent | Agents sans aucun accès en écriture ; validité recalculée côté serveur à chaque entrée |
| Abonnements qui se chevauchent | Contrainte d'exclusion GiST sur `daterange(starts_on, ends_on)` |
| Doublon de matricule | Contrainte d'unicité ; erreur explicite, jamais d'attribution silencieuse |
| Modification d'un matricule | Déclencheur `ERR_IMMUTABLE` (même avec la clé service_role) |
| Suppression d'historique | Déclencheurs interdisant `DELETE` sur sportifs, abonnements, passages, paiements |
| Altération du journal | Déclencheur interdisant `UPDATE/DELETE` sur `audit_logs` |
| Injection SQL | Requêtes paramétrées (PostgREST) ; fonctions avec `search_path` vide et objets qualifiés |
| Abus / énumération | Limitation de débit en base : 120 vérifications/min, 60 entrées-sorties/min par agent, 120 écritures admin/min, 20 exports/min ; limites de Supabase Auth sur les connexions |

## 4. Authentification et sessions

- Supabase Auth ; jetons stockés dans des **cookies httpOnly** gérés par
  `@supabase/ssr` ; le jeton est **vérifié** à chaque requête (`getClaims`).
- Le proxy (`src/proxy.ts`) rafraîchit la session et redirige vers `/connexion`.
- Mots de passe : jamais stockés par l'application (hachage par Supabase Auth) ;
  10 caractères minimum (12 pour l'administrateur), minuscule, majuscule, chiffre.
- Changement de mot de passe : vérification du mot de passe actuel, journalisé.
- **Révocation d'un agent** : profil désactivé (effet immédiat sur toutes les
  fonctions et la RLS) + bannissement Supabase Auth (plus de connexion ni de
  rafraîchissement de session). L'historique de ses opérations est conservé.
- Inscriptions publiques désactivées. Messages d'échec de connexion génériques.

## 5. Secrets

| Secret | Où | Jamais |
|---|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | Variables Vercel (serveur), `.env.local` local | navigateur, `NEXT_PUBLIC_*`, Git, journaux |
| Mot de passe de la base | gestionnaire de mots de passe | code, Git |

`.gitignore` exclut `.env*` (sauf `.env.example`). Le module `admin.ts` est
`server-only`. Vérification effectuée : aucune occurrence de la clé dans
`.next/static` après build.

## 6. En-têtes HTTP

`Content-Security-Policy` (sources limitées à l'application, `frame-ancestors 'none'`),
`X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`,
`Referrer-Policy: same-origin`, `Strict-Transport-Security`,
`Permissions-Policy` (caméra, micro, géolocalisation désactivés),
`Cache-Control: private, no-store` sur les pages authentifiées,
`robots: noindex`. Polices auto-hébergées : aucune requête vers un tiers,
aucun outil d'analyse ou de suivi.

## 7. Confidentialité des sportifs

- Seul le **matricule** est collecté ; aucun champ nom / téléphone / photo / adresse
  n'existe dans le schéma ni dans l'interface, et rien ne permet de reconstituer
  ces informations.
- Le matricule et l'historique de fréquentation restent des **données
  personnelles indirectes** (pseudonymisation, pas anonymisation). En conséquence :
  - les agents ne voient pas la liste des sportifs, seulement le résultat d'un
    contrôle et la liste des présents (nécessaire aux sorties) ;
  - les matricules n'apparaissent **jamais dans les URL** (recherches et exports
    par requêtes POST ; fiches adressées par identifiant interne UUID) ;
  - le journal d'audit référence les entités par identifiant interne et ne
    recopie pas les matricules ni les numéros des agents ;
  - la journalisation des arguments des actions serveur est désactivée
    (`logging.serverFunctions: false`) et les erreurs serveur ne journalisent
    qu'un code ;
  - le service worker ne met en cache que la page du poste de contrôle (pour le
    mode hors ligne) ; ce cache est vidé à la déconnexion.
- Les exports sont réservés à l'administrateur, limités, journalisés et ne
  contiennent que les colonnes utiles. Ils doivent être conservés dans un
  emplacement protégé.

## 8. Mode hors ligne

| Risque | Mesure |
|---|---|
| Données sur le téléphone | Copie limitée aux abonnements utiles (valides, à venir, expirés depuis moins de 60 jours) ; matricules **hachés** (SHA-256 avec sel aléatoire par copie) ; aucune autre donnée. Un hachage de matricule à 7 caractères reste réversible par force brute : la copie n'est pas « anonyme ». Elle expire (24 h par défaut) et est effacée à la déconnexion. |
| File d'attente | Contient les matricules saisis hors ligne jusqu'à leur transmission ; déconnexion bloquée tant qu'elle n'est pas vide (pas de perte). |
| Heure de l'appareil | Hors ligne, l'horodatage vient du téléphone (inévitable). Le serveur refuse les heures futures et les opérations de plus de 72 h ; les passages sont marqués « Hors ligne » dans l'historique ; une horloge antérieure à la copie bloque la vérification. |
| Règles contournées hors ligne | Le serveur revalide chaque opération (abonnement à la date de l'entrée, chevauchements, sortie sans entrée). Les opérations non conformes ne sont pas appliquées et sont présentées à l'administrateur. |
| Double envoi | Identifiant unique par opération : idempotence garantie ; une opération d'un autre agent est refusée. |
| Téléphone perdu | Révoquer l'agent (page Personnel) : plus aucune synchronisation possible ; la copie locale expire d'elle-même. |

## 9. Signaler / corriger une faille

Mettre à jour les dépendances régulièrement (`npm audit`, `npm outdated`) et
relancer l'ensemble des tests avant tout déploiement.
