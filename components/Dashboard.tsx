import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTheme } from './ThemeContext';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell
} from 'recharts';
import {
  TrendingUp, Users, Package, DollarSign,
  ArrowUpRight, ArrowDownRight, ClipboardCheck, Briefcase,
  AlertTriangle, Sparkles, Award, Building2, UserCheck,
  ShoppingBag, Activity, Map, AlertCircle, CheckCircle
} from 'lucide-react';
import { API_BASE_PATH } from '../services/apiConfig';
import { assetUrl } from '../services/assetUrl';

const fmt = (n: number) => n.toLocaleString('ar-EG');
const fmtCur = (n: number, sym = 'ج.م') => `${fmt(n)} ${sym}`;

const MEDAL = ['🥇', '🥈', '🥉'];
const PIE_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

const STATUS_LABELS: Record<string, string> = {
  pending: 'معلق', confirmed: 'مؤكد', processing: 'قيد التنفيذ',
  shipped: 'مشحون', delivered: 'مُسلَّم', cancelled: 'ملغي',
  returned: 'مرتجع', with_rep: 'مع المندوب', in_delivery: 'قيد التسليم',
};
const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-700', confirmed: 'bg-blue-100 text-blue-700',
  processing: 'bg-indigo-100 text-indigo-700', shipped: 'bg-cyan-100 text-cyan-700',
  delivered: 'bg-emerald-100 text-emerald-700', cancelled: 'bg-rose-100 text-rose-700',
};

