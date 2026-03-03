const { createClient } = require('@supabase/supabase-js');

const BASE_URL = process.env.TEST_BASE_URL || 'https://the1-courier.vercel.app';
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://rcnkkuijuildcqegsyty.supabase.co';
const SUPABASE_PUBLISHABLE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJjbmtrdWlqdWlsZGNxZWdzeXR5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE0MzM0OTgsImV4cCI6MjA4NzAwOTQ5OH0.eZdLbMLzmU0Dgdh9ju4wUt4E2q4i0qc6OToamLix0AQ';

const ROOT_ADMIN_EMAIL = process.env.ROOT_ADMIN_EMAIL || 'admin@the1000.ma';
const ROOT_ADMIN_PASSWORD = process.env.ROOT_ADMIN_PASSWORD || 'Admin1234!';

function getClient() {
  return createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

async function signIn(email, password) {
  const client = getClient();
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error || !data.session || !data.user) {
    throw new Error(`Sign in failed for ${email}: ${error?.message || 'no session'}`);
  }
  return { client, user: data.user, session: data.session };
}

async function createUserViaAdmin(accessToken, payload) {
  const res = await fetch(`${BASE_URL}/api/admin/users/create`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(payload),
  });

  const text = await res.text();
  let body = null;
  try {
    body = JSON.parse(text);
  } catch {
    body = { raw: text };
  }

  if (!res.ok) {
    throw new Error(`Admin create user failed (${res.status}): ${body?.error || text}`);
  }
  return body;
}

async function getBusinessRow(client, userId) {
  const { data, error } = await client.from('businesses').select('*').eq('user_id', userId).single();
  if (error || !data) throw new Error(`Business row missing: ${error?.message || 'no data'}`);
  return data;
}

async function getRiderRow(client, userId) {
  const { data, error } = await client.from('riders').select('*').eq('user_id', userId).single();
  if (error || !data) throw new Error(`Rider row missing: ${error?.message || 'no data'}`);
  return data;
}

async function createDeliveryAsBusiness(client, businessId, runNo) {
  const now = Date.now();
  const payload = {
    business_id: businessId,
    rider_id: null,
    pickup_address: `Pharmacie Tangier ${runNo}`,
    pickup_lat: 35.7595,
    pickup_lng: -5.834,
    dropoff_address: `Client ${runNo} - Tangier`,
    dropoff_phone: `+21260000${String(runNo).padStart(4, '0')}`,
    note: `MVP smoke run ${runNo} / ${now}`,
    dropoff_lat: 35.752,
    dropoff_lng: -5.841,
    estimated_duration: 18,
    actual_duration: null,
    price: 0,
    rider_commission: 15,
    status: 'pending',
    payment_method: 'subscription',
    accepted_at: null,
    picked_up_at: null,
    completed_at: null,
  };

  const { data, error } = await client.from('deliveries').insert(payload).select('*').single();
  if (error || !data) throw new Error(`Create delivery failed: ${error?.message || 'no data'}`);
  return data;
}

async function assignByAdmin(adminClient, deliveryId, riderId) {
  const { data, error } = await adminClient.rpc('admin_assign_delivery', {
    p_delivery_id: deliveryId,
    p_rider_id: riderId,
    p_create_offer: false,
  });
  if (error || !data) throw new Error(`Admin assign failed: ${error?.message || 'no data'}`);
  return data;
}

async function overrideByAdmin(adminClient, deliveryId, status) {
  const { data, error } = await adminClient.rpc('admin_override_delivery_status', {
    p_delivery_id: deliveryId,
    p_status: status,
  });
  if (error || !data) throw new Error(`Admin override failed: ${error?.message || 'no data'}`);
  return data;
}

async function updateDeliveryAsRider(riderClient, deliveryId, patch, step) {
  const { data, error } = await riderClient
    .from('deliveries')
    .update(patch)
    .eq('id', deliveryId)
    .select('*')
    .single();
  if (error || !data) throw new Error(`Rider ${step} failed: ${error?.message || 'no data'}`);
  return data;
}

async function verifyBusinessSeesDelivered(businessClient, businessId, deliveryId) {
  const { data, error } = await businessClient
    .from('deliveries')
    .select('id,status,completed_at,dropoff_phone,note')
    .eq('business_id', businessId)
    .eq('id', deliveryId)
    .single();

  if (error || !data) throw new Error(`Business verify failed: ${error?.message || 'no data'}`);
  if (data.status !== 'delivered') {
    throw new Error(`Business delivery status is ${data.status}, expected delivered`);
  }
  return data;
}

async function verifyRiderSeesAssignedPending(riderClient, deliveryId, riderId) {
  const { data, error } = await riderClient
    .from('deliveries')
    .select('id,status,rider_id')
    .eq('id', deliveryId)
    .single();

  if (error || !data) throw new Error(`Rider assigned visibility failed: ${error?.message || 'no data'}`);
  if (data.rider_id !== riderId) throw new Error(`Rider assignment mismatch: got ${data.rider_id}, expected ${riderId}`);
  if (data.status !== 'pending') throw new Error(`Assigned delivery should be pending before rider accepts, got ${data.status}`);
  return data;
}

