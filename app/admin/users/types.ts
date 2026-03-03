export type ManagedUserRole = 'admin' | 'business' | 'rider';
export type ManagedUserStatus = 'invited' | 'active' | 'disabled';
export type ProvisionMode = 'invite' | 'password';

export interface ManagedUserRow {
  id: string;
  email: string;
  role: ManagedUserRole;
  name: string;
  status: ManagedUserStatus;
  disabled: boolean;
  created_at: string | null;
  last_sign_in_at: string | null;
}

export interface AdminAuditLogRow {
  id: number;
  admin_user_id: string | null;
  action: string;
  target_user_id: string | null;
  payload: Record<string, unknown>;
  created_at: string;
}
