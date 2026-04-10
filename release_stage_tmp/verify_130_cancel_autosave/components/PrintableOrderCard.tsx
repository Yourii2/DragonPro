/**
 * PrintableOrderCard.tsx
 * Shared printable waybill components used by SalesModule and RepresentativesModule.
 * Extracted so multiple modules can render the same print layout.
 */
import React from 'react';
import Barcode from './Barcode';

// ─── Helpers ────────────────────────────────────────────────────────────────

export type RateType = 'percent' | 'amount';

export const normalizeNumbers = (input: any): string => {
  if (input === null || typeof input === 'undefined') return '';
  const s = String(input);
  const map: Record<string, string> = {
    '٠':'0','١':'1','٢':'2','٣':'3','٤':'4','٥':'5','٦':'6','٧':'7','٨':'8','٩':'9',
    '۰':'0','۱':'1','۲':'2','۳':'3','۴':'4','۵':'5','۶':'6','۷':'7','۸':'8','۹':'9'
  };
  return s.split('').map(ch => map[ch] || ch).join('');
};

export const pickDisplayPhone = (phones: any, fallback: string): string => {
  const text = normalizeNumbers(phones || '').toString();
  const match = text.match(/\d{11}/);
  if (match && match[0]) return match[0];
  const first = text.split(/\r?\n|,/).map(s => s.trim()).filter(Boolean)[0];
  return first || fallback;
};

export const normalizeRateType = (value?: string | null): RateType | null => {
  const v = (value || '').toLowerCase().trim();
  if (v === 'percent' || v === 'percentage') return 'percent';
  if (v === 'amount' || v === 'fixed' || v === 'value') return 'amount';
  return null;
};

