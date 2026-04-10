<?php
require __DIR__ . '/../config.php';
$pdo = new PDO('mysql:host='.DB_HOST.';dbname='.DB_NAME.';charset=utf8mb4', DB_USER, DB_PASS, [PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);

// Check order 66 full history
$rows = $pdo->query("SELECT id, order_id, status, action, rep_id, created_by, created_at FROM order_status_history WHERE order_id = 66 ORDER BY id")->fetchAll(PDO::FETCH_ASSOC);
echo "=== History for order 66 ===\n";
echo json_encode($rows, JSON_PRETTY_PRINT|JSON_UNESCAPED_UNICODE) . "\n";

// Check order 66 current state
$order = $pdo->query("SELECT id, status, rep_id FROM orders WHERE id = 66 LIMIT 1")->fetch(PDO::FETCH_ASSOC);
echo "\n=== Order 66 current state ===\n";
echo json_encode($order, JSON_PRETTY_PRINT|JSON_UNESCAPED_UNICODE) . "\n";

// Check partial_return actions today
$partial = $pdo->query("SELECT id, order_id, status, action, rep_id, created_at FROM order_status_history WHERE action IN ('partial_return','rep_clear','status') AND DATE(created_at)='2026-03-01' ORDER BY id DESC LIMIT 20")->fetchAll(PDO::FETCH_ASSOC);
echo "\n=== All partial_return/rep_clear/status actions today ===\n";
echo json_encode($partial, JSON_PRETTY_PRINT|JSON_UNESCAPED_UNICODE) . "\n";

// Check rep_return_events table
$rreHas = $pdo->query("SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='rep_return_events'")->fetchColumn();
echo "\nrep_return_events exists: " . $rreHas . "\n";
if ($rreHas) {
    $rre = $pdo->query("SELECT * FROM rep_return_events ORDER BY id DESC LIMIT 5")->fetchAll(PDO::FETCH_ASSOC);
    echo json_encode($rre, JSON_PRETTY_PRINT|JSON_UNESCAPED_UNICODE) . "\n";
}
