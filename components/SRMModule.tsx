import React, { useState, useEffect } from 'react';
import { Search, Plus, Truck, FileText, Phone, MapPin, X, Save, Edit, Eye, Printer, Wallet } from 'lucide-react';
import Swal from 'sweetalert2';
import { API_BASE_PATH } from '../services/apiConfig';
import { assetUrl } from '../services/assetUrl';

const toAbsoluteUrl = (input: string) => {
    if (typeof window === 'undefined') return input;
    try {
        return new URL(input, window.location.href).toString();
    } catch {
        return input;
    }
};

const SRMModule: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLedgerModalOpen, setIsLedgerModalOpen] = useState(false);
    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
    const [isReceiveModalOpen, setIsReceiveModalOpen] = useState(false);
  
  // States for Invoice Viewing/Printing
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
  const [invoiceToPrint, setInvoiceToPrint] = useState<any>(null);

  const [editingSupplier, setEditingSupplier] = useState<any>(null);
  const [selectedSupplier, setSelectedSupplier] = useState<any>(null);
  const currencySymbol = 'ج.م';

  // --- Real Data State ---
  // تبدأ فارغة، ويتم ملؤها إما من الإضافة اليدوية أو من قاعدة البيانات لاحقاً
  const [suppliers, setSuppliers] = useState<any[]>([]); 
  const [ledgerEntries, setLedgerEntries] = useState<any[]>([]);
    const [openingBalance, setOpeningBalance] = useState(0);
    const [ledgerStartDate, setLedgerStartDate] = useState('');
    const [ledgerEndDate, setLedgerEndDate] = useState('');

    const [treasuries, setTreasuries] = useState<any[]>([]);
    const [warehouses, setWarehouses] = useState<any[]>([]);
    const [products, setProducts] = useState<any[]>([]);

    const [paymentAmount, setPaymentAmount] = useState('');
    const [paymentTreasuryId, setPaymentTreasuryId] = useState('');
    const [paymentNotes, setPaymentNotes] = useState('');

    const [receiveSupplierId, setReceiveSupplierId] = useState('');
    const [receiveWarehouseId, setReceiveWarehouseId] = useState('');
    const [receivePaidAmount, setReceivePaidAmount] = useState('');
    const [receiveTreasuryId, setReceiveTreasuryId] = useState('');
    const [receiveNotes, setReceiveNotes] = useState('');
    const [receiveItems, setReceiveItems] = useState<any[]>([
            { productId: '', name: '', qty: 1, costPrice: '', sellingPrice: '' }
    ]);

  const [formData, setFormData] = useState({ name: '', phone: '', address: '' });
    const [userDefaults, setUserDefaults] = useState<any>(null);

  // --- Fetch Data Effect ---
  const fetchSuppliers = async () => {
      try {
          const response = await fetch(`${API_BASE_PATH}/api.php?module=suppliers&action=getAll`);
          const result = await response.json();
          if (result.success) {
              setSuppliers(result.data || []);
          } else {
              console.error('Failed to fetch suppliers:', result.message);
          }
      } catch (err) {
          console.error('Error fetching suppliers:', err);
      }
  };

  const fetchLookups = async () => {
      try {
          const [treasuryRes, warehouseRes, productRes] = await Promise.all([
              fetch(`${API_BASE_PATH}/api.php?module=treasuries&action=getAll`),
              fetch(`${API_BASE_PATH}/api.php?module=warehouses&action=getAll`),
              fetch(`${API_BASE_PATH}/api.php?module=products&action=getAll`)
          ]);

          const treasuryResult = await treasuryRes.json();
          const warehouseResult = await warehouseRes.json();
          const productResult = await productRes.json();

          if (treasuryResult.success) setTreasuries(treasuryResult.data || []);
          if (warehouseResult.success) setWarehouses(warehouseResult.data || []);
          if (productResult.success) setProducts(productResult.data || []);
      } catch (err) {
          console.error('Error fetching lookups:', err);
      }
  };

  const fetchUserDefaults = async () => {
      try {
          const response = await fetch(`${API_BASE_PATH}/api.php?module=permissions&action=getUserDefaults`);
          const result = await response.json();
          if (result && result.success) {
              setUserDefaults(result.data || null);
          }
      } catch (err) {
          console.error('Error fetching user defaults:', err);
      }
  };

  useEffect(() => {
      fetchSuppliers();
      fetchLookups();
      fetchUserDefaults();
  }, []);

  useEffect(() => {
      if (!userDefaults) return;
      if (userDefaults.default_treasury_id && !userDefaults.can_change_treasury) {
          if (!receiveTreasuryId) setReceiveTreasuryId(String(userDefaults.default_treasury_id));
      }
      if (userDefaults.default_warehouse_id && !userDefaults.can_change_warehouse) {
          if (!receiveWarehouseId) setReceiveWarehouseId(String(userDefaults.default_warehouse_id));
      }
  }, [userDefaults, receiveTreasuryId, receiveWarehouseId]);

  // --- Handlers ---
  const handleOpenModal = (supplier: any = null) => {
    if (supplier) {
      setEditingSupplier(supplier);
      setFormData({ name: supplier.name, phone: supplier.phone, address: supplier.address });
    } else {
      setEditingSupplier(null);
      setFormData({ name: '', phone: '', address: '' });
    }
    setIsModalOpen(true);
  };

  // --- دالة الحفظ المعدلة لتحديث الشاشة فوراً ---
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) return;
        (async () => {
            try {
                if (editingSupplier) {
                    const response = await fetch(`${API_BASE_PATH}/api.php?module=suppliers&action=update`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ ...formData, id: editingSupplier.id })
                    });
                    const result = await response.json();
                    if (result.success) {
                        setSuppliers(prev => prev.map(s => s.id === editingSupplier.id ? { ...s, ...formData } : s));
                        setIsModalOpen(false);
                        Swal.fire('تم الحفظ', 'تم حفظ تعديلات المورد بنجاح', 'success');
                    } else {
                        Swal.fire('فشل الحفظ', result.message || 'فشل تحديث المورد', 'error');
                    }
                } else {
                    const response = await fetch(`${API_BASE_PATH}/api.php?module=suppliers&action=create`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(formData)
                    });
                    const result = await response.json();
                    if (result.success) {
                        // Use server-provided record (with real id)
                        setSuppliers(prev => [...prev, result.data]);
                        setIsModalOpen(false);
                        Swal.fire('تم الحفظ', 'تم إضافة مورد جديد بنجاح', 'success');
                    } else {
                        Swal.fire('فشل الحفظ', result.message || 'فشل إضافة المورد', 'error');
                    }
                }
            } catch (err) {
                console.error('Supplier save error:', err);
                Swal.fire('خطأ في الاتصال', 'فشل الاتصال بالخادم. يرجى التحقق من الاتصال.', 'error');
            }
        })();
  };

    const normalizeLedgerItems = (details: any) => {
            if (!details) return [];
            if (Array.isArray(details)) return details;
            if (typeof details === 'object' && Array.isArray(details.items)) return details.items;
            return [];
    };

  const fetchSupplierLedger = async (supplierId: number, startDate: string, endDate: string) => {
      try {
          const response = await fetch(`${API_BASE_PATH}/api.php?module=suppliers&action=getLedger&supplier_id=${supplierId}&start_date=${startDate}&end_date=${endDate}`);
          const result = await response.json();
          if (result.success) {
              setOpeningBalance(Number(result.data?.opening_balance || 0));
              setLedgerEntries(result.data?.entries || []);
          } else {
              console.error('Failed to fetch ledger entries:', result.message);
          }
      } catch (err) {
          console.error('Error fetching ledger entries:', err);
      }
  };

  const handleOpenLedger = (supplier: any) => {
      const now = new Date();
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      const defaultStart = firstDay.toISOString().slice(0, 10);
      const defaultEnd = now.toISOString().slice(0, 10);

      setSelectedSupplier(supplier);
      setLedgerEntries([]);
      setOpeningBalance(0);
      setLedgerStartDate(defaultStart);
      setLedgerEndDate(defaultEnd);
      fetchSupplierLedger(supplier.id, defaultStart, defaultEnd);
      setIsLedgerModalOpen(true);
  };

  const handleRefreshLedger = () => {
      if (!selectedSupplier) return;
      const startDate = ledgerStartDate || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);
      const endDate = ledgerEndDate || new Date().toISOString().slice(0, 10);
      fetchSupplierLedger(selectedSupplier.id, startDate, endDate);
  };

  const handleRecordPayment = async () => {
      if (!selectedSupplier) return;
      const amount = Number(paymentAmount || 0);
      const treasuryId = Number(paymentTreasuryId || 0);
      if (!amount || !treasuryId) {
          Swal.fire('بيانات ناقصة', 'يرجى إدخال المبلغ واختيار الخزينة.', 'warning');
          return;
      }

      try {
          const response = await fetch(`${API_BASE_PATH}/api.php?module=suppliers&action=recordPayment`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                  supplier_id: selectedSupplier.id,
                  amount,
                  treasury_id: treasuryId,
                  notes: paymentNotes
              })
          });
          const result = await response.json();
          if (result.success) {
              Swal.fire('تم السداد', 'تم تسجيل السداد بنجاح.', 'success');
              setIsPaymentModalOpen(false);
              setPaymentAmount('');
              setPaymentNotes('');
              handleRefreshLedger();
              fetchSuppliers();
          } else {
              Swal.fire('فشل السداد', result.message || 'تعذر تسجيل السداد.', 'error');
          }
      } catch (err) {
          console.error('Payment error:', err);
          Swal.fire('خطأ في الاتصال', 'فشل الاتصال بالخادم.', 'error');
      }
  };

  const updateReceiveItem = (index: number, changes: any) => {
      setReceiveItems(prev => prev.map((it, i) => i === index ? { ...it, ...changes } : it));
  };

  const addReceiveItem = () => {
      setReceiveItems(prev => [...prev, { productId: '', name: '', qty: 1, costPrice: '', sellingPrice: '' }]);
  };

  const removeReceiveItem = (index: number) => {
      setReceiveItems(prev => prev.filter((_, i) => i !== index));
  };

  const handleCreateReceiving = async () => {
      const supplierId = Number(receiveSupplierId || 0);
      const warehouseId = Number(receiveWarehouseId || 0);
      if (!supplierId || !warehouseId || receiveItems.length === 0) {
          Swal.fire('بيانات ناقصة', 'يرجى اختيار المورد والمخزن وإضافة صنف واحد على الأقل.', 'warning');
          return;
      }

      const itemsPayload = receiveItems.map((it: any) => ({
          productId: it.productId ? Number(it.productId) : 0,
          name: it.name || undefined,
          qty: Number(it.qty || 0),
          costPrice: Number(it.costPrice || 0),
          sellingPrice: Number(it.sellingPrice || 0)
      })).filter((it: any) => it.qty > 0 && (it.productId || it.name));

      if (itemsPayload.length === 0) {
          Swal.fire('بيانات ناقصة', 'يرجى إدخال كميات صحيحة للأصناف.', 'warning');
          return;
      }

      const paidAmount = Number(receivePaidAmount || 0);
      const treasuryId = Number(receiveTreasuryId || 0);

      try {
          const response = await fetch(`${API_BASE_PATH}/api.php?module=receivings&action=create`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                  supplierId,
                  warehouseId,
                  items: itemsPayload,
                  paidAmount,
                  treasuryId,
                  notes: receiveNotes
              })
          });
          const result = await response.json();
          if (result.success) {
              let barcodeMsg = '';
              if (Array.isArray(result.new_barcodes) && result.new_barcodes.length > 0) {
                  barcodeMsg = '\n\nباركودات الأصناف الجديدة:\n' + result.new_barcodes.map(b => `${b.name} (${b.type}): ${b.barcode}`).join('\n');
              }
              Swal.fire('تم الإنشاء', 'تم حفظ فاتورة الشراء وتحديث المخزون.' + barcodeMsg, 'success');
              setIsReceiveModalOpen(false);
              setReceiveSupplierId('');
              setReceiveWarehouseId('');
              setReceivePaidAmount('');
              setReceiveTreasuryId('');
              setReceiveNotes('');
              setReceiveItems([{ productId: '', name: '', qty: 1, costPrice: '', sellingPrice: '' }]);
              fetchSuppliers();
          } else {
              Swal.fire('فشل الإنشاء', result.message || 'تعذر إنشاء فاتورة الشراء.', 'error');
          }
      } catch (err) {
          console.error('Receiving error:', err);
          Swal.fire('خطأ في الاتصال', 'فشل الاتصال بالخادم.', 'error');
      }
  };

    const exportLedgerCsv = () => {
            if (!selectedSupplier) return;
            const rows = [
                    ['التاريخ', 'نوع الحركة', 'رقم المستند', 'مدين', 'دائن', 'الرصيد'],
                    [ledgerStartDate || '', 'رصيد افتتاحي', '-', '', '', openingBalance.toFixed(2)]
            ];

            ledgerEntries.forEach((entry: any) => {
                    rows.push([
                            entry.date || '',
                            entry.type === 'purchase' ? 'فاتورة شراء' : entry.type === 'return_out' ? 'مرتجع بضاعة' : 'سداد نقدي',
                            `#${entry.id}`,
                            entry.debit ? entry.debit.toFixed(2) : '',
                            entry.credit ? entry.credit.toFixed(2) : '',
                            entry.balance ? Number(entry.balance).toFixed(2) : ''
                    ]);
            });

            rows.push(['', 'الإجماليات', '', totalDebit.toFixed(2), totalCredit.toFixed(2), currentBalance.toFixed(2)]);

            const csv = rows.map(r => r.map((c: any) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
            const blob = new Blob(["\ufeff" + csv], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `supplier_ledger_${selectedSupplier.id}_${ledgerStartDate || ''}_${ledgerEndDate || ''}.csv`;
            a.click();
            URL.revokeObjectURL(url);
    };

    const printLedger = () => {
            if (!selectedSupplier) return;
            const htmlRows = [
                    `<tr><td>${ledgerStartDate || ''}</td><td>رصيد افتتاحي</td><td>-</td><td>-</td><td>-</td><td>${openingBalance.toLocaleString()}</td></tr>`,
                    ...ledgerEntries.map((entry: any) => `
                        <tr>
                            <td>${entry.date || ''}</td>
                            <td>${entry.type === 'purchase' ? 'فاتورة شراء' : entry.type === 'return_out' ? 'مرتجع بضاعة' : 'سداد نقدي'}</td>
                            <td>#${entry.id}</td>
                            <td style="text-align:right">${entry.debit ? Number(entry.debit).toLocaleString() : '-'}</td>
                            <td style="text-align:right">${entry.credit ? Number(entry.credit).toLocaleString() : '-'}</td>
                            <td style="text-align:right">${Number(entry.balance || 0).toLocaleString()}</td>
                        </tr>
                    `)
            ].join('');

            const html = `<!doctype html><html><head><meta charset="utf-8"><title>كشف حساب المورد</title>
            <style>
                body{font-family:Arial,Helvetica,sans-serif;direction:rtl;color:#111}
                table{width:100%;border-collapse:collapse;margin-top:12px}
                th,td{border:1px solid #ddd;padding:8px;font-size:12px}
                th{background:#f3f4f6}
            </style>
            </head><body>
            <h3>كشف حساب المورد: ${selectedSupplier.name}</h3>
            <div>الفترة: ${ledgerStartDate || ''} إلى ${ledgerEndDate || ''}</div>
            <table>
                <thead><tr><th>التاريخ</th><th>نوع الحركة</th><th>رقم المستند</th><th>مدين</th><th>دائن</th><th>الرصيد</th></tr></thead>
                <tbody>${htmlRows}</tbody>
                <tfoot><tr><td colspan="3">الإجماليات</td><td>${totalDebit.toLocaleString()}</td><td>${totalCredit.toLocaleString()}</td><td>${currentBalance.toLocaleString()}</td></tr></tfoot>
            </table>
            </body></html>`;

            const w = window.open('', '_blank');
            if (!w) { Swal.fire('منع النافذة', 'يرجى السماح بفتح النوافذ المنبثقة للمتابعة.', 'error'); return; }
            w.document.write(html);
            w.document.close();
            w.focus();
            setTimeout(() => { w.print(); }, 400);
    };

  // --- Invoice Actions ---
  const handleViewInvoice = (transaction: any) => {
            let itemsRaw: any[] = [];
            try {
                if (transaction.details) {
                    const parsed = JSON.parse(transaction.details);
                    itemsRaw = normalizeLedgerItems(parsed);
                }
            } catch (e) { itemsRaw = []; }
            const items = (itemsRaw || []).map((it:any) => {
                const qty = Number(it.qty ?? it.quantity ?? it.qtyOrdered ?? 0);
                const costPrice = Number(it.costPrice ?? it.cost ?? it.cost_price ?? it.unitPrice ?? it.purchasePrice ?? it.price ?? 0);
                const price = Number(it.sellingPrice ?? it.selling_price ?? it.price ?? it.sale_price ?? costPrice);
                const total = Number(qty * (costPrice || price || 0));
                return { ...it, qty, costPrice, price, total };
            });
            const invoiceDetails = {
                    id: transaction.id,
                    number: transaction.reference_id || `INV-${transaction.id}`,
                    date: transaction.transaction_date || transaction.date,
                    supplierName: selectedSupplier?.name,
                    items: items,
                    total: Number(transaction.amount || transaction.total || 0),
                    supplierPhone: selectedSupplier?.phone || '',
                    supplierAddress: selectedSupplier?.address || '',
                    type: transaction.type || '',
                    userName: transaction.created_by || (typeof window !== 'undefined' && (() => { try { const u = JSON.parse(localStorage.getItem('Dragon_user')||'null'); return u && (u.name || u.username) ? (u.name || u.username) : '-'; } catch(e){ return '-'; } })()) || '-'
            };
      setSelectedInvoice(invoiceDetails);
      setIsInvoiceModalOpen(true);
  };

  const handlePrintInvoice = (transaction: any) => {
            // Accept either a raw transaction (with .details) or a prepared invoice object (with .items)
            let items: any[] = [];
            try {
                if (transaction && Array.isArray(transaction.items)) {
                    items = transaction.items;
                } else if (transaction && transaction.details) {
                    const parsed = JSON.parse(transaction.details);
                    items = normalizeLedgerItems(parsed);
                }
            } catch (e) { items = []; }
            // Normalize items and compute totals
            const normItems = (items || []).map((it:any) => {
                const qty = Number(it.qty ?? it.quantity ?? it.qtyOrdered ?? 0);
                const costPrice = Number(it.costPrice ?? it.cost ?? it.cost_price ?? it.unitPrice ?? it.purchasePrice ?? it.price ?? 0);
                const price = Number(it.sellingPrice ?? it.selling_price ?? it.price ?? it.sale_price ?? costPrice);
                const total = Number(qty * (costPrice || price || 0));
                return { ...it, qty, costPrice, price, total };
            });
            const invoiceNumber = transaction.reference_id || `INV-${transaction.id}`;
            const date = transaction.transaction_date || transaction.date || new Date().toLocaleString();
            const supplierName = selectedSupplier?.name || '';
            const supplierPhone = selectedSupplier?.phone || '';
            const supplierAddress = selectedSupplier?.address || '';
            const total = Number(transaction.amount || transaction.total || (transaction.credit > 0 ? transaction.credit : transaction.debit) || 0);
                        const defaultLogo = toAbsoluteUrl(assetUrl('Dragon.png'));
                        const companyLogo = typeof window !== 'undefined'
                            ? toAbsoluteUrl(localStorage.getItem('Dragon_company_logo') || defaultLogo)
                            : defaultLogo;

            const invoiceTypeArabic = (t:any) => {
                if (!t) return '';
                if (t === 'purchase' || t === 'sale') return t === 'purchase' ? 'فاتورة شراء' : 'فاتورة مبيعات';
                if (t === 'return_out' || t === 'return_in') return t === 'return_out' ? 'سند مرتجع' : 'سند مرتجع عميل';
                return t;
            };

            const companyName = typeof window !== 'undefined' ? (localStorage.getItem('Dragon_company_name') || '') : '';
            const companyAddress = typeof window !== 'undefined' ? (localStorage.getItem('Dragon_company_address') || '') : '';
            const companyPhone = typeof window !== 'undefined' ? (localStorage.getItem('Dragon_company_phone') || '') : '';

            const html = `<!doctype html><html><head><meta charset="utf-8"><title>${invoiceNumber}</title>
                <style>@media print{@page{size:A4;margin:18mm}} body{font-family:Arial,Helvetica,sans-serif;color:#111;direction:rtl}
                .top-row{display:flex;justify-content:space-between;align-items:center}
                .company-name{font-size:22px;font-weight:800}
                .small{font-size:12px;color:#374151}
                table{width:100%;border-collapse:collapse;margin-top:12px}
                th,td{border:1px solid #ddd;padding:8px}
                </style>
                </head><body>
                <div class="top-row">
                    <div style="text-align:left">
                        <img src="${companyLogo}" alt="logo" style="max-width:120px;" onerror="this.src='${defaultLogo}'" />
                    </div>
                    <div style="text-align:right">
                        <div class="company-name">${companyName || ''}</div>
                        <div class="small">${companyAddress || ''}</div>
                        <div class="small">${companyPhone || ''}</div>
                    </div>
                </div>

                <div style="text-align:center;margin-top:12px;font-size:18px;font-weight:800">${invoiceTypeArabic(transaction.type)}</div>

                <div style="display:flex;justify-content:space-between;margin-top:12px">
                    <div style="text-align:left">
                        <div><strong>الموظف:</strong> ${transaction.created_by || (typeof window !== 'undefined' ? (() => { try { const u = JSON.parse(localStorage.getItem('Dragon_user')||'null'); return u && (u.name || u.username) ? (u.name || u.username) : '-'; } catch(e){ return '-'; } })() : '-')}</div>
                        <div><strong>التاريخ:</strong> ${date}</div>
                        <div><strong>رقم المستند:</strong> ${invoiceNumber}</div>
                    </div>
                    <div style="text-align:right">
                        <div><strong>المورد:</strong> ${supplierName}</div>
                        <div><strong>الهاتف:</strong> ${supplierPhone}</div>
                        <div><strong>العنوان:</strong> ${supplierAddress}</div>
                    </div>
                </div>

                <table>
                    <thead><tr style="background:#f3f4f6"><th style="width:40px">م</th><th>الصنف</th><th style="width:90px">اللون</th><th style="width:90px">المقاس</th><th style="width:80px">الكمية</th><th style="width:120px">سعر الوحدة</th><th style="width:120px">الإجمالي</th></tr></thead>
                    <tbody>${normItems.length === 0 ? '<tr><td colspan="7" style="text-align:center;color:#6b7280;padding:12px">لا توجد أصناف للعرض</td></tr>' : normItems.map((it:any,i:number)=>`<tr><td style="text-align:center">${i+1}</td><td>${it.name||''}</td><td style="text-align:center">${it.color||''}</td><td style="text-align:center">${it.size||''}</td><td style="text-align:center">${it.qty||''}</td><td style="text-align:right">${Number(it.costPrice||it.price||0).toLocaleString()}</td><td style="text-align:right">${Number(it.total||((it.qty||0)*(it.costPrice||it.price||0))).toLocaleString()}</td></tr>`).join('')}
                    </tbody>
                    <tfoot><tr><td colspan="6" style="text-align:left;font-weight:800">الإجمالي</td><td style="text-align:right;font-weight:800">${total.toLocaleString()}</td></tr></tfoot>
                </table>

                <div style="margin-top:30px;display:flex;justify-content:space-between;font-size:12px">
                    <div style="text-align:left">توقيع المستلم: ____________________</div>
                    <div style="text-align:right">توقيع المورد: ____________________</div>
                </div>

                </body></html>`;

            const w = window.open('', '_blank');
            if (!w) { Swal.fire('منع النافذة', 'يرجى السماح بفتح النوافذ المنبثقة للمتابعة.', 'error'); return; }
            w.document.write(html);
            w.document.close();
            w.focus();
            setTimeout(() => { w.print(); }, 500);
  };

  useEffect(() => {
      if (invoiceToPrint) {
          const timer = setTimeout(() => {
              window.print();
              setInvoiceToPrint(null);
          }, 500);
          return () => clearTimeout(timer);
      }
  }, [invoiceToPrint]);

  // Calculate Totals for Ledger
  const totalDebit = ledgerEntries.reduce((acc, curr) => acc + (curr.debit || 0), 0); 
  const totalCredit = ledgerEntries.reduce((acc, curr) => acc + (curr.credit || 0), 0); 
    const currentBalance = openingBalance + totalCredit - totalDebit;

  return (
    <div className="space-y-6 dir-rtl">
      
      {/* Hidden Print Component */}
      {invoiceToPrint && (
          <div id="print-invoice-container">
              <PrintableInvoice invoice={invoiceToPrint} />
          </div>
      )}

      {/* Header */}
    <div className="flex flex-col md:flex-row justify-between items-center gap-4 p-6 rounded-3xl border border-card shadow-sm card" style={{ backgroundColor: 'var(--card-bg)', color: 'var(--text)' }}>
        <div>
          <h2 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
            <Truck className="text-blue-600"/> إدارة الموردين
          </h2>
          <p className="text-sm text-muted font-medium">متابعة حسابات الموردين وكشوف الحساب</p>
        </div>
        <div className="flex gap-2 w-full md:w-auto">
            <div className="relative flex-1 md:w-64">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-muted w-4 h-4" />
                <input 
                    type="text" 
                    placeholder="بحث عن مورد..." 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pr-10 pl-4 py-2.5 bg-slate-50 dark:bg-slate-900 border-none rounded-xl text-sm"
                />
            </div>
            <button onClick={() => setIsReceiveModalOpen(true)} className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2.5 rounded-xl text-sm font-black hover:bg-emerald-700 transition-all">
                <Plus size={18}/> فاتورة شراء
            </button>
            <button onClick={() => handleOpenModal()} className="flex items-center gap-2 bg-accent text-white px-4 py-2.5 rounded-xl text-sm font-black hover:bg-blue-700 transition-all">
                <Plus size={18}/> إضافة مورد
            </button>
        </div>
      </div>

      {/* Suppliers List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {suppliers.length === 0 ? (
            <div className="col-span-full text-center py-20 rounded-3xl border border-dashed card" style={{ backgroundColor: 'var(--card-bg)', color: 'var(--text)', borderColor: 'var(--border)' }}>
                <Truck className="w-16 h-16 mx-auto text-slate-200 mb-4"/>
                <p className="text-muted font-bold">لا يوجد موردين مسجلين. ابدأ بإضافة مورد جديد.</p>
            </div>
        ) : (
            suppliers.filter(s => s.name.includes(searchTerm)).map(supplier => (
                <div key={supplier.id} className="p-5 rounded-3xl border border-card shadow-sm hover:shadow-md transition-all group relative card" style={{ backgroundColor: 'var(--card-bg)', color: 'var(--text)' }}>
                    <div className="flex justify-between items-start mb-4">
                        <div className="w-12 h-12 bg-slate-100 dark:bg-slate-700 rounded-full flex items-center justify-center text-muted font-black text-lg">
                            {supplier.name.charAt(0)}
                        </div>
                        <div className="flex gap-1">
                            <button onClick={() => handleOpenLedger(supplier)} className="p-2 text-muted hover:text-blue-600 hover:bg-blue-50 rounded-xl" title="كشف حساب"><Eye size={18}/></button>
                            <button onClick={() => handleOpenModal(supplier)} className="p-2 text-muted hover:text-amber-600 hover:bg-amber-50 rounded-xl" title="تعديل"><Edit size={18}/></button>
                        </div>
                    </div>
                    
                    <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-1">{supplier.name}</h3>
                    
                    <div className="space-y-2 text-sm text-muted mb-4">
                        <div className="flex items-center gap-2"><Phone size={14}/> {supplier.phone}</div>
                        <div className="flex items-center gap-2"><MapPin size={14}/> {supplier.address}</div>
                    </div>

                    <div className="pt-4 border-t dark:border-slate-700 flex justify-between items-center">
                        <span className="text-xs font-bold text-muted">الرصيد الحالي</span>
                        <span className={`text-lg font-black ${supplier.balance > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                            {supplier.balance?.toLocaleString() || 0} {currencySymbol}
                        </span>
                    </div>
                </div>
            ))
        )}
      </div>

      {/* Ledger Modal */}
      {isLedgerModalOpen && selectedSupplier && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in zoom-in">
            <div className="w-full max-w-5xl rounded-[2.5rem] shadow-2xl overflow-hidden border border-card flex flex-col h-[85vh] card" style={{ backgroundColor: 'var(--card-bg)', color: 'var(--text)' }}>
                
                <div className="p-6 border-b dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 flex flex-col md:flex-row gap-4 md:items-center md:justify-between">
                    <div>
                        <h3 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2"><FileText className="text-blue-500"/> كشف حساب مورد</h3>
                        <p className="text-sm text-muted">{selectedSupplier.name}</p>
                    </div>
                    <div className="flex flex-wrap gap-2 items-center">
                        <div className="flex gap-2 items-center">
                            <input type="date" value={ledgerStartDate} onChange={e => setLedgerStartDate(e.target.value)} className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm" />
                            <input type="date" value={ledgerEndDate} onChange={e => setLedgerEndDate(e.target.value)} className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm" />
                            <button onClick={handleRefreshLedger} className="bg-blue-600 text-white px-3 py-2 rounded-lg text-sm font-bold">تحديث</button>
                        </div>
                        <button onClick={exportLedgerCsv} className="bg-slate-700 text-white px-3 py-2 rounded-lg text-sm font-bold">تصدير CSV</button>
                        <button onClick={printLedger} className="bg-slate-800 text-white px-3 py-2 rounded-lg text-sm font-bold">طباعة / PDF</button>
                        <button onClick={() => setIsPaymentModalOpen(true)} className="bg-emerald-600 text-white px-3 py-2 rounded-lg text-sm font-bold flex items-center gap-1"><Wallet size={16}/> سداد</button>
                        <button onClick={() => setIsLedgerModalOpen(false)} className="bg-white p-2 rounded-full shadow-sm hover:bg-rose-50 hover:text-rose-500 transition-all"><X size={20}/></button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-6">
                    <table className="w-full text-right text-sm border-collapse">
                        <thead className="bg-slate-100 dark:bg-slate-900/50 text-slate-600 dark:text-slate-400 sticky top-0 z-10">
                            <tr>
                                <th className="p-3 border-b dark:border-slate-700">التاريخ</th>
                                <th className="p-3 border-b dark:border-slate-700">نوع الحركة</th>
                                    <th className="p-3 border-b dark:border-slate-700">رقم المستند</th>
                                <th className="p-3 border-b dark:border-slate-700 text-center bg-rose-50/50 text-rose-700">مدين (لنا)</th>
                                <th className="p-3 border-b dark:border-slate-700 text-center bg-emerald-50/50 text-emerald-700">دائن (له)</th>
                                <th className="p-3 border-b dark:border-slate-700 text-center">الرصيد</th>
                                <th className="p-3 border-b dark:border-slate-700 text-center">إجراءات</th>
                            </tr>
                        </thead>
                        <tbody className="text-slate-700 dark:text-slate-300 divide-y dark:divide-slate-700">
                            <tr className="bg-slate-50 dark:bg-slate-900/30">
                                <td className="p-3 font-mono text-xs">{ledgerStartDate}</td>
                                <td className="p-3">رصيد افتتاحي</td>
                                <td className="p-3 font-mono text-sm">-</td>
                                <td className="p-3 text-center font-bold text-rose-600">-</td>
                                <td className="p-3 text-center font-bold text-emerald-600">-</td>
                                <td className="p-3 text-center font-bold">{openingBalance.toLocaleString()}</td>
                                <td className="p-3"></td>
                            </tr>
                            {ledgerEntries.length === 0 ? (
                                <tr><td colSpan={7} className="text-center py-10 text-muted">لا توجد معاملات مسجلة لهذا المورد.</td></tr>
                            ) : ledgerEntries.map((entry, idx) => (
                                <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-700/30">
                                    <td className="p-3 font-mono text-xs">{entry.date}</td>
                                    <td className="p-3">
                                        <span className={`px-2 py-1 rounded text-[10px] font-bold ${
                                            entry.type === 'purchase' ? 'bg-blue-100 text-blue-700' : 
                                            entry.type === 'return_out' ? 'bg-amber-100 text-amber-700' :
                                            'bg-slate-100 text-slate-700'
                                        }`}>
                                            {entry.type === 'purchase' ? 'فاتورة شراء' : entry.type === 'return_out' ? 'مرتجع بضاعة' : 'سداد نقدي'}
                                        </span>
                                    </td>
                                    <td className="p-3 font-mono text-sm">#{entry.id}</td>
                                    <td className="p-3 text-center font-bold text-rose-600">{entry.debit > 0 ? entry.debit.toLocaleString() : '-'}</td>
                                    <td className="p-3 text-center font-bold text-emerald-600">{entry.credit > 0 ? entry.credit.toLocaleString() : '-'}</td>
                                    <td className="p-3 text-center font-bold">{Number(entry.balance || 0).toLocaleString()}</td>
                                    <td className="p-3 text-center">
                                        {(entry.type === 'purchase' || entry.type === 'return_out') && (
                                            <div className="flex justify-center gap-2">
                                                <button onClick={() => handleViewInvoice(entry)} className="p-1.5 bg-slate-100 text-slate-600 rounded-lg hover:bg-blue-100 hover:text-blue-600" title="عرض التفاصيل"><Eye size={14}/></button>
                                                <button onClick={() => handlePrintInvoice(entry)} className="p-1.5 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200" title="طباعة"><Printer size={14}/></button>
                                            </div>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot className="bg-slate-50 dark:bg-slate-900 border-t-2 border-slate-200 dark:border-slate-600 sticky bottom-0 z-10">
                            <tr>
                                <td colSpan={3} className="p-4 font-black text-left">الإجماليات</td>
                                <td className="p-4 text-center font-black text-rose-600">{totalDebit.toLocaleString()}</td>
                                <td className="p-4 text-center font-black text-emerald-600">{totalCredit.toLocaleString()}</td>
                                <td className="p-4 text-center font-black">{currentBalance.toLocaleString()}</td>
                                <td></td>
                            </tr>
                        </tfoot>
                    </table>
                </div>

                    <div className="p-6 bg-slate-800 text-white flex justify-between items-center">
                    <div>
                        <p className="text-xs text-muted">الرصيد المستحق</p>
                        <p className={`text-2xl font-black ${currentBalance > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                            {currentBalance.toLocaleString()} {currencySymbol} {currentBalance > 0 ? '(له)' : '(لنا)'}
                        </p>
                    </div>
                    <button onClick={printLedger} className="flex items-center gap-2 bg-white text-slate-900 px-6 py-3 rounded-xl font-bold hover:bg-slate-200 transition-all">
                        <Printer size={18}/> طباعة الكشف
                    </button>
                </div>
            </div>
        </div>
      )}

      {/* Invoice Details Modal */}
      {isInvoiceModalOpen && selectedInvoice && (
          <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
              <div className="bg-white w-full max-w-2xl rounded-3xl overflow-hidden shadow-2xl">
                  <div className="p-6 border-b flex justify-between items-center bg-slate-50">
                      <div>
                          <h3 className="text-lg font-black text-slate-800">تفاصيل الفاتورة</h3>
                          <p className="text-sm text-slate-500">رقم: {selectedInvoice.number}</p>
                      </div>
                      <button onClick={() => setIsInvoiceModalOpen(false)} className="text-slate-400 hover:text-rose-500"><X size={24}/></button>
                  </div>
                  <div className="p-6">
                      <div className="flex justify-between mb-4 text-sm">
                          <p><strong>المورد:</strong> {selectedInvoice.supplierName}</p>
                          <p><strong>التاريخ:</strong> {selectedInvoice.date}</p>
                      </div>
                      <table className="w-full text-right text-sm border">
                          <thead className="bg-slate-100">
                              <tr>
                                  <th className="p-2 border">الصنف</th>
                                  <th className="p-2 border">الكمية</th>
                                  <th className="p-2 border">السعر</th>
                                  <th className="p-2 border">الإجمالي</th>
                              </tr>
                          </thead>
                          <tbody>
                              {selectedInvoice.items.length === 0 ? (
                                  <tr><td colSpan={4} className="p-4 text-center text-slate-400">جاري تحميل التفاصيل...</td></tr>
                              ) : selectedInvoice.items.map((item:any, i:number) => (
                                  <tr key={i}>
                                      <td className="p-2 border">{item.name}</td>
                                      <td className="p-2 border">{item.qty}</td>
                                      <td className="p-2 border">{item.price}</td>
                                      <td className="p-2 border">{item.total}</td>
                                  </tr>
                              ))}
                          </tbody>
                      </table>
                      <div className="mt-4 text-left">
                          <p className="text-lg font-black">الإجمالي: {selectedInvoice.total.toLocaleString()} {currencySymbol}</p>
                      </div>
                  </div>
                  <div className="p-4 bg-slate-50 flex justify-end">
                      <button onClick={() => { setIsInvoiceModalOpen(false); handlePrintInvoice(selectedInvoice); }} className="bg-slate-900 text-white px-6 py-2 rounded-xl flex items-center gap-2">
                          <Printer size={16}/> طباعة
                      </button>
                  </div>
              </div>
          </div>
      )}

      {/* Add/Edit Supplier Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden border border-card card" style={{ backgroundColor: 'var(--card-bg)', color: 'var(--text)' }}>
            <div className="p-6 border-b dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50">
              <h3 className="text-lg font-black text-slate-900 dark:text-white">{editingSupplier ? 'تعديل بيانات مورد' : 'إضافة مورد جديد'}</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-rose-500 transition-colors"><X size={24} /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-8 space-y-4 text-right">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 mr-2">اسم المورد / الشركة</label>
                <input 
                  type="text" 
                  required
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                  className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl py-3 px-4 text-sm focus:ring-2 ring-blue-500/20 text-slate-900 dark:text-white"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 mr-2">رقم التواصل</label>
                <input 
                  type="text" 
                  value={formData.phone}
                  onChange={e => setFormData({...formData, phone: e.target.value})}
                  className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl py-3 px-4 text-sm focus:ring-2 ring-blue-500/20 text-slate-900 dark:text-white"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 mr-2">العنوان / المقر</label>
                <input 
                  type="text" 
                  value={formData.address}
                  onChange={e => setFormData({...formData, address: e.target.value})}
                  className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl py-3 px-4 text-sm focus:ring-2 ring-blue-500/20 text-slate-900 dark:text-white"
                />
              </div>
              <button 
                type="submit"
                className="w-full bg-blue-600 text-white py-4 rounded-2xl font-black shadow-xl shadow-blue-500/30 hover:bg-blue-700 transition-all flex items-center justify-center gap-2"
              >
                <Save size={18} /> {editingSupplier ? 'حفظ التعديلات' : 'إضافة المورد'}
              </button>
            </form>
          </div>
        </div>
      )}

            {/* Payment Modal */}
            {isPaymentModalOpen && selectedSupplier && (
                <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
                    <div className="w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden border border-card card" style={{ backgroundColor: 'var(--card-bg)', color: 'var(--text)' }}>
                        <div className="p-6 border-b dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50">
                            <h3 className="text-lg font-black text-slate-900 dark:text-white">سداد للمورد</h3>
                            <button onClick={() => setIsPaymentModalOpen(false)} className="text-slate-400 hover:text-rose-500 transition-colors"><X size={24} /></button>
                        </div>
                        <div className="p-8 space-y-4 text-right">
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-slate-500 mr-2">المبلغ</label>
                                <input type="number" min="0" value={paymentAmount} onChange={e => setPaymentAmount(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl py-3 px-4 text-sm focus:ring-2 ring-blue-500/20 text-slate-900 dark:text-white" />
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-slate-500 mr-2">الخزينة</label>
                                <select value={paymentTreasuryId} onChange={e => setPaymentTreasuryId(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl py-3 px-4 text-sm">
                                    <option value="">اختر الخزينة</option>
                                    {treasuries.map(t => (<option key={t.id} value={t.id}>{t.name}</option>))}
                                </select>
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-slate-500 mr-2">ملاحظات</label>
                                <input type="text" value={paymentNotes} onChange={e => setPaymentNotes(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl py-3 px-4 text-sm" />
                            </div>
                            <button onClick={handleRecordPayment} className="w-full bg-emerald-600 text-white py-4 rounded-2xl font-black shadow-xl shadow-emerald-500/30 hover:bg-emerald-700 transition-all">تسجيل السداد</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Purchase Invoice Modal */}
            {isReceiveModalOpen && (
                <div className="fixed inset-0 z-[85] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
                    <div className="w-full max-w-5xl rounded-[2.5rem] shadow-2xl overflow-hidden border border-card card" style={{ backgroundColor: 'var(--card-bg)', color: 'var(--text)' }}>
                        <div className="p-6 border-b dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50">
                            <h3 className="text-lg font-black text-slate-900 dark:text-white">فاتورة شراء</h3>
                            <button onClick={() => setIsReceiveModalOpen(false)} className="text-slate-400 hover:text-rose-500 transition-colors"><X size={24} /></button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-slate-500 mr-2">المورد</label>
                                    <select value={receiveSupplierId} onChange={e => setReceiveSupplierId(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl py-3 px-4 text-sm">
                                        <option value="">اختر المورد</option>
                                        {suppliers.map(s => (<option key={s.id} value={s.id}>{s.name}</option>))}
                                    </select>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-slate-500 mr-2">المخزن</label>
                                    <select value={receiveWarehouseId} onChange={e => setReceiveWarehouseId(e.target.value)} disabled={userDefaults && userDefaults.default_warehouse_id && !userDefaults.can_change_warehouse} className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl py-3 px-4 text-sm">
                                        <option value="">اختر المخزن</option>
                                        {(userDefaults && userDefaults.default_warehouse_id && !userDefaults.can_change_warehouse ? warehouses.filter(w => Number(w.id) === Number(userDefaults.default_warehouse_id)) : warehouses).map(w => (
                                            <option key={w.id} value={w.id}>{w.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-slate-500 mr-2">مدفوع</label>
                                    <input type="number" min="0" value={receivePaidAmount} onChange={e => setReceivePaidAmount(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl py-3 px-4 text-sm" />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-slate-500 mr-2">الخزينة</label>
                                    <select value={receiveTreasuryId} onChange={e => setReceiveTreasuryId(e.target.value)} disabled={userDefaults && userDefaults.default_treasury_id && !userDefaults.can_change_treasury} className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl py-3 px-4 text-sm">
                                        <option value="">اختر الخزينة</option>
                                        {(userDefaults && userDefaults.default_treasury_id && !userDefaults.can_change_treasury ? treasuries.filter(t => Number(t.id) === Number(userDefaults.default_treasury_id)) : treasuries).map(t => (
                                            <option key={t.id} value={t.id}>{t.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="space-y-1 md:col-span-2">
                                    <label className="text-xs font-bold text-slate-500 mr-2">ملاحظات</label>
                                    <input type="text" value={receiveNotes} onChange={e => setReceiveNotes(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl py-3 px-4 text-sm" />
                                </div>
                            </div>

                            <div className="border rounded-2xl overflow-hidden">
                                <table className="w-full text-right text-sm">
                                    <thead className="bg-slate-100">
                                        <tr>
                                            <th className="p-3">الصنف</th>
                                            <th className="p-3">الاسم</th>
                                            <th className="p-3">الكمية</th>
                                            <th className="p-3">سعر التكلفة</th>
                                            <th className="p-3">سعر البيع</th>
                                            <th className="p-3"></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {receiveItems.map((item, idx) => (
                                            <tr key={idx} className="border-t">
                                                <td className="p-3">
                                                    <select value={item.productId} onChange={e => {
                                                            const pid = e.target.value;
                                                            const product = products.find((p: any) => String(p.id) === String(pid));
                                                            updateReceiveItem(idx, { productId: pid, name: product?.name || '' });
                                                    }} className="w-full bg-white border border-slate-200 rounded-lg px-2 py-2 text-xs">
                                                        <option value="">اختر</option>
                                                        {products.map(p => (<option key={p.id} value={p.id}>{p.name}</option>))}
                                                    </select>
                                                </td>
                                                <td className="p-3">
                                                    <input type="text" value={item.name} onChange={e => updateReceiveItem(idx, { name: e.target.value })} className="w-full bg-white border border-slate-200 rounded-lg px-2 py-2 text-xs" placeholder="اسم الصنف" />
                                                </td>
                                                <td className="p-3">
                                                    <input type="number" min="1" value={item.qty} onChange={e => updateReceiveItem(idx, { qty: e.target.value })} className="w-full bg-white border border-slate-200 rounded-lg px-2 py-2 text-xs" />
                                                </td>
                                                <td className="p-3">
                                                    <input type="number" min="0" value={item.costPrice} onChange={e => updateReceiveItem(idx, { costPrice: e.target.value })} className="w-full bg-white border border-slate-200 rounded-lg px-2 py-2 text-xs" />
                                                </td>
                                                <td className="p-3">
                                                    <input type="number" min="0" value={item.sellingPrice} onChange={e => updateReceiveItem(idx, { sellingPrice: e.target.value })} className="w-full bg-white border border-slate-200 rounded-lg px-2 py-2 text-xs" />
                                                </td>
                                                <td className="p-3 text-center">
                                                    {receiveItems.length > 1 && (
                                                        <button onClick={() => removeReceiveItem(idx)} className="text-rose-500 hover:text-rose-700 text-xs">حذف</button>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            <div className="flex justify-between items-center">
                                <button onClick={addReceiveItem} className="text-blue-600 font-bold">+ إضافة صنف</button>
                                <button onClick={handleCreateReceiving} className="bg-blue-600 text-white px-6 py-3 rounded-xl font-bold">حفظ الفاتورة</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

    </div>
  );
};

// --- Printable Invoice Component (Hidden until print) ---
const PrintableInvoice: React.FC<{ invoice: any }> = ({ invoice }) => {
    const companyLogoFromStorage = typeof window !== 'undefined' ? localStorage.getItem('Dragon_company_logo') : null;
    const defaultLogo = toAbsoluteUrl(assetUrl('Dragon.png'));
    const company = {
        name: (typeof window !== 'undefined' ? localStorage.getItem('Dragon_company_name') : null) || 'اسم الشركة التجارية',
        phone: (typeof window !== 'undefined' ? localStorage.getItem('Dragon_company_phone') : null) || '+20 100 000 0000',
        address: (typeof window !== 'undefined' ? localStorage.getItem('Dragon_company_address') : null) || 'العنوان: القاهرة - مصر',
        logo_url: companyLogoFromStorage && companyLogoFromStorage.length ? toAbsoluteUrl(companyLogoFromStorage) : defaultLogo
    };

    const invoiceTypeArabic = (t:any) => {
      if (!t) return '';
      if (t === 'purchase' || t === 'sale') return t === 'purchase' ? 'فاتورة شراء' : 'فاتورة مبيعات';
      if (t === 'return_out' || t === 'return_in') return t === 'return_out' ? 'سند مرتجع' : 'سند مرتجع عميل';
      return t;
    };

    return (
        <div className="hidden">
            <style>
                {`
                @media print {
                    body { visibility: hidden; }
                    #print-invoice-container { visibility: visible !important; position: absolute; top: 0; left: 0; width: 100%; }
                    @page { size: A4; margin: 18mm; }
                }
                `}
            </style>

            <div id="print-invoice-container" className="p-6 bg-white text-black dir-rtl">
                <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                    <div style={{textAlign:'left'}}>
                        <img src={company.logo_url} alt="logo" onError={(e:any)=>{e.target.src=defaultLogo}} style={{maxWidth:120}} />
                    </div>
                    <div style={{textAlign:'right'}}>
                        <div style={{fontSize:22, fontWeight:800}}>{company.name}</div>
                        <div style={{fontSize:12, color:'#374151'}}>{company.address}</div>
                        <div style={{fontSize:12, color:'#374151'}}>{company.phone}</div>
                    </div>
                </div>

                <div style={{textAlign:'center', marginTop:12, fontSize:18, fontWeight:800}}>{invoiceTypeArabic(invoice.type)}</div>

                <div style={{display:'flex', justifyContent:'space-between', marginTop:12}}>
                    <div style={{textAlign:'left'}}>
                        <div><strong>الموظف:</strong> {invoice.userName || '-'}</div>
                        <div><strong>التاريخ:</strong> {invoice.date}</div>
                        <div><strong>رقم المستند:</strong> {invoice.number}</div>
                    </div>
                    <div style={{textAlign:'right'}}>
                        <div><strong>المورد:</strong> {invoice.supplierName}</div>
                        <div><strong>الهاتف:</strong> {invoice.supplierPhone}</div>
                        <div><strong>العنوان:</strong> {invoice.supplierAddress}</div>
                    </div>
                </div>

                <table style={{width:'100%', borderCollapse:'collapse', marginTop:12}}>
                    <thead>
                        <tr style={{background:'#f3f4f6'}}>
                            <th style={{border:'1px solid #ddd', padding:8, width:40}}>م</th>
                            <th style={{border:'1px solid #ddd', padding:8}}>الصنف</th>
                            <th style={{border:'1px solid #ddd', padding:8, width:90}}>اللون</th>
                            <th style={{border:'1px solid #ddd', padding:8, width:90}}>المقاس</th>
                            <th style={{border:'1px solid #ddd', padding:8, width:80}}>الكمية</th>
                            <th style={{border:'1px solid #ddd', padding:8, width:120}}>سعر الوحدة</th>
                            <th style={{border:'1px solid #ddd', padding:8, width:120}}>الإجمالي</th>
                        </tr>
                    </thead>
                    <tbody>
                        {(!invoice.items || invoice.items.length === 0) ? (
                            <tr><td colSpan={7} style={{padding:12,textAlign:'center',color:'#6b7280'}}>لا توجد أصناف للعرض</td></tr>
                        ) : invoice.items.map((item:any, i:number) => (
                            <tr key={i}>
                                <td style={{border:'1px solid #ddd', padding:8, textAlign:'center'}}>{i+1}</td>
                                <td style={{border:'1px solid #ddd', padding:8}}>{item.name}</td>
                                <td style={{border:'1px solid #ddd', padding:8, textAlign:'center'}}>{item.color || '-'}</td>
                                <td style={{border:'1px solid #ddd', padding:8, textAlign:'center'}}>{item.size || '-'}</td>
                                <td style={{border:'1px solid #ddd', padding:8, textAlign:'center'}}>{item.qty}</td>
                                <td style={{border:'1px solid #ddd', padding:8, textAlign:'right'}}>{Number(item.costPrice || item.price || 0).toLocaleString()}</td>
                                <td style={{border:'1px solid #ddd', padding:8, textAlign:'right'}}>{Number((item.qty || 0) * (item.costPrice || item.price || 0)).toLocaleString()}</td>
                            </tr>
                        ))}
                    </tbody>
                    <tfoot>
                        <tr>
                            <td colSpan={6} style={{border:'1px solid #ddd', padding:8, fontWeight:800, textAlign:'left'}}>الإجمالي</td>
                            <td style={{border:'1px solid #ddd', padding:8, textAlign:'right', fontWeight:800}}>{Number(invoice.total || 0).toLocaleString()}</td>
                        </tr>
                    </tfoot>
                </table>

                <div style={{marginTop:30, display:'flex', justifyContent:'space-between', fontSize:12}}>
                    <div>توقيع المستلم: ____________________</div>
                    <div>توقيع المورد: ____________________</div>
                </div>
            </div>
        </div>
    );
};

export default SRMModule;
