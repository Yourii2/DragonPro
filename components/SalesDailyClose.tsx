import React, { useEffect, useMemo, useState } from 'react';
import Swal from 'sweetalert2';
import { API_BASE_PATH } from '../services/apiConfig';
import { User, Wallet, PackageCheck, PackageX, CheckCircle2, RefreshCw, Eye, LayoutGrid, List, ArrowUp, ArrowDown } from 'lucide-react';
import CustomSelect from './CustomSelect';

const toNum = (v: any) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const parseNumeric = (v: any) => {
  if (v === null || typeof v === 'undefined') return 0;
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  let s = String(v || '').trim();
  if (s === '') return 0;
  const map: Record<string,string> = {
    '٠':'0','١':'1','٢':'2','٣':'3','٤':'4','٥':'5','٦':'6','٧':'7','٨':'8','٩':'9',
    '۰':'0','۱':'1','۲':'2','۳':'3','۴':'4','۵':'5','۶':'6','۷':'7','۸':'8','۹':'9'
  };
  s = s.split('').map(ch => map[ch] || ch).join('');
  s = s.replace(/[\s,]+/g, '');
  s = s.replace(/[^0-9.\-]+/g, '');
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
};

const money = (n: number) => toNum(n).toLocaleString();

const normalizeText = (text: string) => {
  return (text || "")
    .trim()
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/\s+/g, " ");
};

const balanceLabel = (bal: number) => (bal > 0 ? 'له' : bal < 0 ? 'عليه' : '');
const balanceClass = (bal: number) => (bal > 0 ? 'text-emerald-600' : bal < 0 ? 'text-rose-600' : 'text-slate-600');

type RepStats = {
  deliveredCount: number;
  deliveredValue: number;
  returnedCount: number;
  returnedValue: number;
};

type JournalStatsState = {
  oldOrdersCount: number;
  todayOrdersCount: number;
  deliveredCount: number;
  deliveredTotal: number;
  returnedCount: number;
  postponedCount: number;
  postponedTotal: number;
};

const emptyRepStats: RepStats = {
  deliveredCount: 0,
  deliveredValue: 0,
  returnedCount: 0,
  returnedValue: 0
};

const emptyRepExtras = { deliveredPieces: 0, returnedPieces: 0, deferredCount: 0, deferredPieces: 0, deferredValue: 0 };

const emptyJournalStats: JournalStatsState = {
  oldOrdersCount: 0,
  todayOrdersCount: 0,
  deliveredCount: 0,
  deliveredTotal: 0,
  returnedCount: 0,
  postponedCount: 0,
  postponedTotal: 0,
};

