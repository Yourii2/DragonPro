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
    '٠':'0','١':'1','٢':'2','٣':'3','٤':'4','٥':'5','٦':'6','٧':'7','٨':'8','٩':'9',
    '۰':'0','۱':'1','۲':'2','۳':'3','۴':'4','۵':'5','۶':'6','۷':'7','۸':'8','۹':'9'
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
  { id: 21, name: 'بوليصة البوتيك والملابس الراقية (Suits Style)', desc: 'تصميم فخم بنمط البوتيك مع ريبون كحلي، عنوان كامل بسطر مستقل، وجدول مقاسات وألوان.' }
];

export const getSelectedTemplateId = (): number => {
  try {
    const saved = localStorage.getItem('Dragon_waybill_template');
    if (saved && !isNaN(Number(saved))) {
      const n = Number(saved);
      if (n >= 1 && n <= 21) return n;
    }
  } catch (e) {}
  return 1;
};

// ─────────────────────────────────────────────────────────────────────────────
// 21 DISTINCT QUARTER-A4 TEMPLATE RENDERERS (1/4 ورقة A4)
// ─────────────────────────────────────────────────────────────────────────────

// TEMPLATE 1: Classic Standard (Quarter A4)
export const Template1_Classic: React.FC<WaybillProps> = ({ order, companyName, companyPhone, companyAddress, companyLogo, terms }) => {
  const d = getOrderData(order);
  return (
    <div className="bg-white text-black p-2.5 md:p-3 border-2 border-black rounded-sm w-full max-w-[395px] mx-auto text-right font-sans box-border flex flex-col justify-between h-full min-h-[480px] overflow-hidden text-xs leading-normal select-none" dir="rtl">
      <div>
        {/* Header */}
        <div className="flex justify-between items-center border-b-2 border-black pb-2 mb-2" style={{ direction: 'ltr' }}>
          <div className="w-1/4 flex flex-col items-start justify-center">
            {companyLogo ? <img src={companyLogo} alt="Logo" className="h-10 max-w-full object-contain" /> : <span className="text-sm font-black truncate">{companyName}</span>}
          </div>
          <div className="w-1/2 flex flex-col items-center justify-center">
            <Barcode value={d.orderNumber} height={32} width={1.3} />
            <span className="font-mono font-black text-xs tracking-wider mt-0.5">#{d.orderNumber}</span>
          </div>
          <div className="w-1/4 text-right" style={{ direction: 'rtl' }}>
            <h2 className="font-black text-xs truncate">{companyName}</h2>
            <p className="text-[10px] font-mono font-bold text-gray-800">{companyPhone}</p>
          </div>
        </div>

        {/* Customer & Destination Box */}
        <div className="border border-black p-2 bg-gray-50 rounded mb-2 space-y-1 text-xs">
          <div className="flex justify-between items-center">
            <div><span className="font-bold text-gray-600">العميل: </span><span className="font-black text-sm">{d.customerName}</span></div>
            <span className="font-black text-xs bg-black text-white px-2 py-0.5 rounded">{d.gov}</span>
          </div>
          <div className="flex justify-between items-center font-mono">
            <div><span className="font-bold text-gray-600 font-sans">الهاتف: </span><span className="font-bold">{d.phone1} {d.phone2 ? ` / ${d.phone2}` : ''}</span></div>
            <div className="text-[10px] text-gray-500">{d.date}</div>
          </div>
          <div className="border-t border-dashed border-gray-300 pt-1">
            <span className="font-bold text-gray-600">العنوان: </span><span className="font-semibold">{d.address}</span>
          </div>
        </div>

        {/* Product Table */}
        <table className="w-full text-xs border-collapse border border-black mb-2">
          <thead className="bg-gray-200 border-b border-black">
            <tr>
              <th className="p-1 border border-black text-right">المنتج / الصنف</th>
              <th className="p-1 border border-black text-center w-9">الكمية</th>
              <th className="p-1 border border-black text-center w-14">السعر</th>
              <th className="p-1 border border-black text-center w-16">الإجمالي</th>
            </tr>
          </thead>
          <tbody>
            {d.products.map((p, i) => (
              <tr key={i} className="border-b border-gray-300">
                <td className="p-1 border border-black font-bold truncate max-w-[150px]">{p.name} {p.variant && <span className="text-[10px] text-gray-600 font-normal">({p.variant})</span>}</td>
                <td className="p-1 border border-black text-center font-bold">{p.qty}</td>
                <td className="p-1 border border-black text-center font-mono">{p.price.toLocaleString()}</td>
                <td className="p-1 border border-black text-center font-mono font-bold">{p.lineTotal.toLocaleString()}</td>
              </tr>
            ))}
            {d.products.length > 4 && (
              <tr><td colSpan={4} className="p-1 text-center text-[10px] font-bold text-gray-600 bg-gray-50">+ {d.products.length - 4} منتجات أخرى</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Financials, Notes, Employee/Page, Terms */}
      <div className="space-y-1.5">
        <div className="flex justify-between items-center bg-gray-100 border-2 border-black p-2 rounded text-xs">
          <div><span>مصاريف الشحن: </span><span className="font-mono font-bold">{d.shipping} ج.م</span></div>
          <div className="text-right">
            <span className="font-black text-xs">المطلوب تحصيله: </span>
            <span className="font-mono font-black text-base text-blue-900 bg-blue-50 px-2 py-0.5 border border-blue-300 rounded">{d.total.toLocaleString()} ج.م</span>
          </div>
        </div>

        <div className="text-[10px] bg-gray-50 border border-gray-300 p-1 rounded font-medium">
          <strong className="text-red-700">ملاحظات: </strong>
          <span>{d.notes || 'لا توجد ملاحظات خاصة'}</span>
        </div>

        <div className="flex justify-between items-center text-[9px] text-gray-700 bg-gray-100 px-2 py-0.5 rounded border border-gray-200">
          <span>الموظف: <strong>{d.employee || 'Admin'}</strong></span>
          <span>البيدج: <strong>{d.page || companyName}</strong></span>
        </div>

        <div className="text-[8.5px] text-gray-600 text-center border-t border-gray-300 pt-0.5 leading-tight">
          {terms || 'المعاينة حق للعميل قبل الاستلام. يرجى التأكد من سلامة ومطابقة الشحنة.'}
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

  return (
    <div id="print-container" className="print-root">
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #print-container, #print-container * {
            visibility: visible !important;
          }
          #print-container {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            margin: 0;
            padding: 0;
          }
          @page {
            size: A4 portrait;
            margin: 4mm;
          }
          .print-a4-page {
            width: 100%;
            height: 288mm;
            max-height: 288mm;
            box-sizing: border-box;
            display: grid;
            grid-template-columns: 1fr 1fr;
            grid-template-rows: 1fr 1fr;
            gap: 3mm;
            page-break-inside: avoid;
            break-inside: avoid;
            page-break-after: always;
            overflow: hidden;
          }
          .print-a4-page:last-child {
            page-break-after: auto;
          }
          .quarter-a4-cell {
            width: 100%;
            height: 141mm;
            max-height: 141mm;
            box-sizing: border-box;
            overflow: hidden;
            page-break-inside: avoid;
            break-inside: avoid;
            display: flex;
            flex-direction: column;
          }
          * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>
      <div id="print-container-inner">
        {chunks.map((chunk, pageIdx) => (
          <div key={pageIdx} className="print-a4-page">
            {chunk.map((order: any, orderIdx: number) => (
              <div key={order.id || orderIdx} className="quarter-a4-cell">
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
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};
