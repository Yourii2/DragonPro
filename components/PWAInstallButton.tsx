import React, { useState, useEffect } from 'react';
import { Download, CheckCircle, Monitor, Smartphone, Apple, ShieldAlert, Sparkles, Loader2 } from 'lucide-react';
import Swal from 'sweetalert2';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

declare global {
  interface Window {
    deferredPwaPrompt?: BeforeInstallPromptEvent | null;
  }
}

export function detectEnvironment() {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  
  // OS Detection
  let os = 'Windows';
  let isMobile = false;
  if (/Windows/i.test(ua)) {
    os = 'Windows';
  } else if (/Android/i.test(ua)) {
    os = 'Android';
    isMobile = true;
  } else if (/iPhone|iPad|iPod/i.test(ua)) {
    os = 'iOS';
    isMobile = true;
  } else if (/Macintosh|Mac OS/i.test(ua)) {
    os = 'macOS';
  } else if (/Linux/i.test(ua)) {
    os = 'Linux';
  }

  // Browser Detection
  let browser = 'Chrome';
  if (/Edg\//i.test(ua)) {
    browser = 'Microsoft Edge';
  } else if (/Chrome\//i.test(ua) && !/Edg\//i.test(ua) && !/OPR\//i.test(ua)) {
    browser = 'Google Chrome';
  } else if (/Safari\//i.test(ua) && !/Chrome\//i.test(ua)) {
    browser = 'Apple Safari';
  } else if (/Firefox\//i.test(ua)) {
    browser = 'Mozilla Firefox';
  } else if (/OPR\//i.test(ua)) {
    browser = 'Opera';
  }

  const isLocalhost = 
    window.location.hostname === 'localhost' || 
    window.location.hostname === '127.0.0.1' ||
    window.location.hostname === '0.0.0.0';

  const isHttps = window.location.protocol === 'https:';
  const isSecureForPWA = isHttps || isLocalhost;

  return { os, browser, isMobile, isSecureForPWA, isLocalhost, isHttps };
}

