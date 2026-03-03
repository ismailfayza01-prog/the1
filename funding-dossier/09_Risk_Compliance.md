# Risques, conformite et gouvernance

## 1) Statut riders: AE, non-salaries

Principe contractuel non-negociable:
- Les riders operent comme **Auto-Entrepreneurs independants**.
- Ils ne sont pas des employes de THE 1000.

Implications:
- Pas de lien de subordination salariale permanent.
- Pas d'horaires imposes de type contrat de travail.
- Facturation/prestation selon missions realisees.
- Liberté d'organisation (dans le cadre des SLA de mission acceptee).

Action: utiliser `Annexes/Contract_Rider_AE_Template.md` et validation par avocat local.

## 2) Matrice de risques

| Risque | Probabilite | Impact | Mitigation |
|---|---|---|---|
| Requalification rider en salarie | Moyen | Eleve | Contrat AE robuste, process operationnel coherent avec independance |
| Accident / dommage en course | Moyen | Eleve | Assurance RC pro, procedure incident, preuves de mission |
| Retard systematique livraisons | Moyen | Eleve | Pilotage SLA par zone, backup dispatch, escalation admin |
| Incident donnees personnelles | Faible-Moyen | Eleve | Controle acces role-based, minimisation donnees, politique retention |
| Fraude cash/COD | Moyen | Moyen-Eleve | Reconciliation journaliere, plafonds, preuves encaissement |
| Concentration sur peu de commerces | Moyen | Moyen | Diversification portefeuille clients, quotas segment |
| Interruption technique | Faible-Moyen | Moyen | Plan degrade operationnel + reprise et reconciliation |

## 3) Responsabilite, assurance, clauses contractuelles

A cadrer dans les contrats:
- Limites de responsabilite service.
- Force majeure et indisponibilite technique.
- Obligation de moyens sur delais, pas garantie absolue de resultat.
- Procedure claire de reclamation et de compensation plafonnee.

Assurances recommandees:
- RC exploitation (societe).
- RC professionnelle pour activite livraison.
- Option accident individuelle riders (selon cout/benefice).

## 4) Donnees personnelles et securite

Cadre a respecter (validation juridique locale):
- Loi marocaine 09-08 (protection des donnees) et exigences CNDP applicables.

Mesures minimales:
- Segmentation des acces (admin/business/rider).
- Journalisation actions sensibles (assignation, status override, wallet).
- Conservation limitee des donnees personnelles.
- Process de suppression/anonymisation sur demande conforme.

## 5) AML / cash / COD (si applicable)

Si gestion de fonds (COD notamment):
- KYC business minimal a l'onboarding.
- Ticketing obligatoire par livraison et remise fin de shift.
- Reconciliation quotidienne (collecte vs reversement).
- Escalade immediate en cas d'ecart non justifie.
- Alignement avec obligations locales de lutte anti-blanchiment (cadre marocain applicable, ex. loi 43-05 selon cas d'usage).

## 6) Controles de gouvernance (angle banque)

- Revue hebdomadaire KPI operations + cash.
- Revue mensuelle risques + incidents + plans correctifs.
- Dossier d'audit simple: contrats, logs admin, fichiers KPI, reconciliations.

## 7) Check conformite pre-financement

| Element | Statut attendu |
|---|---|
| Contrat business standard valide juridiquement | Pret |
| Contrat rider AE standard valide juridiquement | Pret |
| Politique data interne formalisee | Pret |
| Procedure incident/cash/COD ecrite | Pret |
| Assurance RC active | Pret |

