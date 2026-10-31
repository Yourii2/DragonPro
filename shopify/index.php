<?php
/**
 * DragonPro - Shopify Control Center
 * Complete standalone portal for Shopify integration, order sync,
 * product mapping, webhook simulation, and live logs.
 */

require_once __DIR__ . '/core.php';

try {
    $pdo = shopify_get_pdo();
} catch (Exception $e) {
    die("Database Error: " . $e->getMessage());
}

$enabled = shopify_get_setting($pdo, 'shopify_enabled', 'false');
$isLive = ($enabled === 'true' || $enabled === '1' || $enabled === 1 || $enabled === true);

$protocol = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off' || (isset($_SERVER['SERVER_PORT']) && $_SERVER['SERVER_PORT'] == 443)) ? "https://" : "http://";
$host = $_SERVER['HTTP_HOST'] ?? 'localhost';
$baseDir = rtrim(dirname(dirname($_SERVER['SCRIPT_NAME'])), '/\\');
$webhookUrl = $protocol . $host . $baseDir . '/components/shopify/webhook.php';
?>
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>مركز تحكم Shopify - DragonPro</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap" rel="stylesheet">
    <style>
        body { font-family: 'Cairo', sans-serif; }
        .tab-btn.active {
            background-color: #059669;
            color: #ffffff;
            font-weight: 700;
        }
    </style>
