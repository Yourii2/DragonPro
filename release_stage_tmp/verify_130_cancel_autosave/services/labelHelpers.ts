export const translateTxnLabel = (typeVal: any, descVal: any, txnVal?: any) => {
  const t = (typeVal || txnVal || descVal || '').toString().toLowerCase();
  const map: Record<string, string> = {
    expense: 'مصروف',
    revenue: 'إيراد',
    payment_in: 'إيداع',
    payment_out: 'دفعة',
    sale: 'مبيعات',
    purchase: 'شراء',
    deposit: 'إيداع',
    supplier_payment: 'دفعة لمورد',
    transfer_in: 'تحويل وارد',
    transfer_out: 'تحويل صادر',
    rep_payment_in: 'دفعة واردة من مندوب',
    rep_payment_out: 'دفعة للمندوب',
    rep_settlement: 'تسوية مندوب',
    advance: 'دفع مسبق',
    daily_open: 'بدء يومية',
    daily_close: 'تقفيل يوم',
    settlement: 'تسوية',
    adjustment: 'تسوية',
    return_in: 'مرتجع من عميل',
    return_out: 'مرتجع لمورد',
    transfer: 'نقل',
    penalty: 'غرامة',
    rep_penalty: 'غرامة',
    payment: 'دفع/قبض',
    refund: 'استرداد'
  };

  if (map[t]) return map[t];
  for (const k of Object.keys(map)) {
    if (t.includes(k)) return map[k];
  }
  const descStr = (descVal || '').toString();
  if (/[\u0600-\u06FF]/.test(descStr)) return descStr;
  return descStr || (typeVal || txnVal || '').toString() || '-';
};

export const translateMovementType = (t: string, details?: any) => {
  const s = (t || '').toString();
  const map: Record<string, string> = {
    receive_from_factory: 'استلام من المصنع',
    return_to_factory: 'ارتجاع الى المصنع',
    purchase: 'شراء من مورد',
    return_out: 'ارتجاع الى مورد',
    sale: 'مبيعات الى عميل',
    return_in: 'مرتجع من عميل',
    transfer: 'نقل',
    initial_balance: 'رصيد افتتاحي',
    adjustment: 'تسوية',
    manufacturing: 'استلام من المصنع'
  };

  // handle explicit transfer direction using details
  if (s.includes('transfer') || s === 'transfer') {
    try {
      const d = (typeof details === 'string' ? JSON.parse(details || '{}') : (details || {}));
      if (d && typeof d === 'object') {
        if (d.from) return 'نقل من مخزن';
        if (d.to) return 'نقل الى مخزن';
      }
    } catch (e) { /* ignore */ }
  }

  // direct map or substring match
  if (map[s]) return map[s];
  const found = Object.keys(map).find(k => s.includes(k));
  if (found) return map[found];

  // fallback: try details hints
  try {
    const d = (typeof details === 'string' ? JSON.parse(details || '{}') : (details || {}));
    if (d && typeof d === 'object') {
      if (d.to) return 'نقل الى مخزن';
      if (d.from) return 'نقل من مخزن';
      if (d.returnType && (d.returnType.toString().toLowerCase().includes('factory') || d.returnType.toString().toLowerCase().includes('to_factory'))) return 'ارتجاع الى المصنع';
    }
  } catch (e) { /* ignore */ }

  return t || '-';
};

export const formatMovementDetails = (details: any) => {
  if (!details) return '-';
  if (typeof details === 'string') {
    const s = details.trim();
    if (!s) return '-';
    try { details = JSON.parse(s); } catch { return s; }
  }
  if (!details || typeof details !== 'object') return String(details);

  const o: any = details;
  const parts: string[] = [];

  if (o.id) parts.push(`مرجع: ${o.id}`);
  if (o.reference_id) parts.push(`مرجع: ${o.reference_id}`);

  if (o.itemType || o.productId || o.product_id || o.name) {
    if (o.name) parts.push(`المنتج: ${o.name}`);
    if (o.color) parts.push(`اللون: ${o.color}`);
    if (o.size) parts.push(`المقاس: ${o.size}`);
    if (o.qty || o.quantity) parts.push(`الكمية: ${Number(o.qty||o.quantity||0)}`);
    if (o.costPrice || o.cost_price) parts.push(`سعر التكلفة: ${Number(o.costPrice||o.cost_price||0)}`);
    if (o.sellingPrice || o.selling_price) parts.push(`سعر البيع: ${Number(o.sellingPrice||o.selling_price||0)}`);
    if (o.barcode) parts.push(`الباركود: ${o.barcode}`);
    if (o.productId || o.product_id) parts.push(`معرّف المنتج: ${o.productId || o.product_id}`);
  }

  // transfer-specific
  if (o.to) parts.unshift(`تحويل إلى مخزن: ${o.to}`);
  if (o.from) parts.unshift(`استلام من مخزن: ${o.from}`);

  // return/other fields
  if (o.returnType) parts.push(`نوع المرتجع: ${o.returnType}`);
  if (o.total != null) parts.push(`الإجمالي: ${o.total}`);
  if (o.order_id || o.orderId) parts.push(`رقم الطلب: ${o.order_id || o.orderId}`);

  if (parts.length === 0) {
    // fallback: stringify
    try { return JSON.stringify(details); } catch { return String(details); }
  }
  return parts.join(' | ');
};
