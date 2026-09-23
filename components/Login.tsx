import React, { useState } from 'react';
import { Lock, User, LogIn, ShieldCheck, Eye, EyeOff, Sparkles, Zap, Cpu, CheckCircle2, ArrowRight } from 'lucide-react';
import Swal from 'sweetalert2';
import { API_BASE_PATH } from '../services/apiConfig';
import { assetUrl } from '../services/assetUrl';

interface LoginProps {
  onLogin: () => void;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const dragonLogo = assetUrl('Dragon.png');
  const dragonCompanyName = 'شركة دراجون للأنظمة الأمنية';
  const clientCompanyName = (typeof window !== 'undefined' ? localStorage.getItem('Dragon_company_name') : null) || '';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError('يرجى كتابة اسم المستخدم وكلمة المرور');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch(`${API_BASE_PATH}/login.php`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username: username.trim(), password }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || 'بيانات الدخول غير صحيحة، يرجى المحاولة ثانية.');
      }

      localStorage.setItem('Dragon_user', JSON.stringify(result.user));
      onLogin();

    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleForgot = async () => {
    const { value: formValues } = await Swal.fire({
      title: 'إعادة تعيين كلمة المرور',
      html:
        `<input id="swal-username" class="swal2-input" placeholder="اسم المستخدم">` +
        `<input id="swal-new" type="password" class="swal2-input" placeholder="كلمة المرور الجديدة">` +
        `<input id="swal-confirm" type="password" class="swal2-input" placeholder="تأكيد كلمة المرور">`,
      focusConfirm: false,
      showCancelButton: true,
      confirmButtonText: 'متابعة',
      cancelButtonText: 'إلغاء',
      preConfirm: () => {
        const u = (document.getElementById('swal-username') as HTMLInputElement).value;
        const np = (document.getElementById('swal-new') as HTMLInputElement).value;
        const cp = (document.getElementById('swal-confirm') as HTMLInputElement).value;
        if (!u || !np) {
          Swal.showValidationMessage('الرجاء إدخال اسم المستخدم وكلمة مرور جديدة');
          return null;
        }
        if (np !== cp) {
          Swal.showValidationMessage('كلمتا المرور غير متطابقتين');
          return null;
        }
        return { username: u, new_password: np };
      }
    });

    if (!formValues) return;

    const { value: dragon } = await Swal.fire({
      title: 'كلمة مرور الحماية (Dragon)',
      input: 'password',
      inputPlaceholder: 'أدخل كلمة مرور النظام الرئيسية',
      showCancelButton: true,
      confirmButtonText: 'تأكيد',
      cancelButtonText: 'إلغاء',
      inputAttributes: { autocapitalize: 'off' }
    });
    if (!dragon) return;

    try {
      const resp = await fetch(`${API_BASE_PATH}/../scripts/reset_user_password.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: formValues.username, new_password: formValues.new_password, dragon_password: dragon })
      });
      const j = await resp.json();
      if (!resp.ok || !j.success) {
        Swal.fire('فشل', j.message || 'تعذر إعادة التعيين', 'error');
        return;
      }
      Swal.fire('تم بنجاح', 'تم تغيير كلمة المرور بنجاح، يمكنك تسجيل الدخول الآن.', 'success');
    } catch (e: any) {
      Swal.fire('خطأ', e?.message || 'خطأ في الاتصال بالخادم', 'error');
    }
  };

  return (
    <div className="min-h-screen relative flex items-center justify-center p-4 sm:p-6 md:p-10 font-['Cairo'] overflow-hidden bg-slate-950 text-slate-100 selection:bg-indigo-500 selection:text-white" dir="rtl">
      
      {/* Dynamic Ambient Background Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-32 -left-32 w-96 h-96 bg-gradient-to-br from-indigo-600/30 to-purple-600/20 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute top-1/2 -right-32 w-[30rem] h-[30rem] bg-gradient-to-br from-blue-600/25 via-cyan-500/20 to-emerald-500/15 rounded-full blur-[140px] animate-pulse" style={{ animationDuration: '8s' }} />
        <div className="absolute -bottom-32 left-1/3 w-96 h-96 bg-gradient-to-tr from-violet-600/25 to-pink-500/15 rounded-full blur-[120px]" />
        
        {/* Subtle Cyber Grid */}
        <div 
          className="absolute inset-0 opacity-[0.03] dark:opacity-[0.05]" 
          style={{ 
            backgroundImage: `radial-gradient(circle at 1px 1px, #ffffff 1px, transparent 0)`,
            backgroundSize: '32px 32px' 
          }} 
        />
      </div>

      {/* Main Glass Citadel Container */}
      <div className="w-full max-w-5xl rounded-[2.5rem] bg-slate-900/60 backdrop-blur-2xl border border-white/10 shadow-[0_25px_70px_rgba(0,0,0,0.55)] overflow-hidden relative z-10 grid grid-cols-1 lg:grid-cols-12 transition-all">
        
        {/* Left Side: DragonPro V2 Feature Showcase (Desktop) */}
        <div className="lg:col-span-5 relative hidden lg:flex flex-col justify-between p-10 bg-gradient-to-b from-indigo-950/60 via-slate-900/40 to-slate-950/80 border-l border-white/5 overflow-hidden">
          <div className="absolute -right-20 -bottom-20 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

          {/* Top Badge */}
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-gradient-to-r from-amber-400/20 via-indigo-500/20 to-purple-500/20 border border-amber-400/30 text-amber-300 shadow-sm backdrop-blur-md">
              <Sparkles size={13} className="text-amber-400 animate-spin" style={{ animationDuration: '6s' }} />
              DragonPro V2 • Next-Gen Engine
            </span>
          </div>

          {/* Showcase Center Content */}
          <div className="my-auto space-y-6">
            <div className="relative inline-block">
              <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-indigo-500 via-blue-600 to-purple-600 p-0.5 shadow-2xl shadow-indigo-500/30 flex items-center justify-center">
                <div className="w-full h-full bg-slate-950/90 rounded-[22px] flex items-center justify-center p-3">
                  <img 
                    src={dragonLogo} 
                    alt="Dragon Logo" 
                    className="w-full h-full object-contain filter drop-shadow-md"
                    onError={(e: any) => { e.target.src = 'Dragon.png'; }} 
                  />
                </div>
              </div>
              <div className="absolute -bottom-2 -left-2 bg-gradient-to-r from-cyan-400 to-blue-500 text-slate-950 text-[10px] font-black px-2 py-0.5 rounded-full shadow-lg">
                V2.0 PRO
              </div>
            </div>

            <div>
              <h2 className="text-3xl font-black tracking-tight text-white flex items-center gap-2">
                <span>{dragonCompanyName}</span>
              </h2>
              <div className="text-indigo-400 font-bold text-sm mt-1">DragonPro V2 • Security & Management Systems</div>
              <p className="text-slate-400 text-xs mt-2 leading-relaxed font-medium">
                المنظومة السحابية المتكاملة لإدارة المنشآت والعمليات الأمنية والتجارية بأعلى كفاءة وسرعة استجابة.
              </p>
            </div>

            {/* V2 Pillar Highlights */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center gap-3 p-3 rounded-2xl bg-white/[0.03] border border-white/5 hover:border-indigo-500/30 transition-colors">
                <div className="w-9 h-9 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center shrink-0 border border-indigo-500/20">
                  <Zap size={18} />
                </div>
                <div className="text-right">
                  <div className="text-xs font-black text-slate-200">أداء فائق واستجابة لحظية</div>
                  <div className="text-[10px] text-slate-400">تقسيم حزم برمجية وكاش ذكي يحقق سرعة 0ms</div>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 rounded-2xl bg-white/[0.03] border border-white/5 hover:border-emerald-500/30 transition-colors">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/20">
                  <Cpu size={18} />
                </div>
                <div className="text-right">
                  <div className="text-xs font-black text-slate-200">دقة حسابية متقدمة</div>
                  <div className="text-[10px] text-slate-400">فصل دقيق للتسليم والارتجاع الكامل والجزئي</div>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 rounded-2xl bg-white/[0.03] border border-white/5 hover:border-blue-500/30 transition-colors">
                <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center shrink-0 border border-blue-500/20">
                  <ShieldCheck size={18} />
                </div>
                <div className="text-right">
                  <div className="text-xs font-black text-slate-200">حماية وتشفير متكامل</div>
                  <div className="text-[10px] text-slate-400">ترخيص رسمي معزول ومحمي بأحدث معايير الأمان</div>
                </div>
              </div>
            </div>
          </div>

          {/* Status Indicator */}
          <div className="flex items-center justify-between text-[11px] text-slate-400 pt-4 border-t border-white/5">
            <span className="flex items-center gap-2 font-bold text-emerald-400">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              النظام متصل وجاهز للعمل
            </span>
            <span className="text-slate-500 font-mono">v2.0.0</span>
          </div>
        </div>

        {/* Right Side: Login Portal Form */}
        <div className="lg:col-span-7 p-7 sm:p-10 md:p-12 flex flex-col justify-center relative">
          
          {/* Mobile Header Branding */}
          <div className="text-center mb-8 lg:text-right">
            <div className="inline-flex lg:hidden items-center gap-3 mb-4 p-2.5 px-4 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 backdrop-blur-md">
              <img 
                src={dragonLogo} 
                alt="Dragon Logo" 
                className="w-10 h-10 object-contain"
                onError={(e: any) => { e.target.src = 'Dragon.png'; }} 
              />
              <div className="text-right">
                <div className="text-xs font-black text-white">{dragonCompanyName}</div>
                <div className="text-[10px] font-bold text-indigo-400">DragonPro V2</div>
              </div>
              <span className="mr-auto text-[10px] font-black text-amber-300 bg-amber-400/10 px-2 py-0.5 rounded-full border border-amber-400/20">V2.0</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight flex items-center justify-center lg:justify-start gap-2">
              تسجيل الدخول للنظام
            </h1>
            <p className="text-slate-400 text-xs sm:text-sm mt-1.5 font-medium">
              أدخل بيانات حسابك المعتمدة للمتابعة إلى لوحة القيادة
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            
            {/* Username Field */}
            <div className="space-y-1.5 text-right">
              <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5 mr-1">
                <User size={14} className="text-indigo-400" />
                اسم المستخدم
              </label>
              <div className="relative group">
                <input
                  type="text"
                  required
                  autoFocus
                  className="w-full bg-slate-950/70 border border-white/10 group-hover:border-white/20 focus:border-indigo-500 rounded-2xl py-3.5 px-4 text-sm text-right text-white placeholder:text-slate-500 focus:outline-none focus:ring-4 focus:ring-indigo-500/20 transition-all shadow-inner"
                  placeholder="أدخل اسم المستخدم..."
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="space-y-1.5 text-right">
              <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5 mr-1">
                <Lock size={14} className="text-indigo-400" />
                كلمة المرور
              </label>
              <div className="relative group">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  className="w-full bg-slate-950/70 border border-white/10 group-hover:border-white/20 focus:border-indigo-500 rounded-2xl py-3.5 px-4 pl-12 text-sm text-right text-white placeholder:text-slate-500 focus:outline-none focus:ring-4 focus:ring-indigo-500/20 transition-all shadow-inner"
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors p-1"
                  title={showPassword ? 'إخفاء كلمة المرور' : 'عرض كلمة المرور'}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Error Notification */}
            {error && (
              <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-bold flex items-center gap-2 animate-in fade-in zoom-in-95">
                <span className="text-base">⚠️</span>
                <span>{error}</span>
              </div>
            )}

            {/* Options */}
            <div className="flex items-center justify-between text-xs pt-1 px-1">
              <label className="inline-flex items-center gap-2 cursor-pointer select-none text-slate-400 hover:text-slate-200 transition-colors">
                <input 
                  type="checkbox" 
                  defaultChecked
                  className="w-4 h-4 rounded-md border-slate-700 bg-slate-950 text-indigo-600 focus:ring-indigo-500/30 focus:ring-offset-0 cursor-pointer" 
                />
                <span>تذكر تسجيل الدخول</span>
              </label>
              <button
                type="button"
                onClick={handleForgot}
                className="text-indigo-400 hover:text-indigo-300 font-bold transition-colors"
              >
                نسيت كلمة المرور؟
              </button>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full relative overflow-hidden py-4 rounded-2xl font-black text-sm text-white bg-gradient-to-r from-indigo-600 via-blue-600 to-indigo-600 hover:from-indigo-500 hover:via-blue-500 hover:to-indigo-500 transition-all duration-300 shadow-lg shadow-indigo-600/30 hover:shadow-indigo-600/50 hover:scale-[1.01] active:scale-[0.98] disabled:opacity-60 disabled:pointer-events-none flex items-center justify-center gap-2 group"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <span>دخول إلى النظام</span>
                  <LogIn size={18} className="transition-transform group-hover:-translate-x-1" />
                </>
              )}
            </button>
          </form>

          {/* Footer Badge */}
          <div className="mt-8 pt-6 border-t border-white/5 flex flex-wrap items-center justify-between gap-3 text-[11px] text-slate-500">
            <div className="inline-flex items-center gap-1.5 text-emerald-400/90 font-medium">
              <CheckCircle2 size={14} className="text-emerald-400" />
              <span>
                {clientCompanyName ? `نسخة مرخصة لـ ${clientCompanyName}` : 'نسخة معتمدة ومفعلة'}
              </span>
            </div>
            <div className="font-mono text-slate-400 font-bold">
              {dragonCompanyName} • V2
            </div>
          </div>

        </div>

      </div>

    </div>
  );
};

export default Login;
