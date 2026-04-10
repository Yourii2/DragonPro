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

    $ch = curl_init(ACTIVATION_SCRIPT_URL);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, $payload);
    curl_setopt($ch, CURLOPT_TIMEOUT, 6);
    curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 3);
    curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
    curl_setopt($ch, CURLOPT_MAXREDIRS, 5);
    curl_setopt($ch, CURLOPT_USERAGENT, 'DragonERP/1.0');

    $response = curl_exec($ch);
    if ($response === false) {
        $error = curl_error($ch);
        curl_close($ch);
        return ['success' => false, 'message' => 'Activation request failed: ' . $error];
    }

    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

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
