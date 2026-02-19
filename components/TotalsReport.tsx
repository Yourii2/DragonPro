import React, { useEffect, useState } from 'react';
import { API_BASE_PATH } from '../services/apiConfig';
import { translateTxnLabel } from '../services/labelHelpers';
import Swal from 'sweetalert2';

const formatDate = (d: Date) => d.toISOString().slice(0,10);

const TotalsReport: React.FC = () => {
  const today = new Date();
  const firstDay = new Date(); firstDay.setDate(firstDay.getDate()-7);
  const [startDate, setStartDate] = useState<string>(formatDate(firstDay));
  const [endDate, setEndDate] = useState<string>(formatDate(today));
  const [loading, setLoading] = useState(false);
  const [startingBalance, setStartingBalance] = useState<number>(0);
  const [endBalance, setEndBalance] = useState<number>(0);
  const [records, setRecords] = useState<any[]>([]);
  const [ordersMap, setOrdersMap] = useState<Record<number, any>>({});

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    try {
      // load all orders once (contains products per order)
      try {
        const or = await fetch(`${API_BASE_PATH}/api.php?module=orders&action=getAll`);
        const jor = await or.json();
        if (jor && jor.success) {
          const map: Record<number, any> = {};
          (jor.data||[]).forEach((o:any)=> { map[o.id] = o; });
          setOrdersMap(map);
        }
      } catch(e) { console.debug('Failed to load orders for totals report', e); }

      const url = `${API_BASE_PATH}/api.php?module=reports&action=finance&start_date=${startDate}&end_date=${endDate}`;
      const r = await fetch(url);
      const j = await r.json();
      if (j && j.success) {
        setStartingBalance(Number(j.data.starting_balance || 0));
        const th = j.data.treasuryBalanceHistory || [];
        setEndBalance(th.length ? Number(th[th.length-1].balance) : Number(j.data.starting_balance || 0));
        setRecords(j.data.revenueAndExpenseRecords || []);
      } else {
        setStartingBalance(0); setEndBalance(0); setRecords([]);
        Swal.fire('تنبيه', 'لا توجد بيانات للفترة المحددة.', 'info');
      }
    } catch (e) {
      console.error('Failed to load totals report', e);
      Swal.fire('خطأ', 'فشل تحميل الملخص. راجع الكونسول.', 'error');
    } finally { setLoading(false); }
  };

  const totals = React.useMemo(() => {
    let totalRevenue = 0; let totalExpense = 0; let totalPayments = 0; let totalDeposits = 0;
    records.forEach((r:any) => {
      const amt = Number(r.amount || 0);
      const txn = (r.txn_type || '').toString().toLowerCase();
      const desc = (r.desc || '').toString();
      if (amt >= 0) totalRevenue += amt; else totalExpense += Math.abs(amt);
      if (amt > 0 && (txn.includes('payment_in') || txn.includes('deposit') || desc.includes('ايداع'))) totalDeposits += amt;
      if (amt < 0 && (txn.includes('payment') || txn.includes('payment_out') || desc.includes('دفع') || desc.includes('دفعة'))) totalPayments += Math.abs(amt);
    });
    return { totalRevenue, totalExpense, totalDeposits, totalPayments };
  }, [records]);

  // Build per-day breakdown
  const perDay = React.useMemo(() => {
    const out: Record<string, any> = {};
    const sd = new Date(startDate); const ed = new Date(endDate);
    // init days
    for (let d = new Date(sd); d <= ed; d.setDate(d.getDate()+1)) {
      const key = d.toISOString().slice(0,10);
      out[key] = {
        date: key,
        deliveredOrders: new Set<number>(),
        returnedOrders: new Set<number>(),
        deliveredPieces: 0,
        returnedPieces: 0,
        salesAmount: 0,
        returnsAmount: 0,
        expenses: 0,
        supplierPayments: 0,
        deposits: 0
      };
    }

    const parseDetails = (s:any) => {
      if (!s) return {};
      if (typeof s === 'object') return s;
      try { return JSON.parse(s); } catch(e){ return {}; }
    };

    records.forEach((rec:any) => {
      const dateKey = (rec.date || '').toString().slice(0,10);
      if (!out[dateKey]) return; // out of range
      const day = out[dateKey];
      const amt = Number(rec.amount || 0);
      const txn = (rec.txn_type || '').toString().toLowerCase();
      const details = parseDetails(rec.raw_details || rec.raw_details || rec.raw_details);

      // detect delivered/returned from details.action or details.order_id or details.orders
      if (details) {
        if (details.action && (details.action === 'delivered' || details.action === 'partial_delivered')) {
          const oid = Number(details.order_id || details.orderId || 0);
          if (oid) day.deliveredOrders.add(oid);
        }
        if (details.action && (details.action === 'returned' || details.action === 'partial_returned')) {
          const oid = Number(details.order_id || details.orderId || 0);
          if (oid) day.returnedOrders.add(oid);
        }
        if (Array.isArray(details.orders) && details.orders.length>0) {
          details.orders.forEach((oid:any)=> { day.deliveredOrders.add(Number(oid)); });
        }
      }

      // amounts classification
      if (amt > 0) {
        // revenue or deposit
        if (txn.includes('payment_in') || (details && details.subtype==='deposit') || (rec.desc||'').toString().includes('ايداع')) {
          day.deposits += amt;
        } else {
          day.salesAmount += amt;
        }
      } else if (amt < 0) {
        // negative: could be expense, return, supplier payment
        if ((details && details.subtype==='supplier_payment') || txn.includes('supplier_payment')) {
          day.supplierPayments += Math.abs(amt);
        } else if ((details && details.subtype==='expense') || txn.includes('payment_out') || (rec.type||'').toString() === 'expense') {
          day.expenses += Math.abs(amt);
        } else {
          // consider as return
          day.returnsAmount += Math.abs(amt);
        }
      }
    });

    // compute pieces and sales/returns amounts by mapping orders
    Object.keys(out).forEach(k => {
      const d = out[k];
      d.deliveredPieces = 0; d.returnedPieces = 0;
      d.deliveredOrders.forEach((oid:number) => {
        const o = ordersMap[oid];
        if (o) {
          d.deliveredPieces += (o.products||[]).reduce((s:any,p:any)=> s + Number(p.quantity||p.qty||0), 0);
          d.salesAmount += Number(o.total || o.subTotal || 0);
        }
      });
      d.returnedOrders.forEach((oid:number) => {
        const o = ordersMap[oid];
        if (o) {
          d.returnedPieces += (o.products||[]).reduce((s:any,p:any)=> s + Number(p.quantity||p.qty||0), 0);
          d.returnsAmount += Number(o.total || o.subTotal || 0);
        }
      });
      d.deliveredOrders = d.deliveredOrders.size;
      d.returnedOrders = d.returnedOrders.size;
    });

    return Object.values(out).sort((a:any,b:any)=> a.date.localeCompare(b.date));
  }, [records, ordersMap, startDate, endDate]);

  function exportCSV() {
    if (!records || records.length === 0) { Swal.fire('تنبيه', 'لا توجد بيانات للتصدير', 'info'); return; }
    const headers = ['التاريخ','النوع','الوصف','المبلغ','الخزينة'];
    const rows = records.map((r:any) => [r.date||'', translateTxnLabel(r.type, r.desc, r.txn_type), r.desc||'', Number(r.amount||0).toString(), r.treasury||'']);
    const csv = [headers.join(','), ...rows.map(rr => rr.map(c => `"${String(c).replace(/"/g,'""')}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `totals_${startDate}_to_${endDate}.csv`; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  }

  function printReport() {
    const rowsHtml = perDay.map((d:any) => `
      <tr>
        <td>${d.date}</td>
        <td style="text-align:center">${d.deliveredOrders}</td>
        <td style="text-align:center">${d.returnedOrders}</td>
        <td style="text-align:center">${Number(d.deliveredPieces||0).toLocaleString()}</td>
        <td style="text-align:center">${Number(d.returnedPieces||0).toLocaleString()}</td>
        <td style="text-align:left">${Number(d.salesAmount||0).toLocaleString()}</td>
        <td style="text-align:left">${Number(d.returnsAmount||0).toLocaleString()}</td>
        <td style="text-align:left">${Number(d.expenses||0).toLocaleString()}</td>
        <td style="text-align:left">${Number(d.supplierPayments||0).toLocaleString()}</td>
        <td style="text-align:left">${Number(d.deposits||0).toLocaleString()}</td>
      </tr>
    `).join('');

    const html = `<!doctype html><html><head><meta charset="utf-8"><title>ملخص الفترة ${startDate} - ${endDate}</title><style>body{font-family: Arial, "Noto Naskh Arabic", sans-serif; direction:rtl; padding:20px;} table{width:100%; border-collapse:collapse; font-size:12px;} th,td{border:1px solid #333; padding:6px; text-align:right;} th{background:#f3f4f6;} .summary{margin-bottom:12px; display:block;} .summary div{margin:4px 0;}</style></head><body><h1 style="text-align:center">ملخص الفترة</h1><div>الفترة: ${startDate} - ${endDate}</div><div class="summary"><div>رصيد البداية: ${startingBalance.toLocaleString()}</div><div>رصيد النهاية: ${endBalance.toLocaleString()}</div><div>إجمالي الإيرادات: ${totals.totalRevenue.toLocaleString()}</div><div>إجمالي المصروفات: ${totals.totalExpense.toLocaleString()}</div><div>إجمالي الإيداعات: ${totals.totalDeposits.toLocaleString()}</div><div>إجمالي الدفعات: ${totals.totalPayments.toLocaleString()}</div></div><table><thead><tr><th>التاريخ</th><th>عدد الطلبيات المسلمة</th><th>عدد الطلبيات المرتجعة</th><th>إجمالي القطع المسلمة</th><th>إجمالي القطع المرتجعة</th><th>إجمالي المبيعات (مبلغ)</th><th>إجمالي المرتجعات (مبلغ)</th><th>إجمالي المصروفات</th><th>إجمالي دفعات للموردين</th><th>إجمالي الإيداعات</th></tr></thead><tbody>${rowsHtml}</tbody></table></body></html>`;
    const w = window.open('', '_blank'); if (!w) return; w.document.write(html); w.document.close(); setTimeout(()=>w.print(), 500);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <label className="text-sm">من</label>
        <input type="date" value={startDate} onChange={e=>setStartDate(e.target.value)} className="border rounded p-2" />
        <label className="text-sm">إلى</label>
        <input type="date" value={endDate} onChange={e=>setEndDate(e.target.value)} className="border rounded p-2" />
        <button onClick={load} className="px-3 py-2 bg-blue-600 text-white rounded">تحديث</button>
        <button onClick={exportCSV} className="px-3 py-2 bg-sky-600 text-white rounded">تصدير Excel</button>
        <button onClick={printReport} className="px-3 py-2 bg-emerald-600 text-white rounded">طباعة</button>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
        <div className="p-4 rounded shadow card border border-card" style={{ backgroundColor: 'var(--card-bg)', color: 'var(--text)' }}>رصيد البداية<br/><div className="font-black">{startingBalance.toLocaleString()}</div></div>
        <div className="p-4 rounded shadow card border border-card" style={{ backgroundColor: 'var(--card-bg)', color: 'var(--text)' }}>إجمالي الإيرادات<br/><div className="font-black">{totals.totalRevenue.toLocaleString()}</div></div>
        <div className="p-4 rounded shadow card border border-card" style={{ backgroundColor: 'var(--card-bg)', color: 'var(--text)' }}>إجمالي المصروفات<br/><div className="font-black">{totals.totalExpense.toLocaleString()}</div></div>
        <div className="p-4 rounded shadow card border border-card" style={{ backgroundColor: 'var(--card-bg)', color: 'var(--text)' }}>إجمالي الإيداعات<br/><div className="font-black">{totals.totalDeposits.toLocaleString()}</div></div>
        <div className="p-4 rounded shadow card border border-card" style={{ backgroundColor: 'var(--card-bg)', color: 'var(--text)' }}>إجمالي الدفعات<br/><div className="font-black">{totals.totalPayments.toLocaleString()}</div></div>
        <div className="p-4 rounded shadow card border border-card" style={{ backgroundColor: 'var(--card-bg)', color: 'var(--text)' }}>رصيد النهاية<br/><div className="font-black">{endBalance.toLocaleString()}</div></div>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3 mt-2">
        <div className="p-4 rounded shadow card border border-card" style={{ backgroundColor: 'var(--card-bg)', color: 'var(--text)' }}>عدد الطلبيات المسلمة<br/><div className="font-black">{perDay.reduce((s:any,d:any)=> s + Number(d.deliveredOrders||0),0)}</div></div>
        <div className="p-4 rounded shadow card border border-card" style={{ backgroundColor: 'var(--card-bg)', color: 'var(--text)' }}>عدد الطلبيات المرتجعة<br/><div className="font-black">{perDay.reduce((s:any,d:any)=> s + Number(d.returnedOrders||0),0)}</div></div>
        <div className="p-4 rounded shadow card border border-card" style={{ backgroundColor: 'var(--card-bg)', color: 'var(--text)' }}>إجمالي القطع المسلمة<br/><div className="font-black">{perDay.reduce((s:any,d:any)=> s + Number(d.deliveredPieces||0),0)}</div></div>
        <div className="p-4 rounded shadow card border border-card" style={{ backgroundColor: 'var(--card-bg)', color: 'var(--text)' }}>إجمالي القطع المرتجعة<br/><div className="font-black">{perDay.reduce((s:any,d:any)=> s + Number(d.returnedPieces||0),0)}</div></div>
        <div className="p-4 rounded shadow card border border-card" style={{ backgroundColor: 'var(--card-bg)', color: 'var(--text)' }}>إجمالي المبيعات (مبلغ)<br/><div className="font-black">{perDay.reduce((s:any,d:any)=> s + Number(d.salesAmount||0),0).toLocaleString()}</div></div>
        <div className="p-4 rounded shadow card border border-card" style={{ backgroundColor: 'var(--card-bg)', color: 'var(--text)' }}>إجمالي المرتجعات (مبلغ)<br/><div className="font-black">{perDay.reduce((s:any,d:any)=> s + Number(d.returnsAmount||0),0).toLocaleString()}</div></div>
      </div>

      <div className="grid grid-cols-3 lg:grid-cols-3 gap-3 mt-2">
        <div className="p-4 rounded shadow card border border-card" style={{ backgroundColor: 'var(--card-bg)', color: 'var(--text)' }}>إجمالي المصروفات<br/><div className="font-black">{perDay.reduce((s:any,d:any)=> s + Number(d.expenses||0),0).toLocaleString()}</div></div>
        <div className="p-4 rounded shadow card border border-card" style={{ backgroundColor: 'var(--card-bg)', color: 'var(--text)' }}>إجمالي دفعات للموردين<br/><div className="font-black">{perDay.reduce((s:any,d:any)=> s + Number(d.supplierPayments||0),0).toLocaleString()}</div></div>
        <div className="p-4 rounded shadow card border border-card" style={{ backgroundColor: 'var(--card-bg)', color: 'var(--text)' }}>إجمالي الإيداعات<br/><div className="font-black">{perDay.reduce((s:any,d:any)=> s + Number(d.deposits||0),0).toLocaleString()}</div></div>
      </div>

      <div className="overflow-x-auto rounded border">
        <table className="w-full text-sm text-right">
          <thead className="bg-slate-50 text-slate-500">
            <tr>
              <th className="px-3 py-2">التاريخ</th>
              <th className="px-3 py-2">عدد الطلبيات المسلمة</th>
              <th className="px-3 py-2">عدد الطلبيات المرتجعة</th>
              <th className="px-3 py-2">إجمالي القطع المسلمة</th>
              <th className="px-3 py-2">إجمالي القطع المرتجعة</th>
              <th className="px-3 py-2">إجمالي المبيعات (مبلغ)</th>
              <th className="px-3 py-2">إجمالي المرتجعات (مبلغ)</th>
              <th className="px-3 py-2">إجمالي المصروفات</th>
              <th className="px-3 py-2">إجمالي الدفعات للموردين</th>
              <th className="px-3 py-2">إجمالي الإيداعات</th>
            </tr>
          </thead>
          <tbody>
            {perDay.map((d:any) => (
              <tr key={d.date} className="border-t">
                <td className="px-3 py-2">{d.date}</td>
                <td className="px-3 py-2">{d.deliveredOrders}</td>
                <td className="px-3 py-2">{d.returnedOrders}</td>
                <td className="px-3 py-2">{d.deliveredPieces}</td>
                <td className="px-3 py-2">{d.returnedPieces}</td>
                <td className="px-3 py-2">{Number(d.salesAmount||0).toLocaleString()}</td>
                <td className="px-3 py-2">{Number(d.returnsAmount||0).toLocaleString()}</td>
                <td className="px-3 py-2">{Number(d.expenses||0).toLocaleString()}</td>
                <td className="px-3 py-2">{Number(d.supplierPayments||0).toLocaleString()}</td>
                <td className="px-3 py-2">{Number(d.deposits||0).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default TotalsReport;
