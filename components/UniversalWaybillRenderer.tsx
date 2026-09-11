/**
 * UniversalWaybillRenderer.tsx
 * Comprehensive Waybill & Invoice Engine with 50 Distinct Structural & Visual Layouts.
 * All 50 templates strictly and reliably render:
 * 1. Company Information: Name, Phone, Logo, Barcode & Order Number
 * 2. Customer Information: Name, Primary Phone, Secondary Phone, Governorate, Full Address, Order Date
 * 3. Products Table (6 Columns): Product Name, Size (المقاس), Color (اللون), Quantity (الكمية), Price (السعر), Line Total (الإجمالي)
 * 4. Financials: Shipping Fees & Cash to Collect (Total)
 * 5. Footer & Details: Employee Name, Page / Source, Notes, Company Policy & Terms
 * Perfectly fitted for Quarter-A4 (1/4 ورقة A4 - 4 بوالص في كل ورقة A4).
 */
import React from 'react';
import {
  Printer, Grid, List, Search, Filter,
  MapPin, Phone, User, Package, Box, StickyNote, Building2, Calendar, FileText, CheckSquare, ShieldCheck
} from 'lucide-react';
import QRCode from 'react-qr-code';
import { createPortal } from 'react-dom';
import Barcode from './Barcode';
import { assetUrl } from '../services/assetUrl';
import { API_BASE_PATH } from '../services/apiConfig';

export interface WaybillProps {
  order: any;
  companyName?: string;
  companyPhone?: string;
  companyAddress?: string;
  companyLogo?: string | null;
  terms?: string;
  users?: any[];
  templateId?: number | string;
}

// ─── Helpers ────────────────────────────────────────────────────────────────
export const normalizeNumbers = (input: any): string => {
  if (input === null || typeof input === 'undefined') return '';
  const s = String(input);
  const map: Record<string, string> = {
    '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4', '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9',
    '۰': '0', '۱': '1', '۲': '2', '۳': '3', '۴': '4', '۵': '5', '۶': '6', '۷': '7', '۸': '8', '۹': '9'
  };
  return s.split('').map(ch => map[ch] || ch).join('');
};

export const pickPhone = (phones: any, fallback: string = ''): string => {
  const text = normalizeNumbers(phones || '').toString();
  const match = text.match(/\d{11}/);
  if (match && match[0]) return match[0];
  const first = text.split(/\r?\n|,/).map(s => s.trim()).filter(Boolean)[0];
  return first || fallback;
};

export const getOrderData = (order: any) => {
  const orderNumber = order?.orderNumber || order?.order_number || order?.id || '—';
  const customerName = order?.customerName || order?.name || order?.customer_name || 'عميل نقدي';
  const phone1 = pickPhone(order?.phone1 || order?.phone || order?.phone_number || '', '—');
  const phone2 = pickPhone(order?.phone2 || order?.secondary_phone || order?.alt_phone || order?.phone_2 || '', '');
  const gov = order?.governorate || order?.city || order?.gov || 'غير محدد';
  const address = order?.address || order?.full_address || 'غير محدد';
  const notes = order?.notes || order?.note || order?.order_notes || '';
  const dateRaw = order?.created_at || order?.date || order?.order_date;
  const date = dateRaw ? String(dateRaw).slice(0, 10) : new Date().toISOString().slice(0, 10);

  const rawProducts = order?.products || order?.order_items || order?.items || [];
  const products = Array.isArray(rawProducts) && rawProducts.length > 0
    ? rawProducts.map((p: any) => {
      const name = p.name || p.product_name || p.title || 'منتج';
      let size = p.size || p.variant_size || p.item_size || p.size_name || '';
      let color = p.color || p.variant_color || p.item_color || p.color_name || '';

      const variantStr = p.variant || p.variant_name || p.variation || '';
      if (variantStr && typeof variantStr === 'string') {
        const parts = variantStr.split(/[-–—/|,]/).map((s: string) => s.trim()).filter(Boolean);
        if (parts.length >= 2) {
          if (!color) color = parts[0];
          if (!size) size = parts[1];
        } else if (parts.length === 1) {
          if (!size && !color) {
            if (/^(xs|s|m|l|xl|xxl|2xl|3xl|4xl|5xl|\d{2,3})$/i.test(parts[0])) {
              size = parts[0];
            } else {
              color = parts[0];
            }
          }
        }
      }

      size = size || '-';
      color = color || '-';
      const variant = [color !== '-' ? color : '', size !== '-' ? size : ''].filter(Boolean).join(' - ');
      const qty = Number(p.quantity || p.qty || 1);
      const price = Number(p.price || p.price_per_unit || p.sale_price || 0);
      const lineTotal = Number(p.total || p.total_price || p.lineTotal || (price * qty));
      return { name, variant, size, color, qty, price, lineTotal };
    })
    : [{ name: 'طلب عام', variant: '-', size: '-', color: '-', qty: 1, price: Number(order?.total_amount || order?.total || 0), lineTotal: Number(order?.total_amount || order?.total || 0) }];

  const subtotal = products.reduce((acc, p) => acc + p.lineTotal, 0);
  const shipping = Number(order?.shipping || order?.shipping_fees || order?.shippingCost || 0);
  const discount = Number(order?.discount_amount || order?.discountValue || 0);
  const tax = Number(order?.tax_amount || order?.taxValue || 0);
  const total = (order?.total && Number(order.total) > 0)
    ? Number(order.total)
    : (order?.total_amount && Number(order.total_amount) > 0)
      ? Number(order.total_amount)
      : Math.max(0, subtotal - discount + tax + shipping);

  const employee = order?.employee || order?.employee_name || order?.marketer || order?.created_by_name || 'الفرع الرئيسي';
  const page = order?.page || order?.page_name || order?.source || '—';
  const repName = order?.rep_name || order?.representative || '';

  return {
    orderNumber,
    customerName,
    phone1,
    phone2,
    gov,
    address,
    notes,
    date,
    products,
    subtotal,
    shipping,
    discount,
    tax,
    total,
    employee,
    page,
    repName
  };
};

export const resolveWaybillInfo = (props: WaybillProps) => {
  const d = getOrderData(props.order);
  const companyLogo = props.companyLogo || (typeof window !== 'undefined' ? (localStorage.getItem('Dragon_company_logo_url') || localStorage.getItem('Dragon_company_logo')) : null) || assetUrl('Dragon.png');
  const companyPhone = props.companyPhone || (typeof window !== 'undefined' ? localStorage.getItem('Dragon_company_phone') : '') || '01000000000';
  const companyName = props.companyName || (typeof window !== 'undefined' ? localStorage.getItem('Dragon_company_name') : '') || 'اسم الشركة';
  const terms = props.terms || (typeof window !== 'undefined' ? localStorage.getItem('Dragon_company_terms') : '') || 'المعاينة حق للعميل قبل الاستلام لضمان عدم وجود أخطاء في المقاسات والألوان. في حالة المخالفة فالشركة غير مسؤولة. مصاريف الشحن خاصة بشركة الشحن ويتحملها العميل.';
  const companyAddress = props.companyAddress || (typeof window !== 'undefined' ? localStorage.getItem('Dragon_company_address') : '') || '';

  return { d, companyLogo, companyPhone, companyName, terms, companyAddress };
};

export const WAYBILL_TEMPLATES_INFO = [
  { id: 1, name: 'النموذج الكلاسيكي المعتمد', desc: 'تخطيط رسمي بإطار متكامل، باركود علوي في المنتصف، وبطاقة عميل وبيان أصناف شامل.' },
  { id: 2, name: 'البوليصة العصرية المودرن', desc: 'تصميم ناصع ببطاقات مقسمة لمعلومات العميل والطلب والأسعار بدون خطوط ثقيلة.' },
  { id: 3, name: 'بوليصة الشحن السريع (Courier Badge)', desc: 'بطاقة شحن نمط شركات الشحن بمربع بارز للمحافظة والباركود والحسابات.' },
  { id: 4, name: 'النموذج الحراري المنظم (Thermal Style)', desc: 'مخصص للطابعات الحرارية وإيصالات الرول بخطوط واضحة وتفاصيل كاملة.' },
  { id: 5, name: 'نموذج الإيصال المصغر (Compact Slip)', desc: 'إيصال مضغوط بتوزيع دقيق لتوفير المساحة وسرعة القراءة لكافة البنود.' },
  { id: 6, name: 'النموذج الفاخر بإطار مذهب (Royal)', desc: 'برواز راقٍ مناسب للملابس الراقية والعلامات المميزة بكامل الحقول.' },
  { id: 7, name: 'نموذج الكوبون والوصل المنفصل', desc: 'يتضمن كعب إيصال سفلي مقطوع ومخصص للمندوب مع بوليصة كاملة.' },
  { id: 8, name: 'النموذج الشبكي المزدوج (Grid Dashboard)', desc: 'تقسيم البوليصة إلى شبكة مربعات منظمة للعميل والطرد والشحن والملاحظات.' },
  { id: 9, name: 'بوليصة الشحن ذات الباركود المزدوج', desc: 'باركود علوي للأوردر وباركود سفلي للتسليم السريع وتتبع الشحنة.' },
  { id: 10, name: 'النموذج الضريبي الرسمي', desc: 'جدول تفصيلي مع خانات الضريبة والخصومات الصافية والشحن وتفاصيل الأوردر.' },
  { id: 11, name: 'النموذج البسيط الاسكندنافي (Minimal)', desc: 'تصميم بسيط بخطوط خفيفة ومساحات واضحة وشاملة لجميع بيانات الشحنة.' },
  { id: 12, name: 'بوليصة الصندوق والتغليف (Box Label)', desc: 'ملصق طرود يتضمن علامات تنبيهية (قابل للكسر 📦) ومحافظة بارزة وبيان أصناف.' },
  { id: 13, name: 'نموذج الهيدر المتباين الداكن (Dark Header)', desc: 'شريط علوي داكن متباين مع لوجو بارز ومربعات مظللة للحقول الهامة.' },
  { id: 14, name: 'نموذج البطاقة المقسمة (Split Card)', desc: 'تصميم مقسم لعمودين (يمين: العميل والوجهة، ويسار: الأصناف والحسابات).' },
  { id: 15, name: 'نموذج قائمة تجهيز الطرود (Packing Slip)', desc: 'قائمة فحص للمنتجات مع Checkboxes لتجهيز وتغليف الشحنات وبيانات الدفع.' },
  { id: 16, name: 'النموذج الهندسي الحديث (Geometric)', desc: 'تصميم أنيق مع زوايا حادة وعلامات ترقيم مميزة للأقسام.' },
  { id: 17, name: 'بوليصة الدفع عند الاستلام البارزة (COD Bold)', desc: 'تركيز بصري فائق ومربع تحصيل ضخم للمبلغ المطلوب لتجنب أخطاء المناديب.' },
  { id: 18, name: 'النموذج المتكامل متعدد الأقسام', desc: 'تقسيم احترافي للبيانات والمنتجات وسياسة الاسترجاع والشحن والموظف.' },
  { id: 19, name: 'نموذج شارة الشحن والشحن السريع (Freight Tag)', desc: 'أرقام تسلسلية ضخمة ورمز المحافظة بكود بارز وبيان تسليم متكامل.' },
  { id: 20, name: 'النموذج المحمي بالختم والتوقيع (Certified)', desc: 'منطقة مخصصة لختم الشركة وتوقيع المستلم وشروط حماية التاجر.' },
  { id: 21, name: 'بوليصة البوتيك والملابس الراقية (Suits Style)', desc: 'تصميم فخم بنمط البوتيك مع ريبون كحلي، عنوان كامل بسطر مستقل، وجدول مقاسات وألوان.' },
  { id: 22, name: 'النموذج الأخضر المستدام (Eco Green)', desc: 'تصميم مريح باللون الأخضر مع هيدر ناعم وجداول واضحة لكافة التفاصيل.' },
  { id: 23, name: 'النموذج البرتقالي السريع (Fast Orange)', desc: 'طابع حيوي باللون البرتقالي مخصص للشحنات السريعة والمستعجلة.' },
  { id: 24, name: 'النموذج الأزرق البحري (Navy Executive)', desc: 'طابع تنفيذي راقٍ بأسلوب الشركات باللون الكحلي والرمادي.' },
  { id: 25, name: 'نموذج التوصيل المنزلي (Home Direct)', desc: 'تركيز مباشر على بيانات العنوان الدقيق ورقم الهاتف مع صندوق التحصيل.' },
  { id: 26, name: 'نموذج المخزن والمنافيست (Warehouse Cargo)', desc: 'تنسيق شبيه بإيصالات الإفراج وتجهيز الشحنات للمستودعات.' },
  { id: 27, name: 'نموذج الإيصال العريض (Wide Header)', desc: 'هيدر بارز بعرض البوليصة بالكامل يحتوي كافة بيانات المتجر ورقم الطلب.' },
  { id: 28, name: 'النموذج البنفسجي العصري (Modern Violet)', desc: 'تصميم ملفت بلمسات Violet جذابة وبطاقات مستديرة الزوايا.' },
  { id: 29, name: 'نموذج الكارت الشخصي (Personal Card)', desc: 'تصميم مصمم على هيئة كارت تسليم مخصص للمبيعات والشحن.' },
  { id: 30, name: 'نموذج الإيصال المزدوج الألوان (Dual Tone)', desc: 'تباين احترافي بين الأسود والرمادي الداكن لإبراز خانات التحصيل.' },
  { id: 31, name: 'نموذج الشحن اللوجستي (Logistics Pro)', desc: 'تنسيق مخصص لشركات اللوجستيات مع أرقام تتبع ومحافظات بارزة.' },
  { id: 32, name: 'نموذج البطاقة المزدوجة (Double Badge)', desc: 'بطاقتان منفصلتان أعلى وأسفل البوليصة لتسهيل مراجعة الحسابات.' },
  { id: 33, name: 'النموذج الرمادي المحايد (Neutral Gray)', desc: 'تصميم هادئ بخطوط رمادية خفيفة مناسب لكافة أنواع الطابعات.' },
  { id: 34, name: 'نموذج التسليم مع التوقيع (Delivery Proof)', desc: 'يحتوي على مربع خصيصاً لتوقيع العميل عند الاستلام ورقم القومي.' },
  { id: 35, name: 'نموذج المبيعات المباشرة (Direct Sale)', desc: 'يركز على تفاصيل أسعار المنتجات الصافية والخصم والشحن والتحصيل.' },
  { id: 36, name: 'النموذج الأحمر البارز (Crimson Red)', desc: 'إطار وشريط أحمر لجذب الانتباه للملاحظات الهامة والمبلغ المطلوب.' },
  { id: 37, name: 'نموذج التتبع الذكي (Smart Track)', desc: 'تنسيق حديث يركز على كود التتبع والباركود في أعلى البوليصة بشكل مميز.' },
  { id: 38, name: 'نموذج المتجر الإلكتروني (E-Commerce Label)', desc: 'تصميم المتاجر الحديثة مع شارات للدروب شيبينغ وأوردرات الأونلاين.' },
  { id: 39, name: 'النموذج العسكري المقلم (Structured Strip)', desc: 'أشرطة جانبية مضلعة مع تقسيمات دقيقة للغاية لجميع الخانات.' },
  { id: 40, name: 'نموذج التسليم بالفاتورة التفصيلية (Detailed Invoice)', desc: 'جدول أسعار موسع يعرض الخصومات والشحن والإجمالي الصافي.' },
  { id: 41, name: 'نموذج البوتيك الناعم (Soft Boutique)', desc: 'تصميم ناعم بألوان وردية ورمادية خفيفة لمتاجر التجميل والأزياء النسائية.' },
  { id: 42, name: 'نموذج الإيصال الكلاسيكي المزدوج (Classic Duplicate)', desc: 'يتضمن خانتين منفصلتين للمندوب والعميل مع خط فصل منقط.' },
  { id: 43, name: 'نموذج بطاقة المحافظات (Governorate Focus)', desc: 'يبرز اسم المحافظة والمدينة بخط ضخم جداً للتوزيع السريع بالمحافظات.' },
  { id: 44, name: 'نموذج الشحن الداخلي (Local Courier)', desc: 'تصميم مخصص للتوصيل المحلي السريع داخل المدينة والفرع.' },
  { id: 45, name: 'النموذج الأنيق بالخلفية الرمادية (Slate Soft)', desc: 'خلفيات رمادية مريحة للعين مع تنظيم احترافي للبيانات.' },
  { id: 46, name: 'نموذج إيصال الدفع النقدي (Cash Voucher)', desc: 'مصمم كإيصال قبض ونقل ملكية الشحنة مع خانة المبلغ الصافي.' },
  { id: 47, name: 'نموذج الطرد الآمن (Safe Cargo)', desc: 'يتضمن تحذيرات السلامة والاسترجاع بداخل برواز سميك محمي.' },
  { id: 48, name: 'نموذج المتاجر المتعددة (Multi-Store)', desc: 'يستعرض اسم الصفحة والفرع والموظف بشكل واضح في أعلى البوليصة.' },
  { id: 49, name: 'النموذج الشبكي الفائق (Ultra Grid)', desc: 'مقسم بالكامل على شكل جداول وخانات بدون أي مساحات مهدرة.' },
  { id: 50, name: 'البوليصة الشاملة الذكية (Universal Ultimate)', desc: 'النموذج الشامل المكتمل المصمم بأحدث المعايير مع إبراز كود الأوردر ومبلغ التحصيل.' }
];

export interface CustomWaybillTemplate {
  id: string | number;
  name: string;
  type: 'advanced' | 'quick';
  data: any;
  createdAt: string;
  updatedAt: string;
}

export type CanvasItemType = 'text' | 'barcode' | 'qr' | 'logo' | 'image' | 'table' | 'rect' | 'circle' | 'line' | 'dynamic';

export interface CanvasItem {
  id: string;
  type: CanvasItemType;
  dynamicKey?: string;
  x: number;
  y: number;
  width: number | string;
  height: number | string;
  content?: string;
  src?: string;
  isLocked?: boolean;
  style: {
    color?: string;
    backgroundColor?: string;
    fontSize?: number;
    fontWeight?: string;
    fontStyle?: string;
    textAlign?: 'left' | 'center' | 'right';
    borderWidth?: number;
    borderColor?: string;
    borderRadius?: number;
    borderStyle?: 'solid' | 'dashed' | 'dotted';
    padding?: number;
    opacity?: number;
    zIndex?: number;
  };
}

export const getCustomWaybillTemplates = (): CustomWaybillTemplate[] => {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem('Dragon_custom_waybill_templates');
    let list: CustomWaybillTemplate[] = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(list)) list = [];

    // Auto-migration: check legacy advanced (51) and quick (52) templates
    let modified = false;
    const legacyAdv = localStorage.getItem('Dragon_advanced_waybill_template');
    if (legacyAdv && !list.some(t => String(t.id) === '51')) {
      try {
        const parsed = JSON.parse(legacyAdv);
        list.push({
          id: 51,
          name: parsed.name || 'قالب مخصص متقدم (51)',
          type: 'advanced',
          data: parsed,
          createdAt: parsed.savedAt || new Date().toISOString(),
          updatedAt: parsed.savedAt || new Date().toISOString()
        });
        modified = true;
      } catch (e) { }
    }

    const legacyQuick = localStorage.getItem('Dragon_quick_waybill_template');
    if (legacyQuick && !list.some(t => String(t.id) === '52')) {
      try {
        const parsed = JSON.parse(legacyQuick);
        list.push({
          id: 52,
          name: parsed.name || 'قالب مخصص سريع (52)',
          type: 'quick',
          data: parsed,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
        modified = true;
      } catch (e) { }
    }

    if (modified) {
      localStorage.setItem('Dragon_custom_waybill_templates', JSON.stringify(list));
    }
    return list;
  } catch (e) {
    console.error('Error reading custom waybill templates', e);
    return [];
  }
};

export const saveCustomWaybillTemplate = (
  template: Omit<CustomWaybillTemplate, 'id' | 'createdAt' | 'updatedAt'> & { id?: string | number }
): CustomWaybillTemplate => {
  const list = getCustomWaybillTemplates();
  const now = new Date().toISOString();
  let savedItem: CustomWaybillTemplate;

  if (template.id) {
    const existingIndex = list.findIndex(t => String(t.id) === String(template.id));
    if (existingIndex >= 0) {
      savedItem = {
        ...list[existingIndex],
        ...template,
        id: template.id,
        updatedAt: now
      };
      list[existingIndex] = savedItem;
    } else {
      savedItem = {
        ...template,
        id: template.id,
        createdAt: now,
        updatedAt: now
      };
      list.push(savedItem);
    }
  } else {
    const newId = 'custom_' + Date.now();
    savedItem = {
      ...template,
      id: newId,
      createdAt: now,
      updatedAt: now
    };
    list.push(savedItem);
  }

  try {
    localStorage.setItem('Dragon_custom_waybill_templates', JSON.stringify(list));
    // Keep legacy keys updated for immediate compatibility
    if (savedItem.type === 'advanced') {
      localStorage.setItem('Dragon_advanced_waybill_template', JSON.stringify(savedItem.data));
    } else if (savedItem.type === 'quick') {
      localStorage.setItem('Dragon_quick_waybill_template', JSON.stringify(savedItem.data));
    }
    // Sync to backend settings table
    fetch(`${API_BASE_PATH}/save_settings.php`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: 'custom_waybill_templates', value: JSON.stringify(list) })
    }).catch(() => null);
  } catch (e) {
    console.error('Failed to persist custom waybill template', e);
  }

  return savedItem;
};

