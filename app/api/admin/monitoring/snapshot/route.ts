import { NextRequest, NextResponse } from 'next/server';
import { requireAdminRequest } from '@/lib/admin/auth';
import {
  buildMonitoringSnapshot,
  normalizeTimeZone,
  resolveMonitoringWindow,
} from '@/lib/admin/monitoring/compute';
import type {
  MonitoringAuditRow,
  MonitoringBusinessRow,
  MonitoringDeliveryOfferRow,
  MonitoringDeliveryRow,
  MonitoringRange,
  MonitoringRiderRow,
  MonitoringTransactionRow,
} from '@/lib/admin/monitoring/types';

const ACTIVE_STATUSES = ['pending', 'offered', 'accepted', 'picked_up', 'in_transit'];

function parseRange(raw: string | null): MonitoringRange {
  return raw === '7d' ? '7d' : 'today';
}

function firstErrorMessage(errors: Array<{ error: { message: string } | null }>): string | null {
  for (const item of errors) {
    if (item.error) return item.error.message;
  }
  return null;
}

export async function GET(request: NextRequest) {
  const guard = await requireAdminRequest(request);
  if (!guard.ok) return guard.response;

  const { sessionClient } = guard.context;
  const range = parseRange(request.nextUrl.searchParams.get('range'));
  const tz = normalizeTimeZone(request.nextUrl.searchParams.get('tz'));
  const now = new Date();
  const window = resolveMonitoringWindow(range, tz, now);
  const deliveredRecentStartIso = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

  const [deliveriesRangeResult, deliveriesActiveResult, deliveriesDeliveredRecentResult, ridersResult, businessesResult, transactionsResult, auditsResult] =
    await Promise.all([
      sessionClient
        .from('deliveries')
        .select(
          'id,business_id,rider_id,status,created_at,accepted_at,picked_up_at,completed_at,delivered_at,estimated_duration,payment_method,pod_method,pod_photo_url,pod_otp_verified_at,otp_verified,cod_collected_at'
        )
        .gte('created_at', window.range_start.toISOString()),
      sessionClient
        .from('deliveries')
        .select(
          'id,business_id,rider_id,status,created_at,accepted_at,picked_up_at,completed_at,delivered_at,estimated_duration,payment_method,pod_method,pod_photo_url,pod_otp_verified_at,otp_verified,cod_collected_at'
        )
        .in('status', ACTIVE_STATUSES),
      sessionClient
        .from('deliveries')
        .select(
          'id,business_id,rider_id,status,created_at,accepted_at,picked_up_at,completed_at,delivered_at,estimated_duration,payment_method,pod_method,pod_photo_url,pod_otp_verified_at,otp_verified,cod_collected_at'
        )
        .eq('status', 'delivered')
        .or(`completed_at.gte.${deliveredRecentStartIso},delivered_at.gte.${deliveredRecentStartIso}`),
      sessionClient.from('riders').select('id,name,status,last_seen_at'),
      sessionClient.from('businesses').select('id,name,wallet_balance,renewal_date'),
      sessionClient
        .from('transactions')
        .select('id,type,amount,status,created_at')
        .gte('created_at', window.today_start.toISOString()),
      sessionClient
        .from('admin_audit_logs')
        .select('id,action,admin_user_id,target_user_id,created_at,payload')
        .order('created_at', { ascending: false })
        .limit(100),
    ]);

  const loadError = firstErrorMessage([
    { error: deliveriesRangeResult.error },
    { error: deliveriesActiveResult.error },
    { error: deliveriesDeliveredRecentResult.error },
    { error: ridersResult.error },
    { error: businessesResult.error },
    { error: transactionsResult.error },
    { error: auditsResult.error },
  ]);

  if (loadError) {
    return NextResponse.json(
      { error: `Monitoring snapshot query failed: ${loadError}` },
      { status: 500 }
    );
  }

  const deliveriesById = new Map<string, MonitoringDeliveryRow>();
  const deliveryBatches = [
    deliveriesRangeResult.data ?? [],
    deliveriesActiveResult.data ?? [],
    deliveriesDeliveredRecentResult.data ?? [],
  ] as MonitoringDeliveryRow[][];

  for (const batch of deliveryBatches) {
    for (const row of batch) {
      deliveriesById.set(row.id, row);
    }
  }
  const deliveries = Array.from(deliveriesById.values());
  const deliveryIds = deliveries.map((row) => row.id);

  let offers: MonitoringDeliveryOfferRow[] = [];
  if (deliveryIds.length > 0) {
    const offersResult = await sessionClient
      .from('delivery_offers')
      .select('id,delivery_id,rider_user_id,status,offered_at')
      .in('delivery_id', deliveryIds);
    if (offersResult.error) {
      return NextResponse.json(
        { error: `Monitoring offers query failed: ${offersResult.error.message}` },
        { status: 500 }
      );
    }
    offers = (offersResult.data ?? []) as MonitoringDeliveryOfferRow[];
  }

  const snapshot = buildMonitoringSnapshot({
    range,
    tz,
    now,
    deliveries,
    riders: ((ridersResult.data ?? []) as MonitoringRiderRow[]),
    offers,
    businesses: ((businessesResult.data ?? []) as MonitoringBusinessRow[]),
    transactions: ((transactionsResult.data ?? []) as MonitoringTransactionRow[]),
    audits: ((auditsResult.data ?? []) as MonitoringAuditRow[]),
  });

  return NextResponse.json(snapshot);
}
