// LocalStorage service for The 1000 platform
import type { User, Business, Rider, Delivery, Transaction } from './types';

const KEYS = {
  USERS: 'the1000_users',
  BUSINESSES: 'the1000_businesses',
  RIDERS: 'the1000_riders',
  DELIVERIES: 'the1000_deliveries',
  TRANSACTIONS: 'the1000_transactions',
  CURRENT_USER: 'the1000_current_user',
  RIDER_LOCATIONS: 'the1000_rider_locations',
} as const;

// Helper functions
function getItem<T>(key: string, defaultValue: T): T {
  if (typeof window === 'undefined') return defaultValue;
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : defaultValue;
  } catch {
    return defaultValue;
  }
}

function setItem<T>(key: string, value: T): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.error('Failed to save to localStorage:', error);
  }
}

// Initialize default data
export function initializeDefaultData() {
  const users = getItem<User[]>(KEYS.USERS, []);
  
  if (users.length === 0) {
    // Create default admin user
    const adminUser: User = {
      id: 'admin-1',
      email: 'admin@the1000.ma',
      role: 'admin',
      name: 'Ismail (Admin)',
      created_at: new Date().toISOString(),
    };
    
    // Create default business users
    const businessUser1: User = {
      id: 'business-1',
      email: 'pharmacie@example.ma',
      role: 'business',
      name: 'Pharmacie Centrale',
      created_at: new Date().toISOString(),
    };
    
    const businessUser2: User = {
      id: 'business-2',
      email: 'cafe@example.ma',
      role: 'business',
      name: 'Café des Arts',
      created_at: new Date().toISOString(),
    };
    
    // Create default rider users
    const riderUser1: User = {
      id: 'rider-1',
      email: 'rider1@the1000.ma',
      role: 'rider',
      name: 'Ahmed Benani',
      created_at: new Date().toISOString(),
    };
    
    const riderUser2: User = {
      id: 'rider-2',
      email: 'rider2@the1000.ma',
      role: 'rider',
      name: 'Youssef Tazi',
      created_at: new Date().toISOString(),
    };
    
    setItem(KEYS.USERS, [adminUser, businessUser1, businessUser2, riderUser1, riderUser2]);
    
    // Create default businesses
    const business1: Business = {
      id: 'biz-1',
      user_id: 'business-1',
      name: 'Pharmacie Centrale',
      subscription_tier: 'monthly',
      rides_used: 3,
      rides_total: 8,
      wallet_balance: 0,
      renewal_date: new Date(Date.now() + 25 * 24 * 60 * 60 * 1000).toISOString(),
      created_at: new Date().toISOString(),
    };
    
    const business2: Business = {
      id: 'biz-2',
      user_id: 'business-2',
      name: 'Café des Arts',
      subscription_tier: 'annual',
      rides_used: 12,
      rides_total: 96,
      wallet_balance: 180,
      renewal_date: new Date(Date.now() + 340 * 24 * 60 * 60 * 1000).toISOString(),
      created_at: new Date().toISOString(),
    };
    
    setItem(KEYS.BUSINESSES, [business1, business2]);
    
    // Create default riders
    const rider1: Rider = {
      id: 'rid-1',
      user_id: 'rider-1',
      name: 'Ahmed Benani',
      phone: '+212 6 12 34 56 78',
      status: 'available',
      total_deliveries: 45,
      free_rides_remaining: 0,
      current_location: { lat: 35.7595, lng: -5.8340 }, // Tangier center
      last_location_update: new Date().toISOString(),
      earnings_this_month: 2450,
      created_at: new Date().toISOString(),
    };
    
    const rider2: Rider = {
      id: 'rid-2',
      user_id: 'rider-2',
      name: 'Youssef Tazi',
      phone: '+212 6 98 76 54 32',
      status: 'busy',
      total_deliveries: 58,
      free_rides_remaining: 0,
      current_location: { lat: 35.7650, lng: -5.8250 },
      last_location_update: new Date().toISOString(),
      earnings_this_month: 3180,
      created_at: new Date().toISOString(),
    };
    
    setItem(KEYS.RIDERS, [rider1, rider2]);
    
    // Create sample deliveries
    const delivery1: Delivery = {
      id: 'del-1',
      business_id: 'biz-1',
      business_name: 'Pharmacie Centrale',
      rider_id: 'rid-2',
      rider_name: 'Youssef Tazi',
      pickup_address: 'Pharmacie Centrale, Avenue Mohammed V, Tangier',
      pickup_lat: 35.7650,
      pickup_lng: -5.8250,
      dropoff_address: '45 Rue de Fès, Tangier',
      dropoff_lat: 35.7700,
      dropoff_lng: -5.8180,
      estimated_duration: 15,
      actual_duration: null,
      price: 0,
      rider_commission: 15,
      status: 'in_transit',
      payment_method: 'subscription',
      created_at: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
      accepted_at: new Date(Date.now() - 8 * 60 * 1000).toISOString(),
      picked_up_at: new Date(Date.now() - 3 * 60 * 1000).toISOString(),
      completed_at: null,
    };
    
    const delivery2: Delivery = {
      id: 'del-2',
      business_id: 'biz-2',
      business_name: 'Café des Arts',
      rider_id: 'rid-1',
      rider_name: 'Ahmed Benani',
      pickup_address: 'Café des Arts, Boulevard Pasteur, Tangier',
      pickup_lat: 35.7700,
      pickup_lng: -5.8100,
      dropoff_address: '12 Avenue des FAR, Tangier',
      dropoff_lat: 35.7750,
      dropoff_lng: -5.8050,
      estimated_duration: 20,
      actual_duration: 18,
      price: 18,
      rider_commission: 14,
      status: 'delivered',
      payment_method: 'wallet',
      created_at: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
      accepted_at: new Date(Date.now() - 58 * 60 * 1000).toISOString(),
      picked_up_at: new Date(Date.now() - 50 * 60 * 1000).toISOString(),
      completed_at: new Date(Date.now() - 40 * 60 * 1000).toISOString(),
    };
    
    setItem(KEYS.DELIVERIES, [delivery1, delivery2]);
    setItem(KEYS.TRANSACTIONS, []);
  }
}

