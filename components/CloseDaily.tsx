import React, { useState, useEffect } from 'react';
import Swal from 'sweetalert2';
import { API_BASE_PATH } from '../services/apiConfig';

const CloseDaily: React.FC = () => {
  useEffect(() => {
    try { console.debug('CloseDaily component mounted'); } catch(e) {}
  }, []);
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<any>(null);
  const [date, setDate] = useState(() => new Date().toISOString().slice(0,10));
  // Period summary state
  // default period: last 7 days
  const defaultEnd = new Date();
  const defaultStart = new Date(); defaultStart.setDate(defaultEnd.getDate() - 6);
  const [periodStart, setPeriodStart] = useState(() => defaultStart.toISOString().slice(0,10));
  const [periodEnd, setPeriodEnd] = useState(() => defaultEnd.toISOString().slice(0,10));
  const [periodSummary, setPeriodSummary] = useState<any>(null);
  const [periodLoading, setPeriodLoading] = useState(false);

  useEffect(() => {
    fetchSummary();
  }, [date]);

  useEffect(() => {
    fetchPeriodSummary();
  }, [periodStart, periodEnd]);

  const fetchSummary = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_PATH}/api.php?module=reports&action=finance&date=${date}`);
      const js = await res.json();
      setSummary(js.success ? js.data : null);
    } catch (e) {
      setSummary(null);
    } finally {
      setLoading(false);
    }
  };

  const handleCloseDaily = async () => {
    const r = await Swal.fire({
      title: 'تأكيد إغلاق اليومية',
      text: 'سيتم إغلاق اليومية وتسجيل جميع الحركات المالية لهذا اليوم. هل أنت متأكد؟',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'نعم، إغلاق',
      cancelButtonText: 'إلغاء'
    });
    if (!r.isConfirmed) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_PATH}/api.php?module=sales&action=closeDaily`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date })
      });
      const js = await res.json();
      if (js.success) {
        Swal.fire('تم الإغلاق', 'تم إغلاق اليومية بنجاح.', 'success');
        fetchSummary();
      } else {
        Swal.fire('فشل الإغلاق', js.message || 'حدث خطأ أثناء الإغلاق.', 'error');
      }
    } catch (e) {
      Swal.fire('خطأ', 'فشل الاتصال بالخادم.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchPeriodSummary = async () => {
    setPeriodLoading(true);
    try {
      const res = await fetch(`${API_BASE_PATH}/api.php?module=reports&action=finance&start_date=${periodStart}&end_date=${periodEnd}`);
      const js = await res.json();
      if (!js.success) { setPeriodSummary(null); return; }
      const data = js.data || {};
      // compute totals from revenueAndExpenseRecords
      const recs = Array.isArray(data.revenueAndExpenseRecords) ? data.revenueAndExpenseRecords : [];
      let totalReceived = 0, totalPaid = 0, net = 0;
      for (const r of recs) {
        const amt = Number(r.amount || 0);
        if (amt >= 0) totalReceived += amt; else totalPaid += Math.abs(amt);
        net += amt;
      }
      const opening = Number(data.starting_balance || 0);
      const current = opening + net;
      setPeriodSummary({ opening_balance: opening, total_received: totalReceived, total_paid: totalPaid, current_balance: current, returned_orders: data.returned_orders || { total: 0, full: 0, partial: 0 }, returned_pieces: Number(data.returned_pieces || 0) });
    } catch (e) {
      setPeriodSummary(null);
    } finally {
      setPeriodLoading(false);
    }
  };

  const setPresetRange = (preset: 'today'|'week'|'month'|'year') => {
    const now = new Date();
    const fmt = (d:Date) => d.toISOString().slice(0,10);
    if (preset === 'today') {
      setPeriodStart(fmt(now)); setPeriodEnd(fmt(now));
    } else if (preset === 'week') {
      const start = new Date(now); start.setDate(now.getDate() - 6); setPeriodStart(fmt(start)); setPeriodEnd(fmt(now));
    } else if (preset === 'month') {
      const start = new Date(now.getFullYear(), now.getMonth(), 1); setPeriodStart(fmt(start)); setPeriodEnd(fmt(now));
    } else if (preset === 'year') {
      const start = new Date(now.getFullYear(), 0, 1); setPeriodStart(fmt(start)); setPeriodEnd(fmt(now));
    }
  };

  return (
    <div className="p-6">
      <h2 className="font-black text-2xl mb-4">إغلاق اليومية — لوحة التحكم</h2>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="p-4 rounded-xl bg-white dark:bg-slate-800 shadow-sm border">
          <div className="text-xs text-muted">التاريخ المحدد</div>
          <div className="mt-2 flex items-center gap-2">
            <input type="date" value={date} onChange={e=>setDate(e.target.value)} className="border p-2 rounded" />
            <button onClick={fetchSummary} className="px-3 py-2 bg-blue-600 text-white rounded">تحديث</button>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 shadow-sm text-right">
          <div className="text-xs text-muted">رصيد الافتتاح</div>
          <div className="font-black text-lg mt-1">{loading ? '...' : Number(summary?.opening_balance||0).toLocaleString()} ج.م</div>
        </div>

        <div className="p-4 rounded-xl bg-blue-50 border border-blue-200 shadow-sm text-right">
          <div className="text-xs text-muted">إجمالي المقبوضات</div>
          <div className="font-black text-lg mt-1">{loading ? '...' : Number(summary?.total_received||0).toLocaleString()} ج.م</div>
        </div>

        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 shadow-sm text-right">
          <div className="text-xs text-muted">إجمالي المدفوعات</div>
          <div className="font-black text-lg mt-1">{loading ? '...' : Number(summary?.total_paid||0).toLocaleString()} ج.م</div>
        </div>
      </div>

      <div className="mb-6">
        <h3 className="font-bold mb-2">ملخص الفترة</h3>
        <div className="border rounded p-4 bg-white shadow-sm">
          <div className="mb-3 flex items-center gap-3">
            <div className="text-xs text-muted">من</div>
            <input type="date" value={periodStart} onChange={e=>setPeriodStart(e.target.value)} className="border p-2 rounded" />
            <div className="text-xs text-muted">إلى</div>
            <input type="date" value={periodEnd} onChange={e=>setPeriodEnd(e.target.value)} className="border p-2 rounded" />
            <div className="ml-4 flex gap-2">
              <button onClick={()=>setPresetRange('today')} className="px-3 py-2 bg-slate-100 rounded">اليوم</button>
              <button onClick={()=>setPresetRange('week')} className="px-3 py-2 bg-slate-100 rounded">الأسبوع</button>
              <button onClick={()=>setPresetRange('month')} className="px-3 py-2 bg-slate-100 rounded">الشهر</button>
              <button onClick={()=>setPresetRange('year')} className="px-3 py-2 bg-slate-100 rounded">السنة</button>
            </div>
            <div className="ml-auto">
              <button onClick={fetchPeriodSummary} className="px-3 py-2 bg-blue-600 text-white rounded">تحديث</button>
            </div>
          </div>
          {loading ? (
            <div className="text-sm text-slate-500">جاري تحميل بيانات الفترة...</div>
          ) : periodSummary ? (
            <div className="text-sm">
              <p className="mb-1"><span className="text-muted">الرصيد الافتتاحي:</span> <span className="font-bold">{Number(periodSummary.opening_balance||0).toLocaleString()} ج.م</span></p>
              <p className="mb-1"><span className="text-muted">المقبوضات:</span> <span className="font-bold text-emerald-600">{Number(periodSummary.total_received||0).toLocaleString()} ج.م</span></p>
              <p className="mb-1"><span className="text-muted">المدفوعات:</span> <span className="font-bold text-rose-600">{Number(periodSummary.total_paid||0).toLocaleString()} ج.م</span></p>
              <p className="mb-1"><span className="text-muted">الرصيد الحالي:</span> <span className="font-black">{Number(periodSummary.current_balance||0).toLocaleString()} ج.م</span></p>
              <p className="mb-1"><span className="text-muted">عدد الأوردرات المرتجعة:</span> <span className="font-bold">{Number(periodSummary.returned_orders?.total||0).toLocaleString()}</span></p>
              <p className="mb-1"><span className="text-muted">إجمالي القطع المرتجعة:</span> <span className="font-bold">{Number(periodSummary.returned_pieces||0).toLocaleString()}</span></p>
            </div>
          ) : (
            <div className="text-sm text-slate-500">لا توجد بيانات لفترة العرض.</div>
          )}
        </div>
      </div>

      <div className="mb-6">
        <h3 className="font-bold mb-2">معلومات الإغلاق</h3>
        <div className="border rounded p-4 bg-white shadow-sm">
          {loading ? (
            <div className="text-sm text-slate-500">جاري تحميل بيانات الإغلاق...</div>
          ) : summary ? (
            <div className="text-sm">
              <p className="mb-1"><span className="text-muted">الرصيد الافتتاحي:</span> <span className="font-bold">{Number(summary.opening_balance||0).toLocaleString()} ج.م</span></p>
              <p className="mb-1"><span className="text-muted">المقبوضات:</span> <span className="font-bold text-emerald-600">{Number(summary.total_received||0).toLocaleString()} ج.م</span></p>
              <p className="mb-1"><span className="text-muted">المدفوعات:</span> <span className="font-bold text-rose-600">{Number(summary.total_paid||0).toLocaleString()} ج.م</span></p>
              <p className="mb-1"><span className="text-muted">الرصيد الحالي:</span> <span className="font-black">{Number(summary.current_balance||0).toLocaleString()} ج.م</span></p>
              <p className="mb-1"><span className="text-muted">عدد الأوردرات المرتجعة:</span> <span className="font-bold">{Number(summary.returned_orders?.total||0).toLocaleString()}</span></p>
              {summary.returned_orders && (summary.returned_orders.full || summary.returned_orders.partial) ? (
                <p className="mb-1"><span className="text-muted">تفصيل المرتجعات:</span> <span className="font-bold">كامل {Number(summary.returned_orders.full||0).toLocaleString()} — جزئي {Number(summary.returned_orders.partial||0).toLocaleString()}</span></p>
              ) : null}
              <p className="mb-1"><span className="text-muted">إجمالي القطع المرتجعة:</span> <span className="font-bold">{Number(summary.returned_pieces||0).toLocaleString()}</span></p>
              <div className="mt-3">
                <button onClick={handleCloseDaily} className="px-5 py-3 bg-emerald-600 text-white rounded-xl font-black shadow-lg">تنفيذ إغلاق اليومية</button>
                <button onClick={() => { if (summary) { const csv = `التاريخ,${date}\nرصيد الافتتاح,${summary.opening_balance || 0}\nالمقبوضات,${summary.total_received || 0}\nالمدفوعات,${summary.total_paid || 0}\nالرصيد الحالي,${summary.current_balance || 0}`; const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `close_daily_${date}.csv`; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url); } }} className="mx-2 px-4 py-3 bg-slate-100 rounded-xl">تصدير CSV</button>
              </div>
            </div>
          ) : (
            <div className="text-sm text-slate-500">لا توجد بيانات لعرضها في هذا التاريخ.</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CloseDaily;
