const { createClient } = require('@supabase/supabase-js');

const {
  NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY,
  TEST_ADMIN_EMAIL,
  TEST_ADMIN_PASSWORD,
  TEST_BASE_URL = 'http://localhost:3000',
  TEST_NEW_USER_EMAIL,
  TEST_NEW_USER_ROLE = 'rider',
  TEST_NEW_USER_MODE = 'invite',
  TEST_NEW_USER_PASSWORD = 'TempPass123!',
} = process.env;

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
  if (!NEXT_PUBLIC_SUPABASE_URL || !NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY');
  }
  if (!TEST_ADMIN_EMAIL || !TEST_ADMIN_PASSWORD) {
    throw new Error('Missing TEST_ADMIN_EMAIL or TEST_ADMIN_PASSWORD');
  }

  const supabase = createClient(NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY);

  const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
    email: TEST_ADMIN_EMAIL,
    password: TEST_ADMIN_PASSWORD,
  });
  if (signInError || !signInData.session?.access_token) {
    throw new Error(`Admin sign-in failed: ${signInError?.message || 'missing access token'}`);
  }

  const accessToken = signInData.session.access_token;
  const role = ['admin', 'business', 'rider'].includes(TEST_NEW_USER_ROLE)
    ? TEST_NEW_USER_ROLE
    : 'rider';
  const mode = TEST_NEW_USER_MODE === 'password' ? 'password' : 'invite';

  const generatedEmail = `admin.test.${Date.now()}@example.com`;
  const email = (TEST_NEW_USER_EMAIL || generatedEmail).toLowerCase();

  const payload = {
    email,
    role,
    mode,
    tempPassword: mode === 'password' ? TEST_NEW_USER_PASSWORD : undefined,
    full_name: 'Admin Test User',
    phone: '+212600000000',
    business_name: role === 'business' ? 'Test Business' : undefined,
    address: role === 'business' ? 'Tangier' : undefined,
    rider_name: role === 'rider' ? 'Test Rider' : undefined,
    cin: role === 'rider' ? 'TESTCIN123' : undefined,
    vehicle_type: role === 'rider' ? 'Scooter' : undefined,
  };

  const response = await fetch(`${TEST_BASE_URL}/api/admin/users/create`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(payload),
  });

  const parsed = await parseApiResponse(response);
  console.log('STATUS:', parsed.status);
  if (parsed.payload !== null) {
    console.log('RESPONSE:', JSON.stringify(parsed.payload, null, 2));
  } else {
    console.log('RESPONSE_RAW_TEXT:', parsed.rawText || '<empty>');
  }

  if (!parsed.ok) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('FATAL:', error);
  process.exit(1);
});
