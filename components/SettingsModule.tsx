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
  const [updateInfo, setUpdateInfo] = useState<any>(null);
  const [updateLoading, setUpdateLoading] = useState(false);
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

  const activationStatusClass = activation.status === 'كاملة'
    ? 'text-emerald-400'
    : activation.status === 'تجريبية'
      ? 'text-amber-400'
      : 'text-rose-400';

  const parseBool = (value: any) => value === true || value === 'true' || value === '1';

  const formatActivationStatus = (type: string, accountStatus: string, isExpired: boolean) => {
    if (isExpired) return 'منتهي';
    if ((accountStatus || '').toLowerCase() === 'blocked') return 'محظور';
    if ((type || '').toLowerCase() === 'trial') return 'تجريبية';
    if (type) return 'كاملة';
    return 'غير معروف';
  };

  useEffect(() => {
    const actData = JSON.parse(localStorage.getItem('Dragon_activation') || '{}');
    setActivation(actData);

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
            // load new settings
            salesDisplayMethod: settings.sales_display_method || 'company',
            productSource: settings.product_source || 'both',
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
          
          if (settings.company_logo) {
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
        product_source: config.productSource
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
        localStorage.setItem('Dragon_tax_rate', config.taxRate);
        localStorage.setItem('Dragon_sales_calc_order', config.salesCalcOrder);
        localStorage.setItem('Dragon_currency', config.currency);
        // persist new settings locally
        localStorage.setItem('Dragon_sales_display_method', config.salesDisplayMethod);
        localStorage.setItem('Dragon_product_source', config.productSource);
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
      const res = await fetch(`${API_BASE_PATH}/update_check.php`);
      const data = await res.json();
      if (data.success) {
        setUpdateInfo(data.data || null);
        const info = data.data || {};
        if (info.configured === false) {
          Swal.fire('تنبيه', info.message || 'لم يتم إعداد التحديثات بعد.', 'warning');
          return;
        }
        if (info.update_available) {
          Swal.fire('تحديث متاح', `الإصدار الحالي: ${info.current_version} — أحدث إصدار: ${info.latest_version}`, 'info');
        } else {
          Swal.fire('ممتاز', `لا توجد تحديثات جديدة. الإصدار الحالي: ${info.current_version}`, 'success');
        }
      } else {
        Swal.fire('خطأ', data.message || 'فشل فحص التحديث.', 'error');
      }
    } catch (e) {
      Swal.fire('خطأ', 'تعذر الاتصال بالخادم لفحص التحديث.', 'error');
    } finally {
      setUpdateLoading(false);
    }
  };

  const applyUpdate = async () => {
    const assetUrl = updateInfo?.asset_url;
    if (!assetUrl) {
      Swal.fire('تنبيه', 'لا يوجد رابط تحميل للإصدار. تأكد من إعداد update-config.json وأن الـRelease يحتوي ملف zip.', 'warning');
      return;
    }

    const confirm = await Swal.fire({
      icon: 'warning',
      title: 'تأكيد التحديث',
      text: 'سيتم تنزيل التحديث وتثبيته على نفس السيرفر. يفضل عمل Backup أولاً.',
      showCancelButton: true,
      confirmButtonText: 'تحديث الآن',
      cancelButtonText: 'إلغاء'
    });
    if (!confirm.isConfirmed) return;

    setUpdateLoading(true);
    try {
      const res = await fetch(`${API_BASE_PATH}/update_apply.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ asset_url: assetUrl })
      });
      const data = await res.json();
      if (data.success) {
        Swal.fire('تم', data.message || 'تم تثبيت التحديث. قم بتحديث الصفحة.', 'success');
        // Re-check to refresh version info
        setTimeout(() => checkForUpdates(), 800);
      } else {
        Swal.fire('خطأ', data.message || 'فشل تثبيت التحديث.', 'error');
      }
    } catch (e) {
      Swal.fire('خطأ', 'تعذر الاتصال بالخادم لتثبيت التحديث.', 'error');
    } finally {
      setUpdateLoading(false);
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
              <select
                value={config.salesDisplayMethod}
                onChange={(e) => setConfig({ ...config, salesDisplayMethod: e.target.value })}
                className="w-full py-3 px-4 bg-slate-50 dark:bg-slate-900 border-none rounded-2xl text-sm text-slate-900 dark:text-white"
              >
                <option value="company">عن طريق اسم الشركة</option>
                <option value="sales_offices">عن طريق مكاتب المبيعات</option>
              </select>
            </div>
          </div>

          {/* طريقة الحصول على المنتجات */}
          <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm transition-colors">
            <h3 className="font-bold flex items-center gap-2 mb-4 text-slate-800 dark:text-slate-100">طريقة الحصول على المنتجات</h3>
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 dark:text-slate-400">اختر مصدر المنتجات</label>
              <select
                value={config.productSource}
                onChange={(e) => setConfig({ ...config, productSource: e.target.value })}
                className="w-full py-3 px-4 bg-slate-50 dark:bg-slate-900 border-none rounded-2xl text-sm text-slate-900 dark:text-white"
              >
                <option value="factory">عن طريق المصنع</option>
                <option value="suppliers">عن طريق الموردين</option>
                <option value="both">الاثنين معاً</option>
              </select>
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
                  <select disabled={!config.autoBackup} value={config.backupFrequency} onChange={(e) => setConfig({...config, backupFrequency: e.target.value})} className="w-full py-3 px-4 bg-slate-50 dark:bg-slate-900 border-none rounded-2xl text-sm text-slate-900 dark:text-white">
                    <option value="hourly">كل ساعة عمل</option>
                    <option value="daily">يومياً (منتصف الليل)</option>
                    <option value="weekly">أسبوعياً (كل جمعة)</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Updates Section */}
          <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm transition-colors">
            <h3 className="font-bold flex items-center gap-2 mb-6 text-slate-800 dark:text-slate-100"><RefreshCw className="text-slate-500" size={18}/> تحديث النظام</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <button
                onClick={checkForUpdates}
                disabled={updateLoading}
                className="w-full flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900 rounded-2xl hover:bg-slate-100 dark:hover:bg-slate-700/40 transition-all"
              >
                <div className="flex items-center gap-3">
                  <div className="bg-slate-200 dark:bg-slate-700 p-2.5 rounded-xl text-slate-700 dark:text-slate-200">
                    <RefreshCw className={updateLoading ? 'animate-spin' : ''} size={20} />
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-slate-800 dark:text-slate-200">فحص التحديثات</p>
                    <p className="text-[10px] text-slate-500">GitHub Releases</p>
                  </div>
                </div>
              </button>

              <button
                onClick={applyUpdate}
                disabled={updateLoading || !updateInfo?.update_available}
                className="w-full flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900 rounded-2xl hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-all disabled:opacity-40"
              >
                <div className="flex items-center gap-3">
                  <div className="bg-emerald-100 dark:bg-emerald-900/40 p-2.5 rounded-xl text-emerald-700 dark:text-emerald-300">
                    <Upload size={20} />
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-slate-800 dark:text-slate-200">تثبيت التحديث</p>
                    <p className="text-[10px] text-slate-500">يحافظ على config والترخيص والملفات</p>
                  </div>
                </div>
              </button>
            </div>

            <div className="mt-4 text-xs text-muted">
              {updateInfo?.current_version && (
                <div>الإصدار الحالي: <span className="font-bold">{updateInfo.current_version}</span></div>
              )}
              {updateInfo?.latest_version && (
                <div>أحدث إصدار: <span className="font-bold">{updateInfo.latest_version}</span></div>
              )}
              {updateInfo?.asset_name && (
                <div>ملف التحديث: <span className="font-mono">{updateInfo.asset_name}</span></div>
              )}
              {!updateInfo && (
                <div>اضغط “فحص التحديثات” لعرض آخر إصدار.</div>
              )}
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
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 dark:text-slate-400">ترتيب احتساب الخصم/الضريبة</label>
                <select
                  value={config.salesCalcOrder}
                  onChange={(e) => setConfig({...config, salesCalcOrder: e.target.value})}
                  className="w-full py-3 px-4 bg-slate-50 dark:bg-slate-900 border-none rounded-2xl text-sm text-slate-900 dark:text-white"
                >
                  <option value="discount_then_tax">خصم ثم ضريبة</option>
                  <option value="tax_then_discount">ضريبة ثم خصم</option>
                </select>
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

