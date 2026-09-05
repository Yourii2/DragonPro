/**
 * WaybillTemplatesManager.tsx
 * Management page for browsing, previewing, and selecting from 20 distinct waybill templates.
 */
import React, { useState, useEffect } from 'react';
import Swal from 'sweetalert2';
import { 
  CheckCircle2, 
  Printer, 
  Eye, 
  LayoutTemplate, 
  Sparkles,
  Layers,
  FileCheck
} from 'lucide-react';
import { 
  WAYBILL_TEMPLATES_INFO, 
  UniversalWaybill, 
  getSelectedTemplateId,
  UniversalPrintableOrders 
} from './UniversalWaybillRenderer';
import { API_BASE_PATH } from '../services/apiConfig';
import { assetUrl } from '../services/assetUrl';

const MOCK_ORDER = {
  id: 101,
  orderNumber: '10845',
  order_number: '10845',
  customerName: 'أحمد محمود السعيد',
  phone1: '01012345678',
  phone2: '01198765432',
  governorate: 'القاهرة - مدينة نصر',
  address: 'شارع عباس العقاد - عمارة 14 - الدور الثالث شقة 6',
  notes: 'يرجى الاتصال قبل الوصول بنصف ساعة. العميل يطلب المعاينة.',
  created_at: new Date().toISOString(),
  products: [
    { name: 'قميص قطن أكسفورد كلاسيك', color: 'أزرق سماوي', size: 'XL', qty: 2, price: 450, total: 900 },
    { name: 'بنطلون جينز سليم فيت', color: 'كحلي غامق', size: '34', qty: 1, price: 650, total: 650 },
    { name: 'حزام جلد طبيعي', color: 'أسود', size: 'L', qty: 1, price: 200, total: 200 }
  ],
  shipping: 50,
  discount_amount: 50,
  tax_amount: 0,
  total: 1750,
  employee: 'أحمد علي',
  page: 'صفحة فيسبوك الرئيسية'
};

