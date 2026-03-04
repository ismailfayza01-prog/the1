# Codebase Review — Bugs & Security Fixes

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix critical bugs, security vulnerabilities, and performance issues found during codebase review.

**Architecture:** All fixes maintain the existing client-side architecture. No new files created except a shared utility. Changes are surgical — touch only the lines that need fixing.

**Tech Stack:** Next.js 16, TypeScript 5, Supabase, Tailwind CSS v4

---

## Phase 1: Security & Credential Fixes

### Task 1: Remove hardcoded credentials from smoke-production script

**Files:**
- Modify: `scripts/smoke-production.js:5-11`

**Step 1: Remove fallback credentials**

Replace the hardcoded fallback values with empty strings that force environment variables:

```javascript
const SUPABASE_PUBLISHABLE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  '';

const ROOT_ADMIN_EMAIL = process.env.ROOT_ADMIN_EMAIL || '';
const ROOT_ADMIN_PASSWORD = process.env.ROOT_ADMIN_PASSWORD || '';
```

**Step 2: Add early exit if env vars missing**

After line 12, add a guard:

```javascript
if (!SUPABASE_PUBLISHABLE_KEY || !ROOT_ADMIN_EMAIL || !ROOT_ADMIN_PASSWORD) {
  console.error('Missing required env vars: NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY (or NEXT_PUBLIC_SUPABASE_ANON_KEY), ROOT_ADMIN_EMAIL, ROOT_ADMIN_PASSWORD');
  process.exit(1);
}
```

**Step 3: Commit**

```bash
git add scripts/smoke-production.js
git commit -m "fix(security): remove hardcoded credentials from smoke test script"
```

---

### Task 2: Harden dev credential pre-fill in login pages

**Files:**
- Modify: `app/admin/page.tsx:94-95`
- Modify: `app/business/page.tsx:93-94`
- Modify: `app/rider/page.tsx:101-102`

**Step 1: Change all three login pages**

Replace pre-filled `useState` with empty defaults regardless of env:

In `app/admin/page.tsx:94-95`:
```tsx
const [email, setEmail] = useState('');
const [password, setPassword] = useState('');
```

In `app/business/page.tsx:93-94`:
```tsx
const [email, setEmail] = useState('');
const [password, setPassword] = useState('');
```

In `app/rider/page.tsx:101-102`:
```tsx
const [email, setEmail] = useState('');
const [password, setPassword] = useState('');
```

Also remove the now-unused `isDev` const from each file (lines 91, 90, 98 respectively).

**Step 2: Commit**

```bash
git add app/admin/page.tsx app/business/page.tsx app/rider/page.tsx
git commit -m "fix(security): remove dev credential pre-fill from login pages"
```

---

### Task 3: Add MIME type validation on photo uploads

**Files:**
- Modify: `app/rider/dashboard/page.tsx:907-928` (handleUploadPhoto)

**Step 1: Add validation before upload**

Insert at the top of `handleUploadPhoto`, after `setPhotoError('')`:

```typescript
const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_SIZE = 10 * 1024 * 1024; // 10 MB

if (!ALLOWED_MIME.includes(file.type)) {
  setPhotoError('Only JPEG, PNG, and WebP images are allowed');
  setPhotoUploading(false);
  return;
}
if (file.size > MAX_SIZE) {
  setPhotoError('File too large (max 10 MB)');
  setPhotoUploading(false);
  return;
}
```

**Step 2: Commit**

```bash
git add app/rider/dashboard/page.tsx
git commit -m "fix(security): validate MIME type and size on photo uploads"
```

---

## Phase 2: Bug Fixes

### Task 4: Fix `any` types in deliveryService

**Files:**
- Modify: `lib/storage.ts:311,340,354,367`

**Step 1: Define the row type and replace all 4 occurrences**

Add a local type above `deliveryService` (around line 304):

```typescript
type DeliveryRow = Delivery & { businesses?: { name: string } | null; riders?: { name: string } | null };
```

Then replace all four `(d: any)` with `(d: DeliveryRow)`:

Line 311: `return (data || []).map((d: DeliveryRow) => ({`
Line 340: `return (data || []).map((d: DeliveryRow) => ({`
Line 354: `return (data || []).map((d: DeliveryRow) => ({`
Line 367: `return (data || []).map((d: DeliveryRow) => ({`

**Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors in `lib/storage.ts`

**Step 3: Commit**

```bash
git add lib/storage.ts
git commit -m "fix(types): replace any with DeliveryRow in deliveryService"
```

---

### Task 5: Fix silent error swallowing in auth

**Files:**
- Modify: `lib/storage.ts:59-88`

**Step 1: Propagate error info from login**

Replace the login function (lines 59-74):

