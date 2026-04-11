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
  FileText,
  LifeBuoy,
  Copy,
  XCircle,
  Package,
  Tag,
  ChevronDown,
  ChevronUp,
  Monitor,
  Wifi,
  WifiOff
} from 'lucide-react';
import Swal from 'sweetalert2';
import { API_BASE_PATH } from '../services/apiConfig';
import CustomSelect from './CustomSelect';

const SettingsModule: React.FC = () => {
  const [isSaved, setIsSaved] = useState(false);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<any>(null);
  const [updateLoading, setUpdateLoading] = useState(false);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [allReleases, setAllReleases] = useState<any[]>([]);
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());
  const [isInstalling, setIsInstalling] = useState(false);
  const [installLog, setInstallLog] = useState<{tag: string; status: 'pending'|'installing'|'done'|'error'; message?: string}[]>([]);
  const [expandedTag, setExpandedTag] = useState<string|null>(null);
  const [activation, setActivation] = useState<any>({});
  const [logoPreview, setLogoPreview] = useState<string | null>(localStorage.getItem('Dragon_company_logo'));
  const fileInputRef = useRef<HTMLInputElement>(null);
  const restoreInputRef = useRef<HTMLInputElement>(null);

  const [config, setConfig] = useState({
    name: localStorage.getItem('Dragon_company_name') || '',
    phone: localStorage.getItem('Dragon_company_phone') || '',
    address: localStorage.getItem('Dragon_company_address') || '',
    terms: localStorage.getItem('Dragon_company_terms') || '',
    taxRate: localStorage.getItem('Dragon_tax_rate') || '14',
    salesCalcOrder: localStorage.getItem('Dragon_sales_calc_order') || 'discount_then_tax',
    // New settings
    salesDisplayMethod: localStorage.getItem('Dragon_sales_display_method') || 'company', // 'company' | 'sales_offices'
    productSource: localStorage.getItem('Dragon_product_source') || 'both', // 'factory' | 'suppliers' | 'both'
    salePriceSource: localStorage.getItem('Dragon_default_sale_price_source') || 'product', // 'product' | 'order'
    deliveryMethod: (localStorage.getItem('Dragon_delivery_method') || 'reps').toString(), // 'reps' | 'direct' | 'shipping'
    purchasePriceType: localStorage.getItem('Dragon_purchase_price_type') || 'full_cost', // 'full_cost' | 'vendor_price'
    currency: localStorage.getItem('Dragon_currency') || 'EGP',
    autoBackup: localStorage.getItem('Dragon_auto_backup') === 'true',
    backupFrequency: localStorage.getItem('Dragon_backup_freq') || 'daily',
    backupEmail: localStorage.getItem('Dragon_backup_email') || '',
    backupEmailVerified: localStorage.getItem('Dragon_backup_email_verified') === 'true',
    reportEmail: localStorage.getItem('dragon_report_email') || '',
    reportEmailVerified: localStorage.getItem('dragon_report_email_verified') === 'true',
    reportDailySales: localStorage.getItem('dragon_report_daily_sales') === 'true',
    reportDailyTreasury: localStorage.getItem('dragon_report_daily_treasury') === 'true',
    reportDailyAudit: localStorage.getItem('dragon_report_daily_audit') === 'true',
    reportAuto: localStorage.getItem('dragon_report_auto') === 'true'
  });

  const [otpCode, setOtpCode] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);
  const [reportOtpCode, setReportOtpCode] = useState('');
  const [reportOtpSent, setReportOtpSent] = useState(false);
  const [reportOtpLoading, setReportOtpLoading] = useState(false);

  // — RustDesk States —
  const [serverRustDeskId, setServerRustDeskId] = useState<string | null>(null);
  const [serverRustDeskLoading, setServerRustDeskLoading] = useState(false);
  const [clientRustDeskId, setClientRustDeskId] = useState<string>(
    localStorage.getItem('Dragon_rustdesk_client_id') || ''
  );
  const [clientRustDeskLabel, setClientRustDeskLabel] = useState<string>(
    localStorage.getItem('Dragon_rustdesk_client_label') || ''
  );
  const [clientIdSaving, setClientIdSaving] = useState(false);
  const [allClientIds, setAllClientIds] = useState<any[]>([]);

  const activationStatusClass = activation.status === 'كاملة'
    ? 'text-emerald-400'
    : activation.status === 'تجريبية'
      ? 'text-amber-400'
      : 'text-rose-400';

  const parseBool = (value: any) => value === true || value === 'true' || value === '1';

  const RUSTDESK_DOWNLOAD_URL = 'https://rustdesk.com/download';

  const copyToClipboard = async (text: string, label: string) => {
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      Swal.fire('تم', `تم نسخ ${label}.`, 'success');
    } catch (e) {
      console.error(e);
      Swal.fire('خطأ', 'تعذر النسخ. انسخ الرابط يدوياً.', 'error');
    }
  };

  const fetchServerRustDeskId = async () => {
    setServerRustDeskLoading(true);
    try {
      const res = await fetch(`${API_BASE_PATH}/api.php?module=rustdesk&action=getServerId`);
      const j = await res.json();
      setServerRustDeskId(j.server_id || null);
    } catch { setServerRustDeskId(null); } finally { setServerRustDeskLoading(false); }
  };

  const saveClientRustDeskId = async () => {
    if (!clientRustDeskId.trim()) return;
    setClientIdSaving(true);
    try {
      await fetch(`${API_BASE_PATH}/api.php?module=rustdesk&action=saveClientId`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_id: clientRustDeskId.trim(), label: clientRustDeskLabel.trim() })
      });
      localStorage.setItem('Dragon_rustdesk_client_id', clientRustDeskId.trim());
      localStorage.setItem('Dragon_rustdesk_client_label', clientRustDeskLabel.trim());
      // Refresh list
      const r2 = await fetch(`${API_BASE_PATH}/api.php?module=rustdesk&action=getAllClientIds`);
      const j2 = await r2.json();
      setAllClientIds(j2.data || []);
      Swal.fire('تم', 'تم حفظ معرف الجهاز بنجاح.', 'success');
    } catch { Swal.fire('خطأ', 'تعذر الحفظ.', 'error'); }
    finally { setClientIdSaving(false); }
  };

  const openRustDesk = () => {
    try {
      window.location.href = 'rustdesk://';
    } catch (e) {
      console.error(e);
    }
    // Always show a friendly hint (browser can't reliably detect if protocol opened).
    Swal.fire('ملاحظة', 'إذا لم يتم فتح RustDesk تلقائياً، تأكد من تثبيته ثم جرّب مرة أخرى أو قم بتحميله.', 'info');
  };


  const formatActivationStatus = (type: string, accountStatus: string, isExpired: boolean) => {
    if (isExpired) return 'منتهي';
    if ((accountStatus || '').toLowerCase() === 'blocked') return 'محظور';
    if ((type || '').toLowerCase() === 'trial') return 'تجريبية';
    if (type) return 'كاملة';
    return 'غير معروف';
  };

  useEffect(() => {
    const actData = JSON.parse(localStorage.getItem('Dragon_activation') || '{}');
    setActivation({
      status: formatActivationStatus(actData.account_type, actData.account_status, actData.is_expired),
      expiry: actData.expiry_date || '',
      last_check: actData.last_check ? new Date(actData.last_check).toLocaleDateString('ar-EG') : ''
    });
    fetchServerRustDeskId();
    // Load all client IDs
    fetch(`${API_BASE_PATH}/api.php?module=rustdesk&action=getAllClientIds`)
      .then(r => r.json())
      .then(j => setAllClientIds(j.data || []))
      .catch(() => {});

    // Fetch company settings from database
    const fetchSettings = async () => {
      try {
        const response = await fetch(`${API_BASE_PATH}/get_settings.php`);
        const result = await response.json();
        if (result.success && result.data) {
          const settings = result.data;
          setConfig({
            name: settings.company_name || '',
            phone: settings.company_phone || '',
            address: settings.company_address || '',
            terms: settings.company_terms || '',
            taxRate: settings.tax_rate || '14',
            salesCalcOrder: settings.sales_calc_order || 'discount_then_tax',
            currency: settings.currency || 'EGP',
            salesDisplayMethod: settings.sales_display_method || 'company',
            productSource: settings.product_source || 'both',
            salePriceSource: settings.sale_price_source || 'product',
            deliveryMethod: settings.delivery_method || 'reps',
            purchasePriceType: settings.purchase_price_type || 'full_cost',
            autoBackup: settings.auto_backup === 'true',
            backupFrequency: settings.backup_frequency || 'daily',
            backupEmail: settings.backup_email || '',
            backupEmailVerified: settings.backup_email_verified === 'true',
            reportEmail: settings.report_email || '',
            reportEmailVerified: settings.report_email_verified === 'true',
            reportDailySales: settings.report_daily_sales === 'true' || settings.report_daily_sales === '1',
            reportDailyTreasury: settings.report_daily_treasury === 'true' || settings.report_daily_treasury === '1',
            reportDailyAudit: settings.report_daily_audit === 'true' || settings.report_daily_audit === '1',
            reportAuto: settings.report_auto === 'true' || settings.report_auto === '1'
          });
          if (settings.activation_type || settings.activation_expiry || settings.activation_account_status) {
            const isExpired = parseBool(settings.activation_is_expired);
            setActivation({
              status: formatActivationStatus(settings.activation_type || '', settings.activation_account_status || '', isExpired),
              expiry: settings.activation_expiry || 'غير محدد',
              account_status: settings.activation_account_status || 'Active',
              is_expired: isExpired ? 'true' : 'false',
              last_check: settings.activation_last_check || ''
            });
          }
          if (settings.company_logo_url) {
            setLogoPreview(settings.company_logo_url);
          } else if (settings.company_logo) {
            setLogoPreview(settings.company_logo);
          }
        }
      } catch (error) {
        console.error('Failed to fetch settings:', error);
      }
    };
    fetchSettings();
  }, []);


  const saveSettingsToServer = async (reloadAfter: boolean) => {
    const response = await fetch(`${API_BASE_PATH}/save_settings.php`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        company_name: config.name,
        company_phone: config.phone,
        company_address: config.address,
        company_terms: config.terms,
        company_logo: logoPreview || '',
        tax_rate: config.taxRate,
        sales_calc_order: config.salesCalcOrder,
        currency: config.currency,
        auto_backup: config.autoBackup.toString(),
        backup_frequency: config.backupFrequency,
        backup_email: config.backupEmail,
        report_email: config.reportEmail,
        report_daily_sales: config.reportDailySales.toString(),
        report_daily_treasury: config.reportDailyTreasury.toString(),
        report_daily_audit: config.reportDailyAudit.toString(),
        report_auto: config.reportAuto.toString(),
        // new settings
        sales_display_method: config.salesDisplayMethod,
        product_source: config.productSource,
        delivery_method: config.deliveryMethod,
        sale_price_source: config.salePriceSource,
        purchase_price_type: config.purchasePriceType
      })
    });

    const result = await response.json();
    return result;
  };

  const handleSave = async () => {
    try {
      const result = await saveSettingsToServer(true);

      if (result.success) {
        // Also save to localStorage for immediate use
        localStorage.setItem('Dragon_company_name', config.name);
        localStorage.setItem('Dragon_company_phone', config.phone);
        localStorage.setItem('Dragon_company_address', config.address);
        localStorage.setItem('Dragon_company_terms', config.terms);
        // save new setting locally
        localStorage.setItem('Dragon_default_sale_price_source', config.salePriceSource || 'product');
        localStorage.setItem('Dragon_tax_rate', config.taxRate);
        localStorage.setItem('Dragon_sales_calc_order', config.salesCalcOrder);
        localStorage.setItem('Dragon_currency', config.currency);
        // persist new settings locally
        localStorage.setItem('Dragon_sales_display_method', config.salesDisplayMethod);
        localStorage.setItem('Dragon_product_source', config.productSource);
        localStorage.setItem('Dragon_delivery_method', config.deliveryMethod);
        localStorage.setItem('Dragon_purchase_price_type', config.purchasePriceType);
        localStorage.setItem('Dragon_auto_backup', config.autoBackup.toString());
        localStorage.setItem('Dragon_backup_freq', config.backupFrequency);
        localStorage.setItem('Dragon_backup_email', config.backupEmail);
        localStorage.setItem('Dragon_backup_email_verified', config.backupEmailVerified ? 'true' : 'false');
        localStorage.setItem('Dragon_company_logo', logoPreview || '');
        localStorage.setItem('dragon_report_email', config.reportEmail);
        localStorage.setItem('dragon_report_email_verified', config.reportEmailVerified ? 'true' : 'false');
        localStorage.setItem('dragon_report_daily_sales', config.reportDailySales ? 'true' : 'false');
        localStorage.setItem('dragon_report_daily_treasury', config.reportDailyTreasury ? 'true' : 'false');
        localStorage.setItem('dragon_report_daily_audit', config.reportDailyAudit ? 'true' : 'false');
        localStorage.setItem('dragon_report_auto', config.reportAuto ? 'true' : 'false');

        setIsSaved(true);
        setTimeout(() => setIsSaved(false), 3000);
        // تحديث الصفحة لتطبيق التغييرات على مستوى النظام بالكامل
        setTimeout(() => window.location.reload(), 800);
      } else {
        Swal.fire({
          icon: 'error',
          title: 'فشل الحفظ',
          text: result.message || 'حدث خطأ أثناء حفظ الإعدادات',
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

  const checkForUpdates = async () => {
    setUpdateLoading(true);
    try {
      const res = await fetch(`${API_BASE_PATH}/update_check_all.php`);
      const data = await res.json();
      if (data.success) {
        const info = data.data || {};
        if (info.configured === false) {
          Swal.fire('تنبيه', info.message || 'لم يتم إعداد التحديثات بعد. عدّل ملف update-config.json.', 'warning');
          return;
        }
        setAllReleases(info.releases || []);
        setUpdateInfo({ current_version: info.current_version, new_count: info.new_count });
        // Pre-select all NEW releases
        const newTags = new Set<string>(
          (info.releases || []).filter((r: any) => r.status === 'new').map((r: any) => r.tag as string)
        );
        setSelectedTags(newTags);
        setInstallLog([]);
        setShowUpdateModal(true);
      } else {
        Swal.fire('خطأ', data.message || 'فشل فحص التحديثات.', 'error');
      }
    } catch (e) {
      Swal.fire('خطأ', 'تعذر الاتصال بالخادم لفحص التحديثات.', 'error');
    } finally {
      setUpdateLoading(false);
    }
  };

  const installSelected = async () => {
    // Get selected releases sorted oldest→newest (ascending version)
    const toInstall = allReleases
      .filter(r => selectedTags.has(r.tag) && r.asset_url)
      .sort((a, b) => {
        const av = a.version.split('.').map(Number);
        const bv = b.version.split('.').map(Number);
        for (let i = 0; i < 3; i++) {
          const diff = (av[i] || 0) - (bv[i] || 0);
          if (diff !== 0) return diff;
        }
        return 0;
      });

    if (toInstall.length === 0) {
      Swal.fire('تنبيه', 'لم تحدد أي تحديث للتثبيت، أو التحديثات المحددة لا تحتوي ملف ZIP.', 'warning');
      return;
    }

    const confirmRes = await Swal.fire({
      icon: 'warning',
      title: 'تأكيد التثبيت',
      html: `سيتم تثبيت <b>${toInstall.length}</b> تحديث بالترتيب من الأقدم للأحدث.<br/>يُنصح بعمل Backup أولاً.`,
      showCancelButton: true,
      confirmButtonText: 'ابدأ التثبيت',
      cancelButtonText: 'إلغاء'
    });
    if (!confirmRes.isConfirmed) return;

    setIsInstalling(true);
    setInstallLog(toInstall.map(r => ({ tag: r.tag, status: 'pending' as const })));

    for (const release of toInstall) {
      setInstallLog(prev =>
        prev.map(l => l.tag === release.tag ? { ...l, status: 'installing' } : l)
      );
      try {
        const res = await fetch(`${API_BASE_PATH}/update_apply.php`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ asset_url: release.asset_url })
        });
        const data = await res.json();
        if (data.success) {
          setInstallLog(prev =>
            prev.map(l => l.tag === release.tag ? { ...l, status: 'done', message: data.message || 'تم بنجاح' } : l)
          );
        } else {
          setInstallLog(prev =>
            prev.map(l => l.tag === release.tag ? { ...l, status: 'error', message: data.message || 'فشل التثبيت' } : l)
          );
          // Stop on error
          break;
        }
      } catch (e: any) {
        setInstallLog(prev =>
          prev.map(l => l.tag === release.tag ? { ...l, status: 'error', message: e?.message || 'خطأ في الاتصال' } : l)
        );
        break;
      }
    }

    setIsInstalling(false);
    // Refresh release list after install
    const refreshRes = await fetch(`${API_BASE_PATH}/update_check_all.php`);
    const refreshData = await refreshRes.json().catch(() => null);
    if (refreshData?.success) {
      setAllReleases(refreshData.data?.releases || []);
      setUpdateInfo({ current_version: refreshData.data?.current_version, new_count: refreshData.data?.new_count });
      setSelectedTags(new Set());
    }
  };

  const sendOtp = async () => {
    if (!config.backupEmail) {
      Swal.fire('تنبيه', 'يرجى إدخال البريد أولاً.', 'warning');
      return;
    }
    setOtpLoading(true);
    try {
      const res = await fetch(`${API_BASE_PATH}/backup_email_send_otp.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: config.backupEmail })
      });
      const j = await res.json();
      if (j.success) {
        setOtpSent(true);
        Swal.fire('تم الإرسال', 'تم إرسال كود التحقق إلى البريد.', 'success');
      } else {
        Swal.fire('فشل', j.message || 'تعذر إرسال كود التحقق.', 'error');
      }
    } catch (e) {
      Swal.fire('خطأ', 'تعذر الاتصال بالخادم.', 'error');
    } finally {
      setOtpLoading(false);
    }
  };

  const verifyOtp = async () => {
    if (!otpCode.trim()) {
      Swal.fire('تنبيه', 'يرجى إدخال كود التحقق.', 'warning');
      return;
    }
    setOtpLoading(true);
    try {
      const res = await fetch(`${API_BASE_PATH}/backup_email_verify_otp.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: config.backupEmail, code: otpCode.trim() })
      });
      const j = await res.json();
      if (j.success) {
        setConfig(prev => ({ ...prev, backupEmailVerified: true }));
        localStorage.setItem('Dragon_backup_email_verified', 'true');
        Swal.fire('تم التأكيد', 'تم تأكيد البريد بنجاح.', 'success');
      } else {
        Swal.fire('فشل', j.message || 'الكود غير صحيح.', 'error');
      }
    } catch (e) {
      Swal.fire('خطأ', 'تعذر الاتصال بالخادم.', 'error');
    } finally {
      setOtpLoading(false);
    }
  };

  const sendBackupEmailNow = async () => {
    if (!config.backupEmailVerified) {
      Swal.fire('تنبيه', 'يرجى تأكيد البريد أولاً.', 'warning');
      return;
    }
    setIsBackingUp(true);
    try {
      const res = await fetch(`${API_BASE_PATH}/backup_send_email.php`, { method: 'POST' });
      const j = await res.json();
      if (j.success) {
        Swal.fire('تم', 'تم إرسال النسخة الاحتياطية إلى البريد.', 'success');
      } else {
        Swal.fire('فشل', j.message || 'تعذر إرسال النسخة.', 'error');
      }
    } catch (e) {
      Swal.fire('خطأ', 'تعذر الاتصال بالخادم.', 'error');
    } finally {
      setIsBackingUp(false);
    }
  };

  const sendReportOtp = async () => {
    if (!config.reportEmail) {
      Swal.fire('تنبيه', 'يرجى إدخال البريد أولاً.', 'warning');
      return;
    }
    setReportOtpLoading(true);
    try {
      const res = await fetch(`${API_BASE_PATH}/report_email_send_otp.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: config.reportEmail })
      });
      const j = await res.json();
      if (j.success) {
        setReportOtpSent(true);
        Swal.fire('تم الإرسال', 'تم إرسال كود التحقق إلى البريد.', 'success');
      } else {
        Swal.fire('فشل', j.message || 'تعذر إرسال كود التحقق.', 'error');
      }
    } catch (e) {
      Swal.fire('خطأ', 'تعذر الاتصال بالخادم.', 'error');
    } finally {
      setReportOtpLoading(false);
    }
  };

  const verifyReportOtp = async () => {
    if (!reportOtpCode.trim()) {
      Swal.fire('تنبيه', 'يرجى إدخال كود التحقق.', 'warning');
      return;
    }
    setReportOtpLoading(true);
    try {
      const res = await fetch(`${API_BASE_PATH}/report_email_verify_otp.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: config.reportEmail, code: reportOtpCode.trim() })
      });
      const j = await res.json();
      if (j.success) {
        setConfig(prev => ({ ...prev, reportEmailVerified: true }));
        localStorage.setItem('dragon_report_email_verified', 'true');
        Swal.fire('تم التأكيد', 'تم تأكيد البريد بنجاح.', 'success');
      } else {
        Swal.fire('فشل', j.message || 'الكود غير صحيح.', 'error');
      }
    } catch (e) {
      Swal.fire('خطأ', 'تعذر الاتصال بالخادم.', 'error');
    } finally {
      setReportOtpLoading(false);
    }
  };

  const sendDailyReportNow = async () => {
    if (!config.reportEmailVerified) {
      Swal.fire('تنبيه', 'يرجى تأكيد البريد أولاً.', 'warning');
      return;
    }
    setIsBackingUp(true);
    try {
      const saved = await saveSettingsToServer(false);
      if (!saved.success) {
        Swal.fire('فشل', saved.message || 'تعذر حفظ إعدادات التقارير.', 'error');
        setIsBackingUp(false);
        return;
      }
      const res = await fetch(`${API_BASE_PATH}/daily_report_send.php`, { method: 'POST' });
      const j = await res.json();
      if (j.success) {
        Swal.fire('تم', 'تم إرسال التقرير اليومي إلى البريد.', 'success');
      } else {
        Swal.fire('فشل', j.message || 'تعذر إرسال التقرير.', 'error');
      }
    } catch (e) {
      Swal.fire('خطأ', 'تعذر الاتصال بالخادم.', 'error');
    } finally {
      setIsBackingUp(false);
    }
  };

  const handleLogoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Upload the file to server to get a persistent URL/path instead of embedding a large data URL
    try {
      const form = new FormData();
      form.append('logo', file);
      Swal.fire({ title: 'جارٍ رفع الشعار...', didOpen: () => Swal.showLoading(), allowOutsideClick: false });
      const res = await fetch(`${API_BASE_PATH}/upload_logo.php`, { method: 'POST', body: form });
      const j = await res.json();
      Swal.close();
      if (j && j.success && j.url) {
        setLogoPreview(j.url);
      } else {
        // fallback: show preview as data URL if upload failed
        const reader = new FileReader();
        reader.onloadend = () => setLogoPreview(reader.result as string);
        reader.readAsDataURL(file);
        Swal.fire('فشل الرفع', j.message || 'تعذّر رفع الشعار، سيتم عرض معاينة محلية فقط.', 'warning');
      }
    } catch (err) {
      // fallback to data URL preview on any error
      const reader = new FileReader();
      reader.onloadend = () => setLogoPreview(reader.result as string);
      reader.readAsDataURL(file);
      Swal.close();
      Swal.fire('خطأ', 'تعذر الاتصال بالخادم لرفع الشعار. سيتم استخدام معاينة محلية فقط.', 'error');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const runManualBackup = () => {
    setIsBackingUp(true);
    try {
      // Trigger browser download dialog
      window.location.href = `${API_BASE_PATH}/backup_export.php`;
      Swal.fire({
        icon: 'success',
        title: 'جارٍ تجهيز النسخة',
        text: 'سيتم تنزيل ملف النسخة الاحتياطية الآن.',
        timer: 2000,
        showConfirmButton: false,
      });
    } catch (e) {
      Swal.fire({
        icon: 'error',
        title: 'فشل النسخ الاحتياطي',
        text: 'تعذر بدء تنزيل النسخة الاحتياطية.',
      });
    } finally {
      setIsBackingUp(false);
    }
  };

  const handleRestoreFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const confirm = await Swal.fire({
      title: 'تأكيد الاسترجاع',
      text: 'سيتم استبدال كافة البيانات الحالية بهذه النسخة. هل تريد المتابعة؟',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'نعم، استرجع',
      cancelButtonText: 'إلغاء'
    });
    if (!confirm.isConfirmed) {
      if (restoreInputRef.current) restoreInputRef.current.value = '';
      return;
    }

    setIsRestoring(true);
    try {
      const form = new FormData();
      form.append('backup', file);
      const res = await fetch(`${API_BASE_PATH}/backup_restore.php`, { method: 'POST', body: form });
      const j = await res.json();
      if (j.success) {
        Swal.fire('تمت الاستعادة', 'تم استرجاع النسخة بنجاح. سيتم إعادة تشغيل النظام.', 'success');
        setTimeout(() => window.location.reload(), 1200);
      } else {
        Swal.fire('فشل الاسترجاع', j.message || 'تعذر استرجاع النسخة.', 'error');
      }
    } catch (err) {
      Swal.fire('خطأ', 'تعذر الاتصال بالخادم أثناء الاسترجاع.', 'error');
    } finally {
      setIsRestoring(false);
      if (restoreInputRef.current) restoreInputRef.current.value = '';
    }
  };

  const runRestore = () => {
    restoreInputRef.current?.click();
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
    <>
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

          {/* طريقة البيع */}
          <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm transition-colors">
            <h3 className="font-bold flex items-center gap-2 mb-4 text-slate-800 dark:text-slate-100">طريقة البيع</h3>
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 dark:text-slate-400">اختر طريقة عرض بيانات البيع</label>
              <CustomSelect
                value={config.salesDisplayMethod}
                onChange={(v) => setConfig({ ...config, salesDisplayMethod: v })}
                options={[{ value: 'company', label: 'عن طريق اسم الشركة' }, { value: 'sales_offices', label: 'عن طريق مكاتب المبيعات' }]}
              />
            </div>
          </div>

          {/* طريقة التوصيل */}
          <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm transition-colors">
            <h3 className="font-bold flex items-center gap-2 mb-4 text-slate-800 dark:text-slate-100">طريقة التوصيل إلى العميل</h3>
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 dark:text-slate-400">اختر طريقة البيع/التسليم</label>
              <CustomSelect
                value={config.deliveryMethod}
                onChange={(v) => setConfig({ ...config, deliveryMethod: v })}
                options={[{ value: 'reps', label: 'البيع عن طريق المناديب' }, { value: 'direct', label: 'البيع المباشر للعملاء' }, { value: 'shipping', label: 'البيع عن طريق شركات الشحن' }]}
              />
              <p className="text-[11px] text-muted">
                هذا الاختيار يحدد الأقسام الظاهرة في القائمة الجانبية وطريقة التعامل مع الاوردرات.
              </p>
            </div>
          </div>

          {/* طريقة الحصول على المنتجات */}
          <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm transition-colors">
            <h3 className="font-bold flex items-center gap-2 mb-4 text-slate-800 dark:text-slate-100">طريقة الحصول على المنتجات</h3>
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 dark:text-slate-400">اختر مصدر المنتجات</label>
              <CustomSelect
                value={config.productSource}
                onChange={(v) => setConfig({ ...config, productSource: v })}
                options={[{ value: 'factory', label: 'عن طريق المصنع' }, { value: 'suppliers', label: 'عن طريق الموردين' }, { value: 'both', label: 'الاثنين معاً' }]}
              />
            </div>
          </div>
          {/* سعر الشراء المعتمد — يظهر فقط عند اختيار الموردين أو الاثنين */}
          {config.productSource !== 'factory' && (
          <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm transition-colors">
            <h3 className="font-bold flex items-center gap-2 mb-4 text-slate-800 dark:text-slate-100">سعر الشراء في الاستلام والمرتجع</h3>
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 dark:text-slate-400">اختر نوع سعر الشراء المعتمد</label>
              <CustomSelect
                value={config.purchasePriceType}
                onChange={(v) => setConfig({ ...config, purchasePriceType: v })}
                options={[
                  { value: 'full_cost', label: 'سعر التكلفة الكامل للمنتج' },
                  { value: 'vendor_price', label: 'سعر المصنعية (سعر المورد فقط)' }
                ]}
              />
              <p className="text-[11px] text-muted">يحدد هذا الخيار السعر الذي يظهر ويُستخدم في إذن الاستلام وإذن المرتجع. "سعر التكلفة الكامل" هو تكلفة المخزن، أما "سعر المصنعية" فهو سعر المورد/المصنع فقط.</p>
            </div>
          </div>
          )}
          {/* سعر البيع الأساسي */}
          <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm transition-colors">
            <h3 className="font-bold flex items-center gap-2 mb-4 text-slate-800 dark:text-slate-100">تحديد سعر البيع الأساسي</h3>
            <div className="space-y-2 text-sm">
              <label className="flex items-center gap-2"><input type="radio" name="salePriceSource" value="product" checked={config.salePriceSource === 'product'} onChange={() => setConfig({...config, salePriceSource: 'product'})} /> سعر البيع المسجل فى إدارة المنتجات</label>
              <label className="flex items-center gap-2"><input type="radio" name="salePriceSource" value="order" checked={config.salePriceSource === 'order'} onChange={() => setConfig({...config, salePriceSource: 'order'})} /> سعر البيع الموجود فى الاوردر (يجب كتابة السعر في السكربت/الادخال)</label>
              <p className="text-[11px] text-slate-500 mt-2">ملاحظة: إذا اخترت "سعر المنتج" فسيتم دائماً استخدام السعر المسجل في بطاقة المنتج، أما إذا اخترت "سعر الاوردر" فسيُطلب وجود سعر لكل بند في الاستيراد أو الإدخال اليدوي، ولن يسمح بحفظ أي اوردر يحتوي على بند بدون سعر.</p>
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
                <input type="file" ref={restoreInputRef} className="hidden" accept=".sql" onChange={handleRestoreFile} />
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
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 mr-2">بريد استلام النسخة الاحتياطية</label>
                  <input
                    type="email"
                    placeholder="example@email.com"
                    value={config.backupEmail}
                    onChange={e => setConfig({ ...config, backupEmail: e.target.value, backupEmailVerified: false })}
                    className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl py-3 px-4 text-sm focus:ring-2 ring-blue-500/20 text-slate-900 dark:text-white"
                  />
                  <p className="text-[11px] text-muted">سيتم استخدام هذا البريد لإرسال النسخ الاحتياطية عند تفعيل الإرسال عبر البريد.</p>
                  {!config.backupEmailVerified && (
                    <div className="flex flex-col gap-2">
                      <button onClick={sendOtp} disabled={otpLoading || !config.backupEmail} className="px-3 py-2 bg-blue-600 text-white rounded">
                        إرسال كود التحقق
                      </button>
                      {otpSent && (
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            placeholder="ادخل كود التحقق"
                            value={otpCode}
                            onChange={e => setOtpCode(e.target.value)}
                            className="flex-1 bg-slate-50 dark:bg-slate-900 border-none rounded-2xl py-2 px-3 text-sm focus:ring-2 ring-blue-500/20 text-slate-900 dark:text-white"
                          />
                          <button onClick={verifyOtp} disabled={otpLoading} className="px-3 py-2 bg-emerald-600 text-white rounded">
                            تأكيد
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                  {config.backupEmailVerified && (
                    <button onClick={sendBackupEmailNow} className="px-3 py-2 bg-emerald-600 text-white rounded">
                      إرسال نسخة احتياطية
                    </button>
                  )}
                </div>
                <div className="flex items-center justify-between p-2">
                  <span className="text-sm font-bold text-slate-700 dark:text-slate-300">النسخ التلقائي للسيرفر</span>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer" checked={config.autoBackup} onChange={(e) => setConfig({...config, autoBackup: e.target.checked})} />
                    <div className="w-11 h-6 bg-slate-200 dark:bg-slate-700 rounded-full peer peer-checked:bg-indigo-600 after:content-[''] after:absolute after:top-[2px] after:right-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:-translate-x-full"></div>
                  </label>
                </div>
                <div className={`space-y-1 ${!config.autoBackup ? 'opacity-40' : ''}`}>
                  <label className="text-[10px] font-bold text-slate-500 mr-2">توقيت النسخ</label>
                  <CustomSelect
                    value={config.backupFrequency}
                    onChange={(v) => setConfig({...config, backupFrequency: v})}
                    disabled={!config.autoBackup}
                    options={[{ value: 'hourly', label: 'كل ساعة عمل' }, { value: 'daily', label: 'يومياً (منتصف الليل)' }, { value: 'weekly', label: 'أسبوعياً (كل جمعة)' }]}
                  />
                </div>
              </div>
            </div>
          </div>


          {/* Updates Section */}
          <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm transition-colors">
            <h3 className="font-bold flex items-center gap-2 mb-4 text-slate-800 dark:text-slate-100"><RefreshCw className="text-slate-500" size={18}/> تحديث النظام</h3>
            <div className="flex flex-wrap items-center gap-4">
              <button
                onClick={checkForUpdates}
                disabled={updateLoading}
                className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-bold text-sm transition-all disabled:opacity-60 shadow"
              >
                <RefreshCw className={updateLoading ? 'animate-spin' : ''} size={16} />
                {updateLoading ? 'جارٍ الفحص...' : 'فحص التحديثات'}
              </button>
              <div className="text-sm text-slate-500 dark:text-slate-400">
                {updateInfo?.current_version && (
                  <span>الإصدار الحالي: <span className="font-bold text-slate-700 dark:text-slate-200">{updateInfo.current_version}</span></span>
                )}
                {updateInfo?.new_count != null && (
                  <span className="mr-3">
                    {updateInfo.new_count > 0
                      ? <span className="text-emerald-600 dark:text-emerald-400 font-semibold">● {updateInfo.new_count} تحديث جديد متاح</span>
                      : <span className="text-slate-400">✔ النظام محدَّث</span>}
                  </span>
                )}
                {!updateInfo && <span className="text-xs">اضغط "فحص التحديثات" لعرض جميع الإصدارات.</span>}
              </div>
            </div>
          </div>

          {/* Support Section (RustDesk) */}
          <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm transition-colors">
            <h3 className="font-bold flex items-center gap-2 mb-5 text-slate-800 dark:text-slate-100">
              <LifeBuoy className="text-blue-500" size={18}/> الدعم الفني (RustDesk)
            </h3>

            {/* ─── ID السيرفر */}
            <div className="mb-4 p-4 rounded-2xl bg-gradient-to-l from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 border border-blue-100 dark:border-blue-900/40">
              <div className="flex items-center gap-2 mb-2">
                <Monitor size={15} className="text-blue-500 flex-shrink-0" />
                <span className="text-xs font-black text-blue-700 dark:text-blue-300 uppercase tracking-wide">معرف جهاز السيرفر</span>
                <button
                  onClick={fetchServerRustDeskId}
                  disabled={serverRustDeskLoading}
                  className="mr-auto p-1 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/40 text-blue-500 transition-colors"
                  title="تحديث"
                >
                  <RefreshCw size={12} className={serverRustDeskLoading ? 'animate-spin' : ''} />
                </button>
              </div>
              {serverRustDeskLoading ? (
                <div className="flex items-center gap-2 text-sm text-slate-400"><RefreshCw size={14} className="animate-spin" /> جارً البحث...</div>
              ) : serverRustDeskId ? (
                <div className="flex items-center gap-3">
                  <span className="font-mono text-2xl font-black text-blue-700 dark:text-blue-300 tracking-widest select-all">{serverRustDeskId}</span>
                  <button
                    onClick={() => copyToClipboard(serverRustDeskId, 'معرف السيرفر')}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 hover:bg-blue-200 transition-colors text-xs font-bold"
                  >
                    <Copy size={13} /> نسخ
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400">
                  <WifiOff size={14} />
                  <span>لم يتم العثور على RustDesk على السيرفر. تأكد من تثبيته وتشغيله.</span>
                </div>
              )}
              <p className="text-[10px] text-blue-400 dark:text-blue-500 mt-2">هذا هو معرف RustDesk لجهاز السيرفر الذي يعمل عليه DragonPro</p>
            </div>

            {/* ─── ID الجهاز الحالي (جهاز المستخدم) */}
            <div className="mb-4 p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-2 mb-3">
                <Wifi size={15} className="text-emerald-500 flex-shrink-0" />
                <span className="text-xs font-black text-slate-600 dark:text-slate-300 uppercase tracking-wide">معرف جهازي (الجهاز الحالي)</span>
              </div>
              <div className="space-y-2">
                <input
                  type="text"
                  value={clientRustDeskId}
                  onChange={e => setClientRustDeskId(e.target.value)}
                  placeholder="أدخل معرف RustDesk الخاص بجهازك..."
                  className="w-full py-2.5 px-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-xl text-sm font-mono font-bold text-slate-800 dark:text-white focus:ring-2 ring-blue-500/20"
                />
                <input
                  type="text"
                  value={clientRustDeskLabel}
                  onChange={e => setClientRustDeskLabel(e.target.value)}
                  placeholder="وصف الجهاز (اختياري) — مثل: سطح مكتب المدير"
                  className="w-full py-2.5 px-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-xl text-sm text-slate-700 dark:text-white focus:ring-2 ring-blue-500/20"
                />
                <div className="flex items-center gap-2">
                  <button
                    onClick={saveClientRustDeskId}
                    disabled={clientIdSaving || !clientRustDeskId.trim()}
                    className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors disabled:opacity-50"
                  >
                    {clientIdSaving ? <RefreshCw size={13} className="animate-spin" /> : <Save size={13} />}
                    حفظ معرفي
                  </button>
                  {clientRustDeskId && (
                    <button
                      onClick={() => copyToClipboard(clientRustDeskId, 'معرف الجهاز')}
                      className="flex items-center gap-1 px-3 py-2 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold hover:bg-slate-300 transition-colors"
                    >
                      <Copy size={13} /> نسخ
                    </button>
                  )}
                </div>
              </div>
              <p className="text-[10px] text-slate-400 mt-2">افتح RustDesk على جهازك وأدخل المعرف (ID) الظاهر فيه هنا.</p>
            </div>

            {/* ─── قائمة معرفات العملاء المحفوظة */}
            {allClientIds.length > 0 && (
              <div className="mb-4 p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-700">
                <p className="text-xs font-black text-slate-500 dark:text-slate-400 mb-3 uppercase tracking-wide">معرفات محفوظة للأجهزة</p>
                <div className="space-y-2">
                  {allClientIds.map((c: any) => (
                    <div key={c.user_id} className="flex items-center justify-between gap-2 bg-white dark:bg-slate-800 rounded-xl px-3 py-2 border border-slate-100 dark:border-slate-700">
                      <div>
                        <span className="text-xs font-bold text-slate-700 dark:text-slate-200">{c.label || c.user_name}</span>
                        <span className="font-mono text-xs text-blue-600 dark:text-blue-400 mr-2">{c.id}</span>
                      </div>
                      <button
                        onClick={() => copyToClipboard(c.id, c.label || c.user_name)}
                        className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 transition-colors"
                      >
                        <Copy size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ─── أزرار فتح / تحميل */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <button
                onClick={openRustDesk}
                className="w-full flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900 rounded-2xl hover:bg-slate-100 dark:hover:bg-slate-700/40 transition-all"
              >
                <div className="flex items-center gap-3">
                  <div className="bg-slate-200 dark:bg-slate-700 p-2.5 rounded-xl text-slate-700 dark:text-slate-200">
                    <LifeBuoy size={20} />
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-slate-800 dark:text-slate-200">فتح RustDesk</p>
                    <p className="text-[10px] text-slate-500">لفتح جلسة دعم على جهازك</p>
                  </div>
                </div>
              </button>
              <button
                onClick={() => window.open(RUSTDESK_DOWNLOAD_URL, '_blank', 'noopener,noreferrer')}
                className="w-full flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900 rounded-2xl hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-all"
              >
                <div className="flex items-center gap-3">
                  <div className="bg-indigo-100 dark:bg-indigo-900/40 p-2.5 rounded-xl text-indigo-700 dark:text-indigo-300">
                    <Download size={20} />
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-slate-800 dark:text-slate-200">تحميل RustDesk</p>
                    <p className="text-[10px] text-slate-500">إذا لم يكن مثبتاً على الجهاز</p>
                  </div>
                </div>
              </button>
            </div>
          </div>

          {/* Daily Reports Section */}
          <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm transition-colors">
            <h3 className="font-bold flex items-center gap-2 mb-6 text-slate-800 dark:text-slate-100"><History className="text-emerald-500" size={18}/> التقارير اليومية عبر البريد</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 mr-2">بريد استلام التقارير اليومية</label>
                  <input
                    type="email"
                    placeholder="example@email.com"
                    value={config.reportEmail}
                    onChange={e => setConfig({ ...config, reportEmail: e.target.value, reportEmailVerified: false })}
                    className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl py-3 px-4 text-sm focus:ring-2 ring-blue-500/20 text-slate-900 dark:text-white"
                  />
                  <p className="text-[11px] text-muted">سيتم استخدام هذا البريد لإرسال التقارير اليومية.</p>
                  {!config.reportEmailVerified && (
                    <div className="flex flex-col gap-2">
                      <button onClick={sendReportOtp} disabled={reportOtpLoading || !config.reportEmail} className="px-3 py-2 bg-blue-600 text-white rounded">
                        إرسال كود التحقق
                      </button>
                      {reportOtpSent && (
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            placeholder="ادخل كود التحقق"
                            value={reportOtpCode}
                            onChange={e => setReportOtpCode(e.target.value)}
                            className="flex-1 bg-slate-50 dark:bg-slate-900 border-none rounded-2xl py-2 px-3 text-sm focus:ring-2 ring-blue-500/20 text-slate-900 dark:text-white"
                          />
                          <button onClick={verifyReportOtp} disabled={reportOtpLoading} className="px-3 py-2 bg-emerald-600 text-white rounded">
                            تأكيد
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                  {config.reportEmailVerified && (
                    <button onClick={sendDailyReportNow} className="px-3 py-2 bg-emerald-600 text-white rounded">
                      إرسال تقرير اليوم الآن
                    </button>
                  )}
                </div>
              </div>

              <div className="space-y-4 md:border-r md:pr-6 border-slate-100 dark:border-slate-700">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 mr-2">أنواع التقارير اليومية</label>
                  <div className="flex flex-col gap-2">
                    <label className="inline-flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={config.reportDailySales} onChange={e => setConfig({ ...config, reportDailySales: e.target.checked })} />
                      تقرير المبيعات اليومي
                    </label>
                    <label className="inline-flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={config.reportDailyTreasury} onChange={e => setConfig({ ...config, reportDailyTreasury: e.target.checked })} />
                      تقرير الخزينة اليومي
                    </label>
                    <label className="inline-flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={config.reportDailyAudit} onChange={e => setConfig({ ...config, reportDailyAudit: e.target.checked })} />
                      تقرير شامل للعمليات اليومية
                    </label>
                  </div>
                </div>

                <div className="flex items-center justify-between p-2">
                  <span className="text-sm font-bold text-slate-700 dark:text-slate-300">إرسال تلقائي يومي</span>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer" checked={config.reportAuto} onChange={(e) => setConfig({ ...config, reportAuto: e.target.checked })} />
                    <div className="w-11 h-6 bg-slate-200 dark:bg-slate-700 rounded-full peer peer-checked:bg-emerald-600 after:content-[''] after:absolute after:top-[2px] after:right-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:-translate-x-full"></div>
                  </label>
                </div>
                <button
                  onClick={async () => {
                    try {
                      const result = await saveSettingsToServer(false);
                      if (result.success) {
                        Swal.fire('تم', 'تم حفظ إعدادات التقارير.', 'success');
                      } else {
                        Swal.fire('فشل', result.message || 'تعذر حفظ إعدادات التقارير.', 'error');
                      }
                    } catch (e) {
                      Swal.fire('خطأ', 'تعذر الاتصال بالخادم.', 'error');
                    }
                  }}
                  className="px-3 py-2 bg-slate-200 rounded text-sm"
                >
                  حفظ إعدادات التقارير
                </button>
                <p className="text-[11px] text-muted">لتفعيل الإرسال التلقائي، شغّل المهمة المجدولة للملف report_run.php.</p>
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
                 <span className={`text-sm font-bold ${activationStatusClass}`}>{activation.status}</span>
               </div>
               <div className="bg-white/5 p-3 rounded-2xl flex justify-between items-center">
                 <span className="text-xs text-slate-400">ينتهي في:</span>
                 <span className="text-sm font-bold">{activation.expiry || 'غير محدد'}</span>
               </div>
               <div className="bg-white/5 p-3 rounded-2xl flex justify-between items-center">
                 <span className="text-xs text-slate-400">آخر تحقق:</span>
                 <span className="text-sm font-bold">{activation.last_check || 'غير معروف'}</span>
               </div>
             </div>
          </div>

          <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm transition-colors">
            <h3 className="font-bold flex items-center gap-2 mb-6 text-slate-800 dark:text-slate-100"><Coins className="text-amber-500" size={18}/> العملة والضرائب</h3>
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 dark:text-slate-400">العملة الافتراضية</label>
                <CustomSelect
                  value={config.currency}
                  onChange={(v) => setConfig({...config, currency: v})}
                  options={[{ value: 'EGP', label: 'الجنيه المصري (EGP)' }, { value: 'SAR', label: 'الريال السعودي (SAR)' }, { value: 'USD', label: 'الدولار الأمريكي (USD)' }, { value: 'AED', label: 'الدرهم الإماراتي (AED)' }]}
                />
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
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 dark:text-slate-400">ترتيب احتساب الخصم/الضريبة</label>
                <CustomSelect
                  value={config.salesCalcOrder}
                  onChange={(v) => setConfig({...config, salesCalcOrder: v})}
                  options={[{ value: 'discount_then_tax', label: 'خصم ثم ضريبة' }, { value: 'tax_then_discount', label: 'ضريبة ثم خصم' }]}
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

      {/* ── Update Manager Modal ── */}
      {showUpdateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" dir="rtl">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh] overflow-hidden">

            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-2">
                <Package size={20} className="text-blue-500" />
                <span className="font-bold text-lg text-slate-800 dark:text-slate-100">إدارة التحديثات</span>
                {updateInfo?.current_version && (
                  <span className="text-xs bg-slate-100 dark:bg-slate-800 text-slate-500 px-2 py-0.5 rounded-full">
                    الحالي: {updateInfo.current_version}
                  </span>
                )}
              </div>
              <button
                onClick={() => { if (!isInstalling) setShowUpdateModal(false); }}
                disabled={isInstalling}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 disabled:opacity-40"
              >
                <XCircle size={22} />
              </button>
            </div>

            {/* Release List */}
            <div className="overflow-y-auto flex-1 px-6 py-4 space-y-2">
              {allReleases.length === 0 && (
                <p className="text-center text-sm text-slate-400 py-8">لا توجد إصدارات.</p>
              )}
              {allReleases.map((rel: any) => {
                const isSelected = selectedTags.has(rel.tag);
                const logEntry = installLog.find((l: any) => l.tag === rel.tag);
                const statusBadge =
                  rel.status === 'new'     ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
                  rel.status === 'current' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                                             'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400';
                const statusLabel =
                  rel.status === 'new'     ? 'جديد' :
                  rel.status === 'current' ? 'الحالي' : 'قديم';

                return (
                  <div
                    key={rel.tag}
                    className={`rounded-2xl border transition-all ${isSelected && !logEntry ? 'border-blue-400 dark:border-blue-600 bg-blue-50 dark:bg-blue-950/20' : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40'}`}
                  >
                    <div className="flex items-center gap-3 p-3">
                      {/* Checkbox */}
                      <input
                        type="checkbox"
                        disabled={isInstalling || !rel.asset_url}
                        checked={isSelected}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                          const next = new Set(selectedTags);
                          if (e.target.checked) next.add(rel.tag); else next.delete(rel.tag);
                          setSelectedTags(next);
                        }}
                        className="w-4 h-4 accent-blue-600 cursor-pointer flex-shrink-0"
                      />

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-sm text-slate-800 dark:text-slate-100">{rel.version}</span>
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${statusBadge}`}>{statusLabel}</span>
                          {rel.prerelease && <span className="text-[10px] bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 px-2 py-0.5 rounded-full">تجريبي</span>}
                          <span className="text-xs text-slate-500 truncate">{rel.name !== rel.tag ? rel.name : ''}</span>
                        </div>
                        <div className="flex items-center gap-3 mt-0.5">
                          {rel.published_at && (
                            <span className="text-[10px] text-slate-400">
                              {new Date(rel.published_at).toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric' })}
                            </span>
                          )}
                          {!rel.asset_url && <span className="text-[10px] text-rose-500">لا يوجد ملف ZIP</span>}
                          {rel.asset_name && <span className="text-[10px] text-slate-400 font-mono truncate">{rel.asset_name}</span>}
                        </div>
                      </div>

                      {/* Expand notes toggle */}
                      {rel.body && (
                        <button
                          onClick={() => setExpandedTag(expandedTag === rel.tag ? null : rel.tag)}
                          className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 flex-shrink-0"
                        >
                          {expandedTag === rel.tag ? <ChevronUp size={16}/> : <ChevronDown size={16}/>}
                        </button>
                      )}

                      {/* Install status icon */}
                      {logEntry && (
                        <span className="flex-shrink-0">
                          {logEntry.status === 'installing' && <RefreshCw size={16} className="animate-spin text-blue-500"/>}
                          {logEntry.status === 'done'       && <CheckCircle size={16} className="text-emerald-500"/>}
                          {logEntry.status === 'error'      && <span title={logEntry.message}><AlertCircle size={16} className="text-rose-500"/></span>}
                        </span>
                      )}
                    </div>

                    {/* Release notes */}
                    {expandedTag === rel.tag && rel.body && (
                      <div className="px-10 pb-3 text-xs text-slate-500 dark:text-slate-400 whitespace-pre-line border-t border-slate-200 dark:border-slate-700 pt-2 leading-relaxed">
                        {rel.body}
                      </div>
                    )}

                    {/* Install log message */}
                    {logEntry?.message && (
                      <div className={`px-10 pb-2 text-[11px] ${logEntry.status === 'error' ? 'text-rose-500' : 'text-emerald-600 dark:text-emerald-400'}`}>
                        {logEntry.message}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between gap-3 flex-wrap">
              <div className="text-xs text-slate-500">
                {selectedTags.size > 0
                  ? `${selectedTags.size} تحديث محدد — سيتم التثبيت من الأقدم للأحدث`
                  : 'حدد التحديثات المراد تثبيتها'}
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => {
                    const allTags = new Set<string>(allReleases.filter((r: any) => r.asset_url).map((r: any) => r.tag as string));
                    setSelectedTags(allTags);
                  }}
                  disabled={isInstalling}
                  className="text-xs px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40"
                >
                  تحديد الكل
                </button>
                <button
                  onClick={() => setSelectedTags(new Set())}
                  disabled={isInstalling}
                  className="text-xs px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40"
                >
                  إلغاء التحديد
                </button>
                <button
                  onClick={installSelected}
                  disabled={isInstalling || selectedTags.size === 0}
                  className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-bold text-sm transition-all disabled:opacity-50 shadow"
                >
                  {isInstalling
                    ? <><RefreshCw size={14} className="animate-spin"/> جارٍ التثبيت...</>
                    : <><Upload size={14}/> تثبيت المحدد ({selectedTags.size})</>}
                </button>
              </div>
            </div>

          </div>
        </div>
      )}
    </>
  );
};

export default SettingsModule;

