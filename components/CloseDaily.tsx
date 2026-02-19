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

  useEffect(() => {
    fetchSummary();
  }, [date]);

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
