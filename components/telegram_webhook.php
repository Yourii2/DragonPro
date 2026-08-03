<?php
session_start();

// Set timezone to Egypt (UTC+2 — Africa/Cairo)
date_default_timezone_set('Africa/Cairo');

// Force JSON/Text response depending on method
error_reporting(E_ALL);
ini_set('display_errors', '0');

// -----------------------
// Bootstrap DB Connection
// -----------------------
$cfg = __DIR__ . '/../config.php';
if (!file_exists($cfg)) {
    http_response_code(500);
    echo 'Configuration file config.php not found.';
    exit;
}
require_once $cfg;
require_once __DIR__ . '/telegram_ai_service.php';

try {
    if (!defined('DB_HOST') || !defined('DB_NAME') || !defined('DB_USER')) {
        throw new Exception('Missing DB configuration.');
    }
    $pdo = new PDO(
        "mysql:host=" . DB_HOST . ";dbname=" . DB_NAME . ";charset=utf8mb4",
        DB_USER,
        defined('DB_PASS') ? DB_PASS : '',
        [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        ]
    );
    $pdo->exec("SET time_zone = '+02:00'");
} catch (Exception $e) {
    http_response_code(500);
    echo 'Database connection failed.';
    exit;
}

// -----------------------
// Auto Migration Helpers
// -----------------------
if (!function_exists('column_exists')) {
    function column_exists($pdo, $table, $column) {
        try {
            $db = $pdo->query('SELECT DATABASE()')->fetchColumn();
            if (!$db) return false;
            $stmt = $pdo->prepare('SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ? LIMIT 1');
            $stmt->execute([$db, $table, $column]);
            return intval($stmt->fetchColumn()) > 0;
        } catch (Exception $e) {
            return false;
        }
    }
}

// Ensure Telegram Auth Columns Exist in Users Table
try {
    if ($pdo->query("SHOW TABLES LIKE 'users'")->fetch()) {
        if (!column_exists($pdo, 'users', 'telegram_chat_id')) {
            $pdo->exec("ALTER TABLE users ADD COLUMN telegram_chat_id VARCHAR(64) NULL INDEX");
        }
        if (!column_exists($pdo, 'users', 'telegram_phone')) {
            $pdo->exec("ALTER TABLE users ADD COLUMN telegram_phone VARCHAR(32) NULL");
        }
        if (!column_exists($pdo, 'users', 'telegram_otp')) {
            $pdo->exec("ALTER TABLE users ADD COLUMN telegram_otp VARCHAR(16) NULL");
        }
        if (!column_exists($pdo, 'users', 'telegram_otp_expires')) {
            $pdo->exec("ALTER TABLE users ADD COLUMN telegram_otp_expires DATETIME NULL");
        }
    }
} catch (Exception $e) {}

// Dynamic Settings Helper
function detectAppSettingsCols($pdo) {
    try {
        $check = $pdo->query("SHOW TABLES LIKE 'app_settings'")->fetch();
        if (!$check) return null;
        $cols = $pdo->query("SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'app_settings'")->fetchAll(PDO::FETCH_COLUMN);
        if (in_array('name', $cols) && in_array('value', $cols)) return ['name','value'];
        if (in_array('k', $cols) && in_array('v', $cols)) return ['k','v'];
        if (in_array('key', $cols) && in_array('value', $cols)) return ['key','value'];
        if (count($cols) >= 2) return [$cols[0], $cols[1]];
        return null;
    } catch (Exception $e) {
        return null;
    }
}

if (!function_exists('get_setting_value')) {
    function get_setting_value($pdo, $key, $default = '') {
        try {
            $appCols = detectAppSettingsCols($pdo);
            if ($appCols) {
                list($kcol, $vcol) = $appCols;
                $stmt = $pdo->prepare("SELECT `" . $vcol . "` FROM app_settings WHERE `" . $kcol . "` = ? LIMIT 1");
                $stmt->execute([$key]);
                $val = $stmt->fetchColumn();
                if ($val !== false) return $val;
            } else {
                $stmt = $pdo->prepare("SELECT config_value FROM settings WHERE config_key = ? LIMIT 1");
                $stmt->execute([$key]);
                $val = $stmt->fetchColumn();
                if ($val !== false) return $val;
            }
        } catch (Exception $e) {}
        return $default;
    }
}

if (!function_exists('ensure_product_parent')) {
    function ensure_product_parent(PDO $pdo, string $name, ?string $category = null): int {
        $name = trim($name);
        if ($name === '') $name = 'منتج غير مسمى';
        $existing = $pdo->prepare("SELECT id FROM products WHERE name = ? LIMIT 1");
        $existing->execute([$name]);
        $row = $existing->fetchColumn();
        if ($row) return intval($row);
        $ins = $pdo->prepare("INSERT INTO products (name, category) VALUES (?, ?)");
        $ins->execute([$name, $category]);
        return intval($pdo->lastInsertId());
    }
}

if (!function_exists('log_order_history')) {
    function log_order_history($pdo, $order_id, $status, $action, $notes = null, $rep_id = null) {
        try {
            $stmt = $pdo->prepare("INSERT INTO order_status_history (order_id, status, action, notes, rep_id, created_by) VALUES (?, ?, ?, ?, ?, ?)");
            $stmt->execute([$order_id, $status, $action, $notes, $rep_id, null]);
        } catch (Exception $e) {}
    }
}

// -----------------------
// Get Bot Token
// -----------------------
$botToken = get_setting_value($pdo, 'telegram_bot_token', '');

