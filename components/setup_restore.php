<?php
session_start();

// Ensure clean JSON output
@ini_set('display_errors', '0');
@ini_set('html_errors', '0');
@ini_set('log_errors', '1');
error_reporting(0);
if (function_exists('ob_start')) { @ob_start(); }

// CORS
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

// 1. Validate Input
$required = ['dbHost', 'dbUser', 'dbName'];
foreach ($required as $field) {
    if (empty($_POST[$field])) {
        http_response_code(400);
        if (function_exists('ob_clean')) { @ob_clean(); }
        echo json_encode(['success' => false, 'message' => "Field '$field' is required."]);
        exit;
    }
}

if (empty($_FILES['backup']) || $_FILES['backup']['error'] !== UPLOAD_ERR_OK) {
    http_response_code(400);
    if (function_exists('ob_clean')) { @ob_clean(); }
    echo json_encode(['success' => false, 'message' => 'Valid SQL backup file is required.']);
    exit;
}

$dbHost = $_POST['dbHost'];
$dbUser = $_POST['dbUser'];
$dbPass = $_POST['dbPass'] ?? '';
$dbName = $_POST['dbName'];

// 2. Create Config File
$config_content = "<?php\ndefine('DB_HOST', '{$dbHost}');\ndefine('DB_USER', '{$dbUser}');\ndefine('DB_PASS', '{$dbPass}');\ndefine('DB_NAME', '{$dbName}');\n?>";
$config_path = __DIR__ . '/../config.php';

if (file_put_contents($config_path, $config_content) === false) {
    http_response_code(500);
    if (function_exists('ob_clean')) { @ob_clean(); }
    echo json_encode(['success' => false, 'message' => 'Failed to create config.php file. Check directory permissions.']);
    exit;
}

