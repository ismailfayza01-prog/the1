import 'server-only';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

type Role = 'admin' | 'business' | 'rider';

interface ProfileRoleRow {
  role: Role;
  name: string;
  email: string;
}

export interface AdminRequestContext {
  sessionClient: SupabaseClient;
  adminUser: {
    id: string;
    email: string | null;
  };
  adminProfile: ProfileRoleRow;
}

type AdminGuardResult =
  | { ok: true; context: AdminRequestContext }
  | { ok: false; response: NextResponse };

function getBearerToken(request: NextRequest): string | null {
  const authHeader = request.headers.get('authorization');
  if (!authHeader) return null;
  if (!authHeader.toLowerCase().startsWith('bearer ')) return null;
  const token = authHeader.slice(7).trim();
  return token.length > 0 ? token : null;
}

function createBearerSessionClient(token: string): SupabaseClient {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !publishableKey) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY (fallback: NEXT_PUBLIC_SUPABASE_ANON_KEY)');
  }

  return createClient(supabaseUrl, publishableKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  });
}

export async function requireAdminRequest(request: NextRequest): Promise<AdminGuardResult> {
  try {
    const bearerToken = getBearerToken(request);
    const sessionClient = bearerToken
      ? createBearerSessionClient(bearerToken)
      : await createServerSupabaseClient();

    const userResult = bearerToken
      ? await sessionClient.auth.getUser(bearerToken)
      : await sessionClient.auth.getUser();

    if (userResult.error || !userResult.data.user) {
      return {
        ok: false,
        response: NextResponse.json(
          { error: 'Unauthorized' },
          { status: 401 }
        ),
      };
    }

    const authUser = userResult.data.user;

    const { data: profile, error: profileError } = await sessionClient
      .from('profiles')
      .select('role,name,email')
      .eq('id', authUser.id)
      .single();

    if (profileError || !profile) {
      return {
        ok: false,
        response: NextResponse.json(
          { error: 'Forbidden: profile not found' },
          { status: 403 }
        ),
      };
    }

    if (profile.role !== 'admin') {
      return {
        ok: false,
        response: NextResponse.json(
          { error: 'Forbidden: admin access required' },
          { status: 403 }
        ),
      };
    }

    return {
      ok: true,
      context: {
        sessionClient,
        adminUser: {
          id: authUser.id,
          email: authUser.email ?? null,
        },
        adminProfile: profile as ProfileRoleRow,
      },
    };
  } catch (error) {
    console.error('Admin auth guard error:', error);
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      ),
    };
  }
}
