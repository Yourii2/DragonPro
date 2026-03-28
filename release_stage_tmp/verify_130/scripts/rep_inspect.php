<?php
if (php_sapi_name() !== 'cli') { echo "Run from CLI\n"; exit(1); }
if ($argc < 4) { echo "Usage: php rep_inspect.php <rep_id> <from YYYY-MM-DD> <to YYYY-MM-DD>\n"; exit(1); }
$repId = intval($argv[1]);
$from = $argv[2];
$to = $argv[3];
require_once __DIR__ . '/../config.php';
try {
    $pdo = new PDO("mysql:host=".DB_HOST.";dbname=".DB_NAME.";charset=utf8mb4", DB_USER, defined('DB_PASS')?DB_PASS:'', [PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);
} catch (Exception $e) { echo "DB conn failed: " . $e->getMessage() . "\n"; exit(1); }

// detect timestamp column
$dateCol = null;
foreach (['updated_at','created_at','date'] as $c) {
    $stmt = $pdo->prepare("SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'orders' AND COLUMN_NAME = ?");
    $stmt->execute([$c]);
    if (intval($stmt->fetchColumn()) > 0) { $dateCol = $c; break; }
}
if (!$dateCol) { echo "No timestamp column found on orders table.\n"; exit(1); }
$from_ts = $from . ' 00:00:00';
$to_ts_excl = date('Y-m-d', strtotime($to . ' +1 day')) . ' 00:00:00';

echo "Inspecting rep $repId for range $from to $to (using orders.$dateCol)\n\n";

// 1) Orders with status='delivered' and dateCol in range
$stmt = $pdo->prepare("SELECT id, order_number, status, rep_id, $dateCol FROM orders WHERE status = 'delivered' AND $dateCol >= ? AND $dateCol < ?");
$stmt->execute([$from_ts, $to_ts_excl]);
$delByOrders = $stmt->fetchAll(PDO::FETCH_ASSOC);

// 2) Orders with status='delivered' AND rep_id = repId (regardless of date)
$stmt = $pdo->prepare("SELECT id, order_number, status, rep_id, $dateCol FROM orders WHERE rep_id = ? AND status = 'delivered'");
$stmt->execute([$repId]);
$delByRep = $stmt->fetchAll(PDO::FETCH_ASSOC);

// 3) History entries by this rep with status='delivered' in range
$histExists = (bool)$pdo->query("SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'order_status_history'")->fetchColumn();
$histRows = [];
if ($histExists) {
    $hstmt = $pdo->prepare("SELECT id, order_id, status, rep_id, created_by, created_at, notes FROM order_status_history WHERE rep_id = ? AND status = 'delivered' AND created_at >= ? AND created_at < ? ORDER BY created_at DESC");
    $hstmt->execute([$repId, $from_ts, $to_ts_excl]);
    $histRows = $hstmt->fetchAll(PDO::FETCH_ASSOC);
}

// 4) All orders currently assigned to rep within range (by dateCol)
$stmt = $pdo->prepare("SELECT id, order_number, status, rep_id, $dateCol FROM orders WHERE rep_id = ? AND $dateCol >= ? AND $dateCol < ? ORDER BY $dateCol DESC");
$stmt->execute([$repId, $from_ts, $to_ts_excl]);
$ordersByRepDate = $stmt->fetchAll(PDO::FETCH_ASSOC);

// print summaries
function p($s){ echo $s."\n"; }

p("Delivered rows where orders.$dateCol in range:");
if (empty($delByOrders)) p("  (none)");
foreach ($delByOrders as $r) { p("  id={$r['id']} num={$r['order_number']} rep_id={$r['rep_id']} status={$r['status']} {$r[$dateCol]}"); }

p("\nDelivered rows currently assigned to rep {$repId}:");
if (empty($delByRep)) p("  (none)");
foreach ($delByRep as $r) { p("  id={$r['id']} num={$r['order_number']} rep_id={$r['rep_id']} status={$r['status']} {$r[$dateCol]}"); }

p("\nOrder_status_history entries by rep {$repId} (delivered) in range:");
if (!$histExists) p("  (history table missing)");
elseif (empty($histRows)) p("  (none)");
else {
    foreach ($histRows as $h) { p("  hist_id={$h['id']} order_id={$h['order_id']} rep_id={$h['rep_id']} created_at={$h['created_at']} notes=".trim($h['notes'])); }
}

p("\nOrders currently assigned to rep {$repId} with $dateCol in range:");
if (empty($ordersByRepDate)) p("  (none)");
foreach ($ordersByRepDate as $r) { p("  id={$r['id']} num={$r['order_number']} status={$r['status']} {$r[$dateCol]}"); }

// For convenience, show orders that history references (delivered by rep) even if orders table not delivered
if ($histExists && !empty($histRows)) {
    $ids = array_unique(array_map(function($x){return intval($x['order_id']);}, $histRows));
    $in = implode(',', $ids);
    $stmt = $pdo->query("SELECT id, order_number, status, rep_id, $dateCol FROM orders WHERE id IN ($in)");
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
    p("\nOrders referenced by history entries:");
    foreach ($rows as $r) { p("  id={$r['id']} num={$r['order_number']} status={$r['status']} rep_id={$r['rep_id']} {$r[$dateCol]}"); }
}

