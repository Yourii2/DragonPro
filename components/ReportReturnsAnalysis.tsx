import React, { useState, useEffect, useCallback } from 'react';
import { API_BASE_PATH } from '../services/apiConfig';
import { useTheme } from './ThemeContext';
import Swal from 'sweetalert2';
import { AlertCircle, RefreshCw, BarChart3 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const fmt = (n: number) => Number(n || 0).toLocaleString('ar-EG');

const ReportReturnsAnalysis: React.FC = () => {
  const { isDark } = useTheme();
  const sym = localStorage.getItem('Dragon_currency') || 'ج.م';
  
  const today = new Date();
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
  const [startDate, setStartDate] = useState(firstDay.toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState(today.toISOString().slice(0, 10));
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>({ by_rep: [], by_product: [] });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_PATH}/api.php?module=reports&action=returnsAnalysis&start_date=${startDate}&end_date=${endDate}`);
      const json = await res.json();
      if (json.success) setData(json.data);
      else Swal.fire('خطأ', json.message, 'error');
    } catch {
      Swal.fire('خطأ', 'فشل تحميل التقرير', 'error');
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => { load(); }, [load]);

  const tooltipStyle = {
    borderRadius: '14px', border: 'none',
    boxShadow: '0 10px 20px rgba(0,0,0,.15)',
    background: isDark ? '#0f172a' : '#fff',
    color: isDark ? '#f1f5f9' : '#0f172a',
    padding: '10px 14px', textAlign: 'right' as const
  };

  const topReps = data.by_rep ? [...data.by_rep].sort((a,b) => b.return_pieces - a.return_pieces).slice(0, 10) : [];
  const topProducts = data.by_product ? [...data.by_product].sort((a,b) => b.return_pieces - a.return_pieces).slice(0, 10) : [];

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="bg-gradient-to-r from-rose-500 to-pink-600 p-6 rounded-3xl text-white shadow-lg flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
          <h2 className="text-2xl font-black flex items-center gap-2"><AlertCircle /> تقرير تحليل المرتجعات</h2>
          <p className="text-white/80 mt-1">يحلل أسباب الخسائر وأكثر المنتجات والمناديب في المرتجعات الكلية</p>
        </div>
        <div className="flex items-center gap-3">
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="bg-white/20 text-white border-0 rounded-xl px-3 py-2 text-sm" />
          <span>—</span>
          <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="bg-white/20 text-white border-0 rounded-xl px-3 py-2 text-sm" />
          <button onClick={load} disabled={loading} className="bg-white text-rose-600 p-2 rounded-xl hover:bg-rose-50 transition">
            <RefreshCw className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700">
          <h3 className="font-black text-slate-800 dark:text-slate-100 mb-6 flex items-center gap-2"><BarChart3 size={18} className="text-rose-500" /> أكثر المناديب إرجاعاً</h3>
          <div style={{ height: 260 }}>
            {topReps.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1} initialDimension={{ width: 1, height: 1 }}>
                <BarChart data={topReps}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? '#334155' : '#e2e8f0'} />
                  <XAxis dataKey="rep_name" tick={{ fill: isDark ? '#94a3b8' : '#64748b', fontSize: 10 }} />
                  <YAxis tick={{ fill: isDark ? '#94a3b8' : '#64748b', fontSize: 10 }} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar dataKey="return_pieces" name="القطع المرتجعة" fill="#ef4444" radius={[4, 4, 0, 0]} barSize={20} />
                </BarChart>
              </ResponsiveContainer>
            ) : <div className="h-full flex items-center justify-center text-slate-400">لا توجد مرتجعات</div>}
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-500 text-xs">
                <tr>
                  <th className="p-2">المندوب</th>
                  <th className="p-2 text-center">الأوردرات</th>
                  <th className="p-2 text-center">القطع</th>
                  <th className="p-2">القيمة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {topReps.map((r: any, i: number) => (
                  <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <td className="p-2 font-bold text-slate-800 dark:text-slate-100">{r.rep_name}</td>
                    <td className="p-2 text-center">{r.return_orders}</td>
                    <td className="p-2 text-center text-rose-500 font-bold">{r.return_pieces}</td>
                    <td className="p-2">{fmt(r.return_value)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700">
          <h3 className="font-black text-slate-800 dark:text-slate-100 mb-6 flex items-center gap-2"><BarChart3 size={18} className="text-pink-500" /> أكثر المنتجات إرجاعاً</h3>
          <div style={{ height: 260 }}>
            {topProducts.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1} initialDimension={{ width: 1, height: 1 }}>
                <BarChart data={topProducts}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? '#334155' : '#e2e8f0'} />
                  <XAxis dataKey="product_name" tick={{ fill: isDark ? '#94a3b8' : '#64748b', fontSize: 10 }} />
                  <YAxis tick={{ fill: isDark ? '#94a3b8' : '#64748b', fontSize: 10 }} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar dataKey="return_pieces" name="القطع المرتجعة" fill="#ec4899" radius={[4, 4, 0, 0]} barSize={20} />
                </BarChart>
              </ResponsiveContainer>
            ) : <div className="h-full flex items-center justify-center text-slate-400">لا توجد مرتجعات</div>}
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-500 text-xs">
                <tr>
                  <th className="p-2">المنتج</th>
                  <th className="p-2 text-center">القطع</th>
                  <th className="p-2">القيمة الضائعة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {topProducts.map((p: any, i: number) => (
                  <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <td className="p-2 font-bold text-slate-800 dark:text-slate-100">{p.product_name}</td>
                    <td className="p-2 text-center text-pink-500 font-bold">{p.return_pieces}</td>
                    <td className="p-2 text-rose-600">{fmt(p.return_value)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReportReturnsAnalysis;
