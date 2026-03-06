# Rider Background Presence — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Keep riders visible and receiving delivery offers even when they leave the web app, using Service Worker push notifications, visibility/unload handlers, and server-side auto-offline.

**Architecture:** Service Worker (`public/sw.js`) handles Web Push notifications. Client-side `visibilitychange` and `beforeunload` events ensure the server always has the rider's last known position. A Supabase Edge Function runs every 5 minutes to mark stale riders offline (30min threshold). A new `push_subscriptions` table stores Web Push endpoints per user.

**Tech Stack:** Web Push API, Service Workers, navigator.sendBeacon, Supabase Edge Functions (Deno), pg_cron, VAPID keys

---

### Task 1: Create `push_subscriptions` Table (Migration 031)

**Files:**
- Create: `supabase/migrations/031_push_subscriptions.sql`

**Step 1: Write the migration**

```sql
-- Push subscription storage for Web Push notifications
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  endpoint text not null,
  p256dh_key text not null,
  auth_key text not null,
  created_at timestamptz default now() not null,
  constraint push_subscriptions_user_id_key unique (user_id)
);

alter table public.push_subscriptions enable row level security;

create policy "Users can manage own push subscription"
  on public.push_subscriptions
  for all
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

comment on table public.push_subscriptions is 'Web Push subscription endpoints for rider notifications';
```

**Step 2: Apply migration to Supabase**

Use `apply_migration` MCP tool with project ID, name `push_subscriptions`, and the SQL above.

**Step 3: Verify**

Run `list_tables` to confirm `push_subscriptions` exists with correct columns.

**Step 4: Commit**

```bash
git add supabase/migrations/031_push_subscriptions.sql
git commit -m "feat: add push_subscriptions table for Web Push"
```

---

### Task 2: Add Push Subscription Methods to `lib/storage.ts`

**Files:**
- Modify: `lib/storage.ts` (after `riderService` definition, around line 299)

**Step 1: Add pushSubscriptionService**

Add this after the `riderService` export (around line 299), before `deliveryService`:

```typescript
/* ── Push Subscription Service ── */
export const pushSubscriptionService = {
  /** Save or update the current user's push subscription. */
  upsert: async (subscription: PushSubscriptionJSON): Promise<void> => {
    const { data: { user } } = await getSupabase().auth.getUser();
    if (!user) return;

    const keys = subscription.keys ?? {};
    await getSupabase()
      .from('push_subscriptions')
      .upsert(
        {
          user_id: user.id,
          endpoint: subscription.endpoint ?? '',
          p256dh_key: (keys.p256dh as string) ?? '',
          auth_key: (keys.auth as string) ?? '',
        },
        { onConflict: 'user_id' }
      );
  },

  /** Remove the current user's push subscription. */
  remove: async (): Promise<void> => {
    const { data: { user } } = await getSupabase().auth.getUser();
    if (!user) return;

    await getSupabase()
      .from('push_subscriptions')
      .delete()
      .eq('user_id', user.id);
  },
};
```

**Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`

**Step 3: Commit**

```bash
git add lib/storage.ts
git commit -m "feat: add pushSubscriptionService to storage layer"
```

---

### Task 3: Create Service Worker (`public/sw.js`)

**Files:**
- Create: `public/sw.js`

**Step 1: Write the service worker**

```javascript
/// <reference lib="webworker" />

// Service Worker for rider push notifications.

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: 'New Delivery', body: event.data.text() };
  }

  const title = payload.title || 'New Delivery Offer';
  const options = {
    body: payload.body || 'You have a new delivery offer. Tap to view.',
    icon: '/brand-logo.svg',
    badge: '/brand-logo.svg',
    tag: 'delivery-offer',
    renotify: true,
    data: {
      url: payload.url || '/rider/dashboard',
      delivery_id: payload.delivery_id || null,
    },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl = event.notification.data?.url || '/rider/dashboard';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      // Focus existing rider dashboard tab if open.
      for (const client of clients) {
        if (client.url.includes('/rider/dashboard') && 'focus' in client) {
          return client.focus();
        }
      }
      // Otherwise open a new tab.
      return self.clients.openWindow(targetUrl);
    })
  );
});
```

**Step 2: Add Service Worker headers in `next.config.js`**

Modify `next.config.js` to serve `sw.js` without caching:

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  turbopack: {
    root: __dirname,
  },
  images: {
    domains: [],
  },
  async headers() {
    return [
      {
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'Service-Worker-Allowed', value: '/' },
        ],
      },
    ];
  },
}

module.exports = nextConfig
```

