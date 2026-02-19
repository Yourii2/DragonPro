import React, { useEffect, useState } from 'react';
import Swal from 'sweetalert2';
import { API_BASE_PATH } from '../services/apiConfig';
import CustomSelect from './CustomSelect';
import { PrintableContent, PrintableOrders, PrintableOrdersSingle } from './PrintTemplates';

// --- المكون الرئيسي ---

const SalesUpdateStatus: React.FC = () => {
  const deliveryMethod = (localStorage.getItem('Dragon_delivery_method') || 'reps').toString();
  const isShippingMode = deliveryMethod === 'shipping';

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
  const [printSinglePerPage, setPrintSinglePerPage] = useState<boolean>(false);
  const [paidNow, setPaidNow] = useState<number>(0);

  useEffect(() => {
    const load = async () => {
      try {
        const v = await fetch(`${API_BASE_PATH}/verify.php`, { method: 'POST' });
        const jv = await v.json();
        setUser(jv.user ?? null);

        // 1. Fetch assignees (reps or shipping companies)
        let repIdToNameMap = new Map<number, any>();
        if (isShippingMode) {
          const cRes = await fetch(`${API_BASE_PATH}/api.php?module=shipping_companies&action=getAll`);
          const cJson = await cRes.json();
          const allCompanies = (cJson.success ? (cJson.data || []) : []);
          repIdToNameMap = new Map(allCompanies.map((c:any) => [Number(c.id), String(c.name || '')]));
        } else {
          // fetch reps with server-provided balance
          const usersRes = await fetch(`${API_BASE_PATH}/api.php?module=users&action=getAllWithBalance&related_to_type=rep`);
          const usersJson = await usersRes.json();
          const allReps = (usersJson.success ? (usersJson.data || []) : []).filter((u:any) => u.role === 'representative');
          // store the whole user object so we can read `balance` later
          repIdToNameMap = new Map(allReps.map((r:any) => [Number(r.id), r]));
        }

        // 2. Fetch all orders
        const r = await fetch(`${API_BASE_PATH}/api.php?module=orders&action=getAll`);
        const jr = await r.json();
        const allOrders = (jr.success ? (jr.data||[]) : []);
        setOrders(allOrders);

        // 3. Build summary: only assignees who have at least one order
        const repsMap: Record<string, any> = {};
        allOrders.forEach((o:any) => {
          const rid = isShippingMode ? (o.shipping_company_id || o.shippingCompanyId || '') : (o.rep_id || o.repId || '');
          if (!rid) return;
          if (!repsMap[rid]) {
            const lookup = repIdToNameMap.get(Number(rid));
            const name = lookup ? (typeof lookup === 'object' ? ((lookup as any).name || String(lookup)) : String(lookup)) : (isShippingMode ? `شركة شحن #${rid}` : `مندوب #${rid}`);
            repsMap[rid] = { repId: rid, name, orders: [], productsCount: 0 };
          }
          repsMap[rid].orders.push(o);
          const pcs = (o.products||[]).reduce((s:number,p:any)=> s + Number(p.quantity||p.qty||0), 0);
          repsMap[rid].productsCount += pcs;
        });
        const reps = Object.values(repsMap);
        // For each rep prefer server-provided balance (reps mode only)
        // repIdToNameMap may contain user objects when fetched via getAllWithBalance
        for (const ritem of reps) {
          if (!isShippingMode) {
            const u = repIdToNameMap.get(Number(ritem.repId));
            ritem.balance = u && (typeof u === 'object') ? Number((u as any).balance || 0) : 0;
          } else {
            ritem.balance = 0;
          }
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
      // 1. Fetch assignees (reps or shipping companies)
      let repIdToNameMap = new Map<number, any>();
      if (isShippingMode) {
        const cRes = await fetch(`${API_BASE_PATH}/api.php?module=shipping_companies&action=getAll`);
        const cJson = await cRes.json();
        const allCompanies = (cJson.success ? (cJson.data || []) : []);
        repIdToNameMap = new Map(allCompanies.map((c:any) => [Number(c.id), String(c.name || '')]));
        } else {
        // fetch reps with server-provided balance
        const usersRes = await fetch(`${API_BASE_PATH}/api.php?module=users&action=getAllWithBalance&related_to_type=rep`);
        const usersJson = await usersRes.json();
        const allReps = (usersJson.success ? (usersJson.data || []) : []).filter((u:any) => u.role === 'representative');
        repIdToNameMap = new Map(allReps.map((r:any) => [Number(r.id), r]));
      }

      // 2. Fetch all orders
      const r = await fetch(`${API_BASE_PATH}/api.php?module=orders&action=getAll`);
      const jr = await r.json();
      const allOrders = (jr.success ? (jr.data||[]) : []);
      setOrders(allOrders);

      // 3. Build summary
      const repsMap: Record<string, any> = {};
      allOrders.forEach((o:any) => {
        const rid = isShippingMode ? (o.shipping_company_id || o.shippingCompanyId || '') : (o.rep_id || o.repId || '');
        if (!rid) return;
        if (!repsMap[rid]) {
          repsMap[rid] = { repId: rid, name: repIdToNameMap.get(Number(rid)) || (isShippingMode ? `شركة شحن #${rid}` : `مندوب #${rid}`), orders: [], productsCount: 0 };
        }
        repsMap[rid].orders.push(o);
        const pcs = (o.products||[]).reduce((s:number,p:any)=> s + Number(p.quantity||p.qty||0), 0);
        repsMap[rid].productsCount += pcs;
      });
      const reps = Object.values(repsMap);
      for (const ritem of reps) {
        if (!isShippingMode) {
          const u = repIdToNameMap.get(Number(ritem.repId));
          ritem.balance = u && (typeof u === 'object') ? Number((u as any).balance || 0) : 0;
        } else {
          ritem.balance = 0;
        }
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

  const computeOrderSubtotal = (o:any) => {
    if (!o) return 0;
    if (o.subTotal !== undefined) return Number(o.subTotal || 0);
    if (o.sub_total !== undefined) return Number(o.sub_total || 0);
    // prefer order_items if present
    if (o.order_items && Array.isArray(o.order_items) && o.order_items.length>0) {
      return o.order_items.reduce((s:any,it:any) => s + (Number(it.quantity||it.qty||0) * Number(it.price||it.sale_price||it.unit_price||0)), 0);
    }
    // fallback to products list
    if (o.products && Array.isArray(o.products) && o.products.length>0) {
      return o.products.reduce((s:any,p:any) => s + (Number(p.quantity||p.qty||0) * Number(p.price||p.sale_price||0)), 0);
    }
    // if total includes shipping, subtract shipping if present
    if (o.total_amount !== undefined && o.shipping_fees !== undefined) return Number(o.total_amount || 0) - Number(o.shipping_fees || 0);
    if (o.total !== undefined && o.shipping !== undefined) return Number(o.total || 0) - Number(o.shipping || 0);
    return Number(o.total_amount || o.total || 0);
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
      setOpenRepOrders((prev:any)=> (prev ? ({ ...prev, orders: (prev.orders||[]).filter((o:any)=> !ids.includes(o.id)) }) : prev));
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
          setPrintSinglePerPage(false);
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
        setOpenRepOrders((prev:any)=> (prev ? ({ ...prev, orders: (prev.orders||[]).filter((o:any)=> o.id !== openPartialOrder.id) }) : prev));
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

  /* const printDailyDocument = (ordersToPrint:any[]) => {
    // Use the A4-style detailed daily report (matches SalesDaily.printA4Report)
    const dateStr = new Date().toLocaleDateString();
    const repName = (ordersToPrint && ordersToPrint.length>0)
      ? (openRepOrders?.name || ordersToPrint[0].rep_name || ordersToPrint[0].repName || '')
      : (openRepOrders?.name||'');
    // compute totals and summary fields
    const parseDate = (o:any) => new Date(o.created_at || o.createdAt || o.date || o.order_date || o.orderDate || Date.now());
    const isSameDay = (a:Date,b:Date) => a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth() && a.getDate()===b.getDate();
    const today = new Date();
    const allOrders = ordersToPrint || [];
    const todayOrders = allOrders.filter((o:any)=> isSameDay(parseDate(o), today));
    const oldOrders = allOrders.filter((o:any)=> !isSameDay(parseDate(o), today));
    const todayValue = todayOrders.reduce((s:any,o:any)=> s + computeOrderSubtotal(o), 0);
    const todayOrdersCount = todayOrders.length;
    const todayPieces = todayOrders.reduce((s:any,o:any)=> s + ((o.products||[]).reduce((ss:number,p:any)=> ss + Number(p.quantity||p.qty||0),0)), 0);
    const oldOrdersCount = oldOrders.length;
    const oldPieces = oldOrders.reduce((s:any,o:any)=> s + ((o.products||[]).reduce((ss:number,p:any)=> ss + Number(p.quantity||p.qty||0),0)), 0);
    const totalOrdersCount = allOrders.length;
    const totalPieces = allOrders.reduce((s:any,o:any)=> s + ((o.products||[]).reduce((ss:number,p:any)=> ss + Number(p.quantity||p.qty||0),0)), 0);
    // try to obtain previous balance from openRepOrders or repsSummary lookup
    let prevBalance = Number(openRepOrders?.balance || 0);
    try {
      if ((!prevBalance || prevBalance===0) && allOrders.length>0) {
        const repId = allOrders[0].rep_id || allOrders[0].repId || allOrders[0].shipping_company_id || allOrders[0].shippingCompanyId || null;
        if (repId) {
          const found = (repsSummary||[]).find((r:any) => String(r.repId) === String(repId));
          if (found) prevBalance = Number(found.balance || 0);
        }
      }
    } catch(e) { prevBalance = Number(openRepOrders?.balance || 0); }
    const finalDebtBefore = prevBalance - todayValue;
    const paidNowStatic = 0;
    const remainingAfter = finalDebtBefore + paidNowStatic;
    const totalAmount = allOrders.reduce((s:any,o:any)=> s + computeOrderSubtotal(o) + Number(o.shipping||o.shipping_fees||o.shippingCost||0), 0);
    const reportTitle = isShippingMode ? 'يومية الشحن' : 'يومية المندوب';
    const assigneeLabel = isShippingMode ? 'شركة الشحن' : 'المندوب';
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>${reportTitle}</title><style>body{font-family: Arial, Helvetica, "Noto Naskh Arabic", sans-serif; direction:rtl; padding:20px;} h1{text-align:center;} .header{display:flex; justify-content:space-between; align-items:center;} table{width:100%; border-collapse:collapse; margin-top:12px;} th,td{border:1px solid #333; padding:6px; font-size:12px; text-align:right;} th{background:#eee;} .summary{margin-top:10px; border:1px solid #ccc; padding:8px; background:#fafafa;} .summary .row{display:flex; justify-content:space-between; gap:8px; margin-bottom:6px;} .summary .label{font-weight:600; width:40%;} .summary .val{width:60%; text-align:left;} </style></head><body>`+
      `<div class="header"><div>${user?.name || ''}</div><div><h1>${reportTitle}</h1></div><div></div></div>`+
      `<div class="summary">`+
        `<!-- Row 1: date right, rep name center -->`+
        `<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">`+
          `<div style="text-align:right; width:33%;">التاريخ: ${dateStr}</div>`+
          `<div style="text-align:center; width:34%; font-weight:900; font-size:16px;">${repName || ''}</div>`+
          `<div style="text-align:left; width:33%;"></div>`+
        `</div>`+
        `<!-- Row 2: stats boxes -->`+
        `<div style="display:flex; gap:10px; justify-content:space-between; margin-bottom:8px;">`+
          `<div style="flex:1; text-align:center; border:1px solid #e2e8f0; padding:8px; border-radius:6px; background:#ffffff;"><div style="font-weight:800;">طلبيات قديمة</div><div style="font-size:14px;">${oldOrdersCount}</div></div>`+
          `<div style="flex:1; text-align:center; border:1px solid #e2e8f0; padding:8px; border-radius:6px; background:#ffffff;"><div style="font-weight:800;">قطع قديمة</div><div style="font-size:14px;">${oldPieces}</div></div>`+
          `<div style="flex:1; text-align:center; border:1px solid #e2e8f0; padding:8px; border-radius:6px; background:#ffffff;"><div style="font-weight:800;">طلبات اليوم</div><div style="font-size:14px;">${todayOrdersCount}</div></div>`+
          `<div style="flex:1; text-align:center; border:1px solid #e2e8f0; padding:8px; border-radius:6px; background:#ffffff;"><div style="font-weight:800;">قطع اليوم</div><div style="font-size:14px;">${todayPieces}</div></div>`+
        `</div>`+
        `<!-- Row 3: totals boxes -->`+
        `<div style="display:flex; gap:10px; justify-content:space-between; margin-bottom:8px;">`+
          `<div style="flex:1; text-align:center; border:1px solid #e2e8f0; padding:8px; border-radius:6px; background:#ffffff;"><div style="font-weight:800;">اجمالى الطلبيات</div><div style="font-size:14px;">${totalOrdersCount}</div></div>`+
          `<div style="flex:1; text-align:center; border:1px solid #e2e8f0; padding:8px; border-radius:6px; background:#ffffff;"><div style="font-weight:800;">اجمالى القطع</div><div style="font-size:14px;">${totalPieces}</div></div>`+
        `</div>`+
        `<!-- Row 4: balances -->`+
        `<div style="display:flex; gap:10px; justify-content:space-between; margin-bottom:8px;">`+
          `<div style="flex:1; text-align:center; border:1px solid #e2e8f0; padding:8px; border-radius:6px; background:#ffffff;"><div style="font-weight:800;">حساب قديم</div><div style="font-size:14px;">${Math.abs(prevBalance).toLocaleString()} ج.م</div></div>`+
          `<div style="flex:1; text-align:center; border:1px solid #e2e8f0; padding:8px; border-radius:6px; background:#ffffff;"><div style="font-weight:800;">حساب اليوم</div><div style="font-size:14px;">${todayValue.toLocaleString()} ج.م</div></div>`+
          `<div style="flex:1; text-align:center; border:1px solid #e2e8f0; padding:8px; border-radius:6px; background:#ffffff;"><div style="font-weight:800;">الحساب الحالى</div><div style="font-size:14px;">${Math.abs(finalDebtBefore).toLocaleString()} ج.م</div></div>`+
        `</div>`+
        `<!-- Row 5: payment -->`+
        `<div style="display:flex; gap:10px; justify-content:space-between;">`+
          `<div style="flex:1; text-align:center; border:1px solid #e2e8f0; padding:8px; border-radius:6px; background:#ffffff;"><div style="font-weight:800;">المبلغ المدفوع</div><div style="font-size:14px;">${paidNowStatic.toLocaleString()} ج.م</div></div>`+
          `<div style="flex:1; text-align:center; border:1px solid #e2e8f0; padding:8px; border-radius:6px; background:#ffffff;"><div style="font-weight:800;">المبلغ المتبقي</div><div style="font-size:14px;">${Math.abs(remainingAfter).toLocaleString()} ج.م</div></div>`+
        `</div>`+
      `</div>`+
      `${isShippingMode ? '' : `<div style="margin-top:8px">اجمالي اليومية: ${totalAmount}</div>`}`+
      `<div style="margin-top:8px">${assigneeLabel}: ${repName || ''}</div>`+
      `<table><thead><tr><th>رقم الطلبيه</th><th>اسم العميل</th><th>الهاتف</th><th>المحافظه</th><th>العنوان</th><th>الموظف</th><th>البيدج</th><th>الإجمالي</th><th>شحن</th><th>الاجمالي الكلي</th><th>ملاحظات</th></tr></thead><tbody>`+
      allOrders.map(o=>`<tr><td>${o.orderNumber||o.order_number||''}</td><td>${o.customerName||o.customer_name||''}</td><td>${o.phone||o.phone1||''}</td><td>${o.governorate||''}</td><td>${o.address||''}</td><td>${o.employee||''}</td><td>${o.page||''}</td><td>${computeOrderSubtotal(o)}</td><td>${o.shipping||o.shipping_fees||o.shippingCost||0}</td><td>${o.total||0}</td><td>${o.notes||''}</td></tr>`).join('')+
      `</tbody></table></body></html>`;

    const w = window.open('', '_blank', 'toolbar=0,location=0,menubar=0,scrollbars=1,resizable=1,width=900,height=700');
    if (!w) return; w.document.write(html); w.document.close(); w.focus(); setTimeout(()=>w.print(),400);
  }; */
   const printDailyDocument = (ordersToPrint:any[]) => {
    const dateStr = new Date().toLocaleDateString();
    
    // --- 1. تحديد اسم المندوب ---
    let repName = '';
    if (ordersToPrint && ordersToPrint.length > 0) {
      const firstOrder = ordersToPrint[0];
      const repId = firstOrder.rep_id || firstOrder.repId || firstOrder.shipping_company_id || firstOrder.shippingCompanyId;
      
      if (repId && typeof repsSummary !== 'undefined') {
        const found = repsSummary.find((r:any) => String(r.repId) === String(repId));
        if (found) repName = found.name;
      }
      if (!repName) {
        repName = firstOrder.rep_name || firstOrder.repName || firstOrder.representative || openRepOrders?.name || '';
      }
    } else {
      repName = openRepOrders?.name || '';
    }
    
    // --- 2. حساب الإجماليات بدقة (وتجاهل الأخطاء في الداتا القديمة) ---
    const parseDate = (o:any) => new Date(o.created_at || o.createdAt || o.date || o.order_date || o.orderDate || Date.now());
    const isSameDay = (a:Date,b:Date) => a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth() && a.getDate()===b.getDate();
    const today = new Date();
    const allOrders = ordersToPrint || [];
    
    const todayOrders = allOrders.filter((o:any)=> isSameDay(parseDate(o), today));
    const oldOrders = allOrders.filter((o:any)=> !isSameDay(parseDate(o), today));
    
    const todayValue = todayOrders.reduce((s:any,o:any)=> s + computeOrderSubtotal(o), 0);
    const totalAmount = allOrders.reduce((s:any,o:any)=> s + computeOrderSubtotal(o), 0);
    
    // حساب إجمالي التحصيل الفعلي (منتجات + شحن)
    const totalRequiredToCollect = allOrders.reduce((s:any,o:any)=> s + computeOrderSubtotal(o) + Number(o.shipping||o.shipping_fees||o.shippingCost||0), 0);
    
    const todayOrdersCount = todayOrders.length;
    const todayPieces = todayOrders.reduce((s:any,o:any)=> s + ((o.products||[]).reduce((ss:number,p:any)=> ss + Number(p.quantity||p.qty||0),0)), 0);
    const oldOrdersCount = oldOrders.length;
    const oldPieces = oldOrders.reduce((s:any,o:any)=> s + ((o.products||[]).reduce((ss:number,p:any)=> ss + Number(p.quantity||p.qty||0),0)), 0);
    const totalOrdersCount = allOrders.length;
    const totalPieces = allOrders.reduce((s:any,o:any)=> s + ((o.products||[]).reduce((ss:number,p:any)=> ss + Number(p.quantity||p.qty||0),0)), 0);
    
    let prevBalance = Number(openRepOrders?.balance || 0);
    try {
      if ((!prevBalance || prevBalance===0) && allOrders.length>0) {
        const repId = allOrders[0].rep_id || allOrders[0].repId || allOrders[0].shipping_company_id || allOrders[0].shippingCompanyId || null;
        if (repId) {
          const found = (repsSummary||[]).find((r:any) => String(r.repId) === String(repId));
          if (found) prevBalance = Number(found.balance || 0);
        }
      }
    } catch(e) { prevBalance = Number(openRepOrders?.balance || 0); }
    const finalDebtBefore = prevBalance - todayValue;
    
    const reportTitle = isShippingMode ? 'يومية شركة الشحن' : 'يومية المندوب';
    const assigneeLabel = isShippingMode ? 'شركة الشحن' : 'اسم المندوب';

    // === تجميع المنتجات لإذن التسليم السفلي ===
    const summaryMap: Record<string, { name: string; color: string; size: string; qty: number }> = {};
    allOrders.forEach(o => (o.products||[]).forEach((p:any) => {
      const key = `${p.name||''}||${p.color||''}||${p.size||''}`;
      if (!summaryMap[key]) summaryMap[key] = { name: p.name||'', color: p.color||'', size: p.size||'', qty: 0 };
      summaryMap[key].qty += Number(p.quantity||p.qty||0);
    }));
    const groupedProducts = Object.values(summaryMap);

    const html = `<!doctype html><html><head><meta charset="utf-8"><title>${reportTitle}</title>
    <style>
        @page { size: A4; margin: 8mm; }
        body { font-family: "Noto Naskh Arabic", Arial, sans-serif; direction: rtl; padding: 0; margin: 0; color: #000; background: #fff; }
        
        /* الهيدر المدمج */
        .top-header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #000; padding-bottom: 8px; margin-bottom: 12px; }
        .top-header-right h1 { margin: 0 0 4px 0; font-size: 22px; font-weight: 900; }
        .top-header-right .date { font-size: 12px; font-weight: bold; }
        
        .rep-badge { border: 2px solid #000; padding: 4px 15px; border-radius: 4px; background: #000; color: #fff; text-align: center; }
        .rep-badge .lbl { font-size: 10px; color: #ccc; display: block; margin-bottom: 2px;}
        .rep-badge .val { font-size: 16px; font-weight: bold; }
        
        .amount-badge { border: 2px solid #000; padding: 4px 12px; border-radius: 4px; background: #f9fafb; text-align: center; }
        .amount-badge .lbl { font-size: 10px; color: #333; display: block; margin-bottom: 2px;}
        .amount-badge .val { font-size: 16px; font-weight: 900; }

        /* مربعات الملخص */
        .summary-grid { display: grid; grid-template-columns: repeat(8, 1fr); gap: 6px; margin-bottom: 15px; }
        .stat-box { border: 1px solid #666; padding: 4px; border-radius: 4px; text-align: center; }
        .stat-box.highlight { border: 2px solid #000; background: #e5e7eb; }
        .stat-box .title { font-size: 10px; font-weight: 900; color: #333; margin-bottom: 2px; }
        .stat-box .value { font-size: 14px; font-weight: 900; color: #000; }
        
        /* جدول الطلبيات */
        table.main-table { width: 100%; border-collapse: collapse; margin-bottom: 15px; border: 2px solid #000; }
        table.main-table th, table.main-table td { border: 1px solid #000; padding: 4px 6px; font-size: 11px; text-align: right; color: #000; }
        table.main-table th { background: #e5e7eb; font-weight: 900; font-size: 12px; text-align: center; }
        table.main-table tbody tr:nth-child(even) { background: #f9fafb; }
        table.main-table tbody tr { page-break-inside: avoid; } 
        .text-center { text-align: center; }
        .font-black { font-weight: 900; }
        .highlight-cell { background: #e5e7eb; font-weight: 900; }

        /* إذن التسليم */
        .delivery-section { border-top: 2px dashed #000; padding-top: 10px; page-break-inside: avoid; }
        .delivery-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
        .delivery-title { font-size: 15px; font-weight: 900; background: #000; color: #fff; padding: 3px 15px; border-radius: 4px; }
        .total-pieces-badge { font-size: 14px; font-weight: 900; border: 2px solid #000; padding: 4px 15px; background: #e5e7eb; }
        
        table.mini-table { width: 65%; margin: 0; border-collapse: collapse; border: 2px solid #000; }
        table.mini-table th, table.mini-table td { border: 1px solid #000; padding: 3px 6px; font-size: 11px; text-align: center; }
        table.mini-table th { background: #e5e7eb; font-weight: bold; }
        table.mini-table .prod-name { text-align: right; font-weight: bold; }
        
        @media print {
            * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        }
    </style></head><body>

      <div class="top-header">
          <div class="top-header-right">
              <h1>${reportTitle}</h1>
              <div class="date">تاريخ الطباعة: ${dateStr}</div>
          </div>
          <div class="rep-badge">
              <span class="lbl">${assigneeLabel}</span>
              <span class="val">${repName || 'غير محدد'}</span>
          </div>
          ${!isShippingMode ? `
          <div class="amount-badge">
              <span class="lbl">إجمالي المنتجات (بدون شحن)</span>
              <span class="val">${totalAmount.toLocaleString()} ج.م</span>
          </div>
          ` : ''}
          <div class="amount-badge" style="background: #e5e7eb;">
              <span class="lbl">العهدة الحالية (عليه/له)</span>
              <span class="val">${Math.abs(finalDebtBefore).toLocaleString()} ج.م</span>
          </div>
      </div>

      <div class="summary-grid">
          <div class="stat-box"><div class="title">طلبيات قديمة</div><div class="value">${oldOrdersCount}</div></div>
          <div class="stat-box"><div class="title">قطع قديمة</div><div class="value">${oldPieces}</div></div>
          <div class="stat-box"><div class="title">طلبات اليوم</div><div class="value">${todayOrdersCount}</div></div>
          <div class="stat-box"><div class="title">قطع اليوم</div><div class="value">${todayPieces}</div></div>
          <div class="stat-box highlight"><div class="title">إجمالي الطلبيات</div><div class="value">${totalOrdersCount}</div></div>
          <div class="stat-box highlight"><div class="title">إجمالي القطع</div><div class="value">${totalPieces}</div></div>
          <div class="stat-box highlight"><div class="title">قيمة المنتجات</div><div class="value">${todayValue.toLocaleString()}</div></div>
          <div class="stat-box highlight"><div class="title">إجمالي المطلوب تحصيله</div><div class="value">${totalRequiredToCollect.toLocaleString()}</div></div>
      </div>

      <table class="main-table">
          <thead>
              <tr>
                  <th style="width: 7%;">الطلب</th>
                  <th style="width: 14%;">العميل</th>
                  <th style="width: 10%;">الهاتف</th>
                  <th style="width: 10%;">المحافظة</th>
                  <th style="width: 18%;">العنوان</th>
                  <th style="width: 8%;">الموظف/بيدج</th>
                  <th style="width: 8%;">المنتجات</th>
                  <th style="width: 6%;">شحن</th>
                  <th style="width: 9%;">المطلوب</th>
                  <th style="width: 10%;">ملاحظات</th>
              </tr>
          </thead>
          <tbody>
              ${allOrders.map(o => `
              <tr>
                  <td class="font-black text-center">${o.orderNumber||o.order_number||''}</td>
                  <td class="font-black">${o.customerName||o.customer_name||''}</td>
                  <td dir="ltr" class="text-center font-black">${o.phone||o.phone1||''}</td>
                  <td class="text-center font-black">${o.governorate||''}</td>
                  <td>${o.address||''}</td>
                  <td class="text-center">${o.employee||o.user_name||o.admin||o.created_by||'-'}<br><span style="font-size:9px; color:#555;">${o.page||o.source||'-'}</span></td>
                  <td class="text-center font-black">${computeOrderSubtotal(o).toLocaleString()}</td>
                  <td class="text-center">${o.shipping||o.shipping_fees||o.shippingCost||0}</td>
                  <td class="text-center highlight-cell">${(computeOrderSubtotal(o) + Number(o.shipping||o.shipping_fees||o.shippingCost||0)).toLocaleString()}</td>
                  <td>${o.notes||o.remark||o.customer_notes||'-'}</td>
              </tr>`).join('')}
          </tbody>
      </table>

      <div class="delivery-section">
          <div class="delivery-header">
              <div class="delivery-title">إذن تسليم مجمع (جرد القطع)</div>
              <div class="total-pieces-badge">إجمالي القطع المستلمة: ${groupedProducts.reduce((s,r) => s + r.qty, 0)} قطعة</div>
          </div>
          <table class="mini-table">
              <thead>
                  <tr>
                      <th style="width:50%">اسم المنتج</th>
                      <th style="width:20%">اللون</th>
                      <th style="width:20%">المقاس</th>
                      <th style="width:10%">الكمية</th>
                  </tr>
              </thead>
              <tbody>
                  ${groupedProducts.map(r => `
                  <tr>
                      <td class="prod-name">${r.name}</td>
                      <td class="font-black">${r.color || '-'}</td>
                      <td class="font-black">${r.size || '-'}</td>
                      <td class="font-black highlight-cell" style="font-size: 13px;">${r.qty}</td>
                  </tr>`).join('')}
              </tbody>
          </table>
      </div>

    </body></html>`;

    const w = window.open('', '_blank', 'toolbar=0,location=0,menubar=0,scrollbars=1,resizable=1,width=1000,height=800');
    if (!w) return; 
    w.document.write(html); 
    w.document.close(); 
    w.focus(); 
    setTimeout(() => w.print(), 500);
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
    const repName = (ordersList && ordersList.length>0) ? (openRepOrders?.name || ordersList[0].rep_name || ordersList[0].repName || '') : (openRepOrders?.name || '');
    const assigneeLabel = isShippingMode ? 'شركة الشحن' : 'المندوب';
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>أذن تسليم</title><style>@page{size:80mm auto; margin:4mm;} body{font-family: Arial, Helvetica, "Noto Naskh Arabic", sans-serif; direction:rtl; padding:6px; width:80mm; box-sizing:border-box; font-size:12px;} h2{text-align:center; font-size:14px;} table{width:100%; border-collapse:collapse;} th,td{font-size:12px; padding:4px; border-bottom:1px solid #ddd;} th{font-weight:700; text-align:right;} .footer{margin-top:8px; font-size:12px;} </style></head><body>`+
      `<h2>أذن تسليم</h2><div>التاريخ: ${dateStr}</div><div>${assigneeLabel}: ${repName}</div>`+
      `<table><thead><tr><th>المنتج</th><th>اللون</th><th>المقاس</th><th>الكمية</th></tr></thead><tbody>`+
      rows.map(r=>`<tr><td>${r.name}</td><td>${r.color}</td><td>${r.size}</td><td style="text-align:left">${r.qty}</td></tr>`).join('')+
      `</tbody></table>`+
      `<div class="footer">اجمالي منتجات: ${rows.length}<br/>اجمالي قطع: ${rows.reduce((s,r)=>s + r.qty,0)}</div>`+
      `</body></html>`;
    const w = window.open('', '_blank', 'toolbar=0,location=0,menubar=0,scrollbars=1,resizable=1,width=900,height=700');
    if (!w) return; w.document.write(html); w.document.close(); w.focus(); setTimeout(()=>w.print(),400);
  };

  const printShippingLabelsNew = (ordersList:any[]) => {
    // Reuse the unified PrintableOrders layout so output matches Orders Management page
    const orders = ordersList || [];
    setPrintSinglePerPage(true);
    setOrdersToPrint(orders);
  };

  return (
    <div className="p-4 rounded-2xl border border-card dir-rtl card" style={{ backgroundColor: 'var(--card-bg)', color: 'var(--text)' }}>
      
      {/* Hidden Print Container for print output. Choose single-per-page for shipping labels. */}
      {ordersToPrint && (printSinglePerPage ? <PrintableOrdersSingle orders={ordersToPrint} /> : <PrintableOrders orders={ordersToPrint} />)}

      <h2 className="font-black mb-3">تسجيل المرتجعات</h2>
      {loading ? <div className="text-sm text-slate-500">جاري التحميل...</div> : (
        <div>
          {repsSummary.length === 0 ? (
            <p className="text-sm text-slate-500">{isShippingMode ? 'لا توجد شركات شحن لديهم طلبيات.' : 'لا توجد مندوبين لديهم طلبيات.'}</p>
          ) : (
            <div className="space-y-3">
              {repsSummary.map((rep:any) => (
                <div key={rep.repId} className="p-3 border rounded-lg flex justify-between items-center bg-slate-50">
                  <div>
                    <div className="font-bold">{rep.name || ((isShippingMode ? 'شركة شحن #' : 'مندوب #') + rep.repId)}</div>
                    <div className="text-sm text-slate-500">عدد الطلبيات: <span className="font-black">{rep.ordersCount}</span> — عدد المنتجات: <span className="font-black">{rep.productsCount}</span></div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {!isShippingMode && (
                      <div className={`px-3 py-2 rounded-lg font-bold border border-card card`} style={{ backgroundColor: 'var(--card-bg)', color: 'var(--text)' }}>
                        <span style={{ color: (rep.balance>0? 'green' : (rep.balance<0? 'red' : '#000')) }}>{Math.abs(Number(rep.balance||0)).toLocaleString()} ج.م</span>
                        <span className="mx-2 font-bold" style={{ color: (rep.balance>0? 'green' : (rep.balance<0? 'red' : '#666')) }}>{rep.balance>0? 'له' : (rep.balance<0? 'عليه' : '')}</span>
                      </div>
                    )}
                    <button onClick={() => openOrdersForRep(rep)} className="bg-blue-600 text-white px-3 py-2 rounded-lg text-xs font-bold hover:bg-blue-700">عرض الطلبيات</button>
                    <button onClick={() => { printDailyDocument(rep.orders); }} className="bg-amber-500 text-white px-3 py-2 rounded-lg text-xs font-bold hover:bg-amber-600">عرض اليومية</button>
                    <button onClick={() => { printDeliveryNote(rep.orders); }} className="bg-emerald-600 text-white px-3 py-2 rounded-lg text-xs font-bold hover:bg-emerald-700">أذن التسليم</button>
                    <button onClick={() => printShippingLabelsNew(rep.orders)} className="bg-sky-600 text-white px-3 py-2 rounded-lg text-xs font-bold hover:bg-sky-700">طباعة بوالص الشحن فقط</button>
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
              <h3 className="font-black text-lg">{isShippingMode ? 'طلبيات شركة الشحن' : 'طلبيات المندوب'}: {openRepOrders.name}</h3>
              <div className="flex items-center gap-2">
                <button onClick={() => setIsBarcodeModalOpen(true)} className="px-3 py-1.5 rounded-lg bg-purple-600 text-white text-xs font-bold hover:bg-purple-700">مسح بالباركود</button>
                <button onClick={() => { const sels = (openRepOrders.orders||[]).map((o:any)=>o.id); setSelectedOrderIds(sels); }} className="px-3 py-1.5 rounded-lg bg-slate-100 text-xs font-bold hover:bg-slate-200">تحديد الكل</button>
                <button onClick={() => { setSelectedOrderIds([]); }} className="px-3 py-1.5 rounded-lg bg-slate-100 text-xs font-bold hover:bg-slate-200">إلغاء التحديد</button>
                <button onClick={() => setOpenRepOrders(null)} className="px-3 py-1.5 rounded-lg bg-red-100 text-red-600 text-xs font-bold hover:bg-red-200">إغلاق</button>
              </div>
            </div>
            
            {/* Summary removed from orders modal per user request; kept in printable report only */}
            <div className="flex-1 overflow-y-auto mb-4 space-y-2 pr-2">
              {(openRepOrders.orders||[]).map((o:any)=> (
                <div key={o.id} className={`flex items-center justify-between p-3 border rounded-xl hover:bg-slate-50 transition-colors ${selectedOrderIds.includes(o.id) ? 'border-blue-500 bg-blue-50/30' : 'border-slate-200'}`}>
                  <label className="flex items-center gap-3 flex-1 cursor-pointer">
                    <input type="checkbox" className="w-5 h-5 rounded text-blue-600 focus:ring-blue-500" checked={selectedOrderIds.includes(o.id)} onChange={()=>toggleSelectOrder(o.id)} />
                    <div className="flex-1">
                      <div className="flex justify-between">
                          <div className="font-bold text-slate-800">#{o.orderNumber||o.order_number} — {o.customerName||o.customer_name}</div>
                          <div className="font-bold text-blue-600">{computeOrderSubtotal(o).toLocaleString()} ج.م</div>
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
              
              <div className="w-px bg-slate-300 mx-2"></div>

              
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
                  setOpenRepOrders((prev:any)=> (prev ? ({ ...prev, orders: (prev.orders||[]).filter((o:any)=> !ids.includes(o.id)) }) : prev));
                  try { await refreshData(); } catch(e){ console.error(e); }
                  setSelectedOrderIds([]);
                  Swal.fire('تم','تم تسجيل المرتجع للمحدد.','success');
                } catch (e) { console.error(e); Swal.fire('خطأ','فشل في العملية.','error'); }
              }} className="px-5 py-2.5 bg-rose-600 text-white rounded-xl font-bold shadow-lg hover:bg-rose-700">مرتجع كلي</button>
              
              
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
                      <CustomSelect
                        value={partialWarehouse ?? ''}
                        onChange={v => setPartialWarehouse(v ? Number(v) : undefined)}
                        options={[{ value: '', label: 'بدون' }, ...warehouses.map((w:any) => ({ value: String(w.id), label: w.name || w.title || ('المستودع ' + w.id) }))]}
                      />
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
