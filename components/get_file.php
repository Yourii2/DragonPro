<?php
require_once __DIR__ . '/../config.php';
// Simple file fetcher by id. Usage: GET ?id=1 or GET /components/get_file.php?id=1
// Optional ?as=base64 returns JSON {success:true, mime:'', data:'base64...'}
header('Access-Control-Allow-Origin: ' . ($_SERVER['HTTP_ORIGIN'] ?? '*'));
header('Access-Control-Allow-Credentials: true');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }
header('Content-Type: application/json; charset=utf-8');

$id = isset($_GET['id']) ? intval($_GET['id']) : 0;
$as = isset($_GET['as']) ? $_GET['as'] : '';
if ($id <= 0) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Invalid id']);
    exit;
}
try {
    $pdo = new PDO("mysql:host=" . DB_HOST . ";dbname=" . DB_NAME . ";charset=utf8mb4", DB_USER, DB_PASS, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
    $stmt = $pdo->prepare("SELECT filename, mime, data FROM app_files WHERE id = :id LIMIT 1");
    $stmt->execute([':id' => $id]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$row) {
        http_response_code(404);
        echo json_encode(['success' => false, 'message' => 'Not found']);
        exit;
    }
    if ($as === 'base64') {
        echo json_encode(['success' => true, 'mime' => $row['mime'], 'data' => base64_encode($row['data'])]);
        exit;
    }
    // return raw binary with correct mime
    header('Content-Type: ' . ($row['mime'] ?? 'application/octet-stream'));
    header('Content-Length: ' . strlen($row['data']));
    // allow embedding in img src
    header('Cache-Control: public, max-age=86400');
    echo $row['data'];
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => $e->getMessage()]);
}
