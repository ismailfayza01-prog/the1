import { NextRequest, NextResponse } from 'next/server';
import { requireAdminRequest } from '@/lib/admin/auth';
import { writeAdminAuditLog } from '@/lib/admin/audit';
import { createAdminClient } from '@/lib/supabase/admin';

type UserRole = 'admin' | 'business' | 'rider';
type ProvisionMode = 'invite' | 'password';

interface CreateUserRequestBody {
  email?: string;
  role?: UserRole;
  mode?: ProvisionMode;
  tempPassword?: string;
  full_name?: string;
  phone?: string;
  business_name?: string;
  address?: string;
  rider_name?: string;
  cin?: string;
  vehicle_type?: string;
}

const VALID_ROLES: UserRole[] = ['admin', 'business', 'rider'];

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function isStrongEnoughTempPassword(password: string) {
  return password.length >= 8;
}

export async function POST(request: NextRequest) {
  const guard = await requireAdminRequest(request);
  if (!guard.ok) return guard.response;

  const { sessionClient, adminUser } = guard.context;
  const adminClient = createAdminClient();

  let body: CreateUserRequestBody;
  try {
    body = (await request.json()) as CreateUserRequestBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const email = body.email ? normalizeEmail(body.email) : '';
  const role = body.role;
  const mode: ProvisionMode = body.mode === 'password' ? 'password' : 'invite';

  if (!email) {
    return NextResponse.json({ error: 'Email is required' }, { status: 400 });
  }
  if (!role || !VALID_ROLES.includes(role)) {
    return NextResponse.json({ error: 'Role must be one of admin, business, rider' }, { status: 400 });
  }
  if (mode === 'password' && (!body.tempPassword || !isStrongEnoughTempPassword(body.tempPassword))) {
    return NextResponse.json(
      { error: 'Temp password is required and must be at least 8 characters' },
      { status: 400 }
    );
  }

  const existingUsers = await adminClient.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (existingUsers.error) {
    return NextResponse.json(
      { error: `Failed to check existing users: ${existingUsers.error.message}` },
      { status: 500 }
    );
  }
  const emailExists = existingUsers.data.users.some(
    (user) => (user.email ?? '').toLowerCase() === email
  );
  if (emailExists) {
    return NextResponse.json({ error: 'User already exists for this email' }, { status: 409 });
  }

  const userMetadata = {
    role,
    full_name: body.full_name ?? null,
    phone: body.phone ?? null,
  };

  const createResult =
    mode === 'password'
      ? await adminClient.auth.admin.createUser({
          email,
          password: body.tempPassword,
          email_confirm: true,
          user_metadata: userMetadata,
        })
      : await adminClient.auth.admin.inviteUserByEmail(email, {
          data: userMetadata,
          redirectTo: `${request.nextUrl.origin}/`,
        });

  if (createResult.error || !createResult.data.user) {
    return NextResponse.json(
      { error: createResult.error?.message ?? 'Failed to create auth user' },
      { status: 500 }
    );
  }

  const createdAuthUser = createResult.data.user;

  const p_profile = {
    email,
    full_name: body.full_name ?? null,
    phone: body.phone ?? null,
  };

  const p_business =
    role === 'business'
      ? {
          business_name: body.business_name ?? null,
          address: body.address ?? null,
        }
      : null;

  const p_rider =
    role === 'rider'
      ? {
          rider_name: body.rider_name ?? body.full_name ?? null,
          phone: body.phone ?? null,
          cin: body.cin ?? null,
          vehicle_type: body.vehicle_type ?? null,
        }
      : null;

  const { data: provisionData, error: provisionError } = await sessionClient.rpc(
    'admin_provision_user',
    {
      p_user_id: createdAuthUser.id,
      p_role: role,
      p_profile,
      p_business,
      p_rider,
    }
  );

  if (provisionError) {
    await adminClient.auth.admin.deleteUser(createdAuthUser.id, true);
    return NextResponse.json(
      { error: `Provisioning failed: ${provisionError.message}` },
      { status: 500 }
    );
  }

  await writeAdminAuditLog(sessionClient, {
    adminUserId: adminUser.id,
    action: 'admin_create_user',
    targetUserId: createdAuthUser.id,
    payload: {
      email,
      role,
      mode,
      provision_data: provisionData ?? null,
    },
  });

  return NextResponse.json(
    {
      ok: true,
      user: {
        id: createdAuthUser.id,
        email: createdAuthUser.email,
        role,
        mode,
      },
    },
    { status: 201 }
  );
}
