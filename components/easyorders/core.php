<?php
/**
 * DragonPro - EasyOrders Integration Core Library
 * Handles DB connection, order parsing, API communication, and logging.
 */

if (!defined('EASYORDERS_INIT')) {
    define('EASYORDERS_INIT', true);
}

// -----------------------
// Timezone & Error Config
// -----------------------
date_default_timezone_set('Africa/Cairo');
error_reporting(E_ALL);
ini_set('display_errors', '0');

// -----------------------
// DB Bootstrap
// -----------------------
function easyorders_get_pdo() {
    static $pdo = null;
    if ($pdo !== null) return $pdo;

    $cfgPath = file_exists(__DIR__ . '/../config.php') 
        ? __DIR__ . '/../config.php' 
        : (file_exists(__DIR__ . '/../../config.php') ? __DIR__ . '/../../config.php' : __DIR__ . '/../config.php');
    if (!file_exists($cfgPath)) {
        throw new Exception("Configuration file config.php not found at {$cfgPath}.");
    }
    require_once $cfgPath;

    if (!defined('DB_HOST') || !defined('DB_NAME') || !defined('DB_USER')) {
        throw new Exception("Missing DB constants in config.php.");
    }

    $pass = defined('DB_PASS') ? DB_PASS : '';
    $pdo = new PDO(
        "mysql:host=" . DB_HOST . ";dbname=" . DB_NAME . ";charset=utf8mb4",
        DB_USER,
        $pass,
        [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        ]
    );
    $pdo->exec("SET time_zone = '" . date('P') . "'");

    easyorders_ensure_tables($pdo);
    return $pdo;
}

