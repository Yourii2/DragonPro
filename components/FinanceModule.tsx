
import React, { useState, useEffect } from 'react';
import { Wallet, TrendingUp, TrendingDown, ArrowLeftRight, Landmark, Plus, Search, X, Save, Edit, Trash2, Eye, Coins, ArrowDown, ArrowUp, Truck, Printer } from 'lucide-react';
import Swal from 'sweetalert2';
import { API_BASE_PATH } from '../services/apiConfig';

interface FinanceModuleProps {
  initialView?: string;
}

const FinanceModule: React.FC<FinanceModuleProps> = ({ initialView = 'treasuries' }) => {
  const [activeTab, setActiveTab] = useState<'treasuries' | 'transactions' | 'accounts' | 'journal'>('treasuries');
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isTransactionModalOpen, setIsTransactionModalOpen] = useState(false);
  const [modalType, setModalType] = useState<'expense' | 'deposit' | 'payment' | 'transfer' | null>(null);

  // Form states
  const [expenseData, setExpenseData] = useState({ amount: '', treasury_id: '', notes: '' });
  const [depositData, setDepositData] = useState({ amount: '', treasury_id: '', notes: '' });
  const [paymentData, setPaymentData] = useState({ amount: '', treasury_id: '', supplier_id: '', notes: '' });
  const [transferData, setTransferData] = useState({ amount: '', from_treasury_id: '', to_treasury_id: '', notes: '' });

  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [editingTreasury, setEditingTreasury] = useState<any>(null);
  const [selectedTreasury, setSelectedTreasury] = useState<any>(null);
  const currencySymbol = 'ج.م';

  const [treasuries, setTreasuries] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [treasuryTransactions, setTreasuryTransactions] = useState<any[]>([]);
  const [isTransactionsLoading, setIsTransactionsLoading] = useState(false);
  const [suppliers, setSuppliers] = useState<any[]>([]);
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
          setPaymentData(prev => ({...prev, treasury_id: prev.treasury_id || d}));
          setTransferData(prev => ({...prev, from_treasury_id: prev.from_treasury_id || d}));
          setUserDefaults(defaults);
        }
      } catch (error) {
        console.error('Failed to fetch treasuries:', error);
      }
    };

    fetchTreasuries();

    const fetchSuppliers = async () => {
      try {
        const response = await fetch(`${API_BASE_PATH}/api.php?module=suppliers&action=getAll`);
        const result = await response.json();
        if (result.success) {
          setSuppliers(result.data || []);
        }
      } catch (error) {
        console.error('Failed to fetch suppliers:', error);
      }
    };

    fetchSuppliers();
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
            setPaymentData(prev => ({...prev, treasury_id: prev.treasury_id || d}));
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
    if (activeTab === 'accounts') fetchAccounts();
    if (activeTab === 'journal') fetchJournalEntries();
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

  const openTransactionModal = (type: 'expense' | 'deposit' | 'payment' | 'transfer') => {
    setModalType(type);
    setIsTransactionModalOpen(true);
  };

  const closeTransactionModal = () => {
    setIsTransactionModalOpen(false);
    setModalType(null);
    setExpenseData({ amount: '', treasury_id: '', notes: '' });
    setDepositData({ amount: '', treasury_id: '', notes: '' });
    setPaymentData({ amount: '', treasury_id: '', supplier_id: '', notes: '' });
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

  const handleViewDetails = async (treasury: any) => {
    setSelectedTreasury(treasury);
    setIsDetailModalOpen(true);
    setIsTransactionsLoading(true);
    setTreasuryTransactions([]); // Clear previous data
    try {
        const response = await fetch(`${API_BASE_PATH}/api.php?module=transactions&action=getByTreasuryId&id=${treasury.id}`);
        const result = await response.json();
        if (result.success) {
            setTreasuryTransactions(result.data || []);
        } else {
            console.error("Failed to fetch treasury transactions:", result.message);
            Swal.fire('خطأ', 'فشل في جلب سجل الخزينة.', 'error');
        }
    } catch (error) {
        console.error("Error fetching treasury transactions:", error);
        Swal.fire('خطأ', 'فشل الاتصال بالخادم.', 'error');
    } finally {
        setIsTransactionsLoading(false);
    }
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
        rep_payment_in: 'تحصيل من مندوب',
        rep_payment_out: 'دفعة لمندوب',
        rep_settlement: 'تسوية مندوب',
    };

    if (detailsJson) {
        try {
            const details = JSON.parse(detailsJson);
            if (details.subtype && labels[details.subtype]) {
                return labels[details.subtype];
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
                <td>${getTransactionTypeLabel(tx.type, tx.details)}</td>
                <td>${getTransactionNotes(tx.details)}</td>
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

    switch (modalType) {
      case 'expense':
        payload = { ...expenseData, type: 'expense', amount: -Math.abs(parseFloat(expenseData.amount)) };
        treasuryToCheck = treasuries.find(t => t.id == expenseData.treasury_id);
        amountToCheck = parseFloat(expenseData.amount);
        break;
      case 'deposit':
        payload = { ...depositData, type: 'deposit', amount: Math.abs(parseFloat(depositData.amount)) };
        break;
      case 'payment':
        payload = { ...paymentData, type: 'supplier_payment', amount: -Math.abs(parseFloat(paymentData.amount)), related_to_type: 'supplier', related_to_id: paymentData.supplier_id };
        treasuryToCheck = treasuries.find(t => t.id == paymentData.treasury_id);
        amountToCheck = parseFloat(paymentData.amount);
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
    if (modalType === 'payment') {
      if (!paymentData.treasury_id) { Swal.fire('اختر الخزينة', 'يرجى اختيار الخزينة للدفعة.', 'warning'); return; }
      if (!paymentData.notes || String(paymentData.notes).trim() === '') { Swal.fire('حدد البيان', 'يرجى إدخال سبب الدفعة في حقل الملاحظات.', 'warning'); return; }
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
        await fetchAllTreasuries(); // Refresh balances
        // Optionally, refresh transactions list if displayed
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
          <button 
            onClick={() => setActiveTab('accounts')} 
            className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${activeTab === 'accounts' ? 'bg-accent text-white shadow-md' : 'text-muted hover:bg-slate-50 dark:hover:bg-slate-700'}`}
          >
            شجرة الحسابات
          </button>
          <button 
            onClick={() => setActiveTab('journal')} 
            className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${activeTab === 'journal' ? 'bg-accent text-white shadow-md' : 'text-muted hover:bg-slate-50 dark:hover:bg-slate-700'}`}
          >
            قيود اليومية
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
              icon={Truck} 
              title="دفعة لمورد" 
              description="سداد مبلغ مستحق لمورد"
              onClick={() => openTransactionModal('payment')}
              colorClass="bg-gradient-to-br from-amber-500 to-orange-600 border-amber-600"
            />
            <ActionButton 
              icon={ArrowLeftRight} 
              title="تحويل بين الخزائن" 
              description="نقل رصيد من خزينة لأخرى"
              onClick={() => openTransactionModal('transfer')}
              colorClass="bg-gradient-to-br from-blue-500 to-indigo-600 border-blue-600"
            />
          </div>
        </div>
      )}

      {activeTab === 'accounts' && (
        <div className="space-y-4 animate-in fade-in duration-300">
          <div className="rounded-3xl border border-card shadow-sm overflow-hidden card" style={{ backgroundColor: 'var(--card-bg)', color: 'var(--text)' }}>
            <div className="p-4 border-b dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="relative flex-1 w-full max-w-md">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-muted w-4 h-4" />
                <input
                  type="text"
                  placeholder="بحث برمز أو اسم الحساب..."
                  className="w-full pr-10 pl-4 py-2.5 bg-white dark:bg-slate-900 border-none rounded-2xl text-sm focus:ring-2 ring-blue-500/20 text-slate-900 dark:text-white text-right"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <button
                onClick={() => openAccountModal()}
                className="w-full md:w-auto flex items-center justify-center gap-2 bg-accent text-white px-5 py-2.5 rounded-2xl text-sm font-black shadow-lg shadow-blue-500/20 active:scale-95 transition-all"
              >
                <Plus size={18} /> إضافة حساب
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-right text-sm">
                <thead className="bg-slate-50 dark:bg-slate-900/50 text-muted">
                  <tr>
                    <th className="px-6 py-4 font-bold">الكود</th>
                    <th className="px-6 py-4 font-bold">اسم الحساب</th>
                    <th className="px-6 py-4 font-bold">النوع</th>
                    <th className="px-6 py-4 font-bold">الأب</th>
                    <th className="px-6 py-4 font-bold text-center">الإجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y dark:divide-slate-700 text-slate-700 dark:text-slate-300">
                  {filteredAccounts.length > 0 ? filteredAccounts.map(a => (
                    <tr key={a.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                      <td className="px-6 py-4 font-bold">{a.code}</td>
                      <td className="px-6 py-4">{a.name}</td>
                      <td className="px-6 py-4 text-xs font-bold text-slate-500">{getAccountTypeLabel(a.type)}</td>
                      <td className="px-6 py-4 text-xs text-slate-500">{a.parent_name || '—'}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-center gap-2">
                          <button onClick={() => handleDeleteAccount(a.id)} className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-xl transition-all" title="حذف الحساب"><Trash2 size={16} /></button>
                          <button onClick={() => openAccountModal(a)} className="p-2 text-slate-400 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/30 rounded-xl transition-all" title="تعديل الحساب"><Edit size={16} /></button>
                        </div>
                      </td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={5} className="px-6 py-10 text-center text-slate-400 font-bold">لا توجد حسابات مطابقة</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'journal' && (
        <div className="space-y-4 animate-in fade-in duration-300">
          <div className="rounded-3xl border border-card shadow-sm overflow-hidden card" style={{ backgroundColor: 'var(--card-bg)', color: 'var(--text)' }}>
            <div className="p-4 border-b dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="text-sm text-slate-500 font-bold">إدارة قيود اليومية والترحيل</div>
              <div className="flex gap-2">
                <button
                  onClick={async () => {
                    if (accounts.length === 0) await fetchAccounts();
                    setJournalForm({ entry_date: new Date().toISOString().slice(0, 10), memo: '', posted: true });
                    setJournalLines([{ account_id: '', debit: '', credit: '', memo: '' }]);
                    setIsJournalModalOpen(true);
                  }}
                  className="flex items-center gap-2 bg-accent text-white px-5 py-2.5 rounded-2xl text-sm font-black shadow-lg shadow-blue-500/20 active:scale-95 transition-all"
                >
                  <Plus size={18} /> قيد جديد
                </button>
                <button
                  onClick={fetchJournalEntries}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-black border border-card"
                >
                  تحديث
                </button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-right text-sm">
                <thead className="bg-slate-50 dark:bg-slate-900/50 text-muted">
                  <tr>
                    <th className="px-6 py-4 font-bold">رقم</th>
                    <th className="px-6 py-4 font-bold">التاريخ</th>
                    <th className="px-6 py-4 font-bold">البيان</th>
                    <th className="px-6 py-4 font-bold">الحالة</th>
                    <th className="px-6 py-4 font-bold text-center">الإجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y dark:divide-slate-700 text-slate-700 dark:text-slate-300">
                  {journalEntries.length > 0 ? journalEntries.map(j => (
                    <tr key={j.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                      <td className="px-6 py-4 font-bold">{j.id}</td>
                      <td className="px-6 py-4 text-xs">{j.entry_date}</td>
                      <td className="px-6 py-4">{j.memo || '—'}</td>
                      <td className="px-6 py-4 text-xs font-bold">{Number(j.posted) === 1 ? 'مرحّل' : 'غير مرحّل'}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-center gap-2">
                          <button onClick={() => handleViewJournal(j)} className="p-2 text-slate-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-xl transition-all" title="عرض القيد"><Eye size={16} /></button>
                          {Number(j.posted) !== 1 && (
                            <button onClick={() => handlePostJournal(j.id)} className="p-2 text-slate-400 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-xl transition-all" title="ترحيل القيد"><Save size={16} /></button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={5} className="px-6 py-10 text-center text-slate-400 font-bold">لا توجد قيود يومية</td>
                    </tr>
                  )}
                </tbody>
              </table>
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
                                      <td className="px-4 py-3 font-bold">{getTransactionTypeLabel(tx.type, tx.details)}</td>
                                      <td className="px-4 py-3 text-xs">{getTransactionNotes(tx.details)}</td>
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
                <select 
                  value={formData.type}
                  onChange={e => setFormData({...formData, type: e.target.value})}
                  className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl py-3 px-4 text-sm focus:ring-2 ring-blue-500/20 text-slate-900 dark:text-white"
                >
                  <option value="نقدي">نقدي (كاش)</option>
                  <option value="بنكي">حساب بنكي</option>
                  <option value="محفظة">محفظة إلكترونية</option>
                </select>
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
          <div className="w-full max-w-lg rounded-[2.5rem] shadow-2xl border border-card card" style={{ backgroundColor: 'var(--card-bg)', color: 'var(--text)' }}>
            <div className="p-6 border-b dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50">
              <h3 className="text-lg font-black text-slate-900 dark:text-white">
                {modalType === 'deposit' && 'إضافة إيداع جديد'}
                {modalType === 'expense' && 'إضافة مصروف جديد'}
                {modalType === 'payment' && 'تسجيل دفعة لمورد'}
                {modalType === 'transfer' && 'تحويل بين الخزائن'}
              </h3>
              <button onClick={closeTransactionModal} className="text-slate-400 hover:text-rose-500"><X size={24} /></button>
            </div>
            <form onSubmit={handleTransactionSubmit} className="p-8 space-y-4 text-right">
              {/* Deposit Form */}
              {modalType === 'deposit' && (
                <>
                  <div><label className="text-xs font-bold text-slate-500">المبلغ</label><input type="number" required value={depositData.amount} onChange={e => setDepositData({...depositData, amount: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-xl py-3 px-4 text-sm mt-1" /></div>
                  <div><label className="text-xs font-bold text-slate-500">إلى خزينة</label><select required value={depositData.treasury_id} onChange={e => setDepositData({...depositData, treasury_id: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-xl py-3 px-4 text-sm mt-1"><option value="">اختر خزينة</option>{treasuries.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></div>
                  <div><label className="text-xs font-bold text-slate-500">السبب/البيان</label><input type="text" required value={depositData.notes} onChange={e => setDepositData({...depositData, notes: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-xl py-3 px-4 text-sm mt-1" /></div>
                </>
              )}
              {/* Expense Form */}
              {modalType === 'expense' && (
                <>
                  <div><label className="text-xs font-bold text-slate-500">المبلغ</label><input type="number" required value={expenseData.amount} onChange={e => setExpenseData({...expenseData, amount: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-xl py-3 px-4 text-sm mt-1" /></div>
                  <div><label className="text-xs font-bold text-slate-500">من خزينة</label><select required value={expenseData.treasury_id} onChange={e => setExpenseData({...expenseData, treasury_id: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-xl py-3 px-4 text-sm mt-1"><option value="">اختر خزينة</option>{treasuries.map(t => <option key={t.id} value={t.id}>{t.name} (متاح: {t.balance.toLocaleString()})</option>)}</select></div>
                  <div><label className="text-xs font-bold text-slate-500">السبب/البيان</label><input type="text" required value={expenseData.notes} onChange={e => setExpenseData({...expenseData, notes: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-xl py-3 px-4 text-sm mt-1" /></div>
                </>
              )}
              {/* Supplier Payment Form */}
              {modalType === 'payment' && (
                <>
                  <div><label className="text-xs font-bold text-slate-500">المبلغ المدفوع</label><input type="number" required value={paymentData.amount} onChange={e => setPaymentData({...paymentData, amount: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-xl py-3 px-4 text-sm mt-1" /></div>
                  <div><label className="text-xs font-bold text-slate-500">من خزينة</label><select required value={paymentData.treasury_id} onChange={e => setPaymentData({...paymentData, treasury_id: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-xl py-3 px-4 text-sm mt-1"><option value="">اختر خزينة</option>{treasuries.map(t => <option key={t.id} value={t.id}>{t.name} (متاح: {t.balance.toLocaleString()})</option>)}</select></div>
                  <div><label className="text-xs font-bold text-slate-500">إلى المورد</label><select required value={paymentData.supplier_id} onChange={e => setPaymentData({...paymentData, supplier_id: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-xl py-3 px-4 text-sm mt-1"><option value="">اختر مورد</option>{suppliers.map(s => <option key={s.id} value={s.id}>{s.name} (رصيده: {s.balance?.toLocaleString() || 0})</option>)}</select></div>
                  <div><label className="text-xs font-bold text-slate-500">ملاحظات</label><input type="text" value={paymentData.notes} onChange={e => setPaymentData({...paymentData, notes: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-xl py-3 px-4 text-sm mt-1" /></div>
                </>
              )}
              {/* Transfer Form */}
              {modalType === 'transfer' && (
                <>
                  <div><label className="text-xs font-bold text-slate-500">المبلغ المحول</label><input type="number" required value={transferData.amount} onChange={e => setTransferData({...transferData, amount: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-xl py-3 px-4 text-sm mt-1" /></div>
                  <div className="grid grid-cols-2 gap-4">
                    <div><label className="text-xs font-bold text-slate-500">من خزينة</label><select required value={transferData.from_treasury_id} onChange={e => setTransferData({...transferData, from_treasury_id: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-xl py-3 px-4 text-sm mt-1"><option value="">اختر المصدر</option>{treasuries.map(t => <option key={t.id} value={t.id}>{t.name} (متاح: {t.balance.toLocaleString()})</option>)}</select></div>
                    <div><label className="text-xs font-bold text-slate-500">إلى خزينة</label><select required value={transferData.to_treasury_id} onChange={e => setTransferData({...transferData, to_treasury_id: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-xl py-3 px-4 text-sm mt-1"><option value="">اختر الوجهة</option>{treasuries.filter(t => t.id != transferData.from_treasury_id).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></div>
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

      {isAccountModalOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-slate-800 w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden border dark:border-slate-700">
            <div className="p-6 border-b dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50">
              <h3 className="text-lg font-black text-slate-900 dark:text-white">{editingAccount ? 'تعديل حساب' : 'إضافة حساب جديد'}</h3>
              <button onClick={() => setIsAccountModalOpen(false)} className="text-slate-400 hover:text-rose-500 transition-colors"><X size={24} /></button>
            </div>
            <form onSubmit={handleSaveAccount} className="p-8 space-y-4 text-right">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-500">الكود</label>
                  <input
                    type="text"
                    required
                    value={accountForm.code}
                    onChange={e => setAccountForm({ ...accountForm, code: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-xl py-3 px-4 text-sm mt-1"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500">النوع</label>
                  <select
                    value={accountForm.type}
                    onChange={e => setAccountForm({ ...accountForm, type: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-xl py-3 px-4 text-sm mt-1"
                  >
                    <option value="asset">أصل</option>
                    <option value="liability">التزام</option>
                    <option value="equity">حقوق ملكية</option>
                    <option value="income">إيراد</option>
                    <option value="expense">مصروف</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500">اسم الحساب</label>
                <input
                  type="text"
                  required
                  value={accountForm.name}
                  onChange={e => setAccountForm({ ...accountForm, name: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-xl py-3 px-4 text-sm mt-1"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500">الحساب الأب (اختياري)</label>
                <select
                  value={accountForm.parent_id}
                  onChange={e => setAccountForm({ ...accountForm, parent_id: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-xl py-3 px-4 text-sm mt-1"
                >
                  <option value="">بدون</option>
                  {accounts.filter(a => !editingAccount || a.id !== editingAccount.id).map(a => (
                    <option key={a.id} value={a.id}>{a.code} - {a.name}</option>
                  ))}
                </select>
              </div>
              <button type="submit" className="w-full bg-blue-600 text-white py-4 rounded-2xl font-black shadow-xl shadow-blue-500/30 hover:bg-blue-700 transition-all flex items-center justify-center gap-2">
                <Save size={18} /> حفظ الحساب
              </button>
            </form>
          </div>
        </div>
      )}

      {isJournalModalOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-3xl rounded-[2.5rem] shadow-2xl border border-card card" style={{ backgroundColor: 'var(--card-bg)', color: 'var(--text)' }}>
            <div className="p-6 border-b dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50">
              <h3 className="text-lg font-black text-slate-900 dark:text-white">إضافة قيد يومية</h3>
              <button onClick={() => setIsJournalModalOpen(false)} className="text-slate-400 hover:text-rose-500"><X size={24} /></button>
            </div>
            <form onSubmit={handleCreateJournal} className="p-8 space-y-4 text-right">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-500">تاريخ القيد</label>
                  <input
                    type="date"
                    required
                    value={journalForm.entry_date}
                    onChange={e => setJournalForm({ ...journalForm, entry_date: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-xl py-3 px-4 text-sm mt-1"
                  />
                </div>
                <div className="col-span-2">
                  <label className="text-xs font-bold text-slate-500">البيان</label>
                  <input
                    type="text"
                    value={journalForm.memo}
                    onChange={e => setJournalForm({ ...journalForm, memo: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-xl py-3 px-4 text-sm mt-1"
                  />
                </div>
              </div>
              <label className="flex items-center gap-2 text-xs font-bold text-slate-500">
                <input
                  type="checkbox"
                  checked={journalForm.posted}
                  onChange={e => setJournalForm({ ...journalForm, posted: e.target.checked })}
                />
                ترحيل تلقائي بعد الحفظ
              </label>

              <div className="border rounded-2xl overflow-hidden dark:border-slate-700">
                <table className="w-full text-right text-sm">
                  <thead className="bg-slate-50 dark:bg-slate-900/50 text-muted">
                    <tr>
                      <th className="px-4 py-3 font-bold">الحساب</th>
                      <th className="px-4 py-3 font-bold">مدين</th>
                      <th className="px-4 py-3 font-bold">دائن</th>
                      <th className="px-4 py-3 font-bold">ملاحظة</th>
                      <th className="px-4 py-3 font-bold text-center">إزالة</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y dark:divide-slate-700">
                    {journalLines.map((line, idx) => (
                      <tr key={idx}>
                        <td className="px-4 py-3">
                          <select
                            value={line.account_id}
                            onChange={e => updateJournalLine(idx, 'account_id', e.target.value)}
                            className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-xl py-2 px-3 text-sm"
                          >
                            <option value="">اختر الحساب</option>
                            {accounts.map(a => (
                              <option key={a.id} value={a.id}>{a.code} - {a.name}</option>
                            ))}
                          </select>
                        </td>
                        <td className="px-4 py-3">
                          <input
                            type="number"
                            value={line.debit}
                            onChange={e => updateJournalLine(idx, 'debit', e.target.value)}
                            className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-xl py-2 px-3 text-sm"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <input
                            type="number"
                            value={line.credit}
                            onChange={e => updateJournalLine(idx, 'credit', e.target.value)}
                            className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-xl py-2 px-3 text-sm"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <input
                            type="text"
                            value={line.memo}
                            onChange={e => updateJournalLine(idx, 'memo', e.target.value)}
                            className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-xl py-2 px-3 text-sm"
                          />
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button type="button" onClick={() => removeJournalLine(idx)} className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-xl transition-all">
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="p-4 flex items-center justify-between">
                  <button type="button" onClick={addJournalLine} className="flex items-center gap-2 px-4 py-2 rounded-2xl text-sm font-black border border-card">
                    <Plus size={16} /> إضافة سطر
                  </button>
                  <div className="text-xs text-slate-500 font-bold">
                    الإجمالي: مدين {journalTotals.debit.toLocaleString()} | دائن {journalTotals.credit.toLocaleString()}
                  </div>
                </div>
              </div>
              <button type="submit" className="w-full bg-blue-600 text-white py-4 rounded-2xl font-black shadow-xl shadow-blue-500/30 hover:bg-blue-700 transition-all">
                حفظ القيد
              </button>
            </form>
          </div>
        </div>
      )}

      {isJournalDetailOpen && selectedJournalEntry && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-3xl rounded-[2.5rem] shadow-2xl border border-card card" style={{ backgroundColor: 'var(--card-bg)', color: 'var(--text)' }}>
            <div className="p-6 border-b dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50">
              <h3 className="text-lg font-black text-slate-900 dark:text-white">تفاصيل القيد #{selectedJournalEntry.id}</h3>
              <button onClick={() => setIsJournalDetailOpen(false)} className="text-slate-400 hover:text-rose-500"><X size={24} /></button>
            </div>
            <div className="p-8 space-y-4 text-right">
              <div className="grid grid-cols-3 gap-4 text-xs text-slate-500 font-bold">
                <div>التاريخ: <span className="text-slate-700 dark:text-slate-200">{selectedJournalEntry.entry_date}</span></div>
                <div>الحالة: <span className="text-slate-700 dark:text-slate-200">{Number(selectedJournalEntry.posted) === 1 ? 'مرحّل' : 'غير مرحّل'}</span></div>
                <div>البيان: <span className="text-slate-700 dark:text-slate-200">{selectedJournalEntry.memo || '—'}</span></div>
              </div>
              <div className="border rounded-2xl overflow-hidden dark:border-slate-700">
                <table className="w-full text-right text-sm">
                  <thead className="bg-slate-50 dark:bg-slate-900/50 text-muted">
                    <tr>
                      <th className="px-4 py-3 font-bold">الحساب</th>
                      <th className="px-4 py-3 font-bold">مدين</th>
                      <th className="px-4 py-3 font-bold">دائن</th>
                      <th className="px-4 py-3 font-bold">ملاحظة</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y dark:divide-slate-700">
                    {selectedJournalLines.map((line: any) => (
                      <tr key={line.id}>
                        <td className="px-4 py-3">{line.account_code ? `${line.account_code} - ${line.account_name}` : line.account_name}</td>
                        <td className="px-4 py-3">{Number(line.debit || 0).toLocaleString()}</td>
                        <td className="px-4 py-3">{Number(line.credit || 0).toLocaleString()}</td>
                        <td className="px-4 py-3">{line.memo || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};


export default FinanceModule;
