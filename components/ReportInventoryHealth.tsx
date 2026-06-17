import React, { useState, useEffect, useCallback } from 'react';
import { API_BASE_PATH } from '../services/apiConfig';
import { useTheme } from './ThemeContext';
import Swal from 'sweetalert2';
import { Package, AlertTriangle, CheckCircle, RefreshCw } from 'lucide-react';

const fmt = (n: number) => Number(n || 0).toLocaleString('ar-EG');

const ReportInventoryHealth: React.FC = () => {
  const { isDark } = useTheme();
  const [data, setData] = useState<any>({ stagnant: [], active: [] });
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<'stagnant' | 'active'>('stagnant');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_PATH}/api.php?module=reports&action=inventoryHealth`);
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

  const list = tab === 'stagnant' ? data.stagnant : data.active;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="bg-gradient-to-r from-orange-500 to-rose-500 p-6 rounded-3xl text-white shadow-lg flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-black flex items-center gap-2"><Package /> تقرير المخزون الراكد والنواقص</h2>
          <p className="text-white/80 mt-1">يعرض المنتجات التي لم يتم عليها أي حركات منذ أكثر من 30 يوم</p>
        </div>
        <button onClick={load} disabled={loading} className="bg-white/20 p-2 rounded-xl hover:bg-white/30 transition">
          <RefreshCw className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      <div className="flex gap-2 bg-white dark:bg-slate-800 p-2 rounded-2xl shadow-sm">
        <button onClick={() => setTab('stagnant')} className={`flex-1 py-2 rounded-xl font-bold flex items-center justify-center gap-2 ${tab === 'stagnant' ? 'bg-rose-500 text-white' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'}`}>
          <AlertTriangle size={18} /> راكد ({data.stagnant?.length || 0})
        </button>
        <button onClick={() => setTab('active')} className={`flex-1 py-2 rounded-xl font-bold flex items-center justify-center gap-2 ${tab === 'active' ? 'bg-emerald-500 text-white' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'}`}>
          <CheckCircle size={18} /> نشط ({data.active?.length || 0})
        </button>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-sm">
            <thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-500 dark:text-slate-400">
              <tr>
                <th className="p-4">المنتج</th>
                <th className="p-4">المخزن</th>
                <th className="p-4 text-center">الكمية</th>
                <th className="p-4">أخر حركة</th>
                {tab === 'stagnant' && <th className="p-4 text-rose-500 text-center">أيام الركود</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {!list || list.length === 0 ? <tr><td colSpan={5} className="p-8 text-center text-slate-400">لا توجد بيانات</td></tr> : list.map((item: any, i: number) => (
                <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                  <td className="p-4 font-bold text-slate-800 dark:text-slate-100">{item.product_name}</td>
                  <td className="p-4 text-slate-600 dark:text-slate-300">{item.warehouse_name}</td>
                  <td className="p-4 text-center">
                    <span className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 px-3 py-1 rounded-full font-bold">
                      {fmt(item.quantity)}
                    </span>
                  </td>
                  <td className="p-4 font-mono text-xs text-slate-500">{item.last_movement || 'لا يوجد'}</td>
                  {tab === 'stagnant' && <td className="p-4 font-black text-rose-500 text-center">{item.days_stagnant || '> 30'} يوم</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ReportInventoryHealth;
