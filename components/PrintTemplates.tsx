import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { API_BASE_PATH } from '../services/apiConfig';
import { assetUrl } from '../services/assetUrl';
import { PrintableContent, PrintableOrders } from './PrintableOrderCard';
import { UniversalWaybill, getSelectedTemplateId } from './UniversalWaybillRenderer';

export { PrintableContent, PrintableOrders };

// Print one order per A4 page (used for shipping-labels single-per-page)
export const PrintableOrdersSingle: React.FC<{ orders: any[]; templateId?: number | string }> = ({ orders, templateId }) => {
  const [companyName, setCompanyName] = useState<string>(localStorage.getItem('Dragon_company_name') || 'اسم الشركة');
  const [companyPhone, setCompanyPhone] = useState<string>(localStorage.getItem('Dragon_company_phone') || '01000000000');
  const [companyTerms, setCompanyTerms] = useState<string>(localStorage.getItem('Dragon_company_terms') || 'المعاينة حق للعميل قبل الاستلام.');
  const [companyAddress, setCompanyAddress] = useState<string>(localStorage.getItem('Dragon_company_address') || '');
  const [companyLogo, setCompanyLogo] = useState<string | null>(
    (typeof window !== 'undefined' ? (localStorage.getItem('Dragon_company_logo_url') || localStorage.getItem('Dragon_company_logo')) : null) || assetUrl('Dragon.png')
  );
  const [activeTemplate, setActiveTemplate] = useState<number>(() => Number(templateId || getSelectedTemplateId() || 1));

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
          if (s.waybill_template) {
            const id = Number(s.waybill_template);
            if (id >= 1 && id <= 21) {
              setActiveTemplate(id);
              localStorage.setItem('Dragon_waybill_template', String(id));
            }
          }
        }
      } catch (e) { console.debug('Failed to load print settings', e); }
    })();
  }, []);

  const currentTemplate = Number(templateId || activeTemplate || 1);

  const content = (
    <div id="print-container" className="hidden">
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
          .print-page {
            width: 210mm;
            height: 296mm;
            max-height: 296mm;
            padding: 4mm;
            box-sizing: border-box;
            page-break-inside: avoid;
            break-inside: avoid;
            page-break-after: auto;
            break-after: auto;
            overflow: hidden;
          }
          .print-page:not(:last-child) {
            page-break-after: always;
            break-after: page;
          }
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            color-adjust: exact !important;
          }
        }
      `}</style>
      <div>
        {orders.map((order: any) => (
          <div key={order.id || order.orderNumber || Math.random()} className="print-page">
            <div className="print-wrapper" style={{ minHeight: 0, height: '100%' }}>
              <div className="print-content" style={{ minHeight: 0, height: '100%' }}>
                {currentTemplate === 1 ? (
                  <PrintableContent order={order} companyName={companyName} companyPhone={companyPhone} companyAddress={companyAddress} terms={companyTerms} companyLogo={companyLogo} />
                ) : (
                  <UniversalWaybill order={order} companyName={companyName} companyPhone={companyPhone} companyAddress={companyAddress} terms={companyTerms} companyLogo={companyLogo} templateId={currentTemplate} />
                )}
              </div>
            </div>
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
