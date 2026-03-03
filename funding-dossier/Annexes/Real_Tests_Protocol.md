# Protocole de tests reels - 20 livraisons

## 1) Objectif

Valider sur terrain la performance operationnelle avant depot final du dossier de financement.

## 2) Perimetre

- Ville: Tanger.
- Volume: **20 livraisons reelles**.
- Segments: pharmacie, restauration/cafe, epicerie/detail.
- Riders: AE actifs (minimum 8 riders mobilises).
- Zones: Z1 a Z4 (selon plan GTM).

## 3) Design de l'echantillon

| Type de test | Nombre |
|---|---:|
| Heures creuses | 8 |
| Heures pointe midi/soir | 8 |
| Conditions trafic dense | 4 |
| **Total** | **20** |

Repartition recommandee:
- 5 commerces differents minimum.
- 4 zones minimum.
- Aucun rider > 40% des tests.

## 4) Procedure pas a pas

1. Preparer les commerces participants (brief + consentement).
2. Verifier comptes riders et disponibilites.
3. Lancer les commandes depuis `/business/dashboard`.
4. Executer dispatch et livraison normale.
5. Capturer tous les timestamps dans `Annexes/KPI_Template.csv`.
6. Collecter satisfaction business (note 1-5) juste apres livraison.
7. Documenter tout incident (cause, action corrective, delai impact).

## 5) KPI obligatoires

- Temps creation -> acceptation.
- Temps pickup -> livraison.
- Taux de succes 1ere tentative.
- Taux annulation/incidents.
- Livraisons/rider/jour durant le test.
- Satisfaction business moyenne.

## 6) Critere de passage (Go/No-Go)

| Indicateur | Seuil Go |
|---|---:|
| Taux succes livraison | >= 95% |
| Delai median pickup->dropoff | <= 35 min |
| Creation->acceptation median | <= 3 min |
| Satisfaction business moyenne | >= 4,2 / 5 |
| Incidents critiques non resolus | 0 |

## 7) Rendu attendu

- Fichier KPI rempli (`Annexes/KPI_Template.csv`).
- 1 page synthese resultats (forces/faiblesses/actions).
- 3 enseignements operationnels immediats.
- Plan correctif 14 jours pour KPI sous seuil.

## 8) Gouvernance test

- Responsable test: [Nom].
- Responsable qualite donnees: [Nom].
- Date execution: [Date].
- Date revue finale: [Date].

