<?php

define('ACTIVATION_SCRIPT_URL', 'https://script.google.com/macros/s/AKfycbwTFHdFZWUoqN_tDbxhmx06QaJCtUp8UfOYWGXBVFETrEnRQBQX2QXI3axPRWbgZ6nt/exec');
define('ACTIVATION_SECRET_KEY', 'Bad220020!@#');

function get_program_name() {
    return 'DragonPro';
}

function get_program_version() {
    $cfgPath = __DIR__ . '/../update-config.json';
    if (file_exists($cfgPath)) {
        $json = @json_decode(file_get_contents($cfgPath), true);
        if (!empty($json['github']['version'])) {
            $v = trim($json['github']['version']);
            return (strpos($v, 'v') === 0) ? $v : 'v' . $v;
        }
    }
    $pkgPath = __DIR__ . '/../package.json';
    if (file_exists($pkgPath)) {
        $json = @json_decode(file_get_contents($pkgPath), true);
        if (!empty($json['version'])) {
            $v = trim($json['version']);
            return (strpos($v, 'v') === 0) ? $v : 'v' . $v;
        }
    }
    return 'v1.9.1';
}

function get_program_type() {
    return 'Desktop';
}

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

function call_activation_service($hwid, $phone, $company, $program_name = null, $program_version = null, $program_type = null, $start_date = null) {
    $payload = [
        'secret_key' => defined('ACTIVATION_SECRET_KEY') ? ACTIVATION_SECRET_KEY : 'Bad220020!@#',
        'hwid' => (string)$hwid,
        'program_name' => $program_name ?: get_program_name(),
        'program_version' => $program_version ?: get_program_version(),
        'program_type' => $program_type ?: get_program_type(),
        'phone' => (string)($phone ?? ''),
        'company' => (string)($company ?? ''),
        'start_date' => $start_date ?: date('Y-m-d H:i:s'),
        'installed_date' => $start_date ?: date('Y-m-d H:i:s')
    ];

    if (!function_exists('curl_init')) {
        return ['success' => false, 'message' => 'cURL is not available on this server.'];
    }

    $jsonPayload = json_encode($payload, JSON_UNESCAPED_UNICODE);

    $attempts = 0;
    $maxAttempts = 3;
    $response = false;
    $lastError = '';

    while ($attempts < $maxAttempts) {
        $ch = curl_init(ACTIVATION_SCRIPT_URL);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, $jsonPayload);
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            'Content-Type: application/json; charset=utf-8',
            'Accept: application/json'
        ]);
        // Increase timeouts to be tolerant of slow networks; keep reasonable limits
        curl_setopt($ch, CURLOPT_TIMEOUT, 20);
        curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 6);
        curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
        curl_setopt($ch, CURLOPT_MAXREDIRS, 5);
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
        curl_setopt($ch, CURLOPT_USERAGENT, 'DragonERP/1.0');

        $response = curl_exec($ch);
        if ($response === false) {
            $lastError = curl_error($ch);
            curl_close($ch);
            $attempts++;
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
        return ['success' => false, 'message' => 'Invalid activation response: ' . substr((string)$response, 0, 100)];
    }

    if (($data['status'] ?? '') !== 'success') {
        return ['success' => false, 'message' => $data['message'] ?? 'Activation failed.'];
    }

    // Standardize license type and expiry for system compatibility
    $rawType = $data['license_type'] ?? ($data['type'] ?? 'Trial');
    $normalizedType = (in_array(strtolower(trim((string)$rawType)), ['تجريبية', 'تجريبي', 'trial'])) ? 'Trial' : 'Lifetime';
    $rawExpiry = $data['end_date'] ?? ($data['expiry'] ?? '');
    $isExpired = false;
    if (isset($data['is_expired'])) {
        $isExpired = filter_var($data['is_expired'], FILTER_VALIDATE_BOOLEAN);
    } elseif (!empty($rawExpiry) && strtotime($rawExpiry) !== false) {
        $isExpired = time() > strtotime($rawExpiry);
    }

    $standardData = [
        'status' => 'success',
        'message' => $data['message'] ?? '',
        'type' => $normalizedType,
        'license_type' => $rawType,
        'expiry' => $rawExpiry,
        'end_date' => $rawExpiry,
        'account_status' => $data['account_status'] ?? 'Active',
        'is_expired' => $isExpired ? 'true' : 'false',
        'server_time' => $data['server_time'] ?? date('Y-m-d H:i:s')
    ];

    return ['success' => true, 'data' => $standardData];
}

