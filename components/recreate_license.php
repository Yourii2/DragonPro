<?php
// CORS
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if ($origin) header('Access-Control-Allow-Origin: ' . $origin);
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Access-Control-Allow-Credentials: true');
header('Content-Type: application/json; charset=utf-8');

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') { exit(0); }

require_once __DIR__ . '/activation_utils.php';
require_once __DIR__ . '/encryption.php';

$license_data = self_heal_license_from_db();

if (is_array($license_data)) {
    $license_path = __DIR__ . '/../Dragon.lic';
    $encrypted_license = encrypt_data(json_encode($license_data));
    file_put_contents($license_path, $encrypted_license);

    echo json_encode([
        'success' => true,
        'message' => 'تم إعادة إنشاء وتحديث ملف الترخيص Dragon.lic بنجاح!',
        'license_data' => $license_data
    ], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
} else {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'فشل إعادة إنشاء ملف الترخيص. يرجى التأكد من وجود ملف config.php وقاعدة البيانات.'
    ], JSON_UNESCAPED_UNICODE);
}
