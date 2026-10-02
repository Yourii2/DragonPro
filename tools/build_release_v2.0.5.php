<?php
$version = '2.0.5';
$root = realpath(__DIR__ . '/..');

echo "Building release zip for DragonPro v{$version}...\n";

// Sync dist assets to root assets
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

// 1. Target zip paths
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

// Helper to add file with normalized forward slash relative path
function add_file_to_zip($zip, $filePath, $zipRelPath) {
    $zipRelPath = str_replace('\\', '/', ltrim($zipRelPath, '/\\'));
    $zip->addFile($filePath, $zipRelPath);
}

// Helper to add directory recursively
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

// 1. Root files
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
    'metadata.json'
];

foreach ($rootFiles as $rf) {
    $fp = $root . '/' . $rf;
    if (file_exists($fp)) {
        add_file_to_zip($zip, $fp, $rf);
        echo " + Root file: {$rf}\n";
    }
}

// 2. Production index.html and assets
if (file_exists($root . '/dist/index.html')) {
    add_file_to_zip($zip, $root . '/dist/index.html', 'index.html');
    add_file_to_zip($zip, $root . '/dist/index.html', 'dist/index.html');
}

if (is_dir($root . '/dist/assets')) {
    add_dir_to_zip($zip, $root . '/dist/assets', 'assets', ['tmp']);
    add_dir_to_zip($zip, $root . '/dist/assets', 'dist/assets', ['tmp']);
    echo " + Assets: added production compiled bundle\n";
}

// 3. Components folder (exclude ts, tsx)
if (is_dir($root . '/components')) {
    add_dir_to_zip($zip, $root . '/components', 'components', ['ts', 'tsx', 'log', 'tmp', 'bak']);
    echo " + Components: added backend components\n";
}

// 4. Migrations
if (is_dir($root . '/migrations')) {
    add_dir_to_zip($zip, $root . '/migrations', 'migrations');
    echo " + Migrations: added\n";
}

// 5. Tools
if (is_dir($root . '/tools')) {
    add_dir_to_zip($zip, $root . '/tools', 'tools');
    echo " + Tools: added\n";
}

$zip->close();

// Copy to root as well
copy($zipPaths[0], $zipPaths[1]);

$sizeMb = round(filesize($zipPaths[0]) / (1024 * 1024), 2);
echo "\nSUCCESS! Created:\n";
echo " 1. {$zipPaths[0]} ({$sizeMb} MB)\n";
echo " 2. {$zipPaths[1]} ({$sizeMb} MB)\n";
