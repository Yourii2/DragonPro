
export type UserRole = 'admin' | 'manager' | 'representative' | 'accountant';

export interface User {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  avatar: string;
  restricted_treasury_id: number | null; // 0 or null = all
  restricted_warehouse_id: number | null; // 0 or null = all
}

export interface Permission {
  page_slug: string;
  can_access: boolean;
}

export interface Customer {
  id: number;
  name: string;
  phone: string;
  address: string;
  governorate: string;
  landmark: string;
  balance: number;
}

export interface Supplier {
  id: number;
  name: string;
  phone: string;
  address: string;
  balance: number;
}

export interface Product {
  id: number;
  name: string;
  barcode: string;
  category: string;
  purchase_price: number;
  sale_price: number;
  stock_levels: { [warehouseId: number]: number };
}

export interface Warehouse {
  id: number;
  name: string;
  location: string;
}

export interface Treasury {
  id: number;
  name: string;
  balance: number;
}

export interface Transaction {
  id: string;
  date: string;
  type: 'sale' | 'purchase' | 'return_in' | 'return_out' | 'payment_in' | 'payment_out';
  amount: number;
  warehouse_id: number;
  treasury_id: number;
  status: 'completed' | 'pending' | 'postponed';
  details: string;
}
