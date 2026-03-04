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

// Second: new tables added in v1.1.x (rep_daily_journal, product_variants, stock, etc.)
function run_sql_migration_file(PDO $pdo, string $path, string $label): void {
    if (!file_exists($path)) {
        echo "SKIP (file not found): $label\n";
        return;
    }
    echo "Executing migration: $label\n";
    $sql = file_get_contents($path);
    $sql = preg_replace('/SET FOREIGN_KEY_CHECKS\s*=\s*[01];/i', "", $sql);
    $sql = preg_replace('/--[^\n]*\n/u', "\n", $sql); // strip single-line comments
    $parts = preg_split('/;\s*\n/', $sql);
    $ok = 0; $warn = 0;
    foreach ($parts as $part) {
        $stmt = trim($part);
        if (!$stmt || $stmt === ';') continue;
        try {
            $pdo->exec($stmt . ';');
            $ok++;
        } catch (Exception $e) {
            $warn++;
            echo "  WARN: " . $e->getMessage() . "\n";
        }
    }
    echo "  Done: $ok OK, $warn warnings.\n";
}

run_sql_migration_file($pdo, __DIR__ . '/20260302_new_tables.sql', '20260302_new_tables (v1.1.x)');

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

// ===== هجرة بنية المنتجات إلى product_variants =====
echo "\n=== فحص هجرة المنتجات إلى product_variants ===\n";
try {
    $variantsExist = (bool)$pdo->query("SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='product_variants'")->fetchColumn();
    $productsExist = (bool)$pdo->query("SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='products'")->fetchColumn();

    if ($variantsExist && $productsExist) {
        // التحقق من أن products الجديد ليس به عمود color (البنية القديمة)
        $hasColorInProducts = columnExists($pdo, 'products', 'color');
        if (!$hasColorInProducts) {
            echo "✅ هجرة المنتجات مكتملة مسبقاً، تخطي.\n";
        } else {
            // قد تكون product_variants أُنشئت فارغة من ملف SQL قبل تنفيذ هجرة البيانات
            $variantRows  = (int)$pdo->query("SELECT COUNT(*) FROM product_variants")->fetchColumn();
            $productsRows = (int)$pdo->query("SELECT COUNT(*) FROM products")->fetchColumn();
            if ($variantRows === 0 && $productsRows > 0) {
                echo "⚠️ product_variants فارغة (أُنشئت من ملف SQL) بينما products به $productsRows صف بالبنية القديمة.\n";
                echo "⏳ حذف product_variants الفارغة وإعادة تشغيل هجرة البيانات...\n";
                $pdo->exec("SET FOREIGN_KEY_CHECKS = 0");
                $pdo->exec("DROP TABLE IF EXISTS stock");
                $pdo->exec("DROP TABLE IF EXISTS product_variants");
                $pdo->exec("SET FOREIGN_KEY_CHECKS = 1");
                $variantsExist = false; // الانتقال لكتلة الهجرة أدناه
            } else {
                echo "⚠️ products به عمود color + product_variants موجود ($variantRows صف). حالة غير متوقعة، يرجى المراجعة.\n";
            }
        }
    }

    if ($variantsExist && !$productsExist) {
        echo "⚠️ جدول products غير موجود، تخطي هجرة المنتجات.\n";
    } elseif (!$variantsExist && !$productsExist) {
        echo "⚠️ كلا الجدولين غير موجودَين، تخطي هجرة المنتجات.\n";
    } elseif (!$variantsExist && $productsExist) {
        // الهجرة مطلوبة
        $oldCount = (int)$pdo->query("SELECT COUNT(*) FROM products")->fetchColumn();
        echo "⏳ بدء هجرة المنتجات ($oldCount صف)...\n";

        // 1. إعادة تسمية products → product_variants
        $pdo->exec("RENAME TABLE products TO product_variants");
        echo "  ✅ تمت إعادة التسمية products → product_variants\n";

        // 2. إضافة عمود product_id
        if (!columnExists($pdo, 'product_variants', 'product_id')) {
            $pdo->exec("ALTER TABLE product_variants ADD COLUMN product_id INT(11) NOT NULL DEFAULT 0 AFTER id");
            $pdo->exec("ALTER TABLE product_variants ADD KEY idx_pv_product_id (product_id)");
        }

        // 3. إنشاء جدول products الجديد (الآباء)
        $pdo->exec("CREATE TABLE IF NOT EXISTS products (
            id INT(11) NOT NULL AUTO_INCREMENT,
            name VARCHAR(255) NOT NULL,
            category VARCHAR(100) NULL DEFAULT NULL,
            description TEXT NULL DEFAULT NULL,
            is_archived TINYINT(1) NOT NULL DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            KEY idx_products_name (name(191))
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
        echo "  ✅ تم إنشاء جدول products الجديد\n";

        // 4. ملء products من الأسماء الفريدة
        $hasCategory    = columnExists($pdo, 'product_variants', 'category');
        $hasDescription = columnExists($pdo, 'product_variants', 'description');
        $hasIsArchived  = columnExists($pdo, 'product_variants', 'is_archived');
        $categoryCol    = $hasCategory    ? "MAX(category)"    : "NULL";
        $descCol        = $hasDescription ? "MAX(description)" : "NULL";
        $archivedCol    = $hasIsArchived  ? "MIN(is_archived)" : "0";
        $pdo->exec("INSERT INTO products (name, category, description, is_archived)
            SELECT name, $categoryCol, $descCol, $archivedCol
            FROM product_variants GROUP BY name ORDER BY MIN(id)");
        $parentCount = (int)$pdo->query("SELECT COUNT(*) FROM products")->fetchColumn();
        echo "  ✅ تم إنشاء $parentCount منتج أب\n";

        // 5. ربط المتغيرات بالآباء
        $pdo->exec("UPDATE product_variants pv JOIN products p ON p.name = pv.name SET pv.product_id = p.id");

        // إصلاح الأيتام إن وجدوا
        $orphans = (int)$pdo->query("SELECT COUNT(*) FROM product_variants WHERE product_id = 0")->fetchColumn();
        if ($orphans > 0) {
            $stmt = $pdo->query("SELECT DISTINCT name FROM product_variants WHERE product_id = 0");
            foreach ($stmt->fetchAll(PDO::FETCH_COLUMN) as $orphanName) {
                $pdo->prepare("INSERT IGNORE INTO products (name) VALUES (?)")->execute([$orphanName]);
                $newPid = $pdo->query("SELECT id FROM products WHERE name = " . $pdo->quote($orphanName) . " LIMIT 1")->fetchColumn();
                $pdo->prepare("UPDATE product_variants SET product_id = ? WHERE name = ? AND product_id = 0")->execute([$newPid, $orphanName]);
            }
        }

        $variantCount = (int)$pdo->query("SELECT COUNT(*) FROM product_variants")->fetchColumn();
        echo "✅ اكتملت هجرة المنتجات: $parentCount أب ← $variantCount متغير\n";
    }

    // التأكد من وجود عمود is_archived في products و product_variants
    if ((bool)$pdo->query("SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='products'")->fetchColumn()) {
        if (!columnExists($pdo, 'products', 'is_archived')) {
            $pdo->exec("ALTER TABLE products ADD COLUMN is_archived TINYINT(1) NOT NULL DEFAULT 0");
            echo "  ✅ تمت إضافة is_archived إلى products\n";
        }
    }
    if ((bool)$pdo->query("SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='product_variants'")->fetchColumn()) {
        if (!columnExists($pdo, 'product_variants', 'is_archived')) {
            $pdo->exec("ALTER TABLE product_variants ADD COLUMN is_archived TINYINT(1) NOT NULL DEFAULT 0");
            echo "  ✅ تمت إضافة is_archived إلى product_variants\n";
        }
        if (!columnExists($pdo, 'product_variants', 'product_id')) {
            $pdo->exec("ALTER TABLE product_variants ADD COLUMN product_id INT(11) NOT NULL DEFAULT 0 AFTER id");
            $pdo->exec("ALTER TABLE product_variants ADD KEY idx_pv_product_id (product_id)");
            echo "  ✅ تمت إضافة product_id إلى product_variants\n";
        }
    }
} catch (Exception $e) {
    $errors[] = "product_variants migration error: " . $e->getMessage();
    echo "❌ خطأ في هجرة المنتجات: " . $e->getMessage() . "\n";
}
echo "=== انتهى فحص هجرة المنتجات ===\n\n";

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
