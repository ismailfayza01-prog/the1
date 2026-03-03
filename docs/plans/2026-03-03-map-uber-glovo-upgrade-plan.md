# Map Uber/Glovo/InDrive Upgrade — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make the rider and business map experience feel like Glovo/InDrive/Uber with live ETA countdown overlaid on the map, next maneuver chip, camera auto-follow with heading rotation, and a business-side rider ETA card.

**Architecture:** Navigation Overlay approach — the map card grows taller and two absolute-positioned panels float on top of it (next maneuver chip top-left, ETA bar bottom). A `useRef`-backed interval counts down ETA seconds. `RiderMap3D` gains bearing computation and `map.easeTo()` on each GPS update. The business portal adds an inline `EtaCountdownCard` component with its own OSRM fetch + countdown.

**Tech Stack:** Next.js App Router, React, TypeScript, MapLibre GL (RiderMap3D), Leaflet (fallback), OSRM via `/api/navigation/route`, Tailwind CSS v4.

**Design doc:** `docs/plans/2026-03-03-map-uber-glovo-upgrade-design.md`

---

## Pre-flight checks

Before starting, verify the app builds and the existing routing works:

```bash
npm run build
```

Expected: no TypeScript errors. If there are pre-existing errors, note them but do not fix them — they are out of scope.

---

## Task 1: ETA Countdown State — Rider Dashboard

**Files:**
- Modify: `app/rider/dashboard/page.tsx`

This task adds the countdown state and the interval that ticks it down. No UI yet — just the data layer.

### Step 1: Add countdown state and ref

In `app/rider/dashboard/page.tsx`, find the block of `useState` declarations near the top of `RiderDashboardPage` (around line 317). Add these two lines **after** the existing `navigationRoute` and `navigationLoading` states:

```tsx
const [etaCountdownSeconds, setEtaCountdownSeconds] = useState<number | null>(null);
const etaIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
```

### Step 2: Add the countdown effect

Find the existing navigation route `useEffect` (the one that starts with `if (!ROUTING_ENABLED || !rider)` — around line 608). Add a **new, separate** `useEffect` directly after it:

```tsx
// ETA countdown — ticks down from navigationRoute.duration_s
useEffect(() => {
  if (etaIntervalRef.current) {
    clearInterval(etaIntervalRef.current);
    etaIntervalRef.current = null;
  }

  if (!navigationRoute?.ok || !navigationRoute.duration_s) {
    setEtaCountdownSeconds(null);
    return;
  }

  setEtaCountdownSeconds(navigationRoute.duration_s);

  etaIntervalRef.current = setInterval(() => {
    setEtaCountdownSeconds((prev) => {
      if (prev === null || prev <= 0) return 0;
      return prev - 1;
    });
  }, 1000);

  return () => {
    if (etaIntervalRef.current) {
      clearInterval(etaIntervalRef.current);
      etaIntervalRef.current = null;
    }
  };
}, [navigationRoute]);
```

### Step 3: Add a helper function for countdown formatting

Near the existing `formatDurationSeconds` function (around line 55), add this new helper:

```tsx
function formatEtaCountdown(seconds: number): string {
  const safe = Math.max(0, Math.round(seconds));
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  if (m === 0) return `${s} sec`;
  return `${m} min ${s.toString().padStart(2, '0')} sec`;
}
```

### Step 4: Verify — no runtime errors

Run the dev server and open the rider dashboard in the browser. Check the browser console for errors. The countdown won't be visible yet — that's expected.

```bash
npm run dev
```

### Step 5: Commit

```bash
git add app/rider/dashboard/page.tsx
git commit -m "feat(rider): add ETA countdown state and interval"
```

---

## Task 2: Map Overlay Layout — Rider Dashboard

**Files:**
- Modify: `app/rider/dashboard/page.tsx`

This task makes the map taller and adds the two overlay panels.

### Step 1: Make the map card taller

Find the `<div className="h-64 rounded-2xl border border-border overflow-hidden bg-slate-50">` (around line 1128). Change it to:

