import React, { useEffect, useState, useMemo } from 'react';
import { API_BASE_PATH } from '../services/apiConfig';
import { translateTxnLabel } from '../services/labelHelpers';
import Swal from 'sweetalert2';

const formatDate = (d: Date) => d.toISOString().slice(0,10);

const TotalsReport: React.FC = () => {
  const today = new Date();
  const firstDay = new Date(); firstDay.setDate(firstDay.getDate() - 7);
  const [startDate, setStartDate] = useState<string>(formatDate(firstDay));
  const [endDate, setEndDate] = useState<string>(formatDate(today));
  const [treasuries, setTreasuries] = useState<any[]>([]);
  const [treasuryId, setTreasuryId] = useState<string>('');
  const [loading, setLoading] = useState(false);

  // Finance data
  const [startingBalance, setStartingBalance] = useState<number>(0);
  const [endBalance, setEndBalance] = useState<number>(0);
  const [records, setRecords] = useState<any[]>([]);

  // Real order stats per day
  const [perDayStats, setPerDayStats] = useState<any[]>([]);
  const [orderTotals, setOrderTotals] = useState<any>({
    delivered_orders:0, returned_orders:0, delivered_pieces:0, returned_pieces:0,
    delivered_amount:0, returned_amount:0, pending_orders:0,
  });

  // Rep assigned journal stats
  const [assignedToRepsStats, setAssignedToRepsStats] = useState<any[]>([]);

  const [companySettings, setCompanySettings] = useState<any>({ name: 'DragonPro', address: '', phone: '', logo: '' });

  useEffect(() => {
    const loadTreasuries = async () => {
      try {
        const res = await fetch(`${API_BASE_PATH}/api.php?module=treasuries&action=getAll`);
        const data = await res.json();
        if (data && data.success) setTreasuries(data.data || []);
      } catch { setTreasuries([]); }
    };
    const loadSettings = async () => {
      try {
        const res = await fetch(`${API_BASE_PATH}/api.php?module=settings&action=get_settings`);
        const j = await res.json();
        if (j && j.success) {
          const compName = j.data.find((f:any) => f.setting_key==='company_name')?.setting_value || 'DragonPro';
          const compAddress = j.data.find((f:any) => f.setting_key==='company_address')?.setting_value || '';
          const compPhone = j.data.find((f:any) => f.setting_key==='company_phone')?.setting_value || '';
          let compLogo = j.data.find((f:any) => f.setting_key==='company_logo')?.setting_value || '';
          if (compLogo && !compLogo.startsWith('http') && !compLogo.startsWith('data:')) compLogo = `${API_BASE_PATH}/${compLogo}`;
          setCompanySettings({ name: compName, address: compAddress, phone: compPhone, logo: compLogo });
        }
      } catch { /* ignore */ }
    };
    loadTreasuries();
    loadSettings();
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const treasuryQuery = treasuryId ? `&treasury_id=${encodeURIComponent(treasuryId)}` : '';

      // ── 1. Finance (treasury transactions) ──────────────────────────
      const finUrl = `${API_BASE_PATH}/api.php?module=reports&action=finance&start_date=${startDate}&end_date=${endDate}${treasuryQuery}`;
      const finRes = await fetch(finUrl).then(r => r.json()).catch(() => null);
      if (finRes && finRes.success) {
        setStartingBalance(Number(finRes.data.starting_balance || 0));
        const th = finRes.data.treasuryBalanceHistory || [];
        setEndBalance(th.length ? Number(th[th.length-1].balance) : Number(finRes.data.starting_balance || 0));
        setRecords(finRes.data.revenueAndExpenseRecords || []);
      } else {
        setStartingBalance(0); setEndBalance(0); setRecords([]);
      }

      // ── 2. Real order stats per day ──────────────────────────────────
      const statsUrl = `${API_BASE_PATH}/api.php?module=reports&action=getOrderStats&start_date=${startDate}&end_date=${endDate}`;
      const statsRes = await fetch(statsUrl).then(r => r.json()).catch(() => null);
      if (statsRes && statsRes.success) {
        setPerDayStats(statsRes.data.per_day || []);
        setOrderTotals(statsRes.data.totals || {});
      } else {
        setPerDayStats([]); setOrderTotals({});
      }

      // ── 3. Rep assigned journal ──────────────────────────────────────
      try {
        const repUrl = `${API_BASE_PATH}/api.php?module=sales&action=getRepDailyJournal&from=${startDate}&to=${endDate}`;
        const repRes = await fetch(repUrl).then(r => r.json()).catch(() => null);
        if (repRes && repRes.success && Array.isArray(repRes.data)) {
          const grouped: Record<string, any> = {};
          repRes.data.forEach((row: any) => {
            const d = String(row.journal_date || row.created_at || '').slice(0, 10);
            if (!d) return;
            if (!grouped[d]) grouped[d] = { date: d, orders: 0, pieces: 0 };
            grouped[d].orders += Number(row.orders_assigned_count || 0);
            grouped[d].pieces += Number(row.pieces_assigned_count || 0);
          });
          setAssignedToRepsStats(Object.values(grouped));
        } else {
          setAssignedToRepsStats([]);
        }
      } catch { setAssignedToRepsStats([]); }

    } catch (e) {
      console.error('TotalsReport load error', e);
      Swal.fire('خطأ', 'فشل تحميل ملخص الفترة.', 'error');
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  // Finance totals
  const finTotals = useMemo(() => {
    let totalIn = 0, totalOut = 0;
    records.forEach((r: any) => {
      const amt = Number(r.amount || 0);
      if (amt > 0) totalIn += amt; else totalOut += Math.abs(amt);
    });
    return { totalIn, totalOut };
  }, [records]);

  // Rep stats totals
  const repTotals = useMemo(() => ({
    orders: assignedToRepsStats.reduce((s, d) => s + Number(d.orders || 0), 0),
    pieces: assignedToRepsStats.reduce((s, d) => s + Number(d.pieces || 0), 0),
  }), [assignedToRepsStats]);

  // Merged per-day for table
  const tableRows = useMemo(() => {
    return perDayStats.map((day: any) => {
      const repDay = assignedToRepsStats.find(r => r.date === day.date);
      return {
        ...day,
        rep_orders: repDay?.orders || 0,
        rep_pieces: repDay?.pieces || 0,
      };
    });
  }, [perDayStats, assignedToRepsStats]);

  function exportCSV() {
    if (!tableRows.length) { Swal.fire('تنبيه', 'لا توجد بيانات للتصدير', 'info'); return; }
    const headers = ['التاريخ','أوردرات مسلَّمة','أوردرات مرتجعة','للمناديب','قطع للمناديب','قطع مسلَّمة','قطع مرتجعة','مبيعات','مرتجعات'];
    const rows = tableRows.map((d: any) => [
      d.date, d.delivered_orders, d.returned_orders, d.rep_orders, d.rep_pieces,
      d.delivered_pieces, d.returned_pieces,
      Number(d.delivered_amount||0).toFixed(2), Number(d.returned_amount||0).toFixed(2)
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `totals_${startDate}_to_${endDate}.csv`;
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

    const rowsHtml = tableRows.map((d: any) => `
      <tr>
        <td>${d.date}</td>
        <td style="text-align:center">${d.delivered_orders}</td>
        <td style="text-align:center">${d.returned_orders}</td>
        <td style="text-align:center">${d.rep_orders}</td>
        <td style="text-align:center">${d.rep_pieces}</td>
        <td style="text-align:center">${d.delivered_pieces}</td>
        <td style="text-align:center">${d.returned_pieces}</td>
        <td style="text-align:left">${Number(d.delivered_amount||0).toLocaleString()}</td>
        <td style="text-align:left">${Number(d.returned_amount||0).toLocaleString()}</td>
      </tr>`).join('');

    const html = `<!doctype html><html><head><meta charset="utf-8"><title>ملخص الفترة ${startDate} - ${endDate}</title>
      <style>body{font-family:Arial,"Noto Naskh Arabic",sans-serif;direction:rtl;padding:20px;} table{width:100%;border-collapse:collapse;font-size:12px;} th,td{border:1px solid #333;padding:5px;text-align:right;} th{background:#f3f4f6;} .summary div{margin:3px 0;font-size:13px;}</style>
      </head><body>
      ${headerSection}
      <h1 style="text-align:center">ملخص الفترة</h1>
      <div>الفترة: ${startDate} — ${endDate}</div>
      <div class="summary" style="margin:12px 0;padding:10px;background:#f8f9fa;border-radius:6px;">
        <div>رصيد البداية: <strong>${startingBalance.toLocaleString()}</strong></div>
        <div>رصيد النهاية: <strong>${endBalance.toLocaleString()}</strong></div>
        <div>إجمالي أوردرات مسلَّمة: <strong>${(orderTotals.delivered_orders||0).toLocaleString()}</strong></div>
        <div>إجمالي أوردرات مرتجعة: <strong>${(orderTotals.returned_orders||0).toLocaleString()}</strong></div>
        <div>إجمالي قطع مسلَّمة: <strong>${(orderTotals.delivered_pieces||0).toLocaleString()}</strong></div>
        <div>إجمالي مبيعات (مسلَّمة): <strong>${Number(orderTotals.delivered_amount||0).toLocaleString()}</strong></div>
        <div>إجمالي مرتجعات: <strong>${Number(orderTotals.returned_amount||0).toLocaleString()}</strong></div>
      </div>
      <table><thead><tr>
        <th>التاريخ</th><th>أوردرات مسلَّمة</th><th>أوردرات مرتجعة</th>
        <th>للمناديب</th><th>قطع للمناديب</th>
        <th>قطع مسلَّمة</th><th>قطع مرتجعة</th>
        <th>مبيعات</th><th>مرتجعات</th>
      </tr></thead><tbody>${rowsHtml}</tbody></table>
      </body></html>`;
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(html); w.document.close();
    setTimeout(() => w.print(), 500);
  }

  const kpiClass = "p-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-right";

  return (
    <div className="space-y-5">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm font-bold text-slate-600 dark:text-slate-300">الخزينة</label>
        <select value={treasuryId} onChange={e => setTreasuryId(e.target.value)}
          className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl p-2 min-w-[160px]" dir="rtl">
          <option value="">كل الخزائن</option>
          {treasuries.map((t: any) => <option key={t.id} value={String(t.id)}>{t.name}</option>)}
        </select>
        <label className="text-sm font-bold text-slate-600 dark:text-slate-300">من</label>
        <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
          className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl p-2" />
        <label className="text-sm font-bold text-slate-600 dark:text-slate-300">إلى</label>
        <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
          className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl p-2" />
        <button onClick={load} disabled={loading}
          className="px-4 py-2 bg-blue-600 text-white rounded-xl font-bold disabled:opacity-60">
          {loading ? 'تحميل...' : 'تحديث'}
        </button>
        <button onClick={exportCSV} className="px-4 py-2 bg-sky-600 text-white rounded-xl font-bold">تصدير CSV</button>
        <button onClick={printReport} className="px-4 py-2 bg-emerald-600 text-white rounded-xl font-bold">طباعة</button>
      </div>

      {/* Finance KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className={kpiClass}><div className="text-xs text-slate-500 mb-1">رصيد البداية</div><div className="text-xl font-black">{startingBalance.toLocaleString()}</div></div>
        <div className={kpiClass}><div className="text-xs text-slate-500 mb-1">إجمالي الوارد</div><div className="text-xl font-black text-emerald-600">{finTotals.totalIn.toLocaleString()}</div></div>
        <div className={kpiClass}><div className="text-xs text-slate-500 mb-1">إجمالي الصادر</div><div className="text-xl font-black text-rose-600">{finTotals.totalOut.toLocaleString()}</div></div>
        <div className={kpiClass}><div className="text-xs text-slate-500 mb-1">رصيد النهاية</div><div className="text-xl font-black text-blue-600">{endBalance.toLocaleString()}</div></div>
      </div>

      {/* Orders KPIs — Real data */}
      <div>
        <h3 className="text-sm font-black text-slate-700 dark:text-slate-200 mb-2">إحصائيات الأوردرات الفعلية</h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className={kpiClass}><div className="text-xs text-slate-500 mb-1">أوردرات مسلَّمة</div><div className="text-xl font-black text-emerald-600">{(orderTotals.delivered_orders||0).toLocaleString()}</div></div>
          <div className={kpiClass}><div className="text-xs text-slate-500 mb-1">أوردرات مرتجعة</div><div className="text-xl font-black text-rose-600">{(orderTotals.returned_orders||0).toLocaleString()}</div></div>
          <div className={kpiClass}><div className="text-xs text-slate-500 mb-1">قطع مسلَّمة</div><div className="text-xl font-black text-emerald-600">{(orderTotals.delivered_pieces||0).toLocaleString()}</div></div>
          <div className={kpiClass}><div className="text-xs text-slate-500 mb-1">قطع مرتجعة</div><div className="text-xl font-black text-rose-600">{(orderTotals.returned_pieces||0).toLocaleString()}</div></div>
          <div className={kpiClass}><div className="text-xs text-slate-500 mb-1">مبيعات مسلَّمة</div><div className="text-xl font-black text-emerald-700">{Number(orderTotals.delivered_amount||0).toLocaleString()}</div></div>
          <div className={kpiClass}><div className="text-xs text-slate-500 mb-1">مرتجعات (مبلغ)</div><div className="text-xl font-black text-rose-700">{Number(orderTotals.returned_amount||0).toLocaleString()}</div></div>
          <div className={kpiClass}><div className="text-xs text-slate-500 mb-1">للمناديب (أوردرات)</div><div className="text-xl font-black text-blue-600">{repTotals.orders.toLocaleString()}</div></div>
          <div className={kpiClass}><div className="text-xs text-slate-500 mb-1">للمناديب (قطع)</div><div className="text-xl font-black text-blue-600">{repTotals.pieces.toLocaleString()}</div></div>
        </div>
      </div>

      {/* Per-day Table */}
      <div>
        <h3 className="text-sm font-black text-slate-700 dark:text-slate-200 mb-2">تفاصيل يومية</h3>
        <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-700">
          <table className="w-full text-sm text-right">
            <thead className="bg-slate-50 dark:bg-slate-900/30 text-slate-500 dark:text-slate-400">
              <tr>
                <th className="px-3 py-3 font-semibold">التاريخ</th>
                <th className="px-3 py-3 font-semibold">أوردرات مسلَّمة</th>
                <th className="px-3 py-3 font-semibold">أوردرات مرتجعة</th>
                <th className="px-3 py-3 font-semibold">للمناديب</th>
                <th className="px-3 py-3 font-semibold">قطع للمناديب</th>
                <th className="px-3 py-3 font-semibold">قطع مسلَّمة</th>
                <th className="px-3 py-3 font-semibold">قطع مرتجعة</th>
                <th className="px-3 py-3 font-semibold">مبيعات</th>
                <th className="px-3 py-3 font-semibold">مرتجعات</th>
              </tr>
            </thead>
            <tbody className="divide-y dark:divide-slate-700">
              {loading ? (
                <tr><td colSpan={9} className="py-8 text-center text-slate-400">جارٍ التحميل...</td></tr>
              ) : tableRows.length === 0 ? (
                <tr><td colSpan={9} className="py-8 text-center text-slate-400">لا توجد بيانات للفترة المحددة.</td></tr>
              ) : tableRows.map((d: any) => (
                <tr key={d.date} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                  <td className="px-3 py-3 font-bold">{d.date}</td>
                  <td className="px-3 py-3 text-center">
                    <span className="bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 px-2 py-0.5 rounded-full text-xs font-bold">{d.delivered_orders || 0}</span>
                  </td>
                  <td className="px-3 py-3 text-center">
                    <span className="bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400 px-2 py-0.5 rounded-full text-xs font-bold">{d.returned_orders || 0}</span>
                  </td>
                  <td className="px-3 py-3 text-center">{d.rep_orders || 0}</td>
                  <td className="px-3 py-3 text-center">{d.rep_pieces || 0}</td>
                  <td className="px-3 py-3 text-center">{d.delivered_pieces || 0}</td>
                  <td className="px-3 py-3 text-center">{d.returned_pieces || 0}</td>
                  <td className="px-3 py-3 font-bold text-emerald-600 dark:text-emerald-400">{Number(d.delivered_amount||0).toLocaleString()}</td>
                  <td className="px-3 py-3 font-bold text-rose-600 dark:text-rose-400">{Number(d.returned_amount||0).toLocaleString()}</td>
                </tr>
              ))}
              {/* Totals row */}
              {tableRows.length > 0 && (
                <tr className="bg-slate-100 dark:bg-slate-700/50 font-black">
                  <td className="px-3 py-3">الإجمالي</td>
                  <td className="px-3 py-3 text-center text-emerald-700">{(orderTotals.delivered_orders||0).toLocaleString()}</td>
                  <td className="px-3 py-3 text-center text-rose-700">{(orderTotals.returned_orders||0).toLocaleString()}</td>
                  <td className="px-3 py-3 text-center">{repTotals.orders.toLocaleString()}</td>
                  <td className="px-3 py-3 text-center">{repTotals.pieces.toLocaleString()}</td>
                  <td className="px-3 py-3 text-center">{(orderTotals.delivered_pieces||0).toLocaleString()}</td>
                  <td className="px-3 py-3 text-center">{(orderTotals.returned_pieces||0).toLocaleString()}</td>
                  <td className="px-3 py-3 text-emerald-700">{Number(orderTotals.delivered_amount||0).toLocaleString()}</td>
                  <td className="px-3 py-3 text-rose-700">{Number(orderTotals.returned_amount||0).toLocaleString()}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default TotalsReport;
