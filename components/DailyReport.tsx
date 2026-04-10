import React, { useEffect, useState, useMemo } from 'react';
import { API_BASE_PATH } from '../services/apiConfig';
import { translateTxnLabel } from '../services/labelHelpers';
import Swal from 'sweetalert2';

const formatDate = (d: Date) => d.toISOString().slice(0,10);

const DailyReport: React.FC = () => {
  const today = new Date();
  const [date, setDate] = useState<string>(formatDate(today));
  const [loading, setLoading] = useState(false);

  // Treasury / finance data
  const [records, setRecords] = useState<any[]>([]);
  const [startingBalance, setStartingBalance] = useState<number>(0);
  const [endBalance, setEndBalance] = useState<number>(0);

  // Real order stats from orders table
  const [orderStats, setOrderStats] = useState<any>({
    delivered_orders: 0, returned_orders: 0,
    delivered_pieces: 0, returned_pieces: 0,
    delivered_amount: 0, returned_amount: 0,
    pending_orders: 0,
  });

  // Archives
  const [archives, setArchives] = useState<any[]>([]);
  const [archivesLoading, setArchivesLoading] = useState(false);

  // Reps daily journal
  const [assignedToRepsStats, setAssignedToRepsStats] = useState<{ orders: number; pieces: number }>({ orders: 0, pieces: 0 });

  // Company settings for print
  const [companySettings, setCompanySettings] = useState<any>({ name: 'DragonPro', address: '', phone: '', logo: '' });

  useEffect(() => { load(); loadArchives(); }, [date]);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const res = await fetch(`${API_BASE_PATH}/api.php?module=settings&action=get_settings`);
        const j = await res.json();
        if (j && j.success) {
          const compName = j.data.find((f:any) => f.setting_key === 'company_name')?.setting_value || 'DragonPro';
          const compAddress = j.data.find((f:any) => f.setting_key === 'company_address')?.setting_value || '';
          const compPhone = j.data.find((f:any) => f.setting_key === 'company_phone')?.setting_value || '';
          let compLogo = j.data.find((f:any) => f.setting_key === 'company_logo')?.setting_value || '';
          if (compLogo && !compLogo.startsWith('http') && !compLogo.startsWith('data:')) compLogo = `${API_BASE_PATH}/${compLogo}`;
          setCompanySettings({ name: compName, address: compAddress, phone: compPhone, logo: compLogo });
        }
      } catch (e) { console.error('Failed loading settings', e); }
    };
    loadSettings();
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      // ── 1. Finance data (treasury transactions) ─────────────────────
      const finUrl = `${API_BASE_PATH}/api.php?module=reports&action=finance&start_date=${date}&end_date=${date}`;
      const finRes = await fetch(finUrl).then(r => r.json()).catch(() => null);
      if (finRes && finRes.success) {
        setStartingBalance(Number(finRes.data.starting_balance || 0));
        const th = finRes.data.treasuryBalanceHistory || [];
        setEndBalance(th.length ? Number(th[th.length - 1].balance) : Number(finRes.data.starting_balance || 0));
        setRecords(finRes.data.revenueAndExpenseRecords || []);
      } else {
        setStartingBalance(0); setEndBalance(0); setRecords([]);
      }

      // ── 2. Real order stats ──────────────────────────────────────────
      const statsUrl = `${API_BASE_PATH}/api.php?module=reports&action=getOrderStats&start_date=${date}&end_date=${date}`;
      const statsRes = await fetch(statsUrl).then(r => r.json()).catch(() => null);
      if (statsRes && statsRes.success) {
        setOrderStats(statsRes.data.totals || {});
      } else {
        setOrderStats({ delivered_orders:0, returned_orders:0, delivered_pieces:0, returned_pieces:0, delivered_amount:0, returned_amount:0, pending_orders:0 });
      }

      // ── 3. Rep daily journal (assigned orders/pieces) ────────────────
      try {
        const jUrl = `${API_BASE_PATH}/api.php?module=sales&action=getRepDailyJournal&from=${date}&to=${date}`;
        const jj = await fetch(jUrl).then(r => r.json()).catch(() => null);
        if (jj && jj.success && Array.isArray(jj.data)) {
          const orders = jj.data.reduce((s: number, r: any) => s + Number(r.orders_assigned_count || 0), 0);
          const pieces = jj.data.reduce((s: number, r: any) => s + Number(r.pieces_assigned_count || 0), 0);
          setAssignedToRepsStats({ orders, pieces });
        } else {
          setAssignedToRepsStats({ orders: 0, pieces: 0 });
        }
      } catch { setAssignedToRepsStats({ orders: 0, pieces: 0 }); }

    } catch (e) {
      console.error('DailyReport load error', e);
      Swal.fire('خطأ', 'فشل تحميل تقرير اليومية.', 'error');
    } finally { setLoading(false); }
  };

  const loadArchives = async () => {
    setArchivesLoading(true);
    try {
      const url = `${API_BASE_PATH}/api.php?module=reports&action=archives&start_date=${date}&end_date=${date}&include_html=1`;
      const j = await fetch(url).then(r => r.json()).catch(() => null);
      setArchives((j && j.success) ? (j.data || []) : []);
    } catch { setArchives([]); } finally { setArchivesLoading(false); }
  };

  // Finance totals from transactions
  const finTotals = useMemo(() => {
    let totalIn = 0, totalOut = 0;
    records.forEach((r: any) => {
      const amt = Number(r.amount || 0);
      if (amt > 0) totalIn += amt;
      else totalOut += Math.abs(amt);
    });
    return { totalIn, totalOut };
  }, [records]);

  function exportCSV() {
    if (!records.length) { Swal.fire('تنبيه', 'لا توجد بيانات للتصدير', 'info'); return; }
    const headers = ['التاريخ','النوع','الوصف','المبلغ','الخزينة'];
    const rows = records.map((r:any) => [r.date||'', translateTxnLabel(r.type, r.desc, r.txn_type), r.desc||'', Number(r.amount||0).toString(), r.treasury||'']);
    const csv = [headers.join(','), ...rows.map(rr => rr.map(c => `"${String(c).replace(/"/g,'""')}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `daily_report_${date}.csv`;
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  }

  function printReport() {
    const headerSection = `
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px;border-bottom:2px solid #eee;padding-bottom:10px;">
        <div style="text-align:right;">
          <h2 style="margin:0;font-size:20px;">${companySettings.name}</h2>
          ${companySettings.address ? `<div style="font-size:14px;margin-top:4px;color:#555;">${companySettings.address}</div>` : ''}
          ${companySettings.phone ? `<div style="font-size:14px;margin-top:2px;color:#555;">هاتف: ${companySettings.phone}</div>` : ''}
        </div>
        ${companySettings.logo ? `<div><img src="${companySettings.logo}" alt="Logo" style="max-width:100px;max-height:100px;object-fit:contain;"></div>` : ''}
      </div>`;

    const statsHtml = `
      <div style="background:#f8f9fa;padding:12px;border-radius:8px;margin-bottom:16px;">
        <h3 style="margin:0 0 8px;">إحصائيات الأوردرات (${date})</h3>
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;font-size:13px;">
          <div>أوردرات مسلَّمة: <strong>${(orderStats.delivered_orders||0).toLocaleString()}</strong></div>
          <div>أوردرات مرتجعة: <strong>${(orderStats.returned_orders||0).toLocaleString()}</strong></div>
          <div>قطع مسلَّمة: <strong>${(orderStats.delivered_pieces||0).toLocaleString()}</strong></div>
          <div>قطع مرتجعة: <strong>${(orderStats.returned_pieces||0).toLocaleString()}</strong></div>
          <div>مبيعات مسلَّمة: <strong>${Number(orderStats.delivered_amount||0).toLocaleString()}</strong></div>
          <div>مرتجعات: <strong>${Number(orderStats.returned_amount||0).toLocaleString()}</strong></div>
          <div>أوردرات للمناديب: <strong>${(assignedToRepsStats.orders||0).toLocaleString()}</strong></div>
          <div>قطع للمناديب: <strong>${(assignedToRepsStats.pieces||0).toLocaleString()}</strong></div>
        </div>
      </div>`;

    const txnRows = records.map(r => `<tr><td>${r.date||''}</td><td>${translateTxnLabel(r.type, r.desc, r.txn_type)}</td><td>${r.desc||''}</td><td style="text-align:left">${Number(r.amount||0).toLocaleString()}</td><td>${r.treasury||''}</td></tr>`).join('');

    const html = `<!doctype html><html><head><meta charset="utf-8"><title>تقرير اليومية ${date}</title>
      <style>body{font-family:Arial,"Noto Naskh Arabic",sans-serif;direction:rtl;padding:20px;} table{width:100%;border-collapse:collapse;font-size:12px;} th,td{border:1px solid #333;padding:6px;text-align:right;} th{background:#f3f4f6;}</style>
      </head><body>
      ${headerSection}
      <h1 style="text-align:center">تقرير اليومية</h1>
      <div>التاريخ: ${date}</div>
      <div style="margin:8px 0"><strong>رصيد البداية:</strong> ${startingBalance.toLocaleString()} &nbsp;&nbsp; <strong>رصيد النهاية:</strong> ${endBalance.toLocaleString()}</div>
      <div style="margin:4px 0"><strong>إجمالي الوارد:</strong> ${finTotals.totalIn.toLocaleString()} &nbsp;&nbsp; <strong>إجمالي الصادر:</strong> ${finTotals.totalOut.toLocaleString()}</div>
      ${statsHtml}
      <table><thead><tr><th>التاريخ</th><th>النوع</th><th>الوصف</th><th>المبلغ</th><th>الخزينة</th></tr></thead>
      <tbody>${txnRows}</tbody></table>
      </body></html>`;
    const w = window.open('', '_blank', 'width=900,height=700');
    if (!w) return;
    w.document.write(html); w.document.close();
    setTimeout(() => w.print(), 500);
  }

  const kpiClass = "p-4 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 text-right bg-white dark:bg-slate-800";

  return (
    <div className="space-y-5">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm font-bold text-slate-600 dark:text-slate-300">اختر التاريخ</label>
        <input type="date" value={date} onChange={e => setDate(e.target.value)}
          className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl p-2" />
        <button onClick={load} disabled={loading}
          className="px-4 py-2 bg-blue-600 text-white rounded-xl font-bold disabled:opacity-60">
          {loading ? 'جارٍ التحميل...' : 'تحديث'}
        </button>
        <button onClick={exportCSV} className="px-4 py-2 bg-sky-600 text-white rounded-xl font-bold">تصدير CSV</button>
        <button onClick={printReport} className="px-4 py-2 bg-emerald-600 text-white rounded-xl font-bold">طباعة</button>
      </div>

      {/* Finance KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'رصيد البداية', value: startingBalance, color: 'text-slate-700 dark:text-slate-200' },
          { label: 'إجمالي الوارد', value: finTotals.totalIn, color: 'text-emerald-600 dark:text-emerald-400' },
          { label: 'إجمالي الصادر', value: finTotals.totalOut, color: 'text-rose-600 dark:text-rose-400' },
          { label: 'رصيد النهاية', value: endBalance, color: 'text-blue-700 dark:text-blue-300' },
        ].map(k => (
          <div key={k.label} className={kpiClass}>
            <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">{k.label}</div>
            <div className={`text-xl font-black ${k.color}`}>{k.value.toLocaleString()}</div>
          </div>
        ))}
      </div>

      {/* Order Stats KPIs — real data from orders table */}
      <div>
        <h3 className="text-sm font-black text-slate-700 dark:text-slate-200 mb-2">إحصائيات الأوردرات الفعلية</h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: 'أوردرات مسلَّمة', value: orderStats.delivered_orders || 0, color: 'text-emerald-600' },
            { label: 'أوردرات مرتجعة', value: orderStats.returned_orders || 0, color: 'text-rose-600' },
            { label: 'قطع مسلَّمة', value: orderStats.delivered_pieces || 0, color: 'text-emerald-600' },
            { label: 'قطع مرتجعة', value: orderStats.returned_pieces || 0, color: 'text-rose-600' },
            { label: 'مبيعات مسلَّمة', value: Number(orderStats.delivered_amount || 0), color: 'text-emerald-700', isCur: true },
            { label: 'مرتجعات (مبلغ)', value: Number(orderStats.returned_amount || 0), color: 'text-rose-700', isCur: true },
            { label: 'أوردرات للمناديب', value: assignedToRepsStats.orders, color: 'text-blue-600' },
            { label: 'قطع للمناديب', value: assignedToRepsStats.pieces, color: 'text-blue-600' },
          ].map(k => (
            <div key={k.label} className={kpiClass}>
              <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">{k.label}</div>
              <div className={`text-xl font-black ${k.color}`}>
                {(k as any).isCur ? Number(k.value).toLocaleString() : Number(k.value).toLocaleString()}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Transactions table */}
      <div>
        <h3 className="text-sm font-black text-slate-700 dark:text-slate-200 mb-2">سجل حركات الخزينة</h3>
        <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-700">
          <table className="w-full text-sm text-right">
            <thead className="bg-slate-50 dark:bg-slate-900/30 text-slate-500 dark:text-slate-400">
              <tr>
                <th className="px-4 py-3 font-semibold">التاريخ</th>
                <th className="px-4 py-3 font-semibold">النوع</th>
                <th className="px-4 py-3 font-semibold">الوصف</th>
                <th className="px-4 py-3 font-semibold">المبلغ</th>
                <th className="px-4 py-3 font-semibold">الخزينة</th>
              </tr>
            </thead>
            <tbody className="divide-y dark:divide-slate-700">
              {loading ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">جارٍ التحميل...</td></tr>
              ) : records.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">لا توجد حركات مالية في هذا اليوم.</td></tr>
              ) : records.map((r: any, idx: number) => (
                <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                  <td className="px-4 py-3">{r.date}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-lg text-[11px] font-bold ${Number(r.amount||0) >= 0 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400'}`}>
                      {translateTxnLabel(r.type, r.desc, r.txn_type)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-300">{r.desc || '—'}</td>
                  <td className={`px-4 py-3 font-black ${Number(r.amount||0) >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                    {Number(r.amount||0).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-xs">{r.treasury || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Archives */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-black text-slate-700 dark:text-slate-200">أرشيف التقارير اليومية</h3>
          <button onClick={loadArchives} className="px-3 py-1.5 bg-slate-700 text-white rounded-xl text-xs font-bold">تحديث</button>
        </div>
        {archivesLoading ? (
          <div className="text-sm text-slate-400">جارٍ تحميل الأرشيف...</div>
        ) : archives.length === 0 ? (
          <div className="text-sm text-slate-400">لا توجد تقارير مؤرشفة لهذا اليوم.</div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-700">
            <table className="w-full text-sm text-right">
              <thead className="bg-slate-50 dark:bg-slate-900/30 text-slate-500">
                <tr>
                  <th className="px-4 py-3">التاريخ</th><th className="px-4 py-3">النوع</th>
                  <th className="px-4 py-3">الأقسام</th><th className="px-4 py-3">الحالة</th>
                  <th className="px-4 py-3">عرض</th>
                </tr>
              </thead>
              <tbody className="divide-y dark:divide-slate-700">
                {archives.map((a: any) => (
                  <tr key={a.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30">
                    <td className="px-4 py-3">{a.report_date}</td>
                    <td className="px-4 py-3">{a.report_type}</td>
                    <td className="px-4 py-3 text-xs">{(() => { try { return (JSON.parse(a.sections || '[]') || []).join(', '); } catch { return a.sections || ''; } })()}</td>
                    <td className="px-4 py-3">{Number(a.sent) === 1 ? 'تم الإرسال' : 'غير مرسل'}</td>
                    <td className="px-4 py-3">
                      <button onClick={() => { const w = window.open('','_blank','width=1000,height=800'); if(w){w.document.write(a.html);w.document.close();} }}
                        className="px-3 py-1 bg-blue-600 text-white rounded-lg text-xs">عرض</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default DailyReport;