function self_heal_license_from_db() {
    $config_path = __DIR__ . '/../config.php';
    if (!file_exists($config_path)) {
        return null;
    }

    require_once $config_path;
    if (!defined('DB_HOST') || !defined('DB_USER') || !defined('DB_NAME')) {
        return null;
    }

    try {
        $pdo = new PDO("mysql:host=" . DB_HOST . ";dbname=" . DB_NAME . ";charset=utf8mb4", DB_USER, DB_PASS);
        $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

        $settings = [];
        $checkApp = $pdo->query("SHOW TABLES LIKE 'app_settings'")->fetch();
        if ($checkApp) {
            try {
                $cols = $pdo->query("SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'app_settings'")->fetchAll(PDO::FETCH_COLUMN);
                $kcol = 'name'; $vcol = 'value';
                if (in_array('name', $cols) && in_array('value', $cols)) { $kcol = 'name'; $vcol = 'value'; }
                elseif (in_array('k', $cols) && in_array('v', $cols)) { $kcol = 'k'; $vcol = 'v'; }
                elseif (in_array('key', $cols) && in_array('value', $cols)) { $kcol = 'key'; $vcol = 'value'; }
                elseif (count($cols) >= 2) { $kcol = $cols[0]; $vcol = $cols[1]; }

                $rows = $pdo->query("SELECT `" . $kcol . "`, `" . $vcol . "` FROM app_settings")->fetchAll(PDO::FETCH_ASSOC);
                foreach ($rows as $r) { $settings[(string)$r[$kcol]] = $r[$vcol]; }
            } catch (Exception $e) {}
        }

        $checkLegacy = $pdo->query("SHOW TABLES LIKE 'settings'")->fetch();
        if ($checkLegacy) {
            try {
                $rows = $pdo->query("SELECT config_key, config_value FROM settings")->fetchAll(PDO::FETCH_ASSOC);
                foreach ($rows as $r) {
                    if (!isset($settings[$r['config_key']])) {
                        $settings[$r['config_key']] = $r['config_value'];
                    }
                }
            } catch (Exception $e) {}
        }

        $hwid = get_hwid();
        $companyName = $settings['company_name'] ?? 'DragonPro User';
        $companyPhone = $settings['company_phone'] ?? '';
        $activationType = $settings['activation_type'] ?? 'Trial';
        $activationExpiry = $settings['activation_expiry'] ?? '';
        $activationAccountStatus = $settings['activation_account_status'] ?? 'Active';
        $activationIsExpired = $settings['activation_is_expired'] ?? 'false';
        $activationLastCheck = date('Y-m-d H:i:s');

        // Optional online refresh
        $activationResult = call_activation_service($hwid, $companyPhone, $companyName);
        if ($activationResult['success']) {
            $actData = $activationResult['data'] ?? [];
            $activationType = $actData['type'] ?? $activationType;
            $activationExpiry = $actData['expiry'] ?? $activationExpiry;
            $activationAccountStatus = $actData['account_status'] ?? $activationAccountStatus;
            $activationIsExpired = (($actData['is_expired'] ?? 'false') === 'true' || $actData['is_expired'] === true) ? 'true' : 'false';
            $activationLastCheck = $actData['server_time'] ?? date('Y-m-d H:i:s');
        }

        $license_data = [
            'hwid' => $hwid,
            'company_name' => $companyName,
            'company_phone' => $companyPhone,
            'installed_date' => date('Y-m-d H:i:s'),
            'activation_type' => $activationType,
            'activation_expiry' => $activationExpiry,
            'activation_account_status' => $activationAccountStatus,
            'activation_is_expired' => $activationIsExpired,
            'activation_last_check' => $activationLastCheck,
            'version' => '1.0.3'
        ];

        return $license_data;
    } catch (Exception $e) {
        return null;
    }
}

