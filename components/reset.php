<?php
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

try {
    // مسار ملفات النظام
    $config_path = __DIR__ . '/../config.php';
    $license_path = __DIR__ . '/../Dragon.lic';

    // Read DB credentials from config.php if available, otherwise accept from POST body
    $input = json_decode(file_get_contents('php://input'), true) ?? [];
    $dbHost = $input['dbHost'] ?? 'localhost';
    $dbUser = $input['dbUser'] ?? 'root';
    $dbPass = $input['dbPass'] ?? '';
    $dbName = $input['dbName'] ?? 'Dragon_erp';

    if (file_exists($config_path)) {
        // try to load constants from config.php
        $cfg = file_get_contents($config_path);
        // crude parse for DB_HOST/DB_USER/DB_PASS/DB_NAME constants
        if (preg_match("/DB_HOST\s*,\s*'?(.*?)'?\)/", $cfg)) {
            // not reliable; instead include safely in isolated scope
            try {
                include $config_path;
                if (defined('DB_HOST')) $dbHost = DB_HOST;
                if (defined('DB_USER')) $dbUser = DB_USER;
                if (defined('DB_PASS')) $dbPass = DB_PASS;
                if (defined('DB_NAME')) $dbName = DB_NAME;
            } catch (Exception $e) {
                // fallback to supplied input
            }
        }
    }

    // helper to escape shell args for Windows and Unix
    function escape_cmd_arg($arg) {
        if (stripos(PHP_OS_FAMILY, 'Windows') !== false) {
            $arg = str_replace('"', '\\"', $arg);
            return '"' . str_replace('%', '%%', $arg) . '"';
        }
        return escapeshellarg($arg);
    }

    function find_bin($name) {
        $candidates = [
            __DIR__ . '/../mysql/bin/' . $name,
            'C:/xampp/mysql/bin/' . $name,
            '/usr/bin/' . $name,
            '/usr/local/bin/' . $name,
            $name // PATH
        ];
        foreach ($candidates as $c) {
            if (file_exists($c) || trim(shell_exec('which ' . $c))) return $c;
        }
        return null;
    }

    // attempt to create a server-side backup before dropping DB
    $dumpBin = find_bin('mysqldump' . (stripos(PHP_OS_FAMILY, 'Windows') !== false ? '.exe' : ''));
    $backupFile = null;
    $backupWarnings = [];
    if ($dumpBin) {
        $backupsDir = __DIR__ . '/../backups';
        if (!is_dir($backupsDir)) @mkdir($backupsDir, 0755, true);
        $backupFile = $backupsDir . DIRECTORY_SEPARATOR . 'Dragon_backup_' . date('Ymd_His') . '.sql';
        $cmd = escape_cmd_arg($dumpBin)
            . ' --host=' . escape_cmd_arg($dbHost)
            . ' --user=' . escape_cmd_arg($dbUser)
            . (strlen($dbPass) ? ' --password=' . escape_cmd_arg($dbPass) : '')
            . ' --routines --triggers --single-transaction '
            . escape_cmd_arg($dbName)
            . ' > ' . escape_cmd_arg($backupFile);
        $exitCode = 0;
        @exec($cmd, $output, $exitCode);
        if ($exitCode !== 0 || !file_exists($backupFile)) {
            $backupWarnings[] = "فشل إنشاء النسخة الاحتياطية عبر mysqldump (خروج $exitCode).";
            $backupFile = null;
        }
    } else {
        $backupWarnings[] = 'لم يتم العثور على mysqldump؛ تم تخطي النسخ الاحتياطي.';
    }

    // Attempt DB drop (connect to server without selecting DB)
    try {
        $pdo = new PDO("mysql:host=$dbHost", $dbUser, $dbPass, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
        if ($dbName) {
            $pdo->exec("DROP DATABASE IF EXISTS `" . str_replace('`', '``', $dbName) . "`");
        }
    } catch (PDOException $e) {
        // If drop fails, log warning but continue to remove config/license so app falls back to installer
        error_log("فشل حذف قاعدة البيانات: " . $e->getMessage());
    }

    // Remove configuration and license so app returns to installer
    if (file_exists($config_path)) {
        @unlink($config_path);
    }
    if (file_exists($license_path)) {
        @unlink($license_path);
    }

    $resp = ['success' => true, 'message' => 'تم إعادة تعيين النظام بنجاح'];
    if ($backupFile) {
        $resp['backup_file'] = str_replace('\\', '/', $backupFile);
    }
    if ($backupWarnings) $resp['warnings'] = $backupWarnings;

    echo json_encode($resp);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'حدث خطأ أثناء إعادة تعيين النظام: ' . $e->getMessage()]);
}