export const calculateOrderTotals = (
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

// ─── PrintableContent ────────────────────────────────────────────────────────

export const PrintableContent: React.FC<{
  order: any;
  companyName: string;
  companyPhone: string;
  terms: string;
  users?: any[];
}> = ({ order, companyName, companyPhone, terms, users }) => {
  const productRows = order.products && order.products.length > 0
    ? order.products
    : [{ name: '', quantity: '', price: '', total: '' }];

  const computedRows = productRows.map((p: any) => {
    const price = Number(p.price || 0);
    const qty = Number(p.quantity || p.qty || 0);
    const lineTotal = (p.total !== undefined && p.total !== null && Number(p.total) !== 0)
      ? Number(p.total)
      : price * qty;
    return { ...p, price, quantity: qty, lineTotal };
  });

  const computedSubtotal = computedRows.reduce((s: any, r: any) => s + (r.lineTotal || 0), 0);
  const shippingVal = Number(order.shipping || order.shippingCost || 0);
  const discountType = normalizeRateType(order.discountType || order.discount_type);
  const discountValue = Number(order.discountValue || order.discount_value || 0);
  const taxType = normalizeRateType(order.taxType || order.tax_type);
  const taxValue = Number(order.taxValue || order.tax_value || 0);
  const calcOrder = (localStorage.getItem('Dragon_sales_calc_order') || 'discount_then_tax') as 'discount_then_tax' | 'tax_then_discount';

  const computedTotals = calculateOrderTotals(computedSubtotal, shippingVal, discountType, discountValue, taxType, taxValue, calcOrder);
  const computedTotal = (order.total && Number(order.total) > 0) ? Number(order.total) : computedTotals.total;

  const companyLogo = localStorage.getItem('Dragon_company_logo') || '';
  const currentDate = new Date().toISOString().split('T')[0];
  const pageDisplay = order.page || order.pageName || order.page_name || order.page_number || order.page_no || order.source || '-';

  const getUserDisplayName = (emp: any) => {
    const usersList = users || [];
    if (!emp) {
      try {
        const u = JSON.parse(localStorage.getItem('Dragon_user') || 'null');
        return u && (u.name || u.username) ? (u.name || u.username) : 'Admin';
      } catch (e) { return 'Admin'; }
    }
    if (typeof emp === 'string' && emp.toString().trim() !== '') return emp;
    if (typeof emp === 'number' || /^[0-9]+$/.test(String(emp))) {
      const found = usersList.find((u: any) => Number(u.id) === Number(emp));
      if (found) return found.name || found.username || String(emp);
    }
    const byUsername = usersList.find((u: any) => (u.username || '').toString().toLowerCase() === ('' + emp).toString().toLowerCase());
    if (byUsername) return byUsername.name || byUsername.username;
    if (typeof emp === 'object') {
      if (emp.name) return emp.name;
      if (emp.username) return emp.username;
      if (emp.full_name) return emp.full_name;
    }
    return emp || 'Admin';
  };

  return (
    <div className="flex flex-col bg-white text-black font-sans box-border relative p-1" style={{ direction: 'rtl', fontSize: '28px', flex: 1, minHeight: 0 }}>

      {/* Header: left=logo, center=barcode, right=company name+phone */}
      <div className="flex items-center justify-between mb-1 w-full" style={{ direction: 'ltr' }}>
        {/* Logo (left) */}
        <div className="w-1/4 flex flex-col items-start justify-center">
          {companyLogo ? (
            <img src={companyLogo} alt="logo" className="h-48 max-w-full mb-1 object-contain" />
          ) : (
            <h1 className="company-name font-black text-4xl mb-1">{companyName}</h1>
          )}
        </div>

        {/* Barcode & order number (center) */}
        <div className="w-1/2 flex flex-col items-center justify-center">
          <Barcode value={order.orderNumber} className="h-20" height={64} width={2} />
          <div className="text-base mt-1 text-center font-bold tracking-widest">{order.orderNumber}</div>
        </div>

        {/* Company info (right) */}
        <div className="w-1/4 text-right" style={{ direction: 'rtl' }}>
          <h1 className="company-name font-black text-4xl">{companyName}</h1>
          <p className="text-base font-bold mt-1 company-phone">{companyPhone}</p>
        </div>
      </div>

      {/* Date */}
      <div className="text-right mb-1">
        <p className="text-base font-bold">التاريخ: {currentDate}</p>
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
            <span className="font-black text-base">{order.governorate || 'غير محدد'}</span>
          </div>
        </div>
        <div className="flex justify-between items-center mb-1">
          <div className="text-right">
            <span className="font-bold text-base font-mono">{pickDisplayPhone(`${order.phone || ''}\n${order.phone1 || ''}\n${order.phone2 || ''}`, '')}</span>
          </div>
          <div className="text-left">
            <span className="font-bold text-base font-mono">{normalizeNumbers(order.phone2 || '')}</span>
          </div>
        </div>
        <div className="text-right">
          <span className="font-bold text-base leading-tight">{order.address}</span>
        </div>
      </div>

      {/* Product Table */}
      <div className="border-2 border-black mb-1">
        <table className="w-full text-center text-base border-collapse" style={{ fontSize: '32px' }}>
          <thead>
            <tr className="bg-slate-200 border-b-2 border-black">
              <th className="border-l border-black text-base p-1">المنتج</th>
              <th className="border-l border-black text-base p-1 w-20">السعر</th>
              <th className="border-l border-black text-base p-1 w-16">الكمية</th>
              <th className="p-1 w-24">الإجمالي</th>
            </tr>
          </thead>
          <tbody>
            {computedRows.map((p: any, i: number) => (
              <tr key={i} className="border-b border-black">
                <td className="border-l border-black p-1 text-right" style={{ fontSize: '36px', fontWeight: 900 }}>
                  <b style={{ fontWeight: 900 }}>{p.name}</b>
                  <span style={{ fontSize: '24px', fontWeight: 900, color: '#000' }}>
                    {' '}- اللون: {p.color || '-'} - المقاس: {p.size || '-'}
                  </span>
                </td>
                <td className="border-l border-black p-1" style={{ fontSize: '28px', fontWeight: 800 }}>{p.price.toLocaleString()}</td>
                <td className="border-l border-black p-1" style={{ fontSize: '28px', fontWeight: 800 }}>{p.quantity}</td>
                <td className="p-1" style={{ fontSize: '28px', fontWeight: 800 }}>{(p.lineTotal || 0).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>


      {/* Totals */}
      <div className="border-2 border-black p-2 mb-2 bg-slate-50">
        <div className="flex justify-between items-center mb-1 px-2">
          <div className="text-base text-left font-bold">الإجمالي (المنتجات)</div>
          <div className="text-base font-black">{computedSubtotal.toLocaleString()} ج.م</div>
        </div>
        <div className="flex justify-between items-center mb-1 px-2">
          <div className="text-base font-bold">مصاريف الشحن</div>
          <div className="text-base font-black">{shippingVal.toLocaleString()} ج.م</div>
        </div>
        <div className="w-full border-t border-black my-1"></div>
        <div className="flex justify-between items-center text-2xl font-black px-2">
          <div>الإجمالي المطلوب</div>
          <div>{computedTotal.toLocaleString()} ج.م</div>
        </div>
      </div>

      {/* Notes */}
      {order.notes && String(order.notes).trim() !== '' && (
        <div className="mt-2 border-2 border-black p-2 bg-white text-right" style={{ fontSize: '26px' }}>
          <div className="font-bold mb-1">ملاحظات:</div>
          <div>{order.notes}</div>
        </div>
      )}

      {/* Employee & Page (moved below notes) */}
      <div className="flex flex-col text-sm mb-2 px-2 py-1 border-t border-b border-dashed border-black bg-slate-50 mt-1">
        <div className="mb-1">الموظف: <span className="font-bold">{getUserDisplayName(order.employee || order.employee_raw || order.employeeName || order.employee_name)}</span></div>
        <div>البيدج: <span className="font-bold">{pageDisplay}</span></div>
      </div>

      {/* Policy */}
      <div className="border-2 border-black p-1 text-center mt-auto">
        <p className="font-bold text-base mb-0.5">سياسة الشركه</p>
        <p className="text-base font-medium leading-tight">{terms}</p>
      </div>
    </div>
  );
};

// ─── PrintableOrders ─────────────────────────────────────────────────────────

export const PrintableOrders: React.FC<{
  orders: any[];
  companyName: string;
  companyPhone: string;
  terms: string;
  users?: any[];
}> = ({ orders, companyName, companyPhone, terms, users }) => {
  return (
    <div className="print-root">
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #print-container, #print-container * {
            font-family: 'Noto Sans Arabic', 'Noto Naskh Arabic', Arial, sans-serif !important;
            font-size: 28px !important;
            visibility: visible !important;
          }
          #print-container .company-name { font-size: 48px !important; line-height: 1 !important; font-weight: 900 !important; }
          #print-container .company-phone { font-size: 20px !important; font-weight: 800 !important; }
          #print-container { position: absolute; left: 0; top: 0; width: 100%; margin: 0; padding: 0; }
          @page { size: A4; margin: 0; }
          .print-page {
            width: 100%;
            height: 29.6cm;
            padding: 0.5cm;
            box-sizing: border-box;
            display: flex;
            page-break-inside: avoid;
            break-inside: avoid;
            page-break-after: always;
          }
          .print-page:last-child { page-break-after: auto; }
          .print-page > .print-wrapper { flex: 1 1 auto; display: flex; flex-direction: column; }
          .print-page .print-content { flex: 1 1 auto; display: flex; flex-direction: column; }
          * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>
      <div id="print-container">
        {orders.map((order: any) => (
          <div key={order.id} className="print-page">
            <div className="print-wrapper" style={{ minHeight: 0 }}>
              <div className="print-content" style={{ minHeight: 0 }}>
                <PrintableContent
                  order={order}
                  companyName={companyName}
                  companyPhone={companyPhone}
                  terms={terms}
                  users={users}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
