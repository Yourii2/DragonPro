import React, { useEffect, useState } from 'react';
import { API_BASE_PATH } from '../services/apiConfig';

// Local Code128 generator ported to JS. Produces an inline SVG string.
function code128Svg(text: string, options: { height?: number; scale?: number; barWidth?: number } = {}) {
  const height = options.height ?? 40;
  const scale = options.scale ?? 1.0;
  const barWidth = options.barWidth ?? 0.35;

  const patterns = [
    '212222','222122','222221','121223','121322','131222','122213','122312','132212','221213',
    '221312','231212','112232','122132','122231','113222','123122','123221','223211','221132',
    '221231','213212','223112','312131','311222','321122','321221','312212','322112','322211',
    '212123','212321','232121','111323','131123','131321','112313','132113','132311','211313',
    '231113','231311','112133','112331','132131','113123','113321','133121','313121','211331',
    '231131','213113','213311','213131','311123','311321','331121','312113','312311','332111',
    '314111','221411','431111','111224','111422','121124','121421','141122','141221','112214',
    '112412','122114','122411','142112','142211','241211','221114','413111','241112','134111',
    '111242','121142','121241','114212','124112','124211','411212','421112','421211','212141',
    '214121','412121','111143','111341','131141','114113','114311','411113','411311','113141',
    '114131','311141','411131','211412','211214','211232','2331112'
  ];

  const patArr = patterns.map(p => p.split('').map(ch => parseInt(ch, 10)));

  const chars = text.split('');
  const values: number[] = [];
  for (const c of chars) {
    const ord = c.charCodeAt(0);
    const safe = (ord < 32 || ord > 127) ? 32 : ord;
    values.push(safe - 32);
  }

  const startCode = 104;
  let checksum = startCode;
  for (let i = 0; i < values.length; i++) checksum += values[i] * (i + 1);
  const checksumValue = checksum % 103;

  const sequence = [startCode, ...values, checksumValue, 106];

  const modules: number[] = [];
  for (const val of sequence) {
    if (!patArr[val]) continue;
    modules.push(...patArr[val]);
  }

  const totalModules = modules.reduce((s, v) => s + v, 0);
  const baseWidthPx = barWidth * scale;
  const svgWidth = totalModules * baseWidthPx;
  const svgHeight = Math.max(10, height);

  let x = 0;
  let rects = '';
  for (let i = 0; i < modules.length; i++) {
    const m = modules[i];
    const w = m * baseWidthPx;
    if (i % 2 === 0) {
      rects += `<rect x="${x.toFixed(2)}" y="0" width="${w.toFixed(2)}" height="${svgHeight}" fill="#000" />\n`;
    }
    x += w;
  }

  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${svgWidth.toFixed(2)}' height='${svgHeight}' viewBox='0 0 ${svgWidth.toFixed(2)} ${svgHeight}' preserveAspectRatio='xMidYMid meet'><g>${rects}</g></svg>`;
  return svg;
}

function svgDataUri(svg: string) {
  return 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg)));
}

interface ProductLine { name: string; color?: string; size?: string; qty: number; price: number }

const PageStyle = ({ children }: any) => (
  <div className="print-page" style={{ padding: '8mm', boxSizing: 'border-box', width: '210mm', height: '297mm', display: 'flex', flexDirection: 'column' }}>
    {children}
  </div>
);

