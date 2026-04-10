<?php
session_start();

header('Content-Type: text/html; charset=utf-8');

if (empty($_SESSION['loggedin'])) {
    http_response_code(401);
    echo 'Unauthorized';
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

function ensure_dir($dir) {
    if (!is_dir($dir) && !mkdir($dir, 0775, true)) {
        throw new Exception('Failed to create directory: ' . $dir);
    }
}

function normalize_rel($rel) {
    $rel = str_replace('\\', '/', $rel);
    return ltrim($rel, '/');
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
        if ($rel === '' || is_excluded($rel, $excludeList)) continue;

        $dstPath = rtrim($dstRoot, '/\\') . DIRECTORY_SEPARATOR . str_replace('/', DIRECTORY_SEPARATOR, $rel);

        if ($file->isDir()) {
            if (!is_dir($dstPath)) mkdir($dstPath, 0775, true);
        } else {
            $dstDir = dirname($dstPath);
            if (!is_dir($dstDir)) mkdir($dstDir, 0775, true);
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

function http_get_json($url) {
    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 30);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Accept: application/vnd.github+json',
        'User-Agent: DragonERP-AutoInstaller'
    ]);
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

function download_file($url, $destPath) {
    $fp = fopen($destPath, 'w');
    if (!$fp) throw new Exception('Cannot write to: ' . $destPath);

    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_FILE, $fp);
    curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 180);
    curl_setopt($ch, CURLOPT_HTTPHEADER, ['User-Agent: DragonERP-AutoInstaller']);

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

function get_update_context($root) {
    $cfg = read_json_file($root . '/update-config.json') ?: [];
    $owner = trim((string)($cfg['github']['owner'] ?? ''));
    $repo = trim((string)($cfg['github']['repo'] ?? ''));
    $assetName = trim((string)($cfg['github']['assetName'] ?? ''));

    if ($owner === '' || $repo === '' || $owner === 'PUT_OWNER_HERE' || $repo === 'PUT_REPO_HERE') {
        throw new Exception('Update repo not configured. Edit update-config.json.');
    }

    $ver = read_json_file($root . '/version.json') ?: [];
    $currentVersion = normalize_version($ver['version'] ?? '0.0.0');

    $exclude = $cfg['preserve'] ?? [];
    if (!is_array($exclude)) $exclude = [];
    $exclude = array_values(array_unique(array_merge($exclude, [
        'config.php',
        'Dragon.lic',
        'nexus.lic',
        'uploads/',
        'logs/',
        'backups/',
        '.env.local'
    ])));

    $allowedHosts = $cfg['allowedHosts'] ?? ['github.com', 'objects.githubusercontent.com', 'raw.githubusercontent.com'];
    if (!is_array($allowedHosts)) $allowedHosts = ['github.com', 'objects.githubusercontent.com', 'raw.githubusercontent.com'];

    $allReleases = http_get_json('https://api.github.com/repos/' . rawurlencode($owner) . '/' . rawurlencode($repo) . '/releases?per_page=100');

    $releases = [];
    foreach ($allReleases as $release) {
        if (!is_array($release) || !empty($release['draft'])) continue;

        $tag = (string)($release['tag_name'] ?? '');
        $version = normalize_version($tag);

        $assetUrl = null;
        $assetFoundName = null;
        $assets = $release['assets'] ?? [];

        if (is_array($assets) && $assetName !== '') {
            foreach ($assets as $a) {
                if (!is_array($a)) continue;
                $name = (string)($a['name'] ?? '');
                $url = (string)($a['browser_download_url'] ?? '');
                if ($url !== '' && strcasecmp($name, $assetName) === 0) {
                    $assetUrl = $url;
                    $assetFoundName = $name;
                    break;
                }
            }
        }

        if ($assetUrl === null && is_array($assets)) {
            foreach ($assets as $a) {
                if (!is_array($a)) continue;
                $name = (string)($a['name'] ?? '');
                $url = (string)($a['browser_download_url'] ?? '');
                if ($url !== '' && preg_match('/\.zip$/i', $name)) {
                    $assetUrl = $url;
                    $assetFoundName = $name;
                    break;
                }
            }
        }

        $status = version_compare($version, $currentVersion) > 0 ? 'new' : (version_compare($version, $currentVersion) === 0 ? 'current' : 'old');

        $releases[] = [
            'tag' => $tag,
            'version' => $version,
            'name' => (string)($release['name'] ?? $tag),
            'published_at' => (string)($release['published_at'] ?? ''),
            'asset_url' => $assetUrl,
            'asset_name' => $assetFoundName,
            'status' => $status
        ];
    }

    usort($releases, fn($a, $b) => version_compare($b['version'], $a['version']));

    return [
        'current_version' => $currentVersion,
        'releases' => $releases,
        'exclude' => $exclude,
        'allowed_hosts' => $allowedHosts
    ];
}

