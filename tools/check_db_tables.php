<?php
require_once __DIR__ . '/../config.php';
header('Content-Type: application/json');
$result = ['success' => false, 'checked' => [], 'error' => null];
try {
    $dsn = "mysql:host=" . DB_HOST . ";dbname=" . DB_NAME . ";charset=utf8mb4";
    $pdo = new PDO($dsn, DB_USER, DB_PASS, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
    $tables = ['app_settings', 'settings', 'app_files'];
    foreach ($tables as $t) {
        $stmt = $pdo->prepare("SHOW TABLES LIKE ?");
        $stmt->execute([$t]);
        $exists = (bool)$stmt->fetch();
        $count = null;
        if ($exists) {
            $cstmt = $pdo->query("SELECT COUNT(*) AS c FROM `" . $t . "`");
            $crow = $cstmt->fetch(PDO::FETCH_ASSOC);
            $count = isset($crow['c']) ? (int)$crow['c'] : null;
        }
        $result['checked'][$t] = ['exists' => $exists, 'rows' => $count];
    }
    $result['success'] = true;
} catch (Exception $e) {
    $result['error'] = $e->getMessage();
}
echo json_encode($result, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
