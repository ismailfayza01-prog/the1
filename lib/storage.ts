// Supabase service layer for The 1000 platform
import { createClient } from './supabase/client';
import type { User, Business, Rider, Delivery, Transaction } from './types';

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

  useRide: async (id: string): Promise<boolean> => {
    const business = await businessService.getById(id);
    if (!business || business.rides_used >= business.rides_total) return false;

    await businessService.update(id, { rides_used: business.rides_used + 1 });
    return true;
  },

  addCredits: async (id: string, amount: number): Promise<boolean> => {
    const business = await businessService.getById(id);
    if (!business) return false;

    await businessService.update(id, { wallet_balance: business.wallet_balance + amount });
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
    });
  },

  updateStatus: async (id: string, status: 'available' | 'busy' | 'offline'): Promise<void> => {
    await riderService.update(id, { status });
  },
};

// Helper to enrich deliveries with business/rider names
async function enrichDeliveries(deliveries: Record<string, unknown>[]): Promise<Delivery[]> {
  if (!deliveries || deliveries.length === 0) return [];

  // Collect unique business and rider IDs
  const businessIds = [...new Set(deliveries.map(d => d.business_id as string).filter(Boolean))];
  const riderIds = [...new Set(deliveries.map(d => d.rider_id as string).filter(Boolean))];

  // Fetch names in parallel
  const [businessesResult, ridersResult] = await Promise.all([
    businessIds.length > 0
      ? getSupabase().from('businesses').select('id, name').in('id', businessIds)
      : { data: [] },
    riderIds.length > 0
      ? getSupabase().from('riders').select('id, name').in('id', riderIds)
      : { data: [] },
  ]);

  const businessMap = new Map((businessesResult.data || []).map((b: { id: string; name: string }) => [b.id, b.name]));
  const riderMap = new Map((ridersResult.data || []).map((r: { id: string; name: string }) => [r.id, r.name]));

  return deliveries.map(d => ({
    ...d,
    business_name: businessMap.get(d.business_id as string) || 'Unknown',
    rider_name: d.rider_id ? (riderMap.get(d.rider_id as string) || null) : null,
  })) as Delivery[];
}

// Delivery management
export const deliveryService = {
  getAll: async (): Promise<Delivery[]> => {
    const { data } = await getSupabase().from('deliveries').select('*');
    return enrichDeliveries(data || []);
  },

  getById: async (id: string): Promise<Delivery | undefined> => {
    const { data } = await getSupabase().from('deliveries').select('*').eq('id', id).single();
    if (!data) return undefined;
    const enriched = await enrichDeliveries([data]);
    return enriched[0];
  },

  getByBusinessId: async (businessId: string): Promise<Delivery[]> => {
    const { data } = await getSupabase()
      .from('deliveries')
      .select('*')
      .eq('business_id', businessId)
      .order('created_at', { ascending: false });
    return enrichDeliveries(data || []);
  },

  getByRiderId: async (riderId: string): Promise<Delivery[]> => {
    const { data } = await getSupabase()
      .from('deliveries')
      .select('*')
      .eq('rider_id', riderId)
      .order('created_at', { ascending: false });
    return enrichDeliveries(data || []);
  },

  getActive: async (): Promise<Delivery[]> => {
    const { data } = await getSupabase()
      .from('deliveries')
      .select('*')
      .in('status', ['pending', 'accepted', 'picked_up', 'in_transit']);
    return enrichDeliveries(data || []);
  },

  create: async (delivery: Omit<Delivery, 'id' | 'created_at'>): Promise<Delivery> => {
    // Remove denormalized name fields before inserting
    const { business_name: _bn, rider_name: _rn, ...insertData } = delivery as Delivery;
    const { data, error } = await getSupabase()
      .from('deliveries')
      .insert(insertData)
      .select()
      .single();
    if (error) throw error;
    const enriched = await enrichDeliveries([data]);
    return enriched[0];
  },

  update: async (id: string, updates: Partial<Delivery>): Promise<Delivery | null> => {
    // Remove denormalized name fields before updating
    const { business_name: _bn, rider_name: _rn, ...updateData } = updates as Partial<Delivery>;
    const { data } = await getSupabase()
      .from('deliveries')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();
    if (!data) return null;
    const enriched = await enrichDeliveries([data]);
    return enriched[0];
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
