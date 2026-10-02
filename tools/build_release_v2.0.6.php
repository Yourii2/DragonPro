<?php
$version = '2.0.6';
$root = realpath(__DIR__ . '/..');

echo "=== Packaging DragonPro v{$version} Release ===\n";

// 1. Build frontend via npm run build
echo "Step 1: Running npm run build to ensure dist is 100% up-to-date...\n";
chdir($root);
exec('npm.cmd run build', $buildOut, $buildRc);
if ($buildRc !== 0) {
    die("Error: Frontend build failed:\n" . implode("\n", $buildOut) . "\n");
}
echo " + Frontend build succeeded.\n";

// Write dist/.version
file_put_contents($root . '/dist/.version', $version);
echo " + Wrote dist/.version with {$version}\n";

// 2. Sync dist assets to root assets
if (is_dir($root . '/dist/assets')) {
    if (!is_dir($root . '/assets')) @mkdir($root . '/assets', 0777, true);
    // clean old js and css in assets
    foreach (glob($root . '/assets/*.{js,css}', GLOB_BRACE) as $oldF) {
        @unlink($oldF);
    }
    foreach (glob($root . '/dist/assets/*') as $f) {
        @copy($f, $root . '/assets/' . basename($f));
    }
    echo " + Assets: synced to root assets/\n";
}

// 3. Target zip paths
$outDir = $root . '/releases';
if (!is_dir($outDir)) @mkdir($outDir, 0777, true);

$zipPaths = [
    $outDir . "/DragonPro_v{$version}.zip",
    $root . "/DragonPro_v{$version}.zip"
];

$zip = new ZipArchive();
if ($zip->open($zipPaths[0], ZipArchive::CREATE | ZipArchive::OVERWRITE) !== true) {
    die("Error: Cannot create zip file at {$zipPaths[0]}\n");
}

function add_file_to_zip($zip, $filePath, $zipRelPath) {
    $zipRelPath = str_replace('\\', '/', ltrim($zipRelPath, '/\\'));
    $zip->addFile($filePath, $zipRelPath);
}

function add_dir_to_zip($zip, $dirPath, $zipBaseRel, $excludeExtensions = ['tmp', 'bak', 'log', 'ts', 'tsx']) {
    $it = new RecursiveIteratorIterator(
        new RecursiveDirectoryIterator($dirPath, FilesystemIterator::SKIP_DOTS),
        RecursiveIteratorIterator::SELF_FIRST
    );
    foreach ($it as $file) {
        $real = $file->getPathname();
        $ext = strtolower(pathinfo($real, PATHINFO_EXTENSION));
        if (in_array($ext, $excludeExtensions)) continue;
        if ($file->isDir()) continue;
        $rel = substr($real, strlen($dirPath));
        $rel = str_replace('\\', '/', ltrim($rel, '/\\'));
        $targetInZip = rtrim($zipBaseRel, '/') . '/' . $rel;
        add_file_to_zip($zip, $real, $targetInZip);
    }
}

// 4. Root files
$rootFiles = [
    'version.json',
    'package.json',
    'update-config.json',
    'CHANGELOG.md',
    'vite.config.ts',
    'tunnel.json',
    'Dragon.png',
    'icon-192.png',
    'icon-512.png',
    'icon-maskable.png',
    'manifest.json',
    'metadata.json',
    'start.bat',
    'start_new.bat',
    'restart.bat',
    'update_and_restart.bat'
];

foreach ($rootFiles as $rf) {
    $fp = $root . '/' . $rf;
    if (file_exists($fp)) {
        add_file_to_zip($zip, $fp, $rf);
        echo " + Root file: {$rf}\n";
    }
}

// 5. Production index.html and assets
if (file_exists($root . '/dist/index.html')) {
    add_file_to_zip($zip, $root . '/dist/index.html', 'index.html');
    add_file_to_zip($zip, $root . '/dist/index.html', 'dist/index.html');
}

if (file_exists($root . '/dist/.version')) {
    add_file_to_zip($zip, $root . '/dist/.version', 'dist/.version');
}

if (is_dir($root . '/dist/assets')) {
    add_dir_to_zip($zip, $root . '/dist/assets', 'assets', ['tmp']);
    add_dir_to_zip($zip, $root . '/dist/assets', 'dist/assets', ['tmp']);
    echo " + Assets: added production compiled bundle\n";
}

// 6. Components folder (exclude ts, tsx)
if (is_dir($root . '/components')) {
    add_dir_to_zip($zip, $root . '/components', 'components', ['ts', 'tsx', 'log', 'tmp', 'bak']);
    echo " + Components: added backend components\n";
}

// 7. Migrations
if (is_dir($root . '/migrations')) {
    add_dir_to_zip($zip, $root . '/migrations', 'migrations');
    echo " + Migrations: added\n";
}

// 8. Tools
if (is_dir($root . '/tools')) {
    add_dir_to_zip($zip, $root . '/tools', 'tools');
    echo " + Tools: added\n";
}

$zip->close();

// Copy to root
copy($zipPaths[0], $zipPaths[1]);

$sizeMb = round(filesize($zipPaths[0]) / (1024 * 1024), 2);
echo "\nSUCCESS! Created:\n";
echo " 1. {$zipPaths[0]} ({$sizeMb} MB)\n";
echo " 2. {$zipPaths[1]} ({$sizeMb} MB)\n";
