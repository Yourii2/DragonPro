/**
 * WaybillTemplatesManager.tsx
 * Management page for browsing, previewing, and selecting waybill templates.
 * Provides separate tabs for:
 * 1. Pre-designed Built-in Templates (50 Templates)
 * 2. User Custom Templates (Created via Drag & Drop or Quick Designer)
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
  Pencil,
  Trash2,
  Plus,
  Search,
  User,
  Zap,
  Sliders,
  Calendar,
  AlertCircle
} from 'lucide-react';
import { 
  WAYBILL_TEMPLATES_INFO, 
  UniversalWaybill, 
  getSelectedTemplateId,
  setSelectedTemplateId,
  getCustomWaybillTemplates,
  deleteCustomWaybillTemplate,
  convertTemplateToCanvasItems,
  CustomWaybillTemplate,
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
  notes: 'يرجى الاتصال قبل الوصول بنصف ساعة. العميل يطلب المعاينة قبل الاستلام.',
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

export interface EditTemplatePayload {
  type: 'advanced' | 'quick';
  templateId?: number | string;
  customTemplate?: CustomWaybillTemplate;
  initialData?: any;
}

interface WaybillTemplatesManagerProps {
  onEditTemplate?: (payload: EditTemplatePayload) => void;
  onCreateNewTemplate?: (type: 'advanced' | 'quick') => void;
}

const WaybillTemplatesManager: React.FC<WaybillTemplatesManagerProps> = ({ 
  onEditTemplate, 
  onCreateNewTemplate 
}) => {
  const [activeTab, setActiveTab] = useState<'presets' | 'custom'>('presets');
  const [customTemplates, setCustomTemplates] = useState<CustomWaybillTemplate[]>(() => getCustomWaybillTemplates());
  const [selectedId, setSelectedId] = useState<number | string>(() => getSelectedTemplateId());
  const [previewId, setPreviewId] = useState<number | string>(() => getSelectedTemplateId());
  const [presetSearch, setPresetSearch] = useState('');
  const [customSearch, setCustomSearch] = useState('');
  const [loading, setLoading] = useState<boolean>(false);
  const [printOrder, setPrintOrder] = useState<any[] | null>(null);

  const companyName = localStorage.getItem('Dragon_company_name') || 'شركة دراجون برو للتجارة';
  const companyPhone = localStorage.getItem('Dragon_company_phone') || '01000000000';
  const companyAddress = localStorage.getItem('Dragon_company_address') || 'القاهرة، جمهورية مصر العربية';
  const companyLogo = (typeof window !== 'undefined' ? (localStorage.getItem('Dragon_company_logo_url') || localStorage.getItem('Dragon_company_logo')) : null) || assetUrl('Dragon.png');
  const companyTerms = localStorage.getItem('Dragon_company_terms') || 'تعتبر هذه البوليصة مستند استلام رسمي. يرجى التأكد من سلامة المنتجات.';

  useEffect(() => {
    // Refresh custom templates list on mount
    setCustomTemplates(getCustomWaybillTemplates());
    
    // Sync settings from server if available
    const loadSaved = async () => {
      try {
        const res = await fetch(`${API_BASE_PATH}/get_settings.php?_t=${Date.now()}`);
        const json = await res.json();
        if (json?.success && json?.data?.waybill_template) {
          const sId = json.data.waybill_template;
          setSelectedId(sId);
          setPreviewId(sId);
        }
      } catch (e) {}
    };
    loadSaved();
  }, []);

  const handleSelectTemplate = async (templateId: number | string) => {
    setLoading(true);
    try {
      setSelectedTemplateId(templateId);
      setSelectedId(templateId);

      const customMatch = customTemplates.find(t => String(t.id) === String(templateId));
      const tName = customMatch 
        ? customMatch.name 
        : (WAYBILL_TEMPLATES_INFO.find(t => t.id === Number(templateId))?.name || `نموذج ${templateId}`);

      Swal.fire({
        title: 'تم تفعيل النموذج بنجاح!',
        text: `تم تعيين "${tName}" كنموذج افتراضي لجميع بوالص الشحن والفواتير.`,
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

  const handleEditPresetTemplate = (templateId: number) => {
    const items = convertTemplateToCanvasItems(templateId);
    const info = WAYBILL_TEMPLATES_INFO.find(t => t.id === templateId);
    const templateName = info ? info.name : `نموذج ${templateId}`;
    
    const templateData = {
      name: `تخصيص ${templateName}`,
      items,
      savedAt: new Date().toISOString()
    };

    try {
      localStorage.setItem('Dragon_advanced_waybill_template', JSON.stringify(templateData));
    } catch (e) {}

    if (onEditTemplate) {
      onEditTemplate({
        type: 'advanced',
        templateId,
        initialData: templateData
      });
    }
  };

  const handleEditCustomTemplate = (custom: CustomWaybillTemplate) => {
    try {
      if (custom.type === 'advanced') {
        localStorage.setItem('Dragon_advanced_waybill_template', JSON.stringify(custom.data));
      } else {
        localStorage.setItem('Dragon_quick_waybill_template', JSON.stringify(custom.data));
      }
    } catch (e) {}

    if (onEditTemplate) {
      onEditTemplate({
        type: custom.type,
        templateId: custom.id,
        customTemplate: custom,
        initialData: custom.data
      });
    }
  };

  const handleDeleteCustomTemplate = (custom: CustomWaybillTemplate) => {
    Swal.fire({
      title: 'هل أنت متأكد من حذف هذا القالب؟',
      text: `سيتم حذف القالب "${custom.name}" نهائياً من قائمة قوالب المستخدم.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'نعم، احذف القالب',
      cancelButtonText: 'إلغاء'
    }).then((result) => {
      if (result.isConfirmed) {
        deleteCustomWaybillTemplate(custom.id);
        const updated = getCustomWaybillTemplates();
        setCustomTemplates(updated);

        if (String(selectedId) === String(custom.id)) {
          setSelectedId(1);
          setPreviewId(1);
        } else if (String(previewId) === String(custom.id)) {
          setPreviewId(1);
        }

        Swal.fire({
          title: 'تم الحذف!',
          text: 'تم حذف القالب المخصص بنجاح.',
          icon: 'success',
          timer: 1500,
          showConfirmButton: false
        });
      }
    });
  };

  const handleTestPrint = (templateId: number | string) => {
    setPrintOrder([MOCK_ORDER]);
    setTimeout(() => {
      window.print();
      setTimeout(() => setPrintOrder(null), 1000);
    }, 300);
  };

  const handlePromptCreateNew = () => {
    Swal.fire({
      title: 'إنشاء قالب مخصص جديد',
      text: 'اختر نوع المصمم الذي ترغب في استخدامه لتصميم بوليصتك:',
      icon: 'question',
      showCancelButton: true,
      showDenyButton: true,
      confirmButtonText: 'المصمم المتقدم (سحب وإفلات حر)',
      denyButtonText: 'المصمم السريع (ترتيب الأقسام والأنماط)',
      cancelButtonText: 'إلغاء',
      confirmButtonColor: '#7c3aed',
      denyButtonColor: '#2563eb'
    }).then((result) => {
      if (result.isConfirmed) {
        if (onCreateNewTemplate) {
          onCreateNewTemplate('advanced');
        } else if (onEditTemplate) {
          onEditTemplate({ type: 'advanced', templateId: 'new' });
        }
      } else if (result.isDenied) {
        if (onCreateNewTemplate) {
          onCreateNewTemplate('quick');
        } else if (onEditTemplate) {
          onEditTemplate({ type: 'quick', templateId: 'new' });
        }
      }
    });
  };

  // Filter presets
  const filteredPresets = WAYBILL_TEMPLATES_INFO.filter(item => {
    if (!presetSearch.trim()) return true;
    const query = presetSearch.toLowerCase();
    return (
      item.name.toLowerCase().includes(query) ||
      item.desc.toLowerCase().includes(query) ||
      String(item.id).includes(query)
    );
  });

  // Filter custom templates
  const filteredCustom = customTemplates.filter(item => {
    if (!customSearch.trim()) return true;
    const query = customSearch.toLowerCase();
    return item.name.toLowerCase().includes(query) || String(item.id).includes(query);
  });

  // Determine currently previewed template details
  const previewCustom = customTemplates.find(t => String(t.id) === String(previewId));
  const previewPreset = !previewCustom ? WAYBILL_TEMPLATES_INFO.find(t => t.id === Number(previewId)) : null;
  const previewTitle = previewCustom 
    ? previewCustom.name 
    : (previewPreset ? `نموذج ${previewPreset.id}: ${previewPreset.name}` : `نموذج ${previewId}`);
  const isCurrentActive = String(selectedId) === String(previewId);

  return (
    <div className="p-4 md:p-6 space-y-6 animate-in fade-in" dir="rtl">
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

      {/* Top Main Banner */}
      <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white p-6 md:p-8 rounded-3xl shadow-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-500/20 backdrop-blur rounded-2xl border border-blue-400/30">
              <LayoutTemplate className="w-8 h-8 text-blue-300" />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight">إدارة ونماذج قوالب بوالص الشحن</h1>
              <p className="text-sm text-blue-200">
                تصفح القوالب الجاهزة الـ 50 أو أنشئ وخصص قوالبك الخاصة واحفظها في قائمة قوالب المستخدم.
              </p>
            </div>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto">
          <div className="flex items-center gap-3 bg-white/10 backdrop-blur px-4 py-2 rounded-2xl border border-white/20">
            <Sparkles className="w-5 h-5 text-amber-300 shrink-0" />
            <div className="text-right">
              <span className="text-xs text-blue-200 block">النموذج النشط حالياً:</span>
              <span className="text-xs font-black text-white">
                {customTemplates.find(t => String(t.id) === String(selectedId))?.name ||
                 WAYBILL_TEMPLATES_INFO.find(t => t.id === Number(selectedId))?.name ||
                 `نموذج ${selectedId}`}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={handlePromptCreateNew}
            className="px-4 py-2.5 bg-amber-400 hover:bg-amber-300 text-slate-950 rounded-2xl font-black text-xs flex items-center justify-center gap-2 shadow-lg transition-all"
          >
            <Plus size={16} /> إنشاء قالب مخصص جديد
          </button>
        </div>
      </div>

      {/* Tabs Switcher: القوالب الجاهزة vs قوالب المستخدم */}
      <div className="flex bg-slate-100 dark:bg-slate-800/80 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-700 max-w-fit gap-2">
        <button
          type="button"
          onClick={() => {
            setActiveTab('presets');
            if (previewCustom) {
              setPreviewId(1);
            }
          }}
          className={`flex items-center gap-2.5 px-6 py-2.5 rounded-xl text-sm font-black transition-all ${
            activeTab === 'presets'
              ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Layers size={18} />
          <span>القوالب الجاهزة</span>
          <span className="px-2 py-0.5 rounded-full text-xs font-mono bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300">
            50
          </span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab('custom');
            if (customTemplates.length > 0 && !previewCustom) {
              setPreviewId(customTemplates[0].id);
            }
          }}
          className={`flex items-center gap-2.5 px-6 py-2.5 rounded-xl text-sm font-black transition-all ${
            activeTab === 'custom'
              ? 'bg-white dark:bg-slate-900 text-purple-600 dark:text-purple-400 shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <User size={18} />
          <span>قوالب المستخدم المخصصة</span>
          <span className={`px-2 py-0.5 rounded-full text-xs font-mono ${
            customTemplates.length > 0 
              ? 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300' 
              : 'bg-slate-200 dark:bg-slate-700 text-slate-500'
          }`}>
            {customTemplates.length}
          </span>
        </button>
      </div>

      {/* Main Grid: Left List (5 cols) & Right Preview (7 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Side: Template Selector Cards */}
        <div className="lg:col-span-5 space-y-4">

          {/* TAB 1: PRESETS */}
          {activeTab === 'presets' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                <h2 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <Layers className="w-5 h-5 text-blue-500" /> النماذج الجاهزة المعتمدة (50 قالباً)
                </h2>
                <div className="relative">
                  <Search size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  <input
                    type="text"
                    value={presetSearch}
                    onChange={e => setPresetSearch(e.target.value)}
                    placeholder="بحث برقم أو اسم النموذج..."
                    className="w-full sm:w-56 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pr-9 pl-3 py-1.5 text-xs outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="space-y-3 max-h-[750px] overflow-y-auto pr-1 custom-scrollbar">
                {filteredPresets.map((item) => {
                  const isCurrent = String(selectedId) === String(item.id);
                  const isPreviewing = String(previewId) === String(item.id);

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
                                <span className="px-2 py-0.5 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300 text-[10px] font-black rounded-full flex items-center gap-1">
                                  <CheckCircle2 size={10} /> المفعل
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{item.desc}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEditPresetTemplate(item.id);
                            }}
                            className="px-3 py-1.5 bg-purple-100 dark:bg-purple-900/40 hover:bg-purple-600 hover:text-white text-purple-700 dark:text-purple-300 rounded-xl text-xs font-bold flex items-center gap-1 transition-all"
                            title="تعديل وتخصيص هذا التصميم في المصمم المتقدم"
                          >
                            <Pencil size={13} /> تعديل
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 2: USER CUSTOM TEMPLATES */}
          {activeTab === 'custom' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                <h2 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <User className="w-5 h-5 text-purple-500" /> قوالب المستخدم المخصصة ({customTemplates.length})
                </h2>
                <div className="relative">
                  <Search size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  <input
                    type="text"
                    value={customSearch}
                    onChange={e => setCustomSearch(e.target.value)}
                    placeholder="بحث في قوالب المستخدم..."
                    className="w-full sm:w-56 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pr-9 pl-3 py-1.5 text-xs outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              {customTemplates.length === 0 ? (
                <div className="bg-white dark:bg-slate-900 rounded-2xl p-8 text-center border-2 border-dashed border-slate-200 dark:border-slate-800 space-y-4">
                  <div className="w-16 h-16 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-3xl flex items-center justify-center mx-auto">
                    <User size={32} />
                  </div>
                  <div className="space-y-1">
                    <h3 className="font-black text-base text-slate-800 dark:text-white">لا توجد قوالب مخصصة حتى الآن</h3>
                    <p className="text-xs text-slate-500 max-w-xs mx-auto">
                      يمكنك تعديل أي قالب من الـ 50 قالباً الجاهزة وحفظه باسمك، أو إنشاء بوليصة جديدة تماماً بالسحب والإفلات.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handlePromptCreateNew}
                    className="px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold text-xs inline-flex items-center gap-2 shadow-md transition-all"
                  >
                    <Plus size={16} /> صمّم قالبك الأول الآن
                  </button>
                </div>
              ) : (
                <div className="space-y-3 max-h-[750px] overflow-y-auto pr-1 custom-scrollbar">
                  {filteredCustom.map((custom) => {
                    const isCurrent = String(selectedId) === String(custom.id);
                    const isPreviewing = String(previewId) === String(custom.id);

                    return (
                      <div
                        key={custom.id}
                        onClick={() => setPreviewId(custom.id)}
                        className={`p-4 rounded-2xl cursor-pointer border transition-all ${
                          isPreviewing
                            ? 'border-purple-600 bg-purple-50/60 dark:bg-purple-900/20 shadow-md ring-2 ring-purple-500/20'
                            : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3 flex-1">
                            <span className={`w-8 h-8 rounded-xl flex items-center justify-center font-black text-sm flex-shrink-0 ${
                              isCurrent
                                ? 'bg-emerald-600 text-white'
                                : isPreviewing
                                ? 'bg-purple-600 text-white'
                                : 'bg-slate-100 dark:bg-slate-800 text-purple-600 dark:text-purple-400'
                            }`}>
                              {custom.type === 'advanced' ? <Sliders size={16} /> : <Zap size={16} />}
                            </span>
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="font-bold text-sm text-slate-900 dark:text-white">{custom.name}</h3>
                                {isCurrent && (
                                  <span className="px-2 py-0.5 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300 text-[10px] font-black rounded-full flex items-center gap-1">
                                    <CheckCircle2 size={10} /> المفعل
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-500 flex-wrap">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  custom.type === 'advanced' 
                                    ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300' 
                                    : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                                }`}>
                                  {custom.type === 'advanced' ? 'مصمم متقدم' : 'مصمم سريع'}
                                </span>
                                {custom.updatedAt && (
                                  <span className="flex items-center gap-1 text-slate-400">
                                    <Calendar size={11} /> {new Date(custom.updatedAt).toLocaleDateString('ar-EG')}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEditCustomTemplate(custom);
                              }}
                              className="p-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-purple-600 hover:text-white text-slate-600 dark:text-slate-300 rounded-lg text-xs transition-all"
                              title="تعديل هذا القالب"
                            >
                              <Pencil size={14} />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteCustomTemplate(custom);
                              }}
                              className="p-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-red-600 hover:text-white text-slate-600 dark:text-slate-300 rounded-lg text-xs transition-all"
                              title="حذف هذا القالب"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

        </div>

        {/* Right Side: Live Interactive Preview */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <Eye className="w-5 h-5 text-blue-500" />
                  <h2 className="text-lg font-black text-slate-900 dark:text-white">
                    معاينة حية: {previewTitle}
                  </h2>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  معاينة فورية مطابقة تماماً لمخرجات الطباعة الحقيقية لربع ورقة A4.
                </p>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap">
                <button
                  type="button"
                  onClick={() => handleTestPrint(previewId)}
                  className="flex-1 sm:flex-initial px-3 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-xl font-bold text-xs hover:bg-slate-200 flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Printer size={15} /> طباعة تجريبية
                </button>

                {previewCustom ? (
                  <button
                    type="button"
                    onClick={() => handleEditCustomTemplate(previewCustom)}
                    className="flex-1 sm:flex-initial px-3.5 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-purple-500/20 transition-all"
                  >
                    <Pencil size={14} /> تعديل في المصمم
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleEditPresetTemplate(Number(previewId))}
                    className="flex-1 sm:flex-initial px-3.5 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-purple-500/20 transition-all"
                  >
                    <Pencil size={14} /> تخصيص في المصمم
                  </button>
                )}

                <button
                  type="button"
                  disabled={loading || isCurrentActive}
                  onClick={() => handleSelectTemplate(previewId)}
                  className={`flex-1 sm:flex-initial px-4 py-2 rounded-xl font-black text-xs flex items-center justify-center gap-1.5 shadow-lg transition-all ${
                    isCurrentActive
                      ? 'bg-emerald-600 text-white cursor-default'
                      : 'bg-blue-600 text-white hover:bg-blue-700 shadow-blue-500/20'
                  }`}
                >
                  {isCurrentActive ? (
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
              <div className="bg-white text-black shadow-2xl rounded-sm p-1 w-full max-w-[395px] min-h-[480px] border border-gray-300 flex flex-col items-center justify-center">
                <UniversalWaybill
                  order={MOCK_ORDER}
                  companyName={companyName}
                  companyPhone={companyPhone}
                  companyAddress={companyAddress}
                  companyLogo={companyLogo}
                  terms={companyTerms}
                  templateId={previewId}
                  customTemplateData={previewCustom ? (previewCustom.data || previewCustom) : undefined}
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
