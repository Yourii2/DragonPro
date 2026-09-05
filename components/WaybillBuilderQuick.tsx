import React, { useState, useCallback } from 'react';
import Swal from 'sweetalert2';
import {
  Palette, Type, Layout, Eye, Save, RotateCcw, Download, Upload,
  ChevronDown, ChevronUp, Printer, Sliders, CheckSquare, Square,
  Building, Barcode as BarcodeIcon, MapPin, Package, StickyNote, User, FileText, Zap
} from 'lucide-react';
import Barcode from './Barcode';
import { getOrderData } from './UniversalWaybillRenderer';
import { assetUrl } from '../services/assetUrl';

interface WaybillSection {
  id: string;
  label: string;
  enabled: boolean;
  order: number;
}

interface WaybillStyle {
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  bgColor: string;
  textColor: string;
  borderColor: string;
  headerBg: string;
  headerText: string;
  fontFamily: string;
  fontSize: string;
  borderStyle: 'solid' | 'dashed' | 'double' | 'none';
  borderWidth: string;
  borderRadius: string;
  padding: string;
  showLogo: boolean;
  showBarcode: boolean;
  showGovBadge: boolean;
  showProductTable: boolean;
  showNotes: boolean;
  showEmployeeInfo: boolean;
  showTerms: boolean;
  headerAlign: 'rtl' | 'ltr';
  govBadgeStyle: 'filled' | 'outlined' | 'pill';
  totalStyle: 'boxed' | 'inline' | 'highlighted';
}

const DEFAULT_STYLE: WaybillStyle = {
  primaryColor: '#000000',
  secondaryColor: '#374151',
  accentColor: '#1e3a5f',
  bgColor: '#ffffff',
  textColor: '#000000',
  borderColor: '#000000',
  headerBg: '#ffffff',
  headerText: '#000000',
  fontFamily: 'Cairo, sans-serif',
  fontSize: 'xs',
  borderStyle: 'solid',
  borderWidth: '2px',
  borderRadius: '4px',
  padding: '10px',
  showLogo: true,
  showBarcode: true,
  showGovBadge: true,
  showProductTable: true,
  showNotes: true,
  showEmployeeInfo: true,
  showTerms: true,
  headerAlign: 'ltr',
  govBadgeStyle: 'filled',
  totalStyle: 'highlighted',
};

const DEFAULT_SECTIONS: WaybillSection[] = [
  { id: 'header', label: 'رأس البوليصة (الشركة + الباركود)', enabled: true, order: 1 },
  { id: 'customer', label: 'بيانات العميل والمحافظة', enabled: true, order: 2 },
  { id: 'products', label: 'جدول المنتجات', enabled: true, order: 3 },
  { id: 'totals', label: 'الإجماليات والتحصيل', enabled: true, order: 4 },
  { id: 'notes', label: 'الملاحظات', enabled: true, order: 5 },
  { id: 'employee', label: 'الموظف والبيدج', enabled: true, order: 6 },
  { id: 'terms', label: 'الشروط والسياسة', enabled: true, order: 7 },
];

const PRESET_THEMES = [
  { name: 'كلاسيك', primary: '#000000', accent: '#1e3a5f', headerBg: '#ffffff', headerText: '#000000', border: '#000000' },
  { name: 'ذهبي', primary: '#92400e', accent: '#d97706', headerBg: '#92400e', headerText: '#fef3c7', border: '#d97706' },
  { name: 'أخضر', primary: '#065f46', accent: '#059669', headerBg: '#065f46', headerText: '#ecfdf5', border: '#059669' },
  { name: 'أحمر', primary: '#991b1b', accent: '#dc2626', headerBg: '#991b1b', headerText: '#fff1f2', border: '#dc2626' },
  { name: 'بنفسجي', primary: '#4c1d95', accent: '#7c3aed', headerBg: '#4c1d95', headerText: '#f5f3ff', border: '#7c3aed' },
  { name: 'كحلي', primary: '#0f172a', accent: '#0ea5e9', headerBg: '#0f172a', headerText: '#f0f9ff', border: '#0ea5e9' },
];

