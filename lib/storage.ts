// Supabase service layer for The 1000 platform
import { createClient } from './supabase/client';
import type { User, Business, Rider, Delivery, Transaction, DeliveryOffer } from './types';
import { getSubscriptionDetails } from './types';

function getSupabase() {
  return createClient();
}

// User management
export const userService = {
  getAll: async (): Promise<User[]> => {
    const { data } = await getSupabase().from('profiles').select('*');
    return (data as User[]) || [];
  },

  getById: async (id: string): Promise<User | undefined> => {
    const { data } = await getSupabase().from('profiles').select('*').eq('id', id).single();
    return (data as User) || undefined;
  },

  getByEmail: async (email: string): Promise<User | undefined> => {
    const { data } = await getSupabase().from('profiles').select('*').eq('email', email).single();
    return (data as User) || undefined;
  },

  login: async (email: string, password: string): Promise<User | null> => {
    const supabase = getSupabase();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return null;

    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) return null;

    const { data: profile } = await supabase.from('profiles').select('*').eq('id', authUser.id).single();
    return (profile as User) || null;
  },

  getCurrentUser: async (): Promise<User | null> => {
    const supabase = getSupabase();
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) return null;

    const { data: profile } = await supabase.from('profiles').select('*').eq('id', authUser.id).single();
    return (profile as User) || null;
  },

  logout: async (): Promise<void> => {
    await getSupabase().auth.signOut();
  },
};

// Business management
export const businessService = {
  getAll: async (): Promise<Business[]> => {
    const { data } = await getSupabase().from('businesses').select('*');
    return (data as Business[]) || [];
  },

  getById: async (id: string): Promise<Business | undefined> => {
    const { data } = await getSupabase().from('businesses').select('*').eq('id', id).single();
    return (data as Business) || undefined;
  },

  getByUserId: async (userId: string): Promise<Business | undefined> => {
    const { data } = await getSupabase().from('businesses').select('*').eq('user_id', userId).single();
    return (data as Business) || undefined;
  },

  update: async (id: string, updates: Partial<Business>): Promise<Business | null> => {
    const { data } = await getSupabase()
      .from('businesses')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    return (data as Business) || null;
  },

  // Atomic RPC call to use a ride from subscription quota
  useRide: async (id: string): Promise<boolean> => {
    const { data } = await getSupabase().rpc('use_ride', { p_business_id: id });
    return !!data;
  },

  // Add credits to wallet with transaction logging
  addCredits: async (id: string, amount: number, userId: string): Promise<boolean> => {
    if (amount <= 0) return false;
    const business = await businessService.getById(id);
    if (!business) return false;

    await businessService.update(id, { wallet_balance: business.wallet_balance + amount });
    await transactionService.create({
      user_id: userId,
      type: 'top_up',
      amount,
      payment_method: 'cash',
      status: 'completed',
      description: `Wallet top-up: +${amount} MAD`,
    });
    return true;
  },

  // Activate or upgrade a subscription
  subscribe: async (id: string, tier: 'monthly' | 'annual', userId: string): Promise<boolean> => {
    const details = getSubscriptionDetails(tier);
    const renewal_date = new Date();
    renewal_date.setDate(renewal_date.getDate() + details.duration_days);

    await businessService.update(id, {
      subscription_tier: tier,
      rides_total: details.rides,
      rides_used: 0,
      renewal_date: renewal_date.toISOString(),
    });

    await transactionService.create({
      user_id: userId,
      type: 'subscription',
      amount: details.price,
      payment_method: 'cash',
      status: 'completed',
      description: `${tier} subscription: ${details.rides} rides for ${details.price} MAD`,
    });

    return true;
  },

  // Charge wallet with atomic operation and transaction logging
  chargeWallet: async (id: string, amount: number, userId: string, description: string): Promise<boolean> => {
    const { data } = await getSupabase().rpc('charge_wallet', { p_business_id: id, p_amount: amount });
    if (!data) return false;

    await transactionService.create({
      user_id: userId,
      type: 'delivery_charge',
      amount,
      payment_method: 'wallet',
      status: 'completed',
      description,
    });

    return true;
  },
};

