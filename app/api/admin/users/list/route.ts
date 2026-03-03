import { NextRequest, NextResponse } from 'next/server';
import { requireAdminRequest } from '@/lib/admin/auth';
import { createAdminClient } from '@/lib/supabase/admin';

type UserRole = 'admin' | 'business' | 'rider';
type UserStatus = 'invited' | 'active' | 'disabled';

interface ProfileRow {
  id: string;
  email: string;
  role: UserRole;
  name: string;
  created_at: string;
}

interface UserRoleRow {
  user_id: string;
  role: UserRole;
}

interface AdminAuditLogRow {
  id: number;
  admin_user_id: string | null;
  action: string;
  target_user_id: string | null;
  payload: Record<string, unknown>;
  created_at: string;
}

function resolveUserStatus(authUser: {
  last_sign_in_at?: string | null;
  banned_until?: string | null;
}): { status: UserStatus; disabled: boolean } {
  const bannedUntil = authUser.banned_until ? new Date(authUser.banned_until).getTime() : null;
  const disabled = bannedUntil !== null && bannedUntil > Date.now();

  if (disabled) return { status: 'disabled', disabled: true };
  if (!authUser.last_sign_in_at) return { status: 'invited', disabled: false };
  return { status: 'active', disabled: false };
}

export async function GET(request: NextRequest) {
  const guard = await requireAdminRequest(request);
  if (!guard.ok) return guard.response;

  const { sessionClient } = guard.context;
  const adminClient = createAdminClient();

  const search = request.nextUrl.searchParams.get('search')?.trim().toLowerCase() ?? '';
  const limitParam = Number(request.nextUrl.searchParams.get('limit') ?? '200');
  const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 1000) : 200;

  const authUsersResult = await adminClient.auth.admin.listUsers({ page: 1, perPage: limit });
  if (authUsersResult.error) {
    return NextResponse.json(
      { error: `Failed to list auth users: ${authUsersResult.error.message}` },
      { status: 500 }
    );
  }

  const filteredAuthUsers = authUsersResult.data.users.filter((user) => {
    if (!search) return true;
    return (user.email ?? '').toLowerCase().includes(search);
  });

  const userIds = filteredAuthUsers.map((user) => user.id);

  const [profilesResult, rolesResult, logsResult] = await Promise.all([
    userIds.length
      ? adminClient
          .from('profiles')
          .select('id,email,role,name,created_at')
          .in('id', userIds)
      : Promise.resolve({ data: [], error: null }),
    userIds.length
      ? adminClient
          .from('user_roles')
          .select('user_id,role')
          .in('user_id', userIds)
      : Promise.resolve({ data: [], error: null }),
    sessionClient
      .from('admin_audit_logs')
      .select('id,admin_user_id,action,target_user_id,payload,created_at')
      .order('created_at', { ascending: false })
      .limit(50),
  ]);

  if (profilesResult.error) {
    return NextResponse.json(
      { error: `Failed to load profiles: ${profilesResult.error.message}` },
      { status: 500 }
    );
  }
  if (rolesResult.error) {
    return NextResponse.json(
      { error: `Failed to load user roles: ${rolesResult.error.message}` },
      { status: 500 }
    );
  }
  if (logsResult.error) {
    return NextResponse.json(
      { error: `Failed to load audit logs: ${logsResult.error.message}` },
      { status: 500 }
    );
  }

  const profileById = new Map(
    ((profilesResult.data ?? []) as ProfileRow[]).map((profile) => [profile.id, profile])
  );
  const roleByUserId = new Map(
    ((rolesResult.data ?? []) as UserRoleRow[]).map((row) => [row.user_id, row.role])
  );

  const users = filteredAuthUsers
    .map((authUser) => {
      const profile = profileById.get(authUser.id);
      const role = roleByUserId.get(authUser.id) ?? profile?.role ?? 'business';
      const { status, disabled } = resolveUserStatus(authUser);

      return {
        id: authUser.id,
        email: authUser.email ?? profile?.email ?? '',
        role,
        name: profile?.name ?? '',
        status,
        disabled,
        created_at: authUser.created_at ?? profile?.created_at ?? null,
        last_sign_in_at: authUser.last_sign_in_at ?? null,
      };
    })
    .sort((a, b) => {
      const aTs = a.created_at ? new Date(a.created_at).getTime() : 0;
      const bTs = b.created_at ? new Date(b.created_at).getTime() : 0;
      return bTs - aTs;
    });

  return NextResponse.json({
    ok: true,
    users,
    audit_logs: (logsResult.data ?? []) as AdminAuditLogRow[],
  });
}
