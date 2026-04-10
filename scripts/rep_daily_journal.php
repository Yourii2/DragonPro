<?php
// Usage: php scripts/rep_daily_journal.php [rep_id|all] <from YYYY-MM-DD> <to YYYY-MM-DD>
if (php_sapi_name() !== 'cli') { echo "Run from CLI\n"; exit(1); }
if ($argc < 4) { echo "Usage: php scripts/rep_daily_journal.php [rep_id|all] <from YYYY-MM-DD> <to YYYY-MM-DD>\n"; exit(1); }
$repArg = $argv[1];
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
    $hasTotal = (bool)$pdo->query("SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'order_items' AND COLUMN_NAME = 'total_price'")->fetchColumn();
    if ($hasTotal) {
        $stmt = $pdo->query("SELECT COALESCE(SUM(total_price),0) as v, COALESCE(SUM(quantity),0) as p FROM order_items WHERE order_id IN ($in)");
    } else {
        $stmt = $pdo->query("SELECT COALESCE(SUM(quantity * price_per_unit),0) as v, COALESCE(SUM(quantity),0) as p FROM order_items WHERE order_id IN ($in)");
    }
    $r = $stmt->fetch(PDO::FETCH_ASSOC);
    return ['count'=>count($ids),'value'=>floatval($r['v'] ?? 0),'pieces'=>intval($r['p'] ?? 0)];
}

