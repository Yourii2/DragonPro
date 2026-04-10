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
require_once __DIR__ . '/smtp_mail.php';

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

$settings = [];
try {
    $stmt = $pdo->query("SELECT config_key, config_value FROM settings");
    $settings = $stmt->fetchAll(PDO::FETCH_KEY_PAIR);
} catch (Exception $e) { $settings = []; }

$email = $settings['report_email'] ?? '';
$verified = ($settings['report_email_verified'] ?? 'false') === 'true';
if (!$email || !$verified) {
    http_response_code(400);
    echo json_encode(['success'=>false,'message'=>'البريد غير مؤكد.']);
    exit;
}

$today = date('Y-m-d');
$sections = [];

if (($settings['report_daily_sales'] ?? 'false') === 'true' || ($settings['report_daily_sales'] ?? '') === '1') {
    $stmt = $pdo->prepare("SELECT COUNT(*) as cnt, COALESCE(SUM(total_amount),0) as total FROM orders WHERE DATE(created_at) = ?");
    $stmt->execute([$today]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);

    $stmt2 = $pdo->prepare("SELECT status, COUNT(*) as c FROM orders WHERE DATE(created_at) = ? GROUP BY status");
    $stmt2->execute([$today]);
    $statusRows = $stmt2->fetchAll(PDO::FETCH_ASSOC);
    $statusText = '';
    foreach ($statusRows as $sr) {
        $statusText .= "- {$sr['status']}: {$sr['c']}\n";
    }

    $sections[] = "تقرير المبيعات اليومي\nالطلبات: {$row['cnt']}\nإجمالي المبيعات: {$row['total']}\nالحالات:\n{$statusText}";
}

if (($settings['report_daily_treasury'] ?? 'false') === 'true' || ($settings['report_daily_treasury'] ?? '') === '1') {
    $stmt = $pdo->prepare("SELECT t.treasury_id, tr.name, COALESCE(SUM(t.amount),0) as total FROM transactions t LEFT JOIN treasuries tr ON t.treasury_id = tr.id WHERE DATE(t.transaction_date) = ? GROUP BY t.treasury_id, tr.name");
    $stmt->execute([$today]);
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
    $lines = [];
    foreach ($rows as $r) {
        $lines[] = "- {$r['name']}: {$r['total']}";
    }
    $sections[] = "تقرير الخزينة اليومي\n" . implode("\n", $lines);
}

if (($settings['report_daily_audit'] ?? 'false') === 'true' || ($settings['report_daily_audit'] ?? '') === '1') {
    $pdo->exec("CREATE TABLE IF NOT EXISTS audit_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NULL,
        module VARCHAR(100) NOT NULL,
        action VARCHAR(100) NOT NULL,
        record_id INT NULL,
        details TEXT NULL,
        ip_address VARCHAR(64) NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX(user_id),
        INDEX(module),
        INDEX(action),
        INDEX(created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    $stmt = $pdo->prepare("SELECT module, action, record_id, created_at FROM audit_logs WHERE DATE(created_at) = ? ORDER BY created_at DESC LIMIT 200");
    $stmt->execute([$today]);
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
    $lines = [];
    foreach ($rows as $r) {
        $lines[] = "- [{$r['created_at']}] {$r['module']} :: {$r['action']} (id={$r['record_id']})";
    }
    $sections[] = "تقرير العمليات اليومية\n" . implode("\n", $lines);
}

if (count($sections) === 0) {
    echo json_encode(['success'=>false,'message'=>'لم يتم تفعيل أي نوع تقرير.']);
    exit;
}

$body = "تقرير يومي - {$today}\n\n" . implode("\n\n----------------\n\n", $sections);
$sent = smtp_send_mail($email, 'Dragon Daily Report - ' . $today, $body);

if (!$sent) {
    http_response_code(500);
    echo json_encode(['success'=>false,'message'=>'Failed to send email.']);
    exit;
}

echo json_encode(['success'=>true]);
