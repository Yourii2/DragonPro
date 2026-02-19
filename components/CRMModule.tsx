
import React, { useState, useEffect } from 'react';
import { Search, UserPlus, FileText, Calculator, X, Save, Edit, Trash2, Eye, Archive } from 'lucide-react';
import Swal from 'sweetalert2';
import { API_BASE_PATH } from '../services/apiConfig';
import { ensurePermissionsLoaded, hasPermission } from '../services/permissions';
import CustomSelect from './CustomSelect';

interface CRMModuleProps {
  initialView?: string;
}

const CRMModule: React.FC<CRMModuleProps> = ({ initialView }) => {
  const [view, setView] = useState<'list' | 'ledger'>(initialView === 'ledger' ? 'ledger' : 'list');
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<any>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [customerOrders, setCustomerOrders] = useState<any[]>([]);
  const [isLoadingOrders, setIsLoadingOrders] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [interactions, setInteractions] = useState<any[]>([]);
  const [interactionType, setInteractionType] = useState('note');
  const [interactionNote, setInteractionNote] = useState('');
  const [interactionsLoading, setInteractionsLoading] = useState(false);
  const [ledgerCustomerId, setLedgerCustomerId] = useState('');
  const [ledgerStartDate, setLedgerStartDate] = useState<string>(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]);
  const [ledgerEndDate, setLedgerEndDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [ledgerOpening, setLedgerOpening] = useState<number>(0);
  const [ledgerEntries, setLedgerEntries] = useState<any[]>([]);
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const currencySymbol = 'ج.م';

  const getStatusChip = (status: string) => {
    switch (status) {
      case 'pending': return <span className="bg-amber-100 text-amber-700 px-2 py-1 rounded-lg text-[10px] font-bold">قيد الانتظار</span>;
      case 'with_rep': return <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded-lg text-[10px] font-bold">مع المندوب</span>;
      case 'delivered': return <span className="bg-emerald-100 text-emerald-700 px-2 py-1 rounded-lg text-[10px] font-bold">تم التسليم</span>;
      case 'returned': return <span className="bg-rose-100 text-rose-700 px-2 py-1 rounded-lg text-[10px] font-bold">مرتجع</span>;
      default: return <span className="bg-slate-100 px-2 py-1 rounded-lg text-[10px] font-bold">{status}</span>;
    }
  };


  const [customers, setCustomers] = useState<any[]>([]);
  const [filterMode, setFilterMode] = useState<'all'|'received'|'returned'>('all');
  const [statusCustomerIds, setStatusCustomerIds] = useState<number[]>([]);
  const [stats, setStats] = useState<any>({ deliveredCount: 0, returnedCount: 0, satisfactionPct: 0, topCustomers: [] });

  const [formData, setFormData] = useState({ name: '', phone1: '', phone2: '', governorate: '', address: '', landmark: '' });

  useEffect(() => {
    if (initialView === 'ledger' || initialView === 'list') {
      setView(initialView as 'list' | 'ledger');
    }
    // Ensure permissions are loaded for current user and then fetch customers
    (async () => {
      await ensurePermissionsLoaded();
      await fetchCustomers();
    })();
  }, [initialView]);

  // Recompute delivery/return stats whenever customers list or filter mode changes
  useEffect(() => {
    if (customers.length > 0) loadDeliveryStats();
  }, [customers, filterMode]);

  useEffect(() => {
    fetchCustomers();
  }, [showArchived]);

  const fetchCustomers = async () => {
    try {
      const r = await fetch(`${API_BASE_PATH}/api.php?module=customers&action=getAll&include_archived=${showArchived ? '1' : '0'}`);
      const result = await r.json();
      if (result.success) {
        setCustomers(result.data);
      } else {
        console.error('Failed to fetch customers:', result.message);
      }
    } catch (e) { console.error(e); }
  };

  const handleOpenModal = (customer: any = null) => {
    if (customer) {
      setEditingCustomer(customer);
      setFormData({ name: customer.name, phone1: customer.phone1, phone2: customer.phone2 || '', governorate: customer.governorate || '', address: customer.address || '', landmark: customer.landmark || '' });
    } else {
      setEditingCustomer(null);
      setFormData({ name: '', phone1: '', phone2: '', governorate: '', address: '', landmark: '' });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) return;

    if (!hasPermission('customers', editingCustomer ? 'edit' : 'add')) {
      Swal.fire('ممنوع', 'ليس لديك صلاحية تنفيذ هذا الإجراء.', 'error');
      return;
    }

    const url = `${API_BASE_PATH}/api.php?module=customers&action=${editingCustomer ? 'update' : 'create'}`;
    const body = editingCustomer ? JSON.stringify({ ...formData, id: editingCustomer.id }) : JSON.stringify(formData);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: body,
      });
      const result = await response.json();
      if (!result.success) throw new Error(result.message);

      if (editingCustomer) {
        setCustomers(customers.map(c => c.id === editingCustomer.id ? { ...c, ...formData, balance: c.balance } : c));
      } else {
        setCustomers([result.data, ...customers]);
      }
      setIsModalOpen(false);
      Swal.fire('تم', `تم ${editingCustomer ? 'تحديث' : 'إضافة'} العميل بنجاح.`, 'success');
    } catch (error: any) {
      Swal.fire('خطأ', error.message, 'error');
    }
  };

  const handleDelete = (id: number) => {
    const customer = customers.find(c => c.id === id);
    if (!customer) return;

    if (Math.abs(parseFloat(customer.balance || 0)) > 0.01) {
      Swal.fire({
        icon: 'error',
        title: 'عملية مرفوضة',
        text: `لا يمكن حذف العميل "${customer.name}" لأن رصيده لا يساوي صفر. الرصيد الحالي: ${customer.balance.toLocaleString()} ${currencySymbol}`,
        confirmButtonText: 'موافق',
      });
      return;
    }

    Swal.fire({
      title: 'تأكيد الحذف',
      text: `هل أنت متأكد من حذف العميل "${customer.name}"؟ لا يمكن التراجع عن هذا الإجراء.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'نعم، احذفه',
      cancelButtonText: 'إلغاء'
    }).then(async (result) => {
      if (result.isConfirmed) {
        if (!hasPermission('customers', 'delete')) {
          Swal.fire('ممنوع', 'ليس لديك صلاحية حذف العملاء.', 'error');
          return;
        }
        try {
          const response = await fetch(`${API_BASE_PATH}/api.php?module=customers&action=delete`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id }),
          });
          const res = await response.json();
          if (!res.success) throw new Error(res.message);

          setCustomers(customers.filter(c => c.id !== id));
          Swal.fire('تم الحذف!', `تم حذف بيانات العميل بنجاح.`, 'success');
        } catch (error: any) {
          Swal.fire('خطأ', error.message, 'error');
        }
      }
    });
  };

  const handleArchive = async (customer: any) => {
    if (!hasPermission('customers', 'edit')) {
      Swal.fire('ممنوع', 'ليس لديك صلاحية تنفيذ هذا الإجراء.', 'error');
      return;
    }
    const isArchived = customer.is_archived === 1 || customer.is_archived === '1';
    const action = isArchived ? 'unarchive' : 'archive';
    try {
      const response = await fetch(`${API_BASE_PATH}/api.php?module=customers&action=${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: customer.id })
      });
      const result = await response.json();
      if (!result.success) throw new Error(result.message || 'فشل تحديث حالة العميل');
      await fetchCustomers();
      Swal.fire('تم', isArchived ? 'تم إعادة تفعيل العميل.' : 'تم أرشفة العميل.', 'success');
    } catch (e: any) {
      Swal.fire('خطأ', e.message || 'تعذر تنفيذ العملية.', 'error');
    }
  };

  const handleViewDetails = async (customer: any) => {
    setSelectedCustomer(customer);
    setIsDetailModalOpen(true);
    setIsLoadingOrders(true);
    setCustomerOrders([]);
    setInteractions([]);
    setInteractionNote('');
    setInteractionType('note');
    try {
      const response = await fetch(`${API_BASE_PATH}/api.php?module=orders&action=getCustomerOrders&customerId=${customer.id}`);
      const result = await response.json();
      if (result.success) {
        setCustomerOrders(result.data || []);
      } else {
        Swal.fire('خطأ', 'فشل تحميل طلبيات العميل.', 'error');
        console.error("Failed to fetch customer orders:", result.message);
      }
    } catch (error) {
      Swal.fire('خطأ', 'حدث خطأ أثناء الاتصال بالخادم.', 'error');
      console.error("Error fetching customer orders:", error);
    } finally {
      setIsLoadingOrders(false);
    }
    fetchInteractions(customer.id);
  };

  const fetchInteractions = async (customerId: number) => {
    setInteractionsLoading(true);
    try {
      const response = await fetch(`${API_BASE_PATH}/api.php?module=customers&action=getInteractions&customer_id=${customerId}`);
      const result = await response.json();
      if (result.success) setInteractions(result.data || []);
      else setInteractions([]);
    } catch (e) {
      setInteractions([]);
    } finally {
      setInteractionsLoading(false);
    }
  };

  // Load delivered/returned orders and compute stats & matching customer IDs
  const loadDeliveryStats = async () => {
    try {
      const res = await fetch(`${API_BASE_PATH}/api.php?module=orders&action=customersByStatus&statuses=delivered,returned`);
      const json = await res.json().catch(() => ({ success: false, data: {} }));
      if (!json.success) throw new Error(json.message || 'Failed to load');

      const data = json.data || {};
      const delivered = data['delivered'] || [];
      const returned = data['returned'] || [];

      const deliveredIds = delivered.map((d:any) => Number(d.id));
      const returnedIds = returned.map((d:any) => Number(d.id));

      const totalDeliveredCustomers = deliveredIds.length;
      const totalReturnedCustomers = returnedIds.length;
      const satisfactionPct = (totalDeliveredCustomers + totalReturnedCustomers) === 0 ? 0 : Math.round((totalDeliveredCustomers / (totalDeliveredCustomers + totalReturnedCustomers)) * 100);

      // Top customers from delivered data (already ordered by DB orders_count DESC per status)
      const topList = (delivered || []).slice(0,10).map((t:any) => ({ id: Number(t.id), name: t.name, phone: t.phone1, count: Number(t.count) }));

      setStats({ deliveredCount: totalDeliveredCustomers, returnedCount: totalReturnedCustomers, satisfactionPct, topCustomers: topList });

      if (filterMode === 'received') setStatusCustomerIds(deliveredIds);
      else if (filterMode === 'returned') setStatusCustomerIds(returnedIds);
      else setStatusCustomerIds([]);
    } catch (e) {
      console.error('Failed to load delivery stats', e);
      setStats({ deliveredCount: 0, returnedCount: 0, satisfactionPct: 0, topCustomers: [] });
      setStatusCustomerIds([]);
    }
  };

  const getVisibleCustomers = () => {
    return customers.filter(c => 
      (c.name.toLowerCase().includes(searchTerm.toLowerCase()) || c.phone1.includes(searchTerm)) &&
      (filterMode === 'all' ? true : statusCustomerIds.includes(c.id))
    );
  };

  const exportVisibleCustomers = () => {
    const rows = getVisibleCustomers();
    if (!rows || rows.length === 0) {
      Swal.fire('تنبيه', 'لا توجد بيانات للتصدير.', 'info');
      return;
    }
    const headers = ['ID','اسم العميل','الهاتف 1','الهاتف 2','المحافظة','العنوان','الرصيد'];
    const escape = (v: any) => '"' + String(v ?? '').replace(/"/g, '""') + '"';
    const csvLines = [headers.map(escape).join(',')];
    rows.forEach((r:any) => {
      const line = [r.id, r.name, r.phone1 || '', r.phone2 || '', r.governorate || '', r.address || '', r.balance || 0].map(escape).join(',');
      csvLines.push(line);
    });
    const csvContent = csvLines.join('\n');
    // Prepend UTF-8 BOM so Excel opens Arabic correctly
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `customers_export_${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const [selectedOrderDetail, setSelectedOrderDetail] = useState<any | null>(null);
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);

  const handleViewOrder = async (order: any) => {
    try {
      const or = order.orderNumber || order.order_number || order.orderNum || '';
      if (!or) return;
      const r = await fetch(`${API_BASE_PATH}/api.php?module=orders&action=getByNumber&orderNumber=${encodeURIComponent(or)}`);
      const j = await r.json();
      if (j && j.success && j.data) {
        setSelectedOrderDetail(j.data);
        setIsOrderModalOpen(true);
      } else {
        Swal.fire('خطأ', 'تعذر جلب بيانات الطلبية.', 'error');
      }
    } catch (e) {
      console.error('Failed to load order', e);
      Swal.fire('خطأ', 'تعذر جلب بيانات الطلبية.', 'error');
    }
  };

  const addInteraction = async () => {
    if (!selectedCustomer) return;
    if (!interactionNote.trim()) {
      Swal.fire('تنبيه', 'يرجى إدخال الملاحظة أولاً.', 'warning');
      return;
    }
    try {
      const response = await fetch(`${API_BASE_PATH}/api.php?module=customers&action=addInteraction`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customer_id: selectedCustomer.id, interaction_type: interactionType, note: interactionNote.trim() })
      });
      const result = await response.json();
      if (!result.success) throw new Error(result.message || 'تعذر إضافة الملاحظة');
      setInteractionNote('');
      fetchInteractions(selectedCustomer.id);
    } catch (e: any) {
      Swal.fire('خطأ', e.message || 'تعذر إضافة الملاحظة.', 'error');
    }
  };

  const deleteInteraction = async (id: number) => {
    try {
      const response = await fetch(`${API_BASE_PATH}/api.php?module=customers&action=deleteInteraction`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      });
      const result = await response.json();
      if (!result.success) throw new Error(result.message || 'تعذر حذف الملاحظة');
      if (selectedCustomer) fetchInteractions(selectedCustomer.id);
    } catch (e: any) {
      Swal.fire('خطأ', e.message || 'تعذر حذف الملاحظة.', 'error');
    }
  };

  const loadLedger = async () => {
    if (!ledgerCustomerId) {
      Swal.fire('تنبيه', 'يرجى اختيار عميل.', 'warning');
      return;
    }
    setLedgerLoading(true);
    try {
      const url = `${API_BASE_PATH}/api.php?module=customers&action=getLedger&customer_id=${ledgerCustomerId}&start_date=${ledgerStartDate}&end_date=${ledgerEndDate}`;
      const response = await fetch(url);
      const result = await response.json();
      if (result.success) {
        setLedgerOpening(Number(result.data.opening_balance || 0));
        setLedgerEntries(result.data.entries || []);
      } else {
        setLedgerOpening(0);
        setLedgerEntries([]);
        Swal.fire('تنبيه', 'لا توجد بيانات للعميل في الفترة المحددة.', 'info');
      }
    } catch (e) {
      setLedgerOpening(0);
      setLedgerEntries([]);
      Swal.fire('خطأ', 'تعذر تحميل كشف الحساب.', 'error');
    } finally {
      setLedgerLoading(false);
    }
  };

  const filteredCustomers = customers.filter(c => 
    (c.name.toLowerCase().includes(searchTerm.toLowerCase()) || c.phone1.includes(searchTerm)) &&
    (filterMode === 'all' ? true : statusCustomerIds.includes(c.id))
  );

  const canAdd = hasPermission('customers', 'add');
  const canEdit = hasPermission('customers', 'edit');
  const canDelete = hasPermission('customers', 'delete');
  const canView = hasPermission('customers', 'view');

  return (
    <div className="space-y-6 transition-colors duration-300">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-black">إدارة العملاء</h2>
        <div className="flex items-center gap-3">
          <div className="flex gap-1 p-1 rounded-2xl border border-card shadow-sm" style={{ backgroundColor: 'var(--card-bg)', color: 'var(--text)' }}>
            <button 
              onClick={() => setView('list')} 
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${view === 'list' ? 'bg-accent text-white shadow-md' : 'hover:bg-slate-50 dark:hover:bg-slate-700'}`}
            >
              قائمة العملاء
            </button>
            <button 
              onClick={() => setView('ledger')} 
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${view === 'ledger' ? 'bg-accent text-white shadow-md' : 'hover:bg-slate-50 dark:hover:bg-slate-700'}`}
            >
              كشف الحساب العام
            </button>
          </div>

          <div className="flex gap-2 items-center p-2 rounded-2xl border border-card" style={{ backgroundColor: 'var(--card-bg)', color: 'var(--text)' }}>
            <button onClick={() => { setFilterMode(filterMode === 'received' ? 'all' : 'received'); }} className={`px-3 py-1 rounded-xl text-xs font-bold ${filterMode === 'received' ? 'bg-emerald-600 text-white' : 'hover:bg-emerald-50'}`}>
              تم الاستلام <span className="mr-2 text-[11px] font-bold">{stats.deliveredCount || 0}</span>
            </button>
            <button onClick={() => { setFilterMode(filterMode === 'returned' ? 'all' : 'returned'); }} className={`px-3 py-1 rounded-xl text-xs font-bold ${filterMode === 'returned' ? 'bg-rose-600 text-white' : 'hover:bg-rose-50'}`}>
              تم الارتجاع <span className="mr-2 text-[11px] font-bold">{stats.returnedCount || 0}</span>
            </button>
            <div className="text-xs text-muted mr-3">نسبة رضا العملاء: <span className="font-black ml-2">{stats.satisfactionPct || 0}%</span></div>
          </div>
        </div>
      </div>

      {view === 'list' ? (
        <div className="bg-dark dark:bg-slate-800 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className="rounded-3xl shadow-sm border border-card overflow-hidden" style={{ backgroundColor: 'var(--card-bg)', color: 'var(--text)' }}>
            <div className="flex flex-col md:flex-row items-center justify-between gap-4 w-full">
  
  {/* محرك البحث - سياخذ المساحة المتاحة */}
  {/* Search + centered compact stats */}
  <div className="w-full py-4">
    <div className="flex items-center gap-4">
      <div className="flex-1 relative">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input 
          type="text" 
          placeholder="بحث بالاسم أو رقم الهاتف..." 
          className="w-full pr-10 pl-4 py-2.5 border-none rounded-2xl text-sm focus:ring-2 ring-blue-500/20 text-right"
          style={{ backgroundColor: 'var(--card-bg)', color: 'var(--text)' }}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>
      <div className="flex-shrink-0 flex items-center gap-3">
        <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-100 text-center">
          <div className="text-xs text-emerald-700">استلام</div>
          <div className="font-black text-lg text-emerald-800">{stats.deliveredCount || 0}</div>
        </div>
        <div className="p-3 rounded-lg bg-rose-50 border border-rose-100 text-center">
          <div className="text-xs text-rose-700">ارتجاع</div>
          <div className="font-black text-lg text-rose-800">{stats.returnedCount || 0}</div>
        </div>
        <div className="p-3 rounded-lg bg-blue-50 border border-blue-100 text-center">
          <div className="text-xs text-blue-700">رضا</div>
          <div className="font-black text-lg text-blue-800">{stats.satisfactionPct || 0}%</div>
        </div>
      </div>
    </div>
  </div>

  <div className="flex items-center gap-2">
    <button
      onClick={() => setShowArchived(!showArchived)}
      className="px-4 py-2.5 rounded-2xl text-xs font-bold border border-card shadow-sm"
      style={{ backgroundColor: 'var(--card-bg)', color: 'var(--text)' }}
    >
      {showArchived ? 'إخفاء المؤرشف' : 'إظهار المؤرشف'}
    </button>
    {canAdd ? (
      <button 
        onClick={() => handleOpenModal()}
        className="w-full md:w-auto flex-shrink-0 flex items-center justify-center gap-2 bg-accent text-white px-5 py-2.5 rounded-2xl text-sm font-black shadow-lg shadow-blue-500/20 active:scale-95 transition-all"
        style={{ minWidth: 160 }}
      >
        <UserPlus size={18} /> إضافة عميل جديد
      </button>
    ) : (
      <button disabled className="opacity-60 cursor-not-allowed w-full md:w-auto flex-shrink-0 flex items-center justify-center gap-2 bg-accent text-white px-5 py-2.5 rounded-2xl text-sm font-black shadow-lg shadow-blue-500/20 active:scale-95 transition-all" style={{ minWidth: 160 }}>غير مصرح</button>
    )}
  </div>

</div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead className="bg-slate-50 dark:bg-slate-900/50 text-muted">
                <tr>
                  <th className="px-6 py-4 font-bold">اسم العميل</th>
                  <th className="px-6 py-4 font-bold">رقم الهاتف الأساسي</th>
                  <th className="px-6 py-4 font-bold">العنوان</th>
                  <th className="px-6 py-4 font-bold">الرصيد</th>
                  <th className="px-6 py-4 font-bold text-center">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y dark:divide-slate-700">
                {filteredCustomers.length > 0 ? filteredCustomers.map(c => (
                  <tr key={c.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                    <td className="px-6 py-4 font-bold">{c.name}</td>
                    <td className="px-6 py-4 text-xs font-medium">{c.phone1}</td>
                    <td className="px-6 py-4 text-xs text-muted">{c.address}</td>
                    <td className={`px-6 py-4 font-black ${c.balance > 0 ? 'text-emerald-500' : c.balance < 0 ? 'text-rose-500' : ''}`}>
                      {Math.abs(c.balance).toLocaleString()} {currencySymbol}
                      <span className="text-[10px] mr-1 font-bold opacity-60">{c.balance >= 0 ? '(مدين)' : '(دائن)'}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-center gap-2">
                        <button onClick={() => handleArchive(c)} className="p-2 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-900/30 rounded-xl transition-all" title={c.is_archived ? 'إلغاء الأرشفة' : 'أرشفة'}>
                          <Archive size={16} />
                        </button>
                        {canDelete ? (
                          <button onClick={() => handleDelete(c.id)} className="p-2 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-xl transition-all" title="حذف"><Trash2 size={16} /></button>
                        ) : null}
                        {canEdit ? (
                          <button onClick={() => handleOpenModal(c)} className="p-2 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/30 rounded-xl transition-all" title="تعديل"><Edit size={16} /></button>
                        ) : null}
                        {canView ? (
                          <button onClick={() => handleViewDetails(c)} className="p-2 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-xl transition-all" title="عرض التفاصيل"><Eye size={16} /></button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={5} className="px-6 py-10 text-center text-muted font-bold">لا يوجد نتائج تطابق بحثك</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="rounded-3xl p-6 border border-card card shadow-sm">
          <div className="flex flex-col lg:flex-row gap-4 items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl" style={{ backgroundColor: 'var(--card-bg)', color: 'var(--text)' }}>
                <Calculator className="w-6 h-6 opacity-50 text-blue-500" />
              </div>
              <div>
                <h3 className="text-lg font-black">كشف الحساب التفصيلي</h3>
                <p className="text-xs text-muted">فلترة حسب التاريخ والعميل</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 items-center">
              <CustomSelect value={ledgerCustomerId} onChange={v => setLedgerCustomerId(v)} options={[{ value: '', label: 'اختر عميل' }, ...customers.map((c:any)=>({ value: String(c.id), label: c.name }))]} className="bg-slate-50 rounded-2xl" />
              <input type="date" value={ledgerStartDate} onChange={(e) => setLedgerStartDate(e.target.value)} className="bg-slate-50 dark:bg-slate-900 border-none rounded-2xl py-2 px-3 text-sm" />
              <input type="date" value={ledgerEndDate} onChange={(e) => setLedgerEndDate(e.target.value)} className="bg-slate-50 dark:bg-slate-900 border-none rounded-2xl py-2 px-3 text-sm" />
              <button onClick={loadLedger} className="px-4 py-2 bg-blue-600 text-white rounded-2xl text-sm font-bold">تحميل</button>
            </div>
          </div>

          <div className="mb-4 text-sm">
            <span className="text-muted">الرصيد الافتتاحي:</span> <span className="font-black">{ledgerOpening.toLocaleString()} {currencySymbol}</span>
          </div>

          {ledgerLoading ? (
            <div className="text-center text-muted">جارٍ تحميل كشف الحساب...</div>
          ) : ledgerEntries.length === 0 ? (
            <div className="text-center text-muted">لا توجد عمليات خلال الفترة المحددة.</div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border dark:border-slate-700">
              <table className="w-full text-right text-sm">
                <thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-500 dark:text-slate-400">
                  <tr>
                    <th className="px-4 py-3 font-bold">التاريخ</th>
                    <th className="px-4 py-3 font-bold">الوصف</th>
                    <th className="px-4 py-3 font-bold">مدين</th>
                    <th className="px-4 py-3 font-bold">دائن</th>
                    <th className="px-4 py-3 font-bold">الرصيد</th>
                  </tr>
                </thead>
                <tbody className="divide-y dark:divide-slate-700">
                  {ledgerEntries.map((e: any) => (
                    <tr key={e.id}>
                      <td className="px-4 py-3 text-xs">{new Date(e.date).toLocaleString('ar-EG')}</td>
                      <td className="px-4 py-3 text-xs">{e.description}</td>
                      <td className="px-4 py-3 font-bold text-rose-600">{Number(e.debit || 0).toLocaleString()}</td>
                      <td className="px-4 py-3 font-bold text-emerald-600">{Number(e.credit || 0).toLocaleString()}</td>
                      <td className="px-4 py-3 font-black">{Number(e.balance || 0).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Detail Modal */}
      {isDetailModalOpen && selectedCustomer && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-2xl rounded-[2.5rem] shadow-2xl overflow-hidden border border-card card">
            <div className="p-6 border-b dark:border-slate-700 flex justify-between items-center" style={{ backgroundColor: 'var(--card-bg)', color: 'var(--text)' }}>
              <h3 className="text-lg font-black flex items-center gap-2"><FileText className="text-blue-500" /> تفاصيل العميل: {selectedCustomer.name}</h3>
              <button onClick={() => setIsDetailModalOpen(false)} className="hover:text-rose-500 transition-colors"><X size={24} /></button>
            </div>
            <div className="p-8 text-right space-y-4">
               <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-2xl">
                    <p className="text-[10px] font-bold uppercase text-muted">رقم الهاتف</p>
                    <p className="font-bold">{selectedCustomer.phone1}</p>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-2xl">
                    <p className="text-[10px] font-bold uppercase text-muted">الرصيد الحالي</p>
                    <p className={`font-black ${selectedCustomer.balance >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>{selectedCustomer.balance.toLocaleString()} {currencySymbol}</p>
                  </div>
               </div>
               <div className="pt-4 border-t dark:border-slate-700">
                 <h4 className="font-bold mb-3">طلبيات العميل</h4>
                 {isLoadingOrders ? (
                   <div className="text-center p-8">جاري تحميل الطلبيات...</div>
                 ) : customerOrders.length > 0 ? (
                   <div className="overflow-auto max-h-96">
                                <table className="w-full text-sm text-right">
                                  <thead className="bg-slate-100 dark:bg-slate-900">
                                    <tr>
                                      <th className="p-3">رقم الطلب</th>
                                      <th className="p-3">التاريخ</th>
                                      <th className="p-3">الإجمالي</th>
                                      <th className="p-3">الحالة</th>
                                      <th className="p-3">المندوب</th>
                                      <th className="p-3">عرض</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y dark:divide-slate-700">
                                    {customerOrders.map(order => (
                                      <tr key={order.id}>
                                        <td className="p-3 font-mono">{order.orderNumber}</td>
                                        <td className="p-3">{new Date(order.created_at).toLocaleDateString('ar-EG')}</td>
                                        <td className="p-3 font-bold">{Number(order.total).toLocaleString()} {currencySymbol}</td>
                                        <td className="p-3">{getStatusChip(order.status)}</td>
                                        <td className="p-3">{order.repName || '-'}</td>
                                        <td className="p-3">
                                          <button onClick={() => handleViewOrder(order)} className="px-3 py-1 bg-slate-100 rounded-lg text-xs font-bold hover:bg-slate-200">عرض</button>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                   </div>
                 ) : (
                   <div className="text-center p-8 text-muted">لا توجد طلبيات لهذا العميل.</div>
                 )}
               </div>
              <div className="pt-4 border-t dark:border-slate-700">
                <h4 className="font-bold mb-3">سجل التفاعلات</h4>
                <div className="flex flex-wrap gap-2 items-center mb-4">
                  <CustomSelect value={interactionType} onChange={v => setInteractionType(v)} options={[{ value: 'note', label: 'ملاحظة' }, { value: 'call', label: 'مكالمة' }, { value: 'visit', label: 'زيارة' }, { value: 'email', label: 'بريد' }]} className="bg-slate-50 rounded-2xl" />
                  <input type="text" value={interactionNote} onChange={(e) => setInteractionNote(e.target.value)} placeholder="أضف ملاحظة مختصرة..." className="flex-1 bg-slate-50 dark:bg-slate-900 border-none rounded-2xl py-2 px-3 text-xs" />
                  <button onClick={addInteraction} className="px-3 py-2 bg-blue-600 text-white rounded-2xl text-xs font-bold">إضافة</button>
                </div>
                {interactionsLoading ? (
                  <div className="text-center text-muted">جارٍ تحميل التفاعلات...</div>
                ) : interactions.length === 0 ? (
                  <div className="text-center text-muted">لا توجد تفاعلات مسجلة.</div>
                ) : (
                  <div className="space-y-2">
                    {interactions.map((i: any) => (
                      <div key={i.id} className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-900/50 border dark:border-slate-700 flex justify-between items-center">
                        <div>
                          <div className="text-xs font-bold">{i.interaction_type} • {i.created_by_name || '—'}</div>
                          <div className="text-[11px] text-muted mt-1">{i.note}</div>
                        </div>
                        <button onClick={() => deleteInteraction(i.id)} className="text-rose-500 text-xs">حذف</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Order Detail Modal */}
      {isOrderModalOpen && selectedOrderDetail && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-2xl rounded-[2.5rem] shadow-2xl overflow-hidden border border-card card">
            <div className="p-6 border-b dark:border-slate-700 flex justify-between items-center" style={{ backgroundColor: 'var(--card-bg)', color: 'var(--text)' }}>
              <h3 className="text-lg font-black">عرض الطلبية: {selectedOrderDetail.orderNumber}</h3>
              <button onClick={() => { setIsOrderModalOpen(false); setSelectedOrderDetail(null); }} className="hover:text-rose-500 transition-colors"><X size={24} /></button>
            </div>
            <div className="p-6 text-right">
              <div className="mb-4">
                <div>التاريخ: <span className="font-black">{new Date(selectedOrderDetail.created_at || selectedOrderDetail.createdAt || Date.now()).toLocaleString('ar-EG')}</span></div>
                <div>الإجمالي: <span className="font-black">{Number(selectedOrderDetail.total || selectedOrderDetail.total_amount || 0).toLocaleString()} {currencySymbol}</span></div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-right">
                  <thead className="bg-slate-100 dark:bg-slate-900">
                    <tr>
                      <th className="p-2">العنصر</th>
                      <th className="p-2">اللون</th>
                      <th className="p-2">المقاس</th>
                      <th className="p-2">الكمية</th>
                      <th className="p-2">السعر</th>
                      <th className="p-2">الإجمالي</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y dark:divide-slate-700">
                    {(selectedOrderDetail.products || []).map((it:any, idx:number) => (
                      <tr key={idx}>
                        <td className="p-2">{it.name}</td>
                        <td className="p-2">{it.color}</td>
                        <td className="p-2">{it.size}</td>
                        <td className="p-2">{it.quantity}</td>
                        <td className="p-2">{Number(it.price || it.price_per_unit || 0).toLocaleString()}</td>
                        <td className="p-2">{Number(it.total || it.line_total || (it.quantity* (it.price||0))).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Customer Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden border border-card card" style={{ backgroundColor: 'var(--card-bg)', color: 'var(--text)' }}>
            <div className="p-6 border-b dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50">
              <h3 className="text-lg font-black">{editingCustomer ? 'تعديل بيانات العميل' : 'إضافة عميل جديد'}</h3>
              <button onClick={() => setIsModalOpen(false)} className="hover:text-rose-500 transition-colors"><X size={24} /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-8 space-y-4 text-right">
              <div className="space-y-1">
                <label className="text-xs font-bold text-muted mr-2">اسم العميل / الشركة</label>
                <input 
                  type="text" 
                  required
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                  className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl py-3 px-4 text-sm focus:ring-2 ring-blue-500/20"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-muted mr-2">رقم الهاتف 1</label>
                  <input type="text" required value={formData.phone1} onChange={e => setFormData({...formData, phone1: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl py-3 px-4 text-sm" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-muted mr-2">رقم الهاتف 2 (اختياري)</label>
                  <input type="text" value={formData.phone2} onChange={e => setFormData({...formData, phone2: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl py-3 px-4 text-sm" />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-muted mr-2">المحافظة</label>
                  <input type="text" value={formData.governorate} onChange={e => setFormData({...formData, governorate: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl py-3 px-4 text-sm" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-muted mr-2">علامة مميزة</label>
                  <input type="text" value={formData.landmark} onChange={e => setFormData({...formData, landmark: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl py-3 px-4 text-sm" />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-muted mr-2">العنوان</label>
                <input 
                  type="text" 
                  value={formData.address}
                  onChange={e => setFormData({...formData, address: e.target.value})}
                  className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl py-3 px-4 text-sm focus:ring-2 ring-blue-500/20"
                />
              </div>
              <button
                type="submit"
                className="w-full bg-accent text-white py-4 rounded-2xl font-black shadow-xl shadow-blue-500/30 hover:bg-blue-700 transition-all flex items-center justify-center gap-2 mt-6"
              >
                <Save size={18} /> {editingCustomer ? 'حفظ التعديلات' : 'حفظ بيانات العميل'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default CRMModule;
