import React, { useEffect, useState } from 'react';
import { API_BASE_PATH } from '../services/apiConfig';
import Swal from 'sweetalert2';
import { translateTxnLabel } from '../services/labelHelpers';

const formatDate = (d: Date) => d.toISOString().slice(0,10);

const DailyReport: React.FC = () => {
  const today = new Date();
  const [date, setDate] = useState<string>(formatDate(today));
  const [loading, setLoading] = useState(false);
  const [treasuryHistory, setTreasuryHistory] = useState<any[]>([]);
  const [startingBalance, setStartingBalance] = useState<number | null>(null);
  const [records, setRecords] = useState<any[]>([]);
  const [ordersMap, setOrdersMap] = useState<Record<number, any>>({});
  const [archives, setArchives] = useState<any[]>([]);
  const [archivesLoading, setArchivesLoading] = useState(false);

  useEffect(() => { load(); }, [date]);
  useEffect(() => { loadArchives(); }, [date]);

  const load = async () => {
    setLoading(true);
    try {
      // load all orders to map order products
      try {
        const or = await fetch(`${API_BASE_PATH}/api.php?module=orders&action=getAll`);
        const jor = await or.json();
        if (jor && jor.success) {
          const map: Record<number, any> = {};
          (jor.data||[]).forEach((o:any)=> { map[o.id] = o; });
          setOrdersMap(map);
        }
      } catch(e) { console.debug('Failed to load orders for daily report', e); }

      const url = `${API_BASE_PATH}/api.php?module=reports&action=finance&start_date=${date}&end_date=${date}`;
      const r = await fetch(url);
      const j = await r.json();
      if (j && j.success) {
        setStartingBalance(typeof j.data.starting_balance !== 'undefined' ? Number(j.data.starting_balance) : null);
        setTreasuryHistory(j.data.treasuryBalanceHistory || []);
        setRecords(j.data.revenueAndExpenseRecords || []);
      } else {
        setTreasuryHistory([]);
        setRecords([]);
        Swal.fire('تنبيه', 'لا توجد بيانات لليوم المحدد.', 'info');
      }
    } catch (e) {
      console.error('Failed to load daily report', e);
      Swal.fire('خطأ', 'فشل تحميل تقرير اليومية. راجع الكونسول.', 'error');
    } finally { setLoading(false); }
  };

  const loadArchives = async () => {
    setArchivesLoading(true);
    try {
      const url = `${API_BASE_PATH}/api.php?module=reports&action=archives&start_date=${date}&end_date=${date}&include_html=1`;
      const r = await fetch(url);
      const j = await r.json();
      if (j && j.success) {
        setArchives(j.data || []);
      } else {
        setArchives([]);
      }
    } catch (e) {
      setArchives([]);
    } finally {
      setArchivesLoading(false);
    }
  };

  const openArchive = (html: string) => {
    if (!html) return;
    const w = window.open('', '_blank', 'width=1000,height=800');
    if (!w) return;
    w.document.write(html);
    w.document.close();
  };

  const totals = React.useMemo(() => {
    const startBalance = startingBalance !== null ? startingBalance : (treasuryHistory.length ? (treasuryHistory[0].balance - records.reduce((s:any,rec:any)=> s + Number(rec.amount||0),0)) : 0);
    const endBalance = treasuryHistory.length ? treasuryHistory[treasuryHistory.length-1].balance : (startBalance + records.reduce((s:any,rec:any)=> s + Number(rec.amount||0),0));
    let totalRevenue = 0; let totalExpense = 0; let totalPayments = 0; let totalDeposits = 0;
    records.forEach(r => {
      const amt = Number(r.amount || 0);
      const txn = (r.txn_type || '').toString().toLowerCase();
      const desc = (r.desc || '').toString();

      // revenue vs expense
      if (amt >= 0) totalRevenue += amt;
      else totalExpense += Math.abs(amt);

      // deposits: positive inflows that are deposits/payment_in
      if (amt > 0 && (txn.includes('payment_in') || txn.includes('deposit') || desc.includes('ايداع') || desc.toLowerCase().includes('deposit'))) {
        totalDeposits += amt;
      }

      // payments: outflows or negative entries that are payments or payment_out
      if (amt < 0 && (txn.includes('payment') || txn.includes('payment_out') || desc.toLowerCase().includes('دفع') || desc.toLowerCase().includes('دفعة') )) {
        totalPayments += Math.abs(amt);
      }
    });

    return { startBalance, endBalance, totalRevenue, totalExpense, totalPayments, totalDeposits };
  }, [treasuryHistory, records]);

  const translateLabel = (typeVal: any, descVal: any, txnVal?: any) => translateTxnLabel(typeVal, descVal, txnVal);

  // compute order-based metrics for the day
  const orderMetrics = React.useMemo(() => {
    const deliveredOrders = new Set<number>();
    const returnedOrders = new Set<number>();
    let deliveredPieces = 0; let returnedPieces = 0; let salesAmount = 0; let returnsAmount = 0;
    let expenses = 0; let supplierPayments = 0; let deposits = 0;

    const parseDetails = (s:any) => { if (!s) return {}; if (typeof s === 'object') return s; try { return JSON.parse(s); } catch(e){ return {}; } };

    records.forEach(r => {
      const amt = Number(r.amount || 0);
      const txn = (r.txn_type || '').toString().toLowerCase();
      const details = parseDetails(r.raw_details || r.raw_details || r.raw_details);

      if (details) {
        if (details.action && (details.action === 'delivered' || details.action === 'partial_delivered')) {
          const oid = Number(details.order_id || details.orderId || 0);
          if (oid) deliveredOrders.add(oid);
        }
        if (details.action && (details.action === 'returned' || details.action === 'partial_returned')) {
          const oid = Number(details.order_id || details.orderId || 0);
          if (oid) returnedOrders.add(oid);
        }
        if (Array.isArray(details.orders) && details.orders.length>0) {
          details.orders.forEach((oid:any)=> deliveredOrders.add(Number(oid)));
        }
      }

      if (amt > 0) {
        if (txn.includes('payment_in') || (details && details.subtype==='deposit') || (r.desc||'').toString().includes('ايداع')) {
          deposits += amt;
        } else {
          salesAmount += amt;
        }
      } else if (amt < 0) {
        if ((details && details.subtype==='supplier_payment') || txn.includes('supplier_payment')) {
          supplierPayments += Math.abs(amt);
        } else if ((details && details.subtype==='expense') || txn.includes('payment_out') || (r.type||'').toString() === 'expense') {
          expenses += Math.abs(amt);
        } else {
          returnsAmount += Math.abs(amt);
        }
      }
    });

    // compute pieces and amounts from ordersMap
    deliveredOrders.forEach((oid:number)=> {
      const o = ordersMap[oid]; if (o) {
        deliveredPieces += (o.products||[]).reduce((s:any,p:any)=> s + Number(p.quantity||p.qty||0), 0);
        salesAmount += Number(o.total || o.subTotal || 0);
      }
    });
    returnedOrders.forEach((oid:number)=> {
      const o = ordersMap[oid]; if (o) {
        returnedPieces += (o.products||[]).reduce((s:any,p:any)=> s + Number(p.quantity||p.qty||0), 0);
        returnsAmount += Number(o.total || o.subTotal || 0);
      }
    });

    return { deliveredOrders: deliveredOrders.size, returnedOrders: returnedOrders.size, deliveredPieces, returnedPieces, salesAmount, returnsAmount, expenses, supplierPayments, deposits };
  }, [records, ordersMap]);

  function exportCSV() {
    if (!records || records.length === 0) { Swal.fire('تنبيه', 'لا توجد بيانات للتصدير', 'info'); return; }
    const headers = ['التاريخ','النوع','الوصف','المبلغ','الخزينة'];
    const rows = records.map(r => [r.date || '', r.type || r.type, (r.desc||''), Number(r.amount||0).toString(), r.treasury || '']);
    const csv = [headers.join(','), ...rows.map(rr => rr.map(c => `"${String(c).replace(/"/g,'""')}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `daily_report_${date}.csv`; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  }

  function printReport() {
  const txnRows = records.map(r=>`<tr><td>${r.date||''}</td><td>${translateLabel(r.type, r.desc, r.txn_type)}</td><td>${((r.desc&& /[\u0600-\u06FF]/.test(r.desc)) ? r.desc : translateLabel(r.desc, r.desc, r.txn_type))}</td><td style="text-align:left">${Number(r.amount||0).toLocaleString()}</td><td>${r.treasury||''}</td></tr>`).join('');
    const metricsHtml = `<div style="margin-top:8px;">عدد الطلبيات المسلمة: ${orderMetrics.deliveredOrders} — عدد الطلبيات المرتجعة: ${orderMetrics.returnedOrders} — إجمالي القطع المسلمة: ${orderMetrics.deliveredPieces.toLocaleString()} — إجمالي القطع المرتجعة: ${orderMetrics.returnedPieces.toLocaleString()} — إجمالي المبيعات: ${Number(orderMetrics.salesAmount||0).toLocaleString()} — إجمالي المرتجعات: ${Number(orderMetrics.returnsAmount||0).toLocaleString()} — إجمالي المصروفات: ${Number(orderMetrics.expenses||0).toLocaleString()} — إجمالي دفعات للموردين: ${Number(orderMetrics.supplierPayments||0).toLocaleString()} — إجمالي الإيداعات: ${Number(orderMetrics.deposits||0).toLocaleString()}</div>`;
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>تقرير اليومية ${date}</title><style>body{font-family: Arial, "Noto Naskh Arabic", sans-serif; direction:rtl; padding:20px;} table{width:100%; border-collapse:collapse; font-size:12px;} th,td{border:1px solid #333; padding:6px; text-align:right;} th{background:#f3f4f6;} .summary{display:block; margin-bottom:12px;}</style></head><body><h1 style="text-align:center">تقرير اليومية</h1><div>التاريخ: ${date}</div><div class="summary"><div>رصيد البداية: ${totals.startBalance.toLocaleString()}</div><div>رصيد النهاية: ${totals.endBalance.toLocaleString()}</div><div>إجمالي الإيرادات: ${totals.totalRevenue.toLocaleString()}</div><div>إجمالي المصروفات: ${totals.totalExpense.toLocaleString()}</div>${metricsHtml}</div><table><thead><tr><th>التاريخ</th><th>النوع</th><th>الوصف</th><th>المبلغ</th><th>الخزينة</th></tr></thead><tbody>${txnRows}</tbody></table></body></html>`;
    const w = window.open('', '_blank', 'width=900,height=700'); if (!w) return; w.document.write(html); w.document.close(); setTimeout(()=>w.print(), 500);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <label className="text-sm">اختر التاريخ</label>
        <input type="date" value={date} onChange={e=>setDate(e.target.value)} className="border rounded p-2" />
        <button onClick={load} className="px-3 py-2 bg-blue-600 text-white rounded">تحديث</button>
        <button onClick={exportCSV} className="px-3 py-2 bg-sky-600 text-white rounded">تصدير Excel</button>
        <button onClick={printReport} className="px-3 py-2 bg-emerald-600 text-white rounded">طباعة</button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
        <div className="p-4 rounded shadow card border border-card text-right" style={{ backgroundColor: 'var(--card-bg)', color: 'var(--text)' }}>
          <div className="text-sm text-muted">تاريخ اليومية</div>
          <div className="font-black">{date}</div>
        </div>
        <div className="p-4 rounded shadow card border border-card text-right" style={{ backgroundColor: 'var(--card-bg)', color: 'var(--text)' }}>
          <div className="text-sm text-muted">رصيد الخزينة في بداية اليومية</div>
          <div className="font-black">{totals.startBalance.toLocaleString()} { /* currency symbol displayed elsewhere */ }</div>
        </div>
        <div className="p-4 rounded shadow card border border-card text-right" style={{ backgroundColor: 'var(--card-bg)', color: 'var(--text)' }}>
          <div className="text-sm text-muted">إجمالي المبالغ المستلمة</div>
          <div className="font-black">{totals.totalDeposits.toLocaleString()}</div>
        </div>
        <div className="p-4 rounded shadow card border border-card text-right" style={{ backgroundColor: 'var(--card-bg)', color: 'var(--text)' }}>
          <div className="text-sm text-muted">إجمالي المبالغ المُسلمة</div>
          <div className="font-black">{totals.totalPayments.toLocaleString()}</div>
        </div>
        <div className="p-4 rounded shadow card border border-card text-right" style={{ backgroundColor: 'var(--card-bg)', color: 'var(--text)' }}>
          <div className="text-sm text-muted">رصيد الخزينة الحالي / عند نهاية التقفيل</div>
          <div className="font-black">{totals.endBalance.toLocaleString()}</div>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3 mt-2">
        <div className="p-4 rounded shadow card border border-card" style={{ backgroundColor: 'var(--card-bg)', color: 'var(--text)' }}>عدد الطلبيات المسلمة<br/><div className="font-black">{orderMetrics.deliveredOrders}</div></div>
        <div className="p-4 rounded shadow card border border-card" style={{ backgroundColor: 'var(--card-bg)', color: 'var(--text)' }}>عدد الطلبيات المرتجعة<br/><div className="font-black">{orderMetrics.returnedOrders}</div></div>
        <div className="p-4 rounded shadow card border border-card" style={{ backgroundColor: 'var(--card-bg)', color: 'var(--text)' }}>إجمالي القطع المسلمة<br/><div className="font-black">{orderMetrics.deliveredPieces}</div></div>
        <div className="p-4 rounded shadow card border border-card" style={{ backgroundColor: 'var(--card-bg)', color: 'var(--text)' }}>إجمالي القطع المرتجعة<br/><div className="font-black">{orderMetrics.returnedPieces}</div></div>
        <div className="p-4 rounded shadow card border border-card" style={{ backgroundColor: 'var(--card-bg)', color: 'var(--text)' }}>إجمالي المبيعات (مبلغ)<br/><div className="font-black">{Number(orderMetrics.salesAmount||0).toLocaleString()}</div></div>
        <div className="p-4 rounded shadow card border border-card" style={{ backgroundColor: 'var(--card-bg)', color: 'var(--text)' }}>إجمالي المرتجعات (مبلغ)<br/><div className="font-black">{Number(orderMetrics.returnsAmount||0).toLocaleString()}</div></div>
      </div>

      <div className="grid grid-cols-3 lg:grid-cols-3 gap-3 mt-2">
        <div className="p-4 rounded shadow card border border-card" style={{ backgroundColor: 'var(--card-bg)', color: 'var(--text)' }}>إجمالي المصروفات<br/><div className="font-black">{Number(orderMetrics.expenses||0).toLocaleString()}</div></div>
        <div className="p-4 rounded shadow card border border-card" style={{ backgroundColor: 'var(--card-bg)', color: 'var(--text)' }}>إجمالي دفعات للموردين<br/><div className="font-black">{Number(orderMetrics.supplierPayments||0).toLocaleString()}</div></div>
        <div className="p-4 rounded shadow card border border-card" style={{ backgroundColor: 'var(--card-bg)', color: 'var(--text)' }}>إجمالي الإيداعات<br/><div className="font-black">{Number(orderMetrics.deposits||0).toLocaleString()}</div></div>
      </div>

      <div className="overflow-x-auto rounded border">
        <table className="w-full text-sm text-right">
          <thead className="bg-slate-50 text-slate-500">
            <tr><th className="px-3 py-2">التاريخ</th><th className="px-3 py-2">النوع</th><th className="px-3 py-2">الوصف</th><th className="px-3 py-2">المبلغ</th><th className="px-3 py-2">الخزينة</th></tr>
          </thead>
          <tbody>
            {records.map((r:any, idx:number) => (
                      <tr key={idx} className="border-t">
                        <td className="px-3 py-2">{r.date}</td>
                        <td className="px-3 py-2">{translateLabel(r.type, r.desc, r.txn_type)}</td>
                        <td className="px-3 py-2 text-xs">{(r.desc && /[\u0600-\u06FF]/.test(r.desc)) ? r.desc : translateLabel(r.desc, r.desc, r.txn_type)}</td>
                        <td className="px-3 py-2">{Number(r.amount).toLocaleString()}</td>
                        <td className="px-3 py-2 text-xs">{r.treasury}</td>
                      </tr>
                    ))}
          </tbody>
        </table>
      </div>

      <div className="mt-6">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-bold">أرشيف التقارير اليومية</h3>
          <button onClick={loadArchives} className="px-3 py-2 bg-slate-700 text-white rounded text-sm">تحديث الأرشيف</button>
        </div>
        {archivesLoading ? (
          <div className="text-sm text-muted">جارٍ تحميل الأرشيف...</div>
        ) : archives.length === 0 ? (
          <div className="text-sm text-muted">لا توجد تقارير مؤرشفة لهذا اليوم.</div>
        ) : (
          <div className="overflow-x-auto rounded border">
            <table className="w-full text-sm text-right">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-3 py-2">التاريخ</th>
                  <th className="px-3 py-2">النوع</th>
                  <th className="px-3 py-2">الأقسام</th>
                  <th className="px-3 py-2">الحالة</th>
                  <th className="px-3 py-2">عرض</th>
                </tr>
              </thead>
              <tbody>
                {archives.map((a: any) => (
                  <tr key={a.id} className="border-t">
                    <td className="px-3 py-2">{a.report_date}</td>
                    <td className="px-3 py-2">{a.report_type}</td>
                    <td className="px-3 py-2 text-xs">{(() => { try { return (JSON.parse(a.sections || '[]') || []).join(', '); } catch (e) { return a.sections || ''; } })()}</td>
                    <td className="px-3 py-2">{Number(a.sent) === 1 ? 'تم الإرسال' : 'غير مرسل'}</td>
                    <td className="px-3 py-2">
                      <button onClick={() => openArchive(a.html)} className="px-2 py-1 bg-blue-600 text-white rounded text-xs">عرض</button>
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
