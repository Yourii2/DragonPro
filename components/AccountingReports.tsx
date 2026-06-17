import React, { useState, useEffect, useCallback } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, LineChart, Line, AreaChart, Area, PieChart, Pie, Cell
} from 'recharts';
import {
  TrendingUp, TrendingDown, Package, Users, Calendar,
  FileText, Download, Printer, RefreshCw, DollarSign,
  ShoppingCart, ArrowUpRight, ArrowDownRight, Award,
  BarChart3, List, AlertCircle, Filter
} from 'lucide-react';
import { API_BASE_PATH } from '../services/apiConfig';
import { useTheme } from './ThemeContext';
import Swal from 'sweetalert2';
import CustomSelect from './CustomSelect';

const fmt = (n: number) => Number(n || 0).toLocaleString('ar-EG', { maximumFractionDigits: 2 });
const fmtPct = (n: number) => `${Number(n || 0).toFixed(1)}%`;

const PIE_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316', '#84cc16'];

const STATUS_LABELS: Record<string, string> = {
  delivered: 'مسلَّم', partial: 'جزئي', returned: 'مرتجع كلي',
  full_return: 'مرتجع كلي', partial_return: 'مرتجع جزئي',
  with_rep: 'مع مندوب', pending: 'معلق', cancelled: 'ملغي'
};

// ─── KPI Card ─────────────────────────────────────────────────────────────────
const KpiCard = ({ title, value, sub, icon: Icon, gradient, isPositive }: any) => (
  <div className={`relative overflow-hidden rounded-3xl p-5 text-white shadow-lg ${gradient}`}>
    <div className="absolute -top-8 -right-8 w-28 h-28 bg-white/10 rounded-full" />
    <div className="absolute -bottom-6 -left-4 w-20 h-20 bg-white/10 rounded-full" />
    <div className="relative z-10 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="bg-white/20 backdrop-blur-sm p-2.5 rounded-xl">
          <Icon size={20} className="text-white" />
        </div>
        {sub !== undefined && (
          <span className={`flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded-full ${isPositive ? 'bg-white/20' : 'bg-black/20'}`}>
            {isPositive ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />} {sub}
          </span>
        )}
      </div>
      <div>
        <div className="text-white/70 text-[11px] font-semibold">{title}</div>
        <div className="text-2xl font-black mt-0.5 leading-tight">{value}</div>
      </div>
    </div>
  </div>
);

