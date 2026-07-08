import React, { useState, useEffect } from 'react';
import { API_BASE_PATH } from '../services/apiConfig';
import { useTheme } from './ThemeContext';
import Swal from 'sweetalert2';
import { RefreshCw, ArrowDownRight, Printer, Download, Search, Receipt, CreditCard, Landmark, Truck, Settings, Coffee, FileText } from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';

interface ExpenseRow {
  id: number;
  date: string;
  type: string;
  category: 'rent' | 'utilities' | 'transport' | 'maintenance' | 'hospitality' | 'supplies' | 'other';
  notes: string;
  amount: number;
  treasury_name: string;
}

const fmt = (n: number) => Number(n || 0).toLocaleString('ar-EG');

const getCategoryLabel = (category: string) => {
  switch (category) {
    case 'rent': return 'إيجارات';
    case 'utilities': return 'مرافق وخدمات';
    case 'transport': return 'انتقالات وشحن';
    case 'maintenance': return 'صيانة وإصلاح';
    case 'hospitality': return 'ضيافة وبوفيه';
    case 'supplies': return 'أدوات مكتبية';
    case 'other': return 'مصروفات متنوعة';
    default: return category;
  }
};

const getCategoryIcon = (category: string) => {
  switch (category) {
    case 'rent': return <Landmark className="text-blue-500" size={18} />;
    case 'utilities': return <Receipt className="text-orange-500" size={18} />;
    case 'transport': return <Truck className="text-emerald-500" size={18} />;
    case 'maintenance': return <Settings className="text-red-500" size={18} />;
    case 'hospitality': return <Coffee className="text-amber-500" size={18} />;
    case 'supplies': return <FileText className="text-violet-500" size={18} />;
    case 'other': return <CreditCard className="text-slate-500" size={18} />;
    default: return <CreditCard className="text-slate-500" size={18} />;
  }
};

const COLORS = ['#3b82f6', '#f97316', '#10b981', '#ef4444', '#f59e0b', '#8b5cf6', '#64748b'];

