import React, { useEffect, useMemo, useState } from 'react';
import { User, Phone, Mail, Shield, Calendar, Building2, BadgeCheck, Camera, KeyRound, Save } from 'lucide-react';
import Swal from 'sweetalert2';
import { API_BASE_PATH } from '../services/apiConfig';
import { assetUrl } from '../services/assetUrl';

const Profile: React.FC = () => {
  const [profile, setProfile] = useState<any>(() => {
    try {
      return JSON.parse(localStorage.getItem('Dragon_user') || '{}');
    } catch (e) {
      return {};
    }
  });

  const activation = (() => {
    try {
      return JSON.parse(localStorage.getItem('Dragon_activation') || '{}');
    } catch (e) {
      return {};
    }
  })();

  const companyName = localStorage.getItem('Dragon_company_name') || '—';
  const companyLogo = localStorage.getItem('Dragon_company_logo') || assetUrl('Dragon.png');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string>('');
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isSavingPassword, setIsSavingPassword] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [form, setForm] = useState({
    name: profile.name || profile.full_name || '',
    phone: profile.phone || ''
  });
  const [pw, setPw] = useState({ current: '', next: '', confirm: '' });

  const field = (value: any) => (value && String(value).trim() !== '' ? value : '—');

  const activationColor = () => {
    const status = (activation.status || '').toString();
    if (status.includes('محظور') || status.includes('منتهي')) return 'text-rose-600 bg-rose-50 border-rose-200';
    if (status.includes('تجريبية')) return 'text-amber-700 bg-amber-50 border-amber-200';
    if (status.includes('كاملة')) return 'text-emerald-700 bg-emerald-50 border-emerald-200';
    return 'text-slate-700 bg-slate-50 border-slate-200';
  };

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const res = await fetch(`${API_BASE_PATH}/api.php?module=profile&action=get`);
        const js = await res.json();
        if (js.success && js.data) {
          setProfile(js.data);
          setForm({
            name: js.data.name || '',
            phone: js.data.phone || ''
          });
          localStorage.setItem('Dragon_user', JSON.stringify({
            ...(JSON.parse(localStorage.getItem('Dragon_user') || '{}')),
            ...js.data
          }));
        }
      } catch (e) {
        // ignore
      }
    };
    loadProfile();
  }, []);

  useEffect(() => {
    const fallback = profile.avatar || companyLogo || assetUrl('Dragon.png');
    setAvatarPreview(fallback);
  }, [profile.avatar, companyLogo]);

  const avatarUrl = useMemo(() => avatarPreview || profile.avatar || companyLogo || assetUrl('Dragon.png'), [avatarPreview, profile.avatar, companyLogo]);

  const handleProfileSave = async () => {
    if (!form.name.trim()) {
      Swal.fire('خطأ', 'يرجى إدخال الاسم.', 'error');
      return;
    }
    setIsSavingProfile(true);
    try {
      const res = await fetch(`${API_BASE_PATH}/api.php?module=profile&action=update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: form.name, phone: form.phone })
      });
      const js = await res.json();
      if (!js.success) throw new Error(js.message || 'تعذر حفظ البيانات');
      setProfile(js.data || profile);
      localStorage.setItem('Dragon_user', JSON.stringify({
        ...(JSON.parse(localStorage.getItem('Dragon_user') || '{}')),
        ...(js.data || {})
      }));
      Swal.fire('تم', 'تم تحديث بيانات الملف الشخصي.', 'success');
    } catch (e: any) {
      Swal.fire('خطأ', e.message || 'تعذر حفظ البيانات', 'error');
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handlePasswordSave = async () => {
    if (!pw.current || !pw.next || !pw.confirm) {
      Swal.fire('خطأ', 'يرجى إدخال كل الحقول.', 'error');
      return;
    }
    if (pw.next !== pw.confirm) {
      Swal.fire('خطأ', 'كلمتا المرور غير متطابقتين.', 'error');
      return;
    }
    if (pw.next.length < 6) {
      Swal.fire('خطأ', 'كلمة المرور يجب ألا تقل عن 6 أحرف.', 'error');
      return;
    }
    setIsSavingPassword(true);
    try {
      const res = await fetch(`${API_BASE_PATH}/api.php?module=profile&action=changePassword`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ current_password: pw.current, new_password: pw.next })
      });
      const js = await res.json();
      if (!js.success) throw new Error(js.message || 'تعذر تغيير كلمة المرور');
      setPw({ current: '', next: '', confirm: '' });
      Swal.fire('تم', 'تم تغيير كلمة المرور بنجاح.', 'success');
    } catch (e: any) {
      Swal.fire('خطأ', e.message || 'تعذر تغيير كلمة المرور', 'error');
    } finally {
      setIsSavingPassword(false);
    }
  };

  const handleAvatarChange = (file: File | null) => {
    setAvatarFile(file);
    if (file) {
      const url = URL.createObjectURL(file);
      setAvatarPreview(url);
    }
  };

  const handleAvatarUpload = async () => {
    if (!avatarFile) {
      Swal.fire('تنبيه', 'يرجى اختيار صورة أولاً.', 'info');
      return;
    }
    setIsUploadingAvatar(true);
    try {
      const formData = new FormData();
      formData.append('avatar', avatarFile);
      const res = await fetch(`${API_BASE_PATH}/api.php?module=profile&action=uploadAvatar`, {
        method: 'POST',
        body: formData
      });
      const js = await res.json();
      if (!js.success) throw new Error(js.message || 'تعذر رفع الصورة');
      setProfile((prev: any) => ({ ...prev, avatar: js.avatar }));
      localStorage.setItem('Dragon_user', JSON.stringify({
        ...(JSON.parse(localStorage.getItem('Dragon_user') || '{}')),
        avatar: js.avatar
      }));
      setAvatarFile(null);
      setAvatarPreview(js.avatar);
      Swal.fire('تم', 'تم تحديث صورة المستخدم.', 'success');
    } catch (e: any) {
      Swal.fire('خطأ', e.message || 'تعذر رفع الصورة', 'error');
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500" dir="rtl">
      <div className="card p-6 rounded-3xl border border-card shadow-md">
        <div className="flex flex-col md:flex-row md:items-center gap-5">
          <div className="w-20 h-20 rounded-2xl overflow-hidden border border-card shadow-sm">
            <img src={avatarUrl} alt="avatar" className="w-full h-full object-cover" onError={(e: any) => { e.target.src = assetUrl('Dragon.png'); }} />
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-black">{field(profile.name || profile.full_name)}</h1>
            <p className="text-sm text-muted mt-1">{field(profile.username || profile.user_name)} • {field(profile.role || profile.role_name || 'User')}</p>
            <div className="mt-3 inline-flex items-center gap-2 text-xs font-bold px-3 py-1.5 rounded-full border border-card bg-slate-50 dark:bg-slate-900/40">
              <BadgeCheck size={14} className="text-emerald-500" />
              <span>حساب نشط</span>
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs text-muted">الشركة</div>
            <div className="text-lg font-black">{companyName}</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="card p-6 rounded-2xl border border-card shadow-md">
          <h2 className="text-sm font-black mb-4">بيانات المستخدم</h2>
          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-muted"><User size={14} />الاسم</span>
              <span className="font-bold">{field(profile.name || profile.full_name)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-muted"><Shield size={14} />الدور</span>
              <span className="font-bold">{field(profile.role || profile.role_name)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-muted"><Phone size={14} />الهاتف</span>
              <span className="font-bold">{field(profile.phone)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-muted"><Mail size={14} />البريد</span>
              <span className="font-bold">{field(profile.email)}</span>
            </div>
          </div>
        </div>

        <div className="card p-6 rounded-2xl border border-card shadow-md">
          <h2 className="text-sm font-black mb-4">معلومات الشركة</h2>
          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-muted"><Building2 size={14} />الشركة</span>
              <span className="font-bold">{companyName}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-muted"><User size={14} />المستخدم</span>
              <span className="font-bold">{field(profile.username || profile.user_name)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-muted"><Calendar size={14} />آخر دخول</span>
              <span className="font-bold">{field(profile.last_login || profile.lastLogin)}</span>
            </div>
          </div>
        </div>

        <div className="card p-6 rounded-2xl border border-card shadow-md">
          <h2 className="text-sm font-black mb-4">حالة الترخيص</h2>
          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted">الحالة</span>
              <span className={`px-3 py-1 rounded-full text-xs font-bold border ${activationColor()}`}>
                {field(activation.status)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted">تاريخ الانتهاء</span>
              <span className="font-bold">{field(activation.expiry)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted">حالة الحساب</span>
              <span className="font-bold">{field(activation.account_status)}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card p-6 rounded-2xl border border-card shadow-md">
          <h2 className="text-sm font-black mb-4">تعديل البيانات</h2>
          <div className="space-y-4 text-sm">
            <div>
              <label className="text-xs text-muted">الاسم</label>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="mt-2 w-full px-4 py-3 rounded-xl border border-card bg-white dark:bg-slate-900"
                placeholder="اكتب الاسم"
              />
            </div>
            <div>
              <label className="text-xs text-muted">الهاتف</label>
              <input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="mt-2 w-full px-4 py-3 rounded-xl border border-card bg-white dark:bg-slate-900"
                placeholder="رقم الهاتف"
              />
            </div>
            <button
              onClick={handleProfileSave}
              disabled={isSavingProfile}
              className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700 disabled:opacity-60"
            >
              <Save size={16} /> حفظ البيانات
            </button>
          </div>
        </div>

        <div className="card p-6 rounded-2xl border border-card shadow-md">
          <h2 className="text-sm font-black mb-4">رفع صورة المستخدم</h2>
          <div className="space-y-4 text-sm">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl overflow-hidden border border-card">
                <img src={avatarUrl} alt="avatar" className="w-full h-full object-cover" onError={(e: any) => { e.target.src = '/Dragon.png'; }} />
              </div>
              <label className="flex-1">
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={(e) => handleAvatarChange(e.target.files && e.target.files[0] ? e.target.files[0] : null)}
                />
                <span className="inline-flex items-center gap-2 px-4 py-3 rounded-xl border border-card bg-white dark:bg-slate-900 cursor-pointer">
                  <Camera size={16} /> اختيار صورة
                </span>
              </label>
            </div>
            <button
              onClick={handleAvatarUpload}
              disabled={isUploadingAvatar}
              className="w-full flex items-center justify-center gap-2 bg-emerald-600 text-white py-3 rounded-xl font-bold hover:bg-emerald-700 disabled:opacity-60"
            >
              <Camera size={16} /> رفع الصورة
            </button>
          </div>
        </div>
      </div>

      <div className="card p-6 rounded-2xl border border-card shadow-md">
        <h2 className="text-sm font-black mb-4">تعديل كلمة المرور</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div>
            <label className="text-xs text-muted">كلمة المرور الحالية</label>
            <input
              type="password"
              value={pw.current}
              onChange={(e) => setPw({ ...pw, current: e.target.value })}
              className="mt-2 w-full px-4 py-3 rounded-xl border border-card bg-white dark:bg-slate-900"
            />
          </div>
          <div>
            <label className="text-xs text-muted">كلمة المرور الجديدة</label>
            <input
              type="password"
              value={pw.next}
              onChange={(e) => setPw({ ...pw, next: e.target.value })}
              className="mt-2 w-full px-4 py-3 rounded-xl border border-card bg-white dark:bg-slate-900"
            />
          </div>
          <div>
            <label className="text-xs text-muted">تأكيد كلمة المرور</label>
            <input
              type="password"
              value={pw.confirm}
              onChange={(e) => setPw({ ...pw, confirm: e.target.value })}
              className="mt-2 w-full px-4 py-3 rounded-xl border border-card bg-white dark:bg-slate-900"
            />
          </div>
        </div>
        <button
          onClick={handlePasswordSave}
          disabled={isSavingPassword}
          className="mt-4 flex items-center justify-center gap-2 bg-slate-900 text-white px-6 py-3 rounded-xl font-bold hover:bg-slate-800 disabled:opacity-60"
        >
          <KeyRound size={16} /> تغيير كلمة المرور
        </button>
      </div>
    </div>
  );
};

export default Profile;

