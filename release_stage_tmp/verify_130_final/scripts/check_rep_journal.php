<?php
require_once __DIR__ . '/../config.php';
try {
    $pdo = new PDO('mysql:host='.DB_HOST.';dbname='.DB_NAME.';charset=utf8mb4', DB_USER, defined('DB_PASS')?DB_PASS:'');
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
} catch (Exception $e) {
    echo "DB conn failed: " . $e->getMessage() . "\n";
    exit(1);
}
$stmt = $pdo->query("SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = '".DB_NAME."' AND TABLE_NAME = 'rep_daily_journal'");
echo (int)$stmt->fetchColumn() . PHP_EOL;
