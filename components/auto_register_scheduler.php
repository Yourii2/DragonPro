<?php
// Auto-register Windows Task Scheduler task if daily email reports or auto backups are enabled
if (!file_exists(__DIR__ . '/../config.php')) {
    echo "Configuration file not found. Skipping auto-scheduler registration.\n";
    exit(0);
}
require_once __DIR__ . '/../config.php';

try {
    $pdo = new PDO("mysql:host=" . DB_HOST . ";dbname=" . DB_NAME . ";charset=utf8mb4", DB_USER, DB_PASS);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
} catch (PDOException $e) {
    echo "Database connection failed. Skipping auto-scheduler registration.\n";
    exit(0);
}

// Helper: detect app_settings key/value column names
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

$settings = [];
try {
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
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
        foreach ($rows as $r) {
            $settings[$r['config_key']] = $r['config_value'];
        }
    }
} catch (Exception $e) {
    echo "Failed to load settings from DB. Skipping auto-scheduler registration.\n";
    exit(0);
}

$report_auto = isset($settings['report_auto']) && ($settings['report_auto'] === 'true' || $settings['report_auto'] === '1');
$report_email = isset($settings['report_email']) && trim($settings['report_email']) !== '';
$report_verified = isset($settings['report_email_verified']) && ($settings['report_email_verified'] === 'true' || $settings['report_email_verified'] === '1');

$auto_backup = isset($settings['auto_backup']) && ($settings['auto_backup'] === 'true' || $settings['auto_backup'] === '1');
$backup_email = isset($settings['backup_email']) && trim($settings['backup_email']) !== '';
$backup_verified = isset($settings['backup_email_verified']) && ($settings['backup_email_verified'] === 'true' || $settings['backup_email_verified'] === '1');

$should_register = ($report_auto && $report_email && $report_verified) || ($auto_backup && $backup_email && $backup_verified);

if ($should_register) {
    echo "Report/Backup feature is fully configured. Verifying Windows Task Scheduler registration...\n";
    $task_name = "DragonERP_Daily";
    $task_time = "22:00";
    $task_file = realpath(__DIR__ . '/../Task_Scheduler.bat');
    
    if ($task_file) {
        // Create/update the scheduled task with force flag /F
        $cmd = "schtasks /Create /SC DAILY /TN \"$task_name\" /TR \"\\\"$task_file\\\"\" /ST $task_time /F 2>&1";
        $output = [];
        $return_var = 0;
        exec($cmd, $output, $return_var);
        
        $outText = implode("\n", $output);
        echo $outText . "\n";
        
        if ($return_var === 0) {
            echo "[OK] Daily scheduler task has been successfully registered/updated in Windows Task Scheduler.\n";
        } else {
            echo "[WARNING] Could not register scheduler task automatically. If this is a non-admin command prompt, Windows requires administrator privileges to create scheduled tasks.\n";
        }
    } else {
        echo "[ERROR] Task_Scheduler.bat was not found in the project root.\n";
    }
} else {
    echo "Daily email reports or backups are not fully configured (make sure email is verified and auto-send/backup options are checked). Scheduler task will not be registered.\n";
}
