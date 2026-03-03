# Solution produit - THE 1000

## 1) Description produit

THE 1000 est une plateforme multi-portails:
- `Admin`: supervision globale, carte live riders/livraisons, pilotage business/riders.
- `Business`: creation de livraison, suivi live, gestion abonnement/wallet.
- `Rider`: reception d'offres, execution de mission, preuve de livraison.

Le produit cible des flux courts intra-Tanger avec visibilite temps reel et auditabilite complete.

## 2) Routes reelles du repository (URL + fichier source)

| Ecran | URL locale | Fichier source |
|---|---|---|
| Landing / choix portail | `http://localhost:3000/` | `app/page.tsx` |
| Login Admin | `http://localhost:3000/admin` | `app/admin/page.tsx` |
| Dashboard Admin | `http://localhost:3000/admin/dashboard` | `app/admin/dashboard/page.tsx` |
| Admin - Gestion users | `http://localhost:3000/admin/users` | `app/admin/users/page.tsx` |
| Login Business | `http://localhost:3000/business` | `app/business/page.tsx` |
| Dashboard Business | `http://localhost:3000/business/dashboard` | `app/business/dashboard/page.tsx` |
| Login Rider | `http://localhost:3000/rider` | `app/rider/page.tsx` |
| Dashboard Rider | `http://localhost:3000/rider/dashboard` | `app/rider/dashboard/page.tsx` |

## 3) Slots de captures ecran (a produire)

| Slot | Nom de fichier attendu | URL capture | Utilisation dossier |
|---|---|---|---|
| S01 | `S01_home_portals.png` | `/` | Vision produit / multi-portails |
| S02 | `S02_admin_login.png` | `/admin` | Preuve interface admin |
| S03 | `S03_admin_dashboard_map.png` | `/admin/dashboard` | Supervision live |
| S04 | `S04_admin_wallet_control.png` | `/admin/dashboard` | Controle financier/wallet |
| S05 | `S05_admin_users.png` | `/admin/users` | Conformite et gouvernance |
| S06 | `S06_business_login.png` | `/business` | Entree client B2B |
| S07 | `S07_business_dashboard_create_delivery.png` | `/business/dashboard` | Creation commande |
| S08 | `S08_business_live_map.png` | `/business/dashboard` | Suivi riders en direct |
| S09 | `S09_business_subscription_wallet.png` | `/business/dashboard` | Monétisation |
| S10 | `S10_rider_login.png` | `/rider` | Entree rider AE |
| S11 | `S11_rider_dashboard_offers.png` | `/rider/dashboard` | Dispatch et offres |
| S12 | `S12_rider_delivery_proof.png` | `/rider/dashboard` | OTP / preuve livraison |

Les noms ci-dessus sont egalement references dans `Annexes/Screenshot_Index.md`.

## 4) Instructions de capture

1. Lancer le projet:
```bash
npm run dev
```
2. Ouvrir `http://localhost:3000`.
3. Utiliser les identifiants demo (en mode dev):
- Admin: `admin@the1000.ma / Admin1234!`
- Business: `pharmacie@example.ma / Business1234!`
- Rider: `rider1@the1000.ma / Rider1234!`
4. Capturer en desktop (1366x768) et mobile (390x844) pour les ecrans critiques (`S07`, `S11`).
5. Sauvegarder les fichiers dans `funding-dossier/assets/screenshots/` avec les noms exacts.

## 5) Valeur apportée par le produit

- Diminution des frictions de coordination entre commerce et rider.
- Suivi live pour reduire appels/suivi manuel.
- Donnees exploitables (temps, taux de succes, productivite rider).
- Socle de controle admin pour rassurer banque/investisseur/subvention.

