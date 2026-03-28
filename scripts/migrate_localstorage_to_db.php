<?php
require_once __DIR__ . '/../config.php';

$user_id = $argv[1] ?? null;
if (!$user_id) {
  echo "Usage: php migrate_localstorage_to_db.php USER_ID\n";
  exit(1);
}

$pdo = new PDO("mysql:host=" . DB_HOST . ";dbname=" . DB_NAME . ";charset=utf8mb4", DB_USER, DB_PASS, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);

// Sample migration (customize per client localStorage)
$settings = [
  // Add from client's localStorage.export()
];

$pdo->beginTransaction();
foreach ($settings as $k => $v) {
  $pdo->prepare('INSERT INTO app_settings (`key`, `value`, user_id) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE `value` = VALUES(`value`)')
    ->execute([$k, $v, $user_id]);
}
$pdo->commit();

echo "Migrated for user $user_id\n";
?>

