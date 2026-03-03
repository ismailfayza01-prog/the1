import { NextRequest, NextResponse } from 'next/server';
import { requireAdminRequest } from '@/lib/admin/auth';
import { writeAdminAuditLog } from '@/lib/admin/audit';
import { createAdminClient } from '@/lib/supabase/admin';

interface DisableRequestBody {
  userId?: string;
  disabled?: boolean;
}

export async function POST(request: NextRequest) {
  const guard = await requireAdminRequest(request);
  if (!guard.ok) return guard.response;

  const { sessionClient, adminUser } = guard.context;
  const adminClient = createAdminClient();

  let body: DisableRequestBody;
  try {
    body = (await request.json()) as DisableRequestBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const userId = body.userId?.trim();
  const disabled = !!body.disabled;

  if (!userId) {
    return NextResponse.json({ error: 'userId is required' }, { status: 400 });
  }

  if (userId === adminUser.id) {
    return NextResponse.json(
      { error: 'Refusing to disable the currently authenticated admin user' },
      { status: 400 }
    );
  }

  const { data: updatedUser, error } = await adminClient.auth.admin.updateUserById(userId, {
    ban_duration: disabled ? '876000h' : 'none',
  });

  if (error || !updatedUser.user) {
    return NextResponse.json(
      { error: error?.message ?? 'Failed to update user status' },
      { status: 500 }
    );
  }

  await writeAdminAuditLog(sessionClient, {
    adminUserId: adminUser.id,
    action: disabled ? 'admin_disable_user' : 'admin_enable_user',
    targetUserId: userId,
    payload: { disabled },
  });

  return NextResponse.json({
    ok: true,
    user: {
      id: updatedUser.user.id,
      email: updatedUser.user.email ?? null,
      banned_until: updatedUser.user.banned_until ?? null,
      disabled,
    },
  });
}
