<?php
if (php_sapi_name() !== 'cli') { echo "Run from CLI\n"; exit(1); }
if ($argc < 4) { echo "Usage: php apply_rep_attr_migration.php <rep_id> <from YYYY-MM-DD> <to YYYY-MM-DD>\n"; exit(1); }
$repId = intval($argv[1]);
$from = $argv[2];
$to = $argv[3];
require_once __DIR__ . '/../config.php';
try {
    $pdo = new PDO("mysql:host=".DB_HOST.";dbname=".DB_NAME.";charset=utf8mb4", DB_USER, defined('DB_PASS')?DB_PASS:'', [PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);
} catch (Exception $e) { echo "DB conn failed: " . $e->getMessage() . "\n"; exit(1); }

// Check history table and created_at column
$histExists = (bool)$pdo->query("SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'order_status_history'")->fetchColumn();
if (!$histExists) { echo "order_status_history table missing - cannot proceed.\n"; exit(1); }
$colStmt = $pdo->prepare("SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'order_status_history' AND COLUMN_NAME = 'created_at'");
$colStmt->execute();
$hasCreatedAt = intval($colStmt->fetchColumn()) > 0;
if (!$hasCreatedAt) { echo "order_status_history.created_at column missing - cannot proceed.\n"; exit(1); }

// Determine time range (inclusive start, inclusive end -> make end exclusive by +1 day)
$from_ts = $from . ' 00:00:00';
$to_ts_excl = date('Y-m-d', strtotime($to . ' +1 day')) . ' 00:00:00';

$dateCol = null;
foreach (['updated_at','created_at','date'] as $c) {
        $stmt = $pdo->prepare("SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'orders' AND COLUMN_NAME = ?");
        $stmt->execute([$c]);
        if (intval($stmt->fetchColumn()) > 0) { $dateCol = $c; break; }
}
if (!$dateCol) { echo "No timestamp column found on orders table.\n"; exit(1); }

// Find candidate orders: delivered in range and without a delivered history row by this rep
$sel = $pdo->prepare(
        "SELECT o.id, o.order_number, COALESCE(o.".$dateCol.", NOW()) AS event_at
         FROM orders o
         WHERE o.status = 'delivered'
             AND COALESCE(o.".$dateCol.", NOW()) >= ?
             AND COALESCE(o.".$dateCol.", NOW()) < ?
             AND NOT EXISTS (SELECT 1 FROM order_status_history h WHERE h.order_id = o.id AND h.status = 'delivered' AND h.rep_id = ?)
         ORDER BY COALESCE(o.".$dateCol.", NOW()) ASC"
);
$sel->execute([$from_ts, $to_ts_excl, $repId]);
$rows = $sel->fetchAll(PDO::FETCH_ASSOC);
if (empty($rows)) { echo "No candidate orders found for rep {$repId} in range {$from} to {$to}. Nothing to do.\n"; exit(0); }

echo "Found " . count($rows) . " candidate delivered orders to attribute to rep {$repId}:\n";
foreach ($rows as $r) { echo "  id={$r['id']} num={$r['order_number']} event_at={$r['event_at']}\n"; }

// Proceed to insert history rows
try {
    $pdo->beginTransaction();
    $insSql = "INSERT INTO order_status_history (order_id, status, action, notes, rep_id, created_by, created_at) \n".
              "SELECT o.id, 'delivered', 'status_migration', CONCAT('retroactive attribution to rep ', ?), ?, NULL, COALESCE(o.".$dateCol.", NOW()) \n".
              "FROM orders o \n".
              "WHERE o.status = 'delivered' \n".
              "  AND COALESCE(o.".$dateCol.", NOW()) >= ? \n".
              "  AND COALESCE(o.".$dateCol.", NOW()) < ? \n".
              "  AND NOT EXISTS (SELECT 1 FROM order_status_history h WHERE h.order_id = o.id AND h.status = 'delivered' AND h.rep_id = ?)";

    $stmt = $pdo->prepare($insSql);
    $stmt->execute([$repId, $repId, $from_ts, $to_ts_excl, $repId]);
    $inserted = $stmt->rowCount();
    $pdo->commit();
    echo "Inserted {$inserted} history rows attributing delivered orders to rep {$repId}.\n";
} catch (Exception $e) {
    $pdo->rollBack();
    echo "Migration failed: " . $e->getMessage() . "\n";
    exit(1);
}

echo "Done.\n";
exit(0);
