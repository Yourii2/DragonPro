import React, { useEffect, useMemo, useRef, useState } from 'react';
import Swal from 'sweetalert2';
import { CheckCircle2, CheckSquare, Clock3, MapPin, Package2, Phone, PhoneCall, Printer, RefreshCw, Save, ScanLine, ShieldCheck, Trash2, UserCheck, Users2, WalletCards, XCircle } from 'lucide-react';
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
  products?: Array<{ quantity?: number | string; qty?: number | string; name?: string }>;
};

type AssignmentRow = {
  id: number;
  order_id: number;
  rep_id: number;
  rep_name: string;
  assigned_at?: string;
  order: OrderRow;
};

type DecisionType = 'confirm' | 'postpone' | 'cancel';

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

const companyName = localStorage.getItem('Dragon_company_name') || 'اسم الشركة';
const companyPhone = localStorage.getItem('Dragon_company_phone') || '01000000000';
const companyTerms = localStorage.getItem('Dragon_company_terms') || 'المعاينة حق للعميل قبل الاستلام.';

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
    case 'confirm':
      return 'مؤكدة';
    case 'postpone':
      return 'مؤجلة';
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
  inputRef?: React.RefObject<HTMLInputElement | null>;
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
}> = ({ assignment, badgeLabel, badgeClass, iconClass }) => {
  const order = assignment.order || { id: assignment.order_id };
  const orderProducts = getOrderProducts(order);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md dark:border-slate-700 dark:bg-slate-800">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
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
      </div>
    </div>
  );
};

