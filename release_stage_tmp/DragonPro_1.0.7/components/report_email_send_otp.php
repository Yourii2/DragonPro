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

$input = json_decode(file_get_contents('php://input'), true);
$email = trim($input['email'] ?? '');
if (!$email) { http_response_code(400); echo json_encode(['success'=>false,'message'=>'Email required.']); exit; }

// Ensure table exists
$pdo->exec("CREATE TABLE IF NOT EXISTS report_email_otps (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    email VARCHAR(255) NOT NULL,
    code VARCHAR(10) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME NOT NULL,
    verified_at DATETIME NULL,
    INDEX(user_id),
    INDEX(email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

// block resending until verified
$stmt = $pdo->prepare("SELECT id FROM report_email_otps WHERE user_id = ? AND email = ? AND verified_at IS NULL LIMIT 1");
$stmt->execute([$uid, $email]);
if ($stmt->rowCount() > 0) {
    echo json_encode(['success'=>false,'message'=>'تم إرسال الكود مسبقاً. يرجى إدخال الكود.']);
    exit;
}

$code = strval(random_int(100000, 999999));
$expires = (new DateTime('+10 minutes'))->format('Y-m-d H:i:s');
$ins = $pdo->prepare("INSERT INTO report_email_otps (user_id, email, code, expires_at) VALUES (?, ?, ?, ?)");
$ins->execute([$uid, $email, $code, $expires]);

$subject = 'كود التحقق - التقارير اليومية';
$body = "كود التحقق الخاص بك هو: {$code}\nصالح لمدة 10 دقائق.";
$sent = smtp_send_mail($email, $subject, $body);

if (!$sent) {
    http_response_code(500);
    echo json_encode(['success'=>false,'message'=>'فشل إرسال البريد.']);
    exit;
}

echo json_encode(['success'=>true]);
