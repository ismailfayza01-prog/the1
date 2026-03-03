import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

interface AdminAuditPayload {
  adminUserId: string;
  action: string;
  targetUserId?: string | null;
  payload?: Record<string, unknown>;
}

export async function writeAdminAuditLog(
  sessionClient: SupabaseClient,
  input: AdminAuditPayload
) {
  const { error } = await sessionClient.from('admin_audit_logs').insert({
    admin_user_id: input.adminUserId,
    action: input.action,
    target_user_id: input.targetUserId ?? null,
    payload: input.payload ?? {},
  });

  if (error) {
    // Non-fatal by design to avoid blocking primary admin operations.
    console.error('Failed to write admin audit log:', error);
  }
}