export const PWAInstallButton: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(
    () => (typeof window !== 'undefined' && window.deferredPwaPrompt) || null
  );
  const [isStandalone, setIsStandalone] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isChecking, setIsChecking] = useState(false);

  useEffect(() => {
    // Check if the app is currently running in standalone (desktop/mobile app) mode
    const checkStandalone = () => {
      const isStandaloneMode =
        window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as any).standalone === true ||
        document.referrer.includes('android-app://');
      setIsStandalone(Boolean(isStandaloneMode));
    };

    checkStandalone();
    const mediaQuery = window.matchMedia('(display-mode: standalone)');
    const handleMediaChange = (e: MediaQueryListEvent) => setIsStandalone(e.matches);
    try {
      mediaQuery.addEventListener('change', handleMediaChange);
    } catch {
      mediaQuery.addListener(handleMediaChange);
    }

    // Check if global prompt is already stored
    if (window.deferredPwaPrompt) {
      setDeferredPrompt(window.deferredPwaPrompt);
    }

    // Listen to custom event from index.html or standard beforeinstallprompt
    const handlePromptAvailable = (e: Event) => {
      const promptEvt = (e as CustomEvent).detail || e;
      if (promptEvt && typeof promptEvt.prompt === 'function') {
        window.deferredPwaPrompt = promptEvt;
        setDeferredPrompt(promptEvt);
      }
    };

    // Listen for successful installation
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
      window.deferredPwaPrompt = null;
      Swal.fire({
        icon: 'success',
        title: 'تم تثبيت دراجون برو بنجاح! 🎉',
        text: 'تمت إضافة اختصار البرنامج إلى سطح المكتب، قائمة ابدأ، وشريط المهام. يمكنك الآن تشغيله مباشرة كتطبيق مستقل وسريع.',
        confirmButtonText: 'ممتاز',
        confirmButtonColor: '#2563eb'
      });
    };

    window.addEventListener('beforeinstallprompt', handlePromptAvailable);
    window.addEventListener('pwa-prompt-available', handlePromptAvailable);
    window.addEventListener('appinstalled', handleAppInstalled);
    window.addEventListener('pwa-installed-success', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handlePromptAvailable);
      window.removeEventListener('pwa-prompt-available', handlePromptAvailable);
      window.removeEventListener('appinstalled', handleAppInstalled);
      window.removeEventListener('pwa-installed-success', handleAppInstalled);
      try {
        mediaQuery.removeEventListener('change', handleMediaChange);
      } catch {
        mediaQuery.removeListener(handleMediaChange);
      }
    };
  }, []);

  const handleInstallClick = async () => {
    const promptToUse = deferredPrompt || window.deferredPwaPrompt;

    // 1. If native prompt is ready, trigger it immediately!
    if (promptToUse) {
      try {
        await promptToUse.prompt();
        const choiceResult = await promptToUse.userChoice;
        if (choiceResult.outcome === 'accepted') {
          setDeferredPrompt(null);
          window.deferredPwaPrompt = null;
        }
      } catch (err) {
        console.error('Error triggering PWA install prompt:', err);
      }
      return;
    }

    // 2. If prompt is not ready yet, briefly check for 800ms
    setIsChecking(true);
    await new Promise(r => setTimeout(r, 800));
    setIsChecking(false);

    const freshPrompt = deferredPrompt || window.deferredPwaPrompt;
    if (freshPrompt) {
      try {
        await freshPrompt.prompt();
        const choiceResult = await freshPrompt.userChoice;
        if (choiceResult.outcome === 'accepted') {
          setDeferredPrompt(null);
          window.deferredPwaPrompt = null;
        }
      } catch (err) {
        console.error('Error triggering PWA prompt after check:', err);
      }
      return;
    }

    // 3. Environment detection & specialized tailored instructions
    const env = detectEnvironment();

    let guideHtml = '';
    if (env.os === 'Windows' && env.browser.includes('Edge')) {
      guideHtml = `
        <div class="bg-blue-50 dark:bg-blue-900/30 p-4 rounded-2xl border border-blue-200 dark:border-blue-700 text-right space-y-3">
          <div class="flex items-center gap-2 text-blue-700 dark:text-blue-300 font-bold">
            <span class="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs">1</span>
            <span>طريقة التثبيت التلقائي المباشر في Microsoft Edge:</span>
          </div>
          <p class="text-sm text-slate-700 dark:text-slate-200 pr-8">
            اضغط على قائمة الثلاث نقاط (<b>⋯</b>) أعلى زاوية المتصفح ➔ اختر <b>«التطبيقات (Apps)»</b> ➔ ثم اضغط <b>«تثبيت هذا الموقع كتطبيق (Install this site as an app)»</b>.
          </p>
          <div class="text-xs text-blue-600 dark:text-blue-400 pr-8">
            💡 سيتم وضع اختصار دراجون برو على سطح المكتب، شريط المهام وقائمة ابدأ فوراً.
          </div>
        </div>
      `;
    } else if (env.os === 'Windows' && env.browser.includes('Chrome')) {
      guideHtml = `
        <div class="bg-blue-50 dark:bg-blue-900/30 p-4 rounded-2xl border border-blue-200 dark:border-blue-700 text-right space-y-3">
          <div class="flex items-center gap-2 text-blue-700 dark:text-blue-300 font-bold">
            <span class="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs">1</span>
            <span>طريقة التثبيت التلقائي في Google Chrome:</span>
          </div>
          <p class="text-sm text-slate-700 dark:text-slate-200 pr-8">
            اضغط على قائمة الثلاث نقاط (<b>⠇</b>) أعلى زاوية المتصفح ➔ اختر <b>«حفظ ومشاركة (Save and share)»</b> ➔ ثم اضغط <b>«تثبيت دراجون برو... (Install DragonPro)»</b>.
          </p>
          <div class="text-xs text-blue-600 dark:text-blue-400 pr-8">
            💡 أو اضغط على أيقونة التثبيت الصغيرة <b>[ ⤓ ]</b> الموجودة في أقصى شريط عنوان الرابط أعلى المتصفح.
          </div>
        </div>
      `;
    } else if (env.os === 'Android') {
      guideHtml = `
        <div class="bg-emerald-50 dark:bg-emerald-900/30 p-4 rounded-2xl border border-emerald-200 dark:border-emerald-700 text-right space-y-3">
          <div class="flex items-center gap-2 text-emerald-700 dark:text-emerald-300 font-bold">
            <span class="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs">1</span>
            <span>التثبيت على هواتف وأجهزة الأندرويد:</span>
          </div>
          <p class="text-sm text-slate-700 dark:text-slate-200 pr-8">
            اضغط على خيارات المتصفح (الثلاث نقاط <b>⠇</b>) ➔ اختر <b>«تثبيت التطبيق»</b> أو <b>«إضافة إلى الشاشة الرئيسية (Add to Home Screen)»</b>.
          </p>
        </div>
      `;
    } else if (env.os === 'iOS') {
      guideHtml = `
        <div class="bg-purple-50 dark:bg-purple-900/30 p-4 rounded-2xl border border-purple-200 dark:border-purple-700 text-right space-y-3">
          <div class="flex items-center gap-2 text-purple-700 dark:text-purple-300 font-bold">
            <span class="w-6 h-6 rounded-full bg-purple-600 text-white flex items-center justify-center text-xs">1</span>
            <span>التثبيت على هواتف iPhone وأجهزة iPad:</span>
          </div>
          <p class="text-sm text-slate-700 dark:text-slate-200 pr-8">
            اضغط على زر المشاركة بالأسفل <b>[ ⎋ / Share ]</b> في متصفح Safari ➔ ثم اختر <b>«إضافة إلى الشاشة الرئيسية (Add to Home Screen)»</b>.
          </p>
        </div>
      `;
    } else {
      guideHtml = `
        <div class="bg-slate-50 dark:bg-slate-800/80 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 text-right space-y-3">
          <p class="text-sm text-slate-700 dark:text-slate-200">
            يمكنك تثبيت البرنامج عبر قائمة متصفحك الرئيسية ➔ اختيار <b>«تثبيت التطبيق»</b> أو <b>«Install App»</b>.
          </p>
        </div>
      `;
    }

    let securityNotice = '';
    if (!env.isSecureForPWA) {
      securityNotice = `
        <div class="bg-amber-50 dark:bg-amber-950/40 p-3.5 rounded-xl border border-amber-200 dark:border-amber-800 text-right flex items-start gap-2.5 mt-3">
          <span class="text-amber-600 text-base">⚠️</span>
          <div class="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
            <b>ملاحظة أمنية هامة:</b> أنت تفتح البرنامج عبر عنوان IP محلي غير مشفر (<code class="bg-amber-100 dark:bg-amber-900 px-1 py-0.5 rounded text-amber-900 dark:text-amber-200">${window.location.hostname}</code>).
            تمنع متصفحات Chrome و Edge نوافذ التثبيت التلقائي على الروابط غير المشفرة عبر الشبكة. لتمكين التثبيت الفوري بنقرة واحدة، افتح البرنامج إما عبر <b>http://localhost:3000</b> أو عبر رابط الـ SSL السحابي (HTTPS).
          </div>
        </div>
      `;
    }

    Swal.fire({
      title: `
        <div class="flex items-center justify-center gap-2 text-xl font-bold text-slate-800 dark:text-slate-100">
          <span class="text-blue-600">💻</span>
          <span>تثبيت برنامج DragonPro</span>
        </div>
      `,
      html: `
        <div class="text-right space-y-3 py-2 font-sans">
          <div class="flex items-center justify-between bg-slate-100 dark:bg-slate-800 px-3.5 py-2.5 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300">
            <span>🖥️ نظام التشغيل: <b class="text-blue-600 dark:text-blue-400">${env.os}</b></span>
            <span>🌐 المتصفح: <b class="text-blue-600 dark:text-blue-400">${env.browser}</b></span>
          </div>
          ${guideHtml}
          ${securityNotice}
        </div>
      `,
      confirmButtonText: 'حسناً، فهمت',
      confirmButtonColor: '#2563eb',
      showCloseButton: true
    });
  };

  // If already running inside standalone desktop window
  if (isStandalone) {
    if (compact) return null;
    return (
      <div 
        className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/60 text-xs font-bold shadow-sm transition-all"
        title="أنت تعمل الآن داخل تطبيق سطح المكتب المستقل"
      >
        <CheckCircle size={14} className="text-emerald-500" />
        <span>تطبيق سطح المكتب</span>
      </div>
    );
  }

  // If user just installed it in this session
  if (isInstalled) {
    return (
      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 text-xs font-bold">
        <CheckCircle size={14} className="text-emerald-500" />
        <span>تم التثبيت بنجاح</span>
      </div>
    );
  }

  return (
    <button
      onClick={handleInstallClick}
      disabled={isChecking}
      className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all duration-200 shadow-sm active:scale-95 ${
        deferredPrompt || (typeof window !== 'undefined' && window.deferredPwaPrompt)
          ? 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-blue-500/25 hover:shadow-lg hover:scale-105 animate-pulse'
          : 'bg-blue-50 hover:bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:hover:bg-blue-900/50 dark:text-blue-300 border border-blue-200 dark:border-blue-800 hover:shadow-md'
      }`}
      title="تثبيت دراجون برو كتطبيق أصلي على الكمبيوتر وسطح المكتب"
    >
      {isChecking ? (
        <>
          <Loader2 size={15} className="animate-spin text-blue-500" />
          <span>جاري الاستدعاء...</span>
        </>
      ) : (
        <>
          <Download size={15} className={deferredPrompt ? 'text-white' : 'text-blue-600 dark:text-blue-400'} />
          <span className="hidden sm:inline">تثبيت التطبيق</span>
          <span className="sm:hidden">تثبيت</span>
        </>
      )}
    </button>
  );
};

export default PWAInstallButton;
