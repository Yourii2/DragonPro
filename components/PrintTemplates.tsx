import React, { useEffect, useState } from 'react';
import { API_BASE_PATH } from '../services/apiConfig';
import { assetUrl } from '../services/assetUrl';
import { PrintableContent, PrintableOrders } from './PrintableOrderCard';

export { PrintableContent, PrintableOrders };

// Print one order per A4 page (used for shipping-labels single-per-page)
export const PrintableOrdersSingle: React.FC<{ orders: any[] }> = ({ orders }) => {
  const [companyName, setCompanyName] = useState<string>(localStorage.getItem('Dragon_company_name') || 'اسم الشركة');
  const [companyPhone, setCompanyPhone] = useState<string>(localStorage.getItem('Dragon_company_phone') || '01000000000');
  const [companyTerms, setCompanyTerms] = useState<string>(localStorage.getItem('Dragon_company_terms') || 'المعاينة حق للعميل قبل الاستلام.');
  const [companyAddress, setCompanyAddress] = useState<string>(localStorage.getItem('Dragon_company_address') || '');
  const [companyLogo, setCompanyLogo] = useState<string | null>(
    (typeof window !== 'undefined' ? (localStorage.getItem('Dragon_company_logo_url') || localStorage.getItem('Dragon_company_logo')) : null) || assetUrl('Dragon.png')
  );

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`${API_BASE_PATH}/get_settings.php`);
        const j = await r.json().catch(() => null);
        if (j && j.success && j.data) {
          const s = j.data;
          if (s.company_name) setCompanyName(s.company_name);
          if (s.company_phone) setCompanyPhone(s.company_phone);
          if (s.company_terms) setCompanyTerms(s.company_terms);
          if (s.company_address) setCompanyAddress(s.company_address);
          if (s.company_logo_url) setCompanyLogo(s.company_logo_url);
          else if (s.company_logo) setCompanyLogo(s.company_logo);
        }
      } catch (e) { console.debug('Failed to load print settings', e); }
    })();
  }, []);

  return (
    <div id="print-container" className="hidden">
      <style>{`
        @media print {
          body { visibility: hidden; margin: 0; padding: 0; }
          #print-container { display: block !important; visibility: visible !important; position: absolute; top: 0; left: 0; width: 100%; }
          @page { size: A4; margin: 0.5cm; }
          .print-page { width: 100%; padding: 0.5cm; box-sizing: border-box; page-break-after: always; page-break-inside: avoid; break-inside: avoid; }
          .print-page:last-child { page-break-after: auto; }
          * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>
      {orders.map((order: any) => (
        <div key={order.id || order.orderNumber || Math.random()} className="print-page" style={{ padding: '0.3cm' }}>
          <div className="print-wrapper" style={{ minHeight: 0 }}>
            <div className="print-content" style={{ minHeight: 0 }}>
              <PrintableContent order={order} companyName={companyName} companyPhone={companyPhone} companyAddress={companyAddress} terms={companyTerms} companyLogo={companyLogo} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};
