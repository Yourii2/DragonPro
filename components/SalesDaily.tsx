import React, { useEffect, useMemo, useState } from 'react';
import Swal from 'sweetalert2';
import { API_BASE_PATH } from '../services/apiConfig';
//import { User, ShoppingCart, CreditCard, Trash2, ArrowRight, Printer, Box, LayoutList, LayoutGrid, ArrowDownAZ, ArrowUpAZ } from 'lucide-react';
import { User, ShoppingCart, CreditCard, Trash2, ArrowRight, Printer, Box, LayoutList, LayoutGrid, ArrowDownAZ, ArrowUpAZ, Phone, MapPin } from 'lucide-react';
import SmallOrderCard from './OrderConfirmations';
import CustomSelect from './CustomSelect';

const toNum = (v: any) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

// parse numeric-like values, handling Arabic/Persian digits and thousand separators
const parseNumeric = (v: any) => {
  if (v === null || typeof v === 'undefined') return 0;
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  let s = String(v || '').trim();
  if (s === '') return 0;
  // map Eastern Arabic and Persian numerals to Latin
  const map: Record<string,string> = {
    '٠':'0','١':'1','٢':'2','٣':'3','٤':'4','٥':'5','٦':'6','٧':'7','٨':'8','٩':'9',
    '۰':'0','۱':'1','۲':'2','۳':'3','۴':'4','۵':'5','۶':'6','۷':'7','۸':'8','۹':'9'
  };
  s = s.split('').map(ch => map[ch] || ch).join('');
  // remove commas and spaces
  s = s.replace(/[\s,]+/g, '');
  // remove any non-digit, non-dot, non-minus
  s = s.replace(/[^0-9.\-]+/g, '');
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
};
const normalizeText = (text: string) => {
  return (text || "")
    .trim()
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/\s+/g, " ");
};// التحقق من الأصناف الجديدة فقط في الأوردر الحالي
const orderTotal = (o: any) => {
  // Prefer computing from products to avoid relying on inconsistent stored subtotal fields
  let sub: number = 0;
  if (Array.isArray(o.products) && o.products.length > 0) {
    sub = o.products.reduce((s: number, p: any) => {
      const qty = toNum(p.quantity ?? p.qty ?? 0);
      let lineTotal = parseNumeric(p.total ?? p.total_price ?? p.lineTotal ?? p.line_total ?? p.amount ?? p.value);
      if (!lineTotal || lineTotal === 0) {
        const unit = parseNumeric(p.price ?? p.price_per_unit ?? p.sale_price ?? p.salePrice ?? p.unit_price ?? p.unitPrice);
        lineTotal = unit * qty;
      }
      return s + toNum(lineTotal);
    }, 0);
  } else {
    sub = parseNumeric(o.subTotal ?? o.total_amount ?? o.total ?? 0);
  }
  const ship = parseNumeric(o.shipping ?? o.shipping_fees ?? o.shippingCost ?? 0);
  return sub + ship;
};

// Server-consistent subtotal (exclude shipping) — used for rep assignment and "قيمة اوردرات اليوم"
const orderSubtotal = (o: any) => {
  if (Array.isArray(o.products) && o.products.length > 0) {
    return o.products.reduce((s: number, p: any) => {
      const qty = toNum(p.quantity ?? p.qty ?? 0);
      let lineTotal = parseNumeric(p.total ?? p.total_price ?? p.lineTotal ?? p.line_total ?? p.amount ?? p.value);
      if (!lineTotal || lineTotal === 0) {
        const unit = parseNumeric(p.price ?? p.price_per_unit ?? p.sale_price ?? p.salePrice ?? p.unit_price ?? p.unitPrice);
        lineTotal = unit * qty;
      }
      return s + toNum(lineTotal);
    }, 0);
  }
  // Fallback: try to detect if stored subtotal already includes shipping (bad data)
  const rawSub = parseNumeric(o.subTotal ?? o.total_amount ?? o.total ?? 0);
  const ship = parseNumeric(o.shipping ?? o.shipping_fees ?? o.shippingCost ?? 0);
  const totalField = parseNumeric(o.total ?? o.total_amount ?? 0);
  // If no products and subtotal equals stored total, assume subtotal includes shipping and subtract it
  if ((!o.products || o.products.length === 0) && ship > 0 && totalField > 0 && Math.abs(rawSub - totalField) < 0.001) {
    return Math.max(0, rawSub - ship);
  }
  return rawSub;
};

const orderPieces = (o: any) =>
  (Array.isArray(o.products) ? o.products : []).reduce((s: number, p: any) => s + toNum(p.quantity ?? p.qty ?? 0), 0);

const orderDistinctProducts = (o: any) => {
  const prods = Array.isArray(o.products) ? o.products : [];
  const ids = new Set(prods.map((p: any) => String(p.productId ?? p.product_id ?? p.id ?? p.name ?? '')).filter(Boolean));
  return ids.size;
};

const balanceLabel = (bal: number) => (bal > 0 ? 'له' : bal < 0 ? 'عليه' : '');
const balanceClass = (bal: number) => (bal > 0 ? 'text-emerald-600' : bal < 0 ? 'text-rose-600' : 'text-slate-500');
const getOrderStatusLabelAr = (statusRaw: any) => {
  const status = String(statusRaw || '').toLowerCase();
  switch (status) {
    case 'pending':
      return 'قيد الانتظار';
    case 'returned':
      return 'مرتجع';
    case 'partial_return':
      return 'مرتجع جزئي';
    case 'full_return':
      return 'مرتجع كلي';
    case 'cancelled':
    case 'canceled':
      return 'ملغي';
    case 'postponed':
    case 'deferred':
      return 'مؤجل';
    case 'with_rep':
      return 'مع المندوب';
    case 'in_delivery':
      return 'مع شركة الشحن';
    case 'delivered':
      return 'تم التسليم';
    case 'delivered_to_customer':
      return 'تم التسليم للعميل';
    case 'closed':
      return 'مغلق';
    default:
      return status ? status : 'غير محدد';
  }
};

const StatCard: React.FC<{ label: string; value: React.ReactNode; hint?: string; className?: string }> = ({
  label,
  value,
  hint,
  className
}) => (
  <div
    className={`rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 shadow-sm text-center ${
      className || ''
    }`}
  >
    <div className="text-xs text-slate-500 dark:text-slate-300">{label}</div>
    <div className="mt-1 text-lg font-black text-slate-900 dark:text-white">{value}</div>
    {hint ? <div className="mt-1 text-xs text-slate-400">{hint}</div> : null}
  </div>
);

