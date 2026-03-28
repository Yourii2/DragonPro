<?php
require_once __DIR__ . '/../config.php';
// Usage CLI: php set_admin_password.php <new_password> [username_or_id] [grant_permissions=true]
// Usage HTTP POST: new_password, username_or_id, grant_permissions=true
try {
    $pdo = new PDO("mysql:host=" . DB_HOST . ";dbname=" . DB_NAME . ";charset=utf8mb4", DB_USER, DB_PASS, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC]);

    // Input
    $new = null;
    $who = null;
    $grant_perms = false;
    if (PHP_SAPI === 'cli') {
        global $argv;
        $new = $argv[1] ?? null;
        $who = $argv[2] ?? null;
        $grant_perms = isset($argv[3]) && strtolower($argv[3]) === 'true';
    } else {
        $new = $_POST['new_password'] ?? null;
        $who = $_POST['username_or_id'] ?? null;
        $grant_perms = isset($_POST['grant_permissions']) && strtolower($_POST['grant_permissions']) === 'true';
    }

    if (empty($new)) {
        throw new Exception('New password is required.');
    }

    $hash = password_hash($new, PASSWORD_DEFAULT);

    // Update password
    $userId = null;
    if ($who !== null && $who !== '') {
        if (ctype_digit((string)$who)) {
            $stmt = $pdo->prepare('UPDATE users SET password = ? WHERE id = ?');
            $stmt->execute([$hash, $who]);
            $userId = intval($who);
        } else {
            $stmt = $pdo->prepare('UPDATE users SET password = ? WHERE username = ?');
            $stmt->execute([$hash, (string)$who]);
            $stmt = $pdo->prepare('SELECT id FROM users WHERE username = ? LIMIT 1');
            $stmt->execute([(string)$who]);
            $u = $stmt->fetch(PDO::FETCH_ASSOC);
            $userId = $u ? intval($u['id']) : null;
        }
    } else {
        // Default admin
        $check = $pdo->query("SELECT id FROM users WHERE role = 'admin' ORDER BY id ASC LIMIT 1");
        $found = $check->fetch(PDO::FETCH_ASSOC);
        $userId = $found ? intval($found['id']) : 1;
        $stmt = $pdo->prepare('UPDATE users SET password = ? WHERE id = ?');
        $stmt->execute([$hash, $userId]);
    }

    $rows = $stmt->rowCount();
    echo "Password updated for {$rows} user(s). User ID: {$userId}\n";

    // Grant permissions if requested
    if ($grant_perms && $userId) {
        $modules = $pdo->query("SELECT id FROM permission_modules")->fetchAll(PDO::FETCH_COLUMN);
        $actions = $pdo->query("SELECT id FROM permission_actions")->fetchAll(PDO::FETCH_COLUMN);

        if (empty($modules) || empty($actions)) {
            echo "No modules/actions. Run seed_permissions.php first.\n";
        } else {
            $pdo->beginTransaction();
            $insert = $pdo->prepare("INSERT INTO user_permissions (user_id, module_id, action_id, allowed) VALUES (?, ?, ?, 1) ON DUPLICATE KEY UPDATE allowed = 1");
            foreach ($modules as $mid) {
                foreach ($actions as $aid) {
                    $insert->execute([$userId, $mid, $aid]);
                }
            }
            $pdo->commit();
            echo "Granted all permissions to user_id={$userId}.\n";
        }
    }
} catch (Exception $e) {
    echo 'ERROR: ' . $e->getMessage() . "\n";
}
?>

