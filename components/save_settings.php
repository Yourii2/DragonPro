<?php
session_start();
// CORS
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if ($origin) header('Access-Control-Allow-Origin: ' . $origin);
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Access-Control-Allow-Credentials: true');
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit(0);
}

if (!file_exists(__DIR__ . '/../config.php')) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Configuration file not found. Please run setup.']);
    exit;
}
require_once __DIR__ . '/../config.php';

try {
    $pdo = new PDO("mysql:host=" . DB_HOST . ";dbname=" . DB_NAME . ";charset=utf8mb4", DB_USER, DB_PASS);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Database connection failed.']);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true);

try {
    // Helper to detect app_settings key/value column names
    function detectAppSettingsCols($pdo) {
        try {
            $check = $pdo->query("SHOW TABLES LIKE 'app_settings'")->fetch();
            if (!$check) return null;
            $cols = $pdo->query("SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'app_settings'")->fetchAll(PDO::FETCH_COLUMN);
            if (in_array('name', $cols) && in_array('value', $cols)) return ['name','value'];
            if (in_array('k', $cols) && in_array('v', $cols)) return ['k','v'];
            if (in_array('key', $cols) && in_array('value', $cols)) return ['key','value'];
            if (count($cols) >= 2) return [$cols[0], $cols[1]];
            return null;
        } catch (Exception $e) {
            return null;
        }
    }

    // Determine which settings table/columns to use
    $appCols = detectAppSettingsCols($pdo);
    if ($appCols) {
        list($kcol, $vcol) = $appCols;
        $insertSql = "INSERT INTO app_settings (`" . str_replace('`','', $kcol) . "`, `" . str_replace('`','', $vcol) . "`) VALUES (?, ?) ON DUPLICATE KEY UPDATE `" . str_replace('`','', $vcol) . "` = VALUES(`" . str_replace('`','', $vcol) . "`)";

        $stmt = $pdo->prepare($insertSql);
    } else {
        // fallback to legacy settings table
        $stmt = $pdo->prepare("INSERT INTO settings (config_key, config_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE config_value = VALUES(config_value)");
    }

    // Load current settings into $current for verification of verified emails etc.
    $current = [];
    if ($appCols) {
        try {
            $rows = $pdo->query("SELECT `" . $kcol . "`, `" . $vcol . "` FROM app_settings")->fetchAll(PDO::FETCH_ASSOC);
            foreach ($rows as $r) {
                $current[(string)$r[$kcol]] = $r[$vcol];
            }
        } catch (Exception $e) { $current = []; }
    } else {
        try {
            $curStmt = $pdo->query("SELECT config_key, config_value FROM settings");
            $current = $curStmt->fetchAll(PDO::FETCH_KEY_PAIR);
        } catch (Exception $e) { $current = []; }
    }

    $incoming_backup_email = $input['backup_email'] ?? '';
    $prev_backup_email = $current['backup_email'] ?? '';
    $backup_email_verified = ($incoming_backup_email && $incoming_backup_email === $prev_backup_email) ? ($current['backup_email_verified'] ?? 'false') : 'false';

    $incoming_report_email = $input['report_email'] ?? '';
    $prev_report_email = $current['report_email'] ?? '';
    $report_email_verified = ($incoming_report_email && $incoming_report_email === $prev_report_email) ? ($current['report_email_verified'] ?? 'false') : 'false';

    $settings = [
        'company_name' => $input['company_name'] ?? '',
        'company_phone' => $input['company_phone'] ?? '',
        'company_address' => $input['company_address'] ?? '',
        'company_terms' => $input['company_terms'] ?? '',
        'company_logo' => $input['company_logo'] ?? '',
        'tax_rate' => $input['tax_rate'] ?? '14',
        'sales_calc_order' => $input['sales_calc_order'] ?? 'discount_then_tax',
        // New settings: sales display method and product source
        'sales_display_method' => $input['sales_display_method'] ?? 'company',
        'product_source' => $input['product_source'] ?? 'both',
        // New setting: delivery method
        'delivery_method' => $input['delivery_method'] ?? 'reps',
        // New setting: default sale price source ('product' | 'order')
        'sale_price_source' => $input['sale_price_source'] ?? 'product',
        // New setting: purchase price type used in receiving & returns ('full_cost' | 'vendor_price')
        'purchase_price_type' => $input['purchase_price_type'] ?? 'full_cost',
        'currency' => $input['currency'] ?? 'EGP',
        'auto_backup' => $input['auto_backup'] ?? 'false',
        'backup_frequency' => $input['backup_frequency'] ?? 'daily',
        'backup_email' => $incoming_backup_email,
        'backup_email_verified' => $backup_email_verified,
        'report_email' => $incoming_report_email,
        'report_email_verified' => $report_email_verified,
        'report_daily_sales' => $input['report_daily_sales'] ?? 'false',
        'report_daily_treasury' => $input['report_daily_treasury'] ?? 'false',
        'report_daily_audit' => $input['report_daily_audit'] ?? 'false',
        'report_auto' => $input['report_auto'] ?? 'false',
        'wa_templates' => $input['wa_templates'] ?? ''
    ];

    // If company logo is a data URL, persist it to app_files and set company_logo_file_id
    if (!empty($input['company_logo']) && strpos($input['company_logo'], 'data:') === 0) {
        try {
            // parse data URI
            if (preg_match('/^data:(.*?);base64,(.*)$/', $input['company_logo'], $m)) {
                $mime = $m[1];
                $b64 = $m[2];
                $bin = base64_decode($b64);
                if ($bin !== false) {
                    $sha1 = sha1($bin);
                    // ensure app_files table exists
                    try {
                        $pdo->exec("CREATE TABLE IF NOT EXISTS `app_files` (
                            `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
                            `filename` VARCHAR(255) NOT NULL,
                            `mime` VARCHAR(120) DEFAULT NULL,
                            `sha1` CHAR(40) DEFAULT NULL,
                            `data` LONGBLOB NOT NULL,
                            `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                            PRIMARY KEY (`id`),
                            UNIQUE KEY `uk_app_files_sha1` (`sha1`)
                        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;");
                    } catch (Exception $e) {
                        // If table creation fails, log the error but continue without saving the logo file
                        error_log("Failed to create app_files table: " . $e->getMessage());
                        return; // Skip logo processing
                    }

                    $checkFile = $pdo->prepare("SELECT id FROM app_files WHERE sha1 = :sha1 LIMIT 1");
                    $checkFile->execute([':sha1' => $sha1]);
                    $frow = $checkFile->fetch(PDO::FETCH_ASSOC);
                    if ($frow) {
                        $fileId = (int)$frow['id'];
                    } else {
                        $insFile = $pdo->prepare("INSERT INTO app_files (filename, mime, sha1, data) VALUES (:fn, :mime, :sha1, :data)");
                        $fn = 'company_logo_' . time();
                        $insFile->execute([':fn' => $fn, ':mime' => $mime, ':sha1' => $sha1, ':data' => $bin]);
                        $fileId = (int)$pdo->lastInsertId();
                    }

                    // Only set the logo file ID if app_files table exists
                    if ($fileId > 0) {
                        $settings['company_logo_file_id'] = (string)$fileId;
                    } else {
                        // Remove logo file ID if it was set previously
                        unset($settings['company_logo_file_id']);
                    }
                }
            }
        } catch (Exception $e) {
            // non-fatal: continue saving other settings
        }
    }

    foreach ($settings as $key => $value) {
        // execute prepared statement which was built to target either app_settings or settings
        $stmt->execute([$key, is_scalar($value) ? (string)$value : json_encode($value)]);
    }

    echo json_encode(['success' => true, 'message' => 'Settings saved successfully.']);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Failed to save settings.']);
    exit;
}

