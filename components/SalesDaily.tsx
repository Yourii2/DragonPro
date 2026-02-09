import React, { useEffect, useState } from 'react';
import Swal from 'sweetalert2';
import { API_BASE_PATH } from '../services/apiConfig';
import { User, ShoppingCart, CreditCard, Trash2, ArrowRight, Printer, Box } from 'lucide-react';

const SalesDaily: React.FC = () => {
  const [reps, setReps] = useState<any[]>([]);
  const [pendingOrdersList, setPendingOrdersList] = useState<any[]>([]);
  const [selectedPendingIds, setSelectedPendingIds] = useState<number[]>([]);
  const [selectedRepId, setSelectedRepId] = useState<number | ''>('');
  const [prevBalance, setPrevBalance] = useState<number>(0);
  const [assignedOrders, setAssignedOrders] = useState<any[]>([]); // orders already with rep
  const [assignedProductsCount, setAssignedProductsCount] = useState<number>(0);
  const [selectedOrders, setSelectedOrders] = useState<any[]>([]); // orders picked for today
  const [barcodeInput, setBarcodeInput] = useState('');
  const [totalProductsCount, setTotalProductsCount] = useState<number>(0);
  const [currentTotalAmount, setCurrentTotalAmount] = useState<number>(0);
  const [paymentAdjustment, setPaymentAdjustment] = useState<number>(0);
  const [paymentDirection, setPaymentDirection] = useState<'pay'|'collect'>('pay');
  const [treasuries, setTreasuries] = useState<any[]>([]);
  const [selectedTreasuryId, setSelectedTreasuryId] = useState<number | ''>('');
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<number | ''>('');
  const [userDefaults, setUserDefaults] = useState<any>(null);

  useEffect(() => {
    (async () => {
      try {
        // fetch users and filter representatives
        const r = await fetch(`${API_BASE_PATH}/api.php?module=users&action=getAll`);
        const jr = await r.json(); if (jr && jr.success) setReps((jr.data || []).filter((u:any) => u.role === 'representative'));
      } catch (e) { console.debug('Failed to load reps', e); }

      try {
        const [tr, ud] = await Promise.all([
          fetch(`${API_BASE_PATH}/api.php?module=treasuries&action=getAll`).then(r=>r.json()),
          fetch(`${API_BASE_PATH}/api.php?module=permissions&action=getUserDefaults`).then(r=>r.json()).catch(()=>({success:false}))
        ]);
        const list = (tr && tr.success) ? (tr.data || []) : [];
        const defaults = (ud && ud.success) ? (ud.data || null) : null;
        if (defaults && defaults.default_treasury_id && !defaults.can_change_treasury) setTreasuries(list.filter((t:any)=>Number(t.id)===Number(defaults.default_treasury_id)));
        else setTreasuries(list);
        if (defaults && defaults.default_treasury_id && !selectedTreasuryId) setSelectedTreasuryId(Number(defaults.default_treasury_id));
        if (defaults && defaults.default_warehouse_id && !selectedWarehouseId) setSelectedWarehouseId(Number(defaults.default_warehouse_id));
        if (defaults) setUserDefaults(defaults);
      } catch (e) { console.debug('Failed to load treasuries', e); }
      try {
        const wr = await fetch(`${API_BASE_PATH}/api.php?module=warehouses&action=getAll`);
        const jwr = await wr.json(); if (jwr && jwr.success) setWarehouses(jwr.data || []);
      } catch (e) { console.debug('Failed to load warehouses', e); }
      try {
        const ud = await fetch(`${API_BASE_PATH}/api.php?module=permissions&action=getUserDefaults`);
        const jud = await ud.json(); if (jud && jud.success) { setUserDefaults(jud.data || null); if (jud.data) {
          if (jud.data.default_treasury_id && !selectedTreasuryId) setSelectedTreasuryId(Number(jud.data.default_treasury_id));
          if (jud.data.default_warehouse_id && !selectedWarehouseId) setSelectedWarehouseId(Number(jud.data.default_warehouse_id));
        }}
      } catch (e) { console.debug('Failed to load user defaults', e); }
    })();
    // load pending orders for multi-select
    (async () => {
      try {
        const pr = await fetch(`${API_BASE_PATH}/api.php?module=orders&action=getAll&status=pending`);
        const jpr = await pr.json(); if (jpr && jpr.success) setPendingOrdersList(jpr.data || []);
      } catch (e) { console.debug('Failed to load pending orders', e); }
    })();
  }, []);

  useEffect(() => {
    // whenever selected orders or assigned orders change, update totals
    const merged = [ ...assignedOrders, ...selectedOrders ].filter((v, i, a) => a.findIndex(x => x.id === v.id) === i);
    const totalAmount = merged.reduce((s, o) => {
      const sub = Number(o.subTotal || o.total || 0);
      const ship = Number(o.shipping || o.shippingCost || 0);
      return s + sub + ship;
    }, 0);
    const totalProducts = merged.reduce((s, o) => s + (o.products?.reduce((ps:number, p:any)=> ps + Number(p.quantity||p.qty||0), 0) || 0), 0);
    setCurrentTotalAmount(totalAmount);
    setTotalProductsCount(totalProducts);
  }, [selectedOrders, assignedOrders]);

  const onSelectRep = async (repId:number|'') => {
    setSelectedRepId(repId as any);
    setSelectedOrders([]);
    setPaymentAdjustment(0);
    setPaymentDirection('pay');
    if (!repId) {
      setPrevBalance(0); setAssignedOrders([]); return;
    }
    // load rep summary: previous balance and assigned orders
    try {
      // fetch orders assigned to this rep
      const r = await fetch(`${API_BASE_PATH}/api.php?module=orders&action=getAll&status=with_rep`);
      const jr = await r.json();
      if (jr && jr.success) {
        const assigned = (jr.data || []).filter((o:any) => Number(o.rep_id) === Number(repId));
        setAssignedOrders(assigned);
        // do not auto-add assigned orders to `selectedOrders` to avoid duplicate rendering
        // compute assigned products count (distinct) and pieces
        const allProducts = (assigned || []).flatMap((o:any) => (o.products||[]));
        const distinctProdIds = new Set(allProducts.map((p:any)=> p.productId ?? p.id ?? (p.name+'')));
        const pieces = allProducts.reduce((s:number,p:any)=> s + Number(p.quantity||p.qty||0), 0);
        setAssignedProductsCount(distinctProdIds.size);
      }
      // compute previous balance from transactions
      try {
        const tr = await fetch(`${API_BASE_PATH}/api.php?module=transactions&action=getByRelated&related_to_type=rep&related_to_id=${repId}`);
        const jtr = await tr.json();
        if (jtr && jtr.success) {
          const bal = (jtr.data || []).reduce((s:any, t:any) => s + Number(t.amount || 0), 0);
          setPrevBalance(Number(bal));
        }
      } catch (e) { console.debug('Failed to load rep transactions', e); }
    } catch (e) { console.debug('Failed to load rep detail', e); }
  };

  const scanBarcodeAddOrder = async () => {
    const code = barcodeInput.trim();
    if (!code) return;

    if (!selectedWarehouseId) {
        Swal.fire('اختر مستودع', 'الرجاء اختيار مستودع أولاً للتحقق من المخزون.', 'warning');
        return;
    }

    try {
      const r = await fetch(`${API_BASE_PATH}/api.php?module=orders&action=getByNumber&orderNumber=${encodeURIComponent(code)}`);
      const jr = await r.json();

      if (!jr.success || !jr.data) {
        Swal.fire('غير موجود', 'لم يتم العثور على طلبية بهذا الرقم', 'warning');
        return;
      }
      
      const order = jr.data;

      if (order.status !== 'pending') {
          let reason = '';
          switch (order.status) {
              case 'with_rep':
                  reason = 'هذه الطلبية في عهدة مندوب آخر.';
                  break;
              case 'delivered':
                  reason = 'هذه الطلبية تم تسليمها بالفعل.';
                  break;
              case 'returned':
                  reason = 'هذه الطلبية مرتجعة.';
                  break;
              default:
                  reason = `لا يمكن إضافة طلبية بحالة "${order.status}"`;
          }
          Swal.fire('لا يمكن إضافة الطلبية', reason, 'error');
          return;
      }

      if (selectedOrders.some(o => o.id === order.id) || assignedOrders.some(o => o.id === order.id)) {
        Swal.fire('مكرر', 'هذه الطلبية مضافة بالفعل.', 'info');
        setBarcodeInput('');
        return;
      }

      if (!order.products || order.products.length === 0) {
        setSelectedOrders(prev => [...prev, order]);
        setBarcodeInput('');
        return;
      }

      const stockCheckPayload = {
          warehouse_id: selectedWarehouseId,
          items: order.products.map((p: any) => ({
              product_id: p.productId,
              quantity: p.quantity
          }))
      };

      const stockRes = await fetch(`${API_BASE_PATH}/api.php?module=stock&action=checkAvailability`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(stockCheckPayload)
      });
      const stockJr = await stockRes.json();

      if (!stockJr.success) {
          const unavailableItems = stockJr.unavailable_items || [];
          let errorMessage = 'لا يمكن إضافة الطلبية بسبب عدم توفر المنتجات التالية:\n';
          errorMessage += unavailableItems.map((item: any) => 
              `- ${item.name} (المطلوب: ${item.required}, المتوفر: ${item.available})`
          ).join('\n');
          
          Swal.fire({
            title: 'نقص في المخزون',
            html: `<div style="text-align: right; white-space: pre-wrap;">${errorMessage}</div>`,
            icon: 'warning'
          });
          return;
      }

      setSelectedOrders(prev => [...prev, order]);
      setBarcodeInput('');

    } catch (e) {
      console.error('Failed to fetch order by barcode', e);
      Swal.fire('خطأ', 'فشل البحث عن الطلبية. راجع الكونسول.', 'error');
    }
  };

  const togglePendingSelection = (id:number) => {
    setSelectedPendingIds(prev => prev.includes(id) ? prev.filter(x=>x!==id) : [...prev, id]);
  };

  const addSelectedPendingToOrders = async () => {
    if (!selectedWarehouseId) {
        Swal.fire('اختر مستودع', 'الرجاء اختيار مستودع أولاً للتحقق من المخزون.', 'warning');
        return;
    }

    const toAdd = pendingOrdersList.filter(p => selectedPendingIds.includes(p.id));
    const newOnes = toAdd.filter(t => !selectedOrders.some(s => s.id === t.id) && !assignedOrders.some(a => a.id === t.id));

    if (newOnes.length === 0) {
      Swal.fire('لا توجد طلبيات جديدة', 'الطلبيات المحددة قد تكون مضافة بالفعل.', 'info');
      return;
    }

    // Aggregate all products from all new orders
    const allProducts = newOnes.flatMap(order => order.products || []);
    
    if (allProducts.length > 0) {
        const productQuantities = allProducts.reduce((acc, product) => {
            const productId = product.productId;
            if (!acc[productId]) {
                acc[productId] = {
                    product_id: productId,
                    name: product.name,
                    quantity: 0
                };
            }
            acc[productId].quantity += Number(product.quantity || 0);
            return acc;
        }, {} as Record<string, { product_id: any, name: string, quantity: number }>);

        const itemsToCheck = Object.values(productQuantities);

        if (itemsToCheck.length > 0) {
            const stockCheckPayload = {
                warehouse_id: selectedWarehouseId,
                items: itemsToCheck.map(p => ({product_id: p.product_id, quantity: p.quantity}))
            };
            
            try {
                const stockRes = await fetch(`${API_BASE_PATH}/api.php?module=stock&action=checkAvailability`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(stockCheckPayload)
                });
                const stockJr = await stockRes.json();

                if (!stockJr.success) {
                    const unavailableItems = stockJr.unavailable_items || [];
                    let errorMessage = `لا يمكن إضافة الطلبيات المحددة لوجود نقص في مخزون المستودع المختار للمنتجات التالية:\n`;
                    
                    errorMessage += unavailableItems.map((item: any) => 
                        `- ${item.name} (المطلوب: ${item.required}, المتوفر: ${item.available})`
                    ).join('\n');

                    Swal.fire({
                      title: 'نقص في المخزون',
                      html: `<div style="text-align: right; white-space: pre-wrap;">${errorMessage}</div>`,
                      icon: 'warning'
                    });
                    return;
                }
            } catch(e) {
                console.error('Failed to check stock', e);
                Swal.fire('خطأ', 'فشل التحقق من المخزون. راجع الكونسول.', 'error');
                return;
            }
        }
    }

    // All checks passed
    setSelectedOrders(prev => [...prev, ...newOnes]);
    setSelectedPendingIds([]);
    Swal.fire('تم الإضافة', `${newOnes.length} طلبيات أضيفت للقائمة.`, 'success');
  };

  const removeSelectedOrder = (id:number) => {
    setSelectedOrders(prev => prev.filter(o => o.id !== id));
  };

  const unassignOrder = async (orderId:number) => {
    try {
      const res = await fetch(`${API_BASE_PATH}/api.php?module=orders&action=update`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ id: orderId, repId: null, status: 'pending' }) });
      const jr = await res.json();
      if (jr && jr.success) {
        // remove from assignedOrders
        const removed = assignedOrders.find(o => o.id === orderId) || null;
        setAssignedOrders(prev => prev.filter(o => o.id !== orderId));
        // also remove from selectedOrders if present
        setSelectedOrders(prev => prev.filter(o => o.id !== orderId));
        // immediately add back to pendingOrdersList so it appears without reload
        if (removed) {
          setPendingOrdersList(prev => [removed, ...prev.filter(p => p.id !== removed.id)]);
        }
        Swal.fire('تم', 'تم إعادة الطلبية بدون مندوب.', 'success');
      } else {
        Swal.fire('فشل', jr.message || 'فشل في إزالة المندوب من الطلبية', 'error');
      }
    } catch (e) {
      console.error('Failed to unassign order', e);
      Swal.fire('خطأ', 'فشل الاتصال بالخادم.', 'error');
    }
  };

  const onComplete = async () => {
    if (!selectedRepId) { Swal.fire('اختر المندوب', 'الرجاء اختيار مندوب قبل إتمام اليومية', 'error'); return; }
    const mergedOrders = [ ...assignedOrders, ...selectedOrders ].filter((v, i, a) => a.findIndex(x => x.id === v.id) === i);
    if (mergedOrders.length === 0) { Swal.fire('اختر طلبيات', 'الرجاء اختيار طلبيات لتسليمها للمندوب', 'error'); return; }
    if (!selectedTreasuryId) {
      // check if user has restricted treasury? we cannot access session here; let it be selectable
      const ok = await Swal.fire({ title: 'تحذير', text: 'لم يتم اختيار الخزينة، تابع بدون خزينة؟', icon: 'question', showCancelButton: true });
      if (!ok.isConfirmed) return;
    }

    // If payment adjustment present, require treasury selection
    if (paymentAdjustment > 0 && !selectedTreasuryId) {
      Swal.fire('اختر الخزينة', 'هناك تعديل مالي لم يتم اختيار الخزينة الخاصة به.', 'warning');
      return;
    }

    // If warehouse is selected and there are products, ask for a reason for stock movement
    let dailyReason = '';
    if (selectedWarehouseId) {
      const reasonRes = await Swal.fire({
        title: 'سبب الحركة',
        input: 'text',
        inputPlaceholder: 'أدخل سبب سحب/تسليم المنتجات (مطلوب)',
        showCancelButton: true,
        inputValidator: (value) => { if (!value || !value.trim()) return 'الرجاء إدخال سبب صالح.'; return null; }
      });
      if (!reasonRes.isConfirmed) return;
      dailyReason = String(reasonRes.value || '').trim();
    }

    // Build payload
    const payload = {
      repId: selectedRepId,
      orders: mergedOrders.map(o => o.id),
      totalAmount: currentTotalAmount,
      productsCount: totalProductsCount,
      paymentAdjustment: paymentAdjustment,
      paymentDirection,
      treasuryId: selectedTreasuryId || null,
      warehouseId: selectedWarehouseId || null,
      reason: dailyReason || null
    };

    // For now, call a generic endpoint that may be implemented server-side later.
    try {
      const resp = await fetch(`${API_BASE_PATH}/api.php?module=sales&action=completeDaily`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const jr = await resp.json();
      if (jr && jr.success) {
        Swal.fire('تم', 'تمت معالجة اليومية وطباعة الأذون والتقارير.', 'success');
        // trigger print of thermal and A4 views (include assigned orders)
        printThermal(mergedOrders, jr.printData || {});
        const repName = reps.find(r=>r.id===selectedRepId)?.name || '';
        printA4Report(mergedOrders, { ...(jr.reportData || {}), repName });
        // reset selections
        setSelectedOrders([]);
        setPaymentAdjustment(0);
      } else {
        console.warn('Server did not confirm daily completion', jr);
        Swal.fire('تم الإرسال محلياً', 'لم يؤكد الخادم المعالجة، تم تسجيل العملية محلياً فقط.', 'warning');
      }
    } catch (e) {
      console.error('Complete daily failed', e);
      Swal.fire('خطأ', 'فشل إتمام اليومية: راجع الكونسول.', 'error');
    }
  };

  const printThermal = (orders:any[], extra:any) => {
    // Open a new window with a simple thermal-friendly layout (80mm width)
    const win = window.open('', '_blank', 'width=400,height=800');
    if (!win) return;
    // Aggregate products across all orders into product rows
    const summaryMap: Record<string, { name: string; color: string; size: string; qty: number }> = {};
    orders.forEach(o => {
      (o.products || []).forEach((p:any) => {
        const key = `${p.name || ''}||${p.color || ''}||${p.size || ''}`;
        if (!summaryMap[key]) summaryMap[key] = { name: p.name || '', color: p.color || '', size: p.size || '', qty: 0 };
        summaryMap[key].qty += Number(p.quantity || p.qty || 0);
      });
    });
    const rows = Object.values(summaryMap);
    const dateStr = new Date().toLocaleString();
    const totalProducts = rows.length;
    const totalPieces = rows.reduce((s, r) => s + (r.qty || 0), 0);
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>أذن تسليم</title><style>body{font-family: Arial, Helvetica, "Noto Naskh Arabic", sans-serif; direction:rtl; width:340px; padding:6px;} h2{text-align:center;} table{width:100%; border-collapse:collapse;} th,td{font-size:12px; padding:4px; border-bottom:1px solid #ddd;} th{font-weight:700; text-align:right;} .totals{margin-top:8px; font-weight:700;} </style></head><body>` +
      `<h2>أذن تسليم</h2>` +
      `<div>التاريخ: ${dateStr}</div>` +
      `<div>الموظف: ${extra.employee || ''}</div>` +
      `<div>المندوب: ${extra.repName || ''}</div>` +
      `<br/>` +
      `<table><thead><tr><th>المنتج</th><th>اللون</th><th>المقاس</th><th>الكمية</th></tr></thead><tbody>` +
      rows.map(r => `<tr><td>${r.name}</td><td>${r.color}</td><td>${r.size}</td><td style="text-align:left">${r.qty}</td></tr>`).join('') +
      `</tbody></table>` +
      `<div class="totals">اجمالى المنتجات: ${totalProducts}</div>` +
      `<div class="totals">اجمالى القطع: ${totalPieces}</div>` +
      `</body></html>`;
    win.document.write(html);
    win.document.close();
    setTimeout(() => { win.print(); }, 500);
  };

  const printA4Report = (orders:any[], extra:any) => {
    const win = window.open('', '_blank');
    if (!win) return;
    const dateStr = new Date().toLocaleDateString();
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>يومية المندوب</title><style>body{font-family: Arial, Helvetica, "Noto Naskh Arabic", sans-serif; direction:rtl; padding:20px;} h1{text-align:center;} .header{display:flex; justify-content:space-between; align-items:center;} table{width:100%; border-collapse:collapse; margin-top:12px;} th,td{border:1px solid #333; padding:6px; font-size:12px; text-align:right;} th{background:#eee;} </style></head><body>` +
      `<div class="header"><div>${extra.employee || ''}</div><div><h1>يومية المندوب</h1></div><div>${extra.repName || ''}</div></div>` +
      `<div style="margin-top:8px">التاريخ: ${dateStr}</div>` +
      `<div style="margin-top:8px">الرصيد قبل: ${extra.prevBalance || 0}</div>` +
      `<div style="margin-top:8px">اجمالي اليومية: ${currentTotalAmount}</div>` +
      `<div style="margin-top:8px">تم ${paymentDirection === 'pay' ? 'دفع' : 'استلام'}: ${paymentAdjustment}</div>` +
      `<div style="margin-top:8px">الرصيد الحالي: ${Number((extra.prevBalance||0)) + (paymentDirection === 'pay' ? -paymentAdjustment : paymentAdjustment) - currentTotalAmount}</div>` +
      `<table><thead><tr><th>رقم الطلبيه</th><th>اسم العميل</th><th>الهاتف</th><th>المحافظه</th><th>العنوان</th><th>الموظف</th><th>البيدج</th><th>الإجمالي</th><th>شحن</th><th>الاجمالي الكلي</th><th>ملاحظات</th></tr></thead><tbody>` +
      orders.map(o => `<tr><td>${o.orderNumber}</td><td>${o.customerName}</td><td>${o.phone||o.phone1}</td><td>${o.governorate||''}</td><td>${o.address||''}</td><td>${o.employee||''}</td><td>${o.page||''}</td><td>${o.subTotal||0}</td><td>${o.shipping||o.shippingCost||0}</td><td>${o.total||0}</td><td>${o.notes||''}</td></tr>`).join('') +
      `</tbody></table></body></html>`;
    win.document.write(html); win.document.close(); setTimeout(()=>win.print(), 500);
  };

  return (
    <div className="p-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: controls and summary */}
        <div className="lg:col-span-1 bg-gradient-to-br from-white to-slate-50 dark:from-slate-800 dark:to-slate-900 rounded-3xl p-5 shadow-md border">
          <div className="flex items-center gap-3 mb-4">
            <User className="text-blue-600" />
            <div>
              <div className="text-xs text-slate-500">المندوب المختار</div>
              <select className="mt-1 w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl py-2 px-3 text-sm" value={(selectedRepId as any) || ''} onChange={e=> onSelectRep(e.target.value ? Number(e.target.value) : '')}>
                <option value="">اختر المندوب</option>
                {reps.map(r=> <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="bg-white dark:bg-slate-800 p-3 rounded-xl shadow-sm text-center">
              <div className="text-xs text-slate-400">الرصيد السابق</div>
              <div className="font-black text-lg mt-1">{Math.abs(prevBalance).toLocaleString()} ج.م <span className="text-sm font-bold" style={{color: prevBalance>0? 'green': (prevBalance<0? 'red':'#666')}}>{prevBalance>0? 'له' : (prevBalance<0? 'عليه' : '')}</span></div>
            </div>
            <div className="bg-white dark:bg-slate-800 p-3 rounded-xl shadow-sm text-center">
              <div className="text-xs text-slate-400">عهدة الطلبيات</div>
              <div className="font-black text-lg mt-1">طلبات: {assignedOrders.length}</div>
              <div className="text-xs text-slate-400 mt-1">عدد منتجات مميز: <span className="font-bold">{assignedProductsCount}</span></div>
              <div className="text-xs text-slate-400 mt-1">عدد القطع: <span className="font-bold">{assignedOrders.reduce((s,o)=> s + (o.products?.reduce((ps:number,p:any)=> ps + Number(p.quantity||p.qty||0),0)||0),0)}</span></div>
            </div>
          </div>

          <div className="mb-4">
            <div className="text-xs text-slate-400 mb-2">الخزينة</div>
            <select disabled={userDefaults && userDefaults.default_treasury_id && !userDefaults.can_change_treasury} className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl py-2 px-3 text-sm" value={(selectedTreasuryId as any) || ''} onChange={e=>setSelectedTreasuryId(e.target.value?Number(e.target.value):'')}>
              <option value="">بدون</option>
              {treasuries.map(t=> <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>

          <div className="mb-4">
            <div className="text-xs text-slate-400 mb-2">المستودع للسحب</div>
            <select disabled={userDefaults && userDefaults.default_warehouse_id && !userDefaults.can_change_warehouse} className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl py-2 px-3 text-sm" value={(selectedWarehouseId as any) || ''} onChange={e=>setSelectedWarehouseId(e.target.value?Number(e.target.value):'')}>
              <option value="">اختر مستودع للسحب</option>
              {warehouses.map(w=> <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </div>

          <div className="mb-4">
            <div className="text-xs text-slate-400">نوع التعامل</div>
            <div className="flex items-center gap-3 mt-2">
              <label className={`flex items-center gap-2 px-3 py-2 rounded-xl cursor-pointer ${paymentDirection==='pay' ? 'bg-blue-50 dark:bg-blue-900/30' : ''}`}>
                <input type="radio" name="dir" checked={paymentDirection==='pay'} onChange={()=>setPaymentDirection('pay')} />
                <span className="text-sm">دفع للمندوب</span>
              </label>
              <label className={`flex items-center gap-2 px-3 py-2 rounded-xl cursor-pointer ${paymentDirection==='collect' ? 'bg-blue-50 dark:bg-blue-900/30' : ''}`}>
                <input type="radio" name="dir" checked={paymentDirection==='collect'} onChange={()=>setPaymentDirection('collect')} />
                <span className="text-sm">استلام من المندوب</span>
              </label>
            </div>
          </div>

          <div className="mb-4">
            <div className="text-xs text-slate-400 mb-2">المبلغ</div>
            <input type="number" className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl py-2 px-3 text-sm" value={paymentAdjustment} onChange={e=>setPaymentAdjustment(Number(e.target.value||0))} />
          </div>

          <div className="mt-4">
            <div className="text-xs text-slate-400">الاجمالي الجديد</div>
            <div className="mt-2 bg-white dark:bg-slate-800 p-3 rounded-xl shadow-sm text-center font-black text-lg">{(Number(prevBalance) + (paymentDirection === 'pay' ? -paymentAdjustment : paymentAdjustment) - currentTotalAmount).toLocaleString()}</div>
          </div>

          <div className="flex gap-2 mt-5">
            <button onClick={onComplete} className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white py-2 rounded-xl flex items-center justify-center gap-2"><ArrowRight /> إتمام اليومية</button>
            <button onClick={()=>{ const merged = [...assignedOrders, ...selectedOrders].filter((v,i,a)=>a.findIndex(x=>x.id===v.id)===i); printA4Report(merged, { repName: reps.find(r=>r.id===selectedRepId)?.name, prevBalance }) }} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 px-4 py-2 rounded-xl flex items-center gap-2"><Printer /> طباعة</button>
          </div>
        </div>

        {/* Right: scanner and orders list */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white dark:bg-slate-800 rounded-3xl p-4 shadow-sm border flex items-center gap-3">
            <ShoppingCart className="w-6 h-6 text-blue-600" />
            <div className="flex-1">
              <div className="text-xs text-slate-500">مسح باركود / رقم الطلبية</div>
              <div className="flex gap-3 mt-2">
                <input className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl py-3 px-4 text-sm" value={barcodeInput} onChange={e=>setBarcodeInput(e.target.value)} onKeyDown={e=>{ if(e.key==='Enter') { e.preventDefault(); scanBarcodeAddOrder(); } }} />
                <button type="button" onClick={scanBarcodeAddOrder} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-3 rounded-xl">أضف</button>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-3xl p-4 shadow-sm border mt-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-black">الطلبيات المتاحة (اختار عدة طلبيات)</h3>
              <div>
                <button onClick={addSelectedPendingToOrders} className="bg-blue-600 text-white px-3 py-2 rounded-xl">أضف المحددات</button>
              </div>
            </div>
            <div className="max-h-40 overflow-auto divide-y">
              {pendingOrdersList.length === 0 && <div className="p-3 text-sm text-slate-400">لا توجد طلبيات متاحة</div>}
              {pendingOrdersList.map((p:any) => (
                <div key={p.id} className="flex items-center justify-between p-2">
                  <label className="flex items-center gap-3">
                    <input type="checkbox" checked={selectedPendingIds.includes(p.id)} onChange={()=>togglePendingSelection(p.id)} />
                    <div>
                      <div className="font-bold">#{p.orderNumber || p.order_number} — {p.customerName || p.customer_name}</div>
                      <div className="text-xs text-slate-500">{p.governorate || ''} • {p.shipping || p.shippingCost || 0} ش</div>
                    </div>
                  </label>
                  <div className="font-bold">{(p.total || p.subTotal || 0).toLocaleString()}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-3xl p-4 shadow-sm border">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3"><Box className="text-slate-500" /><h3 className="font-black">الطلبيات المختارة ({[...assignedOrders, ...selectedOrders].filter((v,i,a)=>a.findIndex(x=>x.id===v.id)===i).length})</h3></div>
              <div className="text-sm text-slate-500">اجمالي: <span className="font-black">{currentTotalAmount.toLocaleString()}</span></div>
            </div>
            <div className="divide-y max-h-[420px] overflow-auto">
              {assignedOrders.length === 0 && selectedOrders.length === 0 && <div className="p-6 text-center text-slate-400">لم يتم اختيار طلبيات بعد</div>}
              {[
                ...assignedOrders.map(o => ({ ...o, isAssigned: true })),
                ...selectedOrders.filter(o => !assignedOrders.find(a => a.id === o.id)).map(o => ({ ...o, isAssigned: false }))
              ].map(o => {
                const sub = Number(o.subTotal || o.total || 0);
                const ship = Number(o.shipping || o.shippingCost || 0);
                const tot = sub + ship;
                return (
                    <div key={o.id} className={`flex items-center justify-between py-3 ${o.isAssigned ? 'bg-slate-50 dark:bg-slate-900/30 px-3 rounded-sm mb-2' : ''}`}>
                        <div>
                            <div className="font-bold">#{o.orderNumber} - {o.customerName} {o.isAssigned && <span className="text-xs text-emerald-600 mr-2">(في العهدة)</span>}</div>
                            <div className="text-xs text-slate-500 mt-1">{o.governorate || ''} • {o.phone || o.phone1 || ''}</div>
                            <div className="text-xs text-slate-400 mt-1">{(o.products||[]).reduce((s:number,p:any)=> s + Number(p.quantity||p.qty||0),0)} قطع</div>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="text-right text-xs">
                              <div>المجموع: <span className="font-black">{sub.toLocaleString()}</span></div>
                              <div>الشحن: <span className="font-black">{ship.toLocaleString()}</span></div>
                              <div className="font-black text-lg">الإجمالي: {tot.toLocaleString()}</div>
                            </div>
                            {o.isAssigned ? (
                              <button onClick={()=>unassignOrder(o.id)} className="text-rose-600 p-2 rounded-xl hover:bg-rose-50">إعادة</button>
                            ) : (
                              <button onClick={()=>removeSelectedOrder(o.id)} className="text-rose-600 p-2 rounded-xl hover:bg-rose-50"><Trash2 /></button>
                            )}
                        </div>
                    </div>
                )
              })}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-sm text-center">
              <div className="text-xs text-slate-400">عدد الطلبيات</div>
              <div className="font-black text-lg mt-1">{[...assignedOrders, ...selectedOrders].filter((v,i,a)=>a.findIndex(x=>x.id===v.id)===i).length}</div>
            </div>
            <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-sm text-center">
              <div className="text-xs text-slate-400">اجمالي المنتج</div>
              <div className="font-black text-lg mt-1">{totalProductsCount}</div>
            </div>
            <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-sm text-center">
              <div className="text-xs text-slate-400">اجمالي المستحق</div>
              <div className="font-black text-lg mt-1">{currentTotalAmount.toLocaleString()}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SalesDaily;
