import React, { useState, useEffect } from 'react';
import { translateTxnLabel } from '../services/labelHelpers';
import {
  BarChart3,
  Filter,
  Download,
  FileText,
  Table,
  Package,
  ShoppingCart,
  Wallet,
  Users,
  Briefcase,
  ShieldCheck,
  ArrowUpRight,
  ArrowDownRight,
  Printer,
  Calendar,
  Warehouse,
  Coins,
  Receipt,
  UserCheck,
  Activity,
  ArrowLeftRight,
  CreditCard,
  History
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { API_BASE_PATH } from '../services/apiConfig';
import Swal from 'sweetalert2';
import DailyReport from './DailyReport';
import TotalsReport from './TotalsReport';
import ProductDeliveryTable from './ProductDeliveryTable';
import { useTheme } from './ThemeContext';
import CustomSelect from './CustomSelect';

interface ReportsModuleProps {
  initialView?: string;
}

// ─── Rep Performance Section ────────────────────────────────────────────────
const RepsPerformanceSection: React.FC<{
  startDate: string; endDate: string;
  setStartDate: (v: string) => void; setEndDate: (v: string) => void;
  isDark: boolean; currencySymbol: string;
}> = ({ startDate, endDate, setStartDate, setEndDate, isDark, currencySymbol }) => {
  const [repStats, setRepStats] = useState<any[]>([]);
  const [totals, setTotals] = useState<any>({});
  const [loading, setLoading] = useState(false);
  const [sortKey, setSortKey] = useState<string>('delivered_orders');
  const [sortAsc, setSortAsc] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const url = `${API_BASE_PATH}/api.php?module=reports&action=getOrderStats&start_date=${startDate}&end_date=${endDate}`;
      const res = await fetch(url).then(r => r.json()).catch(() => null);
      if (res && res.success) {
        setRepStats(res.data.rep_stats || []);
        setTotals(res.data.totals || {});
      } else {
        setRepStats([]); setTotals({});
        Swal.fire('تنبيه', 'لا توجد بيانات لهذه الفترة.', 'info');
      }
    } catch { Swal.fire('خطأ', 'فشل تحميل بيانات المناديب.', 'error'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [startDate, endDate]);

  const sorted = [...repStats].sort((a, b) => {
    const aVal = Number(a[sortKey] || 0);
    const bVal = Number(b[sortKey] || 0);
    return sortAsc ? aVal - bVal : bVal - aVal;
  });

  const handleSort = (key: string) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(false); }
  };

  const SortTh = ({ col, label }: { col: string; label: string }) => (
    <th
      className="px-4 py-3 font-semibold cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors select-none"
      onClick={() => handleSort(col)}
    >
      {label} {sortKey === col ? (sortAsc ? '▲' : '▼') : ''}
    </th>
  );

  const exportCSV = () => {
    if (!repStats.length) { Swal.fire('تنبيه', 'لا توجد بيانات.', 'info'); return; }
    const headers = ['المندوب','أوردرات مسلَّمة','أوردرات مرتجعة','قطع مسلَّمة','قطع مرتجعة','مبيعات','مرتجعات','إجمالي أوردرات'];
    const rows = sorted.map(r => [r.name||'', r.delivered_orders||0, r.returned_orders||0, r.delivered_pieces||0, r.returned_pieces||0, Number(r.delivered_amount||0).toFixed(2), Number(r.returned_amount||0).toFixed(2), r.total_orders||0]);
    const csv = [headers.join(','), ...rows.map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(','))].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `reps_perf_${startDate}_to_${endDate}.csv`;
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  };

  const printReport = () => {
    const rows = sorted.map((r, i) => `<tr>
      <td>${i+1}</td><td>${r.name||'—'}</td>
      <td>${r.delivered_orders||0}</td><td>${r.returned_orders||0}</td>
      <td>${r.delivered_pieces||0}</td><td>${r.returned_pieces||0}</td>
      <td>${Number(r.delivered_amount||0).toLocaleString()}</td>
      <td>${Number(r.returned_amount||0).toLocaleString()}</td>
      <td>${r.total_orders||0}</td>
    </tr>`).join('');
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>أداء المناديب ${startDate} - ${endDate}</title>
      <style>body{font-family:Arial,"Noto Naskh Arabic",sans-serif;direction:rtl;padding:20px;} table{width:100%;border-collapse:collapse;font-size:12px;} th,td{border:1px solid #333;padding:5px;text-align:right;} th{background:#f3f4f6;} .kpi{display:inline-block;padding:6px 16px;margin:4px;background:#f8f9fa;border-radius:6px;}</style>
      </head><body>
      <h1 style="text-align:center">تقرير أداء المناديب</h1>
      <div>الفترة: ${startDate} — ${endDate}</div>
      <div style="margin:12px 0">
        <span class="kpi">إجمالي مسلَّمة: <strong>${(totals.delivered_orders||0)}</strong></span>
        <span class="kpi">إجمالي مرتجعة: <strong>${(totals.returned_orders||0)}</strong></span>
        <span class="kpi">قطع مسلَّمة: <strong>${(totals.delivered_pieces||0)}</strong></span>
        <span class="kpi">مبيعات: <strong>${Number(totals.delivered_amount||0).toLocaleString()}</strong></span>
      </div>
      <table><thead><tr><th>#</th><th>المندوب</th><th>أوردرات مسلَّمة</th><th>أوردرات مرتجعة</th><th>قطع مسلَّمة</th><th>قطع مرتجعة</th><th>مبيعات</th><th>مرتجعات</th><th>إجمالي</th></tr></thead>
      <tbody>${rows}</tbody></table>
      </body></html>`;
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(html); w.document.close();
    setTimeout(() => w.print(), 500);
  };

  const MEDALS = ['🥇','🥈','🥉'];
  const kpiClass = "p-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-right";

  return (
    <div className="space-y-5">
      {/* Controls */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 flex flex-wrap gap-3 items-center shadow-sm">
        <span className="text-sm font-black text-slate-700 dark:text-slate-200">تقرير أداء المناديب</span>
        <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
          className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl py-2 px-3 text-sm" />
        <span className="text-slate-400">—</span>
        <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
          className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl py-2 px-3 text-sm" />
        <button onClick={load} disabled={loading}
          className="px-4 py-2 bg-blue-600 text-white rounded-xl font-bold disabled:opacity-60">
          {loading ? 'تحميل...' : 'تحديث'}
        </button>
        <button onClick={exportCSV} className="px-4 py-2 bg-sky-600 text-white rounded-xl font-bold">CSV</button>
        <button onClick={printReport} className="px-4 py-2 bg-emerald-600 text-white rounded-xl font-bold">طباعة</button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className={kpiClass}><div className="text-xs text-slate-500 mb-1">إجمالي أوردرات مسلَّمة</div><div className="text-2xl font-black text-emerald-600">{(totals.delivered_orders||0).toLocaleString()}</div></div>
        <div className={kpiClass}><div className="text-xs text-slate-500 mb-1">إجمالي أوردرات مرتجعة</div><div className="text-2xl font-black text-rose-600">{(totals.returned_orders||0).toLocaleString()}</div></div>
        <div className={kpiClass}><div className="text-xs text-slate-500 mb-1">إجمالي قطع مسلَّمة</div><div className="text-2xl font-black text-emerald-600">{(totals.delivered_pieces||0).toLocaleString()}</div></div>
        <div className={kpiClass}><div className="text-xs text-slate-500 mb-1">إجمالي المبيعات</div><div className="text-2xl font-black text-blue-600">{Number(totals.delivered_amount||0).toLocaleString()} <span className="text-sm font-normal">{currencySymbol}</span></div></div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-700 flex items-center gap-2">
          <UserCheck size={16} className="text-blue-500" />
          <span className="font-black text-slate-800 dark:text-slate-100">تفاصيل أداء المناديب</span>
          <span className="text-xs text-slate-400 mr-2">({repStats.length} مندوب)</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-right">
            <thead className="bg-slate-50 dark:bg-slate-900/30 text-slate-500 dark:text-slate-400">
              <tr>
                <th className="px-4 py-3 font-semibold">#</th>
                <th className="px-4 py-3 font-semibold">المندوب</th>
                <SortTh col="delivered_orders" label="أوردرات مسلَّمة" />
                <SortTh col="returned_orders" label="أوردرات مرتجعة" />
                <SortTh col="delivered_pieces" label="قطع مسلَّمة" />
                <SortTh col="returned_pieces" label="قطع مرتجعة" />
                <SortTh col="delivered_amount" label="مبيعات" />
                <SortTh col="returned_amount" label="مرتجعات" />
                <SortTh col="total_orders" label="إجمالي أوردرات" />
                <th className="px-4 py-3 font-semibold">معدل النجاح</th>
              </tr>
            </thead>
            <tbody className="divide-y dark:divide-slate-700">
              {loading ? (
                <tr><td colSpan={10} className="py-10 text-center text-slate-400">جارٍ التحميل...</td></tr>
              ) : sorted.length === 0 ? (
                <tr><td colSpan={10} className="py-10 text-center text-slate-400">لا توجد بيانات مناديب في هذه الفترة.</td></tr>
              ) : sorted.map((r: any, i: number) => {
                const successRate = (r.delivered_orders + r.returned_orders) > 0
                  ? Math.round((r.delivered_orders / (r.delivered_orders + r.returned_orders)) * 100)
                  : 0;
                return (
                  <tr key={r.id || i} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                    <td className="px-4 py-3 text-center text-base">{MEDALS[i] || i + 1}</td>
                    <td className="px-4 py-3 font-bold text-slate-800 dark:text-slate-100">{r.name || `مندوب #${r.id}`}</td>
                    <td className="px-4 py-3 text-center">
                      <span className="bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 px-2 py-0.5 rounded-full text-xs font-bold">{r.delivered_orders || 0}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400 px-2 py-0.5 rounded-full text-xs font-bold">{r.returned_orders || 0}</span>
                    </td>
                    <td className="px-4 py-3 text-center">{r.delivered_pieces || 0}</td>
                    <td className="px-4 py-3 text-center">{r.returned_pieces || 0}</td>
                    <td className="px-4 py-3 font-black text-emerald-600 dark:text-emerald-400">{Number(r.delivered_amount||0).toLocaleString()}</td>
                    <td className="px-4 py-3 font-bold text-rose-600 dark:text-rose-400">{Number(r.returned_amount||0).toLocaleString()}</td>
                    <td className="px-4 py-3 text-center">
                      <span className="bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full text-xs font-bold">{r.total_orders || 0}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                          <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${successRate}%` }} />
                        </div>
                        <span className="text-xs font-bold text-slate-600 dark:text-slate-300 w-10 flex-shrink-0">{successRate}%</span>
                      </div>
                    </td>
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


const HIDDEN_REPORT_SUBTABS = new Set([
  'inventory',
  'finance',
  'daily',
  'sales-report',
  'crm-srm',
  'hrm',
]);

const normalizeReportsView = (view?: string) => {
  const next = (view || 'sales').trim();
  return HIDDEN_REPORT_SUBTABS.has(next) ? 'sales' : next;
};

const ReportsModule: React.FC<ReportsModuleProps> = ({ initialView }) => {
  const [activeSubTab, setActiveSubTab] = useState<string>(normalizeReportsView(initialView));
  const today = new Date();
  const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const [startDate, setStartDate] = useState(firstDayOfMonth.toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(today.toISOString().split('T')[0]);
  const currencySymbol = 'ج.م';
  const { isDark } = useTheme();

  const [salesByProduct, setSalesByProduct] = useState([]);
  const [dailySales, setDailySales] = useState([]);

  const [inventoryStockByWarehouse, setInventoryStockByWarehouse] = useState([]);
  const [inventoryMovement, setInventoryMovement] = useState([]);
  const [inventoryStock, setInventoryStock] = useState([]);
  const [inventoryMovementHistory, setInventoryMovementHistory] = useState([]);

  const [inventoryWarehouseId, setInventoryWarehouseId] = useState('');
  const [inventoryMovementType, setInventoryMovementType] = useState('');

  // Finance states
  const [treasuryBalanceHistory, setTreasuryBalanceHistory] = useState<any[]>([]);
  const [expenseCategories, setExpenseCategories] = useState<any[]>([]);
  const [revenueAndExpenseRecords, setRevenueAndExpenseRecords] = useState<any[]>([]);

  const [financeTreasuryId, setFinanceTreasuryId] = useState('');
  const [financeTxnType, setFinanceTxnType] = useState('');

  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [treasuries, setTreasuries] = useState<any[]>([]);

  const [compareYear, setCompareYear] = useState<number>(today.getFullYear());
  const [compareData, setCompareData] = useState<any>(null);

  useEffect(() => {
    if (initialView) setActiveSubTab(normalizeReportsView(initialView));
  }, [initialView]);

  useEffect(() => {
    const loadLookups = async () => {
      try {
        const [whRes, trRes] = await Promise.all([
          fetch(`${API_BASE_PATH}/api.php?module=warehouses&action=getAll`).then(r => r.json()).catch(() => ({ success: false, data: [] })),
          fetch(`${API_BASE_PATH}/api.php?module=treasuries&action=getAll`).then(r => r.json()).catch(() => ({ success: false, data: [] }))
        ]);

        if (whRes && whRes.success) setWarehouses(whRes.data || []);
        if (trRes && trRes.success) setTreasuries(trRes.data || []);
      } catch (e) {
        // ignore lookup failures
      }
    };

    loadLookups();
  }, []);

  useEffect(() => {
    const urlParams = `&start_date=${startDate}&end_date=${endDate}`;
    if (activeSubTab === 'sales') {
      fetch(`${API_BASE_PATH}/api.php?module=reports&action=sales${urlParams}`)
        .then(res => res.json())
        .then(data => {
          if (data && data.success) {
            setSalesByProduct(data.data.salesByProduct || []);
            setDailySales(data.data.dailySales || []);
          } else {
            setSalesByProduct([]);
            setDailySales([]);
            Swal.fire('تنبيه', 'لم يتم العثور على بيانات لتقارير المبيعات للفترة المحددة.', 'info');
          }
        }).catch(err => {
          console.error('Failed to fetch sales reports', err);
          Swal.fire('خطأ', 'فشل جلب تقارير المبيعات. راجع الكونسول.', 'error');
        });
    } else if (activeSubTab === 'inventory') {
      const inventoryParams = `${urlParams}${inventoryWarehouseId ? `&warehouse_id=${encodeURIComponent(inventoryWarehouseId)}` : ''}${inventoryMovementType ? `&movement_type=${encodeURIComponent(inventoryMovementType)}` : ''}`;
      fetch(`${API_BASE_PATH}/api.php?module=reports&action=inventory${inventoryParams}`)
        .then(res => res.json())
        .then(data => {
          if (data && data.success) {
            setInventoryStockByWarehouse(data.data.inventoryStockByWarehouse || []);
            setInventoryMovement(data.data.inventoryMovement || []);
            setInventoryStock(data.data.inventoryStock || []);
            setInventoryMovementHistory(data.data.inventoryMovementHistory || []);
          } else {
            setInventoryStockByWarehouse([]);
            setInventoryMovement([]);
            setInventoryStock([]);
            setInventoryMovementHistory([]);
            Swal.fire('تنبيه', 'لم يتم العثور على بيانات لتقارير المخزون للفترة المحددة.', 'info');
          }
        }).catch(err => {
          console.error('Failed to fetch inventory reports', err);
          Swal.fire('خطأ', 'فشل جلب تقارير المخزون. راجع الكونسول.', 'error');
        });
    } else if (activeSubTab === 'finance') {
      const financeParams = `${urlParams}${financeTreasuryId ? `&treasury_id=${encodeURIComponent(financeTreasuryId)}` : ''}${financeTxnType ? `&txn_type=${encodeURIComponent(financeTxnType)}` : ''}`;
      fetch(`${API_BASE_PATH}/api.php?module=reports&action=finance${financeParams}`)
        .then(res => res.json())
        .then(data => {
          if (data && data.success) {
            setTreasuryBalanceHistory(data.data.treasuryBalanceHistory || []);
            setExpenseCategories(data.data.expenseCategories || []);
            setRevenueAndExpenseRecords(data.data.revenueAndExpenseRecords || []);
          } else {
            setTreasuryBalanceHistory([]);
            setExpenseCategories([]);
            setRevenueAndExpenseRecords([]);
            Swal.fire('تنبيه', 'لم يتم العثور على بيانات للتقارير المالية للفترة المحددة.', 'info');
          }
        }).catch(err => {
          console.error('Failed to fetch finance reports', err);
          Swal.fire('خطأ', 'فشل جلب التقارير المالية. راجع الكونسول.', 'error');
        });
    }
  }, [activeSubTab, startDate, endDate, inventoryWarehouseId, inventoryMovementType, financeTreasuryId, financeTxnType]);

  useEffect(() => {
    if (activeSubTab !== 'compare') return;
    const loadCompare = async () => {
      try {
        const res = await fetch(`${API_BASE_PATH}/api.php?module=reports&action=compare&year=${compareYear}`);
        const data = await res.json();
        if (data && data.success) setCompareData(data.data);
      } catch (e) {
        setCompareData(null);
      }
    };
    loadCompare();
  }, [activeSubTab, compareYear]);

  const handleGenerateReport = (reportType: string) => {
    Swal.fire('جاري التوليد', `يتم توليد تقرير ${reportType} للفترة ${startDate} إلى ${endDate}.`, 'info');
    // In a real app, this would trigger an API call to fetch data based on filters
  };

  const downloadCsv = (filename: string, rows: string[][]) => {
    const csv = rows.map(r => r.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const handleExport = (format: string) => {
    if (format === 'PDF') {
      window.print();
      return;
    }

    if (activeSubTab === 'sales') {
      const rows: string[][] = [
        ['section', 'field1', 'field2', 'field3', 'field4'],
        ['salesByProduct', 'name', 'pieces_sold', 'sales_amount', 'net_profit'],
        ...salesByProduct.map((r: any) => [
          'salesByProduct',
          r.name,
          r.sales,
          r.sales_amount,
          r.net_profit
        ]),
        ['dailySales', 'date', 'total', '', ''],
        ...dailySales.map((r: any) => ['dailySales', r.date, r.total, '', ''])
      ];
      downloadCsv(`sales_${startDate}_to_${endDate}.csv`, rows);
      return;
    }

    if (activeSubTab === 'inventory') {
      const rows: string[][] = [
        ['section', 'field1', 'field2', 'field3', 'field4', 'field5'],
        ['inventoryStockByWarehouse', 'warehouse', 'quantity', '', '', ''],
        ...inventoryStockByWarehouse.map((r: any) => ['inventoryStockByWarehouse', r.name, r.quantity, '', '', '']),
        ['inventoryMovement', 'date', 'quantity', '', '', ''],
        ...inventoryMovement.map((r: any) => ['inventoryMovement', r.date, r.quantity, '', '', '']),
        ['inventoryStock', 'product', 'barcode', 'warehouse', 'quantity', 'purchasePrice'],
        ...inventoryStock.map((r: any) => ['inventoryStock', r.product, r.barcode, r.warehouse, r.quantity, r.purchasePrice]),
        ['inventoryMovementHistory', 'id', 'date', 'product', 'type', 'quantity'],
        ...inventoryMovementHistory.map((r: any) => ['inventoryMovementHistory', r.id, r.date, r.product, r.type, r.quantity])
      ];
      downloadCsv(`inventory_${startDate}_to_${endDate}.csv`, rows);
      return;
    }

    if (activeSubTab === 'finance') {
      const rows: string[][] = [
        ['section', 'field1', 'field2', 'field3', 'field4'],
        ['treasuryBalanceHistory', 'date', 'balance', '', ''],
        ...treasuryBalanceHistory.map((r: any) => ['treasuryBalanceHistory', r.date, r.balance, '', '']),
        ['expenseCategories', 'name', 'value', '', ''],
        ...expenseCategories.map((r: any) => ['expenseCategories', r.name, r.value, '', '']),
        ['revenueAndExpenseRecords', 'date', 'type', 'desc', 'amount'],
        ...revenueAndExpenseRecords.map((r: any) => ['revenueAndExpenseRecords', r.date, r.type, r.desc, r.amount])
      ];
      downloadCsv(`finance_${startDate}_to_${endDate}.csv`, rows);
      return;
    }

    Swal.fire('تنبيه', 'التصدير متاح فقط لتقارير المبيعات والمخزون والمالية.', 'info');
  };

  const ReportSection = ({ title, description, icon: Icon, children, filters, onGenerate }: any) => (
    <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
      <div className="p-6 border-b dark:border-slate-700 flex flex-col md:flex-row items-center justify-between gap-4 bg-slate-50 dark:bg-slate-900/30">
        <div className="flex items-center gap-3">
          <Icon className="text-blue-500 w-6 h-6" />
          <div className="text-right">
            <h3 className="text-lg font-black text-slate-900 dark:text-white">{title}</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">{description}</p>
          </div>
        </div>
        <div className="flex gap-2 w-full md:w-auto">
          {filters}
          {onGenerate && (
            <button
              onClick={onGenerate}
              className="w-full md:w-auto bg-blue-600 text-white px-5 py-2.5 rounded-2xl text-sm font-black shadow-lg shadow-blue-500/20 hover:bg-blue-700 transition-all active:scale-95"
            >
              <Filter size={16} className="ml-2" />
              توليد التقرير
            </button>
          )}
          <button
            onClick={() => handleExport('PDF')}
            className="w-full md:w-auto bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200 px-4 py-2.5 rounded-2xl text-sm font-bold shadow-sm hover:bg-slate-200 dark:hover:bg-slate-600 transition-all active:scale-95 flex items-center justify-center"
          >
            <Download size={16} className="ml-2" /> PDF
          </button>
          <button
            onClick={() => handleExport('Excel')}
            className="w-full md:w-auto bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 px-4 py-2.5 rounded-2xl text-sm font-bold shadow-sm hover:bg-emerald-200 dark:hover:bg-emerald-800 transition-all active:scale-95 flex items-center justify-center"
          >
            <Download size={16} className="ml-2" /> Excel
          </button>
        </div>
      </div>
      <div className="p-6 space-y-6">
        {children}
      </div>
    </div>
  );

  const dateRangeInputs = (
    <>
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
    </>
  );

  const salesFilters = (
    <div className="flex gap-2 w-full md:w-auto flex-wrap">
      {dateRangeInputs}
    </div>
  );

  const inventoryFilters = (
    <div className="flex gap-2 w-full md:w-auto flex-wrap">
      {dateRangeInputs}
      <CustomSelect
        value={inventoryWarehouseId}
        onChange={(v) => setInventoryWarehouseId(v)}
        options={[{ value: '', label: 'كل المستودعات' }, ...warehouses.map((w: any) => ({ value: String(w.id), label: w.name }))]}
        placeholder="المستودع"
      />
      <CustomSelect
        value={inventoryMovementType}
        onChange={(v) => setInventoryMovementType(v)}
        options={[
          { value: '', label: 'كل الحركات' },
          { value: 'purchase', label: 'شراء' },
          { value: 'sale', label: 'بيع' },
          { value: 'return_in', label: 'مرتجع وارد' },
          { value: 'return_out', label: 'مرتجع صادر' },
          { value: 'transfer_in', label: 'تحويل وارد' },
          { value: 'transfer_out', label: 'تحويل صادر' },
          { value: 'adjustment', label: 'تسوية' },
          { value: 'initial_balance', label: 'رصيد افتتاحي' }
        ]}
        placeholder="نوع الحركة"
      />
    </div>
  );

  const financeFilters = (
    <div className="flex gap-2 w-full md:w-auto flex-wrap">
      {dateRangeInputs}
      <CustomSelect
        value={financeTreasuryId}
        onChange={(v) => setFinanceTreasuryId(v)}
        options={[{ value: '', label: 'كل الخزائن' }, ...treasuries.map((t: any) => ({ value: String(t.id), label: t.name }))]}
        placeholder="الخزينة"
      />
      <CustomSelect
        value={financeTxnType}
        onChange={(v) => setFinanceTxnType(v)}
        options={[
          { value: '', label: 'كل الأنواع' },
          { value: 'sale', label: 'مبيعات' },
          { value: 'purchase', label: 'مشتريات' },
          { value: 'payment_in', label: 'إيداع' },
          { value: 'payment_out', label: 'دفعة' },
          { value: 'expense', label: 'مصروف' },
          { value: 'transfer', label: 'تحويل' }
        ]}
        placeholder="نوع المعاملة"
      />
    </div>
  );

  const compareFilters = (
    <div className="flex gap-2 w-full md:w-auto flex-wrap">
      <CustomSelect
        value={String(compareYear)}
        onChange={(v) => setCompareYear(Number(v))}
        options={Array.from({ length: 5 }).map((_, i) => {
          const y = today.getFullYear() - i;
          return { value: String(y), label: String(y) };
        })}
      />
    </div>
  );

  const compareChart = (compareData?.months || []).map((m: number, idx: number) => ({
    month: m,
    sales: compareData?.sales?.[idx] || 0,
    sales_prev: compareData?.sales_prev?.[idx] || 0,
    profit: compareData?.profit?.[idx] || 0,
    profit_prev: compareData?.profit_prev?.[idx] || 0,
    expense: compareData?.expense?.[idx] || 0,
    expense_prev: compareData?.expense_prev?.[idx] || 0
  }));

  const salesTotals = salesByProduct.reduce(
    (sum: { pieces: number; amount: number; profit: number }, row: any) => ({
      pieces: sum.pieces + Number(row?.sales || 0),
      amount: sum.amount + Number(row?.sales_amount || 0),
      profit: sum.profit + Number(row?.net_profit || 0),
    }),
    { pieces: 0, amount: 0, profit: 0 }
  );

  return (
    <div className="space-y-6 transition-colors duration-300">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 text-right">
        <div>
          <h2 className="text-xl font-black text-slate-900 dark:text-white">نظام التقارير المتقدم</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">تحليلات شاملة لأداء المؤسسة</p>
        </div>
        <div className="flex bg-white dark:bg-slate-800 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-x-auto max-w-full">
          <button onClick={() => setActiveSubTab('sales')} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all shrink-0 ${activeSubTab === 'sales' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'}`}><ShoppingCart size={16} /> المبيعات</button>
          <button onClick={() => setActiveSubTab('totals')} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all shrink-0 ${activeSubTab === 'totals' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'}`}><FileText size={16} /> ملخص الفترة</button>
          <button onClick={() => setActiveSubTab('product-report')} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all shrink-0 ${activeSubTab === 'product-report' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'}`}><ShoppingCart size={16} /> تقرير منتجات</button>
          <button onClick={() => setActiveSubTab('reps')} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all shrink-0 ${activeSubTab === 'reps' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'}`}><UserCheck size={16} /> أداء المناديب</button>
          <button onClick={() => setActiveSubTab('compare')} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all shrink-0 ${activeSubTab === 'compare' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'}`}><BarChart3 size={16} /> المقارنات</button>
        </div>
      </div>

      {activeSubTab === 'sales' && (
        <ReportSection
          title="تقارير المبيعات الشاملة"
          description="تحليل تفصيلي لأداء المبيعات، المنتجات، والعملاء."
          icon={ShoppingCart}
          filters={salesFilters}
          onGenerate={() => handleGenerateReport('Sales')}
        >
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-slate-50 dark:bg-slate-900/50 p-6 rounded-2xl border dark:border-slate-700">
              <h4 className="font-bold text-slate-800 dark:text-slate-100 mb-4">المبيعات حسب المنتج</h4>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={salesByProduct}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? "#334155" : "#e2e8f0"} />
                    <XAxis dataKey="name" tick={{ fill: isDark ? '#94a3b8' : '#64748b' }} />
                    <YAxis tick={{ fill: isDark ? '#94a3b8' : '#64748b' }} />
                    <Tooltip contentStyle={{ borderRadius: '12px', background: isDark ? '#1e293b' : 'white', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} itemStyle={{ color: isDark ? '#f1f5f9' : '#1e293b' }} />
                    <Bar dataKey="sales" name="إجمالي المبيعات" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="bg-slate-50 dark:bg-slate-900/50 p-6 rounded-2xl border dark:border-slate-700">
              <h4 className="font-bold text-slate-800 dark:text-slate-100 mb-4">إجمالي المبيعات اليومية</h4>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={dailySales}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? "#334155" : "#e2e8f0"} />
                    <XAxis dataKey="date" tick={{ fill: isDark ? '#94a3b8' : '#64748b' }} />
                    <YAxis tick={{ fill: isDark ? '#94a3b8' : '#64748b' }} />
                    <Tooltip contentStyle={{ borderRadius: '12px', background: isDark ? '#1e293b' : 'white', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} itemStyle={{ color: isDark ? '#f1f5f9' : '#1e293b' }} />
                    <Line type="monotone" dataKey="total" name="المبيعات" stroke="#8884d8" strokeWidth={2} activeDot={{ r: 6 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <h4 className="font-bold text-slate-800 dark:text-slate-100 mb-4 flex items-center gap-2"><Table size={18} className="text-slate-400" /> ملخص مبيعات المنتجات</h4>
          <div className="overflow-x-auto rounded-2xl border dark:border-slate-700">
            <table className="w-full text-right text-sm">
              <thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-500 dark:text-slate-400">
                <tr>
                  <th className="px-6 py-3 font-bold">المنتج</th>
                  <th className="px-6 py-3 font-bold">عدد القطع المباعة</th>
                  <th className="px-6 py-3 font-bold">إجمالي المبيعات ({currencySymbol})</th>
                  <th className="px-6 py-3 font-bold">صافي الربح ({currencySymbol})</th>
                </tr>
              </thead>
              <tbody className="divide-y dark:divide-slate-700 text-slate-700 dark:text-slate-300">
                {salesByProduct.map((item: any, index) => (
                  <tr key={`${item.name || 'product'}-${index}`} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                    <td className="px-6 py-4 font-bold">{item.name}</td>
                    <td className="px-6 py-4">{Number(item.sales || 0).toLocaleString()}</td>
                    <td className="px-6 py-4 font-black text-blue-600 dark:text-blue-400">{Number(item.sales_amount || 0).toLocaleString()}</td>
                    <td className={`px-6 py-4 font-black ${Number(item.net_profit || 0) >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>{Number(item.net_profit || 0).toLocaleString()}</td>
                  </tr>
                ))}
                <tr className="bg-slate-100/70 dark:bg-slate-700/40">
                  <td className="px-6 py-4 font-black">الإجمالي</td>
                  <td className="px-6 py-4 font-black">{salesTotals.pieces.toLocaleString()}</td>
                  <td className="px-6 py-4 font-black text-blue-700 dark:text-blue-300">{salesTotals.amount.toLocaleString()}</td>
                  <td className={`px-6 py-4 font-black ${salesTotals.profit >= 0 ? 'text-emerald-700 dark:text-emerald-300' : 'text-rose-700 dark:text-rose-300'}`}>{salesTotals.profit.toLocaleString()}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </ReportSection>
      )}

      {activeSubTab === 'product-report' && (
        <ReportSection
          title="تقرير المنتجات والتسليم"
          description="تقرير عن نسبه المبيعات و المرتجعات للمتجات"
          icon={Package}
          filters={salesFilters}
          onGenerate={() => handleGenerateReport('Product report')}
        >
          <div className="overflow-x-auto rounded-2xl border bg-white p-4">
            {/* Fetch data from backend endpoint: module=reports&action=product_delivery */}
            <ProductDeliveryTable startDate={startDate} endDate={endDate} />
          </div>
        </ReportSection>
      )}

      {activeSubTab === 'daily' && (
        <div>
          <DailyReport />
        </div>
      )}
      {activeSubTab === 'totals' && (
        <div>
          <TotalsReport />
        </div>
      )}

      {activeSubTab === 'reps' && (
        <RepsPerformanceSection startDate={startDate} endDate={endDate} setStartDate={setStartDate} setEndDate={setEndDate} isDark={isDark} currencySymbol={currencySymbol} />
      )}

      {activeSubTab === 'inventory' && (
        <ReportSection
          title="تقارير حركة المخزون والجرد"
          description="متابعة مستويات المخزون، الحركات، والتحويلات بين المستودعات."
          icon={Package}
          filters={inventoryFilters}
          onGenerate={() => handleGenerateReport('Inventory')}
        >
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-slate-50 dark:bg-slate-900/50 p-6 rounded-2xl border dark:border-slate-700">
              <h4 className="font-bold text-slate-800 dark:text-slate-100 mb-4 flex items-center gap-2"><Warehouse size={16} className="text-slate-400" /> مستويات المخزون حسب المستودع</h4>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={inventoryStockByWarehouse}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? "#334155" : "#e2e8f0"} />
                    <XAxis dataKey="name" tick={{ fill: isDark ? '#94a3b8' : '#64748b' }} />
                    <YAxis tick={{ fill: isDark ? '#94a3b8' : '#64748b' }} />
                    <Tooltip contentStyle={{ borderRadius: '12px', background: isDark ? '#1e293b' : 'white', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} itemStyle={{ color: isDark ? '#f1f5f9' : '#1e293b' }} />
                    <Bar dataKey="quantity" name="الكمية" fill="#60a5fa" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="bg-slate-50 dark:bg-slate-900/50 p-6 rounded-2xl border dark:border-slate-700">
              <h4 className="font-bold text-slate-800 dark:text-slate-100 mb-4 flex items-center gap-2"><ArrowLeftRight size={16} className="text-slate-400" /> حركة المخزون</h4>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={inventoryMovement}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? "#334155" : "#e2e8f0"} />
                    <XAxis dataKey="date" tick={{ fill: isDark ? '#94a3b8' : '#64748b' }} />
                    <YAxis tick={{ fill: isDark ? '#94a3b8' : '#64748b' }} />
                    <Tooltip contentStyle={{ borderRadius: '12px', background: isDark ? '#1e293b' : 'white', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} itemStyle={{ color: isDark ? '#f1f5f9' : '#1e293b' }} />
                    <Line type="monotone" dataKey="quantity" name="الكمية المحركة" stroke="#fbbf24" strokeWidth={2} activeDot={{ r: 6 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <h4 className="font-bold text-slate-800 dark:text-slate-100 mb-4 flex items-center gap-2"><Table size={18} className="text-slate-400" /> الأصناف في المخزون</h4>
          <div className="overflow-x-auto rounded-2xl border dark:border-slate-700">
            <table className="w-full text-right text-sm">
              <thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-500 dark:text-slate-400">
                <tr>
                  <th className="px-6 py-3 font-bold">المنتج</th>
                  <th className="px-6 py-3 font-bold">باركود</th>
                  <th className="px-6 py-3 font-bold">المستودع</th>
                  <th className="px-6 py-3 font-bold">الكمية</th>
                  <th className="px-6 py-3 font-bold">سعر الشراء ({currencySymbol})</th>
                </tr>
              </thead>
              <tbody className="divide-y dark:divide-slate-700 text-slate-700 dark:text-slate-300">
                {inventoryStock.map((item: any, index) => (
                  <tr key={index} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                    <td className="px-6 py-4 font-bold">{item.product}</td>
                    <td className="px-6 py-4 font-mono text-xs">{item.barcode}</td>
                    <td className="px-6 py-4 text-xs">{item.warehouse}</td>
                    <td className="px-6 py-4"><span className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 px-3 py-1 rounded-lg text-[10px] font-black">{item.quantity}</span></td>
                    <td className="px-6 py-4 font-black">{item.purchasePrice.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h4 className="font-bold text-slate-800 dark:text-slate-100 mb-4 flex items-center gap-2"><History size={18} className="text-slate-400" /> سجل حركات المخزون</h4>
          <div className="overflow-x-auto rounded-2xl border dark:border-slate-700">
            <table className="w-full text-right text-sm">
              <thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-500 dark:text-slate-400">
                <tr>
                  <th className="px-6 py-3 font-bold">رقم الحركة</th>
                  <th className="px-6 py-3 font-bold">التاريخ</th>
                  <th className="px-6 py-3 font-bold">المنتج</th>
                  <th className="px-6 py-3 font-bold">النوع</th>
                  <th className="px-6 py-3 font-bold">الكمية</th>
                  <th className="px-6 py-3 font-bold">المصدر/الوجهة</th>
                </tr>
              </thead>
              <tbody className="divide-y dark:divide-slate-700 text-slate-700 dark:text-slate-300">
                {inventoryMovementHistory.map((item: any) => (
                  <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                    <td className="px-6 py-4 font-bold">{item.id}</td>
                    <td className="px-6 py-4">{item.date}</td>
                    <td className="px-6 py-4">{item.product}</td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-lg text-[10px] font-black ${item.type === 'in' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400'}`}>
                        {item.type === 'in' ? 'إدخال' : 'إخراج'}
                      </span>
                    </td>
                    <td className="px-6 py-4">{item.quantity}</td>
                    <td className="px-6 py-4 text-xs">{item.sourceDest}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ReportSection>
      )}

      {activeSubTab === 'finance' && (
        <ReportSection
          title="التقارير المالية والتدفقات النقدية"
          description="متابعة أرصدة الخزائن، الإيرادات، والمصروفات."
          icon={Coins}
          filters={financeFilters}
          onGenerate={() => handleGenerateReport('Finance')}
        >
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-slate-50 dark:bg-slate-900/50 p-6 rounded-2xl border dark:border-slate-700">
              <h4 className="font-bold text-slate-800 dark:text-slate-100 mb-4 flex items-center gap-2"><Coins size={16} className="text-slate-400" /> أرصدة الخزائن (تاريخي)</h4>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={treasuryBalanceHistory}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? "#334155" : "#e2e8f0"} />
                    <XAxis dataKey="date" tick={{ fill: isDark ? '#94a3b8' : '#64748b' }} />
                    <YAxis tick={{ fill: isDark ? '#94a3b8' : '#64748b' }} />
                    <Tooltip contentStyle={{ borderRadius: '12px', background: isDark ? '#1e293b' : 'white', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} itemStyle={{ color: isDark ? '#f1f5f9' : '#1e293b' }} />
                    <Line type="monotone" dataKey="balance" name="الرصيد" stroke="#10b981" strokeWidth={2} activeDot={{ r: 6 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="bg-slate-50 dark:bg-slate-900/50 p-6 rounded-2xl border dark:border-slate-700">
              <h4 className="font-bold text-slate-800 dark:text-slate-100 mb-4 flex items-center gap-2"><Receipt size={16} className="text-slate-400" /> المصروفات حسب الفئة</h4>
              <div className="h-64 flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={expenseCategories}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                      nameKey="name"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    >

                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: '12px', background: isDark ? '#1e293b' : 'white', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} itemStyle={{ color: isDark ? '#f1f5f9' : '#1e293b' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <h4 className="font-bold text-slate-800 dark:text-slate-100 mb-4 flex items-center gap-2"><Table size={18} className="text-slate-400" /> سجل الإيرادات والمصروفات</h4>
          <div className="overflow-x-auto rounded-2xl border dark:border-slate-700">
            <table className="w-full text-right text-sm">
              <thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-500 dark:text-slate-400">
                <tr>
                  <th className="px-6 py-3 font-bold">التاريخ</th>
                  <th className="px-6 py-3 font-bold">النوع</th>
                  <th className="px-6 py-3 font-bold">الوصف</th>
                  <th className="px-6 py-3 font-bold">المبلغ ({currencySymbol})</th>
                  <th className="px-6 py-3 font-bold">الخزينة</th>
                </tr>
              </thead>
              <tbody className="divide-y dark:divide-slate-700 text-slate-700 dark:text-slate-300">
                {revenueAndExpenseRecords.map((item: any, index) => (
                  <tr key={index} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                    <td className="px-6 py-4 font-bold">{item.date}</td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-lg text-[10px] font-black ${item.type === 'revenue' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                        {translateTxnLabel(item.type, item.desc, item.txn_type)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-xs">{translateTxnLabel(item.type, item.desc, item.txn_type)}</td>
                    <td className={`px-6 py-4 font-black ${item.amount >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{item.amount.toLocaleString()}</td>
                    <td className="px-6 py-4 text-xs">{item.treasury}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ReportSection>
      )}

      {activeSubTab === 'crm-srm' && (
        <ReportSection
          title="تقارير العملاء والموردين"
          description="كشوف حسابات، تقارير ديون، وتحليل علاقات الأعمال."
          icon={Users}
          filters={<div className="flex gap-2 w-full md:w-auto flex-wrap">{dateRangeInputs}</div>}
          onGenerate={() => handleGenerateReport('CRM/SRM')}
        >
          <h4 className="font-bold text-slate-800 dark:text-slate-100 mb-4 flex items-center gap-2"><FileText size={18} className="text-slate-400" /> كشف حساب عميل (مثال: شركة الأمل)</h4>
          <div className="overflow-x-auto rounded-2xl border dark:border-slate-700 mb-6">
            <table className="w-full text-right text-sm">
              <thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-500 dark:text-slate-400">
                <tr>
                  <th className="px-6 py-3 font-bold">الرقم المرجعي</th>
                  <th className="px-6 py-3 font-bold">التاريخ</th>
                  <th className="px-6 py-3 font-bold">الوصف</th>
                  <th className="px-6 py-3 font-bold">مدين ({currencySymbol})</th>
                  <th className="px-6 py-3 font-bold">دائن ({currencySymbol})</th>
                  <th className="px-6 py-3 font-bold">الرصيد ({currencySymbol})</th>
                </tr>
              </thead>
              <tbody className="divide-y dark:divide-slate-700 text-slate-700 dark:text-slate-300">

              </tbody>
            </table>
          </div>

          <h4 className="font-bold text-slate-800 dark:text-slate-100 mb-4 flex items-center gap-2"><ArrowUpRight size={18} className="text-slate-400" /> تقرير الديون المستحقة (Aging Report)</h4>
          <div className="p-10 text-center text-slate-400 font-bold bg-slate-50 dark:bg-slate-900/50 rounded-2xl border dark:border-slate-700">
            لا توجد ديون مستحقة حالياً.
          </div>
        </ReportSection>
      )}

      {activeSubTab === 'hrm' && (
        <ReportSection
          title="تقارير الموارد البشرية"
          description="سجلات الموظفين، كشوف الرواتب، وتتبع الحضور والانصراف."
          icon={Briefcase}
          filters={<div className="flex gap-2 w-full md:w-auto flex-wrap">{dateRangeInputs}</div>}
          onGenerate={() => handleGenerateReport('HRM')}
        >
          <h4 className="font-bold text-slate-800 dark:text-slate-100 mb-4 flex items-center gap-2"><UserCheck size={18} className="text-slate-400" /> تقرير الحضور والانصراف الأسبوعي</h4>
          <div className="overflow-x-auto rounded-2xl border dark:border-slate-700 mb-6">
            <table className="w-full text-right text-sm">
              <thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-500 dark:text-slate-400">
                <tr>
                  <th className="px-6 py-3 font-bold">الموظف</th>
                  <th className="px-6 py-3 font-bold">2024-07-22</th>
                  <th className="px-6 py-3 font-bold">2024-07-23</th>
                  <th className="px-6 py-3 font-bold">2024-07-24</th>
                </tr>
              </thead>
              <tbody className="divide-y dark:divide-slate-700 text-slate-700 dark:text-slate-300">

              </tbody>
            </table>
          </div>

          <h4 className="font-bold text-slate-800 dark:text-slate-100 mb-4 flex items-center gap-2"><CreditCard size={18} className="text-slate-400" /> ملخص الرواتب</h4>
          <div className="p-10 text-center text-slate-400 font-bold bg-slate-50 dark:bg-slate-900/50 rounded-2xl border dark:border-slate-700">
            ملخص الرواتب للموظفين للفترة المحددة.
          </div>
        </ReportSection>
      )}

      {activeSubTab === 'admin-audit' && (
        <ReportSection
          title="تقارير النظام والتدقيق"
          description="متابعة سجلات المستخدمين، الصلاحيات، وحركة النظام."
          icon={ShieldCheck}
          filters={<div className="flex gap-2 w-full md:w-auto flex-wrap">{dateRangeInputs}</div>}
          onGenerate={() => handleGenerateReport('Admin & Audit')}
        >
          <h4 className="font-bold text-slate-800 dark:text-slate-100 mb-4 flex items-center gap-2"><Activity size={18} className="text-slate-400" /> سجل نشاط المستخدمين</h4>
          <div className="overflow-x-auto rounded-2xl border dark:border-slate-700">
            <table className="w-full text-right text-sm">
              <thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-500 dark:text-slate-400">
                <tr>
                  <th className="px-6 py-3 font-bold">المستخدم</th>
                  <th className="px-6 py-3 font-bold">الإجراء</th>
                  <th className="px-6 py-3 font-bold">الوقت</th>
                  <th className="px-6 py-3 font-bold">الوحدة</th>
                </tr>
              </thead>
              <tbody className="divide-y dark:divide-slate-700 text-slate-700 dark:text-slate-300">

              </tbody>
            </table>
          </div>

          <h4 className="font-bold text-slate-800 dark:text-slate-100 mb-4 flex items-center gap-2"><ShieldCheck size={18} className="text-slate-400" /> مصفوفة الصلاحيات الحالية</h4>
          <div className="p-10 text-center text-slate-400 font-bold bg-slate-50 dark:bg-slate-900/50 rounded-2xl border dark:border-slate-700">
            عرض الصلاحيات المعينة لكل دور وظيفي.
          </div>
        </ReportSection>
      )}

      {activeSubTab === 'compare' && (
        <ReportSection
          title="مقارنات شهرية وسنوية"
          description="مقارنة الأداء شهرياً بين هذا العام والعام السابق."
          icon={BarChart3}
          filters={compareFilters}
        >
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="p-4 rounded-2xl border dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
              <div className="text-xs text-muted">إجمالي المبيعات</div>
              <div className="text-2xl font-black">{Number(compareData?.year_totals?.sales || 0).toLocaleString()} {currencySymbol}</div>
              <div className="text-[11px] text-muted mt-1">السنة السابقة: {Number(compareData?.prev_year_totals?.sales || 0).toLocaleString()} {currencySymbol}</div>
            </div>
            <div className="p-4 rounded-2xl border dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
              <div className="text-xs text-muted">إجمالي الأرباح</div>
              <div className="text-2xl font-black">{Number(compareData?.year_totals?.profit || 0).toLocaleString()} {currencySymbol}</div>
              <div className="text-[11px] text-muted mt-1">السنة السابقة: {Number(compareData?.prev_year_totals?.profit || 0).toLocaleString()} {currencySymbol}</div>
            </div>
            <div className="p-4 rounded-2xl border dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
              <div className="text-xs text-muted">إجمالي المصروفات</div>
              <div className="text-2xl font-black">{Number(compareData?.year_totals?.expense || 0).toLocaleString()} {currencySymbol}</div>
              <div className="text-[11px] text-muted mt-1">السنة السابقة: {Number(compareData?.prev_year_totals?.expense || 0).toLocaleString()} {currencySymbol}</div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-slate-50 dark:bg-slate-900/50 p-6 rounded-2xl border dark:border-slate-700">
              <h4 className="font-bold text-slate-800 dark:text-slate-100 mb-4">المبيعات الشهرية</h4>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={compareChart}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? "#334155" : "#e2e8f0"} />
                    <XAxis dataKey="month" tick={{ fill: isDark ? '#94a3b8' : '#64748b' }} />
                    <YAxis tick={{ fill: isDark ? '#94a3b8' : '#64748b' }} />
                    <Tooltip contentStyle={{ borderRadius: '12px', background: isDark ? '#1e293b' : 'white', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} itemStyle={{ color: isDark ? '#f1f5f9' : '#1e293b' }} />
                    <Line type="monotone" dataKey="sales" name={String(compareData?.year || '')} stroke="#2563eb" strokeWidth={2} />
                    <Line type="monotone" dataKey="sales_prev" name={String(compareData?.prev_year || '')} stroke="#94a3b8" strokeWidth={2} strokeDasharray="4 4" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="bg-slate-50 dark:bg-slate-900/50 p-6 rounded-2xl border dark:border-slate-700">
              <h4 className="font-bold text-slate-800 dark:text-slate-100 mb-4">الأرباح مقابل المصروفات</h4>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={compareChart}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? "#334155" : "#e2e8f0"} />
                    <XAxis dataKey="month" tick={{ fill: isDark ? '#94a3b8' : '#64748b' }} />
                    <YAxis tick={{ fill: isDark ? '#94a3b8' : '#64748b' }} />
                    <Tooltip contentStyle={{ borderRadius: '12px', background: isDark ? '#1e293b' : 'white', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} itemStyle={{ color: isDark ? '#f1f5f9' : '#1e293b' }} />
                    <Bar dataKey="profit" name="الأرباح" fill="#10b981" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="expense" name="المصروفات" fill="#ef4444" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </ReportSection>
      )}
    </div>
  );
};

export default ReportsModule;