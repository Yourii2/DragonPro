<?php
/**
 * One-time migration: drop the rep_date_unique index from rep_daily_journal
 * if it exists, so that multiple rows per (rep_id, journal_date) are allowed.
 */
require __DIR__ . '/../config.php';
try {
    $pdo = new PDO(
        'mysql:host='.DB_HOST.';dbname='.DB_NAME.';charset=utf8mb4',
        DB_USER, DB_PASS,
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
    );

    // Check if table exists
    $exists = $pdo->query("SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='rep_daily_journal'")->fetchColumn();
    if (!$exists) {
        echo "Table rep_daily_journal does not exist – nothing to do.\n";
        exit(0);
    }

    // Check existing indexes
    $indexes = $pdo->query("SHOW INDEX FROM rep_daily_journal")->fetchAll(PDO::FETCH_ASSOC);
    $uniqueExists = false;
    echo "Current indexes on rep_daily_journal:\n";
    foreach ($indexes as $idx) {
        echo "  Key_name={$idx['Key_name']}  Column_name={$idx['Column_name']}  Non_unique={$idx['Non_unique']}\n";
        if ($idx['Key_name'] === 'rep_date_unique') $uniqueExists = true;
    }

    if ($uniqueExists) {
        $pdo->exec("ALTER TABLE rep_daily_journal DROP INDEX rep_date_unique");
        echo "\nDROPPED index rep_date_unique successfully.\n";
    } else {
        echo "\nIndex rep_date_unique does NOT exist – already clean.\n";
    }

    echo "\nDone.\n";
} catch (Exception $e) {
    echo 'ERROR: ' . $e->getMessage() . PHP_EOL;
    exit(1);
}
