# THE 1000 Project Knowledge Base

Snapshot date: March 1, 2026
Workspace path: `/mnt/c/Users/HP/Desktop/lovable/The1`

## 1) Project summary
`the1-courier` is a Next.js + Supabase multi-portal courier platform for Tangier, Morocco.

Primary user roles:
- `admin`: platform operations, user provisioning, manual dispatch overrides, wallet credit controls.
- `business`: create/track deliveries, manage subscription and wallet.
- `rider`: go online/offline, receive offers, execute pickup/dropoff flow, PoD (OTP/photo), route navigation.

Main functional domains:
- Role-based authentication and portal access.
- Delivery lifecycle (pending -> offered -> accepted -> picked_up -> in_transit -> delivered/cancelled/expired).
- Dispatch and rider assignment.
- Subscription + wallet charging/crediting.
- Admin user management and audit logging.
- Live map + rider presence + navigation API fallback links.

## 2) Tech stack
- Framework: Next.js App Router (`app/`)
- UI: React + TypeScript
- Styling: Tailwind CSS v4 + custom CSS variables + custom map marker animations
- Data/auth/realtime/storage: Supabase
- Mapping: Leaflet (OpenStreetMap tiles)
- Routing provider: OSRM public endpoint (`router.project-osrm.org`)
- Analytics: `@vercel/analytics`

Important package choices:
- `next` and `react` are set to `latest` (high update volatility).
- Supabase client split:
  - browser client (`lib/supabase/client.ts`)
  - server cookie client (`lib/supabase/server.ts`)
  - service-role admin client (`lib/supabase/admin.ts`)

## 3) Repository structure (active code)
- `app/`
- `components/`
- `lib/`
- `public/`
- `scripts/`
- `supabase/`

Key app pages:
- `app/page.tsx`: landing page with portal entry cards.
- `app/admin/page.tsx`: admin login.
- `app/admin/dashboard/page.tsx`: admin operations dashboard.
- `app/admin/users/page.tsx`: admin user management UI.
- `app/business/page.tsx`: business login.
- `app/business/dashboard/page.tsx`: business dashboard.
- `app/rider/page.tsx`: rider login.
- `app/rider/dashboard/page.tsx`: rider dashboard.

API routes:
- `app/api/admin/users/create/route.ts`
- `app/api/admin/users/list/route.ts`
- `app/api/admin/users/disable/route.ts`
- `app/api/admin/users/delete/route.ts`
- `app/api/admin/users/resend-invite/route.ts`
- `app/api/navigation/route/route.ts`
- `app/api/rider/status/route.ts`

Core libs:
- `lib/storage.ts`: client-side service layer for users/businesses/riders/deliveries/transactions.
- `lib/types.ts`: shared domain types + pricing/subscription/commission helpers.
- `lib/admin/auth.ts`: admin guard for API routes.
- `lib/admin/audit.ts`: write admin actions to audit logs.
- `lib/navigation/osrm.ts`: route fetch + fallback links.

## 4) Authentication and authorization model
- Supabase Auth handles identity.
- `profiles` and `user_roles` tables hold app role metadata.
- Middleware (`middleware.ts`) enforces portal route access by role.
- Admin APIs use `requireAdminRequest()` guard.
- RLS policies + SQL helper functions back role-based data visibility/mutations.

## 5) Delivery flow model
- Business creates delivery with metadata (pickup/dropoff addresses, contact, note, optional coordinates).
- Dispatch attempts rider offer/assignment via RPC.
- Rider accepts offer or admin manually assigns.
- Rider progresses status through pickup and transit.
- Delivery completion is guarded by DB triggers/RPC rules (PoD/COD/wallet safety).
- Business and admin observe updates via realtime subscriptions + periodic refresh.

## 6) Data model overview (Supabase)
Primary tables introduced/used:
- `profiles`
- `businesses`
- `riders`
- `deliveries`
- `transactions`
- `rider_locations`
- `delivery_offers`
- `user_roles`
- `admin_audit_logs`

