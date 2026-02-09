
import React from 'react';

import { LayoutDashboard, Users, ShoppingCart, Package, Truck, Briefcase, Settings, ShieldCheck, Wallet, BarChart3, Fingerprint, QrCode } from 'lucide-react';

export const MENU_ITEMS = [
  {
    id: 'dashboard',
    label: 'لوحه التحكم',
    icon: <LayoutDashboard className="w-5 h-5" />,
    slug: 'dashboard'
  },
  {
    id: 'factory-stock',
    label: 'مخزون المصنع',
    icon: <Package className="w-5 h-5" />,
    slug: 'factory-stock',
    subItems: [
      { label: 'الاقمشه', slug: 'fabrics' },
      { label: 'الاكسسوارات', slug: 'accessories' },
      { label: 'المنتجات', slug: 'products' }
    ]
  },
  {
    id: 'factory-management',
    label: 'اداره المصنع',
    icon: <Settings className="w-5 h-5" />,
    slug: 'factory-management',
    subItems: [
      { label: 'مراحل الانتاج', slug: 'production-stages' },
      { label: 'الالوان', slug: 'colors' },
      { label: 'المقاسات', slug: 'sizes' }
    ]
  },
  {
    id: 'manufacturing-management',
    label: 'اداره التصنيع',
    icon: <BarChart3 className="w-5 h-5" />,
    slug: 'manufacturing-management',
    subItems: [
      { label: 'مرحله القص', slug: 'cutting-stage' },
      { label: 'مراحل التصنيع', slug: 'manufacturing-stages' },
      { label: 'تجميع المنتج', slug: 'assembly' }
    ]
  },
  {
    id: 'dispatch',
    label: 'ارسال المنتجات',
    icon: <Truck className="w-5 h-5" />,
    slug: 'dispatch'
  },
  {
    id: 'factory-receiving',
    label: 'استلام من المصنع',
    icon: <Truck className="w-5 h-5" />,
    slug: 'factory-receiving'
  },
  {
    id: 'inventory',
    label: 'المخزون و المستودعات',
    icon: <Package className="w-5 h-5" />,
    slug: 'inventory',
    subItems: [
      { label: 'حاله المخزون', slug: 'stock' },
      { label: 'المستودعات', slug: 'warehouses' },
      { label: 'تحويل', slug: 'transfer' },
      { label: 'استلام', slug: 'receiving' },
      { label: 'مرتجع', slug: 'returns' },
      { label: 'جرد', slug: 'audit' }
    ]
  },
  {
    id: 'orders',
    label: 'الطلبيات',
    icon: <ShoppingCart className="w-5 h-5" />,
    slug: 'orders',
    subItems: [
      { label: 'انشاء طلبيه', slug: 'new-order' },
      { label: 'اداره الطلبيات', slug: 'manage-orders' },
      { label: 'استيراد الطلبيات', slug: 'import-orders' }
    ]
  },
  {
    id: 'sales',
    label: 'المبيعات',
    icon: <Briefcase className="w-5 h-5" />,
    slug: 'sales',
    subItems: [
      { label: 'يوميه البيع', slug: 'sales-daily' },
      { label: 'تحديث حاله الطلبيه', slug: 'sales-update-status' },
      { label: 'تقرير البيع', slug: 'sales-report' }
    ]
  },
  {
    id: 'crm',
    label: 'اداره العملاء',
    icon: <Users className="w-5 h-5" />,
    slug: 'crm',
    subItems: [
      { label: 'قائمه العملاء', slug: 'list' },
      { label: 'كشف حساب عميل', slug: 'ledger' }
    ]
  },
  {
    id: 'srm',
    label: 'اداره الموردين',
    icon: <Truck className="w-5 h-5" />,
    slug: 'srm',
    subItems: [
      { label: 'قائمه الموردين', slug: 'list' },
      { label: 'كشف حساب مورد', slug: 'ledger' }
    ]
  },
  {
    id: 'reps',
    label: 'المناديب',
    icon: <Users className="w-5 h-5" />,
    slug: 'reps',
    subItems: [
      { label: 'قائمه المناديب', slug: 'list' },
      { label: 'عهده المندوب', slug: 'custody' },
      { label: 'معاملات المندوب', slug: 'transactions' },
      { label: 'دوره عمل المندوب', slug: 'rep-cycle' }
    ]
  },
  {
    id: 'hrm',
    label: 'اداره الموظفين',
    icon: <Briefcase className="w-5 h-5" />,
    slug: 'hrm',
    subItems: [
      { label: 'الموظفين', slug: 'employees' },
      { label: 'الرواتب', slug: 'salaries' },
      { label: 'معاملات الموظفين', slug: 'loans' },
      { label: 'تقرير الرواتب', slug: 'salary-report' }
    ]
  },
  {
    id: 'workers',
    label: 'العمال',
    icon: <Briefcase className="w-5 h-5" />,
    slug: 'workers',
    subItems: [
      { label: 'قائمه العمال', slug: 'list' },
      { label: 'الرواتب', slug: 'salaries' },
      { label: 'معاملات العمال', slug: 'transactions' },
      { label: 'تقرير الرواتب', slug: 'salary-report' }
    ]
  },
  {
    id: 'finance',
    label: 'الماليه و الخزينه',
    icon: <Wallet className="w-5 h-5" />,
    slug: 'finance',
    subItems: [
      { label: 'اداره الخزائن', slug: 'treasuries' },
      { label: 'الايرادات و المصروفات', slug: 'transactions' }
    ]
  },
  {
    id: 'reports',
    label: 'التقارير',
    icon: <BarChart3 className="w-5 h-5" />,
    slug: 'reports',
    subItems: [
      { label: 'تقرير المبيعات', slug: 'sales' },
      { label: 'تقرير المخزون', slug: 'inventory' },
      { label: 'تقرير الماليه', slug: 'finance' },
      { label: 'اليوميه', slug: 'daily' },
      { label: 'ملخص الفتره', slug: 'totals' },
      { label: 'تقارير العملاء', slug: 'crm-srm' },
      { label: 'تقارير الموظفين', slug: 'hrm' }
    ]
  },
  {
    id: 'admin',
    label: 'الاداره و النظام',
    icon: <ShieldCheck className="w-5 h-5" />,
    slug: 'admin',
    subItems: [
      { label: 'اداره المستخدمين', slug: 'users' },
      { label: 'الصلاحيات', slug: 'permissions' },
      { label: 'سجل العمليات', slug: 'logs' }
    ]
  },
  {
    id: 'attendance',
    label: 'البصمه',
    icon: <Fingerprint className="w-5 h-5" />,
    slug: 'attendance',
    subItems: [
      { label: 'الاجهزه', slug: 'devices' },
      { label: 'الورديات', slug: 'shifts' },
      { label: 'الجداول', slug: 'schedules' },
      { label: 'العطلات', slug: 'holidays' },
      { label: 'السجلات', slug: 'logs' },
      { label: 'الملخص', slug: 'summary' }
    ]
  },
  {
    id: 'sales-offices',
    label: 'مكاتب المبيعات',
    icon: <Briefcase className="w-5 h-5" />,
    slug: 'sales-offices'
  },
  {
    id: 'barcode-print',
    label: 'طباعة الأكواد',
    icon: <QrCode className="w-5 h-5" />,
    slug: 'barcode-print'
  },
  {
    id: 'settings',
    label: 'الاعدادات العامه',
    icon: <Settings className="w-5 h-5" />,
    slug: 'settings'
  }
];

  export const MOCK_USER = {
    id: 1,
    name: 'المهندس المشرف',
    email: 'admin@Dragonerp.pro',
    role: 'admin' as const,
    avatar: 'https://picsum.photos/seed/erp/200/200',
    restricted_treasury_id: null,
    restricted_warehouse_id: null
  };

  export const WAREHOUSES: {id: number, name: string, location: string}[] = [];

  export const TREASURIES: {id: number, name: string, balance: number}[] = [];