// ----------------------------------------
// Handle GET Request (Webhook setup proxy)
// ----------------------------------------
if ($_SERVER['REQUEST_METHOD'] === 'GET' && isset($_GET['action']) && $_GET['action'] === 'setup') {
    header('Content-Type: application/json');
    
    require_once __DIR__ . '/activation_utils.php';
    $license_check = check_license_validity();
    if ($license_check['status'] !== 'ok') {
        http_response_code(403);
        echo json_encode(['ok' => false, 'description' => 'عذراً، النسخة غير مفعلة أو منتهية الصلاحية.']);
        exit;
    }

    $token = $_GET['token'] ?? $botToken;
    $token = trim($token);
    if ($token === '') {
        echo json_encode(['ok' => false, 'description' => 'يرجى إدخال توكن البوت (Bot Token) أولاً.']);
        exit;
    }

    $proto = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
    if (isset($_SERVER['HTTP_X_FORWARDED_PROTO']) && $_SERVER['HTTP_X_FORWARDED_PROTO'] === 'https') {
        $proto = 'https';
    }
    
    $host = $_SERVER['HTTP_X_FORWARDED_HOST'] ?? $_SERVER['HTTP_HOST'] ?? '';
    if (isset($_SERVER['HTTP_X_FORWARDED_HOST'])) {
        $webhookUrl = $proto . '://' . $host . '/components/telegram_webhook.php';
    } else {
        $script = $_SERVER['SCRIPT_NAME'];
        $webhookUrl = $proto . '://' . $host . $script;
    }

    $url = "https://api.telegram.org/bot" . $token . "/setWebhook?url=" . urlencode($webhookUrl);

    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 12);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
    $response = curl_exec($ch);
    curl_close($ch);

    if ($response) {
        echo $response;
    } else {
        echo json_encode(['ok' => false, 'description' => 'فشل الاتصال بخوادم تليجرام من السيرفر.']);
    }
    exit;
}

// ----------------------------------------
// Identity & Scope Resolution Helper
// ----------------------------------------
function get_telegram_user_identity($pdo, $chatId, $senderPhone = '') {
    if ($chatId === '') return ['is_authenticated' => false, 'role' => 'guest', 'id' => 0, 'name' => 'زائر'];

    // Search by telegram_chat_id
    $stmt = $pdo->prepare("SELECT id, name, username, role, phone FROM users WHERE telegram_chat_id = ? LIMIT 1");
    $stmt->execute([$chatId]);
    $u = $stmt->fetch();

    if ($u) {
        return [
            'is_authenticated' => true,
            'id' => intval($u['id']),
            'name' => $u['name'],
            'username' => $u['username'],
            'role' => strtolower($u['role'] ?? 'representative'),
            'phone' => $u['phone']
        ];
    }

    // Attempt matching by phone if provided via Telegram contact sharing
    if ($senderPhone !== '') {
        $clean = preg_replace('/\D/', '', $senderPhone);
        if (strlen($clean) >= 7) {
            $stmtP = $pdo->prepare("SELECT id, name, username, role, phone FROM users WHERE (phone = ? OR phone LIKE ?) LIMIT 1");
            $stmtP->execute([$clean, '%' . $clean]);
            $uP = $stmtP->fetch();
            if ($uP) {
                // Auto-bind telegram_chat_id to user record!
                $pdo->prepare("UPDATE users SET telegram_chat_id = ?, telegram_phone = ? WHERE id = ?")->execute([$chatId, $clean, $uP['id']]);
                return [
                    'is_authenticated' => true,
                    'id' => intval($uP['id']),
                    'name' => $uP['name'],
                    'username' => $uP['username'],
                    'role' => strtolower($uP['role'] ?? 'representative'),
                    'phone' => $uP['phone']
                ];
            }
        }
    }

    return ['is_authenticated' => false, 'role' => 'guest', 'id' => 0, 'name' => 'زائر'];
}

// ----------------------------------------
// Send Message with Keyboards Helper
// ----------------------------------------
function send_telegram_reply($token, $chatId, $text, $keyboard = null) {
    if ($token === '' || $chatId === '') return false;
    $url = "https://api.telegram.org/bot" . $token . "/sendMessage";
    $payload = [
        'chat_id' => $chatId,
        'text' => $text,
        'parse_mode' => 'Markdown'
    ];

    if ($keyboard !== null) {
        $payload['reply_markup'] = json_encode($keyboard);
    }

    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query($payload));
    curl_setopt($ch, CURLOPT_TIMEOUT, 10);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
    $response = curl_exec($ch);
    curl_close($ch);
    return true;
}

// Get Role-Based Reply Keyboards
function get_role_reply_keyboard($identity) {
    if (!$identity['is_authenticated']) {
        return [
            'keyboard' => [
                [['text' => '📱 مشاركة رقم الهاتف لربط الحساب تلقائياً', 'request_contact' => true]],
                [['text' => '🔐 أدخل كود التفعيل'], ['text' => '❓ مساعدة']]
            ],
            'resize_keyboard' => true,
            'one_time_keyboard' => false
        ];
    }

    $role = $identity['role'];
    if ($role === 'admin' || $role === 'manager') {
        return [
            'keyboard' => [
                [['text' => '📊 تقرير اليوم'], ['text' => '💵 إجمالي الخزائن']],
                [['text' => '🚴 متابعة المناديب'], ['text' => '📦 طلب جديد']],
                [['text' => '🔍 استعلام عن طلب'], ['text' => '❓ مساعدة']]
            ],
            'resize_keyboard' => true
        ];
    }

    if ($role === 'representative') {
        return [
            'keyboard' => [
                [['text' => '📦 أوردراتي اليوم'], ['text' => '💰 كشف عهدتي']],
                [['text' => '🔍 استعلام عن طلب'], ['text' => '❓ مساعدة']]
            ],
            'resize_keyboard' => true
        ];
    }

    return [
        'keyboard' => [
            [['text' => '📦 طلب جديد'], ['text' => '🔍 استعلام عن طلب']],
            [['text' => '❓ مساعدة']]
        ],
        'resize_keyboard' => true
    ];
}

