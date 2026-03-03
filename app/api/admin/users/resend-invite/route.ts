import { NextRequest, NextResponse } from 'next/server';
import { requireAdminRequest } from '@/lib/admin/auth';
import { writeAdminAuditLog } from '@/lib/admin/audit';
import { createAdminClient } from '@/lib/supabase/admin';

interface ResendInviteBody {
  userId?: string;
  email?: string;
  reason?: 'invite' | 'reset_password';
}

export async function POST(request: NextRequest) {
  const guard = await requireAdminRequest(request);
  if (!guard.ok) return guard.response;

  const { sessionClient, adminUser } = guard.context;
  const adminClient = createAdminClient();

  let body: ResendInviteBody;
  try {
    body = (await request.json()) as ResendInviteBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const reason = body.reason === 'reset_password' ? 'reset_password' : 'invite';
  let email = body.email?.trim().toLowerCase() ?? '';
  const userId = body.userId?.trim();

  if (!email) {
    if (!userId) {
      return NextResponse.json({ error: 'userId or email is required' }, { status: 400 });
    }
    const userResult = await adminClient.auth.admin.getUserById(userId);
    if (userResult.error || !userResult.data.user?.email) {
      return NextResponse.json(
        { error: userResult.error?.message ?? 'Unable to resolve target user email' },
        { status: 404 }
      );
    }
    email = userResult.data.user.email.toLowerCase();
  }

  const inviteResult = await adminClient.auth.admin.inviteUserByEmail(email, {
    data: {
      reason,
      triggered_by: adminUser.id,
    },
    redirectTo: `${request.nextUrl.origin}/`,
  });

  if (inviteResult.error) {
    return NextResponse.json(
      { error: inviteResult.error.message },
      { status: 500 }
    );
  }

  await writeAdminAuditLog(sessionClient, {
    adminUserId: adminUser.id,
    action: reason === 'reset_password' ? 'admin_reset_password_link' : 'admin_resend_invite',
    targetUserId: userId ?? inviteResult.data.user?.id ?? null,
    payload: { email, reason },
  });

  return NextResponse.json({
    ok: true,
    email,
    user_id: userId ?? inviteResult.data.user?.id ?? null,
    reason,
  });
}
