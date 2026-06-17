<?php
// Run this script via scheduler: php components/backup_run.php

if (!file_exists(__DIR__ . '/../config.php')) {
    echo "Configuration file not found.\n";
    exit(1);
}
require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/smtp_mail.php';

try {
    $pdo = new PDO("mysql:host=" . DB_HOST . ";dbname=" . DB_NAME . ";charset=utf8mb4", DB_USER, DB_PASS);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
} catch (PDOException $e) {
    echo "Database connection failed.\n";
    exit(1);
}

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
        '/usr/local/bin/' . $name
    ];
    foreach ($candidates as $c) {
        if (file_exists($c)) return $c;
    }
    return null;
}


// Read settings
$settings = [];
try {
    function detectAppSettingsCols($pdo) {
        try {
            $check = $pdo->query("SHOW TABLES LIKE 'app_settings'")->fetch();
            if (!$check) return null;
            $cols = $pdo->query("SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'app_settings'")->fetchAll(PDO::FETCH_COLUMN);
            if (in_array('name', $cols) && in_array('value', $cols)) return ['name','value'];
            if (in_array('k', $cols) && in_array('v', $cols)) return ['k','v'];
            if (in_array('key', $cols) && in_array('value', $cols)) return ['key','value'];
            if (count($cols) >= 2) return [$cols[0], $cols[1]];
            return null;
        } catch (Exception $e) {
            return null;
        }
    }

    $check = $pdo->query("SHOW TABLES LIKE 'app_settings'")->fetch();
    if ($check) {
        $appCols = detectAppSettingsCols($pdo);
        if ($appCols) {
            list($kcol, $vcol) = $appCols;
            $stmt = $pdo->query("SELECT `" . $kcol . "`, `" . $vcol . "` FROM app_settings");
            $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
            foreach ($rows as $r) {
                $settings[(string)$r[$kcol]] = $r[$vcol];
            }
        } else {
            $stmt = $pdo->query("SELECT name, value FROM app_settings");
            $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
            foreach ($rows as $r) {
                $settings[$r['name']] = $r['value'];
            }
        }
    } else {
        $stmt = $pdo->query("SELECT config_key, config_value FROM settings");
        $settings = $stmt->fetchAll(PDO::FETCH_KEY_PAIR);
    }
} catch (Exception $e) {
    $settings = [];
}

$auto = isset($settings['auto_backup']) && ($settings['auto_backup'] === 'true' || $settings['auto_backup'] === '1');
if (!$auto) {
    echo "Auto backup disabled.\n";
    exit(0);
}

$backupEmail = $settings['backup_email'] ?? '';

$dumpBin = find_bin('mysqldump' . (stripos(PHP_OS_FAMILY, 'Windows') !== false ? '.exe' : ''));
if (!$dumpBin) {
    echo "mysqldump not found.\n";
    exit(1);
}

$backupDir = __DIR__ . '/../backups';
if (!is_dir($backupDir)) {
    @mkdir($backupDir, 0777, true);
}

$fileName = 'Dragon_backup_' . date('Ymd_His') . '.sql';
$targetFile = $backupDir . DIRECTORY_SEPARATOR . $fileName;

$cmd = escape_cmd_arg($dumpBin)
    . ' --host=' . escape_cmd_arg(DB_HOST)
    . ' --user=' . escape_cmd_arg(DB_USER)
    . (DB_PASS !== '' ? ' --password=' . escape_cmd_arg(DB_PASS) : '')
    . ' --routines --triggers --single-transaction '
    . escape_cmd_arg(DB_NAME)
    . ' > ' . escape_cmd_arg($targetFile);

$exitCode = 0;
@exec($cmd, $output, $exitCode);
if ($exitCode !== 0 || !file_exists($targetFile)) {
    echo "Backup failed.\n";
    exit(1);
}

echo "Backup created: $targetFile\n";

if ($backupEmail) {
    $sent = smtp_send_mail(
        $backupEmail,
        'Dragon Backup - ' . date('Y-m-d H:i'),
        'Backup attached. If you did not request this, please ignore.',
        $targetFile,
        $fileName
    );
    echo $sent ? "Email sent.\n" : "Email failed.\n";
}

exit(0);
