import { NextRequest, NextResponse } from 'next/server';
import { requireAdminRequest } from '@/lib/admin/auth';
import { writeAdminAuditLog } from '@/lib/admin/audit';
import { createAdminClient } from '@/lib/supabase/admin';

interface DeleteRequestBody {
  userId?: string;
  softDelete?: boolean;
}

export async function POST(request: NextRequest) {
  const guard = await requireAdminRequest(request);
  if (!guard.ok) return guard.response;

  const { sessionClient, adminUser } = guard.context;
  const adminClient = createAdminClient();

  let body: DeleteRequestBody;
  try {
    body = (await request.json()) as DeleteRequestBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const userId = body.userId?.trim();
  const softDelete = body.softDelete !== false;

  if (!userId) {
    return NextResponse.json({ error: 'userId is required' }, { status: 400 });
  }
  if (userId === adminUser.id) {
    return NextResponse.json(
      { error: 'Refusing to delete the currently authenticated admin user' },
      { status: 400 }
    );
  }

  const result = await adminClient.auth.admin.deleteUser(userId, softDelete);
  if (result.error) {
    return NextResponse.json({ error: result.error.message }, { status: 500 });
  }

  await writeAdminAuditLog(sessionClient, {
    adminUserId: adminUser.id,
    action: softDelete ? 'admin_soft_delete_user' : 'admin_delete_user',
    targetUserId: userId,
    payload: { softDelete },
  });

  return NextResponse.json({
    ok: true,
    user_id: userId,
    soft_deleted: softDelete,
  });
}
