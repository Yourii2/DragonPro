import React, { useState, useEffect } from 'react';
import { UserCheck, RefreshCw } from 'lucide-react';
import Swal from 'sweetalert2';
import { API_BASE_PATH } from '../services/apiConfig';
import { useTheme } from './ThemeContext';

interface ReportRepPerformanceProps {
  initialStartDate?: string;
  initialEndDate?: string;
}

const ReportRepPerformance: React.FC<ReportRepPerformanceProps> = ({ initialStartDate, initialEndDate }) => {
  const { isDark } = useTheme();
  const currencySymbol = localStorage.getItem('Dragon_currency') || 'ج.م';
  
  const today = new Date();
  const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const [startDate, setStartDate] = useState(initialStartDate || firstDayOfMonth.toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(initialEndDate || today.toISOString().split('T')[0]);

  const [repStats, setRepStats] = useState<any[]>([]);
  const [totals, setTotals] = useState<any>({});
  const [loading, setLoading] = useState(false);
  const [sortKey, setSortKey] = useState<string>('delivered_orders');
  const [sortAsc, setSortAsc] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const url = `${API_BASE_PATH}/api.php?module=reports&action=getOrderStats&start_date=${startDate}&end_date=${endDate}`;
      const res = await fetch(url).then(r => r.json()).catch(() => null);
      if (res && res.success) {
        setRepStats(res.data.rep_stats || []);
        setTotals(res.data.totals || {});
      } else {
        setRepStats([]); setTotals({});
        Swal.fire('تنبيه', 'لا توجد بيانات لهذه الفترة.', 'info');
      }
    } catch { Swal.fire('خطأ', 'فشل تحميل بيانات المناديب.', 'error'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [startDate, endDate]);

  const sorted = [...repStats].sort((a, b) => {
    if (sortKey === 'name') {
      const aVal = String(a.name || '');
      const bVal = String(b.name || '');
      return sortAsc ? aVal.localeCompare(bVal, 'ar') : bVal.localeCompare(aVal, 'ar');
    }
    if (sortKey === 'success_rate') {
      const aTot = (a.delivered_orders || 0) + (a.returned_orders || 0);
      const bTot = (b.delivered_orders || 0) + (b.returned_orders || 0);
      const aRate = aTot > 0 ? (a.delivered_orders || 0) / aTot : 0;
      const bRate = bTot > 0 ? (b.delivered_orders || 0) / bTot : 0;
      return sortAsc ? aRate - bRate : bRate - aRate;
    }
    if (sortKey === 'total_orders') {
      const aVal = (a.delivered_orders || 0) + (a.returned_orders || 0);
      const bVal = (b.delivered_orders || 0) + (b.returned_orders || 0);
      return sortAsc ? aVal - bVal : bVal - aVal;
    }
    if (sortKey === 'total_pieces') {
      const aVal = (a.delivered_pieces || 0) + (a.returned_pieces || 0);
      const bVal = (b.delivered_pieces || 0) + (b.returned_pieces || 0);
      return sortAsc ? aVal - bVal : bVal - aVal;
    }
    const aVal = Number(a[sortKey] || 0);
    const bVal = Number(b[sortKey] || 0);
    return sortAsc ? aVal - bVal : bVal - aVal;
  });

  const handleSort = (key: string) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(false); }
  };

  const SortTh = ({ col, label, align = 'right' }: { col: string; label: string; align?: 'center' | 'right' | 'left' }) => (
    <th
      className={`px-4 py-3 font-semibold cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors select-none text-${align} group`}
      onClick={() => handleSort(col)}
      title="اضغط للفرز تصاعدي / تنازلي"
    >
      <div className={`flex items-center gap-1 ${align === 'center' ? 'justify-center' : align === 'right' ? 'justify-start' : 'justify-end'}`}>
        <span>{label}</span>
        <span className="text-xs text-slate-400 group-hover:text-blue-600 transition-colors">
          {sortKey === col ? (sortAsc ? '▲' : '▼') : '↕'}
        </span>
      </div>
    </th>
  );

  const exportCSV = () => {
    if (!repStats.length) { Swal.fire('تنبيه', 'لا توجد بيانات.', 'info'); return; }
    const headers = ['المندوب','إجمالي أوردرات','أوردرات مسلَّمة','أوردرات مرتجعة','إجمالي قطع','قطع مسلَّمة','قطع مرتجعة','معدل النجاح'];
    const rows = sorted.map(r => {
      const totO = (r.delivered_orders || 0) + (r.returned_orders || 0);
      const totP = (r.delivered_pieces || 0) + (r.returned_pieces || 0);
      const rate = totO > 0 ? Math.round(((r.delivered_orders || 0) / totO) * 100) : 0;
      return [r.name || '', totO, r.delivered_orders || 0, r.returned_orders || 0, totP, r.delivered_pieces || 0, r.returned_pieces || 0, `${rate}%`];
    });
    const csv = [headers.join(','), ...rows.map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(','))].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `reps_perf_${startDate}_to_${endDate}.csv`;
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  };

  const printReport = () => {
    const totOAll = (totals.delivered_orders || 0) + (totals.returned_orders || 0);
    const totPAll = (totals.delivered_pieces || 0) + (totals.returned_pieces || 0);
    const rows = sorted.map((r, i) => {
      const totO = (r.delivered_orders || 0) + (r.returned_orders || 0);
      const totP = (r.delivered_pieces || 0) + (r.returned_pieces || 0);
      const rate = totO > 0 ? Math.round(((r.delivered_orders || 0) / totO) * 100) : 0;
      return `<tr>
        <td>${i+1}</td><td>${r.name||'—'}</td>
        <td>${totO}</td><td>${r.delivered_orders||0}</td><td>${r.returned_orders||0}</td>
        <td>${totP}</td><td>${r.delivered_pieces||0}</td><td>${r.returned_pieces||0}</td>
        <td>${rate}%</td>
      </tr>`;
    }).join('');
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>أداء المناديب ${startDate} - ${endDate}</title>
      <style>body{font-family:Arial,"Noto Naskh Arabic",sans-serif;direction:rtl;padding:20px;} table{width:100%;border-collapse:collapse;font-size:12px;} th,td{border:1px solid #333;padding:5px;text-align:right;} th{background:#f3f4f6;} .kpi{display:inline-block;padding:8px 16px;margin:4px;background:#f8f9fa;border-radius:8px;border:1px solid #ddd;}</style>
      </head><body>
      <h1 style="text-align:center">تقرير أداء المناديب</h1>
      <div style="text-align:center;color:#666;">الفترة: ${startDate} — ${endDate}</div>
      <div style="margin:16px 0;display:flex;gap:12px;justify-content:center;">
        <div class="kpi"><strong>إجمالي الأوردرات: ${totOAll}</strong> (مسلَّمة: ${totals.delivered_orders||0} | مرتجعة: ${totals.returned_orders||0})</div>
        <div class="kpi"><strong>إجمالي القطع: ${totPAll}</strong> (مسلَّمة: ${totals.delivered_pieces||0} | مرتجعة: ${totals.returned_pieces||0})</div>
      </div>
      <table><thead><tr><th>#</th><th>المندوب</th><th>إجمالي الأوردرات</th><th>مسلَّمة</th><th>مرتجعة</th><th>إجمالي القطع</th><th>قطع مسلَّمة</th><th>قطع مرتجعة</th><th>معدل النجاح</th></tr></thead>
      <tbody>${rows}</tbody></table>
      </body></html>`;
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(html); w.document.close();
    setTimeout(() => w.print(), 500);
  };

  const MEDALS = ['🥇','🥈','🥉'];
  const totOrders = (totals.delivered_orders || 0) + (totals.returned_orders || 0);
  const totPieces = (totals.delivered_pieces || 0) + (totals.returned_pieces || 0);

  return (
    <div className="space-y-5">
      {/* Controls */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 flex flex-wrap gap-3 items-center justify-between shadow-sm">
        <div className="flex items-center gap-2">
          <UserCheck className="text-blue-600 dark:text-blue-400" size={20} />
          <span className="text-base font-black text-slate-800 dark:text-slate-100">تقرير أداء المناديب</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
            className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl py-2 px-3 text-xs font-bold" />
          <span className="text-slate-400">—</span>
          <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
            className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl py-2 px-3 text-xs font-bold" />
          <button onClick={load} disabled={loading}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold disabled:opacity-60 transition">
            {loading ? 'تحميل...' : 'تحديث'}
          </button>
          <button onClick={exportCSV} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition">CSV</button>
          <button onClick={printReport} className="px-4 py-2 bg-slate-700 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition">طباعة</button>
        </div>
      </div>

      {/* 2 Main KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Card 1: Total Orders */}
        <div className="p-5 rounded-3xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700/60 pb-3">
            <span className="text-sm font-bold text-slate-500 dark:text-slate-400">إجمالي الأوردرات</span>
            <span className="text-2xl font-black text-slate-900 dark:text-white">{totOrders.toLocaleString()}</span>
          </div>
          <div className="grid grid-cols-2 gap-3 pt-3">
            <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/40 rounded-2xl p-3 text-right">
              <div className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 mb-0.5">مسلَّمة</div>
              <div className="text-xl font-black text-emerald-700 dark:text-emerald-300">{(totals.delivered_orders || 0).toLocaleString()}</div>
            </div>
            <div className="bg-rose-50 dark:bg-rose-950/30 border border-rose-100 dark:border-rose-900/40 rounded-2xl p-3 text-right">
              <div className="text-xs font-semibold text-rose-600 dark:text-rose-400 mb-0.5">مرتجعة</div>
              <div className="text-xl font-black text-rose-700 dark:text-rose-300">{(totals.returned_orders || 0).toLocaleString()}</div>
            </div>
          </div>
        </div>

        {/* Card 2: Total Pieces */}
        <div className="p-5 rounded-3xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700/60 pb-3">
            <span className="text-sm font-bold text-slate-500 dark:text-slate-400">إجمالي القطع</span>
            <span className="text-2xl font-black text-slate-900 dark:text-white">{totPieces.toLocaleString()}</span>
          </div>
          <div className="grid grid-cols-2 gap-3 pt-3">
            <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/40 rounded-2xl p-3 text-right">
              <div className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 mb-0.5">مسلَّمة</div>
              <div className="text-xl font-black text-emerald-700 dark:text-emerald-300">{(totals.delivered_pieces || 0).toLocaleString()}</div>
            </div>
            <div className="bg-rose-50 dark:bg-rose-950/30 border border-rose-100 dark:border-rose-900/40 rounded-2xl p-3 text-right">
              <div className="text-xs font-semibold text-rose-600 dark:text-rose-400 mb-0.5">مرتجعة</div>
              <div className="text-xl font-black text-rose-700 dark:text-rose-300">{(totals.returned_pieces || 0).toLocaleString()}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-700 flex items-center gap-2">
          <UserCheck size={16} className="text-blue-500" />
          <span className="font-black text-slate-800 dark:text-slate-100">تفاصيل أداء المناديب</span>
          <span className="text-xs text-slate-400 mr-2">({repStats.length} مندوب)</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-right">
            <thead className="bg-slate-50 dark:bg-slate-900/30 text-slate-500 dark:text-slate-400">
              <tr>
                <th className="px-4 py-3 font-semibold text-center w-12">#</th>
                <SortTh col="name" label="المندوب" align="right" />
                <SortTh col="total_orders" label="إجمالي أوردرات" align="center" />
                <SortTh col="delivered_orders" label="أوردرات مسلَّمة" align="center" />
                <SortTh col="returned_orders" label="أوردرات مرتجعة" align="center" />
                <SortTh col="total_pieces" label="إجمالي قطع" align="center" />
                <SortTh col="delivered_pieces" label="قطع مسلَّمة" align="center" />
                <SortTh col="returned_pieces" label="قطع مرتجعة" align="center" />
                <SortTh col="success_rate" label="معدل النجاح" align="center" />
              </tr>
            </thead>
            <tbody className="divide-y dark:divide-slate-700">
              {loading ? (
                <tr><td colSpan={9} className="py-10 text-center text-slate-400">جارٍ التحميل...</td></tr>
              ) : sorted.length === 0 ? (
                <tr><td colSpan={9} className="py-10 text-center text-slate-400">لا توجد بيانات مناديب في هذه الفترة.</td></tr>
              ) : sorted.map((r: any, i: number) => {
                const totO = (r.delivered_orders || 0) + (r.returned_orders || 0);
                const totP = (r.delivered_pieces || 0) + (r.returned_pieces || 0);
                const successRate = totO > 0
                  ? Math.round(((r.delivered_orders || 0) / totO) * 100)
                  : 0;
                return (
                  <tr key={r.id || i} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                    <td className="px-4 py-3 text-center text-base">{MEDALS[i] || i + 1}</td>
                    <td className="px-4 py-3 font-bold text-slate-800 dark:text-slate-100">{r.name || `مندوب #${r.id}`}</td>
                    <td className="px-4 py-3 text-center">
                      <span className="bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2.5 py-0.5 rounded-full text-xs font-bold">{totO || r.total_orders || 0}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 px-2.5 py-0.5 rounded-full text-xs font-bold">{r.delivered_orders || 0}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400 px-2.5 py-0.5 rounded-full text-xs font-bold">{r.returned_orders || 0}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="bg-slate-100 dark:bg-slate-700/50 text-slate-700 dark:text-slate-200 px-2.5 py-0.5 rounded-full text-xs font-bold">{totP || r.total_pieces || 0}</span>
                    </td>
                    <td className="px-4 py-3 text-center font-bold text-emerald-600 dark:text-emerald-400">{r.delivered_pieces || 0}</td>
                    <td className="px-4 py-3 text-center font-bold text-rose-600 dark:text-rose-400">{r.returned_pieces || 0}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                          <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${successRate}%` }} />
                        </div>
                        <span className="text-xs font-bold text-slate-600 dark:text-slate-300 w-10 flex-shrink-0">{successRate}%</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ReportRepPerformance;