**Step 3: Commit**

```bash
git add public/sw.js next.config.js
git commit -m "feat: add service worker for push notifications"
```

---

### Task 4: Register Service Worker & Subscribe to Push (Rider Dashboard)

**Files:**
- Modify: `app/rider/dashboard/page.tsx` (add new `useEffect` after the geolocation `useEffect` around line 416)

**Step 1: Add VAPID public key constant**

At the top of the file (after imports, around line 15), add:

```typescript
const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';
```

**Step 2: Add push registration helper function**

Inside the component, before the `handleToggleStatus` function (around line 780), add:

```typescript
const registerPushSubscription = useCallback(async () => {
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !VAPID_PUBLIC_KEY) return;

  try {
    const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    await navigator.serviceWorker.ready;

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return;

    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      const applicationServerKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey,
      });
    }

    await pushSubscriptionService.upsert(subscription.toJSON());
  } catch (err) {
    console.error('Push subscription failed:', err);
  }
}, []);
```

**Step 3: Add the `urlBase64ToUint8Array` helper**

At the bottom of the file (outside the component, before `export default`), add:

```typescript
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
```

**Step 4: Call registration when rider goes online**

In the `handleToggleStatus` function (around line 810, after the successful API response), add:

```typescript
if (nextStatus === 'available') {
  registerPushSubscription();
}
```

**Step 5: Add import for `pushSubscriptionService`**

Update the import from `@/lib/storage` to include `pushSubscriptionService`:

```typescript
import { userService, riderService, deliveryService, pushSubscriptionService } from '@/lib/storage';
```

**Step 6: Verify TypeScript compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`

**Step 7: Commit**

```bash
git add app/rider/dashboard/page.tsx
git commit -m "feat: register service worker and push subscription on rider online"
```

---

### Task 5: Add Visibility & Unload Handlers (Rider Dashboard)

**Files:**
- Modify: `app/rider/dashboard/page.tsx` (add new `useEffect` after the geolocation watch, around line 416)

**Step 1: Add the visibility and unload useEffect**

Insert a new `useEffect` after the geolocation `useEffect` (after line 416, before the main init `useEffect`):

```typescript
// Visibility change & beforeunload — send final heartbeat when leaving
useEffect(() => {
  if (!rider?.id) return;

  const riderId = rider.id;

  const handleVisibilityChange = async () => {
    if (document.visibilityState === 'hidden') {
      // Tab going to background — fire one immediate heartbeat
      try {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 5000,
            maximumAge: 15000,
          })
        );
        await riderService.pingPresence(riderId, {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        });
      } catch {
        await riderService.pingPresence(riderId, null);
      }
    }
    // When tab becomes visible again, the normal 15s heartbeat resumes automatically.
  };

  const handleBeforeUnload = () => {
    // sendBeacon is reliable during page unload
    const beaconUrl = '/api/rider/beacon';
    let lat: number | null = null;
    let lng: number | null = null;

    // Use last known live location from state
    if (liveRiderLocation) {
      lat = liveRiderLocation.lat;
      lng = liveRiderLocation.lng;
    }

    const payload = JSON.stringify({ rider_id: riderId, lat, lng });
    navigator.sendBeacon(beaconUrl, new Blob([payload], { type: 'application/json' }));
  };

  document.addEventListener('visibilitychange', handleVisibilityChange);
  window.addEventListener('beforeunload', handleBeforeUnload);

  return () => {
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    window.removeEventListener('beforeunload', handleBeforeUnload);
  };
}, [rider?.id, liveRiderLocation]);
```

**Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`

**Step 3: Commit**

```bash
git add app/rider/dashboard/page.tsx
git commit -m "feat: add visibility and beforeunload handlers for rider presence"
```

---

### Task 6: Create Beacon API Route

**Files:**
- Create: `app/api/rider/beacon/route.ts`