function check_license_validity($force_online = false) {
    $config_path = __DIR__ . '/../config.php';
    $license_path = __DIR__ . '/../Dragon.lic';

    if (!file_exists($config_path)) {
        return ['status' => 'not_installed', 'message' => 'النظام غير مثبت بعد.'];
    }

    require_once __DIR__ . '/encryption.php';

    $encrypted_data = file_exists($license_path) ? @file_get_contents($license_path) : false;
    $decrypted_json = ($encrypted_data !== false && $encrypted_data !== '') ? decrypt_data($encrypted_data) : false;
    $license_data = ($decrypted_json !== false) ? json_decode($decrypted_json, true) : null;

    // Self-healing: if license file is missing, corrupt, or invalid, rebuild it from DB
    if (!is_array($license_data)) {
        $license_data = self_heal_license_from_db();
        if (is_array($license_data)) {
            $encrypted_license = encrypt_data(json_encode($license_data));
            @file_put_contents($license_path, $encrypted_license);
        } else {
            return ['status' => 'tampered', 'message' => 'ملف الترخيص غير موجود أو تالف.'];
        }
    } else {
        // Upgrade license file to standardized encrypted format if needed
        $standard_encrypted = encrypt_data(json_encode($license_data));
        if ($encrypted_data !== $standard_encrypted) {
            @file_put_contents($license_path, $standard_encrypted);
        }
    }

    // If online check is requested (e.g. on login or verify with internet)
    $last_check_raw = $license_data['activation_last_check'] ?? '';
    $last_check_ts = !empty($last_check_raw) ? strtotime($last_check_raw) : false;
    $is_recent = ($last_check_ts !== false && (time() - $last_check_ts) < 180);

    if ($force_online && !$is_recent) {
        $server_hwid = get_hwid();
        $onlineRes = call_activation_service(
            $server_hwid,
            $license_data['company_phone'] ?? '',
            $license_data['company_name'] ?? '',
            get_program_name(),
            get_program_version(),
            get_program_type(),
            $license_data['installed_date'] ?? null
        );

        if ($onlineRes['success']) {
            $actData = $onlineRes['data'] ?? [];
            $license_data['hwid'] = $server_hwid;
            $license_data['activation_type'] = $actData['type'] ?? ($license_data['activation_type'] ?? 'Trial');
            $license_data['activation_expiry'] = $actData['expiry'] ?? ($license_data['activation_expiry'] ?? '');
            $license_data['activation_account_status'] = $actData['account_status'] ?? 'Active';
            $license_data['activation_is_expired'] = (($actData['is_expired'] ?? 'false') === 'true' || $actData['is_expired'] === true) ? 'true' : 'false';
            $license_data['activation_last_check'] = $actData['server_time'] ?? date('Y-m-d H:i:s');

            $encrypted_license = encrypt_data(json_encode($license_data));
            @file_put_contents($license_path, $encrypted_license);

            // Sync to database settings
            try {
                require_once $config_path;
                if (defined('DB_HOST') && defined('DB_NAME') && defined('DB_USER')) {
                    $pdo = new PDO("mysql:host=" . DB_HOST . ";dbname=" . DB_NAME . ";charset=utf8mb4", DB_USER, DB_PASS, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
                    $upsert = $pdo->prepare("INSERT INTO settings (config_key, config_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE config_value = VALUES(config_value)");
                    $upsert->execute(['activation_type', $license_data['activation_type']]);
                    $upsert->execute(['activation_expiry', $license_data['activation_expiry']]);
                    $upsert->execute(['activation_account_status', $license_data['activation_account_status']]);
                    $upsert->execute(['activation_is_expired', $license_data['activation_is_expired']]);
                    $upsert->execute(['activation_last_check', $license_data['activation_last_check']]);
                }
            } catch (Exception $e) {}
        }
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
    $is_trial = in_array($activation_type_norm, ['trial', 'تجريبية', 'تجريبي'], true);

    // 1. Account status check
    if (strtolower(trim((string)$activation_account_status)) === 'blocked') {
        return ['status' => 'activation_blocked', 'message' => 'تم حظر هذا الترخيص.'];
    }

    // 2. Clock tampering check
    $last_check_raw = $license_data['activation_last_check'] ?? '';
    if (!empty($last_check_raw)) {
        $last_check_ts = strtotime($last_check_raw);
        // If system clock is set back, try to verify with server or adjust if reasonable drift
        if ($last_check_ts !== false && time() < ($last_check_ts - 300)) {
            // Attempt auto-healing or online refresh before failing
            $freshData = self_heal_license_from_db();
            if (is_array($freshData)) {
                $license_data = $freshData;
                $encrypted_license = encrypt_data(json_encode($license_data));
                @file_put_contents($license_path, $encrypted_license);
            } else {
                return ['status' => 'tampered', 'message' => 'تم العبث بتاريخ النظام أو ملف الترخيص.'];
            }
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

