# Map Upgrade Design — Uber/Glovo/InDrive Style
**Date:** 2026-03-03
**Portals:** Rider + Business
**Approach:** Navigation Overlay Component (Approach B)

---

## Goal

Make the rider and business map experience feel like Glovo/InDrive/Uber by adding:
- Live ETA countdown (seconds ticking down)
- Next maneuver overlay on the map
- Camera auto-follow + heading rotation for the rider
- Business-side rider ETA countdown card

---

## Constraints & Decisions

- Layout: **large card map + panels below** (not full-screen) — user preference
- ETA style: **live countdown timer** (`mm:ss` or `min sec` ticking down)
- Camera: **auto-follow + heading rotation** (map rotates to face direction of travel)
- No new files — inline components per CLAUDE.md convention
- No DB schema changes, no new packages, no new API routes

---

## Rider Portal Changes

### 1. Map Frame — `app/rider/dashboard/page.tsx`

**Map height:** Increase from `h-64` (256px) to `h-[420px]`.

**Overlay container:** Wrap the map element in a `relative overflow-hidden` div. Add two absolute overlay children:

**Top-left overlay — Next Maneuver chip:**
- Renders when `navigationRoute?.ok && routeSteps.length > 0`
- Shows: `[arrow icon] [step.instruction] · [formatDistanceMeters(step.distance_m)]`
- Style: white pill with shadow, `absolute top-3 left-3 z-10`
- Arrow icon selected from step instruction text (left/right/straight)

**Bottom overlay — ETA bar:**
- Renders when `navigationRoute?.ok`
- Shows: `🕐 [etaCountdownSeconds formatted] · [distance_m formatted]`
- Style: dark frosted bar (`bg-gray-900/80 backdrop-blur-sm text-white`), `absolute bottom-3 left-3 right-3 z-10 rounded-xl px-4 py-2`
- Ticks down every second via `setInterval`

### 2. ETA Countdown State

New state in rider dashboard:
```ts
const [etaCountdownSeconds, setEtaCountdownSeconds] = useState<number | null>(null);
const etaIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
```

Logic:
- When `navigationRoute` changes and `navigationRoute.ok`, set `etaCountdownSeconds = navigationRoute.duration_s`
- Start/restart `setInterval` that decrements by 1 every 1000ms, clamped at 0
- Clear interval on unmount and when `navigationRoute` becomes null

Format: `Math.floor(s / 60) min Math.floor(s % 60) sec`

### 3. Navigation Card Simplification

The current "Navigation" card below the map is restructured:
- Remove the `Distance / Duree / ETA` grid (now in overlay)
- Keep: target address, steps list (collapsible toggle), external links (Google Maps / Waze)
- Add: action buttons (Mark Picked Up, Mark Delivered, OTP, Photo) directly in this card

### 4. RiderMap3D — Camera Follow + Heading

**File:** `components/maps/RiderMap3D.tsx`

New ref:
```ts
const prevLocationRef = useRef<{ lat: number; lng: number } | null>(null);
```

When `liveLocation` changes:
1. Compute bearing: `atan2(Δlng, Δlat) × (180/π)` normalized to `[0, 360)`
2. Call `map.easeTo({ center: [lng, lat], bearing, pitch: activeDelivery ? 50 : 0, duration: 1200 })`
3. Update `prevLocationRef.current`

When no delivery is active: pitch = 0 (top-down), no bearing lock.

**Leaflet fallback:** Only `map.panTo([lat, lng])` — no heading rotation (Leaflet limitation).

---

## Business Portal Changes

### 1. EtaCountdownCard — `app/business/dashboard/page.tsx`

New state:
```ts
const [riderEtaSeconds, setRiderEtaSeconds] = useState<number | null>(null);
const [riderEtaPhase, setRiderEtaPhase] = useState<'to_pickup' | 'to_dropoff' | 'delivered' | null>(null);
const riderEtaIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
```

**Trigger:** When an active delivery (`accepted / picked_up / in_transit`) has an assigned rider with a known location:
1. Fetch route from rider location → pickup (if `accepted`) or rider → dropoff (if `picked_up / in_transit`) via `/api/navigation/route`
2. If OSRM succeeds: seed `riderEtaSeconds = duration_s`
3. If OSRM fails (degraded/rate-limit): fallback = `haversineDistanceMeters(riderLoc, target) / (25000/3600)` (25 km/h)
4. Start countdown interval

**Recalculate:** When `riders` realtime fires and the rider has moved > 100m from the last compute point.

**UI — inline `<EtaCountdownCard>` component:**
```
┌─────────────────────────────────────────┐
│  🏍  Rider on the way                    │
│      08 min 42 sec  to pickup            │  ← riderEtaPhase = to_pickup
│      2.1 km                              │
└─────────────────────────────────────────┘
```
- Phase `to_dropoff`: "Delivery in X min · dropoff"
- Phase `delivered`: ✅ "Delivered"
- Null: card hidden

---

## Files Modified

| File | Change summary |
|---|---|
| `app/rider/dashboard/page.tsx` | ETA countdown state, map overlay layout (taller map, top+bottom absolute panels), simplified navigation card |
| `components/maps/RiderMap3D.tsx` | Bearing computation + `map.easeTo()` on location change, pitch switch |
| `app/business/dashboard/page.tsx` | `riderEtaSeconds` state, OSRM fetch on active delivery, countdown interval, `EtaCountdownCard` inline component |

**No new files. No DB migrations. No new packages.**

---

## What This Does NOT Include (deferred)

- Route progress (graying out the traveled portion) — requires route geometry slicing at closest point
- Next maneuver auto-advancing (tracking which step index rider is on) — requires distance-to-step computation
- Sound/vibration on new offer — separate feature
- Admin portal map upgrades — separate plan

---

## Success Criteria

- [ ] Rider map is 420px tall with visible next-step chip and ETA bar overlaid on the map
- [ ] ETA bar counts down in real-time (1 second ticks)
- [ ] Map camera rotates to face direction of travel when rider GPS updates
- [ ] Business dashboard shows a live ETA countdown for active deliveries
- [ ] Leaflet fallback still works (auto-pan only, no heading)
- [ ] No regressions to existing routing, OTP, photo upload, offer accept/reject flows
