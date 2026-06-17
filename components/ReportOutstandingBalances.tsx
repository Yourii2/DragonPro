import React, { useState, useEffect, useCallback } from 'react';
import { API_BASE_PATH } from '../services/apiConfig';
import { useTheme } from './ThemeContext';
import Swal from 'sweetalert2';
import { Clock, RefreshCw, Download, AlertCircle } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const fmt = (n: number) => Number(n || 0).toLocaleString('ar-EG', { maximumFractionDigits: 2 });

const ReportOutstandingBalances: React.FC = () => {
  const { isDark } = useTheme();
  const sym = localStorage.getItem('Dragon_currency') || 'ج.م';
  const [data, setData] = useState<any>({ users: [], aging_summary: {} });
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_PATH}/api.php?module=reports&action=outstandingBalances`);
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

  const aging = data.aging_summary || {};
  const chartData = [
    { name: '0-30 يوم', value: Number(aging['0_30'] || 0), fill: '#10b981' },
    { name: '31-60 يوم', value: Number(aging['31_60'] || 0), fill: '#f59e0b' },
    { name: '61-90 يوم', value: Number(aging['61_90'] || 0), fill: '#f97316' },
    { name: 'أكثر من 90', value: Number(aging['over_90'] || 0), fill: '#ef4444' }
  ];

  const totalDebt = chartData.reduce((sum, item) => sum + item.value, 0);

  const tooltipStyle = {
    borderRadius: '14px', border: 'none',
    boxShadow: '0 10px 20px rgba(0,0,0,.15)',
    background: isDark ? '#0f172a' : '#fff',
    color: isDark ? '#f1f5f9' : '#0f172a',
    padding: '10px 14px', textAlign: 'right' as const
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-6 rounded-3xl text-white shadow-lg flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-black flex items-center gap-2"><Clock /> تقرير أعمار الديون</h2>
          <p className="text-white/80 mt-1">يعرض الأرصدة المستحقة على العملاء والمناديب والمدة الزمنية المنقضية</p>
        </div>
        <button onClick={load} disabled={loading} className="bg-white/20 p-2 rounded-xl hover:bg-white/30 transition">
          <RefreshCw className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700">
          <h3 className="font-black text-slate-800 dark:text-slate-100 mb-2">إجمالي الديون (المستحقات لنا)</h3>
          <div className="text-4xl font-black text-blue-600 dark:text-blue-400 mb-6">{fmt(totalDebt)} <span className="text-lg text-slate-400">{sym}</span></div>
          
          <div className="space-y-4">
            {chartData.map((item, i) => (
              <div key={i}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="font-bold text-slate-600 dark:text-slate-300">{item.name}</span>
                  <span className="font-black" style={{ color: item.fill }}>{fmt(item.value)} {sym}</span>
                </div>
                <div className="h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${totalDebt > 0 ? (item.value / totalDebt * 100) : 0}%`, backgroundColor: item.fill }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="lg:col-span-2 bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700">
          <h3 className="font-black text-slate-800 dark:text-slate-100 mb-6">توزيع أعمار الديون</h3>
          <div style={{ height: 260 }}>
            <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1} initialDimension={{ width: 1, height: 1 }}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? '#334155' : '#e2e8f0'} />
                <XAxis dataKey="name" tick={{ fill: isDark ? '#94a3b8' : '#64748b', fontSize: 12, fontWeight: 'bold' }} />
                <YAxis tick={{ fill: isDark ? '#94a3b8' : '#64748b', fontSize: 10 }} />
                <Tooltip contentStyle={tooltipStyle} formatter={(val: any) => `${fmt(val)} ${sym}`} />
                <Bar dataKey="value" radius={[6, 6, 0, 0]} barSize={40}>
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 shadow-sm border border-slate-100 dark:border-slate-700">
        <h3 className="font-black text-slate-800 dark:text-slate-100 mb-6">التفاصيل حسب الحساب</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-right text-sm">
            <thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-500 dark:text-slate-400">
              <tr>
                <th className="p-4">الاسم</th>
                <th className="p-4">النوع</th>
                <th className="p-4">الرصيد ({sym})</th>
                <th className="p-4">أيام منذ أخر دفعة</th>
                <th className="p-4">الحالة</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {!data.users || data.users.length === 0 ? (
                <tr><td colSpan={5} className="p-8 text-center text-slate-400">لا توجد أرصدة معلقة</td></tr>
              ) : data.users.map((u: any, i: number) => {
                const bal = Number(u.balance);
                const days = u.days_since_payment;
                let statusColor = 'text-slate-500';
                let statusText: React.ReactNode = '—';
                if (bal > 0) {
                  if (days <= 30) { statusColor = 'text-emerald-500'; statusText = 'جيد'; }
                  else if (days <= 60) { statusColor = 'text-amber-500'; statusText = 'متأخر'; }
                  else if (days <= 90) { statusColor = 'text-orange-500'; statusText = 'متأخر جداً'; }
                  else { statusColor = 'text-rose-500 font-black flex items-center gap-1'; statusText = <><AlertCircle size={14}/> خطر</>; }
                } else {
                  statusText = 'رصيد دائن (لنا)';
                }

                return (
                  <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <td className="p-4 font-bold text-slate-800 dark:text-slate-100">{u.name}</td>
                    <td className="p-4 text-slate-500">{u.role === 'customer' ? 'عميل' : 'مندوب'}</td>
                    <td className={`p-4 font-black ${bal > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>{fmt(Math.abs(bal))} {bal > 0 ? '(عليه)' : '(له)'}</td>
                    <td className="p-4 font-mono text-xs">{days === 999 ? 'لم يدفع أبداً' : `${days} يوم`}</td>
                    <td className={`p-4 ${statusColor}`}>{statusText}</td>
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

export default ReportOutstandingBalances;