**Step 1: Write the beacon route**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Use service-role key for beacon — no user session available during unload.
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { rider_id, lat, lng } = body;

    if (!rider_id || typeof rider_id !== 'string') {
      return NextResponse.json({ error: 'rider_id required' }, { status: 400 });
    }

    const updates: Record<string, unknown> = {
      last_seen_at: new Date().toISOString(),
    };

    if (typeof lat === 'number' && typeof lng === 'number') {
      updates.last_lat = lat;
      updates.last_lng = lng;
      updates.current_location = { lat, lng };
      updates.last_location_update = new Date().toISOString();
    }

    await supabaseAdmin
      .from('riders')
      .update(updates)
      .eq('id', rider_id);

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}
```

**Step 2: Verify `SUPABASE_SERVICE_ROLE_KEY` is set**

Check `.env.local` has `SUPABASE_SERVICE_ROLE_KEY`. If not, the developer must add it.

**Step 3: Commit**

```bash
git add app/api/rider/beacon/route.ts
git commit -m "feat: add beacon API route for rider unload heartbeat"
```

---

### Task 7: Deploy `send-push-notification` Edge Function

**Files:**
- Deploy via Supabase MCP: Edge Function `send-push-notification`

**Step 1: Generate VAPID keys**

Run locally (one-time):
```bash
npx web-push generate-vapid-keys
```

Save the public key as `NEXT_PUBLIC_VAPID_PUBLIC_KEY` in `.env.local`.
Save both keys as Edge Function secrets in Supabase dashboard:
- `VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`
- `VAPID_SUBJECT` = `mailto:admin@the1courier.com`

**Step 2: Deploy the edge function**

Use `deploy_edge_function` MCP tool with name `send-push-notification`, `verify_jwt: false` (called from DB trigger), files:

**`index.ts`:**
```typescript
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY') || '';
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY') || '';
const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT') || 'mailto:admin@the1courier.com';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req: Request) => {
  try {
    const { rider_user_id, delivery_id, pickup_address, price } = await req.json();

    if (!rider_user_id) {
      return new Response(JSON.stringify({ error: 'rider_user_id required' }), { status: 400 });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Look up push subscription
    const { data: sub } = await supabase
      .from('push_subscriptions')
      .select('*')
      .eq('user_id', rider_user_id)
      .single();

    if (!sub) {
      return new Response(JSON.stringify({ skipped: true, reason: 'no subscription' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Build push payload
    const payload = JSON.stringify({
      title: 'New Delivery Offer',
      body: pickup_address
        ? `Pickup: ${pickup_address} — ${price} MAD`
        : 'You have a new delivery offer. Tap to view.',
      url: '/rider/dashboard',
      delivery_id,
    });

    // Send Web Push using the web-push standard
    const pushSubscription = {
      endpoint: sub.endpoint,
      keys: {
        p256dh: sub.p256dh_key,
        auth: sub.auth_key,
      },
    };

    // Use web-push library via dynamic import
    const webPush = await import("https://esm.sh/web-push@3.6.7");
    webPush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

    await webPush.sendNotification(pushSubscription, payload);

    return new Response(JSON.stringify({ ok: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Push notification error:', message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
```

**Step 3: Test manually**

Call the function via `curl` or Supabase dashboard to verify it works with a test subscription.

**Step 4: Commit** (save function code locally for reference)

```bash
mkdir -p supabase/functions/send-push-notification
# Save index.ts locally
git add supabase/functions/send-push-notification/index.ts
git commit -m "feat: deploy send-push-notification edge function"
```

---

### Task 8: Deploy `cron-rider-offline` Edge Function

**Files:**
- Deploy via Supabase MCP: Edge Function `cron-rider-offline`

**Step 1: Deploy the edge function**

Use `deploy_edge_function` MCP tool with name `cron-rider-offline`, `verify_jwt: false` (called by cron), files:

**`index.ts`:**
```typescript
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

Deno.serve(async (_req: Request) => {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Find riders who are online but haven't sent a heartbeat in 30 minutes
  // AND don't have an active delivery
  const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();

  const { data: staleRiders, error: fetchError } = await supabase
    .from('riders')
    .select('id, name, status, last_seen_at')
    .neq('status', 'offline')
    .lt('last_seen_at', thirtyMinAgo);

  if (fetchError) {
    console.error('Error fetching stale riders:', fetchError);
    return new Response(JSON.stringify({ error: fetchError.message }), { status: 500 });
  }

  if (!staleRiders || staleRiders.length === 0) {
    return new Response(JSON.stringify({ offlined: 0 }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Filter out riders with active deliveries
  const riderIds = staleRiders.map((r) => r.id);
  const { data: activeDeliveries } = await supabase
    .from('deliveries')
    .select('rider_id')
    .in('rider_id', riderIds)
    .in('status', ['accepted', 'picked_up', 'in_transit']);

  const busyRiderIds = new Set((activeDeliveries || []).map((d) => d.rider_id));
  const toOffline = staleRiders.filter((r) => !busyRiderIds.has(r.id));

  if (toOffline.length === 0) {
    return new Response(JSON.stringify({ offlined: 0, skipped_busy: busyRiderIds.size }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Mark them offline
  const offlineIds = toOffline.map((r) => r.id);
  const { error: updateError } = await supabase
    .from('riders')
    .update({ status: 'offline' })
    .in('id', offlineIds);

  if (updateError) {
    console.error('Error setting riders offline:', updateError);
    return new Response(JSON.stringify({ error: updateError.message }), { status: 500 });
  }

  console.log(`Auto-offlined ${offlineIds.length} riders:`, toOffline.map((r) => r.name));

  return new Response(
    JSON.stringify({
      offlined: offlineIds.length,
      riders: toOffline.map((r) => ({ id: r.id, name: r.name, last_seen: r.last_seen_at })),
      skipped_busy: busyRiderIds.size,
    }),
    { headers: { 'Content-Type': 'application/json' } }
  );
});
```

**Step 2: Set up pg_cron to call it every 5 minutes**

Apply a migration to enable pg_cron and schedule the function:

```sql
-- Enable pg_cron if not already enabled
create extension if not exists pg_cron with schema pg_catalog;

-- Schedule auto-offline check every 5 minutes
select cron.schedule(
  'rider-auto-offline',
  '*/5 * * * *',
  $$
  select net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/cron-rider-offline',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key'),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);
```

Note: If `pg_cron` or `pg_net` is not available, set up the schedule via Supabase Dashboard → Edge Functions → Schedules instead.

**Step 3: Commit**

```bash
mkdir -p supabase/functions/cron-rider-offline
git add supabase/functions/cron-rider-offline/index.ts
git commit -m "feat: deploy cron-rider-offline edge function"
```

---

### Task 9: Wire Push Notification into Delivery Dispatch

**Files:**
- Create: `supabase/migrations/032_notify_rider_on_offer.sql`

**Step 1: Create a database trigger that calls the Edge Function when a delivery_offer is created**

```sql
-- Notify rider via push when they receive a delivery offer
create or replace function public.notify_rider_push()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rider record;
  v_delivery record;
  v_supabase_url text;
  v_service_key text;
begin
  -- Look up rider's user_id
  select user_id into v_rider
  from public.riders
  where id = NEW.rider_id;

  if not found then return NEW; end if;

  -- Look up delivery details for the notification body
  select pickup_address, price into v_delivery
  from public.deliveries
  where id = NEW.delivery_id;

  -- Fire-and-forget HTTP call to the Edge Function via pg_net
  perform net.http_post(
    url := current_setting('app.settings.supabase_url', true) || '/functions/v1/send-push-notification',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true),
      'Content-Type', 'application/json'
    ),
    body := jsonb_build_object(
      'rider_user_id', v_rider.user_id,
      'delivery_id', NEW.delivery_id,
      'pickup_address', coalesce(v_delivery.pickup_address, ''),
      'price', coalesce(v_delivery.price, 0)
    )
  );

  return NEW;
end;
$$;

-- Trigger on new delivery offers
drop trigger if exists trg_notify_rider_push on public.delivery_offers;
create trigger trg_notify_rider_push
  after insert on public.delivery_offers
  for each row
  execute function public.notify_rider_push();
```

**Step 2: Apply migration**

Use `apply_migration` MCP tool.

**Step 3: Commit**

```bash
git add supabase/migrations/032_notify_rider_on_offer.sql
git commit -m "feat: trigger push notification on delivery offer creation"
```

---

### Task 10: Add `.env` Variables & Final Integration Test

**Step 1: Add environment variables**

In `.env.local`, ensure these are set:
```
NEXT_PUBLIC_VAPID_PUBLIC_KEY=<from step 7>
SUPABASE_SERVICE_ROLE_KEY=<already should exist>
```

In Supabase Edge Function secrets (Dashboard → Edge Functions → Secrets):
```
VAPID_PUBLIC_KEY=<from step 7>
VAPID_PRIVATE_KEY=<from step 7>
VAPID_SUBJECT=mailto:admin@the1courier.com
```

**Step 2: Manual integration test**

1. Open rider dashboard, toggle online → should see notification permission prompt
2. Grant notification permission → check `push_subscriptions` table has entry
3. Open business dashboard in another tab, create a delivery with the rider
4. Rider should receive a browser push notification
5. Close rider tab → rider should still appear online on admin dashboard
6. After 30 minutes (or manually set `last_seen_at` to 31 min ago) → cron marks rider offline

**Step 3: Deploy**

```bash
vercel --prod
```

**Step 4: Final commit**

```bash
git add .env.local.example
git commit -m "docs: add VAPID env variable examples"
```
