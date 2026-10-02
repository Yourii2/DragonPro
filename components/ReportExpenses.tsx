import React, { useState, useEffect } from 'react';
import { API_BASE_PATH } from '../services/apiConfig';
import { useTheme } from './ThemeContext';
import { formatLocalDate, getFirstDayOfMonth, getDaysAgo } from '../services/dateUtils';
import Swal from 'sweetalert2';
import { RefreshCw, ArrowDownRight, Printer, Download, Search, Receipt, CreditCard, Landmark, Truck, Settings, Coffee, FileText, Megaphone, Users, Scissors, X } from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';

interface ExpenseRow {
  id: number;
  date: string;
  type: string;
  category: 'materials' | 'rent' | 'utilities' | 'transport' | 'maintenance' | 'hospitality' | 'supplies' | 'ads' | 'salaries' | 'other' | string;
  notes: string;
  amount: number;
  treasury_name: string;
}

const fmt = (n: number) => Number(n || 0).toLocaleString('ar-EG');

const getCategoryLabel = (category: string) => {
  switch (category) {
    case 'materials': return 'خامات وأقمشة';
    case 'ads': return 'إعلانات وتسويق';
    case 'salaries': return 'رواتب وأجور';
    case 'rent': return 'إيجارات';
    case 'utilities': return 'مرافق وخدمات';
    case 'transport': return 'انتقالات وشحن';
    case 'maintenance': return 'صيانة وإصلاح';
    case 'hospitality': return 'ضيافة وبوفيه';
    case 'supplies': return 'أدوات مكتبية ومطبوعات';
    case 'other': return 'مصروفات متنوعة';
    default: return category;
  }
};

