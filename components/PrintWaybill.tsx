import React, { useEffect, useState } from 'react';
import { API_BASE_PATH } from '../services/apiConfig';
import { assetUrl } from '../services/assetUrl';
import { UniversalPrintableOrders, getSelectedTemplateId } from './UniversalWaybillRenderer';

const PrintWaybill: React.FC = () => {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [companyName, setCompanyName] = useState<string>('');
  const [companyPhone, setCompanyPhone] = useState<string>('');
  const [companyTerms, setCompanyTerms] = useState<string>('');
  const [companyLogo, setCompanyLogo] = useState<string | null>(null);
  const [companyAddress, setCompanyAddress] = useState<string>('');

  useEffect(() => {
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
    let compName = q.get('companyName') || localStorage.getItem('Dragon_company_name') || '';
    let compPhone = q.get('companyPhone') || localStorage.getItem('Dragon_company_phone') || '';
    let compTerms = q.get('companyTerms') || localStorage.getItem('Dragon_company_terms') || '';
    let compLogo = q.get('companyLogo') || (typeof window !== 'undefined' ? (localStorage.getItem('Dragon_company_logo_url') || localStorage.getItem('Dragon_company_logo')) : null) || assetUrl('Dragon.png');
    let compAddress = q.get('companyAddress') || localStorage.getItem('Dragon_company_address') || '';

    const ids = idsParam ? idsParam.split(',').map(s => s.trim()).filter(Boolean) : [];

    (async () => {
      try {
        const sv = await fetch(`${API_BASE_PATH}/get_settings.php`).then(r => r.json()).catch(() => null);
        if (sv && sv.success && sv.data) {
          if (!compName && sv.data.company_name) compName = sv.data.company_name;
          if (!compPhone && sv.data.company_phone) compPhone = sv.data.company_phone;
          if (!compTerms && sv.data.company_terms) compTerms = sv.data.company_terms;
          if (!compAddress && sv.data.company_address) compAddress = sv.data.company_address;
          if (!compLogo && sv.data.company_logo_url) compLogo = sv.data.company_logo_url;
          else if (!compLogo && sv.data.company_logo) compLogo = sv.data.company_logo;
        }
      } catch (e) {
        // ignore
      }

      setCompanyName(compName);
      setCompanyPhone(compPhone);
      setCompanyTerms(compTerms);
      setCompanyLogo(compLogo);
      setCompanyAddress(compAddress);

      if (ids.length === 0) {
        const sample = {
          id: 'SAMPLE-1',
          orderNumber: 'SAMPLE-1',
          customerName: 'عميل تجريبي',
          phone1: '01012345678',
          phone2: '',
          governorate: 'القاهرة',
          address: 'شارع الاختبار، عمارة 12',
          employee: 'Admin',
          page: 'الفرع الرئيسي',
          products: [ 
            { name: 'منتج أ', color: 'أحمر', size: 'M', qty: 2, price: 150, total: 300 }, 
            { name: 'منتج ب', color: 'أزرق', size: 'L', qty: 1, price: 200, total: 200 } 
          ],
          shipping: 50,
          total: 550,
          notes: 'ملاحظة تجريبية'
        };
        setOrders([sample]);
        setLoading(false);
        setTimeout(() => window.print(), 600);
        return;
      }

      try {
        const fetched: any[] = [];
        for (const id of ids) {
          try {
            const r = await fetch(`${API_BASE_PATH}/api.php?module=orders&action=get&id=${encodeURIComponent(id)}`);
            const j = await r.json();
            if (j && j.success && j.data) {
              fetched.push(j.data);
            } else {
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
        setTimeout(() => window.print(), 700);
      }
    })();
  }, []);

  if (loading) {
    return <div style={{ padding: 40, textAlign: 'center', fontFamily: 'Cairo, sans-serif' }}>جارٍ تجهيز الفواتير للطباعة...</div>;
  }

  return (
    <UniversalPrintableOrders
      orders={orders}
      companyName={companyName}
      companyPhone={companyPhone}
      companyAddress={companyAddress}
      companyLogo={companyLogo}
      terms={companyTerms}
      templateId={getSelectedTemplateId()}
    />
  );
};

export default PrintWaybill;
