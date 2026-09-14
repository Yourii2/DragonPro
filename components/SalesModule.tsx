import Custom12HourTimePicker from './Custom12HourTimePicker';
import React, { useState, useEffect, useMemo } from 'react';
import { API_BASE_PATH } from '../services/apiConfig';
import { assetUrl } from '../services/assetUrl';
import { Calendar, ShoppingCart, Printer, History, Search, PlusCircle, MinusCircle, UploadCloud, FileText, RefreshCcw, ClipboardPaste, MapPin, Phone, User, CheckSquare, Square, Eye, Edit, ChevronRight, AlertTriangle, AlertCircle, Lock } from 'lucide-react';
import Swal from 'sweetalert2';
import CustomSelect from './CustomSelect';
import Barcode from './Barcode';
import { PrintableOrders, PrintableContent } from './PrintableOrderCard';
interface OrdersModuleProps {
  initialView?: string;
}

// Order item used in manual/new order form and parsed orders mapping
type OrderItem = {
  id: number;
  productId: string | number | null;
  _parentId?: string;
  _color?: string;
  _size?: string;
  name?: string;
  color?: string;
  size?: string;
  qty: number;
  price: number;
  [key: string]: any;
};

type RateType = 'percent' | 'amount';

type SalesDisplayMethod = 'company' | 'sales_offices';

const normalizeSalesDisplayMethod = (value?: string | null): SalesDisplayMethod => {
  const v = (value || '').toLowerCase().trim();
  return v === 'sales_offices' ? 'sales_offices' : 'company';
};

const pickDisplayPhone = (phones: any, fallback: string): string => {
  const text = normalizeNumbers(phones || '').toString();
  const match = text.match(/\d{11}/);
  if (match && match[0]) return match[0];
  const first = text    .split(/\r?\n|,/) 
    .map(s => s.trim())
    .filter(Boolean)[0];
  return first || fallback;
};

const normalizeRateType = (value?: string | null): RateType | null => {
  const v = (value || '').toLowerCase().trim();
  if (v === 'percent' || v === 'percentage') return 'percent';
  if (v === 'amount' || v === 'fixed' || v === 'value') return 'amount';
  return null;
};

const calculateOrderTotals = (
  subtotal: number,
  shipping: number,
  discountType: RateType | null,
  discountValue: number
) => {
  const safeSubtotal = Math.max(0, Number(subtotal || 0));
  const safeShipping = Math.max(0, Number(shipping || 0));
  const safeDiscountValue = Math.max(0, Number(discountValue || 0));

  let discountAmount = 0;

  if (discountType === 'percent') discountAmount = safeSubtotal * (safeDiscountValue / 100);
  else if (discountType === 'amount') discountAmount = safeDiscountValue;
  
  if (discountAmount > safeSubtotal) discountAmount = safeSubtotal;

  const total = Math.max(0, safeSubtotal - discountAmount + safeShipping);
  return { subtotal: safeSubtotal, discountAmount, taxAmount: 0, total };
};

// Normalize Arabic-Indic and Persian numerals to Latin digits within a string
const normalizeNumbers = (input: any): string => {
  if (input === null || typeof input === 'undefined') return '';
  const s = String(input);
  // Eastern Arabic numerals (٠١٢٣٤٥٦٧٨٩) and Persian (۰۱۲۳۴۵۶۷۸۹)
  const map: Record<string,string> = {
    '٠':'0','١':'1','٢':'2','٣':'3','٤':'4','٥':'5','٦':'6','٧':'7','٨':'8','٩':'9',
    '۰':'0','۱':'1','۲':'2','۳':'3','۴':'4','۵':'5','۶':'6','۷':'7','۸':'8','۹':'9'
  };

  return s.split('').map(ch => map[ch] || ch).join('');
};

// Comprehensive Arabic Text Normalization (Alef variations, Taa Marbuta/Haa, Yaa/Alef Maksura, diacritics, spaces)
export const normalizeArabicText = (input: any): string => {
  if (input === null || typeof input === 'undefined') return '';
  let s = String(input).trim();
  // Strip Arabic diacritics / tashkeel & tatweel
  s = s.replace(/[\u0610-\u061A\u064B-\u065F\u0670\u0640]/g, '');
  // Normalize Alefs (أ, إ, آ, ٱ -> ا)
  s = s.replace(/[أإآٱ]/g, 'ا');
  // Normalize Taa Marbuta and Haa (ة -> ه)
  s = s.replace(/ة/g, 'ه');
  // Normalize Yaa and Alef Maksura (ى -> ي)
  s = s.replace(/ى/g, 'ي');
  // Normalize Waw with Hamza & Yaa with Hamza
  s = s.replace(/ؤ/g, 'و').replace(/ئ/g, 'ي');
  // Normalize numerals
  s = normalizeNumbers(s);
  // Collapse whitespaces
  s = s.replace(/\s+/g, ' ');
  return s.toLowerCase().trim();
};

// Clean numeric price / amount from any string or number representation (handles Arabic numerals and currency suffixes)
export const cleanPrice = (val: any): number => {
  if (val === null || typeof val === 'undefined' || val === '') return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  const s = normalizeNumbers(String(val || '').trim());
  const match = s.match(/(\d+(?:\.\d+)?)/);
  if (match) {
    const n = parseFloat(match[1]);
    return isNaN(n) ? 0 : n;
  }
  const num = Number(s.replace(/[^0-9.-]+/g, ''));
  return isNaN(num) ? 0 : num;
};

export const matchProductAndVariant = (
  rawName: string,
  rawColor: string,
  rawSize: string,
  existingProducts: any[]
): {
  matchedVariant: any | null;
  productId: number | string | null;
  missingProduct: boolean;
  missingProductMsg: string;
  missingColor: boolean;
  missingColorMsg: string;
  missingSize: boolean;
  missingSizeMsg: string;
  availableColors: string[];
  availableSizes: string[];
  autoColor?: string;
  autoSize?: string;
} => {
  const normName = normalizeArabicText(rawName);
  const normColor = normalizeArabicText(rawColor);
  const normSize = normalizeArabicText(rawSize);

  if (!normName) {
    return {
      matchedVariant: null,
      productId: null,
      missingProduct: true,
      missingProductMsg: 'اسم المنتج غير محدد',
      missingColor: false,
      missingColorMsg: '',
      missingSize: false,
      missingSizeMsg: '',
      availableColors: [],
      availableSizes: []
    };
  }

  // 1. Find all product variants belonging to this product
  // A) Exact normalized name match
  let productVariants = (existingProducts || []).filter((ep: any) => {
    if (!ep || !ep.name) return false;
    return normalizeArabicText(ep.name) === normName;
  });

  // B) Fallback: Substring/contains match
  if (productVariants.length === 0) {
    productVariants = (existingProducts || []).filter((ep: any) => {
      if (!ep || !ep.name) return false;
      const epn = normalizeArabicText(ep.name);
      return epn.includes(normName) || normName.includes(epn);
    });
  }

  // If product name completely not found in database
  if (productVariants.length === 0) {
    return {
      matchedVariant: null,
      productId: null,
      missingProduct: true,
      missingProductMsg: `المنتج "${rawName}" غير مسجل في قاعدة البيانات`,
      missingColor: false,
      missingColorMsg: '',
      missingSize: false,
      missingSizeMsg: '',
      availableColors: [],
      availableSizes: []
    };
  }

  // Product is FOUND!
  // Extract all available colors and sizes for this product
  const availableColors = Array.from(
    new Set(
      productVariants
        .map((v: any) => (v.color || '').toString().trim())
        .filter(Boolean)
    )
  );

  const availableSizes = Array.from(
    new Set(
      productVariants
        .map((v: any) => (v.size || '').toString().trim())
        .filter(Boolean)
    )
  );

  let autoColor = '';
  let autoSize = '';
  let checkColor = normColor;
  let checkSize = normSize;

  if (!normColor && availableColors.length === 1) {
    autoColor = availableColors[0];
    checkColor = normalizeArabicText(autoColor);
  }
  if (!normSize && availableSizes.length === 1) {
    autoSize = availableSizes[0];
    checkSize = normalizeArabicText(autoSize);
  }

  // Validate Color
  let missingColor = false;
  let missingColorMsg = '';
  if (checkColor !== '') {
    if (availableColors.length > 0) {
      const colorFound = availableColors.some(
        c => normalizeArabicText(c) === checkColor
      );
      if (!colorFound) {
        missingColor = true;
        missingColorMsg = `اللون "${rawColor}" غير متوفر (المسجل: ${availableColors.join('، ')})`;
      }
    }
  } else if (availableColors.length > 1) {
    missingColor = true;
    missingColorMsg = `لم يتم تحديد لون (المسجل: ${availableColors.join('، ')})`;
  }

  // Validate Size
  let missingSize = false;
  let missingSizeMsg = '';
  if (checkSize !== '') {
    if (availableSizes.length > 0) {
      const sizeFound = availableSizes.some(
        s => normalizeArabicText(s) === checkSize
      );
      if (!sizeFound) {
        missingSize = true;
        missingSizeMsg = `المقاس "${rawSize}" غير متوفر (المسجل: ${availableSizes.join('، ')})`;
      }
    }
  } else if (availableSizes.length > 1) {
    missingSize = true;
    missingSizeMsg = `لم يتم تحديد مقاس (المسجل: ${availableSizes.join('، ')})`;
  }

  // Pick best matching variant:
  // 1. Both color and size match
  let matchedVariant = productVariants.find((v: any) => {
    const vc = normalizeArabicText(v.color);
    const vs = normalizeArabicText(v.size);
    const colorOk = checkColor === '' || vc === checkColor;
    const sizeOk = checkSize === '' || vs === checkSize;
    return colorOk && sizeOk;
  });

  // 2. Color matches, any size
  if (!matchedVariant && checkColor !== '') {
    matchedVariant = productVariants.find((v: any) => normalizeArabicText(v.color) === checkColor);
  }

  // 3. Size matches, any color
  if (!matchedVariant && checkSize !== '') {
    matchedVariant = productVariants.find((v: any) => normalizeArabicText(v.size) === checkSize);
  }

  // 4. Default to first variant of this product
  if (!matchedVariant) {
    matchedVariant = productVariants[0] || null;
  }

  return {
    matchedVariant,
    productId: matchedVariant ? matchedVariant.id : null,
    missingProduct: false,
    missingProductMsg: '',
    missingColor,
    missingColorMsg,
    missingSize,
    missingSizeMsg,
    availableColors,
    availableSizes,
    autoColor,
    autoSize
  };
};

