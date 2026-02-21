import { createClient } from '@supabase/supabase-js';

const {
  NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY,
  TEST_BUSINESS_EMAIL,
  TEST_BUSINESS_PASSWORD,
  TEST_WALLET_DELIVERY_ID,
} = process.env;

async function main() {
  if (!NEXT_PUBLIC_SUPABASE_URL || !NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY');
  }
  if (!TEST_BUSINESS_EMAIL || !TEST_BUSINESS_PASSWORD) {
    throw new Error('Missing TEST_BUSINESS_EMAIL or TEST_BUSINESS_PASSWORD');
  }
  if (!TEST_WALLET_DELIVERY_ID) {
    throw new Error('Missing TEST_WALLET_DELIVERY_ID');
  }

  const supabase = createClient(NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY);
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: TEST_BUSINESS_EMAIL,
    password: TEST_BUSINESS_PASSWORD,
  });
  if (signInError) throw signInError;

  // Attempt direct delivered transition (should be blocked by unified guard)
  const { data, error } = await supabase
    .from('deliveries')
    .update({ status: 'delivered' })
    .eq('id', TEST_WALLET_DELIVERY_ID)
    .select();

  if (error) {
    console.log('WALLET GUARD BLOCKED (expected):', error.message || error);
    process.exit(0);
  }

  console.error('UNEXPECTED SUCCESS:', data);
  process.exit(1);
}

main().catch((err) => {
  console.error('FATAL:', err);
  process.exit(1);
});
