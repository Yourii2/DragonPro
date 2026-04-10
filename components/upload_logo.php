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

if (empty($_FILES['logo'])) {
    echo json_encode(['success' => false, 'message' => 'No file uploaded.']);
    exit;
}

$file = $_FILES['logo'];
if ($file['error'] !== UPLOAD_ERR_OK) {
    echo json_encode(['success' => false, 'message' => 'Upload error code: ' . $file['error']]);
    exit;
}

$allowed = ['image/png','image/jpeg','image/jpg','image/gif','image/webp'];
if (!in_array($file['type'], $allowed)) {
    echo json_encode(['success' => false, 'message' => 'Unsupported file type.']);
    exit;
}

$ext = pathinfo($file['name'], PATHINFO_EXTENSION);
$baseName = 'company_logo_' . time() . '_' . bin2hex(random_bytes(6)) . '.' . $ext;
$uploadDir = __DIR__ . '/../uploads/';
if (!is_dir($uploadDir)) mkdir($uploadDir, 0755, true);
$target = $uploadDir . $baseName;

if (!move_uploaded_file($file['tmp_name'], $target)) {
    echo json_encode(['success' => false, 'message' => 'Failed to move uploaded file.']);
    exit;
}

// Return a relative path that can be stored in settings and used as src
$relativePath = 'uploads/' . $baseName;
echo json_encode(['success' => true, 'url' => $relativePath, 'message' => 'Uploaded']);