// ─── Main Component ────────────────────────────────────────────────────────────
const AccountingReports: React.FC = () => {
  const { isDark } = useTheme();
  const sym = localStorage.getItem('Dragon_currency') || 'ج.م';

  const today = new Date();
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
  const [startDate, setStartDate] = useState(firstDay.toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState(today.toISOString().slice(0, 10));
  const [repFilter, setRepFilter] = useState('');
  const [tab, setTab] = useState<'summary' | 'products' | 'reps' | 'daily' | 'orders'>('summary');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);
  const [reps, setReps] = useState<any[]>([]);
  const [noCostWarn, setNoCostWarn] = useState(false);

  // Load reps for filter
  useEffect(() => {
    fetch(`${API_BASE_PATH}/api.php?module=users&action=getAllWithBalance&related_to_type=rep`)
      .then(r => r.json()).then(j => {
        if (j.success) setReps((j.data || []).filter((u: any) => u.role === 'representative'));
      }).catch(() => { });
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = `start_date=${startDate}&end_date=${endDate}${repFilter ? `&rep_id=${repFilter}` : ''}`;
      const res = await fetch(`${API_BASE_PATH}/api.php?module=reports&action=profitReport&${qs}`);
      const json = await res.json();
      if (json.success) {
        setData(json.data);
        // Warn if no cost_price set
        const hasCost = (json.data?.byProduct || []).some((p: any) => Number(p.cost) > 0);
        setNoCostWarn(!hasCost && (json.data?.summary?.orders_count || 0) > 0);
      } else {
        Swal.fire('تنبيه', json.message || 'لا توجد بيانات.', 'info');
      }
    } catch {
      Swal.fire('خطأ', 'فشل تحميل التقارير.', 'error');
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, repFilter]);

  useEffect(() => { load(); }, [load]);

  const summary = data?.summary || {};
  const returned = data?.returned || {};
  const byProduct: any[] = data?.byProduct || [];
  const byRep: any[] = data?.byRep || [];
  const byDay: any[] = data?.byDay || [];
  const byOrder: any[] = data?.byOrder || [];

  const revenue = Number(summary.revenue || 0);
  const cost = Number(summary.cost || 0);
  const profit = Number(summary.profit || 0);
  const marginPct = Number(summary.margin_pct || 0);
  const ordersCount = Number(summary.orders_count || 0);
  const retOrders = Number(returned.returned_orders || 0);
  const retRevenue = Number(returned.returned_revenue || 0);

  // ─── Tooltip style ───────────────────────────────────────────────────────────
  const tooltipStyle = {
    borderRadius: '14px', border: 'none',
    boxShadow: '0 10px 20px rgba(0,0,0,.15)',
    background: isDark ? '#0f172a' : '#fff',
    color: isDark ? '#f1f5f9' : '#0f172a',
    padding: '10px 14px', textAlign: 'right' as const
  };

  // ─── Export CSV helpers ───────────────────────────────────────────────────────
  const downloadCsv = (filename: string, rows: any[][]) => {
    const csv = rows.map(r => r.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  };

  const exportProducts = () => {
    const rows = [
      ['المنتج', 'اللون', 'المقاس', 'الكمية', 'الإيراد', 'التكلفة', 'الربح', 'هامش الربح %'],
      ...byProduct.map(p => [p.product_name, p.color, p.size, p.qty, p.revenue, p.cost, p.profit, p.margin_pct])
    ];
    downloadCsv(`products_report_${startDate}_to_${endDate}.csv`, rows);
  };

  const exportReps = () => {
    const rows = [
      ['المندوب', 'أوردرات', 'قطع', 'الإيراد', 'التكلفة', 'الربح', 'هامش الربح %'],
      ...byRep.map(r => [r.rep_name, r.orders_count, r.items_count, r.revenue, r.cost, r.profit, r.margin_pct])
    ];
    downloadCsv(`reps_report_${startDate}_to_${endDate}.csv`, rows);
  };

  const exportOrders = () => {
    const rows = [
      ['رقم الأوردر', 'العميل', 'المندوب', 'التاريخ', 'الحالة', 'الإيراد', 'التكلفة', 'الربح', 'هامش %'],
      ...byOrder.map(o => [o.order_number, o.customer_name, o.rep_name, o.date, STATUS_LABELS[o.status] || o.status, o.revenue, o.cost, o.profit, o.margin_pct])
    ];
    downloadCsv(`orders_report_${startDate}_to_${endDate}.csv`, rows);
  };

  const printReport = () => window.print();

  // ─── Quick date ranges ────────────────────────────────────────────────────────
  const quickRanges = [
    { label: 'اليوم', s: today.toISOString().slice(0, 10), e: today.toISOString().slice(0, 10) },
    { label: 'هذا الشهر', s: firstDay.toISOString().slice(0, 10), e: today.toISOString().slice(0, 10) },
    { label: 'آخر 7 أيام', s: new Date(today.getTime() - 6 * 864e5).toISOString().slice(0, 10), e: today.toISOString().slice(0, 10) },
    { label: 'آخر 30 يوم', s: new Date(today.getTime() - 29 * 864e5).toISOString().slice(0, 10), e: today.toISOString().slice(0, 10) },
  ];

  // ─── Tabs config ─────────────────────────────────────────────────────────────
  const tabs = [
    { key: 'summary', label: 'ملخص الأرباح', icon: BarChart3 },
    { key: 'products', label: 'المنتجات', icon: Package },
    { key: 'reps', label: 'المناديب', icon: Users },
    { key: 'daily', label: 'يومي / رسم', icon: Calendar },
    { key: 'orders', label: 'الأوردرات', icon: List },
  ] as const;

  // ─── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5 print:bg-white print:text-black">

      {/* Header */}
      <div className="relative overflow-hidden rounded-[2rem] bg-gradient-to-l from-violet-700 via-purple-600 to-indigo-700 p-6 shadow-xl print:hidden">
        <div className="absolute -top-12 -right-8 w-48 h-48 bg-white/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-16 -left-6 w-56 h-56 bg-indigo-400/20 rounded-full blur-3xl" />
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center gap-4">
          <div className="flex-1">
            <div className="text-white/70 text-xs font-semibold mb-1">نظام التقارير المحاسبية</div>
            <h1 className="text-2xl font-black text-white">تقارير الأرباح والخسائر</h1>
            <p className="text-white/60 text-xs mt-1">مبني على بيانات فعلية من قاعدة البيانات • سعر الجملة = التكلفة</p>
          </div>
          {/* Summary mini-badges */}
          <div className="flex flex-wrap gap-2">
            {[
              { label: 'الإيراد', val: `${fmt(revenue)} ${sym}` },
              { label: 'الربح', val: `${fmt(profit)} ${sym}` },
              { label: 'الهامش', val: fmtPct(marginPct) },
            ].map(b => (
              <div key={b.label} className="bg-white/15 backdrop-blur-sm border border-white/20 rounded-2xl px-4 py-2.5 text-right">
                <div className="text-white/60 text-[10px] font-semibold">{b.label}</div>
                <div className="text-white font-black text-sm">{loading ? '...' : b.val}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Filters bar */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 flex flex-wrap gap-3 items-center shadow-sm print:hidden">
        {quickRanges.map(q => (
          <button key={q.label}
            onClick={() => { setStartDate(q.s); setEndDate(q.e); }}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${startDate === q.s && endDate === q.e
              ? 'bg-violet-600 text-white'
              : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
              }`}>
            {q.label}
          </button>
        ))}
        <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
          className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl py-2 px-3 text-sm text-slate-800 dark:text-white" />
        <span className="text-slate-400">—</span>
        <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
          className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl py-2 px-3 text-sm text-slate-800 dark:text-white" />
        {reps.length > 0 && (
          <CustomSelect
            value={repFilter}
            onChange={v => setRepFilter(v)}
            options={[{ value: '', label: 'كل المناديب' }, ...reps.map(r => ({ value: String(r.id), label: r.name }))]}
          />
        )}
        <button onClick={load} disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-xl font-bold disabled:opacity-60 text-sm">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          {loading ? 'تحميل...' : 'تحديث'}
        </button>
        <button onClick={printReport} className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl font-bold text-sm">
          <Printer size={14} /> طباعة
        </button>
      </div>

      {/* No cost_price warning */}
      {noCostWarn && (
        <div className="flex items-center gap-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/40 rounded-2xl px-5 py-3 print:hidden">
          <AlertCircle size={18} className="text-amber-500 flex-shrink-0" />
          <p className="text-sm text-amber-700 dark:text-amber-300 font-medium">
            <strong>تنبيه:</strong> لم يُسجَّل سعر الجملة (cost_price) لأي منتج. أرقام الربح ستكون غير دقيقة.
            أدخل أسعار الجملة في صفحة المنتجات لرؤية أرباح حقيقية.
          </p>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard title="إجمالي الإيرادات" value={`${fmt(revenue)} ${sym}`}
          gradient="bg-gradient-to-br from-blue-600 to-blue-800"
          icon={DollarSign} isPositive={revenue > 0} />
        <KpiCard title="إجمالي التكلفة" value={`${fmt(cost)} ${sym}`}
          gradient="bg-gradient-to-br from-orange-500 to-orange-700"
          icon={ShoppingCart} isPositive={false} />
        <KpiCard title="صافي الربح" value={`${fmt(profit)} ${sym}`}
          sub={fmtPct(marginPct)} icon={profit >= 0 ? TrendingUp : TrendingDown}
          gradient={`bg-gradient-to-br ${profit >= 0 ? 'from-emerald-500 to-teal-700' : 'from-rose-500 to-red-700'}`}
          isPositive={profit >= 0} />
        <KpiCard title="أوردرات مسلَّمة" value={fmt(ordersCount)}
          sub={`مرتجع: ${fmt(retOrders)}`} icon={Award}
          gradient="bg-gradient-to-br from-violet-500 to-purple-700"
          isPositive={retOrders === 0} />
      </div>

      {/* Tabs */}
      <div className="flex bg-white dark:bg-slate-800 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-x-auto print:hidden">
        {tabs.map(t => (
          <button key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all shrink-0 ${tab === t.key ? 'bg-violet-600 text-white shadow-md' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'
              }`}>
            <t.icon size={14} /> {t.label}
          </button>
        ))}
      </div>

      {/* ── TAB: Summary P&L ── */}
      {tab === 'summary' && (
        <div className="space-y-5">
          {/* P&L Statement table */}
          <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-700 flex items-center gap-2">
              <FileText size={16} className="text-violet-500" />
              <span className="font-black text-slate-800 dark:text-slate-100">قائمة الأرباح والخسائر</span>
              <span className="text-xs text-slate-400 mr-auto">{startDate} — {endDate}</span>
            </div>
            <div className="p-6">
              <table className="w-full text-right text-sm">
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                  {[
                    { label: '+ الإيرادات من المبيعات المسلَّمة', val: revenue, cls: 'text-blue-600 dark:text-blue-400 font-black' },
                    { label: '- المرتجعات (خارج التقرير)', val: retRevenue, cls: 'text-rose-500 dark:text-rose-400 font-bold', neg: true },
                    { label: '= صافي الإيرادات', val: revenue, cls: 'font-black text-slate-800 dark:text-slate-100 text-base bg-slate-50 dark:bg-slate-700/50' },
                    { label: '- تكلفة البضاعة المباعة (COGS)', val: cost, cls: 'text-orange-600 dark:text-orange-400 font-bold', neg: true },
                    { label: '= إجمالي الربح', val: profit, cls: `font-black text-lg ${profit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}` },
                    { label: 'هامش الربح %', val: null, pct: marginPct, cls: 'text-violet-600 dark:text-violet-400 font-bold' },
                    { label: 'عدد الأوردرات المسلَّمة', val: null, cnt: ordersCount, cls: 'text-slate-600 dark:text-slate-300' },
                    { label: 'عدد الأوردرات المرتجعة', val: null, cnt: retOrders, cls: 'text-rose-500 dark:text-rose-400' },
                  ].map((row, i) => (
                    <tr key={i} className={`${i === 4 ? 'border-t-2 border-slate-300 dark:border-slate-500' : ''}`}>
                      <td className={`py-3 px-4 ${row.cls}`}>{row.label}</td>
                      <td className={`py-3 px-4 text-left font-bold ${row.cls}`}>
                        {row.val !== null && row.val !== undefined
                          ? `${row.neg ? '(' : ''}${fmt(row.val)}${row.neg ? ')' : ''} ${sym}`
                          : row.pct !== undefined
                            ? fmtPct(row.pct)
                            : row.cnt !== undefined
                              ? fmt(row.cnt)
                              : ''}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pie chart: Revenue vs Cost vs Profit */}
          {revenue > 0 && (
            <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 p-6 shadow-sm">
              <h3 className="font-black text-slate-800 dark:text-slate-100 mb-4">توزيع الإيراد</h3>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-center">
                <div style={{ height: 260 }}>
                  <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1} initialDimension={{ width: 1, height: 1 }}>
                    <PieChart>
                      <Pie
                        data={[
                          { name: 'تكلفة', value: cost },
                          { name: 'ربح', value: Math.max(0, profit) },
                        ]}
                        cx="50%" cy="50%" innerRadius={60} outerRadius={100}
                        paddingAngle={3} dataKey="value">
                        {['#f97316', '#10b981'].map((c, i) => <Cell key={i} fill={c} />)}
                      </Pie>
                      <Tooltip contentStyle={tooltipStyle} formatter={(v: any) => `${fmt(v)} ${sym}`} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="space-y-4">
                  {[
                    { label: 'الإيراد الإجمالي', val: revenue, color: 'bg-blue-500' },
                    { label: 'تكلفة البضاعة', val: cost, color: 'bg-orange-500', pct: revenue > 0 ? cost / revenue * 100 : 0 },
                    { label: 'صافي الربح', val: profit, color: 'bg-emerald-500', pct: marginPct },
                  ].map(item => (
                    <div key={item.label} className="flex items-center gap-3">
                      <div className={`w-3 h-3 rounded-full flex-shrink-0 ${item.color}`} />
                      <div className="flex-1">
                        <div className="flex justify-between mb-1">
                          <span className="text-sm font-bold text-slate-700 dark:text-slate-200">{item.label}</span>
                          <span className="text-sm font-black text-slate-800 dark:text-slate-100">
                            {fmt(item.val)} {sym}
                            {item.pct !== undefined && <span className="text-xs text-slate-400 mr-1">({fmtPct(item.pct)})</span>}
                          </span>
                        </div>
                        {revenue > 0 && (
                          <div className="h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${item.color}`}
                              style={{ width: `${Math.min(100, Math.abs(item.val) / revenue * 100)}%` }} />
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── TAB: Products ── */}
      {tab === 'products' && (
        <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-700 flex items-center gap-2">
            <Package size={16} className="text-violet-500" />
            <span className="font-black text-slate-800 dark:text-slate-100">تقرير الأرباح حسب المنتج</span>
            <span className="text-xs text-slate-400">({byProduct.length} منتج)</span>
            <button onClick={exportProducts} className="mr-auto flex items-center gap-1 text-xs px-3 py-1.5 bg-emerald-600 text-white rounded-xl font-bold">
              <Download size={12} /> CSV
            </button>
          </div>
          {/* Bar chart */}
          {byProduct.length > 0 && (
            <div className="p-4">
              <div style={{ height: 240 }}>
                <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1} initialDimension={{ width: 1, height: 1 }}>
                  <BarChart data={byProduct.slice(0, 10)} barGap={2}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? '#334155' : '#e2e8f0'} />
                    <XAxis dataKey="product_name" tick={{ fill: isDark ? '#94a3b8' : '#64748b', fontSize: 10 }} />
                    <YAxis tick={{ fill: isDark ? '#94a3b8' : '#64748b', fontSize: 10 }} />
                    <Tooltip contentStyle={tooltipStyle} formatter={(v: any) => `${fmt(v)} ${sym}`} />
                    <Bar dataKey="revenue" name="الإيراد" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={14} />
                    <Bar dataKey="cost" name="التكلفة" fill="#f97316" radius={[4, 4, 0, 0]} barSize={14} />
                    <Bar dataKey="profit" name="الربح" fill="#10b981" radius={[4, 4, 0, 0]} barSize={14} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead className="bg-slate-50 dark:bg-slate-900/30 text-slate-500 dark:text-slate-400 text-xs">
                <tr>
                  <th className="px-4 py-3">#</th>
                  <th className="px-4 py-3">المنتج</th>
                  <th className="px-4 py-3">اللون</th>
                  <th className="px-4 py-3">المقاس</th>
                  <th className="px-4 py-3">الكمية</th>
                  <th className="px-4 py-3">الإيراد ({sym})</th>
                  <th className="px-4 py-3">التكلفة ({sym})</th>
                  <th className="px-4 py-3">الربح ({sym})</th>
                  <th className="px-4 py-3">هامش %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {byProduct.length === 0 ? (
                  <tr><td colSpan={9} className="py-10 text-center text-slate-400">لا توجد بيانات</td></tr>
                ) : byProduct.map((p, i) => (
                  <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                    <td className="px-4 py-3 text-slate-400 text-xs">{i + 1}</td>
                    <td className="px-4 py-3 font-bold text-slate-800 dark:text-slate-100">{p.product_name}</td>
                    <td className="px-4 py-3 text-xs text-slate-500">{p.color || '—'}</td>
                    <td className="px-4 py-3 text-xs text-slate-500">{p.size || '—'}</td>
                    <td className="px-4 py-3">
                      <span className="bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full text-xs font-bold">{fmt(p.qty)}</span>
                    </td>
                    <td className="px-4 py-3 font-bold text-blue-600 dark:text-blue-400">{fmt(p.revenue)}</td>
                    <td className="px-4 py-3 text-orange-600 dark:text-orange-400">{Number(p.cost) > 0 ? fmt(p.cost) : <span className="text-slate-400 text-xs">غير محدد</span>}</td>
                    <td className={`px-4 py-3 font-black ${Number(p.profit) >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                      {Number(p.cost) > 0 ? fmt(p.profit) : <span className="text-slate-400 text-xs">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      {Number(p.cost) > 0 ? (
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${Number(p.margin_pct) >= 0 ? 'bg-emerald-500' : 'bg-rose-500'}`}
                              style={{ width: `${Math.min(100, Math.abs(Number(p.margin_pct)))}%` }} />
                          </div>
                          <span className="text-xs font-bold text-slate-600 dark:text-slate-300 w-12">{fmtPct(p.margin_pct)}</span>
                        </div>
                      ) : <span className="text-slate-400 text-xs">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
              {byProduct.length > 0 && (
                <tfoot className="bg-violet-50 dark:bg-violet-900/20 font-black text-sm">
                  <tr>
                    <td colSpan={5} className="px-4 py-3">الإجمالي</td>
                    <td className="px-4 py-3 text-blue-700 dark:text-blue-300">{fmt(revenue)}</td>
                    <td className="px-4 py-3 text-orange-700 dark:text-orange-300">{fmt(cost)}</td>
                    <td className={`px-4 py-3 ${profit >= 0 ? 'text-emerald-700 dark:text-emerald-300' : 'text-rose-700 dark:text-rose-300'}`}>{fmt(profit)}</td>
                    <td className="px-4 py-3 text-violet-700 dark:text-violet-300">{fmtPct(marginPct)}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      )}

      {/* ── TAB: Reps ── */}
      {tab === 'reps' && (
        <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-700 flex items-center gap-2">
            <Users size={16} className="text-violet-500" />
            <span className="font-black text-slate-800 dark:text-slate-100">تقرير الأرباح حسب المندوب</span>
            <button onClick={exportReps} className="mr-auto flex items-center gap-1 text-xs px-3 py-1.5 bg-emerald-600 text-white rounded-xl font-bold">
              <Download size={12} /> CSV
            </button>
          </div>
          {byRep.length > 0 && (
            <div className="p-4">
              <div style={{ height: 240 }}>
                <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1} initialDimension={{ width: 1, height: 1 }}>
                  <BarChart data={byRep} barGap={2}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? '#334155' : '#e2e8f0'} />
                    <XAxis dataKey="rep_name" tick={{ fill: isDark ? '#94a3b8' : '#64748b', fontSize: 10 }} />
                    <YAxis tick={{ fill: isDark ? '#94a3b8' : '#64748b', fontSize: 10 }} />
                    <Tooltip contentStyle={tooltipStyle} formatter={(v: any) => `${fmt(v)} ${sym}`} />
                    <Bar dataKey="revenue" name="الإيراد" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={18} />
                    <Bar dataKey="profit" name="الربح" fill="#10b981" radius={[4, 4, 0, 0]} barSize={18} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead className="bg-slate-50 dark:bg-slate-900/30 text-slate-500 dark:text-slate-400 text-xs">
                <tr>
                  <th className="px-4 py-3">#</th>
                  <th className="px-4 py-3">المندوب</th>
                  <th className="px-4 py-3">الأوردرات</th>
                  <th className="px-4 py-3">القطع</th>
                  <th className="px-4 py-3">الإيراد ({sym})</th>
                  <th className="px-4 py-3">التكلفة ({sym})</th>
                  <th className="px-4 py-3">الربح ({sym})</th>
                  <th className="px-4 py-3">هامش %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {byRep.length === 0 ? (
                  <tr><td colSpan={8} className="py-10 text-center text-slate-400">لا توجد بيانات</td></tr>
                ) : byRep.map((r, i) => (
                  <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                    <td className="px-4 py-3 text-slate-400">{['🥇', '🥈', '🥉'][i] || i + 1}</td>
                    <td className="px-4 py-3 font-bold text-slate-800 dark:text-slate-100">{r.rep_name || '—'}</td>
                    <td className="px-4 py-3 text-center">
                      <span className="bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full text-xs font-bold">{r.orders_count}</span>
                    </td>
                    <td className="px-4 py-3 text-center text-slate-600 dark:text-slate-300">{fmt(r.items_count)}</td>
                    <td className="px-4 py-3 font-bold text-blue-600 dark:text-blue-400">{fmt(r.revenue)}</td>
                    <td className="px-4 py-3 text-orange-600 dark:text-orange-400">{fmt(r.cost)}</td>
                    <td className={`px-4 py-3 font-black ${Number(r.profit) >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>{fmt(r.profit)}</td>
                    <td className="px-4 py-3 text-violet-600 dark:text-violet-400 font-bold">{fmtPct(r.margin_pct)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── TAB: Daily Chart ── */}
      {tab === 'daily' && (
        <div className="space-y-5">
          <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 p-6 shadow-sm">
            <h3 className="font-black text-slate-800 dark:text-slate-100 mb-5">منحنى الإيرادات والأرباح اليومي</h3>
            {byDay.length === 0 ? (
              <div className="text-center py-12 text-slate-400">لا توجد بيانات للرسم البياني</div>
            ) : (
              <div style={{ height: 320 }}>
                <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1} initialDimension={{ width: 1, height: 1 }}>
                  <AreaChart data={byDay}>
                    <defs>
                      <linearGradient id="grRev" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="grPro" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? '#334155' : '#e2e8f0'} />
                    <XAxis dataKey="date" tick={{ fill: isDark ? '#94a3b8' : '#64748b', fontSize: 10 }} />
                    <YAxis tick={{ fill: isDark ? '#94a3b8' : '#64748b', fontSize: 10 }} />
                    <Tooltip contentStyle={tooltipStyle} formatter={(v: any) => `${fmt(v)} ${sym}`} />
                    <Area type="monotone" dataKey="revenue" name="الإيراد" stroke="#3b82f6" strokeWidth={2} fill="url(#grRev)" dot={{ r: 3 }} />
                    <Area type="monotone" dataKey="cost" name="التكلفة" stroke="#f97316" strokeWidth={2} fill="url(#grPro)" dot={{ r: 3 }} />
                    <Area type="monotone" dataKey="profit" name="الربح" stroke="#10b981" strokeWidth={2.5} fill="url(#grPro)" dot={{ r: 3 }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
          {/* Daily table */}
          <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-700">
              <span className="font-black text-slate-800 dark:text-slate-100">تفاصيل يومية</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-right text-sm">
                <thead className="bg-slate-50 dark:bg-slate-900/30 text-slate-500 dark:text-slate-400 text-xs">
                  <tr>
                    <th className="px-4 py-3">التاريخ</th>
                    <th className="px-4 py-3">أوردرات</th>
                    <th className="px-4 py-3">الإيراد ({sym})</th>
                    <th className="px-4 py-3">التكلفة ({sym})</th>
                    <th className="px-4 py-3">الربح ({sym})</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                  {byDay.length === 0 ? (
                    <tr><td colSpan={5} className="py-10 text-center text-slate-400">لا توجد بيانات</td></tr>
                  ) : byDay.map((d, i) => (
                    <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                      <td className="px-4 py-3 font-mono text-slate-600 dark:text-slate-300">{d.date}</td>
                      <td className="px-4 py-3 text-center">
                        <span className="bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full text-xs font-bold">{d.orders_count}</span>
                      </td>
                      <td className="px-4 py-3 font-bold text-blue-600 dark:text-blue-400">{fmt(d.revenue)}</td>
                      <td className="px-4 py-3 text-orange-600 dark:text-orange-400">{fmt(d.cost)}</td>
                      <td className={`px-4 py-3 font-black ${Number(d.profit) >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>{fmt(d.profit)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB: Orders ── */}
      {tab === 'orders' && (
        <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-700 flex items-center gap-2">
            <List size={16} className="text-violet-500" />
            <span className="font-black text-slate-800 dark:text-slate-100">تقرير الأوردرات التفصيلي</span>
            <span className="text-xs text-slate-400">({byOrder.length} أوردر)</span>
            <button onClick={exportOrders} className="mr-auto flex items-center gap-1 text-xs px-3 py-1.5 bg-emerald-600 text-white rounded-xl font-bold">
              <Download size={12} /> CSV
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead className="bg-slate-50 dark:bg-slate-900/30 text-slate-500 dark:text-slate-400 text-xs">
                <tr>
                  <th className="px-4 py-3">رقم الأوردر</th>
                  <th className="px-4 py-3">العميل</th>
                  <th className="px-4 py-3">المندوب</th>
                  <th className="px-4 py-3">التاريخ</th>
                  <th className="px-4 py-3">الحالة</th>
                  <th className="px-4 py-3">الإيراد ({sym})</th>
                  <th className="px-4 py-3">التكلفة ({sym})</th>
                  <th className="px-4 py-3">الربح ({sym})</th>
                  <th className="px-4 py-3">هامش %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {byOrder.length === 0 ? (
                  <tr><td colSpan={9} className="py-10 text-center text-slate-400">لا توجد بيانات</td></tr>
                ) : byOrder.map((o, i) => (
                  <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                    <td className="px-4 py-3 font-mono text-violet-600 dark:text-violet-400 font-bold">{o.order_number}</td>
                    <td className="px-4 py-3 text-slate-800 dark:text-slate-100 font-medium">{o.customer_name || '—'}</td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{o.rep_name || '—'}</td>
                    <td className="px-4 py-3 text-slate-500 text-xs font-mono">{o.date}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${o.status === 'delivered' ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300' :
                        o.status === 'partial' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' :
                          'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                        }`}>{STATUS_LABELS[o.status] || o.status}</span>
                    </td>
                    <td className="px-4 py-3 font-bold text-blue-600 dark:text-blue-400">{fmt(o.revenue)}</td>
                    <td className="px-4 py-3 text-orange-600 dark:text-orange-400">{Number(o.cost) > 0 ? fmt(o.cost) : <span className="text-slate-400 text-xs">—</span>}</td>
                    <td className={`px-4 py-3 font-black ${Number(o.profit) >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                      {Number(o.cost) > 0 ? fmt(o.profit) : <span className="text-slate-400 text-xs">—</span>}
                    </td>
                    <td className="px-4 py-3 text-xs font-bold text-violet-600 dark:text-violet-400">
                      {Number(o.cost) > 0 ? fmtPct(o.margin_pct) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
              {byOrder.length > 0 && (
                <tfoot className="bg-violet-50 dark:bg-violet-900/20 font-black text-sm">
                  <tr>
                    <td colSpan={5} className="px-4 py-3">الإجمالي ({byOrder.length} أوردر)</td>
                    <td className="px-4 py-3 text-blue-700 dark:text-blue-300">{fmt(revenue)}</td>
                    <td className="px-4 py-3 text-orange-700 dark:text-orange-300">{fmt(cost)}</td>
                    <td className={`px-4 py-3 ${profit >= 0 ? 'text-emerald-700 dark:text-emerald-300' : 'text-rose-700 dark:text-rose-300'}`}>{fmt(profit)}</td>
                    <td className="px-4 py-3 text-violet-700 dark:text-violet-300">{fmtPct(marginPct)}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      )}

    </div>
  );
};

export default AccountingReports;
