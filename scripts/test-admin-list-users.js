const { createClient } = require('@supabase/supabase-js');

const {
  NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY,
  TEST_ADMIN_EMAIL,
  TEST_ADMIN_PASSWORD,
  TEST_BASE_URL = 'http://localhost:3000',
  TEST_SEARCH = '',
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
  const listUrl = TEST_SEARCH
    ? `${TEST_BASE_URL}/api/admin/users/list?search=${encodeURIComponent(TEST_SEARCH)}`
    : `${TEST_BASE_URL}/api/admin/users/list`;

  const response = await fetch(listUrl, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  const parsed = await parseApiResponse(response);
  console.log('STATUS:', parsed.status);
  if (parsed.payload !== null) {
    const data = parsed.payload;
    console.log('USERS_COUNT:', Array.isArray(data.users) ? data.users.length : 0);
    console.log('AUDIT_LOG_COUNT:', Array.isArray(data.audit_logs) ? data.audit_logs.length : 0);
    console.log('SAMPLE_USERS:', JSON.stringify((data.users || []).slice(0, 5), null, 2));
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
