<?php
session_start();

// Simple endpoint to let frontend push/pull localStorage-like keys into DB
// Usage:
// POST ?op=push  with JSON { user_id: <id|null>, items: { key: value, ... } }
// GET  ?op=pull&user_id=<id> returns JSON of merged app_settings and user_settings for the user

header('Content-Type: application/json');
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if ($origin) header('Access-Control-Allow-Origin: ' . $origin);
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Access-Control-Allow-Credentials: true');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit(0); }

if (!file_exists(__DIR__ . '/../config.php')) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Configuration file not found.']);
    exit;
}
require_once __DIR__ . '/../config.php';

try {
    $pdo = new PDO("mysql:host=" . DB_HOST . ";dbname=" . DB_NAME . ";charset=utf8mb4", DB_USER, DB_PASS);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Database connection failed.']);
    exit;
}

$op = $_GET['op'] ?? ($_POST['op'] ?? '');

if ($op === 'push' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true);
    $userId = isset($input['user_id']) ? intval($input['user_id']) : null;
    $items = $input['items'] ?? [];

    if (!is_array($items)) {
        echo json_encode(['success' => false, 'message' => 'Invalid items']);
        exit;
    }

    // Insert into app_settings (global) when key looks global, else into user_settings
    $globalPrefixes = ['Dragon_company_', 'Dragon_tax_rate', 'Dragon_sales_calc_order', 'Dragon_currency', 'Dragon_product_source', 'Dragon_delivery_method'];

    $insApp = $pdo->prepare("INSERT INTO app_settings (`k`,`v`) VALUES (?,?) ON DUPLICATE KEY UPDATE `v` = VALUES(`v`)");
    $insUser = $pdo->prepare("INSERT INTO user_settings (`user_id`,`k`,`v`) VALUES (?,?,?) ON DUPLICATE KEY UPDATE `v` = VALUES(`v`)");

    foreach ($items as $k => $v) {
        $isGlobal = false;
        foreach ($globalPrefixes as $p) { if (strpos($k, $p) === 0) { $isGlobal = true; break; } }
        try {
            if ($isGlobal) {
                $insApp->execute([$k, is_scalar($v) ? (string)$v : json_encode($v)]);
            } else {
                // requires user_id
                if ($userId === null) continue;
                $insUser->execute([$userId, $k, is_scalar($v) ? (string)$v : json_encode($v)]);
            }
        } catch (Exception $e) {
            // ignore individual failures
        }
    }

    echo json_encode(['success' => true, 'message' => 'Synced']);
    exit;
}

if ($op === 'pull' && $_SERVER['REQUEST_METHOD'] === 'GET') {
    $userId = isset($_GET['user_id']) ? intval($_GET['user_id']) : null;
    $res = [];

    // app_settings (global)
    try {
        $stmt = $pdo->query("SELECT `k`,`v` FROM app_settings");
        $rows = $stmt->fetchAll(PDO::FETCH_KEY_PAIR);
        foreach ($rows as $k => $v) $res[$k] = $v;
    } catch (Exception $e) { /* ignore */ }

    // user settings
    if ($userId !== null) {
        try {
            $stmt = $pdo->prepare("SELECT `k`,`v` FROM user_settings WHERE user_id = ?");
            $stmt->execute([$userId]);
            $rows = $stmt->fetchAll(PDO::FETCH_KEY_PAIR);
            foreach ($rows as $k => $v) $res[$k] = $v;
        } catch (Exception $e) { /* ignore */ }
    }

    echo json_encode(['success' => true, 'data' => $res]);
    exit;
}

echo json_encode(['success' => false, 'message' => 'Invalid op']);
exit;

