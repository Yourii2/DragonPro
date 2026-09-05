/**
 * UniversalWaybillRenderer.tsx
 * Comprehensive Waybill & Invoice Engine with 21 Distinct Structural Layouts.
 * All 21 templates strictly include:
 * 1. Barcode & Order Number
 * 2. Customer Name, Phone(s), Governorate & Full Address
 * 3. Products Statement (Name + Variant, Quantity, Price, Line Total)
 * 4. Shipping Fees & Final Cash to Collect (Total)
 * 5. Order Notes
 * 6. Employee & Page / Seller
 * 7. Company Terms & Policy Footer
 * Perfectly fitted for Quarter-A4 (1/4 ورقة A4 - 4 بوالص في كل ورقة A4).
 */
import React from 'react';
import { 
  Printer, Grid, List, Search, Filter, 
  MapPin, Phone, User, Package, Box, StickyNote, Building2, Calendar, FileText
} from 'lucide-react';
import QRCode from 'react-qr-code';
import { createPortal } from 'react-dom';
import Barcode from './Barcode';
import { assetUrl } from '../services/assetUrl';

export interface WaybillProps {
  order: any;
  companyName: string;
  companyPhone: string;
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
  const phone2 = pickPhone(order?.phone2 || '', '');
  const gov = order?.governorate || order?.city || 'غير محدد';
  const address = order?.address || 'غير محدد';
  const notes = order?.notes || order?.note || order?.order_notes || '';
  const date = order?.created_at ? String(order.created_at).slice(0, 10) : new Date().toISOString().slice(0, 10);

