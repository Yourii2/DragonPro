<?php
// Comprehensive update runner for remote clients
// Usage: php scripts/run_update.php
// - Applies SQL files from migrations/ (records applied files in migrations_log)
// - Executes migrations/run_updates.php (conditional ALTERs)
// - Copies manifest -> version.json if present
// - Optionally runs npm build / composer install if tools are available
// - Executes post_update.php if present
// - Writes detailed logs to logs/update_run.log

chdir(__DIR__ . '/..');

// Basic helpers
function timestamp() { return date('Y-m-d H:i:s'); }

$logDir = __DIR__ . '/../logs';
if (!is_dir($logDir)) @mkdir($logDir, 0777, true);
$logFile = $logDir . '/update_run.log';

function logLine($msg) {
    global $logFile;
    $line = "[" . timestamp() . "] " . $msg . PHP_EOL;
    echo $line;
    @file_put_contents($logFile, $line, FILE_APPEND | LOCK_EX);
}

// Acquire a lock so concurrent runs won't interfere
$lockFile = $logDir . '/update_run.lock';
$lockFp = fopen($lockFile, 'c');
if (!$lockFp) {
    logLine("ERROR: Unable to open lock file $lockFile");
    exit(1);
}
if (!flock($lockFp, LOCK_EX | LOCK_NB)) {
    logLine("Another update run is in progress. Exiting.");
    exit(0);
}

logLine("Starting update runner");

// Ensure running from CLI
if (php_sapi_name() !== 'cli') {
    logLine("Warning: run_update is intended for CLI. Proceeding anyway.");
}

// Load config for DB credentials when possible
if (file_exists(__DIR__ . '/../config.php')) {
    require_once __DIR__ . '/../config.php';
    $get = function($n) { return defined($n) ? constant($n) : null; };
    $DB_HOST = $get('DB_HOST');
    $DB_USER = $get('DB_USER');
    $DB_PASS = $get('DB_PASS');
    $DB_NAME = $get('DB_NAME');
} else {
    $DB_HOST = $DB_USER = $DB_PASS = $DB_NAME = null;
}

