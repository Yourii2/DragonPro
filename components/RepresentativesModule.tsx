import React, { useState, useEffect } from 'react';
import { Users, Box, FileText, Search, UserCheck, RefreshCcw, Edit, Trash2, Eye, X, Save, PlusCircle, MinusCircle, Play, Square, Wallet, ShoppingCart } from 'lucide-react';
import Swal from 'sweetalert2';

import { API_BASE_PATH } from '../services/apiConfig';

// representatives will be fetched into state

interface RepresentativesModuleProps {
  initialView?: string;
}

const RepresentativesModule: React.FC<RepresentativesModuleProps> = ({ initialView }) => {
  const [view, setView] = useState<'list' | 'custody' | 'transactions' | 'rep-cycle'>(
    initialView === 'custody' ? 'custody' : initialView === 'transactions' ? 'transactions' : initialView === 'rep-cycle' ? 'rep-cycle' : 'list'
  );
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRep, setEditingRep] = useState<any>(null);
  const [formData, setFormData] = useState({ name: '', phone: '' });
  const [representatives, setRepresentatives] = useState<any[]>([]);
  const [pendingOrders, setPendingOrders] = useState<any[]>([]);
  const [repAssignedOrders, setRepAssignedOrders] = useState<any[]>([]);
  const [selectedRepId, setSelectedRepId] = useState<number | null>(null);
  const currencySymbol = 'ج.م';
  const [repTransactions, setRepTransactions] = useState<any[]>([]);
  const [paymentForm, setPaymentForm] = useState({ amount: '', type: 'payment', direction: 'in', treasuryId: '', note: '' });
  const [treasuries, setTreasuries] = useState<any[]>([]);
  const [userDefaults, setUserDefaults] = useState<any>(null);
  const [perfStartDate, setPerfStartDate] = useState<string>(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]);
  const [perfEndDate, setPerfEndDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [repPerfLoading, setRepPerfLoading] = useState(false);
  const [repPerformance, setRepPerformance] = useState({
    total: 0,
    delivered: 0,
    returned: 0,
    withRep: 0,
    deliveredAmount: 0,
    returnedAmount: 0,
    returnRate: 0
  });

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
  };

  useEffect(() => {
    if (['list', 'custody', 'transactions', 'rep-cycle'].includes(initialView || '')) {
      setView(initialView as any);
    }
    const fetchReps = async () => {
      try {
        const res = await fetch(`${API_BASE_PATH}/api.php?module=users&action=getAll`);
        const js = await res.json();
        if (js.success && Array.isArray(js.data)) {
          const reps = js.data.filter((u:any) => u.role === 'representative');
          // fetch balances for each rep
          const enriched = await Promise.all(reps.map(async (r:any) => {
            try {
              const tr = await fetch(`${API_BASE_PATH}/api.php?module=transactions&action=getByRelated&related_to_type=rep&related_to_id=${r.id}`);
              const jtr = await tr.json();
              const bal = (jtr.success ? (jtr.data||[]).reduce((s:any,t:any)=> s + Number(t.amount||0), 0) : 0);
              return { ...r, balance: Number(bal) };
            } catch (e) { return { ...r, balance: 0 }; }
          }));
          setRepresentatives(enriched);
        }
      } catch (e) { console.error('Failed to fetch reps', e); }
    };
    const fetchPending = async () => {
      try {
        const r = await fetch(`${API_BASE_PATH}/api.php?module=orders&action=getAll&status=pending`);
        const jr = await r.json(); if (jr.success) setPendingOrders(jr.data || []);
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
        const jr = await r.json(); if (jr && jr.success) { setUserDefaults(jr.data || null); if (jr.data && jr.data.default_treasury_id && !paymentForm.treasuryId) setPaymentForm(prev => ({...prev, treasuryId: String(jr.data.default_treasury_id)})); }
      } catch (e) { console.error('Failed to fetch user defaults', e); }
    };
    fetchReps();
    fetchPending();
    fetchTreasuries();
    fetchUserDefaults();
  }, [initialView]);

  const filteredReps = representatives.filter(r =>
    (r.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    String(r.phone || '').includes(searchTerm)
  );

  const handleOpenModal = (rep: any = null) => {
    if (rep) {
      setEditingRep(rep);
      setFormData({ name: rep.name || '', phone: rep.phone || '' });
    } else {
      // Logic for adding a new rep would go here, but the request is about editing existing ones.
      setEditingRep(null);
      setFormData({ name: '', phone: '' });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    (async () => {
      try {
        if (editingRep) {
          const res = await fetch(`${API_BASE_PATH}/api.php?module=users&action=update`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ name: formData.name, phone: formData.phone, role: 'representative', id: editingRep.id }) });
          const raw = await res.text();
          let js: any = null;
          try { js = JSON.parse(raw); } catch (e) { console.error('Save rep raw response (update):', raw); Swal.fire('خطأ في الخادم', raw.substring(0, 1000), 'error'); return; }
          if (js.success) {
            const updated = js.data ? js.data : { ...editingRep, ...formData };
            setRepresentatives(prev => prev.map(r => r.id === editingRep.id ? updated : r));
            setIsModalOpen(false);
            Swal.fire('تم الحفظ', 'تم تحديث بيانات المندوب بنجاح.', 'success');
          } else Swal.fire('فشل الحفظ', js.message || 'فشل تحديث المندوب', 'error');
        } else {
          // Default permissions: only update order status
          const defaultPerms = JSON.stringify({ update_order_status: true });
          const payload: any = { name: formData.name, phone: formData.phone, role: 'representative', permissions: defaultPerms };
          const res = await fetch(`${API_BASE_PATH}/api.php?module=users&action=create`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(payload) });
          const raw = await res.text();
          let js: any = null;
          try { js = JSON.parse(raw); } catch (e) { console.error('Save rep raw response (create):', raw); Swal.fire('خطأ في الخادم', raw.substring(0, 1000), 'error'); return; }
          if (js.success) {
            // server may return created record in js.data or insert_id
            if (js.data) {
              setRepresentatives(prev => [ js.data, ...prev]);
            } else if (js.insert_id) {
              setRepresentatives(prev => [ { id: js.insert_id, ...formData, role: 'representative' }, ...prev]);
            } else {
              setRepresentatives(prev => [ { id: Math.random(), ...formData, role: 'representative' }, ...prev]);
            }
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

    if (rep.balance !== 0) {
      Swal.fire({
        icon: 'error',
        title: 'عملية مرفوضة',
        text: `لا يمكن حذف المندوب "${rep.name}" لأن حسابه غير صفري. الرصيد الحالي: ${rep.balance.toLocaleString()} ${currencySymbol}`,
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

    const fetchRepPerformance = async (repId: number, startDate: string, endDate: string) => {
      if (!repId) return;
      setRepPerfLoading(true);
      try {
        const r = await fetch(`${API_BASE_PATH}/api.php?module=orders&action=getByRep&rep_id=${repId}&start_date=${startDate}&end_date=${endDate}`);
        const jr = await r.json();
        if (jr.success) {
          const orders = jr.data || [];
          const delivered = orders.filter((o:any) => o.status === 'delivered');
          const returned = orders.filter((o:any) => o.status === 'returned');
          const withRep = orders.filter((o:any) => o.status === 'with_rep');
          const deliveredAmount = delivered.reduce((s:any, o:any) => s + Number(o.total || 0), 0);
          const returnedAmount = returned.reduce((s:any, o:any) => s + Number(o.total || 0), 0);
          const totalHandled = delivered.length + returned.length;
          const returnRate = totalHandled > 0 ? Math.round((returned.length / totalHandled) * 100) : 0;
          setRepPerformance({
            total: orders.length,
            delivered: delivered.length,
            returned: returned.length,
            withRep: withRep.length,
            deliveredAmount,
            returnedAmount,
            returnRate
          });
        }
      } catch (e) {
        console.error('Failed to fetch rep performance', e);
      } finally {
        setRepPerfLoading(false);
      }
    };

    const fetchRepTransactions = async () => {
      try {
        const r = await fetch(`${API_BASE_PATH}/api.php?module=transactions&action=getByRelated&related_to_type=rep&related_to_id=${selectedRepId}`);
        const jr = await r.json();
        if (jr.success) {
          const txs = jr.data || [];
          setRepTransactions(txs);
          const bal = txs.reduce((s:any, t:any) => s + Number(t.amount||0), 0);
          setRepresentatives(prev => prev.map(p => p.id === selectedRepId ? { ...p, balance: Number(bal) } : p));
        }
      } catch (e) { console.error('Failed to fetch rep transactions', e); }
    };

  const handleCreateTransaction = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!selectedRepId) return Swal.fire('اختر مندوب', 'يرجى اختيار مندوب أولاً.', 'warning');
    const amount = Number(paymentForm.amount || 0);
    if (!amount || isNaN(amount) || amount <= 0) return Swal.fire('قيمة غير صحيحة', 'أدخل مبلغًا صالحًا أكبر من صفر.', 'error');

    // Ensure treasury and reason are provided for financial transactions
    if (!paymentForm.treasuryId) {
      return Swal.fire('اختر الخزينة', 'يرجى اختيار الخزينة المسؤولة عن المعاملة.', 'warning');
    }
    if (!paymentForm.note || String(paymentForm.note).trim() === '') {
      return Swal.fire('حدد البيان', 'يرجى إدخال سبب/بيان المعاملة في الحقل المخصص (note).', 'warning');
    }

    const payload = {
      type: paymentForm.type,
      related_to_type: 'rep',
      related_to_id: selectedRepId,
      amount: amount,
      treasuryId: paymentForm.treasuryId || null,
      direction: paymentForm.direction,
      details: { note: paymentForm.note }
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

  const selectedRepData = representatives.find(r => r.id === selectedRepId);
  const selectedRepCustody = selectedRepId ? (repAssignedOrders || []).filter(o => Number(o.rep_id) === Number(selectedRepId)) : [];
  const repCashIn = repTransactions.reduce((s:any, t:any) => s + (Number(t.amount || 0) > 0 ? Number(t.amount || 0) : 0), 0);
  const repCashOut = repTransactions.reduce((s:any, t:any) => s + (Number(t.amount || 0) < 0 ? Math.abs(Number(t.amount || 0)) : 0), 0);
  const repCashBalance = repTransactions.reduce((s:any, t:any) => s + Number(t.amount || 0), 0);

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
    fetchRepPerformance(selectedRepId, perfStartDate, perfEndDate);
  }, [selectedRepId]);

  useEffect(() => {
    if (selectedRepId) fetchRepPerformance(selectedRepId, perfStartDate, perfEndDate);
  }, [selectedRepId, perfStartDate, perfEndDate]);

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
                  <th className="px-6 py-4 font-bold">الرصيد</th>
                  <th className="px-6 py-4 font-bold">الحالة</th>
                  <th className="px-6 py-4 font-bold text-center">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y dark:divide-slate-700 text-slate-700 dark:text-slate-300">
                {filteredReps.map(rep => (
                  <tr key={rep.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                    <td className="px-6 py-4 font-bold">{rep.name}</td>
                    <td className="px-6 py-4 text-xs">{rep.phone}</td>
                    <td className="px-6 py-4 text-sm font-black">
                      {Math.abs(Number(rep.balance || 0)).toLocaleString()} {currencySymbol} <span className="text-sm font-bold" style={{color: (rep.balance>0? 'green': (rep.balance<0? 'red':'#666'))}}>{rep.balance>0? 'له' : (rep.balance<0? 'عليه' : '')}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-lg text-[10px] font-black ${rep.status === 'نشط' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400'}`}>
                        {rep.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-center gap-2">
                        <button onClick={() => handleDelete(rep.id)} className="p-2 text-muted hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-xl transition-all" title="حذف"><Trash2 size={16} /></button>
                        <button onClick={() => handleOpenModal(rep)} className="p-2 text-muted hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/30 rounded-xl transition-all" title="تعديل"><Edit size={16} /></button>
                        <button onClick={() => handleViewDetails(rep.id)} className="p-2 text-muted hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-xl transition-all" title="عرض التفاصيل"><Eye size={16} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
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
              <select
                value={selectedRepId || ''}
                onChange={(e) => setSelectedRepId(Number(e.target.value))}
                className="w-full mt-1 bg-slate-50 dark:bg-slate-900 border-none rounded-2xl py-3 px-4 text-sm text-slate-800 dark:text-slate-200 focus:ring-2 ring-blue-500/20"
              >
                <option value="">-- اختر مندوب --</option>
                {representatives.map(rep => <option key={rep.id} value={rep.id}>{rep.name}</option>)}
              </select>
            </div>
          </div>

          {selectedRepId && selectedRepData ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-in fade-in">
              <div>
                <h4 className="font-bold mb-4">عهدة البضاعة</h4>
                <div className="bg-slate-50 dark:bg-slate-900/50 rounded-2xl p-4 border dark:border-slate-700">
                  {repAssignedOrders.length > 0 ? (
                    <div>
                      <p className="text-sm font-bold mb-2">الطلبيات المسندة لهذا المندوب:</p>
                      <ul className="space-y-2">
                        {repAssignedOrders.map((order:any) => (
                          <li key={order.id} className="flex justify-between items-center p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">
                            <div>
                              <div className="font-medium text-sm">#{order.orderNumber} - {order.customerName}</div>
                              <div className="text-xs text-muted">{order.phone1}</div>
                            </div>
                            <div className="font-bold text-sm">{order.products?.reduce((s:any,p:any)=>s+(Number(p.quantity||0)),0)} قطعة</div>
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
                            const label = getTxLabel(t.type || t.tx_type || '', details);
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
                    {repTransactions.map((t:any) => (
                      (() => {
                        const details = parseTxDetails(t.details);
                        const label = getTxLabel(t.type || t.tx_type || '', details);
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
                      })()
                    ))}
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

      {view === 'rep-cycle' && (
        <div className="p-8 rounded-3xl border border-card shadow-sm animate-in zoom-in duration-300 card" style={{ backgroundColor: 'var(--card-bg)', color: 'var(--text)' }}>
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">ماليات المندوب</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-1 space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-muted mr-2">اختيار المندوب</label>
                <select value={selectedRepId || ''} onChange={(e) => setSelectedRepId(Number(e.target.value) || null)} className="w-full mt-1 bg-slate-50 dark:bg-slate-900 border-none rounded-2xl py-3 px-4 text-sm">
                  <option value="">-- اختر مندوب --</option>
                  {representatives.map(rep => <option key={rep.id} value={rep.id}>{rep.name}</option>)}
                </select>
              </div>
              <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-2xl border dark:border-slate-700 space-y-3">
                <div className="flex justify-between items-center text-xs"><span className="text-muted">الرصيد الحالي:</span><span className="font-bold text-rose-500">{selectedRepData ? Math.abs(Number(selectedRepData.balance||0)).toLocaleString() + ' ' + currencySymbol + ' ' + (selectedRepData.balance>0? 'له' : selectedRepData.balance<0? 'عليه' : '') : '—'}</span></div>
                <div className="flex justify-between items-center text-xs"><span className="text-muted">قيمة الطلبيات في العهدة:</span><span className="font-bold">{selectedRepCustody.reduce((s:any,o:any)=> s + (Number(o.total||0) || 0),0).toLocaleString()} {currencySymbol}</span></div>
              </div>
              <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-2xl border dark:border-slate-700 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-black">أداء المندوب</h4>
                  {repPerfLoading && <span className="text-[10px] text-slate-400">جاري التحميل...</span>}
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <input type="date" value={perfStartDate} onChange={e => setPerfStartDate(e.target.value)} className="border rounded-lg px-2 py-1 bg-white dark:bg-slate-800" />
                  <input type="date" value={perfEndDate} onChange={e => setPerfEndDate(e.target.value)} className="border rounded-lg px-2 py-1 bg-white dark:bg-slate-800" />
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2 bg-white dark:bg-slate-800 rounded-lg border dark:border-slate-700">
                    <div className="text-muted">طلبات مسلمة</div>
                    <div className="font-black">{repPerformance.delivered}</div>
                    <div className="text-[10px] text-emerald-600">{repPerformance.deliveredAmount.toLocaleString()} {currencySymbol}</div>
                  </div>
                  <div className="p-2 bg-white dark:bg-slate-800 rounded-lg border dark:border-slate-700">
                    <div className="text-muted">مرتجعات</div>
                    <div className="font-black">{repPerformance.returned}</div>
                    <div className="text-[10px] text-rose-600">{repPerformance.returnedAmount.toLocaleString()} {currencySymbol}</div>
                  </div>
                  <div className="p-2 bg-white dark:bg-slate-800 rounded-lg border dark:border-slate-700">
                    <div className="text-muted">في العهدة</div>
                    <div className="font-black">{repPerformance.withRep}</div>
                  </div>
                  <div className="p-2 bg-white dark:bg-slate-800 rounded-lg border dark:border-slate-700">
                    <div className="text-muted">نسبة المرتجع</div>
                    <div className="font-black">{repPerformance.returnRate}%</div>
                  </div>
                </div>
              </div>
              <form onSubmit={handleCreateTransaction} className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-2xl border dark:border-slate-700 space-y-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-muted mr-2">نوع المعاملة</label>
                  <select value={paymentForm.type} onChange={(e) => setPaymentForm(prev => ({ ...prev, type: e.target.value }))} className="w-full border-none rounded-lg py-2 px-3 text-sm card" style={{ backgroundColor: 'var(--card-bg)', color: 'var(--text)' }}>
                    <option value="payment">تحصيل / تحصيل نقدي</option>
                    <option value="fine">غرامة</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-muted mr-2">اتجاه الخزينة</label>
                  <select value={paymentForm.direction} onChange={(e) => setPaymentForm(prev => ({ ...prev, direction: e.target.value }))} className="w-full border-none rounded-lg py-2 px-3 text-sm card" style={{ backgroundColor: 'var(--card-bg)', color: 'var(--text)' }}>
                    <option value="in">تحويل إلى الخزينة (المندوب دفع)</option>
                    <option value="out">صرف من الخزينة (دفع للمندوب)</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-muted mr-2">المبلغ</label>
                  <input value={paymentForm.amount} onChange={(e) => setPaymentForm(prev => ({ ...prev, amount: e.target.value }))} type="number" placeholder="المبلغ" className="w-full border-none rounded-lg py-2 px-3 text-sm card" style={{ backgroundColor: 'var(--card-bg)', color: 'var(--text)' }} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-muted mr-2">الخزينة</label>
                  <select disabled={userDefaults && userDefaults.default_treasury_id && !userDefaults.can_change_treasury} value={paymentForm.treasuryId} onChange={(e) => setPaymentForm(prev => ({ ...prev, treasuryId: e.target.value }))} className="w-full border-none rounded-lg py-2 px-3 text-sm card" style={{ backgroundColor: 'var(--card-bg)', color: 'var(--text)' }}>
                    <option value="">-- اختر خزينة (اختياري) --</option>
                    {treasuries.map(t => <option key={t.id} value={t.id}>{t.name || t.title || (`خزينة ${t.id}`)}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-muted mr-2">خانة ملاحظات</label>
                  <input value={paymentForm.note} onChange={(e) => setPaymentForm(prev => ({ ...prev, note: e.target.value }))} type="text" placeholder="ملاحظة أو سبب العملية" className="w-full border-none rounded-lg py-2 px-3 text-sm card" style={{ backgroundColor: 'var(--card-bg)', color: 'var(--text)' }} />
                </div>
                <button type="submit" className="w-full bg-accent text-white py-3 rounded-2xl font-black shadow-xl shadow-blue-500/30 hover:bg-blue-700 transition-all">تسجيل المعاملة</button>
              </form>
            </div>
            <div className="md:col-span-2">
              <h4 className="font-bold mb-4 flex items-center gap-2"><ShoppingCart size={18} /> الطلبيات المتاحة للتسليم</h4>
              <div className="bg-slate-50 dark:bg-slate-900/50 rounded-2xl p-4 border dark:border-slate-700 max-h-96 overflow-y-auto">
                <ul className="space-y-2">
                  {pendingOrders.map((order:any) => {
                    const customerName = order.customerName || order.customer_name || order.customer?.name || 'عميل';
                    const orderNumber = order.orderNumber || order.order_number || order.order_no || '';
                    const total = order.total || order.total_amount || order.grand_total || 0;
                    return (
                      <li key={order.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">
                        <input type="checkbox" className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900" />
                        <div className="flex-1 flex justify-between items-center">
                          <div>
                            <p className="font-bold text-sm">{customerName}</p>
                            <p className="text-xs text-muted">{orderNumber}</p>
                          </div>
                          <p className="font-bold text-sm">{Number(total).toLocaleString()} {currencySymbol}</p>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              </div>
            </div>
          </div>
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
              <button type="submit" className="w-full bg-accent text-white py-4 rounded-2xl font-black shadow-xl shadow-blue-500/30 hover:bg-blue-700 transition-all flex items-center justify-center gap-2">
                <Save size={18} /> {editingRep ? 'حفظ التعديلات' : 'إضافة مندوب'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default RepresentativesModule;