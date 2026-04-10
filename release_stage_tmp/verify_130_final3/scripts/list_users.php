<?php
require_once __DIR__ . '/../config.php';
try {
    $pdo = new PDO("mysql:host=" . DB_HOST . ";dbname=" . DB_NAME . ";charset=utf8mb4", DB_USER, DB_PASS, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC]);
    $stmt = $pdo->query("SELECT id, name, username, role FROM users ORDER BY id ASC LIMIT 20");
    $rows = $stmt->fetchAll();
    echo json_encode($rows, JSON_PRETTY_PRINT|JSON_UNESCAPED_UNICODE);
} catch (Exception $e) {
    echo json_encode(['error'=>$e->getMessage()]);
}
?>