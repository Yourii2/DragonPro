<?php
session_start();

// CORS
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if ($origin) header('Access-Control-Allow-Origin: ' . $origin);
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Access-Control-Allow-Credentials: true');

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

$uid = $_SESSION['user_id'] ?? 0;
if (!$uid) {
    http_response_code(403);
    echo json_encode(['success' => false, 'message' => 'Authentication required.']);
    exit;
}

// Permission check: settings page access or settings module permissions
$allowed = false;
try {
    $stmt = $pdo->prepare("SELECT can_access FROM user_page_permissions WHERE user_id = ? AND page_slug = 'settings' LIMIT 1");
    $stmt->execute([$uid]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    if ($row && intval($row['can_access']) === 1) $allowed = true;
} catch (Exception $e) {
    $allowed = false;
}
if (!$allowed) {
    try {
        $mod = $pdo->prepare("SELECT id FROM permission_modules WHERE name = 'settings' LIMIT 1");
        $mod->execute();
        $mid = $mod->fetchColumn();
        $act = $pdo->prepare("SELECT id FROM permission_actions WHERE code = 'view' LIMIT 1");
        $act->execute();
        $aid = $act->fetchColumn();
        if ($mid && $aid) {
            $p = $pdo->prepare("SELECT allowed FROM user_permissions WHERE user_id = ? AND module_id = ? AND action_id = ? LIMIT 1");
            $p->execute([$uid, $mid, $aid]);
            if ($p->rowCount() > 0 && intval($p->fetchColumn()) === 1) $allowed = true;
        }
    } catch (Exception $e) {
        $allowed = false;
    }
}

if (!$allowed) {
    http_response_code(403);
    echo json_encode(['success' => false, 'message' => 'Insufficient permissions.']);
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

$tmpFile = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'Dragon_backup_' . date('Ymd_His') . '.sql';
$cmd = escape_cmd_arg($dumpBin)
    . ' --host=' . escape_cmd_arg(DB_HOST)
    . ' --user=' . escape_cmd_arg(DB_USER)
    . (DB_PASS !== '' ? ' --password=' . escape_cmd_arg(DB_PASS) : '')
    . ' --routines --triggers --single-transaction '
    . escape_cmd_arg(DB_NAME)
    . ' > ' . escape_cmd_arg($tmpFile);

$exitCode = 0;
@exec($cmd, $output, $exitCode);
if ($exitCode !== 0 || !file_exists($tmpFile)) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Failed to create backup.']);
    exit;
}

$filename = 'Dragon_backup_' . date('Ymd_His') . '.sql';
header('Content-Type: application/sql');
header('Content-Disposition: attachment; filename="' . $filename . '"');
header('Content-Length: ' . filesize($tmpFile));
readfile($tmpFile);
@unlink($tmpFile);
exit;