const getCategoryIcon = (category: string) => {
  switch (category) {
    case 'materials': return <Scissors className="text-teal-500" size={18} />;
    case 'ads': return <Megaphone className="text-pink-500" size={18} />;
    case 'salaries': return <Users className="text-indigo-500" size={18} />;
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

const COLORS = ['#0d9488', '#ec4899', '#6366f1', '#3b82f6', '#f97316', '#10b981', '#ef4444', '#f59e0b', '#8b5cf6', '#64748b'];

const categoriesConfig = [
  { key: 'materials', label: 'خامات وأقمشة', textClass: 'text-teal-600 dark:text-teal-400', activeRing: 'ring-2 ring-teal-500 bg-teal-50/80 dark:bg-teal-950/30 border-teal-300 dark:border-teal-800' },
  { key: 'ads', label: 'إعلانات وتسويق', textClass: 'text-pink-600 dark:text-pink-400', activeRing: 'ring-2 ring-pink-500 bg-pink-50/80 dark:bg-pink-950/30 border-pink-300 dark:border-pink-800' },
  { key: 'salaries', label: 'رواتب وأجور', textClass: 'text-indigo-600 dark:text-indigo-400', activeRing: 'ring-2 ring-indigo-500 bg-indigo-50/80 dark:bg-indigo-950/30 border-indigo-300 dark:border-indigo-800' },
  { key: 'rent', label: 'إيجارات', textClass: 'text-blue-600 dark:text-blue-400', activeRing: 'ring-2 ring-blue-500 bg-blue-50/80 dark:bg-blue-950/30 border-blue-300 dark:border-blue-800' },
  { key: 'utilities', label: 'مرافق وخدمات', textClass: 'text-orange-600 dark:text-orange-400', activeRing: 'ring-2 ring-orange-500 bg-orange-50/80 dark:bg-orange-950/30 border-orange-300 dark:border-orange-800' },
  { key: 'transport', label: 'انتقالات وشحن', textClass: 'text-emerald-600 dark:text-emerald-400', activeRing: 'ring-2 ring-emerald-500 bg-emerald-50/80 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800' },
  { key: 'maintenance', label: 'صيانة وإصلاح', textClass: 'text-red-600 dark:text-red-400', activeRing: 'ring-2 ring-red-500 bg-red-50/80 dark:bg-red-950/30 border-red-300 dark:border-red-800' },
  { key: 'hospitality', label: 'ضيافة وبوفيه', textClass: 'text-amber-600 dark:text-amber-400', activeRing: 'ring-2 ring-amber-500 bg-amber-50/80 dark:bg-amber-950/30 border-amber-300 dark:border-amber-800' },
  { key: 'supplies', label: 'أدوات مكتبية', textClass: 'text-violet-600 dark:text-violet-400', activeRing: 'ring-2 ring-violet-500 bg-violet-50/80 dark:bg-violet-950/30 border-violet-300 dark:border-violet-800' },
  { key: 'other', label: 'مصروفات متنوعة', textClass: 'text-slate-600 dark:text-slate-400', activeRing: 'ring-2 ring-slate-500 bg-slate-100 dark:bg-slate-700/50 border-slate-300 dark:border-slate-600' },
];

const ReportExpenses: React.FC = () => {
  const { isDark } = useTheme();
  const sym = localStorage.getItem('Dragon_currency') || 'ج.م';
  
  const [startDate, setStartDate] = useState(getFirstDayOfMonth());
  const [endDate, setEndDate] = useState(formatLocalDate());
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  
  const [data, setData] = useState({
    list: [] as ExpenseRow[],
    totals: {
      materials: 0,
      rent: 0,
      utilities: 0,
      transport: 0,
      maintenance: 0,
      hospitality: 0,
      supplies: 0,
      ads: 0,
      salaries: 0,
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

  const [sortKey, setSortKey] = useState<string>('date');
  const [sortAsc, setSortAsc] = useState(false);

  const filteredList = data.list.filter(item => {
    if (selectedCategory !== 'all' && item.category !== selectedCategory) {
      return false;
    }
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      (item.notes || '').toLowerCase().includes(term) ||
      (item.treasury_name || '').toLowerCase().includes(term) ||
      getCategoryLabel(item.category).toLowerCase().includes(term)
    );
  });

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
    if (sortKey === 'category') {
      const aVal = getCategoryLabel(a.category);
      const bVal = getCategoryLabel(b.category);
      return sortAsc ? aVal.localeCompare(bVal, 'ar') : bVal.localeCompare(aVal, 'ar');
    }
    const aVal = String((a as any)[sortKey] || '');
    const bVal = String((b as any)[sortKey] || '');
    return sortAsc ? aVal.localeCompare(bVal, 'ar') : bVal.localeCompare(aVal, 'ar');
  });

  const SortHeader: React.FC<{ col: string; label: string; align?: 'center' | 'right' | 'left' }> = ({ col, label, align = 'right' }) => (
    <th
      onClick={() => handleSort(col)}
      className={`px-4 py-3 font-bold text-${align} cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors select-none group`}
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

  const chartData = [
    { name: 'خامات وأقمشة', value: data.totals.materials || 0 },
    { name: 'إعلانات وتسويق', value: data.totals.ads || 0 },
    { name: 'رواتب وأجور', value: data.totals.salaries || 0 },
    { name: 'إيجارات', value: data.totals.rent || 0 },
    { name: 'مرافق وخدمات', value: data.totals.utilities || 0 },
    { name: 'انتقالات وشحن', value: data.totals.transport || 0 },
    { name: 'صيانة وإصلاح', value: data.totals.maintenance || 0 },
    { name: 'ضيافة وبوفيه', value: data.totals.hospitality || 0 },
    { name: 'أدوات مكتبية', value: data.totals.supplies || 0 },
    { name: 'مصروفات متنوعة', value: data.totals.other || 0 }
  ].filter(item => item.value > 0);

  const exportCSV = () => {
    if (!sortedList.length) {
      Swal.fire('تنبيه', 'لا توجد بيانات لتصديرها.', 'info');
      return;
    }
    const headers = ['التاريخ', 'الخزينة', 'التصنيف', 'المبلغ', 'البيان/السبب'];
    const rows = sortedList.map(r => [
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
    const rows = sortedList.map((r, i) => `
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
        <div class="meta">الفترة من: ${startDate} إلى: ${endDate} ${selectedCategory !== 'all' ? `| التصنيف: ${getCategoryLabel(selectedCategory)}` : ''}</div>
        
        <div class="summary-cards">
          <div class="card" style="border-top: 4px solid #ef4444; background: #fff5f5; min-width: 180px;">
            <h3>إجمالي المصروفات</h3>
            <p style="color: #ef4444; font-size: 20px;">${data.total_expenses.toLocaleString()} ${sym}</p>
          </div>
          <div class="card" style="border-top: 4px solid #0d9488;">
            <h3>خامات وأقمشة</h3>
            <p>${(data.totals.materials || 0).toLocaleString()} ${sym}</p>
          </div>
          <div class="card">
            <h3>إعلانات وتسويق</h3>
            <p>${data.totals.ads.toLocaleString()} ${sym}</p>
          </div>
          <div class="card">
            <h3>رواتب وأجور</h3>
            <p>${data.totals.salaries.toLocaleString()} ${sym}</p>
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

  const kpiClass = "p-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-right shadow-sm flex flex-col justify-between";
  const quickRanges = [
    { label: 'اليوم', start: formatLocalDate(), end: formatLocalDate() },
    { label: 'هذا الشهر', start: getFirstDayOfMonth(), end: formatLocalDate() },
    { label: 'آخر 7 أيام', start: getDaysAgo(6), end: formatLocalDate() },
    { label: 'آخر 30 يوم', start: getDaysAgo(29), end: formatLocalDate() }
  ];

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header and filters */}
      <div className="bg-gradient-to-r from-rose-600 to-red-700 p-6 rounded-3xl text-white shadow-lg flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
          <h2 className="text-2xl font-black flex items-center gap-2"><Receipt className="ml-1" /> تقرير المصروفات</h2>
          <p className="text-white/80 mt-1">تتبع وتحليل كافة النفقات مع إمكانية الفلترة السريعة بالنقر على أي نوع مصروف</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex flex-wrap gap-2">
            {quickRanges.map((range) => (
              <button
                key={range.label}
                type="button"
                onClick={() => { setStartDate(range.start); setEndDate(range.end); }}
                className={`px-2.5 py-1.5 rounded-xl text-[11px] font-bold transition-all ${
                  startDate === range.start && endDate === range.end
                    ? 'bg-white text-rose-700'
                    : 'bg-white/15 text-white hover:bg-white/20'
                }`}
              >
                {range.label}
              </button>
            ))}
          </div>
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

      {/* KPI Grid - Clickable Category Filters */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-11 gap-2.5">
        {/* Total Expenses Card (All) */}
        <div 
          onClick={() => setSelectedCategory('all')}
          className={`${kpiClass} cursor-pointer transition-all duration-200 select-none hover:-translate-y-0.5 hover:shadow-md active:scale-95 ${
            selectedCategory === 'all'
              ? 'ring-2 ring-red-500 bg-red-50 dark:bg-red-950/40 border-red-300 dark:border-red-800 shadow-sm'
              : 'hover:border-red-300'
          }`}
          title="عرض جميع المصروفات"
        >
          <div className="text-slate-500 dark:text-slate-400 text-xs font-bold flex items-center justify-between mb-1.5">
            <span className="flex items-center gap-1.5"><ArrowDownRight className="text-red-500" size={15} /> الإجمالي</span>
            {selectedCategory === 'all' && <span className="text-[10px] bg-red-600 text-white px-1.5 py-0.5 rounded-md font-bold">الكل</span>}
          </div>
          <div className="text-lg font-black text-red-600 dark:text-red-400">
            {fmt(data.total_expenses)} <span className="text-[10px] font-normal">{sym}</span>
          </div>
        </div>

        {/* Dynamic Category Cards */}
        {categoriesConfig.map(cat => {
          const isSelected = selectedCategory === cat.key;
          const val = (data.totals as any)[cat.key] || 0;
          return (
            <div
              key={cat.key}
              onClick={() => setSelectedCategory(prev => prev === cat.key ? 'all' : cat.key)}
              className={`${kpiClass} cursor-pointer transition-all duration-200 select-none hover:-translate-y-0.5 hover:shadow-md active:scale-95 ${
                isSelected
                  ? `${cat.activeRing} shadow-sm font-black`
                  : 'hover:border-slate-300 dark:hover:border-slate-600'
              }`}
              title={`تصفية حسب: ${cat.label} (اضغط للتحديد أو الإلغاء)`}
            >
              <div className="text-slate-500 dark:text-slate-400 text-[11px] font-bold flex items-center justify-between gap-1 mb-1.5">
                <span className="flex items-center gap-1 truncate">{getCategoryIcon(cat.key)} {cat.label}</span>
                {isSelected && <span className="text-[10px] bg-rose-600 text-white px-1 py-0.5 rounded font-bold">✓</span>}
              </div>
              <div className={`text-base font-black ${cat.textClass}`}>
                {fmt(val)} <span className="text-[10px] font-normal text-slate-400">{sym}</span>
              </div>
            </div>
          );
        })}
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
            <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
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
              {selectedCategory !== 'all' && (
                <div className="flex items-center gap-1.5 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 px-3 py-1.5 rounded-xl text-xs font-bold border border-rose-200 dark:border-rose-800 animate-in fade-in">
                  <span>تصفية: {getCategoryLabel(selectedCategory)}</span>
                  <button 
                    onClick={() => setSelectedCategory('all')} 
                    className="hover:bg-rose-200 dark:hover:bg-rose-900 p-0.5 rounded-full transition"
                    title="إلغاء الفلترة وعرض الكل"
                  >
                    <X size={13} />
                  </button>
                </div>
              )}
            </div>
            <div className="flex items-center gap-2 justify-end">
              <span className="text-[11px] font-bold text-slate-400 hidden md:inline">
                {filteredList.length} حركة ({fmt(filteredList.reduce((s, r) => s + Number(r.amount || 0), 0))} {sym})
              </span>
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
                  <SortHeader col="date" label="التاريخ" align="right" />
                  <SortHeader col="treasury_name" label="الخزينة" align="right" />
                  <SortHeader col="category" label="التصنيف" align="right" />
                  <SortHeader col="amount" label="المبلغ" align="center" />
                  <SortHeader col="notes" label="البيان / السبب" align="right" />
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
                ) : sortedList.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-slate-400">
                      لا توجد مصروفات مسجلة في هذه الفترة.
                    </td>
                  </tr>
                ) : sortedList.map((item) => (
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
