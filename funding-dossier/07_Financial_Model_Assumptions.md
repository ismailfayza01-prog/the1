# Hypotheses du modele financier (24 mois)

## 1) Parametres de base

| Hypothese | Valeur base |
|---|---:|
| Jours operationnels/mois | 26 |
| Prix moyen/livraison | 22 MAD |
| Commission rider moyenne | 15 MAD |
| Couts variables plateforme/livraison | 1,8 MAD |
| Marge contribution/livraison | 5,2 MAD |
| Churn commerces mensuel (base) | 2,0% |
| Taux de succes livraison cible M3+ | >= 95% |

Formules cle:
- `Livraisons/mois = Commerces actifs x Livraisons/commerce/jour x 26`
- `CA = Livraisons/mois x 22`
- `Contribution = Livraisons/mois x 5,2`
- `EBITDA = Contribution - Couts fixes`

## 2) Rampe base (M1 -> M24)

| Mois | Commerces actifs | Liv./commerce/jour | Livraisons/mois | CA mensuel | Couts fixes | EBITDA estime |
|---|---:|---:|---:|---:|---:|---:|
| M1 | 100 | 1,2 | 3 120 | 68 640 MAD | 85 000 MAD | -68 776 MAD |
| M3 | 380 | 1,9 | 18 772 | 412 984 MAD | 95 000 MAD | 2 614 MAD |
| M6 | 520 | 2,0 | 27 040 | 594 880 MAD | 110 000 MAD | 30 608 MAD |
| M12 | 760 | 2,1 | 41 496 | 912 912 MAD | 130 000 MAD | 85 779 MAD |
| M24 | 1 000 | 2,2 | 57 200 | 1 258 400 MAD | 150 000 MAD | 147 440 MAD |

## 3) Scenarios M24

| Scenario | Commerces actifs | Liv./commerce/jour | Livraisons/mois | CA mensuel | Couts fixes | EBITDA mensuel |
|---|---:|---:|---:|---:|---:|---:|
| Prudent | 700 | 1,8 | 32 760 | 720 720 MAD | 120 000 MAD | 50 352 MAD |
| Base | 1 000 | 2,2 | 57 200 | 1 258 400 MAD | 150 000 MAD | 147 440 MAD |
| Agressif | 1 300 | 2,5 | 84 500 | 1 859 000 MAD | 180 000 MAD | 259 400 MAD |

## 4) Hypotheses de financement et remboursement (angle banque)

Illustration credit:
- Montant: 300 000 MAD
- Taux annuel: 7%
- Duree: 36 mois
- Mensualite indicative: **9 263 MAD**

Lecture capacite:
- En base, des M3-M4 la contribution devient positive et monte progressivement.
- A 400 commerces et plus, la marge operationnelle couvre la mensualite avec buffer.
- Discipline imposee: reserve de securite >= 2 mensualites et suivi hebdo des KPI cash.

## 5) Sensibilites a suivre

| Variable sensible | Impact si degradation | Action corrective |
|---|---|---|
| Prix moyen/livraison | Baisse marge unitaire | Rebalancer mix abonnement/wallet/payg |
| Livraisons/rider/jour | Revenu rider moins attractif | Densifier zones et horaires de pointe |
| Churn commerces | Freine la rampe de volume | Renforcer onboarding et support compte |
| Delai moyen livraison | Risque satisfaction/retention | Pilotage SLA par zone + allocation rider |
| Incidents COD/cash | Risque liquidite/reputation | Reconciliation journaliere et plafonds |

## 6) Angle investisseur / subvention

## Investisseur
- Levier de valeur: repetition d'usage + densite locale.
- KPI prioritaire: croissance commerces actifs et marge contribution totale.

## Subvention
- Impact mesurable: nombre d'AE actifs, stabilite revenu rider, nombre de commerces digitalises.
- Le modele prouve que l'appui initial accelere une activite economique formalisee et traçable.

