import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Calendar,
  Filter,
  Download,
  Printer,
  RefreshCw,
  Coins,
  Package,
  TrendingUp,
  TrendingDown,
  DollarSign,
  FileSpreadsheet,
  Layers,
  Table,
  FileText,
  AlertCircle,
  CheckCircle2,
  Sliders,
  RotateCcw,
  Receipt,
  Building,
  Vault,
  Truck,
  Users,
  ShieldCheck,
  ChevronDown
} from 'lucide-react';
import * as ExcelJS from 'exceljs';
import Swal from 'sweetalert2';
import { API_BASE_PATH } from '../services/apiConfig';
import { formatLocalDate, getFirstDayOfMonth, getDaysAgo } from '../services/dateUtils';
import { useTheme } from './ThemeContext';

interface ProductVariantItem {
  variant_id: number;
  color: string;
  size: string;
  custody_qty: number;
  warehouse_qty: number;
  total_qty: number;
  cost_price: number;
  total_cost: number;
}

interface CapitalProduct {
  product_id: number;
  product_name: string;
  custody_qty: number;
  warehouse_qty: number;
  total_qty: number;
  cost_price: number;
  total_cost: number;
  warehouse_cost?: number;
  custody_cost?: number;
  variants?: ProductVariantItem[];
  notes: string;
}

interface ExpenseCategoryItem {
  category_name: string;
  total_amount: number;
  count: number;
}

interface ExpenseItem {
  id: number;
  name: string;
  category?: string;
  amount: number;
  date: string;
  treasury_name?: string;
}

interface ProfitLossProduct {
  product_id: number;
  product_name: string;
  sold_qty: number;
  sales_revenue: number;
  cost_price: number;
  product_profit: number;
  notes: string;
}