// -----------------------
// Handle Telegram Request
// -----------------------
$rawInput = file_get_contents('php://input');
$update = json_decode($rawInput, true);

// Save logs for troubleshooting
try {
    $logFile = __DIR__ . '/../logs/telegram_webhook_debug.log';
    $logDir = dirname($logFile);
    if (!is_dir($logDir)) @mkdir($logDir, 0755, true);
    file_put_contents($logFile, date('[Y-m-d H:i:s] ') . $rawInput . PHP_EOL, FILE_APPEND);
} catch (Exception $e) {}

// ----------------------------------------
// Handle Callback Queries (Inline Buttons)
// ----------------------------------------
if (isset($update['callback_query'])) {
    $cb = $update['callback_query'];
    $cbId = $cb['id'];
    $chatId = $cb['message']['chat']['id'] ?? '';
    $data = $cb['data'] ?? '';
    $senderName = $cb['from']['first_name'] ?? 'مستخدم';

    $identity = get_telegram_user_identity($pdo, $chatId);

    // Format: rep_status:<order_id>:<new_status>
    if (strpos($data, 'rep_status:') === 0) {
        $parts = explode(':', $data);
        $orderId = intval($parts[1] ?? 0);
        $newStatus = $parts[2] ?? '';

        if ($orderId > 0 && $newStatus !== '') {
            // Scope Check: Ensure Rep owns this order (or is Admin)
            $checkStmt = $pdo->prepare("SELECT id, rep_id, order_number, total_amount FROM orders WHERE id = ? LIMIT 1");
            $checkStmt->execute([$orderId]);
            $ordRow = $checkStmt->fetch();

            if ($ordRow) {
                $isOwner = ($identity['role'] === 'admin' || $identity['role'] === 'manager' || intval($ordRow['rep_id']) === $identity['id']);
                if (!$isOwner) {
                    send_telegram_reply($botToken, $chatId, "⛔ *تنبيه أمان:* لا يمكنك تعديل حالة هذا الأوردر، فهو مسند لمندوب آخر للحفاظ على خصوصية البيانات.");
                } else {
                    $pdo->prepare("UPDATE orders SET status = ? WHERE id = ?")->execute([$newStatus, $orderId]);
                    log_order_history($pdo, $orderId, $newStatus, 'status_updated_via_telegram', 'تم تعديل الحالة من تليجرام بواسطة: ' . $senderName, $identity['id']);

                    $statusLabel = get_arabic_status($newStatus);
                    send_telegram_reply($botToken, $chatId, "✅ *تم تحديث حالة الأوردر رقم (" . ($ordRow['order_number'] ?? $orderId) . ") إلى:* " . $statusLabel);
                }
            }
        }
    } elseif (strpos($data, 'view_order:') === 0) {
        $orderId = intval(str_replace('view_order:', '', $data));
        query_telegram_order_status($pdo, $botToken, $chatId, (string)$orderId, $identity);
    }

    // Answer Callback Query
    $ch = curl_init("https://api.telegram.org/bot" . $botToken . "/answerCallbackQuery?callback_query_id=" . $cbId);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_exec($ch);
    curl_close($ch);

    http_response_code(200);
    echo json_encode(['success' => true]);
    exit;
}

