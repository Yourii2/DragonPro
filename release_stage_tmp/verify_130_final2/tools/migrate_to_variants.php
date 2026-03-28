<?php
/**
 * migrate_to_variants.php
 * ========================
 * هجرة بنية المنتجات من الشكل القديم (products: اسم+لون+مقاس) إلى البنية الجديدة:
 *   - products        → جدول الآباء (id, name, category, description, is_archived)
 *   - product_variants → جدول المتغيرات (id, product_id FK, color, size, barcode, cost_price, sale_price, reorder_level, is_archived)
 *
 * المنطق:
 *   1. RENAME TABLE products → product_variants  (يحافظ على نفس الـ IDs)
 *   2. إضافة عمود product_id لـ product_variants
 *   3. إنشاء جدول products الجديد (الآباء)
 *   4. ملء products من الأسماء الفريدة في product_variants
 *   5. تحديث product_variants.product_id
 *   6. stock و order_items و product_movements تبقى كما هي (product_id فيها = variant_id تلقائياً)
 *
 * تشغيل مرة واحدة فقط! يتحقق من عدم التنفيذ السابق أولاً.
 */

set_time_limit(120);
error_reporting(E_ALL);
ini_set('display_errors', '1');

require __DIR__ . '/../config.php';

try {
    $pdo = new PDO(
        'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=utf8mb4',
        DB_USER, DB_PASS,
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_EMULATE_PREPARES => false]
    );
} catch (Exception $e) {
    die("DB connection failed: " . $e->getMessage() . "\n");
}

function tbl_exists(PDO $pdo, string $name): bool {
    return (bool)$pdo->query(
        "SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=" . $pdo->quote($name)
    )->fetchColumn();
}

function col_exists(PDO $pdo, string $table, string $col): bool {
    return (bool)$pdo->query(
        "SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=" . $pdo->quote($table) . " AND COLUMN_NAME=" . $pdo->quote($col)
    )->fetchColumn();
}

echo "=== بدء هجرة بنية المنتجات ===\n\n";

// 0. التحقق من عدم التنفيذ السابق
$variantsExist = tbl_exists($pdo, 'product_variants');
$productsExist = tbl_exists($pdo, 'products');

if ($variantsExist && $productsExist && !col_exists($pdo, 'products', 'color')) {
    echo "✅ الهجرة مكتملة مسبقاً. لا داعي للتشغيل مجدداً.\n";
    exit(0);
}

if (!$productsExist) {
    die("❌ جدول products غير موجود. يرجى التأكد من اتصال قاعدة البيانات.\n");
}

if ($variantsExist) {
    die("❌ جدول product_variants موجود بالفعل لكن products ما زال بالشكل القديم. يرجى المراجعة اليدوية.\n");
}

// 1. قراءة إحصائيات قبل الهجرة
$oldCount = (int)$pdo->query("SELECT COUNT(*) FROM products")->fetchColumn();
$stockCount = tbl_exists($pdo, 'stock') ? (int)$pdo->query("SELECT COUNT(*) FROM stock")->fetchColumn() : 0;
$orderItemsCount = tbl_exists($pdo, 'order_items') ? (int)$pdo->query("SELECT COUNT(*) FROM order_items")->fetchColumn() : 0;

echo "📊 إحصائيات قبل الهجرة:\n";
echo "  products: $oldCount صف\n";
echo "  stock: $stockCount صف\n";
echo "  order_items: $orderItemsCount صف\n\n";

// 2. RENAME products → product_variants
echo "⏳ خطوة 1: إعادة تسمية product.. → product_variants...\n";
$pdo->exec("RENAME TABLE products TO product_variants");
echo "  ✅ تمت إعادة التسمية\n";

// 3. إضافة عمود product_id لـ product_variants (DEFAULT 0 مؤقتاً)
echo "⏳ خطوة 2: إضافة عمود product_id لـ product_variants...\n";
if (!col_exists($pdo, 'product_variants', 'product_id')) {
    $pdo->exec("ALTER TABLE product_variants ADD COLUMN product_id INT(11) NOT NULL DEFAULT 0 AFTER id");
    $pdo->exec("ALTER TABLE product_variants ADD KEY idx_pv_product_id (product_id)");
    echo "  ✅ تمت إضافة product_id\n";
} else {
    echo "  ⚠️ عمود product_id موجود بالفعل، تخطي\n";
}

