<?php
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

try {
    // مسار ملفات النظام
    $config_path = __DIR__ . '/../config.php';
    $license_path = __DIR__ . '/../Dragon.lic';

    // حذف ملف التكوين
    if (file_exists($config_path)) {
        unlink($config_path);
    }

    // حذف ملف الترخيص
    if (file_exists($license_path)) {
        unlink($license_path);
    }

    // محاولة الاتصال بقاعدة البيانات وحذفها
    // قراءة معلومات الاتصال من ملف التكوين قبل حذفه
    $input = json_decode(file_get_contents('php://input'), true);
    $dbHost = $input['dbHost'] ?? 'localhost';
    $dbUser = $input['dbUser'] ?? 'root';
    $dbPass = $input['dbPass'] ?? '';
    $dbName = $input['dbName'] ?? 'Dragon_erp';

    try {
        // الاتصال بالسيرفر بدون تحديد قاعدة البيانات
        $pdo = new PDO("mysql:host=$dbHost", $dbUser, $dbPass);
        $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

        // حذف قاعدة البيانات
        $pdo->exec("DROP DATABASE IF EXISTS `$dbName`");
    } catch (PDOException $e) {
        // إذا فشل حذف قاعدة البيانات، نستمر في عملية إعادة التعيين
        error_log("فشل حذف قاعدة البيانات: " . $e->getMessage());
    }

    echo json_encode(['success' => true, 'message' => 'تم إعادة تعيين النظام بنجاح']);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'حدث خطأ أثناء إعادة تعيين النظام: ' . $e->getMessage()]);
}


