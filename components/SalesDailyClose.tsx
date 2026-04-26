import React, { useEffect, useMemo, useState } from 'react';
import Swal from 'sweetalert2';
import { API_BASE_PATH } from '../services/apiConfig';
import { User, Wallet, PackageCheck, PackageX, CheckCircle2, RefreshCw, Eye, LayoutGrid, List, ArrowUp, ArrowDown } from 'lucide-react';
import CustomSelect from './CustomSelect';

// --- Helpers ---
const toNum = (v: any) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const parseNumeric = (v: any) => {
  if (v === null || typeof v === 'undefined') return 0;
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  let s = String(v || '').trim();
  if (s === '') return 0;
  const map: Record<string, string> = {
    '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4', '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9',
    '۰': '0', '۱': '1', '۲': '2', '۳': '3', '۴': '4', '۵': '5', '۶': '6', '۷': '7', '۸': '8', '۹': '9'
  };
  s = s.split('').map(ch => map[ch] || ch).join('').replace(/[\s,]+/g, '').replace(/[^0-9.\-]+/g, '');
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
};

const money = (n: number) => toNum(n).toLocaleString();
const normalizeText = (text: string) => (text || "").trim().replace(/[أإآ]/g, "ا").replace(/ة/g, "ه").replace(/\s+/g, " ");
const balanceLabel = (bal: number) => (bal > 0 ? 'له' : bal < 0 ? 'عليه' : '');
const balanceClass = (bal: number) => (bal > 0 ? 'text-emerald-600' : bal < 0 ? 'text-rose-600' : 'text-slate-600');

// --- Order Computation Helpers ---
const getRealOrderId = (o: any) => String(o?.order_id ?? o?.id ?? '');

const computePieces = (order: any) => {
  const status = String(order?.status || order?.order_status || '').toLowerCase();
  if (status === 'returned' || status === 'full_return') return 0;
  const items = order.products || order.order_items || order.items || [];
  if (Array.isArray(items) && items.length > 0) return items.reduce((s: number, p: any) => s + toNum(p.quantity ?? p.qty ?? 0), 0);
  return toNum(order.pieces_count) || toNum(order.total_pieces) || 0;
};

const computeOrderValueWithoutShipping = (order: any) => {
  const items = order?.products || order?.items || order?.order_items || [];
  if (items && Array.isArray(items) && items.length > 0) {
    let sum = 0;
    items.forEach((item: any) => {
      const p = parseFloat(item.price_per_unit || item.price) || 0;
      const q = Number(item.quantity || item.qty) || 0;
      sum += p * q;
    });
    return sum;
  }
  return (parseFloat(order?.total_amount) || 0) - (parseFloat(order?.shipping_fees) || 0);
};


const computeReturnedPieces = (order: any) => {
  const directVal = toNum(order?.returned_pieces) || toNum(order?.returned_pieces_fallback);
  if (directVal > 0) return directVal;
  const status = String(order?.status || order?.order_status || '').toLowerCase();
  if (status === 'returned' || status === 'full_return') {
    const items = order.products || order.order_items || order.items || [];
    if (Array.isArray(items) && items.length > 0) {
      const fromItems = items.reduce((s: number, p: any) => s + toNum(p.quantity ?? p.qty ?? 0), 0);
      if (fromItems > 0) return fromItems;
    }
    return toNum(order?.pieces_count) || toNum(order?.total_pieces) || 0;
  }
  const items = order.products || order.order_items || order.items || [];
  if (Array.isArray(items) && items.length > 0) {
    return items.reduce((s: number, p: any) => s + toNum(p.returned_quantity ?? p.returnedPieces ?? 0), 0);
  }
  return 0;
};

const computeReturnedOrderValue = (order: any) => {
  const status = String(order?.status || order?.order_status || '').toLowerCase();
  
  // If explicitly a partial return status, try to sum returned items first
  const isPartialStatus = (status === 'partial' || status === 'partial_return');
  
  const items = order.products || order.order_items || order.items || [];
  if (Array.isArray(items) && items.length > 0) {
    let returnedVal = 0;
    let foundAnyRq = false;
    items.forEach((item: any) => {
      const rq = toNum(item.returned_quantity ?? item.returnedPieces ?? 0);
      if (rq > 0) foundAnyRq = true;
      const p = parseNumeric(item.price_per_unit ?? item.price ?? 0);
      returnedVal += rq * p;
    });
    // If we have specific item-level return data, use it
    if (foundAnyRq && returnedVal > 0) return returnedVal;
  }
  
  // If it's a full return, it should be the total value of items still in the list 
  // (In full returns, we keep the original quantities in the DB)
  if (status === 'returned' || status === 'full_return') {
    return computeOrderValueWithoutShipping(order);
  }
  
  // Fallback to the dedicated returned_value field passed by the API (which is correct for partials)
  return Math.max(toNum(order?.returned_value), toNum(order?.returned_value_fallback), 0);
};

const computeDeliveredNetPieces = (order: any) => computePieces(order);
const computeDeliveredNetValue = (order: any) => computeOrderValueWithoutShipping(order);

const computeOriginalPieces = (order: any) => {
  return computeDeliveredNetPieces(order) + computeReturnedPieces(order);
};

const computeOriginalOrderValue = (order: any) => {
  return computeDeliveredNetValue(order) + computeReturnedOrderValue(order);
};



const isPartialReturn = (order: any) => {
  const status = String(order?.status || order?.order_status || '').toLowerCase();
  return (status === 'partial' || status === 'partial_return') || (computeDeliveredNetPieces(order) > 0 && computeReturnedPieces(order) > 0);
};

const isFullReturnOrder = (order: any) => {
  const status = String(order?.status || order?.order_status || '').toLowerCase();
  return (status === 'returned' || status === 'full_return') || (computeReturnedPieces(order) > 0 && computeDeliveredNetPieces(order) === 0);
};

const isFullDeliveryOrder = (order: any) => computeDeliveredNetPieces(order) > 0 && computeReturnedPieces(order) === 0;

const uniqOrdersById = (arr: any[]) => {
  const seen = new Set<string>();
  const out: any[] = [];
  for (const it of (arr || [])) {
    const id = String(it?.order_id ?? it?.id ?? '');
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(it);
  }
  return out;
};

