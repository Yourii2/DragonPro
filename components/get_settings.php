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
    $settings = [];
    $check = $pdo->query("SHOW TABLES LIKE 'app_settings'")->fetch();
    if ($check) {
        $stmt = $pdo->query("SELECT name, value FROM app_settings");
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
        foreach ($rows as $r) {
            $settings[$r['name']] = $r['value'];
        }
        // If a logo file id is present, expose a resolvable URL for frontend
        if (!empty($settings['company_logo_file_id']) && is_numeric($settings['company_logo_file_id'])) {
            $id = intval($settings['company_logo_file_id']);
            $proto = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
            $host = $_SERVER['HTTP_HOST'] ?? '';
            $base = rtrim(dirname($_SERVER['SCRIPT_NAME']), '/');
            $settings['company_logo_url'] = $proto . '://' . $host . $base . '/get_file.php?id=' . $id;
        }
    } else {
        // legacy settings table
        $stmt = $pdo->query("SELECT config_key, config_value FROM settings");
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
        foreach ($rows as $r) {
            $settings[$r['config_key']] = $r['config_value'];
        }
        // legacy settings table may contain company_logo_file_id as config_key
        if (!empty($settings['company_logo_file_id']) && is_numeric($settings['company_logo_file_id'])) {
            $id = intval($settings['company_logo_file_id']);
            $proto = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
            $host = $_SERVER['HTTP_HOST'] ?? '';
            $base = rtrim(dirname($_SERVER['SCRIPT_NAME']), '/');
            $settings['company_logo_url'] = $proto . '://' . $host . $base . '/get_file.php?id=' . $id;
        }
    }

    echo json_encode(['success' => true, 'data' => $settings]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Failed to fetch settings.']);
    exit;
}
