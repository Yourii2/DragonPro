import React, { useEffect, useMemo, useRef, useState } from 'react';
import Swal from 'sweetalert2';
import { API_BASE_PATH } from '../services/apiConfig';
import CustomSelect from './CustomSelect';

type Product = {
  id: number;
  name: string;
  barcode?: string | null;
  price?: number | string;
  sale_price?: number | string;
  stock?: number | string;
  color?: string | null;
  size?: string | null;
};

type CartLine = {
  product: Product;
  qty: number;
};

type Customer = {
  id: number;
  name: string;
  balance?: number | string;
};

type Treasury = {
  id: number;
  name: string;
  balance?: number | string;
};

type Warehouse = {
  id: number;
  name: string;
};

type UserDefaults = {
  default_warehouse_id?: number | null;
  default_treasury_id?: number | null;
  can_change_warehouse?: boolean;
  can_change_treasury?: boolean;
};

function escapeHtml(value: any): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function toNumber(value: any): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function getProductPrice(p: Product): number {
  return toNumber(p.sale_price ?? p.price ?? 0);
}

function buildReceiptHtml(mode: 'thermal' | 'a4', opts: {
  lines: Array<{ name: string; qty: number; unitPrice: number; lineTotal: number }>;
  total: number;
  itemsCount: number;
  cashierName?: string;
  customerName?: string;
  paidAmount?: number;
  remainingAmount?: number;
  dateTime: string;
}): string {
  const title = 'إيصال بيع';
  const header = `
    <div style="text-align:center; font-weight:800; font-size:${mode === 'thermal' ? '14px' : '18px'};">${title}</div>
    <div style="margin-top:6px; display:flex; justify-content:space-between; gap:8px; font-size:${mode === 'thermal' ? '11px' : '12px'};">
      <div>التاريخ: ${escapeHtml(opts.dateTime)}</div>
      <div>الكاشير: ${escapeHtml(opts.cashierName || '')}</div>
    </div>
    <div style="margin-top:6px; display:flex; justify-content:space-between; gap:8px; font-size:${mode === 'thermal' ? '11px' : '12px'};">
      <div>العميل: ${escapeHtml(opts.customerName || '')}</div>
      <div></div>
    </div>
  `;

  const rows = opts.lines
    .map(l => {
      const name = escapeHtml(l.name);
      const qty = escapeHtml(l.qty);
      const unit = escapeHtml(l.unitPrice.toLocaleString());
      const lt = escapeHtml(l.lineTotal.toLocaleString());
      return `<tr>
        <td style="padding:6px 4px;">${name}</td>
        <td style="padding:6px 4px; text-align:center;">${qty}</td>
        <td style="padding:6px 4px; text-align:left; white-space:nowrap;">${unit}</td>
        <td style="padding:6px 4px; text-align:left; white-space:nowrap; font-weight:800;">${lt}</td>
      </tr>`;
    })
    .join('');

  const footer = `
    <div style="margin-top:10px; border-top:1px dashed #999; padding-top:8px; display:flex; justify-content:space-between; font-size:${mode === 'thermal' ? '12px' : '13px'};">
      <div>عدد القطع: <b>${escapeHtml(opts.itemsCount)}</b></div>
      <div>الإجمالي: <b>${escapeHtml(opts.total.toLocaleString())}</b> ج.م</div>
    </div>
    <div style="margin-top:6px; display:flex; justify-content:space-between; gap:8px; font-size:${mode === 'thermal' ? '12px' : '13px'};">
      <div>المدفوع: <b>${escapeHtml(toNumber(opts.paidAmount).toLocaleString())}</b> ج.م</div>
      <div>المتبقي: <b>${escapeHtml(Math.max(0, toNumber(opts.remainingAmount)).toLocaleString())}</b> ج.م</div>
    </div>
  `;

  if (mode === 'thermal') {
    return `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title>
      <style>
        @page{size:80mm auto; margin:4mm;}
        body{font-family: Arial, Helvetica, "Noto Naskh Arabic", sans-serif; direction:rtl; padding:6px; width:80mm; box-sizing:border-box; font-size:12px;}
        table{width:100%; border-collapse:collapse; margin-top:10px;}
        th,td{border-bottom:1px solid #ddd; font-size:12px;}
        th{padding:6px 4px; text-align:right; background:#f5f5f5;}
      </style>
    </head><body>
      ${header}
      <table>
        <thead><tr><th>الصنف</th><th style="text-align:center">ك</th><th style="text-align:left">سعر</th><th style="text-align:left">الإجمالي</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      ${footer}
    </body></html>`;
  }

  return `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title>
    <style>
      @page{size:A4; margin:18mm;}
      body{font-family: Arial, Helvetica, "Noto Naskh Arabic", sans-serif; direction:rtl; padding:10px; color:#111;}
      table{width:100%; border-collapse:collapse; margin-top:12px;}
      th,td{border:1px solid #333; padding:8px; font-size:12px; text-align:right;}
      th{background:#f3f4f6;}
      .meta{margin-top:8px; display:flex; justify-content:space-between; gap:10px; font-size:12px;}
      .meta2{margin-top:6px; display:flex; justify-content:space-between; gap:10px; font-size:12px;}
    </style>
  </head><body>
    <h1 style="text-align:center; margin:0;">${title}</h1>
    <div class="meta"><div>التاريخ: ${escapeHtml(opts.dateTime)}</div><div>الكاشير: ${escapeHtml(opts.cashierName || '')}</div></div>
    <div class="meta2"><div>العميل: ${escapeHtml(opts.customerName || '')}</div><div>المدفوع: ${escapeHtml(toNumber(opts.paidAmount).toLocaleString())} ج.م</div></div>
    <div class="meta2"><div>المتبقي: ${escapeHtml(Math.max(0, toNumber(opts.remainingAmount)).toLocaleString())} ج.م</div><div></div></div>
    <table>
      <thead><tr><th>الصنف</th><th style="text-align:center">الكمية</th><th style="text-align:left">سعر الوحدة</th><th style="text-align:left">الإجمالي</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    ${footer}
  </body></html>`;
}

