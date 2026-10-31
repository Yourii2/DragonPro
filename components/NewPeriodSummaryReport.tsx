import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Calendar,
  Download,
  Printer,
  RefreshCw,
  Users,
  CheckCircle,
  TrendingUp,
  Coins,
  Package,
  Clock,
  ArrowRight,
  FileSpreadsheet,
  Layers,
  Table,
  FileText,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  ChevronLeft
} from 'lucide-react';
import * as ExcelJS from 'exceljs';
import Swal from 'sweetalert2';
import { API_BASE_PATH } from '../services/apiConfig';
import { formatLocalDate, getDaysAgo } from '../services/dateUtils';

interface RepSummaryRow {
  seq: number;
  rep_id: number;
  rep_name: string;
  journal_id?: number;
  daily_code?: string;
  journal_date?: string;
  is_closed?: number;
  date_display?: string;
  session_count?: number;

  // بدء يوميات
  old_orders_count: number;
  old_pieces_count: number;
  old_orders_value: number;
  prev_balance: number;
  new_orders_count: number;
  new_pieces_count: number;
  new_orders_value: number;
  total_orders_count: number;
  total_pieces_count: number;
  total_orders_value: number;
  paid_collected: number;
  paid_to_rep: number;
  start_net_balance: number;

  // إغلاق اليوميات
  delivered_orders_count: number;
  delivered_pieces: number;
  delivered_value: number;
  postponed_orders_count: number;
  postponed_pieces: number;
  postponed_value: number;
  returned_orders_count: number;
  returned_pieces: number;
  returned_value: number;
  balance_before_returns: number;
  interim_payments: number;
  fines: number;
  incentives: number;
  close_collected: number;
  close_paid: number;
  final_closing_balance: number;
}