const PrintWaybill: React.FC = () => {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Read ids from URL query string or from hash fragment (support #/print_waybill?ids=...)
    const parseQuery = (): URLSearchParams => {
      const search = window.location.search || '';
      if (search && search.length > 1) return new URLSearchParams(search);
      const hash = window.location.hash || '';
      const idx = hash.indexOf('?');
      if (idx !== -1) return new URLSearchParams(hash.substring(idx + 1));
      return new URLSearchParams('');
    };

    const q = parseQuery();
    const idsParam = q.get('ids') || q.get('id');
    const companyName = q.get('companyName') || '';
    const companyPhone = q.get('companyPhone') || '';
    const companyTerms = q.get('companyTerms') || '';

    const ids = idsParam ? idsParam.split(',').map(s => s.trim()).filter(Boolean) : [];
    if (ids.length === 0) {
      // render a mock sample page
      const sample = {
        id: 'SAMPLE-1',
        orderNumber: 'SAMPLE-1',
        customerName: 'عميل تجريبي',
        phone1: '01012345678',
        phone2: '',
        governorate: 'القاهرة',
        address: 'شارع الاختبار، عمارة 12',
        employee: 'Admin',
        page: 'A1',
        products: [ { name: 'منتج أ', color: 'أحمر', size: 'M', qty: 2, price: 150 }, { name: 'منتج ب', color: 'أزرق', size: 'L', qty: 1, price: 200 } ],
        shipping: 0,
        notes: 'ملاحظة تجريبية',
        companyName, companyPhone, companyTerms
      };
      setOrders([sample]);
      setLoading(false);
      setTimeout(() => window.print(), 800);
      return;
    }

    (async () => {
      try {
        const fetched: any[] = [];
        for (const id of ids) {
          try {
            const r = await fetch(`${API_BASE_PATH}/api.php?module=orders&action=get&id=${encodeURIComponent(id)}`);
            const j = await r.json();
            if (j && j.success && j.data) {
              const o = j.data;
              o.companyName = companyName || o.companyName || localStorage.getItem('Dragon_company_name') || '';
              o.companyPhone = companyPhone || o.companyPhone || localStorage.getItem('Dragon_company_phone') || '';
              o.companyTerms = companyTerms || o.companyTerms || localStorage.getItem('Dragon_company_terms') || '';
              fetched.push(o);
            } else {
              // fallback minimal object
              fetched.push({ id, orderNumber: id, customerName: 'غير معروف', phone1: '', governorate: '', address: '', products: [], shipping: 0, employee: '', page: '', notes: '' });
            }
          } catch (e) {
            fetched.push({ id, orderNumber: id, customerName: 'غير معروف', phone1: '', governorate: '', address: '', products: [], shipping: 0, employee: '', page: '', notes: '' });
          }
        }
        setOrders(fetched);
      } catch (e) {
        console.error('Failed to fetch orders', e);
      } finally {
        setLoading(false);
        setTimeout(() => window.print(), 600);
      }
    })();
  }, []);

  const renderProductsRows = (products: ProductLine[]) => {
    if (!products || products.length === 0) return (
      <tr><td colSpan={4} style={{ textAlign: 'center', padding: '12px' }}>لا توجد منتجات</td></tr>
    );
      return products.map((p, i) => (
      <tr key={i} className="product-row">
        <td className="prod-name" style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 36, fontWeight: 800 }}>{p.name}</div>
          <div style={{ fontSize: 18, color: '#555', fontWeight: 600 }}>اللون: {p.color || '-'} - المقاس: {p.size || '-'}</div>
        </td>
        <td style={{ textAlign: 'center', fontWeight: 800, fontSize: 28 }}>{Number(p.price || 0).toFixed(2)}</td>
        <td style={{ textAlign: 'center', fontWeight: 800, fontSize: 28 }}>{p.qty}</td>
        <td style={{ textAlign: 'center', fontWeight: 800, fontSize: 28 }}>{(Number(p.price || 0) * Number(p.qty || 0)).toFixed(2)}</td>
      </tr>
    ));
  };

  return (
    <div dir="rtl" style={{ fontFamily: 'Noto Naskh Arabic, Arial, sans-serif' }}>
      <style>{`
        @page { size: 210mm 297mm; margin: 0; }
        @media print {
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .print-page { page-break-after: always; }
          .print-page:last-child { page-break-after: auto; }
        }
        .company { display:flex; flex-direction:column; gap:6px }
        .governorate-box { background:#000; color:#fff; padding:6px 10px; font-size:22px; font-weight:800; border-radius:6px; text-align:center; min-width:110px }
        table.products-table { width:100%; border-collapse:collapse; font-size:32px }
        table.products-table th { background:#f3f4f6; padding:8px; border:1px solid #111; text-align:right; font-weight:700 }
        table.products-table td { padding:8px; border:1px solid #111; vertical-align:top }
        /* Ensure print container uses larger font when printing */
        @media print {
          #print-container, #print-container * { font-family: 'Noto Sans Arabic', 'Noto Naskh Arabic', Arial, sans-serif !important; font-size: 28px !important; }
        }
      `}</style>

      {loading ? <div style={{ padding: 20, textAlign: 'center' }}>جارٍ التحضير للطباعة...</div> : (
        <div id="print-container">
          {orders.map((order, idx) => {
            const svg = code128Svg(String(order.orderNumber || order.id || ''), { height: 40, scale: 1.0, barWidth: 0.35 });
            const barcodeData = svgDataUri(svg);
            const products: ProductLine[] = (order.products || order.importedProducts || order.items || []).map((p: any) => ({ name: p.name || p.product_name || '', color: p.color || '', size: p.size || '', qty: Number(p.quantity || p.qty || p.qty || p.qty2 || 0), price: Number(p.price || p.unit_price || p.sale_price || 0) }));
            const subtotal = products.reduce((s, p) => s + (p.qty * (p.price || 0)), 0);
            const shipping = Number(order.shipping || order.shippingCost || order.shipping_cost || 0) || 0;
            const grand = subtotal + shipping;
            const companyName = order.companyName || localStorage.getItem('Dragon_company_name') || 'اسم الشركة';
            const companyPhone = order.companyPhone || localStorage.getItem('Dragon_company_phone') || '';
            const companyTerms = order.companyTerms || localStorage.getItem('Dragon_company_terms') || '';

            const employeeDisplay = order.employee || order.employeeName || order.employee_name || order.created_by_name || order.created_by || '';
            const pageDisplay = order.page || order.pageName || order.page_name || order.page_number || order.page_no || order.source || '';

            return (
              <PageStyle key={idx}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div className="company" style={{ flex: 1 }}>
                    <div style={{ fontWeight: 800, fontSize: 18 }}>{companyName}</div>
                    <div style={{ fontWeight: 700 }}>{companyPhone}</div>
                    <div style={{ fontSize: 12, color: '#666' }}>{companyTerms}</div>
                  </div>

                  <div style={{ flex: '0 0 160px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                    <img src={barcodeData} alt="barcode" style={{ width: '100%', maxWidth: 160, height: 'auto' }} />
                    <div style={{ fontWeight: 700, fontSize: 13 }}>{order.orderNumber || order.id}</div>
                  </div>

                  <div style={{ flex: 1, border: '1px solid #111', padding: 8, borderRadius: 6 }}>
                    <div style={{ fontWeight: 700 }}>{order.customerName || order.customer || 'عميل'}</div>
                    <div style={{ fontSize: 13, color: '#333' }}>{order.phone1 || order.phone || ''} {order.phone2 || ''}</div>
                    <div style={{ fontSize: 12, color: '#666', marginTop: 6 }}>{order.address || ''}</div>
                    <div style={{ marginTop: 8 }} className="governorate-box">{order.governorate || ''}</div>
                    <div style={{ marginTop: 8, display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
                      <div style={{ fontSize: 30, fontWeight: 800 }}><strong>الموظف:</strong>&nbsp;{employeeDisplay}</div>
                      <div style={{ fontSize: 30, fontWeight: 800 }}><strong>البيدج:</strong>&nbsp;{pageDisplay}</div>
                    </div>
                  </div>
                </div>

                <div style={{ marginTop: 6, flex: '0 1 auto' }}>
                  <table className="products-table" role="table">
                    <thead>
                      <tr><th style={{ width: '50%' }}>المنتج</th><th style={{ width: '15%' }}>السعر</th><th style={{ width: '10%' }}>الكمية</th><th style={{ width: '15%' }}>الإجمالي</th></tr>
                    </thead>
                    <tbody>
                      {renderProductsRows(products)}
                    </tbody>
                  </table>
                </div>

                <div style={{ marginTop: 8, display: 'flex', justifyContent: 'flex-end', gap: 12, alignItems: 'center' }}>
                  <div style={{ border: '1px solid #111', padding: '8px 12px', borderRadius: 6, background: '#f8fafc', fontWeight: 800 }}>شحن: {shipping.toFixed(2)} ج.م</div>
                  <div style={{ border: '1px solid #111', padding: '8px 12px', borderRadius: 6, background: '#f8fafc', fontWeight: 800 }}>إجمالي قطع: {products.reduce((s,p)=>s+p.qty,0)}</div>
                  <div style={{ border: '1px solid #111', padding: '8px 12px', borderRadius: 6, background: '#f8fafc', fontWeight: 800 }}>الإجمالي: {grand.toFixed(2)} ج.م</div>
                </div>

                <div style={{ marginTop: 'auto', borderTop: '1px solid #ddd', paddingTop: 8, textAlign: 'center', fontSize: 12 }}>{companyTerms}</div>
              </PageStyle>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default PrintWaybill;
