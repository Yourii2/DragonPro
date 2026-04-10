<?php
require_once __DIR__ . '/../config.php';

try {
    $pdo = new PDO("mysql:host=" . DB_HOST . ";dbname=" . DB_NAME . ";charset=utf8mb4", DB_USER, DB_PASS);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
} catch (PDOException $e) {
    echo "DB connection failed: " . $e->getMessage() . PHP_EOL; exit(1);
}

$adminUserId = 1;

try {
    $modules = $pdo->query("SELECT id FROM permission_modules")->fetchAll(PDO::FETCH_COLUMN);
    $actions = $pdo->query("SELECT id FROM permission_actions")->fetchAll(PDO::FETCH_COLUMN);

    if (empty($modules) || empty($actions)) {
        echo "No modules or actions found. Run scripts/seed_permissions.php first.\n";
        exit(1);
    }

    $pdo->beginTransaction();
    $insert = $pdo->prepare("INSERT INTO user_permissions (user_id, module_id, action_id, allowed) VALUES (?, ?, ?, 1) ON DUPLICATE KEY UPDATE allowed = 1");
    foreach ($modules as $mid) {
        foreach ($actions as $aid) {
            $insert->execute([$adminUserId, $mid, $aid]);
        }
    }
    $pdo->commit();
    echo "Granted all permissions to user_id={$adminUserId}.\n";
} catch (Exception $e) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    echo "Failed to grant permissions: " . $e->getMessage() . PHP_EOL;
    exit(1);
}

?>
