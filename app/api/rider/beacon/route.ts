import { NextRequest, NextResponse } from 'next/server';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

function isJsonRequest(contentType: string) {
  return contentType.toLowerCase().includes('application/json');
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

function toNullableNumber(input: unknown): number | null {
  if (typeof input === 'number' && Number.isFinite(input)) return input;
  if (typeof input === 'string') {
    const parsed = Number(input.trim());
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function isValidLatLng(lat: number | null, lng: number | null): lat is number {
  if (lat == null || lng == null) return false;
  return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

async function parseBeaconPayload(request: NextRequest, contentType: string): Promise<{ lat: number | null; lng: number | null; accessToken: string }> {
  if (isJsonRequest(contentType)) {
    const body = await request.json().catch(() => null) as { lat?: unknown; lng?: unknown; access_token?: unknown } | null;
    return {
      lat: toNullableNumber(body?.lat),
      lng: toNullableNumber(body?.lng),
      accessToken: typeof body?.access_token === 'string' ? body.access_token.trim() : '',
    };
  }

  const formData = await request.formData().catch(() => null);
  if (!formData) {
    return { lat: null, lng: null, accessToken: '' };
  }

  const lat = toNullableNumber(formData.get('lat'));
  const lng = toNullableNumber(formData.get('lng'));
  const accessTokenRaw = formData.get('access_token');
  const accessToken = typeof accessTokenRaw === 'string' ? accessTokenRaw.trim() : '';
  return { lat, lng, accessToken };
}

export async function POST(request: NextRequest) {
  const contentType = request.headers.get('content-type') ?? '';
  const payload = await parseBeaconPayload(request, contentType);
  const authHeader = request.headers.get('authorization') ?? '';
  const bearerToken = authHeader.toLowerCase().startsWith('bearer ')
    ? authHeader.slice(7).trim()
    : '';

  const supabase = await createServerSupabaseClient();
  let sessionClient: SupabaseClient = supabase;

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  let resolvedUser = user;
  const tokenForFallback = payload.accessToken || bearerToken;

  if ((!resolvedUser || authError) && tokenForFallback) {
    try {
      const bearerClient = createBearerSessionClient(tokenForFallback);
      const tokenUser = await bearerClient.auth.getUser(tokenForFallback);
      if (!tokenUser.error && tokenUser.data.user) {
        resolvedUser = tokenUser.data.user;
        sessionClient = bearerClient;
      }
    } catch (error) {
      console.error('Rider beacon bearer auth setup failed', error);
      return NextResponse.json({ ok: false, error: 'Server auth configuration error' }, { status: 500 });
    }
  }

  if (!resolvedUser) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  const { data: profile, error: profileError } = await sessionClient
    .from('profiles')
    .select('role')
    .eq('id', resolvedUser.id)
    .single();

  if (profileError) {
    return NextResponse.json({ ok: false, error: `Profile lookup failed: ${profileError.message}` }, { status: 500 });
  }

  const role = (profile as { role?: string } | null)?.role;
  if (role !== 'rider') {
    return NextResponse.json({ ok: false, error: 'Only rider accounts can send presence beacon' }, { status: 403 });
  }

  const { data: rider, error: riderError } = await sessionClient
    .from('riders')
    .select('id')
    .eq('user_id', resolvedUser.id)
    .single();

  if (riderError || !rider) {
    return NextResponse.json({ ok: false, error: riderError?.message ?? 'Rider profile not found' }, { status: 404 });
  }

  const nowIso = new Date().toISOString();
  const hasValidLocation = isValidLatLng(payload.lat, payload.lng);
  const updates: Record<string, unknown> = {
    last_seen_at: nowIso,
  };

  if (hasValidLocation) {
    updates.current_location = { lat: payload.lat, lng: payload.lng };
    updates.last_lat = payload.lat;
    updates.last_lng = payload.lng;
    updates.last_location_update = nowIso;
  }

  try {
    let writeClient: any = sessionClient;
    try {
      writeClient = createAdminClient() as any;
    } catch (error) {
      console.warn('Rider beacon using session client fallback (admin client unavailable)', error);
    }

    const { error: updateError } = await writeClient
      .from('riders')
      .update(updates)
      .eq('id', rider.id);
    if (updateError) {
      return NextResponse.json({ ok: false, error: updateError.message }, { status: 500 });
    }

    if (hasValidLocation) {
      const { error: locationError } = await writeClient
        .from('rider_locations')
        .insert({
          rider_id: rider.id,
          location: { lat: payload.lat, lng: payload.lng },
          timestamp: nowIso,
        });
      if (locationError) {
        console.error('Rider beacon location insert failed', locationError);
      }
    }
  } catch (error) {
    console.error('Rider beacon update failed', error);
    return NextResponse.json({ ok: false, error: 'Presence beacon failed' }, { status: 500 });
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
