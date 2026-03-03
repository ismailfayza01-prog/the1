import { NextRequest, NextResponse } from 'next/server';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { createServerSupabaseClient } from '@/lib/supabase/server';

const VALID_STATUSES = new Set(['available', 'busy', 'offline']);

function getRedirectUrl(request: NextRequest) {
  const fallback = new URL('/rider/dashboard', request.url);
  const referer = request.headers.get('referer');
  if (!referer) return fallback;

  try {
    const source = new URL(referer);
    fallback.pathname = source.pathname;
    fallback.search = source.search;
    return fallback;
  } catch {
    return fallback;
  }
}

function isJsonRequest(contentType: string) {
  return contentType.toLowerCase().includes('application/json');
}

function isFormRequest(contentType: string) {
  const lower = contentType.toLowerCase();
  return lower.includes('application/x-www-form-urlencoded') || lower.includes('multipart/form-data');
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

function respondError(request: NextRequest, contentType: string, status: number, error: string) {
  if (isFormRequest(contentType)) {
    const url = getRedirectUrl(request);
    url.searchParams.delete('status_notice');
    url.searchParams.set('status_error', error);
    return NextResponse.redirect(url, { status: 303 });
  }
  return NextResponse.json({ ok: false, error }, { status });
}

function respondOk(
  request: NextRequest,
  contentType: string,
  payload: { rider: Record<string, unknown>; notice: string }
) {
  if (isFormRequest(contentType)) {
    const url = getRedirectUrl(request);
    url.searchParams.delete('status_error');
    url.searchParams.set('status_notice', payload.notice);
    return NextResponse.redirect(url, { status: 303 });
  }
  return NextResponse.json({ ok: true, rider: payload.rider, notice: payload.notice }, { status: 200 });
}

async function parseRequestedStatus(request: NextRequest, contentType: string) {
  let status = '';
  let accessToken = '';

  if (isJsonRequest(contentType)) {
    const body = await request.json().catch(() => null) as { status?: unknown; access_token?: unknown } | null;
    if (typeof body?.status === 'string') status = body.status.toLowerCase().trim();
    if (typeof body?.access_token === 'string') accessToken = body.access_token.trim();
  } else {
    const formData = await request.formData().catch(() => null);
    if (formData) {
      const formStatus = formData.get('status');
      const formToken = formData.get('access_token');
      if (typeof formStatus === 'string') status = formStatus.toLowerCase().trim();
      if (typeof formToken === 'string') accessToken = formToken.trim();
    }
  }

  return { status, accessToken };
}

export async function POST(request: NextRequest) {
  const contentType = request.headers.get('content-type') ?? '';
  const parsed = await parseRequestedStatus(request, contentType);
  const requestedStatus = parsed.status;

  if (!VALID_STATUSES.has(requestedStatus)) {
    return respondError(request, contentType, 400, 'Status must be one of: available, busy, offline');
  }

  const supabase = await createServerSupabaseClient();
  let sessionClient: SupabaseClient = supabase;

  const authHeader = request.headers.get('authorization') ?? '';
  const bearerToken = authHeader.toLowerCase().startsWith('bearer ')
    ? authHeader.slice(7).trim()
    : '';
  const tokenForFallback = parsed.accessToken || bearerToken;

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  let resolvedUser = user;

  if ((!resolvedUser || authError) && tokenForFallback) {
    try {
      const bearerClient = createBearerSessionClient(tokenForFallback);
      const tokenUser = await bearerClient.auth.getUser(tokenForFallback);
      if (!tokenUser.error && tokenUser.data.user) {
        resolvedUser = tokenUser.data.user;
        sessionClient = bearerClient;
      }
    } catch (error) {
      console.error('Rider status bearer auth setup failed', error);
      return respondError(request, contentType, 500, 'Server auth configuration error');
    }
  }

  if (!resolvedUser) {
    return respondError(request, contentType, 401, 'Unauthorized');
  }

  const { data: profile, error: profileError } = await sessionClient
    .from('profiles')
    .select('role')
    .eq('id', resolvedUser.id)
    .single();

  if (profileError) {
    return respondError(request, contentType, 500, `Profile lookup failed: ${profileError.message}`);
  }

  const role = (profile as { role?: string } | null)?.role;
  if (role !== 'rider') {
    return respondError(request, contentType, 403, 'Only rider accounts can update rider status');
  }

  const { data: rider, error: riderError } = await sessionClient
    .from('riders')
    .select('id,status')
    .eq('user_id', resolvedUser.id)
    .single();

  if (riderError || !rider) {
    return respondError(request, contentType, 404, riderError?.message ?? 'Rider profile not found');
  }

  const { data: updated, error: updateError } = await sessionClient
    .from('riders')
    .update({
      status: requestedStatus,
      last_seen_at: new Date().toISOString(),
    })
    .eq('id', rider.id)
    .select('*')
    .single();

  if (updateError || !updated) {
    return respondError(request, contentType, 500, updateError?.message ?? 'Status update failed');
  }

  const notice = requestedStatus === 'offline' ? 'You are offline.' : 'You are online and available.';
  return respondOk(request, contentType, { rider: updated as Record<string, unknown>, notice });
}
