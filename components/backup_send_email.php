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

$email = $settings['backup_email'] ?? '';
$verified = ($settings['backup_email_verified'] ?? 'false') === 'true';
if (!$email || !$verified) {
    http_response_code(400);
    echo json_encode(['success'=>false,'message'=>'البريد غير مؤكد.']);
    exit;
}

function escape_cmd_arg($arg) {
    if (stripos(PHP_OS_FAMILY, 'Windows') !== false) {
        $arg = str_replace('"', '\\"', $arg);
        return '"' . str_replace('%', '%%', $arg) . '"';
    }
    return escapeshellarg($arg);
}

function find_bin($name) {
    $candidates = [
        __DIR__ . '/../mysql/bin/' . $name,
        'C:/xampp/mysql/bin/' . $name,
        '/usr/bin/' . $name,
        '/usr/local/bin/' . $name
    ];
    foreach ($candidates as $c) {
        if (file_exists($c)) return $c;
    }
    return null;
}

$dumpBin = find_bin('mysqldump' . (stripos(PHP_OS_FAMILY, 'Windows') !== false ? '.exe' : ''));
if (!$dumpBin) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'mysqldump not found.']);
    exit;
}

$backupDir = __DIR__ . '/../backups';
if (!is_dir($backupDir)) { @mkdir($backupDir, 0777, true); }

$fileName = 'Dragon_backup_' . date('Ymd_His') . '.sql';
$targetFile = $backupDir . DIRECTORY_SEPARATOR . $fileName;
$cmd = escape_cmd_arg($dumpBin)
    . ' --host=' . escape_cmd_arg(DB_HOST)
    . ' --user=' . escape_cmd_arg(DB_USER)
    . (DB_PASS !== '' ? ' --password=' . escape_cmd_arg(DB_PASS) : '')
    . ' --routines --triggers --single-transaction '
    . escape_cmd_arg(DB_NAME)
    . ' > ' . escape_cmd_arg($targetFile);

$exitCode = 0;
@exec($cmd, $output, $exitCode);
if ($exitCode !== 0 || !file_exists($targetFile)) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Failed to create backup.']);
    exit;
}

$sent = smtp_send_mail($email, 'Dragon Backup - ' . date('Y-m-d H:i'), 'Backup attached.', $targetFile, $fileName);
if (!$sent) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Failed to send email.']);
    exit;
}

echo json_encode(['success'=>true]);
