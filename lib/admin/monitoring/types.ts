export type MonitoringRange = 'today' | '7d';

export type AlertSeverity = 'high' | 'medium' | 'low';

export type AlertType =
  | 'pending_unassigned'
  | 'offer_timeout'
  | 'rider_stale'
  | 'transit_overdue'
  | 'pod_missing'
  | 'cod_missing';

export interface MonitoringAlert {
  id: string;
  type: AlertType;
  severity: AlertSeverity;
  title: string;
  delivery_id: string | null;
  rider_id: string | null;
  business_id: string | null;
  age_seconds: number;
  created_at: string;
  action_hint: string;
}

export interface MonitoringSnapshot {
  generated_at: string;
  range: MonitoringRange;
  kpis: {
    active_deliveries: number;
    active_incidents: number;
    online_riders: number;
    online_ratio: number;
    delivered_today: number;
    dispatch_success_rate: number;
    p50_accept_seconds: number | null;
    cash_in_mad_today: number;
  };
  alerts: MonitoringAlert[];
  funnel: {
    pending: number;
    offered: number;
    accepted: number;
    picked_up: number;
    in_transit: number;
    delivered: number;
    cancelled: number;
    expired: number;
  };
  trends: {
    deliveries_by_hour: Array<{ hour: string; count: number }>;
    accept_p50_by_day: Array<{ day: string; seconds: number | null }>;
    completion_rate_by_day: Array<{ day: string; rate: number }>;
  };
  rider_health: {
    available: number;
    busy: number;
    offline: number;
    stale_online_riders: Array<{
      rider_id: string;
      name: string;
      last_seen_at: string | null;
      stale_minutes: number;
    }>;
  };
  business_watch: {
    low_wallet: Array<{
      business_id: string;
      name: string;
      wallet_balance: number;
    }>;
    renewal_due_7d: Array<{
      business_id: string;
      name: string;
      renewal_date: string;
    }>;
  };
  recent_audit: Array<{
    id: number;
    action: string;
    admin_user_id: string | null;
    target_user_id: string | null;
    created_at: string;
    payload: Record<string, unknown>;
  }>;
}

export interface MonitoringDeliveryRow {
  id: string;
  business_id: string;
  rider_id: string | null;
  status: string;
  created_at: string;
  accepted_at: string | null;
  picked_up_at: string | null;
  completed_at: string | null;
  delivered_at?: string | null;
  estimated_duration: number | null;
  payment_method: string | null;
  pod_method?: string | null;
  pod_photo_url?: string | null;
  pod_otp_verified_at?: string | null;
  otp_verified?: boolean | null;
  cod_collected_at?: string | null;
}

export interface MonitoringRiderRow {
  id: string;
  name: string;
  status: string;
  last_seen_at: string | null;
}

export interface MonitoringDeliveryOfferRow {
  id: string;
  delivery_id: string;
  rider_user_id: string;
  status: string;
  offered_at: string;
}

export interface MonitoringBusinessRow {
  id: string;
  name: string;
  wallet_balance: number | string | null;
  renewal_date: string | null;
}

export interface MonitoringTransactionRow {
  id: string;
  type: string;
  amount: number | string | null;
  status: string;
  created_at: string;
}

export interface MonitoringAuditRow {
  id: number;
  action: string;
  admin_user_id: string | null;
  target_user_id: string | null;
  created_at: string;
  payload: Record<string, unknown> | null;
}

export interface MonitoringWindow {
  now: Date;
  tz: string;
  range: MonitoringRange;
  range_start: Date;
  today_start: Date;
  range_days: number;
  day_keys: string[];
}

export interface MonitoringComputeInput {
  range: MonitoringRange;
  tz: string;
  now?: Date;
  deliveries: MonitoringDeliveryRow[];
  riders: MonitoringRiderRow[];
  offers: MonitoringDeliveryOfferRow[];
  businesses: MonitoringBusinessRow[];
  transactions: MonitoringTransactionRow[];
  audits: MonitoringAuditRow[];
}
