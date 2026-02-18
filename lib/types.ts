// Shared types for The 1000 platform

export type UserRole = 'admin' | 'business' | 'rider';

export type RiderStatus = 'available' | 'busy' | 'offline';

export type DeliveryStatus = 'pending' | 'accepted' | 'picked_up' | 'in_transit' | 'delivered' | 'cancelled';

export type SubscriptionTier = 'monthly' | 'annual' | 'none';

export type PaymentMethod = 'subscription' | 'wallet' | 'pack' | 'payg';

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
  pickup_lat: number;
  pickup_lng: number;
  dropoff_address: string;
  dropoff_lat: number;
  dropoff_lng: number;
  estimated_duration: number; // minutes
  actual_duration: number | null; // minutes
  price: number; // MAD
  rider_commission: number; // MAD
  status: DeliveryStatus;
  payment_method: PaymentMethod;
  created_at: string;
  accepted_at: string | null;
  picked_up_at: string | null;
  completed_at: string | null;
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
export function getRiderCommission(monthlyDeliveries: number): number {
  if (monthlyDeliveries >= 200) return 17;
  if (monthlyDeliveries >= 71) return 16;
  if (monthlyDeliveries >= 31) return 15;
  return 14;
}

export function calculateDeliveryPrice(durationMinutes: number, paymentMethod: PaymentMethod): number {
  const hours = durationMinutes / 60;
  
  switch (paymentMethod) {
    case 'subscription':
      return 0; // Covered by subscription
    case 'wallet':
      return Math.ceil(hours * 2) * 18; // 18 MAD per 30 min
    case 'pack':
      return Math.ceil(hours * 2) * 20; // 20 MAD per 30 min
    case 'payg':
      return Math.ceil(hours * 2) * 25; // 25 MAD per 30 min
    default:
      return 0;
  }
}

export function getSubscriptionDetails(tier: SubscriptionTier): { price: number; rides: number; duration_days: number } {
  switch (tier) {
    case 'monthly':
      return { price: 200, rides: 8, duration_days: 30 };
    case 'annual':
      return { price: 1800, rides: 96, duration_days: 365 };
    default:
      return { price: 0, rides: 0, duration_days: 0 };
  }
}
