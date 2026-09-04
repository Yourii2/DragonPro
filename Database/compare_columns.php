<?php
// Column-level comparison: live DB vs install SQL
// Run: php Database/compare_columns.php

define('DB_HOST', 'localhost');
define('DB_USER', 'root');
define('DB_PASS', 'Bad220020!@#');
define('DB_NAME', 'Dragon12');

$installSqlFile = __DIR__ . '/Schema998877.sql';

// --- 1) Read live DB schema ---
try {
    $pdo = new PDO("mysql:host=".DB_HOST.";dbname=".DB_NAME.";charset=utf8mb4", DB_USER, DB_PASS);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
} catch (Exception $e) {
    die("DB connection failed: " . $e->getMessage() . "\n");
}

// Get all columns from live DB grouped by table
$liveColumns = [];
$stmt = $pdo->query("
    SELECT TABLE_NAME, COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT, EXTRA, COLUMN_KEY
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = '".DB_NAME."'
    ORDER BY TABLE_NAME, ORDINAL_POSITION
");
foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
    $liveColumns[$row['TABLE_NAME']][$row['COLUMN_NAME']] = $row;
}

$liveTables = array_keys($liveColumns);

// --- 2) Parse install SQL to extract column definitions per table ---
$installSql = file_get_contents($installSqlFile);

// Extract CREATE TABLE blocks
$installColumns = [];
$installTables = [];
preg_match_all('/CREATE TABLE `([^`]+)`\s*\((.*?)\)\s*ENGINE=/si', $installSql, $matches, PREG_SET_ORDER);
foreach ($matches as $m) {
    $tableName = $m[1];
    $installTables[] = $tableName;
    $body = $m[2];
    // Extract column lines (lines that start with a backtick)
    $lines = preg_split('/[\r\n]+/', $body);
    foreach ($lines as $line) {
        $line = trim($line);
        if (preg_match('/^`([^`]+)`\s+(.+?)(?:,)?$/', $line, $cm)) {
            $colName = $cm[1];
            $colDef  = trim($cm[2], ', ');
            // Skip if it looks like a KEY or CONSTRAINT line
            if (!in_array(strtoupper($colName), ['PRIMARY', 'KEY', 'UNIQUE', 'INDEX', 'CONSTRAINT', 'FULLTEXT'])) {
                $installColumns[$tableName][$colName] = $colDef;
            }
        }
    }
}

// --- 3) Generate report ---
$missingTablesList = array_diff($liveTables, $installTables);
$report = [];
$alterStatements = [];

// Tables in live but not in install
foreach ($missingTablesList as $t) {
    $report[] = "[MISSING TABLE] $t";
}

// Per-table column comparison
foreach ($liveTables as $table) {
    if (!isset($installColumns[$table])) continue; // already flagged as missing

    $liveCols   = array_keys($liveColumns[$table]);
    $installCols = isset($installColumns[$table]) ? array_keys($installColumns[$table]) : [];

    $missingCols = array_diff($liveCols, $installCols);
    $extraCols   = array_diff($installCols, $liveCols);

    foreach ($missingCols as $col) {
        $colInfo = $liveColumns[$table][$col];
        $type    = $colInfo['COLUMN_TYPE'];
        $null    = $colInfo['IS_NULLABLE'] === 'YES' ? 'DEFAULT NULL' : 'NOT NULL';
        $default = '';
        if ($colInfo['COLUMN_DEFAULT'] !== null && $colInfo['COLUMN_DEFAULT'] !== '') {
            $default = " DEFAULT '" . $colInfo['COLUMN_DEFAULT'] . "'";
        }
        $extra = $colInfo['EXTRA'] ? ' ' . $colInfo['EXTRA'] : '';
        $report[] = "[MISSING COLUMN] $table.$col";
        $alterStatements[] = "ALTER TABLE `$table` ADD COLUMN IF NOT EXISTS `$col` $type $null$default$extra;";
    }

    foreach ($extraCols as $col) {
        $report[] = "[EXTRA IN INSTALL (not in live)] $table.$col";
    }
}

// --- 4) Output ---
echo "\n=== SCHEMA COMPARISON REPORT ===\n\n";
echo "Live DB tables: " . count($liveTables) . "\n";
echo "Install SQL tables: " . count($installTables) . "\n\n";

$missingTableCount = count(array_filter($report, fn($r) => str_starts_with($r, '[MISSING TABLE]')));
$missingColCount   = count(array_filter($report, fn($r) => str_starts_with($r, '[MISSING COLUMN]')));
$extraColCount     = count(array_filter($report, fn($r) => str_starts_with($r, '[EXTRA IN INSTALL]')));

echo "Missing tables (in live, not in install): $missingTableCount\n";
echo "Missing columns (in live, not in install): $missingColCount\n";
echo "Extra columns (in install, not in live): $extraColCount\n\n";

foreach ($report as $line) {
    echo "$line\n";
}

if (!empty($alterStatements)) {
    echo "\n\n=== ALTER STATEMENTS TO ADD MISSING COLUMNS ===\n\n";
    foreach ($alterStatements as $sql) {
        echo "$sql\n";
    }
}

// Write ALTER statements to file
$alterFile = __DIR__ . '/patch_missing_columns.sql';
$content = "-- Auto-generated patch: add missing columns to existing tables\n-- Generated: " . date('Y-m-d H:i:s') . "\n\n";
$content .= implode("\n", $alterStatements) . "\n";
file_put_contents($alterFile, $content);
echo "\nAlter statements written to: $alterFile\n";