export const deleteCustomWaybillTemplate = (id: string | number): void => {
  try {
    let list = getCustomWaybillTemplates();
    list = list.filter(t => String(t.id) !== String(id));
    localStorage.setItem('Dragon_custom_waybill_templates', JSON.stringify(list));

    // If the deleted template was the active default, revert to template 1
    const currentActive = getSelectedTemplateId();
    if (String(currentActive) === String(id)) {
      setSelectedTemplateId(1);
    }

    // Sync to backend
    fetch(`${API_BASE_PATH}/save_settings.php`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: 'custom_waybill_templates', value: JSON.stringify(list) })
    }).catch(() => null);
  } catch (e) {
    console.error('Failed to delete custom waybill template', e);
  }
};

export const getSelectedTemplateId = (): number | string => {
  try {
    const saved = localStorage.getItem('Dragon_waybill_template');
    if (saved) {
      if (!isNaN(Number(saved))) {
        return Number(saved);
      }
      return saved;
    }
  } catch (e) { }
  return 1;
};

export const setSelectedTemplateId = (id: number | string): void => {
  try {
    localStorage.setItem('Dragon_waybill_template', String(id));
    fetch(`${API_BASE_PATH}/save_settings.php`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: 'waybill_template', value: String(id) })
    }).catch(() => null);
  } catch (e) {
    console.error('Failed to set selected template ID', e);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// REUSABLE 6-COLUMN PRODUCTS TABLE COMPONENT (اسم المنتج، المقاس، اللون، الكمية، السعر، الإجمالي)
// ─────────────────────────────────────────────────────────────────────────────
export const WaybillProductsTable: React.FC<{
  products: any[];
  headerBg?: string;
  headerTextColor?: string;
  borderColor?: string;
  rowBorderColor?: string;
  className?: string;
  showCheckboxes?: boolean;
  striped?: boolean;
  altRowBg?: string;
}> = ({
  products,
  headerBg = 'bg-slate-100',
  headerTextColor = 'text-slate-800',
  borderColor = 'border-slate-300',
  rowBorderColor = 'border-slate-200',
  className = '',
  showCheckboxes = false,
  striped = false,
  altRowBg = 'bg-slate-50/50'
}) => {
    const pList = products || [];
    const pCount = pList.length;
    // Adaptive scaling based on number of items (e.g. 10 products in 1/4 A4)
    const isCompact = pCount >= 4 && pCount <= 6;
    const isUltraCompact = pCount >= 7;

    const headerFontSize = isUltraCompact ? 'text-[8px]' : isCompact ? 'text-[8.5px]' : 'text-[9.5px]';
    const nameFontSize = isUltraCompact ? 'text-[8px]' : isCompact ? 'text-[9px]' : 'text-[10px]';
    const cellFontSize = isUltraCompact ? 'text-[7.5px]' : isCompact ? 'text-[8.5px]' : 'text-[9.5px]';
    const cellPadding = isUltraCompact ? 'py-[1.5px] px-1' : isCompact ? 'py-0.5 px-1' : 'py-1 px-1';
    const headerPadding = isUltraCompact ? 'py-0.5 px-1' : 'py-1 px-1';

    return (
      <div className={`w-full overflow-hidden border ${borderColor} rounded-sm ${isUltraCompact ? 'my-0.5' : 'my-1'} ${className}`}>
        <table className="w-full text-right border-collapse select-none" style={{ tableLayout: 'fixed' }}>
          <thead className={`${headerBg} ${headerTextColor} ${headerFontSize} font-black`}>
            <tr className={`border-b ${borderColor}`}>
              {showCheckboxes && <th className={`${headerPadding} text-center`} style={{ width: '7%' }}>فحص</th>}
              <th className={`${headerPadding} text-right`} style={{ width: showCheckboxes ? '33%' : '38%' }}>المنتج</th>
              <th className={`${headerPadding} text-center`} style={{ width: '11%' }}>المقاس</th>
              <th className={`${headerPadding} text-center`} style={{ width: '16%' }}>اللون</th>
              <th className={`${headerPadding} text-center`} style={{ width: '9%' }}>الكمية</th>
              <th className={`${headerPadding} text-center`} style={{ width: '11%' }}>السعر</th>
              <th className={`${headerPadding} text-left`} style={{ width: showCheckboxes ? '13%' : '15%' }}>الإجمالي</th>
            </tr>
          </thead>
          <tbody className={`divide-y ${rowBorderColor} bg-white`}>
            {pList.map((p, i) => (
              <tr key={i} className={striped && i % 2 === 1 ? altRowBg : 'hover:bg-black/[0.02]'}>
                {showCheckboxes && (
                  <td className={`${cellPadding} text-center text-gray-400`}>
                    <span className="inline-block w-3 h-3 border border-gray-400 rounded-xs"></span>
                  </td>
                )}
                <td
                  className={`${cellPadding} ${nameFontSize} font-bold text-right text-gray-900 break-words leading-tight whitespace-normal`}
                  title={p.name}
                  style={{ wordBreak: 'break-word' }}
                >
                  {p.name}
                </td>
                <td
                  className={`${cellPadding} ${cellFontSize} text-center font-mono font-medium text-gray-700 break-words leading-tight whitespace-normal`}
                  title={p.size || '-'}
                  style={{ wordBreak: 'break-word' }}
                >
                  {p.size || '-'}
                </td>
                <td
                  className={`${cellPadding} ${cellFontSize} text-center text-gray-700 break-words leading-tight whitespace-normal`}
                  title={p.color || '-'}
                  style={{ wordBreak: 'break-word' }}
                >
                  {p.color || '-'}
                </td>
                <td className={`${cellPadding} ${cellFontSize} text-center font-black font-mono text-gray-900`}>
                  {p.qty}
                </td>
                <td className={`${cellPadding} ${cellFontSize} text-center font-mono text-gray-700`}>
                  {p.price}
                </td>
                <td className={`${cellPadding} ${cellFontSize} text-left font-mono font-black text-gray-900`}>
                  {p.lineTotal ? p.lineTotal.toLocaleString() : '0'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

// ─────────────────────────────────────────────────────────────────────────────
// THEMED ENGINE & CONFIGURATION FOR ALL 50 TEMPLATES
// ─────────────────────────────────────────────────────────────────────────────
interface TemplateThemeConfig {
  containerClass: string;
  fontFamily?: string;
  headerType?: 'standard' | 'banner' | 'dark' | 'ribbon' | 'thermal' | 'minimal' | 'boxed' | 'split' | 'brand-badge';
  headerBg?: string;
  headerTextColor?: string;
  headerBorderColor?: string;
  govBadgeClass?: string;
  customerBoxClass?: string;
  tableHeaderBg?: string;
  tableHeaderTextColor?: string;
  tableBorderColor?: string;
  tableStriped?: boolean;
  tableShowCheckboxes?: boolean;
  totalBoxClass?: string;
  notesClass?: string;
  footerClass?: string;
  termsClass?: string;
  specialType?: 'cut-stub' | 'dual-barcode' | 'fragile-box' | 'stamp-box' | 'cod-bold' | 'ribbon' | 'gov-focus' | 'step-numbered' | 'split-view';
}

export const TEMPLATE_THEMES: Record<number, TemplateThemeConfig> = {
  // 1. Classic Standard
  1: {
    containerClass: 'border-2 border-slate-900 rounded-none bg-white',
    headerType: 'standard',
    govBadgeClass: 'bg-slate-900 text-white px-2.5 py-0.5 rounded-sm font-bold text-xs',
    customerBoxClass: 'border border-slate-400 p-2 rounded-sm bg-slate-50/50',
    tableHeaderBg: 'bg-slate-200',
    tableHeaderTextColor: 'text-slate-900',
    tableBorderColor: 'border-slate-400',
    totalBoxClass: 'border border-slate-900 p-2 rounded-sm bg-slate-100 font-bold',
  },
  // 2. Modern Indigo
  2: {
    containerClass: 'border border-indigo-200 rounded-xl shadow-sm bg-white',
    headerType: 'standard',
    govBadgeClass: 'bg-indigo-600 text-white px-2.5 py-0.5 rounded-full font-bold text-xs',
    customerBoxClass: 'border border-indigo-100 p-2 rounded-lg bg-indigo-50/40',
    tableHeaderBg: 'bg-indigo-900 text-white',
    tableHeaderTextColor: 'text-white',
    tableBorderColor: 'border-indigo-200',
    totalBoxClass: 'bg-indigo-900 text-white p-2 rounded-lg shadow-sm font-black',
  },
  // 3. Courier Badge
  3: {
    containerClass: 'border-2 border-amber-500 rounded-lg bg-white',
    headerType: 'banner',
    headerBg: 'bg-amber-500 text-black',
    headerTextColor: 'text-black',
    govBadgeClass: 'bg-black text-amber-400 px-2.5 py-0.5 rounded font-black text-xs',
    customerBoxClass: 'border border-amber-300 p-2 rounded bg-amber-50/40',
    tableHeaderBg: 'bg-amber-100',
    tableHeaderTextColor: 'text-amber-950',
    tableBorderColor: 'border-amber-300',
    totalBoxClass: 'bg-black text-amber-400 p-2 rounded font-black text-sm',
  },
  // 4. Thermal Style
  4: {
    containerClass: 'border-2 border-dashed border-black rounded-none bg-white font-mono',
    headerType: 'thermal',
    govBadgeClass: 'border border-black px-2 py-0.5 font-black text-xs',
    customerBoxClass: 'border-y border-dashed border-black p-2 font-sans',
    tableHeaderBg: 'bg-gray-100',
    tableHeaderTextColor: 'text-black',
    tableBorderColor: 'border-dashed border-black',
    totalBoxClass: 'border-2 border-black p-2 font-black',
  },
  // 5. Compact Slip
  5: {
    containerClass: 'border border-slate-300 rounded-sm bg-white',
    headerType: 'standard',
    govBadgeClass: 'bg-slate-700 text-white px-2 py-0.5 rounded font-bold text-[11px]',
    customerBoxClass: 'border border-slate-200 p-1.5 rounded bg-slate-50',
    tableHeaderBg: 'bg-slate-100',
    tableHeaderTextColor: 'text-slate-800',
    tableBorderColor: 'border-slate-200',
    totalBoxClass: 'border border-slate-400 p-1.5 rounded bg-slate-100 font-bold',
  },
  // 6. Luxury Royal
  6: {
    containerClass: 'border-2 border-amber-700 rounded-md bg-amber-50/15 font-serif',
    headerType: 'standard',
    govBadgeClass: 'bg-amber-900 text-amber-100 px-3 py-0.5 rounded font-bold text-xs',
    customerBoxClass: 'border border-amber-300 p-2 rounded bg-amber-50/60 font-sans',
    tableHeaderBg: 'bg-amber-900 text-amber-50',
    tableHeaderTextColor: 'text-amber-50',
    tableBorderColor: 'border-amber-600',
    totalBoxClass: 'bg-amber-900 text-amber-100 p-2 rounded font-black',
  },
  // 7. Receipt Stub
  7: {
    containerClass: 'border border-slate-400 rounded-sm bg-white',
    headerType: 'standard',
    govBadgeClass: 'bg-blue-900 text-white px-2 py-0.5 rounded font-bold text-xs',
    customerBoxClass: 'border border-slate-200 p-1.5 rounded bg-slate-50',
    tableHeaderBg: 'bg-slate-200 text-slate-800',
    tableBorderColor: 'border-slate-300',
    totalBoxClass: 'border border-slate-300 p-1.5 rounded font-bold',
    specialType: 'cut-stub'
  },
  // 8. Grid Dashboard
  8: {
    containerClass: 'border-2 border-slate-800 rounded-sm bg-white',
    headerType: 'standard',
    govBadgeClass: 'bg-slate-800 text-white px-2 py-0.5 rounded font-black text-xs',
    customerBoxClass: 'border border-slate-800 p-1.5 rounded bg-slate-50',
    tableHeaderBg: 'bg-slate-800 text-white',
    tableHeaderTextColor: 'text-white',
    tableBorderColor: 'border-slate-800',
    totalBoxClass: 'bg-slate-900 text-emerald-400 p-2 rounded font-black',
  },
  // 9. Dual Barcode
  9: {
    containerClass: 'border-2 border-black rounded-none bg-white',
    headerType: 'standard',
    govBadgeClass: 'bg-yellow-300 text-black px-2 py-0.5 font-black text-xs',
    customerBoxClass: 'border border-black p-1.5 bg-gray-50',
    tableHeaderBg: 'bg-gray-200 text-black',
    tableBorderColor: 'border-black',
    totalBoxClass: 'border border-black p-1.5 font-black bg-gray-100',
    specialType: 'dual-barcode'
  },
  // 10. Formal Tax
  10: {
    containerClass: 'border border-slate-900 rounded-none bg-white',
    headerType: 'standard',
    govBadgeClass: 'bg-slate-900 text-white px-2 py-0.5 font-black text-xs',
    customerBoxClass: 'border border-slate-300 p-2 bg-slate-50',
    tableHeaderBg: 'bg-slate-200 text-slate-900',
    tableBorderColor: 'border-slate-900',
    totalBoxClass: 'border border-slate-900 p-2 font-black bg-slate-50',
  },
  // 11. Minimalist
  11: {
    containerClass: 'border border-slate-300 rounded-lg bg-white',
    headerType: 'minimal',
    govBadgeClass: 'border border-slate-400 px-2 py-0.5 rounded font-bold text-xs text-slate-800',
    customerBoxClass: 'border-b border-slate-200 pb-2 mb-1',
    tableHeaderBg: 'bg-slate-50 text-slate-600',
    tableBorderColor: 'border-slate-200',
    totalBoxClass: 'border-t border-slate-300 pt-1.5 font-black text-slate-900',
  },
  // 12. Box Label
  12: {
    containerClass: 'border-2 border-dashed border-slate-800 rounded-md bg-white',
    headerType: 'banner',
    headerBg: 'bg-slate-900 text-white',
    headerTextColor: 'text-white',
    govBadgeClass: 'bg-amber-400 text-slate-950 px-2.5 py-0.5 rounded font-black text-xs',
    customerBoxClass: 'border border-slate-800 p-2 rounded bg-amber-50/30',
    tableHeaderBg: 'bg-slate-100 text-slate-900',
    tableBorderColor: 'border-slate-800',
    totalBoxClass: 'bg-slate-100 border-2 border-slate-800 p-2 rounded font-black',
    specialType: 'fragile-box'
  },
  // 13. Dark Header
  13: {
    containerClass: 'border border-slate-300 rounded-lg bg-white',
    headerType: 'dark',
    headerBg: 'bg-slate-900 text-white',
    headerTextColor: 'text-white',
    govBadgeClass: 'bg-amber-400 text-slate-950 px-2.5 py-0.5 rounded font-black text-xs',
    customerBoxClass: 'border border-slate-200 p-2 rounded-md bg-slate-50',
    tableHeaderBg: 'bg-slate-800 text-white',
    tableHeaderTextColor: 'text-white',
    tableBorderColor: 'border-slate-200',
    totalBoxClass: 'bg-amber-50 border border-amber-300 p-2 rounded-md font-black text-amber-950',
  },
  // 14. Split View
  14: {
    containerClass: 'border-2 border-slate-800 rounded-md bg-white',
    headerType: 'standard',
    govBadgeClass: 'bg-blue-900 text-white px-2 py-0.5 rounded font-bold text-xs',
    customerBoxClass: 'border border-slate-200 p-2 rounded bg-slate-50',
    tableHeaderBg: 'bg-slate-100',
    tableBorderColor: 'border-slate-300',
    totalBoxClass: 'bg-slate-900 text-white p-2 rounded font-black',
  },
  // 15. Packing Slip (Checklist)
  15: {
    containerClass: 'border border-slate-400 rounded-md bg-white',
    headerType: 'standard',
    govBadgeClass: 'bg-slate-800 text-white px-2 py-0.5 rounded font-bold text-xs',
    customerBoxClass: 'border border-slate-300 p-2 rounded bg-slate-50',
    tableHeaderBg: 'bg-slate-200 text-slate-900',
    tableBorderColor: 'border-slate-400',
    tableShowCheckboxes: true,
    totalBoxClass: 'border border-slate-400 p-2 rounded bg-slate-100 font-black',
  },
  // 16. Geometric
  16: {
    containerClass: 'border-t-4 border-indigo-600 border-x border-b border-slate-300 rounded-sm bg-white',
    headerType: 'standard',
    govBadgeClass: 'bg-indigo-100 text-indigo-900 border border-indigo-300 px-2 py-0.5 rounded-sm font-black text-xs',
    customerBoxClass: 'border border-indigo-100 p-2 rounded-sm bg-indigo-50/40',
    tableHeaderBg: 'bg-indigo-600 text-white',
    tableHeaderTextColor: 'text-white',
    tableBorderColor: 'border-indigo-200',
    totalBoxClass: 'bg-indigo-600 text-white p-2 rounded-sm font-black',
  },
  // 17. COD Bold
  17: {
    containerClass: 'border-2 border-red-600 rounded-md bg-white',
    headerType: 'banner',
    headerBg: 'bg-red-600 text-white',
    headerTextColor: 'text-white',
    govBadgeClass: 'bg-red-700 text-white px-2.5 py-0.5 rounded font-black text-xs',
    customerBoxClass: 'border border-red-200 p-2 rounded bg-red-50/30',
    tableHeaderBg: 'bg-red-50 text-red-950 border-red-200',
    tableBorderColor: 'border-red-200',
    totalBoxClass: 'bg-yellow-300 border-2 border-slate-900 text-slate-950 p-2 rounded font-black text-base',
    specialType: 'cod-bold'
  },
  // 18. Segmented Steps
  18: {
    containerClass: 'border border-slate-300 rounded-md bg-white',
    headerType: 'standard',
    govBadgeClass: 'bg-blue-900 text-white px-2 py-0.5 rounded font-bold text-xs',
    customerBoxClass: 'border border-blue-100 p-2 rounded bg-blue-50/40',
    tableHeaderBg: 'bg-slate-100 text-slate-900',
    tableBorderColor: 'border-slate-200',
    totalBoxClass: 'border border-slate-300 p-2 rounded bg-slate-50 font-black',
    specialType: 'step-numbered'
  },
  // 19. Freight Tag
  19: {
    containerClass: 'border-2 border-black rounded-none bg-white font-mono',
    headerType: 'standard',
    govBadgeClass: 'bg-black text-white px-2.5 py-0.5 font-black text-xs',
    customerBoxClass: 'border border-black p-2 font-sans',
    tableHeaderBg: 'bg-gray-200 text-black',
    tableBorderColor: 'border-black',
    totalBoxClass: 'bg-black text-white p-2 font-black font-sans',
  },
  // 20. Secure Stamp
  20: {
    containerClass: 'border-2 border-slate-900 rounded-md bg-white',
    headerType: 'standard',
    govBadgeClass: 'bg-slate-900 text-white px-2 py-0.5 rounded font-bold text-xs',
    customerBoxClass: 'border border-slate-300 p-2 rounded bg-slate-50',
    tableHeaderBg: 'bg-slate-800 text-white',
    tableHeaderTextColor: 'text-white',
    tableBorderColor: 'border-slate-300',
    totalBoxClass: 'border border-slate-900 p-2 rounded bg-slate-100 font-black',
    specialType: 'stamp-box'
  },
  // 21. Suits Boutique
  21: {
    containerClass: 'border-2 border-[#eed8dc] rounded-sm bg-[#fefdfd] text-[#2c1e23]',
    headerType: 'ribbon',
    govBadgeClass: 'bg-white text-[#914d61] border border-[#eed8dc] px-2.5 py-0.5 rounded font-black text-xs shadow-2xs',
    customerBoxClass: 'border border-[#eed8dc] p-2 rounded-lg bg-[#fbf5f6]',
    tableHeaderBg: 'bg-[#914d61] text-white',
    tableHeaderTextColor: 'text-white',
    tableBorderColor: 'border-[#eed8dc]',
    totalBoxClass: 'bg-[#914d61] text-white p-2 rounded-md font-black shadow-xs',
    specialType: 'ribbon'
  },
  // 22. Eco Green
  22: {
    containerClass: 'border-2 border-emerald-600 rounded-md bg-emerald-50/15 text-emerald-950',
    headerType: 'banner',
    headerBg: 'bg-emerald-700 text-white',
    headerTextColor: 'text-white',
    govBadgeClass: 'bg-emerald-100 text-emerald-900 border border-emerald-300 px-2 py-0.5 rounded font-bold text-xs',
    customerBoxClass: 'border border-emerald-200 p-2 rounded bg-white',
    tableHeaderBg: 'bg-emerald-100 text-emerald-900',
    tableBorderColor: 'border-emerald-300',
    totalBoxClass: 'bg-emerald-700 text-white p-2 rounded font-black',
  },
  // 23. Fast Orange
  23: {
    containerClass: 'border-2 border-orange-500 rounded-md bg-white',
    headerType: 'standard',
    govBadgeClass: 'bg-orange-500 text-white px-2 py-0.5 rounded font-bold text-xs',
    customerBoxClass: 'border border-orange-200 p-2 rounded bg-orange-50/30',
    tableHeaderBg: 'bg-orange-100 text-orange-950',
    tableBorderColor: 'border-orange-300',
    totalBoxClass: 'bg-orange-500 text-white p-2 rounded font-black',
  },
  // 24. Navy Executive
  24: {
    containerClass: 'border-2 border-slate-900 rounded-md bg-slate-50/30',
    headerType: 'banner',
    headerBg: 'bg-slate-900 text-white',
    headerTextColor: 'text-white',
    govBadgeClass: 'bg-slate-200 text-slate-900 px-2 py-0.5 rounded font-black text-xs',
    customerBoxClass: 'border border-slate-300 p-2 rounded bg-white',
    tableHeaderBg: 'bg-slate-800 text-white',
    tableHeaderTextColor: 'text-white',
    tableBorderColor: 'border-slate-300',
    totalBoxClass: 'bg-slate-900 text-white p-2 rounded font-black',
  },
  // 25. Home Direct
  25: {
    containerClass: 'border-2 border-sky-600 rounded-md bg-white',
    headerType: 'standard',
    govBadgeClass: 'bg-sky-700 text-white px-2 py-0.5 rounded font-bold text-xs',
    customerBoxClass: 'border border-sky-200 p-2 rounded bg-sky-50/30',
    tableHeaderBg: 'bg-sky-100 text-sky-950',
    tableBorderColor: 'border-sky-300',
    totalBoxClass: 'bg-sky-800 text-white p-2 rounded font-black',
  },
  // 26. Warehouse Cargo
  26: {
    containerClass: 'border-2 border-slate-700 rounded-none bg-white font-mono',
    headerType: 'standard',
    govBadgeClass: 'bg-slate-800 text-white px-2 py-0.5 font-bold text-xs',
    customerBoxClass: 'border border-slate-700 p-1.5 font-sans bg-slate-50',
    tableHeaderBg: 'bg-slate-200 text-slate-900',
    tableBorderColor: 'border-slate-700',
    totalBoxClass: 'bg-slate-800 text-white p-2 font-black font-sans',
  },
  // 27. Wide Header
  27: {
    containerClass: 'border border-slate-400 rounded-md bg-white',
    headerType: 'banner',
    headerBg: 'bg-slate-200 text-slate-900',
    headerTextColor: 'text-slate-900',
    govBadgeClass: 'bg-blue-900 text-white px-2 py-0.5 rounded font-bold text-xs',
    customerBoxClass: 'border border-slate-300 p-2 rounded bg-slate-50',
    tableHeaderBg: 'bg-slate-100',
    tableBorderColor: 'border-slate-300',
    totalBoxClass: 'bg-slate-900 text-white p-2 rounded font-black',
  },
  // 28. Modern Violet
  28: {
    containerClass: 'border-2 border-purple-600 rounded-lg bg-purple-50/20 text-purple-950',
    headerType: 'standard',
    govBadgeClass: 'bg-purple-600 text-white px-2 py-0.5 rounded font-bold text-xs',
    customerBoxClass: 'border border-purple-200 p-2 rounded bg-white',
    tableHeaderBg: 'bg-purple-100 text-purple-950',
    tableBorderColor: 'border-purple-300',
    totalBoxClass: 'bg-purple-700 text-white p-2 rounded font-black',
  },
  // 29. Personal Card
  29: {
    containerClass: 'border-2 border-slate-400 rounded-xl bg-white shadow-xs',
    headerType: 'standard',
    govBadgeClass: 'bg-blue-100 text-blue-900 border border-blue-200 px-2 py-0.5 rounded font-bold text-xs',
    customerBoxClass: 'border border-slate-200 p-2 rounded-lg bg-slate-50',
    tableHeaderBg: 'bg-slate-100 text-slate-800',
    tableBorderColor: 'border-slate-200',
    totalBoxClass: 'bg-slate-900 text-amber-400 p-2 rounded-lg font-black',
  },
  // 30. Dual Tone
  30: {
    containerClass: 'border-2 border-black rounded-none bg-white',
    headerType: 'banner',
    headerBg: 'bg-black text-white',
    headerTextColor: 'text-white',
    govBadgeClass: 'bg-black text-white px-2 py-0.5 font-black text-xs',
    customerBoxClass: 'border border-black p-2 bg-gray-50',
    tableHeaderBg: 'bg-gray-200 text-black',
    tableBorderColor: 'border-black',
    totalBoxClass: 'bg-black text-white p-2 font-black',
  },
  // 31. Logistics Pro
  31: {
    containerClass: 'border-2 border-sky-700 rounded-md bg-white',
    headerType: 'banner',
    headerBg: 'bg-sky-800 text-white',
    headerTextColor: 'text-white',
    govBadgeClass: 'bg-sky-100 text-sky-900 border border-sky-300 px-2 py-0.5 rounded font-bold text-xs',
    customerBoxClass: 'border border-sky-200 p-2 rounded bg-sky-50/40',
    tableHeaderBg: 'bg-sky-50 text-sky-950',
    tableBorderColor: 'border-sky-300',
    totalBoxClass: 'bg-sky-900 text-white p-2 rounded font-black',
  },
  // 32. Double Badge
  32: {
    containerClass: 'border border-black rounded-sm bg-white',
    headerType: 'standard',
    govBadgeClass: 'bg-black text-white px-2 py-0.5 font-bold text-xs',
    customerBoxClass: 'border border-black p-2 bg-gray-50',
    tableHeaderBg: 'bg-gray-200 text-black',
    tableBorderColor: 'border-black',
    totalBoxClass: 'bg-gray-100 border-2 border-black p-2 font-black',
  },
  // 33. Neutral Gray
  33: {
    containerClass: 'border border-slate-300 rounded-md bg-white',
    headerType: 'standard',
    govBadgeClass: 'bg-slate-200 text-slate-800 px-2 py-0.5 rounded font-bold text-xs',
    customerBoxClass: 'border border-slate-200 p-2 rounded bg-slate-50',
    tableHeaderBg: 'bg-slate-100 text-slate-700',
    tableBorderColor: 'border-slate-200',
    totalBoxClass: 'bg-slate-800 text-white p-2 rounded font-black',
  },
  // 34. Delivery Proof
  34: {
    containerClass: 'border-2 border-slate-800 rounded-md bg-white',
    headerType: 'standard',
    govBadgeClass: 'bg-slate-800 text-white px-2 py-0.5 rounded font-bold text-xs',
    customerBoxClass: 'border border-slate-300 p-2 rounded bg-slate-50',
    tableHeaderBg: 'bg-slate-200 text-slate-900',
    tableBorderColor: 'border-slate-300',
    totalBoxClass: 'border border-slate-800 p-2 rounded bg-slate-100 font-black',
    specialType: 'stamp-box'
  },
  // 35. Direct Sale
  35: {
    containerClass: 'border-2 border-teal-600 rounded-md bg-white',
    headerType: 'standard',
    govBadgeClass: 'bg-teal-700 text-white px-2 py-0.5 rounded font-bold text-xs',
    customerBoxClass: 'border border-teal-200 p-2 rounded bg-teal-50/30',
    tableHeaderBg: 'bg-teal-50 text-teal-950',
    tableBorderColor: 'border-teal-300',
    totalBoxClass: 'bg-teal-700 text-white p-2 rounded font-black',
  },
  // 36. Crimson Red
  36: {
    containerClass: 'border-2 border-rose-600 rounded-md bg-white',
    headerType: 'banner',
    headerBg: 'bg-rose-700 text-white',
    headerTextColor: 'text-white',
    govBadgeClass: 'bg-rose-100 text-rose-900 border border-rose-300 px-2 py-0.5 rounded font-bold text-xs',
    customerBoxClass: 'border border-rose-200 p-2 rounded bg-rose-50/30',
    tableHeaderBg: 'bg-rose-50 text-rose-950',
    tableBorderColor: 'border-rose-300',
    totalBoxClass: 'bg-rose-700 text-white p-2 rounded font-black',
  },
  // 37. Smart Track
  37: {
    containerClass: 'border-2 border-cyan-700 rounded-md bg-white',
    headerType: 'standard',
    govBadgeClass: 'bg-cyan-800 text-white px-2 py-0.5 rounded font-bold text-xs',
    customerBoxClass: 'border border-cyan-200 p-2 rounded bg-cyan-50/40',
    tableHeaderBg: 'bg-cyan-100 text-cyan-950',
    tableBorderColor: 'border-cyan-300',
    totalBoxClass: 'bg-cyan-900 text-white p-2 rounded font-black',
  },
  // 38. E-Commerce Label
  38: {
    containerClass: 'border-2 border-indigo-500 rounded-xl bg-white shadow-xs',
    headerType: 'standard',
    govBadgeClass: 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-2.5 py-0.5 rounded-full font-black text-xs',
    customerBoxClass: 'border border-indigo-100 p-2 rounded-lg bg-indigo-50/30',
    tableHeaderBg: 'bg-indigo-50 text-indigo-950',
    tableBorderColor: 'border-indigo-200',
    totalBoxClass: 'bg-indigo-900 text-white p-2 rounded-lg font-black',
  },
  // 39. Structured Strip
  39: {
    containerClass: 'border-y-4 border-slate-900 border-x border-slate-300 bg-white',
    headerType: 'standard',
    govBadgeClass: 'bg-slate-900 text-white px-2 py-0.5 rounded-xs font-bold text-xs',
    customerBoxClass: 'border border-slate-300 p-2 bg-slate-50',
    tableHeaderBg: 'bg-slate-100 text-slate-800',
    tableBorderColor: 'border-slate-300',
    totalBoxClass: 'border-2 border-slate-900 p-2 font-black bg-slate-100',
  },
  // 40. Detailed Invoice
  40: {
    containerClass: 'border-2 border-slate-800 rounded-sm bg-white',
    headerType: 'standard',
    govBadgeClass: 'bg-slate-800 text-white px-2 py-0.5 rounded-xs font-bold text-xs',
    customerBoxClass: 'border border-slate-300 p-2 rounded-xs bg-slate-50',
    tableHeaderBg: 'bg-slate-800 text-white',
    tableHeaderTextColor: 'text-white',
    tableBorderColor: 'border-slate-400',
    totalBoxClass: 'border-2 border-slate-800 p-2 bg-slate-50 font-black',
  },
  // 41. Soft Boutique
  41: {
    containerClass: 'border border-pink-200 rounded-lg bg-pink-50/15 text-slate-800',
    headerType: 'standard',
    govBadgeClass: 'bg-pink-100 text-pink-800 border border-pink-200 px-2 py-0.5 rounded-full font-bold text-xs',
    customerBoxClass: 'border border-pink-100 p-2 rounded-lg bg-white shadow-2xs',
    tableHeaderBg: 'bg-pink-100 text-pink-900',
    tableBorderColor: 'border-pink-200',
    totalBoxClass: 'bg-pink-700 text-white p-2 rounded-lg font-black',
  },
  // 42. Classic Duplicate
  42: {
    containerClass: 'border border-slate-400 rounded-sm bg-white',
    headerType: 'standard',
    govBadgeClass: 'bg-slate-800 text-white px-2 py-0.5 rounded font-bold text-xs',
    customerBoxClass: 'border border-slate-300 p-1.5 rounded bg-slate-50',
    tableHeaderBg: 'bg-slate-100 text-slate-800',
    tableBorderColor: 'border-slate-300',
    totalBoxClass: 'border border-slate-400 p-1.5 rounded font-black',
    specialType: 'cut-stub'
  },
  // 43. Governorate Focus
  43: {
    containerClass: 'border-2 border-blue-700 rounded-md bg-white',
    headerType: 'standard',
    govBadgeClass: 'bg-blue-800 text-white px-3 py-1 rounded font-black text-sm shadow-xs',
    customerBoxClass: 'border border-blue-200 p-2 rounded bg-blue-50/40',
    tableHeaderBg: 'bg-blue-50 text-blue-950',
    tableBorderColor: 'border-blue-200',
    totalBoxClass: 'bg-blue-800 text-white p-2 rounded font-black',
    specialType: 'gov-focus'
  },
  // 44. Local Courier
  44: {
    containerClass: 'border-2 border-emerald-600 rounded-md bg-white',
    headerType: 'standard',
    govBadgeClass: 'bg-emerald-700 text-white px-2 py-0.5 rounded font-bold text-xs',
    customerBoxClass: 'border border-emerald-200 p-2 rounded bg-emerald-50/30',
    tableHeaderBg: 'bg-emerald-100 text-emerald-950',
    tableBorderColor: 'border-emerald-300',
    totalBoxClass: 'bg-emerald-800 text-white p-2 rounded font-black',
  },
  // 45. Slate Soft
  45: {
    containerClass: 'border border-slate-300 rounded-xl bg-slate-50/30 text-slate-800 shadow-xs',
    headerType: 'standard',
    govBadgeClass: 'bg-slate-700 text-white px-2.5 py-0.5 rounded-full font-bold text-xs',
    customerBoxClass: 'border border-slate-200 p-2 rounded-lg bg-white',
    tableHeaderBg: 'bg-slate-200 text-slate-800',
    tableBorderColor: 'border-slate-200',
    totalBoxClass: 'bg-slate-800 text-white p-2 rounded-lg font-black',
  },
  // 46. Cash Voucher
  46: {
    containerClass: 'border-2 border-slate-600 rounded-sm bg-white',
    headerType: 'standard',
    govBadgeClass: 'bg-slate-800 text-white px-2 py-0.5 rounded font-bold text-xs',
    customerBoxClass: 'border border-slate-300 p-2 bg-slate-50',
    tableHeaderBg: 'bg-slate-100 text-slate-800',
    tableBorderColor: 'border-slate-300',
    totalBoxClass: 'bg-slate-100 border-2 border-slate-700 p-2 font-black',
  },
  // 47. Safe Cargo
  47: {
    containerClass: 'border-2 border-slate-900 rounded-md bg-white',
    headerType: 'standard',
    govBadgeClass: 'bg-slate-900 text-white px-2 py-0.5 rounded font-bold text-xs',
    customerBoxClass: 'border border-slate-300 p-2 rounded bg-slate-50',
    tableHeaderBg: 'bg-slate-200 text-slate-900',
    tableBorderColor: 'border-slate-400',
    totalBoxClass: 'border border-slate-900 p-2 rounded bg-slate-100 font-black',
    specialType: 'stamp-box'
  },
  // 48. Multi-Store
  48: {
    containerClass: 'border-2 border-slate-800 rounded-lg bg-white',
    headerType: 'standard',
    govBadgeClass: 'bg-blue-800 text-white px-2 py-0.5 rounded font-bold text-xs',
    customerBoxClass: 'border border-slate-200 p-2 rounded bg-slate-50',
    tableHeaderBg: 'bg-slate-100 text-slate-800',
    tableBorderColor: 'border-slate-200',
    totalBoxClass: 'bg-slate-900 text-white p-2 rounded font-black',
  },
  // 49. Ultra Grid
  49: {
    containerClass: 'border-2 border-black rounded-none bg-white',
    headerType: 'standard',
    govBadgeClass: 'bg-black text-white px-2 py-0.5 font-black text-xs',
    customerBoxClass: 'border border-black p-1.5 bg-gray-50',
    tableHeaderBg: 'bg-gray-200 text-black',
    tableBorderColor: 'border-black',
    totalBoxClass: 'border-2 border-black p-1.5 font-black bg-gray-100',
  },
  // 50. Universal Ultimate
  50: {
    containerClass: 'border-2 border-slate-900 rounded-xl bg-white shadow-sm',
    headerType: 'dark',
    headerBg: 'bg-slate-900 text-white',
    headerTextColor: 'text-white',
    govBadgeClass: 'bg-amber-400 text-slate-950 px-3 py-0.5 rounded font-black text-xs shadow-2xs',
    customerBoxClass: 'border border-slate-300 p-2 rounded-lg bg-slate-50',
    tableHeaderBg: 'bg-slate-800 text-white',
    tableHeaderTextColor: 'text-white',
    tableBorderColor: 'border-slate-300',
    totalBoxClass: 'bg-slate-900 text-white p-2 rounded-lg font-black text-sm',
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// CONVERT BUILT-IN TEMPLATE TO EDITABLE CANVAS ITEMS (ACCURATE STYLING & COLORS)
// ─────────────────────────────────────────────────────────────────────────────
export function convertTemplateToCanvasItems(templateId: number): CanvasItem[] {
  const info = WAYBILL_TEMPLATES_INFO.find(t => t.id === templateId);
  const templateName = info ? info.name : `نموذج ${templateId}`;
  const theme = TEMPLATE_THEMES[templateId] || TEMPLATE_THEMES[1];

  let primaryColor = '#0f172a';
  let headerBg = '#f8fafc';
  let headerTextColor = '#0f172a';
  let borderColor = '#cbd5e1';
  let borderRadius = 6;
  let customerBg = '#f8fafc';
  let tableHeaderBg = '#f1f5f9';
  let tableHeaderTextColor = '#0f172a';
  let totalBg = '#0f172a';
  let totalTextColor = '#ffffff';

  if (templateId === 21) {
    return [
      {
        id: 'item_border',
        type: 'rect',
        x: 6,
        y: 6,
        width: 368,
        height: 518,
        style: {
          borderColor: '#eed8dc',
          borderWidth: 2,
          borderRadius: 4,
          borderStyle: 'solid',
          backgroundColor: '#fefdfd',
          zIndex: 1
        }
      },
      // Hanging Ribbon Badge (Left)
      {
        id: 'item_ribbon_bg',
        type: 'rect',
        x: 10,
        y: 6,
        width: 84,
        height: 74,
        style: {
          backgroundColor: '#1a2638',
          borderRadius: 8,
          zIndex: 3
        }
      },
      {
        id: 'item_logo',
        type: 'logo',
        x: 18,
        y: 10,
        width: 68,
        height: 28,
        style: {
          zIndex: 4
        }
      },
      {
        id: 'item_ribbon_company',
        type: 'dynamic',
        dynamicKey: 'companyName',
        x: 12,
        y: 40,
        width: 80,
        height: 16,
        style: {
          color: '#ffffff',
          fontSize: 9,
          fontWeight: 'bold',
          textAlign: 'center',
          zIndex: 4
        }
      },
      {
        id: 'item_ribbon_sub',
        type: 'text',
        content: 'BOUTIQUE',
        x: 12,
        y: 56,
        width: 80,
        height: 14,
        style: {
          color: '#cbd5e1',
          fontSize: 8,
          textAlign: 'center',
          zIndex: 4
        }
      },
      // Center Title & Barcode
      {
        id: 'item_emblem',
        type: 'text',
        content: '🌿 𐂂 🌿',
        x: 100,
        y: 8,
        width: 145,
        height: 14,
        style: {
          color: '#914d61',
          fontSize: 9,
          fontWeight: 'bold',
          textAlign: 'center',
          zIndex: 4
        }
      },
      {
        id: 'item_title',
        type: 'text',
        content: 'بوليصة شحن وفاتورة',
        x: 100,
        y: 22,
        width: 145,
        height: 16,
        style: {
          color: '#2c1e23',
          fontSize: 11,
          fontWeight: 'bold',
          textAlign: 'center',
          zIndex: 4
        }
      },
      {
        id: 'item_barcode_box',
        type: 'rect',
        x: 105,
        y: 40,
        width: 135,
        height: 38,
        style: {
          backgroundColor: '#ffffff',
          borderColor: '#eed8dc',
          borderWidth: 1,
          borderRadius: 6,
          zIndex: 3
        }
      },
      {
        id: 'item_barcode',
        type: 'barcode',
        x: 108,
        y: 42,
        width: 129,
        height: 24,
        style: {
          zIndex: 4
        }
      },
      {
        id: 'item_barcode_text',
        type: 'dynamic',
        dynamicKey: 'orderNumber',
        x: 108,
        y: 65,
        width: 129,
        height: 12,
        style: {
          color: '#1e293b',
          fontSize: 9,
          fontWeight: 'bold',
          textAlign: 'center',
          zIndex: 4
        }
      },
      // Right Company Info & Date
      {
        id: 'item_phone_icon',
        type: 'text',
        content: '📞',
        x: 252,
        y: 14,
        width: 20,
        height: 20,
        style: {
          backgroundColor: '#f6ebed',
          color: '#914d61',
          borderRadius: 10,
          textAlign: 'center',
          fontSize: 10,
          zIndex: 4
        }
      },
      {
        id: 'item_company_name',
        type: 'dynamic',
        dynamicKey: 'companyName',
        x: 275,
        y: 12,
        width: 95,
        height: 16,
        style: {
          color: '#2c1e23',
          fontSize: 10.5,
          fontWeight: 'bold',
          textAlign: 'right',
          zIndex: 4
        }
      },
      {
        id: 'item_company_phone',
        type: 'dynamic',
        dynamicKey: 'companyPhone',
        x: 275,
        y: 28,
        width: 95,
        height: 14,
        style: {
          color: '#475569',
          fontSize: 8.5,
          textAlign: 'right',
          zIndex: 4
        }
      },
      {
        id: 'item_date_icon',
        type: 'text',
        content: '📅',
        x: 252,
        y: 48,
        width: 20,
        height: 20,
        style: {
          backgroundColor: '#f6ebed',
          color: '#914d61',
          borderRadius: 10,
          textAlign: 'center',
          fontSize: 10,
          zIndex: 4
        }
      },
      {
        id: 'item_date_label',
        type: 'text',
        content: 'التاريخ',
        x: 275,
        y: 46,
        width: 95,
        height: 12,
        style: {
          color: '#64748b',
          fontSize: 8.5,
          textAlign: 'right',
          zIndex: 4
        }
      },
      {
        id: 'item_date_val',
        type: 'dynamic',
        dynamicKey: 'date',
        x: 275,
        y: 58,
        width: 95,
        height: 14,
        style: {
          color: '#2c1e23',
          fontSize: 9.5,
          fontWeight: 'bold',
          textAlign: 'right',
          zIndex: 4
        }
      },
      // Customer & Destination Card
      {
        id: 'item_customer_bg',
        type: 'rect',
        x: 10,
        y: 84,
        width: 360,
        height: 64,
        style: {
          backgroundColor: '#fbf5f6',
          borderColor: '#eed8dc',
          borderWidth: 1,
          borderRadius: 8,
          zIndex: 2
        }
      },
      {
        id: 'item_cust_icon',
        type: 'text',
        content: '👤',
        x: 346,
        y: 88,
        width: 18,
        height: 18,
        style: {
          backgroundColor: '#ffffff',
          color: '#914d61',
          borderColor: '#eed8dc',
          borderWidth: 1,
          borderRadius: 9,
          textAlign: 'center',
          fontSize: 9,
          zIndex: 4
        }
      },
      {
        id: 'item_customer_name',
        type: 'dynamic',
        dynamicKey: 'customerName',
        x: 215,
        y: 88,
        width: 126,
        height: 18,
        style: {
          color: '#914d61',
          fontSize: 11.5,
          fontWeight: 'bold',
          textAlign: 'right',
          zIndex: 4
        }
      },
      {
        id: 'item_phone1',
        type: 'dynamic',
        dynamicKey: 'phone1',
        x: 95,
        y: 88,
        width: 115,
        height: 18,
        style: {
          color: '#334155',
          fontSize: 9.5,
          fontWeight: 'bold',
          textAlign: 'right',
          zIndex: 4
        }
      },
      {
        id: 'item_gov_badge',
        type: 'dynamic',
        dynamicKey: 'governorate',
        x: 16,
        y: 88,
        width: 72,
        height: 20,
        style: {
          backgroundColor: '#ffffff',
          color: '#914d61',
          borderColor: '#eed8dc',
          borderWidth: 1,
          borderRadius: 4,
          textAlign: 'center',
          fontSize: 10,
          fontWeight: 'bold',
          zIndex: 4
        }
      },
      {
        id: 'item_address_icon',
        type: 'text',
        content: '📍',
        x: 346,
        y: 114,
        width: 18,
        height: 16,
        style: {
          backgroundColor: '#ffffff',
          color: '#914d61',
          borderColor: '#eed8dc',
          borderWidth: 1,
          borderRadius: 8,
          textAlign: 'center',
          fontSize: 8,
          zIndex: 4
        }
      },
      {
        id: 'item_address_label',
        type: 'text',
        content: 'العنوان:',
        x: 298,
        y: 114,
        width: 44,
        height: 16,
        style: {
          color: '#914d61',
          fontSize: 9.5,
          fontWeight: 'bold',
          textAlign: 'right',
          zIndex: 4
        }
      },
      {
        id: 'item_address',
        type: 'dynamic',
        dynamicKey: 'address',
        x: 16,
        y: 114,
        width: 278,
        height: 18,
        style: {
          color: '#1e293b',
          fontSize: 9,
          textAlign: 'right',
          zIndex: 4
        }
      },
      // 6-Column Products Table
      {
        id: 'item_table',
        type: 'table',
        x: 10,
        y: 154,
        width: 360,
        height: 176,
        style: {
          borderColor: '#eed8dc',
          borderWidth: 1,
          borderStyle: 'solid',
          fontSize: 9,
          backgroundColor: '#ffffff',
          zIndex: 3
        }
      },
      // Bottom Totals & Notes (2-column layout - RTL order: Totals on Right, Notes on Left)
      {
        id: 'item_totals_box',
        type: 'rect',
        x: 195,
        y: 404,
        width: 175,
        height: 72,
        style: {
          backgroundColor: '#fbf5f6',
          borderColor: '#eed8dc',
          borderWidth: 1,
          borderRadius: 8,
          zIndex: 2
        }
      },
      {
        id: 'item_ship_label',
        type: 'text',
        content: '🚚 مصاريف الشحن:',
        x: 275,
        y: 410,
        width: 90,
        height: 16,
        style: {
          color: '#334155',
          fontSize: 9,
          textAlign: 'right',
          zIndex: 4
        }
      },
      {
        id: 'item_ship_val',
        type: 'dynamic',
        dynamicKey: 'shipping',
        x: 200,
        y: 410,
        width: 70,
        height: 16,
        style: {
          color: '#0f172a',
          fontSize: 9.5,
          fontWeight: 'bold',
          textAlign: 'left',
          zIndex: 4
        }
      },
      {
        id: 'item_total_banner',
        type: 'rect',
        x: 200,
        y: 432,
        width: 165,
        height: 36,
        style: {
          backgroundColor: '#914d61',
          borderRadius: 6,
          zIndex: 3
        }
      },
      {
        id: 'item_total_title',
        type: 'text',
        content: '💳 الإجمالي المطلوب:',
        x: 275,
        y: 440,
        width: 85,
        height: 18,
        style: {
          color: '#ffffff',
          fontSize: 9,
          fontWeight: 'bold',
          textAlign: 'right',
          zIndex: 4
        }
      },
      {
        id: 'item_total_num',
        type: 'dynamic',
        dynamicKey: 'total',
        x: 205,
        y: 436,
        width: 68,
        height: 24,
        style: {
          color: '#ffffff',
          fontSize: 13,
          fontWeight: 'bold',
          textAlign: 'center',
          zIndex: 4
        }
      },
      {
        id: 'item_notes_box',
        type: 'rect',
        x: 10,
        y: 404,
        width: 175,
        height: 72,
        style: {
          backgroundColor: '#ffffff',
          borderColor: '#eed8dc',
          borderWidth: 1,
          borderRadius: 8,
          zIndex: 2
        }
      },
      {
        id: 'item_notes_title',
        type: 'text',
        content: 'ملاحظات:',
        x: 15,
        y: 408,
        width: 165,
        height: 14,
        style: {
          color: '#914d61',
          fontSize: 9,
          fontWeight: 'bold',
          textAlign: 'right',
          zIndex: 4
        }
      },
      {
        id: 'item_notes_text',
        type: 'dynamic',
        dynamicKey: 'notes',
        x: 15,
        y: 422,
        width: 165,
        height: 28,
        style: {
          color: '#334155',
          fontSize: 8.5,
          textAlign: 'right',
          zIndex: 4
        }
      },
      {
        id: 'item_emp_text',
        type: 'dynamic',
        dynamicKey: 'employee',
        x: 95,
        y: 454,
        width: 85,
        height: 16,
        style: {
          color: '#64748b',
          fontSize: 8,
          textAlign: 'right',
          zIndex: 4
        }
      },
      {
        id: 'item_page_text',
        type: 'dynamic',
        dynamicKey: 'page',
        x: 15,
        y: 454,
        width: 75,
        height: 16,
        style: {
          color: '#64748b',
          fontSize: 8,
          textAlign: 'left',
          zIndex: 4
        }
      },
      // Policy / Terms
      {
        id: 'item_terms',
        type: 'dynamic',
        dynamicKey: 'companyTerms',
        x: 10,
        y: 486,
        width: 360,
        height: 28,
        style: {
          backgroundColor: '#fbf5f6',
          borderColor: '#eed8dc',
          borderWidth: 1,
          borderRadius: 6,
          color: '#475569',
          fontSize: 7.5,
          textAlign: 'center',
          padding: 2,
          zIndex: 3
        }
      }
    ];
  }

  const THEME_PALETTES: Record<number, {
    primaryColor: string;
    headerBg: string;
    headerTextColor: string;
    borderColor: string;
    borderRadius: number;
    customerBg: string;
    govBadgeBg: string;
    govBadgeTextColor: string;
    tableHeaderBg: string;
    tableHeaderTextColor: string;
    tableBorderColor: string;
    totalBg: string;
    totalTextColor: string;
    borderStyle?: 'solid' | 'dashed' | 'dotted';
  }> = {
    1: { primaryColor: '#0f172a', headerBg: '#ffffff', headerTextColor: '#0f172a', borderColor: '#0f172a', borderRadius: 0, customerBg: '#f8fafc', govBadgeBg: '#0f172a', govBadgeTextColor: '#ffffff', tableHeaderBg: '#e2e8f0', tableHeaderTextColor: '#0f172a', tableBorderColor: '#0f172a', totalBg: '#f1f5f9', totalTextColor: '#0f172a' },
    2: { primaryColor: '#4f46e5', headerBg: '#ffffff', headerTextColor: '#312e81', borderColor: '#c7d2fe', borderRadius: 12, customerBg: '#eef2ff', govBadgeBg: '#4f46e5', govBadgeTextColor: '#ffffff', tableHeaderBg: '#312e81', tableHeaderTextColor: '#ffffff', tableBorderColor: '#c7d2fe', totalBg: '#312e81', totalTextColor: '#ffffff' },
    3: { primaryColor: '#f59e0b', headerBg: '#f59e0b', headerTextColor: '#000000', borderColor: '#fcd34d', borderRadius: 8, customerBg: '#fffbeb', govBadgeBg: '#000000', govBadgeTextColor: '#fbbf24', tableHeaderBg: '#fef3c7', tableHeaderTextColor: '#78350f', tableBorderColor: '#fcd34d', totalBg: '#000000', totalTextColor: '#fbbf24' },
    4: { primaryColor: '#000000', headerBg: '#ffffff', headerTextColor: '#000000', borderColor: '#000000', borderRadius: 0, borderStyle: 'dashed', customerBg: '#ffffff', govBadgeBg: '#000000', govBadgeTextColor: '#ffffff', tableHeaderBg: '#f3f4f6', tableHeaderTextColor: '#000000', tableBorderColor: '#000000', totalBg: '#ffffff', totalTextColor: '#000000' },
    5: { primaryColor: '#334155', headerBg: '#f8fafc', headerTextColor: '#334155', borderColor: '#cbd5e1', borderRadius: 4, customerBg: '#f8fafc', govBadgeBg: '#334155', govBadgeTextColor: '#ffffff', tableHeaderBg: '#f1f5f9', tableHeaderTextColor: '#1e293b', tableBorderColor: '#cbd5e1', totalBg: '#f1f5f9', totalTextColor: '#1e293b' },
    6: { primaryColor: '#92400e', headerBg: '#fffbeb', headerTextColor: '#78350f', borderColor: '#fde68a', borderRadius: 8, customerBg: '#fffbeb', govBadgeBg: '#78350f', govBadgeTextColor: '#fef3c7', tableHeaderBg: '#78350f', tableHeaderTextColor: '#fef3c7', tableBorderColor: '#fde68a', totalBg: '#78350f', totalTextColor: '#fef3c7' },
    7: { primaryColor: '#1e3a8a', headerBg: '#ffffff', headerTextColor: '#1e3a8a', borderColor: '#cbd5e1', borderRadius: 4, customerBg: '#f8fafc', govBadgeBg: '#1e3a8a', govBadgeTextColor: '#ffffff', tableHeaderBg: '#e2e8f0', tableHeaderTextColor: '#1e293b', tableBorderColor: '#cbd5e1', totalBg: '#f1f5f9', totalTextColor: '#1e293b' },
    8: { primaryColor: '#0f172a', headerBg: '#ffffff', headerTextColor: '#0f172a', borderColor: '#1e293b', borderRadius: 4, customerBg: '#f8fafc', govBadgeBg: '#0f172a', govBadgeTextColor: '#ffffff', tableHeaderBg: '#0f172a', tableHeaderTextColor: '#ffffff', tableBorderColor: '#1e293b', totalBg: '#0f172a', totalTextColor: '#34d399' },
    9: { primaryColor: '#000000', headerBg: '#fef08a', headerTextColor: '#000000', borderColor: '#000000', borderRadius: 0, customerBg: '#f9fafb', govBadgeBg: '#facc15', govBadgeTextColor: '#000000', tableHeaderBg: '#e5e7eb', tableHeaderTextColor: '#000000', tableBorderColor: '#000000', totalBg: '#000000', totalTextColor: '#fef08a' },
    10: { primaryColor: '#0f172a', headerBg: '#ffffff', headerTextColor: '#0f172a', borderColor: '#0f172a', borderRadius: 0, customerBg: '#f8fafc', govBadgeBg: '#0f172a', govBadgeTextColor: '#ffffff', tableHeaderBg: '#e2e8f0', tableHeaderTextColor: '#0f172a', tableBorderColor: '#0f172a', totalBg: '#f8fafc', totalTextColor: '#0f172a' },
    11: { primaryColor: '#475569', headerBg: '#ffffff', headerTextColor: '#475569', borderColor: '#cbd5e1', borderRadius: 8, customerBg: '#ffffff', govBadgeBg: '#f1f5f9', govBadgeTextColor: '#334155', tableHeaderBg: '#f8fafc', tableHeaderTextColor: '#475569', tableBorderColor: '#e2e8f0', totalBg: '#ffffff', totalTextColor: '#0f172a' },
    12: { primaryColor: '#0f172a', headerBg: '#0f172a', headerTextColor: '#ffffff', borderColor: '#0f172a', borderRadius: 6, borderStyle: 'dashed', customerBg: '#fffbeb', govBadgeBg: '#f59e0b', govBadgeTextColor: '#0f172a', tableHeaderBg: '#f1f5f9', tableHeaderTextColor: '#0f172a', tableBorderColor: '#0f172a', totalBg: '#f8fafc', totalTextColor: '#0f172a' },
    13: { primaryColor: '#0f172a', headerBg: '#0f172a', headerTextColor: '#ffffff', borderColor: '#334155', borderRadius: 8, customerBg: '#f8fafc', govBadgeBg: '#f59e0b', govBadgeTextColor: '#0f172a', tableHeaderBg: '#0f172a', tableHeaderTextColor: '#ffffff', tableBorderColor: '#e2e8f0', totalBg: '#fffbeb', totalTextColor: '#78350f' },
    14: { primaryColor: '#1e3a8a', headerBg: '#ffffff', headerTextColor: '#1e3a8a', borderColor: '#1e293b', borderRadius: 6, customerBg: '#f8fafc', govBadgeBg: '#1e3a8a', govBadgeTextColor: '#ffffff', tableHeaderBg: '#f1f5f9', tableHeaderTextColor: '#0f172a', tableBorderColor: '#cbd5e1', totalBg: '#0f172a', totalTextColor: '#ffffff' },
    15: { primaryColor: '#334155', headerBg: '#ffffff', headerTextColor: '#334155', borderColor: '#94a3b8', borderRadius: 6, customerBg: '#f8fafc', govBadgeBg: '#1e293b', govBadgeTextColor: '#ffffff', tableHeaderBg: '#e2e8f0', tableHeaderTextColor: '#0f172a', tableBorderColor: '#94a3b8', totalBg: '#f1f5f9', totalTextColor: '#0f172a' },
    16: { primaryColor: '#4f46e5', headerBg: '#ffffff', headerTextColor: '#312e81', borderColor: '#4f46e5', borderRadius: 4, customerBg: '#eef2ff', govBadgeBg: '#e0e7ff', govBadgeTextColor: '#312e81', tableHeaderBg: '#4f46e5', tableHeaderTextColor: '#ffffff', tableBorderColor: '#c7d2fe', totalBg: '#4f46e5', totalTextColor: '#ffffff' },
    17: { primaryColor: '#dc2626', headerBg: '#dc2626', headerTextColor: '#ffffff', borderColor: '#dc2626', borderRadius: 6, customerBg: '#fef2f2', govBadgeBg: '#b91c1c', govBadgeTextColor: '#ffffff', tableHeaderBg: '#fee2e2', tableHeaderTextColor: '#7f1d1d', tableBorderColor: '#fecaca', totalBg: '#facc15', totalTextColor: '#0f172a' },
    18: { primaryColor: '#1e40af', headerBg: '#ffffff', headerTextColor: '#1e40af', borderColor: '#cbd5e1', borderRadius: 6, customerBg: '#eff6ff', govBadgeBg: '#1e40af', govBadgeTextColor: '#ffffff', tableHeaderBg: '#f1f5f9', tableHeaderTextColor: '#0f172a', tableBorderColor: '#cbd5e1', totalBg: '#f8fafc', totalTextColor: '#0f172a' },
    19: { primaryColor: '#000000', headerBg: '#ffffff', headerTextColor: '#000000', borderColor: '#000000', borderRadius: 0, customerBg: '#ffffff', govBadgeBg: '#000000', govBadgeTextColor: '#ffffff', tableHeaderBg: '#e5e7eb', tableHeaderTextColor: '#000000', tableBorderColor: '#000000', totalBg: '#000000', totalTextColor: '#ffffff' },
    20: { primaryColor: '#0f172a', headerBg: '#ffffff', headerTextColor: '#0f172a', borderColor: '#0f172a', borderRadius: 6, customerBg: '#f8fafc', govBadgeBg: '#0f172a', govBadgeTextColor: '#ffffff', tableHeaderBg: '#1e293b', tableHeaderTextColor: '#ffffff', tableBorderColor: '#cbd5e1', totalBg: '#f1f5f9', totalTextColor: '#0f172a' },
    21: { primaryColor: '#914d61', headerBg: '#1a2638', headerTextColor: '#ffffff', borderColor: '#eed8dc', borderRadius: 4, customerBg: '#fbf5f6', govBadgeBg: '#ffffff', govBadgeTextColor: '#914d61', tableHeaderBg: '#914d61', tableHeaderTextColor: '#ffffff', tableBorderColor: '#eed8dc', totalBg: '#914d61', totalTextColor: '#ffffff' },
    22: { primaryColor: '#047857', headerBg: '#047857', headerTextColor: '#ffffff', borderColor: '#a7f3d0', borderRadius: 6, customerBg: '#ffffff', govBadgeBg: '#d1fae5', govBadgeTextColor: '#065f46', tableHeaderBg: '#ecfdf5', tableHeaderTextColor: '#065f46', tableBorderColor: '#a7f3d0', totalBg: '#047857', totalTextColor: '#ffffff' },
    23: { primaryColor: '#ea580c', headerBg: '#ea580c', headerTextColor: '#ffffff', borderColor: '#fdba74', borderRadius: 6, customerBg: '#fff7ed', govBadgeBg: '#ea580c', govBadgeTextColor: '#ffffff', tableHeaderBg: '#ffedd5', tableHeaderTextColor: '#7c2d12', tableBorderColor: '#fdba74', totalBg: '#ea580c', totalTextColor: '#ffffff' },
    24: { primaryColor: '#1e3a8a', headerBg: '#0f172a', headerTextColor: '#ffffff', borderColor: '#93c5fd', borderRadius: 6, customerBg: '#ffffff', govBadgeBg: '#e2e8f0', govBadgeTextColor: '#0f172a', tableHeaderBg: '#1e293b', tableHeaderTextColor: '#ffffff', tableBorderColor: '#cbd5e1', totalBg: '#0f172a', totalTextColor: '#ffffff' },
    25: { primaryColor: '#0284c7', headerBg: '#ffffff', headerTextColor: '#0369a1', borderColor: '#7dd3fc', borderRadius: 6, customerBg: '#f0f9ff', govBadgeBg: '#0369a1', govBadgeTextColor: '#ffffff', tableHeaderBg: '#e0f2fe', tableHeaderTextColor: '#075985', tableBorderColor: '#7dd3fc', totalBg: '#0369a1', totalTextColor: '#ffffff' },
    26: { primaryColor: '#334155', headerBg: '#ffffff', headerTextColor: '#334155', borderColor: '#334155', borderRadius: 0, customerBg: '#f8fafc', govBadgeBg: '#1e293b', govBadgeTextColor: '#ffffff', tableHeaderBg: '#e2e8f0', tableHeaderTextColor: '#0f172a', tableBorderColor: '#334155', totalBg: '#1e293b', totalTextColor: '#ffffff' },
    27: { primaryColor: '#475569', headerBg: '#e2e8f0', headerTextColor: '#0f172a', borderColor: '#94a3b8', borderRadius: 6, customerBg: '#f8fafc', govBadgeBg: '#1e3a8a', govBadgeTextColor: '#ffffff', tableHeaderBg: '#f1f5f9', tableHeaderTextColor: '#0f172a', tableBorderColor: '#cbd5e1', totalBg: '#0f172a', totalTextColor: '#ffffff' },
    28: { primaryColor: '#7c3aed', headerBg: '#f5f3ff', headerTextColor: '#5b21b6', borderColor: '#ddd6fe', borderRadius: 8, customerBg: '#ffffff', govBadgeBg: '#7c3aed', govBadgeTextColor: '#ffffff', tableHeaderBg: '#ede9fe', tableHeaderTextColor: '#4c1d95', tableBorderColor: '#ddd6fe', totalBg: '#7c3aed', totalTextColor: '#ffffff' },
    29: { primaryColor: '#2563eb', headerBg: '#ffffff', headerTextColor: '#1d4ed8', borderColor: '#93c5fd', borderRadius: 12, customerBg: '#f8fafc', govBadgeBg: '#dbeafe', govBadgeTextColor: '#1e40af', tableHeaderBg: '#f1f5f9', tableHeaderTextColor: '#1e293b', tableBorderColor: '#e2e8f0', totalBg: '#0f172a', totalTextColor: '#facc15' },
    30: { primaryColor: '#000000', headerBg: '#000000', headerTextColor: '#ffffff', borderColor: '#000000', borderRadius: 0, customerBg: '#f9fafb', govBadgeBg: '#000000', govBadgeTextColor: '#ffffff', tableHeaderBg: '#e5e7eb', tableHeaderTextColor: '#000000', tableBorderColor: '#000000', totalBg: '#000000', totalTextColor: '#ffffff' },
    31: { primaryColor: '#0369a1', headerBg: '#0369a1', headerTextColor: '#ffffff', borderColor: '#7dd3fc', borderRadius: 6, customerBg: '#f0f9ff', govBadgeBg: '#e0f2fe', govBadgeTextColor: '#075985', tableHeaderBg: '#e0f2fe', tableHeaderTextColor: '#0369a1', tableBorderColor: '#7dd3fc', totalBg: '#075985', totalTextColor: '#ffffff' },
    32: { primaryColor: '#000000', headerBg: '#ffffff', headerTextColor: '#000000', borderColor: '#000000', borderRadius: 2, customerBg: '#f9fafb', govBadgeBg: '#000000', govBadgeTextColor: '#ffffff', tableHeaderBg: '#e5e7eb', tableHeaderTextColor: '#000000', tableBorderColor: '#000000', totalBg: '#f3f4f6', totalTextColor: '#000000' },
    33: { primaryColor: '#475569', headerBg: '#ffffff', headerTextColor: '#475569', borderColor: '#cbd5e1', borderRadius: 6, customerBg: '#f8fafc', govBadgeBg: '#e2e8f0', govBadgeTextColor: '#1e293b', tableHeaderBg: '#f1f5f9', tableHeaderTextColor: '#334155', tableBorderColor: '#e2e8f0', totalBg: '#1e293b', totalTextColor: '#ffffff' },
    34: { primaryColor: '#1e293b', headerBg: '#ffffff', headerTextColor: '#1e293b', borderColor: '#1e293b', borderRadius: 6, customerBg: '#f8fafc', govBadgeBg: '#1e293b', govBadgeTextColor: '#ffffff', tableHeaderBg: '#e2e8f0', tableHeaderTextColor: '#0f172a', tableBorderColor: '#cbd5e1', totalBg: '#f8fafc', totalTextColor: '#0f172a' },
    35: { primaryColor: '#0d9488', headerBg: '#ffffff', headerTextColor: '#0f766e', borderColor: '#5eead4', borderRadius: 6, customerBg: '#f0fdfa', govBadgeBg: '#0f766e', govBadgeTextColor: '#ffffff', tableHeaderBg: '#ccfbf1', tableHeaderTextColor: '#115e59', tableBorderColor: '#5eead4', totalBg: '#0f766e', totalTextColor: '#ffffff' },
    36: { primaryColor: '#e11d48', headerBg: '#e11d48', headerTextColor: '#ffffff', borderColor: '#fda4af', borderRadius: 6, customerBg: '#fff1f2', govBadgeBg: '#ffe4e6', govBadgeTextColor: '#9f1239', tableHeaderBg: '#ffe4e6', tableHeaderTextColor: '#881337', tableBorderColor: '#fda4af', totalBg: '#be123c', totalTextColor: '#ffffff' },
    37: { primaryColor: '#0891b2', headerBg: '#ffffff', headerTextColor: '#0e7490', borderColor: '#67e8f9', borderRadius: 6, customerBg: '#ecfeff', govBadgeBg: '#0e7490', govBadgeTextColor: '#ffffff', tableHeaderBg: '#cffafe', tableHeaderTextColor: '#155e75', tableBorderColor: '#67e8f9', totalBg: '#155e75', totalTextColor: '#ffffff' },
    38: { primaryColor: '#6366f1', headerBg: '#ffffff', headerTextColor: '#4338ca', borderColor: '#a5b4fc', borderRadius: 12, customerBg: '#eef2ff', govBadgeBg: '#4f46e5', govBadgeTextColor: '#ffffff', tableHeaderBg: '#e0e7ff', tableHeaderTextColor: '#312e81', tableBorderColor: '#c7d2fe', totalBg: '#312e81', totalTextColor: '#ffffff' },
    39: { primaryColor: '#0f172a', headerBg: '#ffffff', headerTextColor: '#0f172a', borderColor: '#0f172a', borderRadius: 0, customerBg: '#f8fafc', govBadgeBg: '#0f172a', govBadgeTextColor: '#ffffff', tableHeaderBg: '#f1f5f9', tableHeaderTextColor: '#0f172a', tableBorderColor: '#cbd5e1', totalBg: '#f1f5f9', totalTextColor: '#0f172a' },
    40: { primaryColor: '#1e293b', headerBg: '#ffffff', headerTextColor: '#1e293b', borderColor: '#1e293b', borderRadius: 2, customerBg: '#f8fafc', govBadgeBg: '#1e293b', govBadgeTextColor: '#ffffff', tableHeaderBg: '#1e293b', tableHeaderTextColor: '#ffffff', tableBorderColor: '#94a3b8', totalBg: '#f8fafc', totalTextColor: '#0f172a' },
    41: { primaryColor: '#db2777', headerBg: '#ffffff', headerTextColor: '#be185d', borderColor: '#fbcfe8', borderRadius: 8, customerBg: '#ffffff', govBadgeBg: '#fdf2f8', govBadgeTextColor: '#9d174d', tableHeaderBg: '#fce7f3', tableHeaderTextColor: '#831843', tableBorderColor: '#fbcfe8', totalBg: '#be185d', totalTextColor: '#ffffff' },
    42: { primaryColor: '#334155', headerBg: '#ffffff', headerTextColor: '#334155', borderColor: '#94a3b8', borderRadius: 4, customerBg: '#f8fafc', govBadgeBg: '#1e293b', govBadgeTextColor: '#ffffff', tableHeaderBg: '#f1f5f9', tableHeaderTextColor: '#0f172a', tableBorderColor: '#cbd5e1', totalBg: '#f8fafc', totalTextColor: '#0f172a' },
    43: { primaryColor: '#1d4ed8', headerBg: '#ffffff', headerTextColor: '#1e40af', borderColor: '#1d4ed8', borderRadius: 6, customerBg: '#eff6ff', govBadgeBg: '#1e40af', govBadgeTextColor: '#ffffff', tableHeaderBg: '#dbeafe', tableHeaderTextColor: '#1e3a8a', tableBorderColor: '#93c5fd', totalBg: '#1e40af', totalTextColor: '#ffffff' },
    44: { primaryColor: '#16a34a', headerBg: '#ffffff', headerTextColor: '#15803d', borderColor: '#86efac', borderRadius: 6, customerBg: '#f0fdf4', govBadgeBg: '#15803d', govBadgeTextColor: '#ffffff', tableHeaderBg: '#dcfce7', tableHeaderTextColor: '#14532d', tableBorderColor: '#86efac', totalBg: '#15803d', totalTextColor: '#ffffff' },
    45: { primaryColor: '#64748b', headerBg: '#ffffff', headerTextColor: '#475569', borderColor: '#cbd5e1', borderRadius: 12, customerBg: '#ffffff', govBadgeBg: '#334155', govBadgeTextColor: '#ffffff', tableHeaderBg: '#e2e8f0', tableHeaderTextColor: '#1e293b', tableBorderColor: '#cbd5e1', totalBg: '#1e293b', totalTextColor: '#ffffff' },
    46: { primaryColor: '#334155', headerBg: '#ffffff', headerTextColor: '#334155', borderColor: '#475569', borderRadius: 4, customerBg: '#f8fafc', govBadgeBg: '#1e293b', govBadgeTextColor: '#ffffff', tableHeaderBg: '#f1f5f9', tableHeaderTextColor: '#0f172a', tableBorderColor: '#cbd5e1', totalBg: '#f8fafc', totalTextColor: '#0f172a' },
    47: { primaryColor: '#0f172a', headerBg: '#ffffff', headerTextColor: '#0f172a', borderColor: '#0f172a', borderRadius: 6, customerBg: '#f8fafc', govBadgeBg: '#0f172a', govBadgeTextColor: '#ffffff', tableHeaderBg: '#e2e8f0', tableHeaderTextColor: '#0f172a', tableBorderColor: '#94a3b8', totalBg: '#f1f5f9', totalTextColor: '#0f172a' },
    48: { primaryColor: '#1e40af', headerBg: '#ffffff', headerTextColor: '#1e3a8a', borderColor: '#1e40af', borderRadius: 8, customerBg: '#f8fafc', govBadgeBg: '#1e40af', govBadgeTextColor: '#ffffff', tableHeaderBg: '#f1f5f9', tableHeaderTextColor: '#1e293b', tableBorderColor: '#cbd5e1', totalBg: '#0f172a', totalTextColor: '#ffffff' },
    49: { primaryColor: '#000000', headerBg: '#ffffff', headerTextColor: '#000000', borderColor: '#000000', borderRadius: 0, customerBg: '#f9fafb', govBadgeBg: '#000000', govBadgeTextColor: '#ffffff', tableHeaderBg: '#e5e7eb', tableHeaderTextColor: '#000000', tableBorderColor: '#000000', totalBg: '#e5e7eb', totalTextColor: '#000000' },
    50: { primaryColor: '#0f172a', headerBg: '#0f172a', headerTextColor: '#ffffff', borderColor: '#0f172a', borderRadius: 12, customerBg: '#f8fafc', govBadgeBg: '#f59e0b', govBadgeTextColor: '#0f172a', tableHeaderBg: '#1e293b', tableHeaderTextColor: '#ffffff', tableBorderColor: '#cbd5e1', totalBg: '#0f172a', totalTextColor: '#ffffff' },
  };

  const palette = THEME_PALETTES[templateId] || THEME_PALETTES[1];
  const headerType = theme.headerType || 'standard';
  const specialType = theme.specialType;

  // ── Thermal Header Layout ──────────────────────────────────────────────────
  if (headerType === 'thermal') {
    return [
      {
        id: 'item_border',
        type: 'rect',
        x: 6,
        y: 6,
        width: 368,
        height: 518,
        style: {
          borderColor: palette.borderColor,
          borderWidth: 2,
          borderRadius: 0,
          borderStyle: 'dashed',
          backgroundColor: '#ffffff',
          zIndex: 1
        }
      },
      {
        id: 'item_logo',
        type: 'logo',
        x: 164,
        y: 12,
        width: 52,
        height: 34,
        style: { zIndex: 4 }
      },
      {
        id: 'item_company_name',
        type: 'dynamic',
        dynamicKey: 'companyName',
        x: 15,
        y: 48,
        width: 350,
        height: 20,
        style: {
          color: '#000000',
          fontSize: 13,
          fontWeight: 'bold',
          textAlign: 'center',
          zIndex: 4
        }
      },
      {
        id: 'item_company_phone',
        type: 'dynamic',
        dynamicKey: 'companyPhone',
        x: 15,
        y: 68,
        width: 350,
        height: 16,
        style: {
          color: '#333333',
          fontSize: 9.5,
          textAlign: 'center',
          zIndex: 4
        }
      },
      {
        id: 'item_barcode',
        type: 'barcode',
        x: 80,
        y: 86,
        width: 220,
        height: 26,
        style: { zIndex: 4 }
      },
      {
        id: 'item_barcode_text',
        type: 'dynamic',
        dynamicKey: 'orderNumber',
        x: 15,
        y: 112,
        width: 350,
        height: 14,
        style: {
          color: '#000000',
          fontSize: 10,
          fontWeight: 'bold',
          textAlign: 'center',
          zIndex: 4
        }
      },
      {
        id: 'item_thermal_divider',
        type: 'rect',
        x: 15,
        y: 128,
        width: 350,
        height: 1,
        style: {
          borderColor: '#000000',
          borderWidth: 1,
          borderStyle: 'dashed',
          zIndex: 3
        }
      },
      {
        id: 'item_customer_bg',
        type: 'rect',
        x: 12,
        y: 134,
        width: 356,
        height: 64,
        style: {
          borderColor: '#000000',
          borderWidth: 1,
          borderStyle: 'dashed',
          backgroundColor: '#ffffff',
          zIndex: 2
        }
      },
      {
        id: 'item_customer_name',
        type: 'dynamic',
        dynamicKey: 'customerName',
        x: 120,
        y: 138,
        width: 240,
        height: 18,
        style: { color: '#000000', fontSize: 11.5, fontWeight: 'bold', textAlign: 'right', zIndex: 4 }
      },
      {
        id: 'item_gov_badge',
        type: 'dynamic',
        dynamicKey: 'governorate',
        x: 18,
        y: 138,
        width: 90,
        height: 20,
        style: { borderColor: '#000000', borderWidth: 1, color: '#000000', fontSize: 10, fontWeight: 'bold', textAlign: 'center', zIndex: 4 }
      },
      {
        id: 'item_phone1',
        type: 'dynamic',
        dynamicKey: 'phone1',
        x: 230,
        y: 160,
        width: 132,
        height: 16,
        style: { color: '#000000', fontSize: 9.5, fontWeight: 'bold', textAlign: 'right', zIndex: 4 }
      },
      {
        id: 'item_phone2',
        type: 'dynamic',
        dynamicKey: 'phone2',
        x: 120,
        y: 160,
        width: 105,
        height: 16,
        style: { color: '#444444', fontSize: 9, textAlign: 'right', zIndex: 4 }
      },
      {
        id: 'item_date',
        type: 'dynamic',
        dynamicKey: 'date',
        x: 18,
        y: 160,
        width: 95,
        height: 16,
        style: { color: '#555555', fontSize: 8.5, textAlign: 'left', zIndex: 4 }
      },
      {
        id: 'item_address',
        type: 'dynamic',
        dynamicKey: 'address',
        x: 18,
        y: 178,
        width: 344,
        height: 16,
        style: { color: '#000000', fontSize: 9, textAlign: 'right', zIndex: 4 }
      },
      {
        id: 'item_table',
        type: 'table',
        x: 12,
        y: 204,
        width: 356,
        height: 140,
        style: { borderColor: '#000000', borderWidth: 1, borderStyle: 'dashed', backgroundColor: '#f3f4f6', fontSize: 8.5, zIndex: 3 }
      },
      {
        id: 'item_total_bg',
        type: 'rect',
        x: 12,
        y: 376,
        width: 356,
        height: 48,
        style: { borderColor: '#000000', borderWidth: 2, backgroundColor: '#ffffff', zIndex: 2 }
      },
      {
        id: 'item_shipping_label',
        type: 'text',
        content: 'مصاريف الشحن:',
        x: 260,
        y: 382,
        width: 100,
        height: 16,
        style: { color: '#000000', fontSize: 9.5, fontWeight: 'bold', textAlign: 'right', zIndex: 4 }
      },
      {
        id: 'item_shipping_val',
        type: 'dynamic',
        dynamicKey: 'shipping',
        x: 190,
        y: 382,
        width: 68,
        height: 16,
        style: { color: '#000000', fontSize: 9.5, fontWeight: 'bold', textAlign: 'left', zIndex: 4 }
      },
      {
        id: 'item_total_label',
        type: 'text',
        content: 'المطلوب تحصيله:',
        x: 18,
        y: 382,
        width: 85,
        height: 16,
        style: { color: '#000000', fontSize: 10, fontWeight: 'bold', textAlign: 'right', zIndex: 4 }
      },
      {
        id: 'item_total_val',
        type: 'dynamic',
        dynamicKey: 'total',
        x: 105,
        y: 380,
        width: 80,
        height: 24,
        style: { color: '#000000', fontSize: 14, fontWeight: 'bold', textAlign: 'left', zIndex: 4 }
      },
      {
        id: 'item_notes_bg',
        type: 'rect',
        x: 12,
        y: 432,
        width: 356,
        height: 42,
        style: { borderColor: '#000000', borderWidth: 1, borderStyle: 'dashed', backgroundColor: '#ffffff', zIndex: 2 }
      },
      {
        id: 'item_notes_label',
        type: 'text',
        content: 'ملاحظات:',
        x: 310,
        y: 436,
        width: 52,
        height: 16,
        style: { color: '#000000', fontSize: 9, fontWeight: 'bold', textAlign: 'right', zIndex: 4 }
      },
      {
        id: 'item_notes_val',
        type: 'dynamic',
        dynamicKey: 'notes',
        x: 18,
        y: 436,
        width: 290,
        height: 16,
        style: { color: '#333333', fontSize: 8.5, textAlign: 'right', zIndex: 4 }
      },
      {
        id: 'item_employee_val',
        type: 'dynamic',
        dynamicKey: 'employee',
        x: 190,
        y: 454,
        width: 172,
        height: 16,
        style: { color: '#555555', fontSize: 8, textAlign: 'right', zIndex: 4 }
      },
      {
        id: 'item_page_val',
        type: 'dynamic',
        dynamicKey: 'page',
        x: 18,
        y: 454,
        width: 168,
        height: 16,
        style: { color: '#555555', fontSize: 8, textAlign: 'left', zIndex: 4 }
      },
      {
        id: 'item_terms',
        type: 'dynamic',
        dynamicKey: 'companyTerms',
        x: 12,
        y: 484,
        width: 356,
        height: 32,
        style: { borderColor: '#000000', borderWidth: 1, borderStyle: 'dashed', color: '#444444', fontSize: 7.5, textAlign: 'center', padding: 2, zIndex: 3 }
      }
    ];
  }

  // ── Standard, Banner, or Dark Layout ───────────────────────────────────────
  const isBanner = headerType === 'banner';
  const isDark = headerType === 'dark';
  const customerY = isBanner ? 72 : isDark ? 74 : 70;

  // Calculate table and special banner positions
  let tableY = customerY + 74;
  let tableHeight = 176;
  const hasFragile = specialType === 'fragile-box';
  const hasGovFocus = specialType === 'gov-focus';
  if (hasFragile || hasGovFocus) {
    tableY = customerY + 96;
    tableHeight = 154;
  }

  const hasCutStub = specialType === 'cut-stub';
  const hasStampBox = specialType === 'stamp-box';
  const hasDualBarcode = specialType === 'dual-barcode';
  const hasSpecialBottom = hasCutStub || hasStampBox || hasDualBarcode;

  // Anchor bottom elements down near the invoice bottom border (ends at 524)
  // This creates a generous, comfortable margin (56px) for the products table without clinging.
  const termsY = 486;
  const bottomDecorY = 462;
  const notesY = hasSpecialBottom ? 414 : 432;
  const totalsY = hasSpecialBottom ? 360 : 376;

  const items: CanvasItem[] = [
    // Outer Frame
    {
      id: 'item_border',
      type: 'rect',
      x: 6,
      y: 6,
      width: 368,
      height: 518,
      style: {
        borderColor: palette.borderColor,
        borderWidth: 2,
        borderRadius: palette.borderRadius,
        borderStyle: palette.borderStyle || 'solid',
        backgroundColor: '#ffffff',
        zIndex: 1
      }
    }
  ];

  // Header Elements
  if (isBanner) {
    items.push(
      {
        id: 'item_header_bg',
        type: 'rect',
        x: 8,
        y: 8,
        width: 364,
        height: 58,
        style: {
          backgroundColor: palette.headerBg,
          borderRadius: Math.max(0, palette.borderRadius - 2),
          zIndex: 2
        }
      },
      {
        id: 'item_logo',
        type: 'logo',
        x: 318,
        y: 14,
        width: 46,
        height: 46,
        style: { zIndex: 4 }
      },
      {
        id: 'item_company_name',
        type: 'dynamic',
        dynamicKey: 'companyName',
        x: 160,
        y: 16,
        width: 152,
        height: 22,
        style: {
          fontSize: 12.5,
          fontWeight: 'bold',
          color: palette.headerTextColor,
          textAlign: 'right',
          zIndex: 4
        }
      },
      {
        id: 'item_company_phone',
        type: 'dynamic',
        dynamicKey: 'companyPhone',
        x: 160,
        y: 38,
        width: 152,
        height: 18,
        style: {
          fontSize: 9.5,
          color: palette.headerTextColor,
          opacity: 0.9,
          textAlign: 'right',
          zIndex: 4
        }
      },
      {
        id: 'item_barcode_box',
        type: 'rect',
        x: 14,
        y: 12,
        width: 140,
        height: 48,
        style: {
          backgroundColor: '#ffffff',
          borderRadius: 6,
          borderColor: '#cbd5e1',
          borderWidth: 1,
          zIndex: 3
        }
      },
      {
        id: 'item_barcode',
        type: 'barcode',
        x: 19,
        y: 14,
        width: 130,
        height: 26,
        style: { zIndex: 4 }
      },
      {
        id: 'item_order_number',
        type: 'dynamic',
        dynamicKey: 'orderNumber',
        x: 19,
        y: 42,
        width: 130,
        height: 14,
        style: {
          fontSize: 9.5,
          fontWeight: 'bold',
          color: '#0f172a',
          textAlign: 'center',
          zIndex: 4
        }
      }
    );
  } else if (isDark) {
    items.push(
      {
        id: 'item_header_bg',
        type: 'rect',
        x: 8,
        y: 8,
        width: 364,
        height: 60,
        style: {
          backgroundColor: '#0f172a',
          borderRadius: Math.max(0, palette.borderRadius - 2),
          zIndex: 2
        }
      },
      {
        id: 'item_logo',
        type: 'logo',
        x: 318,
        y: 14,
        width: 46,
        height: 46,
        style: { zIndex: 4 }
      },
      {
        id: 'item_company_name',
        type: 'dynamic',
        dynamicKey: 'companyName',
        x: 160,
        y: 15,
        width: 152,
        height: 22,
        style: {
          fontSize: 13,
          fontWeight: 'bold',
          color: '#ffffff',
          textAlign: 'right',
          zIndex: 4
        }
      },
      {
        id: 'item_company_phone',
        type: 'dynamic',
        dynamicKey: 'companyPhone',
        x: 160,
        y: 38,
        width: 152,
        height: 18,
        style: {
          fontSize: 9.5,
          color: '#94a3b8',
          textAlign: 'right',
          zIndex: 4
        }
      },
      {
        id: 'item_barcode',
        type: 'barcode',
        x: 14,
        y: 12,
        width: 140,
        height: 28,
        style: { zIndex: 4 }
      },
      {
        id: 'item_order_number',
        type: 'dynamic',
        dynamicKey: 'orderNumber',
        x: 14,
        y: 42,
        width: 140,
        height: 16,
        style: {
          fontSize: 10,
          fontWeight: 'bold',
          color: '#fbbf24',
          textAlign: 'center',
          zIndex: 4
        }
      }
    );
  } else {
    items.push(
      {
        id: 'item_header_bg',
        type: 'rect',
        x: 8,
        y: 8,
        width: 364,
        height: 56,
        style: {
          backgroundColor: palette.headerBg,
          borderRadius: Math.max(0, palette.borderRadius - 2),
          zIndex: 2
        }
      },
      {
        id: 'item_logo',
        type: 'logo',
        x: 316,
        y: 12,
        width: 48,
        height: 46,
        style: { zIndex: 4 }
      },
      {
        id: 'item_company_name',
        type: 'dynamic',
        dynamicKey: 'companyName',
        x: 158,
        y: 14,
        width: 152,
        height: 22,
        style: {
          fontSize: 12.5,
          fontWeight: 'bold',
          color: palette.headerTextColor,
          textAlign: 'right',
          zIndex: 4
        }
      },
      {
        id: 'item_company_phone',
        type: 'dynamic',
        dynamicKey: 'companyPhone',
        x: 158,
        y: 36,
        width: 152,
        height: 18,
        style: {
          fontSize: 9.5,
          color: palette.headerTextColor,
          opacity: 0.85,
          textAlign: 'right',
          zIndex: 4
        }
      },
      {
        id: 'item_barcode',
        type: 'barcode',
        x: 14,
        y: 10,
        width: 138,
        height: 34,
        style: { zIndex: 4 }
      },
      {
        id: 'item_order_number',
        type: 'dynamic',
        dynamicKey: 'orderNumber',
        x: 14,
        y: 46,
        width: 138,
        height: 14,
        style: {
          fontSize: 9.5,
          fontWeight: 'bold',
          color: '#0f172a',
          textAlign: 'center',
          zIndex: 4
        }
      }
    );
  }

  // Customer Card (RTL: Customer name and phones on Right, Gov and Date on Left)
  items.push(
    {
      id: 'item_customer_bg',
      type: 'rect',
      x: 12,
      y: customerY,
      width: 356,
      height: 68,
      style: {
        backgroundColor: palette.customerBg,
        borderColor: palette.borderColor,
        borderWidth: 1,
        borderRadius: Math.max(2, palette.borderRadius - 2),
        zIndex: 2
      }
    },
    {
      id: 'item_customer_name',
      type: 'dynamic',
      dynamicKey: 'customerName',
      x: 120,
      y: customerY + 6,
      width: 242,
      height: 20,
      style: {
        fontSize: 12,
        fontWeight: 'bold',
        color: '#0f172a',
        textAlign: 'right',
        zIndex: 4
      }
    },
    {
      id: 'item_gov_badge',
      type: 'dynamic',
      dynamicKey: 'governorate',
      x: 18,
      y: customerY + 6,
      width: 95,
      height: 22,
      style: {
        backgroundColor: palette.govBadgeBg,
        color: palette.govBadgeTextColor,
        fontSize: 10.5,
        fontWeight: 'bold',
        borderRadius: 4,
        textAlign: 'center',
        padding: 2,
        zIndex: 4
      }
    },
    {
      id: 'item_phone1',
      type: 'dynamic',
      dynamicKey: 'phone1',
      x: 230,
      y: customerY + 30,
      width: 132,
      height: 16,
      style: {
        fontSize: 9.5,
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
      x: 120,
      y: customerY + 30,
      width: 105,
      height: 16,
      style: {
        fontSize: 9.5,
        color: '#64748b',
        textAlign: 'right',
        zIndex: 4
      }
    },
    {
      id: 'item_date',
      type: 'dynamic',
      dynamicKey: 'date',
      x: 18,
      y: customerY + 30,
      width: 95,
      height: 16,
      style: {
        fontSize: 8.5,
        color: '#64748b',
        textAlign: 'left',
        zIndex: 4
      }
    },
    {
      id: 'item_address',
      type: 'dynamic',
      dynamicKey: 'address',
      x: 18,
      y: customerY + 48,
      width: 344,
      height: 16,
      style: {
        fontSize: 9,
        color: '#475569',
        textAlign: 'right',
        zIndex: 4
      }
    }
  );

  // Special Decoration (Between Customer and Table)
  if (hasFragile) {
    items.push({
      id: 'item_fragile_banner',
      type: 'text',
      content: '📦 طرد مميز - ⚠️ قابل للكسر - برجاء الحذر في النقل',
      x: 12,
      y: customerY + 72,
      width: 356,
      height: 20,
      style: {
        backgroundColor: '#fef3c7',
        borderColor: '#f59e0b',
        borderWidth: 1,
        borderRadius: 4,
        color: '#b45309',
        fontSize: 9,
        fontWeight: 'bold',
        textAlign: 'center',
        padding: 2,
        zIndex: 4
      }
    });
  } else if (hasGovFocus) {
    items.push({
      id: 'item_gov_focus_banner',
      type: 'dynamic',
      dynamicKey: 'governorate',
      x: 12,
      y: customerY + 72,
      width: 356,
      height: 22,
      style: {
        backgroundColor: '#eff6ff',
        borderColor: '#2563eb',
        borderWidth: 2,
        borderRadius: 4,
        color: '#1d4ed8',
        fontSize: 11,
        fontWeight: 'bold',
        textAlign: 'center',
        padding: 2,
        zIndex: 4
      }
    });
  }

  // Mandatory 6-Column Table
  items.push({
    id: 'item_table',
    type: 'table',
    x: 12,
    y: tableY,
    width: 356,
    height: tableHeight,
    style: {
      borderColor: palette.tableBorderColor,
      backgroundColor: palette.tableHeaderBg,
      color: palette.tableHeaderTextColor,
      borderWidth: 1,
      borderStyle: 'solid',
      fontSize: 8.5,
      zIndex: 3
    }
  });

  // Financials / Totals Box (RTL: Shipping on Right, Total on Left)
  const isCodBold = specialType === 'cod-bold';
  items.push(
    {
      id: 'item_total_bg',
      type: 'rect',
      x: 12,
      y: totalsY,
      width: 356,
      height: 46,
      style: {
        backgroundColor: palette.totalBg,
        borderColor: isCodBold ? '#000000' : palette.borderColor,
        borderWidth: isCodBold ? 2 : 1,
        borderRadius: Math.max(2, palette.borderRadius - 2),
        zIndex: 2
      }
    },
    {
      id: 'item_shipping_label',
      type: 'text',
      content: 'مصاريف الشحن:',
      x: 260,
      y: totalsY + 6,
      width: 100,
      height: 16,
      style: {
        fontSize: 9.5,
        fontWeight: 'bold',
        color: palette.totalTextColor,
        opacity: 0.85,
        textAlign: 'right',
        zIndex: 4
      }
    },
    {
      id: 'item_shipping_val',
      type: 'dynamic',
      dynamicKey: 'shipping',
      x: 190,
      y: totalsY + 6,
      width: 68,
      height: 16,
      style: {
        fontSize: 9.5,
        fontWeight: 'bold',
        color: palette.totalTextColor,
        textAlign: 'left',
        zIndex: 4
      }
    },
    {
      id: 'item_total_label',
      type: 'text',
      content: 'المطلوب تحصيله:',
      x: 18,
      y: totalsY + 6,
      width: 85,
      height: 16,
      style: {
        fontSize: 10,
        fontWeight: 'bold',
        color: palette.totalTextColor,
        textAlign: 'right',
        zIndex: 4
      }
    },
    {
      id: 'item_total_val',
      type: 'dynamic',
      dynamicKey: 'total',
      x: 105,
      y: totalsY + 4,
      width: 80,
      height: 24,
      style: {
        fontSize: 14,
        fontWeight: 'bold',
        color: palette.totalTextColor,
        textAlign: 'left',
        zIndex: 4
      }
    }
  );

  // Notes Box & Footer (RTL: Employee on Right, Page on Left)
  items.push(
    {
      id: 'item_notes_bg',
      type: 'rect',
      x: 12,
      y: notesY,
      width: 356,
      height: 42,
      style: {
        backgroundColor: '#f8fafc',
        borderColor: palette.borderColor,
        borderWidth: 1,
        borderRadius: 4,
        zIndex: 2
      }
    },
    {
      id: 'item_notes_label',
      type: 'text',
      content: 'ملاحظات:',
      x: 310,
      y: notesY + 4,
      width: 52,
      height: 16,
      style: {
        fontSize: 9,
        fontWeight: 'bold',
        color: palette.primaryColor,
        textAlign: 'right',
        zIndex: 4
      }
    },
    {
      id: 'item_notes_val',
      type: 'dynamic',
      dynamicKey: 'notes',
      x: 18,
      y: notesY + 4,
      width: 290,
      height: 16,
      style: {
        fontSize: 8.5,
        color: '#475569',
        textAlign: 'right',
        zIndex: 4
      }
    },
    {
      id: 'item_employee_val',
      type: 'dynamic',
      dynamicKey: 'employee',
      x: 190,
      y: notesY + 22,
      width: 172,
      height: 16,
      style: {
        fontSize: 8,
        color: '#64748b',
        textAlign: 'right',
        zIndex: 4
      }
    },
    {
      id: 'item_page_val',
      type: 'dynamic',
      dynamicKey: 'page',
      x: 18,
      y: notesY + 22,
      width: 168,
      height: 16,
      style: {
        fontSize: 8,
        color: '#64748b',
        textAlign: 'left',
        zIndex: 4
      }
    }
  );

  // Bottom Special Decorations (Cut-Stub, Stamp Box, Dual Barcode)
  if (hasCutStub) {
    items.push(
      {
        id: 'item_cut_stub_line',
        type: 'rect',
        x: 12,
        y: bottomDecorY,
        width: 356,
        height: 1,
        style: {
          borderColor: '#ef4444',
          borderWidth: 1,
          borderStyle: 'dashed',
          zIndex: 3
        }
      },
      {
        id: 'item_cut_stub_text',
        type: 'text',
        content: '✂️ قص هنا - إيصال استلام للعميل',
        x: 12,
        y: bottomDecorY + 2,
        width: 356,
        height: 14,
        style: {
          color: '#dc2626',
          fontSize: 8,
          fontWeight: 'bold',
          textAlign: 'center',
          zIndex: 4
        }
      }
    );
  } else if (hasStampBox) {
    items.push({
      id: 'item_stamp_box',
      type: 'text',
      content: 'ختم الشركة الرسمي  |  توقيع المستلم عند الفحص',
      x: 12,
      y: bottomDecorY,
      width: 356,
      height: 18,
      style: {
        backgroundColor: '#ffffff',
        borderColor: '#94a3b8',
        borderWidth: 1,
        borderStyle: 'dashed',
        borderRadius: 4,
        color: '#64748b',
        fontSize: 8,
        textAlign: 'center',
        padding: 2,
        zIndex: 3
      }
    });
  } else if (hasDualBarcode) {
    items.push({
      id: 'item_pod_barcode',
      type: 'barcode',
      x: 12,
      y: bottomDecorY,
      width: 356,
      height: 18,
      style: { zIndex: 4 }
    });
  }

  // Policy & Terms
  items.push({
    id: 'item_terms',
    type: 'dynamic',
    dynamicKey: 'companyTerms',
    x: 12,
    y: termsY,
    width: 356,
    height: 26,
    style: {
      fontSize: 7.5,
      color: '#64748b',
      textAlign: 'center',
      padding: 2,
      backgroundColor: '#f8fafc',
      borderColor: palette.borderColor,
      borderWidth: 1,
      borderRadius: 4,
      zIndex: 3
    }
  });

  return items;
}

// ─────────────────────────────────────────────────────────────────────────────
// UNIFIED MASTER TEMPLATE RENDERER (ENFORCES ALL 16 MANDATORY FIELDS)
// ─────────────────────────────────────────────────────────────────────────────
export const ThemedWaybillTemplate: React.FC<WaybillProps & { templateId?: number | string }> = (props) => {
  const templateId = Number(props.templateId || 1);
  const { d, companyLogo, companyPhone, companyName, terms, companyAddress } = resolveWaybillInfo(props);
  const theme = TEMPLATE_THEMES[templateId] || TEMPLATE_THEMES[1];
  const pCount = (d.products || []).length;
  const isHighVolume = pCount >= 7;

  // Specific custom layout for Template 21 (Suits Boutique)
  if (templateId === 21) {
    return (
      <div
        className={`bg-[#fefdfd] text-[#2c1e23] ${isHighVolume ? 'p-2' : 'p-2.5 sm:p-3'} border-2 border-[#eed8dc] rounded-sm w-full max-w-[395px] mx-auto text-right font-sans box-border flex flex-col justify-between h-full min-h-[480px] overflow-hidden text-xs leading-normal select-none relative`}
        dir="rtl"
      >
        <div>
          {/* Top Header Section with Hanging Ribbon */}
          <div className={`flex justify-between items-start border-b border-[#eed8dc] ${isHighVolume ? 'pb-1 mb-1' : 'pb-2 mb-2'}`} style={{ direction: 'ltr' }}>
            {/* Hanging Ribbon Badge (Left) */}
            <div className={`${isHighVolume ? 'w-20 p-1 pb-1.5 -mt-2 ml-1' : 'w-22 p-1.5 pb-2.5 -mt-3 ml-1'} bg-[#1a2638] text-white rounded-b-lg shadow-sm text-center flex flex-col items-center justify-center flex-shrink-0`}>
              {companyLogo ? (
                <img src={companyLogo} alt="Logo" className={`${isHighVolume ? 'h-6' : 'h-8'} max-w-full object-contain mb-0.5 rounded`} />
              ) : (
                <div className="w-6 h-6 rounded-full border border-amber-300/40 flex items-center justify-center font-serif font-black text-xs text-amber-200 mb-0.5">S</div>
              )}
              <span className="font-serif font-black tracking-widest text-[9px] uppercase truncate max-w-[75px]">{companyName}</span>
              <span className="text-[6px] text-slate-300 uppercase tracking-tight">BOUTIQUE</span>
            </div>

            {/* Center Title & Barcode */}
            <div className="flex-1 text-center flex flex-col items-center justify-center px-1" style={{ direction: 'rtl' }}>
              <div className="text-[9px] text-[#914d61] font-bold">🌿 𐂂 🌿</div>
              <h1 className="font-serif font-black text-xs sm:text-sm text-[#2c1e23] -mt-0.5 mb-1 tracking-tight">بوليصة شحن وفاتورة</h1>
              <div className="border border-[#eed8dc] bg-white px-2 py-0.5 rounded-md flex flex-col items-center justify-center shadow-2xs">
                <Barcode value={d.orderNumber} height={isHighVolume ? 18 : 26} width={1.05} displayValue={false} />
                <span className="font-mono font-black text-[9.5px] tracking-wider text-slate-800">#{d.orderNumber}</span>
              </div>
            </div>

            {/* Top Right Company Info & Date */}
            <div className="w-28 text-right space-y-0.5 flex-shrink-0" style={{ direction: 'rtl' }}>
              <div className="flex items-center gap-1 text-xs">
                <span className="w-4 h-4 rounded-full bg-[#f6ebed] text-[#914d61] flex items-center justify-center text-[9px] flex-shrink-0">📞</span>
                <div className="truncate">
                  <div className="font-bold text-[10.5px] truncate">{companyName}</div>
                  <div className="font-mono text-[8.5px] text-slate-600 truncate">{companyPhone}</div>
                </div>
              </div>
              <div className="border-t border-dotted border-[#eed8dc] pt-0.5 flex items-center gap-1 text-xs">
                <span className="w-4 h-4 rounded-full bg-[#f6ebed] text-[#914d61] flex items-center justify-center text-[9px] flex-shrink-0">📅</span>
                <div>
                  <div className="text-[8.5px] text-slate-500">التاريخ</div>
                  <div className="font-mono font-bold text-[9.5px]">{d.date}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Customer & Address Card */}
          <div className={`border border-[#eed8dc] bg-[#fbf5f6] ${isHighVolume ? 'p-1.5 mb-1' : 'p-2 mb-2'} rounded-lg text-[#2c1e23] space-y-0.5 shadow-2xs`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 truncate">
                <span className="w-5 h-5 rounded-full bg-white text-[#914d61] border border-[#eed8dc] flex items-center justify-center text-[10px] shrink-0">👤</span>
                <div className="truncate">
                  <strong className="text-[11.5px] text-[#914d61] font-black">{d.customerName}</strong>
                  <span className="font-mono text-[9.5px] text-slate-700 font-bold mr-2">
                    📞 {d.phone1} {d.phone2 ? ` / ${d.phone2}` : ''}
                  </span>
                </div>
              </div>
              <strong className="text-[10.5px] font-black text-[#914d61] bg-white px-2 py-0.5 rounded border border-[#eed8dc] shadow-2xs shrink-0">
                {d.gov}
              </strong>
            </div>

            <div className="flex items-start gap-1.5 border-t border-dotted border-[#eed8dc] pt-0.5 text-[10px]">
              <span className="w-4 h-4 rounded-full bg-white text-[#914d61] border border-[#eed8dc] flex items-center justify-center text-[8.5px] flex-shrink-0 mt-0.5">📍</span>
              <div className="text-slate-800 leading-snug">
                <strong className="text-[#914d61] ml-1">العنوان:</strong>
                <span className="font-semibold">{d.address}</span>
              </div>
            </div>
          </div>

          {/* 6-Column Products Table */}
          <WaybillProductsTable
            products={d.products}
            headerBg="bg-[#914d61]"
            headerTextColor="text-white"
            borderColor="border-[#eed8dc]"
            rowBorderColor="border-[#f6ebed]"
          />
        </div>

        {/* Bottom Section */}
        <div className={`${isHighVolume ? 'space-y-1 mt-0.5' : 'space-y-1.5 mt-1'}`}>
          <div className="grid grid-cols-12 gap-1.5">
            {/* Totals Box */}
            <div className={`col-span-6 border border-[#eed8dc] bg-[#fbf5f6] ${isHighVolume ? 'p-1' : 'p-1.5'} rounded-lg text-[9px] space-y-0.5 flex flex-col justify-between`}>
              <div className="flex justify-between items-center text-slate-700">
                <span>🚚 مصاريف الشحن:</span>
                <span className="font-mono font-bold">{d.shipping} ج.م</span>
              </div>
              <div className="bg-[#914d61] text-white p-1 rounded flex justify-between items-center font-black text-[9.5px] shadow-2xs">
                <span>💳 الإجمالي المطلوب:</span>
                <span className={`font-mono ${isHighVolume ? 'text-xs' : 'text-sm'} font-black`}>{d.total.toLocaleString()} ج.م</span>
              </div>
            </div>

            {/* Notes Box */}
            <div className={`col-span-6 border border-[#eed8dc] bg-white ${isHighVolume ? 'p-1' : 'p-1.5'} rounded-lg text-[8.5px] flex flex-col justify-between`}>
              <div className="font-bold text-[#914d61]">ملاحظات:</div>
              <div className="text-[8px] text-slate-700 leading-tight">
                {d.notes || '— لا توجد ملاحظات خاصة'}
              </div>
              <div className="flex justify-between items-center text-[7.5px] text-slate-500 border-t border-dotted border-[#eed8dc] pt-0.5 mt-0.5">
                <span>الموظف: <strong>{d.employee}</strong></span>
                <span>البيدج: <strong>{d.page}</strong></span>
              </div>
            </div>
          </div>

          {/* Policy Box */}
          <div className={`border border-[#eed8dc] bg-[#fbf5f6] ${isHighVolume ? 'p-1 text-[7.5px]' : 'p-1.5 text-[8px]'} rounded-lg text-slate-600 text-center leading-tight`}>
            {terms}
          </div>
        </div>
      </div>
    );
  }

  // Standard or Specialized Layout for Templates 1 to 50
  return (
    <div
      className={`${isHighVolume ? 'p-2' : 'p-2.5 sm:p-3'} w-full max-w-[395px] mx-auto text-right box-border flex flex-col justify-between h-full min-h-[480px] overflow-hidden text-xs leading-normal select-none shadow-xs ${theme.containerClass}`}
      dir="rtl"
    >
      <div>
        {/* Header: Banner Header Style */}
        {theme.headerType === 'banner' && (
          <div className={`p-2 -mx-2.5 -mt-2.5 sm:-mx-3 sm:-mt-3 ${isHighVolume ? 'mb-1 py-1 px-2' : 'mb-2'} flex justify-between items-center ${theme.headerBg} ${theme.headerTextColor}`}>
            <div className="flex items-center gap-1.5 truncate">
              {companyLogo && <img src={companyLogo} alt="Logo" className={`${isHighVolume ? 'h-7 max-w-[55px]' : 'h-8 max-w-[65px]'} object-contain rounded bg-white/10 p-0.5`} />}
              <div className="truncate">
                <h1 className="font-black text-xs truncate">{companyName}</h1>
                <p className="text-[9px] font-mono opacity-90 truncate">📞 {companyPhone}</p>
              </div>
            </div>
            <div className="text-center flex flex-col items-center justify-center bg-white text-slate-900 px-1.5 py-0.5 rounded shadow-xs">
              <Barcode value={d.orderNumber} height={isHighVolume ? 18 : 22} width={1.05} displayValue={false} />
              <span className="font-mono font-black text-[9px]">#{d.orderNumber}</span>
            </div>
          </div>
        )}

        {/* Header: Dark Inverted Header Style */}
        {theme.headerType === 'dark' && (
          <div className={`p-2 rounded-t-lg -mx-2.5 -mt-2.5 sm:-mx-3 sm:-mt-3 ${isHighVolume ? 'mb-1 py-1 px-2' : 'mb-2'} flex justify-between items-center ${theme.headerBg} ${theme.headerTextColor}`}>
            <div className="flex items-center gap-2 truncate">
              {companyLogo && <img src={companyLogo} alt="Logo" className={`${isHighVolume ? 'h-7 max-w-[55px]' : 'h-8 max-w-[70px]'} object-contain rounded bg-white/10 p-0.5`} />}
              <div className="truncate">
                <h1 className="font-black text-sm text-white truncate">{companyName}</h1>
                <p className="text-[9.5px] text-slate-300 font-mono truncate">📞 {companyPhone}</p>
              </div>
            </div>
            <div className="text-center flex flex-col items-end">
              <Barcode value={d.orderNumber} height={isHighVolume ? 18 : 24} width={1.05} displayValue={false} />
              <span className="font-mono font-black text-[9.5px] text-amber-400">#{d.orderNumber}</span>
            </div>
          </div>
        )}

        {/* Header: Thermal Receipt Header Style */}
        {theme.headerType === 'thermal' && (
          <div className={`border-b-2 border-dashed border-black ${isHighVolume ? 'pb-1 mb-1' : 'pb-1.5 mb-2'} text-center`}>
            <div className="flex justify-center items-center gap-2 mb-0.5">
              {companyLogo && <img src={companyLogo} alt="Logo" className={`${isHighVolume ? 'h-6 max-w-[50px]' : 'h-8 max-w-[60px]'} object-contain grayscale`} />}
              <div className="font-black text-xs sm:text-sm">{companyName}</div>
            </div>
            <div className="text-[9.5px] font-mono">هاتف: {companyPhone}</div>
            <div className="flex justify-center my-0.5">
              <Barcode value={d.orderNumber} height={isHighVolume ? 18 : 25} width={1.05} displayValue={false} />
            </div>
            <div className="font-mono font-black text-[10px]">#{d.orderNumber} • {d.date}</div>
          </div>
        )}

        {/* Header: Standard Header Style (Default) */}
        {(theme.headerType === 'standard' || theme.headerType === 'minimal' || !theme.headerType) && (
          <div className={`flex justify-between items-center ${isHighVolume ? 'pb-1 mb-1' : 'pb-2 mb-2'} border-b border-inherit`}>
            <div className="flex items-center gap-2 max-w-[55%]">
              {companyLogo ? (
                <img src={companyLogo} alt="Logo" className={`${isHighVolume ? 'h-7 max-w-[55px]' : 'h-9 max-w-[70px]'} object-contain rounded`} />
              ) : null}
              <div className="truncate">
                <h1 className="font-black text-xs text-slate-900 truncate">{companyName}</h1>
                <p className="text-[9.5px] text-slate-600 font-mono truncate">📞 {companyPhone}</p>
              </div>
            </div>
            <div className="text-left flex flex-col items-center justify-center">
              <Barcode value={d.orderNumber} height={isHighVolume ? 18 : 24} width={1.05} displayValue={false} />
              <span className="font-mono font-black text-[9.5px] text-slate-800">#{d.orderNumber}</span>
            </div>
          </div>
        )}

        {/* Customer & Destination Box */}
        <div className={`${isHighVolume ? 'mb-1 p-1.5 space-y-0.5 text-[10px]' : 'mb-2 p-2 space-y-1 text-xs'} ${theme.customerBoxClass || 'border border-slate-300 rounded bg-slate-50'}`}>
          <div className="flex justify-between items-center">
            <div className="truncate">
              <span className="text-slate-500 text-[10px]">العميل: </span>
              <strong className="text-slate-900 font-black text-xs">{d.customerName}</strong>
            </div>
            <span className={theme.govBadgeClass || 'bg-slate-900 text-white px-2 py-0.5 rounded font-bold text-xs shrink-0'}>
              {d.gov}
            </span>
          </div>

          <div className="flex justify-between items-center text-[10px]">
            <div className="font-mono font-bold text-slate-800">
              📞 {d.phone1} {d.phone2 ? <span className="text-slate-600 font-medium"> / {d.phone2}</span> : null}
            </div>
            <div className="text-slate-500 font-mono text-[9.5px]">
              📅 {d.date}
            </div>
          </div>

          <div className={`border-t border-inherit/40 ${isHighVolume ? 'pt-0.5 text-[10px]' : 'pt-1 text-[11px]'} text-slate-800 leading-snug`}>
            <span className="text-slate-500 font-bold">العنوان: </span>
            <span className="font-medium">{d.address}</span>
          </div>
        </div>

        {/* Special Decoration: Fragile Box Alert for Template 12 */}
        {theme.specialType === 'fragile-box' && (
          <div className="bg-amber-100 border border-amber-300 text-amber-900 px-2 py-0.5 rounded text-[10px] font-bold flex justify-between items-center mb-1">
            <span>📦 طرد مميز</span>
            <span>⚠️ قابل للكسر - برجاء الحذر في النقل</span>
          </div>
        )}

        {/* Special Decoration: Governorate Focus Giant Badge for Template 43 */}
        {theme.specialType === 'gov-focus' && (
          <div className="bg-blue-50 border-2 border-blue-600 p-1 rounded text-center my-1">
            <span className="text-[10px] text-blue-700 font-bold">توزيع المحافظات: </span>
            <span className="text-sm font-black text-blue-900">{d.gov}</span>
          </div>
        )}

        {/* Mandatory 6-Column Products Table */}
        <WaybillProductsTable
          products={d.products}
          headerBg={theme.tableHeaderBg || 'bg-slate-100'}
          headerTextColor={theme.tableHeaderTextColor || 'text-slate-800'}
          borderColor={theme.tableBorderColor || 'border-slate-300'}
          showCheckboxes={theme.tableShowCheckboxes}
          striped={theme.tableStriped}
        />
      </div>

      {/* Bottom Financials, Notes, Employee/Page, Terms */}
      <div className={`${isHighVolume ? 'space-y-1 mt-0.5' : 'space-y-1.5 mt-1'}`}>
        {/* Shipping & Final Cash Collection Box */}
        <div className={`${isHighVolume ? 'p-1.5' : 'p-2'} rounded flex justify-between items-center text-xs ${theme.totalBoxClass || 'bg-slate-900 text-white font-black'}`}>
          <div>
            <div className="text-[9.5px] opacity-80">مصاريف الشحن: <span className="font-mono font-bold">{d.shipping} ج.م</span></div>
          </div>
          <div className="text-left">
            <span className="text-[9.5px] font-bold block">المطلوب تحصيله:</span>
            <span className={`font-mono ${isHighVolume ? 'text-sm' : 'text-base'} font-black tracking-tight`}>{d.total.toLocaleString()} <span className="text-xs font-normal">ج.م</span></span>
          </div>
        </div>

        {/* Notes Box */}
        <div className={`${isHighVolume ? 'p-1 text-[9px]' : 'p-1.5 text-[10px]'} bg-slate-50 rounded border border-slate-200 text-slate-800`}>
          <strong className="font-bold text-slate-900">ملاحظات: </strong>
          <span>{d.notes || 'لا توجد ملاحظات خاصة'}</span>
        </div>

        {/* Employee & Page Footer */}
        <div className={`flex justify-between items-center ${isHighVolume ? 'p-0.5 text-[8.5px]' : 'p-1 text-[9.5px]'} text-slate-600 border border-slate-200 bg-slate-50/50 rounded`}>
          <span>الموظف: <strong className="font-bold text-slate-900">{d.employee || 'Admin'}</strong></span>
          <span>البيدج: <strong className="font-bold text-slate-900">{d.page || companyName}</strong></span>
        </div>

        {/* Special Decoration: Stamp and Signature Box */}
        {theme.specialType === 'stamp-box' && (
          <div className="grid grid-cols-2 gap-2 border border-dashed border-slate-400 p-1 rounded text-[8.5px] text-center text-slate-500">
            <div>ختم الشركة الرسمي</div>
            <div className="border-r border-dashed border-slate-400">توقيع المستلم عند الفحص</div>
          </div>
        )}

        {/* Special Decoration: Dual Barcode for Template 9 */}
        {theme.specialType === 'dual-barcode' && (
          <div className="flex justify-between items-center border-t-2 border-black pt-1">
            <div className="text-[8px] font-mono font-bold">DELIVERY POD:</div>
            <Barcode value={`${d.orderNumber}-POD`} height={isHighVolume ? 16 : 20} width={1} displayValue={false} />
          </div>
        )}

        {/* Special Decoration: Perforated Cut Stub for Template 7 & 42 */}
        {theme.specialType === 'cut-stub' && (
          <div className="space-y-0.5">
            <div className="border-b-2 border-dashed border-red-500 relative my-1 text-center">
              <span className="bg-white text-red-600 px-2 text-[8px] font-bold absolute -top-2 left-1/2 -translate-x-1/2">
                ✂️ قص هنا - إيصال استلام للعميل
              </span>
            </div>
            <div className="flex justify-between items-center text-[8.5px] text-slate-600 bg-red-50/60 p-1 rounded">
              <span>#{d.orderNumber} - {d.customerName}</span>
              <span className="font-bold font-mono text-red-700">{d.total.toLocaleString()} ج.م</span>
            </div>
          </div>
        )}

        {/* Company Terms & Inspection Policy */}
        <div className={`${isHighVolume ? 'text-[7.5px] pt-0.5' : 'text-[8.5px] pt-1'} text-slate-500 text-center leading-tight border-t border-slate-200`}>
          {terms}
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// EXPORT ALL 50 DISTINCT TEMPLATES AS TYPED FUNCTIONAL COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────
export const Template1_Classic: React.FC<WaybillProps> = (props) => <ThemedWaybillTemplate {...props} templateId={1} />;
export const Template2_Modern: React.FC<WaybillProps> = (props) => <ThemedWaybillTemplate {...props} templateId={2} />;
export const Template3_CourierBadge: React.FC<WaybillProps> = (props) => <ThemedWaybillTemplate {...props} templateId={3} />;
export const Template4_Thermal: React.FC<WaybillProps> = (props) => <ThemedWaybillTemplate {...props} templateId={4} />;
export const Template5_CompactSlip: React.FC<WaybillProps> = (props) => <ThemedWaybillTemplate {...props} templateId={5} />;
export const Template6_LuxuryRoyal: React.FC<WaybillProps> = (props) => <ThemedWaybillTemplate {...props} templateId={6} />;
export const Template7_ReceiptStub: React.FC<WaybillProps> = (props) => <ThemedWaybillTemplate {...props} templateId={7} />;
export const Template8_GridDashboard: React.FC<WaybillProps> = (props) => <ThemedWaybillTemplate {...props} templateId={8} />;
export const Template9_DualBarcode: React.FC<WaybillProps> = (props) => <ThemedWaybillTemplate {...props} templateId={9} />;
export const Template10_FormalTax: React.FC<WaybillProps> = (props) => <ThemedWaybillTemplate {...props} templateId={10} />;
export const Template11_Minimalist: React.FC<WaybillProps> = (props) => <ThemedWaybillTemplate {...props} templateId={11} />;
export const Template12_BoxLabel: React.FC<WaybillProps> = (props) => <ThemedWaybillTemplate {...props} templateId={12} />;
export const Template13_DarkHeader: React.FC<WaybillProps> = (props) => <ThemedWaybillTemplate {...props} templateId={13} />;
export const Template14_LandscapeSplit: React.FC<WaybillProps> = (props) => <ThemedWaybillTemplate {...props} templateId={14} />;
export const Template15_PackingSlip: React.FC<WaybillProps> = (props) => <ThemedWaybillTemplate {...props} templateId={15} />;
export const Template16_Geometric: React.FC<WaybillProps> = (props) => <ThemedWaybillTemplate {...props} templateId={16} />;
export const Template17_CODBold: React.FC<WaybillProps> = (props) => <ThemedWaybillTemplate {...props} templateId={17} />;
export const Template18_Segmented: React.FC<WaybillProps> = (props) => <ThemedWaybillTemplate {...props} templateId={18} />;
export const Template19_FreightTag: React.FC<WaybillProps> = (props) => <ThemedWaybillTemplate {...props} templateId={19} />;
export const Template20_SecureStamp: React.FC<WaybillProps> = (props) => <ThemedWaybillTemplate {...props} templateId={20} />;
export const Template21_SuitsBoutique: React.FC<WaybillProps> = (props) => <ThemedWaybillTemplate {...props} templateId={21} />;
export const Template22_EcoGreen: React.FC<WaybillProps> = (props) => <ThemedWaybillTemplate {...props} templateId={22} />;
export const Template23_FastOrange: React.FC<WaybillProps> = (props) => <ThemedWaybillTemplate {...props} templateId={23} />;
export const Template24_NavyExecutive: React.FC<WaybillProps> = (props) => <ThemedWaybillTemplate {...props} templateId={24} />;
export const Template25_HomeDirect: React.FC<WaybillProps> = (props) => <ThemedWaybillTemplate {...props} templateId={25} />;
export const Template26_WarehouseCargo: React.FC<WaybillProps> = (props) => <ThemedWaybillTemplate {...props} templateId={26} />;
export const Template27_WideHeader: React.FC<WaybillProps> = (props) => <ThemedWaybillTemplate {...props} templateId={27} />;
export const Template28_ModernViolet: React.FC<WaybillProps> = (props) => <ThemedWaybillTemplate {...props} templateId={28} />;
export const Template29_PersonalCard: React.FC<WaybillProps> = (props) => <ThemedWaybillTemplate {...props} templateId={29} />;
export const Template30_DualTone: React.FC<WaybillProps> = (props) => <ThemedWaybillTemplate {...props} templateId={30} />;
export const Template31_LogisticsPro: React.FC<WaybillProps> = (props) => <ThemedWaybillTemplate {...props} templateId={31} />;
export const Template32_DoubleBadge: React.FC<WaybillProps> = (props) => <ThemedWaybillTemplate {...props} templateId={32} />;
export const Template33_NeutralGray: React.FC<WaybillProps> = (props) => <ThemedWaybillTemplate {...props} templateId={33} />;
export const Template34_DeliveryProof: React.FC<WaybillProps> = (props) => <ThemedWaybillTemplate {...props} templateId={34} />;
export const Template35_DirectSale: React.FC<WaybillProps> = (props) => <ThemedWaybillTemplate {...props} templateId={35} />;
export const Template36_CrimsonRed: React.FC<WaybillProps> = (props) => <ThemedWaybillTemplate {...props} templateId={36} />;
export const Template37_SmartTrack: React.FC<WaybillProps> = (props) => <ThemedWaybillTemplate {...props} templateId={37} />;
export const Template38_ECommerceLabel: React.FC<WaybillProps> = (props) => <ThemedWaybillTemplate {...props} templateId={38} />;
export const Template39_StructuredStrip: React.FC<WaybillProps> = (props) => <ThemedWaybillTemplate {...props} templateId={39} />;
export const Template40_DetailedInvoice: React.FC<WaybillProps> = (props) => <ThemedWaybillTemplate {...props} templateId={40} />;
export const Template41_SoftBoutique: React.FC<WaybillProps> = (props) => <ThemedWaybillTemplate {...props} templateId={41} />;
export const Template42_ClassicDuplicate: React.FC<WaybillProps> = (props) => <ThemedWaybillTemplate {...props} templateId={42} />;
export const Template43_GovernorateFocus: React.FC<WaybillProps> = (props) => <ThemedWaybillTemplate {...props} templateId={43} />;
export const Template44_LocalCourier: React.FC<WaybillProps> = (props) => <ThemedWaybillTemplate {...props} templateId={44} />;
export const Template45_SlateSoft: React.FC<WaybillProps> = (props) => <ThemedWaybillTemplate {...props} templateId={45} />;
export const Template46_CashVoucher: React.FC<WaybillProps> = (props) => <ThemedWaybillTemplate {...props} templateId={46} />;
export const Template47_SafeCargo: React.FC<WaybillProps> = (props) => <ThemedWaybillTemplate {...props} templateId={47} />;
export const Template48_MultiStore: React.FC<WaybillProps> = (props) => <ThemedWaybillTemplate {...props} templateId={48} />;
export const Template49_UltraGrid: React.FC<WaybillProps> = (props) => <ThemedWaybillTemplate {...props} templateId={49} />;
export const Template50_UniversalUltimate: React.FC<WaybillProps> = (props) => <ThemedWaybillTemplate {...props} templateId={50} />;

// ─────────────────────────────────────────────────────────────────────────────
// UNIVERSAL TEMPLATE SWITCHER
// ─────────────────────────────────────────────────────────────────────────────
export const UniversalWaybill: React.FC<WaybillProps & { customTemplateData?: any }> = (props) => {
  const currentId = props.templateId !== undefined ? props.templateId : getSelectedTemplateId();

  // 1. Direct custom template data passed
  if (props.customTemplateData) {
    let directData = props.customTemplateData;
    if (typeof directData === 'string') {
      try {
        directData = JSON.parse(directData);
      } catch (e) { }
    }
    const unwrapped = directData?.data || directData;

    if (directData?.type === 'quick' || unwrapped?.sections || unwrapped?.type === 'quick') {
      return <Template52_QuickDesigner {...props} customTemplateData={unwrapped} />;
    }
    return <Template51_CustomDragDrop {...props} customTemplateData={unwrapped} />;
  }

  // 2. Custom template from custom templates registry
  const customTemplates = getCustomWaybillTemplates();
  const customMatch = customTemplates.find(t => String(t.id) === String(currentId));
  if (customMatch) {
    let unwrappedMatchData = customMatch.data || customMatch;
    if (typeof unwrappedMatchData === 'string') {
      try {
        unwrappedMatchData = JSON.parse(unwrappedMatchData);
      } catch (e) { }
    }

    if (customMatch.type === 'quick' || unwrappedMatchData?.sections || unwrappedMatchData?.type === 'quick') {
      return <Template52_QuickDesigner {...props} customTemplateData={unwrappedMatchData} />;
    } else {
      return <Template51_CustomDragDrop {...props} customTemplateData={unwrappedMatchData} />;
    }
  }

  // 3. Fallbacks for 51 and 52
  if (String(currentId) === '51') {
    return <Template51_CustomDragDrop {...props} />;
  }
  if (String(currentId) === '52') {
    return <Template52_QuickDesigner {...props} />;
  }

  // 4. Built-in 1..50
  const tId = Number(currentId);
  switch (tId) {
    case 1: return <Template1_Classic {...props} />;
    case 2: return <Template2_Modern {...props} />;
    case 3: return <Template3_CourierBadge {...props} />;
    case 4: return <Template4_Thermal {...props} />;
    case 5: return <Template5_CompactSlip {...props} />;
    case 6: return <Template6_LuxuryRoyal {...props} />;
    case 7: return <Template7_ReceiptStub {...props} />;
    case 8: return <Template8_GridDashboard {...props} />;
    case 9: return <Template9_DualBarcode {...props} />;
    case 10: return <Template10_FormalTax {...props} />;
    case 11: return <Template11_Minimalist {...props} />;
    case 12: return <Template12_BoxLabel {...props} />;
    case 13: return <Template13_DarkHeader {...props} />;
    case 14: return <Template14_LandscapeSplit {...props} />;
    case 15: return <Template15_PackingSlip {...props} />;
    case 16: return <Template16_Geometric {...props} />;
    case 17: return <Template17_CODBold {...props} />;
    case 18: return <Template18_Segmented {...props} />;
    case 19: return <Template19_FreightTag {...props} />;
    case 20: return <Template20_SecureStamp {...props} />;
    case 21: return <Template21_SuitsBoutique {...props} />;
    case 22: return <Template22_EcoGreen {...props} />;
    case 23: return <Template23_FastOrange {...props} />;
    case 24: return <Template24_NavyExecutive {...props} />;
    case 25: return <Template25_HomeDirect {...props} />;
    case 26: return <Template26_WarehouseCargo {...props} />;
    case 27: return <Template27_WideHeader {...props} />;
    case 28: return <Template28_ModernViolet {...props} />;
    case 29: return <Template29_PersonalCard {...props} />;
    case 30: return <Template30_DualTone {...props} />;
    case 31: return <Template31_LogisticsPro {...props} />;
    case 32: return <Template32_DoubleBadge {...props} />;
    case 33: return <Template33_NeutralGray {...props} />;
    case 34: return <Template34_DeliveryProof {...props} />;
    case 35: return <Template35_DirectSale {...props} />;
    case 36: return <Template36_CrimsonRed {...props} />;
    case 37: return <Template37_SmartTrack {...props} />;
    case 38: return <Template38_ECommerceLabel {...props} />;
    case 39: return <Template39_StructuredStrip {...props} />;
    case 40: return <Template40_DetailedInvoice {...props} />;
    case 41: return <Template41_SoftBoutique {...props} />;
    case 42: return <Template42_ClassicDuplicate {...props} />;
    case 43: return <Template43_GovernorateFocus {...props} />;
    case 44: return <Template44_LocalCourier {...props} />;
    case 45: return <Template45_SlateSoft {...props} />;
    case 46: return <Template46_CashVoucher {...props} />;
    case 47: return <Template47_SafeCargo {...props} />;
    case 48: return <Template48_MultiStore {...props} />;
    case 49: return <Template49_UltraGrid {...props} />;
    case 50: return <Template50_UniversalUltimate {...props} />;
    case 51: return <Template51_CustomDragDrop {...props} />;
    case 52: return <Template52_QuickDesigner {...props} />;
    default: return <Template1_Classic {...props} />;
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// UNIVERSAL PRINTABLE ORDERS BATCH (4 ORDERS PER A4 PAGE - 1/4 A4)
// ─────────────────────────────────────────────────────────────────────────────
export const UniversalPrintableOrders: React.FC<{
  orders: any[];
  companyName?: string;
  companyPhone?: string;
  companyAddress?: string;
  companyLogo?: string | null;
  terms?: string;
  templateId?: number | string;
  users?: any[];
  customTemplateData?: any;
}> = ({ orders, companyName, companyPhone, companyAddress, companyLogo, terms, templateId, users, customTemplateData }) => {
  const compName = companyName || (typeof window !== 'undefined' ? localStorage.getItem('Dragon_company_name') : '') || 'اسم الشركة';
  const compPhone = companyPhone || (typeof window !== 'undefined' ? localStorage.getItem('Dragon_company_phone') : '') || '';
  const compAddr = companyAddress || (typeof window !== 'undefined' ? localStorage.getItem('Dragon_company_address') : '') || '';
  const compLogo = companyLogo || (typeof window !== 'undefined' ? (localStorage.getItem('Dragon_company_logo_url') || localStorage.getItem('Dragon_company_logo')) : null) || assetUrl('Dragon.png');
  const compTerms = terms || (typeof window !== 'undefined' ? localStorage.getItem('Dragon_company_terms') : '') || 'المعاينة حق للعميل قبل الاستلام لضمان عدم وجود أي أخطاء في المقاسات والألوان. مصاريف الشحن يدفعها العميل.';
  const currentTemplate = templateId || getSelectedTemplateId();

  // Chunk orders into groups of 4 (Quarter A4 grid on each A4 page)
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
          
          /* Dynamic Shrinking for Many Products */
          .many-products-medium table { font-size: 9px !important; }
          .many-products-medium table th, .many-products-medium table td { padding: 2px !important; }
          
          .many-products-high table { font-size: 8px !important; }
          .many-products-high table th, .many-products-high table td { padding: 1px !important; line-height: 1 !important; }
          .many-products-high .waybill-container, .many-products-high .waybill-content { gap: 2px !important; }
          
          .many-products-extreme table { font-size: 7px !important; }
          .many-products-extreme table th, .many-products-extreme table td { padding: 0px 1px !important; line-height: 1 !important; }
          .many-products-extreme .waybill-container, .many-products-extreme .waybill-content { gap: 0px !important; }
          .many-products-extreme .mb-2, .many-products-extreme .mb-4 { margin-bottom: 2px !important; }
          .many-products-extreme .p-2, .many-products-extreme .p-4 { padding: 2px !important; }
        }
      `}</style>
      <div id="print-container-inner">
        {chunks.map((chunk, pageIdx) => (
          <div key={pageIdx} className="print-a4-page">
            {chunk.map((order: any, orderIdx: number) => {
              const pCount = (order.products || order.cart || []).length;
              let sizeClass = '';
              if (pCount > 6) sizeClass = 'many-products-extreme';
              else if (pCount > 4) sizeClass = 'many-products-high';
              else if (pCount > 2) sizeClass = 'many-products-medium';

              return (
                <div key={order.id || orderIdx} className={`quarter-a4-cell ${sizeClass}`}>
                  <UniversalWaybill
                    order={order}
                    companyName={compName}
                    companyPhone={compPhone}
                    companyAddress={compAddr}
                    companyLogo={compLogo}
                    terms={compTerms}
                    templateId={currentTemplate}
                    users={users}
                    customTemplateData={customTemplateData}
                  />
                </div>
              );
            })}
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

// ─────────────────────────────────────────────────────────────────────────────
// TEMPLATE 51: CUSTOM DRAG & DROP
// ─────────────────────────────────────────────────────────────────────────────
const Template51_CustomDragDrop: React.FC<WaybillProps & { customTemplateData?: any }> = (props) => {
  const { order, companyName, companyPhone, terms, companyLogo, customTemplateData } = props;
  const d = getOrderData(order);

  let customTemplate: any = customTemplateData;
  if (!customTemplate) {
    try {
      const saved = localStorage.getItem('Dragon_advanced_waybill_template');
      if (saved) {
        customTemplate = JSON.parse(saved);
      }
    } catch (e) {
      console.error('Failed to parse custom waybill template', e);
    }
  }

  if (typeof customTemplate === 'string') {
    try {
      customTemplate = JSON.parse(customTemplate);
    } catch (e) {
      console.error('Failed to parse customTemplate string', e);
    }
  }

  // If customTemplate has nested data property
  if (customTemplate && customTemplate.data) {
    if (typeof customTemplate.data === 'string') {
      try {
        customTemplate = JSON.parse(customTemplate.data);
      } catch (e) {
        customTemplate = customTemplate.data;
      }
    } else {
      customTemplate = customTemplate.data;
    }
  }

  // Extract items array safely
  let items: any[] = [];
  if (Array.isArray(customTemplate)) {
    items = customTemplate;
  } else if (customTemplate && Array.isArray(customTemplate.items)) {
    items = customTemplate.items;
  } else if (customTemplate && Array.isArray(customTemplate.canvasItems)) {
    items = customTemplate.canvasItems;
  }

  if (!items || items.length === 0) {
    return <Template1_Classic {...props} />;
  }

  const resolveDynamicText = (dynamicKey?: string) => {
    switch (dynamicKey) {
      case 'companyName': return companyName || d.page || 'اسم الشركة';
      case 'companyPhone': return companyPhone || '01000000000';
      case 'companyTerms': return terms || 'تعتبر هذه البوليصة مستند استلام رسمي. المعاينة حق للعميل.';
      case 'date': return d.date;
      case 'orderNumber': return d.orderNumber;
      case 'customerName': return d.customerName;
      case 'phone1': return d.phone1;
      case 'phone2': return d.phone2;
      case 'governorate': return d.gov;
      case 'address': return d.address;
      case 'shipping': return d.shipping + ' ج.م';
      case 'total': return d.total.toLocaleString() + ' ج.م';
      case 'notes': return d.notes;
      case 'employee': return d.employee;
      case 'page': return d.page;
      default: return '';
    }
  };

  const renderItemContent = (item: any) => {
    const { type, dynamicKey, content, width, height, src } = item;
    const style = item.style || {};

    if (type === 'barcode') {
      return (
        <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <Barcode value={d.orderNumber} height={Math.max(18, (parseInt(height as string) || 35) - 15)} width={1.05} displayValue={false} />
          {style.fontSize && style.fontSize > 0 ? (
            <span style={{ fontSize: style.fontSize, marginTop: 2, fontFamily: 'monospace', fontWeight: 'bold' }}>{d.orderNumber}</span>
          ) : (
            <span style={{ fontSize: 9, marginTop: 2, fontFamily: 'monospace', fontWeight: 'bold' }}>#{d.orderNumber}</span>
          )}
        </div>
      );
    }

    if (type === 'qr') {
      const qrSize = Math.min(parseInt(width as string) || 70, parseInt(height as string) || 70) - 8;
      return (
        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2px' }}>
          <QRCode value={`https://track.dragon.com/${d.orderNumber}`} size={Math.max(30, qrSize)} />
        </div>
      );
    }

    if (type === 'logo') {
      return (
        <img src={companyLogo || assetUrl('Dragon.png')} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
      );
    }

    if (type === 'image' && src) {
      return (
        <img src={src} alt="Uploaded" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
      );
    }

    if (type === 'table') {
      const fontSize = style.fontSize || 9;
      const bColor = style.borderColor || '#cbd5e1';
      const bBg = style.backgroundColor || '#f1f5f9';
      return (
        <table style={{ width: '100%', height: '100%', borderCollapse: 'collapse', fontSize }}>
          <thead>
            <tr style={{ backgroundColor: bBg }}>
              <th style={{ padding: '2px 4px', border: `1px solid ${bColor}`, textAlign: 'right' }}>المنتج</th>
              <th style={{ padding: '2px 4px', border: `1px solid ${bColor}`, textAlign: 'center', width: '35px' }}>المقاس</th>
              <th style={{ padding: '2px 4px', border: `1px solid ${bColor}`, textAlign: 'center', width: '40px' }}>اللون</th>
              <th style={{ padding: '2px 4px', border: `1px solid ${bColor}`, textAlign: 'center', width: '25px' }}>الكمية</th>
              <th style={{ padding: '2px 4px', border: `1px solid ${bColor}`, textAlign: 'center', width: '35px' }}>السعر</th>
              <th style={{ padding: '2px 4px', border: `1px solid ${bColor}`, textAlign: 'center', width: '45px' }}>الإجمالي</th>
            </tr>
          </thead>
          <tbody>
            {d.products.map((p, idx) => (
              <tr key={idx}>
                <td style={{ padding: '2px 4px', border: `1px solid ${bColor}` }}>{p.name}</td>
                <td style={{ padding: '2px 4px', border: `1px solid ${bColor}`, textAlign: 'center' }}>{p.size || '-'}</td>
                <td style={{ padding: '2px 4px', border: `1px solid ${bColor}`, textAlign: 'center' }}>{p.color || '-'}</td>
                <td style={{ padding: '2px 4px', border: `1px solid ${bColor}`, textAlign: 'center' }}>{p.qty}</td>
                <td style={{ padding: '2px 4px', border: `1px solid ${bColor}`, textAlign: 'center' }}>{p.price}</td>
                <td style={{ padding: '2px 4px', border: `1px solid ${bColor}`, textAlign: 'center' }}>{p.lineTotal}</td>
              </tr>
            ))}
          </tbody>
        </table>
      );
    }

    if (type === 'rect' || type === 'circle' || type === 'line') {
      return <div style={{ width: '100%', height: '100%' }}></div>;
    }

    let displayContent = content;
    if (type === 'dynamic' && dynamicKey) {
      displayContent = resolveDynamicText(dynamicKey);
    }

    const textAlign = style.textAlign || 'right';
    const justify = textAlign === 'center' ? 'center' : textAlign === 'left' ? 'flex-start' : 'flex-end';

    return (
      <div style={{ width: '100%', height: '100%', whiteSpace: 'pre-wrap', display: 'flex', alignItems: 'center', lineHeight: 1.2, justifyContent: justify }}>
        {displayContent}
      </div>
    );
  };

  // Robust extraction of watermark from any nested shape
  const rawWatermark = 
    (customTemplate && typeof customTemplate === 'object' && customTemplate.watermark) ||
    (customTemplate && typeof customTemplate === 'object' && customTemplate.data && typeof customTemplate.data === 'object' && customTemplate.data.watermark) ||
    (customTemplateData && typeof customTemplateData === 'object' && customTemplateData.watermark) ||
    (customTemplateData && typeof customTemplateData === 'object' && customTemplateData.data && typeof customTemplateData.data === 'object' && customTemplateData.data.watermark);

  const watermark = rawWatermark && typeof rawWatermark === 'object' ? rawWatermark : undefined;
  const isWatermarkEnabled = Boolean(
    watermark && 
    (watermark.enabled === true || String(watermark.enabled) === 'true') && 
    watermark.text && 
    String(watermark.text).trim().length > 0
  );

  return (
    <div 
      className="waybill-container select-none mx-auto shadow-xs border border-gray-200" 
      dir="rtl" 
      style={{ 
        width: '380px', 
        minHeight: '530px',
        height: '530px', 
        position: 'relative', 
        background: '#fff', 
        boxSizing: 'border-box',
        overflow: 'hidden',
        pageBreakInside: 'avoid',
        breakInside: 'avoid'
      }}
    >
      {items.map((item: any) => {
        const st = item.style || {};
        return (
          <div
            key={item.id}
            style={{
              position: 'absolute',
              left: item.x,
              top: item.y,
              width: item.width,
              height: item.height,
              backgroundColor: item.type === 'table' ? 'transparent' : (st.backgroundColor || 'transparent'),
              color: st.color || '#000000',
              fontSize: st.fontSize ? `${st.fontSize}px` : undefined,
              fontWeight: st.fontWeight || 'normal',
              fontStyle: st.fontStyle || 'normal',
              textAlign: st.textAlign || 'right',
              borderWidth: st.borderWidth !== undefined ? `${st.borderWidth}px` : undefined,
              borderColor: st.borderColor || 'transparent',
              borderRadius: st.borderRadius !== undefined ? `${st.borderRadius}px` : undefined,
              borderStyle: st.borderStyle || 'solid',
              padding: st.padding !== undefined ? `${st.padding}px` : undefined,
              zIndex: st.zIndex || 1,
              boxSizing: 'border-box',
              display: 'flex',
              alignItems: 'center'
            }}
          >
            {renderItemContent(item)}
          </div>
        );
      })}

      {/* Watermark Layer (Layered AFTER items with zIndex: 30 so it is never covered by background boxes/rects) */}
      {isWatermarkEnabled && watermark && (
        <div 
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none',
            userSelect: 'none',
            overflow: 'hidden',
            zIndex: 30,
            mixBlendMode: 'multiply'
          }}
        >
          <span 
            style={{
              fontSize: `${Number(watermark.fontSize) || 34}px`,
              color: watermark.color || '#000000',
              opacity: watermark.opacity !== undefined ? Number(watermark.opacity) : 0.18,
              transform: `rotate(${watermark.rotation !== undefined ? Number(watermark.rotation) : -30}deg)`,
              fontWeight: 'bold',
              letterSpacing: '3px',
              whiteSpace: 'nowrap',
              textAlign: 'center',
              lineHeight: 1.2
            }}
          >
            {watermark.text}
          </span>
        </div>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// TEMPLATE 52: QUICK DESIGNER
// ─────────────────────────────────────────────────────────────────────────────
const Template52_QuickDesigner: React.FC<WaybillProps & { customTemplateData?: any }> = (props) => {
  const { order, companyName, companyPhone, terms, companyLogo, customTemplateData } = props;
  const d = getOrderData(order);

  let quickTemplate: any = customTemplateData;
  if (!quickTemplate) {
    try {
      const saved = localStorage.getItem('Dragon_quick_waybill_template');
      if (saved) {
        quickTemplate = JSON.parse(saved);
      }
    } catch (e) {
      console.error('Failed to parse quick waybill template', e);
    }
  }

  if (typeof quickTemplate === 'string') {
    try {
      quickTemplate = JSON.parse(quickTemplate);
    } catch (e) { }
  }

  // Unwrap if nested in data
  if (quickTemplate?.data) {
    if (typeof quickTemplate.data === 'string') {
      try {
        quickTemplate = JSON.parse(quickTemplate.data);
      } catch (e) {
        quickTemplate = quickTemplate.data;
      }
    } else {
      quickTemplate = quickTemplate.data;
    }
  }

  if (!quickTemplate || !quickTemplate.style || !quickTemplate.sections) {
    return <Template1_Classic {...props} />;
  }

  const rawWatermark = 
    (quickTemplate && typeof quickTemplate === 'object' && quickTemplate.watermark) ||
    (quickTemplate && typeof quickTemplate === 'object' && quickTemplate.data && typeof quickTemplate.data === 'object' && quickTemplate.data.watermark) ||
    (customTemplateData && typeof customTemplateData === 'object' && customTemplateData.watermark) ||
    (customTemplateData && typeof customTemplateData === 'object' && customTemplateData.data && typeof customTemplateData.data === 'object' && customTemplateData.data.watermark);

  const quickWatermark = rawWatermark && typeof rawWatermark === 'object' ? rawWatermark : undefined;
  const isQuickWatermarkEnabled = Boolean(
    quickWatermark && 
    (quickWatermark.enabled === true || String(quickWatermark.enabled) === 'true') && 
    quickWatermark.text && 
    String(quickWatermark.text).trim().length > 0
  );

  const { style, sections } = quickTemplate;
  const sortedSections = [...sections].sort((a: any, b: any) => a.order - b.order);

  const containerStyle: React.CSSProperties = {
    backgroundColor: style.bgColor || '#ffffff',
    color: style.textColor || '#000000',
    borderColor: style.borderColor || '#cbd5e1',
    borderStyle: style.borderStyle === 'none' ? 'none' : (style.borderStyle || 'solid'),
    borderWidth: style.borderStyle === 'none' ? '0' : (style.borderWidth !== undefined ? `${style.borderWidth}px` : '1px'),
    borderRadius: style.borderRadius !== undefined ? `${style.borderRadius}px` : '0px',
    padding: style.padding !== undefined ? `${style.padding}px` : '12px',
    fontFamily: style.fontFamily || 'Cairo, sans-serif',
    width: '380px',
    minHeight: '530px',
    height: '530px',
    boxSizing: 'border-box',
    overflow: 'hidden',
    position: 'relative'
  };

  const headerStyle: React.CSSProperties = {
    backgroundColor: style.headerBg || '#f8fafc',
    color: style.headerText || '#1e293b',
  };

  const govBadgeStyle: React.CSSProperties =
    style.govBadgeStyle === 'filled'
      ? { backgroundColor: style.primaryColor || '#2563eb', color: '#ffffff', padding: '2px 8px' }
      : style.govBadgeStyle === 'outlined'
        ? { border: `2px solid ${style.primaryColor || '#2563eb'}`, color: style.primaryColor || '#2563eb', padding: '2px 8px' }
        : { backgroundColor: style.accentColor || '#7c3aed', color: '#ffffff', padding: '2px 10px', borderRadius: '999px' };

  const totalBoxStyle: React.CSSProperties =
    style.totalStyle === 'highlighted'
      ? { backgroundColor: style.primaryColor || '#2563eb', color: '#ffffff', padding: '8px 12px', borderRadius: '6px' }
      : style.totalStyle === 'boxed'
        ? { border: `2px solid ${style.primaryColor || '#2563eb'}`, padding: '8px 12px', borderRadius: '4px' }
        : { borderTop: `2px solid ${style.primaryColor || '#2563eb'}`, paddingTop: '6px' };

  return (
    <div className="waybill-container select-none text-right flex flex-col gap-2 mx-auto shadow-xs border" style={containerStyle} dir="rtl">
      {sortedSections.map((sec: any) => {
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
                <th className="p-1 text-right border" style={{ borderColor: style.borderColor }}>المنتج</th>
                <th className="p-1 text-center w-9 border" style={{ borderColor: style.borderColor }}>المقاس</th>
                <th className="p-1 text-center w-10 border" style={{ borderColor: style.borderColor }}>اللون</th>
                <th className="p-1 text-center w-8 border" style={{ borderColor: style.borderColor }}>الكمية</th>
                <th className="p-1 text-center w-10 border" style={{ borderColor: style.borderColor }}>السعر</th>
                <th className="p-1 text-center w-12 border" style={{ borderColor: style.borderColor }}>الإجمالي</th>
              </tr>
            </thead>
            <tbody>
              {d.products.map((p, i) => (
                <tr key={i} style={{ borderBottom: `1px solid ${style.borderColor}`, backgroundColor: i % 2 === 0 ? 'transparent' : `${style.primaryColor}08` }}>
                  <td className="p-1 font-bold break-words leading-tight whitespace-normal border-x" style={{ borderColor: style.borderColor, wordBreak: 'break-word' }}>{p.name}</td>
                  <td className="p-1 text-center border-x text-[10px] break-words leading-tight" style={{ borderColor: style.borderColor }}>{p.size || '-'}</td>
                  <td className="p-1 text-center border-x text-[10px] break-words leading-tight" style={{ borderColor: style.borderColor }}>{p.color || '-'}</td>
                  <td className="p-1 text-center font-bold border-x" style={{ borderColor: style.borderColor }}>{p.qty}</td>
                  <td className="p-1 text-center font-mono border-x" style={{ borderColor: style.borderColor }}>{p.price}</td>
                  <td className="p-1 text-center font-mono font-bold border-x" style={{ borderColor: style.borderColor }}>{p.lineTotal}</td>
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
          <div key="terms" className="text-[8px] text-center border-t pt-1 mt-auto" style={{ borderColor: style.borderColor, opacity: 0.6 }}>
            {terms || 'المعاينة حق للعميل قبل الاستلام. يرجى التأكد من سلامة ومطابقة الشحنة.'}
          </div>
        );

        return null;
      })}

      {/* Watermark Layer */}
      {isQuickWatermarkEnabled && quickWatermark && (
        <div 
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none',
            userSelect: 'none',
            overflow: 'hidden',
            zIndex: 30,
            mixBlendMode: 'multiply'
          }}
        >
          <span 
            style={{
              fontSize: `${Number(quickWatermark.fontSize) || 34}px`,
              color: quickWatermark.color || '#000000',
              opacity: quickWatermark.opacity !== undefined ? Number(quickWatermark.opacity) : 0.18,
              transform: `rotate(${quickWatermark.rotation !== undefined ? Number(quickWatermark.rotation) : -30}deg)`,
              fontWeight: 'bold',
              letterSpacing: '3px',
              whiteSpace: 'nowrap',
              textAlign: 'center',
              lineHeight: 1.2
            }}
          >
            {quickWatermark.text}
          </span>
        </div>
      )}
    </div>
  );
};
