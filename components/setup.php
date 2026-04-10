<?php
session_start();

// Ensure we always return clean JSON (no warnings/HTML mixed in)
@ini_set('display_errors', '0');
@ini_set('html_errors', '0');
@ini_set('log_errors', '1');
error_reporting(0);
if (function_exists('ob_start')) { @ob_start(); }

// CORS (needed when running frontend on Vite dev server)
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if ($origin) header('Access-Control-Allow-Origin: ' . $origin);
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Access-Control-Allow-Credentials: true');
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit(0);
}

$input = json_decode(file_get_contents('php://input'), true);

// --- 1. Validate Input ---
$required_fields = ['dbHost', 'dbUser', 'dbName', 'companyName', 'adminName', 'adminUsername', 'adminPass'];
foreach ($required_fields as $field) {
    if (empty($input[$field])) {
        http_response_code(400);
        if (function_exists('ob_clean')) { @ob_clean(); }
        echo json_encode(['success' => false, 'message' => "Field '$field' is required."]);
        exit;
    }
}

$dbHost = $input['dbHost'];
$dbUser = $input['dbUser'];
$dbPass = $input['dbPass'] ?? ''; // Password can be empty
$dbName = $input['dbName'];

// --- 2. Create Config File ---
$config_content = "<?php
define('DB_HOST', '{$dbHost}');
define('DB_USER', '{$dbUser}');
define('DB_PASS', '{$dbPass}');
define('DB_NAME', '{$dbName}');
?>";

$config_path = __DIR__ . '/../config.php';
if (file_put_contents($config_path, $config_content) === false) {
    http_response_code(500);
    if (function_exists('ob_clean')) { @ob_clean(); }
    echo json_encode(['success' => false, 'message' => 'Failed to create config file. Check permissions.']);
    exit;
}

