<?php
// Safe migration runner: adds `employee` and `page` columns to `orders` if they don't already exist.
// Usage: php migrations/20260218_add_orders_employee_page.php

require_once __DIR__ . '/../config.php';

try {
    $pdo = new PDO(
        "mysql:host=" . DB_HOST . ";dbname=" . DB_NAME . ";charset=utf8mb4",
        DB_USER,
        defined('DB_PASS') ? DB_PASS : '',
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
    );
} catch (Exception $e) {
    echo "DB connection failed: " . $e->getMessage() . "\n";
    exit(1);
}

function column_exists($pdo, $table, $column) {
    $db = $pdo->query('SELECT DATABASE()')->fetchColumn();
    if (!$db) return false;
    $stmt = $pdo->prepare('SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ? LIMIT 1');
    $stmt->execute([$db, $table, $column]);
    return intval($stmt->fetchColumn()) > 0;
}

$table = 'orders';
$added = [];
try {
    if (!column_exists($pdo, $table, 'employee')) {
        $pdo->exec("ALTER TABLE `{$table}` ADD COLUMN `employee` VARCHAR(255) NULL AFTER `sales_office_id`");
        $added[] = 'employee';
    }
    if (!column_exists($pdo, $table, 'page')) {
        // Place `page` after `employee` if employee exists, otherwise append
        $after = column_exists($pdo, $table, 'employee') ? 'employee' : null;
        if ($after) {
            $pdo->exec("ALTER TABLE `{$table}` ADD COLUMN `page` VARCHAR(255) NULL AFTER `{$after}`");
        } else {
            $pdo->exec("ALTER TABLE `{$table}` ADD COLUMN `page` VARCHAR(255) NULL");
        }
        $added[] = 'page';
    }

    if (empty($added)) {
        echo "No changes: columns already exist.\n";
    } else {
        echo "Added columns: " . implode(', ', $added) . "\n";
    }
    exit(0);
} catch (Exception $e) {
    echo "Migration failed: " . $e->getMessage() . "\n";
    exit(2);
}
