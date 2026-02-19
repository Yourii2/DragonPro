
import React, { useState, useEffect } from 'react';
import PermissionsAdmin from './PermissionsAdmin';
import { Lock, Search, Globe, Users as UsersIcon, Shield, ChevronRight, Plus, X, Save, Edit, Trash2, Eye, UserPlus } from 'lucide-react';
import Swal from 'sweetalert2';
import CustomSelect from './CustomSelect';
import { API_BASE_PATH } from '../services/apiConfig';

interface AdminModuleProps {
  initialView?: string;
}

const AdminModule: React.FC<AdminModuleProps> = ({ initialView }) => {
  const [activeTab, setActiveTab] = useState<string>(initialView || 'users');
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);

  const [users, setUsers] = useState<any[]>([]);

  const [formData, setFormData] = useState({ name: '', username: '', role: 'representative', phone: '', password: '' });
  const [permissionsMap, setPermissionsMap] = useState<{[k:string]: boolean}>({});

  const pages = [
    { slug: 'dashboard', label: 'لوحة التحكم' },
    { slug: 'crm', label: 'إدارة العملاء' },
    { slug: 'inventory', label: 'المخزون' },
    { slug: 'sales', label: 'المبيعات' },
    { slug: 'hrm', label: 'اداره الموظفين' },
    { slug: 'finance', label: 'المالية' },
  ];

  useEffect(() => {
    if (initialView) setActiveTab(initialView);

    // Fetch users from API
    const isRepresentative = (u: any) => {
      const r = (u?.role || '').toString().toLowerCase();
      return r === 'representative' || r.includes('مندوب');
    };

    const fetchUsers = async () => {
      try {
        const response = await fetch(`${API_BASE_PATH}/api.php?module=users&action=getAll`);
        const result = await response.json();
        if (result.success) {
          const list = Array.isArray(result.data) ? result.data.filter((u:any) => !isRepresentative(u)) : [];
          setUsers(list);
          const defaults:any = {};
          pages.forEach(p => defaults[p.slug] = false);
          setPermissionsMap(defaults);
        }
      } catch (error) {
        console.error('Failed to fetch users:', error);
      }
    };

    fetchUsers();
  }, [initialView]);

  const handleOpenModal = (user: any = null) => {
    if (user) {
      setEditingUser(user);
      setFormData({ name: user.name, username: user.username, role: user.role === 'مدير نظام' ? 'admin' : user.role, phone: user.phone, password: '' });
      try {
        const perms = user.permissions ? (typeof user.permissions === 'string' ? JSON.parse(user.permissions) : user.permissions) : {};
        const map:any = {};
        pages.forEach(p => map[p.slug] = !!perms[p.slug]);
        setPermissionsMap(map);
      } catch (e) { setPermissionsMap({}); }
    } else {
      setEditingUser(null);
      setFormData({ name: '', username: '', role: 'representative', phone: '', password: '' });
      const defaults:any = {};
      pages.forEach(p => defaults[p.slug] = false);
      setPermissionsMap(defaults);
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) return;

    const mappedRole = formData.role === 'admin' ? 'admin' : formData.role === 'accountant' ? 'accountant' : 'representative';

    try {
      const url = editingUser 
        ? `${API_BASE_PATH}/api.php?module=users&action=update`
        : `${API_BASE_PATH}/api.php?module=users&action=create`;
      
      // If password is empty, don't send it (server may generate one)
      const base = editingUser ? { ...formData, role: mappedRole, id: editingUser.id } : { ...formData, role: mappedRole };
      if (!base.password) delete base.password;
      const body = { ...base, permissions: JSON.stringify(permissionsMap) };
      
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      
      const result = await response.json();
      
      if (result.success) {
        // Refresh users list
        await fetchUsers();
        setIsModalOpen(false);
      } else {
        Swal.fire({
          icon: 'error',
          title: 'فشل الحفظ',
          text: result.message || 'حدث خطأ أثناء حفظ المستخدم',
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
    const user = users.find(u => u.id === id);
    if (!user) return;

    Swal.fire({
      title: 'تأكيد الحذف',
      text: `هل أنت متأكد من سحب صلاحيات وحذف المستخدم "${user.name}"؟`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'نعم، احذفه',
      cancelButtonText: 'إلغاء'
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          const response = await fetch(`${API_BASE_PATH}/api.php?module=users&action=delete`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id })
          });
          
          const deleteResult = await response.json();
          
          if (deleteResult.success) {
            // Refresh users list
            await fetchUsers();
            Swal.fire(
              'تم الحذف!',
              `تم حذف المستخدم "${user.name}" بنجاح.`,
              'success'
            );
          } else {
            Swal.fire({
              icon: 'error',
              title: 'فشل الحذف',
              text: deleteResult.message || 'حدث خطأ أثناء حذف المستخدم',
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

  const filteredUsers = users.filter(u => 
    (u.name || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
    ((u.phone || '') + '').includes(searchTerm) ||
    (u.username || '').toLowerCase().includes(searchTerm.toLowerCase())
  );


  return (
    <div className="space-y-6 transition-colors duration-300">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-black text-slate-900 dark:text-white">الإدارة والصلاحيات</h2>
        <div className="flex gap-1 p-1.5 rounded-2xl border border-card shadow-sm" style={{ backgroundColor: 'var(--card-bg)', color: 'var(--text)' }}>
          <button 
            onClick={() => setActiveTab('users')} 
            className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${activeTab === 'users' ? 'bg-accent text-white shadow-md' : 'text-muted hover:bg-slate-50 dark:hover:bg-slate-700'}`}
          >
            إدارة المستخدمين
          </button>
          <button 
            onClick={() => setActiveTab('permissions')} 
            className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${activeTab === 'permissions' ? 'bg-accent text-white shadow-md' : 'text-muted hover:bg-slate-50 dark:hover:bg-slate-700'}`}
          >
            مصفوفة الصلاحيات
          </button>
          <button 
            onClick={() => setActiveTab('logs')} 
            className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${activeTab === 'logs' ? 'bg-accent text-white shadow-md' : 'text-muted hover:bg-slate-50 dark:hover:bg-slate-700'}`}
          >
            سجل العمليات
          </button>
        </div>
      </div>

      {activeTab === 'users' && (
        <div className="space-y-4 animate-in fade-in duration-300">
            <div className="rounded-3xl border border-card shadow-sm overflow-hidden card">
              <div className="p-4 border-b dark:border-slate-700 flex flex-col md:flex-row items-center justify-between gap-4" style={{ backgroundColor: 'var(--card-bg)', color: 'var(--text)' }}>
                <div className="relative flex-1 w-full max-w-md">
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-muted w-4 h-4" />
                  <input 
                    type="text" 
                    placeholder="بحث باسم المستخدم، الاسم أو الهاتف..." 
                    className="w-full pr-10 pl-4 py-2.5 border-none rounded-2xl text-xs font-bold focus:ring-2 ring-blue-500/20 shadow-sm text-right card" 
                    style={{ backgroundColor: 'var(--card-bg)', color: 'var(--text)' }}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                <button 
                  onClick={() => handleOpenModal()}
                  className="w-full md:w-auto flex items-center justify-center gap-2 bg-accent text-white px-5 py-2.5 rounded-2xl text-sm font-black shadow-lg shadow-blue-500/20 active:scale-95 transition-all"
                >
                  <UserPlus size={18} /> إضافة مستخدم نظام
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-right text-sm">
                  <thead className="bg-slate-50 dark:bg-slate-900/50 text-muted">
                    <tr>
                      <th className="px-6 py-4 font-bold">الاسم</th>
                      <th className="px-6 py-4 font-bold">اسم الدخول</th>
                      <th className="px-6 py-4 font-bold">الدور الوظيفي</th>
                      <th className="px-6 py-4 font-bold">رقم الهاتف</th>
                      <th className="px-6 py-4 font-bold">الحالة</th>
                      <th className="px-6 py-4 font-bold text-center">الإجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y dark:divide-slate-700 text-slate-700 dark:text-slate-300">
                    {filteredUsers.length > 0 ? filteredUsers.map(u => (
                      <tr key={u.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                        <td className="px-6 py-4 font-bold">{u.name}</td>
                        <td className="px-6 py-4 text-xs font-mono text-muted">{u.username}</td>
                        <td className="px-6 py-4 text-xs font-bold">{u.role}</td>
                        <td className="px-6 py-4 text-xs">{u.phone}</td>
                        <td className="px-6 py-4"><span className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 px-3 py-1 rounded-lg text-[10px] font-black">{u.status}</span></td>
                        <td className="px-6 py-4">
                          <div className="flex items-center justify-center gap-2">
                            <button onClick={() => handleDelete(u.id)} className="p-2 text-muted hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-xl transition-all"><Trash2 size={16} /></button>
                            <button onClick={() => handleOpenModal(u)} className="p-2 text-muted hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/30 rounded-xl transition-all"><Edit size={16} /></button>
                            <button className="p-2 text-muted hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-xl transition-all"><Eye size={16} /></button>
                          </div>
                        </td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan={6} className="px-6 py-10 text-center text-muted font-bold">لا يوجد مستخدمون يطابقون بحثك</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
           </div>
        </div>
      )}

      {activeTab === 'permissions' && (
        <div className="animate-in fade-in">
          <PermissionsAdmin />
        </div>
      )}

      {activeTab === 'logs' && (
        <div className="rounded-[3rem] p-24 border border-card card text-center animate-in slide-in-from-bottom duration-300 shadow-sm flex flex-col items-center justify-center" style={{ color: 'var(--text)' }}>
          <div className="p-8 rounded-[3rem] mb-6" style={{ backgroundColor: 'var(--card-bg)', color: 'var(--text)' }}>
            <Shield className="w-16 h-16 opacity-20 text-blue-500" />
          </div>
          <h3 className="text-lg font-black text-slate-900 dark:text-white mb-2">سجل مراقبة العمليات (Audit Log)</h3>
          <p className="text-sm font-medium max-w-sm">تتبع شفاف ومؤرشف لكافة العمليات التي قام بها المستخدمون (إضافة، حذف، تعديل) مع تحديد وقت العملية والموقع.</p>
        </div>
      )}

      {/* Add/Edit User Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden border border-card card">
            <div className="p-6 border-b dark:border-slate-700 flex justify-between items-center" style={{ backgroundColor: 'var(--card-bg)', color: 'var(--text)' }}>
              <h3 className="text-lg font-black text-slate-900 dark:text-white">{editingUser ? 'تعديل بيانات المستخدم' : 'إضافة مستخدم نظام'}</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-muted hover:text-rose-500 transition-colors"><X size={24} /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-8 space-y-6 text-right">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 mr-2">الاسم بالكامل</label>
                <input 
                  type="text" 
                  required
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                  className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl py-3 px-4 text-sm focus:ring-2 ring-blue-500/20 text-slate-900 dark:text-white"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 mr-2">رقم الهاتف</label>
                <input 
                  type="text" 
                  value={formData.phone}
                  onChange={e => setFormData({...formData, phone: e.target.value})}
                  className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl py-3 px-4 text-sm focus:ring-2 ring-blue-500/20 text-slate-900 dark:text-white"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 mr-2">الدور الوظيفي</label>
                <CustomSelect
                  value={formData.role}
                  onChange={v => setFormData({...formData, role: v})}
                  options={[
                    { value: 'representative', label: 'مندوب مبيعات' },
                    { value: 'accountant', label: 'محاسب' },
                    { value: 'admin', label: 'مدير نظام' }
                  ]}
                  className="w-full"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 mr-2">اسم تسجيل الدخول</label>
                  <input 
                    type="text" 
                    required
                    value={formData.username}
                    onChange={e => setFormData({...formData, username: e.target.value})}
                    className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl py-3 px-4 text-sm focus:ring-2 ring-blue-500/20 text-slate-900 dark:text-white"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 mr-2">&nbsp;</label>
                  <div />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 mr-2">كلمة المرور</label>
                <input
                  type="password"
                  placeholder={editingUser ? 'اتركها فارغة للإبقاء على كلمة المرور الحالية' : 'كلمة مرور المستخدم (اتركها فارغة لإنشاء كلمة سر تلقائية)'}
                  value={formData.password}
                  onChange={e => setFormData({...formData, password: e.target.value})}
                  className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl py-3 px-4 text-sm focus:ring-2 ring-blue-500/20 text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 mr-2">الصلاحيات</label>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  {pages.map(p => (
                    <label key={p.slug} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!permissionsMap[p.slug]} onChange={e => setPermissionsMap(prev => ({...prev, [p.slug]: e.target.checked}))} /> {p.label}</label>
                  ))}
                </div>
              </div>
              <button 
                type="submit"
                className="w-full bg-blue-600 text-white py-4 rounded-2xl font-black shadow-xl shadow-blue-500/30 hover:bg-blue-700 transition-all flex items-center justify-center gap-2"
              >
                <Save size={18} /> {editingUser ? 'تحديث الصلاحيات' : 'تفعيل حساب المستخدم'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminModule;
