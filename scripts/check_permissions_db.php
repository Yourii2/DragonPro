<?php
$host = 'localhost';
$db = '998877';
$user = 'root';
$pass = 'Bad220020!@#';
try {
    $pdo = new PDO("mysql:host=$host;dbname=$db;charset=utf8mb4", $user, $pass, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
    $tables = ['permission_modules','permission_actions','user_permissions','user_page_permissions','user_defaults'];
    foreach ($tables as $t) {
        $stmt = $pdo->prepare("SELECT COUNT(*) as c FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?");
        $stmt->execute([$db, $t]);
        $r = $stmt->fetch(PDO::FETCH_ASSOC);
        echo "$t:" . ((isset($r['c']) && intval($r['c'])>0) ? 'yes' : 'no') . "\n";
    }
} catch (Exception $e) {
    echo 'ERROR: ' . $e->getMessage() . "\n";
}
?>