// Rider management
export const riderService = {
  getAll: async (): Promise<Rider[]> => {
    const { data } = await getSupabase().from('riders').select('*');
    return (data as Rider[]) || [];
  },

  getById: async (id: string): Promise<Rider | undefined> => {
    const { data } = await getSupabase().from('riders').select('*').eq('id', id).single();
    return (data as Rider) || undefined;
  },

  getByUserId: async (userId: string): Promise<Rider | undefined> => {
    const { data } = await getSupabase().from('riders').select('*').eq('user_id', userId).single();
    return (data as Rider) || undefined;
  },

  getAvailable: async (): Promise<Rider[]> => {
    const { data } = await getSupabase().from('riders').select('*').eq('status', 'available');
    return (data as Rider[]) || [];
  },

  update: async (id: string, updates: Partial<Rider>): Promise<Rider | null> => {
    const { data } = await getSupabase()
      .from('riders')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    return (data as Rider) || null;
  },

  updateLocation: async (id: string, location: { lat: number; lng: number }): Promise<void> => {
    await riderService.update(id, {
      current_location: location,
      last_location_update: new Date().toISOString(),
      last_lat: location.lat,
      last_lng: location.lng,
      last_seen_at: new Date().toISOString(),
    });
  },

  updateStatus: async (id: string, status: 'available' | 'busy' | 'offline'): Promise<void> => {
    await riderService.update(id, { status });
  },
};