async function main() {
  const startedAt = new Date().toISOString();
  const suffix = Date.now();

  const creds = {
    admin: {
      email: `admin.mvp.${suffix}@the1000.ma`,
      password: `AdminMvp${suffix.toString().slice(-6)}!`,
    },
    business: {
      email: `business.mvp.${suffix}@the1000.ma`,
      password: `BizMvp${suffix.toString().slice(-6)}!`,
    },
    rider: {
      email: `rider.mvp.${suffix}@the1000.ma`,
      password: `RiderMvp${suffix.toString().slice(-6)}!`,
    },
  };

  const rootAdmin = await signIn(ROOT_ADMIN_EMAIL, ROOT_ADMIN_PASSWORD);

  await createUserViaAdmin(rootAdmin.session.access_token, {
    email: creds.admin.email,
    role: 'admin',
    mode: 'password',
    tempPassword: creds.admin.password,
    full_name: 'MVP Admin',
    phone: '+212600111111',
  });

  await createUserViaAdmin(rootAdmin.session.access_token, {
    email: creds.business.email,
    role: 'business',
    mode: 'password',
    tempPassword: creds.business.password,
    full_name: 'MVP Business',
    phone: '+212600222222',
    business_name: 'MVP Pharmacie Tangier',
    address: 'Tangier',
  });

  await createUserViaAdmin(rootAdmin.session.access_token, {
    email: creds.rider.email,
    role: 'rider',
    mode: 'password',
    tempPassword: creds.rider.password,
    full_name: 'MVP Rider',
    phone: '+212600333333',
    rider_name: 'MVP Rider',
    cin: `CIN${suffix}`,
    vehicle_type: 'Scooter',
  });

  const admin = await signIn(creds.admin.email, creds.admin.password);
  const business = await signIn(creds.business.email, creds.business.password);
  const rider = await signIn(creds.rider.email, creds.rider.password);

  const businessRow = await getBusinessRow(admin.client, business.user.id);
  const riderRow = await getRiderRow(admin.client, rider.user.id);

  // Rider online/offline presence toggle as rider user.
  const riderOnlineAt = new Date().toISOString();
  const riderOnlineUpdate = await rider.client
    .from('riders')
    .update({ status: 'available', last_seen_at: riderOnlineAt })
    .eq('id', riderRow.id)
    .select('id,status,last_seen_at')
    .single();
  if (riderOnlineUpdate.error) {
    throw new Error(`Rider online toggle failed: ${riderOnlineUpdate.error.message}`);
  }

  const businessRiderView = await business.client
    .from('riders')
    .select('id,status,last_seen_at')
    .eq('id', riderRow.id)
    .single();
  if (businessRiderView.error || !businessRiderView.data) {
    throw new Error(`Business rider availability read failed: ${businessRiderView.error?.message || 'no data'}`);
  }

  const riderAvailabilityBefore = await admin.client
    .from('riders')
    .select('id,status,last_seen_at')
    .eq('id', riderRow.id)
    .single();

  if (riderAvailabilityBefore.error) {
    throw new Error(`Rider availability query failed: ${riderAvailabilityBefore.error.message}`);
  }

  const runResults = [];

  for (let i = 1; i <= 10; i += 1) {
    const delivery = await createDeliveryAsBusiness(business.client, businessRow.id, i);
    await assignByAdmin(admin.client, delivery.id, riderRow.id);
    await verifyRiderSeesAssignedPending(rider.client, delivery.id, riderRow.id);

    await updateDeliveryAsRider(rider.client, delivery.id, {
      status: 'accepted',
      accepted_at: new Date().toISOString(),
    }, 'accept');

    await updateDeliveryAsRider(rider.client, delivery.id, {
      status: 'picked_up',
      picked_up_at: new Date().toISOString(),
    }, 'picked_up');

    await updateDeliveryAsRider(rider.client, delivery.id, { status: 'in_transit' }, 'in_transit');

    await updateDeliveryAsRider(rider.client, delivery.id, {
      status: 'delivered',
      completed_at: new Date().toISOString(),
      delivered_at: new Date().toISOString(),
    }, 'delivered');

    const verified = await verifyBusinessSeesDelivered(business.client, businessRow.id, delivery.id);

    runResults.push({
      run: i,
      delivery_id: delivery.id,
      status: verified.status,
      completed_at: verified.completed_at,
    });
  }

  // Explicit admin override safety-net test
  const overrideDelivery = await createDeliveryAsBusiness(business.client, businessRow.id, 999);
  await assignByAdmin(admin.client, overrideDelivery.id, riderRow.id);
  const overridden = await overrideByAdmin(admin.client, overrideDelivery.id, 'delivered');

  // Rider presence signal for availability list
  await rider.client
    .from('riders')
    .update({ status: 'available', last_seen_at: new Date().toISOString() })
    .eq('id', riderRow.id);

  const riderAvailabilityAfter = await admin.client
    .from('riders')
    .select('id,status,last_seen_at')
    .eq('id', riderRow.id)
    .single();

  const businessHistory = await business.client
    .from('deliveries')
    .select('id,status,completed_at')
    .eq('business_id', businessRow.id)
    .in('status', ['delivered', 'cancelled', 'expired'])
    .order('created_at', { ascending: false })
    .limit(20);

  if (businessHistory.error) {
    throw new Error(`Business history query failed: ${businessHistory.error.message}`);
  }

  const summary = {
    started_at: startedAt,
    finished_at: new Date().toISOString(),
    deployment_url: BASE_URL,
    credentials: creds,
    business_id: businessRow.id,
    rider_id: riderRow.id,
    ten_run_results: runResults,
    override_test: {
      delivery_id: overrideDelivery.id,
      status_after_override: overridden.status,
    },
    rider_availability_before: riderAvailabilityBefore.data,
    rider_availability_after: riderAvailabilityAfter.data,
    business_rider_availability_view: businessRiderView.data,
    business_history_count: businessHistory.data?.length || 0,
  };

  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error('SMOKE_FAILED:', error.message || error);
  process.exit(1);
});
