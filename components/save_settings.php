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
    // Update or insert company settings
    $stmt = $pdo->prepare("INSERT INTO settings (config_key, config_value) VALUES (?, ?) 
                          ON DUPLICATE KEY UPDATE config_value = VALUES(config_value)");

    // Load current settings to detect changes
    $current = [];
    try {
        $curStmt = $pdo->query("SELECT config_key, config_value FROM settings");
        $current = $curStmt->fetchAll(PDO::FETCH_KEY_PAIR);
    } catch (Exception $e) { $current = []; }

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
        'sales_display_method' => $input['sales_display_method'] ?? 'company', // values: 'company' or 'sales_offices'
        'product_source' => $input['product_source'] ?? 'both', // values: 'factory' | 'suppliers' | 'both'
        // New setting: delivery method
        'delivery_method' => $input['delivery_method'] ?? 'reps', // values: 'reps' | 'direct' | 'shipping'
        // New setting: default sale price source ('product' | 'order')
        'sale_price_source' => $input['sale_price_source'] ?? 'product',
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
        'report_auto' => $input['report_auto'] ?? 'false'
    ];

    foreach ($settings as $key => $value) {
        $stmt->execute([$key, $value]);
    }

    echo json_encode(['success' => true, 'message' => 'Settings saved successfully.']);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Failed to save settings.']);
    exit;
}