  const rawProducts = order?.products || order?.order_items || order?.items || [];
  const products = Array.isArray(rawProducts) && rawProducts.length > 0
    ? rawProducts.map((p: any) => {
      const name = p.name || p.product_name || 'منتج';
      const variant = [p.color, p.size].filter(Boolean).join(' - ');
      const qty = Number(p.quantity || p.qty || 1);
      const price = Number(p.price || p.price_per_unit || p.sale_price || 0);
      const lineTotal = Number(p.total || p.total_price || p.lineTotal || price * qty);
      return { name, variant, qty, price, lineTotal };
    })
    : [{ name: 'طلب عام', variant: '', qty: 1, price: Number(order?.total_amount || order?.total || 0), lineTotal: Number(order?.total_amount || order?.total || 0) }];

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

export const getSelectedTemplateId = (): number => {
  try {
    const saved = localStorage.getItem('Dragon_waybill_template');
    if (saved && !isNaN(Number(saved))) {
      const n = Number(saved);
      if (n >= 1 && n <= 52) return n;
    }
  } catch (e) { }
  return 1;
};

// ─────────────────────────────────────────────────────────────────────────────
// 21 DISTINCT QUARTER-A4 TEMPLATE RENDERERS (1/4 ورقة A4)
// ─────────────────────────────────────────────────────────────────────────────

// TEMPLATE 1: Classic Standard (Quarter A4)
export const Template1_Classic: React.FC<WaybillProps> = ({
  order,
  companyName,
  companyPhone,
  companyAddress,
  companyLogo,
  terms,
}) => {
  const d = getOrderData(order);

  return (
    <div
      className="bg-white text-black p-4 border border-black rounded-none w-full max-w-[380px] mx-auto text-right font-sans box-border flex flex-col justify-between text-xs leading-relaxed select-none"
      dir="rtl"
    >
      <div>
        {/* Header */}
        <div className="flex justify-between items-center pb-2 mb-2 border-b border-gray-300">
          <div className="w-1/3 flex flex-col items-start justify-center">
            {companyLogo ? (
              <img
                src={companyLogo}
                alt="Logo"
                className="h-10 max-w-full object-contain"
              />
            ) : (
              <span className="text-sm font-bold">{companyName}</span>
            )}
          </div>

          <div className="w-1/3 flex flex-col items-center justify-center">
            <Barcode value={d.orderNumber} height={35} width={1.2} displayValue={false} />
            <span className="font-bold text-xs mt-0.5">#{d.orderNumber}</span>
          </div>

          <div className="w-1/3 text-left flex flex-col items-end justify-center">
            <h2 className="font-bold text-xs">{companyName || 'قصاقيص'}</h2>
            <p className="text-xs font-bold dir-ltr">{companyPhone || '01107317579'}</p>
          </div>
        </div>

        {/* Customer & Destination Box */}
        <div className="border border-gray-400 p-2 rounded-md mb-3 space-y-1.5 text-xs relative">
          <div className="flex justify-between items-start">
            <div>
              <span className="font-bold text-gray-700">العميل: </span>
              <span className="font-bold">{d.customerName}</span>
            </div>
            <span className="font-bold text-xs bg-gray-800 text-white px-3 py-1 rounded-sm shadow-sm">
              {d.gov}
            </span>
          </div>

          <div className="flex justify-between items-center text-gray-600">
            <div>
              <span className="font-bold text-gray-700">الهاتف: </span>
              <span className="font-bold font-mono dir-ltr inline-block">{d.phone1}{d.phone2 ? ` / ${d.phone2}` : ''}</span>
            </div>
          </div>

          <div className="text-gray-500 text-[10px] dir-ltr text-right">
            {d.date}
          </div>

          <div className="pt-1 text-gray-800 border-t border-dashed border-gray-300">
            <span className="font-bold text-gray-700">العنوان: </span>
            <span className="font-medium">{d.address}</span>
          </div>
        </div>

        {/* Product Table */}
        <div className="mb-3 border-b border-gray-300 pb-2">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-black border-b border-gray-200">
                <th className="pb-2 text-right font-bold w-[50%]">المنتج / الصنف</th>
                <th className="pb-2 text-center font-bold">الكمية</th>
                <th className="pb-2 text-center font-bold">السعر</th>
                <th className="pb-2 text-left font-bold">الإجمالي</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {d.products.map((p, i) => (
                <tr key={i} className="text-gray-800">
                  <td className="py-2 text-right font-bold">
                    {p.name} {p.variant && <span className="font-normal text-gray-600">({p.variant})</span>}
                  </td>
                  <td className="py-2 text-center font-bold">{p.qty}</td>
                  <td className="py-2 text-center font-mono">{p.price}</td>
                  <td className="py-2 text-left font-mono font-bold">{p.lineTotal}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Financials, Notes, Employee/Page, Terms */}
      <div className="space-y-2">
        {/* Shipping & Total Box */}
        <div className="flex justify-between items-center border border-gray-400 p-2 rounded-md text-xs font-bold">
          <div>
            <span>مصاريف الشحن: </span>
            <span className="font-mono">{d.shipping} ج.م</span>
          </div>
          <div>
            <span>المطلوب تحصيله: </span>
            <span className="font-mono text-sm">{d.total} ج.م</span>
          </div>
        </div>

        {/* Notes */}
        <div className="text-xs border border-gray-300 p-1.5 rounded-md text-gray-800">
          <strong className="font-bold">ملاحظات: </strong>
          <span>{d.notes || 'لا توجد ملاحظات خاصة'}</span>
        </div>

        {/* Footer info */}
        <div className="flex justify-between items-center text-xs text-gray-700 border border-gray-300 p-1.5 rounded-md">
          <span>الموظف: <strong className="font-bold">{d.employee || 'حبيبه'}</strong></span>
          <span>البيدج: <strong className="font-bold">{d.page || 'Kids Life'}</strong></span>
        </div>

        {/* Terms & Instructions */}
        <div className="text-[9px] text-gray-600 text-center leading-tight pt-1 px-1 border-t border-gray-200">
          {terms ||
            'برجاء المعاينة والمراجعة والقياس عند الإستلام من المندوب لضمان عدم حدوث أي أخطاء في المقاسات والألوان الخاصة بالموديلات وفي حالة مخالفتك لهذه الأمور فالشركة غير مسؤولة. يمكنك الإستبدال فقط بعد لإنسراف المندوب وذلك بمصاريف شحن جديدة. مصاريف الشحن لا علاقة لنا بها هي خاصة بالمندوب أو شركة الشحن التي تقوم بتوصيل الأوردر لك وذلك مقابل خدمة التوصيل ويتحملها العميل في كافة الحالات سواء شراء أو استبدال.'}
        </div>
      </div>
    </div>
  );
};

// TEMPLATE 2: Modern Clean (Quarter A4)
export const Template2_Modern: React.FC<WaybillProps> = ({ order, companyName, companyPhone, companyLogo, terms }) => {
  const d = getOrderData(order);
  return (
    <div className="bg-white text-slate-900 p-2.5 md:p-3 rounded-lg border border-slate-300 shadow-sm w-full max-w-[395px] mx-auto text-right font-sans box-border flex flex-col justify-between h-full min-h-[480px] overflow-hidden text-xs leading-normal select-none" dir="rtl">
      <div>
        <div className="flex justify-between items-center pb-2 border-b border-slate-200 mb-2">
          <div>
            {companyLogo ? <img src={companyLogo} alt="Logo" className="h-9 object-contain" /> : <h1 className="text-sm font-black tracking-tight text-indigo-900">{companyName}</h1>}
            <p className="text-[10px] text-slate-500 font-mono">{companyPhone}</p>
          </div>
          <div className="text-left flex flex-col items-end">
            <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded font-bold text-[10px]">بوليصة #{d.orderNumber}</span>
            <Barcode value={d.orderNumber} height={28} width={1.3} />
          </div>
        </div>

        <div className="bg-slate-50 p-2 rounded border border-slate-200 mb-2 space-y-1 text-xs">
          <div className="flex justify-between items-center">
            <div><span className="text-slate-500 text-[10px]">العميل:</span> <strong className="text-sm text-slate-900">{d.customerName}</strong></div>
            <strong className="text-xs text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">{d.gov}</strong>
          </div>
          <div className="text-slate-600 font-mono text-[11px]">📞 {d.phone1} {d.phone2 ? ` / ${d.phone2}` : ''}</div>
          <div className="border-t border-slate-200 pt-1 text-[11px] text-slate-800">
            <span className="text-slate-500">العنوان: </span><span className="font-medium">{d.address}</span>
          </div>
        </div>

        <div className="rounded border border-slate-200 overflow-hidden mb-2">
          <table className="w-full text-xs">
            <thead className="bg-slate-100 text-slate-700">
              <tr>
                <th className="py-1 px-1.5 text-right font-bold">الصنف</th>
                <th className="py-1 px-1.5 text-center w-10 font-bold">كمية</th>
                <th className="py-1 px-1.5 text-center w-12 font-bold">السعر</th>
                <th className="py-1 px-1.5 text-left w-16 font-bold">الإجمالي</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {d.products.map((p, i) => (
                <tr key={i} className="hover:bg-slate-50">
                  <td className="py-1 px-1.5 font-bold truncate max-w-[150px]">{p.name} {p.variant && <span className="text-[10px] text-slate-500 font-normal">({p.variant})</span>}</td>
                  <td className="py-1 px-1.5 text-center font-bold">{p.qty}</td>
                  <td className="py-1 px-1.5 text-center font-mono">{p.price}</td>
                  <td className="py-1 px-1.5 text-left font-mono font-bold text-slate-900">{p.lineTotal.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="space-y-1.5">
        <div className="flex justify-between items-center bg-indigo-900 text-white p-2 rounded text-xs">
          <div>
            <div className="text-[10px] text-indigo-200">الشحن: {d.shipping} ج.م | الصافي:</div>
            <div className="text-base font-black font-mono">{d.total.toLocaleString()} <span className="text-xs font-normal">ج.م</span></div>
          </div>
          <div className="text-left text-[10px] text-indigo-200">
            <div>الموظف: {d.employee || 'Admin'}</div>
            <div>البيدج: {d.page || companyName}</div>
          </div>
        </div>

        <div className="text-[10px] bg-slate-50 p-1 rounded border border-slate-200 text-slate-700 truncate">
          <strong>ملاحظات: </strong>{d.notes || 'لا توجد ملاحظات خاصة'}
        </div>

        <div className="text-[8.5px] text-slate-500 text-center border-t border-slate-200 pt-0.5 leading-tight">
          {terms || 'شكراً لتعاملكم معنا. المعاينة حق للعميل قبل الاستلام.'}
        </div>
      </div>
    </div>
  );
};

// TEMPLATE 3: Express Courier Badge (Quarter A4)
export const Template3_CourierBadge: React.FC<WaybillProps> = ({ order, companyName, companyPhone, terms }) => {
  const d = getOrderData(order);
  return (
    <div className="bg-white text-black p-2.5 border-2 border-amber-500 w-full max-w-[395px] mx-auto text-right font-sans box-border flex flex-col justify-between h-full min-h-[480px] overflow-hidden text-xs leading-normal select-none" dir="rtl">
      <div>
        <div className="bg-amber-500 text-black px-3 py-1.5 flex justify-between items-center font-black -mx-2.5 -mt-2.5 mb-2 text-xs">
          <span className="uppercase tracking-wider">{companyName} EXPRESS</span>
          <span className="bg-black text-amber-400 px-2 py-0.5 rounded text-[10px] font-mono">COD PARCEL</span>
        </div>
        <div className="grid grid-cols-12 gap-1.5 border-b border-black pb-2 mb-2">
          <div className="col-span-7 space-y-1">
            <div className="text-[9px] text-gray-500 font-bold">DESTINATION / المحافظة:</div>
            <div className="text-lg font-black bg-gray-100 px-2 py-0.5 border border-black inline-block rounded text-blue-900">{d.gov}</div>
            <div className="text-xs font-bold text-gray-800">{d.customerName} - <span className="font-mono">{d.phone1}</span></div>
            <div className="text-[11px] text-gray-700 leading-tight">العنوان: {d.address}</div>
          </div>
          <div className="col-span-5 flex flex-col items-center justify-center border-r border-black pr-1.5">
            <Barcode value={d.orderNumber} height={32} width={1.3} />
            <div className="font-mono font-black text-[10px]">#{d.orderNumber}</div>
          </div>
        </div>
        <div className="border border-black p-1.5 bg-gray-50 mb-2 text-[11px]">
          <div className="font-bold mb-1 border-b border-gray-300 pb-0.5 flex justify-between">
            <span>محتويات الشحنة:</span>
            <span>شحن: {d.shipping} ج.م</span>
          </div>
          {d.products.map((p, i) => (
            <div key={i} className="flex justify-between py-0.5">
              <span>{p.qty}x {p.name} ({p.price} ج.م)</span>
              <span className="font-mono font-bold">{p.lineTotal.toLocaleString()} ج.م</span>
            </div>
          ))}
        </div>
      </div>
      <div className="space-y-1.5">
        <div className="flex justify-between items-center bg-black text-white p-2 rounded">
          <div className="text-[11px] font-bold text-amber-400">المطلوب تحصيله:</div>
          <div className="text-lg font-black font-mono text-amber-400">{d.total.toLocaleString()} EGP</div>
        </div>
        <div className="text-[10px] bg-amber-50 p-1 border border-amber-300 rounded text-black">
          <strong>ملاحظات: </strong>{d.notes || 'لا توجد'}
        </div>
        <div className="flex justify-between text-[9px] text-gray-600">
          <span>الموظف: {d.employee} | البيدج: {d.page}</span>
          <span>{terms || 'المعاينة قبل الاستلام'}</span>
        </div>
      </div>
    </div>
  );
};

// TEMPLATE 4: Thermal Style (Quarter A4)
export const Template4_Thermal: React.FC<WaybillProps> = ({ order, companyName, companyPhone, terms }) => {
  const d = getOrderData(order);
  return (
    <div className="bg-white text-black p-2.5 w-full max-w-[395px] mx-auto text-right font-mono text-xs border-2 border-dashed border-black box-border flex flex-col justify-between h-full min-h-[480px] overflow-hidden leading-normal select-none" dir="rtl">
      <div>
        <div className="text-center font-black text-sm border-b border-dashed border-black pb-1 mb-2">{companyName}<div className="text-[10px] font-normal">{companyPhone}</div></div>
        <div className="flex justify-center mb-1"><Barcode value={d.orderNumber} height={28} width={1.2} /></div>
        <div className="text-center font-black text-xs mb-1">#{d.orderNumber} ({d.date})</div>
        <div className="border-t border-b border-dashed border-black py-1.5 my-1 text-xs space-y-1 font-sans">
          <div><strong>العميل:</strong> {d.customerName} - <strong>الهاتف:</strong> {d.phone1} {d.phone2 ? ` / ${d.phone2}` : ''}</div>
          <div><strong>المحافظة:</strong> <span className="font-black underline">{d.gov}</span></div>
          <div><strong>العنوان:</strong> {d.address}</div>
        </div>
        <div className="my-1 border-b border-dashed border-black pb-1">
          <div className="font-bold mb-0.5">الأصناف (الكمية × السعر):</div>
          {d.products.map((p, i) => (
            <div key={i} className="flex justify-between text-xs py-0.5"><span>{p.qty}x {p.name} ({p.price})</span><span>{p.lineTotal}</span></div>
          ))}
        </div>
      </div>
      <div className="space-y-1 font-sans">
        <div className="flex justify-between text-xs"><span>الشحن: {d.shipping} ج.م</span><span className="font-bold">المجموع: {d.subtotal} ج.م</span></div>
        <div className="flex justify-between items-center text-sm font-black border-2 border-black p-1.5 text-center bg-gray-50">
          <span>المطلوب تحصيله:</span><span className="text-base font-mono">{d.total.toLocaleString()} ج.م</span>
        </div>
        <div className="text-[10px] truncate">ملاحظات: {d.notes || '—'}</div>
        <div className="flex justify-between text-[9px] text-gray-600 border-t border-dashed border-black pt-1">
          <span>الموظف: {d.employee} | {d.page}</span>
          <span>{terms || 'المعاينة متاحة'}</span>
        </div>
      </div>
    </div>
  );
};

// TEMPLATE 5: Compact Slip (Quarter A4)
export const Template5_CompactSlip: React.FC<WaybillProps> = ({ order, companyName, companyPhone, terms }) => {
  const d = getOrderData(order);
  return (
    <div className="bg-white text-black p-2.5 border-2 border-dashed border-gray-600 w-full max-w-[395px] mx-auto text-right text-xs box-border flex flex-col justify-between h-full min-h-[480px] overflow-hidden leading-normal select-none" dir="rtl">
      <div>
        <div className="flex justify-between items-center border-b border-gray-400 pb-1.5 mb-2 font-bold">
          <div><span className="font-black text-sm">{companyName}</span> <span className="font-mono text-xs text-gray-600">({companyPhone})</span></div>
          <div className="text-left"><Barcode value={d.orderNumber} height={22} width={1} /><span className="font-mono text-xs">#{d.orderNumber}</span></div>
        </div>
        <div className="bg-gray-100 p-2 rounded mb-2 text-xs space-y-1">
          <div className="flex justify-between"><div><strong>العميل:</strong> {d.customerName} ({d.phone1})</div><strong className="text-blue-900">{d.gov}</strong></div>
          <div className="border-t border-gray-300 pt-1"><strong>العنوان:</strong> {d.address}</div>
        </div>
        <div className="border border-gray-300 p-1.5 rounded text-xs space-y-1">
          <div className="font-bold border-b pb-0.5 flex justify-between"><span>الطلبات:</span><span>شحن: {d.shipping} ج.م</span></div>
          {d.products.map((p, i) => (<div key={i} className="flex justify-between py-0.5"><span>{p.qty}x {p.name} ({p.price})</span><span className="font-mono font-bold">{p.lineTotal} ج.م</span></div>))}
        </div>
      </div>
      <div className="space-y-1 mt-2">
        <div className="flex justify-between items-center border-t border-gray-400 pt-1.5 font-bold text-xs">
          <span>المطلوب تحصيله:</span>
          <span className="bg-black text-white px-3 py-1 rounded text-sm font-mono">{d.total.toLocaleString()} ج.م</span>
        </div>
        <div className="text-[10px] bg-gray-50 p-1 rounded border"><strong>ملاحظات:</strong> {d.notes || 'لا يوجد'}</div>
        <div className="flex justify-between text-[9px] text-gray-600">
          <span>الموظف: {d.employee} | البيدج: {d.page}</span>
          <span>{terms || 'المعاينة حق للعميل'}</span>
        </div>
      </div>
    </div>
  );
};

// TEMPLATE 6: Luxury Royal Frame (Quarter A4)
export const Template6_LuxuryRoyal: React.FC<WaybillProps> = ({ order, companyName, companyPhone, companyLogo, terms }) => {
  const d = getOrderData(order);
  return (
    <div className="bg-white text-amber-950 p-2.5 border-2 border-amber-700 w-full max-w-[395px] mx-auto text-right font-serif shadow-sm box-border flex flex-col justify-between h-full min-h-[480px] overflow-hidden text-xs leading-normal select-none" dir="rtl">
      <div>
        <div className="flex justify-between items-center border-b border-amber-700 pb-1.5 mb-2">
          <div><h1 className="text-sm font-black tracking-wider text-amber-900">{companyName}</h1><p className="text-[10px] text-amber-800">{companyPhone}</p></div>
          <div className="text-center"><Barcode value={d.orderNumber} height={26} width={1.1} /><div className="font-mono font-bold text-[10px]">#{d.orderNumber}</div></div>
        </div>
        <div className="bg-amber-50 p-2 border border-amber-300 rounded mb-2 text-xs space-y-1">
          <div className="flex justify-between items-center"><span>السيد: <strong>{d.customerName}</strong> ({d.phone1})</span><strong className="text-amber-900 bg-amber-200/60 px-1.5 py-0.5 rounded">{d.gov}</strong></div>
          <div className="text-[11px] text-amber-900">العنوان: {d.address}</div>
        </div>
        <table className="w-full text-xs border border-amber-700 mb-2">
          <thead className="bg-amber-900 text-amber-50"><tr><th className="p-1 text-right">البيان</th><th className="p-1 text-center w-10">العدد</th><th className="p-1 text-center w-12">السعر</th><th className="p-1 text-center w-14">القيمة</th></tr></thead>
          <tbody className="divide-y divide-amber-200 bg-white">{d.products.map((p, i) => (<tr key={i}><td className="p-1 font-bold truncate max-w-[140px]">{p.name}</td><td className="p-1 text-center font-bold">{p.qty}</td><td className="p-1 text-center font-mono">{p.price}</td><td className="p-1 text-center font-mono font-bold">{p.lineTotal.toLocaleString()}</td></tr>))}</tbody>
        </table>
      </div>
      <div className="space-y-1.5">
        <div className="flex justify-between items-center bg-amber-900 text-amber-100 p-2 rounded">
          <div><span className="text-xs font-bold">الشحن: {d.shipping} ج.م | الإجمالي: </span><span className="text-base font-black font-mono">{d.total.toLocaleString()} ج.م</span></div>
        </div>
        <div className="text-[10px] bg-amber-50/70 p-1 rounded border border-amber-200"><strong>ملاحظات: </strong>{d.notes || '—'}</div>
        <div className="flex justify-between text-[9px] text-amber-800"><span>الموظف: {d.employee} | {d.page}</span><span>{terms || 'المعاينة متاحة للعميل'}</span></div>
      </div>
    </div>
  );
};

// TEMPLATE 7: Perforated Receipt Stub (Quarter A4)
export const Template7_ReceiptStub: React.FC<WaybillProps> = ({ order, companyName, companyPhone, terms }) => {
  const d = getOrderData(order);
  return (
    <div className="bg-white text-black p-2.5 border border-gray-400 w-full max-w-[395px] mx-auto text-right text-xs box-border flex flex-col justify-between h-full min-h-[480px] overflow-hidden leading-normal select-none" dir="rtl">
      <div>
        <div className="flex justify-between items-center border-b pb-1 mb-1 font-bold">
          <div><span className="text-sm font-black">{companyName}</span> <span className="font-mono text-xs">({companyPhone})</span></div>
          <div className="text-center"><Barcode value={d.orderNumber} height={22} width={1} /><span className="font-mono text-xs">#{d.orderNumber}</span></div>
        </div>
        <div className="text-xs space-y-0.5 mb-1 bg-gray-50 p-1.5 rounded border border-gray-200">
          <div className="flex justify-between"><div>العميل: <strong>{d.customerName}</strong> ({d.phone1})</div><strong className="text-blue-900">{d.gov}</strong></div>
          <div>العنوان: {d.address}</div>
        </div>
        <div className="border border-gray-200 p-1 rounded text-xs">
          <div className="font-bold border-b pb-0.5 mb-0.5 flex justify-between"><span>المنتجات:</span><span>الشحن: {d.shipping} ج.م</span></div>
          {d.products.map((p, i) => (<div key={i} className="flex justify-between text-xs py-0.2"><span>{p.qty}x {p.name} ({p.price})</span><span className="font-mono font-bold">{p.lineTotal}</span></div>))}
        </div>
      </div>
      <div>
        <div className="border-b-2 border-dashed border-red-500 relative my-2 text-center"><span className="bg-white text-red-600 px-2 text-[8.5px] font-bold absolute -top-2 left-1/2 -translate-x-1/2">✂️ قص هنا - إيصال استلام للعميل</span></div>
        <div className="bg-gray-50 p-1.5 border border-gray-200 rounded text-xs space-y-1">
          <div className="flex justify-between items-center font-bold"><span>وصل استلام العميل #{d.orderNumber}</span><span className="text-blue-900 font-black text-sm font-mono">الصافي: {d.total.toLocaleString()} ج.م</span></div>
          <div className="text-[9.5px]">ملاحظات: {d.notes || '—'}</div>
          <div className="flex justify-between text-[8.5px] text-gray-600 border-t pt-0.5"><span>الموظف: {d.employee} | {d.page}</span><span>{terms || 'المعاينة حق للعميل'}</span></div>
        </div>
      </div>
    </div>
  );
};

// TEMPLATE 8: Grid Dashboard (Quarter A4)
export const Template8_GridDashboard: React.FC<WaybillProps> = ({ order, companyName, companyPhone, terms }) => {
  const d = getOrderData(order);
  return (
    <div className="bg-white text-slate-900 p-2.5 w-full max-w-[395px] mx-auto text-right text-xs grid grid-cols-2 gap-1.5 font-sans border-2 border-slate-800 box-border h-full min-h-[480px] overflow-hidden leading-normal select-none" dir="rtl">
      <div className="border border-slate-800 p-1.5 rounded"><div className="text-[9px] font-bold text-slate-500">الشركة</div><div className="font-black text-xs truncate">{companyName}</div><div className="font-mono text-[10px]">{companyPhone}</div></div>
      <div className="border border-slate-800 p-1.5 rounded flex justify-between items-center"><div><div className="text-[9px] font-bold text-slate-500">البوليصة</div><div className="font-mono font-black text-xs">#{d.orderNumber}</div></div><Barcode value={d.orderNumber} height={24} width={1.1} /></div>
      <div className="border border-slate-800 p-1.5 rounded"><div className="text-[9px] font-bold text-slate-500">العميل</div><div className="font-bold truncate">{d.customerName}</div><div className="font-mono text-[10px]">{d.phone1}</div></div>
      <div className="border border-slate-800 p-1.5 rounded"><div className="text-[9px] font-bold text-slate-500">الوجهة</div><div className="font-black text-blue-800">{d.gov}</div><div className="truncate text-[10px]">{d.address}</div></div>
      <div className="col-span-2 border border-slate-800 p-1.5 rounded"><div className="font-bold mb-0.5 border-b pb-0.5 text-xs flex justify-between"><span>المنتجات:</span><span>شحن: {d.shipping} ج.م</span></div>{d.products.map((p, i) => (<div key={i} className="flex justify-between text-xs py-0.2"><span>{p.qty}x {p.name} ({p.price})</span><span className="font-mono font-bold">{p.lineTotal} ج.م</span></div>))}</div>
      <div className="col-span-2 border border-slate-800 p-1 rounded text-[10px]"><strong>ملاحظات: </strong>{d.notes || 'لا يوجد'}</div>
      <div className="col-span-2 bg-slate-900 text-white p-2 rounded flex justify-between items-center text-xs font-black"><span>المطلوب تحصيله:</span><span className="font-mono text-emerald-400 text-base">{d.total.toLocaleString()} ج.م</span></div>
      <div className="col-span-2 flex justify-between text-[8.5px] text-gray-500"><span>الموظف: {d.employee} | {d.page}</span><span>{terms || 'المعاينة حق للعميل'}</span></div>
    </div>
  );
};

// TEMPLATE 9: Dual Barcode (Quarter A4)
export const Template9_DualBarcode: React.FC<WaybillProps> = ({ order, companyName, companyPhone, terms }) => {
  const d = getOrderData(order);
  return (
    <div className="bg-white text-black p-2.5 border-2 border-black w-full max-w-[395px] mx-auto text-right text-xs box-border flex flex-col justify-between h-full min-h-[480px] overflow-hidden leading-normal select-none" dir="rtl">
      <div>
        <div className="flex justify-between items-center border-b border-black pb-1.5 mb-2">
          <div><h1 className="font-black text-sm">{companyName}</h1><p className="font-mono text-[10px]">{companyPhone}</p></div>
          <div className="text-center"><Barcode value={d.orderNumber} height={26} width={1.1} /><div className="font-mono font-bold text-[9px]">ORD-{d.orderNumber}</div></div>
        </div>
        <div className="border border-black p-1.5 mb-2 bg-gray-50 text-xs space-y-0.5">
          <div className="flex justify-between"><div><strong>المستلم: </strong>{d.customerName} ({d.phone1})</div><strong className="bg-yellow-200 px-1.5 py-0.2 rounded">{d.gov}</strong></div>
          <div><strong>العنوان: </strong>{d.address}</div>
        </div>
        <div className="border border-black p-1.5 mb-2 text-xs space-y-0.5">
          <div className="font-bold border-b pb-0.5 flex justify-between"><span>المنتجات:</span><span>شحن: {d.shipping} ج.م</span></div>
          {d.products.map((p, i) => (<div key={i} className="flex justify-between py-0.2"><span>{p.qty}x {p.name} ({p.price})</span><span className="font-mono font-bold">{p.lineTotal} ج.م</span></div>))}
        </div>
      </div>
      <div className="space-y-1">
        <div className="text-[10px] bg-gray-50 border p-1 rounded"><strong>ملاحظات: </strong>{d.notes || '—'}</div>
        <div className="flex justify-between items-center border-t-2 border-black pt-1.5">
          <div className="text-center"><Barcode value={`${d.orderNumber}-POD`} height={22} width={1} /><div className="text-[8px] font-mono">DELIVERY CONFIRMATION</div></div>
          <div className="text-right"><div className="text-[10px] text-gray-600">المطلوب تحصيله:</div><div className="text-base font-black font-mono">{d.total.toLocaleString()} ج.م</div></div>
        </div>
        <div className="flex justify-between text-[8.5px] text-gray-500"><span>الموظف: {d.employee} | {d.page}</span><span>{terms || 'المعاينة قبل الاستلام'}</span></div>
      </div>
    </div>
  );
};

// TEMPLATE 10: Formal Tax Invoice (Quarter A4)
export const Template10_FormalTax: React.FC<WaybillProps> = ({ order, companyName, companyPhone, terms }) => {
  const d = getOrderData(order);
  return (
    <div className="bg-white text-black p-2.5 border border-black w-full max-w-[395px] mx-auto text-right text-xs font-sans box-border flex flex-col justify-between h-full min-h-[480px] overflow-hidden leading-normal select-none" dir="rtl">
      <div>
        <div className="flex justify-between items-center border-b border-black pb-1.5 mb-2">
          <div><h1 className="text-sm font-black">{companyName}</h1><p className="text-[9px]">فاتورة وبوليصة تسليم • {companyPhone}</p></div>
          <div className="text-center"><Barcode value={d.orderNumber} height={26} width={1.1} /><span className="font-mono text-xs font-bold">#{d.orderNumber}</span></div>
        </div>
        <div className="grid grid-cols-2 gap-1 border border-gray-300 p-1.5 mb-2 bg-gray-50 text-xs">
          <div><strong>العميل:</strong> {d.customerName}</div><div><strong>الهاتف:</strong> {d.phone1}</div>
          <div className="col-span-2"><strong>العنوان:</strong> <strong className="text-blue-900">{d.gov}</strong> - {d.address}</div>
        </div>
        <table className="w-full border-collapse border border-black text-xs mb-2">
          <thead className="bg-gray-200"><tr><th className="border border-black p-1 text-right">البند</th><th className="border border-black p-1 text-center w-8">كمية</th><th className="border border-black p-1 text-center w-12">سعر</th><th className="border border-black p-1 text-center w-14">إجمالي</th></tr></thead>
          <tbody>{d.products.map((p, i) => (<tr key={i}><td className="border border-black p-1 truncate max-w-[140px]">{p.name}</td><td className="border border-black p-1 text-center font-bold">{p.qty}</td><td className="border border-black p-1 text-center font-mono">{p.price}</td><td className="border border-black p-1 text-center font-mono font-bold">{p.lineTotal}</td></tr>))}</tbody>
        </table>
      </div>
      <div className="space-y-1">
        <div className="border border-black p-1.5 space-y-0.5 font-bold text-xs bg-gray-50 flex justify-between items-center">
          <span>شحن: {d.shipping} ج.م</span>
          <span className="text-sm font-black">الصافي المطلوب: {d.total.toLocaleString()} ج.م</span>
        </div>
        <div className="text-[10px] bg-gray-50 border p-1 rounded"><strong>ملاحظات: </strong>{d.notes || 'لا يوجد'}</div>
        <div className="flex justify-between text-[8.5px] text-gray-500 border-t pt-0.5">
          <span>الموظف: {d.employee} | {d.page}</span>
          <span>{terms || 'تعتبر الفاتورة مستند تسليم رسمي'}</span>
        </div>
      </div>
    </div>
  );
};

// TEMPLATE 11: Minimalist (Quarter A4)
export const Template11_Minimalist: React.FC<WaybillProps> = ({ order, companyName, companyPhone, terms }) => {
  const d = getOrderData(order);
  return (
    <div className="bg-white text-gray-900 p-3 w-full max-w-[395px] mx-auto text-right text-xs font-light border-2 border-gray-900 box-border flex flex-col justify-between h-full min-h-[480px] overflow-hidden leading-normal select-none" dir="rtl">
      <div>
        <div className="flex justify-between items-baseline border-b border-gray-200 pb-2 mb-2">
          <div><span className="text-sm font-bold">{companyName}</span> <span className="font-mono text-xs text-gray-500">({companyPhone})</span></div>
          <div className="text-left"><Barcode value={d.orderNumber} height={24} width={1.1} /><span className="font-mono text-xs text-gray-600">#{d.orderNumber}</span></div>
        </div>
        <div className="mb-2 space-y-0.5">
          <div className="text-sm font-bold text-gray-900">{d.customerName} - {d.phone1}</div>
          <div className="text-gray-800">{d.gov} • {d.address}</div>
        </div>
        <div className="border-t border-b border-gray-100 py-1.5 my-1 text-xs space-y-0.5">
          {d.products.map((p, i) => (<div key={i} className="flex justify-between py-0.5"><span className="font-medium">{p.qty} × {p.name} ({p.price})</span><span className="font-mono font-bold">{p.lineTotal} ج.م</span></div>))}
        </div>
      </div>
      <div className="space-y-1">
        <div className="flex justify-between text-xs font-medium text-gray-600"><span>الشحن: {d.shipping} ج.م</span><span>المجموع: {d.subtotal} ج.م</span></div>
        <div className="flex justify-between text-sm font-bold pt-1 border-t border-gray-200"><span>المطلوب تحصيله</span><span className="font-mono text-base font-black">{d.total.toLocaleString()} ج.م</span></div>
        <div className="text-[10px] text-gray-600">ملاحظات: {d.notes || '—'}</div>
        <div className="flex justify-between text-[8.5px] text-gray-500 border-t pt-0.5"><span>الموظف: {d.employee} | {d.page}</span><span>{terms || 'المعاينة حق للعميل'}</span></div>
      </div>
    </div>
  );
};

// TEMPLATE 12: Box Label (Quarter A4)
export const Template12_BoxLabel: React.FC<WaybillProps> = ({ order, companyName, companyPhone, terms }) => {
  const d = getOrderData(order);
  return (
    <div className="bg-white text-black p-2.5 border-2 border-dashed border-black w-full max-w-[395px] mx-auto text-right text-xs box-border flex flex-col justify-between h-full min-h-[480px] overflow-hidden leading-normal select-none" dir="rtl">
      <div>
        <div className="flex justify-between items-center bg-black text-white p-1.5 mb-2 text-xs">
          <span className="font-black">{companyName} PARCEL</span>
          <span className="text-[10px]">⚠️ قابل للكسر 📦</span>
        </div>
        <div className="flex justify-between items-center mb-1">
          <div className="text-[10px]">{companyPhone}</div>
          <div className="text-center"><Barcode value={d.orderNumber} height={24} width={1.1} /><span className="font-mono font-bold text-xs">#{d.orderNumber}</span></div>
        </div>
        <div className="border-2 border-black p-2 mb-2 text-xs space-y-1">
          <div className="text-[10px] text-gray-500 font-bold">إلى المستلم:</div>
          <div className="text-xl font-black text-blue-900">{d.gov}</div>
          <div className="font-bold text-sm">{d.customerName} - {d.phone1}</div>
          <div className="text-gray-700 leading-tight">{d.address}</div>
        </div>
        <div className="border border-black p-1 rounded text-xs space-y-0.5 mb-1">
          {d.products.map((p, i) => (<div key={i} className="flex justify-between"><span>{p.qty}x {p.name}</span><span className="font-mono">{p.lineTotal}</span></div>))}
        </div>
      </div>
      <div className="space-y-1">
        <div className="flex justify-between items-center bg-gray-100 p-2 border-2 border-black font-black text-sm">
          <span>شحن: {d.shipping} | المطلوب:</span><span className="text-base font-mono">{d.total.toLocaleString()} EGP</span>
        </div>
        <div className="text-[10px] truncate">ملاحظات: {d.notes || '—'}</div>
        <div className="flex justify-between text-[8.5px] text-gray-600"><span>الموظف: {d.employee} | {d.page}</span><span>{terms || 'المعاينة قبل الاستلام'}</span></div>
      </div>
    </div>
  );
};

// TEMPLATE 13: Dark Header (Quarter A4)
export const Template13_DarkHeader: React.FC<WaybillProps> = ({ order, companyName, companyPhone, terms }) => {
  const d = getOrderData(order);
  return (
    <div className="bg-white text-slate-900 rounded border border-slate-300 w-full max-w-[395px] mx-auto text-right text-xs box-border flex flex-col justify-between h-full min-h-[480px] overflow-hidden leading-normal select-none" dir="rtl">
      <div>
        <div className="bg-slate-900 text-white p-2 flex justify-between items-center">
          <div><h1 className="text-sm font-black">{companyName}</h1><p className="text-[9px] text-slate-400 font-mono">{companyPhone}</p></div>
          <div className="text-left flex flex-col items-end">
            <div className="text-[9px] text-amber-400 font-bold">بوليصة #{d.orderNumber}</div>
            <Barcode value={d.orderNumber} height={24} width={1.1} />
          </div>
        </div>
        <div className="p-2 space-y-1.5">
          <div className="bg-slate-50 p-2 rounded border border-slate-200 text-xs space-y-1">
            <div className="flex justify-between items-center"><strong>العميل: {d.customerName}</strong><strong className="text-blue-700">{d.gov}</strong></div>
            <div>الهاتف: <span className="font-mono">{d.phone1} {d.phone2 ? `/ ${d.phone2}` : ''}</span></div>
            <div>العنوان: {d.address}</div>
          </div>
          <div className="border rounded p-1.5 text-xs space-y-1">
            <div className="font-bold border-b pb-0.5 flex justify-between"><span>المنتجات:</span><span>شحن: {d.shipping} ج.م</span></div>
            {d.products.map((p, i) => (<div key={i} className="flex justify-between py-0.2"><span>{p.qty}x {p.name} ({p.price})</span><span className="font-mono font-bold">{p.lineTotal} ج.م</span></div>))}
          </div>
        </div>
      </div>
      <div className="p-2 pt-0 space-y-1">
        <div className="flex justify-between items-center bg-amber-50 border border-amber-300 p-2 rounded font-black text-xs text-amber-950">
          <span>المطلوب تحصيله:</span><span className="text-base font-mono">{d.total.toLocaleString()} ج.م</span>
        </div>
        <div className="text-[10px] bg-slate-50 p-1 rounded border">ملاحظات: {d.notes || '—'}</div>
        <div className="flex justify-between text-[8.5px] text-slate-500"><span>الموظف: {d.employee} | {d.page}</span><span>{terms || 'المعاينة حق للعميل'}</span></div>
      </div>
    </div>
  );
};

// TEMPLATE 14: Split Card (Quarter A4)
export const Template14_LandscapeSplit: React.FC<WaybillProps> = ({ order, companyName, companyPhone, terms }) => {
  const d = getOrderData(order);
  return (
    <div className="bg-white text-black p-2.5 border-2 border-black w-full max-w-[395px] mx-auto text-right text-xs grid grid-cols-2 gap-2 box-border h-full min-h-[480px] overflow-hidden leading-normal select-none" dir="rtl">
      <div className="border-l border-black pl-1.5 space-y-1 text-xs flex flex-col justify-between">
        <div>
          <div className="font-black text-sm border-b pb-1 mb-1 truncate">{companyName}</div>
          <div className="text-[10px] text-gray-600 mb-1">{companyPhone}</div>
          <div><strong>العميل:</strong> {d.customerName}</div>
          <div><strong>الهاتف:</strong> {d.phone1}</div>
          <div><strong>المحافظة:</strong> <span className="font-bold underline">{d.gov}</span></div>
          <div className="leading-tight mt-1"><strong>العنوان:</strong> {d.address}</div>
        </div>
        <div className="space-y-0.5 text-[9px] border-t pt-1">
          <div><strong>الموظف:</strong> {d.employee}</div>
          <div><strong>البيدج:</strong> {d.page}</div>
        </div>
      </div>
      <div className="flex flex-col justify-between text-xs">
        <div>
          <div className="flex justify-between items-center mb-1.5"><Barcode value={d.orderNumber} height={24} width={1.1} /><span className="font-mono font-bold">#{d.orderNumber}</span></div>
          <div className="border-t border-b py-1 mb-1 space-y-0.5">
            <div className="font-bold text-[10px] flex justify-between"><span>المنتجات:</span><span>شحن: {d.shipping}</span></div>
            {d.products.map((p, i) => (<div key={i} className="flex justify-between py-0.2"><span>{p.qty}x {p.name}</span><span>{p.lineTotal}</span></div>))}
          </div>
          {d.notes && <div className="text-[9.5px] text-red-700 font-bold mb-1">ملاحظة: {d.notes}</div>}
        </div>
        <div className="space-y-1">
          <div className="bg-black text-white p-1.5 flex justify-between items-center font-black text-xs rounded">
            <span>المطلوب:</span><span className="font-mono text-base">{d.total.toLocaleString()} ج.م</span>
          </div>
          <div className="text-[8px] text-gray-500 text-center">{terms || 'المعاينة قبل الاستلام'}</div>
        </div>
      </div>
    </div>
  );
};

// TEMPLATE 15: Packing Slip (Quarter A4)
export const Template15_PackingSlip: React.FC<WaybillProps> = ({ order, companyName, companyPhone, terms }) => {
  const d = getOrderData(order);
  return (
    <div className="bg-white text-black p-2.5 border border-black w-full max-w-[395px] mx-auto text-right text-xs box-border flex flex-col justify-between h-full min-h-[480px] overflow-hidden leading-normal select-none" dir="rtl">
      <div>
        <div className="flex justify-between items-center border-b border-black pb-1.5 mb-2">
          <div><span className="font-black text-sm">{companyName}</span><p className="text-[10px]">{companyPhone}</p></div>
          <div className="text-center"><Barcode value={d.orderNumber} height={24} width={1.1} /><span className="font-mono font-bold text-xs">#{d.orderNumber}</span></div>
        </div>
        <div className="text-xs mb-2 bg-gray-50 p-1.5 rounded space-y-0.5">
          <div className="flex justify-between"><span><strong>العميل:</strong> {d.customerName} ({d.phone1})</span><strong>{d.gov}</strong></div>
          <div><strong>العنوان:</strong> {d.address}</div>
        </div>
        <table className="w-full border border-black mb-2 text-xs">
          <thead className="bg-gray-100"><tr><th className="border p-1 w-8 text-center">فحص</th><th className="border p-1 text-right">الصنف</th><th className="border p-1 text-center w-10">العدد</th><th className="border p-1 text-center w-12">السعر</th></tr></thead>
          <tbody>{d.products.map((p, i) => (<tr key={i}><td className="border p-1 text-center">⬜</td><td className="border p-1 font-bold truncate max-w-[150px]">{p.name}</td><td className="border p-1 text-center font-bold">{p.qty}</td><td className="border p-1 text-center font-mono">{p.lineTotal}</td></tr>))}</tbody>
        </table>
      </div>
      <div className="space-y-1">
        <div className="flex justify-between items-center bg-gray-100 p-1.5 font-black text-xs rounded">
          <span>شحن: {d.shipping} | المطلوب:</span>
          <span className="font-mono text-sm">{d.total.toLocaleString()} ج.م</span>
        </div>
        <div className="text-[10px] bg-gray-50 p-1 rounded border">ملاحظات: {d.notes || '—'}</div>
        <div className="flex justify-between text-[8.5px] text-gray-600"><span>الموظف: {d.employee} | {d.page}</span><span>{terms || 'المعاينة حق للعميل'}</span></div>
      </div>
    </div>
  );
};

// TEMPLATE 16: Geometric (Quarter A4)
export const Template16_Geometric: React.FC<WaybillProps> = ({ order, companyName, companyPhone, terms }) => {
  const d = getOrderData(order);
  return (
    <div className="bg-white text-slate-900 p-2.5 border-t-4 border-indigo-600 border-x border-b w-full max-w-[395px] mx-auto text-right text-xs box-border flex flex-col justify-between h-full min-h-[480px] overflow-hidden leading-normal select-none" dir="rtl">
      <div>
        <div className="flex justify-between items-center pb-1.5 border-b mb-2">
          <div><span className="font-black text-sm text-indigo-700">{companyName}</span><p className="text-[10px] text-gray-500">{companyPhone}</p></div>
          <div className="text-center"><Barcode value={d.orderNumber} height={24} width={1.1} /><span className="font-mono bg-indigo-50 text-indigo-900 px-1.5 py-0.2 font-black text-[10px]">#{d.orderNumber}</span></div>
        </div>
        <div className="bg-indigo-50/50 p-2 rounded mb-2 text-xs space-y-1">
          <div className="flex justify-between"><div><strong>المستلم:</strong> {d.customerName}</div><strong>{d.phone1}</strong></div>
          <div><strong>المحافظة والعنوان:</strong> <strong className="text-indigo-900">{d.gov}</strong> - {d.address}</div>
        </div>
        <div className="border-t border-b py-1.5 mb-2 text-xs space-y-1">
          <div className="font-bold text-[10px] flex justify-between"><span>المنتجات:</span><span>شحن: {d.shipping} ج.م</span></div>
          {d.products.map((p, i) => (<div key={i} className="flex justify-between py-0.2"><span>{p.qty}x {p.name} ({p.price})</span><span className="font-mono font-bold">{p.lineTotal} ج.م</span></div>))}
        </div>
      </div>
      <div className="space-y-1">
        <div className="bg-indigo-600 text-white p-2 rounded flex justify-between items-center text-xs font-black"><span>إجمالي التحصيل:</span><span className="font-mono text-base">{d.total.toLocaleString()} ج.م</span></div>
        <div className="text-[10px] bg-slate-50 p-1 rounded border">ملاحظات: {d.notes || '—'}</div>
        <div className="flex justify-between text-[8.5px] text-gray-500"><span>الموظف: {d.employee} | {d.page}</span><span>{terms || 'المعاينة حق للعميل'}</span></div>
      </div>
    </div>
  );
};

// TEMPLATE 17: COD Bold (Quarter A4)
export const Template17_CODBold: React.FC<WaybillProps> = ({ order, companyName, companyPhone, terms }) => {
  const d = getOrderData(order);
  return (
    <div className="bg-white text-black p-2.5 border-2 border-red-600 w-full max-w-[395px] mx-auto text-right text-xs box-border flex flex-col justify-between h-full min-h-[480px] overflow-hidden leading-normal select-none" dir="rtl">
      <div>
        <div className="bg-red-600 text-white p-1 text-center font-black text-xs mb-1.5 rounded">تحصيل كاش عند الاستلام (C.O.D) • {companyName}</div>
        <div className="flex justify-between items-start mb-2 bg-gray-50 p-1.5 border rounded">
          <div className="space-y-0.5">
            <div className="text-sm font-black text-blue-950">{d.customerName}</div>
            <div className="font-mono font-bold">{d.phone1}</div>
            <div className="text-xs font-bold text-red-700">{d.gov} - {d.address}</div>
          </div>
          <div className="text-center"><Barcode value={d.orderNumber} height={26} width={1.1} /><div className="font-mono font-black text-xs">#{d.orderNumber}</div></div>
        </div>
        <div className="border p-1 rounded text-xs space-y-0.5 mb-1">
          <div className="font-bold border-b pb-0.5 flex justify-between"><span>الأصناف:</span><span>شحن: {d.shipping} ج.م</span></div>
          {d.products.map((p, i) => (<div key={i} className="flex justify-between"><span>{p.qty}x {p.name}</span><span className="font-mono font-bold">{p.lineTotal}</span></div>))}
        </div>
      </div>
      <div className="space-y-1">
        <div className="border-2 border-black p-1.5 text-center bg-yellow-300 rounded">
          <div className="text-[9px] font-black text-black">المبلغ الإجباري للتحصيل من العميل:</div>
          <div className="text-xl font-black font-mono text-black">{d.total.toLocaleString()} ج.م</div>
        </div>
        <div className="text-[9.5px] bg-red-50 p-1 border border-red-200 rounded text-red-900">ملاحظات: {d.notes || '—'}</div>
        <div className="flex justify-between text-[8.5px] text-gray-600"><span>الموظف: {d.employee} | {d.page}</span><span>{terms || 'المعاينة قبل الاستلام'}</span></div>
      </div>
    </div>
  );
};

// TEMPLATE 18: Segmented (Quarter A4)
export const Template18_Segmented: React.FC<WaybillProps> = ({ order, companyName, companyPhone, terms }) => {
  const d = getOrderData(order);
  return (
    <div className="bg-white text-gray-800 p-2.5 border border-gray-300 w-full max-w-[395px] mx-auto text-right text-xs space-y-1.5 box-border flex flex-col justify-between h-full min-h-[480px] overflow-hidden leading-normal select-none" dir="rtl">
      <div>
        <div className="flex justify-between items-center border-b pb-1 mb-1.5">
          <div><h2 className="font-black text-sm">{companyName}</h2><p className="text-[9px] text-gray-500">{companyPhone}</p></div>
          <div className="text-center"><Barcode value={d.orderNumber} height={22} width={1} /><span className="font-mono font-bold bg-gray-100 px-1.5 py-0.2 text-[10px]">#{d.orderNumber}</span></div>
        </div>
        <div className="border border-gray-200 p-1.5 rounded text-xs mb-1 space-y-0.5">
          <div className="font-bold text-blue-800">١. بيانات المستلم:</div>
          <div>{d.customerName} ({d.phone1})</div>
          <div><strong className="text-blue-900">{d.gov}</strong> - {d.address}</div>
        </div>
        <div className="border border-gray-200 p-1.5 rounded text-xs space-y-0.5">
          <div className="font-bold text-blue-800 flex justify-between"><span>٢. محتويات الطلب:</span><span>الشحن: {d.shipping} ج.م</span></div>
          {d.products.map((p, i) => (<div key={i} className="flex justify-between py-0.2"><span>{p.qty} × {p.name} ({p.price})</span><span className="font-mono font-bold">{p.lineTotal} ج.م</span></div>))}
        </div>
      </div>
      <div className="space-y-1">
        <div className="border border-gray-200 p-1.5 rounded flex justify-between items-center font-bold bg-gray-50 text-xs">
          <span className="text-blue-800">٣. المطلوب:</span><span className="text-sm font-black font-mono">{d.total.toLocaleString()} ج.م</span>
        </div>
        <div className="text-[10px] bg-gray-50 p-1 rounded border"><strong>ملاحظات:</strong> {d.notes || '—'}</div>
        <div className="flex justify-between text-[8.5px] text-gray-500"><span>الموظف: {d.employee} | {d.page}</span><span>{terms || 'المعاينة حق للعميل'}</span></div>
      </div>
    </div>
  );
};

// TEMPLATE 19: Freight Tag (Quarter A4)
export const Template19_FreightTag: React.FC<WaybillProps> = ({ order, companyName, companyPhone, terms }) => {
  const d = getOrderData(order);
  return (
    <div className="bg-white text-black p-2.5 border-2 border-black w-full max-w-[395px] mx-auto text-right text-xs font-mono box-border flex flex-col justify-between h-full min-h-[480px] overflow-hidden leading-normal select-none" dir="rtl">
      <div>
        <div className="flex justify-between items-center border-b border-black pb-1.5 mb-2 font-black text-sm">
          <span>{companyName} FREIGHT</span>
          <span>HUB: {d.gov}</span>
        </div>
        <div className="grid grid-cols-2 gap-2 border-b border-black pb-2 mb-2 text-xs">
          <div className="space-y-0.5"><div className="font-black text-sm truncate">{d.customerName}</div><div>{d.phone1}</div><div className="leading-tight">{d.address}</div></div>
          <div className="text-center border-r border-black pr-2"><Barcode value={d.orderNumber} height={28} width={1.1} /><div className="font-black text-xs mt-0.5">#{d.orderNumber}</div></div>
        </div>
        <div className="border border-black p-1 mb-1 text-xs">
          <div className="font-bold flex justify-between border-b pb-0.5"><span>MANIFEST:</span><span>SHIPPING: {d.shipping}</span></div>
          {d.products.map((p, i) => (<div key={i} className="flex justify-between py-0.2"><span>{p.qty}x {p.name}</span><span>{p.lineTotal}</span></div>))}
        </div>
      </div>
      <div className="space-y-1 font-sans">
        <div className="flex justify-between items-center bg-black text-white p-2 font-black text-xs rounded">
          <span>TOTAL CHARGES:</span><span className="text-base font-mono">{d.total.toLocaleString()} EGP</span>
        </div>
        <div className="text-[10px] truncate">NOTES: {d.notes || '—'}</div>
        <div className="flex justify-between text-[8.5px] text-gray-500"><span>AGENT: {d.employee} | {d.page}</span><span>{terms || 'INSPECTION ALLOWED'}</span></div>
      </div>
    </div>
  );
};

// TEMPLATE 20: Secure Stamp (Quarter A4)
export const Template20_SecureStamp: React.FC<WaybillProps> = ({ order, companyName, companyPhone, terms }) => {
  const d = getOrderData(order);
  return (
    <div className="bg-white text-black p-2.5 border-2 border-black w-full max-w-[395px] mx-auto text-right text-xs box-border flex flex-col justify-between h-full min-h-[480px] overflow-hidden leading-normal select-none" dir="rtl">
      <div>
        <div className="flex justify-between items-center border-b border-black pb-1.5 mb-2">
          <div><h1 className="font-black text-sm">{companyName}</h1><p className="text-[10px] text-gray-600">{companyPhone}</p></div>
          <div className="text-center font-mono"><Barcode value={d.orderNumber} height={26} width={1.1} /><div className="font-bold text-[10px]">#{d.orderNumber}</div></div>
        </div>
        <div className="border border-black p-2 bg-gray-50 mb-2 text-xs space-y-0.5">
          <div className="flex justify-between"><div><strong>العميل:</strong> {d.customerName} ({d.phone1})</div><strong className="text-blue-900">{d.gov}</strong></div>
          <div><strong>العنوان:</strong> {d.address}</div>
        </div>
        <div className="border border-black p-1.5 mb-2 text-xs space-y-0.5">
          <div className="font-bold border-b pb-0.5 flex justify-between"><span>المنتجات:</span><span>شحن: {d.shipping} ج.م</span></div>
          {d.products.map((p, i) => (<div key={i} className="flex justify-between py-0.2 font-bold"><span>{p.qty}x {p.name} ({p.price})</span><span>{p.lineTotal} ج.م</span></div>))}
        </div>
      </div>
      <div className="space-y-1">
        <div className="flex justify-between items-center bg-gray-100 border border-black p-1.5 font-black text-xs">
          <span>المبلغ الإجمالي المطلوب:</span><span className="text-sm font-mono">{d.total.toLocaleString()} ج.م</span>
        </div>
        <div className="text-[10px] bg-gray-50 p-1 border rounded">ملاحظات: {d.notes || 'لا توجد'}</div>
        <div className="grid grid-cols-2 gap-2 border-t border-gray-300 pt-1 text-[8.5px]">
          <div><div>الموظف: {d.employee} | {d.page}</div><div>{terms || 'مستند تسليم رسمي'}</div></div>
          <div className="border border-dashed border-black text-center h-8 flex items-center justify-center font-bold text-gray-400">ختم وتوقيع</div>
        </div>
      </div>
    </div>
  );
};

// TEMPLATE 21: Suits Boutique Invoice (Quarter A4)
export const Template21_SuitsBoutique: React.FC<WaybillProps> = ({ order, companyName, companyPhone, companyAddress, companyLogo, terms }) => {
  const d = getOrderData(order);
  const brandName = companyName || 'Suits';
  const brandPhone = companyPhone || '01107317579';

  return (
    <div className="bg-[#fefdfd] text-[#2c1e23] p-2.5 md:p-3 border-2 border-[#eed8dc] rounded-sm w-full max-w-[395px] mx-auto text-right font-sans box-border flex flex-col justify-between h-full min-h-[480px] overflow-hidden text-xs leading-normal select-none relative" dir="rtl">
      {/* Top Header Section */}
      <div>
        <div className="flex justify-between items-start border-b border-[#eed8dc] pb-2 mb-2" style={{ direction: 'ltr' }}>
          {/* Hanging Ribbon Badge (Left) */}
          <div className="w-22 bg-[#1a2638] text-white p-1.5 pb-2.5 rounded-b-lg shadow-sm text-center flex flex-col items-center justify-center flex-shrink-0 -mt-3 ml-1">
            {companyLogo ? (
              <img src={companyLogo} alt="Logo" className="h-8 max-w-full object-contain mb-0.5" />
            ) : (
              <div className="w-7 h-7 rounded-full border border-amber-300/40 flex items-center justify-center font-serif font-black text-sm text-amber-200 mb-0.5">S</div>
            )}
            <span className="font-serif font-black tracking-widest text-[10px] uppercase">{brandName}</span>
            <span className="text-[6.5px] text-slate-300 uppercase tracking-tight">trendy clothing</span>
          </div>

          {/* Center Title & Barcode */}
          <div className="flex-1 text-center flex flex-col items-center justify-center px-1" style={{ direction: 'rtl' }}>
            <div className="text-[10px] text-[#914d61] font-bold">🌿 𐂂 🌿</div>
            <h1 className="font-serif font-black text-base text-[#2c1e23] -mt-0.5 mb-1 tracking-tight">فاتورة بيع</h1>
            <div className="border border-[#eed8dc] bg-white px-2.5 py-1 rounded-md flex flex-col items-center justify-center shadow-2xs">
              <Barcode value={d.orderNumber} height={28} width={1.2} />
              <span className="font-mono font-black text-[10px] tracking-wider text-slate-800">#{d.orderNumber}</span>
            </div>
          </div>

          {/* Top Right Company Info & Date */}
          <div className="w-28 text-right space-y-1 flex-shrink-0" style={{ direction: 'rtl' }}>
            <div className="flex items-center gap-1.5 text-xs">
              <span className="w-5 h-5 rounded-full bg-[#f6ebed] text-[#914d61] flex items-center justify-center text-[10px] flex-shrink-0">📞</span>
              <div className="truncate">
                <div className="font-bold text-[11px] truncate">{brandName}</div>
                <div className="font-mono text-[9px] text-slate-600 truncate">{brandPhone}</div>
              </div>
            </div>
            <div className="border-t border-dotted border-[#eed8dc] pt-1 flex items-center gap-1.5 text-xs">
              <span className="w-5 h-5 rounded-full bg-[#f6ebed] text-[#914d61] flex items-center justify-center text-[10px] flex-shrink-0">📅</span>
              <div>
                <div className="text-[9px] text-slate-500">التاريخ</div>
                <div className="font-mono font-bold text-[10px]">{d.date}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Customer & Address Card */}
        <div className="border border-[#eed8dc] bg-[#fbf5f6] p-2 rounded-lg mb-2 text-[#2c1e23] space-y-1.5 shadow-2xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="w-5 h-5 rounded-full bg-white text-[#914d61] border border-[#eed8dc] flex items-center justify-center text-[10px] shadow-2xs">👤</span>
              <div>
                <strong className="text-[12px] text-[#914d61] font-black">{d.customerName}</strong>
                <span className="font-mono text-[10px] text-slate-700 font-bold mr-2">📞 {d.phone1} {d.phone2 ? ` / ${d.phone2}` : ''}</span>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-5 h-5 rounded-full bg-white text-[#914d61] border border-[#eed8dc] flex items-center justify-center text-[10px]">📍</span>
              <strong className="text-[11px] font-black text-[#914d61] bg-white px-2.5 py-0.5 rounded border border-[#eed8dc] shadow-2xs">{d.gov}</strong>
            </div>
          </div>

          <div className="flex items-start gap-1.5 border-t border-dotted border-[#eed8dc] pt-1.5 text-[10.5px]">
            <span className="w-4 h-4 rounded-full bg-white text-[#914d61] border border-[#eed8dc] flex items-center justify-center text-[9px] flex-shrink-0 mt-0.5">📄</span>
            <div className="text-slate-800 leading-snug">
              <strong className="text-[#914d61] ml-1">العنوان:</strong>
              <span className="font-semibold">{d.address}</span>
            </div>
          </div>
        </div>

        {/* Product Table with Mauve Header */}
        <div className="rounded-lg border border-[#eed8dc] overflow-hidden mb-2 shadow-2xs">
          <table className="w-full text-[10px]">
            <thead className="bg-[#914d61] text-white">
              <tr>
                <th className="p-1.5 text-right font-bold">المنتج</th>
                <th className="p-1.5 text-center font-bold w-12">المقاس</th>
                <th className="p-1.5 text-center font-bold w-14">السعر</th>
                <th className="p-1.5 text-center font-bold w-9">الكمية</th>
                <th className="p-1.5 text-center font-bold w-16">الإجمالي</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f6ebed] bg-white">
              {d.products.map((p, i) => (
                <tr key={i} className="hover:bg-[#fbf5f6]">
                  <td className="p-1.5 font-bold text-slate-800 truncate max-w-[140px]">
                    {p.name} {p.variant && <span className="text-[9px] text-[#914d61] bg-[#fbf5f6] px-1.5 py-0.5 rounded font-normal mr-1">({p.variant})</span>}
                  </td>
                  <td className="p-1.5 text-center font-mono font-bold text-slate-700">{p.variant?.split('-')?.[1] || '-'}</td>
                  <td className="p-1.5 text-center font-mono font-medium">{p.price} ج.م</td>
                  <td className="p-1.5 text-center font-mono font-bold text-slate-900">{p.qty}</td>
                  <td className="p-1.5 text-center font-mono font-bold text-[#914d61]">{p.lineTotal} ج.م</td>
                </tr>
              ))}
              {d.products.length > 4 && (
                <tr><td colSpan={5} className="p-1 text-center text-[9px] font-bold text-slate-500 bg-gray-50">+ {d.products.length - 4} منتجات أخرى</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Middle Totals & Notes Section */}
      <div className="space-y-1.5">
        <div className="grid grid-cols-12 gap-1.5">
          {/* Left: Totals Card */}
          <div className="col-span-6 border border-[#eed8dc] bg-[#fbf5f6] p-1.5 rounded-lg text-[9.5px] space-y-1 flex flex-col justify-between">
            <div className="flex justify-between items-center text-slate-700">
              <span className="flex items-center gap-1">🛍️ <span>إجمالي المنتجات:</span></span>
              <span className="font-mono font-bold">{d.subtotal} ج.م</span>
            </div>
            <div className="flex justify-between items-center text-slate-700 border-t border-dotted border-[#eed8dc] pt-0.5">
              <span className="flex items-center gap-1">🚚 <span>مصاريف الشحن:</span></span>
              <span className="font-mono font-bold">{d.shipping} ج.م</span>
            </div>
            <div className="bg-[#914d61] text-white p-1.5 rounded-md flex justify-between items-center font-black text-[10px] mt-0.5 shadow-2xs">
              <span className="flex items-center gap-1">💳 <span>الإجمالي المطلوب:</span></span>
              <span className="font-mono text-sm font-black">{d.total.toLocaleString()} ج.م</span>
            </div>
          </div>

          {/* Right: Notes Card */}
          <div className="col-span-6 border border-[#eed8dc] bg-white p-1.5 rounded-lg text-[9px] flex flex-col justify-between">
            <div className="font-bold text-[#914d61] mb-1">ملاحظات:</div>
            <div className="text-[8.5px] text-slate-700 leading-tight border-b border-dotted border-[#eed8dc] pb-1 min-h-[18px]">
              {d.notes || '— لا توجد ملاحظات خاصة'}
            </div>
            <div className="border-b border-dotted border-[#eed8dc] my-0.5"></div>
            <div className="border-b border-dotted border-[#eed8dc] my-0.5"></div>
          </div>
        </div>

        {/* Vendor & Employee Row */}
        <div className="grid grid-cols-2 gap-1.5 border border-[#eed8dc] bg-white p-1.5 rounded-lg text-[9px]">
          <div className="flex items-center gap-1.5">
            <span className="w-4 h-4 rounded-full bg-[#fbf5f6] text-[#914d61] flex items-center justify-center text-[8px]">🛍️</span>
            <span>البائع: <strong className="text-slate-900">{d.page || brandName}</strong></span>
          </div>
          <div className="flex items-center gap-1.5 border-r border-[#eed8dc] pr-1.5">
            <span className="w-4 h-4 rounded-full bg-[#fbf5f6] text-[#914d61] flex items-center justify-center text-[8px]">👤</span>
            <span>الموظف: <strong className="text-slate-900">{d.employee || 'Admin'}</strong></span>
          </div>
        </div>

        {/* Company Policy Box */}
        <div className="border border-[#eed8dc] bg-[#fbf5f6] p-1.5 rounded-lg text-[8px] text-slate-600 leading-tight">
          <div className="text-center font-bold text-[#914d61] mb-0.5">🌿 سياسة الشركة 🌿</div>
          <p className="text-center">{terms || 'برجاء المعاينة والمراجعة والقياس عند الاستلام. المعاينة حق للعميل لضمان عدم حدوث أي أخطاء في المقاسات أو الألوان.'}</p>
        </div>

        {/* Footer Banner */}
        <div className="bg-[#914d61] text-white rounded-md p-1.5 flex justify-between items-center text-[9px]">
          <div className="flex items-center gap-1">
            <span className="w-4 h-4 rounded-full bg-white/20 flex items-center justify-center text-[8px]">🤍</span>
            <span className="font-bold">شكراً لاختياركم {brandName} — نسعى دائماً لإرضائكم</span>
          </div>
          <div className="bg-[#1a2638] px-2.5 py-0.5 rounded text-[8px] font-mono text-slate-200">
            {brandPhone}
          </div>
        </div>
      </div>
    </div>
  );
};
// ─────────────────────────────────────────────────────────────────────────────
// NEW TEMPLATES 22 TO 50
// ─────────────────────────────────────────────────────────────────────────────

// TEMPLATE 22: Eco Green (Quarter A4)
export const Template22_EcoGreen: React.FC<WaybillProps> = ({ order, companyName, companyPhone, terms }) => {
  const d = getOrderData(order);
  return (
    <div className="bg-emerald-50/30 text-emerald-950 p-2.5 border-2 border-emerald-600 rounded-md w-full max-w-[395px] mx-auto text-right font-sans box-border flex flex-col justify-between h-full min-h-[480px] overflow-hidden text-xs leading-normal select-none" dir="rtl">
      <div>
        <div className="bg-emerald-700 text-white p-2 rounded-t-sm flex justify-between items-center -mx-2.5 -mt-2.5 mb-2">
          <div><h1 className="font-black text-sm">{companyName}</h1><p className="text-[9px] text-emerald-100 font-mono">{companyPhone}</p></div>
          <div className="text-center bg-white text-black p-1 rounded"><Barcode value={d.orderNumber} height={22} width={1} /><span className="font-mono text-[9px] font-bold">#{d.orderNumber}</span></div>
        </div>
        <div className="bg-white p-2 border border-emerald-200 rounded mb-2 space-y-1">
          <div className="flex justify-between items-center"><div><span className="text-emerald-700 font-bold">العميل:</span> <strong className="text-slate-900">{d.customerName}</strong></div><span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded">{d.gov}</span></div>
          <div className="font-mono text-[11px]">📞 {d.phone1} {d.phone2 ? `/ ${d.phone2}` : ''}</div>
          <div className="border-t border-emerald-100 pt-1 text-[11px]"><strong>العنوان:</strong> {d.address}</div>
        </div>
        <table className="w-full text-xs border border-emerald-300 bg-white mb-2">
          <thead className="bg-emerald-100 text-emerald-900"><tr><th className="p-1 text-right">الصنف</th><th className="p-1 text-center w-8">كمية</th><th className="p-1 text-center w-12">السعر</th><th className="p-1 text-center w-14">الإجمالي</th></tr></thead>
          <tbody className="divide-y divide-emerald-100">{d.products.map((p, i) => (<tr key={i}><td className="p-1 font-bold truncate max-w-[140px]">{p.name}</td><td className="p-1 text-center font-bold">{p.qty}</td><td className="p-1 text-center font-mono">{p.price}</td><td className="p-1 text-center font-mono font-bold text-emerald-800">{p.lineTotal}</td></tr>))}</tbody>
        </table>
      </div>
      <div className="space-y-1">
        <div className="bg-emerald-700 text-white p-2 rounded flex justify-between items-center font-black">
          <span>شحن: {d.shipping} ج.م | الصافي:</span><span className="text-base font-mono">{d.total.toLocaleString()} ج.م</span>
        </div>
        <div className="text-[10px] bg-white p-1 rounded border border-emerald-200">ملاحظات: {d.notes || '—'}</div>
        <div className="flex justify-between text-[8.5px] text-emerald-800"><span>الموظف: {d.employee} | {d.page}</span><span>{terms || 'المعاينة حق للعميل'}</span></div>
      </div>
    </div>
  );
};

// TEMPLATE 23: Fast Orange (Quarter A4)
export const Template23_FastOrange: React.FC<WaybillProps> = ({ order, companyName, companyPhone, terms }) => {
  const d = getOrderData(order);
  return (
    <div className="bg-white text-slate-900 p-2.5 border-2 border-orange-500 w-full max-w-[395px] mx-auto text-right text-xs box-border flex flex-col justify-between h-full min-h-[480px] overflow-hidden leading-normal select-none" dir="rtl">
      <div>
        <div className="flex justify-between items-center border-b-2 border-orange-500 pb-1.5 mb-2">
          <div><span className="bg-orange-500 text-white font-black text-sm px-2 py-0.5 rounded">{companyName}</span><p className="text-[10px] text-gray-600 mt-1">{companyPhone}</p></div>
          <div className="text-center"><Barcode value={d.orderNumber} height={26} width={1.1} /><span className="font-mono text-xs font-bold text-orange-600">#{d.orderNumber}</span></div>
        </div>
        <div className="bg-orange-50 p-2 border border-orange-200 rounded mb-2 space-y-0.5">
          <div className="flex justify-between"><div><strong>المستلم:</strong> {d.customerName} ({d.phone1})</div><strong className="text-orange-700 bg-orange-100 px-1.5 rounded">{d.gov}</strong></div>
          <div><strong>العنوان:</strong> {d.address}</div>
        </div>
        <div className="border border-orange-200 p-1.5 rounded mb-2 space-y-0.5">
          <div className="font-bold border-b pb-0.5 flex justify-between text-orange-900"><span>محتويات الشحنة:</span><span>شحن: {d.shipping} ج.م</span></div>
          {d.products.map((p, i) => (<div key={i} className="flex justify-between py-0.2"><span>{p.qty}x {p.name} ({p.price})</span><span className="font-mono font-bold">{p.lineTotal} ج.م</span></div>))}
        </div>
      </div>
      <div className="space-y-1">
        <div className="bg-orange-500 text-white p-2 rounded flex justify-between items-center font-black">
          <span>المطلوب تحصيله:</span><span className="font-mono text-base">{d.total.toLocaleString()} ج.م</span>
        </div>
        <div className="text-[10px] bg-orange-50 p-1 border border-orange-200 rounded">ملاحظات: {d.notes || 'لا يوجد'}</div>
        <div className="flex justify-between text-[8.5px] text-gray-500"><span>الموظف: {d.employee} | {d.page}</span><span>{terms || 'المعاينة حق للعميل'}</span></div>
      </div>
    </div>
  );
};

// TEMPLATE 24: Navy Executive (Quarter A4)
export const Template24_NavyExecutive: React.FC<WaybillProps> = ({ order, companyName, companyPhone, terms }) => {
  const d = getOrderData(order);
  return (
    <div className="bg-slate-50 text-slate-900 p-2.5 border-2 border-slate-900 w-full max-w-[395px] mx-auto text-right text-xs font-sans box-border flex flex-col justify-between h-full min-h-[480px] overflow-hidden leading-normal select-none" dir="rtl">
      <div>
        <div className="bg-slate-900 text-white p-2 flex justify-between items-center -mx-2.5 -mt-2.5 mb-2">
          <div><h1 className="font-black text-sm text-slate-100">{companyName}</h1><p className="text-[9px] text-slate-300 font-mono">{companyPhone}</p></div>
          <div className="bg-white text-black p-1 rounded text-center"><Barcode value={d.orderNumber} height={22} width={1} /><span className="font-mono text-[9px] font-bold">#{d.orderNumber}</span></div>
        </div>
        <div className="bg-white p-2 border border-slate-300 rounded mb-2 space-y-1">
          <div className="flex justify-between"><div><span className="text-slate-500">العميل:</span> <strong className="text-slate-900">{d.customerName}</strong></div><strong className="text-slate-900 bg-slate-200 px-2 py-0.5 rounded">{d.gov}</strong></div>
          <div>📞 <span className="font-mono font-bold">{d.phone1}</span></div>
          <div className="border-t pt-1">العنوان: {d.address}</div>
        </div>
        <table className="w-full text-xs border border-slate-300 bg-white mb-2">
          <thead className="bg-slate-200 text-slate-800"><tr><th className="p-1 text-right">المنتج</th><th className="p-1 text-center w-8">كمية</th><th className="p-1 text-center w-12">سعر</th><th className="p-1 text-center w-14">إجمالي</th></tr></thead>
          <tbody className="divide-y divide-slate-200">{d.products.map((p, i) => (<tr key={i}><td className="p-1 font-bold truncate max-w-[140px]">{p.name}</td><td className="p-1 text-center font-bold">{p.qty}</td><td className="p-1 text-center font-mono">{p.price}</td><td className="p-1 text-center font-mono font-bold">{p.lineTotal}</td></tr>))}</tbody>
        </table>
      </div>
      <div className="space-y-1">
        <div className="bg-slate-900 text-white p-2 rounded flex justify-between items-center font-black">
          <span>شحن: {d.shipping} | المطلوب:</span><span className="text-base font-mono">{d.total.toLocaleString()} ج.م</span>
        </div>
        <div className="text-[10px] bg-white p-1 rounded border">ملاحظات: {d.notes || '—'}</div>
        <div className="flex justify-between text-[8.5px] text-slate-600"><span>الموظف: {d.employee} | {d.page}</span><span>{terms || 'المعاينة حق للعميل'}</span></div>
      </div>
    </div>
  );
};

// TEMPLATE 25: Home Direct (Quarter A4)
export const Template25_HomeDirect: React.FC<WaybillProps> = ({ order, companyName, companyPhone, terms }) => {
  const d = getOrderData(order);
  return (
    <div className="bg-white text-black p-2.5 border-2 border-blue-600 w-full max-w-[395px] mx-auto text-right text-xs box-border flex flex-col justify-between h-full min-h-[480px] overflow-hidden leading-normal select-none" dir="rtl">
      <div>
        <div className="flex justify-between items-center border-b pb-1.5 mb-2">
          <div><h1 className="font-black text-sm text-blue-900">🏡 توصيل للمنزل • {companyName}</h1><p className="text-[10px] text-gray-600">{companyPhone}</p></div>
          <div className="text-center"><Barcode value={d.orderNumber} height={24} width={1.1} /><span className="font-mono text-[10px] font-bold">#{d.orderNumber}</span></div>
        </div>
        <div className="bg-blue-50 border border-blue-200 p-2 rounded mb-2 space-y-1">
          <div className="flex justify-between"><div><strong>المستلم:</strong> {d.customerName}</div><strong className="text-blue-900">{d.gov}</strong></div>
          <div><strong>الهاتف:</strong> <span className="font-mono">{d.phone1} {d.phone2 ? `/ ${d.phone2}` : ''}</span></div>
          <div className="border-t border-blue-200 pt-1"><strong>العنوان التفصيلي:</strong> {d.address}</div>
        </div>
        <div className="border border-gray-300 p-1.5 rounded mb-2 text-xs space-y-0.5">
          <div className="font-bold border-b pb-0.5 flex justify-between"><span>الأصناف المطلوب تسليمها:</span><span>شحن: {d.shipping}</span></div>
          {d.products.map((p, i) => (<div key={i} className="flex justify-between py-0.2"><span>{p.qty}x {p.name} ({p.price})</span><span className="font-mono font-bold">{p.lineTotal} ج.م</span></div>))}
        </div>
      </div>
      <div className="space-y-1">
        <div className="bg-blue-900 text-white p-2 rounded flex justify-between items-center font-black">
          <span>المبلغ عند الاستلام:</span><span className="text-base font-mono">{d.total.toLocaleString()} ج.م</span>
        </div>
        <div className="text-[10px] bg-gray-50 p-1 border rounded">ملاحظات: {d.notes || 'لا توجد'}</div>
        <div className="flex justify-between text-[8.5px] text-gray-500"><span>الموظف: {d.employee} | {d.page}</span><span>{terms || 'المعاينة حق للعميل'}</span></div>
      </div>
    </div>
  );
};

// TEMPLATE 26: Warehouse Cargo (Quarter A4)
export const Template26_WarehouseCargo: React.FC<WaybillProps> = ({ order, companyName, companyPhone, terms }) => {
  const d = getOrderData(order);
  return (
    <div className="bg-white text-black p-2.5 border-2 border-slate-700 w-full max-w-[395px] mx-auto text-right text-xs font-mono box-border flex flex-col justify-between h-full min-h-[480px] overflow-hidden leading-normal select-none" dir="rtl">
      <div>
        <div className="border-b-2 border-slate-700 pb-1 mb-2 flex justify-between items-center">
          <div><span className="font-black text-sm">{companyName} MANIFEST</span><div className="text-[9px]">{companyPhone}</div></div>
          <div className="text-center"><Barcode value={d.orderNumber} height={24} width={1} /><div className="text-[9px] font-bold">#{d.orderNumber}</div></div>
        </div>
        <div className="border border-slate-700 p-1.5 mb-2 font-sans space-y-0.5">
          <div className="flex justify-between"><span>DEST/المحافظة: <strong className="text-blue-900">{d.gov}</strong></span><span>{d.date}</span></div>
          <div>CUST/العميل: <strong>{d.customerName}</strong> ({d.phone1})</div>
          <div>ADDR/العنوان: {d.address}</div>
        </div>
        <div className="border border-slate-700 p-1 mb-2 font-sans">
          <div className="font-bold border-b pb-0.5 flex justify-between text-[11px]"><span>ITEMS STATEMENT:</span><span>SHIP: {d.shipping}</span></div>
          {d.products.map((p, i) => (<div key={i} className="flex justify-between text-xs py-0.2"><span>{p.qty}x {p.name}</span><span>{p.lineTotal} EGP</span></div>))}
        </div>
      </div>
      <div className="space-y-1 font-sans">
        <div className="bg-slate-800 text-white p-1.5 flex justify-between items-center font-black">
          <span>CASH TO COLLECT:</span><span className="text-base font-mono">{d.total.toLocaleString()} EGP</span>
        </div>
        <div className="text-[10px] truncate">NOTES: {d.notes || '—'}</div>
        <div className="flex justify-between text-[8.5px] text-gray-500"><span>EMP: {d.employee} | {d.page}</span><span>{terms || 'INSPECTION ALLOWED'}</span></div>
      </div>
    </div>
  );
};

// TEMPLATE 27: Wide Header (Quarter A4)
export const Template27_WideHeader: React.FC<WaybillProps> = ({ order, companyName, companyPhone, terms }) => {
  const d = getOrderData(order);
  return (
    <div className="bg-white text-black p-2.5 border border-black w-full max-w-[395px] mx-auto text-right text-xs box-border flex flex-col justify-between h-full min-h-[480px] overflow-hidden leading-normal select-none" dir="rtl">
      <div>
        <div className="bg-gray-200 border-b border-black p-2 -mx-2.5 -mt-2.5 mb-2 flex justify-between items-center">
          <div><h1 className="font-black text-sm">{companyName}</h1><p className="text-[10px] font-mono">{companyPhone}</p></div>
          <div className="text-center bg-white px-2 py-0.5 border rounded"><Barcode value={d.orderNumber} height={22} width={1} /><span className="font-mono text-[9px] font-bold">#{d.orderNumber}</span></div>
        </div>
        <div className="border border-gray-300 p-1.5 rounded mb-2 space-y-0.5 bg-gray-50">
          <div className="flex justify-between"><div><strong>العميل:</strong> {d.customerName} ({d.phone1})</div><strong className="text-blue-900">{d.gov}</strong></div>
          <div><strong>العنوان:</strong> {d.address}</div>
        </div>
        <table className="w-full border text-xs mb-2">
          <thead className="bg-gray-100"><tr><th className="p-1 border text-right">المنتج</th><th className="p-1 border text-center w-8">كمية</th><th className="p-1 border text-center w-12">سعر</th><th className="p-1 border text-center w-14">إجمالي</th></tr></thead>
          <tbody>{d.products.map((p, i) => (<tr key={i}><td className="p-1 border truncate max-w-[140px]">{p.name}</td><td className="p-1 border text-center font-bold">{p.qty}</td><td className="p-1 border text-center font-mono">{p.price}</td><td className="p-1 border text-center font-mono font-bold">{p.lineTotal}</td></tr>))}</tbody>
        </table>
      </div>
      <div className="space-y-1">
        <div className="bg-black text-white p-1.5 rounded flex justify-between items-center font-black">
          <span>شحن: {d.shipping} | المطلوب تحصيله:</span><span className="text-base font-mono">{d.total.toLocaleString()} ج.م</span>
        </div>
        <div className="text-[10px] bg-gray-50 p-1 border rounded">ملاحظات: {d.notes || '—'}</div>
        <div className="flex justify-between text-[8.5px] text-gray-500"><span>الموظف: {d.employee} | {d.page}</span><span>{terms || 'المعاينة حق للعميل'}</span></div>
      </div>
    </div>
  );
};

// TEMPLATE 28: Modern Violet (Quarter A4)
export const Template28_ModernViolet: React.FC<WaybillProps> = ({ order, companyName, companyPhone, terms }) => {
  const d = getOrderData(order);
  return (
    <div className="bg-purple-50/40 text-purple-950 p-2.5 border-2 border-purple-600 rounded-lg w-full max-w-[395px] mx-auto text-right text-xs box-border flex flex-col justify-between h-full min-h-[480px] overflow-hidden leading-normal select-none" dir="rtl">
      <div>
        <div className="flex justify-between items-center border-b border-purple-200 pb-1.5 mb-2">
          <div><h1 className="font-black text-sm text-purple-800">{companyName}</h1><p className="text-[9px] text-purple-600 font-mono">{companyPhone}</p></div>
          <div className="text-center bg-white p-1 rounded border border-purple-200"><Barcode value={d.orderNumber} height={24} width={1.1} /><span className="font-mono text-[9px] font-bold text-purple-900">#{d.orderNumber}</span></div>
        </div>
        <div className="bg-white p-2 rounded-md border border-purple-200 mb-2 space-y-1">
          <div className="flex justify-between"><div><span className="text-purple-600 font-bold">العميل:</span> <strong>{d.customerName}</strong></div><span className="bg-purple-100 text-purple-800 font-bold px-2 py-0.5 rounded text-[10px]">{d.gov}</span></div>
          <div>📞 <span className="font-mono font-bold">{d.phone1}</span></div>
          <div className="border-t border-purple-100 pt-1">العنوان: {d.address}</div>
        </div>
        <div className="bg-white p-1.5 rounded-md border border-purple-200 mb-2 space-y-0.5">
          <div className="font-bold border-b border-purple-100 pb-0.5 flex justify-between text-purple-900"><span>المنتجات:</span><span>شحن: {d.shipping} ج.م</span></div>
          {d.products.map((p, i) => (<div key={i} className="flex justify-between py-0.2"><span>{p.qty}x {p.name} ({p.price})</span><span className="font-mono font-bold">{p.lineTotal} ج.م</span></div>))}
        </div>
      </div>
      <div className="space-y-1">
        <div className="bg-purple-800 text-white p-2 rounded-md flex justify-between items-center font-black">
          <span>الإجمالي المطلوب:</span><span className="text-base font-mono">{d.total.toLocaleString()} ج.م</span>
        </div>
        <div className="text-[10px] bg-white p-1 rounded border border-purple-200">ملاحظات: {d.notes || 'لا توجد'}</div>
        <div className="flex justify-between text-[8.5px] text-purple-700"><span>الموظف: {d.employee} | {d.page}</span><span>{terms || 'المعاينة حق للعميل'}</span></div>
      </div>
    </div>
  );
};

// TEMPLATE 29: Personal Card (Quarter A4)
export const Template29_PersonalCard: React.FC<WaybillProps> = ({ order, companyName, companyPhone, terms }) => {
  const d = getOrderData(order);
  return (
    <div className="bg-white text-slate-800 p-3 border-2 border-slate-400 rounded-xl w-full max-w-[395px] mx-auto text-right text-xs box-border flex flex-col justify-between h-full min-h-[480px] overflow-hidden leading-normal select-none shadow-sm" dir="rtl">
      <div>
        <div className="flex justify-between items-center border-b pb-2 mb-2">
          <div><h1 className="font-black text-sm text-slate-900">{companyName}</h1><p className="text-[10px] text-slate-500">{companyPhone}</p></div>
          <div className="text-center"><Barcode value={d.orderNumber} height={24} width={1.1} /><span className="font-mono text-xs font-bold text-slate-700">#{d.orderNumber}</span></div>
        </div>
        <div className="bg-slate-50 p-2 rounded-lg border border-slate-200 mb-2 space-y-1">
          <div className="flex justify-between items-center"><div><span className="text-slate-400 text-[10px]">العميل المستلم:</span> <div className="font-black text-sm text-slate-900">{d.customerName}</div></div><strong className="text-blue-800 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">{d.gov}</strong></div>
          <div className="font-mono font-bold text-xs">📞 {d.phone1}</div>
          <div className="border-t border-slate-200 pt-1 text-[11px]">العنوان: {d.address}</div>
        </div>
        <div className="border border-slate-200 p-1.5 rounded-lg mb-2 text-xs space-y-0.5">
          <div className="font-bold border-b pb-0.5 flex justify-between"><span>الطلبات:</span><span>شحن: {d.shipping} ج.م</span></div>
          {d.products.map((p, i) => (<div key={i} className="flex justify-between py-0.2"><span>{p.qty}x {p.name} ({p.price})</span><span className="font-mono font-bold">{p.lineTotal} ج.م</span></div>))}
        </div>
      </div>
      <div className="space-y-1">
        <div className="bg-slate-900 text-white p-2 rounded-lg flex justify-between items-center font-black">
          <span>المطلوب تحصيله:</span><span className="text-base font-mono text-amber-400">{d.total.toLocaleString()} ج.م</span>
        </div>
        <div className="text-[10px] bg-slate-50 p-1 rounded border">ملاحظات: {d.notes || '—'}</div>
        <div className="flex justify-between text-[8.5px] text-slate-500"><span>الموظف: {d.employee} | {d.page}</span><span>{terms || 'المعاينة حق للعميل'}</span></div>
      </div>
    </div>
  );
};

// TEMPLATE 30: Dual Tone (Quarter A4)
export const Template30_DualTone: React.FC<WaybillProps> = ({ order, companyName, companyPhone, terms }) => {
  const d = getOrderData(order);
  return (
    <div className="bg-white text-black p-2.5 border-2 border-black w-full max-w-[395px] mx-auto text-right text-xs box-border flex flex-col justify-between h-full min-h-[480px] overflow-hidden leading-normal select-none" dir="rtl">
      <div>
        <div className="bg-black text-white p-2 flex justify-between items-center -mx-2.5 -mt-2.5 mb-2">
          <span className="font-black text-sm">{companyName}</span>
          <span className="font-mono text-xs">{companyPhone}</span>
        </div>
        <div className="flex justify-between items-center mb-2 bg-gray-100 p-1.5 border border-black">
          <div><div className="text-[9px] text-gray-600 font-bold">رقم الأوردر:</div><div className="font-mono font-black text-sm">#{d.orderNumber}</div></div>
          <Barcode value={d.orderNumber} height={26} width={1.1} />
        </div>
        <div className="border border-black p-1.5 mb-2 space-y-0.5">
          <div className="flex justify-between"><div><strong>العميل:</strong> {d.customerName} ({d.phone1})</div><strong className="bg-black text-white px-1.5">{d.gov}</strong></div>
          <div><strong>العنوان:</strong> {d.address}</div>
        </div>
        <div className="border border-black p-1.5 mb-2 space-y-0.5">
          <div className="font-bold border-b border-black pb-0.5 flex justify-between"><span>المنتجات:</span><span>شحن: {d.shipping} ج.م</span></div>
          {d.products.map((p, i) => (<div key={i} className="flex justify-between py-0.2"><span>{p.qty}x {p.name} ({p.price})</span><span className="font-mono font-bold">{p.lineTotal}</span></div>))}
        </div>
      </div>
      <div className="space-y-1">
        <div className="bg-black text-white p-2 flex justify-between items-center font-black text-xs">
          <span>إجمالي التحصيل:</span><span className="text-base font-mono">{d.total.toLocaleString()} ج.م</span>
        </div>
        <div className="text-[10px] bg-gray-50 p-1 border border-black">ملاحظات: {d.notes || '—'}</div>
        <div className="flex justify-between text-[8.5px] text-gray-600"><span>الموظف: {d.employee} | {d.page}</span><span>{terms || 'المعاينة حق للعميل'}</span></div>
      </div>
    </div>
  );
};

// TEMPLATE 31: Logistics Pro (Quarter A4)
export const Template31_LogisticsPro: React.FC<WaybillProps> = ({ order, companyName, companyPhone, terms }) => {
  const d = getOrderData(order);
  return (
    <div className="bg-white text-slate-900 p-2.5 border-2 border-sky-700 w-full max-w-[395px] mx-auto text-right text-xs box-border flex flex-col justify-between h-full min-h-[480px] overflow-hidden leading-normal select-none" dir="rtl">
      <div>
        <div className="bg-sky-800 text-white p-1.5 flex justify-between items-center -mx-2.5 -mt-2.5 mb-2">
          <div><h1 className="font-black text-xs uppercase tracking-wider">{companyName} LOGISTICS</h1><p className="text-[9px] text-sky-200">{companyPhone}</p></div>
          <span className="bg-white text-sky-900 text-[10px] font-mono font-bold px-2 py-0.5 rounded">TRACKING</span>
        </div>
        <div className="flex justify-between items-center mb-2 border-b border-sky-200 pb-1.5">
          <div><div className="text-[9px] text-slate-500">كود الشحنة:</div><div className="font-mono font-black text-xs text-sky-900">#{d.orderNumber}</div></div>
          <Barcode value={d.orderNumber} height={26} width={1.1} />
        </div>
        <div className="bg-sky-50 p-2 rounded border border-sky-200 mb-2 space-y-1">
          <div className="flex justify-between"><div><strong>المستلم:</strong> {d.customerName}</div><strong className="text-sky-900 bg-sky-200 px-2 py-0.5 rounded">{d.gov}</strong></div>
          <div>الهاتف: <span className="font-mono font-bold">{d.phone1}</span></div>
          <div className="border-t border-sky-200 pt-1">العنوان: {d.address}</div>
        </div>
        <div className="border border-slate-200 p-1.5 rounded mb-2 space-y-0.5">
          <div className="font-bold border-b pb-0.5 flex justify-between text-sky-950"><span>الأصناف:</span><span>شحن: {d.shipping} ج.م</span></div>
          {d.products.map((p, i) => (<div key={i} className="flex justify-between py-0.2"><span>{p.qty}x {p.name}</span><span className="font-mono font-bold">{p.lineTotal}</span></div>))}
        </div>
      </div>
      <div className="space-y-1">
        <div className="bg-sky-900 text-white p-2 rounded flex justify-between items-center font-black">
          <span>الصافي المطلوب:</span><span className="text-base font-mono">{d.total.toLocaleString()} ج.م</span>
        </div>
        <div className="text-[10px] bg-slate-50 p-1 rounded border">ملاحظات: {d.notes || '—'}</div>
        <div className="flex justify-between text-[8.5px] text-slate-500"><span>الموظف: {d.employee} | {d.page}</span><span>{terms || 'المعاينة حق للعميل'}</span></div>
      </div>
    </div>
  );
};

// TEMPLATE 32: Double Badge (Quarter A4)
export const Template32_DoubleBadge: React.FC<WaybillProps> = ({ order, companyName, companyPhone, terms }) => {
  const d = getOrderData(order);
  return (
    <div className="bg-white text-black p-2.5 border border-black w-full max-w-[395px] mx-auto text-right text-xs box-border flex flex-col justify-between h-full min-h-[480px] overflow-hidden leading-normal select-none" dir="rtl">
      <div>
        <div className="flex justify-between items-center border-b-2 border-black pb-1.5 mb-2">
          <span className="bg-black text-white px-2 py-0.5 font-black text-xs">{companyName}</span>
          <span className="border border-black px-2 py-0.5 font-mono font-bold text-xs">#{d.orderNumber}</span>
        </div>
        <div className="text-center mb-2"><Barcode value={d.orderNumber} height={24} width={1.1} /></div>
        <div className="border border-black p-1.5 mb-2 space-y-0.5 bg-gray-50">
          <div className="flex justify-between"><div><strong>العميل:</strong> {d.customerName} ({d.phone1})</div><strong className="bg-black text-white px-1.5">{d.gov}</strong></div>
          <div><strong>العنوان:</strong> {d.address}</div>
        </div>
        <div className="border border-black p-1.5 mb-2 space-y-0.5">
          <div className="font-bold border-b border-black pb-0.5 flex justify-between"><span>المنتجات:</span><span>شحن: {d.shipping} ج.م</span></div>
          {d.products.map((p, i) => (<div key={i} className="flex justify-between py-0.2"><span>{p.qty}x {p.name} ({p.price})</span><span className="font-mono font-bold">{p.lineTotal}</span></div>))}
        </div>
      </div>
      <div className="space-y-1">
        <div className="border-2 border-black p-1.5 flex justify-between items-center font-black bg-gray-100">
          <span>المطلوب تحصيله:</span><span className="text-base font-mono">{d.total.toLocaleString()} ج.م</span>
        </div>
        <div className="text-[10px] bg-gray-50 p-1 border">ملاحظات: {d.notes || '—'}</div>
        <div className="flex justify-between text-[8.5px] text-gray-600"><span>الموظف: {d.employee} | {d.page}</span><span>{terms || 'المعاينة حق للعميل'}</span></div>
      </div>
    </div>
  );
};

// TEMPLATE 33: Neutral Gray (Quarter A4)
export const Template33_NeutralGray: React.FC<WaybillProps> = ({ order, companyName, companyPhone, terms }) => {
  const d = getOrderData(order);
  return (
    <div className="bg-gray-50 text-gray-900 p-2.5 border border-gray-400 rounded w-full max-w-[395px] mx-auto text-right text-xs font-sans box-border flex flex-col justify-between h-full min-h-[480px] overflow-hidden leading-normal select-none" dir="rtl">
      <div>
        <div className="flex justify-between items-center border-b border-gray-300 pb-1.5 mb-2">
          <div><h1 className="font-bold text-sm text-gray-800">{companyName}</h1><p className="text-[10px] text-gray-500 font-mono">{companyPhone}</p></div>
          <div className="text-center"><Barcode value={d.orderNumber} height={24} width={1.1} /><span className="font-mono text-[10px] text-gray-600">#{d.orderNumber}</span></div>
        </div>
        <div className="bg-white p-2 rounded border border-gray-200 mb-2 space-y-1">
          <div className="flex justify-between"><div><strong>العميل:</strong> {d.customerName}</div><strong className="text-gray-700 bg-gray-100 px-2 py-0.5 rounded">{d.gov}</strong></div>
          <div className="font-mono text-xs">📞 {d.phone1}</div>
          <div className="border-t border-gray-100 pt-1">العنوان: {d.address}</div>
        </div>
        <div className="bg-white p-1.5 rounded border border-gray-200 mb-2 space-y-0.5">
          <div className="font-bold border-b border-gray-100 pb-0.5 flex justify-between"><span>الأصناف:</span><span>شحن: {d.shipping} ج.م</span></div>
          {d.products.map((p, i) => (<div key={i} className="flex justify-between py-0.2"><span>{p.qty}x {p.name} ({p.price})</span><span className="font-mono font-bold">{p.lineTotal}</span></div>))}
        </div>
      </div>
      <div className="space-y-1">
        <div className="bg-gray-800 text-white p-2 rounded flex justify-between items-center font-bold">
          <span>المطلوب تحصيله:</span><span className="text-base font-mono">{d.total.toLocaleString()} ج.م</span>
        </div>
        <div className="text-[10px] bg-white p-1 rounded border border-gray-200">ملاحظات: {d.notes || '—'}</div>
        <div className="flex justify-between text-[8.5px] text-gray-500"><span>الموظف: {d.employee} | {d.page}</span><span>{terms || 'المعاينة حق للعميل'}</span></div>
      </div>
    </div>
  );
};

// TEMPLATE 34: Delivery Proof (Quarter A4)
export const Template34_DeliveryProof: React.FC<WaybillProps> = ({ order, companyName, companyPhone, terms }) => {
  const d = getOrderData(order);
  return (
    <div className="bg-white text-black p-2.5 border-2 border-black w-full max-w-[395px] mx-auto text-right text-xs box-border flex flex-col justify-between h-full min-h-[480px] overflow-hidden leading-normal select-none" dir="rtl">
      <div>
        <div className="flex justify-between items-center border-b border-black pb-1 mb-2">
          <div><h1 className="font-black text-sm">{companyName}</h1><p className="text-[9px]">{companyPhone}</p></div>
          <div className="text-center"><Barcode value={d.orderNumber} height={24} width={1.1} /><span className="font-mono text-xs font-bold">#{d.orderNumber}</span></div>
        </div>
        <div className="border border-black p-1.5 mb-2 bg-gray-50 space-y-0.5">
          <div className="flex justify-between"><div><strong>المستلم:</strong> {d.customerName} ({d.phone1})</div><strong className="text-blue-900">{d.gov}</strong></div>
          <div><strong>العنوان:</strong> {d.address}</div>
        </div>
        <div className="border border-black p-1 mb-2 space-y-0.5">
          <div className="font-bold border-b pb-0.5 flex justify-between"><span>المنتجات:</span><span>شحن: {d.shipping} ج.م</span></div>
          {d.products.map((p, i) => (<div key={i} className="flex justify-between py-0.2"><span>{p.qty}x {p.name} ({p.price})</span><span className="font-mono font-bold">{p.lineTotal}</span></div>))}
        </div>
      </div>
      <div className="space-y-1">
        <div className="flex justify-between items-center bg-gray-200 border border-black p-1.5 font-black">
          <span>المبلغ المطلوب:</span><span className="text-base font-mono">{d.total.toLocaleString()} ج.م</span>
        </div>
        <div className="border border-black p-1 rounded space-y-1 bg-gray-50">
          <div className="text-[9px] font-bold">إقرار واستلام العميل:</div>
          <div className="flex justify-between text-[8.5px] border-t border-gray-300 pt-0.5"><span>توقيع المستلم: ....................</span><span>الرقم القومي: ....................</span></div>
        </div>
        <div className="flex justify-between text-[8.5px] text-gray-500"><span>الموظف: {d.employee} | {d.page}</span><span>{terms || 'المعاينة حق للعميل'}</span></div>
      </div>
    </div>
  );
};

// TEMPLATE 35: Direct Sale (Quarter A4)
export const Template35_DirectSale: React.FC<WaybillProps> = ({ order, companyName, companyPhone, terms }) => {
  const d = getOrderData(order);
  return (
    <div className="bg-white text-slate-900 p-2.5 border-2 border-teal-700 w-full max-w-[395px] mx-auto text-right text-xs font-sans box-border flex flex-col justify-between h-full min-h-[480px] overflow-hidden leading-normal select-none" dir="rtl">
      <div>
        <div className="flex justify-between items-center border-b border-teal-700 pb-1.5 mb-2">
          <div><h1 className="font-black text-sm text-teal-900">{companyName}</h1><p className="text-[9px] text-teal-700 font-mono">{companyPhone}</p></div>
          <div className="text-center"><Barcode value={d.orderNumber} height={24} width={1.1} /><span className="font-mono text-xs font-bold text-teal-800">#{d.orderNumber}</span></div>
        </div>
        <div className="bg-teal-50/60 p-2 rounded border border-teal-200 mb-2 space-y-1">
          <div className="flex justify-between"><div><strong>العميل:</strong> {d.customerName}</div><strong className="text-teal-900">{d.gov}</strong></div>
          <div className="font-mono">📞 {d.phone1}</div>
          <div className="border-t border-teal-200 pt-0.5">العنوان: {d.address}</div>
        </div>
        <table className="w-full text-xs border border-teal-200 mb-2">
          <thead className="bg-teal-100 text-teal-900"><tr><th className="p-1 text-right">الصنف</th><th className="p-1 text-center w-8">كمية</th><th className="p-1 text-center w-12">السعر</th><th className="p-1 text-center w-14">الإجمالي</th></tr></thead>
          <tbody>{d.products.map((p, i) => (<tr key={i}><td className="p-1 border-t truncate max-w-[140px]">{p.name}</td><td className="p-1 border-t text-center font-bold">{p.qty}</td><td className="p-1 border-t text-center font-mono">{p.price}</td><td className="p-1 border-t text-center font-mono font-bold text-teal-900">{p.lineTotal}</td></tr>))}</tbody>
        </table>
      </div>
      <div className="space-y-1">
        <div className="bg-teal-800 text-white p-2 rounded flex justify-between items-center font-black">
          <span>شحن: {d.shipping} ج.م | المطلوب:</span><span className="text-base font-mono">{d.total.toLocaleString()} ج.م</span>
        </div>
        <div className="text-[10px] bg-slate-50 p-1 rounded border">ملاحظات: {d.notes || '—'}</div>
        <div className="flex justify-between text-[8.5px] text-teal-800"><span>الموظف: {d.employee} | {d.page}</span><span>{terms || 'المعاينة حق للعميل'}</span></div>
      </div>
    </div>
  );
};

// TEMPLATE 36: Crimson Red (Quarter A4)
export const Template36_CrimsonRed: React.FC<WaybillProps> = ({ order, companyName, companyPhone, terms }) => {
  const d = getOrderData(order);
  return (
    <div className="bg-white text-slate-900 p-2.5 border-2 border-rose-700 w-full max-w-[395px] mx-auto text-right text-xs box-border flex flex-col justify-between h-full min-h-[480px] overflow-hidden leading-normal select-none" dir="rtl">
      <div>
        <div className="bg-rose-700 text-white p-2 flex justify-between items-center -mx-2.5 -mt-2.5 mb-2">
          <div><h1 className="font-black text-sm">{companyName}</h1><p className="text-[9px] text-rose-200 font-mono">{companyPhone}</p></div>
          <div className="bg-white text-black p-1 rounded text-center"><Barcode value={d.orderNumber} height={22} width={1} /><span className="font-mono text-[9px] font-bold">#{d.orderNumber}</span></div>
        </div>
        <div className="bg-rose-50 p-2 rounded border border-rose-200 mb-2 space-y-1">
          <div className="flex justify-between"><div><strong>المستلم:</strong> {d.customerName}</div><strong className="text-rose-900 bg-rose-200 px-2 py-0.5 rounded">{d.gov}</strong></div>
          <div className="font-mono font-bold">📞 {d.phone1}</div>
          <div className="border-t border-rose-200 pt-1">العنوان: {d.address}</div>
        </div>
        <div className="border border-rose-200 p-1.5 rounded mb-2 space-y-0.5">
          <div className="font-bold border-b border-rose-200 pb-0.5 flex justify-between text-rose-900"><span>المنتجات:</span><span>شحن: {d.shipping} ج.م</span></div>
          {d.products.map((p, i) => (<div key={i} className="flex justify-between py-0.2"><span>{p.qty}x {p.name} ({p.price})</span><span className="font-mono font-bold">{p.lineTotal} ج.م</span></div>))}
        </div>
      </div>
      <div className="space-y-1">
        <div className="bg-rose-700 text-white p-2 rounded flex justify-between items-center font-black">
          <span>المطلوب تحصيله:</span><span className="text-base font-mono">{d.total.toLocaleString()} ج.م</span>
        </div>
        <div className="text-[10px] bg-rose-50 p-1 rounded border border-rose-200 text-rose-900">ملاحظات: {d.notes || '—'}</div>
        <div className="flex justify-between text-[8.5px] text-rose-700"><span>الموظف: {d.employee} | {d.page}</span><span>{terms || 'المعاينة حق للعميل'}</span></div>
      </div>
    </div>
  );
};

// TEMPLATE 37: Smart Track (Quarter A4)
export const Template37_SmartTrack: React.FC<WaybillProps> = ({ order, companyName, companyPhone, terms }) => {
  const d = getOrderData(order);
  return (
    <div className="bg-white text-black p-2.5 border-2 border-indigo-900 w-full max-w-[395px] mx-auto text-right text-xs font-sans box-border flex flex-col justify-between h-full min-h-[480px] overflow-hidden leading-normal select-none" dir="rtl">
      <div>
        <div className="flex justify-between items-center border-b-2 border-indigo-900 pb-1.5 mb-2">
          <div><h1 className="font-black text-sm text-indigo-900">{companyName}</h1><p className="text-[9px] font-mono">{companyPhone}</p></div>
          <div className="text-center bg-indigo-50 px-2 py-1 rounded border border-indigo-200"><Barcode value={d.orderNumber} height={26} width={1.1} /><span className="font-mono text-xs font-black text-indigo-950">#{d.orderNumber}</span></div>
        </div>
        <div className="border border-indigo-200 p-2 rounded mb-2 space-y-0.5 bg-indigo-50/40">
          <div className="flex justify-between"><div><strong>المستلم:</strong> {d.customerName} ({d.phone1})</div><strong className="text-indigo-900">{d.gov}</strong></div>
          <div><strong>العنوان:</strong> {d.address}</div>
        </div>
        <div className="border border-indigo-200 p-1.5 rounded mb-2 space-y-0.5">
          <div className="font-bold border-b pb-0.5 flex justify-between text-indigo-900"><span>بيان الشحنة:</span><span>شحن: {d.shipping} ج.م</span></div>
          {d.products.map((p, i) => (<div key={i} className="flex justify-between py-0.2"><span>{p.qty}x {p.name} ({p.price})</span><span className="font-mono font-bold">{p.lineTotal} ج.م</span></div>))}
        </div>
      </div>
      <div className="space-y-1">
        <div className="bg-indigo-900 text-white p-2 rounded flex justify-between items-center font-black">
          <span>المبلغ المستحق:</span><span className="text-base font-mono">{d.total.toLocaleString()} ج.م</span>
        </div>
        <div className="text-[10px] bg-slate-50 p-1 rounded border">ملاحظات: {d.notes || '—'}</div>
        <div className="flex justify-between text-[8.5px] text-indigo-900"><span>الموظف: {d.employee} | {d.page}</span><span>{terms || 'المعاينة حق للعميل'}</span></div>
      </div>
    </div>
  );
};

// TEMPLATE 38: E-Commerce Label (Quarter A4)
export const Template38_ECommerceLabel: React.FC<WaybillProps> = ({ order, companyName, companyPhone, terms }) => {
  const d = getOrderData(order);
  return (
    <div className="bg-white text-slate-900 p-2.5 border-2 border-slate-800 rounded-md w-full max-w-[395px] mx-auto text-right text-xs box-border flex flex-col justify-between h-full min-h-[480px] overflow-hidden leading-normal select-none" dir="rtl">
      <div>
        <div className="flex justify-between items-center border-b pb-1.5 mb-2">
          <div><span className="bg-slate-900 text-white font-black text-xs px-2 py-0.5 rounded">ONLINE STORE</span><div className="font-bold text-xs mt-1">{companyName}</div></div>
          <div className="text-center"><Barcode value={d.orderNumber} height={24} width={1.1} /><span className="font-mono text-xs font-bold">#{d.orderNumber}</span></div>
        </div>
        <div className="bg-slate-100 p-2 rounded mb-2 space-y-1">
          <div className="flex justify-between"><div><strong>العميل:</strong> {d.customerName}</div><strong className="text-slate-900 underline">{d.gov}</strong></div>
          <div className="font-mono">📞 {d.phone1}</div>
          <div className="border-t border-slate-200 pt-1">العنوان: {d.address}</div>
        </div>
        <div className="border p-1.5 rounded mb-2 space-y-0.5">
          <div className="font-bold border-b pb-0.5 flex justify-between"><span>الطلبات:</span><span>شحن: {d.shipping} ج.م</span></div>
          {d.products.map((p, i) => (<div key={i} className="flex justify-between py-0.2"><span>{p.qty}x {p.name} ({p.price})</span><span className="font-mono font-bold">{p.lineTotal} ج.م</span></div>))}
        </div>
      </div>
      <div className="space-y-1">
        <div className="bg-slate-900 text-white p-2 rounded flex justify-between items-center font-black">
          <span>CASH ON DELIVERY:</span><span className="text-base font-mono">{d.total.toLocaleString()} EGP</span>
        </div>
        <div className="text-[10px] bg-slate-50 p-1 rounded border">ملاحظات: {d.notes || '—'}</div>
        <div className="flex justify-between text-[8.5px] text-slate-500"><span>الموظف: {d.employee} | {d.page}</span><span>{terms || 'المعاينة حق للعميل'}</span></div>
      </div>
    </div>
  );
};

// TEMPLATE 39: Structured Strip (Quarter A4)
export const Template39_StructuredStrip: React.FC<WaybillProps> = ({ order, companyName, companyPhone, terms }) => {
  const d = getOrderData(order);
  return (
    <div className="bg-white text-black p-2.5 border-r-8 border-y border-l border-black w-full max-w-[395px] mx-auto text-right text-xs box-border flex flex-col justify-between h-full min-h-[480px] overflow-hidden leading-normal select-none" dir="rtl">
      <div>
        <div className="flex justify-between items-center border-b border-black pb-1.5 mb-2">
          <div><h1 className="font-black text-sm">{companyName}</h1><p className="font-mono text-[10px]">{companyPhone}</p></div>
          <div className="text-center"><Barcode value={d.orderNumber} height={24} width={1.1} /><span className="font-mono text-xs font-bold">#{d.orderNumber}</span></div>
        </div>
        <div className="border border-black p-1.5 mb-2 bg-gray-50 space-y-0.5">
          <div className="flex justify-between"><div><strong>المستلم:</strong> {d.customerName} ({d.phone1})</div><strong className="text-blue-900">{d.gov}</strong></div>
          <div><strong>العنوان:</strong> {d.address}</div>
        </div>
        <div className="border border-black p-1.5 mb-2 space-y-0.5">
          <div className="font-bold border-b border-black pb-0.5 flex justify-between"><span>المنتجات:</span><span>شحن: {d.shipping} ج.م</span></div>
          {d.products.map((p, i) => (<div key={i} className="flex justify-between py-0.2"><span>{p.qty}x {p.name} ({p.price})</span><span className="font-mono font-bold">{p.lineTotal}</span></div>))}
        </div>
      </div>
      <div className="space-y-1">
        <div className="bg-black text-white p-1.5 flex justify-between items-center font-black">
          <span>الإجمالي النهائي:</span><span className="text-base font-mono">{d.total.toLocaleString()} ج.م</span>
        </div>
        <div className="text-[10px] bg-gray-50 p-1 border border-black">ملاحظات: {d.notes || '—'}</div>
        <div className="flex justify-between text-[8.5px] text-gray-600"><span>الموظف: {d.employee} | {d.page}</span><span>{terms || 'المعاينة حق للعميل'}</span></div>
      </div>
    </div>
  );
};

// TEMPLATE 40: Detailed Invoice (Quarter A4)
export const Template40_DetailedInvoice: React.FC<WaybillProps> = ({ order, companyName, companyPhone, terms }) => {
  const d = getOrderData(order);
  return (
    <div className="bg-white text-black p-2.5 border border-black w-full max-w-[395px] mx-auto text-right text-xs box-border flex flex-col justify-between h-full min-h-[480px] overflow-hidden leading-normal select-none" dir="rtl">
      <div>
        <div className="flex justify-between items-center border-b border-black pb-1.5 mb-2">
          <div><h1 className="font-black text-sm">{companyName}</h1><p className="text-[9px] font-mono">{companyPhone}</p></div>
          <div className="text-center"><Barcode value={d.orderNumber} height={24} width={1.1} /><span className="font-mono text-xs font-bold">#{d.orderNumber}</span></div>
        </div>
        <div className="border border-gray-300 p-1.5 mb-2 bg-gray-50 space-y-0.5">
          <div className="flex justify-between"><div><strong>العميل:</strong> {d.customerName} ({d.phone1})</div><strong className="text-blue-900">{d.gov}</strong></div>
          <div><strong>العنوان:</strong> {d.address}</div>
        </div>
        <table className="w-full text-xs border border-black mb-2">
          <thead className="bg-gray-100"><tr><th className="p-1 border text-right">الصنف</th><th className="p-1 border text-center w-8">كمية</th><th className="p-1 border text-center w-12">السعر</th><th className="p-1 border text-center w-14">الإجمالي</th></tr></thead>
          <tbody>{d.products.map((p, i) => (<tr key={i}><td className="p-1 border truncate max-w-[140px]">{p.name}</td><td className="p-1 border text-center font-bold">{p.qty}</td><td className="p-1 border text-center font-mono">{p.price}</td><td className="p-1 border text-center font-mono font-bold">{p.lineTotal}</td></tr>))}</tbody>
        </table>
      </div>
      <div className="space-y-1">
        <div className="border border-black p-1.5 bg-gray-50 space-y-0.5 text-xs">
          <div className="flex justify-between"><span>المجموع الفرعي:</span><span className="font-mono">{d.subtotal} ج.م</span></div>
          <div className="flex justify-between"><span>مصاريف الشحن:</span><span className="font-mono">{d.shipping} ج.م</span></div>
          <div className="flex justify-between font-black border-t pt-0.5 text-sm"><span>المطلوب تحصيله:</span><span className="font-mono">{d.total.toLocaleString()} ج.م</span></div>
        </div>
        <div className="text-[10px] bg-gray-50 p-1 border">ملاحظات: {d.notes || '—'}</div>
        <div className="flex justify-between text-[8.5px] text-gray-500"><span>الموظف: {d.employee} | {d.page}</span><span>{terms || 'المعاينة حق للعميل'}</span></div>
      </div>
    </div>
  );
};

// TEMPLATE 41: Soft Boutique (Quarter A4)
export const Template41_SoftBoutique: React.FC<WaybillProps> = ({ order, companyName, companyPhone, terms }) => {
  const d = getOrderData(order);
  return (
    <div className="bg-pink-50/30 text-slate-800 p-2.5 border-2 border-pink-300 rounded-lg w-full max-w-[395px] mx-auto text-right text-xs box-border flex flex-col justify-between h-full min-h-[480px] overflow-hidden leading-normal select-none" dir="rtl">
      <div>
        <div className="flex justify-between items-center border-b border-pink-200 pb-1.5 mb-2">
          <div><h1 className="font-serif font-black text-sm text-pink-900">{companyName}</h1><p className="text-[9px] text-pink-700 font-mono">{companyPhone}</p></div>
          <div className="text-center bg-white p-1 rounded border border-pink-200"><Barcode value={d.orderNumber} height={24} width={1.1} /><span className="font-mono text-[9px] font-bold text-pink-900">#{d.orderNumber}</span></div>
        </div>
        <div className="bg-white p-2 rounded-md border border-pink-200 mb-2 space-y-1">
          <div className="flex justify-between"><div><span className="text-pink-600 font-bold">العميل:</span> <strong>{d.customerName}</strong></div><span className="bg-pink-100 text-pink-800 font-bold px-2 py-0.5 rounded text-[10px]">{d.gov}</span></div>
          <div>📞 <span className="font-mono font-bold">{d.phone1}</span></div>
          <div className="border-t border-pink-100 pt-1">العنوان: {d.address}</div>
        </div>
        <div className="bg-white p-1.5 rounded-md border border-pink-200 mb-2 space-y-0.5">
          <div className="font-bold border-b border-pink-100 pb-0.5 flex justify-between text-pink-900"><span>المنتجات:</span><span>شحن: {d.shipping} ج.م</span></div>
          {d.products.map((p, i) => (<div key={i} className="flex justify-between py-0.2"><span>{p.qty}x {p.name} ({p.price})</span><span className="font-mono font-bold">{p.lineTotal} ج.م</span></div>))}
        </div>
      </div>
      <div className="space-y-1">
        <div className="bg-pink-800 text-white p-2 rounded-md flex justify-between items-center font-black">
          <span>المطلوب تحصيله:</span><span className="text-base font-mono">{d.total.toLocaleString()} ج.م</span>
        </div>
        <div className="text-[10px] bg-white p-1 rounded border border-pink-200">ملاحظات: {d.notes || 'لا توجد'}</div>
        <div className="flex justify-between text-[8.5px] text-pink-700"><span>الموظف: {d.employee} | {d.page}</span><span>{terms || 'المعاينة حق للعميل'}</span></div>
      </div>
    </div>
  );
};

// TEMPLATE 42: Classic Duplicate (Quarter A4)
export const Template42_ClassicDuplicate: React.FC<WaybillProps> = ({ order, companyName, companyPhone, terms }) => {
  const d = getOrderData(order);
  return (
    <div className="bg-white text-black p-2 border-2 border-black w-full max-w-[395px] mx-auto text-right text-[11px] box-border flex flex-col justify-between h-full min-h-[480px] overflow-hidden leading-normal select-none" dir="rtl">
      <div className="space-y-1">
        <div className="flex justify-between items-center border-b border-black pb-1">
          <span className="font-black text-xs">{companyName} ({companyPhone})</span>
          <span className="font-mono font-bold text-xs">#{d.orderNumber}</span>
        </div>
        <div className="bg-gray-50 p-1 border text-[10px] space-y-0.5">
          <div><strong>العميل:</strong> {d.customerName} ({d.phone1}) - <strong>{d.gov}</strong></div>
          <div><strong>العنوان:</strong> {d.address}</div>
        </div>
        <div className="border p-1 text-[10px]">
          <div className="font-bold border-b pb-0.5 flex justify-between"><span>الطلب:</span><span>شحن: {d.shipping}</span></div>
          {d.products.map((p, i) => (<div key={i} className="flex justify-between"><span>{p.qty}x {p.name}</span><span>{p.lineTotal}</span></div>))}
        </div>
      </div>
      <div className="border-t-2 border-dashed border-gray-400 my-1 text-center text-[8px] text-gray-500">نسخة المندوب / العميل</div>
      <div className="space-y-1">
        <div className="flex justify-between items-center bg-black text-white p-1.5 font-black text-xs">
          <span>إجمالي التحصيل:</span><span className="font-mono text-sm">{d.total.toLocaleString()} ج.م</span>
        </div>
        <div className="text-[9.5px] bg-gray-50 p-1 border">ملاحظات: {d.notes || '—'}</div>
        <div className="flex justify-between text-[8px] text-gray-600"><span>الموظف: {d.employee} | {d.page}</span><span>{terms || 'المعاينة حق للعميل'}</span></div>
      </div>
    </div>
  );
};

// TEMPLATE 43: Governorate Focus (Quarter A4)
export const Template43_GovernorateFocus: React.FC<WaybillProps> = ({ order, companyName, companyPhone, terms }) => {
  const d = getOrderData(order);
  return (
    <div className="bg-white text-black p-2.5 border-2 border-black w-full max-w-[395px] mx-auto text-right text-xs box-border flex flex-col justify-between h-full min-h-[480px] overflow-hidden leading-normal select-none" dir="rtl">
      <div>
        <div className="bg-black text-white p-1.5 flex justify-between items-center -mx-2.5 -mt-2.5 mb-2">
          <span className="font-black text-xs">{companyName}</span>
          <span className="font-mono text-[10px]">{companyPhone}</span>
        </div>
        <div className="border-2 border-black p-2 text-center bg-yellow-200 mb-2">
          <div className="text-[9px] font-bold text-gray-700">محافظة التسليم:</div>
          <div className="text-2xl font-black text-black">{d.gov}</div>
        </div>
        <div className="flex justify-between items-center mb-2">
          <div><div className="font-bold text-sm">{d.customerName}</div><div className="font-mono font-bold text-xs">{d.phone1}</div></div>
          <div className="text-center"><Barcode value={d.orderNumber} height={24} width={1.1} /><span className="font-mono text-[10px] font-bold">#{d.orderNumber}</span></div>
        </div>
        <div className="border border-black p-1 mb-2 text-xs"><strong>العنوان:</strong> {d.address}</div>
        <div className="border border-black p-1 rounded text-xs space-y-0.5">
          <div className="font-bold border-b pb-0.5 flex justify-between"><span>المنتجات:</span><span>شحن: {d.shipping} ج.م</span></div>
          {d.products.map((p, i) => (<div key={i} className="flex justify-between py-0.2"><span>{p.qty}x {p.name}</span><span className="font-mono font-bold">{p.lineTotal}</span></div>))}
        </div>
      </div>
      <div className="space-y-1">
        <div className="bg-black text-white p-1.5 flex justify-between items-center font-black text-xs">
          <span>المطلوب:</span><span className="text-base font-mono">{d.total.toLocaleString()} ج.م</span>
        </div>
        <div className="text-[10px] bg-gray-50 p-1 border">ملاحظات: {d.notes || '—'}</div>
        <div className="flex justify-between text-[8.5px] text-gray-600"><span>الموظف: {d.employee} | {d.page}</span><span>{terms || 'المعاينة حق للعميل'}</span></div>
      </div>
    </div>
  );
};

// TEMPLATE 44: Local Courier (Quarter A4)
export const Template44_LocalCourier: React.FC<WaybillProps> = ({ order, companyName, companyPhone, terms }) => {
  const d = getOrderData(order);
  return (
    <div className="bg-white text-slate-900 p-2.5 border-2 border-cyan-600 w-full max-w-[395px] mx-auto text-right text-xs box-border flex flex-col justify-between h-full min-h-[480px] overflow-hidden leading-normal select-none" dir="rtl">
      <div>
        <div className="flex justify-between items-center border-b-2 border-cyan-600 pb-1.5 mb-2">
          <div><h1 className="font-black text-sm text-cyan-900">{companyName} LOCAL</h1><p className="text-[9px] text-gray-500">{companyPhone}</p></div>
          <div className="text-center"><Barcode value={d.orderNumber} height={24} width={1.1} /><span className="font-mono text-xs font-bold text-cyan-800">#{d.orderNumber}</span></div>
        </div>
        <div className="bg-cyan-50 p-2 rounded border border-cyan-200 mb-2 space-y-1">
          <div className="flex justify-between"><div><strong>المستلم:</strong> {d.customerName}</div><strong className="text-cyan-900">{d.gov}</strong></div>
          <div className="font-mono">📞 {d.phone1}</div>
          <div className="border-t border-cyan-200 pt-1">العنوان: {d.address}</div>
        </div>
        <div className="border border-slate-200 p-1.5 rounded mb-2 text-xs space-y-0.5">
          <div className="font-bold border-b pb-0.5 flex justify-between text-cyan-950"><span>الطلبات:</span><span>شحن: {d.shipping} ج.م</span></div>
          {d.products.map((p, i) => (<div key={i} className="flex justify-between py-0.2"><span>{p.qty}x {p.name} ({p.price})</span><span className="font-mono font-bold">{p.lineTotal} ج.م</span></div>))}
        </div>
      </div>
      <div className="space-y-1">
        <div className="bg-cyan-800 text-white p-2 rounded flex justify-between items-center font-black">
          <span>المطلوب تحصيله:</span><span className="text-base font-mono">{d.total.toLocaleString()} ج.م</span>
        </div>
        <div className="text-[10px] bg-slate-50 p-1 rounded border">ملاحظات: {d.notes || '—'}</div>
        <div className="flex justify-between text-[8.5px] text-slate-500"><span>الموظف: {d.employee} | {d.page}</span><span>{terms || 'المعاينة حق للعميل'}</span></div>
      </div>
    </div>
  );
};

// TEMPLATE 45: Slate Soft (Quarter A4)
export const Template45_SlateSoft: React.FC<WaybillProps> = ({ order, companyName, companyPhone, terms }) => {
  const d = getOrderData(order);
  return (
    <div className="bg-slate-100 text-slate-900 p-2.5 border border-slate-300 rounded-md w-full max-w-[395px] mx-auto text-right text-xs font-sans box-border flex flex-col justify-between h-full min-h-[480px] overflow-hidden leading-normal select-none" dir="rtl">
      <div>
        <div className="bg-slate-800 text-white p-2 rounded flex justify-between items-center mb-2">
          <div><h1 className="font-bold text-sm">{companyName}</h1><p className="text-[9px] text-slate-300 font-mono">{companyPhone}</p></div>
          <div className="bg-white text-black p-1 rounded text-center"><Barcode value={d.orderNumber} height={22} width={1} /><span className="font-mono text-[9px] font-bold">#{d.orderNumber}</span></div>
        </div>
        <div className="bg-white p-2 rounded border border-slate-200 mb-2 space-y-1">
          <div className="flex justify-between"><div><strong>العميل:</strong> {d.customerName}</div><strong className="text-slate-800 bg-slate-100 px-2 py-0.5 rounded">{d.gov}</strong></div>
          <div className="font-mono text-xs">📞 {d.phone1}</div>
          <div className="border-t border-slate-100 pt-1">العنوان: {d.address}</div>
        </div>
        <div className="bg-white p-1.5 rounded border border-slate-200 mb-2 space-y-0.5">
          <div className="font-bold border-b border-slate-100 pb-0.5 flex justify-between"><span>الأصناف:</span><span>شحن: {d.shipping} ج.م</span></div>
          {d.products.map((p, i) => (<div key={i} className="flex justify-between py-0.2"><span>{p.qty}x {p.name} ({p.price})</span><span className="font-mono font-bold">{p.lineTotal}</span></div>))}
        </div>
      </div>
      <div className="space-y-1">
        <div className="bg-slate-900 text-white p-2 rounded flex justify-between items-center font-bold">
          <span>المطلوب تحصيله:</span><span className="text-base font-mono text-emerald-400">{d.total.toLocaleString()} ج.م</span>
        </div>
        <div className="text-[10px] bg-white p-1 rounded border border-slate-200">ملاحظات: {d.notes || '—'}</div>
        <div className="flex justify-between text-[8.5px] text-slate-500"><span>الموظف: {d.employee} | {d.page}</span><span>{terms || 'المعاينة حق للعميل'}</span></div>
      </div>
    </div>
  );
};

// TEMPLATE 46: Cash Voucher (Quarter A4)
export const Template46_CashVoucher: React.FC<WaybillProps> = ({ order, companyName, companyPhone, terms }) => {
  const d = getOrderData(order);
  return (
    <div className="bg-white text-black p-2.5 border-2 border-dashed border-black w-full max-w-[395px] mx-auto text-right text-xs box-border flex flex-col justify-between h-full min-h-[480px] overflow-hidden leading-normal select-none" dir="rtl">
      <div>
        <div className="border-b-2 border-black pb-1.5 mb-2 text-center">
          <h1 className="font-black text-base">إيصال تحصيل نقدية • {companyName}</h1>
          <p className="text-[10px] font-mono">{companyPhone}</p>
        </div>
        <div className="flex justify-between items-center mb-2">
          <div><span className="text-[10px] text-gray-600">رقم الإيصال:</span> <strong className="font-mono text-xs">#{d.orderNumber}</strong></div>
          <Barcode value={d.orderNumber} height={24} width={1.1} />
        </div>
        <div className="border border-black p-1.5 mb-2 bg-gray-50 space-y-0.5">
          <div className="flex justify-between"><div><strong>المستلم:</strong> {d.customerName} ({d.phone1})</div><strong className="text-blue-900">{d.gov}</strong></div>
          <div><strong>العنوان:</strong> {d.address}</div>
        </div>
        <div className="border border-black p-1.5 mb-2 space-y-0.5">
          <div className="font-bold border-b pb-0.5 flex justify-between"><span>المنتجات:</span><span>شحن: {d.shipping} ج.م</span></div>
          {d.products.map((p, i) => (<div key={i} className="flex justify-between py-0.2"><span>{p.qty}x {p.name} ({p.price})</span><span className="font-mono font-bold">{p.lineTotal}</span></div>))}
        </div>
      </div>
      <div className="space-y-1">
        <div className="bg-black text-white p-2 flex justify-between items-center font-black text-xs">
          <span>المبلغ المطلوب تسليمه:</span><span className="text-base font-mono">{d.total.toLocaleString()} ج.م</span>
        </div>
        <div className="text-[10px] bg-gray-50 p-1 border border-black">ملاحظات: {d.notes || '—'}</div>
        <div className="flex justify-between text-[8.5px] text-gray-600"><span>الموظف: {d.employee} | {d.page}</span><span>{terms || 'المعاينة حق للعميل'}</span></div>
      </div>
    </div>
  );
};

// TEMPLATE 47: Safe Cargo (Quarter A4)
export const Template47_SafeCargo: React.FC<WaybillProps> = ({ order, companyName, companyPhone, terms }) => {
  const d = getOrderData(order);
  return (
    <div className="bg-white text-black p-2.5 border-4 border-yellow-500 w-full max-w-[395px] mx-auto text-right text-xs box-border flex flex-col justify-between h-full min-h-[480px] overflow-hidden leading-normal select-none" dir="rtl">
      <div>
        <div className="bg-yellow-500 text-black font-black p-1 text-center text-xs mb-2">
          🔒 طرد آمن - يرجى الفحص قبل الاستلام • {companyName}
        </div>
        <div className="flex justify-between items-center mb-2">
          <div><div className="font-bold text-sm">{companyName}</div><div className="font-mono text-[10px]">{companyPhone}</div></div>
          <div className="text-center"><Barcode value={d.orderNumber} height={24} width={1.1} /><span className="font-mono text-xs font-bold">#{d.orderNumber}</span></div>
        </div>
        <div className="border p-1.5 mb-2 bg-gray-50 space-y-0.5">
          <div className="flex justify-between"><div><strong>العميل:</strong> {d.customerName} ({d.phone1})</div><strong className="text-blue-900">{d.gov}</strong></div>
          <div><strong>العنوان:</strong> {d.address}</div>
        </div>
        <div className="border p-1.5 mb-2 space-y-0.5">
          <div className="font-bold border-b pb-0.5 flex justify-between"><span>المنتجات:</span><span>شحن: {d.shipping} ج.م</span></div>
          {d.products.map((p, i) => (<div key={i} className="flex justify-between py-0.2"><span>{p.qty}x {p.name} ({p.price})</span><span className="font-mono font-bold">{p.lineTotal}</span></div>))}
        </div>
      </div>
      <div className="space-y-1">
        <div className="bg-black text-white p-2 flex justify-between items-center font-black text-xs">
          <span>المطلوب تحصيله:</span><span className="text-base font-mono text-yellow-400">{d.total.toLocaleString()} ج.م</span>
        </div>
        <div className="text-[10px] bg-yellow-50 p-1 border border-yellow-300">ملاحظات: {d.notes || '—'}</div>
        <div className="flex justify-between text-[8.5px] text-gray-600"><span>الموظف: {d.employee} | {d.page}</span><span>{terms || 'المعاينة حق للعميل'}</span></div>
      </div>
    </div>
  );
};

// TEMPLATE 48: Multi-Store (Quarter A4)
export const Template48_MultiStore: React.FC<WaybillProps> = ({ order, companyName, companyPhone, terms }) => {
  const d = getOrderData(order);
  return (
    <div className="bg-white text-slate-900 p-2.5 border-2 border-indigo-700 w-full max-w-[395px] mx-auto text-right text-xs box-border flex flex-col justify-between h-full min-h-[480px] overflow-hidden leading-normal select-none" dir="rtl">
      <div>
        <div className="flex justify-between items-center border-b pb-1.5 mb-2">
          <div><h1 className="font-black text-sm text-indigo-900">{companyName}</h1><p className="text-[9px] text-gray-500">الصفحة: {d.page || companyName}</p></div>
          <div className="text-center"><Barcode value={d.orderNumber} height={24} width={1.1} /><span className="font-mono text-xs font-bold text-indigo-800">#{d.orderNumber}</span></div>
        </div>
        <div className="bg-indigo-50 p-2 rounded border border-indigo-200 mb-2 space-y-1">
          <div className="flex justify-between"><div><strong>المستلم:</strong> {d.customerName}</div><strong className="text-indigo-900">{d.gov}</strong></div>
          <div className="font-mono">📞 {d.phone1}</div>
          <div className="border-t border-indigo-200 pt-1">العنوان: {d.address}</div>
        </div>
        <div className="border p-1.5 rounded mb-2 text-xs space-y-0.5">
          <div className="font-bold border-b pb-0.5 flex justify-between text-indigo-950"><span>المنتجات:</span><span>شحن: {d.shipping} ج.م</span></div>
          {d.products.map((p, i) => (<div key={i} className="flex justify-between py-0.2"><span>{p.qty}x {p.name} ({p.price})</span><span className="font-mono font-bold">{p.lineTotal} ج.م</span></div>))}
        </div>
      </div>
      <div className="space-y-1">
        <div className="bg-indigo-900 text-white p-2 rounded flex justify-between items-center font-black">
          <span>إجمالي المطلوب:</span><span className="text-base font-mono">{d.total.toLocaleString()} ج.م</span>
        </div>
        <div className="text-[10px] bg-slate-50 p-1 rounded border">ملاحظات: {d.notes || '—'}</div>
        <div className="flex justify-between text-[8.5px] text-slate-500"><span>الموظف: {d.employee} | {d.page}</span><span>{terms || 'المعاينة حق للعميل'}</span></div>
      </div>
    </div>
  );
};

// TEMPLATE 49: Ultra Grid (Quarter A4)
export const Template49_UltraGrid: React.FC<WaybillProps> = ({ order, companyName, companyPhone, terms }) => {
  const d = getOrderData(order);
  return (
    <div className="bg-white text-black p-2 border-2 border-black w-full max-w-[395px] mx-auto text-right text-xs box-border flex flex-col justify-between h-full min-h-[480px] overflow-hidden leading-normal select-none" dir="rtl">
      <div className="space-y-1">
        <div className="grid grid-cols-2 border border-black text-center">
          <div className="border-l border-black p-1 font-black text-xs bg-gray-100">{companyName}</div>
          <div className="p-1 font-mono font-bold text-xs">#{d.orderNumber}</div>
        </div>
        <div className="flex justify-center my-1"><Barcode value={d.orderNumber} height={22} width={1} /></div>
        <div className="border border-black p-1 text-xs space-y-0.5 bg-gray-50">
          <div className="flex justify-between"><span>العميل: <strong>{d.customerName}</strong></span><strong className="bg-black text-white px-1">{d.gov}</strong></div>
          <div>الهاتف: {d.phone1}</div>
          <div>العنوان: {d.address}</div>
        </div>
        <table className="w-full text-xs border border-black">
          <thead className="bg-gray-200"><tr><th className="border border-black p-0.5 text-right">الصنف</th><th className="border border-black p-0.5 text-center w-8">كمية</th><th className="border border-black p-0.5 text-center w-12">السعر</th><th className="border border-black p-0.5 text-center w-14">الإجمالي</th></tr></thead>
          <tbody>{d.products.map((p, i) => (<tr key={i}><td className="border border-black p-0.5 truncate max-w-[130px]">{p.name}</td><td className="border border-black p-0.5 text-center font-bold">{p.qty}</td><td className="border border-black p-0.5 text-center font-mono">{p.price}</td><td className="border border-black p-0.5 text-center font-mono font-bold">{p.lineTotal}</td></tr>))}</tbody>
        </table>
      </div>
      <div className="space-y-1">
        <div className="border-2 border-black p-1 flex justify-between items-center font-black bg-gray-100 text-xs">
          <span>شحن: {d.shipping} | المطلوب:</span><span className="text-base font-mono">{d.total.toLocaleString()} ج.م</span>
        </div>
        <div className="text-[9.5px] bg-gray-50 border p-0.5 truncate">ملاحظات: {d.notes || '—'}</div>
        <div className="flex justify-between text-[8px] text-gray-600"><span>الموظف: {d.employee} | {d.page}</span><span>{terms || 'المعاينة حق للعميل'}</span></div>
      </div>
    </div>
  );
};

// TEMPLATE 50: Universal Ultimate (Quarter A4)
export const Template50_UniversalUltimate: React.FC<WaybillProps> = ({ order, companyName, companyPhone, companyLogo, terms }) => {
  const d = getOrderData(order);
  return (
    <div className="bg-white text-slate-900 p-2.5 md:p-3 border-2 border-slate-900 rounded-lg w-full max-w-[395px] mx-auto text-right font-sans box-border flex flex-col justify-between h-full min-h-[480px] overflow-hidden text-xs leading-normal select-none shadow-sm" dir="rtl">
      <div>
        <div className="flex justify-between items-center border-b-2 border-slate-900 pb-2 mb-2">
          <div className="flex items-center gap-1.5">
            {companyLogo ? <img src={companyLogo} alt="Logo" className="h-8 max-w-[80px] object-contain" /> : null}
            <div>
              <h1 className="font-black text-sm text-slate-900">{companyName}</h1>
              <p className="text-[9.5px] text-slate-600 font-mono">{companyPhone}</p>
            </div>
          </div>
          <div className="text-left flex flex-col items-end">
            <span className="px-2 py-0.5 bg-slate-900 text-white rounded font-bold text-[10px]">بوليصة شحن</span>
            <Barcode value={d.orderNumber} height={26} width={1.2} />
            <span className="font-mono font-black text-[10px] text-slate-800">#{d.orderNumber}</span>
          </div>
        </div>

        <div className="bg-slate-50 p-2 rounded-md border border-slate-300 mb-2 space-y-1">
          <div className="flex justify-between items-center">
            <div><span className="text-slate-500 text-[10px]">المستلم:</span> <strong className="text-sm text-slate-900">{d.customerName}</strong></div>
            <strong className="text-xs text-slate-900 bg-amber-300 px-2.5 py-0.5 rounded border border-slate-400 font-black">{d.gov}</strong>
          </div>
          <div className="text-slate-800 font-mono text-[11px]">📞 {d.phone1} {d.phone2 ? ` / ${d.phone2}` : ''}</div>
          <div className="border-t border-slate-200 pt-1 text-[11px] text-slate-800">
            <span className="text-slate-500">العنوان: </span><span className="font-medium">{d.address}</span>
          </div>
        </div>

        <div className="rounded border border-slate-300 overflow-hidden mb-2">
          <table className="w-full text-xs">
            <thead className="bg-slate-800 text-white">
              <tr>
                <th className="py-1 px-1.5 text-right font-bold">الصنف / المنتجات</th>
                <th className="py-1 px-1.5 text-center w-9 font-bold">الكمية</th>
                <th className="py-1 px-1.5 text-center w-12 font-bold">السعر</th>
                <th className="py-1 px-1.5 text-left w-16 font-bold">الإجمالي</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {d.products.map((p, i) => (
                <tr key={i} className="hover:bg-slate-50">
                  <td className="py-1 px-1.5 font-bold truncate max-w-[150px]">{p.name} {p.variant && <span className="text-[10px] text-slate-500 font-normal">({p.variant})</span>}</td>
                  <td className="py-1 px-1.5 text-center font-bold">{p.qty}</td>
                  <td className="py-1 px-1.5 text-center font-mono">{p.price}</td>
                  <td className="py-1 px-1.5 text-left font-mono font-bold text-slate-900">{p.lineTotal.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="space-y-1.5">
        <div className="flex justify-between items-center bg-slate-900 text-white p-2 rounded-md text-xs">
          <div>
            <div className="text-[10px] text-slate-300">الشحن: {d.shipping} ج.م | الصافي المطلوب:</div>
            <div className="text-base font-black font-mono text-emerald-400">{d.total.toLocaleString()} <span className="text-xs font-normal text-white">ج.م</span></div>
          </div>
          <div className="text-left text-[10px] text-slate-300">
            <div>الموظف: {d.employee || 'Admin'}</div>
            <div>البيدج: {d.page || companyName}</div>
          </div>
        </div>

        <div className="text-[10px] bg-slate-50 p-1 rounded border border-slate-300 text-slate-800 truncate">
          <strong>ملاحظات: </strong>{d.notes || 'لا توجد ملاحظات خاصة'}
        </div>

        <div className="text-[8.5px] text-slate-600 text-center border-t border-slate-300 pt-0.5 leading-tight">
          {terms || 'المعاينة حق للعميل قبل الاستلام. يرجى التأكد من الشحنة.'}
        </div>
      </div>
    </div>
  );
};
// ─────────────────────────────────────────────────────────────────────────────
// UNIVERSAL TEMPLATE SWITCHER
// ─────────────────────────────────────────────────────────────────────────────
export const UniversalWaybill: React.FC<WaybillProps> = (props) => {
  const tId = Number(props.templateId || getSelectedTemplateId());
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
}> = ({ orders, companyName, companyPhone, companyAddress, companyLogo, terms, templateId, users }) => {
  const compName = companyName || localStorage.getItem('Dragon_company_name') || 'اسم الشركة';
  const compPhone = companyPhone || localStorage.getItem('Dragon_company_phone') || '';
  const compAddr = companyAddress || localStorage.getItem('Dragon_company_address') || '';
  const compLogo = companyLogo || (typeof window !== 'undefined' ? (localStorage.getItem('Dragon_company_logo_url') || localStorage.getItem('Dragon_company_logo')) : null) || assetUrl('Dragon.png');
  const compTerms = terms || localStorage.getItem('Dragon_company_terms') || 'المعاينة حق للعميل قبل الاستلام.';
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
const Template51_CustomDragDrop: React.FC<WaybillProps> = (props) => {
  const { order, companyName, companyPhone, terms, companyLogo } = props;
  const d = getOrderData(order);
  
  let customTemplate: any = null;
  try {
    const saved = localStorage.getItem('Dragon_advanced_waybill_template');
    if (saved) {
      customTemplate = JSON.parse(saved);
    }
  } catch (e) {
    console.error('Failed to parse custom waybill template', e);
  }

  if (!customTemplate || !customTemplate.items || !Array.isArray(customTemplate.items)) {
    return <Template1_Classic {...props} />;
  }

  const items = customTemplate.items;

  const resolveDynamicText = (dynamicKey?: string) => {
    switch(dynamicKey) {
      case 'companyName': return companyName;
      case 'companyPhone': return companyPhone;
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
    const { type, dynamicKey, content, style, width, height, src } = item;
    
    if (type === 'barcode') {
      return (
        <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <Barcode value={d.orderNumber} height={Math.max(20, (parseInt(height) || 40) - 15)} width={1.5} />
          {style.fontSize && style.fontSize > 0 && <span style={{ fontSize: style.fontSize, marginTop: 2 }}>{d.orderNumber}</span>}
        </div>
      );
    }
    
    if (type === 'qr') {
      return (
        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4px' }}>
          <QRCode value={`https://track.dragon.com/${d.orderNumber}`} size={Math.min(parseInt(width as string) || 80, parseInt(height as string) || 80) - 10} />
        </div>
      );
    }

    if (type === 'logo') {
      return (
        <img src={companyLogo || ''} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
      );
    }

    if (type === 'image' && src) {
      return (
        <img src={src} alt="Uploaded" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
      );
    }
    
    if (type === 'table') {
      return (
        <table style={{ width: '100%', height: '100%', borderCollapse: 'collapse', fontSize: style.fontSize }}>
          <thead>
            <tr style={{ backgroundColor: style.backgroundColor || '#f1f5f9' }}>
              <th style={{ padding: '4px', border: `1px solid ${style.borderColor}`, textAlign: 'right' }}>المنتج</th>
              <th style={{ padding: '4px', border: `1px solid ${style.borderColor}`, textAlign: 'center', width: '30px' }}>الكمية</th>
              <th style={{ padding: '4px', border: `1px solid ${style.borderColor}`, textAlign: 'center', width: '50px' }}>الإجمالي</th>
            </tr>
          </thead>
          <tbody>
            {d.products.map((p, idx) => (
              <tr key={idx}>
                <td style={{ padding: '4px', border: `1px solid ${style.borderColor}` }}>{p.name} {p.variant && `(${p.variant})`}</td>
                <td style={{ padding: '4px', border: `1px solid ${style.borderColor}`, textAlign: 'center' }}>{p.qty}</td>
                <td style={{ padding: '4px', border: `1px solid ${style.borderColor}`, textAlign: 'center' }}>{p.lineTotal}</td>
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

    return (
      <div style={{ width: '100%', height: '100%', whiteSpace: 'pre-wrap', display: 'flex', alignItems: 'center', lineHeight: 1.2, justifyContent: style.textAlign === 'center' ? 'center' : style.textAlign === 'left' ? 'flex-start' : 'flex-end' }}>
        {displayContent}
      </div>
    );
  };

  return (
    <div 
      className="waybill-container print-only select-none" 
      dir="rtl" 
      style={{ 
        width: '380px', 
        height: '530px', 
        position: 'relative', 
        background: '#fff', 
        boxSizing: 'border-box',
        overflow: 'hidden',
        pageBreakInside: 'avoid',
        breakInside: 'avoid'
      }}
    >
      {items.map((item: any) => (
        <div
          key={item.id}
          style={{
            position: 'absolute',
            left: item.x,
            top: item.y,
            width: item.width,
            height: item.height,
            backgroundColor: item.type === 'table' ? 'transparent' : item.style.backgroundColor,
            color: item.style.color,
            fontSize: item.style.fontSize,
            fontWeight: item.style.fontWeight,
            fontStyle: item.style.fontStyle,
            textAlign: item.style.textAlign,
            borderWidth: item.style.borderWidth,
            borderColor: item.style.borderColor,
            borderRadius: item.style.borderRadius,
            borderStyle: item.style.borderStyle,
            padding: item.style.padding,
            zIndex: item.style.zIndex,
            boxSizing: 'border-box',
            display: 'flex',
            alignItems: 'center'
          }}
        >
          {renderItemContent(item)}
        </div>
      ))}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// TEMPLATE 52: QUICK DESIGNER
// ─────────────────────────────────────────────────────────────────────────────
const Template52_QuickDesigner: React.FC<WaybillProps> = (props) => {
  const { order, companyName, companyPhone, terms, companyLogo } = props;
  const d = getOrderData(order);

  let quickTemplate: any = null;
  try {
    const saved = localStorage.getItem('Dragon_quick_waybill_template');
    if (saved) {
      quickTemplate = JSON.parse(saved);
    }
  } catch (e) {
    console.error('Failed to parse quick waybill template', e);
  }

  if (!quickTemplate || !quickTemplate.style || !quickTemplate.sections) {
    return <Template1_Classic {...props} />;
  }

  const { style, sections } = quickTemplate;
  const sortedSections = [...sections].sort((a: any, b: any) => a.order - b.order);

  const containerStyle: React.CSSProperties = {
    backgroundColor: style.bgColor,
    color: style.textColor,
    borderColor: style.borderColor,
    borderStyle: style.borderStyle === 'none' ? 'none' : style.borderStyle,
    borderWidth: style.borderStyle === 'none' ? '0' : style.borderWidth,
    borderRadius: style.borderRadius,
    padding: style.padding,
    fontFamily: style.fontFamily,
    width: '380px',
    height: '530px',
    boxSizing: 'border-box',
    overflow: 'hidden',
    position: 'relative'
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
    <div className="waybill-container print-only select-none text-right flex flex-col gap-2" style={containerStyle} dir="rtl">
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
                <th className="p-1 text-center w-9 border" style={{ borderColor: style.borderColor }}>كمية</th>
                <th className="p-1 text-center w-12 border" style={{ borderColor: style.borderColor }}>السعر</th>
                <th className="p-1 text-center w-14 border" style={{ borderColor: style.borderColor }}>الإجمالي</th>
              </tr>
            </thead>
            <tbody>
              {d.products.map((p, i) => (
                <tr key={i} style={{ borderBottom: `1px solid ${style.borderColor}`, backgroundColor: i % 2 === 0 ? 'transparent' : `${style.primaryColor}08` }}>
                  <td className="p-1 font-bold truncate max-w-[140px] border-x" style={{ borderColor: style.borderColor }}>{p.name} {p.variant && <span className="text-[9px] opacity-60">({p.variant})</span>}</td>
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
    </div>
  );
};
