'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import type { AdminAuditLogRow, ManagedUserRow } from '../types';

interface UserTableProps {
  refreshKey: number;
}

interface ListResponse {
  ok: boolean;
  users: ManagedUserRow[];
  audit_logs: AdminAuditLogRow[];
  error?: string;
}

function formatDate(value: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString();
}

function statusBadgeClass(status: ManagedUserRow['status']) {
  switch (status) {
    case 'active':
      return 'bg-emerald-100 text-emerald-700 border-emerald-200';
    case 'invited':
      return 'bg-amber-100 text-amber-700 border-amber-200';
    case 'disabled':
      return 'bg-slate-100 text-slate-600 border-slate-200';
    default:
      return 'bg-slate-100 text-slate-600 border-slate-200';
  }
}

export function UserTable({ refreshKey }: UserTableProps) {
  const [users, setUsers] = useState<ManagedUserRow[]>([]);
  const [auditLogs, setAuditLogs] = useState<AdminAuditLogRow[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyUserAction, setBusyUserAction] = useState<string | null>(null);

  const usersById = useMemo(() => new Map(users.map((user) => [user.id, user])), [users]);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const url = search
        ? `/api/admin/users/list?search=${encodeURIComponent(search)}`
        : '/api/admin/users/list';
      const response = await fetch(url, { cache: 'no-store' });
      const payload = (await response.json()) as ListResponse;

      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || 'Failed to fetch users');
      }

      setUsers(payload.users ?? []);
      setAuditLogs(payload.audit_logs ?? []);
    } catch (fetchError) {
      const message = fetchError instanceof Error ? fetchError.message : 'Unexpected error';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers, refreshKey]);

  async function callAction(
    actionKey: string,
    endpoint: string,
    body: Record<string, unknown>
  ) {
    setBusyUserAction(actionKey);
    setError(null);
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error || `Action failed: ${endpoint}`);
      }
      await loadUsers();
    } catch (actionError) {
      const message = actionError instanceof Error ? actionError.message : 'Unexpected error';
      setError(message);
    } finally {
      setBusyUserAction(null);
    }
  }

  return (
    <div className="space-y-6">
      <Card className="border border-border bg-white shadow-sm">
        <CardHeader>
          <CardTitle className="text-xl font-bold">Users</CardTitle>
          <CardDescription>
            Search users, resend invites, enable/disable access, reset passwords, and soft-delete accounts.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row">
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by email..."
            />
            <div className="flex items-center gap-2">
              <Button onClick={loadUsers} disabled={loading}>
                {loading ? 'Loading...' : 'Search'}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setSearch('');
                  void loadUsers();
                }}
                disabled={loading}
              >
                Reset
              </Button>
            </div>
          </div>

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="min-w-full divide-y divide-border text-sm">
              <thead className="bg-muted/40">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold">Email</th>
                  <th className="px-3 py-2 text-left font-semibold">Role</th>
                  <th className="px-3 py-2 text-left font-semibold">Status</th>
                  <th className="px-3 py-2 text-left font-semibold">Created</th>
                  <th className="px-3 py-2 text-left font-semibold">Last Sign-in</th>
                  <th className="px-3 py-2 text-left font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border bg-white">
                {users.map((user) => (
                  <tr key={user.id}>
                    <td className="px-3 py-2">
                      <div className="font-medium">{user.email}</div>
                      <div className="text-xs text-muted-foreground">{user.name || '—'}</div>
                    </td>
                    <td className="px-3 py-2">
                      <Badge className="border bg-violet-50 text-violet-700 border-violet-200">
                        {user.role}
                      </Badge>
                    </td>
                    <td className="px-3 py-2">
                      <Badge className={`border ${statusBadgeClass(user.status)}`}>{user.status}</Badge>
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">{formatDate(user.created_at)}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {formatDate(user.last_sign_in_at)}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busyUserAction !== null}
                          onClick={() =>
                            void callAction(
                              `invite:${user.id}`,
                              '/api/admin/users/resend-invite',
                              { userId: user.id, reason: 'invite' }
                            )
                          }
                        >
                          Resend Invite
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busyUserAction !== null}
                          onClick={() =>
                            void callAction(
                              `reset:${user.id}`,
                              '/api/admin/users/resend-invite',
                              { userId: user.id, reason: 'reset_password' }
                            )
                          }
                        >
                          Reset Password
                        </Button>
                        <Button
                          size="sm"
                          variant={user.disabled ? 'secondary' : 'destructive'}
                          disabled={busyUserAction !== null}
                          onClick={() =>
                            void callAction(
                              `disable:${user.id}`,
                              '/api/admin/users/disable',
                              { userId: user.id, disabled: !user.disabled }
                            )
                          }
                        >
                          {user.disabled ? 'Enable' : 'Disable'}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={busyUserAction !== null}
                          onClick={() =>
                            void callAction(
                              `delete:${user.id}`,
                              '/api/admin/users/delete',
                              { userId: user.id, softDelete: true }
                            )
                          }
                        >
                          Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {users.length === 0 && (
                  <tr>
                    <td className="px-3 py-6 text-center text-muted-foreground" colSpan={6}>
                      No users found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card className="border border-border bg-white shadow-sm">
        <CardHeader>
          <CardTitle className="text-xl font-bold">Admin Audit Logs</CardTitle>
          <CardDescription>Last 50 admin actions recorded in the database.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {auditLogs.map((entry) => {
              const targetEmail = entry.target_user_id
                ? usersById.get(entry.target_user_id)?.email ?? entry.target_user_id
                : '—';
              return (
                <div key={entry.id} className="rounded-lg border border-border bg-background p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{entry.action}</Badge>
                      <span className="text-xs text-muted-foreground">
                        target: {targetEmail}
                      </span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {formatDate(entry.created_at)}
                    </span>
                  </div>
                </div>
              );
            })}
            {auditLogs.length === 0 && (
              <p className="text-sm text-muted-foreground">No audit events found.</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