function apply_release($root, $assetUrl, $exclude, $allowedHosts) {
    if (!class_exists('ZipArchive')) {
        throw new Exception('PHP extension ZipArchive is not enabled on this server. Enable php_zip then retry.');
    }
    if (!preg_match('#^https://#i', $assetUrl)) {
        throw new Exception('Only https:// URLs are allowed');
    }
    if (!host_allowed($assetUrl, $allowedHosts)) {
        throw new Exception('Download host is not allowed');
    }

    $timestamp = date('Ymd_His') . '_' . substr(md5(uniqid('', true)), 0, 6);
    $backupDir = $root . '/backups/updates';
    ensure_dir($backupDir);

    $zipPath = $backupDir . '/update_' . $timestamp . '.zip';
    $extractDir = $backupDir . '/extract_' . $timestamp;
    ensure_dir($extractDir);

    download_file($assetUrl, $zipPath);

    $zip = new ZipArchive();
    if ($zip->open($zipPath) !== true) throw new Exception('Invalid zip file');
    if (!$zip->extractTo($extractDir)) {
        $zip->close();
        throw new Exception('Failed to extract zip');
    }
    $zip->close();

    $entries = array_values(array_filter(scandir($extractDir), fn($x) => $x !== '.' && $x !== '..'));
    $srcRoot = $extractDir;
    if (count($entries) === 1) {
        $single = $extractDir . DIRECTORY_SEPARATOR . $entries[0];
        if (is_dir($single)) $srcRoot = $single;
    }

    if (!file_exists($srcRoot . '/index.html') && !is_dir($srcRoot . '/components')) {
        throw new Exception('Zip does not look like a valid Dragon release');
    }

    copy_tree($srcRoot, $root, $exclude);

    if (file_exists($srcRoot . '/manifest.json')) {
        @copy($srcRoot . '/manifest.json', $root . '/manifest.json');
        $manifest = read_json_file($srcRoot . '/manifest.json');
        if (is_array($manifest) && !empty($manifest['version'])) {
            $verObj = [
                'version' => (string)$manifest['version'],
                'buildDate' => (string)($manifest['date'] ?? date('Y-m-d'))
            ];
            file_put_contents($root . '/version.json', json_encode($verObj, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES));
        }
    }

    return true;
}

$root = realpath(__DIR__ . '/..');
$action = $_GET['action'] ?? $_POST['action'] ?? '';

if ($action === 'check') {
    header('Content-Type: application/json; charset=utf-8');
    try {
        $ctx = get_update_context($root);
        $newWithZip = array_values(array_filter($ctx['releases'], fn($r) => $r['status'] === 'new' && !empty($r['asset_url'])));
        usort($newWithZip, fn($a, $b) => version_compare($a['version'], $b['version']));

        echo json_encode([
            'success' => true,
            'current_version' => $ctx['current_version'],
            'pending_count' => count($newWithZip),
            'pending' => $newWithZip,
            'all' => $ctx['releases']
        ]);
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => $e->getMessage()]);
    }
    exit;
}

