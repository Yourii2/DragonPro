<?php
/**
 * repair_products_migration.php
 * ==============================
 * إصلاح حالة تعارض هجرة المنتجات:
 *   عندما تكون product_variants فارغة (أُنشئت من ملف SQL)
 *   بينما products لا تزال تحتوي على البنية القديمة (color, size, barcode في نفس الجدول).
 *
 * تشغيل: http://localhost/Nexus/tools/repair_products_migration.php
 *    أو: php tools/repair_products_migration.php
 */

set_time_limit(180);
error_reporting(E_ALL);
ini_set('display_errors', '1');

// دعم CLI و HTTP
$isCli = php_sapi_name() === 'cli';
if (!$isCli) header('Content-Type: text/plain; charset=utf-8');

function out(string $msg): void {
    echo $msg . "\n";
    if (php_sapi_name() !== 'cli') flush();
}

require __DIR__ . '/../config.php';

try {
    $pdo = new PDO(
        'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=utf8mb4',
        DB_USER, DB_PASS,
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_EMULATE_PREPARES => false]
    );
} catch (Exception $e) {
    out("❌ فشل الاتصال بقاعدة البيانات: " . $e->getMessage());
    exit(1);
}

function tbl_exists(PDO $pdo, string $name): bool {
    return (bool)$pdo->query("SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=" . $pdo->quote($name))->fetchColumn();
}

function col_exists(PDO $pdo, string $table, string $col): bool {
    return (bool)$pdo->query("SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=" . $pdo->quote($table) . " AND COLUMN_NAME=" . $pdo->quote($col))->fetchColumn();
}

out("=== أداة إصلاح هجرة المنتجات ===\n");

$variantsExist  = tbl_exists($pdo, 'product_variants');
$productsExist  = tbl_exists($pdo, 'products');
$stockExist     = tbl_exists($pdo, 'stock');

out("الحالة الحالية:");
out("  products موجود        : " . ($productsExist ? 'نعم' : 'لا'));
out("  product_variants موجود: " . ($variantsExist ? 'نعم' : 'لا'));
out("  stock موجود           : " . ($stockExist ? 'نعم' : 'لا'));

if ($variantsExist && $productsExist) {
    $hasColorInProducts = col_exists($pdo, 'products', 'color');
    if (!$hasColorInProducts) {
        out("\n✅ الهجرة مكتملة مسبقاً! لا داعي للإصلاح.");
        $variantCount = (int)$pdo->query("SELECT COUNT(*) FROM product_variants")->fetchColumn();
        $parentCount  = (int)$pdo->query("SELECT COUNT(*) FROM products")->fetchColumn();
        out("   منتجات الآباء  : $parentCount");
        out("   المتغيرات      : $variantCount");
        exit(0);
    }

    $variantRows  = (int)$pdo->query("SELECT COUNT(*) FROM product_variants")->fetchColumn();
    $productsRows = (int)$pdo->query("SELECT COUNT(*) FROM products")->fetchColumn();
    out("\n  صفوف في products        : $productsRows");
    out("  صفوف في product_variants: $variantRows");

    if ($variantRows > 0) {
        out("\n❌ product_variants بها بيانات ($variantRows صف) لكن products لا تزال بالبنية القديمة.");
        out("   لا يمكن الإصلاح تلقائياً – يرجى المراجعة اليدوية.");
        exit(1);
    }

    if ($productsRows === 0) {
        out("\n⚠️ products فارغة أيضاً. لا توجد بيانات للهجرة.");
        exit(0);
    }

    // الحالة المطلوبة للإصلاح: product_variants فارغة + products بها بيانات قديمة
    out("\n⚠️ تم اكتشاف الحالة المعطوبة: product_variants فارغة لكن products بها $productsRows صف (بنية قديمة).");
    out("⏳ بدء الإصلاح...\n");

} elseif (!$variantsExist && $productsExist) {
    $productsRows = (int)$pdo->query("SELECT COUNT(*) FROM products")->fetchColumn();
    if ($productsRows === 0) {
        out("\n⚠️ products فارغة. لا توجد بيانات للهجرة.");
        exit(0);
    }
    out("\nproduct_variants غير موجود – تشغيل الهجرة الأولية...\n");
} else {
    out("\n❌ وضع غير متوقع. تأكد من اتصال قاعدة البيانات.");
    exit(1);
}

// ===== تنفيذ الإصلاح / الهجرة =====