// ----------------------------------------
// Handle Normal Messages
// ----------------------------------------
if (isset($update['message'])) {
    $message = $update['message'];
    $chatId = $message['chat']['id'] ?? '';
    $text = trim($message['text'] ?? '');
    $senderName = $message['from']['first_name'] ?? 'مستخدم تليجرام';
    $senderPhone = $message['contact']['phone_number'] ?? '';

    $identity = get_telegram_user_identity($pdo, $chatId, $senderPhone);
    $replyKb = get_role_reply_keyboard($identity);

    // 1. Phone Contact Sharing for Auto Authentication
    if (!empty($senderPhone)) {
        if ($identity['is_authenticated']) {
            send_telegram_reply($botToken, $chatId, "✅ *تم توثيق وربط حسابك بنجاح!*\n\n👤 *الاسم:* " . $identity['name'] . "\n🔰 *الدور:* " . get_role_arabic($identity['role']), $replyKb);
        } else {
            send_telegram_reply($botToken, $chatId, "❌ لم نتمكن من العثور على رقم الهاتف (" . $senderPhone . ") في قائمة مستخدمي النظام. يرجى التواصل مع الأدمن لربط رقمك بالنظام.", $replyKb);
        }
        exit;
    }

    // 2. OTP Linking command: /link CODE or OTP code
    if (preg_match('/^(?:\/link|\/otp|كود|تفعيل)\s+([a-z0-9]{4,10})/ui', $text, $m) || preg_match('/^[a-z0-9]{5,8}$/i', $text)) {
        $otp = trim($m[1] ?? $text);
        $stmtOtp = $pdo->prepare("SELECT id, name, role FROM users WHERE telegram_otp = ? AND (telegram_otp_expires IS NULL OR telegram_otp_expires > NOW()) LIMIT 1");
        $stmtOtp->execute([$otp]);
        $uOtp = $stmtOtp->fetch();

        if ($uOtp) {
            $pdo->prepare("UPDATE users SET telegram_chat_id = ?, telegram_otp = NULL, telegram_otp_expires = NULL WHERE id = ?")->execute([$chatId, $uOtp['id']]);
            $identity = get_telegram_user_identity($pdo, $chatId);
            $newKb = get_role_reply_keyboard($identity);
            send_telegram_reply($botToken, $chatId, "🎉 *مبروك! تم تفعيل وربط حسابك بنجاح في DragonPro!*\n\n👤 *المستخدم:* " . $uOtp['name'] . "\n🔰 *الصلاحية:* " . get_role_arabic($uOtp['role']) . "\n\nيمكنك الآن استغلال كافة الميزات المتاحة لصلاحياتك.", $newKb);
            exit;
        }
    }

    // 3. Process Voice Messages via AI Engine
    if (isset($message['voice'])) {
        $fileId = $message['voice']['file_id'] ?? '';
        if ($fileId !== '') {
            send_telegram_reply($botToken, $chatId, "🎙️ *جاري الاستماع للرسالة الصوتية وتحليل الأوردر بالذكاء الاصطناعي...* ⏳");
            $aiResult = process_voice_note_with_ai($pdo, $botToken, $fileId);
            if ($aiResult && !empty($aiResult['customer_name'])) {
                execute_create_order_from_parsed_data($pdo, $botToken, $chatId, $aiResult, $senderName, $identity);
            } else {
                send_telegram_reply($botToken, $chatId, "⚠️ تعذر استخراج بيانات الأوردر من التسجيل الصوتي بدقة. يرجى إعادة التحدث بوضوح أو كتابة الطلب نصياً.", $replyKb);
            }
            exit;
        }
    }

    if ($text !== '') {
        // Start / Help / Options
        if ($text === '/start' || $text === '/help' || mb_stripos($text, 'مساعدة') !== false || $text === '❓ مساعدة') {
            $authMsg = $identity['is_authenticated']
                ? "🔒 *حسابك مفعل كـ:* " . $identity['name'] . " (" . get_role_arabic($identity['role']) . ")"
                : "⚠️ *حسابك غير مفعل بعد:* يمكنك مشاركة رقم هاتفك أو استخدام كود التفعيل لربط حسابك وتمكين الصلاحيات المعزولة.";

            send_telegram_reply($botToken, $chatId, 
                "مرحباً بك يا *" . $senderName . "* في بوت DragonPro الذكي! 👋\n\n" .
                $authMsg . "\n\n" .
                "🤖 *أنا مساعدك الذكي لاستلام الطلبات والاستعلام بنظام الصلاحيات المعزولة.*\n\n" .
                "📝 *لإرسال طلب جديد:* يمكنك كتابته بأي طريقة عامية أو استخدام النموذج القياسي، أو حتى *إرسال رسالة صوتية (Voice Note)* وسيقوم البوت بفهمها فوراً!\n\n" .
                "🔍 *للاستعلام عن أوردر:* أرسل رقم الأوردر أو اسم العميل.",
                $replyKb
            );
        }
        // Rep Orders Today
        elseif ($text === '📦 أوردراتي اليوم' || $text === '/myorders') {
            if (!$identity['is_authenticated'] || ($identity['role'] !== 'representative' && $identity['role'] !== 'admin')) {
                send_telegram_reply($botToken, $chatId, "⛔ هذه الميزة مخصصة للمناديب المفعلين فقط. يرجى توثيق حسابك أولاً.", $replyKb);
            } else {
                fetch_representative_today_orders($pdo, $botToken, $chatId, $identity);
            }
        }
        // Rep Cash Custody
        elseif ($text === '💰 كشف عهدتي' || $text === '💰 عهدتي ورصيدي' || $text === '/mycustody') {
            if (!$identity['is_authenticated'] || ($identity['role'] !== 'representative' && $identity['role'] !== 'admin')) {
                send_telegram_reply($botToken, $chatId, "⛔ هذه الميزة مخصصة للمناديب المفعلين فقط.", $replyKb);
            } else {
                fetch_representative_custody($pdo, $botToken, $chatId, $identity);
            }
        }
        // Admin Daily Report
        elseif ($text === '📊 تقرير اليوم' || $text === '/report') {
            if (!$identity['is_authenticated'] || ($identity['role'] !== 'admin' && $identity['role'] !== 'manager')) {
                send_telegram_reply($botToken, $chatId, "⛔ تقارير المبيعات مخصصة لمدراء النظام فقط.", $replyKb);
            } else {
                fetch_admin_daily_report($pdo, $botToken, $chatId);
            }
        }
        // Admin Treasuries Summary
        elseif ($text === '💵 إجمالي الخزائن') {
            if (!$identity['is_authenticated'] || ($identity['role'] !== 'admin' && $identity['role'] !== 'manager')) {
                send_telegram_reply($botToken, $chatId, "⛔ هذه الميزة مخصصة للإدارة فقط.", $replyKb);
            } else {
                fetch_admin_treasuries_summary($pdo, $botToken, $chatId);
            }
        }
        // Order Creation (via AI / Structured text)
        elseif (mb_stripos($text, 'طلب جديد') !== false || mb_stripos($text, 'اوردر جديد') !== false || preg_match('/(الاسم|الهاتف|العنوان).*المنتج/ui', $text)) {
            $parsedData = parse_order_with_ai($pdo, $text);
            if ($parsedData && !empty($parsedData['customer_name']) && !empty($parsedData['phone'])) {
                execute_create_order_from_parsed_data($pdo, $botToken, $chatId, $parsedData, $senderName, $identity);
            } else {
                send_telegram_reply($botToken, $chatId, "⚠️ تعذر استخراج بيانات العميل والمنتج بشكل كامل. يرجى التأكد من كتابة الاسم ورقم الهاتف وتفاصيل المنتج.", $replyKb);
            }
        }
        // Order Query (Strict Scope Protected)
        elseif (preg_match('/^(?:استعلام|حالة|حاله|وضع|status|info)\s+(.+)/ui', $text, $match)) {
            query_telegram_order_status($pdo, $botToken, $chatId, trim($match[1]), $identity);
        }
        elseif (preg_match('/^[a-z0-9_-]{3,25}$/i', $text) && $text !== 'help' && $text !== 'start') {
            query_telegram_order_status($pdo, $botToken, $chatId, $text, $identity);
        }
        else {
            send_telegram_reply($botToken, $chatId, 
                "⚠️ لم أفهم رسالتك بوضوح.\n\n" .
                "• يمكنك اختيار أحد الأوامر من الأزرار بالأسفل 👇\n" .
                "• أو إرسال طلب جديد نصياً أو تسجيل صوتي (Voice Note).\n" .
                "• أو إرسال رقم الأوردر مباشرة للاستعلام عن حالته.",
                $replyKb
            );
        }
    }
}

