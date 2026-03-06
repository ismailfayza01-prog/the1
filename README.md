# Courier marketplace platform


## Getting Started

First, install the dependencies:

```bash
pnpm install
# or
npm install
# or
yarn install
```

Then, run the development server:

```bash
pnpm dev
# or
npm run dev
# or
yarn dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Project Structure

This project uses:
- **Next.js** - React framework for production
- **React** - UI library
- **TypeScript** - Type-safe JavaScript
- **Tailwind CSS** - Utility-first CSS framework

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs)
- [Learn Next.js](https://nextjs.org/learn)

## Deploy

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new).

Check out the [Next.js deployment documentation](https://nextjs.org/docs/deployment) for more details.

## Admin User Provisioning (Supabase)

The admin account management workflow is implemented with server-only routes and Supabase Admin API.

### Required env vars

```bash
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=... # server only, never NEXT_PUBLIC
```

### Local API smoke scripts (real auth)

```bash
# 1) list users as admin
TEST_ADMIN_EMAIL=admin@example.com \
TEST_ADMIN_PASSWORD='...' \
node scripts/test-admin-list-users.js

# 2) create/invite user as admin
TEST_ADMIN_EMAIL=admin@example.com \
TEST_ADMIN_PASSWORD='...' \
TEST_NEW_USER_ROLE=rider \
TEST_NEW_USER_MODE=invite \
node scripts/test-admin-create-user.js
```

### DB verification SQL (run in SQL editor)

```sql
-- Verify role/profile mapping
select p.id, p.email, p.role as profile_role, ur.role as user_role, p.created_at
from public.profiles p
left join public.user_roles ur on ur.user_id = p.id
order by p.created_at desc
limit 50;

-- Verify rider/business provisioning by role
select p.email, p.role, b.id as business_id, b.name as business_name, r.id as rider_id, r.name as rider_name
from public.profiles p
left join public.businesses b on b.user_id = p.id
left join public.riders r on r.user_id = p.id
order by p.created_at desc
limit 50;

-- Verify admin audit logs
select id, admin_user_id, action, target_user_id, payload, created_at
from public.admin_audit_logs
order by created_at desc
limit 50;
```

---


