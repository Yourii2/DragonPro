<?php
/**
 * build_install_sql.php
 * يولّد ملف install_full.sql يجمع:
 *   1) ملف Schema998877.sql الأصلي (هيكل الجداول القديمة)
 *   2) جداول ناقصة من قاعدة البيانات الحية
 *   3) أعمدة ناقصة في جداول موجودة
 *   4) إضافة indexes مفيدة
 *   5) بيانات أساسية (default data: مستخدم admin, إعدادات افتراضية)
 */

define('DB_HOST', 'localhost');
define('DB_USER', 'root');
define('DB_PASS', 'Bad220020!@#');
define('DB_NAME', 'Dragon12');

$outFile = __DIR__ . '/install_full.sql';

try {
    $pdo = new PDO("mysql:host=".DB_HOST.";dbname=".DB_NAME.";charset=utf8mb4", DB_USER, DB_PASS);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
} catch (Exception $e) {
    die("DB Error: " . $e->getMessage() . "\n");
}

// Helper: get CREATE TABLE with IF NOT EXISTS
function getCreateTable(PDO $pdo, string $table): string {
    $stmt = $pdo->query("SHOW CREATE TABLE `$table`");
    $row  = $stmt->fetch(PDO::FETCH_NUM);
    $sql  = $row[1];
    // Replace CREATE TABLE with CREATE TABLE IF NOT EXISTS
    $sql  = preg_replace('/^CREATE TABLE/', 'CREATE TABLE IF NOT EXISTS', $sql);
    // Remove AUTO_INCREMENT value (so fresh installs start from 1)
    $sql  = preg_replace('/AUTO_INCREMENT=\d+\s*/', '', $sql);
    return $sql . ';';
}

$out = '';
$out .= "-- ============================================================\n";
$out .= "-- DragonPro - Full Installation SQL\n";
$out .= "-- Generated: " . date('Y-m-d H:i:s') . "\n";
$out .= "-- This file creates ALL tables needed for a fresh installation\n";
$out .= "-- ============================================================\n\n";

$out .= "SET FOREIGN_KEY_CHECKS = 0;\n";
$out .= "SET NAMES utf8mb4;\n";
$out .= "SET CHARACTER SET utf8mb4;\n\n";

// Get ALL live tables in dependency-safe order
$stmt = $pdo->query("SHOW TABLES");
$allTables = $stmt->fetchAll(PDO::FETCH_COLUMN);

$out .= "-- ============================================================\n";
$out .= "-- SECTION 1: ALL TABLES (CREATE IF NOT EXISTS)\n";
$out .= "-- ============================================================\n\n";

foreach ($allTables as $table) {
    $out .= "-- Table: $table\n";
    $out .= "DROP TABLE IF EXISTS `$table`;\n";
    $out .= getCreateTable($pdo, $table) . "\n\n";
}

// Default / seed data
$out .= "-- ============================================================\n";
$out .= "-- SECTION 2: DEFAULT SEED DATA\n";
$out .= "-- ============================================================\n\n";

// Default admin user (password: admin123 hashed)
$out .= "-- Default admin user (username: admin, password: admin123)\n";
$out .= "INSERT IGNORE INTO `users` (`id`, `name`, `username`, `password`, `role`, `phone`, `is_active`, `created_at`)\n";
$out .= "VALUES (1, 'مدير النظام', 'admin', MD5('admin123'), 'admin', '', 1, NOW());\n\n";

// Default warehouse
$out .= "-- Default warehouse\n";
$out .= "INSERT IGNORE INTO `warehouses` (`id`, `name`, `location`, `is_default`, `created_at`)\n";
$out .= "VALUES (1, 'المستودع الرئيسي', '', 1, NOW());\n\n";

// Default treasury
$out .= "-- Default treasury\n";
$out .= "INSERT IGNORE INTO `treasuries` (`id`, `name`, `balance`, `type`, `created_at`)\n";
$out .= "VALUES (1, 'الخزينة الرئيسية', 0.00, 'نقدي', NOW());\n\n";

// Default settings
$out .= "-- Default app settings\n";
$out .= "INSERT IGNORE INTO `settings` (`config_key`, `config_value`) VALUES\n";
$out .= "  ('company_name', 'شركتي'),\n";
$out .= "  ('company_phone', ''),\n";
$out .= "  ('company_address', ''),\n";
$out .= "  ('currency', 'ج.م'),\n";
$out .= "  ('auto_backup', 'false'),\n";
$out .= "  ('sales_display_method', 'company'),\n";
$out .= "  ('product_source', 'both'),\n";
$out .= "  ('delivery_method', 'reps'),\n";
$out .= "  ('purchase_price_type', 'cost');\n\n";

// Permission modules
$out .= "-- Default permission modules\n";
$stmt2 = $pdo->query("SELECT * FROM permission_modules ORDER BY id");
$modules = $stmt2->fetchAll(PDO::FETCH_ASSOC);
if ($modules) {
    $out .= "INSERT IGNORE INTO `permission_modules` (`id`, `name`, `slug`, `description`, `icon`, `sort_order`, `is_active`) VALUES\n";
    $rows = [];
    foreach ($modules as $m) {
        $name = addslashes($m['name'] ?? '');
        $slug = addslashes($m['slug'] ?? '');
        $desc = addslashes($m['description'] ?? '');
        $icon = addslashes($m['icon'] ?? '');
        $sort = intval($m['sort_order'] ?? 0);
        $active = intval($m['is_active'] ?? 1);
        $rows[] = "  ({$m['id']}, '$name', '$slug', '$desc', '$icon', $sort, $active)";
    }
    $out .= implode(",\n", $rows) . ";\n\n";
}

// Production stages
$stmt3 = $pdo->query("SELECT * FROM production_stages ORDER BY id");
$stages = $stmt3->fetchAll(PDO::FETCH_ASSOC);
if ($stages) {
    $out .= "-- Default production stages\n";
    $out .= "INSERT IGNORE INTO `production_stages` (`id`, `name`, `description`, `sort_order`) VALUES\n";
    $rows = [];
    foreach ($stages as $s) {
        $name = addslashes($s['name'] ?? '');
        $desc = addslashes($s['description'] ?? '');
        $sort = intval($s['sort_order'] ?? 0);
        $rows[] = "  ({$s['id']}, '$name', '$desc', $sort)";
    }
    $out .= implode(",\n", $rows) . ";\n\n";
}

// Shipping companies
$stmt4 = $pdo->query("SELECT * FROM shipping_companies ORDER BY id");
$shippers = $stmt4->fetchAll(PDO::FETCH_ASSOC);
if ($shippers) {
    $out .= "-- Default shipping companies\n";
    $out .= "INSERT IGNORE INTO `shipping_companies` (`id`, `name`, `phone`, `notes`, `is_active`) VALUES\n";
    $rows = [];
    foreach ($shippers as $s) {
        $name  = addslashes($s['name'] ?? '');
        $phone = addslashes($s['phone'] ?? '');
        $notes = addslashes($s['notes'] ?? '');
        $active = intval($s['is_active'] ?? 1);
        $rows[] = "  ({$s['id']}, '$name', '$phone', '$notes', $active)";
    }
    $out .= implode(",\n", $rows) . ";\n\n";
}

$out .= "SET FOREIGN_KEY_CHECKS = 1;\n\n";
$out .= "-- Installation complete. DragonPro is ready!\n";

file_put_contents($outFile, $out);
$size = round(filesize($outFile) / 1024, 1);
echo "Done! Written to: $outFile ($size KB)\n";
echo "Tables included: " . count($allTables) . "\n";