const WaybillTemplatesManager: React.FC = () => {
  const [selectedId, setSelectedId] = useState<number>(() => getSelectedTemplateId());
  const [previewId, setPreviewId] = useState<number>(() => getSelectedTemplateId());
  const [loading, setLoading] = useState<boolean>(false);
  const [printOrder, setPrintOrder] = useState<any[] | null>(null);

  const companyName = localStorage.getItem('Dragon_company_name') || 'شركة دراجون برو للتجارة';
  const companyPhone = localStorage.getItem('Dragon_company_phone') || '01000000000';
  const companyAddress = localStorage.getItem('Dragon_company_address') || 'القاهرة، جمهورية مصر العربية';
  const companyLogo = (typeof window !== 'undefined' ? (localStorage.getItem('Dragon_company_logo_url') || localStorage.getItem('Dragon_company_logo')) : null) || assetUrl('Dragon.png');
  const companyTerms = localStorage.getItem('Dragon_company_terms') || 'تعتبر هذه البوليصة مستند استلام رسمي. يرجى التأكد من سلامة المنتجات.';

  useEffect(() => {
    // Load from settings API or localStorage
    const loadSaved = async () => {
      try {
        const res = await fetch(`${API_BASE_PATH}/get_settings.php?_t=${Date.now()}`);
        const json = await res.json();
        if (json?.success && json?.data?.waybill_template) {
          const id = Number(json.data.waybill_template);
          if (id >= 1 && id <= 50) {
            setSelectedId(id);
            setPreviewId(id);
            localStorage.setItem('Dragon_waybill_template', String(id));
          }
        }
      } catch (e) {}
    };
    loadSaved();
  }, []);

  const handleSelectTemplate = async (templateId: number) => {
    setLoading(true);
    try {
      localStorage.setItem('Dragon_waybill_template', String(templateId));
      setSelectedId(templateId);

      // Save to database settings table via save_settings.php
      await fetch(`${API_BASE_PATH}/save_settings.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'waybill_template', value: String(templateId) })
      }).catch(() => null);

      Swal.fire({
        title: 'تم تفعيل النموذج بنجاح!',
        text: `تم تعيين "${WAYBILL_TEMPLATES_INFO.find(t => t.id === templateId)?.name}" كنموذج افتراضي لجميع بوالص الشحن والفواتير.`,
        icon: 'success',
        timer: 2000,
        showConfirmButton: false
      });
    } catch (e) {
      Swal.fire('خطأ', 'فشل حفظ النموذج في الإعدادات.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleTestPrint = (templateId: number) => {
    setPrintOrder([MOCK_ORDER]);
    setTimeout(() => {
      window.print();
      setTimeout(() => setPrintOrder(null), 1000);
    }, 300);
  };

  return (
    <div className="p-4 md:p-8 space-y-8 animate-in fade-in" dir="rtl">
      {/* Hidden printable container for test printing */}
      {printOrder && (
        <UniversalPrintableOrders
          orders={printOrder}
          companyName={companyName}
          companyPhone={companyPhone}
          companyAddress={companyAddress}
          companyLogo={companyLogo}
          terms={companyTerms}
          templateId={previewId}
        />
      )}

      {/* Header Banner */}
      <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white p-6 md:p-8 rounded-3xl shadow-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-500/20 backdrop-blur rounded-2xl border border-blue-400/30">
              <LayoutTemplate className="w-8 h-8 text-blue-300" />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight">نماذج وقوالب بوالص الشحن والفواتير</h1>
              <p className="text-sm text-blue-200">اختر من بين 50 قالباً مختلفاً كلياً في التنسيق والهيكل بما يمنح شركتك هوية فريدة أمام العملاء والمناديب.</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3 bg-white/10 backdrop-blur px-4 py-2 rounded-2xl border border-white/20">
          <Sparkles className="w-5 h-5 text-amber-300" />
          <span className="text-sm font-bold">النموذج النشط حالياً: </span>
          <span className="bg-amber-400 text-slate-950 px-3 py-0.5 rounded-full font-black text-xs">
            نموذج رقم {selectedId} ({WAYBILL_TEMPLATES_INFO.find(t => t.id === selectedId)?.name})
          </span>
        </div>
      </div>

      {/* Main Grid & Preview Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Side: Template Selector Cards (5 Cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
              <Layers className="w-5 h-5 text-blue-500" /> قائمة القوالب المتوفرة (50 قالباً)
            </h2>
          </div>
          
          <div className="space-y-3 max-h-[750px] overflow-y-auto pr-1">
            {WAYBILL_TEMPLATES_INFO.map((item) => {
              const isCurrent = selectedId === item.id;
              const isPreviewing = previewId === item.id;
              return (
                <div
                  key={item.id}
                  onClick={() => setPreviewId(item.id)}
                  className={`p-4 rounded-2xl cursor-pointer border transition-all ${
                    isPreviewing
                      ? 'border-blue-600 bg-blue-50/60 dark:bg-blue-900/20 shadow-md ring-2 ring-blue-500/20'
                      : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <span className={`w-8 h-8 rounded-xl flex items-center justify-center font-black text-sm flex-shrink-0 ${
                        isCurrent
                          ? 'bg-emerald-600 text-white'
                          : isPreviewing
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                      }`}>
                        {item.id}
                      </span>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-sm text-slate-900 dark:text-white">{item.name}</h3>
                          {isCurrent && (
                            <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-black rounded-full flex items-center gap-1">
                              <CheckCircle2 size={10} /> المفعل
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{item.desc}</p>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Side: Live Interactive Preview (7 Cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <Eye className="w-5 h-5 text-blue-500" />
                  <h2 className="text-lg font-black text-slate-900 dark:text-white">
                    معاينة حية: {WAYBILL_TEMPLATES_INFO.find(t => t.id === previewId)?.name}
                  </h2>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">معاينة واقعية لشكل البوليصة كما ستخرج على الورق عند الطباعة.</p>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => handleTestPrint(previewId)}
                  className="flex-1 sm:flex-initial px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-xl font-bold text-xs hover:bg-slate-200 flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Printer size={15} /> طباعة تجريبية
                </button>
                <button
                  type="button"
                  disabled={loading || selectedId === previewId}
                  onClick={() => handleSelectTemplate(previewId)}
                  className={`flex-1 sm:flex-initial px-5 py-2 rounded-xl font-black text-xs flex items-center justify-center gap-1.5 shadow-lg transition-all ${
                    selectedId === previewId
                      ? 'bg-emerald-600 text-white cursor-default'
                      : 'bg-blue-600 text-white hover:bg-blue-700 shadow-blue-500/20'
                  }`}
                >
                  {selectedId === previewId ? (
                    <><CheckCircle2 size={15} /> النموذج الافتراضي المفعل</>
                  ) : (
                    <><FileCheck size={15} /> تفعيل هذا النموذج</>
                  )}
                </button>
              </div>
            </div>

            {/* Paper Simulator */}
            <div className="bg-slate-100 dark:bg-slate-950 p-4 md:p-6 rounded-2xl overflow-x-auto flex flex-col items-center border border-slate-200/60 dark:border-slate-800 space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-600 dark:text-slate-400 bg-white dark:bg-slate-900 px-3 py-1 rounded-full border border-slate-200 dark:border-slate-800 shadow-sm">
                <span>📄 مقاس ربع ورقة A4 (105×148 مم) — يتم طباعة 4 بوالص متجاورة في كل ورقة A4</span>
              </div>
              <div className="bg-white text-black shadow-2xl rounded-sm p-1 w-[370px] min-h-[480px] border border-gray-300 flex flex-col">
                <UniversalWaybill
                  order={MOCK_ORDER}
                  companyName={companyName}
                  companyPhone={companyPhone}
                  companyAddress={companyAddress}
                  companyLogo={companyLogo}
                  terms={companyTerms}
                  templateId={previewId}
                />
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default WaybillTemplatesManager;
