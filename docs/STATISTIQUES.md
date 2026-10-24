# Statistiques : définitions et règles de calcul

Toutes les statistiques sont **calculées dans PostgreSQL** à partir des données
enregistrées (fonctions `stats_*`), jamais simulées ni calculées dans le navigateur.

## Référentiel temporel

- **Fuseau horaire** : celui des paramètres (par défaut `Africa/Bamako`, UTC+0).
- **Aujourd'hui** : `app_today()` = date locale du stade.
- **Semaine** : du lundi au dimanche (ISO 8601), semaine en cours jusqu'à aujourd'hui.
- **Mois** : mois civil en cours jusqu'à aujourd'hui.
- Un passage est rattaché à la **date locale de son entrée** (une visite entamée
  à 23 h 30 et terminée à 0 h 30 compte pour le jour de l'entrée).

## Définitions

| Indicateur | Définition |
|---|---|
| **Entrée** | Passage enregistré, non annulé. |
| **Sportifs uniques** | Nombre de matricules distincts parmi les entrées de la période. Sur une période de plusieurs jours, ce n'est **pas** la somme des sportifs uniques de chaque jour. |
| **Visite terminée** | Passage dont la sortie a été enregistrée (ou corrigée par l'administrateur). |
| **Visite en cours / présent** | Passage ouvert (entrée sans sortie). |
| **Durée d'une visite** | Sortie − entrée, en secondes (colonne calculée `duration_seconds`). Uniquement pour les visites terminées. |
| **Durée moyenne / cumulée** | Moyenne / somme des durées des visites terminées de la période. Les visites en cours et annulées sont exclues. |
| **Passage annulé** | Exclu de **toutes** les statistiques (reste visible dans l'historique). |
| **Entrée anormalement longue** | Visite ouverte depuis plus de N heures (paramètre, 6 h par défaut). |

## Statut d'abonnement d'un sportif

Calcul serveur (`subscription_validity`, vue `athlete_overview`) :

1. L'**abonnement de référence** est, dans l'ordre : celui qui couvre aujourd'hui,
   sinon le prochain à venir, sinon le dernier terminé (abonnements annulés ignorés).
2. Statut :
   - **Actif** : début ≤ aujourd'hui ≤ fin (fin **incluse**, jusqu'à 23 h 59 heure du stade) ;
   - **Suspendu** : couvre aujourd'hui mais suspendu par l'administration ;
   - **Pas encore valide** : début dans le futur ;
   - **Expiré** : fin dépassée ;
   - **Sans abonnement** : aucun abonnement non annulé.
3. **Expire bientôt** : actif, se terminant dans moins de N jours (paramètre,
   7 par défaut) **et** sans abonnement suivant déjà enregistré.

Deux abonnements non annulés d'un même sportif ne peuvent pas se chevaucher : le
statut est donc toujours non ambigu.

## Indicateurs par écran

| Écran | Indicateurs |
|---|---|
| Tableau de bord (`stats_dashboard`) | Entrées / sportifs uniques / visites terminées du jour ; présents ; entrées et uniques de la semaine et du mois ; durée moyenne du mois ; répartition des sportifs par statut ; nouveaux abonnements et renouvellements créés ce mois ; paiements enregistrés ce mois. |
| Fiche sportif (`stats_athlete`) | Visites aujourd'hui / semaine / mois / depuis l'inscription ; visites terminées ; durée cumulée et moyenne ; dernière visite ; présence actuelle ; graphique 60 jours. |
| Rapports (`stats_period_summary`, `stats_attendance`, `stats_peak_hours`, `stats_agents`, `stats_revenue`) | Synthèse de la période ; série par jour / semaine / mois (périodes vides incluses à 0) ; entrées par jour de semaine × heure ; entrées et sorties enregistrées par agent ; paiements par formule et devise. |

Notes :
- Dans les rapports, « nouveaux abonnements » et « renouvellements » sont comptés
  selon leur **date de début** dans la période ; dans le tableau de bord, selon leur
  **date de saisie** dans le mois en cours.
- Les recettes ne comprennent que les paiements **enregistrés manuellement** et non annulés.
- La carte des heures de pointe affiche 5 h – 23 h ; les entrées hors de cette plage sont signalées.
