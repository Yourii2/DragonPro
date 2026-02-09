<?php
session_start();

$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if ($origin) header('Access-Control-Allow-Origin: ' . $origin);
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Access-Control-Allow-Credentials: true');
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit(0); }

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed']);
    exit;
}

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

function ensure_dir($dir) {
    if (!is_dir($dir)) {
        if (!mkdir($dir, 0775, true)) {
            throw new Exception('Failed to create directory: ' . $dir);
        }
    }
}

function normalize_rel($rel) {
    $rel = str_replace('\\', '/', $rel);
    $rel = ltrim($rel, '/');
    return $rel;
}

function is_excluded($rel, $excludeList) {
    $rel = normalize_rel($rel);
    foreach ($excludeList as $ex) {
        $ex = normalize_rel((string)$ex);
        if ($ex === '') continue;
        if (substr($ex, -1) === '/') {
            if (strpos($rel . '/', $ex) === 0) return true;
        } else {
            if (strcasecmp($rel, $ex) === 0) return true;
        }
    }
    return false;
}

function copy_tree($srcRoot, $dstRoot, $excludeList) {
    $it = new RecursiveIteratorIterator(
        new RecursiveDirectoryIterator($srcRoot, FilesystemIterator::SKIP_DOTS),
        RecursiveIteratorIterator::SELF_FIRST
    );

    foreach ($it as $file) {
        $srcPath = $file->getPathname();
        $rel = substr($srcPath, strlen($srcRoot));
        $rel = ltrim(str_replace('\\', '/', $rel), '/');
        if ($rel === '') continue;

        if (is_excluded($rel, $excludeList)) {
            continue;
        }

        $dstPath = rtrim($dstRoot, '/\\') . DIRECTORY_SEPARATOR . str_replace('/', DIRECTORY_SEPARATOR, $rel);

        if ($file->isDir()) {
            if (!is_dir($dstPath)) {
                mkdir($dstPath, 0775, true);
            }
        } else {
            $dstDir = dirname($dstPath);
            if (!is_dir($dstDir)) {
                mkdir($dstDir, 0775, true);
            }
            if (!copy($srcPath, $dstPath)) {
                throw new Exception('Failed to copy: ' . $rel);
            }
        }
    }
}

function host_allowed($url, $allowedHosts) {
    $parts = parse_url($url);
    if (!is_array($parts) || empty($parts['host'])) return false;
    $host = strtolower($parts['host']);
    foreach ($allowedHosts as $h) {
        if (strtolower($h) === $host) return true;
    }
    return false;
}

function download_file($url, $destPath) {
    $fp = fopen($destPath, 'w');
    if (!$fp) throw new Exception('Cannot write to: ' . $destPath);

    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_FILE, $fp);
    curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 120);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'User-Agent: DragonERP-Updater'
    ]);

    $ok = curl_exec($ch);
    $err = curl_error($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    fclose($fp);

    if ($ok === false) {
        @unlink($destPath);
        throw new Exception('Download error: ' . $err);
    }
    if ($code >= 400) {
        @unlink($destPath);
        throw new Exception('Download failed (HTTP ' . $code . ')');
    }
}

try {
    if (!class_exists('ZipArchive')) {
        throw new Exception('PHP extension ZipArchive is not enabled on this server. Enable php_zip then retry.');
    }

    $root = realpath(__DIR__ . '/..');
    $cfg = read_json_file($root . '/update-config.json') ?: [];

    $lockPath = $root . '/logs/update.lock';
    if (file_exists($lockPath)) {
        throw new Exception('An update is already running. If this is wrong, delete logs/update.lock and retry.');
    }
    ensure_dir($root . '/logs');
    file_put_contents($lockPath, date('c'));

    $exclude = $cfg['preserve'] ?? [];
    if (!is_array($exclude)) $exclude = [];

    // Always preserve critical runtime/customer files
    $exclude = array_values(array_unique(array_merge($exclude, [
        'config.php',
        'Dragon.lic',
        'nexus.lic',
        'uploads/',
        'logs/',
        'backups/',
        '.env.local'
    ])));

    $allowedHosts = $cfg['allowedHosts'] ?? ['github.com', 'objects.githubusercontent.com'];
    if (!is_array($allowedHosts)) $allowedHosts = ['github.com', 'objects.githubusercontent.com'];

    $input = json_decode(file_get_contents('php://input'), true);
    if (!is_array($input)) $input = [];

    $assetUrl = trim((string)($input['asset_url'] ?? ''));
    if ($assetUrl === '') {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'asset_url is required']);
        exit;
    }
    if (!preg_match('#^https://#i', $assetUrl)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Only https:// URLs are allowed']);
        exit;
    }
    if (!host_allowed($assetUrl, $allowedHosts)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Download host is not allowed']);
        exit;
    }

    $timestamp = date('Ymd_His');
    $backupDir = $root . '/backups/updates';
    ensure_dir($backupDir);

    $zipPath = $backupDir . '/update_' . $timestamp . '.zip';
    $extractDir = $backupDir . '/extract_' . $timestamp;
    ensure_dir($extractDir);

    download_file($assetUrl, $zipPath);

    $zip = new ZipArchive();
    if ($zip->open($zipPath) !== true) {
        throw new Exception('Invalid zip file');
    }
    if (!$zip->extractTo($extractDir)) {
        $zip->close();
        throw new Exception('Failed to extract zip');
    }
    $zip->close();

    // Detect release root
    $entries = array_values(array_filter(scandir($extractDir), function($x){ return $x !== '.' && $x !== '..'; }));
    $srcRoot = $extractDir;
    if (count($entries) === 1) {
        $single = $extractDir . DIRECTORY_SEPARATOR . $entries[0];
        if (is_dir($single)) $srcRoot = $single;
    }

    // Safety: require index.html or components folder to exist
    if (!file_exists($srcRoot . '/index.html') && !is_dir($srcRoot . '/components')) {
        throw new Exception('Zip does not look like a valid Dragon release');
    }

    copy_tree($srcRoot, $root, $exclude);

    @unlink($lockPath);

    echo json_encode([
        'success' => true,
        'message' => 'Update installed. Please refresh the page. If you use XAMPP service, you may restart Apache if needed.',
        'preserved' => $exclude,
        'backup_zip' => basename($zipPath)
    ]);

} catch (Exception $e) {
    try {
        $root = realpath(__DIR__ . '/..');
        if ($root) {
            $lockPath = $root . '/logs/update.lock';
            if (file_exists($lockPath)) @unlink($lockPath);
        }
    } catch (Exception $ignore) {
        // ignore
    }
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => $e->getMessage()]);
}
