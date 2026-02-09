
import React, { useState, useEffect } from 'react';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import Login from './components/Login';
import SetupWizard from './components/SetupWizard';
import CRMModule from './components/CRMModule';
import SRMModule from './components/SRMModule';
import InventoryModule from './components/InventoryModule';
import OrdersModule from './components/SalesModule';
import AdminModule from './components/AdminModule';
import FinanceModule from './components/FinanceModule';
import HRMModule from './components/HRMModule';
import RepresentativesModule from './components/RepresentativesModule';
import SettingsModule from './components/SettingsModule';
import SalesDaily from './components/SalesDaily';
import SalesUpdateStatus from './components/SalesUpdateStatus';
import SalesReport from './components/SalesReport';
import AttendanceModule from './components/AttendanceModule';
import SalesOffices from './components/SalesOffices';
import { API_BASE_PATH, testConnection } from './services/apiConfig';
import Swal from 'sweetalert2';

const migrateStorageKeys = () => {
  if (typeof window === 'undefined') return;
  try {
    const keyMap: Record<string, string> = {
      nexus_installed: 'Dragon_installed',
      nexus_company_name: 'Dragon_company_name',
      nexus_company_phone: 'Dragon_company_phone',
      nexus_company_address: 'Dragon_company_address',
      nexus_company_terms: 'Dragon_company_terms',
      nexus_company_logo: 'Dragon_company_logo',
      nexus_tax_rate: 'Dragon_tax_rate',
      nexus_currency: 'Dragon_currency',
      nexus_auto_backup: 'Dragon_auto_backup',
      nexus_backup_freq: 'Dragon_backup_freq',
      nexus_backup_email: 'Dragon_backup_email',
      nexus_backup_email_verified: 'Dragon_backup_email_verified',
      nexus_activation: 'Dragon_activation',
      nexus_user: 'Dragon_user',
      nexus_theme: 'Dragon_theme',
      nexus_notif_read_ids: 'Dragon_notif_read_ids'
    };

    Object.entries(keyMap).forEach(([oldKey, newKey]) => {
      const oldVal = localStorage.getItem(oldKey);
      if (oldVal !== null && localStorage.getItem(newKey) === null) {
        localStorage.setItem(newKey, oldVal);
      }
      if (oldVal !== null) {
        localStorage.removeItem(oldKey);
      }
    });

    const sessionKeyMap: Record<string, string> = {
      nexus_user_permissions: 'Dragon_user_permissions'
    };
    Object.entries(sessionKeyMap).forEach(([oldKey, newKey]) => {
      const oldVal = sessionStorage.getItem(oldKey);
      if (oldVal !== null && sessionStorage.getItem(newKey) === null) {
        sessionStorage.setItem(newKey, oldVal);
      }
      if (oldVal !== null) {
        sessionStorage.removeItem(oldKey);
      }
    });
  } catch (e) {
    // ignore storage failures
  }
};