```tsx
<div className="h-[420px] rounded-2xl border border-border overflow-hidden bg-slate-50 relative">
```

The key changes:
- `h-64` → `h-[420px]`
- Add `relative` so absolute children position correctly

### Step 2: Add the Next Maneuver overlay

Inside the same div, **before** the `{MAP_3D_ENABLED ? (` block, add:

```tsx
{/* Next maneuver chip — top-left overlay */}
{navigationRoute?.ok && routeSteps.length > 0 && (
  <div className="absolute top-3 left-3 z-10 max-w-[75%]">
    <div className="flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 shadow-lg border border-slate-100">
      <Navigation className="h-3.5 w-3.5 text-sky-600 flex-shrink-0" />
      <span className="text-xs font-semibold text-foreground truncate">
        {routeSteps[0].instruction}
      </span>
      <span className="text-xs text-muted-foreground flex-shrink-0 ml-1">
        · {formatDistanceMeters(routeSteps[0].distance_m)}
      </span>
    </div>
  </div>
)}
```

### Step 3: Add the ETA bar overlay

Inside the same div, **after** the map component block (after the closing `)}` of the map), add:

```tsx
{/* ETA bar — bottom overlay */}
{navigationRoute?.ok && etaCountdownSeconds !== null && (
  <div className="absolute bottom-3 left-3 right-3 z-10">
    <div className="flex items-center justify-between rounded-xl bg-gray-900/85 backdrop-blur-sm px-4 py-2.5 text-white shadow-lg">
      <div className="flex items-center gap-2">
        <Circle className="h-3.5 w-3.5 text-emerald-400 animate-pulse flex-shrink-0" />
        <span className="text-sm font-bold tabular-nums">
          {formatEtaCountdown(etaCountdownSeconds)}
        </span>
      </div>
      <span className="text-xs text-white/70 font-medium">
        {formatDistanceMeters(navigationRoute.distance_m)}
      </span>
    </div>
  </div>
)}
```

### Step 4: Verify the overlay renders

Open the rider dashboard while the rider has an active delivery with a valid route. You should see:
- A white pill chip at the top-left of the map with the first step
- A dark frosted bar at the bottom of the map with the countdown ticking

If no active delivery exists in dev, check that the overlay divs render without crashing when `navigationRoute` is null (they should be hidden by the conditional).

### Step 5: Commit

```bash
git add app/rider/dashboard/page.tsx
git commit -m "feat(rider): add next maneuver + ETA overlay on map"
```

---

## Task 3: Simplify Navigation Card Below the Map — Rider Dashboard

**Files:**
- Modify: `app/rider/dashboard/page.tsx`

The ETA + distance are now in the map overlay. Remove the duplicated grid from the navigation card below.

### Step 1: Remove the Distance/Duree/ETA grid

Find the `<div className="grid grid-cols-3 gap-2">` inside the navigation card (around line 1195). This renders the three boxes for Distance, Duree, and ETA. **Delete the entire block:**

```tsx
{navigationRoute?.ok && (
  <div className="grid grid-cols-3 gap-2">
    <div className="rounded-xl bg-white border border-sky-100 p-2.5 text-center">
      <p className="text-[11px] text-muted-foreground">Distance</p>
      <p className="text-sm font-bold text-foreground">{formatDistanceMeters(navigationRoute.distance_m)}</p>
    </div>
    <div className="rounded-xl bg-white border border-sky-100 p-2.5 text-center">
      <p className="text-[11px] text-muted-foreground">Duree</p>
      <p className="text-sm font-bold text-foreground">{formatDurationSeconds(navigationRoute.duration_s)}</p>
    </div>
    <div className="rounded-xl bg-white border border-sky-100 p-2.5 text-center">
      <p className="text-[11px] text-muted-foreground">ETA</p>
      <p className="text-sm font-bold text-foreground">
        {new Date(navigationRoute.eta_iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
      </p>
    </div>
  </div>
)}
```

