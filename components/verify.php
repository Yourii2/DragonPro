<?php
session_start();

// CORS
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if ($origin) header('Access-Control-Allow-Origin: ' . $origin);
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Access-Control-Allow-Credentials: true');
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit(0); }

require_once __DIR__ . '/encryption.php';
require_once __DIR__ . '/activation_utils.php';

$config_path = __DIR__ . '/../config.php';
$license_path = __DIR__ . '/../Dragon.lic';

// 1. Check if system is installed at all
if (!file_exists($config_path) || !file_exists($license_path)) {
    echo json_encode(['status' => 'not_installed']);
    exit;
}

// 2. Read and decrypt license file
$encrypted_data = file_get_contents($license_path);
$decrypted_json = decrypt_data($encrypted_data);

if ($decrypted_json === false) {
    echo json_encode(['status' => 'tampered', 'message' => 'ملف الترخيص تالف أو تم العبث به.']);
    exit;
}

$license_data = json_decode($decrypted_json, true);
if (!is_array($license_data)) {
    echo json_encode(['status' => 'tampered', 'message' => 'ملف الترخيص تالف أو تم العبث به.']);
    exit;
}

// 3. Verify HWID + refresh activation when online (throttled)
$server_hwid = get_hwid();
$license_hwid = $license_data['hwid'] ?? '';
$activation_updated = false;

$last_check_raw = $license_data['activation_last_check'] ?? '';
$last_check_ts = $last_check_raw ? strtotime($last_check_raw) : false;
$input_raw = @file_get_contents('php://input');
$input_json = $input_raw ? json_decode($input_raw, true) : [];
$force_flag = false;
if (is_array($input_json) && !empty($input_json['force'])) $force_flag = true;
if (isset($_GET['force']) && ($_GET['force'] === '1' || $_GET['force'] === 'true')) $force_flag = true;

$should_refresh = $force_flag || ($last_check_ts !== false && ((time() - $last_check_ts) > 86400));

$activationResult = ['success' => false, 'message' => 'Activation check skipped'];
if ($should_refresh) {
    $activationResult = call_activation_service(
        $server_hwid,
        $license_data['company_phone'] ?? '',
        $license_data['company_name'] ?? ''
    );
}

if ($activationResult['success']) {
    $activationData = $activationResult['data'] ?? [];
    $next_license = $license_data;
    $next_license['hwid'] = $server_hwid;
    $next_license['activation_type'] = $activationData['type'] ?? '';
    $next_license['activation_expiry'] = $activationData['expiry'] ?? '';
    $next_license['activation_account_status'] = $activationData['account_status'] ?? 'Active';
    $next_license['activation_is_expired'] = !empty($activationData['is_expired']) ? 'true' : 'false';
    $next_license['activation_last_check'] = date('Y-m-d H:i:s');

    $fields = ['hwid','activation_type','activation_expiry','activation_account_status','activation_is_expired','activation_last_check'];
    $diff = false;
    foreach ($fields as $f) {
        if (($license_data[$f] ?? '') !== ($next_license[$f] ?? '')) { $diff = true; break; }
    }

    if ($diff) {
        $encrypted_license = encrypt_data(json_encode($next_license));
        file_put_contents($license_path, $encrypted_license);
        $license_data = $next_license;
        $activation_updated = true;
    }
    $license_hwid = $server_hwid;
} else {
    // Offline or activation service unreachable: use local license as-is
    $license_hwid = $license_hwid ?: $server_hwid;
}

// 4. Verify activation status
$activation_type = $license_data['activation_type'] ?? '';
$activation_expiry = $license_data['activation_expiry'] ?? '';
$activation_account_status = $license_data['activation_account_status'] ?? 'Active';
$activation_is_expired = ($license_data['activation_is_expired'] ?? 'false') === 'true';

if (!empty($activation_expiry)) {
    $expiry_ts = strtotime($activation_expiry);
    if ($expiry_ts !== false && time() > $expiry_ts) {
        $activation_is_expired = true;
    }
}

$activation_type_norm = strtolower(trim((string)$activation_type));
$is_trial = $activation_type_norm === 'trial';

if (strtolower($activation_account_status) === 'blocked') {
    echo json_encode(['status' => 'activation_blocked', 'message' => 'تم حظر هذا الترخيص.']);
    exit;
}

if ($is_trial && $activation_is_expired) {
    echo json_encode(['status' => 'activation_expired', 'message' => 'انتهت صلاحية الترخيص التجريبي.']);
    exit;
}

// 4. If all checks pass, return system status
require_once $config_path;

try {
    $pdo = new PDO("mysql:host=" . DB_HOST . ";dbname=" . DB_NAME . ";charset=utf8mb4", DB_USER, DB_PASS);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    if ($activation_updated) {
        $upsert = $pdo->prepare("INSERT INTO settings (config_key, config_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE config_value = VALUES(config_value)");
        $activationSettings = [
            'activation_type' => $activation_type,
            'activation_expiry' => $activation_expiry,
            'activation_account_status' => $activation_account_status,
            'activation_is_expired' => $activation_is_expired ? 'true' : 'false',
            'activation_last_check' => $license_data['activation_last_check'] ?? date('Y-m-d H:i:s'),
            'activation_hwid' => $license_hwid
        ];
        foreach ($activationSettings as $key => $value) {
            $upsert->execute([$key, $value]);
        }
    }
    
    $stmt = $pdo->query("SELECT config_key, config_value FROM settings");
    $settings = $stmt->fetchAll(PDO::FETCH_KEY_PAIR);

    $settings['activation_type'] = $activation_type;
    $settings['activation_expiry'] = $activation_expiry;
    $settings['activation_account_status'] = $activation_account_status;
    $settings['activation_is_expired'] = $activation_is_expired ? 'true' : 'false';
    $settings['activation_hwid'] = $license_hwid;
    $settings['activation_last_check'] = $license_data['activation_last_check'] ?? '';

    echo json_encode([
        'status' => 'ok',
        'is_logged_in' => isset($_SESSION['loggedin']) && $_SESSION['loggedin'] === true,
        'user' => $_SESSION['user'] ?? null,
        'settings' => $settings,
        'activation' => [
            'type' => $activation_type,
            'expiry' => $activation_expiry,
            'account_status' => $activation_account_status,
                'is_expired' => $activation_is_expired ? 'true' : 'false',
                'last_check' => $license_data['activation_last_check'] ?? ''
        ]
    ]);

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['status' => 'db_error', 'message' => 'فشل الاتصال بقاعدة البيانات: ' . $e->getMessage()]);
    exit;
}