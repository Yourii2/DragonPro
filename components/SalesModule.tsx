import React, { useState, useEffect } from 'react';
import { API_BASE_PATH } from '../services/apiConfig';
import { ShoppingCart, Printer, History, Search, PlusCircle, MinusCircle, UploadCloud, FileText, RefreshCcw, ClipboardPaste, MapPin, Phone, User, CheckSquare, Square, Eye, Edit } from 'lucide-react';
import Swal from 'sweetalert2';

interface OrdersModuleProps {
  initialView?: string;
}

type RateType = 'percent' | 'amount';

type SalesDisplayMethod = 'company' | 'sales_offices';

const normalizeSalesDisplayMethod = (value?: string | null): SalesDisplayMethod => {
  const v = (value || '').toLowerCase().trim();
  return v === 'sales_offices' ? 'sales_offices' : 'company';
};

const pickDisplayPhone = (phones: any, fallback: string): string => {
  const text = (phones || '').toString();
  const match = text.match(/\d{11}/);
  if (match && match[0]) return match[0];
  const first = text
    .split(/\r?\n|,/)
    .map(s => s.trim())
    .filter(Boolean)[0];
  return first || fallback;
};

const normalizeRateType = (value?: string | null): RateType | null => {
  const v = (value || '').toLowerCase().trim();
  if (v === 'percent' || v === 'percentage') return 'percent';
  if (v === 'amount' || v === 'fixed' || v === 'value') return 'amount';
  return null;
};

const calculateOrderTotals = (
  subtotal: number,
  shipping: number,
  discountType: RateType | null,
  discountValue: number,
  taxType: RateType | null,
  taxValue: number,
  calcOrder: 'discount_then_tax' | 'tax_then_discount'
) => {
  const safeSubtotal = Math.max(0, Number(subtotal || 0));
  const safeShipping = Math.max(0, Number(shipping || 0));
  const safeDiscountValue = Math.max(0, Number(discountValue || 0));
  const safeTaxValue = Math.max(0, Number(taxValue || 0));

  let discountAmount = 0;
  let taxAmount = 0;

  if (calcOrder === 'tax_then_discount') {
    if (taxType === 'percent') taxAmount = safeSubtotal * (safeTaxValue / 100);
    else if (taxType === 'amount') taxAmount = safeTaxValue;
    const baseForDiscount = Math.max(0, safeSubtotal + taxAmount);
    if (discountType === 'percent') discountAmount = baseForDiscount * (safeDiscountValue / 100);
    else if (discountType === 'amount') discountAmount = safeDiscountValue;
    if (discountAmount > baseForDiscount) discountAmount = baseForDiscount;
  } else {
    if (discountType === 'percent') discountAmount = safeSubtotal * (safeDiscountValue / 100);
    else if (discountType === 'amount') discountAmount = safeDiscountValue;
    if (discountAmount > safeSubtotal) discountAmount = safeSubtotal;
    const baseForTax = Math.max(0, safeSubtotal - discountAmount);
    if (taxType === 'percent') taxAmount = baseForTax * (safeTaxValue / 100);
    else if (taxType === 'amount') taxAmount = safeTaxValue;
  }

  const total = Math.max(0, safeSubtotal - discountAmount + taxAmount + safeShipping);
  return { subtotal: safeSubtotal, discountAmount, taxAmount, total };
};

