
import React, { useState } from 'react';
import { 
  Database, 
  Building2, 
  UserPlus, 
  ShieldCheck, 
  CheckCircle2, 
  ChevronLeft, 
  ChevronRight,
  Upload,
  Globe,
  Settings,
  Server,
  Lock,
  Phone,
  MapPin,
  FileText,
  Activity
} from 'lucide-react';
import Swal from 'sweetalert2';
import { SQL_SCHEMA } from '../services/dbSchema';
import { API_BASE_PATH } from '../services/apiConfig';
import { assetUrl } from '../services/assetUrl';

interface SetupWizardProps {
  onComplete: () => void;
}

const SetupWizard: React.FC<SetupWizardProps> = ({ onComplete }) => {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [dbTestResult, setDbTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [isTestingDb, setIsTestingDb] = useState(false);

  const [formData, setFormData] = useState({
    dbHost: 'localhost',
    dbPort: '3306',
    dbUser: 'root',
    dbPass: '',
    dbName: 'Dragon_erp',
    companyName: '',
    companyPhone: '',
    companyAddress: '',
    companyTerms: '',
    adminName: '',
    adminUsername: '',
    adminPass: ''
  });

  const formatActivationStatus = (type: string, accountStatus: string, isExpired: string | boolean) => {
    const expired = isExpired === true || isExpired === 'true';
    if (expired) return 'منتهي';
    if ((accountStatus || '').toLowerCase() === 'blocked') return 'محظور';
    if ((type || '').toLowerCase() === 'trial') return 'تجريبية';
    if (type) return 'كاملة';
    return 'غير معروف';
  };

  const nextStep = () => setStep(prev => prev + 1);
  const prevStep = () => setStep(prev => prev - 1);

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleTestDbConnection = async () => {
    setIsTestingDb(true);
    setDbTestResult(null);
    try {
      const response = await fetch(`${API_BASE_PATH}/test_db.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          host: formData.dbHost,
          port: formData.dbPort,
          user: formData.dbUser,
          pass: formData.dbPass,
          name: formData.dbName,
        }),
      });
      const result = await response.json();
      setDbTestResult(result);
      Swal.fire({
        icon: result.success ? 'success' : 'error',
        title: result.success ? 'نجاح' : 'فشل',
        text: result.message,
      });
    } catch (error: any) {
      const message = error.message.includes('JSON.parse') ? 'فشل الاتصال بالخادم، قد يكون هناك خطأ في إعدادات PHP.' : error.message;
      setDbTestResult({ success: false, message });
      Swal.fire({ icon: 'error', title: 'خطأ فادح', text: message });
    } finally {
      setIsTestingDb(false);
    }
  };

  const handleFinish = async () => {
    setLoading(true);
    
    try {
      const response = await fetch(`${API_BASE_PATH}/setup.php`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
          companyLogo: logoPreview,
          sql_schema: SQL_SCHEMA,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        // التعامل مع حالة وجود قاعدة البيانات بشكل خاص
        if (response.status === 409) {
          throw new Error(result.message || 'قاعدة البيانات موجودة بالفعل');
        }
        throw new Error(result.message || 'An unknown error occurred during setup.');
      }

      localStorage.setItem('Dragon_installed', 'true');
      localStorage.setItem('Dragon_company_name', formData.companyName);
      localStorage.setItem('Dragon_company_logo', logoPreview || '');
      if (result.activation) {
        localStorage.setItem('Dragon_activation', JSON.stringify({
          status: formatActivationStatus(result.activation.type, result.activation.account_status, result.activation.is_expired),
          expiry: result.activation.expiry || 'غير محدد',
          account_status: result.activation.account_status || 'Active',
          is_expired: result.activation.is_expired || 'false'
        }));
      }

      onComplete();

    } catch (error: any) {
      Swal.fire({
        icon: 'error',
        title: 'فشل التثبيت',
        text: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  const steps = [
    { title: 'ترحيب', icon: <Globe /> },
    { title: 'قاعدة البيانات', icon: <Database /> },
    { title: 'الشركة', icon: <Building2 /> },
    { title: 'المدير', icon: <UserPlus /> },
    { title: 'التفعيل', icon: <ShieldCheck /> },
    { title: 'النهاية', icon: <CheckCircle2 /> },
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-['Cairo']" dir="rtl">
      <div className="bg-white w-full max-w-4xl rounded-[2.5rem] shadow-2xl shadow-blue-500/10 overflow-hidden flex flex-col md:flex-row">
        
        {/* Sidebar - Progress */}
        <div className="bg-slate-800 md:w-80 p-8 text-white">
          <div className="flex items-center gap-3 mb-12">
            <div className="bg-white/10 p-2 rounded-xl backdrop-blur-md">
              <img src={assetUrl('Dragon.png')} alt="Dragon Pro Logo" className="w-8 h-8" onError={(e: any) => { e.target.src = assetUrl('Dragon.png'); }} />
            </div>
            <h2 className="text-xl font-bold">معالج التثبيت</h2>
          </div>
          
          <div className="space-y-6">
            {steps.map((s, i) => (
              <div key={i} className={`flex items-center gap-4 transition-all duration-300 ${step === i + 1 ? 'opacity-100' : 'opacity-40'}`}>
                <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 ${step >= i + 1 ? 'bg-blue-500 text-white border-blue-500' : 'border-white/30 text-white'}`}>
                  {step > i + 1 ? <CheckCircle2 size={20} /> : s.icon}
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider opacity-60">الخطوة {i + 1}</p>
                  <p className="text-sm font-bold">{s.title}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 p-8 md:p-12 relative overflow-y-auto max-h-screen md:max-h-[700px]">
          
          {step === 1 && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="bg-blue-50 w-20 h-20 rounded-3xl flex items-center justify-center mb-6">
                <Globe className="text-blue-600 w-10 h-10" />
              </div>
              <h1 className="text-3xl font-black text-slate-900 mb-4">أهلاً بك في دراجون برو</h1>
              <p className="text-slate-500 leading-relaxed mb-8">
                يسعدنا اختيارك لنظام دراجون برو لإدارة شركات المبيعات والتسويق. سيقوم هذا المعالج بمساعدتك في تهيئة النظام وربط قاعدة البيانات في دقائق معدودة.
              </p>
              <button 
                onClick={nextStep}
                className="group flex items-center gap-3 bg-blue-600 text-white px-8 py-4 rounded-2xl font-bold hover:bg-blue-700 transition-all shadow-xl shadow-blue-500/20"
              >
                بدء عملية التثبيت
                <ChevronLeft className="group-hover:-translate-x-1 transition-transform" />
              </button>
            </div>
          )}

          {step === 2 && (
            <div className="animate-in fade-in slide-in-from-left-4 duration-500">
              <h2 className="text-2xl font-bold text-slate-900 mb-6 flex items-center gap-3">
                <Server className="text-blue-600" /> إعدادات قاعدة البيانات
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 mr-2">عنوان السيرفر (Host)</label>
                  <input 
                    type="text" 
                    value={formData.dbHost}
                    onChange={(e) => setFormData({...formData, dbHost: e.target.value})}
                    className="w-full bg-slate-50 border-none rounded-2xl py-3 px-4 text-sm focus:ring-2 ring-blue-500/20" 
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 mr-2">المنفذ (Port)</label>
                  <input 
                    type="text" 
                    value={formData.dbPort}
                    onChange={(e) => setFormData({...formData, dbPort: e.target.value})}
                    className="w-full bg-slate-50 border-none rounded-2xl py-3 px-4 text-sm focus:ring-2 ring-blue-500/20" 
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 mr-2">اسم المستخدم</label>
                  <input 
                    type="text" 
                    value={formData.dbUser}
                    onChange={(e) => setFormData({...formData, dbUser: e.target.value})}
                    className="w-full bg-slate-50 border-none rounded-2xl py-3 px-4 text-sm focus:ring-2 ring-blue-500/20" 
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 mr-2">كلمة المرور</label>
                  <input 
                    type="password" 
                    value={formData.dbPass}
                    onChange={(e) => setFormData({...formData, dbPass: e.target.value})}
                    className="w-full bg-slate-50 border-none rounded-2xl py-3 px-4 text-sm focus:ring-2 ring-blue-500/20" 
                  />
                </div>
                <div className="md:col-span-2 space-y-1">
                  <label className="text-xs font-bold text-slate-500 mr-2">اسم قاعدة البيانات</label>
                  <input 
                    type="text" 
                    value={formData.dbName}
                    onChange={(e) => setFormData({...formData, dbName: e.target.value})}
                    className="w-full bg-slate-50 border-none rounded-2xl py-3 px-4 text-sm focus:ring-2 ring-blue-500/20" 
                  />
                </div>
              </div>
              {dbTestResult && !dbTestResult.success && (
                <div className="mt-4 bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300 p-3 rounded-xl text-sm font-bold text-center">
                  {dbTestResult.message}
                </div>
              )}
              <div className="mt-6">
                <button 
                  type="button"
                  onClick={handleTestDbConnection}
                  disabled={isTestingDb}
                  className="w-full flex items-center justify-center gap-2 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 px-5 py-3 rounded-2xl text-sm font-bold hover:bg-slate-200 dark:hover:bg-slate-600 transition-all disabled:opacity-50"
                >
                  {isTestingDb ? 
                    <><div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div> جارٍ الاختبار...</> : 
                    <><Database size={16}/> اختبار الاتصال بقاعدة البيانات</>}
                </button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="animate-in fade-in slide-in-from-left-4 duration-500">
              <h2 className="text-2xl font-bold text-slate-900 mb-6 flex items-center gap-3">
                <Building2 className="text-blue-600" /> الملف التجاري للمؤسسة
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2 flex justify-center mb-4">
                  <label className="relative cursor-pointer group">
                    <div className="w-24 h-24 rounded-3xl bg-slate-100 border-2 border-dashed border-slate-300 flex flex-col items-center justify-center overflow-hidden group-hover:border-blue-500 transition-colors">
                      {logoPreview ? (
                        <img src={logoPreview} className="w-full h-full object-cover" alt="Logo" />
                      ) : (
                        <>
                          <Upload className="text-slate-400 group-hover:text-blue-500" size={24} />
                          <span className="text-[10px] text-slate-400 mt-1">رفع الشعار</span>
                        </>
                      )}
                    </div>
                    <input type="file" className="hidden" accept="image/*" onChange={handleLogoUpload} />
                  </label>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 mr-2">اسم الشركة / المؤسسة</label>
                  <input 
                    type="text" 
                    value={formData.companyName}
                    onChange={(e) => setFormData({...formData, companyName: e.target.value})}
                    className="w-full bg-slate-50 border-none rounded-2xl py-3 px-4 text-sm focus:ring-2 ring-blue-500/20" 
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 mr-2">رقم الهاتف</label>
                  <input 
                    type="text" 
                    value={formData.companyPhone}
                    onChange={(e) => setFormData({...formData, companyPhone: e.target.value})}
                    className="w-full bg-slate-50 border-none rounded-2xl py-3 px-4 text-sm focus:ring-2 ring-blue-500/20" 
                  />
                </div>
                <div className="md:col-span-2 space-y-1">
                  <label className="text-xs font-bold text-slate-500 mr-2">العنوان بالكامل</label>
                  <input 
                    type="text" 
                    value={formData.companyAddress}
                    onChange={(e) => setFormData({...formData, companyAddress: e.target.value})}
                    className="w-full bg-slate-50 border-none rounded-2xl py-3 px-4 text-sm focus:ring-2 ring-blue-500/20" 
                  />
                </div>
                <div className="md:col-span-2 space-y-1">
                  <label className="text-xs font-bold text-slate-500 mr-2 flex items-center gap-2">
                    <FileText size={14} className="text-blue-500" /> سياسة الاستخدام / شروط الفاتورة
                  </label>
                  <textarea 
                    rows={4}
                    value={formData.companyTerms}
                    onChange={(e) => setFormData({...formData, companyTerms: e.target.value})}
                    placeholder="اكتب شروط الاستخدام أو سياسة الاسترجاع هنا..."
                    className="w-full bg-slate-50 border-none rounded-2xl py-3 px-4 text-sm focus:ring-2 ring-blue-500/20 resize-none" 
                  ></textarea>
                </div>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="animate-in fade-in slide-in-from-left-4 duration-500">
              <h2 className="text-2xl font-bold text-slate-900 mb-6 flex items-center gap-3">
                <UserPlus className="text-blue-600" /> حساب مدير النظام (Full Access)
              </h2>
              <div className="space-y-4 max-w-md">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 mr-2">الاسم الكامل للمدير</label>
                  <input 
                    type="text" 
                    value={formData.adminName}
                    onChange={(e) => setFormData({...formData, adminName: e.target.value})}
                    className="w-full bg-slate-50 border-none rounded-2xl py-3 px-4 text-sm focus:ring-2 ring-blue-500/20" 
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 mr-2">اسم تسجيل الدخول</label>
                  <input 
                    type="text" 
                    value={formData.adminUsername}
                    onChange={(e) => setFormData({...formData, adminUsername: e.target.value})}
                    className="w-full bg-slate-50 border-none rounded-2xl py-3 px-4 text-sm focus:ring-2 ring-blue-500/20" 
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 mr-2">كلمة المرور</label>
                  <input 
                    type="password" 
                    value={formData.adminPass}
                    onChange={(e) => setFormData({...formData, adminPass: e.target.value})}
                    className="w-full bg-slate-50 border-none rounded-2xl py-3 px-4 text-sm focus:ring-2 ring-blue-500/20" 
                  />
                </div>
              </div>
            </div>
          )}

          {step === 5 && (
            <div className="animate-in fade-in slide-in-from-left-4 duration-500">
              <h2 className="text-2xl font-bold text-slate-900 mb-6 flex items-center gap-3">
                <ShieldCheck className="text-emerald-600" /> نافذة تفعيل المنتج
              </h2>
              <div className="bg-slate-50 p-6 rounded-3xl border-2 border-dashed border-slate-200 text-center mb-6">
                 <ShieldCheck className="w-16 h-16 text-emerald-500 mx-auto mb-4" />
                 <p className="text-sm text-slate-600 mb-2">سيتم التحقق من الترخيص تلقائياً عند إنهاء التثبيت.</p>
                 <p className="text-xs text-slate-500">تأكد من اتصال الخادم بالإنترنت لإتمام التفعيل.</p>
              </div>
            </div>
          )}

          {step === 6 && (
            <div className="text-center animate-in zoom-in duration-500">
              <div className="w-24 h-24 bg-blue-100 rounded-[2rem] flex items-center justify-center mx-auto mb-8">
                <Activity className="text-blue-600 w-12 h-12 animate-pulse" />
              </div>
              <h2 className="text-3xl font-black text-slate-900 mb-4">جاهز للانطلاق!</h2>
              {loading ? (
                <div className="w-full max-w-xs mx-auto">
                   <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden mb-2">
                      <div className="h-full bg-blue-600 animate-progress"></div>
                   </div>
                   <p className="text-xs font-bold text-blue-600 animate-pulse">جاري بناء قاعدة البيانات...</p>
                </div>
              ) : (
                <button 
                  onClick={handleFinish}
                  className="bg-blue-600 text-white px-12 py-4 rounded-2xl font-bold hover:bg-blue-700 transition-all shadow-xl shadow-blue-500/30"
                >
                  إنهاء التثبيت والبدء
                </button>
              )}
            </div>
          )}

          {step > 1 && step < 6 && (
            <div className="mt-12 flex justify-between items-center pt-8 border-t border-slate-100">
              <button onClick={prevStep} className="flex items-center gap-2 text-slate-400 font-bold hover:text-slate-900 transition-colors">
                <ChevronRight size={20} /> السابق
              </button>
              <button 
                onClick={nextStep} 
                disabled={step === 2 && !(dbTestResult && dbTestResult.success)}
                className="bg-blue-600 text-white px-8 py-3 rounded-2xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/10 disabled:bg-slate-300 disabled:shadow-none disabled:cursor-not-allowed"
              >
                التالي
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SetupWizard;