### Step 2: Verify the navigation card still renders

The navigation card should now show only: the target address box, the loading state, the navigation error (if any), the steps list, and the external links (Google Maps / Waze). Confirm nothing else broke.

### Step 3: Commit

```bash
git add app/rider/dashboard/page.tsx
git commit -m "feat(rider): remove redundant ETA grid from nav card (now in map overlay)"
```

---

## Task 4: Camera Auto-Follow + Heading Rotation — RiderMap3D

**Files:**
- Modify: `components/maps/RiderMap3D.tsx`

This task makes the MapLibre map smoothly rotate and pan to follow the rider's direction of travel.

### Step 1: Add the prevLocation ref

In `RiderMap3D`, after the existing `const [mapReady, setMapReady] = useState(false);` line, add:

```tsx
const prevLocationRef = useRef<{ lat: number; lng: number } | null>(null);
```

### Step 2: Add a bearing computation helper

Add this helper function **inside** the `RiderMap3D` function body, before the `useEffect` blocks:

```tsx
function computeBearing(from: { lat: number; lng: number }, to: { lat: number; lng: number }): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLng = toRad(to.lng - from.lng);
  const lat1 = toRad(from.lat);
  const lat2 = toRad(to.lat);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  const y = Math.sin(dLng) * Math.cos(lat2);
  const bearing = Math.atan2(y, x) * (180 / Math.PI);
  return (bearing + 360) % 360;
}
```

### Step 3: Add the camera-follow effect

Add a new `useEffect` in `RiderMap3D`, after the existing data-rendering effect (the one that calls `upsertGeoJsonSource`). This effect fires on `liveLocation` changes:

```tsx
// Camera auto-follow with heading rotation
useEffect(() => {
  if (!mapReady || !mapRef.current) return;

  const map = mapRef.current;
  const riderLocation = liveLocation ?? getRiderLocation(rider);
  const hasActiveDelivery = !!(activeDelivery ?? assignedDelivery);

  let bearing = 0;
  const MIN_MOVE_METERS = 5;

  if (prevLocationRef.current && liveLocation) {
    const toRad = (d: number) => (d * Math.PI) / 180;
    const earth = 6_371_000;
    const dLat = toRad(liveLocation.lat - prevLocationRef.current.lat);
    const dLng = toRad(liveLocation.lng - prevLocationRef.current.lng);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(prevLocationRef.current.lat)) *
        Math.cos(toRad(liveLocation.lat)) *
        Math.sin(dLng / 2) ** 2;
    const distMoved = earth * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    if (distMoved >= MIN_MOVE_METERS) {
      bearing = computeBearing(prevLocationRef.current, liveLocation);
    } else {
      // Not enough movement — keep existing bearing
      bearing = map.getBearing();
    }
  }

  if (liveLocation) {
    prevLocationRef.current = liveLocation;
  }

  map.easeTo({
    center: [riderLocation.lng, riderLocation.lat],
    bearing: hasActiveDelivery ? bearing : 0,
    pitch: hasActiveDelivery ? 50 : 0,
    duration: 1000,
    essential: false,
  });
}, [liveLocation, mapReady, activeDelivery, assignedDelivery, rider]);
```

Note: `essential: false` means the animation can be interrupted by user interaction (so the rider can still pan manually).

### Step 4: Verify camera follows in browser

Open rider dashboard with 3D map enabled (`NEXT_PUBLIC_MAP_3D_ENABLED=true`). Go online. Either use real GPS or simulate by manually calling `setLiveRiderLocation` from the browser console. The map should smoothly pan and rotate toward the direction of movement.

With no active delivery, pitch should be 0 (top-down view).

### Step 5: Commit

```bash
git add components/maps/RiderMap3D.tsx
git commit -m "feat(rider-map): camera auto-follow with heading rotation"
```

---

## Task 5: Leaflet Fallback Auto-Pan — Rider Dashboard

**Files:**
- Modify: `app/rider/dashboard/page.tsx`

