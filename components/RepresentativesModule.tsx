// آخر تحديث: 2026-02-11 (إصدار 1.0.4)
import React, { useState, useEffect } from 'react';
import { Users, Box, FileText, Search, UserCheck, RefreshCcw, Edit, Trash2, Eye, X, Save, PlusCircle, MinusCircle, Play, Square, Wallet, ShoppingCart } from 'lucide-react';
import Swal from 'sweetalert2';

import { API_BASE_PATH } from '../services/apiConfig';
import CustomSelect from './CustomSelect';

interface RepresentativesModuleProps {
  initialView?: string;
}

const RepresentativesModule: React.FC<RepresentativesModuleProps> = ({ initialView }) => {
  const [view, setView] = useState<'list' | 'custody' | 'transactions' | 'rep-cycle' | 'rep-performance'>(
    initialView === 'custody'
      ? 'custody'
      : initialView === 'transactions'
        ? 'transactions'
        : initialView === 'rep-cycle'
          ? 'rep-cycle'
          : initialView === 'rep-performance'
            ? 'rep-performance'
            : 'list'
  );
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRep, setEditingRep] = useState<any>(null);
  const [formData, setFormData] = useState({ name: '', phone: '', insurance_paid: false, insurance_amount: '' });
  const [representatives, setRepresentatives] = useState<any[]>([]);
  const [pendingOrders, setPendingOrders] = useState<any[]>([]);
  const [repAssignedOrders, setRepAssignedOrders] = useState<any[]>([]);
  const [selectedRepId, setSelectedRepId] = useState<number | null>(null);
  const currencySymbol = 'ج.م';
  const [repTransactions, setRepTransactions] = useState<any[]>([]);
  const [paymentForm, setPaymentForm] = useState<{ amount: string; type: 'payment'|'fine'|'settlement'; direction: 'in'|'out'; treasuryId: string; note: string }>({ amount: '', type: 'payment', direction: 'in', treasuryId: '', note: '' });
  const [treasuries, setTreasuries] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [userDefaults, setUserDefaults] = useState<any>(null);

  const todayISO = new Date().toISOString().split('T')[0];
  const [perfMode, setPerfMode] = useState<'date' | 'day' | 'week' | 'month' | 'year'>('month');
  const [perfDate, setPerfDate] = useState<string>(todayISO);
  const [perfMonth, setPerfMonth] = useState<string>(todayISO.slice(0, 7));
  const [perfYear, setPerfYear] = useState<string>(String(new Date().getFullYear()));
  const [perfRepId, setPerfRepId] = useState<string>('all');
  const [perfLoading, setPerfLoading] = useState(false);
  const [perfRows, setPerfRows] = useState<any[]>([]);
  const [perfTop10, setPerfTop10] = useState<any[]>([]);

  const parseTxDetails = (details: any) => {
    if (!details) return {};
    if (typeof details === 'object') return details;
    try { return JSON.parse(details); } catch (e) { return {}; }
  };

  const getTxLabel = (type: string, details: any) => {
    const labels: { [key: string]: string } = {
      rep_assignment: 'تسليم عهدة لمندوب',
      rep_payment_in: 'تحصيل من مندوب',
      rep_payment_out: 'دفعة لمندوب',
      rep_settlement: 'تسوية مندوب',
      rep_penalty: 'غرامة على المندوب',
      payment_in: 'تحصيل',
      payment_out: 'صرف'
    };
    const subtype = details?.subtype || '';
    if (subtype && labels[subtype]) return labels[subtype];
    return labels[type] || type || '-';
  } // <-- close getTxLabel

  // enhance getTxLabel to include common transaction types in Arabic
  const getTxLabelEnhanced = (type: string, details: any) => {
    const t = (type || '').toString();
    const map: { [k: string]: string } = {
      sale: 'مبيعات',
      purchase: 'شراء',
      return_in: 'مرتجع من عميل',
      return_out: 'مرتجع لمورد',
      rep_payment_in: 'تحصيل من مندوب',
      rep_payment_out: 'دفعة لمندوب',
      rep_settlement: 'تسوية مندوب',
      rep_penalty: 'غرامة',
      payment_in: 'تحصيل',
      payment_out: 'صرف',
      advance: 'دفع مسبق',
      daily_open: 'بدء يومية',
      daily_close: 'تقفيل يوم',
      settlement: 'تسوية',
      adjustment: 'تسوية',
      transfer: 'نقل',
      expense: 'مصروف'
    };
    const subtype = details?.subtype || '';
    if (subtype && map[subtype]) return map[subtype];
    return map[t] || getTxLabel(type, details) || '-';
  };

  const fetchReps = async () => {
    try {
      const res = await fetch(`${API_BASE_PATH}/api.php?module=users&action=getAllWithBalance`);
      const js = await res.json();
      if (js.success && Array.isArray(js.data)) {
        setRepresentatives(js.data);
      } else {
        setRepresentatives([]);
      }
    } catch (e) {
      console.error('Failed to fetch reps', e);
      setRepresentatives([]);
    }
  };

  useEffect(() => {
    if (['list', 'custody', 'transactions', 'rep-cycle', 'rep-performance'].includes(initialView || '')) {
      setView(initialView as any);
    }

    const fetchPending = async () => {
      try {
        const r = await fetch(`${API_BASE_PATH}/api.php?module=orders&action=getAll&status=pending`);
        const jr = await r.json();
        if (jr.success) setPendingOrders(jr.data || []);
      } catch (e) { console.error('Failed to fetch pending orders', e); }
    };

    const fetchTreasuries = async () => {
      try {
        const [tr, ud] = await Promise.all([
          fetch(`${API_BASE_PATH}/api.php?module=treasuries&action=getAll`).then(r=>r.json()),
          fetch(`${API_BASE_PATH}/api.php?module=permissions&action=getUserDefaults`).then(r=>r.json()).catch(()=>({success:false}))
        ]);
        const list = (tr && tr.success) ? (tr.data || []) : [];
        const defaults = (ud && ud.success) ? (ud.data || null) : null;
        if (defaults && defaults.default_treasury_id && !defaults.can_change_treasury) setTreasuries(list.filter((t:any)=>Number(t.id)===Number(defaults.default_treasury_id)));
        else setTreasuries(list);
        if (defaults && defaults.default_treasury_id && !paymentForm.treasuryId) setPaymentForm(prev => ({...prev, treasuryId: String(defaults.default_treasury_id)}));
        if (defaults) setUserDefaults(defaults);
      } catch (e) { console.error('Failed to fetch treasuries', e); }
    };

    const fetchUserDefaults = async () => {
      try {
        const r = await fetch(`${API_BASE_PATH}/api.php?module=permissions&action=getUserDefaults`);
        const jr = await r.json();
        if (jr && jr.success) {
          setUserDefaults(jr.data || null);
          if (jr.data && jr.data.default_treasury_id && !paymentForm.treasuryId) setPaymentForm(prev => ({...prev, treasuryId: String(jr.data.default_treasury_id)}));
        }
      } catch (e) { console.error('Failed to fetch user defaults', e); }
    };

    fetchReps();
    fetchPending();
    fetchTreasuries();
    fetchUserDefaults();
    // fetch warehouses for returns/restock
    const fetchWarehouses = async () => {
      try {
        const r = await fetch(`${API_BASE_PATH}/api.php?module=warehouses&action=getAll`);
        const jr = await r.json();
        if (jr && jr.success) setWarehouses(jr.data || []);
      } catch (e) { console.error('Failed to fetch warehouses', e); }
    };
    fetchWarehouses();
  }, [initialView]);

  const filteredReps = representatives.filter(r =>
    (r.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    String(r.phone || '').includes(searchTerm)
  );

  const toISODate = (d: Date) => d.toISOString().split('T')[0];

  const getPerfDateRange = () => {
    const safeDate = (s: string) => {
      const d = new Date(`${s}T00:00:00`);
      return isNaN(d.getTime()) ? new Date() : d;
    };

    if (perfMode === 'date' || perfMode === 'day') {
      const d = safeDate(perfDate);
      const iso = toISODate(d);
      return { startDate: iso, endDate: iso };
    }

    if (perfMode === 'week') {
      const d = safeDate(perfDate);
      const day = d.getDay(); // 0=Sun..6=Sat
      const diffToMonday = (day + 6) % 7; // Monday start
      const start = new Date(d);
      start.setDate(d.getDate() - diffToMonday);
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      return { startDate: toISODate(start), endDate: toISODate(end) };
    }

    if (perfMode === 'month') {
      const [y, m] = (perfMonth || '').split('-').map(v => Number(v));
      const year = y || new Date().getFullYear();
      const monthIndex = (m ? m - 1 : new Date().getMonth());
      const start = new Date(year, monthIndex, 1);
      const end = new Date(year, monthIndex + 1, 0);
      return { startDate: toISODate(start), endDate: toISODate(end) };
    }

    const y = Number(perfYear) || new Date().getFullYear();
    const start = new Date(y, 0, 1);
    const end = new Date(y, 11, 31);
    return { startDate: toISODate(start), endDate: toISODate(end) };
  };

  const computePerfFromOrders = (orders: any[]) => {
    const safeOrders = Array.isArray(orders) ? orders : [];
    const getStatus = (o: any) => o?.status || o?.order_status || o?.state || '';
    const delivered = safeOrders.filter(o => getStatus(o) === 'delivered');
    const returned = safeOrders.filter(o => getStatus(o) === 'returned');
    const withRep = safeOrders.filter(o => getStatus(o) === 'with_rep');
    const total = safeOrders.length;
    const totalHandled = delivered.length + returned.length;
    const returnRate = totalHandled > 0 ? Math.round((returned.length / totalHandled) * 100) : 0;
    const pct = (n: number) => (total > 0 ? Math.round((n / total) * 100) : 0);
    return {
      total,
      delivered: delivered.length,
      returned: returned.length,
      withRep: withRep.length,
      deliveredPct: pct(delivered.length),
      returnedPct: pct(returned.length),
      withRepPct: pct(withRep.length),
      returnRate,
    };
  };

  const fetchPerformanceReport = async () => {
    if (!Array.isArray(representatives) || representatives.length === 0) {
      setPerfRows([]);
      setPerfTop10([]);
      return;
    }

    const { startDate, endDate } = getPerfDateRange();
    setPerfLoading(true);
    try {
      const reps = representatives.slice();
      const rows = await Promise.all(
        reps.map(async (rep: any) => {
          const repId = Number(rep.id);
          if (!repId) return { repId: rep.id, repName: rep.name || '-', ...computePerfFromOrders([]) };
          const url = `${API_BASE_PATH}/api.php?module=orders&action=getByRep&rep_id=${repId}&start_date=${startDate}&end_date=${endDate}`;
          try {
            const r = await fetch(url);
            const jr = await r.json();
            const perf = (jr && jr.success) ? computePerfFromOrders(jr.data || []) : computePerfFromOrders([]);
            return { repId, repName: rep.name || `مندوب ${repId}`, ...perf };
          } catch (e) {
            console.error('Failed to fetch rep performance row', repId, e);
            return { repId, repName: rep.name || `مندوب ${repId}`, ...computePerfFromOrders([]) };
          }
        })
      );

      rows.sort((a, b) => (b.delivered - a.delivered) || (a.returnRate - b.returnRate));
      setPerfRows(rows);
      setPerfTop10(rows.slice(0, 10));
    } finally {
      setPerfLoading(false);
    }
  };

  const handleOpenModal = (rep: any = null) => {
    if (rep) {
      setEditingRep(rep);
      setFormData({ name: rep.name || '', phone: rep.phone || '', insurance_paid: !!rep.insurance_paid, insurance_amount: rep.insurance_amount ? String(rep.insurance_amount) : '' });
    } else {
      setEditingRep(null);
      setFormData({ name: '', phone: '', insurance_paid: false, insurance_amount: '' });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    (async () => {
      try {
        if (editingRep) {
          // لا يتم تعديل مبلغ التأمين (ولا حالة دفع التأمين) عند التعديل
          const res = await fetch(`${API_BASE_PATH}/api.php?module=users&action=update`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ name: formData.name, phone: formData.phone, role: 'representative', id: editingRep.id, insurance_paid: editingRep.insurance_paid ? 1 : 0, insurance_amount: Number(editingRep.insurance_amount || 0) }) });
          const raw = await res.text();
          let js: any = null;
          try { js = JSON.parse(raw); } catch (e) { console.error('Save rep raw response (update):', raw); Swal.fire('خطأ في الخادم', raw.substring(0, 1000), 'error'); return; }
          if (js.success) {
            await fetchReps();
            setIsModalOpen(false);
            Swal.fire('تم الحفظ', 'تم تحديث بيانات المندوب بنجاح.', 'success');
          } else Swal.fire('فشل الحفظ', js.message || 'فشل تحديث المندوب', 'error');
        } else {
          // Default permissions: only update order status
          const defaultPerms = JSON.stringify({ update_order_status: true });
          const payload: any = { name: formData.name, phone: formData.phone, role: 'representative', permissions: defaultPerms, insurance_paid: formData.insurance_paid ? 1 : 0, insurance_amount: formData.insurance_paid ? Number(formData.insurance_amount || 0) : 0 };
          const res = await fetch(`${API_BASE_PATH}/api.php?module=users&action=create`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(payload) });
          const raw = await res.text();
          let js: any = null;
          try { js = JSON.parse(raw); } catch (e) { console.error('Save rep raw response (create):', raw); Swal.fire('خطأ في الخادم', raw.substring(0, 1000), 'error'); return; }
          if (js.success) {
            // server may return created record in js.data or insert_id
            // إضافة معاملة مالية في خزينة تأمين المناديب إذا تم دفع التأمين
            if (formData.insurance_paid && Number(formData.insurance_amount) > 0) {
              await createInsuranceTransaction(js.data?.id || js.insert_id, Number(formData.insurance_amount));
            }
            await fetchReps();
            setIsModalOpen(false);
            Swal.fire('تم الحفظ', 'تم إضافة مندوب جديد.', 'success');
          } else Swal.fire('فشل الحفظ', js.message || 'فشل إضافة المندوب', 'error');
        }
      } catch (err) {
        console.error('Save rep error', err);
        Swal.fire('خطأ في الاتصال', 'فشل الاتصال بالخادم.', 'error');
      }
    })();
  };

  const handleDelete = (repId: number) => {
    const rep = representatives.find(r => r.id === repId);
    if (!rep) return;

    const repInsuranceAmount = Number(rep.insurance_amount ?? 0);
    const repInsurancePaid = !!rep.insurance_paid;
    if ((repInsurancePaid && repInsuranceAmount > 0) || repInsuranceAmount > 0) {
      Swal.fire({
        icon: 'error',
        title: 'عملية مرفوضة',
        text: `لا يمكن حذف المندوب "${rep.name}" لأن لديه تأمين بقيمة ${repInsuranceAmount.toLocaleString()} ${currencySymbol}. يجب تصفية/تسوية حسابه أولاً.`,
        confirmButtonText: 'موافق',
      });
      return;
    }

    const repBalance = Number(rep.balance ?? 0);
    if (!Number.isFinite(repBalance)) {
      Swal.fire({
        icon: 'error',
        title: 'عملية مرفوضة',
        text: `لا يمكن حذف المندوب "${rep.name}" لأن رصيده غير معروف.` ,
        confirmButtonText: 'موافق',
      });
      return;
    }
    if (Math.abs(repBalance) > 0.000001) {
      Swal.fire({
        icon: 'error',
        title: 'عملية مرفوضة',
        text: `لا يمكن حذف المندوب "${rep.name}" لأن حسابه غير صفري. الرصيد الحالي: ${repBalance.toLocaleString()} ${currencySymbol}. يجب تصفية/تسوية حسابه أولاً.`,
        confirmButtonText: 'موافق',
      });
      return;
    }

    Swal.fire({
      title: 'تأكيد الحذف',
      text: `هل أنت متأكد من حذف المندوب "${rep.name}"؟`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'نعم، احذفه',
      cancelButtonText: 'إلغاء'
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          const res = await fetch(`${API_BASE_PATH}/api.php?module=users&action=delete`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ id: repId }) });
          const js = await res.json();
          if (js.success) {
            setRepresentatives(prev => prev.filter(r => r.id !== repId));
            Swal.fire('تم الحذف!', `تم حذف المندوب "${rep.name}" بنجاح.`, 'success');
          } else Swal.fire('فشل الحذف', js.message || 'فشل حذف المندوب', 'error');
        } catch (err) { console.error('Delete rep error', err); Swal.fire('خطأ في الاتصال', 'فشل الاتصال بالخادم.', 'error'); }
      }
    });
  };

  const handleViewDetails = (repId: number) => {
    setSelectedRepId(repId);
    setView('transactions');
  };

  // Quick action helpers: open finance form for collect, fine, or settlement
  const openCollect = (rep: any) => {
    if (!rep) return;
    setSelectedRepId(Number(rep.id));
    setView('rep-cycle');
    setPaymentForm(prev => ({ ...prev, type: 'payment', direction: 'in', amount: '', note: '' }));
  };

  const openFine = (rep: any) => {
    if (!rep) return;
    setSelectedRepId(Number(rep.id));
    setView('rep-cycle');
    setPaymentForm(prev => ({ ...prev, type: 'fine', direction: 'out', amount: '', note: '' }));
  };

  const openSettle = (rep: any) => {
    if (!rep) return;
    setSelectedRepId(Number(rep.id));
    setView('rep-cycle');
    setPaymentForm(prev => ({ ...prev, type: 'settlement', amount: '', note: '' }));
  };

  const fetchRepTransactions = async () => {
    try {
      const r = await fetch(`${API_BASE_PATH}/api.php?module=transactions&action=getByRelated&related_to_type=rep&related_to_id=${selectedRepId}`);
      const jr = await r.json();
      if (jr.success) {
        const txs = (jr.data || []).map((t:any) => ({
          ...t,
          _label: getTxLabelEnhanced(t.type || t.tx_type || '', parseTxDetails(t.details || t.data || {}))
        }));
        setRepTransactions(txs);
      }
    } catch (e) { console.error('Failed to fetch rep transactions', e); }
  };

  const handleCreateTransaction = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!selectedRepId) return Swal.fire('اختر مندوب', 'يرجى اختيار مندوب أولاً.', 'warning');

    // Settlement is handled by a dedicated flow
    if (paymentForm.type === 'settlement') {
      await handleSettleRepAccount();
      return;
    }

    const amount = Number(paymentForm.amount || 0);
    if (!amount || isNaN(amount) || amount <= 0) return Swal.fire('قيمة غير صحيحة', 'أدخل مبلغًا صالحًا أكبر من صفر.', 'error');

    // Always require a statement/note
    if (!paymentForm.note || String(paymentForm.note).trim() === '') {
      return Swal.fire('حدد البيان', 'يرجى إدخال سبب/بيان المعاملة في الحقل المخصص.', 'warning');
    }

    // Treasury is required for cash collection/payment, but not for penalties (debt-only)
    if (paymentForm.type === 'payment' && !paymentForm.treasuryId) {
      return Swal.fire('اختر الخزينة', 'يرجى اختيار الخزينة المسؤولة عن المعاملة.', 'warning');
    }

    const isFine = paymentForm.type === 'fine';
    const direction: 'in'|'out' = isFine ? 'out' : paymentForm.direction;
    const txType = isFine
      ? 'rep_payment_out'
      : (direction === 'in' ? 'rep_payment_in' : 'rep_payment_out');

    const payload = {
      type: txType,
      related_to_type: 'rep',
      related_to_id: selectedRepId,
      amount: amount,
      treasuryId: isFine ? null : (paymentForm.treasuryId || null),
      direction,
      details: isFine
        ? { notes: paymentForm.note, subtype: 'rep_penalty' }
        : { notes: paymentForm.note }
    };

    try {
      const res = await fetch(`${API_BASE_PATH}/api.php?module=transactions&action=create`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(payload) });
      const js = await res.json();
      if (js.success) {
        Swal.fire('تم التسجيل', 'تم تسجيل المعاملة بنجاح.', 'success');
        // refresh transactions and rep balance
        await fetchRepTransactions();
        // clear form
        setPaymentForm({ amount: '', type: 'payment', direction: 'in', treasuryId: '', note: '' });
      } else {
        Swal.fire('فشل العملية', js.message || 'خطأ أثناء تسجيل المعاملة', 'error');
      }
    } catch (err) { console.error('Create tx error', err); Swal.fire('خطأ في الاتصال', 'فشل الاتصال بالخادم.', 'error'); }
  };

  const submitPartialReturn = async () => {
    if (!partialReturnOrder || !selectedRepId) return Swal.fire('خطأ', 'بيانات الطلب/المندوب غير محددة', 'error');
    const items = Object.entries(partialReturnInputs).map(([pid, q]) => ({ productId: Number(pid), returnedQuantity: Number(q) })).filter(it => it.returnedQuantity > 0);
    if (items.length === 0) return Swal.fire('اختر كمية', 'الرجاء إدخال كميات المرتجع أولاً', 'warning');

    try {
      const payload = { order_id: partialReturnOrder.id, rep_id: selectedRepId, items, warehouse_id: partialReturnWarehouse || null, notes: partialReturnNotes };
      const res = await fetch(`${API_BASE_PATH}/api.php?module=orders&action=partialReturn`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(payload) });
      const js = await res.json();
      if (js.success) {
        Swal.fire('تم', `تمت معالجة المرتجع الجزئي. المبلغ: ${Number(js.returnedValue||0).toLocaleString()} ${currencySymbol}`, 'success');
        setIsPartialReturnOpen(false);
        setPartialReturnOrder(null);
        await refreshAssignedAndTx();
      } else {
        Swal.fire('فشل', js.message || 'فشل معالجة المرتجع الجزئي', 'error');
      }
    } catch (err) { console.error('Partial return error', err); Swal.fire('خطأ في الاتصال', 'فشل الاتصال بالخادم.', 'error'); }
  };

  const handleSettleRepAccount = async () => {
    if (!selectedRepId) return Swal.fire('اختر مندوب', 'يرجى اختيار مندوب أولاً.', 'warning');

    const currentBalance = Number(repCashBalance || 0);
    if (isNaN(currentBalance)) {
      return Swal.fire('خطأ', 'تعذر قراءة رصيد المندوب الحالي.', 'error');
    }

    const rep = representatives.find(r => Number(r.id) === Number(selectedRepId));
    const insuranceAmount = rep && rep.insurance_paid ? Number(rep.insurance_amount || 0) : 0;

    // Settlement math (per requested rules):
    // Net cash movement is based on (rep balance + insurance).
    // - If net < 0: rep owes company => collect abs(net) into selected treasury.
    // - If net > 0: company owes rep => pay abs(net) from selected treasury.
    // Insurance itself is then cleared via an internal adjustment (no treasury), so the rep's account reaches zero.
    const netAfterInsurance = currentBalance + (insuranceAmount > 0 ? insuranceAmount : 0);

    if ((!insuranceAmount || insuranceAmount <= 0) && (!currentBalance || currentBalance === 0)) {
      return Swal.fire('لا توجد تسوية', 'رصيد المندوب وتأمينه صفر بالفعل.', 'info');
    }

    // Treasury is only needed if there will be a cash movement.
    if (netAfterInsurance !== 0 && !paymentForm.treasuryId) {
      return Swal.fire('اختر الخزينة', 'يرجى اختيار الخزينة المسؤولة عن التسوية.', 'warning');
    }

    const defaultNote = 'تسوية / تصفية حساب المندوب';
    const note = (paymentForm.note && String(paymentForm.note).trim() !== '') ? paymentForm.note : defaultNote;

    const balanceText = currentBalance === 0 ? '0' : `${Math.abs(currentBalance).toLocaleString()} ${currencySymbol} ${currentBalance > 0 ? 'له' : 'عليه'}`;
    const netText = netAfterInsurance === 0 ? '0' : `${Math.abs(netAfterInsurance).toLocaleString()} ${currencySymbol} ${netAfterInsurance > 0 ? 'له' : 'عليه'}`;
    const confirmText = `سيتم تنفيذ التسوية.\nالرصيد: ${balanceText}\nالتأمين: ${insuranceAmount.toLocaleString()} ${currencySymbol}\nالصافي بعد التأمين: ${netText}`;

    const r = await Swal.fire({
      title: 'تأكيد التسوية',
      text: confirmText,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'تنفيذ',
      cancelButtonText: 'إلغاء'
    });
    if (!r.isConfirmed) return;

    try {
      // We'll collect created transactions locally so UI can reflect them immediately
      const createdTxs: any[] = [];
      const bal = Number(repCashBalance || 0);
      const ins = (selectedRepData && selectedRepData.insurance_paid) ? Number(selectedRepData.insurance_amount || 0) : 0;

      // Helper to fetch transaction by returned id and push
      const pushCreatedTx = async (resp: any) => {
        if (!resp) return;
        const txId = resp.transaction_id || resp.transaction_id || resp.transaction_id;
        if (txId) {
          try {
            const txRes = await fetch(`${API_BASE_PATH}/api.php?module=transactions&action=getById&id=${txId}`);
            const txJs = await txRes.json();
            // Only merge rep-related transactions into the rep ledger UI.
            if (txJs.success && txJs.data && String(txJs.data.related_to_type || '') === 'rep' && String(txJs.data.related_to_id || '') === String(selectedRepId)) {
              createdTxs.push(txJs.data);
            }
          } catch (e) { console.error('Failed to fetch created tx', e); }
        }
      };

      const updateInsurance = async (newAmount: number) => {
        const next = Math.max(0, Number(newAmount || 0));
        const rUpd = await fetch(`${API_BASE_PATH}/api.php?module=users&action=update`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: selectedRepId, insurance_paid: next > 0 ? 1 : 0, insurance_amount: next })
        });
        const raw = await rUpd.text();
        let js: any = null;
        try { js = JSON.parse(raw); } catch (e) { js = { success: false, message: raw }; }
        if (!js.success) throw new Error(js.message || 'فشل تحديث بيانات التأمين');
        setRepresentatives(prev => prev.map(p => Number(p.id) === Number(selectedRepId) ? { ...p, insurance_paid: next > 0 ? 1 : 0, insurance_amount: next } : p));
      };

      const createTx = async (payload: any, failMsg: string) => {
        const res = await fetch(`${API_BASE_PATH}/api.php?module=transactions&action=create`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const raw = await res.text();
        let js: any = null;
        try { js = JSON.parse(raw); } catch (e) { js = { success: false, message: raw }; }
        if (!js.success) {
          throw new Error(js.message || failMsg);
        }
        await pushCreatedTx(js);
        return js;
      };

      // 1) Apply insurance against debt (accounting-only, no treasury), then settle remaining balance with cash,
      // 2) Return any remaining insurance to rep (cash, but NOT rep-related since insurance deposit isn't in rep ledger).
      const owe = bal < 0 ? Math.abs(bal) : 0;
      const appliedFromInsurance = owe > 0 ? Math.min(ins, owe) : 0;
      const remainingDebt = owe - appliedFromInsurance;
      const remainingInsurance = ins - appliedFromInsurance;

      // Apply insurance to rep debt if needed
      if (appliedFromInsurance > 0) {
        await createTx(
          {
            type: 'rep_payment_in',
            related_to_type: 'rep',
            related_to_id: selectedRepId,
            amount: appliedFromInsurance,
            treasuryId: null,
            direction: 'in',
            details: { notes: 'استخدام التأمين لتصفية جزء/كل الدين', subtype: 'rep_insurance_apply' }
          },
          'فشل تطبيق التأمين على الدين'
        );
      }

      // Settle rep balance with cash movements
      if (bal > 0) {
        // company owes rep: pay rep's balance from treasury (rep-related)
        if (!paymentForm.treasuryId) return Swal.fire('اختر الخزينة', 'يرجى اختيار الخزينة المسؤولة عن الدفع.', 'warning');
        await createTx(
          {
            type: 'rep_settlement',
            related_to_type: 'rep',
            related_to_id: selectedRepId,
            amount: Math.abs(bal),
            treasuryId: paymentForm.treasuryId || null,
            direction: 'out',
            details: { notes: note, subtype: 'rep_settlement', insurance_amount: ins }
          },
          'فشل تنفيذ الدفع للمندوب'
        );
      } else if (remainingDebt > 0) {
        // rep owes company: collect remaining debt into treasury (rep-related)
        if (!paymentForm.treasuryId) return Swal.fire('اختر الخزينة', 'يرجى اختيار الخزينة لتحصيل المبلغ المتبقي.', 'warning');
        await createTx(
          {
            type: 'rep_settlement',
            related_to_type: 'rep',
            related_to_id: selectedRepId,
            amount: remainingDebt,
            treasuryId: paymentForm.treasuryId || null,
            direction: 'in',
            details: { notes: 'تحصيل المتبقي بعد استخدام التأمين', subtype: 'rep_settlement', insurance_amount: ins }
          },
          'فشل تحصيل المبلغ المتبقي'
        );
      }

      // Return remaining insurance to rep (cash movement but not rep ledger)
      let insuranceAfterSettlement = remainingInsurance;
      if (remainingInsurance > 0) {
        if (!paymentForm.treasuryId) return Swal.fire('اختر الخزينة', 'يرجى اختيار الخزينة المسؤولة عن رد التأمين.', 'warning');
        await createTx(
          {
            type: 'payment_out',
            related_to_type: 'none',
            related_to_id: null,
            amount: remainingInsurance,
            treasuryId: paymentForm.treasuryId || null,
            direction: 'out',
            details: { notes: 'رد المتبقي من تأمين المندوب', subtype: 'rep_insurance_return', rep_id: Number(selectedRepId) }
          },
          'فشل رد المبلغ المتبقي من التأمين'
        );

        // After returning the remaining insurance, it should be cleared.
        insuranceAfterSettlement = 0;
      }

      // Update insurance fields to reflect what remains
      await updateInsurance(insuranceAfterSettlement);

      // Ensure UI reflects the new transactions immediately: prepend createdTxs and recompute balance
      if (createdTxs.length > 0) {
        setRepTransactions(prev => {
          const merged = [...createdTxs, ...prev];
          // recompute balance from merged txs
          const bal = merged.reduce((s:any, t:any) => s + Number(t.amount || 0), 0);
          setRepresentatives(prevReps => prevReps.map(p => Number(p.id) === Number(selectedRepId) ? { ...p, balance: bal } : p));
          return merged;
        });
      } else {
        // no created txs (unlikely) — still clear local txs and reset balance
        setRepTransactions([]);
        setRepresentatives(prev => prev.map(p => Number(p.id) === Number(selectedRepId) ? { ...p, balance: 0 } : p));
      }

      Swal.fire('تمت التسوية', 'تمت تصفية حساب المندوب بنجاح.', 'success');
      // Refresh transactions from server (may reflect new txs); UI already shows updated state until fetch completes
      await fetchRepTransactions();
      // Refresh reps list to get server-side computed balances (same technique used in FinanceModule)
      await fetchReps();
      setPaymentForm(prev => ({ ...prev, amount: '', note: '', type: 'payment' }));
    } catch (err) {
      console.error('Settle rep error', err);
      Swal.fire('خطأ في الاتصال', 'فشل الاتصال بالخادم.', 'error');
    }
  };

  const selectedRepData = representatives.find(r => r.id === selectedRepId);
  const selectedRepCustody = selectedRepId ? (repAssignedOrders || []).filter(o => Number(o.rep_id) === Number(selectedRepId)) : [];
  const [isPartialReturnOpen, setIsPartialReturnOpen] = useState(false);
  const [partialReturnOrder, setPartialReturnOrder] = useState<any>(null);
  const [partialReturnInputs, setPartialReturnInputs] = useState<{ [productId: string]: number }>({});
  const [partialReturnWarehouse, setPartialReturnWarehouse] = useState<number | ''>('');
  const [partialReturnNotes, setPartialReturnNotes] = useState<string>('');
  const repCashIn = repTransactions.reduce((s:any, t:any) => s + (Number(t.amount || 0) > 0 ? Number(t.amount || 0) : 0), 0);
  const repCashOut = repTransactions.reduce((s:any, t:any) => s + (Number(t.amount || 0) < 0 ? Math.abs(Number(t.amount || 0)) : 0), 0);
  const repCashBalance = repTransactions.reduce((s:any, t:any) => s + Number(t.amount || 0), 0);

  // In settlement mode, auto-fill the amount with the remaining balance after applying insurance.
  useEffect(() => {
    if (paymentForm.type !== 'settlement') return;
    if (!selectedRepId) {
      if (paymentForm.amount !== '') setPaymentForm(prev => ({ ...prev, amount: '' }));
      return;
    }
    const insuranceAmount = (selectedRepData && selectedRepData.insurance_paid) ? Number(selectedRepData.insurance_amount || 0) : 0;
    const bal = Number(repCashBalance || 0);
    const net = bal + (insuranceAmount > 0 ? insuranceAmount : 0);
    const nextAmount = String(Math.abs(net || 0));
    if (paymentForm.amount !== nextAmount) {
      setPaymentForm(prev => ({ ...prev, amount: nextAmount }));
    }
  }, [paymentForm.type, selectedRepId, repCashBalance, selectedRepData, paymentForm.amount]);

  useEffect(() => {
    if (!selectedRepId) return;
    const fetchAssigned = async () => {
      try {
        const r = await fetch(`${API_BASE_PATH}/api.php?module=orders&action=getByRep&rep_id=${selectedRepId}&status=with_rep`);
        const jr = await r.json();
        if (jr.success) {
          // filter orders assigned to this rep
          setRepAssignedOrders(jr.data || []);
        }
      } catch (e) { console.error('Failed to fetch rep assigned orders', e); }
    };
    fetchAssigned();
    fetchRepTransactions();
  }, [selectedRepId]);

  const refreshAssignedAndTx = async () => {
    if (!selectedRepId) return;
    try {
      const r = await fetch(`${API_BASE_PATH}/api.php?module=orders&action=getByRep&rep_id=${selectedRepId}&status=with_rep`);
      const jr = await r.json();
      if (jr.success) setRepAssignedOrders(jr.data || []);
    } catch (e) { console.error('Failed to refresh assigned orders', e); }
    await fetchRepTransactions();
  };

  useEffect(() => {
    if (view !== 'rep-performance') return;
    fetchPerformanceReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, perfMode, perfDate, perfMonth, perfYear, representatives.length]);

  // Daily reconciliation state
  const [cycleDate, setCycleDate] = useState<string>(todayISO);
  const [dailySummary, setDailySummary] = useState<any>(null);
  const [isSummaryLoading, setIsSummaryLoading] = useState(false);

  const fetchDailySummary = async (repId: number, dateIso: string) => {
    setIsSummaryLoading(true);
    try {
      const startDate = dateIso;
      const endDate = dateIso;

      // 1) orders for the day
      const oRes = await fetch(`${API_BASE_PATH}/api.php?module=orders&action=getByRep&rep_id=${repId}&start_date=${startDate}&end_date=${endDate}`);
      const oJs = await oRes.json();
      const todaysOrders = (oJs && oJs.success) ? (oJs.data || []) : [];

      // 2) all orders assigned to rep (to compute old orders before date)
      const allAssignedRes = await fetch(`${API_BASE_PATH}/api.php?module=orders&action=getByRep&rep_id=${repId}`);
      const allAssignedJs = await allAssignedRes.json();
      const allAssigned = (allAssignedJs && allAssignedJs.success) ? (allAssignedJs.data || []) : [];
      const oldOrders = allAssigned.filter((o:any) => new Date(o.created_at) < new Date(startDate + 'T00:00:00'));

      // 3) transactions for rep
      const tRes = await fetch(`${API_BASE_PATH}/api.php?module=transactions&action=getByRelated&related_to_type=rep&related_to_id=${repId}`);
      const tJs = await tRes.json();
      const allTx = (tJs && tJs.success) ? (tJs.data || []) : [];

      const dayStart = new Date(startDate + 'T00:00:00');
      const dayEnd = new Date(endDate + 'T23:59:59');

      const openingBalance = allTx.filter((tx:any)=> new Date(tx.transaction_date) < dayStart).reduce((s:any,tx:any)=>s+Number(tx.amount||0),0);
      const todaysTx = allTx.filter((tx:any)=> { const d=new Date(tx.transaction_date); return d>=dayStart && d<=dayEnd; });
      const accountToday = todaysTx.reduce((s:any,tx:any)=>s+Number(tx.amount||0),0);

      const delivered = todaysOrders.filter((o:any)=> (o.status||'') === 'delivered');
      const returned = todaysOrders.filter((o:any)=> (o.status||'') === 'returned');
      const postponed = todaysOrders.filter((o:any)=> (o.status||'') === 'postponed' || (o.status||'') === 'in_delivery');

      const sumOrderValue = (orders:any[]) => orders.reduce((s:any,o:any)=> s + Number(o.total || o.total_amount || 0),0);
      const sumOrderPieces = (orders:any[]) => orders.reduce((s:any,o:any)=> s + (Array.isArray(o.products)? o.products.reduce((ss:any,p:any)=> ss + Number(p.quantity||0),0) : 0),0);

      const partialDeliveryAmount = todaysTx.filter((tx:any)=>{
        const d = parseTxDetails(tx.details);
        return (d?.action === 'partial_delivered' || d?.subtype === 'partial_delivered' || (d?.notes||'').toString().toLowerCase().includes('partial_delivered'));
      }).reduce((s:any,tx:any)=>s + Math.abs(Number(tx.amount||0)),0);
      const partialReturnAmount = todaysTx.filter((tx:any)=>{
        const d = parseTxDetails(tx.details);
        return (d?.action === 'partial_returned' || d?.subtype === 'partial_return' || d?.subtype === 'partial_returned' || (d?.notes||'').toString().toLowerCase().includes('partial_return'));
      }).reduce((s:any,tx:any)=>s + Math.abs(Number(tx.amount||0)),0);

      const summary = {
        date: dateIso,
        openingBalance,
        oldOrdersCount: oldOrders.length,
        oldPieces: sumOrderPieces(oldOrders),
        todaysOrdersCount: delivered.length,
        todaysPieces: sumOrderPieces(delivered),
        totalDeliveredValue: sumOrderValue(delivered),
        prepaid: todaysTx.filter((tx:any)=> (tx.type||tx.tx_type||'').includes('rep_payment_in')).reduce((s:any,tx:any)=>s+Number(tx.amount||0),0),
        accountToday,
        deliveredCount: delivered.length,
        deliveredAmount: sumOrderValue(delivered),
        returnedCount: returned.length,
        returnedAmount: sumOrderValue(returned),
        partialDeliveryAmount: partialDeliveryAmount,
        partialReturnAmount: partialReturnAmount,
        remaining: null,
        postponedCount: postponed.length,
        postponedOrders: postponed,
      };

      // remaining: openingBalance + accountToday - deliveredAmount + returnedAmount
      summary.remaining = summary.openingBalance + summary.accountToday - summary.totalDeliveredValue + summary.returnedAmount;

      setDailySummary(summary);
    } catch (e) {
      console.error('Failed to fetch daily summary', e);
      setDailySummary(null);
    } finally {
      setIsSummaryLoading(false);
    }
  };

  const handleApplySummarySettlement = async () => {
    if (!selectedRepId) return Swal.fire('اختر مندوب', 'يرجى اختيار مندوب أولاً.', 'warning');
    if (!dailySummary) return Swal.fire('لا توجد بيانات', 'يرجى تحميل ملخص اليوم أولاً.', 'warning');

    const remaining = Number(dailySummary.remaining || 0);
    if (!remaining || remaining === 0) return Swal.fire('لا توجد تسوية', 'لا يوجد مبلغ متبقي للتسوية اليوم.', 'info');

    if (!paymentForm.treasuryId) return Swal.fire('اختر الخزينة', 'يرجى اختيار الخزينة لتنفيذ حركة الصندوق ضمن التسوية.', 'warning');

    const amount = Math.abs(remaining);
    const direction: 'in'|'out' = remaining < 0 ? 'in' : 'out';

    const r = await Swal.fire({
      title: 'تأكيد تسوية ملخص اليوم',
      html: `سيتم تنفيذ تسوية بناءً على ملخص اليوم بقيمة <b>${amount.toLocaleString()}</b> ${currencySymbol} (<b>${direction === 'in' ? 'تحصيل من المندوب' : 'دفع للمندوب'}</b>).`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'تنفيذ',
      cancelButtonText: 'إلغاء'
    });
    if (!r.isConfirmed) return;

    try {
      const payload = {
        type: 'rep_settlement',
        related_to_type: 'rep',
        related_to_id: selectedRepId,
        amount,
        treasuryId: paymentForm.treasuryId || null,
        direction,
        details: { notes: `تسوية يومية بتاريخ ${cycleDate}`, subtype: 'daily_summary_settlement' }
      };
      const res = await fetch(`${API_BASE_PATH}/api.php?module=transactions&action=create`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(payload) });
      const js = await res.json();
      if (js.success) {
        Swal.fire('تمت التسوية', 'تم تنفيذ تسوية ملخص اليوم بنجاح.', 'success');
        await fetchRepTransactions();
        setDailySummary(null);
      } else {
        Swal.fire('فشل العملية', js.message || 'فشل تنفيذ التسوية من الملخص', 'error');
      }
    } catch (err) {
      console.error('Apply summary settlement error', err);
      Swal.fire('خطأ في الاتصال', 'فشل الاتصال بالخادم.', 'error');
    }
  };

  const exportDailySummaryCSV = () => {
    if (!dailySummary) return Swal.fire('لا توجد بيانات', 'يرجى تحميل ملخص اليوم أولاً.', 'warning');
    try {
      const rows: any[] = [];
      rows.push(['الحقل', 'القيمة']);
      rows.push(['التاريخ', dailySummary.date || '']);
      rows.push(['رصيد الافتتاح', Number(dailySummary.openingBalance||0).toString()]);
      rows.push(['عدد الطلبيات القديمة', String(dailySummary.oldOrdersCount||0)]);
      rows.push(['قطع قديمة', String(dailySummary.oldPieces||0)]);
      rows.push(['استلام اليوم (عدد)', String(dailySummary.todaysOrdersCount||0)]);
      rows.push(['قيمة المسلّم اليوم', Number(dailySummary.totalDeliveredValue||0).toString()]);
      rows.push(['المبالغ المستلمة اليوم', Number(dailySummary.prepaid||0).toString()]);
      rows.push(['مجموع التسليم الجزئي (قيمة)', Number(dailySummary.partialDeliveryAmount||0).toString()]);
      rows.push(['مجموع المرتجع الجزئي (قيمة)', Number(dailySummary.partialReturnAmount||0).toString()]);
      rows.push(['المبلغ المرتجع اليوم', Number(dailySummary.returnedAmount||0).toString()]);
      rows.push(['المنقوص/المتبقي', Number(dailySummary.remaining||0).toString()]);
      rows.push(['الطلبيات المؤجلة (عدد)', String(dailySummary.postponedCount||0)]);

      if (Array.isArray(dailySummary.postponedOrders) && dailySummary.postponedOrders.length > 0) {
        rows.push([]);
        rows.push(['الطلبيات المؤجلة — تفاصيل']);
        rows.push(['رقم الطلب', 'العميل', 'قيمة', 'الحالة']);
        for (const o of dailySummary.postponedOrders) {
          rows.push([o.order_number || o.orderNumber || ('#' + (o.id||'')), o.customer_name || o.customerName || '', String(o.total || o.total_amount || 0), o.status || '']);
        }
      }

      const esc = (v: any) => '"' + String(v ?? '').replace(/"/g, '""') + '"';
      const csv = rows.map(r => Array.isArray(r) ? r.map(esc).join(',') : (r ? esc(r) : '')).join('\r\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const fname = `rep_${selectedRepId || 'unknown'}_daily_summary_${dailySummary.date || todayISO}.csv`;
      a.download = fname;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Export CSV error', e);
      Swal.fire('خطأ', 'فشل تصدير CSV.', 'error');
    }
  };

  return (
    <div className="space-y-6 transition-colors duration-300">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-black text-slate-900 dark:text-white">إدارة المناديب</h2>
          <p className="text-sm text-muted font-medium">متابعة أداء المناديب وعهدتهم ومعاملاتهم</p>
        </div>
        <div className="flex gap-1 p-1.5 rounded-2xl border border-card shadow-sm card" style={{ backgroundColor: 'var(--card-bg)', color: 'var(--text)' }}>
          <button onClick={() => handleOpenModal(null)} className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black bg-green-600 text-white hover:opacity-90"><PlusCircle size={16}/> إضافة مندوب</button>
          <button onClick={() => setView('list')} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all ${view === 'list' ? 'bg-accent text-white shadow-md' : 'text-muted hover:bg-slate-50 dark:hover:bg-slate-700'}`}><Users size={16}/> قائمة المناديب</button>
          <button onClick={() => setView('custody')} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all ${view === 'custody' ? 'bg-accent text-white shadow-md' : 'text-muted hover:bg-slate-50 dark:hover:bg-slate-700'}`}><Box size={16}/> عهدة المندوب</button>
          <button onClick={() => setView('rep-cycle')} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all ${view === 'rep-cycle' ? 'bg-accent text-white shadow-md' : 'text-muted hover:bg-slate-50 dark:hover:bg-slate-700'}`}><Wallet size={16}/> ماليات المندوب</button>
          <button onClick={() => setView('transactions')} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all ${view === 'transactions' ? 'bg-accent text-white shadow-md' : 'text-muted hover:bg-slate-50 dark:hover:bg-slate-700'}`}><FileText size={16}/> معاملات المندوب</button>
        </div>
      </div>

      {view === 'list' && (
        <div className="rounded-3xl shadow-sm border border-card overflow-hidden animate-in fade-in card" style={{ backgroundColor: 'var(--card-bg)', color: 'var(--text)' }}>
          <div className="p-4 border-b dark:border-slate-700 flex items-center justify-between gap-4 bg-slate-50/50 dark:bg-slate-900/30">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-muted w-4 h-4" />
              <input
                type="text"
                placeholder="بحث بالاسم أو رقم الهاتف..."
                className="w-full pr-10 pl-4 py-2.5 bg-white dark:bg-slate-900 border-none rounded-2xl text-sm focus:ring-2 ring-blue-500/20 text-slate-900 dark:text-white text-right"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <h3 className="font-bold text-slate-800 dark:text-white">قائمة المناديب المسجلين</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead className="bg-slate-50 dark:bg-slate-900/50 text-muted">
                  <tr>
                  <th className="px-6 py-4 font-bold">اسم المندوب</th>
                  <th className="px-6 py-4 font-bold">رقم الهاتف</th>
                  <th className="px-6 py-4 font-bold">مبلغ التأمين</th>
                  <th className="px-6 py-4 font-bold">الرصيد</th>
                  <th className="px-6 py-4 font-bold">الحالة</th>
                  <th className="px-6 py-4 font-bold text-center">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y dark:divide-slate-700 text-slate-700 dark:text-slate-300">
                {filteredReps.map((rep:any) => {
                  const repBal = Number(rep.balance ?? 0);
                  const repIns = Number(rep.insurance_amount ?? 0);
                  const hasInsurance = (!!rep.insurance_paid && repIns > 0) || repIns > 0;
                  const hasNonZeroBalance = Number.isFinite(repBal) && Math.abs(repBal) > 0.000001;
                  const canDelete = !hasInsurance && !hasNonZeroBalance;
                  const deleteReason = hasInsurance
                    ? `لا يمكن الحذف: لديه تأمين ${repIns.toLocaleString()} ${currencySymbol}`
                    : (hasNonZeroBalance ? `لا يمكن الحذف: الرصيد ${repBal.toLocaleString()} ${currencySymbol}` : 'حذف');

                  return (
                    <tr key={rep.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                      <td className="px-6 py-4 font-bold">{rep.name}</td>
                      <td className="px-6 py-4 text-xs">{rep.phone}</td>
                      <td className="px-6 py-4 text-sm font-black">{rep.insurance_amount ? Number(rep.insurance_amount).toLocaleString() : '—'} {currencySymbol}</td>
                      <td className="px-6 py-4 text-sm font-black">
                        {Math.abs(Number(rep.balance || 0)).toLocaleString()} {currencySymbol}{' '}
                        <span className="text-sm font-bold" style={{color: (rep.balance>0? 'green': (rep.balance<0? 'red':'#666'))}}>{rep.balance>0? 'له' : (rep.balance<0? 'عليه' : '')}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-3 py-1 rounded-lg text-[10px] font-black ${rep.status === 'نشط' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400'}`}>
                          {rep.status}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => handleDelete(rep.id)}
                            disabled={!canDelete}
                            className={`p-2 rounded-xl transition-all ${canDelete ? 'text-muted hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/30' : 'opacity-50 cursor-not-allowed text-muted'}`}
                            title={deleteReason}
                          >
                            <Trash2 size={16} />
                          </button>
                          <button onClick={() => openCollect(rep)} className="p-2 text-muted hover:text-green-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-xl transition-all" title="تحصيل"><PlusCircle size={16} /></button>
                          <button onClick={() => openFine(rep)} className="p-2 text-muted hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-xl transition-all" title="غرامة"><MinusCircle size={16} /></button>
                          <button onClick={() => openSettle(rep)} className="p-2 text-muted hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-xl transition-all" title="تسوية"><Wallet size={16} /></button>
                          <button onClick={() => handleOpenModal(rep)} className="p-2 text-muted hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/30 rounded-xl transition-all" title="تعديل"><Edit size={16} /></button>
                          <button onClick={() => handleViewDetails(rep.id)} className="p-2 text-muted hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-xl transition-all" title="عرض التفاصيل"><Eye size={16} /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {view === 'custody' && (
        <div className="p-8 rounded-3xl border border-card shadow-sm animate-in zoom-in duration-300 card" style={{ backgroundColor: 'var(--card-bg)', color: 'var(--text)' }}>
          <div className="flex items-center gap-4 mb-6">
            <div className="flex-1 max-w-sm">
              <label className="text-xs font-bold text-muted mr-2">اختر مندوب لعرض عهدته</label>
              <CustomSelect
                value={String(selectedRepId || '')}
                onChange={v => setSelectedRepId(v ? Number(v) : null)}
                options={[{ value: '', label: '-- اختر مندوب --' }, ...representatives.map((rep:any) => ({ value: String(rep.id), label: rep.name }))]}
                className="w-full mt-1"
              />
            </div>
          </div>

          {selectedRepId && selectedRepData ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-in fade-in">
              <div>
                <h4 className="font-bold mb-4">عهدة البضاعة</h4>
                <div className="bg-slate-50 dark:bg-slate-900/50 rounded-2xl p-4 border dark:border-slate-700">
                  {repAssignedOrders.length > 0 ? (
                    <div>

          {isPartialReturnOpen && partialReturnOrder && (
            <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
              <div className="w-full max-w-2xl rounded-[2rem] shadow-2xl overflow-hidden border border-card card" style={{ backgroundColor: 'var(--card-bg)', color: 'var(--text)' }}>
                <div className="p-5 border-b flex justify-between items-center bg-slate-50 dark:bg-slate-900/50">
                  <h3 className="font-black">مرتجع جزئي للطلب #{partialReturnOrder.orderNumber}</h3>
                  <button onClick={() => setIsPartialReturnOpen(false)} className="text-slate-400 hover:text-rose-500"><X size={20} /></button>
                </div>
                <div className="p-6 space-y-4">
                  <div className="grid grid-cols-1 gap-3">
                    <div className="text-sm text-slate-500">اختر المستودع لإعادة الكميات (اختياري)</div>
                    <CustomSelect
                      value={String(partialReturnWarehouse || '')}
                      onChange={v => setPartialReturnWarehouse(v ? Number(v) : '')}
                      options={[{ value: '', label: '-- لا توجد إعادة إلى مستودع --' }, ...warehouses.map((w:any) => ({ value: String(w.id), label: w.name }))]}
                      className="w-full"
                    />
                  </div>
                  <div className="border rounded-2xl overflow-auto max-h-72">
                    <table className="w-full text-right text-sm">
                      <thead className="bg-slate-50 dark:bg-slate-900/50 text-muted">
                        <tr><th className="p-3">الصنف</th><th className="p-3">الموجود</th><th className="p-3">سعر الوحدة</th><th className="p-3">كمية المرتجع</th></tr>
                      </thead>
                      <tbody className="divide-y dark:divide-slate-700">
                        {(partialReturnOrder.products||[]).map((p:any)=> (
                          <tr key={p.productId} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                            <td className="p-3">{p.name}</td>
                            <td className="p-3">{p.quantity}</td>
                            <td className="p-3">{Number(p.price||p.price_per_unit||0).toLocaleString()}</td>
                            <td className="p-3"><input type="number" min={0} max={p.quantity} value={partialReturnInputs[String(p.productId)]||0} onChange={e=> setPartialReturnInputs(prev=>({...prev,[String(p.productId)]: Math.max(0, Math.min(Number(e.target.value||0), Number(p.quantity||0))) }))} className="w-24 bg-slate-50 dark:bg-slate-900 border-none rounded-xl py-2 px-3 text-sm" /></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500">ملاحظات</label>
                    <input value={partialReturnNotes} onChange={e=>setPartialReturnNotes(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl py-3 px-4 text-sm mt-1" />
                  </div>
                  <div className="flex gap-2 justify-end">
                    <button onClick={()=>setIsPartialReturnOpen(false)} className="px-4 py-2 rounded-2xl border">إلغاء</button>
                    <button onClick={submitPartialReturn} className="px-4 py-2 rounded-2xl bg-blue-600 text-white font-black">تنفيذ المرتجع الجزئي</button>
                  </div>
                </div>
              </div>
            </div>
          )}
                      <p className="text-sm font-bold mb-2">الطلبيات المسندة لهذا المندوب:</p>
                      <ul className="space-y-2">
                        {repAssignedOrders.map((order:any) => (
                          <li key={order.id} className="flex justify-between items-center p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">
                            <div>
                              <div className="font-medium text-sm">#{order.orderNumber} - {order.customerName}</div>
                              <div className="text-xs text-muted">{order.phone1}</div>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="font-bold text-sm">{order.products?.reduce((s:any,p:any)=>s+(Number(p.quantity||0)),0)} قطعة</div>
                              <button onClick={() => { setPartialReturnOrder(order); setPartialReturnInputs(Object.fromEntries((order.products||[]).map((p:any)=>[p.productId, 0]))); setPartialReturnWarehouse(''); setPartialReturnNotes(''); setIsPartialReturnOpen(true); }} className="px-3 py-1 bg-amber-100 text-amber-800 rounded-lg text-xs font-bold hover:bg-amber-200">مرتجع جزئي</button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : (
                    <p className="text-center text-xs text-muted p-4">لا توجد بضاعة في عهدة هذا المندوب حالياً.</p>
                  )}
                </div>
              </div>
              <div>
                <h4 className="font-bold mb-4">العهدة النقدية</h4>
                <div className="bg-slate-50 dark:bg-slate-900/50 rounded-2xl p-4 border dark:border-slate-700">
                  {repTransactions.length > 0 ? (
                    <div className="space-y-3">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                        <div className="p-3 bg-white dark:bg-slate-800 rounded-xl border dark:border-slate-700">
                          <div className="text-muted">تحصيل من المندوب</div>
                          <div className="font-black text-emerald-600">{repCashIn.toLocaleString()} {currencySymbol}</div>
                        </div>
                        <div className="p-3 bg-white dark:bg-slate-800 rounded-xl border dark:border-slate-700">
                          <div className="text-muted">دفعات للمندوب</div>
                          <div className="font-black text-rose-600">{repCashOut.toLocaleString()} {currencySymbol}</div>
                        </div>
                        <div className="p-3 bg-white dark:bg-slate-800 rounded-xl border dark:border-slate-700">
                          <div className="text-muted">الرصيد الصافي</div>
                          <div className="font-black">{repCashBalance.toLocaleString()} {currencySymbol}</div>
                        </div>
                      </div>
                      <div className="border-t dark:border-slate-700 pt-3">
                        <div className="text-xs font-bold mb-2">آخر الحركات</div>
                        <div className="space-y-2">
                          {repTransactions.slice(0, 5).map((t:any) => {
                            const details = parseTxDetails(t.details);
                            const label = t._label || getTxLabelEnhanced(t.type || t.tx_type || '', details);
                            const note = details.note || details.notes || t.note || '-';
                            return (
                              <div key={t.id} className="flex justify-between text-xs">
                                <div>
                                  <div className="font-bold">{label}</div>
                                  <div className="text-muted">{note}</div>
                                </div>
                                <div className="font-black" style={{ color: Number(t.amount || 0) >= 0 ? 'green' : 'red' }}>
                                  {Number(t.amount || 0).toLocaleString()} {currencySymbol}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-muted">لا توجد حركات مالية لهذا المندوب.</p>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center p-10 text-muted">
              <Box size={48} className="mx-auto opacity-20 mb-4" />
              <p className="font-bold">يرجى اختيار مندوب لعرض تفاصيل عهدته الحالية.</p>
            </div>
          )}
        </div>
      )}

      {view === 'transactions' && (
        selectedRepData ? (
          <div className="p-8 rounded-3xl border border-card shadow-sm animate-in zoom-in duration-300 card" style={{ backgroundColor: 'var(--card-bg)', color: 'var(--text)' }}>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">سجل معاملات المندوب: {selectedRepData.name}</h3>
            <p className="text-sm text-muted mb-6">عرض مفصل لجميع المعاملات التي قام بها المندوب، بما في ذلك فواتير المبيعات، المتحصلات النقدية، والمرتجعات.</p>
            {repTransactions.length === 0 ? (
              <div className="p-10 border-2 border-dashed rounded-2xl text-center text-muted">لا توجد معاملات مسجلة لهذا المندوب.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-right text-sm">
                  <thead className="bg-slate-50 dark:bg-slate-900/50 text-muted">
                    <tr>
                      <th className="px-6 py-3 font-bold">التاريخ</th>
                      <th className="px-6 py-3 font-bold">النوع</th>
                      <th className="px-6 py-3 font-bold">المبلغ</th>
                      <th className="px-6 py-3 font-bold">الملاحظات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y dark:divide-slate-700 text-slate-700 dark:text-slate-300">
                    {repTransactions.map((t:any) => {
                      const details = parseTxDetails(t.details);
                      const label = t._label || getTxLabelEnhanced(t.type || t.tx_type || '', details);
                      const note = details.note || details.notes || t.note || '-';
                      const when = t.transaction_date || t.created_at || t.createdAt || t.date || t.ts || Date.now();
                      return (
                        <tr key={t.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                          <td className="px-6 py-4 text-xs">{new Date(when).toLocaleString()}</td>
                          <td className="px-6 py-4 text-sm font-medium">{label}</td>
                          <td className="px-6 py-4 text-sm font-black" style={{color: Number(t.amount||0) >= 0 ? 'green' : 'red'}}>{Number(t.amount||0).toLocaleString()} {currencySymbol}</td>
                          <td className="px-6 py-4 text-xs">{note}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : (
          <div className="p-12 rounded-3xl border text-center animate-in zoom-in duration-300 card" style={{ backgroundColor: 'var(--card-bg)', color: 'var(--text)' }}>
            <UserCheck className="w-16 h-16 mx-auto mb-4 opacity-20 text-blue-500" />
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">سجل معاملات المندوب</h3>
            <p className="text-sm max-w-md mx-auto">يرجى اختيار مندوب من <button onClick={() => setView('list')} className="text-blue-600 font-bold hover:underline">قائمة المناديب</button> لعرض سجل معاملاته.</p>
          </div>
        )
      )}

      {view === 'rep-performance' && (
        <div className="p-8 rounded-3xl border border-card shadow-sm animate-in zoom-in duration-300 card" style={{ backgroundColor: 'var(--card-bg)', color: 'var(--text)' }}>
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">أداء المناديب</h3>
            <button
              type="button"
              onClick={fetchPerformanceReport}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black bg-accent text-white hover:opacity-90"
              disabled={perfLoading}
            >
              <RefreshCcw size={16} /> تحديث
            </button>
          </div>
          <p className="text-sm text-muted mb-6">تقرير استلام/تسليم/مرتجع المناديب حسب الفترة، مع أفضل 10 مناديب.</p>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="space-y-1">
              <label className="text-xs font-bold text-muted mr-2">الفترة</label>
              <CustomSelect
                value={perfMode}
                onChange={v => setPerfMode(v as any)}
                options={[{ value: 'date', label: 'تاريخ محدد' }, { value: 'day', label: 'يوم' }, { value: 'week', label: 'أسبوع' }, { value: 'month', label: 'شهر' }, { value: 'year', label: 'سنة' }]}
                className="w-full"
              />
            </div>

            {(perfMode === 'date' || perfMode === 'day' || perfMode === 'week') && (
              <div className="space-y-1">
                <label className="text-xs font-bold text-muted mr-2">التاريخ</label>
                <input type="date" value={perfDate} onChange={(e) => setPerfDate(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl py-3 px-4 text-sm" />
              </div>
            )}

            {perfMode === 'month' && (
              <div className="space-y-1">
                <label className="text-xs font-bold text-muted mr-2">الشهر</label>
                <input type="month" value={perfMonth} onChange={(e) => setPerfMonth(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl py-3 px-4 text-sm" />
              </div>
            )}

            {perfMode === 'year' && (
              <div className="space-y-1">
                <label className="text-xs font-bold text-muted mr-2">السنة</label>
                <input type="number" value={perfYear} onChange={(e) => setPerfYear(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl py-3 px-4 text-sm" />
              </div>
            )}

            <div className="space-y-1">
              <label className="text-xs font-bold text-muted mr-2">المندوب</label>
              <CustomSelect
                value={String(perfRepId || 'all')}
                onChange={v => setPerfRepId(v)}
                options={[{ value: 'all', label: 'الكل' }, ...representatives.map((rep:any) => ({ value: String(rep.id), label: rep.name }))]}
                className="w-full"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2">
              <div className="overflow-x-auto bg-slate-50 dark:bg-slate-900/50 rounded-2xl p-4 border dark:border-slate-700">
                {perfLoading ? (
                  <div className="text-xs text-muted">جاري تحميل التقرير...</div>
                ) : (
                  <table className="w-full text-right text-sm">
                    <thead className="text-muted">
                      <tr>
                        <th className="py-2 font-bold">المندوب</th>
                        <th className="py-2 font-bold">استلام</th>
                        <th className="py-2 font-bold">تسليم</th>
                        <th className="py-2 font-bold">مرتجع</th>
                        <th className="py-2 font-bold">في العهدة</th>
                        <th className="py-2 font-bold">نسبة المرتجع</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y dark:divide-slate-700">
                      {(perfRepId === 'all' ? perfRows : perfRows.filter(r => String(r.repId) === String(perfRepId))).map((row: any) => (
                        <tr key={row.repId} className="hover:bg-white/60 dark:hover:bg-slate-800/40 transition-colors">
                          <td className="py-2 font-bold">{row.repName}</td>
                          <td className="py-2">{row.total}</td>
                          <td className="py-2">{row.delivered} <span className="text-[10px] text-muted">({row.deliveredPct}%)</span></td>
                          <td className="py-2">{row.returned} <span className="text-[10px] text-muted">({row.returnedPct}%)</span></td>
                          <td className="py-2">{row.withRep} <span className="text-[10px] text-muted">({row.withRepPct}%)</span></td>
                          <td className="py-2 font-black">{row.returnRate}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            <div className="md:col-span-1">
              <div className="bg-slate-50 dark:bg-slate-900/50 rounded-2xl p-4 border dark:border-slate-700">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-black">أفضل 10 مناديب</h4>
                  <span className="text-[10px] text-muted">حسب عدد التسليم</span>
                </div>
                {perfTop10.length === 0 ? (
                  <div className="text-xs text-muted">لا توجد بيانات.</div>
                ) : (
                  <div className="space-y-2">
                    {perfTop10.map((r: any, idx: number) => (
                      <div key={r.repId} className="flex justify-between items-center text-xs p-2 bg-white dark:bg-slate-800 rounded-xl border dark:border-slate-700">
                        <div>
                          <div className="font-bold">#{idx + 1} {r.repName}</div>
                          <div className="text-muted">نسبة المرتجع: {r.returnRate}%</div>
                        </div>
                        <div className="font-black text-emerald-600">{r.delivered} تسليم</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {view === 'rep-cycle' && (
        <div className="p-8 rounded-3xl border border-card shadow-sm animate-in zoom-in duration-300 card" style={{ backgroundColor: 'var(--card-bg)', color: 'var(--text)' }}>
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">ماليات المندوب</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-1 space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-muted mr-2">اختيار المندوب</label>
                <CustomSelect
                  value={String(selectedRepId || '')}
                  onChange={v => setSelectedRepId(v ? Number(v) : null)}
                  options={[{ value: '', label: '-- اختر مندوب --' }, ...representatives.map((rep:any) => ({ value: String(rep.id), label: rep.name }))]}
                  className="w-full mt-1"
                />
              </div>
              <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-2xl border dark:border-slate-700 space-y-3">
                <div className="flex justify-between items-center text-xs"><span className="text-muted">الرصيد الحالي:</span><span className="font-bold text-rose-500">{selectedRepData ? Math.abs(Number(selectedRepData.balance||0)).toLocaleString() + ' ' + currencySymbol + ' ' + (selectedRepData.balance>0? 'له' : selectedRepData.balance<0? 'عليه' : '') : '—'}</span></div>
                <div className="flex justify-between items-center text-xs"><span className="text-muted">قيمة الطلبيات في العهدة:</span><span className="font-bold">{selectedRepCustody.reduce((s:any,o:any)=> s + (Number(o.total||0) || 0),0).toLocaleString()} {currencySymbol}</span></div>
              </div>
              <form onSubmit={handleCreateTransaction} className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-2xl border dark:border-slate-700 space-y-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-muted mr-2">نوع المعاملة</label>
                  <CustomSelect
                    value={paymentForm.type}
                    onChange={v => setPaymentForm(prev => ({ ...prev, type: v as any }))}
                    options={[{ value: 'payment', label: 'تحصيل' }, { value: 'fine', label: 'غرامة' }, { value: 'settlement', label: 'تسوية' }]}
                    className="w-full"
                  />
                </div>
                {paymentForm.type === 'payment' && (
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-muted mr-2">اتجاه الخزينة</label>
                    <CustomSelect
                      value={paymentForm.direction}
                      onChange={v => setPaymentForm(prev => ({ ...prev, direction: v as any }))}
                      options={[{ value: 'in', label: 'تحصيل من المندوب (إلى الخزينة)' }, { value: 'out', label: 'دفع إلى المندوب (من الخزينة)' }]}
                      className="w-full"
                    />
                  </div>
                )}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-muted mr-2">{paymentForm.type === 'fine' ? 'مبلغ الغرامة' : (paymentForm.type === 'settlement' ? 'مبلغ التسوية' : 'المبلغ')}</label>
                  <input readOnly={paymentForm.type === 'settlement'} value={paymentForm.amount} onChange={(e) => setPaymentForm(prev => ({ ...prev, amount: e.target.value }))} type="number" placeholder={paymentForm.type === 'fine' ? 'مبلغ الغرامة' : (paymentForm.type === 'settlement' ? 'مبلغ التسوية' : 'المبلغ')} className="w-full border-none rounded-lg py-2 px-3 text-sm card" style={{ backgroundColor: 'var(--card-bg)', color: 'var(--text)' }} />
                </div>

                {paymentForm.type === 'settlement' && (
                  <div className="p-3 rounded-xl border dark:border-slate-700 bg-white/60 dark:bg-slate-800/30 space-y-2 text-xs">
                    <div className="flex justify-between"><span className="text-muted">إجمالي رصيد المندوب</span><span className="font-black">{selectedRepData ? `${Math.abs(Number(repCashBalance||0)).toLocaleString()} ${currencySymbol} ${Number(repCashBalance||0) > 0 ? 'له' : (Number(repCashBalance||0) < 0 ? 'عليه' : '')}` : '—'}</span></div>
                    <div className="flex justify-between"><span className="text-muted">مبلغ التأمين</span><span className="font-black">{selectedRepData && selectedRepData.insurance_paid ? `${Number(selectedRepData.insurance_amount||0).toLocaleString()} ${currencySymbol}` : `0 ${currencySymbol}`}</span></div>
                    {selectedRepData ? (
                      Number(repCashBalance || 0) > 0 ? (
                        (() => {
                          const bal = Number(repCashBalance || 0);
                          const ins = (selectedRepData && selectedRepData.insurance_paid) ? Number(selectedRepData.insurance_amount || 0) : 0;
                          const total = bal + ins;
                          return (
                            <>
                              <div className="flex justify-between"><span className="text-muted">المستحق بعد اضافه التأمين</span><span className="font-black">{`${Math.abs(total).toLocaleString()} ${currencySymbol} ${total > 0 ? 'له' : total < 0 ? 'عليه' : ''}`}</span></div>
                              <div className="flex justify-between text-xs text-muted"><span>تفصيل:</span><span className="font-black">{`${ins.toLocaleString()} ${currencySymbol} (تأمين) + ${Math.abs(bal).toLocaleString()} ${currencySymbol} (مستحق للمندوب)`}</span></div>
                            </>
                          );
                        })()
                      ) : (
                        (() => {
                          const bal = Number(repCashBalance || 0);
                          const ins = (selectedRepData && selectedRepData.insurance_paid) ? Number(selectedRepData.insurance_amount || 0) : 0;
                          const remaining = ins + bal;
                          return (
                            <>
                              <div className="flex justify-between"><span className="text-muted">المتبقي بعد خصم التأمين</span><span className="font-black">{`${Math.abs(remaining).toLocaleString()} ${currencySymbol} ${remaining > 0 ? 'له' : remaining < 0 ? 'عليه' : ''}`}</span></div>
                              <div className="flex justify-between text-xs text-muted"><span>تفصيل:</span><span className="font-black">{`${ins.toLocaleString()} ${currencySymbol} (تأمين) - ${Math.abs(bal).toLocaleString()} ${currencySymbol} (مستحق على المندوب)`}</span></div>
                            </>
                          );
                        })()
                      )
                    ) : null}
                  </div>
                )}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-muted mr-2">الخزينة</label>
                  <CustomSelect
                    disabled={userDefaults && userDefaults.default_treasury_id && !userDefaults.can_change_treasury}
                    value={paymentForm.treasuryId}
                    onChange={v => setPaymentForm(prev => ({ ...prev, treasuryId: v }))}
                    options={[{ value: '', label: '-- اختر خزينة --' }, ...treasuries.map((t:any) => ({ value: String(t.id), label: t.name || t.title || `خزينة ${t.id}` }))]}
                    className="w-full"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-muted mr-2">خانة ملاحظات</label>
                  <input value={paymentForm.note} onChange={(e) => setPaymentForm(prev => ({ ...prev, note: e.target.value }))} type="text" placeholder="ملاحظة أو سبب العملية" className="w-full border-none rounded-lg py-2 px-3 text-sm card" style={{ backgroundColor: 'var(--card-bg)', color: 'var(--text)' }} />
                </div>
                {paymentForm.type !== 'settlement' ? (
                  <button type="submit" className="w-full bg-accent text-white py-3 rounded-2xl font-black shadow-xl shadow-blue-500/30 hover:bg-blue-700 transition-all">{paymentForm.type === 'fine' ? 'تسجيل الغرامة' : 'تسجيل التحصيل'}</button>
                ) : (
                  <button type="button" onClick={handleSettleRepAccount} className="w-full bg-accent text-white py-3 rounded-2xl font-black shadow-xl shadow-blue-500/30 hover:bg-blue-700 transition-all">تنفيذ التسوية</button>
                )}
              </form>
              {/* Daily summary and pending-orders boxes removed per request */}
          </div>
        </div>
      

      {/* Edit Rep Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden border border-card card" style={{ backgroundColor: 'var(--card-bg)', color: 'var(--text)' }}>
            <div className="p-6 border-b dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50">
              <h3 className="text-lg font-black text-slate-900 dark:text-white">{editingRep ? 'تعديل بيانات المندوب' : 'إضافة مندوب جديد'}</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-muted hover:text-rose-500 transition-colors"><X size={24} /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-8 space-y-6 text-right">
              <div className="space-y-1">
                <label className="text-xs font-bold text-muted mr-2">الاسم بالكامل</label>
                <input type="text" required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl py-3 px-4 text-sm" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-muted mr-2">رقم الهاتف</label>
                <input type="text" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl py-3 px-4 text-sm" />
              </div>
              <div className="space-y-1 flex items-center">
                <input id="insurance_paid" type="checkbox" disabled={!!editingRep} checked={formData.insurance_paid} onChange={e => setFormData({...formData, insurance_paid: e.target.checked})} className="mr-2" />
                <label htmlFor="insurance_paid" className="text-xs font-bold text-muted">دفع تأمين</label>
              </div>
              {formData.insurance_paid && (
                <div className="space-y-1">
                  <label className="text-xs font-bold text-muted mr-2">مبلغ التأمين المدفوع</label>
                  <input type="number" min="0" disabled={!!editingRep} required={!editingRep} value={formData.insurance_amount} onChange={e => setFormData({...formData, insurance_amount: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl py-3 px-4 text-sm" />
                </div>
              )}
              <button type="submit" className="w-full bg-accent text-white py-4 rounded-2xl font-black shadow-xl shadow-blue-500/30 hover:bg-blue-700 transition-all flex items-center justify-center gap-2">
                <Save size={18} /> {editingRep ? 'حفظ التعديلات' : 'إضافة مندوب'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
      )}
    </div>
  );
};

// إضافة دالة لإنشاء معاملة مالية في خزينة تأمين المناديب (خارج JSX)
async function createInsuranceTransaction(repId: number, amount: number): Promise<boolean> {
  try {
    // جلب كل الخزائن للبحث عن خزينة "تأمين المناديب"
    const res = await fetch(`${API_BASE_PATH}/api.php?module=treasuries&action=getAll`);
    const raw = await res.text();
    let js: any = null;
    try { js = JSON.parse(raw); } catch (e) {
      console.error('treasuries getAll raw response:', raw);
      await Swal.fire('خطأ في الخادم', raw.substring(0, 1000), 'error');
      return false;
    }

    if (!js?.success || !Array.isArray(js.data)) {
      await Swal.fire('فشل تحميل الخزائن', js?.message || 'تعذر جلب قائمة الخزائن.', 'error');
      return false;
    }

    const treasury = js.data.find((t: any) => (t?.name || t?.title) === 'تأمين المناديب');
    if (!treasury?.id) {
      await Swal.fire('خزينة التأمين غير موجودة', 'لم يتم العثور على خزينة "تأمين المناديب" لإتمام العملية.', 'error');
      return false;
    }

    // إنشاء معاملة مالية (إيداع التأمين)
    const txRes = await fetch(`${API_BASE_PATH}/api.php?module=transactions&action=create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'payment_in',
        related_to_type: 'none',
        related_to_id: null,
        amount,
        treasuryId: treasury.id,
        direction: 'in',
        details: {
          notes: `تأمين مندوب جديد (مندوب رقم ${repId})`,
          subtype: 'rep_insurance_deposit',
          rep_id: repId
        }
      })
    });
    const txRaw = await txRes.text();
    let txJs: any = null;
    try { txJs = JSON.parse(txRaw); } catch (e) {
      console.error('insurance tx raw response:', txRaw);
      await Swal.fire('خطأ في الخادم', txRaw.substring(0, 1000), 'error');
      return false;
    }
    if (!txJs?.success) {
      await Swal.fire('فشل إيداع التأمين', txJs?.message || 'لم يتم إنشاء معاملة التأمين.', 'error');
      return false;
    }
    return true;
  } catch (e) {
    console.error('insurance transaction error', e);
    await Swal.fire('خطأ في الاتصال', 'فشل الاتصال بالخادم أثناء إيداع التأمين.', 'error');
    return false;
  }
}

export default RepresentativesModule;