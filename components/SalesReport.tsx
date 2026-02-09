import React, { useEffect, useState } from 'react';
import { API_BASE_PATH } from '../services/apiConfig';
import Swal from 'sweetalert2';

const formatDateInput = (d: Date) => d.toISOString().slice(0,10);
const startOfToday = () => { const d = new Date(); d.setHours(0,0,0,0); return d; };
const endOfToday = () => { const d = new Date(); d.setHours(23,59,59,999); return d; };

const SalesReport: React.FC = () => {
  const [startDate, setStartDate] = useState<string>(formatDateInput(startOfToday()));
  const [endDate, setEndDate] = useState<string>(formatDateInput(endOfToday()));
  const [loading, setLoading] = useState(false);
  const [reps, setReps] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [reportRows, setReportRows] = useState<any[]>([]);

  useEffect(() => { loadInitial(); }, []);

  const loadInitial = async () => {
    try {
      const r = await fetch(`${API_BASE_PATH}/api.php?module=users&action=getAll`);
      const jr = await r.json();
      const repList = (jr.success ? (jr.data||[]) : []).filter((u:any)=> u.role === 'representative');
      setReps(repList);
      const or = await fetch(`${API_BASE_PATH}/api.php?module=orders&action=getAll`);
      const jor = await or.json();
      setOrders(jor.success ? (jor.data||[]) : []);
    } catch (e) {
      console.error('Failed to load initial data', e);
      Swal.fire('خطأ', 'فشل تحميل البيانات الأساسية.', 'error');
    }
  };

  const preset = (p: 'today'|'week'|'month') => {
    const now = new Date();
    if (p === 'today') {
      setStartDate(formatDateInput(startOfToday()));
      setEndDate(formatDateInput(endOfToday()));
    } else if (p === 'week') {
      const s = new Date(); s.setDate(now.getDate() - 7); s.setHours(0,0,0,0);
      setStartDate(formatDateInput(s));
      setEndDate(formatDateInput(endOfToday()));
    } else if (p === 'month') {
      const s = new Date(); s.setMonth(now.getMonth() - 1); s.setHours(0,0,0,0);
      setStartDate(formatDateInput(s));
      setEndDate(formatDateInput(endOfToday()));
    }
  };

  const parseDetails = (d:any) => {
    if (!d) return {};
    try { return typeof d === 'string' ? JSON.parse(d) : d; } catch(e){ return {}; }
  };

  const generateReport = async () => {
    setLoading(true);
    try {
      const s = new Date(startDate + 'T00:00:00');
      const e = new Date(endDate + 'T23:59:59');

      const ordersMap = new Map<number, any>();
      orders.forEach((o:any)=> ordersMap.set(o.id, o));

      const rows = await Promise.all(reps.map(async (rep:any) => {
        // fetch transactions for this rep
        let txs:any[] = [];
        try {
          const tr = await fetch(`${API_BASE_PATH}/api.php?module=transactions&action=getByRelated&related_to_type=rep&related_to_id=${rep.id}`);
          const jtr = await tr.json();
          txs = jtr.success ? (jtr.data||[]) : [];
        } catch (e) { txs = []; }

        const prevBalance = txs.filter(tx=> new Date(tx.transaction_date) < s).reduce((sum,tx)=> sum + Number(tx.amount||0), 0);
        const currentBalance = txs.filter(tx=> new Date(tx.transaction_date) <= e).reduce((sum,tx)=> sum + Number(tx.amount||0), 0);

        // orders before start (assigned earlier)
        const ordersBefore = orders.filter((o:any)=> Number(o.rep_id) === Number(rep.id) && new Date(o.created_at) < s);
        const ordersBeforeCount = ordersBefore.length;
        const piecesBefore = ordersBefore.reduce((sum:any,o:any)=> sum + ((o.products||[]).reduce((ss:number,p:any)=> ss + Number(p.quantity||p.qty||0),0)), 0);

        // transactions in period
        const txInPeriod = txs.filter(tx=> {
          const d = new Date(tx.transaction_date);
          return d >= s && d <= e;
        });

        // orders received in daily: transactions with details.orders
        let ordersReceivedCount = 0; let piecesReceivedCount = 0;
        txInPeriod.forEach(tx => {
          const det = parseDetails(tx.details);
          if (det && Array.isArray(det.orders) && det.orders.length>0) {
            ordersReceivedCount += det.orders.length;
            det.orders.forEach((oid:number) => {
              const ord = ordersMap.get(Number(oid));
              if (ord) piecesReceivedCount += (ord.products||[]).reduce((ss:number,p:any)=> ss + Number(p.quantity||p.qty||0), 0);
            });
          }
        });

        // delivered / returned in period via tx details 'action'
        const deliveredOrderIds = new Set<number>();
        const returnedOrderIds = new Set<number>();
        txInPeriod.forEach(tx=>{
          const det = parseDetails(tx.details);
          if (det && det.action && det.order_id) {
            const aid = Number(det.order_id);
            if (det.action === 'delivered' || det.action === 'partial_delivered') deliveredOrderIds.add(aid);
            if (det.action === 'returned' || det.action === 'partial_returned') returnedOrderIds.add(aid);
          }
        });
        const deliveredOrdersCount = deliveredOrderIds.size;
        const returnedOrdersCount = returnedOrderIds.size;
        const deliveredPieces = Array.from(deliveredOrderIds).reduce((s:any, oid:any)=> { const ord = ordersMap.get(Number(oid)); return s + (ord? (ord.products||[]).reduce((ss:number,p:any)=> ss + Number(p.quantity||p.qty||0),0) : 0); }, 0);
        const returnedPieces = Array.from(returnedOrderIds).reduce((s:any, oid:any)=> { const ord = ordersMap.get(Number(oid)); return s + (ord? (ord.products||[]).reduce((ss:number,p:any)=> ss + Number(p.quantity||p.qty||0),0) : 0); }, 0);

        // payments in period: transactions that include details.direction or type contains payment
        const paymentsInPeriod = txInPeriod.reduce((s:any, tx:any)=> {
          const det = parseDetails(tx.details);
          const type = (tx.type||'').toLowerCase();
          if ((det && det.direction) || type.includes('payment')) {
            return s + Number(tx.amount||0);
          }
          return s;
        }, 0);

        return {
          repId: rep.id,
          repName: rep.name,
          prevBalance,
          ordersBeforeCount,
          piecesBefore,
          ordersReceivedCount,
          piecesReceivedCount,
          deliveredOrdersCount,
          deliveredPieces,
          returnedOrdersCount,
          returnedPieces,
          currentBalance,
          paymentsInPeriod
        };
      }));

      setReportRows(rows);
    } catch (e) {
      console.error('Failed to generate report', e);
      Swal.fire('خطأ', 'فشل إنشاء التقرير.', 'error');
    } finally { setLoading(false); }
  };

  function exportCSV() {
    if (!reportRows || reportRows.length === 0) { Swal.fire('تنبيه', 'لا توجد بيانات للتصدير', 'info'); return; }
    const headers = [
      'اسم المندوب', 'المبلغ_بداية', 'طلبيات_قبل', 'قطع_قبل', 'طلبيات_مستلمة', 'قطع_مستلمة', 'طلبيات_مسلمة', 'قطع_مسلمة', 'طلبيات_مرتجعة', 'قطع_مرتجعة', 'المبلغ_الحالي', 'تم_دفع', 'المتبقي'
    ];
    const rows = reportRows.map(r => [
      `"${r.repName || ''}"`, Math.abs(Number(r.prevBalance || 0)).toString(), (r.ordersBeforeCount||0).toString(), (r.piecesBefore||0).toString(), (r.ordersReceivedCount||0).toString(), (r.piecesReceivedCount||0).toString(), (r.deliveredOrdersCount||0).toString(), (r.deliveredPieces||0).toString(), (r.returnedOrdersCount||0).toString(), (r.returnedPieces||0).toString(), Math.abs(Number(r.currentBalance||0)).toString(), Number(r.paymentsInPeriod||0).toString(), `${Number(r.currentBalance||0).toString()} ${r.currentBalance>0? 'له' : (r.currentBalance<0? 'عليه':'')}`
    ]);
    const csv = [headers.join(','), ...rows.map(r=> r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sales_report_${startDate}_${endDate}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function printA4Report() {
    if (!reportRows || reportRows.length === 0) { Swal.fire('تنبيه', 'لا توجد بيانات للطباعة', 'info'); return; }
    const dateStr = `${startDate} - ${endDate}`;
    const htmlRows = reportRows.map(r => `
      <tr>
        <td>${r.repName}</td>
        <td style="text-align:right">${Math.abs(Number(r.prevBalance)).toLocaleString()}</td>
        <td style="text-align:center">${r.ordersBeforeCount}</td>
        <td style="text-align:center">${r.piecesBefore}</td>
        <td style="text-align:center">${r.ordersReceivedCount}</td>
        <td style="text-align:center">${r.piecesReceivedCount}</td>
        <td style="text-align:center">${r.deliveredOrdersCount}</td>
        <td style="text-align:center">${r.deliveredPieces}</td>
        <td style="text-align:center">${r.returnedOrdersCount}</td>
        <td style="text-align:center">${r.returnedPieces}</td>
        <td style="text-align:right">${Math.abs(Number(r.currentBalance)).toLocaleString()}</td>
        <td style="text-align:right">${Number(r.paymentsInPeriod).toLocaleString()}</td>
        <td style="text-align:right">${Number(r.currentBalance).toLocaleString()} ${r.currentBalance>0? 'له' : (r.currentBalance<0? 'عليه':'')}</td>
      </tr>
    `).join('');

    const html = `<!doctype html><html><head><meta charset="utf-8"><title>تقرير مبيعات</title><style>@page{size:A4;margin:20mm;} body{font-family: Arial, "Noto Naskh Arabic", sans-serif; direction:rtl; padding:10px;} table{width:100%; border-collapse:collapse;} th,td{border:1px solid #333; padding:6px; font-size:12px; text-align:right;} th{background:#f3f4f6;} h1{text-align:center;}</style></head><body><h1>تقرير مبيعات</h1><div>الفترة: ${dateStr}</div><table><thead><tr><th>اسم المندوب</th><th>المبلغ في البداية</th><th>طلبيات قبل</th><th>قطع قبل</th><th>طلبيات مستلمة</th><th>قطع مستلمة</th><th>طلبيات مسلمة</th><th>قطع مسلمة</th><th>طلبيات مرتجعة</th><th>قطع مرتجعة</th><th>المبلغ الحالي</th><th>تم دفع</th><th>المتبقي</th></tr></thead><tbody>${htmlRows}</tbody></table></body></html>`;
    const w = window.open('', '_blank', 'width=900,height=700');
    if (!w) return;
    w.document.write(html);
    w.document.close();
    setTimeout(()=> w.print(), 500);
  }

  return (
    <div className="p-6">
      <h2 className="font-black text-lg mb-4">تقرير المبيعات/الفترة للمندوبين</h2>
      <div className="flex gap-3 items-center mb-4">
        <div>
          <label className="text-xs">من</label>
          <input type="date" value={startDate} onChange={e=>setStartDate(e.target.value)} className="border p-2 rounded" />
        </div>
        <div>
          <label className="text-xs">إلى</label>
          <input type="date" value={endDate} onChange={e=>setEndDate(e.target.value)} className="border p-2 rounded" />
        </div>
        <div className="flex gap-2">
          <button onClick={()=>preset('today')} className="px-3 py-2 bg-slate-100 rounded">اليوم</button>
          <button onClick={()=>preset('week')} className="px-3 py-2 bg-slate-100 rounded">الأسبوع</button>
          <button onClick={()=>preset('month')} className="px-3 py-2 bg-slate-100 rounded">الشهر</button>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={generateReport} className="px-4 py-2 bg-blue-600 text-white rounded">تحديث التقرير</button>
          <button onClick={()=> exportCSV()} className="px-4 py-2 bg-sky-600 text-white rounded">تصدير CSV</button>
          <button onClick={()=> printA4Report()} className="px-4 py-2 bg-emerald-600 text-white rounded">طباعة A4</button>
        </div>
      </div>

      <div className="overflow-auto border rounded">
        <table className="w-full text-sm text-right">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-3 py-2">اسم المندوب</th>
              <th className="px-3 py-2">المبلغ في بداية الفترة</th>
              <th className="px-3 py-2">عدد الطلبيات قبل الفترة</th>
              <th className="px-3 py-2">عدد القطع قبل الفترة</th>
              <th className="px-3 py-2">عدد الطلبيات المستلمة في اليومية</th>
              <th className="px-3 py-2">عدد القطع المستلمة في اليومية</th>
              <th className="px-3 py-2">عدد الطلبيات المسلمة</th>
              <th className="px-3 py-2">عدد القطع المسلمة</th>
              <th className="px-3 py-2">عدد الطلبيات المرتجعة</th>
              <th className="px-3 py-2">عدد القطع المرتجعة</th>
              <th className="px-3 py-2">المبلغ الحالي</th>
              <th className="px-3 py-2">تم دفع</th>
              <th className="px-3 py-2">المتبقي (له/عليه)</th>
            </tr>
          </thead>
          <tbody>
            {reportRows.map(r => (
              <tr key={r.repId} className="border-t">
                <td className="px-3 py-2 font-bold">{r.repName}</td>
                <td className="px-3 py-2">{Math.abs(Number(r.prevBalance)).toLocaleString()}</td>
                <td className="px-3 py-2">{r.ordersBeforeCount}</td>
                <td className="px-3 py-2">{r.piecesBefore}</td>
                <td className="px-3 py-2">{r.ordersReceivedCount}</td>
                <td className="px-3 py-2">{r.piecesReceivedCount}</td>
                <td className="px-3 py-2">{r.deliveredOrdersCount}</td>
                <td className="px-3 py-2">{r.deliveredPieces}</td>
                <td className="px-3 py-2">{r.returnedOrdersCount}</td>
                <td className="px-3 py-2">{r.returnedPieces}</td>
                <td className="px-3 py-2">{Math.abs(Number(r.currentBalance)).toLocaleString()}</td>
                <td className="px-3 py-2">{Number(r.paymentsInPeriod).toLocaleString()}</td>
                <td className="px-3 py-2">{Number(r.currentBalance).toLocaleString()} <span className="mx-2 font-bold" style={{color: (r.currentBalance>0? 'green': (r.currentBalance<0? 'red':'#666'))}}>{r.currentBalance>0? 'له' : (r.currentBalance<0? 'عليه' : '')}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default SalesReport;
