import React, { useEffect, useMemo, useState, useRef } from 'react';
import Swal from 'sweetalert2';
import { API_BASE_PATH } from '../services/apiConfig';
import { User, Wallet, PackageCheck, PackageX, CheckCircle2, RefreshCw, Eye, LayoutGrid, List, ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Loader2, Receipt, Plus, Trash2, Banknote, Search, X, Filter } from 'lucide-react';
import CustomSelect from './CustomSelect';
import { formatLocalDate } from '../services/dateUtils';

// --- Helpers ---
const toNum = (v: any) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const parseNumeric = (v: any) => {
  if (v === null || typeof v === 'undefined') return 0;
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  let s = String(v || '').trim();
  if (s === '') return 0;
  const map: Record<string, string> = {
    '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4', '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9',
    '۰': '0', '۱': '1', '۲': '2', '۳': '3', '۴': '4', '۵': '5', '۶': '6', '۷': '7', '۸': '8', '۹': '9'
  };
  s = s.split('').map(ch => map[ch] || ch).join('').replace(/[\s,]+/g, '').replace(/[^0-9.\-]+/g, '');
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
};

const money = (n: number) => toNum(n).toLocaleString();
const normalizeText = (text: string) => (text || "").trim().replace(/[أإآ]/g, "ا").replace(/ة/g, "ه").replace(/\s+/g, " ");
const balanceLabel = (bal: number) => (bal > 0 ? 'له' : bal < 0 ? 'عليه' : '');
const balanceClass = (bal: number) => (bal > 0 ? 'text-emerald-600' : bal < 0 ? 'text-rose-600' : 'text-slate-600');

// --- Order Computation Helpers ---
const getRealOrderId = (o: any) => String(o?.order_id ?? o?.id ?? '');

const isExchangeOrder = (order: any) => {
  const status = String(order?.status || order?.order_status || order?.journal_status || '').toLowerCase();
  return status === 'exchange';
};

const computePieces = (order: any) => {
  const status = String(order?.status || order?.order_status || '').toLowerCase();
  if (status === 'returned' || status === 'full_return') return 0;
  if (status === 'exchange') return toNum(order?.delivered_pieces) || 1;
  const items = order.products || order.order_items || order.items || [];
  if (Array.isArray(items) && items.length > 0) return items.reduce((s: number, p: any) => s + toNum(p.quantity ?? p.qty ?? 0), 0);
  return toNum(order.pieces_count) || toNum(order.total_pieces) || 0;
};

const canPartialDeliver = (order: any) => {
  if (isExchangeOrder(order)) return false;
  const items = order?.products || order?.order_items || order?.items || [];
  if (Array.isArray(items) && items.length > 0) {
    if (items.length > 1) return true;
    const totalQty = items.reduce((s: number, p: any) => s + Math.max(toNum(p.quantity ?? p.qty ?? 0), 0) + Math.max(toNum(p.delivered_quantity ?? 0), 0), 0);
    return totalQty > 1;
  }
  const pieces = toNum(order?.pieces_count) || toNum(order?.total_pieces) || 0;
  return pieces > 1;
};

const computeOrderValueWithoutShipping = (order: any) => {
  if (Array.isArray(order.products) && order.products.length > 0) {
    return order.products.reduce((s: number, p: any) => {
      const qty = toNum(p.quantity ?? p.qty ?? 0);
      let lineTotal = parseNumeric(p.total ?? p.total_price ?? p.lineTotal ?? p.line_total ?? p.amount ?? p.value);
      if (!lineTotal || lineTotal === 0) {
        const unit = parseNumeric(p.price ?? p.price_per_unit ?? p.sale_price ?? p.salePrice ?? p.unit_price ?? p.unitPrice);
        lineTotal = unit * qty;
      }
      return s + toNum(lineTotal);
    }, 0);
  }
  const rawSub = parseNumeric(order.subTotal ?? order.total_amount ?? order.total ?? 0);
  const ship = parseNumeric(order.shipping ?? order.shipping_fees ?? order.shippingCost ?? 0);
  const totalField = parseNumeric(order.total ?? order.total_amount ?? 0);
  if ((!order.products || order.products.length === 0) && ship > 0 && totalField > 0 && Math.abs(rawSub - totalField) < 0.001) {
    return Math.max(0, rawSub - ship);
  }
  return rawSub;
};


const computeReturnedPieces = (order: any) => {
  const status = String(order?.status || order?.order_status || order?.journal_status || '').toLowerCase();
  if (status === 'with_rep') {
    return toNum(order?.returned_pieces) || 0;
  }
  if (status === 'exchange') {
    return toNum(order?.returned_pieces) || 1;
  }
  if (status === 'returned_with_rep') {
    return toNum(order?.returned_pieces_fallback);
  }
  const returnedPiecesFromMovements = toNum(order?.returned_pieces_fallback);
  if ((status === 'partial' || status === 'partial_return') && returnedPiecesFromMovements > 0) {
    return returnedPiecesFromMovements;
  }
  const directVal = toNum(order?.returned_pieces) || toNum(order?.returned_pieces_fallback);
  if (directVal > 0) return directVal;
  if (status === 'returned' || status === 'full_return') {
    const items = order.products || order.order_items || order.items || [];
    if (Array.isArray(items) && items.length > 0) {
      const fromItems = items.reduce((s: number, p: any) => s + toNum(p.quantity ?? p.qty ?? 0), 0);
      if (fromItems > 0) return fromItems;
    }
    return toNum(order?.pieces_count) || toNum(order?.total_pieces) || 0;
  }
  const items = order.products || order.order_items || order.items || [];
  if (Array.isArray(items) && items.length > 0) {
    return items.reduce((s: number, p: any) => s + toNum(p.returned_quantity ?? p.returnedPieces ?? 0), 0);
  }
  return 0;
};

const computeReturnedOrderValue = (order: any) => {
  const status = String(order?.status || order?.order_status || order?.journal_status || '').toLowerCase();
  if (status === 'with_rep') {
    return toNum(order?.returned_value) || 0;
  }
  if (status === 'exchange') {
    const rv = toNum(order?.returned_value);
    if (rv > 0) return rv;
    if (order?.exchange_details) {
      try {
        const ed = typeof order.exchange_details === 'string' ? JSON.parse(order.exchange_details) : order.exchange_details;
        return toNum(ed?.returned_total_value || ed?.returned_price || 0);
      } catch (e) {}
    }
    return 0;
  }
  if (status === 'returned_with_rep') {
    return toNum(order?.returned_value_fallback);
  }
  const returnedValueFromMovements = toNum(order?.returned_value_fallback);
  if ((status === 'partial' || status === 'partial_return') && returnedValueFromMovements > 0) {
    return returnedValueFromMovements;
  }
  
  // If explicitly a partial return status, try to sum returned items first
  const isPartialStatus = (status === 'partial' || status === 'partial_return');
  
  const items = order.products || order.order_items || order.items || [];
  if (Array.isArray(items) && items.length > 0) {
    let returnedVal = 0;
    let foundAnyRq = false;
    items.forEach((item: any) => {
      const rq = toNum(item.returned_quantity ?? item.returnedPieces ?? 0);
      if (rq > 0) foundAnyRq = true;
      const p = parseNumeric(item.price_per_unit ?? item.price ?? 0);
      returnedVal += rq * p;
    });
    // If we have specific item-level return data, use it
    if (foundAnyRq && returnedVal > 0) return returnedVal;
  }
  
  // If it's a full return, it should be the total value of items still in the list 
  // (In full returns, we keep the original quantities in the DB)
  if (status === 'returned' || status === 'full_return') {
    return computeOrderValueWithoutShipping(order);
  }
  
  // Fallback to the dedicated returned_value field passed by the API (which is correct for partials)
  return Math.max(toNum(order?.returned_value), toNum(order?.returned_value_fallback), 0);
};

const computeDeliveredNetPieces = (order: any) => {
  const status = String(order?.status || order?.order_status || order?.journal_status || '').toLowerCase();
  const jStatus = String(order?.journal_status || '').toLowerCase();
  if (status === 'exchange' || jStatus === 'exchange') {
    return toNum(order?.delivered_pieces) || 1;
  }
  if (status === 'returned' || status === 'full_return' || jStatus === 'returned' || jStatus === 'full_return') return 0;
  if (status === 'delivered' || jStatus === 'delivered') {
    const deliveredPieces = toNum(order?.delivered_pieces);
    if (deliveredPieces > 0) return deliveredPieces;
  }
  if (status === 'returned_with_rep' || jStatus === 'returned_with_rep') {
    const dp = toNum(order?.delivered_pieces);
    if (dp > 0) return dp;
    const prods = order?.products || order?.order_items || [];
    const fromProds = prods.reduce((s: number, p: any) => s + toNum(p.delivered_quantity || 0), 0);
    if (fromProds > 0) return fromProds;
    return 0;
  }
  // partial_return or partial without explicit delivered status:
  // this is a partial return from SalesUpdateStatus! Delivered pieces is 0 unless explicitly delivered.
  if (status === 'partial_return' || jStatus === 'partial_return' || status === 'partial') {
    const dp = toNum(order?.delivered_pieces);
    if (dp > 0) return dp;
    const prods = order?.products || order?.order_items || [];
    const fromProds = prods.reduce((s: number, p: any) => s + toNum(p.delivered_quantity || 0), 0);
    if (fromProds > 0) return fromProds;
    if (jStatus === 'delivered') {
      return computePieces(order);
    }
    return 0;
  }
  if (status === 'with_rep' || status === 'pending' || jStatus === 'with_rep') {
    const dp = toNum(order?.delivered_pieces);
    return dp > 0 ? dp : 0;
  }
  return computePieces(order);
};

const computeDeliveredNetValue = (order: any) => {
  const status = String(order?.status || order?.order_status || order?.journal_status || '').toLowerCase();
  const jStatus = String(order?.journal_status || '').toLowerCase();
  if (status === 'exchange' || jStatus === 'exchange') {
    const dv = toNum(order?.delivered_value);
    if (dv > 0) return dv;
    if (order?.exchange_details) {
      try {
        const ed = typeof order.exchange_details === 'string' ? JSON.parse(order.exchange_details) : order.exchange_details;
        return toNum(ed?.delivered_total_value || ed?.delivered_price || 0);
      } catch (e) {}
    }
    return computeOrderValueWithoutShipping(order);
  }
  if (status === 'returned' || status === 'full_return' || jStatus === 'returned' || jStatus === 'full_return') return 0;
  if (status === 'delivered' || jStatus === 'delivered') {
    const deliveredValue = toNum(order?.delivered_value);
    if (deliveredValue > 0) return deliveredValue;
  }
  if (status === 'returned_with_rep' || jStatus === 'returned_with_rep') {
    const dv = toNum(order?.delivered_value);
    if (dv > 0) return dv;
    const prods = order?.products || order?.order_items || [];
    const fromProds = prods.reduce((s: number, p: any) => s + (toNum(p.delivered_quantity || 0) * parseNumeric(p.price ?? p.price_per_unit ?? 0)), 0);
    if (fromProds > 0) return fromProds;
    return 0;
  }
  if (status === 'partial_return' || jStatus === 'partial_return' || status === 'partial') {
    const dv = toNum(order?.delivered_value);
    if (dv > 0) return dv;
    const prods = order?.products || order?.order_items || [];
    const fromProds = prods.reduce((s: number, p: any) => s + (toNum(p.delivered_quantity || 0) * parseNumeric(p.price ?? p.price_per_unit ?? 0)), 0);
    if (fromProds > 0) return fromProds;
    if (jStatus === 'delivered') {
      return computeOrderValueWithoutShipping(order);
    }
    return 0;
  }
  if (status === 'with_rep' || status === 'pending' || jStatus === 'with_rep') {
    const dv = toNum(order?.delivered_value);
    return dv > 0 ? dv : 0;
  }
  return computeOrderValueWithoutShipping(order);
};

const computeOriginalPieces = (order: any) => {
  return computeDeliveredNetPieces(order) + computeReturnedPieces(order);
};

const computeOriginalOrderValue = (order: any) => {
  return computeDeliveredNetValue(order) + computeReturnedOrderValue(order);
};

const computeActiveOrderDisplayValue = (order: any) => {
  return computeOrderValueWithoutShipping(order);
};

const isOrderPartialReturnInReturnedList = (order: any) => {
  if (isExchangeOrder(order)) return false;
  const st = String(order?.status || order?.order_status || order?.journal_status || '').toLowerCase();
  if (st === 'partial_return' || st === 'partial' || st === 'returned_with_rep') return true;
  if (computeDeliveredNetPieces(order) > 0) return true;
  // If order has remaining pieces in custody with the rep, it is a partial return
  if (computePieces(order) > 0) return true;
  return false;
};

const isPartialDeliveryOrder = (order: any) => {
  if (isExchangeOrder(order)) return false;
  const status = String(order?.status || order?.order_status || order?.journal_status || '').toLowerCase();
  return computeDeliveredNetPieces(order) > 0 && (
    computeReturnedPieces(order) > 0 || (status === 'returned_with_rep' && computePieces(order) > 0)
  );
};

const isPartialReturn = (order: any) => {
  if (isExchangeOrder(order)) return false;
  const status = String(order?.status || order?.order_status || order?.journal_status || '').toLowerCase();
  return (status === 'partial' || status === 'partial_return' || status === 'returned_with_rep') || (computeDeliveredNetPieces(order) > 0 && computeReturnedPieces(order) > 0);
};

const isFullReturnOrder = (order: any) => {
  if (isExchangeOrder(order)) return false;
  const status = String(order?.status || order?.order_status || '').toLowerCase();
  return ((status === 'returned' || status === 'full_return') && computePieces(order) === 0) || (computeReturnedPieces(order) > 0 && computeDeliveredNetPieces(order) === 0 && computePieces(order) === 0);
};

const isFullDeliveryOrder = (order: any) => !isExchangeOrder(order) && computeDeliveredNetPieces(order) > 0 && !isPartialDeliveryOrder(order);

const uniqOrdersById = (arr: any[]) => {
  const seen = new Set<string>();
  const out: any[] = [];
  for (const it of (arr || [])) {
    const id = String(it?.order_id ?? it?.id ?? '');
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(it);
  }
  return out;
};