// -----------------------
// Ensure Helper Tables Exist
// -----------------------
function easyorders_ensure_tables($pdo) {
    try {
        // Table for tracking imported EasyOrders to avoid duplicates
        $pdo->exec("CREATE TABLE IF NOT EXISTS `easyorders_orders` (
            `id` INT(11) NOT NULL AUTO_INCREMENT,
            `easyorders_id` VARCHAR(120) NOT NULL,
            `order_id` INT(11) DEFAULT NULL,
            `order_number` VARCHAR(50) DEFAULT NULL,
            `customer_name` VARCHAR(255) DEFAULT NULL,
            `customer_phone` VARCHAR(50) DEFAULT NULL,
            `total_amount` DECIMAL(15,2) DEFAULT '0.00',
            `status` VARCHAR(50) DEFAULT 'success',
            `error_message` TEXT NULL,
            `raw_payload` LONGTEXT NULL,
            `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (`id`),
            UNIQUE KEY `uk_eo_id` (`easyorders_id`),
            KEY `idx_eo_order_id` (`order_id`),
            KEY `idx_eo_created_at` (`created_at`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;");

        // Table for activity logs
        $pdo->exec("CREATE TABLE IF NOT EXISTS `easyorders_logs` (
            `id` INT(11) NOT NULL AUTO_INCREMENT,
            `action` VARCHAR(100) NOT NULL,
            `status` VARCHAR(50) NOT NULL,
            `message` TEXT NULL,
            `details` LONGTEXT NULL,
            `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (`id`),
            KEY `idx_eo_logs_created` (`created_at`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;");
    } catch (Exception $e) {
        // Log silently
        error_log("Failed to ensure easyorders tables: " . $e->getMessage());
    }
}

// -----------------------
// Settings Helpers
// -----------------------
function easyorders_get_setting($pdo, $key, $default = '') {
    try {
        // Check app_settings first
        $check = $pdo->query("SHOW TABLES LIKE 'app_settings'")->fetch();
        if ($check) {
            $cols = $pdo->query("SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'app_settings'")->fetchAll(PDO::FETCH_COLUMN);
            $kcol = in_array('name', $cols) ? 'name' : (in_array('key', $cols) ? 'key' : (in_array('k', $cols) ? 'k' : 'name'));
            $vcol = in_array('value', $cols) ? 'value' : (in_array('v', $cols) ? 'v' : 'value');
            $stmt = $pdo->prepare("SELECT `{$vcol}` FROM app_settings WHERE `{$kcol}` = ? LIMIT 1");
            $stmt->execute([$key]);
            $val = $stmt->fetchColumn();
            if ($val !== false && $val !== null) return $val;
        }

        // Fallback to legacy settings table
        $checkSettings = $pdo->query("SHOW TABLES LIKE 'settings'")->fetch();
        if ($checkSettings) {
            $stmt = $pdo->prepare("SELECT config_value FROM settings WHERE config_key = ? LIMIT 1");
            $stmt->execute([$key]);
            $val = $stmt->fetchColumn();
            if ($val !== false && $val !== null) return $val;
        }
    } catch (Exception $e) {}
    return $default;
}

function easyorders_set_setting($pdo, $key, $value) {
    try {
        $check = $pdo->query("SHOW TABLES LIKE 'app_settings'")->fetch();
        if ($check) {
            $cols = $pdo->query("SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'app_settings'")->fetchAll(PDO::FETCH_COLUMN);
            $kcol = in_array('name', $cols) ? 'name' : (in_array('key', $cols) ? 'key' : (in_array('k', $cols) ? 'k' : 'name'));
            $vcol = in_array('value', $cols) ? 'value' : (in_array('v', $cols) ? 'v' : 'value');
            $stmt = $pdo->prepare("INSERT INTO app_settings (`{$kcol}`, `{$vcol}`) VALUES (?, ?) ON DUPLICATE KEY UPDATE `{$vcol}` = VALUES(`{$vcol}`)");
            $stmt->execute([$key, (string)$value]);
        }
        $checkSettings = $pdo->query("SHOW TABLES LIKE 'settings'")->fetch();
        if ($checkSettings) {
            $stmt = $pdo->prepare("INSERT INTO settings (config_key, config_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE config_value = VALUES(config_value)");
            $stmt->execute([$key, (string)$value]);
        }
    } catch (Exception $e) {}
}

// -----------------------
// DB Schema Inspection Helpers
// -----------------------
function easyorders_column_exists($pdo, $table, $column) {
    try {
        $stmt = $pdo->prepare("SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?");
        $stmt->execute([$table, $column]);
        return intval($stmt->fetchColumn()) > 0;
    } catch (Exception $e) {
        return false;
    }
}

function easyorders_table_exists($pdo, $table) {
    try {
        $stmt = $pdo->prepare("SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?");
        $stmt->execute([$table]);
        return intval($stmt->fetchColumn()) > 0;
    } catch (Exception $e) {
        return false;
    }
}

function easyorders_log_history($pdo, $order_id, $status, $action, $notes = null) {
    if (!easyorders_table_exists($pdo, 'order_status_history')) return;
    try {
        $stmt = $pdo->prepare("INSERT INTO order_status_history (order_id, status, action, notes, rep_id, created_by) VALUES (?, ?, ?, ?, NULL, NULL)");
        $stmt->execute([$order_id, $status, $action, $notes]);
    } catch (Exception $e) {}
}

function easyorders_log_event($pdo, $action, $status, $message, $details = null) {
    try {
        $detailsStr = is_string($details) ? $details : (is_array($details) || is_object($details) ? json_encode($details, JSON_UNESCAPED_UNICODE) : null);
        $stmt = $pdo->prepare("INSERT INTO easyorders_logs (action, status, message, details) VALUES (?, ?, ?, ?)");
        $stmt->execute([$action, $status, $message, $detailsStr]);
    } catch (Exception $e) {}
}

// -----------------------
// Ensure Parent Product & Variant
// -----------------------
function easyorders_ensure_product_parent($pdo, $name, $category = 'عام') {
    $name = trim($name);
    if ($name === '') $name = 'منتج إيزي أوردرز';
    $stmt = $pdo->prepare("SELECT id FROM products WHERE name = ? LIMIT 1");
    $stmt->execute([$name]);
    $id = $stmt->fetchColumn();
    if ($id) return intval($id);

    $stmt = $pdo->prepare("INSERT INTO products (name, category) VALUES (?, ?)");
    $stmt->execute([$name, $category]);
    return intval($pdo->lastInsertId());
}

// -----------------------
// Test API Connection
// -----------------------
function easyorders_test_connection($apiKey) {
    $apiKey = trim($apiKey);
    if (empty($apiKey)) {
        return ['success' => false, 'message' => 'يرجى إدخال مفتاح الـ API أولاً.'];
    }

    $ch = curl_init('https://api.easy-orders.net/api/v1/external-apps/products?limit=1');
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER => [
            'Api-Key: ' . $apiKey,
            'Content-Type: application/json',
            'Accept: application/json'
        ],
        CURLOPT_TIMEOUT => 12,
        CURLOPT_SSL_VERIFYPEER => false,
        CURLOPT_SSL_VERIFYHOST => false,
    ]);

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlError = curl_error($ch);
    curl_close($ch);

    if ($curlError) {
        return ['success' => false, 'message' => 'فشل الاتصال بسيرفر إيزي أوردرز: ' . $curlError];
    }

    if ($httpCode === 200) {
        return ['success' => true, 'message' => 'تم الاتصال بسيرفر EasyOrders بنجاح ومفتاح الـ API صالح!'];
    } elseif ($httpCode === 401 || $httpCode === 403) {
        return ['success' => false, 'message' => 'مفتاح الـ API غير صالح أو غير مصرح له بالوصول (كود ' . $httpCode . ').'];
    } else {
        return ['success' => false, 'message' => 'استجاب السيرفر بكود ' . $httpCode . ': ' . mb_substr($response, 0, 150)];
    }
}

