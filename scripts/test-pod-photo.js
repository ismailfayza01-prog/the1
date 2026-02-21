import { createClient } from '@supabase/supabase-js';
import { readFile } from 'node:fs/promises';
import crypto from 'node:crypto';

const {
  NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY,
  TEST_RIDER_EMAIL,
  TEST_RIDER_PASSWORD,
  TEST_DELIVERY_ID,
  TEST_PHOTO_PATH,
} = process.env;

async function main() {
  if (!NEXT_PUBLIC_SUPABASE_URL || !NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY');
  }
  if (!TEST_RIDER_EMAIL || !TEST_RIDER_PASSWORD) {
    throw new Error('Missing TEST_RIDER_EMAIL or TEST_RIDER_PASSWORD');
  }
  if (!TEST_DELIVERY_ID || !TEST_PHOTO_PATH) {
    throw new Error('Missing TEST_DELIVERY_ID or TEST_PHOTO_PATH');
  }

  const supabase = createClient(NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY);
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: TEST_RIDER_EMAIL,
    password: TEST_RIDER_PASSWORD,
  });
  if (signInError) throw signInError;

  const file = await readFile(TEST_PHOTO_PATH);
  const key = `${TEST_DELIVERY_ID}/${crypto.randomUUID()}.jpg`;

  const { error: uploadError } = await supabase.storage
    .from('delivery-pod')
    .upload(key, file, { contentType: 'image/jpeg', upsert: false });

  if (uploadError) {
    console.error('UPLOAD ERROR:', uploadError);
    process.exit(1);
  }

  const { data, error } = await supabase.rpc('submit_delivery_photo', {
    p_delivery_id: TEST_DELIVERY_ID,
    p_photo_url: key,
  });

  if (error) {
    console.error('POD PHOTO ERROR:', error);
    process.exit(1);
  }

  console.log('POD PHOTO SUCCESS:', data);
}

main().catch((err) => {
  console.error('FATAL:', err);
  process.exit(1);
});