const SalesDaily: React.FC = () => {
      // عرض الأوردرات: قائمة أو بطاقات
      const [todayViewMode, setTodayViewMode] = useState<'list' | 'card'>('list');
      const [assignedViewMode, setAssignedViewMode] = useState<'list' | 'card'>('list');
      // ترتيب الأوردرات: تصاعدي/تنازلي
      const [todaySortAsc, setTodaySortAsc] = useState(true);
      const [assignedSortAsc, setAssignedSortAsc] = useState(true);
    // طريقة الدفع: كاش أو مدفوعات إليكترونية
    const [paymentMethod, setPaymentMethod] = useState<'cash' | 'electronic'>('cash');
    // حالة التحميل عند إنشاء خزينة إلكترونية
    const [loading, setLoading] = useState(false);
  const deliveryMethod = (localStorage.getItem('Dragon_delivery_method') || 'reps').toString();
  const isShippingMode = deliveryMethod === 'shipping';

  const [reps, setReps] = useState<any[]>([]);
  const [shippingCompanies, setShippingCompanies] = useState<any[]>([]);

  const [pendingOrdersList, setPendingOrdersList] = useState<any[]>([]);
  const [selectedPendingIds, setSelectedPendingIds] = useState<number[]>([]);

  const [selectedRepId, setSelectedRepId] = useState<number | ''>('');
  const [selectedShippingCompanyId, setSelectedShippingCompanyId] = useState<number | ''>('');

  // Old custody (orders already with_rep / in_delivery)
  const [assignedOrders, setAssignedOrders] = useState<any[]>([]);

  // Today selection (new orders to assign now)
  const [selectedOrders, setSelectedOrders] = useState<any[]>([]);
  const [barcodeInput, setBarcodeInput] = useState('');
  const [openDailyInfo, setOpenDailyInfo] = useState<{ daily_code: string; journal_id: number } | null>(null);

  // Accounting
  const [prevBalance, setPrevBalance] = useState<number>(0);
  const [paymentAdjustment, setPaymentAdjustment] = useState<number>(0); // Amount Paid Now (deposit) from rep -> company
  const [paymentAction, setPaymentAction] = useState<'collect' | 'pay'>('collect'); // 'collect' = تحصيل من المندوب, 'pay' = دفع إلى المندوب

  // Cashbox / Warehouse
  const [treasuries, setTreasuries] = useState<any[]>([]);
  const [selectedTreasuryId, setSelectedTreasuryId] = useState<number | ''>('');
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<number | ''>('');
  const [userDefaults, setUserDefaults] = useState<any>(null);
  const [employee, setEmployee] = useState<string>('');
  const [page, setPage] = useState<string>('');

  const oldOrdersCount = assignedOrders.length;
  const oldOrdersValue = useMemo(() => assignedOrders.reduce((s: number, o: any) => s + orderSubtotal(o), 0), [assignedOrders]);
  const oldPiecesCount = useMemo(() => assignedOrders.reduce((s: number, o: any) => s + orderPieces(o), 0), [assignedOrders]);
  const oldDistinctProductsCount = useMemo(() => {
    const set = new Set<string>();
    assignedOrders.forEach((o: any) => {
      const prods = Array.isArray(o.products) ? o.products : [];
      prods.forEach((p: any) => set.add(String(p.productId ?? p.product_id ?? p.id ?? p.name ?? '')));
    });
    return set.size;
  }, [assignedOrders]);

  const todayOrdersUnique = useMemo(() => {
    const map = new Map<number, any>();
    selectedOrders.forEach((o: any) => map.set(Number(o.id), o));
    return Array.from(map.values());
  }, [selectedOrders]);

  const todayOrdersCount = todayOrdersUnique.length;
  const todayPiecesCount = useMemo(() => todayOrdersUnique.reduce((s: number, o: any) => s + orderPieces(o), 0), [todayOrdersUnique]);
  const todayDistinctProductsCount = useMemo(
    () => todayOrdersUnique.reduce((s: number, o: any) => s + orderDistinctProducts(o), 0),
    [todayOrdersUnique]
  );
  // Value of today's orders for rep assignment: sum of subtotals ONLY (exclude shipping)
  const todayValue = useMemo(() => todayOrdersUnique.reduce((s: number, o: any) => s + orderSubtotal(o), 0), [todayOrdersUnique]);

  // Shipping totals for today / old orders
  const todayShipping = useMemo(() => todayOrdersUnique.reduce((s: number, o: any) => s + parseNumeric(o.shipping ?? o.shipping_fees ?? o.shippingCost ?? 0), 0), [todayOrdersUnique]);
  const oldShipping = useMemo(() => assignedOrders.reduce((s: number, o: any) => s + parseNumeric(o.shipping ?? o.shipping_fees ?? o.shippingCost ?? 0), 0), [assignedOrders]);
  const totalShipping = todayShipping + oldShipping;

  const totalOrdersCount = oldOrdersCount + todayOrdersCount;
  const totalPiecesCount = oldPiecesCount + todayPiecesCount;

  // Signed-balance math:
  // - assignment decreases rep balance by today's value (more debt): balance -= todayValue
  // - when collecting from rep ('collect') the rep balance increases (reduces debt)
  // - when paying to rep ('pay') the rep balance decreases (increases debt)
  const finalBalanceBeforePayment = prevBalance - todayValue;
  const paidNowSigned = toNum(paymentAdjustment) * (paymentAction === 'collect' ? 1 : -1);
  const balanceAfterPayment = finalBalanceBeforePayment + paidNowSigned;

  const finalDebt = Math.max(0, -finalBalanceBeforePayment);
  const remainingDebt = Math.max(0, -balanceAfterPayment);

  useEffect(() => {
    (async () => {
      try {
        if (isShippingMode) {
          const r = await fetch(`${API_BASE_PATH}/api.php?module=shipping_companies&action=getAll`);
          const jr = await r.json();
          if (jr && jr.success) setShippingCompanies(jr.data || []);
        } else {
          const r = await fetch(`${API_BASE_PATH}/api.php?module=users&action=getAllWithBalance&related_to_type=rep`);
          const jr = await r.json();
          if (jr && jr.success) setReps((jr.data || []).filter((u: any) => u.role === 'representative'));
        }
        // تحميل التريجرز والمخازن وuserDefaults دفعة واحدة
        const [tr, wr, ud] = await Promise.all([
          fetch(`${API_BASE_PATH}/api.php?module=treasuries&action=getAll`).then(r => r.json()),
          fetch(`${API_BASE_PATH}/api.php?module=warehouses&action=getAll`).then(r => r.json()),
          fetch(`${API_BASE_PATH}/api.php?module=permissions&action=getUserDefaults`).then(r => r.json()).catch(() => ({ success: false }))
        ]);
        const tList = tr && tr.success ? tr.data || [] : [];
        const wList = wr && wr.success ? wr.data || [] : [];
        const defaults = ud && ud.success ? ud.data : null;
        console.log('getUserDefaults response:', ud);
        if (defaults) {
          setUserDefaults(defaults);
          console.log('userDefaults set:', defaults);
        } else {
          console.warn('userDefaults not set! Response:', ud);
        }
        // التحكم في التريجرز حسب صلاحية المستخدم
        if (defaults && defaults.default_treasury_id && !defaults.can_change_treasury) {
          setTreasuries(tList.filter((t: any) => Number(t.id) === Number(defaults.default_treasury_id)));
        } else {
          setTreasuries(tList);
        }
        setWarehouses(wList);
        if (defaults && defaults.default_treasury_id && !selectedTreasuryId) setSelectedTreasuryId(Number(defaults.default_treasury_id));
        if (defaults && defaults.default_warehouse_id && !selectedWarehouseId) setSelectedWarehouseId(Number(defaults.default_warehouse_id));
      } catch (e) {
        console.debug('Failed to load reps/companies/treasuries/warehouses/defaults', e);
      }

      try {
        // سحب قيد الانتظار
        const prPending = await fetch(`${API_BASE_PATH}/api.php?module=orders&action=getAll&status=pending`);
        const jrPending = await prPending.json().catch(() => ({ success: false }));
        const listPending = jrPending.success ? (jrPending.data || []) : [];

        // سحب المرتجع
        const prReturned = await fetch(`${API_BASE_PATH}/api.php?module=orders&action=getAll&status=returned`);
        const jrReturned = await prReturned.json().catch(() => ({ success: false }));
        const listReturned = jrReturned.success ? (jrReturned.data || []) : [];

        // سحب المؤجل
        const prPostponed = await fetch(`${API_BASE_PATH}/api.php?module=orders&action=getAll&status=postponed`);
        const jrPostponed = await prPostponed.json().catch(() => ({ success: false }));
        const listPostponed = jrPostponed.success ? (jrPostponed.data || []) : [];

        // سحب الملغي
        const prCancelled = await fetch(`${API_BASE_PATH}/api.php?module=orders&action=getAll&status=cancelled`);
        const jrCancelled = await prCancelled.json().catch(() => ({ success: false }));
        const listCancelled = jrCancelled.success ? (jrCancelled.data || []) : [];

        // دمجهم مع بعض
        setPendingOrdersList([...listPending, ...listReturned, ...listPostponed, ...listCancelled]);
      } catch (e) {
        console.debug('Failed to load orders lists', e);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-select sensible defaults: if only one rep/shipping company, or user defaults provide treasury/warehouse
  useEffect(() => {
    if (!selectedTreasuryId && userDefaults && userDefaults.default_treasury_id) {
      setSelectedTreasuryId(Number(userDefaults.default_treasury_id));
    }

    if (!selectedWarehouseId && userDefaults && userDefaults.default_warehouse_id) {
      setSelectedWarehouseId(Number(userDefaults.default_warehouse_id));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userDefaults]);

  const loadRepContext = async (repId: number) => {
    // Accurate prev balance
    try {
      const ur = await fetch(`${API_BASE_PATH}/api.php?module=users&action=getAllWithBalance&related_to_type=rep`);
      const uj = await ur.json();
      if (uj && uj.success) {
        const u = (uj.data || []).find((x: any) => Number(x.id) === Number(repId));
        setPrevBalance(toNum(u ? u.balance : 0));
        setReps((uj.data || []).filter((x: any) => x.role === 'representative'));
      } else {
        setPrevBalance(0);
      }
    } catch (e) {
      console.debug('Failed to load rep balance', e);
      setPrevBalance(0);
    }

    // Old custody orders (with_rep)
    try {
      const r = await fetch(`${API_BASE_PATH}/api.php?module=orders&action=getByRep&rep_id=${repId}&status=with_rep`);
      const jr = await r.json();
      if (jr && jr.success) {
        setAssignedOrders(jr.data || []);
      } else {
        const all = await fetch(`${API_BASE_PATH}/api.php?module=orders&action=getAll&status=with_rep`).then(x => x.json());
        const list = all && all.success ? all.data || [] : [];
        setAssignedOrders(list.filter((o: any) => Number(o.rep_id ?? o.repId) === Number(repId)));
      }
    } catch (e) {
      console.debug('Failed to load with_rep orders', e);
      setAssignedOrders([]);
    }

    // Fetch open daily session code
    try {
      const odResp = await fetch(`${API_BASE_PATH}/api.php?module=sales&action=getRepOpenDaily&rep_id=${repId}`);
      const odJson = await odResp.json();
      setOpenDailyInfo(odJson?.success && odJson.data ? { daily_code: odJson.data.daily_code || '', journal_id: Number(odJson.data.id) } : null);
    } catch { setOpenDailyInfo(null); }
  };

  const onSelectRep = async (repId: number | '') => {
    setSelectedRepId(repId as any);
    setSelectedOrders([]);
    setSelectedPendingIds([]);
    setBarcodeInput('');
    setPaymentAdjustment(0);
    setPrevBalance(0);
    setAssignedOrders([]);
    setOpenDailyInfo(null);

    if (!repId) return;
    await loadRepContext(Number(repId));
  };

  const onSelectShippingCompany = async (companyId: number | '') => {
    setSelectedShippingCompanyId(companyId as any);
    setSelectedOrders([]);
    setSelectedPendingIds([]);
    setBarcodeInput('');
    setPaymentAdjustment(0);
    setPrevBalance(0);
    setAssignedOrders([]);

    if (!companyId) return;

    try {
      const r = await fetch(`${API_BASE_PATH}/api.php?module=orders&action=getAll&status=in_delivery`);
      const jr = await r.json();
      const list = jr && jr.success ? jr.data || [] : [];
      const assigned = list.filter((o: any) => Number(o.shipping_company_id ?? o.shippingCompanyId) === Number(companyId));
      setAssignedOrders(assigned);
    } catch (e) {
      setAssignedOrders([]);
    }
  };

  const startDailyHandler = async () => {
    if (!selectedRepId && !selectedShippingCompanyId) {
      Swal.fire('حدد المندوب', 'الرجاء اختيار المندوب أولاً.', 'warning');
      return;
    }
    if (!selectedTreasuryId) {
      Swal.fire('حدد الخزينة', 'الرجاء اختيار الخزينة أولاً.', 'warning');
      return;
    }
    try {
      const payload: any = {
        repId: Number(selectedRepId) || null,
        treasuryId: selectedTreasuryId ? Number(selectedTreasuryId) : null,
        warehouseId: selectedWarehouseId ? Number(selectedWarehouseId) : null,
        employee: employee || null,
        page: page || null,
        notes: null
      };
      const r = await fetch(`${API_BASE_PATH}/api.php?module=sales&action=startDaily`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
      });
      const j = await r.json().catch(() => null);
      if (j && j.success) {
        if (j.data?.daily_code) {
          setOpenDailyInfo({ daily_code: String(j.data.daily_code), journal_id: Number(j.data.id || j.data.journal_id || 0) });
        }
        Swal.fire('تم', j.data?.daily_code ? `تم تسجيل بداية اليومية بنجاح.\nالكود: ${j.data.daily_code}` : 'تم تسجيل بداية اليومية بنجاح.', 'success');
        if (selectedRepId) await loadRepContext(Number(selectedRepId));
      } else {
        Swal.fire('فشل', j?.message || 'فشل بدء اليومية.', 'error');
      }
    } catch (e) {
      console.error('startDaily failed', e);
      Swal.fire('خطأ', 'فشل الاتصال بالخادم أثناء بدء اليومية.', 'error');
    }
  };

  // Re-fetch pending/returned orders from DB so the available list reflects the latest DB state.
  // Called after completeDaily so newly-assigned orders (now with_rep) disappear immediately.
  const refreshPendingOrdersList = async () => {
    try {
      const [rPending, rReturned, rCancelled] = await Promise.all([
        fetch(`${API_BASE_PATH}/api.php?module=orders&action=getAll&status=pending`).then(r => r.json()).catch(() => ({ success: false })),
        fetch(`${API_BASE_PATH}/api.php?module=orders&action=getAll&status=returned`).then(r => r.json()).catch(() => ({ success: false })),
        fetch(`${API_BASE_PATH}/api.php?module=orders&action=getAll&status=cancelled`).then(r => r.json()).catch(() => ({ success: false }))
      ]);
      const listPending  = rPending.success  ? (rPending.data  || []) : [];
      const listReturned = rReturned.success ? (rReturned.data || []) : [];
      const listCancelled = rCancelled.success ? (rCancelled.data || []) : [];
      setPendingOrdersList([...listPending, ...listReturned, ...listCancelled]);
    } catch (e) {
      console.debug('refreshPendingOrdersList failed', e);
    }
  };

  const togglePending = (id: number) => {
    setSelectedPendingIds(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));
  };

  const buildShortagesHtml = (shortages: any[], intro?: string) => {
    const rows = Array.isArray(shortages) ? shortages : [];
    const list = rows.map((row: any) => {
      const product = row.product_name || row.name || `منتج #${row.product_id ?? ''}`;
      const color = String(row.color || '').trim();
      const size = String(row.size || '').trim();
      const required = toNum(row.required_qty ?? row.required ?? row.requested_qty ?? 0);
      const available = toNum(row.available_qty ?? row.available ?? 0);
      const shortage = Math.max(0, required - available);
      const variant = `${color ? ` / ${color}` : ''}${size ? ` / ${size}` : ''}`;
      return `<li style="margin-bottom:8px;"><strong>${product}${variant}</strong>: مطلوب <b>${required}</b>، متاح <b>${available}</b>${shortage > 0 ? `، عجز <b style=\"color:#e11d48\">${shortage}</b>` : ''}</li>`;
    }).join('');

    return `
      <div style="text-align:right; font-size:14px; line-height:1.9;">
        ${intro ? `<div style="margin-bottom:8px;">${intro}</div>` : ''}
        <ul style="padding-right:20px; list-style-type: disc; margin:0;">${list}</ul>
      </div>
    `;
  };

  const checkCumulativeStockForOrderIds = async (
    orderIds: number[]
  ): Promise<{ ok: boolean; message?: string; shortages?: any[] }> => {
    if (!selectedWarehouseId) {
      return { ok: false, message: 'يرجى اختيار المستودع أولاً قبل التحقق من المخزون.' };
    }

    const ids = Array.from(new Set((orderIds || []).map((id) => Number(id)).filter((id) => id > 0)));
    if (ids.length === 0) return { ok: true };

    try {
      const response = await fetch(`${API_BASE_PATH}/api.php?module=sales&action=getConfirmationStockSummary`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ warehouse_id: Number(selectedWarehouseId), order_ids: ids })
      });
      const result = await response.json().catch(() => null);
      if (!result || result.success === false) {
        return { ok: false, message: result?.message || 'فشل التحقق من المخزون.' };
      }

      const shortages = Array.isArray(result?.data?.shortages) ? result.data.shortages : [];
      if (shortages.length > 0) {
        return {
          ok: false,
          message: 'المخزون غير كافٍ لبعض المنتجات في المستودع المحدد.',
          shortages
        };
      }

      return { ok: true };
    } catch (error) {
      console.debug('Cumulative stock check failed', error);
      return { ok: false, message: 'فشل الاتصال بالخادم أثناء التحقق من المخزون.' };
    }
  };

  // Validate order products against product catalog and stock for the selected warehouse
  const validateOrderProducts = async (order: any) : Promise<{ ok: boolean; message?: string }> => {
    if (!selectedWarehouseId) {
      return { ok: false, message: 'يرجى اختيار المستودع أولاً قبل إضافة الاوردرات.' };
    }
    try {
      const prodsRes = await fetch(`${API_BASE_PATH}/api.php?module=products&action=getFlat`);
      const prodsJson = await prodsRes.json().catch(() => null);
      const allProducts = (prodsJson && prodsJson.success) ? prodsJson.data : [];

      const norm = (txt: any) => (txt || "").toString().trim().replace(/[أإآ]/g, "ا").replace(/ة/g, "ه");

      const prodMap: Record<string, any> = {};
      const unlinkedItems: string[] = [];

      (Array.isArray(order.products) ? order.products : []).forEach((p: any) => {
        let pid = Number(p.productId ?? p.product_id ?? 0);
        const name = (p.name ?? p.product_name ?? '').toString();
        const color = (p.color ?? p.variant_color ?? p.variant ?? '').toString();
        const size = (p.size ?? p.variant_size ?? p.measure ?? '').toString();
        const qty = toNum(p.quantity ?? p.qty ?? 0);

        if (qty <= 0) return;

        if (pid <= 0 && allProducts.length > 0) {
          let found = allProducts.find((ep:any) => 
              norm(ep.name) === norm(name) && 
              norm(ep.color) === norm(color) && 
              norm(ep.size) === norm(size)
          );
          if (!found) {
            const potentials = allProducts.filter((ep:any) => norm(ep.name) === norm(name));
            if (potentials.length === 1) found = potentials[0];
          }
          if (found) pid = Number(found.id);
        }

        if (pid <= 0) {
          unlinkedItems.push(`${name} (لون: ${color || '-'}، مقاس: ${size || '-'})`);
          return;
        }

        const key = `${pid}`;
        if (!prodMap[key]) prodMap[key] = { product_id: pid, name: name, quantity: 0 };
        prodMap[key].quantity += qty;
      });

      if (unlinkedItems.length > 0) {
        let html = `<div style="text-align: right; font-size: 14px;">الاوردر يحتوي على منتجات غير متعرفة على المخزن (تم كتابتها يدوياً بدون ربطها):<br/><br/><ul style="padding-right: 20px; list-style-type: disc;">`;
        unlinkedItems.forEach(item => { html += `<li style="color: #e11d48; margin-bottom: 4px;">${item}</li>`; });
        html += `</ul></div>`;
        return { ok: false, message: html };
      }

      return { ok: true };
    } catch (e) {
      console.debug('Validation failed', e);
      return { ok: false, message: 'فشل التحقق من منتجات الاوردر.' };
    }
  };

  const addSelectedFromPending = async () => {
    const toAdd = pendingOrdersList.filter(p => selectedPendingIds.includes(Number(p.id)));
    if (toAdd.length === 0) {
      Swal.fire('تنبيه', 'اختر اوردرات أولاً.', 'info');
      return;
    }

    if (!selectedWarehouseId) {
      Swal.fire('تنبيه', 'يرجى اختيار المستودع أولاً قبل إضافة الاوردرات.', 'warning');
      return;
    }

    const allowedStatuses = ['pending', 'returned', 'cancelled', 'canceled'];
    const accepted = toAdd.filter(t => allowedStatuses.includes(String(t.status || 'pending')));
    const rejected = toAdd.filter(t => !allowedStatuses.includes(String(t.status || '')));

    const existingIds = new Set(todayOrdersUnique.map(o => Number(o.id)));
    const newOnes = accepted.filter(t => !existingIds.has(Number(t.id)));

    if (newOnes.length === 0) {
      Swal.fire('لا توجد اوردرات جديدة', 'الاوردرات المحددة قد تكون مضافة بالفعل.', 'info');
      return;
    }

    const finallyAccepted: any[] = [];
    const stockRejected: Array<{ order: any; message: string }> = [];
    const workingOrderIds = todayOrdersUnique.map((o: any) => Number(o.id)).filter((id: number) => id > 0);

    for (const ord of newOnes) {
      const v = await validateOrderProducts(ord);
      if (!v.ok) {
        stockRejected.push({ order: ord, message: v.message || 'مشكلة في التحقق من المنتجات' });
      } else {
        const candidateOrderIds = Array.from(new Set([...workingOrderIds, Number(ord.id)]));
        const stockCheck = await checkCumulativeStockForOrderIds(candidateOrderIds);
        if (!stockCheck.ok) {
          const message = stockCheck.shortages && stockCheck.shortages.length > 0
            ? buildShortagesHtml(stockCheck.shortages, `لا يمكن إضافة الأوردر #${ord.orderNumber ?? ord.order_number ?? ord.id} بسبب نقص تراكمي في المخزون:`)
            : (stockCheck.message || 'مشكلة في التحقق من المخزون');
          stockRejected.push({ order: ord, message });
          continue;
        }

        workingOrderIds.push(Number(ord.id));
        finallyAccepted.push(ord);
      }
    }

    if (finallyAccepted.length > 0) {
      setSelectedOrders(prev => [...prev, ...finallyAccepted]);
      setPendingOrdersList(prev => prev.filter(p => !finallyAccepted.some(n => Number(n.id) === Number(p.id))));
      setSelectedPendingIds([]);
    }

    let successMsg = `تم إضافة ${finallyAccepted.length} اوردرات لليومية.`;
    if (rejected.length > 0) successMsg += ` ${rejected.length} اوردرات لم تُضاف لأن حالتها ليست 'قيد الانتظار' أو 'مرتجع' أو 'ملغي'.`;
    if (stockRejected.length > 0) successMsg += ` ${stockRejected.length} اوردرات لم تُضاف لمشاكل في المنتج/المخزون.`;
    Swal.fire('انتهاء', successMsg, 'success');

    if (stockRejected.length > 0) {
      // show details for the first few rejected orders
      const first = stockRejected[0];
      const html = typeof first.message === 'string' && first.message.startsWith('<') ? first.message : `<div style="white-space:pre-wrap; text-align:right">${first.message}</div>`;
      Swal.fire('غير مسموح', html, 'warning');
    }
  };

  const removeSelectedOrder = (id: number) => {
    const removed = selectedOrders.find(o => Number(o.id) === Number(id));
    setSelectedOrders(prev => prev.filter(o => Number(o.id) !== Number(id)));
    if (removed) setPendingOrdersList(prev => [removed, ...prev.filter(p => Number(p.id) !== Number(id))]);
  };

  const handleRecallOrder = async (order: any) => {
    const repId = selectedRepId;
    if (!repId) return;
    const confirm = await Swal.fire({
      title: 'سحب الأوردر من عهدة المندوب',
      text: `سيتم سحب #${order.orderNumber ?? order.order_number ?? order.id} من عهدة المندوب وإعادته إلى قائمة الطلبيات المتاحة. هل أنت متأكد؟`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'نعم، سحب',
      cancelButtonText: 'إلغاء'
    });
    if (!confirm.isConfirmed) return;
    try {
      const r = await fetch(`${API_BASE_PATH}/api.php?module=sales&action=recallOrderFromRep`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rep_id: Number(repId), order_id: Number(order.id) })
      });
      const jr = await r.json();
      if (jr && jr.success) {
        setAssignedOrders(prev => prev.filter((o: any) => Number(o.id) !== Number(order.id)));
        setPendingOrdersList(prev => [order, ...prev.filter((p: any) => Number(p.id) !== Number(order.id))]);
        Swal.fire('تم', 'تم سحب الأوردر من عهدة المندوب.', 'success');
      } else {
        Swal.fire('خطأ', jr?.message || 'فشل سحب الأوردر.', 'error');
      }
    } catch (e) {
      console.error('recallOrderFromRep failed', e);
      Swal.fire('خطأ', 'فشل الاتصال بالخادم.', 'error');
    }
  };

  /* const scanBarcodeAddOrder = async () => {
    const code = String(barcodeInput || '').trim();
    if (!code) return;

    const match =
      pendingOrdersList.find(p => String(p.barcode ?? '') === code) ||
      pendingOrdersList.find(p => String(p.order_number ?? p.orderNumber ?? '') === code) ||
      pendingOrdersList.find(p => String(p.id ?? '') === code);

    if (!match) {
      // Try to detect status from client-side lists first
      const inSelected = selectedOrders.find(o => String(o.barcode ?? o.order_number ?? o.id ?? '') === code || String(o.id ?? '') === code);
      if (inSelected) {
        Swal.fire('موجود في اليومية', 'الاوردر موجود بالفعل في قائمة "اوردرات اليوم المختارة".', 'info');
        setBarcodeInput('');
        return;
      }

      const inAssigned = assignedOrders.find(o => String(o.barcode ?? o.order_number ?? o.id ?? '') === code || String(o.id ?? '') === code);
      if (inAssigned) {
        const repId = inAssigned.rep_id ?? inAssigned.repId ?? inAssigned.assigned_to ?? inAssigned.assignee_id ?? null;
        const compId = inAssigned.shipping_company_id ?? inAssigned.shippingCompanyId ?? inAssigned.shippingCompany ?? null;
        if (repId) {
          const repName = reps.find(r => Number(r.id) === Number(repId))?.name || '';
          Swal.fire('موجود مع مندوب', `الاوردر مع المندوب ${repName || ('#' + repId)} حالياً.`, 'info');
          setBarcodeInput('');
          return;
        }
        if (compId) {
          const compName = shippingCompanies.find(c => Number(c.id) === Number(compId))?.name || '';
          Swal.fire('موجود مع شركة شحن', `الاوردر مع شركة الشحن ${compName || ('#' + compId)} حالياً.`, 'info');
          setBarcodeInput('');
          return;
        }
        // fallback: assigned but no assignee info
        Swal.fire('موجود في العهدة', 'الاوردر موجود ضمن الاوردرات المخصصة (عهدة).', 'info');
        setBarcodeInput('');
        return;
      }

      // Not found locally — query server for more details (try several endpoints gracefully)
      try {
        let foundOrder: any = null;
        // If code is numeric, try lookup by id
        if (/^\d+$/.test(code)) {
          const r = await fetch(`${API_BASE_PATH}/api.php?module=orders&action=get&id=${encodeURIComponent(code)}`);
          const jr = await r.json().catch(() => null);
          if (jr && jr.success && jr.data) foundOrder = jr.data;
        }

        // try by barcode
        if (!foundOrder) {
          const r2 = await fetch(`${API_BASE_PATH}/api.php?module=orders&action=getByBarcode&barcode=${encodeURIComponent(code)}`);
          const jr2 = await r2.json().catch(() => null);
          if (jr2 && jr2.success && jr2.data) foundOrder = jr2.data;
        }

        // try by order number
        if (!foundOrder) {
          const r3 = await fetch(`${API_BASE_PATH}/api.php?module=orders&action=getByNumber&order_number=${encodeURIComponent(code)}`);
          const jr3 = await r3.json().catch(() => null);
          if (jr3 && jr3.success && jr3.data) foundOrder = jr3.data;
        }

        if (foundOrder) {
          const status = (foundOrder.status || '').toString();
          const repId = foundOrder.rep_id ?? foundOrder.repId ?? foundOrder.assigned_to ?? foundOrder.assignee_id ?? null;
          const compId = foundOrder.shipping_company_id ?? foundOrder.shippingCompanyId ?? foundOrder.shippingCompany ?? null;
          if (status === 'delivered' || status === 'delivered_to_customer' || status === 'closed') {
            Swal.fire('تم التسليم', 'هذا الاوردر تم تسليمه بالفعل.', 'info');
            setBarcodeInput('');
            return;
          }
            if (repId) {
            // try to resolve rep name
            let repName = reps.find(r => Number(r.id) === Number(repId))?.name || '';
            // fetch rep details if unknown
            if (!repName) {
              try {
                const rr = await fetch(`${API_BASE_PATH}/api.php?module=users&action=get&id=${encodeURIComponent(repId)}`);
                const rjr = await rr.json().catch(() => null);
                if (rjr && rjr.success && rjr.data) repName = rjr.data.name || '';
              } catch (e) {}
            }
            Swal.fire('موجود مع مندوب', `الاوردر مع المندوب ${repName || ('#' + repId)} حالياً.`, 'info');
            setBarcodeInput('');
            return;
          }
            if (compId) {
            let compName = shippingCompanies.find(c => Number(c.id) === Number(compId))?.name || '';
            if (!compName) {
              try {
                const rc = await fetch(`${API_BASE_PATH}/api.php?module=shipping_companies&action=get&id=${encodeURIComponent(compId)}`);
                const jc = await rc.json().catch(() => null);
                if (jc && jc.success && jc.data) compName = jc.data.name || '';
              } catch (e) {}
            }
            Swal.fire('موجود مع شركة شحن', `الاوردر مع شركة الشحن ${compName || ('#' + compId)} حالياً.`, 'info');
            setBarcodeInput('');
            return;
          }

          // generic server-known order but not assigned/delivered
          Swal.fire('موجود في النظام', `تم العثور على الاوردر في النظام. الحالة: ${status || 'غير معروفة'}.`, 'info');
          setBarcodeInput('');
          return;
        }
      } catch (e) {
        console.debug('Order lookup failed', e);
      }

      // Fallback message
      Swal.fire('غير موجود', 'لم يتم العثور على اوردر بهذا الباركود/الرقم ضمن الاوردرات المتاحة أو في النظام.', 'warning');
      setBarcodeInput('');
      return;
    }

    // Fetch selected product from server and validate match contains it
    try {
      const r = await fetch(`${API_BASE_PATH}/api.php?module=selected_product&action=get`);
      const jr = await r.json();
      const selRaw = jr && jr.success ? jr.data : null;
      if (selRaw && (selRaw.product_id || selRaw.name)) {
        const sel = {
          productId: selRaw.product_id ?? selRaw.productId,
          name: selRaw.name ?? null,
          color: selRaw.color ?? null,
          size: selRaw.size ?? null,
          qty: selRaw.qty ?? null
        };
        const prods = Array.isArray(match.products) ? match.products : [];
        const found = prods.find((p: any) => {
          const pid = p.productId ?? p.product_id ?? p.id ?? '';
          const name = (p.name || '').toString();
          const color = (p.color || p.variant_color || p.variant || '').toString();
          const size = (p.size || p.variant_size || p.measure || '').toString();
          const qty = toNum(p.quantity ?? p.qty ?? 0);
          const pidMatch = sel.productId ? Number(sel.productId) === Number(pid) : false;
          const nameMatch = sel.name ? sel.name.toString().trim() === name.toString().trim() : false;
          const colorMatch = sel.color ? sel.color.toString().trim() === color.toString().trim() : true;
          const sizeMatch = sel.size ? sel.size.toString().trim() === size.toString().trim() : true;
          const qtyOk = typeof sel.qty === 'undefined' || sel.qty === null ? true : qty >= Number(sel.qty);
          return (pidMatch || nameMatch) && colorMatch && sizeMatch && qtyOk;
        });
        if (!found) {
          // Build a clearer message explaining what is missing or mismatched
          let detail = '';
          const prodsCheck = Array.isArray(prods) ? prods : [];
          // try to detect nearest matches and reasons
          let matchedByIdOrName = null as any;
          for (const p of prodsCheck) {
            const pid = p.productId ?? p.product_id ?? p.id ?? '';
            const name = (p.name || p.product_name || '').toString();
            const pidMatch = sel.productId ? Number(sel.productId) === Number(pid) : false;
            const nameMatch = sel.name ? sel.name.toString().trim() === name.toString().trim() : false;
            if (pidMatch || nameMatch) {
              matchedByIdOrName = p;
              break;
            }
          }

          if (!matchedByIdOrName) {
            detail += `- المنتج ${sel.name || sel.productId || ''} غير موجود في الاوردر.\n`;
          } else {
            const p = matchedByIdOrName;
            const color = (p.color || p.variant_color || p.variant || '').toString();
            const size = (p.size || p.variant_size || p.measure || '').toString();
            const qty = toNum(p.quantity ?? p.qty ?? 0);
            if (sel.color && sel.color.toString().trim() !== color.toString().trim()) {
              detail += `- اللون المطلوب ${sel.color} لا يطابق الموجود في الاوردر (${color || 'غير محدد'}).\n`;
            }
            if (sel.size && sel.size.toString().trim() !== size.toString().trim()) {
              detail += `- المقاس المطلوب ${sel.size} لا يطابق الموجود في الاوردر (${size || 'غير محدد'}).\n`;
            }
            if (typeof sel.qty !== 'undefined' && sel.qty !== null && qty < Number(sel.qty)) {
              detail += `- الكمية غير كافية: مطلوب ${sel.qty}، موجود في الاوردر ${qty}.\n`;
            }
          }

          const msg = `الاوردر لا يحتوي المنتج/اللون/المقاس المطلوب أو الكمية غير كافية.\n\nتفاصيل:\n${detail}`;
          Swal.fire('غير مسموح', msg, 'warning');
          setBarcodeInput('');
          return;
        }
      }
    } catch (e) {
      console.debug('Failed to validate selected product against order', e);
    }

    const allowedStatuses = ['pending', 'returned', 'cancelled', 'canceled'];
    if (!allowedStatuses.includes(String(match.status || 'pending'))) {
      Swal.fire('غير مسموح', 'لا يمكن إضافة اوردر ليست حالتها قيد الانتظار/مرتجع/ملغي.', 'warning');
      setBarcodeInput('');
      return;
    }

    // Prevent adding orders already assigned to a rep
    try {
      const repId = match.rep_id ?? match.repId ?? match.assigned_to ?? match.assignee_id ?? null;
      if (repId) {
        const repName = reps.find((r: any) => Number(r.id) === Number(repId))?.name || (match.assigned && (match.assigned.name || match.assigned.employee)) || match.assigneeName || '';
        Swal.fire('موجود', `الاوردر مع المندوب ${repName}`, 'info');
        setBarcodeInput('');
        return;
      }
    } catch (e) {
      console.debug('Rep-assigned check failed', e);
    }

    // Prevent adding orders already assigned to a shipping company
    try {
      const compId = match.shipping_company_id ?? match.shippingCompanyId ?? match.shippingCompany ?? null;
      if (compId) {
        const companyName = shippingCompanies.find((c: any) => Number(c.id) === Number(compId))?.name || match.shipping_company_name || match.shippingCompanyName || '';
        Swal.fire('موجود', `الاوردر مع شركة الشحن ${companyName}`, 'info');
        setBarcodeInput('');
        return;
      }
    } catch (e) {
      console.debug('Shipping-company-assigned check failed', e);
    }

    if (todayOrdersUnique.some(o => Number(o.id) === Number(match.id))) {
      setBarcodeInput('');
      return;
    }

    // Check warehouse stock availability for this order before adding
    if (!selectedWarehouseId) {
      Swal.fire('تنبيه', 'يرجى اختيار المستودع أولاً.', 'warning');
      setBarcodeInput('');
      return;
    }
    try {
      const prodMap: Record<string, { product_id: number; name: string; quantity: number }> = {};
      (Array.isArray(match.products) ? match.products : []).forEach((p: any) => {
        const pid = Number(p.productId ?? p.product_id ?? p.id ?? 0) || 0;
        const name = p.name ?? p.product_name ?? '';
        const qty = toNum(p.quantity ?? p.qty ?? 0);
        if (!prodMap[pid]) prodMap[pid] = { product_id: pid, name: name, quantity: 0 };
        prodMap[pid].quantity += qty;
      });

      const items = Object.values(prodMap).filter(x => Number(x.product_id) > 0).map(x => ({ product_id: x.product_id, quantity: x.quantity, name: x.name }));
      if (items.length > 0) {
        const stockResp = await fetch(`${API_BASE_PATH}/api.php?module=stock&action=checkAvailability`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ warehouse_id: selectedWarehouseId, items })
        });
        const stockJr = await stockResp.json().catch(() => null);
        if (!stockJr || stockJr.success === false) {
          const unavailable = (stockJr && stockJr.unavailable_items) || [];
          if (unavailable.length > 0) {
            let msg = `لا يمكن إضافة الاوردر بسبب مشاكل في المخزون للمستودع المحدد:\n`;
            unavailable.forEach((it: any) => {
              const id = it.product_id || it.productId || '';
              const name = it.name || it.product_name || '';
              const required = typeof it.required !== 'undefined' ? it.required : it.requested_qty ?? '';
              const available = typeof it.available !== 'undefined' ? it.available : it.available_qty ?? 0;
              const parts: string[] = [];
              if (typeof available === 'number' && available <= 0) parts.push('غير موجود في المخزن');
              if (typeof available === 'number' && typeof required === 'number' && available < required) parts.push(`الكمية غير كافية (مطلوب ${required}، متوفر ${available})`);
              if (it.requested_color && it.color && it.requested_color.toString().trim() !== it.color.toString().trim()) parts.push(`اللون لا يطابق (مطلوب ${it.requested_color}، في المخزن ${it.color})`);
              if (it.requested_size && it.size && it.requested_size.toString().trim() !== it.size.toString().trim()) parts.push(`المقاس لا يطابق (مطلوب ${it.requested_size}، في المخزن ${it.size})`);
              // fallback: if API provided a reason field
              if (it.reason) parts.push(String(it.reason));
              if (parts.length === 0) parts.push('مشكلة غير محددة في توفر المنتج');
              msg += `- ${name || id}: ${parts.join('، ')}\n`;
            });
            Swal.fire('نقص في المخزون', msg, 'warning');
            setBarcodeInput('');
            return;
          }
          // if API returned false but no list, show generic error
          if (!stockJr) {
            Swal.fire('خطأ', 'فشل التحقق من المخزون. حاول مرة أخرى.', 'error');
            setBarcodeInput('');
            return;
          }
        }
      }
    } catch (e) {
      console.debug('Stock check failed', e);
    }

    setSelectedOrders(prev => [...prev, match]);
    setPendingOrdersList(prev => prev.filter(p => Number(p.id) !== Number(match.id)));
    setBarcodeInput('');
  }; */