Notable DB functions/RPCs:
- `use_ride`, `charge_wallet`
- `accept_delivery`, `dispatch_delivery`, `rider_accept_offer`, `rider_refuse_offer`
- `set_delivery_otp`, `verify_delivery_otp`, `submit_delivery_photo`
- `mark_cod_collected`
- `admin_provision_user`, `admin_assign_delivery`, `admin_override_delivery_status`
- Guard/validation triggers for transition safety and wallet protections

## 7) Migrations timeline (high level)
- `001`: initial schema + base RLS + core transition function.
- `002`: subscription/wallet atomic functions.
- `003`: profile role hardening and simplified RLS policies.
- `004`: rider realtime location columns.
- `005`: dispatch offers table + dispatch/offer RPCs.
- `006`: PoD (OTP/photo) schema + enforcement.
- `007`: COD support + unified completion guard.
- `008`: admin provisioning + role map + audit logs.
- `009`/`010`: delivery metadata + admin override/safety adjustments.
- `011`: reconciliation patch for live MVP consistency.
- `012`: dispatch reliability patch (explicit no-rider behavior).
- `013`: admin-only wallet credit controls.
- `014`: deliveries column grants fix for anon/authenticated roles.

## 8) Realtime and mapping behavior
- Leaflet maps in admin/business/rider dashboards.
- Realtime subscriptions on `riders`, `businesses`, `deliveries` where relevant.
- Rider geolocation updates presence and last known coordinates.
- Route API (`/api/navigation/route`) adds:
  - in-memory cache (60s)
  - per-client rate limit (60 req/min)
  - fallback Google Maps/Waze links

## 9) Environment variables in use
Required or referenced:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` (fallback for publishable key)
- `SUPABASE_SERVICE_ROLE_KEY` (server/admin APIs)
- `NEXT_PUBLIC_ROUTING_ENABLED` (route module behavior toggle)
- `NODE_ENV`

Script/test-only env vars also exist in `scripts/` (for smoke tests and seeded logins).

## 10) Local/test scripts
- `scripts/test-admin-list-users.js`
- `scripts/test-admin-create-user.js`
- `scripts/smoke-production.js`
- `scripts/test-wallet-guard.js`
- `scripts/test-cod.js`
- `scripts/test-pod-otp.js`
- `scripts/test-pod-photo.js`

These scripts perform auth/login and exercise real API/RPC behavior against configured Supabase/project URLs.

## 11) Cleanup performed in this pass
Deleted generated/local artifact paths:
- `.next/`
- `node_modules/`
- `.playwright-mcp/`
- `.tools/`
- `.vercel/`
- `supabase/.temp/`
- top-level `*.log`
- `tsconfig.tsbuildinfo`
- `node-win-ok.txt`

Updated `.gitignore` to reduce future repo clutter:
- added ignores for `.playwright-mcp/`, `.tools/`, `supabase/.temp/`, `*.log`, and `node-win-ok.txt`
- removed duplicate `.vercel` line noise

## 12) Files that look non-runtime but were intentionally kept
These are not currently imported by app code, but may be reference/design/business assets:
- `design-preview.html`
- `design-preview-full.png`
- `the1000-admin.jsx` (legacy standalone mock/component)
- branding prompt output files (root image/svg files)
- `funding-dossier/` documents

## 13) Observed technical risks / debt
- `next`/`react` pinned to `latest` can break reproducibility.
- `README.md` is generic and partially outdated relative to actual capabilities.
- Very large root-level non-code assets reduce repo signal.
- `next-env.d.ts` is ignored in `.gitignore` while present; team should confirm intended policy.
- Some UI class names in `app/page.tsx` are generated dynamically (`bg-${...}` style), which can be fragile with utility class extraction.

## 14) Practical runbook
Install and run:
```bash
npm install
npm run dev
```

Build/start:
```bash
npm run build
npm run start
```

Admin API smoke scripts require valid env vars + credentials.

## 15) Bottom line
This repository is an active MVP-grade logistics platform with substantial feature coverage (auth roles, dispatching, PoD/COD, admin controls, realtime maps). The codebase is functional but has operational cleanup and maintainability opportunities, now partially addressed by this cleanup pass and ignore hardening.

## 16) Latest compatibility and deploy validation (March 1, 2026)
- Ambiguous/reference assets were kept (not deleted).
- Next.js compatibility:
  - Migrated `middleware.ts` to `proxy.ts` to align with Next 16 file convention.
  - Build validates under Next `16.1.6` with App Router routes and API routes generated correctly.
- Linting compatibility:
  - `next lint` is no longer reliable on Next 16 in this setup.
  - Lint script was switched to direct ESLint invocation.
  - Added `.eslintrc.json` (Next core-web-vitals + typescript preset).
  - Current lint still reports existing code-quality issues (`any`, unescaped entities, require-import style in scripts), but this does not block production build/deploy.
- Supabase compatibility:
  - Environment variable keys are present for URL/anon/publishable/service-role.
  - Live SDK probe against `profiles` table succeeded (`supabase_probe:ok`).
- Vercel validation:
  - Local `vercel build` succeeded (preview and production prebuilt artifacts).
  - Production deploy succeeded from prebuilt output.
  - Active URLs observed during deploy:
    - `https://the1courier-build2-y71zu016a-ismailfayza01-progs-projects.vercel.app`
    - `https://the1courier-build2.vercel.app`

