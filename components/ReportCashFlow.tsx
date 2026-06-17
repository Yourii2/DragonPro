import React, { useState, useEffect, useCallback } from 'react';
import { API_BASE_PATH } from '../services/apiConfig';
import { useTheme } from './ThemeContext';
import Swal from 'sweetalert2';
import { Wallet, RefreshCw, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const fmt = (n: number) => Number(n || 0).toLocaleString('ar-EG');
const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316', '#84cc16'];

const ReportCashFlow: React.FC = () => {
  const { isDark } = useTheme();
  const sym = localStorage.getItem('Dragon_currency') || 'ج.م';
  
  const today = new Date();
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
  const [startDate, setStartDate] = useState(firstDay.toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState(today.toISOString().slice(0, 10));
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>({ daily: [], expenses_by_type: [] });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_PATH}/api.php?module=reports&action=cashFlow&start_date=${startDate}&end_date=${endDate}`);
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

  const totalIn = data.daily.reduce((sum: number, d: any) => sum + Number(d.cash_in), 0);
  const totalOut = data.daily.reduce((sum: number, d: any) => sum + Number(d.cash_out), 0);
  const netFlow = totalIn - totalOut;

  const tooltipStyle = {
    borderRadius: '14px', border: 'none',
    boxShadow: '0 10px 20px rgba(0,0,0,.15)',
    background: isDark ? '#0f172a' : '#fff',
    color: isDark ? '#f1f5f9' : '#0f172a',
    padding: '10px 14px', textAlign: 'right' as const
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="bg-gradient-to-r from-emerald-500 to-teal-600 p-6 rounded-3xl text-white shadow-lg flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
          <h2 className="text-2xl font-black flex items-center gap-2"><Wallet /> تقرير التدفق النقدي</h2>
          <p className="text-white/80 mt-1">يتابع حركة السيولة الفعلية الداخلة والخارجة من وإلى الخزائن</p>
        </div>
        <div className="flex items-center gap-3">
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="bg-white/20 text-white border-0 rounded-xl px-3 py-2 text-sm" />
          <span>—</span>
          <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="bg-white/20 text-white border-0 rounded-xl px-3 py-2 text-sm" />
          <button onClick={load} disabled={loading} className="bg-white text-teal-600 p-2 rounded-xl hover:bg-teal-50 transition">
            <RefreshCw className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700">
          <div className="text-slate-500 text-sm font-bold flex items-center gap-2 mb-2"><ArrowUpRight className="text-emerald-500" /> إجمالي الداخل</div>
          <div className="text-3xl font-black text-slate-800 dark:text-slate-100">{fmt(totalIn)} <span className="text-sm text-slate-400">{sym}</span></div>
        </div>
        <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700">
          <div className="text-slate-500 text-sm font-bold flex items-center gap-2 mb-2"><ArrowDownRight className="text-rose-500" /> إجمالي الخارج</div>
          <div className="text-3xl font-black text-slate-800 dark:text-slate-100">{fmt(totalOut)} <span className="text-sm text-slate-400">{sym}</span></div>
        </div>
        <div className={`p-6 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700 text-white ${netFlow >= 0 ? 'bg-emerald-500' : 'bg-rose-500'}`}>
          <div className="text-white/80 text-sm font-bold mb-2">صافي التدفق</div>
          <div className="text-3xl font-black">{fmt(netFlow)} <span className="text-sm text-white/60">{sym}</span></div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700">
          <h3 className="font-black text-slate-800 dark:text-slate-100 mb-6">التدفق اليومي</h3>
          <div style={{ height: 300 }}>
            <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1} initialDimension={{ width: 1, height: 1 }}>
              <AreaChart data={data.daily}>
                <defs>
                  <linearGradient id="colorIn" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorOut" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? '#334155' : '#e2e8f0'} />
                <XAxis dataKey="date" tick={{ fill: isDark ? '#94a3b8' : '#64748b', fontSize: 10 }} />
                <YAxis tick={{ fill: isDark ? '#94a3b8' : '#64748b', fontSize: 10 }} />
                <Tooltip contentStyle={tooltipStyle} formatter={(val: any) => `${fmt(val)} ${sym}`} />
                <Area type="monotone" dataKey="cash_in" name="الداخل" stroke="#10b981" fillOpacity={1} fill="url(#colorIn)" />
                <Area type="monotone" dataKey="cash_out" name="الخارج" stroke="#ef4444" fillOpacity={1} fill="url(#colorOut)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
        
        <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700">
          <h3 className="font-black text-slate-800 dark:text-slate-100 mb-6">أنواع المصروفات (الخارج)</h3>
          {data.expenses_by_type.length === 0 ? (
            <div className="text-center text-slate-400 py-10">لا توجد مصروفات</div>
          ) : (
            <div style={{ height: 250 }}>
              <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1} initialDimension={{ width: 1, height: 1 }}>
                <PieChart>
                  <Pie
                    data={data.expenses_by_type}
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="total"
                    nameKey="type"
                  >
                    {data.expenses_by_type.map((entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} formatter={(val: any) => `${fmt(val)} ${sym}`} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
          <div className="space-y-3 mt-4">
            {data.expenses_by_type.map((item: any, i: number) => (
              <div key={i} className="flex justify-between items-center text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                  <span className="text-slate-600 dark:text-slate-300 font-bold">{item.type}</span>
                </div>
                <span className="font-black text-slate-800 dark:text-slate-100">{fmt(item.total)} {sym}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReportCashFlow;
