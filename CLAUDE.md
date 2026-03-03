# CLAUDE.md — the1-courier Project Guidelines

## Project Overview

**the1-courier** — A B2B courier marketplace platform for Tangier, Morocco with three distinct portals:
- **Admin Portal** — Platform management, real-time monitoring of riders, businesses, and deliveries
- **Business Portal** — Order management, delivery requests, real-time rider tracking via canvas map
- **Rider Portal** — Delivery acceptance, earnings tracking, status management

Built with **Next.js 16** (App Router), **TypeScript 5**, **Tailwind CSS v4**, **shadcn/ui**, and **Supabase**.

---

## Architecture Principles

### 1. Client-Side Architecture (Current)
- **All pages are Client Components** (`'use client'`) — no Server Components in use yet
- **Client-side auth only** — Each page calls `userService.getCurrentUser()` in `useEffect` to guard access
- **Direct Supabase SDK** — No API routes; all database calls go through `lib/storage.ts` service layer
- **Middleware as session refresher** — `middleware.ts` only refreshes JWT via `supabase.auth.getUser()`; no route protection
- **Realtime subscriptions** — Admin and Business dashboards use Supabase Realtime channels for live updates

### 2. Service Layer Pattern
All database and auth operations flow through `lib/storage.ts`. Never call Supabase directly from pages.

**Services in `lib/storage.ts`:**
- `userService` — login, logout, getCurrentUser, getAll, getById, getByEmail
- `businessService` — CRUD for businesses, useRide(), addCredits()
- `riderService` — CRUD for riders, updateLocation(), updateStatus(), getAvailable()
- `deliveryService` — CRUD for deliveries, assignRider(), enrichDeliveries()
- `transactionService` — transaction history and creation

**Always use these services**, never construct raw Supabase queries in page components.

### 3. Type Safety
- All shared types live in `lib/types.ts` — **never define new types in individual page files**
- Interfaces: `User`, `Business`, `Rider`, `Delivery`, `Transaction`, `RiderLocation`
- Helper functions in `types.ts`: `getRiderCommission()`, `calculateDeliveryPrice()`, `getSubscriptionDetails()`
- Use these helpers rather than hardcoding business logic

---

## Design System

### Color Palette (CSS Custom Properties)
Defined in `app/globals.css`, themed via `--background`, `--foreground`, `--primary`, etc.

**Light theme (default):**
- Primary: Indigo (`243 75% 59%`) — buttons, links, highlights
- Secondary: Sky-blue (`199 89% 94%`) — muted backgrounds
- Accent: Teal (`172 66% 50%`) — interactive elements
- Background: Near-white (`210 40% 98%`)
- Foreground: Dark gray (`222 47% 11%`)

**Dark theme (`.dark` class):**
- Primary: Lighter indigo (`243 75% 65%`)
- Background: Near-black (`222 47% 7%`)
- All semantic colors automatically invert

### Tailwind + CSS Variables
- **Preferred:** Use Tailwind utility classes (e.g., `bg-primary`, `text-muted-foreground`)
- **Not preferred:** Inline `style={{}}` objects (breaks theming, hard to maintain)
- **Utility classes in `globals.css`:**
  - `.gradient-text` — indigo-to-teal gradient on text
  - `.glass-card` — frosted glass effect with blur
  - `.glow-primary` — primary color glow shadow
  - `.animate-gradient` — animated gradient background
  - `.status-online`, `.status-busy`, `.status-offline` — rider status badges

### Component Library (shadcn/ui)
Located in `components/ui/`:
- `button.tsx` — variants: default, destructive, outline, secondary, ghost, link
- `card.tsx` — CardHeader, CardTitle, CardDescription, CardContent, CardFooter
- `dialog.tsx`, `input.tsx`, `label.tsx`, `progress.tsx`, `switch.tsx`, `tabs.tsx`

**Only import from `components/ui/` for primitive components.** Page-specific UI lives in the page file.

---

## File Structure

```
the1-courier/
├── app/                              # Next.js App Router pages
│   ├── layout.tsx                   # Root layout (Inter font, Analytics)
│   ├── page.tsx                     # Landing page with portal selector
│   ├── globals.css                  # Tailwind + CSS variables
│   ├── admin/
│   │   ├── page.tsx                 # Admin login form
│   │   └── dashboard/
│   │       └── page.tsx             # Admin dashboard (stats, live map, tabs)
│   ├── business/
│   │   ├── page.tsx                 # Business login form
│   │   └── dashboard/
│   │       └── page.tsx             # Business dashboard (canvas map, delivery form)
│   └── rider/
│       ├── page.tsx                 # Rider login form
│       └── dashboard/
│           └── page.tsx             # Rider dashboard (status toggle, earnings, deliveries)
│
├── components/
│   └── ui/                          # shadcn/ui primitives ONLY
│       ├── badge.tsx, button.tsx, card.tsx, dialog.tsx, ...
│
├── lib/
│   ├── utils.ts                     # cn() utility (clsx + tailwind-merge)
│   ├── types.ts                     # All TypeScript interfaces + business logic helpers
│   ├── storage.ts                   # Service layer: userService, businessService, etc.
│   └── supabase/
│       ├── client.ts                # Browser Supabase client (used in pages)
│       └── server.ts                # Server Supabase client (defined but currently unused)
│
├── supabase/
│   ├── migrations/
│   │   └── 001_initial_schema.sql   # Full schema: tables, RLS policies, triggers
│   └── seed.sql                     # Demo data (users, businesses, riders, deliveries)
│
├── middleware.ts                    # Session refresh on every non-static request
├── tailwind.config.js               # Tailwind theme extensions (semantic colors)
├── tsconfig.json                    # TypeScript config (strict mode)
└── next.config.js                   # Next.js config (minimal)
```

