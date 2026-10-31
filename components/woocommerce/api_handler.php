<?php
/**
 * DragonPro - WooCommerce Internal API Handler
 * Handles AJAX requests for the WooCommerce dashboard, mapping, simulation, and sync.
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
    $pdo = woocommerce_get_pdo();
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'فشل الاتصال بقاعدة البيانات: ' . $e->getMessage()], JSON_UNESCAPED_UNICODE);
    exit;
}

$action = $_GET['action'] ?? $_POST['action'] ?? '';
$rawInput = file_get_contents('php://input');
$body = json_decode($rawInput, true) ?? $_POST;

switch ($action) {
    case 'test_connection':
        $storeUrl = trim(strval($body['store_url'] ?? $body['storeUrl'] ?? ''));
        $consumerKey = trim(strval($body['consumer_key'] ?? $body['consumerKey'] ?? ''));
        $consumerSecret = trim(strval($body['consumer_secret'] ?? $body['consumerSecret'] ?? ''));

        if (empty($storeUrl)) $storeUrl = woocommerce_get_setting($pdo, 'woocommerce_store_url', '');
        if (empty($consumerKey)) $consumerKey = woocommerce_get_setting($pdo, 'woocommerce_consumer_key', '');
        if (empty($consumerSecret)) $consumerSecret = woocommerce_get_setting($pdo, 'woocommerce_consumer_secret', '');

        $result = woocommerce_test_connection($storeUrl, $consumerKey, $consumerSecret);
        echo json_encode($result, JSON_UNESCAPED_UNICODE);
        break;

    case 'get_stats':
        $enabled = woocommerce_get_setting($pdo, 'woocommerce_enabled', 'false');
        $storeUrl = woocommerce_get_setting($pdo, 'woocommerce_store_url', '');
        $consumerKey = woocommerce_get_setting($pdo, 'woocommerce_consumer_key', '');
        $defaultStatus = woocommerce_get_setting($pdo, 'woocommerce_default_status', 'pending');
        $defaultEmployee = woocommerce_get_setting($pdo, 'woocommerce_default_employee', 'متجر ووكومرس');
        $defaultPage = woocommerce_get_setting($pdo, 'woocommerce_default_page', 'WooCommerce');

        $totalOrders = 0;
        $successOrders = 0;
        $failedOrders = 0;
        $todayOrders = 0;
        $totalRevenue = 0.0;

        try {
            $totalOrders = intval($pdo->query("SELECT COUNT(*) FROM woocommerce_orders")->fetchColumn());
            $successOrders = intval($pdo->query("SELECT COUNT(*) FROM woocommerce_orders WHERE status = 'success'")->fetchColumn());
            $failedOrders = intval($pdo->query("SELECT COUNT(*) FROM woocommerce_orders WHERE status = 'failed'")->fetchColumn());
            $todayOrders = intval($pdo->query("SELECT COUNT(*) FROM woocommerce_orders WHERE DATE(created_at) = CURDATE()")->fetchColumn());
            $totalRevenue = floatval($pdo->query("SELECT COALESCE(SUM(total_amount), 0) FROM woocommerce_orders WHERE status = 'success'")->fetchColumn());
        } catch (Exception $e) {}

        echo json_encode([
            'success' => true,
            'data' => [
                'enabled' => ($enabled === 'true' || $enabled === '1' || $enabled === 1 || $enabled === true),
                'has_credentials' => (!empty($storeUrl) && !empty($consumerKey)),
                'store_url' => $storeUrl,
                'consumer_key' => $consumerKey,
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

    case 'save_settings':
        if (isset($body['enabled'])) woocommerce_set_setting($pdo, 'woocommerce_enabled', !empty($body['enabled']) ? 'true' : 'false');
        if (isset($body['store_url'])) woocommerce_set_setting($pdo, 'woocommerce_store_url', trim(strval($body['store_url'])));
        if (isset($body['consumer_key'])) woocommerce_set_setting($pdo, 'woocommerce_consumer_key', trim(strval($body['consumer_key'])));
        if (isset($body['consumer_secret'])) woocommerce_set_setting($pdo, 'woocommerce_consumer_secret', trim(strval($body['consumer_secret'])));
        if (isset($body['default_status'])) woocommerce_set_setting($pdo, 'woocommerce_default_status', trim(strval($body['default_status'])));
        if (isset($body['default_employee'])) woocommerce_set_setting($pdo, 'woocommerce_default_employee', trim(strval($body['default_employee'])));
        if (isset($body['default_page'])) woocommerce_set_setting($pdo, 'woocommerce_default_page', trim(strval($body['default_page'])));

        woocommerce_log_event($pdo, 'settings_updated', 'success', 'تم تحديث إعدادات إضافة WooCommerce بنجاح.');
        echo json_encode(['success' => true, 'message' => 'تم حفظ إعدادات ووكومرس بنجاح!'], JSON_UNESCAPED_UNICODE);
        break;

    case 'get_orders':
        $limit = min(200, max(10, intval($_GET['limit'] ?? 50)));
        $search = trim(strval($_GET['search'] ?? ''));

        try {
            if ($search !== '') {
                $term = "%{$search}%";
                $stmt = $pdo->prepare("SELECT id, wc_order_id, order_id, order_number, customer_name, customer_phone, total_amount, status, error_message, created_at FROM woocommerce_orders WHERE order_number LIKE ? OR customer_name LIKE ? OR customer_phone LIKE ? OR wc_order_id LIKE ? ORDER BY id DESC LIMIT ?");
                $stmt->bindValue(1, $term, PDO::PARAM_STR);
                $stmt->bindValue(2, $term, PDO::PARAM_STR);
                $stmt->bindValue(3, $term, PDO::PARAM_STR);
                $stmt->bindValue(4, $term, PDO::PARAM_STR);
                $stmt->bindValue(5, $limit, PDO::PARAM_INT);
                $stmt->execute();
            } else {
                $stmt = $pdo->prepare("SELECT id, wc_order_id, order_id, order_number, customer_name, customer_phone, total_amount, status, error_message, created_at FROM woocommerce_orders ORDER BY id DESC LIMIT ?");
                $stmt->bindValue(1, $limit, PDO::PARAM_INT);
                $stmt->execute();
            }
            $orders = $stmt->fetchAll();
            echo json_encode(['success' => true, 'data' => $orders], JSON_UNESCAPED_UNICODE);
        } catch (Exception $e) {
            echo json_encode(['success' => false, 'message' => $e->getMessage()], JSON_UNESCAPED_UNICODE);
        }
        break;

    case 'get_order_details':
        $id = intval($_GET['id'] ?? $body['id'] ?? 0);
        if (!$id) {
            echo json_encode(['success' => false, 'message' => 'معرف الطلب غير صالح.'], JSON_UNESCAPED_UNICODE);
            exit;
        }

        try {
            $stmt = $pdo->prepare("SELECT * FROM woocommerce_orders WHERE id = ? LIMIT 1");
            $stmt->execute([$id]);
            $rec = $stmt->fetch();
            if (!$rec) {
                echo json_encode(['success' => false, 'message' => 'الطلب غير موجود.'], JSON_UNESCAPED_UNICODE);
                exit;
            }

            $items = [];
            if (!empty($rec['order_id'])) {
                $stmtItems = $pdo->prepare("SELECT oi.*, pv.name as product_name, pv.barcode FROM order_items oi LEFT JOIN product_variants pv ON oi.product_id = pv.id WHERE oi.order_id = ?");
                $stmtItems->execute([$rec['order_id']]);
                $items = $stmtItems->fetchAll();
            }

            echo json_encode([
                'success' => true,
                'data' => [
                    'record' => $rec,
                    'items' => $items,
                    'raw_payload' => json_decode($rec['raw_payload'] ?? '', true)
                ]
            ], JSON_UNESCAPED_UNICODE);
        } catch (Exception $e) {
            echo json_encode(['success' => false, 'message' => $e->getMessage()], JSON_UNESCAPED_UNICODE);
        }
        break;

    case 'simulate_order':
        $res = woocommerce_simulate_test_order($pdo);
        echo json_encode($res, JSON_UNESCAPED_UNICODE);
        break;

    case 'fetch_products_mapping':
        $storeUrl = woocommerce_get_setting($pdo, 'woocommerce_store_url', '');
        $consumerKey = woocommerce_get_setting($pdo, 'woocommerce_consumer_key', '');
        $consumerSecret = woocommerce_get_setting($pdo, 'woocommerce_consumer_secret', '');

        if (empty($storeUrl) || empty($consumerKey) || empty($consumerSecret)) {
            echo json_encode(['success' => false, 'message' => 'يرجى حفظ إعدادات ووكومرس ومفاتيح الربط أولاً.'], JSON_UNESCAPED_UNICODE);
            exit;
        }

        $res = woocommerce_fetch_products_api($storeUrl, $consumerKey, $consumerSecret);
        if (empty($res['success'])) {
            echo json_encode($res, JSON_UNESCAPED_UNICODE);
            exit;
        }

        $remoteProducts = $res['data'] ?? [];
        $localMap = [];
        try {
            $stmt = $pdo->query("SELECT id, name, barcode, sale_price FROM product_variants WHERE is_archived = 0");
            while ($row = $stmt->fetch()) {
                if (!empty($row['barcode'])) $localMap[trim($row['barcode'])] = $row;
                $localMap['name_' . mb_strtolower(trim($row['name']))] = $row;
            }
        } catch (Exception $e) {}

        $mapped = [];
        foreach ($remoteProducts as $rp) {
            $sku = trim(strval($rp['sku'] ?? ''));
            $name = trim(strval($rp['name'] ?? ''));
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

    case 'get_logs':
        $limit = min(100, max(10, intval($_GET['limit'] ?? 40)));
        try {
            $stmt = $pdo->prepare("SELECT id, action, status, message, details, created_at FROM woocommerce_logs ORDER BY id DESC LIMIT ?");
            $stmt->bindValue(1, $limit, PDO::PARAM_INT);
            $stmt->execute();
            $logs = $stmt->fetchAll();
            echo json_encode(['success' => true, 'data' => $logs], JSON_UNESCAPED_UNICODE);
        } catch (Exception $e) {
            echo json_encode(['success' => false, 'message' => $e->getMessage()], JSON_UNESCAPED_UNICODE);
        }
        break;

    case 'sync_orders':
        $storeUrl = woocommerce_get_setting($pdo, 'woocommerce_store_url', '');
        $consumerKey = woocommerce_get_setting($pdo, 'woocommerce_consumer_key', '');
        $consumerSecret = woocommerce_get_setting($pdo, 'woocommerce_consumer_secret', '');

        if (empty($storeUrl) || empty($consumerKey) || empty($consumerSecret)) {
            echo json_encode(['success' => false, 'message' => 'يرجى حفظ إعدادات ووكومرس ومفاتيح الربط أولاً.'], JSON_UNESCAPED_UNICODE);
            exit;
        }

        $storeUrl = rtrim(trim($storeUrl), '/');
        if (!preg_match('#^https?://#i', $storeUrl)) $storeUrl = 'https://' . $storeUrl;

        $page = max(1, intval($body['page'] ?? 1));
        $limit = min(50, max(5, intval($body['limit'] ?? 25)));
        $statusFilter = trim(strval($body['status'] ?? ''));

        $url = $storeUrl . "/wp-json/wc/v3/orders?page={$page}&per_page={$limit}";
        if (!empty($body['after'])) $url .= "&after=" . urlencode($body['after'] . 'T00:00:00');
        if (!empty($body['before'])) $url .= "&before=" . urlencode($body['before'] . 'T23:59:59');
        if (!empty($statusFilter) && $statusFilter !== 'all') $url .= "&status=" . urlencode($statusFilter);

        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_USERPWD => "{$consumerKey}:{$consumerSecret}",
            CURLOPT_TIMEOUT => 30,
            CURLOPT_SSL_VERIFYPEER => false,
            CURLOPT_SSL_VERIFYHOST => false,
        ]);
        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $curlErr = curl_error($ch);
        curl_close($ch);

        if ($curlErr) {
            echo json_encode(['success' => false, 'message' => 'فشل الاتصال بمتجر ووكومرس: ' . $curlErr], JSON_UNESCAPED_UNICODE);
            exit;
        }

        if ($httpCode !== 200) {
            echo json_encode(['success' => false, 'message' => "استجاب المتجر برمز خطأ ({$httpCode}): " . mb_substr($response, 0, 150)], JSON_UNESCAPED_UNICODE);
            exit;
        }

        $orderList = json_decode($response, true);
        if (!is_array($orderList)) $orderList = [];

        $importedCount = 0;
        $skippedCount = 0;
        $failedCount = 0;

        foreach ($orderList as $ordPayload) {
            if (!is_array($ordPayload)) continue;
            $res = woocommerce_process_order($pdo, $ordPayload, 'manual_sync');
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

        woocommerce_log_event($pdo, 'manual_sync_finished', 'info', "اكتملت المزامنة اليدوية لووكومرس: تم استيراد {$importedCount} جديد، وتخطي {$skippedCount} مكرر، وفشل {$failedCount}.");

        echo json_encode([
            'success' => true,
            'message' => "اكتملت المزامنة: تم استيراد {$importedCount} طلب جديد، وتخطي {$skippedCount} مكرر مسبقاً.",
            'imported' => $importedCount,
            'skipped' => $skippedCount,
            'failed' => $failedCount,
            'total_fetched' => count($orderList)
        ], JSON_UNESCAPED_UNICODE);
        break;

    case 'retry_order':
        $recordId = intval($body['id'] ?? 0);
        $stmt = $pdo->prepare("SELECT * FROM woocommerce_orders WHERE id = ? LIMIT 1");
        $stmt->execute([$recordId]);
        $record = $stmt->fetch();
        if (!$record) {
            echo json_encode(['success' => false, 'message' => 'لم يتم العثور على سجل هذا الطلب.'], JSON_UNESCAPED_UNICODE);
            exit;
        }

        $payload = json_decode($record['raw_payload'] ?? '', true);
        $res = woocommerce_process_order($pdo, $payload, 'retry');
        echo json_encode($res, JSON_UNESCAPED_UNICODE);
        break;

    default:
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'إجراء غير معروف.'], JSON_UNESCAPED_UNICODE);
        break;
}
