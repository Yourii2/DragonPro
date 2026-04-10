<?php
// Scan release_stage_tmp and dist for JS files and replace occurrences
$root = __DIR__ . '/../';
$paths = [ $root . 'release_stage_tmp', $root . 'dist', $root . 'release_stage' ];
$report = ['updated' => [], 'skipped' => [], 'errors' => []];
foreach ($paths as $p) {
    if (!is_dir($p)) continue;
    $it = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($p));
    foreach ($it as $f) {
        if ($f->isFile()) {
            $ext = strtolower(pathinfo($f->getFilename(), PATHINFO_EXTENSION));
            if ($ext !== 'js') continue;
            $path = $f->getPathname();
            $content = @file_get_contents($path);
            if ($content === false) { $report['errors'][] = ['file' => $path, 'error' => 'read_failed']; continue; }
            $new = str_replace('settings.company_logo', 'settings.company_logo_url||settings.company_logo', $content);
            // also handle .settings.company_logo (with leading dot already included)
            $new = str_replace('.company_logo_url||settings.company_logo', '.company_logo_url||settings.company_logo', $new);
            if ($new !== $content) {
                if (@file_put_contents($path, $new) === false) {
                    $report['errors'][] = ['file' => $path, 'error' => 'write_failed'];
                } else {
                    $report['updated'][] = $path;
                }
            } else {
                $report['skipped'][] = $path;
            }
        }
    }
}
header('Content-Type: application/json');
echo json_encode($report, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
