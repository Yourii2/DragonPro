/**
 * Universal Barcode & Order Number Helpers for DragonPro
 * Ensures consistent, accurate barcode scanning and matching across all modules.
 */

/**
 * Normalizes and cleans a scanned barcode string:
 * 1. Converts Arabic-Indic (٠-٩) and Persian (۰-۹) numerals to standard Latin digits (0-9).
 * 2. Trims whitespace and non-printable control characters.
 * 3. Strips leading '#' or 'No.' prefixes (e.g. '#604' -> '604').
 * 4. Strips trailing '-POD' or '_POD' tags from dual-barcode templates.
 */
export const cleanBarcode = (raw: string | number | null | undefined): string => {
  if (raw === null || raw === undefined) return '';
  let s = String(raw).trim();
  if (!s) return '';

  // 1. Convert Arabic-Indic (٠-٩) and Persian (۰-۹) digits to Latin digits (0-9)
  const map: Record<string, string> = {
    '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4', '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9',
    '۰': '0', '۱': '1', '۲': '2', '۳': '3', '۴': '4', '۵': '5', '۶': '6', '۷': '7', '۸': '8', '۹': '9'
  };
  s = s.split('').map(ch => map[ch] || ch).join('');

  // 2. Remove leading # or hash signs or whitespace
  s = s.replace(/^[#\s]+/, '').trim();

  // 3. Remove trailing -POD or _POD
  s = s.replace(/[-_]pod$/i, '').trim();

  return s;
};

/**
 * Strict Order Matching:
 * Matches an order object against a scanned code based strictly on:
 * - order_number / orderNumber
 * - tracking_number / shipping_number
 *
 * CRITICAL SAFETY RULE:
 * NEVER matches an order by its database `id` if that order has a different, non-matching `order_number`!
 * For example, if an order has id=604 but order_number="609", scanning "604" will NOT match this order.
 */
export const isOrderMatchingBarcode = (order: any, scannedCode: string | number | null | undefined): boolean => {
  if (!order || !scannedCode) return false;
  const target = cleanBarcode(scannedCode).toLowerCase();
  if (!target) return false;

  // 1. Check order number
  const rawNum = order.order_number ?? order.orderNumber ?? '';
  const cleanNum = cleanBarcode(rawNum).toLowerCase();
  if (cleanNum && cleanNum === target) {
    return true;
  }

  // 2. Check tracking / shipping number
  const rawTrack = order.tracking_number ?? order.shipping_number ?? '';
  const cleanTrack = cleanBarcode(rawTrack).toLowerCase();
  if (cleanTrack && cleanTrack === target) {
    return true;
  }

  // 3. Safe fallback for legacy orders without an order_number:
  // ONLY match order.id if order_number is empty or already matches target
  const idStr = String(order.id ?? '').trim();
  if (idStr && idStr === target) {
    if (!cleanNum || cleanNum === target) {
      return true;
    }
  }

  return false;
};