const App: React.FC = () => {
  const [appStatus, setAppStatus] = useState<'loading' | 'not_installed' | 'error' | 'ready'>('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [activeSlug, setActiveSlug] = useState('dashboard');
  const [activeSubSlug, setActiveSubSlug] = useState('');
  const [isDark, setIsDark] = useState(false);

  const formatActivationStatus = (type: string, accountStatus: string, isExpired: string | boolean) => {
    const expired = isExpired === true || isExpired === 'true';
    if (expired) return 'منتهي';
    if ((accountStatus || '').toLowerCase() === 'blocked') return 'محظور';
    if ((type || '').toLowerCase() === 'trial') return 'تجريبية';
    if (type) return 'كاملة';
    return 'غير معروف';
  };

  useEffect(() => {
    migrateStorageKeys();
    if (!(window as any).__DragonFetchWrapped) {
      const originalFetch = window.fetch.bind(window);
      (window as any).__DragonFetchWrapped = true;
      window.fetch = (async (...args: any[]) => {
        const res = await originalFetch(...args);
        if (res.status === 403) {
          try {
            const clone = res.clone();
            const js = await clone.json();
            Swal.fire('ممنوع', js?.message || 'ليس لديك صلاحيات للقيام بذلك.', 'error');
          } catch (e) {
            Swal.fire('ممنوع', 'ليس لديك صلاحيات للقيام بذلك.', 'error');
          }
        }
        return res;
      }) as any;
    }

    const verifyInstallation = async () => {
      try {
        const response = await fetch(`${API_BASE_PATH}/verify.php`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        });
        const result = await response.json();

        if (result.status === 'not_installed') {
          setAppStatus('not_installed');
        } else if (result.status === 'activation_blocked' || result.status === 'activation_expired') {
          setErrorMessage(result.message || 'ترخيص غير صالح.');
          setAppStatus('error');
        } else if (result.status === 'invalid_device' || result.status === 'tampered') {
          setErrorMessage(result.message || 'تعذر التحقق من الترخيص.');
          setAppStatus('error');
        } else if (result.status === 'ok') {
          // Store settings from backend
          localStorage.setItem('Dragon_company_name', result.settings.company_name || '');
          localStorage.setItem('Dragon_company_phone', result.settings.company_phone || '');
          localStorage.setItem('Dragon_company_address', result.settings.company_address || '');
          localStorage.setItem('Dragon_company_terms', result.settings.company_terms || '');
          localStorage.setItem('Dragon_company_logo', result.settings.company_logo || '');
          localStorage.setItem('Dragon_tax_rate', result.settings.tax_rate || '14');
          localStorage.setItem('Dragon_currency', result.settings.currency || 'EGP');
          localStorage.setItem('Dragon_auto_backup', result.settings.auto_backup || 'false');
          localStorage.setItem('Dragon_backup_freq', result.settings.backup_frequency || 'daily');

          if (result.activation) {
            localStorage.setItem('Dragon_activation', JSON.stringify({
              status: formatActivationStatus(result.activation.type, result.activation.account_status, result.activation.is_expired),
              expiry: result.activation.expiry || 'غير محدد',
              account_status: result.activation.account_status || 'Active',
              is_expired: result.activation.is_expired || 'false',
              last_check: result.activation.last_check || ''
            }));
          }
          
          setIsLoggedIn(result.is_logged_in);
          if(result.is_logged_in) {
            localStorage.setItem('Dragon_user', JSON.stringify(result.user));
          }
          setAppStatus('ready');
        } else {
          setErrorMessage(result.message || 'An unknown verification error occurred.');
          setAppStatus('error');
        }
      } catch (error) {
        console.error('Verification error:', error);
        setErrorMessage('Cannot connect to the server. Please ensure XAMPP is running.');
        setAppStatus('error');
      }
    };

    verifyInstallation();

    // Sync navigation from URL hash if present
    const applyHash = () => {
      try {
        const hash = window.location.hash || '';
        if (!hash) return;
        const cleaned = hash.replace(/^#/, '');
        const parts = cleaned.split('/');
        const slug = parts[0] || 'dashboard';
        const sub = parts[1] || '';
        setActiveSlug(slug);
        setActiveSubSlug(sub);
      } catch (e) { /* ignore */ }
    };
    applyHash();
    window.addEventListener('hashchange', applyHash);
    return () => window.removeEventListener('hashchange', applyHash);

    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDark]);

  const setActiveView = (slug: string, subSlug: string = '') => {
    console.debug('App: setActiveView ->', slug, subSlug);
    setActiveSlug(slug);
    setActiveSubSlug(subSlug);
  };

  const handleLogout = () => {
    localStorage.removeItem('Dragon_user');
    setIsLoggedIn(false);
    setActiveSlug('dashboard');
  };

  if (appStatus === 'loading') {
    return <div className="min-h-screen bg-slate-50 flex items-center justify-center"><div className="w-16 h-16 border-8 border-blue-500 border-t-transparent rounded-full animate-spin"></div></div>;
  }

  if (appStatus === 'not_installed') {
    return <SetupWizard onComplete={() => setAppStatus('ready')} />;
  }

  if (appStatus === 'error') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 text-center" dir="rtl">
        <div className="bg-white p-12 rounded-3xl shadow-lg max-w-lg">
          <h1 className="text-2xl font-bold text-rose-600 mb-4">خطأ في النظام</h1>
          <p className="text-slate-600 mb-4">{errorMessage}</p>
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4 text-right">
            <h2 className="text-sm font-bold text-amber-800 mb-2">خطوات استكشاف الأخطاء:</h2>
            <ul className="text-xs text-amber-700 space-y-1">
              <li>• تأكد من تشغيل Apache و MySQL في XAMPP</li>
              <li>• تحقق من أن المشروع موجود في المسار الصحيح</li>
              <li>• تأكد من أن المنفذ 80 متاح</li>
            </ul>
          </div>
          <button 
            onClick={() => window.location.reload()}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-xl transition-colors"
          >
            إعادة المحاولة
          </button>
          <p className="text-xs text-slate-400 mt-4">إذا استمرت المشكلة، يرجى محاولة مسح بيانات التخزين المحلي للمتصفح.</p>
        </div>
      </div>
    );
  }

  if (!isLoggedIn) {
    return <Login onLogin={() => setIsLoggedIn(true)} />;
  }


  const renderContent = () => {
    switch (activeSlug) {
      case 'dashboard':
        return <Dashboard />;
      case 'crm':
        return <CRMModule initialView={activeSubSlug} />;
      case 'srm':
        return <SRMModule initialView={activeSubSlug} />;
      case 'inventory':
        return <InventoryModule initialView={activeSubSlug} />;
      case 'orders':
        return <OrdersModule initialView={activeSubSlug} />;
      case 'reps':
        return <RepresentativesModule initialView={activeSubSlug} />;
      case 'sales':
        switch (activeSubSlug) {
          case 'sales-daily': return <SalesDaily />;
          case 'sales-update-status': return <SalesUpdateStatus />;
          case 'sales-report': return <SalesReport />;
          default: return <SalesDaily />;
        }
      case 'hrm':
        return <HRMModule initialView={activeSubSlug} />;
      case 'finance':
        return <FinanceModule initialView={activeSubSlug} />;
      case 'admin':
        return <AdminModule initialView={activeSubSlug} />;
      case 'settings':
        return <SettingsModule />;
      case 'attendance':
        return <AttendanceModule initialTab={activeSubSlug} />;
      case 'sales-offices':
        return <SalesOffices />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <Layout 
      activeSlug={activeSlug} 
      activeSubSlug={activeSubSlug}
      setActiveView={setActiveView}
      isDark={isDark}
      toggleDarkMode={() => setIsDark(!isDark)}
      onLogout={handleLogout}
    >
      {renderContent()}
    </Layout>
  );
};

export default App;

