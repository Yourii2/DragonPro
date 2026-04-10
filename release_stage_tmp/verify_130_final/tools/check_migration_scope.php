<?php
require __DIR__ . '/../config.php';
$pdo = new PDO('mysql:host='.DB_HOST.';dbname='.DB_NAME.';charset=utf8mb4', DB_USER, DB_PASS, [PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);

// All tables that reference products
$tables = ['stock','order_items','product_movements','receiving_items','return_items','transfer_items','audit_items','inventory_movements'];
foreach ($tables as $t) {
    $ex = $pdo->query("SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='$t'")->fetchColumn();
    if ($ex) {
        echo "$t: EXISTS\n";
        $cols = $pdo->query("SHOW COLUMNS FROM $t")->fetchAll(PDO::FETCH_COLUMN);
        echo '  cols: ' . implode(',', $cols) . "\n";
        $cnt = $pdo->query("SELECT COUNT(*) FROM $t")->fetchColumn();
        echo "  rows: $cnt\n";
    } else {
        echo "$t: NOT EXISTS\n";
    }
}

// How many products total, unique names
$tot = $pdo->query('SELECT COUNT(*) FROM products')->fetchColumn();
$uniq = $pdo->query('SELECT COUNT(DISTINCT name) FROM products')->fetchColumn();
echo "\nproducts total: $tot, unique names (potential parents): $uniq\n";

// Show duplicate names
echo "\n=== Products with same name (will become variants of same parent) ===\n";
$stmt = $pdo->query("SELECT name, COUNT(*) as cnt FROM products GROUP BY name HAVING cnt > 1 ORDER BY cnt DESC");
$rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
if (empty($rows)) {
    echo "  None — each name is unique\n";
} else {
    foreach ($rows as $r) echo "  '{$r['name']}' — {$r['cnt']} variants\n";
}
