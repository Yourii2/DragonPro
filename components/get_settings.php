<?php
session_start();

// CORS
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if ($origin) header('Access-Control-Allow-Origin: ' . $origin);
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Access-Control-Allow-Credentials: true');
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit(0); }

require_once __DIR__ . '/../config.php';

// License Guard
require_once __DIR__ . '/activation_utils.php';
$license_check = check_license_validity();
if ($license_check['status'] !== 'ok') {
    http_response_code(403);
    echo json_encode(['success' => false, 'status' => $license_check['status'], 'message' => $license_check['message']]);
    exit;
}


try {
    $pdo = new PDO("mysql:host=" . DB_HOST . ";dbname=" . DB_NAME . ";charset=utf8mb4", DB_USER, DB_PASS);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Database connection failed.']);
    exit;
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

try {
    // Prefer new `app_settings` table; fallback to legacy `settings` if not present
    $settings = [];
    $check = $pdo->query("SHOW TABLES LIKE 'app_settings'")->fetch();
    if ($check) {
        // Use detected column names so we correctly read stored values regardless of schema variant
        $appCols = detectAppSettingsCols($pdo);
        if ($appCols) {
            list($kcol, $vcol) = $appCols;
            $stmt = $pdo->query("SELECT `" . $kcol . "`, `" . $vcol . "` FROM app_settings");
            $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
            foreach ($rows as $r) {
                // normalize keys as strings
                $key = (string)$r[$kcol];
                $settings[$key] = $r[$vcol];
            }
        } else {
            // fallback to name/value
            $stmt = $pdo->query("SELECT name, value FROM app_settings");
            $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
            foreach ($rows as $r) {
                $settings[$r['name']] = $r['value'];
            }
        }
        // If a logo file id is present, fetch the base64 data directly from app_files so it renders immediately across all hosts/ports/printers
        $logoId = null;
        if (!empty($settings['company_logo_file_id']) && is_numeric($settings['company_logo_file_id'])) {
            $logoId = intval($settings['company_logo_file_id']);
        }
        if ($logoId) {
            try {
                $checkFiles = $pdo->query("SHOW TABLES LIKE 'app_files'");
                if ($checkFiles && $checkFiles->fetch()) {
                    $fstmt = $pdo->prepare("SELECT mime, data FROM app_files WHERE id = :id LIMIT 1");
                    $fstmt->execute([':id' => $logoId]);
                    $frow = $fstmt->fetch(PDO::FETCH_ASSOC);
                    if ($frow && !empty($frow['data'])) {
                        $mime = $frow['mime'] ?: 'image/png';
                        $base64Data = 'data:' . $mime . ';base64,' . base64_encode($frow['data']);
                        $settings['company_logo_url'] = $base64Data;
                        $settings['company_logo'] = $base64Data;
                    }
                }
            } catch (Exception $e) {
                // skip
            }
        }
    } else {
        // legacy settings table
        $stmt = $pdo->query("SELECT config_key, config_value FROM settings");
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
        foreach ($rows as $r) {
            $settings[$r['config_key']] = $r['config_value'];
        }
        // legacy settings table may contain company_logo_file_id as config_key
        if (!empty($settings['company_logo_file_id']) && is_numeric($settings['company_logo_file_id'])) {
            try {
                $checkFiles = $pdo->query("SHOW TABLES LIKE 'app_files'");
                if ($checkFiles && $checkFiles->fetch()) {
                    $id = intval($settings['company_logo_file_id']);
                    $fstmt = $pdo->prepare("SELECT mime, data FROM app_files WHERE id = :id LIMIT 1");
                    $fstmt->execute([':id' => $id]);
                    $frow = $fstmt->fetch(PDO::FETCH_ASSOC);
                    if ($frow && !empty($frow['data'])) {
                        $mime = $frow['mime'] ?: 'image/png';
                        $base64Data = 'data:' . $mime . ';base64,' . base64_encode($frow['data']);
                        $settings['company_logo_url'] = $base64Data;
                        $settings['company_logo'] = $base64Data;
                    }
                }
            } catch (Exception $e) {
                // skip
            }
        }
    }

    // Post-process: ensure company_logo is always a data URI if present
    $rawLogo = $settings['company_logo'] ?? '';
    if (!empty($rawLogo)) {
        if (str_starts_with($rawLogo, 'data:')) {
            // Already base64 - set company_logo_url as well for front-end compatibility
            $settings['company_logo_url'] = $rawLogo;
            $settings['company_logo'] = $rawLogo;
        } elseif (str_starts_with($rawLogo, 'uploads/')) {
            // Legacy path stored instead of base64 - convert now
            $diskPath = __DIR__ . '/../' . $rawLogo;
            if (file_exists($diskPath)) {
                $binData = @file_get_contents($diskPath);
                if ($binData !== false && strlen($binData) > 0) {
                    $ext = strtolower(pathinfo($diskPath, PATHINFO_EXTENSION));
                    $mimeMap = ['png'=>'image/png','jpg'=>'image/jpeg','jpeg'=>'image/jpeg','gif'=>'image/gif','webp'=>'image/webp','svg'=>'image/svg+xml'];
                    $mimeType = $mimeMap[$ext] ?? 'image/png';
                    $dataUri = 'data:' . $mimeType . ';base64,' . base64_encode($binData);
                    $settings['company_logo'] = $dataUri;
                    $settings['company_logo_url'] = $dataUri;
                }
            }
        }
    }

    echo json_encode(['success' => true, 'data' => $settings]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Failed to fetch settings.']);
    exit;
}
