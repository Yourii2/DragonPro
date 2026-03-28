<?php
require_once __DIR__ . '/../config.php';
try {
    $pdo = new PDO('mysql:host='.DB_HOST.';dbname='.DB_NAME.';charset=utf8mb4', DB_USER, DB_PASS, [PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);
    $slugs = ['sales-daily','sales-update-status','close-daily','sales-report'];
    foreach ($slugs as $s) {
        $stmt = $pdo->prepare('SELECT user_id,page_slug,can_access FROM user_page_permissions WHERE page_slug = ?');
        $stmt->execute([$s]);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
        echo "--- $s ---\n";
        foreach ($rows as $r) {
            echo "user_id={$r['user_id']} can_access={$r['can_access']}\n";
        }
        if (count($rows) === 0) echo "(none)\n";
    }
} catch (Exception $e) {
    echo 'Error: ' . $e->getMessage() . "\n";
}
