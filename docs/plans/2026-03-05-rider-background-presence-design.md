# Rider Background Presence — Design Document

**Date:** 2026-03-05
**Status:** Approved

## Problem

When a rider leaves the web app (closes tab, switches apps), their presence heartbeat stops immediately. They disappear from the admin map, stop receiving delivery offers, and businesses can't assign them. The rider must keep the browser tab open and foregrounded at all times — impractical for real-world courier work.

## Requirements

1. **Continue GPS tracking** when the app is backgrounded (as much as the browser allows)
2. **Stay online until explicit logout** — server-side cron marks riders offline after 30 min inactivity
3. **Push notifications** for new delivery offers even when the tab is closed

## Approach: Service Worker + Web Push + Server-Side Presence

### Component 1: Service Worker & Push Notifications

**New file:** `public/sw.js`

- Listens for `push` events, shows system notifications with delivery details
- On notification click, opens/focuses the rider dashboard tab
- Registered from the rider dashboard on login

**New Supabase Edge Function:** `send-push-notification`

- Called when a delivery offer is created for a rider
- Looks up rider's push subscription from `push_subscriptions` table
- Sends Web Push message using VAPID keys (stored as Edge Function secrets)

**Client-side subscription flow:**

1. Rider logs in and toggles online
2. App requests notification permission (`Notification.requestPermission()`)
3. Service Worker registers and creates a push subscription
4. Subscription saved to `push_subscriptions` table via `lib/storage.ts`

### Component 2: Visibility & Unload Handlers

**In `app/rider/dashboard/page.tsx`:**

- `visibilitychange` → hidden: send immediate heartbeat with current GPS
- `visibilitychange` → visible: resume normal 15s heartbeat, refresh data
- `beforeunload`: fire `navigator.sendBeacon()` to beacon API endpoint

**New API route:** `app/api/rider/beacon/route.ts`

- Receives POST from `sendBeacon` during page unload
- Updates `riders.last_seen_at` and inserts into `rider_locations`
- Uses server-side Supabase client with service role key

### Component 3: Server-Side Auto-Offline (Cron)

**New Supabase Edge Function:** `cron-rider-offline`

- Runs every 5 minutes via pg_cron or Supabase scheduled invocation
- Finds riders where:
  - `status != 'offline'`
  - `last_seen_at < now() - interval '30 minutes'`
  - No active delivery in progress
- Sets their status to `'offline'`
- Riders with active deliveries are never auto-offlined

### Component 4: Database — `push_subscriptions` Table

```sql
create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade unique,
  endpoint text not null,
  p256dh_key text not null,
  auth_key text not null,
  created_at timestamptz default now()
);

-- RLS: riders manage their own subscription
alter table public.push_subscriptions enable row level security;

create policy "Users can manage own push subscription"
  on public.push_subscriptions
  for all
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
```

## Data Flow

```
Rider opens app → registers SW → saves push subscription
                → starts 15s GPS heartbeat

Rider backgrounds tab → visibilitychange fires → sends final heartbeat
                      → heartbeat pauses

Rider closes tab → beforeunload fires → sendBeacon sends last position
                 → server has last_seen_at within seconds of close

New offer created → Edge Function sends Web Push → SW shows notification
                 → Rider taps notification → app reopens → GPS resumes

30 min no heartbeat → cron sets rider offline (unless active delivery)
```

## Limitations

- No true background GPS when browser tab is fully closed (browser limitation)
- Rider's last known position is shown on admin map until they reopen
- Push notifications require the rider to grant browser notification permission
- Periodic Background Sync API exists but has poor cross-browser support — not used

## Future: Native App

When the Capacitor/PWA native wrapper is built (deferred plan), it will replace this with true background location tracking via native plugins and Firebase Cloud Messaging for push.
