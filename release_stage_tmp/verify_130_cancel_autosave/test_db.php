<?php
header('Content-Type: application/json');

function is_local_request() {
    $remoteAddr = (string)($_SERVER['REMOTE_ADDR'] ?? '');
    return in_array($remoteAddr, ['127.0.0.1', '::1'], true);
}

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode([
        'success' => false,
        'message' => 'Method not allowed'
    ]);
    exit();
}

if (!is_local_request()) {
    http_response_code(403);
    echo json_encode([
        'success' => false,
        'message' => 'هذا المسار متاح فقط من نفس الجهاز.'
    ]);
    exit();
}

$input = json_decode(file_get_contents('php://input'), true);
if (!is_array($input)) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'message' => 'الطلب غير صالح'
    ]);
    exit();
}

if (!isset($input['host']) || !isset($input['port']) || !isset($input['user']) || !isset($input['name'])) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'message' => 'البيانات غير مكتملة'
    ]);
    exit();
}

$host = trim((string)$input['host']);
$port = intval($input['port']);
$user = trim((string)$input['user']);
$pass = isset($input['pass']) ? (string)$input['pass'] : '';
$name = trim((string)$input['name']);

if ($host === '' || $user === '' || $name === '' || $port <= 0) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'message' => 'البيانات غير مكتملة'
    ]);
    exit();
}

$allowedHosts = ['localhost', '127.0.0.1'];
if (!in_array(strtolower($host), $allowedHosts, true)) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'message' => 'يسمح باختبار قواعد البيانات المحلية فقط.'
    ]);
    exit();
}

if (!preg_match('/^[A-Za-z0-9_]+$/', $name)) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'message' => 'اسم قاعدة البيانات غير صالح.'
    ]);
    exit();
}

mysqli_report(MYSQLI_REPORT_OFF);

try {
    $conn = @new mysqli($host, $user, $pass, '', $port);
    if ($conn->connect_error) {
        throw new Exception('تعذر الاتصال بقاعدة البيانات.');
    }

    $safeName = $conn->real_escape_string($name);
    $dbExists = false;
    $result = $conn->query("SELECT SCHEMA_NAME FROM INFORMATION_SCHEMA.SCHEMATA WHERE SCHEMA_NAME = '{$safeName}' LIMIT 1");
    if ($result instanceof mysqli_result) {
        $dbExists = (bool)$result->fetch_assoc();
        $result->free();
    }
    $conn->close();

    echo json_encode([
        'success' => true,
        'message' => $dbExists ? 'تم الاتصال بقاعدة البيانات والخادم المحلي بنجاح.' : 'تم الاتصال بخادم قاعدة البيانات المحلي بنجاح.',
        'databaseExists' => $dbExists,
    ]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => $e->getMessage()
    ]);
}
?>