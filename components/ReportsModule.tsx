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
import { useTheme } from './ThemeContext';
import CustomSelect from './CustomSelect';

interface ReportsModuleProps {
  initialView?: string;
}

const ReportsModule: React.FC<ReportsModuleProps> = ({ initialView }) => {
  const [activeSubTab, setActiveSubTab] = useState<string>(initialView || 'sales');
  const today = new Date();
  const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const [startDate, setStartDate] = useState(firstDayOfMonth.toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(today.toISOString().split('T')[0]);
  const currencySymbol = 'ج.م';
  const { isDark } = useTheme();

  const [salesByProduct, setSalesByProduct] = useState([]);
  const [dailySales, setDailySales] = useState([]);
  const [invoiceRecords, setInvoiceRecords] = useState([]);

  const [salesStatus, setSalesStatus] = useState('');
  const [salesCustomerId, setSalesCustomerId] = useState('');
  const [salesRepId, setSalesRepId] = useState('');

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

  const [customers, setCustomers] = useState<any[]>([]);
  const [reps, setReps] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [treasuries, setTreasuries] = useState<any[]>([]);

  const [compareYear, setCompareYear] = useState<number>(today.getFullYear());
  const [compareData, setCompareData] = useState<any>(null);

  useEffect(() => {
    if (initialView) setActiveSubTab(initialView);
  }, [initialView]);

  useEffect(() => {
    const loadLookups = async () => {
      try {
        const [custRes, usersRes, whRes, trRes] = await Promise.all([
          fetch(`${API_BASE_PATH}/api.php?module=customers&action=getAll`).then(r => r.json()).catch(() => ({ success: false, data: [] })),
          fetch(`${API_BASE_PATH}/api.php?module=users&action=getAll`).then(r => r.json()).catch(() => ({ success: false, data: [] })),
          fetch(`${API_BASE_PATH}/api.php?module=warehouses&action=getAll`).then(r => r.json()).catch(() => ({ success: false, data: [] })),
          fetch(`${API_BASE_PATH}/api.php?module=treasuries&action=getAll`).then(r => r.json()).catch(() => ({ success: false, data: [] }))
        ]);

        if (custRes && custRes.success) setCustomers(custRes.data || []);
        if (usersRes && usersRes.success) {
          const repsOnly = (usersRes.data || []).filter((u: any) => (u.role || '').toString().toLowerCase() === 'representative');
          setReps(repsOnly);
        }
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
      const salesParams = `${urlParams}${salesStatus ? `&status=${encodeURIComponent(salesStatus)}` : ''}${salesCustomerId ? `&customer_id=${encodeURIComponent(salesCustomerId)}` : ''}${salesRepId ? `&rep_id=${encodeURIComponent(salesRepId)}` : ''}`;
      fetch(`${API_BASE_PATH}/api.php?module=reports&action=sales${salesParams}`)
        .then(res => res.json())
        .then(data => {
          if (data && data.success) {
            setSalesByProduct(data.data.salesByProduct || []);
            setDailySales(data.data.dailySales || []);
            setInvoiceRecords(data.data.invoiceRecords || []);
          } else {
            setSalesByProduct([]);
            setDailySales([]);
            setInvoiceRecords([]);
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
  }, [activeSubTab, startDate, endDate, salesStatus, salesCustomerId, salesRepId, inventoryWarehouseId, inventoryMovementType, financeTreasuryId, financeTxnType]);

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
        ['salesByProduct', 'name', 'sales', '', ''],
        ...salesByProduct.map((r: any) => ['salesByProduct', r.name, r.sales, '', '']),
        ['dailySales', 'date', 'total', '', ''],
        ...dailySales.map((r: any) => ['dailySales', r.date, r.total, '', '']),
        ['invoiceRecords', 'order_number', 'date', 'customer', 'total'],
        ...invoiceRecords.map((r: any) => ['invoiceRecords', r.order_number, r.date, r.customer, r.total])
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
      <CustomSelect
        value={salesStatus}
        onChange={(v) => setSalesStatus(v)}
        options={[
          { value: '', label: 'كل الحالات' },
          { value: 'pending', label: 'قيد الانتظار' },
          { value: 'with_rep', label: 'مع المندوب' },
          { value: 'delivered', label: 'تم التسليم' },
          { value: 'returned', label: 'مرتجع' },
          { value: 'partial', label: 'جزئي' },
          { value: 'postponed', label: 'مؤجل' }
        ]}
        placeholder="حالة الفاتورة"
      />
      <CustomSelect
        value={salesCustomerId}
        onChange={(v) => setSalesCustomerId(v)}
        options={[{ value: '', label: 'كل العملاء' }, ...customers.map((c: any) => ({ value: String(c.id), label: c.name }))]}
        placeholder="العملاء"
      />
      <CustomSelect
        value={salesRepId}
        onChange={(v) => setSalesRepId(v)}
        options={[{ value: '', label: 'كل المناديب' }, ...reps.map((r: any) => ({ value: String(r.id), label: r.name }))]}
        placeholder="المناديب"
      />
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

  return (
    <div className="space-y-6 transition-colors duration-300">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 text-right">
        <div>
          <h2 className="text-xl font-black text-slate-900 dark:text-white">نظام التقارير المتقدم</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">تحليلات شاملة لأداء المؤسسة</p>
        </div>
        <div className="flex bg-white dark:bg-slate-800 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-x-auto max-w-full">
          <button onClick={() => setActiveSubTab('sales')} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all shrink-0 ${activeSubTab === 'sales' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'}`}><ShoppingCart size={16}/> المبيعات</button>
          <button onClick={() => setActiveSubTab('inventory')} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all shrink-0 ${activeSubTab === 'inventory' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'}`}><Package size={16}/> المخزون</button>
          <button onClick={() => setActiveSubTab('finance')} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all shrink-0 ${activeSubTab === 'finance' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'}`}><Wallet size={16}/> المالية</button>
          <button onClick={() => setActiveSubTab('daily')} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all shrink-0 ${activeSubTab === 'daily' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'}`}><History size={16}/> اليومية</button>
          <button onClick={() => setActiveSubTab('totals')} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all shrink-0 ${activeSubTab === 'totals' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'}`}><FileText size={16}/> ملخص الفترة</button>
          <button onClick={() => setActiveSubTab('crm-srm')} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all shrink-0 ${activeSubTab === 'crm-srm' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'}`}><Users size={16}/> العملاء والموردين</button>
          <button onClick={() => setActiveSubTab('hrm')} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all shrink-0 ${activeSubTab === 'hrm' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'}`}><Briefcase size={16}/> الموارد البشرية</button>
          <button onClick={() => setActiveSubTab('admin-audit')} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all shrink-0 ${activeSubTab === 'admin-audit' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'}`}><ShieldCheck size={16}/> النظام والتدقيق</button>
          <button onClick={() => setActiveSubTab('compare')} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all shrink-0 ${activeSubTab === 'compare' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'}`}><BarChart3 size={16}/> المقارنات</button>
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
          
          <h4 className="font-bold text-slate-800 dark:text-slate-100 mb-4 flex items-center gap-2"><Table size={18} className="text-slate-400"/> سجل الفواتير</h4>
          <div className="overflow-x-auto rounded-2xl border dark:border-slate-700">
            <table className="w-full text-right text-sm">
              <thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-500 dark:text-slate-400">
                <tr>
                  <th className="px-6 py-3 font-bold">رقم الفاتورة</th>
                  <th className="px-6 py-3 font-bold">التاريخ</th>
                  <th className="px-6 py-3 font-bold">العميل</th>
                  <th className="px-6 py-3 font-bold">الإجمالي ({currencySymbol})</th>
                  <th className="px-6 py-3 font-bold">الحالة</th>
                </tr>
              </thead>
              <tbody className="divide-y dark:divide-slate-700 text-slate-700 dark:text-slate-300">
                {invoiceRecords.map((item: any, index) => (
                  <tr key={item.order_number || item.id || index} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                    <td className="px-6 py-4 font-bold">{item.order_number}</td>
                    <td className="px-6 py-4">{item.date}</td>
                    <td className="px-6 py-4">{item.customer}</td>
                    <td className="px-6 py-4 font-black text-blue-600 dark:text-blue-400">{item.total.toLocaleString()}</td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-lg text-[10px] font-black ${item.status === 'Completed' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'}`}>
                        {item.status === 'Completed' ? 'مكتمل' : 'معلق'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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
              <h4 className="font-bold text-slate-800 dark:text-slate-100 mb-4 flex items-center gap-2"><Warehouse size={16} className="text-slate-400"/> مستويات المخزون حسب المستودع</h4>
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
              <h4 className="font-bold text-slate-800 dark:text-slate-100 mb-4 flex items-center gap-2"><ArrowLeftRight size={16} className="text-slate-400"/> حركة المخزون</h4>
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

          <h4 className="font-bold text-slate-800 dark:text-slate-100 mb-4 flex items-center gap-2"><Table size={18} className="text-slate-400"/> الأصناف في المخزون</h4>
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

          <h4 className="font-bold text-slate-800 dark:text-slate-100 mb-4 flex items-center gap-2"><History size={18} className="text-slate-400"/> سجل حركات المخزون</h4>
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
              <h4 className="font-bold text-slate-800 dark:text-slate-100 mb-4 flex items-center gap-2"><Coins size={16} className="text-slate-400"/> أرصدة الخزائن (تاريخي)</h4>
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
              <h4 className="font-bold text-slate-800 dark:text-slate-100 mb-4 flex items-center gap-2"><Receipt size={16} className="text-slate-400"/> المصروفات حسب الفئة</h4>
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

          <h4 className="font-bold text-slate-800 dark:text-slate-100 mb-4 flex items-center gap-2"><Table size={18} className="text-slate-400"/> سجل الإيرادات والمصروفات</h4>
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
          <h4 className="font-bold text-slate-800 dark:text-slate-100 mb-4 flex items-center gap-2"><FileText size={18} className="text-slate-400"/> كشف حساب عميل (مثال: شركة الأمل)</h4>
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

          <h4 className="font-bold text-slate-800 dark:text-slate-100 mb-4 flex items-center gap-2"><ArrowUpRight size={18} className="text-slate-400"/> تقرير الديون المستحقة (Aging Report)</h4>
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
          <h4 className="font-bold text-slate-800 dark:text-slate-100 mb-4 flex items-center gap-2"><UserCheck size={18} className="text-slate-400"/> تقرير الحضور والانصراف الأسبوعي</h4>
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

          <h4 className="font-bold text-slate-800 dark:text-slate-100 mb-4 flex items-center gap-2"><CreditCard size={18} className="text-slate-400"/> ملخص الرواتب</h4>
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
          <h4 className="font-bold text-slate-800 dark:text-slate-100 mb-4 flex items-center gap-2"><Activity size={18} className="text-slate-400"/> سجل نشاط المستخدمين</h4>
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

          <h4 className="font-bold text-slate-800 dark:text-slate-100 mb-4 flex items-center gap-2"><ShieldCheck size={18} className="text-slate-400"/> مصفوفة الصلاحيات الحالية</h4>
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