// Shared types for The 1000 platform

export type UserRole = 'admin' | 'business' | 'rider';

export type RiderStatus = 'available' | 'busy' | 'offline';

export type DeliveryStatus = 'pending' | 'offered' | 'accepted' | 'picked_up' | 'in_transit' | 'delivered' | 'cancelled' | 'expired';

export type SubscriptionTier = 'monthly' | 'trimestrial' | 'semestrial' | 'annual' | 'none';

export type PaymentMethod = 'subscription' | 'wallet' | 'pack' | 'payg' | 'cod';

export interface User {
  id: string;
  email: string;
  role: UserRole;
  name: string;
  created_at: string;
}

export interface Business {
  id: string;
  user_id: string;
  name: string;
  address?: string | null;
  location_lat?: number | null;
  location_lng?: number | null;
  location_pinned_at?: string | null;
  subscription_tier: SubscriptionTier;
  rides_used: number;
  rides_total: number;
  wallet_balance: number;
  renewal_date: string | null;
  created_at: string;
}

export interface Rider {
  id: string;
  user_id: string;
  name: string;
  phone: string;
  status: RiderStatus;
  total_deliveries: number;
  free_rides_remaining: number;
  current_location: {
    lat: number;
    lng: number;
  } | null;
  last_lat?: number | null;
  last_lng?: number | null;
  last_seen_at?: string | null;
  last_location_update: string | null;
  earnings_this_month: number;
  created_at: string;
}

export interface Delivery {
  id: string;
  business_id: string;
  business_name: string;
  rider_id: string | null;
  rider_name: string | null;
  pickup_address: string;
  pickup_lat: number | null;
  pickup_lng: number | null;
  dropoff_address: string;
  dropoff_phone: string | null;
  note: string | null;
  dropoff_lat: number | null;
  dropoff_lng: number | null;
  estimated_duration: number; // minutes
  actual_duration: number | null; // minutes
  price: number; // MAD
  rider_commission: number; // MAD
  status: DeliveryStatus;
  payment_method: PaymentMethod;
  created_at: string;
  accepted_at: string | null;
  picked_up_at: string | null;
  delivered_at?: string | null;
  completed_at: string | null;
  pod_photo_url?: string | null;
  pod_otp_verified_at?: string | null;
}

export interface Transaction {
  id: string;
  user_id: string;
  type: 'subscription' | 'top_up' | 'commission' | 'payout' | 'delivery_charge';
  amount: number;
  payment_method: string;
  status: 'pending' | 'completed' | 'failed';
  description: string;
  created_at: string;
}

export interface DeliveryOffer {
  id: string;
  delivery_id: string;
  rider_user_id: string;
  status: 'offered' | 'accepted' | 'rejected' | 'expired';
  offered_at: string;
  responded_at: string | null;
}

export interface RiderLocation {
  id: string;
  rider_id: string;
  location: {
    lat: number;
    lng: number;
  };
  heading: number;
  speed: number;
  accuracy: number;
  timestamp: string;
}

// Helper functions
export const RIDER_COMMISSION_BASE = 12.5;
export const RIDER_COMMISSION_STEP = 0.5;
export const RIDER_COMMISSION_STEP_DELIVERIES = 20;
export const RIDER_COMMISSION_MAX = 17;

export function getRiderCommission(monthlyDeliveries: number): number {
  const deliveries = Math.max(0, Math.floor(monthlyDeliveries));
  const steps = Math.floor(deliveries / RIDER_COMMISSION_STEP_DELIVERIES);
  const uncapped = RIDER_COMMISSION_BASE + (steps * RIDER_COMMISSION_STEP);
  return Math.min(RIDER_COMMISSION_MAX, uncapped);
}

export function calculateDeliveryPrice(durationMinutes: number, paymentMethod: PaymentMethod): number {
  const halfHourUnits = Math.max(1, Math.ceil(durationMinutes / 30));

  switch (paymentMethod) {
    case 'subscription':
      return 0; // Covered by subscription
    case 'wallet':
      return halfHourUnits * 18; // Wallet+ floor rate (volume tiers can be higher)
    case 'pack':
      return halfHourUnits * 25; // Pack rate
    case 'payg':
      return halfHourUnits * 30; // Pay-on-use rate
    default:
      return 0;
  }
}

export function getWalletUnitRate(walletBalance: number): number {
  if (walletBalance >= 5000) return 18;
  if (walletBalance >= 3000) return 20;
  if (walletBalance >= 1500) return 22;
  return 25;
}

export function getSubscriptionDetails(tier: SubscriptionTier): { price: number; rides: number; duration_days: number } {
  switch (tier) {
    case 'monthly':
      return { price: 200, rides: 8, duration_days: 30 };
    case 'trimestrial':
      return { price: 600, rides: 24, duration_days: 90 };
    case 'semestrial':
      return { price: 1200, rides: 48, duration_days: 180 };
    case 'annual':
      return { price: 2400, rides: 96, duration_days: 365 };
    default:
      return { price: 0, rides: 0, duration_days: 0 };
  }
}