const OrderConfirmations: React.FC = () => {
  const [reps, setReps] = useState<RepSummary[]>([]);
  const [selectedRepId, setSelectedRepId] = useState<number | null>(null);
  const [assignments, setAssignments] = useState<AssignmentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [assignBarcode, setAssignBarcode] = useState('');
  const [confirmBarcode, setConfirmBarcode] = useState('');
  const [postponeBarcode, setPostponeBarcode] = useState('');
  const [cancelBarcode, setCancelBarcode] = useState('');
  const [ordersToPrint, setOrdersToPrint] = useState<any[] | null>(null);
  const [stagedDecisions, setStagedDecisions] = useState<Record<number, StagedDecisionRow>>({});
  const assignInputRef = useRef<HTMLInputElement | null>(null);

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
      if (options?.preserveStaged) {
        setStagedDecisions((previous) => syncStagedDecisionsWithAssignments(previous, assignmentRows));
      } else {
        setStagedDecisions({});
      }

      const nextRepId = preferredRepId ?? selectedRepId;
      if (nextRepId && repRows.some((rep) => Number(rep.id) === Number(nextRepId))) {
        setSelectedRepId(Number(nextRepId));
      } else if (!nextRepId && repRows.length > 0) {
        setSelectedRepId(Number(repRows[0].id));
      } else if (repRows.length === 0) {
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
    () => selectedRepOrders.filter((assignment) => !stagedDecisions[Number(assignment.order_id)]),
    [selectedRepOrders, stagedDecisions]
  );

  const confirmedOrders = useMemo(
    () => Object.values(stagedDecisions).filter((item) => item.decision === 'confirm'),
    [stagedDecisions]
  );

  const postponedOrders = useMemo(
    () => Object.values(stagedDecisions).filter((item) => item.decision === 'postpone'),
    [stagedDecisions]
  );

  const cancelledOrders = useMemo(
    () => Object.values(stagedDecisions).filter((item) => item.decision === 'cancel'),
    [stagedDecisions]
  );

  const totalOrdersForSelectedRep = activeSelectedRepOrders.length;
  const totalValueForSelectedRep = activeSelectedRepOrders.reduce((sum, assignment) => sum + getOrderTotal(assignment.order || { id: assignment.order_id }), 0);

  const requireSelectedRep = () => {
    if (!selectedRepId) {
      Swal.fire('تنبيه', 'اختر المندوب أولاً.', 'warning');
      return false;
    }
    return true;
  };

  const handleAssignBarcode = async () => {
    const barcode = assignBarcode.trim();
    if (!requireSelectedRep() || !barcode) return;
    setSubmitting(true);
    try {
      const response = await fetch(`${API_BASE_PATH}/api.php?module=sales&action=assignOrderConfirmationByBarcode`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rep_id: selectedRepId, barcode })
      });
      const result = await response.json();
      if (!result?.success) throw new Error(result?.message || 'تعذر إسناد الأوردر.');
      await loadData(selectedRepId, { preserveStaged: true });
    } catch (error: any) {
      Swal.fire('تنبيه', error?.message || 'تعذر إسناد الأوردر.', 'warning');
    } finally {
      setAssignBarcode('');
      assignInputRef.current?.focus();
      setSubmitting(false);
    }
  };

  const stageDecision = (assignment: AssignmentRow, decision: DecisionType) => {
    setStagedDecisions((prev) => ({
      ...prev,
      [Number(assignment.order_id)]: { assignment, decision }
    }));
  };

  const resolveAssignmentByBarcode = async (barcode: string) => {
    const response = await fetch(`${API_BASE_PATH}/api.php?module=sales&action=resolveConfirmationBarcode&barcode=${encodeURIComponent(barcode)}`);
    const result = await response.json();
    if (!result?.success) {
      throw new Error(result?.message || 'تعذر العثور على الأوردر.');
    }
    const orderId = Number(result?.data?.order?.id || 0);
    const assignment = selectedRepOrders.find((item) => Number(item.order_id) === orderId);
    if (!assignment) {
      throw new Error('هذا الأوردر غير موجود حالياً في قائمة المندوب المختار.');
    }
    if (Number(assignment.rep_id) !== Number(selectedRepId)) {
      throw new Error(`هذا الأوردر تابع إلى مندوب آخر: ${assignment.rep_name || 'غير محدد'}`);
    }
    return assignment;
  };

  const handleDecisionBarcode = async (decision: 'confirm' | 'postpone' | 'cancel') => {
    const barcode = (decision === 'confirm' ? confirmBarcode : decision === 'postpone' ? postponeBarcode : cancelBarcode).trim();
    if (!requireSelectedRep() || !barcode) return;
    setSubmitting(true);
    try {
      const assignment = await resolveAssignmentByBarcode(barcode);
      stageDecision(assignment, decision);
      if (decision === 'confirm') setConfirmBarcode('');
      else if (decision === 'postpone') setPostponeBarcode('');
      else setCancelBarcode('');
      Swal.fire('تم', `تم نقل الأوردر إلى قائمة ${getDecisionLabel(decision)}. اضغط حفظ لتثبيت التغييرات.`, 'success');
    } catch (error: any) {
      Swal.fire('تنبيه', error?.message || 'تعذر تحديث الأوردر.', 'warning');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveCurrentState = async () => {
    const stagedItems = Object.values(stagedDecisions);
    if (!requireSelectedRep() || stagedItems.length === 0) {
      Swal.fire('تنبيه', 'لا توجد تغييرات لحفظها.', 'warning');
      return;
    }

    setSubmitting(true);
    try {
      for (const item of stagedItems) {
        const order = item.assignment.order || { id: item.assignment.order_id };
        const barcode = getOrderNumber(order);
        const response = await fetch(`${API_BASE_PATH}/api.php?module=sales&action=updateOrderConfirmationDecision`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rep_id: selectedRepId, barcode, decision: item.decision })
        });
        const result = await response.json();
        if (!result?.success) {
          throw new Error(result?.message || `تعذر حفظ حالة الأوردر ${barcode}.`);
        }
      }

      await loadData(selectedRepId);
      setConfirmBarcode('');
      setPostponeBarcode('');
      setCancelBarcode('');
      Swal.fire('تم', 'تم حفظ حالة الطلبيات الحالية بنجاح.', 'success');
    } catch (error: any) {
      Swal.fire('خطأ', error?.message || 'تعذر حفظ حالة الطلبيات الحالية.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleClearCurrentState = () => {
    setStagedDecisions({});
    setAssignBarcode('');
    setConfirmBarcode('');
    setPostponeBarcode('');
    setCancelBarcode('');
    assignInputRef.current?.focus();
  };

  const handlePrintCurrentRepOrders = () => {
    if (!activeSelectedRepOrders.length) {
      Swal.fire('تنبيه', 'لا توجد أوردرات حالية للمندوب المختار.', 'warning');
      return;
    }
    setOrdersToPrint(activeSelectedRepOrders.map((assignment) => assignment.order));
  };

  return (
    <div className="space-y-6 bg-slate-50/50 pb-12 dark:bg-slate-900" dir="rtl">
      
      {/* القسم العلوي: الهيرو يمين وشريط المناديب يسار (دائماً جنب بعض) */}
      <div className="overflow-x-auto">
        <div className="flex min-w-[980px] flex-row-reverse gap-6">
        
        {/* اليمين: شاشة تشغيل سريعة بالباركود */}
        <section className="flex min-h-[380px] min-w-0 flex-1 flex-col justify-between rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-black text-black dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100">
              <ShieldCheck className="h-4 w-4 text-blue-500" />
              شاشة تشغيل سريعة بالباركود
            </div>
            <h1 className="text-3xl font-black tracking-tight text-black dark:text-white lg:text-4xl">لوحة تأكيد الأوردرات</h1>
            <p className="mt-3 max-w-xl text-sm leading-8 text-black/75 dark:text-slate-400">
              شاشة تنفيذ واضحة وسريعة: اختر المندوب من القائمة الجانبية، ثم استخدم الباركود للإسناد أو التأكيد أو الإلغاء بدون التنقل بين جداول كثيرة أو تفاصيل غير لازمة.
            </p>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-4">
            <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 text-right dark:border-slate-600 dark:bg-slate-700/50">
              <div className="text-xs font-semibold text-black dark:text-slate-400">المسموح للإسناد</div>
              <div className="mt-2 text-lg font-black text-black dark:text-white">قيد الانتظار / مرتجع</div>
            </div>
            <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 text-right dark:border-slate-600 dark:bg-slate-700/50">
              <div className="text-xs font-semibold text-black dark:text-slate-400">حالات القرار</div>
              <div className="mt-2 text-lg font-black text-black dark:text-white">تأكيد / تأجيل / إلغاء</div>
            </div>
            <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 text-right dark:border-slate-600 dark:bg-slate-700/50">
              <div className="text-xs font-semibold text-black dark:text-slate-400">منع التضارب</div>
              <div className="mt-2 text-lg font-black text-black dark:text-white">مندوب واحد فقط</div>
            </div>
            <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 text-right dark:border-slate-600 dark:bg-slate-700/50">
              <div className="text-xs font-semibold text-black dark:text-slate-400">إعادة الطباعة</div>
              <div className="mt-2 text-lg font-black text-black dark:text-white">من نفس القائمة</div>
            </div>
          </div>
        </section>

        {/* اليسار: شريط المناديب */}
        <aside className="flex h-[450px] w-[340px] shrink-0 flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <div className="flex items-center justify-between border-b border-slate-100 p-5 dark:border-slate-700">
            <div className="flex items-center gap-2 text-sm font-black text-black dark:text-slate-100">
              <Users2 className="h-4 w-4 text-blue-500" />
              شريط المناديب
            </div>
            <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-black dark:bg-slate-700 dark:text-slate-200">
              {reps.length}
            </div>
          </div>

          <div className="overflow-y-auto p-4 custom-scrollbar flex-1 space-y-3">
            {loading ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-black dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">جار تحميل المناديب...</div>
            ) : reps.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-black dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">لا يوجد مناديب حالياً.</div>
            ) : (
              reps.map((rep) => {
                const active = Number(rep.id) === Number(selectedRepId);
                return (
                  <button
                    key={rep.id}
                    type="button"
                    onClick={() => setSelectedRepId(rep.id)}
                    className={`w-full rounded-2xl border p-4 text-right transition ${active ? 'border-blue-200 bg-white shadow-sm dark:border-blue-800 dark:bg-blue-950/30' : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-white dark:border-slate-700 dark:bg-slate-800 dark:hover:border-slate-600 dark:hover:bg-slate-750'}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl text-sm font-black ${active ? 'bg-blue-600 text-white' : 'bg-slate-100 text-black dark:bg-slate-700 dark:text-slate-200'}`}>
                        {getRepInitials(rep.name)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-black text-black dark:text-white">{rep.name}</div>
                        <div className="mt-1 truncate text-xs text-black dark:text-slate-400">{rep.phone || 'بدون هاتف'}</div>
                      </div>
                      <div className={`rounded-full px-3 py-1 text-xs font-black ${active ? 'bg-blue-50 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200' : 'bg-slate-100 text-black dark:bg-slate-700 dark:text-slate-200'}`}>
                        {rep.orders_count}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </aside>
        </div>
      </div>

      {/* قسم الإحصائيات والأدوات السريعة */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="المندوب النشط"
          value={selectedRep?.name || 'اختر مندوباً'}
          sub={selectedRep?.phone || 'رقم الهاتف غير متوفر'}
          iconBoxClass="bg-blue-50 dark:bg-blue-950/30"
          iconColorClass="text-blue-700 dark:text-blue-200"
          icon={UserCheck}
          iconClassName="h-5 w-5"
        />
        <StatCard
          title="عدد الأوردرات"
          value={totalOrdersForSelectedRep}
          sub="الأوردرات الموجودة الآن مع المندوب"
          iconBoxClass="bg-cyan-50 dark:bg-cyan-950/30"
          iconColorClass="text-cyan-700 dark:text-cyan-200"
          icon={Package2}
          iconClassName="h-6 w-6"
        />
        <StatCard
          title="إجمالي القيمة"
          value={formatCurrency(totalValueForSelectedRep)}
          sub="قيمة الأوردرات قبل اتخاذ القرار"
          iconBoxClass="bg-indigo-50 dark:bg-indigo-950/30"
          iconColorClass="text-indigo-700 dark:text-indigo-200"
          icon={WalletCards}
          iconClassName="h-6 w-6"
        />
        
        {/* صندوق أدوات سريعة */}
        <div className="relative flex flex-col justify-center overflow-hidden rounded-3xl border border-slate-300 bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.06)] dark:border-slate-700 dark:bg-slate-800">
          <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-l from-slate-900 via-slate-700 to-slate-500 dark:from-slate-200 dark:via-slate-400 dark:to-slate-500" />
          <div className="mb-3 flex items-center gap-2 text-sm font-black text-slate-900 dark:text-slate-100">
            <PhoneCall className="h-4 w-4 text-blue-500" />
            أدوات سريعة
          </div>
          <div className="mb-4 text-xs font-semibold leading-6 text-slate-600 dark:text-slate-300">
            أوامر مباشرة لإعادة التحميل والطباعة وحفظ التعديلات أو مسحها قبل التنفيذ النهائي.
          </div>
           <div className="grid grid-cols-2 gap-2 mt-auto">
             <button
                type="button"
                onClick={() => loadData(selectedRepId)}
                disabled={loading || submitting}
                className="flex flex-col items-center justify-center gap-1.5 rounded-xl border border-slate-300 bg-slate-100 p-2 text-xs font-black text-slate-900 transition-colors hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 dark:hover:bg-slate-600"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                تحديث
              </button>
              <button
                type="button"
                onClick={handlePrintCurrentRepOrders}
                disabled={selectedRepOrders.length === 0}
                className="flex flex-col items-center justify-center gap-1.5 rounded-xl bg-blue-600 p-2 text-xs font-black text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Printer className="h-4 w-4" />
                طباعة
              </button>
              <button
                type="button"
                onClick={handleSaveCurrentState}
                disabled={submitting || Object.keys(stagedDecisions).length === 0}
                className="flex flex-col items-center justify-center gap-1.5 rounded-xl bg-emerald-600 p-2 text-xs font-black text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Save className="h-4 w-4" />
                حفظ
              </button>
              <button
                type="button"
                onClick={handleClearCurrentState}
                disabled={submitting || loading}
                className="flex flex-col items-center justify-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 p-2 text-xs font-black text-rose-700 transition-colors hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-200 dark:hover:bg-rose-950/50"
              >
                <Trash2 className="h-4 w-4" />
                مسح
              </button>
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
            <div className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-black text-blue-700 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-200">ابدأ بالمسح أولاً</div>
          </div>

          <div className="grid gap-4 xl:grid-cols-4">
            <ScanPanel
              title="1. إسناد أوردر"
              description="امسح الباركود لإضافة الأوردر إلى المندوب المختار إذا كانت حالته مسموحة." 
              placeholder="باركود أو رقم الأوردر"
              value={assignBarcode}
              onChange={setAssignBarcode}
              onSubmit={handleAssignBarcode}
              disabled={submitting || !selectedRepId || !assignBarcode.trim()}
              icon={ScanLine}
              iconClass="bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-200"
              buttonClass="bg-blue-600 hover:bg-blue-700"
              buttonLabel="إسناد للمندوب"
              inputRef={assignInputRef}
            />

            <ScanPanel
              title="2. تأكيد أوردر"
              description="بعد إتمام التواصل، امسح الباركود هنا لتأكيد الأوردر وخروجه من القائمة الحالية."
              placeholder="باركود التأكيد"
              value={confirmBarcode}
              onChange={setConfirmBarcode}
              onSubmit={() => handleDecisionBarcode('confirm')}
              disabled={submitting || !selectedRepId || !confirmBarcode.trim()}
              icon={CheckCircle2}
              iconClass="bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-200"
              buttonClass="bg-emerald-600 hover:bg-emerald-700"
              buttonLabel="تأكيد الأوردر"
            />

            <ScanPanel
              title="3. تأجيل أوردر"
              description="إذا احتاج العميل متابعة لاحقاً، امسح الباركود هنا لتأجيل الأوردر وإخراجه من القائمة الحالية."
              placeholder="باركود التأجيل"
              value={postponeBarcode}
              onChange={setPostponeBarcode}
              onSubmit={() => handleDecisionBarcode('postpone')}
              disabled={submitting || !selectedRepId || !postponeBarcode.trim()}
              icon={Clock3}
              iconClass="bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-200"
              buttonClass="bg-amber-500 hover:bg-amber-600"
              buttonLabel="تأجيل الأوردر"
            />

            <ScanPanel
              title="4. إلغاء أوردر"
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
              <div className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-black text-black dark:bg-slate-700 dark:text-slate-200">{Object.keys(stagedDecisions).length} قرار جاهز للحفظ</div>
            </div>
          </div>

          <div className="p-5">
            {!selectedRepId ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-black dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
                اختر مندوباً من القائمة الجانبية لتظهر قائمة الأوردرات هنا.
              </div>
            ) : activeSelectedRepOrders.length === 0 && Object.keys(stagedDecisions).length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-black dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
                لا توجد أوردرات حالية مع هذا المندوب.
              </div>
            ) : (
              <div className="grid gap-4 xl:grid-cols-4">
                {[
                  {
                    title: 'الأوردرات الحالية مع المندوب',
                    items: activeSelectedRepOrders.map((assignment) => ({ assignment, decision: 'current' as const })),
                    emptyText: 'لا توجد أوردرات حالية مع هذا المندوب.',
                    badgeLabel: 'نشط الآن',
                    badgeClass: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-200',
                    iconClass: 'bg-blue-600'
                  },
                  {
                    title: 'أوردرات مؤكدة',
                    items: confirmedOrders,
                    emptyText: 'لا توجد أوردرات مؤكدة حالياً.',
                    badgeLabel: 'مؤكدة',
                    badgeClass: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-200',
                    iconClass: 'bg-emerald-600'
                  },
                  {
                    title: 'أوردرات مؤجلة',
                    items: postponedOrders,
                    emptyText: 'لا توجد أوردرات مؤجلة حالياً.',
                    badgeLabel: 'مؤجلة',
                    badgeClass: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-200',
                    iconClass: 'bg-amber-500'
                  },
                  {
                    title: 'أوردرات ملغية',
                    items: cancelledOrders,
                    emptyText: 'لا توجد أوردرات ملغية حالياً.',
                    badgeLabel: 'ملغية',
                    badgeClass: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-200',
                    iconClass: 'bg-rose-600'
                  },
                ].map((section) => (
                  <div key={section.title} className="rounded-3xl border border-slate-200 bg-slate-50/60 p-3 dark:border-slate-700 dark:bg-slate-900/40">
                    <div className="mb-3 flex items-center justify-between">
                      <h3 className="text-base font-black text-black dark:text-white">{section.title}</h3>
                      <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-black dark:bg-slate-800 dark:text-slate-200">{section.items.length}</span>
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

      {ordersToPrint ? <PrintableOrders orders={ordersToPrint} companyName={companyName} companyPhone={companyPhone} terms={companyTerms} /> : null}

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