## 17) Rider access incident fixes (March 1, 2026)
- Symptom: riders can authenticate but appear stuck/blank or fail to change online status.
- Root causes identified:
  - Rider dashboard returned `null` when a `profiles(role='rider')` user had no matching `public.riders` row.
  - `proxy.ts` only used `NEXT_PUBLIC_SUPABASE_ANON_KEY`; deployments using only `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY` could break protected-route auth.
  - `app/api/rider/status` depended on service-role client path for token fallback, making status updates fragile when `SUPABASE_SERVICE_ROLE_KEY` was not configured.
- Fixes applied in code:
  - Rider dashboard now shows explicit loading/error states instead of silent blank screen.
  - Added rider access recovery flow (`Retry access`) in UI.
  - Added `riderService.ensureCurrentUserProfile()` and auto-recovery attempts.
  - Added Supabase migration `015_ensure_rider_profile.sql` with `public.ensure_rider_profile()` RPC to self-heal missing rider rows for authenticated rider users.
  - Updated `proxy.ts` to use publishable-key fallback (`PUBLISHABLE_DEFAULT_KEY` -> `ANON_KEY`).
  - Updated `/api/rider/status` to use bearer-session client with publishable key (no service-role dependency for rider status updates).

## 18) Vercel env checklist for rider connectivity
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY` (preferred) or `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` is still required for admin APIs (`/api/admin/users/*`), but rider status path no longer depends on it.
- After deploy, ensure migration `015_ensure_rider_profile.sql` is applied in Supabase.

## 19) 3D map system (MapLibre + MapTiler) rollout
- New map stack added for rider, business, and admin dashboards:
  - `components/maps/Map3DBase.tsx`
  - `components/maps/layers.ts`
  - `components/maps/RiderMap3D.tsx`
  - `components/maps/BusinessMap3D.tsx`
  - `components/maps/AdminMap3D.tsx`
  - `components/maps/config.ts`
- Existing Leaflet maps are kept as runtime fallback.
- Feature flag:
  - `NEXT_PUBLIC_MAP_3D_ENABLED=true` => use MapLibre 3D maps.
  - `NEXT_PUBLIC_MAP_3D_ENABLED=false` => use legacy Leaflet maps.
- Added map envs:
  - `NEXT_PUBLIC_MAPTILER_KEY`
  - `NEXT_PUBLIC_MAP_STYLE_URL` (optional override)
  - `NEXT_PUBLIC_MAP_DEFAULT_PITCH` (default `45`)
  - `NEXT_PUBLIC_MAP_DEFAULT_BEARING` (default `12`)
- Traffic layer remains deferred to v2; routing API contract is unchanged.
