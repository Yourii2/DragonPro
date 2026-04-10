<?php
if (php_sapi_name() !== 'cli') { echo "Run from CLI\n"; exit(1); }
if ($argc < 4) { echo "Usage: php rep_delivery_check.php <rep_id> <from YYYY-MM-DD> <to YYYY-MM-DD>\n"; exit(1); }
$repId = intval($argv[1]);
$from = $argv[2];
$to = $argv[3];
require_once __DIR__ . '/../config.php';
try { $pdo = new PDO("mysql:host=".DB_HOST.";dbname=".DB_NAME.";charset=utf8mb4", DB_USER, defined('DB_PASS')?DB_PASS:'', [PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]); } catch (Exception $e) { echo "DB conn failed: " . $e->getMessage() . "\n"; exit(1); }
// detect date col
$dateCol = null; foreach (['updated_at','created_at','date'] as $c) { $stmt = $pdo->prepare("SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'orders' AND COLUMN_NAME = ?"); $stmt->execute([$c]); if (intval($stmt->fetchColumn())>0) { $dateCol = $c; break; } }
if (!$dateCol) { echo "No date column\n"; exit(1); }
$from_ts = $from . ' 00:00:00';
$to_ts_excl = date('Y-m-d', strtotime($to . ' +1 day')) . ' 00:00:00';

// delivered orders in range
$delStmt = $pdo->prepare("SELECT id, order_number, rep_id, status, $dateCol as dt FROM orders WHERE status = 'delivered' AND $dateCol >= ? AND $dateCol < ? ORDER BY $dateCol ASC");
$delStmt->execute([$from_ts, $to_ts_excl]);
$delRows = $delStmt->fetchAll(PDO::FETCH_ASSOC);

// helper to check history
$hasHist = (bool)$pdo->query("SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'order_status_history'")->fetchColumn();

$results = [];
foreach ($delRows as $r) {
    $id = intval($r['id']);
    $hasAssign = false; $assignRows = [];
    if ($hasHist) {
        $hstmt = $pdo->prepare("SELECT id, order_id, status, rep_id, created_by, created_at, notes FROM order_status_history WHERE order_id = ? ORDER BY created_at ASC");
        $hstmt->execute([$id]);
        $hist = $hstmt->fetchAll(PDO::FETCH_ASSOC);
        foreach ($hist as $h) {
            if (isset($h['rep_id']) && intval($h['rep_id']) === $repId) { $hasAssign = true; $assignRows[] = $h; }
            if ($h['status']==='delivered' && intval($h['rep_id'])=== $repId) { $hasAssign = true; $assignRows[] = $h; }
        }
    }
    $fromAssigned = false;
    // also check if order was assigned to this rep currently or earlier in orders table? Check current rep_id or lookup any assignment in history
    if (intval($r['rep_id']) === $repId) $fromAssigned = true;
    $results[] = ['order_id'=>$id,'order_number'=>$r['order_number'],'delivered_dt'=>$r['dt'],'current_rep'=> $r['rep_id'],'has_history_assign'=>$hasAssign,'history_rows'=>$assignRows,'assigned_now'=>$fromAssigned];
}

// summarize
$total = count($results);
$assignedCount = count(array_filter($results, fn($x)=> $x['assigned_now'] || $x['has_history_assign']));

echo "Delivered orders in range: $total\n";
echo "Of these, attributed to rep $repId: $assignedCount\n\n";
foreach ($results as $res) {
    echo "id={$res['order_id']} num={$res['order_number']} dt={$res['delivered_dt']} current_rep={$res['current_rep']} attributed=".($res['assigned_now']||$res['has_history_assign']? 'YES':'NO')."\n";
    if (!empty($res['history_rows'])) {
        foreach ($res['history_rows'] as $h) echo "   hist id={$h['id']} rep_id={$h['rep_id']} status={$h['status']} at={$h['created_at']} notes=".trim($h['notes'])."\n";
    }
}
