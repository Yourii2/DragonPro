<?php
session_start();

// CORS
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if ($origin) header('Access-Control-Allow-Origin: ' . $origin);
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Access-Control-Allow-Credentials: true');
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit(0); }

if (!file_exists(__DIR__ . '/../config.php')) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Configuration file not found. Please run setup.']);
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

try {
    // Prefer new `app_settings` table; fallback to legacy `settings` if not present
    $table = 'app_settings';
    $check = $pdo->query("SHOW TABLES LIKE 'app_settings'")->fetch();
    if (!$check) {
        $table = 'settings';
    }

    $stmt = $pdo->query("SELECT " . ($table === 'app_settings' ? 'k' : 'config_key') . ", " . ($table === 'app_settings' ? 'v' : 'config_value') . " FROM " . $table);
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
    $settings = [];
    foreach ($rows as $r) {
        $key = $r[$table === 'app_settings' ? 'k' : 'config_key'];
        $val = $r[$table === 'app_settings' ? 'v' : 'config_value'];
        $settings[$key] = $val;
    }

    echo json_encode(['success' => true, 'data' => $settings]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Failed to fetch settings.']);
    exit;
}
