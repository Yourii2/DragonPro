<?php
session_start();

$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if ($origin) header('Access-Control-Allow-Origin: ' . $origin);
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Access-Control-Allow-Credentials: true');
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit(0); }

if (empty($_SESSION['loggedin'])) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'Unauthorized']);
    exit;
}

function read_json_file($path) {
    if (!file_exists($path)) return null;
    $raw = file_get_contents($path);
    $data = json_decode($raw, true);
    return is_array($data) ? $data : null;
}

function normalize_version($v) {
    $v = trim((string)$v);
    if ($v === '') return '0.0.0';
    if ($v[0] === 'v' || $v[0] === 'V') $v = substr($v, 1);
    $v = preg_replace('/[^0-9.]/', '', $v);
    return $v ?: '0.0.0';
}

function http_get_json($url, $headers = []) {
    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 20);
    $finalHeaders = array_merge([
        'Accept: application/vnd.github+json',
        'User-Agent: DragonERP-Updater'
    ], $headers);
    curl_setopt($ch, CURLOPT_HTTPHEADER, $finalHeaders);
    $body = curl_exec($ch);
    $err = curl_error($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($body === false) throw new Exception('Network error: ' . $err);
    if ($code >= 400) throw new Exception('HTTP error: ' . $code);

    $data = json_decode($body, true);
    if (!is_array($data)) throw new Exception('Invalid JSON response');
    return $data;
}

try {
    $root = realpath(__DIR__ . '/..');
    $cfg = read_json_file($root . '/update-config.json') ?: [];

    $owner = trim((string)($cfg['github']['owner'] ?? ''));
    $repo = trim((string)($cfg['github']['repo'] ?? ''));
    $assetName = trim((string)($cfg['github']['assetName'] ?? ''));

    $ver = read_json_file($root . '/version.json') ?: [];
    $currentVersion = normalize_version($ver['version'] ?? '0.0.0');

    if ($owner === '' || $repo === '' || $owner === 'PUT_OWNER_HERE' || $repo === 'PUT_REPO_HERE') {
        echo json_encode([
            'success' => true,
            'data' => [
                'current_version' => $currentVersion,
                'latest_version' => null,
                'update_available' => false,
                'configured' => false,
                'message' => 'Update repo not configured. Edit update-config.json.'
            ]
        ]);
        exit;
    }

    $release = http_get_json('https://api.github.com/repos/' . rawurlencode($owner) . '/' . rawurlencode($repo) . '/releases/latest');

    $tag = (string)($release['tag_name'] ?? '');
    $latestVersion = normalize_version($tag);

    $assetUrl = null;
    $assetFoundName = null;
    $assets = $release['assets'] ?? [];
    if (is_array($assets)) {
        foreach ($assets as $a) {
            if (!is_array($a)) continue;
            $name = (string)($a['name'] ?? '');
            $url = (string)($a['browser_download_url'] ?? '');
            if ($url === '') continue;
            if ($assetName !== '') {
                if (strcasecmp($name, $assetName) === 0) {
                    $assetUrl = $url;
                    $assetFoundName = $name;
                    break;
                }
            } else {
                if (preg_match('/\.zip$/i', $name)) {
                    $assetUrl = $url;
                    $assetFoundName = $name;
                    break;
                }
            }
        }
    }

    $updateAvailable = version_compare($latestVersion, $currentVersion, '>');

    echo json_encode([
        'success' => true,
        'data' => [
            'configured' => true,
            'current_version' => $currentVersion,
            'latest_version' => $latestVersion,
            'update_available' => $updateAvailable,
            'tag' => $tag,
            'asset_name' => $assetFoundName,
            'asset_url' => $assetUrl,
            'published_at' => $release['published_at'] ?? null,
            'release_name' => $release['name'] ?? null
        ]
    ]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => $e->getMessage()]);
}
