<?php
require_once __DIR__ . '/../config.php';

try {
    $pdo = new PDO("mysql:host=" . DB_HOST . ";dbname=" . DB_NAME . ";charset=utf8mb4", DB_USER, defined('DB_PASS') ? DB_PASS : '', [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION
    ]);
} catch (Exception $e) {
    echo "Database connection failed: " . $e->getMessage() . "\n";
    exit(1);
}

echo "========================================================\n";
echo "           REPRESENTATIVE BALANCES AUDIT REPORT\n";
echo "========================================================\n\n";

// 1. Get all representatives
$repsStmt = $pdo->query("SELECT id, name, phone FROM users WHERE role = 'representative' ORDER BY id ASC");
$reps = $repsStmt->fetchAll(PDO::FETCH_ASSOC);

if (empty($reps)) {
    echo "No representatives found in database.\n";
    exit(0);
}

foreach ($reps as $rep) {
    $repId = intval($rep['id']);
    $repName = $rep['name'];
    
    // Transactions breakdown
    $txStmt = $pdo->prepare("
        SELECT 
            type,
            COALESCE(SUM(amount), 0) as total_amt,
            COUNT(*) as tx_count
        FROM transactions
        WHERE related_to_type = 'rep' AND related_to_id = ?
        GROUP BY type
    ");
    $txStmt->execute([$repId]);
    $txBreakdown = $txStmt->fetchAll(PDO::FETCH_ASSOC);
    
    // Current Balance from transactions sum
    $balStmt = $pdo->prepare("
        SELECT COALESCE(SUM(amount), 0) as current_balance
        FROM transactions
        WHERE related_to_type = 'rep' AND related_to_id = ?
    ");
    $balStmt->execute([$repId]);
    $currentBal = floatval($balStmt->fetchColumn() ?? 0);

    // Get individual recent transactions
    $recentStmt = $pdo->prepare("
        SELECT id, type, amount, transaction_date, details
        FROM transactions
        WHERE related_to_type = 'rep' AND related_to_id = ?
        ORDER BY id DESC LIMIT 5
    ");
    $recentStmt->execute([$repId]);
    $recentTxs = $recentStmt->fetchAll(PDO::FETCH_ASSOC);
    
    echo "--------------------------------------------------------\n";
    echo "Representative: {$repName} (ID: {$repId}, Phone: {$rep['phone']})\n";
    echo "Current Recorded Balance: " . number_format($currentBal, 2) . " EGP (" . ($currentBal > 0 ? "له" : ($currentBal < 0 ? "عليه" : "متزن")) . ")\n";
    echo "Transactions Summary:\n";
    if (empty($txBreakdown)) {
        echo "  - No transactions recorded yet.\n";
    } else {
        foreach ($txBreakdown as $tx) {
            echo "  - Type: {$tx['type']}: " . number_format($tx['total_amt'], 2) . " EGP ({$tx['tx_count']} entries)\n";
        }
    }
    echo "Recent Transactions:\n";
    foreach ($recentTxs as $rt) {
        echo "  [#{$rt['id']}] {$rt['transaction_date']} | Type: {$rt['type']} | Amount: {$rt['amount']} | Details: {$rt['details']}\n";
    }
}
echo "\n========================================================\n";
