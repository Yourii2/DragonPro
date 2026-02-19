<?php
$host = 'localhost';
$db = '998877';
$user = 'root';
$pass = 'Bad220020!@#';
$uid = 1;
try {
    $pdo = new PDO("mysql:host=$host;dbname=$db;charset=utf8mb4", $user, $pass, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC]);
    $stmt = $pdo->prepare("SELECT COUNT(*) as c FROM user_permissions WHERE user_id = ?");
    $stmt->execute([$uid]);
    $r = $stmt->fetch();
    echo "user_permissions_count:" . ($r['c'] ?? 0) . "\n";

    $stmt = $pdo->prepare("SELECT up.module_id, up.action_id, up.allowed, m.name as module_name, a.code as action_code FROM user_permissions up LEFT JOIN permission_modules m ON m.id = up.module_id LEFT JOIN permission_actions a ON a.id = up.action_id WHERE up.user_id = ? LIMIT 20");
    $stmt->execute([$uid]);
    $rows = $stmt->fetchAll();
    echo "sample_rows:" . json_encode($rows, JSON_UNESCAPED_UNICODE) . "\n";

    $stmt = $pdo->prepare("SELECT permissions FROM users WHERE id = ? LIMIT 1");
    $stmt->execute([$uid]);
    $r = $stmt->fetch();
    echo "users.permissions:" . ($r['permissions'] ?? 'NULL') . "\n";

} catch (Exception $e) {
    echo 'ERROR: ' . $e->getMessage() . "\n";
}
?>