http_response_code(200);
echo json_encode(['success' => true]);
exit;

// ----------------------------------------
// Order Creation Executor Helper
// ----------------------------------------
function execute_create_order_from_parsed_data($pdo, $botToken, $chatId, $data, $senderName, $identity) {
    $customerName = trim($data['customer_name'] ?? '');
    $phone = trim($data['phone'] ?? '');
    $phone2 = trim($data['phone2'] ?? '');
    $governorate = trim($data['governorate'] ?? '');
    $address = trim($data['address'] ?? '');
    $shippingFees = floatval($data['shipping_fees'] ?? 0.0);
    $employee = trim($data['employee'] ?? '');
    $page = trim($data['page'] ?? '');
    $notes = 'تم الإنشاء عبر بوت التليجرام بواسطة: ' . $senderName;
    if (!empty($data['notes'])) $notes .= ' - ' . trim($data['notes']);
    $items = $data['items'] ?? [];

    if ($customerName === '' || $phone === '' || empty($items)) {
        send_telegram_reply($botToken, $chatId, "❌ بيانات الطلب ناقصة. يرجى توفير اسم العميل ورقم الهاتف والمنتج على الأقل.");
        return;
    }

    try {
        $pdo->beginTransaction();

        // 1. Customer Resolution
        $customerId = null;
        $stmt = $pdo->prepare("SELECT id FROM customers WHERE phone1 = ? OR phone2 = ? LIMIT 1");
        $stmt->execute([$phone, $phone]);
        $cRow = $stmt->fetch();

        if ($cRow) {
            $customerId = intval($cRow['id']);
            $upSql = "UPDATE customers SET name = ?";
            $upVals = [$customerName];
            if ($governorate !== '') { $upSql .= ", governorate = ?"; $upVals[] = $governorate; }
            if ($address !== '') { $upSql .= ", address = ?"; $upVals[] = $address; }
            if ($phone2 !== '') { $upSql .= ", phone2 = ?"; $upVals[] = $phone2; }
            if (column_exists($pdo, 'customers', 'telegram_chat_id') && !empty($chatId)) {
                $upSql .= ", telegram_chat_id = ?";
                $upVals[] = $chatId;
            }
            $upSql .= " WHERE id = ?";
            $upVals[] = $customerId;
            $pdo->prepare($upSql)->execute($upVals);
        } else {
            $hasTg = column_exists($pdo, 'customers', 'telegram_chat_id');
            if ($hasTg) {
                $stmt = $pdo->prepare("INSERT INTO customers (name, phone1, phone2, governorate, address, telegram_chat_id) VALUES (?, ?, ?, ?, ?, ?)");
                $stmt->execute([$customerName, $phone, $phone2 !== '' ? $phone2 : null, $governorate, $address, $chatId]);
            } else {
                $stmt = $pdo->prepare("INSERT INTO customers (name, phone1, phone2, governorate, address) VALUES (?, ?, ?, ?, ?)");
                $stmt->execute([$customerName, $phone, $phone2 !== '' ? $phone2 : null, $governorate, $address]);
            }
            $customerId = intval($pdo->lastInsertId());
        }

        // 2. Products Resolution
        $subtotal = 0;
        $orderItemsToInsert = [];
        foreach ($items as $prod) {
            $pName = trim($prod['name'] ?? 'منتج');
            $pQty = max(1, intval($prod['quantity'] ?? 1));
            $pPrice = floatval($prod['price'] ?? 0.0);

            $prodId = null;
            $stmt = $pdo->prepare("SELECT id, sale_price FROM product_variants WHERE name = ? LIMIT 1");
            $stmt->execute([$pName]);
            $vRow = $stmt->fetch();
            if ($vRow) {
                $prodId = intval($vRow['id']);
                if ($pPrice == 0) $pPrice = floatval($vRow['sale_price']);
            } else {
                $parentId = ensure_product_parent($pdo, $pName);
                $stmtIns = $pdo->prepare("INSERT INTO product_variants (product_id, name, cost_price, sale_price) VALUES (?, ?, 0, ?)");
                $stmtIns->execute([$parentId, $pName, $pPrice]);
                $prodId = intval($pdo->lastInsertId());
            }

            $lineTotal = $pQty * $pPrice;
            $subtotal += $lineTotal;
            $orderItemsToInsert[] = ['id' => $prodId, 'name' => $pName, 'quantity' => $pQty, 'price' => $pPrice, 'total' => $lineTotal];
        }

        $totalAmount = $subtotal + $shippingFees;

        // 3. Compute unique order number
        $mxRow = $pdo->query("SELECT MAX(CAST(order_number AS UNSIGNED)) as mx FROM orders")->fetch();
        $useOrderNumber = (string)(intval($mxRow['mx'] ?? 0) + 1);

        // 4. Insert Order
        $ordersHasEmployee = column_exists($pdo, 'orders', 'employee');
        $ordersHasPage = column_exists($pdo, 'orders', 'page');
        $ordersHasRepId = column_exists($pdo, 'orders', 'rep_id');

        $insertCols = ['order_number', 'customer_id', 'status', 'total_amount', 'shipping_fees', 'notes'];
        $insertVals = [$useOrderNumber, $customerId, 'pending', $totalAmount, $shippingFees, $notes];

        if ($ordersHasEmployee) {
            $insertCols[] = 'employee';
            $insertVals[] = ($employee !== '') ? $employee : ($identity['name'] ?? 'تليجرام تلقائي');
        }
        if ($ordersHasPage) {
            $insertCols[] = 'page';
            $insertVals[] = ($page !== '') ? $page : 'بوت تليجرام';
        }
        if ($ordersHasRepId && $identity['role'] === 'representative') {
            $insertCols[] = 'rep_id';
            $insertVals[] = $identity['id'];
        }

        $placeholders = implode(',', array_fill(0, count($insertCols), '?'));
        $stmt = $pdo->prepare("INSERT INTO orders (" . implode(',', $insertCols) . ") VALUES (" . $placeholders . ")");
        $stmt->execute($insertVals);
        $orderId = intval($pdo->lastInsertId());

        // 5. Insert Items
        $orderItemsHasTotal = column_exists($pdo, 'order_items', 'total_price');
        foreach ($orderItemsToInsert as $item) {
            if ($orderItemsHasTotal) {
                $pdo->prepare("INSERT INTO order_items (order_id, product_id, quantity, price_per_unit, total_price) VALUES (?, ?, ?, ?, ?)")
                    ->execute([$orderId, $item['id'], $item['quantity'], $item['price'], $item['total']]);
            } else {
                $pdo->prepare("INSERT INTO order_items (order_id, product_id, quantity, price_per_unit) VALUES (?, ?, ?, ?)")
                    ->execute([$orderId, $item['id'], $item['quantity'], $item['price']]);
            }
        }

        log_order_history($pdo, $orderId, 'pending', 'created_via_telegram', 'تم إدخاله عبر تليجرام بواسطة: ' . $senderName, $identity['id'] ?? null);
        $pdo->commit();

        // 6. Confirmation Reply
        $replyText = "✅ *تم تسجيل الأوردر بنجاح في DragonPro!*\n\n" .
                     "📦 *رقم الأوردر:* `" . $useOrderNumber . "`\n" .
                     "👤 *العميل:* " . $customerName . "\n" .
                     "📞 *الهاتف:* " . $phone . ($phone2 !== '' ? " , " . $phone2 : "") . "\n" .
                     "📍 *العنوان:* " . ($governorate ? $governorate . " - " : "") . $address . "\n\n" .
                     "🛍️ *المنتجات:*\n";

        foreach ($orderItemsToInsert as $item) {
            $replyText .= "• " . $item['name'] . " (x" . $item['quantity'] . ") - " . $item['total'] . " ج.م\n";
        }

        $replyText .= "\n💵 *الإجمالي:* " . $totalAmount . " ج.م (شحن: " . $shippingFees . " ج.م)";

        send_telegram_reply($botToken, $chatId, $replyText);

    } catch (Exception $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        send_telegram_reply($botToken, $chatId, "❌ حدث خطأ أثناء حفظ الأوردر في قاعدة البيانات.");
    }
}

