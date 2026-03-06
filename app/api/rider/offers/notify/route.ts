import { NextRequest, NextResponse } from 'next/server';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendWebPushNotification } from '@/lib/push/webpush';

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

function parseOfferIds(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return input
    .map((value) => (typeof value === 'string' ? value.trim() : ''))
    .filter((value) => value.length > 0);
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null) as { offer_ids?: unknown; access_token?: unknown } | null;
  const offerIds = parseOfferIds(body?.offer_ids);
  if (offerIds.length === 0) {
    return NextResponse.json({ ok: true, sent: 0 }, { status: 200 });
  }

  const supabase = await createServerSupabaseClient();
  let sessionClient: SupabaseClient = supabase;

  const authHeader = request.headers.get('authorization') ?? '';
  const bearerToken = authHeader.toLowerCase().startsWith('bearer ')
    ? authHeader.slice(7).trim()
    : '';
  const bodyToken = typeof body?.access_token === 'string' ? body.access_token.trim() : '';
  const tokenForFallback = bodyToken || bearerToken;

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
      console.error('Offer notify bearer auth setup failed', error);
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
  if (role !== 'admin' && role !== 'business') {
    return NextResponse.json({ ok: false, error: 'Only admin/business can notify rider offers' }, { status: 403 });
  }

  const { data: offers, error: offersError } = await sessionClient
    .from('delivery_offers')
    .select('id,delivery_id,rider_user_id,status')
    .in('id', offerIds)
    .eq('status', 'offered');

  if (offersError) {
    return NextResponse.json({ ok: false, error: offersError.message }, { status: 500 });
  }

  const normalizedOffers = (offers ?? []) as Array<{
    id: string;
    delivery_id: string;
    rider_user_id: string;
    status: string;
  }>;

  if (normalizedOffers.length === 0) {
    return NextResponse.json({ ok: true, sent: 0 }, { status: 200 });
  }

  const deliveryIds = [...new Set(normalizedOffers.map((offer) => offer.delivery_id))];
  const riderUserIds = [...new Set(normalizedOffers.map((offer) => offer.rider_user_id))];

  if (role === 'business') {
    const { data: business, error: businessError } = await sessionClient
      .from('businesses')
      .select('id')
      .eq('user_id', resolvedUser.id)
      .single();

    if (businessError || !business) {
      return NextResponse.json({ ok: false, error: businessError?.message ?? 'Business profile not found' }, { status: 403 });
    }

    const { data: deliveries, error: deliveriesError } = await sessionClient
      .from('deliveries')
      .select('id')
      .in('id', deliveryIds)
      .eq('business_id', (business as { id: string }).id);

    if (deliveriesError) {
      return NextResponse.json({ ok: false, error: deliveriesError.message }, { status: 500 });
    }

    const authorizedIds = new Set(((deliveries ?? []) as Array<{ id: string }>).map((delivery) => delivery.id));
    const unauthorized = deliveryIds.some((id) => !authorizedIds.has(id));
    if (unauthorized) {
      return NextResponse.json({ ok: false, error: 'Forbidden delivery offer selection' }, { status: 403 });
    }
  }

  let adminClient: any;
  try {
    adminClient = createAdminClient() as any;
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'Missing admin push configuration',
      },
      { status: 500 }
    );
  }
  const { data: subscriptions, error: subscriptionsError } = await adminClient
    .from('push_subscriptions')
    .select('id,user_id,endpoint')
    .in('user_id', riderUserIds);

  if (subscriptionsError) {
    return NextResponse.json({ ok: false, error: subscriptionsError.message }, { status: 500 });
  }

  const subscriptionRows = (subscriptions ?? []) as Array<{ id: string; user_id: string; endpoint: string }>;
  let sent = 0;
  const invalidSubscriptionIds: string[] = [];

  for (const subscription of subscriptionRows) {
    const result = await sendWebPushNotification(subscription.endpoint, {
      title: 'New Delivery Offer',
      body: 'You have a new delivery offer. Tap to open your dashboard.',
      url: '/rider/dashboard',
    });

    if (result.ok) {
      sent += 1;
      continue;
    }

    if (result.status === 404 || result.status === 410) {
      invalidSubscriptionIds.push(subscription.id);
    }

    if (result.status !== 404 && result.status !== 410) {
      console.error('Push send failed', {
        subscription_id: subscription.id,
        status: result.status,
        error: result.error,
      });
    }
  }

  if (invalidSubscriptionIds.length > 0) {
    await adminClient
      .from('push_subscriptions')
      .delete()
      .in('id', invalidSubscriptionIds);
  }

  return NextResponse.json(
    {
      ok: true,
      sent,
      targeted: subscriptionRows.length,
      offers: normalizedOffers.length,
    },
    { status: 200 }
  );
}
