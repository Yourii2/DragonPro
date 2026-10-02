import React, { useEffect, useState, useMemo } from 'react';
import Swal from 'sweetalert2';
import { API_BASE_PATH } from '../services/apiConfig';
import CustomSelect from './CustomSelect';
import { PrintableContent, PrintableOrders, PrintableOrdersSingle } from './PrintTemplates';
import { cleanBarcode, isOrderMatchingBarcode } from '../services/barcodeUtils';
import { ArrowLeftRight, Check, AlertCircle, Loader2, RefreshCw, Search, X, User } from 'lucide-react';

// --- المكون الرئيسي ---

const SalesUpdateStatus: React.FC = () => {
  const deliveryMethod = (localStorage.getItem('Dragon_delivery_method') || 'reps').toString();
  const isShippingMode = deliveryMethod === 'shipping';
  const isPermissionDeniedResponse = (status?: number, payload?: any) => {
    const message = (payload && typeof payload.message === 'string') ? payload.message : '';
    return Number(status) === 403 || /permission|صلاحية|insufficient/i.test(message);
  };

  const [user, setUser] = useState<any>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [repsSummary, setRepsSummary] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [openRepOrders, setOpenRepOrders] = useState<any | null>(null);
  const [selectedOrderIds, setSelectedOrderIds] = useState<number[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [userDefaults, setUserDefaults] = useState<any>(null);
  const [openPartialOrder, setOpenPartialOrder] = useState<any | null>(null);
  const [partialProducts, setPartialProducts] = useState<any[]>([]);
  const [partialWarehouse, setPartialWarehouse] = useState<number | undefined>(undefined);
  const [returnItems, setReturnItems] = useState<Array<{ productId: number; orderItemId?: number; name: string; quantity: number; lineId: string; color?: string; size?: string }>>([]);
  const [isBarcodeModalOpen, setIsBarcodeModalOpen] = useState(false);
  const [scanInput, setScanInput] = useState('');
  const [scannedBarcodes, setScannedBarcodes] = useState<Array<{ code: string; orderId?: number }>>([]);
  const [dailyFilter, setDailyFilter] = useState<'all' | 'open' | 'closed'>('all');
  const [selectedRepId, setSelectedRepId] = useState<string>('');

  // --- حالة الاستبدال (Exchange Order Item) ---
  const [openExchangeOrder, setOpenExchangeOrder] = useState<any | null>(null);
  const [exchangeWarehouse, setExchangeWarehouse] = useState<number | undefined>(undefined);
  const [exchangeOldItem, setExchangeOldItem] = useState<{
    lineId: string;
    orderItemId?: number;
    productId: number;
    name: string;
    color: string;
    size: string;
    price: number;
    maxQty: number;
    exchangeQty: number;
  } | null>(null);
  const [exchangeMode, setExchangeMode] = useState<'same_product' | 'other_product'>('same_product');
  const [exchangeProductsCatalog, setExchangeProductsCatalog] = useState<any[]>([]);
  const [exchangeTargetProductId, setExchangeTargetProductId] = useState<number | null>(null);
  const [exchangeTargetVariantId, setExchangeTargetVariantId] = useState<number | null>(null);
  const [exchangeCustomPrice, setExchangeCustomPrice] = useState<string>('');
  const [exchangeProductSearch, setExchangeProductSearch] = useState<string>('');
  const [exchangeNotes, setExchangeNotes] = useState<string>('');
  const [exchangeLoadingCatalog, setExchangeLoadingCatalog] = useState<boolean>(false);
  const [exchangeSubmitting, setExchangeSubmitting] = useState<boolean>(false);

  // حالة الطباعة
  const [ordersToPrint, setOrdersToPrint] = useState<any[] | null>(null);
  const [printSinglePerPage, setPrintSinglePerPage] = useState<boolean>(false);
  const [paidNow, setPaidNow] = useState<number>(0);
  // Feature flag: show extra action buttons (عرض اليومية، أذن التسليم، طباعة بوالص الشحن)
  const SHOW_ACTION_BUTTONS = false; // set to true to re-enable

  useEffect(() => {
    const load = async () => {
      try {
        const v = await fetch(`${API_BASE_PATH}/verify.php`, { method: 'POST' });
        const jv = await v.json();
        setUser(jv.user ?? null);

        // 1. Fetch assignees (reps or shipping companies)
        let repIdToNameMap = new Map<number, any>();
        if (isShippingMode) {
          const cRes = await fetch(`${API_BASE_PATH}/api.php?module=shipping_companies&action=getAll`, { credentials: 'include' });
          const cJson = await cRes.json();
          if (!isPermissionDeniedResponse(cRes.status, cJson)) {
            const allCompanies = (cJson.success ? (cJson.data || []) : []);
            repIdToNameMap = new Map(allCompanies.map((c: any) => [Number(c.id), String(c.name || '')]));
          }
        } else {
          // fetch reps with server-provided balance
          const usersRes = await fetch(`${API_BASE_PATH}/api.php?module=users&action=getAllWithBalance&related_to_type=rep`, { credentials: 'include' });
          const usersJson = await usersRes.json();
          if (!isPermissionDeniedResponse(usersRes.status, usersJson)) {
            const allReps = (usersJson.success ? (usersJson.data || []) : []);
            // store the whole user object so we can read `balance` later
            repIdToNameMap = new Map(allReps.map((r: any) => [Number(r.id), r]));
          }
        }

        // 2. Fetch all orders
        // Build initial repsSummary list from users/companies but DO NOT fetch all orders here
        const repsList = Array.from(repIdToNameMap.entries()).map(([id, entry]) => {
          if (isShippingMode) {
            return { repId: Number(id), name: String(entry || `شركة شحن #${id}`), balance: 0, ordersCount: 0, productsCount: 0, has_open_daily: 0, open_daily_id: null, open_daily_code: null };
          }
          const u = entry as any;
          return {
            repId: Number(id),
            name: (u && (u.name || u.fullname)) || String(u || `مندوب #${id}`),
            balance: Number(u?.balance || 0),
            has_open_daily: Number(u?.has_open_daily || 0),
            open_daily_id: u?.open_daily_id ? Number(u.open_daily_id) : null,
            open_daily_code: u?.open_daily_code || null,
            ordersCount: 0,
            productsCount: 0
          };
        });
        setRepsSummary(repsList);
        // populate counts for reps (orders/products) in background so counts show on page open
        (async () => { try { await populateRepCounts?.(repsList); } catch (e) { } })();
        // load warehouses for returns
        try {
          const w = await fetch(`${API_BASE_PATH}/api.php?module=warehouses&action=getAll`, { credentials: 'include' });
          const jw = await w.json();
          if (!isPermissionDeniedResponse(w.status, jw)) {
            setWarehouses(jw.success ? (jw.data || []) : []);
          } else {
            setWarehouses([]);
          }
          // fetch user defaults (warehouse/treasury) so returns can prefill
          try {
            const udRes = await fetch(`${API_BASE_PATH}/api.php?module=permissions&action=getUserDefaults&user_id=${jv.user?.id ?? 0}`, { credentials: 'include' });
            const udJson = await udRes.json();
            if (udJson && udJson.success) {
              setUserDefaults(udJson.data || null);
              try { (window as any).userDefaults = udJson.data || null; } catch (e) { }
            }
          } catch (e) { /* ignore */ }
        } catch (e) { setWarehouses([]); }
      } catch (e) {
        console.error('Failed to load update-status data', e);
        Swal.fire('خطأ', 'فشل تحميل البيانات.', 'error');
      } finally { setLoading(false); }
    };
    load();
  }, []);

  const refreshData = async () => {
    setLoading(true);
    try {
      // Refresh reps/companies and balances only (do not fetch all orders)
      let repIdToNameMap = new Map<number, any>();
      if (isShippingMode) {
        const cRes = await fetch(`${API_BASE_PATH}/api.php?module=shipping_companies&action=getAll`, { credentials: 'include' });
        const cJson = await cRes.json();
        if (!isPermissionDeniedResponse(cRes.status, cJson)) {
          const allCompanies = (cJson.success ? (cJson.data || []) : []);
          repIdToNameMap = new Map(allCompanies.map((c: any) => [Number(c.id), String(c.name || '')]));
        }
      } else {
        const usersRes = await fetch(`${API_BASE_PATH}/api.php?module=users&action=getAllWithBalance&related_to_type=rep`, { credentials: 'include' });
        const usersJson = await usersRes.json();
        if (!isPermissionDeniedResponse(usersRes.status, usersJson)) {
          const allReps = (usersJson.success ? (usersJson.data || []) : []);
          repIdToNameMap = new Map(allReps.map((r: any) => [Number(r.id), r]));
        }
      }

      const repsList = Array.from(repIdToNameMap.entries()).map(([id, entry]) => {
        if (isShippingMode) {
          return { repId: Number(id), name: String(entry || `شركة شحن #${id}`), balance: 0, ordersCount: 0, productsCount: 0, has_open_daily: 0, open_daily_id: null, open_daily_code: null };
        }
        const u = entry as any;
        return {
          repId: Number(id),
          name: (u && (u.name || u.fullname)) || String(u || `مندوب #${id}`),
          balance: Number(u?.balance || 0),
          has_open_daily: Number(u?.has_open_daily || 0),
          open_daily_id: u?.open_daily_id ? Number(u.open_daily_id) : null,
          open_daily_code: u?.open_daily_code || null,
          ordersCount: 0,
          productsCount: 0
        };
      });
      setRepsSummary(repsList);
      // Kick off background population of ordersCount/productsCount without blocking UI
      (async () => { try { await populateRepCounts?.(repsList); } catch (e) { } })();

      try {
        const w = await fetch(`${API_BASE_PATH}/api.php?module=warehouses&action=getAll`, { credentials: 'include' });
        const jw = await w.json();
        setWarehouses(isPermissionDeniedResponse(w.status, jw) ? [] : (jw.success ? (jw.data || []) : []));
      } catch (e) { setWarehouses([]); }
    } catch (e) {
      console.error('Failed to refresh data', e);
    } finally { setLoading(false); }
  };

  // Translate status codes to Arabic for display
  const translateStatus = (s: any) => {
    if (!s && s !== 0) return '';
    const st = String(s).toLowerCase();
    const map: Record<string, string> = {
      'with_rep': 'مع المندوب',
      'delivered': 'تم التسليم',
      'returned': 'مرتجع',
      'pending': 'مؤجل',
      'in_delivery': 'قيد التسليم',
      'cancelled': 'أُلغي',
      'partial': 'تسليم جزئي',
      'partial_return': 'تسليم جزئي',
      'new': 'جديد',
      'returned_with_rep': 'مرتجع جزئي مع المندوب',
      'exchange': 'استبدال'
    };
    return map[st] || s;
  };

  const computeOrderSubtotal = (o: any) => {
    if (!o) return 0;
    // Prioritize products list to accurately reflect current items after partial returns
    if (Array.isArray(o.products) && o.products.length > 0) {
      const prodSum = o.products.reduce((s: any, p: any) => s + (Number(p.quantity || p.qty || 0) * Number(p.price || p.sale_price || p.price_per_unit || 0)), 0);
      if (prodSum > 0) return prodSum;
    }
    if (Array.isArray(o.order_items) && o.order_items.length > 0) {
      const itemSum = o.order_items.reduce((s: any, it: any) => s + (Number(it.quantity || it.qty || 0) * Number(it.price || it.sale_price || it.unit_price || 0)), 0);
      if (itemSum > 0) return itemSum;
    }
    // Prioritize DB-level total/shipping to accurately account for discounts
    if (o.total_amount !== undefined && o.shipping_fees !== undefined) return Math.max(0, Number(o.total_amount || 0) - Number(o.shipping_fees || 0));
    if (o.total !== undefined && o.shipping !== undefined) return Math.max(0, Number(o.total || 0) - Number(o.shipping || 0));

    if (o.subTotal !== undefined) return Number(o.subTotal || 0);
    if (o.sub_total !== undefined) return Number(o.sub_total || 0);
    return Number(o.total_amount || o.total || 0);
  };

  const normalizeOrdersForReturnsView = (orders: any[]) => {
    const list = Array.isArray(orders) ? orders : [];
    return list
      .map((o: any) => {
        const products = Array.isArray(o?.products)
          ? o.products.filter((p: any) => Number(p?.quantity || p?.qty || 0) > 0)
          : [];
        const remainingPieces = products.reduce((s: number, p: any) => s + Number(p?.quantity || p?.qty || 0), 0);
        return { ...o, products, remainingPieces };
      })
      .filter((o: any) => {
        const status = String(o?.status || '').toLowerCase();
        // Exclude orders already finalized as delivered or fully returned.
        if (status === 'delivered' || status === 'returned' || status === 'full_return') return false;
        if (Number(o?.remainingPieces || 0) <= 0) return false;
        // الطلبات التي تم إرجاعها جزئيًا أو التي لا تزال تحتوي على قطع متبقية أو بحالة مرتجع مع المندوب يجب أن تظهر
        if (status === 'partial_return' || status === 'partial' || status === 'returned_with_rep') return true;
        return Number(o?.remainingPieces || 0) > 0;
      });
  };

  // Prompt user to choose a warehouse from available `warehouses` (or choose empty).
  // Returns: undefined => cancelled, null => no warehouse chosen, number => warehouse id
  const promptWarehouseForReturn = async (): Promise<number | null | undefined> => {
    // If no warehouses configured, abort
    const list = (warehouses || []);
    if (!list || list.length === 0) return undefined;

    // If user has a default warehouse and is not allowed to change it, use it directly
    const userDefault = (typeof (window as any).userDefaults !== 'undefined') ? (window as any).userDefaults : null;
    // However, within this component we usually have `userDefaults` in scope; prefer that if available
    const defaultsAny: any = (typeof userDefault !== 'undefined') ? userDefault : userDefault;
    const defaultWarehouseId = defaultsAny && defaultsAny.default_warehouse_id ? Number(defaultsAny.default_warehouse_id) : null;
    const canChangeWarehouse = defaultsAny && typeof defaultsAny.can_change_warehouse !== 'undefined' ? Boolean(defaultsAny.can_change_warehouse) : true;

    if (defaultWarehouseId && canChangeWarehouse === false) {
      // ensure the default exists in list
      if (list.find((w: any) => Number(w.id) === Number(defaultWarehouseId))) return Number(defaultWarehouseId);
    }

    // If only one warehouse available, require it (no prompt)
    if (list.length === 1) return Number(list[0].id);

    // Build options (no empty 'بدون' option — selection is mandatory)
    const options: Record<string, string> = {};
    list.forEach((w: any) => { options[String(w.id)] = w.name || (`المستودع ${w.id}`); });

    const res = await Swal.fire({
      title: 'اختر المستودع لإتمام المرتجع (إجباري)',
      input: 'select',
      inputOptions: options,
      inputPlaceholder: 'اختر مستودعاً',
      inputValue: defaultWarehouseId ? String(defaultWarehouseId) : undefined,
      showCancelButton: true
    });

    // If the dialog was dismissed (cancel/close) return undefined to abort the flow
    if ((res as any).isDismissed || typeof (res as any).value === 'undefined' || (res as any).value === null) return undefined;
    // value should be a warehouse id string
    const val = (res as any).value;
    if (!val && val !== 0) return undefined;
    return Number(val);
  };

  // Perform return for currently selected orders (asks optional warehouse like the existing UI)
  const handleReturnSelected = async () => {
    const ids = selectedOrderIds.slice();
    if (ids.length === 0) { Swal.fire('تحذير', 'اختر طلبيات أولاً', 'warning'); return; }
    const warehouseId = await promptWarehouseForReturn();
    if (warehouseId === undefined) return; // cancelled
    try {
      const repIdLocal = openRepOrders?.repId ?? null;
      let totalReturned = 0;
      let totalPartialReturned = 0;

      for (const id of ids) {
        const ord = (openRepOrders?.orders || []).find((o: any) => o.id === id);
        if (!ord) continue;
        const orderRepId = ord?.rep_id ?? ord?.repId ?? repIdLocal;
        const prods = Array.isArray(ord?.products) ? ord.products : [];
        // تحقق هل كل المنتجات سيتم إرجاعها (مرتجع كامل) أم بعضها (مرتجع جزئي)
        const hasPartialItems = prods.some((p: any) => {
          const retQ = Number(p.returnQuantity);
          const origQ = Number(p.quantity || p.qty || 0);
          return retQ > 0 && retQ < origQ;
        });
        const isFullReturn = !hasPartialItems;

        if (isFullReturn) {
          // returnToStock records the return, updates its journal row, and credits the rep atomically.
          const returnResponse = await fetch(`${API_BASE_PATH}/api.php?module=orders&action=returnToStock`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ order_id: id, warehouse_id: warehouseId, rep_id: Number(orderRepId) })
          });
          const returnResult = await returnResponse.json();
          if (!returnResult?.success) throw new Error(returnResult?.message || 'فشل تسجيل المرتجع في المخزن.');
          totalReturned += Number(returnResult.returnedValue || 0);
        } else {
          // مرتجع جزئي: قسم المنتجات المرتجعة عن المسلمة
          const returnedProducts = prods.filter((p: any) => Number(p.returnQuantity || 0) > 0);
          // إرسال المرتجع للمخزن
          if (returnedProducts.length > 0) {
            const returnResponse = await fetch(`${API_BASE_PATH}/api.php?module=orders&action=partialReturn`, {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ order_id: id, rep_id: orderRepId, items: returnedProducts.map((p: any) => ({ orderItemId: p.order_item_id || p.id, productId: p.productId || p.product_id, quantity: Number(p.returnQuantity) })), warehouse_id: warehouseId, notes: '' })
            });
            const returnResult = await returnResponse.json();
            if (!returnResult?.success) throw new Error(returnResult?.message || 'فشل تسجيل المرتجع الجزئي.');
            totalPartialReturned += Number(returnResult.returnedValue || 0);
          }
        }
      }

      // 1. إزالة الأوردرات المرتجعة فوراً من الواجهة المحلية لعدم تكرارها أو بقائها في الشاشة
      setOpenRepOrders((prev: any) => {
        if (!prev) return prev;
        const remainingOrders = (prev.orders || []).filter((o: any) => !ids.includes(o.id));
        return { ...prev, orders: remainingOrders };
      });

      // 2. تحديث ملخص عهدة المندوب محلياً بالقيم المسترجعة
      const totalDeduction = totalReturned + totalPartialReturned;
      if (openRepOrders && openRepOrders.repId) {
        const repIdLocal2 = openRepOrders.repId;
        setRepsSummary(prev => prev.map(r => {
          if (String(r.repId) !== String(repIdLocal2)) return r;
          return {
            ...r,
            balance: Number(r.balance || 0) + totalDeduction,
            ordersCount: Math.max(0, (r.ordersCount || 0) - ids.length)
          };
        }));
      }

      // 3. تصفية التحديدات وحالات الباركود
      setSelectedOrderIds([]);
      setIsBarcodeModalOpen(false);
      setScanInput('');
      setScannedBarcodes([]);

      Swal.fire('تم', 'تم تسجيل المرتجع بنجاح.', 'success');
      // تحديث الواجهة: إعادة تحميل الأوردرات
      try {
        const repIdLocalForRefresh = openRepOrders?.repId ?? null;
        if (repIdLocalForRefresh) {
          const freshOrders = await fetchOrdersForRep(Number(repIdLocalForRefresh));
          setOpenRepOrders((prev: any) => prev ? ({ ...prev, orders: freshOrders }) : prev);
        }
      } catch (e) { }
    } catch (e: any) {
      console.error(e);
      Swal.fire('خطأ', e?.message || 'فشل في العملية.', 'error');
    }
  };

  // تفعيل الطباعة عند تغيير state
  useEffect(() => {
    if (ordersToPrint) {
      setTimeout(() => {
        window.print();
        setOrdersToPrint(null); // Reset after print dialog triggers
        setPrintSinglePerPage(false);
      }, 500);
    }
  }, [ordersToPrint]);

  const toggleSelectOrder = (id: number) => {
    setSelectedOrderIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const openOrdersForRep = (rep: any) => {
    setSelectedRepId(String(rep.repId));
    // Lazy-load orders for the selected rep/company to avoid fetching all orders on page load
    (async () => {
      try {
        const orders = await fetchOrdersForRep(rep.repId);
        const enriched = { ...rep, orders };
        setOpenRepOrders(enriched);
        // Do not auto-select all orders when opening — keep selection empty so barcode
        // scanning controls which orders will be returned.
        setSelectedOrderIds([]);
        // update summary counts for UI
        setRepsSummary(prev => prev.map(r => (String(r.repId) === String(rep.repId) ? { ...r, ordersCount: (orders || []).length, productsCount: (orders || []).reduce((s: number, o: any) => s + ((o.products || []).reduce((ss: number, p: any) => ss + Number(p.quantity || p.qty || 0), 0)), 0) } : r)));
      } catch (e) {
        console.error('Failed to load orders for rep', e);
        setOpenRepOrders(rep);
        setSelectedOrderIds([]);
      }
    })();
  };

  const handleSelectRep = (repIdVal: string) => {
    setSelectedRepId(repIdVal);
    if (!repIdVal) return;
    const foundRep = repsSummary.find((r: any) => String(r.repId) === String(repIdVal));
    if (foundRep) {
      openOrdersForRep(foundRep);
    }
  };

  const fetchOrdersForRep = async (repId: number) => {
    if (!repId) return [];
    try {
      if (isShippingMode) {
        const r = await fetch(`${API_BASE_PATH}/api.php?module=orders&action=getAll&status=in_delivery`, { credentials: 'include' });
        const jr = await r.json();
        if (isPermissionDeniedResponse(r.status, jr)) return [];
        const list = jr && jr.success ? jr.data || [] : [];
        return list.filter((o: any) => Number(o.shipping_company_id ?? o.shippingCompanyId) === Number(repId));
      }
      // جلب جميع الطلبات الموجودة مع المندوب، بما في ذلك الطلبات التي تم إرجاعها جزئيًا
      // نطلب الحالات النشطة فقط (active) لضمان عدم سحب المرتجعات الكلية السابقة
      const r = await fetch(`${API_BASE_PATH}/api.php?module=orders&action=getByRep&rep_id=${repId}&status=active`, { credentials: 'include' });
      const jr = await r.json();
      if (isPermissionDeniedResponse(r.status, jr)) return [];
      const list = jr && jr.success ? jr.data || [] : [];
      return normalizeOrdersForReturnsView(list);
    } catch (e) {
      return [];
    }
  };

  // Populate ordersCount and productsCount for a list of reps (runs concurrently)
  const populateRepCounts = async (list: any[]) => {
    try {
      const concurrency = 3;
      let idx = 0;
      const arr = list.slice();
      const workers: Promise<void>[] = [];
      const runNext = async () => {
        while (idx < arr.length) {
          const i = idx++;
          const r = arr[i];
          try {
            const ords = await fetchOrdersForRep(r.repId);
            const ordersCount = (ords || []).length;
            const productsCount = (ords || []).reduce((s: number, o: any) => s + ((o.products || []).reduce((ss: number, p: any) => ss + Number(p.quantity || p.qty || 0), 0)), 0);
            setRepsSummary(prev => prev.map(x => String(x.repId) === String(r.repId) ? { ...x, ordersCount, productsCount } : x));
          } catch (e) {
            // ignore per-rep errors
          }
        }
      };
      for (let w = 0; w < concurrency; w++) workers.push(runNext());
      await Promise.all(workers);
      setRepsSummary(prev => [...prev].sort((a, b) => (b.ordersCount || 0) - (a.ordersCount || 0)));
    } catch (e) {
      // non-fatal
    }
  };

  const openPartialEditor = (order: any) => {
    setOpenPartialOrder(order);
    const prods = (order.products || []).map((p: any, idx: number) => ({
      // lineId distinguishes duplicate product lines even if productId matches
      lineId: p.line_id ?? p.lineId ?? `${order.id}-${idx}`,
      orderItemId: Number(p.order_item_id || p.id || 0) || undefined,
      productId: p.productId || p.product_id || p.id || 0,
      name: p.name || '',
      // color / size extracted from common fields
      color: (p.color ?? p.variant_color ?? p.variant ?? p.colorName ?? p.variantColor) || '',
      size: (p.size ?? p.variant_size ?? p.measure ?? p.sizeName ?? p.variantSize) || '',
      qtyOriginal: Number(p.quantity || p.qty || 0),
      deliveredQty: Number(p.quantity || p.qty || 0),
      price: Number(p.price || p.sale_price || 0)
    }));
    setPartialProducts(prods);
    setReturnItems([]);
    // Pre-fill partial warehouse with user's default if available and exists in warehouses list
    const defaultWid = userDefaults && userDefaults.default_warehouse_id ? Number(userDefaults.default_warehouse_id) : null;
    if (defaultWid && Array.isArray(warehouses) && warehouses.find(w => Number(w.id) === Number(defaultWid))) {
      setPartialWarehouse(defaultWid);
    } else {
      setPartialWarehouse(undefined);
    }
  };

  const updatePartialQty = (index: number, val: number) => {
    setPartialProducts(prev => prev.map((pp, i) => i === index ? { ...pp, deliveredQty: Math.max(0, Math.min(pp.qtyOriginal, val)) } : pp));
  };

  const submitPartialDelivery = async (warehouseId?: number) => {
    // preserve old behavior as fallback (not used for returns UI)
    if (!openPartialOrder) return;
    const deliveredAmount = partialProducts.reduce((s: any, p: any) => s + (Number(p.deliveredQty || 0) * Number(p.price || 0)), 0);
    const returnedItems = partialProducts.filter(p => (p.qtyOriginal - (p.deliveredQty || 0)) > 0).map(p => ({ productId: p.productId, quantity: (p.qtyOriginal - (p.deliveredQty || 0)) }));
    try {
      const body: any = { id: openPartialOrder.id, status: 'in_delivery', deliveredAmount };
      if (returnedItems.length > 0) { body.returnedItems = returnedItems; }
      if (warehouseId) body.warehouseId = warehouseId;
      const res = await fetch(`${API_BASE_PATH}/api.php?module=orders&action=update`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const j = await res.json();
      if (j.success) {
        setOpenRepOrders((prev: any) => (prev ? ({ ...prev, orders: (prev.orders || []).filter((o: any) => o.id !== openPartialOrder.id) }) : prev));
        try { await refreshData(); } catch (e) { console.error(e); }
        setOpenPartialOrder(null);
        setPartialProducts([]);
        Swal.fire('تم', 'تم حفظ حالة التسليم الجزئي.', 'success');
      } else {
        console.error('Partial save failed', j);
        Swal.fire('خطأ', j.message || 'فشل حفظ التسليم الجزئي.', 'error');
      }
    } catch (e) {
      console.error(e);
      Swal.fire('خطأ', 'فشل في الاتصال بالخادم.', 'error');
    }
  };

  const submitPartialReturn = async () => {
    if (!openPartialOrder) return;
    if (!partialWarehouse) {
      Swal.fire('مطلوب', 'تحديد المستودع إجباري لإتمام المرتجع.', 'warning');
      return;
    }
    if (!returnItems || returnItems.length === 0) {
      Swal.fire('مطلوب', 'اختر على الأقل منتجاً واحداً للمرتجع.', 'warning');
      return;
    }
    // Save these before any async ops or state changes so they remain stable
    const savedOrderId = openPartialOrder.id;
    const savedOrderRepId = (openPartialOrder as any).rep_id ?? (openPartialOrder as any).repId ?? openRepOrders?.repId ?? null;
    try {
      // Build payload compatible with server partialReturn handler
      const itemsPayload = (returnItems || []).map(r => ({ orderItemId: r.orderItemId, lineId: r.lineId, productId: r.productId, quantity: Number(r.quantity || 0) }));
      const payload: any = { order_id: savedOrderId, rep_id: savedOrderRepId, items: itemsPayload, warehouse_id: partialWarehouse, notes: '' };
      const res = await fetch(`${API_BASE_PATH}/api.php?module=orders&action=partialReturn`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const j = await res.json();
      if (j.success) {
        // If server returned updated order data, replace the order in openRepOrders
        if (j.order && openRepOrders && Array.isArray(openRepOrders.orders)) {
          const updatedOrder = j.order;
          setOpenRepOrders((prev: any) => {
            if (!prev) return prev;
            const newOrders = (prev.orders || []).map((o: any) => o.id === updatedOrder.id ? {
              ...o,
              ...updatedOrder,
              orderNumber: updatedOrder.order_number ?? updatedOrder.orderNumber ?? o.orderNumber,
              customerName: updatedOrder.customer_name ?? updatedOrder.customerName ?? o.customerName,
              total_amount: Number(updatedOrder.total_amount ?? o.total_amount ?? 0),
              total: Number(updatedOrder.total_amount ?? o.total ?? 0),
              shipping_fees: Number(updatedOrder.shipping_fees ?? o.shipping_fees ?? 0),
              shipping: Number(updatedOrder.shipping_fees ?? o.shipping ?? 0),
              status: updatedOrder.status || 'partial',
              products: Array.isArray(updatedOrder.products) ? updatedOrder.products.map((p: any) => ({
                productId: p.productId || p.product_id,
                name: p.name,
                color: p.color,
                size: p.size,
                quantity: Number(p.quantity || 0),
                qty: Number(p.quantity || 0),
                price: Number(p.price || p.price_per_unit || 0),
                total: Number(p.total || (Number(p.quantity || 0) * Number(p.price || p.price_per_unit || 0)))
              })) : o.products,
              remainingPieces: Array.isArray(updatedOrder.products)
                ? updatedOrder.products.reduce((s: number, p: any) => s + Number(p.quantity || 0), 0)
                : 0
            } : o).filter((ord: any) => Number(ord.remainingPieces || 0) > 0 && String(ord.status || '').toLowerCase() !== 'returned');
            // Recalculate productsCount and ordersCount for this rep and update repsSummary
            try {
              const repIdLocal = prev.repId;
              const ordersCount = newOrders.length;
              const productsCount = newOrders.reduce((s: number, ord: any) => s + ((ord.products || []).reduce((ss: number, p: any) => ss + Number(p.quantity || p.qty || 0), 0)), 0);
              setRepsSummary(rs => rs.map(r => String(r.repId) === String(repIdLocal) ? ({ ...r, ordersCount, productsCount }) : r));
            } catch (e) { }
            return { ...prev, orders: newOrders };
          });
        }

        // Update rep balance locally if server returned returnedValue
        const rv = Number(j.returnedValue || 0);
        if (rv && openRepOrders) {
          const repIdLocal = openRepOrders.repId;
          setRepsSummary(prev => prev.map(r => {
            if (String(r.repId) !== String(repIdLocal)) return r;
            const newBal = Number((r.balance || 0)) + rv;
            return { ...r, balance: newBal };
          }));
          setOpenRepOrders((prev: any) => prev ? ({ ...prev, balance: Number((prev.balance || 0)) + rv }) : prev);
        }

        // إعادة تحميل طلبات المندوب لضمان تحديث الحسابات والقيم
        try {
          if (savedOrderRepId) {
            const freshOrders = await fetchOrdersForRep(Number(savedOrderRepId));
            setOpenRepOrders((prev: any) => prev ? ({ ...prev, orders: freshOrders }) : prev);
          }
        } catch (freshErr) { console.warn('fetchOrdersForRep refresh failed', freshErr); }

        // Show concise confirmation with counts and warehouse name
        try {
          const ordersCount = 1;
          const productsCount = itemsPayload.reduce((s: number, it: any) => s + Number(it.quantity || 0), 0);
          const wh = (warehouses || []).find(w => Number(w.id) === Number(partialWarehouse));
          const whName = (wh && (wh.name || wh.title || wh.label)) || (partialWarehouse ? (`المستودع #${partialWarehouse}`) : 'غير محدد');
          const txt = `تم استلام\nطلبيات : ${ordersCount}\nمنتجات : ${productsCount}\nفى المخزن: ${whName}`;
          setOpenPartialOrder(null);
          setPartialProducts([]);
          setReturnItems([]);
          setPartialWarehouse(undefined);
          Swal.fire({ title: 'تم', html: txt.replace(/\n/g, '<br/>'), icon: 'success', confirmButtonText: 'حسناً' });
        } catch (e) {
          setOpenPartialOrder(null);
          setPartialProducts([]);
          setReturnItems([]);
          setPartialWarehouse(undefined);
          Swal.fire('تم', 'تم تسجيل المرتجع بنجاح.', 'success');
        }
      } else {
        console.error('Return save failed', j);
        Swal.fire('خطأ', j.message || 'فشل تسجيل المرتجع.', 'error');
      }
    } catch (e) {
      console.error(e);
      Swal.fire('خطأ', 'فشل في الاتصال بالخادم.', 'error');
    }
  };

  // ============================================================
  // Exchange Handlers (استبدال أصناف الطلب)
  // ============================================================
  const loadExchangeCatalog = async (wId?: number) => {
    try {
      setExchangeLoadingCatalog(true);
      const url = wId 
        ? `${API_BASE_PATH}/api.php?module=products&action=getAll&warehouse_id=${wId}`
        : `${API_BASE_PATH}/api.php?module=products&action=getAll`;
      const res = await fetch(url, { credentials: 'include' });
      const json = await res.json();
      if (json && json.success) {
        setExchangeProductsCatalog(json.data || []);
      }
    } catch (e) {
      console.error('Failed to load exchange catalog', e);
    } finally {
      setExchangeLoadingCatalog(false);
    }
  };

  const openExchangeModal = async (order: any) => {
    setOpenExchangeOrder(order);
    const defaultWid = userDefaults && userDefaults.default_warehouse_id 
      ? Number(userDefaults.default_warehouse_id) 
      : (warehouses[0]?.id ? Number(warehouses[0].id) : undefined);
    setExchangeWarehouse(defaultWid);
    setExchangeMode('same_product');
    setExchangeTargetProductId(null);
    setExchangeTargetVariantId(null);
    setExchangeCustomPrice('');
    setExchangeProductSearch('');
    setExchangeNotes('');

    const prods = order.products || [];
    if (prods.length > 0) {
      const p0 = prods[0];
      setExchangeOldItem({
        lineId: p0.line_id ?? p0.lineId ?? `${order.id}-0`,
        orderItemId: p0.id || p0.order_item_id,
        productId: Number(p0.productId || p0.product_id || p0.id || 0),
        name: p0.name || '',
        color: (p0.color ?? p0.variant_color ?? p0.variant ?? p0.colorName) || '',
        size: (p0.size ?? p0.variant_size ?? p0.measure ?? p0.sizeName) || '',
        price: Number(p0.price || p0.sale_price || p0.price_per_unit || 0),
        maxQty: Number(p0.quantity || p0.qty || 1),
        exchangeQty: 1
      });
    } else {
      setExchangeOldItem(null);
    }

    await loadExchangeCatalog(defaultWid);
  };

  const currentParentProduct = useMemo(() => {
    if (!exchangeOldItem || exchangeProductsCatalog.length === 0) return null;
    let found = exchangeProductsCatalog.find((p: any) => 
      (p.variants || []).some((v: any) => Number(v.id) === Number(exchangeOldItem.productId))
    );
    if (!found) {
      found = exchangeProductsCatalog.find((p: any) => 
        (p.name || '').trim().toLowerCase() === (exchangeOldItem.name || '').trim().toLowerCase()
      );
    }
    return found || null;
  }, [exchangeOldItem, exchangeProductsCatalog]);

  const selectedOtherParentProduct = useMemo(() => {
    if (!exchangeTargetProductId || exchangeProductsCatalog.length === 0) return null;
    return exchangeProductsCatalog.find((p: any) => Number(p.id) === Number(exchangeTargetProductId)) || null;
  }, [exchangeTargetProductId, exchangeProductsCatalog]);

  const currentAvailableVariants = useMemo(() => {
    if (exchangeMode === 'same_product') {
      return currentParentProduct?.variants || [];
    } else {
      return selectedOtherParentProduct?.variants || [];
    }
  }, [exchangeMode, currentParentProduct, selectedOtherParentProduct]);

  const selectedNewVariant = useMemo(() => {
    if (!exchangeTargetVariantId || currentAvailableVariants.length === 0) return null;
    return currentAvailableVariants.find((v: any) => Number(v.id) === Number(exchangeTargetVariantId)) || null;
  }, [exchangeTargetVariantId, currentAvailableVariants]);

  const exchangeOldTotal = useMemo(() => {
    if (!exchangeOldItem) return 0;
    return Number(exchangeOldItem.exchangeQty || 0) * Number(exchangeOldItem.price || 0);
  }, [exchangeOldItem]);

  const exchangeNewUnitPrice = useMemo(() => {
    if (!selectedNewVariant) return 0;
    if (exchangeCustomPrice !== '' && !isNaN(Number(exchangeCustomPrice))) {
      return Math.max(0, Number(exchangeCustomPrice));
    }
    return Number(selectedNewVariant.sale_price ?? selectedNewVariant.price ?? 0);
  }, [selectedNewVariant, exchangeCustomPrice]);

  const exchangeNewTotal = useMemo(() => {
    if (!exchangeOldItem || !selectedNewVariant) return 0;
    return Number(exchangeOldItem.exchangeQty || 0) * exchangeNewUnitPrice;
  }, [exchangeOldItem, selectedNewVariant, exchangeNewUnitPrice]);

  const exchangeDeliveredTotal = exchangeOldTotal;
  const exchangeReturnedTotal = exchangeNewTotal;

  const exchangePriceDiff = useMemo(() => {
    return exchangeDeliveredTotal - exchangeReturnedTotal;
  }, [exchangeDeliveredTotal, exchangeReturnedTotal]);

  const exchangeShippingFees = useMemo(() => {
    return Number(openExchangeOrder?.shipping || openExchangeOrder?.shipping_fees || openExchangeOrder?.shippingCost || 0);
  }, [openExchangeOrder]);

  const exchangeCollectedTotal = useMemo(() => {
    return (exchangePriceDiff > 0 ? exchangePriceDiff : 0) + exchangeShippingFees;
  }, [exchangePriceDiff, exchangeShippingFees]);

  const submitExchangeOrderItem = async () => {
    if (!openExchangeOrder) return;
    if (!exchangeWarehouse) {
      Swal.fire('مطلوب', 'يرجى تحديد مستودع استلام الصنف المرتجع.', 'warning');
      return;
    }
    if (!exchangeOldItem) {
      Swal.fire('مطلوب', 'يرجى اختيار الصنف المسلَّم للعميل من الطلب.', 'warning');
      return;
    }
    if (!selectedNewVariant) {
      Swal.fire('مطلوب', 'يرجى اختيار الصنف المرتجع المستلم من العميل.', 'warning');
      return;
    }

    try {
      setExchangeSubmitting(true);
      const payload = {
        order_id: openExchangeOrder.id,
        warehouse_id: exchangeWarehouse,
        delivered_item: {
          order_item_id: exchangeOldItem.orderItemId,
          product_id: exchangeOldItem.productId,
          quantity: exchangeOldItem.exchangeQty,
          price: exchangeOldItem.price
        },
        returned_item: {
          variant_id: selectedNewVariant.id,
          quantity: exchangeOldItem.exchangeQty,
          price: exchangeNewUnitPrice,
          name: selectedNewVariant.parent_name || selectedNewVariant.name,
          color: selectedNewVariant.color,
          size: selectedNewVariant.size
        },
        price_diff: exchangePriceDiff,
        collected_amount: exchangeCollectedTotal,
        notes: exchangeNotes
      };

      const res = await fetch(`${API_BASE_PATH}/api.php?module=orders&action=exchangeOrderItem`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.message || 'فشل إتمام الاستبدال');
      }

      if (data.order && openRepOrders && Array.isArray(openRepOrders.orders)) {
        const updated = data.order;
        setOpenRepOrders((prev: any) => {
          if (!prev) return prev;
          return {
            ...prev,
            orders: (prev.orders || []).map((o: any) => (o.id === updated.id ? { ...o, ...updated, status: 'exchange' } : o))
          };
        });
      }

      if (openRepOrders && openRepOrders.repId) {
        try {
          const uRes = await fetch(`${API_BASE_PATH}/api.php?module=users&action=getAllWithBalance&related_to_type=rep&rep_id=${openRepOrders.repId}`, { credentials: 'include' });
          const uJson = await uRes.json();
          if (uJson?.success && Array.isArray(uJson.data) && uJson.data.length > 0) {
            const freshBal = Number(uJson.data[0].balance || 0);
            setRepsSummary(prev => prev.map(r => Number(r.repId) === Number(openRepOrders.repId) ? { ...r, balance: freshBal } : r));
            setOpenRepOrders((prev: any) => prev ? { ...prev, balance: freshBal } : prev);
          }
        } catch (e) {}
      }

      setOpenExchangeOrder(null);
      setExchangeOldItem(null);
      setExchangeTargetVariantId(null);

      const diffText = exchangePriceDiff > 0 
        ? `+${exchangePriceDiff.toLocaleString()} ج.م (لصالح الشركة)`
        : exchangePriceDiff < 0
          ? `${exchangePriceDiff.toLocaleString()} ج.م (تخفيض للعميل)`
          : `0 ج.م (متكافئ)`;

      Swal.fire({
        title: 'تم تسجيل الاستبدال واستلام المرتجع بالمخزن',
        html: `<div style="text-align: right; direction: rtl; font-size: 13px; line-height: 1.8;">
          <div><b>المسلَّم للعميل (الصنف الجديد):</b> ${exchangeOldItem.name} (${exchangeOldItem.exchangeQty} قطعة - ${exchangeDeliveredTotal.toLocaleString()} ج.م)</div>
          <div><b>المرتجع للمخزن (الصنف القديم):</b> ${selectedNewVariant.parent_name || selectedNewVariant.name} (${selectedNewVariant.color || ''} ${selectedNewVariant.size || ''}) - ${exchangeReturnedTotal.toLocaleString()} ج.م</div>
          <div><b>فرق السعر:</b> <span style="font-weight:bold; color:${exchangePriceDiff >= 0 ? '#059669' : '#2563eb'}">${diffText}</span></div>
          <div><b>مصاريف الشحن:</b> ${exchangeShippingFees.toLocaleString()} ج.م</div>
          <div style="margin-top: 8px; padding: 8px; background: #ecfdf5; color: #065f46; border-radius: 8px; font-weight: bold; border: 1px solid #a7f3d0;">
            إجمالي المطلوب تحصيله بواسطة المندوب: ${exchangeCollectedTotal.toLocaleString()} ج.م
          </div>
        </div>`,
        icon: 'success',
        confirmButtonText: 'حسناً'
      });
    } catch (e: any) {
      console.error('Exchange failed', e);
      Swal.fire('خطأ', e.message || 'تعذر إتمام الاستبدال.', 'error');
    } finally {
      setExchangeSubmitting(false);
    }
  };

  const adjustRepCounts = (repId: any, removedOrders: any[]) => {
    if (!repId) return;
    const removedCount = removedOrders.length || 0;
    const removedProducts = removedOrders.reduce((s: any, o: any) => s + ((o.products || []).reduce((ss: number, p: any) => ss + Number(p.quantity || p.qty || 0), 0)), 0);
    setRepsSummary(prev => prev.map((r: any) => {
      if (String(r.repId) !== String(repId)) return r;
      return {
        ...r,
        ordersCount: Math.max(0, (r.ordersCount || 0) - removedCount),
        productsCount: Math.max(0, (r.productsCount || 0) - removedProducts)
      };
    }));
  };

  // وظيفة الطباعة الجديدة الموحدة
  const handlePrintOrders = (ordersList: any[]) => {
    if (!ordersList || ordersList.length === 0) {
      Swal.fire('تنبيه', 'لا توجد اوردرات للطباعة', 'warning');
      return;
    }
    setOrdersToPrint(ordersList);
  };

  /* const printDailyDocument = (ordersToPrint:any[]) => {
    // Use the A4-style detailed daily report (matches SalesDaily.printA4Report)
    const dateStr = new Date().toLocaleDateString();
    const repName = (ordersToPrint && ordersToPrint.length>0)
      ? (openRepOrders?.name || ordersToPrint[0].rep_name || ordersToPrint[0].repName || '')
      : (openRepOrders?.name||'');
    // compute totals and summary fields
    const parseDate = (o:any) => new Date(o.created_at || o.createdAt || o.date || o.order_date || o.orderDate || Date.now());
    const isSameDay = (a:Date,b:Date) => a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth() && a.getDate()===b.getDate();
    const today = new Date();
    const allOrders = ordersToPrint || [];
    const todayOrders = allOrders.filter((o:any)=> isSameDay(parseDate(o), today));
    const oldOrders = allOrders.filter((o:any)=> !isSameDay(parseDate(o), today));
    const todayValue = todayOrders.reduce((s:any,o:any)=> s + computeOrderSubtotal(o), 0);
    const todayOrdersCount = todayOrders.length;
    const todayPieces = todayOrders.reduce((s:any,o:any)=> s + ((o.products||[]).reduce((ss:number,p:any)=> ss + Number(p.quantity||p.qty||0),0)), 0);
    const oldOrdersCount = oldOrders.length;
    const oldPieces = oldOrders.reduce((s:any,o:any)=> s + ((o.products||[]).reduce((ss:number,p:any)=> ss + Number(p.quantity||p.qty||0),0)), 0);
    const totalOrdersCount = allOrders.length;
    const totalPieces = allOrders.reduce((s:any,o:any)=> s + ((o.products||[]).reduce((ss:number,p:any)=> ss + Number(p.quantity||p.qty||0),0)), 0);
    // try to obtain previous balance from openRepOrders or repsSummary lookup
    let prevBalance = Number(openRepOrders?.balance || 0);
    try {
      if ((!prevBalance || prevBalance===0) && allOrders.length>0) {
        const repId = allOrders[0].rep_id || allOrders[0].repId || allOrders[0].shipping_company_id || allOrders[0].shippingCompanyId || null;
        if (repId) {
          const found = (repsSummary||[]).find((r:any) => String(r.repId) === String(repId));
          if (found) prevBalance = Number(found.balance || 0);
        }
      }
    } catch(e) { prevBalance = Number(openRepOrders?.balance || 0); }
    const finalDebtBefore = prevBalance - todayValue;
    const paidNowStatic = 0;
    const remainingAfter = finalDebtBefore + paidNowStatic;
    const totalAmount = allOrders.reduce((s:any,o:any)=> s + computeOrderSubtotal(o) + Number(o.shipping||o.shipping_fees||o.shippingCost||0), 0);
    const reportTitle = isShippingMode ? 'يومية الشحن' : 'يومية المندوب';
    const assigneeLabel = isShippingMode ? 'شركة الشحن' : 'المندوب';
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>${reportTitle}</title><style>body{font-family: Arial, Helvetica, "Noto Naskh Arabic", sans-serif; direction:rtl; padding:20px;} h1{text-align:center;} .header{display:flex; justify-content:space-between; align-items:center;} table{width:100%; border-collapse:collapse; margin-top:12px;} th,td{border:1px solid #333; padding:6px; font-size:12px; text-align:right;} th{background:#eee;} .summary{margin-top:10px; border:1px solid #ccc; padding:8px; background:#fafafa;} .summary .row{display:flex; justify-content:space-between; gap:8px; margin-bottom:6px;} .summary .label{font-weight:600; width:40%;} .summary .val{width:60%; text-align:left;} </style></head><body>`+
      `<div class="header"><div>${user?.name || ''}</div><div><h1>${reportTitle}</h1></div><div></div></div>`+
      `<div class="summary">`+
        `<!-- Row 1: date right, rep name center -->`+
        `<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">`+
          `<div style="text-align:right; width:33%;">التاريخ: ${dateStr}</div>`+
          `<div style="text-align:center; width:34%; font-weight:900; font-size:16px;">${repName || ''}</div>`+
          `<div style="text-align:left; width:33%;"></div>`+
        `</div>`+
        `<!-- Row 2: stats boxes -->`+
        `<div style="display:flex; gap:10px; justify-content:space-between; margin-bottom:8px;">`+
          `<div style="flex:1; text-align:center; border:1px solid #e2e8f0; padding:8px; border-radius:6px; background:#ffffff;"><div style="font-weight:800;">اوردرات قديمة</div><div style="font-size:14px;">${oldOrdersCount}</div></div>`+
          `<div style="flex:1; text-align:center; border:1px solid #e2e8f0; padding:8px; border-radius:6px; background:#ffffff;"><div style="font-weight:800;">قطع قديمة</div><div style="font-size:14px;">${oldPieces}</div></div>`+
          `<div style="flex:1; text-align:center; border:1px solid #e2e8f0; padding:8px; border-radius:6px; background:#ffffff;"><div style="font-weight:800;">طلبات اليوم</div><div style="font-size:14px;">${todayOrdersCount}</div></div>`+
          `<div style="flex:1; text-align:center; border:1px solid #e2e8f0; padding:8px; border-radius:6px; background:#ffffff;"><div style="font-weight:800;">قطع اليوم</div><div style="font-size:14px;">${todayPieces}</div></div>`+
        `</div>`+
        `<!-- Row 3: totals boxes -->`+
        `<div style="display:flex; gap:10px; justify-content:space-between; margin-bottom:8px;">`+
          `<div style="flex:1; text-align:center; border:1px solid #e2e8f0; padding:8px; border-radius:6px; background:#ffffff;"><div style="font-weight:800;">اجمالى الاوردرات</div><div style="font-size:14px;">${totalOrdersCount}</div></div>`+
          `<div style="flex:1; text-align:center; border:1px solid #e2e8f0; padding:8px; border-radius:6px; background:#ffffff;"><div style="font-weight:800;">اجمالى القطع</div><div style="font-size:14px;">${totalPieces}</div></div>`+
        `</div>`+
        `<!-- Row 4: balances -->`+
        `<div style="display:flex; gap:10px; justify-content:space-between; margin-bottom:8px;">`+
          `<div style="flex:1; text-align:center; border:1px solid #e2e8f0; padding:8px; border-radius:6px; background:#ffffff;"><div style="font-weight:800;">حساب قديم</div><div style="font-size:14px;">${Math.abs(prevBalance).toLocaleString()} ج.م</div></div>`+
          `<div style="flex:1; text-align:center; border:1px solid #e2e8f0; padding:8px; border-radius:6px; background:#ffffff;"><div style="font-weight:800;">حساب اليوم</div><div style="font-size:14px;">${todayValue.toLocaleString()} ج.م</div></div>`+
          `<div style="flex:1; text-align:center; border:1px solid #e2e8f0; padding:8px; border-radius:6px; background:#ffffff;"><div style="font-weight:800;">الحساب الحالى</div><div style="font-size:14px;">${Math.abs(finalDebtBefore).toLocaleString()} ج.م</div></div>`+
        `</div>`+
        `<!-- Row 5: payment -->`+
        `<div style="display:flex; gap:10px; justify-content:space-between;">`+
          `<div style="flex:1; text-align:center; border:1px solid #e2e8f0; padding:8px; border-radius:6px; background:#ffffff;"><div style="font-weight:800;">المبلغ المدفوع</div><div style="font-size:14px;">${paidNowStatic.toLocaleString()} ج.م</div></div>`+
          `<div style="flex:1; text-align:center; border:1px solid #e2e8f0; padding:8px; border-radius:6px; background:#ffffff;"><div style="font-weight:800;">المبلغ المتبقي</div><div style="font-size:14px;">${Math.abs(remainingAfter).toLocaleString()} ج.م</div></div>`+
        `</div>`+
      `</div>`+
      `${isShippingMode ? '' : `<div style="margin-top:8px">اجمالي اليومية: ${totalAmount}</div>`}`+
      `<div style="margin-top:8px">${assigneeLabel}: ${repName || ''}</div>`+
      `<table><thead><tr><th>رقم الاوردر</th><th>اسم العميل</th><th>الهاتف</th><th>المحافظه</th><th>العنوان</th><th>الموظف</th><th>البيدج</th><th>الإجمالي</th><th>شحن</th><th>الاجمالي الكلي</th><th>ملاحظات</th></tr></thead><tbody>`+
      allOrders.map(o=>`<tr><td>${o.orderNumber||o.order_number||''}</td><td>${o.customerName||o.customer_name||''}</td><td>${o.phone||o.phone1||''}</td><td>${o.governorate||''}</td><td>${o.address||''}</td><td>${o.employee||''}</td><td>${o.page||''}</td><td>${computeOrderSubtotal(o)}</td><td>${o.shipping||o.shipping_fees||o.shippingCost||0}</td><td>${o.total||0}</td><td>${o.notes||''}</td></tr>`).join('')+
      `</tbody></table></body></html>`;

    const w = window.open('', '_blank', 'toolbar=0,location=0,menubar=0,scrollbars=1,resizable=1,width=900,height=700');
    if (!w) return; w.document.write(html); w.document.close(); w.focus(); setTimeout(()=>w.print(),400);
  }; */
  const printDailyDocument = (ordersToPrint: any[]) => {
    const dateStr = new Date().toLocaleDateString();

    // --- 1. تحديد اسم المندوب ---
    let repName = '';
    if (ordersToPrint && ordersToPrint.length > 0) {
      const firstOrder = ordersToPrint[0];
      const repId = firstOrder.rep_id || firstOrder.repId || firstOrder.shipping_company_id || firstOrder.shippingCompanyId;

      if (repId && typeof repsSummary !== 'undefined') {
        const found = repsSummary.find((r: any) => String(r.repId) === String(repId));
        if (found) repName = found.name;
      }
      if (!repName) {
        repName = firstOrder.rep_name || firstOrder.repName || firstOrder.representative || openRepOrders?.name || '';
      }
    } else {
      repName = openRepOrders?.name || '';
    }

    // --- 2. حساب الإجماليات بدقة (وتجاهل الأخطاء في الداتا القديمة) ---
    const parseDate = (o: any) => new Date(o.created_at || o.createdAt || o.date || o.order_date || o.orderDate || Date.now());
    const isSameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
    const today = new Date();
    const allOrders = ordersToPrint || [];

    const todayOrders = allOrders.filter((o: any) => isSameDay(parseDate(o), today));
    const oldOrders = allOrders.filter((o: any) => !isSameDay(parseDate(o), today));

    const todayValue = todayOrders.reduce((s: any, o: any) => s + computeOrderSubtotal(o), 0);
    const totalAmount = allOrders.reduce((s: any, o: any) => s + computeOrderSubtotal(o), 0);

    // حساب إجمالي التحصيل الفعلي (منتجات + شحن)
    const totalRequiredToCollect = allOrders.reduce((s: any, o: any) => s + computeOrderSubtotal(o) + Number(o.shipping || o.shipping_fees || o.shippingCost || 0), 0);

    const todayOrdersCount = todayOrders.length;
    const todayPieces = todayOrders.reduce((s: any, o: any) => s + ((o.products || []).reduce((ss: number, p: any) => ss + Number(p.quantity || p.qty || 0), 0)), 0);
    const oldOrdersCount = oldOrders.length;
    const oldPieces = oldOrders.reduce((s: any, o: any) => s + ((o.products || []).reduce((ss: number, p: any) => ss + Number(p.quantity || p.qty || 0), 0)), 0);
    const totalOrdersCount = allOrders.length;
    const totalPieces = allOrders.reduce((s: any, o: any) => s + ((o.products || []).reduce((ss: number, p: any) => ss + Number(p.quantity || p.qty || 0), 0)), 0);

    let prevBalance = Number(openRepOrders?.balance || 0);
    try {
      if ((!prevBalance || prevBalance === 0) && allOrders.length > 0) {
        const repId = allOrders[0].rep_id || allOrders[0].repId || allOrders[0].shipping_company_id || allOrders[0].shippingCompanyId || null;
        if (repId) {
          const found = (repsSummary || []).find((r: any) => String(r.repId) === String(repId));
          if (found) prevBalance = Number(found.balance || 0);
        }
      }
    } catch (e) { prevBalance = Number(openRepOrders?.balance || 0); }
    const finalDebtBefore = prevBalance - todayValue;

    const reportTitle = isShippingMode ? 'يومية شركة الشحن' : 'يومية المندوب';
    const assigneeLabel = isShippingMode ? 'شركة الشحن' : 'اسم المندوب';

    // === تجميع المنتجات لإذن التسليم السفلي ===
    const summaryMap: Record<string, { name: string; color: string; size: string; qty: number }> = {};
    allOrders.forEach(o => (o.products || []).forEach((p: any) => {
      const key = `${p.name || ''}||${p.color || ''}||${p.size || ''}`;
      if (!summaryMap[key]) summaryMap[key] = { name: p.name || '', color: p.color || '', size: p.size || '', qty: 0 };
      summaryMap[key].qty += Number(p.quantity || p.qty || 0);
    }));
    const groupedProducts = Object.values(summaryMap);

    const html = `<!doctype html><html><head><meta charset="utf-8"><title>${reportTitle}</title>
    <style>
        @page { size: A4; margin: 8mm; }
        body { font-family: "Noto Naskh Arabic", Arial, sans-serif; direction: rtl; padding: 0; margin: 0; color: #000; background: #fff; }
        
        /* الهيدر المدمج */
        .top-header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #000; padding-bottom: 8px; margin-bottom: 12px; }
        .top-header-right h1 { margin: 0 0 4px 0; font-size: 22px; font-weight: 900; }
        .top-header-right .date { font-size: 12px; font-weight: bold; }
        
        .rep-badge { border: 2px solid #000; padding: 4px 15px; border-radius: 4px; background: #000; color: #fff; text-align: center; }
        .rep-badge .lbl { font-size: 10px; color: #ccc; display: block; margin-bottom: 2px;}
        .rep-badge .val { font-size: 16px; font-weight: bold; }
        
        .amount-badge { border: 2px solid #000; padding: 4px 12px; border-radius: 4px; background: #f9fafb; text-align: center; }
        .amount-badge .lbl { font-size: 10px; color: #333; display: block; margin-bottom: 2px;}
        .amount-badge .val { font-size: 16px; font-weight: 900; }

        /* مربعات الملخص */
        .summary-grid { display: grid; grid-template-columns: repeat(8, 1fr); gap: 6px; margin-bottom: 15px; }
        .stat-box { border: 1px solid #666; padding: 4px; border-radius: 4px; text-align: center; }
        .stat-box.highlight { border: 2px solid #000; background: #e5e7eb; }
        .stat-box .title { font-size: 10px; font-weight: 900; color: #333; margin-bottom: 2px; }
        .stat-box .value { font-size: 14px; font-weight: 900; color: #000; }
        
        /* جدول الاوردرات */
        table.main-table { width: 100%; border-collapse: collapse; margin-bottom: 15px; border: 2px solid #000; }
        table.main-table th, table.main-table td { border: 1px solid #000; padding: 4px 6px; font-size: 11px; text-align: right; color: #000; }
        table.main-table th { background: #e5e7eb; font-weight: 900; font-size: 12px; text-align: center; }
        table.main-table tbody tr:nth-child(even) { background: #f9fafb; }
        table.main-table tbody tr { page-break-inside: avoid; } 
        .text-center { text-align: center; }
        .font-black { font-weight: 900; }
        .highlight-cell { background: #e5e7eb; font-weight: 900; }

        /* إذن التسليم */
        .delivery-section { border-top: 2px dashed #000; padding-top: 10px; page-break-inside: avoid; }
        .delivery-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
        .delivery-title { font-size: 15px; font-weight: 900; background: #000; color: #fff; padding: 3px 15px; border-radius: 4px; }
        .total-pieces-badge { font-size: 14px; font-weight: 900; border: 2px solid #000; padding: 4px 15px; background: #e5e7eb; }
        
        table.mini-table { width: 65%; margin: 0; border-collapse: collapse; border: 2px solid #000; }
        table.mini-table th, table.mini-table td { border: 1px solid #000; padding: 3px 6px; font-size: 11px; text-align: center; }
        /* جدول طلبيات النزول: يظهر رقم الطلب، الموظف، البيدج وعدد القطع */
        table.delivery-orders-table { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
        table.delivery-orders-table th, table.delivery-orders-table td { border: 1px solid #000; padding: 4px 6px; font-size: 11px; text-align: right; }
        table.delivery-orders-table th { background: #e5e7eb; font-weight: 900; }
        table.mini-table th { background: #e5e7eb; font-weight: bold; }
        table.mini-table .prod-name { text-align: right; font-weight: bold; }
        
        @media print {
            * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        }
    </style></head><body>

      <div class="top-header">
          <div class="top-header-right">
              <h1>${reportTitle}</h1>
              <div class="date">تاريخ الطباعة: ${dateStr}</div>
          </div>
          <div class="rep-badge">
              <span class="lbl">${assigneeLabel}</span>
              <span class="val">${repName || 'غير محدد'}</span>
          </div>
          ${!isShippingMode ? `
          <div class="amount-badge">
              <span class="lbl">إجمالي المنتجات (بدون شحن)</span>
              <span class="val">${totalAmount.toLocaleString()} ج.م</span>
          </div>
          ` : ''}
          <div class="amount-badge" style="background: #e5e7eb;">
              <span class="lbl">العهدة الحالية (عليه/له)</span>
              <span class="val">${Math.abs(finalDebtBefore).toLocaleString()} ج.م</span>
          </div>
      </div>

      <div class="summary-grid">
          <div class="stat-box"><div class="title">طلبيات قديمة</div><div class="value">${oldOrdersCount}</div></div>
          <div class="stat-box"><div class="title">قطع قديمة</div><div class="value">${oldPieces}</div></div>
          <div class="stat-box"><div class="title">طلبات اليوم</div><div class="value">${todayOrdersCount}</div></div>
          <div class="stat-box"><div class="title">قطع اليوم</div><div class="value">${todayPieces}</div></div>
          <div class="stat-box highlight"><div class="title">إجمالي الاوردرات</div><div class="value">${totalOrdersCount}</div></div>
          <div class="stat-box highlight"><div class="title">إجمالي القطع</div><div class="value">${totalPieces}</div></div>
          <div class="stat-box highlight"><div class="title">قيمة المنتجات</div><div class="value">${todayValue.toLocaleString()}</div></div>
          <div class="stat-box highlight"><div class="title">إجمالي المطلوب تحصيله</div><div class="value">${totalRequiredToCollect.toLocaleString()}</div></div>
      </div>

        <table class="main-table">
          <thead>
            <tr>
              <th style="width: 7%;">الطلب</th>
              <th style="width: 14%;">العميل</th>
              <th style="width: 9%;">الهاتف</th>
              <th style="width: 9%;">المحافظة</th>
              <th style="width: 18%;">العنوان</th>
              <th style="width: 8%;">الموظف/بيدج</th>
              <th style="width: 6%;">القطع</th>
              <th style="width: 8%;">قيمة المنتجات</th>
              <th style="width: 6%;">شحن</th>
              <th style="width: 9%;">المطلوب</th>
              <th style="width: 8%;">ملاحظات</th>
            </tr>
          </thead>
          <tbody>
            ${allOrders.map(o => {
      const pieces = (o.products || []).reduce((s: number, p: any) => s + Number(p.quantity || p.qty || 0), 0);
      const prodVal = computeOrderSubtotal(o);
      const shipVal = Number(o.shipping || o.shipping_fees || o.shippingCost || 0);
      const totalVal = prodVal + shipVal;
      return `
            <tr>
              <td class="font-black text-center">${o.orderNumber || o.order_number || ''}</td>
              <td class="font-black">${o.customerName || o.customer_name || ''}</td>
              <td dir="ltr" class="text-center font-black">${o.phone || o.phone1 || ''}</td>
              <td class="text-center font-black">${o.governorate || ''}</td>
              <td>${o.address || ''}</td>
              <td class="text-center">${o.employee || o.user_name || o.admin || o.created_by || '-'}<br><span style="font-size:9px; color:#555;">${o.page || o.source || '-'}</span></td>
              <td class="text-center font-black">${pieces}</td>
              <td class="text-center font-black">${prodVal.toLocaleString()}</td>
              <td class="text-center">${shipVal.toLocaleString()}</td>
              <td class="text-center highlight-cell">${totalVal.toLocaleString()}</td>
              <td>${o.notes || o.remark || o.customer_notes || '-'}</td>
            </tr>`;
    }).join('')}
          </tbody>
        </table>

        <div class="delivery-section">
          <div class="delivery-header">
              <div class="delivery-title">إذن تسليم مجمع (جرد القطع)</div>
              <div class="total-pieces-badge">إجمالي القطع المستلمة: ${groupedProducts.reduce((s, r) => s + r.qty, 0)} قطعة</div>
          </div>
          <!-- جدول طلبيات النزول: يعرض رقم الطلب، الموظف، البيدج وعدد القطع لكل طلب -->
          <table class="delivery-orders-table">
            <thead>
              <tr>
                <th>الطلب</th>
                <th>الموظف</th>
                <th>البيدج</th>
                <th>القطع</th>
              </tr>
            </thead>
            <tbody>
            ${allOrders.map(o => {
      const piecesPerOrder = (o.products || []).reduce((s: number, p: any) => s + Number(p.quantity || p.qty || 0), 0);
      const employee = o.employee || o.user_name || o.admin || o.created_by || o.created_by_name || o.rep_name || o.representative || o.assigned_to || o.assigned_employee || '-';
      const page = o.page || o.source || o.source_page || o.page_no || o.pageNumber || '-';
      return `<tr><td class="font-black text-center">${o.orderNumber || o.order_number || ''}</td><td>${employee}</td><td class="text-center">${page}</td><td class="text-center font-black">${piecesPerOrder}</td></tr>`;
    }).join('')}
            </tbody>
          </table>
          <table class="mini-table">
              <thead>
                  <tr>
                      <th style="width:50%">اسم المنتج</th>
                      <th style="width:20%">اللون</th>
                      <th style="width:20%">المقاس</th>
                      <th style="width:10%">الكمية</th>
                  </tr>
              </thead>
              <tbody>
                  ${groupedProducts.map(r => `
                  <tr>
                      <td class="prod-name">${r.name}</td>
                      <td class="font-black">${r.color || '-'}</td>
                      <td class="font-black">${r.size || '-'}</td>
                      <td class="font-black highlight-cell" style="font-size: 13px;">${r.qty}</td>
                  </tr>`).join('')}
              </tbody>
          </table>
      </div>

    </body></html>`;

    const w = window.open('', '_blank', 'toolbar=0,location=0,menubar=0,scrollbars=1,resizable=1,width=1000,height=800');
    if (!w) return;
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 500);
  };
  const printDeliveryNote = (ordersList: any[]) => {
    // طباعة إذن التسليم مهيأ لطابعة حرارية 80mm
    const summaryMap: Record<string, { name: string; color: string; size: string; qty: number }> = {};
    (ordersList || []).forEach(o => (o.products || []).forEach((p: any) => {
      const key = `${p.name || ''}||${p.color || ''}||${p.size || ''}`;
      if (!summaryMap[key]) summaryMap[key] = { name: p.name || '', color: p.color || '', size: p.size || '', qty: 0 };
      summaryMap[key].qty += Number(p.quantity || p.qty || 0);
    }));
    const rows = Object.values(summaryMap);
    const dateStr = new Date().toLocaleString('ar-EG');
    const repName = (ordersList && ordersList.length > 0) ? (openRepOrders?.name || ordersList[0].rep_name || ordersList[0].repName || '') : (openRepOrders?.name || '');
    const assigneeLabel = isShippingMode ? 'شركة الشحن' : 'المندوب';
    const compName = localStorage.getItem('Dragon_company_name') || '';
    const totalProducts = rows.length;
    const totalPieces = rows.reduce((s, r) => s + r.qty, 0);

    const html = `<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><title>إذن تسليم بضاعة</title>` +
      `<style>
        @page { size: 80mm auto; margin: 0; }
        @media print {
          html, body {
            width: 70mm !important;
            max-width: 70mm !important;
            margin: 0 auto !important;
            padding: 2mm 1mm !important;
          }
        }
        * { box-sizing: border-box; margin: 0; padding: 0; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        html, body { font-family: 'Cairo', 'Segoe UI', Tahoma, Arial, sans-serif; direction: rtl; width: 70mm; max-width: 70mm; margin: 0 auto; padding: 2mm 1mm; font-size: 10.5px; color: #000; background: #fff; line-height: 1.3; overflow-x: hidden; }
        .receipt-header { text-align: center; border-bottom: 1.5px dashed #000; padding-bottom: 4px; margin-bottom: 5px; }
        .comp-title { font-size: 12.5px; font-weight: 900; margin-bottom: 2px; }
        .doc-badge { display: inline-block; font-size: 13px; font-weight: 900; border: 1.5px solid #000; padding: 2px 8px; border-radius: 4px; margin: 2px 0; }
        .meta-table { width: 100%; margin: 3px 0; font-size: 10px; border-collapse: collapse; }
        .meta-table td { padding: 1.5px 0; vertical-align: top; }
        .meta-lbl { font-weight: bold; color: #222; }
        .meta-val { font-weight: 900; color: #000; }
        .divider { border-bottom: 1px dashed #000; margin: 4px 0; }
        table.items-table { width: 100%; border-collapse: collapse; margin: 5px 0; table-layout: fixed; }
        table.items-table th, table.items-table td { border: 1px solid #000; padding: 3px 2px; font-size: 10px; }
        table.items-table th { background-color: #f0f0f0; font-weight: 900; text-align: center; }
        table.items-table td.col-prod { text-align: right; font-weight: bold; word-break: break-word; overflow-wrap: break-word; width: 42%; padding-right: 2px; }
        table.items-table td.col-color { text-align: center; width: 20%; word-break: break-word; }
        table.items-table td.col-size { text-align: center; width: 18%; word-break: break-word; }
        table.items-table td.col-qty { text-align: center; font-weight: 900; font-size: 11px; width: 20%; background-color: #fafafa; }
        .summary-card { border: 1.5px solid #000; background: #f8f8f8; padding: 4px 5px; margin: 5px 0; border-radius: 4px; }
        .summary-line { display: flex; justify-content: space-between; font-size: 11px; font-weight: 900; padding: 1px 0; }
        .summary-line.grand-total { border-top: 1px dashed #555; margin-top: 2px; padding-top: 2px; font-size: 12px; }
        .signatures { margin-top: 10px; padding-top: 5px; border-top: 1px dashed #000; display: flex; justify-content: space-between; font-size: 9px; font-weight: bold; }
      </style></head><body>` +
      `<div class="receipt-header">` +
      (compName ? `<div class="comp-title">${compName}</div>` : '') +
      `<div class="doc-badge">إذن تسليم بضاعة</div>` +
      `</div>` +
      `<table class="meta-table">` +
      `<tr><td style="width:100%; text-align:right;"><span class="meta-lbl">${assigneeLabel}: </span><span class="meta-val">${repName || '—'}</span></td></tr>` +
      `<tr><td style="text-align:center; font-size:9.5px; padding-top:2px;"><span class="meta-lbl">التاريخ والوقت: </span><span>${dateStr}</span></td></tr>` +
      `</table>` +
      `<div class="divider"></div>` +
      `<table class="items-table">` +
      `<thead><tr><th style="width:42%;">المنتج</th><th style="width:20%;">اللون</th><th style="width:18%;">المقاس</th><th style="width:20%;">الكمية</th></tr></thead>` +
      `<tbody>` +
      rows.map(r => `<tr><td class="col-prod">${r.name}</td><td class="col-color">${r.color || '—'}</td><td class="col-size">${r.size || '—'}</td><td class="col-qty">${r.qty}</td></tr>`).join('') +
      `</tbody></table>` +
      `<div class="summary-card">` +
      `<div class="summary-line"><span>إجمالي الأصناف:</span><span>${totalProducts} صنف</span></div>` +
      `<div class="summary-line grand-total"><span>إجمالي القطع:</span><span>${totalPieces} قطعة</span></div>` +
      `</div>` +
      `<div class="signatures"><div>توقيع المستلم: .................</div><div>توقيع أمين المخزن: .................</div></div>` +
      `</body></html>`;
    const w = window.open('', '_blank', 'toolbar=0,location=0,menubar=0,scrollbars=1,resizable=1,width=400,height=800');
    if (!w) return; w.document.write(html); w.document.close(); w.focus(); setTimeout(() => w.print(), 500);
  };

  const printShippingLabelsNew = (ordersList: any[]) => {
    // Reuse the unified PrintableOrders layout so output matches Orders Management page
    const orders = ordersList || [];
    setPrintSinglePerPage(true);
    setOrdersToPrint(orders);
  };

  const handleBarcodeScan = async () => {
    const raw = (scanInput || '').trim();
    if (!raw) return;
    const cleanCode = cleanBarcode(raw);
    if (!cleanCode) {
      setScanInput('');
      return;
    }

    // 1. First priority: Exact order number / tracking match in the current open rep's orders
    const directOrderMatch = (openRepOrders?.orders || []).find((o: any) => isOrderMatchingBarcode(o, cleanCode));

    if (directOrderMatch) {
      setSelectedOrderIds(prev => Array.from(new Set([...prev, directOrderMatch.id])));
      setScannedBarcodes(prev => [{ code: raw, orderId: directOrderMatch.id }, ...prev]);
      Swal.fire({
        toast: true,
        position: 'top-end',
        icon: 'success',
        title: 'تم تحديد الأوردر',
        text: `أوردر #${directOrderMatch.orderNumber || directOrderMatch.order_number || directOrderMatch.id} - ${directOrderMatch.customerName || directOrderMatch.customer_name || ''}`,
        timer: 1500,
        showConfirmButton: false
      });
      setScanInput('');
      return;
    }

    // 2. Second priority: If not in open rep's orders, check the server to see if this order exists in the system
    try {
      const sRes = await fetch(`${API_BASE_PATH}/api.php?module=orders&action=getByNumber&orderNumber=${encodeURIComponent(cleanCode)}`);
      const sJson = await sRes.json().catch(() => null);
      if (sJson && sJson.success && sJson.data) {
        const sysOrder = sJson.data;
        const currentRepId = openRepOrders?.repId;
        const orderRepId = sysOrder.rep_id ?? sysOrder.repId ?? null;

        // Find rep name
        let repName = '';
        if (orderRepId) {
          const foundRep = repsSummary.find(r => Number(r.repId) === Number(orderRepId));
          repName = foundRep?.name || `مندوب #${orderRepId}`;
        }

        if (orderRepId && Number(orderRepId) !== Number(currentRepId)) {
          Swal.fire({
            icon: 'warning',
            title: 'الأوردر تابع لمندوب آخر',
            html: `<p>الأوردر رقم <b>#${cleanCode}</b> ليس في عهدة المندوب المختار حالياً.</p><p class="mt-2 text-sm text-slate-600">هذا الأوردر في عهدة: <b>${repName}</b></p>`,
            confirmButtonText: 'حسناً'
          });
          setScanInput('');
          return;
        } else {
          // Status is not with current rep (e.g. pending, delivered, etc.)
          const statusMap: Record<string, string> = {
            pending: 'قيد الانتظار',
            with_rep: 'مع المندوب',
            delivered: 'تم التسليم',
            returned: 'مرتجع',
            cancelled: 'ملغي',
            canceled: 'ملغي',
            postponed: 'مؤجل',
            no_answer: 'لم يرد'
          };
          const statusLabel = statusMap[sysOrder.status] || sysOrder.status;
          Swal.fire({
            icon: 'info',
            title: 'حالة الأوردر غير مطابقة',
            text: `الأوردر رقم #${cleanCode} موجود في النظام وحالته الحالية: "${statusLabel}" وليس في عهدة المندوب المفتوح.`,
            confirmButtonText: 'حسناً'
          });
          setScanInput('');
          return;
        }
      }
    } catch (e) {
      console.debug('Order lookup error', e);
    }

    // 3. Third priority: Product barcode match across rep's orders
    const productMatches = (openRepOrders?.orders || []).filter((o: any) => {
      return (o.products || []).some((p: any) => {
        const pCode = cleanBarcode(p.barcode || p.barcode_value || p.code || p.sku || p.product_barcode || '').toLowerCase();
        return pCode && pCode === cleanCode.toLowerCase();
      });
    });

    if (productMatches.length > 0) {
      const ids = productMatches.map((m: any) => m.id);
      setSelectedOrderIds(prev => Array.from(new Set([...prev, ...ids])));
      setScannedBarcodes(prev => [{ code: raw, orderId: ids[0] }, ...prev]);
      Swal.fire({
        toast: true,
        position: 'top-end',
        icon: 'info',
        title: 'تطابق باركود صنف',
        text: `تم تحديد ${ids.length} أوردر يحتوي على هذا الصنف`,
        timer: 1800,
        showConfirmButton: false
      });
    } else {
      setScannedBarcodes(prev => [{ code: raw, orderId: undefined }, ...prev]);
      Swal.fire({
        toast: true,
        position: 'top-end',
        icon: 'warning',
        title: 'لم يتم العثور على أوردر',
        text: `لا يوجد أوردر أو صنف مطابق للباركود: ${raw}`,
        timer: 2000,
        showConfirmButton: false
      });
    }
    setScanInput('');
  };

  // Counts for daily status tabs
  const repCounts = useMemo(() => {
    let openCount = 0;
    let closedCount = 0;
    repsSummary.forEach((r: any) => {
      if (Number(r.has_open_daily) === 1) openCount++;
      else closedCount++;
    });
    return { all: repsSummary.length, open: openCount, closed: closedCount };
  }, [repsSummary]);

  // Filtered reps based on dailyFilter
  const filteredReps = useMemo(() => {
    return repsSummary.filter((r: any) => {
      if (isShippingMode) return true;
      const isOpen = Number(r.has_open_daily) === 1;
      if (dailyFilter === 'open' && !isOpen) return false;
      if (dailyFilter === 'closed' && isOpen) return false;
      return true;
    });
  }, [repsSummary, dailyFilter, isShippingMode]);

  const repSelectOptions = useMemo(() => {
    return filteredReps.map((r: any) => {
      const isOpen = Number(r.has_open_daily) === 1;
      return {
        value: String(r.repId),
        searchLabel: `${r.name || ''} ${r.repId} ${r.open_daily_code || ''}`,
        label: (
          <div className="flex items-center justify-between gap-2 w-full py-0.5">
            <div className="flex items-center gap-2 min-w-0">
              {!isShippingMode && (
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${isOpen ? 'bg-emerald-500 ring-2 ring-emerald-300 dark:ring-emerald-900 animate-pulse' : 'bg-slate-300 dark:bg-slate-600'}`} />
              )}
              <span className="font-bold truncate text-slate-800 dark:text-slate-200">{r.name || ((isShippingMode ? 'شركة شحن #' : 'مندوب #') + r.repId)}</span>
              <span className="text-[10px] text-slate-400 font-mono">#{r.repId}</span>
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              {!isShippingMode && (
                isOpen ? (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                    {r.open_daily_code || 'مفتوحة'}
                  </span>
                ) : (
                  <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 border border-slate-200 dark:border-slate-700">
                    مغلقة
                  </span>
                )
              )}
              {r.ordersCount > 0 && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                  {r.ordersCount} أوردر
                </span>
              )}
            </div>
          </div>
        )
      };
    });
  }, [filteredReps, isShippingMode]);

  const displayedReps = filteredReps;

  return (
    <div className="p-4 rounded-2xl border border-card dir-rtl card" style={{ backgroundColor: 'var(--card-bg)', color: 'var(--text)' }}>

      {/* Hidden Print Container for print output. Choose single-per-page for shipping labels. */}
      {ordersToPrint && (printSinglePerPage ? <PrintableOrdersSingle orders={ordersToPrint} /> : <PrintableOrders orders={ordersToPrint} />)}

      {/* Page Title & Main Filter/Selector Panel */}
      <div className="mb-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-black text-lg text-slate-800 dark:text-slate-100">تسجيل المرتجعات</h2>
        </div>

        {/* Rep & Daily Filter Panel */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 shadow-sm space-y-3">
          {/* Top row: Header & Daily status tabs */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <span className="text-xs font-black text-slate-800 dark:text-slate-200">
                {isShippingMode ? 'تصفية واختيار شركة الشحن' : 'تصفية واختيار المندوب'}
              </span>
            </div>

            {/* Daily status filter tabs: الكل / يومية مفتوحة / يومية مغلقة */}
            {!isShippingMode && (
              <div className="inline-flex rounded-xl bg-slate-100 dark:bg-slate-800/90 p-1 border border-slate-200/70 dark:border-slate-700/70">
                <button
                  type="button"
                  onClick={() => setDailyFilter('all')}
                  className={`px-3 py-1 rounded-lg text-xs font-black transition-all flex items-center gap-1.5 ${
                    dailyFilter === 'all'
                      ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-sm'
                      : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  <span>الكل</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${dailyFilter === 'all' ? 'bg-indigo-50 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'}`}>
                    {repCounts.all}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setDailyFilter('open')}
                  className={`px-3 py-1 rounded-lg text-xs font-black transition-all flex items-center gap-1.5 ${
                    dailyFilter === 'open'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'text-slate-500 hover:text-emerald-600 dark:hover:text-emerald-400'
                  }`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span>يومية مفتوحة</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${dailyFilter === 'open' ? 'bg-emerald-700 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'}`}>
                    {repCounts.open}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setDailyFilter('closed')}
                  className={`px-3 py-1 rounded-lg text-xs font-black transition-all flex items-center gap-1.5 ${
                    dailyFilter === 'closed'
                      ? 'bg-slate-800 text-white dark:bg-slate-600 shadow-sm'
                      : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  <span>يومية مغلقة</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${dailyFilter === 'closed' ? 'bg-slate-900 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'}`}>
                    {repCounts.closed}
                  </span>
                </button>
              </div>
            )}
          </div>

          {/* Middle row: CustomSelect only */}
          <div className="pt-1">
            <CustomSelect
              value={selectedRepId}
              onChange={handleSelectRep}
              options={repSelectOptions}
              placeholder={
                filteredReps.length === 0
                  ? (dailyFilter === 'open' ? '— لا يوجد مناديب بيومية مفتوحة —' : '— لا توجد نتائج مطابقة —')
                  : `— اختر ${isShippingMode ? 'شركة الشحن' : 'المندوب'} (${filteredReps.length} متاح) —`
              }
              disabled={loading}
            />
          </div>
        </div>
      </div>

      {loading ? <div className="text-sm text-slate-500">جاري التحميل...</div> : (
        <div>
          {displayedReps.length === 0 ? (
            <div className="p-4 rounded-xl border border-amber-200 bg-amber-50 text-amber-900">
              <p className="font-black mb-1">لا توجد بيانات متاحة في هذا العرض.</p>
              <p className="text-sm">
                {isShippingMode
                  ? 'تم منحك صلاحية عرض صفحة تسجيل المرتجعات فقط، ولم يتم العثور على شركات شحن أو بيانات متاحة ضمن صلاحياتك الحالية.'
                  : 'تم منحك صلاحية عرض صفحة تسجيل المرتجعات فقط، ولم يتم العثور على مندوبين أو بيانات متاحة ضمن صلاحياتك الحالية.'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {displayedReps.map((rep: any) => (
                <div key={rep.repId} className={`p-3 border rounded-xl flex justify-between items-center transition-all ${selectedRepId === String(rep.repId) ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/20 shadow-sm ring-1 ring-indigo-500' : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700'}`}>
                  <div>
                    <div className="flex items-center gap-2">
                      {!isShippingMode && (
                        <span className={`w-2 h-2 rounded-full ${Number(rep.has_open_daily) === 1 ? 'bg-emerald-500 ring-2 ring-emerald-300 dark:ring-emerald-900 animate-pulse' : 'bg-slate-400'}`} />
                      )}
                      <span className="font-bold text-slate-800 dark:text-slate-100">{rep.name || ((isShippingMode ? 'شركة شحن #' : 'مندوب #') + rep.repId)}</span>
                      {!isShippingMode && (
                        Number(rep.has_open_daily) === 1 ? (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                            {rep.open_daily_code || 'يومية مفتوحة'}
                          </span>
                        ) : (
                          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 border border-slate-200 dark:border-slate-700">
                            مغلقة
                          </span>
                        )
                      )}
                    </div>
                    <div className="text-xs text-slate-500 mt-1">عدد الاوردرات: <span className="font-black text-slate-800 dark:text-slate-200">{rep.ordersCount}</span> — عدد المنتجات: <span className="font-black text-slate-800 dark:text-slate-200">{rep.productsCount}</span></div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {/* rep balance hidden by request */}
                    <button onClick={() => openOrdersForRep(rep)} className="bg-indigo-600 text-white px-3 py-2 rounded-lg text-xs font-bold hover:bg-indigo-700 transition-colors shadow-sm">عرض الاوردرات</button>
                    {SHOW_ACTION_BUTTONS && (
                      <>
                        <button onClick={() => { (async () => { const ords = await fetchOrdersForRep(rep.repId); printDailyDocument(ords); })(); }} className="bg-amber-500 text-white px-3 py-2 rounded-lg text-xs font-bold hover:bg-amber-600 transition-colors">عرض اليومية</button>
                        <button onClick={() => { (async () => { const ords = await fetchOrdersForRep(rep.repId); printDeliveryNote(ords); })(); }} className="bg-emerald-600 text-white px-3 py-2 rounded-lg text-xs font-bold hover:bg-emerald-700 transition-colors">أذن التسليم</button>
                        <button onClick={() => { (async () => { const ords = await fetchOrdersForRep(rep.repId); printShippingLabelsNew(ords); })(); }} className="bg-sky-600 text-white px-3 py-2 rounded-lg text-xs font-bold hover:bg-sky-700 transition-colors">طباعة بوالص الشحن فقط</button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modal for rep orders */}
      {openRepOrders && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="rounded-2xl w-full max-w-4xl p-6 shadow-2xl flex flex-col max-h-[90vh] card border border-card" style={{ backgroundColor: 'var(--card-bg)', color: 'var(--text)' }}>
            <div className="flex justify-between items-center mb-4 border-b pb-3">
              <h3 className="font-black text-lg">{isShippingMode ? 'اوردرات شركة الشحن' : 'اوردرات المندوب'}: {openRepOrders.name}</h3>
              <div className="flex items-center gap-2">
                <button onClick={() => setIsBarcodeModalOpen(true)} className="px-3 py-1.5 rounded-lg bg-purple-600 text-white text-xs font-bold hover:bg-purple-700">مسح بالباركود</button>
                <button onClick={() => { const sels = (openRepOrders.orders || []).map((o: any) => o.id); setSelectedOrderIds(sels); }} className="px-3 py-1.5 rounded-lg bg-slate-100 text-xs font-bold hover:bg-slate-200">تحديد الكل</button>
                <button onClick={() => { setSelectedOrderIds([]); }} className="px-3 py-1.5 rounded-lg bg-slate-100 text-xs font-bold hover:bg-slate-200">إلغاء التحديد</button>
                <button onClick={() => setOpenRepOrders(null)} className="px-3 py-1.5 rounded-lg bg-red-100 text-red-600 text-xs font-bold hover:bg-red-200">إغلاق</button>
              </div>
            </div>

            {/* Summary removed from orders modal per user request; kept in printable report only */}
            <div className="flex-1 overflow-y-auto mb-4 space-y-2 pr-2">
              {(openRepOrders.orders || []).map((o: any) => {
                const piecesCount = (o.products || []).reduce((s: number, p: any) => s + Number(p.quantity || p.qty || 0), 0);
                return (
                  <div key={o.id} className={`flex items-center justify-between p-3 border rounded-xl hover:bg-slate-50 transition-colors ${selectedOrderIds.includes(o.id) ? 'border-blue-500 bg-blue-50/30' : 'border-slate-200'}`}>
                    <label className="flex items-center gap-3 flex-1 cursor-pointer">
                      <input type="checkbox" className="w-5 h-5 rounded text-blue-600 focus:ring-blue-500" checked={selectedOrderIds.includes(o.id)} onChange={() => toggleSelectOrder(o.id)} />
                      <div className="flex-1">
                        <div className="flex justify-between items-center">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-800">#{o.orderNumber || o.order_number} — {o.customerName || o.customer_name}</span>
                            {String(o.status || '').toLowerCase() === 'returned_with_rep' && (
                              <span className="text-[10px] font-bold bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full border border-orange-200">
                                مرتجع جزئي مع المندوب
                              </span>
                            )}
                            {String(o.status || '').toLowerCase() === 'exchange' && (
                              <span className="text-[10px] font-bold bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full border border-purple-200">
                                استبدال
                              </span>
                            )}
                          </div>
                          <div className="font-bold text-blue-600">{computeOrderSubtotal(o).toLocaleString()} ج.م</div>
                        </div>
                        <div className="text-xs text-slate-500 mt-1 flex gap-4">
                          <span>عدد القطع المتبقية: {(o.products || []).reduce((s: number, p: any) => s + Number(p.quantity || p.qty || 0), 0)}</span>
                          <span>المتبقي: {Number(o.remainingPieces || 0)}</span>
                          <span>المحافظة: {o.governorate}</span>
                          <span>الحالة: {translateStatus(o.status)}</span>
                        </div>
                      </div>
                    </label>

                    <div className="flex items-center gap-2 ml-3">
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); openExchangeModal(o); }}
                        className="px-3 py-1.5 rounded-lg bg-amber-600 text-white text-xs font-bold hover:bg-amber-700 flex items-center gap-1 shadow-sm transition-colors"
                        title="استبدال منتج من هذا الطلب"
                      >
                        <ArrowLeftRight size={13} />
                        <span>استبدال</span>
                      </button>

                      {(piecesCount > 1 || String(o.status || '').toLowerCase() === 'returned_with_rep') && (
                        <button onClick={(e) => { e.stopPropagation(); openPartialEditor(o); }} className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700">ارتجاع جزئي</button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="pt-4 border-t flex flex-wrap gap-2 justify-end">
              {/* Barcode scanning modal (opened by header button) */}
              {isBarcodeModalOpen && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
                  <div className="rounded-2xl w-full max-w-xl p-6 shadow-2xl card border border-card" style={{ backgroundColor: 'var(--card-bg)', color: 'var(--text)' }}>
                    <div className="flex justify-between items-center mb-3">
                      <h4 className="font-bold">مسح باركود — امسح بوليصة الشحن أو باركود المنتج لاختيار الأوردر</h4>
                      <button onClick={() => { setIsBarcodeModalOpen(false); setScanInput(''); }} className="text-red-600">إغلاق</button>
                    </div>
                    <div className="mb-3">
                      <p className="text-sm text-slate-500">امسح باركود بوليصة الشحن (رقم الأوردر) لاختيار الأوردر مباشرة، أو امسح باركود الصنف لتحديد الأوردرات التي تحتوي عليه.</p>
                    </div>
                    <div className="flex gap-2 mb-3">
                      <input
                        autoFocus
                        value={scanInput}
                        onChange={e => setScanInput(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleBarcodeScan();
                          }
                        }}
                        className="w-full border rounded p-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        placeholder="امسح باركود الأوردر أو الصنف هنا..."
                      />
                      <button onClick={handleBarcodeScan} className="px-4 py-2 bg-blue-600 text-white rounded font-bold hover:bg-blue-700">تحقق</button>
                    </div>

                    <div className="max-h-48 overflow-y-auto border rounded p-2">
                      <h5 className="font-bold text-sm mb-2">الباركودات الممسوحة حديثاً</h5>
                      {scannedBarcodes.length === 0 ? <div className="text-sm text-slate-500">لا توجد عمليات مسح بعد.</div> : (
                        <div className="space-y-2">
                          {scannedBarcodes.map((s, idx) => (
                            <div key={idx} className="flex items-center justify-between border-b py-1">
                              <div className="text-right">
                                <div className="font-bold">{s.code}</div>
                                <div className="text-xs text-slate-500">{s.orderId ? `مطابقة للاوردر #${s.orderId}` : 'لم يتم العثور على تطابق'}</div>
                              </div>
                              <div className="flex gap-2">
                                {s.orderId && <button onClick={() => { setSelectedOrderIds(prev => prev.includes(s.orderId!) ? prev.filter(x => x !== s.orderId) : [...prev, s.orderId!]); }} className="px-2 py-1 text-xs bg-slate-100 rounded">تبديل اختيار</button>}
                                <button onClick={() => setScannedBarcodes(prev => prev.filter((_, i) => i !== idx))} className="px-2 py-1 text-xs bg-red-100 text-red-600 rounded">حذف</button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex justify-end gap-2 mt-4">
                      <button onClick={handleReturnSelected} className="px-4 py-2 bg-rose-600 text-white rounded">تم</button>
                      <button onClick={() => { setIsBarcodeModalOpen(false); setScanInput(''); }} className="px-4 py-2 bg-slate-100 rounded">إغلاق</button>
                    </div>
                  </div>
                </div>
              )}

              <div className="w-px bg-slate-300 mx-2"></div>


              <button onClick={handleReturnSelected} className="px-5 py-2.5 bg-rose-600 text-white rounded-xl font-bold shadow-lg hover:bg-rose-700">مرتجع كلي</button>


            </div>

            {/* Partial-delivery editor modal */}
            {openPartialOrder && (
              <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-60">
                <div className="rounded-xl w-full max-w-2xl p-4 shadow-xl card border border-card" style={{ backgroundColor: 'var(--card-bg)', color: 'var(--text)' }}>
                  <div className="flex justify-between items-center mb-3">
                    <h4 className="font-bold">ارتجاع جزئي للطلب: #{openPartialOrder.orderNumber || openPartialOrder.order_number}</h4>
                    <button onClick={() => { setOpenPartialOrder(null); setPartialProducts([]); setPartialWarehouse(undefined); }} className="text-red-600">إغلاق</button>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    {/* Left: Return items (what will be returned) */}
                    <div className="border rounded p-3 max-h-80 overflow-y-auto">
                      <h5 className="font-bold mb-2">فاتورة المرتجع</h5>
                      {returnItems.length === 0 ? (
                        <div className="text-sm text-slate-500">لم يتم اختيار أي قطعة للمرتجع بعد. اضغط "ارتجاع قطعة" على اليمين لإضافتها.</div>
                      ) : (
                        <div className="space-y-2">
                          {returnItems.map((ri, i) => (
                            <div key={ri.lineId || (ri.productId + '-' + i)} className="flex items-center justify-between gap-2 border-b py-2">
                              <div className="flex-1 text-right">
                                <div className="font-bold">{ri.name}</div>
                                <div className="text-xs text-slate-500">{ri.color ? `اللون: ${ri.color}` : ''} {ri.size ? ` — المقاس: ${ri.size}` : ''}</div>
                                <div className="text-xs text-slate-500">معرّف السطر: {ri.lineId} — معرّف المنتج: {ri.productId}</div>
                              </div>
                              <div className="w-28 flex items-center gap-2">
                                <input type="number" min={1} value={ri.quantity} onChange={e => {
                                  const v = Math.max(1, Number(e.target.value || 0));
                                  setReturnItems(prev => prev.map((x, idx) => idx === i ? { ...x, quantity: v } : x));
                                }} className="w-16 border rounded p-1 text-center" />
                                <button onClick={() => setReturnItems(prev => prev.filter((_, idx) => idx !== i))} className="px-2 py-1 text-xs bg-red-100 text-red-600 rounded">حذف</button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="mt-3">
                        <label className="block text-sm font-bold mb-1">مستودع الإرجاع (مطلوب)</label>
                        {warehouses && warehouses.length > 0 ? (
                          <CustomSelect
                            value={partialWarehouse ? String(partialWarehouse) : ''}
                            onChange={v => setPartialWarehouse(v ? Number(v) : undefined)}
                            options={warehouses.map((w: any) => ({ value: String(w.id), label: w.name || w.title || ('المستودع ' + w.id) }))}
                          />
                        ) : (
                          <div className="text-sm text-rose-600">لا توجد مستودعات معرّفة. تعذّر اتمام المرتجع.</div>
                        )}
                      </div>

                      <div className="flex justify-end gap-2 mt-4">
                        <button onClick={() => { setOpenPartialOrder(null); setPartialProducts([]); setReturnItems([]); setPartialWarehouse(undefined); }} className="px-4 py-2 bg-slate-100 rounded">إلغاء</button>
                        <button onClick={() => submitPartialReturn()} className="px-4 py-2 bg-rose-600 text-white rounded">تنفيذ المرتجع</button>
                      </div>
                    </div>

                    {/* Right: Original order and products */}
                    <div className="border rounded p-3 max-h-80 overflow-y-auto">
                      <h5 className="font-bold mb-2">الاوردر — #{openPartialOrder.orderNumber || openPartialOrder.order_number}</h5>
                      <div className="text-sm text-slate-500 mb-2">العميل: {openPartialOrder.customerName || openPartialOrder.customer_name}</div>
                      <div className="space-y-2">
                        {partialProducts.map((p: any, idx: number) => {
                          const existing = returnItems.find(r => String(r.lineId) === String(p.lineId));
                          const maxQty = Number(p.qtyOriginal || 0);
                          return (
                            <div key={p.productId + '-' + idx} className="flex items-center justify-between gap-3 border-b py-2">
                              <div className="flex-1 text-right">
                                <div className="font-bold">{p.name}</div>
                                <div className="text-xs text-slate-500">{p.color ? `اللون: ${p.color}` : ''} {p.size ? ` — المقاس: ${p.size}` : ''}</div>
                                <div className="text-xs text-slate-500">الكمية المتاحة: {maxQty} — السعر: {p.price}</div>
                              </div>
                              <div className="flex items-center gap-2">
                                <button disabled={existing && existing.quantity >= maxQty} onClick={() => {
                                  setReturnItems(prev => {
                                    // each product line is distinct — use lineId to identify
                                    const foundIdx = prev.findIndex(x => String(x.lineId) === String(p.lineId));
                                    if (foundIdx === -1) return [{ lineId: p.lineId, orderItemId: p.orderItemId, productId: Number(p.productId), name: p.name || '', color: p.color || '', size: p.size || '', quantity: 1 }, ...prev];
                                    return prev.map((x, i) => i === foundIdx ? { ...x, quantity: Math.min(maxQty, Number(x.quantity || 0) + 1) } : x);
                                  });
                                }} className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700">ارتجاع قطعة</button>
                                <button onClick={() => {
                                  // remove from return items if exists
                                  setReturnItems(prev => prev.filter(x => Number(x.productId) !== Number(p.productId)));
                                }} className="px-2 py-1 text-xs bg-slate-100 rounded">إلغاء</button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Exchange Modal (نافذة استبدال الأصناف) */}
            {openExchangeOrder && (
              <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 z-[70] animate-fadeIn">
                <div className="rounded-2xl w-full max-w-4xl p-5 shadow-2xl card border border-slate-200 dark:border-slate-800 flex flex-col max-h-[92vh] overflow-hidden" style={{ backgroundColor: 'var(--card-bg, #ffffff)', color: 'var(--text, #0f172a)' }}>
                  
                  {/* Modal Header */}
                  <div className="flex justify-between items-center pb-3 border-b border-slate-200 dark:border-slate-800">
                    <div className="flex items-center gap-2">
                      <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
                        <ArrowLeftRight size={22} />
                      </div>
                      <div>
                        <h4 className="font-black text-base text-slate-800 dark:text-white">
                          استبدال صنف للطلب: #{openExchangeOrder.orderNumber || openExchangeOrder.order_number}
                        </h4>
                        <div className="text-xs text-slate-500 mt-0.5">
                          العميل: <span className="font-bold text-slate-700 dark:text-slate-300">{openExchangeOrder.customerName || openExchangeOrder.customer_name}</span> | المندوب: <span className="font-bold text-slate-700 dark:text-slate-300">{openRepOrders?.name || '—'}</span>
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => { setOpenExchangeOrder(null); setExchangeOldItem(null); setExchangeTargetVariantId(null); }}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    >
                      <X size={20} />
                    </button>
                  </div>

                  {/* Warehouse Selector Banner */}
                  <div className="py-2.5 px-3 bg-amber-50/70 dark:bg-amber-950/20 border-b border-amber-200 dark:border-amber-900/40 flex flex-wrap items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2 flex-1 min-w-[260px]">
                      <span className="font-bold text-amber-900 dark:text-amber-200 whitespace-nowrap">مستودع استلام الصنف المرتجع (مطلوب):</span>
                      <div className="w-64">
                        <CustomSelect
                          value={exchangeWarehouse ? String(exchangeWarehouse) : ''}
                          onChange={v => {
                            const wid = v ? Number(v) : undefined;
                            setExchangeWarehouse(wid);
                            if (wid) loadExchangeCatalog(wid);
                          }}
                          options={warehouses.map((w: any) => ({ value: String(w.id), label: w.name || w.title || ('المستودع ' + w.id) }))}
                        />
                      </div>
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">
                      * يدخل المنتج المرتجع من العميل إلى هذا المستودع وتُسجل حركته تلقائياً.
                    </div>
                  </div>

                  {/* Modal Body - 2 Columns */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-1 overflow-y-auto flex-1 custom-scrollbar my-3">
                    
                    {/* Column 1: Delivered Item Selection */}
                    <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-3 flex flex-col bg-slate-50/50 dark:bg-slate-900/30">
                      <div className="flex justify-between items-center mb-2.5">
                        <span className="font-black text-xs text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                          <span className="w-5 h-5 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-[11px]">1</span>
                          <span>المنتج المُسلَّم للعميل (المطلوب في هذا الطلب):</span>
                        </span>
                        {exchangeOldItem && (
                          <span className="text-[11px] font-bold text-amber-600 bg-amber-100 dark:bg-amber-900/40 px-2 py-0.5 rounded-full">
                            محدد للتسليم
                          </span>
                        )}
                      </div>

                      <div className="space-y-2 flex-1 overflow-y-auto max-h-72 pr-1 custom-scrollbar">
                        {(openExchangeOrder.products || []).map((p: any, idx: number) => {
                          const pId = Number(p.productId || p.product_id || p.id || 0);
                          const lineId = p.line_id ?? p.lineId ?? `${openExchangeOrder.id}-${idx}`;
                          const isSelected = exchangeOldItem?.lineId === lineId;
                          const maxQty = Number(p.quantity || p.qty || 1);

                          return (
                            <div
                              key={lineId}
                              onClick={() => {
                                setExchangeOldItem({
                                  lineId,
                                  orderItemId: p.id || p.order_item_id,
                                  productId: pId,
                                  name: p.name || '',
                                  color: (p.color ?? p.variant_color ?? p.variant ?? p.colorName) || '',
                                  size: (p.size ?? p.variant_size ?? p.measure ?? p.sizeName) || '',
                                  price: Number(p.price || p.sale_price || p.price_per_unit || 0),
                                  maxQty,
                                  exchangeQty: isSelected ? (exchangeOldItem?.exchangeQty ?? 1) : 1
                                });
                                setExchangeTargetVariantId(null);
                              }}
                              className={`p-2.5 rounded-xl border transition-all cursor-pointer ${
                                isSelected 
                                  ? 'border-amber-500 bg-amber-50 dark:bg-amber-950/30 shadow-sm' 
                                  : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300'
                              }`}
                            >
                              <div className="flex justify-between items-start">
                                <div>
                                  <div className="font-bold text-xs text-slate-800 dark:text-white">{p.name}</div>
                                  <div className="text-[11px] text-slate-500 mt-0.5">
                                    {p.color && <span>اللون: <b className="text-slate-700 dark:text-slate-300">{p.color}</b></span>}
                                    {p.size && <span className="mr-2">المقاس: <b className="text-slate-700 dark:text-slate-300">{p.size}</b></span>}
                                  </div>
                                </div>
                                <div className="text-left font-black text-xs text-slate-700 dark:text-slate-200">
                                  {Number(p.price || p.sale_price || p.price_per_unit || 0).toLocaleString()} ج.م
                                </div>
                              </div>

                              <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs">
                                <span className="text-[11px] text-slate-500">الكمية بالطلب: <b>{maxQty}</b> قطعة</span>
                                {isSelected ? (
                                  <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
                                    <span className="text-[11px] font-bold text-amber-700 dark:text-amber-300">الكمية:</span>
                                    <input
                                      type="number"
                                      min={1}
                                      max={maxQty}
                                      value={exchangeOldItem?.exchangeQty ?? 1}
                                      onChange={e => {
                                        const v = Math.max(1, Math.min(maxQty, Number(e.target.value || 1)));
                                        setExchangeOldItem(prev => prev ? { ...prev, exchangeQty: v } : null);
                                      }}
                                      className="w-14 px-1.5 py-0.5 text-center text-xs font-black rounded border border-amber-400 bg-white dark:bg-slate-900 focus:outline-none"
                                    />
                                  </div>
                                ) : (
                                  <span className="text-[10px] text-blue-600 font-bold hover:underline">اضغط للتحديد</span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Column 2: Returned Item Selection */}
                    <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-3 flex flex-col bg-slate-50/50 dark:bg-slate-900/30">
                      <div className="flex justify-between items-center mb-2.5">
                        <span className="font-black text-xs text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                          <span className="w-5 h-5 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-[11px]">2</span>
                          <span>المنتج المرتجع المستلم من العميل (يدخل المخزن):</span>
                        </span>
                      </div>

                      {/* Mode Toggle Buttons */}
                      <div className="grid grid-cols-2 gap-1.5 bg-slate-200 dark:bg-slate-800 p-1 rounded-xl mb-3 text-xs font-bold">
                        <button
                          type="button"
                          onClick={() => {
                            setExchangeMode('same_product');
                            setExchangeTargetVariantId(null);
                            setExchangeCustomPrice('');
                          }}
                          className={`py-1.5 px-2 rounded-lg transition-all ${
                            exchangeMode === 'same_product'
                              ? 'bg-white dark:bg-slate-900 text-amber-600 dark:text-amber-400 shadow-sm'
                              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                          }`}
                        >
                          🔄 نفس نوع المنتج
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setExchangeMode('other_product');
                            setExchangeTargetVariantId(null);
                            setExchangeCustomPrice('');
                          }}
                          className={`py-1.5 px-2 rounded-lg transition-all ${
                            exchangeMode === 'other_product'
                              ? 'bg-white dark:bg-slate-900 text-amber-600 dark:text-amber-400 shadow-sm'
                              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                          }`}
                        >
                          ✨ منتج آخر مختلف
                        </button>
                      </div>

                      {/* Mode Content */}
                      <div className="flex-1 overflow-y-auto max-h-72 pr-1 custom-scrollbar">
                        {exchangeLoadingCatalog ? (
                          <div className="flex items-center justify-center py-10 gap-2 text-slate-400 text-xs">
                            <Loader2 className="animate-spin" size={16} />
                            <span>جاري التحميل...</span>
                          </div>
                        ) : exchangeMode === 'same_product' ? (
                          <div>
                            <div className="text-xs text-slate-600 dark:text-slate-400 mb-2 font-bold flex items-center justify-between">
                              <span>المقاسات والألوان للصنف المرتجع:</span>
                              <span className="text-[11px] text-amber-600 font-normal">
                                {currentParentProduct?.name || exchangeOldItem?.name || ''}
                              </span>
                            </div>

                            {currentAvailableVariants.length === 0 ? (
                              <div className="text-center py-6 text-xs text-slate-400">
                                لم يتم العثور على خيارات أخرى لنفس المنتج في النظام.
                              </div>
                            ) : (
                              <div className="grid grid-cols-2 gap-2">
                                {currentAvailableVariants.map((v: any) => {
                                  const isSelected = Number(v.id) === Number(exchangeTargetVariantId);
                                  const stock = Number(v.total_stock ?? v.stock ?? 0);

                                  return (
                                    <div
                                      key={v.id}
                                      onClick={() => {
                                        setExchangeTargetVariantId(Number(v.id));
                                        setExchangeCustomPrice(String(Number(v.sale_price ?? v.price ?? 0)));
                                      }}
                                      className={`p-2.5 rounded-xl border text-xs transition-all relative cursor-pointer ${
                                        isSelected
                                          ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 shadow-sm'
                                          : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-amber-300'
                                      }`}
                                    >
                                      <div className="flex justify-between items-start mb-1">
                                        <span className="font-bold text-slate-800 dark:text-white">
                                          {v.size || 'بدون مقاس'} — {v.color || 'افتراضي'}
                                        </span>
                                        {isSelected && (
                                          <span className="w-4 h-4 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px]">
                                            ✓
                                          </span>
                                        )}
                                      </div>

                                      <div className="flex items-center justify-between text-[11px] mt-1.5">
                                        <span className="font-black text-slate-700 dark:text-slate-300">
                                          {Number(v.sale_price || v.price || 0).toLocaleString()} ج.م
                                        </span>
                                        <span className="text-[10px] text-slate-400">
                                          (مخزون: {stock})
                                        </span>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div>
                            <div className="mb-2">
                              <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                                ابحث واختر الصنف المرتجع من العميل:
                              </label>
                              <div className="relative mb-2">
                                <Search size={14} className="absolute right-2.5 top-2.5 text-slate-400" />
                                <input
                                  type="text"
                                  placeholder="اكتب اسم المنتج للبحث..."
                                  value={exchangeProductSearch}
                                  onChange={e => setExchangeProductSearch(e.target.value)}
                                  className="w-full pl-3 pr-8 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:outline-none focus:ring-1 focus:ring-amber-500"
                                />
                              </div>

                              <div className="max-h-28 overflow-y-auto border border-slate-200 dark:border-slate-800 rounded-lg divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900 text-xs">
                                {exchangeProductsCatalog
                                  .filter((p: any) => !exchangeProductSearch || (p.name || '').toLowerCase().includes(exchangeProductSearch.toLowerCase()))
                                  .slice(0, 15)
                                  .map((p: any) => {
                                    const isPSelected = Number(p.id) === Number(exchangeTargetProductId);
                                    const pMinPrice = (p.variants || []).reduce((min: number, v: any) => Math.min(min, Number(v.sale_price ?? v.price ?? 0)), Infinity);
                                    return (
                                      <div
                                        key={p.id}
                                        onClick={() => {
                                          setExchangeTargetProductId(Number(p.id));
                                          setExchangeTargetVariantId(null);
                                          setExchangeCustomPrice('');
                                        }}
                                        className={`p-2 flex items-center justify-between cursor-pointer transition-colors ${
                                          isPSelected ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-800 font-bold' : 'hover:bg-slate-50 dark:hover:bg-slate-800'
                                        }`}
                                      >
                                        <div className="flex items-center gap-2">
                                          <span>{p.name}</span>
                                          <span className="text-[10px] text-slate-400">({(p.variants || []).length} خيارات)</span>
                                        </div>
                                        <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300">
                                          {pMinPrice !== Infinity && pMinPrice > 0 ? `${pMinPrice.toLocaleString()} ج.م` : '0 ج.م'}
                                        </span>
                                      </div>
                                    );
                                  })}
                              </div>
                            </div>

                            {selectedOtherParentProduct && (
                              <div className="mt-3">
                                <div className="text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1.5">
                                  اختر اللون والمقاس لمنتج: <span className="text-amber-600 font-bold">{selectedOtherParentProduct.name}</span>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                  {(selectedOtherParentProduct.variants || []).map((v: any) => {
                                    const isSelected = Number(v.id) === Number(exchangeTargetVariantId);
                                    const stock = Number(v.total_stock ?? v.stock ?? 0);

                                    return (
                                      <div
                                        key={v.id}
                                        onClick={() => {
                                          setExchangeTargetVariantId(Number(v.id));
                                          setExchangeCustomPrice(String(Number(v.sale_price ?? v.price ?? 0)));
                                        }}
                                        className={`p-2.5 rounded-xl border text-xs transition-all relative cursor-pointer ${
                                          isSelected
                                            ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 shadow-sm'
                                            : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-amber-300'
                                        }`}
                                      >
                                        <div className="flex justify-between items-start mb-1">
                                          <span className="font-bold text-slate-800 dark:text-white">
                                            {v.size || 'بدون مقاس'} — {v.color || 'افتراضي'}
                                          </span>
                                          {isSelected && (
                                            <span className="w-4 h-4 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px]">
                                              ✓
                                            </span>
                                          )}
                                        </div>

                                        <div className="flex items-center justify-between text-[11px] mt-1.5">
                                          <span className="font-black text-slate-700 dark:text-slate-300">
                                            {Number(v.sale_price || v.price || 0).toLocaleString()} ج.م
                                          </span>
                                          <span className="text-[10px] text-slate-400">
                                            (مخزون: {stock})
                                          </span>
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

                      {/* Editable Price Box for Selected Variant */}
                      {selectedNewVariant && (
                        <div className="mt-3 p-3 rounded-xl bg-amber-500/10 border border-amber-300 dark:border-amber-700/60 shadow-sm animate-fadeIn">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-black text-amber-900 dark:text-amber-200">
                                  سعر تقييم الصنف المرتجع:
                                </span>
                              </div>
                              <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-1">
                                <span>السعر المسجل بالنظام:</span>
                                <span className="font-bold text-slate-700 dark:text-slate-200">
                                  {Number(selectedNewVariant.sale_price ?? selectedNewVariant.price ?? 0).toLocaleString()} ج.م
                                </span>
                                <span className="text-[10px] text-slate-400">(يمكنك تعديل السعر في الخانة المجاورة)</span>
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              <div className="relative w-36">
                                <input
                                  type="number"
                                  step="any"
                                  min="0"
                                  value={exchangeCustomPrice}
                                  onChange={e => setExchangeCustomPrice(e.target.value)}
                                  className="w-full pl-8 pr-3 py-1.5 text-sm font-black text-slate-900 dark:text-white bg-white dark:bg-slate-900 border-2 border-amber-500 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 text-center shadow-inner"
                                  placeholder="0"
                                />
                                <span className="absolute left-2.5 top-2 text-[11px] text-slate-400 font-bold pointer-events-none">ج.م</span>
                              </div>
                              <button
                                type="button"
                                onClick={() => setExchangeCustomPrice(String(Number(selectedNewVariant.sale_price ?? selectedNewVariant.price ?? 0)))}
                                className="px-2.5 py-1.5 text-[10px] font-bold rounded-lg bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 transition-colors whitespace-nowrap shadow-sm"
                                title="استعادة السعر المسجل بقاعدة البيانات"
                              >
                                استعادة المسجل
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Summary & Price Difference Footer */}
                  <div className="pt-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 rounded-xl p-3">
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 text-xs mb-3">
                      <div className="p-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                        <span className="text-[10px] text-slate-500 block">المسلَّم للعميل (الجديد):</span>
                        <span className="font-black text-sm text-slate-800 dark:text-white">
                          {exchangeDeliveredTotal.toLocaleString()} ج.م
                        </span>
                        <span className="text-[9px] text-slate-400 block mt-0.5">
                          ({exchangeOldItem?.exchangeQty || 0} قطعة)
                        </span>
                      </div>

                      <div className="p-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                        <span className="text-[10px] text-slate-500 block">المرتجع للمخزن (القديم):</span>
                        <span className="font-black text-sm text-rose-600 dark:text-rose-400">
                          {selectedNewVariant ? `${exchangeReturnedTotal.toLocaleString()} ج.م` : '—'}
                        </span>
                        <span className="text-[9px] text-slate-400 block mt-0.5">
                          {selectedNewVariant ? `(${exchangeOldItem?.exchangeQty || 0} قطعة)` : 'لم يتم التحديد'}
                        </span>
                      </div>

                      <div className={`p-2 rounded-lg border ${
                        exchangePriceDiff > 0 
                          ? 'bg-amber-50 border-amber-200 text-amber-900 dark:bg-amber-950/40 dark:border-amber-800 dark:text-amber-200' 
                          : exchangePriceDiff < 0 
                            ? 'bg-blue-50 border-blue-200 text-blue-900 dark:bg-blue-950/40 dark:border-blue-800 dark:text-blue-200' 
                            : 'bg-white border-slate-200 dark:bg-slate-800 dark:border-slate-700'
                      }`}>
                        <span className="text-[10px] block">فرق السعر:</span>
                        <span className="font-black text-sm">
                          {selectedNewVariant ? (
                            exchangePriceDiff === 0 
                              ? '0 ج.م' 
                              : exchangePriceDiff > 0 
                                ? `+${exchangePriceDiff.toLocaleString()} ج.م` 
                                : `${exchangePriceDiff.toLocaleString()} ج.م`
                          ) : '—'}
                        </span>
                        <span className="text-[9px] block mt-0.5 opacity-80">
                          {selectedNewVariant ? (
                            exchangePriceDiff > 0 
                              ? 'لصالح الشركة' 
                              : exchangePriceDiff < 0 
                                ? 'تخفيض للعميل' 
                                : 'متكافئ'
                          ) : ''}
                        </span>
                      </div>

                      <div className="p-2 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-200">
                        <span className="text-[10px] block font-bold">المحصل بواسطة المندوب:</span>
                        <span className="font-black text-sm text-emerald-700 dark:text-emerald-300">
                          {selectedNewVariant ? `${exchangeCollectedTotal.toLocaleString()} ج.م` : '—'}
                        </span>
                        <span className="text-[9px] block mt-0.5 text-emerald-600 dark:text-emerald-400">
                          (فرق السعر + {exchangeShippingFees.toLocaleString()} شحن)
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex-1 min-w-[200px]">
                        <input
                          type="text"
                          placeholder="ملاحظات الاستبدال (اختياري)..."
                          value={exchangeNotes}
                          onChange={e => setExchangeNotes(e.target.value)}
                          className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:outline-none"
                        />
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => { setOpenExchangeOrder(null); setExchangeOldItem(null); setExchangeTargetVariantId(null); }}
                          className="px-4 py-2 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-xl hover:bg-slate-300 transition-colors"
                        >
                          إلغاء
                        </button>
                        <button
                          type="button"
                          onClick={submitExchangeOrderItem}
                          disabled={
                            !exchangeWarehouse || 
                            !exchangeOldItem || 
                            !selectedNewVariant || 
                            exchangeSubmitting
                          }
                          className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-black rounded-xl shadow-md transition-all flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {exchangeSubmitting ? <Loader2 size={14} className="animate-spin" /> : <ArrowLeftRight size={14} />}
                          <span>{exchangeSubmitting ? 'جاري الاستبدال...' : 'تأكيد الاستبدال واستلام المرتجع'}</span>
                        </button>
                      </div>
                    </div>
                  </div>

                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default SalesUpdateStatus;

