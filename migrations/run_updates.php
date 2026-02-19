<?php
// Run conditional schema updates for MySQL 5.7-compatible servers.
// Usage: php migrations/run_updates.php
// It will attempt to load DB credentials from ../config.php (expects DB_HOST, DB_USER, DB_PASS, DB_NAME constants).

chdir(__DIR__);
require_once __DIR__ . '/../config.php';

$get = function($name){
    if (defined($name)) return constant($name);
    return null;
};

$host = $get('DB_HOST');
$user = $get('DB_USER');
$pass = $get('DB_PASS');
$db   = $get('DB_NAME');

if (!$host || !$user || !$db) {
    echo "Could not read DB credentials from ../config.php. Please ensure DB_HOST/DB_USER/DB_PASS/DB_NAME are defined.\n";
    exit(1);
}

try {
    $pdo = new PDO("mysql:host=$host;dbname=$db;charset=utf8mb4", $user, $pass, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_EMULATE_PREPARES => false,
    ]);
} catch (Exception $e) {
    echo "DB connect error: " . $e->getMessage() . "\n";
    exit(1);
}

// First: if migration file with CREATE TABLEs exists, execute its statements sequentially.
$createFile = __DIR__ . '\\20260213_add_missing_tables_from_schema.sql';
if (file_exists($createFile)) {
    echo "Executing create-tables migration: $createFile\n";
    $sql = file_get_contents($createFile);
    // remove FOREIGN_KEY_CHECKS statements to avoid duplicates
    $sql = preg_replace('/SET FOREIGN_KEY_CHECKS\s*=\s*[01];/i', "", $sql);
    // split by semicolon followed by newline to avoid splitting inside definitions crudely
    $parts = preg_split('/;\s*\n/', $sql);
    foreach ($parts as $part) {
        $stmt = trim($part);
        if (!$stmt) continue;
        try {
            $pdo->exec($stmt . ';');
            echo "  OK: executed statement\n";
        } catch (Exception $e) {
            echo "  WARN: statement failed: " . $e->getMessage() . "\n";
        }
    }
    echo "Finished create-tables migration.\n";
}

function columnExists($pdo, $table, $col) {
    $stmt = $pdo->prepare("SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?");
    $stmt->execute([$table, $col]);
    return $stmt->fetchColumn() > 0;
}

function indexExists($pdo, $table, $index) {
    $stmt = $pdo->prepare("SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?");
    $stmt->execute([$table, $index]);
    return $stmt->fetchColumn() > 0;
}

function fkExists($pdo, $table, $fk) {
    $stmt = $pdo->prepare("SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = ? AND CONSTRAINT_NAME = ? AND CONSTRAINT_TYPE = 'FOREIGN KEY'");
    $stmt->execute([$table, $fk]);
    return $stmt->fetchColumn() > 0;
}

function hasPrimaryKey($pdo, $table) {
    $stmt = $pdo->prepare("SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = ? AND CONSTRAINT_TYPE = 'PRIMARY KEY'");
    $stmt->execute([$table]);
    return $stmt->fetchColumn() > 0;
}

$errors = [];

echo "Starting conditional schema updates...\n";

