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

// Helper settings functions
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

function set_setting_value($pdo, $key, $value) {
    try {
        $appCols = detectAppSettingsCols($pdo);
        if ($appCols) {
            list($kcol, $vcol) = $appCols;
            $sql = "INSERT INTO app_settings (`" . $kcol . "`, `" . $vcol . "`) VALUES (?, ?) ON DUPLICATE KEY UPDATE `" . $vcol . "` = VALUES(`" . $vcol . "`)";
            $stmt = $pdo->prepare($sql);
            $stmt->execute([$key, $value]);
        } else {
            $stmt = $pdo->prepare("INSERT INTO settings (config_key, config_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE config_value = VALUES(config_value)");
            $stmt->execute([$key, $value]);
        }
    } catch (Exception $e) {}
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
// Get & Set Verify Token
// -----------------------
$apiVerifyToken = get_setting_value($pdo, 'whatsapp_verify_token', '');
if ($apiVerifyToken === '' || $apiVerifyToken === 'dragon_meta_verify_token') {
    try {
        $apiVerifyToken = 'dragon_meta_' . bin2hex(random_bytes(16));
    } catch (Exception $e) {
        $apiVerifyToken = 'dragon_meta_' . md5(uniqid(mt_rand(), true));
    }
    set_setting_value($pdo, 'whatsapp_verify_token', $apiVerifyToken);
}

// ----------------------------------------
// Handle GET Request (Meta Verification)
// ----------------------------------------
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $mode = $_GET['hub_mode'] ?? $_GET['hub_mode'] ?? $_GET['hub.mode'] ?? '';
    $token = $_GET['hub_verify_token'] ?? $_GET['hub_verify_token'] ?? $_GET['hub.verify_token'] ?? '';
    $challenge = $_GET['hub_challenge'] ?? $_GET['hub_challenge'] ?? $_GET['hub.challenge'] ?? '';
    
    if ($mode === 'subscribe' && $token === $apiVerifyToken) {
        http_response_code(200);
        header('Content-Type: text/plain');
        echo $challenge;
        exit;
    } else {
        http_response_code(403);
        echo 'Verification token mismatch or invalid mode.';
        exit;
    }
}

// ----------------------------------------
// Handle POST Request (Meta Webhook Payload)
// ----------------------------------------
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $rawInput = file_get_contents('php://input');
    $data = json_decode($rawInput, true);

    // Save logs for troubleshooting
    try {
        $logFile = __DIR__ . '/../logs/whatsapp_webhook_debug.log';
        $logDir = dirname($logFile);
        if (!is_dir($logDir)) @mkdir($logDir, 0755, true);
        file_put_contents($logFile, date('[Y-m-d H:i:s] ') . $rawInput . PHP_EOL, FILE_APPEND);
    } catch (Exception $e) {}

    if (isset($data['entry'][0]['changes'][0]['value']['messages'][0])) {
        $messageObj = $data['entry'][0]['changes'][0]['value']['messages'][0];
        $from = $messageObj['from'] ?? ''; // Sender WhatsApp ID/Phone
        $msgId = $messageObj['id'] ?? '';
        $msgType = $messageObj['type'] ?? 'text';

        if ($msgType === 'text') {
            $textBody = $messageObj['text']['body'] ?? '';

            // Check if message is intended for order submission
            if (mb_stripos($textBody, 'طلب جديد') !== false) {
                parse_and_create_whatsapp_order($pdo, $textBody, $from);
            }
        }
    }

    // Always respond 200 OK to Meta to acknowledge receipt
    http_response_code(200);
    echo json_encode(['success' => true]);
    exit;
}

