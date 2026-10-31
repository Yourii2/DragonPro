<?php
/**
 * DragonPro - WooCommerce Integration Core Library
 * Handles DB connection, WooCommerce order parsing, REST API communication, and logging.
 */

if (!defined('WOOCOMMERCE_INIT')) {
    define('WOOCOMMERCE_INIT', true);
}

date_default_timezone_set('Africa/Cairo');
error_reporting(E_ALL);
ini_set('display_errors', '0');

function woocommerce_get_pdo() {
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

    woocommerce_ensure_tables($pdo);
    return $pdo;
}

function woocommerce_ensure_tables($pdo) {
    try {
        $pdo->exec("CREATE TABLE IF NOT EXISTS `woocommerce_orders` (
            `id` INT(11) NOT NULL AUTO_INCREMENT,
            `wc_order_id` VARCHAR(120) NOT NULL,
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
            UNIQUE KEY `uk_wc_order_id` (`wc_order_id`),
            KEY `idx_wc_order_id` (`order_id`),
            KEY `idx_wc_created_at` (`created_at`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;");

        $pdo->exec("CREATE TABLE IF NOT EXISTS `woocommerce_logs` (
            `id` INT(11) NOT NULL AUTO_INCREMENT,
            `action` VARCHAR(100) NOT NULL,
            `status` VARCHAR(50) NOT NULL,
            `message` TEXT NULL,
            `details` LONGTEXT NULL,
            `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (`id`),
            KEY `idx_wc_logs_created` (`created_at`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;");
    } catch (Exception $e) {
        error_log("Failed to ensure woocommerce tables: " . $e->getMessage());
    }
}

function woocommerce_get_setting($pdo, $key, $default = '') {
    try {
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

function woocommerce_set_setting($pdo, $key, $value) {
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

function woocommerce_column_exists($pdo, $table, $column) {
    try {
        $stmt = $pdo->prepare("SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?");
        $stmt->execute([$table, $column]);
        return intval($stmt->fetchColumn()) > 0;
    } catch (Exception $e) {
        return false;
    }
}

function woocommerce_log_event($pdo, $action, $status, $message, $details = null) {
    try {
        $detailsStr = is_string($details) ? $details : (is_array($details) || is_object($details) ? json_encode($details, JSON_UNESCAPED_UNICODE) : null);
        $stmt = $pdo->prepare("INSERT INTO woocommerce_logs (action, status, message, details) VALUES (?, ?, ?, ?)");
        $stmt->execute([$action, $status, $message, $detailsStr]);
    } catch (Exception $e) {}
}

function woocommerce_ensure_product_parent($pdo, $name, $category = 'ووكومرس') {
    $name = trim($name);
    if ($name === '') $name = 'منتج ووكومرس';
    $stmt = $pdo->prepare("SELECT id FROM products WHERE name = ? LIMIT 1");
    $stmt->execute([$name]);
    $id = $stmt->fetchColumn();
    if ($id) return intval($id);

    $stmt = $pdo->prepare("INSERT INTO products (name, category) VALUES (?, ?)");
    $stmt->execute([$name, $category]);
    return intval($pdo->lastInsertId());
}

// -----------------------
// Test WooCommerce API Connection
// -----------------------
function woocommerce_test_connection($storeUrl, $consumerKey, $consumerSecret) {
    $storeUrl = rtrim(trim($storeUrl), '/');
    $consumerKey = trim($consumerKey);
    $consumerSecret = trim($consumerSecret);

    if (empty($storeUrl) || empty($consumerKey) || empty($consumerSecret)) {
        return ['success' => false, 'message' => 'يرجى إدخال رابط المتجر ومفتاحي Consumer Key و Consumer Secret.'];
    }

    if (!preg_match('#^https?://#i', $storeUrl)) {
        $storeUrl = 'https://' . $storeUrl;
    }

    $url = $storeUrl . '/wp-json/wc/v3/system_status';
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_USERPWD => "{$consumerKey}:{$consumerSecret}",
        CURLOPT_TIMEOUT => 15,
        CURLOPT_SSL_VERIFYPEER => false,
        CURLOPT_SSL_VERIFYHOST => false,
    ]);

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlErr = curl_error($ch);
    curl_close($ch);

    if ($curlErr) {
        return ['success' => false, 'message' => 'فشل الاتصال بمتجر ووكومرس: ' . $curlErr];
    }

    if ($httpCode === 200) {
        return ['success' => true, 'message' => 'تم الاتصال بمتجر WooCommerce بنجاح والمفاتيح صالحة تماماً!'];
    } elseif ($httpCode === 401 || $httpCode === 403) {
        return ['success' => false, 'message' => 'مفاتيح الربط غير صحيحة أو غير مصرح لها (رمز الاستجابة: ' . $httpCode . ').'];
    } elseif ($httpCode === 404) {
        return ['success' => false, 'message' => 'الرابط غير صحيح أو إضافة WooCommerce REST API غير مفعلة على موقعك.'];
    } else {
        return ['success' => false, 'message' => 'استجاب المتجر برمز (' . $httpCode . '): ' . mb_substr($response, 0, 150)];
    }
}

// -----------------------
// Fetch Products from WooCommerce
// -----------------------
function woocommerce_fetch_products_api($storeUrl, $consumerKey, $consumerSecret) {
    $storeUrl = rtrim(trim($storeUrl), '/');
    if (!preg_match('#^https?://#i', $storeUrl)) $storeUrl = 'https://' . $storeUrl;

    $url = $storeUrl . '/wp-json/wc/v3/products?per_page=50';
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_USERPWD => "{$consumerKey}:{$consumerSecret}",
        CURLOPT_TIMEOUT => 25,
        CURLOPT_SSL_VERIFYPEER => false,
        CURLOPT_SSL_VERIFYHOST => false,
    ]);
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($httpCode !== 200) return ['success' => false, 'message' => 'تعذر جلب المنتجات (كود ' . $httpCode . ')'];
    $data = json_decode($response, true);
    return ['success' => true, 'data' => is_array($data) ? $data : []];
}

// -----------------------
// Process WooCommerce Order
// -----------------------
function woocommerce_process_order($pdo, array $payload, $source = 'webhook') {
    $wcId = trim(strval($payload['id'] ?? $payload['number'] ?? ''));
    if ($wcId === '') {
        $wcId = 'wc_' . date('YmdHis') . '_' . rand(100, 999);
    }

    // Check duplicate
    $stmt = $pdo->prepare("SELECT id, order_id, order_number FROM woocommerce_orders WHERE wc_order_id = ? LIMIT 1");
    $stmt->execute([$wcId]);
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

    // Parse Customer
    $billing = $payload['billing'] ?? [];
    $shipping = $payload['shipping'] ?? [];

    $firstName = trim($shipping['first_name'] ?? $billing['first_name'] ?? '');
    $lastName = trim($shipping['last_name'] ?? $billing['last_name'] ?? '');
    $customerName = trim($firstName . ' ' . $lastName);
    if ($customerName === '') $customerName = 'عميل ووكومرس';

    $phone = trim(strval($shipping['phone'] ?? $billing['phone'] ?? ''));
    $phone = preg_replace('/[^\d\+]/', '', $phone);
    if ($phone === '') $phone = '00000000000';

    $address1 = trim(strval($shipping['address_1'] ?? $billing['address_1'] ?? ''));
    $address2 = trim(strval($shipping['address_2'] ?? $billing['address_2'] ?? ''));
    $address = trim($address1 . ' ' . $address2);

    $city = trim(strval($shipping['city'] ?? $billing['city'] ?? ''));
    $state = trim(strval($shipping['state'] ?? $billing['state'] ?? ''));
    $governorate = $state !== '' ? $state : $city;

    $notes = trim(strval($payload['customer_note'] ?? ''));

    // Financials
    $totalAmount = floatval($payload['total'] ?? 0);
    $shippingFees = floatval($payload['shipping_total'] ?? 0);

    // Line items
    $lineItems = $payload['line_items'] ?? [];
    if (!is_array($lineItems)) $lineItems = [];

    $pdo->beginTransaction();

    try {
        // Customer Match or Create
        $customerId = null;
        if ($phone !== '00000000000') {
            $stmt = $pdo->prepare("SELECT id FROM customers WHERE phone1 = ? OR phone2 = ? LIMIT 1");
            $stmt->execute([$phone, $phone]);
            $cRow = $stmt->fetch();
            if ($cRow) {
                $customerId = intval($cRow['id']);
                $stmtUp = $pdo->prepare("UPDATE customers SET address = COALESCE(NULLIF(address, ''), ?), governorate = COALESCE(NULLIF(governorate, ''), ?) WHERE id = ?");
                $stmtUp->execute([$address, $governorate, $customerId]);
            }
        }

        if (!$customerId) {
            $stmt = $pdo->prepare("INSERT INTO customers (name, phone1, governorate, address) VALUES (?, ?, ?, ?)");
            $stmt->execute([$customerName, $phone, $governorate ?: null, $address ?: null]);
            $customerId = intval($pdo->lastInsertId());
        }

        // Match Products
        $resolvedItems = [];
        $itemsForJson = [];
        $calculatedSubtotal = 0;

        foreach ($lineItems as $item) {
            $prodName = trim(strval($item['name'] ?? 'منتج ووكومرس'));
            $sku = trim(strval($item['sku'] ?? ''));
            $qty = intval($item['quantity'] ?? 1);
            if ($qty <= 0) $qty = 1;
            $price = floatval($item['price'] ?? ($qty > 0 ? floatval($item['total'] ?? 0) / $qty : 0));

            $color = '';
            $size = '';
            if (!empty($item['meta_data']) && is_array($item['meta_data'])) {
                foreach ($item['meta_data'] as $m) {
                    $key = strtolower(strval($m['key'] ?? ''));
                    $displayKey = strtolower(strval($m['display_key'] ?? ''));
                    $val = trim(strval($m['value'] ?? ''));
                    if (str_contains($key, 'color') || str_contains($displayKey, 'اللون') || str_contains($key, 'لون')) {
                        $color = $val;
                    } elseif (str_contains($key, 'size') || str_contains($displayKey, 'المقاس') || str_contains($key, 'مقاس')) {
                        $size = $val;
                    }
                }
            }

            $prodId = null;

            // Match by SKU/Barcode
            if ($sku !== '') {
                $stmt = $pdo->prepare("SELECT id, name, sale_price FROM product_variants WHERE barcode = ? AND is_archived = 0 LIMIT 1");
                $stmt->execute([$sku]);
                $vRow = $stmt->fetch();
                if ($vRow) {
                    $prodId = intval($vRow['id']);
                    if ($price <= 0) $price = floatval($vRow['sale_price']);
                }
            }

            // Match by Name & Color & Size
            if (!$prodId) {
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

            // Auto-create variant if missing
            if (!$prodId) {
                $parentId = woocommerce_ensure_product_parent($pdo, $prodName);
                $stmt = $pdo->prepare("INSERT INTO product_variants (product_id, name, color, size, barcode, cost_price, sale_price) VALUES (?, ?, ?, ?, ?, 0, ?)");
                $stmt->execute([$parentId, $prodName, $color !== '' ? $color : null, $size !== '' ? $size : null, $sku !== '' ? $sku : null, $price]);
                $prodId = intval($pdo->lastInsertId());
            }

            $lineTotal = $qty * $price;
            $calculatedSubtotal += $lineTotal;

            $resolvedItems[] = [
                'product_id' => $prodId,
                'name' => $prodName,
                'quantity' => $qty,
                'price' => $price,
                'total_price' => $lineTotal
            ];

            $itemsForJson[] = [
                'productId' => $prodId,
                'product_id' => $prodId,
                'name' => $prodName,
                'color' => $color,
                'size' => $size,
                'quantity' => $qty,
                'price' => $price,
                'barcode' => $sku,
                'total' => $lineTotal
            ];
        }

        if ($totalAmount <= 0) $totalAmount = $calculatedSubtotal + $shippingFees;

        // Allocate Order Number
        $useOrderNumber = null;
        $attempt = 0;
        $orderId = null;
        $maxAttempts = 5;

        $defaultStatus = woocommerce_get_setting($pdo, 'woocommerce_default_status', 'pending');
        $defaultEmployee = woocommerce_get_setting($pdo, 'woocommerce_default_employee', 'متجر ووكومرس');
        $defaultPage = woocommerce_get_setting($pdo, 'woocommerce_default_page', 'WooCommerce');

        while ($attempt < $maxAttempts) {
            $attempt++;
            try {
                $mxRow = $pdo->query("SELECT MAX(CAST(order_number AS UNSIGNED)) as mx FROM orders")->fetch();
                $nextNum = intval($mxRow['mx'] ?? 0) + 1 + ($attempt - 1);
                $useOrderNumber = (string)$nextNum;

                $ordersHasEmployee = woocommerce_column_exists($pdo, 'orders', 'employee');
                $ordersHasPage = woocommerce_column_exists($pdo, 'orders', 'page');
                $ordersHasItemsJson = woocommerce_column_exists($pdo, 'orders', 'items_json');
                $ordersHasAddress = woocommerce_column_exists($pdo, 'orders', 'address');
                $ordersHasGov = woocommerce_column_exists($pdo, 'orders', 'governorate');

                $insertCols = ['order_number', 'customer_id', 'status', 'total_amount', 'shipping_fees', 'notes', 'created_at'];
                $finalNotes = "طلب من متجر ووكومرس (#{$wcId})";
                if ($notes !== '') $finalNotes .= " - " . $notes;

                $insertVals = [
                    $useOrderNumber,
                    $customerId,
                    $defaultStatus ?: 'pending',
                    $totalAmount,
                    $shippingFees,
                    $finalNotes,
                    date('Y-m-d H:i:s')
                ];

                if ($ordersHasEmployee) { $insertCols[] = 'employee'; $insertVals[] = $defaultEmployee ?: 'متجر ووكومرس'; }
                if ($ordersHasPage) { $insertCols[] = 'page'; $insertVals[] = $defaultPage ?: 'WooCommerce'; }
                if ($ordersHasItemsJson) { $insertCols[] = 'items_json'; $insertVals[] = json_encode($itemsForJson, JSON_UNESCAPED_UNICODE); }
                if ($ordersHasAddress) { $insertCols[] = 'address'; $insertVals[] = $address; }
                if ($ordersHasGov) { $insertCols[] = 'governorate'; $insertVals[] = $governorate; }

                $placeholders = implode(',', array_fill(0, count($insertCols), '?'));
                $sql = "INSERT INTO orders (" . implode(',', $insertCols) . ") VALUES (" . $placeholders . ")";
                $stmt = $pdo->prepare($sql);
                $stmt->execute($insertVals);
                $orderId = intval($pdo->lastInsertId());
                break;
            } catch (PDOException $pe) {
                if (strpos($pe->getMessage(), 'Duplicate entry') !== false || $pe->getCode() == '23000') {
                    continue;
                }
                throw $pe;
            }
        }

        if (!$orderId) throw new Exception("تعذر تخصيص رقم أوردر جديد فريد بعد عدة محاولات.");

        // Insert Order Items
        $orderItemsHasTotal = woocommerce_column_exists($pdo, 'order_items', 'total_price');
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

        // Log history
        try {
            $stmtH = $pdo->prepare("INSERT INTO order_status_history (order_id, status, action, notes, rep_id, created_by) VALUES (?, ?, 'created', ?, NULL, NULL)");
            $stmtH->execute([$orderId, $defaultStatus ?: 'pending', 'تم استيراده تلقائياً عبر متجر ووكومرس (معرف الطلب: ' . $wcId . ')']);
        } catch (Exception $e) {}

        // Record in woocommerce_orders
        $stmtRecord = $pdo->prepare("INSERT INTO woocommerce_orders (wc_order_id, order_id, order_number, customer_name, customer_phone, total_amount, status, raw_payload) VALUES (?, ?, ?, ?, ?, ?, 'success', ?) ON DUPLICATE KEY UPDATE order_id = VALUES(order_id), order_number = VALUES(order_number), status = 'success'");
        $stmtRecord->execute([
            $wcId,
            $orderId,
            $useOrderNumber,
            $customerName,
            $phone,
            $totalAmount,
            json_encode($payload, JSON_UNESCAPED_UNICODE)
        ]);

        $pdo->commit();

        woocommerce_log_event($pdo, 'order_imported', 'success', "تم استيراد طلب ووكومرس #{$wcId} بنجاح برقم داخلي #{$useOrderNumber}", [
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
        if ($pdo->inTransaction()) $pdo->rollBack();

        try {
            $stmtRecord = $pdo->prepare("INSERT INTO woocommerce_orders (wc_order_id, customer_name, customer_phone, total_amount, status, error_message, raw_payload) VALUES (?, ?, ?, ?, 'failed', ?, ?) ON DUPLICATE KEY UPDATE status = 'failed', error_message = VALUES(error_message)");
            $stmtRecord->execute([$wcId, $customerName, $phone, $totalAmount, $e->getMessage(), json_encode($payload, JSON_UNESCAPED_UNICODE)]);
        } catch (Exception $ign) {}

        woocommerce_log_event($pdo, 'order_import_failed', 'error', "فشل استيراد طلب ووكومرس #{$wcId}: " . $e->getMessage(), $payload);

        return [
            'success' => false,
            'message' => 'حدث خطأ أثناء معالجة الطلب: ' . $e->getMessage()
        ];
    }
}

// -----------------------
// Simulate Test Order
// -----------------------
function woocommerce_simulate_test_order($pdo) {
    $vRow = null;
    try {
        $vRow = $pdo->query("SELECT id, name, barcode, sale_price FROM product_variants WHERE is_archived = 0 AND barcode IS NOT NULL AND barcode != '' LIMIT 1")->fetch();
    } catch (Exception $e) {}

    $prodName = ($vRow && !empty($vRow['name'])) ? $vRow['name'] : 'منتج تجريبي من ووكومرس';
    $sku = ($vRow && !empty($vRow['barcode'])) ? $vRow['barcode'] : 'WC-TEST-01';
    $price = ($vRow && floatval($vRow['sale_price']) > 0) ? floatval($vRow['sale_price']) : 350.0;

    $mockPayload = [
        'id' => rand(1000, 9999),
        'number' => (string)rand(1000, 9999),
        'status' => 'processing',
        'total' => (string)($price + 45),
        'shipping_total' => '45.00',
        'customer_note' => 'طلب تجريبي لاختبار ربط ووكومرس المباشر',
        'billing' => [
            'first_name' => 'أحمد',
            'last_name' => 'محمود',
            'phone' => '012' . rand(10000000, 99999999),
            'city' => 'الإسكندرية',
            'state' => 'الإسكندرية',
            'address_1' => 'سموحة - ش فوزي معاذ'
        ],
        'shipping' => [
            'first_name' => 'أحمد',
            'last_name' => 'محمود',
            'phone' => '012' . rand(10000000, 99999999),
            'city' => 'الإسكندرية',
            'state' => 'الإسكندرية',
            'address_1' => 'سموحة - ش فوزي معاذ'
        ],
        'line_items' => [
            [
                'id' => rand(100, 999),
                'name' => $prodName,
                'quantity' => 1,
                'price' => $price,
                'total' => (string)$price,
                'sku' => $sku
            ]
        ]
    ];

    return woocommerce_process_order($pdo, $mockPayload, 'simulator');
}
