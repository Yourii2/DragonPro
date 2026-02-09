import React, { useEffect, useState } from 'react';
import Swal from 'sweetalert2';
import { API_BASE_PATH } from '../services/apiConfig';

// --- مكونات الطباعة (تم نقلها وتوحيدها من SalesModule) ---

const PrintableContent: React.FC<{ order: any, companyName: string, companyPhone: string, terms: string }> = ({ order, companyName, companyPhone, terms }) => {
    // توحيد مسميات البيانات (لأن الـ API قد يرجع أسماء مختلفة قليلاً)
    const orderNumber = order.orderNumber || order.order_number || '';
    const customerName = order.customerName || order.customer_name || '';
    const phone = order.phone || order.phone1 || '';
    const address = order.address || '';
    const governorate = order.governorate || '';
    const products = order.products || [];
    
    const productRows = products.length > 0 
      ? products 
      : [{ name: '', quantity: '', price: '', total: '' }];

    // حساب الإجماليات
    const computedRows = productRows.map((p:any) => {
      const price = Number(p.price || 0);
      const qty = Number(p.quantity || p.qty || 0);
      const lineTotal = (p.total !== undefined && Number(p.total) !== 0) ? Number(p.total) : price * qty;
      return { ...p, price, quantity: qty, lineTotal };
    });

    const computedSubtotal = computedRows.reduce((s:any, r:any) => s + (r.lineTotal || 0), 0);
    const shippingVal = Number(order.shipping || order.shippingCost || order.shipping_fees || 0);
    const computedTotal = (order.total && Number(order.total) > 0) ? Number(order.total) : (computedSubtotal + shippingVal);

    const emptyRowsCount = Math.max(0, 3 - computedRows.length);
    const currentDate = new Date().toISOString().split('T')[0];

    return (
        <div className="flex flex-col h-full bg-white text-black font-sans box-border relative p-1" style={{ direction: 'rtl' }}>
            {/* Header */}
            <div className="flex justify-between items-start mb-1">
                <div className="text-right">
                    <h1 className="font-black text-xl mb-1">{companyName}</h1>
                    <p className="text-sm font-bold dir-ltr">{companyPhone}</p>
                </div>
                <div className="text-center">
                     <img 
                        src={`https://barcode.tec-it.com/barcode.ashx?data=${orderNumber}&code=Code128&dpi=96&thickness=2`} 
                        alt="barcode"
                        className="h-10 mb-1"
                    />
                     <p className="font-black text-sm">{orderNumber}</p>
                </div>
            </div>

            <div className="text-right mb-1">
                 <p className="text-xs font-bold">التاريخ: {currentDate}</p>
            </div>

            <div className="w-full border-b-2 border-black border-dashed my-1"></div>

            {/* Customer Info */}
            <div className="mb-2">
                <div className="flex justify-between items-center mb-1">
                    <div className="text-right flex-1">
                        <span className="font-bold text-base">{customerName}</span>
                    </div>
                    <div className="border-2 border-black p-1 px-3">
                        <span className="font-black text-sm">{governorate || 'غير محدد'}</span>
                    </div>
                </div>
                <div className="flex justify-between items-center mb-1">
                    <div className="text-right">
                         <span className="font-bold text-sm font-mono">{phone}</span>
                    </div>
                    <div className="text-left">
                         <span className="font-bold text-sm font-mono">{order.phone2 || ''}</span>
                    </div>
                </div>
                <div className="text-right">
                    <span className="font-bold text-xs leading-tight">{address}</span>
                </div>
            </div>

            {/* Product Table */}
            <div className="border-2 border-black mb-1 flex-grow">
                <table className="w-full text-center text-xs border-collapse">
                    <thead>
                        <tr className="bg-slate-200 border-b-2 border-black">
                            <th className="border-l border-black p-1">المنتج</th>
                            <th className="border-l border-black p-1 w-16">السعر</th>
                            <th className="border-l border-black p-1 w-12">الكمية</th>
                            <th className="p-1 w-16">الإجمالي</th>
                        </tr>
                    </thead>
                    <tbody>
                        {computedRows.map((p: any, i: number) => (
                          <tr key={i} className="border-b border-black">
                            <td className="border-l border-black p-1 text-right font-medium">{p.name} {p.color && p.color !== '-' ? `- ${p.color}` : ''}</td>
                            <td className="border-l border-black p-1 font-bold">{p.price.toLocaleString()}</td>
                            <td className="border-l border-black p-1 font-bold">{p.quantity}</td>
                            <td className="p-1 font-bold">{(p.lineTotal || 0).toLocaleString()}</td>
                          </tr>
                        ))}
                        {Array.from({ length: emptyRowsCount }).map((_, i) => (
                            <tr key={`empty-${i}`} className="border-b border-black">
                                <td className="border-l border-black p-1 h-6"></td>
                                <td className="border-l border-black p-1"></td>
                                <td className="border-l border-black p-1"></td>
                                <td className="p-1"></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Employee & Page */}
            <div className="flex justify-between text-xs mb-2 px-1">
                <p><span className="font-bold">الموظف:</span> {order.employee || order.rep_name || 'Admin'}</p>
                <p><span className="font-bold">البيدج:</span> {order.page || '-'}</p>
            </div>

            {/* Total Required */}
            <div className="border-2 border-black p-2 mb-2 text-center bg-slate-50">
                <p className="font-black text-sm mb-1">المطلوب دفعه</p>
                <div className="text-2xl font-black mb-1">{computedTotal.toLocaleString()} ج.م</div>
                <p className="text-[10px] font-bold">(شامل الشحن {shippingVal})</p>
            </div>

            {/* Policy */}
            <div className="border-2 border-black p-1 text-center mt-auto">
                <p className="font-bold text-[10px] mb-0.5">سياسة الشركه</p>
                <p className="text-[9px] font-medium leading-tight">{terms}</p>
            </div>
        </div>
    );
};

const PrintableOrders: React.FC<{ orders: any[] }> = ({ orders }) => {
    const companyName = localStorage.getItem('Dragon_company_name') || 'اسم الشركة';
    const companyPhone = localStorage.getItem('Dragon_company_phone') || '01000000000';
    const companyTerms = localStorage.getItem('Dragon_company_terms') || 'المعاينة حق للعميل قبل الاستلام.';

    // تقسيم الطلبات إلى مجموعات من 4 (2x2) للصفحة الواحدة
    const chunks: any[] = [];
    for (let i = 0; i < orders.length; i += 4) {
        chunks.push(orders.slice(i, i + 4));
    }

    return (
        <div id="print-container" className="hidden">
            <style>
                {`
                @media print {
                body { visibility: hidden; margin: 0; padding: 0; }
                #print-container { display: block !important; visibility: visible !important; position: absolute; top: 0; left: 0; width: 100%; }
                    @page { size: A4; margin: 0.5cm; }
                    .print-page { page-break-after: always; height: 28.7cm; }
                    .print-page:last-child { page-break-after: auto; }
                    * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                }
                `}
            </style>
            
            {chunks.map((chunk, idx) => (
                <div key={idx} className="print-page" style={{ padding: '0.3cm' }}>
                    <div className="grid grid-cols-2 gap-4" style={{ height: '100%', gridTemplateRows: '1fr 1fr' }}>
                        {chunk.map((order: any) => (
                            <div key={order.id} className="break-inside-avoid border border-slate-300" style={{ height: '100%', overflow: 'hidden' }}>
                                <PrintableContent order={order} companyName={companyName} companyPhone={companyPhone} terms={companyTerms} />
                            </div>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
};

// --- المكون الرئيسي ---

const SalesUpdateStatus: React.FC = () => {
  const [user, setUser] = useState<any>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [repsSummary, setRepsSummary] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [openRepOrders, setOpenRepOrders] = useState<any | null>(null);
  const [selectedOrderIds, setSelectedOrderIds] = useState<number[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [openPartialOrder, setOpenPartialOrder] = useState<any | null>(null);
  const [partialProducts, setPartialProducts] = useState<any[]>([]);
  const [partialWarehouse, setPartialWarehouse] = useState<number|undefined>(undefined);
  const [isBarcodeModalOpen, setIsBarcodeModalOpen] = useState(false);
  const [scanInput, setScanInput] = useState('');
  const [scannedBarcodes, setScannedBarcodes] = useState<Array<{ code: string; orderId?: number }>>([]);
  
  // حالة الطباعة
  const [ordersToPrint, setOrdersToPrint] = useState<any[] | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const v = await fetch(`${API_BASE_PATH}/verify.php`, { method: 'POST' });
        const jv = await v.json();
        setUser(jv.user ?? null);

        // 1. Fetch all users to get representative names
        const usersRes = await fetch(`${API_BASE_PATH}/api.php?module=users&action=getAll`);
        const usersJson = await usersRes.json();
        const allReps = (usersJson.success ? (usersJson.data || []) : []).filter((u:any) => u.role === 'representative');
        const repIdToNameMap = new Map(allReps.map((r:any) => [r.id, r.name]));

        // 2. Fetch all orders
        const r = await fetch(`${API_BASE_PATH}/api.php?module=orders&action=getAll`);
        const jr = await r.json();
        const allOrders = (jr.success ? (jr.data||[]) : []);
        setOrders(allOrders);

        // 3. Build reps summary: only reps who have at least one order
        const repsMap: Record<string, any> = {};
        allOrders.forEach((o:any) => {
          const rid = o.rep_id || o.repId || '';
          if (!rid) return;
          if (!repsMap[rid]) {
            repsMap[rid] = { repId: rid, name: repIdToNameMap.get(Number(rid)) || `مندوب #${rid}`, orders: [], productsCount: 0 };
          }
          repsMap[rid].orders.push(o);
          const pcs = (o.products||[]).reduce((s:number,p:any)=> s + Number(p.quantity||p.qty||0), 0);
          repsMap[rid].productsCount += pcs;
        });
        const reps = Object.values(repsMap);
        // For each rep compute balance via transactions API
        for (const ritem of reps) {
          try {
            const tr = await fetch(`${API_BASE_PATH}/api.php?module=transactions&action=getByRelated&related_to_type=rep&related_to_id=${encodeURIComponent(ritem.repId)}`);
            const jtr = await tr.json();
            const bal = (jtr.success ? (jtr.data||[]).reduce((s:any,t:any)=> s + Number(t.amount||0), 0) : 0);
            ritem.balance = bal;
          } catch (e) { ritem.balance = 0; }
          ritem.ordersCount = (ritem.orders || []).length;
        }
        setRepsSummary(reps);
        // load warehouses for returns
        try {
          const w = await fetch(`${API_BASE_PATH}/api.php?module=warehouses&action=getAll`);
          const jw = await w.json();
          setWarehouses(jw.success ? (jw.data||[]) : []);
        } catch (e) { setWarehouses([]); }
      } catch (e) {
        console.error('Failed to load update-status data', e);
        Swal.fire('خطأ', 'فشل تحميل البيانات.', 'error');
      } finally { setLoading(false); }
    };
    load();
  }, []);

  const refreshData = async () => {
    setLoading(true);
    try {
      // 1. Fetch all users to get representative names
      const usersRes = await fetch(`${API_BASE_PATH}/api.php?module=users&action=getAll`);
      const usersJson = await usersRes.json();
      const allReps = (usersJson.success ? (usersJson.data || []) : []).filter((u:any) => u.role === 'representative');
      const repIdToNameMap = new Map(allReps.map((r:any) => [r.id, r.name]));

      // 2. Fetch all orders
      const r = await fetch(`${API_BASE_PATH}/api.php?module=orders&action=getAll`);
      const jr = await r.json();
      const allOrders = (jr.success ? (jr.data||[]) : []);
      setOrders(allOrders);

      // 3. Build reps summary
      const repsMap: Record<string, any> = {};
      allOrders.forEach((o:any) => {
        const rid = o.rep_id || o.repId || '';
        if (!rid) return;
        if (!repsMap[rid]) {
          repsMap[rid] = { repId: rid, name: repIdToNameMap.get(Number(rid)) || `مندوب #${rid}`, orders: [], productsCount: 0 };
        }
        repsMap[rid].orders.push(o);
        const pcs = (o.products||[]).reduce((s:number,p:any)=> s + Number(p.quantity||p.qty||0), 0);
        repsMap[rid].productsCount += pcs;
      });
      const reps = Object.values(repsMap);
      for (const ritem of reps) {
        try {
          const tr = await fetch(`${API_BASE_PATH}/api.php?module=transactions&action=getByRelated&related_to_type=rep&related_to_id=${encodeURIComponent(ritem.repId)}`);
          const jtr = await tr.json();
          const bal = (jtr.success ? (jtr.data||[]).reduce((s:any,t:any)=> s + Number(t.amount||0), 0) : 0);
          ritem.balance = bal;
        } catch (e) { ritem.balance = 0; }
        ritem.ordersCount = (ritem.orders || []).length;
      }
      setRepsSummary(reps);

      try {
        const w = await fetch(`${API_BASE_PATH}/api.php?module=warehouses&action=getAll`);
        const jw = await w.json();
        setWarehouses(jw.success ? (jw.data||[]) : []);
      } catch (e) { setWarehouses([]); }
    } catch (e) {
      console.error('Failed to refresh data', e);
    } finally { setLoading(false); }
  };

  // Translate status codes to Arabic for display
  const translateStatus = (s:any) => {
    if (!s && s !== 0) return '';
    const st = String(s).toLowerCase();
    const map: Record<string,string> = {
      'with_rep': 'مع المندوب',
      'delivered': 'تم التسليم',
      'returned': 'مرتجع',
      'pending': 'مؤجل',
      'in_delivery': 'قيد التسليم',
      'cancelled': 'أُلغي',
      'new': 'جديد'
    };
    return map[st] || s;
  };

  // Prompt user to choose a warehouse from available `warehouses` (or choose empty).
  // Returns: undefined => cancelled, null => no warehouse chosen, number => warehouse id
  const promptWarehouseForReturn = async (): Promise<number|null|undefined> => {
    const options: Record<string,string> = { '': 'بدون' };
    (warehouses || []).forEach((w:any) => { options[String(w.id)] = w.name || (`المستودع ${w.id}`); });
    const res = await Swal.fire({
      title: 'معرّف المستودع للارجاع (اختياري)',
      input: 'select',
      inputOptions: options,
      inputPlaceholder: 'اختر مستودعاً او اتركه بدون',
      showCancelButton: true
    });
    if (res.value === null) return undefined; // cancelled
    if (res.value === '') return null; // chosen 'بدون'
    return Number(res.value);
  };

  // Perform return for currently selected orders (asks optional warehouse like the existing UI)
  const handleReturnSelected = async () => {
    const ids = selectedOrderIds.slice();
    if (ids.length===0) { Swal.fire('تحذير','اختر طلبيات أولاً','warning'); return; }
    const warehouseId = await promptWarehouseForReturn();
    if (warehouseId === undefined) return; // cancelled
    try {
      await Promise.all(ids.map(id => fetch(`${API_BASE_PATH}/api.php?module=orders&action=update`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(Object.assign({ id, status: 'returned' }, warehouseId ? { warehouseId } : {})) })));
      // remove returned orders from rep list
      const removed = (openRepOrders?.orders||[]).filter((o:any)=> ids.includes(o.id));
      setOpenRepOrders((prev:any)=> ({ ...prev, orders: (prev.orders||[]).filter((o:any)=> !ids.includes(o.id)) }));
      try { await refreshData(); } catch(e){ console.error(e); }
      setSelectedOrderIds([]);
      setIsBarcodeModalOpen(false);
      setScanInput('');
      Swal.fire('تم','تم تسجيل المرتجع للمحدد.','success');
    } catch (e) { console.error(e); Swal.fire('خطأ','فشل في العملية.','error'); }
  };

  // تفعيل الطباعة عند تغيير state
  useEffect(() => {
    if (ordersToPrint) {
      setTimeout(() => { 
          window.print(); 
          setOrdersToPrint(null); // Reset after print dialog triggers
      }, 500);
    }
  }, [ordersToPrint]);

  const toggleSelectOrder = (id:number) => {
    setSelectedOrderIds(prev => prev.includes(id) ? prev.filter(x=>x!==id) : [...prev, id]);
  };

  const openOrdersForRep = (rep:any) => {
    setOpenRepOrders(rep);
    setSelectedOrderIds((rep.orders||[]).map((o:any)=>o.id));
  };

  const openPartialEditor = (order:any) => {
    setOpenPartialOrder(order);
    const prods = (order.products||[]).map((p:any) => ({
      productId: p.productId || p.product_id || p.id || 0,
      name: p.name || '',
      qtyOriginal: Number(p.quantity || p.qty || 0),
      deliveredQty: Number(p.quantity || p.qty || 0),
      price: Number(p.price || p.sale_price || 0)
    }));
    setPartialProducts(prods);
  };

  const updatePartialQty = (index:number, val:number) => {
    setPartialProducts(prev => prev.map((pp, i) => i===index ? { ...pp, deliveredQty: Math.max(0, Math.min(pp.qtyOriginal, val)) } : pp));
  };

  const submitPartialDelivery = async (warehouseId?: number) => {
    if (!openPartialOrder) return;
    const deliveredAmount = partialProducts.reduce((s:any,p:any)=> s + (Number(p.deliveredQty||0) * Number(p.price||0)), 0);
    const returnedItems = partialProducts.filter(p=> (p.qtyOriginal - (p.deliveredQty||0)) > 0).map(p=> ({ productId: p.productId, quantity: (p.qtyOriginal - (p.deliveredQty||0)) }));
    try {
      const body:any = { id: openPartialOrder.id, status: 'in_delivery', deliveredAmount };
      if (returnedItems.length>0) { body.returnedItems = returnedItems; }
      if (warehouseId) body.warehouseId = warehouseId;
      const res = await fetch(`${API_BASE_PATH}/api.php?module=orders&action=update`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(body) });
      const j = await res.json();
      if (j.success) {
        // remove order from rep list
        setOpenRepOrders((prev:any)=> ({ ...prev, orders: (prev.orders||[]).filter((o:any)=> o.id !== openPartialOrder.id) }));
        // refresh data from server to ensure consistency
        try { await refreshData(); } catch(e) { console.error(e); }
        setOpenPartialOrder(null);
        setPartialProducts([]);
        Swal.fire('تم','تم حفظ حالة التسليم الجزئي.','success');
      } else {
        console.error('Partial save failed', j);
        Swal.fire('خطأ', j.message || 'فشل حفظ التسليم الجزئي.', 'error');
      }
    } catch (e) {
      console.error(e);
      Swal.fire('خطأ','فشل في الاتصال بالخادم.','error');
    }
  };

  const adjustRepCounts = (repId:any, removedOrders:any[]) => {
    if (!repId) return;
    const removedCount = removedOrders.length || 0;
    const removedProducts = removedOrders.reduce((s:any,o:any)=> s + ((o.products||[]).reduce((ss:number,p:any)=> ss + Number(p.quantity||p.qty||0),0)), 0);
    setRepsSummary(prev => prev.map((r:any) => {
      if (String(r.repId) !== String(repId)) return r;
      return {
        ...r,
        ordersCount: Math.max(0, (r.ordersCount||0) - removedCount),
        productsCount: Math.max(0, (r.productsCount||0) - removedProducts)
      };
    }));
  };

  // وظيفة الطباعة الجديدة الموحدة
  const handlePrintOrders = (ordersList: any[]) => {
      if (!ordersList || ordersList.length === 0) {
          Swal.fire('تنبيه', 'لا توجد طلبيات للطباعة', 'warning');
          return;
      }
      setOrdersToPrint(ordersList);
  };

  const printDailyDocument = (ordersToPrint:any[]) => {
    // Use the A4-style detailed daily report (matches SalesDaily.printA4Report)
    const dateStr = new Date().toLocaleDateString();
    const repName = (ordersToPrint && ordersToPrint.length>0) ? (ordersToPrint[0].rep_name || ordersToPrint[0].repName || openRepOrders?.name || '') : (openRepOrders?.name||'');
    const totalAmount = ordersToPrint.reduce((s,o)=> s + Number(o.subTotal||o.total_amount||o.total||0) + Number(o.shipping||o.shipping_fees||o.shippingCost||0), 0);
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>يومية المندوب</title><style>body{font-family: Arial, Helvetica, "Noto Naskh Arabic", sans-serif; direction:rtl; padding:20px;} h1{text-align:center;} .header{display:flex; justify-content:space-between; align-items:center;} table{width:100%; border-collapse:collapse; margin-top:12px;} th,td{border:1px solid #333; padding:6px; font-size:12px; text-align:right;} th{background:#eee;} </style></head><body>`+
      `<div class="header"><div>${user?.name || ''}</div><div><h1>يومية المندوب</h1></div><div>${repName || ''}</div></div>`+
      `<div style="margin-top:8px">التاريخ: ${dateStr}</div>`+
      `<div style="margin-top:8px">اجمالي اليومية: ${totalAmount}</div>`+
      `<table><thead><tr><th>رقم الطلبيه</th><th>اسم العميل</th><th>الهاتف</th><th>المحافظه</th><th>العنوان</th><th>الموظف</th><th>البيدج</th><th>الإجمالي</th><th>شحن</th><th>الاجمالي الكلي</th><th>ملاحظات</th></tr></thead><tbody>`+
      ordersToPrint.map(o=>`<tr><td>${o.orderNumber||o.order_number||''}</td><td>${o.customerName||o.customer_name||''}</td><td>${o.phone||o.phone1||''}</td><td>${o.governorate||''}</td><td>${o.address||''}</td><td>${o.employee||''}</td><td>${o.page||''}</td><td>${o.subTotal||o.total||0}</td><td>${o.shipping||o.shipping_fees||o.shippingCost||0}</td><td>${o.total||0}</td><td>${o.notes||''}</td></tr>`).join('')+
      `</tbody></table></body></html>`;

    const w = window.open('', '_blank', 'toolbar=0,location=0,menubar=0,scrollbars=1,resizable=1,width=900,height=700');
    if (!w) return; w.document.write(html); w.document.close(); w.focus(); setTimeout(()=>w.print(),400);
  };

  const printDeliveryNote = (ordersList:any[]) => {
    // طباعة إذن التسليم مهيأ لطابعة حرارية 80mm
    const summaryMap: Record<string, { name: string; color: string; size: string; qty: number }> = {};
    (ordersList||[]).forEach(o => (o.products||[]).forEach((p:any) => {
      const key = `${p.name||''}||${p.color||''}||${p.size||''}`;
      if (!summaryMap[key]) summaryMap[key] = { name: p.name||'', color: p.color||'', size: p.size||'', qty: 0 };
      summaryMap[key].qty += Number(p.quantity||p.qty||0);
    }));
    const rows = Object.values(summaryMap);
    const dateStr = new Date().toLocaleString();
    const repName = (ordersList && ordersList.length>0) ? (ordersList[0].rep_name || ordersList[0].repName || '') : '';
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>أذن تسليم</title><style>@page{size:80mm auto; margin:4mm;} body{font-family: Arial, Helvetica, "Noto Naskh Arabic", sans-serif; direction:rtl; padding:6px; width:80mm; box-sizing:border-box; font-size:12px;} h2{text-align:center; font-size:14px;} table{width:100%; border-collapse:collapse;} th,td{font-size:12px; padding:4px; border-bottom:1px solid #ddd;} th{font-weight:700; text-align:right;} .footer{margin-top:8px; font-size:12px;} </style></head><body>`+
      `<h2>أذن تسليم</h2><div>التاريخ: ${dateStr}</div><div>المندوب: ${repName}</div>`+
      `<table><thead><tr><th>المنتج</th><th>اللون</th><th>المقاس</th><th>الكمية</th></tr></thead><tbody>`+
      rows.map(r=>`<tr><td>${r.name}</td><td>${r.color}</td><td>${r.size}</td><td style="text-align:left">${r.qty}</td></tr>`).join('')+
      `</tbody></table>`+
      `<div class="footer">اجمالي منتجات: ${rows.length}<br/>اجمالي قطع: ${rows.reduce((s,r)=>s + r.qty,0)}</div>`+
      `</body></html>`;
    const w = window.open('', '_blank', 'toolbar=0,location=0,menubar=0,scrollbars=1,resizable=1,width=900,height=700');
    if (!w) return; w.document.write(html); w.document.close(); w.focus(); setTimeout(()=>w.print(),400);
  };

  return (
    <div className="p-4 rounded-2xl border border-card dir-rtl card" style={{ backgroundColor: 'var(--card-bg)', color: 'var(--text)' }}>
      
      {/* Hidden Print Container for 2x2 Layout */}
      {ordersToPrint && <PrintableOrders orders={ordersToPrint} />}

      <h2 className="font-black mb-3">تحديث حالة الطلبيه</h2>
      {loading ? <div className="text-sm text-slate-500">جاري التحميل...</div> : (
        <div>
          {repsSummary.length === 0 ? (
            <p className="text-sm text-slate-500">لا توجد مندوبين لديهم طلبيات.</p>
          ) : (
            <div className="space-y-3">
              {repsSummary.map((rep:any) => (
                <div key={rep.repId} className="p-3 border rounded-lg flex justify-between items-center bg-slate-50">
                  <div>
                    <div className="font-bold">{rep.name || ('مندوب #' + rep.repId)}</div>
                    <div className="text-sm text-slate-500">عدد الطلبيات: <span className="font-black">{rep.ordersCount}</span> — عدد المنتجات: <span className="font-black">{rep.productsCount}</span></div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className={`px-3 py-2 rounded-lg font-bold border border-card card`} style={{ backgroundColor: 'var(--card-bg)', color: 'var(--text)' }}>
                      <span style={{ color: (rep.balance>0? 'green' : (rep.balance<0? 'red' : '#000')) }}>{Math.abs(Number(rep.balance||0)).toLocaleString()} ج.م</span>
                      <span className="mx-2 font-bold" style={{ color: (rep.balance>0? 'green' : (rep.balance<0? 'red' : '#666')) }}>{rep.balance>0? 'له' : (rep.balance<0? 'عليه' : '')}</span>
                    </div>
                    <button onClick={() => openOrdersForRep(rep)} className="bg-blue-600 text-white px-3 py-2 rounded-lg text-xs font-bold hover:bg-blue-700">عرض الطلبيات</button>
                    <button onClick={() => { printDailyDocument(rep.orders); }} className="bg-amber-500 text-white px-3 py-2 rounded-lg text-xs font-bold hover:bg-amber-600">عرض اليومية</button>
                    <button onClick={() => { printDeliveryNote(rep.orders); }} className="bg-emerald-600 text-white px-3 py-2 rounded-lg text-xs font-bold hover:bg-emerald-700">أذن التسليم</button>
                    <button onClick={() => handlePrintOrders(rep.orders)} className="bg-sky-600 text-white px-3 py-2 rounded-lg text-xs font-bold hover:bg-sky-700">طباعة بوالص الشحن فقط</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modal for rep orders */}
      {openRepOrders && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="rounded-2xl w-full max-w-4xl p-6 shadow-2xl flex flex-col max-h-[90vh] card border border-card" style={{ backgroundColor: 'var(--card-bg)', color: 'var(--text)' }}>
              <div className="flex justify-between items-center mb-4 border-b pb-3">
              <h3 className="font-black text-lg">طلبيات المندوب: {openRepOrders.name}</h3>
              <div className="flex items-center gap-2">
                <button onClick={() => setIsBarcodeModalOpen(true)} className="px-3 py-1.5 rounded-lg bg-purple-600 text-white text-xs font-bold hover:bg-purple-700">مسح بالباركود</button>
                <button onClick={() => { const sels = (openRepOrders.orders||[]).map((o:any)=>o.id); setSelectedOrderIds(sels); }} className="px-3 py-1.5 rounded-lg bg-slate-100 text-xs font-bold hover:bg-slate-200">تحديد الكل</button>
                <button onClick={() => { setSelectedOrderIds([]); }} className="px-3 py-1.5 rounded-lg bg-slate-100 text-xs font-bold hover:bg-slate-200">إلغاء التحديد</button>
                <button onClick={() => setOpenRepOrders(null)} className="px-3 py-1.5 rounded-lg bg-red-100 text-red-600 text-xs font-bold hover:bg-red-200">إغلاق</button>
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto mb-4 space-y-2 pr-2">
              {(openRepOrders.orders||[]).map((o:any)=> (
                <div key={o.id} className={`flex items-center justify-between p-3 border rounded-xl hover:bg-slate-50 transition-colors ${selectedOrderIds.includes(o.id) ? 'border-blue-500 bg-blue-50/30' : 'border-slate-200'}`}>
                  <label className="flex items-center gap-3 flex-1 cursor-pointer">
                    <input type="checkbox" className="w-5 h-5 rounded text-blue-600 focus:ring-blue-500" checked={selectedOrderIds.includes(o.id)} onChange={()=>toggleSelectOrder(o.id)} />
                    <div className="flex-1">
                      <div className="flex justify-between">
                          <div className="font-bold text-slate-800">#{o.orderNumber||o.order_number} — {o.customerName||o.customer_name}</div>
                          <div className="font-bold text-blue-600">{(Number(o.total_amount||o.total) + Number(o.shipping_fees||o.shipping)).toLocaleString()} ج.م</div>
                      </div>
                      <div className="text-xs text-slate-500 mt-1 flex gap-4">
                          <span>عدد القطع: {(o.products||[]).reduce((s:number,p:any)=> s + Number(p.quantity||p.qty||0),0)}</span>
                          <span>المحافظة: {o.governorate}</span>
                          <span>الحالة: {translateStatus(o.status)}</span>
                      </div>
                    </div>
                  </label>

                  <div className="flex items-center gap-2 ml-3">
                    <button onClick={(e)=>{ e.stopPropagation(); openPartialEditor(o); }} className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700">تسليم جزئي</button>
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-4 border-t flex flex-wrap gap-2 justify-end">
              {/* Barcode scanning modal (opened by header button) */}
              {isBarcodeModalOpen && (
                  <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
                  <div className="rounded-2xl w-full max-w-xl p-6 shadow-2xl card border border-card" style={{ backgroundColor: 'var(--card-bg)', color: 'var(--text)' }}>
                    <div className="flex justify-between items-center mb-3">
                      <h4 className="font-bold">مسح باركود — امسح باركود المنتجات لاختيار الطلبيات المرتجعة</h4>
                      <button onClick={()=> { setIsBarcodeModalOpen(false); setScanInput(''); }} className="text-red-600">إغلاق</button>
                    </div>
                    <div className="mb-3">
                      <p className="text-sm text-slate-500">ضع مؤشر الكتابة على حقل المسح ثم استخدم جهاز قارئ الباركود (سيتم ارسال Enter بعد القراءة تلقائياً).</p>
                    </div>
                    <div className="flex gap-2 mb-3">
                      <input autoFocus value={scanInput} onChange={e=> setScanInput(e.target.value)} onKeyDown={async (e)=>{
                        if (e.key === 'Enter') {
                          const code = (scanInput||'').trim();
                          if (!code) return;
                          const matches = (openRepOrders?.orders||[]).filter((o:any) => {
                            // match by order number / id OR by product barcode fields
                            const orderNums = [o.orderNumber || o.order_number || o.id || ''].map((x:any)=> String(x));
                            if (orderNums.includes(code)) return true;
                            return (o.products||[]).some((p:any)=> {
                              const cand = String(p.barcode || p.barcode_value || p.code || p.sku || p.product_barcode || '');
                              return cand === code;
                            });
                          });
                          if (matches.length>0) {
                            const ids = matches.map((m:any)=> m.id);
                            setSelectedOrderIds(prev => Array.from(new Set([...prev, ...ids])));
                            setScannedBarcodes(prev => [{ code, orderId: ids[0] }, ...prev]);
                            Swal.fire({ icon: 'success', title: 'تم الاختيار', text: `تم تحديد ${ids.length} طلبية/طلبات تحتوي على هذا الباركود`, timer: 1200, showConfirmButton: false });
                          } else {
                            setScannedBarcodes(prev => [{ code, orderId: undefined }, ...prev]);
                            Swal.fire({ icon: 'warning', title: 'لم يتم العثور', text: `لا توجد طلبيات تحتوي على الباركود ${code}`, timer: 1400, showConfirmButton: false });
                          }
                          setScanInput('');
                        }
                      }} className="w-full border rounded p-2" placeholder="امسح باركود هنا ثم انتظر" />
                      <button onClick={() => { const code = (scanInput||'').trim(); if (!code) return; const matches = (openRepOrders?.orders||[]).filter((o:any) => { const orderNums = [o.orderNumber || o.order_number || o.id || ''].map((x:any)=> String(x)); if (orderNums.includes(code)) return true; return (o.products||[]).some((p:any)=> { const cand = String(p.barcode || p.barcode_value || p.code || p.sku || p.product_barcode || ''); return cand === code; }); }); if (matches.length>0) { const ids = matches.map((m:any)=> m.id); setSelectedOrderIds(prev => Array.from(new Set([...prev, ...ids]))); setScannedBarcodes(prev => [{ code, orderId: ids[0] }, ...prev]); Swal.fire({ icon: 'success', title: 'تم الاختيار', text: `تم تحديد ${ids.length} طلبية/طلبات تحتوي على هذا الباركود`, timer: 1200, showConfirmButton: false }); } else { setScannedBarcodes(prev => [{ code, orderId: undefined }, ...prev]); Swal.fire({ icon: 'warning', title: 'لم يتم العثور', text: `لا توجد طلبيات تحتوي على الباركود ${code}`, timer: 1400, showConfirmButton: false }); } setScanInput(''); }} className="px-3 py-2 bg-blue-600 text-white rounded">تحقق</button>
                    </div>

                    <div className="max-h-48 overflow-y-auto border rounded p-2">
                      <h5 className="font-bold text-sm mb-2">الباركودات الممسوحة حديثاً</h5>
                      {scannedBarcodes.length === 0 ? <div className="text-sm text-slate-500">لا توجد عمليات مسح بعد.</div> : (
                        <div className="space-y-2">
                          {scannedBarcodes.map((s, idx) => (
                            <div key={idx} className="flex items-center justify-between border-b py-1">
                              <div className="text-right">
                                <div className="font-bold">{s.code}</div>
                                <div className="text-xs text-slate-500">{s.orderId ? `مطابقة لطلبية #${s.orderId}` : 'لم يتم العثور على تطابق'}</div>
                              </div>
                              <div className="flex gap-2">
                                {s.orderId && <button onClick={()=> { setSelectedOrderIds(prev => prev.includes(s.orderId!) ? prev.filter(x=>x!==s.orderId) : [...prev, s.orderId!]); }} className="px-2 py-1 text-xs bg-slate-100 rounded">تبديل اختيار</button>}
                                <button onClick={()=> setScannedBarcodes(prev => prev.filter((_,i)=> i!==idx))} className="px-2 py-1 text-xs bg-red-100 text-red-600 rounded">حذف</button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex justify-end gap-2 mt-4">
                      <button onClick={handleReturnSelected} className="px-4 py-2 bg-rose-600 text-white rounded">تم</button>
                      <button onClick={()=> { setIsBarcodeModalOpen(false); setScanInput(''); }} className="px-4 py-2 bg-slate-100 rounded">إغلاق</button>
                    </div>
                  </div>
                </div>
              )}
              <button onClick={() => handlePrintOrders(openRepOrders.orders.filter((o:any) => selectedOrderIds.includes(o.id)))} className="px-5 py-2.5 bg-slate-800 text-white rounded-xl font-bold shadow-lg hover:bg-slate-700">طباعة بوالص الشحن فقط</button>
              
              <div className="w-px bg-slate-300 mx-2"></div>

              <button onClick={async ()=>{
                const ids = selectedOrderIds.slice();
                if (ids.length === 0) { Swal.fire('تحذير','اختر طلبيات أولاً','warning'); return; }
                try {
                  await Promise.all(ids.map(id => fetch(`${API_BASE_PATH}/api.php?module=orders&action=update`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ id, status: 'delivered' }) })));
                  // remove delivered orders from the rep list
                  const removed = (openRepOrders?.orders||[]).filter((o:any)=> ids.includes(o.id));
                  setOpenRepOrders((prev:any)=> ({ ...prev, orders: (prev.orders||[]).filter((o:any)=> !ids.includes(o.id)) }));
                  try { await refreshData(); } catch(e){ console.error(e); }
                  setSelectedOrderIds([]);
                  Swal.fire('تم','تم تسليم الطلبيات المحددة.','success');
                } catch (e) { console.error(e); Swal.fire('خطأ','فشل في العملية.','error'); }
              }} className="px-5 py-2.5 bg-emerald-600 text-white rounded-xl font-bold shadow-lg hover:bg-emerald-700">تسليم المحدد</button>
              
              <button onClick={async ()=>{
                const ids = selectedOrderIds.slice();
                if (ids.length===0) { Swal.fire('تحذير','اختر طلبيات أولاً','warning'); return; }
                // ask for optional warehouse id to restock returns (select from available warehouses)
                const warehouseId = await promptWarehouseForReturn();
                if (warehouseId === undefined) return; // cancelled
                try {
                  await Promise.all(ids.map(id => fetch(`${API_BASE_PATH}/api.php?module=orders&action=update`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(Object.assign({ id, status: 'returned' }, warehouseId ? { warehouseId } : {})) })));
                  // remove returned orders from rep list
                  const removed = (openRepOrders?.orders||[]).filter((o:any)=> ids.includes(o.id));
                  setOpenRepOrders((prev:any)=> ({ ...prev, orders: (prev.orders||[]).filter((o:any)=> !ids.includes(o.id)) }));
                  try { await refreshData(); } catch(e){ console.error(e); }
                  setSelectedOrderIds([]);
                  Swal.fire('تم','تم تسجيل المرتجع للمحدد.','success');
                } catch (e) { console.error(e); Swal.fire('خطأ','فشل في العملية.','error'); }
              }} className="px-5 py-2.5 bg-rose-600 text-white rounded-xl font-bold shadow-lg hover:bg-rose-700">مرتجع كلي</button>
              
              <button onClick={async ()=>{
                const ids = selectedOrderIds.slice();
                if (ids.length===0) { Swal.fire('تحذير','اختر طلبيات أولاً','warning'); return; }
                try {
                  await Promise.all(ids.map(id => fetch(`${API_BASE_PATH}/api.php?module=orders&action=update`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ id, status: 'pending' }) })));
                  // keep postponed orders assigned to rep and only update their status locally
                  setOpenRepOrders((prev:any)=> ({ ...prev, orders: (prev.orders||[]).map((o:any)=> ids.includes(o.id)? {...o, status:'pending'}: o) }));
                  setSelectedOrderIds([]);
                  Swal.fire('تم','تم تأجيل الطلبيات في عهدة المندوب.','success');
                } catch (e) { console.error(e); Swal.fire('خطأ','فشل في العملية.','error'); }
              }} className="px-5 py-2.5 bg-yellow-500 text-white rounded-xl font-bold shadow-lg hover:bg-yellow-600">تأجيل (لم يسلم)</button>
              
              
            </div>

            {/* Partial-delivery editor modal */}
            {openPartialOrder && (
              <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-60">
                <div className="rounded-xl w-full max-w-2xl p-4 shadow-xl card border border-card" style={{ backgroundColor: 'var(--card-bg)', color: 'var(--text)' }}>
                  <div className="flex justify-between items-center mb-3">
                    <h4 className="font-bold">تسليم جزئي للطلب: #{openPartialOrder.orderNumber || openPartialOrder.order_number}</h4>
                    <button onClick={()=>{ setOpenPartialOrder(null); setPartialProducts([]); setPartialWarehouse(undefined); }} className="text-red-600">إغلاق</button>
                  </div>
                  <div className="max-h-64 overflow-y-auto">
                    {partialProducts.map((p:any, idx:number) => (
                      <div key={p.productId + '-' + idx} className="flex items-center justify-between gap-3 border-b py-2">
                        <div className="flex-1 text-right">
                          <div className="font-bold">{p.name}</div>
                          <div className="text-xs text-slate-500">الكمية الأصلية: {p.qtyOriginal} — السعر: {p.price}</div>
                        </div>
                        <div className="w-36">
                          <input type="number" min={0} max={p.qtyOriginal} value={p.deliveredQty} onChange={(e)=> updatePartialQty(idx, Number(e.target.value))} className="w-full border rounded p-1 text-center" />
                        </div>
                      </div>
                    ))}
                  </div>

                  {warehouses && warehouses.length > 0 && (
                    <div className="mt-3">
                      <label className="block text-sm font-bold mb-1">مستودع لإرجاع الباقي (اختياري)</label>
                      <select value={partialWarehouse ?? ''} onChange={e=> setPartialWarehouse(e.target.value ? Number(e.target.value) : undefined)} className="w-full border rounded p-2">
                        <option value="">بدون</option>
                        {warehouses.map((w:any) => <option key={w.id} value={w.id}>{w.name || w.title || ('المستودع ' + w.id)}</option>)}
                      </select>
                    </div>
                  )}

                  <div className="flex justify-end gap-2 mt-4">
                    <button onClick={()=>{ setOpenPartialOrder(null); setPartialProducts([]); setPartialWarehouse(undefined); }} className="px-4 py-2 bg-slate-100 rounded">إلغاء</button>
                    <button onClick={()=> submitPartialDelivery(partialWarehouse)} className="px-4 py-2 bg-indigo-600 text-white rounded">حفظ التسليم الجزئي</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default SalesUpdateStatus;