// User management
export const userService = {
  getAll: (): User[] => getItem(KEYS.USERS, []),
  
  getById: (id: string): User | undefined => {
    const users = getItem<User[]>(KEYS.USERS, []);
    return users.find(u => u.id === id);
  },
  
  getByEmail: (email: string): User | undefined => {
    const users = getItem<User[]>(KEYS.USERS, []);
    return users.find(u => u.email === email);
  },
  
  login: (email: string, password: string): User | null => {
    // Mock authentication - in real app, verify password hash
    const user = userService.getByEmail(email);
    if (user) {
      setItem(KEYS.CURRENT_USER, user);
      return user;
    }
    return null;
  },
  
  getCurrentUser: (): User | null => {
    return getItem<User | null>(KEYS.CURRENT_USER, null);
  },
  
  logout: (): void => {
    localStorage.removeItem(KEYS.CURRENT_USER);
  },
};

// Business management
export const businessService = {
  getAll: (): Business[] => getItem(KEYS.BUSINESSES, []),
  
  getById: (id: string): Business | undefined => {
    const businesses = getItem<Business[]>(KEYS.BUSINESSES, []);
    return businesses.find(b => b.id === id);
  },
  
  getByUserId: (userId: string): Business | undefined => {
    const businesses = getItem<Business[]>(KEYS.BUSINESSES, []);
    return businesses.find(b => b.user_id === userId);
  },
  
  update: (id: string, updates: Partial<Business>): Business | null => {
    const businesses = getItem<Business[]>(KEYS.BUSINESSES, []);
    const index = businesses.findIndex(b => b.id === id);
    if (index === -1) return null;
    
    businesses[index] = { ...businesses[index], ...updates };
    setItem(KEYS.BUSINESSES, businesses);
    return businesses[index];
  },
  
  useRide: (id: string): boolean => {
    const business = businessService.getById(id);
    if (!business || business.rides_used >= business.rides_total) return false;
    
    businessService.update(id, { rides_used: business.rides_used + 1 });
    return true;
  },
  
  addCredits: (id: string, amount: number): boolean => {
    const business = businessService.getById(id);
    if (!business) return false;
    
    businessService.update(id, { wallet_balance: business.wallet_balance + amount });
    return true;
  },
};