The Leaflet map (`RiderLiveMap`) should also auto-pan to keep the rider centered. No heading rotation (Leaflet limitation).

### Step 1: Locate the Leaflet update effect

In `RiderLiveMap`, find the second `useEffect` — the one that calls `ridersLayer.clearLayers()` and places markers (around line 251). This fires when `liveLocation` changes.

### Step 2: Add auto-pan call

At the **end** of that `useEffect`, after all the marker and route drawing, find the block that sets the map view when there's no `routeDelivery`:

```tsx
if (!routeDelivery) {
  map.setView([riderLoc.lat, riderLoc.lng], 13);
  return;
}
```

Change `map.setView` to `map.panTo` so it animates instead of snapping:

```tsx
if (!routeDelivery) {
  map.panTo([riderLoc.lat, riderLoc.lng]);
  return;
}
```

Then, **after** the `fitBounds` call at the bottom of the effect:

```tsx
map.fitBounds(L.latLngBounds(routePoints), { padding: [32, 32], maxZoom: 15 });
```

Add a pan to keep the rider in frame when they move (only pan if rider is near the edge of the view):

```tsx
// Ensure rider marker stays visible — pan if rider is outside the current view
if (!map.getBounds().contains([riderLoc.lat, riderLoc.lng])) {
  map.panTo([riderLoc.lat, riderLoc.lng]);
}
```

### Step 3: Commit

```bash
git add app/rider/dashboard/page.tsx
git commit -m "feat(rider-map): add leaflet fallback auto-pan"
```

---

## Task 6: Business Portal ETA Countdown

**Files:**
- Modify: `app/business/dashboard/page.tsx`

### Step 1: Add ETA state and ref

In `app/business/dashboard/page.tsx`, find the block of `useState` declarations inside the main `BusinessDashboardPage` component. Add these new states:

```tsx
const [riderEtaSeconds, setRiderEtaSeconds] = useState<number | null>(null);
const [riderEtaPhase, setRiderEtaPhase] = useState<'to_pickup' | 'to_dropoff' | 'delivered' | null>(null);
const [riderEtaDistance, setRiderEtaDistance] = useState<number | null>(null);
const riderEtaIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
const riderEtaOriginRef = useRef<{ lat: number; lng: number } | null>(null);
```

### Step 2: Add haversine helper at top of file

After the existing `seedLocation` helper (around line 25), add:

```tsx
function haversineMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const earth = 6_371_000;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return earth * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

function formatEtaCountdownBiz(seconds: number): string {
  const safe = Math.max(0, Math.round(seconds));
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  if (m === 0) return `${s} sec`;
  return `${m} min ${s.toString().padStart(2, '0')} sec`;
}
```

### Step 3: Add the ETA computation effect

Add a new `useEffect` that watches the active delivery and the rider data. Place it after the existing realtime subscription effect. You'll need to find an active delivery and its assigned rider — look for patterns like `deliveries` and `riders` state variables in the business dashboard.

First, identify what state variables hold the delivery list and riders. They should be named something like `deliveries` and `riders`. Confirm by reading the file and note the exact variable names.

Then add this effect:

