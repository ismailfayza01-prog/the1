import { createBrowserClient } from '@supabase/ssr';

let cachedClient: ReturnType<typeof createBrowserClient> | null = null;

export function createClient() {
  if (cachedClient) return cachedClient;

  const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').trim();
  const supabasePublishableKey =
    (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY ??
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
      '').trim();

  if (!supabaseUrl || !supabasePublishableKey) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY (fallback: NEXT_PUBLIC_SUPABASE_ANON_KEY)');
  }

  cachedClient = createBrowserClient(supabaseUrl, supabasePublishableKey);
  return cachedClient;
}
