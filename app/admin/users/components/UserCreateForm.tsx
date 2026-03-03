'use client';

import { FormEvent, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { ManagedUserRole, ProvisionMode } from '../types';

interface UserCreateFormProps {
  onCreated: () => void;
}

interface ApiResponseError {
  error?: string;
}

const ROLE_OPTIONS: ManagedUserRole[] = ['admin', 'business', 'rider'];

export function UserCreateForm({ onCreated }: UserCreateFormProps) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<ManagedUserRole>('business');
  const [mode, setMode] = useState<ProvisionMode>('password');
  const [tempPassword, setTempPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [address, setAddress] = useState('');
  const [riderName, setRiderName] = useState('');
  const [cin, setCin] = useState('');
  const [vehicleType, setVehicleType] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const roleSpecificLabel = useMemo(() => {
    if (role === 'business') return 'Business metadata';
    if (role === 'rider') return 'Rider metadata';
    return 'Role metadata';
  }, [role]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch('/api/admin/users/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          role,
          mode,
          tempPassword: mode === 'password' ? tempPassword : undefined,
          full_name: fullName || undefined,
          phone: phone || undefined,
          business_name: role === 'business' ? businessName || undefined : undefined,
          address: role === 'business' ? address || undefined : undefined,
          rider_name: role === 'rider' ? riderName || undefined : undefined,
          cin: role === 'rider' ? cin || undefined : undefined,
          vehicle_type: role === 'rider' ? vehicleType || undefined : undefined,
        }),
      });

      const payload = (await response.json()) as ApiResponseError & {
        user?: { email?: string; id?: string };
      };

      if (!response.ok) {
        throw new Error(payload.error || 'Failed to create user');
      }

      setSuccess(`User created: ${payload.user?.email ?? email}`);
      setEmail('');
      setTempPassword('');
      setFullName('');
      setPhone('');
      setBusinessName('');
      setAddress('');
      setRiderName('');
      setCin('');
      setVehicleType('');
      onCreated();
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : 'Unexpected error';
      setError(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card className="border border-violet-100 bg-white shadow-sm">
      <CardHeader>
        <CardTitle className="text-xl font-bold">Create User</CardTitle>
        <CardDescription>
          Provision auth user + role/profile + business/rider rows atomically.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={onSubmit}>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="create-email">Email</Label>
              <Input
                id="create-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="new.user@example.com"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-role">Role</Label>
              <select
                id="create-role"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={role}
                onChange={(event) => setRole(event.target.value as ManagedUserRole)}
              >
                {ROLE_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="create-full-name">Full Name</Label>
              <Input
                id="create-full-name"
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                placeholder="Optional display name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-phone">Phone</Label>
              <Input
                id="create-phone"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                placeholder="Optional phone number"
              />
            </div>
          </div>

          <div className="space-y-3 rounded-xl border border-border p-4">
            <p className="text-sm font-semibold text-foreground">Provision mode</p>
            <div className="flex flex-wrap items-center gap-4 text-sm">
              <label className="inline-flex items-center gap-2">
                <input
                  type="radio"
                  name="provision-mode"
                  checked={mode === 'invite'}
                  onChange={() => setMode('invite')}
                />
                Invite by email
              </label>
              <label className="inline-flex items-center gap-2">
                <input
                  type="radio"
                  name="provision-mode"
                  checked={mode === 'password'}
                  onChange={() => setMode('password')}
                />
                Set temporary password
              </label>
            </div>
            {mode === 'password' && (
              <div className="space-y-2">
                <Label htmlFor="create-temp-password">Temporary password</Label>
                <Input
                  id="create-temp-password"
                  type="password"
                  value={tempPassword}
                  onChange={(event) => setTempPassword(event.target.value)}
                  placeholder="At least 8 characters"
                  required
                  minLength={8}
                />
              </div>
            )}
          </div>

          {role === 'business' && (
            <div className="space-y-3 rounded-xl border border-sky-100 bg-sky-50/40 p-4">
              <p className="text-sm font-semibold text-sky-700">{roleSpecificLabel}</p>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="create-business-name">Business name</Label>
                  <Input
                    id="create-business-name"
                    value={businessName}
                    onChange={(event) => setBusinessName(event.target.value)}
                    placeholder="Pharmacie Centrale"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="create-business-address">Address</Label>
                  <Input
                    id="create-business-address"
                    value={address}
                    onChange={(event) => setAddress(event.target.value)}
                    placeholder="Optional address"
                  />
                </div>
              </div>
            </div>
          )}

          {role === 'rider' && (
            <div className="space-y-3 rounded-xl border border-emerald-100 bg-emerald-50/40 p-4">
              <p className="text-sm font-semibold text-emerald-700">{roleSpecificLabel}</p>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="create-rider-name">Rider name</Label>
                  <Input
                    id="create-rider-name"
                    value={riderName}
                    onChange={(event) => setRiderName(event.target.value)}
                    placeholder="Ahmed Benani"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="create-rider-cin">CIN</Label>
                  <Input
                    id="create-rider-cin"
                    value={cin}
                    onChange={(event) => setCin(event.target.value)}
                    placeholder="Optional CIN"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="create-rider-vehicle">Vehicle type</Label>
                  <Input
                    id="create-rider-vehicle"
                    value={vehicleType}
                    onChange={(event) => setVehicleType(event.target.value)}
                    placeholder="Bike / Scooter / Car"
                  />
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}
          {success && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              {success}
            </div>
          )}

          <Button type="submit" disabled={submitting} className="w-full md:w-auto">
            {submitting ? 'Creating user...' : 'Create user'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
