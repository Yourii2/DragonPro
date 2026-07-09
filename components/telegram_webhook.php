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
// Dynamic Settings Helper
// -----------------------
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
    
    // License check
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

    // Determine webhook URL dynamically
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
        echo json_encode(['ok' => false, 'description' => 'فشل الاتصال بخوادم تليجرام من السيرفر. يرجى التحقق من اتصال السيرفر بالإنترنت.']);
    }
    exit;
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

if (isset($update['message'])) {
    $message = $update['message'];
    $chatId = $message['chat']['id'] ?? '';
    $text = trim($message['text'] ?? '');
    $senderName = $message['from']['first_name'] ?? 'مستخدم تليجرام';

    if ($text !== '') {
        // Welcome and template guide
        if ($text === '/start' || $text === '/help' || mb_stripos($text, 'مساعدة') !== false) {
            send_telegram_reply($botToken, $chatId, 
                "مرحباً بك يا *" . $senderName . "* في نظام إدارة الطلبات DragonPro! 👋\n\n" .
                "أنا البوت الذكي لاستلام الطلبات والاستعلام عنها تلقائياً.\n\n" .
                "📝 *أولاً: لإرسال طلب جديد:* يرجى كتابته بالصيغة التالية تماماً:\n\n" .
                "طلب جديد\n" .
                "الاسم: محمد أحمد\n" .
                "الهاتف: 01002003004\n" .
                "المحافظة: القاهرة\n" .
                "العنوان: مصر الجديدة، شارع الثورة\n" .
                "تفاصيل المنتج:\n" .
                "الكميه 1 الاسم دبدوب اللون كاروهات المقاس 8 السعر 250\n" .
                "الكميه 2 الاسم جاكيت اللون اسود المقاس 10 السعر 350\n" .
                "الشحن: 50\n" .
                "الموظف: أحمد\n" .
                "البيدج: صفحة الفيس بوك\n" .
                "ملاحظات: يرجى الاتصال قبل الوصول\n\n" .
                "-----------------------------------------\n" .
                "🔍 *ثانياً: للاستعلام عن حالة أوردر:* أرسل فقط:\n" .
                "`استعلام [رقم الأوردر]`\n" .
                "أو أرسل رقم الأوردر مباشرة (مثال: `105` أو `WOO_9988`)"
            );
        }
        // Order parsing
        elseif (mb_stripos($text, 'طلب جديد') !== false) {
            parse_and_create_telegram_order($pdo, $botToken, $chatId, $text, $senderName);
        }
        // Order status query matching prefixes: استعلام, حالة, حاله, وضع, status, info
        elseif (preg_match('/^(?:استعلام|حالة|حاله|وضع|status|info)\s+(.+)/ui', $text, $match)) {
            $orderQuery = trim($match[1]);
            query_telegram_order_status($pdo, $botToken, $chatId, $orderQuery);
        }
        // Order status query directly (if it looks like a clean order number, length 3-25 alphanumeric/underscores)
        elseif (preg_match('/^[a-z0-9_-]{3,25}$/i', $text)) {
            query_telegram_order_status($pdo, $botToken, $chatId, $text);
        }
        // Unknown command
        else {
            send_telegram_reply($botToken, $chatId, 
                "⚠️ عذراً، لم أفهم رسالتك.\n\n" .
                "• لإرسال طلب جديد، يجب أن تبدأ الرسالة بكلمة *طلب جديد* وتتبع النموذج المعتمد.\n" .
                "• للاستعلام عن أوردر، أرسل: *استعلام [رقم الأوردر]* أو رقم الأوردر مباشرة.\n\n" .
                "أرسل كلمة *مساعدة* لعرض الصيغة بالتفصيل."
            );
        }
    }
}

// Respond 200 OK to Telegram
http_response_code(200);
echo json_encode(['success' => true]);
exit;