const MOCK_ORDER = {
  orderNumber: '2024-001',
  customerName: 'أحمد محمد علي',
  phone1: '01012345678',
  phone2: '01198765432',
  governorate: 'القاهرة',
  address: 'شارع التحرير، الدقي، الجيزة',
  notes: 'يرجى التأكد من المعاينة قبل الاستلام',
  date: new Date().toISOString().slice(0, 10),
  products: [
    { name: 'قميص قطن', color: 'أبيض', size: 'XL', quantity: 2, price: 250, total: 500 },
    { name: 'بنطلون جينز', color: 'أزرق', size: '34', quantity: 1, price: 350, total: 350 },
  ],
  shipping: 50,
  total: 900,
  employee: 'محمد أحمد',
  page: 'متجر درايجون',
};

// ─── Collapsible Section ─────────────────────────────────────────────────────
const CollapseSection: React.FC<{ title: string; icon: React.ReactNode; children: React.ReactNode; defaultOpen?: boolean }> = ({ title, icon, children, defaultOpen = true }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden mb-3">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
      >
        <div className="flex items-center gap-2 font-bold text-sm text-slate-800 dark:text-slate-100">
          <span className="text-blue-500">{icon}</span>
          {title}
        </div>
        {open ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
      </button>
      {open && <div className="p-3 space-y-3 bg-white dark:bg-slate-900">{children}</div>}
    </div>
  );
};