```typescript
login: async (email: string, password: string): Promise<User | null> => {
  const supabase = getSupabase();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    console.error('Login failed:', error.message);
    throw new Error(error.message);
  }

  const { data: { user: authUser } } = await supabase.auth.getUser();
  if (!authUser) return null;

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', authUser.id).single();
  return (profile as User) || null;
},
```

**Step 2: Update login pages to catch the error**

In all three login pages (`app/admin/page.tsx`, `app/business/page.tsx`, `app/rider/page.tsx`), the `handleLogin` function should already have try/catch that calls `setError()`. Verify each catches and displays the error message:

```typescript
} catch (err) {
  setError(err instanceof Error ? err.message : content.loginError);
}
```

**Step 3: Commit**

```bash
git add lib/storage.ts app/admin/page.tsx app/business/page.tsx app/rider/page.tsx
git commit -m "fix(auth): propagate login errors instead of swallowing silently"
```

---

### Task 6: Cache Supabase browser client

**Files:**
- Modify: `lib/supabase/client.ts`

**Step 1: Add singleton caching**

Replace the entire file:

```typescript
import { createBrowserClient } from '@supabase/ssr';

let cachedClient: ReturnType<typeof createBrowserClient> | null = null;

export function createClient() {
  if (cachedClient) return cachedClient;

  const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').trim();
  const supabasePublishableKey =
    (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY ??
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
      '').trim();

  if (!supabaseUrl || !supabasePublishableKey) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY (fallback: NEXT_PUBLIC_SUPABASE_ANON_KEY)');
  }

  cachedClient = createBrowserClient(supabaseUrl, supabasePublishableKey);
  return cachedClient;
}
```

**Step 2: Commit**

```bash
git add lib/supabase/client.ts
git commit -m "perf: cache Supabase browser client as singleton"
```

---

### Task 7: Fix delivery completion guard — require PoD verification

**Files:**
- Modify: `app/rider/dashboard/page.tsx:947-976`

**Step 1: Add PoD check before allowing delivery completion**

Replace the `handleMarkDelivered` function:

```typescript
const handleMarkDelivered = async (deliveryId: string) => {
  if (!rider) return;
  const delivery = deliveries.find(d => d.id === deliveryId);
  if (!delivery) return;

  // Guard: require either OTP verified or photo uploaded before completing
  const hasOtp = delivery.pod_otp_verified_at;
  const hasPhoto = delivery.pod_photo_key;
  if (!hasOtp && !hasPhoto) {
    setStatusMessage('Please verify OTP or upload a delivery photo before marking as delivered.');
    return;
  }

  const actualDuration = delivery.picked_up_at
    ? Math.round((Date.now() - new Date(delivery.picked_up_at).getTime()) / 60000)
    : delivery.estimated_duration;

  if (delivery.status === 'picked_up') {
    await deliveryService.update(deliveryId, { status: 'in_transit' });
  }
  await deliveryService.submitDeliveryPhoto(deliveryId, `rider-marked-delivered-${Date.now()}`);
  await deliveryService.update(deliveryId, {
    completed_at: new Date().toISOString(),
    actual_duration: actualDuration,
  });

  await riderService.update(rider.id, {
    total_deliveries: rider.total_deliveries + 1,
    earnings_this_month: rider.earnings_this_month + delivery.rider_commission,
    status: 'available',
    last_seen_at: new Date().toISOString(),
  });

  if (currentUser) {
    await refreshRiderData(rider.id, currentUser.id);
  }
};
```

Note: If `pod_otp_verified_at` or `pod_photo_key` are not on the `Delivery` type yet, check `lib/types.ts` and add them if missing.

**Step 2: Commit**

```bash
git add app/rider/dashboard/page.tsx
git commit -m "fix(delivery): require PoD verification before marking delivered"
```

---

## Phase 3: Performance Optimization

### Task 8: Extract shared haversine utility

**Files:**
- Create: `lib/geo.ts`
- Modify: `app/business/dashboard/page.tsx` (remove local haversine)
- Modify: `app/rider/dashboard/page.tsx` (remove local haversine)

**Step 1: Create shared utility**

```typescript
/** Haversine distance in meters between two lat/lng points */
export function haversineMeters(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): number {
  const R = 6_371_000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h = sinLat * sinLat + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sinLng * sinLng;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}
```

**Step 2: Replace local implementations in both dashboards**

In both files, remove the local `haversineMeters` function and add:
```typescript
import { haversineMeters } from '@/lib/geo';
```

**Step 3: Verify build**

Run: `npx tsc --noEmit`

**Step 4: Commit**

```bash
git add lib/geo.ts app/business/dashboard/page.tsx app/rider/dashboard/page.tsx
git commit -m "refactor: extract shared haversine utility to lib/geo.ts"
```

---

### Task 9: Memoize expensive computations in business dashboard

**Files:**
- Modify: `app/business/dashboard/page.tsx`

**Step 1: Wrap ridersForMap and sortedAvailableRiders in useMemo**