</head>
<body class="bg-slate-900 text-slate-100 min-h-screen">

    <header class="border-b border-slate-800 bg-slate-950/80 backdrop-blur sticky top-0 z-40">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
            <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-600 flex items-center justify-center font-black text-xl shadow-lg shadow-emerald-500/20">
                    🟢
                </div>
                <div>
                    <h1 class="text-base font-bold text-white flex items-center gap-2">
                        DragonPro <span class="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-medium">Shopify Suite</span>
                    </h1>
                    <p class="text-[11px] text-slate-400">الربط التلقائي، المزامنة، ومطابقة المنتجات مع متاجر Shopify الرسمية</p>
                </div>
            </div>

            <div class="flex items-center gap-3">
                <button onclick="testConnection()" id="btnQuickTest" class="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors flex items-center gap-1.5 border border-slate-700">
                    <span id="quickTestSpinner" class="hidden animate-spin">🔄</span>
                    <span>فحص اتصال المتجر</span>
                </button>
                <a href="../" class="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-md flex items-center gap-1.5">
                    <span>العودة للنظام الرئيسي ←</span>
                </a>
            </div>
        </div>
    </header>

    <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">

        <!-- Top Metrics Grid -->
        <div class="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div class="p-4 rounded-3xl bg-slate-800/60 border border-slate-800">
                <span class="text-[11px] text-slate-400 font-bold block mb-1">إجمالي المستورد</span>
                <span class="text-2xl font-black text-white" id="statTotal">-</span>
                <span class="text-[10px] text-slate-500 block mt-1">طلب من شوبيفاي</span>
            </div>
            <div class="p-4 rounded-3xl bg-slate-800/60 border border-slate-800">
                <span class="text-[11px] text-emerald-400 font-bold block mb-1">الطلبات الناجحة</span>
                <span class="text-2xl font-black text-emerald-400" id="statSuccess">-</span>
                <span class="text-[10px] text-slate-500 block mt-1">مدرجة في المبيعات</span>
            </div>
            <div class="p-4 rounded-3xl bg-slate-800/60 border border-slate-800">
                <span class="text-[11px] text-teal-400 font-bold block mb-1">إجمالي المبيعات</span>
                <span class="text-2xl font-black text-teal-400" id="statRevenue">-</span>
                <span class="text-[10px] text-slate-500 block mt-1">ج.م قيمة الفواتير</span>
            </div>
            <div class="p-4 rounded-3xl bg-slate-800/60 border border-slate-800">
                <span class="text-[11px] text-indigo-400 font-bold block mb-1">طلبات اليوم</span>
                <span class="text-2xl font-black text-indigo-400" id="statToday">-</span>
                <span class="text-[10px] text-slate-500 block mt-1">خلال اليوم الحالي</span>
            </div>
            <div class="p-4 rounded-3xl bg-slate-800/60 border border-slate-800 col-span-2 md:col-span-1">
                <span class="text-[11px] text-rose-400 font-bold block mb-1">أخطاء الاستيراد</span>
                <span class="text-2xl font-black text-rose-400" id="statFailed">-</span>
                <span class="text-[10px] text-slate-500 block mt-1">يمكن إعادة معالجتها</span>
            </div>
        </div>

        <!-- Webhook Setup Bar -->
        <div class="p-5 rounded-3xl bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 border border-slate-800 shadow-lg">
            <div class="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div class="space-y-1">
                    <div class="flex items-center gap-2">
                        <span class="w-2.5 h-2.5 rounded-full <?php echo $isLive ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'; ?>"></span>
                        <h3 class="text-xs font-bold text-white">رابط الويب هوك الخاص بمتجر Shopify (Webhook URL):</h3>
                    </div>
                    <p class="text-[11px] text-slate-400">ضعه في شوبيفاي: Settings &gt; Notifications &gt; Webhooks مع اختيار Event: Order creation.</p>
                </div>

                <div class="flex items-center gap-2 w-full md:w-auto">
                    <input type="text" id="webhookInput" readonly value="<?php echo htmlspecialchars($webhookUrl); ?>" class="flex-1 md:w-96 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-300 font-mono select-all focus:outline-none">
                    <button onclick="copyWebhookUrl()" id="btnCopyWebhook" class="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all whitespace-nowrap shadow">
                        نسخ الرابط
                    </button>
                </div>
            </div>
            <div id="testResultBox" class="mt-3 hidden p-3 rounded-xl text-xs font-bold border"></div>
        </div>

        <!-- Tabs Navigation -->
        <div class="flex items-center gap-2 border-b border-slate-800 pb-3 overflow-x-auto">
            <button onclick="switchTab('orders')" id="tabBtn-orders" class="tab-btn active px-4 py-2 rounded-xl text-xs font-medium text-slate-300 hover:text-white transition-colors flex items-center gap-1.5 whitespace-nowrap">
                <span>📦</span> الطلبات المستوردة
            </button>
            <button onclick="switchTab('sync')" id="tabBtn-sync" class="tab-btn px-4 py-2 rounded-xl text-xs font-medium text-slate-300 hover:text-white transition-colors flex items-center gap-1.5 whitespace-nowrap">
                <span>📥</span> سحب ومزامنة الطلبات
            </button>
            <button onclick="switchTab('mapping')" id="tabBtn-mapping" class="tab-btn px-4 py-2 rounded-xl text-xs font-medium text-slate-300 hover:text-white transition-colors flex items-center gap-1.5 whitespace-nowrap">
                <span>🏷️</span> مطابقة المنتجات والـ SKU
            </button>
            <button onclick="switchTab('simulator')" id="tabBtn-simulator" class="tab-btn px-4 py-2 rounded-xl text-xs font-medium text-slate-300 hover:text-white transition-colors flex items-center gap-1.5 whitespace-nowrap">
                <span>🧪</span> محاكي فحص الويب هوك
            </button>
            <button onclick="switchTab('settings')" id="tabBtn-settings" class="tab-btn px-4 py-2 rounded-xl text-xs font-medium text-slate-300 hover:text-white transition-colors flex items-center gap-1.5 whitespace-nowrap">
                <span>⚙️</span> إعدادات المتجر والتوكن
            </button>
            <button onclick="switchTab('logs')" id="tabBtn-logs" class="tab-btn px-4 py-2 rounded-xl text-xs font-medium text-slate-300 hover:text-white transition-colors flex items-center gap-1.5 whitespace-nowrap">
                <span>📜</span> سجل النشاط
            </button>
        </div>

        <!-- TAB 1: Orders -->
        <section id="tab-orders" class="tab-content space-y-4">
            <div class="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-800/40 p-4 rounded-2xl border border-slate-800">
                <div class="relative flex-1 max-w-md">
                    <input type="text" id="orderSearchInput" onkeyup="if(event.key==='Enter') loadOrders()" placeholder="بحث برقم الطلب، اسم العميل، الهاتف، أو معرّف Shopify..." class="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500">
                </div>
                <div class="flex items-center gap-2">
                    <button onclick="loadOrders()" class="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 border border-slate-700 transition-colors flex items-center gap-1.5">
                        <span>🔄 تحديث</span>
                    </button>
                    <button onclick="switchTab('sync')" class="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white transition-all shadow-sm">
                        + سحب طلبات جديدة
                    </button>
                </div>
            </div>

            <div class="rounded-3xl bg-slate-800/40 border border-slate-800 overflow-hidden">
                <div class="overflow-x-auto">
                    <table class="w-full text-right text-xs">
                        <thead class="bg-slate-900/90 text-slate-400 text-[11px] uppercase border-b border-slate-800">
                            <tr>
                                <th class="px-4 py-3.5">رقم DragonPro</th>
                                <th class="px-4 py-3.5">معرف Shopify</th>
                                <th class="px-4 py-3.5">اسم العميل</th>
                                <th class="px-4 py-3.5">رقم الهاتف</th>
                                <th class="px-4 py-3.5">الإجمالي</th>
                                <th class="px-4 py-3.5">الحالة</th>
                                <th class="px-4 py-3.5">تاريخ الاستيراد</th>
                                <th class="px-4 py-3.5 text-center">إجراءات</th>
                            </tr>
                        </thead>
                        <tbody id="ordersTableBody" class="divide-y divide-slate-800/50">
                            <tr>
                                <td colspan="8" class="px-4 py-8 text-center text-slate-500">جاري تحميل الطلبات...</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </section>

        <!-- TAB 2: Sync -->
        <section id="tab-sync" class="tab-content hidden space-y-4">
            <div class="max-w-2xl mx-auto p-6 rounded-3xl bg-slate-800/40 border border-slate-800 space-y-6">
                <div>
                    <h3 class="text-sm font-bold text-white flex items-center gap-2">
                        <span>📥</span> سحب ومزامنة الطلبات عبر Shopify Admin API
                    </h3>
                    <p class="text-xs text-slate-400 mt-1">
                        يقوم هذا الخيار بالاتصال المباشر بمتجر شوبيفاي وسحب الطلبات مع فلترة بالتاريخ والحالة.
                    </p>
                </div>

                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <label class="text-[11px] font-bold text-slate-400 mb-1 block">تاريخ البدء (Created At Min):</label>
                        <input type="date" id="syncFrom" class="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white">
                    </div>
                    <div>
                        <label class="text-[11px] font-bold text-slate-400 mb-1 block">تاريخ الانتهاء (Created At Max):</label>
                        <input type="date" id="syncTo" class="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white">
                    </div>
                    <div>
                        <label class="text-[11px] font-bold text-slate-400 mb-1 block">حالة الطلب في شوبيفاي:</label>
                        <select id="syncStatus" class="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white">
                            <option value="any" selected>جميع الحالات (Any)</option>
                            <option value="open">مفتوح (Open)</option>
                            <option value="closed">مغلق (Closed)</option>
                            <option value="cancelled">ملغي (Cancelled)</option>
                        </select>
                    </div>
                    <div>
                        <label class="text-[11px] font-bold text-slate-400 mb-1 block">العدد في الدفعة (Limit):</label>
                        <input type="number" id="syncLimit" value="25" min="5" max="100" class="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white">
                    </div>
                </div>

                <div id="syncReportBox" class="hidden p-4 rounded-2xl text-xs space-y-1"></div>

                <button onclick="executeSync()" id="btnExecSync" class="w-full py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2">
                    <span id="syncSpinner" class="hidden animate-spin">🔄</span>
                    <span>بدء سحب طلبات شوبيفاي الآن</span>
                </button>
            </div>
        </section>

        <!-- TAB 3: Mapping -->
        <section id="tab-mapping" class="tab-content hidden space-y-4">
            <div class="p-6 rounded-3xl bg-slate-800/40 border border-slate-800 space-y-4">
                <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div>
                        <h3 class="text-sm font-bold text-white flex items-center gap-2">
                            <span>🏷️</span> مطابقة منتجات شوبيفاي مع مخازن DragonPro
                        </h3>
                        <p class="text-xs text-slate-400 mt-1">
                            فحص الـ SKU والباركود لكل منتج ومتغيراته في Shopify لضمان خصم المخزون بدقة.
                        </p>
                    </div>
                    <button onclick="fetchProductMapping()" id="btnFetchMapping" class="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-md flex items-center gap-2 whitespace-nowrap">
                        <span id="mappingSpinner" class="hidden animate-spin">🔄</span>
                        <span>فحص منتجات شوبيفاي الآن</span>
                    </button>
                </div>

                <div class="rounded-2xl border border-slate-800 overflow-hidden bg-slate-900/60">
                    <div class="overflow-x-auto">
                        <table class="w-full text-right text-xs">
                            <thead class="bg-slate-900 text-slate-400 text-[11px] border-b border-slate-800">
                                <tr>
                                    <th class="px-4 py-3">اسم المنتج والمتغير في Shopify</th>
                                    <th class="px-4 py-3">الـ SKU / الكود</th>
                                    <th class="px-4 py-3">السعر</th>
                                    <th class="px-4 py-3">حالة المطابقة في DragonPro</th>
                                    <th class="px-4 py-3">الصنف المرتبط</th>
                                </tr>
                            </thead>
                            <tbody id="mappingTableBody" class="divide-y divide-slate-800/60">
                                <tr>
                                    <td colspan="5" class="px-4 py-8 text-center text-slate-500">
                                        اضغط على زر "فحص منتجات شوبيفاي الآن" لجلب المنتجات من المتجر ومقارنتها.
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </section>

        <!-- TAB 4: Simulator -->
        <section id="tab-simulator" class="tab-content hidden space-y-4">
            <div class="max-w-2xl mx-auto p-6 rounded-3xl bg-slate-800/40 border border-slate-800 space-y-6">
                <div>
                    <h3 class="text-sm font-bold text-white flex items-center gap-2">
                        <span>🧪</span> محاكي فحص استقبال طلبات شوبيفاي (Webhook Simulator)
                    </h3>
                    <p class="text-xs text-slate-400 mt-1">
                        إرسال طلب تجريبي متطابق مع حمولة Shopify الرسمية للتأكد من نزول الأوردر في جدول المبيعات والمخزن فوراً.
                    </p>
                </div>

                <div id="simResultBox" class="hidden p-4 rounded-2xl text-xs space-y-1"></div>

                <button onclick="runSimulation()" id="btnRunSim" class="w-full py-3 rounded-2xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold transition-all shadow-lg shadow-teal-600/20 flex items-center justify-center gap-2">
                    <span id="simSpinner" class="hidden animate-spin">🔄</span>
                    <span>⚡ إرسال طلب تجريبي وفحص السيستم الآن</span>
                </button>
            </div>
        </section>

        <!-- TAB 5: Settings -->
        <section id="tab-settings" class="tab-content hidden space-y-4">
            <div class="max-w-2xl mx-auto p-6 rounded-3xl bg-slate-800/40 border border-slate-800 space-y-5">
                <div>
                    <h3 class="text-sm font-bold text-white flex items-center gap-2">
                        <span>⚙️</span> إعدادات الربط المباشر مع Shopify
                    </h3>
                    <p class="text-xs text-slate-400 mt-1">
                        أدخل نطاق متجرك (مثال: <code>your-store.myshopify.com</code>) والـ Admin API Access Token المستخرج من لوحة تحكم التطبيقات في شوبيفاي.
                    </p>
                </div>

                <div class="space-y-4">
                    <div class="flex items-center justify-between p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800">
                        <div>
                            <span class="text-xs font-bold text-white block">تفعيل استقبال طلبات Shopify</span>
                            <span class="text-[11px] text-slate-400 block">تشغيل أو إيقاف المزامنة التلقائية</span>
                        </div>
                        <input type="checkbox" id="cfgEnabled" class="w-5 h-5 rounded text-emerald-600 focus:ring-0">
                    </div>

                    <div>
                        <label class="text-[11px] font-bold text-slate-400 mb-1 block">نطاق المتجر (Shopify Store Domain):</label>
                        <input type="text" id="cfgShopDomain" placeholder="your-store.myshopify.com" class="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono">
                    </div>

                    <div>
                        <label class="text-[11px] font-bold text-slate-400 mb-1 block">توكن الـ Admin API (Admin Access Token):</label>
                        <input type="password" id="cfgAccessToken" placeholder="shpat_..." class="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono">
                    </div>

                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label class="text-[11px] font-bold text-slate-400 mb-1 block">الحالة الافتراضية للطلب:</label>
                            <select id="cfgDefaultStatus" class="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white">
                                <option value="pending">قيد الانتظار (pending)</option>
                                <option value="confirmed">تم التأكيد (confirmed)</option>
                            </select>
                        </div>
                        <div>
                            <label class="text-[11px] font-bold text-slate-400 mb-1 block">مصدر الطلب (Page Tag):</label>
                            <input type="text" id="cfgDefaultPage" value="Shopify" class="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white">
                        </div>
                    </div>

                    <div id="cfgSaveResult" class="hidden p-3 rounded-xl text-xs font-bold"></div>

                    <button onclick="saveDashboardSettings()" id="btnSaveCfg" class="w-full py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-md flex items-center justify-center gap-2">
                        <span>حفظ إعدادات شوبيفاي</span>
                    </button>
                </div>
            </div>
        </section>

        <!-- TAB 6: Logs -->
        <section id="tab-logs" class="tab-content hidden space-y-4">
            <div class="p-6 rounded-3xl bg-slate-800/40 border border-slate-800 space-y-4">
                <div class="flex items-center justify-between">
                    <div>
                        <h3 class="text-sm font-bold text-white">سجل نشاط Shopify</h3>
                        <p class="text-[11px] text-slate-400">سجل الإشعارات، استدعاءات الويب هوك، وعمليات السحب</p>
                    </div>
                    <button onclick="loadLogs()" class="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 border border-slate-700 transition-colors">
                        🔄 تحديث السجل
                    </button>
                </div>

                <div class="rounded-2xl border border-slate-800 overflow-hidden bg-slate-900/60">
                    <div class="overflow-x-auto">
                        <table class="w-full text-right text-xs">
                            <thead class="bg-slate-900 text-slate-400 text-[11px] border-b border-slate-800">
                                <tr>
                                    <th class="px-4 py-3">الوقت</th>
                                    <th class="px-4 py-3">نوع الحركة</th>
                                    <th class="px-4 py-3">الحالة</th>
                                    <th class="px-4 py-3">تفاصيل الرسالة</th>
                                </tr>
                            </thead>
                            <tbody id="logsTableBody" class="divide-y divide-slate-800/60">
                                <tr>
                                    <td colspan="4" class="px-4 py-8 text-center text-slate-500">جاري تحميل السجل...</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </section>

    </main>

    <!-- Details Modal -->
    <div id="detailsModal" class="fixed inset-0 bg-slate-950/85 backdrop-blur-sm z-50 hidden flex items-center justify-center p-4">
        <div class="bg-slate-900 border border-slate-800 rounded-3xl max-w-2xl w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div class="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 class="text-sm font-bold text-white flex items-center gap-2">
                    <span>📋</span> تفاصيل طلب شوبيفاي
                </h3>
                <button onclick="closeDetailsModal()" class="text-slate-400 hover:text-white text-lg font-bold">&times;</button>
            </div>
            <div id="detailsModalContent" class="space-y-4 text-xs"></div>
            <div class="flex justify-end pt-2">
                <button onclick="closeDetailsModal()" class="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-all">إغلاق</button>
            </div>
        </div>
    </div>

    <!-- Scripts -->
    <script>
        function switchTab(tabId) {
            document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
            document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));

            const content = document.getElementById('tab-' + tabId);
            const btn = document.getElementById('tabBtn-' + tabId);
            if (content) content.classList.remove('hidden');
            if (btn) btn.classList.add('active');

            if (tabId === 'orders') loadOrders();
            if (tabId === 'logs') loadLogs();
        }

        async function fetchStats() {
            try {
                const res = await fetch('api_handler.php?action=get_stats');
                const json = await res.json();
                if (json.success && json.data) {
                    document.getElementById('statTotal').innerText = json.data.total_orders;
                    document.getElementById('statSuccess').innerText = json.data.success_orders;
                    document.getElementById('statFailed').innerText = json.data.failed_orders;
                    document.getElementById('statToday').innerText = json.data.today_orders;
                    document.getElementById('statRevenue').innerText = parseFloat(json.data.total_revenue || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });

                    document.getElementById('cfgEnabled').checked = !!json.data.enabled;
                    document.getElementById('cfgShopDomain').value = json.data.shop_domain || '';
                    if (json.data.default_status) document.getElementById('cfgDefaultStatus').value = json.data.default_status;
                    if (json.data.default_page) document.getElementById('cfgDefaultPage').value = json.data.default_page;
                }
            } catch (e) {}
        }

        async function loadOrders() {
            const tbody = document.getElementById('ordersTableBody');
            tbody.innerHTML = '<tr><td colspan="8" class="px-4 py-8 text-center text-slate-500">جاري تحميل الطلبات...</td></tr>';
            const search = document.getElementById('orderSearchInput')?.value || '';

            try {
                const res = await fetch(`api_handler.php?action=get_orders&limit=50&search=${encodeURIComponent(search)}`);
                const json = await res.json();
                if (!json.success || !json.data || json.data.length === 0) {
                    tbody.innerHTML = '<tr><td colspan="8" class="px-4 py-8 text-center text-slate-500">لا توجد طلبات شوبيفاي مستوردة حتى الآن.</td></tr>';
                    return;
                }

                let html = '';
                json.data.forEach(ord => {
                    const isSuccess = ord.status === 'success';
                    const statusBadge = isSuccess
                        ? '<span class="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold text-[10px] border border-emerald-500/30">ناجح</span>'
                        : '<span class="px-2.5 py-0.5 rounded-full bg-rose-500/20 text-rose-400 font-bold text-[10px] border border-rose-500/30">فشل</span>';

                    html += `
                        <tr class="hover:bg-slate-800/40 transition-colors">
                            <td class="px-4 py-3.5 font-mono font-bold text-emerald-400">#${ord.order_number || '-'}</td>
                            <td class="px-4 py-3.5 font-mono text-slate-400 text-[11px] truncate max-w-[140px]">${ord.shopify_order_id}</td>
                            <td class="px-4 py-3.5 font-semibold text-white">${ord.customer_name || 'عميل'}</td>
                            <td class="px-4 py-3.5 font-mono text-slate-300" dir="ltr">${ord.customer_phone || '-'}</td>
                            <td class="px-4 py-3.5 font-bold text-white">${parseFloat(ord.total_amount).toFixed(2)} ج.م</td>
                            <td class="px-4 py-3.5">${statusBadge}</td>
                            <td class="px-4 py-3.5 text-slate-400 text-[11px]">${ord.created_at}</td>
                            <td class="px-4 py-3.5 text-center flex items-center justify-center gap-1.5">
                                <button onclick="viewOrderDetails(${ord.id})" class="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[10px] font-bold transition-colors">تفاصيل</button>
                                ${!isSuccess ? `<button onclick="retryOrder(${ord.id})" class="px-2 py-1 rounded-lg bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 text-[10px] font-bold">إعادة محاولة</button>` : ''}
                            </td>
                        </tr>
                    `;
                });
                tbody.innerHTML = html;
            } catch (e) {
                tbody.innerHTML = '<tr><td colspan="8" class="px-4 py-8 text-center text-rose-400">فشل في تحميل الطلبات.</td></tr>';
            }
        }

        async function viewOrderDetails(id) {
            try {
                const res = await fetch(`api_handler.php?action=get_order_details&id=${id}`);
                const json = await res.json();
                if (!json.success || !json.data) return;

                const rec = json.data.record;
                const items = json.data.items || [];
                const payload = json.data.raw_payload;

                let itemsHtml = '';
                if (items.length > 0) {
                    itemsHtml = `
                        <div class="rounded-xl border border-slate-800 overflow-hidden bg-slate-950/60 mt-2">
                            <table class="w-full text-right text-xs">
                                <thead class="bg-slate-900 text-slate-400 text-[10px]">
                                    <tr><th class="p-2">الصنف</th><th class="p-2">الباركود</th><th class="p-2">الكمية</th><th class="p-2">السعر</th></tr>
                                </thead>
                                <tbody class="divide-y divide-slate-800">
                                    ${items.map(it => `
                                        <tr>
                                            <td class="p-2 text-white font-semibold">${it.product_name || 'منتج'}</td>
                                            <td class="p-2 font-mono text-slate-400 text-[11px]">${it.barcode || '-'}</td>
                                            <td class="p-2 font-bold text-emerald-400">${it.quantity}</td>
                                            <td class="p-2 text-slate-300">${parseFloat(it.price_per_unit || 0).toFixed(2)} ج.م</td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                    `;
                }

                document.getElementById('detailsModalContent').innerHTML = `
                    <div class="grid grid-cols-2 gap-3 p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800">
                        <div><span class="text-slate-400 block text-[10px]">رقم الطلب في DragonPro:</span> <span class="font-bold text-white font-mono text-sm">#${rec.order_number || '-'}</span></div>
                        <div><span class="text-slate-400 block text-[10px]">معرف Shopify:</span> <span class="font-mono text-slate-300 text-[11px]">${rec.shopify_order_id}</span></div>
                        <div><span class="text-slate-400 block text-[10px]">العميل:</span> <span class="font-bold text-white">${rec.customer_name || '-'}</span></div>
                        <div><span class="text-slate-400 block text-[10px]">الهاتف:</span> <span class="font-mono text-slate-300">${rec.customer_phone || '-'}</span></div>
                        <div><span class="text-slate-400 block text-[10px]">الإجمالي:</span> <span class="font-bold text-emerald-400">${parseFloat(rec.total_amount).toFixed(2)} ج.م</span></div>
                        <div><span class="text-slate-400 block text-[10px]">الحالة:</span> <span class="font-bold ${rec.status === 'success' ? 'text-emerald-400' : 'text-rose-400'}">${rec.status}</span></div>
                    </div>
                    ${rec.error_message ? `<div class="p-3 rounded-xl bg-rose-950/60 border border-rose-500/40 text-rose-300 font-mono text-[11px]">${rec.error_message}</div>` : ''}
                    <div>
                        <span class="text-xs font-bold text-slate-300 block mb-1">الأصناف المسجلة:</span>
                        ${itemsHtml || '<div class="text-slate-500 text-xs">لا توجد أصناف.</div>'}
                    </div>
                    <div>
                        <span class="text-xs font-bold text-slate-300 block mb-1">البيانات الخام (Raw Payload):</span>
                        <pre class="bg-slate-950 p-3 rounded-xl border border-slate-800 text-[10px] font-mono text-slate-400 max-h-48 overflow-y-auto select-all" dir="ltr">${JSON.stringify(payload, null, 2)}</pre>
                    </div>
                `;
                document.getElementById('detailsModal').classList.remove('hidden');
            } catch (e) {}
        }

        function closeDetailsModal() { document.getElementById('detailsModal').classList.add('hidden'); }

        async function testConnection() {
            const btn = document.getElementById('btnQuickTest');
            const spinner = document.getElementById('quickTestSpinner');
            const resultBox = document.getElementById('testResultBox');

            spinner.classList.remove('hidden');
            btn.disabled = true;
            resultBox.classList.add('hidden');

            try {
                const res = await fetch('api_handler.php?action=test_connection');
                const json = await res.json();
                resultBox.classList.remove('hidden');
                if (json.success) {
                    resultBox.className = 'mt-3 p-3 rounded-xl text-xs font-bold border bg-emerald-950/70 text-emerald-300 border-emerald-500/40';
                    resultBox.innerText = '✓ ' + json.message;
                } else {
                    resultBox.className = 'mt-3 p-3 rounded-xl text-xs font-bold border bg-rose-950/70 text-rose-300 border-rose-500/40';
                    resultBox.innerText = '✕ ' + json.message;
                }
            } catch (e) {
                resultBox.classList.remove('hidden');
                resultBox.className = 'mt-3 p-3 rounded-xl text-xs font-bold border bg-rose-950/70 text-rose-300 border-rose-500/40';
                resultBox.innerText = '✕ خطأ في الاتصال: ' + e.message;
            } finally {
                spinner.classList.add('hidden');
                btn.disabled = false;
            }
        }

        function copyWebhookUrl() {
            const input = document.getElementById('webhookInput');
            input.select();
            navigator.clipboard.writeText(input.value).then(() => {
                const btn = document.getElementById('btnCopyWebhook');
                const old = btn.innerHTML;
                btn.innerHTML = '✓ تم النسخ!';
                btn.classList.add('bg-emerald-600');
                setTimeout(() => { btn.innerHTML = old; btn.classList.remove('bg-emerald-600'); }, 2000);
            });
        }

        async function executeSync() {
            const btn = document.getElementById('btnExecSync');
            const spinner = document.getElementById('syncSpinner');
            const box = document.getElementById('syncReportBox');

            const created_at_min = document.getElementById('syncFrom').value;
            const created_at_max = document.getElementById('syncTo').value;
            const status = document.getElementById('syncStatus').value;
            const limit = document.getElementById('syncLimit').value;

            btn.disabled = true;
            spinner.classList.remove('hidden');
            box.classList.remove('hidden');
            box.className = 'p-4 rounded-2xl text-xs bg-slate-900 text-slate-300 border border-slate-700';
            box.innerText = 'جاري الاتصال بمتجر شوبيفاي وسحب الطلبات...';

            try {
                const res = await fetch('api_handler.php?action=sync_orders', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ created_at_min, created_at_max, status, limit: parseInt(limit) || 25 })
                });
                const json = await res.json();
                if (json.success) {
                    box.className = 'p-4 rounded-2xl text-xs bg-emerald-950/60 text-emerald-300 border border-emerald-500/40';
                    box.innerHTML = `<strong>✓ ${json.message}</strong><br>تم جلب ${json.total_fetched} طلب من شوبيفاي، تم استيراد ${json.imported} جديد وتخطي ${json.skipped} مكرر.`;
                    fetchStats();
                    loadOrders();
                } else {
                    box.className = 'p-4 rounded-2xl text-xs bg-rose-950/60 text-rose-300 border border-rose-500/40';
                    box.innerText = '✕ ' + json.message;
                }
            } catch (e) {
                box.className = 'p-4 rounded-2xl text-xs bg-rose-950/60 text-rose-300 border border-rose-500/40';
                box.innerText = '✕ حدث خطأ: ' + e.message;
            } finally {
                btn.disabled = false;
                spinner.classList.add('hidden');
            }
        }

        async function fetchProductMapping() {
            const btn = document.getElementById('btnFetchMapping');
            const spinner = document.getElementById('mappingSpinner');
            const tbody = document.getElementById('mappingTableBody');

            btn.disabled = true;
            spinner.classList.remove('hidden');
            tbody.innerHTML = '<tr><td colspan="5" class="px-4 py-8 text-center text-slate-400">جاري فحص ومطابقة المنتجات مع شوبيفاي...</td></tr>';

            try {
                const res = await fetch('api_handler.php?action=fetch_products_mapping');
                const json = await res.json();
                if (!json.success || !json.data || json.data.length === 0) {
                    tbody.innerHTML = `<tr><td colspan="5" class="px-4 py-8 text-center text-slate-400">${json.message || 'لا توجد منتجات مسجلة في المتجر.'}</td></tr>`;
                    return;
                }

                let html = '';
                json.data.forEach(p => {
                    const isMatched = !!p.is_matched;
                    const badge = isMatched
                        ? '<span class="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold text-[10px] border border-emerald-500/30">✓ مربوط بالـ SKU</span>'
                        : '<span class="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 font-bold text-[10px] border border-amber-500/30">⚠️ غير مربوط</span>';

                    html += `
                        <tr class="hover:bg-slate-800/40 transition-colors">
                            <td class="px-4 py-3 font-semibold text-white">${p.name || '-'}</td>
                            <td class="px-4 py-3 font-mono text-slate-300 text-[11px]">${p.sku || '<span class="text-slate-600">بدون SKU</span>'}</td>
                            <td class="px-4 py-3 font-bold text-white">${parseFloat(p.price || 0).toFixed(2)} ج.م</td>
                            <td class="px-4 py-3">${badge}</td>
                            <td class="px-4 py-3 font-semibold ${isMatched ? 'text-emerald-400' : 'text-slate-500'}">
                                ${isMatched ? `${p.matched_variant_name} (#${p.matched_barcode || p.matched_variant_id})` : 'سيتم إنشاؤه تلقائياً عند أول طلب'}
                            </td>
                        </tr>
                    `;
                });
                tbody.innerHTML = html;
            } catch (e) {
                tbody.innerHTML = `<tr><td colspan="5" class="px-4 py-8 text-center text-rose-400">خطأ: ${e.message}</td></tr>`;
            } finally {
                btn.disabled = false;
                spinner.classList.add('hidden');
            }
        }

        async function runSimulation() {
            const btn = document.getElementById('btnRunSim');
            const spinner = document.getElementById('simSpinner');
            const box = document.getElementById('simResultBox');

            btn.disabled = true;
            spinner.classList.remove('hidden');
            box.classList.remove('hidden');
            box.className = 'p-4 rounded-2xl text-xs bg-slate-900 text-slate-300 border border-slate-700';
            box.innerText = 'جاري إطلاق طلب تجريبي ومحاكاة وصول ويب هوك شوبيفاي...';

            try {
                const res = await fetch('api_handler.php?action=simulate_order', { method: 'POST' });
                const json = await res.json();
                if (json.success) {
                    box.className = 'p-4 rounded-2xl text-xs bg-emerald-950/70 text-emerald-300 border border-emerald-500/40';
                    box.innerHTML = `
                        <strong>✓ نجح اختبار شوبيفاي بنجاح تام! 🟢</strong><br>
                        تم إنشاء طلب تجريبي في السيستم بنجاح برقم داخلي: <span class="font-mono font-bold text-white text-sm">#${json.order_number}</span><br>
                        يمكنك الآن الذهاب لشاشة المبيعات وبوالص الشحن لتراه متواجداً هناك!
                    `;
                    fetchStats();
                    loadOrders();
                } else {
                    box.className = 'p-4 rounded-2xl text-xs bg-rose-950/70 text-rose-300 border border-rose-500/40';
                    box.innerText = '✕ فشل المحاكي: ' + json.message;
                }
            } catch (e) {
                box.className = 'p-4 rounded-2xl text-xs bg-rose-950/70 text-rose-300 border border-rose-500/40';
                box.innerText = '✕ خطأ: ' + e.message;
            } finally {
                btn.disabled = false;
                spinner.classList.add('hidden');
            }
        }

        async function saveDashboardSettings() {
            const btn = document.getElementById('btnSaveCfg');
            const box = document.getElementById('cfgSaveResult');

            const enabled = document.getElementById('cfgEnabled').checked;
            const shop_domain = document.getElementById('cfgShopDomain').value;
            const access_token = document.getElementById('cfgAccessToken')?.value || '';
            const default_status = document.getElementById('cfgDefaultStatus').value;
            const default_page = document.getElementById('cfgDefaultPage').value;

            btn.disabled = true;
            box.classList.remove('hidden');
            box.className = 'p-3 rounded-xl text-xs bg-slate-800 text-slate-300';
            box.innerText = 'جاري حفظ الإعدادات...';

            try {
                const res = await fetch('api_handler.php?action=save_settings', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ enabled, shop_domain, access_token, default_status, default_page })
                });
                const json = await res.json();
                if (json.success) {
                    box.className = 'p-3 rounded-xl text-xs bg-emerald-950/70 text-emerald-300 border border-emerald-500/40';
                    box.innerText = '✓ تم حفظ الإعدادات بنجاح!';
                    fetchStats();
                } else {
                    box.className = 'p-3 rounded-xl text-xs bg-rose-950/70 text-rose-300 border border-rose-500/40';
                    box.innerText = '✕ ' + json.message;
                }
            } catch (e) {
                box.className = 'p-3 rounded-xl text-xs bg-rose-950/70 text-rose-300 border border-rose-500/40';
                box.innerText = '✕ خطأ: ' + e.message;
            } finally {
                btn.disabled = false;
            }
        }

        async function loadLogs() {
            const tbody = document.getElementById('logsTableBody');
            tbody.innerHTML = '<tr><td colspan="4" class="px-4 py-8 text-center text-slate-500">جاري تحميل السجل...</td></tr>';

            try {
                const res = await fetch('api_handler.php?action=get_logs&limit=50');
                const json = await res.json();
                if (!json.success || !json.data || json.data.length === 0) {
                    tbody.innerHTML = '<tr><td colspan="4" class="px-4 py-8 text-center text-slate-500">لا توجد سجلات بعد.</td></tr>';
                    return;
                }

                let html = '';
                json.data.forEach(l => {
                    let badgeClass = 'bg-slate-800 text-slate-400';
                    if (l.status === 'success') badgeClass = 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30';
                    if (l.status === 'error') badgeClass = 'bg-rose-500/20 text-rose-400 border border-rose-500/30';
                    if (l.status === 'warning') badgeClass = 'bg-amber-500/20 text-amber-400 border border-amber-500/30';

                    html += `
                        <tr class="hover:bg-slate-800/40 transition-colors">
                            <td class="px-4 py-3 font-mono text-slate-400 text-[11px]">${l.created_at}</td>
                            <td class="px-4 py-3 font-mono text-emerald-400 font-bold">${l.action}</td>
                            <td class="px-4 py-3"><span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${badgeClass}">${l.status}</span></td>
                            <td class="px-4 py-3 text-slate-300">${l.message || '-'}</td>
                        </tr>
                    `;
                });
                tbody.innerHTML = html;
            } catch (e) {
                tbody.innerHTML = '<tr><td colspan="4" class="px-4 py-8 text-center text-rose-400">فشل تحميل السجل.</td></tr>';
            }
        }

        async function retryOrder(id) {
            if (!confirm('هل تريد إعادة محاولة استيراد هذا الطلب الآن؟')) return;
            try {
                const res = await fetch('api_handler.php?action=retry_order', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id })
                });
                const json = await res.json();
                if (json.success) {
                    alert('تم استيراد الطلب بنجاح برقم #' + json.order_number);
                    loadOrders();
                    fetchStats();
                } else {
                    alert('فشلت إعادة المحاولة: ' + json.message);
                }
            } catch (e) {
                alert('خطأ: ' + e.message);
            }
        }

        fetchStats();
        loadOrders();
    </script>
</body>
</html>
