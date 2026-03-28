
import React, { useState, useEffect } from 'react';
import CustomSelect from './CustomSelect';
import { Briefcase, CreditCard, UserCheck, Calendar, Search, Plus, X, Save, Edit, Trash2, Eye, User, FileText } from 'lucide-react';
import Swal from 'sweetalert2';
import { API_BASE_PATH } from '../services/apiConfig';
import AttendanceModule from './AttendanceModule';
import EmployeeSalaryReport from './EmployeeSalaryReport';

interface HRMModuleProps {
  initialView?: string;
}

const HRMModule: React.FC<HRMModuleProps> = ({ initialView }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<any>(null);
  const [selectedEmployee, setSelectedEmployee] = useState<any>(null);
  const currencySymbol = 'ج.م';

  const [employees, setEmployees] = useState<any[]>([]);
  const [treasuries, setTreasuries] = useState<any[]>([]);
  const [devices, setDevices] = useState<any[]>([]);

  const [formData, setFormData] = useState({
    name: '',
    jobTitle: '',
    salary: '',
    phone: '',
    hireDate: '',
    fingerprintDeviceId: '',
    fingerprintUserId: ''
  });

  const [view, setView] = useState<'list' | 'salaries' | 'transactions' | 'attendance' | 'salary-report'>('list');
  const [attendanceTab, setAttendanceTab] = useState<string>('devices');

  useEffect(() => {
    fetchEmployees();
    fetchTreasuries();
    fetchDevices();
  }, []);
  const fetchDevices = async () => {
    try {
      const response = await fetch(`${API_BASE_PATH}/api.php?module=attendance_devices&action=getAll`);
      const result = await response.json();
      if (result.success) {
        setDevices(result.data || []);
      }
    } catch (error) {
      console.error('Failed to fetch devices', error);
    }
  };

  useEffect(() => {
    if (initialView === 'salaries') {
      setView('salaries');
    } else if (initialView === 'loans') {
      setView('transactions');
    } else if (initialView === 'salary-report') {
      setView('salary-report');
    } else if (initialView && initialView.startsWith('attendance')) {
      setView('attendance');
      const parts = initialView.split(':');
      setAttendanceTab(parts[1] || 'devices');
    } else {
      setView('list');
    }
  }, [initialView]);


  const fetchEmployees = async () => {
    try {
      const response = await fetch(`${API_BASE_PATH}/api.php?module=employees&action=getAll`);
      const result = await response.json();
      if (result.success) {
        setEmployees(result.data);
      } else {
        Swal.fire('خطأ', 'فشل جلب بيانات الموظفين: ' + result.message, 'error');
      }
    } catch (error) {
      Swal.fire('خطأ', 'لا يمكن الاتصال بالخادم لجلب الموظفين.', 'error');
      console.error('Fetch employees error:', error);
    }
  };

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
    } catch (error) {
      console.error('فشل جلب الخزائن', error);
    }
  };


  const handleOpenModal = (employee: any = null) => {
    if (employee) {
      setEditingEmployee(employee);
      setFormData({
        name: employee.name,
        jobTitle: employee.job_title,
        salary: employee.salary.toString(),
        phone: employee.phone,
        hireDate: employee.hire_date,
        fingerprintDeviceId: employee.fingerprint_device_id ? String(employee.fingerprint_device_id) : '',
        fingerprintUserId: employee.fingerprint_user_id || ''
      });
    } else {
      setEditingEmployee(null);
      setFormData({
        name: '',
        jobTitle: '',
        salary: '',
        phone: '',
        hireDate: new Date().toISOString().split('T')[0],
        fingerprintDeviceId: '',
        fingerprintUserId: ''
      });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) return;

    const url = editingEmployee 
      ? `${API_BASE_PATH}/api.php?module=employees&action=update` 
      : `${API_BASE_PATH}/api.php?module=employees&action=create`;
    
    const { jobTitle, hireDate, fingerprintDeviceId, fingerprintUserId, ...rest } = formData;
    const payload = {
      ...rest,
      job_title: jobTitle,
      hire_date: hireDate,
      fingerprint_device_id: fingerprintDeviceId ? Number(fingerprintDeviceId) : null,
      fingerprint_user_id: fingerprintUserId || null,
      ...(editingEmployee && { id: editingEmployee.id })
    };

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const result = await response.json();

      if (result.success) {
        const employeeId = editingEmployee ? editingEmployee.id : result.data?.id;
        if (employeeId && fingerprintDeviceId && fingerprintUserId) {
          try {
            await fetch(`${API_BASE_PATH}/api.php?module=attendance_device_users&action=setForEmployee`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                employee_id: employeeId,
                device_id: Number(fingerprintDeviceId),
                device_user_id: fingerprintUserId
              })
            });
          } catch (e) {
            // ignore linkage errors
          }
        }
        Swal.fire('نجاح', editingEmployee ? 'تم تحديث بيانات الموظف بنجاح' : 'تمت إضافة الموظف بنجاح', 'success');
        setIsModalOpen(false);
        fetchEmployees(); // Refetch data
      } else {
        Swal.fire('خطأ', `فشلت العملية: ${result.message}`, 'error');
      }
    } catch (error) {
      Swal.fire('خطأ', 'لا يمكن الاتصال بالخادم.', 'error');
      console.error('Submit employee error:', error);
    }
  };

  const handleDelete = (id: number) => {
    const employee = employees.find(e => e.id === id);
    if (!employee) return;

    Swal.fire({
      title: 'تأكيد الحذف',
      text: `هل أنت متأكد من حذف الموظف "${employee.name}" من سجلات المؤسسة؟`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'نعم، احذفه',
      cancelButtonText: 'إلغاء'
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          const response = await fetch(`${API_BASE_PATH}/api.php?module=employees&action=delete`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: id })
          });
          const res = await response.json();
          if (res.success) {
            Swal.fire('تم الحذف!', `تم حذف بيانات الموظف "${employee.name}" بنجاح.`, 'success');
            fetchEmployees();
          } else {
            Swal.fire('فشل الحذف', res.message || 'فشل حذف الموظف', 'error');
          }
        } catch (err) {
          Swal.fire('خطأ في الاتصال', 'فشل الاتصال بالخادم.', 'error');
          console.error('Delete employee error:', err);
        }
      }
    });
  };

  const handleViewDetails = (employee: any) => {
    setSelectedEmployee(employee);
    setIsDetailModalOpen(true);
  };

  const filteredEmployees = employees.filter(emp => 
    (emp.name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) || 
    (emp.phone || '').includes(searchTerm)
  );

  const renderContent = () => {
    switch (view) {
      case 'list':
        return <EmployeeList 
          employees={filteredEmployees} 
          onEdit={handleOpenModal} 
          onDelete={handleDelete}
          onViewDetails={handleViewDetails}
        />;
      case 'salaries':
        return <SalariesComponent treasuries={treasuries} />;
      case 'transactions':
        return <EmployeeTransactionsComponent treasuries={treasuries} employees={employees} />;
      case 'attendance':
        return <AttendanceModule initialTab={attendanceTab} />;
      case 'salary-report':
        return <EmployeeSalaryReport employees={employees} />;
      default:
        return <EmployeeList 
          employees={filteredEmployees} 
          onEdit={handleOpenModal} 
          onDelete={handleDelete}
          onViewDetails={handleViewDetails}
        />;
    }
  }

  const EmployeeList = ({ employees, onEdit, onDelete, onViewDetails }: { employees: any[], onEdit: any, onDelete: any, onViewDetails: any }) => (
    <div className="rounded-3xl border border-card shadow-sm card" style={{ backgroundColor: 'var(--card-bg)', color: 'var(--text)' }}>
      <div className="p-6 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
        <div className="relative">
          <Search size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-muted" />
          <input
            type="text"
            placeholder="البحث عن موظف..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-64 bg-slate-50 dark:bg-slate-900 border-none rounded-2xl py-3 pr-10 pl-4 text-sm focus:ring-2 ring-blue-500/20"
          />
        </div>
        <button onClick={() => handleOpenModal()} className="flex items-center gap-2 bg-accent text-white px-5 py-3 rounded-2xl text-xs font-black shadow-xl shadow-blue-500/30 hover:bg-blue-700 transition-all">
          <Plus size={16} /> إضافة موظف جديد
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-right">
          <thead className="border-b border-slate-200 dark:border-slate-700 text-xs text-muted uppercase font-black">
            <tr>
              <th className="px-6 py-4">الاسم</th>
              <th className="px-6 py-4">المسمى الوظيفي</th>
              <th className="px-6 py-4">الراتب الأساسي</th>
              <th className="px-6 py-4">رقم الهاتف</th>
              <th className="px-6 py-4">تاريخ التعيين</th>
              <th className="px-6 py-4"></th>
            </tr>
          </thead>
          <tbody>
            {employees.map(emp => (
              <tr key={emp.id} className="border-b border-slate-200/50 dark:border-slate-700/50 hover:bg-slate-50/50 dark:hover:bg-slate-900/20 transition-colors">
                <td className="px-6 py-5 font-bold">{emp.name}</td>
                <td className="px-6 py-5 text-muted">{emp.job_title}</td>
                <td className="px-6 py-5 font-mono text-emerald-500">{parseFloat(emp.salary).toLocaleString()} {currencySymbol}</td>
                <td className="px-6 py-5 text-muted">{emp.phone}</td>
                <td className="px-6 py-5 text-muted">{emp.hire_date}</td>
                <td className="px-6 py-5">
                  <div className="flex gap-2">
                    <button onClick={() => onViewDetails(emp)} className="p-2 text-muted hover:text-blue-600 dark:hover:text-blue-400 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 transition-all"><Eye size={16} /></button>
                    <button onClick={() => onEdit(emp)} className="p-2 text-muted hover:text-amber-600 dark:hover:text-amber-400 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 transition-all"><Edit size={16} /></button>
                    <button onClick={() => onDelete(emp.id)} className="p-2 text-muted hover:text-rose-600 dark:hover:text-rose-400 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 transition-all"><Trash2 size={16} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {employees.length === 0 && (
          <div className="text-center py-20">
            <p className="font-bold text-muted">لا يوجد موظفين لعرضهم.</p>
            <p className="text-sm text-muted mt-2">قم بإضافة موظف جديد لبدء إدارة فريقك.</p>
          </div>
        )}
      </div>
    </div>
  );
  
  const SalariesComponent = ({ treasuries }: { treasuries: any[] }) => {
    const [salaries, setSalaries] = useState<any[]>([]);
    const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
    const [loading, setLoading] = useState(false);
    const [includeAttendance, setIncludeAttendance] = useState(true);
    const [generateAttendance, setGenerateAttendance] = useState(true);

    useEffect(() => {
      fetchSalaries(selectedMonth);
    }, [selectedMonth]);

    const fetchSalaries = async (month: string) => {
      setLoading(true);
      try {
        const response = await fetch(`${API_BASE_PATH}/api.php?module=employee_salaries&action=getForMonth&month=${month}`);
        const result = await response.json();
        if (result.success) {
          setSalaries(result.data);
        } else {
          Swal.fire('خطأ', 'فشل في جلب الرواتب: ' + result.message, 'error');
          setSalaries([]);
        }
      } catch (error) {
        Swal.fire('خطأ', 'لا يمكن الاتصال بالخادم لجلب الرواتب.', 'error');
      } finally {
        setLoading(false);
      }
    };

    const handleProcessPayroll = () => {
        Swal.fire({
            title: `تسوية رواتب شهر ${selectedMonth}`,
            text: "سيتم تسوية رواتب جميع الموظفين بناءً على السلف والخصومات. هل تريد المتابعة؟",
            icon: 'info',
            showCancelButton: true,
            confirmButtonText: 'نعم، قم بالتسوية',
            cancelButtonText: 'إلغاء'
        }).then(async (result) => {
            if (result.isConfirmed) {
                try {
                    const response = await fetch(`${API_BASE_PATH}/api.php?module=employee_salaries&action=processPayroll`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                month: selectedMonth,
                include_attendance: includeAttendance ? 1 : 0,
                generate_attendance: includeAttendance && generateAttendance ? 1 : 0
              })
                    });
                    const res = await response.json();
                    if (res.success) {
                        Swal.fire('تم!', 'تم تسوية الرواتب بنجاح.', 'success');
                        fetchSalaries(selectedMonth);
                    } else {
                        Swal.fire('فشل', res.message || 'فشلت عملية التسوية.', 'error');
                    }
                } catch (error) {
                    Swal.fire('خطأ', 'فشل الاتصال بالخادم.', 'error');
                }
            }
        });
    };
    
    const handlePay = (salaryId: number) => {
      const inputOptions = new Map(treasuries.map(t => [t.id, t.name]));
      Swal.fire({
        title: 'اختر خزينة الدفع',
        input: 'select',
        inputOptions,
        inputPlaceholder: 'اختر خزينة',
        showCancelButton: true,
        confirmButtonText: 'ادفع الآن',
        cancelButtonText: 'إلغاء',
        inputValidator: (value) => {
          if (!value) {
            return 'يجب اختيار خزينة!'
          }
          return null;
        }
      }).then(async (result) => {
        if(result.isConfirmed && result.value) {
          const treasury_id = result.value;
          try {
            const response = await fetch(`${API_BASE_PATH}/api.php?module=employee_salaries&action=pay`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ id: salaryId, treasury_id: treasury_id })
            });
            const res = await response.json();
            if (res.success) {
              Swal.fire('تم الدفع!', 'تم تسجيل عملية دفع الراتب بنجاح.', 'success');
              fetchSalaries(selectedMonth);
            } else {
              Swal.fire('فشل', res.message || 'فشلت عملية الدفع.', 'error');
            }
          } catch (error) {
             Swal.fire('خطأ', 'فشل الاتصال بالخادم.', 'error');
          }
        }
      });
    }

    return (
      <div className="rounded-3xl border border-card shadow-sm card" style={{ backgroundColor: 'var(--card-bg)', color: 'var(--text)' }}>
        <div className="p-6 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
          <h3 className="text-lg font-black text-slate-900 dark:text-white">كشوفات الرواتب</h3>
          <div className="flex items-center gap-4">
            <input 
              type="month"
              value={selectedMonth}
              onChange={e => setSelectedMonth(e.target.value)}
              className="bg-slate-50 dark:bg-slate-900 border-none rounded-2xl py-2 px-4 text-sm focus:ring-2 ring-blue-500/20"
            />
            <label className="flex items-center gap-2 text-xs">
              <input type="checkbox" checked={includeAttendance} onChange={e => setIncludeAttendance(e.target.checked)} />
              احتساب خصومات/حوافز الحضور
            </label>
            <label className={`flex items-center gap-2 text-xs ${includeAttendance ? '' : 'opacity-50'}`}>
              <input type="checkbox" checked={generateAttendance} disabled={!includeAttendance} onChange={e => setGenerateAttendance(e.target.checked)} />
              تحديث ملخص الحضور قبل التسوية
            </label>
            <button onClick={handleProcessPayroll} className="flex items-center gap-2 bg-emerald-600 text-white px-5 py-3 rounded-2xl text-xs font-black shadow-xl shadow-emerald-500/30 hover:bg-emerald-700 transition-all">
              تسوية رواتب الشهر
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-right">
            <thead className="border-b border-slate-200 dark:border-slate-700 text-xs text-muted uppercase font-black">
              <tr>
                <th className="px-6 py-4">الموظف</th>
                <th className="px-6 py-4">الراتب الأساسي</th>
                <th className="px-6 py-4">الخصومات</th>
                <th className="px-6 py-4">المكافآت</th>
                <th className="px-6 py-4">صافي الراتب</th>
                <th className="px-6 py-4">الحالة</th>
                <th className="px-6 py-4"></th>
              </tr>
            </thead>
            <tbody>
            {loading ? (
                <tr><td colSpan={7} className="text-center p-8">جاري تحميل البيانات...</td></tr>
            ) : salaries.length > 0 ? (
              salaries.map(s => (
                <tr key={s.id} className="border-b border-slate-200/50 dark:border-slate-700/50 hover:bg-slate-50/50 dark:hover:bg-slate-900/20 transition-colors">
                  <td className="px-6 py-5 font-bold">{s.employee_name}</td>
                  <td className="px-6 py-5">{parseFloat(s.base_salary).toLocaleString()} {currencySymbol}</td>
                  <td className="px-6 py-5 text-rose-500">{parseFloat(s.deductions).toLocaleString()} {currencySymbol}</td>
                  <td className="px-6 py-5 text-emerald-500">{parseFloat(s.bonuses).toLocaleString()} {currencySymbol}</td>
                  <td className="px-6 py-5 font-black text-blue-500">{parseFloat(s.net_salary).toLocaleString()} {currencySymbol}</td>
                  <td className="px-6 py-5">
                    <span className={`px-3 py-1 text-xs font-bold rounded-full ${s.status === 'paid' ? 'bg-emerald-100 dark:bg-emerald-900 text-emerald-600' : 'bg-amber-100 dark:bg-amber-900 text-amber-600'}`}>
                      {s.status === 'paid' ? 'مدفوع' : 'معلق'}
                    </span>
                  </td>
                  <td className="px-6 py-5">
                    <button onClick={() => handlePay(s.id)} disabled={s.status === 'paid'} className="bg-accent text-white px-4 py-2 rounded-lg text-xs font-bold disabled:bg-slate-300 dark:disabled:bg-slate-600">
                      دفع
                    </button>
                  </td>
                </tr>
              ))
            ) : (
                <tr><td colSpan={7} className="text-center p-8">لا توجد بيانات رواتب لهذا الشهر.</td></tr>
            )}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const EmployeeTransactionsComponent = ({ treasuries, employees }: { treasuries: any[], employees: any[] }) => {
    const [transactions, setTransactions] = useState<any[]>([]);
    const [isTransactionModalOpen, setIsTransactionModalOpen] = useState(false);
    const [newTransactionData, setNewTransactionData] = useState({ employee_id: '', amount: '', type: 'advance', date: new Date().toISOString().split('T')[0], notes: '', treasury_id: '' });
    
    const [financialSummary, setFinancialSummary] = useState<any>(null);
    const [isTransactionDetailModalOpen, setIsTransactionDetailModalOpen] = useState(false);
    const [selectedTransaction, setSelectedTransaction] = useState<any>(null);

    useEffect(() => {
      fetchTransactions();
    }, []);

    const handleViewTransaction = (transaction: any) => {
        setSelectedTransaction(transaction);
        setIsTransactionDetailModalOpen(true);
    };

    const fetchTransactions = async () => {
      try {
        const response = await fetch(`${API_BASE_PATH}/api.php?module=employee_transactions&action=getAll`);
        const result = await response.json();
        if (result.success) {
          const transactionsWithEmployeeNames = result.data.map((tx: any) => {
            const employee = employees.find(e => e.id === tx.employee_id);
            return {
              ...tx,
              employee_name: employee ? employee.name : 'موظف غير معروف'
            };
          });
          setTransactions(transactionsWithEmployeeNames);
        } else {
          Swal.fire('خطأ', 'فشل في جلب المعاملات: ' + result.message, 'error');
        }
      } catch (error) {
        Swal.fire('خطأ', 'لا يمكن الاتصال بالخادم لجلب المعاملات.', 'error');
      }
    };

    const handleEmployeeChange = async (employeeId: string) => {
        setNewTransactionData({ ...newTransactionData, employee_id: employeeId });
        if (employeeId) {
            try {
                const response = await fetch(`${API_BASE_PATH}/api.php?module=employees&action=getFinancialSummary&id=${employeeId}`);
                const result = await response.json();
                if (result.success) {
                    setFinancialSummary(result.data);
                } else {
                    setFinancialSummary(null);
                }
            } catch (error) {
                console.error('فشل جلب الملخص المالي', error);
                setFinancialSummary(null);
            }
        } else {
            setFinancialSummary(null);
        }
    };

    const handleAddTransaction = async (e: React.FormEvent) => {
      e.preventDefault();
      
      if (newTransactionData.type === 'advance') {
        if (!financialSummary) {
             Swal.fire('خطأ', 'يرجى تحديد موظف لعرض ملخصه المالي.', 'error');
             return;
        }
        if (parseFloat(newTransactionData.amount) > financialSummary.withdrawable_balance) {
            Swal.fire({
                icon: 'error',
                title: 'خطأ في المبلغ',
                text: `مبلغ السلفة المطلوب أكبر من الرصيد المتاح للسحب (${financialSummary.withdrawable_balance.toLocaleString()} ${currencySymbol})`,
            });
            return;
        }
      }

      try {
        const response = await fetch(`${API_BASE_PATH}/api.php?module=employee_transactions&action=create`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newTransactionData)
        });
        const result = await response.json();
        if(result.success) {
            Swal.fire('نجاح', 'تم حفظ المعاملة بنجاح.', 'success');
            setIsTransactionModalOpen(false);
            setFinancialSummary(null);
            fetchTransactions();
        } else {
            Swal.fire('خطأ', 'فشل حفظ المعاملة: ' + result.message, 'error');
        }
      } catch(error) {
        Swal.fire('خطأ', 'لا يمكن الاتصال بالخادم لحفظ المعاملة.', 'error');
      }
    };

    return (
      <div className="rounded-3xl border border-card shadow-sm card" style={{ backgroundColor: 'var(--card-bg)', color: 'var(--text)' }}>
        <div className="p-6 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
          <h3 className="text-lg font-black text-slate-900 dark:text-white">معاملات الموظفين</h3>
          <button onClick={() => setIsTransactionModalOpen(true)} className="flex items-center gap-2 bg-accent text-white px-5 py-3 rounded-2xl text-xs font-black shadow-xl shadow-blue-500/30 hover:bg-blue-700 transition-all">
            <Plus size={16} /> إضافة معاملة
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-right">
            <thead className="border-b border-slate-200 dark:border-slate-700 text-xs text-muted uppercase font-black">
              <tr>
                <th className="px-6 py-4">الموظف</th>
                <th className="px-6 py-4">المبلغ</th>
                <th className="px-6 py-4">النوع</th>
                <th className="px-6 py-4">التاريخ</th>
                <th className="px-6 py-4">ملاحظات</th>
                <th className="px-6 py-4"></th>
              </tr>
            </thead>
            <tbody>
              {transactions.map(tx => (
                <tr key={tx.id} className="border-b border-slate-200/50 dark:border-slate-700/50 hover:bg-slate-50/50 dark:hover:bg-slate-900/20 transition-colors">
                  <td className="px-6 py-5 font-bold">{tx.employee_name}</td>
                  <td className="px-6 py-5">{parseFloat(tx.amount).toLocaleString()} {currencySymbol}</td>
                  <td className="px-6 py-5">
                    {tx.type === 'advance' && 'سلفة'}
                    {tx.type === 'bonus' && 'حافز'}
                    {tx.type === 'penalty' && 'خصم'}
                  </td>
                  <td className="px-6 py-5">{tx.date}</td>
                  <td className="px-6 py-5">{tx.notes}</td>
                  <td className="px-6 py-5">
                     <button onClick={() => handleViewTransaction(tx)} className="p-2 text-muted hover:text-blue-600 rounded-full hover:bg-slate-100"><Eye size={16}/></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {isTransactionDetailModalOpen && selectedTransaction && (
            <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
                <div className="w-full max-w-lg rounded-3xl shadow-2xl border border-card card" style={{ backgroundColor: 'var(--card-bg)', color: 'var(--text)' }}>
                    <div className="p-6 border-b dark:border-slate-700 flex justify-between items-center">
                        <h3 className="text-lg font-black text-slate-900 dark:text-white">تفاصيل المعاملة</h3>
                        <button onClick={() => setIsTransactionDetailModalOpen(false)} className="text-muted hover:text-rose-500"><X size={24} /></button>
                    </div>
                    <div className="p-8 space-y-4 text-right">
                        <p><strong>الموظف:</strong> {selectedTransaction.employee_name}</p>
                        <p><strong>المبلغ:</strong> {parseFloat(selectedTransaction.amount).toLocaleString()} {currencySymbol}</p>
                        <p><strong>النوع:</strong> {selectedTransaction.type === 'advance' ? 'سلفة' : selectedTransaction.type === 'bonus' ? 'حافز' : 'خصم'}</p>
                        <p><strong>التاريخ:</strong> {selectedTransaction.date}</p>
                        <p><strong>ملاحظات:</strong> {selectedTransaction.notes || 'لا يوجد'}</p>
                    </div>
                </div>
            </div>
        )}

        {isTransactionModalOpen && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <div className="w-full max-w-lg rounded-3xl shadow-2xl border border-card card" style={{ backgroundColor: 'var(--card-bg)', color: 'var(--text)' }}>
              <div className="p-6 border-b dark:border-slate-700 flex justify-between items-center">
                <h3 className="text-lg font-black text-slate-900 dark:text-white">إضافة معاملة جديدة</h3>
                <button onClick={() => { setIsTransactionModalOpen(false); setFinancialSummary(null); }} className="text-muted hover:text-rose-500"><X size={24} /></button>
              </div>
              <form onSubmit={handleAddTransaction} className="p-8 space-y-4 text-right">
                <div>
                  <label className="text-xs font-bold text-muted mr-2">الموظف</label>
                  <CustomSelect
                    required
                    value={newTransactionData.employee_id}
                    onChange={v => handleEmployeeChange(v)}
                    options={[{ value: '', label: 'اختر موظف' }, ...employees.map((emp:any) => ({ value: String(emp.id), label: emp.name }))]}
                    className="w-full"
                  />
                </div>

                {financialSummary && (
                    <div className="p-4 bg-slate-100 dark:bg-slate-700 rounded-lg text-sm">
                        <div className="grid grid-cols-2 gap-2 text-center">
                            <div className='border-l dark:border-slate-600'>
                                <span className='text-xs text-muted'>الراتب الأساسي</span>
                                <p className='font-bold text-base'>{financialSummary.salary.toLocaleString()} {currencySymbol}</p>
                            </div>
                            <div>
                                <span className='text-xs text-muted'>صافي الراتب المتوقع</span>
                                <p className='font-bold text-base'>{financialSummary.projected_net_salary.toLocaleString()} {currencySymbol}</p>
                            </div>
                            <div className='border-l dark:border-slate-600'>
                                <span className='text-xs text-muted'>متاح للسحب</span>
                                <p className='font-bold text-base text-emerald-500'>{financialSummary.withdrawable_balance.toLocaleString()} {currencySymbol}</p>
                            </div>
                             <div>
                                <span className='text-xs text-muted'>إجمالي السلف</span>
                                <p className='font-bold text-base text-rose-500'>{financialSummary.withdrawn_this_month.toLocaleString()} {currencySymbol}</p>
                            </div>
                        </div>
                    </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="text-xs font-bold text-muted mr-2">المبلغ</label>
                        <input type="number" required value={newTransactionData.amount} onChange={e => setNewTransactionData({ ...newTransactionData, amount: e.target.value })} className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl py-3 px-4 text-sm" />
                    </div>
                    <div>
                        <label className="text-xs font-bold text-muted mr-2">التاريخ</label>
                        <input type="date" required value={newTransactionData.date} onChange={e => setNewTransactionData({ ...newTransactionData, date: e.target.value })} className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl py-3 px-4 text-sm" />
                    </div>
                </div>
                <div>
                  <label className="text-xs font-bold text-muted mr-2">النوع</label>
                  <CustomSelect
                    value={newTransactionData.type}
                    onChange={v => setNewTransactionData({ ...newTransactionData, type: v })}
                    options={[{ value: 'advance', label: 'سلفة' }, { value: 'bonus', label: 'حافز' }, { value: 'penalty', label: 'خصم' }]}
                    className="w-full"
                  />
                </div>
                {(newTransactionData.type === 'advance' || newTransactionData.type === 'bonus') && (
                  <div>
                    <label className="text-xs font-bold text-muted mr-2">الخزينة</label>
                    <CustomSelect
                      required
                      value={newTransactionData.treasury_id}
                      onChange={v => setNewTransactionData({ ...newTransactionData, treasury_id: v })}
                      options={[{ value: '', label: 'اختر خزينة' }, ...treasuries.map((t:any) => ({ value: String(t.id), label: t.name }))]}
                      className="w-full"
                    />
                  </div>
                )}
                <div>
                    <label className="text-xs font-bold text-muted mr-2">ملاحظات</label>
                    <textarea value={newTransactionData.notes} onChange={e => setNewTransactionData({ ...newTransactionData, notes: e.target.value })} className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl py-3 px-4 text-sm"></textarea>
                </div>
                <button type="submit" className="w-full bg-accent text-white py-4 rounded-2xl font-black">
                  حفظ
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center text-right">
        <div>
          <h2 className="text-xl font-black text-slate-900 dark:text-white">اداره الموظفين</h2>
          <p className="text-xs text-muted font-bold mt-1">إدارة الموظفين والرواتب</p>
        </div>
        <div className="flex gap-1 p-1.5 rounded-2xl border border-card shadow-sm card" style={{ backgroundColor: 'var(--card-bg)', color: 'var(--text)' }}>
          <button onClick={() => setView('list')} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all ${view === 'list' ? 'bg-accent text-white shadow-md' : 'text-muted hover:bg-slate-50 dark:hover:bg-slate-700'}`}><Briefcase size={16}/> الموظفين</button>
          <button onClick={() => setView('salaries')} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all ${view === 'salaries' ? 'bg-accent text-white shadow-md' : 'text-muted hover:bg-slate-50 dark:hover:bg-slate-700'}`}><CreditCard size={16}/> الرواتب</button>
          <button onClick={() => setView('transactions')} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all ${view === 'transactions' ? 'bg-accent text-white shadow-md' : 'text-muted hover:bg-slate-50 dark:hover:bg-slate-700'}`}><UserCheck size={16}/> معاملات الموظف</button>
          <button onClick={() => setView('salary-report')} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all ${view === 'salary-report' ? 'bg-accent text-white shadow-md' : 'text-muted hover:bg-slate-50 dark:hover:bg-slate-700'}`}><FileText size={16}/> تقرير الرواتب</button>
          <button onClick={() => setView('attendance')} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all ${view === 'attendance' ? 'bg-accent text-white shadow-md' : 'text-muted hover:bg-slate-50 dark:hover:bg-slate-700'}`}><Calendar size={16}/> البصمه</button>
        </div>
      </div>

      {renderContent()}
      
      {/* Employee Detail Modal */}
      {isDetailModalOpen && selectedEmployee && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-xl rounded-[2.5rem] shadow-2xl overflow-hidden border border-card card" style={{ backgroundColor: 'var(--card-bg)', color: 'var(--text)' }}>
             <div className="p-6 border-b dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50">
              <h3 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2"><User className="text-blue-500" /> الملف الشخصي للموظف</h3>
              <button onClick={() => setIsDetailModalOpen(false)} className="text-muted hover:text-rose-500 transition-colors"><X size={24} /></button>
            </div>
            <div className="p-8 text-right space-y-4">
               <div className="bg-slate-50 dark:bg-slate-900 p-6 rounded-2xl flex flex-col items-center">
                  <div className="w-20 h-20 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center text-blue-600 mb-4">
                    <User size={40} />
                  </div>
                  <h4 className="font-black text-xl">{selectedEmployee.name}</h4>
                  <p className="text-muted font-bold">{selectedEmployee.jobTitle}</p>
               </div>
               <div className="grid grid-cols-2 gap-4 mt-4">
                  <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-2xl">
                    <p className="text-[10px] font-bold text-muted uppercase">تاريخ التعيين</p>
                    <p className="font-bold">{selectedEmployee.hireDate}</p>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-2xl">
                    <p className="text-[10px] font-bold text-muted uppercase">الراتب الأساسي</p>
                    <p className="font-black text-emerald-500">{selectedEmployee.salary.toLocaleString()} {currencySymbol}</p>
                  </div>
               </div>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Employee Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden border border-card card" style={{ backgroundColor: 'var(--card-bg)', color: 'var(--text)' }}>
            <div className="p-6 border-b dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50">
              <h3 className="text-lg font-black text-slate-900 dark:text-white">{editingEmployee ? 'تعديل بيانات الموظف' : 'إضافة موظف جديد'}</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-muted hover:text-rose-500 transition-colors"><X size={24} /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-8 space-y-6 text-right">
              <div className="space-y-1">
                <label className="text-xs font-bold text-muted mr-2">الاسم بالكامل</label>
                <input 
                  type="text" 
                  required
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                  className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl py-3 px-4 text-sm focus:ring-2 ring-blue-500/20 text-slate-900 dark:text-white"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-muted mr-2">المسمى الوظيفي</label>
                  <input 
                    type="text" 
                    required
                    value={formData.jobTitle}
                    onChange={e => setFormData({...formData, jobTitle: e.target.value})}
                    className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl py-3 px-4 text-sm focus:ring-2 ring-blue-500/20 text-slate-900 dark:text-white"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-muted mr-2">الراتب ({currencySymbol})</label>
                  <input 
                    type="number" 
                    required
                    value={formData.salary}
                    onChange={e => setFormData({...formData, salary: e.target.value})}
                    className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl py-3 px-4 text-sm focus:ring-2 ring-blue-500/20 text-slate-900 dark:text-white"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-muted mr-2">رقم الهاتف</label>
                  <input 
                    type="text" 
                    value={formData.phone}
                    onChange={e => setFormData({...formData, phone: e.target.value})}
                    className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl py-3 px-4 text-sm focus:ring-2 ring-blue-500/20 text-slate-900 dark:text-white"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-muted mr-2">تاريخ التعيين</label>
                  <input 
                    type="date" 
                    value={formData.hireDate}
                    onChange={e => setFormData({...formData, hireDate: e.target.value})}
                    className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl py-3 px-4 text-sm focus:ring-2 ring-blue-500/20 text-slate-900 dark:text-white"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-muted mr-2">جهاز البصمة</label>
                  <CustomSelect
                    value={formData.fingerprintDeviceId}
                    onChange={v => setFormData({ ...formData, fingerprintDeviceId: v })}
                    options={[{ value: '', label: 'اختر الجهاز' }, ...devices.map((d:any) => ({ value: String(d.id), label: d.name }))]}
                    className="w-full"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-muted mr-2">رقم الموظف على الجهاز</label>
                  <input
                    type="text"
                    value={formData.fingerprintUserId}
                    onChange={e => setFormData({ ...formData, fingerprintUserId: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl py-3 px-4 text-sm focus:ring-2 ring-blue-500/20 text-slate-900 dark:text-white"
                  />
                </div>
              </div>
              <button 
                type="submit"
                className="w-full bg-accent text-white py-4 rounded-2xl font-black shadow-xl shadow-blue-500/30 hover:bg-blue-700 transition-all flex items-center justify-center gap-2">
                <Save size={18} /> {editingEmployee ? 'حفظ التعديلات' : 'إضافة الموظف للمؤسسة'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default HRMModule;