try {
    $pdo->exec("SET FOREIGN_KEY_CHECKS = 0");

    // حذف الجداول الفارغة المرتبطة إن وجدت
    if ($stockExist) {
        $stockRows = (int)$pdo->query("SELECT COUNT(*) FROM stock")->fetchColumn();
        if ($stockRows === 0) {
            $pdo->exec("DROP TABLE IF EXISTS stock");
            out("🗑 تم حذف جدول stock الفارغ");
        }
    }
    if ($variantsExist) {
        $pdo->exec("DROP TABLE IF EXISTS product_variants");
        out("🗑 تم حذف جدول product_variants الفارغ");
    }

    // 1. إعادة تسمية products → product_variants
    $oldCount = (int)$pdo->query("SELECT COUNT(*) FROM products")->fetchColumn();
    $pdo->exec("RENAME TABLE products TO product_variants");
    out("✅ خطوة 1: إعادة التسمية products ($oldCount صف) → product_variants");

    // 2. إضافة عمود product_id
    if (!col_exists($pdo, 'product_variants', 'product_id')) {
        $pdo->exec("ALTER TABLE product_variants ADD COLUMN product_id INT(11) NOT NULL DEFAULT 0 AFTER id");
        $pdo->exec("ALTER TABLE product_variants ADD KEY idx_pv_product_id (product_id)");
        out("✅ خطوة 2: تمت إضافة عمود product_id");
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
    out("✅ خطوة 3: تم إنشاء جدول products الجديد (الآباء)");

    // 4. ملء products من الأسماء الفريدة في product_variants
    $hasCategory    = col_exists($pdo, 'product_variants', 'category');
    $hasDescription = col_exists($pdo, 'product_variants', 'description');
    $hasIsArchived  = col_exists($pdo, 'product_variants', 'is_archived');
    $categoryCol    = $hasCategory    ? "MAX(category)"    : "NULL";
    $descCol        = $hasDescription ? "MAX(description)" : "NULL";
    $archivedCol    = $hasIsArchived  ? "MIN(is_archived)" : "0";
    $pdo->exec("INSERT INTO products (name, category, description, is_archived)
        SELECT name, $categoryCol, $descCol, $archivedCol
        FROM product_variants GROUP BY name ORDER BY MIN(id)");
    $parentCount = (int)$pdo->query("SELECT COUNT(*) FROM products")->fetchColumn();
    out("✅ خطوة 4: تم إنشاء $parentCount منتج أب");

    // 5. ربط المتغيرات بالآباء عبر الاسم
    $pdo->exec("UPDATE product_variants pv JOIN products p ON p.name = pv.name SET pv.product_id = p.id");

    // إصلاح الأيتام إن وجدوا
    $orphans = (int)$pdo->query("SELECT COUNT(*) FROM product_variants WHERE product_id = 0")->fetchColumn();
    if ($orphans > 0) {
        out("⚠️ وجد $orphans متغير يتيم، جاري الإصلاح...");
        $stmt = $pdo->query("SELECT DISTINCT name FROM product_variants WHERE product_id = 0");
        foreach ($stmt->fetchAll(PDO::FETCH_COLUMN) as $orphanName) {
            $pdo->prepare("INSERT IGNORE INTO products (name) VALUES (?)")->execute([$orphanName]);
            $newPid = $pdo->query("SELECT id FROM products WHERE name = " . $pdo->quote($orphanName) . " LIMIT 1")->fetchColumn();
            $pdo->prepare("UPDATE product_variants SET product_id = ? WHERE name = ? AND product_id = 0")->execute([$newPid, $orphanName]);
        }
        out("✅ تم إصلاح الأيتام");
    }

    $variantCount = (int)$pdo->query("SELECT COUNT(*) FROM product_variants")->fetchColumn();
    out("✅ خطوة 5: تم ربط $variantCount متغير بالآباء");

    // 6. إعادة إنشاء جدول stock الجديد
    $pdo->exec("CREATE TABLE IF NOT EXISTS stock (
        product_id INT(11) NOT NULL,
        warehouse_id INT(11) NOT NULL,
        quantity INT(11) DEFAULT 0,
        PRIMARY KEY (product_id, warehouse_id),
        KEY warehouse_id (warehouse_id),
        CONSTRAINT stock_ibfk_1 FOREIGN KEY (product_id) REFERENCES product_variants (id),
        CONSTRAINT stock_ibfk_2 FOREIGN KEY (warehouse_id) REFERENCES warehouses (id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    out("✅ خطوة 6: تم إنشاء جدول stock");

    // هجرة الكميات من product_variants إلى stock (إذا كانت هناك أعمدة quantity/warehouse_id في product_variants)
    $hasPvQty     = col_exists($pdo, 'product_variants', 'quantity');
    $hasPvWarehouse = col_exists($pdo, 'product_variants', 'warehouse_id');
    if ($hasPvQty) {
        out("⏳ نقل الكميات من product_variants إلى stock...");
        // احصل على المستودع الافتراضي للكميات
        $defaultWarehouse = null;
        if ($hasPvWarehouse) {
            $defaultWarehouse = $pdo->query("SELECT MIN(id) FROM warehouses")->fetchColumn();
        } else {
            $defaultWarehouse = $pdo->query("SELECT MIN(id) FROM warehouses")->fetchColumn();
        }
        if ($defaultWarehouse) {
            $warehouseCol = $hasPvWarehouse ? "COALESCE(warehouse_id, $defaultWarehouse)" : $defaultWarehouse;
            $inserted = $pdo->exec("INSERT IGNORE INTO stock (product_id, warehouse_id, quantity)
                SELECT id, $warehouseCol, COALESCE(quantity, 0)
                FROM product_variants
                WHERE COALESCE(quantity, 0) > 0");
            out("✅ تم نقل كميات $inserted متغير إلى stock");
        }
    }

    $pdo->exec("SET FOREIGN_KEY_CHECKS = 1");

    out("\n" . str_repeat("=", 50));
    out("✅ اكتمل الإصلاح بنجاح!");
    out("   منتجات الآباء  : $parentCount");
    out("   المتغيرات      : $variantCount");
    out("\nيمكنك الآن تحديث الصفحة وسيظهر المنتجات بشكل صحيح.");

} catch (Exception $e) {
    $pdo->exec("SET FOREIGN_KEY_CHECKS = 1");
    out("\n❌ خطأ أثناء الإصلاح: " . $e->getMessage());
    exit(1);
}
