<?php
// CLI helper: import a JSON export of localStorage into DB tables created by migration.
// Usage: php migrate_localstorage.php /path/to/export.json [user_id]

if (php_sapi_name() !== 'cli') {
    echo "Run this script from CLI.\n";
    exit(1);
}

$argv0 = $argv;
if ($argc < 2) {
    echo "Usage: php migrate_localstorage.php /path/to/export.json [user_id]\n";
    exit(1);
}

$file = $argv[1];
$userId = isset($argv[2]) ? intval($argv[2]) : null;
if (!file_exists($file)) { echo "File not found: $file\n"; exit(1); }

$data = json_decode(file_get_contents($file), true);
if (!is_array($data)) { echo "Invalid JSON export\n"; exit(1); }

require_once __DIR__ . '/../config.php';
try {
    $pdo = new PDO("mysql:host=" . DB_HOST . ";dbname=" . DB_NAME . ";charset=utf8mb4", DB_USER, DB_PASS);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
} catch (PDOException $e) {
    echo "DB connection failed: " . $e->getMessage() . "\n";
    exit(1);
}

$insApp = $pdo->prepare("INSERT INTO app_settings (`k`,`v`) VALUES (?,?) ON DUPLICATE KEY UPDATE `v` = VALUES(`v`)");
$insUser = $pdo->prepare("INSERT INTO user_settings (`user_id`,`k`,`v`) VALUES (?,?,?) ON DUPLICATE KEY UPDATE `v` = VALUES(`v`)");

$globalPrefixes = ['Dragon_company_', 'Dragon_tax_rate', 'Dragon_sales_calc_order', 'Dragon_currency', 'Dragon_product_source', 'Dragon_delivery_method'];

$count = 0;
foreach ($data as $k => $v) {
    $isGlobal = false;
    foreach ($globalPrefixes as $p) { if (strpos($k, $p) === 0) { $isGlobal = true; break; } }
    try {
        if ($isGlobal) {
            $insApp->execute([$k, is_scalar($v) ? (string)$v : json_encode($v)]);
            $count++;
        } else {
            if ($userId === null) continue;
            $insUser->execute([$userId, $k, is_scalar($v) ? (string)$v : json_encode($v)]);
            $count++;
        }
    } catch (Exception $e) {
        // ignore
    }
}

echo "Imported $count items.\n";
exit(0);
