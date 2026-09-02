<?php
session_start();
header('Content-Type: application/json');
// Allow CORS from same origin callers
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if ($origin) header('Access-Control-Allow-Origin: ' . $origin);
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit(0);
}

require_once __DIR__ . '/../config.php';

if (empty($_FILES['logo'])) {
    echo json_encode(['success' => false, 'message' => 'No file uploaded.']);
    exit;
}

$file = $_FILES['logo'];
if ($file['error'] !== UPLOAD_ERR_OK) {
    echo json_encode(['success' => false, 'message' => 'Upload error code: ' . $file['error']]);
    exit;
}

$allowed = ['image/png','image/jpeg','image/jpg','image/gif','image/webp','image/svg+xml'];
$mime = $file['type'] ?: 'image/png';
if (!in_array($mime, $allowed)) {
    echo json_encode(['success' => false, 'message' => 'Unsupported file type.']);
    exit;
}

$ext = pathinfo($file['name'], PATHINFO_EXTENSION) ?: 'png';
$baseName = 'company_logo_' . time() . '_' . bin2hex(random_bytes(4)) . '.' . $ext;
$uploadDir = __DIR__ . '/../uploads/';
if (!is_dir($uploadDir)) @mkdir($uploadDir, 0755, true);
$target = $uploadDir . $baseName;

$moved = @move_uploaded_file($file['tmp_name'], $target);
$bin = $moved ? @file_get_contents($target) : @file_get_contents($file['tmp_name']);

if ($bin === false || strlen($bin) === 0) {
    echo json_encode(['success' => false, 'message' => 'Failed to process uploaded file data.']);
    exit;
}

$base64 = 'data:' . $mime . ';base64,' . base64_encode($bin);
$relativePath = 'uploads/' . $baseName;

// Save to app_files and settings in DB if PDO is available
try {
    $pdo = new PDO("mysql:host=" . DB_HOST . ";dbname=" . DB_NAME . ";charset=utf8mb4", DB_USER, DB_PASS);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    // ensure app_files table
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

    $sha1 = sha1($bin);
    $insFile = $pdo->prepare("INSERT INTO app_files (filename, mime, sha1, data) VALUES (:fn, :mime, :sha1, :data) ON DUPLICATE KEY UPDATE data = VALUES(data), mime = VALUES(mime)");
    $insFile->execute([':fn' => $baseName, ':mime' => $mime, ':sha1' => $sha1, ':data' => $bin]);
    
    // update settings table
    $u1 = $pdo->prepare("INSERT INTO settings (config_key, config_value) VALUES ('company_logo', ?) ON DUPLICATE KEY UPDATE config_value = VALUES(config_value)");
    $u1->execute([$base64]);
} catch (Exception $e) {
    // non-fatal
}

echo json_encode([
    'success' => true,
    'url' => $base64,
    'base64' => $base64,
    'file_path' => $relativePath,
    'message' => 'Uploaded successfully'
]);