// 3. Connect to Database and Restore
try {
    // Initial connection without DB to create database if missing
    $pdo_init = new PDO("mysql:host=$dbHost", $dbUser, $dbPass);
    $pdo_init->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo_init->exec("CREATE DATABASE IF NOT EXISTS `$dbName` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");

    // Connect to actual database
    $pdo = new PDO("mysql:host=$dbHost;dbname=$dbName;charset=utf8mb4", $dbUser, $dbPass);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    // Read and run SQL file
    $sql = file_get_contents($_FILES['backup']['tmp_name']);
    if (substr($sql, 0, 3) === "\xEF\xBB\xBF") {
        $sql = substr($sql, 3);
    }
    
    // Normalize escaped backticks if any
    $sql = str_replace('\`', '`', $sql);

    // Split SQL by semicolon followed by newline
    $statements = preg_split('/;\s*\r?\n/', $sql);

    $pdo->exec('SET FOREIGN_KEY_CHECKS = 0');
    foreach ($statements as $statement) {
        $statement = trim($statement);
        if ($statement === '') continue;
        try {
            $pdo->exec($statement);
        } catch (PDOException $e) {
            // Ignore minor errors during restore but log them
            error_log("Restore statement warning: " . $e->getMessage());
        }
    }
    $pdo->exec('SET FOREIGN_KEY_CHECKS = 1');

    // 4. Retrieve settings for Activation
    function detectAppSettingsCols($pdo) {
        try {
            $check = $pdo->query("SHOW TABLES LIKE 'app_settings'")->fetch();
            if (!$check) return null;
            $cols = $pdo->query("SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'app_settings'")->fetchAll(PDO::FETCH_COLUMN);
            if (in_array('name', $cols) && in_array('value', $cols)) return ['name', 'value'];
            if (in_array('k', $cols) && in_array('v', $cols)) return ['k', 'v'];
            if (in_array('key', $cols) && in_array('value', $cols)) return ['key', 'value'];
            if (count($cols) >= 2) return [$cols[0], $cols[1]];
            return null;
        } catch (Exception $e) {
            return null;
        }
    }

    $settings = [];
    $checkApp = $pdo->query("SHOW TABLES LIKE 'app_settings'")->fetch();
    if ($checkApp) {
        $appCols = detectAppSettingsCols($pdo);
        if ($appCols) {
            list($kcol, $vcol) = $appCols;
            $stmt = $pdo->query("SELECT `" . $kcol . "`, `" . $vcol . "` FROM app_settings");
            $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
            foreach ($rows as $r) {
                $settings[(string)$r[$kcol]] = $r[$vcol];
            }
        } else {
            $stmt = $pdo->query("SELECT name, value FROM app_settings");
            $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
            foreach ($rows as $r) {
                $settings[$r['name']] = $r['value'];
            }
        }
    } else {
        $checkSettings = $pdo->query("SHOW TABLES LIKE 'settings'")->fetch();
        if ($checkSettings) {
            $stmt = $pdo->query("SELECT config_key, config_value FROM settings");
            $settings = $stmt->fetchAll(PDO::FETCH_KEY_PAIR);
        }
    }

    $companyName = $settings['company_name'] ?? 'DragonPro Institutional';
    $companyPhone = $settings['company_phone'] ?? '';
    $companyLogo = $settings['company_logo'] ?? '';

    // 5. Activate and generate Dragon.lic license
    require_once __DIR__ . '/activation_utils.php';
    require_once __DIR__ . '/encryption.php';

    $hwid = get_hwid();
    $activationResult = call_activation_service($hwid, $companyPhone, $companyName);

    if (!$activationResult['success']) {
        http_response_code(502);
        if (function_exists('ob_clean')) { @ob_clean(); }
        echo json_encode(['success' => false, 'message' => 'Activation check failed after restore: ' . $activationResult['message']]);
        exit;
    }

    $activationData = $activationResult['data'];
    $activationType = $activationData['type'] ?? 'Trial';
    $activationExpiry = $activationData['expiry'] ?? '';
    $activationAccountStatus = $activationData['account_status'] ?? 'Active';
    $activationIsExpired = !empty($activationData['is_expired']) ? 'true' : 'false';
    $activationLastCheck = date('Y-m-d H:i:s');

    // Update settings in database with new activation details
    if ($checkApp) {
        $appCols = detectAppSettingsCols($pdo);
        if ($appCols) {
            list($kcol, $vcol) = $appCols;
            $upSql = "INSERT INTO app_settings (`" . $kcol . "`, `" . $vcol . "`) VALUES (?, ?) ON DUPLICATE KEY UPDATE `" . $vcol . "` = VALUES(`" . $vcol . "`)";
            $upStmt = $pdo->prepare($upSql);
            $upStmt->execute(['activation_type', $activationType]);
            $upStmt->execute(['activation_expiry', $activationExpiry]);
            $upStmt->execute(['activation_account_status', $activationAccountStatus]);
            $upStmt->execute(['activation_is_expired', $activationIsExpired]);
            $upStmt->execute(['activation_last_check', $activationLastCheck]);
            $upStmt->execute(['activation_hwid', $hwid]);
        }
    } else if ($checkSettings) {
        $upStmt = $pdo->prepare("INSERT INTO settings (config_key, config_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE config_value = VALUES(config_value)");
        $upStmt->execute(['activation_type', $activationType]);
        $upStmt->execute(['activation_expiry', $activationExpiry]);
        $upStmt->execute(['activation_account_status', $activationAccountStatus]);
        $upStmt->execute(['activation_is_expired', $activationIsExpired]);
        $upStmt->execute(['activation_last_check', $activationLastCheck]);
        $upStmt->execute(['activation_hwid', $hwid]);
    }

    // Encrypt and write the local license file Dragon.lic
    $license_data = [
        'hwid' => $hwid,
        'company_name' => $companyName,
        'company_phone' => $companyPhone,
        'installed_date' => date('Y-m-d H:i:s'),
        'activation_type' => $activationType,
        'activation_expiry' => $activationExpiry,
        'activation_account_status' => $activationAccountStatus,
        'activation_is_expired' => $activationIsExpired,
        'activation_last_check' => $activationLastCheck,
        'version' => '1.0.3'
    ];

    $license_path = __DIR__ . '/../Dragon.lic';
    $encrypted_license = encrypt_data(json_encode($license_data));
    file_put_contents($license_path, $encrypted_license);

    // Try to auto-register scheduler on the new setup
    try {
        @shell_exec("C:\\xampp\\php\\php.exe " . escapeshellarg(__DIR__ . '/auto_register_scheduler.php'));
    } catch (Exception $e) {}

    // Expose resolved logo URL if database had one
    $logoUrl = $companyLogo;
    if ($checkApp && !empty($settings['company_logo_file_id']) && is_numeric($settings['company_logo_file_id'])) {
        $id = intval($settings['company_logo_file_id']);
        $proto = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
        $host = $_SERVER['HTTP_HOST'] ?? '';
        $base = rtrim(dirname($_SERVER['SCRIPT_NAME']), '/');
        $logoUrl = $proto . '://' . $host . $base . '/get_file.php?id=' . $id;
    }

    if (function_exists('ob_clean')) { @ob_clean(); }
    echo json_encode([
        'success' => true,
        'message' => 'Database backup restored and activated successfully!',
        'companyName' => $companyName,
        'companyLogo' => $logoUrl,
        'activation' => [
            'type' => $activationType,
            'expiry' => $activationExpiry,
            'account_status' => $activationAccountStatus,
            'is_expired' => $activationIsExpired
        ]
    ]);

} catch (Exception $e) {
    if (file_exists($config_path)) {
        unlink($config_path);
    }
    http_response_code(500);
    if (function_exists('ob_clean')) { @ob_clean(); }
    echo json_encode(['success' => false, 'message' => 'Restore failed: ' . $e->getMessage()]);
    exit;
}

if (function_exists('ob_end_flush')) { @ob_end_flush(); }
?>
