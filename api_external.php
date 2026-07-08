<?php
session_start();

// Set timezone to Egypt (UTC+2 — Africa/Cairo)
date_default_timezone_set('Africa/Cairo');

// Force JSON response
error_reporting(E_ALL);
ini_set('display_errors', '0');

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit(0);
}

// -----------------------
// Bootstrap DB Connection
// -----------------------
$cfg = __DIR__ . '/config.php';
if (!file_exists($cfg)) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Configuration file config.php not found. Please install the application first.']);
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
    echo json_encode(['success' => false, 'message' => 'Database connection failed.']);
    exit;
}

// -----------------------
// Helper Functions
// -----------------------
if (!function_exists('execute_query')) {
    function execute_query($pdo, $sql, $params = []) {
        $stmt = $pdo->prepare($sql);
        $stmt->execute(is_array($params) ? $params : []);
        return $stmt;
    }
}

if (!function_exists('table_exists')) {
    function table_exists($pdo, $table) {
        try {
            $db = $pdo->query('SELECT DATABASE()')->fetchColumn();
            if (!$db) return false;
            $stmt = execute_query(
                $pdo,
                'SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? LIMIT 1',
                [$db, $table]
            );
            return intval($stmt->fetchColumn()) > 0;
        } catch (Exception $e) {
            return false;
        }
    }
}

if (!function_exists('column_exists')) {
    function column_exists($pdo, $table, $column) {
        try {
            $db = $pdo->query('SELECT DATABASE()')->fetchColumn();
            if (!$db) return false;
            $stmt = execute_query(
                $pdo,
                'SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ? LIMIT 1',
                [$db, $table, $column]
            );
            return intval($stmt->fetchColumn()) > 0;
        } catch (Exception $e) {
            return false;
        }
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
        if (!table_exists($pdo, 'order_status_history')) return;
        try {
            execute_query(
                $pdo,
                "INSERT INTO order_status_history (order_id, status, action, notes, rep_id, created_by) VALUES (?, ?, ?, ?, ?, ?)",
                [$order_id, $status, $action, $notes, $rep_id, null]
            );
        } catch (Exception $e) {
            // ignore to avoid breaking order flow
        }
    }
}

function get_setting_value($pdo, $key, $default = '') {
    try {
        $stmt = $pdo->prepare("SELECT config_value FROM settings WHERE config_key = ? LIMIT 1");
        $stmt->execute([$key]);
        $val = $stmt->fetchColumn();
        if ($val !== false) return $val;
    } catch (Exception $e) {}

    try {
        $checkAppSettings = $pdo->query("SHOW TABLES LIKE 'app_settings'")->fetch();
        if ($checkAppSettings) {
            $stmt = $pdo->prepare("SELECT value FROM app_settings WHERE name = ? LIMIT 1");
            $stmt->execute([$key]);
            $val = $stmt->fetchColumn();
            if ($val !== false) return $val;
        }
    } catch (Exception $e) {}

    return $default;
}

function set_setting_value($pdo, $key, $value) {
    try {
        $stmt = $pdo->prepare("INSERT INTO settings (config_key, config_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE config_value = VALUES(config_value)");
        $stmt->execute([$key, $value]);
    } catch (Exception $e) {}

    try {
        $checkAppSettings = $pdo->query("SHOW TABLES LIKE 'app_settings'")->fetch();
        if ($checkAppSettings) {
            $stmt = $pdo->prepare("INSERT INTO app_settings (name, value) VALUES (?, ?) ON DUPLICATE KEY UPDATE value = VALUES(value)");
            $stmt->execute([$key, $value]);
        }
    } catch (Exception $e) {}
}

// -----------------------
// Authentication Check
// -----------------------
$apiToken = get_setting_value($pdo, 'external_api_token', '');
if ($apiToken === '') {
    // Generate a default API token if none exists
    $apiToken = 'dragon_' . bin2hex(random_bytes(16));
    set_setting_value($pdo, 'external_api_token', $apiToken);
    
    // First-time warning message so they can retrieve it
    http_response_code(401);
    echo json_encode([
        'success' => false,
        'message' => 'API token has been auto-generated for your system. Please use this token for all API requests.',
        'external_api_token' => $apiToken
    ]);
    exit;
}

