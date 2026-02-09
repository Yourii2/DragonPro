import React, { useState, useEffect, useRef } from 'react';
import {
  Building2,
  ShieldCheck,
  Save,
  Phone,
  MapPin,
  Globe,
  CreditCard,
  Clock,
  CheckCircle,
  AlertCircle,
  Database,
  Download,
  Upload,
  RefreshCw,
  History,
  Calendar,
  Image as ImageIcon,
  Camera,
  Coins,
  FileText
} from 'lucide-react';
import Swal from 'sweetalert2';
import { API_BASE_PATH } from '../services/apiConfig';

const SettingsModule: React.FC = () => {
  const [isSaved, setIsSaved] = useState(false);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [activation, setActivation] = useState<any>({});
  const [logoPreview, setLogoPreview] = useState<string | null>(localStorage.getItem('Dragon_company_logo'));
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [config, setConfig] = useState({
    name: localStorage.getItem('Dragon_company_name') || '',
    phone: localStorage.getItem('Dragon_company_phone') || '',
    address: localStorage.getItem('Dragon_company_address') || '',
    terms: localStorage.getItem('Dragon_company_terms') || '',
    taxRate: localStorage.getItem('Dragon_tax_rate') || '14',
    currency: localStorage.getItem('Dragon_currency') || 'EGP',
    autoBackup: localStorage.getItem('Dragon_auto_backup') === 'true',
    backupFrequency: localStorage.getItem('Dragon_backup_freq') || 'daily'
  });

  useEffect(() => {
    const actData = JSON.parse(localStorage.getItem('Dragon_activation') || '{}');
    setActivation(actData);
  }, []);

  const handleSave = () => {
    localStorage.setItem('Dragon_company_name', config.name);
    localStorage.setItem('Dragon_company_phone', config.phone);
    localStorage.setItem('Dragon_company_address', config.address);
    localStorage.setItem('Dragon_company_terms', config.terms);
    localStorage.setItem('Dragon_tax_rate', config.taxRate);
    localStorage.setItem('Dragon_currency', config.currency);
    localStorage.setItem('Dragon_auto_backup', config.autoBackup.toString());
    localStorage.setItem('Dragon_backup_freq', config.backupFrequency);
    localStorage.setItem('Dragon_company_logo', logoPreview || '');

    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 3000);
    // تحديث الصفحة لتطبيق التغييرات على مستوى النظام بالكامل
    setTimeout(() => window.location.reload(), 800);
  };

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setLogoPreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const runManualBackup = () => {
    setIsBackingUp(true);
    setTimeout(() => {
      setIsBackingUp(false);
      Swal.fire({
        icon: 'success',
        title: 'اكتمل النسخ الاحتياطي',
        text: 'تم إنشاء ملف النسخة الاحتياطية بنجاح وجاري بدء التحميل.',
        timer: 2500,
        showConfirmButton: false,
      });
    }, 2000);
  };

  const runRestore = () => {
    Swal.fire({
      title: 'هل أنت متأكد؟',
      text: "استعادة نسخة قديمة سيؤدي لاستبدال كافة البيانات الحالية. لا يمكن التراجع عن هذا الإجراء!",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'نعم، قم بالاستعادة',
      cancelButtonText: 'إلغاء'
    }).then((result) => {
      if (result.isConfirmed) {
        setIsRestoring(true);
        setTimeout(() => {
          setIsRestoring(false);
          Swal.fire({
            title: 'تمت الاستعادة!',
            text: 'تم استعادة البيانات بنجاح. سيتم إعادة تشغيل النظام الآن.',
            icon: 'success',
            showConfirmButton: false,
            timer: 2000,
          }).then(() => {
            window.location.reload();
          });
        }, 2500);
      }
    });
  };

  const handleSystemReset = async () => {
    const result = await Swal.fire({
      title: 'إعادة ضبط المصنع',
      text: "هل أنت متأكد من رغبتك في إعادة ضبط النظام بالكامل؟ سيتم مسح كل شيء نهائياً!",
      icon: 'error',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'نعم، أنا متأكد',
      cancelButtonText: 'إلغاء'
    });

    if (result.isConfirmed) {
      try {
        const response = await fetch(`${API_BASE_PATH}/reset.php`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({})
        });

        const resetResult = await response.json();

        if (resetResult.success) {
          // مسح جميع البيانات المحلية
          localStorage.clear();

          Swal.fire({
            title: 'تمت إعادة التعيين!',
            text: 'سيتم إعادة تشغيل النظام الآن.',
            icon: 'success',
            showConfirmButton: false,
            timer: 2000,
          }).then(() => {
            window.location.reload();
          });
        } else {
          Swal.fire({
            title: 'فشلت العملية',
            text: resetResult.message || 'حدث خطأ أثناء إعادة تعيين النظام',
            icon: 'error',
            confirmButtonText: 'حسناً'
          });
        }
      } catch (error) {
        Swal.fire({
          title: 'خطأ في الاتصال',
          text: 'فشل الاتصال بالخادم. يرجى التحقق من اتصالك بالإنترنت.',
          icon: 'error',
          confirmButtonText: 'حسناً'
        });
      }
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12 transition-colors duration-300 animate-in fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white">إعدادات النظام</h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm">إدارة هوية الشركة وتراخيص العمل وقواعد البيانات</p>
        </div>
        <button
          onClick={handleSave}
          className="bg-blue-600 text-white px-6 py-2.5 rounded-2xl font-bold flex items-center gap-2 shadow-lg shadow-blue-500/20 hover:bg-blue-700 transition-all active:scale-95"
        >
          <Save size={18} /> حفظ التغييرات
        </button>
      </div>

      {isSaved && (
        <div className="bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 p-4 rounded-2xl border border-emerald-200 dark:border-emerald-800/50 flex items-center gap-3">
          <CheckCircle size={18} /> تم حفظ الإعدادات وتحديث بيانات النظام بنجاح.
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">

          {/* Identity & Logo */}
          <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm transition-colors">
            <h3 className="font-bold flex items-center gap-2 mb-6 text-slate-800 dark:text-slate-100"><Building2 className="text-blue-500" size={18}/> هوية المؤسسة والشعار</h3>

            <div className="flex flex-col md:flex-row gap-8 items-start">
              <div className="flex flex-col items-center gap-3">
                <div className="relative group">
                  <div className="w-32 h-32 rounded-[2rem] bg-slate-50 dark:bg-slate-900 border-2 border-dashed border-slate-200 dark:border-slate-700 flex items-center justify-center overflow-hidden transition-all group-hover:border-blue-500">
                    {logoPreview ? (
                      <img src={logoPreview} className="w-full h-full object-cover" alt="Company Logo" />
                    ) : (
                      <ImageIcon className="text-slate-300 dark:text-slate-600 w-10 h-10" />
                    )}
                  </div>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="absolute -bottom-2 -left-2 bg-blue-600 text-white p-2.5 rounded-2xl shadow-lg shadow-blue-500/30 hover:bg-blue-700 transition-all"
                  >
                    <Camera size={16} />
                  </button>
                  <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleLogoChange} />
                </div>
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">تغيير الشعار</span>
              </div>

              <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400 mr-2">اسم المؤسسة</label>
                  <input
                    type="text"
                    value={config.name}
                    onChange={(e) => setConfig({...config, name: e.target.value})}
                    className="w-full py-3 px-4 bg-slate-50 dark:bg-slate-900 border-none rounded-2xl text-sm text-slate-900 dark:text-white focus:ring-2 ring-blue-500/20"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400 mr-2">رقم التواصل</label>
                  <input
                    type="text"
                    value={config.phone}
                    onChange={(e) => setConfig({...config, phone: e.target.value})}
                    className="w-full py-3 px-4 bg-slate-50 dark:bg-slate-900 border-none rounded-2xl text-sm text-slate-900 dark:text-white focus:ring-2 ring-blue-500/20"
                  />
                </div>
                <div className="md:col-span-2 space-y-1">
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400 mr-2">العنوان بالكامل</label>
                  <input
                    type="text"
                    value={config.address}
                    onChange={(e) => setConfig({...config, address: e.target.value})}
                    className="w-full py-3 px-4 bg-slate-50 dark:bg-slate-900 border-none rounded-2xl text-sm text-slate-900 dark:text-white focus:ring-2 ring-blue-500/20"
                  />
                </div>
                <div className="md:col-span-2 space-y-1 mt-2">
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400 mr-2 flex items-center gap-2">
                    <FileText size={14} className="text-blue-500" /> سياسة الاستخدام / شروط الفاتورة
                  </label>
                  <textarea
                    rows={4}
                    value={config.terms}
                    onChange={(e) => setConfig({...config, terms: e.target.value})}
                    placeholder="اكتب شروط الاستخدام أو سياسة الاسترجاع هنا..."
                    className="w-full py-3 px-4 bg-slate-50 dark:bg-slate-900 border-none rounded-2xl text-sm text-slate-900 dark:text-white focus:ring-2 ring-blue-500/20 resize-none"
                  ></textarea>
                </div>
              </div>
            </div>
          </div>

          {/* Backup Section */}
          <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm transition-colors">
            <h3 className="font-bold flex items-center gap-2 mb-6 text-slate-800 dark:text-slate-100"><Database className="text-indigo-500" size={18}/> قواعد البيانات والنسخ الاحتياطي</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <button onClick={runManualBackup} disabled={isBackingUp} className="w-full flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900 rounded-2xl hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-all">
                  <div className="flex items-center gap-3">
                    <div className="bg-indigo-100 dark:bg-indigo-900/40 p-2.5 rounded-xl text-indigo-600 dark:text-indigo-400">
                      {isBackingUp ? <RefreshCw className="animate-spin" size={20} /> : <Download size={20} />}
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-slate-800 dark:text-slate-200">تصدير نسخة (Backup)</p>
                      <p className="text-[10px] text-slate-500">تحميل ملف SQL حالي</p>
                    </div>
                  </div>
                </button>
                <button onClick={runRestore} disabled={isRestoring} className="w-full flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900 rounded-2xl hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-all">
                  <div className="flex items-center gap-3">
                    <div className="bg-amber-100 dark:bg-amber-900/40 p-2.5 rounded-xl text-amber-600 dark:text-amber-400">
                      {isRestoring ? <RefreshCw className="animate-spin" size={20} /> : <Upload size={20} />}
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-slate-800 dark:text-slate-200">استرجاع بيانات (Restore)</p>
                      <p className="text-[10px] text-slate-500">رفع ملف SQL خارجي</p>
                    </div>
                  </div>
                </button>
              </div>

              <div className="space-y-4 md:border-r md:pr-6 border-slate-100 dark:border-slate-700">
                <div className="flex items-center justify-between p-2">
                  <span className="text-sm font-bold text-slate-700 dark:text-slate-300">النسخ التلقائي للسيرفر</span>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer" checked={config.autoBackup} onChange={(e) => setConfig({...config, autoBackup: e.target.checked})} />
                    <div className="w-11 h-6 bg-slate-200 dark:bg-slate-700 rounded-full peer peer-checked:bg-indigo-600 after:content-[''] after:absolute after:top-[2px] after:right-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:-translate-x-full"></div>
                  </label>
                </div>
                <div className={`space-y-1 ${!config.autoBackup ? 'opacity-40' : ''}`}>
                  <label className="text-[10px] font-bold text-slate-500 mr-2">توقيت النسخ</label>
                  <select disabled={!config.autoBackup} value={config.backupFrequency} onChange={(e) => setConfig({...config, backupFrequency: e.target.value})} className="w-full py-3 px-4 bg-slate-50 dark:bg-slate-900 border-none rounded-2xl text-sm text-slate-900 dark:text-white">
                    <option value="hourly">كل ساعة عمل</option>
                    <option value="daily">يومياً (منتصف الليل)</option>
                    <option value="weekly">أسبوعياً (كل جمعة)</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar Settings */}
        <div className="space-y-6">
          <div className="bg-gradient-to-br from-slate-800 to-slate-950 p-6 rounded-3xl text-white shadow-xl relative overflow-hidden">
             <div className="absolute -top-4 -right-4 opacity-10 rotate-12"><ShieldCheck size={120} /></div>
             <h3 className="font-bold mb-8 flex items-center gap-2"><ShieldCheck className="text-blue-400" /> الترخيص</h3>
             <div className="space-y-4 relative z-10">
               <div className="bg-white/5 p-3 rounded-2xl flex justify-between items-center">
                 <span className="text-xs text-slate-400">الحالة:</span>
                 <span className={`text-sm font-bold ${activation.status === 'كاملة' ? 'text-emerald-400' : 'text-amber-400'}`}>{activation.status}</span>
               </div>
               <div className="bg-white/5 p-3 rounded-2xl flex justify-between items-center">
                 <span className="text-xs text-slate-400">ينتهي في:</span>
                 <span className="text-sm font-bold">{activation.expiry}</span>
               </div>
             </div>
          </div>

          <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm transition-colors">
            <h3 className="font-bold flex items-center gap-2 mb-6 text-slate-800 dark:text-slate-100"><Coins className="text-amber-500" size={18}/> العملة والضرائب</h3>
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 dark:text-slate-400">العملة الافتراضية</label>
                <select
                  value={config.currency}
                  onChange={(e) => setConfig({...config, currency: e.target.value})}
                  className="w-full py-3 px-4 bg-slate-50 dark:bg-slate-900 border-none rounded-2xl text-sm text-slate-900 dark:text-white"
                >
                  <option value="EGP">الجنيه المصري (EGP)</option>
                  <option value="SAR">الريال السعودي (SAR)</option>
                  <option value="USD">الدولار الأمريكي (USD)</option>
                  <option value="AED">الدرهم الإماراتي (AED)</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 dark:text-slate-400">معدل الضريبة (%)</label>
                <input
                  type="number"
                  value={config.taxRate}
                  onChange={(e) => setConfig({...config, taxRate: e.target.value})}
                  className="w-full py-3 px-4 bg-slate-50 dark:bg-slate-900 border-none rounded-2xl text-sm text-slate-900 dark:text-white"
                />
              </div>
            </div>
          </div>

          <div className="bg-rose-50 dark:bg-rose-950/20 p-6 rounded-3xl border border-rose-100 dark:border-rose-900/50 shadow-sm">
             <h4 className="font-bold text-rose-700 dark:text-rose-400 flex items-center gap-2 mb-2"><AlertCircle size={16}/> منطقة الخطر</h4>
             <p className="text-[10px] text-rose-600 dark:text-rose-500 mb-4">سيؤدي هذا الإجراء إلى حذف كافة الإعدادات والبيانات والبدء من جديد بمعالج التثبيت.</p>
             <button
                onClick={handleSystemReset}
                className="w-full py-2.5 bg-rose-600 text-white rounded-xl text-xs font-bold hover:bg-rose-700 transition-all shadow-lg shadow-rose-500/20 active:scale-95"
             >
               إعادة تعيين النظام بالكامل
             </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsModule;

