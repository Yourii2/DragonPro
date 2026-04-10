<?php
// CLI helper: prints rep_daily_journal rows as JSON
// Usage: php scripts/get_rep_daily_journal.php [rep_id|null] [from YYYY-MM-DD|null] [to YYYY-MM-DD|null]
require_once __DIR__ . '/../config.php';

try {
    $pdo = new PDO('mysql:host='.DB_HOST.';dbname='.DB_NAME.';charset=utf8mb4', DB_USER, defined('DB_PASS') ? DB_PASS : '', [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC]);
} catch (Exception $e) {
    fwrite(STDERR, "DB connection failed: " . $e->getMessage() . "\n");
    exit(1);
}

$argv0 = $argv[0] ?? 'get_rep_daily_journal.php';
$repArg = $argv[1] ?? null;
$fromArg = $argv[2] ?? null;
$toArg = $argv[3] ?? null;

try {
    $stmt = $pdo->query("SELECT DATABASE() as db");
    $db = $stmt->fetchColumn();
    $exists = false;
    $chk = $pdo->prepare('SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?');
    $chk->execute([$db, 'rep_daily_journal']);
    $exists = intval($chk->fetchColumn()) > 0;
    if (!$exists) {
        echo json_encode(['success' => false, 'message' => 'rep_daily_journal table does not exist']);
        exit(0);
    }

    $where = [];
    $params = [];
    if ($repArg !== null && $repArg !== 'null' && is_numeric($repArg)) {
        $where[] = 'rep_id = ?';
        $params[] = intval($repArg);
    }
    if ($fromArg && preg_match('/^\d{4}-\d{2}-\d{2}$/', $fromArg)) {
        $where[] = 'journal_date >= ?';
        $params[] = $fromArg;
    }
    if ($toArg && preg_match('/^\d{4}-\d{2}-\d{2}$/', $toArg)) {
        $where[] = 'journal_date <= ?';
        $params[] = $toArg;
    }

    $sql = 'SELECT * FROM rep_daily_journal';
    if (count($where) > 0) $sql .= ' WHERE ' . implode(' AND ', $where);
    $sql .= ' ORDER BY journal_date ASC, rep_id ASC';

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
    echo json_encode(['success' => true, 'data' => $rows], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    exit(0);
} catch (Exception $e) {
    fwrite(STDERR, "Error: " . $e->getMessage() . "\n");
    echo json_encode(['success' => false, 'message' => $e->getMessage()]);
    exit(1);
}
