import React, { useEffect, useMemo, useRef, useState } from 'react';
import Swal from 'sweetalert2';
import { CheckSquare, MapPin, Package2, Phone, PhoneCall, Printer, RotateCcw, Save, ScanLine, ShieldCheck, Trash2, UserCheck, Users2, WalletCards, XCircle } from 'lucide-react';
import { API_BASE_PATH } from '../services/apiConfig';
import { PrintableOrders } from './PrintableOrderCard';

type RepSummary = {
  id: number;
  name: string;
  phone?: string;
  orders_count: number;
};

type OrderRow = {
  id: number;
  orderNumber?: string;
  order_number?: string;
  customerName?: string;
  customer_name?: string;
  phone?: string;
  phone1?: string;
  phone2?: string;
  address?: string;
  governorate?: string;
  employee?: string;
  page?: string;
  status?: string;
  total?: number | string;
  total_amount?: number | string;
  notes?: string;
  products?: Array<{ quantity?: number | string; qty?: number | string; name?: string; color?: string; size?: string; productId?: number | string; product_id?: number | string }>;
};

type WarehouseRow = {
  id: number;
  name: string;
};

type StockSummaryRow = {
  product_id: number;
  product_name: string;
  color: string;
  size: string;
  required_qty: number;
  available_qty: number;
  shortage_qty: number;
};

type AssignmentRow = {
  id: number;
  order_id: number;
  rep_id: number;
  rep_name: string;
  status?: string;
  assigned_at?: string;
  order: OrderRow;
};

type DecisionType = 'cancel';

type StagedDecisionRow = {
  assignment: AssignmentRow;
  decision: DecisionType;
};

type LoadDataOptions = {
  preserveStaged?: boolean;
};

const toNumber = (value: unknown) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
};

const getOrderTotal = (order: OrderRow) => toNumber(order.total ?? order.total_amount);

const getOrderPieces = (order: OrderRow) =>
  Array.isArray(order.products)
    ? order.products.reduce((sum, product) => sum + toNumber(product.quantity ?? product.qty), 0)
    : 0;

const formatCurrency = (value: number) => value.toLocaleString('ar-EG');

// Removed static company variables (name, phone, terms) in favor of dynamic state
const getRepInitials = (name?: string) => {
  if (!name) return '؟';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return parts.slice(0, 2).map((part) => part.charAt(0)).join('').toUpperCase();
};

const getStatusBadgeClass = (status?: string) => {
  switch ((status || '').toLowerCase()) {
    case 'pending':
      return 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800/50';
    case 'postponed':
      return 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800/50';
    case 'returned':
      return 'bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-900/30 dark:text-rose-300 dark:border-rose-800/50';
    case 'confirmed':
      return 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800/50';
    default:
      return 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700';
  }
};

const getStatusLabel = (status?: string) => {
  switch ((status || '').toLowerCase()) {
    case 'pending':
      return 'قيد الانتظار';
    case 'returned':
      return 'مرتجع';
    case 'confirmed':
      return 'مؤكد';
    case 'postponed':
      return 'مؤجل';
    case 'cancelled':
      return 'ملغي';
    case 'with_rep':
      return 'مع المندوب';
    case 'in_delivery':
      return 'قيد التسليم';
    case 'delivered':
      return 'تم التسليم';
    case 'partial':
      return 'مرتجع جزئي';
    default:
      return status || 'غير محدد';
  }
};

const formatDateTime = (value?: string) => {
  if (!value) return 'الآن';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString('ar-EG', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const getOrderPrimaryPhone = (order: OrderRow) => order.phone || order.phone1 || order.phone2 || '';

const getOrderNumber = (order: OrderRow) => order.orderNumber || order.order_number || String(order.id);

const getOrderCustomerName = (order: OrderRow) => order.customerName || order.customer_name || 'عميل غير مسجل';

const getOrderProducts = (order: OrderRow) => Array.isArray(order.products) ? order.products : [];

const getDecisionLabel = (decision: DecisionType) => {
  switch (decision) {
    case 'cancel':
      return 'ملغية';
    default:
      return '';
  }
};

const syncStagedDecisionsWithAssignments = (
  previous: Record<number, StagedDecisionRow>,
  assignmentRows: AssignmentRow[]
) => {
  const assignmentsMap = new Map<number, AssignmentRow>(
    assignmentRows.map((assignment) => [Number(assignment.order_id), assignment])
  );

  return Object.values(previous).reduce<Record<number, StagedDecisionRow>>((next, stagedRow) => {
    const orderId = Number(stagedRow.assignment.order_id);
    const latestAssignment = assignmentsMap.get(orderId);
    if (!latestAssignment) {
      return next;
    }

    next[orderId] = {
      assignment: latestAssignment,
      decision: stagedRow.decision,
    };
    return next;
  }, {});
};

const StatCard: React.FC<{ title: string; value: string | number; sub?: string; iconBoxClass: string; iconColorClass: string; icon: React.ElementType; iconClassName?: string }> = ({
  title,
  value,
  sub,
  iconBoxClass,
  iconColorClass,
  icon: Icon,
  iconClassName
}) => (
  <div className="rounded-3xl border border-slate-300 bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.06)] dark:border-slate-700 dark:bg-slate-800">
    <div className="flex items-start justify-between gap-3">
      <div>
        <div className="text-xs font-black tracking-wide text-slate-700 dark:text-slate-300">{title}</div>
        <div className="mt-2 text-2xl font-black tracking-tight text-slate-950 dark:text-white">{value}</div>
        {sub ? <div className="mt-2 max-w-[18rem] text-xs font-semibold leading-6 text-slate-600 dark:text-slate-300">{sub}</div> : null}
      </div>
      <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-slate-200 shadow-sm dark:border-slate-600 ${iconBoxClass}`}>
        <Icon className={`${iconClassName || 'h-5 w-5'} ${iconColorClass}`} />
      </div>
    </div>
  </div>
);

const ScanPanel: React.FC<{
  title: string;
  description: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  disabled: boolean;
  icon: React.ElementType;
  iconClass: string;
  buttonClass: string;
  buttonLabel: string;
  inputRef?: React.RefObject<HTMLInputElement>;
}> = ({ title, description, placeholder, value, onChange, onSubmit, disabled, icon: Icon, iconClass, buttonClass, buttonLabel, inputRef }) => (
  <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 dark:border-slate-700 dark:bg-slate-800">
    <div className="relative">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <div className="text-base font-black text-black dark:text-white">{title}</div>
          <div className="mt-1 text-xs leading-6 text-black dark:text-slate-400">{description}</div>
        </div>
        <div className={`rounded-2xl p-3 shadow-sm ${iconClass}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
      <input
        ref={inputRef}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            onSubmit();
          }
        }}
        placeholder={placeholder}
        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-4 text-base font-bold text-black outline-none transition placeholder:text-black/55 focus:border-blue-500 focus:bg-white dark:border-slate-600 dark:bg-slate-900 dark:text-white dark:placeholder:text-slate-500"
      />
      <button
        type="button"
        onClick={onSubmit}
        disabled={disabled}
        className={`mt-3 inline-flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-black text-white transition disabled:cursor-not-allowed disabled:opacity-60 ${buttonClass}`}
      >
        <Icon className="h-4 w-4" />
        {buttonLabel}
      </button>
    </div>
  </div>
);

