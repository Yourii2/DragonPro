<?php
$pdo = new PDO('mysql:host=localhost;dbname=998877;charset=utf8mb4','root','Bad220020!@#');

echo "=== All supplier payment transactions ===\n";
$r = $pdo->query("SELECT id, type, related_to_type, related_to_id, amount, details FROM transactions WHERE related_to_type='supplier' AND amount < 0 ORDER BY id ASC")->fetchAll(PDO::FETCH_ASSOC);
$totals = [];
foreach($r as $t) {
    echo json_encode($t, JSON_UNESCAPED_UNICODE)."\n";
    $sid = $t['related_to_id'];
    $totals[$sid] = ($totals[$sid] ?? 0) + abs($t['amount']);
}
echo "\n=== Sum of all outgoing payments per supplier ===\n";
foreach($totals as $sid => $sum) echo "supplier_id=$sid -> sum_paid=$sum\n";

echo "\n=== Current total_credit in suppliers ===\n";
$r2 = $pdo->query("SELECT id, name, total_debit, total_credit FROM suppliers")->fetchAll(PDO::FETCH_ASSOC);
foreach($r2 as $s) echo json_encode($s, JSON_UNESCAPED_UNICODE)."\n";

echo "\n=== FIX: Update total_credit for missed payments ===\n";
foreach($totals as $sid => $sum) {
    $row = $pdo->query("SELECT total_credit FROM suppliers WHERE id=$sid")->fetch(PDO::FETCH_ASSOC);
    if ($row) {
        $current = floatval($row['total_credit']);
        $diff = $sum - $current;
        echo "supplier_id=$sid: total_credit_in_db=$current, sum_from_tx=$sum, diff=$diff\n";
        if ($diff > 0) {
            $pdo->exec("UPDATE suppliers SET total_credit = $sum WHERE id = $sid");
            echo "  -> FIXED: set total_credit = $sum\n";
        } else {
            echo "  -> OK, no fix needed\n";
        }
    }
}

echo "\n=== After fix ===\n";
$r3 = $pdo->query("SELECT id, name, total_debit, total_credit, (total_credit - total_debit) as balance FROM suppliers")->fetchAll(PDO::FETCH_ASSOC);
foreach($r3 as $s) echo json_encode($s, JSON_UNESCAPED_UNICODE)."\n";
