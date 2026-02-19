
import React, { useState, useEffect, useRef } from 'react';
import { 
  Menu, 
  X, 
  Bell, 
  Moon, 
  Sun, 
  LogOut, 
  User as UserIcon,
  ChevronDown,
  ChevronLeft,
  Search,
  Settings as SettingsIcon,
  Code,
  Info
} from 'lucide-react';
import { MENU_ITEMS } from '../constants';
import { API_BASE_PATH } from '../services/apiConfig';
import { assetUrl } from '../services/assetUrl';
import { useTheme } from './ThemeContext';
import Footer from './Footer';
import Swal from 'sweetalert2';

interface LayoutProps {
  children: React.ReactNode;
  activeSlug: string;
  activeSubSlug: string;
  setActiveView: (slug: string, subSlug?: string) => void;
  onLogout: () => void;
}

const Layout: React.FC<LayoutProps> = ({ 
  children, 
  activeSlug,
  activeSubSlug,
  setActiveView, 
  onLogout
}) => {
  const { isDark, toggleTheme } = useTheme();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [allowedModules, setAllowedModules] = useState<string[] | null>(null);
  const [allowedModulesRaw, setAllowedModulesRaw] = useState<any[] | null>(null);
  const [showPermsModal, setShowPermsModal] = useState(false);
  const [openAccordion, setOpenAccordion] = useState<string | null>(null);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const lastNotifIdsRef = useRef<string[]>([]);
  const notifFetchLock = useRef(false);
  const readNotifIdsRef = useRef<Set<string>>(new Set());
  const readNotifKey = 'Dragon_notif_read_ids';
  const lastNotifFetchRef = useRef<number>(0);

  const userData = JSON.parse(localStorage.getItem('Dragon_user') || '{}');
  const companyLogo = assetUrl('Dragon.png');
  const salesDisplayMethod = (localStorage.getItem('Dragon_sales_display_method') || 'company').toString();
  const productSource = (localStorage.getItem('Dragon_product_source') || 'both').toString();
  const deliveryMethod = (localStorage.getItem('Dragon_delivery_method') || 'reps').toString();

  useEffect(() => {
    const handler = (e: any) => {
      try {
        // eslint-disable-next-line no-console
        console.debug('[Layout] themeChange event received', e.detail, 'html.hasDark=', document.documentElement.classList.contains('dark'), 'body.hasDark=', document.body.classList.contains('dark'));
      } catch (err) {}
    };
    window.addEventListener('themeChange', handler);
    return () => window.removeEventListener('themeChange', handler);
  }, []);

  useEffect(() => {
    const fetchAllowed = async () => {
      try {
        const user = JSON.parse(localStorage.getItem('Dragon_user') || 'null');
        const [pagesRes, mRes, pRes] = await Promise.all([
          fetch(`${API_BASE_PATH}/api.php?module=permissions&action=getUserPages&user_id=${user ? user.id : 0}`, { credentials: 'include' }).then(r => r.json()).catch(() => ({ success: false, data: [] })),
          fetch(`${API_BASE_PATH}/api.php?module=permissions&action=getMyModules`, { credentials: 'include' }).then(r => r.json()).catch(() => ({ success: false, data: [] })),
          // also fetch per-action perms to build module list from action entries
          fetch(`${API_BASE_PATH}/api.php?module=permissions&action=getUserPermissions&user_id=${user ? user.id : 0}`, { credentials: 'include' }).then(r => r.json()).catch(() => ({ success: false, data: [] }))
        ]);

        const pages = (pagesRes && pagesRes.success && Array.isArray(pagesRes.data)) ? pagesRes.data : [];
        const myModules = (mRes && mRes.success && Array.isArray(mRes.data)) ? mRes.data : [];
        const userPerms = (pRes && pRes.success && Array.isArray(pRes.data)) ? pRes.data : [];

        setAllowedModulesRaw({ pages, myModules, userPerms });

        // If explicit page permissions exist, prefer them, but allow missing entries by default
        if (pages.length > 0) {
          setAllowedModules([]);
          return;
        }

        // otherwise combine module sources
        const namesFromMy = myModules.map((m: any) => (m.slug || m.name || '').toString().toLowerCase()).filter(Boolean);
        const namesFromPerms = userPerms.map((p: any) => ((p.module_name || p.name || '')).toString().toLowerCase()).filter(Boolean);
        const idsFromPerms = userPerms.map((p: any) => String(p.module_id || '')).filter(Boolean);

        const combined = Array.from(new Set([...namesFromMy, ...namesFromPerms, ...idsFromPerms]));
        setAllowedModules(combined);
      } catch (e) {
        console.error('Failed to fetch allowed modules', e);
        setAllowedModules([]);
        setAllowedModulesRaw(null);
      }
    };
    fetchAllowed();
  }, []);

  const normalize = (v:any) => (v||'').toString().toLowerCase();
  const pageAliases: Record<string, string[]> = {
    crm: ['customers'],
    srm: ['suppliers'],
    finance: ['treasuries', 'transactions'],
    inventory: ['stock', 'products', 'warehouses', 'product_movements'],
    hrm: ['employees'],
    admin: ['users', 'permissions'],
    attendance: ['attendance', 'attendance_devices', 'attendance_device_users', 'attendance_shifts', 'attendance_schedules', 'attendance_holidays', 'attendance_logs', 'attendance_summary'],
    sales: ['orders'],
    dispatch: ['manufacturing-management', 'manufacturing', 'dispatch', 'send_products', 'send_to_sales'],
    'factory-stock': ['fabrics', 'accessories', 'products'],
    'factory-management': ['production-stages', 'colors', 'sizes'],
    'manufacturing-management': ['cutting-stage', 'manufacturing-stages', 'assembly']
		,
		'barcode-print': ['barcode-print', 'barcode', 'print', 'barcodes']
  };

  const isMenuItemAllowed = (item:any) => {
    if (allowedModules === null) return true; // admin or unset -> allow
    const pages = (allowedModulesRaw && allowedModulesRaw.pages) ? allowedModulesRaw.pages : [];
    // If explicit page permissions exist, prefer them
    if (Array.isArray(pages) && pages.length > 0) {
      const candidates = [normalize(item.slug), normalize(item.id), normalize(item.label)];
      const aliasList = pageAliases[normalize(item.slug)] || [];
      candidates.push(...aliasList.map(normalize));
      if (item.subItems) candidates.push(...item.subItems.map((s:any)=>normalize(s.slug)), ...item.subItems.map((s:any)=>normalize(s.label)));
      const entry = pages.find((p:any) => {
        const ps = normalize(p.page_slug);
        if (!ps) return false;
        // exact candidate match
        if (candidates.includes(ps)) return true;
        // contains either direction (handle synonyms like 'suppliers' vs 'srm')
        if (ps.includes(normalize(item.slug)) || normalize(item.slug).includes(ps)) return true;
        if (ps.includes(normalize(item.id)) || normalize(item.id).includes(ps)) return true;
        // check subitems too
        if (item.subItems && item.subItems.some((s:any)=> ps.includes(normalize(s.slug)) || normalize(s.slug).includes(ps) || ps.includes(normalize(s.label)) )) return true;
        return false;
      });
      if (!entry) return true;
      const v = entry.can_access;
      return v === 1 || v === '1' || v === true || v === 'true' || Number(v) === 1;
    }

    // fallback to allowedModules list computed earlier
    const candidates = [normalize(item.slug), normalize(item.id), normalize(item.label)].filter(Boolean);
    const aliasList = pageAliases[normalize(item.slug)] || [];
    candidates.push(...aliasList.map(normalize));
    if (item.subItems) candidates.push(...item.subItems.map((s:any)=>normalize(s.slug)), ...item.subItems.map((s:any)=>normalize(s.label)));

    const allowed = (allowedModules || []).map(normalize);
    const topAllowed = candidates.some(c => allowed.includes(c));
    const anySubAllowed = item.subItems && item.subItems.some((s:any) => allowed.includes(normalize(s.slug)) || allowed.includes(normalize(s.name)));
    return item.slug === 'dashboard' || topAllowed || Boolean(anySubAllowed);
  };

  const handleMainMenuClick = (item: any) => {
    // Prevent navigation to modules the user is not allowed to access
    if (!isMenuItemAllowed(item)) {
      Swal.fire('ممنوع', 'ليس لديك صلاحية الوصول لهذا القسم.', 'error');
      return;
    }
    // If the item has sub-items, treat the header click as accordion toggle only
    // (navigation happens when user clicks a sub-item).
    if (item.subItems) {
      setOpenAccordion(openAccordion === item.id ? null : item.id);
      return;
    }

    console.debug('Layout: main menu click ->', item.slug);
    setOpenAccordion(null);
    setActiveView(item.slug, '');
  };

  useEffect(() => {
    let isMounted = true;

      const applyNotifications = (notifs: any[]) => {
      if (!isMounted) return;
      const currentIds = new Set(notifs.map((n) => String(n.id)));
      // Keep read markers only for currently active notifications
      const trimmedRead = new Set(
        Array.from(readNotifIdsRef.current).filter((id: string) => currentIds.has(id))
      );
      readNotifIdsRef.current = trimmedRead;
      try {
        localStorage.setItem(readNotifKey, JSON.stringify(Array.from(trimmedRead)));
      } catch (e) {
        // ignore storage failures
      }

      const visible = notifs.filter((n) => !trimmedRead.has(String(n.id)));
      setNotifications(visible);
      const prevIds = new Set(lastNotifIdsRef.current);
      const fresh = visible.filter((n) => !prevIds.has(String(n.id)));
      if (fresh.length > 0) {
        Swal.fire({
          toast: true,
          position: 'top-start',
          icon: 'warning',
          title: 'تنبيه جديد',
          text: `لديك ${fresh.length} تنبيه يحتاج المتابعة`,
          showConfirmButton: false,
          timer: 4000,
          timerProgressBar: true
        });
      }
      lastNotifIdsRef.current = visible.map((n) => String(n.id));
      };

      try {
        const stored = JSON.parse(localStorage.getItem(readNotifKey) || '[]');
        if (Array.isArray(stored)) {
          readNotifIdsRef.current = new Set(stored.map((v: any) => String(v)));
        }
      } catch (e) {
        // ignore storage failures
      }

    const fetchLowStock = async () => {
      const now = Date.now();
      if (now - lastNotifFetchRef.current < 60000) return;
      if (notifFetchLock.current) return;
      notifFetchLock.current = true;
      lastNotifFetchRef.current = now;
      try {
        const [productsRes, serverNotifRes] = await Promise.all([
          fetch(`${API_BASE_PATH}/api.php?module=products&action=getAll`, { credentials: 'include' }).then(r => r.json()).catch(() => ({ success: false, data: [] })),
          fetch(`${API_BASE_PATH}/api.php?module=notifications&action=getMy`, { credentials: 'include' }).then(r => r.json()).catch(() => ({ success: false, data: [] })),
        ]);

        const lowStockNotifs = (productsRes?.success && Array.isArray(productsRes?.data))
          ? productsRes.data
              .filter((p: any) => Number(p.stock) <= Number(p.reorderLevel))
              .map((p: any) => ({
                id: `lowstock-${p.id}`,
                title: `انخفاض المخزون: ${p.name}`,
                text: `الكمية المتبقية ${p.stock} (الحد الأدنى ${p.reorderLevel})`,
                product: p
              }))
          : [];

        const serverNotifs = (serverNotifRes?.success && Array.isArray(serverNotifRes?.data))
          ? serverNotifRes.data.map((n: any) => ({
              id: `srv-${n.id}`,
              title: String(n.title || 'إشعار'),
              text: String(n.text || ''),
              raw: n,
            }))
          : [];

        applyNotifications([...serverNotifs, ...lowStockNotifs]);
      } catch (e) {
        console.error('Failed to fetch low stock', e);
      } finally {
        notifFetchLock.current = false;
      }
    };

    fetchLowStock();
    const intervalId = window.setInterval(fetchLowStock, 120000);

    return () => {
      isMounted = false;
      window.clearInterval(intervalId);
    };
  }, []);

  return (
    <div className="min-h-screen flex bg-app font-['Cairo'] transition-colors duration-300" style={{ color: 'var(--text)' }}>
      {/* Sidebar */}
      <aside className="fixed inset-y-0 right-0 z-50 w-64 transition-transform duration-300 transform card backdrop-blur-xl border-l border-card shadow-xl no-print" style={{ transform: isSidebarOpen ? 'translateX(0)' : 'translateX(100%)' }}>
        <div className="flex flex-col h-full">
          <div className="flex items-center justify-between px-6 py-5 border-b border-gradient-to-r via-slate-200/50 dark:via-slate-700/50 bg-gradient-to-b from-blue-500/5 dark:from-blue-400/10 to-transparent">
            <div className="flex items-center gap-3">
              {companyLogo ? (
                <img src={companyLogo} alt="logo" className="w-11 h-11 rounded-xl object-cover border-2 border-blue-500/20 dark:border-blue-400/30 shadow-lg" onError={(e:any)=>{e.target.src=assetUrl('Dragon.png')}} />
              ) : (
                <img src={assetUrl('Dragon.png')} alt="logo" className="w-11 h-11 rounded-xl object-cover border-2 border-blue-500/20 dark:border-blue-400/30 shadow-lg" />
              )}
              <span className="font-bold text-xl tracking-tight bg-gradient-to-l from-slate-900 via-blue-600 to-slate-900 dark:from-slate-100 dark:via-blue-400 dark:to-slate-100 bg-clip-text text-transparent">دراجون <span className="text-blue-500 dark:text-blue-400">برو</span></span>
            </div>
              <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden hover:text-slate-600 dark:hover:text-slate-200 transition-colors"><X size={24} /></button>
          </div>

          <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1.5">
            {MENU_ITEMS
              .filter(item => {
                // hide sales-offices menu when sales display is set to company
                if (item.id === 'sales-offices' && salesDisplayMethod === 'company') return false;

                // Delivery method toggles
                // reps: current behavior
                if (deliveryMethod === 'direct') {
                  // hide orders/sales/reps and show POS
                  const hideForDirect = ['orders', 'sales', 'reps', 'shipping-companies'];
                  if (hideForDirect.includes(item.id)) return false;
                }
                if (deliveryMethod === 'shipping') {
                  // hide reps and POS and show shipping-companies
                  const hideForShipping = ['reps', 'pos'];
                  if (hideForShipping.includes(item.id)) return false;
                }
                if (deliveryMethod === 'reps') {
                  // default: hide pos and shipping companies
                  const hideForReps = ['pos', 'shipping-companies'];
                  if (hideForReps.includes(item.id)) return false;
                }

                // when productSource is 'suppliers', hide factory-related menus
                if (productSource === 'suppliers') {
                  const hideWhenSuppliers = ['factory-stock', 'factory-management', 'manufacturing-management', 'dispatch', 'factory-receiving', 'workers'];
                  if (hideWhenSuppliers.includes(item.id)) return false;
                }
                return true;
              })
              .map((item) => (
                // If this item is not permitted, don't render it
                isMenuItemAllowed(item) ? (
                <div key={item.id}>
                <button
                  onClick={() => handleMainMenuClick(item)}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all duration-200
                      ${activeSlug === item.slug 
                        ? 'bg-gradient-to-l from-blue-600 to-blue-500 dark:from-blue-500 dark:to-blue-600 text-white shadow-lg shadow-blue-500/40 dark:shadow-blue-400/30 scale-[1.02]' 
                        : 'hover:bg-slate-100/80 dark:hover:bg-slate-800/80 hover:scale-[1.01]'}
                  `}
                >
                  <div className="flex items-center gap-3">
                    <span className={activeSlug === item.slug ? 'text-white' : ''}>{item.icon}</span>
                    <span className="font-semibold text-sm">{item.label}</span>
                  </div>
                  {item.subItems && (
                    <span className={`transition-transform duration-200 ${openAccordion === item.id ? 'rotate-180' : ''}`}>
                      {openAccordion === item.id ? <ChevronDown size={16} /> : <ChevronLeft size={16} className="rtl-flip" />}
                    </span>
                  )}
                </button>
                {item.subItems && openAccordion === item.id && (
                  <div className="mt-2 mr-10 space-y-1 border-r-2 border-blue-500/30 dark:border-blue-400/30 pr-1">
                    {item.subItems.map(sub => (
                      <button 
                        key={sub.slug}
                        onClick={() => { console.debug('Layout: subitem click ->', item.slug, sub.slug); setActiveView(item.slug, sub.slug); }}
                        className={`w-full text-right px-3 py-2.5 text-xs transition-all duration-200 rounded-lg
                          ${activeSlug === item.slug && activeSubSlug === sub.slug 
                            ? 'text-blue-600 dark:text-blue-400 font-bold bg-blue-50/80 dark:bg-blue-900/30 border-r-2 border-blue-600 dark:border-blue-400 -mr-[2px] shadow-sm' 
                            : 'hover:text-blue-600 dark:hover:text-blue-400 hover:bg-slate-50 dark:hover:bg-slate-800/50'}
                        `}
                      >
                        {sub.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              ) : null
            ))}
          </nav>
        </div>
      </aside>

      <main className={`flex-1 flex flex-col min-w-0 transition-all duration-300 ${isSidebarOpen ? 'lg:mr-64' : 'mr-0'}`}>
        <header className="h-16 flex items-center justify-between px-4 sticky top-0 z-40 backdrop-blur-xl border-b card border-card shadow-sm">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)} 
              className="p-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-all duration-200 hover:shadow-md hover:scale-105 active:scale-95"
            >
              <Menu size={22} />
            </button>
            <div className="hidden md:flex items-center bg-slate-100/80 dark:bg-slate-800/80 rounded-xl px-4 py-2 w-64 border border-slate-200/50 dark:border-slate-700/50 focus-within:border-blue-500/50 dark:focus-within:border-blue-400/50 focus-within:shadow-lg focus-within:shadow-blue-500/10 transition-all">
              <Search className="w-4 h-4" />
              <input type="text" placeholder="بحث سريع..." className="bg-transparent border-none focus:ring-0 text-sm mr-2 w-full text-right placeholder:text-slate-400 dark:placeholder:text-slate-500" />
            </div>
          </div>
          <div className="flex items-center gap-4">
          </div>
          
          <div className="flex items-center gap-2">
            <button 
              onClick={toggleTheme} 
              className="p-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-all duration-300 hover:shadow-lg hover:scale-110 active:scale-95 group"
            >
              {isDark ? (
                <Sun size={20} className="text-amber-500 group-hover:rotate-180 transition-transform duration-500" />
              ) : (
                <Moon size={20} className="group-hover:rotate-12 transition-transform duration-300" />
              )}
            </button>

            {/* Notifications Dropdown */}
            <div className="relative">
              <button 
                onClick={() => setIsNotifOpen(!isNotifOpen)} 
                className="p-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50 relative transition-all duration-200 hover:shadow-md hover:scale-105 active:scale-95"
              >
                <Bell size={20} />
                <span className="absolute top-1.5 left-1.5 w-2.5 h-2.5 bg-gradient-to-br from-red-500 to-red-600 rounded-full border-2 border-white dark:border-slate-900 animate-pulse"></span>
              </button>
              {isNotifOpen && (
                <div className="absolute left-0 mt-2 w-80 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border border-slate-200/50 dark:border-slate-700/50 rounded-2xl shadow-2xl z-50 overflow-hidden animate-in fade-in zoom-in duration-200">
                      <div className="p-4 border-b border-slate-200/50 dark:border-slate-700/50 bg-gradient-to-l from-blue-50/50 dark:from-blue-900/20 to-transparent flex justify-between items-center">
                    <span className="font-bold text-sm bg-gradient-to-l from-slate-900 to-blue-600 dark:from-slate-100 dark:to-blue-400 bg-clip-text text-transparent">الإشعارات</span>
                    <button
                      className="text-[10px] text-blue-600 dark:text-blue-400 hover:underline font-semibold"
                      onClick={() => {
                        const ids = notifications.map((n) => String(n.id));
                        const next = new Set(readNotifIdsRef.current);
                        ids.forEach((id) => next.add(id));
                        readNotifIdsRef.current = next;
                        try {
                          localStorage.setItem(readNotifKey, JSON.stringify(Array.from(next)));
                        } catch (e) {
                          // ignore storage failures
                        }
                        setNotifications([]);
                        lastNotifIdsRef.current = [];

							// Best-effort: mark backend notifications as read
							fetch(`${API_BASE_PATH}/api.php?module=notifications&action=markAllRead`, {
								method: 'POST',
								headers: { 'Content-Type': 'application/json' },
								body: JSON.stringify({})
							}).catch(() => null);
                      }}
                    >
                      تحديد الكل كمقروء
                    </button>
                  </div>
                  <div className="max-h-72 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <div className="p-6 text-center text-sm text-muted">لا توجد إشعارات جديدة</div>
                    ) : (
                      notifications.map((n) => (
                        <div key={n.id} className="p-4 border-b border-slate-200/30 dark:border-slate-700/30 hover:bg-gradient-to-l from-blue-50/50 dark:from-slate-800/50 to-transparent transition-all flex gap-3 cursor-pointer group">
                          <div className="bg-gradient-to-br from-blue-100 to-blue-200 dark:from-blue-900/40 dark:to-blue-800/40 p-2.5 rounded-xl h-fit group-hover:scale-110 transition-transform">
                            <Info size={16} className="text-blue-600 dark:text-blue-400" />
                          </div>
                          <div className="flex-1">
                            <p className="text-xs font-bold">{n.title}</p>
                            <p className="text-[11px] mt-1.5 leading-relaxed text-muted">{n.text}</p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                  <button className="w-full py-3 text-xs text-muted hover:bg-gradient-to-l from-blue-50 dark:from-slate-800 to-transparent font-semibold transition-all">عرض كافة الإشعارات</button>
                </div>
              )}
            </div>
            
            {/* Profile Dropdown */}
            <div className="relative">
              <button 
                onClick={() => setIsProfileOpen(!isProfileOpen)} 
                className="flex items-center gap-2.5 mr-2 p-1.5 pr-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-all duration-200 hover:shadow-md hover:scale-[1.02] active:scale-95 group"
              >
                {companyLogo ? (
                  <img src={companyLogo} className="w-9 h-9 rounded-xl object-cover border-2 border-blue-500/30 dark:border-blue-400/30 shadow-md group-hover:border-blue-500/50 transition-all" />
                ) : (
                  <div className="w-9 h-9 bg-gradient-to-br from-blue-600 to-blue-500 rounded-xl flex items-center justify-center text-white shadow-lg group-hover:shadow-xl transition-all">
                    <UserIcon size={18}/>
                  </div>
                )}
                <div className="hidden sm:block text-right">
                  <p className="text-xs font-bold leading-none">{userData.name || 'المستخدم'}</p>
                  <p className="text-[10px] text-muted mt-1.5 font-medium">Super Admin</p>
                </div>
                <ChevronDown size={15} className="text-muted group-hover:text-blue-500 transition-colors" />
              </button>
              {isProfileOpen && (
                  <div className="absolute left-0 mt-2 w-56 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border border-slate-200/50 dark:border-slate-700/50 rounded-2xl shadow-2xl z-50 p-1.5 animate-in fade-in slide-in-from-top-2 duration-200">
                  <button
                    onClick={() => {
                      setActiveView('profile');
                      setIsProfileOpen(false);
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm hover:bg-gradient-to-l from-blue-50 to-transparent dark:from-blue-900/30 dark:to-transparent transition-all group"
                  >
                    <UserIcon size={18} className="text-blue-600 dark:text-blue-400 group-hover:scale-110 transition-transform" /> 
                    <span className="font-medium">الملف الشخصي</span>
                  </button>
                  <button onClick={() => setActiveView('settings')} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm hover:bg-gradient-to-l from-blue-50 to-transparent dark:from-blue-900/30 dark:to-transparent transition-all group">
                    <SettingsIcon size={18} className="text-blue-600 dark:text-blue-400 group-hover:rotate-90 transition-transform duration-300" /> 
                    <span className="font-medium">إعدادات النظام</span>
                  </button>
                  <div className="h-px bg-gradient-to-r from-transparent via-slate-200 dark:via-slate-700 to-transparent my-1.5 mx-2"></div>
                  <button onClick={onLogout} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm text-red-600 dark:text-red-400 hover:bg-gradient-to-l from-red-50 to-transparent dark:from-red-900/30 dark:to-transparent transition-all group">
                    <LogOut size={18} className="group-hover:translate-x-1 transition-transform" /> 
                    <span className="font-medium">تسجيل الخروج</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Permissions Debug Modal */}
        {showPermsModal && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/40">
            <div className="w-full max-w-2xl rounded-2xl bg-white dark:bg-slate-900 p-6 border border-card shadow-2xl">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold">الأقسام المسموح بها (raw)</h3>
                <button onClick={() => setShowPermsModal(false)} className="text-muted">إغلاق</button>
              </div>
              <div className="mb-4">
                <pre className="max-h-48 overflow-auto text-xs p-2 bg-slate-50 dark:bg-slate-800 rounded">{JSON.stringify(allowedModulesRaw || allowedModules || [], null, 2)}</pre>
              </div>
              <div>
                <h4 className="font-semibold mb-2">قائمة الأقسام والنتيجة</h4>
                <div className="grid grid-cols-1 gap-2">
                  {MENU_ITEMS.map(mi => {
                    const slug = (mi.slug || '').toString().toLowerCase();
                    const allowed = isMenuItemAllowed(mi);
                    return (
                      <div key={mi.id} className={`p-2 rounded flex justify-between items-center ${allowed ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                        <div>{mi.label} <span className="text-xs text-muted">({slug})</span></div>
                        <div className="text-sm font-bold">{allowed ? 'مسموح' : 'ممنوع'}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="p-4 md:p-6 overflow-y-auto flex-1 bg-gradient-to-br from-transparent via-blue-50/20 dark:via-transparent to-transparent">
          {
            (() => {
              // determine if activeSlug is allowed
              if (allowedModules === null) return children;
              const item = MENU_ITEMS.find(mi => mi.slug === activeSlug);
              const allowed = item ? isMenuItemAllowed(item) : ((allowedModules || []).includes(activeSlug));
              if (allowed || activeSlug === 'profile') return children;

              // Not allowed: render fallback pages
              if (activeSlug === 'dashboard') {
                return (
                  <div className="flex flex-col items-center justify-center h-full text-center p-6">
                    <img src={assetUrl('Dragon.png')} alt="dragon" className="w-40 h-40 mx-auto mb-6" />
                    <h2 className="text-2xl font-bold mb-2">اهلا بك فى برنامج دراجون</h2>
                    <p className="text-muted mb-4">ليس لديك صلاحية رؤية البيانات الموجودة في الصفحة الرئيسية.</p>
                  </div>
                );
              }

              return (
                <div className="flex flex-col items-center justify-center h-full text-center p-6">
                  <h2 className="text-xl font-bold mb-2">لا تمتلك صلاحيه الوصول الى هذا القسم</h2>
                  <p className="text-muted mb-4">لا تملك صلاحية الوصول لهذه الصفحة. تواصل مع مدير النظام.</p>
                  <button onClick={() => { setActiveView('dashboard'); }} className="mt-2 px-4 py-2 bg-accent text-white rounded">العوده الى الصفحة الرئيسيه</button>
                </div>
              );
            })()
          }
        </div>
        <Footer />
      </main>
    </div>
  );
};

export default Layout;

