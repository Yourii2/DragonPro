import React, { useEffect, useState } from 'react';
import { 
  Hourglass, 
  Info, 
  Fingerprint, 
  Building2, 
  Phone, 
  Check, 
  Copy, 
  ClipboardCopy, 
  Star, 
  Send, 
  CheckCircle2, 
  RefreshCw 
} from 'lucide-react';
import { API_BASE_PATH } from '../services/apiConfig';
import Swal from 'sweetalert2';

const WhatsAppIcon: React.FC<{ className?: string }> = ({ className = "w-5 h-5" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
  </svg>
);

const TelegramIcon: React.FC<{ className?: string }> = ({ className = "w-5 h-5" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z"/>
  </svg>
);

const TrialExpiredPage: React.FC = () => {
  const [rating, setRating] = useState<number>(0);
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [comment, setComment] = useState<string>('');
  const [isSubmitted, setIsSubmitted] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  const [clientInfo, setClientInfo] = useState<{ device_code: string; company_name: string; company_phone: string } | null>(null);
  const [copiedField, setCopiedField] = useState<string>('');

  useEffect(() => {
    (async () => {
      try {
        const response = await fetch(`${API_BASE_PATH}/verify.php`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ force: true })
        });
        const data = await response.json();
        if (data.client_info) {
          setClientInfo(data.client_info);
        }
      } catch (e) {
        // Ignore — we'll just not show client info
      }
    })();
  }, []);

  const handleCopy = (text: string, field: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedField(field);
      setTimeout(() => setCopiedField(''), 2000);
    }).catch(() => {});
  };

  /** Build a pre-filled message including client info for WhatsApp/Telegram */
  const buildContactMessage = (intro: string) => {
    const parts: string[] = [intro];
    if (clientInfo?.device_code) parts.push(`كود الجهاز: ${clientInfo.device_code}`);
    if (clientInfo?.company_name) parts.push(`اسم الشركة: ${clientInfo.company_name}`);
    if (clientInfo?.company_phone) parts.push(`رقم الهاتف: ${clientInfo.company_phone}`);
    return encodeURIComponent(parts.join('\n'));
  };

  const handleVerifyActivation = async () => {
    setIsVerifying(true);
    try {
      const response = await fetch(`${API_BASE_PATH}/verify.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ force: true })
      });
      const data = await response.json();
      
      if (data.status === 'ok') {
        Swal.fire({
          icon: 'success',
          title: 'تم التفعيل بنجاح!',
          text: 'تم التحقق من الترخيص وتفعيله بنجاح. سيتم توجيهك الآن للوحة التحكم.',
          confirmButtonText: 'حسناً',
          confirmButtonColor: '#10b981'
        }).then(() => {
          window.location.reload();
        });
      } else {
        if (data.client_info) setClientInfo(data.client_info);
        Swal.fire({
          icon: 'warning',
          title: 'لم يتم التفعيل بعد',
          text: data.message || 'حالة الترخيص الحالية لا تزال غير مفعلة أو منتهية. يرجى التواصل مع المبيعات لشراء النسخة الكاملة.',
          confirmButtonText: 'حسناً',
          confirmButtonColor: '#3b82f6'
        });
      }
    } catch (err: any) {
      Swal.fire({
        icon: 'error',
        title: 'خطأ في الاتصال',
        text: 'فشل الاتصال بخادم التفعيل، يرجى التحقق من اتصالك بالإنترنت والمحاولة مجدداً.',
        confirmButtonText: 'حسناً',
        confirmButtonColor: '#ef4444'
      });
    } finally {
      setIsVerifying(false);
    }
  };

  const handleSubmitFeedback = async (e: React.FormEvent) => {
    e.preventDefault();
    if (rating === 0) {
      Swal.fire({
        icon: 'warning',
        title: 'تنبيه',
        text: 'يرجى تحديد تقييم بالنجوم أولاً',
        confirmButtonText: 'حسناً',
        confirmButtonColor: '#3b82f6'
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch(`${API_BASE_PATH}/api.php?module=feedback&action=submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating, comment })
      });
      const data = await response.json();
      if (data.success) {
        setIsSubmitted(true);
        Swal.fire({
          icon: 'success',
          title: 'شكراً لك!',
          text: 'تم إرسال تقييمك بنجاح. نسعد دائماً بخدمتكم.',
          confirmButtonText: 'حسناً',
          confirmButtonColor: '#10b981'
        });
      } else {
        throw new Error(data.message || 'فشل إرسال التقييم');
      }
    } catch (err: any) {
      Swal.fire({
        icon: 'error',
        title: 'خطأ',
        text: err.message || 'حدث خطأ أثناء إرسال التقييم، يرجى المحاولة مرة أخرى.',
        confirmButtonText: 'حسناً',
        confirmButtonColor: '#ef4444'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-4 transition-colors duration-300" dir="rtl">
      <div className="w-full max-w-xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-100 dark:border-slate-800 overflow-hidden relative">
        
        {/* Decorative background lights */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"></div>

        {/* Header Section */}
        <div className="p-8 pb-4 text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-amber-50 dark:bg-amber-950/30 rounded-full text-amber-500 mb-4 animate-bounce">
            <Hourglass className="w-10 h-10" />
          </div>
          <h1 className="text-3xl font-extrabold text-slate-800 dark:text-slate-100 mb-2">
            انتهت الفترة التجريبية
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed max-w-md mx-auto">
            نشكركم جزيل الشكر على استخدام وتجربة برنامج <span className="font-bold text-amber-500">دراجون برو</span> لإدارة المؤسسات. نأمل أن تكون هذه الفترة قد نالت إعجابكم وسهلت عليكم إدارة أعمالكم.
          </p>
        </div>

        {/* Client Info Section */}
        {clientInfo && (clientInfo.device_code || clientInfo.company_name || clientInfo.company_phone) && (
          <div className="mx-8 mb-2 rounded-2xl border border-blue-200 dark:border-blue-900/50 bg-blue-50/80 dark:bg-blue-950/30 p-4">
            <div className="flex items-center gap-2 mb-3">
              <Info className="w-4 h-4 text-blue-500" />
              <h3 className="text-sm font-bold text-blue-700 dark:text-blue-300">بيانات الجهاز والحساب</h3>
            </div>
            <p className="text-[11px] text-blue-600/70 dark:text-blue-400/70 mb-3">يرجى مشاركة هذه البيانات عند التواصل معنا لتسريع عملية التفعيل.</p>
            <div className="space-y-2">
              {clientInfo.device_code && (
                <div className="flex items-center justify-between gap-2 bg-white dark:bg-slate-800 rounded-xl px-3 py-2.5 border border-blue-100 dark:border-slate-700">
                  <div className="flex items-center gap-2 min-w-0">
                    <Fingerprint className="w-4 h-4 text-blue-500 shrink-0" />
                    <div className="min-w-0">
                      <div className="text-[10px] text-slate-400 font-bold">كود الجهاز</div>
                      <div className="text-xs font-mono font-bold text-slate-700 dark:text-slate-200 truncate select-all">{clientInfo.device_code}</div>
                    </div>
                  </div>
                  <button
                    onClick={() => handleCopy(clientInfo.device_code, 'device_code')}
                    className="shrink-0 text-[10px] font-bold px-2 py-1 rounded-lg bg-blue-100 text-blue-600 hover:bg-blue-200 dark:bg-blue-900/40 dark:text-blue-300 transition-colors"
                    title="نسخ كود الجهاز"
                  >
                    {copiedField === 'device_code' ? <><Check className="w-3 h-3 ml-1 inline" />تم النسخ</> : <><Copy className="w-3 h-3 ml-1 inline" />نسخ</>}
                  </button>
                </div>
              )}
              {clientInfo.company_name && (
                <div className="flex items-center justify-between gap-2 bg-white dark:bg-slate-800 rounded-xl px-3 py-2.5 border border-blue-100 dark:border-slate-700">
                  <div className="flex items-center gap-2 min-w-0">
                    <Building2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    <div className="min-w-0">
                      <div className="text-[10px] text-slate-400 font-bold">اسم الشركة</div>
                      <div className="text-xs font-bold text-slate-700 dark:text-slate-200 truncate">{clientInfo.company_name}</div>
                    </div>
                  </div>
                  <button
                    onClick={() => handleCopy(clientInfo.company_name, 'company_name')}
                    className="shrink-0 text-[10px] font-bold px-2 py-1 rounded-lg bg-blue-100 text-blue-600 hover:bg-blue-200 dark:bg-blue-900/40 dark:text-blue-300 transition-colors"
                    title="نسخ اسم الشركة"
                  >
                    {copiedField === 'company_name' ? <><Check className="w-3 h-3 ml-1 inline" />تم النسخ</> : <><Copy className="w-3 h-3 ml-1 inline" />نسخ</>}
                  </button>
                </div>
              )}
              {clientInfo.company_phone && (
                <div className="flex items-center justify-between gap-2 bg-white dark:bg-slate-800 rounded-xl px-3 py-2.5 border border-blue-100 dark:border-slate-700">
                  <div className="flex items-center gap-2 min-w-0">
                    <Phone className="w-4 h-4 text-amber-500 shrink-0" />
                    <div className="min-w-0">
                      <div className="text-[10px] text-slate-400 font-bold">رقم الهاتف</div>
                      <div className="text-xs font-mono font-bold text-slate-700 dark:text-slate-200 truncate select-all" dir="ltr">{clientInfo.company_phone}</div>
                    </div>
                  </div>
                  <button
                    onClick={() => handleCopy(clientInfo.company_phone, 'company_phone')}
                    className="shrink-0 text-[10px] font-bold px-2 py-1 rounded-lg bg-blue-100 text-blue-600 hover:bg-blue-200 dark:bg-blue-900/40 dark:text-blue-300 transition-colors"
                    title="نسخ رقم الهاتف"
                  >
                    {copiedField === 'company_phone' ? <><Check className="w-3 h-3 ml-1 inline" />تم النسخ</> : <><Copy className="w-3 h-3 ml-1 inline" />نسخ</>}
                  </button>
                </div>
              )}
            </div>
            {/* Copy All button */}
            <button
              onClick={() => {
                const parts: string[] = [];
                if (clientInfo.device_code) parts.push(`كود الجهاز: ${clientInfo.device_code}`);
                if (clientInfo.company_name) parts.push(`اسم الشركة: ${clientInfo.company_name}`);
                if (clientInfo.company_phone) parts.push(`رقم الهاتف: ${clientInfo.company_phone}`);
                handleCopy(parts.join('\n'), 'all');
              }}
              className="mt-3 w-full text-[11px] font-bold py-2 rounded-xl bg-blue-600 text-white hover:bg-blue-700 transition-colors flex items-center justify-center gap-1.5"
            >
              {copiedField === 'all' ? <><Check className="w-3.5 h-3.5 ml-1" />تم نسخ جميع البيانات</> : <><ClipboardCopy className="w-3.5 h-3.5 ml-1" />نسخ جميع البيانات</>}
            </button>
          </div>
        )}

        {/* Feedback Section */}
        <div className="px-8 py-4 border-t border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
          {!isSubmitted ? (
            <form onSubmit={handleSubmitFeedback} className="space-y-4">
              <div className="text-center">
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                  كيف تقيم تجربتك للبرنامج؟
                </label>
                <div className="flex justify-center items-center gap-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setRating(star)}
                      onMouseEnter={() => setHoverRating(star)}
                      onMouseLeave={() => setHoverRating(0)}
                      className="text-2xl transition-transform duration-150 hover:scale-125 focus:outline-none"
                    >
                      <Star
                        className={`w-6 h-6 ${
                          star <= (hoverRating || rating)
                            ? 'text-amber-400 fill-amber-400'
                            : 'text-slate-300 dark:text-slate-700'
                        }`}
                      />
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="شاركنا رأيك، اقتراحاتك، أو أي ملاحظات لتطوير البرنامج..."
                  rows={3}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50 text-sm transition-all"
                ></textarea>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-amber-500 hover:bg-amber-600 text-white font-bold py-2.5 px-6 rounded-xl transition-all shadow-lg shadow-amber-500/20 hover:shadow-amber-500/30 flex items-center justify-center gap-2 text-sm disabled:opacity-50"
              >
                {isSubmitting ? (
                  <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                ) : (
                  <>
                    <Send className="w-4 h-4 ml-1" />
                    إرسال التقييم
                  </>
                )}
              </button>
            </form>
          ) : (
            <div className="text-center py-6">
              <div className="inline-flex items-center justify-center w-12 h-12 bg-emerald-100 dark:bg-emerald-950/30 text-emerald-500 rounded-full mb-3">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h3 className="text-base font-bold text-slate-800 dark:text-slate-100 mb-1">تم إرسال تقييمك بنجاح!</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                شكراً لمشاركتك القيّمة، تساعدنا آرائكم على المضي قدماً في توفير أفضل تجربة لكم.
              </p>
            </div>
          )}
        </div>

        {/* Contact/Purchase Section */}
        <div className="p-8 text-center space-y-4">
          <div>
            <h2 className="text-lg font-bold text-slate-800 dark:text-slate-200 mb-1">
              شراء النسخة الكاملة
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              لتفعيل البرنامج بشكل دائم وبلا قيود، وتجنب فقدان بياناتك، يمكنك التواصل معنا مباشرة لشراء الترخيص الكامل:
            </p>
          </div>

          <div className="pt-2">
            <button
              onClick={handleVerifyActivation}
              disabled={isVerifying}
              className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold py-3.5 px-4 rounded-xl transition-all shadow-md shadow-blue-500/10 hover:shadow-blue-500/20 text-sm flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isVerifying ? (
                <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4 ml-1" />
                  تأكيد التفعيل وإعادة التحقق
                </>
              )}
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            {/* Sales WhatsApp */}
            <a
              href={`https://wa.me/201050016289?text=${buildContactMessage('السلام عليكم، أود شراء النسخة الكاملة من برنامج دراجون برو')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2.5 bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-3 px-4 rounded-xl transition-all shadow-md shadow-emerald-500/10 hover:shadow-emerald-500/20 text-sm"
            >
              <WhatsAppIcon className="w-5 h-5 ml-1.5" />
              واتساب المبيعات
            </a>

            {/* Sales Telegram */}
            <a
              href={`https://t.me/+201050016289?text=${buildContactMessage('السلام عليكم، أود شراء النسخة الكاملة من برنامج دراجون برو')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2.5 bg-sky-500 hover:bg-sky-600 text-white font-bold py-3 px-4 rounded-xl transition-all shadow-md shadow-sky-500/10 hover:shadow-sky-500/20 text-sm"
            >
              <TelegramIcon className="w-5 h-5 ml-1.5" />
              تليجرام المبيعات
            </a>

            {/* Technical Support WhatsApp */}
            <a
              href={`https://wa.me/201150006289?text=${buildContactMessage('السلام عليكم، لدى استفسار بخصوص تفعيل برنامج دراجون برو')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold py-3 px-4 rounded-xl transition-all text-sm"
            >
              <WhatsAppIcon className="w-5 h-5 ml-1.5 text-emerald-500" />
              واتساب الدعم الفني
            </a>

            {/* Technical Support Telegram */}
            <a
              href={`https://t.me/+201150006289?text=${buildContactMessage('السلام عليكم، لدى استفسار بخصوص تفعيل برنامج دراجون برو')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold py-3 px-4 rounded-xl transition-all text-sm"
            >
              <TelegramIcon className="w-5 h-5 ml-1.5 text-sky-500" />
              تليجرام الدعم الفني
            </a>
          </div>

          {/* Call option as alternative */}
          <div className="text-xs text-slate-400 dark:text-slate-500 pt-2 flex items-center justify-center gap-4">
            <span className="flex items-center gap-1">
              <Phone className="w-3.5 h-3.5" />
              اتصال مباشر: <a href="tel:01050016289" className="hover:underline font-mono">01050016289</a>
            </span>
          </div>
        </div>

      </div>

      {/* Developer signature */}
      <div className="mt-6 text-center text-xs text-slate-400 dark:text-slate-600">
        <span>تطوير: م. ممدوح المصري | شركة دراجون للأنظمة الأمنية</span>
      </div>
    </div>
  );
};

export default TrialExpiredPage;
