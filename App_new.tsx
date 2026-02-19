import React, { useState, useEffect, useCallback } from 'react';
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
import WorkersModule from './components/WorkersModule';
import RepresentativesModule from './components/RepresentativesModule';
import SettingsModule from './components/SettingsModule';
import ReportsModule from './components/ReportsModule';
import SalesDaily from './components/SalesDaily.tsx';
import SalesUpdateStatus from './components/SalesUpdateStatus';
import SalesReport from './components/SalesReport';
import SalesDailyClose from './components/SalesDailyClose';
import AttendanceModule from './components/AttendanceModule';
import Profile from './components/Profile';
import { ThemeProvider } from './components/ThemeContext';
import { API_BASE_PATH, testConnection } from './services/apiConfig';
// Manufacturing pages
import FabricsPage from './components/manufacturing/FabricsPage';
import AccessoriesPage from './components/manufacturing/AccessoriesPage';
import ProductsPage from './components/manufacturing/ProductsPage';
import ProductionStagesPage from './components/manufacturing/ProductionStagesPage';
import ColorsPage from './components/manufacturing/ColorsPage';
import SizesPage from './components/manufacturing/SizesPage';
import CuttingStagePage from './components/manufacturing/CuttingStagePage';
import ManufacturingStagesPage from './components/manufacturing/ManufacturingStagesPage';
import AssemblyPage from './components/manufacturing/AssemblyPage';
import SendProductsPage from './components/manufacturing/SendProductsPage';
import ReceiveFromFactoryPage from './components/manufacturing/ReceiveFromFactoryPage';
import BarcodePrintPage from './components/BarcodePrintPage';
import SalesOffices from './components/SalesOffices';
import BrandedWelcome from './components/BrandedWelcome';
import PointOfSale from './components/PointOfSale';
import ShippingCompaniesModule from './components/ShippingCompaniesModule.tsx';

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

