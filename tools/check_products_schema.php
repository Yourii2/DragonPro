<?php
require __DIR__ . '/../config.php';
$pdo = new PDO('mysql:host='.DB_HOST.';dbname='.DB_NAME.';charset=utf8mb4', DB_USER, DB_PASS, [PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);

echo "=== products table ===\n";
$cols = $pdo->query('SHOW COLUMNS FROM products')->fetchAll(PDO::FETCH_ASSOC);
foreach ($cols as $c) echo "  {$c['Field']} | {$c['Type']} | null:{$c['Null']} | default:{$c['Default']}\n";

echo "\n=== sample products (5) ===\n";
$rows = $pdo->query('SELECT * FROM products LIMIT 5')->fetchAll(PDO::FETCH_ASSOC);
echo json_encode($rows, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT)."\n";

// Check if product_variants table exists
$exists = $pdo->query("SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='product_variants'")->fetchColumn();
echo "\nproduct_variants table exists: $exists\n";

// Check order_items table
echo "\n=== order_items table ===\n";
try {
    $cols2 = $pdo->query('SHOW COLUMNS FROM order_items')->fetchAll(PDO::FETCH_ASSOC);
    foreach ($cols2 as $c) echo "  {$c['Field']} | {$c['Type']}\n";
    $sample = $pdo->query('SELECT * FROM order_items LIMIT 3')->fetchAll(PDO::FETCH_ASSOC);
    echo json_encode($sample, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT)."\n";
} catch(Exception $e) { echo "  No order_items table\n"; }

// Check inventory/stock table
foreach (['inventory_items','stock','product_stock','inventory'] as $t) {
    $ex = $pdo->query("SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='$t'")->fetchColumn();
    if ($ex) {
        echo "\n=== $t table ===\n";
        $c = $pdo->query("SHOW COLUMNS FROM $t")->fetchAll(PDO::FETCH_ASSOC);
        foreach ($c as $col) echo "  {$col['Field']} | {$col['Type']}\n";
    }
}
