import React, { useState, useEffect, useCallback } from 'react';
import { API_BASE_PATH } from '../services/apiConfig';
import { useTheme } from './ThemeContext';
import Swal from 'sweetalert2';
import { Layers, RefreshCw, Download, ArrowUpRight } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const fmt = (n: number) => Number(n || 0).toLocaleString('ar-EG', { maximumFractionDigits: 2 });

const ReportInventoryValuation: React.FC = () => {
  const { isDark } = useTheme();
  const sym = localStorage.getItem('Dragon_currency') || 'ج.م';
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_PATH}/api.php?module=reports&action=inventoryValuation`);
      const json = await res.json();
      if (json.success) setData(json.data);
      else Swal.fire('خطأ', json.message, 'error');
    } catch {
      Swal.fire('خطأ', 'فشل تحميل التقرير', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const totalCost = data.reduce((sum, d) => sum + Number(d.total_cost_value), 0);
  const totalRetail = data.reduce((sum, d) => sum + Number(d.total_retail_value), 0);
  const totalPieces = data.reduce((sum, d) => sum + Number(d.total_pieces), 0);

  const tooltipStyle = {
    borderRadius: '14px', border: 'none',
    boxShadow: '0 10px 20px rgba(0,0,0,.15)',
    background: isDark ? '#0f172a' : '#fff',
    color: isDark ? '#f1f5f9' : '#0f172a',
    padding: '10px 14px', textAlign: 'right' as const
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="bg-gradient-to-r from-purple-600 to-indigo-600 p-6 rounded-3xl text-white shadow-lg flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-black flex items-center gap-2"><Layers /> تقييم المخزون</h2>
          <p className="text-white/80 mt-1">يقيّم إجمالي البضاعة الموجودة في جميع المخازن بتكلفة الشراء وسعر البيع المتوقع</p>
        </div>
        <button onClick={load} disabled={loading} className="bg-white/20 p-2 rounded-xl hover:bg-white/30 transition">
          <RefreshCw className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700">
          <div className="text-slate-500 text-sm font-bold mb-2">إجمالي عدد القطع</div>
          <div className="text-3xl font-black text-slate-800 dark:text-slate-100">{fmt(totalPieces)} <span className="text-sm text-slate-400">قطعة</span></div>
        </div>
        <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700">
          <div className="text-slate-500 text-sm font-bold flex items-center gap-2 mb-2">إجمالي قيمة التكلفة (رأس المال)</div>
          <div className="text-3xl font-black text-orange-500">{fmt(totalCost)} <span className="text-sm text-slate-400">{sym}</span></div>
        </div>
        <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700">
          <div className="text-slate-500 text-sm font-bold flex items-center gap-2 mb-2"><ArrowUpRight className="text-emerald-500" /> إجمالي قيمة البيع (المتوقعة)</div>
          <div className="text-3xl font-black text-emerald-500">{fmt(totalRetail)} <span className="text-sm text-slate-400">{sym}</span></div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700">
          <h3 className="font-black text-slate-800 dark:text-slate-100 mb-6">التقييم حسب المخزن</h3>
          <div style={{ height: 300 }}>
            <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1} initialDimension={{ width: 1, height: 1 }}>
              <BarChart data={data}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? '#334155' : '#e2e8f0'} />
                <XAxis dataKey="warehouse_name" tick={{ fill: isDark ? '#94a3b8' : '#64748b', fontSize: 12, fontWeight: 'bold' }} />
                <YAxis tick={{ fill: isDark ? '#94a3b8' : '#64748b', fontSize: 10 }} />
                <Tooltip contentStyle={tooltipStyle} formatter={(val: any) => `${fmt(val)} ${sym}`} />
                <Bar dataKey="total_cost_value" name="التكلفة" fill="#f97316" radius={[4, 4, 0, 0]} />
                <Bar dataKey="total_retail_value" name="البيع المتوقع" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 shadow-sm border border-slate-100 dark:border-slate-700">
          <h3 className="font-black text-slate-800 dark:text-slate-100 mb-6">التفاصيل</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-500 dark:text-slate-400">
                <tr>
                  <th className="p-4">المخزن</th>
                  <th className="p-4">القطع</th>
                  <th className="p-4">إجمالي التكلفة</th>
                  <th className="p-4">البيع المتوقع</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {data.length === 0 ? (
                  <tr><td colSpan={4} className="p-8 text-center text-slate-400">لا توجد مخازن ممتلئة</td></tr>
                ) : data.map((w: any, i: number) => (
                  <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <td className="p-4 font-bold text-slate-800 dark:text-slate-100">{w.warehouse_name}</td>
                    <td className="p-4 font-bold text-blue-600 dark:text-blue-400">{fmt(w.total_pieces)}</td>
                    <td className="p-4 font-bold text-orange-500">{fmt(w.total_cost_value)}</td>
                    <td className="p-4 font-black text-emerald-500">{fmt(w.total_retail_value)}</td>
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

export default ReportInventoryValuation;