const SalesDailyClose: React.FC = () => {
  const currencySymbol = 'ج.م';

  const [loading, setLoading] = useState(false);
  const [statsLoading, setStatsLoading] = useState(false);

  const [reps, setReps] = useState<any[]>([]);
  const [treasuries, setTreasuries] = useState<any[]>([]);
  const [userDefaults, setUserDefaults] = useState<any>(null);

  const [selectedRepId, setSelectedRepId] = useState<string>('');
  const [selectedTreasuryId, setSelectedTreasuryId] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'electronic'>('cash');
  

  // Date range for statistics (default = today)
  const todayStr = new Date().toISOString().slice(0,10);
  const [statsFrom, setStatsFrom] = useState<string>(todayStr);
  const [statsTo, setStatsTo] = useState<string>(todayStr);

  // Period summary (rep-level) - default last 7 days
  const defaultPeriodEnd = new Date();
  const defaultPeriodStart = new Date(); defaultPeriodStart.setDate(defaultPeriodEnd.getDate() - 6);
  const [periodStart, setPeriodStart] = useState<string>(defaultPeriodStart.toISOString().slice(0,10));
  const [periodEnd, setPeriodEnd] = useState<string>(defaultPeriodEnd.toISOString().slice(0,10));
  const [periodSummary, setPeriodSummary] = useState<any>(null);
  const [periodLoading, setPeriodLoading] = useState<boolean>(false);

  // يتم تحديث ملخص الفترة عند تغيير التواريخ أو تغيير المندوب
  useEffect(() => { fetchPeriodSummary(); }, [periodStart, periodEnd, selectedRepId]);

  const fetchPeriodSummary = async () => {
    if (!selectedRepId) {
      setPeriodSummary(null);
      return;
    }

    setPeriodLoading(true);
    try {
      // 1. جلب كافة سجلات اليومية الخاصة بالمندوب
      const dailyUrl = `${API_BASE_PATH}/api.php?module=sales&action=getRepDailyJournal&rep_id=${encodeURIComponent(selectedRepId)}`;
      const dailyRes = await fetch(dailyUrl).then(r => r.json());
      
      if (!dailyRes || !dailyRes.success) throw new Error('getRepDailyJournal failed');

      const allDailyRows = Array.isArray(dailyRes.data) ? dailyRes.data : [];
      
      // 2. فلترة سجلات اليومية بناءً على التواريخ المحددة (periodStart, periodEnd)
      const inRange = (journalDate: any) => {
        const val = String(journalDate || '').slice(0, 10);
        return val && val >= periodStart && val <= periodEnd;
      };
      
      const filteredRows = allDailyRows.filter((row: any) => inRange(row.journal_date));
      const journalIds = Array.from(new Set(filteredRows.map((row: any) => Number(row.id)).filter(id => id > 0)));

      if (journalIds.length === 0) {
        setPeriodSummary({
          delivered: { count: 0, pieces: 0, value: 0 },
          returned: { count: 0, pieces: 0, value: 0 },
          _delivered_list: [],
          _returned_list: []
        });
        return;
      }

      // 3. جلب كافة الأوردرات المرتبطة بهذه اليوميات
      const ordersUrl = `${API_BASE_PATH}/api.php?module=sales&action=getJournalOrders&rep_id=${encodeURIComponent(selectedRepId)}&journal_ids=${encodeURIComponent(journalIds.join(','))}`;
      const ordersRes = await fetch(ordersUrl).then(r => r.json());

      if (!ordersRes || !ordersRes.success) throw new Error('getJournalOrders failed');

      const deliveredOrders = ordersRes.delivered || [];
      const returnedOrders = ordersRes.returned || [];
      const deferredOrders = ordersRes.deferred || [];

      // تجميع كل الطلبات المنجزة لفلترتها بدقة
      const allCompletedOrders = uniqOrdersById([...(deliveredOrders || []), ...(returnedOrders || [])]);

      // المسلم: أي أوردر له قطع مسلمة > 0 (يستبعد المرتجع الكامل)
      const combinedDelivered = allCompletedOrders.filter((o: any) => {
        const status = String(o.status || o.order_status || '').toLowerCase();
        if (status === 'returned' || status === 'full_return') return false;
        return computeDeliveredNetPieces(o) > 0;
      });

      // المرتجع: أي أوردر له قطع مرتجعة > 0 (يشمل المرتجع الكامل والجزئي)
      const combinedReturned = allCompletedOrders.filter((o: any) => {
        const status = String(o.status || o.order_status || '').toLowerCase();
        return status === 'returned' || status === 'full_return' || computeReturnedPieces(o) > 0;
      });

      setPeriodSummary({
        delivered: {
          count: combinedDelivered.length,
          pieces: combinedDelivered.reduce((s: number, o: any) => s + computeDeliveredNetPieces(o), 0),
          value: combinedDelivered.reduce((s: number, o: any) => s + computeDeliveredNetValue(o), 0)
        },
        returned: {
          count: combinedReturned.length,
          pieces: combinedReturned.reduce((s: number, o: any) => s + computeReturnedPieces(o), 0),
          value: combinedReturned.reduce((s: number, o: any) => s + computeReturnedOrderValue(o), 0)
        },
        deferred: {
          count: deferredOrders.length,
          pieces: deferredOrders.reduce((s: number, o: any) => s + computePieces(o), 0),
          value: deferredOrders.reduce((s: number, o: any) => s + computeOrderValueWithoutShipping(o), 0)
        },
        _delivered_list: combinedDelivered,
        _returned_list: combinedReturned,
        _deferred_list: deferredOrders
      });
    } catch (e) {
      console.error('Error fetching period summary:', e);
      setPeriodSummary(null);
    } finally {
      setPeriodLoading(false);
    }
  };

  const showPeriodDetails = async (type: 'delivered' | 'returned' | 'deferred') => {
    try {
      if (!periodSummary) return;
      if (type === 'delivered') {
        setDeliveredOrdersList(periodSummary._delivered_list || []);
        setViewModal('delivered');
      } else if (type === 'returned') {
        setReturnedOrdersList(periodSummary._returned_list || []);
        setViewModal('returned');
      } else if (type === 'deferred') {
        setDeferredOrders(periodSummary._deferred_list || []);
        setViewModal('deferred');
      }
    } catch (err) { console.error('showPeriodDetails failed', err); }
  };

  const setPeriodPreset = (preset: 'today'|'week'|'month'|'year') => {
    const now = new Date(); const fmt = (d:Date) => d.toISOString().slice(0,10);
    if (preset === 'today') { setPeriodStart(fmt(now)); setPeriodEnd(fmt(now)); }
    else if (preset === 'week') { const s = new Date(now); s.setDate(now.getDate()-6); setPeriodStart(fmt(s)); setPeriodEnd(fmt(now)); }
    else if (preset === 'month') { const s = new Date(now.getFullYear(), now.getMonth(), 1); setPeriodStart(fmt(s)); setPeriodEnd(fmt(now)); }
    else if (preset === 'year') { const s = new Date(now.getFullYear(), 0, 1); setPeriodStart(fmt(s)); setPeriodEnd(fmt(now)); }
  };

  const [repBalance, setRepBalance] = useState<number>(0);
  const [paidAmount, setPaidAmount] = useState<number>(0);
  const [settlementDirection, setSettlementDirection] = useState<'collect'|'pay'>('collect');
  const [repTxType, setRepTxType] = useState<'none'|'bonus'|'penalty'>('none');
  const [repTxAmount, setRepTxAmount] = useState<number>(0);
  const [repTxReason, setRepTxReason] = useState<string>('');
  const [repTxLoading, setRepTxLoading] = useState<boolean>(false);

  const [repStats, setRepStats] = useState<RepStats>(emptyRepStats);
  const [repExtras, setRepExtras] = useState(emptyRepExtras);
  const [journalStats, setJournalStats] = useState<JournalStatsState>(emptyJournalStats);

  const [repOrders, setRepOrders] = useState<any[]>([]);
  const [deferredOrders, setDeferredOrders] = useState<any[]>([]);
  const [selectedOrderIdsLocal, setSelectedOrderIdsLocal] = useState<number[]>([]);

  const [deliveredOrdersList, setDeliveredOrdersList] = useState<any[]>([]);
  const [returnedOrdersList, setReturnedOrdersList] = useState<any[]>([]);
  const [viewModal, setViewModal] = useState<'delivered' | 'returned' | 'deferred' | null>(null);
  const [openDailyInfo, setOpenDailyInfo] = useState<{ daily_code: string; id: number } | null>(null);
  // مشتق من openDailyInfo — 'none' = لا توجد يومية مفتوحة (يُصفّر الملخص)
  const selectedJournalId = openDailyInfo ? String(openDailyInfo.id) : 'none';

  const [repOrdersViewMode, setRepOrdersViewMode] = useState<'list' | 'card'>('card');
  const [repOrdersSortOrder, setRepOrdersSortOrder] = useState<'asc' | 'desc'>('desc');
  const [deferredOrdersViewMode, setDeferredOrdersViewMode] = useState<'list' | 'card'>('card');
  const [deferredOrdersSortOrder, setDeferredOrdersSortOrder] = useState<'asc' | 'desc'>('desc');

  const repOrdersSorted = useMemo(() => {
    const list = [...repOrders];
    list.sort((a, b) => {
      const idA = Number(a.id);
      const idB = Number(b.id);
      return repOrdersSortOrder === 'asc' ? idA - idB : idB - idA;
    });
    return list;
  }, [repOrders, repOrdersSortOrder]);

  const deferredOrdersSorted = useMemo(() => {
    const list = [...deferredOrders];
    list.sort((a, b) => {
      const idA = Number(a.id);
      const idB = Number(b.id);
      return deferredOrdersSortOrder === 'asc' ? idA - idB : idB - idA;
    });
    return list;
  }, [deferredOrders, deferredOrdersSortOrder]);

  const computeOrderValueWithoutShipping = (o: any) => {
    const status = String(o?.status || o?.order_status || '').toLowerCase();
    
    // إذا كان المرتجع كاملاً، القيمة المسلمة صفر
    if (status === 'returned' || status === 'full_return') return 0;

    const items = o.products || o.order_items || o.items || [];
    if (Array.isArray(items) && items.length > 0) {
      return items.reduce((s: number, p: any) => {
        const qty = toNum(p.quantity ?? p.qty ?? 0);
        let lineTotal = parseNumeric(p.total ?? p.total_price ?? p.lineTotal ?? p.line_total ?? p.amount ?? p.value);
        if (!lineTotal || lineTotal === 0) {
          const unit = parseNumeric(p.price ?? p.price_per_unit ?? p.sale_price ?? p.salePrice ?? p.unit_price ?? p.unitPrice);
          lineTotal = unit * qty;
        }
        return s + toNum(lineTotal);
      }, 0);
    }
    const rawSub = parseNumeric(o.subTotal ?? o.total_amount ?? o.total ?? 0);
    const ship = parseNumeric(o.shipping ?? o.shipping_fees ?? o.shippingCost ?? 0);
    const totalField = parseNumeric(o.total ?? o.total_amount ?? 0);
    if ((!items || items.length === 0) && ship > 0 && totalField > 0 && Math.abs(rawSub - totalField) < 0.001) {
      return Math.max(0, rawSub - ship);
    }
    if ((!items || items.length === 0) && o.subTotal === undefined && ship > 0 && rawSub > ship) {
        return Math.max(0, rawSub - ship);
    }
    return rawSub;
  };

  const computeOrderValue = (o: any) => {
      const ship = parseNumeric(o.shipping ?? o.shipping_fees ?? o.shippingCost ?? 0);
      return computeOrderValueWithoutShipping(o) + ship;
  };

  const computePieces = (order: any) => {
    const status = String(order?.status || order?.order_status || '').toLowerCase();
    if (status === 'returned' || status === 'full_return') return 0;

    const items = order.products || order.order_items || order.items || [];
    if (Array.isArray(items) && items.length > 0) {
      return items.reduce((s: number, p: any) => s + toNum(p.quantity ?? p.qty ?? 0), 0);
    }
    // fallback في حال عدم وجود منتجات
    if (order.pieces_count !== undefined) return toNum(order.pieces_count);
    if (order.total_pieces !== undefined) return toNum(order.total_pieces);
    return 0;
  };

  // المرتجع الفعلي: المسجل في حقول المرتجع فقط
  const computeReturnedPieces = (order: any) => {
    const status = String(order?.status || order?.order_status || '').toLowerCase();
    if (status === 'returned' || status === 'full_return') {
      const items = order.products || order.order_items || order.items || [];
      if (Array.isArray(items) && items.length > 0) {
        return items.reduce((s: number, p: any) => s + toNum(p.quantity ?? p.qty ?? 0), 0);
      }
      return Math.max(toNum(order?.pieces_count), toNum(order?.total_pieces));
    }
    // في حالة التسليم الجزئي أو المندوب، نأخذ الرقم المسجل للمرتجع فقط
    return Math.max(toNum(order?.returned_pieces), toNum(order?.returned_pieces_fallback));
  };

  const computeReturnedOrderValue = (order: any) => {
    const status = String(order?.status || order?.order_status || '').toLowerCase();
    if (status === 'returned' || status === 'full_return') {
      const rawSub = parseNumeric(order.subTotal ?? order.total_amount ?? order.total ?? 0);
      const ship = parseNumeric(order.shipping ?? order.shipping_fees ?? order.shippingCost ?? 0);
      if (ship > 0 && rawSub > ship) return Math.max(0, rawSub - ship);
      return rawSub;
    }
    return Math.max(toNum(order?.returned_value), toNum(order?.returned_value_fallback));
  };

  // المسلم الفعلي: إجمالي الأوردر الحالي (لأن قاعدة البيانات تخصم المرتجع من الأوردر نفسه)
  const computeDeliveredNetPieces = (order: any) => computePieces(order);
  const computeDeliveredNetValue = (order: any) => computeOrderValueWithoutShipping(order);

  // إجمالي الأوردر الأصلي (قبل الخصم)
  const computeOriginalPieces = (order: any) => computeDeliveredNetPieces(order) + computeReturnedPieces(order);
  const computeOriginalOrderValue = (order: any) => computeDeliveredNetValue(order) + computeReturnedOrderValue(order);

  const isPartialReturn = (order: any) => {
    const status = String(order?.status || order?.order_status || '').toLowerCase();
    const del = computeDeliveredNetPieces(order);
    const ret = computeReturnedPieces(order);
    return (status === 'partial' || status === 'partial_return') || (del > 0 && ret > 0);
  };

  const isFullReturnOrder = (order: any) => {
    const status = String(order?.status || order?.order_status || '').toLowerCase();
    const del = computeDeliveredNetPieces(order);
    const ret = computeReturnedPieces(order);
    return (status === 'returned' || status === 'full_return') || (ret > 0 && del === 0);
  };

  const uniqOrdersById = (arr: any[]) => {
    const seen = new Set<number>();
    const out: any[] = [];
    for (const it of (arr || [])) {
      const id = Number(it?.id ?? it?.order_id ?? 0);
      if (!id) continue;
      if (seen.has(id)) continue;
      seen.add(id);
      out.push(it);
    }
    return out;
  };

  const resetDailyCloseState = () => {
    setRepStats(emptyRepStats);
    setRepExtras(emptyRepExtras);
    setJournalStats(emptyJournalStats);
    setRepOrders([]);
    setDeferredOrders([]);
    setDeliveredOrdersList([]);
    setReturnedOrdersList([]);
    setSelectedOrderIdsLocal([]);
  };

  const loadRepDailyCloseData = async (repId: string, from?: string, to?: string, journalId: string = 'all') => {
    if (!repId) {
      resetDailyCloseState();
      return;
    }

    setStatsLoading(true);
    try {
      const dailyUrl = `${API_BASE_PATH}/api.php?module=sales&action=getRepDailyJournal&rep_id=${encodeURIComponent(repId)}`;
      // const openDailyUrl = `${API_BASE_PATH}/api.php?module=sales&action=getRepOpenDaily&rep_id=${encodeURIComponent(repId)}`;

      const [dailyRes] = await Promise.all([
        fetch(dailyUrl).then(r => r.json())
      ]);

      if (!dailyRes || !dailyRes.success) throw new Error(dailyRes?.message || 'getRepDailyJournal failed');

      const allDailyRows = Array.isArray(dailyRes.data) ? dailyRes.data : [];

      const inRange = (journalDate: any) => {
        const value = String(journalDate || '').slice(0, 10);
        if (!value) return false;
        if (from && value < from) return false;
        if (to && value > to) return false;
        return true;
      };

      let mergedRows: any[] = [];
      if (journalId === 'all' || journalId === 'none') {
        // لا يوجد يومية محددة — نصفّر الملخص ولا نعرض بيانات قديمة
        resetDailyCloseState();
        setStatsLoading(false);
        return;
      } else {
        mergedRows = allDailyRows.filter((row: any) => String(row.id) === String(journalId));
      }

      
      const journalIds = Array.from(new Set(mergedRows.map((row: any) => Number(row.id)).filter((id: number) => Number.isFinite(id) && id > 0)));

      if (journalIds.length === 0) {
        setJournalStats({
          oldOrdersCount: mergedRows.reduce((sum: number, row: any) => sum + toNum(row.opening_orders_count), 0),
          todayOrdersCount: mergedRows.reduce((sum: number, row: any) => sum + toNum(row.orders_assigned_count), 0),
          deliveredCount: 0,
          deliveredTotal: 0,
          returnedCount: 0,
          postponedCount: 0,
          postponedTotal: 0,
        });
        setRepStats(emptyRepStats);
        setRepExtras(emptyRepExtras);
        setRepOrders([]);
        setDeferredOrders([]);
        setDeliveredOrdersList([]);
        setReturnedOrdersList([]);
        setSelectedOrderIdsLocal([]);
        return;
      }

      const ordersUrl = `${API_BASE_PATH}/api.php?module=sales&action=getJournalOrders&rep_id=${encodeURIComponent(repId)}&journal_ids=${encodeURIComponent(journalIds.join(','))}`;
      const ordersRes = await fetch(ordersUrl).then(r => r.json());
      if (!ordersRes || !ordersRes.success) throw new Error(ordersRes?.message || 'getJournalOrders failed');

      // جلب القوائم الخام من السيرفر
      const rawActive = ordersRes.active || [];
      const rawDelivered = ordersRes.delivered || [];
      const rawDeferred = ordersRes.deferred || [];
      const rawReturned = ordersRes.returned || [];

      // توحيد المعرفات لضمان عدم التكرار (استخدام id أو order_id)
      const getOrderIdStr = (o: any) => String(o?.id ?? o?.order_id ?? '');

      // 1. تجميع الاوردرات المنتهية (مسلم ومرتجع) - لها الأولوية القصوى
      const deliveredCombined = uniqOrdersById(rawDelivered);
      const validReturnedOrders = uniqOrdersById(rawReturned);
      const completedIds = new Set([...deliveredCombined, ...validReturnedOrders].map(getOrderIdStr).filter(id => id !== ''));

      // 2. تجميع الاوردرات الحالية (مع استبعاد المنتهي منها)
      const activeUnique = uniqOrdersById(rawActive);
      const exclusiveActive = activeUnique.filter(o => !completedIds.has(getOrderIdStr(o)));
      const activeIds = new Set(exclusiveActive.map(getOrderIdStr).filter(id => id !== ''));

      // 3. تجميع الاوردرات المؤجلة (مع استبعاد المنتهي والحالي منها)
      const deferredUnique = uniqOrdersById(rawDeferred);
      const exclusiveDeferredOrders = deferredUnique.filter(o => {
        const id = getOrderIdStr(o);
        return id !== '' && !completedIds.has(id) && !activeIds.has(id);
      });

      // حساب القيم بدقة من القوائم النهائية المفلترة
      const deliveredValue = deliveredCombined.reduce((sum: number, order: any) => sum + computeDeliveredNetValue(order), 0);
      const deliveredPieces = deliveredCombined.reduce((sum: number, order: any) => sum + computeDeliveredNetPieces(order), 0);
      
      const returnedValue = validReturnedOrders.reduce((sum: number, order: any) => sum + computeReturnedOrderValue(order), 0);
      const returnedPieces = validReturnedOrders.reduce((sum: number, order: any) => sum + computeReturnedPieces(order), 0);
      
      const deferredValue = exclusiveDeferredOrders.reduce((sum: number, order: any) => sum + computeOrderValueWithoutShipping(order), 0);
      const deferredPieces = exclusiveDeferredOrders.reduce((sum: number, order: any) => sum + computePieces(order), 0);

      // تحديث كافة الحالات في عملية واحدة لضمان تزامن الواجهة
      setRepStats({
        deliveredCount: deliveredCombined.length,
        deliveredValue,
        returnedCount: validReturnedOrders.length,
        returnedValue,
      });
      
      setRepExtras({
        deliveredPieces,
        returnedPieces,
        deferredCount: exclusiveDeferredOrders.length,
        deferredPieces,
        deferredValue,
      });
      
      setJournalStats({
        oldOrdersCount: mergedRows.reduce((sum: number, row: any) => sum + toNum(row.opening_orders_count), 0),
        todayOrdersCount: mergedRows.reduce((sum: number, row: any) => sum + toNum(row.orders_assigned_count), 0),
        deliveredCount: deliveredCombined.length,
        deliveredTotal: deliveredValue,
        returnedCount: validReturnedOrders.length,
        postponedCount: exclusiveDeferredOrders.length,
        postponedTotal: deferredValue,
      });

      setRepOrders(exclusiveActive);
      setDeferredOrders(exclusiveDeferredOrders);
      setDeliveredOrdersList(deliveredCombined);
      setReturnedOrdersList(validReturnedOrders);
      setSelectedOrderIdsLocal(exclusiveActive.map((o: any) => o.id));
      
    } catch (e) {
      console.error('Failed to load rep daily close data', e);
      resetDailyCloseState();
    } finally {
      setStatsLoading(false);
    }
  };
  const recalcDeferredExtras = (deferredList:any[]) => {
    const deferredPieces = (deferredList||[]).reduce((s:number,o:any) => s + computePieces(o), 0);
    const deferredValue = (deferredList||[]).reduce((s:number,o:any) => s + computeOrderValueWithoutShipping(o), 0);
    setRepExtras(prev => ({ ...prev, deferredCount: (deferredList||[]).length, deferredPieces, deferredValue }));
  };

  const selectedRep = useMemo(
    () => reps.find(r => String(r.id) === String(selectedRepId)) || null,
    [reps, selectedRepId]
  );

  const selectedTreasuryName = useMemo(
    () => treasuries.find(t => String(t.id) === String(selectedTreasuryId))?.name || '',
    [treasuries, selectedTreasuryId]
  );

  const canChangeTreasury = useMemo(() => {
    if (!userDefaults) return true;
    if (userDefaults.default_treasury_id && userDefaults.can_change_treasury === false) return false;
    return true;
  }, [userDefaults]);

  const loadReps = async () => {
    try {
      const r = await fetch(`${API_BASE_PATH}/api.php?module=users&action=getAllWithBalance&related_to_type=rep`);
      const j = await r.json();
      const list = j && j.success ? j.data || [] : [];
      setReps(list.filter((u: any) => u.role === 'representative'));
    } catch (e) {
      console.error('Failed to load reps', e);
      setReps([]);
    }
  };

  const loadTreasuriesAndDefaults = async () => {
    try {
      const [tr, ud] = await Promise.all([
        fetch(`${API_BASE_PATH}/api.php?module=treasuries&action=getAll`).then(r => r.json()),
        fetch(`${API_BASE_PATH}/api.php?module=permissions&action=getUserDefaults`)
          .then(r => r.json())
          .catch(() => ({ success: false }))
      ]);

      const tList = tr && tr.success ? tr.data || [] : [];
      const defaults = ud && ud.success ? ud.data || null : null;

      setUserDefaults(defaults);

      if (defaults && defaults.default_treasury_id && defaults.can_change_treasury === false) {
        const filtered = tList.filter((t: any) => Number(t.id) === Number(defaults.default_treasury_id));
        setTreasuries(filtered);
        if (filtered.length > 0) setSelectedTreasuryId(String(filtered[0].id));
      } else {
        setTreasuries(tList);
        if (!selectedTreasuryId && tList.length > 0) setSelectedTreasuryId(String(tList[0].id));
      }
    } catch (e) {
      console.error('Failed to load treasuries/defaults', e);
      setTreasuries([]);
    }
  };

  const loadRepDailyStats = async (repId: string, from?: string, to?: string, journalId: string = 'all') => {
    await loadRepDailyCloseData(repId, from, to, journalId);
  };

  const refreshSelectedRepBalanceFromServer = async (repId: string) => {
    try {
      const r = await fetch(`${API_BASE_PATH}/api.php?module=users&action=getAllWithBalance&related_to_type=rep`);
      const j = await r.json();
      if (j && j.success) {
        const list = (j.data || []).filter((u: any) => u.role === 'representative');
        setReps(list);
        const rep = list.find((u: any) => String(u.id) === String(repId));
        const bal = toNum(rep?.balance ?? 0);
        setRepBalance(bal);
        setPaidAmount(Math.max(0, -bal));
      }
    } catch (e) {
      console.error('Failed to refresh rep balance', e);
    }
  };

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        await Promise.all([loadReps(), loadTreasuriesAndDefaults()]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!selectedRepId) {
      setRepBalance(0);
      setPaidAmount(0);
      resetDailyCloseState();
      setOpenDailyInfo(null);
      return;
    }

    const rep = reps.find(r => String(r.id) === String(selectedRepId));
    const bal = toNum(rep?.balance ?? 0);
    setRepBalance(bal);
    setPaidAmount(Math.max(0, -bal));
    (async () => {
      try {
        // جلب اليومية المفتوحة دائماً
        let openId = 'none'; // none = تأكيد أنه لا توجد يومية مفتوحة
        try {
          const odResp = await fetch(`${API_BASE_PATH}/api.php?module=sales&action=getRepOpenDaily&rep_id=${selectedRepId}`);
          const odJson = await odResp.json();
          if (odJson?.success && odJson.data) {
            setOpenDailyInfo({ daily_code: odJson.data.daily_code || '', id: Number(odJson.data.id) });
            openId = String(odJson.data.id);
          } else {
            setOpenDailyInfo(null);
          }
        } catch { setOpenDailyInfo(null); }

        if (openId === 'none') {
          // لا توجد يومية مفتوحة — تصفير كل شيء
          resetDailyCloseState();
          return;
        }

        // تحميل بيانات اليومية المفتوحة فقط
        await loadRepDailyCloseData(selectedRepId, statsFrom, statsTo, openId);
      } catch (e) {
        console.error('Failed to load journal data for rep', e);
        resetDailyCloseState();
        setOpenDailyInfo(null);
      }
    })();
  }, [selectedRepId, reps]);

  // لا داعي لـ useEffect منفصل للـ selectedJournalId لأنه مشتق من openDailyInfo

  const toggleSelectAllLocal = () => {
    if ((selectedOrderIdsLocal||[]).length === (repOrders||[]).length) {
      setSelectedOrderIdsLocal([]);
    } else {
      setSelectedOrderIdsLocal((repOrders||[]).map((o:any)=>o.id));
    }
  };

  const toggleSelectOrderLocal = (id:number) => {
    setSelectedOrderIdsLocal(prev => prev.includes(id) ? prev.filter(x=>x!==id) : [...prev, id]);
  };

  const markSelectedDelivered = async () => {
    const ids = selectedOrderIdsLocal.slice();
    if (ids.length === 0) { 
      Swal.fire('تحذير','اختر الاوردرات أولاً','warning'); 
      return; 
    }
    try {
      setLoading(true);
      // Separate orders into partial-return cases vs full deliveries
      const moved = (repOrders || []).filter((o:any)=> ids.includes(o.id));
      const partialIds: number[] = [];
      const fullIds: number[] = [];
      moved.forEach((o: any) => {
        const returnedPieces = computeReturnedPieces(o);
        if (returnedPieces > 0) partialIds.push(Number(o.id)); else fullIds.push(Number(o.id));
      });

      // For full deliveries: update orders.status -> delivered and check responses
      let ordersUpdateFailed: number[] = [];
      if (fullIds.length > 0) {
        console.log('Sending update for orders:', fullIds, 'with status: delivered');
        const respPromises = fullIds.map(id => fetch(`${API_BASE_PATH}/api.php?module=orders&action=update`, { 
          method: 'POST', headers: {'Content-Type':'application/json'},
          body: JSON.stringify({ id, status: 'delivered', repId: Number(selectedRepId) })
        }).catch(err => ({ ok: false, error: err })));

        const resps = await Promise.all(respPromises);
        for (let i = 0; i < resps.length; i++) {
          const r = resps[i];
          const id = fullIds[i];
          if (!r || (r as any).error) {
            ordersUpdateFailed.push(id);
            continue;
          }
          try {
            const j = await (r as Response).json().catch(() => null);
            if (!j || j.success === false) ordersUpdateFailed.push(id);
          } catch (e) {
            ordersUpdateFailed.push(id);
          }
        }
      }

      // Update journal statuses: full -> delivered, partial -> partial_return. Check responses.
      let journalErrors: string[] = [];
      if (fullIds.length > 0) {
        try {
          const r = await fetch(`${API_BASE_PATH}/api.php?module=sales&action=updateJournalOrderStatus`, {
            method: 'POST', headers: {'Content-Type':'application/json'},
            body: JSON.stringify({ rep_id: Number(selectedRepId), order_ids: fullIds, status: 'delivered' })
          });
          const j = await r.json().catch(() => null);
          if (!j || j.success === false) journalErrors.push('delivered-journal-failed');
        } catch (e) { console.warn(e); journalErrors.push('delivered-journal-ex'); }
      }
      if (partialIds.length > 0) {
        try {
          const r2 = await fetch(`${API_BASE_PATH}/api.php?module=sales&action=updateJournalOrderStatus`, {
            method: 'POST', headers: {'Content-Type':'application/json'},
            body: JSON.stringify({ rep_id: Number(selectedRepId), order_ids: partialIds, status: 'partial_return' })
          });
          const j2 = await r2.json().catch(() => null);
          if (!j2 || j2.success === false) journalErrors.push('partial-journal-failed');
        } catch (e) { console.warn(e); journalErrors.push('partial-journal-ex'); }
      }

      if (ordersUpdateFailed.length > 0 || journalErrors.length > 0) {
        console.warn('markSelectedDelivered: failures', { ordersUpdateFailed, journalErrors });
        if (typeof window !== 'undefined') (window as any).__lastMarkDelivered = { ordersUpdateFailed, journalErrors };
        Swal.fire('خطأ', 'فشل تحديث بعض الاوردرات على الخادم. تحقق من السجل.', 'error');
        // Re-fetch to ensure UI reflects server state
        await loadRepDailyStats(selectedRepId, statsFrom, statsTo, selectedJournalId);
        return;
      }

      // If partialIds were marked as partial_return in journal, we also need to mark remaining portion as delivered
      // so the order appears in delivered lists. Call orders.update -> status: 'delivered' for partialIds.
      if (partialIds.length > 0) {
        const respPromises2 = partialIds.map(id => fetch(`${API_BASE_PATH}/api.php?module=orders&action=update`, {
          method: 'POST', headers: {'Content-Type':'application/json'},
          body: JSON.stringify({ id, status: 'delivered', repId: Number(selectedRepId) })
        }).catch(err => ({ ok: false, error: err })));

        const resps2 = await Promise.all(respPromises2);
        const failedPartialUpdates: number[] = [];
        for (let i = 0; i < resps2.length; i++) {
          const r = resps2[i];
          const id = partialIds[i];
          if (!r || (r as any).error) { failedPartialUpdates.push(id); continue; }
          try {
            const j = await (r as Response).json().catch(() => null);
            if (!j || j.success === false) failedPartialUpdates.push(id);
          } catch (e) { failedPartialUpdates.push(id); }
        }
        if (failedPartialUpdates.length > 0) {
          console.warn('markSelectedDelivered: failed to mark partialIds delivered', failedPartialUpdates);
          if (typeof window !== 'undefined') (window as any).__lastMarkDelivered = { failedPartialUpdates };
          Swal.fire('تحذير', 'تم تحديث اليومية لكن فشل تحديث حالة بعض الاوردرات إلى تم التسليم.', 'warning');
          await loadRepDailyStats(selectedRepId, statsFrom, statsTo, selectedJournalId);
          return;
        }

      // store last responses for debugging in browser console
      try {
        if (typeof window !== 'undefined') {
          (window as any).__lastMarkDelivered = (window as any).__lastMarkDelivered || {};
          (window as any).__lastMarkDelivered.timestamp = new Date().toISOString();
        }
      } catch (e) {}
      }

      // Update local lists: remove all moved from repOrders, add them to delivered list; partial ones should also be present in returned list
      setRepOrders(prev => prev.filter((o:any)=> !ids.includes(o.id)));
      setDeferredOrders(prev => prev.filter((o:any)=> !ids.includes(o.id)));
      setDeliveredOrdersList(prev => uniqOrdersById([...(prev || []), ...moved]));
      // ensure partial returned orders are in returnedOrdersList
      if (partialIds.length > 0) {
        const partialMoved = moved.filter((o:any)=> partialIds.includes(Number(o.id)));
        setReturnedOrdersList(prev => uniqOrdersById([...(prev || []), ...partialMoved]));
      }

      setSelectedOrderIdsLocal([]);

      const newDelivered = uniqOrdersById([...(deliveredOrdersList || []), ...moved]);
      setRepStats(prev => {
        const deliveredValue = newDelivered.reduce((s: number, o: any) => s + computeDeliveredNetValue(o), 0);
        return {
          ...prev,
          deliveredCount: newDelivered.length,
          deliveredValue
        };
      });
      setRepExtras(prev => ({ 
        ...prev, 
        deliveredPieces: newDelivered.reduce((s:number,o:any) => s + computeDeliveredNetPieces(o), 0) 
      }));

      Swal.fire('تم', `تم تحديث حالة ${ids.length} أوردر بنجاح.`, 'success');
    } catch (e) {
      console.error(e); 
      Swal.fire('خطأ','فشل تحديث حالة الاوردرات.','error');
    } finally { 
      setLoading(false); 
    }
  };

  const moveSelectedToDeferred = async () => {
    const ids = selectedOrderIdsLocal.slice();
    if (ids.length === 0) { 
      Swal.fire('تحذير','اختر الاوردرات أولاً','warning'); 
      return; 
    }
    try {
      setLoading(true);
      const resp = await fetch(`${API_BASE_PATH}/api.php?module=sales&action=updateJournalOrderStatus`, {
        method: 'POST', headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ rep_id: Number(selectedRepId), order_ids: ids, status: 'deferred' })
      });
      const jj = await resp.json().catch(() => null);
      
      await loadRepDailyStats(selectedRepId, statsFrom, statsTo, selectedJournalId);
      setSelectedOrderIdsLocal([]);
      Swal.fire('تم', 'تم نقل الاوردرات المحددة إلى المؤجلة.', 'success');
    } catch (e) { 
      console.error(e); 
      Swal.fire('خطأ','فشل نقل الاوردرات.','error'); 
    } finally { 
      setLoading(false); 
    }
  };

  const moveSingleToDeferred = async (order:any) => {
    try {
      setLoading(true);
      await fetch(`${API_BASE_PATH}/api.php?module=sales&action=updateJournalOrderStatus`, {
        method: 'POST', headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ rep_id: Number(selectedRepId), order_ids: [order.id], status: 'deferred' })
      });
      await loadRepDailyStats(selectedRepId, statsFrom, statsTo, selectedJournalId);
    } catch (e) { 
      console.error(e); 
      Swal.fire('خطأ','فشل نقل الاوردر.','error'); 
    } finally { 
      setLoading(false); 
    }
  };

  const moveDeferredBack = async (order:any) => {
    try {
      setLoading(true);
      await fetch(`${API_BASE_PATH}/api.php?module=sales&action=updateJournalOrderStatus`, {
        method: 'POST', headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ rep_id: Number(selectedRepId), order_ids: [order.id], status: 'with_rep' })
      });

      await fetch(`${API_BASE_PATH}/api.php?module=orders&action=update`, { 
        method: 'POST', 
        headers: {'Content-Type':'application/json'}, 
        body: JSON.stringify({ id: order.id, status: 'with_rep', repId: Number(selectedRepId) }) 
      });

      await loadRepDailyStats(selectedRepId, statsFrom, statsTo, selectedJournalId);
    } catch (e) { 
      console.error(e); 
      Swal.fire('خطأ','فشل استرجاع الاوردر.','error'); 
    } finally { 
      setLoading(false); 
    }
  };

  const handleSubmit = async () => {
    if (!selectedRepId) {
      Swal.fire('اختر المندوب', 'يرجى اختيار المندوب أولاً.', 'warning');
      return;
    }
    if (!openDailyInfo) {
      Swal.fire('تنبيه', 'المندوب ليس له يومية مفتوحة حالياً.', 'warning');
      return;
    }
    const amount = Math.max(0, toNum(paidAmount));

    if (amount > 0 && !selectedTreasuryId) {
      Swal.fire('اختر الخزينة', 'يرجى اختيار الخزينة لإتمام التقفيل.', 'warning');
      return;
    }

    const repName = selectedRep?.name || '';

    const res = await Swal.fire({
      title: 'تأكيد التقفيل',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'تأكيد',
      cancelButtonText: 'إلغاء',
      html: `
        <div style="text-align:right; line-height:1.9">
          <div><b>المندوب:</b> ${repName}</div>
          <div><b>الخزينة:</b> ${selectedTreasuryName || selectedTreasuryId || '—'}</div>
          <div><b>طريقة التسوية:</b> ${settlementDirection === 'collect' ? 'تحصيل من المندوب' : 'دفع إلى المندوب'}</div>
          <hr/>
          <div><b>الحساب الحالى (من قاعدة البيانات):</b> ${money(repBalance)} ${currencySymbol} <span>(${balanceLabel(repBalance)})</span></div>
          <div><b>مبلغ التقفيل المدفوع:</b> ${money(amount)} ${currencySymbol}</div>
          <div style="margin-top:6px;"><b>المتبقي التقديري بعد التسوية:</b> ${money(settlementDirection === 'collect' ? (repBalance + amount) : (repBalance - amount))} ${currencySymbol}</div>
          <hr/>
          <div style="font-size:12px;color:#64748b">
            ملاحظة: هذا التقرير لا يعيد حساب المديونية يدويًا — الرصيد/المديونية تعتمد على قيمة balance من قاعدة البيانات.
          </div>
        </div>
      `
    });

    if (!res.isConfirmed) return;

    try {
      setLoading(true);
      let settleSuccess = false;
      if (amount <= 0) {
        settleSuccess = true;
      } else if (settlementDirection === 'collect') {
        const payload = { repId: Number(selectedRepId), treasuryId: Number(selectedTreasuryId), paidAmount: amount, details: { reason: 'اغلاق اليوميه تلقائيا' }, notes: 'اغلاق اليوميه تلقائيا' };
        const r = await fetch(`${API_BASE_PATH}/api.php?module=sales&action=settleDaily`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
        });
        const j = await r.json();
        if (j && j.success) {
          settleSuccess = true;
        } else {
          Swal.fire('فشل العملية', j?.message || 'تعذر تنفيذ التقفيل.', 'error');
        }
      } else {
        const txPayload = {
          type: 'rep_payment_out',
          related_to_type: 'rep',
          related_to_id: Number(selectedRepId),
          amount: amount,
          treasuryId: Number(selectedTreasuryId),
          direction: 'out',
          details: { context: 'close_daily', action: 'settleDaily', rep_id: Number(selectedRepId), model: 'consignment', reason: 'اغلاق اليوميه تلقائيا' },
          notes: 'اغلاق اليوميه تلقائيا',
          title: `دفع إلى المندوب - تسوية يومية`,
          memo: `تسوية يومية للمندوب ${selectedRep?.name || ''}`
        };
        const r2 = await fetch(`${API_BASE_PATH}/api.php?module=transactions&action=create`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(txPayload)
        });
        const j2 = await r2.json();
        if (j2 && j2.success) {
          settleSuccess = true;
        } else {
          Swal.fire('فشل العملية', j2?.message || 'تعذر تسجيل عملية الدفع.', 'error');
        }
      }

      if (settleSuccess) {
        try {
          await fetch(`${API_BASE_PATH}/api.php?module=sales&action=logCloseDaily`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              rep_id: Number(selectedRepId),
              treasury_id: selectedTreasuryId ? Number(selectedTreasuryId) : null,
              paid_amount: amount,
              direction: settlementDirection,
              event_date: new Date().toISOString().slice(0, 10),
              notes: 'اغلاق اليوميه تلقائيا'
            })
          });
        } catch (logErr) { console.warn('logCloseDaily failed (non-critical)', logErr); }

        if (openDailyInfo) {
          try {
            const closeResp = await fetch(`${API_BASE_PATH}/api.php?module=sales&action=closeRepDaily`, {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ rep_id: Number(selectedRepId), journal_id: openDailyInfo.id })
            });
            const closeJson = await closeResp.json().catch(() => null);
            if (!closeJson?.success) {
              Swal.fire('تنبيه', closeJson?.message || 'تعذر إغلاق اليومية.', 'warning');
            } else {
              Swal.fire('تم', amount > 0 ? 'تم التقفيل وإغلاق اليومية بنجاح.' : 'تم إغلاق اليومية بنجاح بدون حركة مالية.', 'success');
            }
            setOpenDailyInfo(null);
          } catch (e) { console.warn('closeRepDaily failed (non-critical)', e); }
        }
      }
      await Promise.all([refreshSelectedRepBalanceFromServer(selectedRepId), loadRepDailyStats(selectedRepId, statsFrom, statsTo, selectedJournalId)]);
    } catch (e) {
      console.error('Settle daily failed', e);
      Swal.fire('خطأ', 'فشل الاتصال بالخادم أثناء تنفيذ التقفيل.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 space-y-5 relative" dir="rtl">
      <div className="rounded-3xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-end gap-3 justify-between">
          <div>
            <h2 className="text-lg font-black text-slate-900 dark:text-white">إغلاق يومية المندوب (تسوية المديونية)</h2>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              التقفيل مرتبط بالخزينة فقط (Treasury) — مديونية المندوب تُقرأ مباشرة من الرصيد (balance).
            </div>
          </div>

          <button
            onClick={async () => {
              setLoading(true);
              try {
                await Promise.all([loadReps(), loadTreasuriesAndDefaults()]);
                if (selectedRepId) await Promise.all([refreshSelectedRepBalanceFromServer(selectedRepId), loadRepDailyStats(selectedRepId, statsFrom, statsTo, selectedJournalId)]);
              } finally {
                setLoading(false);
              }
            }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-slate-900 text-white hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-sm font-black"
            disabled={loading}
            title="تحديث"
          >
            <RefreshCw className="w-4 h-4" />
            تحديث
          </button>
        </div>
      </div>

      <div className="mb-3 grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4">
          <div className="text-xs text-slate-500 mb-2">اختر المندوب</div>
          <CustomSelect
            value={selectedRepId}
            onChange={v => setSelectedRepId(v)}
            options={reps.map(r => ({ value: String(r.id), label: r.name }))}
            placeholder="— اختر —"
            disabled={loading}
          />
          {selectedRepId && (
            <div className="mt-2">
              {openDailyInfo ? (
                <span className="inline-flex items-center gap-1.5 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 px-3 py-1 rounded-full text-xs font-bold border border-green-200 dark:border-green-800">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse inline-block" />
                  يومية مفتوحة: {openDailyInfo.daily_code}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 px-3 py-1 rounded-full text-xs border border-rose-200 dark:border-rose-800">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500 inline-block" />
                  لا يوجد يومية مفتوحة
                </span>
              )}
            </div>
          )}
        </div>
        <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4">
          <div className="text-xs text-slate-500 mb-2">طريقة الدفع</div>
          <div className="flex gap-2 mb-3">
            <button
              type="button"
              onClick={() => {
                setPaymentMethod('cash');
                if (userDefaults?.default_treasury_id) {
                  setSelectedTreasuryId(String(userDefaults.default_treasury_id));
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
                    setSelectedTreasuryId(String(found1.id));
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
                  if (trResp2 && trResp2.success) setTreasuries(freshList2);

                  // Step 5: البحث بالاسم في القائمة المحدثة (أكثر موثوقية من ID)
                  const found2 = freshList2.find((t: any) => normalizeText(t.name) === normalizeText(electronicTreasuryName));
                  if (found2) {
                    setSelectedTreasuryId(String(found2.id));
                  } else if (createJson && createJson.success && createJson.data?.id) {
                    // احتياطي: استخدام ID المُعاد من الإنشاء
                    setSelectedTreasuryId(String(createJson.data.id));
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
              <div className="text-xs text-slate-500 mb-2">اختر الخزينة</div>
              <CustomSelect
                value={selectedTreasuryId}
                onChange={v => setSelectedTreasuryId(v)}
                options={treasuries.map(t => ({ value: String(t.id), label: t.name }))}
                placeholder="— اختر —"
                disabled={loading || !canChangeTreasury}
              />
            </>
          ) : (
            <div className="text-xs font-bold text-blue-600 bg-blue-50 dark:bg-blue-900/20 p-2 rounded-lg border border-blue-100 dark:border-blue-800/50">
              تم اختيار خزينة "مدفوعات إليكترونية" تلقائياً
            </div>
          )}
        </div>
      </div>

      {/* Period Summary box (Company-level -> Rep-level now) */}
      <div className="mt-4 border border-slate-200 dark:border-slate-700 rounded-3xl p-5 bg-white dark:bg-slate-900 shadow-sm">
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <div className="text-sm font-black flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />
            ملخص الفترة الخاصة بالمندوب
          </div>
          <div className="flex items-center gap-2 flex-wrap text-sm">
            <div className="text-xs text-slate-500">من</div>
            <input type="date" value={periodStart} onChange={e=>setPeriodStart(e.target.value)} className="border border-slate-200 dark:border-slate-600 p-1.5 rounded-xl bg-white text-slate-900 dark:bg-slate-800 dark:text-white text-xs" />
            <div className="text-xs text-slate-500">إلى</div>
            <input type="date" value={periodEnd} onChange={e=>setPeriodEnd(e.target.value)} className="border border-slate-200 dark:border-slate-600 p-1.5 rounded-xl bg-white text-slate-900 dark:bg-slate-800 dark:text-white text-xs" />
            
            <div className="mr-4 flex gap-1">
              <button onClick={()=>setPeriodPreset('today')} className="px-2.5 py-1 text-xs font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-lg transition-colors">اليوم</button>
              <button onClick={()=>setPeriodPreset('week')} className="px-2.5 py-1 text-xs font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-lg transition-colors">الأسبوع</button>
              <button onClick={()=>setPeriodPreset('month')} className="px-2.5 py-1 text-xs font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-lg transition-colors">الشهر</button>
            </div>
            <div className="mr-auto">
              <button onClick={fetchPeriodSummary} disabled={!selectedRepId || periodLoading} className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg disabled:opacity-50 transition-colors">
                تحديث الفترة
              </button>
            </div>
          </div>
        </div>

        {!selectedRepId ? (
          <div className="text-sm font-bold text-amber-700 dark:text-amber-400 p-3 bg-amber-50 dark:bg-amber-900/30 rounded-xl border border-amber-200 dark:border-amber-800 flex items-center justify-center">
            برجاء اختيار المندوب أولاً لعرض ملخص الفترة الخاص به.
          </div>
        ) : periodLoading ? (
          <div className="text-sm text-slate-500 flex items-center justify-center py-4">جاري تحميل بيانات الفترة...</div>
        ) : periodSummary ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            <div className="bg-white dark:bg-slate-900 border border-emerald-100 dark:border-slate-700 rounded-2xl p-4 flex flex-col justify-between">
              <div>
                <div className="flex items-start justify-between mb-2">
                  <span className="text-[12px] font-black text-emerald-600 uppercase tracking-wide">إجمالي تسليم (الفترة)</span>
                </div>
                <div className="text-lg font-black text-emerald-700 dark:text-emerald-400 leading-none mb-2">
                  {Number(periodSummary.delivered?.count || 0).toLocaleString()} <span className="text-xs font-bold text-slate-500 mr-1">طلب</span>
                  {periodSummary._delivered_list?.some((o: any) => isPartialReturn(o)) && (
                    <span className="text-xs font-bold text-amber-600 mr-1">(تسليم جزئي)</span>
                  )}
                </div>
                <div className="space-y-1 text-xs text-slate-600 dark:text-slate-400">
                  <div className="flex justify-between"><span>القطع المسلمة</span><span className="font-black">{Number(periodSummary.delivered?.pieces || 0).toLocaleString()}</span></div>
                  <div className="flex justify-between"><span>القيمة</span><span className="font-black text-emerald-600">{Number(periodSummary.delivered?.value || 0).toLocaleString()} ج.م</span></div>
                </div>
              </div>
              <button onClick={() => showPeriodDetails('delivered')} className="mt-3 flex items-center justify-center gap-1 text-xs bg-slate-50 dark:bg-slate-800 hover:bg-emerald-50 text-slate-600 hover:text-emerald-600 py-1.5 px-3 rounded-xl transition-colors w-full border border-slate-100 dark:border-slate-700">
                <Eye className="w-3.5 h-3.5" /> عرض التفاصيل
              </button>
            </div>



            <div className="bg-white dark:bg-slate-900 border border-rose-100 dark:border-slate-700 rounded-2xl p-4 flex flex-col justify-between">
              <div>
                <div className="flex items-start justify-between mb-2">
                  <span className="text-[12px] font-black text-rose-600 uppercase tracking-wide">إجمالي مرتجع (الفترة)</span>
                </div>
                <div className="text-lg font-black text-rose-700 dark:text-rose-400 leading-none mb-2">
                  {Number(periodSummary.returned?.count || 0).toLocaleString()} <span className="text-xs font-bold text-slate-500 mr-1">طلب</span>
                </div>
                <div className="space-y-1 text-xs text-slate-600 dark:text-slate-400">
                  <div className="flex justify-between"><span>القطع المرتجعة</span><span className="font-black">{Number(periodSummary.returned?.pieces || 0).toLocaleString()}</span></div>
                  <div className="flex justify-between"><span>القيمة</span><span className="font-black text-rose-600">{Number(periodSummary.returned?.value || 0).toLocaleString()} ج.م</span></div>
                </div>
              </div>
              <button onClick={() => showPeriodDetails('returned')} className="mt-3 flex items-center justify-center gap-1 text-xs bg-slate-50 dark:bg-slate-800 hover:bg-rose-50 text-slate-600 hover:text-rose-600 py-1.5 px-3 rounded-xl transition-colors w-full border border-slate-100 dark:border-slate-700">
                <Eye className="w-3.5 h-3.5" /> عرض التفاصيل
              </button>
            </div>
          </div>
        ) : (
          <div className="text-sm text-slate-500 flex items-center justify-center py-4">لا توجد بيانات للفترة المحددة.</div>
        )}
      </div>

      <div className="mb-4 rounded-3xl border border-blue-100 bg-gradient-to-br from-blue-50 to-slate-50 dark:from-slate-800 dark:to-slate-900 dark:border-slate-700 p-5 shadow-sm mt-4">
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse flex-shrink-0" />
            <span className="text-sm font-black text-slate-700 dark:text-slate-200 truncate">
              {selectedRepId
                ? openDailyInfo
                  ? `ملخص اليومية — ${openDailyInfo.daily_code} — ${selectedRep?.name || ''}`
                  : `ملخص اليومية — ${selectedRep?.name || ''}`
                : 'ملخص اليومية'}
            </span>
            {statsLoading && (
              <RefreshCw className="w-3.5 h-3.5 text-slate-400 animate-spin flex-shrink-0" />
            )}
            {openDailyInfo && (
              <span className="text-[10px] bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full font-bold flex-shrink-0">
                اليومية المفتوحة
              </span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">

          {/* Balance */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 flex flex-col justify-between">
            <div className="flex items-start justify-between mb-2">
              <span className="text-[11px] font-black text-slate-500 uppercase tracking-wide">الحساب الحالى</span>
              <Wallet className="w-4 h-4 text-slate-400 flex-shrink-0" />
            </div>
            <div className={`text-2xl font-black leading-none mb-1 ${balanceClass(repBalance)}`}>
              {selectedRepId ? money(repBalance) : '—'}
              <span className="text-xs font-bold text-slate-500 mr-1">{currencySymbol}</span>
            </div>
            <div className="text-[11px] text-slate-400">
              {selectedRepId ? `(${balanceLabel(repBalance)}) — من قاعدة البيانات` : 'اختر مندوباً'}
            </div>
          </div>

          {/* Delivered */}
          <div className="bg-white dark:bg-slate-900 border border-emerald-100 dark:border-slate-700 rounded-2xl p-4 flex flex-col justify-between">
            <div>
              <div className="flex items-start justify-between mb-2">
                <span className="text-[11px] font-black text-emerald-600 uppercase tracking-wide">إجمالي تسليم</span>
                <PackageCheck className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              </div>
              <div className="text-2xl font-black text-emerald-700 dark:text-emerald-400 leading-none mb-2">
                {statsLoading ? <span className="text-base text-slate-400">...</span> : repStats.deliveredCount}
                <span className="text-xs font-bold text-slate-500 mr-1">طلب</span>
                {deliveredOrdersList?.some((o: any) => isPartialReturn(o)) && (
                  <span className="text-xs font-bold text-amber-600 mr-1">(تسليم جزئي)</span>
                )}
              </div>
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-slate-600 dark:text-slate-400">
                  <span>القطع المسلمة</span>
                  <span className="font-black">{statsLoading ? '—' : repExtras.deliveredPieces}</span>
                </div>
                <div className="flex justify-between text-xs text-slate-600 dark:text-slate-400">
                  <span>القيمة</span>
                  <span className="font-black text-emerald-600">{statsLoading ? '—' : money(repStats.deliveredValue)} {currencySymbol}</span>
                </div>
              </div>
            </div>
            <button
              onClick={() => setViewModal('delivered')}
              className="mt-3 flex items-center justify-center gap-1 text-xs bg-slate-50 dark:bg-slate-800 hover:bg-emerald-50 text-slate-600 hover:text-emerald-600 py-1.5 px-3 rounded-xl transition-colors w-full border border-slate-100 dark:border-slate-700"
            >
              <Eye className="w-3.5 h-3.5" /> عرض التفاصيل
            </button>
          </div>

          {/* Deferred */}
          <div className="bg-white dark:bg-slate-900 border border-amber-100 dark:border-slate-700 rounded-2xl p-4 flex flex-col justify-between">
            <div>
              <div className="flex items-start justify-between mb-2">
                <span className="text-[11px] font-black text-amber-600 uppercase tracking-wide">المؤجل</span>
                <PackageCheck className="w-4 h-4 text-amber-400 flex-shrink-0" />
              </div>
              <div className="text-2xl font-black text-amber-700 dark:text-amber-400 leading-none mb-2">
                {statsLoading ? <span className="text-base text-slate-400">...</span> : repExtras.deferredCount}
                <span className="text-xs font-bold text-slate-500 mr-1">طلب</span>
              </div>
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-slate-600 dark:text-slate-400">
                  <span>القطع المؤجلة</span>
                  <span className="font-black">{statsLoading ? '—' : repExtras.deferredPieces}</span>
                </div>
                <div className="flex justify-between text-xs text-slate-600 dark:text-slate-400">
                  <span>القيمة</span>
                  <span className="font-black text-amber-600">{statsLoading ? '—' : money(repExtras.deferredValue)} {currencySymbol}</span>
                </div>
              </div>
            </div>
            <button
              onClick={() => setViewModal('deferred')}
              className="mt-3 flex items-center justify-center gap-1 text-xs bg-slate-50 dark:bg-slate-800 hover:bg-amber-50 text-slate-600 hover:text-amber-600 py-1.5 px-3 rounded-xl transition-colors w-full border border-slate-100 dark:border-slate-700"
            >
              <Eye className="w-3.5 h-3.5" /> عرض التفاصيل
            </button>
          </div>

          {/* Returned */}
          <div className="bg-white dark:bg-slate-900 border border-rose-100 dark:border-slate-700 rounded-2xl p-4 flex flex-col justify-between">
            <div>
              <div className="flex items-start justify-between mb-2">
                <span className="text-[11px] font-black text-rose-600 uppercase tracking-wide">إجمالي مرتجع</span>
                <PackageX className="w-4 h-4 text-rose-400 flex-shrink-0" />
              </div>
              <div className="text-2xl font-black text-rose-700 dark:text-rose-400 leading-none mb-2">
                {statsLoading ? <span className="text-base text-slate-400">...</span> : repStats.returnedCount}
                <span className="text-xs font-bold text-slate-500 mr-1">طلب</span>
              </div>
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-slate-600 dark:text-slate-400">
                  <span>القطع المرتجعة</span>
                  <span className="font-black">{statsLoading ? '—' : repExtras.returnedPieces}</span>
                </div>
                <div className="flex justify-between text-xs text-slate-600 dark:text-slate-400">
                  <span>القيمة</span>
                  <span className="font-black text-rose-600">{statsLoading ? '—' : money(repStats.returnedValue)} {currencySymbol}</span>
                </div>
              </div>
            </div>
            <button
              onClick={() => setViewModal('returned')}
              className="mt-3 flex items-center justify-center gap-1 text-xs bg-slate-50 dark:bg-slate-800 hover:bg-rose-50 text-slate-600 hover:text-rose-600 py-1.5 px-3 rounded-xl transition-colors w-full border border-slate-100 dark:border-slate-700"
            >
              <Eye className="w-3.5 h-3.5" /> عرض التفاصيل
            </button>
          </div>

        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-1 space-y-4">
          <div className="rounded-3xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-4 text-slate-900 dark:text-white font-black">
                <User className="w-5 h-5 text-blue-600" />
                معاملة مالية للمندوب
            </div>

            <div className="grid grid-cols-1 gap-3">
              <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/30 p-3">
                <div className="text-xs text-slate-600 dark:text-slate-200 font-black mb-2">نوع المعاملة</div>
                <div className="flex items-center gap-3">
                  <label className="inline-flex items-center gap-2 text-sm">
                    <input type="radio" name="rep_tx" checked={repTxType==='bonus'} onChange={() => setRepTxType('bonus')} />
                    <span>اضافة حافز للمندوب</span>
                  </label>
                  <label className="inline-flex items-center gap-2 text-sm">
                    <input type="radio" name="rep_tx" checked={repTxType==='penalty'} onChange={() => setRepTxType('penalty')} />
                    <span>تطبيق غرامه على المندوب</span>
                  </label>
                  <label className="inline-flex items-center gap-2 text-sm">
                    <input type="radio" name="rep_tx" checked={repTxType==='none'} onChange={() => setRepTxType('none')} />
                    <span>لا شيء</span>
                  </label>
                </div>

                <div className="mt-3 grid grid-cols-1 gap-2">
                  <input
                    type="number"
                    min={0}
                    placeholder="المبلغ"
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl px-3 py-2 text-sm"
                    value={repTxAmount}
                    onChange={e => setRepTxAmount(Math.max(0, toNum(e.target.value)))}
                    disabled={repTxType==='none' || !selectedRepId}
                  />
                  <input
                    type="text"
                    placeholder="السبب (اختياري)"
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl px-3 py-2 text-sm"
                    value={repTxReason}
                    onChange={e => setRepTxReason(e.target.value)}
                    disabled={repTxType==='none' || !selectedRepId}
                  />

                  <div className="flex justify-end">
                    <button
                      className="px-3 py-2 rounded-2xl bg-emerald-500 text-white text-sm font-black disabled:opacity-50"
                      disabled={repTxType==='none' || repTxAmount <= 0 || !selectedRepId || repTxLoading}
                      onClick={async () => {
                        if (!selectedRepId) { 
                          Swal.fire('اختر المندوب','يرجى اختيار المندوب أولاً','warning'); 
                          return; 
                        }
                        if (repTxType==='none') return;
                        const amt = Math.max(0, toNum(repTxAmount));
                        if (amt <= 0) { 
                          Swal.fire('مبلغ غير صالح','ادخل مبلغًا أكبر من صفر','warning'); 
                          return; 
                        }
                        try {
                          setRepTxLoading(true);
                          const payload:any = {
                            related_to_type: 'rep',
                            related_to_id: Number(selectedRepId),
                            amount: amt,
                            details: { reason: repTxReason }
                          };
                          if (repTxType === 'bonus') {
                            payload.type = 'rep_bonus_in';
                            payload.direction = 'in';
                            payload.title = `حافز للمندوب`;
                            payload.memo = repTxReason || 'حافز';
                          } else {
                            payload.type = 'rep_penalty';
                            payload.direction = 'out';
                            payload.title = `غرامة للمندوب`;
                            payload.memo = repTxReason || 'غرامة';
                          }
                          if (selectedTreasuryId) payload.treasuryId = Number(selectedTreasuryId);

                          const r = await fetch(`${API_BASE_PATH}/api.php?module=transactions&action=create`, { 
                            method: 'POST', 
                            headers: { 'Content-Type':'application/json' }, 
                            body: JSON.stringify(payload) 
                          });
                          const j = await r.json();
                          if (j && j.success) {
                            setRepBalance(prev => repTxType === 'bonus' ? prev + amt : prev - amt);
                            setReps(prev => prev.map(u => String(u.id) === String(selectedRepId) ? { ...u, balance: toNum((u.balance || 0) + (repTxType==='bonus' ? amt : -amt)) } : u));
                            Swal.fire('تم', repTxType === 'bonus' ? 'تم إضافة الحافز وتحديث حساب المندوب.' : 'تم تطبيق الغرامة وتحديث حساب المندوب.', 'success');
                            setRepTxAmount(0); 
                            setRepTxReason(''); 
                            setRepTxType('none');
                            refreshSelectedRepBalanceFromServer(selectedRepId).catch(()=>{});
                          } else {
                            Swal.fire('فشل العملية', j?.message || 'تعذر تسجيل المعاملة.', 'error');
                          }
                        } catch (e) {
                          console.error('rep tx failed', e); 
                          Swal.fire('خطأ','فشل الاتصال أثناء تسجيل المعاملة.','error');
                        } finally { 
                          setRepTxLoading(false); 
                        }
                      }}
                    >
                      تنفيذ
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 dark:border-slate-700 bg-gradient-to-br from-slate-900 to-slate-800 p-5 shadow-sm text-white">
            <div className="flex items-center gap-2 font-black">
              <CheckCircle2 className="w-5 h-5 text-emerald-300" />
              تأكيد التقفيل
            </div>
            <div className="mt-3 text-xs text-slate-200/80 leading-6">
              سيتم إنشاء حركة خزينة لتسجيل مبلغ التقفيل ضمن الخزينة المحددة، وربطها بالمندوب.
            </div>

            <div className="mt-3 rounded-2xl p-3 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800">
              <div className="text-xs text-slate-700 dark:text-slate-200 mb-2">طريقة التسوية</div>
              <div className="flex items-center gap-3 mb-3">
                <label className="inline-flex items-center gap-2 text-xs">
                  <input type="radio" name="settle_dir" checked={settlementDirection==='collect'} onChange={()=>setSettlementDirection('collect')} />
                  <span className="text-slate-800 dark:text-slate-200">تحصيل من المندوب</span>
                </label>
                <label className="inline-flex items-center gap-2 text-xs">
                  <input type="radio" name="settle_dir" checked={settlementDirection==='pay'} onChange={()=>setSettlementDirection('pay')} />
                  <span className="text-slate-800 dark:text-slate-200">دفع إلى المندوب</span>
                </label>
              </div>
              <div className="text-xs text-slate-700 dark:text-slate-200 mb-2">المبلغ المدفوع للتقفيل</div>
              <input
                type="number"
                min={0}
                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl px-3 py-3 text-sm font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-200 dark:focus:ring-emerald-500/30"
                value={paidAmount}
                onChange={e => setPaidAmount(Math.max(0, toNum(e.target.value)))}
                disabled={loading || !selectedRepId}
              />
              <div className="mt-2 text-[11px] text-slate-700 dark:text-slate-200">ادخل مبلغ التقفيل داخل هذا الصندوق قبل الضغط على تأكيد.</div>
            </div>

            <div className="mt-4 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-200/80">المندوب</span>
                <span className="font-black">{selectedRep?.name || '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-200/80">الخزينة</span>
                <span className="font-black">{selectedTreasuryName || '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-200/80">الحساب القديم</span>
                <span className="font-black">{money(repBalance)} {currencySymbol} <span className="text-[11px] ml-2">({balanceLabel(repBalance)})</span></span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-200/80">المبلغ المدفوع</span>
                <span className="font-black text-slate-900 dark:text-white">{money(paidAmount)} {currencySymbol}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-200/80">المتبقي (تقديري)</span>
                {(() => {
                  const remaining = settlementDirection === 'collect' ? repBalance + paidAmount : repBalance - paidAmount;
                  return <span className={`font-black ${balanceClass(remaining)}`}>{money(remaining)} {currencySymbol}</span>;
                })()}
              </div>
            </div>

            <button
              onClick={handleSubmit}
              disabled={loading || !selectedRepId || (toNum(paidAmount) > 0 && !selectedTreasuryId)}
              className="mt-5 w-full bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed text-slate-900 font-black py-3 rounded-2xl transition-colors"
            >
              تأكيد التقفيل وإغلاق اليومية
            </button>
          </div>
        </div>

        <div className="lg:col-span-2 rounded-3xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4 text-slate-900 dark:text-white font-black">
            <div className="text-lg">قوائم الاوردرات</div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <div className="flex flex-col gap-2 mb-3">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-bold">الاوردرات الحالية مع المندوب ({repOrders.length})</div>
                  <div className="flex items-center bg-slate-100 dark:bg-slate-900 rounded-lg p-1">
                    <button
                      onClick={() => setRepOrdersSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                      className="p-1 rounded-md hover:bg-white dark:hover:bg-slate-800 text-slate-500 transition-colors"
                      title={repOrdersSortOrder === 'asc' ? "من الأقدم للأحدث" : "من الأحدث للأقدم"}
                    >
                      {repOrdersSortOrder === 'asc' ? <ArrowUp size={16} /> : <ArrowDown size={16} />}
                    </button>
                    <div className="w-px h-4 bg-slate-300 dark:bg-slate-700 mx-1"></div>
                    <button
                      onClick={() => setRepOrdersViewMode('list')}
                      className={`p-1 rounded-md transition-colors ${repOrdersViewMode === 'list' ? 'bg-white dark:bg-slate-800 text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                      title="عرض كقائمة"
                    >
                      <List size={16} />
                    </button>
                    <button
                      onClick={() => setRepOrdersViewMode('card')}
                      className={`p-1 rounded-md transition-colors ${repOrdersViewMode === 'card' ? 'bg-white dark:bg-slate-800 text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                      title="عرض كبطاقات"
                    >
                      <LayoutGrid size={16} />
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={toggleSelectAllLocal} className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-bold transition-colors">تحديد الكل</button>
                  <button onClick={markSelectedDelivered} className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold transition-colors">تم تسليم المحدد</button>
                  <button onClick={moveSelectedToDeferred} className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold transition-colors">نزول المحدد</button>
                </div>
              </div>

              {repOrdersViewMode === 'list' ? (
                <div className="divide-y max-h-96 overflow-y-auto pr-1">
                  {repOrders.length === 0 ? (
                    <div className="text-xs text-slate-400 p-3 text-center">لا توجد اوردرات.</div>
                  ) : (
                    repOrdersSorted.map((o: any) => {
                      const netPieces = computeDeliveredNetPieces(o);
                      const returnedPieces = computeReturnedPieces(o);
                      const originalPieces = computeOriginalPieces(o);
                      const netValue = computeDeliveredNetValue(o);
                      const originalValue = computeOriginalOrderValue(o);
                      const isPartial = isPartialReturn(o);

                      return (
                        <div key={o.id} className="flex items-center justify-between py-2 px-1 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                          <div className="flex items-center gap-3">
                            <input 
                              type="checkbox" 
                              checked={selectedOrderIdsLocal.includes(o.id)} 
                              onChange={() => toggleSelectOrderLocal(o.id)} 
                              className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer" 
                            />
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-bold text-slate-800 dark:text-slate-100">#{o.orderNumber || o.order_number} — {o.customerName || o.customer_name || o.name}</span>
                                {isPartial && (
                                  <span className="bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 px-2 py-0.5 rounded text-[10px] font-bold whitespace-nowrap">مرتجع جزئي</span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            {isPartial ? (
                              <div className="text-right">
                                <div className="text-xs font-black text-emerald-600 dark:text-emerald-400">
                                  {money(netValue)} {currencySymbol} <span className="text-slate-400 font-normal text-[10px] line-through mr-1">({money(originalValue)})</span>
                                </div>
                                <div className="text-[10px] text-amber-600 dark:text-amber-400">
                                  المتبقي: {netPieces} (من أصل {originalPieces})
                                </div>
                              </div>
                            ) : (
                              <div className="text-xs font-black text-emerald-600 dark:text-emerald-400 text-right">
                                {money(originalValue)} {currencySymbol}
                              </div>
                            )}
                            <button 
                              onClick={() => moveSingleToDeferred(o)} 
                              className="px-2.5 py-1 text-[11px] font-bold rounded bg-amber-100 hover:bg-amber-200 text-amber-700 dark:bg-amber-900/40 dark:hover:bg-amber-900/60 dark:text-amber-400 transition-colors"
                            >
                              نزول
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto pr-1 pb-1">
                  {repOrders.length === 0 ? (
                    <div className="text-xs text-slate-400 text-center p-3">لا توجد اوردرات.</div>
                  ) : (
                    repOrdersSorted.map((o: any) => {
                      const netPieces = computeDeliveredNetPieces(o);
                      const returnedPieces = computeReturnedPieces(o);
                      const originalPieces = computeOriginalPieces(o);
                      const netValue = computeDeliveredNetValue(o);
                      const originalValue = computeOriginalOrderValue(o);
                      const isPartial = isPartialReturn(o);

                      return (
                        <div key={o.id} className="flex flex-col border border-slate-200 dark:border-slate-700 rounded-xl p-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors bg-white dark:bg-slate-900 shadow-sm">
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex items-start gap-3">
                              <input 
                                type="checkbox" 
                                checked={selectedOrderIdsLocal.includes(o.id)} 
                                onChange={() => toggleSelectOrderLocal(o.id)} 
                                className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 mt-0.5 cursor-pointer" 
                              />
                              <div>
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-sm font-bold text-slate-800 dark:text-slate-100">#{o.orderNumber || o.order_number} — {o.customerName || o.customer_name || o.name}</span>
                                  {isPartial && (
                                    <span className="bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 px-2 py-0.5 rounded text-[10px] font-bold whitespace-nowrap">
                                      مرتجع جزئي
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <button 
                                onClick={() => moveSingleToDeferred(o)} 
                                className="px-3 py-1.5 text-xs font-bold rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-700 dark:bg-amber-900/40 dark:hover:bg-amber-900/60 dark:text-amber-400 transition-colors"
                              >
                                نزول
                              </button>
                            </div>
                          </div>

                          <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-2.5 mb-2 border border-slate-100 dark:border-slate-700/50 ml-7">
                            <p className="text-[10px] text-slate-500 font-bold mb-1.5">ملخص المنتجات:</p>
                            <div className="space-y-1">
                                {(Array.isArray(o.products) ? o.products : []).slice(0, 2).map((p:any, i:number) => (
                                    <div key={i} className="flex justify-between text-[11px]">
                                        <span className="text-slate-700 dark:text-slate-300 truncate max-w-[70%]">{p.name || p.product_name || p.product_id}</span>
                                        <span className="text-slate-500 font-mono font-bold">x{p.quantity || p.qty}</span>
                                    </div>
                                ))}
                                {(Array.isArray(o.products) ? o.products : []).length > 2 && (
                                    <p className="text-[10px] text-indigo-500 font-bold pt-1">+ {(Array.isArray(o.products) ? o.products : []).length - 2} منتجات أخرى</p>
                                )}
                            </div>
                          </div>

                          <div className="flex justify-between items-end ml-7">
                            {isPartial ? (
                              <div className="text-right w-full">
                                <div className="text-sm font-black text-emerald-600 dark:text-emerald-400">
                                  {money(netValue)} {currencySymbol} 
                                  <span className="text-slate-400 font-normal mr-1 text-[10px] line-through">(أصل المبلغ: {money(originalValue)})</span>
                                </div>
                                <div className="text-[10px] text-amber-600 dark:text-amber-400 font-medium mt-0.5">
                                  المتبقي للتسليم: {netPieces} قطعة (تم إرجاع {returnedPieces} من أصل {originalPieces})
                                </div>
                              </div>
                            ) : (
                              <div className="text-sm font-black text-emerald-600 dark:text-emerald-400 text-right w-full">
                                {money(originalValue)} {currencySymbol}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>

            <div>
              <div className="flex flex-col gap-2 mb-3">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-bold">الاوردرات المؤجّلة ({deferredOrders.length})</div>
                  <div className="flex items-center bg-slate-100 dark:bg-slate-900 rounded-lg p-1">
                    <button
                      onClick={() => setDeferredOrdersSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                      className="p-1 rounded-md hover:bg-white dark:hover:bg-slate-800 text-slate-500 transition-colors"
                      title={deferredOrdersSortOrder === 'asc' ? "من الأقدم للأحدث" : "من الأحدث للأقدم"}
                    >
                      {deferredOrdersSortOrder === 'asc' ? <ArrowUp size={16} /> : <ArrowDown size={16} />}
                    </button>
                    <div className="w-px h-4 bg-slate-300 dark:bg-slate-700 mx-1"></div>
                    <button
                      onClick={() => setDeferredOrdersViewMode('list')}
                      className={`p-1 rounded-md transition-colors ${deferredOrdersViewMode === 'list' ? 'bg-white dark:bg-slate-800 text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                      title="عرض كقائمة"
                    >
                      <List size={16} />
                    </button>
                    <button
                      onClick={() => setDeferredOrdersViewMode('card')}
                      className={`p-1 rounded-md transition-colors ${deferredOrdersViewMode === 'card' ? 'bg-white dark:bg-slate-800 text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                      title="عرض كبطاقات"
                    >
                      <LayoutGrid size={16} />
                    </button>
                  </div>
                </div>
              </div>
              
              {deferredOrdersViewMode === 'list' ? (
                <div className="divide-y max-h-96 overflow-y-auto pr-1">
                  {deferredOrders.length === 0 ? (
                    <div className="text-xs text-slate-400 text-center p-3">لا توجد اوردرات مؤجلة.</div>
                  ) : (
                    deferredOrdersSorted.map((o:any) => (
                      <div key={o.id} className="flex items-center justify-between py-2 px-1 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                        <div>
                          <div className="text-sm font-bold text-slate-800 dark:text-slate-100">#{o.orderNumber||o.order_number} — {o.customerName||o.customer_name||o.name}</div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-xs font-black text-emerald-600 dark:text-emerald-400">
                            {money(computeOrderValueWithoutShipping(o))} {currencySymbol}
                          </div>
                          <button 
                            onClick={() => moveDeferredBack(o)} 
                            className="px-2.5 py-1 text-[11px] font-bold rounded bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300 transition-colors"
                          >
                            ارجاع
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto pr-1 pb-1">
                  {deferredOrders.length === 0 ? <div className="text-xs text-slate-400 text-center p-3">لا توجد اوردرات مؤجلة.</div> : deferredOrdersSorted.map((o:any) => (
                    <div key={o.id} className="flex flex-col border border-slate-200 dark:border-slate-700 rounded-xl p-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors bg-white dark:bg-slate-900 shadow-sm">
                      <div className="flex items-start justify-between mb-2">
                        <div className="text-sm font-bold text-slate-800 dark:text-slate-100">#{o.orderNumber||o.order_number} — {o.customerName||o.customer_name||o.name}</div>
                        <button onClick={() => moveDeferredBack(o)} className="px-3 py-1.5 text-xs font-bold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300 transition-colors">ارجاع</button>
                      </div>

                      <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-2.5 mb-2 border border-slate-100 dark:border-slate-700/50">
                        <p className="text-[10px] text-slate-500 font-bold mb-1.5">ملخص المنتجات:</p>
                        <div className="space-y-1">
                            {(Array.isArray(o.products) ? o.products : []).slice(0, 2).map((p:any, i:number) => (
                                <div key={i} className="flex justify-between text-[11px]">
                                    <span className="text-slate-700 dark:text-slate-300 truncate max-w-[70%]">{p.name || p.product_name || p.product_id}</span>
                                    <span className="text-slate-500 font-mono font-bold">x{p.quantity || p.qty}</span>
                                </div>
                            ))}
                            {(Array.isArray(o.products) ? o.products : []).length > 2 && (
                                <p className="text-[10px] text-indigo-500 font-bold pt-1">+ {(Array.isArray(o.products) ? o.products : []).length - 2} منتجات أخرى</p>
                            )}
                        </div>
                      </div>

                      <div className="text-sm font-black text-emerald-600 dark:text-emerald-400 text-right">
                          {money(computeOrderValueWithoutShipping(o))} {currencySymbol}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {viewModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4" dir="rtl">
          <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-200">
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50">
              <h3 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                {viewModal === 'delivered' ? <PackageCheck className="text-emerald-500" /> : viewModal === 'returned' ? <PackageX className="text-rose-500" /> : <PackageCheck className="text-amber-500" />}
                {viewModal === 'delivered' ? 'الاوردرات المسلمة' : viewModal === 'returned' ? 'الاوردرات المرتجعة' : 'الاوردرات المؤجلة'}
              </h3>
              <button 
                onClick={() => setViewModal(null)} 
                className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors"
              >
                ✕
              </button>
            </div>
            
            <div className="p-5 overflow-y-auto flex-1 custom-scrollbar">
              {(() => {
                const list = viewModal === 'delivered' ? deliveredOrdersList : viewModal === 'returned' ? returnedOrdersList : deferredOrders;
                
                if (list.length === 0) return (
                  <div className="text-center text-slate-500 dark:text-slate-400 py-12 flex flex-col items-center gap-3">
                    <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-2xl">📭</div>
                    <div>لا توجد اوردرات في هذه القائمة خلال الفترة المحددة</div>
                  </div>
                );

                return (
                  <table className="w-full text-sm text-right">
                    <thead className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                      <tr>
                        <th className="p-3 font-bold rounded-r-xl">رقم الاوردر</th>
                        <th className="p-3 font-bold">العميل</th>
                        <th className="p-3 font-bold text-center">{viewModal === 'returned' ? 'القطع المرتجعة' : viewModal === 'delivered' ? 'القطع المسلمة' : 'القطع'}</th>
                        <th className="p-3 font-bold rounded-l-xl">{viewModal === 'returned' ? 'قيمة القطع المرتجعة' : viewModal === 'delivered' ? 'قيمة القطع المسلمة' : 'القيمة'}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {list.map((o: any) => {
                        const delPieces = computeDeliveredNetPieces(o);
                        const retPieces = computeReturnedPieces(o);
                        const origPieces = computeOriginalPieces(o);
                        
                        const delValue = computeDeliveredNetValue(o);
                        const retValue = computeReturnedOrderValue(o);
                        const origValue = computeOriginalOrderValue(o);

                        const isFullRet = isFullReturnOrder(o);
                        const isPart = isPartialReturn(o);

                        return (
                        <tr key={o.id} className="border-b border-slate-50 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                          <td className="p-3 font-black text-slate-900 dark:text-white">
                            <div className="flex items-center gap-2">
                              <span>#{o.orderNumber || o.order_number || o.id}</span>
                              {viewModal === 'returned' && isFullRet && (
                                <span className="bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400 px-2 py-0.5 rounded text-[10px] font-bold whitespace-nowrap">
                                  مرتجع كامل
                                </span>
                              )}
                              {viewModal === 'returned' && isPart && (
                                <span className="bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400 px-2 py-0.5 rounded text-[10px] font-bold whitespace-nowrap">
                                  مرتجع جزئي
                                </span>
                              )}
                              {viewModal === 'delivered' && isPart && (
                                <span className="bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 px-2 py-0.5 rounded text-[10px] font-bold whitespace-nowrap">
                                  تسليم جزئي
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="p-3 text-slate-700 dark:text-slate-300">{o.customerName || o.customer_name || o.name || '—'}</td>
                          <td className="p-3 text-center text-slate-600 dark:text-slate-400">
                            {viewModal === 'returned' ? retPieces : viewModal === 'delivered' ? delPieces : computePieces(o)}
                            {viewModal === 'returned' && isFullRet && (
                              <div className="text-[10px] text-rose-600 dark:text-rose-400 mt-1">
                                (إجمالي {origPieces} قطعة)
                              </div>
                            )}
                            {viewModal === 'returned' && isPart && (
                              <div className="text-[10px] text-rose-600 dark:text-rose-400 mt-1">
                                (من أصل {origPieces} قطعة)
                              </div>
                            )}
                            {viewModal === 'delivered' && isPart && (
                              <div className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-1">
                                (من أصل {origPieces} قطعة)
                              </div>
                            )}
                          </td>
                          <td className="p-3 font-bold text-emerald-600 dark:text-emerald-400">
                            {money(viewModal === 'returned' ? retValue : viewModal === 'delivered' ? delValue : computeOrderValueWithoutShipping(o))} {currencySymbol}
                            {viewModal === 'returned' && isPart && (
                              <div className="text-[10px] text-rose-600 dark:text-rose-400 mt-1">
                                (من أصل {money(origValue)} {currencySymbol})
                              </div>
                            )}
                            {viewModal === 'delivered' && isPart && (
                              <div className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-1">
                                (من أصل {money(origValue)} {currencySymbol})
                              </div>
                            )}
                          </td>
                        </tr>
                      )})}
                    </tbody>
                  </table>
                );
              })()}
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default SalesDailyClose;