// -----------------------
// Fetch Single Order via API
// -----------------------
function easyorders_fetch_order_api($orderId, $apiKey) {
    $orderId = trim($orderId);
    $apiKey = trim($apiKey);
    if (!$orderId || !$apiKey) return null;

    $url = 'https://api.easy-orders.net/api/v1/external-apps/orders/' . urlencode($orderId);
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER => [
            'Api-Key: ' . $apiKey,
            'Content-Type: application/json',
            'Accept: application/json'
        ],
        CURLOPT_TIMEOUT => 15,
        CURLOPT_SSL_VERIFYPEER => false,
        CURLOPT_SSL_VERIFYHOST => false,
    ]);
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($httpCode === 200 && $response) {
        $data = json_decode($response, true);
        if (is_array($data)) {
            return isset($data['data']) && is_array($data['data']) ? $data['data'] : $data;
        }
    }
    return null;
}

// -----------------------
// Fetch Products List from EasyOrders API
// -----------------------
function easyorders_fetch_products_api($apiKey) {
    $apiKey = trim($apiKey);
    if (!$apiKey) return ['success' => false, 'message' => 'يرجى إدخال مفتاح الـ API.'];

    $ch = curl_init('https://api.easy-orders.net/api/v1/external-apps/products?limit=50');
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER => [
            'Api-Key: ' . $apiKey,
            'Content-Type: application/json',
            'Accept: application/json'
        ],
        CURLOPT_TIMEOUT => 20,
        CURLOPT_SSL_VERIFYPEER => false,
        CURLOPT_SSL_VERIFYHOST => false,
    ]);
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlErr = curl_error($ch);
    curl_close($ch);

    if ($curlErr) return ['success' => false, 'message' => 'خطأ في الاتصال بسيرفر إيزي أوردرز: ' . $curlErr];
    if ($httpCode !== 200) return ['success' => false, 'message' => 'استجاب السيرفر برمز خطأ (' . $httpCode . ')'];

    $data = json_decode($response, true);
    $items = [];
    if (isset($data['products']) && is_array($data['products'])) $items = $data['products'];
    elseif (isset($data['data']) && is_array($data['data'])) $items = $data['data'];
    elseif (is_array($data)) $items = $data;

    return ['success' => true, 'data' => $items];
}

