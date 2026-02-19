import React, { useEffect, useMemo, useState } from 'react';
import Swal from 'sweetalert2';
import { API_BASE_PATH } from '../services/apiConfig';
import { User, ShoppingCart, CreditCard, Trash2, ArrowRight, Printer, Box } from 'lucide-react';
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

// Server-consistent subtotal (exclude shipping) — used for rep assignment and "قيمة طلبيات اليوم"
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
      } catch (e) {
        console.debug('Failed to load reps/companies', e);
      }

      try {
        const [tr, wr, ud] = await Promise.all([
          fetch(`${API_BASE_PATH}/api.php?module=treasuries&action=getAll`).then(r => r.json()),
          fetch(`${API_BASE_PATH}/api.php?module=warehouses&action=getAll`).then(r => r.json()),
          fetch(`${API_BASE_PATH}/api.php?module=permissions&action=getUserDefaults`)
            .then(r => r.json())
            .catch(() => ({ success: false }))
        ]);

        const tList = tr && tr.success ? tr.data || [] : [];
        const wList = wr && wr.success ? wr.data || [] : [];
        const defaults = ud && ud.success ? ud.data || null : null;

        if (defaults && defaults.default_treasury_id && !defaults.can_change_treasury) {
          setTreasuries(tList.filter((t: any) => Number(t.id) === Number(defaults.default_treasury_id)));
        } else {
          setTreasuries(tList);
        }
        setWarehouses(wList);

        if (defaults && defaults.default_treasury_id && !selectedTreasuryId) setSelectedTreasuryId(Number(defaults.default_treasury_id));
        if (defaults && defaults.default_warehouse_id && !selectedWarehouseId) setSelectedWarehouseId(Number(defaults.default_warehouse_id));
        if (defaults) setUserDefaults(defaults);
      } catch (e) {
        console.debug('Failed to load treasuries/warehouses/defaults', e);
      }

      try {
        const pr = await fetch(`${API_BASE_PATH}/api.php?module=orders&action=getAll&status=pending`);
        const jpr = await pr.json();
        if (jpr && jpr.success) setPendingOrdersList(jpr.data || []);
      } catch (e) {
        console.debug('Failed to load pending orders', e);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-select sensible defaults: if only one rep/shipping company, or user defaults provide treasury/warehouse
  useEffect(() => {
    if (!repChosen) {
      if (isShippingMode) {
        if (shippingCompanies.length === 1) onSelectShippingCompany(Number(shippingCompanies[0].id));
      } else {
        if (reps.length === 1) onSelectRep(Number(reps[0].id));
      }
    }

    if (!selectedTreasuryId && userDefaults && userDefaults.default_treasury_id) {
      setSelectedTreasuryId(Number(userDefaults.default_treasury_id));
    }

    if (!selectedWarehouseId && userDefaults && userDefaults.default_warehouse_id) {
      setSelectedWarehouseId(Number(userDefaults.default_warehouse_id));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reps, shippingCompanies, userDefaults]);

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
  };

  const onSelectRep = async (repId: number | '') => {
    setSelectedRepId(repId as any);
    setSelectedOrders([]);
    setSelectedPendingIds([]);
    setBarcodeInput('');
    setPaymentAdjustment(0);
    setPrevBalance(0);
    setAssignedOrders([]);

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

  const togglePending = (id: number) => {
    setSelectedPendingIds(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));
  };

  const addSelectedFromPending = () => {
    const toAdd = pendingOrdersList.filter(p => selectedPendingIds.includes(Number(p.id)));
    if (toAdd.length === 0) {
      Swal.fire('تنبيه', 'اختر طلبيات أولاً.', 'info');
      return;
    }

    const allowedStatuses = ['pending', 'returned'];
    const accepted = toAdd.filter(t => allowedStatuses.includes(String(t.status || 'pending')));
    const rejected = toAdd.filter(t => !allowedStatuses.includes(String(t.status || '')));

    const existingIds = new Set(todayOrdersUnique.map(o => Number(o.id)));
    const newOnes = accepted.filter(t => !existingIds.has(Number(t.id)));

    if (newOnes.length === 0) {
      Swal.fire('لا توجد طلبيات جديدة', 'الطلبيات المحددة قد تكون مضافة بالفعل.', 'info');
      return;
    }

    setSelectedOrders(prev => [...prev, ...newOnes]);
    setPendingOrdersList(prev => prev.filter(p => !newOnes.some(n => Number(n.id) === Number(p.id))));
    setSelectedPendingIds([]);

    let msg = `تم إضافة ${newOnes.length} طلبيات لليومية.`;
    if (rejected.length > 0) msg += ` ${rejected.length} طلبيات لم تُضاف لأن حالتها ليست 'قيد الانتظار' أو 'مرتجع'.`;
    Swal.fire('تم الإضافة', msg, 'success');
  };

  const removeSelectedOrder = (id: number) => {
    const removed = selectedOrders.find(o => Number(o.id) === Number(id));
    setSelectedOrders(prev => prev.filter(o => Number(o.id) !== Number(id)));
    if (removed) setPendingOrdersList(prev => [removed, ...prev.filter(p => Number(p.id) !== Number(id))]);
  };

  const scanBarcodeAddOrder = async () => {
    const code = String(barcodeInput || '').trim();
    if (!code) return;

    const match =
      pendingOrdersList.find(p => String(p.barcode ?? '') === code) ||
      pendingOrdersList.find(p => String(p.order_number ?? p.orderNumber ?? '') === code) ||
      pendingOrdersList.find(p => String(p.id ?? '') === code);

    if (!match) {
      Swal.fire('غير موجود', 'لم يتم العثور على طلبية بهذا الباركود/الرقم ضمن الطلبيات المتاحة.', 'warning');
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
          Swal.fire('غير مسموح', 'الطلبية لا تحتوي المنتج/اللون/المقاس المطلوب أو الكمية غير كافية.', 'warning');
          setBarcodeInput('');
          return;
        }
      }
    } catch (e) {
      console.debug('Failed to validate selected product against order', e);
    }

    const allowedStatuses = ['pending', 'returned'];
    if (!allowedStatuses.includes(String(match.status || 'pending'))) {
      Swal.fire('غير مسموح', 'لا يمكن إضافة طلبية ليست حالتها قيد الانتظار/مرتجع.', 'warning');
      setBarcodeInput('');
      return;
    }

    // Prevent adding orders already assigned to a rep
    try {
      const repId = match.rep_id ?? match.repId ?? match.assigned_to ?? match.assignee_id ?? null;
      if (repId) {
        const repName = reps.find((r: any) => Number(r.id) === Number(repId))?.name || (match.assigned && (match.assigned.name || match.assigned.employee)) || match.assigneeName || '';
        Swal.fire('موجود', `الطلبية مع المندوب ${repName}`, 'info');
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
        Swal.fire('موجود', `الطلبية مع شركة الشحن ${companyName}`, 'info');
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
          body: JSON.stringify({ warehouse_id: selectedWarehouseId || 0, items })
        });
        const stockJr = await stockResp.json().catch(() => null);
        if (!stockJr || stockJr.success === false) {
          const unavailable = (stockJr && stockJr.unavailable_items) || [];
          if (unavailable.length > 0) {
            let msg = `لا يمكن إضافة الطلبية بسبب عدم توفر المنتجات التالية في المخزن المختار:\n`;
            unavailable.forEach((it: any) => {
              msg += `- ${it.name || it.product_id || ''}: مطلوب ${it.required}, متوفر ${it.available}\n`;
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
  };

  const printThermal = (orders: any[], extra: any) => {
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

    const html =
      `<!doctype html><html><head><meta charset="utf-8"><title>أذن تسليم</title>` +
      `<style>body{font-family: Arial, Helvetica, "Noto Naskh Arabic", sans-serif; direction:rtl; width:340px; padding:6px;} h2{text-align:center;} table{width:100%; border-collapse:collapse;} th,td{font-size:12px; padding:4px; border-bottom:1px solid #ddd;} th{font-weight:700; text-align:right;} .totals{margin-top:8px; font-weight:700;} </style>` +
      `</head><body>` +
      `<h2>أذن تسليم</h2>` +
      `<div>التاريخ: ${dateStr}</div>` +
      `<div>استلام بضاعه للمندوب"${whoName}"</div>` +
      `<br/>` +
      `<table><thead><tr><th>المنتج</th><th>اللون</th><th>المقاس</th><th>الكمية</th></tr></thead><tbody>` +
      rows
        .map(r => `<tr><td>${r.name}</td><td>${r.color}</td><td>${r.size}</td><td style="text-align:left">${r.qty}</td></tr>`)
        .join('') +
      `</tbody></table>` +
      `<div class="totals">اجمالى المنتجات: ${totalProducts}</div>` +
      `<div class="totals">اجمالى القطع: ${totalPieces}</div>` +
      `</body></html>`;

    win.document.write(html);
    win.document.close();
    setTimeout(() => win.print(), 500);
  };

  const printA4Report = (orders: any[], extra: any) => {
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
              <divقيمه الطلبيات القديمه: <b>${localOldOrdersValue.toLocaleString()} ج.م</b></div>
              <div style="margin-top:6px">الرصيد السابق (دين/رصيد): <b>${balanceLabel(prevBal)} ${Math.abs(prevBal).toLocaleString()} ج.م</b></div>
              <div style="margin-top:6px"اجمالي الطلبيات القديمه: <b>${localOldOrdersCount}</b></div>
              <div style="margin-top:4px">منتجات مميزة: <b>${localOldDistinct}</b></div>
              <div style="margin-top:4px">قطع قديمة: <b>${localOldPiecesCount.toLocaleString()}</b></div>
            </div>
            <div style="border:1px solid #ddd; padding:10px; border-radius:8px; background:#fff">
              <div style="font-weight:800; margin-bottom:8px;">تسليم اليوم (المحدد الآن)</div>
              <div>قيمة طلبيات اليوم: <b>${sumValue.toLocaleString()} ج.م</b></div>
                  <div style="margin-top:6px">عدد طلبيات اليوم: <b>${ordersParam.length}</b></div>
              <div style="margin-top:6px">عدد قطع اليوم: <b>${localTodayPieces}</b></div>
              <div style="margin-top:4px">منتجات مميزة: <b>${localTodayDistinct}</b></div>
            </div>
            <div style="border:1px solid #ddd; padding:10px; border-radius:8px; background:#fff">
              <div style="font-weight:800; margin-bottom:8px;">الإجماليات</div>
              <div>اجمالي الطلبياتقيمة: <b>${(localOldOrdersValue + sumValue).toLocaleString()} ج.م</b></div>
              <div style="margin-top:6px">في عهدة: ${localOldOrdersValue.toLocaleString()} + اليوم: ${sumValue.toLocaleString()}</div>
              <div style="margin-top:6px">الدين النهائي (قديم + اليوم): <b>${balanceLabel(finalBalBeforePay)} ${Math.abs(finalBalBeforePay).toLocaleString()} ج.م</b></div>
              <div style="margin-top:6px">إجمالي الطلبيات: <b>${localTotalOrdersCount}</b> (قديم ${localOldOrdersCount} + اليوم ${orders.length})</div>
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
          <th>رقم الطلبية</th><th>اسم العميل</th><th>الهاتف</th><th>المحافظة</th><th>العنوان</th>
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
      ? `<div style="margin-top:18px; padding:12px; border:1px dashed #ccc; text-align:center;">لا توجد طلبيات لعرضها في اليومية.</div>`
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
      `<div style="margin-top:8px">التاريخ: ${dateStr}</div>` +
      (showMoney
        ? `
          <div style="display:flex; gap:10px; justify-content:space-between; align-items:flex-start; margin-top:8px; font-size:12px">
            <div style="flex:1; padding:6px; border:1px solid #ddd; border-radius:6px">
              <div style="font-weight:700;">الأرصدة القديمة</div>
              <div>قيمة طلبيات قديمة: <b>${localOldOrdersValue.toLocaleString()} ج.م</b></div>
              <divالمستحق: <b>${balanceLabel(prevBal)} ${Math.abs(prevBal).toLocaleString()} ج.م</b></div>
              <div> الطلبيات: <b>${localOldOrdersCount}</b> • <span>قطع: <b>${localOldPiecesCount.toLocaleString()}</b></span></div>
            </div>

            <div style="flex:1; padding:6px; border:1px solid #ddd; border-radius:6px">
              <div style="font-weight:700;">تسليم اليوم (المحدد الآن)</div>
              <div>قيمة طلبيات اليوم: <b>${sumValue.toLocaleString()} ج.م</b></div>
              <div>عدد طلبيات: <b>${ordersParam.length}</b> • قطع: <b>${localTodayPieces}</b></div>
            </div>

            <div style="flex:1; padding:6px; border:1px solid #ddd; border-radius:6px; background:#f0fdf4">
              <div style="font-weight:700;">المبلغ المدفوع الآن</div>
              <div>النوع: <b>${paymentAction === 'collect' ? 'تحصيل' : 'دفع'}</b></div>
              <div>المبلغ: <b>${Math.abs(paymentAdjustment).toLocaleString()} ج.م</b></div>
            </div>

            <div style="flex:1; padding:6px; border:1px solid #ddd; border-radius:6px; background:#fff5f6">
              <div style="font-weight:700;">الباقي بعد الدفع</div>
              <div style="font-weight:800; font-size:14px">${Math.abs(afterPay).toLocaleString()} ${balanceLabel(afterPay)} ج.م</div>
            </div>
          </div>`
        : '') +
      `<table><thead><tr>
          <th>رقم الطلبية</th><th>اسم العميل</th><th>الهاتف</th><th>المحافظة</th><th>العنوان</th>
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

    // Build an "طلبيات نزول" table for assigned (old) orders, show if any
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
        <h3 style="margin-top:16px;">طلبيات نزول (الطلبيات القديمة)</h3>
        <table style="width:100%; border-collapse:collapse; margin-top:8px;">
          <thead><tr>
            <th>رقم الطلبية</th><th>اسم العميل</th><th>الهاتف</th><th>المحافظة</th><th>العنوان</th>
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
        Swal.fire('اختر طلبيات', 'الرجاء اختيار طلبيات لتسليمها لشركة الشحن', 'error');
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
        Swal.fire('تم', 'تم تسليم الطلبيات لشركة الشحن.', 'success');
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
      Swal.fire('اختر طلبيات', 'الرجاء اختيار طلبيات لليومية قبل الإتمام.', 'error');
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
          <div><b>طلبيات قديمة في العهدة:</b> ${oldOrdersCount}</div>
          <div><b>قطع قديمة:</b> ${oldPiecesCount.toLocaleString()}</div>
          <hr/>
          <div><b>قيمة طلبيات اليوم:</b> ${todayValue.toLocaleString()}</div>
          <div><b>عدد طلبيات اليوم:</b> ${todayOrdersCount}</div>
          <div><b>عدد قطع اليوم:</b> ${todayPiecesCount.toLocaleString()}</div>
          <hr/>
          <div><b>الدين النهائي قبل الدفع:</b> ${Math.abs(finalBalanceBeforePayment).toLocaleString()} (${balanceLabel(finalBalanceBeforePayment)})</div>
          <div><b>نوع المعاملة:</b> ${paymentAction === 'collect' ? 'تحصيل من المندوب' : 'دفع إلى المندوب'}</div>
          <div><b>المبلغ الآن:</b> ${Math.abs(paymentAdjustment).toLocaleString()} ({paymentAction === 'collect' ? 'له' : 'عليه'})</div>
          <div><b>الدين المتبقي بعد العملية:</b> ${Math.abs(remainingDebt).toLocaleString()} (${balanceLabel(balanceAfterPayment)})</div>
          <hr/>
          <div><b>إجمالي الطلبيات:</b> ${totalOrdersCount} (قديم ${oldOrdersCount} + اليوم ${todayOrdersCount})</div>
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
            <div className="text-xs text-slate-500 mb-2">الخزينة (مطلوبة إذا كان هناك مبلغ مدفوع الآن)</div>
            <CustomSelect
              value={selectedTreasuryId ? String(selectedTreasuryId) : ''}
              onChange={v => setSelectedTreasuryId(v ? Number(v) : '')}
              options={[{ value: '', label: 'بدون خزينة' }, ...treasuries.map((t:any)=>({ value: String(t.id), label: t.name }))]}
              className="w-full"
              disabled={!repChosen}
            />
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
                      <StatCard label="قيمة طلبيات قديمة" value={`${oldOrdersValue.toLocaleString()} ج.م`} />
                      <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/30 p-4 shadow-sm text-center">
                        <div className="text-xs text-slate-500 dark:text-slate-400">الرصيد السابق (دين/رصيد)</div>
                        <div className={`mt-2 text-2xl font-extrabold ${balanceClass(prevBalance)}`}>{balanceLabel(prevBalance)} {Math.abs(prevBalance).toLocaleString()} ج.م</div>
                      </div>
                    </div>
                    <StatCard
                      label="اجمالي الطلبيات القديمه"
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
                    <StatCard label="قيمة طلبيات اليوم" value={`${Math.abs(todayValue).toLocaleString()} ج.م`} />
                    <StatCard label="عدد طلبيات اليوم" value={todayOrdersCount} />
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
                      <StatCard label="قيمه اجمالى الطلبيات" value={`${(oldOrdersValue + todayValue).toLocaleString()} ج.م`} hint={`في عهدة: ${oldOrdersValue.toLocaleString()} + اليوم: ${todayValue.toLocaleString()}`} />
                        <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/30 p-4 shadow-sm text-center">
                        <div className="text-xs text-slate-500 dark:text-slate-400">الباقي النهائي (قديم + اليوم)</div>
                        <div className={`mt-2 text-2xl font-extrabold ${balanceClass(finalBalanceBeforePayment)}`}>{balanceLabel(finalBalanceBeforePayment)} {Math.abs(finalBalanceBeforePayment).toLocaleString()} ج.م</div>
                      </div>
                       {/*  <div className="mt-2 text-xs text-slate-600">مصروفات الشحن: <span className="font-black">{totalShipping.toLocaleString()} ج.م</span></div>
                        <div className="mt-1 text-xs text-slate-600">الإجمالي شامل الشحن: <span className="font-black">{(oldOrdersValue + todayValue + totalShipping).toLocaleString()} ج.م</span></div> */}
                    </div>
                    <StatCard
                      label="إجمالي الطلبيات"
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
                  Swal.fire('تنبيه', 'لا توجد طلبيات للطباعة.', 'info');
                  return;
                }
                if (isShippingMode) {
                  printThermal(ordersForPrint, { assigneeLabel: 'شركة الشحن', assigneeName });
                } else {
                  printThermal(ordersForPrint, { assigneeLabel: 'المندوب', assigneeName });
                }
              }}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 px-4 py-2 rounded-xl flex items-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-200 dark:focus:ring-slate-700"
            >
              <Printer /> طباعه اذن التسليم
            </button>
          </div>
        </div>

        <div className="lg:order-1 space-y-4">
          <div className="bg-white dark:bg-slate-800 rounded-3xl p-4 shadow-sm border border-slate-200 dark:border-slate-700 flex items-center gap-3">
            <ShoppingCart className="w-6 h-6 text-blue-600" />
            <div className="flex-1">
              <div className="text-xs text-slate-500">مسح باركود / رقم الطلبية</div>
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
                <h3 className="font-black">الطلبيات المتاحة (اختار عدة طلبيات)</h3>
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
                {pendingOrdersList.length === 0 && <div className="p-6 text-center text-slate-400">لا توجد طلبيات متاحة</div>}
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
              <div className="flex items-center gap-3">
                <Box className="text-slate-500" />
                <h3 className="font-black">طلبيات اليوم المختارة ({todayOrdersCount})</h3>
              </div>
              <div className="text-sm text-slate-500">
                اجمالي اليوم: <span className="font-black">{todayValue.toLocaleString()}</span>
              </div>
            </div>

            <div className="divide-y max-h-[420px] overflow-auto">
              {todayOrdersCount === 0 && <div className="p-6 text-center text-slate-400">لم يتم اختيار طلبيات اليوم بعد</div>}
              {todayOrdersUnique.map((o: any) => {
                const sub = orderSubtotal(o);
                const ship = parseNumeric(o.shipping ?? o.shipping_fees ?? o.shippingCost ?? 0);
                const tot = orderTotal(o);
                return (
                  <div
                    key={o.id}
                    className="flex items-center justify-between py-3 px-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-900/30 transition-colors"
                  >
                    <div>
                      <div className="font-bold">
                        #{o.orderNumber ?? o.order_number ?? o.id} - {o.customerName ?? o.customer_name ?? ''}
                      </div>
                      <div className="text-xs text-slate-500 mt-1">
                        {o.governorate || ''} • {o.phone || o.phone1 || ''}
                      </div>
                      <div className="text-xs text-slate-400 mt-1">{orderPieces(o).toLocaleString()} قطع</div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right text-xs">
                        <div>
                          المجموع: <span className="font-black">{sub.toLocaleString()}</span>
                        </div>
                        <div>
                          الشحن: <span className="font-black">{ship.toLocaleString()}</span>
                        </div>
                        <div className="font-black text-lg">الإجمالي: {tot.toLocaleString()}</div>
                      </div>
                      <button
                        onClick={() => {
                          if (!startDailyUnlocked) {
                            Swal.fire('حدد المندوب والخزينة والمستودع', 'الرجاء اختيار المندوب ثم الخزينة ثم المستودع لفتح هذه المنطقة', 'warning');
                            return;
                          }
                          removeSelectedOrder(Number(o.id));
                        }}
                        className="text-rose-600 p-2 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-900/10 transition-colors"
                      >
                        <Trash2 />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {!isShippingMode && selectedRepId && (
              <div className="mt-4 grid grid-cols-3 gap-3">
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-4 rounded-2xl shadow-sm text-center">
                  <div className="text-xs text-slate-400">طلبيات قديمة في العهدة</div>
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
        </div>
      </div>
    </div>
  );
};

export default SalesDaily;