export const parseOrderProductLine = (
  rawLine: string,
  existingProductsList: any[] = []
): {
  name: string;
  color: string;
  size: string;
  quantity: number;
  price: string;
  total: string;
} => {
  let line = (rawLine || '').trim().replace(/^(?:-|\*|\d+\.?\s*-?)\s*/, '');
  line = normalizeNumbers(line);

  let quantity = 1;
  let price = '0';
  let size = '';
  let color = '';
  let name = '';

  // 1. Extract Quantity: e.g. "الكمية 1" / "الكميه: 2" / "عدد 3" / leading "1 "
  const qtyMatch = line.match(/(?:الكميه|الكمية|العدد|عدد|كمية|كميه)\s*[:=]?\s*(\d+)/i);
  if (qtyMatch) {
    quantity = parseInt(qtyMatch[1], 10) || 1;
    line = line.replace(qtyMatch[0], ' ').trim();
  } else {
    const leadQty = line.match(/^(\d+)\s+/);
    if (leadQty) {
      quantity = parseInt(leadQty[1], 10) || 1;
      line = line.substring(leadQty[0].length).trim();
    }
  }

  // 2. Extract Price with explicit keyword: e.g. "السعر 250" / "سعر: 250"
  const priceMatch = line.match(/(?:السعر|سعر|price)\s*[:=]?\s*(\d+(?:\.\d+)?)\s*(?:ج\.?م?|جنيه|egp|le)?/i);
  if (priceMatch) {
    price = priceMatch[1];
    line = line.replace(priceMatch[0], ' ').trim();
  }

  // 3. Extract Size BEFORE trailing price to prevent stealing numeric sizes (e.g. مقاس 2, مقاس 4, حجم 38)
  const sizeMatch = line.match(/(?:المقاس|مقاس|الحجم|حجم|size)\s*[:=]?\s*([^\s,;]+)/i);
  if (sizeMatch) {
    size = sizeMatch[1].trim();
    line = line.replace(sizeMatch[0], ' ').trim();
  }

  // 4. Extract Color: e.g. "اللون اسود" / "لون: أبيض" / "اللون كاروهات"
  const colorKeyMatch = line.match(/(?:اللون|لون|color)\s*[:=]?\s*([^\s,;]+(?:\s+[^\s,;]+)?)/i);
  if (colorKeyMatch) {
    color = colorKeyMatch[1].trim();
    line = line.replace(colorKeyMatch[0], ' ').trim();
  }

  // 5. Extract Trailing Price if price was not explicitly specified with keyword
  if (price === '0' || !price) {
    const trailPrice = line.match(/\s+(\d+(?:\.\d+)?)\s*(?:ج\.?م?|جنيه|egp|le)?\s*$/i);
    if (trailPrice) {
      price = trailPrice[1];
      line = line.substring(0, line.length - trailPrice[0].length).trim();
    }
  }

  // 6. Extract Name: e.g. "الاسم دبدوب" / "اسم المنتج: سلوبته" / "اسم ..."
  const nameMatch = line.match(/(?:اسم\s+المنتج|الاسم|اسم|المنتج)\s*[:=]?\s*(.+)/i);
  if (nameMatch) {
    name = nameMatch[1].trim();
  } else {
    name = line.trim();
  }

  // 6. If color was not found via "اللون" keyword, detect from known colors
  if (!color && name) {
    const knownColors = new Set<string>([
      'اسود', 'أسود', 'ابيض', 'أبيض', 'احمر', 'أحمر', 'ازرق', 'أزرق', 'اخضر', 'أخضر',
      'اصفر', 'أصفر', 'بني', 'بنى', 'رمادي', 'رمادى', 'وردي', 'وردى', 'كحلي', 'كحلى',
      'بيج', 'هافان', 'جملي', 'جملى', 'كاروهات', 'مستردة', 'مسترده', 'نبيتي', 'نبيتى',
      'موف', 'زيتي', 'زيتى', 'رصاصي', 'رصاصى', 'بترولي', 'بترولى', 'فوشيا', 'تركواز',
      'سيمون', 'ليموني', 'ليمونى', 'كشمير', 'أوف وايت', 'اوف وايت', 'جنزاري', 'جنزارى'
    ]);
    if (Array.isArray(existingProductsList)) {
      existingProductsList.forEach(p => {
        if (p.color && typeof p.color === 'string') {
          const c = p.color.trim();
          if (c) knownColors.add(c);
        }
      });
    }

    const sortedColors = Array.from(knownColors).sort((a, b) => b.length - a.length);
    for (const c of sortedColors) {
      const normC = normalizeArabicText(c);
      const words = name.split(/\s+/);
      const cWords = c.split(/\s+/);
      if (cWords.length === 1) {
        const foundWordIdx = words.findIndex(w => normalizeArabicText(w) === normC);
        if (foundWordIdx !== -1) {
          color = words[foundWordIdx];
          words.splice(foundWordIdx, 1);
          name = words.join(' ').trim();
          break;
        }
      } else {
        const normName = normalizeArabicText(name);
        if (normName.includes(normC)) {
          color = c;
          const reg = new RegExp(c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
          name = name.replace(reg, ' ').replace(/\s+/g, ' ').trim();
          break;
        }
      }
    }
  }

  name = name.replace(/^[:\-–—\s]+|[:\-–—\s]+$/g, '').trim();

  return {
    name: name || rawLine.trim(),
    color: color || '',
    size: size || '',
    quantity: quantity > 0 ? quantity : 1,
    price: price || '0',
    total: (Number(price || 0) * (quantity > 0 ? quantity : 1)).toString()
  };
};

// Recompute prices and totals for a single parsed order consistently
export const recalcParsedOrderData = (po: any, existingProductsList: any[] = []): any => {
  const preferredKeys = ['sale_price','salePrice','sellingPrice','selling_price','price','cost','retail_price','retailPrice','default_price','amount','value'];

  // 1. Raw values extracted or previously recorded
  const rawPrice = po.rawPrice !== undefined && po.rawPrice !== null ? cleanPrice(po.rawPrice) : (po.parsedSubtotal !== undefined ? cleanPrice(po.parsedSubtotal) : cleanPrice(po.price));
  const rawShipping = po.rawShipping !== undefined && po.rawShipping !== null ? cleanPrice(po.rawShipping) : (po.parsedShipping !== undefined ? cleanPrice(po.parsedShipping) : cleanPrice(po.shipping || po.shippingCost));
  const rawTotal = po.rawTotal !== undefined && po.rawTotal !== null ? cleanPrice(po.rawTotal) : (po.parsedTotal !== undefined ? cleanPrice(po.parsedTotal) : cleanPrice(po.total));

  // 2. Resolve product lines
  let products = (po.products || []).map((p: any) => {
    let resolvedPrice = cleanPrice(p.price);
    const quantity = Number(p.quantity || p.qty || 1) || 1;

    // Validation & matching
    const validation = matchProductAndVariant(p.name, p.color, p.size, existingProductsList);

    // Auto-fill price only when line has no price (0)
    if (resolvedPrice === 0) {
      if (validation.matchedVariant) {
        resolvedPrice = cleanPrice(validation.matchedVariant.sale_price || validation.matchedVariant.price);
      }
      if (resolvedPrice === 0 && (p.productId || validation.productId)) {
        const prodId = p.productId || validation.productId;
        const match = (existingProductsList || []).find((ep: any) => Number(ep.id) === Number(prodId));
        if (match) {
          for (const k of preferredKeys) {
            if (match[k] !== undefined && match[k] !== null) {
              const num = cleanPrice(match[k]);
              if (num > 0) { resolvedPrice = num; break; }
            }
          }
        }
      }
    }

    const finalColor = p.color || validation.autoColor || '';
    const finalSize = p.size || validation.autoSize || '';

    return {
      ...p,
      name: p.name,
      color: finalColor,
      size: finalSize,
      quantity,
      price: resolvedPrice,
      total: (resolvedPrice * quantity).toString(),
      productId: p.productId || validation.productId,
      missingProduct: validation.missingProduct,
      missingProductMsg: validation.missingProductMsg,
      missingColor: validation.missingColor,
      missingColorMsg: validation.missingColorMsg,
      missingSize: validation.missingSize,
      missingSizeMsg: validation.missingSizeMsg,
      availableColors: validation.availableColors,
      availableSizes: validation.availableSizes,
      missingPrice: resolvedPrice === 0
    };
  });

  // 3. Target subtotal from explicit rawPrice or (rawTotal - rawShipping)
  const finalShipping = rawShipping;
  let targetSubtotal = rawPrice > 0 ? rawPrice : (rawTotal > finalShipping ? rawTotal - finalShipping : 0);
  let computedSubtotal = products.reduce((s: number, p: any) => s + (cleanPrice(p.price) * Number(p.quantity || 1)), 0);

  // 3a. Handle case where moderator wrote total line price instead of unit price when quantity > 1
  if (targetSubtotal > 0 && Math.abs(computedSubtotal - targetSubtotal) > 1.0) {
    const sumAsLineTotal = products.reduce((s: number, p: any) => s + (Number(p.quantity || 1) > 1 ? cleanPrice(p.price) : (cleanPrice(p.price) * Number(p.quantity || 1))), 0);
    if (Math.abs(sumAsLineTotal - targetSubtotal) <= 1.0) {
      products = products.map((p: any) => {
        const q = Number(p.quantity || 1) || 1;
        const curP = cleanPrice(p.price);
        if (q > 1 && curP > 0) {
          const unitP = Math.round((curP / q) * 100) / 100;
          return { ...p, price: unitP, total: curP.toString(), missingPrice: false };
        }
        return p;
      });
      computedSubtotal = targetSubtotal;
    }
  }

  // 3b. If any product lines have price 0, deduce their price from the remaining target subtotal (supports both single & multi products!)
  const zeroPricedProducts = products.filter((p: any) => cleanPrice(p.price) === 0);
  if (targetSubtotal > 0 && zeroPricedProducts.length > 0) {
    const knownSubtotal = products.reduce((s: number, p: any) => s + (cleanPrice(p.price) > 0 ? cleanPrice(p.price) * Number(p.quantity || 1) : 0), 0);
    const remainingSubtotal = Math.max(0, targetSubtotal - knownSubtotal);
    const zeroTotalQty = zeroPricedProducts.reduce((sum: number, p: any) => sum + (Number(p.quantity || 1) || 1), 0);

    if (remainingSubtotal > 0 && zeroTotalQty > 0) {
      const distributedUnit = Math.round((remainingSubtotal / zeroTotalQty) * 100) / 100;
      products = products.map((p: any) => {
        if (cleanPrice(p.price) === 0) {
          const q = Number(p.quantity || 1) || 1;
          const lineTot = distributedUnit * q;
          return {
            ...p,
            price: distributedUnit,
            total: lineTot.toString(),
            missingPrice: false
          };
        }
        return p;
      });
      computedSubtotal = products.reduce((s: number, p: any) => s + (cleanPrice(p.price) * Number(p.quantity || 1)), 0);
    }
  }

  // 4. Subtotal & Shipping & Total
  let finalSubtotal = computedSubtotal > 0 ? computedSubtotal : (targetSubtotal > 0 ? targetSubtotal : 0);
  let finalTotal = rawTotal > 0 ? rawTotal : (finalSubtotal + finalShipping);

  // 5. Mismatch evaluation:
  // Discrepancy should ONLY be flagged when:
  // - rawPrice was explicitly given (> 0) and computedSubtotal > 0 and differs by > 1.00
  // - rawTotal was explicitly given (> 0) and computedSubtotal > 0 and (computedSubtotal + finalShipping) differs from rawTotal by > 1.00
  let totalsMismatch = false;
  if (rawPrice > 0 && computedSubtotal > 0 && Math.abs(computedSubtotal - rawPrice) > 1.0) {
    totalsMismatch = true;
  }
  if (rawTotal > 0 && computedSubtotal > 0 && Math.abs((computedSubtotal + finalShipping) - rawTotal) > 1.0) {
    totalsMismatch = true;
  }

  return {
    ...po,
    products,
    rawPrice,
    rawShipping,
    rawTotal,
    price: finalSubtotal,
    subTotal: finalSubtotal,
    parsedSubtotal: finalSubtotal,
    shipping: finalShipping,
    shippingCost: finalShipping,
    parsedShipping: finalShipping,
    total: finalTotal,
    parsedTotal: finalTotal,
    computedTotal: computedSubtotal,
    requiredTotal: finalTotal,
    totalsMismatch
  };
};

const parseOrderDateTime = (raw: any): string => {
  if (!raw) return '';
  const str = String(raw).trim();
  if (/^\d{4}-\d{2}-\d{2}[\sT]\d{2}:\d{2}/.test(str)) {
    const clean = str.replace('T', ' ');
    return clean.slice(0, 19);
  }
  const d = new Date(str);
  if (!isNaN(d.getTime())) {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    const ss = String(d.getSeconds()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd} ${hh}:${min}:${ss}`;
  }
  return str;
};

const formatOrderTime = (dateStr?: string | null): string => {
  if (!dateStr) return '';
  try {
    const str = String(dateStr).trim();
    const parts = str.replace('T', ' ').split(' ');
    if (parts.length >= 2) {
      const [year, month, day] = parts[0].split('-');
      const timeParts = parts[1].split(':');
      let hour = parseInt(timeParts[0] || '0', 10);
      const min = timeParts[1] || '00';
      const period = hour >= 12 ? 'م' : 'ص';
      hour = hour % 12;
      if (hour === 0) hour = 12;
      const hourDisplay = hour < 10 ? `0${hour}` : `${hour}`;
      return `${hourDisplay}:${min} ${period} - ${month}/${day}`;
    }
    const d = new Date(str);
    if (isNaN(d.getTime())) return str;
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' - ' + d.toLocaleDateString([], { month: '2-digit', day: '2-digit' });
  } catch {
    return dateStr || '';
  }
};

const OrdersModule: React.FC<OrdersModuleProps> = ({ initialView }) => {
  const [view, setView] = useState<string>(initialView || 'new-order');
  const [orderItems, setOrderItems] = useState<OrderItem[]>([{ id: 1, productId: '', color: '', size: '', qty: 1, price: 0 }]);
  const [isExistingCustomer, setIsExistingCustomer] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const currencySymbol = 'ج.م';

  // State for script import
  const [scriptText, setScriptText] = useState('');
  const [parsedOrders, setParsedOrders] = useState<any[]>([]);
  const [isParsing, setIsParsing] = useState(false);
  const [selectedOrders, setSelectedOrders] = useState<number[]>([]);
  const [ordersToPrint, setOrdersToPrint] = useState<any[] | null>(null);
  const [existingProducts, setExistingProducts] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | ''>('');
  const [newCustomer, setNewCustomer] = useState({ name: '', phone1: '', phone2: '', governorate: '', address: '' });
  const [notes, setNotes] = useState('');
  const [employee, setEmployee] = useState('');
  const [page, setPage] = useState('');
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [createSales, setCreateSales] = useState<boolean>(false);
  const [defaultWarehouseId, setDefaultWarehouseId] = useState<number | ''>('');

  // Sales tax/discount (manual order)
  const [discountType, setDiscountType] = useState<RateType>('amount');
  const [discountValue, setDiscountValue] = useState<number>(0);
  // Shipping for manual order
  const [shippingValue, setShippingValue] = useState<number>(0);

  // Sales tax/discount (import defaults)
  const [importDiscountType, setImportDiscountType] = useState<RateType>('amount');
  const [importDiscountValue, setImportDiscountValue] = useState<number>(0);
  
  // Company Settings
  const [companyNameState, setCompanyNameState] = useState<string>(localStorage.getItem('Dragon_company_name') || 'اسم الشركة');
  const [companyPhoneState, setCompanyPhoneState] = useState<string>(localStorage.getItem('Dragon_company_phone') || '01000000000');
  const [companyAddressState, setCompanyAddressState] = useState<string>(localStorage.getItem('Dragon_company_address') || '');
  const [companyTermsState, setCompanyTermsState] = useState<string>(localStorage.getItem('Dragon_company_terms') || 'المعاينة حق للعميل قبل الاستلام.');
  const [companyLogoState, setCompanyLogoState] = useState<string | null>(
    (typeof window !== 'undefined' ? (localStorage.getItem('Dragon_company_logo_url') || localStorage.getItem('Dragon_company_logo')) : null) || assetUrl('Dragon.png')
  );

  // Load company settings from server (same source as SettingsModule)
  useEffect(() => {
    (async () => {
      try {
        const resp = await fetch(`${API_BASE_PATH}/get_settings.php`);
        const jr = await resp.json().catch(() => null);
        if (jr && jr.success && jr.data) {
          const s = jr.data;
          if (s.company_name) setCompanyNameState(s.company_name);
          if (s.company_phone) setCompanyPhoneState(s.company_phone);
          if (s.company_address) setCompanyAddressState(s.company_address);
          if (s.company_terms) setCompanyTermsState(s.company_terms);
          if (s.company_logo_url) setCompanyLogoState(s.company_logo_url);
          else if (s.company_logo) setCompanyLogoState(s.company_logo);
          if (s.waybill_template) {
            localStorage.setItem('Dragon_waybill_template', String(s.waybill_template));
          }
        }
      } catch (e) { console.debug('Failed to load company settings for printing', e); }
    })();
  }, []);

  // Sales Display Settings (Company vs Sales Offices)
  const salesDisplayMethod = normalizeSalesDisplayMethod(localStorage.getItem('Dragon_sales_display_method'));
  const [salesOffices, setSalesOffices] = useState<any[]>([]);
  const [selectedSalesOfficeId, setSelectedSalesOfficeId] = useState<number | ''>('');
  const [userDefaults, setUserDefaults] = useState<any>(null);

  const selectedSalesOffice = (salesDisplayMethod === 'sales_offices' && selectedSalesOfficeId)
    ? (salesOffices.find(o => Number(o.id) === Number(selectedSalesOfficeId)) || null)
    : null;

  const defaultSalesOfficeIdRaw = userDefaults && (userDefaults.default_sales_office_id !== undefined) ? userDefaults.default_sales_office_id : null;
  const defaultSalesOfficeId = (defaultSalesOfficeIdRaw === null || typeof defaultSalesOfficeIdRaw === 'undefined') ? null : Number(defaultSalesOfficeIdRaw);
  const canChangeSalesOffice = userDefaults && typeof userDefaults.can_change_sales_office !== 'undefined' ? Boolean(userDefaults.can_change_sales_office) : true;
  const isSalesOfficeScopeNone = (defaultSalesOfficeId === -1) && !canChangeSalesOffice;

  const effectiveHeaderName = (!isSalesOfficeScopeNone && selectedSalesOffice?.name) ? selectedSalesOffice.name : companyNameState;
  const effectiveHeaderPhone = (!isSalesOfficeScopeNone && selectedSalesOffice)
    ? pickDisplayPhone(selectedSalesOffice.phones, companyPhoneState)
    : companyPhoneState;

  // Mock Data for testing (Or empty array)
  const [orders, setOrders] = useState<any[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('pending');
  const [visibleOrdersCount, setVisibleOrdersCount] = useState<number>(50);
  const [startDateFilter, setStartDateFilter] = useState<string>('');
  const [endDateFilter, setEndDateFilter] = useState<string>('');
  const [dateFilter, setDateFilter] = useState<string>('all');
  const [timeFromFilter, setTimeFromFilter] = useState<string>('');
  const [timeToFilter, setTimeToFilter] = useState<string>('');
    useEffect(() => {
    setVisibleOrdersCount(50);
  }, [statusFilter, searchTerm, startDateFilter, endDateFilter, timeFromFilter, timeToFilter, dateFilter]);
  const [reps, setReps] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);

  // Order details + lifecycle
  const [isOrderDetailsOpen, setIsOrderDetailsOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [orderTimeline, setOrderTimeline] = useState<any[]>([]);
  const [statusEditTimeline, setStatusEditTimeline] = useState<any[]>([]);
  const [orderDocuments, setOrderDocuments] = useState<any[]>([]);
  const [docType, setDocType] = useState('delivery_note');
  const [docUrl, setDocUrl] = useState('');
  const [docNotes, setDocNotes] = useState('');
  const [statusUpdate, setStatusUpdate] = useState('');
  const [statusNote, setStatusNote] = useState('');
  const [isStatusEditOpen, setIsStatusEditOpen] = useState(false);
  const [statusEditOrder, setStatusEditOrder] = useState<any>(null);
  const [statusEditValue, setStatusEditValue] = useState('');
  const [statusEditNote, setStatusEditNote] = useState('');
  const [returnFineMode, setReturnFineMode] = useState<'none' | 'fine'>('none');
  const [returnFineAmount, setReturnFineAmount] = useState('');
  const [statusUpdateRepId, setStatusUpdateRepId] = useState<string>('');
  const [statusEditRepId, setStatusEditRepId] = useState<string>('');
  // Full-order edit state (for manual edit form)
  const [editingOrderId, setEditingOrderId] = useState<number | null>(null);

  const normalizeProductGroupName = (v: any) => normalizeArabicText(v);

  const parentGroupNameById = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const p of existingProducts) {
      const pid = String((p as any).product_id || (p as any).id || '');
      if (!pid) continue;
      const groupName = normalizeProductGroupName((p as any).parent_name || (p as any).name || '');
      if (groupName) map.set(pid, groupName);
    }
    return map;
  }, [existingProducts]);

  // Derived: unique parent products for the cascade dropdown (deduped by product name)
  const parentProductsMap = React.useMemo(() => {
    const seen = new Map<string, { id: any; name: string }>();
    for (const p of existingProducts) {
      const pid = String((p as any).product_id || (p as any).id || '');
      if (!pid) continue;
      const displayName = String((p as any).parent_name || (p as any).name || '').trim();
      const groupName = normalizeProductGroupName(displayName);
      if (!groupName) continue;
      if (!seen.has(groupName)) seen.set(groupName, { id: pid, name: displayName });
    }
    return Array.from(seen.values());
  }, [existingProducts]);

  const getVariantsForSelectedParent = (selectedParentId: any) => {
    const key = String(selectedParentId || '').trim();
    if (!key) return [] as any[];
    const selectedGroup = parentGroupNameById.get(key);
    if (selectedGroup) {
      return existingProducts.filter((ep: any) =>
        normalizeProductGroupName((ep as any).parent_name || (ep as any).name || '') === selectedGroup
      );
    }
    return existingProducts.filter((ep: any) => String((ep as any).product_id || (ep as any).id) === key);
  };

  const isOrderInDateTimeRange = (
    rawDate: any,
    startDate: string,
    endDate: string,
    timeFrom: string,
    timeTo: string
  ): boolean => {
    if (!startDate && !endDate && !timeFrom && !timeTo) return true;

    const orderFullDateTime = parseOrderDateTime(rawDate);
    if (!orderFullDateTime) return true;

    const orderDateOnly = orderFullDateTime.slice(0, 10);
    const orderTimeOnly = orderFullDateTime.length >= 16 ? orderFullDateTime.slice(11, 16) : '';

    if (startDate || endDate) {
      const effectiveStart = startDate || '0000-00-00';
      const effectiveEnd = endDate || '9999-99-99';
      const fromStr = `${effectiveStart} ${timeFrom ? timeFrom + ':00' : '00:00:00'}`;
      const toStr = `${effectiveEnd} ${timeTo ? timeTo + ':59' : '23:59:59'}`;
      return orderFullDateTime >= fromStr && orderFullDateTime <= toStr;
    }

    if (timeFrom && timeTo && timeFrom !== timeTo) {
      if (timeFrom <= timeTo) {
        return orderTimeOnly >= timeFrom && orderTimeOnly <= timeTo;
      } else {
        return orderTimeOnly >= timeFrom || orderTimeOnly <= timeTo;
      }
    } else if (timeFrom) {
      return orderTimeOnly >= timeFrom;
    } else if (timeTo) {
      return orderTimeOnly <= timeTo;
    }

    return true;
  };

  const filteredOrders = useMemo(() => {
    if (!Array.isArray(orders)) return [];
    return orders.filter(o => {
      try {
        const matchesStatus = statusFilter === 'all' || (o.status || '') === statusFilter;
        if (!matchesStatus) return false;

        const phoneA = String(o.phone || o.phone1 || '');
        const phoneB = String(o.phone2 || '');
        const term = String(searchTerm || '').toLowerCase();
        const matchesSearch =
          !term ||
          (o.customerName || '').toLowerCase().includes(term) ||
          phoneA.toLowerCase().includes(term) ||
          phoneB.toLowerCase().includes(term) ||
          (o.orderNumber || '').toLowerCase().includes(term);
        if (!matchesSearch) return false;

        const rawDate = o.created_at || o.createdAt || o.date || '';
        return isOrderInDateTimeRange(rawDate, startDateFilter, endDateFilter, timeFromFilter, timeToFilter);
      } catch (err) {
        return true;
      }
    });
  }, [orders, statusFilter, searchTerm, startDateFilter, endDateFilter, timeFromFilter, timeToFilter]);

  const displayedOrders = useMemo(() => {
    return filteredOrders.slice(0, visibleOrdersCount);
  }, [filteredOrders, visibleOrdersCount]);

  const selectedOrderSubtotal = selectedOrder
    ? (selectedOrder.products || []).reduce((s: number, p: any) => s + (Number(p.price || 0) * Number(p.quantity || p.qty || 0)), 0)
    : 0;
  const selectedOrderShipping = selectedOrder ? Number(selectedOrder.shipping || selectedOrder.shippingCost || 0) : 0;
  const selectedOrderDiscountType = normalizeRateType(selectedOrder?.discountType || selectedOrder?.discount_type);
  const selectedOrderDiscountValue = Number(selectedOrder?.discountValue || selectedOrder?.discount_value || 0);
  const selectedOrderTotals = selectedOrder
    ? calculateOrderTotals(selectedOrderSubtotal, selectedOrderShipping, selectedOrderDiscountType, selectedOrderDiscountValue)
    : null;
  const selectedOrderDiscountAmount = selectedOrder
    ? (Number(selectedOrder.discountAmount || selectedOrder.discount_amount || 0) || selectedOrderTotals?.discountAmount || 0)
    : 0;
  const selectedOrderTotal = selectedOrder
    ? (Number(selectedOrder.total || 0) || selectedOrderTotals?.total || 0)
    : 0;

  const getStatusChip = (status: string) => {
    switch (status) {
      case 'pending': return <span className="bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400 px-2 py-1 rounded-lg text-[10px] font-bold">قيد الانتظار</span>;
      case 'confirmed': return <span className="bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 px-2 py-1 rounded-lg text-[10px] font-bold">مؤكد</span>;
      case 'with_rep': return <span className="bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-400 px-2 py-1 rounded-lg text-[10px] font-bold">مع المندوب</span>;
      case 'in_delivery': return <span className="bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-400 px-2 py-1 rounded-lg text-[10px] font-bold">قيد التسليم</span>;
      case 'delivered': return <span className="bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 px-2 py-1 rounded-lg text-[10px] font-bold">تم التسليم</span>;
      case 'partial': return <span className="bg-teal-100 text-teal-700 dark:bg-teal-950/60 dark:text-teal-400 px-2 py-1 rounded-lg text-[10px] font-bold">تسليم جزئي</span>;
      case 'returned': return <span className="bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400 px-2 py-1 rounded-lg text-[10px] font-bold">مرتجع</span>;
      case 'postponed': return <span className="bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-400 px-2 py-1 rounded-lg text-[10px] font-bold">مؤجل</span>;
      case 'no_answer': return <span className="bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 px-2 py-1 rounded-lg text-[10px] font-bold">لا يرد</span>;
      case 'wrong_number': return <span className="bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300 px-2 py-1 rounded-lg text-[10px] font-bold">رقم خاطئ</span>;
      case 'cancelled': case 'canceled': return <span className="bg-rose-200 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 px-2 py-1 rounded-lg text-[10px] font-bold">ملغي</span>;
      case 'closed': return <span className="bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-300 px-2 py-1 rounded-lg text-[10px] font-bold">مغلق</span>;
      default: return <span className="bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300 px-2 py-1 rounded-lg text-[10px] font-bold">{status}</span>;
    }
  };

  const getRepName = (order: any) => {
    if (!order) return null;
    const direct = order?.rep_name || order?.repName || order?.representative || (order?.rep && order.rep.name) || order?.rep_name_display || order?.rep_name_ar || null;
    if (direct) return direct;
    const repId = order?.rep_id || order?.repId || order?.representative_id || null;
    if (repId && reps && reps.length) {
      const r = reps.find((x: any) => Number(x.id) === Number(repId));
      if (r) return r.name || (r.full_name || r.name_ar || r.display_name || null);
    }
    return null;
  };

  const normalizeRepIdValue = (value: any): string => {
    const numeric = Number(value);
    return Number.isFinite(numeric) && numeric > 0 ? String(numeric) : '';
  };

  const getLastRepIdFromTimeline = (timeline: any[]): string => {
    if (!Array.isArray(timeline)) return '';
    for (const entry of timeline) {
      const repId = normalizeRepIdValue(entry?.rep_id ?? entry?.repId);
      if (repId) return repId;
    }
    return '';
  };

  const getPreferredRepIdForStatusChange = (order: any, timeline: any[] = []): string => {
    return normalizeRepIdValue(order?.rep_id ?? order?.repId) || getLastRepIdFromTimeline(timeline);
  };

  const shouldAutofillRepForDeliveredReturnedSwitch = (currentStatus: any, nextStatus: any): boolean => {
    const current = String(currentStatus || '').trim().toLowerCase();
    const next = String(nextStatus || '').trim().toLowerCase();
    return (current === 'delivered' && next === 'returned') || (current === 'returned' && next === 'delivered');
  };

  useEffect(() => {
    if (initialView) setView(initialView);
  }, [initialView]);

  // load representatives for display (used to show rep name when order only has rep_id)
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`${API_BASE_PATH}/api.php?module=users&action=getAll`);
        const jr = await r.json();
        if (jr && jr.success) {
          const all = jr.data || [];
          setUsers(all);
          setReps(all.filter((u:any) => u.role === 'representative'));
        }
      } catch (e) { console.debug('Failed to load reps', e); }
    })();
  }, []);

  useEffect(() => {
    // load existing products for import validation
    (async () => {
      try {
        const resp = await fetch(`${API_BASE_PATH}/api.php?module=products&action=getFlat`);
        const j = await resp.json();
        if (j.success) setExistingProducts(j.data || []);
      } catch (e) { console.error('Failed to load products for import validation', e); }
    })();
    // load warehouses for optional stock operations
    const loadWarehouses = async () => {
      try {
        const r = await fetch(`${API_BASE_PATH}/api.php?module=warehouses&action=getAll`);
        const jr = await r.json();
        if (jr && jr.success) setWarehouses(jr.data || []);
      } catch (e) { console.error('Failed to load warehouses', e); setWarehouses([]); }
    };
    loadWarehouses();
    // load all orders for management view
    (async () => {
      try {
        const r = await fetch(`${API_BASE_PATH}/api.php?module=orders&action=getAll`);
        const text = await r.text();
        let jr = null;
        try {
          jr = JSON.parse(text);
        } catch (pe) {
          console.error('Failed to parse orders response as JSON:', pe, 'raw response:', text);
          Swal.fire('خطأ', 'فشل تحميل الاوردرات من الخادم. راجع الكونسول للرد الخام.', 'error');
          setOrders([]);
          return;
        }
        if (jr && jr.success) setOrders(jr.data || []);
      } catch (e) { console.error('Failed to load orders', e); Swal.fire('خطأ', 'فشل تحميل الاوردرات من الخادم.'); }
    })();

    // load customers for manual order creation
    (async () => {
      try {
        const r = await fetch(`${API_BASE_PATH}/api.php?module=customers&action=getAll`);
        const jr = await r.json();
        if (jr.success) setCustomers(jr.data || []);
      } catch (e) { console.error('Failed to load customers', e); }
    })();
    // expose loader on locals (used below when opening an order)
    (window as any)._loadDragonWarehouses = async () => { await (async () => {
      try {
        const r = await fetch(`${API_BASE_PATH}/api.php?module=warehouses&action=getAll`);
        const jr = await r.json();
        if (jr && jr.success) setWarehouses(jr.data || []);
      } catch (e) { console.error('Failed to load warehouses', e); setWarehouses([]); }
    })(); };
  }, []);

  useEffect(() => {
    if (salesDisplayMethod !== 'sales_offices') return;
    (async () => {
      try {
        // load current user's defaults (for office scoping)
        try {
          const u = JSON.parse(localStorage.getItem('Dragon_user') || 'null');
          const uid = u && u.id ? Number(u.id) : 0;
          if (uid) {
            const dRes = await fetch(`${API_BASE_PATH}/api.php?module=permissions&action=getUserDefaults&user_id=${uid}`);
            const dj = await dRes.json();
            if (dj && dj.success) setUserDefaults(dj.data || null);
          }
        } catch (e) {
          // ignore
        }

        const res = await fetch(`${API_BASE_PATH}/api.php?module=sales_offices&action=getAll`);
        const j = await res.json();
        if (j.success) setSalesOffices(j.data || []);
        else setSalesOffices([]);
      } catch (e) {
        console.error('Failed to load sales offices', e);
        setSalesOffices([]);
      }
    })();
  }, [salesDisplayMethod]);

  useEffect(() => {
    if (salesDisplayMethod !== 'sales_offices') return;
    if (!userDefaults) return;

    const raw = userDefaults.default_sales_office_id;
    const defId = (raw === null || typeof raw === 'undefined') ? null : Number(raw);
    const canChange = typeof userDefaults.can_change_sales_office !== 'undefined' ? Boolean(userDefaults.can_change_sales_office) : true;

    // If locked to a specific office, preselect it.
    if (!canChange && defId && defId > 0) {
      setSelectedSalesOfficeId(defId);
    }
    // If locked to none, clear selection.
    if (!canChange && defId === -1) {
      setSelectedSalesOfficeId('');
    }
  }, [userDefaults, salesDisplayMethod]);

  const addOrderItem = () => {
    setOrderItems([...orderItems, { id: Date.now(), productId: '', _parentId: '', _color: '', _size: '', color: '', size: '', qty: 1, price: 0 }]);
  };

  // Helper: send bridge to server (best-effort)
  const _sendBridge = (matched: any, qty: number) => {
    try {
      fetch(`${API_BASE_PATH}/api.php?module=selected_product&action=set`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId: matched.id, name: matched.name || '', color: matched.color || '', size: matched.size || '', qty })
      }).catch(() => {});
    } catch (e) { /* ignore */ }
  };

  const updateOrderItemField = (id: number, field: string, value: any) => {
    setOrderItems(prev => prev.map(it => {
      if (it.id !== id) return it;
      const ia = it as any;

      // ── Cascade: parent product selected ──
      if (field === '_parentId') {
        // Check if this parent has any color variants
        const siblings = getVariantsForSelectedParent(value);
        const hasColors = siblings.some(ep => ep.color);
        const hasSizes = siblings.some(ep => ep.size);
        // If no colors and no sizes → resolve immediately to the first variant
        if (!hasColors && !hasSizes && siblings.length > 0) {
          const m = siblings[0];
          _sendBridge(m, ia.qty || 1);
          return { ...it, _parentId: value, _color: '', _size: '', productId: m.id, name: m.name || '', price: Number(m.sale_price || m.price || 0), color: '', size: '' };
        }
        return { ...it, _parentId: value, _color: '', _size: '', productId: '' as any, name: '', price: 0, color: '', size: '' };
      }

      // ── Cascade: size selected ──
      if (field === '_size') {
        const parentId = ia._parentId;
        const siblings = getVariantsForSelectedParent(parentId).filter((ep: any) => ep.size === value);
        const hasColors = siblings.some(ep => ep.color);
        if (!hasColors && siblings.length > 0) {
          const m = siblings[0];
          _sendBridge(m, ia.qty || 1);
          return { ...it, _size: value, _color: '', productId: m.id, name: m.name || '', price: Number(m.sale_price || m.price || 0), color: '', size: value };
        }
        return { ...it, _size: value, _color: '', productId: '' as any, name: '', color: '', size: value };
      }

      // ── Cascade: color selected ──
      if (field === '_color') {
        const parentId = ia._parentId;
        const size = ia._size;
        const m = getVariantsForSelectedParent(parentId).find((ep: any) =>
          (size ? ep.size === size : true) &&
          ep.color === value
        );
        if (m) {
          _sendBridge(m, ia.qty || 1);
          return { ...it, _color: value, productId: m.id, name: m.name || '', price: Number(m.sale_price || m.price || 0), color: value, size: m.size || size || '' };
        }
        return { ...it, _color: value, color: value };
      }

      // ── Legacy: direct productId set (used by editOrder to pre-populate) ──
      if (field === 'productId') {
        const pid = value ? Number(value) : '';
        const matched = existingProducts.find(ep => Number(ep.id) === Number(pid));
        if (matched) {
          _sendBridge(matched, ia.qty || 1);
          return {
            ...it,
            productId: matched.id,
            _parentId: String(matched.product_id || matched.id),
            _color: matched.color || '',
            _size: matched.size || '',
            name: matched.name || '',
            price: Number(matched.sale_price || matched.price || matched.retail_price || 0),
            color: matched.color || '',
            size: matched.size || '',
          };
        }
        return { ...it, productId: pid, _parentId: '', _color: '', _size: '' };
      }

      return { ...it, [field]: value };
    }));
  };

  const saveManualOrder = async () => {
    if (salesDisplayMethod === 'sales_offices' && !isSalesOfficeScopeNone && !selectedSalesOfficeId) {
      Swal.fire('تنبيه', 'يرجى اختيار مكتب المبيعات.', 'warning');
      return;
    }
    // build order payload similar to import structure
    let foundMissingProduct = false;
    const importedProducts = orderItems.map(it => {
      let price = Number(it.price || 0);
      // Only auto-fill from product when the user left price empty (0)
      if (it.productId && price === 0) {
        const matched = existingProducts.find(ep => Number(ep.id) === Number(it.productId));
        if (matched) {
          const preferredKeys = ['sale_price','salePrice','sellingPrice','selling_price','price','cost','retail_price','retailPrice','default_price','amount','value'];
          for (const k of preferredKeys) {
            if (matched[k] !== undefined && matched[k] !== null) {
              const num = Number(String(matched[k]).replace(/,/g, ''));
              if (!isNaN(num) && num > 0) { price = num; break; }
            }
          }
        }
      }
      if (!it.productId) {
        const val = matchProductAndVariant(it.name || '', it.color || '', it.size || '', existingProducts);
        if (val.productId) it.productId = val.productId;
        else if (val.missingProduct) foundMissingProduct = true;
      }

      return { name: it.name || '', productId: it.productId || null, quantity: Number(it.qty || 0), price, color: it.color || '', size: it.size || '' };
    });
    if (foundMissingProduct) {
      Swal.fire('خطأ', 'بعض المنتجات في الطلب اليدوي لا تطابق أي منتج موجود. عدّل أسماء المنتجات أو اختر المنتج الصحيح قبل الحفظ.', 'error');
      return;
    }

    const customerName = (newCustomer.name || '').trim();
    const phone1 = (newCustomer.phone1 || '').trim();
    const phone2 = (newCustomer.phone2 || '').trim();
    const governorateVal = (newCustomer.governorate || '').trim();
    const addr = (newCustomer.address || '').trim();

    const subtotal = importedProducts.reduce((s, p) => s + (Number(p.quantity || 0) * Number(p.price || 0)), 0);
    const totals = calculateOrderTotals(subtotal, shippingValue, discountType, discountValue);

    const orderPayload = {
      orderNumber: null,
      customerId: selectedCustomerId || null,
      customerName,
      phone: normalizeNumbers(phone1),
      phone2: normalizeNumbers(phone2),
      governorate: governorateVal,
      address: normalizeNumbers(addr),
      shipping: shippingValue,
      notes,
      employee,
      page,
      employee_raw: employee,
      page_raw: page,
      importedProducts,
      subTotal: totals.subtotal,
      total: totals.total,
      discount_type: discountType,
      discount_value: discountValue,
      sales_office_id: (salesDisplayMethod === 'sales_offices' && !isSalesOfficeScopeNone)
        ? (selectedSalesOffice?.id || selectedSalesOfficeId || null)
        : null
    };

    try {
      if (editingOrderId) {
        // Prevent saving edits to an order currently in rep custody
        const currentOrd = orders.find(o => Number(o.id) === Number(editingOrderId));
        if (currentOrd && String(currentOrd.status || '').toLowerCase().trim() === 'with_rep') {
          Swal.fire({
            icon: 'error',
            title: 'عملية غير مسموحة',
            text: 'لا يمكن حفظ التعديلات لأن هذا الاوردر حالياً في عهدة المندوب (مع المندوب). يجب استرجاعه من المندوب أولاً.',
            confirmButtonText: 'حسناً'
          });
          return;
        }

        // Update existing order
        // Ensure product lines are sent under both `products` and `importedProducts` to match different backend expectations
        const updateBody: any = { id: editingOrderId, ...orderPayload, products: importedProducts, importedProducts };
        try {
          const resp = await fetch(`${API_BASE_PATH}/api.php?module=orders&action=update`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updateBody)
          });
          const jr = await resp.json().catch(() => null);
          // expose the last update response globally for easier debugging in the browser console
          try {
            (window as any).__lastOrderUpdate = { orderId: editingOrderId, jr, updateBody };
          } catch (e) {}
          console.debug('OrdersModule: updateOrder response', { orderId: editingOrderId, jr, updateBody });
          // If developer debug flag is set in localStorage, show full server response in a modal for easier inspection
          try {
            const showResp = localStorage.getItem('Dragon_debug_show_server_response') === '1';
            if (showResp) {
              const escapeHtml = (str: string) => String(str)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;');
              Swal.fire({
                title: 'Server response (debug)',
                html: `<pre style="text-align:left; direction:ltr; white-space:pre-wrap; max-height:400px; overflow:auto">${escapeHtml(JSON.stringify(jr, null, 2))}</pre>`,
                width: 800
              });
            }
          } catch (e) { console.debug('Failed to show debug response modal', e); }
          if (jr && jr.success) {
            // Update succeeded for order metadata. Ensure product lines are persisted
            try {
              const setResp = await fetch(`${API_BASE_PATH}/api.php?module=orders&action=setItems`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: editingOrderId, products: importedProducts, shipping: orderPayload.shipping })
              });
              const setJ = await setResp.json().catch(() => null);
              if (setJ && setJ.success) {
                Swal.fire('تم الحفظ', 'تم تحديث الاوردر بنجاح.', 'success');
                const r = await fetch(`${API_BASE_PATH}/api.php?module=orders&action=getAll`);
                const jr2 = await r.json(); if (jr2 && jr2.success) setOrders(jr2.data || []);
                setEditingOrderId(null);
                setView('manage-orders');
              } else {
                console.error('setItems failed', setJ);
                Swal.fire('تحذير', 'تم تحديث بيانات الاوردر ولكن فشل حفظ خطوط المنتجات على الخادم.', 'warning');
              }
            } catch (e) {
              console.error('Failed to set items after update', e);
              Swal.fire('تحذير', 'تم تحديث بيانات الاوردر ولكن فشل حفظ خطوط المنتجات على الخادم.', 'warning');
            }
          } else {
            Swal.fire('فشل التحديث', (jr && jr.message) || 'فشل تحديث الاوردر', 'error');
          }
        } catch (e) {
          console.error('Save manual order (update) failed', e);
          Swal.fire('خطأ', 'فشل الاتصال بالخادم أثناء تحديث الاوردر.', 'error');
        }
      } else {
        // Create new order
        const resp = await fetch(`${API_BASE_PATH}/api.php?module=orders&action=create`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ orders: [orderPayload] })
        });
        const jr = await resp.json();
        if (jr.success) {
          Swal.fire('تم الحفظ', 'تم إنشاء الاوردر بنجاح.', 'success');
          // refresh orders
          const r = await fetch(`${API_BASE_PATH}/api.php?module=orders&action=getAll`);
          const jr2 = await r.json(); if (jr2.success) setOrders(jr2.data || []);
          setView('manage-orders');
        } else {
          Swal.fire('فشل الحفظ', jr.message || 'فشل إنشاء الاوردر', 'error');
        }
      }
    } catch (e) {
      console.error('Save manual order failed', e);
      Swal.fire('خطأ', 'فشل الاتصال بالخادم أثناء حفظ الاوردر.', 'error');
    }
  };

  const removeOrderItem = (id: number) => {
    setOrderItems(orderItems.filter(item => item.id !== id));
  };

  const toggleSelectAll = () => {
    if (selectedOrders.length === filteredOrders.length && filteredOrders.length > 0) {
      setSelectedOrders([]);
    } else {
      setSelectedOrders(filteredOrders.map(o => o.id));
    }
  };

  const toggleSelectOne = (orderId: number) => {
    if (selectedOrders.includes(orderId)) {
      setSelectedOrders(prev => prev.filter(id => id !== orderId));
    } else {
      setSelectedOrders(prev => [...prev, orderId]);
    }
  };

  

  const handleParseScript = () => {
    if (!scriptText.trim()) {
      Swal.fire('خطأ', 'يرجى لصق نص الاوردرات أولاً.', 'error');
      return;
    }
    setIsParsing(true);

    setTimeout(() => {
      // Normalize pasted script to avoid client-side encoding/hidden-char issues
      const normalizedText = scriptText
        .normalize && scriptText.normalize('NFKC') || scriptText
      const cleaned = normalizedText
        .replace(/\u00A0/g, ' ')      // non-breaking space
        .replace(/[\u200E\u200F\u200C\u200D]/g, '') // remove bidi/zwj chars
        .replace(/[\u0610-\u061A\u064B-\u065F]/g, '') // remove Arabic diacritics
        .replace(/\r\n/g, '\n')
        .replace(/\t/g, ' ')
        .replace(/ {2,}/g, ' ')
        .trim();

      // Flexible order blocks split (supports الاسم: / الإسم: / اسم: / إسم:)
      const orderBlocks = cleaned.split(/(?:^|\n)\s*(?:الإسم|الاسم|إسم|اسم)\s*[:=]?\s*/i).filter(block => block.trim() !== '');
      const maxId = orders.reduce((max, o) => { const id = parseInt(o.orderNumber, 10); return !isNaN(id) && id > max ? id : max; }, 0);

      const extractedOrders = orderBlocks.map((block, index) => {
          const orderData: { [key: string]: any } = { id: Date.now() + index };

          const extractField = (key: string, content: string, isMultiLine: boolean = false): string => {
              if (isMultiLine) {
                  const startRegex = new RegExp(`(?:${key}|${key.replace(/ة/g,'ه')}|${key.replace(/ه/g,'ة')})\\s*[:=]?\\s*`, 'i');
                  const startMatch = content.match(startRegex);
                  if (!startMatch) return '';
                  const startIndex = startMatch.index! + startMatch[0].length;
                  const terminatorRegex = /(?:^|\n)\s*(?:الإسم|الاسم|المحافظة|المحافظه|المنطقة|منطقة|محافظة|محافظه|العنوان|التليفون|تليفون|موبايل|الموبايل|الهاتف|عدد\s*القطع|تفاصيل\s*المنتج|تفاصيل\s*الطلب|تفاصيل\s*الاوردر|المنتجات|المنتج|السعر|سعر|الشحن|شحن|مصاريف\s*الشحن|الاجمالي|الإجمالي|الاجمالى|الموظف|موظف|مودريتور|البيدج|بيدج|الصفحة|صفحة|ملاحظات|ملاحظة|ملاحظه)\s*[:=]?/gi;
                  let endIndex = content.length;
                  let m: RegExpExecArray | null;
                  while ((m = terminatorRegex.exec(content)) !== null) {
                    if (m.index > startIndex) {
                      const termMatched = m[0].trim();
                      if (!termMatched.toLowerCase().startsWith(key.toLowerCase())) {
                        endIndex = m.index;
                        break;
                      }
                    }
                  }
                  return content.substring(startIndex, endIndex).trim();
              } else {
                  const regex = new RegExp(`(?:^|\\n)\\s*(?:${key}|${key.replace(/ة/g,'ه')}|${key.replace(/ه/g,'ة')})\\s*[:=]?\\s*([^\\r\\n]*)`, 'i');
                  const match = content.match(regex);
                  return match ? match[1].trim() : '';
              }
          };

          orderData.name = block.split('\n')[0].trim(); 
          if(orderData.name.length > 50) orderData.name = extractField('الاسم', block) || extractField('الإسم', block); 
          
          // Robust extraction for governorate: try common variants
          const getGovernorateFromBlock = (content: string) => {
            const variants = ['المحافظة', 'المحافظه', 'المنطقة', 'منطقة', 'محافظة', 'محافظه'];
            for (const v of variants) {
              const found = extractField(v, content);
              if (found) return found;
            }
            const m = content.match(/(?:المحاف\w*|محاف\w*|المنطقة|منطقة)[:\s]*([^\n]+)/i);
            return m ? m[1].trim() : '';
          };
          orderData.governorate = normalizeNumbers(getGovernorateFromBlock(block));
          orderData.address = normalizeNumbers(extractField('العنوان', block, true));

          const extractPhoneBlock = (content: string): string => {
            const phoneKeys = ['التليفون', 'تليفون', 'موبايل', 'الموبايل', 'الهاتف'];
            const phoneTerminators = ['تفاصيل المنتج', 'تفاصيل الطلب', 'المنتجات', 'السعر:', 'الشحن:', 'الاجمالي:', 'الموظف:', 'البيدج:', 'ملاحظات:', 'ملاحظة:', 'الإسم:', 'الاسم:', 'المحافظة:', 'العنوان:'];
            for (const key of phoneKeys) {
              const startRe = new RegExp(`${key}\\s*:?\\s*`);
              const m = content.match(startRe);
              if (!m) continue;
              const start = m.index! + m[0].length;
              let end = content.length;
              for (const term of phoneTerminators) {
                const ti = content.indexOf(term, start);
                if (ti !== -1 && ti < end) end = ti;
              }
              return content.substring(start, end).replace(/\n/g, ' ');
            }
            return '';
          };
          let phoneText = normalizeNumbers(extractPhoneBlock(block));
          const phones = phoneText.match(/\d{10,11}/g) || [];
          if (phones.length === 0) {
            const fallback = phoneText.match(/\d{7,}/g) || [];
            orderData.phone1 = fallback[0] || '';
            orderData.phone2 = fallback[1] || '';
          } else {
            orderData.phone1 = phones[0] || '';
            orderData.phone2 = phones[1] || '';
          }

          const rawPriceStr = extractField('السعر', block) || extractField('سعر', block);
          const rawShippingStr = extractField('الشحن', block) || extractField('شحن', block);
          const rawTotalStr = extractField('الاجمالي', block) || extractField('الإجمالي', block) || extractField('الاجمالى', block);

          orderData.rawPrice = cleanPrice(rawPriceStr);
          orderData.rawShipping = cleanPrice(rawShippingStr);
          orderData.rawTotal = cleanPrice(rawTotalStr);
          orderData.price = orderData.rawPrice > 0 ? orderData.rawPrice : '';
          orderData.shipping = orderData.rawShipping;
          orderData.total = orderData.rawTotal > 0 ? orderData.rawTotal : '';
          orderData.employee = extractField('الموظف', block) || extractField('موظف', block) || extractField('مودريتور', block);
          orderData.page = extractField('البيدج', block) || extractField('بيدج', block) || extractField('الصفحة', block);
          
          const productDetailsText = extractField('تفاصيل المنتج', block, true)
            || extractField('تفاصيل المنتجات', block, true)
            || extractField('تفاصيل الطلب', block, true)
            || extractField('تفاصيل الاوردر', block, true)
            || extractField('المنتجات', block, true)
            || extractField('المنتج', block, true);

          const rawLines = productDetailsText.split('\n').map(l => l.trim()).filter(line => line !== '');
          const productLines: string[] = [];
          let curLine = '';
          for (let i = 0; i < rawLines.length; i++) {
            const ln = rawLines[i];
            const isContinuation = /^(?:اللون|لون|المقاس|مقاس|الحجم|حجم|الخامة|خامة|كود|code|الموديل|موديل)\s*[:=]/i.test(ln);
            if (isContinuation && curLine) {
              curLine += ' ' + ln;
            } else {
              if (curLine) productLines.push(curLine.trim());
              curLine = ln;
            }
          }
          if (curLine) productLines.push(curLine.trim());

          orderData.products = productLines.map(line => {
              const parsedItem = parseOrderProductLine(line, existingProducts);
              const validation = matchProductAndVariant(parsedItem.name, parsedItem.color, parsedItem.size, existingProducts);
              let linePrice = Number(parsedItem.price) || 0;
              if (validation.matchedVariant && linePrice === 0) {
                linePrice = Number(validation.matchedVariant.sale_price || validation.matchedVariant.price || 0);
              }
              const finalColor = parsedItem.color || validation.autoColor || '';
              const finalSize = parsedItem.size || validation.autoSize || '';
              return {
                rawLine: line,
                name: parsedItem.name,
                color: finalColor,
                size: finalSize,
                quantity: parsedItem.quantity,
                price: linePrice.toString(),
                total: (linePrice * parsedItem.quantity).toString(),
                productId: validation.productId,
                missingProduct: validation.missingProduct,
                missingProductMsg: validation.missingProductMsg,
                missingColor: validation.missingColor,
                missingColorMsg: validation.missingColorMsg,
                missingSize: validation.missingSize,
                missingSizeMsg: validation.missingSizeMsg,
                availableColors: validation.availableColors,
                availableSizes: validation.availableSizes,
              };
          });
          
          const notes1 = extractField('ملاحظات', block, true) || extractField('ملاحظة', block, true) || extractField('ملاحظه', block, true);
          orderData.notes = notes1;
          orderData.orderNumber = (maxId + index + 1).toString();
          orderData.rawBlock = block;

          return orderData;
      });

      // Recalculate prices/totals for extracted orders immediately and set state
      try {
        const updated = recalcParsedOrdersArray(extractedOrders);
        setParsedOrders(updated);
      } catch (e) {
        console.error('Auto recalc failed', e);
        setParsedOrders(extractedOrders);
      }
      setIsParsing(false);
      Swal.fire('تم التحليل', `تم استخراج ${extractedOrders.length} اوردر بنجاح. تم مطابقة المنتجات واحتساب القيم تلقائياً.`, 'success');
    }, 1000);
  };

  // validate parsed orders against existing products and mark missing attributes
  useEffect(() => {
    if (!parsedOrders || parsedOrders.length === 0 || !existingProducts || existingProducts.length === 0) return;
    const validated = parsedOrders.map((o: any) => recalcParsedOrderData(o, existingProducts));

    setParsedOrders(prev => {
      try {
        const prevStr = JSON.stringify(prev || []);
        const validatedStr = JSON.stringify(validated || []);
        if (prevStr === validatedStr) return prev;
      } catch (e) {}
      return validated;
    });
  }, [existingProducts]);

  const handleConfirmImport = async () => {
    if (salesDisplayMethod === 'sales_offices' && !isSalesOfficeScopeNone && !selectedSalesOfficeId) {
      Swal.fire('تنبيه', 'يرجى اختيار مكتب المبيعات قبل الحفظ.', 'warning');
      return;
    }
    // Recalculate all parsed orders first and use the updated array for validation
    const updatedParsed = recalcAllParsedOrders();
    let newOrders: any[] = (updatedParsed || parsedOrders).map(pOrder => {
      // Preserve product-level validation state in the saved order. Backend import enhancement can be done later.
      // Group identical products by name/size/color
      const groupedMap: any = {};
      (pOrder.products || []).forEach((pp:any) => {
        const key = `${(pp.name||'').trim().toLowerCase()}|${(pp.size||'').trim().toLowerCase()}|${(pp.color||'').trim().toLowerCase()}`;
        // ✅ Only auto-fill from product when: line has no price (0)
        let linePrice = cleanPrice(pp.price);
        if (pp.productId && linePrice === 0) {
          const matched = existingProducts.find((ep:any) => Number(ep.id) === Number(pp.productId));
          if (matched) {
            const preferredKeys = ['sale_price','salePrice','sellingPrice','selling_price','price','cost','retail_price','retailPrice','default_price','amount','value'];
            for (const k of preferredKeys) {
              if (matched[k] !== undefined && matched[k] !== null) {
                const num = cleanPrice(matched[k]);
                if (num > 0) { linePrice = num; break; }
              }
            }
          }
        }

        if (!groupedMap[key]) groupedMap[key] = { name: pp.name, size: pp.size||'', color: pp.color||'', quantity: 0, productId: pp.productId || null, missingProduct: !!pp.missingProduct, missingSize: !!pp.missingSize, missingColor: !!pp.missingColor, missingPrice: false, price: linePrice };
        groupedMap[key].quantity += Number(pp.quantity || 0);
        // if any entry marks missing, keep it flagged
        groupedMap[key].missingProduct = groupedMap[key].missingProduct && pp.missingProduct ? true : (groupedMap[key].missingProduct || !!pp.missingProduct);
        groupedMap[key].missingSize = groupedMap[key].missingSize || !!pp.missingSize;
        groupedMap[key].missingColor = groupedMap[key].missingColor || !!pp.missingColor;
        if (!groupedMap[key].productId && pp.productId) groupedMap[key].productId = pp.productId;
      });
      const importedProductsArr = Object.values(groupedMap);

      return {
        id: pOrder.id,
        orderNumber: pOrder.orderNumber,
        customerName: pOrder.name,
        allowSaveAsIs: !!pOrder.allowSaveAsIs,
        phone: normalizeNumbers(pOrder.phone1 || pOrder.phone || ''),
        phone2: normalizeNumbers(pOrder.phone2 || ''),
        governorate: normalizeNumbers(pOrder.governorate || ''),
        address: normalizeNumbers(pOrder.address || ''),
        notes: pOrder.notes || '',
        employee: pOrder.employee || '',
        page: pOrder.page || '',
        employee_raw: pOrder.employee || '',
        page_raw: pOrder.page || '',
        status: 'pending',
        total: cleanPrice(pOrder.total),
        shippingCost: cleanPrice(pOrder.shipping || pOrder.shippingCost || pOrder.parsedShipping),
        subTotal: cleanPrice(pOrder.price || pOrder.subTotal || pOrder.parsedSubtotal),
        rawPrice: cleanPrice(pOrder.rawPrice),
        rawTotal: cleanPrice(pOrder.rawTotal),
        importedProducts: importedProductsArr,
        // ensure UI expects `products` field (used by manage view) to avoid render errors
        products: importedProductsArr,
        discount_type: importDiscountType,
        discount_value: importDiscountValue,
        sales_office_id: (salesDisplayMethod === 'sales_offices' && !isSalesOfficeScopeNone)
          ? (selectedSalesOffice?.id || selectedSalesOfficeId || null)
          : null
      };
    });

    if (newOrders.length > 0) {
      // 1. Check totals consistency: only flag orders where raw price or raw total actually conflicts with computed lines
      const mismatchedTotals: any[] = [];
      for (const o of newOrders) {
        const computed = (o.importedProducts || []).reduce((s:any, p:any) => s + (Number(p.quantity || 0) * cleanPrice(p.price)), 0);
        const rawSubtotal = cleanPrice(o.rawPrice);
        const rawTotal = cleanPrice(o.rawTotal);
        const shipping = cleanPrice(o.shippingCost);

        let isMismatch = false;
        if (rawSubtotal > 0 && computed > 0 && Math.abs(computed - rawSubtotal) > 0.5) {
          isMismatch = true;
        }
        if (rawTotal > 0 && computed > 0 && Math.abs((computed + shipping) - rawTotal) > 0.5) {
          isMismatch = true;
        }

        if (isMismatch) {
          mismatchedTotals.push({ order: o, rawSubtotal, shipping, rawTotal, computed });
        }
      }
      if (mismatchedTotals.length > 0) {
        const list = mismatchedTotals.map(m => (m.order.customerName || m.order.orderNumber || m.order.id)).slice(0, 10).join(', ');
        const proceed = await Swal.fire({
          title: 'تحذير: إجماليات غير مطابقة',
          html: `تم اكتشاف ${mismatchedTotals.length} اوردرات فيها اختلاف بين إجمالى الأسطر والـ"اجمالي" المُدخل: <b>${list}</b>.<br>هل تريد المتابعة وحفظ الاوردرات؟ اختر إلغاء لمراجعة وتعديل الاوردرات أولاً.`,
          icon: 'warning',
          showCancelButton: true,
          confirmButtonText: 'نعم، استمر',
          cancelButtonText: 'إلغاء، سأراجع'
        });
        if (!proceed.isConfirmed) return;
      }

      // 2. Block import only if an order contains products whose name is completely missing from DB
      const missingProductsList: { orderName: string; missingNames: string[] }[] = [];
      for (const o of newOrders) {
        const unmapped = (o.importedProducts || []).filter((p: any) => p.missingProduct);
        if (unmapped.length > 0) {
          missingProductsList.push({
            orderName: o.customerName || o.orderNumber || String(o.id),
            missingNames: unmapped.map((p: any) => p.name || 'بدون اسم')
          });
        }
      }

      if (missingProductsList.length > 0) {
        const detailsHtml = missingProductsList.slice(0, 8).map(m => 
          `<li style="margin-bottom: 4px;"><b>${m.orderName}:</b> منتجات غير مسجلة (<span style="color: #e11d48; font-weight: bold;">${m.missingNames.join('، ')}</span>)</li>`
        ).join('');
        await Swal.fire({
          title: 'خطأ: منتجات غير مسجلة بالنظام',
          html: `تم العثور على ${missingProductsList.length} اوردرات تحتوي على منتجات غير موجودة في قاعدة البيانات:<br><ul style="text-align: right; margin-top: 10px; font-size: 13px;">${detailsHtml}</ul><br>يرجى تصحيح اسم المنتج أو إضافته للمنتجات قبل الحفظ.`,
          icon: 'error',
          confirmButtonText: 'حسناً، سأراجعها'
        });
        return;
      }

      // 3. Informative check for unregistered colors or sizes
      const ordersWithUnregisteredVariants = newOrders.filter((o: any) => 
        !o.allowSaveAsIs && (o.importedProducts || []).some((p: any) => p.missingColor || p.missingSize)
      );

      if (ordersWithUnregisteredVariants.length > 0) {
        const samples = ordersWithUnregisteredVariants.slice(0, 6).map((o: any) => {
          const issues = (o.importedProducts || []).filter((p: any) => p.missingColor || p.missingSize).map((p: any) => {
            const parts = [];
            if (p.missingColor) parts.push(`اللون "${p.color}" غير مسجل`);
            if (p.missingSize) parts.push(`المقاس "${p.size}" غير مسجل`);
            return `${p.name} (${parts.join(' - ')})`;
          });
          return `<li style="margin-bottom: 4px;"><b>${o.customerName || o.orderNumber}:</b> ${issues.join(' | ')}</li>`;
        }).join('');

        const proceed = await Swal.fire({
          title: 'تنبيه: ألوان أو مقاسات غير مسجلة',
          html: `يوجد ${ordersWithUnregisteredVariants.length} اوردرات تحتوي على مقاس أو لون غير مسجل في بطاقة المنتج:<br><ul style="text-align: right; margin-top: 10px; font-size: 13px; color: #b45309;">${samples}</ul><br><b>هل تريد المتابعة واستيراد الاوردرات كما هي؟</b><br><span style="font-size: 12px; color: #64748b;">(أو اختر "إلغاء للمراجعة" لتعديلها بنقرة واحدة من الخيارات المتاحة في بطاقة كل اوردر)</span>`,
          icon: 'warning',
          showCancelButton: true,
          confirmButtonText: 'نعم، استمر واحفظ كما هي',
          cancelButtonText: 'إلغاء للمراجعة',
          confirmButtonColor: '#10b981',
          cancelButtonColor: '#64748b'
        });
        if (!proceed.isConfirmed) return;
      }
    }

    // send to backend for persistence
    try {
      const resp = await fetch(`${API_BASE_PATH}/api.php?module=orders&action=create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orders: newOrders, create_sales: createSales ? 1 : 0, default_warehouse_id: defaultWarehouseId || null })
      });
      const jr = await resp.json();
      if (jr.success) {
        setOrders(prevOrders => [...newOrders, ...prevOrders]);
        Swal.fire('تم الحفظ', `تم إنشاء ${jr.created.length || newOrders.length} اوردرات بنجاح.`, 'success');
        setParsedOrders([]);
        setScriptText('');
        setView('manage-orders');
      } else {
        Swal.fire('فشل الحفظ', jr.message || 'فشل حفظ الاوردرات على الخادم.', 'error');
      }
    } catch (e) {
      console.error('Import save failed', e);
      Swal.fire('خطأ', 'فشل الاتصال بخادم الحفظ. تم حفظ الاوردرات محلياً.', 'warning');
      setOrders(prevOrders => [...newOrders, ...prevOrders]);
      setParsedOrders([]);
      setScriptText('');
      setView('manage-orders');
    }
  };

  const addProductToParsedOrder = (orderId: number) => {
    setParsedOrders(prev => prev.map(po => {
      if (po.id !== orderId) return po;
      const updatedPo = { ...po, products: [...(po.products||[]), { name: '', quantity: 1, color: '', size: '', price: '0', productId: null, missingProduct: true, missingColor: false, missingSize: false, availableColors: [], availableSizes: [] }] };
      return recalcParsedOrderData(updatedPo, existingProducts);
    }));
  };

  const removeProductFromParsedOrder = (orderId: number, index: number) => {
    setParsedOrders(prev => prev.map(po => {
      if (po.id !== orderId) return po;
      const updatedPo = { ...po, products: po.products.filter((_:any, idx:number) => idx !== index) };
      return recalcParsedOrderData(updatedPo, existingProducts);
    }));
  };

  const removeParsedOrder = (orderId: number) => {
    setParsedOrders(prev => prev.filter(po => po.id !== orderId));
  };

  const recalcParsedOrder = (orderId: number) => {
    setParsedOrders(prev => prev.map(po => {
      if (po.id !== orderId) return po;
      const res = recalcParsedOrderData(po, existingProducts);
      const computed = Number(res.computedTotal || 0);
      const shipping = Number(res.shipping || 0);
      const newTotal = computed + shipping;
      return {
        ...res,
        price: computed,
        subTotal: computed,
        parsedSubtotal: computed,
        total: newTotal,
        parsedTotal: newTotal,
        requiredTotal: newTotal,
        rawPrice: computed,
        rawTotal: newTotal,
        totalsMismatch: false
      };
    }));
    try { Swal.fire('تم الحساب', 'تم تحديث إجماليات الاوردر بناءً على أسطر المنتجات.', 'success'); } catch (e) { /* ignore if Swal missing */ }
  };

  // Recompute prices and totals for all parsed orders and return the new array
  const recalcParsedOrdersArray = (inputArr: any[]) => {
    return (inputArr || []).map((po: any) => recalcParsedOrderData(po, existingProducts));
  };

  const recalcAllParsedOrders = () => {
    const updated = recalcParsedOrdersArray(parsedOrders || []);
    setParsedOrders(updated);
    return updated;
  };

  const allowSaveParsedOrderAsIs = (orderId: number) => {
    setParsedOrders(prev => prev.map(po => po.id === orderId ? { ...po, allowSaveAsIs: true } : po));
    try { Swal.fire('تم', 'تم وضع الاوردر للسماح بالحفظ كما هو.', 'success'); } catch (e) {}
  };

  const saveParsedOrderLine = (orderId: number, index: number) => {
    // parsedOrders already updated by updateParsedProductField; just recompute totals for the order
    recalcParsedOrder(orderId);
    try { Swal.fire('تم الحفظ', 'تم حفظ تعديل السطر وتحديث إجماليات الاوردر.', 'success'); } catch (e) {}
  };

  const editParsedOrder = (order: any) => {
    // Map parsed order into manual new-order form for full editing
    const mappedItems = (order.products || []).map((p:any, idx:number) => ({ id: Date.now() + idx, productId: p.productId || '', name: p.name || '', color: p.color || '', size: p.size || '', qty: Number(p.quantity || 1), price: Number(p.price || 0) }));
    setOrderItems(mappedItems);
    setSelectedCustomerId('');
    setNewCustomer({ name: order.customerName || order.name || '', phone1: order.phone || order.phone1 || '', phone2: order.phone2 || '', governorate: order.governorate || '', address: order.address || '' });
    setNotes(order.notes || '');
    setEmployee(order.employee_raw || order.employee || '');
    setPage(order.page_raw || order.page || '');
    setView('new-order');
  };

  const editOrder = async (order: any) => {
    // Prevent editing orders currently in rep custody (with_rep)
    const st = String(order?.status || '').toLowerCase().trim();
    if (st === 'with_rep') {
      try {
        Swal.fire({
          icon: 'warning',
          title: 'لا يمكن تعديل الاوردر',
          text: 'هذا الاوردر في عهدة المندوب حالياً (مع المندوب)، ولا يمكن تعديل بياناته أو أصنافه حتى يتم استرجاعه من المندوب أولاً.',
          confirmButtonText: 'حسناً'
        });
      } catch (e) {
        alert('لا يمكن تعديل الاوردر أثناء وجوده في عهدة المندوب');
      }
      return;
    }

    // Map a saved order into the manual new-order form for full editing
    
    // 1. Ensure we have the latest products list
    let productsList = existingProducts;
    if (!productsList || productsList.length === 0) {
      try {
        const resp = await fetch(`${API_BASE_PATH}/api.php?module=products&action=getFlat`);
        const j = await resp.json();
        if (j.success && j.data) {
          productsList = j.data;
          setExistingProducts(j.data); // Update state for future use
        }
      } catch (e) {
        console.error('Failed to load products for editOrder', e);
      }
    }

    const mappedItems = (order.products || []).map((p: any, idx: number) => {
      let productId = p.productId || p.product_id || (p.product && (p.product.id || p.product.product_id)) || p.id || '';
      let variant = productsList.find((ep: any) => Number(ep.id) === Number(productId));
      
      // If not found by id, try to match by name (fallback for imported orders)
      if (!variant && p.name) {
        const pName = String(p.name).trim().toLowerCase();
        variant = productsList.find((ep: any) => String(ep.name || '').trim().toLowerCase() === pName);
        if (variant) productId = variant.id;
      }

      return {
        id: Date.now() + idx + Math.random(),
        productId: productId || '',
        _parentId: variant ? String(variant.product_id || '') : '',
        _color: variant?.color || p.color || '',
        _size: variant?.size || p.size || '',
        name: (variant && variant.name) ? variant.name : (p.name || ''),
        color: variant?.color || p.color || '',
        size: variant?.size || p.size || '',
        qty: Number(p.quantity || p.qty || 1),
        price: Number(p.price || p.unit_price || (variant ? (variant.sale_price || variant.price) : 0) || 0),
      };
    });

    setOrderItems(mappedItems.length ? mappedItems : [{ id: Date.now(), productId: '', _parentId: '', _color: '', _size: '', color: '', size: '', qty: 1, price: 0 }]);
    
    // customer
    if (order.customerId || order.customer_id) setSelectedCustomerId(order.customerId || order.customer_id);
    else setSelectedCustomerId('');
    
    setNewCustomer({ 
      name: order.customerName || order.name || '', 
      phone1: order.phone || order.phone1 || '', 
      phone2: order.phone2 || '', 
      governorate: order.governorate || '', 
      address: order.address || '' 
    });
    
    setNotes(order.notes || '');
    setEmployee(order.employee_raw || order.employee || '');
    setPage(order.page_raw || order.page || '');
    
    // discounts
    setDiscountType((order.discount_type || order.discountType) ? (normalizeRateType(order.discount_type || order.discountType) as RateType) : 'amount');
    setDiscountValue(Number(order.discount_value || order.discountValue || 0));

    // shipping
    setShippingValue(Number(order.shipping || order.shippingCost || order.shipping_fees || 0));
    
    // warehouses / sales office
    if (order.sales_office_id || order.salesOfficeId) setSelectedSalesOfficeId(order.sales_office_id || order.salesOfficeId);
    else setSelectedSalesOfficeId('');
    
    setDefaultWarehouseId(order.warehouse_id || order.warehouseId || '');
    
    // mark editing id and switch to form
    setEditingOrderId(Number(order.id));
    
    // ensure warehouses/options are loaded before showing form
    if ((window as any)._loadDragonWarehouses) {
      (window as any)._loadDragonWarehouses().finally(() => setView('new-order'));
    } else {
      setView('new-order');
    }
  };

  const updateParsedProductField = (orderId: number, index: number, field: string, value: any) => {
    setParsedOrders(prev => prev.map(po => {
      if (po.id !== orderId) return po;
      const products = (po.products || []).map((pp: any, idx: number) => {
        if (idx !== index) return pp;
        return { ...pp, [field]: value };
      });
      return recalcParsedOrderData({ ...po, products }, existingProducts);
    }));
  };

  const handlePrint = (ordersToPrint: any[]) => {
    setOrdersToPrint(ordersToPrint);
  };

  useEffect(() => {
    if (ordersToPrint) {
      const timer = setTimeout(() => {
        window.print();
        setTimeout(() => setOrdersToPrint(null), 1000); 
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [ordersToPrint]);

  const refreshOrdersList = async () => {
    try {
      const r = await fetch(`${API_BASE_PATH}/api.php?module=orders&action=getAll`);
      const jr = await r.json();
      if (jr && jr.success) {
        const fetched = jr.data || [];
        setOrders(fetched);
        // Automatically normalize Arabic/Persian numerals in phone fields and persist changes
        (async () => {
          try {
            const toUpdate: any[] = [];
            for (const o of fetched) {
              const combined = `${o.phone || ''}\n${o.phone1 || ''}\n${o.phone2 || ''}`;
              const newPrimary = pickDisplayPhone(combined, '');
              const newPhone2 = normalizeNumbers(o.phone2 || '');
              const currentPrimaryNormalized = normalizeNumbers(o.phone || '');
              // If primary changed (after normalization) or phone2 changed, schedule update
              if ((newPrimary && newPrimary !== currentPrimaryNormalized) || (newPhone2 && newPhone2 !== normalizeNumbers(o.phone2 || ''))) {
                const upd: any = { id: o.id };
                if (newPrimary && newPrimary !== currentPrimaryNormalized) upd.phone = newPrimary;
                if (newPhone2 && newPhone2 !== normalizeNumbers(o.phone2 || '')) upd.phone2 = newPhone2;
                toUpdate.push(upd);
              }
            }
            if (toUpdate.length > 0) {
              console.log('Normalizing phone digits for', toUpdate.length, 'orders');
              let applied = 0;
              for (const u of toUpdate) {
                try {
                  const res = await fetch(`${API_BASE_PATH}/api.php?module=orders&action=update`, {
                    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(u)
                  });
                  const jr2 = await res.json();
                  if (jr2 && jr2.success) applied++;
                } catch (e) {
                  console.error('Failed to persist normalized phone for order', u.id, e);
                }
              }
              if (applied > 0) {
                // refresh once more to reflect persisted normalized values
                const r2 = await fetch(`${API_BASE_PATH}/api.php?module=orders&action=getAll`);
                const jr3 = await r2.json();
                if (jr3 && jr3.success) setOrders(jr3.data || []);
              }
            }
          } catch (e) {
            console.error('Auto-normalize failed', e);
          }
        })();
        try {
          const saved = JSON.parse(localStorage.getItem('OrdersModule_selectedOrders') || '[]');
          if (Array.isArray(saved) && saved.length > 0) {
            // restore only ids that still exist in fetched orders
            const valid = saved.map((s:any) => Number(s)).filter((id:any) => fetched.find((o:any) => Number(o.id) === Number(id)));
            if (valid.length > 0) setSelectedOrders(valid);
          }
        } catch (e) {
          // ignore JSON parse errors
        }
      }
    } catch (e) {
      console.error('Failed to refresh orders list', e);
    }
  };

  // persist selectedOrders so printing selection survives page refresh
  useEffect(() => {
    try {
      localStorage.setItem('OrdersModule_selectedOrders', JSON.stringify(selectedOrders || []));
    } catch (e) {}
  }, [selectedOrders]);

  const openOrderDetails = async (order: any) => {
    setSelectedOrder(order);
    setIsOrderDetailsOpen(true);
    setOrderTimeline([]);
    setOrderDocuments([]);
    setStatusUpdate('');
    setStatusNote('');
    setStatusUpdateRepId(getPreferredRepIdForStatusChange(order));
    try {
      const [tRes, dRes] = await Promise.all([
        fetch(`${API_BASE_PATH}/api.php?module=orders&action=getTimeline&id=${order.id}`),
        fetch(`${API_BASE_PATH}/api.php?module=orders&action=getDocuments&id=${order.id}`)
      ]);
      const tJson = await tRes.json();
      const dJson = await dRes.json();
      if (tJson.success) setOrderTimeline(tJson.data || []);
      if (dJson.success) setOrderDocuments(dJson.data || []);
    } catch (e) {
      console.error('Failed to load order details', e);
    }
  };

  // Ensure warehouses are available when editing an order
  const ensureWarehousesLoaded = async () => {
    if (!warehouses || warehouses.length === 0) {
      try {
        const r = await fetch(`${API_BASE_PATH}/api.php?module=warehouses&action=getAll`);
        const jr = await r.json();
        if (jr && jr.success) setWarehouses(jr.data || []);
      } catch (e) { console.error('Failed to reload warehouses', e); }
    }
  };

  const addOrderDocument = async () => {
    if (!selectedOrder || !docUrl.trim()) {
      Swal.fire('بيانات ناقصة', 'يرجى إدخال رابط المستند.', 'warning');
      return;
    }
    try {
      const res = await fetch(`${API_BASE_PATH}/api.php?module=orders&action=addDocument`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          order_id: selectedOrder.id,
          doc_type: docType,
          doc_url: docUrl.trim(),
          notes: docNotes
        })
      });
      const jr = await res.json();
      if (jr.success) {
        setDocUrl('');
        setDocNotes('');
        const dRes = await fetch(`${API_BASE_PATH}/api.php?module=orders&action=getDocuments&id=${selectedOrder.id}`);
        const dJson = await dRes.json();
        if (dJson.success) setOrderDocuments(dJson.data || []);
      } else {
        Swal.fire('فشل الإضافة', jr.message || 'تعذر إضافة المستند.', 'error');
      }
    } catch (e) {
      console.error('Add order document failed', e);
    }
  };

  const deleteOrderDocument = async (id: number) => {
    if (!selectedOrder) return;
    try {
      const res = await fetch(`${API_BASE_PATH}/api.php?module=orders&action=deleteDocument`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      });
      const jr = await res.json();
      if (jr.success) {
        const dRes = await fetch(`${API_BASE_PATH}/api.php?module=orders&action=getDocuments&id=${selectedOrder.id}`);
        const dJson = await dRes.json();
        if (dJson.success) setOrderDocuments(dJson.data || []);
      } else {
        Swal.fire('فشل الحذف', jr.message || 'تعذر حذف المستند.', 'error');
      }
    } catch (e) {
      console.error('Delete order document failed', e);
    }
  };

  const updateOrderStatus = async () => {
    if (!selectedOrder || !statusUpdate) return;
    if (statusUpdate === 'with_rep' && !statusUpdateRepId) {
      Swal.fire('تنبيه', 'يرجى اختيار المندوب عند تغيير الحالة إلى "مع المندوب".', 'warning');
      return;
    }
    try {
      // الحالات التي تحتاج صرف rep_id (ليست مرتبطة بمندوب)
      const statusesWithoutRep = ['pending','confirmed','wrong_number','cancelled','canceled','no_answer','postponed','closed'];
      const payload: any = { id: selectedOrder.id, status: statusUpdate, status_note: statusNote };
      if (statusUpdate === 'with_rep' || statusUpdate === 'in_delivery') {
        // مع مندوب: أرسل المندوب المختار
        if (statusUpdateRepId) payload.rep_id = Number(statusUpdateRepId);
      } else if (statusesWithoutRep.includes(statusUpdate)) {
        // حالة لا تحتاج مندوب: صفّر rep_id صراحةً
        payload.rep_id = null;
      } else {
        // حالات أخرى: أرسل المندوب إن وجد
        if (statusUpdateRepId) payload.rep_id = Number(statusUpdateRepId);
      }
      const res = await fetch(`${API_BASE_PATH}/api.php?module=orders&action=update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const jr = await res.json();
      if (jr.success) {
        await refreshOrdersList();
        const tRes = await fetch(`${API_BASE_PATH}/api.php?module=orders&action=getTimeline&id=${selectedOrder.id}`);
        const tJson = await tRes.json();
        if (tJson.success) setOrderTimeline(tJson.data || []);
        setStatusUpdate('');
        setStatusNote('');
        setStatusUpdateRepId('');
        Swal.fire('تم التحديث', 'تم تحديث حالة الطلب.', 'success');
      } else {
        Swal.fire('فشل التحديث', jr.message || 'تعذر تحديث الحالة.', 'error');
      }
    } catch (e) {
      console.error('Update order status failed', e);
    }
  };

  const openStatusEdit = (order: any) => {
    setStatusEditOrder(order);
    setStatusEditTimeline([]);
    setStatusEditValue(order.status || '');
    setStatusEditNote('');
    setReturnFineMode('none');
    setReturnFineAmount('');
    setStatusEditRepId(getPreferredRepIdForStatusChange(order));
    setIsStatusEditOpen(true);
    fetch(`${API_BASE_PATH}/api.php?module=orders&action=getTimeline&id=${order.id}`)
      .then(r => r.json())
      .then(jr => {
        if (jr?.success) setStatusEditTimeline(jr.data || []);
      })
      .catch(err => {
        console.error('Failed to load status edit timeline', err);
      });
  };

  useEffect(() => {
    if (!selectedOrder || statusUpdateRepId) return;
    if (!shouldAutofillRepForDeliveredReturnedSwitch(selectedOrder.status, statusUpdate)) return;
    const preferredRepId = getPreferredRepIdForStatusChange(selectedOrder, orderTimeline);
    if (preferredRepId) setStatusUpdateRepId(preferredRepId);
  }, [selectedOrder, statusUpdate, statusUpdateRepId, orderTimeline]);

  useEffect(() => {
    if (!statusEditOrder || statusEditRepId) return;
    if (!shouldAutofillRepForDeliveredReturnedSwitch(statusEditOrder.status, statusEditValue)) return;
    const preferredRepId = getPreferredRepIdForStatusChange(statusEditOrder, statusEditTimeline);
    if (preferredRepId) setStatusEditRepId(preferredRepId);
  }, [statusEditOrder, statusEditValue, statusEditRepId, statusEditTimeline]);

  // when opening details, also ensure warehouses available for potential edits
  const openOrderAndEnsure = async (order: any) => {
    await ensureWarehousesLoaded();
    openOrderDetails(order);
  };

  const submitStatusEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!statusEditOrder || !statusEditValue) {
      Swal.fire('تنبيه', 'يرجى اختيار الحالة.', 'warning');
      return;
    }
    if (statusEditValue === 'with_rep' && !statusEditRepId) {
      Swal.fire('تنبيه', 'يرجى اختيار المندوب عند تغيير الحالة إلى "مع المندوب".', 'warning');
      return;
    }
    if (returnFineMode === 'fine') {
      const fine = Number(returnFineAmount || 0);
      if (!fine || isNaN(fine) || fine <= 0) {
        Swal.fire('تنبيه', 'يرجى إدخال مبلغ غرامة صحيح.', 'warning');
        return;
      }
      if (!statusEditRepId && !statusEditOrder.rep_id && !statusEditOrder.repId) {
        Swal.fire('تنبيه', 'لا يوجد مندوب مرتبط بهذا الاوردر لتطبيق الغرامة.', 'warning');
        return;
      }
    }
    try {
      // الحالات التي تحتاج صرف rep_id
      const statusesWithoutRep = ['pending','confirmed','wrong_number','cancelled','canceled','no_answer','postponed','closed'];
      const editPayload: any = {
        id: statusEditOrder.id,
        status: statusEditValue,
        status_note: statusEditNote,
        penalty_apply: returnFineMode === 'fine' ? 1 : 0,
        penalty_amount: returnFineMode === 'fine' ? Number(returnFineAmount || 0) : 0
      };
      if (statusEditValue === 'with_rep' || statusEditValue === 'in_delivery') {
        if (statusEditRepId) editPayload.rep_id = Number(statusEditRepId);
      } else if (statusesWithoutRep.includes(statusEditValue)) {
        // حالة لا تحتاج مندوب: صفّر rep_id صراحةً
        editPayload.rep_id = null;
      } else {
        if (statusEditRepId) editPayload.rep_id = Number(statusEditRepId);
      }
      const res = await fetch(`${API_BASE_PATH}/api.php?module=orders&action=update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editPayload)
      });
      const jr = await res.json();
      if (jr.success) {
        await refreshOrdersList();
        setIsStatusEditOpen(false);
        Swal.fire('تم التحديث', 'تم تحديث حالة الطلب.', 'success');
      } else {
        Swal.fire('فشل التحديث', jr.message || 'تعذر تحديث الحالة.', 'error');
      }
    } catch (err) {
      console.error('Update order status failed', err);
      Swal.fire('خطأ', 'فشل الاتصال بالخادم.', 'error');
    }
  };

  return (
    <div className="space-y-6 dir-rtl">
      
      {/* Hidden Print Container */}
      {ordersToPrint && (
        <PrintableOrders orders={ordersToPrint} companyName={effectiveHeaderName} companyPhone={effectiveHeaderPhone} terms={companyTermsState} companyAddress={companyAddressState} companyLogo={companyLogoState} users={users} />
      )}

      {isOrderDetailsOpen && selectedOrder && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 w-full max-w-5xl rounded-3xl overflow-hidden shadow-2xl">
            <div className="p-6 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50">
              <div>
                <h3 className="text-lg font-black text-slate-800 dark:text-slate-100">تفاصيل الطلب #{selectedOrder.orderNumber}</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {selectedOrder.customerName} • {pickDisplayPhone(`${selectedOrder.phone || ''}\n${selectedOrder.phone1 || ''}\n${selectedOrder.phone2 || ''}`, '')}
                  {selectedOrder.phone2 && String(selectedOrder.phone2).trim() !== '' && (
                    <span> • {normalizeNumbers(selectedOrder.phone2)}</span>
                  )}
                </p>
              </div>
              <button onClick={() => setIsOrderDetailsOpen(false)} className="text-slate-400 hover:text-rose-500">إغلاق</button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 p-6">
              <div className="lg:col-span-2 space-y-6">
                <div className="border border-slate-200 dark:border-slate-700 rounded-2xl p-4 bg-slate-50/40 dark:bg-slate-900/30">
                  <h4 className="text-sm font-black text-slate-800 dark:text-slate-100 mb-3">تحديث الحالة</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                    <CustomSelect
                      value={statusUpdate}
                      onChange={v => {
                        setStatusUpdate(v);
                        if (selectedOrder && shouldAutofillRepForDeliveredReturnedSwitch(selectedOrder.status, v)) {
                          const preferredRepId = getPreferredRepIdForStatusChange(selectedOrder, orderTimeline);
                          if (preferredRepId) setStatusUpdateRepId(preferredRepId);
                        }
                      }}
                      options={[
                        { value: '', label: 'اختر حالة' },
                        { value: 'pending', label: 'قيد الانتظار' },
                        { value: 'confirmed', label: 'مؤكد' },
                        { value: 'with_rep', label: 'مع المندوب' },
                        { value: 'in_delivery', label: 'قيد التسليم' },
                        { value: 'delivered', label: 'تم التسليم' },
                        { value: 'partial', label: 'تسليم جزئي' },
                        { value: 'returned', label: 'مرتجع' },
                        { value: 'postponed', label: 'مؤجل' },
                        { value: 'no_answer', label: 'لم يتم الرد (لا يرد)' },
                        { value: 'wrong_number', label: 'رقم خاطئ' },
                        { value: 'cancelled', label: 'ملغي' },
                        { value: 'closed', label: 'مغلق' }
                      ]}
                      className="text-sm"
                    />
                    <input value={statusNote} onChange={e => setStatusNote(e.target.value)} placeholder="ملاحظة التغيير" className="border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder-slate-400 rounded-lg px-3 py-2 text-sm md:col-span-2 outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div className="mt-2">
                    <label className="text-xs font-bold text-slate-500 dark:text-slate-400 block mb-1">
                      المندوب {statusUpdate === 'with_rep' && <span className="text-rose-500">*</span>}
                    </label>
                    <CustomSelect
                      value={statusUpdateRepId}
                      onChange={v => setStatusUpdateRepId(v)}
                      options={[
                        { value: '', label: 'بدون مندوب' },
                        ...reps.map((r: any) => ({ value: String(r.id), label: r.name || r.fullname || `مندوب #${r.id}` }))
                      ]}
                      className="text-sm"
                    />
                  </div>
                  <button onClick={updateOrderStatus} className="mt-3 bg-blue-600 text-white px-4 py-2 rounded-lg text-xs font-bold">تحديث الحالة</button>
                </div>

                <div className="border border-slate-200 dark:border-slate-700 rounded-2xl p-4 bg-slate-50/40 dark:bg-slate-900/30">
                  <h4 className="text-sm font-black text-slate-800 dark:text-slate-100 mb-3">ملخص الفاتورة</h4>
                  <div className="text-xs space-y-1 text-slate-700 dark:text-slate-300">
                    <div className="flex justify-between"><span>الإجمالي قبل الإضافات</span><span>{selectedOrderSubtotal.toLocaleString()} {currencySymbol}</span></div>
                    {selectedOrderDiscountAmount > 0 && (
                      <div className="flex justify-between text-rose-600"><span>الخصم</span><span>-{selectedOrderDiscountAmount.toLocaleString()} {currencySymbol}</span></div>
                    )}
                    <div className="flex justify-between"><span>الشحن</span><span>{selectedOrderShipping.toLocaleString()} {currencySymbol}</span></div>
                    <div className="flex justify-between font-black pt-2 border-t border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100"><span>الإجمالي</span><span>{selectedOrderTotal.toLocaleString()} {currencySymbol}</span></div>
                  </div>
                </div>

                <div className="border border-slate-200 dark:border-slate-700 rounded-2xl p-4 bg-slate-50/40 dark:bg-slate-900/30">
                  <h4 className="text-sm font-black text-slate-800 dark:text-slate-100 mb-3">سجل الحالة</h4>
                  {orderTimeline.length === 0 ? (
                    <div className="text-xs text-slate-400">لا يوجد سجل حتى الآن.</div>
                  ) : (
                    <div className="space-y-2 max-h-72 overflow-y-auto">
                      {orderTimeline.map((t:any) => (
                        <div key={t.id} className="border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-xl p-3 text-xs">
                          <div className="flex justify-between items-center">
                            <span className="font-bold text-slate-800 dark:text-slate-200">{t.status || t.action}</span>
                            <span className="text-slate-400">{t.created_at || t.createdAt}</span>
                          </div>
                          <div className="text-slate-500 dark:text-slate-400 mt-1">{t.notes || '-'}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-6">
                <div className="border border-slate-200 dark:border-slate-700 rounded-2xl p-4 bg-slate-50/40 dark:bg-slate-900/30">
                  <h4 className="text-sm font-black text-slate-800 dark:text-slate-100 mb-3">المستندات</h4>
                  <div className="space-y-2 mb-3">
                    <CustomSelect
                      value={docType}
                      onChange={v => setDocType(v)}
                      options={[
                        { value: 'delivery_note', label: 'إيصال تسليم' },
                        { value: 'invoice', label: 'فاتورة' },
                        { value: 'proof', label: 'إثبات' },
                        { value: 'other', label: 'أخرى' }
                      ]}
                      className="text-xs w-full"
                    />
                    <input value={docUrl} onChange={e => setDocUrl(e.target.value)} placeholder="رابط المستند" className="border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder-slate-400 rounded-lg px-3 py-2 text-xs w-full outline-none focus:ring-2 focus:ring-blue-500" />
                    <input value={docNotes} onChange={e => setDocNotes(e.target.value)} placeholder="ملاحظات" className="border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder-slate-400 rounded-lg px-3 py-2 text-xs w-full outline-none focus:ring-2 focus:ring-blue-500" />
                    <button onClick={addOrderDocument} className="w-full bg-emerald-600 text-white px-3 py-2 rounded-lg text-xs font-bold">إضافة مستند</button>
                  </div>

                  {orderDocuments.length === 0 ? (
                    <div className="text-xs text-slate-400">لا توجد مستندات.</div>
                  ) : (
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {orderDocuments.map((d:any) => (
                        <div key={d.id} className="border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-xl p-2 text-xs">
                          <div className="flex justify-between items-center">
                            <span className="font-bold text-slate-800 dark:text-slate-200">{d.doc_type || d.type}</span>
                            <button onClick={() => deleteOrderDocument(d.id)} className="text-rose-500">حذف</button>
                          </div>
                          <a href={d.doc_url || d.url} target="_blank" rel="noreferrer" className="text-blue-600 dark:text-blue-400 break-all">{d.doc_url || d.url}</a>
                          <div className="text-slate-500 dark:text-slate-400 mt-1">{d.notes || '-'}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {isStatusEditOpen && statusEditOrder && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl">
            <div className="p-6 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50">
              <div>
                <h3 className="text-lg font-black text-slate-800 dark:text-slate-100">تعديل حالة الطلب</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">#{statusEditOrder.orderNumber} • {statusEditOrder.customerName}</p>
              </div>
              <button onClick={() => setIsStatusEditOpen(false)} className="text-slate-400 hover:text-rose-500">إغلاق</button>
            </div>
            <form onSubmit={submitStatusEdit} className="p-6 space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 dark:text-slate-400">الحالة</label>
                <CustomSelect
                  value={statusEditValue}
                  onChange={v => {
                    setStatusEditValue(v);
                    if (statusEditOrder && shouldAutofillRepForDeliveredReturnedSwitch(statusEditOrder.status, v)) {
                      const preferredRepId = getPreferredRepIdForStatusChange(statusEditOrder, statusEditTimeline);
                      if (preferredRepId) setStatusEditRepId(preferredRepId);
                    }
                  }}
                  options={[
                    { value: '', label: 'اختر حالة' },
                    { value: 'pending', label: 'قيد الانتظار' },
                    { value: 'confirmed', label: 'مؤكد' },
                    { value: 'with_rep', label: 'مع المندوب' },
                    { value: 'in_delivery', label: 'قيد التسليم' },
                    { value: 'delivered', label: 'تم التسليم' },
                    { value: 'partial', label: 'تسليم جزئي' },
                    { value: 'returned', label: 'مرتجع' },
                    { value: 'postponed', label: 'مؤجل' },
                    { value: 'no_answer', label: 'لم يتم الرد (لا يرد)' },
                    { value: 'wrong_number', label: 'رقم خاطئ' },
                    { value: 'cancelled', label: 'ملغي' },
                    { value: 'closed', label: 'مغلق' }
                  ]}
                  className="w-full"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 dark:text-slate-400">
                  المندوب {statusEditValue === 'with_rep' && <span className="text-rose-500">*</span>}
                </label>
                <CustomSelect
                  value={statusEditRepId}
                  onChange={v => setStatusEditRepId(v)}
                  options={[
                    { value: '', label: 'بدون مندوب' },
                    ...reps.map((r: any) => ({ value: String(r.id), label: r.name || r.fullname || `مندوب #${r.id}` }))
                  ]}
                  className="w-full"
                />
              </div>

              <div className="space-y-3">
                <label className="text-xs font-bold text-slate-500 dark:text-slate-400">الغرامة على المندوب</label>
                <div className="flex gap-3">
                  <label className="flex items-center gap-2 text-xs font-bold text-slate-600 dark:text-slate-300">
                    <input type="radio" checked={returnFineMode === 'none'} onChange={() => setReturnFineMode('none')} />
                    بدون غرامة
                  </label>
                  <label className="flex items-center gap-2 text-xs font-bold text-slate-600 dark:text-slate-300">
                    <input type="radio" checked={returnFineMode === 'fine'} onChange={() => setReturnFineMode('fine')} />
                    بغرامة
                  </label>
                </div>
                {returnFineMode === 'fine' && (
                  <div>
                    <label className="text-xs font-bold text-slate-500 dark:text-slate-400">مبلغ الغرامة</label>
                    <input
                      type="number"
                      min="0"
                      value={returnFineAmount}
                      onChange={e => setReturnFineAmount(e.target.value)}
                      className="w-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                )}
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 dark:text-slate-400">ملاحظة</label>
                <input
                  value={statusEditNote}
                  onChange={e => setStatusEditNote(e.target.value)}
                  placeholder="سبب التعديل"
                  className="w-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder-slate-400 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <button type="submit" className="w-full bg-blue-600 text-white px-4 py-3 rounded-lg text-sm font-bold">حفظ التعديل</button>
            </form>
          </div>
        </div>
      )}
      
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-900 dark:text-slate-100">إدارة الاوردرات</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">نظام تتبع وإدارة المبيعات</p>
        </div>
        <div className="flex gap-1 bg-white dark:bg-slate-800 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm w-full md:w-auto overflow-x-auto">
          <button onClick={() => setView('new-order')} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all whitespace-nowrap ${view === 'new-order' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'}`}><PlusCircle size={16}/> اوردر جديد</button>
          <button onClick={() => setView('manage-orders')} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all whitespace-nowrap ${view === 'manage-orders' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'}`}><FileText size={16}/> إدارة الاوردرات</button>
          <button onClick={() => setView('import-orders')} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all whitespace-nowrap ${view === 'import-orders' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'}`}><UploadCloud size={16}/> استيراد</button>
        </div>
      </div>

      {/* --- Views --- */}
      {view === 'new-order' && (
        <div className="space-y-5">

          {/* ── Page Header ── */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white dark:bg-slate-800 px-6 py-4 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm">
            <div className="flex items-center gap-3">
              {editingOrderId && (
                <button
                  onClick={() => { setEditingOrderId(null); setView('manage-orders'); }}
                  className="w-10 h-10 flex items-center justify-center rounded-full bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors flex-shrink-0"
                  title="العودة لإدارة الاوردرات"
                >
                  <ChevronRight size={20} className="text-slate-600 dark:text-slate-300" />
                </button>
              )}
              <div>
                <h3 className="text-xl font-black text-slate-900 dark:text-slate-100">
                  {editingOrderId ? 'تعديل الاوردر' : 'إنشاء اوردر جديد'}
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {editingOrderId ? `رقم المرجع: #${editingOrderId}` : 'أدخل بيانات الاوردر اليدوي'}
                </p>
              </div>
            </div>
            <button
              onClick={saveManualOrder}
              className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white px-6 py-3 rounded-2xl text-sm font-black shadow-lg shadow-emerald-200/60 transition-all"
            >
              <ShoppingCart size={18} />
              {editingOrderId ? 'حفظ التعديلات' : 'حفظ الاوردر'}
            </button>
          </div>

          {/* ── Main Two-Column Grid ── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

            {/* ── LEFT COLUMN ── */}
            <div className="lg:col-span-1 space-y-4">

              {/* Sales Office Card */}
              {salesDisplayMethod === 'sales_offices' && (
                <div className="bg-white dark:bg-slate-800 p-5 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm">
                  <h4 className="text-sm font-black text-slate-700 dark:text-slate-200 mb-3 flex items-center gap-2">
                    <span className="w-7 h-7 bg-purple-100 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 rounded-xl flex items-center justify-center text-xs font-black">م</span>
                    مكتب المبيعات
                  </h4>
                  {isSalesOfficeScopeNone ? (
                    <p className="text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-900/40 rounded-xl p-3">هذا المستخدم بدون مكاتب مبيعات — سيتم استخدام بيانات الشركة.</p>
                  ) : (
                    <div className="space-y-2">
                      <CustomSelect
                        value={selectedSalesOfficeId ? String(selectedSalesOfficeId) : ''}
                        onChange={v => setSelectedSalesOfficeId(v ? Number(v) : '')}
                        options={[
                          { value: '', label: 'اختيار مكتب' },
                          ...((canChangeSalesOffice ? salesOffices : salesOffices.filter(o => Number(o.id) === Number(defaultSalesOfficeId))).map((o: any) => ({ value: String(o.id), label: o.name })))
                        ]}
                        disabled={!canChangeSalesOffice && defaultSalesOfficeId !== null && defaultSalesOfficeId !== undefined}
                        className="w-full"
                      />
                      {selectedSalesOffice && (
                        <p className="text-xs text-slate-500 dark:text-slate-400 px-1">{selectedSalesOffice.phones || ''}</p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Customer Card */}
              <div className="bg-white dark:bg-slate-800 p-5 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm">
                <h4 className="text-sm font-black text-slate-700 dark:text-slate-200 mb-4 flex items-center gap-2">
                  <User size={16} className="text-blue-500" />
                  بيانات العميل
                </h4>

                {/* Customer Selector */}
                <div className="mb-4">
                  <label className="text-xs font-black text-slate-500 dark:text-slate-400 mb-1.5 block">اختر من العملاء الموجودين</label>
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <CustomSelect
                        value={selectedCustomerId ? String(selectedCustomerId) : ''}
                        onChange={v => {
                          const cid = v ? Number(v) : '';
                          setSelectedCustomerId(cid);
                          if (cid) {
                            const c = customers.find((x: any) => Number(x.id) === Number(cid));
                            if (c) {
                              setNewCustomer({
                                name: c.name || '',
                                phone1: c.phone1 || '',
                                phone2: c.phone2 || '',
                                governorate: c.governorate || '',
                                address: c.address || ''
                              });
                            }
                          } else {
                            setNewCustomer({ name: '', phone1: '', phone2: '', governorate: '', address: '' });
                          }
                        }}
                        options={[{ value: '', label: '— عميل جديد —' }, ...customers.map((c: any) => ({ value: String(c.id), label: `${c.name} - ${c.phone1 || ''}` }))]}
                        className="w-full"
                      />
                    </div>
                    {selectedCustomerId !== '' && (
                      <button
                        className="flex-shrink-0 px-3 py-2 text-xs font-black text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-xl transition-colors"
                        onClick={() => { setSelectedCustomerId(''); setNewCustomer({ name: '', phone1: '', phone2: '', governorate: '', address: '' }); }}
                      >
                        إلغاء
                      </button>
                    )}
                  </div>
                  {selectedCustomerId !== '' && (
                    <div className="mt-2 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 p-2.5 rounded-xl text-xs flex items-center gap-2">
                      <span>💡 تم جلب بيانات العميل المسجلة. يمكنك تعديل العنوان أو المحافظة لهذا الأوردر بحرية وسيُحفظ العنوان الجديد في البوليصة.</span>
                    </div>
                  )}
                </div>

                {/* Customer Fields */}
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-black text-slate-500 dark:text-slate-400 mb-1.5 block">اسم العميل</label>
                    <input
                      placeholder="الاسم الكامل"
                      className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-400 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                      value={newCustomer.name}
                      onChange={e => setNewCustomer({ ...newCustomer, name: e.target.value })}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs font-black text-slate-500 dark:text-slate-400 mb-1.5 flex items-center gap-1"><Phone size={11} /> هاتف 1</label>
                      <input
                        placeholder="01xxxxxxxxx"
                        className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-400 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                        value={newCustomer.phone1}
                        onChange={e => {
                          const val = e.target.value;
                          const clean = normalizeNumbers(val);
                          setNewCustomer(prev => ({ ...prev, phone1: val }));
                          if (!selectedCustomerId && clean.length >= 10) {
                            const matched = customers.find((c: any) => {
                              const cp1 = normalizeNumbers(c.phone1 || '');
                              const cp2 = normalizeNumbers(c.phone2 || '');
                              return (cp1 && cp1 === clean) || (cp2 && cp2 === clean);
                            });
                            if (matched) {
                              setSelectedCustomerId(Number(matched.id));
                              setNewCustomer({
                                name: matched.name || '',
                                phone1: val,
                                phone2: matched.phone2 || '',
                                governorate: matched.governorate || '',
                                address: matched.address || ''
                              });
                            }
                          }
                        }}
                      />
                    </div>
                    <div>
                      <label className="text-xs font-black text-slate-500 dark:text-slate-400 mb-1.5 block">هاتف 2</label>
                      <input
                        placeholder="اختياري"
                        className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-400 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                        value={newCustomer.phone2}
                        onChange={e => setNewCustomer({ ...newCustomer, phone2: e.target.value })}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-black text-slate-500 dark:text-slate-400 mb-1.5 flex items-center gap-1"><MapPin size={11} /> المحافظة</label>
                    <input
                      placeholder="المحافظة"
                      className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-400 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                      value={newCustomer.governorate}
                      onChange={e => setNewCustomer({ ...newCustomer, governorate: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-black text-slate-500 dark:text-slate-400 mb-1.5 block">العنوان التفصيلي</label>
                    <input
                      placeholder="الشارع، المبنى..."
                      className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-400 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                      value={newCustomer.address}
                      onChange={e => setNewCustomer({ ...newCustomer, address: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              {/* Notes & Meta Card */}
              <div className="bg-white dark:bg-slate-800 p-5 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm">
                <h4 className="text-sm font-black text-slate-700 dark:text-slate-200 mb-4 flex items-center gap-2">
                  <FileText size={16} className="text-slate-400" />
                  ملاحظات وبيانات إضافية
                </h4>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-black text-slate-500 dark:text-slate-400 mb-1.5 block">ملاحظات الاوردر</label>
                    <textarea
                      placeholder="ملاحظات خاصة بالاوردر..."
                      rows={3}
                      className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-400 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all resize-none"
                      value={notes}
                      onChange={e => setNotes(e.target.value)}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs font-black text-slate-500 dark:text-slate-400 mb-1.5 block">الموظف</label>
                      <input
                        placeholder="اسم الموظف"
                        className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-400 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                        value={employee}
                        onChange={e => setEmployee(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="text-xs font-black text-slate-500 dark:text-slate-400 mb-1.5 block">البيدج</label>
                      <input
                        placeholder="رقم البيدج"
                        className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-400 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                        value={page}
                        onChange={e => setPage(e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              </div>

            </div>{/* end LEFT COLUMN */}

            {/* ── RIGHT COLUMN ── */}
            <div className="lg:col-span-2 space-y-4">

              {/* Order Items Card */}
              <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm">
                <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-700">
                  <h4 className="text-sm font-black text-slate-700 dark:text-slate-200 flex items-center gap-2">
                    <ShoppingCart size={16} className="text-blue-500" />
                    عناصر الطلب
                    <span className="bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 text-xs font-black px-2 py-0.5 rounded-full">{orderItems.length}</span>
                  </h4>
                  <button
                    onClick={addOrderItem}
                    className="flex items-center gap-1.5 bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/50 text-blue-700 dark:text-blue-300 text-xs font-black px-3 py-2 rounded-xl transition-colors"
                  >
                    <PlusCircle size={14} /> إضافة منتج
                  </button>
                </div>

                {/* Column Headers */}
                <div className="hidden md:grid grid-cols-[2rem_1fr_7rem_7rem_4rem_6rem_4rem_2rem] gap-2 px-4 py-2 bg-slate-50 dark:bg-slate-900/40 border-b border-slate-100 dark:border-slate-700 text-[10px] font-black text-slate-400 uppercase tracking-wide">
                  <div></div>
                  <div>المنتج</div>
                  <div className="text-center">المقاس</div>
                  <div className="text-center">اللون</div>
                  <div className="text-center">الكمية</div>
                  <div className="text-center">السعر</div>
                  <div className="text-center">الإجمالي</div>
                  <div></div>
                </div>

                {/* Item Rows */}
                <div className="divide-y divide-slate-100 dark:divide-slate-700/60">
                  {orderItems.map((it, _idx) => {
                    const ia = it as any;
                    const parentId = ia._parentId || '';
                    const selColor = ia._color || '';
                    const selSize  = ia._size  || '';

                    const selectedVariants = getVariantsForSelectedParent(parentId);

                    const sizeOptions: string[] = parentId
                      ? [...new Set<string>(
                          selectedVariants
                            .filter((ep: any) => ep.size)
                            .map((ep: any) => ep.size as string)
                        )]
                      : [];

                    const colorOptions: string[] = parentId
                      ? [...new Set<string>(
                          selectedVariants
                            .filter((ep: any) =>
                              (selSize ? ep.size === selSize : true) &&
                              ep.color
                            )
                            .map((ep: any) => ep.color as string)
                        )]
                      : [];

                    return (
                      <div key={it.id} className="grid grid-cols-[2rem_1fr_7rem_7rem_4rem_6rem_4rem_2rem] gap-2 px-4 py-2.5 items-center hover:bg-slate-50/60 dark:hover:bg-slate-700/30 transition-colors">

                        {/* # */}
                        <span className="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-400 dark:text-slate-300 text-[10px] font-black flex items-center justify-center">{_idx + 1}</span>

                        {/* Product */}
                        <CustomSelect
                          value={parentId ? String(parentId) : ''}
                          onChange={v => updateOrderItemField(it.id, '_parentId', v)}
                          options={[{ value: '', label: '— منتج —' }, ...parentProductsMap.map(p => ({ value: String(p.id), label: p.name }))]}
                          className="w-full text-xs"
                        />

                        {/* Size */}
                        {sizeOptions.length > 0 ? (
                          <CustomSelect
                            value={selSize}
                            onChange={v => updateOrderItemField(it.id, '_size', v)}
                            options={[{ value: '', label: '— مقاس —' }, ...sizeOptions.map(s => ({ value: s, label: s }))]}
                            className="w-full text-xs"
                          />
                        ) : (
                          <div className="h-9 rounded-2xl bg-slate-50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-700 flex items-center justify-center text-[10px] text-slate-300 dark:text-slate-600">—</div>
                        )}

                        {/* Color */}
                        {colorOptions.length > 0 ? (
                          <CustomSelect
                            value={selColor}
                            onChange={v => updateOrderItemField(it.id, '_color', v)}
                            options={[{ value: '', label: '— لون —' }, ...colorOptions.map(c => ({ value: c, label: c }))]}
                            className="w-full text-xs"
                          />
                        ) : (
                          <div className="h-9 rounded-2xl bg-slate-50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-700 flex items-center justify-center text-[10px] text-slate-300 dark:text-slate-600">—</div>
                        )}

                        {/* Qty */}
                        <input
                          type="number" min={1}
                          className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-xl px-1 py-2 text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                          value={it.qty}
                          onChange={e => updateOrderItemField(it.id, 'qty', Number(e.target.value || 0))}
                        />

                        {/* Price */}
                        <div className="relative">
                          <input
                            type="number" min={0}
                            className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-xl px-1 py-2 text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all pl-6"
                            value={it.price}
                            onChange={e => updateOrderItemField(it.id, 'price', Number(e.target.value || 0))}
                          />
                          <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-[9px] text-slate-400 font-bold pointer-events-none">ج.م</span>
                        </div>

                        {/* Row total */}
                        <div className="text-center">
                          <span className="text-xs font-black text-slate-700 dark:text-slate-200 tabular-nums">{(it.qty * it.price).toLocaleString('ar-EG')}</span>
                        </div>

                        {/* Delete */}
                        <button
                          className="w-7 h-7 flex items-center justify-center rounded-xl bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/50 text-rose-400 dark:text-rose-400 transition-colors mx-auto"
                          onClick={() => removeOrderItem(it.id)}
                          title="حذف"
                        >
                          <MinusCircle size={13} />
                        </button>
                      </div>
                    );
                  })}
                  {orderItems.length === 0 && (
                    <div className="py-14 text-center">
                      <ShoppingCart className="w-12 h-12 mx-auto text-slate-200 dark:text-slate-700 mb-3" />
                      <p className="text-slate-400 text-sm font-bold">لا توجد عناصر.</p>
                      <p className="text-slate-400 text-xs mt-1">اضغط «إضافة منتج» للبدء.</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Pricing & Totals Card */}
              <div className="bg-white dark:bg-slate-800 p-5 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm">
                <h4 className="text-sm font-black text-slate-700 dark:text-slate-200 mb-4 flex items-center gap-2">
                  <RefreshCcw size={15} className="text-slate-400" />
                  التسعير والمجاميع
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-5">
                  {/* Discount */}
                  <div className="bg-slate-50 dark:bg-slate-900/40 rounded-2xl p-3.5">
                    <label className="text-[11px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2.5 block">الخصم</label>
                    <div className="flex gap-2">
                      <CustomSelect
                        value={discountType}
                        onChange={v => setDiscountType(v as RateType)}
                        options={[{ value: 'amount', label: 'قيمة' }, { value: 'percent', label: '%' }]}
                        className="text-sm"
                      />
                      <input
                        type="number" min={0}
                        value={discountValue}
                        onChange={e => setDiscountValue(Number(e.target.value || 0))}
                        className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                        placeholder="0"
                      />
                    </div>
                  </div>
                  {/* Shipping */}
                  <div className="bg-slate-50 dark:bg-slate-900/40 rounded-2xl p-3.5">
                    <label className="text-[11px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2.5 block">مصاريف الشحن</label>
                    <div className="relative">
                      <input
                        type="number" min={0}
                        value={shippingValue}
                        onChange={e => setShippingValue(Number(e.target.value || 0))}
                        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all pl-10"
                        placeholder="0"
                      />
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[11px] text-slate-400 font-bold pointer-events-none">ج.م</span>
                    </div>
                  </div>
                </div>

                {/* Live Totals Summary */}
                {(() => {
                  const _sub = orderItems.reduce((s, it) => s + (it.qty * it.price), 0);
                  const _totals = calculateOrderTotals(_sub, shippingValue, discountType, discountValue);
                  return (
                    <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-5 text-white">
                      <div className="space-y-2.5 text-sm">
                        <div className="flex justify-between items-center">
                          <span className="text-slate-400">المجموع الفرعي</span>
                          <span className="font-bold tabular-nums">{_totals.subtotal.toLocaleString('ar-EG')} {currencySymbol}</span>
                        </div>
                        {_totals.discountAmount > 0 && (
                          <div className="flex justify-between items-center text-rose-400">
                            <span>الخصم</span>
                            <span className="font-bold tabular-nums">− {_totals.discountAmount.toLocaleString('ar-EG')} {currencySymbol}</span>
                          </div>
                        )}
                        {shippingValue > 0 && (
                          <div className="flex justify-between items-center text-sky-300">
                            <span>الشحن</span>
                            <span className="font-bold tabular-nums">+ {shippingValue.toLocaleString('ar-EG')} {currencySymbol}</span>
                          </div>
                        )}
                        <div className="border-t border-slate-600/60 pt-3 flex justify-between items-center">
                          <span className="text-base font-black">الإجمالي النهائي</span>
                          <span className="text-xl font-black text-emerald-400 tabular-nums">{_totals.total.toLocaleString('ar-EG')} {currencySymbol}</span>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* Save Button */}
                <div className="mt-5 flex justify-end">
                  <button
                    onClick={saveManualOrder}
                    className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white px-8 py-3 rounded-2xl text-sm font-black shadow-lg shadow-emerald-200/60 transition-all"
                  >
                    <ShoppingCart size={18} />
                    {editingOrderId ? 'حفظ التعديلات' : 'حفظ الاوردر'}
                  </button>
                </div>
              </div>

            </div>{/* end RIGHT COLUMN */}
          </div>{/* end grid */}
        </div>
      )}

      {view === 'manage-orders' && (
        <div className="space-y-4">
          {/* Toolbar */}
          <div className="bg-white dark:bg-slate-800 p-4 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-700 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="relative flex-1 w-full md:max-w-md">
              <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
              <input 
                type="text" 
                placeholder="بحث برقم الاوردر، اسم العميل، الهاتف..." 
                value={searchTerm} 
                onChange={e => setSearchTerm(e.target.value)} 
                className="w-full pr-10 pl-4 py-3 bg-slate-50 dark:bg-slate-900 border border-transparent dark:border-slate-700 rounded-2xl text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:ring-2 focus:ring-blue-500 transition-all outline-none" 
              />
            </div>
            
            <div className="flex items-center gap-3 w-full md:w-auto">
                <CustomSelect
                  value={statusFilter}
                  onChange={v => setStatusFilter(v)}
                  options={[
                    { value: 'all', label: 'كل الحالات' },
                    { value: 'pending', label: 'قيد الانتظار' },
                    { value: 'confirmed', label: 'مؤكد' },
                    { value: 'with_rep', label: 'مع المندوب' },
                    { value: 'in_delivery', label: 'قيد التسليم' },
                    { value: 'delivered', label: 'تم التسليم' },
                    { value: 'partial', label: 'تسليم جزئي' },
                    { value: 'returned', label: 'مرتجع' },
                    { value: 'postponed', label: 'مؤجل' },
                    { value: 'no_answer', label: 'لا يرد' },
                    { value: 'wrong_number', label: 'رقم خاطئ' },
                    { value: 'cancelled', label: 'ملغي' },
                    { value: 'closed', label: 'مغلق' }
                  ]}
                  className="text-sm font-bold min-w-[180px]"
                />
                <div className="flex flex-col gap-2 bg-slate-50 dark:bg-slate-800 p-2.5 rounded-3xl border border-slate-200 dark:border-slate-700">
                  {/* Line 1: From Date & From Time */}
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-slate-600 dark:text-slate-300">
                      <Calendar size={14} className="text-blue-600 shrink-0" />
                      <span className="shrink-0">من تاريخ:</span>
                      <input
                        type="date"
                        value={startDateFilter}
                        onChange={e => setStartDateFilter(e.target.value)}
                        className="bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl px-2.5 py-1 text-xs font-mono text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <Custom12HourTimePicker
                      label="من وقت:"
                      value={timeFromFilter}
                      onChange={v => setTimeFromFilter(v)}
                    />
                  </div>

                  {/* Line 2: To Date & To Time */}
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-slate-600 dark:text-slate-300">
                      <Calendar size={14} className="text-blue-600 shrink-0" />
                      <span className="shrink-0">إلى تاريخ:</span>
                      <input
                        type="date"
                        value={endDateFilter}
                        onChange={e => setEndDateFilter(e.target.value)}
                        className="bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl px-2.5 py-1 text-xs font-mono text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <Custom12HourTimePicker
                      label="إلى وقت:"
                      value={timeToFilter}
                      onChange={v => setTimeToFilter(v)}
                    />
                    {(startDateFilter || endDateFilter || timeFromFilter || timeToFilter) && (
                      <button
                        onClick={() => { setStartDateFilter(''); setEndDateFilter(''); setTimeFromFilter(''); setTimeToFilter(''); }}
                        className="text-xs font-bold text-rose-600 hover:text-rose-700 bg-rose-50 dark:bg-rose-900/30 px-2.5 py-1 rounded-xl transition-all shrink-0"
                        title="مسح الفلاتر"
                      >
                        ✕ مسح الفلتر
                      </button>
                    )}
                  </div>
                </div>
                <button 
                  onClick={toggleSelectAll}
                  className="flex items-center gap-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 border border-slate-200 dark:border-slate-600 px-4 py-3 rounded-2xl text-xs font-bold text-slate-600 dark:text-slate-200 transition-all"
                >
                    {selectedOrders.length === filteredOrders.length && filteredOrders.length > 0 ? <CheckSquare size={16} className="text-blue-600"/> : <Square size={16}/>}
                    {selectedOrders.length === filteredOrders.length ? 'إلغاء الكل' : 'تحديد الكل'}
                </button>

                <button 
                    onClick={() => {
                      if (selectedOrders.length === 0) {
                        Swal.fire('تنبيه', 'يرجى تحديد الأوردرات المراد طباعتها أولاً.', 'warning');
                        return;
                      }
                      const targetOrders = orders.filter(o => selectedOrders.includes(o.id));
                      if (!targetOrders.length) {
                        Swal.fire('تنبيه', 'لا توجد أوردرات محددة للطباعة.', 'info');
                        return;
                      }
                      handlePrint(targetOrders);
                    }}
                    disabled={selectedOrders.length === 0} 
                    className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-2xl text-xs font-bold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-200 transition-all cursor-pointer"
                >
                    <Printer size={16}/> {selectedOrders.length > 0 ? `طباعة الأوردرات المحددة (${selectedOrders.length})` : 'حدد أوردرات للطباعة'}
                </button>
            </div>
          </div>

          {/* New Card Grid Layout (Unified with Import View) */}
          {filteredOrders.length === 0 ? (
             <div className="text-center py-20 bg-white dark:bg-slate-800 rounded-3xl border border-dashed border-slate-300 dark:border-slate-700">
                <FileText className="w-16 h-16 mx-auto text-slate-200 dark:text-slate-700 mb-4"/>
               <p className="text-slate-400 font-bold">لا توجد اوردرات مطابقة للبحث</p>
             </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-5">
              {displayedOrders.map(order => (
                <div 
                  key={order.id} 
                  className={`relative group bg-white dark:bg-slate-800 p-0 rounded-3xl border transition-all duration-300 hover:shadow-xl hover:-translate-y-1 ${selectedOrders.includes(order.id) ? 'border-blue-500 ring-2 ring-blue-500/20 z-10' : 'border-slate-200 dark:border-slate-700 shadow-sm'}`}
                >
                    {/* Selection Checkbox (Absolute) */}
                    <div className="absolute top-4 left-4 z-20">
                        <button 
                          onClick={() => toggleSelectOne(order.id)}
                          className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${selectedOrders.includes(order.id) ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-300 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600'}`}
                        >
                           {selectedOrders.includes(order.id) ? <CheckSquare size={16}/> : <Square size={16}/>}
                        </button>
                    </div>

                    {/* Card Content */}
                    <div className="p-5">
                        {/* Header */}
                        <div className="flex justify-between items-start mb-4 pl-10">
                            <div>
                                <span className="inline-block bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-mono text-[10px] px-2 py-1 rounded-lg mb-1 mr-2">{order.orderNumber}</span>
                                {(order.created_at || order.createdAt || order.date) && (
                                  <span className="inline-block bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 font-mono text-[10px] px-2 py-1 rounded-lg mb-1" title="وقت الإضافة">
                                    🕒 {formatOrderTime(order.created_at || order.createdAt || order.date)}
                                  </span>
                                )}
                                <h3 className="font-bold text-slate-800 dark:text-slate-100 text-sm line-clamp-1">{order.customerName}</h3>
                            </div>
                            <div className="flex flex-col items-end gap-1">
                              {getStatusChip(order.status)}
                              <div className="mt-2 flex items-center gap-2">
                                {String(order.status || '').toLowerCase().trim() === 'with_rep' ? (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      Swal.fire({
                                        icon: 'warning',
                                        title: 'الاوردر في عهدة المندوب',
                                        text: 'لا يمكن تعديل هذا الاوردر لأنه حالياً في عهدة المندوب (مع المندوب). يجب استرجاعه من المندوب أولاً لإجراء أي تعديل.',
                                        confirmButtonText: 'حسناً'
                                      });
                                    }}
                                    title="لا يمكن تعديل الأوردر أثناء وجوده في عهدة المندوب"
                                    className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-700/80 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-600 px-2.5 py-1 rounded-lg text-xs font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors shadow-sm cursor-not-allowed"
                                  >
                                    <Lock size={14} className="text-amber-500" />
                                    <span>مع المندوب (مغلق)</span>
                                  </button>
                                ) : (
                                  <button onClick={() => editOrder(order)} title="تعديل الطلب" className="flex items-center gap-2 bg-amber-500 text-white px-3 py-1 rounded-lg hover:bg-amber-600 text-sm font-bold shadow-sm transition-colors">
                                    <Edit size={18} />
                                    <span>تعديل الاوردر</span>
                                  </button>
                                )}
                              </div>
                              {order.status === 'with_rep' && (() => {
                                const rn = getRepName(order);
                                return rn ? <div className="text-[11px] text-slate-500 dark:text-slate-400">المندوب: <span className="font-bold text-slate-700 dark:text-slate-200">{rn}</span></div> : null;
                              })()}
                            </div>
                        </div>

                        {/* Details */}
                        <div className="space-y-2 mb-4">
                            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                              <Phone size={14} className="text-blue-500"/>
                              <div className="flex flex-col">
                                <span className="font-mono dir-ltr">{pickDisplayPhone(`${order.phone || ''}\n${order.phone1 || ''}\n${order.phone2 || ''}`, '')}</span>
                                {order.phone2 && String(order.phone2).trim() !== '' && (
                                  <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono dir-ltr">{normalizeNumbers(order.phone2)}</span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-start gap-2 text-xs text-slate-500 dark:text-slate-400">
                                <MapPin size={14} className="text-rose-500 mt-0.5 shrink-0"/>
                                <span className="line-clamp-2 leading-relaxed">{order.governorate} - {order.address}</span>
                            </div>
                        </div>

                        {/* Products Summary */}
                        <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-3 mb-4 border border-slate-100 dark:border-slate-700/60">
                            <p className="text-[10px] text-slate-400 dark:text-slate-400 font-bold mb-2">ملخص المنتجات:</p>
                            <div className="space-y-1">
                                {order.products.slice(0, 2).map((p:any, i:number) => (
                                    <div key={i} className="flex justify-between text-[11px]">
                                        <span className="text-slate-700 dark:text-slate-300 truncate max-w-[70%]">{p.name}</span>
                                        <span className="text-slate-500 dark:text-slate-400 font-mono">x{p.quantity}</span>
                                    </div>
                                ))}
                                {order.products.length > 2 && (
                                    <p className="text-[10px] text-blue-500 dark:text-blue-400 font-bold pt-1">+ {order.products.length - 2} منتجات أخرى</p>
                                )}
                            </div>
                        </div>

                        {/* Employee & Page info intentionally hidden */}
                      </div>

                    {/* Footer */}
                    <div className="flex items-center justify-between p-4 border-t border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/30 rounded-b-3xl">
                        <div className="flex flex-col">
                            <span className="text-[10px] text-slate-400 dark:text-slate-400 font-bold">الإجمالي</span>
                            <span className="font-black text-lg text-slate-800 dark:text-slate-100">{order.total.toLocaleString()} {currencySymbol}</span>
                        </div>
                        <div className="flex gap-2">
                             <button 
                                onClick={() => handlePrint([order])}
                                className="w-10 h-10 flex items-center justify-center bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl text-slate-600 dark:text-slate-200 hover:text-blue-600 dark:hover:text-blue-400 hover:border-blue-200 dark:hover:border-blue-500 transition-colors shadow-sm"
                                title="طباعة"
                             >
                                <Printer size={18}/>
                             </button>
                             <button
                               onClick={() => openStatusEdit(order)}
                               className="w-10 h-10 flex items-center justify-center bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl text-slate-600 dark:text-slate-200 hover:text-amber-600 dark:hover:text-amber-400 hover:border-amber-200 dark:hover:border-amber-500 transition-colors shadow-sm"
                               title="تعديل الحالة"
                             >
                               <Edit size={18}/>
                             </button>
                             <button
                               onClick={() => openOrderAndEnsure(order)}
                               className="w-10 h-10 flex items-center justify-center bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl text-slate-600 dark:text-slate-200 hover:text-emerald-600 dark:hover:text-emerald-400 hover:border-emerald-200 dark:hover:border-emerald-500 transition-colors shadow-sm"
                               title="تفاصيل"
                             >
                               <Eye size={18}/>
                             </button>
                        </div>
                    </div>
                </div>
              ))}
            </div>

            {visibleOrdersCount < filteredOrders.length && (
              <div className="text-center py-6 border-t border-slate-200 dark:border-slate-800 mt-6">
                <button
                  type="button"
                  onClick={() => setVisibleOrdersCount(prev => prev + 50)}
                  className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-2xl shadow-lg shadow-blue-200 dark:shadow-none transition-all active:scale-95 flex items-center justify-center gap-2 mx-auto cursor-pointer"
                >
                  <span>عرض المزيد من الأوردرات (+50)</span>
                  <span className="bg-white/20 text-white px-2.5 py-0.5 rounded-full text-xs font-mono">
                    متبقي {filteredOrders.length - visibleOrdersCount}
                  </span>
                </button>
                <p className="text-xs text-slate-400 mt-2 font-medium">
                  يتم عرض {displayedOrders.length} من إجمالي {filteredOrders.length} أوردر
                </p>
              </div>
            )}
          </>
          )}
        </div>
      )}

      {view === 'import-orders' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-800 p-8 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm">
              <h3 className="text-xl font-black mb-2 text-slate-900 dark:text-slate-100 flex items-center gap-3"><ClipboardPaste size={24} className="text-blue-500"/> استيراد الاوردرات</h3>

              {salesDisplayMethod === 'sales_offices' && (
                <div className="mb-4 p-3 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-2xl">
                  <div className="text-xs font-black text-slate-600 dark:text-slate-300 mb-2">مكتب المبيعات</div>
                  {isSalesOfficeScopeNone ? (
                    <div className="text-xs text-slate-500 dark:text-slate-400">هذا المستخدم بدون مكاتب مبيعات (سيتم استخدام بيانات الشركة في رأس الاوردر).</div>
                  ) : (
                    <div className="flex flex-col md:flex-row gap-2 md:items-center">
                      <CustomSelect
                        value={selectedSalesOfficeId ? String(selectedSalesOfficeId) : ''}
                        onChange={v => setSelectedSalesOfficeId(v ? Number(v) : '')}
                        options={[{ value: '', label: 'اختيار مكتب' }, ...(canChangeSalesOffice ? salesOffices : salesOffices.filter(o => Number(o.id) === Number(defaultSalesOfficeId))).map((o: any) => ({ value: String(o.id), label: o.name }))]}
                        className="w-44"
                        disabled={!canChangeSalesOffice && defaultSalesOfficeId !== null && defaultSalesOfficeId !== undefined}
                      />
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                              {selectedSalesOffice ? (selectedSalesOffice.phones || '') : 'سيظهر اسم/هاتف المكتب في رأس الاوردر.'}
                            </div>
                    </div>
                  )}
                </div>
              )}

              <div>
                <label className="text-xs font-bold text-slate-600 dark:text-slate-300">نص الاوردرات</label>
                <textarea value={scriptText} onChange={(e) => setScriptText(normalizeNumbers(e.target.value))} rows={8} placeholder="انسخ نص الاوردرات هنا..." className="w-full bg-slate-50 dark:bg-slate-900/50 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl p-4 text-sm font-mono text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:border-blue-500 transition-all mt-1 outline-none" />
              </div>
              
              <div className="mt-4 flex justify-end">
                      <div className="flex items-center gap-3 mr-auto">
                        <label className="text-xs text-slate-600 dark:text-slate-300 font-bold">مستودع افتراضي (للبيع/المخزون)</label>
                        <CustomSelect
                          value={defaultWarehouseId ? String(defaultWarehouseId) : ''}
                          onChange={v => setDefaultWarehouseId(v ? Number(v) : '')}
                          options={[{ value: '', label: 'بدون' }, ...warehouses.map(w => ({ value: String(w.id), label: w.name }))]}
                          className="w-40"
                        />
                        <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300 font-bold"><input type="checkbox" checked={createSales} onChange={e => setCreateSales(e.target.checked)} /> أنشئ قيود مبيعات</label>
                        <div className="flex items-center gap-2">
                          <label className="text-xs text-slate-600 dark:text-slate-300 font-bold">خصم</label>
                          <CustomSelect
                            value={importDiscountType}
                            onChange={v => setImportDiscountType(v as RateType)}
                            options={[{ value: 'amount', label: 'قيمة' }, { value: 'percent', label: '%' }]}
                            className="w-20"
                          />
                          <input type="number" min={0} value={importDiscountValue} onChange={e => setImportDiscountValue(Number(e.target.value || 0))} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-xl px-2 py-1 text-xs w-20 outline-none focus:ring-2 focus:ring-blue-500" />
                        </div>
                        <button
                          onClick={async () => {
                            const confirm = await Swal.fire({ title: 'تحويل الأرقام', text: 'هل تريد تحويل أرقام الاوردرات الظاهرة إلى أرقام إنجليزية وحفظها؟', icon: 'question', showCancelButton: true });
                            if (!confirm.isConfirmed) return;
                            const toUpdate = filteredOrders.filter(o => {
                              const phones = `${o.phone || ''}\n${o.phone1 || ''}\n${o.phone2 || ''}`;
                              const normalized = normalizeNumbers(phones || '');
                              return normalized !== (phones || '');
                            });
                            if (toUpdate.length === 0) {
                              Swal.fire('تم', 'لا توجد أرقام بحاجة للتحويل.', 'info');
                              return;
                            }
                            Swal.fire({ title: 'جاري التحويل...', html: `سيتم تحويل ${toUpdate.length} طلبيات. الرجاء الانتظار.`, didOpen: () => { Swal.showLoading(); } });
                            let successCount = 0;
                            for (const o of toUpdate) {
                              try {
                                const newPhone = pickDisplayPhone(`${o.phone || ''}\n${o.phone1 || ''}\n${o.phone2 || ''}`, '');
                                const newPhone2 = normalizeNumbers(o.phone2 || '');
                                const body: any = { id: o.id };
                                if (newPhone) body.phone = newPhone;
                                if (newPhone2) body.phone2 = newPhone2;
                                const res = await fetch(`${API_BASE_PATH}/api.php?module=orders&action=update`, {
                                  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
                                });
                                const jr = await res.json();
                                if (jr && jr.success) successCount++;
                              } catch (e) {
                                console.error('Normalize save failed for order', o.id, e);
                              }
                            }
                            Swal.close();
                            await Swal.fire('انتهى', `تم تحديث ${successCount} من ${toUpdate.length} طلبيات.`, 'success');
                            await refreshOrdersList();
                          }}
                          className="text-xs bg-yellow-50 dark:bg-yellow-950/40 hover:bg-yellow-100 dark:hover:bg-yellow-900/50 border border-yellow-200 dark:border-yellow-800 px-3 py-2 rounded-2xl font-bold text-yellow-700 dark:text-yellow-400 transition-colors"
                        >تحويل الأرقام</button>
                      </div>
                      <button onClick={handleParseScript} disabled={!scriptText || isParsing} className="bg-blue-600 text-white px-8 py-3 rounded-2xl font-black shadow-lg shadow-blue-500/20 disabled:opacity-50 flex gap-2">
                        {isParsing ? <RefreshCcw className="animate-spin" size={18}/> : <FileText size={18}/>} تحليل النص
                      </button>
              </div>
          </div>
          {parsedOrders.length > 0 && (
  <div className="space-y-4">
    <div className="flex justify-between items-center">
      <h3 className="font-bold text-slate-800 dark:text-slate-100">المعاينة ({parsedOrders.length})</h3>
      <button onClick={handleConfirmImport} className="bg-emerald-600 text-white px-6 py-2 rounded-xl font-bold shadow-lg">
        حفظ الكل
      </button>
    </div>

    {/* Dedicated Summary Panel for Issues Found in Script / Orders */}
    {(() => {
      const issueList: {
        orderId: any;
        orderIndex: number;
        orderName: string;
        orderNumber?: string;
        rawBlock?: string;
        issues: { text: string; type: 'product' | 'color' | 'size' | 'total' }[];
      }[] = [];

      parsedOrders.forEach((o, oIdx) => {
        const issues: { text: string; type: 'product' | 'color' | 'size' | 'total' }[] = [];
        (o.products || []).forEach((p: any) => {
          if (p.missingProduct) {
            issues.push({
              text: `المنتج "${p.name || 'بدون اسم'}" غير مسجل بقاعدة البيانات`,
              type: 'product'
            });
          } else {
            if (p.missingColor) {
              const avail = p.availableColors && p.availableColors.length > 0 ? ` (المسجل: ${p.availableColors.join('، ')})` : '';
              issues.push({
                text: `${p.name}: اللون "${p.color || 'غير محدد'}" غير مسجل${avail}`,
                type: 'color'
              });
            }
            if (p.missingSize) {
              const avail = p.availableSizes && p.availableSizes.length > 0 ? ` (المسجل: ${p.availableSizes.join('، ')})` : '';
              issues.push({
                text: `${p.name}: المقاس "${p.size || 'غير محدد'}" غير مسجل${avail}`,
                type: 'size'
              });
            }
          }
        });
        if (o.totalsMismatch) {
          const computedLines = Number(o.computedTotal || 0);
          const shp = Number(o.shipping || o.parsedShipping || 0);
          const expected = computedLines + shp;
          const entered = Number(o.rawTotal || o.parsedTotal || o.total || 0);
          issues.push({
            text: `إجمالي الأسطر (${computedLines.toFixed(2)} ج.م + شحن ${shp.toFixed(2)} ج.م = ${expected.toFixed(2)} ج.م) لا يتطابق مع الإجمالي المطلوب (${entered.toFixed(2)} ج.م)`,
            type: 'total'
          });
        }
        if (issues.length > 0) {
          issueList.push({
            orderId: o.id,
            orderIndex: oIdx + 1,
            orderName: o.name || `أوردر ${oIdx + 1}`,
            orderNumber: o.orderNumber,
            rawBlock: o.rawBlock,
            issues
          });
        }
      });

      if (issueList.length === 0) return null;

      return (
        <div className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/40 dark:to-orange-950/20 border-2 border-amber-300 dark:border-amber-800 rounded-2xl p-4 text-xs space-y-3 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-200 dark:border-amber-800/80 pb-2">
            <div className="flex items-center gap-2 font-bold text-amber-900 dark:text-amber-200 text-sm">
              <AlertTriangle className="text-amber-600 dark:text-amber-400 shrink-0" size={18} />
              <span>تقرير المشاكل والملاحظات المكتشفة في نص الأوردرات ({issueList.length} أوردر بحاجة لمراجعة أو اختيار):</span>
            </div>
            <span className="text-xs text-amber-800 dark:text-amber-300 bg-amber-100 dark:bg-amber-900/50 px-2.5 py-1 rounded-lg font-bold">
              💡 يمكنك اختيار اللون أو المقاس الصحيح مباشرة من القائمة المنسدلة في كارت الأوردر بالأسفل
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5 max-h-56 overflow-y-auto pr-1">
            {issueList.map((item, idx) => (
              <div key={idx} className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-amber-200 dark:border-amber-800 shadow-sm space-y-1.5">
                <div className="flex items-center justify-between font-bold text-slate-800 dark:text-slate-100 border-b border-slate-100 dark:border-slate-700 pb-1">
                  <span>#{item.orderIndex} - {item.orderName}</span>
                  {item.orderNumber && <span className="text-[11px] font-mono text-slate-400">#{item.orderNumber}</span>}
                </div>
                <ul className="space-y-1">
                  {item.issues.map((iss, iIdx) => (
                    <li key={iIdx} className="flex items-start gap-1.5 text-[11px]">
                      <span className={`inline-block w-1.5 h-1.5 rounded-full mt-1 shrink-0 ${iss.type === 'product' ? 'bg-rose-500' : 'bg-amber-500'}`} />
                      <span className={iss.type === 'product' ? 'text-rose-700 dark:text-rose-300 font-bold' : 'text-amber-800 dark:text-amber-200'}>
                        {iss.text}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      );
    })()}

    {/* Unified Import View Layout */}
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {parsedOrders.map((order: any) => {
        const hasMissing = (order.products || []).some((p: any) => !!p.missingProduct);
        const hasMissingVariant = (order.products || []).some((p: any) => !p.missingProduct && (p.missingSize || p.missingColor));
        const hasTotalsMismatch = !!order.totalsMismatch;
        const containerClass = hasMissing 
          ? 'bg-rose-50/50 dark:bg-rose-950/20 border-2 border-rose-300 dark:border-rose-800' 
          : (hasMissingVariant 
              ? 'bg-amber-50/40 dark:bg-amber-950/20 border border-amber-300 dark:border-amber-800'
              : (hasTotalsMismatch ? 'bg-yellow-50/40 dark:bg-yellow-950/20 border border-yellow-300 dark:border-yellow-800' : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700'));

        return (
          <div key={order.id} className={`p-4 rounded-2xl text-xs shadow-sm ${containerClass}`}>
            <div className="flex justify-between items-start mb-2 border-b border-slate-200 dark:border-slate-700 pb-2">
              <div>
                <span className="font-bold text-sm text-slate-800 dark:text-slate-100">{order.name}</span>
                {order.orderNumber && (
                  <span className="mr-2 text-[11px] font-mono text-slate-400">#{order.orderNumber}</span>
                )}
              </div>
              <div className="text-sm text-right">
                <div className="flex flex-col items-end gap-1">
                  <div className="text-xs text-slate-500 dark:text-slate-400">اجمالى الطلبيه</div>
                  <div className="font-mono font-black text-sm text-slate-800 dark:text-slate-100">
                    {Number(order.parsedSubtotal || order.parsedTotal || order.total || 0).toFixed(2)} ج.م
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">الشحن</div>
                  <div className="font-mono text-sm text-slate-800 dark:text-slate-200">
                    {Number(order.parsedShipping || order.shipping || 0).toFixed(2)} ج.م
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">المطلوب</div>
                  <div className="font-mono font-black text-sm text-slate-800 dark:text-slate-100">
                    {Number(order.requiredTotal || (Number(order.parsedSubtotal || 0) + Number(order.parsedShipping || 0))).toFixed(2)} ج.م
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-1 text-slate-500 dark:text-slate-400 mb-2">
              <p className="truncate">{order.governorate} - {order.address}</p>
              <p className="font-mono">{order.phone1}{order.phone2 && String(order.phone2).trim() !== '' ? ` - ${order.phone2}` : ''}</p>
            </div>

            {hasMissing && (
              <div className="mt-2 mb-2 p-3 bg-rose-100/80 dark:bg-rose-950/60 border border-rose-300 dark:border-rose-800 text-rose-900 dark:text-rose-200 rounded-xl text-xs space-y-1.5">
                <div className="font-bold flex items-center gap-1.5 text-sm">
                  <AlertCircle size={15} className="text-rose-600 dark:text-rose-400 shrink-0" />
                  <span>تنبيه: منتج غير مسجل في قاعدة البيانات:</span>
                </div>
                <ul className="list-disc list-inside space-y-1">
                  {(order.products || []).filter((p: any) => p.missingProduct).map((p: any, idx: number) => (
                    <li key={idx}>المنتج <span className="font-bold underline">"{p.name || 'بدون اسم'}"</span> غير مسجل</li>
                  ))}
                </ul>
                <div className="mt-2 flex gap-2 pt-1">
                  <button onClick={() => editParsedOrder(order)} className="bg-amber-500 hover:bg-amber-600 text-white px-3 py-1 rounded-lg text-xs font-bold transition-colors">تعديل الاوردر</button>
                  <button onClick={() => removeParsedOrder(order.id)} className="bg-rose-600 hover:bg-rose-700 text-white px-3 py-1 rounded-lg text-xs font-bold transition-colors">حذف الاوردر</button>
                </div>
              </div>
            )}

            {hasMissingVariant && (
              <div className="mt-2 mb-2 p-3 bg-amber-100/80 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200 rounded-xl text-xs space-y-1.5">
                <div className="font-bold flex items-center gap-1.5 text-sm">
                  <AlertTriangle size={15} className="text-amber-600 dark:text-amber-400 shrink-0" />
                  <span>تنبيه: لون أو مقاس غير مسجل في بطاقة المنتج:</span>
                </div>
                <ul className="list-disc list-inside space-y-1">
                  {(order.products || []).map((p: any, idx: number) => {
                    if (!p.missingColor && !p.missingSize) return null;
                    return (
                      <li key={idx}>
                        <span className="font-bold">{p.name}:</span>{' '}
                        {p.missingColor && (
                          <span>
                            اللون <b className="text-rose-600 dark:text-rose-400">"{p.color}"</b> غير متوفر{' '}
                            {p.availableColors && p.availableColors.length > 0 ? `(المتاح: ${p.availableColors.join('، ')})` : ''}
                          </span>
                        )}
                        {p.missingColor && p.missingSize && ' — '}
                        {p.missingSize && (
                          <span>
                            المقاس <b className="text-rose-600 dark:text-rose-400">"{p.size}"</b> غير متوفر{' '}
                            {p.availableSizes && p.availableSizes.length > 0 ? `(المتاح: ${p.availableSizes.join('، ')})` : ''}
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ul>
                <div className="mt-2 flex items-center gap-2 pt-1">
                  <button
                    onClick={() => allowSaveParsedOrderAsIs(order.id)}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${order.allowSaveAsIs ? 'bg-emerald-700 text-white shadow-sm' : 'bg-emerald-600 hover:bg-emerald-700 text-white'}`}
                  >
                    {order.allowSaveAsIs ? '✓ تم اعتماد الحفظ كما هي' : 'حفظ كما هي واستيراد'}
                  </button>
                  <button onClick={() => editParsedOrder(order)} className="bg-amber-500 hover:bg-amber-600 text-white px-3 py-1 rounded-lg text-xs font-bold transition-colors">تعديل الاوردر</button>
                </div>
              </div>
            )}

            {hasTotalsMismatch && (
              <div className="mt-2 mb-2 p-2.5 bg-yellow-100 dark:bg-yellow-950/60 border border-yellow-300 dark:border-yellow-800 text-yellow-800 dark:text-yellow-300 rounded-xl text-xs">
                إجمالي الأسطر ({Number(order.computedTotal || 0).toFixed(2)} ج.م) + الشحن ({Number(order.shipping || order.parsedShipping || 0).toFixed(2)} ج.م) = {(Number(order.computedTotal || 0) + Number(order.shipping || order.parsedShipping || 0)).toFixed(2)} ج.م لا يتطابق مع الإجمالي المُدخل ({Number(order.rawTotal || order.parsedTotal || order.total || 0).toFixed(2)} ج.م).
                <div className="mt-2 flex gap-2">
                  <button onClick={() => recalcParsedOrder(order.id)} className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1 rounded-lg text-xs font-bold">حساب قيمة الطلبية</button>
                  <button onClick={() => editParsedOrder(order)} className="bg-yellow-500 hover:bg-yellow-600 text-white px-3 py-1 rounded-lg text-xs font-bold">تعديل الاوردر</button>
                  <button onClick={() => removeParsedOrder(order.id)} className="bg-rose-600 hover:bg-rose-700 text-white px-3 py-1 rounded-lg text-xs font-bold">حذف الاوردر</button>
                </div>
              </div>
            )}

            <div className="mt-2 pt-2 border-t border-dashed border-slate-200 dark:border-slate-700">
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm font-bold text-slate-800 dark:text-slate-200">المنتجات</div>
                <div className="flex items-center gap-2">
                  <button onClick={() => addProductToParsedOrder(order.id)} className="bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/50 px-3 py-1 rounded-xl text-xs font-bold transition-colors">+ أضف منتج</button>
                </div>
              </div>
              
              {(order.products || []).map((p: any, i: number) => {
                return (
                  <div key={i} className="p-2.5 rounded-xl border border-slate-200/80 dark:border-slate-700/80 bg-slate-50/60 dark:bg-slate-900/40 mb-2">
                    <div className="flex justify-between items-start gap-2">
                      <div className="flex-1">
                        <div className="flex gap-1.5 items-center">
                          <input
                            value={p.name}
                            placeholder="اسم المنتج"
                            onChange={(e) => updateParsedProductField(order.id, i, 'name', e.target.value)}
                            className="w-1/2 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-slate-100 font-bold focus:outline-none focus:ring-1 focus:ring-blue-500 rounded px-2 py-1 border border-slate-200 dark:border-slate-700"
                          />
                          <input
                            value={p.size || ''}
                            placeholder="المقاس"
                            onChange={(e) => updateParsedProductField(order.id, i, 'size', e.target.value)}
                            className={`w-1/4 text-xs text-center font-bold placeholder-slate-400 dark:placeholder-slate-500 rounded px-1.5 py-1 border outline-none transition-colors ${p.missingSize ? 'border-amber-400 bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:ring-1 focus:ring-blue-500'}`}
                          />
                          <input
                            value={p.color || ''}
                            placeholder="اللون"
                            onChange={(e) => updateParsedProductField(order.id, i, 'color', e.target.value)}
                            className={`w-1/4 text-xs text-center font-bold placeholder-slate-400 dark:placeholder-slate-500 rounded px-1.5 py-1 border outline-none transition-colors ${p.missingColor ? 'border-amber-400 bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:ring-1 focus:ring-blue-500'}`}
                          />
                        </div>

                        {/* Dropdown selectors for registered colors/sizes when missing */}
                        {((p.missingColor && p.availableColors && p.availableColors.length > 0) || (p.missingSize && p.availableSizes && p.availableSizes.length > 0)) && (
                          <div className="mt-2 p-2 rounded-xl bg-amber-500/10 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700/70 space-y-2">
                            <div className="flex items-center gap-1.5 text-[11px] font-bold text-amber-900 dark:text-amber-200">
                              <AlertTriangle size={13} className="shrink-0 text-amber-600 dark:text-amber-400" />
                              <span>اختر من القائمة المنسدلة لتصحيح اللون أو المقاس:</span>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {/* Color Dropdown */}
                              {p.missingColor && p.availableColors && p.availableColors.length > 0 && (
                                <div className="space-y-1">
                                  <label className="text-[10px] font-bold text-amber-900 dark:text-amber-300 flex items-center justify-between">
                                    <span>🎨 ألوان المنتج المسجلة ({p.availableColors.length}):</span>
                                    {p.color && <span className="text-[9px] text-rose-500">الحالي: "{p.color}"</span>}
                                  </label>
                                  <select
                                    value=""
                                    onChange={(e) => {
                                      if (e.target.value) {
                                        updateParsedProductField(order.id, i, 'color', e.target.value);
                                      }
                                    }}
                                    className="w-full text-xs font-bold rounded-lg border border-amber-300 dark:border-amber-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 px-2 py-1.5 outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer shadow-sm"
                                  >
                                    <option value="" disabled>-- اختر اللون المطلوب --</option>
                                    {p.availableColors.map((c: string, ci: number) => (
                                      <option key={ci} value={c}>✓ {c}</option>
                                    ))}
                                  </select>
                                </div>
                              )}

                              {/* Size Dropdown */}
                              {p.missingSize && p.availableSizes && p.availableSizes.length > 0 && (
                                <div className="space-y-1">
                                  <label className="text-[10px] font-bold text-purple-900 dark:text-purple-300 flex items-center justify-between">
                                    <span>📏 مقاسات المنتج المسجلة ({p.availableSizes.length}):</span>
                                    {p.size && <span className="text-[9px] text-rose-500">الحالي: "{p.size}"</span>}
                                  </label>
                                  <select
                                    value=""
                                    onChange={(e) => {
                                      if (e.target.value) {
                                        updateParsedProductField(order.id, i, 'size', e.target.value);
                                      }
                                    }}
                                    className="w-full text-xs font-bold rounded-lg border border-purple-300 dark:border-purple-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 px-2 py-1.5 outline-none focus:ring-2 focus:ring-purple-500 cursor-pointer shadow-sm"
                                  >
                                    <option value="" disabled>-- اختر المقاس المطلوب --</option>
                                    {p.availableSizes.map((s: string, si: number) => (
                                      <option key={si} value={s}>✓ {s}</option>
                                    ))}
                                  </select>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-1 w-32 shrink-0">
                        <div className="flex items-center gap-1 w-full">
                          <span className="text-[10px] text-slate-400 shrink-0">العدد:</span>
                          <input
                            type="number"
                            min={1}
                            value={p.quantity}
                            onChange={(e) => updateParsedProductField(order.id, i, 'quantity', Number(e.target.value))}
                            className="w-full text-center px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs outline-none focus:ring-1 focus:ring-blue-500"
                          />
                        </div>
                        <div className="flex items-center gap-1 w-full">
                          <span className="text-[10px] text-slate-400 shrink-0">السعر:</span>
                          <input
                            type="number"
                            value={p.price}
                            onChange={(e) => updateParsedProductField(order.id, i, 'price', e.target.value)}
                            className="w-full text-center px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs outline-none focus:ring-1 focus:ring-blue-500"
                          />
                        </div>
                        <div className="flex gap-2 mt-0.5">
                          <button onClick={() => removeProductFromParsedOrder(order.id, i)} className="text-rose-600 dark:text-rose-400 text-xs font-bold hover:underline">حذف</button>
                          <button onClick={() => saveParsedOrderLine(order.id, i)} className="text-emerald-600 dark:text-emerald-400 text-xs font-bold hover:underline">حساب</button>
                        </div>
                      </div>
                    </div>

                    {/* Problem Indicators & 1-Click Fix Chips */}
                    {(p.missingProduct || p.missingColor || p.missingSize || p.rawLine) && (
                      <div className="mt-2 pt-1.5 border-t border-dashed border-slate-200 dark:border-slate-700/80 space-y-1.5">
                        {p.rawLine && (p.missingProduct || p.missingColor || p.missingSize) && (
                          <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono bg-slate-100 dark:bg-slate-800/80 px-2 py-0.5 rounded truncate" title={p.rawLine}>
                            السطر في النص: "{p.rawLine}"
                          </div>
                        )}

                        {p.missingProduct && (
                          <div className="flex items-center gap-1.5 text-rose-600 dark:text-rose-400 text-xs font-bold">
                            <AlertCircle size={13} className="shrink-0" />
                            <span>❌ المنتج غير مسجل في قاعدة البيانات</span>
                          </div>
                        )}

                        {p.missingColor && (
                          <div className="flex flex-wrap items-center gap-1 text-xs">
                            <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-400 font-bold">
                              <AlertTriangle size={12} className="shrink-0" />
                              <span>اللون "{p.color || 'غير محدد'}" غير مسجل</span>
                            </span>
                            {p.availableColors && p.availableColors.length > 0 && (
                              <span className="flex flex-wrap items-center gap-1 text-slate-500 dark:text-slate-400 mr-1">
                                <span className="text-[11px]">اختيار سريع:</span>
                                {p.availableColors.map((c: string, ci: number) => (
                                  <button
                                    key={ci}
                                    type="button"
                                    onClick={() => updateParsedProductField(order.id, i, 'color', c)}
                                    className="px-2 py-0.5 bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-800 rounded-md text-[11px] font-bold transition-all border border-blue-200 dark:border-blue-700 cursor-pointer active:scale-95"
                                    title={`اختيار اللون ${c}`}
                                  >
                                    {c}
                                  </button>
                                ))}
                              </span>
                            )}
                          </div>
                        )}

                        {p.missingSize && (
                          <div className="flex flex-wrap items-center gap-1 text-xs">
                            <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-400 font-bold">
                              <AlertTriangle size={12} className="shrink-0" />
                              <span>المقاس "{p.size || 'غير محدد'}" غير مسجل</span>
                            </span>
                            {p.availableSizes && p.availableSizes.length > 0 && (
                              <span className="flex flex-wrap items-center gap-1 text-slate-500 dark:text-slate-400 mr-1">
                                <span className="text-[11px]">اختيار سريع:</span>
                                {p.availableSizes.map((s: string, si: number) => (
                                  <button
                                    key={si}
                                    type="button"
                                    onClick={() => updateParsedProductField(order.id, i, 'size', s)}
                                    className="px-2 py-0.5 bg-purple-50 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 hover:bg-purple-200 dark:hover:bg-purple-800 rounded-md text-[11px] font-bold transition-all border border-purple-200 dark:border-purple-700 cursor-pointer active:scale-95"
                                    title={`اختيار المقاس ${s}`}
                                  >
                                    {s}
                                  </button>
                                ))}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  </div>
)}
        </div>
      )}
    </div>
  );
};

export default OrdersModule;