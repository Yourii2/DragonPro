<?php
/**
 * DragonPro - EasyOrders Webhook Endpoint
 * Receives real-time order notifications from EasyOrders (easy-orders.net)
 */

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, Api-Key');
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
    echo json_encode([
        'success' => false,
        'message' => 'فشل الاتصال بقاعدة البيانات: ' . $e->getMessage()
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

// -----------------------
// Handle GET (Health Check / Verification)
// -----------------------
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $enabled = easyorders_get_setting($pdo, 'easyorders_enabled', 'false');
    $isLive = ($enabled === 'true' || $enabled === '1' || $enabled === 1 || $enabled === true);

    echo json_encode([
        'success' => true,
        'status' => 'active',
        'integration_enabled' => $isLive,
        'message' => 'رابط الويب هوك الخاص بـ EasyOrders يعمل بنجاح وجاهز لاستقبال الطلبات!',
        'server_time' => date('Y-m-d H:i:s')
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

// -----------------------
// Handle POST (Order Webhook)
// -----------------------
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    // 1. Check if integration is enabled
    $enabled = easyorders_get_setting($pdo, 'easyorders_enabled', 'false');
    $isLive = ($enabled === 'true' || $enabled === '1' || $enabled === 1 || $enabled === true);

    if (!$isLive) {
        easyorders_log_event($pdo, 'webhook_blocked', 'warning', 'تم استلام إشعار ويب هوك لكن إضافة EasyOrders معطلة حالياً في الإعدادات.');
        http_response_code(403);
        echo json_encode([
            'success' => false,
            'message' => 'إضافة منصة EasyOrders غير مفعلة حالياً في إعدادات DragonPro.'
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }

    // 2. Read incoming payload
    $rawInput = file_get_contents('php://input');
    $payload = json_decode($rawInput, true);

    if (!is_array($payload) || empty($payload)) {
        // Fallback to $_POST
        $payload = $_POST;
    }

    if (empty($payload) || !is_array($payload)) {
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'message' => 'لم يتم إرسال أي بيانات في الطلب (Empty payload).'
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }

    // 3. Log webhook receipt
    easyorders_log_event($pdo, 'webhook_received', 'info', 'تم استلام إشعار جديد من ويب هوك EasyOrders', $payload);

    // 4. Process Order
    $result = easyorders_process_order($pdo, $payload, 'webhook');

    if (!empty($result['success'])) {
        http_response_code(200);
    } else {
        http_response_code(422);
    }

    echo json_encode($result, JSON_UNESCAPED_UNICODE);
    exit;
}

http_response_code(405);
echo json_encode(['success' => false, 'message' => 'Method not allowed.'], JSON_UNESCAPED_UNICODE);