// -----------------------
// Simulate Test Order
// -----------------------
function easyorders_simulate_test_order($pdo) {
    $vRow = null;
    try {
        $vRow = $pdo->query("SELECT id, name, barcode, sale_price FROM product_variants WHERE is_archived = 0 AND barcode IS NOT NULL AND barcode != '' LIMIT 1")->fetch();
    } catch (Exception $e) {}

    $prodName = ($vRow && !empty($vRow['name'])) ? $vRow['name'] : 'منتج تجريبي (تيشيرت أوفر سايز)';
    $barcode = ($vRow && !empty($vRow['barcode'])) ? $vRow['barcode'] : 'TEST-SKU-101';
    $price = ($vRow && floatval($vRow['sale_price']) > 0) ? floatval($vRow['sale_price']) : 250.0;

    $mockPayload = [
        'id' => 'test_sim_' . date('Ymd_His') . '_' . rand(100, 999),
        'cost' => $price,
        'shipping_cost' => 50,
        'total_cost' => $price + 50,
        'status' => 'pending',
        'full_name' => 'عميل تجريبي إيزي أوردرز',
        'phone' => '010' . rand(10000000, 99999999),
        'government' => 'القاهرة',
        'address' => 'مدينة نصر - شارع عباس العقاد التجريبي',
        'payment_method' => 'cod',
        'notes' => 'هذا أوردر تجريبي تم إنشاؤه عبر محاكي فحص ربط إيزي أوردرز',
        'cart_items' => [
            [
                'price' => $price,
                'quantity' => 1,
                'product' => [
                    'name' => $prodName,
                    'price' => $price,
                    'sku' => $barcode
                ]
            ]
        ]
    ];

    return easyorders_process_order($pdo, $mockPayload, 'simulator');
}

