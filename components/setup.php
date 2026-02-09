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
    
    // --- 4. Execute SQL Schema ---
    $sql_schema = $input['sql_schema'];
    // Normalize escaped backticks coming from JSON/TS template strings.
    $sql_schema = str_replace('\`', '`', $sql_schema);
    $pdo->exec($sql_schema);

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
        'company_logo' => $input['companyLogo'],
        'tax_rate' => '14',
        'currency' => 'EGP',
        'auto_backup' => 'false',
        'backup_frequency' => 'daily',
        'activation_type' => $activationType,
        'activation_expiry' => $activationExpiry,
        'activation_account_status' => $activationAccountStatus,
        'activation_is_expired' => $activationIsExpired,
        'activation_last_check' => $activationLastCheck,
        'activation_hwid' => $hwid,
    ];
    $setting_stmt = $pdo->prepare("INSERT INTO settings (config_key, config_value) VALUES (?, ?)");
    foreach ($settings as $key => $value) {
        $setting_stmt->execute([$key, $value]);
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
        'version' => '1.0.0'
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