// Delivery management
export const deliveryService = {
  getAll: async (): Promise<Delivery[]> => {
    const { data } = await getSupabase()
      .from('deliveries')
      .select('*, businesses(name), riders(name)');
      
    return (data || []).map((d: any) => ({
      ...d,
      business_name: d.businesses?.name || 'Unknown',
      rider_name: d.riders?.name || null,
    })) as Delivery[];
  },

  getById: async (id: string): Promise<Delivery | undefined> => {
    const { data } = await getSupabase()
      .from('deliveries')
      .select('*, businesses(name), riders(name)')
      .eq('id', id)
      .single();
      
    if (!data) return undefined;
    return {
      ...data,
      business_name: data.businesses?.name || 'Unknown',
      rider_name: data.riders?.name || null,
    } as Delivery;
  },

  getByBusinessId: async (businessId: string): Promise<Delivery[]> => {
    const { data } = await getSupabase()
      .from('deliveries')
      .select('*, businesses(name), riders(name)')
      .eq('business_id', businessId)
      .order('created_at', { ascending: false });
      
    return (data || []).map((d: any) => ({
      ...d,
      business_name: d.businesses?.name || 'Unknown',
      rider_name: d.riders?.name || null,
    })) as Delivery[];
  },

  getByRiderId: async (riderId: string): Promise<Delivery[]> => {
    const { data } = await getSupabase()
      .from('deliveries')
      .select('*, businesses(name), riders(name)')
      .eq('rider_id', riderId)
      .order('created_at', { ascending: false });
      
    return (data || []).map((d: any) => ({
      ...d,
      business_name: d.businesses?.name || 'Unknown',
      rider_name: d.riders?.name || null,
    })) as Delivery[];
  },

  getActive: async (): Promise<Delivery[]> => {
    const { data } = await getSupabase()
      .from('deliveries')
      .select('*, businesses(name), riders(name)')
      .in('status', ['pending', 'offered', 'accepted', 'picked_up', 'in_transit']);
      
    return (data || []).map((d: any) => ({
      ...d,
      business_name: d.businesses?.name || 'Unknown',
      rider_name: d.riders?.name || null,
    })) as Delivery[];
  },

  create: async (delivery: Omit<Delivery, 'id' | 'created_at'>): Promise<Delivery> => {
    // Remove denormalized name fields before inserting
    const { business_name: _bn, rider_name: _rn, ...insertData } = delivery as Delivery;
    const { data, error } = await getSupabase()
      .from('deliveries')
      .insert(insertData)
      .select('*, businesses(name), riders(name)')
      .single();
    if (error) throw error;
    
    return {
      ...data,
      business_name: data.businesses?.name || 'Unknown',
      rider_name: data.riders?.name || null,
    } as Delivery;
  },

  update: async (id: string, updates: Partial<Delivery>): Promise<Delivery | null> => {
    // Remove denormalized name fields before updating
    const { business_name: _bn, rider_name: _rn, ...updateData } = updates as Partial<Delivery>;
    const { data, error } = await getSupabase()
      .from('deliveries')
      .update(updateData)
      .eq('id', id)
      .select('*, businesses(name), riders(name)')
      .single();
    if (error) throw error;
    if (!data) return null;
    
    return {
      ...data,
      business_name: data.businesses?.name || 'Unknown',
      rider_name: data.riders?.name || null,
    } as Delivery;
  },

  assignRider: async (deliveryId: string, riderId: string): Promise<boolean> => {
    const rider = await riderService.getById(riderId);
    if (!rider) return false;

    await deliveryService.update(deliveryId, {
      rider_id: riderId,
      status: 'accepted',
      accepted_at: new Date().toISOString(),
    } as Partial<Delivery>);

    await riderService.updateStatus(riderId, 'busy');
    return true;
  },

  acceptDelivery: async (deliveryId: string, riderId: string): Promise<Delivery | null> => {
    const { data, error } = await getSupabase()
      .rpc('accept_delivery', { p_delivery_id: deliveryId, p_rider_id: riderId });
    if (error) throw error;
    if (!data) return null;

    const enriched = await deliveryService.getById(deliveryId);
    return enriched || null;
  },

  dispatchDelivery: async (deliveryId: string, preferredRiderUserId?: string | null): Promise<DeliveryOffer[]> => {
    const { data, error } = await getSupabase()
      .rpc('dispatch_delivery', { p_delivery_id: deliveryId, p_preferred_rider_user_id: preferredRiderUserId ?? null });
    if (error) throw error;
    return (data as DeliveryOffer[]) || [];
  },

  getMyOffers: async (): Promise<DeliveryOffer[]> => {
    const { data } = await getSupabase()
      .from('delivery_offers')
      .select('*')
      .order('offered_at', { ascending: false });
    return (data as DeliveryOffer[]) || [];
  },

  acceptOffer: async (offerId: string): Promise<Delivery | null> => {
    const { data, error } = await getSupabase()
      .rpc('rider_accept_offer', { p_offer_id: offerId });
    if (error) throw error;
    return (data as Delivery) || null;
  },

  refuseOffer: async (offerId: string): Promise<void> => {
    const { error } = await getSupabase()
      .rpc('rider_refuse_offer', { p_offer_id: offerId });
    if (error) throw error;
  },

  setDeliveryOtp: async (deliveryId: string, otp: string): Promise<{ delivery_id: string; expires_at: string } | null> => {
    const { data, error } = await getSupabase()
      .rpc('set_delivery_otp', { p_delivery_id: deliveryId, p_otp: otp });
    if (error) throw error;
    return (data as { delivery_id: string; expires_at: string }) || null;
  },

  verifyDeliveryOtp: async (deliveryId: string, otp: string): Promise<Delivery | null> => {
    const { data, error } = await getSupabase()
      .rpc('verify_delivery_otp', { p_delivery_id: deliveryId, p_otp: otp });
    if (error) throw error;
    return (data as Delivery) || null;
  },

  submitDeliveryPhoto: async (deliveryId: string, photoPath: string): Promise<Delivery | null> => {
    const { data, error } = await getSupabase()
      .rpc('submit_delivery_photo', { p_delivery_id: deliveryId, p_photo_url: photoPath });
    if (error) throw error;
    return (data as Delivery) || null;
  },
};

// Transaction management
export const transactionService = {
  getAll: async (): Promise<Transaction[]> => {
    const { data } = await getSupabase().from('transactions').select('*');
    return (data as Transaction[]) || [];
  },

  getByUserId: async (userId: string): Promise<Transaction[]> => {
    const { data } = await getSupabase()
      .from('transactions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    return (data as Transaction[]) || [];
  },

  create: async (transaction: Omit<Transaction, 'id' | 'created_at'>): Promise<Transaction> => {
    const { data, error } = await getSupabase()
      .from('transactions')
      .insert(transaction)
      .select()
      .single();
    if (error) throw error;
    return data as Transaction;
  },
};
