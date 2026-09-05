/**
 * PrintableOrderCard.tsx
 * Shared printable waybill components used by SalesModule and RepresentativesModule.
 * Extracted so multiple modules can render the same print layout.
 */
import React from 'react';
import { createPortal } from 'react-dom';
import Barcode from './Barcode';
import { UniversalWaybill, getSelectedTemplateId } from './UniversalWaybillRenderer';

// ─── Helpers ───────────────────────────────────────────────────────────────

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
  companyLogo?: string | null;
  companyAddress?: string;
  users?: any[];
}> = ({ order, companyName, companyPhone, terms, companyLogo, companyAddress, users }) => {
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
    <div 
      className="flex flex-col bg-white text-black font-sans box-border relative overflow-hidden w-full h-full"
      style={{ 
        direction: 'rtl', 
        fontSize: '14px',
        padding: '2mm',
        boxSizing: 'border-box'
      }}
    >

      {/* Header: left=logo, center=barcode, right=company name+phone */}
      <div className="flex items-center justify-between w-full" style={{ direction: 'ltr', marginBottom: '4px', minHeight: '0', flexShrink: 0 }}>
        {/* Logo (left) */}
        <div className="w-1/4 flex flex-col items-start justify-center">
          {companyLogo && typeof companyLogo === 'string' && companyLogo.trim() !== '' ? (
            <img src={companyLogo} alt="" className="object-contain" style={{ maxHeight: '60px', maxWidth: '100%' }} />
          ) : (
            <h1 className="company-name font-black" style={{ fontSize: '16px', margin: '0' }}>{companyName}</h1>
          )}
        </div>

        {/* Barcode & order number (center) */}
        <div className="w-1/2 flex flex-col items-center justify-center" style={{ gap: '2px' }}>
          <Barcode value={order.orderNumber || order.order_number || ''} className="" height={40} width={1} />
          <div className="text-center font-bold" style={{ fontSize: '11px', letterSpacing: '1px' }}>{order.orderNumber || order.order_number}</div>
        </div>

        {/* Company info (right) */}
        <div className="w-1/4 text-right" style={{ direction: 'rtl' }}>
          <h1 className="company-name font-black" style={{ fontSize: '16px', margin: '0' }}>{companyName}</h1>
          <p className="font-bold" style={{ fontSize: '11px', margin: '2px 0 0 0' }}>{companyPhone}</p>
          {companyAddress ? <p style={{ fontSize: '9px', margin: '2px 0 0 0' }}>{companyAddress}</p> : null}
        </div>
      </div>

      {/* Date */}
      <div className="text-right" style={{ marginBottom: '4px', flexShrink: 0 }}>
        <p className="font-bold" style={{ fontSize: '11px', margin: '0' }}>التاريخ: {currentDate}</p>
      </div>

      {/* Divider */}
      <div className="w-full border-b border-black border-dashed" style={{ margin: '2px 0', flexShrink: 0 }}></div>

      {/* Customer Info */}
      <div style={{ marginBottom: '6px', flexShrink: 0 }}>
        <div className="flex justify-between items-center" style={{ marginBottom: '3px' }}>
          <div className="text-right flex-1">
            <span className="font-bold" style={{ fontSize: '11px' }}>{order.customerName || order.name}</span>
          </div>
          <div className="border border-black" style={{ padding: '2px 6px' }}>
            <span className="font-black" style={{ fontSize: '10px' }}>{order.governorate || 'غير محدد'}</span>
          </div>
        </div>
        <div className="flex justify-between items-center" style={{ marginBottom: '3px' }}>
          <div className="text-right">
            <span className="font-bold font-mono" style={{ fontSize: '10px' }}>{pickDisplayPhone(`${order.phone || ''}\n${order.phone1 || ''}\n${order.phone2 || ''}`, '')}</span>
          </div>
          <div className="text-left">
            <span className="font-bold font-mono" style={{ fontSize: '10px' }}>{normalizeNumbers(order.phone2 || '')}</span>
          </div>
        </div>
        <div className="text-right">
          <span className="font-bold" style={{ fontSize: '10px', lineHeight: '1.2' }}>{order.address}</span>
        </div>
      </div>

      {/* Product Table */}
      <div className="border border-black" style={{ marginBottom: '4px', flex: '1', minHeight: '0', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <table className="w-full border-collapse" style={{ fontSize: '11px', tableLayout: 'auto' }}>
          <thead>
            <tr className="bg-slate-200 border-b border-black" style={{ flexShrink: 0 }}>
              <th className="border-l border-black p-0.5 text-left" style={{ fontSize: '10px', fontWeight: 700 }}>المنتج</th>
              <th className="border-l border-black p-0.5 w-12" style={{ fontSize: '10px', fontWeight: 700 }}>السعر</th>
              <th className="border-l border-black p-0.5 w-10" style={{ fontSize: '10px', fontWeight: 700 }}>الكمية</th>
              <th className="p-0.5 w-12" style={{ fontSize: '10px', fontWeight: 700 }}>الإجمالي</th>
            </tr>
          </thead>
          <tbody style={{ overflow: 'auto' }}>
            {computedRows.map((p: any, i: number) => (
              <tr key={i} className="border-b border-black">
                <td className="border-l border-black p-0.5 text-right" style={{ fontSize: '10px', fontWeight: 700 }}>
                  <div style={{ fontWeight: 700 }}>{p.name}</div>
                  <div style={{ fontSize: '8px', fontWeight: 700, color: '#000' }}>
                    اللون: {p.color || '-'} - المقاس: {p.size || '-'}
                  </div>
                </td>
                <td className="border-l border-black p-0.5 text-center" style={{ fontSize: '11px', fontWeight: 700 }}>{p.price.toLocaleString()}</td>
                <td className="border-l border-black p-0.5 text-center" style={{ fontSize: '11px', fontWeight: 700 }}>{p.quantity}</td>
                <td className="p-0.5 text-center" style={{ fontSize: '11px', fontWeight: 700 }}>{(p.lineTotal || 0).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Totals */}
      <div className="border border-black bg-slate-50 p-1" style={{ marginBottom: '4px', flexShrink: 0 }}>
        <div className="flex justify-between items-center" style={{ marginBottom: '2px', fontSize: '10px' }}>
          <div className="text-left font-bold">الإجمالي (المنتجات)</div>
          <div className="font-black">{computedSubtotal.toLocaleString()} ج.م</div>
        </div>
        <div className="flex justify-between items-center" style={{ marginBottom: '2px', fontSize: '10px' }}>
          <div className="font-bold">مصاريف الشحن</div>
          <div className="font-black">{shippingVal.toLocaleString()} ج.م</div>
        </div>
        <div className="w-full border-t border-black" style={{ margin: '2px 0' }}></div>
        <div className="flex justify-between items-center font-black" style={{ fontSize: '12px' }}>
          <div>الإجمالي المطلوب</div>
          <div>{computedTotal.toLocaleString()} ج.م</div>
        </div>
      </div>

      {/* Notes */}
      {order.notes && String(order.notes).trim() !== '' && (
        <div className="border border-black p-1 bg-white text-right" style={{ marginBottom: '4px', fontSize: '11px', flexShrink: 0 }}>
          <div className="font-bold" style={{ marginBottom: '2px' }}>ملاحظات:</div>
          <div style={{ lineHeight: '1.2' }}>{order.notes}</div>
        </div>
      )}

      {/* Employee & Page (moved below notes) */}
      <div className="flex flex-col border-t border-b border-dashed border-black bg-slate-50" style={{ padding: '2px 4px', marginBottom: '4px', fontSize: '9px', flexShrink: 0, gap: '1px' }}>
        <div>الموظف: <span className="font-bold">{getUserDisplayName(order.employee || order.employee_raw || order.employeeName || order.employee_name)}</span></div>
        <div>البيدج: <span className="font-bold">{pageDisplay}</span></div>
      </div>

      {/* Policy */}
      <div className="border border-black p-1 text-center" style={{ marginTop: 'auto', flexShrink: 0 }}>
        <p className="font-bold" style={{ fontSize: '10px', margin: '0 0 2px 0' }}>سياسة الشركه</p>
        <p className="font-medium" style={{ fontSize: '9px', lineHeight: '1.2', margin: '0' }}>{terms}</p>
      </div>
    </div>
  );
};

export const PrintableOrders: React.FC<{
  orders: any[];
  companyName?: string;
  companyPhone?: string;
  terms?: string;
  companyLogo?: string | null;
  companyAddress?: string;
  users?: any[];
  templateId?: number | string;
}> = ({ orders, companyName, companyPhone, terms, companyLogo, companyAddress, users, templateId }) => {
  const currentTemplate = Number(templateId || getSelectedTemplateId() || 1);
  const compName = companyName || (typeof window !== 'undefined' ? (localStorage.getItem('Dragon_company_name') || 'اسم الشركة') : 'اسم الشركة');
  const compPhone = companyPhone || (typeof window !== 'undefined' ? (localStorage.getItem('Dragon_company_phone') || '') : '');
  const compTerms = terms || (typeof window !== 'undefined' ? (localStorage.getItem('Dragon_company_terms') || 'المعاينة حق للعميل قبل الاستلام.') : 'المعاينة حق للعميل قبل الاستلام.');
  const compAddress = companyAddress || (typeof window !== 'undefined' ? (localStorage.getItem('Dragon_company_address') || '') : '');
  const compLogo = companyLogo !== undefined ? companyLogo : (typeof window !== 'undefined' ? (localStorage.getItem('Dragon_company_logo_url') || localStorage.getItem('Dragon_company_logo')) : null);

  const chunks: any[][] = [];
  for (let i = 0; i < (orders || []).length; i += 4) {
    chunks.push(orders.slice(i, i + 4));
  }

  const content = (
    <div id="print-container" className="print-root">
      <style>{`
        @media screen {
          #print-container {
            display: none !important;
          }
        }
        @media print {
          @page {
            size: A4 portrait;
            margin: 0;
          }
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            height: auto !important;
            min-height: 0 !important;
            width: 100% !important;
            background: #fff !important;
            overflow: visible !important;
          }
          #root {
            display: none !important;
          }
          #print-container {
            display: block !important;
            visibility: visible !important;
            position: static !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          .print-a4-page {
            width: 210mm;
            height: 296mm;
            max-height: 296mm;
            padding: 2.5mm;
            box-sizing: border-box;
            display: grid;
            grid-template-columns: 1fr 1fr;
            grid-template-rows: 1fr 1fr;
            gap: 2mm;
            page-break-inside: avoid;
            break-inside: avoid;
            page-break-after: auto;
            break-after: auto;
            overflow: hidden;
          }
          .print-a4-page:not(:last-child) {
            page-break-after: always;
            break-after: page;
          }
          .quarter-a4-cell {
            width: 100%;
            height: 100%;
            box-sizing: border-box;
            overflow: hidden;
            page-break-inside: avoid;
            break-inside: avoid;
            display: flex;
            flex-direction: column;
          }
          * { 
            -webkit-print-color-adjust: exact !important; 
            print-color-adjust: exact !important;
            color-adjust: exact !important;
          }
        }
      `}</style>
      <div>
        {chunks.map((chunk, pageIdx) => (
          <div key={pageIdx} className="print-a4-page">
            {chunk.map((order: any, orderIdx: number) => (
              <div key={order.id || orderIdx} className="quarter-a4-cell">
                <UniversalWaybill
                  order={order}
                  companyName={compName}
                  companyPhone={compPhone}
                  companyAddress={compAddress}
                  terms={compTerms}
                  companyLogo={compLogo}
                  templateId={currentTemplate}
                  users={users}
                />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );

  if (typeof document !== 'undefined') {
    return createPortal(content, document.body);
  }
  return content;
};
