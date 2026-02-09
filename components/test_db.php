<?php
session_start();

// Ensure we always return clean JSON (no warnings/HTML mixed in)
@ini_set('display_errors', '0');
@ini_set('html_errors', '0');
@ini_set('log_errors', '1');
error_reporting(0);
if (function_exists('ob_start')) { @ob_start(); }
if (function_exists('mysqli_report')) { @mysqli_report(MYSQLI_REPORT_OFF); }

// CORS (needed when running frontend on Vite dev server)
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if ($origin) header('Access-Control-Allow-Origin: ' . $origin);
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Access-Control-Allow-Credentials: true');
header('Content-Type: application/json; charset=utf-8');

// OPTIONS preflight
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// استقبال البيانات من الطلب
$input = json_decode(file_get_contents('php://input'), true);

// التحقق من وجود البيانات المطلوبة
if (!isset($input['host']) || !isset($input['port']) || !isset($input['user']) || !isset($input['name'])) {
    if (function_exists('ob_clean')) { @ob_clean(); }
    echo json_encode([
        'success' => false,
        'message' => 'البيانات غير مكتملة'
    ]);
    exit();
}

$host = $input['host'];
$port = $input['port'];
$user = $input['user'];
$pass = isset($input['pass']) ? $input['pass'] : '';
$name = $input['name'];

try {
    // محاولة الاتصال بقاعدة البيانات
    $conn = @new mysqli($host, $user, $pass, '', (int)$port);

    // التحقق من الاتصال
    if ($conn->connect_error) {
        throw new Exception($conn->connect_error);
    }

    // التحقق من وجود قاعدة البيانات
    $safeName = $conn->real_escape_string($name);
    $result = $conn->query("SELECT SCHEMA_NAME FROM INFORMATION_SCHEMA.SCHEMATA WHERE SCHEMA_NAME = '{$safeName}'");

    if ($result->num_rows > 0) {
        // قاعدة البيانات موجودة بالفعل
        $conn->close();
        if (function_exists('ob_clean')) { @ob_clean(); }
        echo json_encode([
            'success' => false,
            'message' => "قاعدة البيانات '$name' موجودة بالفعل. يرجى اختيار اسم مختلف."
        ]);
        exit();
    }

    // محاولة إنشاء قاعدة البيانات
    $conn->query("CREATE DATABASE `$name` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");

    // إغلاق الاتصال
    $conn->close();

    // إرسال رد ناجح
    if (function_exists('ob_clean')) { @ob_clean(); }
    echo json_encode([
        'success' => true,
        'message' => 'تم الاتصال بقاعدة البيانات بنجاح'
    ]);

} catch (Exception $e) {
    // إرسال رد بالخطأ
    if (function_exists('ob_clean')) { @ob_clean(); }
    echo json_encode([
        'success' => false,
        'message' => $e->getMessage()
    ]);
}

if (function_exists('ob_end_flush')) { @ob_end_flush(); }
