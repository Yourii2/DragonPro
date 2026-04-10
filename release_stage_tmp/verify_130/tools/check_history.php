<?php
require __DIR__ . '/../config.php';
$pdo = new PDO('mysql:host='.DB_HOST.';dbname='.DB_NAME.';charset=utf8mb4', DB_USER, DB_PASS, [PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);
$has = $pdo->query("SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='order_status_history'")->fetchColumn();
echo 'history_table_exists: ' . $has . PHP_EOL;
if ($has) {
    $cols = $pdo->query("SHOW COLUMNS FROM order_status_history")->fetchAll(PDO::FETCH_COLUMN);
    echo 'columns: ' . implode(', ', $cols) . PHP_EOL;
    $rows = $pdo->query("SELECT id, order_id, status, action, rep_id, created_at FROM order_status_history WHERE status='returned' ORDER BY id DESC LIMIT 5")->fetchAll(PDO::FETCH_ASSOC);
    echo 'recent_returned: ' . json_encode($rows, JSON_PRETTY_PRINT|JSON_UNESCAPED_UNICODE) . PHP_EOL;
} else {
    echo "No order_status_history table." . PHP_EOL;
}
