const { createClient } = require('@supabase/supabase-js');

const {
  NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY,
  NEXT_PUBLIC_SUPABASE_ANON_KEY,
  TEST_ADMIN_EMAIL,
  TEST_ADMIN_PASSWORD,
  TEST_BASE_URL = 'http://localhost:3000',
  TEST_RANGE = 'today',
  TEST_TZ = 'Africa/Casablanca',
} = process.env;

function getPublishableKey() {
  return NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY || NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
}

async function parseApiResponse(response) {
  const rawText = await response.text();
  if (!rawText) {
    return {
      status: response.status,
      ok: response.ok,
      payload: null,
      rawText: '',
    };
  }

  try {
    return {
      status: response.status,
      ok: response.ok,
      payload: JSON.parse(rawText),
      rawText,
    };
  } catch {
    return {
      status: response.status,
      ok: response.ok,
      payload: null,
      rawText,
    };
  }
}

async function main() {
  const publishableKey = getPublishableKey();
  if (!NEXT_PUBLIC_SUPABASE_URL || !publishableKey) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or publishable anon key');
  }
  if (!TEST_ADMIN_EMAIL || !TEST_ADMIN_PASSWORD) {
    throw new Error('Missing TEST_ADMIN_EMAIL or TEST_ADMIN_PASSWORD');
  }

  const supabase = createClient(NEXT_PUBLIC_SUPABASE_URL, publishableKey);
  const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
    email: TEST_ADMIN_EMAIL,
    password: TEST_ADMIN_PASSWORD,
  });
  if (signInError || !signInData.session?.access_token) {
    throw new Error(`Admin sign-in failed: ${signInError?.message || 'missing access token'}`);
  }

  const accessToken = signInData.session.access_token;
  const url = `${TEST_BASE_URL}/api/admin/monitoring/snapshot?range=${encodeURIComponent(
    TEST_RANGE
  )}&tz=${encodeURIComponent(TEST_TZ)}`;
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  const parsed = await parseApiResponse(response);
  console.log('STATUS:', parsed.status);

  if (parsed.payload && typeof parsed.payload === 'object') {
    const payload = parsed.payload;
    const kpis = payload.kpis || {};
    const alerts = Array.isArray(payload.alerts) ? payload.alerts : [];
    const audits = Array.isArray(payload.recent_audit) ? payload.recent_audit : [];
    console.log('RANGE:', payload.range);
    console.log('GENERATED_AT:', payload.generated_at);
    console.log(
      'KPIS:',
      JSON.stringify(
        {
          active_deliveries: kpis.active_deliveries ?? 0,
          active_incidents: kpis.active_incidents ?? 0,
          online_riders: kpis.online_riders ?? 0,
          delivered_today: kpis.delivered_today ?? 0,
          dispatch_success_rate: kpis.dispatch_success_rate ?? 0,
        },
        null,
        2
      )
    );
    console.log('ALERTS_COUNT:', alerts.length);
    console.log('AUDIT_COUNT:', audits.length);
    console.log('ALERTS_SAMPLE:', JSON.stringify(alerts.slice(0, 5), null, 2));
  } else {
    console.log('RESPONSE_RAW_TEXT:', parsed.rawText || '<empty>');
  }

  if (!parsed.ok) {
    if (parsed.payload !== null) {
      console.log('ERROR:', JSON.stringify(parsed.payload, null, 2));
    }
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('FATAL:', error);
  process.exit(1);
});
