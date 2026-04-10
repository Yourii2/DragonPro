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

$uid = $_SESSION['user_id'] ?? 0;
if (!$uid) { http_response_code(403); echo json_encode(['success'=>false,'message'=>'Authentication required.']); exit; }

$input = json_decode(file_get_contents('php://input'), true);
$email = trim($input['email'] ?? '');
$code = trim($input['code'] ?? '');
if (!$email || !$code) { http_response_code(400); echo json_encode(['success'=>false,'message'=>'Email and code required.']); exit; }

$stmt = $pdo->prepare("SELECT id, expires_at FROM backup_email_otps WHERE user_id = ? AND email = ? AND code = ? AND verified_at IS NULL ORDER BY id DESC LIMIT 1");
$stmt->execute([$uid, $email, $code]);
$row = $stmt->fetch(PDO::FETCH_ASSOC);
if (!$row) {
    http_response_code(400);
    echo json_encode(['success'=>false,'message'=>'الكود غير صحيح.']);
    exit;
}

$expires = new DateTime($row['expires_at']);
if ($expires < new DateTime()) {
    http_response_code(400);
    echo json_encode(['success'=>false,'message'=>'انتهت صلاحية الكود.']);
    exit;
}

$upd = $pdo->prepare("UPDATE backup_email_otps SET verified_at = NOW() WHERE id = ?");
$upd->execute([$row['id']]);

// Mark email as verified in settings
$save = $pdo->prepare("INSERT INTO settings (config_key, config_value) VALUES ('backup_email_verified', 'true') ON DUPLICATE KEY UPDATE config_value = 'true'");
$save->execute();

$saveEmail = $pdo->prepare("INSERT INTO settings (config_key, config_value) VALUES ('backup_email', ?) ON DUPLICATE KEY UPDATE config_value = VALUES(config_value)");
$saveEmail->execute([$email]);

echo json_encode(['success'=>true]);
