<?php
header('Content-Type: application/json');

// معالجة طلبات OPTIONS
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// استقبال البيانات من الطلب
$input = json_decode(file_get_contents('php://input'), true);

// التحقق من وجود البيانات المطلوبة
if (!isset($input['host']) || !isset($input['port']) || !isset($input['user']) || !isset($input['name'])) {
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
    $conn = new mysqli($host, $user, $pass, '', $port);

    // التحقق من الاتصال
    if ($conn->connect_error) {
        throw new Exception($conn->connect_error);
    }

    // محاولة إنشاء قاعدة البيانات إذا لم تكن موجودة
    $conn->query("CREATE DATABASE IF NOT EXISTS `$name` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");

    // إغلاق الاتصال
    $conn->close();

    // إرسال رد ناجح
    echo json_encode([
        'success' => true,
        'message' => 'تم الاتصال بقاعدة البيانات بنجاح'
    ]);

} catch (Exception $e) {
    // إرسال رد بالخطأ
    echo json_encode([
        'success' => false,
        'message' => $e->getMessage()
    ]);
}
?>