// ----------------------------------------
// Function: Parse and Create Order
// ----------------------------------------
function parse_and_create_telegram_order($pdo, $botToken, $chatId, $text, $senderName) {
    $customerName = '';
    $phone = '';
    $phone2 = '';
    $governorate = '';
    $address = '';
    $shippingFees = 0.0;
    $employee = '';
    $page = '';
    $notes = 'تم إرساله عبر بوت التليجرام بواسطة: ' . $senderName;

    // Line by line scanning
    $lines = explode("\n", $text);
    foreach ($lines as $line) {
        $line = trim($line);
        if (preg_match('/^(?:الاسم|الاسم الكامل|اسم العميل|الإسم)\s*[:：-]?\s*(.*)/ui', $line, $m)) {
            $customerName = trim($m[1]);
        } elseif (preg_match('/^(?:الهاتف|رقم الهاتف|الموبايل|تليفون|الهاتف1|التليفون)\s*[:：-]?\s*(.*)/ui', $line, $m)) {
            $rawPhones = $m[1];
            $phoneParts = preg_split('/[\s,،\/]+/u', $rawPhones);
            $cleanPhones = [];
            foreach ($phoneParts as $part) {
                $clean = preg_replace('/\D/', '', $part);
                if (strlen($clean) >= 7) {
                    $cleanPhones[] = $clean;
                }
            }
            if (isset($cleanPhones[0])) $phone = $cleanPhones[0];
            if (isset($cleanPhones[1])) $phone2 = $cleanPhones[1];
        } elseif (preg_match('/^(?:المحافظة|المحافظه)\s*[:：-]?\s*(.*)/ui', $line, $m)) {
            $governorate = trim($m[1]);
        } elseif (preg_match('/^(?:العنوان|العنوان بالتفصيل|عنوان)\s*[:：-]?\s*(.*)/ui', $line, $m)) {
            $address = trim($m[1]);
        } elseif (preg_match('/^(?:الشحن|شحن|مصاريف الشحن)\s*[:：-]?\s*(\d+)/ui', $line, $m)) {
            $shippingFees = floatval($m[1]);
        } elseif (preg_match('/^(?:الموظف|موظف|مدخل البيانات)\s*[:：-]?\s*(.*)/ui', $line, $m)) {
            $employee = trim($m[1]);
        } elseif (preg_match('/^(?:البيدج|الصفحة|الصفحه)\s*[:：-]?\s*(.*)/ui', $line, $m)) {
            $page = trim($m[1]);
        } elseif (preg_match('/^(?:الملاحظات|ملاحظات)\s*[:：-]?\s*(.*)/ui', $line, $m)) {
            $notes .= ' - ' . trim($m[1]);
        }
    }

    // Look for product lines
    $products = [];
    foreach ($lines as $line) {
        $line = trim($line);
        // Format: الكميه X الاسم Y اللون Z المقاس W السعر P
        if (preg_match('/(?:الكميه|الكمية)\s*(\d+)\s+(?:الاسم|اسم)\s+(.+?)\s+(?:اللون|لون)\s+(.+?)\s+(?:المقاس|مقاس)\s+(.+?)\s+(?:السعر|سعر)\s*(\d+)/ui', $line, $m)) {
            $products[] = [
                'name' => trim($m[2]) . ' - اللون: ' . trim($m[3]) . ' - المقاس: ' . trim($m[4]),
                'quantity' => intval($m[1]),
                'price' => floatval($m[5])
            ];
        }
        // Fallback: الكميه X الاسم Y السعر Z
        elseif (preg_match('/(?:الكميه|الكمية)\s*(\d+)\s+(?:الاسم|اسم)\s+(.+?)\s+(?:السعر|سعر)\s*(\d+)/ui', $line, $m)) {
            $products[] = [
                'name' => trim($m[2]),
                'quantity' => intval($m[1]),
                'price' => floatval($m[3])
            ];
        }
    }

    // Fallback if no multi-products match: check single product format
    if (empty($products)) {
        $singleProdName = '';
        $singleQty = 1;
        $singlePrice = null;
        
        foreach ($lines as $line) {
            $line = trim($line);
            if (preg_match('/(?:المنتج|الصنف|اسم المنتج)\s*[:：-]?\s*(.*)/ui', $line, $m)) {
                $singleProdName = trim($m[1]);
            } elseif (preg_match('/(?:الكمية|الكميه|عدد)\s*[:：-]?\s*(\d+)/ui', $line, $m)) {
                $singleQty = intval($m[1]);
            } elseif (preg_match('/(?:السعر|سعر|سعر القطعه)\s*[:：-]?\s*(\d+)/ui', $line, $m)) {
                $singlePrice = floatval($m[1]);
            }
        }
        
        if ($singleProdName !== '') {
            $products[] = [
                'name' => $singleProdName,
                'quantity' => $singleQty,
                'price' => $singlePrice
            ];
        }
    }

    // Validation
    $errors = [];
    if ($customerName === '') {
        $errors[] = "- اسم العميل (الاسم:)";
    }
    if ($phone === '') {
        $errors[] = "- رقم الهاتف (الهاتف:)";
    }
    if (empty($products)) {
        $errors[] = "- تفاصيل المنتجات (أرسل اسماً وكمية وسعراً للمنتج)";
    }

    if (!empty($errors)) {
        $errorMsg = "❌ خطأ في تسجيل الطلب! البيانات التالية ناقصة أو غير صحيحة:\n\n" . 
                    implode("\n", $errors) . "\n\n" .
                    "يرجى تصحيح الرسالة وإعادة إرسالها بالنموذج الصحيح. أرسل *مساعدة* للمزيد.";
        send_telegram_reply($botToken, $chatId, $errorMsg);
        return;
    }

    try {
        $pdo->beginTransaction();

        // 1. Customer resolution
        $customerId = null;
        $stmt = $pdo->prepare("SELECT id FROM customers WHERE phone1 = ? OR phone2 = ? LIMIT 1");
        $stmt->execute([$phone, $phone]);
        $row = $stmt->fetch();
        if ($row) {
            $customerId = intval($row['id']);
            // Update customer address/governorate if provided to keep records fresh
            $upSql = "UPDATE customers SET name = ?";
            $upVals = [$customerName];
            if ($governorate !== '') {
                $upSql .= ", governorate = ?";
                $upVals[] = $governorate;
            }
            if ($address !== '') {
                $upSql .= ", address = ?";
                $upVals[] = $address;
            }
            if ($phone2 !== '') {
                $upSql .= ", phone2 = ?";
                $upVals[] = $phone2;
            }
            $upSql .= " WHERE id = ?";
            $upVals[] = $customerId;
            $upStmt = $pdo->prepare($upSql);
            $upStmt->execute($upVals);
        } else {
            $stmt = $pdo->prepare("INSERT INTO customers (name, phone1, phone2, governorate, address) VALUES (?, ?, ?, ?, ?)");
            $stmt->execute([$customerName, $phone, $phone2 !== '' ? $phone2 : null, $governorate, $address]);
            $customerId = intval($pdo->lastInsertId());
        }

        // 2. Insert order items and calculate subtotal
        $subtotal = 0;
        $orderItemsToInsert = [];
        
        foreach ($products as $prod) {
            $pName = $prod['name'];
            $pQty = $prod['quantity'];
            $pPrice = $prod['price'];
            
            $prodId = null;
            $stmt = $pdo->prepare("SELECT id, sale_price FROM product_variants WHERE name = ? LIMIT 1");
            $stmt->execute([$pName]);
            $vRow = $stmt->fetch();
            if ($vRow) {
                $prodId = intval($vRow['id']);
                if ($pPrice === null || $pPrice == 0) $pPrice = floatval($vRow['sale_price']);
            }

            if (!$prodId) {
                $parentId = ensure_product_parent($pdo, $pName);
                $stmt = $pdo->prepare("INSERT INTO product_variants (product_id, name, cost_price, sale_price) VALUES (?, ?, 0, ?)");
                $stmt->execute([$parentId, $pName, $pPrice]);
                $prodId = intval($pdo->lastInsertId());
            }

            if ($pPrice === null) $pPrice = 0.0;
            $lineTotal = $pQty * $pPrice;
            $subtotal += $lineTotal;
            
            $orderItemsToInsert[] = [
                'id' => $prodId,
                'name' => $pName,
                'quantity' => $pQty,
                'price' => $pPrice,
                'total' => $lineTotal
            ];
        }

        $totalAmount = $subtotal + $shippingFees;

        // 3. Compute unique order number
        $mxRow = $pdo->query("SELECT MAX(CAST(order_number AS UNSIGNED)) as mx FROM orders")->fetch();
        $useOrderNumber = (string)(intval($mxRow['mx'] ?? 0) + 1);

        // 4. Insert order
        $ordersHasEmployee = column_exists($pdo, 'orders', 'employee');
        $ordersHasPage = column_exists($pdo, 'orders', 'page');
        
        $insertCols = ['order_number', 'customer_id', 'status', 'total_amount', 'shipping_fees', 'notes'];
        $insertVals = [$useOrderNumber, $customerId, 'pending', $totalAmount, $shippingFees, $notes];
        
        if ($ordersHasEmployee) {
            $insertCols[] = 'employee';
            $insertVals[] = ($employee !== '') ? $employee : 'تليجرام تلقائي (' . $senderName . ')';
        }
        if ($ordersHasPage) {
            $insertCols[] = 'page';
            $insertVals[] = ($page !== '') ? $page : 'بوت تليجرام';
        }

        $placeholders = implode(',', array_fill(0, count($insertCols), '?'));
        $sql = "INSERT INTO orders (" . implode(',', $insertCols) . ") VALUES (" . $placeholders . ")";
        $stmt = $pdo->prepare($sql);
        $stmt->execute($insertVals);
        $orderId = intval($pdo->lastInsertId());

        // 5. Insert order items line by line
        $orderItemsHasTotal = column_exists($pdo, 'order_items', 'total_price');
        foreach ($orderItemsToInsert as $item) {
            if ($orderItemsHasTotal) {
                $stmtLine = $pdo->prepare("INSERT INTO order_items (order_id, product_id, quantity, price_per_unit, total_price) VALUES (?, ?, ?, ?, ?)");
                $stmtLine->execute([$orderId, $item['id'], $item['quantity'], $item['price'], $item['total']]);
            } else {
                $stmtLine = $pdo->prepare("INSERT INTO order_items (order_id, product_id, quantity, price_per_unit) VALUES (?, ?, ?, ?)");
                $stmtLine->execute([$orderId, $item['id'], $item['quantity'], $item['price']]);
            }
        }

        // 6. Log Order History
        log_order_history($pdo, $orderId, 'pending', 'created', 'تم إنشاؤه تلقائياً من بوت التليجرام بواسطة: ' . $senderName, null);

        $pdo->commit();

        // 7. Send success confirmation reply
        $replyText = "✅ *تم تسجيل الأوردر بنجاح في DragonPro!*\n\n" .
                     "📦 *رقم الأوردر:* `" . $useOrderNumber . "`\n" .
                     "👤 *العميل:* " . $customerName . "\n" .
                     "📞 *الهاتف:* " . $phone . ($phone2 !== '' ? " , " . $phone2 : "") . "\n" .
                     "📍 *العنوان:* " . ($governorate ? $governorate . " - " : "") . $address . "\n\n" .
                     "🛍️ *ملخص المنتجات:*\n";
                     
        foreach ($orderItemsToInsert as $item) {
            $replyText .= "• " . $item['name'] . " (x" . $item['quantity'] . ") - " . $item['total'] . " ج.م\n";
        }
        
        $replyText .= "\n💵 *إجمالي المنتجات:* " . $subtotal . " ج.م\n" .
                      "🚚 *مصاريف الشحن:* " . $shippingFees . " ج.م\n" .
                      "💰 *الإجمالي المطلوب:* " . $totalAmount . " ج.م\n\n" .
                      "✍️ *الموظف:* " . (($employee !== '') ? $employee : 'تليجرام تلقائي') . "\n" .
                      "🌐 *الصفحة:* " . (($page !== '') ? $page : 'بوت تليجرام');

        send_telegram_reply($botToken, $chatId, $replyText);

    } catch (Exception $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        send_telegram_reply($botToken, $chatId, "❌ حدث خطأ داخلي في الخادم أثناء معالجة وتسجيل الأوردر. يرجى مراجعة المسؤول.");
    }
}