const App_new: React.FC = () => {
  const [appStatus, setAppStatus] = useState<'loading' | 'not_installed' | 'error' | 'ready'>('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [activeSlug, setActiveSlug] = useState('dashboard');
  const [activeSubSlug, setActiveSubSlug] = useState('');
  const [userPages, setUserPages] = useState<any[]>([]);

  const formatActivationStatus = (type: string, accountStatus: string, isExpired: string | boolean) => {
    const expired = isExpired === true || isExpired === 'true';
    if (expired) return 'منتهي';
    if ((accountStatus || '').toLowerCase() === 'blocked') return 'محظور';
    if ((type || '').toLowerCase() === 'trial') return 'تجريبية';
    if (type) return 'كاملة';
    return 'غير معروف';
  };

  // Verify installation / activation with the backend. Placed in component scope so hooks are used correctly.
  const verifyInstallation = useCallback(async () => {
    // First test the connection
    const isConnected = await testConnection();
    if (!isConnected) {
      setErrorMessage('Cannot connect to the server. Please ensure XAMPP is running.');
      setAppStatus('error');
      return;
    }

    try {
      const response = await fetch(`${API_BASE_PATH}/verify.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ force: true })
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
        localStorage.setItem('Dragon_company_logo', result.settings.company_logo || '');

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
        if (result.is_logged_in) {
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
  }, []);

  useEffect(() => {
    migrateStorageKeys();
    verifyInstallation();

    // Clear any existing hash from the URL to keep the address clean
    try {
      if (window.location.hash) {
        const cleanUrl = window.location.pathname + window.location.search;
        window.history.replaceState(null, '', cleanUrl);
      }
    } catch (e) { /* ignore */ }
  }, [verifyInstallation]);

  useEffect(() => {
    const fetchPages = async () => {
      try {
        const user = JSON.parse(localStorage.getItem('Dragon_user') || 'null');
        if (!user || !user.id) {
          setUserPages([]);
          return;
        }
        const res = await fetch(`${API_BASE_PATH}/api.php?module=permissions&action=getUserPages&user_id=${user.id}`);
        const j = await res.json();
        if (j && j.success && Array.isArray(j.data)) setUserPages(j.data);
        else setUserPages([]);
      } catch {
        setUserPages([]);
      }
    };

    if (isLoggedIn) fetchPages();
  }, [isLoggedIn]);

  const canAccessPage = (slug: string) => {
    const s = (slug || '').toString().toLowerCase();
    const entry = userPages.find((p: any) => (p.page_slug || '').toString().toLowerCase() === s);
    return entry ? Boolean(entry.can_access) : true;
  };

  const setActiveView = (slug: string, subSlug: string = '') => {
    console.debug('App_new: setActiveView ->', slug, subSlug);
    setActiveSlug(slug);
    setActiveSubSlug(subSlug);
  };

  const handleLogout = () => {
    localStorage.removeItem('Dragon_user');
    setIsLoggedIn(false);
    setActiveSlug('dashboard');
  };

  useEffect(() => {
    const handler = (e: Event) => {
      try {
        const ce = e as CustomEvent;
        const detail: any = (ce as any)?.detail || {};
        const slug = String(detail?.slug || '').trim();
        const subSlug = String(detail?.subSlug || '').trim();
        if (!slug) return;
        setActiveView(slug, subSlug);
      } catch {
        // ignore
      }
    };
    window.addEventListener('nexus:navigate', handler as EventListener);
    return () => window.removeEventListener('nexus:navigate', handler as EventListener);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!isLoggedIn) return;
    const deliveryMethod = (localStorage.getItem('Dragon_delivery_method') || 'reps').toString();
    const hiddenForDirect = ['orders', 'sales', 'reps', 'shipping-companies'];
    const hiddenForShipping = ['pos', 'reps'];
    const hiddenForReps = ['pos', 'shipping-companies'];

    if (deliveryMethod === 'direct' && hiddenForDirect.includes(activeSlug)) {
      setActiveView('pos', '');
      return;
    }
    if (deliveryMethod === 'shipping' && hiddenForShipping.includes(activeSlug)) {
      setActiveView('orders', 'new-order');
      return;
    }
    if (deliveryMethod === 'reps' && hiddenForReps.includes(activeSlug)) {
      setActiveView('orders', 'new-order');
      return;
    }
  }, [activeSlug, isLoggedIn]);

  if (appStatus === 'loading') {
    return <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center"><div className="w-16 h-16 border-8 border-blue-500 border-t-transparent rounded-full animate-spin"></div></div>;
  }

  if (appStatus === 'not_installed') {
    return <SetupWizard onComplete={() => setAppStatus('ready')} />;
  }

  if (appStatus === 'error') {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center p-4 text-center" dir="rtl">
        <div className="bg-white dark:bg-slate-800 p-12 rounded-3xl shadow-lg max-w-lg">
          <h1 className="text-2xl font-bold text-rose-600 mb-4">خطأ في النظام</h1>
          <p className="text-slate-600 dark:text-slate-400 mb-4">{errorMessage}</p>
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4 mb-4 text-right">
            <h2 className="text-sm font-bold text-amber-800 dark:text-amber-400 mb-2">خطوات استكشاف الأخطاء:</h2>
            <ul className="text-xs text-amber-700 dark:text-amber-500 space-y-1">
              <li>• تأكد من تشغيل Apache و MySQL في XAMPP</li>
              <li>• تحقق من أن المشروع موجود في المسار الصحيح</li>
              <li>• تأكد من أن المنفذ 80 متاح</li>
            </ul>
          </div>
          <button
            onClick={() => { setAppStatus('loading'); verifyInstallation(); }}
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
        return canAccessPage('dashboard') ? <Dashboard /> : <BrandedWelcome />;
      case 'crm':
        return <CRMModule initialView={activeSubSlug} />;
      case 'srm':
        return <SRMModule initialView={activeSubSlug} />;
      case 'inventory':
        return <InventoryModule initialView={activeSubSlug} />;
      case 'orders':
        return <OrdersModule initialView={activeSubSlug} />;
      case 'pos':
        return <PointOfSale />;
      case 'reps':
        return <RepresentativesModule initialView={activeSubSlug} />;
      case 'shipping-companies':
        return <ShippingCompaniesModule />;
      case 'sales':
        switch (activeSubSlug) {
          case 'sales-daily': return <SalesDaily />;
          case 'sales-update-status': return <SalesUpdateStatus />;
          case 'close-daily': return <SalesDailyClose />;
          case 'sales-report': return <SalesReport />;          
          default: return <SalesDaily />;
        }
      case 'sales-offices':
        return <SalesOffices />;
      case 'hrm':
        return <HRMModule initialView={activeSubSlug} />;
      case 'workers':
        return <WorkersModule initialView={activeSubSlug} />;
      case 'finance':
        return <FinanceModule initialView={activeSubSlug} />;
      case 'admin':
        return <AdminModule initialView={activeSubSlug} />;
      case 'settings':
        return <SettingsModule />;
      case 'reports':
        return <ReportsModule initialView={activeSubSlug} />;
      case 'attendance':
        return <AttendanceModule initialTab={activeSubSlug} />;
      case 'barcode-print':
        return <BarcodePrintPage />;
      case 'profile':
        return <Profile />;
      // Manufacturing pages routing
      case 'factory-stock':
        switch (activeSubSlug) {
          case 'fabrics': return <FabricsPage />;
          case 'accessories': return <AccessoriesPage />;
          case 'products': return <ProductsPage />;
          default: return <FabricsPage />;
        }
      case 'factory-management':
        switch (activeSubSlug) {
          case 'production-stages': return <ProductionStagesPage />;
          case 'colors': return <ColorsPage />;
          case 'sizes': return <SizesPage />;
          default: return <ProductionStagesPage />;
        }
      case 'manufacturing-management':
        switch (activeSubSlug) {
          case 'cutting-stage': return <CuttingStagePage />;
          case 'manufacturing-stages': return <ManufacturingStagesPage />;
          case 'assembly': return <AssemblyPage />;
          default: return <CuttingStagePage />;
        }
      case 'dispatch':
        return <SendProductsPage />;
      case 'factory-receiving':
        return <ReceiveFromFactoryPage />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <ThemeProvider>
      <Layout
        activeSlug={activeSlug}
        activeSubSlug={activeSubSlug}
        setActiveView={setActiveView}
        onLogout={handleLogout}
      >
        {renderContent()}
      </Layout>
    </ThemeProvider>
  );
};

export default App_new;