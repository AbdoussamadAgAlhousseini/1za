# Déploiement (Supabase + Vercel)

Ce guide met l'application en production. Comptez environ 30 minutes.
Toutes les valeurs secrètes restent dans Supabase et Vercel : **rien n'est à
écrire dans le code ni dans Git**.

## 0. Prérequis

- Un compte **Supabase** (https://supabase.com) et un compte **Vercel** (https://vercel.com).
- Le dépôt GitHub du projet.
- Sur un poste de confiance : Node.js 22 et le projet cloné (`npm install`).

## 1. Créer le projet Supabase

1. Supabase → **New project**.
   - Nom : `stade-26-mars`.
   - **Région** : la plus proche du Mali disponible, par exemple *West EU (Paris)*.
     Le fichier `vercel.json` place les fonctions Vercel à Paris (`cdg1`) pour
     limiter la latence entre l'application et la base. Si vous choisissez une
     autre région Supabase, adaptez `regions` dans `vercel.json`.
   - Mot de passe de la base : générez-le et conservez-le dans un gestionnaire de mots de passe.
2. Notez dans **Project Settings → API** (ou **API Keys**) :
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - clé **anon / publishable** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - clé **service_role / secret** → `SUPABASE_SERVICE_ROLE_KEY` (**secrète**)

## 2. Appliquer les migrations

Depuis le dossier du projet :

```bash
npx supabase login                     # ouvre le navigateur
npx supabase link --project-ref <ref>  # <ref> = identifiant du projet (dans son URL)
npx supabase db push                   # applique supabase/migrations/*.sql
```

Vérification : dans **Table Editor**, les tables `athletes`, `subscriptions`,
`visits`, `payments`, `profiles`, `audit_logs`… existent et affichent
« RLS enabled ».

> Ne jamais désactiver la RLS. Ne jamais exécuter `supabase/seed` ni
> `scripts/seed-dev.mjs` en production (le script refuse d'ailleurs toute URL non locale).

## 3. Configurer l'authentification Supabase

**Authentication → Sign In / Providers** (libellés susceptibles d'évoluer) :

| Réglage | Valeur | Pourquoi |
|---|---|---|
| Allow new users to sign up | **Désactivé** | Seul l'administrateur crée des comptes. |
| Email provider | **Activé** | Les identifiants techniques sont de type e-mail (voir ci-dessous). |
| Confirm email | indifférent | Les comptes sont créés déjà confirmés. |
| Secure password change | **Désactivé** | L'application vérifie elle-même le mot de passe actuel. |
| Minimum password length | **10** | Aligné sur l'application (12 pour l'administrateur). |
| Password requirements | **Lowercase, uppercase letters and digits** | Aligné sur l'application. |

**Authentication → URL Configuration** : *Site URL* = l'URL Vercel de
production (ex. `https://stade-26-mars.vercel.app`).

**Authentication → Rate Limits** : conservez les valeurs par défaut (elles
limitent les tentatives de connexion par adresse IP).

> **Identifiants techniques.** Les agents se connectent avec leur numéro de
> téléphone et l'administrateur avec un mot de passe seul. Supabase Auth exige un
> identifiant : l'application utilise des adresses techniques non routables sur le
> domaine réservé `.invalid` (`agent.22376123456@stade26.invalid`,
> `administration@stade26.invalid`). Aucun e-mail ni SMS n'est jamais envoyé ;
> aucun fournisseur SMS n'est nécessaire.

## 4. Créer le projet Vercel

1. Vercel → **Add New → Project** → importez le dépôt GitHub.
2. Framework : **Next.js** (détecté automatiquement). Commandes par défaut.
3. **Environment Variables** (Production, et Preview si vous utilisez une base de test) :

| Nom | Valeur | Remarque |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL | publique |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | clé anon | publique, protégée par la RLS |
| `NEXT_PUBLIC_SITE_URL` | `https://<votre-projet>.vercel.app` | sans `/` final |
| `SUPABASE_SERVICE_ROLE_KEY` | clé service_role | **secrète**, serveur uniquement |

4. **Deploy**. Une fois en ligne, reportez l'URL définitive dans
   `NEXT_PUBLIC_SITE_URL` et dans *Site URL* de Supabase si elle a changé
   (domaine personnalisé), puis redéployez.

> N'ajoutez jamais `SUPABASE_SERVICE_ROLE_KEY` avec le préfixe `NEXT_PUBLIC_`.
> Le module `src/lib/supabase/admin.ts` est marqué `server-only` : une
> importation côté client ferait échouer la compilation.

## 5. Créer le compte administrateur

Sur un poste de confiance, depuis le dossier du projet :

```bash
NEXT_PUBLIC_SUPABASE_URL="https://<ref>.supabase.co" \
SUPABASE_SERVICE_ROLE_KEY="<clé service_role>" \
npm run admin:create
```

Le script demande le mot de passe (saisie masquée, 12 caractères minimum avec
minuscule, majuscule et chiffre), crée le compte et son profil, et journalise
l'opération. Il refuse de créer un second administrateur.

Connectez-vous ensuite sur l'application : onglet **Administration**, mot de passe.
Vous pourrez le modifier à tout moment dans **Mon compte**.

> Effacez l'historique du terminal si vous avez saisi la clé en clair
> (`history -c` sous bash) ou utilisez un fichier `.env.local` temporaire.

## 6. Mise en route

1. **Paramètres** : vérifiez le fuseau (`Africa/Bamako`), la devise (`XOF`),
   le seuil « expire bientôt ».
2. **Paramètres → Formules** : créez les formules réelles (durée, tarif).
3. **Personnel** : créez un compte par agent (nom, numéro, mot de passe
   initial à communiquer en main propre).
4. **Sportifs** : enregistrez les matricules et leurs abonnements.

## 7. Installer l'application sur les appareils

L'application est une **PWA** : elle s'installe depuis le navigateur, sans
magasin d'applications, et s'ouvre ensuite dans sa propre fenêtre avec une icône.

| Appareil | Procédure |
|---|---|
| **Ordinateur** (Chrome ou Edge) | Ouvrir l'URL, se connecter, cliquer sur l'icône d'installation dans la barre d'adresse (ou bouton « Installer l'application » dans le menu latéral / page Mon compte). L'icône apparaît sur le bureau et dans le menu Démarrer. |
| **Android** (Chrome) | Ouvrir l'URL → bouton « Installer l'application » ou menu ⋮ → *Installer l'application*. |
| **iPhone** (Safari) | Ouvrir l'URL → *Partager* → *Sur l'écran d'accueil* → *Ajouter*. |

Une extension Chrome n'est pas nécessaire : l'installation PWA est le mécanisme
standard pour obtenir une application de bureau à partir d'une application web.

## 8. Vérifications après déploiement

- [ ] La page `/connexion` s'affiche ; une adresse `/sportifs` sans session redirige vers la connexion.
- [ ] Connexion administrateur OK ; tableau de bord affiché.
- [ ] Un agent créé peut se connecter avec son numéro ; il est redirigé vers « Accès refusé » s'il ouvre `/sportifs`.
- [ ] Contrôle d'un matricule, entrée puis sortie OK.
- [ ] Un export CSV fonctionne et apparaît dans le journal d'audit.
- [ ] L'application est installable (icône d'installation visible dans Chrome).

## 9. Mises à jour ultérieures

- Code : un `git push` sur la branche de production redéploie Vercel automatiquement.
- Base : toute évolution du schéma passe par un **nouveau** fichier dans
  `supabase/migrations/` (ne jamais modifier une migration déjà appliquée),
  testé localement (`npx supabase db reset` + `npm test`), puis `npx supabase db push`.
- Régénérez les types : `npx supabase gen types typescript --linked > src/lib/supabase/database.types.ts`.

## Environnements

| Environnement | Base | Application |
|---|---|---|
| Développement | Supabase local (`npx supabase start`) | `npm run dev` + `.env.local` |
| Préproduction (facultatif) | Second projet Supabase | Déploiements *Preview* Vercel avec leurs propres variables |
| Production | Projet Supabase de production | Déploiement *Production* Vercel |
