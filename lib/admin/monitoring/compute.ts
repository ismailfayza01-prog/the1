import type {
  AlertSeverity,
  MonitoringAlert,
  MonitoringAuditRow,
  MonitoringBusinessRow,
  MonitoringComputeInput,
  MonitoringDeliveryOfferRow,
  MonitoringDeliveryRow,
  MonitoringRange,
  MonitoringSnapshot,
  MonitoringWindow,
} from '@/lib/admin/monitoring/types';

const ACTIVE_DELIVERY_STATUSES = new Set([
  'pending',
  'offered',
  'accepted',
  'picked_up',
  'in_transit',
]);

const SUCCESS_DISPATCH_STATUSES = new Set([
  'accepted',
  'picked_up',
  'in_transit',
  'delivered',
]);

const MONITORED_FUNNEL_STATUSES = [
  'pending',
  'offered',
  'accepted',
  'picked_up',
  'in_transit',
  'delivered',
  'cancelled',
  'expired',
] as const;

const ALERT_SEVERITY_RANK: Record<AlertSeverity, number> = {
  high: 0,
  medium: 1,
  low: 2,
};

function coerceNumber(value: number | string | null | undefined): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

function getTimeZoneParts(date: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  const parts = formatter.formatToParts(date);
  const read = (type: Intl.DateTimeFormatPartTypes): number => {
    const raw = parts.find((part) => part.type === type)?.value;
    const parsed = raw ? Number(raw) : NaN;
    return Number.isFinite(parsed) ? parsed : 0;
  };

  return {
    year: read('year'),
    month: read('month'),
    day: read('day'),
    hour: read('hour'),
    minute: read('minute'),
    second: read('second'),
  };
}

function getTimeZoneOffsetMs(date: Date, timeZone: string): number {
  const parts = getTimeZoneParts(date, timeZone);
  const utcTimestamp = Date.UTC(
    parts.year,
    Math.max(0, parts.month - 1),
    parts.day,
    parts.hour,
    parts.minute,
    parts.second
  );
  return utcTimestamp - date.getTime();
}

function startOfDayInTimeZone(date: Date, timeZone: string): Date {
  const parts = getTimeZoneParts(date, timeZone);
  const utcMidnightGuess = new Date(Date.UTC(parts.year, Math.max(0, parts.month - 1), parts.day, 0, 0, 0));
  const offset = getTimeZoneOffsetMs(utcMidnightGuess, timeZone);
  return new Date(utcMidnightGuess.getTime() - offset);
}

function formatDayKey(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function formatHourBucket(date: Date, timeZone: string): string {
  const hour = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour12: false,
    hour: '2-digit',
  }).format(date);
  return `${hour}:00`;
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return sorted[mid];
}

function secondsBetween(later: Date, earlier: Date): number {
  return Math.max(0, Math.floor((later.getTime() - earlier.getTime()) / 1000));
}

