import React, { useState, useEffect } from 'react';
import { API_BASE_PATH } from '../services/apiConfig';
import { useTheme } from './ThemeContext';
import Swal from 'sweetalert2';
import { RefreshCw, ArrowUpRight, ArrowDownRight, Printer, Download, Search, Coins } from 'lucide-react';

interface FinesIncentivesRow {
  id: number;
  role: 'employee' | 'worker' | 'rep';
  person_name: string;
  tx_type: 'bonus' | 'penalty';
  amount: number;
  tx_date: string;
  notes: string;
}

const fmt = (n: number) => Number(n || 0).toLocaleString('ar-EG');
const getRoleLabel = (role: string) => {
  switch (role) {
    case 'employee': return 'موظف';
    case 'worker': return 'عامل';
    case 'rep': return 'مندوب';
    default: return role;
  }
};

const ReportFinesIncentives: React.FC = () => {
  const { isDark } = useTheme();
  const sym = localStorage.getItem('Dragon_currency') || 'ج.م';
  
  const today = new Date();
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
  const [startDate, setStartDate] = useState(firstDay.toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState(today.toISOString().slice(0, 10));
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [typeFilter, setTypeFilter] = useState<'all' | 'bonus' | 'penalty'>('all');
  const [data, setData] = useState({
    list: [] as FinesIncentivesRow[],
    total_bonuses: 0,
    total_penalties: 0,
    net_amount: 0
  });

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_PATH}/api.php?module=reports&action=fines_incentives&start_date=${startDate}&end_date=${endDate}`);
      const json = await res.json();
      if (json.success) {
        setData(json.data);
      } else {
        Swal.fire('خطأ', json.message || 'فشل تحميل التقرير', 'error');
      }
    } catch (e) {
      Swal.fire('خطأ', 'فشل الاتصال بالخادم وتحميل البيانات', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [startDate, endDate]);

  const filteredList = data.list.filter(item => {
    const matchType = typeFilter === 'all' || item.tx_type === typeFilter;
    const matchSearch = (item.person_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.notes || '').toLowerCase().includes(searchTerm.toLowerCase());
    return matchType && matchSearch;
  });

  const currentBonuses = filteredList.filter(r => r.tx_type === 'bonus').reduce((sum, r) => sum + Number(r.amount || 0), 0);
  const currentPenalties = filteredList.filter(r => r.tx_type === 'penalty').reduce((sum, r) => sum + Number(r.amount || 0), 0);
  const currentNet = currentBonuses - currentPenalties;

  const [sortKey, setSortKey] = useState<string>('tx_date');
  const [sortAsc, setSortAsc] = useState(false);

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(false);
    }
  };

  const sortedList = [...filteredList].sort((a, b) => {
    if (sortKey === 'amount') {
      const aVal = Number(a.amount || 0);
      const bVal = Number(b.amount || 0);
      return sortAsc ? aVal - bVal : bVal - aVal;
    }
    const aVal = String((a as any)[sortKey] || '');
    const bVal = String((b as any)[sortKey] || '');
    return sortAsc ? aVal.localeCompare(bVal, 'ar') : bVal.localeCompare(aVal, 'ar');
  });

  const SortHeader: React.FC<{ col: string; label: string; align?: 'center' | 'right' | 'left' }> = ({ col, label, align = 'right' }) => (
    <th
      onClick={() => handleSort(col)}
      className={`px-6 py-3.5 font-bold text-${align} cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors select-none group`}
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
    if (!sortedList.length) {
      Swal.fire('تنبيه', 'لا توجد بيانات لتصديرها.', 'info');
      return;
    }
    const headers = ['الاسم', 'الصفة', 'النوع', 'المبلغ', 'التاريخ', 'البيان/الملاحظات'];
    const rows = sortedList.map(r => [
      r.person_name,
      getRoleLabel(r.role),
      r.tx_type === 'bonus' ? 'حافز' : 'غرامة',
      r.amount,
      r.tx_date,
      r.notes
    ]);
    const csvContent = "\uFEFF" + [
      headers.join(','),
      ...rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const typeTitle = typeFilter === 'bonus' ? '_حوافز' : typeFilter === 'penalty' ? '_غرامات' : '';
    a.download = `تقرير_الغرامات_والحوافز${typeTitle}_${startDate}_إلى_${endDate}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const printReport = () => {
    const rows = sortedList.map((r, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${r.person_name}</td>
        <td>${getRoleLabel(r.role)}</td>
        <td style="color: ${r.tx_type === 'bonus' ? 'green' : 'red'}; font-weight: bold;">
          ${r.tx_type === 'bonus' ? 'حافز (+)' : 'غرامة (-)'}
        </td>
        <td style="font-weight: bold;">${r.amount.toLocaleString()} ${sym}</td>
        <td>${r.tx_date}</td>
        <td>${r.notes || '—'}</td>
      </tr>
    `).join('');

    const filterTitle = typeFilter === 'bonus' ? ' (حوافز فقط)' : typeFilter === 'penalty' ? ' (غرامات فقط)' : '';

    const html = `
      <!doctype html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>تقرير الغرامات والحوافز${filterTitle}</title>
        <style>
          body { font-family: 'Cairo', Arial, sans-serif; direction: rtl; padding: 20px; color: #333; }
          h1 { text-align: center; color: #1e3a8a; margin-bottom: 5px; }
          .meta { text-align: center; margin-bottom: 20px; font-size: 14px; color: #666; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 12px; }
          th, td { border: 1px solid #cbd5e1; padding: 10px; text-align: right; }
          th { background-color: #f1f5f9; color: #1e3a8a; }
          .summary-cards { display: flex; justify-content: space-around; margin-bottom: 20px; gap: 15px; }
          .card { flex: 1; padding: 15px; border: 1px solid #e2e8f0; border-radius: 12px; text-align: center; background: #fafafa; }
          .card h3 { margin: 0 0 5px 0; font-size: 13px; color: #64748b; }
          .card p { margin: 0; font-size: 18px; font-weight: bold; }
        </style>
      </head>
      <body>
        <h1>تقرير الغرامات و الحوافز${filterTitle}</h1>
        <div class="meta">الفترة من: ${startDate} إلى: ${endDate}</div>
        
        <div class="summary-cards">
          ${typeFilter !== 'penalty' ? `
          <div class="card">
            <h3>إجمالي الحوافز</h3>
            <p style="color: #10b981;">${currentBonuses.toLocaleString()} ${sym}</p>
          </div>` : ''}
          ${typeFilter !== 'bonus' ? `
          <div class="card">
            <h3>إجمالي الغرامات</h3>
            <p style="color: #ef4444;">${currentPenalties.toLocaleString()} ${sym}</p>
          </div>` : ''}
          ${typeFilter === 'all' ? `
          <div class="card">
            <h3>صافي القيمة</h3>
            <p style="color: ${currentNet >= 0 ? '#10b981' : '#ef4444'};">${currentNet.toLocaleString()} ${sym}</p>
          </div>` : ''}
        </div>

        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>الاسم</th>
              <th>الصفة</th>
              <th>النوع</th>
              <th>المبلغ</th>
              <th>التاريخ</th>
              <th>البيان/السبب</th>
            </tr>
          </thead>
          <tbody>
            ${rows || '<tr><td colspan="7" style="text-align:center;">لا توجد بيانات لعرضها</td></tr>'}
          </tbody>
        </table>
      </body>
      </html>
    `;

    const win = window.open('', '_blank');
    if (!win) {
      Swal.fire('تنبيه', 'يرجى السماح بفتح النوافذ المنبثقة لرؤية الطباعة.', 'warning');
      return;
    }
    win.document.write(html);
    win.document.close();
    setTimeout(() => {
      win.print();
      win.close();
    }, 500);
  };

  const kpiClass = "p-5 rounded-3xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-right shadow-sm flex flex-col justify-between";

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header and filters */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-6 rounded-3xl text-white shadow-lg flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
          <h2 className="text-2xl font-black flex items-center gap-2"><Coins className="ml-1" /> تقرير الغرامات والحوافز</h2>
          <p className="text-white/80 mt-1">متابعة تفصيلية لكافة المكافآت والخصومات للموظفين والعمال والمناديب</p>
        </div>
        <div className="flex items-center gap-3">
          <input 
            type="date" 
            value={startDate} 
            onChange={e => setStartDate(e.target.value)} 
            className="bg-white/20 text-white border-0 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-white/50" 
          />
          <span>—</span>
          <input 
            type="date" 
            value={endDate} 
            onChange={e => setEndDate(e.target.value)} 
            className="bg-white/20 text-white border-0 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-white/50" 
          />
          <button 
            onClick={load} 
            disabled={loading} 
            className="bg-white text-indigo-700 p-2.5 rounded-xl hover:bg-indigo-50 transition active:scale-95 shadow-sm"
          >
            <RefreshCw className={loading ? 'animate-spin' : ''} size={18} />
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className={kpiClass}>
          <div className="text-slate-500 dark:text-slate-400 text-sm font-bold flex items-center gap-2 mb-2">
            <ArrowUpRight className="text-emerald-500" /> إجمالي الحوافز
          </div>
          <div className="text-3xl font-black text-emerald-600 dark:text-emerald-400">
            {fmt(currentBonuses)} <span className="text-sm text-slate-400 font-normal">{sym}</span>
          </div>
        </div>
        <div className={kpiClass}>
          <div className="text-slate-500 dark:text-slate-400 text-sm font-bold flex items-center gap-2 mb-2">
            <ArrowDownRight className="text-rose-500" /> إجمالي الغرامات والخصومات
          </div>
          <div className="text-3xl font-black text-rose-600 dark:text-rose-400">
            {fmt(currentPenalties)} <span className="text-sm text-slate-400 font-normal">{sym}</span>
          </div>
        </div>
        <div className={`${kpiClass} ${currentNet >= 0 ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900' : 'bg-rose-50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900'}`}>
          <div className="text-slate-500 dark:text-slate-400 text-sm font-bold flex items-center gap-2 mb-2">
            <Coins className="text-blue-500" /> صافي القيمة
          </div>
          <div className={`text-3xl font-black ${currentNet >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
            {fmt(currentNet)} <span className="text-sm font-normal">{sym}</span>
          </div>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-100 dark:border-slate-700 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-900 px-4 py-2 rounded-2xl w-full md:w-72 border border-slate-200 dark:border-slate-700">
              <Search className="text-slate-400 w-4 h-4" />
              <input 
                type="text" 
                placeholder="بحث بالاسم أو البيان..." 
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="bg-transparent border-none focus:ring-0 text-sm w-full text-right"
              />
            </div>

            {/* Type Filter Segmented Buttons */}
            <div className="flex bg-slate-100 dark:bg-slate-900/80 p-1 rounded-2xl border border-slate-200 dark:border-slate-700">
              <button 
                onClick={() => setTypeFilter('all')} 
                className={`px-4 py-1.5 rounded-xl text-xs font-black transition-all ${
                  typeFilter === 'all' 
                    ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-sm' 
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                الكل
              </button>
              <button 
                onClick={() => setTypeFilter('bonus')} 
                className={`px-4 py-1.5 rounded-xl text-xs font-black transition-all ${
                  typeFilter === 'bonus' 
                    ? 'bg-emerald-600 text-white shadow-sm' 
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                حوافز فقط
              </button>
              <button 
                onClick={() => setTypeFilter('penalty')} 
                className={`px-4 py-1.5 rounded-xl text-xs font-black transition-all ${
                  typeFilter === 'penalty' 
                    ? 'bg-rose-600 text-white shadow-sm' 
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                غرامات فقط
              </button>
            </div>
          </div>
          <div className="flex gap-2 justify-end w-full md:w-auto">
            <button 
              onClick={exportCSV} 
              className="px-4 py-2.5 bg-emerald-600 text-white rounded-2xl font-bold flex items-center gap-2 hover:bg-emerald-700 transition active:scale-95 text-sm"
            >
              <Download size={16} /> Excel / CSV
            </button>
            <button 
              onClick={printReport} 
              className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-800 dark:text-white rounded-2xl font-bold flex items-center gap-2 transition active:scale-95 text-sm"
            >
              <Printer size={16} /> طباعة
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right text-sm">
            <thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-500 dark:text-slate-400">
              <tr>
                <SortHeader col="person_name" label="الاسم" align="right" />
                <SortHeader col="role" label="الصفة" align="right" />
                <SortHeader col="tx_type" label="النوع" align="right" />
                <SortHeader col="amount" label="المبلغ" align="center" />
                <SortHeader col="tx_date" label="التاريخ" align="right" />
                <SortHeader col="notes" label="البيان / السبب" align="right" />
              </tr>
            </thead>
            <tbody className="divide-y dark:divide-slate-700 text-slate-700 dark:text-slate-300">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    <div className="flex items-center justify-center gap-2">
                      <RefreshCw className="animate-spin text-blue-500" size={20} />
                      <span>جاري تحميل البيانات...</span>
                    </div>
                  </td>
                </tr>
              ) : sortedList.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    لا توجد غرامات أو حوافز مسجلة في هذه الفترة.
                  </td>
                </tr>
              ) : sortedList.map((item) => (
                <tr key={`${item.role}-${item.id}`} className="hover:bg-slate-50/50 dark:hover:bg-slate-700/20 transition-colors">
                  <td className="px-6 py-4 font-bold text-slate-900 dark:text-white">{item.person_name}</td>
                  <td className="px-6 py-4">
                    <span className={`px-3 py-1 rounded-xl text-xs font-black ${
                      item.role === 'employee' ? 'bg-violet-100 text-violet-700 dark:bg-violet-950/20 dark:text-violet-400' :
                      item.role === 'worker' ? 'bg-blue-100 text-blue-700 dark:bg-blue-950/20 dark:text-blue-400' :
                      'bg-orange-100 text-orange-700 dark:bg-orange-950/20 dark:text-orange-400'
                    }`}>
                      {getRoleLabel(item.role)}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-3 py-1 rounded-xl text-xs font-black ${
                      item.tx_type === 'bonus' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400' : 'bg-rose-100 text-rose-700 dark:bg-rose-950/20 dark:text-rose-400'
                    }`}>
                      {item.tx_type === 'bonus' ? 'حافز' : 'غرامة'}
                    </span>
                  </td>
                  <td className={`px-6 py-4 font-black text-center text-base ${item.tx_type === 'bonus' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                    {item.tx_type === 'bonus' ? '+' : '-'}{item.amount.toLocaleString()} <span className="text-xs font-normal">{sym}</span>
                  </td>
                  <td className="px-6 py-4 font-medium text-slate-600 dark:text-slate-400">{item.tx_date}</td>
                  <td className="px-6 py-4 text-slate-500 dark:text-slate-400 max-w-xs truncate" title={item.notes || ''}>
                    {item.notes || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ReportFinesIncentives;