const NewPeriodSummaryReport: React.FC = () => {
  const [selectedDate, setSelectedDate] = useState(formatLocalDate());
  const [viewMode, setViewMode] = useState<'rep_summary' | 'daily_sessions'>('rep_summary');
  const [loading, setLoading] = useState(false);
  const [reportRows, setReportRows] = useState<RepSummaryRow[]>([]);
  const [reportTotals, setReportTotals] = useState<any>({});
  const printRef = useRef<HTMLDivElement>(null);

  const currencySymbol = 'ج.م';

  // Format numbers cleanly
  const fmtNum = (val: any) => {
    const num = Number(val || 0);
    return num.toLocaleString('en-US');
  };

  const fmtCurrency = (val: any) => {
    const num = Number(val || 0);
    return num.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  };

  // Helper to change date by offset (+1 or -1 days)
  const shiftDay = (days: number) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + days);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    setSelectedDate(`${y}-${m}-${day}`);
  };

  // Fetch report data for the selected single day
  const loadReport = async () => {
    setLoading(true);
    try {
      const url = `${API_BASE_PATH}/api.php?module=reports&action=new_period_summary&start_date=${selectedDate}&end_date=${selectedDate}&view_mode=${viewMode}`;
      const res = await fetch(url);
      const json = await res.json();

      if (json && json.success) {
        setReportRows(json.data.rows || []);
        setReportTotals(json.data.totals || {});
      } else {
        setReportRows([]);
        setReportTotals({});
        Swal.fire('تنبيه', json.message || 'لا توجد بيانات ليومية هذا التاريخ.', 'info');
      }
    } catch (e: any) {
      console.error('Failed to load daily summary report', e);
      Swal.fire('خطأ', 'فشل تحميل بيانات التقرير. يرجى التحقق من الاتصال.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReport();
  }, [selectedDate, viewMode]);

  const filteredRows = reportRows;

  // Direct High-fidelity Excel Export matching NewReport1.XLSX
  const exportToExcel = async () => {
    if (!reportRows.length) {
      Swal.fire('تنبيه', 'لا توجد بيانات لتصديرها.', 'info');
      return;
    }

    try {
      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'DragonPro ERP';
      workbook.created = new Date();

      const ws = workbook.addWorksheet('ملخص اليومية', {
        views: [{ rightToLeft: true }]
      });

      // Palette Colors matching NewReport1.XLSX exactly
      const C_MAIN_TITLE = 'FFA6A6A6';      // Row 1 Gray
      const C_CORAL_RED  = 'FFC0504D';      // Row 2 Brick/Coral Red
      const C_LIGHT_BLUE = 'FFB8CCE4';      // Old Balances / Postponed / Fines
      const C_GREEN      = 'FF00B050';      // Previous Bal / Start Bal / Before Returns / Final Bal
      const C_LIME_PALE  = 'FFEBF1DE';      // Assigned Today / Settlement
      const C_TOTALS_BLU = 'FF95B3D7';      // Totals
      const C_GOLD_PALE  = 'FFFFF2CC';      // Paid Today
      const C_DELIV_GRN  = 'FFD8E4BC';      // Deliveries
      const C_RETURN_RED = 'FFE6B8B7';      // Returns
      const C_PINK_PALE  = 'FFF2DCDB';      // In-transit interim payments

      // Border helper
      const thinBorder: any = {
        top: { style: 'thin', color: { argb: 'FF000000' } },
        left: { style: 'thin', color: { argb: 'FF000000' } },
        bottom: { style: 'thin', color: { argb: 'FF000000' } },
        right: { style: 'thin', color: { argb: 'FF000000' } },
      };

      const setCellStyle = (cell: any, fillHex: string | null, fontHex = 'FF000000', bold = false, size = 9) => {
        if (fillHex) {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: fillHex }
          };
        }
        cell.font = {
          name: 'Calibri',
          size: size,
          bold: bold,
          color: { argb: fontHex }
        };
        cell.alignment = {
          vertical: 'middle',
          horizontal: 'center',
          wrapText: true
        };
        cell.border = thinBorder;
      };

      // Set column widths matching original sheet
      ws.columns = [
        { width: 5 },   // A: Seq
        { width: 18 },  // B: Rep / Session
        { width: 8 },   // C: Old Orders Count
        { width: 8 },   // D: Old Pieces
        { width: 12 },  // E: Old Orders Value
        { width: 12 },  // F: Prev Bal
        { width: 9 },   // G: New Orders Count
        { width: 9 },   // H: New Pieces
        { width: 13 },  // I: New Orders Value
        { width: 9 },   // J: Total Orders
        { width: 9 },   // K: Total Pieces
        { width: 13 },  // L: Total Value
        { width: 11 },  // M: Paid Collected
        { width: 11 },  // N: Paid to Rep
        { width: 13 },  // O: Start Net Balance
        { width: 9 },   // P: Delivered Orders
        { width: 9 },   // Q: Delivered Pieces
        { width: 13 },  // R: Delivered Value
        { width: 9 },   // S: Postponed Orders
        { width: 9 },   // T: Postponed Pieces
        { width: 13 },  // U: Postponed Value
        { width: 9 },   // V: Returned Orders
        { width: 9 },   // W: Returned Pieces
        { width: 13 },  // X: Returned Value
        { width: 14 },  // Y: Bal Before Returns
        { width: 11 },  // Z: Interim Payments
        { width: 10 },  // AA: Fines
        { width: 10 },  // AB: Incentives
        { width: 11 },  // AC: Close Collected
        { width: 11 },  // AD: Close Paid
        { width: 14 }   // AE: Final Closing Bal
      ];

      // Row 1: Title
      ws.mergeCells('A1:AE1');
      const r1 = ws.getRow(1);
      r1.height = 30;
      r1.getCell(1).value = `تقرير ملخص اليومية (${selectedDate})`;
      setCellStyle(r1.getCell(1), C_MAIN_TITLE, 'FF000000', true, 12);

      // Row 2: Top Group Headers
      ws.mergeCells('A2:B2');
      ws.getCell('A2').value = 'بيانات المندوب';
      setCellStyle(ws.getCell('A2'), C_CORAL_RED, 'FFFFFFFF', true, 10);
      setCellStyle(ws.getCell('B2'), C_CORAL_RED, 'FFFFFFFF', true, 10);

      ws.mergeCells('C2:O2');
      ws.getCell('C2').value = 'بدء اليوميات';
      setCellStyle(ws.getCell('C2'), C_CORAL_RED, 'FFFFFFFF', true, 11);
      for (let c = 4; c <= 15; c++) setCellStyle(ws.getRow(2).getCell(c), C_CORAL_RED, 'FFFFFFFF', true, 11);

      ws.mergeCells('P2:AE2');
      ws.getCell('P2').value = 'إغلاق اليوميات';
      setCellStyle(ws.getCell('P2'), C_CORAL_RED, 'FFFFFFFF', true, 11);
      for (let c = 17; c <= 31; c++) setCellStyle(ws.getRow(2).getCell(c), C_CORAL_RED, 'FFFFFFFF', true, 11);
      ws.getRow(2).height = 24;

      // Row 3: Subgroup Headers
      const r3 = ws.getRow(3);
      r3.height = 22;

      ws.mergeCells('A3:B3');
      ws.getCell('A3').value = '';
      setCellStyle(ws.getCell('A3'), C_LIGHT_BLUE);
      setCellStyle(ws.getCell('B3'), C_LIGHT_BLUE);

      ws.mergeCells('C3:E3');
      ws.getCell('C3').value = 'أوردرات بايتة';
      for (let c = 3; c <= 5; c++) setCellStyle(r3.getCell(c), C_LIGHT_BLUE, 'FF000000', true);

      ws.mergeCells('F3:F3');
      ws.getCell('F3').value = 'رصيد سابق';
      setCellStyle(ws.getCell('F3'), C_GREEN, 'FFFFFFFF', true);

      ws.mergeCells('G3:I3');
      ws.getCell('G3').value = 'أوردرات اليوم';
      for (let c = 7; c <= 9; c++) setCellStyle(r3.getCell(c), C_LIME_PALE, 'FF000000', true);

      ws.mergeCells('J3:L3');
      ws.getCell('J3').value = 'إجمالي الأوردرات المستلمة';
      for (let c = 10; c <= 12; c++) setCellStyle(r3.getCell(c), C_TOTALS_BLU, 'FF000000', true);

      ws.mergeCells('M3:N3');
      ws.getCell('M3').value = 'تسديدات اليوم';
      for (let c = 13; c <= 14; c++) setCellStyle(r3.getCell(c), C_GOLD_PALE, 'FF000000', true);

      ws.mergeCells('O3:O3');
      ws.getCell('O3').value = 'صافي رصيد البدء';
      setCellStyle(ws.getCell('O3'), C_GREEN, 'FFFFFFFF', true);

      ws.mergeCells('P3:R3');
      ws.getCell('P3').value = 'تسليمات';
      for (let c = 16; c <= 18; c++) setCellStyle(r3.getCell(c), C_DELIV_GRN, 'FF000000', true);

      ws.mergeCells('S3:U3');
      ws.getCell('S3').value = 'نزول / مؤجل';
      for (let c = 19; c <= 21; c++) setCellStyle(r3.getCell(c), C_LIGHT_BLUE, 'FF000000', true);

      ws.mergeCells('V3:X3');
      ws.getCell('V3').value = 'مرتجع';
      for (let c = 22; c <= 24; c++) setCellStyle(r3.getCell(c), C_RETURN_RED, 'FF000000', true);

      ws.mergeCells('Y3:Y3');
      ws.getCell('Y3').value = 'رصيد قبل المرتجع';
      setCellStyle(ws.getCell('Y3'), C_GREEN, 'FFFFFFFF', true);

      ws.mergeCells('Z3:Z3');
      ws.getCell('Z3').value = 'تسديد بالطريق';
      setCellStyle(ws.getCell('Z3'), C_PINK_PALE, 'FF000000', true);

      ws.mergeCells('AA3:AA3');
      ws.getCell('AA3').value = 'غرامات';
      setCellStyle(ws.getCell('AA3'), C_LIGHT_BLUE, 'FF000000', true);

      ws.mergeCells('AB3:AB3');
      ws.getCell('AB3').value = 'حافز';
      setCellStyle(ws.getCell('AB3'), C_LIME_PALE, 'FF000000', true);

      ws.mergeCells('AC3:AD3');
      ws.getCell('AC3').value = 'تسديدات عند الإغلاق';
      for (let c = 29; c <= 30; c++) setCellStyle(r3.getCell(c), C_LIME_PALE, 'FF000000', true);

      ws.mergeCells('AE3:AE3');
      ws.getCell('AE3').value = 'الرصيد الختامي';
      setCellStyle(ws.getCell('AE3'), C_GREEN, 'FFFFFFFF', true);

      // Row 4: Detailed Leaf Column Headers
      const leafHeaders = [
        { title: 'م', fill: C_LIGHT_BLUE },
        { title: viewMode === 'rep_summary' ? 'اسم المندوب' : 'المندوب / الجلسة', fill: C_LIGHT_BLUE },
        { title: 'عدد', fill: C_LIGHT_BLUE },
        { title: 'قطع', fill: C_LIGHT_BLUE },
        { title: 'مبلغ', fill: C_LIGHT_BLUE },
        { title: 'رصيد سابق', fill: C_GREEN, font: 'FFFFFFFF' },
        { title: 'عدد', fill: C_LIME_PALE },
        { title: 'قطع', fill: C_LIME_PALE },
        { title: 'مبلغ', fill: C_LIME_PALE },
        { title: 'عدد', fill: C_TOTALS_BLU },
        { title: 'قطع', fill: C_TOTALS_BLU },
        { title: 'مبلغ', fill: C_TOTALS_BLU },
        { title: 'توريد', fill: C_GOLD_PALE },
        { title: 'صرف', fill: C_GOLD_PALE },
        { title: 'صافي البدء', fill: C_GREEN, font: 'FFFFFFFF' },
        { title: 'عدد', fill: C_DELIV_GRN },
        { title: 'قطع', fill: C_DELIV_GRN },
        { title: 'مبلغ', fill: C_DELIV_GRN },
        { title: 'عدد', fill: C_LIGHT_BLUE },
        { title: 'قطع', fill: C_LIGHT_BLUE },
        { title: 'مبلغ', fill: C_LIGHT_BLUE },
        { title: 'عدد', fill: C_RETURN_RED },
        { title: 'قطع', fill: C_RETURN_RED },
        { title: 'مبلغ', fill: C_RETURN_RED },
        { title: 'قبل المرتجع', fill: C_GREEN, font: 'FFFFFFFF' },
        { title: 'تسديد بالطريق', fill: C_PINK_PALE },
        { title: 'غرامات', fill: C_LIGHT_BLUE },
        { title: 'حافز', fill: C_LIME_PALE },
        { title: 'توريد', fill: C_LIME_PALE },
        { title: 'صرف', fill: C_LIME_PALE },
        { title: 'صافي الختام', fill: C_GREEN, font: 'FFFFFFFF' }
      ];

      const r4 = ws.getRow(4);
      r4.height = 24;
      leafHeaders.forEach((h, idx) => {
        const cell = r4.getCell(idx + 1);
        cell.value = h.title;
        setCellStyle(cell, h.fill, h.font || 'FF000000', true, 9);
      });

      // Data Rows
      let currentRowIdx = 5;
      reportRows.forEach(row => {
        const r = ws.getRow(currentRowIdx);
        r.height = 20;

        const displayName = viewMode === 'rep_summary'
          ? row.rep_name
          : `${row.rep_name} (${row.daily_code || 'جلسة'})`;

        const rowValues = [
          row.seq,
          displayName,
          row.old_orders_count || '',
          row.old_pieces_count || '',
          row.old_orders_value || '',
          row.prev_balance,
          row.new_orders_count || '',
          row.new_pieces_count || '',
          row.new_orders_value || '',
          row.total_orders_count || '',
          row.total_pieces_count || '',
          row.total_orders_value || '',
          row.paid_collected || '',
          row.paid_to_rep || '',
          row.start_net_balance,
          row.delivered_orders_count || '',
          row.delivered_pieces || '',
          row.delivered_value || '',
          row.postponed_orders_count || '',
          row.postponed_pieces || '',
          row.postponed_value || '',
          row.returned_orders_count || '',
          row.returned_pieces || '',
          row.returned_value || '',
          row.balance_before_returns,
          row.interim_payments || '',
          row.fines || '',
          row.incentives || '',
          row.close_collected || '',
          row.close_paid || '',
          row.final_closing_balance
        ];

        rowValues.forEach((val, idx) => {
          const cell = r.getCell(idx + 1);
          cell.value = val;

          // Color accents matching sheet
          let fill: string | null = null;
          let fontColor = 'FF000000';
          let bold = false;

          if (idx === 5 || idx === 14 || idx === 24 || idx === 30) {
            fill = 'FFEBF1DE';
            fontColor = 'FF006100';
            bold = true;
          } else if (idx === 9 || idx === 10 || idx === 11) {
            fill = 'FFEDF2F8';
            bold = true;
          }

          setCellStyle(cell, fill, fontColor, bold, 9);

          // Number format
          if (typeof val === 'number') {
            if ([4, 5, 8, 11, 12, 13, 14, 17, 20, 23, 24, 25, 26, 27, 28, 29, 30].includes(idx)) {
              cell.numFmt = '#,##0.00';
            } else {
              cell.numFmt = '#,##0';
            }
          }
        });

        currentRowIdx++;
      });

      // Total Row matching sheet
      const totRow = ws.getRow(currentRowIdx);
      totRow.height = 26;

      ws.mergeCells(`A${currentRowIdx}:B${currentRowIdx}`);
      totRow.getCell(1).value = 'الإجمالي العام';
      setCellStyle(totRow.getCell(1), C_TOTALS_BLU, 'FF000000', true, 10);
      setCellStyle(totRow.getCell(2), C_TOTALS_BLU, 'FF000000', true, 10);

      const totalVals = [
        reportTotals.old_orders_count,
        reportTotals.old_pieces_count,
        reportTotals.old_orders_value,
        reportTotals.prev_balance,
        reportTotals.new_orders_count,
        reportTotals.new_pieces_count,
        reportTotals.new_orders_value,
        reportTotals.total_orders_count,
        reportTotals.total_pieces_count,
        reportTotals.total_orders_value,
        reportTotals.paid_collected,
        reportTotals.paid_to_rep,
        reportTotals.start_net_balance,
        reportTotals.delivered_orders_count,
        reportTotals.delivered_pieces,
        reportTotals.delivered_value,
        reportTotals.postponed_orders_count,
        reportTotals.postponed_pieces,
        reportTotals.postponed_value,
        reportTotals.returned_orders_count,
        reportTotals.returned_pieces,
        reportTotals.returned_value,
        reportTotals.balance_before_returns,
        reportTotals.interim_payments,
        reportTotals.fines,
        reportTotals.incentives,
        reportTotals.close_collected,
        reportTotals.close_paid,
        reportTotals.final_closing_balance
      ];

      totalVals.forEach((val, idx) => {
        const colIdx = idx + 3;
        const cell = totRow.getCell(colIdx);
        cell.value = val || 0;

        let fill = C_TOTALS_BLU;
        if ([5, 14, 24, 30].includes(idx)) {
          fill = C_GREEN;
        }

        setCellStyle(cell, fill, fill === C_GREEN ? 'FFFFFFFF' : 'FF000000', true, 9);
        if ([2, 3, 6, 9, 10, 11, 12, 15, 18, 21, 22, 23, 24, 25, 26, 27, 28].includes(idx)) {
          cell.numFmt = '#,##0.00';
        } else {
          cell.numFmt = '#,##0';
        }
      });

      // Write and download
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `تقرير_ملخص_اليومية_${selectedDate}.xlsx`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      Swal.fire({
        icon: 'success',
        title: 'تم التصدير بنجاح! 📊',
        text: 'تم إنشاء وتحميل ملف الإكسيل المطابق للتقرير بالكامل.',
        timer: 2000,
        showConfirmButton: false
      });
    } catch (e: any) {
      console.error('Excel Export Error:', e);
      Swal.fire('خطأ', 'حدث خطأ أثناء تصدير ملف الإكسيل.', 'error');
    }
  };

  // Direct Browser Print
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300" dir="rtl">
      {/* ── Top Header and Filter Card ── */}
      <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm print:hidden">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-slate-100 dark:border-slate-700/60">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-rose-500 to-amber-600 text-white flex items-center justify-center font-black shadow-md shadow-rose-500/20">
                <Table size={18} />
              </span>
              <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
                تقرير ملخص اليومية
              </h2>
              <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800">
                مطابق للإكسيل 100%
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              تقرير تفصيلي موحد لدورة اليومية: الأرصدة الافتتاحية، التسليمات، المرتجعات، وتصفية حسابات المناديب
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={loadReport}
              disabled={loading}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition-all flex items-center gap-2 active:scale-95"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin text-blue-500' : ''} />
              <span>تحديث</span>
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

        {/* ── Single Date Selection & Mode Bar ── */}
        <div className="pt-4 flex flex-wrap items-center justify-between gap-4">
          {/* Single Day Picker with Step Controls */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-3.5 py-2 rounded-2xl shadow-sm">
              <Calendar size={16} className="text-rose-500" />
              <span className="text-xs font-bold text-slate-600 dark:text-slate-300">تاريخ اليومية:</span>
              <input
                type="date"
                value={selectedDate}
                onChange={e => setSelectedDate(e.target.value)}
                className="bg-transparent text-xs font-black text-slate-800 dark:text-slate-100 focus:outline-none"
              />
            </div>

            {/* Stepper buttons (< and >) */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => shiftDay(-1)}
                className="p-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700/60 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl transition-all"
                title="اليوم السابق"
              >
                <ChevronRight size={15} />
              </button>
              <button
                type="button"
                onClick={() => shiftDay(1)}
                className="p-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700/60 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl transition-all"
                title="اليوم التالي"
              >
                <ChevronLeft size={15} />
              </button>
            </div>

            {/* Quick buttons: Today & Yesterday */}
            <div className="flex items-center gap-1.5 mr-2">
              <button
                type="button"
                onClick={() => setSelectedDate(formatLocalDate())}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  selectedDate === formatLocalDate()
                    ? 'bg-rose-500 text-white shadow-sm'
                    : 'bg-slate-100 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                }`}
              >
                اليوم
              </button>
              <button
                type="button"
                onClick={() => setSelectedDate(getDaysAgo(1))}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  selectedDate === getDaysAgo(1)
                    ? 'bg-rose-500 text-white shadow-sm'
                    : 'bg-slate-100 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                }`}
              >
                أمس
              </button>
            </div>
          </div>

          {/* View Mode Toggle */}
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-900/60 p-1 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold">
            <button
              type="button"
              onClick={() => setViewMode('rep_summary')}
              className={`px-3.5 py-1.5 rounded-lg transition-all ${
                viewMode === 'rep_summary'
                  ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              ملخص مجمع لكل مندوب
            </button>
            <button
              type="button"
              onClick={() => setViewMode('daily_sessions')}
              className={`px-3.5 py-1.5 rounded-lg transition-all ${
                viewMode === 'daily_sessions'
                  ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              تفصيلي بكل جلسة يومية
            </button>
          </div>
        </div>
      </div>

      {/* ── Summary KPI Cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 print:hidden">
        <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
            <CheckCircle size={20} />
          </div>
          <div>
            <p className="text-[11px] font-bold text-slate-400">إجمالي التسليمات</p>
            <p className="text-base font-black text-slate-900 dark:text-white">
              {fmtCurrency(reportTotals.delivered_value)} {currencySymbol}
            </p>
            <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">
              {fmtNum(reportTotals.delivered_orders_count)} طلب ({fmtNum(reportTotals.delivered_pieces)} قطعة)
            </p>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center font-bold">
            <Package size={20} />
          </div>
          <div>
            <p className="text-[11px] font-bold text-slate-400">إجمالي المرتجعات</p>
            <p className="text-base font-black text-slate-900 dark:text-white">
              {fmtCurrency(reportTotals.returned_value)} {currencySymbol}
            </p>
            <p className="text-[10px] text-rose-600 dark:text-rose-400 font-bold">
              {fmtNum(reportTotals.returned_orders_count)} طلب ({fmtNum(reportTotals.returned_pieces)} قطعة)
            </p>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
            <Clock size={20} />
          </div>
          <div>
            <p className="text-[11px] font-bold text-slate-400">المؤجلات / النزول</p>
            <p className="text-base font-black text-slate-900 dark:text-white">
              {fmtCurrency(reportTotals.postponed_value)} {currencySymbol}
            </p>
            <p className="text-[10px] text-blue-600 dark:text-blue-400 font-bold">
              {fmtNum(reportTotals.postponed_orders_count)} طلب مؤجل
            </p>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold">
            <Coins size={20} />
          </div>
          <div>
            <p className="text-[11px] font-bold text-slate-400">إجمالي الأوردرات الصادرة</p>
            <p className="text-base font-black text-slate-900 dark:text-white">
              {fmtCurrency(reportTotals.total_orders_value)} {currencySymbol}
            </p>
            <p className="text-[10px] text-amber-600 dark:text-amber-400 font-bold">
              {fmtNum(reportTotals.total_orders_count)} طلب ({fmtNum(reportTotals.total_pieces_count)} قطعة)
            </p>
          </div>
        </div>
      </div>

      {/* ── Table Container Matching NewReport1.XLSX Exactly ── */}
      <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden" ref={printRef}>
        <div className="overflow-x-auto max-w-full">
          <table className="w-full border-collapse text-center text-xs whitespace-nowrap min-w-[2400px]">
            <thead>
              {/* Row 1: Main Title Spanning All Columns */}
              <tr className="bg-[#A6A6A6] text-black font-black border border-black">
                <th colSpan={33} className="py-2.5 px-4 text-sm tracking-wide">
                  تقرير ملخص اليومية {viewMode === 'rep_summary' ? '(ملخص مجمع للمناديب)' : '(تفصيلي بجلسات اليوميات)'} — ليوم {selectedDate}
                </th>
              </tr>

              {/* Row 2: Level 1 Classification Groups */}
              <tr className="bg-[#C0504D] text-white font-black text-xs border border-black divide-x divide-black">
                <th colSpan={2} className="py-2 px-3 border border-black">بيانات المندوب</th>
                <th colSpan={13} className="py-2 px-3 border border-black">بدء اليوميات</th>
                <th colSpan={16} className="py-2 px-3 border border-black">إغلاق اليوميات</th>
              </tr>

              {/* Row 3: Level 2 Sub-groups */}
              <tr className="font-bold text-black border border-black divide-x divide-black">
                <th colSpan={2} className="bg-[#B8CCE4] border border-black py-1.5"></th>
                <th colSpan={3} className="bg-[#B8CCE4] border border-black py-1.5">أوردرات بايتة</th>
                <th colSpan={1} className="bg-[#00B050] text-white border border-black py-1.5">رصيد سابق</th>
                <th colSpan={3} className="bg-[#EBF1DE] border border-black py-1.5">أوردرات اليوم</th>
                <th colSpan={3} className="bg-[#95B3D7] border border-black py-1.5">إجمالي الأوردرات المستلمة</th>
                <th colSpan={2} className="bg-[#FFFFCC] border border-black py-1.5">تسديدات اليوم</th>
                <th colSpan={1} className="bg-[#00B050] text-white border border-black py-1.5">صافي رصيد البدء</th>
                <th colSpan={3} className="bg-[#D8E4BC] border border-black py-1.5">تسليمات</th>
                <th colSpan={3} className="bg-[#B8CCE4] border border-black py-1.5">نزول / مؤجل</th>
                <th colSpan={3} className="bg-[#E6B8B7] border border-black py-1.5">مرتجع</th>
                <th colSpan={1} className="bg-[#00B050] text-white border border-black py-1.5">رصيد قبل المرتجع</th>
                <th colSpan={1} className="bg-[#F2DCDB] border border-black py-1.5">تسديد بالطريق</th>
                <th colSpan={1} className="bg-[#B8CCE4] border border-black py-1.5">غرامات</th>
                <th colSpan={1} className="bg-[#EBF1DE] border border-black py-1.5">حافز</th>
                <th colSpan={2} className="bg-[#EBF1DE] border border-black py-1.5">تسديدات عند الإغلاق</th>
                <th colSpan={1} className="bg-[#00B050] text-white border border-black py-1.5">الرصيد الختامي</th>
              </tr>

              {/* Row 4: Level 3 Leaf Columns */}
              <tr className="font-bold text-black border border-black divide-x divide-black text-[11px]">
                {/* 1-2 */}
                <th className="bg-[#B8CCE4] border border-black py-2 px-1 w-8">م</th>
                <th className="bg-[#B8CCE4] border border-black py-2 px-3 text-right">
                  {viewMode === 'rep_summary' ? 'اسم المندوب' : 'المندوب / الجلسة'}
                </th>

                {/* 3-5: أوردرات بايتة */}
                <th className="bg-[#B8CCE4] border border-black py-2 px-2">عدد</th>
                <th className="bg-[#B8CCE4] border border-black py-2 px-2">قطع</th>
                <th className="bg-[#B8CCE4] border border-black py-2 px-2">مبلغ</th>

                {/* 6: رصيد سابق */}
                <th className="bg-[#00B050] text-white border border-black py-2 px-2 font-black">رصيد سابق</th>

                {/* 7-9: أوردرات اليوم */}
                <th className="bg-[#EBF1DE] border border-black py-2 px-2">عدد</th>
                <th className="bg-[#EBF1DE] border border-black py-2 px-2">قطع</th>
                <th className="bg-[#EBF1DE] border border-black py-2 px-2">مبلغ</th>

                {/* 10-12: إجمالي الأوردرات */}
                <th className="bg-[#95B3D7] border border-black py-2 px-2 font-black">عدد</th>
                <th className="bg-[#95B3D7] border border-black py-2 px-2 font-black">قطع</th>
                <th className="bg-[#95B3D7] border border-black py-2 px-2 font-black">مبلغ</th>

                {/* 13-14: تسديدات اليوم */}
                <th className="bg-[#FFFFCC] border border-black py-2 px-2">توريد</th>
                <th className="bg-[#FFFFCC] border border-black py-2 px-2">صرف</th>

                {/* 15: صافي رصيد البدء */}
                <th className="bg-[#00B050] text-white border border-black py-2 px-2 font-black">صافي البدء</th>

                {/* 16-18: تسليمات */}
                <th className="bg-[#D8E4BC] border border-black py-2 px-2">عدد</th>
                <th className="bg-[#D8E4BC] border border-black py-2 px-2">قطع</th>
                <th className="bg-[#D8E4BC] border border-black py-2 px-2">مبلغ</th>

                {/* 19-21: نزول / مؤجل */}
                <th className="bg-[#B8CCE4] border border-black py-2 px-2">عدد</th>
                <th className="bg-[#B8CCE4] border border-black py-2 px-2">قطع</th>
                <th className="bg-[#B8CCE4] border border-black py-2 px-2">مبلغ</th>

                {/* 22-24: مرتجع */}
                <th className="bg-[#E6B8B7] border border-black py-2 px-2">عدد</th>
                <th className="bg-[#E6B8B7] border border-black py-2 px-2">قطع</th>
                <th className="bg-[#E6B8B7] border border-black py-2 px-2">مبلغ</th>

                {/* 25: رصيد قبل المرتجع */}
                <th className="bg-[#00B050] text-white border border-black py-2 px-2 font-black">قبل المرتجع</th>

                {/* 26: تسديد بالطريق */}
                <th className="bg-[#F2DCDB] border border-black py-2 px-2">تسديد بالطريق</th>

                {/* 27-28: غرامات وحوافز */}
                <th className="bg-[#B8CCE4] border border-black py-2 px-2">غرامات</th>
                <th className="bg-[#EBF1DE] border border-black py-2 px-2">حافز</th>

                {/* 29-30: تسديدات عند الإغلاق */}
                <th className="bg-[#EBF1DE] border border-black py-2 px-2">توريد</th>
                <th className="bg-[#EBF1DE] border border-black py-2 px-2">صرف</th>

                {/* 31: الرصيد الختامي */}
                <th className="bg-[#00B050] text-white border border-black py-2 px-3 font-black">صافي الختام</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-black font-semibold text-slate-800 dark:text-slate-100">
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={31} className="py-12 text-center text-slate-400 font-bold bg-white dark:bg-slate-800">
                    {loading ? (
                      <div className="flex items-center justify-center gap-2">
                        <RefreshCw className="animate-spin text-blue-500" size={18} />
                        <span>جاري تحميل بيانات اليومية...</span>
                      </div>
                    ) : (
                      'لا توجد يوميات مسجلة لهذا التاريخ المحدد'
                    )}
                  </td>
                </tr>
              ) : (
                filteredRows.map((r, i) => (
                  <tr
                    key={`${r.rep_id}-${r.journal_id || i}`}
                    className="hover:bg-slate-100/70 dark:hover:bg-slate-700/50 transition-colors border-b border-black text-center"
                  >
                    {/* 1: Seq */}
                    <td className="border border-black py-1.5 px-1 bg-slate-50 dark:bg-slate-800/80 font-bold">{r.seq}</td>

                    {/* 2: Rep Name / Session */}
                    <td className="border border-black py-1.5 px-3 text-right font-black bg-slate-50 dark:bg-slate-800/80">
                      <div>{r.rep_name}</div>
                      {viewMode === 'daily_sessions' && (
                        <div className="text-[10px] text-slate-500 font-normal">
                          كود: {r.daily_code || '—'} {r.is_closed ? '• مغلقة' : '• مفتوحة'}
                        </div>
                      )}
                    </td>

                    {/* 3-5: أوردرات بايتة */}
                    <td className="border border-black py-1.5 px-1">{r.old_orders_count || '—'}</td>
                    <td className="border border-black py-1.5 px-1">{r.old_pieces_count || '—'}</td>
                    <td className="border border-black py-1.5 px-1">{r.old_orders_value ? fmtCurrency(r.old_orders_value) : '—'}</td>

                    {/* 6: رصيد سابق */}
                    <td className="border border-black py-1.5 px-2 bg-emerald-50 dark:bg-emerald-950/20 font-black text-emerald-800 dark:text-emerald-300">
                      {fmtCurrency(r.prev_balance)}
                    </td>

                    {/* 7-9: أوردرات اليوم */}
                    <td className="border border-black py-1.5 px-1">{r.new_orders_count || '—'}</td>
                    <td className="border border-black py-1.5 px-1">{r.new_pieces_count || '—'}</td>
                    <td className="border border-black py-1.5 px-1">{r.new_orders_value ? fmtCurrency(r.new_orders_value) : '—'}</td>

                    {/* 10-12: إجمالي الأوردرات */}
                    <td className="border border-black py-1.5 px-1 bg-blue-50 dark:bg-blue-950/20 font-bold">{r.total_orders_count || '—'}</td>
                    <td className="border border-black py-1.5 px-1 bg-blue-50 dark:bg-blue-950/20 font-bold">{r.total_pieces_count || '—'}</td>
                    <td className="border border-black py-1.5 px-1 bg-blue-50 dark:bg-blue-950/20 font-black text-blue-900 dark:text-blue-300">
                      {r.total_orders_value ? fmtCurrency(r.total_orders_value) : '—'}
                    </td>

                    {/* 13-14: تسديدات اليوم */}
                    <td className="border border-black py-1.5 px-1 text-emerald-700 dark:text-emerald-400 font-bold">{r.paid_collected ? fmtCurrency(r.paid_collected) : '—'}</td>
                    <td className="border border-black py-1.5 px-1 text-rose-700 dark:text-rose-400 font-bold">{r.paid_to_rep ? fmtCurrency(r.paid_to_rep) : '—'}</td>

                    {/* 15: صافي رصيد البدء */}
                    <td className="border border-black py-1.5 px-2 bg-emerald-50 dark:bg-emerald-950/30 font-black text-emerald-900 dark:text-emerald-200">
                      {fmtCurrency(r.start_net_balance)}
                    </td>

                    {/* 16-18: تسليمات */}
                    <td className="border border-black py-1.5 px-1 text-emerald-700 dark:text-emerald-400 font-bold">{r.delivered_orders_count || '—'}</td>
                    <td className="border border-black py-1.5 px-1 text-emerald-700 dark:text-emerald-400 font-bold">{r.delivered_pieces || '—'}</td>
                    <td className="border border-black py-1.5 px-1 bg-emerald-50/50 dark:bg-emerald-950/20 font-black text-emerald-800 dark:text-emerald-300">
                      {r.delivered_value ? fmtCurrency(r.delivered_value) : '—'}
                    </td>

                    {/* 19-21: نزول / مؤجل */}
                    <td className="border border-black py-1.5 px-1">{r.postponed_orders_count || '—'}</td>
                    <td className="border border-black py-1.5 px-1">{r.postponed_pieces || '—'}</td>
                    <td className="border border-black py-1.5 px-1">{r.postponed_value ? fmtCurrency(r.postponed_value) : '—'}</td>

                    {/* 22-24: مرتجع */}
                    <td className="border border-black py-1.5 px-1 text-rose-600 dark:text-rose-400 font-bold">{r.returned_orders_count || '—'}</td>
                    <td className="border border-black py-1.5 px-1 text-rose-600 dark:text-rose-400 font-bold">{r.returned_pieces || '—'}</td>
                    <td className="border border-black py-1.5 px-1 bg-rose-50/50 dark:bg-rose-950/20 font-black text-rose-800 dark:text-rose-300">
                      {r.returned_value ? fmtCurrency(r.returned_value) : '—'}
                    </td>

                    {/* 25: رصيد قبل المرتجع */}
                    <td className="border border-black py-1.5 px-2 bg-emerald-50 dark:bg-emerald-950/20 font-black text-slate-800 dark:text-slate-100">
                      {fmtCurrency(r.balance_before_returns)}
                    </td>

                    {/* 26: تسديد بالطريق */}
                    <td className="border border-black py-1.5 px-1 text-purple-700 dark:text-purple-400 font-bold">{r.interim_payments ? fmtCurrency(r.interim_payments) : '—'}</td>

                    {/* 27-28: غرامات وحافز */}
                    <td className="border border-black py-1.5 px-1 text-rose-600 dark:text-rose-400 font-bold">{r.fines ? fmtCurrency(r.fines) : '—'}</td>
                    <td className="border border-black py-1.5 px-1 text-emerald-600 dark:text-emerald-400 font-bold">{r.incentives ? fmtCurrency(r.incentives) : '—'}</td>

                    {/* 29-30: تسديدات الإغلاق */}
                    <td className="border border-black py-1.5 px-1 text-emerald-700 dark:text-emerald-400 font-bold">{r.close_collected ? fmtCurrency(r.close_collected) : '—'}</td>
                    <td className="border border-black py-1.5 px-1 text-rose-700 dark:text-rose-400 font-bold">{r.close_paid ? fmtCurrency(r.close_paid) : '—'}</td>

                    {/* 31: الرصيد الختامي */}
                    <td className="border border-black py-1.5 px-3 bg-emerald-100 dark:bg-emerald-900/50 font-black text-sm text-emerald-950 dark:text-white">
                      {fmtCurrency(r.final_closing_balance)}
                    </td>
                  </tr>
                ))
              )}

              {/* ── Summary Totals Row (Matching Sheet Exactly) ── */}
              {reportRows.length > 0 && (
                <tr className="bg-[#95B3D7] text-black font-black text-xs border-t-2 border-black divide-x divide-black text-center">
                  <td colSpan={2} className="border border-black py-2.5 px-3 text-sm">الإجمالي العام</td>

                  {/* 3-5 */}
                  <td className="border border-black py-2 px-1">{reportTotals.old_orders_count || '0'}</td>
                  <td className="border border-black py-2 px-1">{reportTotals.old_pieces_count || '0'}</td>
                  <td className="border border-black py-2 px-1">{fmtCurrency(reportTotals.old_orders_value)}</td>

                  {/* 6: رصيد سابق */}
                  <td className="border border-black py-2 px-2 bg-[#00B050] text-white font-black">{fmtCurrency(reportTotals.prev_balance)}</td>

                  {/* 7-9 */}
                  <td className="border border-black py-2 px-1">{reportTotals.new_orders_count || '0'}</td>
                  <td className="border border-black py-2 px-1">{reportTotals.new_pieces_count || '0'}</td>
                  <td className="border border-black py-2 px-1">{fmtCurrency(reportTotals.new_orders_value)}</td>

                  {/* 10-12 */}
                  <td className="border border-black py-2 px-1">{reportTotals.total_orders_count || '0'}</td>
                  <td className="border border-black py-2 px-1">{reportTotals.total_pieces_count || '0'}</td>
                  <td className="border border-black py-2 px-1">{fmtCurrency(reportTotals.total_orders_value)}</td>

                  {/* 13-14 */}
                  <td className="border border-black py-2 px-1">{fmtCurrency(reportTotals.paid_collected)}</td>
                  <td className="border border-black py-2 px-1">{fmtCurrency(reportTotals.paid_to_rep)}</td>

                  {/* 15: صافي البدء */}
                  <td className="border border-black py-2 px-2 bg-[#00B050] text-white font-black">{fmtCurrency(reportTotals.start_net_balance)}</td>

                  {/* 16-18: تسليمات */}
                  <td className="border border-black py-2 px-1">{reportTotals.delivered_orders_count || '0'}</td>
                  <td className="border border-black py-2 px-1">{reportTotals.delivered_pieces || '0'}</td>
                  <td className="border border-black py-2 px-1">{fmtCurrency(reportTotals.delivered_value)}</td>

                  {/* 19-21: مؤجل */}
                  <td className="border border-black py-2 px-1">{reportTotals.postponed_orders_count || '0'}</td>
                  <td className="border border-black py-2 px-1">{reportTotals.postponed_pieces || '0'}</td>
                  <td className="border border-black py-2 px-1">{fmtCurrency(reportTotals.postponed_value)}</td>

                  {/* 22-24: مرتجع */}
                  <td className="border border-black py-2 px-1">{reportTotals.returned_orders_count || '0'}</td>
                  <td className="border border-black py-2 px-1">{reportTotals.returned_pieces || '0'}</td>
                  <td className="border border-black py-2 px-1">{fmtCurrency(reportTotals.returned_value)}</td>

                  {/* 25: قبل المرتجع */}
                  <td className="border border-black py-2 px-2 bg-[#00B050] text-white font-black">{fmtCurrency(reportTotals.balance_before_returns)}</td>

                  {/* 26: تسديد بالطريق */}
                  <td className="border border-black py-2 px-1">{fmtCurrency(reportTotals.interim_payments)}</td>

                  {/* 27-28: غرامات وحوافز */}
                  <td className="border border-black py-2 px-1">{fmtCurrency(reportTotals.fines)}</td>
                  <td className="border border-black py-2 px-1">{fmtCurrency(reportTotals.incentives)}</td>

                  {/* 29-30: تسديدات الإغلاق */}
                  <td className="border border-black py-2 px-1">{fmtCurrency(reportTotals.close_collected)}</td>
                  <td className="border border-black py-2 px-1">{fmtCurrency(reportTotals.close_paid)}</td>

                  {/* 31: الرصيد الختامي */}
                  <td className="border border-black py-2.5 px-3 bg-[#00B050] text-white font-black text-sm">
                    {fmtCurrency(reportTotals.final_closing_balance)}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default NewPeriodSummaryReport;
