<?php
// Generic attendance push endpoint (ZKTeco ADMS / custom JSON)
header('Content-Type: text/plain');

require_once __DIR__ . '/../config.php';

try {
    $pdo = new PDO("mysql:host=" . DB_HOST . ";dbname=" . DB_NAME . ";charset=utf8mb4", DB_USER, DB_PASS);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
} catch (PDOException $e) {
    http_response_code(500);
    echo "DB_ERROR";
    exit;
}

$sn = $_GET['SN'] ?? $_POST['SN'] ?? null;
$deviceId = null;
if ($sn) {
    $stmt = $pdo->prepare("SELECT id FROM attendance_devices WHERE serial_number = ? LIMIT 1");
    $stmt->execute([$sn]);
    $deviceId = $stmt->fetchColumn() ?: null;
}

if (!$deviceId) {
    $ip = $_SERVER['REMOTE_ADDR'] ?? null;
    if ($ip) {
        $stmt = $pdo->prepare("SELECT id FROM attendance_devices WHERE ip = ? LIMIT 1");
        $stmt->execute([$ip]);
        $deviceId = $stmt->fetchColumn() ?: null;
    }
}

$raw = file_get_contents('php://input');
$insert = $pdo->prepare("INSERT INTO attendance_logs (employee_id, device_id, device_user_id, check_time, direction, source, raw_payload) VALUES (?, ?, ?, ?, ?, ?, ?)");
$mapStmt = $pdo->prepare("SELECT employee_id FROM attendance_device_users WHERE device_id = ? AND device_user_id = ? LIMIT 1");

$inserted = 0;

$decoded = json_decode($raw, true);
if (is_array($decoded) && isset($decoded['logs']) && is_array($decoded['logs'])) {
    foreach ($decoded['logs'] as $log) {
        $deviceUserId = $log['device_user_id'] ?? $log['user_id'] ?? null;
        $checkTime = $log['check_time'] ?? $log['timestamp'] ?? null;
        if (!$deviceUserId || !$checkTime) {
            continue;
        }
        $direction = $log['direction'] ?? 'unknown';
        $employeeId = null;
        if ($deviceId && $deviceUserId) {
            $mapStmt->execute([$deviceId, $deviceUserId]);
            $employeeId = $mapStmt->fetchColumn() ?: null;
        }
        $insert->execute([
            $employeeId,
            $deviceId,
            $deviceUserId,
            $checkTime,
            $direction,
            'push-json',
            json_encode($log)
        ]);
        $inserted++;
    }
    echo "OK";
    exit;
}

// ZKTeco ADMS: table=ATTLOG with TSV lines
$table = $_GET['table'] ?? $_POST['table'] ?? '';
if (strtoupper($table) === 'ATTLOG' && !empty($raw)) {
    $lines = preg_split('/\r\n|\r|\n/', $raw);
    foreach ($lines as $line) {
        $line = trim($line);
        if ($line === '') {
            continue;
        }
        $parts = preg_split('/\t|,/', $line);
        $deviceUserId = $parts[0] ?? null;
        $checkTime = $parts[1] ?? null;
        if (!$deviceUserId || !$checkTime) {
            continue;
        }
        $employeeId = null;
        if ($deviceId && $deviceUserId) {
            $mapStmt->execute([$deviceId, $deviceUserId]);
            $employeeId = $mapStmt->fetchColumn() ?: null;
        }
        $insert->execute([
            $employeeId,
            $deviceId,
            $deviceUserId,
            $checkTime,
            'unknown',
            'adms',
            $line
        ]);
        $inserted++;
    }
    echo "OK";
    exit;
}

echo "OK";
