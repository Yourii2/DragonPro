<?php
/**
 * DragonPro - EasyOrders Internal API Handler
 * Handles AJAX requests for the EasyOrders dashboard, simulator, mapping, and settings.
 */

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit(0);
}

require_once __DIR__ . '/core.php';

try {
    $pdo = easyorders_get_pdo();
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'فشل الاتصال بقاعدة البيانات: ' . $e->getMessage()], JSON_UNESCAPED_UNICODE);
    exit;
}

$action = $_GET['action'] ?? $_POST['action'] ?? '';
$rawInput = file_get_contents('php://input');
$body = json_decode($rawInput, true) ?? $_POST;

switch ($action) {
    // -----------------------
    // Test API Connection
    // -----------------------
    case 'test_connection':
        $apiKey = trim(strval($body['api_key'] ?? $body['apiKey'] ?? ''));
        if (empty($apiKey)) {
            $apiKey = easyorders_get_setting($pdo, 'easyorders_api_key', '');
        }
        $result = easyorders_test_connection($apiKey);
        echo json_encode($result, JSON_UNESCAPED_UNICODE);
        break;

    // -----------------------
    // Get Stats & Info
    // -----------------------
    case 'get_stats':
        $enabled = easyorders_get_setting($pdo, 'easyorders_enabled', 'false');
        $apiKey = easyorders_get_setting($pdo, 'easyorders_api_key', '');
        $defaultStatus = easyorders_get_setting($pdo, 'easyorders_default_status', 'pending');
        $defaultEmployee = easyorders_get_setting($pdo, 'easyorders_default_employee', 'منصة إيزي أوردرز');
        $defaultPage = easyorders_get_setting($pdo, 'easyorders_default_page', 'EasyOrders');

        $totalOrders = 0;
        $successOrders = 0;
        $failedOrders = 0;
        $todayOrders = 0;
        $totalRevenue = 0.0;

        try {
            $totalOrders = intval($pdo->query("SELECT COUNT(*) FROM easyorders_orders")->fetchColumn());
            $successOrders = intval($pdo->query("SELECT COUNT(*) FROM easyorders_orders WHERE status = 'success'")->fetchColumn());
            $failedOrders = intval($pdo->query("SELECT COUNT(*) FROM easyorders_orders WHERE status = 'failed'")->fetchColumn());
            $todayOrders = intval($pdo->query("SELECT COUNT(*) FROM easyorders_orders WHERE DATE(created_at) = CURDATE()")->fetchColumn());
            $totalRevenue = floatval($pdo->query("SELECT COALESCE(SUM(total_amount), 0) FROM easyorders_orders WHERE status = 'success'")->fetchColumn());
        } catch (Exception $e) {}

        echo json_encode([
            'success' => true,
            'data' => [
                'enabled' => ($enabled === 'true' || $enabled === '1' || $enabled === 1 || $enabled === true),
                'has_api_key' => !empty($apiKey),
                'api_key' => $apiKey,
                'default_status' => $defaultStatus,
                'default_employee' => $defaultEmployee,
                'default_page' => $defaultPage,
                'total_orders' => $totalOrders,
                'success_orders' => $successOrders,
                'failed_orders' => $failedOrders,
                'today_orders' => $todayOrders,
                'total_revenue' => $totalRevenue,
            ]
        ], JSON_UNESCAPED_UNICODE);
        break;

    // -----------------------
    // Save Addon Settings Directly
    // -----------------------
    case 'save_settings':
        if (isset($body['enabled'])) {
            easyorders_set_setting($pdo, 'easyorders_enabled', !empty($body['enabled']) ? 'true' : 'false');
        }
        if (isset($body['api_key'])) {
            easyorders_set_setting($pdo, 'easyorders_api_key', trim(strval($body['api_key'])));
        }
        if (isset($body['default_status'])) {
            easyorders_set_setting($pdo, 'easyorders_default_status', trim(strval($body['default_status'])));
        }
        if (isset($body['default_employee'])) {
            easyorders_set_setting($pdo, 'easyorders_default_employee', trim(strval($body['default_employee'])));
        }
        if (isset($body['default_page'])) {
            easyorders_set_setting($pdo, 'easyorders_default_page', trim(strval($body['default_page'])));
        }

        easyorders_log_event($pdo, 'settings_updated', 'success', 'تم تحديث إعدادات إضافة إيزي أوردرز بنجاح.');
        echo json_encode(['success' => true, 'message' => 'تم حفظ الإعدادات بنجاح!'], JSON_UNESCAPED_UNICODE);
        break;

    // -----------------------
    // Get Imported Orders List
    // -----------------------
    case 'get_orders':
        $limit = min(200, max(10, intval($_GET['limit'] ?? 50)));
        $search = trim(strval($_GET['search'] ?? ''));

        try {
            if ($search !== '') {
                $term = "%{$search}%";
                $stmt = $pdo->prepare("SELECT id, easyorders_id, order_id, order_number, customer_name, customer_phone, total_amount, status, error_message, created_at FROM easyorders_orders WHERE order_number LIKE ? OR customer_name LIKE ? OR customer_phone LIKE ? OR easyorders_id LIKE ? ORDER BY id DESC LIMIT ?");
                $stmt->bindValue(1, $term, PDO::PARAM_STR);
                $stmt->bindValue(2, $term, PDO::PARAM_STR);
                $stmt->bindValue(3, $term, PDO::PARAM_STR);
                $stmt->bindValue(4, $term, PDO::PARAM_STR);
                $stmt->bindValue(5, $limit, PDO::PARAM_INT);
                $stmt->execute();
            } else {
                $stmt = $pdo->prepare("SELECT id, easyorders_id, order_id, order_number, customer_name, customer_phone, total_amount, status, error_message, created_at FROM easyorders_orders ORDER BY id DESC LIMIT ?");
                $stmt->bindValue(1, $limit, PDO::PARAM_INT);
                $stmt->execute();
            }
            $orders = $stmt->fetchAll();
            echo json_encode(['success' => true, 'data' => $orders], JSON_UNESCAPED_UNICODE);
        } catch (Exception $e) {
            echo json_encode(['success' => false, 'message' => $e->getMessage()], JSON_UNESCAPED_UNICODE);
        }
        break;

    // -----------------------
    // Get Single Order Details & Raw Payload
    // -----------------------
    case 'get_order_details':
        $id = intval($_GET['id'] ?? $body['id'] ?? 0);
        if (!$id) {
            echo json_encode(['success' => false, 'message' => 'معرف الطلب غير صالح.'], JSON_UNESCAPED_UNICODE);
            exit;
        }

        try {
            $stmt = $pdo->prepare("SELECT * FROM easyorders_orders WHERE id = ? LIMIT 1");
            $stmt->execute([$id]);
            $eo = $stmt->fetch();
            if (!$eo) {
                echo json_encode(['success' => false, 'message' => 'الطلب غير موجود.'], JSON_UNESCAPED_UNICODE);
                exit;
            }

            // Fetch internal order items if order_id exists
            $items = [];
            if (!empty($eo['order_id'])) {
                $stmtItems = $pdo->prepare("SELECT oi.*, pv.name as product_name, pv.barcode, pv.color, pv.size FROM order_items oi LEFT JOIN product_variants pv ON oi.product_id = pv.id WHERE oi.order_id = ?");
                $stmtItems->execute([$eo['order_id']]);
                $items = $stmtItems->fetchAll();
            }

            echo json_encode([
                'success' => true,
                'data' => [
                    'record' => $eo,
                    'items' => $items,
                    'raw_payload' => json_decode($eo['raw_payload'] ?? '', true)
                ]
            ], JSON_UNESCAPED_UNICODE);
        } catch (Exception $e) {
            echo json_encode(['success' => false, 'message' => $e->getMessage()], JSON_UNESCAPED_UNICODE);
        }
        break;

    // -----------------------
    // Simulate Mock Test Order
    // -----------------------
    case 'simulate_order':
        $res = easyorders_simulate_test_order($pdo);
        echo json_encode($res, JSON_UNESCAPED_UNICODE);
        break;

    // -----------------------
    // Products Mapping Helper
    // -----------------------
    case 'fetch_products_mapping':
        $apiKey = easyorders_get_setting($pdo, 'easyorders_api_key', '');
        if (empty($apiKey)) {
            echo json_encode(['success' => false, 'message' => 'يرجى حفظ مفتاح الـ API أولاً.'], JSON_UNESCAPED_UNICODE);
            exit;
        }

        $res = easyorders_fetch_products_api($apiKey);
        if (empty($res['success'])) {
            echo json_encode($res, JSON_UNESCAPED_UNICODE);
            exit;
        }

        $remoteProducts = $res['data'] ?? [];

        // Fetch local variants for comparison
        $localMap = [];
        try {
            $stmt = $pdo->query("SELECT id, name, barcode, color, size, sale_price FROM product_variants WHERE is_archived = 0");
            while ($row = $stmt->fetch()) {
                if (!empty($row['barcode'])) {
                    $localMap[trim($row['barcode'])] = $row;
                }
                $localMap['name_' . mb_strtolower(trim($row['name']))] = $row;
            }
        } catch (Exception $e) {}

        $mapped = [];
        foreach ($remoteProducts as $rp) {
            $sku = trim(strval($rp['sku'] ?? ''));
            $name = trim(strval($rp['name'] ?? $rp['title'] ?? ''));
            $price = floatval($rp['price'] ?? 0);

            $matched = null;
            if ($sku !== '' && isset($localMap[$sku])) {
                $matched = $localMap[$sku];
            } elseif (isset($localMap['name_' . mb_strtolower($name)])) {
                $matched = $localMap['name_' . mb_strtolower($name)];
            }

            $mapped[] = [
                'remote_id' => $rp['id'] ?? '',
                'name' => $name,
                'sku' => $sku,
                'price' => $price,
                'is_matched' => ($matched !== null),
                'matched_variant_id' => $matched ? $matched['id'] : null,
                'matched_variant_name' => $matched ? $matched['name'] : null,
                'matched_barcode' => $matched ? $matched['barcode'] : null,
            ];
        }

        echo json_encode([
            'success' => true,
            'data' => $mapped,
            'total_remote' => count($remoteProducts)
        ], JSON_UNESCAPED_UNICODE);
        break;

    // -----------------------
    // Get Activity Logs
    // -----------------------
    case 'get_logs':
        $limit = min(100, max(10, intval($_GET['limit'] ?? 40)));
        try {
            $stmt = $pdo->prepare("SELECT id, action, status, message, details, created_at FROM easyorders_logs ORDER BY id DESC LIMIT ?");
            $stmt->bindValue(1, $limit, PDO::PARAM_INT);
            $stmt->execute();
            $logs = $stmt->fetchAll();
            echo json_encode(['success' => true, 'data' => $logs], JSON_UNESCAPED_UNICODE);
        } catch (Exception $e) {
            echo json_encode(['success' => false, 'message' => $e->getMessage()], JSON_UNESCAPED_UNICODE);
        }
        break;

    // -----------------------
    // Manual Sync Orders from EasyOrders API
    // -----------------------
    case 'sync_orders':
        $apiKey = easyorders_get_setting($pdo, 'easyorders_api_key', '');
        if (empty($apiKey)) {
            echo json_encode(['success' => false, 'message' => 'يرجى حفظ مفتاح الـ API في الإعدادات أولاً لإتمام المزامنة.'], JSON_UNESCAPED_UNICODE);
            exit;
        }

        $page = max(1, intval($body['page'] ?? 1));
        $limit = min(50, max(5, intval($body['limit'] ?? 25)));
        $statusFilter = trim(strval($body['status'] ?? ''));

        $url = "https://api.easy-orders.net/api/v1/external-apps/orders?page={$page}&limit={$limit}";
        if (!empty($body['from'])) {
            $url .= "&from=" . urlencode($body['from']);
        }
        if (!empty($body['to'])) {
            $url .= "&to=" . urlencode($body['to']);
        }
        if (!empty($statusFilter) && $statusFilter !== 'all') {
            $url .= "&status=" . urlencode($statusFilter);
        }

        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_HTTPHEADER => [
                'Api-Key: ' . $apiKey,
                'Content-Type: application/json',
                'Accept: application/json'
            ],
            CURLOPT_TIMEOUT => 30,
            CURLOPT_SSL_VERIFYPEER => false,
            CURLOPT_SSL_VERIFYHOST => false,
        ]);
        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $curlErr = curl_error($ch);
        curl_close($ch);

        if ($curlErr) {
            echo json_encode(['success' => false, 'message' => 'فشل الاتصال بسيرفر EasyOrders: ' . $curlErr], JSON_UNESCAPED_UNICODE);
            exit;
        }

        if ($httpCode !== 200) {
            echo json_encode(['success' => false, 'message' => "استجاب السيرفر برمز خطأ ({$httpCode}): " . mb_substr($response, 0, 200)], JSON_UNESCAPED_UNICODE);
            exit;
        }

        $parsed = json_decode($response, true);
        $orderList = [];
        if (isset($parsed['orders']) && is_array($parsed['orders'])) {
            $orderList = $parsed['orders'];
        } elseif (isset($parsed['data']) && is_array($parsed['data'])) {
            $orderList = $parsed['data'];
        } elseif (is_array($parsed)) {
            $orderList = $parsed;
        }

        $importedCount = 0;
        $skippedCount = 0;
        $failedCount = 0;

        foreach ($orderList as $ordPayload) {
            if (!is_array($ordPayload)) continue;
            $res = easyorders_process_order($pdo, $ordPayload, 'manual_sync');
            if (!empty($res['success'])) {
                if (!empty($res['already_exists'])) {
                    $skippedCount++;
                } else {
                    $importedCount++;
                }
            } else {
                $failedCount++;
            }
        }

        easyorders_log_event($pdo, 'manual_sync_finished', 'info', "اكتملت المزامنة اليدوية: تم استيراد {$importedCount} جديد، وتخطي {$skippedCount} مكرر، وفشل {$failedCount}.");

        echo json_encode([
            'success' => true,
            'message' => "اكتملت المزامنة: تم استيراد {$importedCount} طلب جديد، وتخطي {$skippedCount} مكرر مسبقاً.",
            'imported' => $importedCount,
            'skipped' => $skippedCount,
            'failed' => $failedCount,
            'total_fetched' => count($orderList)
        ], JSON_UNESCAPED_UNICODE);
        break;

    // -----------------------
    // Retry Failed Order
    // -----------------------
    case 'retry_order':
        $recordId = intval($body['id'] ?? 0);
        if (!$recordId) {
            echo json_encode(['success' => false, 'message' => 'معرف الطلب غير صالح.'], JSON_UNESCAPED_UNICODE);
            exit;
        }

        $stmt = $pdo->prepare("SELECT * FROM easyorders_orders WHERE id = ? LIMIT 1");
        $stmt->execute([$recordId]);
        $record = $stmt->fetch();
        if (!$record) {
            echo json_encode(['success' => false, 'message' => 'لم يتم العثور على سجل هذا الطلب.'], JSON_UNESCAPED_UNICODE);
            exit;
        }

        $payload = json_decode($record['raw_payload'] ?? '', true);
        if (empty($payload)) {
            $payload = [
                'id' => $record['easyorders_id'],
                'full_name' => $record['customer_name'],
                'phone' => $record['customer_phone'],
                'total_amount' => $record['total_amount']
            ];
        }

        $res = easyorders_process_order($pdo, $payload, 'retry');
        echo json_encode($res, JSON_UNESCAPED_UNICODE);
        break;

    default:
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'إجراء غير معروف (Unknown action).'], JSON_UNESCAPED_UNICODE);
        break;
}
