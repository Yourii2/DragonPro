
import React, { useState } from 'react';
import { Lock, User, Code, LogIn, ShieldCheck } from 'lucide-react';
import { API_BASE_PATH } from '../services/apiConfig';
import { assetUrl } from '../services/assetUrl';

interface LoginProps {
  onLogin: () => void;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [loading, setLoading] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const companyLogo = (typeof window !== 'undefined' ? localStorage.getItem('Dragon_company_logo') : null) || assetUrl('Dragon.png');
  const companyName = (typeof window !== 'undefined' ? localStorage.getItem('Dragon_company_name') : null) || 'دراجون برو';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetch(`${API_BASE_PATH}/login.php`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Login failed.');
      }

      localStorage.setItem('Dragon_user', JSON.stringify(result.user));
      onLogin();

    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-app flex items-center justify-center p-4 font-['Cairo'] transition-colors duration-300" dir="rtl">
      <div className="card w-full max-w-md rounded-3xl shadow-2xl shadow-blue-500/12 p-8 md:p-12 relative overflow-hidden border border-card">
        
        {/* Decorative Background */}
        <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-br from-blue-500/10 to-purple-500/10 rounded-full -mr-20 -mt-20 blur-3xl"></div>
        <div className="absolute bottom-0 left-0 w-40 h-40 bg-gradient-to-br from-blue-500/10 to-purple-500/10 rounded-full -ml-20 -mb-20 blur-3xl"></div>

        <div className="text-center mb-10 relative z-10">
          <div className="mb-6 flex justify-center">
            <div className="relative group">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl blur-xl opacity-30 group-hover:opacity-50 transition-opacity"></div>
              <img src={companyLogo} className="relative h-20 w-20 rounded-2xl object-cover border-4 border-white dark:border-slate-700 shadow-xl p-1.5" alt="Logo" onError={(e:any)=>{e.target.src=assetUrl('Dragon.png')}} />
            </div>
          </div>
          <h1 className="text-3xl font-black bg-clip-text text-transparent" style={{ backgroundImage: 'linear-gradient(90deg, rgba(15,23,42,1) 0%, rgba(37,99,235,1) 50%)' }}>{companyName}</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-3 font-medium">يرجى تسجيل الدخول للوصول للوحة التحكم 🔐</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6 relative z-10">
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-600 dark:text-slate-400 mr-2 flex items-center gap-2">
              <User size={15} className="text-blue-600 dark:text-blue-400" /> اسم المستخدم
            </label>
            <div className="relative group">
              <input 
                type="text" 
                required
                className="w-full bg-slate-100/80 dark:bg-slate-900/80 backdrop-blur-sm border-2 border-transparent focus:border-blue-500/50 dark:focus:border-blue-400/50 rounded-xl py-4 px-6 text-sm focus:ring-4 ring-blue-500/10 dark:ring-blue-400/10 transition-all text-right text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 shadow-inner" 
                placeholder="Username"
                value={username}
                onChange={e => setUsername(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-600 dark:text-slate-400 mr-2 flex items-center gap-2">
              <Lock size={15} className="text-blue-600 dark:text-blue-400" /> كلمة المرور
            </label>
            <div className="relative group">
              <input 
                type="password" 
                required
                className="w-full bg-slate-100/80 dark:bg-slate-900/80 backdrop-blur-sm border-2 border-transparent focus:border-blue-500/50 dark:focus:border-blue-400/50 rounded-xl py-4 px-6 text-sm focus:ring-4 ring-blue-500/10 dark:ring-blue-400/10 transition-all text-right text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 shadow-inner" 
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
              />
            </div>
          </div>

          {error && (
            <div className="bg-gradient-to-l from-rose-50 to-red-50 dark:from-rose-900/30 dark:to-red-900/30 text-rose-700 dark:text-rose-400 text-xs font-bold p-4 rounded-xl text-center border border-rose-200/50 dark:border-rose-800/50 shadow-lg">
              ⚠️ {error}
            </div>
          )}
          <div className="flex items-center justify-between px-2">
            <label className="flex items-center gap-2.5 cursor-pointer group">
              <input type="checkbox" className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300 dark:border-slate-600 cursor-pointer" />
              <span className="text-xs text-slate-600 dark:text-slate-400 font-medium group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">تذكرني</span>
            </label>
            <button type="button" className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline transition-colors">نسيت كلمة المرور؟</button>
          </div>

          <button 
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-l from-blue-600 to-blue-500 text-white py-4 rounded-xl font-bold text-lg hover:from-blue-700 hover:to-blue-600 transition-all shadow-xl shadow-blue-500/40 dark:shadow-blue-900/40 flex items-center justify-center gap-2.5 disabled:opacity-70 hover:scale-[1.02] active:scale-95 disabled:hover:scale-100"
          >
            {loading ? (
              <div className="w-6 h-6 border-4 border-white border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <>
                <LogIn size={22} /> تسجيل الدخول
              </>
            )}
          </button>
        </form>

        <div className="mt-10 pt-8 border-t border-gradient-to-r from-transparent via-slate-200 dark:via-slate-700 to-transparent text-center relative z-10">
           <div className="inline-flex items-center gap-2.5 bg-gradient-to-l from-emerald-50 to-green-50 dark:from-emerald-900/30 dark:to-green-900/30 text-emerald-700 dark:text-emerald-400 px-5 py-2 rounded-full text-[11px] font-bold border border-emerald-200/50 dark:border-emerald-800/50 shadow-md">
              <ShieldCheck size={16} /> نسخة مرخصة ومحمية ✅
           </div>
        </div>
      </div>
    </div>
  );
};

export default Login;