// -----------------------
// Main Order Processing Logic
// -----------------------
function easyorders_process_order($pdo, array $payload, $source = 'webhook') {
    // 1. Identify EasyOrders ID
    $eoId = trim(strval($payload['id'] ?? $payload['order_id'] ?? $payload['orderNumber'] ?? ''));
    if ($eoId === '') {
        $eoId = 'eo_' . date('YmdHis') . '_' . substr(bin2hex(random_bytes(4)), 0, 6);
    }

    // Check if order was already imported
    $stmt = $pdo->prepare("SELECT id, order_id, order_number FROM easyorders_orders WHERE easyorders_id = ? LIMIT 1");
    $stmt->execute([$eoId]);
    $existing = $stmt->fetch();
    if ($existing && !empty($existing['order_id'])) {
        return [
            'success' => true,
            'already_exists' => true,
            'message' => 'تم استيراد هذا الطلب مسبقاً برقم #' . $existing['order_number'],
            'order_id' => intval($existing['order_id']),
            'order_number' => $existing['order_number']
        ];
    }

    // If payload only contains an ID without cart items, fetch full order via API if api_key is available
    if (empty($payload['cart_items']) && empty($payload['items']) && empty($payload['products'])) {
        $apiKey = easyorders_get_setting($pdo, 'easyorders_api_key', '');
        if (!empty($apiKey)) {
            $fetched = easyorders_fetch_order_api($eoId, $apiKey);
            if ($fetched && is_array($fetched)) {
                $payload = array_merge($payload, $fetched);
            }
        }
    }

    // 2. Parse Customer Data
    $customerName = trim(strval(
        $payload['full_name'] ?? $payload['name'] ?? $payload['customer_name'] ?? $payload['customer']['name'] ?? 'عميل إيزي أوردرز'
    ));
    $phone = trim(strval(
        $payload['phone'] ?? $payload['phone_number'] ?? $payload['customer']['phone'] ?? ''
    ));
    $phone2 = trim(strval(
        $payload['phone2'] ?? $payload['alt_phone'] ?? $payload['customer']['phone2'] ?? ''
    ));
    $governorate = trim(strval(
        $payload['government'] ?? $payload['governorate'] ?? $payload['city'] ?? $payload['customer']['governorate'] ?? ''
    ));
    $address = trim(strval(
        $payload['address'] ?? $payload['customer']['address'] ?? ''
    ));
    $notes = trim(strval(
        $payload['notes'] ?? $payload['note'] ?? $payload['comment'] ?? ''
    ));

    // Normalize phone (strip spaces/dashes)
    $cleanPhone = preg_replace('/[^\d\+]/', '', $phone);
    if ($cleanPhone === '') {
        $cleanPhone = '00000000000';
    }

    // 3. Parse Financials
    $subtotal = floatval($payload['cost'] ?? $payload['subtotal'] ?? 0);
    $shippingFees = floatval($payload['shipping_cost'] ?? $payload['shipping_fees'] ?? $payload['shipping'] ?? 0);
    $totalAmount = floatval($payload['total_cost'] ?? $payload['total_amount'] ?? $payload['total'] ?? 0);

    // 4. Parse Cart Items
    $rawItems = $payload['cart_items'] ?? $payload['items'] ?? $payload['products'] ?? [];
    if (!is_array($rawItems)) $rawItems = [];

    // Begin Database Transaction
    $pdo->beginTransaction();

    try {
        // 5. Match or Create Customer
        $customerId = null;
        if ($cleanPhone !== '00000000000') {
            $stmt = $pdo->prepare("SELECT id FROM customers WHERE phone1 = ? OR phone2 = ? LIMIT 1");
            $stmt->execute([$cleanPhone, $cleanPhone]);
            $cRow = $stmt->fetch();
            if ($cRow) {
                $customerId = intval($cRow['id']);
                // Update address/gov if customer had empty fields
                $stmtUp = $pdo->prepare("UPDATE customers SET address = COALESCE(NULLIF(address, ''), ?), governorate = COALESCE(NULLIF(governorate, ''), ?) WHERE id = ?");
                $stmtUp->execute([$address, $governorate, $customerId]);
            }
        }

        if (!$customerId) {
            $stmt = $pdo->prepare("INSERT INTO customers (name, phone1, phone2, governorate, address) VALUES (?, ?, ?, ?, ?)");
            $stmt->execute([
                $customerName ?: 'عميل إيزي أوردرز',
                $cleanPhone,
                $phone2 !== '' ? $phone2 : null,
                $governorate !== '' ? $governorate : null,
                $address !== '' ? $address : null
            ]);
            $customerId = intval($pdo->lastInsertId());
        }

        // 6. Match Products & Variants
        $resolvedItems = [];
        $calculatedSubtotal = 0;
        $itemsForJson = [];

        foreach ($rawItems as $item) {
            $itemProd = $item['product'] ?? [];
            $itemVariant = $item['variant'] ?? [];

            $prodName = trim(strval($itemProd['name'] ?? $item['name'] ?? $item['title'] ?? 'منتج غير محدد'));
            $barcode = trim(strval($itemProd['sku'] ?? $itemVariant['sku'] ?? $item['sku'] ?? $item['barcode'] ?? ''));
            $quantity = intval($item['quantity'] ?? $item['qty'] ?? 1);
            if ($quantity <= 0) $quantity = 1;

            $price = isset($item['price']) ? floatval($item['price']) : (isset($itemProd['price']) ? floatval($itemProd['price']) : 0);

            $color = trim(strval($itemVariant['color'] ?? $item['color'] ?? ''));
            $size = trim(strval($itemVariant['size'] ?? $item['size'] ?? ''));

            $prodId = null;

            // Try match by Barcode/SKU first
            if ($barcode !== '') {
                $stmt = $pdo->prepare("SELECT id, name, sale_price, color, size FROM product_variants WHERE barcode = ? AND is_archived = 0 LIMIT 1");
                $stmt->execute([$barcode]);
                $vRow = $stmt->fetch();
                if ($vRow) {
                    $prodId = intval($vRow['id']);
                    if ($price <= 0 && isset($vRow['sale_price'])) $price = floatval($vRow['sale_price']);
                    if ($prodName === 'منتج غير محدد' && !empty($vRow['name'])) $prodName = $vRow['name'];
                }
            }

            // Try match by Name & Color & Size if not found
            if (!$prodId && $prodName !== 'منتج غير محدد') {
                if ($color !== '' || $size !== '') {
                    $stmt = $pdo->prepare("SELECT id, sale_price FROM product_variants WHERE name = ? AND (color = ? OR color IS NULL) AND (size = ? OR size IS NULL) AND is_archived = 0 LIMIT 1");
                    $stmt->execute([$prodName, $color ?: null, $size ?: null]);
                    $vRow = $stmt->fetch();
                    if ($vRow) {
                        $prodId = intval($vRow['id']);
                        if ($price <= 0) $price = floatval($vRow['sale_price']);
                    }
                }

                if (!$prodId) {
                    $stmt = $pdo->prepare("SELECT id, sale_price FROM product_variants WHERE name = ? AND is_archived = 0 LIMIT 1");
                    $stmt->execute([$prodName]);
                    $vRow = $stmt->fetch();
                    if ($vRow) {
                        $prodId = intval($vRow['id']);
                        if ($price <= 0) $price = floatval($vRow['sale_price']);
                    }
                }
            }

            // Auto-create product & variant if still not found
            if (!$prodId) {
                $parentId = easyorders_ensure_product_parent($pdo, $prodName);
                $stmt = $pdo->prepare("INSERT INTO product_variants (product_id, name, color, size, barcode, cost_price, sale_price) VALUES (?, ?, ?, ?, ?, 0, ?)");
                $stmt->execute([
                    $parentId,
                    $prodName,
                    $color !== '' ? $color : null,
                    $size !== '' ? $size : null,
                    $barcode !== '' ? $barcode : null,
                    $price
                ]);
                $prodId = intval($pdo->lastInsertId());
            }

            $lineTotal = $quantity * $price;
            $calculatedSubtotal += $lineTotal;

            $resolvedItems[] = [
                'product_id' => $prodId,
                'name' => $prodName,
                'quantity' => $quantity,
                'price' => $price,
                'total_price' => $lineTotal
            ];

            $itemsForJson[] = [
                'productId' => $prodId,
                'product_id' => $prodId,
                'name' => $prodName,
                'quantity' => $quantity,
                'price' => $price,
                'color' => $color,
                'size' => $size,
                'barcode' => $barcode,
                'total' => $lineTotal
            ];
        }

        // Adjust totals if empty
        if ($subtotal <= 0) $subtotal = $calculatedSubtotal;
        if ($totalAmount <= 0) $totalAmount = $subtotal + $shippingFees;

        // 7. Allocate Unique Order Number (Safe Loop)
        $useOrderNumber = null;
        $maxAttempts = 5;
        $attempt = 0;
        $orderId = null;

        while ($attempt < $maxAttempts) {
            $attempt++;
            try {
                $mxRow = $pdo->query("SELECT MAX(CAST(order_number AS UNSIGNED)) as mx FROM orders")->fetch();
                $nextNum = intval($mxRow['mx'] ?? 0) + 1 + ($attempt - 1);
                $useOrderNumber = (string)$nextNum;

                // Inspect columns in orders table
                $ordersHasEmployee = easyorders_column_exists($pdo, 'orders', 'employee');
                $ordersHasPage = easyorders_column_exists($pdo, 'orders', 'page');
                $ordersHasItemsJson = easyorders_column_exists($pdo, 'orders', 'items_json');
                $ordersHasAddress = easyorders_column_exists($pdo, 'orders', 'address');
                $ordersHasGov = easyorders_column_exists($pdo, 'orders', 'governorate');

                $insertCols = ['order_number', 'customer_id', 'status', 'total_amount', 'shipping_fees', 'notes', 'created_at'];
                
                $finalNotes = "طلب من منصة EasyOrders (#{$eoId})";
                if ($notes !== '') {
                    $finalNotes .= " - " . $notes;
                }

                $defaultStatus = easyorders_get_setting($pdo, 'easyorders_default_status', 'pending');
                $defaultEmployee = easyorders_get_setting($pdo, 'easyorders_default_employee', 'منصة إيزي أوردرز');
                $defaultPage = easyorders_get_setting($pdo, 'easyorders_default_page', 'EasyOrders');

                $insertVals = [
                    $useOrderNumber,
                    $customerId,
                    $defaultStatus ?: 'pending',
                    $totalAmount,
                    $shippingFees,
                    $finalNotes,
                    date('Y-m-d H:i:s')
                ];

                if ($ordersHasEmployee) {
                    $insertCols[] = 'employee';
                    $insertVals[] = $defaultEmployee ?: 'منصة إيزي أوردرز';
                }
                if ($ordersHasPage) {
                    $insertCols[] = 'page';
                    $insertVals[] = $defaultPage ?: 'EasyOrders';
                }
                if ($ordersHasItemsJson) {
                    $insertCols[] = 'items_json';
                    $insertVals[] = json_encode($itemsForJson, JSON_UNESCAPED_UNICODE);
                }
                if ($ordersHasAddress) {
                    $insertCols[] = 'address';
                    $insertVals[] = $address;
                }
                if ($ordersHasGov) {
                    $insertCols[] = 'governorate';
                    $insertVals[] = $governorate;
                }

                $placeholders = implode(',', array_fill(0, count($insertCols), '?'));
                $sql = "INSERT INTO orders (" . implode(',', $insertCols) . ") VALUES (" . $placeholders . ")";
                $stmt = $pdo->prepare($sql);
                $stmt->execute($insertVals);
                $orderId = intval($pdo->lastInsertId());
                break; // successfully inserted!
            } catch (PDOException $pe) {
                if (strpos($pe->getMessage(), 'Duplicate entry') !== false || $pe->getCode() == '23000') {
                    continue; // try next number
                }
                throw $pe;
            }
        }

        if (!$orderId) {
            throw new Exception("تعذر تخصيص رقم أوردر جديد فريد بعد عدة محاولات.");
        }

        // 8. Insert Order Items into `order_items`
        $orderItemsHasTotal = easyorders_column_exists($pdo, 'order_items', 'total_price');
        if ($orderItemsHasTotal) {
            $stmtLine = $pdo->prepare("INSERT INTO order_items (order_id, product_id, quantity, price_per_unit, total_price) VALUES (?, ?, ?, ?, ?)");
            foreach ($resolvedItems as $it) {
                $stmtLine->execute([$orderId, $it['product_id'], $it['quantity'], $it['price'], $it['total_price']]);
            }
        } else {
            $stmtLine = $pdo->prepare("INSERT INTO order_items (order_id, product_id, quantity, price_per_unit) VALUES (?, ?, ?, ?)");
            foreach ($resolvedItems as $it) {
                $stmtLine->execute([$orderId, $it['product_id'], $it['quantity'], $it['price']]);
            }
        }

        // 9. Log History in `order_status_history`
        easyorders_log_history($pdo, $orderId, 'pending', 'created', 'تم استيراده تلقائياً عبر منصة EasyOrders (معرف الطلب: ' . $eoId . ')');

        // 10. Record in `easyorders_orders`
        $stmtRecord = $pdo->prepare("INSERT INTO easyorders_orders (easyorders_id, order_id, order_number, customer_name, customer_phone, total_amount, status, raw_payload) VALUES (?, ?, ?, ?, ?, ?, 'success', ?) ON DUPLICATE KEY UPDATE order_id = VALUES(order_id), order_number = VALUES(order_number), status = 'success'");
        $stmtRecord->execute([
            $eoId,
            $orderId,
            $useOrderNumber,
            $customerName,
            $cleanPhone,
            $totalAmount,
            json_encode($payload, JSON_UNESCAPED_UNICODE)
        ]);

        // 11. Commit Transaction
        $pdo->commit();

        // 12. Log Event
        easyorders_log_event($pdo, 'order_imported', 'success', "تم استيراد طلب إيزي أوردرز #{$eoId} بنجاح برقم داخلي #{$useOrderNumber}", [
            'order_id' => $orderId,
            'order_number' => $useOrderNumber,
            'amount' => $totalAmount,
            'customer' => $customerName
        ]);

        return [
            'success' => true,
            'message' => 'تم إنشاء الطلب بنجاح.',
            'order_id' => $orderId,
            'order_number' => $useOrderNumber,
            'total_amount' => $totalAmount
        ];

    } catch (Exception $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }

        // Record failed attempt
        try {
            $stmtRecord = $pdo->prepare("INSERT INTO easyorders_orders (easyorders_id, customer_name, customer_phone, total_amount, status, error_message, raw_payload) VALUES (?, ?, ?, ?, 'failed', ?, ?) ON DUPLICATE KEY UPDATE status = 'failed', error_message = VALUES(error_message)");
            $stmtRecord->execute([
                $eoId,
                $customerName,
                $cleanPhone,
                $totalAmount,
                $e->getMessage(),
                json_encode($payload, JSON_UNESCAPED_UNICODE)
            ]);
        } catch (Exception $ign) {}

        easyorders_log_event($pdo, 'order_import_failed', 'error', "فشل استيراد طلب إيزي أوردرز #{$eoId}: " . $e->getMessage(), $payload);

        return [
            'success' => false,
            'message' => 'حدث خطأ أثناء معالجة الطلب: ' . $e->getMessage()
        ];
    }
}