const OrdersModule: React.FC<OrdersModuleProps> = ({ initialView }) => {
  const [view, setView] = useState<string>(initialView || 'new-order');
  const [orderItems, setOrderItems] = useState([{ id: 1, productId: '', color: '', size: '', qty: 1, price: 0 }]);
  const [isExistingCustomer, setIsExistingCustomer] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const currencySymbol = 'ج.م';
  const defaultTaxRate = Number(localStorage.getItem('Dragon_tax_rate') || '0');
  const salesCalcOrder = (localStorage.getItem('Dragon_sales_calc_order') || 'discount_then_tax') as 'discount_then_tax' | 'tax_then_discount';

  // State for script import
  const [scriptText, setScriptText] = useState('');
  const [parsedOrders, setParsedOrders] = useState<any[]>([]);
  const [isParsing, setIsParsing] = useState(false);
  const [selectedOrders, setSelectedOrders] = useState<number[]>([]);
  const [ordersToPrint, setOrdersToPrint] = useState<any[] | null>(null);
  const [existingProducts, setExistingProducts] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | ''>('');
  const [newCustomer, setNewCustomer] = useState({ name: '', phone1: '', phone2: '', governorate: '', address: '' });
  const [notes, setNotes] = useState('');
  const [employee, setEmployee] = useState('');
  const [page, setPage] = useState('');
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [createSales, setCreateSales] = useState<boolean>(false);
  const [defaultWarehouseId, setDefaultWarehouseId] = useState<number | ''>('');

  // Sales tax/discount (manual order)
  const [discountType, setDiscountType] = useState<RateType>('amount');
  const [discountValue, setDiscountValue] = useState<number>(0);
  const [taxType, setTaxType] = useState<RateType>('percent');
  const [taxValue, setTaxValue] = useState<number>(isNaN(defaultTaxRate) ? 0 : defaultTaxRate);

  // Sales tax/discount (import defaults)
  const [importDiscountType, setImportDiscountType] = useState<RateType>('amount');
  const [importDiscountValue, setImportDiscountValue] = useState<number>(0);
  const [importTaxType, setImportTaxType] = useState<RateType>('percent');
  const [importTaxValue, setImportTaxValue] = useState<number>(isNaN(defaultTaxRate) ? 0 : defaultTaxRate);
  
  // Company Settings
  const companyName = localStorage.getItem('Dragon_company_name') || 'اسم الشركة';
  const companyPhone = localStorage.getItem('Dragon_company_phone') || '01000000000';
  const companyTerms = localStorage.getItem('Dragon_company_terms') || 'المعاينة حق للعميل قبل الاستلام.';

  // Sales Display Settings (Company vs Sales Offices)
  const salesDisplayMethod = normalizeSalesDisplayMethod(localStorage.getItem('Dragon_sales_display_method'));
  const [salesOffices, setSalesOffices] = useState<any[]>([]);
  const [selectedSalesOfficeId, setSelectedSalesOfficeId] = useState<number | ''>('');
  const [userDefaults, setUserDefaults] = useState<any>(null);

  const selectedSalesOffice = (salesDisplayMethod === 'sales_offices' && selectedSalesOfficeId)
    ? (salesOffices.find(o => Number(o.id) === Number(selectedSalesOfficeId)) || null)
    : null;

  const defaultSalesOfficeIdRaw = userDefaults && (userDefaults.default_sales_office_id !== undefined) ? userDefaults.default_sales_office_id : null;
  const defaultSalesOfficeId = (defaultSalesOfficeIdRaw === null || typeof defaultSalesOfficeIdRaw === 'undefined') ? null : Number(defaultSalesOfficeIdRaw);
  const canChangeSalesOffice = userDefaults && typeof userDefaults.can_change_sales_office !== 'undefined' ? Boolean(userDefaults.can_change_sales_office) : true;
  const isSalesOfficeScopeNone = (defaultSalesOfficeId === -1) && !canChangeSalesOffice;

  const effectiveHeaderName = (!isSalesOfficeScopeNone && selectedSalesOffice?.name) ? selectedSalesOffice.name : companyName;
  const effectiveHeaderPhone = (!isSalesOfficeScopeNone && selectedSalesOffice)
    ? pickDisplayPhone(selectedSalesOffice.phones, companyPhone)
    : companyPhone;

  // Mock Data for testing (Or empty array)
  const [orders, setOrders] = useState<any[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Order details + lifecycle
  const [isOrderDetailsOpen, setIsOrderDetailsOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [orderTimeline, setOrderTimeline] = useState<any[]>([]);
  const [orderDocuments, setOrderDocuments] = useState<any[]>([]);
  const [docType, setDocType] = useState('delivery_note');
  const [docUrl, setDocUrl] = useState('');
  const [docNotes, setDocNotes] = useState('');
  const [statusUpdate, setStatusUpdate] = useState('');
  const [statusNote, setStatusNote] = useState('');
  const [isStatusEditOpen, setIsStatusEditOpen] = useState(false);
  const [statusEditOrder, setStatusEditOrder] = useState<any>(null);
  const [statusEditValue, setStatusEditValue] = useState('');
  const [statusEditNote, setStatusEditNote] = useState('');
  const [returnFineMode, setReturnFineMode] = useState<'none' | 'fine'>('none');
  const [returnFineAmount, setReturnFineAmount] = useState('');

  const filteredOrders = orders.filter(o => {
    const matchesStatus = statusFilter === 'all' || (o.status || '') === statusFilter;
    const phoneA = o.phone || o.phone1 || '';
    const phoneB = o.phone2 || '';
    const term = searchTerm.toLowerCase();
    const matchesSearch =
      (o.customerName || '').includes(searchTerm) ||
      phoneA.includes(searchTerm) ||
      phoneB.includes(searchTerm) ||
      (o.orderNumber || '').toLowerCase().includes(term);
    return matchesStatus && matchesSearch;
  });

  const selectedOrderSubtotal = selectedOrder
    ? (selectedOrder.products || []).reduce((s: number, p: any) => s + (Number(p.price || 0) * Number(p.quantity || p.qty || 0)), 0)
    : 0;
  const selectedOrderShipping = selectedOrder ? Number(selectedOrder.shipping || selectedOrder.shippingCost || 0) : 0;
  const selectedOrderDiscountType = normalizeRateType(selectedOrder?.discountType || selectedOrder?.discount_type);
  const selectedOrderDiscountValue = Number(selectedOrder?.discountValue || selectedOrder?.discount_value || 0);
  const selectedOrderTaxType = normalizeRateType(selectedOrder?.taxType || selectedOrder?.tax_type);
  const selectedOrderTaxValue = Number(selectedOrder?.taxValue || selectedOrder?.tax_value || 0);
  const selectedOrderTotals = selectedOrder
    ? calculateOrderTotals(selectedOrderSubtotal, selectedOrderShipping, selectedOrderDiscountType, selectedOrderDiscountValue, selectedOrderTaxType, selectedOrderTaxValue, salesCalcOrder)
    : null;
  const selectedOrderDiscountAmount = selectedOrder
    ? (Number(selectedOrder.discountAmount || selectedOrder.discount_amount || 0) || selectedOrderTotals?.discountAmount || 0)
    : 0;
  const selectedOrderTaxAmount = selectedOrder
    ? (Number(selectedOrder.taxAmount || selectedOrder.tax_amount || 0) || selectedOrderTotals?.taxAmount || 0)
    : 0;
  const selectedOrderTotal = selectedOrder
    ? (Number(selectedOrder.total || 0) || selectedOrderTotals?.total || 0)
    : 0;

  const getStatusChip = (status: string) => {
    switch (status) {
      case 'pending': return <span className="bg-amber-100 text-amber-700 px-2 py-1 rounded-lg text-[10px] font-bold">قيد الانتظار</span>;
      case 'with_rep': return <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded-lg text-[10px] font-bold">مع المندوب</span>;
      case 'in_delivery': return <span className="bg-indigo-100 text-indigo-700 px-2 py-1 rounded-lg text-[10px] font-bold">قيد التسليم</span>;
      case 'delivered': return <span className="bg-emerald-100 text-emerald-700 px-2 py-1 rounded-lg text-[10px] font-bold">تم التسليم</span>;
      case 'returned': return <span className="bg-rose-100 text-rose-700 px-2 py-1 rounded-lg text-[10px] font-bold">مرتجع</span>;
      default: return <span className="bg-slate-100 text-slate-700 px-2 py-1 rounded-lg text-[10px] font-bold">{status}</span>;
    }
  };

  useEffect(() => {
    if (initialView) setView(initialView);
  }, [initialView]);

  useEffect(() => {
    // load existing products for import validation
    (async () => {
      try {
        const resp = await fetch(`${API_BASE_PATH}/api.php?module=products&action=getAll`);
        const j = await resp.json();
        if (j.success) setExistingProducts(j.data || []);
      } catch (e) { console.error('Failed to load products for import validation', e); }
    })();
    // load warehouses for optional stock operations
    (async () => {
      try {
        const r = await fetch(`${API_BASE_PATH}/api.php?module=warehouses&action=getAll`);
        const jr = await r.json();
        if (jr.success) setWarehouses(jr.data || []);
      } catch (e) { console.error('Failed to load warehouses', e); }
    })();
    // load all orders for management view
    (async () => {
      try {
        const r = await fetch(`${API_BASE_PATH}/api.php?module=orders&action=getAll`);
        const text = await r.text();
        let jr = null;
        try {
          jr = JSON.parse(text);
        } catch (pe) {
          console.error('Failed to parse orders response as JSON:', pe, 'raw response:', text);
          Swal.fire('خطأ', 'فشل تحميل الطلبيات من الخادم. راجع الكونسول للرد الخام.', 'error');
          setOrders([]);
          return;
        }
        if (jr && jr.success) setOrders(jr.data || []);
      } catch (e) { console.error('Failed to load orders', e); Swal.fire('خطأ', 'فشل تحميل الطلبيات من الخادم.'); }
    })();

    // load customers for manual order creation
    (async () => {
      try {
        const r = await fetch(`${API_BASE_PATH}/api.php?module=customers&action=getAll`);
        const jr = await r.json();
        if (jr.success) setCustomers(jr.data || []);
      } catch (e) { console.error('Failed to load customers', e); }
    })();
  }, []);

  useEffect(() => {
    if (salesDisplayMethod !== 'sales_offices') return;
    (async () => {
      try {
        // load current user's defaults (for office scoping)
        try {
          const u = JSON.parse(localStorage.getItem('Dragon_user') || 'null');
          const uid = u && u.id ? Number(u.id) : 0;
          if (uid) {
            const dRes = await fetch(`${API_BASE_PATH}/api.php?module=permissions&action=getUserDefaults&user_id=${uid}`);
            const dj = await dRes.json();
            if (dj && dj.success) setUserDefaults(dj.data || null);
          }
        } catch (e) {
          // ignore
        }

        const res = await fetch(`${API_BASE_PATH}/api.php?module=sales_offices&action=getAll`);
        const j = await res.json();
        if (j.success) setSalesOffices(j.data || []);
        else setSalesOffices([]);
      } catch (e) {
        console.error('Failed to load sales offices', e);
        setSalesOffices([]);
      }
    })();
  }, [salesDisplayMethod]);

  useEffect(() => {
    if (salesDisplayMethod !== 'sales_offices') return;
    if (!userDefaults) return;

    const raw = userDefaults.default_sales_office_id;
    const defId = (raw === null || typeof raw === 'undefined') ? null : Number(raw);
    const canChange = typeof userDefaults.can_change_sales_office !== 'undefined' ? Boolean(userDefaults.can_change_sales_office) : true;

    // If locked to a specific office, preselect it.
    if (!canChange && defId && defId > 0) {
      setSelectedSalesOfficeId(defId);
    }
    // If locked to none, clear selection.
    if (!canChange && defId === -1) {
      setSelectedSalesOfficeId('');
    }
  }, [userDefaults, salesDisplayMethod]);

  const addOrderItem = () => {
    setOrderItems([...orderItems, { id: Date.now(), productId: '', color: '', size: '', qty: 1, price: 0 }]);
  };

  const updateOrderItemField = (id:number, field:string, value:any) => {
    setOrderItems(prev => prev.map(it => {
      if (it.id !== id) return it;
      if (field === 'productId') {
        const pid = value ? Number(value) : '';
        const matched = existingProducts.find(ep => Number(ep.id) === Number(pid));
        if (matched) {
          return { ...it, productId: matched.id, name: matched.name || '', price: Number(matched.sale_price || matched.price || matched.retail_price || 0), color: matched.color || '', size: matched.size || '' };
        }
        return { ...it, productId: pid };
      }
      return { ...it, [field]: value };
    }));
  };

  const saveManualOrder = async () => {
    if (salesDisplayMethod === 'sales_offices' && !isSalesOfficeScopeNone && !selectedSalesOfficeId) {
      Swal.fire('تنبيه', 'يرجى اختيار مكتب المبيعات.', 'warning');
      return;
    }
    // build order payload similar to import structure
    const importedProducts = orderItems.map(it => ({ name: it.name || '', productId: it.productId || null, quantity: Number(it.qty || 0), price: Number(it.price || 0), color: it.color || '', size: it.size || '' }));
    const customerObj = selectedCustomerId ? (customers.find(c=>c.id===selectedCustomerId) || null) : null;
    const customerName = customerObj ? (customerObj.name || '') : newCustomer.name;
    const phone1 = customerObj ? (customerObj.phone1 || '') : newCustomer.phone1;
    const phone2 = customerObj ? (customerObj.phone2 || '') : newCustomer.phone2;
    const governorateVal = customerObj ? (customerObj.governorate || '') : newCustomer.governorate;
    const addr = customerObj ? (customerObj.address || '') : newCustomer.address;

    const subtotal = importedProducts.reduce((s, p) => s + (Number(p.quantity || 0) * Number(p.price || 0)), 0);
    const totals = calculateOrderTotals(subtotal, 0, discountType, discountValue, taxType, taxValue, salesCalcOrder);

    const orderPayload = {
      orderNumber: null,
      customerName,
      phone: phone1,
      phone2: phone2,
      governorate: governorateVal,
      address: addr,
      notes,
      employee,
      page,
      importedProducts,
      subTotal: totals.subtotal,
      total: totals.total,
      discount_type: discountType,
      discount_value: discountValue,
      tax_type: taxType,
      tax_value: taxValue,
      sales_office_id: (salesDisplayMethod === 'sales_offices' && !isSalesOfficeScopeNone)
        ? (selectedSalesOffice?.id || selectedSalesOfficeId || null)
        : null
    };

    try {
      const resp = await fetch(`${API_BASE_PATH}/api.php?module=orders&action=create`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ orders: [orderPayload] })
      });
      const jr = await resp.json();
      if (jr.success) {
        Swal.fire('تم الحفظ', 'تم إنشاء الطلبية بنجاح.', 'success');
        // refresh orders
        const r = await fetch(`${API_BASE_PATH}/api.php?module=orders&action=getAll`);
        const jr2 = await r.json(); if (jr2.success) setOrders(jr2.data || []);
        setView('manage-orders');
      } else {
        Swal.fire('فشل الحفظ', jr.message || 'فشل إنشاء الطلبية', 'error');
      }
    } catch (e) {
      console.error('Save manual order failed', e);
      Swal.fire('خطأ', 'فشل الاتصال بالخادم أثناء حفظ الطلبية.', 'error');
    }
  };

  const removeOrderItem = (id: number) => {
    setOrderItems(orderItems.filter(item => item.id !== id));
  };

  const toggleSelectAll = () => {
    if (selectedOrders.length === filteredOrders.length && filteredOrders.length > 0) {
      setSelectedOrders([]);
    } else {
      setSelectedOrders(filteredOrders.map(o => o.id));
    }
  };

  const toggleSelectOne = (orderId: number) => {
    if (selectedOrders.includes(orderId)) {
      setSelectedOrders(prev => prev.filter(id => id !== orderId));
    } else {
      setSelectedOrders(prev => [...prev, orderId]);
    }
  };

  const handleParseScript = () => {
    if (!scriptText.trim()) {
      Swal.fire('خطأ', 'يرجى لصق نص الطلبيات أولاً.', 'error');
      return;
    }
    setIsParsing(true);

    setTimeout(() => {
      const orderBlocks = scriptText.split(/الإسم:|‏الإسم:|الاسم:/).filter(block => block.trim() !== '');
      const maxId = orders.reduce((max, o) => { const id = parseInt(o.orderNumber, 10); return !isNaN(id) && id > max ? id : max; }, 0);

      const extractedOrders = orderBlocks.map((block, index) => {
          const orderData: { [key: string]: any } = { id: Date.now() + index };

          const extractField = (key: string, content: string, isMultiLine: boolean = false): string => {
              if (isMultiLine) {
                  const startRegex = new RegExp(`${key}:\\s*`);
                  const startMatch = content.match(startRegex);
                  if (!startMatch) return '';
                  const startIndex = startMatch.index! + startMatch[0].length;
                  const terminators = ['الإسم:', 'الاسم:', 'المحافظة:', 'العنوان:', 'التليفون', 'تليفون', 'موبايل', 'عدد القطع', 'تفاصيل المنتج', 'السعر:', 'الشحن:', 'الاجمالي:', 'الموظف:', 'البيدج:', 'ملاحظات:', 'ملاحظة:'];
                  let endIndex = content.length;
                  for (const term of terminators) {
                      if (term === `${key}:`) continue;
                      const termIndex = content.indexOf(term, startIndex);
                      if (termIndex !== -1 && termIndex < endIndex && termIndex > startIndex) {
                          endIndex = termIndex;
                      }
                  }
                  return content.substring(startIndex, endIndex).trim();
              } else {
                  const regex = new RegExp(`${key}:?\\s*([^\\n]*)`);
                  const match = content.match(regex);
                  return match ? match[1].trim() : '';
              }
          };

          orderData.name = block.split('\n')[0].trim(); 
          if(orderData.name.length > 50) orderData.name = extractField('الاسم', block); 
          
          orderData.governorate = extractField('المحافظة', block);
          orderData.address = extractField('العنوان', block, true);
          
          let phoneText = extractField('التليفون', block) || extractField('تليفون', block) || extractField('موبايل', block);
          const phones = phoneText.match(/\d{11}/g) || [];
          orderData.phone1 = phones[0] || '';
          orderData.phone2 = phones[1] || '';

          orderData.price = extractField('السعر', block);
          orderData.shipping = extractField('الشحن', block);
          orderData.total = extractField('الاجمالي', block);
          orderData.employee = extractField('الموظف', block) || extractField('مودريتور', block);
          orderData.page = extractField('البيدج', block);
          
          const productDetailsText = extractField('تفاصيل المنتج', block, true) || extractField('المنتجات', block, true);
          const productLines = productDetailsText.split('\n').filter(line => line.trim() !== '');

          orderData.products = productLines.map(line => {
              line = line.trim().replace(/^(?:-|\d+\.?\s*-?)\s*/, '');
              let product: { name: string; color: string; size: string; quantity: number; price: string; };

              const newFormatRegex = /(?:^\d*?)الكميه\s+(\d+)\s+اسم المنتج\s+(.*?)\s+اللون\s+(.*?)\s+المقاس\s+(.*)/;
              const match = line.match(newFormatRegex);

              if (match) {
                  product = {
                      quantity: parseInt(match[1], 10),
                      name: match[2].trim(),
                      color: match[3].trim(),
                      size: match[4].trim(),
                      price: '0' // Price is not in the new format line, can be edited later.
                  };
              } else {
                  // Fallback to old format
                  product = {
                      name: '',
                      color: '',
                      size: '',
                      quantity: 1,
                      price: ''
                  };

                  const quantityMatch = line.match(/^(\d+)\s+/);
                  if (quantityMatch) {
                      product.quantity = parseInt(quantityMatch[1], 10);
                      line = line.substring(quantityMatch[0].length).trim();
                  }

                  const priceMatch = line.match(/\s+(\d+(\.\d+)?)$/);
                  if (priceMatch) {
                      product.price = priceMatch[1];
                      line = line.substring(0, line.length - priceMatch[0].length).trim();
                  }

                  const sizeMatch = line.match(/مقاس\s+([\w\s\d]+)/);
                  if (sizeMatch) {
                      product.size = sizeMatch[1].trim();
                      line = line.replace(sizeMatch[0], '').trim();
                  }
                  
                  const colors = ['اسود', 'هافان', 'كاروهات', 'جملي', 'أبيض', 'أحمر', 'أزرق', 'أخضر', 'أصفر', 'بني', 'رمادي', 'وردي'];
                  const lineParts = line.split(' ');
                  const foundColors: string[] = [];
                  const nameParts: string[] = [];

                  lineParts.forEach(part => {
                      if (colors.includes(part)) {
                          foundColors.push(part);
                      } else {
                          nameParts.push(part);
                      }
                  });

                  product.name = nameParts.join(' ').trim();
                  product.color = foundColors.join(' ').trim();

                  if (!product.name && !product.color) {
                      product.name = line;
                  }
              }
              
              return { ...product, total: (Number(product.price) * product.quantity).toString() };
          });
          
          const notes1 = extractField('ملاحظات', block, true);
          orderData.notes = notes1;
          orderData.orderNumber = (maxId + index + 1).toString();

          return orderData;
      });

      setParsedOrders(extractedOrders);
      setIsParsing(false);
      Swal.fire('تم التحليل', `تم استخراج ${extractedOrders.length} طلبية بنجاح.`, 'success');
    }, 1000);
  };

  // validate parsed orders against existing products and mark missing attributes
  useEffect(() => {
    if (!parsedOrders || parsedOrders.length === 0) return;
    const validated = parsedOrders.map((o:any) => {
      const products = (o.products || []).map((p:any) => {
        const name = (p.name || '').trim();
        const lname = name.toLowerCase();
        const lcolor = (p.color || '').toString().trim().toLowerCase();
        const lsize = (p.size || '').toString().trim().toLowerCase();
        let match: any = null;
        // 1) try exact name+color+size match
        if (name) {
          match = existingProducts.find((ep:any) => {
            if (!ep.name) return false;
            const en = ep.name.toString().trim().toLowerCase();
            const ec = (ep.color || '').toString().trim().toLowerCase();
            const es = (ep.size || '').toString().trim().toLowerCase();
            return en === lname && (lcolor === '' || ec === lcolor) && (lsize === '' || es === lsize);
          }) || null;
        }
        // 2) try exact name-only match
        if (!match && name) {
          match = existingProducts.find((ep:any) => ep.name && ep.name.toString().trim().toLowerCase() === lname) || null;
        }
        // 3) fuzzy contains match
        if (!match && name) {
          match = existingProducts.find((ep:any) => (ep.name||'').toLowerCase().includes(lname) || lname.includes((ep.name||'').toLowerCase())) || null;
        }

        const productId = match ? match.id : null;
        const missingProduct = !productId;
        const missingSize = match && p.size && match.size && p.size.toString() !== match.size.toString() ? true : false;
        const missingColor = match && p.color && match.color && p.color.toString() !== match.color.toString() ? true : false;

        // Extract price from matched product if available
        let resolvedPrice = Number(p.price) || 0;
        if (match) {
          const preferredKeys = ['sale_price','salePrice','sellingPrice','selling_price','price','cost','retail_price','retailPrice','default_price','amount','value'];
          let candidatePrice: any = resolvedPrice;
          for (const k of preferredKeys) {
            if (match[k] !== undefined && match[k] !== null) {
              const num = Number(String(match[k]).replace(/,/g, ''));
              if (!isNaN(num) && num > 0) { candidatePrice = num; break; }
            }
          }
          if ((!candidatePrice || Number(candidatePrice) === 0) && typeof match === 'object') {
            for (const k of Object.keys(match)) {
              try {
                const v = match[k];
                const num = Number(String(v).replace(/,/g, ''));
                if (!isNaN(num) && num > 0) { candidatePrice = num; break; }
              } catch (e) {}
            }
          }
          resolvedPrice = Number(candidatePrice) || 0;
        }

        return { ...p, productId, missingProduct, missingSize, missingColor, price: resolvedPrice };
      });
      return { ...o, products };
    });

    // Only update state if the validated result actually differs to avoid re-render loops
    setParsedOrders(prev => {
      try {
        const prevStr = JSON.stringify(prev || []);
        const validatedStr = JSON.stringify(validated || []);
        if (prevStr === validatedStr) return prev;
      } catch (e) {
        // If serialization fails for any reason, fall back to replacing
      }
      return validated;
    });
  }, [existingProducts, parsedOrders]);

  const handleConfirmImport = () => {
    if (salesDisplayMethod === 'sales_offices' && !isSalesOfficeScopeNone && !selectedSalesOfficeId) {
      Swal.fire('تنبيه', 'يرجى اختيار مكتب المبيعات قبل الحفظ.', 'warning');
      return;
    }
    const newOrders = parsedOrders.map(pOrder => {
      const cleanPrice = (str: string) => {
         if(!str) return 0;
         const match = str.match(/(\d+(\.\d+)?)/);
         return match ? parseFloat(match[0]) : 0;
      };
      // Preserve product-level validation state in the saved order. Backend import enhancement can be done later.
      // Group identical products by name/size/color
      const groupedMap: any = {};
      (pOrder.products || []).forEach((pp:any) => {
        const key = `${(pp.name||'').trim().toLowerCase()}|${(pp.size||'').trim().toLowerCase()}|${(pp.color||'').trim().toLowerCase()}`;
        if (!groupedMap[key]) groupedMap[key] = { name: pp.name, size: pp.size||'', color: pp.color||'', quantity: 0, productId: pp.productId || null, missingProduct: !!pp.missingProduct, missingSize: !!pp.missingSize, missingColor: !!pp.missingColor, price: pp.price || 0 };
        groupedMap[key].quantity += Number(pp.quantity || 0);
        // if any entry marks missing, keep it flagged
        groupedMap[key].missingProduct = groupedMap[key].missingProduct && pp.missingProduct ? true : (groupedMap[key].missingProduct || !!pp.missingProduct);
        groupedMap[key].missingSize = groupedMap[key].missingSize || !!pp.missingSize;
        groupedMap[key].missingColor = groupedMap[key].missingColor || !!pp.missingColor;
        if (!groupedMap[key].productId && pp.productId) groupedMap[key].productId = pp.productId;
      });
      const importedProductsArr = Object.values(groupedMap);

      return {
        ...pOrder,
        id: pOrder.id,
        orderNumber: pOrder.orderNumber,
        customerName: pOrder.name,
        phone: pOrder.phone1,
        phone2: pOrder.phone2 || '',
        governorate: pOrder.governorate || '',
        address: pOrder.address || '',
        notes: pOrder.notes || '',
        employee: pOrder.employee || '',
        page: pOrder.page || '',
        status: 'pending',
        total: cleanPrice(pOrder.total),
        shippingCost: cleanPrice(pOrder.shipping),
        subTotal: cleanPrice(pOrder.price),
        importedProducts: importedProductsArr,
        discount_type: importDiscountType,
        discount_value: importDiscountValue,
        tax_type: importTaxType,
        tax_value: importTaxValue,
        sales_office_id: (salesDisplayMethod === 'sales_offices' && !isSalesOfficeScopeNone)
          ? (selectedSalesOffice?.id || selectedSalesOfficeId || null)
          : null
      };
    });

    // send to backend for persistence
    (async () => {
      try {
        const resp = await fetch(`${API_BASE_PATH}/api.php?module=orders&action=create`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orders: newOrders, create_sales: createSales ? 1 : 0, default_warehouse_id: defaultWarehouseId || null })
        });
        const jr = await resp.json();
        if (jr.success) {
          // optionally fetch created orders or just append placeholders locally
          setOrders(prevOrders => [...newOrders, ...prevOrders]);
          Swal.fire('تم الحفظ', `تم إنشاء ${jr.created.length || newOrders.length} طلبيات بنجاح.`, 'success');
          setParsedOrders([]);
          setScriptText('');
          setView('manage-orders');
        } else {
          Swal.fire('فشل الحفظ', jr.message || 'فشل حفظ الطلبيات على الخادم.', 'error');
        }
      } catch (e) {
        console.error('Import save failed', e);
        Swal.fire('خطأ', 'فشل الاتصال بخادم الحفظ. تم حفظ الطلبيات محلياً.', 'warning');
        setOrders(prevOrders => [...newOrders, ...prevOrders]);
        setParsedOrders([]);
        setScriptText('');
        setView('manage-orders');
      }
    })();
  };

  const addProductToParsedOrder = (orderId: number) => {
    setParsedOrders(prev => prev.map(po => po.id === orderId ? { ...po, products: [...(po.products||[]), { name: '', quantity: 1, color: '', size: '', price: '0', productId: null, missingProduct: true }] } : po));
  };

  const removeProductFromParsedOrder = (orderId: number, index: number) => {
    setParsedOrders(prev => prev.map(po => po.id === orderId ? { ...po, products: po.products.filter((_:any, idx:number) => idx !== index) } : po));
  };

  const updateParsedProductField = (orderId: number, index: number, field: string, value: any) => {
    setParsedOrders(prev => prev.map(po => {
      if (po.id !== orderId) return po;
      const products = (po.products || []).map((pp:any, idx:number) => {
        if (idx !== index) return pp;
        const updated = { ...pp, [field]: value };
        // Normalize values
        const name = (updated.name || '').toString().trim();
        const size = (updated.size || '').toString().trim();
        const color = (updated.color || '').toString().trim();

        // If user selected a productId explicitly, honor it
        let productId = updated.productId || null;
        let match: any = null;
        if (productId) {
          match = existingProducts.find((ep:any) => Number(ep.id) === Number(productId)) || null;
        } else if (name) {
          match = existingProducts.find((ep:any) => ep.name && ep.name.toLowerCase() === name.toLowerCase()) || null;
          if (!match) {
            match = existingProducts.find((ep:any) => (ep.name||'').toLowerCase().includes(name.toLowerCase()) || name.toLowerCase().includes((ep.name||'').toLowerCase())) || null;
          }
        }

        productId = match ? match.id : null;
        const missingProduct = !productId;
        const missingSize = !!(match && size && match.size && size.toString() !== match.size.toString());
        const missingColor = !!(match && color && match.color && color.toString() !== match.color.toString());

        // If we found a match, populate name/price/color/size from the matched product
        let outName = (updated.name || '').toString();
        let outPrice: any = updated.price;
        let outColor = (updated.color || '').toString();
        let outSize = (updated.size || '').toString();
        if (match) {
          if (match.name) outName = match.name;
          // Robust price extraction: prefer common price keys, then scan any numeric field
          const preferredKeys = ['sale_price','salePrice','sellingPrice','selling_price','price','cost','retail_price','retailPrice','default_price','amount','value'];
          let candidatePrice: any = outPrice;
          for (const k of preferredKeys) {
            if (match[k] !== undefined && match[k] !== null) {
              const num = Number(String(match[k]).replace(/,/g, ''));
              if (!isNaN(num) && num > 0) { candidatePrice = num; break; }
            }
          }
          // If still not found, scan all fields for a positive numeric value
          if ((!candidatePrice || Number(candidatePrice) === 0) && typeof match === 'object') {
            for (const k of Object.keys(match)) {
              try {
                const v = match[k];
                const num = Number(String(v).replace(/,/g, ''));
                if (!isNaN(num) && num > 0) { candidatePrice = num; break; }
              } catch (e) { /* ignore */ }
            }
          }
          outPrice = Number(candidatePrice) || 0;
          outColor = (match.color ?? outColor);
          outSize = (match.size ?? outSize);
          if (outPrice === 0) console.debug('Matched product has no positive price field', match);
        } else {
          outPrice = Number(outPrice) || 0;
        }

        return { ...updated, productId, missingProduct, missingSize, missingColor, name: outName, price: outPrice, color: outColor, size: outSize };
      });
      return { ...po, products };
    }));
  };

  const handlePrint = (ordersToPrint: any[]) => {
    setOrdersToPrint(ordersToPrint);
  };

  useEffect(() => {
    if (ordersToPrint) {
      const timer = setTimeout(() => {
        window.print();
        setTimeout(() => setOrdersToPrint(null), 1000); 
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [ordersToPrint]);

  const refreshOrdersList = async () => {
    try {
      const r = await fetch(`${API_BASE_PATH}/api.php?module=orders&action=getAll`);
      const jr = await r.json();
      if (jr && jr.success) setOrders(jr.data || []);
    } catch (e) {
      console.error('Failed to refresh orders list', e);
    }
  };

  const openOrderDetails = async (order: any) => {
    setSelectedOrder(order);
    setIsOrderDetailsOpen(true);
    setOrderTimeline([]);
    setOrderDocuments([]);
    setStatusUpdate('');
    setStatusNote('');
    try {
      const [tRes, dRes] = await Promise.all([
        fetch(`${API_BASE_PATH}/api.php?module=orders&action=getTimeline&id=${order.id}`),
        fetch(`${API_BASE_PATH}/api.php?module=orders&action=getDocuments&id=${order.id}`)
      ]);
      const tJson = await tRes.json();
      const dJson = await dRes.json();
      if (tJson.success) setOrderTimeline(tJson.data || []);
      if (dJson.success) setOrderDocuments(dJson.data || []);
    } catch (e) {
      console.error('Failed to load order details', e);
    }
  };

  const addOrderDocument = async () => {
    if (!selectedOrder || !docUrl.trim()) {
      Swal.fire('بيانات ناقصة', 'يرجى إدخال رابط المستند.', 'warning');
      return;
    }
    try {
      const res = await fetch(`${API_BASE_PATH}/api.php?module=orders&action=addDocument`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          order_id: selectedOrder.id,
          doc_type: docType,
          doc_url: docUrl.trim(),
          notes: docNotes
        })
      });
      const jr = await res.json();
      if (jr.success) {
        setDocUrl('');
        setDocNotes('');
        const dRes = await fetch(`${API_BASE_PATH}/api.php?module=orders&action=getDocuments&id=${selectedOrder.id}`);
        const dJson = await dRes.json();
        if (dJson.success) setOrderDocuments(dJson.data || []);
      } else {
        Swal.fire('فشل الإضافة', jr.message || 'تعذر إضافة المستند.', 'error');
      }
    } catch (e) {
      console.error('Add order document failed', e);
    }
  };

  const deleteOrderDocument = async (id: number) => {
    if (!selectedOrder) return;
    try {
      const res = await fetch(`${API_BASE_PATH}/api.php?module=orders&action=deleteDocument`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      });
      const jr = await res.json();
      if (jr.success) {
        const dRes = await fetch(`${API_BASE_PATH}/api.php?module=orders&action=getDocuments&id=${selectedOrder.id}`);
        const dJson = await dRes.json();
        if (dJson.success) setOrderDocuments(dJson.data || []);
      } else {
        Swal.fire('فشل الحذف', jr.message || 'تعذر حذف المستند.', 'error');
      }
    } catch (e) {
      console.error('Delete order document failed', e);
    }
  };

  const updateOrderStatus = async () => {
    if (!selectedOrder || !statusUpdate) return;
    try {
      const res = await fetch(`${API_BASE_PATH}/api.php?module=orders&action=update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: selectedOrder.id, status: statusUpdate, status_note: statusNote })
      });
      const jr = await res.json();
      if (jr.success) {
        await refreshOrdersList();
        const tRes = await fetch(`${API_BASE_PATH}/api.php?module=orders&action=getTimeline&id=${selectedOrder.id}`);
        const tJson = await tRes.json();
        if (tJson.success) setOrderTimeline(tJson.data || []);
        setStatusUpdate('');
        setStatusNote('');
        Swal.fire('تم التحديث', 'تم تحديث حالة الطلب.', 'success');
      } else {
        Swal.fire('فشل التحديث', jr.message || 'تعذر تحديث الحالة.', 'error');
      }
    } catch (e) {
      console.error('Update order status failed', e);
    }
  };

  const openStatusEdit = (order: any) => {
    setStatusEditOrder(order);
    setStatusEditValue(order.status || '');
    setStatusEditNote('');
    setReturnFineMode('none');
    setReturnFineAmount('');
    setIsStatusEditOpen(true);
  };

  const submitStatusEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!statusEditOrder || !statusEditValue) {
      Swal.fire('تنبيه', 'يرجى اختيار الحالة.', 'warning');
      return;
    }
    if (returnFineMode === 'fine') {
      const fine = Number(returnFineAmount || 0);
      if (!fine || isNaN(fine) || fine <= 0) {
        Swal.fire('تنبيه', 'يرجى إدخال مبلغ غرامة صحيح.', 'warning');
        return;
      }
      if (!statusEditOrder.rep_id && !statusEditOrder.repId) {
        Swal.fire('تنبيه', 'لا يوجد مندوب مرتبط بهذه الطلبية لتطبيق الغرامة.', 'warning');
        return;
      }
    }
    try {
      const res = await fetch(`${API_BASE_PATH}/api.php?module=orders&action=update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: statusEditOrder.id,
          status: statusEditValue,
          status_note: statusEditNote,
          penalty_apply: returnFineMode === 'fine' ? 1 : 0,
          penalty_amount: returnFineMode === 'fine' ? Number(returnFineAmount || 0) : 0
        })
      });
      const jr = await res.json();
      if (jr.success) {
        await refreshOrdersList();
        setIsStatusEditOpen(false);
        Swal.fire('تم التحديث', 'تم تحديث حالة الطلب.', 'success');
      } else {
        Swal.fire('فشل التحديث', jr.message || 'تعذر تحديث الحالة.', 'error');
      }
    } catch (err) {
      console.error('Update order status failed', err);
      Swal.fire('خطأ', 'فشل الاتصال بالخادم.', 'error');
    }
  };

  return (
    <div className="space-y-6 dir-rtl">
      
      {/* Hidden Print Container */}
      {ordersToPrint && (
        <div id="print-container">
           <PrintableOrders orders={ordersToPrint} companyName={effectiveHeaderName} companyPhone={effectiveHeaderPhone} terms={companyTerms} />
        </div>
      )}

      {isOrderDetailsOpen && selectedOrder && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white w-full max-w-5xl rounded-3xl overflow-hidden shadow-2xl">
            <div className="p-6 border-b flex justify-between items-center bg-slate-50">
              <div>
                <h3 className="text-lg font-black text-slate-800">تفاصيل الطلب #{selectedOrder.orderNumber}</h3>
                <p className="text-xs text-slate-500">{selectedOrder.customerName} • {selectedOrder.phone1 || selectedOrder.phone}</p>
              </div>
              <button onClick={() => setIsOrderDetailsOpen(false)} className="text-slate-400 hover:text-rose-500">إغلاق</button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 p-6">
              <div className="lg:col-span-2 space-y-6">
                <div className="border rounded-2xl p-4">
                  <h4 className="text-sm font-black mb-3">تحديث الحالة</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                    <select value={statusUpdate} onChange={e => setStatusUpdate(e.target.value)} className="border rounded-lg px-3 py-2 text-sm">
                      <option value="">اختر حالة</option>
                      <option value="pending">قيد الانتظار</option>
                      <option value="with_rep">مع المندوب</option>
                      <option value="in_delivery">قيد التسليم</option>
                      <option value="delivered">تم التسليم</option>
                      <option value="returned">مرتجع</option>
                    </select>
                    <input value={statusNote} onChange={e => setStatusNote(e.target.value)} placeholder="ملاحظة التغيير" className="border rounded-lg px-3 py-2 text-sm md:col-span-2" />
                  </div>
                  <button onClick={updateOrderStatus} className="mt-3 bg-blue-600 text-white px-4 py-2 rounded-lg text-xs font-bold">تحديث الحالة</button>
                </div>

                <div className="border rounded-2xl p-4">
                  <h4 className="text-sm font-black mb-3">ملخص الفاتورة</h4>
                  <div className="text-xs space-y-1">
                    <div className="flex justify-between"><span>الإجمالي قبل الإضافات</span><span>{selectedOrderSubtotal.toLocaleString()} {currencySymbol}</span></div>
                    {selectedOrderDiscountAmount > 0 && (
                      <div className="flex justify-between text-rose-600"><span>الخصم</span><span>-{selectedOrderDiscountAmount.toLocaleString()} {currencySymbol}</span></div>
                    )}
                    {selectedOrderTaxAmount > 0 && (
                      <div className="flex justify-between text-emerald-600"><span>الضريبة</span><span>+{selectedOrderTaxAmount.toLocaleString()} {currencySymbol}</span></div>
                    )}
                    <div className="flex justify-between"><span>الشحن</span><span>{selectedOrderShipping.toLocaleString()} {currencySymbol}</span></div>
                    <div className="flex justify-between font-black pt-2 border-t"><span>الإجمالي</span><span>{selectedOrderTotal.toLocaleString()} {currencySymbol}</span></div>
                  </div>
                </div>

                <div className="border rounded-2xl p-4">
                  <h4 className="text-sm font-black mb-3">سجل الحالة</h4>
                  {orderTimeline.length === 0 ? (
                    <div className="text-xs text-slate-400">لا يوجد سجل حتى الآن.</div>
                  ) : (
                    <div className="space-y-2 max-h-72 overflow-y-auto">
                      {orderTimeline.map((t:any) => (
                        <div key={t.id} className="border rounded-xl p-3 text-xs">
                          <div className="flex justify-between items-center">
                            <span className="font-bold">{t.status || t.action}</span>
                            <span className="text-slate-400">{t.created_at || t.createdAt}</span>
                          </div>
                          <div className="text-slate-500 mt-1">{t.notes || '-'}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-6">
                <div className="border rounded-2xl p-4">
                  <h4 className="text-sm font-black mb-3">المستندات</h4>
                  <div className="space-y-2 mb-3">
                    <select value={docType} onChange={e => setDocType(e.target.value)} className="border rounded-lg px-3 py-2 text-xs w-full">
                      <option value="delivery_note">إيصال تسليم</option>
                      <option value="invoice">فاتورة</option>
                      <option value="proof">إثبات</option>
                      <option value="other">أخرى</option>
                    </select>
                    <input value={docUrl} onChange={e => setDocUrl(e.target.value)} placeholder="رابط المستند" className="border rounded-lg px-3 py-2 text-xs w-full" />
                    <input value={docNotes} onChange={e => setDocNotes(e.target.value)} placeholder="ملاحظات" className="border rounded-lg px-3 py-2 text-xs w-full" />
                    <button onClick={addOrderDocument} className="w-full bg-emerald-600 text-white px-3 py-2 rounded-lg text-xs font-bold">إضافة مستند</button>
                  </div>

                  {orderDocuments.length === 0 ? (
                    <div className="text-xs text-slate-400">لا توجد مستندات.</div>
                  ) : (
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {orderDocuments.map((d:any) => (
                        <div key={d.id} className="border rounded-xl p-2 text-xs">
                          <div className="flex justify-between items-center">
                            <span className="font-bold">{d.doc_type || d.type}</span>
                            <button onClick={() => deleteOrderDocument(d.id)} className="text-rose-500">حذف</button>
                          </div>
                          <a href={d.doc_url || d.url} target="_blank" rel="noreferrer" className="text-blue-600 break-all">{d.doc_url || d.url}</a>
                          <div className="text-slate-500 mt-1">{d.notes || '-'}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {isStatusEditOpen && statusEditOrder && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl">
            <div className="p-6 border-b flex justify-between items-center bg-slate-50">
              <div>
                <h3 className="text-lg font-black text-slate-800">تعديل حالة الطلب</h3>
                <p className="text-xs text-slate-500">#{statusEditOrder.orderNumber} • {statusEditOrder.customerName}</p>
              </div>
              <button onClick={() => setIsStatusEditOpen(false)} className="text-slate-400 hover:text-rose-500">إغلاق</button>
            </div>
            <form onSubmit={submitStatusEdit} className="p-6 space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500">الحالة</label>
                <select value={statusEditValue} onChange={e => setStatusEditValue(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm">
                  <option value="">اختر حالة</option>
                  <option value="pending">قيد الانتظار</option>
                  <option value="with_rep">مع المندوب</option>
                  <option value="in_delivery">قيد التسليم</option>
                  <option value="delivered">تم التسليم</option>
                  <option value="returned">مرتجع</option>
                </select>
              </div>

              <div className="space-y-3">
                <label className="text-xs font-bold text-slate-500">الغرامة على المندوب</label>
                <div className="flex gap-3">
                  <label className="flex items-center gap-2 text-xs font-bold text-slate-600">
                    <input type="radio" checked={returnFineMode === 'none'} onChange={() => setReturnFineMode('none')} />
                    بدون غرامة
                  </label>
                  <label className="flex items-center gap-2 text-xs font-bold text-slate-600">
                    <input type="radio" checked={returnFineMode === 'fine'} onChange={() => setReturnFineMode('fine')} />
                    بغرامة
                  </label>
                </div>
                {returnFineMode === 'fine' && (
                  <div>
                    <label className="text-xs font-bold text-slate-500">مبلغ الغرامة</label>
                    <input
                      type="number"
                      min="0"
                      value={returnFineAmount}
                      onChange={e => setReturnFineAmount(e.target.value)}
                      className="w-full border rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                )}
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500">ملاحظة</label>
                <input
                  value={statusEditNote}
                  onChange={e => setStatusEditNote(e.target.value)}
                  placeholder="سبب التعديل"
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                />
              </div>

              <button type="submit" className="w-full bg-blue-600 text-white px-4 py-3 rounded-lg text-sm font-bold">حفظ التعديل</button>
            </form>
          </div>
        </div>
      )}
      
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-900">إدارة الطلبيات</h2>
          <p className="text-sm text-slate-500 font-medium">نظام تتبع وإدارة المبيعات</p>
        </div>
        <div className="flex gap-1 bg-white p-1.5 rounded-2xl border border-slate-200 shadow-sm w-full md:w-auto overflow-x-auto">
          <button onClick={() => setView('new-order')} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all whitespace-nowrap ${view === 'new-order' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}><PlusCircle size={16}/> طلبية جديدة</button>
          <button onClick={() => setView('manage-orders')} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all whitespace-nowrap ${view === 'manage-orders' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}><FileText size={16}/> إدارة الطلبيات</button>
          <button onClick={() => setView('import-orders')} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all whitespace-nowrap ${view === 'import-orders' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}><UploadCloud size={16}/> استيراد</button>
        </div>
      </div>

      {/* --- Views --- */}
      {view === 'new-order' && (
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
             <h3 className="text-lg font-black mb-3">إنشاء طلبية يدوية</h3>

             {salesDisplayMethod === 'sales_offices' && (
               <div className="mb-4 p-3 bg-slate-50 border border-slate-200 rounded-2xl">
                 <div className="text-xs font-black text-slate-600 mb-2">مكتب المبيعات</div>
                 {isSalesOfficeScopeNone ? (
                   <div className="text-xs text-slate-500">هذا المستخدم بدون مكاتب مبيعات (سيتم استخدام بيانات الشركة في رأس الطلبية).</div>
                 ) : (
                   <div className="flex flex-col md:flex-row gap-2 md:items-center">
                     <select
                       className="border p-2 rounded-md bg-white"
                       value={selectedSalesOfficeId as any}
                       onChange={e => setSelectedSalesOfficeId(e.target.value ? Number(e.target.value) : '')}
                       disabled={!canChangeSalesOffice && defaultSalesOfficeId !== null && defaultSalesOfficeId !== undefined}
                     >
                       <option value="">اختيار مكتب</option>
                       {(canChangeSalesOffice ? salesOffices : salesOffices.filter(o => Number(o.id) === Number(defaultSalesOfficeId))).map((o: any) => (
                         <option key={o.id} value={o.id}>{o.name}</option>
                       ))}
                     </select>
                     <div className="text-xs text-slate-500">
                       {selectedSalesOffice ? (selectedSalesOffice.phones || '') : 'سيظهر اسم/هاتف المكتب في رأس الطلبية.'}
                     </div>
                   </div>
                 )}
               </div>
             )}

             <div className="flex gap-2 items-center mb-3">
               <select className="border p-2 rounded-md" value={selectedCustomerId as any} onChange={e=>setSelectedCustomerId(e.target.value ? Number(e.target.value) : '')}>
                 <option value="">اختيار زبون موجود</option>
                 {customers.map(c=> <option key={c.id} value={c.id}>{c.name} - {c.phone1}</option>)}
               </select>
               <button className="btn" onClick={()=>{ setSelectedCustomerId(''); setNewCustomer({ name: '', phone1: '', phone2: '', governorate: '', address: '' }) }}>زبون جديد</button>
             </div>

             {selectedCustomerId === '' && (
               <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-3">
                 <input placeholder="اسم الزبون" className="border p-2 rounded" value={newCustomer.name} onChange={e=>setNewCustomer({...newCustomer, name:e.target.value})} />
                 <input placeholder="هاتف 1" className="border p-2 rounded" value={newCustomer.phone1} onChange={e=>setNewCustomer({...newCustomer, phone1:e.target.value})} />
                 <input placeholder="هاتف 2" className="border p-2 rounded" value={newCustomer.phone2} onChange={e=>setNewCustomer({...newCustomer, phone2:e.target.value})} />
                 <input placeholder="المحافظة" className="border p-2 rounded" value={newCustomer.governorate} onChange={e=>setNewCustomer({...newCustomer, governorate:e.target.value})} />
                 <input placeholder="العنوان" className="border p-2 rounded md:col-span-2" value={newCustomer.address} onChange={e=>setNewCustomer({...newCustomer, address:e.target.value})} />
               </div>
             )}

             <div>
               <h4 className="font-bold mb-2">عناصر الطلب</h4>
               {orderItems.map(it => (
                 <div key={it.id} className="flex gap-2 items-center mb-2">
                   <select className="border p-2 rounded flex-1" value={(it as any).productId || ''} onChange={e=> updateOrderItemField(it.id, 'productId', e.target.value)}>
                     <option value="">اختر منتج</option>
                     {existingProducts.map((p:any) => (
                       <option key={p.id} value={p.id}>{p.name} {p.size ? `- ${p.size}` : ''} {p.color ? `- ${p.color}` : ''}</option>
                     ))}
                   </select>
                   <input className="border p-2 rounded w-20 text-center" placeholder="كم" value={it.qty} onChange={e=> updateOrderItemField(it.id, 'qty', Number(e.target.value || 0))} />
                   <input className="border p-2 rounded w-28 text-center" placeholder="سعر" value={it.price} onChange={e=> updateOrderItemField(it.id, 'price', Number(e.target.value || 0))} />
                   <button className="btn bg-rose-500 text-white px-3 py-1 rounded" onClick={()=> removeOrderItem(it.id)}>حذف</button>
                 </div>
               ))}
               <div className="mt-2 text-xs text-slate-500">المنتجات يجب أن تُختار من القائمة الموجودة فقط.</div>
               <div className="flex gap-2 mt-2">
                 <button className="btn bg-blue-600 text-white px-4 py-2 rounded" onClick={addOrderItem}>إضافة عنصر</button>
                 <button className="btn bg-emerald-600 text-white px-4 py-2 rounded" onClick={saveManualOrder}>حفظ الطلبية</button>
               </div>
               <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                 <div className="border rounded p-3">
                   <label className="text-xs font-bold text-slate-500">الخصم</label>
                   <div className="flex gap-2 mt-1">
                     <select value={discountType} onChange={e => setDiscountType(e.target.value as RateType)} className="border rounded px-2 py-1 text-sm">
                       <option value="amount">قيمة</option>
                       <option value="percent">نسبة %</option>
                     </select>
                     <input type="number" min={0} value={discountValue} onChange={e => setDiscountValue(Number(e.target.value || 0))} className="border rounded px-2 py-1 text-sm w-full" placeholder="0" />
                   </div>
                 </div>
                 <div className="border rounded p-3">
                   <label className="text-xs font-bold text-slate-500">الضريبة</label>
                   <div className="flex gap-2 mt-1">
                     <select value={taxType} onChange={e => setTaxType(e.target.value as RateType)} className="border rounded px-2 py-1 text-sm">
                       <option value="percent">نسبة %</option>
                       <option value="amount">قيمة</option>
                     </select>
                     <input type="number" min={0} value={taxValue} onChange={e => setTaxValue(Number(e.target.value || 0))} className="border rounded px-2 py-1 text-sm w-full" placeholder="0" />
                   </div>
                   <div className="text-[10px] text-slate-400 mt-1">ترتيب الاحتساب حسب إعدادات النظام.</div>
                 </div>
               </div>
              <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-2">
                <textarea placeholder="ملاحظات" className="border p-2 rounded md:col-span-2" value={notes} onChange={e=>setNotes(e.target.value)} />
                <div className="grid gap-2">
                  <input placeholder="الموظف" className="border p-2 rounded" value={employee} onChange={e=>setEmployee(e.target.value)} />
                  <input placeholder="البيدج" className="border p-2 rounded" value={page} onChange={e=>setPage(e.target.value)} />
                </div>
              </div>
             </div>
        </div>
      )}

      {view === 'manage-orders' && (
        <div className="space-y-4">
          {/* Toolbar */}
          <div className="bg-white p-4 rounded-3xl shadow-sm border border-slate-200 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="relative flex-1 w-full md:max-w-md">
              <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
              <input 
                type="text" 
                placeholder="بحث برقم الطلبية، اسم العميل، الهاتف..." 
                value={searchTerm} 
                onChange={e => setSearchTerm(e.target.value)} 
                className="w-full pr-10 pl-4 py-3 bg-slate-50 border-none rounded-2xl text-sm focus:ring-2 focus:ring-blue-500 transition-all" 
              />
            </div>
            
            <div className="flex items-center gap-3 w-full md:w-auto">
                <select
                  value={statusFilter}
                  onChange={e => setStatusFilter(e.target.value)}
                  className="bg-white border border-slate-200 px-3 py-3 rounded-2xl text-xs font-bold text-slate-600"
                >
                  <option value="all">كل الحالات</option>
                  <option value="pending">قيد الانتظار</option>
                  <option value="with_rep">مع المندوب</option>
                  <option value="in_delivery">قيد التسليم</option>
                  <option value="delivered">تم التسليم</option>
                  <option value="returned">مرتجع</option>
                </select>
                <button 
                  onClick={toggleSelectAll}
                  className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 border border-slate-200 px-4 py-3 rounded-2xl text-xs font-bold text-slate-600 transition-all"
                >
                    {selectedOrders.length === filteredOrders.length && filteredOrders.length > 0 ? <CheckSquare size={16} className="text-blue-600"/> : <Square size={16}/>}
                    {selectedOrders.length === filteredOrders.length ? 'إلغاء الكل' : 'تحديد الكل'}
                </button>

                <button 
                    onClick={() => handlePrint(orders.filter(o => selectedOrders.includes(o.id)))} 
                    disabled={selectedOrders.length === 0} 
                    className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-slate-800 text-white px-6 py-3 rounded-2xl text-xs font-bold hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-slate-200 transition-all"
                >
                    <Printer size={16}/> طباعة المحدد ({selectedOrders.length})
                </button>
            </div>
          </div>

          {/* New Card Grid Layout (Unified with Import View) */}
          {filteredOrders.length === 0 ? (
             <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-slate-300">
                <FileText className="w-16 h-16 mx-auto text-slate-200 mb-4"/>
                <p className="text-slate-400 font-bold">لا توجد طلبيات مطابقة للبحث</p>
             </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-5">
              {filteredOrders.map(order => (
                <div 
                  key={order.id} 
                  className={`relative group bg-white p-0 rounded-3xl border transition-all duration-300 hover:shadow-xl hover:-translate-y-1 ${selectedOrders.includes(order.id) ? 'border-blue-500 ring-2 ring-blue-500/20 z-10' : 'border-slate-200 shadow-sm'}`}
                >
                    {/* Selection Checkbox (Absolute) */}
                    <div className="absolute top-4 left-4 z-20">
                        <button 
                          onClick={() => toggleSelectOne(order.id)}
                          className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${selectedOrders.includes(order.id) ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-300 hover:bg-slate-200'}`}
                        >
                           {selectedOrders.includes(order.id) ? <CheckSquare size={16}/> : <Square size={16}/>}
                        </button>
                    </div>

                    {/* Card Content */}
                    <div className="p-5">
                        {/* Header */}
                        <div className="flex justify-between items-start mb-4 pl-10">
                            <div>
                                <span className="inline-block bg-slate-100 text-slate-600 font-mono text-[10px] px-2 py-1 rounded-lg mb-1">{order.orderNumber}</span>
                                <h3 className="font-bold text-slate-800 text-sm line-clamp-1">{order.customerName}</h3>
                            </div>
                            {getStatusChip(order.status)}
                        </div>

                        {/* Details */}
                        <div className="space-y-2 mb-4">
                            <div className="flex items-center gap-2 text-xs text-slate-500">
                                <Phone size={14} className="text-blue-500"/>
                                <span className="font-mono dir-ltr">{order.phone}</span>
                            </div>
                            <div className="flex items-start gap-2 text-xs text-slate-500">
                                <MapPin size={14} className="text-rose-500 mt-0.5 shrink-0"/>
                                <span className="line-clamp-2 leading-relaxed">{order.governorate} - {order.address}</span>
                            </div>
                        </div>

                        {/* Products Summary */}
                        <div className="bg-slate-50 rounded-xl p-3 mb-4 border border-slate-100">
                            <p className="text-[10px] text-slate-400 font-bold mb-2">ملخص المنتجات:</p>
                            <div className="space-y-1">
                                {order.products.slice(0, 2).map((p:any, i:number) => (
                                    <div key={i} className="flex justify-between text-[11px]">
                                        <span className="text-slate-700 truncate max-w-[70%]">{p.name}</span>
                                        <span className="text-slate-500 font-mono">x{p.quantity}</span>
                                    </div>
                                ))}
                                {order.products.length > 2 && (
                                    <p className="text-[10px] text-blue-500 font-bold pt-1">+ {order.products.length - 2} منتجات أخرى</p>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="flex items-center justify-between p-4 border-t border-slate-100 bg-slate-50/50 rounded-b-3xl">
                        <div className="flex flex-col">
                            <span className="text-[10px] text-slate-400 font-bold">الإجمالي</span>
                            <span className="font-black text-lg text-slate-800">{order.total.toLocaleString()} {currencySymbol}</span>
                        </div>
                        <div className="flex gap-2">
                             <button 
                                onClick={() => handlePrint([order])}
                                className="w-10 h-10 flex items-center justify-center bg-white border border-slate-200 rounded-xl text-slate-600 hover:text-blue-600 hover:border-blue-200 transition-colors shadow-sm"
                                title="طباعة"
                             >
                                <Printer size={18}/>
                             </button>
                             <button
                               onClick={() => openStatusEdit(order)}
                               className="w-10 h-10 flex items-center justify-center bg-white border border-slate-200 rounded-xl text-slate-600 hover:text-amber-600 hover:border-amber-200 transition-colors shadow-sm"
                               title="تعديل الحالة"
                             >
                               <Edit size={18}/>
                             </button>
                             <button
                               onClick={() => openOrderDetails(order)}
                               className="w-10 h-10 flex items-center justify-center bg-white border border-slate-200 rounded-xl text-slate-600 hover:text-emerald-600 hover:border-emerald-200 transition-colors shadow-sm"
                               title="تفاصيل"
                             >
                               <Eye size={18}/>
                             </button>
                        </div>
                    </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {view === 'import-orders' && (
        <div className="space-y-6">
          <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
              <h3 className="text-xl font-black mb-2 text-slate-900 flex items-center gap-3"><ClipboardPaste size={24} className="text-blue-500"/> استيراد الطلبيات</h3>

              {salesDisplayMethod === 'sales_offices' && (
                <div className="mb-4 p-3 bg-slate-50 border border-slate-200 rounded-2xl">
                  <div className="text-xs font-black text-slate-600 mb-2">مكتب المبيعات</div>
                  {isSalesOfficeScopeNone ? (
                    <div className="text-xs text-slate-500">هذا المستخدم بدون مكاتب مبيعات (سيتم استخدام بيانات الشركة في رأس الطلبية).</div>
                  ) : (
                    <div className="flex flex-col md:flex-row gap-2 md:items-center">
                      <select
                        className="border p-2 rounded-md bg-white"
                        value={selectedSalesOfficeId as any}
                        onChange={e => setSelectedSalesOfficeId(e.target.value ? Number(e.target.value) : '')}
                        disabled={!canChangeSalesOffice && defaultSalesOfficeId !== null && defaultSalesOfficeId !== undefined}
                      >
                        <option value="">اختيار مكتب</option>
                        {(canChangeSalesOffice ? salesOffices : salesOffices.filter(o => Number(o.id) === Number(defaultSalesOfficeId))).map((o: any) => (
                          <option key={o.id} value={o.id}>{o.name}</option>
                        ))}
                      </select>
                      <div className="text-xs text-slate-500">
                        {selectedSalesOffice ? (selectedSalesOffice.phones || '') : 'سيظهر اسم/هاتف المكتب في رأس الطلبية.'}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <textarea value={scriptText} onChange={(e) => setScriptText(e.target.value)} rows={8} placeholder="انسخ نص الطلبيات هنا..." className="w-full bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl p-4 text-sm font-mono focus:border-blue-500 transition-all" />
              <div className="mt-4 flex justify-end">
                      <div className="flex items-center gap-3 mr-auto">
                        <label className="text-xs">مستودع افتراضي (للبيع/المخزون)</label>
                        <select value={defaultWarehouseId} onChange={e => setDefaultWarehouseId(e.target.value ? Number(e.target.value) : '')} className="bg-white border rounded-xl px-3 py-2 text-sm">
                          <option value="">بدون</option>
                          {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                        </select>
                        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={createSales} onChange={e => setCreateSales(e.target.checked)} /> أنشئ قيود مبيعات</label>
                        <div className="flex items-center gap-2">
                          <label className="text-xs">خصم</label>
                          <select value={importDiscountType} onChange={e => setImportDiscountType(e.target.value as RateType)} className="bg-white border rounded-xl px-2 py-1 text-xs">
                            <option value="amount">قيمة</option>
                            <option value="percent">%</option>
                          </select>
                          <input type="number" min={0} value={importDiscountValue} onChange={e => setImportDiscountValue(Number(e.target.value || 0))} className="bg-white border rounded-xl px-2 py-1 text-xs w-20" />
                        </div>
                        <div className="flex items-center gap-2">
                          <label className="text-xs">ضريبة</label>
                          <select value={importTaxType} onChange={e => setImportTaxType(e.target.value as RateType)} className="bg-white border rounded-xl px-2 py-1 text-xs">
                            <option value="percent">%</option>
                            <option value="amount">قيمة</option>
                          </select>
                          <input type="number" min={0} value={importTaxValue} onChange={e => setImportTaxValue(Number(e.target.value || 0))} className="bg-white border rounded-xl px-2 py-1 text-xs w-20" />
                        </div>
                      </div>
                      <button onClick={handleParseScript} disabled={!scriptText || isParsing} className="bg-blue-600 text-white px-8 py-3 rounded-2xl font-black shadow-lg shadow-blue-500/20 disabled:opacity-50 flex gap-2">
                        {isParsing ? <RefreshCcw className="animate-spin" size={18}/> : <FileText size={18}/>} تحليل النص
                      </button>
              </div>
          </div>
          {parsedOrders.length > 0 && (
            <div className="space-y-4">
                <div className="flex justify-between items-center">
                    <h3 className="font-bold">المعاينة ({parsedOrders.length})</h3>
                    <button onClick={handleConfirmImport} className="bg-emerald-600 text-white px-6 py-2 rounded-xl font-bold shadow-lg">حفظ الكل</button>
                </div>
                {/* Unified Import View Layout */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {parsedOrders.map(order => (
                        <div key={order.id} className="bg-white p-4 rounded-2xl border border-slate-200 text-xs shadow-sm">
                             <div className="flex justify-between items-start mb-2 border-b pb-2">
                                <span className="font-bold text-sm">{order.name}</span>
                                <span className="bg-blue-50 text-blue-600 px-2 py-0.5 rounded-lg font-mono">{order.total} ج.م</span>
                             </div>
                             <div className="space-y-1 text-slate-500">
                                <p className="truncate">{order.governorate} - {order.address}</p>
                                <p className="font-mono">{order.phone1}</p>
                             </div>
                             <div className="mt-2 pt-2 border-t border-dashed">
                                         <div className="flex items-center justify-between mb-2">
                                           <div className="text-sm font-bold">المنتجات</div>
                                           <div className="flex items-center gap-2">
                                             <button onClick={() => addProductToParsedOrder(order.id)} className="bg-blue-50 text-blue-600 px-3 py-1 rounded-xl text-xs">أضف منتج</button>
                                           </div>
                                         </div>
                                         {order.products.map((p:any, i:number) => (
                                             <div key={i} className="flex justify-between items-center gap-2 mb-2">
                                                 <div className="flex-1">
                                                   <div className="flex gap-2 items-center">
                                                     <input value={p.name} onChange={(e) => updateParsedProductField(order.id, i, 'name', e.target.value)} className="w-2/3 bg-transparent text-sm" />
                                                     <input value={p.size || ''} onChange={(e) => updateParsedProductField(order.id, i, 'size', e.target.value)} placeholder="المقاس" className="w-1/6 bg-transparent text-sm text-center" />
                                                     <input value={p.color || ''} onChange={(e) => updateParsedProductField(order.id, i, 'color', e.target.value)} placeholder="اللون" className="w-1/6 bg-transparent text-sm text-center" />
                                                   </div>
                                                   <div className="mt-1 flex items-center gap-2">
                                                     {p.missingProduct && <span className="text-[11px] bg-rose-100 text-rose-700 px-2 py-0.5 rounded">غير موجود</span>}
                                                     {p.missingSize && <span className="text-[11px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded">المقاس</span>}
                                                     {p.missingColor && <span className="text-[11px] bg-violet-100 text-violet-700 px-2 py-0.5 rounded">اللون</span>}
                                                   </div>
                                                   <div className="mt-1">
                                                     {p.productId ? (
                                                       <div className="text-xs text-green-600">متطابق: {existingProducts.find((ep:any) => ep.id === p.productId)?.name || p.productId}</div>
                                                     ) : (
                                                       <select value={p.productId || ''} onChange={(e) => updateParsedProductField(order.id, i, 'productId', e.target.value ? Number(e.target.value) : null)} className="mt-1 text-sm rounded-md border px-2 py-1">
                                                         <option value="">اختيار منتج مطابق</option>
                                                         {existingProducts.map((ep:any) => <option key={ep.id} value={ep.id}>{ep.name}</option>)}
                                                       </select>
                                                     )}
                                                   </div>
                                                 </div>
                                                 <div className="flex flex-col items-end gap-1 w-40">
                                                   <label className="text-[11px] text-slate-500">الكمية</label>
                                                   <input type="number" min={1} value={p.quantity} onChange={(e) => updateParsedProductField(order.id, i, 'quantity', Number(e.target.value || 0))} className="w-full text-right font-mono px-2 py-1 rounded-md border" />
                                                   <label className="text-[11px] text-slate-500">سعر البيع</label>
                                                   <input type="number" step="0.01" value={p.price} onChange={(e) => updateParsedProductField(order.id, i, 'price', e.target.value)} className="w-full text-right font-mono px-2 py-1 rounded-md border" />
                                                   <div className="flex gap-2 mt-1">
                                                     <button onClick={() => removeProductFromParsedOrder(order.id, i)} className="text-rose-600 text-xs">حذف</button>
                                                   </div>
                                                 </div>
                                             </div>
                                         ))}
                             </div>
                        </div>
                    ))}
                </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// --- Printable Content Component (No changes needed here, keeping it as is) ---

const PrintableContent: React.FC<{ order: any, companyName: string, companyPhone: string, terms: string }> = ({ order, companyName, companyPhone, terms }) => {
    const productRows = order.products && order.products.length > 0 
      ? order.products 
      : [{ name: '', quantity: '', price: '', total: '' }];

    // Compute line totals if missing and overall total fallback
    const computedRows = productRows.map((p:any) => {
      const price = Number(p.price || 0);
      const qty = Number(p.quantity || p.qty || 0);
      const lineTotal = (p.total !== undefined && p.total !== null && Number(p.total) !== 0) ? Number(p.total) : price * qty;
      return { ...p, price, quantity: qty, lineTotal };
    });

    const computedSubtotal = computedRows.reduce((s:any, r:any) => s + (r.lineTotal || 0), 0);
    const shippingVal = Number(order.shipping || order.shippingCost || 0);
    const discountType = normalizeRateType(order.discountType || order.discount_type);
    const discountValue = Number(order.discountValue || order.discount_value || 0);
    const taxType = normalizeRateType(order.taxType || order.tax_type);
    const taxValue = Number(order.taxValue || order.tax_value || 0);
    const calcOrder = (localStorage.getItem('Dragon_sales_calc_order') || 'discount_then_tax') as 'discount_then_tax' | 'tax_then_discount';

    const computedTotals = calculateOrderTotals(computedSubtotal, shippingVal, discountType, discountValue, taxType, taxValue, calcOrder);
    const discountAmount = Number(order.discountAmount || order.discount_amount || 0) || computedTotals.discountAmount;
    const taxAmount = Number(order.taxAmount || order.tax_amount || 0) || computedTotals.taxAmount;
    const computedTotal = (order.total && Number(order.total) > 0) ? Number(order.total) : computedTotals.total;

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
                        src={`https://barcode.tec-it.com/barcode.ashx?data=${order.orderNumber}&code=Code128&dpi=96&thickness=2`} 
                        alt="barcode"
                        className="h-10 mb-1"
                    />
                     <p className="font-black text-sm">{order.orderNumber}</p>
                </div>
            </div>

            {/* Date */}
            <div className="text-right mb-1">
                 <p className="text-xs font-bold">التاريخ: {currentDate}</p>
            </div>

            {/* Divider */}
            <div className="w-full border-b-2 border-black border-dashed my-1"></div>

            {/* Customer Info */}
            <div className="mb-2">
                <div className="flex justify-between items-center mb-1">
                    <div className="text-right flex-1">
                        <span className="font-bold text-base">{order.customerName || order.name}</span>
                    </div>
                    <div className="border-2 border-black p-1 px-3">
                        <span className="font-black text-sm">{order.governorate || 'غير محدد'}</span>
                    </div>
                </div>
                <div className="flex justify-between items-center mb-1">
                    <div className="text-right">
                         <span className="font-bold text-sm font-mono">{order.phone1 || order.phone}</span>
                    </div>
                    <div className="text-left">
                         <span className="font-bold text-sm font-mono">{order.phone2}</span>
                    </div>
                </div>
                <div className="text-right">
                    <span className="font-bold text-xs leading-tight">{order.address}</span>
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
                            <td className="border-l border-black p-1 text-right font-medium">{p.name} {p.color !== '-' ? `- ${p.color}` : ''}</td>
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
                <p><span className="font-bold">الموظف:</span> {order.employee || 'Admin'}</p>
                <p><span className="font-bold">البيدج:</span> {order.page || '-'}</p>
            </div>

            {/* --- Total Required --- */}
            <div className="border-2 border-black p-2 mb-2 text-center bg-slate-50">
                <p className="font-black text-sm mb-1">المطلوب دفعه</p>
                <div className="text-2xl font-black mb-1">{computedTotal.toLocaleString()} ج.م</div>
                <div className="text-[10px] font-bold space-y-0.5">
                  <div>الإجمالي قبل الإضافات: {computedSubtotal.toLocaleString()} ج.م</div>
                  {discountAmount > 0 && <div>خصم: {discountAmount.toLocaleString()} ج.م</div>}
                  {taxAmount > 0 && <div>ضريبة: {taxAmount.toLocaleString()} ج.م</div>}
                  <div>شحن: {shippingVal.toLocaleString()} ج.م</div>
                </div>
            </div>

            {/* Policy */}
            <div className="border-2 border-black p-1 text-center mt-auto">
                <p className="font-bold text-[10px] mb-0.5">سياسة الشركه</p>
                <p className="text-[9px] font-medium leading-tight">{terms}</p>
            </div>

        </div>
    );
};

const PrintableOrders: React.FC<{ orders: any[], companyName: string, companyPhone: string, terms: string }> = ({ orders, companyName, companyPhone, terms }) => {
  // chunk orders into pages of 4 (2x2) for printing
  const chunks: any[] = [];
  for (let i = 0; i < orders.length; i += 4) {
    chunks.push(orders.slice(i, i + 4));
  }

  return (
    <div>
      <style>
        {`
        @media print {
          body { visibility: hidden; margin: 0; padding: 0; }
          #print-container { visibility: visible !important; position: absolute; top: 0; left: 0; width: 100%; }
          @page { size: A4; margin: 0.5cm; }
          .print-page { page-break-after: always; }
          * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
        `}
      </style>

            {chunks.map((chunk, idx) => (
                <div key={idx} className="print-page" style={{ padding: '0.3cm', height: '28.7cm' }}>
                    <div className="grid grid-cols-2 gap-4" style={{ height: '100%', gridTemplateRows: '1fr 1fr' }}>
                      {chunk.map((order: any) => (
                        <div key={order.id} className="break-inside-avoid border border-slate-300" style={{ height: '100%' }}>
                          <PrintableContent order={order} companyName={companyName} companyPhone={companyPhone} terms={terms} />
                        </div>
                      ))}
                    </div>
                </div>
            ))}
    </div>
  );
}

export default OrdersModule;
