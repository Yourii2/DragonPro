import React, { useState, useEffect } from 'react';
import { API_BASE_PATH } from '../services/apiConfig';
import { ShoppingCart, Printer, History, Search, PlusCircle, MinusCircle, UploadCloud, FileText, RefreshCcw, ClipboardPaste, MapPin, Phone, User, CheckSquare, Square, Eye, Edit, ChevronRight } from 'lucide-react';
import Swal from 'sweetalert2';
import CustomSelect from './CustomSelect';
import Barcode from './Barcode';
interface OrdersModuleProps {
  initialView?: string;
}

// Order item used in manual/new order form and parsed orders mapping
type OrderItem = {
  id: number;
  productId: string | number | null;
  _parentId?: string;
  _color?: string;
  _size?: string;
  name?: string;
  color?: string;
  size?: string;
  qty: number;
  price: number;
  [key: string]: any;
};

type RateType = 'percent' | 'amount';

type SalesDisplayMethod = 'company' | 'sales_offices';

const normalizeSalesDisplayMethod = (value?: string | null): SalesDisplayMethod => {
  const v = (value || '').toLowerCase().trim();
  return v === 'sales_offices' ? 'sales_offices' : 'company';
};

const pickDisplayPhone = (phones: any, fallback: string): string => {
  const text = normalizeNumbers(phones || '').toString();
  const match = text.match(/\d{11}/);
  if (match && match[0]) return match[0];
  const first = text    .split(/\r?\n|,/) 
    .map(s => s.trim())
    .filter(Boolean)[0];
  return first || fallback;
};

const normalizeRateType = (value?: string | null): RateType | null => {
  const v = (value || '').toLowerCase().trim();
  if (v === 'percent' || v === 'percentage') return 'percent';
  if (v === 'amount' || v === 'fixed' || v === 'value') return 'amount';
  return null;
};

const calculateOrderTotals = (
  subtotal: number,
  shipping: number,
  discountType: RateType | null,
  discountValue: number,
  taxType: RateType | null,
  taxValue: number,
  calcOrder: 'discount_then_tax' | 'tax_then_discount'
) => {
  const safeSubtotal = Math.max(0, Number(subtotal || 0));
  const safeShipping = Math.max(0, Number(shipping || 0));
  const safeDiscountValue = Math.max(0, Number(discountValue || 0));
  const safeTaxValue = Math.max(0, Number(taxValue || 0));

  let discountAmount = 0;
  let taxAmount = 0;

  if (calcOrder === 'tax_then_discount') {
    if (taxType === 'percent') taxAmount = safeSubtotal * (safeTaxValue / 100);
    else if (taxType === 'amount') taxAmount = safeTaxValue;
    const baseForDiscount = Math.max(0, safeSubtotal + taxAmount);
    if (discountType === 'percent') discountAmount = baseForDiscount * (safeDiscountValue / 100);
    else if (discountType === 'amount') discountAmount = safeDiscountValue;
    if (discountAmount > baseForDiscount) discountAmount = baseForDiscount;
  } else {
    if (discountType === 'percent') discountAmount = safeSubtotal * (safeDiscountValue / 100);
    else if (discountType === 'amount') discountAmount = safeDiscountValue;
    if (discountAmount > safeSubtotal) discountAmount = safeSubtotal;
    const baseForTax = Math.max(0, safeSubtotal - discountAmount);
    if (taxType === 'percent') taxAmount = baseForTax * (safeTaxValue / 100);
    else if (taxType === 'amount') taxAmount = safeTaxValue;
  }

  const total = Math.max(0, safeSubtotal - discountAmount + taxAmount + safeShipping);
  return { subtotal: safeSubtotal, discountAmount, taxAmount, total };
};

// Normalize Arabic-Indic and Persian numerals to Latin digits within a string
const normalizeNumbers = (input: any): string => {
  if (input === null || typeof input === 'undefined') return '';
  const s = String(input);
  // Eastern Arabic numerals (٠١٢٣٤٥٦٧٨٩) and Persian (۰۱۲۳۴۵۶۷۸۹)
  const map: Record<string,string> = {
    '٠':'0','١':'1','٢':'2','٣':'3','٤':'4','٥':'5','٦':'6','٧':'7','٨':'8','٩':'9',
    '۰':'0','۱':'1','۲':'2','۳':'3','۴':'4','۵':'5','۶':'6','۷':'7','۸':'8','۹':'9'
  };

  return s.split('').map(ch => map[ch] || ch).join('');
};

