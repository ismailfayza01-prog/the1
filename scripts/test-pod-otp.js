import { createClient } from '@supabase/supabase-js';

const {
  NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY,
  TEST_RIDER_EMAIL,
  TEST_RIDER_PASSWORD,
  TEST_DELIVERY_ID,
  TEST_POD_OTP,
} = process.env;

async function main() {
  if (!NEXT_PUBLIC_SUPABASE_URL || !NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY');
  }
  if (!TEST_RIDER_EMAIL || !TEST_RIDER_PASSWORD) {
    throw new Error('Missing TEST_RIDER_EMAIL or TEST_RIDER_PASSWORD');
  }
  if (!TEST_DELIVERY_ID || !TEST_POD_OTP) {
    throw new Error('Missing TEST_DELIVERY_ID or TEST_POD_OTP');
  }
  if (!/^\d{4}$/.test(TEST_POD_OTP)) {
    throw new Error('TEST_POD_OTP must be exactly 4 digits');
  }

  const supabase = createClient(NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY);
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: TEST_RIDER_EMAIL,
    password: TEST_RIDER_PASSWORD,
  });
  if (signInError) throw signInError;

  const { data, error } = await supabase.rpc('verify_delivery_otp', {
    p_delivery_id: TEST_DELIVERY_ID,
    p_otp: TEST_POD_OTP,
  });

  if (error) {
    console.error('POD OTP ERROR:', error);
    process.exit(1);
  }

  console.log('POD OTP SUCCESS:', data);
}

main().catch((err) => {
  console.error('FATAL:', err);
  process.exit(1);
});