if ($action === 'run') {
    header('Content-Type: application/json; charset=utf-8');
    @set_time_limit(0);

    $lockPath = $root . '/logs/update.lock';
    try {
        ensure_dir($root . '/logs');
        if (file_exists($lockPath)) {
            throw new Exception('An update is already running. If this is wrong, delete logs/update.lock and retry.');
        }
        file_put_contents($lockPath, date('c'));

        $ctx = get_update_context($root);
        $queue = array_values(array_filter($ctx['releases'], fn($r) => $r['status'] === 'new' && !empty($r['asset_url'])));

        $input = json_decode(file_get_contents('php://input'), true);
        if (!is_array($input)) $input = [];
        $selectedTags = $input['selected_tags'] ?? [];
        if (!is_array($selectedTags)) $selectedTags = [];
        $selectedTags = array_values(array_filter(array_map(fn($x) => trim((string)$x), $selectedTags), fn($x) => $x !== ''));

        if (count($selectedTags) > 0) {
            $selectedLookup = array_fill_keys($selectedTags, true);
            $queue = array_values(array_filter($queue, fn($r) => isset($selectedLookup[(string)($r['tag'] ?? '')])));
        }

        usort($queue, fn($a, $b) => version_compare($a['version'], $b['version']));

        if (count($queue) === 0) {
            echo json_encode(['success' => true, 'message' => 'لا توجد تحديثات محددة قابلة للتثبيت.', 'installed' => []]);
            @unlink($lockPath);
            exit;
        }

        $installed = [];
        foreach ($queue as $rel) {
            apply_release($root, $rel['asset_url'], $ctx['exclude'], $ctx['allowed_hosts']);
            $installed[] = [
                'tag' => $rel['tag'],
                'version' => $rel['version'],
                'asset_name' => $rel['asset_name']
            ];
        }

        $latest = end($installed);
        if ($latest && !empty($latest['version'])) {
            file_put_contents($root . '/version.json', json_encode([
                'version' => (string)$latest['version'],
                'buildDate' => date('Y-m-d')
            ], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES));
        }

        @unlink($lockPath);
        echo json_encode(['success' => true, 'message' => 'تم تثبيت التحديثات المحددة بنجاح.', 'installed' => $installed]);
    } catch (Exception $e) {
        @unlink($lockPath);
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => $e->getMessage()]);
    }
    exit;
}
?>
<!doctype html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>مُثبت التحديثات التلقائي</title>
  <style>
    body{font-family:Tahoma,Arial,sans-serif;background:#0f172a;color:#e2e8f0;margin:0;padding:24px}
    .card{max-width:900px;margin:0 auto;background:#111827;border:1px solid #334155;border-radius:14px;padding:18px}
    h1{margin:0 0 12px;font-size:22px}
    .muted{color:#94a3b8;font-size:13px}
    button{background:#2563eb;color:#fff;border:0;padding:10px 14px;border-radius:10px;cursor:pointer;font-weight:700}
    button:disabled{opacity:.6;cursor:not-allowed}
    .row{display:flex;gap:8px;align-items:center;justify-content:space-between;margin:10px 0;padding:10px;border:1px solid #334155;border-radius:10px;background:#0b1220}
    .ok{color:#22c55e}.warn{color:#f59e0b}.err{color:#ef4444}
    pre{background:#020617;border:1px solid #1e293b;padding:10px;border-radius:8px;white-space:pre-wrap}
  </style>
</head>
<body>
  <div class="card">
    <h1>مُثبت التحديثات التلقائي</h1>
    <div id="status" class="muted">جارِ فحص التحديثات...</div>
    <div style="margin:14px 0;display:flex;gap:8px;flex-wrap:wrap;">
    <button id="btnRun" disabled>تثبيت التحديثات المحددة</button>
    <button id="btnSelectAll" disabled>تحديد الكل</button>
    <button id="btnClearAll" disabled>إلغاء التحديد</button>
      <button id="btnRefresh">إعادة الفحص</button>
    </div>
    <div id="list"></div>
    <h3>السجل</h3>
    <pre id="log">-</pre>
  </div>

  <script>
    const statusEl = document.getElementById('status');
    const listEl = document.getElementById('list');
    const logEl = document.getElementById('log');
    const btnRun = document.getElementById('btnRun');
        const btnSelectAll = document.getElementById('btnSelectAll');
        const btnClearAll = document.getElementById('btnClearAll');
    const btnRefresh = document.getElementById('btnRefresh');
        let selectedTags = new Set();
        let pendingRows = [];

        function syncButtons(){
            const hasPending = pendingRows.length > 0;
            btnSelectAll.disabled = !hasPending;
            btnClearAll.disabled = !hasPending;
            btnRun.disabled = selectedTags.size === 0;
        }

    function addLog(line){
      logEl.textContent = (logEl.textContent === '-' ? '' : logEl.textContent + '\n') + line;
    }

    async function check(){
      btnRun.disabled = true;
      listEl.innerHTML = '';
      statusEl.textContent = 'جارِ فحص التحديثات...';
      try{
        const res = await fetch('?action=check', { credentials: 'include' });
        const j = await res.json();
        if(!j.success) throw new Error(j.message || 'فشل فحص التحديثات');

                                pendingRows = (j.pending || []);
                                selectedTags = new Set(pendingRows.map(r => String(r.tag || '')));
                                statusEl.innerHTML = `الإصدار الحالي: <b>${j.current_version}</b> — تحديثات متاحة: <b>${j.pending_count}</b> — إجمالي الإصدارات: <b>${(j.all || []).length}</b>`;

                if ((j.pending || []).length > 0) {
                    const head = document.createElement('div');
                    head.className = 'row';
                                        head.innerHTML = '<div class="warn"><b>الإصدارات الجديدة القابلة للتثبيت الآن (اختر ما تريد)</b></div>';
                    listEl.appendChild(head);
                }

                (j.pending || []).forEach(r => {
          const div = document.createElement('div');
          div.className = 'row';
                    const tag = String(r.tag || '');
                    div.innerHTML = `
                        <div style="display:flex;align-items:center;gap:8px;">
                            <input type="checkbox" data-tag="${tag}" checked />
                            <div><b>${r.version}</b> - ${r.name}</div>
                        </div>
                        <div class="warn">${r.asset_name || 'ZIP'}</div>
                    `;
          listEl.appendChild(div);

                    const checkbox = div.querySelector('input[type="checkbox"]');
                    if (checkbox) {
                        checkbox.addEventListener('change', (e) => {
                            const checked = !!e.target.checked;
                            if (checked) selectedTags.add(tag);
                            else selectedTags.delete(tag);
                            syncButtons();
                        });
                    }
        });

                const allHead = document.createElement('div');
                allHead.className = 'row';
                allHead.innerHTML = '<div><b>كل الإصدارات</b></div>';
                listEl.appendChild(allHead);

                (j.all || []).forEach(r => {
                    const hasZip = !!r.asset_url;
                    const statusLabel = r.status === 'new' ? 'جديد' : (r.status === 'current' ? 'الحالي' : 'قديم');
                    const statusClass = r.status === 'new' ? 'warn' : (r.status === 'current' ? 'ok' : 'muted');
                    const zipLabel = hasZip ? (r.asset_name || 'ZIP') : 'لا يوجد ملف ZIP';
                    const zipClass = hasZip ? 'ok' : 'err';

                    const div = document.createElement('div');
                    div.className = 'row';
                    div.innerHTML = `<div><b>${r.version}</b> - ${r.name}</div><div><span class="${statusClass}">${statusLabel}</span> | <span class="${zipClass}">${zipLabel}</span></div>`;
                    listEl.appendChild(div);
                });

                                syncButtons();
      }catch(e){
        statusEl.innerHTML = `<span class="err">${e.message || e}</span>`;
                selectedTags = new Set();
                pendingRows = [];
                syncButtons();
      }
    }

    async function run(){
            if (selectedTags.size === 0) {
                addLog('✗ اختر تحديثاً واحداً على الأقل.');
                return;
            }
      btnRun.disabled = true;
            btnSelectAll.disabled = true;
            btnClearAll.disabled = true;
      btnRefresh.disabled = true;
            addLog('بدء تثبيت التحديثات المحددة...');
      try{
                const res = await fetch('?action=run', {
                    method:'POST',
                    credentials:'include',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ selected_tags: Array.from(selectedTags) })
                });
        const j = await res.json();
        if(!j.success) throw new Error(j.message || 'فشل التثبيت');

        (j.installed || []).forEach(x => addLog(`✓ تم تثبيت ${x.version} (${x.asset_name || x.tag})`));
        addLog('✓ اكتمل التثبيت. أعد تحميل الصفحة الرئيسية للنظام.');
        await check();
      }catch(e){
        addLog('✗ ' + (e.message || e));
      }finally{
        btnRefresh.disabled = false;
      }
    }

        btnSelectAll.addEventListener('click', () => {
            selectedTags = new Set(pendingRows.map(r => String(r.tag || '')));
            document.querySelectorAll('input[data-tag]').forEach((el) => { el.checked = true; });
            syncButtons();
        });

        btnClearAll.addEventListener('click', () => {
            selectedTags = new Set();
            document.querySelectorAll('input[data-tag]').forEach((el) => { el.checked = false; });
            syncButtons();
        });

    btnRefresh.addEventListener('click', check);
    btnRun.addEventListener('click', run);
    check();
  </script>
</body>
</html>