// --- Component ---
const SalesDailyClose: React.FC = () => {
  const currencySymbol = 'ج.م';

  const [loading, setLoading] = useState(false);
  const [statsLoading, setStatsLoading] = useState(false);

  // Core Data
  const [reps, setReps] = useState<any[]>([]);
  const [treasuries, setTreasuries] = useState<any[]>([]);
  const [userDefaults, setUserDefaults] = useState<any>(null);

  // Selections
  const [selectedRepId, setSelectedRepId] = useState<string>('');
  const [selectedTreasuryId, setSelectedTreasuryId] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'electronic'>('cash');

  // Rep State
  const [repBalance, setRepBalance] = useState<number>(0);
  const [paidAmount, setPaidAmount] = useState<number>(0);
  const [settlementDirection, setSettlementDirection] = useState<'collect' | 'pay'>('collect');
  const [openDailyInfo, setOpenDailyInfo] = useState<{ daily_code: string; id: number } | null>(null);

  // Transaction state
  const [repTxType, setRepTxType] = useState<'none' | 'bonus' | 'penalty'>('none');
  const [repTxAmount, setRepTxAmount] = useState<number>(0);
  const [repTxReason, setRepTxReason] = useState<string>('');
  const [repTxLoading, setRepTxLoading] = useState<boolean>(false);

  // Orders State
  const [activeOrders, setActiveOrders] = useState<any[]>([]);
  const [deferredOrders, setDeferredOrders] = useState<any[]>([]);
  const [deliveredOrders, setDeliveredOrders] = useState<any[]>([]);
  const [returnedOrders, setReturnedOrders] = useState<any[]>([]);
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);

  // UI State
  const [viewModal, setViewModal] = useState<'delivered' | 'returned' | 'deferred' | null>(null);
  const [activeOrdersViewMode, setActiveOrdersViewMode] = useState<'list' | 'card'>('card');
  const [activeOrdersSortOrder, setActiveOrdersSortOrder] = useState<'asc' | 'desc'>('desc');
  const [deferredOrdersViewMode, setDeferredOrdersViewMode] = useState<'list' | 'card'>('card');
  const [deferredOrdersSortOrder, setDeferredOrdersSortOrder] = useState<'asc' | 'desc'>('desc');

  // Sorted Lists
  const activeOrdersSorted = useMemo(() => {
    return [...activeOrders].sort((a, b) => {
      const idA = Number(a.id);
      const idB = Number(b.id);
      return activeOrdersSortOrder === 'asc' ? idA - idB : idB - idA;
    });
  }, [activeOrders, activeOrdersSortOrder]);

  const deferredOrdersSorted = useMemo(() => {
    return [...deferredOrders].sort((a, b) => {
      const idA = Number(a.id);
      const idB = Number(b.id);
      return deferredOrdersSortOrder === 'asc' ? idA - idB : idB - idA;
    });
  }, [deferredOrders, deferredOrdersSortOrder]);

  // Derived Unified Lists (To solve partial return overlap where an order is both delivered and returned)
  const finalDeliveredList = useMemo(() => {
    const activeIds = new Set(activeOrders.map(getRealOrderId));
    const fromRet = returnedOrders.filter(o => computeDeliveredNetPieces(o) > 0);
    return uniqOrdersById([...deliveredOrders, ...fromRet]).filter(o => !activeIds.has(getRealOrderId(o)));
  }, [deliveredOrders, returnedOrders, activeOrders]);

  const finalReturnedList = useMemo(() => {
    const fromDeliv = deliveredOrders.filter(o => computeReturnedPieces(o) > 0);
    const fromActive = activeOrders.filter(o => computeReturnedPieces(o) > 0);
    return uniqOrdersById([...returnedOrders, ...fromDeliv, ...fromActive]);
  }, [deliveredOrders, returnedOrders, activeOrders]);

  // Derived Stats
  const deliveredPieces = useMemo(() => finalDeliveredList.reduce((sum, o) => sum + computeDeliveredNetPieces(o), 0), [finalDeliveredList]);
  const deliveredValue = useMemo(() => finalDeliveredList.reduce((sum, o) => sum + computeDeliveredNetValue(o), 0), [finalDeliveredList]);
  const returnedPieces = useMemo(() => finalReturnedList.reduce((sum, o) => sum + computeReturnedPieces(o), 0), [finalReturnedList]);
  const returnedValue = useMemo(() => finalReturnedList.reduce((sum, o) => sum + computeReturnedOrderValue(o), 0), [finalReturnedList]);
  const deferredPieces = useMemo(() => deferredOrders.reduce((sum, o) => sum + computePieces(o), 0), [deferredOrders]);
  const deferredValue = useMemo(() => deferredOrders.reduce((sum, o) => sum + computeOrderValueWithoutShipping(o), 0), [deferredOrders]);

  const selectedRep = useMemo(() => reps.find(r => String(r.id) === String(selectedRepId)) || null, [reps, selectedRepId]);
  const selectedTreasuryName = useMemo(() => treasuries.find(t => String(t.id) === String(selectedTreasuryId))?.name || '', [treasuries, selectedTreasuryId]);
  const canChangeTreasury = useMemo(() => !userDefaults?.default_treasury_id || userDefaults.can_change_treasury !== false, [userDefaults]);

  // --- Initial Load ---
  const loadInitialData = async () => {
    try {
      const [rRes, tRes, pRes] = await Promise.all([
        fetch(`${API_BASE_PATH}/api.php?module=users&action=getAllWithBalance&related_to_type=rep`).then(r => r.json()),
        fetch(`${API_BASE_PATH}/api.php?module=treasuries&action=getAll`).then(r => r.json()),
        fetch(`${API_BASE_PATH}/api.php?module=permissions&action=getUserDefaults`).then(r => r.json()).catch(() => null)
      ]);

      const repsList = rRes?.success ? (rRes.data || []).filter((u: any) => u.role === 'representative') : [];
      setReps(repsList);

      const tList = tRes?.success ? (tRes.data || []) : [];
      const defaults = pRes?.success ? (pRes.data || null) : null;
      setUserDefaults(defaults);

      if (defaults?.default_treasury_id && defaults.can_change_treasury === false) {
        const filtered = tList.filter((t: any) => Number(t.id) === Number(defaults.default_treasury_id));
        setTreasuries(filtered);
        if (filtered.length > 0) setSelectedTreasuryId(String(filtered[0].id));
      } else {
        setTreasuries(tList);
        if (tList.length > 0) setSelectedTreasuryId(String(tList[0].id));
      }
    } catch (e) {
      console.error('Initial load failed', e);
    }
  };

  useEffect(() => {
    loadInitialData();
  }, []);

  // --- Load Rep Data ---
  const loadRepData = async (repId: string) => {
    if (!repId) {
      setActiveOrders([]); setDeferredOrders([]); setDeliveredOrders([]); setReturnedOrders([]);
      setOpenDailyInfo(null); setSelectedOrderIds([]); setRepBalance(0); setPaidAmount(0);
      return;
    }

    setStatsLoading(true);
    try {
      // 1. Refresh Rep Balance
      const rRes = await fetch(`${API_BASE_PATH}/api.php?module=users&action=getAllWithBalance&related_to_type=rep`).then(r => r.json());
      if (rRes?.success) {
        const repsList = (rRes.data || []).filter((u: any) => u.role === 'representative');
        setReps(repsList);
        const rep = repsList.find((u: any) => String(u.id) === String(repId));
        const bal = toNum(rep?.balance ?? 0);
        setRepBalance(bal);
        setPaidAmount(Math.max(0, -bal));
      }

      // 2. Get Open Daily
      let openJournalId = 'none';
      const odResp = await fetch(`${API_BASE_PATH}/api.php?module=sales&action=getRepOpenDaily&rep_id=${repId}`).then(r => r.json()).catch(() => null);
      if (odResp?.success && odResp.data) {
        setOpenDailyInfo({ daily_code: odResp.data.daily_code || '', id: Number(odResp.data.id) });
        openJournalId = String(odResp.data.id);
      } else {
        setOpenDailyInfo(null);
      }

      // 3. Get Active Custody (Orders currently with rep)
      const custodyRes = await fetch(`${API_BASE_PATH}/api.php?module=sales&action=getSalesActiveWithRep&rep_id=${encodeURIComponent(repId)}`).then(r => r.json()).catch(() => null);
      const custodyOrders = custodyRes?.success && Array.isArray(custodyRes.data) ? custodyRes.data : [];

      // 4. Get Journal Orders if Open Daily Exists
      let jDelivered: any[] = [];
      let jReturned: any[] = [];
      let jDeferred: any[] = [];

      if (openJournalId !== 'none') {
        const ordersRes = await fetch(`${API_BASE_PATH}/api.php?module=sales&action=getJournalOrders&rep_id=${encodeURIComponent(repId)}&journal_ids=${openJournalId}`).then(r => r.json()).catch(() => null);
        if (ordersRes && ordersRes.success) {
          jDelivered = uniqOrdersById(ordersRes.delivered || []);
          jReturned = uniqOrdersById(ordersRes.returned || []);
          
          // Filter Deferred to only include those assigned to this specific journal
          const rawDeferred = ordersRes.deferred || [];
          jDeferred = uniqOrdersById(rawDeferred.filter((o: any) => String(o.journal_id || o.journalId) === openJournalId));
        }
      }

      setDeliveredOrders(jDelivered);
      setReturnedOrders(jReturned);
      setDeferredOrders(jDeferred);

      // 5. Filter Active Orders (exclude those that are already deferred in the current journal)
      const deferredIds = new Set(jDeferred.map(getRealOrderId));
      const filteredActive = uniqOrdersById(custodyOrders).filter(o => {
        const id = getRealOrderId(o);
        const status = String(o.status || '').toLowerCase();
        const orderStatus = String(o.order_status || '').toLowerCase();
        if (status === 'delivered' || orderStatus === 'delivered') return false;
        if (status === 'returned' || orderStatus === 'returned' || status === 'full_return' || orderStatus === 'full_return') return false;
        if (deferredIds.has(id)) return false;
        return true;
      });

      setActiveOrders(filteredActive);
      setSelectedOrderIds(filteredActive.map(o => getRealOrderId(o)));

    } catch (e) {
      console.error('Failed to load rep data', e);
    } finally {
      setStatsLoading(false);
    }
  };

  useEffect(() => {
    loadRepData(selectedRepId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRepId]);

  // --- Actions ---
  const toggleSelectAll = () => {
    if (selectedOrderIds.length === activeOrders.length) setSelectedOrderIds([]);
    else setSelectedOrderIds(activeOrders.map(o => getRealOrderId(o)));
  };

  const toggleSelectOrder = (id: string) => {
    setSelectedOrderIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const markSelectedDelivered = async () => {
    if (selectedOrderIds.length === 0) { Swal.fire('تحذير', 'اختر الاوردرات أولاً', 'warning'); return; }
    try {
      setLoading(true);
      const moved = activeOrders.filter(o => selectedOrderIds.includes(getRealOrderId(o)));
      const partialIds: string[] = [];
      const fullIds: string[] = [];
      moved.forEach(o => {
        if (computeReturnedPieces(o) > 0) partialIds.push(getRealOrderId(o)); else fullIds.push(getRealOrderId(o));
      });

      // Update full deliveries in orders table
      if (fullIds.length > 0) {
        await Promise.all(fullIds.map(id => fetch(`${API_BASE_PATH}/api.php?module=orders&action=update`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: Number(id), status: 'delivered', repId: Number(selectedRepId) })
        }).catch(() => null)));
      }

      // Update journal status
      if (fullIds.length > 0) {
        await fetch(`${API_BASE_PATH}/api.php?module=sales&action=updateJournalOrderStatus`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rep_id: Number(selectedRepId), order_ids: fullIds.map(Number), status: 'delivered' })
        }).catch(() => null);
      }
      if (partialIds.length > 0) {
        await fetch(`${API_BASE_PATH}/api.php?module=sales&action=updateJournalOrderStatus`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rep_id: Number(selectedRepId), order_ids: partialIds.map(Number), status: 'partial_return' })
        }).catch(() => null);

        // Also mark remaining portion as delivered in orders table
        await Promise.all(partialIds.map(id => fetch(`${API_BASE_PATH}/api.php?module=orders&action=update`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: Number(id), status: 'delivered', repId: Number(selectedRepId) })
        }).catch(() => null)));
      }

      await loadRepData(selectedRepId);
      Swal.fire('تم', `تم تحديث حالة الاوردرات بنجاح.`, 'success');
    } catch (e) {
      console.error(e);
      Swal.fire('خطأ', 'فشل تحديث حالة الاوردرات.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleUndoOrder = async (orderId: string | number) => {
    const res = await Swal.fire({
      title: 'إرجاع للعهدة؟',
      text: 'سيتم استرجاع هذا الأوردر إلى عهدة المندوب وإلغاء تسجيله כمسلم/مرتجع. إذا كان به تسليم جزئي سيتم عكسه واسترجاع القطع من وإلى المخزن. هل أنت متأكد؟',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'نعم، إرجاع',
      cancelButtonText: 'إلغاء'
    });
    if (!res.isConfirmed) return;

    try {
      setLoading(true);
      const req = await fetch(`${API_BASE_PATH}/api.php?module=sales&action=undoDailyCloseOrder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rep_id: selectedRepId, order_id: orderId })
      });
      const data = await req.json();
      if (!data.success) throw new Error(data.message || 'خطأ في الاسترجاع');
      
      Swal.fire('نجاح', 'تم استرجاع الأوردر لعهدة المندوب بنجاح.', 'success');
      
      if (selectedRepId) {
        await loadRepData(selectedRepId);
      }
      setViewModal(null);
    } catch (e: any) {
      Swal.fire('خطأ', e.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const moveSelectedToDeferred = async () => {
    if (selectedOrderIds.length === 0) { Swal.fire('تحذير', 'اختر الاوردرات أولاً', 'warning'); return; }
    try {
      setLoading(true);
      await fetch(`${API_BASE_PATH}/api.php?module=sales&action=updateJournalOrderStatus`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rep_id: Number(selectedRepId), order_ids: selectedOrderIds.map(Number), status: 'deferred' })
      });
      await loadRepData(selectedRepId);
      Swal.fire('تم', 'تم نقل الاوردرات المحددة إلى المؤجلة (النزول).', 'success');
    } catch (e) {
      console.error(e);
      Swal.fire('خطأ', 'فشل نقل الاوردرات.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const moveSingleToDeferred = async (order: any) => {
    try {
      setLoading(true);
      await fetch(`${API_BASE_PATH}/api.php?module=sales&action=updateJournalOrderStatus`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rep_id: Number(selectedRepId), order_ids: [Number(getRealOrderId(order))], status: 'deferred' })
      });
      await loadRepData(selectedRepId);
    } catch (e) {
      console.error(e);
      Swal.fire('خطأ', 'فشل نقل الاوردر.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const moveDeferredBack = async (order: any) => {
    try {
      setLoading(true);
      const oid = Number(getRealOrderId(order));
      await fetch(`${API_BASE_PATH}/api.php?module=sales&action=updateJournalOrderStatus`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rep_id: Number(selectedRepId), order_ids: [oid], status: 'with_rep' })
      });
      await fetch(`${API_BASE_PATH}/api.php?module=orders&action=update`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: oid, status: 'with_rep', repId: Number(selectedRepId) })
      });
      await loadRepData(selectedRepId);
    } catch (e) {
      console.error(e);
      Swal.fire('خطأ', 'فشل استرجاع الاوردر.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleFinancialTx = async () => {
    if (!selectedRepId || repTxType === 'none') return;
    const amt = Math.max(0, toNum(repTxAmount));
    if (amt <= 0) { Swal.fire('مبلغ غير صالح', 'ادخل مبلغًا أكبر من صفر', 'warning'); return; }
    try {
      setRepTxLoading(true);
      const payload: any = {
        related_to_type: 'rep', related_to_id: Number(selectedRepId), amount: amt, details: { reason: repTxReason }
      };
      if (repTxType === 'bonus') {
        payload.type = 'rep_bonus_in'; payload.direction = 'in'; payload.title = `حافز للمندوب`; payload.memo = repTxReason || 'حافز';
      } else {
        payload.type = 'rep_penalty'; payload.direction = 'out'; payload.title = `غرامة للمندوب`; payload.memo = repTxReason || 'غرامة';
      }
      if (selectedTreasuryId) payload.treasuryId = Number(selectedTreasuryId);

      const r = await fetch(`${API_BASE_PATH}/api.php?module=transactions&action=create`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
      });
      const j = await r.json();
      if (j?.success) {
        Swal.fire('تم', repTxType === 'bonus' ? 'تم إضافة الحافز وتحديث حساب المندوب.' : 'تم تطبيق الغرامة.', 'success');
        setRepTxAmount(0); setRepTxReason(''); setRepTxType('none');
        await loadRepData(selectedRepId);
      } else {
        Swal.fire('فشل العملية', j?.message || 'تعذر تسجيل المعاملة.', 'error');
      }
    } catch (e) {
      console.error('tx failed', e);
      Swal.fire('خطأ', 'فشل الاتصال أثناء تسجيل المعاملة.', 'error');
    } finally {
      setRepTxLoading(false);
    }
  };

  const handleCloseDaily = async () => {
    if (!selectedRepId) { Swal.fire('اختر المندوب', 'يرجى اختيار المندوب أولاً.', 'warning'); return; }
    if (!openDailyInfo) { Swal.fire('تنبيه', 'المندوب ليس له يومية مفتوحة حالياً.', 'warning'); return; }
    const amount = Math.max(0, toNum(paidAmount));
    if (amount > 0 && !selectedTreasuryId) { Swal.fire('اختر الخزينة', 'يرجى اختيار الخزينة لإتمام التقفيل.', 'warning'); return; }

    const repName = selectedRep?.name || '';
    const res = await Swal.fire({
      title: 'تأكيد التقفيل', icon: 'question', showCancelButton: true, confirmButtonText: 'تأكيد', cancelButtonText: 'إلغاء',
      html: `
        <div style="text-align:right; line-height:1.9">
          <div><b>المندوب:</b> ${repName}</div>
          <div><b>الخزينة:</b> ${selectedTreasuryName || selectedTreasuryId || '—'}</div>
          <div><b>طريقة التسوية:</b> ${settlementDirection === 'collect' ? 'تحصيل من المندوب' : 'دفع إلى المندوب'}</div>
          <hr/>
          <div><b>الحساب الحالى:</b> ${money(repBalance)} ${currencySymbol} <span>(${balanceLabel(repBalance)})</span></div>
          <div><b>مبلغ التقفيل المدفوع:</b> ${money(amount)} ${currencySymbol}</div>
          <div style="margin-top:6px;"><b>المتبقي التقديري:</b> ${money(settlementDirection === 'collect' ? (repBalance + amount) : (repBalance - amount))} ${currencySymbol}</div>
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
        const r = await fetch(`${API_BASE_PATH}/api.php?module=sales&action=settleDaily`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        const j = await r.json();
        settleSuccess = j?.success;
        if (!settleSuccess) Swal.fire('فشل العملية', j?.message || 'تعذر التقفيل المالي.', 'error');
      } else {
        const txPayload = {
          type: 'rep_payment_out', related_to_type: 'rep', related_to_id: Number(selectedRepId), amount: amount, treasuryId: Number(selectedTreasuryId), direction: 'out',
          details: { context: 'close_daily', action: 'settleDaily', reason: 'اغلاق اليوميه تلقائيا' }, notes: 'اغلاق اليوميه تلقائيا', title: `دفع إلى المندوب - تسوية يومية`
        };
        const r2 = await fetch(`${API_BASE_PATH}/api.php?module=transactions&action=create`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(txPayload) });
        const j2 = await r2.json();
        settleSuccess = j2?.success;
        if (!settleSuccess) Swal.fire('فشل العملية', j2?.message || 'تعذر تسجيل عملية الدفع.', 'error');
      }

      if (settleSuccess) {
        await fetch(`${API_BASE_PATH}/api.php?module=sales&action=logCloseDaily`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rep_id: Number(selectedRepId), treasury_id: selectedTreasuryId ? Number(selectedTreasuryId) : null, paid_amount: amount, direction: settlementDirection, event_date: new Date().toISOString().slice(0, 10), notes: 'اغلاق اليوميه تلقائيا' })
        }).catch(() => null);

        const closeResp = await fetch(`${API_BASE_PATH}/api.php?module=sales&action=closeRepDaily`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rep_id: Number(selectedRepId), journal_id: openDailyInfo.id })
        });
        const closeJson = await closeResp.json().catch(() => null);
        if (!closeJson?.success) {
          Swal.fire('تنبيه', closeJson?.message || 'تعذر إغلاق اليومية.', 'warning');
        } else {
          // Trigger Print automatically
          handlePrintDailyClose();

          Swal.fire('تم', amount > 0 ? 'تم التقفيل وإغلاق اليومية بنجاح.' : 'تم إغلاق اليومية بنجاح بدون حركة مالية.', 'success').then(() => {
            // Reset Page Completely
            setSelectedRepId('');
          });
        }
      } else {
        await loadRepData(selectedRepId);
      }
    } catch (e) {
      console.error('Close daily failed', e);
      Swal.fire('خطأ', 'فشل الاتصال بالخادم أثناء التقفيل.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleElectronicTreasury = async () => {
    setPaymentMethod('electronic');
    const eName = 'مدفوعات إليكترونية';
    setLoading(true);
    try {
      const trResp = await fetch(`${API_BASE_PATH}/api.php?module=treasuries&action=getAll`).then(r => r.json());
      let list = trResp?.success ? trResp.data || [] : treasuries;
      let found = list.find((t: any) => normalizeText(t.name) === normalizeText(eName));
      if (!found) {
        const createRes = await fetch(`${API_BASE_PATH}/api.php?module=treasuries&action=create`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: eName, balance: 0 })
        });
        const createJson = await createRes.json();
        const trResp2 = await fetch(`${API_BASE_PATH}/api.php?module=treasuries&action=getAll`).then(r => r.json());
        list = trResp2?.success ? trResp2.data || [] : list;
        setTreasuries(list);
        found = list.find((t: any) => normalizeText(t.name) === normalizeText(eName));
        if (!found && createJson?.success && createJson.data?.id) found = createJson.data;
      }
      if (found) setSelectedTreasuryId(String(found.id));
    } catch (e) {
      console.error('Electronic setup failed', e);
    } finally {
      setLoading(false);
    }
  };

  const handlePrintDailyClose = () => {
    if (!selectedRepId) { Swal.fire('تنبيه', 'يجب اختيار المندوب أولاً لطباعة يوميته.', 'warning'); return; }
    const pDate = new Date().toISOString().slice(0, 10);
    const pRepName = selectedRep?.name || '';
    const pTotal = repBalance;
    const pTreasury = selectedTreasuryName || 'مدفوعات إليكترونية';
    const pAmount = paidAmount;
    
    // Generate Rows for Delivered
    const delivHTML = finalDeliveredList.map(o => {
      const isPartial = computeReturnedPieces(o) > 0 && computeDeliveredNetPieces(o) > 0;
      return `<tr>
        <td style="padding:4px;border:1px solid #ccc;text-align:right;">#${o.orderNumber || o.order_number} ${isPartial ? '<span style="font-size:10px;color:#d97706;">(جزئي)</span>' : ''}</td>
        <td style="padding:4px;border:1px solid #ccc;text-align:right;">${o.customerName || o.customer_name || o.name || ''}</td>
        <td style="padding:4px;border:1px solid #ccc;text-align:center;">${computeDeliveredNetPieces(o)}</td>
        <td style="padding:4px;border:1px solid #ccc;text-align:center;">${money(computeDeliveredNetValue(o))}</td>
      </tr>`;
    }).join('');

    const retHTML = finalReturnedList.map(o => {
      const isPartial = computeReturnedPieces(o) > 0 && computeDeliveredNetPieces(o) > 0;
      return `<tr>
        <td style="padding:4px;border:1px solid #ccc;text-align:right;">#${o.orderNumber || o.order_number} ${isPartial ? '<span style="font-size:10px;color:#d97706;">(جزئي)</span>' : ''}</td>
        <td style="padding:4px;border:1px solid #ccc;text-align:right;">${o.customerName || o.customer_name || o.name || ''}</td>
        <td style="padding:4px;border:1px solid #ccc;text-align:center;">${computeReturnedPieces(o)}</td>
        <td style="padding:4px;border:1px solid #ccc;text-align:center;">${money(computeReturnedOrderValue(o))}</td>
      </tr>`;
    }).join('');

    const defHTML = deferredOrders.map(o => {
      return `<tr>
        <td style="padding:4px;border:1px solid #ccc;text-align:right;">#${o.orderNumber || o.order_number}</td>
        <td style="padding:4px;border:1px solid #ccc;text-align:right;">${o.customerName || o.customer_name || o.name || ''}</td>
        <td style="padding:4px;border:1px solid #ccc;text-align:center;">${computePieces(o)}</td>
        <td style="padding:4px;border:1px solid #ccc;text-align:center;">${money(computeOrderValueWithoutShipping(o))}</td>
      </tr>`;
    }).join('');

    const html = `
      <html dir="rtl" lang="ar">
      <head>
        <title>يومية مندوب - ${pRepName}</title>
        <style>
          body { font-family: Tahoma, Arial, sans-serif; font-size: 13px; margin: 20px; line-height: 1.5; }
          .header { text-align: center; margin-bottom: 20px; border-bottom: 2px solid #000; padding-bottom: 10px; }
          .flex { display: flex; justify-content: space-between; margin-bottom: 15px; }
          .box { border: 1px solid #000; padding: 10px; border-radius: 5px; flex: 1; margin: 0 5px; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 15px; font-size: 12px; }
          th { background: #eee; padding: 5px; border: 1px solid #ccc; text-align: right; }
          td { padding: 5px; border: 1px solid #ccc; }
          .page-break { page-break-after: always; }
        </style>
      </head>
      <body>
        <div class="header">
          <h2 style="margin: 0 0 5px;">إغلاق يومية المندوب : ${pRepName}</h2>
          <div>تاريخ الإغلاق: <span dir="ltr">${pDate}</span> | رقم اليومية: ${openDailyInfo?.daily_code || '---'}</div>
        </div>

        <div class="flex">
          <div class="box" style="margin-right:0;">
            <strong>ملخص الحساب:</strong><br/>
            الحساب الحالي: <span dir="ltr">${money(pTotal)} ج.م</span> (${balanceLabel(pTotal)})<br/>
            طريقة التسوية: <strong>${settlementDirection === 'collect' ? 'تحصيل من المندوب' : 'دفع للمندوب'}</strong><br/>
            المبلغ المدفوع للتقفيل: <span dir="ltr">${money(pAmount)} ج.م</span><br/>
            الخزينة: ${pTreasury}<br/><br/>
            <div style="background:#f1f1f1; padding:5px;"><strong>المتبقي (تقديري):</strong> <span dir="ltr">${money(settlementDirection === 'collect' ? pTotal + pAmount : pTotal - pAmount)} ج.م</span></div>
          </div>
          ${repTxType !== 'none' && repTxAmount > 0 ? `
          <div class="box" style="margin-left:0;">
            <strong>معاملة مالية للمندوب:</strong><br/>
            النوع: <strong>${repTxType === 'bonus' ? 'حافز' : 'غرامة'}</strong><br/>
            المبلغ: <span dir="ltr">${money(repTxAmount)} ج.م</span><br/>
            السبب: ${repTxReason || '---'}
          </div>
          ` : ''}
        </div>

        ${finalDeliveredList.length > 0 ? `
        <h4 style="margin-bottom:5px;">جدول تفاصيل التسليم (${finalDeliveredList.length} طلب) — القطع: ${deliveredPieces} — إجمالي: ${money(deliveredValue)}</h4>
        <table>
          <tr><th>رقم الأوردر</th><th>العميل</th><th style="text-align:center;">القطع</th><th style="text-align:center;">القيمة</th></tr>
          ${delivHTML}
        </table>
        ` : ''}

        ${finalReturnedList.length > 0 ? `
        <h4 style="margin-bottom:5px;">جدول تفاصيل المرتجع (${finalReturnedList.length} طلب) — القطع: ${returnedPieces} — إجمالي: ${money(returnedValue)}</h4>
        <table>
          <tr><th>رقم الأوردر</th><th>العميل</th><th style="text-align:center;">القطع</th><th style="text-align:center;">القيمة</th></tr>
          ${retHTML}
        </table>
        ` : ''}

        ${deferredOrders.length > 0 ? `
        <h4 style="margin-bottom:5px;">جدول تفاصيل النزول (${deferredOrders.length} طلب) — القطع: ${deferredPieces} — إجمالي: ${money(deferredValue)}</h4>
        <table>
          <tr><th>رقم الأوردر</th><th>العميل</th><th style="text-align:center;">القطع</th><th style="text-align:center;">القيمة</th></tr>
          ${defHTML}
        </table>
        ` : ''}
        
      </body>
      </html>
    `;

    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    document.body.appendChild(iframe);
    
    // Firefox fallback
    iframe.contentDocument?.open();
    iframe.contentDocument?.write(html);
    iframe.contentDocument?.close();
    
    iframe.onload = () => {
      setTimeout(() => {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
        setTimeout(() => { document.body.removeChild(iframe); }, 1000);
      }, 500);
    };
  };

  // --- Render ---
  return (
    <div className="p-6 space-y-5 relative" dir="rtl">
      {/* Header */}
      <div className="rounded-3xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-end gap-3 justify-between">
          <div>
            <h2 className="text-lg font-black text-slate-900 dark:text-white">إغلاق يومية المندوب (تسوية المديونية)</h2>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">التقفيل مرتبط بالخزينة فقط — مديونية المندوب تُقرأ مباشرة من الرصيد (balance).</div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handlePrintDailyClose}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-indigo-600 text-white hover:bg-indigo-700 font-black text-sm transition-colors"
              disabled={loading || !selectedRepId} title="طباعة وإغلاق"
            >
              طباعة اليومية
            </button>
            <button
              onClick={() => loadRepData(selectedRepId)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-slate-900 text-white hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-sm font-black"
              disabled={loading} title="تحديث"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> تحديث
            </button>
          </div>
        </div>
      </div>

      {/* Selectors */}
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
            <div className="mt-2 flex flex-wrap gap-2">
              {openDailyInfo ? (
                <span className="inline-flex items-center gap-1.5 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 px-3 py-1 rounded-full text-[10px] font-bold border border-green-200 dark:border-green-800">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse inline-block" />
                  يومية مفتوحة: {openDailyInfo.daily_code}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 px-3 py-1 rounded-full text-[10px] border border-rose-200 dark:border-rose-800">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500 inline-block" /> لا يوجد يومية مفتوحة
                </span>
              )}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4">
          <div className="text-xs text-slate-500 mb-2">طريقة الدفع للخزينة</div>
          <div className="flex gap-2 mb-3">
            <button
              onClick={() => { setPaymentMethod('cash'); if (userDefaults?.default_treasury_id) setSelectedTreasuryId(String(userDefaults.default_treasury_id)); }}
              className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition-all ${paymentMethod === 'cash' ? 'bg-blue-600 text-white shadow-md' : 'bg-white dark:bg-slate-800 text-slate-600 border border-slate-200 dark:border-slate-700'}`}
            >كاش</button>
            <button
              onClick={handleElectronicTreasury}
              className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition-all ${paymentMethod === 'electronic' ? 'bg-blue-600 text-white shadow-md' : 'bg-white dark:bg-slate-800 text-slate-600 border border-slate-200 dark:border-slate-700'}`}
            >مدفوعات إليكترونية</button>
          </div>
          {paymentMethod === 'cash' ? (
            <>
              <div className="text-xs text-slate-500 mb-2">اختر الخزينة</div>
              <CustomSelect
                value={selectedTreasuryId} onChange={v => setSelectedTreasuryId(v)}
                options={treasuries.map(t => ({ value: String(t.id), label: t.name }))}
                placeholder="— اختر —" disabled={loading || !canChangeTreasury}
              />
            </>
          ) : (
            <div className="text-xs font-bold text-blue-600 bg-blue-50 dark:bg-blue-900/20 p-2 rounded-lg border border-blue-100 dark:border-blue-800/50">
              تم اختيار خزينة "مدفوعات إليكترونية" تلقائياً
            </div>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="mb-4 rounded-3xl border border-blue-100 bg-gradient-to-br from-blue-50 to-slate-50 dark:from-slate-800 dark:to-slate-900 dark:border-slate-700 p-5 shadow-sm mt-4">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />
          <span className="text-sm font-black text-slate-700 dark:text-slate-200">
            {selectedRepId ? (openDailyInfo ? `ملخص اليومية المفتوحة — ${selectedRep?.name || ''}` : `العهدة الحالية — ${selectedRep?.name || ''}`) : 'الملخص'}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Balance */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 flex flex-col justify-between">
            <div className="flex items-start justify-between mb-2">
              <span className="text-[11px] font-black text-slate-500 uppercase tracking-wide">الحساب الحالى</span>
              <Wallet className="w-4 h-4 text-slate-400" />
            </div>
            <div className={`text-2xl font-black leading-none mb-1 ${balanceClass(repBalance)}`}>
              {selectedRepId ? money(repBalance) : '—'} <span className="text-xs font-bold text-slate-500 mr-1">{currencySymbol}</span>
            </div>
            <div className="text-[11px] text-slate-400">{selectedRepId ? `(${balanceLabel(repBalance)})` : 'اختر مندوباً'}</div>
          </div>

          {/* Delivered */}
          <div className="bg-white dark:bg-slate-900 border border-emerald-100 dark:border-slate-700 rounded-2xl p-4 flex flex-col justify-between">
            <div>
              <div className="flex items-start justify-between mb-2">
                <span className="text-[11px] font-black text-emerald-600 uppercase tracking-wide">إجمالي تسليم</span>
                <PackageCheck className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="text-2xl font-black text-emerald-700 dark:text-emerald-400 leading-none mb-2">
                {statsLoading ? '...' : finalDeliveredList.length} <span className="text-xs font-bold text-slate-500 mr-1">طلب</span>
              </div>
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-slate-600 dark:text-slate-400"><span>القطع المسلمة</span><span className="font-black">{statsLoading ? '—' : deliveredPieces}</span></div>
                <div className="flex justify-between text-xs text-slate-600 dark:text-slate-400"><span>القيمة</span><span className="font-black text-emerald-600">{statsLoading ? '—' : money(deliveredValue)} {currencySymbol}</span></div>
              </div>
            </div>
            <button onClick={() => setViewModal('delivered')} className="mt-3 flex items-center justify-center gap-1 text-xs bg-slate-50 dark:bg-slate-800 hover:bg-emerald-50 text-slate-600 hover:text-emerald-600 py-1.5 px-3 rounded-xl border border-slate-100 dark:border-slate-700 transition-colors"><Eye className="w-3.5 h-3.5" /> التفاصيل</button>
          </div>

          {/* Deferred */}
          <div className="bg-white dark:bg-slate-900 border border-amber-100 dark:border-slate-700 rounded-2xl p-4 flex flex-col justify-between">
            <div>
              <div className="flex items-start justify-between mb-2">
                <span className="text-[11px] font-black text-amber-600 uppercase tracking-wide">المؤجل (نزول)</span>
                <PackageCheck className="w-4 h-4 text-amber-400" />
              </div>
              <div className="text-2xl font-black text-amber-700 dark:text-amber-400 leading-none mb-2">
                {statsLoading ? '...' : deferredOrders.length} <span className="text-xs font-bold text-slate-500 mr-1">طلب</span>
              </div>
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-slate-600 dark:text-slate-400"><span>القطع المؤجلة</span><span className="font-black">{statsLoading ? '—' : deferredPieces}</span></div>
                <div className="flex justify-between text-xs text-slate-600 dark:text-slate-400"><span>القيمة</span><span className="font-black text-amber-600">{statsLoading ? '—' : money(deferredValue)} {currencySymbol}</span></div>
              </div>
            </div>
            <button onClick={() => setViewModal('deferred')} className="mt-3 flex items-center justify-center gap-1 text-xs bg-slate-50 dark:bg-slate-800 hover:bg-amber-50 text-slate-600 hover:text-amber-600 py-1.5 px-3 rounded-xl border border-slate-100 dark:border-slate-700 transition-colors"><Eye className="w-3.5 h-3.5" /> التفاصيل</button>
          </div>

          {/* Returned */}
          <div className="bg-white dark:bg-slate-900 border border-rose-100 dark:border-slate-700 rounded-2xl p-4 flex flex-col justify-between">
            <div>
              <div className="flex items-start justify-between mb-2">
                <span className="text-[11px] font-black text-rose-600 uppercase tracking-wide">إجمالي مرتجع</span>
                <PackageX className="w-4 h-4 text-rose-400" />
              </div>
              <div className="text-2xl font-black text-rose-700 dark:text-rose-400 leading-none mb-2">
                {statsLoading ? '...' : finalReturnedList.length} <span className="text-xs font-bold text-slate-500 mr-1">طلب</span>
              </div>
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-slate-600 dark:text-slate-400"><span>القطع المرتجعة</span><span className="font-black">{statsLoading ? '—' : returnedPieces}</span></div>
                <div className="flex justify-between text-xs text-slate-600 dark:text-slate-400"><span>القيمة</span><span className="font-black text-rose-600">{statsLoading ? '—' : money(returnedValue)} {currencySymbol}</span></div>
              </div>
            </div>
            <button onClick={() => setViewModal('returned')} className="mt-3 flex items-center justify-center gap-1 text-xs bg-slate-50 dark:bg-slate-800 hover:bg-rose-50 text-slate-600 hover:text-rose-600 py-1.5 px-3 rounded-xl border border-slate-100 dark:border-slate-700 transition-colors"><Eye className="w-3.5 h-3.5" /> التفاصيل</button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left Column: Settlement & Tx */}
        <div className="lg:col-span-1 space-y-4">
          <div className="rounded-3xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-4 text-slate-900 dark:text-white font-black"><User className="w-5 h-5 text-blue-600" /> معاملة مالية للمندوب</div>
            <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/30 p-3">
              <div className="text-xs text-slate-600 dark:text-slate-200 font-black mb-2">نوع المعاملة</div>
              <div className="flex items-center gap-3 mb-3">
                <label className="inline-flex items-center gap-2 text-sm cursor-pointer"><input type="radio" checked={repTxType === 'bonus'} onChange={() => setRepTxType('bonus')} /><span>حافز</span></label>
                <label className="inline-flex items-center gap-2 text-sm cursor-pointer"><input type="radio" checked={repTxType === 'penalty'} onChange={() => setRepTxType('penalty')} /><span>غرامة</span></label>
                <label className="inline-flex items-center gap-2 text-sm cursor-pointer"><input type="radio" checked={repTxType === 'none'} onChange={() => setRepTxType('none')} /><span>لا شيء</span></label>
              </div>
              <input type="number" min={0} placeholder="المبلغ" className="w-full mb-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl px-3 py-2 text-sm" value={repTxAmount || ''} onChange={e => setRepTxAmount(toNum(e.target.value))} disabled={repTxType === 'none'} />
              <input type="text" placeholder="السبب (اختياري)" className="w-full mb-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl px-3 py-2 text-sm" value={repTxReason} onChange={e => setRepTxReason(e.target.value)} disabled={repTxType === 'none'} />
              <button className="w-full py-2 rounded-2xl bg-emerald-500 text-white text-sm font-black disabled:opacity-50" disabled={repTxType === 'none' || repTxAmount <= 0 || repTxLoading} onClick={handleFinancialTx}>تنفيذ</button>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 dark:border-slate-700 bg-gradient-to-br from-slate-900 to-slate-800 p-5 shadow-sm text-white">
            <div className="flex items-center gap-2 font-black"><CheckCircle2 className="w-5 h-5 text-emerald-300" /> تأكيد التقفيل</div>
            <div className="mt-3 rounded-2xl p-3 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800">
              <div className="text-xs text-slate-700 dark:text-slate-200 mb-2">طريقة التسوية</div>
              <div className="flex items-center gap-3 mb-3">
                <label className="inline-flex items-center gap-2 text-xs cursor-pointer"><input type="radio" checked={settlementDirection === 'collect'} onChange={() => setSettlementDirection('collect')} /><span className="text-slate-800 dark:text-slate-200">تحصيل من المندوب</span></label>
                <label className="inline-flex items-center gap-2 text-xs cursor-pointer"><input type="radio" checked={settlementDirection === 'pay'} onChange={() => setSettlementDirection('pay')} /><span className="text-slate-800 dark:text-slate-200">دفع للمندوب</span></label>
              </div>
              <div className="text-xs text-slate-700 dark:text-slate-200 mb-2">المبلغ المدفوع للتقفيل</div>
              <input type="number" min={0} className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl px-3 py-3 text-sm font-bold text-slate-900 dark:text-white" value={paidAmount || ''} onChange={e => setPaidAmount(Math.max(0, toNum(e.target.value)))} disabled={loading || !selectedRepId} />
            </div>
            <div className="mt-4 space-y-2 text-xs">
              <div className="flex justify-between"><span className="text-slate-200/80">المندوب</span><span className="font-black">{selectedRep?.name || '—'}</span></div>
              <div className="flex justify-between"><span className="text-slate-200/80">الخزينة</span><span className="font-black">{selectedTreasuryName || '—'}</span></div>
              <div className="flex justify-between"><span className="text-slate-200/80">الحساب القديم</span><span className="font-black">{money(repBalance)} {currencySymbol} <span className="text-[11px] ml-1">({balanceLabel(repBalance)})</span></span></div>
              <div className="flex justify-between"><span className="text-slate-200/80">المبلغ المدفوع</span><span className="font-black">{money(paidAmount)} {currencySymbol}</span></div>
              <div className="flex justify-between"><span className="text-slate-200/80">المتبقي (تقديري)</span><span className={`font-black ${balanceClass(settlementDirection === 'collect' ? repBalance + paidAmount : repBalance - paidAmount)}`}>{money(settlementDirection === 'collect' ? repBalance + paidAmount : repBalance - paidAmount)} {currencySymbol}</span></div>
            </div>
            <button onClick={handleCloseDaily} disabled={loading || !selectedRepId || (paidAmount > 0 && !selectedTreasuryId)} className="mt-5 w-full bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-slate-900 font-black py-3 rounded-2xl transition-colors">
              تأكيد التقفيل وإغلاق اليومية
            </button>
          </div>
        </div>

        {/* Right Column: Orders Lists */}
        <div className="lg:col-span-2 rounded-3xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 shadow-sm">
          <div className="text-lg font-black text-slate-900 dark:text-white mb-4">قوائم الاوردرات</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Active Custody */}
            <div className="border border-slate-200 dark:border-slate-700 rounded-2xl p-3 flex flex-col max-h-[600px]">
              <div className="flex flex-col gap-2 mb-3">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-bold text-slate-800 dark:text-slate-200">العهدة الحالية ({activeOrders.length})</div>
                  <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-lg p-1">
                    <button onClick={() => setActiveOrdersSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')} className="p-1 rounded-md text-slate-500 hover:bg-white dark:hover:bg-slate-700 transition-colors"><ArrowDown size={14} className={activeOrdersSortOrder === 'asc' ? 'rotate-180' : ''} /></button>
                    <div className="w-px h-4 bg-slate-300 dark:bg-slate-600 mx-1"></div>
                    <button onClick={() => setActiveOrdersViewMode('list')} className={`p-1 rounded-md ${activeOrdersViewMode === 'list' ? 'bg-white dark:bg-slate-700 text-indigo-600' : 'text-slate-500'}`}><List size={14} /></button>
                    <button onClick={() => setActiveOrdersViewMode('card')} className={`p-1 rounded-md ${activeOrdersViewMode === 'card' ? 'bg-white dark:bg-slate-700 text-indigo-600' : 'text-slate-500'}`}><LayoutGrid size={14} /></button>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={toggleSelectAll} className="px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[11px] font-bold">تحديد الكل</button>
                  <button onClick={markSelectedDelivered} className="px-2 py-1 rounded-lg bg-emerald-500 text-white text-[11px] font-bold">تم التسليم</button>
                  <button onClick={moveSelectedToDeferred} className="px-2 py-1 rounded-lg bg-amber-500 text-white text-[11px] font-bold">نزول</button>
                </div>
              </div>
              <div className={`overflow-y-auto flex-1 custom-scrollbar pr-1 ${activeOrdersViewMode === 'list' ? 'divide-y divide-slate-100 dark:divide-slate-800' : 'space-y-2'}`}>
                {activeOrders.length === 0 ? <div className="text-xs text-slate-400 text-center py-6">لا توجد اوردرات.</div> : activeOrdersSorted.map(o => (
                  activeOrdersViewMode === 'list' ? (
                    <div key={o.id} className="flex items-center justify-between py-2 px-1 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                      <div className="flex items-center gap-2">
                        <input type="checkbox" checked={selectedOrderIds.includes(getRealOrderId(o))} onChange={() => toggleSelectOrder(getRealOrderId(o))} className="w-3.5 h-3.5 rounded text-indigo-600 cursor-pointer" />
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate max-w-[120px]">
                          #{o.orderNumber || o.order_number} {o.customerName || o.customer_name || o.name}
                        </span>
                        {computeReturnedPieces(o) > 0 && <span className="text-[9px] font-bold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded border border-amber-200 dark:bg-amber-900/40 dark:border-amber-800">تسليم جزئي</span>}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-black text-emerald-600">{money(computeOriginalOrderValue(o))}</span>
                        <button onClick={() => moveSingleToDeferred(o)} className="px-2 py-0.5 text-[10px] bg-amber-100 text-amber-700 rounded dark:bg-amber-900/40 dark:text-amber-400">نزول</button>
                      </div>
                    </div>
                  ) : (
                    <div key={o.id} className="border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 bg-white dark:bg-slate-900">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <input type="checkbox" checked={selectedOrderIds.includes(getRealOrderId(o))} onChange={() => toggleSelectOrder(getRealOrderId(o))} className="w-3.5 h-3.5 rounded text-indigo-600 cursor-pointer mt-0.5" />
                          <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                            #{o.orderNumber || o.order_number} — {o.customerName || o.customer_name || o.name}
                          </span>
                          {computeReturnedPieces(o) > 0 && <span className="text-[9px] font-bold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded border border-amber-200 dark:bg-amber-900/40 dark:border-amber-800">تسليم جزئي</span>}
                        </div>
                        <button onClick={() => moveSingleToDeferred(o)} className="px-2 py-0.5 text-[10px] bg-amber-100 text-amber-700 rounded dark:bg-amber-900/40 dark:text-amber-400 font-bold">نزول</button>
                      </div>
                      <div className="bg-slate-50 dark:bg-slate-800/50 rounded-md p-1.5 ml-5 mb-1.5">
                        {(o.products || []).slice(0, 2).map((p: any, i: number) => (
                          <div key={i} className="flex justify-between text-[10px] text-slate-600 dark:text-slate-400">
                            <span className="truncate">{p.name}</span><span>x{p.quantity || p.qty}</span>
                          </div>
                        ))}
                      </div>
                      <div className="text-right ml-5 text-xs font-black text-emerald-600">{money(computeOriginalOrderValue(o))} {currencySymbol}</div>
                    </div>
                  )
                ))}
              </div>
            </div>

            {/* Deferred Orders */}
            <div className="border border-slate-200 dark:border-slate-700 rounded-2xl p-3 flex flex-col max-h-[600px]">
              <div className="flex flex-col gap-2 mb-3">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-bold text-slate-800 dark:text-slate-200">المؤجل لليومية ({deferredOrders.length})</div>
                  <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-lg p-1">
                    <button onClick={() => setDeferredOrdersSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')} className="p-1 rounded-md text-slate-500 hover:bg-white dark:hover:bg-slate-700 transition-colors"><ArrowDown size={14} className={deferredOrdersSortOrder === 'asc' ? 'rotate-180' : ''} /></button>
                    <div className="w-px h-4 bg-slate-300 dark:bg-slate-600 mx-1"></div>
                    <button onClick={() => setDeferredOrdersViewMode('list')} className={`p-1 rounded-md ${deferredOrdersViewMode === 'list' ? 'bg-white dark:bg-slate-700 text-indigo-600' : 'text-slate-500'}`}><List size={14} /></button>
                    <button onClick={() => setDeferredOrdersViewMode('card')} className={`p-1 rounded-md ${deferredOrdersViewMode === 'card' ? 'bg-white dark:bg-slate-700 text-indigo-600' : 'text-slate-500'}`}><LayoutGrid size={14} /></button>
                  </div>
                </div>
              </div>
              <div className={`overflow-y-auto flex-1 custom-scrollbar pr-1 ${deferredOrdersViewMode === 'list' ? 'divide-y divide-slate-100 dark:divide-slate-800' : 'space-y-2'}`}>
                {deferredOrders.length === 0 ? <div className="text-xs text-slate-400 text-center py-6">لا توجد اوردرات.</div> : deferredOrdersSorted.map(o => (
                  deferredOrdersViewMode === 'list' ? (
                    <div key={o.id} className="flex items-center justify-between py-2 px-1 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                      <div className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate max-w-[120px]">#{o.orderNumber || o.order_number} {o.customerName || o.customer_name || o.name}</div>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-black text-emerald-600">{money(computeOriginalOrderValue(o))}</span>
                        <button onClick={() => moveDeferredBack(o)} className="px-2 py-0.5 text-[10px] bg-slate-100 text-slate-700 rounded dark:bg-slate-800 dark:text-slate-300">ارجاع</button>
                      </div>
                    </div>
                  ) : (
                    <div key={o.id} className="border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 bg-white dark:bg-slate-900">
                      <div className="flex items-start justify-between mb-2">
                        <div className="text-xs font-bold text-slate-800 dark:text-slate-200">#{o.orderNumber || o.order_number} — {o.customerName || o.customer_name || o.name}</div>
                        <button onClick={() => moveDeferredBack(o)} className="px-2 py-0.5 text-[10px] bg-slate-100 text-slate-700 rounded dark:bg-slate-800 dark:text-slate-300 font-bold">ارجاع</button>
                      </div>
                      <div className="bg-slate-50 dark:bg-slate-800/50 rounded-md p-1.5 mb-1.5">
                        {(o.products || []).slice(0, 2).map((p: any, i: number) => (
                          <div key={i} className="flex justify-between text-[10px] text-slate-600 dark:text-slate-400">
                            <span className="truncate">{p.name}</span><span>x{p.quantity || p.qty}</span>
                          </div>
                        ))}
                      </div>
                      <div className="text-right text-xs font-black text-emerald-600">{money(computeOriginalOrderValue(o))} {currencySymbol}</div>
                    </div>
                  )
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* View Modals */}
      {viewModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4" dir="rtl">
          <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-200">
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50">
              <h3 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                {viewModal === 'delivered' ? <PackageCheck className="text-emerald-500" /> : viewModal === 'returned' ? <PackageX className="text-rose-500" /> : <PackageCheck className="text-amber-500" />}
                {viewModal === 'delivered' ? 'الاوردرات المسلمة' : viewModal === 'returned' ? 'الاوردرات المرتجعة' : 'الاوردرات المؤجلة'}
              </h3>
              <button onClick={() => setViewModal(null)} className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600">✕</button>
            </div>
            <div className="p-5 overflow-y-auto flex-1 custom-scrollbar">
              {(() => {
                const list = viewModal === 'delivered' ? finalDeliveredList : viewModal === 'returned' ? finalReturnedList : deferredOrders;
                if (list.length === 0) return <div className="text-center text-slate-500 py-12">لا توجد اوردرات في هذه القائمة.</div>;
                return (
                  <table className="w-full text-sm text-right">
                    <thead className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                      <tr>
                        <th className="p-3 font-bold rounded-r-xl">رقم الاوردر</th>
                        <th className="p-3 font-bold">العميل</th>
                        <th className="p-3 font-bold text-center">القطع</th>
                        <th className="p-3 font-bold text-center">القيمة</th>
                        <th className="p-3 font-bold rounded-l-xl text-center">إجراء</th>
                      </tr>
                    </thead>
                    <tbody>
                      {list.map(o => {
                        const isPartial = computeReturnedPieces(o) > 0 && computeDeliveredNetPieces(o) > 0;
                        let badge = null;
                        if (viewModal === 'delivered') {
                          badge = <span className={`mr-2 px-2 py-0.5 rounded text-[10px] font-bold inline-block border ${isPartial ? 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:border-amber-800 dark:text-amber-400' : 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:border-emerald-800 dark:text-emerald-400'}`}>{isPartial ? 'تسليم جزئي' : 'تسليم كامل'}</span>;
                        } else if (viewModal === 'returned') {
                          badge = <span className={`mr-2 px-2 py-0.5 rounded text-[10px] font-bold inline-block border ${isPartial ? 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:border-amber-800 dark:text-amber-400' : 'bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-900/30 dark:border-rose-800 dark:text-rose-400'}`}>{isPartial ? 'ارتجاع جزئي' : 'ارتجاع كامل'}</span>;
                        }

                        return (
                          <tr key={o.id} className="border-b border-slate-50 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800/30">
                            <td className="p-3 font-black text-slate-900 dark:text-white">
                              #{o.orderNumber || o.order_number || o.id}
                              {badge}
                            </td>
                            <td className="p-3 text-slate-700 dark:text-slate-300">{o.customerName || o.customer_name || o.name || '—'}</td>
                            <td className="p-3 text-center text-slate-600 dark:text-slate-400">
                              {viewModal === 'returned' ? computeReturnedPieces(o) : viewModal === 'delivered' ? computeDeliveredNetPieces(o) : computePieces(o)}
                            </td>
                            <td className="p-3 font-bold text-center text-emerald-600 dark:text-emerald-400">
                              {money(viewModal === 'returned' ? computeReturnedOrderValue(o) : viewModal === 'delivered' ? computeDeliveredNetValue(o) : computeOrderValueWithoutShipping(o))} {currencySymbol}
                            </td>
                            <td className="p-3 text-center">
                              {viewModal !== 'deferred' && (
                                <button
                                  onClick={() => handleUndoOrder(getRealOrderId(o))}
                                  disabled={loading}
                                  className="px-2 py-1 flex items-center justify-center gap-1 mx-auto bg-rose-50 hover:bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:hover:bg-rose-900/50 dark:text-rose-400 font-bold text-[10px] rounded border border-rose-200 dark:border-rose-800/50 transition-colors disabled:opacity-50"
                                >
                                  إرجاع ↩️
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
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
