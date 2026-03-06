import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

function isAuthorized(request: NextRequest): boolean {
  const configured = (process.env.CRON_SECRET ?? '').trim();
  if (!configured) return false;

  const authHeader = request.headers.get('authorization') ?? '';
  const bearer = authHeader.toLowerCase().startsWith('bearer ')
    ? authHeader.slice(7).trim()
    : '';
  const vercelCron = request.headers.get('x-vercel-cron') ?? '';

  return bearer === configured || vercelCron === configured;
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, error: 'Unauthorized cron invocation' }, { status: 401 });
  }

  try {
    const adminClient = createAdminClient() as any;
    const { data, error } = await adminClient.rpc('cron_mark_stale_riders_offline', {
      p_stale_after: '30 minutes',
    });

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    const updatedCount = Array.isArray(data) && data.length > 0 && typeof data[0]?.updated_count === 'number'
      ? data[0].updated_count
      : 0;

    return NextResponse.json(
      {
        ok: true,
        updated_count: updatedCount,
        executed_at: new Date().toISOString(),
      },
      { status: 200 }
    );
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'Cron execution failed',
      },
      { status: 500 }
    );
  }
}