// 4. إنشاء جدول products الجديد (الآباء)
echo "⏳ خطوة 3: إنشاء جدول products الجديد (الآباء)...\n";
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

// 5. ملء products من الأسماء الفريدة في product_variants
echo "⏳ خطوة 4: ملء جدول الآباء من الأسماء الفريدة...\n";
$hasCategory = col_exists($pdo, 'product_variants', 'category');
$hasDescription = col_exists($pdo, 'product_variants', 'description');
$hasIsArchived = col_exists($pdo, 'product_variants', 'is_archived');

$categoryCol = $hasCategory ? "MAX(category)" : "NULL";
$descCol = $hasDescription ? "MAX(description)" : "NULL";
$archivedCol = $hasIsArchived ? "MIN(is_archived)" : "0";

$pdo->exec("INSERT INTO products (name, category, description, is_archived)
    SELECT name, $categoryCol, $descCol, $archivedCol
    FROM product_variants
    GROUP BY name
    ORDER BY MIN(id)");

$parentCount = (int)$pdo->query("SELECT COUNT(*) FROM products")->fetchColumn();
echo "  ✅ تم إنشاء $parentCount منتج أب\n";

// 6. تحديث product_id في product_variants
echo "⏳ خطوة 5: ربط المتغيرات بالآباء...\n";
$pdo->exec("UPDATE product_variants pv
    JOIN products p ON p.name = pv.name
    SET pv.product_id = p.id");

// التحقق من عدم وجود متغيرات بدون أب
$orphans = (int)$pdo->query("SELECT COUNT(*) FROM product_variants WHERE product_id = 0")->fetchColumn();
if ($orphans > 0) {
    echo "  ⚠️ تحذير: $orphans متغير بدون أب! محاولة إصلاح...\n";
    // إنشاء آباء للمتغيرات اليتيمة (حالة نادرة)
    $stmt = $pdo->query("SELECT DISTINCT name FROM product_variants WHERE product_id = 0");
    foreach ($stmt->fetchAll(PDO::FETCH_COLUMN) as $orphanName) {
        $pdo->prepare("INSERT IGNORE INTO products (name) VALUES (?)")->execute([$orphanName]);
        $newPid = $pdo->query("SELECT id FROM products WHERE name = " . $pdo->quote($orphanName) . " LIMIT 1")->fetchColumn();
        $pdo->prepare("UPDATE product_variants SET product_id = ? WHERE name = ? AND product_id = 0")->execute([$newPid, $orphanName]);
    }
    $orphans = (int)$pdo->query("SELECT COUNT(*) FROM product_variants WHERE product_id = 0")->fetchColumn();
    echo "  " . ($orphans === 0 ? "✅" : "❌") . " متغيرات يتيمة متبقية: $orphans\n";
} else {
    echo "  ✅ جميع المتغيرات مرتبطة بأب\n";
}

// 7. إحصائيات نهائية
echo "\n=== ✅ اكتملت الهجرة بنجاح ===\n";
echo "📊 الحالة النهائية:\n";
echo "  products (آباء): $parentCount صف\n";
$variantCount = (int)$pdo->query("SELECT COUNT(*) FROM product_variants")->fetchColumn();
echo "  product_variants: $variantCount صف\n";
echo "  stock (لم يتغير): $stockCount صف  ← product_id فيها = variant_id الآن\n";
echo "  order_items (لم يتغير): $orderItemsCount صف  ← product_id فيها = variant_id الآن\n";

echo "\n📋 مثال على الهيكل الجديد:\n";
$examples = $pdo->query("
    SELECT p.name as parent, pv.color, pv.size, pv.barcode
    FROM products p
    JOIN product_variants pv ON pv.product_id = p.id
    ORDER BY p.name, pv.id
    LIMIT 10
")->fetchAll(PDO::FETCH_ASSOC);
foreach ($examples as $ex) {
    echo "  [{$ex['parent']}] لون:{$ex['color']} مقاس:{$ex['size']} باركود:{$ex['barcode']}\n";
}

echo "\n✅ يمكنك الآن تحديث api.php والواجهة الأمامية.\n";
