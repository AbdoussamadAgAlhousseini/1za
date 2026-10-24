# Contrôle d'accès sans réseau (mode hors ligne)

Les agents peuvent vérifier les abonnements et enregistrer les entrées et sorties
même sans connexion Internet. Le principe reprend celui de l'appel hors ligne de
LAKOL (page mise en cache, file d'opérations renvoyée au retour du réseau), avec
en plus une vérification locale des abonnements.

## Pour l'agent

1. **Une fois par jour, avec du réseau** : ouvrir le poste de contrôle. Le
   téléphone télécharge automatiquement les abonnements (toutes les 10 minutes
   tant qu'il y a du réseau). L'indicateur affiche « Hors ligne prêt · données de HH:MM ».
2. **Sans réseau** : l'application (installée sur l'écran d'accueil) s'ouvre
   quand même. La vérification fonctionne comme d'habitude ; le verdict porte la
   mention **« Vérification hors ligne »**. Les entrées et sorties sont
   enregistrées sur le téléphone (« X opération(s) en attente »).
3. **Au retour du réseau** : envoi automatique (ou bouton « Envoyer »). Si une
   opération est refusée par le serveur, elle s'affiche en rouge : la signaler au
   responsable.
4. **Ne pas se déconnecter** tant que des opérations sont en attente :
   l'application l'empêche pour ne rien perdre.

Limites pour l'agent :

- les données hors ligne sont valables **24 heures** (réglable dans Paramètres) ;
  au-delà, la vérification hors ligne est bloquée ;
- un abonnement créé ou renouvelé après le dernier téléchargement n'est pas connu
  hors ligne (le sportif apparaît « sans abonnement valide connu ») ;
- hors ligne, les compteurs et la liste des présents ne sont pas actualisés ;
- l'heure enregistrée est celle du téléphone : il doit être à l'heure.

## Pour l'administrateur

- Les passages faits hors ligne portent le badge **« Hors ligne »** dans
  Fréquentation et sont comptés dans les statistiques une fois synchronisés.
- Les opérations **non appliquées** (abonnement non valide à cette date, entrée
  déjà ouverte, sortie sans entrée, matricule inconnu, heure incohérente) sont
  listées en haut de **Fréquentation**, avec une alerte sur le tableau de bord.
  Après vérification : **Marquer vérifiée** avec une note (journalisé).
- Réglage : Paramètres → « Validité des données hors ligne (heures) », 1 à 72.

## Fonctionnement technique

| Élément | Détail |
|---|---|
| Instantané | `control_offline_snapshot()` : pour chaque abonnement utile, `SHA-256(sel ‖ matricule)`, dates, état, formule ; entrées ouvertes (hachées) ; sel aléatoire par instantané ; date d'expiration. Stocké dans IndexedDB. |
| Vérification locale | `src/lib/offline/verify.ts` : même règle que le serveur (abonnement de référence, fin incluse, fuseau du stade), présence = entrées connues + opérations en attente. Testée unitairement, y compris la parité du hachage avec PostgreSQL. |
| File d'attente | IndexedDB, une opération = `{ id (UUID), type, matricule, heure }`. |
| Synchronisation | `control_sync_offline(ops)` : idempotente (identifiant), opérations traitées dans l'ordre chronologique, revalidation complète, résultat par opération ; journal `offline.synced`. |
| Page hors ligne | Service worker : `/controle` en réseau d'abord / cache en secours ; scripts Next.js conservés ; cache vidé à la déconnexion ou au retour sur la page de connexion. |
| Tests | Unitaires (`tests/unit/offline.test.ts`), base (`tests/db/offline.test.ts`), bout en bout (`e2e/controle.spec.ts`) ; scénario complet vérifié en navigateur avec le service worker de production (rechargement de la page sans réseau). |