Find the `ridersForMap` computation (around line 622-630) and wrap:

```typescript
const { ridersForMap, sortedAvailableRiders } = useMemo(() => {
  // existing filter and sort logic here
  const nearby = allRiders.filter(/* existing filter */);
  const sorted = [...allRiders].filter(/* existing filter */).sort(/* existing sort */);
  return {
    ridersForMap: nearby.length > 0 ? nearby : sorted,
    sortedAvailableRiders: sorted,
  };
}, [allRiders, business]);
```

This prevents recalculation on every render when only unrelated state changes.

**Step 2: Commit**

```bash
git add app/business/dashboard/page.tsx
git commit -m "perf: memoize rider sorting/filtering in business dashboard"
```

---

### Task 10: Memoize map event handlers in BusinessMap3D

**Files:**
- Modify: `components/maps/BusinessMap3D.tsx`

**Step 1: Wrap event handlers in useCallback**

The `onRiderClick`, `onMapClick`, `onMouseEnter`, `onMouseLeave` handlers (around lines 200-240) should be wrapped:

```typescript
const onRiderClick = useCallback((e: maplibregl.MapMouseEvent) => {
  // existing logic
}, [onSelectRider, riders]);

const onMapClick = useCallback((e: maplibregl.MapMouseEvent) => {
  // existing logic
}, [onPinLocation]);
```

This prevents event listener reattachment on every render.

**Step 2: Commit**

```bash
git add components/maps/BusinessMap3D.tsx
git commit -m "perf: memoize map event handlers to prevent listener churn"
```

---

## Phase 4: Resilience

### Task 11: Add React Error Boundary

**Files:**
- Modify: `app/layout.tsx`

**Step 1: Add error boundary component inline in layout**

Add an ErrorBoundary class component in `app/layout.tsx` (above the default export):

```tsx
'use client';

import { Component, type ReactNode } from 'react';

class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; error: Error | null }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-background p-8">
          <div className="max-w-md text-center">
            <h1 className="text-2xl font-bold text-foreground mb-4">Something went wrong</h1>
            <p className="text-muted-foreground mb-6">{this.state.error?.message || 'An unexpected error occurred.'}</p>
            <button
              onClick={() => { this.setState({ hasError: false, error: null }); window.location.reload(); }}
              className="bg-primary text-white px-6 py-2 rounded-lg hover:opacity-90"
            >
              Reload page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
```

Note: Since `layout.tsx` is currently a Server Component, this ErrorBoundary should be extracted to a client component file `components/ErrorBoundary.tsx` and imported. Alternatively, wrap `{children}` in the layout's JSX with the boundary.

**Step 2: Wrap children in layout**

```tsx
<ErrorBoundary>
  {children}
</ErrorBoundary>
```

**Step 3: Commit**

```bash
git add components/ErrorBoundary.tsx app/layout.tsx
git commit -m "feat: add React Error Boundary to prevent white-screen crashes"
```

---

### Task 12: Standardize error handling in storage.ts

**Files:**
- Modify: `lib/storage.ts`

**Step 1: Make getCurrentUser consistent with login**

The `getCurrentUser` function (lines 76-88) should NOT throw (it's called on every page load for auth check). Keep it returning `null` but log the error class:

```typescript
getCurrentUser: async (): Promise<User | null> => {
  try {
    const supabase = getSupabase();
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) return null;

    const { data: profile } = await supabase.from('profiles').select('*').eq('id', authUser.id).single();
    return (profile as User) || null;
  } catch {
    return null;
  }
},
```

This is intentional — `getCurrentUser` is a "check if logged in" function. Returning null means "not logged in." The `login` function (Task 5) now throws on actual login errors so the user sees what went wrong.

**Step 2: Commit**

```bash
git add lib/storage.ts
git commit -m "fix: standardize error handling in storage.ts auth methods"
```

---

## Summary

| Task | Phase | Risk | Files Changed |
|------|-------|------|---------------|
| 1. Remove hardcoded creds from script | Security | Low | 1 |
| 2. Remove dev credential pre-fill | Security | Low | 3 |
| 3. Add MIME validation on uploads | Security | Low | 1 |
| 4. Fix `any` types | Bugs | Low | 1 |
| 5. Fix silent auth error swallowing | Bugs | Medium | 4 |
| 6. Cache Supabase client | Bugs | Low | 1 |
| 7. Add PoD guard on delivery completion | Bugs | Medium | 1 |
| 8. Extract shared haversine | Performance | Low | 3 |
| 9. Memoize business dashboard computations | Performance | Low | 1 |
| 10. Memoize map event handlers | Performance | Low | 1 |
| 11. Add Error Boundary | Resilience | Low | 2 |
| 12. Standardize error handling | Resilience | Low | 1 |

**Total: 12 tasks, ~20 files touched**