---

## Coding Conventions

### TypeScript & Imports
- **Strict mode enabled** — all variables typed explicitly
- **Import from `@/`** — use path alias for all local imports (configured in `tsconfig.json`)
- **Type imports:** `import type { User } from '@/lib/types'` for types only

### React Components
- All pages are `'use client'` — add this directive at the top
- Use `useRouter` from `next/navigation` (not `next/router`)
- Guard pages with auth in `useEffect` → redirect if not authenticated or wrong role
- Return `null` while loading auth (consider adding a skeleton or loader in future)

### Styling Rules
1. **Use Tailwind classes** — `className="bg-primary text-white px-4 py-2"`
2. **Never use inline `style={{}}` for layout** — use Tailwind utilities instead
3. **Use `cn()` for conditional classes** — `className={cn('p-4', active && 'bg-primary')}`
4. **Extend colors via `globals.css`** — add custom colors as CSS variables, not in Tailwind config

### Component Organization
- **Primitives in `components/ui/`** — only small, reusable, theme-neutral components
- **Page-specific components in page file** — `BusinessMap`, `RiderList`, `DeliveryForm` live where they're used
- **Shared page components** — if a component is used on 2+ pages, move it to `components/` with a specific folder (e.g., `components/auth/LoginForm.tsx`)

### Database & Auth
- **Always use services** — never call `supabase.from()` directly in a component
- **No API routes** — direct Supabase SDK only
- **RLS policies enforced** — the database has role-based access control; trust RLS, not client-side checks alone

### Data Fetching & Realtime
- **Initial load:** `useEffect(() => { loadData() }, [])`
- **Realtime updates:** Subscribe in `useEffect`, unsubscribe on cleanup
- **Example:**
  ```tsx
  useEffect(() => {
    const channel = supabase.channel('updates')
      .on('postgres_changes', { event: '*', table: 'deliveries' }, () => loadData())
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, []);
  ```

---

## Things to Avoid

### Styling
- ❌ Inline `style={{}}` for layout/spacing (use Tailwind)
- ❌ `@import` CSS inside component `<style>` tags (use `next/font`)
- ❌ Hardcoded colors (use CSS variables: `hsl(var(--primary))`)
- ❌ Adding new shadcn UI components to `components/ui/` without understanding precedent

### Architecture
- ❌ Creating API routes (use Supabase SDK directly)
- ❌ Calling Supabase from components (use `lib/storage.ts` services)
- ❌ Defining types in multiple files (all go in `lib/types.ts`)
- ❌ Server Components (current pattern is all Client Components)
- ❌ Hardcoding business logic (use helper functions from `lib/types.ts`)

### Security
- ❌ Committing `.env.local` with real credentials to git (already in `.gitignore`)
- ❌ Showing passwords/credentials in production UI (demo panel should be dev-only)
- ❌ Relying on client-side auth alone (RLS policies are the real guard)

---

## Known Limitations (As of Current State)

1. **No server-side route protection** — Middleware doesn't block unauthorized access; client-side guards only
2. **Simulated GPS** — Rider locations are faked (`setInterval` random walk), not real coordinates
3. **N+1 query pattern** — `enrichDeliveries()` fetches business/rider names individually (consider batch fetching)
4. **No mobile responsiveness** — Business dashboard uses fixed `gridTemplateColumns: '1fr 340px'`
5. **No loading states** — Pages return `null` during auth check, causing blank flashes
6. **Server client unused** — `lib/supabase/server.ts` exists but pages don't use it

---

## Contributing Guidelines

### Before implementing a feature:
1. **Check `lib/types.ts`** — is the type already defined? Use it.
2. **Check `lib/storage.ts`** — is there a service for this? Use it.
3. **Check `components/ui/`** — is there a shadcn component you can use? Use it.
4. **Use Tailwind, not inline styles** — theme consistency matters.
5. **Add RLS policy to `supabase/migrations/` if adding a table** — security first.

### Code review checklist:
- [ ] No hardcoded colors (use CSS variables)
- [ ] No inline `style={{}}` for layout
- [ ] All DB calls go through `lib/storage.ts`
- [ ] TypeScript is strict (no `any` types)
- [ ] Realtime subscriptions cleaned up in `useEffect` return
- [ ] Auth check present in all protected pages
- [ ] No new types in page files (all in `lib/types.ts`)

---

## Resources

- **Next.js App Router:** https://nextjs.org/docs/app
- **Tailwind CSS v4:** https://tailwindcss.com/docs
- **Supabase JS SDK:** https://supabase.com/docs/reference/javascript
- **shadcn/ui:** https://ui.shadcn.com
- **Radix UI:** https://radix-ui.com

---

**Last updated:** February 2025
**Maintained by:** Claude Code