```tsx
// Business-side rider ETA computation
useEffect(() => {
  // Clear previous interval
  if (riderEtaIntervalRef.current) {
    clearInterval(riderEtaIntervalRef.current);
    riderEtaIntervalRef.current = null;
  }

  // Find the active delivery for this business
  const activeDelivery = deliveries.find((d) =>
    ['accepted', 'picked_up', 'in_transit'].includes(d.status) && d.rider_id
  );

  if (!activeDelivery || !activeDelivery.rider_id) {
    if (activeDelivery?.status === 'delivered') {
      setRiderEtaPhase('delivered');
    } else {
      setRiderEtaPhase(null);
      setRiderEtaSeconds(null);
      setRiderEtaDistance(null);
    }
    return;
  }

  // Determine phase and target
  const isPickupPhase = activeDelivery.status === 'accepted';
  const targetLat = isPickupPhase ? activeDelivery.pickup_lat : activeDelivery.dropoff_lat;
  const targetLng = isPickupPhase ? activeDelivery.pickup_lng : activeDelivery.dropoff_lng;

  if (typeof targetLat !== 'number' || typeof targetLng !== 'number') {
    setRiderEtaPhase(null);
    return;
  }

  const target = { lat: targetLat, lng: targetLng };

  // Find the assigned rider's location
  const assignedRider = riders.find((r) => r.id === activeDelivery.rider_id);
  if (!assignedRider) {
    setRiderEtaPhase(null);
    return;
  }

  const riderLoc = getRiderLocation(assignedRider);
  const phase: 'to_pickup' | 'to_dropoff' = isPickupPhase ? 'to_pickup' : 'to_dropoff';
  setRiderEtaPhase(phase);

  // Check if rider moved significantly since last compute (>100m)
  const prevOrigin = riderEtaOriginRef.current;
  const movedEnough =
    !prevOrigin ||
    haversineMeters(prevOrigin, riderLoc) > 100;

  if (!movedEnough && riderEtaSeconds !== null) {
    // Just restart the interval with the current value
    riderEtaIntervalRef.current = setInterval(() => {
      setRiderEtaSeconds((prev) => (prev === null || prev <= 0 ? 0 : prev - 1));
    }, 1000);
    return;
  }

  riderEtaOriginRef.current = riderLoc;

  // Fetch OSRM route; fallback to haversine at 25 km/h
  async function computeEta() {
    const distM = haversineMeters(riderLoc, target);
    setRiderEtaDistance(distM);

    let durationSeconds: number;

    try {
      const res = await fetch('/api/navigation/route', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ origin: riderLoc, destination: target, profile: 'driving', locale: 'fr' }),
      });
      if (res.ok) {
        const payload = await res.json();
        if (payload?.ok && payload.duration_s > 0) {
          durationSeconds = payload.duration_s;
          setRiderEtaDistance(payload.distance_m ?? distM);
        } else {
          throw new Error('degraded');
        }
      } else {
        throw new Error('api-error');
      }
    } catch {
      // Fallback: distance / 25 km/h in seconds
      durationSeconds = Math.round(distM / (25000 / 3600));
    }

    setRiderEtaSeconds(durationSeconds);

    if (riderEtaIntervalRef.current) clearInterval(riderEtaIntervalRef.current);
    riderEtaIntervalRef.current = setInterval(() => {
      setRiderEtaSeconds((prev) => (prev === null || prev <= 0 ? 0 : prev - 1));
    }, 1000);
  }

  void computeEta();

  return () => {
    if (riderEtaIntervalRef.current) {
      clearInterval(riderEtaIntervalRef.current);
      riderEtaIntervalRef.current = null;
    }
  };
// Re-run when deliveries or riders change
// eslint-disable-next-line react-hooks/exhaustive-deps
}, [deliveries, riders]);
```

**Important:** Replace `deliveries` and `riders` in the dependency array with the actual state variable names from the business dashboard file if they differ.

### Step 4: Add the EtaCountdownCard inline component

Add this function **outside** the `BusinessDashboardPage` component (before it, not inside):

