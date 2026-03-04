// آخر تحديث: 2026-02-11 (إصدار 1.0.4)
import React, { useState, useEffect } from 'react';
import { Users, Box, FileText, Search, UserCheck, RefreshCcw, Edit, Trash2, Eye, X, Save, PlusCircle, MinusCircle, Play, Square, Wallet, ShoppingCart } from 'lucide-react';
import Swal from 'sweetalert2';

import { API_BASE_PATH } from '../services/apiConfig';
import CustomSelect from './CustomSelect';
import { PrintableOrders } from './PrintableOrderCard';

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

  // ─── يوميات المندوب ───
  const [journalFrom, setJournalFrom] = useState<string>(todayISO);
  const [journalTo, setJournalTo] = useState<string>(todayISO);
  const [repJournalLoading, setRepJournalLoading] = useState(false);
  const [repJournalRows, setRepJournalRows] = useState<any[]>([]);
  const [expandedJournalIds, setExpandedJournalIds] = useState<Set<number>>(new Set());
  const toggleJournalExpand = (id: number) => setExpandedJournalIds(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const [waybillPrintOrders, setWaybillPrintOrders] = useState<any[] | null>(null);
  // Live stats per journal row (computed on-demand)
  const [journalLiveStats, setJournalLiveStats] = useState<Record<number, any>>({});
  useEffect(() => {
    if (!waybillPrintOrders) return;
    const t = setTimeout(() => {
      window.print();
      setTimeout(() => setWaybillPrintOrders(null), 1200);
    }, 500);
    return () => clearTimeout(t);
  }, [waybillPrintOrders]);

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

  // ─── يوميات المندوب: تحميل و طباعة ───

  const loadRepJournal = async (repId: number, from: string, to: string) => {
    setRepJournalLoading(true);
    setRepJournalRows([]);
    try {
      const res = await fetch(`${API_BASE_PATH}/api.php?module=sales&action=getRepDailyJournal&rep_id=${repId}&from=${from}&to=${to}`);
      const js = await res.json();
      if (js.success) {
        setRepJournalRows(js.data || []);
      } else {
        Swal.fire('تنبيه', js.message || 'لا توجد يوميات أو الجدول غير موجود', 'info');
        setRepJournalRows([]);
      }
    } catch (e) {
      console.error('loadRepJournal error', e);
      setRepJournalRows([]);
    } finally {
      setRepJournalLoading(false);
    }
  };

  const _parseJournalOrders = (row: any): Array<{id: number; order_number: string; source: string}> => {
    try {
      const raw = row.orders_json;
      if (!raw) return [];
      const arr = Array.isArray(raw) ? raw : JSON.parse(raw);
      return Array.isArray(arr) ? arr : [];
    } catch (_) { return []; }
  };

  const _fetchOrdersByIds = async (ids: number[]): Promise<any[]> => {
    if (!ids.length) return [];
    // Use module=sales to avoid orders-module permission restrictions
    const res = await fetch(`${API_BASE_PATH}/api.php?module=sales&action=getOrdersByIds&ids=${ids.join(',')}`);
    const js = await res.json();
    return js.success ? (js.data || []) : [];
  };

  const computeJournalLiveStats = async (row: any) => {
    try {
      setJournalLiveStats(prev => ({ ...prev, [row.id]: { loading: true } }));
      const jOrders = _parseJournalOrders(row);
      if (!jOrders || jOrders.length === 0) {
        setJournalLiveStats(prev => ({ ...prev, [row.id]: { loading: false, deliveredCount: 0, deliveredTotal: 0, returnedCount: 0, postponedCount: 0, postponedTotal: 0, oldOrdersCount: 0, todayOrdersCount: 0 } }));
        return;
      }
      const ids = jOrders.map((o:any) => o.id).filter(Boolean);
      const full = await _fetchOrdersByIds(ids);

      let delivered = 0, deliveredVal = 0, returned = 0, postponed = 0, postponedVal = 0;
      full.forEach((o:any) => {
        const status = o.status || o.order_status || '';
        const total = Number(o.total || o.total_amount || 0) || 0;
        if (status === 'delivered') { delivered++; deliveredVal += total; }
        else if (status === 'returned') { returned++; }
        else { postponed++; postponedVal += total; }
      });

      setJournalLiveStats(prev => ({
        ...prev,
        [row.id]: {
          loading: false,
          deliveredCount: delivered,
          deliveredTotal: deliveredVal,
          returnedCount: returned,
          postponedCount: postponed,
          postponedTotal: postponedVal,
          oldOrdersCount: jOrders.filter((o:any) => o.source === 'old').length,
          todayOrdersCount: jOrders.filter((o:any) => o.source === 'today').length
        }
      }));
    } catch (e) {
      console.error('computeJournalLiveStats failed', e);
      setJournalLiveStats(prev => ({ ...prev, [row.id]: { loading: false } }));
    }
  };

  const _toN = (v: any) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
  const _orderSub = (o: any) => {
    if (Array.isArray(o.products) && o.products.length > 0) {
      return o.products.reduce((s: number, p: any) => {
        const qty = _toN(p.quantity ?? p.qty ?? 0);
        let line = _toN(p.total ?? p.line_total ?? p.total_price ?? 0);
        if (!line) line = _toN(p.price ?? p.price_per_unit ?? 0) * qty;
        return s + line;
      }, 0);
    }
    return _toN(o.total ?? o.total_amount ?? 0);
  };
  const _orderPieces = (o: any) =>
    (o.products || []).reduce((s: number, p: any) => s + _toN(p.quantity ?? p.qty ?? 0), 0);
  const _balLabel = (v: number) => (v > 0 ? 'له' : v < 0 ? 'عليه' : '');

  const printDailyJournalRow = async (row: any) => {
    const repName = representatives.find((r: any) => r.id === selectedRepId)?.name || '';
    const dateStr = row.journal_date || new Date().toLocaleDateString();
    const journalOrders = _parseJournalOrders(row);
    const allIds = journalOrders.map(x => x.id).filter(Boolean);

    let fullOrders: any[] = [];
    if (allIds.length > 0) {
      try { fullOrders = await _fetchOrdersByIds(allIds); } catch (_) {}
    }
    const byId: Record<number, any> = {};
    fullOrders.forEach(o => { byId[o.id] = o; });

    const oldIds   = new Set(journalOrders.filter(x => x.source === 'old').map(x => x.id));
    const todayIds = new Set(journalOrders.filter(x => x.source === 'today').map(x => x.id));
    const oldOrders   = journalOrders.filter(x => x.source === 'old').map(x => byId[x.id] || {id: x.id, orderNumber: x.order_number, order_number: x.order_number, products: []});
    const todayOrders = journalOrders.filter(x => x.source === 'today').map(x => byId[x.id] || {id: x.id, orderNumber: x.order_number, order_number: x.order_number, products: []});
    const allOrdersFull = journalOrders.map(x => byId[x.id] || {id: x.id, orderNumber: x.order_number, order_number: x.order_number, products: []});

    const prevBal         = _toN(row.prev_balance ?? 0);
    const oldOrdersValue  = _toN(row.old_orders_value ?? 0);
    const oldOrdersCount  = _toN(row.opening_orders_count ?? 0);
    const oldPiecesCount  = _toN(row.opening_pieces_count ?? 0);
    const sumValue        = _toN(row.assigned_value ?? 0);
    const todayPieces     = _toN(row.pieces_assigned_count ?? 0);
    const totalOrdersCount = _toN(row.total_orders_count ?? 0);
    const totalPieces     = _toN(row.total_pieces_count ?? 0);
    const totalValue      = _toN(row.total_orders_value ?? 0);
    const finalBeforePay  = _toN(row.final_before_payment ?? 0);
    const paymentAmt      = _toN(row.payment_amount ?? 0);
    const paymentAction   = row.payment_action || 'collect';
    const afterPay        = _toN(row.balance_after_payment ?? 0);
    const paidNow         = paymentAction === 'collect' ? paymentAmt : -paymentAmt;
    const localTotalShipping = allOrdersFull.reduce((s: number, o: any) => s + _toN(o.shipping ?? o.shipping_fees ?? 0), 0);

    // Products summary (old + today combined)
    const summaryMap: Record<string, {name:string; color:string; size:string; qty:number}> = {};
    allOrdersFull.forEach((o: any) => {
      (o.products || []).forEach((p: any) => {
        const key = `${p.name||''}||${p.color||''}||${p.size||''}`;
        if (!summaryMap[key]) summaryMap[key] = {name: p.name||'', color: p.color||'', size: p.size||'', qty: 0};
        summaryMap[key].qty += _toN(p.quantity ?? p.qty ?? 0);
      });
    });
    const prodRows = Object.values(summaryMap);

    const orderRow = (o: any) => {
      const sub = _orderSub(o);
      const ship = _toN(o.shipping ?? o.shipping_fees ?? 0);
      const empVal = o.employee ?? o.employee_name ?? o.assigneeName ?? row.employee ?? '';
      const pgVal  = o.page ?? o.page_raw ?? o.page_name ?? o.pageName ?? o.source ?? row.page ?? '';
      return `<tr>
        <td>${o.orderNumber ?? o.order_number ?? o.id ?? ''}</td>
        <td>${o.customerName ?? o.customer_name ?? ''}</td>
        <td>${o.phone ?? o.phone1 ?? ''}</td>
        <td>${o.governorate ?? ''}</td>
        <td>${o.address ?? ''}</td>
        <td>${empVal}</td>
        <td>${pgVal}</td>
        <td>${sub.toLocaleString()}</td>
        <td>${ship.toLocaleString()}</td>
        <td>${(sub + ship).toLocaleString()}</td>
        <td>${o.notes ?? ''}</td>
      </tr>`;
    };

    const colHeaders = `<tr><th>رقم اوردر</th><th>اسم العميل</th><th>الهاتف</th><th>المحافظة</th><th>العنوان</th><th>الموظف</th><th>البيدج</th><th>الإجمالي</th><th>شحن</th><th>الإجمالي الكلي</th><th>ملاحظات</th></tr>`;

    const pageVal = row.page || row.page_number || row.page_no || row.pageName || row.page_name || row.source || '';

    const html = `<!doctype html><html><head><meta charset="utf-8"><title>يومية المندوب</title>
<style>
body{font-family:Arial,Helvetica,'Noto Naskh Arabic',sans-serif;direction:rtl;padding:12px;font-size:12px;}
h1{font-size:18px;text-align:center;margin:0 0 6px 0}
.header{display:flex;justify-content:space-between;align-items:center;}
table{width:100%;border-collapse:collapse;margin-top:8px;}
th,td{border:1px solid #333;padding:5px;font-size:11px;text-align:right}
th{background:#eee;}
h3{font-size:13px;margin:14px 0 4px;}
</style></head><body>
<div class="header"><div></div><div style="text-align:center;"><h1>يومية المندوب "${repName}"</h1></div><div></div></div>
<div style="display:flex;gap:12px;align-items:flex-start;margin-top:8px;font-size:12px">
  <div style="flex:0 0 auto;min-width:140px;padding:6px">التاريخ: <b>${dateStr}</b>${row.employee ? `<br>الموظف: <b>${row.employee}</b>` : ''}${pageVal ? `<br>البيدج: <b>${pageVal}</b>` : ''}</div>
  <div style="flex:1;display:flex;gap:8px;flex-wrap:wrap">
    <div style="flex:1;min-width:150px;padding:6px;border:1px solid #ddd;border-radius:6px">
      <div style="font-weight:700;">الأرصدة القديمة</div>
      <div>قيمة اوردرات قديمة: <b>${oldOrdersValue.toLocaleString()} ج.م</b></div>
      <div>المستحق: <b>${_balLabel(prevBal)} ${Math.abs(prevBal).toLocaleString()} ج.م</b></div>
      <div>الاوردرات: <b>${oldOrdersCount}</b> • قطع: <b>${oldPiecesCount}</b></div>
    </div>
    <div style="flex:1;min-width:150px;padding:6px;border:1px solid #ddd;border-radius:6px">
      <div style="font-weight:700;">تسليم اليوم</div>
      <div>قيمة اوردرات اليوم: <b>${sumValue.toLocaleString()} ج.م</b></div>
      <div>عدد اوردرات: <b>${todayOrders.length}</b> • قطع: <b>${todayPieces}</b></div>
    </div>
    <div style="flex:1;min-width:150px;padding:6px;border:1px solid #ddd;border-radius:6px;background:#f0fdf4">
      <div style="font-weight:700;">المبلغ المدفوع</div>
      <div>النوع: <b>${paymentAction === 'collect' ? 'تحصيل' : 'دفع'}</b></div>
      <div>المبلغ: <b>${paymentAmt.toLocaleString()} ج.م</b></div>
    </div>
    <div style="flex:0 0 160px;padding:6px;border:1px solid #ddd;border-radius:6px;background:#fff5f6">
      <div style="font-weight:700;">الباقي بعد الدفع</div>
      <div style="font-weight:800;font-size:14px">${Math.abs(afterPay).toLocaleString()} ${_balLabel(afterPay)} ج.م</div>
    </div>
  </div>
</div>
${todayOrders.length > 0 ? `<h3>اوردرات اليوم (${todayOrders.length})</h3>
<table><thead>${colHeaders}</thead><tbody>${todayOrders.map(orderRow).join('')}</tbody></table>` : ''}
${oldOrders.length > 0 ? `<h3>اوردرات نزول / قديمة (${oldOrders.length})</h3>
<table><thead>${colHeaders}</thead><tbody>${oldOrders.map(orderRow).join('')}</tbody></table>` : ''}
${prodRows.length > 0 ? `<h3>البضاعة المستلمة — جميع المنتجات (قديم + اليوم)</h3>
<table><thead><tr><th>المنتج</th><th>اللون</th><th>المقاس</th><th>الكمية</th></tr></thead>
<tbody>${prodRows.map(r => `<tr><td>${r.name}</td><td>${r.color}</td><td>${r.size}</td><td>${r.qty}</td></tr>`).join('')}</tbody></table>` : ''}
</body></html>`;

    const w = window.open('', '_blank', 'toolbar=0,location=0,menubar=0,scrollbars=1,width=960,height=720');
    if (!w) { Swal.fire('تنبيه', 'يرجى السماح بفتح النوافذ المنبثقة', 'warning'); return; }
    w.document.write(html); w.document.close(); w.focus(); setTimeout(() => w.print(), 500);
  };

  const printDeliveryPermit = async (row: any) => {
    const repName = representatives.find((r: any) => r.id === selectedRepId)?.name || '';
    const dateStr = row.journal_date || new Date().toLocaleDateString();
    const journalOrders = _parseJournalOrders(row);
    const allIds = journalOrders.map(x => x.id).filter(Boolean);

    let fullOrders: any[] = [];
    if (allIds.length > 0) {
      try { fullOrders = await _fetchOrdersByIds(allIds); } catch (_) {}
    }
    const byId: Record<number, any> = {};
    fullOrders.forEach(o => { byId[o.id] = o; });
    const allOrdersFull = journalOrders.map(x => byId[x.id] || {id: x.id, orderNumber: x.order_number, order_number: x.order_number, products: []});

    // Build products summary map (same as SalesDaily printThermal)
    const summaryMap: Record<string, {name:string; color:string; size:string; qty:number}> = {};
    allOrdersFull.forEach((o: any) => {
      (o.products || []).forEach((p: any) => {
        const key = `${p.name||''}||${p.color||''}||${p.size||''}`;
        if (!summaryMap[key]) summaryMap[key] = {name: p.name||'', color: p.color||'', size: p.size||'', qty: 0};
        summaryMap[key].qty += _toN(p.quantity ?? p.qty ?? 0);
      });
    });
    const rows = Object.values(summaryMap);
    const totalProducts = rows.length;
    const totalPieces = rows.reduce((s, r) => s + r.qty, 0);

    const html = `<!doctype html><html><head><meta charset="utf-8"><title>أذن تسليم</title>
<style>body{font-family:Arial,Helvetica,'Noto Naskh Arabic',sans-serif;direction:rtl;width:340px;padding:6px;} h2{text-align:center;} table{width:100%;border-collapse:collapse;} th,td{font-size:12px;padding:4px;border-bottom:1px solid #ddd;} th{font-weight:700;text-align:right;} .totals{margin-top:8px;font-weight:700;} .sign{margin-top:30px;display:flex;justify-content:space-around;} .sign-box{text-align:center;min-width:120px;border-top:1px solid #333;padding-top:8px;font-size:12px;}</style>
</head><body>
<h2>أذن تسليم</h2>
<div>التاريخ: ${dateStr}</div>
<div>استلام بضاعة للمندوب "${repName}"</div>
<br/>
<table><thead><tr><th>المنتج</th><th>اللون</th><th>المقاس</th><th>الكمية</th></tr></thead><tbody>
${rows.map(r => `<tr><td>${r.name}</td><td>${r.color}</td><td>${r.size}</td><td style="text-align:left">${r.qty}</td></tr>`).join('')}
</tbody></table>
<div class="totals">اجمالى المنتجات: ${totalProducts}</div>
<div class="totals">اجمالى القطع: ${totalPieces}</div>
<div class="sign"><div class="sign-box">توقيع المستلم (المندوب)</div><div class="sign-box">توقيع المسؤول</div></div>
</body></html>`;

    const w = window.open('', '_blank', 'toolbar=0,location=0,menubar=0,scrollbars=1,width=420,height=700');
    if (!w) { Swal.fire('تنبيه', 'يرجى السماح بفتح النوافذ المنبثقة', 'warning'); return; }
    w.document.write(html); w.document.close(); w.focus(); setTimeout(() => w.print(), 500);
  };

  const printWaybills = async (row: any) => {
    const journalOrders = _parseJournalOrders(row);
    const allIds = journalOrders.map(x => x.id).filter(Boolean);
    if (allIds.length === 0) {
      Swal.fire('تنبيه', 'لا توجد أوردرات مسجلة لهذه اليومية', 'warning');
      return;
    }
    let fullOrders: any[] = [];
    try { fullOrders = await _fetchOrdersByIds(allIds); } catch (_) {}
    if (fullOrders.length === 0) {
      Swal.fire('تنبيه', 'تعذر تحميل بيانات الأوردرات', 'warning');
      return;
    }
    // Normalise field names so PrintableContent gets what it expects
    const normalised = fullOrders.map(o => ({
      ...o,
      orderNumber: o.orderNumber ?? o.order_number ?? String(o.id ?? ''),
      customerName: o.customerName ?? o.customer_name ?? '',
      phone:  o.phone  ?? o.phone1 ?? '',
      phone1: o.phone1 ?? o.phone  ?? '',
      phone2: o.phone2 ?? '',
    }));
    setWaybillPrintOrders(normalised);
  };

  const fetchRepTransactions = async () => {
    try {
      const r = await fetch(`${API_BASE_PATH}/api.php?module=transactions&action=getByRelated&related_to_type=rep&related_to_id=${selectedRepId}`);
      const jr = await r.json();
      if (jr.success) {
        const txs = (jr.data || []).map((t:any) => ({
          ...t,
          _label: (t.title && String(t.title).trim()) ? t.title : ((t.memo && String(t.memo).trim()) ? t.memo : getTxLabelEnhanced(t.type || t.tx_type || '', parseTxDetails(t.details || t.data || {})))
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
    // include human-friendly title and memo so transaction lists can show descriptive names
    payload['title'] = getTxLabelEnhanced(payload.type, payload.details);
    payload['memo'] = paymentForm.note || '';

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
        // Refresh the rep journal rows so the daily journal reflects the partial return
        try {
          if (selectedRepId) await loadRepJournal(selectedRepId, journalFrom, journalTo);
        } catch (e) { console.error('Failed to refresh rep journal after partial return', e); }
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
        // Ensure title/memo present for server record
        try {
          if (!payload.title && payload.type) payload.title = getTxLabelEnhanced(payload.type, payload.details || {});
          if (!payload.memo && payload.details && (payload.details.notes || payload.details.note)) payload.memo = payload.details.notes || payload.details.note || '';
        } catch (e) {}

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
      rows.push(['عدد الاوردرات القديمة', String(dailySummary.oldOrdersCount||0)]);
      rows.push(['قطع قديمة', String(dailySummary.oldPieces||0)]);
      rows.push(['استلام اليوم (عدد)', String(dailySummary.todaysOrdersCount||0)]);
      rows.push(['قيمة المسلّم اليوم', Number(dailySummary.totalDeliveredValue||0).toString()]);
      rows.push(['المبالغ المستلمة اليوم', Number(dailySummary.prepaid||0).toString()]);
      rows.push(['مجموع التسليم الجزئي (قيمة)', Number(dailySummary.partialDeliveryAmount||0).toString()]);
      rows.push(['مجموع المرتجع الجزئي (قيمة)', Number(dailySummary.partialReturnAmount||0).toString()]);
      rows.push(['المبلغ المرتجع اليوم', Number(dailySummary.returnedAmount||0).toString()]);
      rows.push(['المنقوص/المتبقي', Number(dailySummary.remaining||0).toString()]);
      rows.push(['الاوردرات المؤجلة (عدد)', String(dailySummary.postponedCount||0)]);

      if (Array.isArray(dailySummary.postponedOrders) && dailySummary.postponedOrders.length > 0) {
        rows.push([]);
        rows.push(['الاوردرات المؤجلة — تفاصيل']);
        rows.push(['رقم الاوردر', 'العميل', 'قيمة', 'الحالة']);
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
          <button onClick={() => setView('rep-cycle')} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all ${view === 'rep-cycle' ? 'bg-accent text-white shadow-md' : 'text-muted hover:bg-slate-50 dark:hover:bg-slate-700'}`}><Wallet size={16}/> يوميات المندوب</button>
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
                      <p className="text-sm font-bold mb-2">الاوردرات المسندة لهذا المندوب:</p>
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
        <div className="animate-in zoom-in duration-300 space-y-4">

          {/* ─── فلاتر البحث ─── */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-700 p-5 shadow-sm">
            <h3 className="text-base font-black text-slate-800 dark:text-white mb-4 flex items-center gap-2">
              <FileText className="w-4 h-4 text-blue-500" /> يوميات المندوب
            </h3>
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex-1 min-w-[200px]">
                <label className="text-xs font-bold text-slate-500 block mb-1">المندوب</label>
                <CustomSelect
                  value={String(selectedRepId || '')}
                  onChange={v => { setSelectedRepId(v ? Number(v) : null); setRepJournalRows([]); }}
                  options={[{ value: '', label: '-- اختر مندوب --' }, ...representatives.map((r:any) => ({ value: String(r.id), label: r.name }))]}
                  className="w-full"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 block mb-1">من</label>
                <input
                  type="date" value={journalFrom}
                  onChange={e => setJournalFrom(e.target.value)}
                  className="border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 rounded-xl px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 block mb-1">إلى</label>
                <input
                  type="date" value={journalTo}
                  onChange={e => setJournalTo(e.target.value)}
                  className="border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 rounded-xl px-3 py-2 text-sm"
                />
              </div>
              <button
                type="button"
                disabled={!selectedRepId || repJournalLoading}
                onClick={() => { if (selectedRepId) loadRepJournal(selectedRepId, journalFrom, journalTo); }}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-sm font-black transition-colors"
              >
                {repJournalLoading
                  ? <RefreshCcw className="w-4 h-4 animate-spin" />
                  : <Eye className="w-4 h-4" />}
                عرض اليوميات
              </button>
              <button type="button" className="px-3 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-xl text-xs font-bold text-slate-600 hover:bg-blue-50 transition-colors"
                onClick={() => { const d = new Date(); const f = (x:Date)=>x.toISOString().slice(0,10); setJournalFrom(f(d)); setJournalTo(f(d)); }}>اليوم</button>
              <button type="button" className="px-3 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-xl text-xs font-bold text-slate-600 hover:bg-blue-50 transition-colors"
                onClick={() => { const f=(x:Date)=>x.toISOString().slice(0,10); const to=new Date(); const from=new Date(); from.setDate(to.getDate()-7); setJournalFrom(f(from)); setJournalTo(f(to)); }}>آخر أسبوع</button>
              <button type="button" className="px-3 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-xl text-xs font-bold text-slate-600 hover:bg-blue-50 transition-colors"
                onClick={() => { const d=new Date(); const from=new Date(d.getFullYear(),d.getMonth(),1); const f=(x:Date)=>x.toISOString().slice(0,10); setJournalFrom(f(from)); setJournalTo(f(d)); }}>هذا الشهر</button>
            </div>
          </div>

          {/* ─── حالة التحميل ─── */}
          {repJournalLoading && (
            <div className="flex items-center justify-center py-16 text-slate-400 gap-3">
              <RefreshCcw className="w-5 h-5 animate-spin" />
              <span className="text-sm font-bold">جاري تحميل اليوميات...</span>
            </div>
          )}

          {/* ─── اختر مندوب ─── */}
          {!repJournalLoading && !selectedRepId && (
            <div className="text-center py-16 text-slate-400">
              <Users className="w-14 h-14 mx-auto mb-3 opacity-20" />
              <p className="text-sm font-bold">اختر مندوباً لعرض يومياته</p>
            </div>
          )}

          {/* ─── لا توجد نتائج ─── */}
          {!repJournalLoading && selectedRepId !== null && repJournalRows.length === 0 && (
            <div className="text-center py-16 text-slate-400">
              <FileText className="w-14 h-14 mx-auto mb-3 opacity-20" />
              <p className="text-sm font-bold">لا توجد يوميات في النطاق المحدد</p>
              <p className="text-xs mt-1 opacity-60">اضغط "عرض اليوميات" بعد تحديد المندوب والتاريخ</p>
            </div>
          )}

          {/* ─── قائمة اليوميات ─── */}
          {!repJournalLoading && repJournalRows.length > 0 && (
            <div className="space-y-3">
              {repJournalRows.map((row: any) => (
                <div key={row.id} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex flex-wrap items-center gap-4">

                    {/* معلومات اليومية */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-3 flex-wrap">
                        <div className="w-2.5 h-2.5 rounded-full bg-blue-500 flex-shrink-0" />
                        <span className="font-black text-slate-800 dark:text-white">{row.journal_date}</span>
                        {row.employee && (
                          <span className="text-xs text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-lg">👤 {row.employee}</span>
                        )}
                        {(row.page || row.page_number || row.page_no || row.pageName || row.page_name || row.source) && (
                          <span className="text-xs text-blue-600 bg-blue-50 dark:bg-blue-900/20 px-2 py-0.5 rounded-lg font-bold">بيدج: {row.page || row.page_number || row.page_no || row.pageName || row.page_name || row.source}</span>
                        )}
                        {row.session_seq && Number(row.session_seq) > 1 && (
                          <span className="text-xs text-amber-600 bg-amber-50 dark:bg-amber-900/20 px-2 py-0.5 rounded-lg font-bold">جلسة {row.session_seq}</span>
                        )}
                        {row.notes && (
                          <span className="text-xs text-slate-500 italic truncate max-w-[200px]">{row.notes}</span>
                        )}
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        <div className="text-center bg-slate-50 dark:bg-slate-800 rounded-xl p-2">
                          <div className="text-[10px] text-slate-500 font-bold mb-0.5">الأوردرات</div>
                          <div className="text-sm font-black text-slate-700 dark:text-slate-200">{row.total_orders_count || _parseJournalOrders(row).length || 0}</div>
                        </div>
                        <div className="text-center bg-slate-50 dark:bg-slate-800 rounded-xl p-2">
                          <div className="text-[10px] text-slate-500 font-bold mb-0.5">القطع</div>
                          <div className="text-sm font-black text-slate-700 dark:text-slate-200">{row.total_pieces_count || 0}</div>
                        </div>
                        <div className="text-center bg-emerald-50 dark:bg-emerald-900/20 rounded-xl p-2">
                          <div className="text-[10px] text-emerald-600 font-bold mb-0.5">قيمة اليومية</div>
                          <div className="text-sm font-black text-emerald-700 dark:text-emerald-400">{Number(row.total_orders_value||0).toLocaleString()} {currencySymbol}</div>
                        </div>
                        <div className="text-center bg-blue-50 dark:bg-blue-900/20 rounded-xl p-2">
                          <div className="text-[10px] text-blue-600 font-bold mb-0.5">الرصيد بعد دفع</div>
                          <div className="text-sm font-black text-blue-700 dark:text-blue-400">{Number(row.balance_after_payment||0).toLocaleString()} {currencySymbol}</div>
                        </div>
                      </div>

                      {/* ─── تفاصيل إضافية لليومية (مطابقة طلب المستخدم) ─── */}
                      <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2">
                        <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-3 text-sm">
                          <div className="text-xs text-slate-500 font-bold mb-1">بداية اليومية</div>
                          <div>الموظف: <b>{row.employee || row.opened_by || row.started_by || '—'}</b></div>
                          <div>تاريخ/وقت البدء: <b>{row.opened_at || row.start_time || row.opening_time || row.created_at || row.journal_date || '—'}</b></div>
                          <div>المخزن: <b>{row.opening_warehouse_name || row.start_warehouse || row.warehouse_name || '—'}</b></div>
                          <div>الخزينة: <b>{row.opening_treasury_name || row.start_treasury || row.treasury_name || '—'}</b></div>
                          <div>تم دفع مبلغ بالبداية: <b>{Number(row.opening_payment_amount || row.payment_amount || row.initial_payment || 0).toLocaleString()} {currencySymbol}</b></div>
                        </div>

                        <div className="bg-white dark:bg-slate-900 rounded-xl p-3 text-sm border dark:border-slate-700">
                          <div className="text-xs text-slate-500 font-bold mb-1">حالة الحساب</div>
                          <div>الحساب القديم: <b>{Number(row.prev_balance || row.opening_balance || 0).toLocaleString()} {currencySymbol}</b></div>
                          <div>الحساب بعد مبلغ البداية: <b>{Number(row.balance_after_opening || row.balance_after_payment || 0).toLocaleString()} {currencySymbol}</b></div>
                          <div>الحساب النهائى (بعد الإغلاق): <b>{Number(row.final_balance || row.closing_balance || row.balance_after_close || row.balance_after_payment || 0).toLocaleString()} {currencySymbol}</b></div>
                          <div>نوع التسويه: <b>{row.settlement_type || row.payment_action || row.settlement_subtype || '—'}</b></div>
                          <div>جهة التسوية: <b>{(row.payment_action === 'collect' || row.settlement_direction === 'in') ? 'تحصيل من المندوب' : (row.payment_action === 'pay' || row.settlement_direction === 'out' ? 'دفع إلى المندوب' : '—')}</b></div>
                        </div>
                      </div>

                      <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
                        <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-2 text-center">
                          <div className="text-[10px] text-slate-500 font-bold">أوردرات قديمة</div>
                          <div className="text-sm font-black">{_parseJournalOrders(row).filter((o:any)=>o.source==='old').length || (row.opening_orders_count || 0)}</div>
                        </div>
                        <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-2 text-center">
                          <div className="text-[10px] text-slate-500 font-bold">قطع قديمة</div>
                          <div className="text-sm font-black">{(row.opening_pieces_count || 0)}</div>
                        </div>
                        <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-xl p-2 text-center">
                          <div className="text-[10px] text-emerald-600 font-bold">تسليم - أوردرات</div>
                          <div className="text-sm font-black">{row.delivered_orders_count ?? row.deliveredCount ?? journalLiveStats[row.id]?.deliveredCount ?? 0}</div>
                        </div>
                        <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-xl p-2 text-center">
                          <div className="text-[10px] text-emerald-600 font-bold">تسليم - قطع</div>
                          <div className="text-sm font-black">{row.delivered_pieces_count ?? row.deliveredPieces ?? 0}</div>
                        </div>
                      </div>

                      <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
                        <div className="bg-rose-50 dark:bg-rose-900/20 rounded-xl p-2 text-center">
                          <div className="text-[10px] text-rose-600 font-bold">مرتجع - أوردرات</div>
                          <div className="text-sm font-black">{row.returned_orders_count ?? row.returnedCount ?? 0}</div>
                        </div>
                        <div className="bg-rose-50 dark:bg-rose-900/20 rounded-xl p-2 text-center">
                          <div className="text-[10px] text-rose-600 font-bold">مرتجع - قطع</div>
                          <div className="text-sm font-black">{row.returned_pieces_count ?? row.returnedPieces ?? 0}</div>
                        </div>
                        <div className="bg-rose-50 dark:bg-rose-900/20 rounded-xl p-2 text-center">
                          <div className="text-[10px] text-rose-600 font-bold">مرتجع - مبلغ</div>
                          <div className="text-sm font-black">{Number(row.returned_value ?? row.returnedValue ?? 0).toLocaleString()} {currencySymbol}</div>
                        </div>
                        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-2 text-center">
                          <div className="text-[10px] text-blue-600 font-bold">نزول (أوردرات)</div>
                          <div className="text-sm font-black">{row.deferred_orders_count ?? row.deferredCount ?? 0}</div>
                        </div>
                      </div>

                      <div className="mt-2 flex items-center gap-2">
                        <button type="button" onClick={async()=>{
                          const amt = await Swal.fire({ title: 'مبلغ الحافز', input: 'number', inputAttributes: { min: '0' }, showCancelButton:true });
                          if (!amt.value) return; const noteRes = await Swal.fire({ title:'البيان', input:'text', showCancelButton:true });
                          if (noteRes.isDismissed) return; const payload = { type: 'rep_payment_in', related_to_type: 'rep', related_to_id: row.rep_id || selectedRepId, amount: Number(amt.value||0), treasuryId: paymentForm.treasuryId || null, direction: 'in', details: { notes: noteRes.value || 'حافز مندوب', subtype: 'rep_bonus', journal_date: row.journal_date } };
                          try { await fetch(`${API_BASE_PATH}/api.php?module=transactions&action=create`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) }); Swal.fire('تم','تم إضافة الحافز','success'); } catch(e){ Swal.fire('فشل','تعذر إضافة الحافز','error'); }
                        }} className="px-3 py-2 bg-emerald-600 text-white rounded-xl text-xs font-black">إضافة حافز</button>

                        <button type="button" onClick={async()=>{
                          const amt = await Swal.fire({ title: 'مبلغ الغرامة', input: 'number', inputAttributes: { min: '0' }, showCancelButton:true });
                          if (!amt.value) return; const noteRes = await Swal.fire({ title:'البيان', input:'text', showCancelButton:true });
                          if (noteRes.isDismissed) return; const payload = { type: 'rep_payment_out', related_to_type: 'rep', related_to_id: row.rep_id || selectedRepId, amount: Number(amt.value||0), treasuryId: paymentForm.treasuryId || null, direction: 'out', details: { notes: noteRes.value || 'غرامة مندوب', subtype: 'rep_penalty', journal_date: row.journal_date } };
                          try { await fetch(`${API_BASE_PATH}/api.php?module=transactions&action=create`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) }); Swal.fire('تم','تم تطبيق الغرامة','success'); } catch(e){ Swal.fire('فشل','تعذر تطبيق الغرامة','error'); }
                        }} className="px-3 py-2 bg-rose-600 text-white rounded-xl text-xs font-black">تطبيق غرامة</button>

                        <div className="text-xs text-muted">الخزنـة الآن: <b>{row.closing_treasury_name || row.closed_treasury || '' || '—'}</b></div>
                      </div>

                      {/* ─── قائمة الطلبيات المطوية ─── */}
                      {(() => {
                        const jOrders = _parseJournalOrders(row);
                        if (jOrders.length === 0) return null;
                        const isExp = expandedJournalIds.has(row.id);
                        const oldList   = jOrders.filter(x => x.source === 'old');
                        const todayList = jOrders.filter(x => x.source === 'today');
                        return (
                          <div className="mt-2">
                            <button
                              type="button"
                              onClick={() => toggleJournalExpand(row.id)}
                              className="flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-800 transition-colors"
                            >
                              <span className={`inline-block transition-transform ${isExp ? 'rotate-90' : ''}`}>▶</span>
                              {isExp ? 'إخفاء الطلبيات' : `عرض الطلبيات (${jOrders.length})`}
                            </button>
                            {isExp && (
                              <div className="mt-2 space-y-2">
                                {todayList.length > 0 && (
                                  <div>
                                    <div className="text-[10px] font-bold text-emerald-600 mb-1">طلبيات اليوم ({todayList.length})</div>
                                    <div className="flex flex-wrap gap-1.5">
                                      {todayList.map(o => (
                                        <span key={o.id} className="bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 text-[11px] font-bold px-2 py-0.5 rounded-lg border border-emerald-200 dark:border-emerald-700">
                                          #{o.order_number || o.id}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                )}
                                {oldList.length > 0 && (
                                  <div>
                                    <div className="text-[10px] font-bold text-slate-500 mb-1">طلبيات قديمة / نزول ({oldList.length})</div>
                                    <div className="flex flex-wrap gap-1.5">
                                      {oldList.map(o => (
                                        <span key={o.id} className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[11px] font-bold px-2 py-0.5 rounded-lg border border-slate-200 dark:border-slate-600">
                                          #{o.order_number || o.id}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </div>

                    {/* أزرار الطباعة */}
                    <div className="flex flex-col gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => printDailyJournalRow(row)}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black transition-colors whitespace-nowrap"
                      >
                        <Eye className="w-3.5 h-3.5" /> عرض و طباعة يومية المندوب
                      </button>
                      <button
                        type="button"
                        onClick={() => printDeliveryPermit(row)}
                        className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black transition-colors whitespace-nowrap"
                      >
                        <FileText className="w-3.5 h-3.5" /> عرض و طباعة إذن التسليم
                      </button>
                      <button
                        type="button"
                        onClick={() => printWaybills(row)}
                        className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-black transition-colors whitespace-nowrap"
                      >
                        <Box className="w-3.5 h-3.5" /> عرض و طباعة بوالص التسليم
                      </button>
                    </div>

                    {/* Live stats button & display */}
                    <div className="flex flex-col gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => computeJournalLiveStats(row)}
                        className="flex items-center gap-2 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-black transition-colors whitespace-nowrap"
                      >
                        حساب مباشر
                      </button>
                      {journalLiveStats[row.id] && (
                        <div className="text-xs p-2 bg-white rounded-lg border">
                          {journalLiveStats[row.id].loading ? (
                            <div>جاري الحساب…</div>
                          ) : (
                            <div className="space-y-1">
                              <div>تم التسليم: <b>{journalLiveStats[row.id].deliveredCount || 0}</b> — <span className="text-emerald-600">{(journalLiveStats[row.id].deliveredTotal||0).toLocaleString()} ج.م</span></div>
                              <div>مرتجع كلي: <b>{journalLiveStats[row.id].returnedCount || 0}</b></div>
                              <div>أوردرات النزول: <b>{journalLiveStats[row.id].postponedCount || 0}</b> — <span className="text-amber-600">{(journalLiveStats[row.id].postponedTotal||0).toLocaleString()} ج.م</span></div>
                              <div className="text-muted">({journalLiveStats[row.id].todayOrdersCount || 0} جديد + {journalLiveStats[row.id].oldOrdersCount || 0} قديم)</div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                  </div>
                </div>
              ))}
            </div>
          )}

        </div>
      )}

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
      {/* Waybill print layer — same component as SalesModule order printing */}
      {waybillPrintOrders && (
        <PrintableOrders
          orders={waybillPrintOrders}
          companyName={localStorage.getItem('Dragon_company_name') || ''}
          companyPhone={localStorage.getItem('Dragon_company_phone') || ''}
          terms={localStorage.getItem('Dragon_company_terms') || ''}
        />
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