const KpiCard = ({ title, value, sub, isPositive, icon: Icon, gradient }: any) => (
  <div className={`relative overflow-hidden rounded-3xl p-5 text-white shadow-lg ${gradient}`}>
    <div className="absolute -top-8 -right-8 w-32 h-32 bg-white/10 rounded-full" />
    <div className="absolute -bottom-6 -left-4 w-24 h-24 bg-white/10 rounded-full" />
    <div className="relative z-10 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="bg-white/20 backdrop-blur-sm p-2.5 rounded-xl">
          <Icon size={20} className="text-white" />
        </div>
        {sub && (
          <span className={`flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded-full ${isPositive ? 'bg-white/20' : 'bg-black/20'}`}>
            {isPositive ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
            {sub}
          </span>
        )}
      </div>
      <div>
        <div className="text-white/70 text-[11px] font-semibold tracking-wide">{title}</div>
        <div className="text-2xl font-black mt-0.5 leading-tight">{value}</div>
      </div>
    </div>
  </div>
);

const LeaderCard = ({ title, icon: Icon, color, data, valueKey, labelKey, formatValue, emptyText }: any) => (
  <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
    <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-700 flex items-center gap-2">
      <div className={`p-2 rounded-xl ${color}`}>
        <Icon size={16} className="text-white" />
      </div>
      <span className="font-black text-slate-800 dark:text-slate-100">{title}</span>
    </div>
    <div className="p-4 space-y-2">
      {(!data || data.length === 0) ? (
        <div className="text-center text-sm text-slate-400 py-6">{emptyText || 'لا توجد بيانات للفترة المحددة.'}</div>
      ) : data.map((item: any, idx: number) => {
        const maxVal = data[0][valueKey] || 1;
        const pct = Math.round((item[valueKey] / maxVal) * 100);
        return (
          <div key={item.id || idx} className="flex items-center gap-3">
            <span className="text-base w-6 text-center flex-shrink-0">{MEDAL[idx] || `${idx + 1}`}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate">{item[labelKey]}</span>
                <span className="text-xs font-black text-slate-600 dark:text-slate-300 mr-2 flex-shrink-0">{formatValue(item)}</span>
              </div>
              <div className="h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${pct}%`, background: PIE_COLORS[idx % PIE_COLORS.length] }}
                />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  </div>
);

const SectionTitle = ({ title, sub, icon: Icon }: any) => (
  <div className="flex items-center justify-between">
    <div>
      <h2 className="text-lg font-black text-slate-900 dark:text-white">{title}</h2>
      {sub && <p className="text-xs text-slate-500 mt-0.5">{sub}</p>}
    </div>
    {Icon && <Icon size={18} className="text-blue-500" />}
  </div>
);

const Dashboard: React.FC = () => {
  const { isDark } = useTheme();
  const currencySymbol = localStorage.getItem('Dragon_currency') || 'ج.م';
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState<any>(null);
  const today = new Date();
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
  const [startDate, setStartDate] = useState(firstDay.toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(today.toISOString().split('T')[0]);
  const didAutoShiftInitialRange = useRef(false);

  const companyLogo = localStorage.getItem('Dragon_company_logo') || assetUrl('Dragon.png');
  const companyName = localStorage.getItem('Dragon_company_name') || 'Dragon Pro';
  const userName = (() => {
    try { return JSON.parse(localStorage.getItem('Dragon_user') || '{}')?.name || 'النظام'; }
    catch { return 'النظام'; }
  })();

  const fetchOverview = async (rangeStart: string, rangeEnd: string) => {
    const qs = `&start_date=${encodeURIComponent(rangeStart)}&end_date=${encodeURIComponent(rangeEnd)}`;
    const res = await fetch(`${API_BASE_PATH}/api.php?module=dashboard&action=overview${qs}`);
    return res.json();
  };

  const load = async () => {
    setLoading(true);
    try {
      const data = await fetchOverview(startDate, endDate);
      if (data.success) {
        const overviewData = data.data;
        const latestOrderDate = String(overviewData?.latest_order_date || '').slice(0, 10);
        const hasLeaderboardData =
          Number(overviewData?.orders_month || 0) > 0 ||
          (overviewData?.top_reps || []).length > 0 ||
          (overviewData?.top_sales_offices || []).length > 0 ||
          (overviewData?.top_employees || []).length > 0 ||
          (overviewData?.top_products || []).length > 0;

        if (!didAutoShiftInitialRange.current && !hasLeaderboardData && latestOrderDate) {
          const latestDateObj = new Date(latestOrderDate);
          if (!Number.isNaN(latestDateObj.getTime())) {
            const nextStart = new Date(latestDateObj.getFullYear(), latestDateObj.getMonth(), 1).toISOString().split('T')[0];
            const nextEnd = latestOrderDate;
            if (nextStart !== startDate || nextEnd !== endDate) {
              didAutoShiftInitialRange.current = true;
              const shiftedData = await fetchOverview(nextStart, nextEnd);
              setStartDate(nextStart);
              setEndDate(nextEnd);
              if (shiftedData?.success) {
                setOverview(shiftedData.data);
                return;
              }
            }
          }
        }

        setOverview(overviewData);
      }
    } catch { /* keep placeholders */ }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [startDate, endDate]);

  const revenue   = Number(overview?.revenue_month || 0);
  const profit    = Number(overview?.profit_month || 0);
  const prevRev   = Number(overview?.prev_revenue || 0);
  const margin    = revenue > 0 ? (profit / revenue) * 100 : 0;
  const changePct = typeof overview?.revenue_change_pct === 'number' ? overview.revenue_change_pct : null;
  const ordersMonth     = Number(overview?.orders_month || 0);
  const ordersDelivered = Number(overview?.orders_delivered || 0);
  const ordersReturned  = Number(overview?.orders_returned || 0);
  const ordersPending   = Number(overview?.orders_pending || 0);
  const lowStock        = Number(overview?.low_stock_count || 0);
  const absent          = Number(overview?.attendance_today?.absent || 0);
  const present         = Number(overview?.attendance_today?.present || 0);

  const trend = useMemo(() => {
    if (!overview?.trend) return [];
    return overview.trend.map((t: any) => ({
      name: t.date?.slice(5) || '',
      sales: Number(t.sales || 0),
      profit: Number(t.profit || 0)
    }));
  }, [overview]);

  const bestDay = useMemo(() =>
    trend.length ? trend.reduce((a: any, c: any) => c.sales > a.sales ? c : a, trend[0]) : null,
    [trend]);

  const topReps:    any[] = overview?.top_reps          || [];
  const topOffices: any[] = overview?.top_sales_offices || [];
  const topEmps:    any[] = overview?.top_employees      || [];
  const topProds:   any[] = overview?.top_products       || [];
  const salesByGov: any[] = overview?.sales_by_gov       || [];
  const lowStockDetails: any[] = overview?.low_stock_details || [];

  const tooltip_style = {
    borderRadius: '16px', border: 'none',
    boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.12)',
    textAlign: 'right' as const,
    backgroundColor: isDark ? '#0f172a' : '#fff',
    color: isDark ? '#f1f5f9' : '#0f172a',
    padding: '10px 16px'
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 transition-colors pb-12">

      {/* Header */}
      <div className="relative overflow-hidden rounded-[2rem] bg-gradient-to-l from-blue-700 via-blue-600 to-indigo-700 p-7 shadow-xl">
        <div className="absolute -top-16 -right-12 w-56 h-56 bg-white/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-20 -left-10 w-64 h-64 bg-indigo-400/20 rounded-full blur-3xl" />
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center gap-5">
          <div className="flex items-center gap-4 flex-1">
            <div className="w-14 h-14 rounded-2xl bg-white/20 border border-white/30 overflow-hidden flex-shrink-0">
              <img src={companyLogo} alt="logo" className="w-full h-full object-cover"
                onError={(e: any) => { e.target.src = assetUrl('Dragon.png'); }} />
            </div>
            <div>
              <div className="text-white/70 text-xs font-semibold">{companyName}</div>
              <h1 className="text-3xl font-black text-white tracking-tight">لوحة التحكم</h1>
              <div className="text-white/60 text-[11px] mt-1">
                {userName} &bull; {new Date().toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 lg:justify-end">
            {[
              { label: 'الإيرادات', value: loading ? '...' : fmtCur(revenue, currencySymbol) },
              { label: 'هامش الربح', value: loading ? '...' : `${margin.toFixed(1)}%` },
              { label: 'أفضل يوم', value: bestDay?.name || '—' },
              { label: 'طلبات معلقة', value: loading ? '...' : fmt(ordersPending) },
            ].map(p => (
              <div key={p.label} className="bg-white/15 backdrop-blur-sm border border-white/20 rounded-2xl px-4 py-2.5 text-right">
                <div className="text-white/60 text-[10px] font-semibold">{p.label}</div>
                <div className="text-white font-black text-sm">{p.value}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Date Filter */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 flex flex-wrap gap-3 items-center justify-between shadow-sm">
        <div>
          <div className="text-sm font-black text-slate-800 dark:text-slate-100">فلترة الفترة الزمنية</div>
          <div className="text-[11px] text-slate-500">جميع المؤشرات تُحسب خلال النطاق المحدد</div>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          {[
            { label: 'اليوم', s: today.toISOString().split('T')[0], e: today.toISOString().split('T')[0] },
            { label: 'هذا الشهر', s: firstDay.toISOString().split('T')[0], e: today.toISOString().split('T')[0] },
            { label: 'آخر 90 يوم', s: new Date(today.getTime() - 89 * 86400000).toISOString().split('T')[0], e: today.toISOString().split('T')[0] },
          ].map(q => (
            <button key={q.label} onClick={() => { setStartDate(q.s); setEndDate(q.e); }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${startDate === q.s && endDate === q.e ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'}`}>
              {q.label}
            </button>
          ))}
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
            className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl py-1.5 px-3 text-sm text-slate-800 dark:text-white" />
          <span className="text-slate-400 text-sm">—</span>
          <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
            className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl py-1.5 px-3 text-sm text-slate-800 dark:text-white" />
        </div>
      </div>

      {/* KPI Row 1 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard title="إيرادات المسلَّمة" gradient="bg-gradient-to-br from-blue-600 to-blue-800"
          value={loading ? '...' : fmtCur(revenue, currencySymbol)}
          sub={changePct !== null ? `${Math.abs(changePct).toFixed(1)}%` : undefined}
          isPositive={changePct !== null ? changePct >= 0 : true} icon={DollarSign} />
        <KpiCard title="صافي الأرباح" gradient="bg-gradient-to-br from-emerald-500 to-teal-700"
          value={loading ? '...' : fmtCur(profit, currencySymbol)}
          sub={loading ? undefined : `هامش ${margin.toFixed(1)}%`}
          isPositive={profit >= 0} icon={TrendingUp} />
        <KpiCard title="أوردرات مسلَّمة" gradient="bg-gradient-to-br from-emerald-500 to-green-700"
          value={loading ? '...' : fmt(ordersDelivered)}
          sub={loading ? undefined : `معلق: ${fmt(ordersPending)}`}
          isPositive={ordersPending < 10} icon={ClipboardCheck} />
        <KpiCard title="أوردرات مرتجعة" gradient="bg-gradient-to-br from-rose-500 to-pink-700"
          value={loading ? '...' : fmt(ordersReturned)}
          sub={loading ? undefined : `إجمالي: ${fmt(ordersMonth)}`}
          isPositive={ordersReturned === 0} icon={Briefcase} />
      </div>

      {/* KPI Row 2 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard title="المخزون (وحدة)" gradient="bg-gradient-to-br from-amber-500 to-orange-600"
          value={loading ? '...' : fmt(Number(overview?.stock_units || 0))}
          sub={loading ? undefined : `نقص: ${fmt(lowStock)}`}
          isPositive={lowStock === 0} icon={Package} />
        <KpiCard title="الحضور اليوم" gradient="bg-gradient-to-br from-cyan-500 to-sky-700"
          value={loading ? '...' : fmt(present)}
          sub={loading ? undefined : `غياب: ${fmt(absent)}`}
          isPositive={absent === 0} icon={ClipboardCheck} />
        <KpiCard title="الإيرادات السابقة" gradient="bg-gradient-to-br from-slate-500 to-slate-700"
          value={loading ? '...' : fmtCur(prevRev, currencySymbol)}
          sub={overview?.prev_range_start ? overview.prev_range_start.slice(5) : undefined}
          isPositive={revenue >= prevRev} icon={Activity} />
        <KpiCard title="نسبة النمو" gradient={`bg-gradient-to-br ${changePct !== null && changePct >= 0 ? 'from-green-500 to-emerald-700' : 'from-red-500 to-rose-700'}`}
          value={changePct !== null ? `${changePct >= 0 ? '+' : ''}${changePct.toFixed(1)}%` : '—'}
          sub={loading ? undefined : 'مقارنة بالفترة السابقة'}
          isPositive={changePct !== null ? changePct >= 0 : true} icon={changePct !== null && changePct >= 0 ? ArrowUpRight : ArrowDownRight} />
      </div>

      {/* Analytics Group 1 */}
      <SectionTitle title="الأداء المالي ومصادر البيع" sub="الإيرادات حسب التاريخ وحسب صفحة البيع" icon={TrendingUp} />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-5">
            <h3 className="font-black text-slate-800 dark:text-slate-100">إيرادات وأرباح الفترة</h3>
            <span className="text-[11px] text-slate-500 bg-slate-100 dark:bg-slate-700 px-3 py-1 rounded-full">يومي</span>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={trend} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? '#334155' : '#e2e8f0'} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} fontSize={11} tick={{ fill: isDark ? '#94a3b8' : '#64748b' }} />
                <YAxis axisLine={false} tickLine={false} fontSize={11} orientation="right" tick={{ fill: isDark ? '#94a3b8' : '#64748b' }} />
                <Tooltip contentStyle={tooltip_style} itemStyle={{ fontWeight: 700 }} cursor={{ fill: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(59,130,246,0.04)' }} />
                <Bar dataKey="sales" name="الإيرادات" fill="#3b82f6" radius={[6, 6, 0, 0]} barSize={18} />
                <Bar dataKey="profit" name="الأرباح" fill="#10b981" radius={[6, 6, 0, 0]} barSize={18} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 p-6 shadow-sm">
          <h3 className="font-black text-slate-800 dark:text-slate-100 mb-5">توزيع المبيعات حسب المصدر (Pages)</h3>
          {topOffices.length > 0 ? (
            <>
              <div className="h-44">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={topOffices} cx="50%" cy="50%" innerRadius={48} outerRadius={72} paddingAngle={3} dataKey="total_sales" nameKey="name">
                      {topOffices.map((_: any, i: number) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={tooltip_style} formatter={(v: any) => fmtCur(v, currencySymbol)} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-3 space-y-1.5">
                {topOffices.slice(0, 5).map((r: any, i: number) => (
                  <div key={r.id} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                       <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                      <span className="text-slate-600 dark:text-slate-300 truncate max-w-[100px]">{r.name}</span>
                    </div>
                    <span className="font-bold text-slate-700 dark:text-slate-200">{fmtCur(r.total_sales, currencySymbol)}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-48 text-sm text-slate-400">لا توجد بيانات لمصادر البيع.</div>
          )}
        </div>
      </div>

      {/* Analytics Group 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-5">
            <h3 className="font-black text-slate-800 dark:text-slate-100">المبيعات حسب المحافظات</h3>
            <Map size={16} className="text-blue-500" />
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={salesByGov} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={isDark ? '#334155' : '#e2e8f0'} />
                <XAxis type="number" hide />
                <YAxis dataKey="governorate" type="category" axisLine={false} tickLine={false} fontSize={11} width={80} tick={{ fill: isDark ? '#94a3b8' : '#64748b' }} />
                <Tooltip contentStyle={tooltip_style} formatter={(v: any) => fmtCur(v, currencySymbol)} cursor={{ fill: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(59,130,246,0.04)' }} />
                <Bar dataKey="total" name="الإيرادات" fill="#8b5cf6" radius={[0, 6, 6, 0]} barSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-5">
            <h3 className="font-black text-slate-800 dark:text-slate-100">قائمة نواقص المخزون</h3>
            <AlertCircle size={16} className="text-rose-500" />
          </div>
          <div className="space-y-3 max-h-[250px] overflow-y-auto pr-1">
            {lowStockDetails.length > 0 ? lowStockDetails.map((item: any) => (
              <div key={item.id} className="p-3 bg-rose-50 dark:bg-rose-950/20 rounded-2xl border border-rose-100 dark:border-rose-900/40 flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-rose-700 dark:text-rose-400">{item.product_name}</div>
                  <div className="text-[10px] text-rose-600/70">{item.color} - {item.size}</div>
                </div>
                <div className="text-right">
                  <div className="text-xs font-black text-rose-700 dark:text-rose-400">{item.q} قطعة</div>
                  <div className="text-[9px] text-rose-400">الحد: {item.reorder_level}</div>
                </div>
              </div>
            )) : (
              <div className="text-center py-10">
                <CheckCircle size={32} className="text-emerald-500 mx-auto mb-2 opacity-20" />
                <div className="text-xs text-slate-400 font-bold">المخزون مكتمل حالياً</div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Daily path */}
      <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 p-6 shadow-sm">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-black text-slate-800 dark:text-slate-100">مسار الإيرادات اليومي</h3>
          <span className="text-[11px] bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 px-3 py-1 rounded-full font-bold">ديناميكي</span>
        </div>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trend}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? '#334155' : '#e2e8f0'} />
              <XAxis dataKey="name" axisLine={false} tickLine={false} fontSize={11} tick={{ fill: isDark ? '#94a3b8' : '#64748b' }} />
              <YAxis axisLine={false} tickLine={false} fontSize={11} orientation="right" tick={{ fill: isDark ? '#94a3b8' : '#64748b' }} />
              <Tooltip contentStyle={tooltip_style} />
              <Line type="monotone" dataKey="sales" name="الإيرادات" stroke="#3b82f6" strokeWidth={3}
                dot={{ r: 4, fill: '#3b82f6', strokeWidth: 2, stroke: isDark ? '#0f172a' : '#fff' }} activeDot={{ r: 7 }} />
              <Line type="monotone" dataKey="profit" name="الأرباح" stroke="#10b981" strokeWidth={3}
                dot={{ r: 4, fill: '#10b981', strokeWidth: 2, stroke: isDark ? '#0f172a' : '#fff' }} activeDot={{ r: 7 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Leaderboards */}
      <SectionTitle title="لوحة الشرف" sub="أعلى المناديب والصفحات والموظفين والمنتجات أداءً خلال الفترة" icon={Award} />

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
        <LeaderCard title="أفضل المناديب" icon={Award} color="bg-gradient-to-br from-amber-500 to-orange-600"
          data={topReps} labelKey="name" valueKey="total_sales"
          formatValue={(r: any) => fmtCur(r.total_sales, currencySymbol)} emptyText="لا توجد بيانات للمناديب." />
        <LeaderCard title="أفضل الصفحات" icon={Building2} color="bg-gradient-to-br from-blue-500 to-blue-700"
          data={topOffices} labelKey="name" valueKey="total_sales"
          formatValue={(r: any) => fmtCur(r.total_sales, currencySymbol)} emptyText="لا توجد بيانات للصفحات." />
        <LeaderCard title="أفضل الموظفين" icon={UserCheck} color="bg-gradient-to-br from-emerald-500 to-teal-600"
          data={topEmps} labelKey="name" valueKey="orders_count"
          formatValue={(r: any) => `${fmt(r.orders_count)} أوردر`} emptyText="لا توجد بيانات للموظفين." />
        <LeaderCard title="أكثر المنتجات مبيعاً" icon={ShoppingBag} color="bg-gradient-to-br from-violet-500 to-purple-700"
          data={topProds} labelKey="product_name" valueKey="qty_sold"
          formatValue={(r: any) => `${fmt(r.qty_sold)} قطعة`} emptyText="لا توجد بيانات للمنتجات." />
      </div>

      {/* Detail Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-700 flex items-center gap-2">
            <Award size={16} className="text-amber-500" />
            <span className="font-black text-slate-800 dark:text-slate-100">تفاصيل أداء المناديب</span>
          </div>
          {topReps.length === 0 ? (
            <div className="text-center text-sm text-slate-400 py-10">لا توجد بيانات.</div>
          ) : (
            <table className="w-full text-right text-sm">
              <thead className="text-[11px] text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-900/30">
                <tr>
                  <th className="px-4 py-3 font-semibold">#</th>
                  <th className="px-4 py-3 font-semibold">المندوب</th>
                  <th className="px-4 py-3 font-semibold">الأوردرات</th>
                  <th className="px-4 py-3 font-semibold">المبيعات</th>
                </tr>
              </thead>
              <tbody>
                {topReps.map((r: any, i: number) => (
                  <tr key={r.id} className="border-t border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                    <td className="px-4 py-3 text-base font-bold">{MEDAL[i] || i + 1}</td>
                    <td className="px-4 py-3 font-bold text-slate-800 dark:text-slate-100">{r.name}</td>
                    <td className="px-4 py-3">
                      <span className="bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full text-[11px] font-bold">{fmt(r.orders_count)}</span>
                    </td>
                    <td className="px-4 py-3 font-black text-emerald-600 dark:text-emerald-400">{fmtCur(r.total_sales, currencySymbol)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-700 flex items-center gap-2">
            <UserCheck size={16} className="text-emerald-500" />
            <span className="font-black text-slate-800 dark:text-slate-100">تفاصيل أداء الموظفين</span>
          </div>
          {topEmps.length === 0 ? (
            <div className="text-center text-sm text-slate-400 py-10">لا توجد بيانات.</div>
          ) : (
            <table className="w-full text-right text-sm">
              <thead className="text-[11px] text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-900/30">
                <tr>
                  <th className="px-4 py-3 font-semibold">#</th>
                  <th className="px-4 py-3 font-semibold">الموظف</th>
                  <th className="px-4 py-3 font-semibold">الأوردرات</th>
                  <th className="px-4 py-3 font-semibold">المبيعات</th>
                </tr>
              </thead>
              <tbody>
                {topEmps.map((r: any, i: number) => (
                  <tr key={r.id} className="border-t border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                    <td className="px-4 py-3 text-base font-bold">{MEDAL[i] || i + 1}</td>
                    <td className="px-4 py-3 font-bold text-slate-800 dark:text-slate-100">{r.name}</td>
                    <td className="px-4 py-3">
                      <span className="bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded-full text-[11px] font-bold">{fmt(r.orders_count)}</span>
                    </td>
                    <td className="px-4 py-3 font-black text-blue-600 dark:text-blue-400">{fmtCur(r.total_sales, currencySymbol)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Top Products */}
      <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-700 flex items-center gap-2">
          <ShoppingBag size={16} className="text-violet-500" />
          <span className="font-black text-slate-800 dark:text-slate-100">أكثر المنتجات مبيعاً خلال الفترة</span>
        </div>
        {topProds.length === 0 ? (
          <div className="text-center text-sm text-slate-400 py-10">لا توجد بيانات للمنتجات في هذه الفترة.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead className="text-[11px] text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-900/30">
                <tr>
                  <th className="px-4 py-3 font-semibold">#</th>
                  <th className="px-4 py-3 font-semibold">المنتج</th>
                  <th className="px-4 py-3 font-semibold">اللون</th>
                  <th className="px-4 py-3 font-semibold">المقاس</th>
                  <th className="px-4 py-3 font-semibold">الكمية المباعة</th>
                  <th className="px-4 py-3 font-semibold">الإيرادات</th>
                </tr>
              </thead>
              <tbody>
                {topProds.map((p: any, i: number) => (
                  <tr key={i} className="border-t border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                    <td className="px-4 py-3 text-base font-bold">{MEDAL[i] || i + 1}</td>
                    <td className="px-4 py-3 font-bold text-slate-800 dark:text-slate-100">{p.product_name}</td>
                    <td className="px-4 py-3 text-xs text-slate-500">{p.color || '—'}</td>
                    <td className="px-4 py-3 text-xs text-slate-500">{p.size || '—'}</td>
                    <td className="px-4 py-3">
                      <span className="bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 px-2 py-0.5 rounded-full text-[11px] font-bold">{fmt(p.qty_sold)} قطعة</span>
                    </td>
                    <td className="px-4 py-3 font-black text-emerald-600 dark:text-emerald-400">{fmtCur(p.revenue, currencySymbol)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Summary Footer */}
      <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-3xl p-6 shadow-sm text-white">
        <div className="flex items-center gap-2 mb-5">
          <Sparkles size={16} className="text-amber-400" />
          <h3 className="font-black">ملخص ختامي للفترة</h3>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-5">
          {[
            { label: 'إيرادات الفترة', value: loading ? '...' : fmtCur(revenue, currencySymbol) },
            { label: 'صافي الأرباح', value: loading ? '...' : fmtCur(profit, currencySymbol) },
            { label: 'هامش الربح', value: loading ? '...' : `${margin.toFixed(1)}%` },
            { label: 'إجمالي الطلبات', value: loading ? '...' : fmt(ordersMonth) },
            { label: 'أفضل يوم', value: bestDay?.name || '—' },
            { label: 'إيرادات سابقة', value: loading ? '...' : fmtCur(prevRev, currencySymbol) },
          ].map(s => (
            <div key={s.label} className="border-r border-white/10 pr-4 last:border-0">
              <span className="text-white/60 text-[10px] block mb-1">{s.label}</span>
              <span className="font-black text-sm">{s.value}</span>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
};

export default Dashboard;