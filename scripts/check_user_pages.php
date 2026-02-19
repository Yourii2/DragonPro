<?php
require_once __DIR__ . '/../config.php';
try {
    $pdo = new PDO("mysql:host=" . DB_HOST . ";dbname=" . DB_NAME . ";charset=utf8mb4", DB_USER, DB_PASS, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC]);
    $uid = 1;
    $stmt = $pdo->prepare("SELECT page_slug, can_access FROM user_page_permissions WHERE user_id = ?");
    $stmt->execute([$uid]);
    $rows = $stmt->fetchAll();
    echo json_encode(['user_id'=>$uid,'count'=>count($rows),'rows'=>$rows], JSON_UNESCAPED_UNICODE|JSON_PRETTY_PRINT);
} catch (Exception $e) {
    echo json_encode(['error'=>$e->getMessage()]);
}
?>