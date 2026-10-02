<?php
/**
 * DragonPro Remote Servers Management & Auto-Deployment Tool
 * Usage:
 *   php tools/servers_manager.php status
 *   php tools/servers_manager.php update all
 *   php tools/servers_manager.php update <server_id>
 */

$root = realpath(__DIR__ . '/..');
$cfgFile = $root . '/servers-config.json';

if (!file_exists($cfgFile)) {
    die("Error: servers-config.json not found!\n");
}

$servers = json_decode(file_get_contents($cfgFile), true);
if (!is_array($servers)) {
    die("Error: Invalid JSON in servers-config.json\n");
}

$command = $argv[1] ?? 'status';
$target = $argv[2] ?? 'all';

function server_login($srv) {
    $cookieFile = tempnam(sys_get_temp_dir(), 'dp_cookie_');
    $loginUrl = rtrim($srv['url'], '/') . '/components/login.php';

    $ch = curl_init($loginUrl);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode([
        'username' => $srv['username'],
        'password' => $srv['password']
    ]));
    curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
    curl_setopt($ch, CURLOPT_COOKIEJAR, $cookieFile);
    curl_setopt($ch, CURLOPT_COOKIEFILE, $cookieFile);
    curl_setopt($ch, CURLOPT_TIMEOUT, 20);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
    $res = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    $json = json_decode($res, true);
    if ($httpCode === 200 && !empty($json['success'])) {
        return ['ok' => true, 'cookie' => $cookieFile, 'user' => $json['user'] ?? null];
    }
    @unlink($cookieFile);
    $msg = $json['message'] ?? "HTTP $httpCode";
    return ['ok' => false, 'error' => $msg];
}

function server_check_updates($srv, $cookieFile) {
    $url = rtrim($srv['url'], '/') . '/components/update_check_all.php';
    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_COOKIEFILE, $cookieFile);
    curl_setopt($ch, CURLOPT_TIMEOUT, 20);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
    $res = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    $json = json_decode($res, true);
    if ($code === 200 && !empty($json['success'])) {
        return $json['data'] ?? [];
    }
    return null;
}

function server_run_update($srv, $cookieFile, $tags = ['v2.0.6']) {
    $url = rtrim($srv['url'], '/') . '/components/update_auto_installer.php?action=run';
    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode(['selected_tags' => $tags]));
    curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
    curl_setopt($ch, CURLOPT_COOKIEFILE, $cookieFile);
    curl_setopt($ch, CURLOPT_TIMEOUT, 180);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
    $res = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    $json = json_decode($res, true);
    return ['code' => $code, 'data' => $json, 'raw' => $res];
}

if ($command === 'status') {
    echo "========================================================\n";
    echo "      DragonPro - Remote Servers Status Check\n";
    echo "========================================================\n\n";

    foreach ($servers as $srv) {
        echo "[+] " . $srv['name'] . " (" . $srv['url'] . ")\n";
        $auth = server_login($srv);
        if (!$auth['ok']) {
            echo "    [ERROR] Login failed: " . $auth['error'] . "\n\n";
            continue;
        }

        $cookie = $auth['cookie'];
        $up = server_check_updates($srv, $cookie);
        if ($up) {
            $curVer = $up['current_version'] ?? 'Unknown';
            $pending = $up['new_count'] ?? 0;
            echo "    [OK] Logged in successfully (" . ($auth['user']['name'] ?? $srv['username']) . ")\n";
            echo "    [i] Current Version: v{$curVer}\n";
            echo "    [i] Available Updates: {$pending}\n";
            if ($pending > 0 && !empty($up['releases'])) {
                $latest = $up['releases'][0]['tag'] ?? '';
                echo "    [*] Latest Release: {$latest}\n";
            } else {
                echo "    [OK] Up-to-date!\n";
            }
        } else {
            echo "    [WARN] Logged in, but failed to fetch update info.\n";
        }

        @unlink($cookie);
        echo "\n";
    }
    exit(0);
}

if ($command === 'update') {
    echo "========================================================\n";
    echo "      DragonPro - Remote Servers Auto-Update\n";
    echo "========================================================\n\n";

    foreach ($servers as $srv) {
        if ($target !== 'all' && $srv['id'] !== $target && $srv['name'] !== $target) {
            continue;
        }

        echo "[+] Processing " . $srv['name'] . " (" . $srv['url'] . ")...\n";
        $auth = server_login($srv);
        if (!$auth['ok']) {
            echo "    [ERROR] Cannot update: Login failed (" . $auth['error'] . ")\n\n";
            continue;
        }

        $cookie = $auth['cookie'];
        $up = server_check_updates($srv, $cookie);
        $curVer = $up['current_version'] ?? 'Unknown';
        echo "    - Current Version: v{$curVer}\n";

        if ($curVer === '2.0.6') {
            echo "    - Server is ALREADY up-to-date on v2.0.6! Skipping.\n\n";
            @unlink($cookie);
            continue;
        }

        $pendingTags = [];
        if (!empty($up['releases'])) {
            foreach ($up['releases'] as $r) {
                if (!empty($r['tag']) && version_compare($r['version'], $curVer, '>')) {
                    $pendingTags[] = $r['tag'];
                }
            }
        }
        if (empty($pendingTags)) {
            $pendingTags = ['v2.0.5', 'v2.0.6'];
        }

        echo "    - Triggering update with tags (" . implode(', ', $pendingTags) . ") via update_auto_installer...\n";
        $res = server_run_update($srv, $cookie, $pendingTags);
        @unlink($cookie);

        if (!empty($res['data']['success'])) {
            echo "    [SUCCESS] " . ($res['data']['message'] ?? 'Updated successfully!') . "\n";
            if (!empty($res['data']['installed'])) {
                foreach ($res['data']['installed'] as $inst) {
                    echo "      + Installed: {$inst['tag']} ({$inst['version']})\n";
                }
            }
        } else {
            $msg = $res['data']['message'] ?? substr(strip_tags($res['raw']), 0, 200);
            echo "    [ERROR] Update failed: " . ($msg ?: 'HTTP ' . $res['code']) . "\n";
        }

        echo "\n";
    }
    exit(0);
}

echo "Usage: php tools/servers_manager.php [status|update] [all|<server_id>]\n";
