<?php
session_start();
header('Content-Type: text/html; charset=utf-8');

if (empty($_SESSION['loggedin'])) {
    http_response_code(401);
    echo 'Unauthorized';
    exit;
}

function h($value) {
    return htmlspecialchars((string)$value, ENT_QUOTES, 'UTF-8');
}

function add_log(&$logs, $msg) {
    $logs[] = $msg;
}

function enable_zip_extension(&$logs, &$phpIniPathOut) {
    $phpIniPath = php_ini_loaded_file();
    $phpIniPathOut = $phpIniPath ?: '';

    if (!$phpIniPath || !file_exists($phpIniPath)) {
        throw new Exception('تعذر العثور على ملف php.ini المحمّل حالياً.');
    }

    if (!is_writable($phpIniPath)) {
        throw new Exception('ملف php.ini غير قابل للكتابة. شغّل Apache بصلاحية Administrator ثم أعد المحاولة.');
    }

    $raw = file_get_contents($phpIniPath);
    if ($raw === false) {
        throw new Exception('فشل قراءة php.ini');
    }

    if (preg_match('/^\s*extension\s*=\s*(zip|php_zip\.dll)\s*$/mi', $raw)) {
        add_log($logs, 'ملحق zip مفعّل بالفعل في php.ini.');
        return false; // no change needed
    }

    $backup = $phpIniPath . '.bak_' . date('Ymd_His');
    if (!copy($phpIniPath, $backup)) {
        throw new Exception('فشل إنشاء نسخة احتياطية من php.ini');
    }
    add_log($logs, 'تم إنشاء نسخة احتياطية: ' . $backup);

    $updated = $raw;
    $changed = 0;

    // Common forms in XAMPP/PHP8
    $updated = preg_replace('/^\s*;\s*extension\s*=\s*zip\s*$/mi', 'extension=zip', $updated, -1, $c1);
    $changed += (int)$c1;

    // Older Windows form
    if ($changed === 0) {
        $updated = preg_replace('/^\s*;\s*extension\s*=\s*php_zip\.dll\s*$/mi', 'extension=zip', $updated, -1, $c2);
        $changed += (int)$c2;
    }

    // Fallback: append if no line exists
    if ($changed === 0) {
        if (substr($updated, -1) !== "\n") $updated .= "\n";
        $updated .= "extension=zip\n";
        $changed = 1;
    }

    if ($changed > 0) {
        if (file_put_contents($phpIniPath, $updated) === false) {
            throw new Exception('فشل كتابة التعديلات على php.ini');
        }
        add_log($logs, 'تم تفعيل extension=zip داخل php.ini بنجاح.');
        return true;
    }

    throw new Exception('لم يتم تعديل php.ini (سبب غير متوقع).');
}

function try_restart_apache(&$logs) {
    $root = realpath(__DIR__ . '/..');
    $restartBat = $root . DIRECTORY_SEPARATOR . 'restart.bat';

    if (!file_exists($restartBat)) {
        add_log($logs, 'لم يتم العثور على restart.bat.');
        return false;
    }

    if (!function_exists('popen')) {
        add_log($logs, 'الدالة popen غير متاحة، تعذر إعادة التشغيل التلقائي.');
        return false;
    }

    $cmd = 'cmd /c start "" "' . $restartBat . '"';
    $handle = @popen($cmd, 'r');
    if ($handle === false) {
        add_log($logs, 'فشل تشغيل restart.bat تلقائياً.');
        return false;
    }

    @pclose($handle);
    add_log($logs, 'تم إرسال أمر إعادة التشغيل تلقائياً (restart.bat). انتظر 10-20 ثانية ثم حدّث الصفحة.');
    return true;
}

$logs = [];
$error = '';
$success = false;
$phpIniPath = '';

if (($_POST['action'] ?? '') === 'run') {
    try {
        $changed = enable_zip_extension($logs, $phpIniPath);

        if (!$changed) {
            $success = true;
            add_log($logs, 'لا يوجد تعديل مطلوب.');
        } else {
            $restartOk = try_restart_apache($logs);
            $success = true;
            if (!$restartOk) {
                add_log($logs, 'ملاحظة: قد تحتاج إعادة تشغيل Apache يدوياً إذا لم تُطبّق التغييرات.');
            }
        }
    } catch (Exception $e) {
        $error = $e->getMessage();
    }
}

$zipLoaded = extension_loaded('zip');
?>
<!doctype html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>تفعيل php_zip تلقائياً</title>
  <style>
    body{font-family:Tahoma,Arial,sans-serif;background:#0f172a;color:#e2e8f0;margin:0;padding:24px}
    .card{max-width:820px;margin:0 auto;background:#111827;border:1px solid #334155;border-radius:14px;padding:18px}
    h1{margin:0 0 12px;font-size:22px}
    .muted{color:#94a3b8;font-size:13px}
    .ok{color:#22c55e}.err{color:#ef4444}.warn{color:#f59e0b}
    button{background:#2563eb;color:#fff;border:0;padding:10px 14px;border-radius:10px;cursor:pointer;font-weight:700}
    pre{background:#020617;border:1px solid #1e293b;padding:10px;border-radius:8px;white-space:pre-wrap}
    .row{margin:10px 0;padding:10px;border:1px solid #334155;border-radius:10px;background:#0b1220}
  </style>
</head>
<body>
  <div class="card">
    <h1>تفعيل php_zip تلقائياً</h1>

    <div class="row">
      <div>حالة zip الحالية: <?php if ($zipLoaded): ?><span class="ok">مفعّل</span><?php else: ?><span class="err">غير مفعّل</span><?php endif; ?></div>
      <div class="muted">php.ini: <?php echo h(php_ini_loaded_file() ?: 'غير معروف'); ?></div>
    </div>

    <form method="post" style="margin:12px 0;">
      <input type="hidden" name="action" value="run" />
      <button type="submit">تفعيل تلقائي الآن</button>
    </form>

    <?php if ($success): ?>
      <div class="row ok">تم تنفيذ العملية بنجاح.</div>
    <?php endif; ?>

    <?php if ($error): ?>
      <div class="row err">خطأ: <?php echo h($error); ?></div>
    <?php endif; ?>

    <div class="row">
      <div class="warn">السجل:</div>
      <pre><?php echo h(count($logs) ? implode("\n", $logs) : '-'); ?></pre>
    </div>
  </div>
</body>
</html>