// Extract Authorization Token
$providedToken = '';
$authHeader = $_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '';
if (preg_match('/Bearer\s+(.*)$/i', $authHeader, $matches)) {
    $providedToken = trim($matches[1]);
} else {
    $providedToken = $_GET['token'] ?? $_POST['token'] ?? '';
    if ($providedToken === '') {
        $rawInput = file_get_contents('php://input');
        $decoded = json_decode($rawInput, true);
        if (is_array($decoded) && isset($decoded['token'])) {
            $providedToken = trim($decoded['token']);
        }
    }
}

if ($providedToken === '' || $providedToken !== $apiToken) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'Unauthorized. Invalid or missing API token.']);
    exit;
}

// -----------------------
// Route Action Handling
// -----------------------
$action = $_GET['action'] ?? '';
if ($_SERVER['REQUEST_METHOD'] === 'POST' && $action === '') {
    // Parse action from POST body as fallback
    $rawInput = file_get_contents('php://input');
    $decoded = json_decode($rawInput, true);
    if (is_array($decoded) && isset($decoded['action'])) {
        $action = trim($decoded['action']);
    }
}

switch ($action) {
    case 'get_products':
        try {
            // Fetch all product variants with barcode, parent product name, color, size, price
            $stmt = $pdo->query("
                SELECT pv.id AS variant_id, p.name AS product_name, pv.color, pv.size, pv.barcode, pv.sale_price 
                FROM product_variants pv 
                LEFT JOIN products p ON pv.product_id = p.id 
                WHERE pv.is_archived = 0
                ORDER BY p.name ASC, pv.color ASC, pv.size ASC
            ");
            $products = $stmt->fetchAll(PDO::FETCH_ASSOC);
            echo json_encode(['success' => true, 'data' => $products]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => 'Failed to fetch products: ' . $e->getMessage()]);
        }
        break;

    case 'create_order':
        // Parse Request Body
        $rawInput = file_get_contents('php://input');
        $inputData = json_decode($rawInput, true) ?? $_POST;

        if (empty($inputData) || !is_array($inputData)) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'Invalid or empty request payload.']);
            break;
        }

        $customerName = trim($inputData['customer_name'] ?? '');
        $phone = trim($inputData['phone'] ?? '');
        $phone2 = trim($inputData['phone2'] ?? '');
        $governorate = trim($inputData['governorate'] ?? '');
        $address = trim($inputData['address'] ?? '');
        $notes = trim($inputData['notes'] ?? '');
        $shipping = floatval($inputData['shipping_fees'] ?? 0);
        $orderNumber = trim($inputData['order_number'] ?? '');
        $providedSubtotal = floatval($inputData['subtotal'] ?? 0);
        $providedTotal = floatval($inputData['total_amount'] ?? 0);

        if ($customerName === '' || $phone === '') {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'Customer name and phone number are required.']);
            break;
        }

        $productsList = $inputData['products'] ?? [];
        if (!is_array($productsList) || empty($productsList)) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'Order must contain at least one product.']);
            break;
        }

        try {
            $pdo->beginTransaction();

            // 1. Find or create customer
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

            // 2. Resolve items and calculate subtotal
            $calculatedSubtotal = 0;
            $resolvedProducts = [];

            foreach ($productsList as $pItem) {
                $barcode = trim($pItem['barcode'] ?? '');
                $prodName = trim($pItem['name'] ?? $pItem['product_name'] ?? '');
                $quantity = intval($pItem['quantity'] ?? 1);
                if ($quantity <= 0) $quantity = 1;

                $prodId = null;
                $price = isset($pItem['price']) ? floatval($pItem['price']) : null;

                // Match by barcode
                if ($barcode !== '') {
                    $stmt = $pdo->prepare("SELECT id, sale_price, name FROM product_variants WHERE barcode = ? LIMIT 1");
                    $stmt->execute([$barcode]);
                    $vRow = $stmt->fetch();
                    if ($vRow) {
                        $prodId = intval($vRow['id']);
                        if ($price === null) $price = floatval($vRow['sale_price']);
                        if ($prodName === '') $prodName = $vRow['name'];
                    }
                }

                // Match by name if still not found
                if (!$prodId && $prodName !== '') {
                    $stmt = $pdo->prepare("SELECT id, sale_price FROM product_variants WHERE name = ? LIMIT 1");
                    $stmt->execute([$prodName]);
                    $vRow = $stmt->fetch();
                    if ($vRow) {
                        $prodId = intval($vRow['id']);
                        if ($price === null) $price = floatval($vRow['sale_price']);
                    }
                }

                // Fallback: Create placeholder product & variant if it doesn't exist
                if (!$prodId) {
                    if ($prodName === '') $prodName = 'منتج خارجي غير مسمى';
                    $parentId = ensure_product_parent($pdo, $prodName);
                    
                    $stmt = $pdo->prepare("INSERT INTO product_variants (product_id, name, cost_price, sale_price, barcode) VALUES (?, ?, 0, 0, ?)");
                    $stmt->execute([$parentId, $prodName, $barcode !== '' ? $barcode : null]);
                    $prodId = intval($pdo->lastInsertId());
                    if ($price === null) $price = 0;
                }

                if ($price === null) $price = 0;
                $lineTotal = $quantity * $price;
                $calculatedSubtotal += $lineTotal;

                $resolvedProducts[] = [
                    'product_id' => $prodId,
                    'quantity' => $quantity,
                    'price' => $price,
                    'total_price' => $lineTotal
                ];
            }

            $subtotalBase = ($providedSubtotal > 0) ? $providedSubtotal : $calculatedSubtotal;
            $totalAmount = ($providedTotal > 0) ? $providedTotal : ($subtotalBase + $shipping);

            // 3. Compute unique order number
            $useOrderNumber = null;
            if ($orderNumber !== '') {
                $stmt = $pdo->prepare("SELECT COUNT(*) AS cnt FROM orders WHERE order_number = ?");
                $stmt->execute([$orderNumber]);
                if (intval($stmt->fetchColumn()) === 0) {
                    $useOrderNumber = $orderNumber;
                }
            }

            if (!$useOrderNumber) {
                $mxRow = $pdo->query("SELECT MAX(CAST(order_number AS UNSIGNED)) as mx FROM orders")->fetch();
                $useOrderNumber = (string)(intval($mxRow['mx'] ?? 0) + 1);
            }

            // 4. Insert order
            $ordersHasEmployee = column_exists($pdo, 'orders', 'employee');
            $ordersHasPage = column_exists($pdo, 'orders', 'page');
            
            $insertCols = ['order_number', 'customer_id', 'status', 'total_amount', 'shipping_fees', 'notes'];
            $insertVals = [$useOrderNumber, $customerId, 'pending', $totalAmount, $shipping, $notes];
            
            if ($ordersHasEmployee) {
                $insertCols[] = 'employee';
                $insertVals[] = 'شات بوت / متجر خارجي';
            }
            if ($ordersHasPage) {
                $insertCols[] = 'page';
                $insertVals[] = 'الربط التلقائي';
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
                foreach ($resolvedProducts as $item) {
                    $stmtLine->execute([$orderId, $item['product_id'], $item['quantity'], $item['price'], $item['total_price']]);
                }
            } else {
                $stmtLine = $pdo->prepare("INSERT INTO order_items (order_id, product_id, quantity, price_per_unit) VALUES (?, ?, ?, ?)");
                foreach ($resolvedProducts as $item) {
                    $stmtLine->execute([$orderId, $item['product_id'], $item['quantity'], $item['price']]);
                }
            }

            // 6. Log Order History
            log_order_history($pdo, $orderId, 'pending', 'created', 'تم إنشاؤه تلقائياً عبر المتجر الخارجي / واتساب', null);

            $pdo->commit();

            echo json_encode([
                'success' => true,
                'message' => 'Order created successfully.',
                'data' => [
                    'order_id' => $orderId,
                    'order_number' => $useOrderNumber,
                    'total_amount' => $totalAmount
                ]
            ]);

        } catch (Exception $e) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => 'Database error while creating order: ' . $e->getMessage()]);
        }
        break;

    default:
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Invalid action. Choose either get_products or create_order.']);
        break;
}
