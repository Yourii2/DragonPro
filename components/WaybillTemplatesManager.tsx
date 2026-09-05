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
  FileCheck,
  Pencil
} from 'lucide-react';
import { 
  WAYBILL_TEMPLATES_INFO, 
  UniversalWaybill, 
  getSelectedTemplateId,
  UniversalPrintableOrders 
} from './UniversalWaybillRenderer';
import { CanvasItem } from './WaybillBuilderAdvanced';
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

export function convertTemplateToCanvasItems(templateId: number): CanvasItem[] {
  const info = WAYBILL_TEMPLATES_INFO.find(t => t.id === templateId);
  const templateName = info ? info.name : `نموذج ${templateId}`;

  let primaryColor = '#0f172a';
  let headerBg = '#f8fafc';
  let headerTextColor = '#0f172a';
  let borderColor = '#cbd5e1';
  let borderRadius = 6;

  if (templateId >= 6 && templateId <= 10) { // Royal / Gold
    primaryColor = '#92400e';
    headerBg = '#fffbeb';
    headerTextColor = '#78350f';
    borderColor = '#fde68a';
    borderRadius = 8;
  } else if (templateId >= 11 && templateId <= 20) { // Modern Blue
    primaryColor = '#1e40af';
    headerBg = '#eff6ff';
    headerTextColor = '#1e3a8a';
    borderColor = '#bfdbfe';
    borderRadius = 12;
  } else if (templateId >= 21 && templateId <= 30) { // Courier Green
    primaryColor = '#065f46';
    headerBg = '#ecfdf5';
    headerTextColor = '#064e3b';
    borderColor = '#a7f3d0';
    borderRadius = 8;
  } else if (templateId >= 31 && templateId <= 40) { // Thermal Style
    primaryColor = '#000000';
    headerBg = '#f1f5f9';
    headerTextColor = '#000000';
    borderColor = '#000000';
    borderRadius = 2;
  } else if (templateId >= 41 && templateId <= 50) { // Purple / Special
    primaryColor = '#581c87';
    headerBg = '#faf5ff';
    headerTextColor = '#3b0764';
    borderColor = '#e9d5ff';
    borderRadius = 10;
  }

  return [
    {
      id: 'item_border',
      type: 'rect',
      x: 6,
      y: 6,
      width: 368,
      height: 518,
      style: {
        borderColor: primaryColor,
        borderWidth: 2,
        borderStyle: 'solid',
        backgroundColor: 'transparent',
        borderRadius: borderRadius,
        zIndex: 1
      }
    },
    {
      id: 'item_header_bg',
      type: 'rect',
      x: 12,
      y: 12,
      width: 356,
      height: 65,
      style: {
        backgroundColor: headerBg,
        borderColor: borderColor,
        borderWidth: 1,
        borderStyle: 'solid',
        borderRadius: Math.max(2, borderRadius - 2),
        zIndex: 2
      }
    },
    {
      id: 'item_logo',
      type: 'logo',
      x: 20,
      y: 18,
      width: 50,
      height: 50,
      style: { zIndex: 3 }
    },
    {
      id: 'item_company',
      type: 'dynamic',
      dynamicKey: 'companyName',
      x: 76,
      y: 20,
      width: 145,
      height: 22,
      style: {
        fontSize: 13,
        fontWeight: 'bold',
        color: headerTextColor,
        textAlign: 'right',
        zIndex: 3
      }
    },
    {
      id: 'item_company_phone',
      type: 'dynamic',
      dynamicKey: 'companyPhone',
      x: 76,
      y: 44,
      width: 145,
      height: 18,
      style: {
        fontSize: 10,
        fontWeight: 'normal',
        color: headerTextColor,
        textAlign: 'right',
        zIndex: 3
      }
    },
    {
      id: 'item_barcode',
      type: 'barcode',
      x: 228,
      y: 16,
      width: 132,
      height: 42,
      style: { zIndex: 3 }
    },
    {
      id: 'item_customer_bg',
      type: 'rect',
      x: 12,
      y: 84,
      width: 356,
      height: 96,
      style: {
        backgroundColor: '#ffffff',
        borderColor: borderColor,
        borderWidth: 1,
        borderStyle: 'solid',
        borderRadius: Math.max(2, borderRadius - 2),
        zIndex: 2
      }
    },
    {
      id: 'item_gov',
      type: 'dynamic',
      dynamicKey: 'governorate',
      x: 20,
      y: 92,
      width: 105,
      height: 24,
      style: {
        backgroundColor: primaryColor,
        color: '#ffffff',
        fontSize: 11,
        fontWeight: 'bold',
        borderRadius: 12,
        textAlign: 'center',
        padding: 2,
        zIndex: 4
      }
    },
    {
      id: 'item_customer_name',
      type: 'dynamic',
      dynamicKey: 'customerName',
      x: 135,
      y: 92,
      width: 225,
      height: 24,
      style: {
        fontSize: 13,
        fontWeight: 'bold',
        color: '#0f172a',
        textAlign: 'right',
        zIndex: 4
      }
    },
    {
      id: 'item_phone1',
      type: 'dynamic',
      dynamicKey: 'phone1',
      x: 20,
      y: 122,
      width: 170,
      height: 20,
      style: {
        fontSize: 11,
        fontWeight: 'bold',
        color: '#334155',
        textAlign: 'right',
        zIndex: 4
      }
    },
    {
      id: 'item_phone2',
      type: 'dynamic',
      dynamicKey: 'phone2',
      x: 195,
      y: 122,
      width: 165,
      height: 20,
      style: {
        fontSize: 11,
        fontWeight: 'bold',
        color: '#64748b',
        textAlign: 'right',
        zIndex: 4
      }
    },
    {
      id: 'item_address',
      type: 'dynamic',
      dynamicKey: 'address',
      x: 20,
      y: 146,
      width: 340,
      height: 28,
      style: {
        fontSize: 10,
        color: '#475569',
        textAlign: 'right',
        zIndex: 4
      }
    },
    {
      id: 'item_table',
      type: 'table',
      x: 12,
      y: 188,
      width: 356,
      height: 138,
      style: {
        borderColor: borderColor,
        borderWidth: 1,
        borderStyle: 'solid',
        fontSize: 10,
        backgroundColor: '#ffffff',
        zIndex: 3
      }
    },
    {
      id: 'item_total_bg',
      type: 'rect',
      x: 12,
      y: 334,
      width: 356,
      height: 44,
      style: {
        backgroundColor: primaryColor,
        borderRadius: Math.max(2, borderRadius - 2),
        zIndex: 2
      }
    },
    {
      id: 'item_shipping',
      type: 'dynamic',
      dynamicKey: 'shipping',
      x: 22,
      y: 344,
      width: 120,
      height: 24,
      style: {
        color: '#ffffff',
        fontSize: 11,
        fontWeight: 'bold',
        textAlign: 'right',
        zIndex: 3
      }
    },
    {
      id: 'item_total',
      type: 'dynamic',
      dynamicKey: 'total',
      x: 195,
      y: 342,
      width: 165,
      height: 28,
      style: {
        color: '#ffffff',
        fontSize: 14,
        fontWeight: 'bold',
        textAlign: 'left',
        zIndex: 3
      }
    },
    {
      id: 'item_notes_bg',
      type: 'rect',
      x: 12,
      y: 384,
      width: 356,
      height: 44,
      style: {
        backgroundColor: '#f8fafc',
        borderColor: '#e2e8f0',
        borderWidth: 1,
        borderStyle: 'solid',
        borderRadius: Math.max(2, borderRadius - 2),
        zIndex: 2
      }
    },
    {
      id: 'item_notes',
      type: 'dynamic',
      dynamicKey: 'notes',
      x: 20,
      y: 390,
      width: 340,
      height: 32,
      style: {
        fontSize: 10,
        color: '#334155',
        textAlign: 'right',
        zIndex: 3
      }
    },
    {
      id: 'item_employee',
      type: 'dynamic',
      dynamicKey: 'employee',
      x: 16,
      y: 434,
      width: 170,
      height: 18,
      style: {
        fontSize: 9,
        color: '#64748b',
        textAlign: 'right',
        zIndex: 3
      }
    },
    {
      id: 'item_date',
      type: 'dynamic',
      dynamicKey: 'date',
      x: 195,
      y: 434,
      width: 170,
      height: 18,
      style: {
        fontSize: 9,
        color: '#64748b',
        textAlign: 'left',
        zIndex: 3
      }
    },
    {
      id: 'item_terms',
      type: 'dynamic',
      dynamicKey: 'companyTerms',
      x: 12,
      y: 458,
      width: 356,
      height: 60,
      style: {
        fontSize: 8,
        color: '#64748b',
        textAlign: 'center',
        borderWidth: 1,
        borderColor: '#f1f5f9',
        borderStyle: 'solid',
        padding: 4,
        zIndex: 3
      }
    }
  ];
}