// ----------------------------------------
// Order Query with Strict Representative Scope Protection
// ----------------------------------------
function query_telegram_order_status($pdo, $botToken, $chatId, $orderQuery, $identity) {
    try {
        $orderQuery = trim($orderQuery);
        if ($orderQuery === '') return;

        // Role & Scope Control
        $role = $identity['role'];
        $userId = $identity['id'];

        // Base Query with Scope Constraints
        $sqlWhere = "(o.order_number = :q OR o.id = :q2)";
        $params = ['q' => $orderQuery, 'q2' => $orderQuery];

        // 🛑 Representative Data Isolation: Reps CANNOT query other reps' orders!
        if ($role === 'representative') {
            $sqlWhere .= " AND (o.rep_id = :rep_id OR o.rep_id IS NULL)";
            $params['rep_id'] = $userId;
        }

        $stmt = $pdo->prepare("
            SELECT o.*, c.name as customer_name, c.phone1, c.phone2, c.governorate, c.address,
                   u.name as rep_name
            FROM orders o
            LEFT JOIN customers c ON o.customer_id = c.id
            LEFT JOIN users u ON o.rep_id = u.id
            WHERE $sqlWhere
            LIMIT 1
        ");
        $stmt->execute($params);
        $order = $stmt->fetch(PDO::FETCH_ASSOC);

        if ($order) {
            render_single_order_details($pdo, $botToken, $chatId, $order, $identity);
            return;
        }

        // If not found, check if order exists under another rep to notify about permission block
        if ($role === 'representative') {
            $checkOther = $pdo->prepare("SELECT id, rep_id FROM orders WHERE (order_number = ? OR id = ?) AND rep_id <> ? LIMIT 1");
            $checkOther->execute([$orderQuery, $orderQuery, $userId]);
            if ($checkOther->fetch()) {
                send_telegram_reply($botToken, $chatId, "⛔ *تنبيه أمان وخصوصية:*\n\nعذراً، الأوردر رقم `" . $orderQuery . "` مسند لمندوب آخر، ولا تملك صلاحية للاطلاع على بياناته أو حسابه.");
                return;
            }
        }

        // Search by Customer Name or Phone
        $searchSql = "(c.name LIKE :s OR c.phone1 = :q OR c.phone2 = :q)";
        $searchParams = ['s' => '%' . $orderQuery . '%', 'q' => $orderQuery];

        if ($role === 'representative') {
            $searchSql .= " AND o.rep_id = :rep_id";
            $searchParams['rep_id'] = $userId;
        }

        $stmtSearch = $pdo->prepare("
            SELECT o.*, c.name as customer_name, c.phone1, c.phone2, c.governorate, c.address,
                   u.name as rep_name
            FROM orders o
            LEFT JOIN customers c ON o.customer_id = c.id
            LEFT JOIN users u ON o.rep_id = u.id
            WHERE $searchSql
            ORDER BY o.id DESC
            LIMIT 5
        ");
        $stmtSearch->execute($searchParams);
        $orders = $stmtSearch->fetchAll(PDO::FETCH_ASSOC);

        if (empty($orders)) {
            send_telegram_reply($botToken, $chatId, "🔍 *لم يتم العثور على أوردرات تطابق البحث:* `" . $orderQuery . "`");
            return;
        }

        if (count($orders) === 1) {
            render_single_order_details($pdo, $botToken, $chatId, $orders[0], $identity);
        } else {
            $replyText = "🔍 *نتائج البحث عن:* `" . $orderQuery . "`\n\n";
            foreach ($orders as $o) {
                $replyText .= "• أوردر: `" . ($o['order_number'] ?? $o['id']) . "` 👤 *" . $o['customer_name'] . "*\n" .
                              "   الحالة: " . get_arabic_status($o['status']) . " | 💰 " . floatval($o['total_amount']) . " ج.م\n\n";
            }
            send_telegram_reply($botToken, $chatId, $replyText);
        }

    } catch (Exception $e) {
        send_telegram_reply($botToken, $chatId, "❌ حدث خطأ أثناء الاستعلام عن الأوردر.");
    }
}

// ----------------------------------------
// Render Single Order Details with Interactive Inline Buttons
// ----------------------------------------
function render_single_order_details($pdo, $botToken, $chatId, $order, $identity) {
    $stmtItems = $pdo->prepare("
        SELECT oi.quantity, oi.price_per_unit, pv.name as product_name
        FROM order_items oi
        LEFT JOIN product_variants pv ON oi.product_id = pv.id
        WHERE oi.order_id = ?
    ");
    $stmtItems->execute([$order['id']]);
    $items = $stmtItems->fetchAll(PDO::FETCH_ASSOC);

    $statusAr = get_arabic_status($order['status']);
    if (!empty($order['rep_name'])) {
        $statusAr .= " (المندوب: " . $order['rep_name'] . ")";
    }

    $subtotal = 0;
    $replyText = "🔍 *تفاصيل الأوردر رقم:* `" . ($order['order_number'] ?? $order['id']) . "`\n\n" .
                 "👤 *العميل:* " . ($order['customer_name'] ?? 'غير محدد') . "\n" .
                 "📞 *الهاتف:* `" . ($order['phone1'] ?? '') . "`" . ($order['phone2'] ? " , `" . $order['phone2'] . "`" : "") . "\n" .
                 "📍 *العنوان:* " . ($order['governorate'] ? $order['governorate'] . " - " : "") . ($order['address'] ?? '') . "\n\n" .
                 "🛍️ *المنتجات:*\n";

    if (!empty($items)) {
        foreach ($items as $item) {
            $lineTotal = floatval($item['quantity']) * floatval($item['price_per_unit']);
            $subtotal += $lineTotal;
            $replyText .= "• " . ($item['product_name'] ?? 'منتج غير معروف') . " (x" . $item['quantity'] . ") - " . $lineTotal . " ج.م\n";
        }
    }

    $replyText .= "\n💵 *الإجمالي النهائي المطلوب:* *" . floatval($order['total_amount']) . " ج.م*\n" .
                  "📊 *الحالة:* *" . $statusAr . "*\n" .
                  "🕒 *التاريخ:* " . $order['created_at'] . "\n";

    if (!empty($order['notes'])) {
        $replyText .= "📝 *ملاحظات:* " . $order['notes'] . "\n";
    }

    // Attach Interactive Inline Buttons if user is authorized Rep or Admin
    $inlineKeyboard = null;
    $isRepOrAdmin = ($identity['role'] === 'admin' || $identity['role'] === 'manager' || intval($order['rep_id']) === $identity['id']);
    if ($isRepOrAdmin) {
        $inlineKeyboard = [
            'inline_keyboard' => [
                [
                    ['text' => '✅ تم التسليم', 'callback_data' => 'rep_status:' . $order['id'] . ':delivered'],
                    ['text' => '⚠️ مرتجع جزئي', 'callback_data' => 'rep_status:' . $order['id'] . ':partial']
                ],
                [
                    ['text' => '❌ مرتجع كامل', 'callback_data' => 'rep_status:' . $order['id'] . ':returned'],
                    ['text' => '📅 تأجيل التسليم', 'callback_data' => 'rep_status:' . $order['id'] . ':postponed']
                ]
            ]
        ];
    }

    send_telegram_reply($botToken, $chatId, $replyText, $inlineKeyboard);
}

// ----------------------------------------
// Representative Functions
// ----------------------------------------
function fetch_representative_today_orders($pdo, $botToken, $chatId, $identity) {
    $repId = $identity['id'];
    $stmt = $pdo->prepare("
        SELECT o.id, o.order_number, o.status, o.total_amount, c.name as customer_name, c.phone1, c.governorate, c.address
        FROM orders o
        LEFT JOIN customers c ON o.customer_id = c.id
        WHERE o.rep_id = ? AND (DATE(o.created_at) = CURRENT_DATE() OR o.status IN ('pending', 'with_rep'))
        ORDER BY o.id DESC
    ");
    $stmt->execute([$repId]);
    $orders = $stmt->fetchAll(PDO::FETCH_ASSOC);

    if (empty($orders)) {
        send_telegram_reply($botToken, $chatId, "📦 *لا توجد أوردرات معلقة أو مسندة إليك اليوم.*");
        return;
    }

    $replyText = "📦 *قائمة أوردراتك اليومية (" . count($orders) . " أوردرات):*\n\n";
    $inlineBtns = [];
    foreach ($orders as $o) {
        $replyText .= "• أوردر `" . ($o['order_number'] ?? $o['id']) . "` | 👤 *" . $o['customer_name'] . "*\n" .
                      "   👈 الحالة: " . get_arabic_status($o['status']) . " | 💰 " . floatval($o['total_amount']) . " ج.م\n" .
                      "   📍 " . ($o['governorate'] ? $o['governorate'] . " - " : "") . $o['address'] . "\n\n";
        
        $inlineBtns[] = [['text' => '🔍 عرض الأوردر ' . ($o['order_number'] ?? $o['id']), 'callback_data' => 'view_order:' . $o['id']]];
    }

    send_telegram_reply($botToken, $chatId, $replyText, ['inline_keyboard' => $inlineBtns]);
}

function fetch_representative_custody($pdo, $botToken, $chatId, $identity) {
    $repId = $identity['id'];
    $stmt = $pdo->prepare("
        SELECT 
            COUNT(o.id) as total_orders,
            COALESCE(SUM(CASE WHEN o.status = 'delivered' THEN o.total_amount ELSE 0 END), 0) as collected_amount,
            COALESCE(SUM(CASE WHEN o.status IN ('pending', 'with_rep') THEN o.total_amount ELSE 0 END), 0) as pending_amount
        FROM orders o
        WHERE o.rep_id = ? AND DATE(o.created_at) = CURRENT_DATE()
    ");
    $stmt->execute([$repId]);
    $res = $stmt->fetch();

    $replyText = "💰 *كشف عهدتك وتحصيلاتك اليومية:* \n\n" .
                 "👤 *المندوب:* " . $identity['name'] . "\n" .
                 "📦 *إجمالي أوردرات اليوم:* " . intval($res['total_orders']) . "\n" .
                 "✅ *المبالغ المحصلة (تم التسليم):* *" . floatval($res['collected_amount']) . " ج.م*\n" .
                 "⏳ *المبالغ قيد التسليم:* " . floatval($res['pending_amount']) . " ج.م\n\n" .
                 "🔒 *ملاحظة:* هذه البيانات خاصة بحسابك فقط ومحمية بالنظام.";

    send_telegram_reply($botToken, $chatId, $replyText);
}

// ----------------------------------------
// Admin Management Functions
// ----------------------------------------
function fetch_admin_daily_report($pdo, $botToken, $chatId) {
    $stmt = $pdo->query("
        SELECT 
            COUNT(id) as total_orders,
            COALESCE(SUM(total_amount), 0) as total_sales,
            COALESCE(SUM(CASE WHEN status = 'delivered' THEN total_amount ELSE 0 END), 0) as delivered_sales,
            COALESCE(SUM(CASE WHEN status = 'returned' THEN 1 ELSE 0 END), 0) as returned_count
        FROM orders 
        WHERE DATE(created_at) = CURRENT_DATE()
    ");
    $r = $stmt->fetch();

    $replyText = "📊 *تقرير المبيعات اليومي الشامل (DragonPro):*\n\n" .
                 "📅 *التاريخ:* " . date('Y-m-d') . "\n" .
                 "📦 *إجمالي عدد الأوردرات:* " . intval($r['total_orders']) . "\n" .
                 "💰 *إجمالي حجم المبيعات:* *" . floatval($r['total_sales']) . " ج.م*\n" .
                 "✅ *المبيعات المحصلة:* " . floatval($r['delivered_sales']) . " ج.م\n" .
                 "❌ *عدد الأوردرات المرتجعة:* " . intval($r['returned_count']) . "\n";

    send_telegram_reply($botToken, $chatId, $replyText);
}

function fetch_admin_treasuries_summary($pdo, $botToken, $chatId) {
    $stmt = $pdo->query("SELECT id, name, COALESCE(current_balance, 0) as balance FROM treasuries");
    $treasuries = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $replyText = "💵 *ملخص أردصة الخزائن الحالية:*\n\n";
    $totalBalance = 0;
    foreach ($treasuries as $t) {
        $bal = floatval($t['balance']);
        $totalBalance += $bal;
        $replyText .= "• *" . $t['name'] . ":* " . number_format($bal, 2) . " ج.م\n";
    }
    $replyText .= "\n💎 *إجمالي أرصدة الخزائن:* *" . number_format($totalBalance, 2) . " ج.م*";

    send_telegram_reply($botToken, $chatId, $replyText);
}

function get_role_arabic($role) {
    switch (strtolower($role)) {
        case 'admin': return 'أدمن / مدير النظام 👑';
        case 'manager': return 'مدير مبيعات 🏢';
        case 'representative': return 'مندوب شحن 🚴';
        case 'accountant': return 'محاسب 💼';
        default: return 'عميل 👤';
    }
}

function get_arabic_status($status) {
    switch (strtolower($status)) {
        case 'pending': return 'قيد الانتظار ⏳';
        case 'with_rep': return 'مع المندوب 🚴';
        case 'delivered': return 'تم التسليم بنجاح ✅';
        case 'returned': return 'مرتجع بالكامل ❌';
        case 'partial': return 'مرتجع جزئي ⚠️';
        case 'postponed': return 'مؤجل 📅';
        case 'cancelled': return 'ملغي 🚫';
        case 'confirmed': return 'تم التأكيد 👍';
        case 'closed': return 'مغلق 🔒';
        default: return $status;
    }
}
