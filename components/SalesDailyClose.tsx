import React, { useEffect, useMemo, useState } from 'react';
import Swal from 'sweetalert2';
import { API_BASE_PATH } from '../services/apiConfig';
import { User, Wallet, PackageCheck, PackageX, CheckCircle2, RefreshCw } from 'lucide-react';
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

  // CRITICAL: this is fetched from DB and treated as the exact current debt/balance.
  const [repBalance, setRepBalance] = useState<number>(0);

  const [paidAmount, setPaidAmount] = useState<number>(0);
  const [settlementDirection, setSettlementDirection] = useState<'collect'|'pay'>('collect');

  const [repStats, setRepStats] = useState<RepStats>({
    deliveredCount: 0,
    deliveredValue: 0,
    returnedCount: 0,
    returnedValue: 0
  });

  // Orders UI states for the new split box
  const [repOrders, setRepOrders] = useState<any[]>([]);
  const [deferredOrders, setDeferredOrders] = useState<any[]>([]);
  const [selectedOrderIdsLocal, setSelectedOrderIdsLocal] = useState<number[]>([]);

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

  const loadRepDailyStats = async (repId: string) => {
    if (!repId) return;
    setStatsLoading(true);
    try {
      const url = `${API_BASE_PATH}/api.php?module=sales&action=getRepDailyStats&rep_id=${encodeURIComponent(repId)}`;
      const r = await fetch(url);
      const j = await r.json();

      if (j && j.success) {
        const d = j.data || {};
        setRepStats({
          deliveredCount: toNum(d.deliveredCount ?? d.delivered_orders_count ?? 0),
          deliveredValue: toNum(d.deliveredValue ?? d.delivered_orders_value ?? 0),
          returnedCount: toNum(d.returnedCount ?? d.returned_orders_count ?? 0),
          returnedValue: toNum(d.returnedValue ?? d.returned_orders_value ?? 0)
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
      setSelectedOrderIdsLocal([]);
      return;
    }

    const rep = reps.find(r => String(r.id) === String(selectedRepId));
    const bal = toNum(rep?.balance ?? 0);
    setRepBalance(bal);
    setPaidAmount(Math.max(0, -bal));
    loadRepDailyStats(selectedRepId);
    // load orders for this rep (client-side filter)
    (async () => {
      try {
        const r = await fetch(`${API_BASE_PATH}/api.php?module=orders&action=getAll`);
        const jr = await r.json();
        const all = (jr && jr.success && Array.isArray(jr.data)) ? jr.data : [];
        // Filter by rep and exclude delivered/returned statuses
        const mine = all.filter((o:any) => String(o.rep_id || o.repId || o.assigned_rep || '') === String(selectedRepId));
        const notDelivered = mine.filter((o:any) => !['delivered','returned'].includes(String(o.status)));
        // By default deferredOrders are those with status 'pending' or 'delayed'
        const deferred = notDelivered.filter((o:any) => ['pending','delayed','postponed'].includes(String(o.status)));
        const active = notDelivered.filter(o => !deferred.includes(o));
        setRepOrders(active);
        setDeferredOrders(deferred);
        setSelectedOrderIdsLocal(active.map((o:any)=>o.id));
      } catch (e) {
        console.error('Failed to load orders for rep', e);
        setRepOrders([]);
        setDeferredOrders([]);
        setSelectedOrderIdsLocal([]);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRepId]);

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
    if (ids.length === 0) { Swal.fire('تحذير','اختر طلبيات أولاً','warning'); return; }
    try {
      setLoading(true);
      await Promise.all(ids.map(id => fetch(`${API_BASE_PATH}/api.php?module=orders&action=update`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ id, status: 'delivered' }) })));
      // remove from lists
      setRepOrders(prev => prev.filter((o:any)=> !ids.includes(o.id)));
      setDeferredOrders(prev => prev.filter((o:any)=> !ids.includes(o.id)));
      setSelectedOrderIdsLocal([]);
      await loadRepDailyStats(selectedRepId);
      Swal.fire('تم', 'تم تحديث حالة الطلبيات المحددة إلى تم التسليم.', 'success');
    } catch (e) {
      console.error(e); Swal.fire('خطأ','فشل تحديث حالة الطلبيات.','error');
    } finally { setLoading(false); }
  };

  const moveSelectedToDeferred = async () => {
    const ids = selectedOrderIdsLocal.slice();
    if (ids.length === 0) { Swal.fire('تحذير','اختر طلبيات أولاً','warning'); return; }
    try {
      setLoading(true);
      await Promise.all(ids.map(id => fetch(`${API_BASE_PATH}/api.php?module=orders&action=update`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ id, status: 'pending' }) })));
      // move locally
      setDeferredOrders(prev => [...prev, ...(repOrders.filter((o:any)=> ids.includes(o.id)))]);
      setRepOrders(prev => prev.filter((o:any)=> !ids.includes(o.id)));
      setSelectedOrderIdsLocal([]);
      Swal.fire('تم', 'تم نقل الطلبيات المحددة إلى المؤجلة.', 'success');
    } catch (e) { console.error(e); Swal.fire('خطأ','فشل نقل الطلبيات.','error'); }
    finally { setLoading(false); }
  };

  const moveSingleToDeferred = async (order:any) => {
    try {
      setLoading(true);
      await fetch(`${API_BASE_PATH}/api.php?module=orders&action=update`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ id: order.id, status: 'pending' }) });
      setDeferredOrders(prev => [...prev, order]);
      setRepOrders(prev => prev.filter((o:any)=> o.id !== order.id));
      setSelectedOrderIdsLocal(prev => prev.filter(x=> x !== order.id));
    } catch (e) { console.error(e); Swal.fire('خطأ','فشل نقل الطلبيه.','error'); }
    finally { setLoading(false); }
  };

  const moveDeferredBack = async (order:any) => {
    try {
      setLoading(true);
      await fetch(`${API_BASE_PATH}/api.php?module=orders&action=update`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ id: order.id, status: 'with_rep' }) });
      setRepOrders(prev => [...prev, order]);
      setDeferredOrders(prev => prev.filter((o:any)=> o.id !== order.id));
    } catch (e) { console.error(e); Swal.fire('خطأ','فشل استرجاع الطلبيه.','error'); }
    finally { setLoading(false); }
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
          <div><b>المديونية الحالية (من قاعدة البيانات):</b> ${money(repBalance)} ${currencySymbol} <span>(${balanceLabel(repBalance)})</span></div>
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
      if (settlementDirection === 'collect') {
        // existing settleDaily flow (collect from rep)
        const payload = { repId: Number(selectedRepId), treasuryId: Number(selectedTreasuryId), paidAmount: amount };
        const r = await fetch(`${API_BASE_PATH}/api.php?module=sales&action=settleDaily`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
        });
        const j = await r.json();
        if (j && j.success) {
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
          details: { action: 'settleDaily', rep_id: Number(selectedRepId), model: 'consignment' }
        };
        const r2 = await fetch(`${API_BASE_PATH}/api.php?module=transactions&action=create`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(txPayload)
        });
        const j2 = await r2.json();
        if (j2 && j2.success) {
          Swal.fire('تم', 'تم دفع المبلغ إلى المندوب وتسجيل المعاملة.', 'success');
        } else {
          Swal.fire('فشل العملية', j2?.message || 'تعذر تسجيل عملية الدفع.', 'error');
        }
      }

      // Refresh canonical balance and stats after either operation
      await Promise.all([refreshSelectedRepBalanceFromServer(selectedRepId), loadRepDailyStats(selectedRepId)]);
    } catch (e) {
      console.error('Settle daily failed', e);
      Swal.fire('خطأ', 'فشل الاتصال بالخادم أثناء تنفيذ التقفيل.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 space-y-5" dir="rtl">
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
                if (selectedRepId) await Promise.all([refreshSelectedRepBalanceFromServer(selectedRepId), loadRepDailyStats(selectedRepId)]);
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <div className="rounded-3xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs text-slate-500 dark:text-slate-400">المديونية الحالية</div>
              <div className={`mt-2 text-2xl font-black ${balanceClass(repBalance)}`}>
                {money(repBalance)} <span className="text-sm font-bold text-slate-500">{currencySymbol}</span>
              </div>
              <div className="mt-1 text-[11px] text-slate-400">({balanceLabel(repBalance)}) — من قاعدة البيانات</div>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
              <Wallet className="text-slate-700 dark:text-slate-200" />
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs text-slate-500 dark:text-slate-400">إجمالي تسليم اليوم</div>
              <div className="mt-2 text-2xl font-black text-emerald-600">
                {statsLoading ? '...' : String(repStats.deliveredCount)} <span className="text-sm font-bold text-slate-500">طلب</span>
              </div>
              <div className="mt-1 text-[11px] text-slate-400">
                القيمة: {statsLoading ? '...' : money(repStats.deliveredValue)} {currencySymbol} (للعرض فقط)
              </div>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center">
              <PackageCheck className="text-emerald-700 dark:text-emerald-300" />
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs text-slate-500 dark:text-slate-400">إجمالي مرتجع اليوم</div>
              <div className="mt-2 text-2xl font-black text-rose-600">
                {statsLoading ? '...' : String(repStats.returnedCount)} <span className="text-sm font-bold text-slate-500">طلب</span>
              </div>
              <div className="mt-1 text-[11px] text-slate-400">
                القيمة: {statsLoading ? '...' : money(repStats.returnedValue)} {currencySymbol} (للعرض فقط)
              </div>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-900/20 flex items-center justify-center">
              <PackageX className="text-rose-700 dark:text-rose-300" />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left column: بيانات التقفيل (top) and تأكيد التقفيل (bottom) */}
        <div className="lg:col-span-1 space-y-4">
          <div className="rounded-3xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-4 text-slate-900 dark:text-white font-black">
              <User className="w-5 h-5 text-blue-600" />
              بيانات التقفيل
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40 p-4">
                <div className="text-xs text-slate-500 mb-2">اختر المندوب</div>
                <CustomSelect
                  value={selectedRepId}
                  onChange={v => setSelectedRepId(v)}
                  options={reps.map(r => ({ value: String(r.id), label: r.name }))}
                  placeholder="— اختر —"
                  disabled={loading}
                />
                <div className="mt-2 text-[11px] text-slate-400">
                  يتم تحميل رصيد/مديونية المندوب مباشرة من <span className="font-bold">balance</span>.
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40 p-4">
                <div className="text-xs text-slate-500 mb-2">اختر الخزينة</div>
                <CustomSelect
                  value={selectedTreasuryId}
                  onChange={v => setSelectedTreasuryId(v)}
                  options={treasuries.map(t => ({ value: String(t.id), label: t.name }))}
                  placeholder="— اختر —"
                  disabled={loading || !canChangeTreasury}
                />
                {!canChangeTreasury && <div className="mt-2 text-[11px] text-slate-400">الخزينة مثبتة حسب صلاحيات المستخدم.</div>}
              </div>

              <div className="md:col-span-2 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/30 p-4">
                <div className="text-xs text-slate-500 mb-2">المبلغ المدفوع للتقفيل</div>
                <div className="flex items-center gap-3 mb-2">
                  <label className="text-xs text-slate-500">طريقة التسوية:</label>
                  <label className="inline-flex items-center gap-2 text-xs">
                    <input type="radio" name="settle_dir" checked={settlementDirection==='collect'} onChange={()=>setSettlementDirection('collect')} />
                    <span>تحصيل من المندوب</span>
                  </label>
                  <label className="inline-flex items-center gap-2 text-xs">
                    <input type="radio" name="settle_dir" checked={settlementDirection==='pay'} onChange={()=>setSettlementDirection('pay')} />
                    <span>دفع إلى المندوب</span>
                  </label>
                </div>
                <input
                  type="number"
                  min={0}
                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl px-3 py-3 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-emerald-200 dark:focus:ring-emerald-500/30"
                  value={paidAmount}
                  onChange={e => setPaidAmount(Math.max(0, toNum(e.target.value)))}
                  disabled={loading || !selectedRepId}
                />
                <div className="mt-2 text-[11px] text-slate-400">
                  القيمة الافتراضية = مديونية المندوب الحالية (balance) — ويمكن تعديلها حسب ما تم استلامه فعلياً.
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
                <span className="font-black">{money(paidAmount)} {currencySymbol}</span>
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
            <div className="text-lg">قوائم الطلبيات</div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm font-bold">الطلبيات الحالية مع المندوب</div>
                <div className="flex items-center gap-2">
                  <button onClick={toggleSelectAllLocal} className="px-3 py-1 rounded-lg bg-slate-100 text-xs">تحديد الكل</button>
                  <button onClick={markSelectedDelivered} className="px-3 py-1 rounded-lg bg-emerald-500 text-white text-xs">تم تسليم المحدد</button>
                  <button onClick={moveSelectedToDeferred} className="px-3 py-1 rounded-lg bg-amber-500 text-white text-xs">تم نزول المحدد</button>
                </div>
              </div>
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {repOrders.length === 0 ? <div className="text-xs text-slate-400">لا توجد طلبيات.</div> : repOrders.map((o:any) => (
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
              <div className="text-sm font-bold mb-2">الطلبيات المؤجّلة</div>
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {deferredOrders.length === 0 ? <div className="text-xs text-slate-400">لا توجد طلبيات مؤجلة.</div> : deferredOrders.map((o:any) => (
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
    </div>
  );
};

export default SalesDailyClose;