// ----------------------------------------
// Helper: Parse and Create Order
// ----------------------------------------
function parse_and_create_whatsapp_order($pdo, $text, $senderPhone) {
    // Basic regex extractors
    $customerName = '';
    $phone = '';
    $phone2 = '';
    $governorate = '';
    $address = '';
    $productName = '';
    $quantity = 1;
    $price = null;
    $notes = 'تم إرساله من رقم واتساب: ' . $senderPhone;

    // Line by line scanning
    $lines = explode("\n", $text);
    foreach ($lines as $line) {
        $line = trim($line);
        if (preg_match('/(?:الاسم|الاسم الكامل|اسم العميل)\s*[:：-]?\s*(.*)/ui', $line, $m)) {
            $customerName = trim($m[1]);
        } elseif (preg_match('/(?:الهاتف|رقم الهاتف|الموبايل|تليفون|الهاتف1)\s*[:：-]?\s*(.*)/ui', $line, $m)) {
            $phone = preg_replace('/\D/', '', $m[1]);
        } elseif (preg_match('/(?:الهاتف2|تليفون ثاني|رقم ثاني|الهاتف 2)\s*[:：-]?\s*(.*)/ui', $line, $m)) {
            $phone2 = preg_replace('/\D/', '', $m[1]);
        } elseif (preg_match('/(?:المحافظة|المحافظه)\s*[:：-]?\s*(.*)/ui', $line, $m)) {
            $governorate = trim($m[1]);
        } elseif (preg_match('/(?:العنوان|العنوان بالتفصيل|عنوان)\s*[:：-]?\s*(.*)/ui', $line, $m)) {
            $address = trim($m[1]);
        } elseif (preg_match('/(?:المنتج|الصنف|اسم المنتج)\s*[:：-]?\s*(.*)/ui', $line, $m)) {
            $productName = trim($m[1]);
        } elseif (preg_match('/(?:الكمية|الكميه|عدد)\s*[:：-]?\s*(\d+)/ui', $line, $m)) {
            $quantity = intval($m[1]);
        } elseif (preg_match('/(?:السعر|سعر|سعر القطعه)\s*[:：-]?\s*(\d+)/ui', $line, $m)) {
            $price = floatval($m[1]);
        } elseif (preg_match('/(?:الملاحظات|ملاحظات)\s*[:：-]?\s*(.*)/ui', $line, $m)) {
            $notes .= ' - ' . trim($m[1]);
        }
    }

    if ($customerName === '' || $phone === '') {
        return; // Required fields missing, skip processing
    }

    try {
        $pdo->beginTransaction();

        // 1. Customer registration/lookup
        $customerId = null;
        $stmt = $pdo->prepare("SELECT id FROM customers WHERE phone1 = ? OR phone2 = ? LIMIT 1");
        $stmt->execute([$phone, $phone]);
        $row = $stmt->fetch();
        if ($row) {
            $customerId = intval($row['id']);
        } else {
            $stmt = $pdo->prepare("INSERT INTO customers (name, phone1, phone2, governorate, address) VALUES (?, ?, ?, ?, ?)");
            $stmt->execute([$customerName, $phone, $phone2 !== '' ? $phone2 : null, $governorate, $address]);
            $customerId = intval($pdo->lastInsertId());
        }

        // 2. Product Variant Resolution
        $prodId = null;
        if ($productName !== '') {
            $stmt = $pdo->prepare("SELECT id, sale_price FROM product_variants WHERE name = ? LIMIT 1");
            $stmt->execute([$productName]);
            $vRow = $stmt->fetch();
            if ($vRow) {
                $prodId = intval($vRow['id']);
                if ($price === null) $price = floatval($vRow['sale_price']);
            }
        }

        if (!$prodId) {
            if ($productName === '') $productName = 'طلب واتساب غير مسمى';
            $parentId = ensure_product_parent($pdo, $productName);
            $stmt = $pdo->prepare("INSERT INTO product_variants (product_id, name, cost_price, sale_price) VALUES (?, ?, 0, 0)");
            $stmt->execute([$parentId, $productName]);
            $prodId = intval($pdo->lastInsertId());
            if ($price === null) $price = 0;
        }

        if ($price === null) $price = 0;
        $totalAmount = $quantity * $price;

        // 3. Compute unique order number
        $mxRow = $pdo->query("SELECT MAX(CAST(order_number AS UNSIGNED)) as mx FROM orders")->fetch();
        $useOrderNumber = (string)(intval($mxRow['mx'] ?? 0) + 1);

        // 4. Insert order
        $ordersHasEmployee = column_exists($pdo, 'orders', 'employee');
        $ordersHasPage = column_exists($pdo, 'orders', 'page');
        
        $insertCols = ['order_number', 'customer_id', 'status', 'total_amount', 'shipping_fees', 'notes'];
        $insertVals = [$useOrderNumber, $customerId, 'pending', $totalAmount, 0, $notes];
        
        if ($ordersHasEmployee) {
            $insertCols[] = 'employee';
            $insertVals[] = 'مبيعات واتساب تلقائي';
        }
        if ($ordersHasPage) {
            $insertCols[] = 'page';
            $insertVals[] = 'واتساب للأعمال';
        }

        $placeholders = implode(',', array_fill(0, count($insertCols), '?'));
        $sql = "INSERT INTO orders (" . implode(',', $insertCols) . ") VALUES (" . $placeholders . ")";
        $stmt = $pdo->prepare($sql);
        $stmt->execute($insertVals);
        $orderId = intval($pdo->lastInsertId());

        // 5. Insert order items
        $orderItemsHasTotal = column_exists($pdo, 'order_items', 'total_price');
        if ($orderItemsHasTotal) {
            $stmtLine = $pdo->prepare("INSERT INTO order_items (order_id, product_id, quantity, price_per_unit, total_price) VALUES (?, ?, ?, ?, ?)");
            $stmtLine->execute([$orderId, $prodId, $quantity, $price, $totalAmount]);
        } else {
            $stmtLine = $pdo->prepare("INSERT INTO order_items (order_id, product_id, quantity, price_per_unit) VALUES (?, ?, ?, ?)");
            $stmtLine->execute([$orderId, $prodId, $quantity, $price]);
        }

        // 6. Log Order History
        log_order_history($pdo, $orderId, 'pending', 'created', 'تم إنشاؤه تلقائياً من رسالة واتساب للرقم: ' . $senderPhone, null);

        $pdo->commit();

        // Optional: Send auto-reply to customer confirming receipt (if credentials configured)
        $replyText = "تم استلام طلبكم بنجاح وجاري مراجعته.\nرقم الطلب الخاص بكم هو: " . $useOrderNumber;
        send_whatsapp_meta_message($pdo, $senderPhone, $replyText);

    } catch (Exception $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
    }
}

// ----------------------------------------
// Send Message via Meta API Helper
// ----------------------------------------
function send_whatsapp_meta_message($pdo, $phone, $text) {
    $accessToken = get_setting_value($pdo, 'whatsapp_access_token', '');
    $phoneId = get_setting_value($pdo, 'whatsapp_phone_id', '');
    if ($accessToken === '' || $phoneId === '') {
        return false;
    }
    
    $phone = preg_replace('/\D/', '', $phone);
    if (strpos($phone, '2') !== 0 && strlen($phone) === 11) {
        $phone = '2' . $phone;
    }

    $payload = [
        'messaging_product' => 'whatsapp',
        'recipient_type' => 'individual',
        'to' => $phone,
        'type' => 'text',
        'text' => ['body' => $text]
    ];

    $ch = curl_init("https://graph.facebook.com/v17.0/{$phoneId}/messages");
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Authorization: Bearer ' . $accessToken,
        'Content-Type: application/json'
    ]);
    $response = curl_exec($ch);
    curl_close($ch);
    return true;
}
