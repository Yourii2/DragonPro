<?php
// CLI test: find an order assigned to a rep, update its status to delivered, then call getRepDailyStats
if (php_sapi_name() !== 'cli') { echo "Run from CLI\n"; exit(1); }
require_once __DIR__ . '/../config.php';
try {
    $pdo = new PDO("mysql:host=".DB_HOST.";dbname=".DB_NAME.";charset=utf8mb4", DB_USER, defined('DB_PASS')?DB_PASS:'', [PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);
} catch (Exception $e) { echo "DB conn failed: " . $e->getMessage() . "\n"; exit(1); }

// Find a rep-assigned order
$col = null;
$colsToCheck = ['updated_at','created_at','date'];
foreach ($colsToCheck as $c) {
    $res = $pdo->query("SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'orders' AND COLUMN_NAME = '".$c."'")->fetchColumn();
    if ($res && intval($res) > 0) { $col = $c; break; }
}
$selectCols = 'id, rep_id, status';
if ($col) $selectCols .= ', ' . $col;
$stmt = $pdo->query("SELECT $selectCols FROM orders WHERE rep_id IS NOT NULL ORDER BY id DESC LIMIT 1");
$row = $stmt->fetch(PDO::FETCH_ASSOC);
if (!$row) { echo "No orders with rep_id found.\n"; exit(0); }
$orderId = intval($row['id']);
$repId = intval($row['rep_id']);
$prevStatus = $row['status'];
$prevUpdated = $row['updated_at'];
echo "Found order $orderId for rep $repId (status=$prevStatus, updated_at=$prevUpdated)\n";

// Update status to delivered and set available timestamp column if present
$pdo->beginTransaction();
try {
    if ($col) {
        $pdo->exec("UPDATE orders SET status = 'delivered', $col = NOW() WHERE id = $orderId");
    } else {
        $pdo->exec("UPDATE orders SET status = 'delivered' WHERE id = $orderId");
    }
    // insert into order_status_history if exists
    $hasHist = (bool)$pdo->query("SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'order_status_history'")->fetchColumn();
    // Skip inserting into order_status_history to avoid schema-specific required columns.
    $pdo->commit();
    echo "Order $orderId updated to delivered.\n";
} catch (Exception $e) {
    $pdo->rollBack();
    echo "Update failed: " . $e->getMessage() . "\n";
    exit(1);
}

// Now include api.php to call getRepDailyStats for this rep for today
echo "Calling getRepDailyStats for rep $repId...\n";
$_GET = ['module'=>'sales','action'=>'getRepDailyStats','rep_id'=>$repId,'date'=>date('Y-m-d')];
require_once __DIR__ . '/../components/api.php';