function isValidTimeZone(value: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

export function normalizeTimeZone(timeZone: string | null | undefined): string {
  const trimmed = (timeZone ?? '').trim();
  if (!trimmed) return 'Africa/Casablanca';
  return isValidTimeZone(trimmed) ? trimmed : 'Africa/Casablanca';
}

export function resolveMonitoringWindow(range: MonitoringRange, timeZone: string, now = new Date()): MonitoringWindow {
  const tz = normalizeTimeZone(timeZone);
  const todayStart = startOfDayInTimeZone(now, tz);
  const rangeDays = range === '7d' ? 7 : 1;
  const rangeStart = addDays(todayStart, -(rangeDays - 1));
  const dayKeys = Array.from({ length: rangeDays }, (_, index) => formatDayKey(addDays(rangeStart, index), tz));

  return {
    now,
    tz,
    range,
    range_start: rangeStart,
    today_start: todayStart,
    range_days: rangeDays,
    day_keys: dayKeys,
  };
}

function buildOffersSummary(offers: MonitoringDeliveryOfferRow[]) {
  const map = new Map<string, { latestOfferedAt: Date | null; hasAccepted: boolean }>();

  for (const offer of offers) {
    const offeredAt = parseDate(offer.offered_at);
    const existing = map.get(offer.delivery_id) ?? { latestOfferedAt: null, hasAccepted: false };
    if (offeredAt && (!existing.latestOfferedAt || offeredAt.getTime() > existing.latestOfferedAt.getTime())) {
      existing.latestOfferedAt = offeredAt;
    }
    if (offer.status === 'accepted') {
      existing.hasAccepted = true;
    }
    map.set(offer.delivery_id, existing);
  }

  return map;
}

function hasPodEvidence(delivery: MonitoringDeliveryRow): boolean {
  return Boolean(
    delivery.pod_method ||
      delivery.pod_photo_url ||
      delivery.otp_verified ||
      delivery.pod_otp_verified_at
  );
}

function sortAlerts(alerts: MonitoringAlert[]): MonitoringAlert[] {
  return [...alerts].sort((a, b) => {
    const severityDiff = ALERT_SEVERITY_RANK[a.severity] - ALERT_SEVERITY_RANK[b.severity];
    if (severityDiff !== 0) return severityDiff;
    return b.age_seconds - a.age_seconds;
  });
}

function sortAudits(audits: MonitoringAuditRow[]) {
  return [...audits].sort((a, b) => {
    const aDate = parseDate(a.created_at)?.getTime() ?? 0;
    const bDate = parseDate(b.created_at)?.getTime() ?? 0;
    return bDate - aDate;
  });
}

export function buildMonitoringSnapshot(input: MonitoringComputeInput): MonitoringSnapshot {
  const window = resolveMonitoringWindow(input.range, input.tz, input.now ?? new Date());
  const now = window.now;
  const deliveredRecentCutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const renewalCutoff = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const deliveriesById = new Map<string, MonitoringDeliveryRow>();
  for (const delivery of input.deliveries) {
    deliveriesById.set(delivery.id, delivery);
  }
  const deliveries = Array.from(deliveriesById.values());

  const offersSummaryByDelivery = buildOffersSummary(input.offers);

  const activeDeliveries = deliveries.filter((delivery) => ACTIVE_DELIVERY_STATUSES.has(delivery.status));
  const deliveriesInRange = deliveries.filter((delivery) => {
    const createdAt = parseDate(delivery.created_at);
    return !!createdAt && createdAt.getTime() >= window.range_start.getTime();
  });

  const deliveredToday = deliveries.reduce((count, delivery) => {
    if (delivery.status !== 'delivered') return count;
    const completedAt = parseDate(delivery.completed_at) ?? parseDate(delivery.delivered_at);
    if (!completedAt) return count;
    return completedAt.getTime() >= window.today_start.getTime() ? count + 1 : count;
  }, 0);

  const acceptanceSeconds: number[] = [];
  for (const delivery of deliveriesInRange) {
    const createdAt = parseDate(delivery.created_at);
    const acceptedAt = parseDate(delivery.accepted_at);
    if (!createdAt || !acceptedAt) continue;
    if (acceptedAt.getTime() < createdAt.getTime()) continue;
    acceptanceSeconds.push(secondsBetween(acceptedAt, createdAt));
  }

  const successfulDispatches = deliveriesInRange.filter((delivery) => {
    if (delivery.accepted_at) return true;
    return SUCCESS_DISPATCH_STATUSES.has(delivery.status);
  }).length;
  const dispatchSuccessRate =
    deliveriesInRange.length === 0 ? 0 : successfulDispatches / deliveriesInRange.length;

  const cashInMadToday = input.transactions.reduce((sum, transaction) => {
    if (transaction.status !== 'completed') return sum;
    if (!['top_up', 'subscription'].includes(transaction.type)) return sum;
    const createdAt = parseDate(transaction.created_at);
    if (!createdAt || createdAt.getTime() < window.today_start.getTime()) return sum;
    return sum + coerceNumber(transaction.amount);
  }, 0);

  const alerts: MonitoringAlert[] = [];

  for (const delivery of activeDeliveries) {
    const createdAt = parseDate(delivery.created_at);
    if (!createdAt) continue;
    const ageSeconds = secondsBetween(now, createdAt);

    if (delivery.status === 'pending' && !delivery.rider_id && ageSeconds > 120) {
      alerts.push({
        id: `pending_unassigned:${delivery.id}`,
        type: 'pending_unassigned',
        severity: 'high',
        title: 'Pending delivery has no rider assignment',
        delivery_id: delivery.id,
        rider_id: null,
        business_id: delivery.business_id,
        age_seconds: ageSeconds,
        created_at: delivery.created_at,
        action_hint: 'Assign a rider or expire/cancel after verification.',
      });
    }

    if (delivery.status === 'offered') {
      const summary = offersSummaryByDelivery.get(delivery.id);
      const latestOfferedAt = summary?.latestOfferedAt ?? createdAt;
      const offeredAge = latestOfferedAt ? secondsBetween(now, latestOfferedAt) : ageSeconds;
      if (!summary?.hasAccepted && offeredAge > 30) {
        alerts.push({
          id: `offer_timeout:${delivery.id}`,
          type: 'offer_timeout',
          severity: 'high',
          title: 'Offer timeout without rider acceptance',
          delivery_id: delivery.id,
          rider_id: delivery.rider_id,
          business_id: delivery.business_id,
          age_seconds: offeredAge,
          created_at: latestOfferedAt.toISOString(),
          action_hint: 'Re-dispatch or manually assign a rider.',
        });
      }
    }

    if (delivery.status === 'picked_up' || delivery.status === 'in_transit') {
      const pickedUpAt = parseDate(delivery.picked_up_at) ?? parseDate(delivery.accepted_at);
      if (!pickedUpAt) continue;
      const elapsedSeconds = secondsBetween(now, pickedUpAt);
      const estimatedMinutes = Math.max(0, Math.floor(coerceNumber(delivery.estimated_duration)));
      const thresholdSeconds = Math.floor((estimatedMinutes * 1.5 + 5) * 60);
      if (elapsedSeconds > thresholdSeconds) {
        alerts.push({
          id: `transit_overdue:${delivery.id}`,
          type: 'transit_overdue',
          severity: 'medium',
          title: 'Transit duration exceeded expected threshold',
          delivery_id: delivery.id,
          rider_id: delivery.rider_id,
          business_id: delivery.business_id,
          age_seconds: elapsedSeconds,
          created_at: pickedUpAt.toISOString(),
          action_hint: 'Check rider position and contact rider or business.',
        });
      }
    }
  }

  for (const rider of input.riders) {
    if (rider.status !== 'available' && rider.status !== 'busy') continue;
    const lastSeenAt = parseDate(rider.last_seen_at);
    const staleSeconds = lastSeenAt ? secondsBetween(now, lastSeenAt) : Number.MAX_SAFE_INTEGER;
    if (staleSeconds > 5 * 60) {
      alerts.push({
        id: `rider_stale:${rider.id}`,
        type: 'rider_stale',
        severity: 'medium',
        title: 'Online rider has stale heartbeat',
        delivery_id: null,
        rider_id: rider.id,
        business_id: null,
        age_seconds: staleSeconds,
        created_at: rider.last_seen_at ?? new Date(0).toISOString(),
        action_hint: 'Ping rider and verify app connectivity.',
      });
    }
  }

  for (const delivery of deliveries) {
    if (delivery.status !== 'delivered') continue;
    const completionAt = parseDate(delivery.completed_at) ?? parseDate(delivery.delivered_at);
    if (!completionAt || completionAt.getTime() < deliveredRecentCutoff.getTime()) continue;
    const ageSeconds = secondsBetween(now, completionAt);

    if (!hasPodEvidence(delivery)) {
      alerts.push({
        id: `pod_missing:${delivery.id}`,
        type: 'pod_missing',
        severity: 'low',
        title: 'Delivered order has no proof of delivery',
        delivery_id: delivery.id,
        rider_id: delivery.rider_id,
        business_id: delivery.business_id,
        age_seconds: ageSeconds,
        created_at: completionAt.toISOString(),
        action_hint: 'Request rider proof and validate completion details.',
      });
    }

    if (delivery.payment_method === 'cod' && !delivery.cod_collected_at) {
      alerts.push({
        id: `cod_missing:${delivery.id}`,
        type: 'cod_missing',
        severity: 'medium',
        title: 'COD delivery missing collection timestamp',
        delivery_id: delivery.id,
        rider_id: delivery.rider_id,
        business_id: delivery.business_id,
        age_seconds: ageSeconds,
        created_at: completionAt.toISOString(),
        action_hint: 'Reconcile COD with rider and confirm collection status.',
      });
    }
  }

  const sortedAlerts = sortAlerts(alerts);

  const funnel = MONITORED_FUNNEL_STATUSES.reduce(
    (acc, status) => {
      acc[status] = 0;
      return acc;
    },
    {
      pending: 0,
      offered: 0,
      accepted: 0,
      picked_up: 0,
      in_transit: 0,
      delivered: 0,
      cancelled: 0,
      expired: 0,
    } as MonitoringSnapshot['funnel']
  );

  for (const delivery of deliveriesInRange) {
    if (delivery.status in funnel) {
      const status = delivery.status as keyof MonitoringSnapshot['funnel'];
      funnel[status] += 1;
    }
  }

  const hourlyBuckets = Array.from({ length: 24 }, (_, hour) => {
    const label = `${hour.toString().padStart(2, '0')}:00`;
    return { hour: label, count: 0 };
  });
  const hourlyIndex = new Map(hourlyBuckets.map((bucket, index) => [bucket.hour, index]));

  const acceptByDay = new Map<string, number[]>();
  const createdByDay = new Map<string, number>();
  const completedByDay = new Map<string, number>();
  for (const dayKey of window.day_keys) {
    acceptByDay.set(dayKey, []);
    createdByDay.set(dayKey, 0);
    completedByDay.set(dayKey, 0);
  }

  for (const delivery of deliveriesInRange) {
    const createdAt = parseDate(delivery.created_at);
    if (!createdAt) continue;

    const hourLabel = formatHourBucket(createdAt, window.tz);
    const hourSlot = hourlyIndex.get(hourLabel);
    if (typeof hourSlot === 'number') {
      hourlyBuckets[hourSlot].count += 1;
    }

    const dayKey = formatDayKey(createdAt, window.tz);
    if (!createdByDay.has(dayKey)) continue;
    createdByDay.set(dayKey, (createdByDay.get(dayKey) ?? 0) + 1);

    const acceptedAt = parseDate(delivery.accepted_at);
    if (acceptedAt && acceptedAt.getTime() >= createdAt.getTime()) {
      const existing = acceptByDay.get(dayKey) ?? [];
      existing.push(secondsBetween(acceptedAt, createdAt));
      acceptByDay.set(dayKey, existing);
    }

    if (delivery.status === 'delivered') {
      completedByDay.set(dayKey, (completedByDay.get(dayKey) ?? 0) + 1);
    }
  }

  const acceptP50ByDay = window.day_keys.map((day) => ({
    day,
    seconds: median(acceptByDay.get(day) ?? []),
  }));

  const completionRateByDay = window.day_keys.map((day) => {
    const created = createdByDay.get(day) ?? 0;
    const completed = completedByDay.get(day) ?? 0;
    return {
      day,
      rate: created === 0 ? 0 : completed / created,
    };
  });

  const available = input.riders.filter((rider) => rider.status === 'available').length;
  const busy = input.riders.filter((rider) => rider.status === 'busy').length;
  const offline = input.riders.filter((rider) => rider.status === 'offline').length;

  const staleOnlineRiders = input.riders
    .filter((rider) => rider.status === 'available' || rider.status === 'busy')
    .map((rider) => {
      const lastSeenAt = parseDate(rider.last_seen_at);
      const staleMinutes = lastSeenAt
        ? Math.floor(secondsBetween(now, lastSeenAt) / 60)
        : 999999;
      return {
        rider_id: rider.id,
        name: rider.name,
        last_seen_at: rider.last_seen_at,
        stale_minutes: staleMinutes,
      };
    })
    .filter((rider) => rider.stale_minutes > 5)
    .sort((a, b) => b.stale_minutes - a.stale_minutes)
    .slice(0, 25);

  const lowWallet = input.businesses
    .map((business: MonitoringBusinessRow) => ({
      business_id: business.id,
      name: business.name,
      wallet_balance: coerceNumber(business.wallet_balance),
    }))
    .filter((business) => business.wallet_balance < 100)
    .sort((a, b) => a.wallet_balance - b.wallet_balance)
    .slice(0, 25);

  const renewalDue = input.businesses
    .filter((business) => !!business.renewal_date)
    .map((business) => ({
      business_id: business.id,
      name: business.name,
      renewal_date: business.renewal_date as string,
    }))
    .filter((business) => {
      const renewalDate = parseDate(business.renewal_date);
      if (!renewalDate) return false;
      return renewalDate.getTime() >= now.getTime() && renewalDate.getTime() <= renewalCutoff.getTime();
    })
    .sort((a, b) => {
      const aDate = parseDate(a.renewal_date)?.getTime() ?? 0;
      const bDate = parseDate(b.renewal_date)?.getTime() ?? 0;
      return aDate - bDate;
    })
    .slice(0, 25);

  const audits = sortAudits(input.audits)
    .slice(0, 25)
    .map((audit) => ({
      id: audit.id,
      action: audit.action,
      admin_user_id: audit.admin_user_id,
      target_user_id: audit.target_user_id,
      created_at: audit.created_at,
      payload: audit.payload ?? {},
    }));

  const onlineRiders = available + busy;
  const onlineRatio = input.riders.length === 0 ? 0 : onlineRiders / input.riders.length;

  return {
    generated_at: now.toISOString(),
    range: input.range,
    kpis: {
      active_deliveries: activeDeliveries.length,
      active_incidents: sortedAlerts.length,
      online_riders: onlineRiders,
      online_ratio: onlineRatio,
      delivered_today: deliveredToday,
      dispatch_success_rate: dispatchSuccessRate,
      p50_accept_seconds: median(acceptanceSeconds),
      cash_in_mad_today: Number(cashInMadToday.toFixed(2)),
    },
    alerts: sortedAlerts,
    funnel,
    trends: {
      deliveries_by_hour: hourlyBuckets,
      accept_p50_by_day: acceptP50ByDay,
      completion_rate_by_day: completionRateByDay,
    },
    rider_health: {
      available,
      busy,
      offline,
      stale_online_riders: staleOnlineRiders,
    },
    business_watch: {
      low_wallet: lowWallet,
      renewal_due_7d: renewalDue,
    },
    recent_audit: audits,
  };
}
