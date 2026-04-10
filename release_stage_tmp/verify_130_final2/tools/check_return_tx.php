<?php
require __DIR__ . '/../config.php';
$pdo = new PDO('mysql:host='.DB_HOST.';dbname='.DB_NAME.';charset=utf8mb4', DB_USER, DB_PASS, [PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);

// Check rep_return_credit transactions today
$rows = $pdo->query("SELECT id, type, related_to_type, related_to_id, amount, transaction_date, details FROM transactions WHERE type LIKE '%return%' AND DATE(transaction_date) = '2026-03-01' ORDER BY id DESC LIMIT 20")->fetchAll(PDO::FETCH_ASSOC);
echo "=== rep_return_credit transactions today ===\n";
echo json_encode($rows, JSON_PRETTY_PRINT|JSON_UNESCAPED_UNICODE) . "\n";