const NewProfitLossReport: React.FC = () => {
  const { isDark } = useTheme();
  const currencySymbol = localStorage.getItem('Dragon_currency') || 'ج.م';

  // Date filters
  const [startDate, setStartDate] = useState(getFirstDayOfMonth());
  const [endDate, setEndDate] = useState(formatLocalDate());
  const [loading, setLoading] = useState(false);

  // Raw data from API
  const [capitalProducts, setCapitalProducts] = useState<CapitalProduct[]>([]);
  const [apiWarehouseCost, setApiWarehouseCost] = useState(0);
  const [apiCustodyCost, setApiCustodyCost] = useState(0);
  const [apiRepsDebtTotal, setApiRepsDebtTotal] = useState(0);
  const [apiRepsInsurance, setApiRepsInsurance] = useState(0);
  const [apiSuppliersBalance, setApiSuppliersBalance] = useState(0);
  const [apiCashInSafes, setApiCashInSafes] = useState(0);
  const [apiPenalties, setApiPenalties] = useState(0);
  const [apiBonuses, setApiBonuses] = useState(0);

  const [expensesList, setExpensesList] = useState<ExpenseItem[]>([]);
  const [expenseCategories, setExpenseCategories] = useState<ExpenseCategoryItem[]>([]);
  const [soldProducts, setSoldProducts] = useState<ProfitLossProduct[]>([]);
  const [showVariantDetails, setShowVariantDetails] = useState(false);

  // Manual Overrides / Interactive adjustments
  const [isManualOverride, setIsManualOverride] = useState(false);
  const [customWarehouseCost, setCustomWarehouseCost] = useState<number | null>(null);
  const [customCustodyCost, setCustomCustodyCost] = useState<number | null>(null);
  const [customRepsDebtTotal, setCustomRepsDebtTotal] = useState<number | null>(null);
  const [customRepsInsurance, setCustomRepsInsurance] = useState<number | null>(null);
  const [customSuppliersBalance, setCustomSuppliersBalance] = useState<number | null>(null);
  const [customCashInSafes, setCustomCashInSafes] = useState<number | null>(null);
  const [customPenalties, setCustomPenalties] = useState<number | null>(null);
  const [customBonuses, setCustomBonuses] = useState<number | null>(null);
  const [customCostPrices, setCustomCostPrices] = useState<Record<number, number>>({});

  // View option: show only products with sales or all products in P&L
  const [showSoldOnly, setShowSoldOnly] = useState(false);

  // Print ref
  const printAreaRef = useRef<HTMLDivElement>(null);

  // Fetch report data
  const fetchData = async () => {
    setLoading(true);
    try {
      const url = `${API_BASE_PATH}/api.php?module=reports&action=new_profit_loss&start_date=${startDate}&end_date=${endDate}`;
      const res = await fetch(url);
      const json = await res.json();

      if (json && json.success && json.data) {
        const cap = json.data.capital || {};
        const exp = json.data.expenses || {};
        const pl = json.data.profit_loss || {};

        setCapitalProducts(cap.products || []);
        setApiWarehouseCost(Number(cap.warehouse_cost || 0));
        setApiCustodyCost(Number(cap.custody_cost || 0));
        setApiRepsDebtTotal(Number(cap.reps_debt_total || 0));
        setApiRepsInsurance(Number(cap.reps_insurance || 0));
        setApiSuppliersBalance(Number(cap.suppliers_balance || 0));
        setApiCashInSafes(Number(cap.cash_in_safes || 0));

        const pen = Number(pl.total_penalties || 0);
        const bon = Number(pl.total_bonuses || 0);
        setApiPenalties(pen);
        setApiBonuses(bon);

        setExpensesList(exp.rows || []);
        setExpenseCategories(exp.categories || []);
        setSoldProducts(pl.products || []);
      } else {
        Swal.fire('تنبيه', json.message || 'لم يتم العثور على بيانات لهذه الفترة.', 'info');
      }
    } catch (err: any) {
      console.error(err);
      Swal.fire('خطأ', 'فشل في تحميل بيانات تقرير الأرباح والخسائر الجديد.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [startDate, endDate]);

  // Reset custom overrides
  const resetOverrides = () => {
    setCustomWarehouseCost(null);
    setCustomCustodyCost(null);
    setCustomRepsDebtTotal(null);
    setCustomRepsInsurance(null);
    setCustomSuppliersBalance(null);
    setCustomCashInSafes(null);
    setCustomPenalties(null);
    setCustomBonuses(null);
    setCustomCostPrices({});
    Swal.fire({
      icon: 'success',
      title: 'تمت إعادة الضبط',
      text: 'تم استرجاع جميع القيم التلقائية المحسوبة من النظام.',
      timer: 1500,
      showConfirmButton: false
    });
  };

  // Quick Date Presets
  const handleDatePreset = (preset: string) => {
    const today = formatLocalDate();
    if (preset === 'today') {
      setStartDate(today);
      setEndDate(today);
    } else if (preset === 'this_week') {
      setStartDate(getDaysAgo(7));
      setEndDate(today);
    } else if (preset === 'this_month') {
      setStartDate(getFirstDayOfMonth());
      setEndDate(today);
    } else if (preset === 'last_month') {
      const d = new Date();
      d.setMonth(d.getMonth() - 1);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const lastDay = new Date(y, d.getMonth() + 1, 0).getDate();
      setStartDate(`${y}-${m}-01`);
      setEndDate(`${y}-${m}-${lastDay}`);
    } else if (preset === 'this_year') {
      const y = new Date().getFullYear();
      setStartDate(`${y}-01-01`);
      setEndDate(today);
    } else if (preset === 'all') {
      setStartDate('2025-01-01');
      setEndDate(today);
    }
  };

  // 1. Processed Capital Products
  const processedCapital = useMemo(() => {
    let totCustody = 0;
    let totWarehouse = 0;
    let totQty = 0;
    let totCost = 0;
    let calcWhCost = 0;
    let calcCustodyCost = 0;

    const rows = capitalProducts.map(p => {
      const cost = customCostPrices[p.product_id] !== undefined
        ? customCostPrices[p.product_id]
        : Number(p.cost_price || 0);
      const custodyQty = Number(p.custody_qty || 0);
      const warehouseQty = Number(p.warehouse_qty || 0);
      const totalUnits = custodyQty + warehouseQty;
      const whCost = warehouseQty * cost;
      const custCost = custodyQty * cost;
      const totalItemCost = totalUnits * cost;

      totCustody += custodyQty;
      totWarehouse += warehouseQty;
      totQty += totalUnits;
      calcWhCost += whCost;
      calcCustodyCost += custCost;
      totCost += totalItemCost;

      return {
        ...p,
        effectiveCost: cost,
        totalUnits,
        whCost,
        custCost,
        totalItemCost
      };
    });

    const warehouseCost = customWarehouseCost !== null ? customWarehouseCost : (apiWarehouseCost > 0 ? apiWarehouseCost : calcWhCost);
    const custodyCost = customCustodyCost !== null ? customCustodyCost : (apiCustodyCost > 0 ? apiCustodyCost : calcCustodyCost);
    const totalGoodsCost = warehouseCost + custodyCost;

    const safesBal = customCashInSafes !== null ? customCashInSafes : apiCashInSafes;
    const repsDebt = customRepsDebtTotal !== null ? customRepsDebtTotal : apiRepsDebtTotal;
    const suppliersBal = customSuppliersBalance !== null ? customSuppliersBalance : apiSuppliersBalance;
    const repsInsurance = customRepsInsurance !== null ? customRepsInsurance : apiRepsInsurance;

    // Pure Capital Equation:
    // Goods (Warehouse + Custody) + Cash in Safes + Reps Debt to Us - Suppliers Balance - Reps Insurance
    const netCapital = totalGoodsCost + safesBal + repsDebt - suppliersBal - repsInsurance;

    return {
      rows,
      totCustody,
      totWarehouse,
      totQty,
      totCost,
      warehouseCost,
      custodyCost,
      totalGoodsCost,
      safesBal,
      repsDebt,
      suppliersBal,
      repsInsurance,
      netCapital
    };
  }, [capitalProducts, customCostPrices, customWarehouseCost, customCustodyCost, customRepsDebtTotal, customRepsInsurance, customSuppliersBalance, customCashInSafes, apiWarehouseCost, apiCustodyCost, apiRepsDebtTotal, apiRepsInsurance, apiSuppliersBalance, apiCashInSafes]);

  // 2. Processed Expenses
  const processedExpenses = useMemo(() => {
    let catList = expenseCategories;
    if (!catList || catList.length === 0) {
      const map = new Map<string, { total: number; count: number }>();
      expensesList.forEach(e => {
        const cat = e.category || e.name || 'مصروفات عامة';
        const curr = map.get(cat) || { total: 0, count: 0 };
        curr.total += Number(e.amount || 0);
        curr.count += 1;
        map.set(cat, curr);
      });
      catList = Array.from(map.entries()).map(([k, v]) => ({
        category_name: k,
        total_amount: v.total,
        count: v.count
      }));
    }
    const total = catList.reduce((acc, curr) => acc + Number(curr.total_amount || 0), 0);
    return {
      categories: catList,
      rows: expensesList,
      total
    };
  }, [expenseCategories, expensesList]);

  // 3. Processed Profit & Loss Products
  const processedProfitLoss = useMemo(() => {
    // Map of sold products by ID
    const soldMap = new Map<number, ProfitLossProduct>();
    soldProducts.forEach(sp => {
      soldMap.set(sp.product_id, sp);
    });

    // Build product rows: include all capital products or only those sold based on filter
    const combinedRows: any[] = [];
    const treatedIds = new Set<number>();

    // First go through capital products to preserve catalog order
    capitalProducts.forEach(cp => {
      const sp = soldMap.get(cp.product_id);
      const soldQty = sp ? Number(sp.sold_qty || 0) : 0;
      const salesRev = sp ? Number(sp.sales_revenue || 0) : 0;
      const cost = customCostPrices[cp.product_id] !== undefined
        ? customCostPrices[cp.product_id]
        : (sp && Number(sp.cost_price || 0) > 0 ? Number(sp.cost_price) : Number(cp.cost_price || 0));

      const profit = salesRev - (soldQty * cost);

      treatedIds.add(cp.product_id);

      if (!showSoldOnly || soldQty > 0) {
        combinedRows.push({
          product_id: cp.product_id,
          product_name: cp.product_name,
          sold_qty: soldQty,
          sales_revenue: salesRev,
          cost_price: cost,
          product_profit: profit,
          notes: sp?.notes || cp.notes || ''
        });
      }
    });

    // Add any sold items that weren't in capital products
    soldProducts.forEach(sp => {
      if (!treatedIds.has(sp.product_id)) {
        const cost = customCostPrices[sp.product_id] !== undefined
          ? customCostPrices[sp.product_id]
          : Number(sp.cost_price || 0);
        const profit = Number(sp.sales_revenue || 0) - (Number(sp.sold_qty || 0) * cost);

        if (!showSoldOnly || Number(sp.sold_qty || 0) > 0) {
          combinedRows.push({
            product_id: sp.product_id,
            product_name: sp.product_name,
            sold_qty: Number(sp.sold_qty || 0),
            sales_revenue: Number(sp.sales_revenue || 0),
            cost_price: cost,
            product_profit: profit,
            notes: sp.notes || ''
          });
        }
      }
    });

    const totSoldQty = combinedRows.reduce((a, b) => a + Number(b.sold_qty || 0), 0);
    const totRevenue = combinedRows.reduce((a, b) => a + Number(b.sales_revenue || 0), 0);
    const totProductProfit = combinedRows.reduce((a, b) => a + Number(b.product_profit || 0), 0);

    const expensesTotal = processedExpenses.total;
    const penalties = customPenalties !== null ? customPenalties : apiPenalties;
    const bonuses = customBonuses !== null ? customBonuses : apiBonuses;
    const netCompanyProfit = totProductProfit - expensesTotal + penalties - bonuses;

    return {
      rows: combinedRows,
      totSoldQty,
      totRevenue,
      totProductProfit,
      expensesTotal,
      penalties,
      bonuses,
      netCompanyProfit
    };
  }, [capitalProducts, soldProducts, customCostPrices, showSoldOnly, processedExpenses.total, customPenalties, apiPenalties, customBonuses, apiBonuses]);

  // Number Formatter
  const fmt = (n: number) => {
    return Number(n || 0).toLocaleString('ar-EG', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    });
  };

  // High-fidelity Excel Export matching Company.xlsx 100%
  const exportToExcel = async () => {
    if (!processedCapital.rows.length && !processedExpenses.rows.length && !processedProfitLoss.rows.length) {
      Swal.fire('تنبيه', 'لا توجد بيانات متاحة للتصدير.', 'info');
      return;
    }

    try {
      const wb = new ExcelJS.Workbook();
      wb.creator = 'DragonPro';
      wb.created = new Date();

      const ws = wb.addWorksheet('Sheet1', {
        views: [{ rightToLeft: true }]
      });

      // Match Company.xlsx column widths
      ws.columns = [
        { width: 14.5 }, // A: المنتج
        { width: 11.0 }, // B: في العهدة / عدد البضاعة المباعة
        { width: 12.0 }, // C: في المخزن / إجمالي مبلغ المبيعات
        { width: 11.0 }, // D: الإجمالي / سعر التكلفة
        { width: 14.0 }, // E: سعر التكلفة / أرباح المنتجات
        { width: 14.5 }, // F: إجمالي سعر تكلفة المنتج / قيم الصافي
        { width: 12.0 }, // G: ملاحظات
        { width: 6.0 },  // H: فاصل (Spacer)
        { width: 22.0 }, // I: اسم الصنف (المصروفات)
        { width: 14.0 }, // J: المبلغ
      ];

      // Exact Theme Colors from Company.xlsx
      const C_HEADER_FILL = 'FF44546A'; // Dark Slate Navy (Theme 2)
      const C_HEADER_TEXT = 'FFFFFFFF'; // White bold
      const C_BLUE_ACCENT = 'FFB4C6E7'; // Soft Blue Accent (Theme 4 tint)
      const C_BORDER_CLR  = 'FFB0B0B0';

      const thinBorder: any = {
        top: { style: 'thin', color: { argb: C_BORDER_CLR } },
        left: { style: 'thin', color: { argb: C_BORDER_CLR } },
        bottom: { style: 'thin', color: { argb: C_BORDER_CLR } },
        right: { style: 'thin', color: { argb: C_BORDER_CLR } },
      };

      const centerAlign: any = {
        horizontal: 'center',
        vertical: 'middle',
        wrapText: true
      };

      const styleCell = (cell: any, fillHex: string | null, fontColorHex = 'FF000000', isBold = true, numFormat?: string) => {
        if (fillHex) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fillHex } };
        }
        cell.font = { name: 'Calibri', bold: isBold, color: { argb: fontColorHex }, size: 10 };
        cell.alignment = centerAlign;
        cell.border = thinBorder;
        if (numFormat) cell.numFmt = numFormat;
      };

      // ── ROW 1: Main Section Headers ──
      ws.mergeCells('A1:G1');
      const cellA1 = ws.getCell('A1');
      cellA1.value = 'تفاصيل رأس مال الشركة';
      styleCell(cellA1, C_HEADER_FILL, C_HEADER_TEXT, true);

      ws.mergeCells('I1:J1');
      const cellI1 = ws.getCell('I1');
      cellI1.value = 'المصروفات ';
      styleCell(cellI1, C_HEADER_FILL, C_HEADER_TEXT, true);

      // ── ROW 2: Column Headers ──
      const capHeaders = ['المنتج', 'في العهدة', 'في المخزن', 'الإجمالي', 'سعر التكلفة (لكل قطعة)', 'إجمالي سعر تكلفة المنتج', 'ملاحظات'];
      capHeaders.forEach((h, idx) => {
        const c = ws.getCell(2, idx + 1);
        c.value = h;
        styleCell(c, C_HEADER_FILL, C_HEADER_TEXT, true);
      });

      const expH1 = ws.getCell('I2');
      expH1.value = 'التصنيف';
      styleCell(expH1, C_HEADER_FILL, C_HEADER_TEXT, true);

      const expH2 = ws.getCell('J2');
      expH2.value = 'المبلغ ';
      styleCell(expH2, C_HEADER_FILL, C_HEADER_TEXT, true);

      // ── EXPENSES ROWS (Columns I & J: Grouped by Category) ──
      let expRow = 3;
      processedExpenses.categories.forEach(cat => {
        const ci = ws.getCell(`I${expRow}`);
        ci.value = cat.category_name;
        styleCell(ci, null, 'FF000000', false);

        const cj = ws.getCell(`J${expRow}`);
        cj.value = cat.total_amount;
        styleCell(cj, null, 'FF000000', false, '#,##0.00');
        expRow++;
      });

      // Pad expenses rows if less than 8
      const expEndDataRow = Math.max(expRow - 1, 8);
      for (let r = expRow; r <= expEndDataRow; r++) {
        styleCell(ws.getCell(`I${r}`), null, 'FF000000', false);
        styleCell(ws.getCell(`J${r}`), null, 'FF000000', false);
      }

      // ── CAPITAL PRODUCTS ROWS (Columns A to G) ──
      let capRow = 3;
      processedCapital.rows.forEach(p => {
        ws.getCell(`A${capRow}`).value = p.product_name;
        ws.getCell(`B${capRow}`).value = p.custody_qty;
        ws.getCell(`C${capRow}`).value = p.warehouse_qty;
        ws.getCell(`D${capRow}`).value = { formula: `B${capRow}+C${capRow}` };
        ws.getCell(`E${capRow}`).value = p.effectiveCost;
        ws.getCell(`F${capRow}`).value = { formula: `D${capRow}*E${capRow}` };
        ws.getCell(`G${capRow}`).value = p.notes || '';

        for (let c = 1; c <= 7; c++) {
          const numFmt = (c === 2 || c === 3 || c === 4) ? '#,##0' : (c === 5 || c === 6 ? '#,##0.00' : undefined);
          styleCell(ws.getCell(capRow, c), null, 'FF000000', false, numFmt);
        }
        capRow++;
      });

      const capEndRow = capRow - 1;

      // Capital Total Row (Row capRow)
      const rTotCap = capRow;
      ws.getCell(`A${rTotCap}`).value = 'الإجمالي';
      styleCell(ws.getCell(`A${rTotCap}`), null, 'FF000000', true);

      ws.getCell(`B${rTotCap}`).value = { formula: `SUM(B3:B${capEndRow})` };
      styleCell(ws.getCell(`B${rTotCap}`), null, 'FF000000', true, '#,##0');

      ws.getCell(`C${rTotCap}`).value = { formula: `SUM(C3:C${capEndRow})` };
      styleCell(ws.getCell(`C${rTotCap}`), null, 'FF000000', true, '#,##0');

      ws.getCell(`D${rTotCap}`).value = { formula: `SUM(D3:D${capEndRow})` };
      styleCell(ws.getCell(`D${rTotCap}`), null, 'FF000000', true, '#,##0');

      ws.getCell(`E${rTotCap}`).value = 'إجمالي تكلفة البضاعة';
      styleCell(ws.getCell(`E${rTotCap}`), null, 'FF000000', true);

      ws.getCell(`F${rTotCap}`).value = { formula: `SUM(F3:F${capEndRow})` };
      styleCell(ws.getCell(`F${rTotCap}`), null, 'FF000000', true, '#,##0.00');

      styleCell(ws.getCell(`G${rTotCap}`), null, 'FF000000', true);

      // Warehouse Stock Cost Row
      const rWhCost = rTotCap + 1;
      ws.mergeCells(`A${rWhCost}:D${rWhCost}`);
      ws.getCell(`A${rWhCost}`).value = 'إجمالي تكلفة بضاعة المخزن';
      styleCell(ws.getCell(`A${rWhCost}`), C_HEADER_FILL, C_HEADER_TEXT, true);
      ws.mergeCells(`F${rWhCost}:G${rWhCost}`);
      ws.getCell(`F${rWhCost}`).value = processedCapital.warehouseCost;
      styleCell(ws.getCell(`F${rWhCost}`), null, 'FF000000', true, '#,##0.00');
      styleCell(ws.getCell(`E${rWhCost}`), C_HEADER_FILL, C_HEADER_TEXT, true);

      // Custody Stock Cost Row
      const rCustCost = rWhCost + 1;
      ws.mergeCells(`A${rCustCost}:D${rCustCost}`);
      ws.getCell(`A${rCustCost}`).value = 'إجمالي تكلفة بضاعة العهدة طرف المناديب';
      styleCell(ws.getCell(`A${rCustCost}`), C_HEADER_FILL, C_HEADER_TEXT, true);
      ws.mergeCells(`F${rCustCost}:G${rCustCost}`);
      ws.getCell(`F${rCustCost}`).value = processedCapital.custodyCost;
      styleCell(ws.getCell(`F${rCustCost}`), null, 'FF000000', true, '#,##0.00');
      styleCell(ws.getCell(`E${rCustCost}`), C_HEADER_FILL, C_HEADER_TEXT, true);

      // Cash in Safes Row (+)
      const rSafes = rCustCost + 1;
      ws.mergeCells(`A${rSafes}:D${rSafes}`);
      ws.getCell(`A${rSafes}`).value = 'موجود فعلي في الخزائن (+)';
      styleCell(ws.getCell(`A${rSafes}`), C_HEADER_FILL, C_HEADER_TEXT, true);
      ws.mergeCells(`F${rSafes}:G${rSafes}`);
      ws.getCell(`F${rSafes}`).value = processedCapital.safesBal;
      styleCell(ws.getCell(`F${rSafes}`), null, 'FF000000', true, '#,##0.00');
      styleCell(ws.getCell(`E${rSafes}`), C_HEADER_FILL, C_HEADER_TEXT, true);

      // Reps Debt Row (+)
      const rDebt = rSafes + 1;
      ws.mergeCells(`A${rDebt}:D${rDebt}`);
      ws.getCell(`A${rDebt}`).value = 'مستحق لنا طرف المناديب (مديونية المناديب) (+)';
      styleCell(ws.getCell(`A${rDebt}`), C_HEADER_FILL, C_HEADER_TEXT, true);
      ws.mergeCells(`F${rDebt}:G${rDebt}`);
      ws.getCell(`F${rDebt}`).value = processedCapital.repsDebt;
      styleCell(ws.getCell(`F${rDebt}`), null, 'FF000000', true, '#,##0.00');
      styleCell(ws.getCell(`E${rDebt}`), C_HEADER_FILL, C_HEADER_TEXT, true);

      // Suppliers Balance Row (-)
      const rSup = rDebt + 1;
      ws.mergeCells(`A${rSup}:D${rSup}`);
      ws.getCell(`A${rSup}`).value = 'الباقي للموردين (-)';
      styleCell(ws.getCell(`A${rSup}`), C_HEADER_FILL, C_HEADER_TEXT, true);
      ws.mergeCells(`F${rSup}:G${rSup}`);
      ws.getCell(`F${rSup}`).value = processedCapital.suppliersBal;
      styleCell(ws.getCell(`F${rSup}`), null, 'FF000000', true, '#,##0.00');
      styleCell(ws.getCell(`E${rSup}`), C_HEADER_FILL, C_HEADER_TEXT, true);

      // Reps Insurance Row (-)
      const rIns = rSup + 1;
      ws.mergeCells(`A${rIns}:D${rIns}`);
      ws.getCell(`A${rIns}`).value = 'تأمين وودائع المناديب طرفنا (أمانات للغير) (-)';
      styleCell(ws.getCell(`A${rIns}`), C_HEADER_FILL, C_HEADER_TEXT, true);
      ws.mergeCells(`F${rIns}:G${rIns}`);
      ws.getCell(`F${rIns}`).value = processedCapital.repsInsurance;
      styleCell(ws.getCell(`F${rIns}`), null, 'FF000000', true, '#,##0.00');
      styleCell(ws.getCell(`E${rIns}`), C_HEADER_FILL, C_HEADER_TEXT, true);

      // Net Capital Row (=)
      const rNetCap = rIns + 1;
      ws.mergeCells(`A${rNetCap}:D${rNetCap}`);
      ws.getCell(`A${rNetCap}`).value = 'صافي رأس مال الشركة (=)';
      styleCell(ws.getCell(`A${rNetCap}`), C_BLUE_ACCENT, 'FF000000', true);
      ws.mergeCells(`F${rNetCap}:G${rNetCap}`);
      ws.getCell(`F${rNetCap}`).value = { formula: `F${rTotCap}+F${rSafes}+F${rDebt}-F${rSup}-F${rIns}` };
      styleCell(ws.getCell(`F${rNetCap}`), C_BLUE_ACCENT, 'FF000000', true, '#,##0.00');
      styleCell(ws.getCell(`E${rNetCap}`), C_BLUE_ACCENT, 'FF000000', true);

      // Spacer row between Capital and P&L
      const rPlTitle = rNetCap + 2;

      // ── PROFIT & LOSS SECTION ──
      ws.mergeCells(`A${rPlTitle}:G${rPlTitle}`);
      ws.getCell(`A${rPlTitle}`).value = 'الأرباح والخسائر';
      styleCell(ws.getCell(`A${rPlTitle}`), C_HEADER_FILL, C_HEADER_TEXT, true);

      const rPlHead = rPlTitle + 1;
      const plHeaders = ['المنتج ', 'عدد البضاعة المباعة', 'إجمالي مبلغ المبيعات', 'سعر التكلفة (لكل قطعة)', 'أرباح المنتجات'];
      plHeaders.forEach((h, idx) => {
        const c = ws.getCell(rPlHead, idx + 1);
        c.value = h;
        styleCell(c, C_HEADER_FILL, C_HEADER_TEXT, true);
      });
      ws.mergeCells(`F${rPlHead}:G${rPlHead}`);
      ws.getCell(`F${rPlHead}`).value = 'ملاحظات ';
      styleCell(ws.getCell(`F${rPlHead}`), C_HEADER_FILL, C_HEADER_TEXT, true);

      let plRow = rPlHead + 1;
      const plStartRow = plRow;
      const plDataRows = processedProfitLoss.rows.length ? processedProfitLoss.rows : [{ product_name: 'لا توجد مبيعات', sold_qty: 0, sales_revenue: 0, cost_price: 0, product_profit: 0, notes: '' }];

      plDataRows.forEach(p => {
        ws.getCell(`A${plRow}`).value = p.product_name;
        ws.getCell(`B${plRow}`).value = p.sold_qty;
        ws.getCell(`C${plRow}`).value = p.sales_revenue;
        ws.getCell(`D${plRow}`).value = p.cost_price;
        ws.getCell(`E${plRow}`).value = { formula: `(C${plRow}/B${plRow}-D${plRow})*B${plRow}` };
        ws.mergeCells(`F${plRow}:G${plRow}`);
        ws.getCell(`F${plRow}`).value = p.notes || '';

        styleCell(ws.getCell(`A${plRow}`), null, 'FF000000', false);
        styleCell(ws.getCell(`B${plRow}`), null, 'FF000000', false, '#,##0');
        styleCell(ws.getCell(`C${plRow}`), null, 'FF000000', false, '#,##0.00');
        styleCell(ws.getCell(`D${plRow}`), null, 'FF000000', false, '#,##0.00');
        styleCell(ws.getCell(`E${plRow}`), null, 'FF000000', false, '#,##0.00');
        styleCell(ws.getCell(`F${plRow}`), null, 'FF000000', false);
        styleCell(ws.getCell(`G${plRow}`), null, 'FF000000', false);

        plRow++;
      });

      const plEndRow = plRow - 1;

      // P&L Total Row
      const rPlTot = plRow;
      ws.getCell(`A${rPlTot}`).value = 'الاجمالي ';
      styleCell(ws.getCell(`A${rPlTot}`), null, 'FF000000', true);

      ws.getCell(`B${rPlTot}`).value = { formula: `SUM(B${plStartRow}:B${plEndRow})` };
      styleCell(ws.getCell(`B${rPlTot}`), null, 'FF000000', true, '#,##0');

      ws.getCell(`C${rPlTot}`).value = { formula: `SUM(C${plStartRow}:C${plEndRow})` };
      styleCell(ws.getCell(`C${rPlTot}`), null, 'FF000000', true, '#,##0.00');

      ws.getCell(`D${rPlTot}`).value = 'إجمالي أرباح المنتجات';
      styleCell(ws.getCell(`D${rPlTot}`), null, 'FF000000', true);

      ws.getCell(`E${rPlTot}`).value = { formula: `SUM(E${plStartRow}:E${plEndRow})` };
      styleCell(ws.getCell(`E${rPlTot}`), null, 'FF000000', true, '#,##0.00');

      ws.mergeCells(`F${rPlTot}:G${rPlTot}`);
      styleCell(ws.getCell(`F${rPlTot}`), null, 'FF000000', true);

      // Determine expenses total row index (align with Company.xlsx design)
      const rExpTot = Math.max(rPlTot + 2, expEndDataRow + 1);

      // Pad expenses column up to rExpTot - 1
      for (let r = expEndDataRow + 1; r < rExpTot; r++) {
        styleCell(ws.getCell(`I${r}`), null, 'FF000000', false);
        styleCell(ws.getCell(`J${r}`), null, 'FF000000', false);
      }

      // Expenses Total Row (Col I & J)
      ws.getCell(`I${rExpTot}`).value = 'الاجمالي ';
      styleCell(ws.getCell(`I${rExpTot}`), C_BLUE_ACCENT, 'FF000000', true);

      ws.getCell(`J${rExpTot}`).value = { formula: `SUM(J3:J${rExpTot - 1})` };
      styleCell(ws.getCell(`J${rExpTot}`), C_BLUE_ACCENT, 'FF000000', true, '#,##0.00');

      // P&L Row 32 (Expenses without raw materials and fabrics)
      const rPlExp = rPlTot + 1;
      ws.mergeCells(`A${rPlExp}:E${rPlExp}`);
      ws.getCell(`A${rPlExp}`).value = 'إجمالي المصروفات بدون الخامات والأقمشة ';
      styleCell(ws.getCell(`A${rPlExp}`), C_HEADER_FILL, C_HEADER_TEXT, true);
      ws.mergeCells(`F${rPlExp}:G${rPlExp}`);
      ws.getCell(`F${rPlExp}`).value = { formula: `J${rExpTot}` };
      styleCell(ws.getCell(`F${rPlExp}`), null, 'FF000000', true, '#,##0.00');

      // P&L Row: Penalties (تضاف على الأرباح)
      const rPlPen = rPlExp + 1;
      ws.mergeCells(`A${rPlPen}:E${rPlPen}`);
      ws.getCell(`A${rPlPen}`).value = 'إجمالي الغرامات والجزاءات (تضاف على الأرباح) (+)';
      styleCell(ws.getCell(`A${rPlPen}`), 'FFE2EFDA', 'FF375623', true);
      ws.mergeCells(`F${rPlPen}:G${rPlPen}`);
      ws.getCell(`F${rPlPen}`).value = processedProfitLoss.penalties;
      styleCell(ws.getCell(`F${rPlPen}`), null, 'FF276A3C', true, '#,##0.00');

      // P&L Row: Bonuses (تتخصم من الأرباح)
      const rPlBon = rPlPen + 1;
      ws.mergeCells(`A${rPlBon}:E${rPlBon}`);
      ws.getCell(`A${rPlBon}`).value = 'إجمالي الحوافز والمكافآت (تتخصم من الأرباح) (-)';
      styleCell(ws.getCell(`A${rPlBon}`), 'FFFCE4D6', 'FFC65911', true);
      ws.mergeCells(`F${rPlBon}:G${rPlBon}`);
      ws.getCell(`F${rPlBon}`).value = processedProfitLoss.bonuses;
      styleCell(ws.getCell(`F${rPlBon}`), null, 'FFC00000', true, '#,##0.00');

      // P&L Row: Net Company Profit
      const rNetProf = rPlBon + 1;
      ws.mergeCells(`A${rNetProf}:D${rNetProf}`);
      ws.getCell(`A${rNetProf}`).value = 'صافي اربح الشركة ';
      styleCell(ws.getCell(`A${rNetProf}`), C_BLUE_ACCENT, 'FF000000', true);
      styleCell(ws.getCell(`E${rNetProf}`), C_BLUE_ACCENT, 'FF000000', true);
      ws.mergeCells(`F${rNetProf}:G${rNetProf}`);
      ws.getCell(`F${rNetProf}`).value = { formula: `E${rPlTot}-F${rPlExp}+F${rPlPen}-F${rPlBon}` };
      styleCell(ws.getCell(`F${rNetProf}`), C_BLUE_ACCENT, 'FF000000', true, '#,##0.00');

      // Spacer column H
      const maxOverallRow = Math.max(rNetProf, rExpTot);
      ws.mergeCells(`H1:H${maxOverallRow}`);

      // Write & download
      const buffer = await wb.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `تقرير_الأرباح_والخسائر_الجديد_${startDate}_إلى_${endDate}.xlsx`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      Swal.fire({
        icon: 'success',
        title: 'تم التصدير بنجاح',
        text: 'تم إنشاء وتنزيل ملف Excel مطابق تماماً لنموذج الشركة.',
        timer: 2000,
        showConfirmButton: false
      });
    } catch (err: any) {
      console.error(err);
      Swal.fire('خطأ', 'فشل في تصدير ملف Excel: ' + (err.message || ''), 'error');
    }
  };

  // Print Report Handler
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-12 font-sans" dir="rtl">
      {/* ── Top Header & Actions ── */}
      <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 shadow-sm border border-slate-100 dark:border-slate-700/60 transition-all">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-700/60 pb-5">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-gradient-to-tr from-violet-600 to-indigo-500 text-white rounded-2xl shadow-lg shadow-indigo-500/20">
              <Coins size={26} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-black text-slate-800 dark:text-white">تقرير الأرباح و الخسائر الجديد</h1>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800">
                  نموذج الشركة المعتمد
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                تحليل شامل لرأس مال الشركة المخزني، الأرباح المحققة، والمصروفات التشغيلية بدون الخامات
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setIsManualOverride(!isManualOverride)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                isManualOverride
                  ? 'bg-amber-500 text-white shadow-md shadow-amber-500/20'
                  : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-200'
              }`}
              title="تعديل قيم الموردين أو المناديب أو التكلفة يدوياً"
            >
              <Sliders size={15} />
              <span>{isManualOverride ? 'إخفاء التعديل اليدوي' : 'تعديل المدخلات'}</span>
            </button>

            {isManualOverride && (
              <button
                onClick={resetOverrides}
                className="px-3 py-2 bg-slate-100 dark:bg-slate-700 hover:bg-rose-50 text-slate-600 hover:text-rose-600 dark:text-slate-300 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
                title="إعادة ضبط القيم التلقائية"
              >
                <RotateCcw size={14} />
                <span>إعادة ضبط</span>
              </button>
            )}

            <button
              onClick={fetchData}
              disabled={loading}
              className="p-2.5 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-200 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-600 transition-all active:scale-95 disabled:opacity-50"
              title="تحديث البيانات"
            >
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            </button>

            <button
              onClick={exportToExcel}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-emerald-600/20 flex items-center gap-2 active:scale-95"
            >
              <FileSpreadsheet size={15} />
              <span>تصدير Excel متطابق</span>
            </button>

            <button
              onClick={handlePrint}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-900 dark:bg-slate-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-2 active:scale-95"
            >
              <Printer size={15} />
              <span>طباعة</span>
            </button>
          </div>
        </div>

        {/* ── Filters Bar ── */}
        <div className="pt-4 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* Quick Presets */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs font-bold text-slate-400 ml-1">فترة سريعة:</span>
              {[
                { label: 'اليوم', key: 'today' },
                { label: 'هذا الأسبوع', key: 'this_week' },
                { label: 'هذا الشهر', key: 'this_month' },
                { label: 'الشهر السابق', key: 'last_month' },
                { label: 'هذا العام', key: 'this_year' },
                { label: 'كل الفترات', key: 'all' }
              ].map(p => (
                <button
                  key={p.key}
                  onClick={() => handleDatePreset(p.key)}
                  className="px-3 py-1 bg-slate-50 hover:bg-slate-100 dark:bg-slate-700/50 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg text-xs font-semibold border border-slate-200 dark:border-slate-600 transition-all"
                >
                  {p.label}
                </button>
              ))}
            </div>

            {/* Date Range Inputs */}
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-900/50 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700">
                <Calendar size={14} className="text-slate-400" />
                <span className="text-xs text-slate-400">من:</span>
                <input
                  type="date"
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                  className="bg-transparent text-xs font-bold text-slate-700 dark:text-slate-200 focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-900/50 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700">
                <Calendar size={14} className="text-slate-400" />
                <span className="text-xs text-slate-400">إلى:</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={e => setEndDate(e.target.value)}
                  className="bg-transparent text-xs font-bold text-slate-700 dark:text-slate-200 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Manual Overrides Notice Bar */}
          {isManualOverride && (
            <div className="p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-2xl flex flex-wrap items-center gap-4 text-xs animate-fadeIn">
              <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300 font-bold">
                <Sliders size={16} />
                <span>لوحة التحكم بالمدخلات اليدوية:</span>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-slate-600 dark:text-slate-400">موجود فعلي في الخزائن (+):</label>
                <input
                  type="number"
                  placeholder={String(apiCashInSafes)}
                  value={customCashInSafes !== null ? customCashInSafes : ''}
                  onChange={e => setCustomCashInSafes(e.target.value === '' ? null : Number(e.target.value))}
                  className="w-28 px-2 py-1 bg-white dark:bg-slate-800 border border-amber-300 dark:border-amber-700 rounded-lg text-xs font-bold"
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-slate-600 dark:text-slate-400">مستحق لنا طرف المناديب (+):</label>
                <input
                  type="number"
                  placeholder={String(apiRepsDebtTotal)}
                  value={customRepsDebtTotal !== null ? customRepsDebtTotal : ''}
                  onChange={e => setCustomRepsDebtTotal(e.target.value === '' ? null : Number(e.target.value))}
                  className="w-28 px-2 py-1 bg-white dark:bg-slate-800 border border-amber-300 dark:border-amber-700 rounded-lg text-xs font-bold"
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-slate-600 dark:text-slate-400">تأمين المناديب طرفنا (-):</label>
                <input
                  type="number"
                  placeholder={String(apiRepsInsurance)}
                  value={customRepsInsurance !== null ? customRepsInsurance : ''}
                  onChange={e => setCustomRepsInsurance(e.target.value === '' ? null : Number(e.target.value))}
                  className="w-28 px-2 py-1 bg-white dark:bg-slate-800 border border-amber-300 dark:border-amber-700 rounded-lg text-xs font-bold"
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-slate-600 dark:text-slate-400">الباقي للموردين (-):</label>
                <input
                  type="number"
                  placeholder={String(apiSuppliersBalance)}
                  value={customSuppliersBalance !== null ? customSuppliersBalance : ''}
                  onChange={e => setCustomSuppliersBalance(e.target.value === '' ? null : Number(e.target.value))}
                  className="w-28 px-2 py-1 bg-white dark:bg-slate-800 border border-amber-300 dark:border-amber-700 rounded-lg text-xs font-bold"
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-slate-600 dark:text-slate-400">إجمالي الغرامات (+ للأرباح):</label>
                <input
                  type="number"
                  placeholder={String(apiPenalties)}
                  value={customPenalties !== null ? customPenalties : ''}
                  onChange={e => setCustomPenalties(e.target.value === '' ? null : Number(e.target.value))}
                  className="w-28 px-2 py-1 bg-white dark:bg-slate-800 border border-emerald-400 dark:border-emerald-700 rounded-lg text-xs font-bold text-emerald-600 dark:text-emerald-400"
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-slate-600 dark:text-slate-400">إجمالي الحوافز (- من الأرباح):</label>
                <input
                  type="number"
                  placeholder={String(apiBonuses)}
                  value={customBonuses !== null ? customBonuses : ''}
                  onChange={e => setCustomBonuses(e.target.value === '' ? null : Number(e.target.value))}
                  className="w-28 px-2 py-1 bg-white dark:bg-slate-800 border border-rose-400 dark:border-rose-700 rounded-lg text-xs font-bold text-rose-600 dark:text-rose-400"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── KPI Summary Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Net Company Capital */}
        <div className="relative overflow-hidden rounded-3xl p-5 text-white shadow-lg bg-gradient-to-br from-slate-700 via-slate-800 to-slate-900 border border-slate-700">
          <div className="flex items-center justify-between">
            <div className="bg-white/10 p-2.5 rounded-xl">
              <Building size={20} className="text-white" />
            </div>
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-white/10">رأس المال الفعلي</span>
          </div>
          <div className="mt-4">
            <div className="text-white/70 text-xs font-semibold">صافي رأس مال الشركة</div>
            <div className="text-2xl font-black mt-1 tracking-tight">
              {fmt(processedCapital.netCapital)} <span className="text-xs font-normal text-white/80">{currencySymbol}</span>
            </div>
          </div>
        </div>

        {/* Card 2: Total Product Gross Profit */}
        <div className="relative overflow-hidden rounded-3xl p-5 text-white shadow-lg bg-gradient-to-br from-emerald-600 via-emerald-700 to-teal-800 border border-emerald-600">
          <div className="flex items-center justify-between">
            <div className="bg-white/10 p-2.5 rounded-xl">
              <TrendingUp size={20} className="text-white" />
            </div>
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-white/10">مبيعات الفترة</span>
          </div>
          <div className="mt-4">
            <div className="text-white/70 text-xs font-semibold">إجمالي أرباح المنتجات</div>
            <div className="text-2xl font-black mt-1 tracking-tight">
              {fmt(processedProfitLoss.totProductProfit)} <span className="text-xs font-normal text-white/80">{currencySymbol}</span>
            </div>
          </div>
        </div>

        {/* Card 3: Operational Expenses without fabrics */}
        <div className="relative overflow-hidden rounded-3xl p-5 text-white shadow-lg bg-gradient-to-br from-rose-600 via-rose-700 to-pink-800 border border-rose-600">
          <div className="flex items-center justify-between">
            <div className="bg-white/10 p-2.5 rounded-xl">
              <Receipt size={20} className="text-white" />
            </div>
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-white/10">بدون خامات وأقمشة</span>
          </div>
          <div className="mt-4">
            <div className="text-white/70 text-xs font-semibold">المصروفات التشغيلية</div>
            <div className="text-2xl font-black mt-1 tracking-tight">
              {fmt(processedExpenses.total)} <span className="text-xs font-normal text-white/80">{currencySymbol}</span>
            </div>
          </div>
        </div>

        {/* Card 4: Net Company Profit */}
        <div className={`relative overflow-hidden rounded-3xl p-5 text-white shadow-lg border ${
          processedProfitLoss.netCompanyProfit >= 0
            ? 'bg-gradient-to-br from-blue-600 via-indigo-700 to-violet-800 border-indigo-600'
            : 'bg-gradient-to-br from-amber-600 via-orange-700 to-red-800 border-orange-600'
        }`}>
          <div className="flex items-center justify-between">
            <div className="bg-white/10 p-2.5 rounded-xl">
              <DollarSign size={20} className="text-white" />
            </div>
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-white/10">الربح الصافي</span>
          </div>
          <div className="mt-4">
            <div className="text-white/70 text-xs font-semibold">صافي أرباح الشركة</div>
            <div className="text-2xl font-black mt-1 tracking-tight">
              {fmt(processedProfitLoss.netCompanyProfit)} <span className="text-xs font-normal text-white/80">{currencySymbol}</span>
            </div>
            {(processedProfitLoss.penalties > 0 || processedProfitLoss.bonuses > 0) && (
              <div className="text-[10px] text-white/80 mt-1 flex items-center gap-2">
                <span>غرامات: +{fmt(processedProfitLoss.penalties)}</span>
                <span>•</span>
                <span>حوافز: -{fmt(processedProfitLoss.bonuses)}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Main Executive Grid (Matching Company.xlsx) ── */}
      <div ref={printAreaRef} className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* ── Left Column: Capital Table (Top) & Profit/Loss Table (Bottom) ── */}
        <div className="lg:col-span-8 space-y-6">
          {/* Table 1: تفاصيل رأس مال الشركة */}
          <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
            {/* Header Title with toggle */}
            <div className="bg-[#44546a] text-white px-6 py-3.5 flex items-center justify-between shadow-sm">
              <div className="flex items-center gap-2 font-black text-sm tracking-wide">
                <Building size={18} />
                <span>تفاصيل رأس مال الشركة</span>
              </div>
              <button
                type="button"
                onClick={() => setShowVariantDetails(!showVariantDetails)}
                className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-all flex items-center gap-1.5"
                title="عرض أو إخفاء تفاصيل المقاس واللون لكل منتج"
              >
                <Layers size={13} />
                <span>{showVariantDetails ? 'إخفاء تفاصيل المقاس واللون' : 'تفاصيل المقاس واللون'}</span>
              </button>
            </div>

            {/* Table Content */}
            <div className="overflow-x-auto">
              <table className="w-full text-center border-collapse text-xs">
                <thead>
                  <tr className="bg-[#596b82] text-white font-bold border-b border-slate-600">
                    <th className="py-2.5 px-3 border-l border-slate-600 text-right">المنتج</th>
                    <th className="py-2.5 px-3 border-l border-slate-600">في العهدة</th>
                    <th className="py-2.5 px-3 border-l border-slate-600">في المخزن</th>
                    <th className="py-2.5 px-3 border-l border-slate-600">الإجمالي</th>
                    <th className="py-2.5 px-3 border-l border-slate-600">سعر التكلفة (لكل قطعة)</th>
                    <th className="py-2.5 px-3 border-l border-slate-600">إجمالي سعر تكلفة المنتج</th>
                    <th className="py-2.5 px-3">ملاحظات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700 text-slate-800 dark:text-slate-200">
                  {processedCapital.rows.map((p, idx) => (
                    <React.Fragment key={p.product_id}>
                      <tr className={`hover:bg-slate-50 dark:hover:bg-slate-700/40 transition-colors ${idx % 2 === 1 ? 'bg-slate-50/50 dark:bg-slate-900/20' : ''}`}>
                        <td className="py-2.5 px-3 text-right font-bold border-l border-slate-200 dark:border-slate-700">{p.product_name}</td>
                        <td className="py-2.5 px-3 border-l border-slate-200 dark:border-slate-700 font-semibold">{fmt(p.custody_qty)}</td>
                        <td className="py-2.5 px-3 border-l border-slate-200 dark:border-slate-700 font-semibold">{fmt(p.warehouse_qty)}</td>
                        <td className="py-2.5 px-3 border-l border-slate-200 dark:border-slate-700 font-black text-indigo-600 dark:text-indigo-400">{fmt(p.totalUnits)}</td>
                        <td className="py-2.5 px-3 border-l border-slate-200 dark:border-slate-700">
                          {isManualOverride ? (
                            <input
                              type="number"
                              value={p.effectiveCost}
                              onChange={e => setCustomCostPrices(prev => ({ ...prev, [p.product_id]: Number(e.target.value) }))}
                              className="w-20 px-1 py-0.5 text-center font-bold bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700 rounded"
                            />
                          ) : (
                            <span className="font-semibold">{fmt(p.effectiveCost)}</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 border-l border-slate-200 dark:border-slate-700 font-black">{fmt(p.totalItemCost)}</td>
                        <td className="py-2.5 px-3 text-slate-400 text-[11px]">{p.notes || '-'}</td>
                      </tr>

                      {/* Variant Sub-rows when detailed view is enabled */}
                      {showVariantDetails && p.variants && p.variants.length > 0 && p.variants.map((v) => (
                        <tr key={`v-${p.product_id}-${v.variant_id}`} className="bg-indigo-50/40 dark:bg-indigo-950/20 text-[11px] text-slate-600 dark:text-slate-300 border-t border-dashed border-indigo-200/50 dark:border-indigo-800/40">
                          <td className="py-1.5 px-3 text-right pr-6 border-l border-slate-200 dark:border-slate-700">
                            <span className="text-indigo-400 ml-1">↳</span>
                            <span className="font-semibold text-indigo-700 dark:text-indigo-300">
                              {v.color || 'لون افتراضي'} / {v.size || 'مقاس افتراضي'}
                            </span>
                          </td>
                          <td className="py-1.5 px-3 border-l border-slate-200 dark:border-slate-700 font-mono">{fmt(v.custody_qty)}</td>
                          <td className="py-1.5 px-3 border-l border-slate-200 dark:border-slate-700 font-mono">{fmt(v.warehouse_qty)}</td>
                          <td className="py-1.5 px-3 border-l border-slate-200 dark:border-slate-700 font-mono font-bold text-indigo-600 dark:text-indigo-400">{fmt(v.total_qty)}</td>
                          <td className="py-1.5 px-3 border-l border-slate-200 dark:border-slate-700 font-mono text-emerald-700 dark:text-emerald-400">{fmt(v.cost_price)}</td>
                          <td className="py-1.5 px-3 border-l border-slate-200 dark:border-slate-700 font-mono font-bold">{fmt(v.total_cost)}</td>
                          <td className="py-1.5 px-3 text-slate-400 text-[10px]">متغير للمنتج</td>
                        </tr>
                      ))}
                    </React.Fragment>
                  ))}

                  {/* Summary Row: الإجمالي */}
                  <tr className="bg-slate-100 dark:bg-slate-700/80 font-black border-t-2 border-slate-300 dark:border-slate-600 text-slate-900 dark:text-white">
                    <td className="py-3 px-3 text-right border-l border-slate-300 dark:border-slate-600">الإجمالي</td>
                    <td className="py-3 px-3 border-l border-slate-300 dark:border-slate-600 font-mono">{fmt(processedCapital.totCustody)}</td>
                    <td className="py-3 px-3 border-l border-slate-300 dark:border-slate-600 font-mono">{fmt(processedCapital.totWarehouse)}</td>
                    <td className="py-3 px-3 border-l border-slate-300 dark:border-slate-600 font-mono">{fmt(processedCapital.totQty)}</td>
                    <td className="py-3 px-3 border-l border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300">إجمالي تكلفة البضاعة</td>
                    <td className="py-3 px-3 border-l border-slate-300 dark:border-slate-600 text-emerald-700 dark:text-emerald-400 font-mono font-black">{fmt(processedCapital.totalGoodsCost)}</td>
                    <td className="py-3 px-3"></td>
                  </tr>

                  {/* Row: إجمالي تكلفة بضاعة المخزن */}
                  <tr className="bg-[#44546a]/10 dark:bg-slate-800 font-bold border-t border-slate-200 dark:border-slate-700">
                    <td colSpan={4} className="py-2.5 px-4 text-right bg-[#44546a] text-white">إجمالي تكلفة بضاعة المخزن</td>
                    <td className="bg-[#44546a]"></td>
                    <td colSpan={2} className="py-2.5 px-3 text-center font-black text-indigo-600 dark:text-indigo-400 border-r border-slate-200 dark:border-slate-700 font-mono">
                      {fmt(processedCapital.warehouseCost)} {currencySymbol}
                    </td>
                  </tr>

                  {/* Row: إجمالي تكلفة بضاعة العهدة طرف المناديب */}
                  <tr className="bg-[#44546a]/10 dark:bg-slate-800 font-bold border-t border-slate-200 dark:border-slate-700">
                    <td colSpan={4} className="py-2.5 px-4 text-right bg-[#44546a] text-white">إجمالي تكلفة بضاعة العهدة طرف المناديب</td>
                    <td className="bg-[#44546a]"></td>
                    <td colSpan={2} className="py-2.5 px-3 text-center font-black text-amber-600 dark:text-amber-400 border-r border-slate-200 dark:border-slate-700 font-mono">
                      {fmt(processedCapital.custodyCost)} {currencySymbol}
                    </td>
                  </tr>

                  {/* Row: موجود فعلي في الخزائن (+) */}
                  <tr className="bg-[#44546a]/10 dark:bg-slate-800 font-bold border-t border-slate-200 dark:border-slate-700">
                    <td colSpan={4} className="py-2.5 px-4 text-right bg-[#44546a] text-white">موجود فعلي في الخزائن (+)</td>
                    <td className="bg-[#44546a]"></td>
                    <td colSpan={2} className="py-2.5 px-3 text-center font-black text-emerald-600 dark:text-emerald-400 border-r border-slate-200 dark:border-slate-700 font-mono">
                      {fmt(processedCapital.safesBal)} {currencySymbol}
                    </td>
                  </tr>

                  {/* Row: مستحق لنا طرف المناديب (+) */}
                  <tr className="bg-[#44546a]/10 dark:bg-slate-800 font-bold border-t border-slate-200 dark:border-slate-700">
                    <td colSpan={4} className="py-2.5 px-4 text-right bg-[#44546a] text-white">مستحق لنا طرف المناديب (مديونية المناديب) (+)</td>
                    <td className="bg-[#44546a]"></td>
                    <td colSpan={2} className="py-2.5 px-3 text-center font-black text-blue-600 dark:text-blue-400 border-r border-slate-200 dark:border-slate-700 font-mono">
                      {fmt(processedCapital.repsDebt)} {currencySymbol}
                    </td>
                  </tr>

                  {/* Row: الباقي للموردين (-) */}
                  <tr className="bg-[#44546a]/10 dark:bg-slate-800 font-bold border-t border-slate-200 dark:border-slate-700">
                    <td colSpan={4} className="py-2.5 px-4 text-right bg-[#44546a] text-white">الباقي للموردين (-)</td>
                    <td className="bg-[#44546a]"></td>
                    <td colSpan={2} className="py-2.5 px-3 text-center font-black text-rose-600 dark:text-rose-400 border-r border-slate-200 dark:border-slate-700 font-mono">
                      {fmt(processedCapital.suppliersBal)} {currencySymbol}
                    </td>
                  </tr>

                  {/* Row: تأمين وودائع المناديب طرفنا (-) */}
                  <tr className="bg-[#44546a]/10 dark:bg-slate-800 font-bold border-t border-slate-200 dark:border-slate-700">
                    <td colSpan={4} className="py-2.5 px-4 text-right bg-[#44546a] text-white">تأمين وودائع المناديب طرفنا (أمانات للغير) (-)</td>
                    <td className="bg-[#44546a]"></td>
                    <td colSpan={2} className="py-2.5 px-3 text-center font-black text-orange-600 dark:text-orange-400 border-r border-slate-200 dark:border-slate-700 font-mono">
                      {fmt(processedCapital.repsInsurance)} {currencySymbol}
                    </td>
                  </tr>

                  {/* Highlighted Row: صافي رأس مال الشركة (=) */}
                  <tr className="bg-[#b4c6e7] dark:bg-blue-900/60 font-black border-t-2 border-indigo-400 text-slate-950 dark:text-white">
                    <td colSpan={4} className="py-3 px-4 text-right text-sm">صافي رأس مال الشركة (=)</td>
                    <td className="bg-[#b4c6e7] dark:bg-blue-900/60"></td>
                    <td colSpan={2} className="py-3 px-3 text-center text-base tracking-tight text-indigo-950 dark:text-indigo-200 font-mono">
                      {fmt(processedCapital.netCapital)} {currencySymbol}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Table 3: الأرباح والخسائر */}
          <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
            {/* Header Title with toggle */}
            <div className="bg-[#44546a] text-white px-6 py-3.5 flex items-center justify-between shadow-sm">
              <div className="flex items-center gap-2 font-black text-sm tracking-wide">
                <TrendingUp size={18} />
                <span>الأرباح والخسائر</span>
              </div>
              <button
                onClick={() => setShowSoldOnly(!showSoldOnly)}
                className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-all"
              >
                {showSoldOnly ? 'عرض كافة المنتجات' : 'المنتجات المباعة فقط'}
              </button>
            </div>

            {/* Table Content */}
            <div className="overflow-x-auto">
              <table className="w-full text-center border-collapse text-xs">
                <thead>
                  <tr className="bg-[#596b82] text-white font-bold border-b border-slate-600">
                    <th className="py-2.5 px-3 border-l border-slate-600 text-right">المنتج</th>
                    <th className="py-2.5 px-3 border-l border-slate-600">عدد البضاعة المباعة</th>
                    <th className="py-2.5 px-3 border-l border-slate-600">إجمالي مبلغ المبيعات</th>
                    <th className="py-2.5 px-3 border-l border-slate-600">سعر التكلفة (لكل قطعة)</th>
                    <th className="py-2.5 px-3 border-l border-slate-600">أرباح المنتجات</th>
                    <th colSpan={2} className="py-2.5 px-3">ملاحظات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700 text-slate-800 dark:text-slate-200">
                  {processedProfitLoss.rows.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-6 text-center text-slate-400">
                        لا توجد مبيعات مسجلة في هذه الفترة المحددة
                      </td>
                    </tr>
                  ) : (
                    processedProfitLoss.rows.map((p, idx) => (
                      <tr key={p.product_id} className={`hover:bg-slate-50 dark:hover:bg-slate-700/40 transition-colors ${idx % 2 === 1 ? 'bg-slate-50/50 dark:bg-slate-900/20' : ''}`}>
                        <td className="py-2.5 px-3 text-right font-bold border-l border-slate-200 dark:border-slate-700">{p.product_name}</td>
                        <td className="py-2.5 px-3 border-l border-slate-200 dark:border-slate-700 font-semibold">{fmt(p.sold_qty)}</td>
                        <td className="py-2.5 px-3 border-l border-slate-200 dark:border-slate-700 font-semibold">{fmt(p.sales_revenue)}</td>
                        <td className="py-2.5 px-3 border-l border-slate-200 dark:border-slate-700 font-semibold">{fmt(p.cost_price)}</td>
                        <td className={`py-2.5 px-3 border-l border-slate-200 dark:border-slate-700 font-black ${p.product_profit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                          {fmt(p.product_profit)}
                        </td>
                        <td colSpan={2} className="py-2.5 px-3 text-slate-400 text-[11px]">{p.notes || '-'}</td>
                      </tr>
                    ))
                  )}

                  {/* Summary Row: الإجمالي */}
                  <tr className="bg-slate-100 dark:bg-slate-700/80 font-black border-t-2 border-slate-300 dark:border-slate-600 text-slate-900 dark:text-white">
                    <td className="py-3 px-3 text-right border-l border-slate-300 dark:border-slate-600">الاجمالي</td>
                    <td className="py-3 px-3 border-l border-slate-300 dark:border-slate-600">{fmt(processedProfitLoss.totSoldQty)}</td>
                    <td className="py-3 px-3 border-l border-slate-300 dark:border-slate-600">{fmt(processedProfitLoss.totRevenue)}</td>
                    <td className="py-3 px-3 border-l border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300">إجمالي أرباح المنتجات</td>
                    <td className="py-3 px-3 border-l border-slate-300 dark:border-slate-600 text-emerald-700 dark:text-emerald-400">{fmt(processedProfitLoss.totProductProfit)}</td>
                    <td colSpan={2} className="py-3 px-3"></td>
                  </tr>

                  {/* Row: إجمالي المصروفات بدون الخامات والأقمشة */}
                  <tr className="bg-[#44546a]/10 dark:bg-slate-800 font-bold border-t border-slate-200 dark:border-slate-700">
                    <td colSpan={5} className="py-3 px-4 text-right bg-[#44546a] text-white">
                      إجمالي المصروفات بدون الخامات والأقمشة (من جدول المصروفات)
                    </td>
                    <td colSpan={2} className="py-3 px-3 text-center font-black text-rose-600 dark:text-rose-400 text-sm">
                      {fmt(processedExpenses.total)} {currencySymbol}
                    </td>
                  </tr>

                  {/* Row: إجمالي الغرامات (تضاف على الأرباح) */}
                  <tr className="bg-emerald-50/70 dark:bg-emerald-950/30 font-bold border-t border-slate-200 dark:border-slate-700">
                    <td colSpan={5} className="py-2.5 px-4 text-right text-emerald-800 dark:text-emerald-300">
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block"></span>
                          <span>إجمالي الغرامات والجزاءات (تضاف على الأرباح)</span>
                        </span>
                        <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/60 px-2 py-0.5 rounded-full">(+) زيادة في الأرباح</span>
                      </div>
                    </td>
                    <td colSpan={2} className="py-2.5 px-3 text-center font-black text-emerald-600 dark:text-emerald-400 text-sm">
                      + {fmt(processedProfitLoss.penalties)} {currencySymbol}
                    </td>
                  </tr>

                  {/* Row: إجمالي الحوافز (تتخصم من الأرباح) */}
                  <tr className="bg-rose-50/70 dark:bg-rose-950/30 font-bold border-t border-slate-200 dark:border-slate-700">
                    <td colSpan={5} className="py-2.5 px-4 text-right text-rose-800 dark:text-rose-300">
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block"></span>
                          <span>إجمالي الحوافز والمكافآت (تتخصم من الأرباح)</span>
                        </span>
                        <span className="text-[11px] font-bold text-rose-600 dark:text-rose-400 bg-rose-100 dark:bg-rose-900/60 px-2 py-0.5 rounded-full">(-) خصم من الأرباح</span>
                      </div>
                    </td>
                    <td colSpan={2} className="py-2.5 px-3 text-center font-black text-rose-600 dark:text-rose-400 text-sm">
                      - {fmt(processedProfitLoss.bonuses)} {currencySymbol}
                    </td>
                  </tr>

                  {/* Highlighted Row: صافي أرباح الشركة */}
                  <tr className="bg-[#b4c6e7] dark:bg-blue-900/60 font-black border-t-2 border-indigo-400 text-slate-950 dark:text-white">
                    <td colSpan={4} className="py-3.5 px-4 text-right text-sm">صافي اربح الشركة</td>
                    <td className="bg-[#b4c6e7] dark:bg-blue-900/60 text-center text-xs font-semibold text-slate-700 dark:text-slate-300">
                      (أرباح المنتجات - المصروفات + الغرامات - الحوافز)
                    </td>
                    <td colSpan={2} className={`py-3.5 px-3 text-center text-base tracking-tight ${
                      processedProfitLoss.netCompanyProfit >= 0 ? 'text-emerald-950 dark:text-emerald-200' : 'text-rose-950 dark:text-rose-200'
                    }`}>
                      {fmt(processedProfitLoss.netCompanyProfit)} {currencySymbol}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* ── Right Column: Expenses Table (Table 2) ── */}
        <div className="lg:col-span-4">
          <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden sticky top-6">
            {/* Table Header */}
            <div className="bg-[#44546a] text-white px-5 py-3.5 text-center font-black text-sm tracking-wide shadow-sm flex items-center justify-center gap-2">
              <Receipt size={18} />
              <span>المصروفات</span>
            </div>

            {/* Sub-notice banner */}
            <div className="bg-amber-50 dark:bg-amber-950/30 px-3 py-2 border-b border-amber-200/80 dark:border-amber-800/60 text-[11px] text-amber-800 dark:text-amber-300 font-semibold flex items-center gap-1.5">
              <ShieldCheck size={14} className="text-amber-600 shrink-0" />
              <span>تم استبعاد مصروفات الخامات والأقمشة تلقائياً</span>
            </div>

            {/* Table Content */}
            <div className="overflow-x-auto max-h-[700px] overflow-y-auto">
              <table className="w-full text-center border-collapse text-xs">
                <thead>
                  <tr className="bg-[#596b82] text-white font-bold border-b border-slate-600 sticky top-0">
                    <th className="py-2.5 px-3 border-l border-slate-600 text-right">التصنيف</th>
                    <th className="py-2.5 px-3 w-32">المبلغ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700 text-slate-800 dark:text-slate-200">
                  {processedExpenses.categories.length === 0 ? (
                    <tr>
                      <td colSpan={2} className="py-8 text-center text-slate-400">
                        لا توجد مصروفات تشغيلية مسجلة لهذه الفترة
                      </td>
                    </tr>
                  ) : (
                    processedExpenses.categories.map((cat, idx) => (
                      <tr key={cat.category_name || idx} className={`hover:bg-slate-50 dark:hover:bg-slate-700/40 transition-colors ${idx % 2 === 1 ? 'bg-slate-50/50 dark:bg-slate-900/20' : ''}`}>
                        <td className="py-2.5 px-3 text-right font-medium border-l border-slate-200 dark:border-slate-700">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-slate-800 dark:text-slate-100">{cat.category_name}</span>
                            {cat.count > 1 && (
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-500 font-semibold">
                                {cat.count} حركات
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-2.5 px-3 font-bold text-rose-600 dark:text-rose-400 font-mono text-xs">
                          {fmt(cat.total_amount)}
                        </td>
                      </tr>
                    ))
                  )}

                  {/* Expenses Total Row (Matching Row 33 Col I & J) */}
                  <tr className="bg-[#b4c6e7] dark:bg-blue-900/60 font-black border-t-2 border-indigo-400 text-slate-950 dark:text-white sticky bottom-0">
                    <td className="py-3 px-3 text-right text-xs">الاجمالي</td>
                    <td className="py-3 px-3 text-sm font-black text-slate-900 dark:text-white">{fmt(processedExpenses.total)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NewProfitLossReport;
