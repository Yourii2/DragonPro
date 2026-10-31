<?php
/**
 * DragonPro - Shopify Internal API Handler
 * Handles AJAX requests for the Shopify dashboard, mapping, simulation, and sync.
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
    $pdo = shopify_get_pdo();
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
        $shopDomain = trim(strval($body['shop_domain'] ?? $body['shopDomain'] ?? ''));
        $accessToken = trim(strval($body['access_token'] ?? $body['accessToken'] ?? ''));

        if (empty($shopDomain)) $shopDomain = shopify_get_setting($pdo, 'shopify_store_domain', '');
        if (empty($accessToken)) $accessToken = shopify_get_setting($pdo, 'shopify_access_token', '');

        $result = shopify_test_connection($shopDomain, $accessToken);
        echo json_encode($result, JSON_UNESCAPED_UNICODE);
        break;

    case 'get_stats':
        $enabled = shopify_get_setting($pdo, 'shopify_enabled', 'false');
        $shopDomain = shopify_get_setting($pdo, 'shopify_store_domain', '');
        $accessToken = shopify_get_setting($pdo, 'shopify_access_token', '');
        $defaultStatus = shopify_get_setting($pdo, 'shopify_default_status', 'pending');
        $defaultEmployee = shopify_get_setting($pdo, 'shopify_default_employee', 'متجر شوبيفاي');
        $defaultPage = shopify_get_setting($pdo, 'shopify_default_page', 'Shopify');

        $totalOrders = 0;
        $successOrders = 0;
        $failedOrders = 0;
        $todayOrders = 0;
        $totalRevenue = 0.0;

        try {
            $totalOrders = intval($pdo->query("SELECT COUNT(*) FROM shopify_orders")->fetchColumn());
            $successOrders = intval($pdo->query("SELECT COUNT(*) FROM shopify_orders WHERE status = 'success'")->fetchColumn());
            $failedOrders = intval($pdo->query("SELECT COUNT(*) FROM shopify_orders WHERE status = 'failed'")->fetchColumn());
            $todayOrders = intval($pdo->query("SELECT COUNT(*) FROM shopify_orders WHERE DATE(created_at) = CURDATE()")->fetchColumn());
            $totalRevenue = floatval($pdo->query("SELECT COALESCE(SUM(total_amount), 0) FROM shopify_orders WHERE status = 'success'")->fetchColumn());
        } catch (Exception $e) {}

        echo json_encode([
            'success' => true,
            'data' => [
                'enabled' => ($enabled === 'true' || $enabled === '1' || $enabled === 1 || $enabled === true),
                'has_credentials' => (!empty($shopDomain) && !empty($accessToken)),
                'shop_domain' => $shopDomain,
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
        if (isset($body['enabled'])) shopify_set_setting($pdo, 'shopify_enabled', !empty($body['enabled']) ? 'true' : 'false');
        if (isset($body['shop_domain'])) shopify_set_setting($pdo, 'shopify_store_domain', trim(strval($body['shop_domain'])));
        if (isset($body['access_token'])) shopify_set_setting($pdo, 'shopify_access_token', trim(strval($body['access_token'])));
        if (isset($body['default_status'])) shopify_set_setting($pdo, 'shopify_default_status', trim(strval($body['default_status'])));
        if (isset($body['default_employee'])) shopify_set_setting($pdo, 'shopify_default_employee', trim(strval($body['default_employee'])));
        if (isset($body['default_page'])) shopify_set_setting($pdo, 'shopify_default_page', trim(strval($body['default_page'])));

        shopify_log_event($pdo, 'settings_updated', 'success', 'تم حفظ إعدادات Shopify بنجاح.');
        echo json_encode(['success' => true, 'message' => 'تم حفظ إعدادات شوبيفاي بنجاح!'], JSON_UNESCAPED_UNICODE);
        break;

    case 'get_orders':
        $limit = min(200, max(10, intval($_GET['limit'] ?? 50)));
        $search = trim(strval($_GET['search'] ?? ''));

        try {
            if ($search !== '') {
                $term = "%{$search}%";
                $stmt = $pdo->prepare("SELECT id, shopify_order_id, order_id, order_number, customer_name, customer_phone, total_amount, status, error_message, created_at FROM shopify_orders WHERE order_number LIKE ? OR customer_name LIKE ? OR customer_phone LIKE ? OR shopify_order_id LIKE ? ORDER BY id DESC LIMIT ?");
                $stmt->bindValue(1, $term, PDO::PARAM_STR);
                $stmt->bindValue(2, $term, PDO::PARAM_STR);
                $stmt->bindValue(3, $term, PDO::PARAM_STR);
                $stmt->bindValue(4, $term, PDO::PARAM_STR);
                $stmt->bindValue(5, $limit, PDO::PARAM_INT);
                $stmt->execute();
            } else {
                $stmt = $pdo->prepare("SELECT id, shopify_order_id, order_id, order_number, customer_name, customer_phone, total_amount, status, error_message, created_at FROM shopify_orders ORDER BY id DESC LIMIT ?");
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
            $stmt = $pdo->prepare("SELECT * FROM shopify_orders WHERE id = ? LIMIT 1");
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
        $res = shopify_simulate_test_order($pdo);
        echo json_encode($res, JSON_UNESCAPED_UNICODE);
        break;

    case 'fetch_products_mapping':
        $shopDomain = shopify_get_setting($pdo, 'shopify_store_domain', '');
        $accessToken = shopify_get_setting($pdo, 'shopify_access_token', '');

        if (empty($shopDomain) || empty($accessToken)) {
            echo json_encode(['success' => false, 'message' => 'يرجى حفظ إعدادات شوبيفاي وتوكن الربط أولاً.'], JSON_UNESCAPED_UNICODE);
            exit;
        }

        $res = shopify_fetch_products_api($shopDomain, $accessToken);
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
            $name = trim(strval($rp['title'] ?? ''));
            $variants = $rp['variants'] ?? [];

            if (is_array($variants) && count($variants) > 0) {
                foreach ($variants as $v) {
                    $sku = trim(strval($v['sku'] ?? ''));
                    $price = floatval($v['price'] ?? 0);
                    $vTitle = trim(strval($v['title'] ?? ''));
                    $fullName = $vTitle && $vTitle !== 'Default Title' ? "{$name} - {$vTitle}" : $name;

                    $matched = null;
                    if ($sku !== '' && isset($localMap[$sku])) {
                        $matched = $localMap[$sku];
                    } elseif (isset($localMap['name_' . mb_strtolower($fullName)])) {
                        $matched = $localMap['name_' . mb_strtolower($fullName)];
                    } elseif (isset($localMap['name_' . mb_strtolower($name)])) {
                        $matched = $localMap['name_' . mb_strtolower($name)];
                    }

                    $mapped[] = [
                        'remote_id' => $v['id'] ?? $rp['id'] ?? '',
                        'name' => $fullName,
                        'sku' => $sku,
                        'price' => $price,
                        'is_matched' => ($matched !== null),
                        'matched_variant_id' => $matched ? $matched['id'] : null,
                        'matched_variant_name' => $matched ? $matched['name'] : null,
                        'matched_barcode' => $matched ? $matched['barcode'] : null,
                    ];
                }
            } else {
                $mapped[] = [
                    'remote_id' => $rp['id'] ?? '',
                    'name' => $name,
                    'sku' => '',
                    'price' => 0,
                    'is_matched' => false,
                    'matched_variant_id' => null,
                    'matched_variant_name' => null,
                    'matched_barcode' => null,
                ];
            }
        }

        echo json_encode([
            'success' => true,
            'data' => $mapped,
            'total_remote' => count($mapped)
        ], JSON_UNESCAPED_UNICODE);
        break;

    case 'get_logs':
        $limit = min(100, max(10, intval($_GET['limit'] ?? 40)));
        try {
            $stmt = $pdo->prepare("SELECT id, action, status, message, details, created_at FROM shopify_logs ORDER BY id DESC LIMIT ?");
            $stmt->bindValue(1, $limit, PDO::PARAM_INT);
            $stmt->execute();
            $logs = $stmt->fetchAll();
            echo json_encode(['success' => true, 'data' => $logs], JSON_UNESCAPED_UNICODE);
        } catch (Exception $e) {
            echo json_encode(['success' => false, 'message' => $e->getMessage()], JSON_UNESCAPED_UNICODE);
        }
        break;

    case 'sync_orders':
        $shopDomain = shopify_get_setting($pdo, 'shopify_store_domain', '');
        $accessToken = shopify_get_setting($pdo, 'shopify_access_token', '');

        if (empty($shopDomain) || empty($accessToken)) {
            echo json_encode(['success' => false, 'message' => 'يرجى حفظ إعدادات شوبيفاي وتوكن الربط أولاً.'], JSON_UNESCAPED_UNICODE);
            exit;
        }

        $shopDomain = trim(str_replace(['https://', 'http://', '/'], '', $shopDomain));
        if (!str_contains($shopDomain, '.')) $shopDomain .= '.myshopify.com';

        $limit = min(50, max(5, intval($body['limit'] ?? 25)));
        $statusFilter = trim(strval($body['status'] ?? 'any'));

        $url = "https://{$shopDomain}/admin/api/2024-01/orders.json?status={$statusFilter}&limit={$limit}";
        if (!empty($body['created_at_min'])) $url .= "&created_at_min=" . urlencode($body['created_at_min'] . 'T00:00:00Z');
        if (!empty($body['created_at_max'])) $url .= "&created_at_max=" . urlencode($body['created_at_max'] . 'T23:59:59Z');

        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_HTTPHEADER => [
                "X-Shopify-Access-Token: {$accessToken}",
                "Content-Type: application/json"
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
            echo json_encode(['success' => false, 'message' => 'فشل الاتصال بسيرفر شوبيفاي: ' . $curlErr], JSON_UNESCAPED_UNICODE);
            exit;
        }

        if ($httpCode !== 200) {
            echo json_encode(['success' => false, 'message' => "استجاب السيرفر برمز خطأ ({$httpCode}): " . mb_substr($response, 0, 150)], JSON_UNESCAPED_UNICODE);
            exit;
        }

        $parsed = json_decode($response, true);
        $orderList = $parsed['orders'] ?? [];

        $importedCount = 0;
        $skippedCount = 0;
        $failedCount = 0;

        foreach ($orderList as $ordPayload) {
            if (!is_array($ordPayload)) continue;
            $res = shopify_process_order($pdo, $ordPayload, 'manual_sync');
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

        shopify_log_event($pdo, 'manual_sync_finished', 'info', "اكتملت المزامنة اليدوية لشوبيفاي: تم استيراد {$importedCount} جديد، وتخطي {$skippedCount} مكرر، وفشل {$failedCount}.");

        echo json_encode([
            'success' => true,
            'message' => "اكتملت المزامنة: تم استيراد {$importedCount} طلب جديد من شوبيفاي، وتخطي {$skippedCount} مكرر.",
            'imported' => $importedCount,
            'skipped' => $skippedCount,
            'failed' => $failedCount,
            'total_fetched' => count($orderList)
        ], JSON_UNESCAPED_UNICODE);
        break;

    case 'retry_order':
        $recordId = intval($body['id'] ?? 0);
        $stmt = $pdo->prepare("SELECT * FROM shopify_orders WHERE id = ? LIMIT 1");
        $stmt->execute([$recordId]);
        $record = $stmt->fetch();
        if (!$record) {
            echo json_encode(['success' => false, 'message' => 'لم يتم العثور على سجل هذا الطلب.'], JSON_UNESCAPED_UNICODE);
            exit;
        }

        $payload = json_decode($record['raw_payload'] ?? '', true);
        $res = shopify_process_order($pdo, $payload, 'retry');
        echo json_encode($res, JSON_UNESCAPED_UNICODE);
        break;

    default:
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'إجراء غير معروف.'], JSON_UNESCAPED_UNICODE);
        break;
}
