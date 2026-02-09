
import React, { useEffect, useMemo, useState } from 'react';
import { useTheme } from './ThemeContext';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line
} from 'recharts';
import {
  TrendingUp,
  Users,
  Package,
  DollarSign,
  ArrowUpRight,
  ArrowDownRight,
  ClipboardCheck,
  Briefcase,
  AlertTriangle,
  Sparkles
} from 'lucide-react';
import { API_BASE_PATH } from '../services/apiConfig';
import { assetUrl } from '../services/assetUrl';

const StatCard = ({ title, value, change, isPositive, icon: Icon, color }: any) => (
  <div className="card p-6 rounded-2xl shadow-md border border-card flex items-center justify-between transition-all hover:shadow-xl hover:scale-[1.02] hover:-translate-y-1 duration-300 group">
    <div className="text-right flex-1">
      <p className="text-[11px] text-muted mb-2 font-semibold tracking-widest uppercase">{title}</p>
      <h3 className="text-2xl font-black tracking-tight bg-gradient-to-l from-slate-900 to-slate-700 dark:from-slate-100 dark:to-slate-300 bg-clip-text text-transparent leading-tight">{value}</h3>
      <div className={`flex items-center gap-1.5 mt-3 text-[11px] font-bold px-2.5 py-1 rounded-full w-fit ${isPositive ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30' : 'text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-900/30'}`}>
        {isPositive ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
        <span>{change}</span>
      </div>
    </div>
    <div className={`p-4 rounded-xl ${color} shadow-xl shadow-current/20 group-hover:scale-110 group-hover:rotate-6 transition-all duration-300`}>
      <Icon className="text-white w-7 h-7" />
    </div>
  </div>
);

const Pill = ({ label, value }: { label: string; value: string }) => (
  <div className="px-4 py-2 rounded-full bg-white/70 dark:bg-slate-800/70 border border-white/40 dark:border-slate-700/60 text-[11px] font-bold">
    <span className="text-muted">{label}</span> <span className="text-slate-900 dark:text-slate-100">{value}</span>
  </div>
);

const Badge = ({ level, text }: { level: 'high' | 'medium' | 'low'; text: string }) => {
  const styles = {
    high: 'bg-rose-100 text-rose-700 border-rose-200',
    medium: 'bg-amber-100 text-amber-700 border-amber-200',
    low: 'bg-emerald-100 text-emerald-700 border-emerald-200'
  };
  return (
    <span className={`px-3 py-1 rounded-full text-[11px] font-black border ${styles[level]}`}>{text}</span>
  );
};

const Dashboard: React.FC = () => {
  const { isDark } = useTheme();
  const currencySymbol = 'ج.م';
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState<any>(null);
  const today = new Date();
  const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const [startDate, setStartDate] = useState(firstDayOfMonth.toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(today.toISOString().split('T')[0]);

  useEffect(() => {
    const load = async () => {
      try {
        const qs = `&start_date=${encodeURIComponent(startDate)}&end_date=${encodeURIComponent(endDate)}`;
        const res = await fetch(`${API_BASE_PATH}/api.php?module=dashboard&action=overview${qs}`);
        const data = await res.json();
        if (data.success) {
          setOverview(data.data);
        }
      } catch (error) {
        // ignore and keep placeholders
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [startDate, endDate]);

  const trend = useMemo(() => {
    if (!overview || !Array.isArray(overview.trend)) return [];
    return overview.trend.map((item: any) => ({
      name: item.date?.slice(5) || '',
      sales: Number(item.sales || 0),
      profit: Number(item.profit || 0)
    }));
  }, [overview]);

  const revenueMonth = Number(overview?.revenue_month || 0);
  const profitMonth = Number(overview?.profit_month || 0);
  const prevRevenue = Number(overview?.prev_revenue || 0);
  const prevProfit = Number(overview?.prev_profit || 0);
  const margin = revenueMonth > 0 ? (profitMonth / revenueMonth) * 100 : 0;
  const changePct = typeof overview?.revenue_change_pct === 'number' ? overview.revenue_change_pct : null;
  const bestDay = useMemo(() => {
    if (!trend.length) return null;
    return trend.reduce((acc: any, cur: any) => (cur.sales > acc.sales ? cur : acc), trend[0]);
  }, [trend]);

  const companyLogo = localStorage.getItem('Dragon_company_logo') || assetUrl('Dragon.png');
  const companyName = localStorage.getItem('Dragon_company_name') || 'Dragon Pro';
  const userName = (() => {
    try {
      const u = JSON.parse(localStorage.getItem('Dragon_user') || '{}');
      return u?.name || 'System';
    } catch (e) {
      return 'System';
    }
  })();

  const signature = `${userName} • ${new Date().toLocaleDateString('ar-EG')} ${new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}`;

  const lowStockCount = Number(overview?.low_stock_count || 0);
  const ordersPending = Number(overview?.orders_pending || 0);
  const absentToday = Number(overview?.attendance_today?.absent || 0);

  const alertLevel = (value: number, high: number, medium: number) => {
    if (value >= high) return 'high' as const;
    if (value >= medium) return 'medium' as const;
    return 'low' as const;
  };

  const handleExportAdminReport = () => {
    window.print();
  };

  const handleExportCsv = () => {
    const rows = [
      ['الفترة', `${overview?.range_start || startDate} -> ${overview?.range_end || endDate}`],
      ['إيرادات الفترة', revenueMonth.toString()],
      ['أرباح الفترة', profitMonth.toString()],
      ['هامش الربح', margin.toFixed(2)],
      ['طلبات الفترة', Number(overview?.orders_month || 0).toString()],
      ['طلبات معلقة', Number(overview?.orders_pending || 0).toString()],
      ['العملاء', Number(overview?.customers_count || 0).toString()],
      ['المخزون (وحدات)', Number(overview?.stock_units || 0).toString()],
      ['نقص المخزون', Number(overview?.low_stock_count || 0).toString()],
      ['الحضور اليوم', Number(overview?.attendance_today?.present || 0).toString()],
      ['غياب اليوم', Number(overview?.attendance_today?.absent || 0).toString()],
      ['إيرادات الفترة السابقة', prevRevenue.toString()],
      ['أرباح الفترة السابقة', prevProfit.toString()]
    ];

    const trendRows = (trend || []).map((t: any) => [t.name, t.sales?.toString() || '0', t.profit?.toString() || '0']);
    const csvParts = [
      'section,metric,value',
      ...rows.map((r) => `kpi,${r[0]},${r[1]}`),
      'trend,date,sales,profit',
      ...trendRows.map((r) => `trend,${r[0]},${r[1]},${r[2]}`)
    ];

    const blob = new Blob([csvParts.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `dashboard_${startDate}_to_${endDate}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 transition-colors">
      <div className="print-only">
        <div className="border border-slate-200 rounded-2xl p-6">
          <div className="flex items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl border border-slate-200 overflow-hidden">
                <img src={companyLogo} alt="logo" className="w-full h-full object-cover" onError={(e: any) => { e.target.src = assetUrl('Dragon.png'); }} />
              </div>
              <div>
                <div className="text-xs text-muted">الشركة</div>
                <div className="text-lg font-black">{companyName}</div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs text-muted">تقرير الإدارة</div>
              <div className="text-xl font-black">ملخص تنفيذي</div>
              <div className="text-xs text-muted mt-1">{signature}</div>
              <div className="text-[11px] text-muted mt-2">الفترة: {overview?.range_start || startDate} → {overview?.range_end || endDate}</div>
            </div>
          </div>
          <div className="mt-6 grid grid-cols-2 gap-4 text-sm">
            <div className="flex items-center justify-between border border-slate-200 rounded-xl px-4 py-3">
              <span>إيرادات الفترة</span>
              <strong>{loading ? '...' : `${revenueMonth.toLocaleString()} ${currencySymbol}`}</strong>
            </div>
            <div className="flex items-center justify-between border border-slate-200 rounded-xl px-4 py-3">
              <span>الأرباح</span>
              <strong>{loading ? '...' : `${profitMonth.toLocaleString()} ${currencySymbol}`}</strong>
            </div>
            <div className="flex items-center justify-between border border-slate-200 rounded-xl px-4 py-3">
              <span>هامش الربح</span>
              <strong>{loading ? '...' : `${margin.toFixed(1)}%`}</strong>
            </div>
            <div className="flex items-center justify-between border border-slate-200 rounded-xl px-4 py-3">
              <span>طلبات معلقة</span>
              <strong>{loading ? '...' : ordersPending.toLocaleString()}</strong>
            </div>
            <div className="flex items-center justify-between border border-slate-200 rounded-xl px-4 py-3">
              <span>نقص المخزون</span>
              <strong>{loading ? '...' : lowStockCount.toLocaleString()}</strong>
            </div>
            <div className="flex items-center justify-between border border-slate-200 rounded-xl px-4 py-3">
              <span>غياب اليوم</span>
              <strong>{loading ? '...' : absentToday.toLocaleString()}</strong>
            </div>
          </div>
        </div>
      </div>

      <div className="no-print space-y-6">
        <div className="relative overflow-hidden rounded-[2.5rem] border border-blue-200/40 dark:border-blue-900/40 bg-gradient-to-l from-blue-50 via-white to-white dark:from-blue-900/20 dark:via-slate-900 dark:to-slate-900 p-8">
          <div className="absolute -top-24 -right-16 w-64 h-64 bg-blue-200/40 dark:bg-blue-600/10 rounded-full blur-3xl"></div>
          <div className="absolute -bottom-24 -left-12 w-64 h-64 bg-amber-200/30 dark:bg-amber-500/10 rounded-full blur-3xl"></div>

          <div className="relative z-10 flex flex-col lg:flex-row lg:items-center gap-6">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-white/80 dark:bg-slate-800/70 border border-white/60 dark:border-slate-700/60 shadow-lg flex items-center justify-center overflow-hidden">
                <img src={companyLogo} alt="logo" className="w-full h-full object-cover" onError={(e: any) => { e.target.src = assetUrl('Dragon.png'); }} />
              </div>
              <div className="hidden lg:block">
                <div className="text-xs text-muted">الشركة</div>
                <div className="text-lg font-black">{companyName}</div>
              </div>
            </div>
            <div className="flex-1 text-right">
              <div className="flex items-center gap-3 justify-end">
                <span className="px-3 py-1 rounded-full text-[11px] font-black bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">ملخص الإدارة</span>
              </div>
              <h1 className="text-4xl font-black mt-4 tracking-tight bg-gradient-to-l from-slate-900 via-blue-700 to-slate-900 dark:from-slate-100 dark:via-blue-300 dark:to-slate-100 bg-clip-text text-transparent">الشاشه الرئيسيه</h1>
              <p className="text-sm mt-3 font-medium text-muted">عرض مالي وتشغيلي مباشر من قاعدة البيانات — صُمّم لإدارة دقيقة وسريعة.</p>
              <div className="mt-5 flex flex-wrap justify-end gap-2">
                <Pill label="إيرادات الفترة" value={loading ? '...' : `${revenueMonth.toLocaleString()} ${currencySymbol}`} />
                <Pill label="هامش الربح" value={loading ? '...' : `${margin.toFixed(1)}%`} />
                <Pill label="أفضل يوم" value={bestDay ? bestDay.name : '—'} />
                <Pill label="الفترة السابقة" value={overview?.prev_range_start ? `${overview.prev_range_start} → ${overview.prev_range_end}` : '—'} />
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <button
                className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border border-slate-200 dark:border-slate-700 px-6 py-3 rounded-2xl text-sm font-bold hover:bg-slate-50 dark:hover:bg-slate-700 transition-all shadow-md hover:shadow-lg hover:scale-105 active:scale-95"
                onClick={handleExportAdminReport}
              >
                🖨️ طباعة التقرير
              </button>
              <button
                className="bg-slate-900/90 text-white px-6 py-3 rounded-2xl text-sm font-bold hover:bg-slate-900 transition-all shadow-md hover:shadow-lg hover:scale-105 active:scale-95"
                onClick={handleExportCsv}
              >
                ⬇️ تصدير CSV
              </button>
              <div className="px-4 py-3 rounded-2xl bg-white/70 dark:bg-slate-800/70 border border-white/60 dark:border-slate-700/60 text-[11px] font-bold text-right">
                <div className="text-muted">توقيع رقمي</div>
                <div className="mt-1">{signature}</div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="text-right">
            <h2 className="text-xl font-black">ملخص الإدارة</h2>
            <p className="text-xs text-muted">ملخص مؤشرات التنفيذ والنتائج الأساسية</p>
          </div>
          <Sparkles className="w-5 h-5 text-amber-500" />
        </div>

        <div className="card p-4 rounded-2xl border border-card shadow-sm">
          <div className="flex flex-col lg:flex-row gap-3 items-center justify-between">
            <div className="text-right">
              <div className="text-sm font-black">فلترة الفترة</div>
              <div className="text-[11px] text-muted">المقارنة تلقائية مع الفترة السابقة</div>
            </div>
            <div className="flex flex-wrap gap-2 items-center">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-slate-50 dark:bg-slate-900 border-none rounded-2xl py-2 px-3 text-sm text-slate-900 dark:text-white"
              />
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-slate-50 dark:bg-slate-900 border-none rounded-2xl py-2 px-3 text-sm text-slate-900 dark:text-white"
              />
              <div className="text-[11px] font-bold px-3 py-2 rounded-2xl bg-slate-100 dark:bg-slate-800 text-muted">
                الفترة السابقة: {overview?.prev_range_start ? `${overview.prev_range_start} → ${overview.prev_range_end}` : '—'}
              </div>
            </div>
          </div>
        </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="إجمالي الإيرادات"
          value={loading ? '...' : `${revenueMonth.toLocaleString()} ${currencySymbol}`}
          change={changePct === null ? '—' : `${Math.abs(changePct).toFixed(1)}% ${changePct >= 0 ? '↑' : '↓'}`}
          isPositive={changePct === null ? true : changePct >= 0}
          icon={DollarSign}
          color="bg-gradient-to-br from-blue-700 to-blue-500"
        />
        <StatCard
          title="العملاء"
          value={loading ? '...' : `${Number(overview?.customers_count || 0).toLocaleString()} عميل`}
          change={loading ? '—' : 'متابعة نشطة'}
          isPositive={true}
          icon={Users}
          color="bg-gradient-to-br from-slate-900 to-slate-700"
        />
        <StatCard
          title="المخزون"
          value={loading ? '...' : `${Number(overview?.stock_units || 0).toLocaleString()} قطعة`}
          change={loading ? '—' : `نقص: ${Number(overview?.low_stock_count || 0)}`}
          isPositive={Number(overview?.low_stock_count || 0) === 0}
          icon={Package}
          color="bg-gradient-to-br from-amber-600 to-orange-500"
        />
        <StatCard
          title="هامش الربح"
          value={loading ? '...' : `${margin.toFixed(1)}%`}
          change={loading ? '—' : `${profitMonth.toLocaleString()} ${currencySymbol}`}
          isPositive={margin >= 0}
          icon={TrendingUp}
          color="bg-gradient-to-br from-emerald-600 to-teal-600"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="card p-6 rounded-2xl shadow-md border border-card">
          <div className="flex items-center justify-between">
            <p className="text-[11px] text-muted font-semibold tracking-widest uppercase">طلبات الفترة</p>
            <Briefcase className="w-5 h-5 text-blue-500" />
          </div>
          <div className="text-3xl font-black mt-4">{loading ? '...' : Number(overview?.orders_month || 0).toLocaleString()}</div>
          <p className="text-[11px] text-muted mt-2">طلبات معلقة: {loading ? '...' : Number(overview?.orders_pending || 0).toLocaleString()}</p>
        </div>
        <div className="card p-6 rounded-2xl shadow-md border border-card">
          <div className="flex items-center justify-between">
            <p className="text-[11px] text-muted font-semibold tracking-widest uppercase">الحضور اليوم</p>
            <ClipboardCheck className="w-5 h-5 text-emerald-500" />
          </div>
          <div className="text-3xl font-black mt-4">{loading ? '...' : Number(overview?.attendance_today?.present || 0)}</div>
          <p className="text-[11px] text-muted mt-2">غياب اليوم: {loading ? '...' : Number(overview?.attendance_today?.absent || 0)}</p>
        </div>
        <div className="card p-6 rounded-2xl shadow-md border border-card">
          <div className="flex items-center justify-between">
            <p className="text-[11px] text-muted font-semibold tracking-widest uppercase">الجاهزية</p>
            <AlertTriangle className="w-5 h-5 text-rose-500" />
          </div>
          <div className="text-3xl font-black mt-4">{loading ? '...' : Number(overview?.employees_count || 0).toLocaleString()}</div>
          <p className="text-[11px] text-muted mt-2">فرق العمل النشطة</p>
        </div>
      </div>

      <div className="card p-6 rounded-2xl border border-card shadow-md">
        <div className="flex items-center gap-3 mb-4">
          <Sparkles className="w-5 h-5 text-amber-500" />
          <h3 className="font-black text-lg">لمحة تنفيذية سريعة</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div className="p-4 rounded-xl bg-slate-50/80 dark:bg-slate-900/40 border border-slate-200/60 dark:border-slate-700/60">
            أفضل يوم مبيعات: <strong>{bestDay ? bestDay.name : '—'}</strong>
          </div>
          <div className="p-4 rounded-xl bg-slate-50/80 dark:bg-slate-900/40 border border-slate-200/60 dark:border-slate-700/60">
            عدد التنبيهات الحرجة: <strong>{Number(overview?.low_stock_count || 0)}</strong>
          </div>
          <div className="p-4 rounded-xl bg-slate-50/80 dark:bg-slate-900/40 border border-slate-200/60 dark:border-slate-700/60">
            نسبة الربحية الحالية: <strong>{margin.toFixed(1)}%</strong>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="text-right">
          <h2 className="text-xl font-black">البث التشغيلي المباشر</h2>
          <p className="text-xs text-muted">مؤشرات تشغيلية لحظية وتنبيهات ديناميكية</p>
        </div>
        <AlertTriangle className="w-5 h-5 text-rose-500" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card backdrop-blur-sm p-6 rounded-2xl shadow-md border border-card transition-all hover:shadow-xl" style={{ backgroundColor: 'var(--card-bg)', color: 'var(--text)' }}>
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-black text-lg">الإيرادات مقابل الأرباح</h3>
            <span className="text-[11px] text-muted font-medium px-3 py-1 bg-slate-100 dark:bg-slate-700/50 rounded-full">الفترة المحددة</span>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={trend}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? "#334155" : "#e2e8f0"} />
                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  fontSize={11}
                  tick={{ fill: isDark ? '#94a3b8' : '#64748b', fontWeight: 600 }}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  fontSize={11}
                  orientation="right"
                  tick={{ fill: isDark ? '#94a3b8' : '#64748b', fontWeight: 600 }}
                />
                <Tooltip
                  cursor={{ fill: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(59, 130, 246, 0.05)' }}
                  contentStyle={{
                    borderRadius: '16px',
                    border: 'none',
                    boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)',
                    textAlign: 'right',
                    backgroundColor: isDark ? '#0f172a' : 'rgba(255, 255, 255, 0.98)',
                    color: isDark ? '#f1f5f9' : '#0f172a'
                  }}
                  itemStyle={{ fontWeight: 700 }}
                />
                <Bar dataKey="sales" name="المبيعات" fill="#1d4ed8" radius={[6, 6, 0, 0]} barSize={24} />
                <Bar dataKey="profit" name="الأرباح" fill="#10b981" radius={[6, 6, 0, 0]} barSize={24} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card backdrop-blur-sm p-6 rounded-2xl shadow-md border border-card transition-all hover:shadow-xl" style={{ backgroundColor: 'var(--card-bg)', color: 'var(--text)' }}>
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-black text-lg">اتجاه المبيعات</h3>
            <span className="text-[11px] text-muted font-medium px-3 py-1 bg-slate-100 dark:bg-slate-700/50 rounded-full">ديناميكي</span>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trend}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? "#334155" : "#e2e8f0"} />
                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  fontSize={11}
                  tick={{ fill: isDark ? '#94a3b8' : '#64748b', fontWeight: 600 }}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  fontSize={11}
                  orientation="right"
                  tick={{ fill: isDark ? '#94a3b8' : '#64748b', fontWeight: 600 }}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: '16px',
                    border: 'none',
                    boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)',
                    textAlign: 'right',
                    backgroundColor: isDark ? '#0f172a' : 'rgba(255, 255, 255, 0.98)',
                    color: isDark ? '#f1f5f9' : '#0f172a'
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="sales"
                  name="المبيعات"
                  stroke="#1d4ed8"
                  strokeWidth={4}
                  dot={{ r: 5, fill: '#1d4ed8', strokeWidth: 2, stroke: isDark ? '#0f172a' : '#fff' }}
                  activeDot={{ r: 8, strokeWidth: 0 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
        </div>

        <div className="card p-6 rounded-2xl border border-card shadow-md">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-black text-lg">نظام التنبيهات الذكي</h3>
            <Sparkles className="w-5 h-5 text-amber-500" />
          </div>
          <div className="space-y-4 text-sm">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-bold">تنبيه المخزون</div>
                <div className="text-[11px] text-muted">منتجات أقل من الحد</div>
              </div>
              <Badge level={alertLevel(lowStockCount, 12, 4)} text={lowStockCount > 0 ? 'عالي' : 'منخفض'} />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <div className="font-bold">تكدس الطلبات</div>
                <div className="text-[11px] text-muted">طلبات معلقة</div>
              </div>
              <Badge level={alertLevel(ordersPending, 20, 6)} text={ordersPending >= 20 ? 'عالي' : ordersPending >= 6 ? 'متوسط' : 'منخفض'} />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <div className="font-bold">غياب اليوم</div>
                <div className="text-[11px] text-muted">نسبة الغياب اللحظي</div>
              </div>
              <Badge level={alertLevel(absentToday, 6, 2)} text={absentToday >= 6 ? 'عالي' : absentToday >= 2 ? 'متوسط' : 'منخفض'} />
            </div>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
};

export default Dashboard;

