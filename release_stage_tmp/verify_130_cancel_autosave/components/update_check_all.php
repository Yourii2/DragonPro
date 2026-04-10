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
    $repo  = trim((string)($cfg['github']['repo'] ?? ''));
    $assetName = trim((string)($cfg['github']['assetName'] ?? ''));

    $ver = read_json_file($root . '/version.json') ?: [];
    $currentVersion = normalize_version($ver['version'] ?? '0.0.0');

    if ($owner === '' || $repo === '' || $owner === 'PUT_OWNER_HERE' || $repo === 'PUT_REPO_HERE') {
        echo json_encode([
            'success' => true,
            'data' => [
                'current_version' => $currentVersion,
                'configured' => false,
                'releases' => [],
                'message' => 'Update repo not configured. Edit update-config.json.'
            ]
        ]);
        exit;
    }

    // Fetch all releases (GitHub returns up to 30 by default, use per_page=100)
    $allReleases = http_get_json(
        'https://api.github.com/repos/' . rawurlencode($owner) . '/' . rawurlencode($repo) . '/releases?per_page=100'
    );

    $releases = [];
    foreach ($allReleases as $release) {
        if (!is_array($release)) continue;
        if (!empty($release['draft'])) continue; // skip drafts

        $tag = (string)($release['tag_name'] ?? '');
        $ver_norm = normalize_version($tag);

        // Find relevant zip asset
        // 1) Prefer exact configured asset name (if provided)
        // 2) Fallback to any .zip asset in the release (for older versions with different naming)
        $assetUrl = null;
        $assetFoundName = null;
        $assets = $release['assets'] ?? [];
        if (is_array($assets)) {
            if ($assetName !== '') {
                foreach ($assets as $a) {
                    if (!is_array($a)) continue;
                    $name = (string)($a['name'] ?? '');
                    $url  = (string)($a['browser_download_url'] ?? '');
                    if ($url === '') continue;
                    if (strcasecmp($name, $assetName) === 0) {
                        $assetUrl = $url;
                        $assetFoundName = $name;
                        break;
                    }
                }
            }

            if ($assetUrl === null) {
                foreach ($assets as $a) {
                    if (!is_array($a)) continue;
                    $name = (string)($a['name'] ?? '');
                    $url  = (string)($a['browser_download_url'] ?? '');
                    if ($url === '') continue;
                    if (preg_match('/\.zip$/i', $name)) {
                        $assetUrl = $url;
                        $assetFoundName = $name;
                        break;
                    }
                }
            }
        }

        $cmp = version_compare($ver_norm, $currentVersion);
        if ($cmp > 0)       $status = 'new';
        elseif ($cmp === 0) $status = 'current';
        else                $status = 'old';

        $releases[] = [
            'tag'          => $tag,
            'version'      => $ver_norm,
            'name'         => (string)($release['name'] ?? $tag),
            'body'         => (string)($release['body'] ?? ''),
            'published_at' => (string)($release['published_at'] ?? ''),
            'prerelease'   => !empty($release['prerelease']),
            'asset_url'    => $assetUrl,
            'asset_name'   => $assetFoundName,
            'status'       => $status,  // 'new' | 'current' | 'old'
        ];
    }

    // Sort: newest first
    usort($releases, fn($a, $b) => version_compare($b['version'], $a['version']));

    $newCount = count(array_filter($releases, fn($r) => $r['status'] === 'new'));

    echo json_encode([
        'success' => true,
        'data' => [
            'configured'      => true,
            'current_version' => $currentVersion,
            'new_count'       => $newCount,
            'releases'        => $releases,
        ]
    ]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => $e->getMessage()]);
}
