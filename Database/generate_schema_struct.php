<?php
/**
 * generate_schema_struct.php
 * يولد current_schema_struct.sql من قاعدة البيانات الحية
 * بنفس تنسيق الملف الأصلي المستخدم في setup wizard
 */

define('DB_HOST', 'localhost');
define('DB_USER', 'root');
define('DB_PASS', 'Bad220020!@#');
define('DB_NAME', 'Dragon12');

$outFile = __DIR__ . '/../current_schema_struct.sql';

try {
    $pdo = new PDO(
        "mysql:host=".DB_HOST.";dbname=".DB_NAME.";charset=utf8mb4",
        DB_USER, DB_PASS,
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
    );
} catch (Exception $e) {
    die("DB Error: " . $e->getMessage() . "\n");
}

// Get all tables
$tables = $pdo->query("SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_TYPE='BASE TABLE' ORDER BY TABLE_NAME")->fetchAll(PDO::FETCH_COLUMN);

$out = "SET NAMES utf8mb4;\r\nSET FOREIGN_KEY_CHECKS = 0;\r\n\r\n";

foreach ($tables as $table) {
    // Get CREATE TABLE statement
    $row = $pdo->query("SHOW CREATE TABLE `$table`")->fetch(PDO::FETCH_NUM);
    $create = $row[1];

    // Normalize:
    // 1. Remove AUTO_INCREMENT=xxx (reset to default for fresh install)
    $create = preg_replace('/\s*AUTO_INCREMENT\s*=\s*\d+/i', '', $create);
    // 2. Ensure CREATE TABLE (not IF NOT EXISTS yet - setup.php handles that)
    // 3. Add CRLF line endings to match original format
    $create = str_replace("\n", "\r\n", $create);

    $out .= $create . ";\r\n\r\n";
}

$out .= "SET FOREIGN_KEY_CHECKS = 1;\r\n";

// Write file
file_put_contents($outFile, $out);

$tableCount = count($tables);
$size = round(filesize($outFile) / 1024, 1);
echo "Done!\n";
echo "Tables: $tableCount\n";
echo "File: $outFile ($size KB)\n";
echo "\nTables included:\n";
foreach ($tables as $t) echo "  - $t\n";
