import React, { useState } from 'react';
import { FileText, RefreshCw } from 'lucide-react';
import CustomSelect from './CustomSelect';
import Swal from 'sweetalert2';
import { API_BASE_PATH } from '../services/apiConfig';

interface EmployeeSalaryReportProps {
  employees: any[];
}

const EmployeeSalaryReport: React.FC<EmployeeSalaryReportProps> = ({ employees }) => {
  const [selectedEmployee, setSelectedEmployee] = useState('');
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<any>(null);

  const loadReport = async () => {
    if (!selectedEmployee) {
      Swal.fire('تنبيه', 'يرجى اختيار موظف أولاً.', 'warning');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_PATH}/api.php?module=employee_salaries&action=getReport&employee_id=${selectedEmployee}&month=${month}`);
      const data = await res.json();
      if (data.success) {
        setReport(data.data);
      } else {
        Swal.fire('خطأ', data.message || 'تعذر جلب التقرير.', 'error');
      }
    } catch (error) {
      Swal.fire('خطأ', 'تعذر الاتصال بالخادم.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const buildReportHtml = () => {
    if (!report) return '';
    const emp = report.employee || {};
    const t = report.attendance?.totals || {};
    const p = report.attendance?.penalties || {};
    const tx = report.transactions?.totals || {};
    const c = report.computed || {};
    const rows = report.attendance?.rows || [];
    const txRows = report.transactions?.rows || [];

    const rowHtml = rows.map((row: any) => `
      <tr>
        <td>${row.work_date || '-'}</td>
        <td>${row.shift_name || '-'}</td>
        <td>${row.first_in || '-'}</td>
        <td>${row.last_out || '-'}</td>
        <td>${row.late_minutes || 0}</td>
        <td>${row.early_leave_minutes || 0}</td>
        <td>${row.overtime_minutes || 0}</td>
        <td>${row.status || '-'}</td>
      </tr>
    `).join('');

    const txHtml = txRows.map((txRow: any) => `
      <tr>
        <td>${txRow.date || '-'}</td>
        <td>${txRow.type || '-'}</td>
        <td>${Number(txRow.amount || 0).toLocaleString()}</td>
        <td>${txRow.notes || '-'}</td>
      </tr>
    `).join('');

    return `
      <!doctype html>
      <html lang="ar" dir="rtl">
      <head>
        <meta charset="utf-8" />
        <title>تقرير الراتب</title>
        <style>
          :root {
            --ink: #0f172a;
            --muted: #64748b;
            --border: #e2e8f0;
            --panel: #ffffff;
            --accent: #2563eb;
            --accent-soft: #dbeafe;
            --danger: #e11d48;
            --success: #16a34a;
          }
          * { box-sizing: border-box; }
          body { font-family: Arial, sans-serif; margin: 28px; color: var(--ink); background: #f8fafc; }
          h1, h2, h3 { margin: 0; }
          .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 18px; }
          .badge { background: var(--accent-soft); color: var(--accent); padding: 6px 12px; border-radius: 999px; font-size: 12px; font-weight: bold; }
          .grid { display: grid; gap: 10px; }
          .grid-2 { grid-template-columns: repeat(2, 1fr); }
          .grid-4 { grid-template-columns: repeat(4, 1fr); }
          .card { background: var(--panel); border: 1px solid var(--border); padding: 14px; border-radius: 14px; margin-bottom: 12px; box-shadow: 0 1px 0 rgba(15, 23, 42, 0.04); }
          .meta { display: flex; flex-wrap: wrap; gap: 12px; font-size: 12px; color: var(--muted); }
          .meta strong { color: var(--ink); }
          .kpi { border: 1px solid var(--border); border-radius: 12px; padding: 10px; background: #f1f5f9; }
          .kpi .label { font-size: 11px; color: var(--muted); }
          .kpi .value { font-size: 16px; font-weight: bold; }
          .kpi.danger .value { color: var(--danger); }
          .kpi.success .value { color: var(--success); }
          table { width: 100%; border-collapse: collapse; margin-top: 8px; background: #fff; }
          th, td { border: 1px solid var(--border); padding: 7px; font-size: 11px; text-align: right; }
          th { background: #f8fafc; color: var(--muted); font-weight: bold; }
          .section-title { font-size: 13px; color: var(--accent); margin-bottom: 6px; }
          .two-col { display: grid; grid-template-columns: 1.3fr 1fr; gap: 12px; }
          .summary-list { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; font-size: 12px; }
          .summary-list div { background: #f8fafc; border: 1px dashed var(--border); padding: 6px 8px; border-radius: 10px; }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <h1>تقرير راتب موظف</h1>
            <div class="meta">
              <span>الموظف: <strong>${emp.name || '-'}</strong></span>
              <span>المسمى الوظيفي: <strong>${emp.job_title || '-'}</strong></span>
              <span>الشهر: <strong>${report.month || '-'}</strong></span>
            </div>
          </div>
          <span class="badge">Dragon HRM</span>
        </div>

        <div class="grid grid-4">
          <div class="kpi">
            <div class="label">الراتب الأساسي</div>
            <div class="value">${Number(c.base_salary || 0).toLocaleString()}</div>
          </div>
          <div class="kpi danger">
            <div class="label">إجمالي الخصومات</div>
            <div class="value">${Number(c.deductions || 0).toLocaleString()}</div>
          </div>
          <div class="kpi success">
            <div class="label">إجمالي الحوافز</div>
            <div class="value">${Number(c.bonuses || 0).toLocaleString()}</div>
          </div>
          <div class="kpi">
            <div class="label">صافي متوقع</div>
            <div class="value">${Number(c.net_estimate || 0).toLocaleString()}</div>
          </div>
        </div>

        <div class="two-col">
          <div class="card">
            <div class="section-title">ملخص الحضور</div>
            <div class="summary-list">
              <div>أيام الحضور: <strong>${t.present_days || 0}</strong></div>
              <div>أيام التأخير: <strong>${t.late_days || 0}</strong></div>
              <div>أيام الغياب: <strong>${t.absent_days || 0}</strong></div>
              <div>أيام العطلات: <strong>${t.holiday_days || 0}</strong></div>
              <div>دقائق التأخير: <strong>${t.late_minutes || 0}</strong></div>
              <div>دقائق الانصراف المبكر: <strong>${t.early_leave_minutes || 0}</strong></div>
              <div>دقائق الإضافي: <strong>${t.overtime_minutes || 0}</strong></div>
            </div>
            <div class="summary-list" style="margin-top: 8px;">
              <div>خصم التأخير: <strong>${Number(p.late_penalty || 0).toLocaleString()}</strong></div>
              <div>خصم الانصراف المبكر: <strong>${Number(p.early_penalty || 0).toLocaleString()}</strong></div>
              <div>خصم الغياب: <strong>${Number(p.absence_penalty || 0).toLocaleString()}</strong></div>
              <div>حافز الإضافي: <strong>${Number(p.overtime_bonus || 0).toLocaleString()}</strong></div>
            </div>
          </div>

          <div class="card">
            <div class="section-title">الخصومات والمستحقات</div>
            <div class="summary-list">
              <div>السلف/المسحوبات: <strong>${Number(tx.advances || 0).toLocaleString()}</strong></div>
              <div>الحوافز اليدوية: <strong>${Number(tx.manual_bonuses || 0).toLocaleString()}</strong></div>
              <div>الخصومات اليدوية: <strong>${Number(tx.manual_penalties || 0).toLocaleString()}</strong></div>
              <div>الراتب المدفوع: <strong>${Number(tx.salary_paid || 0).toLocaleString()}</strong></div>
            </div>
          </div>
        </div>

        <div class="card">
          <div class="section-title">تفاصيل الحضور اليومي</div>
          <table>
            <thead>
              <tr>
                <th>التاريخ</th>
                <th>الوردية</th>
                <th>الدخول</th>
                <th>الخروج</th>
                <th>تأخير</th>
                <th>انصراف مبكر</th>
                <th>إضافي</th>
                <th>الحالة</th>
              </tr>
            </thead>
            <tbody>${rowHtml || ''}</tbody>
          </table>
        </div>

        <div class="card">
          <div class="section-title">المعاملات خلال الشهر</div>
          <table>
            <thead>
              <tr>
                <th>التاريخ</th>
                <th>النوع</th>
                <th>المبلغ</th>
                <th>ملاحظات</th>
              </tr>
            </thead>
            <tbody>${txHtml || ''}</tbody>
          </table>
        </div>
      </body>
      </html>
    `;
  };

  const exportPdf = () => {
    if (!report) {
      Swal.fire('تنبيه', 'يرجى عرض التقرير أولاً.', 'warning');
      return;
    }
    const html = buildReportHtml();
    const w = window.open('', '_blank');
    if (!w) {
      Swal.fire('خطأ', 'تعذر فتح نافذة التصدير.', 'error');
      return;
    }
    w.document.open();
    w.document.write(html);
    w.document.close();
    w.focus();
    w.print();
  };

  const exportCSV = () => {
    if (!report) {
      Swal.fire('تنبيه', 'يرجى عرض التقرير أولاً.', 'warning');
      return;
    }
    let csv = '\uFEFF';
    const emp = report.employee || {};
    csv += `"تقرير راتب موظف"\n`;
    csv += `"الموظف","${emp.name || '-'}"\n`;
    csv += `"الشهر","${report.month || '-'}"\n\n`;

    const c = report.computed || {};
    csv += `"الراتب الأساسي","${c.base_salary || 0}"\n`;
    csv += `"إجمالي الخصومات","${c.deductions || 0}"\n`;
    csv += `"إجمالي الحوافز","${c.bonuses || 0}"\n`;
    csv += `"صافي متوقع","${c.net_estimate || 0}"\n\n`;

    csv += `"المعاملات خلال الشهر"\n`;
    csv += `"التاريخ","النوع","المبلغ","ملاحظات"\n`;
    (report.transactions?.rows || []).forEach((tx: any) => {
      let tType = '';
      if (tx.type === 'advance') tType = 'سلفة';
      if (tx.type === 'bonus') tType = 'حافز';
      if (tx.type === 'penalty') tType = 'خصم';
      if (tx.type === 'salary') tType = 'راتب';
      csv += `"${tx.date}","${tType}","${tx.amount || 0}","${(tx.notes || '').replace(/"/g,'""')}"\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `salary_report_${emp.name || 'emp'}_${report.month}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const [attSortKey, setAttSortKey] = useState<string>('work_date');
  const [attSortAsc, setAttSortAsc] = useState<boolean>(true);

  const [txSortKey, setTxSortKey] = useState<string>('date');
  const [txSortAsc, setTxSortAsc] = useState<boolean>(false);

  const handleAttSort = (key: string) => {
    if (attSortKey === key) setAttSortAsc(!attSortAsc);
    else { setAttSortKey(key); setAttSortAsc(true); }
  };

  const handleTxSort = (key: string) => {
    if (txSortKey === key) setTxSortAsc(!txSortAsc);
    else { setTxSortKey(key); setTxSortAsc(false); }
  };

  const sortedAttendanceRows = [...(report?.attendance?.rows || [])].sort((a: any, b: any) => {
    if (['late_minutes', 'early_leave_minutes', 'overtime_minutes'].includes(attSortKey)) {
      const aVal = Number(a[attSortKey] || 0);
      const bVal = Number(b[attSortKey] || 0);
      return attSortAsc ? aVal - bVal : bVal - aVal;
    }
    const aVal = String(a[attSortKey] || '');
    const bVal = String(b[attSortKey] || '');
    return attSortAsc ? aVal.localeCompare(bVal, 'ar') : bVal.localeCompare(aVal, 'ar');
  });

  const sortedTxRows = [...(report?.transactions?.rows || [])].sort((a: any, b: any) => {
    if (txSortKey === 'amount') {
      const aVal = Number(a.amount || 0);
      const bVal = Number(b.amount || 0);
      return txSortAsc ? aVal - bVal : bVal - aVal;
    }
    const aVal = String(a[txSortKey] || '');
    const bVal = String(b[txSortKey] || '');
    return txSortAsc ? aVal.localeCompare(bVal, 'ar') : bVal.localeCompare(aVal, 'ar');
  });

  const attTotals = report?.attendance?.totals || {};
  const penalties = report?.attendance?.penalties || {};
  const txTotals = report?.transactions?.totals || {};
  const computed = report?.computed || {};

  return (
    <div className="space-y-6">
      <div className="p-6 rounded-3xl border border-card shadow-sm card" style={{ backgroundColor: 'var(--card-bg)', color: 'var(--text)' }}>
        <h3 className="font-black mb-4 flex items-center gap-2"><FileText size={18}/> تقرير راتب موظف</h3>
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-3 text-xs">
          <div className="space-y-1">
            <label className="text-[11px] text-muted">الموظف</label>
            <CustomSelect value={String(selectedEmployee || '')} onChange={v => setSelectedEmployee(v)} options={[{ value: '', label: 'اختر موظف' }, ...employees.map((emp:any)=>({ value: String(emp.id), label: emp.name }))]} className="w-full" />
          </div>
          <div className="space-y-1">
            <label className="text-[11px] text-muted">الشهر</label>
            <input type="month" className="bg-slate-50 dark:bg-slate-900 rounded-xl px-3 py-2 border border-slate-200 dark:border-slate-700 w-full" value={month} onChange={e => setMonth(e.target.value)} />
          </div>
          <div className="flex items-end gap-2 lg:col-span-2">
            <button className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-2xl text-xs font-black flex items-center justify-center gap-2" onClick={loadReport} disabled={loading}>
              <RefreshCw size={14}/> {loading ? 'جارٍ التحميل...' : 'عرض التقرير'}
            </button>
            <button className="flex-1 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 py-3 rounded-2xl text-xs font-black" onClick={exportPdf}>
              تصدير PDF
            </button>
            <button className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-2xl text-xs font-black" onClick={exportCSV}>
              تصدير CSV
            </button>
          </div>
        </div>
      </div>

      {report && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
            <div className="p-4 rounded-2xl border border-card shadow-sm card" style={{ backgroundColor: 'var(--card-bg)', color: 'var(--text)' }}>
              <p className="text-[11px] text-muted">الراتب الأساسي</p>
              <p className="text-lg font-black">{Number(computed.base_salary || 0).toLocaleString()}</p>
            </div>
            <div className="p-4 rounded-2xl border border-card shadow-sm card" style={{ backgroundColor: 'var(--card-bg)', color: 'var(--text)' }}>
              <p className="text-[11px] text-muted">إجمالي الخصومات</p>
              <p className="text-lg font-black text-rose-500">{Number(computed.deductions || 0).toLocaleString()}</p>
            </div>
            <div className="p-4 rounded-2xl border border-card shadow-sm card" style={{ backgroundColor: 'var(--card-bg)', color: 'var(--text)' }}>
              <p className="text-[11px] text-muted">إجمالي الحوافز</p>
              <p className="text-lg font-black text-emerald-500">{Number(computed.bonuses || 0).toLocaleString()}</p>
            </div>
            <div className="p-4 rounded-2xl border border-card shadow-sm card" style={{ backgroundColor: 'var(--card-bg)', color: 'var(--text)' }}>
              <p className="text-[11px] text-muted">صافي متوقع</p>
              <p className="text-lg font-black text-blue-600">{Number(computed.net_estimate || 0).toLocaleString()}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="p-6 rounded-3xl border border-card shadow-sm card" style={{ backgroundColor: 'var(--card-bg)', color: 'var(--text)' }}>
              <h4 className="font-black mb-4">ملخص الحضور</h4>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>أيام الحضور: <strong>{attTotals.present_days || 0}</strong></div>
                <div>أيام التأخير: <strong>{attTotals.late_days || 0}</strong></div>
                <div>أيام الغياب: <strong>{attTotals.absent_days || 0}</strong></div>
                <div>أيام العطلات: <strong>{attTotals.holiday_days || 0}</strong></div>
                <div>دقائق التأخير: <strong>{attTotals.late_minutes || 0}</strong></div>
                <div>دقائق الانصراف المبكر: <strong>{attTotals.early_leave_minutes || 0}</strong></div>
                <div>دقائق الإضافي: <strong>{attTotals.overtime_minutes || 0}</strong></div>
              </div>
              <div className="mt-4 text-xs">
                <div>خصم التأخير: <strong>{Number(penalties.late_penalty || 0).toLocaleString()}</strong></div>
                <div>خصم الانصراف المبكر: <strong>{Number(penalties.early_penalty || 0).toLocaleString()}</strong></div>
                <div>خصم الغياب: <strong>{Number(penalties.absence_penalty || 0).toLocaleString()}</strong></div>
                <div>حافز الإضافي: <strong>{Number(penalties.overtime_bonus || 0).toLocaleString()}</strong></div>
              </div>
            </div>

            <div className="p-6 rounded-3xl border border-card shadow-sm card" style={{ backgroundColor: 'var(--card-bg)', color: 'var(--text)' }}>
              <h4 className="font-black mb-4">الخصومات والمستحقات</h4>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>السلف/المسحوبات: <strong>{Number(txTotals.advances || 0).toLocaleString()}</strong></div>
                <div>الحوافز اليدوية: <strong>{Number(txTotals.manual_bonuses || 0).toLocaleString()}</strong></div>
                <div>الخصومات اليدوية: <strong>{Number(txTotals.manual_penalties || 0).toLocaleString()}</strong></div>
                <div>الراتب المدفوع: <strong>{Number(txTotals.salary_paid || 0).toLocaleString()}</strong></div>
              </div>
              {report.salary && (
                <div className="mt-4 text-xs">
                  <div>حالة التسوية: <strong>{report.salary.status === 'paid' ? 'مدفوع' : 'معلق'}</strong></div>
                  <div>قيمة التسوية: <strong>{Number(report.salary.net_salary || 0).toLocaleString()}</strong></div>
                </div>
              )}
            </div>
          </div>

          <div className="p-6 rounded-3xl border border-card shadow-sm card" style={{ backgroundColor: 'var(--card-bg)', color: 'var(--text)' }}>
            <h4 className="font-black mb-4">تفاصيل الحضور اليومي</h4>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-right">
                <thead className="text-muted bg-slate-50 dark:bg-slate-900/30">
                  <tr>
                    <th onClick={() => handleAttSort('work_date')} className="px-3 py-2 cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700 transition select-none group">
                      <div className="flex items-center gap-1"><span>التاريخ</span><span className="text-[10px] text-slate-400 group-hover:text-blue-600">{attSortKey === 'work_date' ? (attSortAsc ? '▲' : '▼') : '↕'}</span></div>
                    </th>
                    <th onClick={() => handleAttSort('shift_name')} className="px-3 py-2 cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700 transition select-none group">
                      <div className="flex items-center gap-1"><span>الوردية</span><span className="text-[10px] text-slate-400 group-hover:text-blue-600">{attSortKey === 'shift_name' ? (attSortAsc ? '▲' : '▼') : '↕'}</span></div>
                    </th>
                    <th onClick={() => handleAttSort('first_in')} className="px-3 py-2 cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700 transition select-none group">
                      <div className="flex items-center gap-1"><span>الدخول</span><span className="text-[10px] text-slate-400 group-hover:text-blue-600">{attSortKey === 'first_in' ? (attSortAsc ? '▲' : '▼') : '↕'}</span></div>
                    </th>
                    <th onClick={() => handleAttSort('last_out')} className="px-3 py-2 cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700 transition select-none group">
                      <div className="flex items-center gap-1"><span>الخروج</span><span className="text-[10px] text-slate-400 group-hover:text-blue-600">{attSortKey === 'last_out' ? (attSortAsc ? '▲' : '▼') : '↕'}</span></div>
                    </th>
                    <th onClick={() => handleAttSort('late_minutes')} className="px-3 py-2 cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700 transition select-none group">
                      <div className="flex items-center gap-1"><span>تأخير</span><span className="text-[10px] text-slate-400 group-hover:text-blue-600">{attSortKey === 'late_minutes' ? (attSortAsc ? '▲' : '▼') : '↕'}</span></div>
                    </th>
                    <th onClick={() => handleAttSort('early_leave_minutes')} className="px-3 py-2 cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700 transition select-none group">
                      <div className="flex items-center gap-1"><span>انصراف مبكر</span><span className="text-[10px] text-slate-400 group-hover:text-blue-600">{attSortKey === 'early_leave_minutes' ? (attSortAsc ? '▲' : '▼') : '↕'}</span></div>
                    </th>
                    <th onClick={() => handleAttSort('overtime_minutes')} className="px-3 py-2 cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700 transition select-none group">
                      <div className="flex items-center gap-1"><span>إضافي</span><span className="text-[10px] text-slate-400 group-hover:text-blue-600">{attSortKey === 'overtime_minutes' ? (attSortAsc ? '▲' : '▼') : '↕'}</span></div>
                    </th>
                    <th onClick={() => handleAttSort('status')} className="px-3 py-2 cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700 transition select-none group">
                      <div className="flex items-center gap-1"><span>الحالة</span><span className="text-[10px] text-slate-400 group-hover:text-blue-600">{attSortKey === 'status' ? (attSortAsc ? '▲' : '▼') : '↕'}</span></div>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sortedAttendanceRows.map((row: any) => (
                    <tr key={row.id} className="border-t border-slate-200/50">
                      <td className="px-3 py-2">{row.work_date}</td>
                      <td className="px-3 py-2">{row.shift_name || '-'}</td>
                      <td className="px-3 py-2">{row.first_in || '-'}</td>
                      <td className="px-3 py-2">{row.last_out || '-'}</td>
                      <td className="px-3 py-2">{row.late_minutes}</td>
                      <td className="px-3 py-2">{row.early_leave_minutes}</td>
                      <td className="px-3 py-2">{row.overtime_minutes}</td>
                      <td className="px-3 py-2">{row.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="p-6 rounded-3xl border border-card shadow-sm card" style={{ backgroundColor: 'var(--card-bg)', color: 'var(--text)' }}>
            <h4 className="font-black mb-4">المعاملات خلال الشهر</h4>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-right">
                <thead className="text-muted bg-slate-50 dark:bg-slate-900/30">
                  <tr>
                    <th onClick={() => handleTxSort('date')} className="px-3 py-2 cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700 transition select-none group" title="فرز تصاعدي / تنازلي">
                      <div className="flex items-center gap-1">
                        <span>التاريخ</span>
                        <span className="text-[10px] text-slate-400 group-hover:text-blue-600">{txSortKey === 'date' ? (txSortAsc ? '▲' : '▼') : '↕'}</span>
                      </div>
                    </th>
                    <th onClick={() => handleTxSort('type')} className="px-3 py-2 cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700 transition select-none group" title="فرز تصاعدي / تنازلي">
                      <div className="flex items-center gap-1">
                        <span>النوع</span>
                        <span className="text-[10px] text-slate-400 group-hover:text-blue-600">{txSortKey === 'type' ? (txSortAsc ? '▲' : '▼') : '↕'}</span>
                      </div>
                    </th>
                    <th onClick={() => handleTxSort('amount')} className="px-3 py-2 cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700 transition select-none group" title="فرز تصاعدي / تنازلي">
                      <div className="flex items-center gap-1">
                        <span>المبلغ</span>
                        <span className="text-[10px] text-slate-400 group-hover:text-blue-600">{txSortKey === 'amount' ? (txSortAsc ? '▲' : '▼') : '↕'}</span>
                      </div>
                    </th>
                    <th onClick={() => handleTxSort('notes')} className="px-3 py-2 cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700 transition select-none group" title="فرز تصاعدي / تنازلي">
                      <div className="flex items-center gap-1">
                        <span>ملاحظات</span>
                        <span className="text-[10px] text-slate-400 group-hover:text-blue-600">{txSortKey === 'notes' ? (txSortAsc ? '▲' : '▼') : '↕'}</span>
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sortedTxRows.map((tx: any) => (
                    <tr key={tx.id} className="border-t border-slate-200/50 hover:bg-slate-50 dark:hover:bg-slate-700/30">
                      <td className="px-3 py-2 font-mono">{tx.date}</td>
                      <td className="px-3 py-2">
                        {tx.type === 'advance' && 'سلفة'}
                        {tx.type === 'bonus' && 'حافز'}
                        {tx.type === 'penalty' && 'خصم'}
                        {tx.type === 'salary' && 'راتب'}
                      </td>
                      <td className="px-3 py-2 font-black">{Number(tx.amount || 0).toLocaleString()}</td>
                      <td className="px-3 py-2">{tx.notes || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmployeeSalaryReport;