const scanBarcodeAddOrder = async () => {
    const code = String(barcodeInput || '').trim();
    if (!code) return;

    // 1. استخدام let بدلاً من const عشان نقدر نضيف الاوردر لو لقيناها في السيرفر
    let match: any =
      pendingOrdersList.find(p => String(p.barcode ?? '') === code) ||
      pendingOrdersList.find(p => String(p.order_number ?? p.orderNumber ?? '') === code);

    if (!match) {
      // 2. التحقق مما إذا كانت الاوردر مختارة بالفعل
      const inSelected = selectedOrders.find(o => String(o.barcode ?? o.order_number ?? '') === code);
      if (inSelected) {
        Swal.fire('موجود في اليومية', 'الاوردر موجود بالفعل في قائمة "اوردرات اليوم المختارة".', 'info');
        setBarcodeInput('');
        return;
      }

      // 3. التحقق مما إذا كان الاوردر في عهدة مندوب حالياً في نفس الجلسة
      const inAssigned = assignedOrders.find(o => String(o.barcode ?? o.order_number ?? '') === code);
      if (inAssigned) {
        const repId = inAssigned.rep_id ?? inAssigned.repId ?? inAssigned.assigned_to ?? inAssigned.assignee_id ?? null;
        const compId = inAssigned.shipping_company_id ?? inAssigned.shippingCompanyId ?? inAssigned.shippingCompany ?? null;
        if (repId) {
          const repName = reps.find(r => Number(r.id) === Number(repId))?.name || '';
          Swal.fire('موجود مع مندوب', `الاوردر مع المندوب ${repName || ('#' + repId)} حالياً.`, 'info');
          setBarcodeInput('');
          return;
        }
        if (compId) {
          const compName = shippingCompanies.find(c => Number(c.id) === Number(compId))?.name || '';
          Swal.fire('موجود مع شركة شحن', `الاوردر مع شركة الشحن ${compName || ('#' + compId)} حالياً.`, 'info');
          setBarcodeInput('');
          return;
        }
        Swal.fire('موجود في العهدة', 'الاوردر موجود ضمن الاوردرات المخصصة (عهدة).', 'info');
        setBarcodeInput('');
        return;
      }

      // 4. البحث في السيرفر (بديل آمن لتجنب خطأ الـ API اللي بيظهر في الكونسول)
      try {
        let foundOrder: any = null;

        // سحب كل الاوردرات والبحث فيها بأمان تام
        const rAll = await fetch(`${API_BASE_PATH}/api.php?module=orders&action=getAll`);
        const jAll = await rAll.json().catch(() => null);
        
        if (jAll && jAll.success && Array.isArray(jAll.data)) {
          foundOrder = jAll.data.find((o: any) => 
            String(o.barcode ?? '') === code || 
            String(o.order_number ?? o.orderNumber ?? '') === code
          );
        }

        if (foundOrder) {
          match = foundOrder;
        }
      } catch (e) {
        console.debug('Order lookup failed', e);
      }

      // لو بعد كل ده ملقيناش الاوردر نهائياً
      if (!match) {
        Swal.fire('غير موجود', 'لم يتم العثور على اوردر بهذا الباركود/الرقم نهائياً.', 'warning');
        setBarcodeInput('');
        return;
      }
    }

    // --- 5. فحص حالة الاوردر والبحث عن اسم المندوب ---
    const status = String(match.status || 'pending');
    const allowedStatuses = ['pending', 'returned', 'cancelled', 'canceled'];
    
    if (!allowedStatuses.includes(status)) {
      
      // 1. لو الاوردر في عهدة مندوب، نجيب اسمه ونعرض رسالتك المخصصة
      const repId = match.rep_id ?? match.repId ?? match.assigned_to ?? match.assignee_id ?? null;
      if (repId || status === 'with_rep') {
        // البحث عن اسم المندوب
        const repName = reps.find((r: any) => Number(r.id) === Number(repId))?.name 
                        || match.assigneeName 
                        || (match.assigned && (match.assigned.name || match.assigned.employee)) 
                        || 'مندوب آخر';
                        
        Swal.fire('عفواً، غير مسموح', `لا يمكن إضافة الاوردر لأنها في عهدة "${repName}"`, 'warning');
        setBarcodeInput('');
        return;
      }

      // 2. لو الاوردر مع شركة شحن (علشان نقفل كل الثغرات)
      const compId = match.shipping_company_id ?? match.shippingCompanyId ?? match.shippingCompany ?? null;
      if (compId || status === 'in_delivery') {
        const compName = shippingCompanies.find((c: any) => Number(c.id) === Number(compId))?.name 
                         || match.shipping_company_name 
                         || match.shippingCompanyName 
                         || 'شركة شحن';
                         
        Swal.fire('عفواً، غير مسموح', `لا يمكن إضافة الاوردر لأنها مع شركة شحن "${compName}"`, 'warning');
        setBarcodeInput('');
        return;
      }

      // 3. لو الاوردر حالته حاجة تانية (تم التسليم مثلاً)
      const statusAr = getOrderStatusLabelAr(status);
      
      Swal.fire('عفواً، غير مسموح', `لا يمكن إضافة الاوردر لأن حالته: "${statusAr}".\nمسموح فقط بإضافة الاوردرات "قيد الانتظار" أو "المرتجعة" أو "الملغية".`, 'warning');
      setBarcodeInput('');
      return;
    }

    // منع التكرار في نفس اليومية
    if (todayOrdersUnique.some(o => Number(o.id) === Number(match.id))) {
      setBarcodeInput('');
      return;
    }
    // --- فحص المخزون والـ Smart Match ---
    // (باقي الكود كما هو من أول هنا بدون تغيير)

    // --- بداية الجزء العبقري لفحص المخزون والتعرف على المنتجات تلقائياً ---
    try {
      // 1. جلب قائمة المنتجات من الداتابيز عشان ندور فيها لو المنتج مش مربوط
      const prodsRes = await fetch(`${API_BASE_PATH}/api.php?module=products&action=getFlat`);
      const prodsJson = await prodsRes.json().catch(() => null);
      const allProducts = (prodsJson && prodsJson.success) ? prodsJson.data : [];

      const norm = (txt: any) => (txt || "").toString().trim().replace(/[أإآ]/g, "ا").replace(/ة/g, "ه");

      const prodMap: Record<string, any> = {};
      const unlinkedItems: string[] = [];

      (Array.isArray(match.products) ? match.products : []).forEach((p: any) => {
        // حذاري نستخدم p.id لأنه ده بيكون رقم سطر الأوردر الوهمي مش المنتج!
        let pid = Number(p.productId ?? p.product_id ?? 0); 
        const name = (p.name ?? p.product_name ?? '').toString();
        const color = (p.color ?? p.variant_color ?? p.variant ?? '').toString();
        const size = (p.size ?? p.variant_size ?? p.measure ?? '').toString();
        const qty = toNum(p.quantity ?? p.qty ?? 0);

        if (qty <= 0) return;

        // لو المنتج ملوش ID (جاي من استيراد نصي ومش مربوط)، ندور عليه بذكاء
        if (pid <= 0 && allProducts.length > 0) {
          let found = allProducts.find((ep:any) => 
              norm(ep.name) === norm(name) && 
              norm(ep.color) === norm(color) && 
              norm(ep.size) === norm(size)
          );
          
          if (!found) {
            const potentials = allProducts.filter((ep:any) => norm(ep.name) === norm(name));
            if (potentials.length === 1) found = potentials[0]; // لو مفيش غير منتج واحد بنفس الاسم
          }

          if (found) {
             pid = Number(found.id);
          }
        }

        // لو بعد الفحص الدقيق ملقيناش الـ ID، نرفض الأوردر ونطلب من المستخدم يربطه
        if (pid <= 0) {
          unlinkedItems.push(`${name} (لون: ${color || '-'}، مقاس: ${size || '-'})`);
          return;
        }

        const key = `${pid}`;
        if (!prodMap[key]) {
          prodMap[key] = { product_id: pid, name: name, quantity: 0 };
        }
        prodMap[key].quantity += qty;
      });

      // لو فيه منتجات لسه مش مربوطة نعرض رسالة خطأ شيك
      if (unlinkedItems.length > 0) {
         let html = `<div style="text-align: right; font-size: 14px;">الاوردر يحتوي على منتجات غير متعرفة على المخزن (تم كتابتها يدوياً بدون ربطها). يرجى تعديل الاوردر من قسم الاوردرات أولاً.<br/><br/><ul style="padding-right: 20px; list-style-type: disc;">`;
         unlinkedItems.forEach(item => { html += `<li style="color: #e11d48; margin-bottom: 4px;">${item}</li>`; });
         html += `</ul></div>`;
         
         Swal.fire({ title: 'منتجات غير مرتبطة', html: html, icon: 'error', confirmButtonText: 'حسناً' });
         setBarcodeInput('');
         return;
      }

      const items = Object.values(prodMap);
      if (items.length > 0) {
        const candidateOrderIds = Array.from(new Set([
          ...todayOrdersUnique.map((o: any) => Number(o.id)).filter((id: number) => id > 0),
          Number(match.id)
        ]));
        const stockCheck = await checkCumulativeStockForOrderIds(candidateOrderIds);
        if (!stockCheck.ok) {
          if (stockCheck.shortages && stockCheck.shortages.length > 0) {
            Swal.fire({
              title: 'نقص في المخزون',
              html: buildShortagesHtml(stockCheck.shortages, 'لا يمكن إضافة الأوردر بسبب نقص تراكمي في المخزون للمستودع المحدد:'),
              icon: 'warning',
              confirmButtonText: 'حسناً'
            });
          } else {
            Swal.fire('خطأ', stockCheck.message || 'فشل التحقق من المخزون. حاول مرة أخرى.', 'error');
          }
          setBarcodeInput('');
          return;
        }
      }
    } catch (e) {
      console.debug('Stock check failed', e);
    }
    // --- نهاية الجزء العبقري ---

    setSelectedOrders(prev => [...prev, match]);
    setPendingOrdersList(prev => prev.filter(p => Number(p.id) !== Number(match.id)));
    setBarcodeInput('');
  };

  const printThermal = async (orders: any[], extra: any) => {
            console.log('userDefaults at printThermal:', userDefaults);
            // تحقق من وجود userDefaults.user_id قبل المتابعة
            if (!userDefaults || !userDefaults.user_id) {
              alert('لا يمكن الطباعة: لم يتم تحميل بيانات المستخدم بشكل صحيح. يرجى إعادة تحميل الصفحة أو تسجيل الدخول مجددًا.');
              return;
            }
        // إذا لم يكن اسم الموظف موجودًا في extra (أي طباعة يدوية)، استخدم userDefaults
        if (!extra.createdByName) {
          extra.createdByName = userDefaults?.name || userDefaults?.username || '';
        }
    // Prepare delivery note payload
    const repId = extra?.repId || (orders[0]?.rep_id ?? orders[0]?.repId ?? null);
    const warehouseId = extra?.warehouseId || null;
    // إذا لم يكن هناك createdBy في extra، استخدم userDefaults.id
    const createdBy = typeof extra?.createdBy !== 'undefined' && extra?.createdBy !== null
      ? extra.createdBy
      : (userDefaults?.user_id ?? null);
    const orderId = orders[0]?.id ?? orders[0]?.order_id ?? null;
    
    // Flatten all products from all orders
    const lines: any[] = [];
    orders.forEach(o => {
      (o.products || []).forEach((p: any) => {
        const qty = toNum(p.quantity ?? p.qty ?? 0);
        lines.push({
          product_id: p.productId ?? p.product_id ?? p.id,
          quantity: qty,
          qty: qty,
          journal_code: o.order_number ?? o.orderNumber ?? o.id ?? null
        });
      });
    });
    
    // Call backend to save delivery note
    let noteCode = '';
    try {
      console.log('Sending delivery note data:', {
        order_id: orderId,
        rep_id: repId,
        warehouse_id: warehouseId,
        created_by: createdBy,
        lines_count: lines.length
      });
      
      const res = await fetch(`${API_BASE_PATH}/api.php?module=sales&action=createDeliveryNote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          order_id: orderId,
          rep_id: repId,
          warehouse_id: warehouseId,
          created_by: createdBy,
          items: lines
        })
      });

      const data = await res.json();
      console.log('Delivery note response:', data);

      if (data && data.success && data.data && data.data.note_code) {
        noteCode = data.data.note_code;
        // استخدم اسم الموظف القادم من الباك إند إذا توفر
        if (data.data.created_by_name) {
          extra.createdByName = data.data.created_by_name;
        }
      } else {
        console.error('Failed to save delivery note:', data?.message || 'Unknown error');
        if (data?.error) {
          console.error('Error details:', data.error);
        }
      }
    } catch (e) {
      console.error('Failed to save delivery note:', e);
    }

    const win = window.open('', '_blank', 'width=400,height=800');
    if (!win) return;

    const summaryMap: Record<string, { name: string; color: string; size: string; qty: number }> = {};
    orders.forEach(o => {
      (o.products || []).forEach((p: any) => {
        const key = `${p.name || ''}||${p.color || ''}||${p.size || ''}`;
        if (!summaryMap[key]) summaryMap[key] = { name: p.name || '', color: p.color || '', size: p.size || '', qty: 0 };
        summaryMap[key].qty += toNum(p.quantity || p.qty || 0);
      });
    });

    const rows = Object.values(summaryMap);
    const dateStr = new Date().toLocaleString();
    const totalProducts = rows.length;
    const totalPieces = rows.reduce((s, r) => s + (r.qty || 0), 0);
    const whoLabel = extra?.assigneeLabel || 'المندوب';
    const whoName = extra?.assigneeName || extra?.repName || '';

    // Generate real barcode using JsBarcode
    const barcodeSvg = noteCode
      ? `<div class="center" style="margin:8px 0 4px 0;"><svg id="barcode"></svg></div>` +
      `<script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js"></script>` +
      `<script>JsBarcode("#barcode", "${noteCode}", {format: "CODE128", width: 2, height: 40, displayValue: false, margin: 0});</script>`
      : '';

    // Get the employee name who created the delivery note
    const employeeName = extra?.createdByName || extra?.userName || '';

    const html =
      `<!doctype html><html><head><meta charset="utf-8"><title>أذن تسليم</title>` +
      `<style>@page{size:80mm auto; margin:2mm;}body{font-family: Arial, Helvetica, 'Noto Naskh Arabic', sans-serif; direction:rtl; width:80mm; padding:4px; margin:0; font-size:12px; color:#000;} h1{text-align:center; font-size:18px; font-weight:bold; margin:4px 0; border-bottom:1px solid #000; padding-bottom:4px;} table{width:100%; border-collapse:collapse; font-size:12px;} th,td{font-size:12px; padding:3px 2px; border-bottom:1px solid #ddd; text-align:right;} th{font-weight:700; background-color:#f5f5f5;} .totals{margin-top:6px; font-weight:700; font-size:13px; border-top:1px solid #000; padding-top:4px;} .center{text-align:center;} .small{font-size:11px;} .header-row{display:flex; justify-content:space-between; margin:4px 0;} .header-item{flex:1; text-align:center;}</style>` +
      `<script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js"></script>` +
      `</head><body>` +
      `<h1>أذن تسليم</h1>` +
      barcodeSvg +
      (noteCode ? `<div class="center" style="margin-bottom:4px;"><b>${noteCode}</b></div>` : '') +
      `<div class="header-row">` +
      `<div class="header-item" style="text-align:right;">المندوب: ${whoName}</div>` +
      `<div class="header-item" style="text-align:left;">الموظف: ${employeeName}</div>` +
      `</div>` +
      `<div class="center" style="margin:4px 0;">التاريخ: ${dateStr}</div>` +
      `<div style="border-bottom:1px solid #000; margin:4px 0;"></div>` +
      `<table><thead><tr><th style="width:45%">المنتج</th><th style="width:20%">اللون</th><th style="width:15%">المقاس</th><th style="width:20%">الكمية</th></tr></thead><tbody>` +
      rows
        .map(r => `<tr><td style="word-break:break-word">${r.name}</td><td>${r.color}</td><td>${r.size}</td><td style="text-align:left">${r.qty}</td></tr>`)
        .join('') +
      `</tbody></table>` +
      `<div class="totals">اجمالى المنتجات: ${totalProducts}</div>` +
      `<div class="totals">اجمالى القطع: ${totalPieces}</div>` +
      (noteCode ? `<script>JsBarcode("#barcode", "${noteCode}", {format: "CODE128", width: 2, height: 40, displayValue: false, margin: 0});</script>` : '') +
      `</body></html>`;

    win.document.write(html);
    win.document.close();
    setTimeout(() => win.print(), 500);
  };

  const printA4Report = async (orders: any[], extra: any) => {
    const win = window.open('', '_blank');
    if (!win) return;

    const ordersParam = Array.isArray(orders) ? orders : [];

    const dateStr = new Date().toLocaleDateString();
    const reportTitle = extra?.reportTitle || (isShippingMode ? 'يومية شركة الشحن' : 'يومية المندوب');
    const whoLabel = extra?.assigneeLabel || (isShippingMode ? 'شركة الشحن' : 'المندوب');
    const whoName = extra?.assigneeName || extra?.repName || extra?.whoName || '';

    // Report value should reflect order subtotals (exclude shipping)
    const sumValue = ordersParam.reduce((s: number, o: any) => s + orderSubtotal(o), 0);

    const showMoney = !isShippingMode;
    // compute safe local summary values (fall back to recomputing if component-level values are missing)
    const localOldOrders = Array.isArray(assignedOrders) ? assignedOrders : [];
    const localOldOrdersValue = typeof oldOrdersValue !== 'undefined' ? oldOrdersValue : localOldOrders.reduce((s: number, o: any) => s + orderSubtotal(o), 0);
    const localOldOrdersCount = localOldOrders.length || (typeof oldOrdersCount !== 'undefined' ? oldOrdersCount : 0);
    const localOldPiecesCount = typeof oldPiecesCount !== 'undefined' ? oldPiecesCount : localOldOrders.reduce((s: number, o: any) => s + orderPieces(o), 0);
    const localOldDistinct = typeof oldDistinctProductsCount !== 'undefined' ? oldDistinctProductsCount : (() => {
      const set = new Set<string>();
      (localOldOrders || []).forEach((o: any) => (Array.isArray(o.products) ? o.products : []).forEach((p:any)=> set.add(String(p.productId ?? p.product_id ?? p.id ?? p.name ?? ''))));
      return set.size;
    })();
    const localTodayPieces = typeof todayPiecesCount !== 'undefined' ? todayPiecesCount : ordersParam.reduce((s:number,o:any)=> s + (Array.isArray(o.products) ? o.products.reduce((ss:number,p:any)=> ss + toNum(p.quantity ?? p.qty ?? 0),0) : 0),0);
    const localTodayDistinct = typeof todayDistinctProductsCount !== 'undefined' ? todayDistinctProductsCount : (() => {
      const set = new Set<string>();
      (ordersParam || []).forEach((o:any) => (Array.isArray(o.products) ? o.products : []).forEach((p:any)=> set.add(String(p.productId ?? p.product_id ?? p.id ?? p.name ?? ''))));
      return set.size;
    })();
    const localTotalPieces = (localOldPiecesCount || 0) + (localTodayPieces || 0);
    const localTotalOrdersCount = (localOldOrdersCount || 0) + (orders ? orders.length : 0);
    const paidNowLocalSigned = toNum(typeof extra?.paidNow !== 'undefined' ? extra.paidNow : (paymentAction === 'collect' ? paymentAdjustment : -paymentAdjustment));
    const prevBal = toNum(extra?.prevBalance ?? prevBalance);
    const finalBalBeforePay = prevBal - sumValue;
    const afterPay = finalBalBeforePay + paidNowLocalSigned;
    const localOldShipping = localOldOrders.reduce((s:number,o:any)=> s + parseNumeric(o.shipping ?? o.shipping_fees ?? o.shippingCost ?? 0),0);
    const localTodayShipping = ordersParam.reduce((s:number,o:any)=> s + parseNumeric(o.shipping ?? o.shipping_fees ?? o.shippingCost ?? 0),0);
    const localTotalShipping = (localOldShipping || 0) + (localTodayShipping || 0);

    // Prepare and save a delivery session snapshot to server so the exact data can be retrieved/printed later
    try {
      const sessionPayload: any = {
        rep_id: Number(reps.find((r:any)=> Number(r.id) === Number(selectedRepId))?.id || selectedRepId) || null,
        treasury_id: selectedTreasuryId ? Number(selectedTreasuryId) : null,
        store_id: selectedWarehouseId ? Number(selectedWarehouseId) : null,
        previous_balance: prevBal,
        old_orders_count: localOldOrdersCount,
        old_pieces_count: localOldPiecesCount,
        old_orders_value: localOldOrdersValue,
        today_orders_count: ordersParam.length,
        today_pieces_count: localTodayPieces,
        today_orders_value: sumValue,
        total_orders_count: localTotalOrdersCount,
        total_pieces_count: localTotalPieces,
        total_orders_value: (localOldOrdersValue || 0) + (sumValue || 0),
        final_balance_before_pay: finalBalBeforePay,
        payment_type: String(typeof extra?.paymentAction !== 'undefined' ? extra.paymentAction : paymentAction),
        paid_amount: Math.abs(typeof extra?.paidNow !== 'undefined' ? extra.paidNow : paidNowLocalSigned),
        remaining_after_pay: afterPay,
        orders_data: []
      };

      // Build orders list with source flag
      const seen = new Set<number>();
      (localOldOrders || []).forEach((o: any) => {
        const id = Number(o.id || o.order_id || 0);
        if (!id) return;
        seen.add(id);
        sessionPayload.orders_data.push({ id, order_number: o.orderNumber ?? o.order_number ?? id, customer_name: o.customerName ?? o.customer_name ?? '', type: 'old', pieces: orderPieces(o), value: orderSubtotal(o) });
      });
      (ordersParam || []).forEach((o: any) => {
        const id = Number(o.id || o.order_id || 0);
        if (!id) return;
        if (seen.has(id)) return;
        sessionPayload.orders_data.push({ id, order_number: o.orderNumber ?? o.order_number ?? id, customer_name: o.customerName ?? o.customer_name ?? '', type: 'today', pieces: orderPieces(o), value: orderSubtotal(o) });
      });

      try {
        const r = await fetch(`${API_BASE_PATH}/api.php?module=sales&action=createDeliverySession`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(sessionPayload)
        });
        const jr = await r.json().catch(()=>null);
        if (!(jr && jr.success)) console.warn('Failed to save delivery session', jr);
      } catch (err) {
        console.warn('Error saving delivery session', err);
      }
    } catch (ex) {
      console.warn('Preparing delivery session failed', ex);
    }

    const html =
      `<!doctype html><html><head><meta charset="utf-8"><title>${reportTitle}</title>` +
      `<style>
        body{font-family: Arial, Helvetica, "Noto Naskh Arabic", sans-serif; direction:rtl; padding:20px;}
        h1{text-align:center;}
        .header{display:flex; justify-content:space-between; align-items:center;}
        table{width:100%; border-collapse:collapse; margin-top:12px;}
        th,td{border:1px solid #333; padding:6px; font-size:12px; text-align:center;}
        th{background:#eee;}
        .grid{display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-top:10px;}
        .box{border:1px solid #ddd; padding:8px; border-radius:8px;}
      </style></head><body>` +
      `<div class="header"><div></div><div><h1>${reportTitle}</h1></div><div></div></div>` +
      `<div style="margin-top:8px">التاريخ: ${dateStr}</div>` +
      `<div style="margin-top:4px">يومية المندوب "${whoName}"</div>` +
      `<div style="margin-top:4px">مصروفات الشحن: ${localTotalShipping.toLocaleString()} ج.م</div>` +
      `<div style="margin-top:4px">الإجمالي شامل الشحن: ${(localOldOrdersValue + sumValue + localTotalShipping).toLocaleString()} ج.م</div>` +
      (showMoney
        ? `<div style="display:grid; grid-template-columns:repeat(3,1fr); gap:12px; margin-top:10px;">
            <div style="border:1px solid #ddd; padding:10px; border-radius:8px; background:#fff">
              <div style="font-weight:800; margin-bottom:8px;">الأرصدة القديمة</div>
              <div>قيمه الاوردرات القديمه: <b>${localOldOrdersValue.toLocaleString()} ج.م</b></div>
              <div style="margin-top:6px">الرصيد السابق (دين/رصيد): <b>${balanceLabel(prevBal)} ${Math.abs(prevBal).toLocaleString()} ج.م</b></div>
              <div style="margin-top:6px">اجمالي الاوردرات القديمه: <b>${localOldOrdersCount}</b></div>
              <div style="margin-top:4px">منتجات مميزة: <b>${localOldDistinct}</b></div>
              <div style="margin-top:4px">قطع قديمة: <b>${localOldPiecesCount.toLocaleString()}</b></div>
            </div>
            <div style="border:1px solid #ddd; padding:10px; border-radius:8px; background:#fff">
              <div style="font-weight:800; margin-bottom:8px;">تسليم اليوم (المحدد الآن)</div>
                <div>قيمة اوردرات اليوم: <b>${sumValue.toLocaleString()} ج.م</b></div>
                  <div style="margin-top:6px">عدد اوردرات اليوم: <b>${ordersParam.length}</b></div>
              <div style="margin-top:6px">عدد قطع اليوم: <b>${localTodayPieces}</b></div>
              <div style="margin-top:4px">منتجات مميزة: <b>${localTodayDistinct}</b></div>
            </div>
            <div style="border:1px solid #ddd; padding:10px; border-radius:8px; background:#fff">
              <div style="font-weight:800; margin-bottom:8px;">الإجماليات</div>
              <div>اجمالي الاوردرات: <b>${(localOldOrdersValue + sumValue).toLocaleString()} ج.م</b></div>
              <div style="margin-top:6px">في عهدة: ${localOldOrdersValue.toLocaleString()} + اليوم: ${sumValue.toLocaleString()}</div>
              <div style="margin-top:6px">الدين النهائي (قديم + اليوم): <b>${balanceLabel(finalBalBeforePay)} ${Math.abs(finalBalBeforePay).toLocaleString()} ج.م</b></div>
              <div style="margin-top:6px">إجمالي الاوردرات: <b>${localTotalOrdersCount}</b> (قديم ${localOldOrdersCount} + اليوم ${orders.length})</div>
              <div style="margin-top:6px">إجمالي القطع: <b>${localTotalPieces.toLocaleString()}</b> (قديم ${localOldPiecesCount.toLocaleString()} + اليوم ${localTodayPieces})</div>
            </div>
          </div>
          <div style="display:grid; grid-template-columns:repeat(2,1fr); gap:12px; margin-top:12px;">
            <div style="border:1px solid #ddd; padding:10px; border-radius:8px; background:#eefbf1">
              <div style="font-weight:800; margin-bottom:6px;">المبلغ المدفوع الآن</div>
              <div>النوع: <b>${paymentAction === 'collect' ? 'تحصيل من المندوب' : 'دفع إلى المندوب'}</b></div>
              <div style="margin-top:6px">المبلغ الآن: <b>${Math.abs(paymentAdjustment).toLocaleString()} ج.م</b></div>
              <div style="margin-top:6px; color:${paymentAction === 'collect' ? '#059669' : '#be123c'}">${paymentAction === 'collect' ? 'تحصيل — يقلل مديونية المندوب' : 'دفع — يزيد مديونية المندوب'}</div>
            </div>
            <div style="border:1px solid #ddd; padding:10px; border-radius:8px; background:#fff5f6">
              <div style="font-weight:800; margin-bottom:6px;"الباقي بعد الدفع</div>
              <div style="font-size:20px; font-weight:800;">${Math.abs(afterPay).toLocaleString()} ${balanceLabel(afterPay)} ج.م</div>
              <div style="margin-top:6px">الرصيد بعد الدفع: ${Math.abs(afterPay).toLocaleString()} (${balanceLabel(afterPay)})</div>
            </div>
          </div>`
        : '') +
        `<table><thead><tr>
          <th>رقم اوردر</th><th>اسم العميل</th><th>الهاتف</th><th>المحافظة</th><th>العنوان</th>
          <th>الموظف</th><th>البيدج</th><th>الإجمالي</th><th>شحن</th><th>الإجمالي الكلي</th><th>ملاحظات</th>
        </tr></thead><tbody>` +
      ordersParam
        .map((o: any) => {
          const sub = toNum(o.subTotal ?? o.total_amount ?? o.total ?? 0);
          const ship = toNum(o.shipping ?? o.shipping_fees ?? o.shippingCost ?? 0);
          const tot = sub + ship;
          return `<tr>
            <td>${o.orderNumber ?? o.order_number ?? o.id ?? ''}</td>
            <td>${o.customerName ?? o.customer_name ?? ''}</td>
            <td>${o.phone ?? o.phone1 ?? ''}</td>
            <td>${o.governorate ?? ''}</td>
            <td>${o.address ?? ''}</td>
            <td>${o.employee ?? ''}</td>
            <td>${o.page ?? ''}</td>
            <td>${sub.toLocaleString()}</td>
            <td>${ship.toLocaleString()}</td>
            <td>${tot.toLocaleString()}</td>
            <td>${o.notes ?? ''}</td>
          </tr>`;
        })
        .join('');

    // Append combined products summary for the rep: include assignedOrders (old custody) + today's orders
    let productsSummaryHtml = '';
    try {
      const combined = [...(assignedOrders || []), ...ordersParam];
      const summaryMap: Record<string, { name: string; color: string; size: string; qty: number }> = {};
      combined.forEach((o: any) => {
        (o.products || []).forEach((p: any) => {
          const key = `${p.name || ''}||${p.color || ''}||${p.size || ''}`;
          if (!summaryMap[key]) summaryMap[key] = { name: p.name || '', color: p.color || '', size: p.size || '', qty: 0 };
          summaryMap[key].qty += toNum(p.quantity ?? p.qty ?? 0);
        });
      });
      const prodRows = Object.values(summaryMap).map(r => `<tr><td>${r.name}</td><td>${r.color}</td><td>${r.size}</td><td>${r.qty}</td></tr>`).join('');
      productsSummaryHtml = `
        <h3 style="margin-top:18px;"البضاعه المستلمه - جميع المنتجات (قديم + اليوم)</h3>
        <table style="width:100%; border-collapse:collapse; margin-top:8px;">
          <thead><tr><th>المنتج</th><th>اللون</th><th>المقاس</th><th>الكمية</th></tr></thead>
          <tbody>${prodRows}</tbody>
        </table>
      `;
    } catch (e) {
      productsSummaryHtml = '';
    }

    // If there are no orders and no assignedOrders, show a clear message so report isn't visually empty
    const noOrdersMessageHtml = (!Array.isArray(assignedOrders) || assignedOrders.length === 0) && ordersParam.length === 0
      ? `<div style="margin-top:18px; padding:12px; border:1px dashed #ccc; text-align:center;">لا توجد اوردرات لعرضها في اليومية.</div>`
      : '';

    const mainTableHtml = `<!doctype html><html><head><meta charset="utf-8"><title>${reportTitle}</title>` +
      `<style>
        body{font-family: Arial, Helvetica, "Noto Naskh Arabic", sans-serif; direction:rtl; padding:12px;}
        h1{font-size:18px; text-align:center; margin:0 0 6px 0}
        h2{font-size:14px; margin:6px 0}
        .header{display:flex; justify-content:space-between; align-items:center;}
        table{width:100%; border-collapse:collapse; margin-top:8px;}
        th,td{border:1px solid #333; padding:5px; font-size:11px; text-align:right}
        th{background:#eee;}
        .grid{display:grid; grid-template-columns:repeat(2,1fr); gap:6px; margin-top:8px}
        .box{border:1px solid #ddd; padding:6px; border-radius:6px;}
        .muted{font-size:11px; color:#555}
      </style></head><body>` +
      `<div class="header"><div></div><div style="text-align:center;"><h1>${reportTitle} ${whoName}</h1></div><div></div></div>` +
      `<div style="display:flex; gap:12px; align-items:flex-start; margin-top:8px; font-size:12px">
        <div style="flex:0 0 auto; min-width:160px; padding:6px">التاريخ: <b>${dateStr}</b></div>
        ${showMoney ? `
          <div style="flex:1; display:flex; gap:10px; align-items:flex-start">
            <div style="flex:1; padding:6px; border:1px solid #ddd; border-radius:6px">
              <div style="font-weight:700;">الأرصدة القديمة</div>
              <div>قيمة اوردرات قديمة: <b>${localOldOrdersValue.toLocaleString()} ج.م</b></div>
              <div>المستحق: <b>${balanceLabel(prevBal)} ${Math.abs(prevBal).toLocaleString()} ج.م</b></div>
              <div>الاوردرات: <b>${localOldOrdersCount}</b> • قطع: <b>${localOldPiecesCount.toLocaleString()}</b></div>
            </div>

            <div style="flex:1; padding:6px; border:1px solid #ddd; border-radius:6px">
              <div style="font-weight:700;">تسليم اليوم (المحدد الآن)</div>
              <div>قيمة اوردرات اليوم: <b>${sumValue.toLocaleString()} ج.م</b></div>
              <div>عدد اوردرات: <b>${ordersParam.length}</b> • قطع: <b>${localTodayPieces}</b></div>
            </div>

            <div style="flex:1; padding:6px; border:1px solid #ddd; border-radius:6px; background:#f0fdf4">
              <div style="font-weight:700;">المبلغ المدفوع الآن</div>
              <div>النوع: <b>${paymentAction === 'collect' ? 'تحصيل' : 'دفع'}</b></div>
              <div>المبلغ: <b>${Math.abs(paymentAdjustment).toLocaleString()} ج.م</b></div>
            </div>

            <div style="flex:0 0 180px; padding:6px; border:1px solid #ddd; border-radius:6px; background:#fff5f6">
              <div style="font-weight:700;">الباقي بعد الدفع</div>
              <div style="font-weight:800; font-size:14px">${Math.abs(afterPay).toLocaleString()} ${balanceLabel(afterPay)} ج.م</div>
            </div>
          </div>` : ''}
      </div>` +
        `<table><thead><tr>
          <th>رقم اوردر</th><th>اسم العميل</th><th>الهاتف</th><th>المحافظة</th><th>العنوان</th>
          <th>الموظف</th><th>البيدج</th><th>الإجمالي</th><th>شحن</th><th>الإجمالي الكلي</th><th>ملاحظات</th>
        </tr></thead><tbody>` +
      ordersParam.map((o: any) => {
        const sub = orderSubtotal(o);
        const ship = parseNumeric(o.shipping ?? o.shipping_fees ?? o.shippingCost ?? 0);
        const tot = orderTotal(o);
        const emp = o.employee ?? o.employee_name ?? o.assigneeName ?? o.assigned_to ?? (o.assigned && (o.assigned.name || o.assigned.employee)) ?? '';
        const pg = o.page ?? o.page_number ?? o.page_no ?? o.pageNumber ?? o.package_page ?? '';
        return `<tr>
            <td>${o.orderNumber ?? o.order_number ?? o.id ?? ''}</td>
            <td>${o.customerName ?? o.customer_name ?? ''}</td>
            <td>${o.phone ?? o.phone1 ?? ''}</td>
            <td>${o.governorate ?? ''}</td>
            <td>${o.address ?? ''}</td>
            <td>${emp}</td>
            <td>${pg}</td>
            <td>${sub.toLocaleString()}</td>
            <td>${ship.toLocaleString()}</td>
            <td>${tot.toLocaleString()}</td>
            <td>${o.notes ?? ''}</td>
          </tr>`;
      }).join('') +
      `</tbody></table>`;

    // Build an "اوردرات نزول" table for assigned (old) orders, show if any
    const oldOrdersList = Array.isArray(assignedOrders) ? assignedOrders : [];
    let oldOrdersTableHtml = '';
    if (oldOrdersList.length > 0) {
      const oldRows = oldOrdersList.map((o: any) => {
        const sub = orderSubtotal(o);
        const ship = parseNumeric(o.shipping ?? o.shipping_fees ?? o.shippingCost ?? 0);
        const tot = orderTotal(o);
        const emp = o.employee ?? o.employee_name ?? o.assigneeName ?? o.assigned_to ?? (o.assigned && (o.assigned.name || o.assigned.employee)) ?? '';
        const pg = o.page ?? o.page_number ?? o.page_no ?? o.pageNumber ?? o.package_page ?? '';
        return `<tr>
            <td>${o.orderNumber ?? o.order_number ?? o.id ?? ''}</td>
            <td>${o.customerName ?? o.customer_name ?? ''}</td>
            <td>${o.phone ?? o.phone1 ?? ''}</td>
            <td>${o.governorate ?? ''}</td>
            <td>${o.address ?? ''}</td>
            <td>${emp}</td>
            <td>${pg}</td>
            <td>${sub.toLocaleString()}</td>
            <td>${ship.toLocaleString()}</td>
            <td>${tot.toLocaleString()}</td>
            <td>${o.notes ?? ''}</td>
          </tr>`;
      }).join('');

      oldOrdersTableHtml = `
        <h3 style="margin-top:16px;">اوردرات نزول (الاوردرات القديمة)</h3>
        <table style="width:100%; border-collapse:collapse; margin-top:8px;">
          <thead><tr>
            <th>رقم اوردر</th><th>اسم العميل</th><th>الهاتف</th><th>المحافظة</th><th>العنوان</th>
            <th>الموظف</th><th>البيدج</th><th>الإجمالي</th><th>شحن</th><th>الإجمالي الكلي</th><th>ملاحظات</th>
          </tr></thead>
          <tbody>${oldRows}</tbody>
        </table>
      `;
    }

    const finalBody = (typeof noOrdersMessageHtml !== 'undefined' ? noOrdersMessageHtml : '') + (typeof oldOrdersTableHtml !== 'undefined' ? oldOrdersTableHtml : '') + (typeof productsSummaryHtml !== 'undefined' ? productsSummaryHtml : '');

    const finalHtml = mainTableHtml + finalBody + `</body></html>`;

    win.document.write(finalHtml);
    win.document.close();
    setTimeout(() => win.print(), 500);
  };

  const onComplete = async () => {
    const assigneeId = isShippingMode ? selectedShippingCompanyId : selectedRepId;
    if (!assigneeId) {
      Swal.fire(isShippingMode ? 'اختر شركة الشحن' : 'اختر المندوب', 'الرجاء اختيار جهة قبل إتمام اليومية', 'error');
      return;
    }

    if (isShippingMode) {
      const ordersToAssign = todayOrdersUnique;
        if (ordersToAssign.length === 0) {
        Swal.fire('اختر اوردرات', 'الرجاء اختيار اوردرات لتسليمها لشركة الشحن', 'error');
        return;
      }

      try {
        await Promise.all(
          ordersToAssign.map((o: any) =>
            fetch(`${API_BASE_PATH}/api.php?module=orders&action=update`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ id: o.id, shippingCompanyId: assigneeId, repId: null, status: 'in_delivery', employee: employee || null, page: page || null })
            })
          )
        );

        const companyName = shippingCompanies.find(c => Number(c.id) === Number(assigneeId))?.name || '';
        Swal.fire('تم', 'تم تسليم الاوردرات لشركة الشحن.', 'success');
        printA4Report(ordersToAssign, {
          assigneeLabel: 'شركة الشحن',
          assigneeName: companyName,
          reportTitle: 'يومية شركة الشحن',
          prevBalance: 0
        });

        setSelectedOrders([]);
        setSelectedPendingIds([]);
        return;
      } catch (e) {
        console.error('Shipping daily assignment failed', e);
        Swal.fire('خطأ', 'فشل إتمام اليومية لشركة الشحن.', 'error');
        return;
      }
    }

    const ordersToAssign = todayOrdersUnique;
    if (ordersToAssign.length === 0) {
      Swal.fire('اختر اوردرات', 'الرجاء اختيار اوردرات لليومية قبل الإتمام.', 'error');
      return;
    }

    const completeStockCheck = await checkCumulativeStockForOrderIds(ordersToAssign.map((o: any) => Number(o.id)));
    if (!completeStockCheck.ok) {
      if (completeStockCheck.shortages && completeStockCheck.shortages.length > 0) {
        Swal.fire({
          title: 'نقص في المخزون',
          html: buildShortagesHtml(completeStockCheck.shortages, 'لا يمكن إتمام اليومية لأن المخزون غير كافٍ لهذه الأوردرات:'),
          icon: 'warning'
        });
      } else {
        Swal.fire('خطأ', completeStockCheck.message || 'فشل التحقق من المخزون.', 'error');
      }
      return;
    }

    if (Math.abs(paymentAdjustment) > 0 && !selectedTreasuryId) {
      Swal.fire('اختر الخزينة', 'هناك مبلغ مدفوع الآن ويجب اختيار الخزينة الخاصة به.', 'warning');
      return;
    }

    // Automatically set movement reason to 'بدء اليومية' when warehouse is involved
    let dailyReason = '';
    if (selectedWarehouseId && todayPiecesCount > 0) {
      dailyReason = 'بدء اليومية';
    }

    const repName = reps.find(r => Number(r.id) === Number(selectedRepId))?.name || '';
    const confirm = await Swal.fire({
      title: 'تأكيد إتمام اليومية',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'إتمام',
      cancelButtonText: 'إلغاء',
      html: `
        <div style="text-align:right; line-height:1.9">
          <div><b>المندوب:</b> ${repName}</div>
          <hr/>
          <div><b>الرصيد السابق:</b> ${Math.abs(prevBalance).toLocaleString()} (${balanceLabel(prevBalance)})</div>
          <div><b>اوردرات قديمة في العهدة:</b> ${oldOrdersCount}</div>
          <div><b>قطع قديمة:</b> ${oldPiecesCount.toLocaleString()}</div>
          <hr/>
          <div><b>قيمة اوردرات اليوم:</b> ${todayValue.toLocaleString()}</div>
          <div><b>عدد اوردرات اليوم:</b> ${todayOrdersCount}</div>
          <div><b>عدد قطع اليوم:</b> ${todayPiecesCount.toLocaleString()}</div>
          <hr/>
          <div><b>الدين النهائي قبل الدفع:</b> ${Math.abs(finalBalanceBeforePayment).toLocaleString()} (${balanceLabel(finalBalanceBeforePayment)})</div>
          <div><b>نوع المعاملة:</b> ${paymentAction === 'collect' ? 'تحصيل من المندوب' : 'دفع إلى المندوب'}</div>
          <div><b>المبلغ الآن:</b> ${Math.abs(paymentAdjustment).toLocaleString()} ({paymentAction === 'collect' ? 'له' : 'عليه'})</div>
          <div><b>الدين المتبقي بعد العملية:</b> ${Math.abs(remainingDebt).toLocaleString()} (${balanceLabel(balanceAfterPayment)})</div>
          <hr/>
          <div><b>إجمالي الاوردرات:</b> ${totalOrdersCount} (قديم ${oldOrdersCount} + اليوم ${todayOrdersCount})</div>
          <div><b>إجمالي القطع:</b> ${totalPiecesCount.toLocaleString()}</div>
        </div>
      `
    });
    if (!confirm.isConfirmed) return;

    const payload = {
      repId: Number(selectedRepId),
      orders: ordersToAssign.map(o => Number(o.id)),
      treasuryId: selectedTreasuryId ? Number(selectedTreasuryId) : null,
      warehouseId: selectedWarehouseId ? Number(selectedWarehouseId) : null,
      employee: employee || null,
      page: page || null,
      paymentAdjustment: paidNowSigned,
      paymentAction: paymentAction,
      totalAmount: todayValue,
      productsCount: todayPiecesCount,
      reason: dailyReason || null
    };

    try {
      const resp = await fetch(`${API_BASE_PATH}/api.php?module=sales&action=completeDaily`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const jr = await resp.json();

      if (jr && jr.success) {
        Swal.fire('تم', 'تمت معالجة اليومية وطباعه اليومية.', 'success');
        printA4Report(ordersToAssign, { ...(jr.reportData || {}), repName, prevBalance, paidNow: paidNowSigned });

        await loadRepContext(Number(selectedRepId));
        setSelectedOrders([]);
        setSelectedPendingIds([]);
        setPaymentAdjustment(0);
        refreshPendingOrdersList();
      } else {
        Swal.fire('فشل', jr?.message || 'لم يؤكد الخادم المعالجة.', 'error');
      }
    } catch (e) {
      console.error('Complete daily failed', e);
      Swal.fire('خطأ', 'فشل إتمام اليومية: راجع الكونسول.', 'error');
    }
  };

  // Silent completion: complete daily and print without any modals or confirmations
  const onCompleteSilent = async () => {
    try {
      const assigneeId = isShippingMode ? selectedShippingCompanyId : selectedRepId;
      if (!assigneeId) return;

      if (isShippingMode) {
        const ordersToAssign = todayOrdersUnique;
        if (!ordersToAssign || ordersToAssign.length === 0) return;

        await Promise.all(
          ordersToAssign.map((o: any) =>
            fetch(`${API_BASE_PATH}/api.php?module=orders&action=update`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ id: o.id, shippingCompanyId: assigneeId, repId: null, status: 'in_delivery' })
            })
          )
        );

        const companyName = shippingCompanies.find(c => Number(c.id) === Number(assigneeId))?.name || '';
        printA4Report(ordersToAssign, {
          assigneeLabel: 'شركة الشحن',
          assigneeName: companyName,
          reportTitle: 'يومية شركة الشحن',
          prevBalance: 0
        });

        setSelectedOrders([]);
        setSelectedPendingIds([]);
        return;
      }

      const ordersToAssign = todayOrdersUnique;
      if (!ordersToAssign || ordersToAssign.length === 0) return;
      if (Math.abs(paymentAdjustment) > 0 && !selectedTreasuryId) return;

      const completeStockCheck = await checkCumulativeStockForOrderIds(ordersToAssign.map((o: any) => Number(o.id)));
      if (!completeStockCheck.ok) {
        if (completeStockCheck.shortages && completeStockCheck.shortages.length > 0) {
          await Swal.fire({
            title: 'نقص في المخزون',
            html: buildShortagesHtml(completeStockCheck.shortages, 'لا يمكن إتمام اليومية لأن المخزون غير كافٍ لهذه الأوردرات:'),
            icon: 'warning'
          });
        }
        return;
      }

      let dailyReason = '';
      if (selectedWarehouseId && todayPiecesCount > 0) dailyReason = 'بدء اليومية';

      const payload = {
        repId: Number(selectedRepId),
        orders: ordersToAssign.map(o => Number(o.id)),
        treasuryId: selectedTreasuryId ? Number(selectedTreasuryId) : null,
        warehouseId: selectedWarehouseId ? Number(selectedWarehouseId) : null,
        employee: employee || null,
        page: page || null,
        paymentAdjustment: paidNowSigned,
        paymentAction: paymentAction,
        totalAmount: todayValue,
        productsCount: todayPiecesCount,
        reason: dailyReason || null
      };

      const resp = await fetch(`${API_BASE_PATH}/api.php?module=sales&action=completeDaily`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const jr = await resp.json().catch(() => null);
      if (jr && jr.success) {
        // print using server-provided data when available (A4 daily)
        printA4Report(ordersToAssign, { ...(jr.reportData || {}), repName: reps.find(r => Number(r.id) === Number(selectedRepId))?.name || '', prevBalance, paidNow: paidNowSigned });

        await loadRepContext(Number(selectedRepId));
        setSelectedOrders([]);
        setSelectedPendingIds([]);
        setPaymentAdjustment(0);
        refreshPendingOrdersList();
      } else {
        console.error('Silent complete failed', jr);
      }
    } catch (e) {
      console.error('Silent complete error', e);
    }
  };

  const assigneeName = isShippingMode
    ? shippingCompanies.find(c => Number(c.id) === Number(selectedShippingCompanyId))?.name || ''
    : reps.find(r => Number(r.id) === Number(selectedRepId))?.name || '';

  const repChosen = isShippingMode ? Boolean(selectedShippingCompanyId) : Boolean(selectedRepId);
  const treasuryChosen = Boolean(selectedTreasuryId);
  const warehouseChosen = Boolean(selectedWarehouseId);
  const startDailyUnlocked = repChosen && treasuryChosen && warehouseChosen;
  // Toggle for showing the pending orders box (hidden by default)
  const showPendingOrdersBox = false;

  return (
    <div className="p-6 space-y-6">
      <div className="bg-white dark:bg-slate-800 rounded-3xl p-4 shadow-sm border border-slate-200 dark:border-slate-700">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="flex items-center gap-3">
            <User className="text-blue-600" />
              <div className="w-full">
              <div className="text-xs text-slate-500">{isShippingMode ? 'شركة الشحن المختارة' : 'المندوب المختار'}</div>
              <CustomSelect
                value={(isShippingMode ? String(selectedShippingCompanyId || '') : String(selectedRepId || ''))}
                onChange={v => {
                  const num = v ? Number(v) : '';
                  if (isShippingMode) onSelectShippingCompany(num as any);
                  else onSelectRep(num as any);
                }}
                options={[{ value: '', label: isShippingMode ? 'اختر شركة الشحن' : 'اختر المندوب' }, ...((isShippingMode ? shippingCompanies : reps).map((r:any)=>({ value: String(r.id), label: r.name })))]}
                className="w-full"
              />
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/30 p-4">
            <div className="text-xs text-slate-500 mb-2">طريقة الدفع</div>
            <div className="flex gap-2 mb-3">
              <button
                type="button"
                onClick={() => {
                  setPaymentMethod('cash');
                  if (userDefaults && userDefaults.default_treasury_id) {
                    setSelectedTreasuryId(Number(userDefaults.default_treasury_id));
                  }
                }}
                className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition-all ${paymentMethod === 'cash' ? 'bg-blue-600 text-white shadow-md' : 'bg-white dark:bg-slate-800 text-slate-600 border border-slate-200 dark:border-slate-700'}`}
              >كاش</button>
              <button
                type="button"
                onClick={async () => {
                  setPaymentMethod('electronic');
                  const electronicTreasuryName = 'مدفوعات إليكترونية';
                  setLoading(true);
                  try {
                    // Step 1: جلب أحدث قائمة خزائن من الخادم
                    const trResp1 = await fetch(`${API_BASE_PATH}/api.php?module=treasuries&action=getAll`).then(r => r.json()).catch(() => null);
                    const freshList1: any[] = (trResp1 && trResp1.success) ? (trResp1.data || []) : treasuries;
                    if (trResp1 && trResp1.success) setTreasuries(freshList1);

                    // Step 2: البحث عن الخزينة بالاسم في القائمة الحديثة
                    const found1 = freshList1.find((t: any) => normalizeText(t.name) === normalizeText(electronicTreasuryName));
                    if (found1) {
                      setSelectedTreasuryId(Number(found1.id));
                      return;
                    }

                    // Step 3: الخزينة غير موجودة — إنشاؤها
                    const createRes = await fetch(`${API_BASE_PATH}/api.php?module=treasuries&action=create`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ name: electronicTreasuryName, balance: 0 })
                    });
                    const createJson = await createRes.json().catch(() => null);

                    // Step 4: إعادة جلب القائمة للتأكد (تجنب التكرار)
                    const trResp2 = await fetch(`${API_BASE_PATH}/api.php?module=treasuries&action=getAll`).then(r => r.json()).catch(() => null);
                    const freshList2: any[] = (trResp2 && trResp2.success) ? (trResp2.data || []) : freshList1;
                    if (trResp2 && trResp2.success) {
                      // منع التكرار في العرض
                      const deduplicated = freshList2.filter((t: any, idx: number, arr: any[]) => arr.findIndex((x: any) => normalizeText(x.name) === normalizeText(t.name)) === idx);
                      setTreasuries(deduplicated);
                    }

                    // Step 5: البحث بالاسم في القائمة المحدثة (أكثر موثوقية من ID)
                    const found2 = freshList2.find((t: any) => normalizeText(t.name) === normalizeText(electronicTreasuryName));
                    if (found2) {
                      setSelectedTreasuryId(Number(found2.id));
                    } else if (createJson && createJson.success && createJson.data?.id) {
                      // احتياطي: استخدام ID المُعاد من الإنشاء
                      setSelectedTreasuryId(Number(createJson.data.id));
                    }
                  } catch (e) {
                    console.error('Electronic treasury setup failed:', e);
                  } finally {
                    setLoading(false);
                  }
                }}
                className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition-all ${paymentMethod === 'electronic' ? 'bg-blue-600 text-white shadow-md' : 'bg-white dark:bg-slate-800 text-slate-600 border border-slate-200 dark:border-slate-700'}`}
              >مدفوعات إليكترونية</button>
            </div>
            {paymentMethod === 'cash' ? (
              <>
                <div className="text-xs text-slate-500 mb-2">الخزينة (مطلوبة إذا كان هناك مبلغ مدفوع الآن)</div>
                <CustomSelect
                  value={selectedTreasuryId ? String(selectedTreasuryId) : ''}
                  onChange={v => setSelectedTreasuryId(v ? Number(v) : '')}
                  options={[{ value: '', label: 'بدون خزينة' }, ...treasuries.map((t:any)=>({ value: String(t.id), label: t.name }))]}
                  className="w-full"
                  disabled={!repChosen}
                />
              </>
            ) : (
              <div className="text-xs font-bold text-blue-600 bg-blue-50 dark:bg-blue-900/20 p-2 rounded-lg border border-blue-100 dark:border-blue-800/50">
                تم اختيار خزينة "مدفوعات إليكترونية" تلقائياً
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/30 p-4">
            <div className="text-xs text-slate-500 mb-2">المستودع (اختياري)</div>
            <CustomSelect
              value={selectedWarehouseId ? String(selectedWarehouseId) : ''}
              onChange={v => setSelectedWarehouseId(v ? Number(v) : '')}
              options={[{ value: '', label: 'بدون مستودع' }, ...warehouses.map((w:any)=>({ value: String(w.id), label: w.name }))]}
              className="w-full"
              disabled={!repChosen || !treasuryChosen}
            />
          </div>
        </div>
        {selectedRepId && !isShippingMode && (
          <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-700 flex items-center gap-2">
            {openDailyInfo ? (
              <span className="inline-flex items-center gap-1.5 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 px-3 py-1.5 rounded-full text-xs font-bold border border-green-200 dark:border-green-800">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse inline-block" />
                يومية مفتوحة: {openDailyInfo.daily_code}
              </span>
            ) : null}
          </div>
        )}
      </div>
      {/* Employee / Page inputs removed per request */}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="lg:order-2 space-y-4 bg-white dark:bg-slate-800 rounded-3xl p-5 shadow-sm border border-slate-200 dark:border-slate-700">
          {!isShippingMode && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-slate-700 dark:text-slate-200 font-black">
                <CreditCard className="w-5 h-5" />
                ملخص محاسبي قبل الإتمام
              </div>

              <div className="grid grid-cols-1 gap-3">
                <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/30 p-4 shadow-sm">
                  <div className="text-sm font-black text-slate-800 dark:text-white mb-3">الأرصدة القديمة</div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="space-y-2">
                      <StatCard label="قيمة اوردرات قديمة" value={`${oldOrdersValue.toLocaleString()} ج.م`} />
                      <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/30 p-4 shadow-sm text-center">
                        <div className="text-xs text-slate-500 dark:text-slate-400">الرصيد السابق (دين/رصيد)</div>
                        <div className={`mt-2 text-2xl font-extrabold ${balanceClass(prevBalance)}`}>{balanceLabel(prevBalance)} {Math.abs(prevBalance).toLocaleString()} ج.م</div>
                      </div>
                    </div>
                    <StatCard
                      label="اجمالي الاوردرات القديمه"
                      value={oldOrdersCount}
                      hint={`منتجات مميزة: ${oldDistinctProductsCount}`}
                    />
                    <StatCard
                      label="قطع قديمة"
                      value={oldPiecesCount.toLocaleString()}
                    />
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/30 p-4 shadow-sm">
                  <div className="text-sm font-black text-slate-800 dark:text-white mb-3">تسليم اليوم (المحدد الآن)</div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <StatCard label="قيمة اوردرات اليوم" value={`${Math.abs(todayValue).toLocaleString()} ج.م`} />
                    <StatCard label="عدد اوردرات اليوم" value={todayOrdersCount} />
                    <StatCard
                      label="عدد قطع اليوم"
                      value={todayPiecesCount.toLocaleString()}
                      hint={`منتجات مميزة: ${todayDistinctProductsCount}`}
                    />
                  </div>

                </div>

                <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/30 p-4 shadow-sm">
                  <div className="text-sm font-black text-slate-800 dark:text-white mb-3">الإجماليات</div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="space-y-2">
                      <StatCard label="قيمه اجمالى الاوردرات" value={`${(oldOrdersValue + todayValue).toLocaleString()} ج.م`} hint={`في عهدة: ${oldOrdersValue.toLocaleString()} + اليوم: ${todayValue.toLocaleString()}`} />
                        <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/30 p-4 shadow-sm text-center">
                        <div className="text-xs text-slate-500 dark:text-slate-400">الباقي النهائي (قديم + اليوم)</div>
                        <div className={`mt-2 text-2xl font-extrabold ${balanceClass(finalBalanceBeforePayment)}`}>{balanceLabel(finalBalanceBeforePayment)} {Math.abs(finalBalanceBeforePayment).toLocaleString()} ج.م</div>
                      </div>
                       {/*  <div className="mt-2 text-xs text-slate-600">مصروفات الشحن: <span className="font-black">{totalShipping.toLocaleString()} ج.م</span></div>
                        <div className="mt-1 text-xs text-slate-600">الإجمالي شامل الشحن: <span className="font-black">{(oldOrdersValue + todayValue + totalShipping).toLocaleString()} ج.م</span></div> */}
                    </div>
                      <StatCard
                      label="إجمالي الاوردرات"
                      value={totalOrdersCount}
                      hint={`قديم ${oldOrdersCount} + اليوم ${todayOrdersCount}`}
                    />
                    <StatCard
                      label="إجمالي القطع"
                      value={totalPiecesCount.toLocaleString()}
                      hint={`قديم ${oldPiecesCount.toLocaleString()} + اليوم ${todayPiecesCount.toLocaleString()}`}
                    />
                  </div>
                </div>

                {/* صندوق المبلغ المدفوع الآن مع خيار نوع العملية */}
                <div className="rounded-2xl border-2 border-emerald-200 bg-emerald-50/60 p-3 dark:bg-emerald-900/10 dark:border-emerald-500/30">
                  <div className="text-xs font-bold text-emerald-800 dark:text-emerald-200 mb-2">المبلغ المدفوع الآن</div>
                  <div className="flex items-center gap-3 mb-2">
                    <div className="flex items-center gap-2">
                      <label className={`inline-flex items-center gap-2 px-3 py-1 rounded-xl cursor-pointer ${paymentAction === 'collect' ? 'bg-emerald-100 text-emerald-800' : 'bg-white dark:bg-slate-900'}`}>
                        <input type="radio" name="paymentAction" value="collect" checked={paymentAction === 'collect'} onChange={() => setPaymentAction('collect')} />
                        <span>تحصيل من المندوب</span>
                      </label>
                      <label className={`inline-flex items-center gap-2 px-3 py-1 rounded-xl cursor-pointer ${paymentAction === 'pay' ? 'bg-rose-100 text-rose-800' : 'bg-white dark:bg-slate-900'}`}>
                        <input type="radio" name="paymentAction" value="pay" checked={paymentAction === 'pay'} onChange={() => setPaymentAction('pay')} />
                        <span>دفع إلى المندوب</span>
                      </label>
                    </div>
                    <div className={paymentAction === 'collect' ? 'text-emerald-600 text-sm' : 'text-rose-600 text-sm'}>
                      {paymentAction === 'collect' ? 'تحصيل — يقلل مديونية المندوب' : 'دفع — يزيد مديونية المندوب'}
                    </div>
                  </div>

                  <input
                    type="number"
                    min={0}
                    className="w-full bg-white dark:bg-slate-900 border border-emerald-300 dark:border-emerald-500/40 rounded-xl py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300 dark:focus:ring-emerald-500/40"
                    value={paymentAdjustment}
                    onChange={e => setPaymentAdjustment(Math.max(0, toNum(e.target.value)))}
                  />
                </div>

                {/* صندوق الدين المتبقي بعد الدفع */}
                <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40 p-4">
                  <div className="text-xs text-slate-500">الباقي بعد الدفع</div>
                  <div className={`mt-1 text-2xl font-black ${balanceClass(balanceAfterPayment)}`}>{Math.abs(balanceAfterPayment).toLocaleString()} {balanceLabel(balanceAfterPayment)} ج.م</div>
                  <div className="mt-1 text-xs text-slate-400">الرصيد بعد الدفع: {Math.abs(balanceAfterPayment).toLocaleString()} ({balanceLabel(balanceAfterPayment)})</div>
                </div>
              </div>
              </div>
            
          )}

          <div className="flex gap-2">
            <button
              onClick={onCompleteSilent}
              disabled={!startDailyUnlocked}
              className={`flex-1 bg-emerald-600 text-white py-2 rounded-xl flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-emerald-300 ${!startDailyUnlocked ? 'opacity-50 cursor-not-allowed' : 'hover:bg-emerald-700'}`}
            >
              <ArrowRight /> إتمام و طباعه اليوميه
            </button>

            <button
              onClick={() => {
                if (!startDailyUnlocked) {
                  Swal.fire('حدد المندوب والخزينة والمستودع', 'الرجاء اختيار المندوب ثم الخزينة ثم المستودع لفتح هذه المنطقة', 'warning');
                  return;
                }
                const ordersForPrint = todayOrdersUnique;
                if (ordersForPrint.length === 0) {
                  Swal.fire('تنبيه', 'لا توجد اوردرات للطباعة.', 'info');
                  return;
                }
                const selectedRep = reps.find((r: any) => r.id === selectedRepId);
                const selectedWarehouse = warehouses.find((w: any) => w.id === selectedWarehouseId);
                
                if (isShippingMode) {
                  printThermal(ordersForPrint, { 
                    assigneeLabel: 'شركة الشحن', 
                    assigneeName,
                    repId: selectedRep?.id || null,
                    warehouseId: selectedWarehouse?.id || null,
                    createdBy: userDefaults?.user_id || null,
                    createdByName: employee || userDefaults?.name || userDefaults?.username || ''
                  });
                } else {
                  printThermal(ordersForPrint, { 
                    assigneeLabel: 'المندوب', 
                    assigneeName,
                    repId: selectedRep?.id || null,
                    warehouseId: selectedWarehouse?.id || null,
                    createdBy: userDefaults?.id || null,
                    createdByName: employee || userDefaults?.name || userDefaults?.username || ''
                  });
                }
              }}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 px-4 py-2 rounded-xl flex items-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-200 dark:focus:ring-slate-700"
            >
              <Printer /> طباعه اذن التسليم
            </button>

            <button
              onClick={() => {
                if (todayOrdersUnique.length === 0) {
                  Swal.fire('لا توجد اوردرات', 'لا توجد اوردرات لتصديرها.', 'info');
                  return;
                }
                const headers = [
                  'رقم الاوردر',
                  'اسم العميل',
                  'الهاتف',
                  'المحافظة',
                  'العنوان',
                  'الموظف',
                  'البيدج',
                  'الإجمالي',
                  'الشحن',
                  'الإجمالي الكلي',
                  'ملاحظات'
                ];
                const rows = todayOrdersUnique.map((o: any) => [
                  o.orderNumber ?? o.order_number ?? o.id ?? '',
                  o.customerName ?? o.customer_name ?? '',
                  o.phone ?? o.phone1 ?? '',
                  o.governorate ?? '',
                  o.address ?? '',
                  o.employee ?? o.employee_name ?? o.assigneeName ?? o.assigned_to ?? (o.assigned && (o.assigned.name || o.assigned.employee)) ?? '',
                  o.page ?? o.page_number ?? o.page_no ?? o.pageNumber ?? o.package_page ?? '',
                  orderSubtotal(o),
                  parseNumeric(o.shipping ?? o.shipping_fees ?? o.shippingCost ?? 0),
                  orderTotal(o),
                  o.notes ?? ''
                ]);
                const csvContent = [
                  headers.join(','),
                  ...rows.map(row => row.map(cell => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(','))
                ].join('\n');
                const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.setAttribute('download', `daily_orders_${new Date().toISOString().slice(0, 10)}.csv`);
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
              }}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 px-4 py-2 rounded-xl flex items-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-200 dark:focus:ring-slate-700"
            >
              تصدير اكسيل
            </button>
          </div>
        </div>

        <div className="lg:order-1 space-y-4">
          <div className="bg-white dark:bg-slate-800 rounded-3xl p-4 shadow-sm border border-slate-200 dark:border-slate-700 flex items-center gap-3">
            <ShoppingCart className="w-6 h-6 text-blue-600" />
            <div className="flex-1">
              <div className="text-xs text-slate-500">مسح باركود / رقم الاوردر</div>
              <div className="flex gap-3 mt-2">
                <input
                  className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl py-3 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-500/30"
                  value={barcodeInput}
                  onChange={e => setBarcodeInput(e.target.value)}
                  disabled={!startDailyUnlocked}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      if (!startDailyUnlocked) {
                        Swal.fire('حدد المندوب والخزينة والمستودع', 'الرجاء اختيار المندوب ثم الخزينة ثم المستودع لفتح هذه المنطقة', 'warning');
                        return;
                      }
                      scanBarcodeAddOrder();
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={() => {
                    if (!startDailyUnlocked) {
                      Swal.fire('حدد المندوب والخزينة والمستودع', 'الرجاء اختيار المندوب ثم الخزينة ثم المستودع لفتح هذه المنطقة', 'warning');
                      return;
                    }
                    scanBarcodeAddOrder();
                  }}
                  disabled={!startDailyUnlocked}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-500/30"
                >
                  أضف
                </button>
              </div>
            </div>
          </div>

          {showPendingOrdersBox && (
            <div className="bg-white dark:bg-slate-800 rounded-3xl p-4 shadow-sm border border-slate-200 dark:border-slate-700">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-black">الاوردرات المتاحة (اختار عدة اوردرات)</h3>
                <button
                  onClick={() => {
                    if (!startDailyUnlocked) {
                      Swal.fire('حدد المندوب والخزينة والمستودع', 'الرجاء اختيار المندوب ثم الخزينة ثم المستودع لفتح هذه المنطقة', 'warning');
                      return;
                    }
                    addSelectedFromPending();
                  }}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-2 rounded-xl text-sm"
                >
                  إضافة المحدد
                </button>
              </div>

              <div className="divide-y max-h-[320px] overflow-auto">
                {pendingOrdersList.length === 0 && <div className="p-6 text-center text-slate-400">لا توجد اوردرات متاحة</div>}
                {pendingOrdersList.map((p: any) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between py-2 px-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-900/30 transition-colors"
                  >
                    <label className="flex items-center gap-3 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        disabled={!startDailyUnlocked}
                        checked={selectedPendingIds.includes(Number(p.id))}
                        onChange={() => togglePending(Number(p.id))}
                      />
                      <div>
                        <div className="font-bold">
                          #{p.orderNumber ?? p.order_number ?? p.id} - {p.customerName ?? p.customer_name ?? ''}
                        </div>
                        <div className="text-xs text-slate-500 mt-1">{p.governorate || ''}</div>
                        <div className="text-xs text-slate-500 mt-1">الحالة: {getOrderStatusLabelAr(p.status || p.order_status)}</div>
                        <div className="text-xs text-slate-400 mt-1">{orderPieces(p).toLocaleString()} قطع</div>
                      </div>
                    </label>
                    <div className="text-right text-xs">
                      <div>المجموع: <span className="font-black">{orderSubtotal(p).toLocaleString()}</span></div>
                      <div>الشحن: <span className="font-black">{parseNumeric(p.shipping ?? p.shipping_fees ?? p.shippingCost ?? 0).toLocaleString()}</span></div>
                      <div className="font-black text-lg">الإجمالي: {orderTotal(p).toLocaleString()}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="bg-white dark:bg-slate-800 rounded-3xl p-4 shadow-sm border border-slate-200 dark:border-slate-700">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3 flex-1">
                <Box className="text-slate-500" />
                <h3 className="font-black">اوردرات اليوم المختارة ({todayOrdersCount})</h3>
                <div className="flex gap-2 ml-auto">
                  <button onClick={() => setTodayViewMode('list')} className={`p-2 rounded ${todayViewMode==='list'?'bg-blue-100 text-blue-700':'bg-slate-100'}`} title="عرض كقائمة"><LayoutList size={18} /></button>
                  <button onClick={() => setTodayViewMode('card')} className={`p-2 rounded ${todayViewMode==='card'?'bg-blue-100 text-blue-700':'bg-slate-100'}`} title="عرض كبطاقات"><LayoutGrid size={18} /></button>
                  <button onClick={() => setTodaySortAsc(v=>!v)} className="p-2 rounded bg-slate-100" title="تبديل ترتيب الفرز"><ArrowDownAZ size={18} style={{display: todaySortAsc?'inline':'none'}} /><ArrowUpAZ size={18} style={{display: !todaySortAsc?'inline':'none'}} /></button>
                </div>
              </div>
              <div className="text-sm text-slate-500">
                اجمالي اليوم: <span className="font-black">{todayValue.toLocaleString()}</span>
              </div>
            </div>

            {todayViewMode === 'list' ? (
              <div className="divide-y max-h-[420px] overflow-auto">
                {todayOrdersCount === 0 && <div className="p-6 text-center text-slate-400">لم يتم اختيار اوردرات اليوم بعد</div>}
                {todayOrdersUnique.slice().sort((a, b) => todaySortAsc ? (a.id - b.id) : (b.id - a.id)).map((o: any) => {
                  const sub = orderSubtotal(o);
                  const ship = parseNumeric(o.shipping ?? o.shipping_fees ?? o.shippingCost ?? 0);
                  const tot = orderTotal(o);
                  return (
                    <div key={o.id} className="flex items-center justify-between py-3 px-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-900/30 transition-colors">
                      <div>
                        <div className="font-bold">#{o.orderNumber ?? o.order_number ?? o.id} - {o.customerName ?? o.customer_name ?? ''}</div>
                        <div className="text-xs text-slate-500 mt-1">{o.governorate || ''} • {o.phone || o.phone1 || ''}</div>
                        <div className="text-xs text-slate-500 mt-1">الحالة: {getOrderStatusLabelAr(o.status || o.order_status)}</div>
                        <div className="text-xs text-slate-400 mt-1">{orderPieces(o).toLocaleString()} قطع</div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right text-xs">
                          <div>المجموع: <span className="font-black">{sub.toLocaleString()}</span></div>
                          <div>الشحن: <span className="font-black">{ship.toLocaleString()}</span></div>
                          <div className="font-black text-lg">الإجمالي: {tot.toLocaleString()}</div>
                        </div>
                        <button onClick={() => { if (!startDailyUnlocked) { Swal.fire('حدد المندوب والخزينة والمستودع', 'الرجاء اختيار المندوب ثم الخزينة ثم المستودع لفتح هذه المنطقة', 'warning'); return; } removeSelectedOrder(Number(o.id)); }} className="text-rose-600 p-2 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-900/10 transition-colors"><Trash2 /></button>
                      </div>
                    </div>
                  );
                })}
              </div>
           ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg gap-5 max-h-[440px] overflow-auto p-2">
                {todayOrdersCount === 0 && <div className="col-span-full p-6 text-center text-slate-400">لم يتم اختيار اوردرات اليوم بعد</div>}
                {todayOrdersUnique.slice().sort((a, b) => todaySortAsc ? (a.id - b.id) : (b.id - a.id)).map((o: any) => {
                  const tot = orderTotal(o);
                  return (
                    <div key={o.id} className="relative group bg-white p-0 rounded-3xl border border-slate-200 shadow-sm transition-all duration-300 hover:shadow-xl hover:-translate-y-1">
                      <div className="p-5">
                        {/* Header */}
                        <div className="flex justify-between items-start mb-4">
                          <div>
                            <span className="inline-block bg-slate-100 text-slate-600 font-mono text-[10px] px-2 py-1 rounded-lg mb-1">{o.orderNumber ?? o.order_number ?? o.id}</span>
                            <h3 className="font-bold text-slate-800 text-sm line-clamp-1">{o.customerName ?? o.customer_name ?? ''}</h3>
                          </div>
                          <div className="flex flex-col items-end gap-1">
                            <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded-lg text-[10px] font-bold">
                              {getOrderStatusLabelAr(o.status || o.order_status)}
                            </span>
                          </div>
                        </div>

                        {/* Details */}
                        <div className="space-y-2 mb-4">
                          <div className="flex items-center gap-2 text-xs text-slate-500">
                            <Phone size={14} className="text-blue-500 shrink-0"/>
                            <div className="flex flex-col">
                              <span className="font-mono dir-ltr">{o.phone || o.phone1 || ''}</span>
                              {o.phone2 && String(o.phone2).trim() !== '' && (
                                <span className="text-[11px] text-slate-400 font-mono dir-ltr">{o.phone2}</span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-start gap-2 text-xs text-slate-500">
                            <MapPin size={14} className="text-rose-500 mt-0.5 shrink-0"/>
                            <span className="line-clamp-2 leading-relaxed">{o.governorate || ''} {o.address ? `- ${o.address}` : ''}</span>
                          </div>
                        </div>

                        {/* Products Summary */}
                        <div className="bg-slate-50 rounded-xl p-3 mb-4 border border-slate-100">
                          <p className="text-[10px] text-slate-400 font-bold mb-2">ملخص المنتجات:</p>
                          <div className="space-y-1">
                            {(Array.isArray(o.products) ? o.products : []).slice(0, 2).map((p:any, i:number) => (
                              <div key={i} className="flex justify-between text-[11px]">
                                <span className="text-slate-700 truncate max-w-[70%]">{p.name}</span>
                                <span className="text-slate-500 font-mono">x{p.quantity || p.qty || 1}</span>
                              </div>
                            ))}
                            {(Array.isArray(o.products) ? o.products : []).length > 2 && (
                              <p className="text-[10px] text-blue-500 font-bold pt-1">+ {(o.products).length - 2} منتجات أخرى</p>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Footer */}
                      <div className="flex items-center justify-between p-4 border-t border-slate-100 bg-slate-50/50 rounded-b-3xl">
                        <div className="flex flex-col">
                          <span className="text-[10px] text-slate-400 font-bold">الإجمالي</span>
                          <span className="font-black text-lg text-slate-800">{tot.toLocaleString()}</span>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              if (!startDailyUnlocked) {
                                Swal.fire('حدد المندوب والخزينة والمستودع', 'الرجاء اختيار المندوب ثم الخزينة ثم المستودع لفتح هذه المنطقة', 'warning');
                                return;
                              }
                              removeSelectedOrder(Number(o.id));
                            }}
                            className="w-10 h-10 flex items-center justify-center bg-white border border-slate-200 rounded-xl text-rose-600 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200 transition-colors shadow-sm"
                            title="حذف من اليومية"
                          >
                            <Trash2 size={18}/>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {!isShippingMode && selectedRepId && (
              <div className="mt-4 grid grid-cols-3 gap-3">
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-4 rounded-2xl shadow-sm text-center">
                  <div className="text-xs text-slate-400">اوردرات قديمة في العهدة</div>
                  <div className="font-black text-lg mt-1">{oldOrdersCount}</div>
                </div>
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-4 rounded-2xl shadow-sm text-center">
                  <div className="text-xs text-slate-400">قطع قديمة</div>
                  <div className="font-black text-lg mt-1">{oldPiecesCount.toLocaleString()}</div>
                </div>
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-4 rounded-2xl shadow-sm text-center">
                  <div className="text-xs text-slate-400">الرصيد السابق</div>
                  <div className="font-black text-lg mt-1">
                    {Math.abs(prevBalance).toLocaleString()} ج.م{' '}
                    <span className={`text-sm font-bold ${balanceClass(prevBalance)}`}>
                      {balanceLabel(prevBalance)}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Assigned / Old custody orders (اوردرات نزول) */}
          {Array.isArray(assignedOrders) && assignedOrders.length > 0 && (
            <div className="bg-white dark:bg-slate-800 rounded-3xl p-4 shadow-sm border border-slate-200 dark:border-slate-700 mt-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3 flex-1">
                  <Box className="text-slate-500" />
                  <h3 className="font-black">اوردرات نزول ({assignedOrders.length})</h3>
                  <div className="flex gap-2 ml-auto">
                    <button onClick={() => setAssignedViewMode('list')} className={`p-2 rounded ${assignedViewMode==='list'?'bg-blue-100 text-blue-700':'bg-slate-100'}`} title="عرض كقائمة"><LayoutList size={18} /></button>
                    <button onClick={() => setAssignedViewMode('card')} className={`p-2 rounded ${assignedViewMode==='card'?'bg-blue-100 text-blue-700':'bg-slate-100'}`} title="عرض كبطاقات"><LayoutGrid size={18} /></button>
                    <button onClick={() => setAssignedSortAsc(v=>!v)} className="p-2 rounded bg-slate-100" title="تبديل ترتيب الفرز"><ArrowDownAZ size={18} style={{display: assignedSortAsc?'inline':'none'}} /><ArrowUpAZ size={18} style={{display: !assignedSortAsc?'inline':'none'}} /></button>
                  </div>
                </div>
                <div className="text-sm text-slate-500">اجمالي: <span className="font-black">{oldOrdersValue.toLocaleString()}</span></div>
              </div>
              {assignedViewMode === 'list' ? (
                <div className="divide-y max-h-[320px] overflow-auto">
                  {assignedOrders.slice().sort((a, b) => assignedSortAsc ? (a.id - b.id) : (b.id - a.id)).map((o: any) => {
                    const sub = orderSubtotal(o);
                    const ship = parseNumeric(o.shipping ?? o.shipping_fees ?? o.shippingCost ?? 0);
                    const tot = orderTotal(o);
                    return (
                      <div key={o.id} className="flex items-center justify-between py-3 px-2 rounded-xl hover:bg-slate-50 dark:hover:bg-rose-900/10 transition-colors">
                        <div>
                          <div className="font-bold">#{o.orderNumber ?? o.order_number ?? o.id} - {o.customerName ?? o.customer_name ?? ''}</div>
                          <div className="text-xs text-slate-500 mt-1">{o.governorate || ''} • {o.phone || o.phone1 || ''}</div>
                          <div className="text-xs text-slate-400 mt-1">{orderPieces(o).toLocaleString()} قطع</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="text-right text-xs">
                            <div>المجموع: <span className="font-black">{sub.toLocaleString()}</span></div>
                            <div>الشحن: <span className="font-black">{ship.toLocaleString()}</span></div>
                            <div className="font-black text-lg">الإجمالي: {tot.toLocaleString()}</div>
                          </div>
                          <button onClick={() => handleRecallOrder(o)} className="text-rose-600 p-2 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-900/10 transition-colors" title="سحب من عهدة المندوب"><Trash2 size={18} /></button>
                        </div>
                      </div>
                    );
                  })}
                </div>
             ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg gap-5 max-h-[340px] overflow-auto p-2">
                  {assignedOrders.slice().sort((a, b) => assignedSortAsc ? (a.id - b.id) : (b.id - a.id)).map((o: any) => {
                    const tot = orderTotal(o);
                    return (
                      <div key={o.id} className="relative group bg-white p-0 rounded-3xl border border-slate-200 shadow-sm transition-all duration-300 hover:shadow-xl hover:-translate-y-1">
                        <div className="p-5">
                          {/* Header */}
                          <div className="flex justify-between items-start mb-4">
                            <div>
                              <span className="inline-block bg-slate-100 text-slate-600 font-mono text-[10px] px-2 py-1 rounded-lg mb-1">{o.orderNumber ?? o.order_number ?? o.id}</span>
                              <h3 className="font-bold text-slate-800 text-sm line-clamp-1">{o.customerName ?? o.customer_name ?? ''}</h3>
                            </div>
                            <div className="flex flex-col items-end gap-1">
                              <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded-lg text-[10px] font-bold">
                                {getOrderStatusLabelAr(o.status || o.order_status)}
                              </span>
                            </div>
                          </div>

                          {/* Details */}
                          <div className="space-y-2 mb-4">
                            <div className="flex items-center gap-2 text-xs text-slate-500">
                              <Phone size={14} className="text-blue-500 shrink-0"/>
                              <div className="flex flex-col">
                                <span className="font-mono dir-ltr">{o.phone || o.phone1 || ''}</span>
                                {o.phone2 && String(o.phone2).trim() !== '' && (
                                  <span className="text-[11px] text-slate-400 font-mono dir-ltr">{o.phone2}</span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-start gap-2 text-xs text-slate-500">
                              <MapPin size={14} className="text-rose-500 mt-0.5 shrink-0"/>
                              <span className="line-clamp-2 leading-relaxed">{o.governorate || ''} {o.address ? `- ${o.address}` : ''}</span>
                            </div>
                          </div>

                          {/* Products Summary */}
                          <div className="bg-slate-50 rounded-xl p-3 mb-4 border border-slate-100">
                            <p className="text-[10px] text-slate-400 font-bold mb-2">ملخص المنتجات:</p>
                            <div className="space-y-1">
                              {(Array.isArray(o.products) ? o.products : []).slice(0, 2).map((p:any, i:number) => (
                                <div key={i} className="flex justify-between text-[11px]">
                                  <span className="text-slate-700 truncate max-w-[70%]">{p.name}</span>
                                  <span className="text-slate-500 font-mono">x{p.quantity || p.qty || 1}</span>
                                </div>
                              ))}
                              {(Array.isArray(o.products) ? o.products : []).length > 2 && (
                                <p className="text-[10px] text-blue-500 font-bold pt-1">+ {(o.products).length - 2} منتجات أخرى</p>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Footer */}
                        <div className="flex items-center justify-between p-4 border-t border-slate-100 bg-slate-50/50 rounded-b-3xl">
                          <div className="flex flex-col">
                            <span className="text-[10px] text-slate-400 font-bold">الإجمالي</span>
                            <span className="font-black text-lg text-slate-800">{tot.toLocaleString()}</span>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleRecallOrder(o)}
                              className="w-10 h-10 flex items-center justify-center bg-white border border-slate-200 rounded-xl text-rose-600 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200 transition-colors shadow-sm"
                              title="سحب من المندوب"
                            >
                              <Trash2 size={18}/>
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default SalesDaily;