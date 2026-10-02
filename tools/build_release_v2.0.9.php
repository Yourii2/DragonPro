<?php
$version = '2.0.9';
$root = realpath(__DIR__ . '/..');

echo "=== Packaging DragonPro v{$version} Release (Full Source + Compiled Bundle) ===\n";

// 0. Update version files
$buildDate = date('Y-m-d');
file_put_contents($root . '/version.json', json_encode([
    'version' => $version,
    'buildDate' => $buildDate
], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES) . "\n");
echo " + Updated version.json to {$version}\n";

$pkgFile = $root . '/package.json';
if (file_exists($pkgFile)) {
    $pkg = json_decode(file_get_contents($pkgFile), true);
    if ($pkg) {
        $pkg['version'] = $version;
        file_put_contents($pkgFile, json_encode($pkg, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES) . "\n");
        echo " + Updated package.json to {$version}\n";
    }
}

$updConfig = $root . '/update-config.json';
if (file_exists($updConfig)) {
    $cfg = json_decode(file_get_contents($updConfig), true);
    if ($cfg && isset($cfg['github'])) {
        $cfg['github']['version'] = $version;
        $cfg['github']['assetName'] = "DragonPro_v{$version}.zip";
        file_put_contents($updConfig, json_encode($cfg, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES) . "\n");
        echo " + Updated update-config.json to {$version}\n";
    }
}

// 1. Reset index.html to source mode
chdir($root);
exec('node scripts/prepare-html.cjs', $prepOut, $prepRc);

// 2. Build frontend via npm run build
echo "Step 1: Running npm run build to ensure dist is 100% up-to-date...\n";
exec('npm.cmd run build', $buildOut, $buildRc);
if ($buildRc !== 0) {
    die("Error: Frontend build failed:\n" . implode("\n", $buildOut) . "\n");
}
echo " + Frontend build succeeded.\n";

// Write dist/.version
file_put_contents($root . '/dist/.version', $version);
echo " + Wrote dist/.version with {$version}\n";

// 3. Sync dist assets to root assets
if (is_dir($root . '/dist/assets')) {
    if (!is_dir($root . '/assets')) @mkdir($root . '/assets', 0777, true);
    foreach (glob($root . '/assets/*.{js,css}', GLOB_BRACE) as $oldF) {
        @unlink($oldF);
    }
    foreach (glob($root . '/dist/assets/*') as $f) {
        @copy($f, $root . '/assets/' . basename($f));
    }
    echo " + Assets: synced to root assets/\n";
}
if (file_exists($root . '/dist/index.html')) {
    copy($root . '/dist/index.html', $root . '/index.html');
}
// Immediately restore index.html for Vite development/preview
exec('node scripts/prepare-html.cjs');

// 4. Target zip paths
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

function add_dir_to_zip($zip, $dirPath, $zipBaseRel, $excludeExtensions = ['tmp', 'bak', 'log']) {
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

// 5. Root files
$rootFiles = [
    'App.tsx',
    'index.tsx',
    'constants.tsx',
    'types.ts',
    'index.css',
    'index.html',
    'sw.js',
    'version.json',
    'package.json',
    'package-lock.json',
    'tsconfig.json',
    'tailwind.config.js',
    'postcss.config.js',
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
    'Release.bat',
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

// 6. Production index.html and dist
if (file_exists($root . '/dist/index.html')) {
    add_file_to_zip($zip, $root . '/dist/index.html', 'index.html');
    add_file_to_zip($zip, $root . '/dist/index.html', 'dist/index.html');
}

if (file_exists($root . '/dist/.version')) {
    add_file_to_zip($zip, $root . '/dist/.version', 'dist/.version');
}

if (is_dir($root . '/dist/assets')) {
    add_dir_to_zip($zip, $root . '/dist/assets', 'assets');
    add_dir_to_zip($zip, $root . '/dist/assets', 'dist/assets');
    echo " + Assets: added production compiled bundle\n";
}

// 7. Components folder - ALL .tsx, .ts, .php
if (is_dir($root . '/components')) {
    add_dir_to_zip($zip, $root . '/components', 'components', ['log', 'tmp', 'bak']);
    echo " + Components: added ALL backend & frontend components (.php & .tsx)\n";
}

// 8. Types
if (is_dir($root . '/types')) {
    add_dir_to_zip($zip, $root . '/types', 'types');
    echo " + Types: added\n";
}

// 9. Services
if (is_dir($root . '/services')) {
    add_dir_to_zip($zip, $root . '/services', 'services');
    echo " + Services: added\n";
}

// 10. Public
if (is_dir($root . '/public')) {
    add_dir_to_zip($zip, $root . '/public', 'public');
    echo " + Public: added\n";
}

// 11. Scripts
if (is_dir($root . '/scripts')) {
    add_dir_to_zip($zip, $root . '/scripts', 'scripts');
    echo " + Scripts: added\n";
}

// 12. Migrations
if (is_dir($root . '/migrations')) {
    add_dir_to_zip($zip, $root . '/migrations', 'migrations');
    echo " + Migrations: added\n";
}

// 13. Tools
if (is_dir($root . '/tools')) {
    add_dir_to_zip($zip, $root . '/tools', 'tools');
    echo " + Tools: added\n";
}

$zip->close();

// Copy to root
copy($zipPaths[0], $zipPaths[1]);

$sizeMb = round(filesize($zipPaths[0]) / (1024 * 1024), 2);
echo "\nSUCCESS! Created COMPLETE DragonPro v{$version} package:\n";
echo " 1. {$zipPaths[0]} ({$sizeMb} MB)\n";
echo " 2. {$zipPaths[1]} ({$sizeMb} MB)\n";