// ─── Custom Waybill Preview ───────────────────────────────────────────────────
const QuickWaybillPreview: React.FC<{
  style: WaybillStyle;
  sections: WaybillSection[];
  companyName: string;
  companyPhone: string;
  terms: string;
  companyLogo?: string | null;
}> = ({ style, sections, companyName, companyPhone, terms, companyLogo }) => {
  const d = getOrderData(MOCK_ORDER);
  const sortedSections = [...sections].sort((a, b) => a.order - b.order);

  const containerStyle: React.CSSProperties = {
    backgroundColor: style.bgColor,
    color: style.textColor,
    borderColor: style.borderColor,
    borderStyle: style.borderStyle === 'none' ? 'none' : style.borderStyle,
    borderWidth: style.borderStyle === 'none' ? '0' : style.borderWidth,
    borderRadius: style.borderRadius,
    padding: style.padding,
    fontFamily: style.fontFamily,
  };

  const headerStyle: React.CSSProperties = {
    backgroundColor: style.headerBg,
    color: style.headerText,
  };

  const govBadgeStyle: React.CSSProperties =
    style.govBadgeStyle === 'filled'
      ? { backgroundColor: style.primaryColor, color: '#ffffff', padding: '2px 8px' }
      : style.govBadgeStyle === 'outlined'
      ? { border: `2px solid ${style.primaryColor}`, color: style.primaryColor, padding: '2px 8px' }
      : { backgroundColor: style.accentColor, color: '#ffffff', padding: '2px 10px', borderRadius: '999px' };

  const totalBoxStyle: React.CSSProperties =
    style.totalStyle === 'highlighted'
      ? { backgroundColor: style.primaryColor, color: '#ffffff', padding: '8px 12px', borderRadius: '6px' }
      : style.totalStyle === 'boxed'
      ? { border: `2px solid ${style.primaryColor}`, padding: '8px 12px', borderRadius: '4px' }
      : { borderTop: `2px solid ${style.primaryColor}`, paddingTop: '6px' };

  return (
    <div
      className="w-full max-w-[395px] mx-auto text-right box-border flex flex-col gap-2 overflow-hidden select-none"
      style={containerStyle}
      dir="rtl"
    >
      {sortedSections.map(sec => {
        if (!sec.enabled) return null;

        if (sec.id === 'header') return (
          <div key="header" className="flex items-center justify-between pb-2 border-b" style={{ borderColor: style.borderColor, direction: style.headerAlign === 'ltr' ? 'ltr' : 'rtl', ...headerStyle, margin: `-${style.padding}`, padding: style.padding, marginBottom: '0' }}>
            <div className="w-1/4 flex items-center justify-start">
              {style.showLogo && companyLogo ? (
                <img src={companyLogo} alt="Logo" style={{ maxHeight: '40px', maxWidth: '100%', objectFit: 'contain' }} />
              ) : (
                <span className="font-black text-sm truncate" style={{ color: style.headerText }}>{companyName}</span>
              )}
            </div>
            <div className="w-1/2 flex flex-col items-center">
              {style.showBarcode && <Barcode value={d.orderNumber} height={30} width={1.2} />}
              <span className="font-mono font-black text-xs mt-0.5" style={{ color: style.headerText }}>#{d.orderNumber}</span>
            </div>
            <div className="w-1/4 text-right" style={{ direction: 'rtl' }}>
              <div className="font-black text-xs truncate" style={{ color: style.headerText }}>{companyName}</div>
              <div className="font-mono text-[10px]" style={{ color: style.headerText, opacity: 0.8 }}>{companyPhone}</div>
            </div>
          </div>
        );

        if (sec.id === 'customer') return (
          <div key="customer" className="border p-2 space-y-1 text-xs" style={{ borderColor: style.borderColor, borderStyle: style.borderStyle === 'none' ? 'solid' : style.borderStyle }}>
            <div className="flex justify-between items-center">
              <div><span className="font-bold opacity-60">العميل: </span><span className="font-black">{d.customerName}</span></div>
              {style.showGovBadge && <span className="font-black text-[10px]" style={govBadgeStyle}>{d.gov}</span>}
            </div>
            <div className="font-mono text-[11px]">📞 {d.phone1} {d.phone2 ? `/ ${d.phone2}` : ''}</div>
            <div className="border-t pt-1 text-[10px]" style={{ borderColor: style.borderColor, opacity: 0.7 }}>
              <span className="font-bold">العنوان: </span>{d.address}
            </div>
          </div>
        );

        if (sec.id === 'products' && style.showProductTable) return (
          <table key="products" className="w-full text-xs border-collapse" style={{ border: `1px solid ${style.borderColor}` }}>
            <thead>
              <tr style={{ backgroundColor: style.primaryColor, color: '#ffffff' }}>
                <th className="p-1 text-right">المنتج</th>
                <th className="p-1 text-center w-9">كمية</th>
                <th className="p-1 text-center w-12">السعر</th>
                <th className="p-1 text-center w-14">الإجمالي</th>
              </tr>
            </thead>
            <tbody>
              {d.products.map((p, i) => (
                <tr key={i} style={{ borderBottom: `1px solid ${style.borderColor}`, backgroundColor: i % 2 === 0 ? 'transparent' : `${style.primaryColor}08` }}>
                  <td className="p-1 font-bold truncate max-w-[140px]">{p.name} {p.variant && <span className="text-[9px] opacity-60">({p.variant})</span>}</td>
                  <td className="p-1 text-center font-bold">{p.qty}</td>
                  <td className="p-1 text-center font-mono">{p.price}</td>
                  <td className="p-1 text-center font-mono font-bold">{p.lineTotal}</td>
                </tr>
              ))}
            </tbody>
          </table>
        );

        if (sec.id === 'totals') return (
          <div key="totals" className="flex justify-between items-center text-xs" style={totalBoxStyle}>
            <div>
              <span>شحن: </span><span className="font-mono font-bold">{d.shipping} ج.م</span>
            </div>
            <div className="text-right">
              <span className="font-black text-xs">المطلوب تحصيله: </span>
              <span className="font-mono font-black text-sm">{d.total.toLocaleString()} ج.م</span>
            </div>
          </div>
        );

        if (sec.id === 'notes' && style.showNotes) return (
          <div key="notes" className="text-[10px] p-1 rounded border" style={{ borderColor: style.borderColor, opacity: 0.8 }}>
            <strong>ملاحظات: </strong>{d.notes || 'لا توجد ملاحظات'}
          </div>
        );

        if (sec.id === 'employee' && style.showEmployeeInfo) return (
          <div key="employee" className="flex justify-between text-[9px] opacity-70 px-1">
            <span>البيدج: <strong>{d.page}</strong></span>
            <span>الموظف: <strong>{d.employee}</strong></span>
          </div>
        );

        if (sec.id === 'terms' && style.showTerms) return (
          <div key="terms" className="text-[8px] text-center border-t pt-1" style={{ borderColor: style.borderColor, opacity: 0.6 }}>
            {terms || 'المعاينة حق للعميل قبل الاستلام. يرجى التأكد من سلامة ومطابقة الشحنة.'}
          </div>
        );

        return null;
      })}
    </div>
  );
};