// Rider management
export const riderService = {
  getAll: (): Rider[] => getItem(KEYS.RIDERS, []),
  
  getById: (id: string): Rider | undefined => {
    const riders = getItem<Rider[]>(KEYS.RIDERS, []);
    return riders.find(r => r.id === id);
  },
  
  getByUserId: (userId: string): Rider | undefined => {
    const riders = getItem<Rider[]>(KEYS.RIDERS, []);
    return riders.find(r => r.user_id === userId);
  },
  
  getAvailable: (): Rider[] => {
    const riders = getItem<Rider[]>(KEYS.RIDERS, []);
    return riders.filter(r => r.status === 'available');
  },
  
  update: (id: string, updates: Partial<Rider>): Rider | null => {
    const riders = getItem<Rider[]>(KEYS.RIDERS, []);
    const index = riders.findIndex(r => r.id === id);
    if (index === -1) return null;
    
    riders[index] = { ...riders[index], ...updates };
    setItem(KEYS.RIDERS, riders);
    return riders[index];
  },
  
  updateLocation: (id: string, location: { lat: number; lng: number }): void => {
    riderService.update(id, {
      current_location: location,
      last_location_update: new Date().toISOString(),
    });
  },
  
  updateStatus: (id: string, status: 'available' | 'busy' | 'offline'): void => {
    riderService.update(id, { status });
  },
};

// Delivery management
export const deliveryService = {
  getAll: (): Delivery[] => getItem(KEYS.DELIVERIES, []),
  
  getById: (id: string): Delivery | undefined => {
    const deliveries = getItem<Delivery[]>(KEYS.DELIVERIES, []);
    return deliveries.find(d => d.id === id);
  },
  
  getByBusinessId: (businessId: string): Delivery[] => {
    const deliveries = getItem<Delivery[]>(KEYS.DELIVERIES, []);
    return deliveries.filter(d => d.business_id === businessId).sort((a, b) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  },
  
  getByRiderId: (riderId: string): Delivery[] => {
    const deliveries = getItem<Delivery[]>(KEYS.DELIVERIES, []);
    return deliveries.filter(d => d.rider_id === riderId).sort((a, b) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  },
  
  getActive: (): Delivery[] => {
    const deliveries = getItem<Delivery[]>(KEYS.DELIVERIES, []);
    return deliveries.filter(d => ['pending', 'accepted', 'picked_up', 'in_transit'].includes(d.status));
  },
  
  create: (delivery: Omit<Delivery, 'id' | 'created_at'>): Delivery => {
    const deliveries = getItem<Delivery[]>(KEYS.DELIVERIES, []);
    const newDelivery: Delivery = {
      ...delivery,
      id: `del-${Date.now()}`,
      created_at: new Date().toISOString(),
    };
    deliveries.push(newDelivery);
    setItem(KEYS.DELIVERIES, deliveries);
    return newDelivery;
  },
  
  update: (id: string, updates: Partial<Delivery>): Delivery | null => {
    const deliveries = getItem<Delivery[]>(KEYS.DELIVERIES, []);
    const index = deliveries.findIndex(d => d.id === id);
    if (index === -1) return null;
    
    deliveries[index] = { ...deliveries[index], ...updates };
    setItem(KEYS.DELIVERIES, deliveries);
    return deliveries[index];
  },
  
  assignRider: (deliveryId: string, riderId: string): boolean => {
    const rider = riderService.getById(riderId);
    if (!rider) return false;
    
    deliveryService.update(deliveryId, {
      rider_id: riderId,
      rider_name: rider.name,
      status: 'accepted',
      accepted_at: new Date().toISOString(),
    });
    
    riderService.updateStatus(riderId, 'busy');
    return true;
  },
};

// Transaction management
export const transactionService = {
  getAll: (): Transaction[] => getItem(KEYS.TRANSACTIONS, []),
  
  getByUserId: (userId: string): Transaction[] => {
    const transactions = getItem<Transaction[]>(KEYS.TRANSACTIONS, []);
    return transactions.filter(t => t.user_id === userId).sort((a, b) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  },
  
  create: (transaction: Omit<Transaction, 'id' | 'created_at'>): Transaction => {
    const transactions = getItem<Transaction[]>(KEYS.TRANSACTIONS, []);
    const newTransaction: Transaction = {
      ...transaction,
      id: `txn-${Date.now()}`,
      created_at: new Date().toISOString(),
    };
    transactions.push(newTransaction);
    setItem(KEYS.TRANSACTIONS, transactions);
    return newTransaction;
  },
};