```tsx
interface EtaCountdownCardProps {
  phase: 'to_pickup' | 'to_dropoff' | 'delivered' | null;
  seconds: number | null;
  distanceM: number | null;
}

function EtaCountdownCard({ phase, seconds, distanceM }: EtaCountdownCardProps) {
  if (!phase) return null;

  if (phase === 'delivered') {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 flex items-center gap-3 shadow-sm">
        <CheckCircle2 className="h-5 w-5 text-emerald-600 flex-shrink-0" />
        <p className="text-sm font-bold text-emerald-700">Delivered</p>
      </div>
    );
  }

  const label = phase === 'to_pickup' ? 'Rider arriving at pickup' : 'Delivery in progress';
  const sublabel = phase === 'to_pickup' ? 'to pickup' : 'to dropoff';

  return (
    <div className="rounded-2xl border border-sky-200 bg-sky-50/60 px-4 py-3 shadow-sm space-y-1">
      <div className="flex items-center gap-2">
        <Bike className="h-4 w-4 text-sky-600 flex-shrink-0" />
        <p className="text-xs font-semibold uppercase tracking-wider text-sky-700">{label}</p>
      </div>
      <div className="flex items-end justify-between gap-3">
        <p className="text-2xl font-extrabold text-foreground tabular-nums">
          {seconds !== null ? formatEtaCountdownBiz(seconds) : '—'}
        </p>
        {distanceM !== null && (
          <p className="text-xs text-muted-foreground pb-0.5">
            {distanceM >= 1000
              ? `${(distanceM / 1000).toFixed(1)} km`
              : `${Math.round(distanceM)} m`}{' '}
            · {sublabel}
          </p>
        )}
      </div>
    </div>
  );
}
```

Make sure `CheckCircle2` and `Bike` are imported at the top of the file — they should already be there based on the existing imports.

### Step 5: Render the EtaCountdownCard in the page JSX

Find a good location to render this card — ideally above the delivery list or at the top of the main content area. Look for where deliveries are rendered in the business dashboard. Add the card there:

```tsx
<EtaCountdownCard
  phase={riderEtaPhase}
  seconds={riderEtaSeconds}
  distanceM={riderEtaDistance}
/>
```

### Step 6: Verify in browser

Open the business dashboard. Create or activate a delivery. The ETA card should appear with:
- Phase label ("Rider arriving at pickup")
- Countdown ticking down in real time
- Distance shown

When the delivery reaches `delivered`, it should show the success state.

### Step 7: Commit

```bash
git add app/business/dashboard/page.tsx
git commit -m "feat(business): add live rider ETA countdown card"
```

---

## Task 7: Smoke Test + Final Verification

### Step 1: Build check

```bash
npm run build
```

Expected: build succeeds with no new TypeScript errors. Pre-existing lint warnings (any, unescaped entities) are acceptable — don't fix them.

### Step 2: Manual smoke test — Rider portal

1. Log in as a rider
2. Go online
3. Accept a delivery offer (or have admin assign one)
4. Verify:
   - Map is 420px tall
   - Next maneuver chip appears top-left of the map
   - ETA countdown bar appears bottom of the map and ticks down every second
   - When GPS updates (real or simulated), map pans to rider position (and rotates if 3D mode is on)
   - Leaflet fallback (if 3D disabled) pans but doesn't rotate
   - Navigation card below shows steps and external links — no duplicate ETA grid

### Step 3: Manual smoke test — Business portal

1. Log in as a business
2. Dispatch a delivery
3. Have a rider accept
4. Verify:
   - ETA countdown card appears above the delivery list
   - Shows correct phase ("Rider arriving at pickup")
   - Countdown ticks down
   - When rider status changes to `picked_up`, phase updates to "to_dropoff"
   - When delivered, shows success state

### Step 4: Regression check — no broken flows

Verify these still work:
- [ ] OTP entry and verification
- [ ] Photo upload
- [ ] Mark Picked Up / Mark Delivered buttons
- [ ] Go Online / Go Offline toggle
- [ ] Offer Accept / Reject
- [ ] Google Maps / Waze external links

### Step 5: Final commit

```bash
git add .
git commit -m "feat: Uber/Glovo-style map upgrade complete (ETA countdown, overlays, camera follow)"
```

---

## Rollback Plan

If any task introduces a regression:

- The ETA countdown effect (`useEffect` with `etaIntervalRef`) can be removed without affecting routing.
- The map overlay divs can be removed without affecting the map rendering.
- The `RiderMap3D` camera-follow effect is isolated from the data-rendering effect — remove it independently.
- The business `EtaCountdownCard` component is additive — removing it leaves the business dashboard unchanged.

All changes are additive and isolated. No existing state, effects, or API calls are modified — only extended.