// --- Component ---
const SalesDailyClose: React.FC = () => {
  const currencySymbol = 'ج.م';

  const [loading, setLoading] = useState(false);
  const [statsLoading, setStatsLoading] = useState(false);
  // Anti-double-click & Idempotency Submission Lock
  const [isClosingDaily, setIsClosingDaily] = useState(false);
  const isClosingDailyRef = useRef(false);

  // Core Data
  const [reps, setReps] = useState<any[]>([]);
  const [treasuries, setTreasuries] = useState<any[]>([]);
  const [userDefaults, setUserDefaults] = useState<any>(null);
  // Selections & Filters
  const [dailyFilter, setDailyFilter] = useState<'all' | 'open' | 'closed'>('all');
  const [selectedRepId, setSelectedRepId] = useState<string>('');
  const [selectedTreasuryId, setSelectedTreasuryId] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'electronic'>('cash');

  // Rep State & Payment Mode
  const [repBalance, setRepBalance] = useState<number>(0);
  const [paidAmount, setPaidAmount] = useState<number>(0);
  const [settlementDirection, setSettlementDirection] = useState<'collect' | 'pay'>('collect');
  const [openDailyInfo, setOpenDailyInfo] = useState<{ daily_code: string; id: number } | null>(null);

  // Interim Payments State (سداد دفعات تحت الحساب أثناء اليومية)
  const [interimPaymentAmount, setInterimPaymentAmount] = useState<number>(0);
  const [interimPaymentsList, setInterimPaymentsList] = useState<any[]>([]);
  const [isInterimModalOpen, setIsInterimModalOpen] = useState<boolean>(false);
  const [interimFormAmount, setInterimFormAmount] = useState<number>(0);
  const [interimFormTreasuryId, setInterimFormTreasuryId] = useState<string>('');
  const [interimFormNotes, setInterimFormNotes] = useState<string>('');
  const [interimSubmitting, setInterimSubmitting] = useState<boolean>(false);

  // Dual/Split Payment States
  const [isSplitPayment, setIsSplitPayment] = useState<boolean>(false);
  const [cashPaidAmount, setCashPaidAmount] = useState<number>(0);
  const [cashTreasuryId, setCashTreasuryId] = useState<string>('');
  const [electronicPaidAmount, setElectronicPaidAmount] = useState<number>(0);
  const [electronicTreasuryId, setElectronicTreasuryId] = useState<string>('');

  // Split Payment Auto Treasury Lock Effect
  useEffect(() => {
    if (!isSplitPayment || treasuries.length === 0) return;
    const electronicTreasury = treasuries.find(t => 
      normalizeText(t.name).includes('الكترونى') ||
      normalizeText(t.name).includes('الكترونية') ||
      normalizeText(t.name).includes('فودافون') ||
      normalizeText(t.name).includes('انستاباي') ||
      t.type === 'electronic' ||
      t.is_electronic == 1
    ) || treasuries.find(t => normalizeText(t.name).includes('الكترون')) || treasuries[0];

    if (electronicTreasury) {
      setElectronicTreasuryId(String(electronicTreasury.id));
    }

    if (userDefaults?.default_treasury_id) {
      setCashTreasuryId(String(userDefaults.default_treasury_id));
    } else if (!cashTreasuryId) {
      const cashTr = treasuries.find(t => String(t.id) !== String(electronicTreasury?.id)) || treasuries[0];
      if (cashTr) setCashTreasuryId(String(cashTr.id));
    }
  }, [isSplitPayment, treasuries, userDefaults]);

  // Transaction state
  const [repTxType, setRepTxType] = useState<'none' | 'bonus' | 'penalty'>('none');
  const [repTxAmount, setRepTxAmount] = useState<number>(0);
  const [repTxReason, setRepTxReason] = useState<string>('');
  const [repTxLoading, setRepTxLoading] = useState<boolean>(false);

  // Orders State
  const [activeOrders, setActiveOrders] = useState<any[]>([]);
  const [deferredOrders, setDeferredOrders] = useState<any[]>([]);
  const [deliveredOrders, setDeliveredOrders] = useState<any[]>([]);
  const [returnedOrders, setReturnedOrders] = useState<any[]>([]);
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);

  // UI State
  const [viewModal, setViewModal] = useState<'delivered' | 'returned' | 'deferred' | null>(null);
  const [modalFilter, setModalFilter] = useState<'all' | 'full' | 'partial' | 'exchange'>('all');
  const [activeOrdersViewMode, setActiveOrdersViewMode] = useState<'list' | 'card'>('card');
  const [activeOrdersSortOrder, setActiveOrdersSortOrder] = useState<'asc' | 'desc'>('desc');
  const [deferredOrdersViewMode, setDeferredOrdersViewMode] = useState<'list' | 'card'>('card');
  const [deferredOrdersSortOrder, setDeferredOrdersSortOrder] = useState<'asc' | 'desc'>('desc');

  // Partial Delivery Modal State
  const [partialDeliveryOrder, setPartialDeliveryOrder] = useState<any>(null);
  const [partialDeliveryQtys, setPartialDeliveryQtys] = useState<Record<number, number>>({});

  // Sorted Lists
  const activeOrdersSorted = useMemo(() => {
    return [...activeOrders].sort((a, b) => {
      const idA = Number(a.id);
      const idB = Number(b.id);
      return activeOrdersSortOrder === 'asc' ? idA - idB : idB - idA;
    });
  }, [activeOrders, activeOrdersSortOrder]);

  const deferredOrdersSorted = useMemo(() => {
    return [...deferredOrders].sort((a, b) => {
      const idA = Number(a.id);
      const idB = Number(b.id);
      return deferredOrdersSortOrder === 'asc' ? idA - idB : idB - idA;
    });
  }, [deferredOrders, deferredOrdersSortOrder]);

  // Derived Unified Lists (To solve partial return overlap where an order is both delivered and returned)
  const finalDeliveredList = useMemo(() => {
    const activeIds = new Set(activeOrders.map(getRealOrderId));
    const deferredIds = new Set(deferredOrders.map(getRealOrderId));
    const fromRet = returnedOrders.filter(o => computeDeliveredNetPieces(o) > 0);
    // Active orders that have partial delivery (delivered_pieces > 0)
    const fromActive = activeOrders.filter(o => {
      const st = String(o.status || o.order_status || o.journal_status || '').toLowerCase();
      return (st === 'returned_with_rep' || st === 'partial' || st === 'partial_return') && computeDeliveredNetPieces(o) > 0;
    });
    return uniqOrdersById([...deliveredOrders, ...fromRet, ...fromActive]).filter(o => {
      const id = getRealOrderId(o);
      const st = String(o.status || o.order_status || o.journal_status || '').toLowerCase();
      if (deferredIds.has(id)) return false;
      if (st === 'returned_with_rep' || st === 'partial' || st === 'partial_return') {
        return computeDeliveredNetPieces(o) > 0;
      }
      return !activeIds.has(id) && computeDeliveredNetPieces(o) > 0;
    });
  }, [deliveredOrders, returnedOrders, activeOrders, deferredOrders]);

  const finalReturnedList = useMemo(() => {
    const deferredIds = new Set(deferredOrders.map(getRealOrderId));
    return uniqOrdersById(returnedOrders).filter(o => {
      const id = getRealOrderId(o);
      const st = String(o.status || o.order_status || o.journal_status || '').toLowerCase();
      if (st === 'returned_with_rep') return false;
      if (st === 'with_rep' && toNum(o.returned_pieces) <= 0) return false;
      if (deferredIds.has(id)) return false;
      return computeReturnedPieces(o) > 0;
    });
  }, [returnedOrders, deferredOrders]);

  // Sub-breakdowns: Full vs Partial vs Exchange
  const delivExchangeList = useMemo(() => finalDeliveredList.filter(isExchangeOrder), [finalDeliveredList]);
  const delivFullList = useMemo(() => finalDeliveredList.filter(o => !isExchangeOrder(o) && computeDeliveredNetPieces(o) > 0 && !isPartialDeliveryOrder(o)), [finalDeliveredList]);
  const delivPartialList = useMemo(() => finalDeliveredList.filter(o => !isExchangeOrder(o) && isPartialDeliveryOrder(o)), [finalDeliveredList]);

  const returnExchangeList = useMemo(() => finalReturnedList.filter(isExchangeOrder), [finalReturnedList]);
  const returnFullList = useMemo(() => finalReturnedList.filter(o => !isExchangeOrder(o) && computeReturnedPieces(o) > 0 && !isOrderPartialReturnInReturnedList(o)), [finalReturnedList]);
  const returnPartialList = useMemo(() => finalReturnedList.filter(o => !isExchangeOrder(o) && computeReturnedPieces(o) > 0 && isOrderPartialReturnInReturnedList(o)), [finalReturnedList]);

  const delivFullPieces = useMemo(() => delivFullList.reduce((sum, o) => sum + computeDeliveredNetPieces(o), 0), [delivFullList]);
  const delivFullAmount = useMemo(() => delivFullList.reduce((sum, o) => sum + computeDeliveredNetValue(o), 0), [delivFullList]);

  const delivPartialPieces = useMemo(() => delivPartialList.reduce((sum, o) => sum + computeDeliveredNetPieces(o), 0), [delivPartialList]);
  const delivPartialAmount = useMemo(() => delivPartialList.reduce((sum, o) => sum + computeDeliveredNetValue(o), 0), [delivPartialList]);

  const delivExchangePieces = useMemo(() => delivExchangeList.reduce((sum, o) => sum + computeDeliveredNetPieces(o), 0), [delivExchangeList]);
  const delivExchangeAmount = useMemo(() => delivExchangeList.reduce((sum, o) => sum + computeDeliveredNetValue(o), 0), [delivExchangeList]);

  const returnFullPieces = useMemo(() => returnFullList.reduce((sum, o) => sum + computeReturnedPieces(o), 0), [returnFullList]);
  const returnFullAmount = useMemo(() => returnFullList.reduce((sum, o) => sum + computeReturnedOrderValue(o), 0), [returnFullList]);

  const returnPartialPieces = useMemo(() => returnPartialList.reduce((sum, o) => sum + computeReturnedPieces(o), 0), [returnPartialList]);
  const returnPartialAmount = useMemo(() => returnPartialList.reduce((sum, o) => sum + computeReturnedOrderValue(o), 0), [returnPartialList]);

  const returnExchangePieces = useMemo(() => returnExchangeList.reduce((sum, o) => sum + computeReturnedPieces(o), 0), [returnExchangeList]);
  const returnExchangeAmount = useMemo(() => returnExchangeList.reduce((sum, o) => sum + computeReturnedOrderValue(o), 0), [returnExchangeList]);

  // Derived Stats
  const deliveredPieces = useMemo(() => finalDeliveredList.reduce((sum, o) => sum + computeDeliveredNetPieces(o), 0), [finalDeliveredList]);
  const deliveredValue = useMemo(() => finalDeliveredList.reduce((sum, o) => sum + computeDeliveredNetValue(o), 0), [finalDeliveredList]);
  const returnedPieces = useMemo(() => finalReturnedList.reduce((sum, o) => sum + computeReturnedPieces(o), 0), [finalReturnedList]);
  const returnedValue = useMemo(() => finalReturnedList.reduce((sum, o) => sum + computeReturnedOrderValue(o), 0), [finalReturnedList]);
  const deferredPieces = useMemo(() => deferredOrders.reduce((sum, o) => sum + computePieces(o), 0), [deferredOrders]);
  const deferredValue = useMemo(() => deferredOrders.reduce((sum, o) => sum + computeOrderValueWithoutShipping(o), 0), [deferredOrders]);

  const currentDebt = useMemo(() => (repBalance < 0 ? Math.abs(repBalance) : 0), [repBalance]);
  const totalRequiredBeforeReturns = useMemo(() => (currentDebt + returnedValue + interimPaymentAmount), [currentDebt, returnedValue, interimPaymentAmount]);
  const netAfterReturns = useMemo(() => Math.max(0, totalRequiredBeforeReturns - returnedValue), [totalRequiredBeforeReturns, returnedValue]);

  const selectedRep = useMemo(() => reps.find(r => String(r.id) === String(selectedRepId)) || null, [reps, selectedRepId]);
  const selectedTreasuryName = useMemo(() => treasuries.find(t => String(t.id) === String(selectedTreasuryId))?.name || '', [treasuries, selectedTreasuryId]);
  const canChangeTreasury = useMemo(() => !userDefaults?.default_treasury_id || userDefaults.can_change_treasury !== false, [userDefaults]);

  // Counts for daily status tabs
  const repCounts = useMemo(() => {
    let openCount = 0;
    let closedCount = 0;
    reps.forEach(r => {
      if (Number(r.has_open_daily) === 1) openCount++;
      else closedCount++;
    });
    return { all: reps.length, open: openCount, closed: closedCount };
  }, [reps]);

  // Filtered reps based on dailyFilter
  const filteredReps = useMemo(() => {
    return reps.filter(r => {
      const isOpen = Number(r.has_open_daily) === 1;
      if (dailyFilter === 'open' && !isOpen) return false;
      if (dailyFilter === 'closed' && isOpen) return false;
      return true;
    });
  }, [reps, dailyFilter]);

  const repSelectOptions = useMemo(() => {
    return filteredReps.map(r => {
      const isOpen = Number(r.has_open_daily) === 1;
      const bal = toNum(r.balance ?? 0);
      return {
        value: String(r.id),
        searchLabel: `${r.name} ${r.id} ${r.open_daily_code || ''}`,
        label: (
          <div className="flex items-center justify-between gap-2 w-full py-0.5">
            <div className="flex items-center gap-2 min-w-0">
              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${isOpen ? 'bg-emerald-500 ring-2 ring-emerald-300 dark:ring-emerald-900 animate-pulse' : 'bg-slate-300 dark:bg-slate-600'}`} />
              <span className="font-bold truncate text-slate-800 dark:text-slate-200">{r.name}</span>
              <span className="text-[10px] text-slate-400 font-mono">#{r.id}</span>
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              {isOpen ? (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                  {r.open_daily_code || 'مفتوحة'}
                </span>
              ) : (
                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 border border-slate-200 dark:border-slate-700">
                  مغلقة
                </span>
              )}
              {bal !== 0 && (
                <span className={`text-[10px] font-bold ${bal > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                  ({money(Math.abs(bal))} {bal > 0 ? 'له' : 'عليه'})
                </span>
              )}
            </div>
          </div>
        )
      };
    });
  }, [filteredReps]);

  // --- Initial Load ---
  const loadInitialData = async () => {
    try {
      const [rRes, tRes, pRes] = await Promise.all([
        fetch(`${API_BASE_PATH}/api.php?module=users&action=getAllWithBalance&related_to_type=rep`).then(r => r.json()).catch(err => { console.warn('Reps load error', err); return null; }),
        fetch(`${API_BASE_PATH}/api.php?module=treasuries&action=getAll`).then(r => r.json()).catch(err => { console.warn('Treasuries load error', err); return null; }),
        fetch(`${API_BASE_PATH}/api.php?module=permissions&action=getUserDefaults`).then(r => r.json()).catch(() => null)
      ]);

      const repsList = rRes?.success ? (rRes.data || []).filter((u: any) => u.role === 'representative') : [];
      setReps(repsList);

      const tList = tRes?.success ? (tRes.data || []) : [];
      const defaults = pRes?.success ? (pRes.data || null) : null;
      setUserDefaults(defaults);

      setTreasuries(tList);
      if (defaults?.default_treasury_id) {
        setSelectedTreasuryId(String(defaults.default_treasury_id));
        setCashTreasuryId(String(defaults.default_treasury_id));
      } else if (tList.length > 0) {
        setSelectedTreasuryId(String(tList[0].id));
        setCashTreasuryId(String(tList[0].id));
      }
    } catch (e) {
      console.error('Initial load failed', e);
    }
  };

  useEffect(() => {
    loadInitialData();
  }, []);

  // --- Load Rep Data ---
  const loadRepData = async (repId: string) => {
    if (!repId) {
      setActiveOrders([]); setDeferredOrders([]); setDeliveredOrders([]); setReturnedOrders([]);
      setOpenDailyInfo(null); setSelectedOrderIds([]); setRepBalance(0); setPaidAmount(0);
      setInterimPaymentAmount(0); setInterimPaymentsList([]);
      return;
    }

    setStatsLoading(true);
    try {
      // 1. Refresh Rep Balance (pass rep_id to calculate only for this representative)
      const rRes = await fetch(`${API_BASE_PATH}/api.php?module=users&action=getAllWithBalance&related_to_type=rep&rep_id=${encodeURIComponent(repId)}`).then(r => r.json()).catch(() => null);
      if (rRes?.success) {
        const repsList = (rRes.data || []).filter((u: any) => u.role === 'representative');
        if (repsList.length > 0) {
          const rep = repsList.find((u: any) => String(u.id) === String(repId)) || repsList[0];
          const bal = toNum(rep?.balance ?? 0);
          setRepBalance(bal);
          setReps(prev => prev.map(r => String(r.id) === String(repId) ? { ...r, balance: bal } : r));
        }
        setPaidAmount(0); // لا يتم ملء المبلغ تلقائياً — يُدخله المستخدم يدوياً
      }

      // 2. Get Open Daily
      let openJournalId = 'none';
      const odResp = await fetch(`${API_BASE_PATH}/api.php?module=sales&action=getRepOpenDaily&rep_id=${repId}`).then(r => r.json()).catch(() => null);
      if (odResp?.success && odResp.data) {
        setOpenDailyInfo({ daily_code: odResp.data.daily_code || '', id: Number(odResp.data.id) });
        setReps(prev => prev.map(r => String(r.id) === String(repId) ? { ...r, has_open_daily: 1, open_daily_id: Number(odResp.data.id), open_daily_code: odResp.data.daily_code } : r));
        openJournalId = String(odResp.data.id);
        setInterimPaymentAmount(toNum(odResp.data.interim_payment_amount || 0));
        try {
          const rawP = odResp.data.interim_payments_json;
          const pList = typeof rawP === 'string' ? JSON.parse(rawP || '[]') : (rawP || []);
          setInterimPaymentsList(Array.isArray(pList) ? pList : []);
        } catch (e) {
          setInterimPaymentsList([]);
        }
      } else {
        setOpenDailyInfo(null);
        setReps(prev => prev.map(r => String(r.id) === String(repId) ? { ...r, has_open_daily: 0, open_daily_id: null, open_daily_code: null } : r));
        setInterimPaymentAmount(0);
        setInterimPaymentsList([]);
        setActiveOrders([]);
        setDeferredOrders([]);
        setDeliveredOrders([]);
        setReturnedOrders([]);
        setSelectedOrderIds([]);
        return;
      }

      // 3. Get Journal Orders & Rep Active Custody Orders
      let jDelivered: any[] = [];
      let jReturned: any[] = [];
      let jDeferred: any[] = [];
      let jActive: any[] = [];

      const journalParam = `&journal_ids=${openJournalId}`;
      const [ordersRes, custodyRes] = await Promise.all([
        fetch(`${API_BASE_PATH}/api.php?module=sales&action=getJournalOrders&rep_id=${encodeURIComponent(repId)}${journalParam}`).then(r => r.json()).catch(() => null),
        fetch(`${API_BASE_PATH}/api.php?module=orders&action=getByRep&rep_id=${encodeURIComponent(repId)}&status=active`).then(r => r.json()).catch(() => null)
      ]);

      if (ordersRes && ordersRes.success) {
        const rawDelivered = ordersRes.delivered || [];
        const rawReturned = ordersRes.returned || [];
        const rawDeferred = ordersRes.deferred || [];
        const rawActive = ordersRes.active || [];

        // returned_with_rep orders always belong in active (العهدة الحالية)
        // defensive: backend may still categorize them in delivered/returned if old code
        const isRetWithRep = (o: any) => {
          const s = String(o.status || o.order_status || o.journal_status || '').toLowerCase();
          return s === 'returned_with_rep';
        };
        const isPartialReturnOrd = (o: any) => {
          const s = String(o.status || o.order_status || o.journal_status || '').toLowerCase();
          return s === 'partial_return' || s === 'partial';
        };
        const extraActive = [
          ...rawDelivered.filter(isRetWithRep),
          ...rawReturned.filter(isRetWithRep),
        ];

        // Keep in jDelivered only if it has delivered_pieces > 0 (exclude returned_with_rep & partial_return)
        jDelivered = uniqOrdersById(rawDelivered.filter((o: any) => (!isRetWithRep(o) && !isPartialReturnOrd(o)) || toNum(o.delivered_pieces) > 0));
        // Keep in jReturned if returned_pieces > 0 (including partial_return) and not with_rep with 0 returned pieces
        jReturned  = uniqOrdersById(rawReturned.filter((o: any) => {
          if (isRetWithRep(o)) return toNum(o.returned_pieces) > 0;
          const st = String(o.status || o.order_status || o.journal_status || '').toLowerCase();
          if (st === 'with_rep' && toNum(o.returned_pieces) <= 0) return false;
          return true;
        }));
        jDeferred  = uniqOrdersById(rawDeferred);
        jActive    = uniqOrdersById([...rawActive, ...extraActive]);
      }

      // Merge all active orders in rep's custody (including "نزول" / postponed / with_rep)
      const custodyOrders = (custodyRes && custodyRes.success && Array.isArray(custodyRes.data)) ? custodyRes.data : [];
      if (custodyOrders.length > 0) {
        const deliveredIds = new Set(jDelivered.map(getRealOrderId));
        const returnedIds = new Set(jReturned.map(getRealOrderId));
        const deferredIds = new Set(jDeferred.map(getRealOrderId));
        const activeIds = new Set(jActive.map(getRealOrderId));

        for (const ord of custodyOrders) {
          const oid = getRealOrderId(ord);
          const isRetWithRepOrd = String(ord.status || ord.order_status || '').toLowerCase() === 'returned_with_rep';
          const isPartialOrd = String(ord.status || ord.order_status || '').toLowerCase() === 'partial';
          if (!oid) continue;
          if (!isRetWithRepOrd && !isPartialOrd && (deliveredIds.has(oid) || returnedIds.has(oid))) continue;
          if (deferredIds.has(oid) || activeIds.has(oid)) continue;

          const enrichedOrd = {
            ...ord,
            journal_id: Number(openJournalId),
            journalId: Number(openJournalId)
          };

          // All custody orders currently with the rep belong in active custody (العهدة الحالية)
          jActive.push(enrichedOrd);
          activeIds.add(oid);
        }
      }

      setDeliveredOrders(jDelivered);
      setReturnedOrders(jReturned);
      setDeferredOrders(uniqOrdersById(jDeferred));

      // 4. Filter Active Orders (Strictly unclosed orders currently with the rep)
      const finalDeferredIds = new Set(jDeferred.map(getRealOrderId));
      const finalDeliveredIds = new Set(jDelivered.map(getRealOrderId));
      const finalReturnedIds = new Set(jReturned.map(getRealOrderId));

      const filteredActive = uniqOrdersById(jActive).filter(o => {
        const id = getRealOrderId(o);
        if (!id) return false;
        if (finalDeferredIds.has(id)) return false;
        const status = String(o.status || '').toLowerCase();
        const orderStatus = String(o.order_status || '').toLowerCase();
        const journalStatus = String(o.journal_status || '').toLowerCase();
        const isRetWithRepOrder = (status === 'returned_with_rep' || orderStatus === 'returned_with_rep' || journalStatus === 'returned_with_rep');
        const isPartialReturnOrder = (status === 'partial_return' || orderStatus === 'partial' || journalStatus === 'partial_return' || status === 'partial');

        // If it's returned_with_rep or partial_return and still has remaining items, it MUST stay in active custody!
        if (isRetWithRepOrder || (isPartialReturnOrder && computePieces(o) > 0)) return true;

        if (finalReturnedIds.has(id)) return false;
        if (finalDeliveredIds.has(id)) return false;
        if (status === 'exchange' || orderStatus === 'exchange' || journalStatus === 'exchange') return false;
        if (status === 'delivered' || orderStatus === 'delivered' || journalStatus === 'delivered') return false;
        if (status === 'returned' || orderStatus === 'returned' || status === 'full_return' || orderStatus === 'full_return' || journalStatus === 'full_return' || journalStatus === 'returned') return false;
        if (journalStatus === 'deferred') return false;
        return true;
      });

      setActiveOrders(filteredActive);
      setSelectedOrderIds(filteredActive.map(o => getRealOrderId(o)));

    } catch (e) {
      console.error('Failed to load rep data', e);
    } finally {
      setStatsLoading(false);
    }
  };

  useEffect(() => {
    loadRepData(selectedRepId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRepId]);

  // --- Actions ---
  const toggleSelectAll = () => {
    if (selectedOrderIds.length === activeOrders.length) setSelectedOrderIds([]);
    else setSelectedOrderIds(activeOrders.map(o => getRealOrderId(o)));
  };

  const toggleSelectOrder = (id: string) => {
    setSelectedOrderIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const markSelectedDelivered = async () => {
    if (selectedOrderIds.length === 0) { Swal.fire('تحذير', 'اختر الاوردرات أولاً', 'warning'); return; }
    try {
      setLoading(true);
      const moved = activeOrders.filter(o => selectedOrderIds.includes(getRealOrderId(o)));
      const partialOrders: any[] = [];
      const fullIds: string[] = [];
      moved.forEach(o => {
        if (computeReturnedPieces(o) > 0) partialOrders.push(o); else fullIds.push(getRealOrderId(o));
      });

      // Update full deliveries in orders table
      if (fullIds.length > 0) {
        await Promise.all(fullIds.map(id => fetch(`${API_BASE_PATH}/api.php?module=orders&action=update`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: Number(id), status: 'delivered', rep_id: Number(selectedRepId), repId: Number(selectedRepId) })
        }).catch(() => null)));
      }

      const targetJournalId = openDailyInfo?.id ? Number(openDailyInfo.id) : undefined;
      // Update journal status
      if (fullIds.length > 0) {
        await fetch(`${API_BASE_PATH}/api.php?module=sales&action=updateJournalOrderStatus`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rep_id: Number(selectedRepId), order_ids: fullIds.map(Number), status: 'delivered', journal_id: targetJournalId })
        }).catch(() => null);
      }
      if (partialOrders.length > 0) {
        await Promise.all(partialOrders.map(async order => {
          const orderId = Number(getRealOrderId(order));
          const deliveredPieces = toNum(order.delivered_pieces) + computePieces(order);
          const deliveredValue = toNum(order.delivered_value) + computeOrderValueWithoutShipping(order);

          const orderResponse = await fetch(`${API_BASE_PATH}/api.php?module=orders&action=update`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: orderId, status: 'delivered', rep_id: Number(selectedRepId), repId: Number(selectedRepId) })
          });
          const orderResult = await orderResponse.json();
          if (!orderResult?.success) throw new Error(orderResult?.message || `فشل تحديث الأوردر #${orderId}.`);

          const journalResponse = await fetch(`${API_BASE_PATH}/api.php?module=sales&action=updateJournalOrderStatus`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              rep_id: Number(selectedRepId),
              order_ids: [orderId],
              status: 'delivered',
              journal_id: targetJournalId,
              delivered_pieces: deliveredPieces,
              delivered_value: deliveredValue
            })
          });
          const journalResult = await journalResponse.json();
          if (!journalResult?.success) throw new Error(journalResult?.message || `فشل حفظ تسليم الأوردر #${orderId}.`);
        }));
      }

      await loadRepData(selectedRepId);
      Swal.fire('تم', `تم تحديث حالة الاوردرات بنجاح.`, 'success');
    } catch (e) {
      console.error(e);
      Swal.fire('خطأ', 'فشل تحديث حالة الاوردرات.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleUndoOrder = async (orderId: string | number, undoType: 'delivery' | 'return') => {
    const res = await Swal.fire({
      title: undoType === 'delivery' ? 'إلغاء التسليم؟' : 'إلغاء المرتجع؟',
      text: undoType === 'delivery'
        ? 'ستعود القطع المسلمة إلى عهدة المندوب، مع الحفاظ على المنتجات المرتجعة كما هي.'
        : 'ستعود المنتجات المرتجعة إلى عهدة المندوب ويتم إلغاء أثر المرتجع.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'نعم، إرجاع',
      cancelButtonText: 'إلغاء'
    });
    if (!res.isConfirmed) return;

    try {
      setLoading(true);
      const req = await fetch(`${API_BASE_PATH}/api.php?module=sales&action=undoDailyCloseOrder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rep_id: selectedRepId, order_id: orderId, undo_type: undoType })
      });
      const data = await req.json();
      if (!data.success) throw new Error(data.message || 'خطأ في الاسترجاع');
      
      Swal.fire('نجاح', undoType === 'delivery' ? 'تم إلغاء التسليم وإعادة القطع المسلمة إلى عهدة المندوب.' : 'تم إلغاء المرتجع وإعادة المنتجات إلى عهدة المندوب.', 'success');
      
      if (selectedRepId) {
        await loadRepData(selectedRepId);
      }
      setViewModal(null);
    } catch (e: any) {
      Swal.fire('خطأ', e.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const moveSelectedToDeferred = async () => {
    if (selectedOrderIds.length === 0) { Swal.fire('تحذير', 'اختر الاوردرات أولاً', 'warning'); return; }
    try {
      setLoading(true);
      const movedIds = selectedOrderIds.map(Number);
      const targetJournalId = openDailyInfo?.id ? Number(openDailyInfo.id) : undefined;
      await fetch(`${API_BASE_PATH}/api.php?module=sales&action=updateJournalOrderStatus`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rep_id: Number(selectedRepId), order_ids: movedIds, status: 'deferred', journal_id: targetJournalId })
      });
      await Promise.all(movedIds.map(id => fetch(`${API_BASE_PATH}/api.php?module=orders&action=update`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: 'with_rep', rep_id: Number(selectedRepId), repId: Number(selectedRepId) })
      }).catch(() => null)));
      await loadRepData(selectedRepId);
      Swal.fire('تم', 'تم نقل الاوردرات المحددة إلى النزول (في عهدة المندوب).', 'success');
    } catch (e) {
      console.error(e);
      Swal.fire('خطأ', 'فشل نقل الاوردرات.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const moveSingleToDeferred = async (order: any) => {
    try {
      setLoading(true);
      const oid = Number(getRealOrderId(order));
      const targetJournalId = openDailyInfo?.id ? Number(openDailyInfo.id) : undefined;
      await fetch(`${API_BASE_PATH}/api.php?module=sales&action=updateJournalOrderStatus`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rep_id: Number(selectedRepId), order_ids: [oid], status: 'deferred', journal_id: targetJournalId })
      });
      await fetch(`${API_BASE_PATH}/api.php?module=orders&action=update`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: oid, status: 'with_rep', rep_id: Number(selectedRepId), repId: Number(selectedRepId) })
      }).catch(() => null);
      await loadRepData(selectedRepId);
    } catch (e) {
      console.error(e);
      Swal.fire('خطأ', 'فشل نقل الاوردر.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const moveDeferredBack = async (order: any) => {
    try {
      setLoading(true);
      const oid = Number(getRealOrderId(order));
      const targetJournalId = openDailyInfo?.id ? Number(openDailyInfo.id) : undefined;
      const res = await fetch(`${API_BASE_PATH}/api.php?module=sales&action=updateJournalOrderStatus`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rep_id: Number(selectedRepId), order_ids: [oid], status: 'with_rep', journal_id: targetJournalId })
      });
      const data = await res.json();
      if (!data?.success) throw new Error(data?.message || 'فشل استرجاع الاوردر.');

      await fetch(`${API_BASE_PATH}/api.php?module=orders&action=update`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: oid, status: 'with_rep', rep_id: Number(selectedRepId), repId: Number(selectedRepId) })
      });
      await loadRepData(selectedRepId);
      Swal.fire({
        toast: true,
        position: 'top-end',
        icon: 'success',
        title: 'تم إرجاع الأوردر للعهدة بنجاح',
        showConfirmButton: false,
        timer: 1500
      });
    } catch (e: any) {
      console.error(e);
      Swal.fire('خطأ', e.message || 'فشل استرجاع الاوردر.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const moveAllDeferredBack = async () => {
    if (deferredOrders.length === 0) return;
    const count = deferredOrders.length;
    const conf = await Swal.fire({
      title: 'إرجاع كل النزول؟',
      text: `سيتم إرجاع جميع أوردرات النزول (${count} أوردر) إلى قائمة العهدة الحالية للمندوب. هل أنت متأكد؟`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'نعم، إرجاع الكل',
      cancelButtonText: 'إلغاء'
    });
    if (!conf.isConfirmed) return;

    try {
      setLoading(true);
      const movedIds = deferredOrders.map(o => Number(getRealOrderId(o))).filter(id => id > 0);
      if (movedIds.length === 0) return;
      const targetJournalId = openDailyInfo?.id ? Number(openDailyInfo.id) : undefined;
      const res = await fetch(`${API_BASE_PATH}/api.php?module=sales&action=updateJournalOrderStatus`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rep_id: Number(selectedRepId), order_ids: movedIds, status: 'with_rep', journal_id: targetJournalId })
      });
      const data = await res.json();
      if (!data?.success) throw new Error(data?.message || 'فشل إرجاع الأوردرات.');

      await Promise.all(movedIds.map(id => fetch(`${API_BASE_PATH}/api.php?module=orders&action=update`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: 'with_rep', rep_id: Number(selectedRepId), repId: Number(selectedRepId) })
      }).catch(() => null)));
      await loadRepData(selectedRepId);
      Swal.fire('تم', `تم إرجاع جميع الأوردرات (${movedIds.length}) إلى العهدة الحالية بنجاح.`, 'success');
      setViewModal(null);
    } catch (e: any) {
      console.error(e);
      Swal.fire('خطأ', e.message || 'فشل إرجاع الأوردرات.', 'error');
    } finally {
      setLoading(false);
    }
  };

  // ============================================================
  // Partial Delivery Handler
  // Opens modal for a single order to choose quantities delivered.
  // Saves delivered and remaining items, updates order_items & orders table,
  // and keeps remaining products in active custody.
  // ============================================================
  const openPartialDeliveryModal = (order: any) => {
    const products = order.products || order.order_items || order.items || [];
    const initQtys: Record<number, number> = {};
    const isRetWithRep = String(order.status || order.order_status || order.journal_status || '').toLowerCase() === 'returned_with_rep';
    products.forEach((p: any, idx: number) => {
      if (p.delivered_quantity !== undefined && toNum(p.delivered_quantity) > 0) {
        initQtys[idx] = toNum(p.delivered_quantity);
      } else {
        initQtys[idx] = 0;
      }
    });
    setPartialDeliveryQtys(initQtys);
    setPartialDeliveryOrder(order);
  };

  const confirmPartialDelivery = async () => {
    if (!partialDeliveryOrder) return;
    const order = partialDeliveryOrder;
    const products = order.products || order.order_items || order.items || [];
    const orderId = Number(getRealOrderId(order));
    const repId = Number(selectedRepId);
    const targetJournalId = openDailyInfo?.id ? Number(openDailyInfo.id) : undefined;

    const itemsPayload: any[] = [];
    let deliveredCount = 0;
    let remainingCount = 0;

    products.forEach((p: any, idx: number) => {
      const originalQty = toNum(p.quantity ?? p.qty ?? 0) + toNum(p.delivered_quantity ?? 0);
      const deliveredQty = Math.min(toNum(partialDeliveryQtys[idx] ?? 0), originalQty);
      const remainingQty = originalQty - deliveredQty;
      const unitPrice = parseNumeric(p.price ?? p.price_per_unit ?? p.sale_price ?? p.unit_price ?? 0);

      deliveredCount += deliveredQty;
      remainingCount += remainingQty;

      itemsPayload.push({
        order_item_id: p.id || p.order_item_id || p.orderItemId,
        product_id: p.productId || p.product_id || p.id,
        original_quantity: originalQty,
        delivered_quantity: deliveredQty,
        remaining_quantity: remainingQty,
        price: unitPrice
      });
    });

    if (deliveredCount === 0) {
      Swal.fire('تنبيه', 'يجب اختيار كمية مسلمة لمنتج واحد على الأقل.', 'warning');
      return;
    }
    if (remainingCount === 0) {
      Swal.fire('تنبيه', 'إذا كانت كل الكميات مسلمة، استخدم زر "تم التسليم" بدلاً من "تسليم جزئي".', 'info');
      return;
    }

    setPartialDeliveryOrder(null);
    setLoading(true);

    try {
      const resp = await fetch(`${API_BASE_PATH}/api.php?module=sales&action=recordRepPartialDelivery`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rep_id: repId,
          order_id: orderId,
          journal_id: targetJournalId,
          items: itemsPayload
        })
      });
      const data = await resp.json();
      if (!data.success) {
        throw new Error(data.message || 'فشل تسجيل التسليم الجزئي');
      }

      await loadRepData(selectedRepId);
      Swal.fire({
        toast: true,
        position: 'top-end',
        icon: 'success',
        title: `تم حفظ التسليم الجزئي: تم تسليم ${data.delivered_pieces} قطع بقيمة ${money(data.delivered_value)} ${currencySymbol}، ومتبقي مع المندوب ${data.remaining_pieces} قطع بقيمة ${money(data.remaining_value)} ${currencySymbol}.`,
        showConfirmButton: false,
        timer: 4500
      });
    } catch (e: any) {
      console.error('Partial delivery failed', e);
      Swal.fire('خطأ', e.message || 'فشل تسجيل التسليم الجزئي. يرجى المحاولة مرة أخرى.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleUndoAllOrders = async (ordersList: any[], label: string, undoType: 'delivery' | 'return') => {
    if (!ordersList || ordersList.length === 0) {
      Swal.fire('تنبيه', 'لا توجد أوردرات لإرجاعها في هذه القائمة.', 'info');
      return;
    }
    const count = ordersList.length;
    const res = await Swal.fire({
      title: `إرجاع جميع أوردرات ${label}؟`,
      text: `سيتم استرجاع جميع الأوردرات (${count} أوردر) وإلغاء تسجيلها في اليومية وإعادتها لعهدة المندوب الحالية. هل أنت متأكد؟`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'نعم، إرجاع الكل',
      cancelButtonText: 'إلغاء'
    });
    if (!res.isConfirmed) return;

    try {
      setLoading(true);
      const orderIds = ordersList.map(o => Number(getRealOrderId(o))).filter(id => id > 0);
      const req = await fetch(`${API_BASE_PATH}/api.php?module=sales&action=undoDailyCloseOrder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rep_id: selectedRepId, order_ids: orderIds, undo_type: undoType })
      });
      const data = await req.json();
      if (!data.success) throw new Error(data.message || 'خطأ في استرجاع الأوردرات');

      Swal.fire('نجاح', `تم استرجاع جميع الأوردرات (${count}) لعهدة المندوب بنجاح.`, 'success');
      if (selectedRepId) {
        await loadRepData(selectedRepId);
      }
      setViewModal(null);
    } catch (e: any) {
      console.error(e);
      Swal.fire('خطأ', e.message || 'فشل استرجاع الأوردرات.', 'error');
    } finally {
      setLoading(false);
    }
  };

  // ============================================================
  // Interim Payments Handlers (دفعات تحت الحساب أثناء اليومية)
  // ============================================================
  const handleOpenInterimModal = () => {
    if (!selectedRepId) {
      Swal.fire('تنبيه', 'يرجى اختيار المندوب أولاً.', 'warning');
      return;
    }
    if (!openDailyInfo) {
      Swal.fire('تنبيه', 'المندوب ليس له يومية مفتوحة حالياً لتسجيل دفعة تحت الحساب.', 'warning');
      return;
    }
    setInterimFormAmount(0);
    setInterimFormNotes('');
    if (userDefaults?.default_treasury_id) {
      setInterimFormTreasuryId(String(userDefaults.default_treasury_id));
    } else if (selectedTreasuryId) {
      setInterimFormTreasuryId(selectedTreasuryId);
    } else if (treasuries.length > 0) {
      setInterimFormTreasuryId(String(treasuries[0].id));
    }
    setIsInterimModalOpen(true);
  };

  const handleRecordInterimPayment = async () => {
    const amt = Math.max(0, toNum(interimFormAmount));
    if (amt <= 0) {
      Swal.fire('تنبيه', 'يرجى إدخال مبلغ أكبر من صفر.', 'warning');
      return;
    }
    if (!interimFormTreasuryId) {
      Swal.fire('تنبيه', 'يرجى اختيار الخزينة المستلمة للمبلغ.', 'warning');
      return;
    }
    if (!openDailyInfo?.id) {
      Swal.fire('تنبيه', 'لا توجد يومية مفتوحة لهذا المندوب.', 'warning');
      return;
    }

    const trName = treasuries.find(t => String(t.id) === String(interimFormTreasuryId))?.name || '';
    const repName = selectedRep?.name || '';

    const conf = await Swal.fire({
      title: 'تأكيد سداد دفعة تحت الحساب',
      html: `
        <div style="text-align:right; line-height:1.9;">
          <div><b>المندوب:</b> ${repName}</div>
          <div><b>المبلغ:</b> <span style="font-size:16px; font-weight:bold; color:#059669;">${money(amt)} ${currencySymbol}</span></div>
          <div><b>الخزينة المستلمة:</b> ${trName}</div>
          ${interimFormNotes ? `<div><b>ملاحظات:</b> ${interimFormNotes}</div>` : ''}
          <div style="font-size:11px; color:#6b7280; margin-top:8px;">سيتم إضافة المبلغ للخزينة وخصمه فوراً من مديونية اليومية للمندوب.</div>
        </div>
      `,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'تأكيد السداد',
      cancelButtonText: 'إلغاء'
    });

    if (!conf.isConfirmed) return;

    try {
      setInterimSubmitting(true);
      let currentEmpName = userDefaults?.name || userDefaults?.username || '';
      if (!currentEmpName) {
        try {
          const u = JSON.parse(localStorage.getItem('Dragon_user') || '{}');
          currentEmpName = u.name || u.username || '';
        } catch (e) {}
      }
      const currentUserId = userDefaults?.user_id || userDefaults?.id || null;

      const res = await fetch(`${API_BASE_PATH}/api.php?module=sales&action=recordInterimDailyPayment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rep_id: Number(selectedRepId),
          journal_id: openDailyInfo.id,
          treasury_id: Number(interimFormTreasuryId),
          amount: amt,
          notes: interimFormNotes,
          employee: currentEmpName,
          created_by: currentUserId
        })
      });
      const data = await res.json();
      if (!data?.success) {
        throw new Error(data?.message || 'فشل تسجيل الدفعة تحت الحساب');
      }

      setIsInterimModalOpen(false);
      await loadRepData(selectedRepId);
      Swal.fire({
        icon: 'success',
        title: 'تم تسجيل الدفعة بنجاح',
        text: `تم استلام ${money(amt)} ${currencySymbol} في خزينة (${trName}) وخصمها من حساب المندوب.`,
        timer: 2500
      });
    } catch (err: any) {
      console.error('Interim payment failed', err);
      Swal.fire('خطأ', err.message || 'فشل الاتصال لتسجيل الدفعة.', 'error');
    } finally {
      setInterimSubmitting(false);
    }
  };

  const handleUndoInterimPayment = async (paymentIdOrTxId: any, amount: number) => {
    const txId = Number(paymentIdOrTxId);
    if (!txId) {
      Swal.fire('خطأ', 'معرف الدفعة غير صالح أو غير موجود', 'error');
      return;
    }

    const conf = await Swal.fire({
      title: 'إلغاء دفعة تحت الحساب؟',
      text: `هل تريد بالتأكيد إلغاء هذه الدفعة (${money(amount)} ${currencySymbol})؟ سيتم عكس رصيد الخزينة وإعادة المبلغ لحساب المندوب.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'نعم، إلغاء الدفعة',
      cancelButtonText: 'تراجع',
      confirmButtonColor: '#e11d48'
    });

    if (!conf.isConfirmed) return;

    try {
      setLoading(true);
      const res = await fetch(`${API_BASE_PATH}/api.php?module=sales&action=undoInterimDailyPayment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rep_id: Number(selectedRepId),
          journal_id: Number(openDailyInfo?.id || 0),
          tx_id: txId,
          payment_id: txId
        })
      });
      const data = await res.json();
      if (!data?.success) {
        throw new Error(data?.message || 'فشل إلغاء الدفعة');
      }
      await loadRepData(selectedRepId);
      Swal.fire('تم', 'تم إلغاء الدفعة تحت الحساب وعكس المعاملة بنجاح.', 'success');
    } catch (err: any) {
      console.error('Undo interim payment failed', err);
      Swal.fire('خطأ', err.message || 'تعذر إلغاء الدفعة.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleFinancialTx = async () => {
    if (!selectedRepId || repTxType === 'none') return;
    const amt = Math.max(0, toNum(repTxAmount));
    if (amt <= 0) { Swal.fire('مبلغ غير صالح', 'ادخل مبلغًا أكبر من صفر', 'warning'); return; }
    try {
      setRepTxLoading(true);
      const payload: any = {
        related_to_type: 'rep', related_to_id: Number(selectedRepId), amount: amt, details: { reason: repTxReason }
      };
      if (repTxType === 'bonus') {
        payload.type = 'rep_bonus_in'; payload.direction = 'in'; payload.title = `حافز للمندوب`; payload.memo = repTxReason || 'حافز';
      } else {
        payload.type = 'rep_penalty'; payload.direction = 'out'; payload.title = `غرامة للمندوب`; payload.memo = repTxReason || 'غرامة';
      }
      if (selectedTreasuryId) payload.treasuryId = Number(selectedTreasuryId);

      const r = await fetch(`${API_BASE_PATH}/api.php?module=transactions&action=create`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
      });
      const j = await r.json();
      if (j?.success) {
        Swal.fire('تم', repTxType === 'bonus' ? 'تم إضافة الحافز وتحديث حساب المندوب.' : 'تم تطبيق الغرامة.', 'success');
        setRepTxAmount(0); setRepTxReason(''); setRepTxType('none');
        await loadRepData(selectedRepId);
      } else {
        Swal.fire('فشل العملية', j?.message || 'تعذر تسجيل المعاملة.', 'error');
      }
    } catch (e) {
      console.error('tx failed', e);
      Swal.fire('خطأ', 'فشل الاتصال أثناء تسجيل المعاملة.', 'error');
    } finally {
      setRepTxLoading(false);
    }
  };

  const handleCloseDaily = async () => {
    if (isClosingDailyRef.current) return;
    if (!selectedRepId) { Swal.fire('اختر المندوب', 'يرجى اختيار المندوب أولاً.', 'warning'); return; }
    if (!openDailyInfo) { Swal.fire('تنبيه', 'المندوب ليس له يومية مفتوحة حالياً.', 'warning'); return; }

    const cashAmt = isSplitPayment ? Math.max(0, toNum(cashPaidAmount)) : 0;
    const elecAmt = isSplitPayment ? Math.max(0, toNum(electronicPaidAmount)) : 0;
    const amount = isSplitPayment ? (cashAmt + elecAmt) : Math.max(0, toNum(paidAmount));

    if (amount > 0) {
      if (isSplitPayment) {
        if (cashAmt > 0 && !cashTreasuryId) { Swal.fire('اختر الخزينة', 'يرجى اختيار الخزينة النقدية.', 'warning'); return; }
        if (elecAmt > 0 && !electronicTreasuryId) { Swal.fire('اختر الخزينة', 'يرجى اختيار خزينة المدفوعات الإلكترونية.', 'warning'); return; }
      } else {
        if (!selectedTreasuryId) { Swal.fire('اختر الخزينة', 'يرجى اختيار الخزينة لإتمام التقفيل.', 'warning'); return; }
      }
    }

    const repName = selectedRep?.name || '';
    const treasuryDisplay = isSplitPayment 
      ? `مزدوج (كاش: ${money(cashAmt)} ج.م + إلكتروني: ${money(elecAmt)} ج.م)`
      : (selectedTreasuryName || selectedTreasuryId || '—');

    const estimatedRemainingVal = settlementDirection === 'collect' ? (repBalance + amount) : (repBalance - amount);
    const finalRemainingDisplay = Math.abs(estimatedRemainingVal);
    const finalRemainingLabel = balanceLabel(estimatedRemainingVal);

    const res = await Swal.fire({
      title: 'تأكيد تصفية وإغلاق اليومية',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'تأكيد الإغلاق',
      cancelButtonText: 'تراجع',
      confirmButtonColor: '#059669',
      html: `
        <div style="text-align:right; line-height:1.8; font-size:12px;">
          <div style="border-bottom:1px solid #e2e8f0; padding-bottom:6px; margin-bottom:8px;">
            <div><b>المندوب:</b> ${repName}</div>
            <div><b>رقم اليومية:</b> ${openDailyInfo?.daily_code || '---'}</div>
            <div><b>الخزينة المستلمة:</b> ${treasuryDisplay}</div>
            <div><b>طريقة التسوية:</b> ${settlementDirection === 'collect' ? 'تحصيل من المندوب' : 'دفع إلى المندوب'}</div>
          </div>

          <div style="background:#f8fafc; padding:8px 10px; border-radius:8px; border:1px solid #e2e8f0; margin-bottom:8px;">
            <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
              <span><b>1. إجمالي المطلوب قبل خصم المرتجعات:</b></span>
              <span style="font-weight:bold; direction:ltr;">${money(totalRequiredBeforeReturns)} ${currencySymbol}</span>
            </div>
            
            <div style="display:flex; justify-content:space-between; color:#dc2626; margin-bottom:4px;">
              <span>(-) يُخصم: إجمالي المرتجع (${finalReturnedList.length} طلب):</span>
              <span style="font-weight:bold; direction:ltr;">- ${money(returnedValue)} ${currencySymbol}</span>
            </div>

            <div style="display:flex; justify-content:space-between; color:#92400e; background:#fef3c7; padding:3px 6px; border-radius:4px; margin-bottom:4px; font-weight:bold;">
              <span>= الصافي بعد خصم المرتجع:</span>
              <span style="direction:ltr;">${money(netAfterReturns)} ${currencySymbol}</span>
            </div>

            <div style="display:flex; justify-content:space-between; color:#059669; margin-bottom:4px;">
              <span>(-) يُخصم: دفعات مسددة أثناء اليومية (${interimPaymentsList.length} دفعة):</span>
              <span style="font-weight:bold; direction:ltr;">- ${money(interimPaymentAmount)} ${currencySymbol}</span>
            </div>

            <div style="display:flex; justify-content:space-between; color:#1e293b; padding-top:4px; border-top:1px dashed #cbd5e1; font-weight:bold;">
              <span>= المبلغ المطلوب تسويته للتقفيل الآن:</span>
              <span style="direction:ltr;">${money(currentDebt)} ${currencySymbol} ${repBalance !== 0 ? `(${balanceLabel(repBalance)})` : ''}</span>
            </div>
          </div>

          <div style="background:#ecfdf5; padding:8px 10px; border-radius:8px; border:1px solid #a7f3d0; margin-bottom:8px;">
            <div style="display:flex; justify-content:space-between; color:#065f46; font-size:13px; font-weight:bold;">
              <span>(-) المبلغ المدفوع للتقفيل الآن:</span>
              <span style="direction:ltr;">- ${money(amount)} ${currencySymbol}</span>
            </div>
            ${interimPaymentAmount > 0 ? `
            <div style="display:flex; justify-content:space-between; color:#047857; font-size:11px; margin-top:2px;">
              <span>إجمالي المحصل لليومية بالكامل (تحت الحساب + تقفيل):</span>
              <span style="font-weight:bold; direction:ltr;">${money(interimPaymentAmount + amount)} ${currencySymbol}</span>
            </div>
            ` : ''}
          </div>

          <div style="display:flex; justify-content:space-between; background:#fff1f2; padding:8px 10px; border-radius:8px; border:1px solid #fecdd3; font-weight:bold;">
            <span>(=) الرصيد المتبقي النهائي بعد الإغلاق:</span>
            <span style="color:#be123c; font-size:14px; direction:ltr;">${money(finalRemainingDisplay)} ${currencySymbol} ${finalRemainingDisplay !== 0 ? `(${finalRemainingLabel})` : '(خالص)'}</span>
          </div>
        </div>
      `
    });

    if (!res.isConfirmed) return;

    if (isClosingDailyRef.current) return;
    isClosingDailyRef.current = true;
    setIsClosingDaily(true);
    setLoading(true);

    const idempotencyToken = 'close_' + Date.now() + '_' + Math.random().toString(36).slice(2);

    try {
      let settleSuccess = false;
      let currentEmpName = userDefaults?.name || userDefaults?.username || '';
      if (!currentEmpName) {
        try {
          const u = JSON.parse(localStorage.getItem('Dragon_user') || '{}');
          currentEmpName = u.name || u.username || '';
        } catch (e) {}
      }
      const currentUserId = userDefaults?.user_id || userDefaults?.id || null;

      if (amount <= 0) {
        settleSuccess = true;
      } else if (settlementDirection === 'collect') {
        const payload: any = {
          repId: Number(selectedRepId),
          journal_id: openDailyInfo ? Number(openDailyInfo.id) : 0,
          idempotency_token: idempotencyToken,
          created_by: currentUserId,
          employee: currentEmpName,
          title: 'تحصيل من المندوب فى اغلاق اليوميه',
          notes: 'تحصيل من المندوب فى اغلاق اليوميه'
        };
        if (isSplitPayment) {
          const splits = [];
          if (cashAmt > 0) splits.push({ treasuryId: Number(cashTreasuryId), paidAmount: cashAmt, type: 'cash', title: 'تحصيل من المندوب فى اغلاق اليوميه' });
          if (elecAmt > 0) splits.push({ treasuryId: Number(electronicTreasuryId), paidAmount: elecAmt, type: 'electronic', title: 'تحصيل من المندوب فى اغلاق اليوميه' });
          payload.splitPayments = splits;
        } else {
          payload.treasuryId = Number(selectedTreasuryId);
          payload.paidAmount = amount;
        }
        payload.details = {
          context: 'close_daily',
          action: 'settleDaily',
          title: 'تحصيل من المندوب فى اغلاق اليوميه',
          notes: 'تحصيل من المندوب فى اغلاق اليوميه',
          reason: 'تحصيل من المندوب فى اغلاق اليوميه',
          rep_id: Number(selectedRepId),
          journal_id: openDailyInfo ? Number(openDailyInfo.id) : 0,
          created_by: currentUserId,
          created_by_name: currentEmpName,
          employee_name: currentEmpName,
          idempotency_token: idempotencyToken
        };

        const r = await fetch(`${API_BASE_PATH}/api.php?module=sales&action=settleDaily`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        const j = await r.json();
        settleSuccess = j?.success;
        if (!settleSuccess) Swal.fire('فشل العملية', j?.message || 'تعذر التقفيل المالي.', 'error');
      } else {
        const txPayload = {
          type: 'rep_payment_out',
          related_to_type: 'rep',
          related_to_id: Number(selectedRepId),
          journal_id: openDailyInfo ? Number(openDailyInfo.id) : 0,
          amount: amount,
          treasuryId: Number(selectedTreasuryId || cashTreasuryId),
          direction: 'out',
          created_by: currentUserId,
          employee: currentEmpName,
          title: 'دفع الى المندوب فى اغلاق اليوميه',
          notes: 'دفع الى المندوب فى اغلاق اليوميه',
          details: {
            context: 'close_daily',
            action: 'settleDaily',
            title: 'دفع الى المندوب فى اغلاق اليوميه',
            notes: 'دفع الى المندوب فى اغلاق اليوميه',
            reason: 'دفع الى المندوب فى اغلاق اليوميه',
            rep_id: Number(selectedRepId),
            created_by: currentUserId,
            created_by_name: currentEmpName,
            employee_name: currentEmpName,
            idempotency_token: idempotencyToken
          },
          idempotency_token: idempotencyToken
        };
        const r2 = await fetch(`${API_BASE_PATH}/api.php?module=transactions&action=create`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(txPayload) });
        const j2 = await r2.json();
        settleSuccess = j2?.success;
        if (!settleSuccess) Swal.fire('فشل العملية', j2?.message || 'تعذر تسجيل عملية الدفع.', 'error');
      }

      if (settleSuccess) {

        await fetch(`${API_BASE_PATH}/api.php?module=sales&action=logCloseDaily`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rep_id: Number(selectedRepId), treasury_id: selectedTreasuryId ? Number(selectedTreasuryId) : null, paid_amount: amount, direction: settlementDirection, event_date: formatLocalDate(), notes: 'اغلاق اليوميه تلقائيا', employee: currentEmpName, created_by: currentUserId })
        }).catch(() => null);

        const closeResp = await fetch(`${API_BASE_PATH}/api.php?module=sales&action=closeRepDaily`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            rep_id: Number(selectedRepId),
            journal_id: openDailyInfo ? openDailyInfo.id : 0,
            employee: currentEmpName,
            created_by: currentUserId,
            prev_balance: repBalance,
            payment_amount: amount,
            payment_action: amount === 0 ? 'none' : settlementDirection,
            balance_after_payment: amount === 0 ? repBalance : (settlementDirection === 'collect' ? (repBalance + amount) : (repBalance - amount)),
            delivered_orders_count: finalDeliveredList.length,
            delivered_pieces: deliveredPieces,
            delivered_value: deliveredValue,
            returned_orders_count: finalReturnedList.length,
            returned_pieces: returnedPieces,
            returned_value: returnedValue,
            postponed_orders_count: deferredOrders.length,
            postponed_pieces: deferredPieces,
            postponed_value: deferredValue
          })
        });
        const closeJson = await closeResp.json().catch(() => null);
        if (!closeJson?.success) {
          Swal.fire('تنبيه', closeJson?.message || 'تعذر إغلاق اليومية.', 'warning');
        } else {
          // Trigger Print automatically
          handlePrintDailyClose();

          Swal.fire('تم', amount > 0 ? 'تم التقفيل وإغلاق اليومية بنجاح.' : 'تم إغلاق اليومية بنجاح بدون حركة مالية.', 'success').then(() => {
            // Reset Page Completely
            setSelectedRepId('');
            setIsSplitPayment(false);
            setCashPaidAmount(0);
            setElectronicPaidAmount(0);
            setInterimPaymentAmount(0);
            setInterimPaymentsList([]);
          });
        }
      } else {
        await loadRepData(selectedRepId);
      }
    } catch (e) {
      console.error('Close daily failed', e);
      Swal.fire('خطأ', 'فشل الاتصال بالخادم أثناء التقفيل.', 'error');
    } finally {
      isClosingDailyRef.current = false;
      setIsClosingDaily(false);
      setLoading(false);
    }
  };

  const handleElectronicTreasury = async () => {
    setPaymentMethod('electronic');
    const eName = 'مدفوعات إليكترونية';
    setLoading(true);
    try {
      const trResp = await fetch(`${API_BASE_PATH}/api.php?module=treasuries&action=getAll`).then(r => r.json());
      let list = trResp?.success ? trResp.data || [] : treasuries;
      let found = list.find((t: any) => normalizeText(t.name) === normalizeText(eName));
      if (!found) {
        const createRes = await fetch(`${API_BASE_PATH}/api.php?module=treasuries&action=create`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: eName, balance: 0 })
        });
        const createJson = await createRes.json();
        const trResp2 = await fetch(`${API_BASE_PATH}/api.php?module=treasuries&action=getAll`).then(r => r.json());
        list = trResp2?.success ? trResp2.data || [] : list;
        setTreasuries(list);
        found = list.find((t: any) => normalizeText(t.name) === normalizeText(eName));
        if (!found && createJson?.success && createJson.data?.id) found = createJson.data;
      }
      if (found) setSelectedTreasuryId(String(found.id));
    } catch (e) {
      console.error('Electronic setup failed', e);
    } finally {
      setLoading(false);
    }
  };

  const handlePrintDailyClose = () => {
    if (!selectedRepId) { Swal.fire('تنبيه', 'يجب اختيار المندوب أولاً لطباعة يوميته.', 'warning'); return; }
    const pDate = formatLocalDate();
    const pTime = new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
    const pRepName = selectedRep?.name || '';
    const pTotal = repBalance;
    const pTreasury = isSplitPayment 
      ? `مزدوج (كاش: ${money(cashPaidAmount)} ج.م + إلكتروني: ${money(electronicPaidAmount)} ج.م)`
      : (selectedTreasuryName || 'مدفوعات إليكترونية');
    const pAmount = isSplitPayment ? (cashPaidAmount + electronicPaidAmount) : paidAmount;
    
    // Generate Rows for Delivered
    const delivHTML = finalDeliveredList.map(o => {
      const isEx = isExchangeOrder(o);
      const isPartial = isPartialDeliveryOrder(o);
      const badgeText = isEx ? '<span style="font-size:10px;color:#7e22ce;font-weight:bold;">(استبدال)</span>' : isPartial ? '<span style="font-size:10px;color:#d97706;">(جزئي)</span>' : '';
      return `<tr>
        <td style="padding:4px;border:1px solid #ccc;text-align:right;">#${o.orderNumber || o.order_number} ${badgeText}</td>
        <td style="padding:4px;border:1px solid #ccc;text-align:right;">${o.customerName || o.customer_name || o.name || ''}</td>
        <td style="padding:4px;border:1px solid #ccc;text-align:center;">${computeDeliveredNetPieces(o)}</td>
        <td style="padding:4px;border:1px solid #ccc;text-align:center;">${money(computeDeliveredNetValue(o))}</td>
      </tr>`;
    }).join('');

    const retHTML = finalReturnedList.map(o => {
      const isEx = isExchangeOrder(o);
      const isPartial = isOrderPartialReturnInReturnedList(o);
      const badgeText = isEx ? '<span style="font-size:10px;color:#7e22ce;font-weight:bold;">(استبدال)</span>' : isPartial ? '<span style="font-size:10px;color:#d97706;">(جزئي)</span>' : '';
      return `<tr>
        <td style="padding:4px;border:1px solid #ccc;text-align:right;">#${o.orderNumber || o.order_number} ${badgeText}</td>
        <td style="padding:4px;border:1px solid #ccc;text-align:right;">${o.customerName || o.customer_name || o.name || ''}</td>
        <td style="padding:4px;border:1px solid #ccc;text-align:center;">${computeReturnedPieces(o)}</td>
        <td style="padding:4px;border:1px solid #ccc;text-align:center;">${money(computeReturnedOrderValue(o))}</td>
      </tr>`;
    }).join('');

    const defHTML = deferredOrders.map(o => {
      return `<tr>
        <td style="padding:4px;border:1px solid #ccc;text-align:right;">#${o.orderNumber || o.order_number}</td>
        <td style="padding:4px;border:1px solid #ccc;text-align:right;">${o.customerName || o.customer_name || o.name || ''}</td>
        <td style="padding:4px;border:1px solid #ccc;text-align:center;">${computePieces(o)}</td>
        <td style="padding:4px;border:1px solid #ccc;text-align:center;">${money(computeOrderValueWithoutShipping(o))}</td>
      </tr>`;
    }).join('');

    const activeHTML = activeOrders.map(o => {
      const isRetWithRep = String(o.status || o.order_status || o.journal_status || '').toLowerCase() === 'returned_with_rep';
      const isPart = String(o.status || o.order_status || o.journal_status || '').toLowerCase() === 'partial_return';
      return `<tr>
        <td style="padding:4px;border:1px solid #ccc;text-align:right;">#${o.orderNumber || o.order_number} ${isRetWithRep ? '<span style="font-size:10px;color:#ea580c;">(مرتجع مع المندوب)</span>' : isPart ? '<span style="font-size:10px;color:#dc2626;">(مرتجع جزئي)</span>' : ''}</td>
        <td style="padding:4px;border:1px solid #ccc;text-align:right;">${o.customerName || o.customer_name || o.name || ''}</td>
        <td style="padding:4px;border:1px solid #ccc;text-align:center;">${computePieces(o)}</td>
        <td style="padding:4px;border:1px solid #ccc;text-align:center;">${money(computeActiveOrderDisplayValue(o))}</td>
      </tr>`;
    }).join('');

    const interimHTML = interimPaymentsList.map((p, idx) => {
      const trName = treasuries.find(t => String(t.id) === String(p.treasury_id))?.name || p.treasury_name || 'خزينة';
      let dateDisplay = '';
      if (p.date && p.time) {
        dateDisplay = `${p.date} ${p.time}`;
      } else if (p.created_at) {
        dateDisplay = String(p.created_at);
      } else if (p.datetime) {
        dateDisplay = String(p.datetime);
      } else if (p.date) {
        dateDisplay = String(p.date);
      } else if (p.time) {
        dateDisplay = String(p.time);
      } else {
        dateDisplay = '—';
      }

      return `<tr>
        <td style="padding:4px;border:1px solid #ccc;text-align:center;">${idx + 1}</td>
        <td style="padding:4px;border:1px solid #ccc;text-align:center;white-space:nowrap;" dir="ltr">${dateDisplay}</td>
        <td style="padding:4px;border:1px solid #ccc;text-align:right;">${trName}</td>
        <td style="padding:4px;border:1px solid #ccc;text-align:center;font-weight:bold;color:#059669;">${money(p.amount)} ${currencySymbol}</td>
        <td style="padding:4px;border:1px solid #ccc;text-align:right;">${p.notes || '—'}</td>
        <td style="padding:4px;border:1px solid #ccc;text-align:right;">${p.employee || '—'}</td>
      </tr>`;
    }).join('');

    // --- Aggregated summaries requested by user ---
    const totalRequiredBeforePayments = repBalance < 0 ? (Math.abs(repBalance) + interimPaymentAmount) : repBalance;
    const totalCollectedToday = interimPaymentAmount + pAmount;

    const delivFullList = finalDeliveredList.filter(o => computeDeliveredNetPieces(o) > 0 && !isPartialDeliveryOrder(o));
    const delivPartialList = finalDeliveredList.filter(isPartialDeliveryOrder);

    const returnFullList = finalReturnedList.filter(o => computeReturnedPieces(o) > 0 && !isOrderPartialReturnInReturnedList(o));
    const returnPartialList = finalReturnedList.filter(o => computeReturnedPieces(o) > 0 && isOrderPartialReturnInReturnedList(o));

    const sum = (arr: any[], fn: (o: any) => number) => arr.reduce((s, x) => s + fn(x), 0);

    const delivFullCount = delivFullList.length;
    const delivFullPieces = sum(delivFullList, computeDeliveredNetPieces);
    const delivFullAmount = sum(delivFullList, computeDeliveredNetValue);

    const delivPartialCount = delivPartialList.length;
    const delivPartialPieces = sum(delivPartialList, computeDeliveredNetPieces);
    const delivPartialAmount = sum(delivPartialList, computeDeliveredNetValue);

    const returnFullCount = returnFullList.length;
    const returnFullPieces = sum(returnFullList, computeReturnedPieces);
    const returnFullAmount = sum(returnFullList, computeReturnedOrderValue);

    const returnPartialCount = returnPartialList.length;
    const returnPartialPieces = sum(returnPartialList, computeReturnedPieces);
    const returnPartialAmount = sum(returnPartialList, computeReturnedOrderValue);

    const deferredCount = deferredOrders.length;
    const deferredPiecesSum = deferredPieces;
    const deferredAmountSum = deferredValue;

    const activeCount = activeOrders.length;
    const activePiecesSum = activeOrders.reduce((sum, o) => sum + computePieces(o), 0);
    const activeAmountSum = activeOrders.reduce((sum, o) => sum + computeActiveOrderDisplayValue(o), 0);

    const estimatedRemaining = pAmount === 0 ? repBalance : (settlementDirection === 'collect' ? (repBalance + pAmount) : (repBalance - pAmount));

    const html = `
      <html dir="rtl" lang="ar">
      <head>
        <title>تقرير إغلاق يومية مندوب - ${pRepName}</title>
        <style>
          body { font-family: Tahoma, Arial, sans-serif; font-size: 12px; margin: 16px; line-height: 1.5; direction: rtl; color: #111; }
          .header { text-align: center; margin-bottom: 14px; border-bottom: 2px solid #000; padding-bottom: 8px; }
          h2 { margin: 0 0 4px; font-size: 16px; }
          h4 { margin: 12px 0 4px; font-size: 12px; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 12px; font-size: 11px; }
          th { background: #eee; padding: 4px 6px; border: 1px solid #ccc; text-align: right; font-weight: bold; }
          td { padding: 4px 6px; border: 1px solid #ccc; }
          .summary-top { border: 1px solid #bbb; border-radius: 6px; padding: 8px 12px; background: #fafafa; margin-bottom: 10px; font-size: 12px; }
          .summary-top .title { font-weight: bold; font-size: 13px; margin-bottom: 6px; border-bottom: 1px solid #ddd; padding-bottom: 4px; }
          .summary-top .row { display: flex; justify-content: space-between; padding: 2px 0; }
          .summary-top .row b { direction: ltr; }
          .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 10px; }
          .grid3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; margin-bottom: 10px; }
          .box { border: 1px solid #bbb; border-radius: 6px; padding: 8px 10px; background: #fff; }
          .box .box-title { font-weight: bold; font-size: 11px; border-bottom: 1px solid #ddd; padding-bottom: 4px; margin-bottom: 5px; color: #333; }
          .box .row { display: flex; justify-content: space-between; font-size: 11px; padding: 1px 0; }
          .box .row .val { font-weight: bold; direction: ltr; }
          .remaining-box { border: 2px solid #000; border-radius: 6px; padding: 10px; background: #f0fdf4; text-align: center; margin-bottom: 10px; }
          .remaining-box .label { font-size: 12px; color: #555; margin-bottom: 4px; }
          .remaining-box .amount { font-size: 20px; font-weight: bold; direction: ltr; color: #065f46; }
          .account-box { border: 1px solid #bbb; border-radius: 6px; padding: 8px 12px; background: #fffbea; margin-bottom: 10px; font-size: 12px; }
          .account-box .title { font-weight: bold; margin-bottom: 5px; }
          .account-box .row { display: flex; justify-content: space-between; padding: 2px 0; }
          @media print {
            body { margin: 8px; font-size: 11px; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h2>تقرير إغلاق يومية المندوب: ${pRepName}</h2>
          <div style="font-size:11px;">تاريخ الإغلاق: <span dir="ltr">${pDate} ${pTime}</span> | رقم اليومية: ${openDailyInfo?.daily_code || '---'}</div>
          ${(() => { const empN = userDefaults?.name || userDefaults?.username || ''; return empN ? `<div style="font-size:11px;margin-top:2px;">الموظف المسؤول: <b>${empN}</b></div>` : ''; })()}
        </div>

        <!-- بيان تصفية الحساب المالي لليومية بتسلسل الخصومات الدقيق -->
        <div class="summary-top" style="background: #ffffff; border: 2px solid #059669; padding: 12px 14px; margin-bottom: 12px;">
          <div class="title" style="color: #065f46; border-bottom: 1.5px solid #a7f3d0; font-size: 13px; margin-bottom: 8px; padding-bottom: 4px;">
            💰 بيان تصفية الحساب المالي لليومية (خطوة بخطوة)
          </div>
          
          <table style="width: 100%; border: none; margin-bottom: 0; font-size: 12px;">
            <tr style="background: #f8fafc; font-weight: bold; border-bottom: 1px solid #cbd5e1;">
              <td style="padding: 6px; border: none; text-align: right;">1. إجمالي المبلغ المطلوب قبل خصم المرتجعات:</td>
              <td style="padding: 6px; border: none; text-align: left; direction: ltr; font-size: 13px;"><b>${money(totalRequiredBeforeReturns)} ${currencySymbol}</b></td>
            </tr>

            <tr style="color: #dc2626; border-bottom: 1px dashed #e2e8f0;">
              <td style="padding: 6px; border: none; text-align: right;">
                (-) يُخصم: إجمالي قيمة المرتجع (${finalReturnedList.length} طلب مرتجع كلي وجزئي):
              </td>
              <td style="padding: 6px; border: none; text-align: left; direction: ltr; font-weight: bold;">
                - ${money(returnedValue)} ${currencySymbol}
              </td>
            </tr>

            <tr style="background: #fffbeb; font-weight: bold; border-bottom: 1px solid #fef3c7;">
              <td style="padding: 5px 6px; border: none; text-align: right; color: #92400e;">
                = الصافي المطلوب بعد استبعاد المرتجع:
              </td>
              <td style="padding: 5px 6px; border: none; text-align: left; direction: ltr; color: #92400e;">
                ${money(netAfterReturns)} ${currencySymbol}
              </td>
            </tr>

            <tr style="color: #059669; border-bottom: 1px dashed #e2e8f0;">
              <td style="padding: 6px; border: none; text-align: right;">
                (-) يُخصم: إجمالي الدفعات المسددة تحت الحساب أثناء اليومية (${interimPaymentsList.length} دفعة):
              </td>
              <td style="padding: 6px; border: none; text-align: left; direction: ltr; font-weight: bold;">
                - ${money(interimPaymentAmount)} ${currencySymbol}
              </td>
            </tr>

            <tr style="background: #f0fdf4; font-weight: bold; border-bottom: 1px solid #bbf7d0;">
              <td style="padding: 6px; border: none; text-align: right; color: #166534;">
                = المبلغ المطلوب تسويته للتقفيل النهائي:
              </td>
              <td style="padding: 6px; border: none; text-align: left; direction: ltr; color: #166534; font-size: 13px;">
                ${money(currentDebt)} ${currencySymbol} ${repBalance !== 0 ? `(${balanceLabel(repBalance)})` : ''}
              </td>
            </tr>

            <tr style="color: #2563eb; border-bottom: 2px solid #059669;">
              <td style="padding: 6px; border: none; text-align: right;">
                (-) يُخصم: المبلغ المدفوع للتقفيل النهائي الآن (${pTreasury}):
              </td>
              <td style="padding: 6px; border: none; text-align: left; direction: ltr; font-weight: bold;">
                - ${money(pAmount)} ${currencySymbol}
              </td>
            </tr>

            <tr style="background: #fdf2f8; font-weight: bold;">
              <td style="padding: 8px 6px; border: none; text-align: right; font-size: 13px; color: #9d174d;">
                (=) الرصيد المتبقي على / للمندوب بعد الإغلاق:
              </td>
              <td style="padding: 8px 6px; border: none; text-align: left; direction: ltr; font-size: 15px; color: #be185d;">
                <b>${money(Math.abs(estimatedRemaining))} ${currencySymbol}</b> <span style="font-size: 11px;">(${Math.abs(estimatedRemaining) === 0 ? 'خالص' : balanceLabel(estimatedRemaining)})</span>
              </td>
            </tr>
          </table>

          ${(interimPaymentAmount > 0 || pAmount > 0) ? `
          <div style="margin-top: 8px; padding-top: 6px; border-top: 1px solid #d1fae5; font-size: 11px; display: flex; justify-content: space-between; color: #047857;">
            <span>💡 <b>إجمالي المبالغ المحصلة فعلياً لليومية (تحت الحساب + التقفيل):</b></span>
            <b dir="ltr">${money(interimPaymentAmount + pAmount)} ${currencySymbol}</b>
          </div>
          ` : ''}
          ${repTxType !== 'none' && repTxAmount > 0 ? `
          <div style="margin-top: 4px; font-size: 11px; display: flex; justify-content: space-between; color: #64748b;">
            <span>${repTxType === 'bonus' ? 'حافز إضافي' : 'غرامة'}:</span>
            <b dir="ltr">${money(repTxAmount)} ${currencySymbol}</b>
          </div>
          ` : ''}
        </div>

        ${interimPaymentsList.length > 0 ? `
        <!-- جدول الدفعات المسددة تحت الحساب -->
        <h4>💵 تفاصيل الدفعات المسددة تحت الحساب أثناء اليومية (${interimPaymentsList.length} دفعة — إجمالي: ${money(interimPaymentAmount)} ${currencySymbol})</h4>
        <table>
          <tr>
            <th style="width:5%;text-align:center;">#</th>
            <th style="width:20%;text-align:center;">التاريخ والوقت</th>
            <th style="width:20%;text-align:right;">الخزينة</th>
            <th style="width:15%;text-align:center;">المبلغ</th>
            <th style="width:25%;text-align:right;">ملاحظات</th>
            <th style="width:15%;text-align:right;">الموظف</th>
          </tr>
          ${interimHTML}
        </table>
        ` : ''}

        <!-- صناديق الإحصاء الشاملة -->
        <div class="grid3">
          <div class="box">
            <div class="box-title">✅ التسليم الكامل</div>
            <div class="row"><span>عدد الطلبات</span><span class="val">${delivFullCount} طلب</span></div>
            <div class="row"><span>إجمالى القطع</span><span class="val">${delivFullPieces}</span></div>
            <div class="row"><span>إجمالى المبلغ</span><span class="val">${money(delivFullAmount)} ${currencySymbol}</span></div>
          </div>
          <div class="box">
            <div class="box-title">🔀 التسليم الجزئي</div>
            <div class="row"><span>عدد الطلبات</span><span class="val">${delivPartialCount} طلب</span></div>
            <div class="row"><span>إجمالى القطع</span><span class="val">${delivPartialPieces}</span></div>
            <div class="row"><span>إجمالى المبلغ</span><span class="val">${money(delivPartialAmount)} ${currencySymbol}</span></div>
          </div>
          <div class="box">
            <div class="box-title">🔄 الارجاع الكلي</div>
            <div class="row"><span>عدد الطلبات</span><span class="val">${returnFullCount} طلب</span></div>
            <div class="row"><span>إجمالى القطع</span><span class="val">${returnFullPieces}</span></div>
            <div class="row"><span>إجمالى المبلغ</span><span class="val">${money(returnFullAmount)} ${currencySymbol}</span></div>
          </div>
          <div class="box">
            <div class="box-title">↩️ الارجاع الجزئي</div>
            <div class="row"><span>عدد الطلبات</span><span class="val">${returnPartialCount} طلب</span></div>
            <div class="row"><span>إجمالى القطع</span><span class="val">${returnPartialPieces}</span></div>
            <div class="row"><span>إجمالى المبلغ</span><span class="val">${money(returnPartialAmount)} ${currencySymbol}</span></div>
          </div>
          <div class="box">
            <div class="box-title">⬇️ النزول (في عهدة المندوب)</div>
            <div class="row"><span>عدد الطلبات</span><span class="val">${deferredCount} طلب</span></div>
            <div class="row"><span>إجمالى القطع</span><span class="val">${deferredPiecesSum}</span></div>
            <div class="row"><span>إجمالى المبلغ</span><span class="val">${money(deferredAmountSum)} ${currencySymbol}</span></div>
          </div>
          <div class="box" style="border-color:#3b82f6;background:#eff6ff;">
            <div class="box-title" style="color:#1d4ed8;">📦 متبقي في العهدة الحالية</div>
            <div class="row"><span>عدد الطلبات</span><span class="val">${activeCount} طلب</span></div>
            <div class="row"><span>إجمالى القطع</span><span class="val">${activePiecesSum}</span></div>
            <div class="row"><span>إجمالى المبلغ</span><span class="val">${money(activeAmountSum)} ${currencySymbol}</span></div>
          </div>
        </div>

        ${finalDeliveredList.length > 0 ? `
        <h4>تفاصيل طلبات التسليم (${finalDeliveredList.length} طلب) — القطع: ${deliveredPieces} — إجمالي: ${money(deliveredValue)} ${currencySymbol}</h4>
        <table>
          <tr><th>رقم الأوردر</th><th>العميل</th><th style="text-align:center;">القطع</th><th style="text-align:center;">القيمة</th></tr>
          ${delivHTML}
        </table>
        ` : ''}

        ${finalReturnedList.length > 0 ? `
        <h4>تفاصيل طلبات المرتجع (${finalReturnedList.length} طلب) — القطع: ${returnedPieces} — إجمالي: ${money(returnedValue)} ${currencySymbol}</h4>
        <table>
          <tr><th>رقم الأوردر</th><th>العميل</th><th style="text-align:center;">القطع</th><th style="text-align:center;">القيمة</th></tr>
          ${retHTML}
        </table>
        ` : ''}

        ${deferredOrders.length > 0 ? `
        <h4>تفاصيل طلبات النزول (${deferredOrders.length} طلب) — القطع: ${deferredPieces} — إجمالي: ${money(deferredValue)} ${currencySymbol}</h4>
        <table>
          <tr><th>رقم الأوردر</th><th>العميل</th><th style="text-align:center;">القطع</th><th style="text-align:center;">القيمة</th></tr>
          ${defHTML}
        </table>
        ` : ''}

        ${activeOrders.length > 0 ? `
        <h4>تفاصيل طلبات العهدة الحالية المتبقية مع المندوب (${activeOrders.length} طلب) — القطع: ${activePiecesSum} — إجمالي: ${money(activeAmountSum)} ${currencySymbol}</h4>
        <table>
          <tr><th>رقم الأوردر</th><th>العميل</th><th style="text-align:center;">القطع</th><th style="text-align:center;">القيمة</th></tr>
          ${activeHTML}
        </table>
        ` : ''}

      </body>
      </html>
    `;

    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    document.body.appendChild(iframe);
    
    // Firefox fallback
    iframe.contentDocument?.open();
    iframe.contentDocument?.write(html);
    iframe.contentDocument?.close();
    
    iframe.onload = () => {
      setTimeout(() => {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
        setTimeout(() => { document.body.removeChild(iframe); }, 1000);
      }, 500);
    };
  };

  // --- Render ---
  return (
    <div className="p-6 space-y-5 relative" dir="rtl">
      {/* Header */}
      <div className="rounded-3xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-end gap-3 justify-between">
          <div>
            <h2 className="text-lg font-black text-slate-900 dark:text-white">إغلاق يومية المندوب (تسوية المديونية)</h2>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">التقفيل مرتبط بالخزينة فقط — مديونية المندوب تُقرأ مباشرة من الرصيد (balance).</div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handlePrintDailyClose}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-indigo-600 text-white hover:bg-indigo-700 font-black text-sm transition-colors"
              disabled={loading || !selectedRepId} title="طباعة وإغلاق"
            >
              طباعة اليومية
            </button>
            <button
              onClick={() => loadRepData(selectedRepId)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-slate-900 text-white hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-sm font-black"
              disabled={loading} title="تحديث"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> تحديث
            </button>
          </div>
        </div>
      </div>

      {/* Selectors & Filters */}
      <div className="mb-4 grid grid-cols-1 lg:grid-cols-12 gap-3">
        {/* Main Rep & Daily Filter Panel (7 cols on lg) */}
        <div className="lg:col-span-7 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 shadow-sm space-y-3">
          {/* Top row: Header & Daily status tabs */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <span className="text-xs font-black text-slate-800 dark:text-slate-200">تصفية واختيار المندوب</span>
            </div>

            {/* Daily status filter tabs: الكل / يومية مفتوحة / يومية مغلقة */}
            <div className="inline-flex rounded-xl bg-slate-100 dark:bg-slate-800/90 p-1 border border-slate-200/70 dark:border-slate-700/70">
              <button
                type="button"
                onClick={() => setDailyFilter('all')}
                className={`px-3 py-1 rounded-lg text-xs font-black transition-all flex items-center gap-1.5 ${
                  dailyFilter === 'all'
                    ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-sm'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                <span>الكل</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${dailyFilter === 'all' ? 'bg-indigo-50 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'}`}>
                  {repCounts.all}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setDailyFilter('open')}
                className={`px-3 py-1 rounded-lg text-xs font-black transition-all flex items-center gap-1.5 ${
                  dailyFilter === 'open'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-500 hover:text-emerald-600 dark:hover:text-emerald-400'
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span>يومية مفتوحة</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${dailyFilter === 'open' ? 'bg-emerald-700 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'}`}>
                  {repCounts.open}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setDailyFilter('closed')}
                className={`px-3 py-1 rounded-lg text-xs font-black transition-all flex items-center gap-1.5 ${
                  dailyFilter === 'closed'
                    ? 'bg-slate-800 text-white dark:bg-slate-600 shadow-sm'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                <span>يومية مغلقة</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${dailyFilter === 'closed' ? 'bg-slate-900 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'}`}>
                  {repCounts.closed}
                </span>
              </button>
            </div>
          </div>

          {/* Middle row: CustomSelect only */}
          <div className="pt-1">
            <CustomSelect
              value={selectedRepId}
              onChange={v => setSelectedRepId(v)}
              options={repSelectOptions}
              placeholder={
                filteredReps.length === 0
                  ? (dailyFilter === 'open' ? '— لا يوجد مناديب بيومية مفتوحة —' : '— لا توجد نتائج مطابقة —')
                  : `— اختر المندوب (${filteredReps.length} متاح) —`
              }
              disabled={loading}
            />
          </div>

          {/* Bottom row: Active badges & Info */}
          {selectedRepId && (
            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
              <div className="flex items-center gap-2">
                {openDailyInfo ? (
                  <span className="inline-flex items-center gap-1.5 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300 px-3 py-1 rounded-full text-xs font-black border border-emerald-200 dark:border-emerald-800">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse inline-block" />
                    يومية مفتوحة: {openDailyInfo.daily_code}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-3 py-1 rounded-full text-xs font-bold border border-slate-200 dark:border-slate-700">
                    <span className="w-2 h-2 rounded-full bg-slate-400 inline-block" />
                    اليومية مغلقة / لا توجد يومية مفتوحة
                  </span>
                )}
              </div>

              <div className="text-xs font-bold">
                <span className="text-slate-500">رصيد المندوب: </span>
                <span className={`${balanceClass(repBalance)} font-black`}>
                  {money(Math.abs(repBalance))} ج.م {balanceLabel(repBalance)}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Payment Method Panel (5 cols on lg) */}
        <div className="lg:col-span-5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 shadow-sm flex flex-col justify-between">
          <div>
            <div className="text-xs text-slate-500 mb-2 font-bold">طريقة الدفع للخزينة</div>
            <div className="flex gap-2 mb-3">
              <button
                type="button"
                onClick={() => { setPaymentMethod('cash'); if (userDefaults?.default_treasury_id) setSelectedTreasuryId(String(userDefaults.default_treasury_id)); }}
                className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${paymentMethod === 'cash' ? 'bg-blue-600 text-white shadow-md' : 'bg-white dark:bg-slate-800 text-slate-600 border border-slate-200 dark:border-slate-700'}`}
              >كاش</button>
              <button
                type="button"
                onClick={handleElectronicTreasury}
                className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${paymentMethod === 'electronic' ? 'bg-blue-600 text-white shadow-md' : 'bg-white dark:bg-slate-800 text-slate-600 border border-slate-200 dark:border-slate-700'}`}
              >مدفوعات إليكترونية</button>
            </div>
          </div>
          <div>
            {paymentMethod === 'cash' ? (
              <>
                <div className="text-xs text-slate-500 mb-2 font-bold">اختر الخزينة</div>
                <CustomSelect
                  value={selectedTreasuryId} onChange={v => setSelectedTreasuryId(v)}
                  options={treasuries.map(t => ({ value: String(t.id), label: t.name }))}
                  placeholder="— اختر الخزينة —" disabled={loading || !canChangeTreasury}
                />
              </>
            ) : (
              <div className="text-xs font-bold text-blue-600 bg-blue-50 dark:bg-blue-900/20 p-2.5 rounded-xl border border-blue-100 dark:border-blue-800/50 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                <span>تم اختيار خزينة "مدفوعات إليكترونية" تلقائياً</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {selectedRepId && !openDailyInfo && !statsLoading && (
        <div className="mt-4 p-3.5 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 rounded-2xl border border-amber-200 dark:border-amber-800/60 text-xs font-bold flex items-center gap-2">
          <span className="text-base">⚠️</span>
          <span>تنبيه: هذا المندوب ليس لديه يومية مفتوحة حالياً. يمكنك بدء يومية جديدة له من صفحة "بدء اليومية".</span>
        </div>
      )}

      {/* Summary Cards */}
      <div className="mb-4 rounded-3xl border border-blue-100 bg-gradient-to-br from-blue-50 to-slate-50 dark:from-slate-800 dark:to-slate-900 dark:border-slate-700 p-5 shadow-sm mt-4">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />
          <span className="text-sm font-black text-slate-700 dark:text-slate-200">
            {selectedRepId ? (openDailyInfo ? `ملخص اليومية المفتوحة — ${selectedRep?.name || ''}` : `لا توجد يومية مفتوحة — ${selectedRep?.name || ''}`) : 'الملخص'}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Balance */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 flex flex-col justify-between">
            <div className="flex items-start justify-between mb-2">
              <span className="text-[11px] font-black text-slate-500 uppercase tracking-wide">الحساب الحالى</span>
              <Wallet className="w-4 h-4 text-slate-400" />
            </div>
            <div className={`text-2xl font-black leading-none mb-1 ${balanceClass(repBalance)}`}>
              {selectedRepId ? money(repBalance) : '—'} <span className="text-xs font-bold text-slate-500 mr-1">{currencySymbol}</span>
            </div>
            <div className="text-[11px] text-slate-400">{selectedRepId ? `(${balanceLabel(repBalance)})` : 'اختر مندوباً'}</div>
          </div>

          {/* Delivered */}
          <div className="bg-white dark:bg-slate-900 border border-emerald-100 dark:border-slate-700 rounded-2xl p-4 flex flex-col justify-between">
            <div>
              <div className="flex items-start justify-between mb-2">
                <span className="text-[11px] font-black text-emerald-600 uppercase tracking-wide">إجمالي تسليم</span>
                <PackageCheck className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="text-2xl font-black text-emerald-700 dark:text-emerald-400 leading-none mb-2">
                {statsLoading ? '...' : finalDeliveredList.length} <span className="text-xs font-bold text-slate-500 mr-1">طلب</span>
              </div>
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-slate-600 dark:text-slate-400"><span>القطع المسلمة</span><span className="font-black">{statsLoading ? '—' : deliveredPieces}</span></div>
                <div className="flex justify-between text-xs text-slate-600 dark:text-slate-400"><span>القيمة</span><span className="font-black text-emerald-600">{statsLoading ? '—' : money(deliveredValue)} {currencySymbol}</span></div>
              </div>
              {/* Full vs Partial Sub-breakdown */}
              <div className="mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-800 grid grid-cols-2 gap-1 text-[10px]">
                <div className="bg-emerald-50/60 dark:bg-emerald-950/20 p-1.5 rounded-lg border border-emerald-100 dark:border-emerald-900/30">
                  <div className="font-bold text-emerald-700 dark:text-emerald-300">تسليم كامل: {statsLoading ? '—' : delivFullList.length}</div>
                  <div className="text-slate-500 dark:text-slate-400">{statsLoading ? '—' : `${delivFullPieces} ق • ${money(delivFullAmount)}`}</div>
                </div>
                <div className="bg-amber-50/60 dark:bg-amber-950/20 p-1.5 rounded-lg border border-amber-100 dark:border-amber-900/30">
                  <div className="font-bold text-amber-700 dark:text-amber-300">تسليم جزئي: {statsLoading ? '—' : delivPartialList.length}</div>
                  <div className="text-slate-500 dark:text-slate-400">{statsLoading ? '—' : `${delivPartialPieces} ق • ${money(delivPartialAmount)}`}</div>
                </div>
                {delivExchangeList.length > 0 && (
                  <div className="col-span-2 bg-purple-50/60 dark:bg-purple-950/20 p-1.5 rounded-lg border border-purple-100 dark:border-purple-900/30">
                    <div className="font-bold text-purple-700 dark:text-purple-300">استبدال (مُسلَّم): {statsLoading ? '—' : delivExchangeList.length}</div>
                    <div className="text-slate-500 dark:text-slate-400">{statsLoading ? '—' : `${delivExchangePieces} ق • ${money(delivExchangeAmount)}`}</div>
                  </div>
                )}
              </div>
            </div>
            <button onClick={() => { setViewModal('delivered'); setModalFilter('all'); }} className="mt-3 flex items-center justify-center gap-1 text-xs bg-slate-50 dark:bg-slate-800 hover:bg-emerald-50 text-slate-600 hover:text-emerald-600 py-1.5 px-3 rounded-xl border border-slate-100 dark:border-slate-700 transition-colors"><Eye className="w-3.5 h-3.5" /> التفاصيل</button>
          </div>

          {/* Deferred */}
          <div className="bg-white dark:bg-slate-900 border border-amber-100 dark:border-slate-700 rounded-2xl p-4 flex flex-col justify-between">
            <div>
              <div className="flex items-start justify-between mb-2">
                <span className="text-[11px] font-black text-amber-600 uppercase tracking-wide">النزول (مع المندوب)</span>
                <PackageCheck className="w-4 h-4 text-amber-400" />
              </div>
              <div className="text-2xl font-black text-amber-700 dark:text-amber-400 leading-none mb-2">
                {statsLoading ? '...' : deferredOrders.length} <span className="text-xs font-bold text-slate-500 mr-1">طلب</span>
              </div>
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-slate-600 dark:text-slate-400"><span>قطع النزول</span><span className="font-black">{statsLoading ? '—' : deferredPieces}</span></div>
                <div className="flex justify-between text-xs text-slate-600 dark:text-slate-400"><span>القيمة</span><span className="font-black text-amber-600">{statsLoading ? '—' : money(deferredValue)} {currencySymbol}</span></div>
              </div>
            </div>
            <button onClick={() => { setViewModal('deferred'); setModalFilter('all'); }} className="mt-3 flex items-center justify-center gap-1 text-xs bg-slate-50 dark:bg-slate-800 hover:bg-amber-50 text-slate-600 hover:text-amber-600 py-1.5 px-3 rounded-xl border border-slate-100 dark:border-slate-700 transition-colors"><Eye className="w-3.5 h-3.5" /> التفاصيل</button>
          </div>

          {/* Returned */}
          <div className="bg-white dark:bg-slate-900 border border-rose-100 dark:border-slate-700 rounded-2xl p-4 flex flex-col justify-between">
            <div>
              <div className="flex items-start justify-between mb-2">
                <span className="text-[11px] font-black text-rose-600 uppercase tracking-wide">إجمالي مرتجع</span>
                <PackageX className="w-4 h-4 text-rose-400" />
              </div>
              <div className="text-2xl font-black text-rose-700 dark:text-rose-400 leading-none mb-2">
                {statsLoading ? '...' : finalReturnedList.length} <span className="text-xs font-bold text-slate-500 mr-1">طلب</span>
              </div>
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-slate-600 dark:text-slate-400"><span>القطع المرتجعة</span><span className="font-black">{statsLoading ? '—' : returnedPieces}</span></div>
                <div className="flex justify-between text-xs text-slate-600 dark:text-slate-400"><span>القيمة</span><span className="font-black text-rose-600">{statsLoading ? '—' : money(returnedValue)} {currencySymbol}</span></div>
              </div>
              {/* Full vs Partial Sub-breakdown */}
              <div className="mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-800 grid grid-cols-2 gap-1 text-[10px]">
                <div className="bg-rose-50/60 dark:bg-rose-950/20 p-1.5 rounded-lg border border-rose-100 dark:border-rose-900/30">
                  <div className="font-bold text-rose-700 dark:text-rose-300">ارتجاع كامل: {statsLoading ? '—' : returnFullList.length}</div>
                  <div className="text-slate-500 dark:text-slate-400">{statsLoading ? '—' : `${returnFullPieces} ق • ${money(returnFullAmount)}`}</div>
                </div>
                <div className="bg-amber-50/60 dark:bg-amber-950/20 p-1.5 rounded-lg border border-amber-100 dark:border-amber-900/30">
                  <div className="font-bold text-amber-700 dark:text-amber-300">ارتجاع جزئي: {statsLoading ? '—' : returnPartialList.length}</div>
                  <div className="text-slate-500 dark:text-slate-400">{statsLoading ? '—' : `${returnPartialPieces} ق • ${money(returnPartialAmount)}`}</div>
                </div>
                {returnExchangeList.length > 0 && (
                  <div className="col-span-2 bg-purple-50/60 dark:bg-purple-950/20 p-1.5 rounded-lg border border-purple-100 dark:border-purple-900/30">
                    <div className="font-bold text-purple-700 dark:text-purple-300">استبدال (مستلم بالمخزن): {statsLoading ? '—' : returnExchangeList.length}</div>
                    <div className="text-slate-500 dark:text-slate-400">{statsLoading ? '—' : `${returnExchangePieces} ق • ${money(returnExchangeAmount)}`}</div>
                  </div>
                )}
              </div>
            </div>
            <button onClick={() => { setViewModal('returned'); setModalFilter('all'); }} className="mt-3 flex items-center justify-center gap-1 text-xs bg-slate-50 dark:bg-slate-800 hover:bg-rose-50 text-slate-600 hover:text-rose-600 py-1.5 px-3 rounded-xl border border-slate-100 dark:border-slate-700 transition-colors"><Eye className="w-3.5 h-3.5" /> التفاصيل</button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left Column: Settlement & Tx */}
        <div className="lg:col-span-1 space-y-4">
          <div className="rounded-3xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-4 text-slate-900 dark:text-white font-black"><User className="w-5 h-5 text-blue-600" /> معاملة مالية للمندوب</div>
            <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/30 p-3">
              <div className="text-xs text-slate-600 dark:text-slate-200 font-black mb-2">نوع المعاملة</div>
              <div className="flex items-center gap-3 mb-3">
                <label className="inline-flex items-center gap-2 text-sm cursor-pointer"><input type="radio" checked={repTxType === 'bonus'} onChange={() => setRepTxType('bonus')} /><span>حافز</span></label>
                <label className="inline-flex items-center gap-2 text-sm cursor-pointer"><input type="radio" checked={repTxType === 'penalty'} onChange={() => setRepTxType('penalty')} /><span>غرامة</span></label>
                <label className="inline-flex items-center gap-2 text-sm cursor-pointer"><input type="radio" checked={repTxType === 'none'} onChange={() => setRepTxType('none')} /><span>لا شيء</span></label>
              </div>
              <input type="number" min={0} placeholder="المبلغ" className="w-full mb-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl px-3 py-2 text-sm" value={repTxAmount || ''} onChange={e => setRepTxAmount(toNum(e.target.value))} disabled={repTxType === 'none'} />
              <input type="text" placeholder="السبب (اختياري)" className="w-full mb-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl px-3 py-2 text-sm" value={repTxReason} onChange={e => setRepTxReason(e.target.value)} disabled={repTxType === 'none'} />
              <button className="w-full py-2 rounded-2xl bg-emerald-500 text-white text-sm font-black disabled:opacity-50" disabled={repTxType === 'none' || repTxAmount <= 0 || repTxLoading} onClick={handleFinancialTx}>تنفيذ</button>
            </div>
          </div>

          {/* Interim Payments Card (دفعات تحت الحساب أثناء اليومية) */}
          <div className="rounded-3xl border border-emerald-200 dark:border-emerald-800/60 bg-gradient-to-br from-emerald-50/50 via-white to-teal-50/40 dark:from-slate-900 dark:to-slate-800 p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Receipt className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                <span className="font-black text-slate-900 dark:text-white text-sm">دفعات تحت الحساب (أثناء اليومية)</span>
              </div>
              <button
                type="button"
                onClick={handleOpenInterimModal}
                disabled={!selectedRepId || !openDailyInfo}
                className="inline-flex items-center gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-1.5 px-3 rounded-xl shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Plus size={14} />
                <span>سداد دفعة</span>
              </button>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-2xl p-3 border border-emerald-100 dark:border-emerald-900/40 mb-3">
              <div className="flex justify-between items-center">
                <span className="text-xs text-slate-500 dark:text-slate-400">إجمالي المسدد تحت الحساب:</span>
                <span className="text-base font-black text-emerald-600 dark:text-emerald-400">
                  {money(interimPaymentAmount)} {currencySymbol}
                </span>
              </div>
              <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">
                {interimPaymentsList.length > 0 
                  ? `تم تسجيل ${interimPaymentsList.length} دفعة تحت الحساب وخُصمت فوراً من حساب المندوب.`
                  : 'لم يتم سداد أي دفعات مسبقة أثناء هذه اليومية.'}
              </div>
            </div>

            {interimPaymentsList.length > 0 && (
              <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar pr-1">
                {interimPaymentsList.map((p, idx) => {
                  const trName = treasuries.find(t => String(t.id) === String(p.treasury_id))?.name || p.treasury_name || 'خزينة';
                  const txId = p.tx_id || p.payment_id || p.id;
                  return (
                    <div key={txId || idx} className="flex items-center justify-between p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs">
                      <div className="flex-1 min-w-0 pr-1">
                        <div className="flex items-center gap-2">
                          <span className="font-black text-emerald-600 dark:text-emerald-400">+{money(p.amount)} {currencySymbol}</span>
                          <span className="text-[10px] px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold">{trName}</span>
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5 truncate">
                          {p.date ? `${p.date} ` : ''}{p.time ? p.time : (p.created_at ? new Date(p.created_at).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }) : '')}
                          {p.notes ? ` • ${p.notes}` : ''}
                          {p.employee ? ` (${p.employee})` : ''}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleUndoInterimPayment(txId, p.amount)}
                        title="إلغاء واسترجاع الدفعة"
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg transition-colors"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="rounded-3xl border border-slate-200 dark:border-slate-700 bg-gradient-to-br from-slate-900 to-slate-800 p-5 shadow-sm text-white">
            <div className="flex items-center justify-between font-black">
              <div className="flex items-center gap-2"><CheckCircle2 className="w-5 h-5 text-emerald-300" /> تأكيد التقفيل</div>
              <button
                type="button"
                onClick={() => setIsSplitPayment(!isSplitPayment)}
                className={`text-[11px] px-2.5 py-1 rounded-xl font-bold transition-all border ${isSplitPayment ? 'bg-sky-500 text-white border-sky-400' : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'}`}
              >
                {isSplitPayment ? '💳 تقفيل مقسّم (مفعّل)' : '➕ تقسيم كاش/إلكتروني'}
              </button>
            </div>

            <div className="mt-3 rounded-2xl p-3 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 text-slate-800 dark:text-slate-100">
              <div className="text-xs font-bold mb-2">طريقة التسوية</div>
              <div className="flex items-center gap-3 mb-3">
                <label className="inline-flex items-center gap-2 text-xs cursor-pointer"><input type="radio" checked={settlementDirection === 'collect'} onChange={() => setSettlementDirection('collect')} /><span>تحصيل من المندوب</span></label>
                <label className="inline-flex items-center gap-2 text-xs cursor-pointer"><input type="radio" checked={settlementDirection === 'pay'} onChange={() => setSettlementDirection('pay')} /><span>دفع للمندوب</span></label>
              </div>

              {!isSplitPayment ? (
                <div>
                  <div className="flex items-center justify-between text-xs font-bold mb-1">
                    <span>المبلغ المدفوع للتقفيل</span>
                    {repBalance < 0 && (
                      <button
                        type="button"
                        onClick={() => setPaidAmount(Math.abs(repBalance))}
                        className="text-[10px] text-amber-700 hover:text-amber-800 dark:text-amber-300 underline font-bold"
                      >
                        ملء بالمتبقي ({money(Math.abs(repBalance))})
                      </button>
                    )}
                  </div>
                  <input type="number" min={0} className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl px-3 py-2.5 text-sm font-bold text-slate-900 dark:text-white" value={paidAmount || ''} onChange={e => setPaidAmount(Math.max(0, toNum(e.target.value)))} disabled={loading || !selectedRepId} />
                </div>
              ) : (
                <div className="space-y-3 pt-1 border-t border-amber-200 dark:border-amber-800/60">
                  <div>
                    <label className="text-[11px] font-bold mb-1 flex items-center justify-between">
                      <span>💵 المبلغ النقدي (الكاش)</span>
                      <span className="text-[10px] text-slate-500">الخزينة النقدية</span>
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <input type="number" min={0} placeholder="0 ج.م" className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-2 text-xs font-bold" value={cashPaidAmount || ''} onChange={e => setCashPaidAmount(Math.max(0, toNum(e.target.value)))} />
                      <select className={`w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-2 py-2 text-xs font-bold ${Boolean(userDefaults?.default_treasury_id) ? 'bg-slate-100 dark:bg-slate-800 opacity-80 cursor-not-allowed' : ''}`} value={cashTreasuryId} onChange={e => setCashTreasuryId(e.target.value)} disabled={Boolean(userDefaults?.default_treasury_id)}>
                        <option value="">اختر خزينة الكاش...</option>
                        {treasuries.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] font-bold mb-1 flex items-center justify-between">
                      <span>💳 المدفوعات الإلكترونية</span>
                      <span className="text-[10px] text-slate-500">إنستاباي / فودافون كاش</span>
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <input type="number" min={0} placeholder="0 ج.م" className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-2 text-xs font-bold" value={electronicPaidAmount || ''} onChange={e => setElectronicPaidAmount(Math.max(0, toNum(e.target.value)))} />
                      <select className="w-full bg-slate-100 dark:bg-slate-800 opacity-80 cursor-not-allowed border border-slate-200 dark:border-slate-700 rounded-xl px-2 py-2 text-xs font-bold" value={electronicTreasuryId} onChange={e => setElectronicTreasuryId(e.target.value)} disabled={true}>
                        <option value="">اختر الخزينة الإلكترونية...</option>
                        {treasuries.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                      </select>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* بيان تصفية الحساب المالي لليومية بتسلسل الخصومات الدقيق */}
            <div className="mt-4 rounded-2xl bg-slate-950/70 p-3.5 border border-slate-700/80 space-y-2 text-xs">
              <div className="flex justify-between items-center text-slate-300 pb-2 border-b border-slate-800">
                <span className="text-[11px] font-bold text-slate-400">المندوب:</span>
                <span className="font-black text-white">{selectedRep?.name || '—'}</span>
              </div>
              <div className="flex justify-between items-center text-slate-300 pb-2 border-b border-slate-800">
                <span className="text-[11px] font-bold text-slate-400">الخزينة المستلمة:</span>
                <span className="font-bold text-slate-200">{isSplitPayment ? 'مزدوج (كاش + إلكتروني)' : (selectedTreasuryName || '—')}</span>
              </div>

              {/* 1. إجمالي المطلوب قبل خصم المرتجعات */}
              <div className="flex justify-between items-center pt-0.5">
                <span className="text-slate-300 font-bold">1. إجمالي المطلوب قبل خصم المرتجعات:</span>
                <span className="font-black text-white text-sm" dir="ltr">{money(totalRequiredBeforeReturns)} {currencySymbol}</span>
              </div>

              {/* 2. (-) يُخصم منه قيمة المرتجع */}
              <div className="flex justify-between items-center text-rose-400 font-bold">
                <span>(-) يُخصم: قيمة المرتجع ({finalReturnedList.length} طلب):</span>
                <span dir="ltr">- {money(returnedValue)} {currencySymbol}</span>
              </div>

              {/* 3. = الصافي بعد استبعاد المرتجع */}
              <div className="flex justify-between items-center bg-amber-500/10 px-2 py-1 rounded-lg text-amber-300 font-bold">
                <span>= الصافي المطلوب بعد استبعاد المرتجع:</span>
                <span dir="ltr">{money(netAfterReturns)} {currencySymbol}</span>
              </div>

              {/* 4. (-) يُخصم منه أي دفعات أثناء اليومية */}
              <div className="flex justify-between items-center text-emerald-400 font-bold">
                <span>(-) يُخصم: دفعات أثناء اليومية ({interimPaymentsList.length} دفعة):</span>
                <span dir="ltr">- {money(interimPaymentAmount)} {currencySymbol}</span>
              </div>

              {/* 5. = المبلغ المطلوب تسويته للتقفيل الآن */}
              <div className="flex justify-between items-center bg-slate-800/80 px-2 py-1.5 rounded-lg border border-slate-700/60 font-black">
                <span className="text-slate-200">= المطلوب تسويته للتقفيل الآن:</span>
                <span className="text-amber-400 text-sm" dir="ltr">
                  {money(currentDebt)} {currencySymbol} {repBalance !== 0 ? `(${balanceLabel(repBalance)})` : ''}
                </span>
              </div>

              {/* 6. (-) المبلغ المدفوع للتقفيل */}
              <div className="flex justify-between items-center text-sky-300 font-bold">
                <span>(-) يُخصم: المدفوع للتقفيل الآن:</span>
                <span dir="ltr">- {money(isSplitPayment ? (cashPaidAmount + electronicPaidAmount) : paidAmount)} {currencySymbol}</span>
              </div>

              {/* 7. (=) المتبقي النهائي بعد الإغلاق */}
              {(() => {
                const paidNow = isSplitPayment ? (cashPaidAmount + electronicPaidAmount) : paidAmount;
                const estRem = settlementDirection === 'collect' ? repBalance + paidNow : repBalance - paidNow;
                const remDisplay = Math.abs(estRem);
                const remLabel = estRem === 0 ? 'خالص' : balanceLabel(estRem);
                return (
                  <div className="flex justify-between items-center bg-rose-500/10 border border-rose-500/30 px-2.5 py-2 rounded-xl mt-1 font-black">
                    <span className="text-rose-200">(=) الرصيد المتبقي النهائي بعد الإغلاق:</span>
                    <span className="text-sm text-rose-300" dir="ltr">
                      {money(remDisplay)} {currencySymbol} <span className="text-xs">({remLabel})</span>
                    </span>
                  </div>
                );
              })()}

              {(interimPaymentAmount > 0 || (isSplitPayment ? (cashPaidAmount + electronicPaidAmount) : paidAmount) > 0) && (
                <div className="flex justify-between items-center text-[11px] text-emerald-300 pt-1.5 border-t border-slate-800 font-bold">
                  <span>💡 إجمالي المحصل لليومية بالكامل:</span>
                  <span dir="ltr">{money(interimPaymentAmount + (isSplitPayment ? (cashPaidAmount + electronicPaidAmount) : paidAmount))} {currencySymbol}</span>
                </div>
              )}
            </div>

            <button onClick={handleCloseDaily} disabled={loading || isClosingDaily || !selectedRepId || (!isSplitPayment && paidAmount > 0 && !selectedTreasuryId) || (isSplitPayment && (cashPaidAmount + electronicPaidAmount) <= 0)} className="mt-5 w-full bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-slate-900 font-black py-3 rounded-2xl transition-colors flex items-center justify-center gap-2">
              {isClosingDaily ? <Loader2 className="animate-spin" size={18} /> : null}
              {isClosingDaily ? 'جاري التقفيل وإغلاق اليومية...' : 'تأكيد التقفيل وإغلاق اليومية'}
            </button>
          </div>
        </div>

        {/* Right Column: Orders Lists */}
        <div className="lg:col-span-2 rounded-3xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 shadow-sm">
          <div className="text-lg font-black text-slate-900 dark:text-white mb-4">قوائم الاوردرات</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Active Custody */}
            <div className="border border-slate-200 dark:border-slate-700 rounded-2xl p-3 flex flex-col max-h-[600px]">
              <div className="flex flex-col gap-2 mb-3">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-bold text-slate-800 dark:text-slate-200">العهدة الحالية ({activeOrders.length})</div>
                  <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-lg p-1">
                    <button onClick={() => setActiveOrdersSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')} className="p-1 rounded-md text-slate-500 hover:bg-white dark:hover:bg-slate-700 transition-colors"><ArrowDown size={14} className={activeOrdersSortOrder === 'asc' ? 'rotate-180' : ''} /></button>
                    <div className="w-px h-4 bg-slate-300 dark:bg-slate-600 mx-1"></div>
                    <button onClick={() => setActiveOrdersViewMode('list')} className={`p-1 rounded-md ${activeOrdersViewMode === 'list' ? 'bg-white dark:bg-slate-700 text-indigo-600' : 'text-slate-500'}`}><List size={14} /></button>
                    <button onClick={() => setActiveOrdersViewMode('card')} className={`p-1 rounded-md ${activeOrdersViewMode === 'card' ? 'bg-white dark:bg-slate-700 text-indigo-600' : 'text-slate-500'}`}><LayoutGrid size={14} /></button>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={toggleSelectAll} className="px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[11px] font-bold">تحديد الكل</button>
                  <button onClick={markSelectedDelivered} className="px-2 py-1 rounded-lg bg-emerald-500 text-white text-[11px] font-bold">تم التسليم</button>
                  <button onClick={moveSelectedToDeferred} className="px-2 py-1 rounded-lg bg-amber-500 text-white text-[11px] font-bold">نزول</button>
                </div>
              </div>
              <div className={`overflow-y-auto flex-1 custom-scrollbar pr-1 ${activeOrdersViewMode === 'list' ? 'divide-y divide-slate-100 dark:divide-slate-800' : 'space-y-2'}`}>
                {activeOrders.length === 0 ? <div className="text-xs text-slate-400 text-center py-6">لا توجد اوردرات.</div> : activeOrdersSorted.map(o => (
                  activeOrdersViewMode === 'list' ? (
                    <div key={o.id} className="flex items-center justify-between py-2 px-1 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                      <div className="flex items-center gap-2">
                        <input type="checkbox" checked={selectedOrderIds.includes(getRealOrderId(o))} onChange={() => toggleSelectOrder(getRealOrderId(o))} className="w-3.5 h-3.5 rounded text-indigo-600 cursor-pointer" />
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate max-w-[120px]">
                          #{o.orderNumber || o.order_number} {o.customerName || o.customer_name || o.name}
                        </span>
                        {isExchangeOrder(o) ? (
                          <span className="text-[9px] font-bold bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded border border-purple-200 dark:bg-purple-900/40 dark:border-purple-800">استبدال</span>
                        ) : (o.status === 'returned_with_rep' || o.order_status === 'returned_with_rep') ? (
                          <span className="text-[9px] font-bold bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded border border-orange-200 dark:bg-orange-900/40 dark:border-orange-800">مرتجع جزئي مع المندوب</span>
                        ) : (o.status === 'partial_return' || o.order_status === 'partial_return' || o.status === 'partial' || o.order_status === 'partial') ? (
                          <span className="text-[9px] font-bold bg-rose-100 text-rose-700 px-1.5 py-0.5 rounded border border-rose-200 dark:bg-rose-900/40 dark:border-rose-800">مرتجع جزئي</span>
                        ) : null}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-black text-emerald-600">{money(computeActiveOrderDisplayValue(o))}</span>
                        {canPartialDeliver(o) && (
                          <button onClick={() => openPartialDeliveryModal(o)} className="px-2 py-0.5 text-[10px] bg-orange-100 text-orange-700 rounded dark:bg-orange-900/40 dark:text-orange-400 font-bold">تسليم جزئي</button>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div key={o.id} className="border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 bg-white dark:bg-slate-900">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <input type="checkbox" checked={selectedOrderIds.includes(getRealOrderId(o))} onChange={() => toggleSelectOrder(getRealOrderId(o))} className="w-3.5 h-3.5 rounded text-indigo-600 cursor-pointer mt-0.5" />
                          <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                            #{o.orderNumber || o.order_number} — {o.customerName || o.customer_name || o.name}
                          </span>
                          {isExchangeOrder(o) ? (
                            <span className="text-[9px] font-bold bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded border border-purple-200 dark:bg-purple-900/40 dark:border-purple-800">استبدال</span>
                          ) : (o.status === 'returned_with_rep' || o.order_status === 'returned_with_rep') ? (
                            <span className="text-[9px] font-bold bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded border border-orange-200 dark:bg-orange-900/40 dark:border-orange-800">مرتجع جزئي مع المندوب</span>
                          ) : (o.status === 'partial_return' || o.order_status === 'partial_return' || o.status === 'partial' || o.order_status === 'partial') ? (
                            <span className="text-[9px] font-bold bg-rose-100 text-rose-700 px-1.5 py-0.5 rounded border border-rose-200 dark:bg-rose-900/40 dark:border-rose-800">مرتجع جزئي</span>
                          ) : null}
                        </div>
                        {canPartialDeliver(o) && (
                          <div className="flex items-center gap-1">
                            <button onClick={() => openPartialDeliveryModal(o)} className="px-2 py-0.5 text-[10px] bg-orange-100 text-orange-700 rounded dark:bg-orange-900/40 dark:text-orange-400 font-bold">تسليم جزئي</button>
                          </div>
                        )}
                      </div>
                      <div className="bg-slate-50 dark:bg-slate-800/50 rounded-md p-1.5 ml-5 mb-1.5">
                        {(o.products || []).filter((p: any) => Number(p.quantity || p.qty || 0) > 0).slice(0, 2).map((p: any, i: number) => (
                          <div key={i} className="flex justify-between text-[10px] text-slate-600 dark:text-slate-400">
                            <span className="truncate">{p.name}</span><span>x{p.quantity || p.qty}</span>
                          </div>
                        ))}
                      </div>
                      <div className="text-right ml-5 text-xs font-black text-emerald-600">{money(computeActiveOrderDisplayValue(o))} {currencySymbol}</div>
                    </div>
                  )
                ))}
              </div>
            </div>

            {/* Deferred Orders */}
            <div className="border border-slate-200 dark:border-slate-700 rounded-2xl p-3 flex flex-col max-h-[600px]">
              <div className="flex flex-col gap-2 mb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="text-sm font-bold text-slate-800 dark:text-slate-200">النزول (في عهدة المندوب) ({deferredOrders.length})</div>
                    {deferredOrders.length > 0 && (
                      <button onClick={moveAllDeferredBack} className="px-2 py-0.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:hover:bg-indigo-900/50 dark:text-indigo-400 text-[11px] font-bold transition-colors">
                        ارجاع الكل
                      </button>
                    )}
                  </div>
                  <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-lg p-1">
                    <button onClick={() => setDeferredOrdersSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')} className="p-1 rounded-md text-slate-500 hover:bg-white dark:hover:bg-slate-700 transition-colors"><ArrowDown size={14} className={deferredOrdersSortOrder === 'asc' ? 'rotate-180' : ''} /></button>
                    <div className="w-px h-4 bg-slate-300 dark:bg-slate-600 mx-1"></div>
                    <button onClick={() => setDeferredOrdersViewMode('list')} className={`p-1 rounded-md ${deferredOrdersViewMode === 'list' ? 'bg-white dark:bg-slate-700 text-indigo-600' : 'text-slate-500'}`}><List size={14} /></button>
                    <button onClick={() => setDeferredOrdersViewMode('card')} className={`p-1 rounded-md ${deferredOrdersViewMode === 'card' ? 'bg-white dark:bg-slate-700 text-indigo-600' : 'text-slate-500'}`}><LayoutGrid size={14} /></button>
                  </div>
                </div>
              </div>
              <div className={`overflow-y-auto flex-1 custom-scrollbar pr-1 ${deferredOrdersViewMode === 'list' ? 'divide-y divide-slate-100 dark:divide-slate-800' : 'space-y-2'}`}>
                {deferredOrders.length === 0 ? <div className="text-xs text-slate-400 text-center py-6">لا توجد اوردرات.</div> : deferredOrdersSorted.map(o => (
                  deferredOrdersViewMode === 'list' ? (
                    <div key={o.id} className="flex items-center justify-between py-2 px-1 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                      <div className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate max-w-[120px]">#{o.orderNumber || o.order_number} {o.customerName || o.customer_name || o.name}</div>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-black text-emerald-600">{money(computeActiveOrderDisplayValue(o))}</span>
                        <button onClick={() => moveDeferredBack(o)} className="px-2 py-0.5 text-[10px] bg-slate-100 text-slate-700 rounded dark:bg-slate-800 dark:text-slate-300">ارجاع</button>
                      </div>
                    </div>
                  ) : (
                    <div key={o.id} className="border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 bg-white dark:bg-slate-900">
                      <div className="flex items-start justify-between mb-2">
                        <div className="text-xs font-bold text-slate-800 dark:text-slate-200">#{o.orderNumber || o.order_number} — {o.customerName || o.customer_name || o.name}</div>
                        <button onClick={() => moveDeferredBack(o)} className="px-2 py-0.5 text-[10px] bg-slate-100 text-slate-700 rounded dark:bg-slate-800 dark:text-slate-300 font-bold">ارجاع</button>
                      </div>
                      <div className="bg-slate-50 dark:bg-slate-800/50 rounded-md p-1.5 mb-1.5">
                        {(o.products || []).filter((p: any) => Number(p.quantity || p.qty || 0) > 0).slice(0, 2).map((p: any, i: number) => (
                          <div key={i} className="flex justify-between text-[10px] text-slate-600 dark:text-slate-400">
                            <span className="truncate">{p.name}</span><span>x{p.quantity || p.qty}</span>
                          </div>
                        ))}
                      </div>
                      <div className="text-right text-xs font-black text-emerald-600">{money(computeActiveOrderDisplayValue(o))} {currencySymbol}</div>
                    </div>
                  )
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* View Modals */}
      {viewModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4" dir="rtl">
          <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-200">
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50">
              <h3 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                {viewModal === 'delivered' ? <PackageCheck className="text-emerald-500" /> : viewModal === 'returned' ? <PackageX className="text-rose-500" /> : <PackageCheck className="text-amber-500" />}
                {viewModal === 'delivered' ? 'الاوردرات المسلمة' : viewModal === 'returned' ? 'الاوردرات المرتجعة' : 'أوردرات النزول (مع المندوب)'}
              </h3>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (viewModal === 'deferred') {
                      moveAllDeferredBack();
                    } else if (viewModal === 'delivered') {
                      const curList = modalFilter === 'full' ? delivFullList : modalFilter === 'partial' ? delivPartialList : modalFilter === 'exchange' ? delivExchangeList : finalDeliveredList;
                      handleUndoAllOrders(curList, 'المسلمة', 'delivery');
                    } else if (viewModal === 'returned') {
                      const curList = modalFilter === 'full' ? returnFullList : modalFilter === 'partial' ? returnPartialList : modalFilter === 'exchange' ? returnExchangeList : finalReturnedList;
                      handleUndoAllOrders(curList, 'المرتجعة', 'return');
                    }
                  }}
                  disabled={
                    loading ||
                    (viewModal === 'deferred' && deferredOrders.length === 0) ||
                    (viewModal === 'delivered' && finalDeliveredList.length === 0) ||
                    (viewModal === 'returned' && finalReturnedList.length === 0)
                  }
                  className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-xs font-black shadow-sm transition-all flex items-center gap-1.5"
                  title="إرجاع جميع الأوردرات في هذه القائمة إلى العهدة الحالية"
                >
                  إرجاع الكل ↩️
                </button>
                <button onClick={() => setViewModal(null)} className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600">✕</button>
              </div>
            </div>

            {/* Filter Tabs for Delivered / Returned */}
            {viewModal !== 'deferred' && (
              <div className="px-5 py-2 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2 bg-slate-50/50 dark:bg-slate-800/30 overflow-x-auto">
                <button
                  onClick={() => setModalFilter('all')}
                  className={`px-3 py-1 rounded-xl text-xs font-bold transition-all ${modalFilter === 'all' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100'}`}
                >
                  الكل ({viewModal === 'delivered' ? finalDeliveredList.length : finalReturnedList.length})
                </button>
                <button
                  onClick={() => setModalFilter('full')}
                  className={`px-3 py-1 rounded-xl text-xs font-bold transition-all ${modalFilter === 'full' ? (viewModal === 'delivered' ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white') : 'bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100'}`}
                >
                  {viewModal === 'delivered' ? `تسليم كامل (${delivFullList.length})` : `ارتجاع كامل (${returnFullList.length})`}
                </button>
                <button
                  onClick={() => setModalFilter('partial')}
                  className={`px-3 py-1 rounded-xl text-xs font-bold transition-all ${modalFilter === 'partial' ? 'bg-amber-600 text-white' : 'bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100'}`}
                >
                  {viewModal === 'delivered' ? `تسليم جزئي (${delivPartialList.length})` : `ارتجاع جزئي (${returnPartialList.length})`}
                </button>
                {viewModal === 'delivered' && delivExchangeList.length > 0 && (
                  <button
                    onClick={() => setModalFilter('exchange')}
                    className={`px-3 py-1 rounded-xl text-xs font-bold transition-all ${modalFilter === 'exchange' ? 'bg-purple-600 text-white' : 'bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100'}`}
                  >
                    استبدال ({delivExchangeList.length})
                  </button>
                )}
                {viewModal === 'returned' && returnExchangeList.length > 0 && (
                  <button
                    onClick={() => setModalFilter('exchange')}
                    className={`px-3 py-1 rounded-xl text-xs font-bold transition-all ${modalFilter === 'exchange' ? 'bg-purple-600 text-white' : 'bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100'}`}
                  >
                    استبدال ({returnExchangeList.length})
                  </button>
                )}
              </div>
            )}

            <div className="p-5 overflow-y-auto flex-1 custom-scrollbar">
              {(() => {
                const list = viewModal === 'delivered'
                  ? (modalFilter === 'full' ? delivFullList : modalFilter === 'partial' ? delivPartialList : modalFilter === 'exchange' ? delivExchangeList : finalDeliveredList)
                  : viewModal === 'returned'
                  ? (modalFilter === 'full' ? returnFullList : modalFilter === 'partial' ? returnPartialList : modalFilter === 'exchange' ? returnExchangeList : finalReturnedList)
                  : deferredOrders;
                if (list.length === 0) return <div className="text-center text-slate-500 py-12">لا توجد اوردرات في هذه القائمة.</div>;
                return (
                  <table className="w-full text-sm text-right">
                    <thead className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                      <tr>
                        <th className="p-3 font-bold rounded-r-xl">رقم الاوردر</th>
                        <th className="p-3 font-bold">العميل</th>
                        <th className="p-3 font-bold text-center">القطع</th>
                        <th className="p-3 font-bold text-center">القيمة</th>
                        <th className="p-3 font-bold rounded-l-xl text-center">إجراء</th>
                      </tr>
                    </thead>
                    <tbody>
                      {list.map(o => {
                        const isEx = isExchangeOrder(o);
                        const isPartial = isOrderPartialReturnInReturnedList(o);
                        let badge = null;
                        if (isEx) {
                          badge = <span className="mr-2 px-2 py-0.5 rounded text-[10px] font-bold inline-block border bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:border-purple-800 dark:text-purple-300">استبدال</span>;
                        } else if (viewModal === 'delivered') {
                          const isDelivPartial = isPartialDeliveryOrder(o);
                          badge = <span className={`mr-2 px-2 py-0.5 rounded text-[10px] font-bold inline-block border ${isDelivPartial ? 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:border-amber-800 dark:text-amber-400' : 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:border-emerald-800 dark:text-emerald-400'}`}>{isDelivPartial ? 'تسليم جزئي' : 'تسليم كامل'}</span>;
                        } else if (viewModal === 'returned') {
                          badge = <span className={`mr-2 px-2 py-0.5 rounded text-[10px] font-bold inline-block border ${isPartial ? 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:border-amber-800 dark:text-amber-400' : 'bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-900/30 dark:border-rose-800 dark:text-rose-400'}`}>{isPartial ? 'ارتجاع جزئي' : 'ارتجاع كامل'}</span>;
                        }

                        return (
                          <tr key={o.id} className="border-b border-slate-50 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800/30">
                            <td className="p-3 font-black text-slate-900 dark:text-white">
                              #{o.orderNumber || o.order_number || o.id}
                              {badge}
                            </td>
                            <td className="p-3 text-slate-700 dark:text-slate-300">{o.customerName || o.customer_name || o.name || '—'}</td>
                            <td className="p-3 text-center text-slate-600 dark:text-slate-400">
                              {viewModal === 'returned' ? computeReturnedPieces(o) : viewModal === 'delivered' ? computeDeliveredNetPieces(o) : computePieces(o)}
                            </td>
                            <td className="p-3 font-bold text-center text-emerald-600 dark:text-emerald-400">
                              {money(viewModal === 'returned' ? computeReturnedOrderValue(o) : viewModal === 'delivered' ? computeDeliveredNetValue(o) : computeOrderValueWithoutShipping(o))} {currencySymbol}
                            </td>
                            <td className="p-3 text-center">
                              {viewModal === 'deferred' ? (
                                <button
                                  onClick={() => moveDeferredBack(o)}
                                  disabled={loading}
                                  className="px-2 py-1 flex items-center justify-center gap-1 mx-auto bg-amber-50 hover:bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:hover:bg-amber-900/50 dark:text-amber-400 font-bold text-[10px] rounded border border-amber-200 dark:border-amber-800/50 transition-colors disabled:opacity-50"
                                  title="إرجاع الأوردر إلى العهدة الحالية"
                                >
                                  إرجاع ↩️
                                </button>
                              ) : (
                                <button
                                  onClick={() => handleUndoOrder(getRealOrderId(o), viewModal === 'delivered' ? 'delivery' : 'return')}
                                  disabled={loading}
                                  className="px-2 py-1 flex items-center justify-center gap-1 mx-auto bg-rose-50 hover:bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:hover:bg-rose-900/50 dark:text-rose-400 font-bold text-[10px] rounded border border-rose-200 dark:border-rose-800/50 transition-colors disabled:opacity-50"
                                  title="إرجاع الأوردر إلى العهدة الحالية"
                                >
                                  إرجاع ↩️
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* ===== Partial Delivery Modal ===== */}
      {partialDeliveryOrder && (() => {
        const products = partialDeliveryOrder.products || partialDeliveryOrder.order_items || partialDeliveryOrder.items || [];
        const orderNum = partialDeliveryOrder.order_number || partialDeliveryOrder.orderNumber || '';
        const customerName = partialDeliveryOrder.customerName || partialDeliveryOrder.customer_name || partialDeliveryOrder.name || '';
        const totalOriginalQty = products.reduce((s: number, p: any) => s + (toNum(p.quantity ?? p.qty ?? 0) + toNum(p.delivered_quantity ?? 0)), 0);
        const totalDeliveredQty = products.reduce((s: number, p: any, idx: number) => {
          const origQty = toNum(p.quantity ?? p.qty ?? 0) + toNum(p.delivered_quantity ?? 0);
          const delivQty = Math.min(toNum(partialDeliveryQtys[idx] ?? 0), origQty);
          return s + delivQty;
        }, 0);
        const totalRemainingQty = totalOriginalQty - totalDeliveredQty;

        return (
          <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4" dir="rtl">
            <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
              <div className="bg-gradient-to-l from-orange-500 to-orange-600 px-5 py-4">
                <h3 className="text-white font-black text-base">تسليم جزئي للأوردر</h3>
                <p className="text-orange-100 text-xs mt-0.5">#{orderNum} — {customerName}</p>
              </div>
              <div className="flex items-center gap-3 px-5 py-2.5 bg-orange-50 dark:bg-orange-900/20 border-b border-orange-100 dark:border-orange-800/40 text-xs flex-wrap">
                <span className="text-slate-500 dark:text-slate-400">الأصلي: <strong>{totalOriginalQty}</strong></span>
                <span className="text-emerald-600 dark:text-emerald-400">مسلمة: <strong>{totalDeliveredQty}</strong></span>
                <span className="text-rose-600 dark:text-rose-400">ستبقى مع المندوب: <strong>{totalRemainingQty}</strong></span>
              </div>
              <div className="p-5 max-h-[60vh] overflow-y-auto">
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-4 text-center">انقر على المنتج لنقله بين الصناديق. ما يوجد في صندوق "ما تم تسليمه" سيتم تسليمه للعميل، والمتبقي سيظل في عهدة المندوب.</p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* صندوق: باقي في عهدة المندوب */}
                  <div className="bg-rose-50/50 dark:bg-rose-900/10 p-3 rounded-2xl border border-rose-100 dark:border-rose-900/30 flex flex-col">
                    <h4 className="font-bold text-rose-700 dark:text-rose-400 text-xs mb-3 text-center sticky top-0 bg-rose-50/90 dark:bg-rose-900/90 backdrop-blur-sm py-2 rounded-lg shadow-sm border border-rose-100 dark:border-rose-800 z-10">
                      باقي في عهدة المندوب (المتبقي)
                      <div className="text-[10px] font-normal text-rose-500 dark:text-rose-300 mt-0.5">انقر على القطع لتسليمها</div>
                    </h4>
                    <div className="space-y-2 flex-1">
                      {products.map((p: any, idx: number) => {
                        const maxQty = toNum(p.quantity ?? p.qty ?? 0) + toNum(p.delivered_quantity ?? 0);
                        const delivQty = Math.min(toNum(partialDeliveryQtys[idx] ?? 0), maxQty);
                        const remainQty = maxQty - delivQty;
                        const unitPrice = parseNumeric(p.price ?? p.price_per_unit ?? p.sale_price ?? p.unit_price ?? 0);
                        if (remainQty <= 0) return null;
                        
                        return (
                          <div 
                            key={`rem-${idx}`}
                            onClick={() => setPartialDeliveryQtys(prev => ({ ...prev, [idx]: delivQty + 1 }))}
                            className="cursor-pointer bg-white dark:bg-slate-800 p-2.5 rounded-xl border border-rose-200 dark:border-rose-800 shadow-sm hover:border-emerald-400 hover:shadow-md transition-all flex items-center justify-between group"
                          >
                            <div className="flex-1 min-w-0 pr-2 border-r-[3px] border-rose-400 dark:border-rose-600">
                              <p className="text-[11px] font-bold text-slate-800 dark:text-slate-200 truncate">{p.name || p.product_name || `منتج ${idx + 1}`}</p>
                              <div className="flex items-center gap-2 mt-1">
                                {(p.color || p.size) && <p className="text-[9px] text-slate-500 dark:text-slate-400">{p.color} {p.size ? `- ${p.size}` : ''}</p>}
                                {unitPrice > 0 && <p className="text-[9px] text-slate-400 font-bold">{money(unitPrice)} ج.م</p>}
                              </div>
                            </div>
                            <div className="flex items-center gap-2.5 mr-2">
                              <span className="text-xs font-black text-rose-700 dark:text-rose-300 bg-rose-100 dark:bg-rose-900/60 px-2 py-0.5 rounded-md min-w-[24px] text-center">{remainQty}</span>
                              <div className="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-slate-400 group-hover:bg-emerald-100 group-hover:text-emerald-600 transition-colors shrink-0">
                                <ArrowLeft size={14} />
                              </div>
                            </div>
                          </div>
                        );
                      })}
                      {products.every((p: any, idx: number) => {
                         const maxQty = toNum(p.quantity ?? p.qty ?? 0) + toNum(p.delivered_quantity ?? 0);
                         const delivQty = Math.min(toNum(partialDeliveryQtys[idx] ?? 0), maxQty);
                         return maxQty - delivQty <= 0;
                      }) && (
                        <div className="text-center p-4 text-xs text-rose-300 dark:text-rose-800/40 font-bold border-2 border-dashed border-rose-100 dark:border-rose-900/50 rounded-xl">لا توجد قطع متبقية</div>
                      )}
                    </div>
                  </div>

                  {/* صندوق: ما تم تسليمه */}
                  <div className="bg-emerald-50/50 dark:bg-emerald-900/10 p-3 rounded-2xl border border-emerald-100 dark:border-emerald-900/30 flex flex-col">
                    <h4 className="font-bold text-emerald-700 dark:text-emerald-400 text-xs mb-3 text-center sticky top-0 bg-emerald-50/90 dark:bg-emerald-900/90 backdrop-blur-sm py-2 rounded-lg shadow-sm border border-emerald-100 dark:border-emerald-800 z-10">
                      ما تم تسليمه (للعميل)
                      <div className="text-[10px] font-normal text-emerald-500 dark:text-emerald-300 mt-0.5">انقر على القطع لإرجاعها</div>
                    </h4>
                    <div className="space-y-2 flex-1">
                      {products.map((p: any, idx: number) => {
                        const maxQty = toNum(p.quantity ?? p.qty ?? 0) + toNum(p.delivered_quantity ?? 0);
                        const delivQty = Math.min(toNum(partialDeliveryQtys[idx] ?? 0), maxQty);
                        const unitPrice = parseNumeric(p.price ?? p.price_per_unit ?? p.sale_price ?? p.unit_price ?? 0);
                        if (delivQty <= 0) return null;
                        
                        return (
                          <div 
                            key={`deliv-${idx}`}
                            onClick={() => setPartialDeliveryQtys(prev => ({ ...prev, [idx]: delivQty - 1 }))}
                            className="cursor-pointer bg-white dark:bg-slate-800 p-2.5 rounded-xl border border-emerald-200 dark:border-emerald-800 shadow-sm hover:border-rose-400 hover:shadow-md transition-all flex items-center justify-between group"
                          >
                            <div className="flex items-center gap-2.5 ml-2">
                              <div className="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-slate-400 group-hover:bg-rose-100 group-hover:text-rose-600 transition-colors shrink-0">
                                <ArrowRight size={14} />
                              </div>
                              <span className="text-xs font-black text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-900/60 px-2 py-0.5 rounded-md min-w-[24px] text-center">{delivQty}</span>
                            </div>
                            <div className="flex-1 min-w-0 text-left pl-2 border-l-[3px] border-emerald-400 dark:border-emerald-600">
                              <p className="text-[11px] font-bold text-slate-800 dark:text-slate-200 truncate">{p.name || p.product_name || `منتج ${idx + 1}`}</p>
                              <div className="flex items-center justify-end gap-2 mt-1">
                                {unitPrice > 0 && <p className="text-[9px] text-slate-400 font-bold">{money(unitPrice)} ج.م</p>}
                                {(p.color || p.size) && <p className="text-[9px] text-slate-500 dark:text-slate-400">{p.color} {p.size ? `- ${p.size}` : ''}</p>}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                      {products.every((p: any, idx: number) => {
                         const maxQty = toNum(p.quantity ?? p.qty ?? 0) + toNum(p.delivered_quantity ?? 0);
                         return Math.min(toNum(partialDeliveryQtys[idx] ?? 0), maxQty) <= 0;
                      }) && (
                        <div className="text-center p-4 text-xs text-emerald-300 dark:text-emerald-800/40 font-bold border-2 border-dashed border-emerald-100 dark:border-emerald-900/50 rounded-xl">لم يتم تحديد أي قطع للتسليم</div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              <div className="px-5 py-3 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-700">
                <p className="text-[10px] text-slate-500 mb-3">سيتم تحويل حالة الأوردر إلى "مرتجع جزئي مع المندوب" وسيظل في العهدة الحالية حتى يتم استلام المنتجات المرتجعة في صفحة تسجيل المرتجعات.</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPartialDeliveryOrder(null)}
                    className="flex-1 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-sm font-bold hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >إلغاء</button>
                  <button
                    onClick={confirmPartialDelivery}
                    disabled={loading || totalDeliveredQty === 0 || totalRemainingQty === 0}
                    className="flex-1 px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white text-sm font-black transition-colors flex items-center justify-center gap-2"
                  >
                    {loading ? <Loader2 className="animate-spin" size={16} /> : null}
                    تأكيد (مرتجع جزئي مع المندوب)
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Modal: سداد دفعة تحت الحساب أثناء اليومية */}
      {isInterimModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" dir="rtl">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-gradient-to-r from-emerald-600 to-teal-600 text-white">
              <div className="flex items-center gap-2">
                <Receipt className="w-5 h-5" />
                <h3 className="font-black text-sm">سداد دفعة تحت الحساب (أثناء اليومية)</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsInterimModalOpen(false)}
                className="text-white/80 hover:text-white text-lg font-black w-7 h-7 flex items-center justify-center rounded-full hover:bg-white/20 transition-colors"
              >✕</button>
            </div>

            <div className="p-5 space-y-4">
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 rounded-2xl border border-emerald-100 dark:border-emerald-900/40 text-xs">
                <div className="flex justify-between mb-1">
                  <span className="text-slate-600 dark:text-slate-400">المندوب:</span>
                  <span className="font-black text-slate-900 dark:text-white">{selectedRep?.name}</span>
                </div>
                <div className="flex justify-between mb-1">
                  <span className="text-slate-600 dark:text-slate-400">رقم اليومية المفتوحة:</span>
                  <span className="font-bold text-emerald-700 dark:text-emerald-400">{openDailyInfo?.daily_code || '---'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600 dark:text-slate-400">حساب المندوب الحالي:</span>
                  <span className={`font-black ${balanceClass(repBalance)}`}>{money(repBalance)} {currencySymbol} ({balanceLabel(repBalance)})</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  المبلغ المدفوع تحت الحساب <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min={1}
                    autoFocus
                    placeholder="ادخل المبلغ..."
                    value={interimFormAmount || ''}
                    onChange={e => setInterimFormAmount(toNum(e.target.value))}
                    className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl px-4 py-2.5 text-base font-black text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <span className="absolute left-3 top-2.5 text-xs font-bold text-slate-400">{currencySymbol}</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  الخزينة المستلمة <span className="text-rose-500">*</span>
                </label>
                <select
                  value={interimFormTreasuryId}
                  onChange={e => setInterimFormTreasuryId(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl px-3 py-2.5 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="">اختر الخزينة...</option>
                  {treasuries.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  ملاحظات أو طريقة التحويل (اختياري)
                </label>
                <input
                  type="text"
                  placeholder="مثال: فودافون كاش / انستاباي / نقدي مع المشرف..."
                  value={interimFormNotes}
                  onChange={e => setInterimFormNotes(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="text-[11px] text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/50 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800">
                💡 <span className="font-semibold">توضيح:</span> سيتم إضافة هذا المبلغ فوراً إلى الخزينة المحددة، وخصمه من حساب المندوب ليقل المبلغ المطلوب منه عند إغلاق اليومية. تظل اليومية مفتوحة كما هي دون تغيير.
              </div>
            </div>

            <div className="px-5 py-3.5 bg-slate-50 dark:bg-slate-800/60 border-t border-slate-100 dark:border-slate-800 flex gap-2">
              <button
                type="button"
                onClick={() => setIsInterimModalOpen(false)}
                disabled={interimSubmitting}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleRecordInterimPayment}
                disabled={interimSubmitting || interimFormAmount <= 0 || !interimFormTreasuryId}
                className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-black shadow-sm transition-colors flex items-center justify-center gap-2"
              >
                {interimSubmitting ? <Loader2 className="animate-spin" size={16} /> : null}
                <span>{interimSubmitting ? 'جاري التسجيل...' : 'تأكيد واستلام الدفعة'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SalesDailyClose;