// ===== users =====
echo "Processing table `users`...\n";
try {
    if (!columnExists($pdo, 'users', 'id')) {
        echo "- Adding column id...\n";
        $pdo->exec("ALTER TABLE `users` ADD COLUMN `id` int(11) NOT NULL AUTO_INCREMENT FIRST");
    }
    $cols = ['name' => "varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL",
             'username' => "varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL",
             'password' => "varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL",
             'role' => "enum('admin','manager','representative','accountant') COLLATE utf8mb4_unicode_ci DEFAULT 'representative'",
             'restricted_treasury_id' => "int(11) DEFAULT NULL",
             'restricted_warehouse_id' => "int(11) DEFAULT NULL",
             'avatar' => "varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL",
             'created_at' => "timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP",
             'phone' => "varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL"];
    foreach ($cols as $c => $def) {
        if (!columnExists($pdo, 'users', $c)) {
            echo "- Adding column $c...\n";
            $pdo->exec("ALTER TABLE `users` ADD COLUMN `$c` $def");
        }
    }

    echo "- Modifying balance/insurance columns...\n";
    $pdo->exec("ALTER TABLE `users` MODIFY COLUMN `balance` decimal(15,2) NOT NULL DEFAULT '0.00'");
    $pdo->exec("ALTER TABLE `users` MODIFY COLUMN `insurance_paid` tinyint(1) NOT NULL DEFAULT '0' COMMENT 'هل دفع تأمين'");
    $pdo->exec("ALTER TABLE `users` MODIFY COLUMN `insurance_amount` decimal(10,2) NOT NULL DEFAULT '0.00' COMMENT 'مبلغ التأمين المدفوع'");

    if (indexExists($pdo, 'users', 'username')) {
        echo "- username index exists\n";
    } else {
        echo "- Adding index username...\n";
        $pdo->exec("ALTER TABLE `users` ADD INDEX `username` (`username`)");
    }

    if (!hasPrimaryKey($pdo, 'users')) {
        echo "- Attempting to add PRIMARY KEY(id)...\n";
        try {
            $pdo->exec("ALTER TABLE `users` ADD PRIMARY KEY (`id`)");
        } catch (Exception $e) {
            $errors[] = "Failed to add PRIMARY KEY to users: " . $e->getMessage();
            echo "  ! failed: " . $e->getMessage() . "\n";
        }
    } else {
        echo "- users already has a primary key\n";
    }

} catch (Exception $e) {
    $errors[] = "users update error: " . $e->getMessage();
    echo "users update error: " . $e->getMessage() . "\n";
}

// ===== orders =====
echo "Processing table `orders`...\n";
try {
    $orderCols = [
        'discount_type' => "varchar(20) DEFAULT NULL",
        'discount_value' => "decimal(10,2) DEFAULT 0",
        'discount_amount' => "decimal(10,2) DEFAULT 0",
        'tax_type' => "varchar(20) DEFAULT NULL",
        'tax_value' => "decimal(10,2) DEFAULT 0",
        'tax_amount' => "decimal(10,2) DEFAULT 0",
    ];
    foreach ($orderCols as $c => $def) {
        if (!columnExists($pdo, 'orders', $c)) {
            echo "- Adding column $c to orders...\n";
            $pdo->exec("ALTER TABLE `orders` ADD COLUMN `$c` $def");
        }
    }

    echo "- Modifying sales_office_id type...\n";
    $pdo->exec("ALTER TABLE `orders` MODIFY COLUMN `sales_office_id` int(11) DEFAULT NULL");

    // indexes
    $orderIndexes = ['order_number','customer_id','rep_id','idx_orders_sales_office_id'];
    foreach ($orderIndexes as $ix) {
        if (!indexExists($pdo, 'orders', $ix)) {
            echo "- Adding index $ix on orders...\n";
            if ($ix === 'idx_orders_sales_office_id') {
                $pdo->exec("ALTER TABLE `orders` ADD INDEX `idx_orders_sales_office_id` (`sales_office_id`)");
            } else {
                $pdo->exec("ALTER TABLE `orders` ADD INDEX `$ix` (`$ix`)");
            }
        }
    }

    // foreign keys: add if missing
    if (!fkExists($pdo, 'orders', 'fk_orders_customer')) {
        echo "- Adding FK fk_orders_customer...\n";
        $pdo->exec("ALTER TABLE `orders` ADD CONSTRAINT `fk_orders_customer` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON UPDATE CASCADE ON DELETE RESTRICT");
    }
    if (!fkExists($pdo, 'orders', 'fk_orders_rep')) {
        echo "- Adding FK fk_orders_rep...\n";
        $pdo->exec("ALTER TABLE `orders` ADD CONSTRAINT `fk_orders_rep` FOREIGN KEY (`rep_id`) REFERENCES `users` (`id`) ON UPDATE CASCADE ON DELETE SET NULL");
    }

} catch (Exception $e) {
    $errors[] = "orders update error: " . $e->getMessage();
    echo "orders update error: " . $e->getMessage() . "\n";
}

echo "\nFinished.\n";
if ($errors) {
    echo "There were errors:\n";
    foreach ($errors as $err) echo " - $err\n";
    echo "\nReview errors and fix manually where needed.\n";
} else {
    echo "No errors reported. Schema updates applied.\n";
}

?>
