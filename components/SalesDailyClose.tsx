import React, { useEffect, useMemo, useState } from 'react';
import Swal from 'sweetalert2';
import { API_BASE_PATH } from '../services/apiConfig';
import { User, Wallet, PackageCheck, PackageX, CheckCircle2, RefreshCw, Eye } from 'lucide-react';
import CustomSelect from './CustomSelect';

const toNum = (v: any) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const money = (n: number) => toNum(n).toLocaleString();

const balanceLabel = (bal: number) => (bal > 0 ? 'له' : bal < 0 ? 'عليه' : '');
const balanceClass = (bal: number) => (bal > 0 ? 'text-emerald-600' : bal < 0 ? 'text-rose-600' : 'text-slate-600');

type RepStats = {
  deliveredCount: number;
  deliveredValue: number;
  returnedCount: number;
  returnedValue: number;
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
  // Date range for statistics (default = today)
  const todayStr = new Date().toISOString().slice(0,10);
  const [statsFrom, setStatsFrom] = useState<string>(todayStr);
  const [statsTo, setStatsTo] = useState<string>(todayStr);

  // CRITICAL: this is fetched from DB and treated as the exact current debt/balance.
  const [repBalance, setRepBalance] = useState<number>(0);

  const [paidAmount, setPaidAmount] = useState<number>(0);
  const [settlementDirection, setSettlementDirection] = useState<'collect'|'pay'>('collect');
  const [repTxType, setRepTxType] = useState<'none'|'bonus'|'penalty'>('none');
  const [repTxAmount, setRepTxAmount] = useState<number>(0);
  const [repTxReason, setRepTxReason] = useState<string>('');
  const [repTxLoading, setRepTxLoading] = useState<boolean>(false);

  const [repStats, setRepStats] = useState<RepStats>({
    deliveredCount: 0,
    deliveredValue: 0,
    returnedCount: 0,
    returnedValue: 0
  });

  const [repExtras, setRepExtras] = useState({ deliveredPieces: 0, returnedPieces: 0, deferredCount: 0, deferredPieces: 0, deferredValue: 0 });
  const [journalStats, setJournalStats] = useState({
    oldOrdersCount: 0,
    todayOrdersCount: 0,
    deliveredCount: 0,
    deliveredTotal: 0,
    returnedCount: 0,
    postponedCount: 0, // أوردرات النزول (المتبقية)
    postponedTotal: 0,
  });

  // Orders UI states for the new split box
  const [repOrders, setRepOrders] = useState<any[]>([]);
  const [deferredOrders, setDeferredOrders] = useState<any[]>([]);
  const [selectedOrderIdsLocal, setSelectedOrderIdsLocal] = useState<number[]>([]);

  // States for Modals
  const [deliveredOrdersList, setDeliveredOrdersList] = useState<any[]>([]);
  const [returnedOrdersList, setReturnedOrdersList] = useState<any[]>([]);
  const [viewModal, setViewModal] = useState<'delivered' | 'returned' | 'deferred' | null>(null);

  // Helpers reused across handlers
  /* const computePieces = (order:any) => {
    const items = order.products || order.order_items || order.items || [];
    if (!Array.isArray(items)) return 0;
    return items.reduce((s:any,it:any) => s + Number(it.quantity || it.qty || 0), 0);
  }; */
const computePieces = (order:any) => {
    // 1. بندور على إجمالي القطع لو مبعوث جاهز من السيرفر في أي حقل من دول
    if (order.pieces !== undefined && order.pieces !== null) return toNum(order.pieces);
    if (order.total_pieces !== undefined && order.total_pieces !== null) return toNum(order.total_pieces);
    if (order.quantity !== undefined && order.quantity !== null) return toNum(order.quantity);
    if (order.items_count !== undefined && order.items_count !== null) return toNum(order.items_count);

    // 2. لو مفيش، نحاول نجمعهم من المنتجات لو موجودة
    const items = order.products || order.order_items || order.items || [];
    if (!Array.isArray(items) || items.length === 0) return 0;
    
    return items.reduce((s:any, it:any) => s + Number(it.quantity || it.qty || 1), 0);
  };
  const computeOrderValue = (order:any) => {
    if (order.total_amount !== undefined) return toNum(order.total_amount);
    if (order.total !== undefined) return toNum(order.total);
    const items = order.products || order.order_items || order.items || [];
    if (!Array.isArray(items)) return 0;
    return items.reduce((s:any,it:any) => s + (Number(it.quantity || it.qty || 0) * Number(it.price || it.price_per_unit || it.sale_price || 0)), 0);
  };
const loadJournalLiveStats = async (journal: any) => {
  try {
    // 1. فك تشفير مصفوفة الأوردرات المحفوظة وقت فتح اليومية
    const ordersArray = typeof journal.orders_json === 'string' 
      ? JSON.parse(journal.orders_json) 
      : (journal.orders_json || []);

    if (ordersArray.length === 0) return;

    // استخراج أرقام الأوردرات (IDs)
    const orderIds = ordersArray.map((o: any) => o.id).filter(Boolean);

    // 2. جلب الحالة الحالية والبيانات المُحدثة لهذه الأوردرات من الداتا بيز
    const res = await fetch(`${API_BASE_PATH}/api.php?module=sales&action=getOrdersByIds&ids=${orderIds.join(',')}`);
    const js = await res.json();

    if (js.success) {
      const liveOrders = js.data;

      let delivered = 0, deliveredVal = 0;
      let returned = 0;
      let postponed = 0, postponedVal = 0;

      // 3. تصنيف الأوردرات بناءً على حالتها الحالية
      liveOrders.forEach((order: any) => {
        const status = order.status || order.order_status;
        const total = Number(order.total || order.total_amount || 0);

        if (status === 'delivered') {
          // تم التسليم
          delivered++;
          deliveredVal += total;
        } else if (status === 'returned') {
          // مرتجع كلي
          returned++;
        } else {
          // أي حالة أخرى (قيد الانتظار، مع المندوب، مؤجل) تعتبر "نزول" لليوم التالي
          postponed++;
          postponedVal += total;
        }
      });

      // 4. تحديث الإحصائيات لتعرضها أمام موظف الحسابات
      setJournalStats({
        oldOrdersCount: ordersArray.filter((o: any) => o.source === 'old').length,
        todayOrdersCount: ordersArray.filter((o: any) => o.source === 'today').length,
        deliveredCount: delivered,
        deliveredTotal: deliveredVal,
        returnedCount: returned,
        postponedCount: postponed,
        postponedTotal: postponedVal
      });
    }
  } catch (err) {
    console.error("Error calculating live stats", err);
  }
};
  const recalcDeferredExtras = (deferredList:any[]) => {
    const deferredPieces = (deferredList||[]).reduce((s:number,o:any) => s + computePieces(o), 0);
    const deferredValue = (deferredList||[]).reduce((s:number,o:any) => s + computeOrderValue(o), 0);
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

      // Apply treasury defaults (matches the behavior pattern used in SalesDaily)
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

  const loadRepDailyStats = async (repId: string, from?: string, to?: string) => {
    if (!repId) return;
    setStatsLoading(true);
    try {
      // --- Primary source: rep_daily_journal aggregated stats ---
      let journalUrl = `${API_BASE_PATH}/api.php?module=sales&action=getJournalStats&rep_id=${encodeURIComponent(repId)}`;
      if (from) journalUrl += `&from=${encodeURIComponent(from)}`;
      if (to)   journalUrl += `&to=${encodeURIComponent(to)}`;

      const jr = await fetch(journalUrl);
      const jj = await jr.json();

      if (jj && jj.success && jj.has_journal) {
        // Journal has records for this period — use them directly
        const d = jj.data || {};
        setRepStats({
          deliveredCount: toNum(d.deliveredCount),
          deliveredValue: toNum(d.deliveredValue),
          returnedCount:  toNum(d.returnedCount),
          returnedValue:  toNum(d.returnedValue),
        });
        setRepExtras(prev => ({
          ...prev,
          deliveredPieces: toNum(d.deliveredPieces),
          returnedPieces:  toNum(d.returnedPieces),
          deferredCount:   toNum(d.deferredCount),
          deferredPieces:  toNum(d.deferredPieces),
          deferredValue:   toNum(d.deferredValue),
        }));
        // If the journal row itself (with `orders_json`) is present, compute live stats
        const journalRow = d.journal || d.row || d;
        if (journalRow && (journalRow.orders_json || journalRow.orders)) {
          try {
            await loadJournalLiveStats(journalRow);
          } catch (e) {
            console.warn('loadJournalLiveStats failed', e);
          }
        }
        return; // ✅ done — no need to hit the old endpoint
      }

      // --- Fallback: legacy getRepDailyStats (orders table scan) ---
      let url = `${API_BASE_PATH}/api.php?module=sales&action=getRepDailyStats&rep_id=${encodeURIComponent(repId)}`;
      if (from && to) {
        url += `&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
      } else if (from) {
        url += `&date=${encodeURIComponent(from)}`;
      }
      const r = await fetch(url);
      const j = await r.json();

      if (j && j.success) {
        const d = j.data || {};
        setRepStats({
          deliveredCount: toNum(d.deliveredCount ?? d.delivered_orders_count ?? 0),
          deliveredValue: toNum(d.deliveredValue ?? d.delivered_orders_value ?? 0),
          returnedCount:  toNum(d.returnedCount ?? d.returned_orders_count ?? 0),
          returnedValue:  toNum(d.returnedValue ?? d.returned_orders_value ?? 0),
        });
      } else {
        setRepStats({ deliveredCount: 0, deliveredValue: 0, returnedCount: 0, returnedValue: 0 });
      }
    } catch (e) {
      console.error('Failed to load rep daily stats', e);
      setRepStats({ deliveredCount: 0, deliveredValue: 0, returnedCount: 0, returnedValue: 0 });
    } finally {
      setStatsLoading(false);
    }
  };

  const refreshSelectedRepBalanceFromServer = async (repId: string) => {
    // Fetch from the canonical "getAllWithBalance" source to keep math consistent with DB.
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // When rep changes: update displayed DB balance (exact current debt) and default settlement amount.
    if (!selectedRepId) {
      setRepBalance(0);
      setPaidAmount(0);
      setRepStats({ deliveredCount: 0, deliveredValue: 0, returnedCount: 0, returnedValue: 0 });
      setRepOrders([]);
      setDeferredOrders([]);
      setDeliveredOrdersList([]);
      setReturnedOrdersList([]);
      setSelectedOrderIdsLocal([]);
      return;
    }

    const rep = reps.find(r => String(r.id) === String(selectedRepId));
    const bal = toNum(rep?.balance ?? 0);
    setRepBalance(bal);
    setPaidAmount(Math.max(0, -bal));
    loadRepDailyStats(selectedRepId, statsFrom, statsTo);
    
    // load orders for this rep (client-side filter)
    (async () => {
      try {
        const r = await fetch(`${API_BASE_PATH}/api.php?module=orders&action=getAll`);
        const jr = await r.json();
        const all = (jr && jr.success && Array.isArray(jr.data)) ? jr.data : [];
        
        // filter by rep
        let mine = all.filter((o:any) => String(o.rep_id || o.repId || o.assigned_rep || '') === String(selectedRepId));
        
        // الأوردرات النشطة (مع المندوب حالياً - لا تتأثر بفلتر التاريخ)
        const notDeliveredAll = mine.filter((o:any) => !['delivered','returned'].includes(String(o.status)));
        const deferredAll = notDeliveredAll.filter((o:any) => ['pending','delayed','postponed'].includes(String(o.status)));
        const activeAll = notDeliveredAll.filter(o => !deferredAll.includes(o));

        // دالة مساعدة لفلترة التاريخ بدقة 
        /* const isWithinRange = (rawDate: any, from: string, to: string) => {
          if (!rawDate) return false;
          try {
            const datePart = String(rawDate).split(' ')[0]; // YYYY-MM-DD
            const d = new Date(datePart);
            if (isNaN(d.getTime())) return false;
            const ds = d.toISOString().slice(0,10);
            if (from && to) return ds >= from && ds <= to;
            if (from) return ds === from;
            return true;
          } catch (e) { return false; }
        }; */
// دالة مساعدة لفلترة التاريخ بدقة (بدون ترحيل أيام بسبب فروق التوقيت)
        const isWithinRange = (rawDate: any, from: string, to: string) => {
          if (!rawDate) return false;
          try {
            // لو التاريخ راجع من الداتا بيز بالشكل ده YYYY-MM-DD HH:MM:SS
            // بناخد أول 10 حروف اللي هما YYYY-MM-DD ونقارنهم مباشرة
            let ds = String(rawDate).split(' ')[0];
            
            // لو التنسيق مش YYYY-MM-DD بنحوله بشكل آمن للوقت المحلي
            if (!ds.match(/^\d{4}-\d{2}-\d{2}$/)) {
              const d = new Date(rawDate);
              if (isNaN(d.getTime())) return false;
              const year = d.getFullYear();
              const month = String(d.getMonth() + 1).padStart(2, '0');
              const day = String(d.getDate()).padStart(2, '0');
              ds = `${year}-${month}-${day}`;
            }

            if (from && to) return ds >= from && ds <= to;
            if (from) return ds === from;
            return true;
          } catch (e) { return false; }
        };
        // الأوردرات التي سيتم احتساب إحصائياتها (نطبق فلتر التاريخ هنا)
        let statsMine = mine;
        if (statsFrom || statsTo) {
          statsMine = mine.filter((o:any) => {
            const rawDate = o.updated_at || o.updatedAt || o.created_at || o.createdAt || o.date || o.order_date || '';
            return isWithinRange(rawDate, statsFrom, statsTo);
          });
        }

        const notDeliveredStats = statsMine.filter((o:any) => !['delivered','returned'].includes(String(o.status)));
        const deferredStats = notDeliveredStats.filter((o:any) => ['pending','delayed','postponed'].includes(String(o.status)));
        
        const delivered = statsMine.filter((o:any) => String(o.status) === 'delivered');
        const returned = statsMine.filter((o:any) => String(o.status) === 'returned');
        
        const deliveredPieces = delivered.reduce((s:number,o:any) => s + computePieces(o), 0);
        const returnedPieces = returned.reduce((s:number,o:any) => s + computePieces(o), 0);
        const deferredPieces = deferredStats.reduce((s:number,o:any) => s + computePieces(o), 0);
        const deferredValue = deferredStats.reduce((s:number,o:any) => s + computeOrderValue(o), 0);

        // Client-side fallback: derive stats from loaded orders so UI shows values even if backend stats fail or are delayed.
        try {
          const deliveredCountLocal = delivered.length;
          const deliveredValueLocal = delivered.reduce((s:number,o:any) => s + computeOrderValue(o), 0);
          const returnedCountLocal = returned.length;
          const returnedValueLocal = returned.reduce((s:number,o:any) => s + computeOrderValue(o), 0);
          setRepStats({ deliveredCount: deliveredCountLocal, deliveredValue: deliveredValueLocal, returnedCount: returnedCountLocal, returnedValue: returnedValueLocal });
        } catch (e) {
          // ignore local aggregation errors
        }

        setRepOrders(activeAll); // الأوردرات النشطة غير مفلترة بالتاريخ
        setDeferredOrders(deferredAll); // الأوردرات المؤجلة غير مفلترة بالتاريخ
        
        // قوائم النوافذ المنبثقة
        setDeliveredOrdersList(delivered);
        setReturnedOrdersList(returned);

        setSelectedOrderIdsLocal(activeAll.map((o:any)=>o.id));
        setRepExtras({ deliveredPieces, returnedPieces, deferredCount: deferredStats.length, deferredPieces, deferredValue });
      } catch (e) {
        console.error('Failed to load orders for rep', e);
        setRepOrders([]);
        setDeferredOrders([]);
        setSelectedOrderIdsLocal([]);
        setDeliveredOrdersList([]);
        setReturnedOrdersList([]);
      }
    })();
    // reload when selectedRepId or stats range changes
  }, [selectedRepId, statsFrom, statsTo, reps]);

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
      await Promise.all(
        ids.map(id => fetch(`${API_BASE_PATH}/api.php?module=orders&action=update`, { 
          method: 'POST', 
          headers: {'Content-Type':'application/json'}, 
          body: JSON.stringify({ id, status: 'delivered', repId: Number(selectedRepId) }) 
        }))
      );
      
      const moved = (repOrders || []).filter((o:any)=> ids.includes(o.id));
      
      // update modal list
      setDeliveredOrdersList(prev => [...prev, ...moved]);
      
      // remove from lists
      setRepOrders(prev => prev.filter((o:any)=> !ids.includes(o.id)));
      setDeferredOrders(prev => prev.filter((o:any)=> !ids.includes(o.id)));
      setSelectedOrderIdsLocal([]);
      
      // Update stats manually
      const newDelivered = [...deliveredOrdersList, ...moved];
      setRepStats(prev => ({
        ...prev,
        deliveredCount: newDelivered.length,
        deliveredValue: newDelivered.reduce((s:number,o:any) => s + computeOrderValue(o), 0)
      }));
      setRepExtras(prev => ({ 
        ...prev, 
        deliveredPieces: newDelivered.reduce((s:number,o:any) => s + computePieces(o), 0) 
      }));

      await loadRepDailyStats(selectedRepId, statsFrom, statsTo);
      Swal.fire('تم', 'تم تحديث حالة الاوردرات المحددة إلى تم التسليم.', 'success');
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
      await Promise.all(
        ids.map(id => fetch(`${API_BASE_PATH}/api.php?module=orders&action=update`, { 
          method: 'POST', 
          headers: {'Content-Type':'application/json'}, 
          body: JSON.stringify({ id, status: 'pending', repId: Number(selectedRepId) }) 
        }))
      );
      // move locally (compute new lists so we can recalc extras immediately)
      const moved = (repOrders || []).filter((o:any)=> ids.includes(o.id));
      const newDeferred = [...(deferredOrders || []), ...moved];
      setDeferredOrders(newDeferred);
      setRepOrders(prev => prev.filter((o:any)=> !ids.includes(o.id)));
      recalcDeferredExtras(newDeferred);
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
      await fetch(`${API_BASE_PATH}/api.php?module=orders&action=update`, { 
        method: 'POST', 
        headers: {'Content-Type':'application/json'}, 
        body: JSON.stringify({ id: order.id, status: 'pending', repId: Number(selectedRepId) }) 
      });
      const newDeferred = [...(deferredOrders || []), order];
      setDeferredOrders(newDeferred);
      setRepOrders(prev => prev.filter((o:any)=> o.id !== order.id));
      setSelectedOrderIdsLocal(prev => prev.filter(x=> x !== order.id));
      recalcDeferredExtras(newDeferred);
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
      await fetch(`${API_BASE_PATH}/api.php?module=orders&action=update`, { 
        method: 'POST', 
        headers: {'Content-Type':'application/json'}, 
        body: JSON.stringify({ id: order.id, status: 'with_rep', repId: Number(selectedRepId) }) 
      });
      setRepOrders(prev => [...prev, order]);
      setDeferredOrders(prev => prev.filter((o:any)=> o.id !== order.id));
      recalcDeferredExtras(deferredOrders.filter((o:any)=> o.id !== order.id));
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
    if (!selectedTreasuryId) {
      Swal.fire('اختر الخزينة', 'يرجى اختيار الخزينة لإتمام التقفيل.', 'warning');
      return;
    }

    const amount = Math.max(0, toNum(paidAmount));
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
          <div><b>الخزينة:</b> ${selectedTreasuryName || selectedTreasuryId}</div>
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
      if (settlementDirection === 'collect') {
        // existing settleDaily flow (collect from rep)
        // include a reason so the backend has notes/details.reason as required
        const payload = { repId: Number(selectedRepId), treasuryId: Number(selectedTreasuryId), paidAmount: amount, details: { reason: 'اغلاق اليوميه تلقائيا' }, notes: 'اغلاق اليوميه تلقائيا' };
        const r = await fetch(`${API_BASE_PATH}/api.php?module=sales&action=settleDaily`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
        });
        const j = await r.json();
        if (j && j.success) {
          settleSuccess = true;
          Swal.fire('تم', 'تم التقفيل وتنفيذ التسوية بنجاح.', 'success');
        } else {
          Swal.fire('فشل العملية', j?.message || 'تعذر تنفيذ التقفيل.', 'error');
        }
      } else {
        // pay -> create a rep payment transaction (company pays the rep)
        const txPayload = {
          type: 'rep_payment_out',
          related_to_type: 'rep',
          related_to_id: Number(selectedRepId),
          amount: amount,
          treasuryId: Number(selectedTreasuryId),
          direction: 'out',
          details: { action: 'settleDaily', rep_id: Number(selectedRepId), model: 'consignment', reason: 'اغلاق اليوميه تلقائيا' },
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
          Swal.fire('تم', 'تم دفع المبلغ إلى المندوب وتسجيل المعاملة.', 'success');
        } else {
          Swal.fire('فشل العملية', j2?.message || 'تعذر تسجيل عملية الدفع.', 'error');
        }
      }

      // Log close event (fire-and-forget – non-critical)
      if (settleSuccess) {
        try {
          await fetch(`${API_BASE_PATH}/api.php?module=sales&action=logCloseDaily`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              rep_id: Number(selectedRepId),
              treasury_id: Number(selectedTreasuryId),
              paid_amount: amount,
              direction: settlementDirection,
              event_date: new Date().toISOString().slice(0, 10),
              notes: 'اغلاق اليوميه تلقائيا'
            })
          });
        } catch (logErr) { console.warn('logCloseDaily failed (non-critical)', logErr); }
      }
      // Refresh canonical balance and stats after either operation
      await Promise.all([refreshSelectedRepBalanceFromServer(selectedRepId), loadRepDailyStats(selectedRepId, statsFrom, statsTo)]);
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
                if (selectedRepId) await Promise.all([refreshSelectedRepBalanceFromServer(selectedRepId), loadRepDailyStats(selectedRepId, statsFrom, statsTo)]);
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

      {/* Rep and Treasury selectors moved above the stats for quicker access */}
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
        </div>
        <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4">
          <div className="text-xs text-slate-500 mb-2">اختر الخزينة</div>
          <CustomSelect
            value={selectedTreasuryId}
            onChange={v => setSelectedTreasuryId(v)}
            options={treasuries.map(t => ({ value: String(t.id), label: t.name }))}
            placeholder="— اختر —"
            disabled={loading || !canChangeTreasury}
          />
        </div>
      </div>

      {/* ─── ملخص اليومية + فلتر التاريخ ─── */}
      <div className="mb-4 rounded-3xl border border-blue-100 bg-gradient-to-br from-blue-50 to-slate-50 dark:from-slate-800 dark:to-slate-900 dark:border-slate-700 p-5 shadow-sm">
        {/* Header row: title + date pickers */}
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse flex-shrink-0" />
            <span className="text-sm font-black text-slate-700 dark:text-slate-200 truncate">
              {selectedRepId ? `ملخص اليومية — ${selectedRep?.name || ''}` : 'ملخص اليومية'}
            </span>
            {statsLoading && (
              <RefreshCw className="w-3.5 h-3.5 text-slate-400 animate-spin flex-shrink-0" />
            )}
          </div>
          {/* Date range */}
          <div className="flex items-center gap-2 flex-wrap">
            <input
              type="date" value={statsFrom}
              onChange={e => setStatsFrom(e.target.value)}
              className="border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 rounded-xl px-3 py-1.5 text-sm"
            />
            <span className="text-xs text-slate-400">إلى</span>
            <input
              type="date" value={statsTo}
              onChange={e => setStatsTo(e.target.value)}
              className="border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 rounded-xl px-3 py-1.5 text-sm"
            />
            <button
              type="button"
              className="px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-xl text-xs font-bold text-slate-600 hover:bg-blue-50 transition-colors"
              onClick={() => {
                const d = new Date();
                const fmt = (x: Date) => `${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,'0')}-${String(x.getDate()).padStart(2,'0')}`;
                setStatsFrom(fmt(d)); setStatsTo(fmt(d));
                if (selectedRepId) loadRepDailyStats(selectedRepId, fmt(d), fmt(d));
              }}
            >اليوم</button>
            <button
              type="button"
              className="px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-xl text-xs font-bold text-slate-600 hover:bg-blue-50 transition-colors"
              onClick={() => {
                const fmt = (x: Date) => `${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,'0')}-${String(x.getDate()).padStart(2,'0')}`;
                const to = new Date(); const from = new Date(); from.setDate(to.getDate() - 2);
                setStatsFrom(fmt(from)); setStatsTo(fmt(to));
                if (selectedRepId) loadRepDailyStats(selectedRepId, fmt(from), fmt(to));
              }}
            >منذ يومين</button>
          </div>
        </div>

        {/* 4-card grid: Balance + Delivered + Deferred + Returned */}
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
        {/* Left column: بيانات التقفيل (top) and تأكيد التقفيل (bottom) */}
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
                          // choose type/direction
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
                            // optimistic update
                            setRepBalance(prev => repTxType === 'bonus' ? prev + amt : prev - amt);
                            setReps(prev => prev.map(u => String(u.id) === String(selectedRepId) ? { ...u, balance: toNum((u.balance || 0) + (repTxType==='bonus' ? amt : -amt)) } : u));
                            Swal.fire('تم', repTxType === 'bonus' ? 'تم إضافة الحافز وتحديث حساب المندوب.' : 'تم تطبيق الغرامة وتحديث حساب المندوب.', 'success');
                            // clear inputs
                            setRepTxAmount(0); 
                            setRepTxReason(''); 
                            setRepTxType('none');
                            // sync canonical balance in background
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
              disabled={loading || !selectedRepId || !selectedTreasuryId}
              className="mt-5 w-full bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed text-slate-900 font-black py-3 rounded-2xl transition-colors"
            >
              تأكيد التقفيل وإغلاق اليومية
            </button>
          </div>
        </div>

        {/* Right column: Orders lists */}
        <div className="lg:col-span-2 rounded-3xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4 text-slate-900 dark:text-white font-black">
            <div className="text-lg">قوائم الاوردرات</div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm font-bold">الاوردرات الحالية مع المندوب</div>
                <div className="flex items-center gap-2">
                  <button onClick={toggleSelectAllLocal} className="px-3 py-1 rounded-lg bg-slate-100 text-xs">تحديد الكل</button>
                  <button onClick={markSelectedDelivered} className="px-3 py-1 rounded-lg bg-emerald-500 text-white text-xs">تم تسليم المحدد</button>
                  <button onClick={moveSelectedToDeferred} className="px-3 py-1 rounded-lg bg-amber-500 text-white text-xs">تم نزول المحدد</button>
                </div>
              </div>
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {repOrders.length === 0 ? <div className="text-xs text-slate-400">لا توجد اوردرات.</div> : repOrders.map((o:any) => (
                  <div key={o.id} className="flex items-center justify-between border rounded-lg p-2">
                    <div className="flex items-center gap-3">
                      <input type="checkbox" checked={selectedOrderIdsLocal.includes(o.id)} onChange={()=>toggleSelectOrderLocal(o.id)} className="w-4 h-4" />
                      <div className="text-sm">#{o.orderNumber||o.order_number} — {o.customerName||o.customer_name||o.name}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => moveSingleToDeferred(o)} className="px-2 py-1 text-xs rounded bg-amber-400 text-white">نزول</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <div className="text-sm font-bold mb-2">الاوردرات المؤجّلة</div>
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {deferredOrders.length === 0 ? <div className="text-xs text-slate-400">لا توجد اوردرات مؤجلة.</div> : deferredOrders.map((o:any) => (
                  <div key={o.id} className="flex items-center justify-between border rounded-lg p-2">
                    <div className="text-sm">#{o.orderNumber||o.order_number} — {o.customerName||o.customer_name||o.name}</div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => moveDeferredBack(o)} className="px-2 py-1 text-xs rounded bg-slate-200">ارجاع</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* النافذة المنبثقة لعرض قوائم الاوردرات (مسلم، مرتجع، مؤجل) */}
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
                        <th className="p-3 font-bold text-center">القطع</th>
                        <th className="p-3 font-bold rounded-l-xl">القيمة</th>
                      </tr>
                    </thead>
                    <tbody>
                      {list.map((o: any) => (
                        <tr key={o.id} className="border-b border-slate-50 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                          <td className="p-3 font-black text-slate-900 dark:text-white">#{o.orderNumber || o.order_number || o.id}</td>
                          <td className="p-3 text-slate-700 dark:text-slate-300">{o.customerName || o.customer_name || o.name || '—'}</td>
                          <td className="p-3 text-center text-slate-600 dark:text-slate-400">{computePieces(o)}</td>
                          <td className="p-3 font-bold text-emerald-600 dark:text-emerald-400">{money(computeOrderValue(o))} {currencySymbol}</td>
                        </tr>
                      ))}
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