// --- 3. Database Connection & Setup ---
try {
    // Connect without specifying DB to use the database
    $pdo_init = new PDO("mysql:host=$dbHost", $dbUser, $dbPass);
    $pdo_init->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    // Connect to the specific database (already created during connection test)
    $pdo = new PDO("mysql:host=$dbHost;dbname=$dbName;charset=utf8mb4", $dbUser, $dbPass);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    // Helper: detect app_settings column names (returns [keyCol, valCol] or null)
    function detectAppSettingsCols($pdo) {
        try {
            $check = $pdo->query("SHOW TABLES LIKE 'app_settings'")->fetch();
            if (!$check) return null;
            $cols = $pdo->query("SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'app_settings'")->fetchAll(PDO::FETCH_COLUMN);
            // Common variants
            if (in_array('name', $cols) && in_array('value', $cols)) return ['name', 'value'];
            if (in_array('k', $cols) && in_array('v', $cols)) return ['k', 'v'];
            if (in_array('key', $cols) && in_array('value', $cols)) return ['key', 'value'];
            // Fallback to first two columns if present
            if (count($cols) >= 2) return [$cols[0], $cols[1]];
            return null;
        } catch (Exception $e) {
            return null;
        }
    }

    // Determine if this is a fresh database (no base tables present before applying schema)
    try {
        $initialTableCount = (int)$pdo->query("SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_TYPE = 'BASE TABLE'")->fetchColumn();
    } catch (Exception $e) {
        $initialTableCount = 0;
    }
    $isFreshInstall = ($initialTableCount === 0);

    // --- 4. Execute SQL Schema ---
    $sql_schema = $input['sql_schema'];
    // Remove UTF-8 BOM if present (prevents syntax errors like "﻿SET NAMES ...").
    if (substr($sql_schema, 0, 3) === "\xEF\xBB\xBF") {
        $sql_schema = substr($sql_schema, 3);
    }
    // Normalize escaped backticks coming from JSON/TS template strings.
    $sql_schema = str_replace('\`', '`', $sql_schema);
    
    // Split schema into individual statements
    $statements = preg_split('/;\s*\r?\n/', $sql_schema);
    
    // Execute each statement separately and skip if table already exists
    foreach ($statements as $statement) {
        $statement = trim($statement);
        if (empty($statement)) continue;
        
        // Check if it's a CREATE TABLE statement
        if (preg_match('/^CREATE TABLE/i', $statement)) {
            // Extract table name
            if (preg_match('/CREATE TABLE (?:IF NOT EXISTS )?`?([^` ]+)`?/i', $statement, $matches)) {
                $tableName = $matches[1];
                
                // Check if table already exists
                $checkTable = $pdo->query("SHOW TABLES LIKE '" . $tableName . "'");
                if ($checkTable && $checkTable->rowCount() > 0) {
                    // Skip this statement if table exists
                    continue;
                }
            }
        }
        
        // Execute the statement
        try {
            $pdo->exec($statement);
        } catch (PDOException $e) {
            // Skip error if table already exists
            if (strpos($e->getMessage(), 'already exists') === false) {
                throw $e;
            }
        }
    }

    // --- 4.5. Reset Auto Increment Values ---
    // If this was a fresh database (installer created the schema), perform an installer-only
    // truncation of all base tables so AUTO_INCREMENT values start from 1. This is destructive
    // and MUST NOT run during updates. We only run it here because we detected the DB was
    // empty before applying the schema.
    if (!empty($isFreshInstall)) {
        // Installer-only truncation helper (kept local to avoid colliding with migrations functions)
        function truncateAllTablesAndResetInstaller(PDO $pdo) {
            try {
                error_log("Installer: truncating all base tables to ensure AUTO_INCREMENT starts at 1");
                $tables = $pdo->query("SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_TYPE = 'BASE TABLE'")->fetchAll(PDO::FETCH_COLUMN);
                if (!$tables) {
                    error_log("Installer: no tables found to truncate.");
                    return;
                }
                $pdo->exec('SET FOREIGN_KEY_CHECKS = 0');
                foreach ($tables as $t) {
                    try {
                        $pdo->exec("TRUNCATE TABLE `" . str_replace('`', '``', $t) . "`");
                    } catch (Exception $e) {
                        error_log("Installer: failed to truncate $t: " . $e->getMessage());
                    }
                }
                $pdo->exec('SET FOREIGN_KEY_CHECKS = 1');
                error_log("Installer: truncation complete.");
            } catch (Exception $e) {
                try { $pdo->exec('SET FOREIGN_KEY_CHECKS = 1'); } catch (Exception $_) {}
                error_log("Installer: truncation error: " . $e->getMessage());
            }
        }

        try {
            truncateAllTablesAndResetInstaller($pdo);
        } catch (Exception $e) {
            // Non-fatal: continue install but log
            error_log('Installer truncation failed: ' . $e->getMessage());
        }
    }

    try {
        // Reset AUTO_INCREMENT for every base table to 1 so the first inserted row has ID = 1.
        // This is safe here because truncation already emptied the tables for a fresh install.
        $baseTables = $pdo->query("SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_TYPE = 'BASE TABLE'")->fetchAll(PDO::FETCH_COLUMN);
        if ($baseTables) {
            foreach ($baseTables as $tname) {
                try {
                    $pdo->exec("ALTER TABLE `" . str_replace('`','``',$tname) . "` AUTO_INCREMENT = 1");
                } catch (Exception $e) {
                    error_log("Failed to set AUTO_INCREMENT=1 for $tname: " . $e->getMessage());
                }
            }
        }
    } catch (Exception $e) {
        // Non-fatal error: continue with installation
        error_log("Auto increment reset error: " . $e->getMessage());
    }

    // --- 5. Insert Initial Data ---
    // Admin User
    $stmt = $pdo->prepare("INSERT INTO users (name, username, password, role) VALUES (?, ?, ?, 'admin')");
$hashed_password = password_hash($input['adminPass'], PASSWORD_DEFAULT);
$stmt->execute([$input['adminName'], $input['adminUsername'], $hashed_password]);

    // Get the admin user ID
    $admin_id = $pdo->lastInsertId();

    // Grant all sidebar sections to admin (page-level visibility).
    // NOTE: the app defaults to allow when a page_slug row is missing, but we still insert explicit rows
    // so that permissions are clear and consistent across installs.
    $all_pages = [
        'dashboard',
        'factory-stock',
        'factory-management',
        'manufacturing-management',
        'dispatch',
        'factory-receiving',
        'inventory',
        'orders',
        'sales',
        'crm',
        'srm',
        'reps',
        'hrm',
        'workers',
        'finance',
        'reports',
        'admin',
        'permissions',
        'attendance',
        'sales-offices',
        'barcode-print',
        'settings'
    ];
    $perm_stmt = $pdo->prepare("INSERT IGNORE INTO user_page_permissions (user_id, page_slug, can_access) VALUES (?, ?, 1)");
    foreach ($all_pages as $page) {
        $perm_stmt->execute([$admin_id, $page]);
    }

    // Grant all action-level permissions to admin (if permissions tables exist)
    try {
        $hasPermTables = true;
        foreach (['permission_modules', 'permission_actions', 'user_permissions'] as $t) {
            $check = $pdo->query("SHOW TABLES LIKE '" . $t . "'");
            if (!$check || $check->rowCount() === 0) { $hasPermTables = false; break; }
        }
        if ($hasPermTables) {
            $pdo->exec("INSERT IGNORE INTO user_permissions (user_id, module_id, action_id, allowed)\n                       SELECT " . intval($admin_id) . ", m.id, a.id, 1\n                       FROM permission_modules m\n                       CROSS JOIN permission_actions a");
        }
    } catch (Exception $e) {
        // don't fail installation if permissions seeding fails
    }

    // Ensure user defaults row exists for admin (if table exists)
    try {
        $check = $pdo->query("SHOW TABLES LIKE 'user_defaults'");
        if ($check && $check->rowCount() > 0) {
            $stmt = $pdo->prepare("INSERT IGNORE INTO user_defaults (user_id, default_warehouse_id, default_treasury_id, default_sales_office_id, can_change_warehouse, can_change_treasury, can_change_sales_office) VALUES (?, NULL, NULL, NULL, 1, 1, 1)");
            $stmt->execute([$admin_id]);
        }
    } catch (Exception $e) {
        // ignore
    }

    require_once __DIR__ . '/activation_utils.php';
    $hwid = get_hwid();
    $activationResult = call_activation_service($hwid, $input['companyPhone'] ?? '', $input['companyName']);
    if (!$activationResult['success']) {
        http_response_code(502);
        if (function_exists('ob_clean')) { @ob_clean(); }
        echo json_encode(['success' => false, 'message' => $activationResult['message']]);
        exit;
    }

    $activationData = $activationResult['data'];
    $activationType = $activationData['type'] ?? 'Trial';
    $activationExpiry = $activationData['expiry'] ?? '';
    $activationAccountStatus = $activationData['account_status'] ?? 'Active';
    $activationIsExpired = !empty($activationData['is_expired']) ? 'true' : 'false';
    $activationLastCheck = date('Y-m-d H:i:s');

    // Company Settings
    $settings = [
        'company_name' => $input['companyName'],
        'company_phone' => $input['companyPhone'],
        'company_address' => $input['companyAddress'],
        'company_terms' => $input['companyTerms'],
        // use installer-provided tax & currency when available
        'tax_rate' => isset($input['taxRate']) ? (string)$input['taxRate'] : '14',
        'currency' => isset($input['currency']) ? $input['currency'] : 'EGP',
        'auto_backup' => 'false',
        'backup_frequency' => 'daily',
        'activation_type' => $activationType,
        'activation_expiry' => $activationExpiry,
        'activation_account_status' => $activationAccountStatus,
        'activation_is_expired' => $activationIsExpired,
        'activation_last_check' => $activationLastCheck,
        'activation_hwid' => $hwid,
        // New installer options (product/sales/currency)
        'product_source' => $input['productSource'] ?? 'both',
        'purchase_price_type' => $input['purchasePriceType'] ?? 'full_cost',
        'sales_display_method' => $input['salesDisplayMethod'] ?? 'company',
        'sale_price_source' => $input['salePriceSource'] ?? 'product'
    ];
    
    // Handle company logo separately if it's too large
    if (!empty($input['companyLogo'])) {
        // Check if it's a data URL (base64 encoded image)
        if (strpos($input['companyLogo'], 'data:') === 0) {
            // For data URLs, we handle them separately to avoid truncation
            $logoData = $input['companyLogo'];
            unset($settings['company_logo']);

            // Determine whether to use app_settings (new) or legacy settings table
            $useAppSettings = false;
            try {
                $checkApp = $pdo->query("SHOW TABLES LIKE 'app_settings'")->fetch();
                if ($checkApp) $useAppSettings = true;
            } catch (Exception $e) { /* ignore */ }

            // Prepare setting statement using detected columns when app_settings exists
            $appCols = detectAppSettingsCols($pdo);
            if ($appCols) {
                list($kcol, $vcol) = $appCols;
                $sql = "INSERT INTO app_settings (`" . str_replace('`','', $kcol) . "`, `" . str_replace('`','', $vcol) . "`) VALUES (?, ?) ON DUPLICATE KEY UPDATE `" . str_replace('`','', $vcol) . "` = VALUES(`" . str_replace('`','', $vcol) . "`)";

                $setting_stmt = $pdo->prepare($sql);
            } else {
                $setting_stmt = $pdo->prepare("INSERT INTO settings (config_key, config_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE config_value = VALUES(config_value)");
            }

            // Insert other settings first using chosen table
            foreach ($settings as $key => $value) {
                $setting_stmt->execute([$key, $value]);
            }

            // Then handle the logo separately
            try {
                if (preg_match('/^data:(.*?);base64,(.*)$/', $logoData, $m)) {
                    $mime = $m[1];
                    $b64 = $m[2];
                    $bin = base64_decode($b64);
                    if ($bin !== false) {
                        $sha1 = sha1($bin);
                        // Ensure app_files table exists
                        $pdo->exec(file_get_contents(__DIR__ . '/../migrations/2026_04_03_create_app_files.sql'));
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

                        // store file id in chosen settings table
                        if ($appCols) {
                            list($kcol, $vcol) = $appCols;
                            $sql = "INSERT INTO app_settings (`" . str_replace('`','', $kcol) . "`, `" . str_replace('`','', $vcol) . "`) VALUES (:k, :v) ON DUPLICATE KEY UPDATE `" . str_replace('`','', $vcol) . "` = VALUES(`" . str_replace('`','', $vcol) . "`)";

                            $up = $pdo->prepare($sql);
                            $up->execute([':k' => 'company_logo_file_id', ':v' => (string)$fileId]);
                        } else {
                            $up = $pdo->prepare("INSERT INTO settings (config_key, config_value) VALUES (:k, :v) ON DUPLICATE KEY UPDATE config_value = VALUES(config_value)");
                            $up->execute([':k' => 'company_logo_file_id', ':v' => (string)$fileId]);
                        }
                    }
                }
            } catch (Exception $e) {
                // Non-fatal: continue without logo
            }
        } else {
            // For regular URLs, insert normally
            $settings['company_logo'] = $input['companyLogo'];
        }
    }
    // Insert or update settings
    // Prefer app_settings table when present
    try {
        $appCols = detectAppSettingsCols($pdo);
        $useAppSettings = (bool)$appCols;
    } catch (Exception $e) { $useAppSettings = false; }
    if ($useAppSettings) {
        list($kcol, $vcol) = $appCols;
        $sql = "INSERT INTO app_settings (`" . str_replace('`','', $kcol) . "`, `" . str_replace('`','', $vcol) . "`) VALUES (?, ?) ON DUPLICATE KEY UPDATE `" . str_replace('`','', $vcol) . "` = VALUES(`" . str_replace('`','', $vcol) . "`)";

        $setting_stmt = $pdo->prepare($sql);
        foreach ($settings as $key => $value) {
            $setting_stmt->execute([$key, is_scalar($value) ? (string)$value : json_encode($value)]);
        }
    } else {
        $setting_stmt = $pdo->prepare("INSERT INTO settings (config_key, config_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE config_value = VALUES(config_value)");
        foreach ($settings as $key => $value) {
            $setting_stmt->execute([$key, is_scalar($value) ? (string)$value : json_encode($value)]);
        }
    }

    // If company logo provided as data URI, save to app_files and set company_logo_file_id (prefer app_settings)
    if (!empty($input['companyLogo']) && strpos($input['companyLogo'], 'data:') === 0) {
        try {
            if (preg_match('/^data:(.*?);base64,(.*)$/', $input['companyLogo'], $m)) {
                $mime = $m[1];
                $b64 = $m[2];
                $bin = base64_decode($b64);
                if ($bin !== false) {
                    $sha1 = sha1($bin);
                    $pdo->exec(file_get_contents(__DIR__ . '/../migrations/2026_04_03_create_app_files.sql'));
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

                    // store file id in app_settings if exists, else in settings
                    $check = $pdo->query("SHOW TABLES LIKE 'app_settings'")->fetch();
                    if ($check) {
                        $appCols = detectAppSettingsCols($pdo);
                        if ($appCols) {
                            list($kcol, $vcol) = $appCols;
                            $sql = "INSERT INTO app_settings (`" . str_replace('`','', $kcol) . "`, `" . str_replace('`','', $vcol) . "`) VALUES (:k, :v) ON DUPLICATE KEY UPDATE `" . str_replace('`','', $vcol) . "` = VALUES(`" . str_replace('`','', $vcol) . "`)";

                            $up = $pdo->prepare($sql);
                            $up->execute([':k' => 'company_logo_file_id', ':v' => (string)$fileId]);
                        } else {
                            $up = $pdo->prepare("INSERT INTO settings (config_key, config_value) VALUES (:k, :v) ON DUPLICATE KEY UPDATE config_value = VALUES(config_value)");
                            $up->execute([':k' => 'company_logo_file_id', ':v' => (string)$fileId]);
                        }
                    } else {
                        $up = $pdo->prepare("INSERT INTO settings (config_key, config_value) VALUES (:k, :v) ON DUPLICATE KEY UPDATE config_value = VALUES(config_value)");
                        $up->execute([':k' => 'company_logo_file_id', ':v' => (string)$fileId]);
                    }
                }
            }
        } catch (Exception $e) {
            // non-fatal
        }
    }

    // --- 6. Create License File ---
    require_once __DIR__ . '/encryption.php';

    // Create license data
    $license_data = [
        'hwid' => $hwid,
        'company_name' => $input['companyName'],
        'company_phone' => $input['companyPhone'],
        'installed_date' => date('Y-m-d H:i:s'),
        'activation_type' => $activationType,
        'activation_expiry' => $activationExpiry,
        'activation_account_status' => $activationAccountStatus,
        'activation_is_expired' => $activationIsExpired,
        'activation_last_check' => $activationLastCheck,
        'version' => '1.0.3'
    ];
    
    // Encrypt and save license file
    $license_path = __DIR__ . '/../Dragon.lic';
    $encrypted_license = encrypt_data(json_encode($license_data));
    file_put_contents($license_path, $encrypted_license);

    if (function_exists('ob_clean')) { @ob_clean(); }
    echo json_encode([
        'success' => true,
        'message' => 'System installed successfully!',
        'hwid' => $hwid,
        'activation' => [
            'type' => $activationType,
            'expiry' => $activationExpiry,
            'account_status' => $activationAccountStatus,
            'is_expired' => $activationIsExpired
        ]
    ]);

} catch (PDOException $e) {
    // Clean up config file on failure
    if (file_exists($config_path)) {
        unlink($config_path);
    }
    http_response_code(500);
    if (function_exists('ob_clean')) { @ob_clean(); }
    echo json_encode(['success' => false, 'message' => 'Database error: ' . $e->getMessage()]);
    exit;
}

if (function_exists('ob_end_flush')) { @ob_end_flush(); }
?>