<?php
// Direct web-accessible migration and index runner for client installations
session_start();
header('Content-Type: text/plain; charset=utf-8');

require_once __DIR__ . '/../config.php';

if (!defined('DB_HOST') || !defined('DB_NAME') || !defined('DB_USER')) {
    echo "Error: Database configuration missing in config.php\n";
    exit(1);
}

try {
    $pdo = new PDO(
        "mysql:host=" . DB_HOST . ";dbname=" . DB_NAME . ";charset=utf8mb4",
        DB_USER,
        defined('DB_PASS') ? DB_PASS : '',
        [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        ]
    );
} catch (Exception $e) {
    echo "Database connection failed: " . $e->getMessage() . "\n";
    exit(1);
}

echo "=====================================================\n";
echo "   DragonPro — Database Migration & Index Optimizer  \n";
echo "=====================================================\n\n";

if (!function_exists('indexExists')) {
    function indexExists($pdo, $table, $index) {
        try {
            $stmt = $pdo->prepare("SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?");
            $stmt->execute([$table, $index]);
            return $stmt->fetchColumn() > 0;
        } catch (Exception $e) {
            return false;
        }
    }
}

if (!function_exists('tableExists')) {
    function tableExists($pdo, $table) {
        try {
            $stmt = $pdo->prepare("SHOW TABLES LIKE ?");
            $stmt->execute([$table]);
            return $stmt->rowCount() > 0;
        } catch (Exception $e) {
            return false;
        }
    }
}

// 1. Performance Indexes
$indexes = [
    ['orders', 'idx_orders_created_at', '`created_at`'],
    ['orders', 'idx_orders_status', '`status`'],
    ['orders', 'idx_orders_status_created', '`status`, `created_at`'],
    ['orders', 'idx_orders_customer_created', '`customer_id`, `created_at`'],
    ['orders', 'idx_orders_rep_status', '`rep_id`, `status`'],
    ['transactions', 'idx_transactions_date', '`transaction_date`'],
    ['transactions', 'idx_transactions_type_date', '`type`, `transaction_date`'],
    ['transactions', 'idx_transactions_related', '`related_to_type`, `related_to_id`'],
    ['transactions', 'idx_transactions_treasury_date', '`treasury_id`, `transaction_date`'],
    ['transactions', 'idx_tx_rep', '`related_to_type`, `related_to_id`, `amount`'],
    ['product_movements', 'idx_pm_created_at', '`created_at`'],
    ['product_movements', 'idx_pm_type_created', '`movement_type`, `created_at`'],
    ['product_movements', 'idx_pm_prod_warehouse', '`product_id`, `warehouse_id`'],
    ['customers', 'idx_customers_phone1', '`phone1`'],
    ['customers', 'idx_customers_phone2', '`phone2`'],
    ['customers', 'idx_customers_gov', '`governorate`'],
    ['rep_daily_journal', 'idx_rdj_rep_date', '`rep_id`, `journal_date`'],
    ['rep_daily_journal', 'idx_rdj_date', '`journal_date`'],
    ['rep_daily_journal', 'idx_rdj_rep_closed', '`rep_id`, `is_closed`'],
    ['rep_delivery_sessions', 'idx_rds_rep_date', '`rep_id`, `session_date`'],
    ['rep_delivery_sessions', 'idx_rds_date', '`session_date`'],
    ['order_status_history', 'idx_osh_order_created', '`order_id`, `created_at`'],
    ['order_status_history', 'idx_osh_order_status', '`order_id`, `status`, `created_at`'],
    ['order_confirmation_assignments', 'idx_oca_rep_assigned', '`rep_id`, `status`, `assigned_at`'],
    ['rep_journal_orders', 'idx_rjo_rep_journal', '`rep_id`, `journal_id`, `status`'],
    ['order_items', 'idx_order_items_order_id', '`order_id`'],
    ['order_items', 'idx_order_items_product_id', '`product_id`'],
];

echo "[1/2] Checking and creating Performance Indexes...\n";
foreach ($indexes as $idx) {
    [$tbl, $idxName, $cols] = $idx;
    if (!tableExists($pdo, $tbl)) {
        echo "  - Table `$tbl` does not exist. Skipping.\n";
        continue;
    }
    if (!indexExists($pdo, $tbl, $idxName)) {
        try {
            $pdo->exec("ALTER TABLE `$tbl` ADD INDEX `$idxName` ($cols)");
            echo "  ✅ Created index `$idxName` on table `$tbl` ($cols)\n";
        } catch (Exception $e) {
            echo "  ⚠️ Could not add index `$idxName` on `$tbl`: " . $e->getMessage() . "\n";
        }
    } else {
        echo "  ℹ️ Index `$idxName` on table `$tbl` is already ACTIVE.\n";
    }
}

// 2. Also run the main migrations runner file if available
echo "\n[2/2] Running main migrations script...\n";
$mainRunner = __DIR__ . '/../migrations/run_updates.php';
if (file_exists($mainRunner)) {
    ob_start();
    try {
        include $mainRunner;
        $out = ob_get_clean();
        echo $out;
    } catch (Exception $e) {
        ob_end_clean();
        echo "  Warning during run_updates include: " . $e->getMessage() . "\n";
    }
} else {
    echo "  migrations/run_updates.php not found.\n";
}

echo "\n=====================================================\n";
echo "   Optimization & Migration Completed Successfully!  \n";
echo "=====================================================\n";
