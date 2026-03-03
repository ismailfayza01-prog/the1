# Dossier de financement THE 1000 - Guide d'utilisation

Ce dossier est prepare pour trois audiences:
- `Version Banque`: capacite de remboursement, reduction des risques, discipline de suivi.
- `Version Investisseur`: croissance, traction, unit economics, execution GTM.
- `Version Subvention`: formalisation des travailleurs AE, digitalisation des PME, impact mesurable.

Montant demande: **300 000 MAD**.

## 1) Structure du dossier

Documents principaux:
1. `01_Executive_Summary.md`
2. `02_Problem_Proof.md`
3. `03_Solution_Product.md`
4. `04_Operations_Workflow.md`
5. `05_Unit_Economics.md`
6. `06_GoToMarket_3_Months.md`
7. `07_Financial_Model_Assumptions.md`
8. `08_Use_of_Funds_300k.md`
9. `09_Risk_Compliance.md`

Annexes:
- `Annexes/Contract_Business_Template.md`
- `Annexes/Contract_Rider_AE_Template.md`
- `Annexes/KPI_Template.csv`
- `Annexes/Screenshot_Index.md`
- `Annexes/Real_Tests_Protocol.md`

Diagrammes Mermaid:
- `Diagrams/workflow.mmd`
- `Diagrams/unit_economics_threshold.mmd`
- `Diagrams/growth_plan_3_months.mmd`

## 2) Etapes de finalisation

1. Capturer les ecrans produits selon `Annexes/Screenshot_Index.md` et les placer dans `funding-dossier/assets/screenshots/`.
2. Inserer 3 temoignages clients reels dans `02_Problem_Proof.md`.
3. Executer le pilote de 20 livraisons selon `Annexes/Real_Tests_Protocol.md`.
4. Completer les resultats dans `Annexes/KPI_Template.csv`.
5. Mettre a jour les valeurs finales (M1-M3) dans `05`, `06`, `07`.

## 3) Rendu PDF final

## Option A - Pandoc (recommande)

Commande complete:

```bash
pandoc \
  funding-dossier/01_Executive_Summary.md \
  funding-dossier/02_Problem_Proof.md \
  funding-dossier/03_Solution_Product.md \
  funding-dossier/04_Operations_Workflow.md \
  funding-dossier/05_Unit_Economics.md \
  funding-dossier/06_GoToMarket_3_Months.md \
  funding-dossier/07_Financial_Model_Assumptions.md \
  funding-dossier/08_Use_of_Funds_300k.md \
  funding-dossier/09_Risk_Compliance.md \
  funding-dossier/Annexes/Contract_Business_Template.md \
  funding-dossier/Annexes/Contract_Rider_AE_Template.md \
  funding-dossier/Annexes/Screenshot_Index.md \
  funding-dossier/Annexes/Real_Tests_Protocol.md \
  -o funding-dossier/Funding_Dossier_THE1000_FR.pdf \
  --from gfm --toc --pdf-engine=xelatex
```

## Option B - VS Code

1. Ouvrir les fichiers dans l'ordre.
2. Utiliser une extension de type `Markdown PDF`.
3. Exporter en un seul PDF (ou fusionner les PDFs ensuite).

## 4) Variantes de remise

- `Banque`: accentuer `05`, `07`, `08`, `09` + annexes contractuelles.
- `Investisseur`: accentuer `01`, `03`, `05`, `06`, `07` + screenshots traction.
- `Subvention`: accentuer `01`, `02`, `06`, `08`, `09` + impact AE/KPI.

## 5) Donnees critiques a valider avant depot

- Nombre exact de commerces actifs (pas seulement signes) par zone.
- Taux de livraisons reussies et delais reellement observes.
- Statut administratif AE des riders (inscription, IF, attestations).
- Conditions bancaires finales (taux, differe, garanties).