function printHtml(html: string, windowFeatures: string) {
  const w = window.open('', '_blank', windowFeatures);
  if (!w) return;
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(() => {
    try { w.print(); } catch {}
  }, 400);
}

const PointOfSale: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<Product[]>([]);
  const [barcodeInput, setBarcodeInput] = useState('');
  const [productSearch, setProductSearch] = useState('');
  const [cart, setCart] = useState<CartLine[]>([]);

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<number | 'cash' | ''>('cash');
  const [treasuries, setTreasuries] = useState<Treasury[]>([]);
  const [selectedTreasuryId, setSelectedTreasuryId] = useState<number | ''>('');
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<number | ''>('');
  const [userDefaults, setUserDefaults] = useState<UserDefaults | null>(null);

  const [paidAmount, setPaidAmount] = useState<number>(0);
  const [notes, setNotes] = useState<string>('بيع نقطة البيع');
  const [printMode, setPrintMode] = useState<'thermal' | 'a4'>(() => {
    const v = (localStorage.getItem('Dragon_pos_print_mode') || 'thermal').toLowerCase();
    return v === 'a4' ? 'a4' : 'thermal';
  });

  const barcodeRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [pr, cr, tr, wr, ud] = await Promise.all([
          fetch(`${API_BASE_PATH}/api.php?module=products&action=getAll`).then(r => r.json()).catch(() => ({ success: false, data: [] })),
          fetch(`${API_BASE_PATH}/api.php?module=customers&action=getAll`).then(r => r.json()).catch(() => ({ success: false, data: [] })),
          fetch(`${API_BASE_PATH}/api.php?module=treasuries&action=getAll`).then(r => r.json()).catch(() => ({ success: false, data: [] })),
          fetch(`${API_BASE_PATH}/api.php?module=warehouses&action=getAll`).then(r => r.json()).catch(() => ({ success: false, data: [] })),
          fetch(`${API_BASE_PATH}/api.php?module=permissions&action=getUserDefaults`).then(r => r.json()).catch(() => ({ success: false }))
        ]);

        setProducts(pr && pr.success ? (pr.data || []) : []);
        setCustomers(cr && cr.success ? (cr.data || []) : []);

        const defaults: UserDefaults | null = ud && ud.success ? (ud.data || null) : null;
        if (defaults) setUserDefaults(defaults);

        const allTreasuries: Treasury[] = tr && tr.success ? (tr.data || []) : [];
        const allWarehouses: Warehouse[] = wr && wr.success ? (wr.data || []) : [];

        if (defaults?.default_treasury_id && defaults?.can_change_treasury === false) {
          setTreasuries(allTreasuries.filter(t => Number(t.id) === Number(defaults.default_treasury_id)));
          if (!selectedTreasuryId) setSelectedTreasuryId(Number(defaults.default_treasury_id));
        } else {
          setTreasuries(allTreasuries);
          if (!selectedTreasuryId && defaults?.default_treasury_id) setSelectedTreasuryId(Number(defaults.default_treasury_id));
        }

        if (defaults?.default_warehouse_id && defaults?.can_change_warehouse === false) {
          setWarehouses(allWarehouses.filter(w => Number(w.id) === Number(defaults.default_warehouse_id)));
          if (!selectedWarehouseId) setSelectedWarehouseId(Number(defaults.default_warehouse_id));
        } else {
          setWarehouses(allWarehouses);
          if (!selectedWarehouseId && defaults?.default_warehouse_id) setSelectedWarehouseId(Number(defaults.default_warehouse_id));
        }
      } catch (e) {
        console.error(e);
        setProducts([]);
        setCustomers([]);
      } finally {
        setLoading(false);
        setTimeout(() => barcodeRef.current?.focus(), 50);
      }
    };
    load();
  }, []);

  useEffect(() => {
    localStorage.setItem('Dragon_pos_print_mode', printMode);
  }, [printMode]);

  const filteredProducts = useMemo(() => {
    const q = (productSearch || '').trim().toLowerCase();
    if (!q) return products.slice(0, 50);
    return products
      .filter(p => {
        const name = String(p.name || '').toLowerCase();
        const bc = String(p.barcode || '').toLowerCase();
        return name.includes(q) || bc.includes(q);
      })
      .slice(0, 50);
  }, [productSearch, products]);

  const totals = useMemo(() => {
    const itemsCount = cart.reduce((s, l) => s + l.qty, 0);
    const total = cart.reduce((s, l) => s + l.qty * getProductPrice(l.product), 0);
    return { itemsCount, total };
  }, [cart]);

  useEffect(() => {
    if (selectedCustomer === 'cash') {
      setPaidAmount(Number(totals.total || 0));
    }
  }, [selectedCustomer, totals.total]);

  const addToCart = (product: Product, qtyDelta = 1) => {
    if (!product || !product.id) return;
    const delta = Math.max(1, Number(qtyDelta || 1));
    setCart(prev => {
      const next = [...prev];
      const idx = next.findIndex(x => Number(x.product.id) === Number(product.id));
      if (idx >= 0) {
        next[idx] = { ...next[idx], qty: Math.max(1, next[idx].qty + delta) };
      } else {
        next.unshift({ product, qty: delta });
      }
      return next;
    });
  };

  const setLineQty = (productId: number, qty: number) => {
    const q = Math.max(0, Math.floor(Number(qty || 0)));
    setCart(prev => {
      if (q <= 0) return prev.filter(l => Number(l.product.id) !== Number(productId));
      return prev.map(l => (Number(l.product.id) === Number(productId) ? { ...l, qty: q } : l));
    });
  };

  const scanBarcode = (barcode: string) => {
    const code = String(barcode || '').trim();
    if (!code) return;
    const match = products.find(p => String(p.barcode || '').trim() === code);
    if (!match) {
      Swal.fire({ icon: 'warning', title: 'غير موجود', text: `لا يوجد منتج بهذا الباركود: ${code}`, timer: 1500, showConfirmButton: false });
      return;
    }
    addToCart(match, 1);
  };

  const ensureCashCustomerId = async (): Promise<number> => {
    const candidates = customers || [];
    const existing = candidates.find(c => {
      const n = String(c.name || '').trim().toLowerCase();
      return n === 'عميل كاش' || n === 'عميل نقدي' || n === 'cash customer' || n === 'walk-in' || n === 'walk in';
    });
    if (existing?.id) return Number(existing.id);

    const resp = await fetch(`${API_BASE_PATH}/api.php?module=customers&action=create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'عميل كاش' })
    });
    const jr = await resp.json();
    if (!jr || !jr.success) throw new Error(jr?.message || 'Failed to create cash customer');

    // refresh list (and also accept returned row if present)
    try {
      const cr = await fetch(`${API_BASE_PATH}/api.php?module=customers&action=getAll`);
      const jcr = await cr.json();
      if (jcr && jcr.success) setCustomers(jcr.data || []);
    } catch {}

    const createdId = jr?.data?.id ? Number(jr.data.id) : 0;
    if (createdId) return createdId;
    throw new Error('Cash customer created but id missing');
  };

  const completeSale = async () => {
    if (cart.length === 0) {
      Swal.fire('تنبيه', 'السلة فارغة.', 'warning');
      return;
    }

    if (!selectedWarehouseId) {
      Swal.fire('تنبيه', 'يرجى اختيار المستودع.', 'warning');
      return;
    }

    if (!selectedTreasuryId) {
      Swal.fire('تنبيه', 'يرجى اختيار الخزينة.', 'warning');
      return;
    }

    if (!selectedCustomer) {
      Swal.fire('تنبيه', 'يرجى اختيار العميل.', 'warning');
      return;
    }

    const receiptLines = cart.map(l => ({
      name: String(l.product.name || ''),
      qty: Number(l.qty || 0),
      unitPrice: getProductPrice(l.product),
      lineTotal: Number(l.qty || 0) * getProductPrice(l.product)
    }));
    const receiptTotal = receiptLines.reduce((s, l) => s + Number(l.lineTotal || 0), 0);
    const receiptItemsCount = receiptLines.reduce((s, l) => s + Number(l.qty || 0), 0);
    const cashierName = (() => {
      try {
        const u = JSON.parse(localStorage.getItem('Dragon_user') || 'null');
        return u?.name ? String(u.name) : '';
      } catch {
        return '';
      }
    })();
    const dateTime = new Date().toLocaleString();

    const total = Number(receiptTotal || 0);
    const paid = selectedCustomer === 'cash'
      ? total
      : Math.max(0, Math.min(total, Number(paidAmount || 0)));
    const remaining = Math.max(0, total - paid);

    const customerName = (() => {
      if (selectedCustomer === 'cash') return 'عميل كاش';
      const id = Number(selectedCustomer);
      const c = customers.find(x => Number(x.id) === id);
      return c?.name ? String(c.name) : '';
    })();

    const res = await Swal.fire({
      icon: 'question',
      title: 'إتمام البيع',
      text: 'هل انت متأكد من اتمام البيع',
      showCancelButton: true,
      confirmButtonText: 'متأكد',
      cancelButtonText: 'إلغاء'
    });

    if (!res.isConfirmed) return;

    try {
      const customerId = selectedCustomer === 'cash' ? await ensureCashCustomerId() : Number(selectedCustomer);
      const payload = {
        customerId,
        warehouseId: Number(selectedWarehouseId),
        treasuryId: Number(selectedTreasuryId),
        paidAmount: paid,
        reason: (notes || '').trim() || 'بيع نقطة البيع',
        items: cart.map(l => ({
          productId: Number(l.product.id),
          qty: Number(l.qty || 0),
          price: getProductPrice(l.product)
        }))
      };

      const response = await fetch(`${API_BASE_PATH}/api.php?module=sales&action=create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const result = await response.json();
      if (!result || !result.success) {
        throw new Error(result?.message || 'فشل إتمام البيع');
      }

      setCart([]);
      setBarcodeInput('');
      setProductSearch('');
      if (selectedCustomer !== 'cash') setPaidAmount(0);

      // Auto print after success
      const html = buildReceiptHtml(printMode, { lines: receiptLines, total: receiptTotal, itemsCount: receiptItemsCount, cashierName, dateTime, customerName, paidAmount: paid, remainingAmount: remaining });
      if (printMode === 'thermal') {
        printHtml(html, 'toolbar=0,location=0,menubar=0,scrollbars=1,resizable=1,width=520,height=700');
      } else {
        printHtml(html, 'toolbar=0,location=0,menubar=0,scrollbars=1,resizable=1,width=900,height=700');
      }

      Swal.fire({
        icon: 'success',
        title: 'تم',
        text: 'تم إتمام البيع بنجاح.',
        timer: 1200,
        showConfirmButton: false
      });
    } catch (e: any) {
      Swal.fire('خطأ', e?.message || 'حدث خطأ أثناء إتمام البيع', 'error');
    }

    setTimeout(() => barcodeRef.current?.focus(), 50);
  };

  return (
    <div className="p-4 rounded-2xl border border-card dir-rtl card" style={{ backgroundColor: 'var(--card-bg)', color: 'var(--text)' }}>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h2 className="font-black text-lg">نقطة البيع</h2>
        <div className="text-sm text-slate-500">عدد القطع: <span className="font-black">{totals.itemsCount}</span> — الإجمالي: <span className="font-black">{totals.total.toLocaleString()} ج.م</span></div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-3 mb-4">
        <div className="lg:col-span-2">
          <label className="block text-sm font-bold mb-1">العميل</label>
          <CustomSelect
            value={selectedCustomer === 'cash' ? 'cash' : (selectedCustomer ? String(selectedCustomer) : '')}
            onChange={(v) => {
              if (v === 'cash') setSelectedCustomer('cash');
              else setSelectedCustomer(v ? Number(v) : '');
            }}
            options={[
              { value: 'cash', label: 'عميل كاش' },
              { value: '', label: '-- اختر عميل --' },
              ...customers.map(c => ({ value: String(c.id), label: `${c.name}${(typeof c.balance !== 'undefined') ? ` (الرصيد: ${toNumber(c.balance).toLocaleString()})` : ''}` }))
            ]}
            placeholder="العميل"
          />
        </div>

        <div>
          <label className="block text-sm font-bold mb-1">المستودع</label>
          <CustomSelect
            value={(selectedWarehouseId as any) || ''}
            onChange={v => setSelectedWarehouseId(v ? Number(v) : '')}
            disabled={!!(userDefaults?.default_warehouse_id && userDefaults?.can_change_warehouse === false)}
            options={[{ value: '', label: '-- اختر --' }, ...warehouses.map(w => ({ value: String(w.id), label: w.name }))]}
            placeholder="المستودع"
          />
        </div>

        <div>
          <label className="block text-sm font-bold mb-1">الخزينة</label>
          <CustomSelect
            value={(selectedTreasuryId as any) || ''}
            onChange={v => setSelectedTreasuryId(v ? Number(v) : '')}
            disabled={!!(userDefaults?.default_treasury_id && userDefaults?.can_change_treasury === false)}
            options={[{ value: '', label: '-- اختر --' }, ...treasuries.map(t => ({ value: String(t.id), label: `${t.name}${(typeof t.balance !== 'undefined') ? ` (الرصيد: ${toNumber(t.balance).toLocaleString()})` : ''}` }))]}
            placeholder="الخزينة"
          />
        </div>

        <div>
          <label className="block text-sm font-bold mb-1">المدفوع</label>
          <input
            type="number"
            min={0}
            value={paidAmount}
            disabled={selectedCustomer === 'cash'}
            onChange={e => setPaidAmount(Number(e.target.value))}
            className="w-full border rounded-xl p-2"
            placeholder="0"
          />
          {selectedCustomer === 'cash' && <div className="text-xs text-slate-500 mt-1">عميل كاش: يتم الدفع تلقائياً.</div>}
        </div>

        <div className="lg:col-span-2">
          <label className="block text-sm font-bold mb-1">ملاحظات / سبب المعاملة</label>
          <input
            value={notes}
            onChange={e => setNotes(e.target.value)}
            className="w-full border rounded-xl p-2"
            placeholder="بيع نقطة البيع"
          />
        </div>

        <div>
          <label className="block text-sm font-bold mb-1">نوع الطباعة</label>
          <CustomSelect
            value={printMode}
            onChange={v => setPrintMode(v === 'a4' ? 'a4' : 'thermal')}
            options={[{ value: 'thermal', label: '80mm' }, { value: 'a4', label: 'A4' }]}
            placeholder="نوع الطباعة"
          />
        </div>

        <div className="flex items-end">
          <div className="text-xs text-slate-500">
            المتبقي: <span className="font-black">{Math.max(0, Number(totals.total || 0) - Number(selectedCustomer === 'cash' ? totals.total : paidAmount || 0)).toLocaleString()}</span> ج.م
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-sm text-slate-500">جاري تحميل المنتجات...</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Left: Scan + Product list */}
          <div className="rounded-2xl border border-card card p-4" style={{ backgroundColor: 'var(--card-bg)' }}>
            <div className="mb-3">
              <label className="block text-sm font-bold mb-1">مسح بالباركود</label>
              <input
                ref={barcodeRef}
                value={barcodeInput}
                onChange={e => setBarcodeInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    scanBarcode(barcodeInput);
                    setBarcodeInput('');
                  }
                }}
                className="w-full border rounded-xl p-2"
                placeholder="امسح الباركود هنا ثم Enter"
              />
              <div className="text-xs text-slate-500 mt-1">يمكنك أيضاً البحث واختيار المنتجات يدوياً من القائمة.</div>
            </div>

            <div className="mb-2">
              <label className="block text-sm font-bold mb-1">بحث عن منتج</label>
              <input
                value={productSearch}
                onChange={e => setProductSearch(e.target.value)}
                className="w-full border rounded-xl p-2"
                placeholder="اسم المنتج أو الباركود"
              />
            </div>

            <div className="max-h-[55vh] overflow-y-auto space-y-2 pr-1">
              {filteredProducts.length === 0 ? (
                <div className="text-sm text-slate-500">لا توجد منتجات مطابقة.</div>
              ) : (
                filteredProducts.map(p => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => addToCart(p, 1)}
                    className="w-full text-right p-3 rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="font-bold">{p.name}</div>
                      <div className="font-black text-blue-700">{getProductPrice(p).toLocaleString()} ج.م</div>
                    </div>
                    <div className="text-xs text-slate-500 mt-1 flex flex-wrap gap-3">
                      <span>باركود: {p.barcode || '-'}</span>
                      <span>مخزون: {toNumber(p.stock).toLocaleString()}</span>
                      {(p.color || p.size) && <span>{[p.color, p.size].filter(Boolean).join(' / ')}</span>}
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Right: Cart */}
          <div className="rounded-2xl border border-card card p-4" style={{ backgroundColor: 'var(--card-bg)' }}>
            <div className="flex items-center justify-between mb-3">
              <div className="font-black">السلة</div>
              <button
                type="button"
                onClick={() => { setCart([]); setTimeout(() => barcodeRef.current?.focus(), 50); }}
                className="px-3 py-2 rounded-xl bg-red-100 text-red-700 text-xs font-bold hover:bg-red-200"
              >
                مسح السلة
              </button>
            </div>

            {cart.length === 0 ? (
              <div className="text-sm text-slate-500">أضف منتجات للبدء.</div>
            ) : (
              <div className="space-y-2 max-h-[55vh] overflow-y-auto pr-1">
                {cart.map(line => (
                  <div key={line.product.id} className="p-3 rounded-xl border border-slate-200">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="font-bold">{line.product.name}</div>
                        <div className="text-xs text-slate-500 mt-1">باركود: {line.product.barcode || '-'}</div>
                      </div>
                      <div className="text-left">
                        <div className="font-black">{(line.qty * getProductPrice(line.product)).toLocaleString()} ج.م</div>
                        <div className="text-xs text-slate-500">{getProductPrice(line.product).toLocaleString()} × {line.qty}</div>
                      </div>
                    </div>

                    <div className="mt-2 flex items-center gap-2">
                      <button type="button" onClick={() => setLineQty(line.product.id, line.qty - 1)} className="px-3 py-1.5 rounded-lg bg-slate-100 font-black">-</button>
                      <input
                        type="number"
                        min={0}
                        value={line.qty}
                        onChange={e => setLineQty(line.product.id, Number(e.target.value))}
                        className="w-24 border rounded-lg p-1 text-center"
                      />
                      <button type="button" onClick={() => setLineQty(line.product.id, line.qty + 1)} className="px-3 py-1.5 rounded-lg bg-slate-100 font-black">+</button>
                      <div className="flex-1"></div>
                      <button type="button" onClick={() => setLineQty(line.product.id, 0)} className="px-3 py-1.5 rounded-lg bg-red-100 text-red-700 text-xs font-bold">حذف</button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-4 pt-4 border-t flex items-center justify-between gap-3">
              <div className="font-black">الإجمالي: {totals.total.toLocaleString()} ج.م</div>
              <button
                type="button"
                onClick={completeSale}
                className="px-5 py-3 rounded-2xl bg-emerald-600 text-white font-black hover:bg-emerald-700"
              >
                إتمام البيع
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PointOfSale;
