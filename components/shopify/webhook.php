<?php
/**
 * DragonPro - Shopify Webhook Receiver
 * Handles real-time order creation from Shopify
 */

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Shopify-Topic, X-Shopify-Hmac-Sha256, X-Shopify-Shop-Domain, X-Shopify-API-Version');
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

// -----------------------
// Handle GET (Health Check)
// -----------------------
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $enabled = shopify_get_setting($pdo, 'shopify_enabled', 'false');
    $isLive = ($enabled === 'true' || $enabled === '1' || $enabled === 1 || $enabled === true);

    echo json_encode([
        'success' => true,
        'status' => 'active',
        'integration_enabled' => $isLive,
        'message' => 'رابط الويب هوك الخاص بـ Shopify يعمل بنجاح وجاهز لاستقبال الطلبات!',
        'server_time' => date('Y-m-d H:i:s')
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

// -----------------------
// Handle POST (Shopify Order Webhook)
// -----------------------
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $enabled = shopify_get_setting($pdo, 'shopify_enabled', 'false');
    $isLive = ($enabled === 'true' || $enabled === '1' || $enabled === 1 || $enabled === true);

    if (!$isLive) {
        shopify_log_event($pdo, 'webhook_blocked', 'warning', 'تم استلام إشعار ويب هوك لكن إضافة Shopify معطلة في الإعدادات.');
        http_response_code(403);
        echo json_encode(['success' => false, 'message' => 'إضافة Shopify غير مفعلة حالياً في DragonPro.'], JSON_UNESCAPED_UNICODE);
        exit;
    }

    $rawInput = file_get_contents('php://input');
    $payload = json_decode($rawInput, true);

    if (empty($payload) || !is_array($payload)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'لم يتم إرسال أي بيانات (Empty Payload).'], JSON_UNESCAPED_UNICODE);
        exit;
    }

    $topic = $_SERVER['HTTP_X_SHOPIFY_TOPIC'] ?? 'orders/create';
    shopify_log_event($pdo, 'webhook_received', 'info', "تم استلام إشعار جديد من شوبيفاي ({$topic})", $payload);

    $result = shopify_process_order($pdo, $payload, 'webhook');
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