// ----------------------------------------
// Send Message via Telegram API Helper
// ----------------------------------------
function send_telegram_reply($token, $chatId, $text) {
    if ($token === '' || $chatId === '') return false;
    $url = "https://api.telegram.org/bot" . $token . "/sendMessage";
    $payload = [
        'chat_id' => $chatId,
        'text' => $text,
        'parse_mode' => 'Markdown'
    ];

    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query($payload));
    curl_setopt($ch, CURLOPT_TIMEOUT, 10);
    $response = curl_exec($ch);
    curl_close($ch);
    return true;
}

// ----------------------------------------
// Function: Query Order Status from DB
// ----------------------------------------
function query_telegram_order_status($pdo, $botToken, $chatId, $orderQuery) {
    try {
        $orderQuery = trim($orderQuery);
        if ($orderQuery === '') return;

        // 1. First attempt: Search by exact order number or internal ID
        $stmt = $pdo->prepare("
            SELECT o.*, c.name as customer_name, c.phone1, c.phone2, c.governorate, c.address,
                   u.name as rep_name
            FROM orders o
            LEFT JOIN customers c ON o.customer_id = c.id
            LEFT JOIN users u ON o.rep_id = u.id
            WHERE o.order_number = ? OR o.id = ?
            LIMIT 1
        ");
        $stmt->execute([$orderQuery, $orderQuery]);
        $order = $stmt->fetch(PDO::FETCH_ASSOC);

        if ($order) {
            render_single_order_details($pdo, $botToken, $chatId, $order);
            return;
        }

        // 2. Second attempt: Search by customer name or phone number
        $search = '%' . $orderQuery . '%';
        $stmt = $pdo->prepare("
            SELECT o.*, c.name as customer_name, c.phone1, c.phone2, c.governorate, c.address,
                   u.name as rep_name
            FROM orders o
            LEFT JOIN customers c ON o.customer_id = c.id
            LEFT JOIN users u ON o.rep_id = u.id
            WHERE c.name LIKE ? OR c.phone1 = ? OR c.phone2 = ? OR c.phone1 LIKE ? OR c.phone2 LIKE ?
            ORDER BY o.id DESC
            LIMIT 10
        ");
        $stmt->execute([$search, $orderQuery, $orderQuery, $search, $search]);
        $orders = $stmt->fetchAll(PDO::FETCH_ASSOC);

        if (empty($orders)) {
            send_telegram_reply($botToken, $chatId, "🔍 *لم يتم العثور على أي أوردر بالرقم، الاسم أو الهاتف:* `" . $orderQuery . "`\n\nيرجى التأكد من البيانات والمحاولة مرة أخرى.");
            return;
        }

        if (count($orders) === 1) {
            // Only one order match found, render its full details directly
            render_single_order_details($pdo, $botToken, $chatId, $orders[0]);
        } else {
            // Multiple orders match, render a list summary
            $replyText = "🔍 *نتائج البحث عن:* `" . $orderQuery . "`\n" .
                         "👥 تم العثور على *" . count($orders) . "* طلبات:\n\n";

            foreach ($orders as $o) {
                $statusAr = get_arabic_status($o['status']);
                if (strtolower($o['status']) !== 'pending' && !empty($o['rep_name'])) {
                    $statusAr .= " (" . $o['rep_name'] . ")";
                }

                $replyText .= "• أوردر: `" . ($o['order_number'] ?? $o['id']) . "` 👤 *" . $o['customer_name'] . "*\n" .
                              "   👈 الحالة: " . $statusAr . " | 💰 الإجمالي: " . floatval($o['total_amount']) . " ج.م\n" .
                              "   📅 التاريخ: " . $o['created_at'] . "\n\n";
            }

            $replyText .= "💡 *للتفاصيل الكاملة، أرسل رقم الأوردر مباشرة (مثال: `" . ($orders[0]['order_number'] ?? $orders[0]['id']) . "`)*";
            send_telegram_reply($botToken, $chatId, $replyText);
        }

    } catch (Exception $e) {
        send_telegram_reply($botToken, $chatId, "❌ حدث خطأ أثناء الاستعلام عن الأوردر.");
    }
}

// ----------------------------------------
// Function: Helper to Render Single Order Details
// ----------------------------------------
function render_single_order_details($pdo, $botToken, $chatId, $order) {
    // Get items inside this order
    $stmtItems = $pdo->prepare("
        SELECT oi.quantity, oi.price_per_unit, pv.name as product_name
        FROM order_items oi
        LEFT JOIN product_variants pv ON oi.product_id = pv.id
        WHERE oi.order_id = ?
    ");
    $stmtItems->execute([$order['id']]);
    $items = $stmtItems->fetchAll(PDO::FETCH_ASSOC);

    $statusAr = get_arabic_status($order['status']);
    if (strtolower($order['status']) !== 'pending' && !empty($order['rep_name'])) {
        $statusAr .= " (" . $order['rep_name'] . ")";
    }
    $subtotal = 0;

    $replyText = "🔍 *تفاصيل الأوردر رقم:* `" . ($order['order_number'] ?? $order['id']) . "`\n\n" .
                 "👤 *العميل:* " . ($order['customer_name'] ?? 'غير محدد') . "\n" .
                 "📞 *الهاتف:* " . ($order['phone1'] ?? '') . ($order['phone2'] ? " , " . $order['phone2'] : "") . "\n" .
                 "📍 *العنوان:* " . ($order['governorate'] ? $order['governorate'] . " - " : "") . ($order['address'] ?? '') . "\n\n" .
                 "🛍️ *المنتجات:*\n";

    if (!empty($items)) {
        foreach ($items as $item) {
            $lineTotal = floatval($item['quantity']) * floatval($item['price_per_unit']);
            $subtotal += $lineTotal;
            $replyText .= "• " . ($item['product_name'] ?? 'منتج غير معروف') . " (x" . $item['quantity'] . ") - " . $lineTotal . " ج.م\n";
        }
    } else {
        $replyText .= "• لا توجد منتجات مسجلة.\n";
        $subtotal = floatval($order['total_amount']) - floatval($order['shipping_fees']);
    }

    $replyText .= "\n💵 *إجمالي المنتجات:* " . $subtotal . " ج.م\n" .
                  "🚚 *الشحن:* " . floatval($order['shipping_fees']) . " ج.م\n" .
                  "💰 *الإجمالي المطلوب:* " . floatval($order['total_amount']) . " ج.م\n\n" .
                  "-----------------------------------------\n" .
                  "📊 *الحالة الحالية:* *" . $statusAr . "*\n" .
                  "🕒 *تاريخ الإضافة:* " . $order['created_at'] . "\n";

    if ($order['employee']) {
        $replyText .= "✍️ *الموظف:* " . $order['employee'] . "\n";
    }
    if ($order['page']) {
        $replyText .= "🌐 *الصفحة:* " . $order['page'] . "\n";
    }
    if ($order['rep_name']) {
        $replyText .= "🚴 *المندوب:* " . $order['rep_name'] . "\n";
    }
    if ($order['notes']) {
        $replyText .= "\n📝 *الملاحظات:* " . $order['notes'] . "\n";
    }

    send_telegram_reply($botToken, $chatId, $replyText);
}

// ----------------------------------------
// Helper: Map status to Arabic label
// ----------------------------------------
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
        case 'no_answer': return 'لا يرد 📞';
        case 'in_delivery': return 'مع شركة الشحن 🚚';
        default: return $status;
    }
}
