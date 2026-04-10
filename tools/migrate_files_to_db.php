<?php
// Scan common file locations (root Dragon.png and uploads/) and insert into app_files
require_once __DIR__ . '/../config.php';
header('Content-Type: application/json; charset=utf-8');
$report = ['success' => false, 'migrated' => [], 'skipped' => [], 'errors' => []];
try {
    $pdo = new PDO("mysql:host=" . DB_HOST . ";dbname=" . DB_NAME . ";charset=utf8mb4", DB_USER, DB_PASS, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);

    // Ensure app_files table exists (create if missing)
    $pdo->exec(file_get_contents(__DIR__ . '/../migrations/2026_04_03_create_app_files.sql'));

    $candidates = [];
    $rootLogo = realpath(__DIR__ . '/../Dragon.png');
    if ($rootLogo && is_file($rootLogo)) $candidates[] = $rootLogo;

    $uploadsDir = realpath(__DIR__ . '/../uploads');
    if ($uploadsDir && is_dir($uploadsDir)) {
        $it = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($uploadsDir));
        foreach ($it as $f) {
            if ($f->isFile()) {
                $ext = strtolower(pathinfo($f->getFilename(), PATHINFO_EXTENSION));
                if (in_array($ext, ['png','jpg','jpeg','gif','pdf','svg','txt','json'], true)) {
                    $candidates[] = $f->getPathname();
                }
            }
        }
    }

    if (empty($candidates)) {
        $report['success'] = true;
        echo json_encode($report, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
        exit(0);
    }

    $insert = $pdo->prepare("INSERT INTO app_files (filename, mime, sha1, data) VALUES (:fn, :mime, :sha1, :data)");
    $check = $pdo->prepare("SELECT id FROM app_files WHERE sha1 = :sha1 LIMIT 1");

    foreach ($candidates as $path) {
        try {
            $sha1 = sha1_file($path);
            if ($sha1 === false) { throw new Exception('Failed to hash file'); }
            $check->execute([':sha1' => $sha1]);
            $row = $check->fetch(PDO::FETCH_ASSOC);
            if ($row) {
                $report['skipped'][] = ['path' => $path, 'reason' => 'already_imported', 'id' => (int)$row['id']];
                continue;
            }

            $data = file_get_contents($path);
            if ($data === false) throw new Exception('Failed to read file');
            $mime = function_exists('mime_content_type') ? mime_content_type($path) : null;
            if (!$mime) {
                $ext = strtolower(pathinfo($path, PATHINFO_EXTENSION));
                $mime = $ext === 'png' ? 'image/png' : ($ext === 'jpg' || $ext === 'jpeg' ? 'image/jpeg' : 'application/octet-stream');
            }

            $insert->execute([':fn' => basename($path), ':mime' => $mime, ':sha1' => $sha1, ':data' => $data]);
            $fileId = (int)$pdo->lastInsertId();
            $report['migrated'][] = ['path' => $path, 'id' => $fileId, 'sha1' => $sha1];

            // Update app_settings/company_logo_file_id for matches
            $possibleKeys = ['company_logo', 'company_logo_url', 'Dragon_company_logo'];
            foreach ($possibleKeys as $k) {
                try {
                    // prefer name/value schema
                    $u = $pdo->prepare("INSERT INTO app_settings (name, value) VALUES (:k, :v) ON DUPLICATE KEY UPDATE value = VALUES(value)");
                    $u->execute([':k' => 'company_logo_file_id', ':v' => (string)$fileId]);
                } catch (Exception $e) {
                    // try legacy k/v
                    try {
                        $u2 = $pdo->prepare("INSERT INTO app_settings (`k`, `v`) VALUES (:k, :v) ON DUPLICATE KEY UPDATE `v` = VALUES(`v`)");
                        $u2->execute([':k' => 'company_logo_file_id', ':v' => (string)$fileId]);
                    } catch (Exception $e2) {
                        // fallback to legacy settings table
                        try {
                            $u3 = $pdo->prepare("INSERT INTO settings (config_key, config_value) VALUES (:k, :v) ON DUPLICATE KEY UPDATE config_value = VALUES(config_value)");
                            $u3->execute([':k' => 'company_logo_file_id', ':v' => (string)$fileId]);
                        } catch (Exception $e3) {
                            // ignore
                        }
                    }
                }
            }

        } catch (Exception $e) {
            $report['errors'][] = ['path' => $path, 'error' => $e->getMessage()];
        }
    }

    $report['success'] = true;
} catch (Exception $e) {
    $report['error'] = $e->getMessage();
}

echo json_encode($report, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