const OrdersModule: React.FC<OrdersModuleProps> = ({ initialView }) => {
  const [view, setView] = useState<string>(initialView || 'new-order');
  const [orderItems, setOrderItems] = useState<OrderItem[]>([{ id: 1, productId: '', color: '', size: '', qty: 1, price: 0 }]);
  const [isExistingCustomer, setIsExistingCustomer] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const currencySymbol = 'ج.م';
  const [globalTaxRate, setGlobalTaxRate] = useState<number>(Number(localStorage.getItem('Dragon_tax_rate') || '0'));
  const salesCalcOrder = (localStorage.getItem('Dragon_sales_calc_order') || 'discount_then_tax') as 'discount_then_tax' | 'tax_then_discount';

  // State for script import
  const [scriptText, setScriptText] = useState('');
  const [parsedOrders, setParsedOrders] = useState<any[]>([]);
  const [isParsing, setIsParsing] = useState(false);
  const [selectedOrders, setSelectedOrders] = useState<number[]>([]);
  const [ordersToPrint, setOrdersToPrint] = useState<any[] | null>(null);
  const [existingProducts, setExistingProducts] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | ''>('');
  const [newCustomer, setNewCustomer] = useState({ name: '', phone1: '', phone2: '', governorate: '', address: '' });
  const [notes, setNotes] = useState('');
  const [employee, setEmployee] = useState('');
  const [page, setPage] = useState('');
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [createSales, setCreateSales] = useState<boolean>(false);
  const [defaultWarehouseId, setDefaultWarehouseId] = useState<number | ''>('');

  // Sales tax/discount (manual order)
  const [discountType, setDiscountType] = useState<RateType>('amount');
  const [discountValue, setDiscountValue] = useState<number>(0);
  const [taxType, setTaxType] = useState<RateType>('percent');
  const [taxValue, setTaxValue] = useState<number>(globalTaxRate);
  // Shipping for manual order
  const [shippingValue, setShippingValue] = useState<number>(0);

  // Sales tax/discount (import defaults)
  const [importDiscountType, setImportDiscountType] = useState<RateType>('amount');
  const [importDiscountValue, setImportDiscountValue] = useState<number>(0);
  const [importTaxType, setImportTaxType] = useState<RateType>('percent');
  const [importTaxValue, setImportTaxValue] = useState<number>(globalTaxRate);
  
  // Company Settings
  const [companyNameState, setCompanyNameState] = useState<string>(localStorage.getItem('Dragon_company_name') || 'اسم الشركة');
  const [companyPhoneState, setCompanyPhoneState] = useState<string>(localStorage.getItem('Dragon_company_phone') || '01000000000');
  const [companyAddressState, setCompanyAddressState] = useState<string>(localStorage.getItem('Dragon_company_address') || '');
  const [companyTermsState, setCompanyTermsState] = useState<string>(localStorage.getItem('Dragon_company_terms') || 'المعاينة حق للعميل قبل الاستلام.');
  const [companyLogoState, setCompanyLogoState] = useState<string | null>(localStorage.getItem('Dragon_company_logo') || null);

  // Load company settings from server (same source as SettingsModule)
  useEffect(() => {
    (async () => {
      try {
        const resp = await fetch(`${API_BASE_PATH}/get_settings.php`);
        const jr = await resp.json().catch(() => null);
        if (jr && jr.success && jr.data) {
          const s = jr.data;
          if (s.company_name) setCompanyNameState(s.company_name);
          if (s.company_phone) setCompanyPhoneState(s.company_phone);
          if (s.company_address) setCompanyAddressState(s.company_address);
          if (s.company_terms) setCompanyTermsState(s.company_terms);
          if (s.company_logo_url) setCompanyLogoState(s.company_logo_url);
          else if (s.company_logo) setCompanyLogoState(s.company_logo);
          
          if (typeof s.tax_rate !== 'undefined' && s.tax_rate !== null) {
            const tr = Number(s.tax_rate);
            if (!isNaN(tr)) {
              setGlobalTaxRate(tr);
              localStorage.setItem('Dragon_tax_rate', s.tax_rate.toString());
              // If we are showing the list (not in middle of manual creation/edit), sync taxValue
              if (view !== 'new-order' && !editingOrderId) {
                setTaxValue(tr);
              }
            }
          }
        }
      } catch (e) { console.debug('Failed to load company settings for printing', e); }
    })();
  }, []);

  // Sales Display Settings (Company vs Sales Offices)
  const salesDisplayMethod = normalizeSalesDisplayMethod(localStorage.getItem('Dragon_sales_display_method'));
  const [salesOffices, setSalesOffices] = useState<any[]>([]);
  const [selectedSalesOfficeId, setSelectedSalesOfficeId] = useState<number | ''>('');
  const [userDefaults, setUserDefaults] = useState<any>(null);

  const selectedSalesOffice = (salesDisplayMethod === 'sales_offices' && selectedSalesOfficeId)
    ? (salesOffices.find(o => Number(o.id) === Number(selectedSalesOfficeId)) || null)
    : null;

  const defaultSalesOfficeIdRaw = userDefaults && (userDefaults.default_sales_office_id !== undefined) ? userDefaults.default_sales_office_id : null;
  const defaultSalesOfficeId = (defaultSalesOfficeIdRaw === null || typeof defaultSalesOfficeIdRaw === 'undefined') ? null : Number(defaultSalesOfficeIdRaw);
  const canChangeSalesOffice = userDefaults && typeof userDefaults.can_change_sales_office !== 'undefined' ? Boolean(userDefaults.can_change_sales_office) : true;
  const isSalesOfficeScopeNone = (defaultSalesOfficeId === -1) && !canChangeSalesOffice;

  const effectiveHeaderName = (!isSalesOfficeScopeNone && selectedSalesOffice?.name) ? selectedSalesOffice.name : companyNameState;
  const effectiveHeaderPhone = (!isSalesOfficeScopeNone && selectedSalesOffice)
    ? pickDisplayPhone(selectedSalesOffice.phones, companyPhoneState)
    : companyPhoneState;

  // Mock Data for testing (Or empty array)
  const [orders, setOrders] = useState<any[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('pending');
  const [dateFilter, setDateFilter] = useState<string>('all');
  const [reps, setReps] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);

  // Order details + lifecycle
  const [isOrderDetailsOpen, setIsOrderDetailsOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [orderTimeline, setOrderTimeline] = useState<any[]>([]);
  const [statusEditTimeline, setStatusEditTimeline] = useState<any[]>([]);
  const [orderDocuments, setOrderDocuments] = useState<any[]>([]);
  const [docType, setDocType] = useState('delivery_note');
  const [docUrl, setDocUrl] = useState('');
  const [docNotes, setDocNotes] = useState('');
  const [statusUpdate, setStatusUpdate] = useState('');
  const [statusNote, setStatusNote] = useState('');
  const [isStatusEditOpen, setIsStatusEditOpen] = useState(false);
  const [statusEditOrder, setStatusEditOrder] = useState<any>(null);
  const [statusEditValue, setStatusEditValue] = useState('');
  const [statusEditNote, setStatusEditNote] = useState('');
  const [returnFineMode, setReturnFineMode] = useState<'none' | 'fine'>('none');
  const [returnFineAmount, setReturnFineAmount] = useState('');
  const [statusUpdateRepId, setStatusUpdateRepId] = useState<string>('');
  const [statusEditRepId, setStatusEditRepId] = useState<string>('');
  // Full-order edit state (for manual edit form)
  const [editingOrderId, setEditingOrderId] = useState<number | null>(null);

  const normalizeProductGroupName = (v: any) => String(v || '').trim().toLowerCase();

  const parentGroupNameById = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const p of existingProducts) {
      const pid = String((p as any).product_id || (p as any).id || '');
      if (!pid) continue;
      const groupName = normalizeProductGroupName((p as any).parent_name || (p as any).name || '');
      if (groupName) map.set(pid, groupName);
    }
    return map;
  }, [existingProducts]);

  // Derived: unique parent products for the cascade dropdown (deduped by product name)
  const parentProductsMap = React.useMemo(() => {
    const seen = new Map<string, { id: any; name: string }>();
    for (const p of existingProducts) {
      const pid = String((p as any).product_id || (p as any).id || '');
      if (!pid) continue;
      const displayName = String((p as any).parent_name || (p as any).name || '').trim();
      const groupName = normalizeProductGroupName(displayName);
      if (!groupName) continue;
      if (!seen.has(groupName)) seen.set(groupName, { id: pid, name: displayName });
    }
    return Array.from(seen.values());
  }, [existingProducts]);

  const getVariantsForSelectedParent = (selectedParentId: any) => {
    const key = String(selectedParentId || '').trim();
    if (!key) return [] as any[];
    const selectedGroup = parentGroupNameById.get(key);
    if (selectedGroup) {
      return existingProducts.filter((ep: any) =>
        normalizeProductGroupName((ep as any).parent_name || (ep as any).name || '') === selectedGroup
      );
    }
    return existingProducts.filter((ep: any) => String((ep as any).product_id || (ep as any).id) === key);
  };

  const filteredOrders = orders.filter(o => {
    const matchesStatus = statusFilter === 'all' || (o.status || '') === statusFilter;
    // Date filter: compare YYYY-MM-DD directly from the raw string to avoid UTC timezone shift
    const rawDate = o.created_at || o.createdAt || o.date || '';
    const orderDateStr = rawDate ? String(rawDate).slice(0, 10) : '';
    const matchesDate = dateFilter === 'all' || !dateFilter || orderDateStr === dateFilter;
    const phoneA = o.phone || o.phone1 || '';
    const phoneB = o.phone2 || '';
    const term = searchTerm.toLowerCase();
    const matchesSearch =
      (o.customerName || '').includes(searchTerm) ||
      phoneA.includes(searchTerm) ||
      phoneB.includes(searchTerm) ||
      (o.orderNumber || '').toLowerCase().includes(term);
    return matchesStatus && matchesSearch && matchesDate;
  });

  const selectedOrderSubtotal = selectedOrder
    ? (selectedOrder.products || []).reduce((s: number, p: any) => s + (Number(p.price || 0) * Number(p.quantity || p.qty || 0)), 0)
    : 0;
  const selectedOrderShipping = selectedOrder ? Number(selectedOrder.shipping || selectedOrder.shippingCost || 0) : 0;
  const selectedOrderDiscountType = normalizeRateType(selectedOrder?.discountType || selectedOrder?.discount_type);
  const selectedOrderDiscountValue = Number(selectedOrder?.discountValue || selectedOrder?.discount_value || 0);
  const selectedOrderTaxType = normalizeRateType(selectedOrder?.taxType || selectedOrder?.tax_type);
  const selectedOrderTaxValue = Number(selectedOrder?.taxValue || selectedOrder?.tax_value || 0);
  const selectedOrderTotals = selectedOrder
    ? calculateOrderTotals(selectedOrderSubtotal, selectedOrderShipping, selectedOrderDiscountType, selectedOrderDiscountValue, selectedOrderTaxType, selectedOrderTaxValue, salesCalcOrder)
    : null;
  const selectedOrderDiscountAmount = selectedOrder
    ? (Number(selectedOrder.discountAmount || selectedOrder.discount_amount || 0) || selectedOrderTotals?.discountAmount || 0)
    : 0;
  const selectedOrderTaxAmount = selectedOrder
    ? (Number(selectedOrder.taxAmount || selectedOrder.tax_amount || 0) || selectedOrderTotals?.taxAmount || 0)
    : 0;
  const selectedOrderTotal = selectedOrder
    ? (Number(selectedOrder.total || 0) || selectedOrderTotals?.total || 0)
    : 0;

  const getStatusChip = (status: string) => {
    switch (status) {
      case 'pending': return <span className="bg-amber-100 text-amber-700 px-2 py-1 rounded-lg text-[10px] font-bold">قيد الانتظار</span>;
      case 'with_rep': return <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded-lg text-[10px] font-bold">مع المندوب</span>;
      case 'in_delivery': return <span className="bg-indigo-100 text-indigo-700 px-2 py-1 rounded-lg text-[10px] font-bold">قيد التسليم</span>;
      case 'delivered': return <span className="bg-emerald-100 text-emerald-700 px-2 py-1 rounded-lg text-[10px] font-bold">تم التسليم</span>;
      case 'returned': return <span className="bg-rose-100 text-rose-700 px-2 py-1 rounded-lg text-[10px] font-bold">مرتجع</span>;
      case 'cancelled': return <span className="bg-rose-200 text-rose-800 px-2 py-1 rounded-lg text-[10px] font-bold">ملغي</span>;
      default: return <span className="bg-slate-100 text-slate-700 px-2 py-1 rounded-lg text-[10px] font-bold">{status}</span>;
    }
  };

  const getRepName = (order: any) => {
    if (!order) return null;
    const direct = order?.rep_name || order?.repName || order?.representative || (order?.rep && order.rep.name) || order?.rep_name_display || order?.rep_name_ar || null;
    if (direct) return direct;
    const repId = order?.rep_id || order?.repId || order?.representative_id || null;
    if (repId && reps && reps.length) {
      const r = reps.find((x: any) => Number(x.id) === Number(repId));
      if (r) return r.name || (r.full_name || r.name_ar || r.display_name || null);
    }
    return null;
  };

  const normalizeRepIdValue = (value: any): string => {
    const numeric = Number(value);
    return Number.isFinite(numeric) && numeric > 0 ? String(numeric) : '';
  };

  const getLastRepIdFromTimeline = (timeline: any[]): string => {
    if (!Array.isArray(timeline)) return '';
    for (const entry of timeline) {
      const repId = normalizeRepIdValue(entry?.rep_id ?? entry?.repId);
      if (repId) return repId;
    }
    return '';
  };

  const getPreferredRepIdForStatusChange = (order: any, timeline: any[] = []): string => {
    return normalizeRepIdValue(order?.rep_id ?? order?.repId) || getLastRepIdFromTimeline(timeline);
  };

  const shouldAutofillRepForDeliveredReturnedSwitch = (currentStatus: any, nextStatus: any): boolean => {
    const current = String(currentStatus || '').trim().toLowerCase();
    const next = String(nextStatus || '').trim().toLowerCase();
    return (current === 'delivered' && next === 'returned') || (current === 'returned' && next === 'delivered');
  };

  useEffect(() => {
    if (initialView) setView(initialView);
  }, [initialView]);

  // load representatives for display (used to show rep name when order only has rep_id)
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`${API_BASE_PATH}/api.php?module=users&action=getAll`);
        const jr = await r.json();
        if (jr && jr.success) {
          const all = jr.data || [];
          setUsers(all);
          setReps(all.filter((u:any) => u.role === 'representative'));
        }
      } catch (e) { console.debug('Failed to load reps', e); }
    })();
  }, []);

  useEffect(() => {
    // load existing products for import validation
    (async () => {
      try {
        const resp = await fetch(`${API_BASE_PATH}/api.php?module=products&action=getFlat`);
        const j = await resp.json();
        if (j.success) setExistingProducts(j.data || []);
      } catch (e) { console.error('Failed to load products for import validation', e); }
    })();
    // load warehouses for optional stock operations
    const loadWarehouses = async () => {
      try {
        const r = await fetch(`${API_BASE_PATH}/api.php?module=warehouses&action=getAll`);
        const jr = await r.json();
        if (jr && jr.success) setWarehouses(jr.data || []);
      } catch (e) { console.error('Failed to load warehouses', e); setWarehouses([]); }
    };
    loadWarehouses();
    // load all orders for management view
    (async () => {
      try {
        const r = await fetch(`${API_BASE_PATH}/api.php?module=orders&action=getAll`);
        const text = await r.text();
        let jr = null;
        try {
          jr = JSON.parse(text);
        } catch (pe) {
          console.error('Failed to parse orders response as JSON:', pe, 'raw response:', text);
          Swal.fire('خطأ', 'فشل تحميل الاوردرات من الخادم. راجع الكونسول للرد الخام.', 'error');
          setOrders([]);
          return;
        }
        if (jr && jr.success) setOrders(jr.data || []);
      } catch (e) { console.error('Failed to load orders', e); Swal.fire('خطأ', 'فشل تحميل الاوردرات من الخادم.'); }
    })();

    // load customers for manual order creation
    (async () => {
      try {
        const r = await fetch(`${API_BASE_PATH}/api.php?module=customers&action=getAll`);
        const jr = await r.json();
        if (jr.success) setCustomers(jr.data || []);
      } catch (e) { console.error('Failed to load customers', e); }
    })();
    // expose loader on locals (used below when opening an order)
    (window as any)._loadDragonWarehouses = async () => { await (async () => {
      try {
        const r = await fetch(`${API_BASE_PATH}/api.php?module=warehouses&action=getAll`);
        const jr = await r.json();
        if (jr && jr.success) setWarehouses(jr.data || []);
      } catch (e) { console.error('Failed to load warehouses', e); setWarehouses([]); }
    })(); };
  }, []);

  useEffect(() => {
    if (salesDisplayMethod !== 'sales_offices') return;
    (async () => {
      try {
        // load current user's defaults (for office scoping)
        try {
          const u = JSON.parse(localStorage.getItem('Dragon_user') || 'null');
          const uid = u && u.id ? Number(u.id) : 0;
          if (uid) {
            const dRes = await fetch(`${API_BASE_PATH}/api.php?module=permissions&action=getUserDefaults&user_id=${uid}`);
            const dj = await dRes.json();
            if (dj && dj.success) setUserDefaults(dj.data || null);
          }
        } catch (e) {
          // ignore
        }

        const res = await fetch(`${API_BASE_PATH}/api.php?module=sales_offices&action=getAll`);
        const j = await res.json();
        if (j.success) setSalesOffices(j.data || []);
        else setSalesOffices([]);
      } catch (e) {
        console.error('Failed to load sales offices', e);
        setSalesOffices([]);
      }
    })();
  }, [salesDisplayMethod]);

  useEffect(() => {
    if (salesDisplayMethod !== 'sales_offices') return;
    if (!userDefaults) return;

    const raw = userDefaults.default_sales_office_id;
    const defId = (raw === null || typeof raw === 'undefined') ? null : Number(raw);
    const canChange = typeof userDefaults.can_change_sales_office !== 'undefined' ? Boolean(userDefaults.can_change_sales_office) : true;

    // If locked to a specific office, preselect it.
    if (!canChange && defId && defId > 0) {
      setSelectedSalesOfficeId(defId);
    }
    // If locked to none, clear selection.
    if (!canChange && defId === -1) {
      setSelectedSalesOfficeId('');
    }
  }, [userDefaults, salesDisplayMethod]);

  const addOrderItem = () => {
    setOrderItems([...orderItems, { id: Date.now(), productId: '', _parentId: '', _color: '', _size: '', color: '', size: '', qty: 1, price: 0 }]);
  };

  // Helper: send bridge to server (best-effort)
  const _sendBridge = (matched: any, qty: number) => {
    try {
      fetch(`${API_BASE_PATH}/api.php?module=selected_product&action=set`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId: matched.id, name: matched.name || '', color: matched.color || '', size: matched.size || '', qty })
      }).catch(() => {});
    } catch (e) { /* ignore */ }
  };

  const updateOrderItemField = (id: number, field: string, value: any) => {
    setOrderItems(prev => prev.map(it => {
      if (it.id !== id) return it;
      const ia = it as any;

      // ── Cascade: parent product selected ──
      if (field === '_parentId') {
        // Check if this parent has any color variants
        const siblings = getVariantsForSelectedParent(value);
        const hasColors = siblings.some(ep => ep.color);
        const hasSizes = siblings.some(ep => ep.size);
        // If no colors and no sizes → resolve immediately to the first variant
        if (!hasColors && !hasSizes && siblings.length > 0) {
          const m = siblings[0];
          _sendBridge(m, ia.qty || 1);
          return { ...it, _parentId: value, _color: '', _size: '', productId: m.id, name: m.name || '', price: Number(m.sale_price || m.price || 0), color: '', size: '' };
        }
        return { ...it, _parentId: value, _color: '', _size: '', productId: '' as any, name: '', price: 0, color: '', size: '' };
      }

      // ── Cascade: size selected ──
      if (field === '_size') {
        const parentId = ia._parentId;
        const siblings = getVariantsForSelectedParent(parentId).filter((ep: any) => ep.size === value);
        const hasColors = siblings.some(ep => ep.color);
        if (!hasColors && siblings.length > 0) {
          const m = siblings[0];
          _sendBridge(m, ia.qty || 1);
          return { ...it, _size: value, _color: '', productId: m.id, name: m.name || '', price: Number(m.sale_price || m.price || 0), color: '', size: value };
        }
        return { ...it, _size: value, _color: '', productId: '' as any, name: '', color: '', size: value };
      }

      // ── Cascade: color selected ──
      if (field === '_color') {
        const parentId = ia._parentId;
        const size = ia._size;
        const m = getVariantsForSelectedParent(parentId).find((ep: any) =>
          (size ? ep.size === size : true) &&
          ep.color === value
        );
        if (m) {
          _sendBridge(m, ia.qty || 1);
          return { ...it, _color: value, productId: m.id, name: m.name || '', price: Number(m.sale_price || m.price || 0), color: value, size: m.size || size || '' };
        }
        return { ...it, _color: value, color: value };
      }

      // ── Legacy: direct productId set (used by editOrder to pre-populate) ──
      if (field === 'productId') {
        const pid = value ? Number(value) : '';
        const matched = existingProducts.find(ep => Number(ep.id) === Number(pid));
        if (matched) {
          _sendBridge(matched, ia.qty || 1);
          return {
            ...it,
            productId: matched.id,
            _parentId: String(matched.product_id || matched.id),
            _color: matched.color || '',
            _size: matched.size || '',
            name: matched.name || '',
            price: Number(matched.sale_price || matched.price || matched.retail_price || 0),
            color: matched.color || '',
            size: matched.size || '',
          };
        }
        return { ...it, productId: pid, _parentId: '', _color: '', _size: '' };
      }

      return { ...it, [field]: value };
    }));
  };

  const saveManualOrder = async () => {
    if (salesDisplayMethod === 'sales_offices' && !isSalesOfficeScopeNone && !selectedSalesOfficeId) {
      Swal.fire('تنبيه', 'يرجى اختيار مكتب المبيعات.', 'warning');
      return;
    }
    // build order payload similar to import structure
    const saleSource = (localStorage.getItem('Dragon_default_sale_price_source') || 'product').toString();
    let foundMissingPrice = false;
    let foundMissingProduct = false;
    const importedProducts = orderItems.map(it => {
      let price = Number(it.price || 0);
      if (saleSource === 'product' && it.productId) {
        const matched = existingProducts.find(ep => Number(ep.id) === Number(it.productId));
        if (matched) {
          const preferredKeys = ['sale_price','salePrice','sellingPrice','selling_price','price','cost','retail_price','retailPrice','default_price','amount','value'];
          for (const k of preferredKeys) {
            if (matched[k] !== undefined && matched[k] !== null) {
              const num = Number(String(matched[k]).replace(/,/g, ''));
              if (!isNaN(num) && num > 0) { price = num; break; }
            }
          }
        }
      }
      // detect missing product: if no productId, try to match by name; otherwise mark missing
      if (!it.productId) {
        const name = (it.name || '').toString().trim().toLowerCase();
        let matched = null;
        if (name) {
          matched = existingProducts.find(ep => (ep.name||'').toString().trim().toLowerCase() === name) || existingProducts.find(ep => (ep.name||'').toString().toLowerCase().includes(name) || name.includes((ep.name||'').toString().toLowerCase()));
        }
        if (!matched) foundMissingProduct = true;
        else if (!it.productId) it.productId = matched.id;
      }

      if (saleSource === 'order' && (!price || Number(price) === 0)) foundMissingPrice = true;
      return { name: it.name || '', productId: it.productId || null, quantity: Number(it.qty || 0), price, color: it.color || '', size: it.size || '' };
    });
    if (foundMissingProduct) {
      Swal.fire('خطأ', 'بعض المنتجات في الطلب اليدوي لا تطابق أي منتج موجود. عدّل أسماء المنتجات أو اختر المنتج الصحيح قبل الحفظ.', 'error');
      return;
    }
    if (foundMissingPrice) {
      Swal.fire('خطأ', 'بعض المنتجات لا تحتوي على سعر بيع. الرجاء إدخال السعر لكل قطعة أو اختر سعر المنتج المسجل في الإعدادات.', 'error');
      return;
    }
    const customerObj = selectedCustomerId ? (customers.find(c=>c.id===selectedCustomerId) || null) : null;
    const customerName = customerObj ? (customerObj.name || '') : newCustomer.name;
    const phone1 = customerObj ? (customerObj.phone1 || '') : newCustomer.phone1;
    const phone2 = customerObj ? (customerObj.phone2 || '') : newCustomer.phone2;
    const governorateVal = customerObj ? (customerObj.governorate || '') : newCustomer.governorate;
    const addr = customerObj ? (customerObj.address || '') : newCustomer.address;

    const subtotal = importedProducts.reduce((s, p) => s + (Number(p.quantity || 0) * Number(p.price || 0)), 0);
    const totals = calculateOrderTotals(subtotal, shippingValue, discountType, discountValue, taxType, taxValue, salesCalcOrder);

    const orderPayload = {
      orderNumber: null,
      customerName,
      phone: normalizeNumbers(phone1),
      phone2: normalizeNumbers(phone2),
      governorate: governorateVal,
      address: normalizeNumbers(addr),
      shipping: shippingValue,
      notes,
      employee,
      page,
      employee_raw: employee,
      page_raw: page,
      importedProducts,
      subTotal: totals.subtotal,
      total: totals.total,
      discount_type: discountType,
      discount_value: discountValue,
      tax_type: taxType,
      tax_value: taxValue,
      sales_office_id: (salesDisplayMethod === 'sales_offices' && !isSalesOfficeScopeNone)
        ? (selectedSalesOffice?.id || selectedSalesOfficeId || null)
        : null
    };

    try {
      if (editingOrderId) {
        // Update existing order
        // Ensure product lines are sent under both `products` and `importedProducts` to match different backend expectations
        const updateBody: any = { id: editingOrderId, ...orderPayload, products: importedProducts, importedProducts };
        try {
          const resp = await fetch(`${API_BASE_PATH}/api.php?module=orders&action=update`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updateBody)
          });
          const jr = await resp.json().catch(() => null);
          // expose the last update response globally for easier debugging in the browser console
          try {
            (window as any).__lastOrderUpdate = { orderId: editingOrderId, jr, updateBody };
          } catch (e) {}
          console.debug('OrdersModule: updateOrder response', { orderId: editingOrderId, jr, updateBody });
          // If developer debug flag is set in localStorage, show full server response in a modal for easier inspection
          try {
            const showResp = localStorage.getItem('Dragon_debug_show_server_response') === '1';
            if (showResp) {
              const escapeHtml = (str: string) => String(str)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;');
              Swal.fire({
                title: 'Server response (debug)',
                html: `<pre style="text-align:left; direction:ltr; white-space:pre-wrap; max-height:400px; overflow:auto">${escapeHtml(JSON.stringify(jr, null, 2))}</pre>`,
                width: 800
              });
            }
          } catch (e) { console.debug('Failed to show debug response modal', e); }
          if (jr && jr.success) {
            // Update succeeded for order metadata. Ensure product lines are persisted
            try {
              const setResp = await fetch(`${API_BASE_PATH}/api.php?module=orders&action=setItems`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: editingOrderId, products: importedProducts, shipping: orderPayload.shipping })
              });
              const setJ = await setResp.json().catch(() => null);
              if (setJ && setJ.success) {
                Swal.fire('تم الحفظ', 'تم تحديث الاوردر بنجاح.', 'success');
                const r = await fetch(`${API_BASE_PATH}/api.php?module=orders&action=getAll`);
                const jr2 = await r.json(); if (jr2 && jr2.success) setOrders(jr2.data || []);
                setEditingOrderId(null);
                setView('manage-orders');
              } else {
                console.error('setItems failed', setJ);
                Swal.fire('تحذير', 'تم تحديث بيانات الاوردر ولكن فشل حفظ خطوط المنتجات على الخادم.', 'warning');
              }
            } catch (e) {
              console.error('Failed to set items after update', e);
              Swal.fire('تحذير', 'تم تحديث بيانات الاوردر ولكن فشل حفظ خطوط المنتجات على الخادم.', 'warning');
            }
          } else {
            Swal.fire('فشل التحديث', (jr && jr.message) || 'فشل تحديث الاوردر', 'error');
          }
        } catch (e) {
          console.error('Save manual order (update) failed', e);
          Swal.fire('خطأ', 'فشل الاتصال بالخادم أثناء تحديث الاوردر.', 'error');
        }
      } else {
        // Create new order
        const resp = await fetch(`${API_BASE_PATH}/api.php?module=orders&action=create`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ orders: [orderPayload] })
        });
        const jr = await resp.json();
        if (jr.success) {
          Swal.fire('تم الحفظ', 'تم إنشاء الاوردر بنجاح.', 'success');
          // refresh orders
          const r = await fetch(`${API_BASE_PATH}/api.php?module=orders&action=getAll`);
          const jr2 = await r.json(); if (jr2.success) setOrders(jr2.data || []);
          setView('manage-orders');
        } else {
          Swal.fire('فشل الحفظ', jr.message || 'فشل إنشاء الاوردر', 'error');
        }
      }
    } catch (e) {
      console.error('Save manual order failed', e);
      Swal.fire('خطأ', 'فشل الاتصال بالخادم أثناء حفظ الاوردر.', 'error');
    }
  };

  const removeOrderItem = (id: number) => {
    setOrderItems(orderItems.filter(item => item.id !== id));
  };

  const toggleSelectAll = () => {
    if (selectedOrders.length === filteredOrders.length && filteredOrders.length > 0) {
      setSelectedOrders([]);
    } else {
      setSelectedOrders(filteredOrders.map(o => o.id));
    }
  };

  const toggleSelectOne = (orderId: number) => {
    if (selectedOrders.includes(orderId)) {
      setSelectedOrders(prev => prev.filter(id => id !== orderId));
    } else {
      setSelectedOrders(prev => [...prev, orderId]);
    }
  };

  

  const handleParseScript = () => {
    if (!scriptText.trim()) {
      Swal.fire('خطأ', 'يرجى لصق نص الاوردرات أولاً.', 'error');
      return;
    }
    setIsParsing(true);

    setTimeout(() => {
      // Normalize pasted script to avoid client-side encoding/hidden-char issues
      const normalizedText = scriptText
        .normalize && scriptText.normalize('NFKC') || scriptText
      const cleaned = normalizedText
        .replace(/\u00A0/g, ' ')      // non-breaking space
        .replace(/[\u200E\u200F\u200C\u200D]/g, '') // remove bidi/zwj chars
        .replace(/[\u0610-\u061A\u064B-\u065F]/g, '') // remove Arabic diacritics
        .replace(/\r\n/g, '\n')
        .replace(/\t/g, ' ')
        .replace(/ {2,}/g, ' ')
        .trim();

      const orderBlocks = cleaned.split(/الإسم:|‏الإسم:|الاسم:/).filter(block => block.trim() !== '');
      // cleaned text prepared for parsing
      const maxId = orders.reduce((max, o) => { const id = parseInt(o.orderNumber, 10); return !isNaN(id) && id > max ? id : max; }, 0);

      const extractedOrders = orderBlocks.map((block, index) => {
          const orderData: { [key: string]: any } = { id: Date.now() + index };

          const extractField = (key: string, content: string, isMultiLine: boolean = false): string => {
              if (isMultiLine) {
                  const startRegex = new RegExp(`${key}:\\s*`);
                  const startMatch = content.match(startRegex);
                  if (!startMatch) return '';
                  const startIndex = startMatch.index! + startMatch[0].length;
                  const terminators = ['الإسم:', 'الاسم:', 'المحافظة:', 'العنوان:', 'التليفون', 'تليفون', 'موبايل', 'عدد القطع', 'تفاصيل المنتج', 'السعر:', 'الشحن:', 'الاجمالي:', 'الموظف:', 'البيدج:', 'ملاحظات:', 'ملاحظة:'];
                  let endIndex = content.length;
                  for (const term of terminators) {
                      if (term === `${key}:`) continue;
                      const termIndex = content.indexOf(term, startIndex);
                      if (termIndex !== -1 && termIndex < endIndex && termIndex > startIndex) {
                          endIndex = termIndex;
                      }
                  }
                  return content.substring(startIndex, endIndex).trim();
              } else {
                  /* const regex = new RegExp(`${key}:?\\s*([^\\n]*)`); */
                  const regex = new RegExp(`${key}\\s*:?\\s*([^\\r\\n]*)`);
                  const match = content.match(regex);
                  return match ? match[1].trim() : '';
              }
          };

          orderData.name = block.split('\n')[0].trim(); 
          if(orderData.name.length > 50) orderData.name = extractField('الاسم', block); 
          
          // Robust extraction for governorate: try common variants, then a regex fallback
          const getGovernorateFromBlock = (content: string) => {
            const variants = ['المحافظة', 'المحافظه', 'المنطقة', 'محافظة', 'محافظه'];
            for (const v of variants) {
              const found = extractField(v, content);
              if (found) return found;
            }
            // Fallback: look for a line containing the root "محاف" or word "منطقة" before a value
            const m = content.match(/(?:المحاف\w*|محاف\w*|المنطقة|منطقة)[:\s]*([^\n]+)/i);
            return m ? m[1].trim() : '';
          };
          orderData.governorate = normalizeNumbers(getGovernorateFromBlock(block));
          orderData.address = normalizeNumbers(extractField('العنوان', block, true));

          // Phone extraction: phone numbers may span multiple lines (e.g. "01xxxxxxxx\n01xxxxxxxx")
          // So we capture from التليفون label until the next known field label
          const extractPhoneBlock = (content: string): string => {
            const phoneKeys = ['التليفون', 'تليفون', 'موبايل'];
            const phoneTerminators = ['تفاصيل المنتج', 'السعر:', 'الشحن:', 'الاجمالي:', 'الموظف:', 'البيدج:', 'ملاحظات:', 'ملاحظة:', 'الإسم:', 'الاسم:', 'المحافظة:', 'العنوان:'];
            for (const key of phoneKeys) {
              const startRe = new RegExp(`${key}\\s*:?\\s*`);
              const m = content.match(startRe);
              if (!m) continue;
              const start = m.index! + m[0].length;
              let end = content.length;
              for (const term of phoneTerminators) {
                const ti = content.indexOf(term, start);
                if (ti !== -1 && ti < end) end = ti;
              }
              return content.substring(start, end).replace(/\n/g, ' ');
            }
            return '';
          };
          let phoneText = normalizeNumbers(extractPhoneBlock(block));
          const phones = phoneText.match(/\d{10,11}/g) || [];
          // Fallback: match any long digit sequence if no 10-11 digit found
          if (phones.length === 0) {
            const fallback = phoneText.match(/\d{7,}/g) || [];
            orderData.phone1 = fallback[0] || '';
            orderData.phone2 = fallback[1] || '';
          } else {
            orderData.phone1 = phones[0] || '';
            orderData.phone2 = phones[1] || '';
          }

          orderData.price = extractField('السعر', block);
          orderData.shipping = extractField('الشحن', block);
          orderData.total = extractField('الاجمالي', block);
          orderData.employee = extractField('الموظف', block) || extractField('مودريتور', block);
          orderData.page = extractField('البيدج', block);
          
          const productDetailsText = extractField('تفاصيل المنتج', block, true) || extractField('المنتجات', block, true);
          // Combine multi-line product entries into single logical lines.
          const rawLines = productDetailsText.split('\n').map(l => l.trim()).filter(line => line !== '');
          const productLines: string[] = [];
          let curLine = '';
          for (let i = 0; i < rawLines.length; i++) {
            const ln = rawLines[i];
            // Start a new product when line contains the quantity label or starts with a number and 'اسم' may be present
            if (/^(?:الكميه|الكمية)\b|^\d+\b|^\s*الكميه|^\s*\d+\s*$/.test(ln) || /الكميه\s*\d+/i.test(ln)) {
              if (curLine) productLines.push(curLine.trim());
              curLine = ln;
            } else {
              // continuation of previous product (fields on separate lines)
              if (curLine) curLine += ' ' + ln; else curLine = ln;
            }
          }
          if (curLine) productLines.push(curLine.trim());
          // productLines prepared for parsing

          orderData.products = productLines.map(line => {
              line = line.trim().replace(/^(?:-|\d+\.?\s*-?)\s*/, '');
              let product: { name: string; color: string; size: string; quantity: number; price: string; };

                // Support new detailed format like:
                // "الكميه 1 الاسم دبدوب اللون كاروهات المقاس 8 السعر 250"
                // Accept either 'اسم' or 'اسم المنتج' and optional 'السعر'.
                const newFormatRegex = /(?:^\s*)الكميه\s+(\d+)\s+(?:اسم(?:\s+المنتج)?|الاسم)\s+(.+?)\s+اللون\s+(.+?)\s+المقاس\s+(\S+)(?:\s+السعر\s+(\d+(?:\.\d+)?))?\s*$/i;
                const match = line.match(newFormatRegex);

                if (match) {
                  product = {
                    quantity: parseInt(match[1], 10),
                    name: match[2].trim(),
                    color: match[3].trim(),
                    size: match[4].trim(),
                    price: match[5] ? match[5] : '0'
                  };
              } else {
                  // Fallback to old format
                  product = {
                      name: '',
                      color: '',
                      size: '',
                      quantity: 1,
                      price: ''
                  };

                  const quantityMatch = line.match(/^(\d+)\s+/);
                  if (quantityMatch) {
                      product.quantity = parseInt(quantityMatch[1], 10);
                      line = line.substring(quantityMatch[0].length).trim();
                  }

                  const priceMatch = line.match(/\s+(\d+(\.\d+)?)$/);
                  if (priceMatch) {
                      product.price = priceMatch[1];
                      line = line.substring(0, line.length - priceMatch[0].length).trim();
                  }

                  const sizeMatch = line.match(/مقاس\s+([\w\s\d]+)/);
                  if (sizeMatch) {
                      product.size = sizeMatch[1].trim();
                      line = line.replace(sizeMatch[0], '').trim();
                  }
                  
                  const colors = ['اسود', 'هافان', 'كاروهات', 'جملي', 'أبيض', 'أحمر', 'أزرق', 'أخضر', 'أصفر', 'بني', 'رمادي', 'وردي'];
                  const lineParts = line.split(' ');
                  const foundColors: string[] = [];
                  const nameParts: string[] = [];

                  lineParts.forEach(part => {
                      if (colors.includes(part)) {
                          foundColors.push(part);
                      } else {
                          nameParts.push(part);
                      }
                  });

                  product.name = nameParts.join(' ').trim();
                  product.color = foundColors.join(' ').trim();

                  if (!product.name && !product.color) {
                      product.name = line;
                  }
              }
              
              return { ...product, total: (Number(product.price) * product.quantity).toString() };
          });
          
          const notes1 = extractField('ملاحظات', block, true);
          orderData.notes = notes1;
          orderData.orderNumber = (maxId + index + 1).toString();

          return orderData;
      });

      // Recalculate prices/totals for extracted orders immediately and set state
      try {
        const updated = recalcParsedOrdersArray(extractedOrders);
        setParsedOrders(updated);
      } catch (e) {
        console.error('Auto recalc failed', e);
        setParsedOrders(extractedOrders);
      }
      setIsParsing(false);
      Swal.fire('تم التحليل', `تم استخراج ${extractedOrders.length} اوردر بنجاح. تم احتساب القيم تلقائياً.`, 'success');
    }, 1000);
  };

  // validate parsed orders against existing products and mark missing attributes
  useEffect(() => {
    if (!parsedOrders || parsedOrders.length === 0) return;
    const validated = parsedOrders.map((o:any) => {
      const products = (o.products || []).map((p:any) => {
        const name = (p.name || '').trim();
        const lname = name.toLowerCase();
        const lcolor = (p.color || '').toString().trim().toLowerCase();
        const lsize = (p.size || '').toString().trim().toLowerCase();
        let match: any = null;
        // 1) try exact name+color+size match
        if (name) {
          match = existingProducts.find((ep:any) => {
            if (!ep.name) return false;
            const en = ep.name.toString().trim().toLowerCase();
            const ec = (ep.color || '').toString().trim().toLowerCase();
            const es = (ep.size || '').toString().trim().toLowerCase();
            return en === lname && (lcolor === '' || ec === lcolor) && (lsize === '' || es === lsize);
          }) || null;
        }
        // 2) try exact name-only match
        if (!match && name) {
          match = existingProducts.find((ep:any) => ep.name && ep.name.toString().trim().toLowerCase() === lname) || null;
        }
        // 3) fuzzy contains match
        if (!match && name) {
          match = existingProducts.find((ep:any) => (ep.name||'').toLowerCase().includes(lname) || lname.includes((ep.name||'').toLowerCase())) || null;
        }

        const productId = match ? match.id : null;
        const missingProduct = !productId;
        const missingSize = match && p.size && match.size && p.size.toString() !== match.size.toString() ? true : false;
        const missingColor = match && p.color && match.color && p.color.toString() !== match.color.toString() ? true : false;

        // Extract price from parsed line; only use matched product price when
        // system setting is 'product'. When set to 'order' we REQUIRE the script
        // to include the unit price and must not auto-fill from product.
        const salePriceSource = (localStorage.getItem('Dragon_default_sale_price_source') || 'product').toString();
        let resolvedPrice = Number(p.price) || 0;
        if (match && salePriceSource === 'product') {
          const preferredKeys = ['sale_price','salePrice','sellingPrice','selling_price','price','cost','retail_price','retailPrice','default_price','amount','value'];
          let candidatePrice: any = resolvedPrice;
          for (const k of preferredKeys) {
            if (match[k] !== undefined && match[k] !== null) {
              const num = Number(String(match[k]).replace(/,/g, ''));
              if (!isNaN(num) && num > 0) { candidatePrice = num; break; }
            }
          }
          if ((!candidatePrice || Number(candidatePrice) === 0) && typeof match === 'object') {
            for (const k of Object.keys(match)) {
              try {
                const v = match[k];
                const num = Number(String(v).replace(/,/g, ''));
                if (!isNaN(num) && num > 0) { candidatePrice = num; break; }
              } catch (e) {}
            }
          }
          resolvedPrice = Number(candidatePrice) || 0;
        }

        // Determine if price is missing depending on system setting
        let missingPrice = false;
        if (salePriceSource === 'order') {
          // order-provided price required
          missingPrice = !resolvedPrice || Number(resolvedPrice) === 0;
        }

        return { ...p, productId, missingProduct, missingSize, missingColor, missingPrice, price: resolvedPrice };
      });
      // compute totals based on resolved product lines
      const computedTotal = products.reduce((s:any, p:any) => s + (Number(p.price || 0) * Number(p.quantity || p.qty || 0)), 0);
      const parsedSubtotal = Number(o.price || o.subTotal || 0) || 0;
      const parsedTotal = Number(o.total || 0) || 0; // the 'اجمالي' field from script
      const parsedShipping = Number(o.shipping || 0) || 0;
      // requiredTotal: prefer provided 'total' if present, otherwise subtotal + shipping
      const requiredTotal = parsedTotal > 0 ? parsedTotal : (parsedSubtotal + parsedShipping);
      const totalsMismatch = Math.abs(computedTotal - parsedSubtotal) > 0.01 || Math.abs(requiredTotal - (parsedSubtotal + parsedShipping)) > 0.01;
      return { ...o, products, computedTotal, parsedSubtotal, parsedShipping, parsedTotal: parsedTotal, requiredTotal, totalsMismatch };
    });

    // Only update state if the validated result actually differs to avoid re-render loops
    setParsedOrders(prev => {
      try {
        const prevStr = JSON.stringify(prev || []);
        const validatedStr = JSON.stringify(validated || []);
        if (prevStr === validatedStr) return prev;
      } catch (e) {
        // If serialization fails for any reason, fall back to replacing
      }
      return validated;
    });
  }, [existingProducts, parsedOrders]);

  const handleConfirmImport = async () => {
    if (salesDisplayMethod === 'sales_offices' && !isSalesOfficeScopeNone && !selectedSalesOfficeId) {
      Swal.fire('تنبيه', 'يرجى اختيار مكتب المبيعات قبل الحفظ.', 'warning');
      return;
    }
    const saleSource = (localStorage.getItem('Dragon_default_sale_price_source') || 'product').toString();
    /* const saleSource = (localStorage.getItem('Dragon_default_sale_price_source') || 'product').toString(); */
    // Recalculate all parsed orders first and use the updated array for validation
    const updatedParsed = recalcAllParsedOrders();
    let newOrders: any[] = (updatedParsed || parsedOrders).map(pOrder => {
      const cleanPrice = (val: string|number|null|undefined) => {
        if (val === null || typeof val === 'undefined' || val === '') return 0;
        if (typeof val === 'number') return Number(val) || 0;
        const s = String(val || '').toString();
        const match = s.match(/(\d+(\.\d+)?)/);
        if (match) return parseFloat(match[0]);
        const num = Number(s.replace(/[^0-9.-]+/g, ''));
        return isNaN(num) ? 0 : num;
      };
      // Preserve product-level validation state in the saved order. Backend import enhancement can be done later.
      // Group identical products by name/size/color
      const groupedMap: any = {};
      (pOrder.products || []).forEach((pp:any) => {
        const key = `${(pp.name||'').trim().toLowerCase()}|${(pp.size||'').trim().toLowerCase()}|${(pp.color||'').trim().toLowerCase()}`;
        // Determine price according to system preference
        let linePrice = Number(pp.price) || 0;
        if (saleSource === 'product' && pp.productId) {
          const matched = existingProducts.find((ep:any) => Number(ep.id) === Number(pp.productId));
          if (matched) {
            const preferredKeys = ['sale_price','salePrice','sellingPrice','selling_price','price','cost','retail_price','retailPrice','default_price','amount','value'];
            for (const k of preferredKeys) {
              if (matched[k] !== undefined && matched[k] !== null) {
                const num = Number(String(matched[k]).replace(/,/g, ''));
                if (!isNaN(num) && num > 0) { linePrice = num; break; }
              }
            }
          }
        }

        if (!groupedMap[key]) groupedMap[key] = { name: pp.name, size: pp.size||'', color: pp.color||'', quantity: 0, productId: pp.productId || null, missingProduct: !!pp.missingProduct, missingSize: !!pp.missingSize, missingColor: !!pp.missingColor, missingPrice: !!pp.missingPrice || (saleSource === 'order' && (!linePrice || Number(linePrice) === 0)), price: linePrice };
        groupedMap[key].quantity += Number(pp.quantity || 0);
        // if any entry marks missing, keep it flagged
        groupedMap[key].missingProduct = groupedMap[key].missingProduct && pp.missingProduct ? true : (groupedMap[key].missingProduct || !!pp.missingProduct);
        groupedMap[key].missingSize = groupedMap[key].missingSize || !!pp.missingSize;
        groupedMap[key].missingColor = groupedMap[key].missingColor || !!pp.missingColor;
        if (!groupedMap[key].productId && pp.productId) groupedMap[key].productId = pp.productId;
      });
      const importedProductsArr = Object.values(groupedMap);

      return {
        id: pOrder.id,
        orderNumber: pOrder.orderNumber,
        customerName: pOrder.name,
        phone: normalizeNumbers(pOrder.phone1 || pOrder.phone || ''),
        phone2: normalizeNumbers(pOrder.phone2 || ''),
        governorate: normalizeNumbers(pOrder.governorate || ''),
        address: normalizeNumbers(pOrder.address || ''),
        notes: pOrder.notes || '',
        employee: pOrder.employee || '',
        page: pOrder.page || '',
        employee_raw: pOrder.employee || '',
        page_raw: pOrder.page || '',
        status: 'pending',
        total: cleanPrice(pOrder.total),
        shippingCost: cleanPrice(pOrder.shipping),
        subTotal: cleanPrice(pOrder.price),
        importedProducts: importedProductsArr,
        // ensure UI expects `products` field (used by manage view) to avoid render errors
        products: importedProductsArr,
        discount_type: importDiscountType,
        discount_value: importDiscountValue,
        tax_type: importTaxType,
        tax_value: importTaxValue,
        sales_office_id: (salesDisplayMethod === 'sales_offices' && !isSalesOfficeScopeNone)
          ? (selectedSalesOffice?.id || selectedSalesOfficeId || null)
          : null
      };
    });

    // Block import entirely if any order contains unmatched products or missing prices
    if (newOrders.length > 0) {
      // Check totals consistency: parsed total vs computed from lines
      const mismatchedTotals: any[] = [];
      for (const o of newOrders) {
        const computed = (o.importedProducts || []).reduce((s:any, p:any) => s + (Number(p.quantity || 0) * Number(p.price || 0)), 0);
        const parsedSubtotal = Number(o.subTotal || o.price || o.parsedSubtotal || 0) || 0;
        const parsedShipping = Number(o.shippingCost || o.shipping || 0) || 0;
        const parsedTotal = Number(o.total || o.parsedTotal || 0) || 0;
        // Compare computed lines -> parsed subtotal, and computed+shipping -> parsed total
        if (Math.abs(computed - parsedSubtotal) > 0.01 || Math.abs((computed + parsedShipping) - parsedTotal) > 0.01) {
          mismatchedTotals.push({ order: o, parsedSubtotal, parsedShipping, parsedTotal, computed });
        }
      }
      if (mismatchedTotals.length > 0) {
        const list = mismatchedTotals.map(m => (m.order.customerName || m.order.orderNumber || m.order.id)).slice(0, 10).join(', ');
        const proceed = await Swal.fire({
          title: 'تحذير: إجماليات غير مطابقة',
          html: `تم اكتشاف ${mismatchedTotals.length} اوردرات فيها اختلاف بين إجمالى الأسطر والـ"اجمالي" المُدخل: <b>${list}</b>.<br>هل تريد المتابعة وحفظ الاوردرات؟ اختر إلغاء لمراجعة وتعديل الاوردرات أولاً.`,
          icon: 'warning',
          showCancelButton: true,
          confirmButtonText: 'نعم، استمر',
          cancelButtonText: 'إلغاء، سأراجع'
        });
        if (!proceed.isConfirmed) return;
      }

      const problematic = newOrders.filter((o:any) => (o.importedProducts || []).some((p:any) => !!p.missingProduct || !!p.missingPrice));
      if (problematic.length > 0) {
        const list = problematic.map((o:any) => (o.customerName || o.orderNumber || o.id)).slice(0, 10).join(', ');
        await Swal.fire({
          title: 'خطأ: تم العثور على اوردرات غير صالحة',
            html: `تم العثور على ${problematic.length} اوردرات تحتوي على منتجات غير متطابقة أو بدون سعر: <b>${list}</b>.<br>لم يُحفظ أي شيء. عدّل الاوردرات ثم حاول مرة أخرى.`,
          icon: 'error',
          confirmButtonText: 'حسناً'
        });
        return;
      }
    }

    // send to backend for persistence
    try {
      const resp = await fetch(`${API_BASE_PATH}/api.php?module=orders&action=create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orders: newOrders, create_sales: createSales ? 1 : 0, default_warehouse_id: defaultWarehouseId || null })
      });
      const jr = await resp.json();
      if (jr.success) {
        setOrders(prevOrders => [...newOrders, ...prevOrders]);
        Swal.fire('تم الحفظ', `تم إنشاء ${jr.created.length || newOrders.length} اوردرات بنجاح.`, 'success');
        setParsedOrders([]);
        setScriptText('');
        setView('manage-orders');
      } else {
        Swal.fire('فشل الحفظ', jr.message || 'فشل حفظ الاوردرات على الخادم.', 'error');
      }
    } catch (e) {
      console.error('Import save failed', e);
      Swal.fire('خطأ', 'فشل الاتصال بخادم الحفظ. تم حفظ الاوردرات محلياً.', 'warning');
      setOrders(prevOrders => [...newOrders, ...prevOrders]);
      setParsedOrders([]);
      setScriptText('');
      setView('manage-orders');
    }
  };

  const addProductToParsedOrder = (orderId: number) => {
    setParsedOrders(prev => prev.map(po => po.id === orderId ? { ...po, products: [...(po.products||[]), { name: '', quantity: 1, color: '', size: '', price: '0', productId: null, missingProduct: true }] } : po));
  };

  const removeProductFromParsedOrder = (orderId: number, index: number) => {
    setParsedOrders(prev => prev.map(po => po.id === orderId ? { ...po, products: po.products.filter((_:any, idx:number) => idx !== index) } : po));
  };

  const removeParsedOrder = (orderId: number) => {
    setParsedOrders(prev => prev.filter(po => po.id !== orderId));
  };

  const recalcParsedOrder = (orderId: number) => {
    setParsedOrders(prev => prev.map(po => {
      if (po.id !== orderId) return po;
      const saleSource = (localStorage.getItem('Dragon_default_sale_price_source') || 'product').toString();
      const preferredKeys = ['sale_price','salePrice','sellingPrice','selling_price','price','cost','retail_price','retailPrice','default_price','amount','value'];
      const products = (po.products || []).map((p:any) => {
        let resolvedPrice = Number(p.price || 0) || 0;
        if (p.productId && saleSource === 'product') {
          const match = existingProducts.find((ep:any) => Number(ep.id) === Number(p.productId));
          if (match) {
            for (const k of preferredKeys) {
              if (match[k] !== undefined && match[k] !== null) {
                const num = Number(String(match[k]).replace(/,/g, ''));
                if (!isNaN(num) && num > 0) { resolvedPrice = num; break; }
              }
            }
            if ((!resolvedPrice || Number(resolvedPrice) === 0) && typeof match === 'object') {
              for (const k of Object.keys(match)) {
                try {
                  const v = match[k];
                  const num = Number(String(v).replace(/,/g, ''));
                  if (!isNaN(num) && num > 0) { resolvedPrice = num; break; }
                } catch (e) {}
              }
            }
          }
        }
        const missingPrice = saleSource === 'order' ? (!resolvedPrice || Number(resolvedPrice) === 0) : false;
        return { ...p, price: resolvedPrice, missingPrice };
      });
      const computed = products.reduce((s:any, p:any) => s + (Number(p.price || 0) * Number(p.quantity || p.qty || 0)), 0);
      const shipping = Number(po.shipping || po.shippingCost || 0) || 0;
      const newSubtotal = Number(computed || 0);
      const newTotal = Number((newSubtotal + shipping) || 0);
      return { ...po, products, price: newSubtotal, total: newTotal, parsedSubtotal: newSubtotal, parsedTotal: newTotal, computedTotal: computed, requiredTotal: newTotal, totalsMismatch: false };
    }));
    try { Swal.fire('تم الحساب', 'تم تحديث إجماليات الاوردر بناءً على أسطر المنتجات.', 'success'); } catch (e) { /* ignore if Swal missing */ }
  };

  // Recompute prices and totals for all parsed orders and return the new array
  const recalcParsedOrdersArray = (inputArr: any[]) => {
    const saleSource = (localStorage.getItem('Dragon_default_sale_price_source') || 'product').toString();
    const preferredKeys = ['sale_price','salePrice','sellingPrice','selling_price','price','cost','retail_price','retailPrice','default_price','amount','value'];
    const updated = (inputArr || []).map((po:any) => {
      const products = (po.products || []).map((p:any) => {
        let resolvedPrice = Number(p.price || 0) || 0;
        if (p.productId && saleSource === 'product') {
          const match = existingProducts.find((ep:any) => Number(ep.id) === Number(p.productId));
          if (match) {
            for (const k of preferredKeys) {
              if (match[k] !== undefined && match[k] !== null) {
                const num = Number(String(match[k]).replace(/,/g, ''));
                if (!isNaN(num) && num > 0) { resolvedPrice = num; break; }
              }
            }
            if ((!resolvedPrice || Number(resolvedPrice) === 0) && typeof match === 'object') {
              for (const k of Object.keys(match)) {
                try {
                  const v = match[k];
                  const num = Number(String(v).replace(/,/g, ''));
                  if (!isNaN(num) && num > 0) { resolvedPrice = num; break; }
                } catch (e) {}
              }
            }
          }
        }
        const missingPrice = saleSource === 'order' ? (!resolvedPrice || Number(resolvedPrice) === 0) : false;
        return { ...p, price: resolvedPrice, missingPrice };
      });
      const computed = products.reduce((s:any, p:any) => s + (Number(p.price || 0) * Number(p.quantity || p.qty || 0)), 0);
      const shipping = Number(po.shipping || po.shippingCost || 0) || 0;
      const newSubtotal = Number(computed || 0);
      const newTotal = Number((newSubtotal + shipping) || 0);
      const totalsMismatch = Math.abs(computed - (Number(po.parsedSubtotal || po.price || 0))) > 0.01 || Math.abs(newTotal - (Number(po.parsedTotal || po.total || 0))) > 0.01;
      return { ...po, products, price: newSubtotal, total: newTotal, parsedSubtotal: newSubtotal, parsedTotal: newTotal, computedTotal: computed, requiredTotal: newTotal, totalsMismatch };
    });
    return updated;
  };

  const recalcAllParsedOrders = () => {
    const updated = recalcParsedOrdersArray(parsedOrders || []);
    setParsedOrders(updated);
    return updated;
  };

  const allowSaveParsedOrderAsIs = (orderId: number) => {
    setParsedOrders(prev => prev.map(po => po.id === orderId ? { ...po, allowSaveAsIs: true } : po));
    try { Swal.fire('تم', 'تم وضع الاوردر للسماح بالحفظ كما هو.', 'success'); } catch (e) {}
  };

  const saveParsedOrderLine = (orderId: number, index: number) => {
    // parsedOrders already updated by updateParsedProductField; just recompute totals for the order
    recalcParsedOrder(orderId);
    try { Swal.fire('تم الحفظ', 'تم حفظ تعديل السطر وتحديث إجماليات الاوردر.', 'success'); } catch (e) {}
  };

  const editParsedOrder = (order: any) => {
    // Map parsed order into manual new-order form for full editing
    const mappedItems = (order.products || []).map((p:any, idx:number) => ({ id: Date.now() + idx, productId: p.productId || '', name: p.name || '', color: p.color || '', size: p.size || '', qty: Number(p.quantity || 1), price: Number(p.price || 0) }));
    setOrderItems(mappedItems);
    setSelectedCustomerId('');
    setNewCustomer({ name: order.customerName || order.name || '', phone1: order.phone || order.phone1 || '', phone2: order.phone2 || '', governorate: order.governorate || '', address: order.address || '' });
    setNotes(order.notes || '');
    setEmployee(order.employee_raw || order.employee || '');
    setPage(order.page_raw || order.page || '');
    setView('new-order');
  };

  const editOrder = async (order: any) => {
    // Map a saved order into the manual new-order form for full editing
    
    // 1. Ensure we have the latest products list
    let productsList = existingProducts;
    if (!productsList || productsList.length === 0) {
      try {
        const resp = await fetch(`${API_BASE_PATH}/api.php?module=products&action=getFlat`);
        const j = await resp.json();
        if (j.success && j.data) {
          productsList = j.data;
          setExistingProducts(j.data); // Update state for future use
        }
      } catch (e) {
        console.error('Failed to load products for editOrder', e);
      }
    }

    const mappedItems = (order.products || []).map((p: any, idx: number) => {
      let productId = p.productId || p.product_id || (p.product && (p.product.id || p.product.product_id)) || p.id || '';
      let variant = productsList.find((ep: any) => Number(ep.id) === Number(productId));
      
      // If not found by id, try to match by name (fallback for imported orders)
      if (!variant && p.name) {
        const pName = String(p.name).trim().toLowerCase();
        variant = productsList.find((ep: any) => String(ep.name || '').trim().toLowerCase() === pName);
        if (variant) productId = variant.id;
      }

      return {
        id: Date.now() + idx + Math.random(),
        productId: productId || '',
        _parentId: variant ? String(variant.product_id || '') : '',
        _color: variant?.color || p.color || '',
        _size: variant?.size || p.size || '',
        name: (variant && variant.name) ? variant.name : (p.name || ''),
        color: variant?.color || p.color || '',
        size: variant?.size || p.size || '',
        qty: Number(p.quantity || p.qty || 1),
        price: Number(p.price || p.unit_price || (variant ? (variant.sale_price || variant.price) : 0) || 0),
      };
    });

    setOrderItems(mappedItems.length ? mappedItems : [{ id: Date.now(), productId: '', _parentId: '', _color: '', _size: '', color: '', size: '', qty: 1, price: 0 }]);
    
    // customer
    if (order.customerId || order.customer_id) setSelectedCustomerId(order.customerId || order.customer_id);
    else setSelectedCustomerId('');
    
    setNewCustomer({ 
      name: order.customerName || order.name || '', 
      phone1: order.phone || order.phone1 || '', 
      phone2: order.phone2 || '', 
      governorate: order.governorate || '', 
      address: order.address || '' 
    });
    
    setNotes(order.notes || '');
    setEmployee(order.employee_raw || order.employee || '');
    setPage(order.page_raw || order.page || '');
    
    // discounts / tax
    setDiscountType((order.discount_type || order.discountType) ? (normalizeRateType(order.discount_type || order.discountType) as RateType) : 'amount');
    setDiscountValue(Number(order.discount_value || order.discountValue || 0));
    setTaxType((order.tax_type || order.taxType) ? (normalizeRateType(order.tax_type || order.taxType) as RateType) : 'percent');
    
    // Robust tax rate handling (recognize 0 as a valid value)
    let explicitTaxValue = null;
    if (typeof order.tax_value !== 'undefined' && order.tax_value !== null) explicitTaxValue = Number(order.tax_value);
    else if (typeof order.taxValue !== 'undefined' && order.taxValue !== null) explicitTaxValue = Number(order.taxValue);
    
    if (explicitTaxValue !== null && !isNaN(explicitTaxValue)) {
      setTaxValue(explicitTaxValue);
    } else {
      setTaxValue(globalTaxRate);
    }

    // shipping
    setShippingValue(Number(order.shipping || order.shippingCost || order.shipping_fees || 0));
    
    // warehouses / sales office
    if (order.sales_office_id || order.salesOfficeId) setSelectedSalesOfficeId(order.sales_office_id || order.salesOfficeId);
    else setSelectedSalesOfficeId('');
    
    setDefaultWarehouseId(order.warehouse_id || order.warehouseId || '');
    
    // mark editing id and switch to form
    setEditingOrderId(Number(order.id));
    
    // ensure warehouses/options are loaded before showing form
    if ((window as any)._loadDragonWarehouses) {
      (window as any)._loadDragonWarehouses().finally(() => setView('new-order'));
    } else {
      setView('new-order');
    }
  };

  const updateParsedProductField = (orderId: number, index: number, field: string, value: any) => {
    setParsedOrders(prev => prev.map(po => {
      if (po.id !== orderId) return po;
      const products = (po.products || []).map((pp:any, idx:number) => {
        if (idx !== index) return pp;
        const updated = { ...pp, [field]: value };
        // Normalize values
        const name = (updated.name || '').toString().trim();
        const size = (updated.size || '').toString().trim();
        const color = (updated.color || '').toString().trim();

        // If user selected a productId explicitly, honor it
        let productId = updated.productId || null;
        let match: any = null;
        if (productId) {
          match = existingProducts.find((ep:any) => Number(ep.id) === Number(productId)) || null;
        } else if (name) {
          match = existingProducts.find((ep:any) => ep.name && ep.name.toLowerCase() === name.toLowerCase()) || null;
          if (!match) {
            match = existingProducts.find((ep:any) => (ep.name||'').toLowerCase().includes(name.toLowerCase()) || name.toLowerCase().includes((ep.name||'').toLowerCase())) || null;
          }
        }

        productId = match ? match.id : null;
        const missingProduct = !productId;
        const missingSize = !!(match && size && match.size && size.toString() !== match.size.toString());
        const missingColor = !!(match && color && match.color && color.toString() !== match.color.toString());

        // If we found a match, populate name/price/color/size from the matched product
        let outName = (updated.name || '').toString();
        let outPrice: any = updated.price;
        let outColor = (updated.color || '').toString();
        let outSize = (updated.size || '').toString();
        if (match) {
          if (match.name) outName = match.name;
          const saleSource = (localStorage.getItem('Dragon_default_sale_price_source') || 'product').toString();
          if (saleSource === 'product') {
            // Robust price extraction: prefer common price keys, then scan any numeric field
            const preferredKeys = ['sale_price','salePrice','sellingPrice','selling_price','price','cost','retail_price','retailPrice','default_price','amount','value'];
            let candidatePrice: any = outPrice;
            for (const k of preferredKeys) {
              if (match[k] !== undefined && match[k] !== null) {
                const num = Number(String(match[k]).replace(/,/g, ''));
                if (!isNaN(num) && num > 0) { candidatePrice = num; break; }
              }
            }
            // If still not found, scan all fields for a positive numeric value
            if ((!candidatePrice || Number(candidatePrice) === 0) && typeof match === 'object') {
              for (const k of Object.keys(match)) {
                try {
                  const v = match[k];
                  const num = Number(String(v).replace(/,/g, ''));
                  if (!isNaN(num) && num > 0) { candidatePrice = num; break; }
                } catch (e) { /* ignore */ }
              }
            }
            outPrice = Number(candidatePrice) || 0;
          } else {
            // saleSource === 'order' -> do not auto-fill price from product
            outPrice = Number(updated.price) || 0;
          }
          // Do NOT auto-overwrite parsed color/size from matched product.
          // Keep user's parsed `color` and `size` as-is to avoid unexpected modification.
          // outColor = (match.color ?? outColor);
          // outSize = (match.size ?? outSize);
          if (outPrice === 0 && saleSource === 'product') console.debug('Matched product has no positive price field', match);
        } else {
          outPrice = Number(outPrice) || 0;
        }

        return { ...updated, productId, missingProduct, missingSize, missingColor, name: outName, price: outPrice, color: outColor, size: outSize };
      });
      return { ...po, products };
    }));
  };

  const handlePrint = (ordersToPrint: any[]) => {
    setOrdersToPrint(ordersToPrint);
  };

  useEffect(() => {
    if (ordersToPrint) {
      const timer = setTimeout(() => {
        window.print();
        setTimeout(() => setOrdersToPrint(null), 1000); 
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [ordersToPrint]);

  const refreshOrdersList = async () => {
    try {
      const r = await fetch(`${API_BASE_PATH}/api.php?module=orders&action=getAll`);
      const jr = await r.json();
      if (jr && jr.success) {
        const fetched = jr.data || [];
        setOrders(fetched);
        // Automatically normalize Arabic/Persian numerals in phone fields and persist changes
        (async () => {
          try {
            const toUpdate: any[] = [];
            for (const o of fetched) {
              const combined = `${o.phone || ''}\n${o.phone1 || ''}\n${o.phone2 || ''}`;
              const newPrimary = pickDisplayPhone(combined, '');
              const newPhone2 = normalizeNumbers(o.phone2 || '');
              const currentPrimaryNormalized = normalizeNumbers(o.phone || '');
              // If primary changed (after normalization) or phone2 changed, schedule update
              if ((newPrimary && newPrimary !== currentPrimaryNormalized) || (newPhone2 && newPhone2 !== normalizeNumbers(o.phone2 || ''))) {
                const upd: any = { id: o.id };
                if (newPrimary && newPrimary !== currentPrimaryNormalized) upd.phone = newPrimary;
                if (newPhone2 && newPhone2 !== normalizeNumbers(o.phone2 || '')) upd.phone2 = newPhone2;
                toUpdate.push(upd);
              }
            }
            if (toUpdate.length > 0) {
              console.log('Normalizing phone digits for', toUpdate.length, 'orders');
              let applied = 0;
              for (const u of toUpdate) {
                try {
                  const res = await fetch(`${API_BASE_PATH}/api.php?module=orders&action=update`, {
                    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(u)
                  });
                  const jr2 = await res.json();
                  if (jr2 && jr2.success) applied++;
                } catch (e) {
                  console.error('Failed to persist normalized phone for order', u.id, e);
                }
              }
              if (applied > 0) {
                // refresh once more to reflect persisted normalized values
                const r2 = await fetch(`${API_BASE_PATH}/api.php?module=orders&action=getAll`);
                const jr3 = await r2.json();
                if (jr3 && jr3.success) setOrders(jr3.data || []);
              }
            }
          } catch (e) {
            console.error('Auto-normalize failed', e);
          }
        })();
        try {
          const saved = JSON.parse(localStorage.getItem('OrdersModule_selectedOrders') || '[]');
          if (Array.isArray(saved) && saved.length > 0) {
            // restore only ids that still exist in fetched orders
            const valid = saved.map((s:any) => Number(s)).filter((id:any) => fetched.find((o:any) => Number(o.id) === Number(id)));
            if (valid.length > 0) setSelectedOrders(valid);
          }
        } catch (e) {
          // ignore JSON parse errors
        }
      }
    } catch (e) {
      console.error('Failed to refresh orders list', e);
    }
  };

  // persist selectedOrders so printing selection survives page refresh
  useEffect(() => {
    try {
      localStorage.setItem('OrdersModule_selectedOrders', JSON.stringify(selectedOrders || []));
    } catch (e) {}
  }, [selectedOrders]);

  const openOrderDetails = async (order: any) => {
    setSelectedOrder(order);
    setIsOrderDetailsOpen(true);
    setOrderTimeline([]);
    setOrderDocuments([]);
    setStatusUpdate('');
    setStatusNote('');
    setStatusUpdateRepId(getPreferredRepIdForStatusChange(order));
    try {
      const [tRes, dRes] = await Promise.all([
        fetch(`${API_BASE_PATH}/api.php?module=orders&action=getTimeline&id=${order.id}`),
        fetch(`${API_BASE_PATH}/api.php?module=orders&action=getDocuments&id=${order.id}`)
      ]);
      const tJson = await tRes.json();
      const dJson = await dRes.json();
      if (tJson.success) setOrderTimeline(tJson.data || []);
      if (dJson.success) setOrderDocuments(dJson.data || []);
    } catch (e) {
      console.error('Failed to load order details', e);
    }
  };

  // Ensure warehouses are available when editing an order
  const ensureWarehousesLoaded = async () => {
    if (!warehouses || warehouses.length === 0) {
      try {
        const r = await fetch(`${API_BASE_PATH}/api.php?module=warehouses&action=getAll`);
        const jr = await r.json();
        if (jr && jr.success) setWarehouses(jr.data || []);
      } catch (e) { console.error('Failed to reload warehouses', e); }
    }
  };

  const addOrderDocument = async () => {
    if (!selectedOrder || !docUrl.trim()) {
      Swal.fire('بيانات ناقصة', 'يرجى إدخال رابط المستند.', 'warning');
      return;
    }
    try {
      const res = await fetch(`${API_BASE_PATH}/api.php?module=orders&action=addDocument`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          order_id: selectedOrder.id,
          doc_type: docType,
          doc_url: docUrl.trim(),
          notes: docNotes
        })
      });
      const jr = await res.json();
      if (jr.success) {
        setDocUrl('');
        setDocNotes('');
        const dRes = await fetch(`${API_BASE_PATH}/api.php?module=orders&action=getDocuments&id=${selectedOrder.id}`);
        const dJson = await dRes.json();
        if (dJson.success) setOrderDocuments(dJson.data || []);
      } else {
        Swal.fire('فشل الإضافة', jr.message || 'تعذر إضافة المستند.', 'error');
      }
    } catch (e) {
      console.error('Add order document failed', e);
    }
  };

  const deleteOrderDocument = async (id: number) => {
    if (!selectedOrder) return;
    try {
      const res = await fetch(`${API_BASE_PATH}/api.php?module=orders&action=deleteDocument`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      });
      const jr = await res.json();
      if (jr.success) {
        const dRes = await fetch(`${API_BASE_PATH}/api.php?module=orders&action=getDocuments&id=${selectedOrder.id}`);
        const dJson = await dRes.json();
        if (dJson.success) setOrderDocuments(dJson.data || []);
      } else {
        Swal.fire('فشل الحذف', jr.message || 'تعذر حذف المستند.', 'error');
      }
    } catch (e) {
      console.error('Delete order document failed', e);
    }
  };

  const updateOrderStatus = async () => {
    if (!selectedOrder || !statusUpdate) return;
    if (statusUpdate === 'with_rep' && !statusUpdateRepId) {
      Swal.fire('تنبيه', 'يرجى اختيار المندوب عند تغيير الحالة إلى "مع المندوب".', 'warning');
      return;
    }
    try {
      const payload: any = { id: selectedOrder.id, status: statusUpdate, status_note: statusNote };
      if (statusUpdateRepId) payload.rep_id = Number(statusUpdateRepId);
      const res = await fetch(`${API_BASE_PATH}/api.php?module=orders&action=update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const jr = await res.json();
      if (jr.success) {
        await refreshOrdersList();
        const tRes = await fetch(`${API_BASE_PATH}/api.php?module=orders&action=getTimeline&id=${selectedOrder.id}`);
        const tJson = await tRes.json();
        if (tJson.success) setOrderTimeline(tJson.data || []);
        setStatusUpdate('');
        setStatusNote('');
        setStatusUpdateRepId('');
        Swal.fire('تم التحديث', 'تم تحديث حالة الطلب.', 'success');
      } else {
        Swal.fire('فشل التحديث', jr.message || 'تعذر تحديث الحالة.', 'error');
      }
    } catch (e) {
      console.error('Update order status failed', e);
    }
  };

  const openStatusEdit = (order: any) => {
    setStatusEditOrder(order);
    setStatusEditTimeline([]);
    setStatusEditValue(order.status || '');
    setStatusEditNote('');
    setReturnFineMode('none');
    setReturnFineAmount('');
    setStatusEditRepId(getPreferredRepIdForStatusChange(order));
    setIsStatusEditOpen(true);
    fetch(`${API_BASE_PATH}/api.php?module=orders&action=getTimeline&id=${order.id}`)
      .then(r => r.json())
      .then(jr => {
        if (jr?.success) setStatusEditTimeline(jr.data || []);
      })
      .catch(err => {
        console.error('Failed to load status edit timeline', err);
      });
  };

  useEffect(() => {
    if (!selectedOrder || statusUpdateRepId) return;
    if (!shouldAutofillRepForDeliveredReturnedSwitch(selectedOrder.status, statusUpdate)) return;
    const preferredRepId = getPreferredRepIdForStatusChange(selectedOrder, orderTimeline);
    if (preferredRepId) setStatusUpdateRepId(preferredRepId);
  }, [selectedOrder, statusUpdate, statusUpdateRepId, orderTimeline]);

  useEffect(() => {
    if (!statusEditOrder || statusEditRepId) return;
    if (!shouldAutofillRepForDeliveredReturnedSwitch(statusEditOrder.status, statusEditValue)) return;
    const preferredRepId = getPreferredRepIdForStatusChange(statusEditOrder, statusEditTimeline);
    if (preferredRepId) setStatusEditRepId(preferredRepId);
  }, [statusEditOrder, statusEditValue, statusEditRepId, statusEditTimeline]);

  // when opening details, also ensure warehouses available for potential edits
  const openOrderAndEnsure = async (order: any) => {
    await ensureWarehousesLoaded();
    openOrderDetails(order);
  };

  const submitStatusEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!statusEditOrder || !statusEditValue) {
      Swal.fire('تنبيه', 'يرجى اختيار الحالة.', 'warning');
      return;
    }
    if (statusEditValue === 'with_rep' && !statusEditRepId) {
      Swal.fire('تنبيه', 'يرجى اختيار المندوب عند تغيير الحالة إلى "مع المندوب".', 'warning');
      return;
    }
    if (returnFineMode === 'fine') {
      const fine = Number(returnFineAmount || 0);
      if (!fine || isNaN(fine) || fine <= 0) {
        Swal.fire('تنبيه', 'يرجى إدخال مبلغ غرامة صحيح.', 'warning');
        return;
      }
      if (!statusEditRepId && !statusEditOrder.rep_id && !statusEditOrder.repId) {
        Swal.fire('تنبيه', 'لا يوجد مندوب مرتبط بهذا الاوردر لتطبيق الغرامة.', 'warning');
        return;
      }
    }
    try {
      const editPayload: any = {
        id: statusEditOrder.id,
        status: statusEditValue,
        status_note: statusEditNote,
        penalty_apply: returnFineMode === 'fine' ? 1 : 0,
        penalty_amount: returnFineMode === 'fine' ? Number(returnFineAmount || 0) : 0
      };
      if (statusEditRepId) editPayload.rep_id = Number(statusEditRepId);
      const res = await fetch(`${API_BASE_PATH}/api.php?module=orders&action=update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editPayload)
      });
      const jr = await res.json();
      if (jr.success) {
        await refreshOrdersList();
        setIsStatusEditOpen(false);
        Swal.fire('تم التحديث', 'تم تحديث حالة الطلب.', 'success');
      } else {
        Swal.fire('فشل التحديث', jr.message || 'تعذر تحديث الحالة.', 'error');
      }
    } catch (err) {
      console.error('Update order status failed', err);
      Swal.fire('خطأ', 'فشل الاتصال بالخادم.', 'error');
    }
  };

  return (
    <div className="space-y-6 dir-rtl">
      
      {/* Hidden Print Container */}
      {ordersToPrint && (
        <div id="print-container">
           <PrintableOrders orders={ordersToPrint} companyName={effectiveHeaderName} companyPhone={effectiveHeaderPhone} terms={companyTermsState} companyAddress={companyAddressState} companyLogo={companyLogoState} users={users} />
        </div>
      )}

      {isOrderDetailsOpen && selectedOrder && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white w-full max-w-5xl rounded-3xl overflow-hidden shadow-2xl">
                <div className="p-6 border-b flex justify-between items-center bg-slate-50">
              <div>
                <h3 className="text-lg font-black text-slate-800">تفاصيل الطلب #{selectedOrder.orderNumber}</h3>
                <p className="text-xs text-slate-500">
                  {selectedOrder.customerName} • {pickDisplayPhone(`${selectedOrder.phone || ''}\n${selectedOrder.phone1 || ''}\n${selectedOrder.phone2 || ''}`, '')}
                  {selectedOrder.phone2 && String(selectedOrder.phone2).trim() !== '' && (
                    <span> • {normalizeNumbers(selectedOrder.phone2)}</span>
                  )}
                </p>
              </div>
              <button onClick={() => setIsOrderDetailsOpen(false)} className="text-slate-400 hover:text-rose-500">إغلاق</button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 p-6">
              <div className="lg:col-span-2 space-y-6">
                <div className="border rounded-2xl p-4">
                  <h4 className="text-sm font-black mb-3">تحديث الحالة</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                    <CustomSelect
                      value={statusUpdate}
                      onChange={v => {
                        setStatusUpdate(v);
                        if (selectedOrder && shouldAutofillRepForDeliveredReturnedSwitch(selectedOrder.status, v)) {
                          const preferredRepId = getPreferredRepIdForStatusChange(selectedOrder, orderTimeline);
                          if (preferredRepId) setStatusUpdateRepId(preferredRepId);
                        }
                      }}
                      options={[
                        { value: '', label: 'اختر حالة' },
                        { value: 'pending', label: 'قيد الانتظار' },
                        { value: 'with_rep', label: 'مع المندوب' },
                        { value: 'in_delivery', label: 'قيد التسليم' },
                        { value: 'delivered', label: 'تم التسليم' },
                        { value: 'returned', label: 'مرتجع' }
                      ]}
                      className="text-sm"
                    />
                    <input value={statusNote} onChange={e => setStatusNote(e.target.value)} placeholder="ملاحظة التغيير" className="border rounded-lg px-3 py-2 text-sm md:col-span-2" />
                  </div>
                  <div className="mt-2">
                    <label className="text-xs font-bold text-slate-500 block mb-1">
                      المندوب {statusUpdate === 'with_rep' && <span className="text-rose-500">*</span>}
                    </label>
                    <CustomSelect
                      value={statusUpdateRepId}
                      onChange={v => setStatusUpdateRepId(v)}
                      options={[
                        { value: '', label: 'بدون مندوب' },
                        ...reps.map((r: any) => ({ value: String(r.id), label: r.name || r.fullname || `مندوب #${r.id}` }))
                      ]}
                      className="text-sm"
                    />
                  </div>
                  <button onClick={updateOrderStatus} className="mt-3 bg-blue-600 text-white px-4 py-2 rounded-lg text-xs font-bold">تحديث الحالة</button>
                </div>

                <div className="border rounded-2xl p-4">
                  <h4 className="text-sm font-black mb-3">ملخص الفاتورة</h4>
                  <div className="text-xs space-y-1">
                    <div className="flex justify-between"><span>الإجمالي قبل الإضافات</span><span>{selectedOrderSubtotal.toLocaleString()} {currencySymbol}</span></div>
                    {selectedOrderDiscountAmount > 0 && (
                      <div className="flex justify-between text-rose-600"><span>الخصم</span><span>-{selectedOrderDiscountAmount.toLocaleString()} {currencySymbol}</span></div>
                    )}
                    {selectedOrderTaxAmount > 0 && (
                      <div className="flex justify-between text-emerald-600"><span>الضريبة</span><span>+{selectedOrderTaxAmount.toLocaleString()} {currencySymbol}</span></div>
                    )}
                    <div className="flex justify-between"><span>الشحن</span><span>{selectedOrderShipping.toLocaleString()} {currencySymbol}</span></div>
                    <div className="flex justify-between font-black pt-2 border-t"><span>الإجمالي</span><span>{selectedOrderTotal.toLocaleString()} {currencySymbol}</span></div>
                  </div>
                </div>

                <div className="border rounded-2xl p-4">
                  <h4 className="text-sm font-black mb-3">سجل الحالة</h4>
                  {orderTimeline.length === 0 ? (
                    <div className="text-xs text-slate-400">لا يوجد سجل حتى الآن.</div>
                  ) : (
                    <div className="space-y-2 max-h-72 overflow-y-auto">
                      {orderTimeline.map((t:any) => (
                        <div key={t.id} className="border rounded-xl p-3 text-xs">
                          <div className="flex justify-between items-center">
                            <span className="font-bold">{t.status || t.action}</span>
                            <span className="text-slate-400">{t.created_at || t.createdAt}</span>
                          </div>
                          <div className="text-slate-500 mt-1">{t.notes || '-'}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-6">
                <div className="border rounded-2xl p-4">
                  <h4 className="text-sm font-black mb-3">المستندات</h4>
                  <div className="space-y-2 mb-3">
                    <CustomSelect
                      value={docType}
                      onChange={v => setDocType(v)}
                      options={[
                        { value: 'delivery_note', label: 'إيصال تسليم' },
                        { value: 'invoice', label: 'فاتورة' },
                        { value: 'proof', label: 'إثبات' },
                        { value: 'other', label: 'أخرى' }
                      ]}
                      className="text-xs w-full"
                    />
                    <input value={docUrl} onChange={e => setDocUrl(e.target.value)} placeholder="رابط المستند" className="border rounded-lg px-3 py-2 text-xs w-full" />
                    <input value={docNotes} onChange={e => setDocNotes(e.target.value)} placeholder="ملاحظات" className="border rounded-lg px-3 py-2 text-xs w-full" />
                    <button onClick={addOrderDocument} className="w-full bg-emerald-600 text-white px-3 py-2 rounded-lg text-xs font-bold">إضافة مستند</button>
                  </div>

                  {orderDocuments.length === 0 ? (
                    <div className="text-xs text-slate-400">لا توجد مستندات.</div>
                  ) : (
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {orderDocuments.map((d:any) => (
                        <div key={d.id} className="border rounded-xl p-2 text-xs">
                          <div className="flex justify-between items-center">
                            <span className="font-bold">{d.doc_type || d.type}</span>
                            <button onClick={() => deleteOrderDocument(d.id)} className="text-rose-500">حذف</button>
                          </div>
                          <a href={d.doc_url || d.url} target="_blank" rel="noreferrer" className="text-blue-600 break-all">{d.doc_url || d.url}</a>
                          <div className="text-slate-500 mt-1">{d.notes || '-'}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {isStatusEditOpen && statusEditOrder && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl">
            <div className="p-6 border-b flex justify-between items-center bg-slate-50">
              <div>
                <h3 className="text-lg font-black text-slate-800">تعديل حالة الطلب</h3>
                <p className="text-xs text-slate-500">#{statusEditOrder.orderNumber} • {statusEditOrder.customerName}</p>
              </div>
              <button onClick={() => setIsStatusEditOpen(false)} className="text-slate-400 hover:text-rose-500">إغلاق</button>
            </div>
            <form onSubmit={submitStatusEdit} className="p-6 space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500">الحالة</label>
                <CustomSelect
                  value={statusEditValue}
                  onChange={v => {
                    setStatusEditValue(v);
                    if (statusEditOrder && shouldAutofillRepForDeliveredReturnedSwitch(statusEditOrder.status, v)) {
                      const preferredRepId = getPreferredRepIdForStatusChange(statusEditOrder, statusEditTimeline);
                      if (preferredRepId) setStatusEditRepId(preferredRepId);
                    }
                  }}
                  options={[
                    { value: '', label: 'اختر حالة' },
                    { value: 'pending', label: 'قيد الانتظار' },
                    { value: 'with_rep', label: 'مع المندوب' },
                    { value: 'in_delivery', label: 'قيد التسليم' },
                    { value: 'delivered', label: 'تم التسليم' },
                    { value: 'returned', label: 'مرتجع' }
                  ]}
                  className="w-full"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500">
                  المندوب {statusEditValue === 'with_rep' && <span className="text-rose-500">*</span>}
                </label>
                <CustomSelect
                  value={statusEditRepId}
                  onChange={v => setStatusEditRepId(v)}
                  options={[
                    { value: '', label: 'بدون مندوب' },
                    ...reps.map((r: any) => ({ value: String(r.id), label: r.name || r.fullname || `مندوب #${r.id}` }))
                  ]}
                  className="w-full"
                />
              </div>

              <div className="space-y-3">
                <label className="text-xs font-bold text-slate-500">الغرامة على المندوب</label>
                <div className="flex gap-3">
                  <label className="flex items-center gap-2 text-xs font-bold text-slate-600">
                    <input type="radio" checked={returnFineMode === 'none'} onChange={() => setReturnFineMode('none')} />
                    بدون غرامة
                  </label>
                  <label className="flex items-center gap-2 text-xs font-bold text-slate-600">
                    <input type="radio" checked={returnFineMode === 'fine'} onChange={() => setReturnFineMode('fine')} />
                    بغرامة
                  </label>
                </div>
                {returnFineMode === 'fine' && (
                  <div>
                    <label className="text-xs font-bold text-slate-500">مبلغ الغرامة</label>
                    <input
                      type="number"
                      min="0"
                      value={returnFineAmount}
                      onChange={e => setReturnFineAmount(e.target.value)}
                      className="w-full border rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                )}
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500">ملاحظة</label>
                <input
                  value={statusEditNote}
                  onChange={e => setStatusEditNote(e.target.value)}
                  placeholder="سبب التعديل"
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                />
              </div>

              <button type="submit" className="w-full bg-blue-600 text-white px-4 py-3 rounded-lg text-sm font-bold">حفظ التعديل</button>
            </form>
          </div>
        </div>
      )}
      
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-900">إدارة الاوردرات</h2>
          <p className="text-sm text-slate-500 font-medium">نظام تتبع وإدارة المبيعات</p>
        </div>
        <div className="flex gap-1 bg-white p-1.5 rounded-2xl border border-slate-200 shadow-sm w-full md:w-auto overflow-x-auto">
          <button onClick={() => setView('new-order')} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all whitespace-nowrap ${view === 'new-order' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}><PlusCircle size={16}/> اوردر جديد</button>
          <button onClick={() => setView('manage-orders')} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all whitespace-nowrap ${view === 'manage-orders' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}><FileText size={16}/> إدارة الاوردرات</button>
          <button onClick={() => setView('import-orders')} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all whitespace-nowrap ${view === 'import-orders' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}><UploadCloud size={16}/> استيراد</button>
        </div>
      </div>

      {/* --- Views --- */}
      {view === 'new-order' && (
        <div className="space-y-5">

          {/* ── Page Header ── */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white px-6 py-4 rounded-3xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-3">
              {editingOrderId && (
                <button
                  onClick={() => { setEditingOrderId(null); setView('manage-orders'); }}
                  className="w-10 h-10 flex items-center justify-center rounded-full bg-slate-100 hover:bg-slate-200 transition-colors flex-shrink-0"
                  title="العودة لإدارة الاوردرات"
                >
                  <ChevronRight size={20} className="text-slate-600" />
                </button>
              )}
              <div>
                <h3 className="text-xl font-black text-slate-900">
                  {editingOrderId ? 'تعديل الاوردر' : 'إنشاء اوردر جديد'}
                </h3>
                <p className="text-sm text-slate-500">
                  {editingOrderId ? `رقم المرجع: #${editingOrderId}` : 'أدخل بيانات الاوردر اليدوي'}
                </p>
              </div>
            </div>
            <button
              onClick={saveManualOrder}
              className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white px-6 py-3 rounded-2xl text-sm font-black shadow-lg shadow-emerald-200/60 transition-all"
            >
              <ShoppingCart size={18} />
              {editingOrderId ? 'حفظ التعديلات' : 'حفظ الاوردر'}
            </button>
          </div>

          {/* ── Main Two-Column Grid ── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

            {/* ── LEFT COLUMN ── */}
            <div className="lg:col-span-1 space-y-4">

              {/* Sales Office Card */}
              {salesDisplayMethod === 'sales_offices' && (
                <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm">
                  <h4 className="text-sm font-black text-slate-700 mb-3 flex items-center gap-2">
                    <span className="w-7 h-7 bg-purple-100 text-purple-600 rounded-xl flex items-center justify-center text-xs font-black">م</span>
                    مكتب المبيعات
                  </h4>
                  {isSalesOfficeScopeNone ? (
                    <p className="text-xs text-slate-500 bg-slate-50 rounded-xl p-3">هذا المستخدم بدون مكاتب مبيعات — سيتم استخدام بيانات الشركة.</p>
                  ) : (
                    <div className="space-y-2">
                      <CustomSelect
                        value={selectedSalesOfficeId ? String(selectedSalesOfficeId) : ''}
                        onChange={v => setSelectedSalesOfficeId(v ? Number(v) : '')}
                        options={[
                          { value: '', label: 'اختيار مكتب' },
                          ...((canChangeSalesOffice ? salesOffices : salesOffices.filter(o => Number(o.id) === Number(defaultSalesOfficeId))).map((o: any) => ({ value: String(o.id), label: o.name })))
                        ]}
                        disabled={!canChangeSalesOffice && defaultSalesOfficeId !== null && defaultSalesOfficeId !== undefined}
                        className="w-full"
                      />
                      {selectedSalesOffice && (
                        <p className="text-xs text-slate-500 px-1">{selectedSalesOffice.phones || ''}</p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Customer Card */}
              <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm">
                <h4 className="text-sm font-black text-slate-700 mb-4 flex items-center gap-2">
                  <User size={16} className="text-blue-500" />
                  بيانات العميل
                </h4>

                {/* Customer Selector */}
                <div className="mb-4">
                  <label className="text-xs font-black text-slate-500 mb-1.5 block">اختر من العملاء الموجودين</label>
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <CustomSelect
                        value={selectedCustomerId ? String(selectedCustomerId) : ''}
                        onChange={v => setSelectedCustomerId(v ? Number(v) : '')}
                        options={[{ value: '', label: '— عميل جديد —' }, ...customers.map((c: any) => ({ value: String(c.id), label: `${c.name} - ${c.phone1 || ''}` }))]}
                        className="w-full"
                      />
                    </div>
                    {selectedCustomerId !== '' && (
                      <button
                        className="flex-shrink-0 px-3 py-2 text-xs font-black text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
                        onClick={() => { setSelectedCustomerId(''); setNewCustomer({ name: '', phone1: '', phone2: '', governorate: '', address: '' }); }}
                      >
                        إلغاء
                      </button>
                    )}
                  </div>
                </div>

                {/* Customer Fields */}
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-black text-slate-500 mb-1.5 block">اسم العميل</label>
                    <input
                      placeholder="الاسم الكامل"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                      value={selectedCustomerId ? (customers.find((c: any) => c.id === selectedCustomerId)?.name || '') : newCustomer.name}
                      onChange={e => { if (!selectedCustomerId) setNewCustomer({ ...newCustomer, name: e.target.value }); }}
                      disabled={!!selectedCustomerId}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs font-black text-slate-500 mb-1.5 flex items-center gap-1"><Phone size={11} /> هاتف 1</label>
                      <input
                        placeholder="01xxxxxxxxx"
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                        value={selectedCustomerId ? (customers.find((c: any) => c.id === selectedCustomerId)?.phone1 || '') : newCustomer.phone1}
                        onChange={e => { if (!selectedCustomerId) setNewCustomer({ ...newCustomer, phone1: e.target.value }); }}
                        disabled={!!selectedCustomerId}
                      />
                    </div>
                    <div>
                      <label className="text-xs font-black text-slate-500 mb-1.5 block">هاتف 2</label>
                      <input
                        placeholder="اختياري"
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                        value={selectedCustomerId ? (customers.find((c: any) => c.id === selectedCustomerId)?.phone2 || '') : newCustomer.phone2}
                        onChange={e => { if (!selectedCustomerId) setNewCustomer({ ...newCustomer, phone2: e.target.value }); }}
                        disabled={!!selectedCustomerId}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-black text-slate-500 mb-1.5 flex items-center gap-1"><MapPin size={11} /> المحافظة</label>
                    <input
                      placeholder="المحافظة"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                      value={selectedCustomerId ? (customers.find((c: any) => c.id === selectedCustomerId)?.governorate || '') : newCustomer.governorate}
                      onChange={e => { if (!selectedCustomerId) setNewCustomer({ ...newCustomer, governorate: e.target.value }); }}
                      disabled={!!selectedCustomerId}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-black text-slate-500 mb-1.5 block">العنوان التفصيلي</label>
                    <input
                      placeholder="الشارع، المبنى..."
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                      value={selectedCustomerId ? (customers.find((c: any) => c.id === selectedCustomerId)?.address || '') : newCustomer.address}
                      onChange={e => { if (!selectedCustomerId) setNewCustomer({ ...newCustomer, address: e.target.value }); }}
                      disabled={!!selectedCustomerId}
                    />
                  </div>
                </div>
              </div>

              {/* Notes & Meta Card */}
              <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm">
                <h4 className="text-sm font-black text-slate-700 mb-4 flex items-center gap-2">
                  <FileText size={16} className="text-slate-400" />
                  ملاحظات وبيانات إضافية
                </h4>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-black text-slate-500 mb-1.5 block">ملاحظات الاوردر</label>
                    <textarea
                      placeholder="ملاحظات خاصة بالاوردر..."
                      rows={3}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all resize-none"
                      value={notes}
                      onChange={e => setNotes(e.target.value)}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs font-black text-slate-500 mb-1.5 block">الموظف</label>
                      <input
                        placeholder="اسم الموظف"
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                        value={employee}
                        onChange={e => setEmployee(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="text-xs font-black text-slate-500 mb-1.5 block">البيدج</label>
                      <input
                        placeholder="رقم البيدج"
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                        value={page}
                        onChange={e => setPage(e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              </div>

            </div>{/* end LEFT COLUMN */}

            {/* ── RIGHT COLUMN ── */}
            <div className="lg:col-span-2 space-y-4">

              {/* Order Items Card */}
              <div className="bg-white rounded-3xl border border-slate-200 shadow-sm">
                <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                  <h4 className="text-sm font-black text-slate-700 flex items-center gap-2">
                    <ShoppingCart size={16} className="text-blue-500" />
                    عناصر الطلب
                    <span className="bg-blue-100 text-blue-700 text-xs font-black px-2 py-0.5 rounded-full">{orderItems.length}</span>
                  </h4>
                  <button
                    onClick={addOrderItem}
                    className="flex items-center gap-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-black px-3 py-2 rounded-xl transition-colors"
                  >
                    <PlusCircle size={14} /> إضافة منتج
                  </button>
                </div>

                {/* Column Headers */}
                <div className="hidden md:grid grid-cols-[2rem_1fr_7rem_7rem_4rem_6rem_4rem_2rem] gap-2 px-4 py-2 bg-slate-50 border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-wide">
                  <div></div>
                  <div>المنتج</div>
                  <div className="text-center">المقاس</div>
                  <div className="text-center">اللون</div>
                  <div className="text-center">الكمية</div>
                  <div className="text-center">السعر</div>
                  <div className="text-center">الإجمالي</div>
                  <div></div>
                </div>

                {/* Item Rows */}
                <div className="divide-y divide-slate-100">
                  {orderItems.map((it, _idx) => {
                    const ia = it as any;
                    const parentId = ia._parentId || '';
                    const selColor = ia._color || '';
                    const selSize  = ia._size  || '';

                    const selectedVariants = getVariantsForSelectedParent(parentId);

                    const sizeOptions: string[] = parentId
                      ? [...new Set<string>(
                          selectedVariants
                            .filter((ep: any) => ep.size)
                            .map((ep: any) => ep.size as string)
                        )]
                      : [];

                    const colorOptions: string[] = parentId
                      ? [...new Set<string>(
                          selectedVariants
                            .filter((ep: any) =>
                              (selSize ? ep.size === selSize : true) &&
                              ep.color
                            )
                            .map((ep: any) => ep.color as string)
                        )]
                      : [];

                    return (
                      <div key={it.id} className="grid grid-cols-[2rem_1fr_7rem_7rem_4rem_6rem_4rem_2rem] gap-2 px-4 py-2.5 items-center hover:bg-slate-50/60 transition-colors">

                        {/* # */}
                        <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-400 text-[10px] font-black flex items-center justify-center">{_idx + 1}</span>

                        {/* Product */}
                        <CustomSelect
                          value={parentId ? String(parentId) : ''}
                          onChange={v => updateOrderItemField(it.id, '_parentId', v)}
                          options={[{ value: '', label: '— منتج —' }, ...parentProductsMap.map(p => ({ value: String(p.id), label: p.name }))]}
                          className="w-full text-xs"
                        />

                        {/* Size */}
                        {sizeOptions.length > 0 ? (
                          <CustomSelect
                            value={selSize}
                            onChange={v => updateOrderItemField(it.id, '_size', v)}
                            options={[{ value: '', label: '— مقاس —' }, ...sizeOptions.map(s => ({ value: s, label: s }))]}
                            className="w-full text-xs"
                          />
                        ) : (
                          <div className="h-9 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center text-[10px] text-slate-300">—</div>
                        )}

                        {/* Color */}
                        {colorOptions.length > 0 ? (
                          <CustomSelect
                            value={selColor}
                            onChange={v => updateOrderItemField(it.id, '_color', v)}
                            options={[{ value: '', label: '— لون —' }, ...colorOptions.map(c => ({ value: c, label: c }))]}
                            className="w-full text-xs"
                          />
                        ) : (
                          <div className="h-9 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center text-[10px] text-slate-300">—</div>
                        )}

                        {/* Qty */}
                        <input
                          type="number" min={1}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-1 py-2 text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                          value={it.qty}
                          onChange={e => updateOrderItemField(it.id, 'qty', Number(e.target.value || 0))}
                        />

                        {/* Price */}
                        <div className="relative">
                          <input
                            type="number" min={0}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-1 py-2 text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all pl-6"
                            value={it.price}
                            onChange={e => updateOrderItemField(it.id, 'price', Number(e.target.value || 0))}
                          />
                          <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-[9px] text-slate-400 font-bold pointer-events-none">ج.م</span>
                        </div>

                        {/* Row total */}
                        <div className="text-center">
                          <span className="text-xs font-black text-slate-700 tabular-nums">{(it.qty * it.price).toLocaleString('ar-EG')}</span>
                        </div>

                        {/* Delete */}
                        <button
                          className="w-7 h-7 flex items-center justify-center rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-400 transition-colors mx-auto"
                          onClick={() => removeOrderItem(it.id)}
                          title="حذف"
                        >
                          <MinusCircle size={13} />
                        </button>
                      </div>
                    );
                  })}
                  {orderItems.length === 0 && (
                    <div className="py-14 text-center">
                      <ShoppingCart className="w-12 h-12 mx-auto text-slate-200 mb-3" />
                      <p className="text-slate-400 text-sm font-bold">لا توجد عناصر.</p>
                      <p className="text-slate-400 text-xs mt-1">اضغط «إضافة منتج» للبدء.</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Pricing & Totals Card */}
              <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm">
                <h4 className="text-sm font-black text-slate-700 mb-4 flex items-center gap-2">
                  <RefreshCcw size={15} className="text-slate-400" />
                  التسعير والمجاميع
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-5">
                  {/* Discount */}
                  <div className="bg-slate-50 rounded-2xl p-3.5">
                    <label className="text-[11px] font-black text-slate-500 uppercase tracking-wide mb-2.5 block">الخصم</label>
                    <div className="flex gap-2">
                      <CustomSelect
                        value={discountType}
                        onChange={v => setDiscountType(v as RateType)}
                        options={[{ value: 'amount', label: 'قيمة' }, { value: 'percent', label: '%' }]}
                        className="text-sm"
                      />
                      <input
                        type="number" min={0}
                        value={discountValue}
                        onChange={e => setDiscountValue(Number(e.target.value || 0))}
                        className="flex-1 bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                        placeholder="0"
                      />
                    </div>
                  </div>
                  {/* Tax */}
                  <div className="bg-slate-50 rounded-2xl p-3.5">
                    <label className="text-[11px] font-black text-slate-500 uppercase tracking-wide mb-2.5 block">الضريبة</label>
                    <div className="flex gap-2">
                      <CustomSelect
                        value={taxType}
                        onChange={v => setTaxType(v as RateType)}
                        options={[{ value: 'percent', label: '%' }, { value: 'amount', label: 'قيمة' }]}
                        className="text-sm"
                      />
                      <input
                        type="number" min={0}
                        value={taxValue}
                        onChange={e => setTaxValue(Number(e.target.value || 0))}
                        className="flex-1 bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                        placeholder="0"
                      />
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1.5">الترتيب حسب إعدادات النظام.</p>
                  </div>
                  {/* Shipping */}
                  <div className="bg-slate-50 rounded-2xl p-3.5">
                    <label className="text-[11px] font-black text-slate-500 uppercase tracking-wide mb-2.5 block">مصاريف الشحن</label>
                    <div className="relative">
                      <input
                        type="number" min={0}
                        value={shippingValue}
                        onChange={e => setShippingValue(Number(e.target.value || 0))}
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all pl-10"
                        placeholder="0"
                      />
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[11px] text-slate-400 font-bold pointer-events-none">ج.م</span>
                    </div>
                  </div>
                </div>

                {/* Live Totals Summary */}
                {(() => {
                  const _sub = orderItems.reduce((s, it) => s + (it.qty * it.price), 0);
                  const _totals = calculateOrderTotals(_sub, shippingValue, discountType, discountValue, taxType, taxValue, salesCalcOrder);
                  return (
                    <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-5 text-white">
                      <div className="space-y-2.5 text-sm">
                        <div className="flex justify-between items-center">
                          <span className="text-slate-400">المجموع الفرعي</span>
                          <span className="font-bold tabular-nums">{_totals.subtotal.toLocaleString('ar-EG')} {currencySymbol}</span>
                        </div>
                        {_totals.discountAmount > 0 && (
                          <div className="flex justify-between items-center text-rose-400">
                            <span>الخصم</span>
                            <span className="font-bold tabular-nums">− {_totals.discountAmount.toLocaleString('ar-EG')} {currencySymbol}</span>
                          </div>
                        )}
                        {_totals.taxAmount > 0 && (
                          <div className="flex justify-between items-center text-amber-300">
                            <span>الضريبة</span>
                            <span className="font-bold tabular-nums">+ {_totals.taxAmount.toLocaleString('ar-EG')} {currencySymbol}</span>
                          </div>
                        )}
                        {shippingValue > 0 && (
                          <div className="flex justify-between items-center text-sky-300">
                            <span>الشحن</span>
                            <span className="font-bold tabular-nums">+ {shippingValue.toLocaleString('ar-EG')} {currencySymbol}</span>
                          </div>
                        )}
                        <div className="border-t border-slate-600/60 pt-3 flex justify-between items-center">
                          <span className="text-base font-black">الإجمالي النهائي</span>
                          <span className="text-xl font-black text-emerald-400 tabular-nums">{_totals.total.toLocaleString('ar-EG')} {currencySymbol}</span>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* Save Button */}
                <div className="mt-5 flex justify-end">
                  <button
                    onClick={saveManualOrder}
                    className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white px-8 py-3 rounded-2xl text-sm font-black shadow-lg shadow-emerald-200/60 transition-all"
                  >
                    <ShoppingCart size={18} />
                    {editingOrderId ? 'حفظ التعديلات' : 'حفظ الاوردر'}
                  </button>
                </div>
              </div>

            </div>{/* end RIGHT COLUMN */}
          </div>{/* end grid */}
        </div>
      )}

      {view === 'manage-orders' && (
        <div className="space-y-4">
          {/* Toolbar */}
          <div className="bg-white p-4 rounded-3xl shadow-sm border border-slate-200 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="relative flex-1 w-full md:max-w-md">
              <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
              <input 
                type="text" 
                placeholder="بحث برقم الاوردر، اسم العميل، الهاتف..." 
                value={searchTerm} 
                onChange={e => setSearchTerm(e.target.value)} 
                className="w-full pr-10 pl-4 py-3 bg-slate-50 border-none rounded-2xl text-sm focus:ring-2 focus:ring-blue-500 transition-all" 
              />
            </div>
            
            <div className="flex items-center gap-3 w-full md:w-auto">
                <CustomSelect
                  value={statusFilter}
                  onChange={v => setStatusFilter(v)}
                  options={[
                    { value: 'all', label: 'كل الحالات' },
                    { value: 'pending', label: 'قيد الانتظار' },
                    { value: 'with_rep', label: 'مع المندوب' },
                    { value: 'in_delivery', label: 'قيد التسليم' },
                    { value: 'delivered', label: 'تم التسليم' },
                    { value: 'returned', label: 'مرتجع' },
                    { value: 'cancelled', label: 'ملغي' }
                  ]}
                  className="text-sm font-bold min-w-[180px]"
                />
                <div className="flex items-center gap-2">
                  <label className="text-xs text-slate-500 mr-1">تاريخ</label>
                  <input
                    type="date"
                    value={dateFilter === 'all' ? '' : dateFilter}
                    onChange={e => setDateFilter(e.target.value ? e.target.value : 'all')}
                    className="border rounded px-2 py-2 text-sm bg-white text-slate-700 appearance-none"
                  />
                  <button onClick={() => setDateFilter('all')} className="text-xs text-blue-600 px-2">الكل</button>
                </div>
                <button 
                  onClick={toggleSelectAll}
                  className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 border border-slate-200 px-4 py-3 rounded-2xl text-xs font-bold text-slate-600 transition-all"
                >
                    {selectedOrders.length === filteredOrders.length && filteredOrders.length > 0 ? <CheckSquare size={16} className="text-blue-600"/> : <Square size={16}/>}
                    {selectedOrders.length === filteredOrders.length ? 'إلغاء الكل' : 'تحديد الكل'}
                </button>

                <button 
                    onClick={() => handlePrint(orders.filter(o => selectedOrders.includes(o.id)))} 
                    disabled={selectedOrders.length === 0} 
                    className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-slate-800 text-white px-6 py-3 rounded-2xl text-xs font-bold hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-slate-200 transition-all"
                >
                    <Printer size={16}/> طباعة المحدد ({selectedOrders.length})
                </button>
            </div>
          </div>

          {/* New Card Grid Layout (Unified with Import View) */}
          {filteredOrders.length === 0 ? (
             <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-slate-300">
                <FileText className="w-16 h-16 mx-auto text-slate-200 mb-4"/>
               <p className="text-slate-400 font-bold">لا توجد اوردرات مطابقة للبحث</p>
             </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-5">
              {filteredOrders.map(order => (
                <div 
                  key={order.id} 
                  className={`relative group bg-white p-0 rounded-3xl border transition-all duration-300 hover:shadow-xl hover:-translate-y-1 ${selectedOrders.includes(order.id) ? 'border-blue-500 ring-2 ring-blue-500/20 z-10' : 'border-slate-200 shadow-sm'}`}
                >
                    {/* Selection Checkbox (Absolute) */}
                    <div className="absolute top-4 left-4 z-20">
                        <button 
                          onClick={() => toggleSelectOne(order.id)}
                          className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${selectedOrders.includes(order.id) ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-300 hover:bg-slate-200'}`}
                        >
                           {selectedOrders.includes(order.id) ? <CheckSquare size={16}/> : <Square size={16}/>}
                        </button>
                    </div>

                    {/* Card Content */}
                    <div className="p-5">
                        {/* Header */}
                        <div className="flex justify-between items-start mb-4 pl-10">
                            <div>
                                <span className="inline-block bg-slate-100 text-slate-600 font-mono text-[10px] px-2 py-1 rounded-lg mb-1">{order.orderNumber}</span>
                                <h3 className="font-bold text-slate-800 text-sm line-clamp-1">{order.customerName}</h3>
                            </div>
                            <div className="flex flex-col items-end gap-1">
                              {getStatusChip(order.status)}
                              <div className="mt-2 flex items-center gap-2">
                                <button onClick={() => editOrder(order)} title="تعديل الطلب" className="flex items-center gap-2 bg-amber-500 text-white px-3 py-1 rounded-lg hover:bg-amber-600 text-sm font-bold shadow-sm transition-colors">
                                  <Edit size={18} />
                                  <span>تعديل الاوردر</span>
                                </button>
                              </div>
                              {order.status === 'with_rep' && (() => {
                                const rn = getRepName(order);
                                return rn ? <div className="text-[11px] text-slate-500">المندوب: <span className="font-bold text-slate-700">{rn}</span></div> : null;
                              })()}
                            </div>
                        </div>

                        {/* Details */}
                        <div className="space-y-2 mb-4">
                            <div className="flex items-center gap-2 text-xs text-slate-500">
                              <Phone size={14} className="text-blue-500"/>
                              <div className="flex flex-col">
                                <span className="font-mono dir-ltr">{pickDisplayPhone(`${order.phone || ''}\n${order.phone1 || ''}\n${order.phone2 || ''}`, '')}</span>
                                {order.phone2 && String(order.phone2).trim() !== '' && (
                                  <span className="text-[11px] text-slate-500 font-mono dir-ltr">{normalizeNumbers(order.phone2)}</span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-start gap-2 text-xs text-slate-500">
                                <MapPin size={14} className="text-rose-500 mt-0.5 shrink-0"/>
                                <span className="line-clamp-2 leading-relaxed">{order.governorate} - {order.address}</span>
                            </div>
                        </div>

                        {/* Products Summary */}
                        <div className="bg-slate-50 rounded-xl p-3 mb-4 border border-slate-100">
                            <p className="text-[10px] text-slate-400 font-bold mb-2">ملخص المنتجات:</p>
                            <div className="space-y-1">
                                {order.products.slice(0, 2).map((p:any, i:number) => (
                                    <div key={i} className="flex justify-between text-[11px]">
                                        <span className="text-slate-700 truncate max-w-[70%]">{p.name}</span>
                                        <span className="text-slate-500 font-mono">x{p.quantity}</span>
                                    </div>
                                ))}
                                {order.products.length > 2 && (
                                    <p className="text-[10px] text-blue-500 font-bold pt-1">+ {order.products.length - 2} منتجات أخرى</p>
                                )}
                            </div>
                        </div>

                        {/* Employee & Page info intentionally hidden */}
                      </div>

                    {/* Footer */}
                    <div className="flex items-center justify-between p-4 border-t border-slate-100 bg-slate-50/50 rounded-b-3xl">
                        <div className="flex flex-col">
                            <span className="text-[10px] text-slate-400 font-bold">الإجمالي</span>
                            <span className="font-black text-lg text-slate-800">{order.total.toLocaleString()} {currencySymbol}</span>
                        </div>
                        <div className="flex gap-2">
                             <button 
                                onClick={() => handlePrint([order])}
                                className="w-10 h-10 flex items-center justify-center bg-white border border-slate-200 rounded-xl text-slate-600 hover:text-blue-600 hover:border-blue-200 transition-colors shadow-sm"
                                title="طباعة"
                             >
                                <Printer size={18}/>
                             </button>
                             <button
                               onClick={() => openStatusEdit(order)}
                               className="w-10 h-10 flex items-center justify-center bg-white border border-slate-200 rounded-xl text-slate-600 hover:text-amber-600 hover:border-amber-200 transition-colors shadow-sm"
                               title="تعديل الحالة"
                             >
                               <Edit size={18}/>
                             </button>
                             <button
                               onClick={() => openOrderAndEnsure(order)}
                               className="w-10 h-10 flex items-center justify-center bg-white border border-slate-200 rounded-xl text-slate-600 hover:text-emerald-600 hover:border-emerald-200 transition-colors shadow-sm"
                               title="تفاصيل"
                             >
                               <Eye size={18}/>
                             </button>
                        </div>
                    </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {view === 'import-orders' && (
        <div className="space-y-6">
          <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
              <h3 className="text-xl font-black mb-2 text-slate-900 flex items-center gap-3"><ClipboardPaste size={24} className="text-blue-500"/> استيراد الاوردرات</h3>

              {salesDisplayMethod === 'sales_offices' && (
                <div className="mb-4 p-3 bg-slate-50 border border-slate-200 rounded-2xl">
                  <div className="text-xs font-black text-slate-600 mb-2">مكتب المبيعات</div>
                  {isSalesOfficeScopeNone ? (
                    <div className="text-xs text-slate-500">هذا المستخدم بدون مكاتب مبيعات (سيتم استخدام بيانات الشركة في رأس الاوردر).</div>
                  ) : (
                    <div className="flex flex-col md:flex-row gap-2 md:items-center">
                      <CustomSelect
                        value={selectedSalesOfficeId ? String(selectedSalesOfficeId) : ''}
                        onChange={v => setSelectedSalesOfficeId(v ? Number(v) : '')}
                        options={[{ value: '', label: 'اختيار مكتب' }, ...(canChangeSalesOffice ? salesOffices : salesOffices.filter(o => Number(o.id) === Number(defaultSalesOfficeId))).map((o: any) => ({ value: String(o.id), label: o.name }))]}
                        className="w-44"
                        disabled={!canChangeSalesOffice && defaultSalesOfficeId !== null && defaultSalesOfficeId !== undefined}
                      />
                      <div className="text-xs text-slate-500">
                              {selectedSalesOffice ? (selectedSalesOffice.phones || '') : 'سيظهر اسم/هاتف المكتب في رأس الاوردر.'}
                            </div>
                    </div>
                  )}
                </div>
              )}

              <div>
                <label className="text-xs font-bold text-slate-600">نص الاوردرات</label>
                <textarea value={scriptText} onChange={(e) => setScriptText(normalizeNumbers(e.target.value))} rows={8} placeholder="انسخ نص الاوردرات هنا..." className="w-full bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl p-4 text-sm font-mono focus:border-blue-500 transition-all mt-1" />
              </div>
              
              <div className="mt-4 flex justify-end">
                      <div className="flex items-center gap-3 mr-auto">
                        <label className="text-xs">مستودع افتراضي (للبيع/المخزون)</label>
                        <CustomSelect
                          value={defaultWarehouseId ? String(defaultWarehouseId) : ''}
                          onChange={v => setDefaultWarehouseId(v ? Number(v) : '')}
                          options={[{ value: '', label: 'بدون' }, ...warehouses.map(w => ({ value: String(w.id), label: w.name }))]}
                          className="w-40"
                        />
                        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={createSales} onChange={e => setCreateSales(e.target.checked)} /> أنشئ قيود مبيعات</label>
                        <div className="flex items-center gap-2">
                          <label className="text-xs">خصم</label>
                          <CustomSelect
                            value={importDiscountType}
                            onChange={v => setImportDiscountType(v as RateType)}
                            options={[{ value: 'amount', label: 'قيمة' }, { value: 'percent', label: '%' }]}
                            className="w-20"
                          />
                          <input type="number" min={0} value={importDiscountValue} onChange={e => setImportDiscountValue(Number(e.target.value || 0))} className="bg-white border rounded-xl px-2 py-1 text-xs w-20" />
                        </div>
                        <button
                          onClick={async () => {
                            const confirm = await Swal.fire({ title: 'تحويل الأرقام', text: 'هل تريد تحويل أرقام الاوردرات الظاهرة إلى أرقام إنجليزية وحفظها؟', icon: 'question', showCancelButton: true });
                            if (!confirm.isConfirmed) return;
                            const toUpdate = filteredOrders.filter(o => {
                              const phones = `${o.phone || ''}\n${o.phone1 || ''}\n${o.phone2 || ''}`;
                              const normalized = normalizeNumbers(phones || '');
                              return normalized !== (phones || '');
                            });
                            if (toUpdate.length === 0) {
                              Swal.fire('تم', 'لا توجد أرقام بحاجة للتحويل.', 'info');
                              return;
                            }
                            Swal.fire({ title: 'جاري التحويل...', html: `سيتم تحويل ${toUpdate.length} طلبيات. الرجاء الانتظار.`, didOpen: () => { Swal.showLoading(); } });
                            let successCount = 0;
                            for (const o of toUpdate) {
                              try {
                                const newPhone = pickDisplayPhone(`${o.phone || ''}\n${o.phone1 || ''}\n${o.phone2 || ''}`, '');
                                const newPhone2 = normalizeNumbers(o.phone2 || '');
                                const body: any = { id: o.id };
                                if (newPhone) body.phone = newPhone;
                                if (newPhone2) body.phone2 = newPhone2;
                                const res = await fetch(`${API_BASE_PATH}/api.php?module=orders&action=update`, {
                                  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
                                });
                                const jr = await res.json();
                                if (jr && jr.success) successCount++;
                              } catch (e) {
                                console.error('Normalize save failed for order', o.id, e);
                              }
                            }
                            Swal.close();
                            await Swal.fire('انتهى', `تم تحديث ${successCount} من ${toUpdate.length} طلبيات.`, 'success');
                            await refreshOrdersList();
                          }}
                          className="text-xs bg-yellow-50 hover:bg-yellow-100 border border-yellow-200 px-3 py-2 rounded-2xl font-bold text-yellow-700"
                        >تحويل الأرقام</button>
                        <div className="flex items-center gap-2">
                          <label className="text-xs">ضريبة</label>
                          <CustomSelect
                            value={importTaxType}
                            onChange={v => setImportTaxType(v as RateType)}
                            options={[{ value: 'percent', label: '%' }, { value: 'amount', label: 'قيمة' }]}
                            className="w-20"
                          />
                          <input type="number" min={0} value={importTaxValue} onChange={e => setImportTaxValue(Number(e.target.value || 0))} className="bg-white border rounded-xl px-2 py-1 text-xs w-20" />
                        </div>
                      </div>
                      <button onClick={handleParseScript} disabled={!scriptText || isParsing} className="bg-blue-600 text-white px-8 py-3 rounded-2xl font-black shadow-lg shadow-blue-500/20 disabled:opacity-50 flex gap-2">
                        {isParsing ? <RefreshCcw className="animate-spin" size={18}/> : <FileText size={18}/>} تحليل النص
                      </button>
              </div>
          </div>
          {parsedOrders.length > 0 && (
  <div className="space-y-4">
    <div className="flex justify-between items-center">
      <h3 className="font-bold">المعاينة ({parsedOrders.length})</h3>
      <button onClick={handleConfirmImport} className="bg-emerald-600 text-white px-6 py-2 rounded-xl font-bold shadow-lg">
        حفظ الكل
      </button>
    </div>

    {/* Unified Import View Layout */}
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {parsedOrders.map((order: any) => {
        const hasMissing = (order.products || []).some((p: any) => !!p.missingProduct || !!p.missingPrice);
        const hasTotalsMismatch = !!order.totalsMismatch;
        const containerClass = hasMissing 
          ? 'bg-rose-50 border border-rose-300' 
          : (hasTotalsMismatch ? 'bg-yellow-50 border border-yellow-300' : 'bg-white border border-slate-200');

        return (
          <div key={order.id} className={`p-4 rounded-2xl text-xs shadow-sm ${containerClass}`}>
            <div className="flex justify-between items-start mb-2 border-b pb-2">
              <span className="font-bold text-sm">{order.name}</span>
              <div className="text-sm text-right">
                <div className="flex flex-col items-end gap-1">
                  <div className="text-xs text-slate-500">اجمالى الطلبيه</div>
                  <div className="font-mono font-black text-sm">
                    {Number(order.parsedSubtotal || order.parsedTotal || order.total || 0).toFixed(2)} ج.م
                  </div>
                  <div className="text-xs text-slate-500 mt-1">الشحن</div>
                  <div className="font-mono text-sm">
                    {Number(order.parsedShipping || order.shipping || 0).toFixed(2)} ج.م
                  </div>
                  <div className="text-xs text-slate-500 mt-1">المطلوب</div>
                  <div className="font-mono font-black text-sm">
                    {Number(order.requiredTotal || (Number(order.parsedSubtotal || 0) + Number(order.parsedShipping || 0))).toFixed(2)} ج.م
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-1 text-slate-500">
              <p className="truncate">{order.governorate} - {order.address}</p>
              <p className="font-mono">{order.phone1}{order.phone2 && String(order.phone2).trim() !== '' ? ` - ${order.phone2}` : ''}</p>
            </div>

            {hasMissing && (
              <div className="mt-2 mb-2 p-2 bg-rose-100 text-rose-800 rounded text-sm">
                تحتوي هذه الاوردر على منتجات غير متطابقة. يمكنك اختيار المنتج المقابل لكل سطر، أو استخدام الأزرار أدناه.
                <div className="mt-2 flex gap-2">
                  <button onClick={() => editParsedOrder(order)} className="bg-yellow-500 text-white px-3 py-1 rounded text-xs">تعديل الاوردر</button>
                  <button onClick={() => removeParsedOrder(order.id)} className="bg-rose-600 text-white px-3 py-1 rounded text-xs">حذف الاوردر</button>
                  <button onClick={() => recalcParsedOrder(order.id)} className="bg-emerald-600 text-white px-3 py-1 rounded text-xs">حساب قيمه الطلبيه</button>
                </div>
              </div>
            )}

            {((order.products || []).some((p: any) => p.missingSize || p.missingColor) && !hasMissing) && (
              <div className="mt-2 mb-2 p-2 bg-yellow-100 text-yellow-800 rounded text-sm">
                تحتوي بعض الأسطر على مقاس أو لون غير مسجل. النظام لن يغيّر القيم تلقائياً. يمكنك تعديل الأسطر يدوياً أو حفظ الاوردر كما هو.
                <div className="mt-2 flex gap-2">
                  <button onClick={() => editParsedOrder(order)} className="bg-yellow-500 text-white px-3 py-1 rounded text-xs">تعديل الاوردر</button>
                  <button onClick={() => allowSaveParsedOrderAsIs(order.id)} className="bg-emerald-600 text-white px-3 py-1 rounded text-xs">حفظ كما هي</button>
                </div>
              </div>
            )}

            {hasTotalsMismatch && (
              <div className="mt-2 mb-2 p-2 bg-yellow-100 text-yellow-800 rounded text-sm">
                إجمالي الأسطر ({Number(order.computedTotal || 0).toFixed(2)} ج.م) لا يتطابق مع الإجمالي المُدخل ({Number(order.parsedTotal || 0).toFixed(2)} ج.م). راجع الأسعار أو اضغط تعديل الاوردر.
                <div className="mt-2 flex gap-2">
                  <button onClick={() => editParsedOrder(order)} className="bg-yellow-500 text-white px-3 py-1 rounded text-xs">تعديل الاوردر</button>
                  <button onClick={() => removeParsedOrder(order.id)} className="bg-rose-600 text-white px-3 py-1 rounded text-xs">حذف الاوردر</button>
                  <button onClick={() => recalcParsedOrder(order.id)} className="bg-emerald-600 text-white px-3 py-1 rounded text-xs">حساب قيمه الطلبيه</button>
                </div>
              </div>
            )}

            <div className="mt-2 pt-2 border-t border-dashed">
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm font-bold">المنتجات</div>
                <div className="flex items-center gap-2">
                  <button onClick={() => addProductToParsedOrder(order.id)} className="bg-blue-50 text-blue-600 px-3 py-1 rounded-xl text-xs">أضف منتج</button>
                </div>
              </div>
              
              {(order.products || []).map((p: any, i: number) => {
                const matchedProduct = p.productId ? existingProducts.find((ep: any) => Number(ep.id) === Number(p.productId)) : null;
                const sizeCandidates = matchedProduct?.sizes || null; // تبسيط للاختصار
                const colorCandidates = matchedProduct?.colors || null;

                return (
                  <div key={i} className="flex justify-between items-center gap-2 mb-2">
                    <div className="flex-1">
                      <div className="flex gap-2 items-center">
                        <input value={p.name} onChange={(e) => updateParsedProductField(order.id, i, 'name', e.target.value)} className="w-2/3 bg-transparent text-sm" />
                        <input value={p.size || ''} placeholder="المقاس" onChange={(e) => updateParsedProductField(order.id, i, 'size', e.target.value)} className="w-1/6 bg-transparent text-sm text-center" />
                        <input value={p.color || ''} placeholder="اللون" onChange={(e) => updateParsedProductField(order.id, i, 'color', e.target.value)} className="w-1/6 bg-transparent text-sm text-center" />
                      </div>
                      <div className="mt-1 flex items-center gap-2">
                        {p.missingProduct && <span className="text-[11px] bg-rose-100 text-rose-700 px-2 py-0.5 rounded">غير موجود</span>}
                        {p.missingPrice && <span className="text-[11px] bg-rose-100 text-rose-700 px-2 py-0.5 rounded">سعر مفقود</span>}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1 w-40">
                      <input type="number" value={p.quantity} onChange={(e) => updateParsedProductField(order.id, i, 'quantity', Number(e.target.value))} className="w-full text-right px-2 py-1 rounded-md border" />
                      <input type="number" value={p.price} onChange={(e) => updateParsedProductField(order.id, i, 'price', e.target.value)} className="w-full text-right px-2 py-1 rounded-md border" />
                      <div className="flex gap-2">
                        <button onClick={() => removeProductFromParsedOrder(order.id, i)} className="text-rose-600 text-xs">حذف</button>
                        <button onClick={() => saveParsedOrderLine(order.id, i)} className="text-emerald-600 text-xs">حفظ</button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  </div>
)}
        </div>
      )}
    </div>
  );
};

// --- Printable Content Component (No changes needed here, keeping it as is) ---

const PrintableContent: React.FC<{ order: any, companyName: string, companyPhone: string, companyAddress?: string, terms: string, companyLogo?: string | null, users?: any[] }> = ({ order, companyName, companyPhone, companyAddress, terms, companyLogo, users }) => {
    const productRows = order.products && order.products.length > 0 
      ? order.products 
      : [{ name: '', quantity: '', price: '', total: '' }];

    // Compute line totals if missing and overall total fallback
    const computedRows = productRows.map((p:any) => {
      const price = Number(p.price || 0);
      const qty = Number(p.quantity || p.qty || 0);
      const lineTotal = (p.total !== undefined && p.total !== null && Number(p.total) !== 0) ? Number(p.total) : price * qty;
      return { ...p, price, quantity: qty, lineTotal };
    });

    const computedSubtotal = computedRows.reduce((s:any, r:any) => s + (r.lineTotal || 0), 0);
    const shippingVal = Number(order.shipping || order.shippingCost || 0);
    const discountType = normalizeRateType(order.discountType || order.discount_type);
    const discountValue = Number(order.discountValue || order.discount_value || 0);
    const taxType = normalizeRateType(order.taxType || order.tax_type);
    const taxValue = Number(order.taxValue || order.tax_value || 0);
    const calcOrder = (localStorage.getItem('Dragon_sales_calc_order') || 'discount_then_tax') as 'discount_then_tax' | 'tax_then_discount';

    const computedTotals = calculateOrderTotals(computedSubtotal, shippingVal, discountType, discountValue, taxType, taxValue, calcOrder);
    const discountAmount = Number(order.discountAmount || order.discount_amount || 0) || computedTotals.discountAmount;
    const taxAmount = Number(order.taxAmount || order.tax_amount || 0) || computedTotals.taxAmount;
    const computedTotal = (order.total && Number(order.total) > 0) ? Number(order.total) : computedTotals.total;

    const emptyRowsCount = 0; // no forced empty rows; let rows be dynamic based on products
    const salesDisplayMethod = (localStorage.getItem('Dragon_sales_display_method') || 'company').toString();
    const currentDate = new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Cairo' }); // Egypt local date (YYYY-MM-DD)
    const pageDisplay = order.page || order.pageName || order.page_name || order.page_number || order.page_no || order.source || '-';

    const getUserDisplayName = (emp: any) => {
      const usersList = users || [];
      if (!emp) {
        try { const u = JSON.parse(localStorage.getItem('Dragon_user')||'null'); return u && (u.name || u.username) ? (u.name || u.username) : 'Admin'; } catch(e) { return 'Admin'; }
      }
      // If emp is a non-empty string, prefer the raw string entered in the script/order
      if (typeof emp === 'string' && emp.toString().trim() !== '') {
        return emp;
      }
      // if emp is numeric id
      if (typeof emp === 'number' || /^[0-9]+$/.test(String(emp))) {
        const found = usersList.find(u => Number(u.id) === Number(emp));
        if (found) return found.name || found.username || String(emp);
      }
      // try match by username
      const byUsername = usersList.find(u => (u.username||'').toString().toLowerCase() === (''+emp).toString().toLowerCase());
      if (byUsername) return byUsername.name || byUsername.username;
      // try match by id key on object
      if (typeof emp === 'object') {
        if (emp.name) return emp.name;
        if (emp.username) return emp.username;
        if (emp.full_name) return emp.full_name;
      }
      return emp || 'Admin';
    };

    return (
      <div className="flex flex-col bg-white text-black font-sans box-border relative p-1" style={{ direction: 'rtl', fontSize: '28px', flex: 1, minHeight: 0 }}>
            
            {/* Header */}
            {/* Header: left=barcode, center=logo, right=company name+phone */}
            {/* <div className="flex items-center justify-between mb-1 w-full" style={{ direction: 'ltr' }}>
              {/* <div className="w-1/4 text-left" style={{ direction: 'ltr' }}>
                <Barcode value={order.orderNumber} className="h-20" height={64} width={2} />
                <div className="text-xs mt-1">{order.orderNumber}</div>
              </div> */}
              {/* <div className="w-1/4 flex flex-col items-center justify-center" style={{ direction: 'ltr' }}>
               <Barcode value={order.orderNumber} className="h-20" height={64} width={2} />
               <div className="text-sm mt-1 text-center font-bold tracking-widest">{order.orderNumber}</div>
              </div>
              <div className="w-1/2 flex flex-col items-center">
                {companyLogo ? (
                  <img src={companyLogo} alt="logo" className="h-36 mb-1 object-contain" />
                ) : (
                  <h1 className="font-black text-xl mb-1">{companyName}</h1>
                )}
              </div>
              <div className="w-1/4 text-right" style={{ direction: 'rtl' }}>
                <h1 className="font-black text-lg">{companyName}</h1>
                <p className="text-base font-bold mt-1">{companyPhone}</p>
              </div>
            </div> */}
            {/* Header: left=logo, center=barcode, right=company name+phone */}
            <div className="flex items-center justify-between mb-1 w-full" style={{ direction: 'ltr' }}>
              
              {/* اللوجو (يسار) */}
              <div className="w-1/4 flex flex-col items-start justify-center">
                {companyLogo ? (
                  <img src={companyLogo} alt="logo" className="h-48 max-w-full mb-1 object-contain" />
                ) : (
                  <h1 className="company-name font-black text-4xl mb-1">{companyName}</h1>
                )}
              </div>

              {/* الباركود ورقم الفاتورة (في المنتصف) */}
              <div className="w-1/2 flex flex-col items-center justify-center">
                <Barcode value={order.orderNumber} className="h-20" height={64} width={2} />
                <div className="text-base mt-1 text-center font-bold tracking-widest">{order.orderNumber}</div>
              </div>

              {/* بيانات الشركة (يمين) */}
              <div className="w-1/4 text-right" style={{ direction: 'rtl' }}>
                <h1 className="company-name font-black text-4xl">{companyName}</h1>
                <p className="text-base font-bold mt-1 company-phone">{companyPhone}</p>
                {companyAddress ? <p className="text-sm mt-1">{companyAddress}</p> : null}
              </div>
              
            </div>
            {/* Date */}
              <div className="text-right mb-1">
                <p className="text-base font-bold">التاريخ: {currentDate}</p>
              </div>

            {/* Divider */}
            <div className="w-full border-b-2 border-black border-dashed my-1"></div>

            {/* Customer Info */}
            <div className="mb-2">
                <div className="flex justify-between items-center mb-1">
                    <div className="text-right flex-1">
                        <span className="font-bold text-base">{order.customerName || order.name}</span>
                    </div>
                    <div className="border-2 border-black p-1 px-3">
                        <span className="font-black text-base">{order.governorate || 'غير محدد'}</span>
                    </div>
                </div>
                <div className="flex flex-col mb-1 text-right">
    <div className="font-bold text-base font-mono">
        {pickDisplayPhone(`${order.phone || ''}\n${order.phone1 || ''}\n${order.phone2 || ''}`, '')}
    </div>
    {order.phone2 && String(order.phone2).trim() !== '' && (
        <div className="font-bold text-base font-mono">
            {normalizeNumbers(order.phone2)}
        </div>
    )}
</div>
                <div className="text-right">
                  <span className="font-bold text-base leading-tight">{order.address}</span>
                </div>

                

                {/* Notes removed from here and moved below totals */}
                
            </div>

            {/* Product Table */}
            <div className="border-2 border-black mb-1">
              <table className="w-full text-center text-base border-collapse" style={{ fontSize: '32px' }}>
                    <thead>
                    <tr className="bg-slate-200 border-b-2 border-black">
                    <th className="border-l border-black text-base p-1">المنتج</th>
                    <th className="border-l border-black text-base p-1 w-20">السعر</th>
                    <th className="border-l border-black text-base p-1 w-16">الكمية</th>
                    <th className="p-1 w-24">الإجمالي</th>
                        </tr>
                    </thead>
                    <tbody>
                        {computedRows.map((p: any, i: number) => (
                          <tr key={i} className="border-b border-black"><td className="border-l border-black p-1 text-right" style={{ fontSize: '36px', fontWeight: 900, fontStyle: 'normal' }}>
  <b style={{ fontWeight: 900 }}>{p.name}</b> 
  <span style={{ fontSize: '24px', fontWeight: 900, color: '#000' }}> 
    - اللون: {p.color || '-'} - المقاس: {p.size || '-'}
  </span>
</td>
                            <td className="border-l border-black p-1" style={{ fontSize: '28px', fontWeight: 800 }}>{p.price.toLocaleString()}</td>
                            <td className="border-l border-black p-1" style={{ fontSize: '28px', fontWeight: 800 }}>{p.quantity}</td>
                            <td className="p-1" style={{ fontSize: '28px', fontWeight: 800 }}>{(p.lineTotal || 0).toLocaleString()}</td>
                          </tr>
                        ))}
                        {/* no empty filler rows; rows scale with products */}
                    </tbody>
                </table>
            </div>

            {/* --- Totals: products, shipping, grand total --- */}
            <div className="border-2 border-black p-2 mb-2 bg-slate-50">
                <div className="flex justify-between items-center mb-1 px-2">
                  <div className="text-base text-left font-bold">الإجمالي (المنتجات)</div>
                  <div className="text-base font-black">{computedSubtotal.toLocaleString()} ج.م</div>
                </div>
                <div className="flex justify-between items-center mb-1 px-2">
                  <div className="text-base font-bold">مصاريف الشحن</div>
                  <div className="text-base font-black">{shippingVal.toLocaleString()} ج.م</div>
                </div>
                <div className="w-full border-t border-black my-1"></div>
                <div className="flex justify-between items-center text-2xl font-black px-2">
                  <div>الإجمالي المطلوب</div>
                  <div>{computedTotal.toLocaleString()} ج.م</div>
                </div>
            </div>

            {/* Notes (ملاحظات) - always show */}
            <div className="mt-2 border-2 border-black p-2 bg-white text-right" style={{ fontSize: '26px' }}>
              <div className="font-bold mb-1">ملاحظات:</div>
              <div style={{ minHeight: '32px' }}>{order.notes || ''}</div>
            </div>

            {/* Employee & Page - below notes */}
            <div className="flex justify-between items-center mt-2 mb-1 px-2 py-1 border-t border-dashed border-black">
              <div className="text-right text-sm">الموظف: <span className="font-bold">{getUserDisplayName(order.employee || order.employee_raw || order.employeeName || order.employee_name)}</span></div>
              <div className="text-left text-sm">البيدج: <span className="font-bold">{pageDisplay}</span></div>
            </div>

            {/* Policy */}
            <div className="border-2 border-black p-1 text-center mt-auto">
              <p className="font-bold text-base mb-0.5">سياسة الشركه</p>
              <p className="text-base font-medium leading-tight">{terms}</p>
            </div>

        </div>
    );
};

/* const PrintableOrders: React.FC<{ orders: any[], companyName: string, companyPhone: string, terms: string }> = ({ orders, companyName, companyPhone, terms }) => {
  // print each order on its own full A4 page
  return (
    <div className="print-root">
      <style>
        {`
        @media print {
          body { visibility: hidden; margin: 0; padding: 0; }
          #print-container { visibility: visible !important; position: relative; top: 0; left: 0; width: 100%; }
          @page { size: A4; margin: 0.5cm; }
          .print-page { width: 100%; page-break-inside: avoid; break-inside: avoid; height: 28.7cm; display: flex; }
          .print-page > .print-wrapper { flex: 1 1 auto; display: flex; flex-direction: column; }
          .print-page .print-content { flex: 1 1 auto; display: flex; flex-direction: column; }
          .print-page:not(:last-child) { page-break-after: always; }
          * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
        `}
      </style>
      {orders.map((order: any) => (
        <div key={order.id} className="print-page" style={{ padding: '0.3cm', boxSizing: 'border-box' }}>
          <div className="print-wrapper" style={{ minHeight: 0 }}>
            <div className="print-content" style={{ minHeight: 0 }}>
              <PrintableContent order={order} companyName={companyName} companyPhone={companyPhone} terms={terms} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
} */
const PrintableOrders: React.FC<{ orders: any[], companyName: string, companyPhone: string, companyAddress?: string, terms: string, companyLogo?: string | null, users?: any[] }> = ({ orders, companyName, companyPhone, companyAddress, terms, companyLogo, users }) => {
  // print each order on its own full A4 page without blank pages
  return (
    <div className="print-root">
      <style>
        {`
        @media print {
          /* إخفاء كل شيء في الصفحة وتفريغ مساحته */
          body * { visibility: hidden; }
          /* استخدام خط أوضح وزيادة حجم الخط داخل حاوية الطباعة */
          #print-container, #print-container * { font-family: 'Noto Sans Arabic', 'Noto Naskh Arabic', Arial, sans-serif !important; font-size: 28px !important; visibility: visible !important; }
          /* تكبير اسم الشركة ورقم الهاتف فقط عند الطباعة */
          #print-container .company-name { font-size: 48px !important; line-height: 1 !important; font-weight: 900 !important; }
          #print-container .company-phone { font-size: 20px !important; font-weight: 800 !important; }
          /* إظهار حاوية الطباعة فقط ونقلها لأعلى الصفحة تماماً لتجنب الصفحة البيضاء الأولى */
          #print-container { position: absolute; left: 0; top: 0; width: 100%; margin: 0; padding: 0; }

          /* تصفير حواف المتصفح لمنع الصفحات الإضافية */
          @page { size: A4; margin: 0; }

          .print-page { 
            width: 100%; 
            /* ارتفاع الصفحة أقل من A4 بملي واحد لمنع التسريب لصفحة فارغة بالنهاية */
            height: 29.6cm; 
            padding: 0.5cm; /* استخدمنا البادينج هنا بدلاً من مارجن الصفحة */
            box-sizing: border-box; 
            display: flex; 
            page-break-inside: avoid; 
            break-inside: avoid;
            page-break-after: always; 
          }
          
          /* إلغاء كسر الصفحة بعد آخر بوليصة */
          .print-page:last-child { page-break-after: auto; }
          
          .print-page > .print-wrapper { flex: 1 1 auto; display: flex; flex-direction: column; }
          .print-page .print-content { flex: 1 1 auto; display: flex; flex-direction: column; }
          * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
        `}
      </style>
      {orders.map((order: any) => (
        // شيلنا الـ inline styles عشان نقلناها جوه كلاس .print-page لضمان عدم التعارض
        <div key={order.id} className="print-page">
          <div className="print-wrapper" style={{ minHeight: 0 }}>
            <div className="print-content" style={{ minHeight: 0 }}>
              <PrintableContent order={order} companyName={companyName} companyPhone={companyPhone} companyAddress={companyAddress} terms={terms} companyLogo={companyLogo} users={users} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default OrdersModule;