// create table if not exists
$pdo->exec("CREATE TABLE IF NOT EXISTS rep_daily_journal (
    id INT AUTO_INCREMENT PRIMARY KEY,
    rep_id INT NOT NULL,
    journal_date DATE NOT NULL,
    opening_amount DECIMAL(14,2) DEFAULT 0,
    opening_orders_count INT DEFAULT 0,
    opening_pieces_count INT DEFAULT 0,
    orders_received_count INT DEFAULT 0,
    pieces_received INT DEFAULT 0,
    orders_delivered_count INT DEFAULT 0,
    pieces_delivered INT DEFAULT 0,
    delivered_value DECIMAL(14,2) DEFAULT 0,
    orders_returned_count INT DEFAULT 0,
    pieces_returned INT DEFAULT 0,
    returned_value DECIMAL(14,2) DEFAULT 0,
    orders_postponed_count INT DEFAULT 0,
    pieces_postponed INT DEFAULT 0,
    postponed_value DECIMAL(14,2) DEFAULT 0,
    transactions TEXT NULL,
    closing_amount DECIMAL(14,2) DEFAULT 0,
    notes TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY rep_date_unique (rep_id, journal_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

$startDate = strtotime($from);
$endDate = strtotime($to);
if ($startDate === false || $endDate === false) { echo "Invalid date range\n"; exit(1); }

// get reps list
if ($repArg === 'all') {
    $rstmt = $pdo->query("SELECT id FROM users WHERE role IN ('representative','rep','sales')");
    $repRows = $rstmt->fetchAll(PDO::FETCH_COLUMN);
    $repIds = array_map('intval', $repRows);
} else {
    $repIds = [intval($repArg)];
}

for ($d = $startDate; $d <= $endDate; $d = strtotime('+1 day', $d)) {
    $day = date('Y-m-d', $d);
    $dayStart = $day . ' 00:00:00';
    $dayEnd = date('Y-m-d', strtotime($day . ' +1 day')) . ' 00:00:00';

    foreach ($repIds as $repId) {
        // opening amount = previous day's closing_amount if exists, else sum transactions before day
        $prevDay = date('Y-m-d', strtotime($day . ' -1 day'));
        $prevStmt = $pdo->prepare("SELECT closing_amount FROM rep_daily_journal WHERE rep_id = ? AND journal_date = ?");
        $prevStmt->execute([$repId, $prevDay]);
        $prevRow = $prevStmt->fetch(PDO::FETCH_ASSOC);
        if ($prevRow) {
            $opening = floatval($prevRow['closing_amount'] ?? 0);
        } else {
            $txStmt = $pdo->prepare("SELECT COALESCE(SUM(amount),0) as bal FROM transactions WHERE related_to_type = 'rep' AND related_to_id = ? AND transaction_date < ?");
            $txStmt->execute([$repId, $dayStart]);
            $opening = floatval($txStmt->fetchColumn() ?? 0);
        }

        // orders before (open orders carried into the day)
        $beforeStmt = $pdo->prepare("SELECT id FROM orders o WHERE o.rep_id = ? AND o.status IN ('with_rep','partial','postponed') AND DATE(o.$dateCol) < ?");
        $beforeStmt->execute([$repId, $day]);
        $beforeIds = array_map('intval', $beforeStmt->fetchAll(PDO::FETCH_COLUMN));
        $beforeTotals = totals_for_orders($pdo, $beforeIds);

        // received today (orders assigned/on-hand today)
        $receivedStmt = $pdo->prepare("SELECT id FROM orders o WHERE o.rep_id = ? AND o.status IN ('with_rep','partial','postponed') AND DATE(o.$dateCol) = ?");
        $receivedStmt->execute([$repId, $day]);
        $receivedIds = array_map('intval', $receivedStmt->fetchAll(PDO::FETCH_COLUMN));
        $receivedTotals = totals_for_orders($pdo, $receivedIds);

        // delivered: union of orders table and history
        $delIds1Stmt = $pdo->prepare("SELECT id FROM orders WHERE rep_id = ? AND status = 'delivered' AND COALESCE($dateCol, '') >= ? AND COALESCE($dateCol, '') < ?");
        $delIds1Stmt->execute([$repId, $dayStart, $dayEnd]);
        $ids1 = array_map('intval', $delIds1Stmt->fetchAll(PDO::FETCH_COLUMN));
        $histExists = (bool)$pdo->query("SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'order_status_history'")->fetchColumn();
        $histIds = [];
        if ($histExists) {
            $hstmt = $pdo->prepare("SELECT DISTINCT order_id FROM order_status_history WHERE rep_id = ? AND status = 'delivered' AND created_at >= ? AND created_at < ?");
            $hstmt->execute([$repId, $dayStart, $dayEnd]);
            $histIds = array_map('intval', $hstmt->fetchAll(PDO::FETCH_COLUMN));
        }
        $deliveredIds = array_values(array_unique(array_merge($ids1, $histIds)));
        $deliveredTotals = totals_for_orders($pdo, $deliveredIds);

        // returned
        $retStmt = $pdo->prepare("SELECT id FROM orders WHERE rep_id = ? AND status = 'returned' AND COALESCE($dateCol, '') >= ? AND COALESCE($dateCol, '') < ?");
        $retStmt->execute([$repId, $dayStart, $dayEnd]);
        $ids1 = array_map('intval', $retStmt->fetchAll(PDO::FETCH_COLUMN));
        $histIds = [];
        if ($histExists) {
            $hstmt = $pdo->prepare("SELECT DISTINCT order_id FROM order_status_history WHERE rep_id = ? AND status = 'returned' AND created_at >= ? AND created_at < ?");
            $hstmt->execute([$repId, $dayStart, $dayEnd]);
            $histIds = array_map('intval', $hstmt->fetchAll(PDO::FETCH_COLUMN));
        }
        $returnedIds = array_values(array_unique(array_merge($ids1, $histIds)));
        $returnedTotals = totals_for_orders($pdo, $returnedIds);

        // postponed (deferred) orders today
        $deferredStatuses = ['pending','delayed','postponed','with_rep'];
        $inStatuses = "'" . implode("','", $deferredStatuses) . "'";
        $deStmt = $pdo->prepare("SELECT id FROM orders WHERE rep_id = ? AND status IN ($inStatuses) AND COALESCE($dateCol, '') >= ? AND COALESCE($dateCol, '') < ?");
        $deStmt->execute([$repId, $dayStart, $dayEnd]);
        $deferredIds = array_map('intval', $deStmt->fetchAll(PDO::FETCH_COLUMN));
        $deferredTotals = totals_for_orders($pdo, $deferredIds);

        // transactions on the day related to rep
        $txq = $pdo->prepare("SELECT id, type, amount, transaction_date, details FROM transactions WHERE related_to_type = 'rep' AND related_to_id = ? AND transaction_date >= ? AND transaction_date < ? ORDER BY transaction_date ASC");
        $txq->execute([$repId, $dayStart, $dayEnd]);
        $txrows = $txq->fetchAll(PDO::FETCH_ASSOC);
        $txJson = json_encode($txrows, JSON_UNESCAPED_UNICODE);

        // closing amount = opening + sum(tx during day)
        $sumTx = 0.0;
        foreach ($txrows as $tr) { $sumTx += floatval($tr['amount'] ?? 0); }
        $closing = $opening + $sumTx;

        // upsert into table
        $ins = $pdo->prepare("INSERT INTO rep_daily_journal (rep_id, journal_date, opening_amount, opening_orders_count, opening_pieces_count, orders_received_count, pieces_received, orders_delivered_count, pieces_delivered, delivered_value, orders_returned_count, pieces_returned, returned_value, orders_postponed_count, pieces_postponed, postponed_value, transactions, closing_amount, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE opening_amount=VALUES(opening_amount), opening_orders_count=VALUES(opening_orders_count), opening_pieces_count=VALUES(opening_pieces_count), orders_received_count=VALUES(orders_received_count), pieces_received=VALUES(pieces_received), orders_delivered_count=VALUES(orders_delivered_count), pieces_delivered=VALUES(pieces_delivered), delivered_value=VALUES(delivered_value), orders_returned_count=VALUES(orders_returned_count), pieces_returned=VALUES(pieces_returned), returned_value=VALUES(returned_value), orders_postponed_count=VALUES(orders_postponed_count), pieces_postponed=VALUES(pieces_postponed), postponed_value=VALUES(postponed_value), transactions=VALUES(transactions), closing_amount=VALUES(closing_amount), notes=VALUES(notes)");

        $ins->execute([
            $repId,
            $day,
            $opening,
            $beforeTotals['count'],
            $beforeTotals['pieces'],
            $receivedTotals['count'],
            $receivedTotals['pieces'],
            $deliveredTotals['count'],
            $deliveredTotals['pieces'],
            $deliveredTotals['value'],
            $returnedTotals['count'],
            $returnedTotals['pieces'],
            $returnedTotals['value'],
            $deferredTotals['count'],
            $deferredTotals['pieces'],
            $deferredTotals['value'],
            $txJson,
            $closing,
            null
        ]);

        echo "Wrote journal for rep={$repId} date={$day} opening={$opening} closing={$closing}\n";
    }
}

echo "Done.\n";