const ReportExpenses: React.FC = () => {
  const { isDark } = useTheme();
  const sym = localStorage.getItem('Dragon_currency') || 'ج.م';
  
  const today = new Date();
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
  const [startDate, setStartDate] = useState(firstDay.toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState(today.toISOString().slice(0, 10));
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [data, setData] = useState({
    list: [] as ExpenseRow[],
    totals: {
      rent: 0,
      utilities: 0,
      transport: 0,
      maintenance: 0,
      hospitality: 0,
      supplies: 0,
      other: 0
    },
    total_expenses: 0
  });

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_PATH}/api.php?module=reports&action=expenses_report&start_date=${startDate}&end_date=${endDate}`);
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

  const filteredList = data.list.filter(item => 
    (item.notes || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (item.treasury_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    getCategoryLabel(item.category).toLowerCase().includes(searchTerm.toLowerCase())
  );

  const chartData = [
    { name: 'إيجارات', value: data.totals.rent },
    { name: 'مرافق وخدمات', value: data.totals.utilities },
    { name: 'انتقالات وشحن', value: data.totals.transport },
    { name: 'صيانة وإصلاح', value: data.totals.maintenance },
    { name: 'ضيافة وبوفيه', value: data.totals.hospitality },
    { name: 'أدوات مكتبية', value: data.totals.supplies },
    { name: 'مصروفات متنوعة', value: data.totals.other }
  ].filter(item => item.value > 0);

  const exportCSV = () => {
    if (!filteredList.length) {
      Swal.fire('تنبيه', 'لا توجد بيانات لتصديرها.', 'info');
      return;
    }
    const headers = ['التاريخ', 'الخزينة', 'التصنيف', 'المبلغ', 'البيان/السبب'];
    const rows = filteredList.map(r => [
      r.date,
      r.treasury_name,
      getCategoryLabel(r.category),
      r.amount,
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
    a.download = `تقرير_المصروفات_${startDate}_إلى_${endDate}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const printReport = () => {
    const rows = filteredList.map((r, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${r.date}</td>
        <td>${r.treasury_name}</td>
        <td>${getCategoryLabel(r.category)}</td>
        <td style="font-weight: bold; color: red;">${r.amount.toLocaleString()} ${sym}</td>
        <td>${r.notes || '—'}</td>
      </tr>
    `).join('');

    const html = `
      <!doctype html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>تقرير المصروفات</title>
        <style>
          body { font-family: 'Cairo', Arial, sans-serif; direction: rtl; padding: 20px; color: #333; }
          h1 { text-align: center; color: #b91c1c; margin-bottom: 5px; }
          .meta { text-align: center; margin-bottom: 20px; font-size: 14px; color: #666; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 12px; }
          th, td { border: 1px solid #cbd5e1; padding: 10px; text-align: right; }
          th { background-color: #f8fafc; color: #b91c1c; }
          .summary-cards { display: flex; flex-wrap: wrap; justify-content: space-around; margin-bottom: 20px; gap: 15px; }
          .card { flex: 1; min-width: 120px; padding: 15px; border: 1px solid #e2e8f0; border-radius: 12px; text-align: center; background: #fafafa; }
          .card h3 { margin: 0 0 5px 0; font-size: 12px; color: #64748b; }
          .card p { margin: 0; font-size: 16px; font-weight: bold; }
        </style>
      </head>
      <body>
        <h1>تقرير المصروفات العام</h1>
        <div class="meta">الفترة من: ${startDate} إلى: ${endDate}</div>
        
        <div class="summary-cards">
          <div class="card" style="border-top: 4px solid #ef4444; background: #fff5f5; min-width: 180px;">
            <h3>إجمالي المصروفات</h3>
            <p style="color: #ef4444; font-size: 20px;">${data.total_expenses.toLocaleString()} ${sym}</p>
          </div>
          <div class="card">
            <h3>إيجارات</h3>
            <p>${data.totals.rent.toLocaleString()} ${sym}</p>
          </div>
          <div class="card">
            <h3>مرافق وخدمات</h3>
            <p>${data.totals.utilities.toLocaleString()} ${sym}</p>
          </div>
          <div class="card">
            <h3>انتقالات وشحن</h3>
            <p>${data.totals.transport.toLocaleString()} ${sym}</p>
          </div>
          <div class="card">
            <h3>صيانة وإصلاح</h3>
            <p>${data.totals.maintenance.toLocaleString()} ${sym}</p>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>التاريخ</th>
              <th>الخزينة</th>
              <th>التصنيف</th>
              <th>المبلغ</th>
              <th>البيان / السبب</th>
            </tr>
          </thead>
          <tbody>
            ${rows || '<tr><td colspan="6" style="text-align:center;">لا توجد مصروفات لعرضها</td></tr>'}
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
      <div className="bg-gradient-to-r from-rose-600 to-red-700 p-6 rounded-3xl text-white shadow-lg flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
          <h2 className="text-2xl font-black flex items-center gap-2"><Receipt className="ml-1" /> تقرير المصروفات</h2>
          <p className="text-white/80 mt-1">تتبع وتحليل كافة النفقات والمصروفات العامة التي يتم صرفها في صفحة الإيرادات والمصروفات</p>
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
            className="bg-white text-rose-700 p-2.5 rounded-xl hover:bg-rose-50 transition active:scale-95 shadow-sm"
          >
            <RefreshCw className={loading ? 'animate-spin' : ''} size={18} />
          </button>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
        <div className={`${kpiClass} col-span-2 bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900`}>
          <div className="text-slate-500 dark:text-slate-400 text-xs font-bold flex items-center gap-1.5 mb-2">
            <ArrowDownRight className="text-red-500" /> إجمالي المصروفات
          </div>
          <div className="text-2xl font-black text-red-600 dark:text-red-400">
            {fmt(data.total_expenses)} <span className="text-sm font-normal">{sym}</span>
          </div>
        </div>
        <div className={kpiClass}>
          <div className="text-slate-500 dark:text-slate-400 text-[11px] font-bold flex items-center gap-1 mb-2">
            {getCategoryIcon('rent')} إيجارات
          </div>
          <div className="text-lg font-black text-slate-800 dark:text-slate-100">
            {fmt(data.totals.rent)} <span className="text-[10px] font-normal text-slate-400">{sym}</span>
          </div>
        </div>
        <div className={kpiClass}>
          <div className="text-slate-500 dark:text-slate-400 text-[11px] font-bold flex items-center gap-1 mb-2">
            {getCategoryIcon('utilities')} مرافق وخدمات
          </div>
          <div className="text-lg font-black text-slate-800 dark:text-slate-100">
            {fmt(data.totals.utilities)} <span className="text-[10px] font-normal text-slate-400">{sym}</span>
          </div>
        </div>
        <div className={kpiClass}>
          <div className="text-slate-500 dark:text-slate-400 text-[11px] font-bold flex items-center gap-1 mb-2">
            {getCategoryIcon('transport')} انتقالات وشحن
          </div>
          <div className="text-lg font-black text-slate-800 dark:text-slate-100">
            {fmt(data.totals.transport)} <span className="text-[10px] font-normal text-slate-400">{sym}</span>
          </div>
        </div>
        <div className={kpiClass}>
          <div className="text-slate-500 dark:text-slate-400 text-[11px] font-bold flex items-center gap-1 mb-2">
            {getCategoryIcon('maintenance')} صيانة وإصلاح
          </div>
          <div className="text-lg font-black text-slate-800 dark:text-slate-100">
            {fmt(data.totals.maintenance)} <span className="text-[10px] font-normal text-slate-400">{sym}</span>
          </div>
        </div>
        <div className={kpiClass}>
          <div className="text-slate-500 dark:text-slate-400 text-[11px] font-bold flex items-center gap-1 mb-2">
            {getCategoryIcon('hospitality')} ضيافة وبوفيه
          </div>
          <div className="text-lg font-black text-slate-800 dark:text-slate-100">
            {fmt(data.totals.hospitality)} <span className="text-[10px] font-normal text-slate-400">{sym}</span>
          </div>
        </div>
        <div className={kpiClass}>
          <div className="text-slate-500 dark:text-slate-400 text-[11px] font-bold flex items-center gap-1 mb-2">
            {getCategoryIcon('supplies')} مكتبية
          </div>
          <div className="text-lg font-black text-slate-800 dark:text-slate-100">
            {fmt(data.totals.supplies)} <span className="text-[10px] font-normal text-slate-400">{sym}</span>
          </div>
        </div>
      </div>

      {/* Chart and Table Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chart */}
        <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col justify-between h-96">
          <h3 className="font-bold text-slate-800 dark:text-white mb-4 text-right">تحليل فئات المصروفات</h3>
          <div className="flex-1 min-h-0">
            {chartData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-slate-400 text-sm">لا توجد بيانات للرسم البياني</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={85}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ borderRadius: '12px', background: isDark ? '#1e293b' : 'white', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} 
                    itemStyle={{ color: isDark ? '#f1f5f9' : '#1e293b' }} 
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
          {/* Chart Legend */}
          <div className="flex flex-wrap gap-x-4 gap-y-1 justify-center mt-4">
            {chartData.map((entry, index) => (
              <div key={entry.name} className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                <span>{entry.name}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Table list */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden flex flex-col justify-between h-96">
          <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50 dark:bg-slate-900/10">
            <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-900 px-3 py-2 rounded-2xl w-full sm:w-60 border border-slate-200 dark:border-slate-700">
              <Search className="text-slate-400 w-3.5 h-3.5" />
              <input 
                type="text" 
                placeholder="بحث بالخزينة أو البيان..." 
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="bg-transparent border-none focus:ring-0 text-xs w-full text-right"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <button 
                onClick={exportCSV} 
                className="p-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold flex items-center justify-center transition active:scale-95"
                title="تصدير Excel/CSV"
              >
                <Download size={16} />
              </button>
              <button 
                onClick={printReport} 
                className="p-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-800 dark:text-white rounded-xl font-bold flex items-center justify-center transition active:scale-95"
                title="طباعة التقرير"
              >
                <Printer size={16} />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-500 dark:text-slate-400 sticky top-0">
                <tr>
                  <th className="px-4 py-3 font-bold">التاريخ</th>
                  <th className="px-4 py-3 font-bold">الخزينة</th>
                  <th className="px-4 py-3 font-bold">التصنيف</th>
                  <th className="px-4 py-3 font-bold text-center">المبلغ</th>
                  <th className="px-4 py-3 font-bold">البيان / السبب</th>
                </tr>
              </thead>
              <tbody className="divide-y dark:divide-slate-700 text-slate-700 dark:text-slate-300">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-slate-400">
                      <div className="flex items-center justify-center gap-2">
                        <RefreshCw className="animate-spin text-rose-500" size={16} />
                        <span>جاري تحميل البيانات...</span>
                      </div>
                    </td>
                  </tr>
                ) : filteredList.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-slate-400">
                      لا توجد مصروفات مسجلة في هذه الفترة.
                    </td>
                  </tr>
                ) : filteredList.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-700/20 transition-colors">
                    <td className="px-4 py-3.5 font-mono text-[10px]">{item.date.slice(0, 16)}</td>
                    <td className="px-4 py-3.5 text-slate-600 dark:text-slate-400">{item.treasury_name}</td>
                    <td className="px-4 py-3.5">
                      <span className="flex items-center gap-1">
                        {getCategoryIcon(item.category)}
                        <span>{getCategoryLabel(item.category)}</span>
                      </span>
                    </td>
                    <td className="px-4 py-3.5 font-black text-center text-rose-600 dark:text-rose-400">
                      {item.amount.toLocaleString()} <span className="text-[10px] font-normal">{sym}</span>
                    </td>
                    <td className="px-4 py-3.5 text-slate-600 dark:text-slate-400 max-w-[120px] truncate" title={item.notes}>{item.notes || '—'}</td>
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

export default ReportExpenses;
