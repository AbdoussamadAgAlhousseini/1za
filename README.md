# Stade du 26 Mars — Gestion des sportifs

Application web de gestion des sportifs, des abonnements et de la fréquentation du
Stade du 26 Mars : contrôle des entrées et sorties par les agents, suivi des
abonnements et des paiements, statistiques et rapports pour l'administration.

- **Interface en français**, conçue pour l'ordinateur de l'administrateur et les
  téléphones des agents, **installable comme une application** (PWA).
- **Confidentialité** : un sportif n'est identifié que par son **matricule**
  (ex. fictif `AD76214`). Aucun nom, téléphone, photo ou adresse de sportif n'est
  demandé ni stocké.
- **Sécurité** : règles métier et autorisations appliquées **dans PostgreSQL**
  (Row Level Security + fonctions contrôlées), pas seulement dans l'interface.

> Statut : application complète et testée en local (Supabase local + navigateur).
> La mise en ligne nécessite de créer les projets Supabase et Vercel : voir
> [docs/DEPLOIEMENT.md](docs/DEPLOIEMENT.md) et la liste des
> [opérations manuelles](#opérations-restant-à-réaliser-manuellement).

---

## Sommaire

1. [Fonctionnalités](#fonctionnalités)
2. [Rôles et autorisations](#rôles-et-autorisations)
3. [Architecture](#architecture)
4. [Installation et lancement en développement](#installation-et-lancement-en-développement)
5. [Tests](#tests)
6. [Déploiement](#déploiement)
7. [Documentation détaillée](#documentation-détaillée)
8. [Limitations connues](#limitations-connues)
9. [Opérations restant à réaliser manuellement](#opérations-restant-à-réaliser-manuellement)

---

## Fonctionnalités

| Module | Contenu |
|---|---|
| **Connexion** | Agents : numéro de téléphone + mot de passe. Administrateur : mot de passe seul. Page « Mon compte » pour modifier son mot de passe. |
| **Contrôle d'accès** (agents et administrateur) | Saisie du matricule, verdict immédiat (autorisé, expiré, pas encore valide, suspendu, sans abonnement, inconnu, déjà à l'intérieur), enregistrement de l'entrée ou de la sortie en un geste (touche Entrée), liste des présents, opérations du jour de l'agent. |
| **Mode hors ligne** (agents) | Sans réseau, la vérification se fait sur le téléphone à partir d'une copie des abonnements téléchargée automatiquement (matricules hachés), les entrées et sorties sont mises en file d'attente puis transmises au retour du réseau. Le serveur revalide tout ; les opérations non conformes sont signalées à l'administrateur. Voir [docs/HORS-LIGNE.md](docs/HORS-LIGNE.md). |
| **Tableau de bord** | Activité du jour (entrées, sportifs uniques, présents, visites terminées), fréquentation sur 30 jours, répartition des statuts d'abonnement, renouvellements à prévoir, expirations récentes, ventes du mois, derniers passages. |
| **Sportifs** | Enregistrement par matricule (validation et détection des doublons), premier abonnement et paiement en une seule étape, recherche, filtres (statut, période d'inscription), tri, pagination serveur, fiche de suivi (indicateurs, graphique 60 jours, historique des abonnements, paiements, passages). |
| **Abonnements** | Formules configurables, création, renouvellement (historique conservé), suspension / réactivation / annulation motivées, vue « À renouveler », liste filtrable. |
| **Fréquentation** | Historique des passages filtrable (matricule, statut, agent, période), durées, corrections administratives (sortie oubliée, passage erroné) avec motif. |
| **Paiements** | Enregistrement de paiements reçus hors application (espèces, mobile money, virement…), totaux du mois par formule, annulation motivée. |
| **Rapports** | Synthèse d'une période, évolution par jour / semaine / mois, carte des heures de pointe, activité des agents, recettes par formule, impression, exports CSV (Excel). |
| **Personnel** | Création des comptes agents, réinitialisation de mot de passe, révocation immédiate de l'accès (historique conservé). |
| **Paramètres** | Nom du stade, fuseau horaire, seuil « expire bientôt », seuil d'entrée anormalement longue, devise. |
| **Journal d'audit** | Qui a fait quoi et quand (créations, renouvellements, changements d'état, corrections, paiements, comptes, paramètres, exports). Lecture seule. |

Tous les écrans gèrent les états vides, de chargement et d'erreur, et
s'adaptent à l'ordinateur, à la tablette et au téléphone.

---

## Rôles et autorisations

Résumé (détail complet dans [docs/SECURITE.md](docs/SECURITE.md)) :

| Action | Administrateur | Agent |
|---|:---:|:---:|
| Vérifier un matricule, enregistrer entrées et sorties | ✅ | ✅ |
| Voir les présents et ses propres opérations du jour | ✅ | ✅ |
| Modifier son mot de passe | ✅ | ✅ |
| Créer un sportif, voir les listes et fiches | ✅ | ❌ |
| Créer / renouveler / suspendre / annuler un abonnement | ✅ | ❌ |
| Paiements, statistiques, rapports, exports | ✅ | ❌ |
| Corriger un passage | ✅ | ❌ |
| Gérer les agents, paramètres, formules ; journal d'audit | ✅ | ❌ |

Ces restrictions sont vérifiées **trois fois** : dans l'interface, dans les
actions serveur Next.js, et **dans PostgreSQL** (RLS + contrôle du rôle dans
chaque fonction). Un agent qui appellerait directement l'API Supabase avec son
jeton obtient `ERR_FORBIDDEN` — c'est couvert par les tests automatisés.

---

## Architecture

```
Navigateur / application installée (PWA)
        │  HTTPS, cookies de session httpOnly
        ▼
Next.js 16 sur Vercel ─ pages serveur, actions serveur, route d'export, proxy de session
        │  jeton de l'utilisateur (RLS)          │  clé service_role (comptes du personnel uniquement)
        ▼                                        ▼
Supabase : PostgreSQL (tables, RLS, fonctions métier, statistiques) + Auth
```

| Domaine | Choix |
|---|---|
| Frontend | React 19, **Next.js 16** (App Router), **TypeScript strict**, **Tailwind CSS 4** |
| Composants | Système de design maison (Radix UI pour les dialogues et menus, icônes Lucide), graphiques **Recharts** |
| Validation | **Zod** côté serveur (et aide à la saisie côté client) ; contraintes SQL en dernier rempart |
| Backend | Actions serveur et route handler Next.js (compatibles Vercel) |
| Données | **PostgreSQL / Supabase**, migrations versionnées dans `supabase/migrations` |
| Authentification | **Supabase Auth** (sessions par cookies httpOnly via `@supabase/ssr`) |
| Tests | **Vitest** (unitaires + intégration base), **Playwright** (bout en bout) |

Décisions détaillées : [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

### Arborescence

```
src/
  app/
    (auth)/connexion/          Connexion (onglets Agent / Administration)
    (app)/                     Pages authentifiées (layout avec navigation)
      controle/                Poste de contrôle (agents)
      tableau-de-bord/ sportifs/ abonnements/ frequentation/ paiements/
      rapports/ journal/ personnel/ parametres/ mon-compte/
    api/exports/route.ts       Exports CSV (POST)
    manifest.ts, hors-ligne/   Application installable
  components/                  ui/ (système de design), layout/, charts/, …
  lib/
    domain/                    Règles pures : matricule, statuts, périodes, formats, CSV
    validation/                Schémas Zod
    supabase/                  Clients (serveur, admin, proxy) + types générés
    auth/identity.ts           Identifiants de connexion (téléphone / administrateur)
  server/
    auth.ts                    Session, requireStaff / requireAdmin
    actions/                   Actions serveur (mutations, listes paginées)
    queries/                   Lectures serveur
  proxy.ts                     Rafraîchissement de session, redirection si non connecté
supabase/
  migrations/                  Schéma, sécurité (RLS), fonctions métier, statistiques
  config.toml                  Configuration Supabase locale
scripts/
  admin-account.mjs            Création / récupération du compte administrateur
  seed-dev.mjs                 Données fictives (LOCAL uniquement)
tests/unit, tests/db, e2e/     Tests
docs/                          Documentation
```

---

## Installation et lancement en développement

Prérequis : **Node.js 22**, **Docker** (pour Supabase local), npm.

```bash
# 1. Dépendances
npm install

# 2. Supabase local (applique automatiquement les migrations)
npx supabase start
#    → affiche l'URL de l'API et les clés locales (anon, service_role)

# 3. Variables d'environnement
cp .env.example .env.local
#    Renseigner avec les valeurs affichées par « supabase start » :
#    NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
#    NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>
#    SUPABASE_SERVICE_ROLE_KEY=<service_role key>

# 4a. Données de démonstration fictives (local uniquement)
npm run seed:dev
#    Comptes : Administration → mot de passe « Admin-Stade-2026 »
#              Agent → téléphone 70 00 00 01, mot de passe « Agent-Stade-2026 »

# 4b. …ou base vide avec votre propre compte administrateur
npm run admin:create

# 5. Lancer l'application
npm run dev            # http://localhost:3000
```

Commandes utiles :

| Commande | Rôle |
|---|---|
| `npm run dev` | Serveur de développement |
| `npm run build` / `npm start` | Build et serveur de production |
| `npm run lint` / `npm run typecheck` | ESLint / TypeScript |
| `npm test` | Tests unitaires + intégration base de données |
| `npm run e2e` | Tests de bout en bout (Playwright) |
| `npx supabase db reset` | Recrée la base locale depuis les migrations |
| `npx supabase gen types typescript --local > src/lib/supabase/database.types.ts` | Régénère les types après une migration |
| `npm run admin:create` / `npm run admin:reset-password` | Compte administrateur |

> Dans l'environnement de développement utilisé pour construire le projet, Docker
> Hub était accessible mais pas le registre par défaut de Supabase : la variable
> `SUPABASE_INTERNAL_IMAGE_REGISTRY=docker.io` a été nécessaire. Elle est inutile
> sur un poste classique.

---

## Tests

| Suite | Contenu | Commande |
|---|---|---|
| Unitaires (56) | Matricules, numéros de téléphone, vérification hors ligne (dont parité du hachage avec PostgreSQL), périodes et dates de fin, durées, formats, fuseaux horaires, CSV (injection de formules), politique et génération de mots de passe, traduction des erreurs | `npm run test:unit` |
| Base de données (74) | Exécutés **contre Supabase local** par appels directs à l'API : RLS et autorisations de chaque rôle (anon, agent, compte sans profil, agent désactivé), validation et doublons de matricules, validité des abonnements, chevauchements, renouvellements, états, paiements, entrées / sorties, **doubles entrées simultanées**, doubles sorties, sorties sans entrée, corrections, immutabilité (matricule, horodatages, journal), statistiques, limitation de débit, comptes par téléphone, instantané hors ligne et synchronisation (idempotence, conflits, revue) | `npm run test:db` |
| Bout en bout (14) | Connexion des deux rôles, contrôle hors ligne puis synchronisation, refus d'accès agent (pages et export direct), parcours complet enregistrement → entrée → refus de double entrée → sortie (ordinateur **et** téléphone), toutes les pages d'administration, export CSV journalisé, absence de matricule dans les URL | `npm run e2e` |

Les tests base de données et de bout en bout nécessitent `npx supabase start`
(et `npm run seed:dev` pour les tests de bout en bout). Ils refusent de
s'exécuter contre une URL Supabase non locale.

---

## Déploiement

Guide pas à pas : **[docs/DEPLOIEMENT.md](docs/DEPLOIEMENT.md)** (création du
projet Supabase, migrations, configuration de l'authentification, projet Vercel,
variables d'environnement, premier administrateur, installation sur les appareils).

Variables d'environnement :

| Variable | Portée | Description |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Publique | URL du projet Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Publique | Clé « anon » (protégée par la RLS) |
| `NEXT_PUBLIC_SITE_URL` | Publique | URL publique de l'application |
| `SUPABASE_SERVICE_ROLE_KEY` | **Serveur uniquement** | Création / révocation des comptes du personnel. Jamais dans le navigateur ni dans Git. |

---

## Documentation détaillée

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — choix techniques et modèle de données
- [docs/SECURITE.md](docs/SECURITE.md) — rôles, RLS, fonctions, confidentialité, en-têtes, journalisation
- [docs/STATISTIQUES.md](docs/STATISTIQUES.md) — définitions et règles de calcul
- [docs/DEPLOIEMENT.md](docs/DEPLOIEMENT.md) — Supabase, Vercel, premier administrateur, PWA
- [docs/HORS-LIGNE.md](docs/HORS-LIGNE.md) — fonctionnement du contrôle sans réseau
- [docs/EXPLOITATION.md](docs/EXPLOITATION.md) — doublons de matricules, récupération des accès, sauvegardes, maintenance
- [public/brand/LISEZMOI.md](public/brand/LISEZMOI.md) — intégration du logo officiel

---

## Limitations connues

1. **Identité visuelle provisoire** : aucun logo ni charte officiels n'ont été
   fournis (monogramme « 26 » provisoire, clairement signalé).
2. **Collisions de matricules** : la règle validée (initiales + 5 premiers
   chiffres du téléphone) peut produire le même matricule pour deux personnes.
   L'application refuse le doublon sans rien créer ; la procédure est décrite dans
   [docs/EXPLOITATION.md](docs/EXPLOITATION.md).
3. **Pseudonymisation, pas anonymisation** : le matricule et l'historique de
   fréquentation restent des données personnelles indirectes ; ils sont protégés
   comme tels mais ne sont pas anonymes.
4. **Mot de passe oublié** : pas d'e-mail ni de SMS. Un agent demande une
   réinitialisation à l'administrateur ; l'administrateur utilise
   `npm run admin:reset-password` (accès à la clé service_role requis).
5. **Mode hors ligne** : limité au poste de contrôle (les pages d'administration
   exigent le réseau). Hors ligne, la vérification repose sur une copie des
   abonnements datant au plus de 24 h (paramétrable) et sur l'heure du téléphone ;
   les opérations sont revalidées par le serveur à la synchronisation. Les
   matricules de la copie sont hachés, mais un hachage de matricule reste
   théoriquement réversible par force brute : la copie est effacée à la
   déconnexion. Le téléphone doit s'être connecté au moins une fois au réseau.
6. **Paiements** : enregistrement manuel uniquement ; aucune intégration bancaire
   ou mobile money.
7. **Politique CSP** : `script-src 'unsafe-inline'` est nécessaire au rendu de
   Next.js sans nonce ; une CSP à nonce pourra être ajoutée ultérieurement.
8. **Filtres par date de la fréquentation** : filtrage sur la date locale calculée
   (adapté à des centaines de milliers de passages ; au-delà, prévoir un index
   d'expression ou une colonne de date dédiée).
9. **Mode sombre** non prévu.
10. **Sauvegardes** : dépendent de l'offre Supabase choisie (voir
    [docs/EXPLOITATION.md](docs/EXPLOITATION.md)).

---

## Opérations restant à réaliser manuellement

Ces étapes nécessitent vos comptes et ne peuvent pas être faites à votre place :

1. **Créer le projet Supabase** (région conseillée : la plus proche du Mali, ex.
   Europe de l'Ouest) et **appliquer les migrations** (`npx supabase db push`).
2. **Configurer Supabase Auth** : désactiver les inscriptions publiques, politique
   de mot de passe, URL du site (voir guide).
3. **Créer le projet Vercel**, renseigner les 4 variables d'environnement, déployer.
4. **Créer le compte administrateur** : `npm run admin:create` avec les variables
   de production (sur un poste de confiance).
5. **Créer les formules d'abonnement** réelles (Paramètres) et **les comptes des
   agents** (Personnel).
6. **Fournir le logo officiel** si disponible.
7. **Choisir l'offre Supabase** adaptée aux sauvegardes souhaitées.
8. **Installer l'application** sur l'ordinateur de l'administrateur et les
   téléphones des agents (voir guide).