const WaybillBuilderQuick: React.FC = () => {
  const [style, setStyle] = useState<WaybillStyle>(DEFAULT_STYLE);
  const [sections, setSections] = useState<WaybillSection[]>(DEFAULT_SECTIONS);
  const [templateName, setTemplateName] = useState('القالب السريع');

  const companyName = localStorage.getItem('Dragon_company_name') || 'اسم الشركة';
  const companyPhone = localStorage.getItem('Dragon_company_phone') || '01000000000';
  const companyTerms = localStorage.getItem('Dragon_company_terms') || 'المعاينة حق للعميل قبل الاستلام.';
  const companyLogo = localStorage.getItem('Dragon_company_logo_url') || localStorage.getItem('Dragon_company_logo') || assetUrl('Dragon.png');

  // Load saved
  React.useEffect(() => {
    try {
      const saved = localStorage.getItem('Dragon_quick_waybill_template');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.style) setStyle(parsed.style);
        if (parsed.sections) setSections(parsed.sections);
        if (parsed.name) setTemplateName(parsed.name);
      }
    } catch (e) { }
  }, []);

  const updateStyle = (key: keyof WaybillStyle, value: any) => {
    setStyle(prev => ({ ...prev, [key]: value }));
  };

  const applyPreset = (preset: typeof PRESET_THEMES[0]) => {
    setStyle(prev => ({
      ...prev,
      primaryColor: preset.primary,
      accentColor: preset.accent,
      borderColor: preset.border,
      headerBg: preset.headerBg,
      headerText: preset.headerText,
    }));
  };

  const moveSectionUp = (id: string) => {
    setSections(prev => {
      const sorted = [...prev].sort((a, b) => a.order - b.order);
      const idx = sorted.findIndex(s => s.id === id);
      if (idx <= 0) return prev;
      const newSections = sorted.map(s => ({ ...s }));
      [newSections[idx - 1].order, newSections[idx].order] = [newSections[idx].order, newSections[idx - 1].order];
      return newSections;
    });
  };

  const moveSectionDown = (id: string) => {
    setSections(prev => {
      const sorted = [...prev].sort((a, b) => a.order - b.order);
      const idx = sorted.findIndex(s => s.id === id);
      if (idx >= sorted.length - 1) return prev;
      const newSections = sorted.map(s => ({ ...s }));
      [newSections[idx + 1].order, newSections[idx].order] = [newSections[idx].order, newSections[idx + 1].order];
      return newSections;
    });
  };

  const toggleSection = (id: string) => {
    setSections(prev => prev.map(s => s.id === id ? { ...s, enabled: !s.enabled } : s));
  };

  const saveTemplate = () => {
    const templateData = { name: templateName, style, sections };
    localStorage.setItem('Dragon_quick_waybill_template', JSON.stringify(templateData));
    localStorage.setItem('Dragon_waybill_template', '52');
    
    Swal.fire({
      title: '✅ تم الحفظ',
      text: 'تم حفظ القالب السريع بنجاح كقالب رقم 52 الافتراضي',
      icon: 'success',
      timer: 2000,
      showConfirmButton: false,
    });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* Settings Panel */}
      <div className="lg:col-span-5 xl:col-span-4 bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-700 p-4 h-[calc(100vh-140px)] overflow-y-auto">
        
        <div className="flex items-center gap-2 mb-4">
          <input 
            type="text" 
            value={templateName}
            onChange={e => setTemplateName(e.target.value)}
            className="flex-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm font-bold"
            placeholder="اسم القالب السريع..."
          />
          <button onClick={saveTemplate} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2">
            <Save size={16} /> حفظ 
          </button>
        </div>

        <CollapseSection title="سمات جاهزة" icon={<Zap size={15} />}>
          <div className="grid grid-cols-3 gap-2">
            {PRESET_THEMES.map(preset => (
              <button
                key={preset.name}
                onClick={() => applyPreset(preset)}
                className="flex flex-col items-center gap-1 p-2 rounded-xl border hover:border-blue-400 transition-colors bg-white dark:bg-slate-700"
              >
                <div className="w-full h-6 rounded-lg border-2" style={{ backgroundColor: preset.headerBg, borderColor: preset.border }} />
                <span className="text-[10px] font-bold mt-1 text-slate-600 dark:text-slate-300">{preset.name}</span>
              </button>
            ))}
          </div>
        </CollapseSection>

        <CollapseSection title="إظهار / إخفاء العناصر" icon={<Eye size={15} />}>
          <div className="space-y-2">
            {[
              { key: 'showLogo', label: 'اللوجو', icon: <Building size={14} /> },
              { key: 'showBarcode', label: 'الباركود', icon: <BarcodeIcon size={14} /> },
              { key: 'showGovBadge', label: 'شارة المحافظة', icon: <MapPin size={14} /> },
              { key: 'showProductTable', label: 'جدول المنتجات', icon: <Package size={14} /> },
              { key: 'showNotes', label: 'الملاحظات', icon: <StickyNote size={14} /> },
              { key: 'showEmployeeInfo', label: 'الموظف والبيدج', icon: <User size={14} /> },
              { key: 'showTerms', label: 'الشروط', icon: <FileText size={14} /> },
            ].map(item => (
              <label key={item.key} className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer border dark:border-slate-700">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300">
                  <span className="text-blue-500">{item.icon}</span> {item.label}
                </div>
                <input 
                  type="checkbox" 
                  checked={style[item.key as keyof WaybillStyle] as boolean} 
                  onChange={e => updateStyle(item.key as keyof WaybillStyle, e.target.checked)} 
                  className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                />
              </label>
            ))}
          </div>
        </CollapseSection>

        <CollapseSection title="ترتيب الأقسام" icon={<Layout size={15} />}>
          <div className="space-y-2">
            {[...sections].sort((a, b) => a.order - b.order).map((sec, idx, arr) => (
              <div key={sec.id} className={`flex items-center gap-2 p-2 rounded-lg border transition-all ${sec.enabled ? 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-600' : 'opacity-50'}`}>
                <button onClick={() => toggleSection(sec.id)} className="text-blue-500">
                  {sec.enabled ? <CheckSquare size={16} /> : <Square size={16} />}
                </button>
                <span className="flex-1 text-xs font-bold text-slate-700 dark:text-slate-200 truncate">{sec.label}</span>
                <div className="flex flex-col gap-1">
                  <button onClick={() => moveSectionUp(sec.id)} disabled={idx === 0} className="p-0.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded disabled:opacity-30"><ChevronUp size={12} /></button>
                  <button onClick={() => moveSectionDown(sec.id)} disabled={idx === arr.length - 1} className="p-0.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded disabled:opacity-30"><ChevronDown size={12} /></button>
                </div>
              </div>
            ))}
          </div>
        </CollapseSection>

        <CollapseSection title="الألوان والإطار" icon={<Palette size={15} />}>
          <div className="space-y-3">
            {[
              { key: 'primaryColor', label: 'الرئيسي' },
              { key: 'borderColor', label: 'الإطار' },
              { key: 'headerBg', label: 'خلفية الرأس' },
              { key: 'headerText', label: 'نص الرأس' },
              { key: 'bgColor', label: 'الخلفية' },
            ].map(c => (
              <div key={c.key} className="flex items-center justify-between text-xs font-bold">
                <span className="text-slate-600 dark:text-slate-300">{c.label}</span>
                <input type="color" value={style[c.key as keyof WaybillStyle] as string} onChange={e => updateStyle(c.key as keyof WaybillStyle, e.target.value)} className="w-8 h-8 rounded-lg cursor-pointer" />
              </div>
            ))}
          </div>
        </CollapseSection>

      </div>

      {/* Preview Panel */}
      <div className="lg:col-span-7 xl:col-span-8">
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xl overflow-hidden h-[calc(100vh-140px)] flex flex-col">
          <div className="p-3 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 flex justify-between items-center">
            <span className="text-sm font-bold text-slate-600 dark:text-slate-300">معاينة (قالب 52)</span>
          </div>
          <div className="flex-1 overflow-auto flex items-center justify-center p-6 bg-slate-100 dark:bg-slate-900" style={{ background: 'repeating-linear-gradient(45deg, #f8fafc 0px, #f8fafc 10px, #f1f5f9 10px, #f1f5f9 20px)' }}>
            <div className="shadow-2xl rounded-sm w-full max-w-[420px] bg-white transition-all duration-300">
              <QuickWaybillPreview
                style={style}
                sections={sections}
                companyName={companyName}
                companyPhone={companyPhone}
                terms={companyTerms}
                companyLogo={style.showLogo ? companyLogo : null}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WaybillBuilderQuick;
