
import React, { useState, useEffect, useMemo } from 'react';
import { Wallet, TrendingUp, TrendingDown, ArrowLeftRight, Landmark, Plus, Search, X, Save, Edit, Trash2, Eye, Coins, ArrowDown, ArrowUp, Truck, Printer } from 'lucide-react';
import Swal from 'sweetalert2';
import { API_BASE_PATH } from '../services/apiConfig';
import CustomSelect from './CustomSelect';

interface FinanceModuleProps {
  initialView?: string;
}

const FinanceModule: React.FC<FinanceModuleProps> = ({ initialView = 'treasuries' }) => {
  const [activeTab, setActiveTab] = useState<'treasuries' | 'transactions'>('treasuries');
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isTransactionModalOpen, setIsTransactionModalOpen] = useState(false);
  const [modalType, setModalType] = useState<'expense' | 'deposit' | 'transfer' | null>(null);

  // Form states
  const [expenseData, setExpenseData] = useState({ amount: '', treasury_id: '', notes: '' });
  const [depositData, setDepositData] = useState({ amount: '', treasury_id: '', notes: '' });
  const [transferData, setTransferData] = useState({ amount: '', from_treasury_id: '', to_treasury_id: '', notes: '' });

  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [detailStartDate, setDetailStartDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0,10);
  });
  const [detailEndDate, setDetailEndDate] = useState<string>(() => new Date().toISOString().slice(0,10));
  const [editingTreasury, setEditingTreasury] = useState<any>(null);
  const [selectedTreasury, setSelectedTreasury] = useState<any>(null);
  const currencySymbol = 'ج.م';

  const [treasuries, setTreasuries] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [treasuryTransactions, setTreasuryTransactions] = useState<any[]>([]);
  const [isTransactionsLoading, setIsTransactionsLoading] = useState(false);
  const [isAllTxLoading, setIsAllTxLoading] = useState(false);
  const [txFromDate, setTxFromDate] = useState<string>(() => { const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().slice(0, 10); });
  const [txToDate, setTxToDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [txTreasuryId, setTxTreasuryId] = useState<string>('');
  const [userDefaults, setUserDefaults] = useState<any>(null);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [journalEntries, setJournalEntries] = useState<any[]>([]);
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<any>(null);
  const [accountForm, setAccountForm] = useState({ code: '', name: '', type: 'asset', parent_id: '' });
  const [isJournalModalOpen, setIsJournalModalOpen] = useState(false);
  const [journalForm, setJournalForm] = useState({ entry_date: new Date().toISOString().slice(0, 10), memo: '', posted: true });
  const [journalLines, setJournalLines] = useState<any[]>([{ account_id: '', debit: '', credit: '', memo: '' }]);
  const [isJournalDetailOpen, setIsJournalDetailOpen] = useState(false);
  const [selectedJournalEntry, setSelectedJournalEntry] = useState<any>(null);
  const [selectedJournalLines, setSelectedJournalLines] = useState<any[]>([]);

  const [formData, setFormData] = useState({ name: '', type: 'نقدي' });

  useEffect(() => {
    // Fetch treasuries from API and apply user scope if necessary
    const fetchTreasuries = async () => {
      try {
        const [tRes, dRes] = await Promise.all([
          fetch(`${API_BASE_PATH}/api.php?module=treasuries&action=getAll`).then(r=>r.json()),
          fetch(`${API_BASE_PATH}/api.php?module=permissions&action=getUserDefaults`).then(r=>r.json()).catch(()=>({success:false}))
        ]);
        const list = (tRes && tRes.success) ? (tRes.data || []) : [];
        const defaults = (dRes && dRes.success) ? (dRes.data || null) : null;
        if (defaults && defaults.default_treasury_id && !defaults.can_change_treasury) {
          setTreasuries(list.filter((tr:any)=>Number(tr.id)===Number(defaults.default_treasury_id)));
        } else {
          setTreasuries(list);
        }
        if (defaults && defaults.default_treasury_id) {
          const d = String(defaults.default_treasury_id);
          setExpenseData(prev => ({...prev, treasury_id: prev.treasury_id || d}));
          setDepositData(prev => ({...prev, treasury_id: prev.treasury_id || d}));
          setTransferData(prev => ({...prev, from_treasury_id: prev.from_treasury_id || d}));
          setUserDefaults(defaults);
        }
      } catch (error) {
        console.error('Failed to fetch treasuries:', error);
      }
    };

    fetchTreasuries();
    // fetch user defaults to prefill/lock treasury when applicable
    const fetchUserDefaults = async () => {
      try {
        const res = await fetch(`${API_BASE_PATH}/api.php?module=permissions&action=getUserDefaults`);
        const jr = await res.json();
        if (jr && jr.success) {
          setUserDefaults(jr.data || null);
          if (jr.data && jr.data.default_treasury_id) {
            const d = String(jr.data.default_treasury_id);
            setExpenseData(prev => ({...prev, treasury_id: prev.treasury_id || d}));
            setDepositData(prev => ({...prev, treasury_id: prev.treasury_id || d}));
            setTransferData(prev => ({...prev, from_treasury_id: prev.from_treasury_id || d}));
          }
        }
      } catch (e) { console.error('Failed to fetch user defaults', e); }
    };
    fetchUserDefaults();
  }, []);

  useEffect(() => {
    if (initialView === 'transactions') {
      setActiveTab('transactions');
    } else {
      setActiveTab('treasuries');
    }
  }, [initialView]);

  const fetchAllTreasuries = async () => {
    try {
      const [tRes, dRes] = await Promise.all([
        fetch(`${API_BASE_PATH}/api.php?module=treasuries&action=getAll`).then(r=>r.json()),
        fetch(`${API_BASE_PATH}/api.php?module=permissions&action=getUserDefaults`).then(r=>r.json()).catch(()=>({success:false}))
      ]);
      const list = (tRes && tRes.success) ? (tRes.data || []) : [];
      const defaults = (dRes && dRes.success) ? (dRes.data || null) : null;
      if (defaults && defaults.default_treasury_id && !defaults.can_change_treasury) {
        setTreasuries(list.filter((tr:any)=>Number(tr.id)===Number(defaults.default_treasury_id)));
      } else {
        setTreasuries(list);
      }
    } catch (error) {
      console.error('Failed to fetch treasuries:', error);
    }
  };

  const fetchAllTransactions = async (fromDate?: string, toDate?: string, treasuryId?: string) => {
    setIsAllTxLoading(true);
    try {
      let url = `${API_BASE_PATH}/api.php?module=transactions&action=getAll`;
      if (fromDate) url += `&start_date=${encodeURIComponent(fromDate)}`;
      if (toDate) url += `&end_date=${encodeURIComponent(toDate)}`;
      if (treasuryId) url += `&treasury_id=${encodeURIComponent(treasuryId)}`;
      const res = await fetch(url);
      const jr = await res.json();
      if (jr.success) {
        const data = jr.data || [];
        setTransactions(data);
        return data;
      }
      return [];
    } catch (e) {
      console.error('Failed to fetch transactions:', e);
      return [];
    } finally {
      setIsAllTxLoading(false);
    }
  };

  const isRepPaymentTx = (tx: any, details: any): boolean => {
    // rep_payment_in/out may fall back to payment_in/out in DB enum; use details.rep_id or related_to_type to detect
    const repTypes = ['rep_payment_in', 'rep_payment_out'];
    const repRelTypes = ['rep', 'employee']; // employee is fallback for rel_to_type enum
    return (
      repTypes.includes(tx.type) ||
      (repRelTypes.includes(tx.related_to_type) && (tx.type === 'payment_in' || tx.type === 'payment_out') && details.rep_id)
    );
  };

  const isSupplierPaymentTx = (tx: any, details: any): boolean => {
    const txType = String(tx?.type || '').trim();
    const relType = String(tx?.related_to_type || '').trim();
    const subtype = String(details?.subtype || '').trim();
    return (
      txType === 'supplier_payment' ||
      subtype === 'supplier_payment' ||
      (relType === 'supplier' && (txType === 'payment_out' || txType === 'payment'))
    );
  };

  const getTxSource = (tx: any): string => {
    const details = tx.details ? (() => { try { const p = JSON.parse(tx.details); return (p && typeof p === 'object') ? p : {}; } catch { return {}; } })() : {};
    const subtype = details.subtype || '';
    const amt = parseFloat(tx.amount);
    if (subtype === 'transfer_in' || tx.type === 'transfer_in') {
      const fromId = details.transfer_from;
      const found = fromId ? treasuries.find((t: any) => String(t.id) === String(fromId)) : null;
      return found ? found.name : (fromId ? `خزينة #${fromId}` : 'خزينة أخرى');
    }
    if (subtype === 'transfer_out' || tx.type === 'transfer_out') return tx.treasury_name || 'خزينة';
    if (isSupplierPaymentTx(tx, details)) {
      return tx.treasury_name || 'خزينة';
    }
    // Rep payment: collect from rep (positive) → source is rep; pay to rep (negative) → source is treasury
    if (isRepPaymentTx(tx, details)) {
      return amt >= 0
        ? (tx.related_name || `مندوب #${tx.related_to_id || ''}`)
        : (tx.treasury_name || 'خزينة');
    }
    if (amt >= 0) return tx.related_name || 'إيداع خارجي';
    return tx.treasury_name || 'خزينة';
  };

  const getTxDest = (tx: any): string => {
    const details = tx.details ? (() => { try { const p = JSON.parse(tx.details); return (p && typeof p === 'object') ? p : {}; } catch { return {}; } })() : {};
    const subtype = details.subtype || '';
    const amt = parseFloat(tx.amount);
    if (subtype === 'transfer_out' || tx.type === 'transfer_out') {
      const toId = details.transfer_to;
      const found = toId ? treasuries.find((t: any) => String(t.id) === String(toId)) : null;
      return found ? found.name : (toId ? `خزينة #${toId}` : 'خزينة أخرى');
    }
    if (subtype === 'transfer_in' || tx.type === 'transfer_in') return tx.treasury_name || 'خزينة';
    if (isSupplierPaymentTx(tx, details)) {
      return tx.related_name || `مورد #${tx.related_to_id || ''}`;
    }
    // Rep payment: collect from rep (positive) → dest is treasury; pay to rep (negative) → dest is rep
    if (isRepPaymentTx(tx, details)) {
      return amt >= 0
        ? (tx.treasury_name || 'خزينة')
        : (tx.related_name || `مندوب #${tx.related_to_id || ''}`);
    }
    if (amt >= 0) return tx.treasury_name || 'خزينة';
    return tx.related_name || 'مصروف';
  };

  const getTxDetailsObj = (tx: any): any => {
    if (!tx || !tx.details) return {};
    try {
      const parsed = JSON.parse(tx.details);
      return (parsed && typeof parsed === 'object') ? parsed : {};
    } catch {
      return {};
    }
  };

  const visibleTransactions = useMemo(() => {
    return (transactions || []).filter((tx: any) => {
      // Only show transactions linked to a treasury (treasury_id must be present and non-null)
      const hasTreasury = tx.treasury_id !== null && tx.treasury_id !== undefined && String(tx.treasury_id).trim() !== '';
      return hasTreasury;
    });
  }, [transactions]);

  const printTxReport = () => {
    const rows = visibleTransactions.map(tx => `
      <tr>
        <td>${new Date(tx.transaction_date).toLocaleString('ar-EG')}</td>
        <td>${getTxSource(tx)}</td>
        <td>${getTxDisplayLabel(tx)}</td>
        <td>${getTxDest(tx)}</td>
        <td>${getTxDisplayNotes(tx)}</td>
        <td style="direction:ltr;font-weight:bold;color:${parseFloat(tx.amount)>=0?'green':'red'}">${parseFloat(tx.amount).toLocaleString()} ${currencySymbol}</td>
        <td>${tx.created_by_name || '—'}</td>
      </tr>`).join('');
    const win = window.open('', '_blank');
    if (!win) { Swal.fire('تنبيه', 'يرجى السماح بفتح النوافذ المنبثقة.', 'warning'); return; }
    const selectedTrName = txTreasuryId ? (treasuries.find((t:any)=>String(t.id)===txTreasuryId)?.name||'') : 'جميع الخزائن';
    win.document.write(`<html><head><title>سجل المعاملات</title><style>body{font-family:'Cairo',sans-serif;direction:rtl;padding:20px}table{width:100%;border-collapse:collapse;font-size:11px}th,td{border:1px solid #ddd;padding:6px;text-align:right}th{background:#f2f2f2}h1,h2{text-align:center}@media print{body{-webkit-print-color-adjust:exact}}</style><link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;700&display=swap" rel="stylesheet"></head><body><h1>سجل الإيرادات والمصروفات</h1><h3 style="text-align:center">${selectedTrName} | من: ${txFromDate} إلى: ${txToDate}</h3><table><thead><tr><th>التاريخ</th><th>من</th><th>نوع المعاملة</th><th>إلى</th><th>البيان</th><th>المبلغ</th><th>الموظف</th></tr></thead><tbody>${rows}</tbody></table></body></html>`);
    win.document.close(); win.focus(); setTimeout(() => { win.print(); win.close(); }, 500);
  };

  const fetchAccounts = async () => {
    try {
      const res = await fetch(`${API_BASE_PATH}/api.php?module=accounts&action=getAll`);
      const jr = await res.json();
      if (jr.success) setAccounts(jr.data || []);
    } catch (e) {
      console.error('Failed to fetch accounts', e);
    }
  };

  const fetchJournalEntries = async () => {
    try {
      const res = await fetch(`${API_BASE_PATH}/api.php?module=journal&action=getAll`);
      const jr = await res.json();
      if (jr.success) setJournalEntries(jr.data || []);
    } catch (e) {
      console.error('Failed to fetch journal entries', e);
    }
  };

  useEffect(() => {
    if (activeTab === 'transactions') fetchAllTransactions(txFromDate, txToDate, txTreasuryId);
  }, [activeTab]);

  const openAccountModal = (account?: any) => {
    if (account) {
      setEditingAccount(account);
      setAccountForm({
        code: account.code || '',
        name: account.name || '',
        type: account.type || 'asset',
        parent_id: account.parent_id ? String(account.parent_id) : ''
      });
    } else {
      setEditingAccount(null);
      setAccountForm({ code: '', name: '', type: 'asset', parent_id: '' });
    }
    setIsAccountModalOpen(true);
  };

  const handleSaveAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const url = editingAccount
        ? `${API_BASE_PATH}/api.php?module=accounts&action=update`
        : `${API_BASE_PATH}/api.php?module=accounts&action=create`;
      const payload: any = {
        code: accountForm.code,
        name: accountForm.name,
        type: accountForm.type,
        parent_id: accountForm.parent_id ? Number(accountForm.parent_id) : null
      };
      if (editingAccount) payload.id = editingAccount.id;
      const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const jr = await res.json();
      if (jr.success) {
        setIsAccountModalOpen(false);
        await fetchAccounts();
      } else {
        Swal.fire('خطأ', jr.message || 'فشل حفظ الحساب.', 'error');
      }
    } catch (e) {
      Swal.fire('خطأ', 'تعذر الاتصال بالخادم.', 'error');
    }
  };

  const handleDeleteAccount = async (id: number) => {
    Swal.fire({ title: 'حذف الحساب', text: 'هل أنت متأكد من الحذف؟', icon: 'warning', showCancelButton: true, confirmButtonText: 'حذف', cancelButtonText: 'إلغاء' })
      .then(async (result) => {
        if (!result.isConfirmed) return;
        try {
          const res = await fetch(`${API_BASE_PATH}/api.php?module=accounts&action=delete`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
          const jr = await res.json();
          if (jr.success) fetchAccounts();
          else Swal.fire('خطأ', jr.message || 'فشل حذف الحساب.', 'error');
        } catch (e) {
          Swal.fire('خطأ', 'تعذر الاتصال بالخادم.', 'error');
        }
      });
  };

  const addJournalLine = () => {
    setJournalLines(prev => [...prev, { account_id: '', debit: '', credit: '', memo: '' }]);
  };

  const updateJournalLine = (idx: number, field: string, value: any) => {
    setJournalLines(prev => prev.map((l, i) => (i === idx ? { ...l, [field]: value } : l)));
  };

  const removeJournalLine = (idx: number) => {
    setJournalLines(prev => prev.filter((_, i) => i !== idx));
  };

  const handleCreateJournal = async (e: React.FormEvent) => {
    e.preventDefault();
    const lines = journalLines
      .filter(l => l.account_id)
      .map(l => ({
        account_id: Number(l.account_id),
        debit: Number(l.debit || 0),
        credit: Number(l.credit || 0),
        memo: l.memo || ''
      }));
    const totalDebit = lines.reduce((s, l) => s + Number(l.debit || 0), 0);
    const totalCredit = lines.reduce((s, l) => s + Number(l.credit || 0), 0);
    if (lines.length < 2 || totalDebit.toFixed(2) !== totalCredit.toFixed(2)) {
      Swal.fire('تنبيه', 'يجب أن تكون القيود متوازنة (مدين = دائن).', 'warning');
      return;
    }
    try {
      const res = await fetch(`${API_BASE_PATH}/api.php?module=journal&action=create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entry_date: journalForm.entry_date,
          memo: journalForm.memo,
          posted: journalForm.posted ? 1 : 0,
          lines
        })
      });
      const jr = await res.json();
      if (jr.success) {
        setIsJournalModalOpen(false);
        setJournalLines([{ account_id: '', debit: '', credit: '', memo: '' }]);
        await fetchJournalEntries();
      } else {
        Swal.fire('خطأ', jr.message || 'فشل حفظ القيد.', 'error');
      }
    } catch (e) {
      Swal.fire('خطأ', 'تعذر الاتصال بالخادم.', 'error');
    }
  };

  const handleViewJournal = async (entry: any) => {
    try {
      const res = await fetch(`${API_BASE_PATH}/api.php?module=journal&action=getById&id=${entry.id}`);
      const jr = await res.json();
      if (jr.success) {
        setSelectedJournalEntry(jr.data.entry || entry);
        setSelectedJournalLines(jr.data.lines || []);
        setIsJournalDetailOpen(true);
      }
    } catch (e) {
      console.error('Failed to load journal entry', e);
    }
  };

  const handlePostJournal = async (id: number) => {
    try {
      const res = await fetch(`${API_BASE_PATH}/api.php?module=journal&action=post`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      });
      const jr = await res.json();
      if (jr.success) fetchJournalEntries();
    } catch (e) {
      console.error('Failed to post journal entry', e);
    }
  };

  const openTransactionModal = (type: 'expense' | 'deposit' | 'transfer') => {
    setModalType(type);
    setIsTransactionModalOpen(true);
  };

  const closeTransactionModal = () => {
    setIsTransactionModalOpen(false);
    setModalType(null);
    setExpenseData({ amount: '', treasury_id: '', notes: '' });
    setDepositData({ amount: '', treasury_id: '', notes: '' });
    setTransferData({ amount: '', from_treasury_id: '', to_treasury_id: '', notes: '' });
  };

  const handleOpenModal = (treasury: any = null) => {
    if (treasury) {
      setEditingTreasury(treasury);
      setFormData({ name: treasury.name, type: treasury.type });
    } else {
      setEditingTreasury(null);
      setFormData({ name: '', type: 'نقدي' });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) return;

    try {
      const url = editingTreasury 
        ? `${API_BASE_PATH}/api.php?module=treasuries&action=update`
        : `${API_BASE_PATH}/api.php?module=treasuries&action=create`;
      
      const body = editingTreasury
        ? { ...formData, id: editingTreasury.id }
        : formData;
      
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      
      const result = await response.json();
      
      if (result.success) {
        // Refresh treasuries list
        await fetchAllTreasuries();
        setIsModalOpen(false);
      } else {
        Swal.fire({
          icon: 'error',
          title: 'فشل الحفظ',
          text: result.message || 'حدث خطأ أثناء حفظ الخزينة',
          confirmButtonText: 'حسناً'
        });
      }
    } catch (error) {
      Swal.fire({
        icon: 'error',
        title: 'خطأ في الاتصال',
        text: 'فشل الاتصال بالخادم. يرجى التحقق من اتصالك بالإنترنت.',
        confirmButtonText: 'حسناً'
      });
    }
  };

  const handleDelete = async (id: number) => {
    const treasury = treasuries.find(t => t.id === id);
    if (!treasury) return;

    if (treasury.balance !== 0) {
      Swal.fire({
        icon: 'error',
        title: 'عملية مرفوضة',
        text: `لا يمكن حذف الخزينة "${treasury.name}" لاحتوائها على رصيد مالي. الرصيد الحالي: ${treasury.balance.toLocaleString()} ${currencySymbol}`,
        confirmButtonText: 'موافق',
      });
      return;
    }

    Swal.fire({
      title: 'تأكيد الحذف',
      text: `هل أنت متأكد من حذف الخزينة "${treasury.name}"؟ سيتم حذف كافة سجلاتها المرتبطة.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'نعم، احذفها',
      cancelButtonText: 'إلغاء'
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          const response = await fetch(`${API_BASE_PATH}/api.php?module=treasuries&action=delete`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id })
          });
          
          const deleteResult = await response.json();
          
          if (deleteResult.success) {
            // Refresh treasuries list
            await fetchAllTreasuries();
            Swal.fire(
              'تم الحذف!',
              `تم حذف الخزينة "${treasury.name}" بنجاح.`,
              'success'
            );
          } else {
            Swal.fire({
              icon: 'error',
              title: 'فشل الحذف',
              text: deleteResult.message || 'حدث خطأ أثناء حذف الخزينة',
              confirmButtonText: 'حسناً'
            });
          }
        } catch (error) {
          Swal.fire({
            icon: 'error',
            title: 'خطأ في الاتصال',
            text: 'فشل الاتصال بالخادم. يرجى التحقق من اتصالك بالإنترنت.',
            confirmButtonText: 'حسناً'
          });
        }
      }
    });
  };

  const loadTreasuryTransactions = async (treasuryId: number, startDate?: string, endDate?: string) => {
    setIsTransactionsLoading(true);
    setTreasuryTransactions([]);
    try {
      let url = `${API_BASE_PATH}/api.php?module=transactions&action=getByTreasuryId&id=${treasuryId}`;
      if (startDate) url += `&start_date=${encodeURIComponent(startDate)}`;
      if (endDate) url += `&end_date=${encodeURIComponent(endDate)}`;
      const response = await fetch(url);
      const result = await response.json();
      if (result.success) {
        setTreasuryTransactions(result.data || []);
      } else {
        console.error('Failed to fetch treasury transactions:', result.message);
        Swal.fire('خطأ', 'فشل في جلب سجل الخزينة.', 'error');
      }
    } catch (error) {
      console.error('Error fetching treasury transactions:', error);
      Swal.fire('خطأ', 'فشل الاتصال بالخادم.', 'error');
    } finally {
      setIsTransactionsLoading(false);
    }
  };

  const handleViewDetails = async (treasury: any) => {
    setSelectedTreasury(treasury);
    setIsDetailModalOpen(true);
    // Use currently selected detailStartDate/detailEndDate
    await loadTreasuryTransactions(treasury.id, detailStartDate, detailEndDate);
  };

  const getTransactionTypeLabel = (type: string, detailsJson: string | null) => {
    const labels: { [key: string]: string } = {
        // New subtype-based labels
        deposit: 'إيداع نقدي',
        expense: 'مصروفات',
        supplier_payment: 'دفعة لمورد',
        transfer_out: 'تحويل صادر',
        transfer_in: 'تحويل وارد',
        salary: 'دفع راتب',
        advance: 'سلفة موظف',
        rep_penalty: 'غرامة على مندوب',
        // Original type-based labels
        bonus: 'مكافأة',
        penalty: 'خصم',
        sale: 'فاتورة مبيعات',
        purchase: 'فاتورة مشتريات',
        payment_in: 'تحصيل دفعة',
        payment_out: 'صرف دفعة',
        return_in: 'مرتجع عميل',
        return_out: 'مرتجع لمورد',
        rep_assignment: 'تسليم عهدة لمندوب',
        rep_payment_in: 'بدء يومية',
        rep_payment_out: 'بدء يومية',
        rep_settlement: 'تسوية مندوب',
    };

    if (detailsJson) {
        try {
            const details = JSON.parse(detailsJson);
            if (details.subtype && labels[details.subtype]) {
                return labels[details.subtype];
            }
            if (details.context === 'close_daily' && (type === 'rep_payment_in' || type === 'rep_payment_out')) {
                return 'إغلاق يومية';
            }
        } catch (e) {}
    }

    return labels[type] || type;
  };

    const getTransactionNotes = (details: string | null) => {
      if (!details) return '—';
      try {
        const parsed = JSON.parse(details);
        return parsed.notes || parsed.note || (typeof parsed === 'string' ? parsed : '—');
      } catch (e) {
        return details;
      }
    };

    const getTxDisplayLabel = (tx: any) => {
    if (!tx) return '-';
    if (tx.title && String(tx.title).trim()) return tx.title;
    if (tx.memo && String(tx.memo).trim()) return tx.memo;
    // Detect rep payment even when type fell back to payment_in/out
    try {
      const d = tx.details ? JSON.parse(tx.details) : {};
      if (d && isRepPaymentTx(tx, d)) {
        return d.context === 'close_daily' ? 'بدء يومية' : 'إغلاق يومية';
      }
    } catch { /* fallthrough */ }
    return getTransactionTypeLabel(tx.type, tx.details);
    };

    const getTxDisplayNotes = (tx: any) => {
    if (!tx) return '—';
    try {
      const d = tx.details ? JSON.parse(tx.details) : {};
      if (d && isRepPaymentTx(tx, d)) {
        const isClose = d.context === 'close_daily';
        const amt = parseFloat(tx.amount);
        if (amt >= 0) return isClose ? 'تحصيل من المندوب في بدء اليومية' : 'تحصيل من المندوب في إغلاق اليومية';
        return isClose ? 'دفع إلى المندوب في بدء اليومية' : 'دفع إلى المندوب في إغلاق اليومية';
      }
    } catch { /* fallthrough */ }
    if (tx.memo && String(tx.memo).trim()) return tx.memo;
    if (tx.title && String(tx.title).trim()) return tx.title;
    return getTransactionNotes(tx.details);
    };

  const printTreasuryReport = () => {
    if (!selectedTreasury) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
        Swal.fire('خطأ', 'يرجى السماح بفتح النوافذ المنبثقة لطباعة التقرير.', 'warning');
        return;
    }

    let transactionsHtml = '';
    if (treasuryTransactions.length > 0) {
        transactionsHtml = treasuryTransactions.map(tx => `
          <tr>
            <td>${new Date(tx.transaction_date).toLocaleString('ar-EG')}</td>
            <td>${(tx.title && String(tx.title).trim()) ? tx.title : ((tx.memo && String(tx.memo).trim()) ? tx.memo : getTransactionTypeLabel(tx.type, tx.details))}</td>
            <td>${(tx.memo && String(tx.memo).trim()) ? tx.memo : getTransactionNotes(tx.details)}</td>
            <td style="color: ${tx.amount >= 0 ? 'green' : 'red'}; font-weight: bold; text-align: left; direction: ltr;">${parseFloat(tx.amount).toLocaleString()} ${currencySymbol}</td>
          </tr>
        `).join('');
    } else {
        transactionsHtml = '<tr><td colspan="4" style="text-align: center;">لا توجد معاملات مسجلة</td></tr>';
    }

    const reportHtml = `<html><head><title>كشف حساب خزينة: ${selectedTreasury.name}</title><style>body { font-family: 'Cairo', sans-serif; direction: rtl; padding: 20px; } table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 12px; } th, td { border: 1px solid #ddd; padding: 8px; text-align: right; } th { background-color: #f2f2f2; } h1, h2 { text-align: center; color: #333; } .header-info { display: flex; justify-content: space-between; margin-bottom: 20px; padding-bottom: 10px; border-bottom: 2px solid #eee; } @media print { body { -webkit-print-color-adjust: exact; } }</style><link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;700&display=swap" rel="stylesheet"></head><body><h1>كشف حساب خزينة</h1><h2>${selectedTreasury.name}</h2><div class="header-info"><p><strong>الرصيد الحالي:</strong> ${parseFloat(selectedTreasury.balance).toLocaleString()} ${currencySymbol}</p><p><strong>تاريخ التقرير:</strong> ${new Date().toLocaleString('ar-EG')}</p></div><table><thead><tr><th>التاريخ</th><th>نوع العملية</th><th>البيان</th><th>المبلغ</th></tr></thead><tbody>${transactionsHtml}</tbody></table></body></html>`;

    printWindow.document.write(reportHtml);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
        printWindow.print();
        printWindow.close();
    }, 500);
  };

  const filteredTreasuries = treasuries.filter(t => 
    t.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredAccounts = accounts.filter(a =>
    String(a.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    String(a.code || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getAccountTypeLabel = (type: string) => {
    const map: { [key: string]: string } = {
      asset: 'أصل',
      liability: 'التزام',
      equity: 'حقوق ملكية',
      income: 'إيراد',
      expense: 'مصروف'
    };
    return map[type] || type;
  };

  const journalTotals = journalLines.reduce(
    (acc, line) => {
      acc.debit += Number(line.debit || 0);
      acc.credit += Number(line.credit || 0);
      return acc;
    },
    { debit: 0, credit: 0 }
  );

  const handleTransactionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    let url = `${API_BASE_PATH}/api.php?module=transactions&action=create`;
    let payload: any = {};
    let treasuryToCheck: any = null;
    let amountToCheck = 0;
    let affectedTreasuryId: string = '';

    switch (modalType) {
      case 'expense':
        payload = { ...expenseData, type: 'expense', amount: -Math.abs(parseFloat(expenseData.amount)) };
        treasuryToCheck = treasuries.find(t => t.id == expenseData.treasury_id);
        amountToCheck = parseFloat(expenseData.amount);
        affectedTreasuryId = String(expenseData.treasury_id || '');
        break;
      case 'deposit':
        payload = { ...depositData, type: 'deposit', amount: Math.abs(parseFloat(depositData.amount)) };
        affectedTreasuryId = String(depositData.treasury_id || '');
        break;
      case 'transfer':
        url = `${API_BASE_PATH}/api.php?module=transactions&action=createTransfer`;
        payload = { ...transferData, amount: Math.abs(parseFloat(transferData.amount)) };
        treasuryToCheck = treasuries.find(t => t.id == transferData.from_treasury_id);
        amountToCheck = parseFloat(transferData.amount);
        if (transferData.from_treasury_id === transferData.to_treasury_id) {
            Swal.fire('خطأ', 'لا يمكن التحويل إلى نفس الخزينة.', 'error');
            return;
        }
        break;
      default:
        return;
    }

    // Client-side balance check
    // Validate treasury selection and notes/reason for each modal type
    if (modalType === 'expense') {
      if (!expenseData.treasury_id) { Swal.fire('اختر الخزينة', 'يرجى اختيار الخزينة للمصروف.', 'warning'); return; }
      if (!expenseData.notes || String(expenseData.notes).trim() === '') { Swal.fire('حدد البيان', 'يرجى إدخال سبب المصروف في حقل الملاحظات.', 'warning'); return; }
    }
    if (modalType === 'deposit') {
      if (!depositData.treasury_id) { Swal.fire('اختر الخزينة', 'يرجى اختيار الخزينة للإيداع.', 'warning'); return; }
      if (!depositData.notes || String(depositData.notes).trim() === '') { Swal.fire('حدد البيان', 'يرجى إدخال سبب الايداع في حقل الملاحظات.', 'warning'); return; }
    }
    if (modalType === 'transfer') {
      if (!transferData.from_treasury_id || !transferData.to_treasury_id) { Swal.fire('اختر الخزنتين', 'يرجى تحديد الخزينة المرسلة والمستقبلة.', 'warning'); return; }
      if (!transferData.notes || String(transferData.notes).trim() === '') { Swal.fire('حدد البيان', 'يرجى إدخال سبب التحويل في حقل الملاحظات.', 'warning'); return; }
    }

    if (treasuryToCheck && amountToCheck > treasuryToCheck.balance) {
      Swal.fire('خطأ في الرصيد', `الرصيد في خزينة "${treasuryToCheck.name}" غير كافٍ. الرصيد المتاح: ${treasuryToCheck.balance.toLocaleString()} ${currencySymbol}`, 'error');
      return;
    }

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const result = await response.json();

      if (result.success) {
        Swal.fire('نجاح!', 'تم تسجيل العملية بنجاح.', 'success');
        closeTransactionModal();
        const today = new Date().toISOString().slice(0, 10);
        const nextFromDate = txFromDate && txFromDate > today ? today : txFromDate;
        const nextToDate = !txToDate || txToDate < today ? today : txToDate;
        const nextTreasuryFilter = (affectedTreasuryId && txTreasuryId && txTreasuryId !== affectedTreasuryId) ? '' : txTreasuryId;

        if (nextFromDate !== txFromDate) setTxFromDate(nextFromDate);
        if (nextToDate !== txToDate) setTxToDate(nextToDate);
        if (nextTreasuryFilter !== txTreasuryId) setTxTreasuryId(nextTreasuryFilter);

        const [_, refreshedTransactions] = await Promise.all([
          fetchAllTreasuries(),
          fetchAllTransactions(nextFromDate, nextToDate, nextTreasuryFilter),
        ]);

        if (result.transaction_id && !(refreshedTransactions || []).some((tx: any) => Number(tx.id) === Number(result.transaction_id))) {
          const selectedTreasuryName = treasuries.find((t: any) => String(t.id) === String(affectedTreasuryId))?.name || '';
          const currentUserName = (() => {
            try {
              const user = JSON.parse(localStorage.getItem('Dragon_user') || 'null');
              return user?.name || user?.username || '—';
            } catch {
              return '—';
            }
          })();
          const fallbackTx = {
            id: Number(result.transaction_id),
            type: payload.type,
            treasury_id: affectedTreasuryId || null,
            treasury_name: selectedTreasuryName,
            related_to_type: payload.related_to_type || null,
            related_to_id: payload.related_to_id || null,
            related_name: null,
            amount: Number(payload.amount || 0),
            transaction_date: new Date().toISOString().slice(0, 19).replace('T', ' '),
            details: JSON.stringify({ notes: payload.notes || '', subtype: payload.type || '' }),
            created_by_name: currentUserName,
          };
          setTransactions(prev => [fallbackTx, ...prev]);
        }
      } else {
        Swal.fire('فشل', result.message || 'فشلت العملية. تحقق من البيانات المدخلة.', 'error');
      }
    } catch (error) {
      Swal.fire('خطأ في الاتصال', 'فشل الاتصال بالخادم.', 'error');
    }
  };

  const ActionButton = ({ icon: Icon, title, description, onClick, colorClass }: any) => (
    <button onClick={onClick} className={`text-right p-5 rounded-3xl border transition-all hover:shadow-lg hover:-translate-y-1 ${colorClass}`}>
      <div className="flex items-center gap-4">
        <div className="bg-white/10 p-3 rounded-2xl"><Icon size={24} className="text-white"/></div>
        <div>
          <h4 className="font-black text-white">{title}</h4>
          <p className="text-xs text-white/70">{description}</p>
        </div>
      </div>
    </button>
  );

  return (
    <div className="space-y-6 transition-colors">
      <div className="flex justify-between items-center text-right">
        <div>
          <h2 className="text-xl font-black text-slate-900 dark:text-white">المالية والخزينة</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-bold mt-1">مراقبة التدفقات النقدية والمراكز المالية</p>
        </div>
        <div className="flex gap-1 p-1.5 rounded-2xl border border-card card" style={{ backgroundColor: 'var(--card-bg)', color: 'var(--text)' }}>
          <button 
            onClick={() => setActiveTab('treasuries')} 
            className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${activeTab === 'treasuries' ? 'bg-accent text-white shadow-md' : 'text-muted hover:bg-slate-50 dark:hover:bg-slate-700'}`}
          >
            إدارة الخزائن
          </button>
          <button 
            onClick={() => setActiveTab('transactions')} 
            className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${activeTab === 'transactions' ? 'bg-accent text-white shadow-md' : 'text-muted hover:bg-slate-50 dark:hover:bg-slate-700'}`}
          >
            الإيرادات والمصروفات
          </button>
        </div>
      </div>

      {activeTab === 'treasuries' && (
        <div className="space-y-4 animate-in fade-in duration-300">
          <div className="rounded-3xl border border-card shadow-sm overflow-hidden card" style={{ backgroundColor: 'var(--card-bg)', color: 'var(--text)' }}>
            <div className="p-4 border-b dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 flex flex-col md:flex-row items-center justify-between gap-4">
               <div className="relative flex-1 w-full max-w-md">
                 <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-muted w-4 h-4" />
                 <input 
                   type="text" 
                   placeholder="بحث باسم الخزينة أو البنك..." 
                   className="w-full pr-10 pl-4 py-2.5 bg-white dark:bg-slate-900 border-none rounded-2xl text-sm focus:ring-2 ring-blue-500/20 text-slate-900 dark:text-white text-right"
                   value={searchTerm}
                   onChange={(e) => setSearchTerm(e.target.value)}
                 />
               </div>
               <button 
                onClick={() => handleOpenModal()}
                className="w-full md:w-auto flex items-center justify-center gap-2 bg-accent text-white px-5 py-2.5 rounded-2xl text-sm font-black shadow-lg shadow-blue-500/20 active:scale-95 transition-all"
              >
                <Plus size={18} /> إضافة خزينة جديدة
              </button>
            </div>
            <div className="overflow-x-auto">
               <table className="w-full text-right text-sm">
                 <thead className="bg-slate-50 dark:bg-slate-900/50 text-muted">
                   <tr>
                     <th className="px-6 py-4 font-bold">اسم الخزينة</th>
                     <th className="px-6 py-4 font-bold">النوع</th>
                     <th className="px-6 py-4 font-bold">الرصيد الحالي</th>
                     <th className="px-6 py-4 font-bold text-center">الإجراءات</th>
                   </tr>
                 </thead>
                 <tbody className="divide-y dark:divide-slate-700 text-slate-700 dark:text-slate-300">
                   {filteredTreasuries.length > 0 ? filteredTreasuries.map(t => (
                     <tr key={t.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                       <td className="px-6 py-4 font-bold">{t.name}</td>
                       <td className="px-6 py-4 text-xs font-bold text-slate-500">{t.type}</td>
                       {/* <td className="px-6 py-4 font-black text-blue-600 dark:text-blue-400">{t.balance.toLocaleString()} {currencySymbol}</td> */}
                       <td className="px-6 py-4 font-black text-blue-600 dark:text-blue-400">{(Number(t.balance) || 0).toLocaleString()} {currencySymbol}</td>
                       <td className="px-6 py-4">
                         <div className="flex items-center justify-center gap-2">
                           <button onClick={() => handleDelete(t.id)} className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-xl transition-all" title="حذف الخزينة"><Trash2 size={16} /></button>
                           <button onClick={() => handleOpenModal(t)} className="p-2 text-slate-400 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/30 rounded-xl transition-all" title="تعديل البيانات"><Edit size={16} /></button>
                           <button onClick={() => handleViewDetails(t)} className="p-2 text-slate-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-xl transition-all" title="عرض السجل"><Eye size={16} /></button>
                         </div>
                       </td>
                     </tr>
                   )) : (
                     <tr>
                       <td colSpan={4} className="px-6 py-10 text-center text-slate-400 font-bold">لا توجد خزائن تطابق بحثك</td>
                     </tr>
                   )}
                 </tbody>
               </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'transactions' && (
        <div className="space-y-4 animate-in fade-in duration-300">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <ActionButton 
              icon={ArrowDown} 
              title="إضافة إيداع" 
              description="تسجيل مبلغ وارد إلى خزينة"
              onClick={() => openTransactionModal('deposit')}
              colorClass="bg-gradient-to-br from-emerald-500 to-green-600 border-emerald-600"
            />
            <ActionButton 
              icon={ArrowUp} 
              title="إضافة مصروف" 
              description="تسجيل مبلغ منصرف من خزينة"
              onClick={() => openTransactionModal('expense')}
              colorClass="bg-gradient-to-br from-rose-500 to-red-600 border-rose-600"
            />
            <ActionButton 
              icon={ArrowLeftRight} 
              title="تحويل بين الخزائن" 
              description="نقل رصيد من خزينة لأخرى"
              onClick={() => openTransactionModal('transfer')}
              colorClass="bg-gradient-to-br from-blue-500 to-indigo-600 border-blue-600"
            />
          </div>

          {/* Transactions List */}
          <div className="rounded-3xl border border-card shadow-sm overflow-hidden card" style={{ backgroundColor: 'var(--card-bg)', color: 'var(--text)' }}>
            <div className="p-4 border-b dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-sm font-black text-slate-700 dark:text-white">سجل المعاملات</h3>
              <div className="flex items-center gap-2 flex-wrap">
                <label className="text-xs font-bold text-slate-500">من</label>
                <input type="date" value={txFromDate} onChange={e => setTxFromDate(e.target.value)} className="bg-white dark:bg-slate-900 border-none rounded-xl py-2 px-3 text-sm" />
                <label className="text-xs font-bold text-slate-500">إلى</label>
                <input type="date" value={txToDate} onChange={e => setTxToDate(e.target.value)} className="bg-white dark:bg-slate-900 border-none rounded-xl py-2 px-3 text-sm" />
                <select
                  value={txTreasuryId}
                  onChange={e => setTxTreasuryId(e.target.value)}
                  className="bg-white dark:bg-slate-900 border-none rounded-xl py-2 px-3 text-sm text-slate-700 dark:text-white"
                >
                  <option value="">جميع الخزائن</option>
                  {treasuries.map((t: any) => <option key={t.id} value={String(t.id)}>{t.name}</option>)}
                </select>
                <button onClick={() => fetchAllTransactions(txFromDate, txToDate, txTreasuryId)} className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-black">تحديث</button>
                <button onClick={printTxReport} title="طباعة" className="px-3 py-2 bg-slate-700 text-white rounded-xl text-sm font-black flex items-center gap-1"><Printer size={15}/> طباعة</button>
              </div>
            </div>
            <div className="overflow-x-auto">
              {isAllTxLoading ? (
                <div className="p-10 text-center text-slate-400 font-bold">جاري تحميل المعاملات...</div>
              ) : visibleTransactions.length > 0 ? (
                <table className="w-full text-right text-sm">
                  <thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-500 dark:text-slate-400">
                    <tr>
                      <th className="px-4 py-3 font-bold whitespace-nowrap">التاريخ</th>
                      <th className="px-4 py-3 font-bold whitespace-nowrap">من</th>
                      <th className="px-4 py-3 font-bold whitespace-nowrap">نوع المعاملة</th>
                      <th className="px-4 py-3 font-bold whitespace-nowrap">إلى</th>
                      <th className="px-4 py-3 font-bold whitespace-nowrap">البيان</th>
                      <th className="px-4 py-3 font-bold whitespace-nowrap">المبلغ</th>
                      <th className="px-4 py-3 font-bold whitespace-nowrap">الموظف</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y dark:divide-slate-700 text-slate-700 dark:text-slate-300">
                    {visibleTransactions.map((tx: any) => (
                      <tr key={tx.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                        <td className="px-4 py-3 text-xs whitespace-nowrap">{new Date(tx.transaction_date).toLocaleString('ar-EG')}</td>
                        <td className="px-4 py-3 text-xs font-bold text-blue-600 dark:text-blue-400 whitespace-nowrap">{getTxSource(tx)}</td>
                        <td className="px-4 py-3 font-bold whitespace-nowrap">{getTxDisplayLabel(tx)}</td>
                        <td className="px-4 py-3 text-xs font-bold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">{getTxDest(tx)}</td>
                        <td className="px-4 py-3 text-xs text-slate-500 max-w-[150px] truncate" title={getTxDisplayNotes(tx)}>{getTxDisplayNotes(tx)}</td>
                        <td className={`px-4 py-3 font-black whitespace-nowrap ${Number(tx.amount) >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>{parseFloat(tx.amount).toLocaleString()} {currencySymbol}</td>
                        <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">{tx.created_by_name || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="p-10 text-center text-slate-400 font-bold">لا توجد معاملات مالية في هذه الفترة</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Treasury Detail Modal */}
      {isDetailModalOpen && selectedTreasury && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-2xl rounded-[2.5rem] shadow-2xl overflow-hidden border border-card card" style={{ backgroundColor: 'var(--card-bg)', color: 'var(--text)' }}>
            <div className="p-6 border-b dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50">
              <h3 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2"><Landmark className="text-blue-500" /> كشف حركة الخزينة: {selectedTreasury.name}</h3>
              <div>
                <button onClick={printTreasuryReport} className="text-slate-400 hover:text-blue-500 transition-colors p-2 rounded-full mr-2" title="طباعة التقرير"><Printer size={20} /></button>
                <button onClick={() => setIsDetailModalOpen(false)} className="text-slate-400 hover:text-rose-500 transition-colors p-2 rounded-full"><X size={24} /></button>
              </div>
            </div>
            <div className="p-8 text-right space-y-4">
               <div className="flex items-center gap-3 justify-between">
                 <div className="flex items-center gap-2">
                   <label className="text-xs font-bold text-slate-500">من</label>
                   <input type="date" value={detailStartDate} onChange={e=>setDetailStartDate(e.target.value)} className="bg-slate-50 dark:bg-slate-900 border-none rounded-xl py-2 px-3 text-sm" />
                   <label className="text-xs font-bold text-slate-500">إلى</label>
                   <input type="date" value={detailEndDate} onChange={e=>setDetailEndDate(e.target.value)} className="bg-slate-50 dark:bg-slate-900 border-none rounded-xl py-2 px-3 text-sm" />
                   <button onClick={() => selectedTreasury && loadTreasuryTransactions(selectedTreasury.id, detailStartDate, detailEndDate)} className="px-3 py-2 bg-blue-600 text-white rounded-xl text-sm font-black">تحديث</button>
                 </div>
               </div>
               <div className="bg-blue-50 dark:bg-blue-900/20 p-6 rounded-2xl flex justify-between items-center">
                   <span className="font-bold text-slate-600 dark:text-slate-400">الرصيد الدفتري الحالي</span>
                  <span className="text-2xl font-black text-blue-600">{selectedTreasury.balance.toLocaleString()} {currencySymbol}</span>
               </div>
               <div className="border rounded-2xl overflow-hidden dark:border-slate-700 max-h-96 overflow-y-auto">
                  {isTransactionsLoading ? (
                    <div className="p-10 text-center text-slate-400">جاري تحميل السجل...</div>
                  ) : treasuryTransactions.length > 0 ? (
                      <table className="w-full text-right text-sm">
                          <thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-500 dark:text-slate-400 sticky top-0">
                              <tr>
                                  <th className="px-4 py-3 font-bold">التاريخ والوقت</th>
                                  <th className="px-4 py-3 font-bold">نوع العملية</th>
                                  <th className="px-4 py-3 font-bold">البيان/السبب</th>
                                  <th className="px-4 py-3 font-bold">المبلغ</th>
                              </tr>
                          </thead>
                          <tbody className="divide-y dark:divide-slate-700">
                              {treasuryTransactions.map(tx => (
                                  <tr key={tx.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                                      <td className="px-4 py-3 text-xs">{new Date(tx.transaction_date).toLocaleString('ar-EG')}</td>
                                      <td className="px-4 py-3 font-bold">{getTxDisplayLabel(tx)}</td>
                                      <td className="px-4 py-3 text-xs">{getTxDisplayNotes(tx)}</td>
                                      <td className={`px-4 py-3 font-black ${tx.amount >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>{parseFloat(tx.amount).toLocaleString()} {currencySymbol}</td>
                                  </tr>
                              ))}
                          </tbody>
                      </table>
                  ) : (
                    <div className="p-10 text-center text-slate-400 text-xs italic">لا توجد عمليات مسجلة في سجل هذه الخزينة.</div>
                  )}
               </div>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Treasury Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-slate-800 w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden border dark:border-slate-700">
            <div className="p-6 border-b dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50">
              <h3 className="text-lg font-black text-slate-900 dark:text-white">{editingTreasury ? 'تعديل بيانات الخزينة' : 'إنشاء خزينة جديدة'}</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-rose-500 transition-colors"><X size={24} /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-8 space-y-6 text-right">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 mr-2">اسم الخزينة / الحساب البنكي</label>
                <input 
                  type="text" 
                  required
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                  className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl py-3 px-4 text-sm focus:ring-2 ring-blue-500/20 text-slate-900 dark:text-white"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 mr-2">نوع الحساب</label>
                <CustomSelect
                  value={formData.type}
                  onChange={v => setFormData({...formData, type: v})}
                  options={[{ value: 'نقدي', label: 'نقدي (كاش)' }, { value: 'بنكي', label: 'حساب بنكي' }, { value: 'محفظة', label: 'محفظة إلكترونية' }]}
                  className="w-full"
                />
              </div>
              <button 
                type="submit"
                className="w-full bg-blue-600 text-white py-4 rounded-2xl font-black shadow-xl shadow-blue-500/30 hover:bg-blue-700 transition-all flex items-center justify-center gap-2"
              >
                <Save size={18} /> {editingTreasury ? 'تحديث البيانات' : 'تفعيل الخزينة'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Transaction Modal */}
      {isTransactionModalOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-lg rounded-[2.5rem] shadow-2xl border border-card card flex flex-col max-h-[90vh]" style={{ backgroundColor: 'var(--card-bg)', color: 'var(--text)' }}>
            <div className="p-6 border-b dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50 flex-shrink-0">
              <h3 className="text-lg font-black text-slate-900 dark:text-white">
                {modalType === 'deposit' && 'إضافة إيداع جديد'}
                {modalType === 'expense' && 'إضافة مصروف جديد'}
                {modalType === 'transfer' && 'تحويل بين الخزائن'}
              </h3>
              <button onClick={closeTransactionModal} className="text-slate-400 hover:text-rose-500"><X size={24} /></button>
            </div>
            <form onSubmit={handleTransactionSubmit} className="p-8 space-y-4 text-right overflow-y-auto flex-1">
              {/* Deposit Form */}
              {modalType === 'deposit' && (
                <>
                  <div><label className="text-xs font-bold text-slate-500">المبلغ</label><input type="number" required value={depositData.amount} onChange={e => setDepositData({...depositData, amount: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-xl py-3 px-4 text-sm mt-1" /></div>
                  <div>
                    <label className="text-xs font-bold text-slate-500">إلى خزينة</label>
                    <CustomSelect
                      required
                      value={depositData.treasury_id}
                      onChange={v => setDepositData({...depositData, treasury_id: v})}
                      options={[{ value: '', label: 'اختر خزينة' }, ...treasuries.map((t:any) => ({ value: String(t.id), label: t.name }))]}
                      className="w-full"
                    />
                  </div>
                  <div><label className="text-xs font-bold text-slate-500">السبب/البيان</label><input type="text" required value={depositData.notes} onChange={e => setDepositData({...depositData, notes: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-xl py-3 px-4 text-sm mt-1" /></div>
                </>
              )}
              {/* Expense Form */}
              {modalType === 'expense' && (
                <>
                  <div><label className="text-xs font-bold text-slate-500">المبلغ</label><input type="number" required value={expenseData.amount} onChange={e => setExpenseData({...expenseData, amount: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-xl py-3 px-4 text-sm mt-1" /></div>
                  <div>
                    <label className="text-xs font-bold text-slate-500">من خزينة</label>
                    <CustomSelect
                      required
                      value={expenseData.treasury_id}
                      onChange={v => setExpenseData({...expenseData, treasury_id: v})}
                      options={[{ value: '', label: 'اختر خزينة' }, ...treasuries.map((t:any) => ({ value: String(t.id), label: `${t.name} (متاح: ${t.balance.toLocaleString()})` }))]}
                      className="w-full"
                    />
                  </div>
                  <div><label className="text-xs font-bold text-slate-500">السبب/البيان</label><input type="text" required value={expenseData.notes} onChange={e => setExpenseData({...expenseData, notes: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-xl py-3 px-4 text-sm mt-1" /></div>
                </>
              )}
              {/* Transfer Form */}
              {modalType === 'transfer' && (
                <>
                  <div><label className="text-xs font-bold text-slate-500">المبلغ المحول</label><input type="number" required value={transferData.amount} onChange={e => setTransferData({...transferData, amount: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-xl py-3 px-4 text-sm mt-1" /></div>
                  <div>
                    <label className="text-xs font-bold text-slate-500">من خزينة</label>
                    <CustomSelect
                      required
                      value={transferData.from_treasury_id}
                      onChange={v => setTransferData({...transferData, from_treasury_id: v})}
                      options={[{ value: '', label: 'اختر المصدر' }, ...treasuries.map((t:any) => ({ value: String(t.id), label: `${t.name} (متاح: ${t.balance.toLocaleString()})` }))]}
                      className="w-full"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500">إلى خزينة</label>
                    <CustomSelect
                      required
                      value={transferData.to_treasury_id}
                      onChange={v => setTransferData({...transferData, to_treasury_id: v})}
                      options={[{ value: '', label: 'اختر الوجهة' }, ...treasuries.filter((t:any) => String(t.id) !== transferData.from_treasury_id).map((t:any) => ({ value: String(t.id), label: t.name }))]}
                      className="w-full"
                    />
                  </div>
                  <div><label className="text-xs font-bold text-slate-500">السبب/البيان</label><input type="text" required value={transferData.notes} onChange={e => setTransferData({...transferData, notes: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-xl py-3 px-4 text-sm mt-1" /></div>
                </>
              )}
              <button type="submit" className="w-full bg-blue-600 text-white py-4 rounded-2xl font-black shadow-xl shadow-blue-500/30 hover:bg-blue-700 transition-all">
                تنفيذ العملية
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};


export default FinanceModule;
