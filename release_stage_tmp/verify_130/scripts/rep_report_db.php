<?php
if (php_sapi_name() !== 'cli') { echo "Run from CLI\n"; exit(1); }
if ($argc < 4) { echo "Usage: php rep_report_db.php <rep_id> <from YYYY-MM-DD> <to YYYY-MM-DD>\n"; exit(1); }
$repId = intval($argv[1]);
$from = $argv[2];
$to = $argv[3];
require_once __DIR__ . '/../config.php';
try {
    $pdo = new PDO("mysql:host=".DB_HOST.";dbname=".DB_NAME.";charset=utf8mb4", DB_USER, defined('DB_PASS')?DB_PASS:'', [PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);
} catch (Exception $e) { echo "DB conn failed: " . $e->getMessage() . "\n"; exit(1); }

// detect order timestamp column
$dateCol = null;
foreach (['updated_at','created_at','date'] as $c) {
    $stmt = $pdo->prepare("SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'orders' AND COLUMN_NAME = ?");
    $stmt->execute([$c]);
    if (intval($stmt->fetchColumn()) > 0) { $dateCol = $c; break; }
}
if (!$dateCol) { echo "No timestamp column found on orders table.\n"; exit(1); }

// helper to compute order totals and pieces for a set of order ids
function totals_for_orders($pdo, $ids) {
    if (empty($ids)) return ['count'=>0,'value'=>0.0,'pieces'=>0];
    $in = implode(',', array_map('intval', $ids));
    // total value from order_items if exists
    $hasTotal = (bool)$pdo->query("SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'order_items' AND COLUMN_NAME = 'total_price'")->fetchColumn();
    if ($hasTotal) {
        $stmt = $pdo->query("SELECT COALESCE(SUM(total_price),0) as v, COALESCE(SUM(quantity),0) as p FROM order_items WHERE order_id IN ($in)");
    } else {
        $stmt = $pdo->query("SELECT COALESCE(SUM(quantity * price_per_unit),0) as v, COALESCE(SUM(quantity),0) as p FROM order_items WHERE order_id IN ($in)");
    }
    $r = $stmt->fetch(PDO::FETCH_ASSOC);
    return ['count'=>count($ids),'value'=>floatval($r['v'] ?? 0),'pieces'=>intval($r['p'] ?? 0)];
}

// 1) delivered and returned: union of orders table and history
$from_ts = $from . ' 00:00:00';
$to_ts_excl = date('Y-m-d', strtotime($to . ' +1 day')) . ' 00:00:00';

// orders matching by current rep/status and dateCol
$stmt = $pdo->prepare("SELECT id FROM orders WHERE rep_id = ? AND status = ? AND $dateCol >= ? AND $dateCol < ?");
$stmt->execute([$repId, 'delivered', $from_ts, $to_ts_excl]);
$ids1 = array_map('intval', $stmt->fetchAll(PDO::FETCH_COLUMN));

// history-based matches if table exists
$histIds = [];
$hasHist = (bool)$pdo->query("SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'order_status_history'")->fetchColumn();
if ($hasHist) {
    $hstmt = $pdo->prepare("SELECT DISTINCT order_id FROM order_status_history WHERE rep_id = ? AND status = ? AND created_at >= ? AND created_at < ?");
    $hstmt->execute([$repId, 'delivered', $from_ts, $to_ts_excl]);
    $histIds = array_map('intval', $hstmt->fetchAll(PDO::FETCH_COLUMN));
}
$deliveredIds = array_values(array_unique(array_merge($ids1, $histIds)));
$delivered = totals_for_orders($pdo, $deliveredIds);

// returned
$stmt = $pdo->prepare("SELECT id FROM orders WHERE rep_id = ? AND status = ? AND $dateCol >= ? AND $dateCol < ?");
$stmt->execute([$repId, 'returned', $from_ts, $to_ts_excl]);
$ids1 = array_map('intval', $stmt->fetchAll(PDO::FETCH_COLUMN));
$histIds = [];
if ($hasHist) {
    $hstmt = $pdo->prepare("SELECT DISTINCT order_id FROM order_status_history WHERE rep_id = ? AND status = ? AND created_at >= ? AND created_at < ?");
    $hstmt->execute([$repId, 'returned', $from_ts, $to_ts_excl]);
    $histIds = array_map('intval', $hstmt->fetchAll(PDO::FETCH_COLUMN));
}
$returnedIds = array_values(array_unique(array_merge($ids1, $histIds)));
$returned = totals_for_orders($pdo, $returnedIds);

// deferred: use orders table where status in set and rep_id and dateCol in range
$deferredStatuses = ['pending','delayed','postponed'];
$inStatuses = "'" . implode("','", $deferredStatuses) . "'";
$deStmt = $pdo->prepare("SELECT id FROM orders WHERE rep_id = ? AND status IN ($inStatuses) AND $dateCol >= ? AND $dateCol < ?");
$deStmt->execute([$repId, $from_ts, $to_ts_excl]);
$deferredIds = array_map('intval', $deStmt->fetchAll(PDO::FETCH_COLUMN));
$deferred = totals_for_orders($pdo, $deferredIds);

// rep balance: sum transactions where related_to_id = repId
$txStmt = $pdo->prepare("SELECT COALESCE(SUM(amount),0) as bal FROM transactions WHERE related_to_id = ?");
$txStmt->execute([$repId]);
$balRow = $txStmt->fetch(PDO::FETCH_ASSOC);
$repBalance = floatval($balRow['bal'] ?? 0);

// Output
function fm($n) { return number_format($n,0,',',','); }
echo "Rep ID: $repId\n";
echo "Date range: $from to $to\n\n";
echo "الحساب الحالي:\n";
echo fm($repBalance) . " ج.م\n";
echo '(' . ($repBalance>0? 'له' : ($repBalance<0? 'عليه' : '')) . ") — من قاعدة البيانات\n\n";

echo "إجمالي تسليم اليوم:\n";
echo $delivered['count'] . " طلب\n";
echo "القطع المسلمة: " . $delivered['pieces'] . "\n";
echo "القيمة: " . number_format($delivered['value'],0,',',',') . " ج.م (للعرض فقط)\n\n";

echo "المؤجل:\n";
echo count($deferredIds) . " طلب\n";
echo "القطع المؤجلة: " . $deferred['pieces'] . "\n";
echo "القيمة: " . number_format($deferred['value'],0,',',',') . " ج.م (للعرض فقط)\n\n";

echo "إجمالي مرتجع اليوم:\n";
echo $returned['count'] . " طلب\n";
echo "القيمة: " . number_format($returned['value'],0,',',',') . " ج.م (للعرض فقط)\n";
