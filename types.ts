
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

export interface ProductVariant {
  id: number;
  product_id: number;       // FK → parent product
  name: string;             // denormalized parent name
  color: string | null;
  size: string | null;
  barcode: string | null;
  cost: number;
  cost_price: number;
  price: number;
  sale_price: number;
  reorderLevel: number;
  reorder_level?: number;
  stock: number;
  is_archived: number;
}

/** Parent product — contains variants */
export interface Product {
  id: number;
  name: string;
  category: string | null;
  description?: string | null;
  is_archived: number;
  variants: ProductVariant[];
}

/** Flat product shape (backward compat for POS / receiving) */
export interface FlatProduct {
  id: number;
  product_id: number;
  name: string;
  barcode: string | null;
  color: string | null;
  size: string | null;
  cost: number;
  cost_price: number;
  price: number;
  sale_price: number;
  reorderLevel: number;
  stock: number;
  category: string | null;
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
