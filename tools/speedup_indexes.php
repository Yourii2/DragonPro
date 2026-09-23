<?php
require_once __DIR__ . '/../config.php';
$pdo = new PDO('mysql:host='.DB_HOST.';dbname='.DB_NAME.';charset=utf8mb4', DB_USER, DB_PASS, [
    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION
]);

$indexes = [
    ['table' => 'rep_journal_orders', 'name' => 'idx_rjo_status_date', 'sql' => 'ALTER TABLE rep_journal_orders ADD INDEX idx_rjo_status_date (status, event_date)'],
    ['table' => 'rep_journal_orders', 'name' => 'idx_rjo_order_status', 'sql' => 'ALTER TABLE rep_journal_orders ADD INDEX idx_rjo_order_status (order_id, status)'],
    ['table' => 'order_items', 'name' => 'idx_oi_order_prod', 'sql' => 'ALTER TABLE order_items ADD INDEX idx_oi_order_prod (order_id, product_id)'],
    ['table' => 'orders', 'name' => 'idx_orders_status_date', 'sql' => 'ALTER TABLE orders ADD INDEX idx_orders_status_date (status, created_at)'],
];

foreach ($indexes as $item) {
    try {
        $check = $pdo->query("SHOW INDEX FROM `{$item['table']}` WHERE Key_name = '{$item['name']}'")->fetch();
        if ($check) {
            echo "Index {$item['name']} already exists on {$item['table']}.\n";
        } else {
            $pdo->exec($item['sql']);
            echo "Created index {$item['name']} on {$item['table']}.\n";
        }
    } catch (Exception $e) {
        echo "Notice on {$item['name']}: " . $e->getMessage() . "\n";
    }
}
echo "Done ensuring indexes.\n";