interface WaybillTemplatesManagerProps {
  onEditTemplate?: (templateId: number) => void;
}

const WaybillTemplatesManager: React.FC<WaybillTemplatesManagerProps> = ({ onEditTemplate }) => {
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

  const handleEditInAdvancedBuilder = (templateId: number) => {
    const items = convertTemplateToCanvasItems(templateId);
    const info = WAYBILL_TEMPLATES_INFO.find(t => t.id === templateId);
    const templateName = info ? info.name : `نموذج ${templateId}`;
    
    const templateData = {
      name: `تعديل ${templateName}`,
      items,
      savedAt: new Date().toISOString()
    };

    localStorage.setItem('Dragon_advanced_waybill_template', JSON.stringify(templateData));
    localStorage.setItem('Dragon_waybill_template', '51');

    Swal.fire({
      title: 'جاري التحويل للمصمم المتقدم...',
      text: `تم تحميل تصميم "${templateName}" في المصمم المتقدم لتعديل أماكن وأحجام العناصر.`,
      icon: 'success',
      timer: 1800,
      showConfirmButton: false
    });

    if (onEditTemplate) {
      onEditTemplate(templateId);
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
              <p className="text-sm text-blue-200">اختر من بين 50 قالباً مختلفاً كلياً أو اضغط "تعديل" لتخصيص مكان أي عنصر في المصمم المتقدم.</p>
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
                    <div className="flex items-start gap-3 flex-1">
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

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEditInAdvancedBuilder(item.id);
                      }}
                      className="px-3 py-1.5 bg-purple-100 dark:bg-purple-900/40 hover:bg-purple-600 hover:text-white text-purple-700 dark:text-purple-300 rounded-xl text-xs font-bold flex items-center gap-1 transition-all shrink-0"
                      title="تعديل هذا التصميم في المصمم المتقدم"
                    >
                      <Pencil size={13} /> تعديل
                    </button>
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

              <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap">
                <button
                  type="button"
                  onClick={() => handleTestPrint(previewId)}
                  className="flex-1 sm:flex-initial px-3.5 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-xl font-bold text-xs hover:bg-slate-200 flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Printer size={15} /> طباعة تجريبية
                </button>
                <button
                  type="button"
                  onClick={() => handleEditInAdvancedBuilder(previewId)}
                  className="flex-1 sm:flex-initial px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-purple-500/20 transition-all"
                >
                  <Pencil size={15} /> تعديل في المصمم المتقدم
                </button>
                <button
                  type="button"
                  disabled={loading || selectedId === previewId}
                  onClick={() => handleSelectTemplate(previewId)}
                  className={`flex-1 sm:flex-initial px-4 py-2 rounded-xl font-black text-xs flex items-center justify-center gap-1.5 shadow-lg transition-all ${
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