const SmallOrderCard: React.FC<{
  assignment: AssignmentRow;
  badgeLabel: string;
  badgeClass: string;
  iconClass: string;
  actionIcon: React.ElementType;
  actionLabel: string;
  actionClass: string;
  onAction: (assignment: AssignmentRow) => void;
  actionDisabled?: boolean;
  selectable?: boolean;
  selected?: boolean;
  onToggleSelect?: (assignment: AssignmentRow, selected: boolean) => void;
}> = ({ assignment, badgeLabel, badgeClass, iconClass, actionIcon: ActionIcon, actionLabel, actionClass, onAction, actionDisabled = false, selectable = false, selected = false, onToggleSelect }) => {
  const order = assignment.order || { id: assignment.order_id };
  const orderProducts = getOrderProducts(order);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md dark:border-slate-700 dark:bg-slate-800">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          {selectable ? (
            <label className="mb-2 inline-flex cursor-pointer items-center gap-2 text-[11px] font-bold text-slate-600 dark:text-slate-300">
              <input
                type="checkbox"
                checked={selected}
                onChange={(event) => onToggleSelect?.(assignment, event.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              تحديد
            </label>
          ) : null}
          <div className="mb-1 inline-flex rounded-lg bg-slate-100 px-2 py-1 font-mono text-[10px] font-bold text-slate-700 dark:bg-slate-700 dark:text-slate-200">
            {getOrderNumber(order)}
          </div>
          <h3 className="line-clamp-1 text-xs font-black text-slate-950 dark:text-white">{getOrderCustomerName(order)}</h3>
        </div>
        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-white shadow-sm ${iconClass}`}>
          <CheckSquare size={14} />
        </div>
      </div>

      <div className="space-y-2 text-[11px]">
        <div className="flex items-center justify-between gap-2">
          <span className={`rounded-full px-2.5 py-1 font-black ${badgeClass}`}>{badgeLabel}</span>
          <span className={`rounded-full border px-2.5 py-1 font-black ${getStatusBadgeClass(order.status)}`}>{getStatusLabel(order.status)}</span>
        </div>

        <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
          <Phone size={12} className="text-blue-500" />
          <span className="dir-ltr truncate font-mono text-slate-900 dark:text-white">{getOrderPrimaryPhone(order) || '-'}</span>
        </div>

        <div className="flex items-start gap-1.5 text-slate-600 dark:text-slate-300">
          <MapPin size={12} className="mt-0.5 shrink-0 text-rose-500" />
          <span className="line-clamp-1 text-slate-900 dark:text-slate-200">{order.governorate || '-'} - {order.address || '-'}</span>
        </div>

        <div className="rounded-xl bg-slate-50 px-3 py-2 dark:bg-slate-900/60">
          <div className="mb-1 flex items-center justify-between gap-2">
            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">المنتجات</span>
            <span className="text-[10px] font-black text-slate-700 dark:text-slate-300">{formatCurrency(getOrderTotal(order))}</span>
          </div>
          <div className="space-y-1">
            {orderProducts.slice(0, 1).map((product, index) => (
              <div key={`${assignment.id}-${index}`} className="flex justify-between gap-2 text-[10px]">
                <span className="truncate text-slate-700 dark:text-slate-200">{product.name || 'منتج'}</span>
                <span className="shrink-0 font-mono text-slate-500 dark:text-slate-400">x{toNumber(product.quantity ?? product.qty)}</span>
              </div>
            ))}
            {orderProducts.length === 0 ? <div className="text-[10px] text-slate-400">لا توجد منتجات.</div> : null}
            {orderProducts.length > 1 ? <div className="text-[10px] font-bold text-blue-600 dark:text-blue-300">+ {orderProducts.length - 1} إضافي</div> : null}
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 pt-1 text-[10px] text-slate-500 dark:text-slate-400">
          <span className="truncate">المندوب: {assignment.rep_name || '-'}</span>
          <span>{formatDateTime(assignment.assigned_at)}</span>
        </div>
        <button
          type="button"
          onClick={() => onAction(assignment)}
          disabled={actionDisabled}
          className={`mt-2 inline-flex w-full items-center justify-center gap-1 rounded-xl px-2.5 py-2 text-[11px] font-black text-white transition disabled:cursor-not-allowed disabled:opacity-60 ${actionClass}`}
        >
          <ActionIcon size={13} />
          {actionLabel}
        </button>
      </div>
    </div>
  );
};

const OrderConfirmations: React.FC = () => {
  const [reps, setReps] = useState<RepSummary[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseRow[]>([]);
  const [selectedRepId, setSelectedRepId] = useState<number | null>(null);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<number | null>(null);
  const [assignments, setAssignments] = useState<AssignmentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [assignBarcode, setAssignBarcode] = useState('');
  const [cancelBarcode, setCancelBarcode] = useState('');
  const [ordersToPrint, setOrdersToPrint] = useState<any[] | null>(null);
  const [selectedActiveOrderIds, setSelectedActiveOrderIds] = useState<number[]>([]);
  const [selectedCancelledOrderIds, setSelectedCancelledOrderIds] = useState<number[]>([]);
  const assignInputRef = useRef<HTMLInputElement | null>(null);
  const stockSummaryRequestRef = useRef(0);
  const [stockSummaryRows, setStockSummaryRows] = useState<StockSummaryRow[]>([]);
  const [stockSummaryLoading, setStockSummaryLoading] = useState(false);

  const [companySettings, setCompanySettings] = useState<any>({
    name: localStorage.getItem('Dragon_company_name') || 'اسم الشركة',
    phone: localStorage.getItem('Dragon_company_phone') || '01000000000',
    address: localStorage.getItem('Dragon_company_address') || '',
    terms: localStorage.getItem('Dragon_company_terms') || 'المعاينة حق للعميل قبل الاستلام.',
    logo: localStorage.getItem('Dragon_company_logo') || null
  });

  useEffect(() => {
    (async () => {
      try {
        const resp = await fetch(`${API_BASE_PATH}/get_settings.php`);
        const jr = await resp.json().catch(() => null);
        if (jr && jr.success && jr.data) {
          const s = jr.data;
          setCompanySettings((prev: any) => ({
            ...prev,
            name: s.company_name || prev.name,
            phone: s.company_phone || prev.phone,
            address: s.company_address || prev.address,
            terms: s.company_terms || prev.terms,
            logo: s.company_logo_url || s.company_logo || prev.logo
          }));
        }
      } catch (e) {}
    })();
  }, []);

  const loadData = async (preferredRepId?: number | null, options?: LoadDataOptions) => {
    setLoading(true);
    try {
      const [repsRes, assignmentsRes] = await Promise.all([
        fetch(`${API_BASE_PATH}/api.php?module=sales&action=getConfirmationRepSummary`).then((res) => res.json()),
        fetch(`${API_BASE_PATH}/api.php?module=sales&action=getConfirmationAssignments`).then((res) => res.json())
      ]);

      const repRows: RepSummary[] = repsRes?.success ? repsRes.data || [] : [];
      const assignmentRows: AssignmentRow[] = assignmentsRes?.success ? assignmentsRes.data || [] : [];
      setReps(repRows);
      setAssignments(assignmentRows);
      setSelectedActiveOrderIds((prev) => {
        const validIds = new Set(
          assignmentRows
            .filter((assignment) => String(assignment.status || '').toLowerCase() === 'assigned')
            .map((assignment) => Number(assignment.order_id))
        );
        return prev.filter((id) => validIds.has(Number(id)));
      });
      setSelectedCancelledOrderIds((prev) => {
        const validIds = new Set(
          assignmentRows
            .filter((assignment) => String(assignment.status || '').toLowerCase() === 'cancelled')
            .map((assignment) => Number(assignment.order_id))
        );
        return prev.filter((id) => validIds.has(Number(id)));
      });
      if (!options?.preserveStaged) {
        // no-op for current auto-save flow
      }

      const nextRepId = preferredRepId ?? selectedRepId;
      if (nextRepId && repRows.some((rep) => Number(rep.id) === Number(nextRepId))) {
        setSelectedRepId(Number(nextRepId));
      } else {
        setSelectedRepId(null);
      }
    } catch (error) {
      console.error('Failed to load confirmation board', error);
      Swal.fire('خطأ', 'تعذر تحميل بيانات تأكيد الأوردرات.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    const fetchWarehouses = async () => {
      try {
        const response = await fetch(`${API_BASE_PATH}/api.php?module=warehouses&action=getAll`);
        const result = await response.json();
        const rows: WarehouseRow[] = result?.success ? (result.data || []) : [];
        setWarehouses(rows);
        setSelectedWarehouseId((prev) => {
          if (prev && rows.some((row) => Number(row.id) === Number(prev))) return prev;
          return rows.length ? Number(rows[0].id) : null;
        });
      } catch (error) {
        console.error('Failed to load warehouses', error);
      }
    };
    fetchWarehouses();
  }, []);

  useEffect(() => {
    if (ordersToPrint && ordersToPrint.length > 0) {
      setTimeout(() => {
        window.print();
        setTimeout(() => setOrdersToPrint(null), 1000);
      }, 500);
    }
  }, [ordersToPrint]);

  const selectedRep = useMemo(
    () => reps.find((rep) => Number(rep.id) === Number(selectedRepId)) || null,
    [reps, selectedRepId]
  );

  const selectedRepOrders = useMemo(
    () => assignments.filter((assignment) => Number(assignment.rep_id) === Number(selectedRepId)),
    [assignments, selectedRepId]
  );

  const activeSelectedRepOrders = useMemo(
    () => selectedRepOrders.filter((assignment) => String(assignment.status || '').toLowerCase() === 'assigned'),
    [selectedRepOrders]
  );

  useEffect(() => {
    const activeIds = new Set(activeSelectedRepOrders.map((assignment) => Number(assignment.order_id)));
    setSelectedActiveOrderIds((prev) => prev.filter((id) => activeIds.has(Number(id))));
  }, [activeSelectedRepOrders]);

  const cancelledAssignments = useMemo(
    () => selectedRepOrders.filter((assignment) => String(assignment.status || '').toLowerCase() === 'cancelled'),
    [selectedRepOrders]
  );

  const cancelledOrders = useMemo(
    () => cancelledAssignments.map((assignment) => ({ assignment, decision: 'cancel' as const })),
    [cancelledAssignments]
  );

  useEffect(() => {
    const cancelledIds = new Set(cancelledAssignments.map((assignment) => Number(assignment.order_id)));
    setSelectedCancelledOrderIds((prev) => prev.filter((id) => cancelledIds.has(Number(id))));
  }, [cancelledAssignments]);

  const totalOrdersForSelectedRep = activeSelectedRepOrders.length;
  const totalPiecesForSelectedRep = activeSelectedRepOrders.reduce(
    (sum, assignment) => sum + getOrderPieces(assignment.order || { id: assignment.order_id }),
    0
  );
  const totalValueForSelectedRep = activeSelectedRepOrders.reduce((sum, assignment) => sum + getOrderTotal(assignment.order || { id: assignment.order_id }), 0);

  const refreshStockSummary = async (orderIdsOverride?: number[]) => {
    const warehouseId = Number(selectedWarehouseId || 0);
    if (warehouseId <= 0) {
      setStockSummaryRows([]);
      return;
    }

    const ids = Array.from(new Set((orderIdsOverride && orderIdsOverride.length ? orderIdsOverride : activeSelectedRepOrders.map((assignment) => Number(assignment.order_id))).filter((id) => Number(id) > 0)));
    const requestId = stockSummaryRequestRef.current + 1;
    stockSummaryRequestRef.current = requestId;

    setStockSummaryLoading(true);
    try {
      const response = await fetch(`${API_BASE_PATH}/api.php?module=sales&action=getConfirmationStockSummary`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ warehouse_id: warehouseId, order_ids: ids, include_all_reps_today: true })
      });
      const result = await response.json();
      if (requestId !== stockSummaryRequestRef.current) return;
      if (result?.success) {
        setStockSummaryRows(Array.isArray(result?.data?.items) ? result.data.items : []);
      } else {
        setStockSummaryRows([]);
      }
    } catch (error) {
      if (requestId !== stockSummaryRequestRef.current) return;
      console.error('Failed to load stock summary', error);
      setStockSummaryRows([]);
    } finally {
      if (requestId === stockSummaryRequestRef.current) {
        setStockSummaryLoading(false);
      }
    }
  };

  useEffect(() => {
    refreshStockSummary();
  }, [selectedWarehouseId, activeSelectedRepOrders]);

  const stockShortageCount = stockSummaryRows.filter((row) => Number(row.shortage_qty || 0) > 0).length;
  const stockTotalRequired = stockSummaryRows.reduce((sum, row) => sum + Number(row.required_qty || 0), 0);
  const stockTotalAvailable = stockSummaryRows.reduce((sum, row) => sum + Number(row.available_qty || 0), 0);

  const requireSelectedRep = () => {
    if (!selectedRepId) {
      Swal.fire('تنبيه', 'اختر المندوب أولاً.', 'warning');
      return false;
    }
    return true;
  };

  const requireSelectedWarehouse = () => {
    if (!selectedWarehouseId) {
      Swal.fire('تنبيه', 'اختر المخزن أولاً.', 'warning');
      return false;
    }
    return true;
  };

  const handleAssignBarcode = async () => {
    const barcode = assignBarcode.trim();
    if (!requireSelectedRep() || !requireSelectedWarehouse() || !barcode) return;
    setSubmitting(true);
    try {
      const resolveResponse = await fetch(`${API_BASE_PATH}/api.php?module=sales&action=resolveConfirmationBarcode&barcode=${encodeURIComponent(barcode)}`);
      const resolveResult = await resolveResponse.json();
      if (!resolveResult?.success) {
        throw new Error(resolveResult?.message || 'تعذر العثور على الأوردر.');
      }

      const candidateOrderId = Number(resolveResult?.data?.order?.id || 0);
      const candidateOrderIds = Array.from(
        new Set([
          ...activeSelectedRepOrders.map((assignment) => Number(assignment.order_id)),
          candidateOrderId
        ].filter((id) => id > 0))
      );

      const stockCheckResponse = await fetch(`${API_BASE_PATH}/api.php?module=sales&action=getConfirmationStockSummary`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ warehouse_id: selectedWarehouseId, order_ids: candidateOrderIds, include_all_reps_today: true })
      });
      const stockCheckResult = await stockCheckResponse.json();
      if (!stockCheckResult?.success) {
        throw new Error(stockCheckResult?.message || 'تعذر التحقق من المخزون.');
      }

      const shortages: StockSummaryRow[] = Array.isArray(stockCheckResult?.data?.shortages) ? stockCheckResult.data.shortages : [];
      if (shortages.length > 0) {
        const lines = shortages.slice(0, 6).map((row) => {
          const colorLabel = row.color ? ` / ${row.color}` : '';
          const sizeLabel = row.size ? ` / ${row.size}` : '';
          return `${row.product_name || 'منتج'}${colorLabel}${sizeLabel}: مطلوب ${row.required_qty}، متاح ${row.available_qty}`;
        });
        await refreshStockSummary(candidateOrderIds);
        throw new Error(`المخزون غير كافٍ في المخزن المختار:\n${lines.join('\n')}`);
      }

      const response = await fetch(`${API_BASE_PATH}/api.php?module=sales&action=assignOrderConfirmationByBarcode`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rep_id: selectedRepId, warehouse_id: selectedWarehouseId, barcode })
      });
      const result = await response.json();
      if (!result?.success) throw new Error(result?.message || 'تعذر إسناد الأوردر.');
      await loadData(selectedRepId, { preserveStaged: true });
      await refreshStockSummary();
    } catch (error: any) {
      Swal.fire('تنبيه', error?.message || 'تعذر إسناد الأوردر.', 'warning');
    } finally {
      setAssignBarcode('');
      assignInputRef.current?.focus();
      setSubmitting(false);
    }
  };

  const resolveAssignmentByBarcode = async (barcode: string) => {
    const response = await fetch(`${API_BASE_PATH}/api.php?module=sales&action=resolveConfirmationBarcode&barcode=${encodeURIComponent(barcode)}`);
    const result = await response.json();
    if (!result?.success) {
      throw new Error(result?.message || 'تعذر العثور على الأوردر.');
    }
    const orderId = Number(result?.data?.order?.id || 0);
    const assignment = selectedRepOrders.find(
      (item) => Number(item.order_id) === orderId && String(item.status || '').toLowerCase() === 'assigned'
    );
    if (!assignment) {
      throw new Error('هذا الأوردر غير موجود حالياً في قائمة المندوب المختار.');
    }
    if (Number(assignment.rep_id) !== Number(selectedRepId)) {
      throw new Error(`هذا الأوردر تابع إلى مندوب آخر: ${assignment.rep_name || 'غير محدد'}`);
    }
    return assignment;
  };

  const handleDecisionBarcode = async (decision: 'cancel') => {
    const barcode = cancelBarcode.trim();
    if (!requireSelectedRep() || !barcode) return;
    setSubmitting(true);
    try {
      await resolveAssignmentByBarcode(barcode);
      const response = await fetch(`${API_BASE_PATH}/api.php?module=sales&action=updateOrderConfirmationDecision`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rep_id: selectedRepId, barcode, decision })
      });
      const result = await response.json();
      if (!result?.success) {
        throw new Error(result?.message || `تعذر حفظ حالة الأوردر ${barcode}.`);
      }

      await loadData(selectedRepId);
      await refreshStockSummary([]);
      setCancelBarcode('');
      Swal.fire('تم', 'تم إلغاء الأوردر وحفظ الحالة تلقائياً.', 'success');
    } catch (error: any) {
      Swal.fire('تنبيه', error?.message || 'تعذر تحديث الأوردر.', 'warning');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleActiveOrder = (assignment: AssignmentRow, checked: boolean) => {
    const orderId = Number(assignment.order_id);
    setSelectedActiveOrderIds((prev) => {
      if (checked) {
        if (prev.includes(orderId)) return prev;
        return [...prev, orderId];
      }
      return prev.filter((id) => Number(id) !== orderId);
    });
  };

  const handleToggleSelectAllActiveOrders = (checked: boolean) => {
    if (!checked) {
      setSelectedActiveOrderIds([]);
      return;
    }
    setSelectedActiveOrderIds(activeSelectedRepOrders.map((assignment) => Number(assignment.order_id)));
  };

  const handleToggleCancelledOrder = (assignment: AssignmentRow, checked: boolean) => {
    const orderId = Number(assignment.order_id);
    setSelectedCancelledOrderIds((prev) => {
      if (checked) {
        if (prev.includes(orderId)) return prev;
        return [...prev, orderId];
      }
      return prev.filter((id) => Number(id) !== orderId);
    });
  };

  const handleToggleSelectAllCancelledOrders = (checked: boolean) => {
    if (!checked) {
      setSelectedCancelledOrderIds([]);
      return;
    }
    setSelectedCancelledOrderIds(cancelledAssignments.map((assignment) => Number(assignment.order_id)));
  };

  const handlePrintSelectedOrders = () => {
    if (!selectedActiveOrderIds.length) {
      Swal.fire('تنبيه', 'اختر أوردر واحد على الأقل للطباعة.', 'warning');
      return;
    }
    const selectedOrders = activeSelectedRepOrders
      .filter((assignment) => selectedActiveOrderIds.includes(Number(assignment.order_id)))
      .map((assignment) => assignment.order);

    if (!selectedOrders.length) {
      Swal.fire('تنبيه', 'لا توجد أوردرات صالحة للطباعة ضمن التحديد الحالي.', 'warning');
      return;
    }

    setOrdersToPrint(selectedOrders);
  };

  const handleRemoveSelectedOrders = async () => {
    if (!selectedRepId || !selectedActiveOrderIds.length) return;
    const confirm = await Swal.fire({
      title: 'حذف الأوردرات المحددة؟',
      text: `سيتم إزالة ${selectedActiveOrderIds.length} أوردر من قائمة الأوردرات الحالية مع المندوب.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'نعم، احذف المحدد',
      cancelButtonText: 'إلغاء'
    });
    if (!confirm.isConfirmed) return;

    setSubmitting(true);
    try {
      const response = await fetch(`${API_BASE_PATH}/api.php?module=sales&action=unassignOrderConfirmations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_ids: selectedActiveOrderIds })
      });
      const result = await response.json();
      if (!result?.success) {
        throw new Error(result?.message || 'تعذر حذف الأوردرات المحددة.');
      }
      setSelectedActiveOrderIds([]);
      await loadData(selectedRepId);
      await refreshStockSummary([]);
      Swal.fire('تم', 'تم حذف الأوردرات المحددة من القائمة.', 'success');
    } catch (error: any) {
      Swal.fire('تنبيه', error?.message || 'تعذر حذف الأوردرات المحددة.', 'warning');
    } finally {
      setSubmitting(false);
    }
  };

  const handlePrintSelectedCancelledOrders = () => {
    if (!selectedCancelledOrderIds.length) {
      Swal.fire('تنبيه', 'اختر أوردر ملغي واحد على الأقل للطباعة.', 'warning');
      return;
    }
    const selectedOrders = cancelledAssignments
      .filter((assignment) => selectedCancelledOrderIds.includes(Number(assignment.order_id)))
      .map((assignment) => assignment.order);

    if (!selectedOrders.length) {
      Swal.fire('تنبيه', 'لا توجد أوردرات ملغية صالحة للطباعة ضمن التحديد الحالي.', 'warning');
      return;
    }

    setOrdersToPrint(selectedOrders);
  };

  const handleRestoreSelectedCancelledOrders = async () => {
    if (!selectedRepId || !selectedCancelledOrderIds.length) return;
    const confirm = await Swal.fire({
      title: 'استرجاع الأوردرات المحددة؟',
      text: `سيتم استرجاع ${selectedCancelledOrderIds.length} أوردر ملغي وإعادته للأوردرات الحالية.`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'نعم، استرجع المحدد',
      cancelButtonText: 'إلغاء'
    });
    if (!confirm.isConfirmed) return;

    setSubmitting(true);
    try {
      let successCount = 0;
      for (const orderId of selectedCancelledOrderIds) {
        const response = await fetch(`${API_BASE_PATH}/api.php?module=sales&action=restoreCancelledOrderConfirmation`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rep_id: selectedRepId, order_id: orderId })
        });
        const result = await response.json();
        if (result?.success) successCount += 1;
      }

      if (successCount === 0) {
        throw new Error('تعذر استرجاع أي أوردر من المحدد.');
      }

      setSelectedCancelledOrderIds([]);
      await loadData(selectedRepId);
      await refreshStockSummary([]);
      Swal.fire('تم', `تم استرجاع ${successCount} أوردر من المحدد.`, 'success');
    } catch (error: any) {
      Swal.fire('تنبيه', error?.message || 'تعذر استرجاع الأوردرات المحددة.', 'warning');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemoveCurrentOrder = async (assignment: AssignmentRow) => {
    if (!selectedRepId) return;
    const orderNumber = getOrderNumber(assignment.order || { id: assignment.order_id });
    const confirm = await Swal.fire({
      title: 'حذف الأوردر من القائمة؟',
      text: `سيتم إزالة الأوردر ${orderNumber} من الأوردرات الحالية مع المندوب.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'نعم، احذف',
      cancelButtonText: 'إلغاء'
    });
    if (!confirm.isConfirmed) return;

    setSubmitting(true);
    try {
      const response = await fetch(`${API_BASE_PATH}/api.php?module=sales&action=unassignOrderConfirmations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_ids: [assignment.order_id] })
      });
      const result = await response.json();
      if (!result?.success) {
        throw new Error(result?.message || 'تعذر حذف الأوردر من القائمة.');
      }
      await loadData(selectedRepId);
      await refreshStockSummary([]);
      Swal.fire('تم', 'تم حذف الأوردر من قائمة الأوردرات الحالية.', 'success');
    } catch (error: any) {
      Swal.fire('تنبيه', error?.message || 'تعذر حذف الأوردر.', 'warning');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRestoreCancelledOrder = async (assignment: AssignmentRow) => {
    if (!selectedRepId) return;
    setSubmitting(true);
    try {
      const response = await fetch(`${API_BASE_PATH}/api.php?module=sales&action=restoreCancelledOrderConfirmation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rep_id: selectedRepId, order_id: assignment.order_id })
      });
      const result = await response.json();
      if (!result?.success) {
        throw new Error(result?.message || 'تعذر استرجاع الأوردر الملغي.');
      }
      await loadData(selectedRepId);
      await refreshStockSummary([]);
      Swal.fire('تم', 'تم استرجاع الأوردر وعودته للأوردرات الحالية.', 'success');
    } catch (error: any) {
      Swal.fire('تنبيه', error?.message || 'تعذر استرجاع الأوردر.', 'warning');
    } finally {
      setSubmitting(false);
    }
  };

  const handleClearAllAssignmentsToday = async () => {
    const confirm = await Swal.fire({
      title: 'تصفير كل إسنادات اليوم؟',
      text: 'سيتم مسح كل إسنادات التأكيد لكل المناديب اليوم وإعادة العدادات للصفر.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'نعم، صفّر الآن',
      cancelButtonText: 'إلغاء'
    });
    if (!confirm.isConfirmed) return;

    setSubmitting(true);
    try {
      const response = await fetch(`${API_BASE_PATH}/api.php?module=sales&action=clearAllOrderConfirmationsToday`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      const result = await response.json();
      if (!result?.success) {
        throw new Error(result?.message || 'تعذر تصفير إسنادات اليوم.');
      }

      const assignedCount = Number(result?.data?.assigned_count || 0);
      const cancelledCount = Number(result?.data?.cancelled_count || 0);
      const confirmedCount = Number(result?.data?.confirmed_count || 0);
      const postponedCount = Number(result?.data?.postponed_count || 0);

      setSelectedActiveOrderIds([]);
      setSelectedCancelledOrderIds([]);
      await loadData(selectedRepId ?? undefined);
      await refreshStockSummary([]);

      Swal.fire(
        'تم',
        `تم التصفير بنجاح.\nنشط: ${assignedCount} | ملغي: ${cancelledCount} | مؤكد: ${confirmedCount} | مؤجل: ${postponedCount}`,
        'success'
      );
    } catch (error: any) {
      Swal.fire('تنبيه', error?.message || 'تعذر تصفير إسنادات اليوم.', 'warning');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 bg-slate-50/50 pb-12 dark:bg-slate-900" dir="rtl">
      
      {/* القسم العلوي: الهيرو يمين وشريط المناديب يسار (دائماً جنب بعض) */}
      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <div className="grid gap-4 lg:grid-cols-[1.2fr_2fr]">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900/60">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-black text-slate-900 dark:text-slate-100">
                <Users2 className="h-4 w-4 text-blue-500" />
                اختيار المندوب
              </div>
              <div className="rounded-full bg-white px-3 py-1 text-xs font-black text-slate-700 dark:bg-slate-800 dark:text-slate-200">{reps.length}</div>
            </div>

            {loading ? (
              <div className="rounded-xl border border-dashed border-slate-300 bg-white p-4 text-center text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">جار تحميل المناديب...</div>
            ) : reps.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-300 bg-white p-4 text-center text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">لا يوجد مناديب حالياً.</div>
            ) : (
              <>
                <label className="mb-2 block text-xs font-black text-slate-600 dark:text-slate-300">اختر اسم المندوب</label>
                <select
                  value={selectedRepId ?? ''}
                  onChange={(event) => setSelectedRepId(event.target.value ? Number(event.target.value) : null)}
                  className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold text-black outline-none focus:border-blue-500 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
                >
                  <option value="">اختر مندوب...</option>
                  {reps.map((rep) => (
                    <option key={rep.id} value={rep.id}>
                      {rep.name} {rep.phone ? `- ${rep.phone}` : ''}
                    </option>
                  ))}
                </select>

                <label className="mb-2 mt-3 block text-xs font-black text-slate-600 dark:text-slate-300">اختر المخزن</label>
                <select
                  value={selectedWarehouseId ?? ''}
                  onChange={(event) => setSelectedWarehouseId(event.target.value ? Number(event.target.value) : null)}
                  className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold text-black outline-none focus:border-blue-500 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
                >
                  <option value="">اختر مخزن...</option>
                  {warehouses.map((warehouse) => (
                    <option key={warehouse.id} value={warehouse.id}>
                      {warehouse.name}
                    </option>
                  ))}
                </select>
              </>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900/60">
              <div className="text-xs font-semibold text-slate-600 dark:text-slate-400">عدد الأوردرات مع المندوب</div>
              <div className="mt-2 text-2xl font-black text-slate-900 dark:text-white">{totalOrdersForSelectedRep}</div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900/60">
              <div className="text-xs font-semibold text-slate-600 dark:text-slate-400">إجمالي عدد القطع مع المندوب</div>
              <div className="mt-2 text-2xl font-black text-slate-900 dark:text-white">{formatCurrency(totalPiecesForSelectedRep)}</div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900/60">
              <div className="text-xs font-semibold text-slate-600 dark:text-slate-400">إجمالي قيمة الأوردرات</div>
              <div className="mt-2 text-2xl font-black text-slate-900 dark:text-white">{formatCurrency(totalValueForSelectedRep)}</div>
            </div>

            <div className="sm:col-span-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900/60">
              <div className="mb-2 flex items-center justify-between gap-2">
                <div className="text-xs font-black text-slate-700 dark:text-slate-300">ملخص الاحتياج التراكمي للمخزون (كل المناديب اليوم)</div>
                <div className="flex items-center gap-2">
                  <div className={`rounded-full px-3 py-1 text-xs font-black ${stockShortageCount > 0 ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-200' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-200'}`}>
                    {stockShortageCount > 0 ? `عجز في ${stockShortageCount} صنف` : 'المخزون كافٍ'}
                  </div>
                  <button
                    type="button"
                    onClick={handleClearAllAssignmentsToday}
                    disabled={submitting || loading}
                    className="inline-flex items-center gap-1 rounded-full bg-rose-600 px-3 py-1 text-xs font-black text-white transition-colors hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    تصفير الإسنادات
                  </button>
                </div>
              </div>
              <div className="mb-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-xl bg-white px-3 py-2 text-xs font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-200">المطلوب: {formatCurrency(stockTotalRequired)}</div>
                <div className="rounded-xl bg-white px-3 py-2 text-xs font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-200">المتاح: {formatCurrency(stockTotalAvailable)}</div>
                <div className="rounded-xl bg-white px-3 py-2 text-xs font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-200">العناصر: {stockSummaryRows.length}</div>
                <div className="rounded-xl bg-white px-3 py-2 text-xs font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-200">المخزن: {warehouses.find((row) => Number(row.id) === Number(selectedWarehouseId))?.name || '-'}</div>
              </div>
              <div className="max-h-36 space-y-1 overflow-auto custom-scrollbar rounded-xl border border-slate-200 bg-white p-2 dark:border-slate-700 dark:bg-slate-800">
                {stockSummaryLoading ? (
                  <div className="px-2 py-3 text-center text-xs text-slate-500 dark:text-slate-400">جار فحص المخزون...</div>
                ) : stockSummaryRows.length === 0 ? (
                  <div className="px-2 py-3 text-center text-xs text-slate-500 dark:text-slate-400">لا توجد بيانات مخزون للعرض.</div>
                ) : (
                  stockSummaryRows.map((row, index) => (
                    <div key={`${row.product_id}-${row.color}-${row.size}-${index}`} className={`flex items-center justify-between gap-2 rounded-lg px-2 py-1 text-[11px] ${Number(row.shortage_qty || 0) > 0 ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-200' : 'bg-slate-50 text-slate-700 dark:bg-slate-900 dark:text-slate-200'}`}>
                      <div className="truncate font-bold">
                        {row.product_name || 'منتج'}
                        {row.color ? ` / ${row.color}` : ''}
                        {row.size ? ` / ${row.size}` : ''}
                      </div>
                      <div className="shrink-0 font-mono">{row.required_qty} / {row.available_qty}</div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* باقي الصفحة (صناديق الباركود والقائمة) */}
      <div className="space-y-6">
        
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-xs font-bold text-black dark:text-slate-400">مسار التنفيذ</div>
              <h2 className="mt-1 text-xl font-black text-black dark:text-white">نفّذ العملية من نفس الشاشة</h2>
            </div>
            {/* <div className="flex flex-wrap items-center gap-2">
              <div className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-black text-blue-700 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-200">ابدأ بالمسح أولاً</div>
            </div> */}
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <ScanPanel
              title="1. إسناد أوردر"
              description="امسح الباركود لإضافة الأوردر إلى المندوب المختار إذا كانت حالته مسموحة." 
              placeholder="باركود أو رقم الأوردر"
              value={assignBarcode}
              onChange={setAssignBarcode}
              onSubmit={handleAssignBarcode}
              disabled={submitting || !selectedRepId || !selectedWarehouseId || !assignBarcode.trim()}
              icon={ScanLine}
              iconClass="bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-200"
              buttonClass="bg-blue-600 hover:bg-blue-700"
              buttonLabel="إسناد للمندوب"
              inputRef={assignInputRef}
            />

            <ScanPanel
              title="2. إلغاء أوردر"
              description="إذا تعذر التنفيذ أو تم الرفض، امسح الباركود هنا لإلغاء الأوردر فوراً من نفس المسار."
              placeholder="باركود الإلغاء"
              value={cancelBarcode}
              onChange={setCancelBarcode}
              onSubmit={() => handleDecisionBarcode('cancel')}
              disabled={submitting || !selectedRepId || !cancelBarcode.trim()}
              icon={XCircle}
              iconClass="bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-200"
              buttonClass="bg-rose-600 hover:bg-rose-700"
              buttonLabel="إلغاء الأوردر"
            />
          </div>
        </div>

        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <div className="border-b border-slate-100 px-5 py-4 dark:border-slate-700">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-xs font-bold text-black dark:text-slate-400">قائمة التنفيذ</div>
                <h2 className="mt-1 text-xl font-black text-black dark:text-white">نتيجة تنفيذ الأوردرات الحالية</h2>
              </div>
              <div className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-black text-black dark:bg-slate-700 dark:text-slate-200">الحفظ يتم تلقائياً عند الإلغاء</div>
            </div>
          </div>

          <div className="p-5">
            {!selectedRepId ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-black dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
                اختر مندوباً من القائمة الجانبية لتظهر قائمة الأوردرات هنا.
              </div>
            ) : activeSelectedRepOrders.length === 0 && cancelledOrders.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-black dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
                لا توجد أوردرات حالية مع هذا المندوب.
              </div>
            ) : (
              <div className="grid gap-4 xl:grid-cols-2">
                {[
                  {
                    key: 'active' as const,
                    title: 'الأوردرات الحالية مع المندوب',
                    items: activeSelectedRepOrders.map((assignment) => ({ assignment, decision: 'current' as const })),
                    emptyText: 'لا توجد أوردرات حالية مع هذا المندوب.',
                    badgeLabel: 'نشط الآن',
                    badgeClass: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-200',
                    iconClass: 'bg-blue-600',
                    actionLabel: 'حذف من القائمة',
                    actionClass: 'bg-rose-600 hover:bg-rose-700',
                    actionIcon: Trash2,
                    onAction: handleRemoveCurrentOrder
                  },
                  {
                    key: 'cancelled' as const,
                    title: 'أوردرات ملغية',
                    items: cancelledOrders,
                    emptyText: 'لا توجد أوردرات ملغية حالياً.',
                    badgeLabel: 'ملغية',
                    badgeClass: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-200',
                    iconClass: 'bg-rose-600',
                    actionLabel: 'استرجاع الأوردر',
                    actionClass: 'bg-emerald-600 hover:bg-emerald-700',
                    actionIcon: RotateCcw,
                    onAction: handleRestoreCancelledOrder
                  },
                ].map((section) => (
                  <div key={section.title} className="rounded-3xl border border-slate-200 bg-slate-50/60 p-3 dark:border-slate-700 dark:bg-slate-900/40">
                    <div className="mb-3 flex items-center justify-between">
                      <h3 className="text-base font-black text-black dark:text-white">{section.title}</h3>
                      <div className="flex items-center gap-2">
                        {section.key === 'active' && section.items.length > 0 ? (
                          <>
                            <button
                              type="button"
                              onClick={() => handleToggleSelectAllActiveOrders(true)}
                              disabled={submitting || loading}
                              className="inline-flex items-center gap-1 rounded-xl border border-blue-200 bg-blue-50 px-2.5 py-1.5 text-[11px] font-black text-blue-700 transition-colors hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-blue-900/40 dark:bg-blue-950/30 dark:text-blue-200"
                            >
                              <CheckSquare className="h-3.5 w-3.5" />
                              تحديد الكل
                            </button>
                            <button
                              type="button"
                              onClick={handlePrintSelectedOrders}
                              disabled={selectedActiveOrderIds.length === 0 || submitting || loading}
                              className="inline-flex items-center gap-1 rounded-xl bg-blue-600 px-2.5 py-1.5 text-[11px] font-black text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              <Printer className="h-3.5 w-3.5" />
                              طباعة المحدد
                            </button>
                            <button
                              type="button"
                              onClick={handleRemoveSelectedOrders}
                              disabled={selectedActiveOrderIds.length === 0 || submitting || loading}
                              className="inline-flex items-center gap-1 rounded-xl bg-rose-600 px-2.5 py-1.5 text-[11px] font-black text-white transition-colors hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              حذف المحدد
                            </button>
                          </>
                        ) : null}
                        {section.key === 'cancelled' && section.items.length > 0 ? (
                          <>
                            <button
                              type="button"
                              onClick={() => handleToggleSelectAllCancelledOrders(true)}
                              disabled={submitting || loading}
                              className="inline-flex items-center gap-1 rounded-xl border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-[11px] font-black text-rose-700 transition-colors hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-200"
                            >
                              <CheckSquare className="h-3.5 w-3.5" />
                              تحديد الكل
                            </button>
                            <button
                              type="button"
                              onClick={handlePrintSelectedCancelledOrders}
                              disabled={selectedCancelledOrderIds.length === 0 || submitting || loading}
                              className="inline-flex items-center gap-1 rounded-xl bg-blue-600 px-2.5 py-1.5 text-[11px] font-black text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              <Printer className="h-3.5 w-3.5" />
                              طباعة المحدد
                            </button>
                            <button
                              type="button"
                              onClick={handleRestoreSelectedCancelledOrders}
                              disabled={selectedCancelledOrderIds.length === 0 || submitting || loading}
                              className="inline-flex items-center gap-1 rounded-xl bg-emerald-600 px-2.5 py-1.5 text-[11px] font-black text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              <RotateCcw className="h-3.5 w-3.5" />
                              استرجاع المحدد
                            </button>
                          </>
                        ) : null}
                        <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-black dark:bg-slate-800 dark:text-slate-200">{section.items.length}</span>
                      </div>
                    </div>
                    {section.items.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-5 text-center text-sm text-black dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
                        {section.emptyText}
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {section.items.map(({ assignment, decision }) => (
                          <SmallOrderCard
                            key={`${decision}-${assignment.id}`}
                            assignment={assignment}
                            badgeLabel={section.badgeLabel}
                            badgeClass={section.badgeClass}
                            iconClass={section.iconClass}
                            actionLabel={section.actionLabel}
                            actionClass={section.actionClass}
                            actionIcon={section.actionIcon}
                            onAction={section.onAction}
                            actionDisabled={submitting || loading}
                            selectable={section.key === 'active' || section.key === 'cancelled'}
                            selected={section.key === 'active'
                              ? selectedActiveOrderIds.includes(Number(assignment.order_id))
                              : selectedCancelledOrderIds.includes(Number(assignment.order_id))}
                            onToggleSelect={section.key === 'active' ? handleToggleActiveOrder : handleToggleCancelledOrder}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {ordersToPrint ? <PrintableOrders orders={ordersToPrint} companyName={companySettings.name} companyPhone={companySettings.phone} companyAddress={companySettings.address} companyLogo={companySettings.logo || undefined} terms={companySettings.terms} /> : null}

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background-color: #e2e8f0; border-radius: 20px; }
        .dark .custom-scrollbar::-webkit-scrollbar-thumb { background-color: #334155; }
      `}</style>
    </div>
  );
};

export default OrderConfirmations;