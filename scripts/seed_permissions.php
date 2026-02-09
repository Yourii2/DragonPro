<?php
// Simple seeder to create permissions tables and seed basic actions/modules
require_once __DIR__ . '/../config.php';

try {
    $pdo = new PDO("mysql:host=" . DB_HOST . ";dbname=" . DB_NAME . ";charset=utf8mb4", DB_USER, DB_PASS);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
} catch (PDOException $e) {
    echo "DB connection failed: " . $e->getMessage() . PHP_EOL; exit(1);
}

$sqlFile = __DIR__ . '/../migrations/permissions.sql';
if (file_exists($sqlFile)) {
    $sql = file_get_contents($sqlFile);
    try {
        $pdo->exec($sql);
        echo "Migration executed successfully.".PHP_EOL;
    } catch (Exception $ex) {
        echo "Migration failed: " . $ex->getMessage() . PHP_EOL;
    }
} else {
    echo "Migration file not found at $sqlFile".PHP_EOL;
}

// Seed basic actions
$actions = [ ['view','عرض (view)'], ['add','اضافة (add)'], ['edit','تعديل (edit)'], ['delete','حذف (delete)'] ];
foreach ($actions as $a) {
    try {
        $stmt = $pdo->prepare("SELECT id FROM permission_actions WHERE code = ? LIMIT 1");
        $stmt->execute([$a[0]]);
        if ($stmt->rowCount() === 0) {
            $ins = $pdo->prepare("INSERT INTO permission_actions (name, code) VALUES (?, ?)");
            $ins->execute([$a[1], $a[0]]);
            echo "Inserted action {$a[0]}".PHP_EOL;
        }
    } catch (Exception $e) { echo "Action seed error: " . $e->getMessage() . PHP_EOL; }
}

// Seed a few modules
// Note: module names must match what components/api.php uses in check_permission_or_die().
$modules = [
    'users','customers','suppliers','treasuries','warehouses','sales_offices','products','orders','transactions','sales','employees',
    'stock','product_movements','reports','finance','inventory','settings',
    'permissions',
    // Manufacturing / Factory stock
    'fabrics','accessories','production_stages','colors','sizes','factory_products','cutting_stage'
];

// Deduplicate permission_modules by name (older installs may have duplicates)
try {
    $pdo->exec("UPDATE user_permissions up
               JOIN permission_modules pm ON pm.id = up.module_id
               JOIN (SELECT name, MIN(id) AS keep_id FROM permission_modules GROUP BY name) k ON k.name = pm.name
               SET up.module_id = k.keep_id
               WHERE up.module_id <> k.keep_id");
    $pdo->exec("DELETE pm
               FROM permission_modules pm
               JOIN (SELECT name, MIN(id) AS keep_id FROM permission_modules GROUP BY name) k ON k.name = pm.name
               WHERE pm.id <> k.keep_id");
} catch (Exception $e) {
    echo "Dedup modules warning: " . $e->getMessage() . PHP_EOL;
}

// Enforce uniqueness so rerunning the seeder doesn't create duplicates
try {
    $pdo->exec("ALTER TABLE permission_modules ADD UNIQUE KEY ux_permission_modules_name (name)");
    echo "Added UNIQUE( name ) on permission_modules." . PHP_EOL;
} catch (Exception $e) {
    // Ignore if it already exists or cannot be added
}
foreach ($modules as $m) {
    try {
        $stmt = $pdo->prepare("SELECT id FROM permission_modules WHERE name = ? LIMIT 1");
        $stmt->execute([$m]);
        if ($stmt->rowCount() === 0) {
            $ins = $pdo->prepare("INSERT INTO permission_modules (name, parent_id, `order`) VALUES (?, NULL, 0)");
            $ins->execute([$m]);
            echo "Inserted module $m".PHP_EOL;
        }
    } catch (Exception $e) { echo "Module seed error: " . $e->getMessage() . PHP_EOL; }
}

// Grant all permissions to initial super-admin (user_id=1) for any newly-added modules/actions
try {
    $pdo->exec("INSERT IGNORE INTO user_permissions (user_id, module_id, action_id, allowed)
               SELECT 1 AS user_id, m.id AS module_id, a.id AS action_id, 1 AS allowed
               FROM permission_modules m
               CROSS JOIN permission_actions a");
    $pdo->exec("UPDATE user_permissions SET allowed = 1 WHERE user_id = 1");
    echo "Granted/updated all permissions for user_id=1".PHP_EOL;
} catch (Exception $e) {
    echo "Grant permissions error: " . $e->getMessage() . PHP_EOL;
}

echo "Seeding complete. You may now assign permissions via the admin UI or run further seeding.".PHP_EOL;

?>
