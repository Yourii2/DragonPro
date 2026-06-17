<?php

define('ACTIVATION_SCRIPT_URL', 'https://script.google.com/macros/s/AKfycbwca53netHEVDQxTNYnKX2dGvtpWhAVFlJjr2dBuLUUm6uEn3Ac6PnHFP2MMssL_Lww/exec');

function get_hwid() {
    $sources = [];
    $sources[] = gethostname();
    $envName = getenv('COMPUTERNAME');
    if (!empty($envName)) {
        $sources[] = $envName;
    }

    $os = strtoupper(substr(PHP_OS, 0, 3));
    if ($os === 'WIN') {
        if (function_exists('shell_exec')) {
            $uuidRaw = shell_exec('wmic csproduct get uuid 2>NUL');
            if ($uuidRaw) {
                $lines = array_values(array_filter(array_map('trim', explode("\n", $uuidRaw))));
                if (isset($lines[1])) {
                    $sources[] = $lines[1];
                }
            }
            $biosRaw = shell_exec('wmic bios get serialnumber 2>NUL');
            if ($biosRaw) {
                $lines = array_values(array_filter(array_map('trim', explode("\n", $biosRaw))));
                if (isset($lines[1])) {
                    $sources[] = $lines[1];
                }
            }
        }
    } else {
        if (function_exists('shell_exec')) {
            $machineId = trim((string)shell_exec('cat /etc/machine-id 2>/dev/null'));
            if (!empty($machineId)) {
                $sources[] = $machineId;
            }
            $dbusId = trim((string)shell_exec('cat /var/lib/dbus/machine-id 2>/dev/null'));
            if (!empty($dbusId)) {
                $sources[] = $dbusId;
            }
        }
    }

    $normalized = [];
    foreach ($sources as $value) {
        $value = trim((string)$value);
        if ($value !== '') {
            $normalized[] = strtoupper($value);
        }
    }

    $raw = implode('|', array_values(array_unique($normalized)));
    if ($raw === '') {
        $raw = php_uname();
    }
    return hash('sha256', $raw);
}

function call_activation_service($hwid, $phone, $company) {
    $payload = http_build_query([
        'action' => 'activate',
        'hwid' => $hwid,
        'phone' => $phone,
        'company' => $company
    ]);

    if (!function_exists('curl_init')) {
        return ['success' => false, 'message' => 'cURL is not available on this server.'];
    }

    $attempts = 0;
    $maxAttempts = 3;
    $response = false;
    $lastError = '';

    while ($attempts < $maxAttempts) {
        $ch = curl_init(ACTIVATION_SCRIPT_URL);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, $payload);
        // Increase timeouts to be tolerant of slow networks; keep reasonable limits
        curl_setopt($ch, CURLOPT_TIMEOUT, 15);
        curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 5);
        curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
        curl_setopt($ch, CURLOPT_MAXREDIRS, 5);
        curl_setopt($ch, CURLOPT_USERAGENT, 'DragonERP/1.0');

        $response = curl_exec($ch);
        if ($response === false) {
            $lastError = curl_error($ch);
            curl_close($ch);
            $attempts++;
            // small backoff before retrying
            if ($attempts < $maxAttempts) usleep(250000); // 250ms
            continue;
        }

        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        break;
    }

    if ($response === false) {
        return ['success' => false, 'message' => 'Activation request failed: ' . ($lastError ?: 'unknown error')];
    }

    if ($httpCode < 200 || $httpCode >= 300) {
        return ['success' => false, 'message' => 'Activation server returned HTTP ' . $httpCode];
    }

    $data = json_decode($response, true);
    if (!is_array($data)) {
        return ['success' => false, 'message' => 'Invalid activation response.'];
    }

    if (($data['status'] ?? '') !== 'success') {
        return ['success' => false, 'message' => $data['message'] ?? 'Activation failed.'];
    }

    return ['success' => true, 'data' => $data];
}

function check_license_validity() {
    $config_path = __DIR__ . '/../config.php';
    $license_path = __DIR__ . '/../Dragon.lic';

    if (!file_exists($config_path) || !file_exists($license_path)) {
        return ['status' => 'not_installed', 'message' => 'النظام غير مثبت بعد.'];
    }

    require_once __DIR__ . '/encryption.php';
    $encrypted_data = @file_get_contents($license_path);
    if ($encrypted_data === false || $encrypted_data === '') {
        return ['status' => 'tampered', 'message' => 'ملف الترخيص غير موجود أو تالف.'];
    }

    $decrypted_json = decrypt_data($encrypted_data);
    if ($decrypted_json === false) {
        return ['status' => 'tampered', 'message' => 'ملف الترخيص تالف أو تم العبث به.'];
    }

    $license_data = json_decode($decrypted_json, true);
    if (!is_array($license_data)) {
        return ['status' => 'tampered', 'message' => 'ملف الترخيص تالف أو تم العبث به.'];
    }

    $activation_type = $license_data['activation_type'] ?? '';
    $activation_expiry = $license_data['activation_expiry'] ?? '';
    $activation_account_status = $license_data['activation_account_status'] ?? 'Active';
    $activation_is_expired = ($license_data['activation_is_expired'] ?? 'false') === 'true';

    // Verify expiration timestamp if present
    if (!empty($activation_expiry)) {
        $expiry_ts = strtotime($activation_expiry);
        if ($expiry_ts !== false && time() > $expiry_ts) {
            $activation_is_expired = true;
        }
    }

    $activation_type_norm = strtolower(trim((string)$activation_type));
    $is_trial = $activation_type_norm === 'trial';

    // 1. Account status check
    if (strtolower(trim((string)$activation_account_status)) === 'blocked') {
        return ['status' => 'activation_blocked', 'message' => 'تم حظر هذا الترخيص.'];
    }

    // 2. Clock tampering check (prevent bypassing by setting clock back)
    $last_check_raw = $license_data['activation_last_check'] ?? '';
    if (!empty($last_check_raw)) {
        $last_check_ts = strtotime($last_check_raw);
        // Allow a small grace period of 5 minutes (300 seconds) for clock drift
        if ($last_check_ts !== false && time() < ($last_check_ts - 300)) {
            return ['status' => 'tampered', 'message' => 'تم العبث بتاريخ النظام أو ملف الترخيص.'];
        }
    }

    // 3. Trial expiration check
    if ($is_trial) {
        if (empty($activation_expiry)) {
            return ['status' => 'activation_expired', 'message' => 'انتهت صلاحية الترخيص التجريبي.'];
        }
        $expiry_ts = strtotime($activation_expiry);
        if ($expiry_ts === false || time() > $expiry_ts || $activation_is_expired) {
            return ['status' => 'activation_expired', 'message' => 'انتهت صلاحية الترخيص التجريبي.'];
        }
    }

    return ['status' => 'ok', 'license_data' => $license_data];
}