// DB connection helper
$pdo = null;
if ($DB_HOST && $DB_USER && $DB_NAME) {
    try {
        $dsn = "mysql:host={$DB_HOST};dbname={$DB_NAME};charset=utf8mb4";
        $pdo = new PDO($dsn, $DB_USER, $DB_PASS, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
        logLine("DB connection OK to {$DB_NAME}@{$DB_HOST}");
    } catch (Exception $e) {
        logLine("DB connect error: " . $e->getMessage());
        $pdo = null;
    }
} else {
    logLine("DB credentials not found in config.php, skipping DB steps.");
}

// Create migrations_log table if DB available
if ($pdo) {
    try {
        $pdo->exec("CREATE TABLE IF NOT EXISTS migrations_log (id INT AUTO_INCREMENT PRIMARY KEY, file_name VARCHAR(255) NOT NULL UNIQUE, applied_at DATETIME NOT NULL)");
        logLine("Ensured migrations_log table exists");
    } catch (Exception $e) {
        logLine("Failed to ensure migrations_log: " . $e->getMessage());
    }
}

// Apply .sql files in migrations/ in alphabetical order if not applied
$migrationsDir = __DIR__ . '/../migrations';
if (is_dir($migrationsDir) && $pdo) {
    $files = glob($migrationsDir . '/*.sql');
    sort($files);
    foreach ($files as $f) {
        $base = basename($f);
        try {
            $stmt = $pdo->prepare('SELECT COUNT(*) FROM migrations_log WHERE file_name = ?');
            $stmt->execute([$base]);
            if ($stmt->fetchColumn() > 0) {
                logLine("Skipping already applied migration: $base");
                continue;
            }
        } catch (Exception $e) {
            logLine("DB query error while checking migration log: " . $e->getMessage());
        }

        logLine("Applying migration file: $base");
        $sql = file_get_contents($f);
        // Remove any explicit FOREIGN_KEY_CHECKS toggles to avoid failures
        $sql = preg_replace('/SET\s+FOREIGN_KEY_CHECKS\s*=\s*[01];/i', '', $sql);

        // Split statements; crude but works for typical dump files
        $parts = preg_split('/;\s*\n/', $sql);
        $appliedAny = false;
        foreach ($parts as $part) {
            $s = trim($part);
            if (!$s) continue;
            try {
                $pdo->exec($s . ';');
                $appliedAny = true;
            } catch (Exception $e) {
                logLine("  Statement failed: " . $e->getMessage());
            }
        }
        // Record migration as attempted (avoid re-running forever). If nothing applied, still record to avoid infinite loops, but mark in log.
        try {
            $pdo->prepare('INSERT INTO migrations_log (file_name, applied_at) VALUES (?, NOW())')->execute([$base]);
            logLine("Recorded migration $base in migrations_log");
        } catch (Exception $e) {
            logLine("Failed to record migration $base: " . $e->getMessage());
        }
    }
} else {
    logLine("Migrations directory missing or DB unavailable — skipping SQL file application.");
}

// Run conditional migrations script if present
$conditionalRunner = __DIR__ . '/../migrations/run_updates.php';
if (file_exists($conditionalRunner)) {
    logLine("Executing conditional runner: migrations/run_updates.php");
    $cmd = escapeshellcmd((PHP_BINARY ?: 'php')) . ' ' . escapeshellarg($conditionalRunner);
    $output = null; $exit = null;
    exec($cmd . ' 2>&1', $output, $exit);
    foreach ($output as $line) logLine("[runner] " . $line);
    logLine("Conditional runner exited with code: $exit");
} else {
    logLine("No conditional runner found at migrations/run_updates.php");
}

// Update version.json from manifest.json if present
$manifest = __DIR__ . '/../manifest.json';
$versionFile = __DIR__ . '/../version.json';
if (file_exists($manifest)) {
    $mdata = @file_get_contents($manifest);
    if ($mdata !== false) {
        @file_put_contents($versionFile, $mdata);
        logLine("Updated version.json from manifest.json");
    } else {
        logLine("Failed to read manifest.json");
    }
} else {
    logLine("No manifest.json found to update version.json");
}

// Optionally run Node build if package.json present and npm available
if (file_exists(__DIR__ . '/../package.json')) {
    // detect npm/node
    $nodeAvailable = false; $npmAvailable = false;
    @exec('node -v 2>&1', $outNode, $rcNode); if ($rcNode === 0) $nodeAvailable = true;
    @exec('npm -v 2>&1', $outNpm, $rcNpm); if ($rcNpm === 0) $npmAvailable = true;
    if ($nodeAvailable && $npmAvailable) {
        logLine("Node and npm detected. Running npm ci and npm run build (production)");
        // try npm ci --silent
        $cwd = __DIR__ . '/..';
        $cmds = [
            "npm ci --only=production",
            "npm run build --if-present"
        ];
        foreach ($cmds as $c) {
            logLine("Running: $c");
            $full = "cd " . escapeshellarg($cwd) . " && $c 2>&1";
            exec($full, $out, $rc);
            foreach ($out as $ln) logLine("[npm] " . $ln);
            logLine("Command exited with $rc");
        }
    } else {
        logLine("Node/npm not available — skipping frontend build.");
    }
}

// Optionally run Composer if composer.json present
if (file_exists(__DIR__ . '/../composer.json')) {
    @exec('composer --version 2>&1', $outC, $rcC);
    if ($rcC === 0) {
        logLine("Composer detected. Running composer install --no-dev --optimize-autoloader");
        $cmd = "composer install --no-dev --optimize-autoloader 2>&1";
        exec($cmd, $out, $rc);
        foreach ($out as $ln) logLine("[composer] " . $ln);
        logLine("Composer exited with $rc");
    } else {
        logLine("Composer not found — skipping PHP dependency install.");
    }
}

// Run post_update.php if present
$post = __DIR__ . '/../post_update.php';
if (file_exists($post)) {
    logLine("Running post_update.php");
    $cmd = escapeshellcmd((PHP_BINARY ?: 'php')) . ' ' . escapeshellarg($post);
    exec($cmd . ' 2>&1', $out, $rc);
    foreach ($out as $ln) logLine("[post_update] " . $ln);
    logLine("post_update exited with $rc");
} else {
    logLine("No post_update.php present");
}

// Clear simple cache folders if present (non-destructive)
$cachePaths = [__DIR__ . '/../cache', __DIR__ . '/../storage/cache', __DIR__ . '/../tmp'];
foreach ($cachePaths as $p) {
    if (is_dir($p)) {
        logLine("Clearing cache dir: $p");
        $files = glob($p . '/*');
        foreach ($files as $f) {
            // Avoid deleting node_modules
            if (strpos($f, 'node_modules') !== false) continue;
            if (is_dir($f)) {
                // attempt to remove recursively
                $it = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($f, RecursiveDirectoryIterator::SKIP_DOTS), RecursiveIteratorIterator::CHILD_FIRST);
                foreach ($it as $file) {
                    $file->isDir() ? @rmdir($file->getPathname()) : @unlink($file->getPathname());
                }
                @rmdir($f);
            } else {
                @unlink($f);
            }
        }
    }
}

logLine("Update runner finished.");

// release lock
flock($lockFp, LOCK_UN);
fclose($lockFp);

exit(0);

?>
