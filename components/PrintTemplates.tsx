import React from 'react';
import Barcode from './Barcode';

export const PrintableContent: React.FC<{ order: any, companyName: string, companyPhone: string, terms: string }> = ({ order, companyName, companyPhone, terms }) => {
    const productRows = order.products && order.products.length > 0 
      ? order.products 
      : [{ name: '', quantity: '', price: '', total: '' }];

    const computedRows = productRows.map((p:any) => {
      const price = Number(p.price || 0);
      const qty = Number(p.quantity || p.qty || 0);
      const lineTotal = (p.total !== undefined && p.total !== null && Number(p.total) !== 0) ? Number(p.total) : price * qty;
      return { ...p, price, quantity: qty, lineTotal };
    });

    const computedSubtotal = computedRows.reduce((s:any, r:any) => s + (r.lineTotal || 0), 0);
    const shippingVal = Number(order.shipping || order.shippingCost || 0);
    const discountType = (order.discountType || order.discount_type) || null;
    const discountValue = Number(order.discountValue || order.discount_value || 0);
    const taxType = (order.taxType || order.tax_type) || null;
    const taxValue = Number(order.taxValue || order.tax_value || 0);
    const computedTotal = (order.total && Number(order.total) > 0) ? Number(order.total) : (computedSubtotal + shippingVal);

    const emptyRowsCount = 0;
    const salesDisplayMethod = (localStorage.getItem('Dragon_sales_display_method') || 'company').toString();
    const companyLogo = localStorage.getItem('Dragon_company_logo') || '';
    const currentDate = new Date().toISOString().split('T')[0];

    // Prefer raw/script-supplied employee/page fields when available
    const employeeDisplay = (order && (order.employee || order.employeeName || order.employee_name || order.employeeFullName || order.created_by_name || order.created_by || order.created_by_display || order.created_by_username)) || 'Admin';
    const pageDisplay = (order && (order.page || order.pageName || order.page_name || order.page_number || order.page_no || order.source)) || '-';

    return (
      <div className="flex flex-col bg-white text-black font-sans box-border relative p-1" style={{ direction: 'rtl', fontSize: '28px', flex: 1, minHeight: 0 }}>
            {/* <div className="flex items-center justify-between mb-1 w-full" style={{ direction: 'ltr' }}>
              <div className="w-1/4 flex flex-col items-center justify-center" style={{ direction: 'ltr' }}>
                <Barcode value={order.orderNumber} className="h-20" height={64} width={2} />
                <div className="text-sm mt-1 text-center font-bold tracking-widest">{order.orderNumber}</div>
              </div>
              <div className="w-1/2 flex flex-col items-center">
                {companyLogo ? (
                  <img src={companyLogo} alt="logo" className="h-36 mb-1 object-contain" />
                ) : (
                  <h1 className="font-black text-xl mb-1">{companyName}</h1>
                )}
              </div>
              <div className="w-1/4 text-right" style={{ direction: 'rtl' }}>
                <h1 className="font-black text-lg">{companyName}</h1>
                <p className="text-base font-bold mt-1">{companyPhone}</p>
              </div>
            </div> */}
{/* Header: left=logo, center=barcode, right=company name+phone */}
            <div className="flex items-center justify-between mb-2 w-full border-b-2 border-black pb-2" style={{ direction: 'ltr' }}>
              
              {/* اللوجو (يسار) */}
              <div className="w-1/4 flex flex-col items-start justify-center">
                {/* لو عندك متغير للوجو companyLogo جاهز استخدمه، أو هيطبع اسم الشركة كبديل */}
                {typeof companyLogo !== 'undefined' && companyLogo ? (
                  <img src={companyLogo} alt="logo" className="h-20 max-w-full object-contain" />
                ) : (
                  <h1 className="font-black text-lg">{companyName}</h1>
                )}
              </div>

              {/* الباركود ورقم الفاتورة (في المنتصف) */}
              <div className="w-1/2 flex flex-col items-center justify-center">
                <Barcode value={order.orderNumber || order.order_number || ''} className="h-16" height={56} width={2} />
                <div className="text-sm mt-1 text-center font-bold tracking-widest">
                  {order.orderNumber || order.order_number}
                </div>
              </div>

              {/* بيانات الشركة (يمين) */}
              <div className="w-1/4 text-right" style={{ direction: 'rtl' }}>
                <h1 className="font-black text-xl leading-tight">{companyName}</h1>
                <p className="text-sm font-bold mt-1 dir-ltr">{companyPhone}</p>
              </div>
              
            </div>
            <div className="text-right mb-1">
                <p className="text-base font-bold">التاريخ: {currentDate}</p>
            </div>

            <div className="w-full border-b-2 border-black border-dashed my-1"></div>

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
                         <span className="font-bold text-base font-mono">{order.phone1 || order.phone}</span>
                    </div>
                    <div className="text-left">
                         <span className="font-bold text-base font-mono">{order.phone2}</span>
                    </div>
                </div>
                <div className="text-right">
                    <span className="font-bold text-base leading-tight">{order.address}</span>
                </div>
            </div>

            <div className="border-2 border-black mb-1">
              <table className="w-full text-center text-base border-collapse" style={{ fontSize: '32px' }}>
                    <thead>
                        <tr className="bg-slate-200 border-b-2 border-black">
                    <th className="border-l border-black p-1">المنتج</th>
                    <th className="border-l border-black p-1 w-20">السعر</th>
                    <th className="border-l border-black p-1 w-16">الكمية</th>
                    <th className="p-1 w-24">الإجمالي</th>
                        </tr>
                    </thead>
                    <tbody>
                        {computedRows.map((p: any, i: number) => (
                          <tr key={i} className="border-b border-black">
                              <td className="border-l border-black p-1 text-right" style={{ fontSize: '36px', fontWeight: 800 }}>{p.name} <span style={{ fontSize: '18px', fontWeight: 600, color: '#555' }}> - اللون: {p.color || '-'} - المقاس: {p.size || '-'}</span></td>
                              <td className="border-l border-black p-1" style={{ fontSize: '28px', fontWeight: 800 }}>{p.price.toLocaleString()}</td>
                              <td className="border-l border-black p-1" style={{ fontSize: '28px', fontWeight: 800 }}>{p.quantity}</td>
                              <td className="p-1" style={{ fontSize: '28px', fontWeight: 800 }}>{(p.lineTotal || 0).toLocaleString()}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <div className="flex justify-between text-xs mb-2 px-1">
              <p><span className="text-base font-bold">الموظف:</span> {employeeDisplay}</p>
              <p><span className="text-base font-bold">البيدج:</span> {pageDisplay}</p>
            </div>

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

            <div className="border-2 border-black p-1 text-center mt-auto">
              <p className="font-bold text-base mb-0.5">سياسة الشركه</p>
              <p className="text-base font-medium leading-tight">{terms}</p>
            </div>

        </div>
    );
};

export const PrintableOrders: React.FC<{ orders: any[] }> = ({ orders }) => {
  const companyName = localStorage.getItem('Dragon_company_name') || 'اسم الشركة';
  const companyPhone = localStorage.getItem('Dragon_company_phone') || '01000000000';
  const companyTerms = localStorage.getItem('Dragon_company_terms') || 'المعاينة حق للعميل قبل الاستلام.';

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
                              /* Use clearer font and larger print font size for printable container */
                              #print-container, #print-container * { font-family: 'Noto Sans Arabic', 'Noto Naskh Arabic', Arial, sans-serif !important; font-size: 28px !important; }
                              /* Allow content to flow naturally and avoid forcing fixed heights which can create blank pages */
                              .print-page { page-break-after: always; page-break-inside: avoid; break-inside: avoid; }
                              .print-page:last-child { page-break-after: auto; }
                  * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
              }
              `}
          </style>
          {chunks.map((chunk, idx) => (
            <div key={idx} className="print-page" style={{ padding: '0.3cm' }}>
              <div className="grid grid-cols-2 gap-4" style={{ gridTemplateRows: '1fr 1fr' }}>
                {chunk.map((order: any) => (
                  <div key={order.id} className="break-inside-avoid border border-slate-300" style={{ overflow: 'visible' }}>
                    <PrintableContent order={order} companyName={companyName} companyPhone={companyPhone} terms={companyTerms} />
                  </div>
                ))}
              </div>
            </div>
          ))}
      </div>
  );
};

// Print one order per A4 page (used for shipping-labels single-per-page)
export const PrintableOrdersSingle: React.FC<{ orders: any[] }> = ({ orders }) => {
  const companyName = localStorage.getItem('Dragon_company_name') || 'اسم الشركة';
  const companyPhone = localStorage.getItem('Dragon_company_phone') || '01000000000';
  const companyTerms = localStorage.getItem('Dragon_company_terms') || 'المعاينة حق للعميل قبل الاستلام.';

  return (
    <div id="print-container" className="hidden">
      <style>{`
        @media print {
          body { visibility: hidden; margin: 0; padding: 0; }
          #print-container { display: block !important; visibility: visible !important; position: absolute; top: 0; left: 0; width: 100%; }
          @page { size: A4; margin: 0.5cm; }
          /* Use clearer font and larger print font size for printable container */
          #print-container, #print-container * { font-family: 'Noto Sans Arabic', 'Noto Naskh Arabic', Arial, sans-serif !important; font-size: 28px !important; }
          /* Avoid fixed heights for pages to prevent browsers adding blank trailing pages */
          .print-page { width: 100%; padding: 0.5cm; box-sizing: border-box; page-break-after: always; page-break-inside: avoid; break-inside: avoid; }
          .print-page:last-child { page-break-after: auto; }
          * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>
      {orders.map((order: any) => (
        <div key={order.id || order.orderNumber || Math.random()} className="print-page" style={{ padding: '0.3cm' }}>
          <div className="print-wrapper" style={{ minHeight: 0 }}>
            <div className="print-content" style={{ minHeight: 0 }}>
              <PrintableContent order={order} companyName={companyName} companyPhone={companyPhone} terms={companyTerms} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};
