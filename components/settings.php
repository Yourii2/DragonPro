<?php
// Simple settings API for storing app settings and files in MySQL
// endpoints: ?action=get, ?action=update, ?action=upload_logo, ?action=get_file&id=NN


require_once __DIR__ . '/../config.php';

try {
    $pdo = new PDO("mysql:host=" . DB_HOST . ";dbname=" . DB_NAME . ";charset=utf8mb4", DB_USER, DB_PASS);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
} catch (PDOException $e) {
    header('Content-Type: application/json');
    echo json_encode(['success' => false, 'message' => 'DB connection failed: ' . $e->getMessage()]);
    exit;
}

header('Content-Type: application/json');

$action = isset($_GET['action']) ? $_GET['action'] : null;
try {
    if ($action === 'get') {
        $stmt = $pdo->query("SELECT name, value FROM app_settings");
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
        $settings = [];
        foreach ($rows as $r) $settings[$r['name']] = $r['value'];
        echo json_encode(['success'=>true,'data'=>$settings]);
        exit;
    }

    if ($action === 'update') {
        $input = json_decode(file_get_contents('php://input'), true) ?: [];
        $pdo->beginTransaction();
        $up = $pdo->prepare("INSERT INTO app_settings (name, value) VALUES (:name, :value) ON DUPLICATE KEY UPDATE value = VALUES(value)");
        foreach ($input as $k => $v) {
            // Only allow scalar or JSON-encoded values
            if (is_array($v) || is_object($v)) $v = json_encode($v, JSON_UNESCAPED_UNICODE);
            $up->execute([':name'=>$k, ':value'=>$v]);
        }
        $pdo->commit();
        echo json_encode(['success'=>true]);
        exit;
    }

    if ($action === 'upload_logo') {
        if (empty($_FILES['logo'])) {
            echo json_encode(['success'=>false,'message'=>'No file']); exit;
        }
        $f = $_FILES['logo'];
        if ($f['error'] !== UPLOAD_ERR_OK) { echo json_encode(['success'=>false,'message'=>'Upload error']); exit; }
        $data = file_get_contents($f['tmp_name']);
        $mime = mime_content_type($f['tmp_name']);
        $stmt = $pdo->prepare("INSERT INTO app_files (filename, mime, data) VALUES (:fn, :mime, :data)");
        $stmt->bindParam(':fn', $f['name']);
        $stmt->bindParam(':mime', $mime);
        $stmt->bindParam(':data', $data, PDO::PARAM_LOB);
        $stmt->execute();
        $fileId = $pdo->lastInsertId();
        // store file id in settings
        $up = $pdo->prepare("INSERT INTO app_settings (name, value) VALUES ('company_logo_file_id', :id) ON DUPLICATE KEY UPDATE value = VALUES(value)");
        $up->execute([':id'=>$fileId]);
        echo json_encode(['success'=>true,'file_id'=>$fileId]);
        exit;
    }

    if ($action === 'get_file') {
        $id = isset($_GET['id']) ? (int)$_GET['id'] : 0;
        if (!$id) { echo json_encode(['success'=>false,'message'=>'missing id']); exit; }
        $stmt = $pdo->prepare("SELECT filename,mime,data FROM app_files WHERE id = :id");
        $stmt->execute([':id'=>$id]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$row) { echo json_encode(['success'=>false,'message'=>'not found']); exit; }
        header('Content-Type: ' . ($row['mime']?:'application/octet-stream'));
        echo base64_encode($row['data']);
        exit;
    }

    echo json_encode(['success'=>false,'message'=>'unknown action']);
} catch (Exception $e) {
    if ($pdo && $pdo->inTransaction()) $pdo->rollBack();
    echo json_encode(['success'=>false,'message'=>$e->getMessage()]);
}

?>