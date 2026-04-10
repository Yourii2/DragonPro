<?php
session_start();

// Set timezone to Egypt (UTC+2 — Africa/Cairo)
date_default_timezone_set('Africa/Cairo');

// This endpoint must always return JSON. Prevent PHP warnings/notices
// from being printed as HTML which breaks JSON parsing on the frontend.
error_reporting(E_ALL);
ini_set('display_errors', '0');

// Restrict credentialed CORS to same-host or local development origins only.
function nexus_is_allowed_origin($origin) {
    if (!is_string($origin) || $origin === '') return false;
    $originParts = @parse_url($origin);
    $originHost = strtolower((string)($originParts['host'] ?? ''));
    if ($originHost === '') return false;

    $serverHost = strtolower((string)($_SERVER['HTTP_HOST'] ?? ''));
    $serverHost = preg_replace('/:\d+$/', '', $serverHost);
    if ($serverHost !== '' && $originHost === $serverHost) return true;

    return in_array($originHost, ['localhost', '127.0.0.1', '::1'], true);
}

$origin = trim((string)($_SERVER['HTTP_ORIGIN'] ?? ''));
$allowedOrigin = nexus_is_allowed_origin($origin) ? $origin : '';
if ($allowedOrigin !== '') {
    header('Access-Control-Allow-Origin: ' . $allowedOrigin);
    header('Access-Control-Allow-Credentials: true');
    header('Vary: Origin');
}
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Content-Type: application/json');

// Ensure fatals still return JSON (instead of empty/HTML responses)
register_shutdown_function(function () {
    $err = error_get_last();
    if (!$err) return;
    $fatalTypes = [E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR];
    if (!in_array($err['type'], $fatalTypes, true)) return;

    if (!headers_sent()) {
        http_response_code(500);
        header('Content-Type: application/json');
    }

    // Avoid leaking full paths; keep message useful for local debugging.
    $msg = isset($err['message']) ? (string)$err['message'] : 'Server error';
    echo json_encode(['success' => false, 'message' => 'Fatal: ' . $msg]);
});

// Ensure logs directory exists for debug tracing
try {
    $logsDir = __DIR__ . '/../logs';
    if (!is_dir($logsDir)) @mkdir($logsDir, 0755, true);
} catch (Exception $e) {}

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    if ($origin !== '' && $allowedOrigin === '') {
        http_response_code(403);
        echo json_encode(['success' => false, 'message' => 'Origin not allowed.']);
    }
    exit;
}

// -----------------------
// Bootstrap: DB + input
// -----------------------
if (!defined('DB_HOST')) {
    $cfg = __DIR__ . '/../config.php';
    if (file_exists($cfg)) {
        require_once $cfg;
    }
}

if (!isset($pdo)) {
    try {
        if (!defined('DB_HOST') || !defined('DB_NAME') || !defined('DB_USER')) {
            throw new Exception('Missing DB configuration.');
        }
        $pdo = new PDO(
            "mysql:host=" . DB_HOST . ";dbname=" . DB_NAME . ";charset=utf8mb4",
            DB_USER,
            defined('DB_PASS') ? DB_PASS : '',
            [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            ]
        );
        // Set MySQL session timezone to Egypt (UTC+2)
        $pdo->exec("SET time_zone = '+02:00'");
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Database connection failed.']);
        exit;
    }
}

// Parse JSON body (frontend often sends JSON)
$input = [];
try {
    $raw = file_get_contents('php://input');
    if (is_string($raw) && trim($raw) !== '') {
        $decoded = json_decode($raw, true);
        if (is_array($decoded)) $input = $decoded;
    }
} catch (Exception $e) {
    $input = [];
}
$module = isset($_GET['module']) ? trim((string)$_GET['module']) : '';
$action = isset($_GET['action']) ? trim((string)$_GET['action']) : '';

if ($module === 'sales' && $action === 'getPendingDeliveryNotes') {
    try {
        // جلب كل أذونات التسليم التي لم يتم تسليمها بعد
        $stmt = $pdo->prepare("SELECT dn.*, u.name as rep_name, w.name as warehouse_name FROM delivery_notes dn
            LEFT JOIN users u ON dn.rep_id = u.id
            LEFT JOIN warehouses w ON dn.warehouse_id = w.id
            WHERE dn.delivered = 0 ORDER BY dn.id DESC");
        $stmt->execute();
        $notes = $stmt->fetchAll(PDO::FETCH_ASSOC);
        // جلب البنود لكل إذن
        $stmtItems = $pdo->prepare("SELECT dnl.*, pv.barcode, pv.color, pv.size, p.name as product_name FROM delivery_note_lines dnl
                LEFT JOIN product_variants pv ON dnl.product_id = pv.id
                LEFT JOIN products p ON pv.product_id = p.id
                WHERE dnl.delivery_note_id = ?");
        foreach ($notes as &$note) {
            $stmtItems->execute([$note['id']]);
            $items = $stmtItems->fetchAll(PDO::FETCH_ASSOC);
            $note['items'] = $items;
            $note['total_items'] = array_sum(array_map(function($it) { return (int)($it['qty'] ?? $it['quantity'] ?? 0); }, $items));
        }
        unset($note);
        echo json_encode(['success' => true, 'data' => $notes]);
    } catch (Exception $e) {
        echo json_encode(['success' => false, 'message' => 'فشل في جلب الأذونات', 'error' => $e->getMessage()]);
    }
    exit;
}
if ($module === 'sales' && $action === 'getDeliveryNoteDetails') {
    try {
        $id = isset($_GET['id']) ? $_GET['id'] : null;
        if (!$id) {
            echo json_encode(['success' => false, 'message' => 'رقم الإذن مطلوب']);
            exit;
        }

        $stmt = $pdo->prepare("SELECT dn.*, u.name as rep_name, w.name as warehouse_name FROM delivery_notes dn
            LEFT JOIN users u ON dn.rep_id = u.id
            LEFT JOIN warehouses w ON dn.warehouse_id = w.id
            WHERE (dn.id = :id OR dn.note_code = :id) AND dn.delivered = 0 LIMIT 1");
        $stmt->execute(['id' => $id]);
        $note = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$note) {
            echo json_encode(['success' => false, 'message' => 'إذن التسليم غير موجود أو تم تسليمه مسبقاً']);
            exit;
        }

        $stmtItems = $pdo->prepare("SELECT dnl.*, pv.barcode, pv.color, pv.size, p.name as product_name FROM delivery_note_lines dnl
                LEFT JOIN product_variants pv ON dnl.product_id = pv.id
                LEFT JOIN products p ON pv.product_id = p.id
                WHERE dnl.delivery_note_id = ?");
        $stmtItems->execute([$note['id']]);
        $items = $stmtItems->fetchAll(PDO::FETCH_ASSOC);
        
        $note['items'] = $items;
        $note['total_items'] = array_sum(array_map(function($it) { return (int)($it['qty'] ?? $it['quantity'] ?? 0); }, $items));

        echo json_encode(['success' => true, 'data' => $note]);
    } catch (Exception $e) {
        echo json_encode(['success' => false, 'message' => 'فشل في جلب الإذن', 'error' => $e->getMessage()]);
    }
    exit;
}

if ($module === 'sales' && $action === 'confirmDeliveryNote') {
    try {
        $input_data = json_decode(file_get_contents('php://input'), true) ?: [];
        $note_id = isset($input_data['note_id']) ? intval($input_data['note_id']) : null;
        if (!$note_id) {
            echo json_encode(['success' => false, 'message' => 'رقم الإذن مطلوب']);
            exit;
        }

        $stmt = $pdo->prepare("UPDATE delivery_notes SET delivered = 1 WHERE id = ?");
        $stmt->execute([$note_id]);

        if ($stmt->rowCount() > 0) {
            echo json_encode(['success' => true, 'message' => 'تم تأكيد التسليم بنجاح']);
        } else {
            echo json_encode(['success' => false, 'message' => 'لم يتم تحديث الإذن. قد يكون غير موجود أو مسلم مسبقاً']);
        }
    } catch (Exception $e) {
        echo json_encode(['success' => false, 'message' => 'خطأ أثناء التأكيد', 'error' => $e->getMessage()]);
    }
    exit;
}

// Delivery Note API - متوافق مع ملف SalesDaily.tsx
if ($module === 'sales' && $action === 'createDeliveryNote') {
        // Ensure note_code column exists (auto-migrate if missing)
        try {
            $colCheck = $pdo->query("SHOW COLUMNS FROM delivery_notes LIKE 'note_code'")->fetch();
            if (!$colCheck) {
                $pdo->exec("ALTER TABLE delivery_notes ADD COLUMN note_code VARCHAR(32) UNIQUE AFTER id");
            }
        } catch (Exception $e) {
            error_log('Auto-migration failed: ' . $e->getMessage());
        }
    header('Content-Type: application/json; charset=utf-8');
    $input = json_decode(file_get_contents('php://input'), true);
    if (!$input) {
        echo json_encode(['success' => false, 'message' => 'لم يتم استلام بيانات صحيحة']);
        exit;
    }
    try {
        $pdo->exec("CREATE TABLE IF NOT EXISTS delivery_notes (
            id INT AUTO_INCREMENT PRIMARY KEY,
            note_code VARCHAR(32) UNIQUE,
            order_id INT NULL,
            rep_id INT NULL,
            warehouse_id INT NULL,
            created_by INT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            delivered TINYINT(1) DEFAULT 0
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
        $pdo->exec("CREATE TABLE IF NOT EXISTS delivery_note_lines (
            id INT AUTO_INCREMENT PRIMARY KEY,
            delivery_note_id INT NOT NULL,
            product_id INT NOT NULL,
            quantity INT NOT NULL,
            qty INT NOT NULL DEFAULT 0,
            journal_code VARCHAR(32) NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX (delivery_note_id),
            FOREIGN KEY (delivery_note_id) REFERENCES delivery_notes(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    } catch (PDOException $e) {
        error_log('Delivery Note Tables Error: ' . $e->getMessage());
    }
    $order_id = isset($input['order_id']) ? intval($input['order_id']) : null;
    $rep_id = isset($input['rep_id']) ? intval($input['rep_id']) : null;
    $warehouse_id = isset($input['warehouse_id']) ? intval($input['warehouse_id']) : null;
    $created_by = isset($input['created_by']) ? intval($input['created_by']) : null;
    $note_code = isset($input['note_code']) ? trim((string)$input['note_code']) : null;
    $items = isset($input['items']) && is_array($input['items']) ? $input['items'] : [];
    if (!$note_code) {
        $note_code = 'DN-' . strtoupper(bin2hex(random_bytes(4)));
    }
    try {
        $pdo->beginTransaction();
        $stmtNote = $pdo->prepare("INSERT INTO delivery_notes (note_code, order_id, rep_id, warehouse_id, created_by) VALUES (?, ?, ?, ?, ?)");
        $stmtNote->execute([$note_code, $order_id, $rep_id, $warehouse_id, $created_by]);
        $delivery_note_id = intval($pdo->lastInsertId());
        if (empty($items)) {
            throw new Exception('No items provided for delivery note');
        }
        $stmtLine = $pdo->prepare("INSERT INTO delivery_note_lines (delivery_note_id, product_id, quantity, qty, journal_code) VALUES (?, ?, ?, ?, ?)");
        foreach ($items as $item) {
            $product_id = isset($item['product_id']) ? intval($item['product_id']) : null;
            $quantity = isset($item['quantity']) ? intval($item['quantity']) : 1;
            $qty = isset($item['qty']) ? intval($item['qty']) : $quantity;
            $journal_code = isset($item['journal_code']) ? trim((string)$item['journal_code']) : null;
            if ($product_id) {
                $stmtLine->execute([$delivery_note_id, $product_id, $quantity, $qty, $journal_code]);
            }
        }
        $pdo->commit();
        // جلب اسم الموظف من جدول المستخدمين
        $created_by_name = null;
        if ($created_by) {
            try {
                $stmtUser = $pdo->prepare("SELECT name FROM users WHERE id = ? LIMIT 1");
                $stmtUser->execute([$created_by]);
                $created_by_name = $stmtUser->fetchColumn() ?: null;
            } catch (Exception $e) { $created_by_name = null; }
        }
        echo json_encode([
            'success' => true,
            'data' => [
                'delivery_note_id' => $delivery_note_id,
                'note_code' => $note_code,
                'created_by_name' => $created_by_name
            ]
        ]);
    } catch (Exception $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        error_log('Delivery Note Error: ' . $e->getMessage());
        echo json_encode(['success' => false, 'message' => 'Failed to save delivery note', 'error' => $e->getMessage()]);
    }
    exit;
}
// -----------------------
// Core helpers (defined here for standalone api.php)
// -----------------------
if (!function_exists('execute_query')) {
    function execute_query($pdo, $sql, $params = []) {
        $stmt = $pdo->prepare($sql);
        $stmt->execute(is_array($params) ? $params : []);
        return $stmt;
    }
}

if (!function_exists('table_exists')) {
    function table_exists($pdo, $table) {
        try {
            $db = $pdo->query('SELECT DATABASE()')->fetchColumn();
            if (!$db) return false;
            $stmt = execute_query(
                $pdo,
                'SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? LIMIT 1',
                [$db, $table]
            );
            return intval($stmt->fetchColumn()) > 0;
        } catch (Exception $e) {
            return false;
        }
    }
}

if (!function_exists('column_exists')) {
    function column_exists($pdo, $table, $column) {
        try {
            $db = $pdo->query('SELECT DATABASE()')->fetchColumn();
            if (!$db) return false;
            $stmt = execute_query(
                $pdo,
                'SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ? LIMIT 1',
                [$db, $table, $column]
            );
            return intval($stmt->fetchColumn()) > 0;
        } catch (Exception $e) {
            return false;
        }
    }
}

if (!function_exists('ensure_product_parent')) {
    /**
     * تضمن وجود منتج أب بالاسم المحدد في جدول products.
     * إذا لم يوجد يتم إنشاؤه. تُرجع id الأب.
     * تُستخدم عند إنشاء product_variants جديدة برمجياً.
     */
    function ensure_product_parent(PDO $pdo, string $name, ?string $category = null): int {
        $name = trim($name);
        if ($name === '') $name = 'منتج غير مسمى';
        $existing = $pdo->prepare("SELECT id FROM products WHERE name = ? LIMIT 1");
        $existing->execute([$name]);
        $row = $existing->fetchColumn();
        if ($row) return intval($row);
        $ins = $pdo->prepare("INSERT INTO products (name, category) VALUES (?, ?)");
        $ins->execute([$name, $category]);
        return intval($pdo->lastInsertId());
    }
}

if (!function_exists('get_setting_value')) {
    function get_setting_value($pdo, $key, $default = null) {
        $key = trim((string)$key);
        if ($key === '') return $default;

        static $cache = null;
        static $cacheLoaded = false;

        try {
            if (!($pdo instanceof PDO)) return $default;
            if (!table_exists($pdo, 'settings')) return $default;

            // Lazy-load settings into a small in-request cache to avoid repeated queries.
            if (!$cacheLoaded) {
                $cacheLoaded = true;
                $cache = [];
                try {
                    $stmt = execute_query($pdo, 'SELECT config_key, config_value FROM settings');
                    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
                    foreach ($rows as $r) {
                        if (!isset($r['config_key'])) continue;
                        $k = (string)$r['config_key'];
                        $cache[$k] = $r['config_value'] ?? null;
                    }
                } catch (Exception $e) {
                    // If the table exists but query fails for any reason, fallback to per-key query.
                    $cache = null;
                }
            }

            if (is_array($cache)) {
                return array_key_exists($key, $cache) ? $cache[$key] : $default;
            }

            $val = execute_query(
                $pdo,
                'SELECT config_value FROM settings WHERE config_key = ? LIMIT 1',
                [$key]
            )->fetchColumn();

            return ($val === false || $val === null) ? $default : $val;
        } catch (Exception $e) {
            return $default;
        }
    }
}

if (!function_exists('normalize_tax_discount_type')) {
    function normalize_tax_discount_type($value) {
        if ($value === null) return null;
        $v = strtolower(trim((string)$value));
        if ($v === '') return null;
        if ($v === 'percent' || $v === 'percentage') return 'percent';
        if ($v === 'amount' || $v === 'fixed' || $v === 'value') return 'amount';
        return null;
    }
}

if (!function_exists('run_supplier_reconciliation_once')) {
    function run_supplier_reconciliation_once($pdo) {
        try {
            if (!($pdo instanceof PDO)) return;
            if (!table_exists($pdo, 'suppliers') || !table_exists($pdo, 'transactions')) return;
            if (!table_exists($pdo, 'settings')) return;
            if (!column_exists($pdo, 'settings', 'config_key') || !column_exists($pdo, 'settings', 'config_value')) return;

            $flagKey = 'suppliers_reconcile_1_3_4_auto_v1';
            $already = strtolower((string)get_setting_value($pdo, $flagKey, ''));
            if ($already === 'done') return;

            $pdo->beginTransaction();

            $rows = execute_query($pdo, "SELECT s.id, COALESCE(SUM(
                CASE
                    WHEN LOWER(COALESCE(t.type, '')) = 'purchase' THEN -ABS(COALESCE(t.amount, 0))
                    WHEN LOWER(COALESCE(JSON_UNQUOTE(JSON_EXTRACT(CASE WHEN JSON_VALID(t.details) THEN t.details ELSE NULL END, '$.subtype')), '')) = 'supplier_payment' THEN
                        CASE
                            WHEN CAST(COALESCE(JSON_UNQUOTE(JSON_EXTRACT(CASE WHEN JSON_VALID(t.details) THEN t.details ELSE NULL END, '$.supplier_balance_before')), '0') AS DECIMAL(20,6)) > 0 THEN -ABS(COALESCE(t.amount, 0))
                            WHEN CAST(COALESCE(JSON_UNQUOTE(JSON_EXTRACT(CASE WHEN JSON_VALID(t.details) THEN t.details ELSE NULL END, '$.supplier_balance_before')), '0') AS DECIMAL(20,6)) < 0 THEN ABS(COALESCE(t.amount, 0))
                            WHEN JSON_EXTRACT(CASE WHEN JSON_VALID(t.details) THEN t.details ELSE NULL END, '$.supplier_balance_before') IS NOT NULL THEN ABS(COALESCE(t.amount, 0))
                            ELSE COALESCE(t.amount, 0)
                        END
                    WHEN LOWER(COALESCE(t.type, '')) = 'return_out' THEN ABS(COALESCE(t.amount, 0))
                    WHEN LOWER(COALESCE(t.type, '')) IN ('payment_out', 'supplier_payment', 'payment') THEN COALESCE(t.amount, 0)
                    ELSE COALESCE(t.amount, 0)
                END
            ), 0) AS balance
            FROM suppliers s
            LEFT JOIN transactions t
                ON t.related_to_type = 'supplier'
               AND t.related_to_id = s.id
            GROUP BY s.id")->fetchAll(PDO::FETCH_ASSOC);

            foreach ($rows as $r) {
                $sid = intval($r['id'] ?? 0);
                if ($sid <= 0) continue;
                $balance = floatval($r['balance'] ?? 0);
                if ($balance >= 0) {
                    execute_query($pdo, "UPDATE suppliers SET total_credit = ?, total_debit = 0 WHERE id = ?", [$balance, $sid]);
                } else {
                    execute_query($pdo, "UPDATE suppliers SET total_credit = 0, total_debit = ? WHERE id = ?", [abs($balance), $sid]);
                }
            }

            $exists = execute_query($pdo, "SELECT COUNT(*) FROM settings WHERE config_key = ?", [$flagKey])->fetchColumn();
            if (intval($exists) > 0) {
                execute_query($pdo, "UPDATE settings SET config_value = ? WHERE config_key = ?", ['done', $flagKey]);
            } else {
                execute_query($pdo, "INSERT INTO settings (config_key, config_value) VALUES (?, ?)", [$flagKey, 'done']);
            }

            if ($pdo->inTransaction()) $pdo->commit();
        } catch (Exception $e) {
            if ($pdo instanceof PDO && $pdo->inTransaction()) $pdo->rollBack();
        }
    }
}

if (!function_exists('calculate_order_totals')) {
    function calculate_order_totals($subtotal, $shipping, $discountType, $discountValue, $taxType, $taxValue, $calcOrder) {
        $safeSubtotal = max(0, floatval($subtotal ?? 0));
        $safeShipping = max(0, floatval($shipping ?? 0));
        $safeDiscountValue = max(0, floatval($discountValue ?? 0));
        $safeTaxValue = max(0, floatval($taxValue ?? 0));
        $calcOrder = ($calcOrder === 'tax_then_discount') ? 'tax_then_discount' : 'discount_then_tax';

        $discountAmount = 0.0;
        $taxAmount = 0.0;

        if ($calcOrder === 'tax_then_discount') {
            if ($taxType === 'percent') $taxAmount = $safeSubtotal * ($safeTaxValue / 100.0);
            else if ($taxType === 'amount') $taxAmount = $safeTaxValue;

            $baseForDiscount = max(0.0, $safeSubtotal + $taxAmount);
            if ($discountType === 'percent') $discountAmount = $baseForDiscount * ($safeDiscountValue / 100.0);
            else if ($discountType === 'amount') $discountAmount = $safeDiscountValue;
            if ($discountAmount > $baseForDiscount) $discountAmount = $baseForDiscount;
        } else {
            if ($discountType === 'percent') $discountAmount = $safeSubtotal * ($safeDiscountValue / 100.0);
            else if ($discountType === 'amount') $discountAmount = $safeDiscountValue;
            if ($discountAmount > $safeSubtotal) $discountAmount = $safeSubtotal;

            $baseForTax = max(0.0, $safeSubtotal - $discountAmount);
            if ($taxType === 'percent') $taxAmount = $baseForTax * ($safeTaxValue / 100.0);
            else if ($taxType === 'amount') $taxAmount = $safeTaxValue;
        }

        $total = max(0.0, $safeSubtotal - $discountAmount + $taxAmount + $safeShipping);
        return [
            'subtotal' => $safeSubtotal,
            'discount_amount' => $discountAmount,
            'tax_amount' => $taxAmount,
            'total' => $total,
        ];
    }
}

if (!function_exists('finance_get_account_id_by_code')) {
    function finance_get_account_id_by_code($pdo, $code) {
        try {
            if (!($pdo instanceof PDO)) return null;
            if (!table_exists($pdo, 'accounts')) return null;
            $code = trim((string)$code);
            if ($code === '') return null;
            $id = execute_query($pdo, "SELECT id FROM accounts WHERE code = ? LIMIT 1", [$code])->fetchColumn();
            return $id ? intval($id) : null;
        } catch (Exception $e) {
            return null;
        }
    }
}

if (!function_exists('finance_get_account_id_by_type')) {
    function finance_get_account_id_by_type($pdo, $type) {
        try {
            if (!($pdo instanceof PDO)) return null;
            if (!table_exists($pdo, 'accounts')) return null;
            $type = trim((string)$type);
            if ($type === '') return null;
            $hasActive = column_exists($pdo, 'accounts', 'is_active');
            $sql = $hasActive ? "SELECT id FROM accounts WHERE type = ? AND is_active = 1 ORDER BY id ASC LIMIT 1" : "SELECT id FROM accounts WHERE type = ? ORDER BY id ASC LIMIT 1";
            $id = execute_query($pdo, $sql, [$type])->fetchColumn();
            return $id ? intval($id) : null;
        } catch (Exception $e) {
            return null;
        }
    }
}

if (!function_exists('finance_create_journal_entry')) {
    function finance_create_journal_entry($pdo, $entryDate, $memo, $sourceType, $sourceId, $posted, $lines) {
        try {
            if (!($pdo instanceof PDO)) return null;
            if (!table_exists($pdo, 'journal_entries') || !table_exists($pdo, 'journal_lines') || !table_exists($pdo, 'accounts')) return null;
            if (!is_array($lines) || count($lines) < 2) return null;

            $totalDebit = 0.0;
            $totalCredit = 0.0;
            $normLines = [];
            foreach ($lines as $ln) {
                if (!is_array($ln)) continue;
                $accountId = intval($ln['account_id'] ?? 0);
                $debit = floatval($ln['debit'] ?? 0);
                $credit = floatval($ln['credit'] ?? 0);
                $lineMemo = $ln['memo'] ?? ($ln['line_memo'] ?? null);
                if ($accountId <= 0) continue;
                if ($debit < 0) $debit = 0;
                if ($credit < 0) $credit = 0;
                $totalDebit += $debit;
                $totalCredit += $credit;
                $normLines[] = ['account_id' => $accountId, 'debit' => $debit, 'credit' => $credit, 'line_memo' => $lineMemo];
            }
            if (count($normLines) < 2) return null;
            if (abs($totalDebit - $totalCredit) > 0.01) return null; // not balanced

            $entryDate = $entryDate ? (string)$entryDate : date('Y-m-d');
            $postedVal = $posted ? 1 : 0;
            $createdBy = $_SESSION['user_id'] ?? null;

            $txStarted = false;
            try {
                if (!$pdo->inTransaction()) {
                    $txStarted = $pdo->beginTransaction();
                }
            } catch (Exception $e) {
                $txStarted = false;
            }

            $cols = ['entry_date', 'memo', 'source_type', 'source_id', 'posted', 'created_by'];
            $vals = [$entryDate, $memo, $sourceType, $sourceId ? intval($sourceId) : null, $postedVal, $createdBy ? intval($createdBy) : null];

            // Older installs safety: only insert columns that exist.
            $finalCols = [];
            $finalVals = [];
            foreach ($cols as $idx => $c) {
                if (column_exists($pdo, 'journal_entries', $c)) {
                    $finalCols[] = $c;
                    $finalVals[] = $vals[$idx];
                }
            }
            if (count($finalCols) === 0) return null;

            $ph = implode(',', array_fill(0, count($finalCols), '?'));
            execute_query($pdo, "INSERT INTO journal_entries (" . implode(',', $finalCols) . ") VALUES ($ph)", $finalVals);
            $entryId = intval($pdo->lastInsertId());
            if ($entryId <= 0) return null;

            foreach ($normLines as $ln) {
                execute_query(
                    $pdo,
                    "INSERT INTO journal_lines (entry_id, account_id, debit, credit, line_memo) VALUES (?, ?, ?, ?, ?)",
                    [$entryId, $ln['account_id'], $ln['debit'], $ln['credit'], $ln['line_memo']]
                );
            }

            if ($txStarted && $pdo->inTransaction()) $pdo->commit();
            return $entryId;
        } catch (Exception $e) {
            try {
                if ($pdo instanceof PDO && $pdo->inTransaction()) $pdo->rollBack();
            } catch (Exception $ignore) {}
            return null;
        }
    }
}

// Pick a safe enum/set value for older DB schemas.
// - Prefer $value if it exists in the DB enum and in $allowedValues.
// - Otherwise pick the first intersection between DB enum options and $allowedValues.
// - Fallback to first $allowedValues entry.
if (!function_exists('pick_allowed_enum')) {
    function pick_allowed_enum($pdo, $table, $column, $value, $allowedValues) {
        $allowedValues = is_array($allowedValues) ? array_values($allowedValues) : [];
        if (count($allowedValues) === 0) return $value;

        $candidate = ($value === null || $value === '') ? $allowedValues[0] : (string)$value;

        try {
            if (!($pdo instanceof PDO)) {
                // No DB handle: just validate against caller-provided allowed list.
                return in_array($candidate, $allowedValues, true) ? $candidate : $allowedValues[0];
            }

            // If table/column not present, fallback.
            if (!table_exists($pdo, $table) || !column_exists($pdo, $table, $column)) {
                return in_array($candidate, $allowedValues, true) ? $candidate : $allowedValues[0];
            }

            // MySQL: SHOW COLUMNS returns Type like: enum('a','b') or set('a','b')
            $row = execute_query($pdo, "SHOW COLUMNS FROM `$table` LIKE ?", [$column])->fetch(PDO::FETCH_ASSOC);
            $type = isset($row['Type']) ? strtolower((string)$row['Type']) : '';

            $dbOptions = [];
            if (strpos($type, 'enum(') === 0 || strpos($type, 'set(') === 0) {
                if (preg_match_all("/'((?:\\\\'|[^'])*)'/", $type, $m)) {
                    foreach ($m[1] as $opt) {
                        $dbOptions[] = str_replace("\\'", "'", $opt);
                    }
                }
            }

            if (count($dbOptions) > 0) {
                if (in_array($candidate, $allowedValues, true) && in_array($candidate, $dbOptions, true)) {
                    return $candidate;
                }
                foreach ($allowedValues as $opt) {
                    if (in_array($opt, $dbOptions, true)) return $opt;
                }
                return $dbOptions[0];
            }

            // Non-enum column: just validate against allowed list.
            return in_array($candidate, $allowedValues, true) ? $candidate : $allowedValues[0];
        } catch (Exception $e) {
            return in_array($candidate, $allowedValues, true) ? $candidate : $allowedValues[0];
        }
    }
}

if (!function_exists('ensure_orders_status_has_cancelled')) {
    function ensure_orders_status_has_cancelled($pdo) {
        if (!($pdo instanceof PDO)) return;
        if (!table_exists($pdo, 'orders') || !column_exists($pdo, 'orders', 'status')) return;

        $col = execute_query($pdo, "SHOW COLUMNS FROM `orders` LIKE 'status'")->fetch(PDO::FETCH_ASSOC);
        if (!$col) return;

        $type = strtolower((string)($col['Type'] ?? ''));
        if (strpos($type, 'enum(') !== 0) return;

        $options = [];
        if (preg_match_all("/'((?:\\\\'|[^'])*)'/", $type, $m)) {
            foreach ($m[1] as $opt) {
                $options[] = str_replace("\\\\'", "'", $opt);
            }
        }
        if (empty($options) || in_array('cancelled', $options, true)) return;

        $options[] = 'cancelled';
        $enumSql = implode(',', array_map(function ($v) {
            return "'" . str_replace("'", "\\'", (string)$v) . "'";
        }, $options));

        $isNullable = strtoupper((string)($col['Null'] ?? 'YES')) === 'YES';
        $nullSql = $isNullable ? 'NULL' : 'NOT NULL';

        $default = $col['Default'] ?? null;
        $defaultSql = '';
        if ($default !== null && in_array((string)$default, $options, true)) {
            $defaultSql = " DEFAULT '" . str_replace("'", "\\'", (string)$default) . "'";
        } elseif (!$isNullable && !empty($options)) {
            $defaultSql = " DEFAULT '" . str_replace("'", "\\'", (string)$options[0]) . "'";
        }

        execute_query($pdo, "ALTER TABLE `orders` MODIFY COLUMN `status` ENUM($enumSql) $nullSql$defaultSql");
    }
}

if (!function_exists('user_is_admin')) {
    function user_is_admin($pdo, $user_id) {
        if (!$user_id) return false;
        if (isset($_SESSION['user_role']) && $_SESSION['user_role'] === 'admin') return true;
        try {
            if (!table_exists($pdo, 'users')) return false;
            $role = execute_query($pdo, 'SELECT role FROM users WHERE id = ? LIMIT 1', [$user_id])->fetchColumn();
            return $role === 'admin';
        } catch (Exception $e) {
            return false;
        }
    }
}

if (!function_exists('user_has_permission')) {
    function user_has_permission($pdo, $user_id, $module_name, $action_code) {
        if (!$user_id) return false;
        if (user_is_admin($pdo, $user_id)) return true;

        // If permissions tables are missing (older DB), don't block the app.
        if (!table_exists($pdo, 'permission_modules') || !table_exists($pdo, 'permission_actions') || !table_exists($pdo, 'user_permissions')) {
            return true;
        }

        $allowed = execute_query(
            $pdo,
            "SELECT up.allowed
             FROM user_permissions up
             JOIN permission_modules m ON m.id = up.module_id
             JOIN permission_actions a ON a.id = up.action_id
             WHERE up.user_id = ? AND m.name = ? AND a.code = ?
             LIMIT 1",
            [$user_id, $module_name, $action_code]
        )->fetchColumn();

        // IMPORTANT: Many installs rely on implicit allow unless an explicit deny exists.
        // If there is no matching row, default to allow to avoid breaking entire modules.
        if ($allowed === false || $allowed === null) return true;
        return intval($allowed) === 1;
    }
}

// -----------------------
// HRM runtime migrations
// -----------------------
if (!function_exists('ensure_hrm_tables')) {
    function ensure_hrm_tables($pdo) {
        try {
            if (!table_exists($pdo, 'employees')) {
                execute_query($pdo, "CREATE TABLE IF NOT EXISTS employees (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    name VARCHAR(255) NOT NULL,
                    job_title VARCHAR(255),
                    salary DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
                    hire_date DATE,
                    phone VARCHAR(20),
                    status ENUM('active', 'inactive', 'on_leave') DEFAULT 'active',
                    attendance_enabled TINYINT(1) DEFAULT 1,
                    default_shift_id INT DEFAULT NULL,
                    fingerprint_device_id INT DEFAULT NULL,
                    fingerprint_user_id VARCHAR(100),
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    INDEX(status),
                    INDEX(created_at)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
            }

            if (!table_exists($pdo, 'employee_transactions')) {
                execute_query($pdo, "CREATE TABLE IF NOT EXISTS employee_transactions (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    employee_id INT NOT NULL,
                    treasury_id INT NULL,
                    amount DECIMAL(10, 2) NOT NULL,
                    type ENUM('advance', 'bonus', 'penalty', 'salary') NOT NULL,
                    date DATE NOT NULL,
                    notes TEXT,
                    status ENUM('pending', 'paid', 'deducted') DEFAULT 'pending',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    INDEX(employee_id),
                    INDEX(treasury_id),
                    INDEX(date),
                    INDEX(type)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
            } else {
                // Ensure enum contains 'salary'
                try {
                    execute_query($pdo, "ALTER TABLE employee_transactions MODIFY COLUMN type ENUM('advance','bonus','penalty','salary') NOT NULL");
                } catch (Exception $e) {
                    // ignore
                }
            }

            if (!table_exists($pdo, 'employee_salaries')) {
                execute_query($pdo, "CREATE TABLE IF NOT EXISTS employee_salaries (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    employee_id INT NOT NULL,
                    month VARCHAR(7) NOT NULL,
                    base_salary DECIMAL(10, 2) NOT NULL,
                    deductions DECIMAL(10, 2) DEFAULT 0.00,
                    bonuses DECIMAL(10, 2) DEFAULT 0.00,
                    net_salary DECIMAL(10, 2) NOT NULL,
                    status ENUM('pending', 'paid') DEFAULT 'pending',
                    paid_at TIMESTAMP NULL,
                    notes TEXT,
                    UNIQUE(employee_id, month),
                    INDEX(employee_id),
                    INDEX(month),
                    INDEX(status)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
            }
        } catch (Exception $e) {
            // ignore: downstream will surface if truly broken
        }
    }
}

if (!function_exists('ensure_attendance_tables')) {
    function ensure_attendance_tables($pdo) {
        try {
            if (!table_exists($pdo, 'attendance_devices')) {
                execute_query($pdo, "CREATE TABLE IF NOT EXISTS attendance_devices (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    name VARCHAR(255) NOT NULL,
                    vendor ENUM('hikvision', 'zkteco', 'adms', 'other') DEFAULT 'other',
                    protocol VARCHAR(50) DEFAULT 'http',
                    driver VARCHAR(50) DEFAULT NULL,
                    driver_config TEXT NULL,
                    ip VARCHAR(100),
                    port INT DEFAULT 80,
                    serial_number VARCHAR(100),
                    username VARCHAR(255),
                    password VARCHAR(255),
                    location VARCHAR(255),
                    enabled TINYINT(1) DEFAULT 1,
                    last_sync_at DATETIME NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    INDEX(enabled),
                    INDEX(vendor),
                    INDEX(created_at)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
            } else {
                // add driver fields for older installs
                if (!column_exists($pdo, 'attendance_devices', 'driver')) {
                    try { execute_query($pdo, "ALTER TABLE attendance_devices ADD COLUMN driver VARCHAR(50) DEFAULT NULL AFTER protocol"); } catch (Exception $e) {}
                }
                if (!column_exists($pdo, 'attendance_devices', 'driver_config')) {
                    try { execute_query($pdo, "ALTER TABLE attendance_devices ADD COLUMN driver_config TEXT NULL AFTER driver"); } catch (Exception $e) {}
                }
                try { execute_query($pdo, "CREATE INDEX idx_attendance_devices_vendor ON attendance_devices (vendor)"); } catch (Exception $e) {}
            }
            if (!table_exists($pdo, 'attendance_device_users')) {
                execute_query($pdo, "CREATE TABLE IF NOT EXISTS attendance_device_users (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    device_id INT NOT NULL,
                    employee_id INT NOT NULL,
                    device_user_id VARCHAR(100) NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(device_id, device_user_id),
                    UNIQUE(device_id, employee_id),
                    INDEX(employee_id)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
            }

            // Workers mapping to devices (separate from employees)
            if (!table_exists($pdo, 'attendance_device_workers')) {
                execute_query($pdo, "CREATE TABLE IF NOT EXISTS attendance_device_workers (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    device_id INT NOT NULL,
                    worker_id INT NOT NULL,
                    device_user_id VARCHAR(100) NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(device_id, device_user_id),
                    UNIQUE(device_id, worker_id),
                    INDEX(worker_id)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
            }
            if (!table_exists($pdo, 'attendance_shifts')) {
                execute_query($pdo, "CREATE TABLE IF NOT EXISTS attendance_shifts (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    name VARCHAR(255) NOT NULL,
                    start_time TIME NOT NULL,
                    end_time TIME NOT NULL,
                    break_minutes INT DEFAULT 0,
                    grace_in_minutes INT DEFAULT 0,
                    grace_out_minutes INT DEFAULT 0,
                    late_penalty_per_minute DECIMAL(10, 2) DEFAULT 0.00,
                    early_leave_penalty_per_minute DECIMAL(10, 2) DEFAULT 0.00,
                    absence_penalty_per_day DECIMAL(10, 2) DEFAULT 0.00,
                    overtime_rate_per_hour DECIMAL(10, 2) DEFAULT 0.00,
                    is_night_shift TINYINT(1) DEFAULT 0,
                    weekly_off_days VARCHAR(50) DEFAULT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    INDEX(created_at)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
            }
            if (!table_exists($pdo, 'attendance_schedules')) {
                execute_query($pdo, "CREATE TABLE IF NOT EXISTS attendance_schedules (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    employee_id INT NOT NULL,
                    shift_id INT NOT NULL,
                    day_of_week TINYINT NOT NULL,
                    valid_from DATE NULL,
                    valid_to DATE NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    INDEX(employee_id),
                    INDEX(shift_id)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
            }
            if (!table_exists($pdo, 'attendance_holidays')) {
                execute_query($pdo, "CREATE TABLE IF NOT EXISTS attendance_holidays (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    name VARCHAR(255) NOT NULL,
                    holiday_date DATE NOT NULL,
                    is_paid TINYINT(1) DEFAULT 1,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(holiday_date)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
            }
            if (!table_exists($pdo, 'attendance_logs')) {
                execute_query($pdo, "CREATE TABLE IF NOT EXISTS attendance_logs (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    employee_id INT NULL,
                    device_id INT NULL,
                    device_user_id VARCHAR(100) NULL,
                    check_time DATETIME NOT NULL,
                    direction ENUM('in', 'out', 'unknown') DEFAULT 'unknown',
                    source VARCHAR(50) DEFAULT 'manual',
                    raw_payload TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    INDEX(employee_id),
                    INDEX(device_id),
                    INDEX(check_time)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
            }
            if (!table_exists($pdo, 'attendance_daily_summary')) {
                execute_query($pdo, "CREATE TABLE IF NOT EXISTS attendance_daily_summary (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    employee_id INT NOT NULL,
                    shift_id INT NULL,
                    work_date DATE NOT NULL,
                    first_in DATETIME NULL,
                    last_out DATETIME NULL,
                    late_minutes INT DEFAULT 0,
                    early_leave_minutes INT DEFAULT 0,
                    overtime_minutes INT DEFAULT 0,
                    is_absent TINYINT(1) DEFAULT 0,
                    status ENUM('present', 'late', 'absent', 'leave', 'holiday') DEFAULT 'present',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP NULL,
                    UNIQUE(employee_id, work_date),
                    INDEX(work_date)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
            }

            // Worker attendance daily summary (separate table to avoid breaking existing employee flows)
            if (!table_exists($pdo, 'attendance_worker_daily_summary')) {
                execute_query($pdo, "CREATE TABLE IF NOT EXISTS attendance_worker_daily_summary (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    worker_id INT NOT NULL,
                    shift_id INT NULL,
                    work_date DATE NOT NULL,
                    first_in DATETIME NULL,
                    last_out DATETIME NULL,
                    late_minutes INT DEFAULT 0,
                    early_leave_minutes INT DEFAULT 0,
                    overtime_minutes INT DEFAULT 0,
                    is_absent TINYINT(1) DEFAULT 0,
                    status ENUM('present', 'late', 'absent', 'leave', 'holiday') DEFAULT 'present',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP NULL,
                    UNIQUE(worker_id, work_date),
                    INDEX(work_date),
                    INDEX(worker_id)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
            }
        } catch (Exception $e) {
            // ignore
        }
    }
}

if (!function_exists('attendance_decode_driver_config')) {
    function attendance_decode_driver_config($raw) {
        if ($raw === null) return [];
        if (is_array($raw)) return $raw;
        $s = trim((string)$raw);
        if ($s === '') return [];
        $j = json_decode($s, true);
        return is_array($j) ? $j : [];
    }
}

if (!function_exists('attendance_pick_driver')) {
    function attendance_pick_driver($device) {
        $driver = strtolower(trim((string)($device['driver'] ?? '')));
        if ($driver !== '') return $driver;
        $vendor = strtolower(trim((string)($device['vendor'] ?? '')));
        // defaults
        if ($vendor === 'hikvision') return 'hikvision_isapi';
        if ($vendor === 'zkteco' || $vendor === 'adms') return 'adms_push';
        return 'manual';
    }
}

if (!function_exists('attendance_http_request_json')) {
    function attendance_http_request_json($url, $method = 'GET', $bodyJson = null, $username = null, $password = null, $timeoutSeconds = 20) {
        if (!function_exists('curl_init')) {
            throw new Exception('cURL not available on server.');
        }
        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, $timeoutSeconds);
        curl_setopt($ch, CURLOPT_TIMEOUT, $timeoutSeconds);
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
        curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, false);
        $headers = ['Accept: application/json'];

        $m = strtoupper($method);
        if ($m === 'POST') {
            curl_setopt($ch, CURLOPT_POST, true);
            if ($bodyJson !== null) {
                $payload = is_string($bodyJson) ? $bodyJson : json_encode($bodyJson);
                curl_setopt($ch, CURLOPT_POSTFIELDS, $payload);
                $headers[] = 'Content-Type: application/json';
            }
        }

        if ($username !== null && $username !== '') {
            curl_setopt($ch, CURLOPT_HTTPAUTH, CURLAUTH_ANY);
            curl_setopt($ch, CURLOPT_USERPWD, $username . ':' . ($password ?? ''));
        }
        curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);

        $resp = curl_exec($ch);
        $err = curl_error($ch);
        $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($resp === false) {
            throw new Exception('HTTP request failed: ' . $err);
        }
        if ($code >= 400) {
            throw new Exception('HTTP error ' . $code . ' from device.');
        }

        $j = json_decode($resp, true);
        if (!is_array($j)) {
            throw new Exception('Invalid JSON response from device.');
        }
        return $j;
    }
}

if (!function_exists('attendance_driver_pull_logs')) {
    // Returns: array of logs: [ ['device_user_id'=>..., 'check_time'=>..., 'direction'=>..., 'raw_payload'=>mixed], ... ]
    function attendance_driver_pull_logs($device, $start, $end) {
        $driver = attendance_pick_driver($device);
        $cfg = attendance_decode_driver_config($device['driver_config'] ?? null);

        if ($driver === 'manual' || $driver === 'adms_push') {
            return ['success' => false, 'message' => 'هذا الجهاز يعمل بنظام Push/يدوي. لا يوجد Pull مباشر.', 'items' => []];
        }

        // Generic JSON pull: expects endpoint returning { logs: [ { device_user_id|user_id, check_time|timestamp, direction } ] }
        if ($driver === 'http_json_pull') {
            $base = trim((string)($cfg['base_url'] ?? ''));
            $path = trim((string)($cfg['path'] ?? '/logs'));
            $user = (string)($device['username'] ?? ($cfg['username'] ?? ''));
            $pass = (string)($device['password'] ?? ($cfg['password'] ?? ''));
            if ($base === '') {
                $ip = trim((string)($device['ip'] ?? ''));
                $port = intval($device['port'] ?? 80);
                $proto = trim((string)($device['protocol'] ?? 'http'));
                if ($ip === '') return ['success' => false, 'message' => 'IP غير محدد للجهاز.', 'items' => []];
                $base = $proto . '://' . $ip . ':' . $port;
            }
            if (strpos($path, '/') !== 0) $path = '/' . $path;
            $url = rtrim($base, '/') . $path;
            // send range
            $payload = ['start' => $start, 'end' => $end];
            $j = attendance_http_request_json($url, 'POST', $payload, $user, $pass, 25);
            $logs = [];
            $rawLogs = $j['logs'] ?? $j['data'] ?? [];
            if (is_array($rawLogs)) {
                foreach ($rawLogs as $row) {
                    if (!is_array($row)) continue;
                    $du = $row['device_user_id'] ?? $row['user_id'] ?? $row['uid'] ?? null;
                    $ct = $row['check_time'] ?? $row['timestamp'] ?? $row['time'] ?? null;
                    if (!$du || !$ct) continue;
                    $logs[] = [
                        'device_user_id' => (string)$du,
                        'check_time' => (string)$ct,
                        'direction' => (string)($row['direction'] ?? 'unknown'),
                        'raw_payload' => $row
                    ];
                }
            }
            return ['success' => true, 'message' => 'تم سحب السجلات.', 'items' => $logs];
        }

        // Hikvision ISAPI best-effort pull (AcsEvent)
        if ($driver === 'hikvision_isapi') {
            $ip = trim((string)($device['ip'] ?? ''));
            $port = intval($device['port'] ?? 80);
            $proto = trim((string)($device['protocol'] ?? 'http'));
            $user = (string)($device['username'] ?? 'admin');
            $pass = (string)($device['password'] ?? '');
            if ($ip === '') return ['success' => false, 'message' => 'IP غير محدد للجهاز.', 'items' => []];

            // Allow override path
            $path = trim((string)($cfg['path'] ?? '/ISAPI/AccessControl/AcsEvent?format=json'));
            if (strpos($path, '/') !== 0) $path = '/' . $path;

            $url = $proto . '://' . $ip . ':' . $port . $path;
            $payload = [
                // Hikvision commonly expects this structure
                'AcsEventCond' => [
                    'searchID' => uniqid('nexus_', true),
                    'searchResultPosition' => 0,
                    'maxResults' => intval($cfg['max_results'] ?? 2000),
                    'startTime' => $start . 'T00:00:00+02:00',
                    'endTime' => $end . 'T23:59:59+02:00'
                ]
            ];

            $j = attendance_http_request_json($url, 'POST', $payload, $user, $pass, 30);
            $itemsRaw = $j['AcsEvent'] ?? $j['AcsEventList'] ?? $j['Data'] ?? $j['data'] ?? [];
            // Normalize different wrappers
            if (isset($j['AcsEventList']) && is_array($j['AcsEventList']) && isset($j['AcsEventList']['AcsEvent']) && is_array($j['AcsEventList']['AcsEvent'])) {
                $itemsRaw = $j['AcsEventList']['AcsEvent'];
            }
            $logs = [];
            if (is_array($itemsRaw)) {
                foreach ($itemsRaw as $row) {
                    if (!is_array($row)) continue;
                    $du = $row['employeeNoString'] ?? $row['employeeNo'] ?? $row['cardNo'] ?? null;
                    $ct = $row['time'] ?? $row['checkTime'] ?? $row['eventTime'] ?? null;
                    if (!$du || !$ct) continue;
                    $logs[] = [
                        'device_user_id' => (string)$du,
                        'check_time' => (string)$ct,
                        'direction' => 'unknown',
                        'raw_payload' => $row
                    ];
                }
            }
            return ['success' => true, 'message' => 'تم سحب السجلات (Hikvision ISAPI).', 'items' => $logs];
        }

        return ['success' => false, 'message' => 'Driver غير مدعوم: ' . $driver, 'items' => []];
    }
}

if (!function_exists('attendance_pull_and_store')) {
    function attendance_pull_and_store($pdo, $device_id, $start_date, $end_date) {
        ensure_attendance_tables($pdo);
        $device_id = intval($device_id);
        if (!$device_id) throw new Exception('device_id required');
        if (!$start_date || !$end_date) throw new Exception('start_date and end_date required');

        $devStmt = execute_query($pdo, "SELECT * FROM attendance_devices WHERE id = ? LIMIT 1", [$device_id]);
        $device = $devStmt->fetch(PDO::FETCH_ASSOC);
        if (!$device) throw new Exception('Device not found');
        if (intval($device['enabled'] ?? 1) !== 1) throw new Exception('Device is disabled');

        $result = attendance_driver_pull_logs($device, $start_date, $end_date);
        if (!($result['success'] ?? false)) {
            return ['success' => false, 'message' => $result['message'] ?? 'Pull failed', 'inserted' => 0];
        }
        $items = $result['items'] ?? [];
        if (!is_array($items) || count($items) === 0) {
            execute_query($pdo, "UPDATE attendance_devices SET last_sync_at = NOW() WHERE id = ?", [$device_id]);
            return ['success' => true, 'message' => 'لا توجد سجلات جديدة.', 'inserted' => 0];
        }

        $insert = $pdo->prepare("INSERT INTO attendance_logs (employee_id, device_id, device_user_id, check_time, direction, source, raw_payload) VALUES (?, ?, ?, ?, ?, ?, ?)");
        $mapEmp = $pdo->prepare("SELECT employee_id FROM attendance_device_users WHERE device_id = ? AND device_user_id = ? LIMIT 1");
        $inserted = 0;
        foreach ($items as $it) {
            if (!is_array($it)) continue;
            $device_user_id = trim((string)($it['device_user_id'] ?? ''));
            $check_time = trim((string)($it['check_time'] ?? ''));
            if ($device_user_id === '' || $check_time === '') continue;

            $employee_id = null;
            try {
                $mapEmp->execute([$device_id, $device_user_id]);
                $employee_id = $mapEmp->fetchColumn() ?: null;
            } catch (Exception $e) {
                $employee_id = null;
            }

            $raw = null;
            if (isset($it['raw_payload'])) {
                $raw = json_encode($it['raw_payload']);
            } else {
                $raw = json_encode($it);
            }

            $insert->execute([
                $employee_id,
                $device_id,
                $device_user_id,
                $check_time,
                $it['direction'] ?? 'unknown',
                'pull',
                $raw
            ]);
            $inserted++;
        }

        execute_query($pdo, "UPDATE attendance_devices SET last_sync_at = NOW() WHERE id = ?", [$device_id]);
        return ['success' => true, 'message' => 'تم سحب وتخزين السجلات.', 'inserted' => $inserted];
    }
}

// -----------------------
// Workers runtime migrations
// -----------------------
if (!function_exists('ensure_workers_tables')) {
    function ensure_workers_tables($pdo) {
        try {
            if (!table_exists($pdo, 'workers')) {
                execute_query($pdo, "CREATE TABLE IF NOT EXISTS workers (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    name VARCHAR(255) NOT NULL,
                    job_title VARCHAR(100),
                    salary_type ENUM('daily','weekly','monthly','piecework') DEFAULT 'daily',
                    salary_amount DECIMAL(10,2) DEFAULT 0.00,
                    hire_date DATE,
                    phone VARCHAR(20),
                    fingerprint_no VARCHAR(50) NULL,
                    attendance_enabled TINYINT(1) DEFAULT 0,
                    default_shift_id INT DEFAULT NULL,
                    status ENUM('active','inactive','on_leave') DEFAULT 'active',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    INDEX(status),
                    INDEX(fingerprint_no),
                    INDEX(created_at)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
            } else {
                if (!column_exists($pdo, 'workers', 'fingerprint_no')) {
                    try {
                        execute_query($pdo, "ALTER TABLE workers ADD COLUMN fingerprint_no VARCHAR(50) NULL AFTER phone");
                    } catch (Exception $e) {
                        // ignore
                    }
                }

                if (!column_exists($pdo, 'workers', 'attendance_enabled')) {
                    try {
                        execute_query($pdo, "ALTER TABLE workers ADD COLUMN attendance_enabled TINYINT(1) DEFAULT 0 AFTER fingerprint_no");
                    } catch (Exception $e) {
                        // ignore
                    }
                }

                if (!column_exists($pdo, 'workers', 'default_shift_id')) {
                    try {
                        execute_query($pdo, "ALTER TABLE workers ADD COLUMN default_shift_id INT DEFAULT NULL AFTER attendance_enabled");
                    } catch (Exception $e) {
                        // ignore
                    }
                }

                try {
                    execute_query($pdo, "CREATE INDEX idx_workers_fingerprint_no ON workers (fingerprint_no)");
                } catch (Exception $e) {
                    // ignore (index may already exist)
                }
            }

            if (!table_exists($pdo, 'worker_salaries')) {
                execute_query($pdo, "CREATE TABLE IF NOT EXISTS worker_salaries (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    worker_id INT NOT NULL,
                    period_type ENUM('day','week','month','piecework') NOT NULL,
                    period_value VARCHAR(20) NOT NULL,
                    base_salary DECIMAL(10,2) NOT NULL,
                    deductions DECIMAL(10,2) DEFAULT 0.00,
                    bonuses DECIMAL(10,2) DEFAULT 0.00,
                    net_salary DECIMAL(10,2) NOT NULL,
                    status ENUM('pending','paid') DEFAULT 'pending',
                    paid_at TIMESTAMP NULL,
                    notes TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(worker_id, period_type, period_value),
                    INDEX(worker_id),
                    INDEX(period_type),
                    INDEX(period_value),
                    INDEX(status)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
            } else {
                // Ensure unique constraint exists (older DBs may miss it, causing duplicate salary rows)
                try {
                    execute_query($pdo, "ALTER TABLE worker_salaries ADD UNIQUE KEY uniq_worker_period (worker_id, period_type, period_value)");
                } catch (Exception $e) {
                    // If duplicates exist, cleanup and retry
                    try {
                        execute_query(
                            $pdo,
                            "DELETE s1 FROM worker_salaries s1
                             JOIN worker_salaries s2
                               ON s1.worker_id = s2.worker_id
                              AND s1.period_type = s2.period_type
                              AND s1.period_value = s2.period_value
                              AND s1.id < s2.id"
                        );
                        execute_query($pdo, "ALTER TABLE worker_salaries ADD UNIQUE KEY uniq_worker_period (worker_id, period_type, period_value)");
                    } catch (Exception $ex) {
                        // ignore
                    }
                }
            }

            if (!table_exists($pdo, 'worker_transactions')) {
                execute_query($pdo, "CREATE TABLE IF NOT EXISTS worker_transactions (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    worker_id INT NOT NULL,
                    amount DECIMAL(10,2) NOT NULL,
                    type ENUM('advance','bonus','penalty','piecework','salary') NOT NULL,
                    date DATE NOT NULL,
                    notes TEXT,
                    status ENUM('pending','paid','deducted') DEFAULT 'pending',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    INDEX(worker_id),
                    INDEX(date),
                    INDEX(type),
                    INDEX(status)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
            } else {
                // Ensure enum contains 'salary'
                try {
                    execute_query($pdo, "ALTER TABLE worker_transactions MODIFY COLUMN type ENUM('advance','bonus','penalty','piecework','salary') NOT NULL");
                } catch (Exception $e) {
                    // ignore
                }
            }
        } catch (Exception $e) {
            // ignore
        }
    }
}

if (!function_exists('normalize_date_ymd')) {
    function normalize_date_ymd($value) {
        if ($value === null) return null;
        $s = trim((string)$value);
        if ($s === '') return null;

        // Accept `YYYY-MM-DD` or `YYYY-MM-DD HH:MM:SS`
        if (preg_match('/^\d{4}-\d{2}-\d{2}/', $s)) {
            return substr($s, 0, 10);
        }

        // Accept `YYYY/MM/DD`
        if (preg_match('/^(\d{4})\/(\d{2})\/(\d{2})$/', $s, $m)) {
            return $m[1] . '-' . $m[2] . '-' . $m[3];
        }

        // Accept `DD-MM-YYYY` or `DD/MM/YYYY`
        if (preg_match('/^(\d{2})[-\/](\d{2})[-\/](\d{4})$/', $s, $m)) {
            return $m[3] . '-' . $m[2] . '-' . $m[1];
        }

        // Fallback: if PHP can parse it unambiguously.
        $ts = strtotime($s);
        if ($ts !== false) {
            return date('Y-m-d', $ts);
        }

        throw new Exception('Invalid date format: ' . $s);
    }
}

if (!function_exists('check_permission_or_die')) {
    function check_permission_or_die($pdo, $module_name, $action_code) {
        $user_id = $_SESSION['user_id'] ?? null;
        if (!$user_id) {
            http_response_code(401);
            echo json_encode(['success' => false, 'message' => 'Not authenticated.']);
            exit;
        }

        // Hard bypass for the built-in super admin.
        // This prevents accidental lockouts if permissions tables drift.
        if (intval($user_id) === 1) {
            return true;
        }
        try {
            $u = $_SESSION['user'] ?? null;
            $role = is_array($u) ? ($u['role'] ?? '') : '';
            if (is_string($role) && strtolower($role) === 'admin') {
                return true;
            }
        } catch (Exception $e) {
            // ignore
        }

        if (!user_has_permission($pdo, $user_id, $module_name, $action_code)) {
            http_response_code(403);
            echo json_encode(['success' => false, 'message' => 'Insufficient permissions.']);
            exit;
        }
        return true;
    }
}

function map_action_to_perm($action) {
    $a = strtolower((string)$action);
    if ($a === '') return null;
    if (strpos($a, 'get') === 0 || strpos($a, 'list') === 0 || strpos($a, 'report') !== false) return 'view';
    if (strpos($a, 'check') === 0) return 'view';
    if (strpos($a, 'create') !== false || strpos($a, 'add') !== false || strpos($a, 'import') !== false) return 'add';
    if (strpos($a, 'update') !== false || strpos($a, 'edit') !== false || strpos($a, 'status') !== false || strpos($a, 'assign') !== false || strpos($a, 'transfer') !== false || strpos($a, 'receive') !== false) return 'edit';
    if (strpos($a, 'delete') !== false || strpos($a, 'remove') !== false) return 'delete';
    return null;
}

// -----------------------
// Audit logs
// -----------------------
function ensure_audit_table($pdo) {
    $pdo->exec("CREATE TABLE IF NOT EXISTS audit_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NULL,
        module VARCHAR(100) NOT NULL,
        action VARCHAR(100) NOT NULL,
        record_id INT NULL,
        details TEXT NULL,
        ip_address VARCHAR(64) NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX(user_id),
        INDEX(module),
        INDEX(action),
        INDEX(created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
}

// -----------------------
// In-app notifications
// -----------------------
function ensure_user_notifications_table($pdo) {
    try {
        $pdo->exec("CREATE TABLE IF NOT EXISTS user_notifications (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            type VARCHAR(64) NULL,
            title VARCHAR(255) NOT NULL,
            text TEXT NULL,
            data LONGTEXT NULL,
            is_read TINYINT(1) NOT NULL DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX(user_id),
            INDEX(is_read),
            INDEX(created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    } catch (Exception $e) {
        // ignore
    }
}

function audit_log($pdo, $module, $action, $record_id = null, $details = null) {
    try {
        ensure_audit_table($pdo);
        $uid = $_SESSION['user_id'] ?? null;
        $ip = $_SERVER['REMOTE_ADDR'] ?? null;
        $stmt = $pdo->prepare("INSERT INTO audit_logs (user_id, module, action, record_id, details, ip_address) VALUES (?, ?, ?, ?, ?, ?)");
        $stmt->execute([$uid, $module, $action, $record_id, $details, $ip]);
    } catch (Exception $e) {
        // avoid breaking main flow
    }
}

function can_manage_permissions($pdo) {
    if (!($pdo instanceof PDO)) return false;
    $current_user = $_SESSION['user_id'] ?? null;
    if (!$current_user) return false;

    // Admin users can manage permissions by default
    try {
        $u = $_SESSION['user'] ?? null;
        $role = is_array($u) ? ($u['role'] ?? '') : '';
        if (is_string($role) && strtolower($role) === 'admin') return true;
    } catch (Exception $e) {
        // ignore
    }

    // Allow if user has explicit page access to admin/permissions
    try {
        $stmt = execute_query($pdo, "SELECT can_access FROM user_page_permissions WHERE user_id = ? AND page_slug IN ('admin','permissions')", [$current_user]);
        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
            if (isset($row['can_access']) && (int)$row['can_access'] === 1) return true;
        }
    } catch (Exception $e) {
        // ignore
    }

    // Allow if user has explicit permissions module access
    if (user_has_permission($pdo, $current_user, 'permissions', 'view') ||
        user_has_permission($pdo, $current_user, 'permissions', 'add') ||
        user_has_permission($pdo, $current_user, 'permissions', 'edit') ||
        user_has_permission($pdo, $current_user, 'permissions', 'delete')) {
        return true;
    }
    return false;
}

// Get user defaults (warehouse/treasury + change flags). If no user_id provided, use current session user.
function get_user_defaults($pdo, $user_id = null) {
    $uid = $user_id ?: ($_SESSION['user_id'] ?? 0);
    if (!$uid) return null;
    try {
        $stmt = execute_query($pdo, "SELECT user_id, default_warehouse_id, default_treasury_id, can_change_warehouse, can_change_treasury FROM user_defaults WHERE user_id = ? LIMIT 1", [$uid]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$row) return null;
        // Normalize booleans
        $row['can_change_warehouse'] = isset($row['can_change_warehouse']) ? boolval($row['can_change_warehouse']) : true;
        $row['can_change_treasury'] = isset($row['can_change_treasury']) ? boolval($row['can_change_treasury']) : true;
        return $row;
    } catch (Exception $e) {
        return null;
    }
}

function log_order_history($pdo, $order_id, $status, $action, $notes = null, $rep_id = null) {
    if (!table_exists($pdo, 'order_status_history')) return;
    $current_user = $_SESSION['user_id'] ?? null;
    try {
        execute_query(
            $pdo,
            "INSERT INTO order_status_history (order_id, status, action, notes, rep_id, created_by) VALUES (?, ?, ?, ?, ?, ?)",
            [$order_id, $status, $action, $notes, $rep_id, $current_user]
        );
    } catch (Exception $e) {
        // ignore to avoid breaking order flow when lifecycle table is missing
    }
}

// ── Helper: ensure rep_journal_orders table exists ──
function ensure_rep_journal_orders_table($pdo) {
    execute_query($pdo, "CREATE TABLE IF NOT EXISTS rep_journal_orders (
        id          INT AUTO_INCREMENT PRIMARY KEY,
        journal_id  INT NULL,
        rep_id      INT NOT NULL,
        order_id    INT NOT NULL,
        status      VARCHAR(32) NOT NULL DEFAULT 'with_rep',
        event_date  DATE NOT NULL,
        event_time  TIME NOT NULL,
        employee    VARCHAR(255) NULL,
        notes       TEXT NULL,
        returned_pieces INT DEFAULT 0,
        returned_value  DECIMAL(14,2) DEFAULT 0,
        created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    if (!column_exists($pdo, 'rep_journal_orders', 'returned_pieces')) execute_query($pdo, "ALTER TABLE rep_journal_orders ADD COLUMN returned_pieces INT DEFAULT 0");
    if (!column_exists($pdo, 'rep_journal_orders', 'returned_value')) execute_query($pdo, "ALTER TABLE rep_journal_orders ADD COLUMN returned_value DECIMAL(14,2) DEFAULT 0");
    // Add unique key if missing (best-effort)
    try { $pdo->exec("ALTER TABLE rep_journal_orders ADD UNIQUE KEY uk_rep_order (rep_id, order_id)"); } catch (Exception $ex) {}
}

function ensure_rep_daily_journal_table($pdo) {
    try { execute_query($pdo, "ALTER TABLE rep_daily_journal DROP INDEX rep_date_unique"); } catch (Exception $ex) {}
    try { $pdo->exec("ALTER TABLE rep_daily_journal DROP INDEX rep_date_unique"); } catch (Exception $ex) {}
    execute_query($pdo, "CREATE TABLE IF NOT EXISTS rep_daily_journal (
        id INT AUTO_INCREMENT PRIMARY KEY,
        rep_id INT NOT NULL,
        session_seq INT DEFAULT 1,
        journal_date DATE NOT NULL,
        opening_amount DECIMAL(14,2) DEFAULT 0,
        opening_orders_count INT DEFAULT 0,
        opening_pieces_count INT DEFAULT 0,
        orders_received_count INT DEFAULT 0,
        pieces_received INT DEFAULT 0,
        orders_delivered_count INT DEFAULT 0,
        pieces_delivered INT DEFAULT 0,
        delivered_value DECIMAL(14,2) DEFAULT 0,
        orders_returned_count INT DEFAULT 0,
        pieces_returned INT DEFAULT 0,
        returned_value DECIMAL(14,2) DEFAULT 0,
        orders_postponed_count INT DEFAULT 0,
        pieces_postponed INT DEFAULT 0,
        postponed_value DECIMAL(14,2) DEFAULT 0,
        transactions TEXT NULL,
        closing_amount DECIMAL(14,2) DEFAULT 0,
        notes TEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    if (!column_exists($pdo, 'rep_daily_journal', 'session_seq'))            execute_query($pdo, "ALTER TABLE rep_daily_journal ADD COLUMN session_seq INT DEFAULT 1");
    if (!column_exists($pdo, 'rep_daily_journal', 'employee'))               execute_query($pdo, "ALTER TABLE rep_daily_journal ADD COLUMN employee VARCHAR(255) NULL");
    if (!column_exists($pdo, 'rep_daily_journal', 'page'))                   execute_query($pdo, "ALTER TABLE rep_daily_journal ADD COLUMN page VARCHAR(255) NULL");
    if (!column_exists($pdo, 'rep_daily_journal', 'treasury_id'))            execute_query($pdo, "ALTER TABLE rep_daily_journal ADD COLUMN treasury_id INT NULL");
    if (!column_exists($pdo, 'rep_daily_journal', 'warehouse_id'))           execute_query($pdo, "ALTER TABLE rep_daily_journal ADD COLUMN warehouse_id INT NULL");
    if (!column_exists($pdo, 'rep_daily_journal', 'prev_balance'))           execute_query($pdo, "ALTER TABLE rep_daily_journal ADD COLUMN prev_balance DECIMAL(14,2) DEFAULT 0");
    if (!column_exists($pdo, 'rep_daily_journal', 'old_orders_value'))       execute_query($pdo, "ALTER TABLE rep_daily_journal ADD COLUMN old_orders_value DECIMAL(14,2) DEFAULT 0");
    if (!column_exists($pdo, 'rep_daily_journal', 'orders_assigned_count'))  execute_query($pdo, "ALTER TABLE rep_daily_journal ADD COLUMN orders_assigned_count INT DEFAULT 0");
    if (!column_exists($pdo, 'rep_daily_journal', 'pieces_assigned_count'))  execute_query($pdo, "ALTER TABLE rep_daily_journal ADD COLUMN pieces_assigned_count INT DEFAULT 0");
    if (!column_exists($pdo, 'rep_daily_journal', 'assigned_value'))         execute_query($pdo, "ALTER TABLE rep_daily_journal ADD COLUMN assigned_value DECIMAL(14,2) DEFAULT 0");
    if (!column_exists($pdo, 'rep_daily_journal', 'total_orders_count'))     execute_query($pdo, "ALTER TABLE rep_daily_journal ADD COLUMN total_orders_count INT DEFAULT 0");
    if (!column_exists($pdo, 'rep_daily_journal', 'total_pieces_count'))     execute_query($pdo, "ALTER TABLE rep_daily_journal ADD COLUMN total_pieces_count INT DEFAULT 0");
    if (!column_exists($pdo, 'rep_daily_journal', 'total_orders_value'))     execute_query($pdo, "ALTER TABLE rep_daily_journal ADD COLUMN total_orders_value DECIMAL(14,2) DEFAULT 0");
    if (!column_exists($pdo, 'rep_daily_journal', 'final_before_payment'))   execute_query($pdo, "ALTER TABLE rep_daily_journal ADD COLUMN final_before_payment DECIMAL(14,2) DEFAULT 0");
    if (!column_exists($pdo, 'rep_daily_journal', 'payment_action'))         execute_query($pdo, "ALTER TABLE rep_daily_journal ADD COLUMN payment_action VARCHAR(32) NULL");
    if (!column_exists($pdo, 'rep_daily_journal', 'payment_amount'))         execute_query($pdo, "ALTER TABLE rep_daily_journal ADD COLUMN payment_amount DECIMAL(14,2) DEFAULT 0");
    if (!column_exists($pdo, 'rep_daily_journal', 'balance_after_payment'))  execute_query($pdo, "ALTER TABLE rep_daily_journal ADD COLUMN balance_after_payment DECIMAL(14,2) DEFAULT 0");
    if (!column_exists($pdo, 'rep_daily_journal', 'orders_json'))            execute_query($pdo, "ALTER TABLE rep_daily_journal ADD COLUMN orders_json TEXT NULL");
    if (!column_exists($pdo, 'rep_daily_journal', 'daily_code'))             execute_query($pdo, "ALTER TABLE rep_daily_journal ADD COLUMN daily_code VARCHAR(20) NULL");
    if (!column_exists($pdo, 'rep_daily_journal', 'is_closed'))              execute_query($pdo, "ALTER TABLE rep_daily_journal ADD COLUMN is_closed TINYINT(1) NOT NULL DEFAULT 0");
}

function ensure_order_confirmation_assignments_table($pdo) {
    execute_query($pdo, "CREATE TABLE IF NOT EXISTS order_confirmation_assignments (
        id INT AUTO_INCREMENT PRIMARY KEY,
        order_id INT NOT NULL,
        rep_id INT NOT NULL,
        assigned_by INT NULL,
        notes TEXT NULL,
        status VARCHAR(32) NOT NULL DEFAULT 'assigned',
        assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uk_order_confirmation_order (order_id),
        KEY idx_order_confirmation_rep_status (rep_id, status),
        KEY idx_order_confirmation_status (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    if (!column_exists($pdo, 'order_confirmation_assignments', 'assigned_by')) execute_query($pdo, "ALTER TABLE order_confirmation_assignments ADD COLUMN assigned_by INT NULL");
    if (!column_exists($pdo, 'order_confirmation_assignments', 'notes')) execute_query($pdo, "ALTER TABLE order_confirmation_assignments ADD COLUMN notes TEXT NULL");
    if (!column_exists($pdo, 'order_confirmation_assignments', 'status')) execute_query($pdo, "ALTER TABLE order_confirmation_assignments ADD COLUMN status VARCHAR(32) NOT NULL DEFAULT 'assigned'");
    if (!column_exists($pdo, 'order_confirmation_assignments', 'assigned_at')) execute_query($pdo, "ALTER TABLE order_confirmation_assignments ADD COLUMN assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP");
    if (!column_exists($pdo, 'order_confirmation_assignments', 'updated_at')) execute_query($pdo, "ALTER TABLE order_confirmation_assignments ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP");
    try { $pdo->exec("ALTER TABLE order_confirmation_assignments ADD UNIQUE KEY uk_order_confirmation_order (order_id)"); } catch (Exception $ex) {}
}

function confirmation_allowed_order_statuses() {
    return [];
}

function confirmation_is_allowed_order_status($status) {
    $normalized = strtolower(trim((string)$status));
    if ($normalized === '' || $normalized === 'delivered' || $normalized === 'with_rep') return false;
    return true;
}

function confirmation_get_rep_name(PDO $pdo, $repId) {
    $repId = intval($repId);
    if ($repId <= 0) return '';
    $repName = execute_query($pdo, "SELECT COALESCE(NULLIF(TRIM(name), ''), CONCAT('مندوب #', id)) AS rep_name FROM users WHERE id = ? LIMIT 1", [$repId])->fetchColumn();
    return $repName ? trim((string)$repName) : ('مندوب #' . $repId);
}

function confirmation_describe_blocked_order_status(PDO $pdo, array $order) {
    $orderStatus = strtolower(trim((string)($order['status'] ?? '')));
    if ($orderStatus === 'with_rep') {
        $orderId = intval($order['id'] ?? 0);
        $repId = intval($order['rep_id'] ?? 0);
        $repName = $repId > 0 ? confirmation_get_rep_name($pdo, $repId) : '';

        $assignment = $orderId > 0 ? confirmation_fetch_assignment_row($pdo, $orderId) : null;
        if ($assignment && ($assignment['status'] ?? '') === 'assigned') {
            $assignmentRepName = trim((string)($assignment['rep_name'] ?? ''));
            if ($assignmentRepName !== '') $repName = $assignmentRepName;
            return 'الأوردر حالته مع المندوب' . ($repName !== '' ? ' ' . $repName : '') . ' وهو في انتظار تأكيد المندوب.';
        }

        if ($orderId > 0 && table_exists($pdo, 'rep_journal_orders')) {
            $journalRow = execute_query(
                $pdo,
                "SELECT rjo.rep_id,
                        COALESCE(NULLIF(TRIM(u.name), ''), CONCAT('مندوب #', rjo.rep_id)) AS rep_name,
                        rdj.is_closed,
                        rdj.daily_code
                 FROM rep_journal_orders rjo
                 LEFT JOIN users u ON u.id = rjo.rep_id
                 LEFT JOIN rep_daily_journal rdj ON rdj.id = rjo.journal_id
                 WHERE rjo.order_id = ?
                 ORDER BY rjo.id DESC
                 LIMIT 1",
                [$orderId]
            )->fetch(PDO::FETCH_ASSOC);

            if ($journalRow) {
                $journalRepName = trim((string)($journalRow['rep_name'] ?? ''));
                if ($journalRepName !== '') $repName = $journalRepName;
                $isClosed = intval($journalRow['is_closed'] ?? 0) === 1;
                if (!$isClosed) {
                    return 'الأوردر حالته مع المندوب' . ($repName !== '' ? ' ' . $repName : '') . ' وهو موجود حالياً في يومية المندوب.';
                }
            }
        }

        return 'الأوردر حالته مع المندوب' . ($repName !== '' ? ' ' . $repName : '') . ' وهو في انتظار تأكيد المندوب.';
    }

    $statusMap = [
        'pending' => 'قيد الانتظار',
        'returned' => 'مرتجع',
        'confirmed' => 'مؤكد',
        'cancelled' => 'ملغي',
        'postponed' => 'مؤجل',
        'in_delivery' => 'قيد التسليم',
        'delivered' => 'تم التسليم',
        'partial' => 'مرتجع جزئي',
    ];
    $statusLabel = $statusMap[$orderStatus] ?? $orderStatus;
    return 'لا يمكن تأكيد هذا الأوردر نظراً لحالته الحالية: ' . $statusLabel;
}

function confirmation_fetch_order_by_barcode(PDO $pdo, $barcode) {
    $barcode = trim((string)$barcode);
    if ($barcode === '') return null;

    $order = null;
    if (preg_match('/^\d+$/', $barcode)) {
        $order = execute_query(
            $pdo,
            "SELECT id, order_number, status, rep_id, total_amount, shipping_fees, notes, created_at
             FROM orders WHERE order_number = ? LIMIT 1",
            [$barcode]
        )->fetch(PDO::FETCH_ASSOC);
        if (!$order) {
            $order = execute_query(
                $pdo,
                "SELECT id, order_number, status, rep_id, total_amount, shipping_fees, notes, created_at
                 FROM orders WHERE id = ? LIMIT 1",
                [intval($barcode)]
            )->fetch(PDO::FETCH_ASSOC);
        }
    }

    if (!$order && table_exists($pdo, 'product_variants') && column_exists($pdo, 'product_variants', 'barcode')) {
        $order = execute_query(
            $pdo,
            "SELECT DISTINCT o.id, o.order_number, o.status, o.rep_id, o.total_amount, o.shipping_fees, o.notes, o.created_at
             FROM orders o
             JOIN order_items oi ON oi.order_id = o.id
             JOIN product_variants pv ON pv.id = oi.product_id
             WHERE pv.barcode = ?
             ORDER BY o.id DESC
             LIMIT 1",
            [$barcode]
        )->fetch(PDO::FETCH_ASSOC);
    }

    return $order ?: null;
}

function confirmation_fetch_assignment_row(PDO $pdo, $orderId) {
    ensure_order_confirmation_assignments_table($pdo);
    return execute_query(
        $pdo,
        "SELECT oca.*, COALESCE(NULLIF(TRIM(u.name), ''), CONCAT('مندوب #', oca.rep_id)) AS rep_name
         FROM order_confirmation_assignments oca
         LEFT JOIN users u ON u.id = oca.rep_id
         WHERE oca.order_id = ?
         ORDER BY oca.id DESC
         LIMIT 1",
        [intval($orderId)]
    )->fetch(PDO::FETCH_ASSOC) ?: null;
}

function confirmation_clear_old_assignments(PDO $pdo): void {
    ensure_order_confirmation_assignments_table($pdo);
    execute_query(
        $pdo,
        "DELETE FROM order_confirmation_assignments WHERE DATE(assigned_at) < CURDATE()"
    );
}

function confirmation_get_today_assigned_order_ids(PDO $pdo, array $excludeOrderIds = []): array {
    ensure_order_confirmation_assignments_table($pdo);

    $excludeOrderIds = array_values(array_unique(array_filter(array_map('intval', $excludeOrderIds), function($id) {
        return $id > 0;
    })));

    $params = [];
    $sql = "SELECT order_id
            FROM order_confirmation_assignments
            WHERE status = 'assigned' AND DATE(assigned_at) = CURDATE()";

    if (!empty($excludeOrderIds)) {
        $placeholders = implode(',', array_fill(0, count($excludeOrderIds), '?'));
        $sql .= " AND order_id NOT IN ($placeholders)";
        $params = $excludeOrderIds;
    }

    $rows = execute_query($pdo, $sql, $params)->fetchAll(PDO::FETCH_COLUMN);
    return array_values(array_unique(array_filter(array_map('intval', $rows ?: []), function($id) {
        return $id > 0;
    })));
}

function confirmation_format_order_payload(PDO $pdo, $orderId) {
    $rows = nexus_fetch_orders_by_ids($pdo, strval(intval($orderId)));
    return !empty($rows) ? $rows[0] : ['id' => intval($orderId)];
}

function confirmation_collect_order_requirements(PDO $pdo, array $orderIds): array {
    $orderIds = array_values(array_unique(array_filter(array_map('intval', $orderIds), function($id){ return $id > 0; })));
    if (empty($orderIds) || !table_exists($pdo, 'order_items')) return [];

    $placeholders = implode(',', array_fill(0, count($orderIds), '?'));
    $hasVariants = table_exists($pdo, 'product_variants');

    if ($hasVariants) {
        $sql = "SELECT oi.product_id,
                       COALESCE(ppar.name, pv.name, CONCAT('منتج #', oi.product_id)) AS product_name,
                       COALESCE(pv.color, '') AS color,
                       COALESCE(pv.size, '') AS size,
                       COALESCE(SUM(oi.quantity),0) AS required_qty
                FROM order_items oi
                LEFT JOIN product_variants pv ON pv.id = oi.product_id
                LEFT JOIN products ppar ON ppar.id = pv.product_id
                WHERE oi.order_id IN ($placeholders)
                GROUP BY oi.product_id, COALESCE(ppar.name, pv.name, CONCAT('منتج #', oi.product_id)), COALESCE(pv.color, ''), COALESCE(pv.size, '')
                ORDER BY product_name ASC";
    } else {
        $colColor = column_exists($pdo, 'products', 'color') ? 'COALESCE(p.color, \"\")' : "''";
        $colSize = column_exists($pdo, 'products', 'size') ? 'COALESCE(p.size, \"\")' : "''";
        $sql = "SELECT oi.product_id,
                       COALESCE(p.name, CONCAT('منتج #', oi.product_id)) AS product_name,
                       {$colColor} AS color,
                       {$colSize} AS size,
                       COALESCE(SUM(oi.quantity),0) AS required_qty
                FROM order_items oi
                LEFT JOIN products p ON p.id = oi.product_id
                WHERE oi.order_id IN ($placeholders)
                GROUP BY oi.product_id, COALESCE(p.name, CONCAT('منتج #', oi.product_id)), {$colColor}, {$colSize}
                ORDER BY product_name ASC";
    }

    $rows = execute_query($pdo, $sql, $orderIds)->fetchAll(PDO::FETCH_ASSOC);
    $result = [];
    foreach ($rows as $row) {
        $pid = intval($row['product_id'] ?? 0);
        $requiredQty = intval($row['required_qty'] ?? 0);
        if ($pid <= 0 || $requiredQty <= 0) continue;
        $result[] = [
            'product_id' => $pid,
            'product_name' => $row['product_name'] ?? ('منتج #' . $pid),
            'color' => trim((string)($row['color'] ?? '')),
            'size' => trim((string)($row['size'] ?? '')),
            'required_qty' => $requiredQty,
        ];
    }
    return $result;
}

function confirmation_validate_stock_for_orders(PDO $pdo, int $warehouseId, array $orderIds): array {
    if ($warehouseId <= 0) {
        return ['success' => false, 'message' => 'يجب اختيار المخزن أولاً.', 'items' => [], 'shortages' => []];
    }
    if (!table_exists($pdo, 'stock')) {
        return ['success' => false, 'message' => 'لا يمكن التحقق من المخزون لأن جدول stock غير موجود.', 'items' => [], 'shortages' => []];
    }

    $requirements = confirmation_collect_order_requirements($pdo, $orderIds);
    if (empty($requirements)) {
        return ['success' => true, 'message' => 'لا توجد منتجات تحتاج فحص مخزون.', 'items' => [], 'shortages' => []];
    }

    $productIds = array_values(array_unique(array_map(function($r){ return intval($r['product_id'] ?? 0); }, $requirements)));
    $stockByProduct = [];
    if (!empty($productIds)) {
        $placeholders = implode(',', array_fill(0, count($productIds), '?'));
        $params = array_merge([$warehouseId], $productIds);
        $stockRows = execute_query(
            $pdo,
            "SELECT product_id, COALESCE(quantity,0) AS quantity
             FROM stock
             WHERE warehouse_id = ? AND product_id IN ($placeholders)",
            $params
        )->fetchAll(PDO::FETCH_ASSOC);
        foreach ($stockRows as $stockRow) {
            $stockByProduct[intval($stockRow['product_id'] ?? 0)] = intval($stockRow['quantity'] ?? 0);
        }
    }

    $items = [];
    $shortages = [];
    foreach ($requirements as $req) {
        $pid = intval($req['product_id'] ?? 0);
        $requiredQty = intval($req['required_qty'] ?? 0);
        $availableQty = intval($stockByProduct[$pid] ?? 0);
        $shortageQty = max(0, $requiredQty - $availableQty);

        $row = [
            'product_id' => $pid,
            'product_name' => $req['product_name'] ?? ('منتج #' . $pid),
            'color' => $req['color'] ?? '',
            'size' => $req['size'] ?? '',
            'required_qty' => $requiredQty,
            'available_qty' => $availableQty,
            'shortage_qty' => $shortageQty,
        ];
        $items[] = $row;
        if ($shortageQty > 0) $shortages[] = $row;
    }

    return [
        'success' => true,
        'message' => empty($shortages) ? 'المخزون كافٍ.' : 'المخزون غير كافٍ لبعض المنتجات.',
        'items' => $items,
        'shortages' => $shortages,
    ];
}

function refresh_rep_daily_journal_status_counts($pdo, $journalId) {
    $journalId = intval($journalId);
    if ($journalId <= 0) return;
    ensure_rep_daily_journal_table($pdo);
    ensure_rep_journal_orders_table($pdo);

    $rows = execute_query($pdo,
        "SELECT status, COUNT(*) AS orders_count
         FROM rep_journal_orders
         WHERE journal_id = ?
         GROUP BY status",
        [$journalId]
    )->fetchAll(PDO::FETCH_ASSOC);

    $deliveredCount = 0;
    $returnedCount = 0;
    $deferredCount = 0;
    foreach ($rows as $row) {
        $status = trim(strval($row['status'] ?? ''));
        $count = intval($row['orders_count'] ?? 0);
        if ($status === 'delivered') $deliveredCount += $count;
        elseif ($status === 'deferred') $deferredCount += $count;
        elseif ($status === 'full_return' || $status === 'partial_return') $returnedCount += $count;
    }

    execute_query($pdo,
        "UPDATE rep_daily_journal
         SET orders_delivered_count = ?,
             orders_postponed_count = ?,
             orders_returned_count = ?
         WHERE id = ?",
        [$deliveredCount, $deferredCount, $returnedCount, $journalId]
    );
}

function attendance_get_shift($pdo, $employee_id, $work_date) {
    $dow = intval(date('w', strtotime($work_date)));
    $stmt = execute_query(
        $pdo,
        "SELECT s.* FROM attendance_schedules sch JOIN attendance_shifts s ON s.id = sch.shift_id WHERE sch.employee_id = ? AND sch.day_of_week = ? AND (sch.valid_from IS NULL OR sch.valid_from <= ?) AND (sch.valid_to IS NULL OR sch.valid_to >= ?) ORDER BY sch.id DESC LIMIT 1",
        [$employee_id, $dow, $work_date, $work_date]
    );
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    if ($row) return $row;

    $defaultStmt = execute_query($pdo, "SELECT default_shift_id FROM employees WHERE id = ? LIMIT 1", [$employee_id]);
    $defaultId = $defaultStmt->fetchColumn();
    if ($defaultId) {
        $shiftStmt = execute_query($pdo, "SELECT * FROM attendance_shifts WHERE id = ? LIMIT 1", [$defaultId]);
        return $shiftStmt->fetch(PDO::FETCH_ASSOC) ?: null;
    }
    return null;
}

function attendance_is_holiday($pdo, $work_date) {
    $stmt = execute_query($pdo, "SELECT id FROM attendance_holidays WHERE holiday_date = ? LIMIT 1", [$work_date]);
    return $stmt->fetchColumn() ? true : false;
}

function attendance_is_weekly_off($shift, $work_date) {
    if (!$shift) return false;
    $daysRaw = trim((string)($shift['weekly_off_days'] ?? ''));
    if ($daysRaw === '') return false;
    $dayList = array_filter(array_map('trim', explode(',', $daysRaw)), function($v){ return $v !== ''; });
    if (count($dayList) === 0) return false;
    $dow = date('w', strtotime($work_date));
    foreach ($dayList as $d) {
        if ($d === (string)$dow) return true;
        if (is_numeric($d) && intval($d) === intval($dow)) return true;
    }
    return false;
}

function attendance_calculate_summary($pdo, $employee_id, $work_date, $shift) {
    $startTime = $shift['start_time'];
    $endTime = $shift['end_time'];
    $isNight = intval($shift['is_night_shift'] ?? 0) === 1;

    $startDateTime = new DateTime($work_date . ' ' . $startTime);
    $endDateTime = new DateTime($work_date . ' ' . $endTime);
    if ($isNight || $endDateTime <= $startDateTime) {
        $endDateTime->modify('+1 day');
    }

    $stmt = execute_query(
        $pdo,
        "SELECT MIN(check_time) as first_in, MAX(check_time) as last_out FROM attendance_logs WHERE employee_id = ? AND check_time BETWEEN ? AND ?",
        [$employee_id, $startDateTime->format('Y-m-d H:i:s'), $endDateTime->format('Y-m-d H:i:s')]
    );
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    $firstIn = $row['first_in'] ?? null;
    $lastOut = $row['last_out'] ?? null;

    $lateMinutes = 0;
    $earlyMinutes = 0;
    $overtimeMinutes = 0;

    if ($firstIn) {
        $firstInDt = new DateTime($firstIn);
        $graceIn = intval($shift['grace_in_minutes'] ?? 0);
        $shiftStart = clone $startDateTime;
        $shiftStart->modify('+' . $graceIn . ' minutes');
        if ($firstInDt > $shiftStart) {
            $lateMinutes = intval(($firstInDt->getTimestamp() - $shiftStart->getTimestamp()) / 60);
        }
    }

    if ($lastOut) {
        $lastOutDt = new DateTime($lastOut);
        $graceOut = intval($shift['grace_out_minutes'] ?? 0);
        $shiftEnd = clone $endDateTime;
        $shiftEnd->modify('-' . $graceOut . ' minutes');
        if ($lastOutDt < $shiftEnd) {
            $earlyMinutes = intval(($shiftEnd->getTimestamp() - $lastOutDt->getTimestamp()) / 60);
        }
        if ($lastOutDt > $endDateTime) {
            $overtimeMinutes = intval(($lastOutDt->getTimestamp() - $endDateTime->getTimestamp()) / 60);
        }
    }

    $hasLogs = !empty($firstIn) || !empty($lastOut);
    $status = 'present';
    $isAbsent = 0;
    if (!$hasLogs) {
        $status = 'absent';
        $isAbsent = 1;
    } elseif ($lateMinutes > 0) {
        $status = 'late';
    }

    return [
        'first_in' => $firstIn,
        'last_out' => $lastOut,
        'late_minutes' => $lateMinutes,
        'early_leave_minutes' => $earlyMinutes,
        'overtime_minutes' => $overtimeMinutes,
        'is_absent' => $isAbsent,
        'status' => $status
    ];
}

function attendance_generate_summary_range($pdo, $start, $end) {
    if (!$start || !$end) {
        throw new Exception('start_date and end_date required.');
    }

    $employeesStmt = execute_query($pdo, "SELECT id FROM employees WHERE status = 'active' AND attendance_enabled = 1");
    $employees = $employeesStmt->fetchAll(PDO::FETCH_ASSOC);

    $startDt = new DateTime($start);
    $endDt = new DateTime($end);
    $endDt->setTime(0, 0, 0);

    $upsert = $pdo->prepare("INSERT INTO attendance_daily_summary (employee_id, shift_id, work_date, first_in, last_out, late_minutes, early_leave_minutes, overtime_minutes, is_absent, status, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW()) ON DUPLICATE KEY UPDATE shift_id = VALUES(shift_id), first_in = VALUES(first_in), last_out = VALUES(last_out), late_minutes = VALUES(late_minutes), early_leave_minutes = VALUES(early_leave_minutes), overtime_minutes = VALUES(overtime_minutes), is_absent = VALUES(is_absent), status = VALUES(status), updated_at = NOW()");

    foreach ($employees as $emp) {
        $cursor = clone $startDt;
        while ($cursor <= $endDt) {
            $work_date = $cursor->format('Y-m-d');
            if (attendance_is_holiday($pdo, $work_date)) {
                $upsert->execute([$emp['id'], null, $work_date, null, null, 0, 0, 0, 0, 'holiday']);
                $cursor->modify('+1 day');
                continue;
            }

            $shift = attendance_get_shift($pdo, $emp['id'], $work_date);
            if (!$shift) {
                $cursor->modify('+1 day');
                continue;
            }
            $summary = attendance_calculate_summary($pdo, $emp['id'], $work_date, $shift);
            if (attendance_is_weekly_off($shift, $work_date) && intval($summary['is_absent'] ?? 0) === 1) {
                $summary['is_absent'] = 0;
                $summary['status'] = 'holiday';
            }
            $upsert->execute([
                $emp['id'],
                $shift['id'],
                $work_date,
                $summary['first_in'],
                $summary['last_out'],
                $summary['late_minutes'],
                $summary['early_leave_minutes'],
                $summary['overtime_minutes'],
                $summary['is_absent'],
                $summary['status']
            ]);
            $cursor->modify('+1 day');
        }
    }

    return true;
}

function attendance_get_worker_shift($pdo, $worker_id, $work_date) {
    // For workers: use default_shift_id on workers table (minimal, no per-day schedules yet)
    try {
        if (!table_exists($pdo, 'workers')) return null;
        $defaultStmt = execute_query($pdo, "SELECT default_shift_id FROM workers WHERE id = ? LIMIT 1", [$worker_id]);
        $defaultId = $defaultStmt->fetchColumn();
        if ($defaultId) {
            $shiftStmt = execute_query($pdo, "SELECT * FROM attendance_shifts WHERE id = ? LIMIT 1", [$defaultId]);
            return $shiftStmt->fetch(PDO::FETCH_ASSOC) ?: null;
        }
    } catch (Exception $e) {
        // ignore
    }
    return null;
}

function attendance_calculate_worker_summary($pdo, $worker_id, $work_date, $shift) {
    // Similar to employee summary, but worker punch selection uses worker-device mapping when possible.
    $startTime = $shift['start_time'];
    $endTime = $shift['end_time'];
    $isNight = intval($shift['is_night_shift'] ?? 0) === 1;

    $startDateTime = new DateTime($work_date . ' ' . $startTime);
    $endDateTime = new DateTime($work_date . ' ' . $endTime);
    if ($isNight || $endDateTime <= $startDateTime) {
        $endDateTime->modify('+1 day');
    }

    $params = [$worker_id, $startDateTime->format('Y-m-d H:i:s'), $endDateTime->format('Y-m-d H:i:s')];
    $sql = "SELECT MIN(l.check_time) as first_in, MAX(l.check_time) as last_out
            FROM attendance_logs l
            JOIN attendance_device_workers mw ON mw.device_id = l.device_id AND mw.device_user_id = l.device_user_id
            WHERE mw.worker_id = ? AND l.check_time BETWEEN ? AND ?";
    $firstIn = null; $lastOut = null;
    try {
        if (table_exists($pdo, 'attendance_device_workers')) {
            $stmt = execute_query($pdo, $sql, $params);
            $row = $stmt->fetch(PDO::FETCH_ASSOC);
            $firstIn = $row['first_in'] ?? null;
            $lastOut = $row['last_out'] ?? null;
        }
    } catch (Exception $e) {
        $firstIn = null; $lastOut = null;
    }

    // Fallback: use workers.fingerprint_no (legacy)
    if (!$firstIn && !$lastOut) {
        try {
            $fp = execute_query($pdo, "SELECT fingerprint_no FROM workers WHERE id = ? LIMIT 1", [$worker_id])->fetchColumn();
            $fp = trim((string)$fp);
            if ($fp !== '') {
                $stmt = execute_query(
                    $pdo,
                    "SELECT MIN(check_time) as first_in, MAX(check_time) as last_out FROM attendance_logs WHERE device_user_id = ? AND check_time BETWEEN ? AND ?",
                    [$fp, $startDateTime->format('Y-m-d H:i:s'), $endDateTime->format('Y-m-d H:i:s')]
                );
                $row = $stmt->fetch(PDO::FETCH_ASSOC);
                $firstIn = $row['first_in'] ?? null;
                $lastOut = $row['last_out'] ?? null;
            }
        } catch (Exception $e) {
            // ignore
        }
    }

    $lateMinutes = 0;
    $earlyMinutes = 0;
    $overtimeMinutes = 0;

    if ($firstIn) {
        $firstInDt = new DateTime($firstIn);
        $graceIn = intval($shift['grace_in_minutes'] ?? 0);
        $shiftStart = clone $startDateTime;
        $shiftStart->modify('+' . $graceIn . ' minutes');
        if ($firstInDt > $shiftStart) {
            $lateMinutes = intval(($firstInDt->getTimestamp() - $shiftStart->getTimestamp()) / 60);
        }
    }

    if ($lastOut) {
        $lastOutDt = new DateTime($lastOut);
        $graceOut = intval($shift['grace_out_minutes'] ?? 0);
        $shiftEnd = clone $endDateTime;
        $shiftEnd->modify('-' . $graceOut . ' minutes');
        if ($lastOutDt < $shiftEnd) {
            $earlyMinutes = intval(($shiftEnd->getTimestamp() - $lastOutDt->getTimestamp()) / 60);
        }
        if ($lastOutDt > $endDateTime) {
            $overtimeMinutes = intval(($lastOutDt->getTimestamp() - $endDateTime->getTimestamp()) / 60);
        }
    }

    $hasLogs = !empty($firstIn) || !empty($lastOut);
    $status = 'present';
    $isAbsent = 0;
    if (!$hasLogs) {
        $status = 'absent';
        $isAbsent = 1;
    } elseif ($lateMinutes > 0) {
        $status = 'late';
    }

    return [
        'first_in' => $firstIn,
        'last_out' => $lastOut,
        'late_minutes' => $lateMinutes,
        'early_leave_minutes' => $earlyMinutes,
        'overtime_minutes' => $overtimeMinutes,
        'is_absent' => $isAbsent,
        'status' => $status
    ];
}

function attendance_generate_worker_summary_range($pdo, $start, $end) {
    if (!$start || !$end) {
        throw new Exception('start_date and end_date required.');
    }
    ensure_workers_tables($pdo);
    ensure_attendance_tables($pdo);

    // Only workers with attendance_enabled=1 (if column exists), else all active
    $hasAttendanceEnabled = column_exists($pdo, 'workers', 'attendance_enabled');
    $sql = $hasAttendanceEnabled
        ? "SELECT id FROM workers WHERE status = 'active' AND attendance_enabled = 1"
        : "SELECT id FROM workers WHERE status = 'active'";
    $workersStmt = execute_query($pdo, $sql);
    $workers = $workersStmt->fetchAll(PDO::FETCH_ASSOC);

    $startDt = new DateTime($start);
    $endDt = new DateTime($end);
    $endDt->setTime(0, 0, 0);

    $upsert = $pdo->prepare("INSERT INTO attendance_worker_daily_summary (worker_id, shift_id, work_date, first_in, last_out, late_minutes, early_leave_minutes, overtime_minutes, is_absent, status, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW()) ON DUPLICATE KEY UPDATE shift_id = VALUES(shift_id), first_in = VALUES(first_in), last_out = VALUES(last_out), late_minutes = VALUES(late_minutes), early_leave_minutes = VALUES(early_leave_minutes), overtime_minutes = VALUES(overtime_minutes), is_absent = VALUES(is_absent), status = VALUES(status), updated_at = NOW()");

    foreach ($workers as $w) {
        $cursor = clone $startDt;
        while ($cursor <= $endDt) {
            $work_date = $cursor->format('Y-m-d');
            if (attendance_is_holiday($pdo, $work_date)) {
                $upsert->execute([intval($w['id']), null, $work_date, null, null, 0, 0, 0, 0, 'holiday']);
                $cursor->modify('+1 day');
                continue;
            }

            $shift = attendance_get_worker_shift($pdo, intval($w['id']), $work_date);
            if (!$shift) {
                $cursor->modify('+1 day');
                continue;
            }
            $summary = attendance_calculate_worker_summary($pdo, intval($w['id']), $work_date, $shift);
            if (attendance_is_weekly_off($shift, $work_date) && intval($summary['is_absent'] ?? 0) === 1) {
                $summary['is_absent'] = 0;
                $summary['status'] = 'holiday';
            }
            $upsert->execute([
                intval($w['id']),
                $shift['id'],
                $work_date,
                $summary['first_in'],
                $summary['last_out'],
                $summary['late_minutes'],
                $summary['early_leave_minutes'],
                $summary['overtime_minutes'],
                $summary['is_absent'],
                $summary['status']
            ]);
            $cursor->modify('+1 day');
        }
    }
    return true;
}

// -----------------------
// Shared helper: fetch full orders by IDs (used by journal print, waybills etc.)
// Safe for use across multiple modules without permission duplication.
// -----------------------
if (!function_exists('nexus_fetch_orders_by_ids')) {
    function nexus_fetch_orders_by_ids(PDO $pdo, string $rawIds): array {
        $ids = array_values(array_filter(array_map('intval', explode(',', $rawIds))));
        if (empty($ids)) return [];
        $in = implode(',', $ids);

        $extraCols = [];
        if (column_exists($pdo, 'orders', 'employee'))            $extraCols[] = 'o.employee';
        if (column_exists($pdo, 'orders', 'page'))                $extraCols[] = 'o.page';
        if (column_exists($pdo, 'orders', 'shipping_company_id')) $extraCols[] = 'o.shipping_company_id';
        if (column_exists($pdo, 'orders', 'updated_at'))          $extraCols[] = 'o.updated_at';
        $extraSql = $extraCols ? ', ' . implode(', ', $extraCols) : '';

        $rows = $pdo->query(
            "SELECT o.id, o.order_number, o.rep_id, o.status, o.total_amount, o.shipping_fees,
             o.notes, o.created_at{$extraSql},
             c.name AS customer_name, c.phone1 AS phone1, c.address, c.governorate
             FROM orders o
             LEFT JOIN customers c ON o.customer_id = c.id
             WHERE o.id IN ($in) ORDER BY o.id"
        )->fetchAll(PDO::FETCH_ASSOC);

        $oMap = [];
        foreach ($rows as $r) {
            // Compute total from order_items if orders.total_amount is 0 or NULL
            $oMap[intval($r['id'])] = [
                'id'           => intval($r['id']),
                'orderNumber'  => $r['order_number'],
                'order_number' => $r['order_number'],
                'customerName' => $r['customer_name'],
                'customer_name'=> $r['customer_name'],
                'phone'        => $r['phone1'],
                'phone1'       => $r['phone1'],
                'address'      => $r['address'],
                'governorate'  => $r['governorate'] ?? '',
                'status'       => $r['status'],
                'total'        => floatval($r['total_amount'] ?? 0),
                'total_amount' => floatval($r['total_amount'] ?? 0),
                'shipping'     => floatval($r['shipping_fees'] ?? 0),
                'shipping_fees'=> floatval($r['shipping_fees'] ?? 0),
                'notes'        => $r['notes'],
                'rep_id'       => $r['rep_id'],
                'employee'     => $r['employee'] ?? null,
                'page'         => $r['page'] ?? null,
                'created_at'   => $r['created_at'],
                'updated_at'   => $r['updated_at'] ?? null,
                'products'     => [],
            ];
        }

        if (empty($oMap)) return [];

        // ── Fetch order items with product name/color/size ──
        $hasVariants  = table_exists($pdo, 'product_variants');
        $hasTotalCol  = column_exists($pdo, 'order_items', 'total_price');
        $lineExpr     = $hasTotalCol ? 'oi.total_price' : '(oi.quantity * oi.price_per_unit)';

        if ($hasVariants) {
            // New schema (after migration): product_variants holds color/size,
            // products holds the parent name.
            // Also always LEFT JOIN old products directly so orders created
            // before migration still get product data.
            $sql = "SELECT oi.order_id, oi.product_id, oi.quantity, oi.price_per_unit,
                {$lineExpr} AS line_total,
                COALESCE(ppar.name, pd.name)   AS name,
                COALESCE(pv.color,  pd.color2)  AS color,
                COALESCE(pv.size,   pd.size2)   AS size
            FROM order_items oi
            LEFT JOIN product_variants pv   ON pv.id = oi.product_id
            LEFT JOIN products         ppar ON ppar.id = pv.product_id
            LEFT JOIN (
                SELECT p2.id,
                       p2.name";
            // Dynamically include color/size fallback columns only if they exist
            $sqlPdColor = column_exists($pdo, 'products', 'color') ? ", p2.color AS color2" : ", NULL AS color2";
            $sqlPdSize  = column_exists($pdo, 'products', 'size')  ? ", p2.size  AS size2"  : ", NULL AS size2";
            $sql .= $sqlPdColor . $sqlPdSize;
            $sql .= " FROM products p2
            ) pd ON pd.id = oi.product_id
            WHERE oi.order_id IN ($in)";
        } else {
            // Legacy flat products schema
            $colColor = column_exists($pdo, 'products', 'color') ? 'p.color' : "'' ";
            $colSize  = column_exists($pdo, 'products', 'size')  ? 'p.size'  : "'' ";
            $sql = "SELECT oi.order_id, oi.product_id, oi.quantity, oi.price_per_unit,
                {$lineExpr} AS line_total,
                p.name, {$colColor} AS color, {$colSize} AS size
            FROM order_items oi
            LEFT JOIN products p ON p.id = oi.product_id
            WHERE oi.order_id IN ($in)";
        }

        $items = $pdo->query($sql)->fetchAll(PDO::FETCH_ASSOC);
        foreach ($items as $it) {
            $oid = intval($it['order_id']);
            if (!isset($oMap[$oid])) continue;
            $oMap[$oid]['products'][] = [
                'productId' => $it['product_id'],
                'name'      => $it['name'] ?? '',
                'color'     => $it['color'] ?? '',
                'size'      => $it['size'] ?? '',
                'quantity'  => intval($it['quantity']),
                'qty'       => intval($it['quantity']),
                'price'     => floatval($it['price_per_unit']),
                'total'     => floatval($it['line_total']),
            ];
        }

        // Return in the original requested order, compute total from products if orders.total_amount was 0
        $result = [];
        foreach ($ids as $oid) {
            if (!isset($oMap[$oid])) continue;
            $o = $oMap[$oid];
            if (floatval($o['total_amount'] ?? 0) == 0 && count($o['products']) > 0) {
                $computed = array_sum(array_map(fn($p) => floatval($p['total']), $o['products']));
                $o['total'] = $computed;
                $o['total_amount'] = $computed;
            }
            $result[] = $o;
        }
        return $result;
    }
}

// -----------------------
// Router inputs
// -----------------------
$module = isset($_GET['module']) ? trim((string)$_GET['module']) : '';
$action = isset($_GET['action']) ? trim((string)$_GET['action']) : '';

if ($module === '') {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => "Module '' not found."]);
    exit;
}

// Automatic one-time reconciliation after update to keep all supplier accounts consistent
// across Supplier Management and Supplier Ledger pages.
run_supplier_reconciliation_once($pdo);

switch ($module) {
    // -----------------------
    // Selected product / temporary selection persisted server-side
    // -----------------------
    case 'selected_product':
        $action = $_GET['action'] ?? 'get';
        try {
            if (!table_exists($pdo, 'selected_products')) {
                execute_query($pdo, "CREATE TABLE IF NOT EXISTS selected_products (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    user_id INT NOT NULL,
                    product_id INT NULL,
                    name VARCHAR(255) NULL,
                    color VARCHAR(100) NULL,
                    size VARCHAR(100) NULL,
                    qty INT DEFAULT 1,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
            }
        } catch (Exception $e) {
            // ignore creation errors for older DBs
        }

        $userId = isset($_SESSION['user_id']) ? intval($_SESSION['user_id']) : 0;

        if ($action === 'set') {
            // Expect JSON body with { productId, name, color, size, qty }
            $prodId = isset($input['productId']) ? (is_numeric($input['productId']) ? intval($input['productId']) : null) : null;
            $name = isset($input['name']) ? trim((string)$input['name']) : null;
            $color = isset($input['color']) ? trim((string)$input['color']) : null;
            $size = isset($input['size']) ? trim((string)$input['size']) : null;
            $qty = isset($input['qty']) ? intval($input['qty']) : 1;
            try {
                $exists = execute_query($pdo, 'SELECT id FROM selected_products WHERE user_id = ? LIMIT 1', [$userId])->fetchColumn();
                if ($exists) {
                    execute_query($pdo, 'UPDATE selected_products SET product_id = ?, name = ?, color = ?, size = ?, qty = ? WHERE id = ?', [$prodId, $name, $color, $size, $qty, intval($exists)]);
                } else {
                    execute_query($pdo, 'INSERT INTO selected_products (user_id, product_id, name, color, size, qty) VALUES (?, ?, ?, ?, ?, ?)', [$userId, $prodId, $name, $color, $size, $qty]);
                }
                echo json_encode(['success' => true]);
            } catch (Exception $e) {
                echo json_encode(['success' => false, 'message' => 'Failed to persist selection']);
            }
            exit;
        }

        // Default: get latest selection for this user
        try {
            $row = execute_query($pdo, 'SELECT product_id, name, color, size, qty FROM selected_products WHERE user_id = ? ORDER BY updated_at DESC LIMIT 1', [$userId])->fetch(PDO::FETCH_ASSOC);
            if ($row === false || $row === null) $row = new stdClass();
            echo json_encode(['success' => true, 'data' => $row]);
        } catch (Exception $e) {
            echo json_encode(['success' => false, 'message' => 'Failed to read selection']);
        }
        exit;
    // -----------------------
    // Manufacturing master data
    // -----------------------
    case 'factory_products':
        $action = $_GET['action'] ?? 'getAll';

        

        $fpsa_has_qty = column_exists($pdo, 'factory_product_stage_accessories', 'quantity');

        // Lightweight runtime migration for existing databases (dbSchema.ts affects new installs only)
        // Note: These CREATE TABLE statements intentionally avoid FOREIGN KEY constraints for compatibility
        // with older installations where referenced tables may exist with non-InnoDB engines.
        try {
            if (!table_exists($pdo, 'factory_products')) {
                execute_query($pdo, "CREATE TABLE IF NOT EXISTS factory_products (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    name VARCHAR(255) NOT NULL,
                    code VARCHAR(50) UNIQUE,
                    type ENUM('individual','composite') NOT NULL,
                    sale_price DECIMAL(10,2) DEFAULT 0,
                    min_stock INT DEFAULT 0,
                    description TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
            }

            // Ensure columns exist on older installs
            if (!column_exists($pdo, 'factory_products', 'sale_price')) {
                execute_query($pdo, "ALTER TABLE factory_products ADD COLUMN sale_price DECIMAL(10,2) DEFAULT 0");
            }
            if (!column_exists($pdo, 'factory_products', 'min_stock')) {
                execute_query($pdo, "ALTER TABLE factory_products ADD COLUMN min_stock INT DEFAULT 0");
            }
            if (!column_exists($pdo, 'factory_products', 'type')) {
                execute_query($pdo, "ALTER TABLE factory_products ADD COLUMN type ENUM('individual','composite') NOT NULL DEFAULT 'individual'");
            }
            if (!column_exists($pdo, 'factory_products', 'code')) {
                execute_query($pdo, "ALTER TABLE factory_products ADD COLUMN code VARCHAR(50) NULL");
            }
            if (!column_exists($pdo, 'factory_products', 'description')) {
                execute_query($pdo, "ALTER TABLE factory_products ADD COLUMN description TEXT NULL");
            }
            if (!table_exists($pdo, 'factory_stock')) {
                execute_query($pdo, "CREATE TABLE IF NOT EXISTS factory_stock (
                    factory_product_id INT NOT NULL,
                    warehouse_id INT NOT NULL,
                    quantity INT DEFAULT 0,
                    PRIMARY KEY (factory_product_id, warehouse_id),
                    FOREIGN KEY (factory_product_id) REFERENCES factory_products(id) ON DELETE CASCADE
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
            }
            if (!table_exists($pdo, 'factory_product_sizes')) {
                execute_query($pdo, "CREATE TABLE IF NOT EXISTS factory_product_sizes (
                    factory_product_id INT NOT NULL,
                    size_id INT NOT NULL,
                    PRIMARY KEY (factory_product_id, size_id),
                    FOREIGN KEY (factory_product_id) REFERENCES factory_products(id) ON DELETE CASCADE
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
            }
            if (!table_exists($pdo, 'factory_product_stages')) {
                execute_query($pdo, "CREATE TABLE IF NOT EXISTS factory_product_stages (
                    factory_product_id INT NOT NULL,
                    stage_id INT NOT NULL,
                    PRIMARY KEY (factory_product_id, stage_id),
                    FOREIGN KEY (factory_product_id) REFERENCES factory_products(id) ON DELETE CASCADE
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
            }
            if (!table_exists($pdo, 'factory_product_stage_accessories')) {
                execute_query($pdo, "CREATE TABLE IF NOT EXISTS factory_product_stage_accessories (
                    factory_product_id INT NOT NULL,
                    stage_id INT NOT NULL,
                    accessory_id INT NOT NULL,
                    quantity INT NOT NULL DEFAULT 1,
                    PRIMARY KEY (factory_product_id, stage_id, accessory_id)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
            }
            if (!column_exists($pdo, 'factory_product_stage_accessories', 'quantity')) {
                execute_query($pdo, "ALTER TABLE factory_product_stage_accessories ADD COLUMN quantity INT NOT NULL DEFAULT 1");
            }
            $fpsa_has_qty = column_exists($pdo, 'factory_product_stage_accessories', 'quantity');

            if (!table_exists($pdo, 'composite_product_items')) {
                execute_query($pdo, "CREATE TABLE IF NOT EXISTS composite_product_items (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    composite_id INT NOT NULL,
                    product_id INT NOT NULL,
                    quantity INT DEFAULT 1
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
            }

            if (!table_exists($pdo, 'factory_product_movements')) {
                execute_query($pdo, "CREATE TABLE IF NOT EXISTS factory_product_movements (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    factory_product_id INT NOT NULL,
                    warehouse_id INT NOT NULL,
                    movement_type VARCHAR(50) NOT NULL,
                    quantity_change INT NOT NULL,
                    previous_quantity INT NOT NULL,
                    new_quantity INT NOT NULL,
                    reference_id INT NULL,
                    reference_type VARCHAR(50) NULL,
                    notes TEXT NULL,
                    created_by INT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    INDEX (factory_product_id),
                    INDEX (warehouse_id),
                    INDEX (created_at)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
            }
        } catch (Exception $e) {
            // If migration fails, continue; downstream code will surface errors.
        }

        // Map permission based on action
        $perm_code = map_action_to_perm($action);
        if ($perm_code) {
            check_permission_or_die($pdo, 'factory_products', $perm_code);
        }

        if ($action === 'getMeta') {
            // For add/edit UI: sizes, stages, accessories, warehouses, and individual products list
            check_permission_or_die($pdo, 'factory_products', 'view');
            $sizes = execute_query($pdo, "SELECT id, name, code FROM sizes ORDER BY name ASC")->fetchAll(PDO::FETCH_ASSOC);
            $stages = execute_query($pdo, "SELECT id, name, order_num, description FROM production_stages ORDER BY order_num ASC, name ASC")->fetchAll(PDO::FETCH_ASSOC);
            $accessories = execute_query($pdo, "SELECT id, name, code, color, cost_price, min_stock FROM accessories ORDER BY name ASC")->fetchAll(PDO::FETCH_ASSOC);
            $warehouses = execute_query($pdo, "SELECT id, name FROM warehouses ORDER BY name ASC")->fetchAll(PDO::FETCH_ASSOC);
            $individualProducts = execute_query($pdo, "SELECT id, name, code FROM factory_products WHERE type = 'individual' ORDER BY name ASC")->fetchAll(PDO::FETCH_ASSOC);
            $colors = table_exists($pdo, 'colors') ? execute_query($pdo, "SELECT id, name, code FROM colors ORDER BY name ASC")->fetchAll(PDO::FETCH_ASSOC) : [];
            echo json_encode(['success'=>true,'data'=>[
                'sizes' => $sizes,
                'stages' => $stages,
                'accessories' => $accessories,
                'warehouses' => $warehouses,
                'colors' => $colors,
                'individual_products' => $individualProducts,
            ]]);
            break;
        }

        if ($action === 'getMovements') {
            check_permission_or_die($pdo, 'factory_products', 'view');
            $factory_product_id = intval($_GET['factory_product_id'] ?? ($_GET['id'] ?? ($input['factory_product_id'] ?? 0)));
            $warehouse_id = intval($_GET['warehouse_id'] ?? 0);
            if (!$factory_product_id) { http_response_code(400); echo json_encode(['success'=>false,'message'=>'factory_product_id required']); break; }
            if (!table_exists($pdo, 'factory_product_movements')) { echo json_encode(['success'=>true,'data'=>[]]); break; }

            $where = "m.factory_product_id = ?";
            $params = [$factory_product_id];
            if ($warehouse_id > 0) { $where .= " AND m.warehouse_id = ?"; $params[] = $warehouse_id; }
            $sql = "SELECT m.*, w.name AS warehouse_name, u.name AS created_by_name
                    FROM factory_product_movements m
                    LEFT JOIN warehouses w ON w.id = m.warehouse_id
                    LEFT JOIN users u ON u.id = m.created_by
                    WHERE $where
                    ORDER BY m.created_at DESC, m.id DESC";
            $rows = execute_query($pdo, $sql, $params)->fetchAll(PDO::FETCH_ASSOC);
            echo json_encode(['success'=>true,'data'=>$rows]);
            break;
        }

        if ($action === 'getAll') {
            check_permission_or_die($pdo, 'factory_products', 'view');
            $sql = "SELECT
                        fp.*,
                        COALESCE(SUM(fs.quantity), 0) AS quantity,
                        COUNT(DISTINCT fs.warehouse_id) AS warehouse_count,
                        CASE WHEN COUNT(DISTINCT fs.warehouse_id) = 1 THEN MIN(fs.warehouse_id) ELSE NULL END AS one_warehouse_id,
                        GROUP_CONCAT(DISTINCT w.name ORDER BY w.name SEPARATOR '، ') AS warehouse_names
                    FROM factory_products fp
                    LEFT JOIN factory_stock fs ON fs.factory_product_id = fp.id
                    LEFT JOIN warehouses w ON w.id = fs.warehouse_id
                    GROUP BY fp.id
                    ORDER BY fp.id DESC";
            $rows = execute_query($pdo, $sql)->fetchAll(PDO::FETCH_ASSOC);
            echo json_encode(['success'=>true,'data'=>$rows]);
            break;
        }

        if ($action === 'getDetails') {
            check_permission_or_die($pdo, 'factory_products', 'view');
            $id = intval($_GET['id'] ?? ($input['id'] ?? 0));
            if (!$id) { http_response_code(400); echo json_encode(['success'=>false,'message'=>'id required']); break; }
            $prod = execute_query($pdo, "SELECT * FROM factory_products WHERE id = ?", [$id])->fetch(PDO::FETCH_ASSOC);
            if (!$prod) { http_response_code(404); echo json_encode(['success'=>false,'message'=>'Not found']); break; }

            $size_ids = execute_query($pdo, "SELECT size_id FROM factory_product_sizes WHERE factory_product_id = ?", [$id])->fetchAll(PDO::FETCH_COLUMN);
            $stage_ids = execute_query($pdo, "SELECT stage_id FROM factory_product_stages WHERE factory_product_id = ?", [$id])->fetchAll(PDO::FETCH_COLUMN);

            // stage -> accessories[] (with quantities)
            if ($fpsa_has_qty) {
                $saRows = execute_query(
                    $pdo,
                    "SELECT stage_id, accessory_id, quantity FROM factory_product_stage_accessories WHERE factory_product_id = ? ORDER BY stage_id ASC",
                    [$id]
                )->fetchAll(PDO::FETCH_ASSOC);
            } else {
                $saRows = execute_query(
                    $pdo,
                    "SELECT stage_id, accessory_id FROM factory_product_stage_accessories WHERE factory_product_id = ? ORDER BY stage_id ASC",
                    [$id]
                )->fetchAll(PDO::FETCH_ASSOC);
            }
            $stage_accessories = [];
            foreach ($saRows as $r) {
                $sid = strval($r['stage_id']);
                if (!isset($stage_accessories[$sid])) $stage_accessories[$sid] = [];
                $stage_accessories[$sid][] = [
                    'accessory_id' => intval($r['accessory_id']),
                    'quantity' => isset($r['quantity']) ? intval($r['quantity']) : 1
                ];
            }

            $components = execute_query(
                $pdo,
                "SELECT c.product_id, c.quantity, p.name, p.code FROM composite_product_items c LEFT JOIN factory_products p ON p.id = c.product_id WHERE c.composite_id = ? ORDER BY c.id ASC",
                [$id]
            )->fetchAll(PDO::FETCH_ASSOC);

            echo json_encode(['success'=>true,'data'=>[
                'product' => $prod,
                'size_ids' => array_map('intval', $size_ids ?: []),
                'stage_ids' => array_map('intval', $stage_ids ?: []),
                'stage_accessories' => $stage_accessories,
                'components' => $components,
            ]]);
            break;
        }

        if ($action === 'getStockQty') {
            check_permission_or_die($pdo, 'factory_products', 'view');
            $factory_product_id = intval($_GET['factory_product_id'] ?? ($input['factory_product_id'] ?? 0));
            $warehouse_id = intval($_GET['warehouse_id'] ?? ($input['warehouse_id'] ?? 0));
            if (!$factory_product_id || !$warehouse_id) { http_response_code(400); echo json_encode(['success'=>false,'message'=>'factory_product_id and warehouse_id required']); break; }
            $qty = execute_query($pdo, "SELECT quantity FROM factory_stock WHERE factory_product_id = ? AND warehouse_id = ?", [$factory_product_id, $warehouse_id])->fetchColumn();
            echo json_encode(['success'=>true,'data'=>['quantity'=>intval($qty ?: 0)]]);
            break;
        }

        if ($action === 'getAssemblyInfo') {
            check_permission_or_die($pdo, 'factory_products', 'view');
            $composite_id = intval($_GET['composite_id'] ?? ($input['composite_id'] ?? ($input['factory_product_id'] ?? 0)));
            $warehouse_id = intval($_GET['warehouse_id'] ?? ($input['warehouse_id'] ?? 0));
            $size_id = intval($_GET['size_id'] ?? ($input['size_id'] ?? 0));
            if ($composite_id <= 0 || $warehouse_id <= 0) {
                http_response_code(400);
                echo json_encode(['success'=>false,'message'=>'composite_id and warehouse_id required']);
                break;
            }
            $comp = execute_query($pdo, "SELECT * FROM factory_products WHERE id = ? AND type = 'composite' LIMIT 1", [$composite_id])->fetch(PDO::FETCH_ASSOC);
            if (!$comp) { http_response_code(404); echo json_encode(['success'=>false,'message'=>'Composite product not found']); break; }

            $components = execute_query(
                $pdo,
                "SELECT c.product_id, c.quantity, p.name, p.code
                 FROM composite_product_items c
                 LEFT JOIN factory_products p ON p.id = c.product_id
                 WHERE c.composite_id = ?
                 ORDER BY c.id ASC",
                [$composite_id]
            )->fetchAll(PDO::FETCH_ASSOC);

            if (!$components || count($components) === 0) {
                echo json_encode(['success'=>true,'data'=>[
                    'composite' => $comp,
                    'warehouse_id' => $warehouse_id,
                    'current_quantity' => 0,
                    'max_quantity' => 0,
                    'unit_cost' => 0,
                    'components' => []
                ]]);
                break;
            }

            $curQty = execute_query($pdo, "SELECT quantity FROM factory_stock WHERE factory_product_id = ? AND warehouse_id = ?", [$composite_id, $warehouse_id])->fetchColumn();
            $curQty = ($curQty === false || $curQty === null) ? 0 : intval($curQty);

            // Load component available quantities
            $maxQty = null;
            $componentIds = [];
            foreach ($components as $c) {
                $pid = intval($c['product_id'] ?? 0);
                if ($pid > 0) $componentIds[$pid] = true;
            }
            $componentIds = array_keys($componentIds);

            // Allowed sizes: intersection of component sizes (enforces "same size")
            $allowedSizes = [];
            if (table_exists($pdo, 'sizes')) {
                $allSizes = execute_query($pdo, "SELECT id, name, code FROM sizes ORDER BY id ASC", [])->fetchAll(PDO::FETCH_ASSOC);
                $sizeMap = [];
                foreach ($allSizes as $s) {
                    $sid = intval($s['id'] ?? 0);
                    if ($sid > 0) $sizeMap[$sid] = $s;
                }

                $allowedSizeIds = array_keys($sizeMap);
                if (table_exists($pdo, 'factory_product_sizes') && count($componentIds) > 0) {
                    $in = implode(',', array_fill(0, count($componentIds), '?'));
                    $rows = execute_query($pdo, "SELECT factory_product_id, size_id FROM factory_product_sizes WHERE factory_product_id IN ($in)", $componentIds)->fetchAll(PDO::FETCH_ASSOC);
                    $byProduct = [];
                    foreach ($rows as $r) {
                        $pid = intval($r['factory_product_id'] ?? 0);
                        $sid = intval($r['size_id'] ?? 0);
                        if ($pid <= 0 || $sid <= 0) continue;
                        if (!isset($byProduct[$pid])) $byProduct[$pid] = [];
                        $byProduct[$pid][$sid] = true;
                    }

                    $hasConstraint = false;
                    $intersection = null;
                    foreach ($componentIds as $pid) {
                        if (!isset($byProduct[$pid]) || count($byProduct[$pid]) === 0) {
                            // no constraint for this product -> ignore
                            continue;
                        }
                        $hasConstraint = true;
                        $set = array_keys($byProduct[$pid]);
                        if ($intersection === null) {
                            $intersection = $set;
                        } else {
                            $intersection = array_values(array_intersect($intersection, $set));
                        }
                    }
                    if ($hasConstraint) {
                        $allowedSizeIds = $intersection ? $intersection : [];
                    }
                }

                foreach ($allowedSizeIds as $sid) {
                    $sid = intval($sid);
                    if ($sid > 0 && isset($sizeMap[$sid])) {
                        $allowedSizes[] = [
                            'id' => $sid,
                            'name' => $sizeMap[$sid]['name'] ?? '',
                            'code' => $sizeMap[$sid]['code'] ?? null,
                        ];
                    }
                }
            }

            if ($size_id > 0 && count($allowedSizes) > 0) {
                $ok = false;
                foreach ($allowedSizes as $s) {
                    if (intval($s['id']) === $size_id) { $ok = true; break; }
                }
                if (!$ok) {
                    http_response_code(400);
                    echo json_encode(['success'=>false,'message'=>'Selected size is not allowed for this composite/components']);
                    break;
                }
            }

            // Best-effort unit cost per component from latest manufacturing_finish
            $unitCostById = [];
            if (table_exists($pdo, 'factory_product_movements') && count($componentIds) > 0) {
                $in = implode(',', array_fill(0, count($componentIds), '?'));
                $sql = "SELECT m.factory_product_id, m.notes
                        FROM factory_product_movements m
                        INNER JOIN (
                            SELECT factory_product_id, MAX(id) AS max_id
                            FROM factory_product_movements
                            WHERE movement_type = 'manufacturing_finish' AND factory_product_id IN ($in)
                            GROUP BY factory_product_id
                        ) t ON t.factory_product_id = m.factory_product_id AND t.max_id = m.id";
                $rows = execute_query($pdo, $sql, $componentIds)->fetchAll(PDO::FETCH_ASSOC);
                foreach ($rows as $r) {
                    $pid = intval($r['factory_product_id'] ?? 0);
                    $notes = $r['notes'] ?? '';
                    $decoded = null;
                    if (is_string($notes) && trim($notes) !== '') {
                        $decoded = json_decode($notes, true);
                        if (!is_array($decoded)) $decoded = null;
                    }
                    $unit = $decoded && isset($decoded['unit_cost']) ? floatval($decoded['unit_cost']) : 0.0;
                    $unitCostById[$pid] = $unit;
                }
            }

            $out = [];
            $unitCost = 0.0;
            foreach ($components as $c) {
                $pid = intval($c['product_id'] ?? 0);
                $per = intval($c['quantity'] ?? 1);
                if ($per <= 0) $per = 1;
                $avail = 0;
                if ($pid > 0) {
                    $q = execute_query($pdo, "SELECT quantity FROM factory_stock WHERE factory_product_id = ? AND warehouse_id = ?", [$pid, $warehouse_id])->fetchColumn();
                    $avail = ($q === false || $q === null) ? 0 : intval($q);
                }
                $possible = $per > 0 ? intval(floor($avail / $per)) : 0;
                if ($maxQty === null) $maxQty = $possible;
                else $maxQty = min($maxQty, $possible);

                $cUnit = floatval($unitCostById[$pid] ?? 0.0);
                $unitCost += ($cUnit * $per);

                $out[] = [
                    'product_id' => $pid,
                    'name' => $c['name'] ?? null,
                    'code' => $c['code'] ?? null,
                    'per_unit' => $per,
                    'available_quantity' => $avail,
                    'unit_cost' => $cUnit,
                ];
            }

            echo json_encode(['success'=>true,'data'=>[
                'composite' => $comp,
                'warehouse_id' => $warehouse_id,
                'size_id' => $size_id,
                'allowed_sizes' => $allowedSizes,
                'current_quantity' => $curQty,
                'max_quantity' => intval($maxQty ?? 0),
                'unit_cost' => $unitCost,
                'components' => $out
            ]]);
            break;
        }

        if ($action === 'assembleComposite') {
            check_permission_or_die($pdo, 'factory_products', 'edit');
            $composite_id = intval($input['composite_id'] ?? ($input['factory_product_id'] ?? 0));
            $warehouse_id = intval($input['warehouse_id'] ?? 0);
            $qty = intval($input['quantity'] ?? ($input['qty'] ?? 0));
            $size_id = intval($input['size_id'] ?? 0);
            if ($composite_id <= 0 || $warehouse_id <= 0 || $qty <= 0 || $size_id <= 0) {
                http_response_code(400);
                echo json_encode(['success'=>false,'message'=>'composite_id, warehouse_id, size_id, quantity are required']);
                break;
            }

            $comp = execute_query($pdo, "SELECT * FROM factory_products WHERE id = ? AND type = 'composite' LIMIT 1", [$composite_id])->fetch(PDO::FETCH_ASSOC);
            if (!$comp) { http_response_code(404); echo json_encode(['success'=>false,'message'=>'Composite product not found']); break; }

            $components = execute_query(
                $pdo,
                "SELECT c.product_id, c.quantity, p.name, p.code
                 FROM composite_product_items c
                 LEFT JOIN factory_products p ON p.id = c.product_id
                 WHERE c.composite_id = ?
                 ORDER BY c.id ASC",
                [$composite_id]
            )->fetchAll(PDO::FETCH_ASSOC);
            if (!$components || count($components) === 0) {
                http_response_code(400);
                echo json_encode(['success'=>false,'message'=>'Composite has no components']);
                break;
            }

            // Validate size_id: must be common allowed size across component products
            if (table_exists($pdo, 'sizes') && table_exists($pdo, 'factory_product_sizes')) {
                $componentIds = [];
                foreach ($components as $c) {
                    $pid = intval($c['product_id'] ?? 0);
                    if ($pid > 0) $componentIds[$pid] = true;
                }
                $componentIds = array_keys($componentIds);
                if (count($componentIds) > 0) {
                    $in = implode(',', array_fill(0, count($componentIds), '?'));
                    $rows = execute_query($pdo, "SELECT factory_product_id, size_id FROM factory_product_sizes WHERE factory_product_id IN ($in)", $componentIds)->fetchAll(PDO::FETCH_ASSOC);
                    $byProduct = [];
                    foreach ($rows as $r) {
                        $pid = intval($r['factory_product_id'] ?? 0);
                        $sid = intval($r['size_id'] ?? 0);
                        if ($pid <= 0 || $sid <= 0) continue;
                        if (!isset($byProduct[$pid])) $byProduct[$pid] = [];
                        $byProduct[$pid][$sid] = true;
                    }

                    $hasConstraint = false;
                    $intersection = null;
                    foreach ($componentIds as $pid) {
                        if (!isset($byProduct[$pid]) || count($byProduct[$pid]) === 0) {
                            continue;
                        }
                        $hasConstraint = true;
                        $set = array_keys($byProduct[$pid]);
                        if ($intersection === null) $intersection = $set;
                        else $intersection = array_values(array_intersect($intersection, $set));
                    }

                    if ($hasConstraint) {
                        $allowed = $intersection ? $intersection : [];
                        if (!in_array($size_id, $allowed, true)) {
                            http_response_code(400);
                            echo json_encode(['success'=>false,'message'=>'Selected size is not allowed for this composite/components']);
                            break;
                        }
                    }
                }
            }

            // Batch latest unit costs for components
            $componentIds = [];
            foreach ($components as $c) {
                $pid = intval($c['product_id'] ?? 0);
                if ($pid > 0) $componentIds[$pid] = true;
            }
            $componentIds = array_keys($componentIds);
            $unitCostById = [];
            if (table_exists($pdo, 'factory_product_movements') && count($componentIds) > 0) {
                $in = implode(',', array_fill(0, count($componentIds), '?'));
                $sql = "SELECT m.factory_product_id, m.notes
                        FROM factory_product_movements m
                        INNER JOIN (
                            SELECT factory_product_id, MAX(id) AS max_id
                            FROM factory_product_movements
                            WHERE movement_type = 'manufacturing_finish' AND factory_product_id IN ($in)
                            GROUP BY factory_product_id
                        ) t ON t.factory_product_id = m.factory_product_id AND t.max_id = m.id";
                $rows = execute_query($pdo, $sql, $componentIds)->fetchAll(PDO::FETCH_ASSOC);
                foreach ($rows as $r) {
                    $pid = intval($r['factory_product_id'] ?? 0);
                    $notes = $r['notes'] ?? '';
                    $decoded = null;
                    if (is_string($notes) && trim($notes) !== '') {
                        $decoded = json_decode($notes, true);
                        if (!is_array($decoded)) $decoded = null;
                    }
                    $unit = $decoded && isset($decoded['unit_cost']) ? floatval($decoded['unit_cost']) : 0.0;
                    $unitCostById[$pid] = $unit;
                }
            }

            $created_by = $_SESSION['user_id'] ?? null;

            // Compute daily reason early and validate warehouse reason before starting a transaction
            $daily_reason = isset($input['reason']) ? trim($input['reason']) : (isset($input['notes']) ? trim($input['notes']) : '');
            if ($warehouseId && empty($daily_reason)) {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'يرجى تحديد سبب (reason) لتسليم/سحب المنتجات من المستودع.']);
                break;
            }

                // Ensure journal table exists and allow multiple journal rows per rep/date
                try { execute_query($pdo, "ALTER TABLE rep_daily_journal DROP INDEX rep_date_unique"); } catch (Exception $ex) {}
                // Best-effort: also try raw exec to remove lingering unique index name if any
                try { $pdo->exec("ALTER TABLE rep_daily_journal DROP INDEX rep_date_unique"); } catch (Exception $ex) {}
                // Create table if missing (no UNIQUE constraint so multiple rows per date are allowed)
                execute_query($pdo, "CREATE TABLE IF NOT EXISTS rep_daily_journal (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    rep_id INT NOT NULL,
                    session_seq INT DEFAULT 1,
                    journal_date DATE NOT NULL,
                    opening_amount DECIMAL(14,2) DEFAULT 0,
                    opening_orders_count INT DEFAULT 0,
                    opening_pieces_count INT DEFAULT 0,
                    orders_received_count INT DEFAULT 0,
                    pieces_received INT DEFAULT 0,
                    orders_delivered_count INT DEFAULT 0,
                    pieces_delivered INT DEFAULT 0,
                    delivered_value DECIMAL(14,2) DEFAULT 0,
                    orders_returned_count INT DEFAULT 0,
                    pieces_returned INT DEFAULT 0,
                    returned_value DECIMAL(14,2) DEFAULT 0,
                    orders_postponed_count INT DEFAULT 0,
                    pieces_postponed INT DEFAULT 0,
                    postponed_value DECIMAL(14,2) DEFAULT 0,
                    transactions TEXT NULL,
                    closing_amount DECIMAL(14,2) DEFAULT 0,
                    notes TEXT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

            // add optional columns requested by UI if they don't exist
                if (!column_exists($pdo, 'rep_daily_journal', 'employee')) execute_query($pdo, "ALTER TABLE rep_daily_journal ADD COLUMN employee VARCHAR(255) NULL");
                if (!column_exists($pdo, 'rep_daily_journal', 'page'))     execute_query($pdo, "ALTER TABLE rep_daily_journal ADD COLUMN page VARCHAR(255) NULL");
                if (!column_exists($pdo, 'rep_daily_journal', 'session_seq')) execute_query($pdo, "ALTER TABLE rep_daily_journal ADD COLUMN session_seq INT DEFAULT 1");
            if (!column_exists($pdo, 'rep_daily_journal', 'treasury_id')) execute_query($pdo, "ALTER TABLE rep_daily_journal ADD COLUMN treasury_id INT NULL");
            if (!column_exists($pdo, 'rep_daily_journal', 'warehouse_id')) execute_query($pdo, "ALTER TABLE rep_daily_journal ADD COLUMN warehouse_id INT NULL");
            if (!column_exists($pdo, 'rep_daily_journal', 'prev_balance')) execute_query($pdo, "ALTER TABLE rep_daily_journal ADD COLUMN prev_balance DECIMAL(14,2) DEFAULT 0");
            if (!column_exists($pdo, 'rep_daily_journal', 'old_orders_value')) execute_query($pdo, "ALTER TABLE rep_daily_journal ADD COLUMN old_orders_value DECIMAL(14,2) DEFAULT 0");
            if (!column_exists($pdo, 'rep_daily_journal', 'orders_assigned_count')) execute_query($pdo, "ALTER TABLE rep_daily_journal ADD COLUMN orders_assigned_count INT DEFAULT 0");
            if (!column_exists($pdo, 'rep_daily_journal', 'pieces_assigned_count')) execute_query($pdo, "ALTER TABLE rep_daily_journal ADD COLUMN pieces_assigned_count INT DEFAULT 0");
            if (!column_exists($pdo, 'rep_daily_journal', 'assigned_value')) execute_query($pdo, "ALTER TABLE rep_daily_journal ADD COLUMN assigned_value DECIMAL(14,2) DEFAULT 0");
            if (!column_exists($pdo, 'rep_daily_journal', 'total_orders_count')) execute_query($pdo, "ALTER TABLE rep_daily_journal ADD COLUMN total_orders_count INT DEFAULT 0");
            if (!column_exists($pdo, 'rep_daily_journal', 'total_pieces_count')) execute_query($pdo, "ALTER TABLE rep_daily_journal ADD COLUMN total_pieces_count INT DEFAULT 0");
            if (!column_exists($pdo, 'rep_daily_journal', 'total_orders_value')) execute_query($pdo, "ALTER TABLE rep_daily_journal ADD COLUMN total_orders_value DECIMAL(14,2) DEFAULT 0");
            if (!column_exists($pdo, 'rep_daily_journal', 'final_before_payment')) execute_query($pdo, "ALTER TABLE rep_daily_journal ADD COLUMN final_before_payment DECIMAL(14,2) DEFAULT 0");
            if (!column_exists($pdo, 'rep_daily_journal', 'payment_action')) execute_query($pdo, "ALTER TABLE rep_daily_journal ADD COLUMN payment_action VARCHAR(32) NULL");
            if (!column_exists($pdo, 'rep_daily_journal', 'payment_amount')) execute_query($pdo, "ALTER TABLE rep_daily_journal ADD COLUMN payment_amount DECIMAL(14,2) DEFAULT 0");
            if (!column_exists($pdo, 'rep_daily_journal', 'balance_after_payment')) execute_query($pdo, "ALTER TABLE rep_daily_journal ADD COLUMN balance_after_payment DECIMAL(14,2) DEFAULT 0");
            if (!column_exists($pdo, 'rep_daily_journal', 'orders_json')) execute_query($pdo, "ALTER TABLE rep_daily_journal ADD COLUMN orders_json TEXT NULL");

            try {
                $pdo->beginTransaction();

                $used = [];
                $unitCost = 0.0;

                // Consume components
                foreach ($components as $c) {
                    $pid = intval($c['product_id'] ?? 0);
                    $per = intval($c['quantity'] ?? 1);
                    if ($per <= 0) $per = 1;
                    $need = $per * $qty;
                    if ($pid <= 0 || $need <= 0) continue;

                    $cur = execute_query(
                        $pdo,
                        "SELECT quantity FROM factory_stock WHERE factory_product_id = ? AND warehouse_id = ? FOR UPDATE",
                        [$pid, $warehouse_id]
                    )->fetchColumn();
                    $prevQty = ($cur === false || $cur === null) ? 0 : intval($cur);
                    if ($prevQty < $need) {
                        throw new Exception('Insufficient component stock');
                    }
                    execute_query(
                        $pdo,
                        "UPDATE factory_stock SET quantity = quantity - ? WHERE factory_product_id = ? AND warehouse_id = ?",
                        [$need, $pid, $warehouse_id]
                    );
                    $newQty = $prevQty - $need;

                    $cUnit = floatval($unitCostById[$pid] ?? 0.0);
                    $unitCost += ($cUnit * $per);

                    $used[] = [
                        'product_id' => $pid,
                        'name' => $c['name'] ?? null,
                        'code' => $c['code'] ?? null,
                        'per_unit' => $per,
                        'qty_used' => $need,
                        'unit_cost' => $cUnit,
                    ];

                    if (table_exists($pdo, 'factory_product_movements')) {
                        $notes = json_encode([
                            'action' => 'assembleComposite',
                            'composite_id' => $composite_id,
                            'size_id' => $size_id,
                            'quantity' => $qty,
                            'per_unit' => $per,
                            'qty_used' => $need
                        ]);
                        execute_query(
                            $pdo,
                            "INSERT INTO factory_product_movements (factory_product_id, warehouse_id, movement_type, quantity_change, previous_quantity, new_quantity, reference_id, reference_type, notes, created_by)
                             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                            [$pid, $warehouse_id, 'assembly_use', -$need, $prevQty, $newQty, $composite_id, 'assembly', $notes, $created_by]
                        );
                    }
                }

                // Produce composite
                $curComp = execute_query(
                    $pdo,
                    "SELECT quantity FROM factory_stock WHERE factory_product_id = ? AND warehouse_id = ? FOR UPDATE",
                    [$composite_id, $warehouse_id]
                )->fetchColumn();
                $prevComp = ($curComp === false || $curComp === null) ? 0 : intval($curComp);
                if ($curComp === false || $curComp === null) {
                    execute_query($pdo, "INSERT INTO factory_stock (factory_product_id, warehouse_id, quantity) VALUES (?, ?, ?)", [$composite_id, $warehouse_id, $qty]);
                    $newComp = $qty;
                } else {
                    execute_query($pdo, "UPDATE factory_stock SET quantity = quantity + ? WHERE factory_product_id = ? AND warehouse_id = ?", [$qty, $composite_id, $warehouse_id]);
                    $newComp = $prevComp + $qty;
                }

                $totalCost = $unitCost * $qty;

                if (table_exists($pdo, 'factory_product_movements')) {
                    $notes = json_encode([
                        'action' => 'assembleComposite',
                        'composite_id' => $composite_id,
                        'size_id' => $size_id,
                        'quantity' => $qty,
                        'unit_cost' => $unitCost,
                        'total_cost' => $totalCost,
                        'components' => $used
                    ]);
                    execute_query(
                        $pdo,
                        "INSERT INTO factory_product_movements (factory_product_id, warehouse_id, movement_type, quantity_change, previous_quantity, new_quantity, reference_id, reference_type, notes, created_by)
                         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                        [$composite_id, $warehouse_id, 'assembly_build', $qty, $prevComp, $newComp, $composite_id, 'assembly', $notes, $created_by]
                    );
                }

                $pdo->commit();
                echo json_encode(['success'=>true,'data'=>[
                    'composite_id' => $composite_id,
                    'name' => $comp['name'] ?? null,
                    'code' => $comp['code'] ?? null,
                    'warehouse_id' => $warehouse_id,
                    'size_id' => $size_id,
                    'quantity_added' => $qty,
                    'new_quantity' => $newComp,
                    'unit_cost' => $unitCost,
                    'total_cost' => $totalCost,
                    'components_used' => $used
                ]]);
            } catch (Exception $e) {
                try { if ($pdo->inTransaction()) $pdo->rollBack(); } catch (Exception $ex) {}
                http_response_code(500);
                echo json_encode(['success'=>false,'message'=>'Assembly failed: ' . $e->getMessage()]);
            }
            break;
        }

        if ($action === 'getByWarehouse') {
            check_permission_or_die($pdo, 'factory_products', 'view');
            $warehouse_id = intval($_GET['warehouse_id'] ?? 0);
            if ($warehouse_id <= 0) {
                http_response_code(400);
                echo json_encode(['success'=>false,'message'=>'warehouse_id required']);
                break;
            }

            $rows = execute_query(
                $pdo,
                "SELECT fp.id AS product_id, fp.name, fp.code, fp.sale_price AS price, fp.sale_price AS sale_price, fp.min_stock AS reorderLevel, fs.quantity
                 FROM factory_stock fs
                 JOIN factory_products fp ON fp.id = fs.factory_product_id
                 WHERE fs.warehouse_id = ? AND COALESCE(fs.quantity,0) > 0
                 ORDER BY fp.name ASC",
                [$warehouse_id]
            )->fetchAll(PDO::FETCH_ASSOC);

            if (!$rows || count($rows) === 0) {
                echo json_encode(['success'=>true,'data'=>[]]);
                break;
            }

            // Attach latest manufacturing unit cost breakdown per product (if available)
            $ids = [];
            foreach ($rows as $r) {
                $pid = intval($r['product_id'] ?? 0);
                if ($pid > 0) $ids[] = $pid;
            }
            $ids = array_values(array_unique($ids));

            $costById = [];
            if (table_exists($pdo, 'factory_product_movements') && count($ids) > 0) {
                $in = implode(',', array_map('intval', $ids));
                $sql = "SELECT m.factory_product_id, m.notes
                        FROM factory_product_movements m
                        INNER JOIN (
                            SELECT factory_product_id, MAX(id) AS max_id
                            FROM factory_product_movements
                            WHERE movement_type = 'manufacturing_finish' AND factory_product_id IN ($in)
                            GROUP BY factory_product_id
                        ) t ON t.factory_product_id = m.factory_product_id AND t.max_id = m.id";
                $mRows = execute_query($pdo, $sql)->fetchAll(PDO::FETCH_ASSOC);
                foreach ($mRows as $mr) {
                    $pid = intval($mr['factory_product_id'] ?? 0);
                    $notes = $mr['notes'] ?? null;
                    $decoded = null;
                    if (is_string($notes) && trim($notes) !== '') {
                        $decoded = json_decode($notes, true);
                        if (!is_array($decoded)) $decoded = null;
                    }
                    $unit = $decoded && isset($decoded['unit_cost']) ? floatval($decoded['unit_cost']) : 0.0;
                    $fabric = $decoded && isset($decoded['fabric_unit_cost']) ? floatval($decoded['fabric_unit_cost']) : 0.0;
                    $acc = $decoded && isset($decoded['accessories_unit_cost']) ? floatval($decoded['accessories_unit_cost']) : 0.0;
                    $wage = $decoded && isset($decoded['wage_unit_cost']) ? floatval($decoded['wage_unit_cost']) : 0.0;
                    $costById[$pid] = [
                        'unit_cost' => $unit,
                        'fabric_unit_cost' => $fabric,
                        'accessories_unit_cost' => $acc,
                        'wage_unit_cost' => $wage,
                    ];
                }
            }

            foreach ($rows as &$r) {
                $pid = intval($r['product_id'] ?? 0);
                $r['barcode'] = $r['code'] ?? null;
                $r['color'] = null;
                $r['size'] = null;
                $r['item_type'] = 'factory';
                $c = $costById[$pid] ?? null;
                $r['cost'] = $c ? floatval($c['unit_cost']) : 0.0;
                $r['unit_cost'] = $c ? floatval($c['unit_cost']) : 0.0;
                $r['fabric_unit_cost'] = $c ? floatval($c['fabric_unit_cost']) : 0.0;
                $r['accessories_unit_cost'] = $c ? floatval($c['accessories_unit_cost']) : 0.0;
                $r['wage_unit_cost'] = $c ? floatval($c['wage_unit_cost']) : 0.0;
            }
            unset($r);

            echo json_encode(['success'=>true,'data'=>$rows]);
            break;
        }

        if ($action === 'add' || $action === 'create') {
            check_permission_or_die($pdo, 'factory_products', 'add');
            $name = trim((string)($input['name'] ?? ''));
            $code = trim((string)($input['code'] ?? ''));
            $type = ($input['type'] ?? 'individual') === 'composite' ? 'composite' : 'individual';
            $description = trim((string)($input['description'] ?? ''));
            $sale_price = isset($input['sale_price']) ? floatval($input['sale_price']) : floatval($input['price'] ?? 0);
            $min_stock = isset($input['min_stock']) ? intval($input['min_stock']) : intval($input['reorder_level'] ?? 0);

            $warehouse_id = intval($input['warehouse_id'] ?? ($input['warehouseId'] ?? 0));
            $qty = isset($input['quantity']) ? intval($input['quantity']) : 0;

            $size_ids = is_array($input['size_ids'] ?? null) ? $input['size_ids'] : [];
            $stage_ids = is_array($input['stage_ids'] ?? null) ? $input['stage_ids'] : [];
            $stage_accessories = is_array($input['stage_accessories'] ?? null) ? $input['stage_accessories'] : [];
            $components = is_array($input['components'] ?? null) ? $input['components'] : [];

            if ($name === '' || $warehouse_id <= 0) {
                http_response_code(400);
                echo json_encode(['success'=>false,'message'=>'name and warehouse_id are required']);
                break;
            }

            if ($type === 'individual') {
                if (count($size_ids) === 0) { http_response_code(400); echo json_encode(['success'=>false,'message'=>'At least one size must be selected']); break; }
                if (count($stage_ids) === 0) { http_response_code(400); echo json_encode(['success'=>false,'message'=>'At least one production stage must be selected']); break; }
                // Accessories are optional. If provided, validate quantities.
                foreach ($stage_accessories as $k => $arr) {
                    if (!is_array($arr)) continue;
                    foreach ($arr as $it) {
                        if (is_array($it)) {
                            $aid = intval($it['accessory_id'] ?? 0);
                            $q = intval($it['quantity'] ?? 0);
                            if ($aid > 0 && $q <= 0) {
                                http_response_code(400);
                                echo json_encode(['success'=>false,'message'=>'Accessory quantity must be greater than 0']);
                                break 3;
                            }
                        }
                    }
                }
            } else {
                if (count($components) === 0) { http_response_code(400); echo json_encode(['success'=>false,'message'=>'At least one component product is required']); break; }
            }

            try {
                $pdo->beginTransaction();

                execute_query(
                    $pdo,
                    "INSERT INTO factory_products (name, code, type, sale_price, min_stock, description) VALUES (?, ?, ?, ?, ?, ?)",
                    [$name, ($code !== '' ? $code : null), $type, $sale_price, $min_stock, ($description !== '' ? $description : null)]
                );
                $newId = intval($pdo->lastInsertId());

                // initial stock
                execute_query(
                    $pdo,
                    "INSERT INTO factory_stock (factory_product_id, warehouse_id, quantity) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE quantity = VALUES(quantity)",
                    [$newId, $warehouse_id, $qty]
                );

                if (table_exists($pdo, 'factory_product_movements') && $qty > 0) {
                    $notes = json_encode(['reason' => 'initial_stock', 'source' => 'factory_products.add']);
                    execute_query(
                        $pdo,
                        "INSERT INTO factory_product_movements (factory_product_id, warehouse_id, movement_type, quantity_change, previous_quantity, new_quantity, reference_id, reference_type, notes, created_by)
                         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                        [$newId, $warehouse_id, 'initial_balance', intval($qty), 0, intval($qty), $newId, 'factory_product', $notes, $current_user]
                    );
                }

                if ($type === 'individual') {
                    foreach ($size_ids as $sid) {
                        $sid = intval($sid);
                        if ($sid <= 0) continue;
                        execute_query($pdo, "INSERT IGNORE INTO factory_product_sizes (factory_product_id, size_id) VALUES (?, ?)", [$newId, $sid]);
                    }
                    foreach ($stage_ids as $st) {
                        $st = intval($st);
                        if ($st <= 0) continue;
                        execute_query($pdo, "INSERT IGNORE INTO factory_product_stages (factory_product_id, stage_id) VALUES (?, ?)", [$newId, $st]);
                        $key = strval($st);
                        $accArr = $stage_accessories[$key] ?? $stage_accessories[$st] ?? [];
                        if (is_array($accArr)) {
                            // normalize: accessory_id => sum(quantity)
                            $accMap = [];
                            foreach ($accArr as $it) {
                                if (is_array($it)) {
                                    $aid = intval($it['accessory_id'] ?? 0);
                                    $q = intval($it['quantity'] ?? 0);
                                } else {
                                    $aid = intval($it);
                                    $q = 1;
                                }
                                if ($aid <= 0) continue;
                                if ($q <= 0) $q = 1;
                                if (!isset($accMap[$aid])) $accMap[$aid] = 0;
                                $accMap[$aid] += $q;
                            }
                            foreach ($accMap as $aid => $qsum) {
                                if ($fpsa_has_qty) {
                                    execute_query(
                                        $pdo,
                                        "INSERT INTO factory_product_stage_accessories (factory_product_id, stage_id, accessory_id, quantity) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE quantity = VALUES(quantity)",
                                        [$newId, $st, intval($aid), intval($qsum)]
                                    );
                                } else {
                                    execute_query(
                                        $pdo,
                                        "INSERT IGNORE INTO factory_product_stage_accessories (factory_product_id, stage_id, accessory_id) VALUES (?, ?, ?)",
                                        [$newId, $st, intval($aid)]
                                    );
                                }
                            }
                        }
                    }
                } else {
                    foreach ($components as $c) {
                        $pid = intval($c['product_id'] ?? 0);
                        $cqty = intval($c['quantity'] ?? 1);
                        if ($pid <= 0 || $cqty <= 0) continue;
                        execute_query($pdo, "INSERT INTO composite_product_items (composite_id, product_id, quantity) VALUES (?, ?, ?)", [$newId, $pid, $cqty]);
                    }
                }

                $pdo->commit();
                echo json_encode(['success'=>true,'data'=>['id'=>$newId]]);
            } catch (Exception $e) {
                try { $pdo->rollBack(); } catch (Exception $ex) {}
                http_response_code(500);
                error_log('factory_products add failed: ' . $e->getMessage());
                echo json_encode(['success'=>false,'message'=>'Failed to add factory product.','error'=>$e->getMessage()]);
            }
            break;
        }

        if ($action === 'update') {
            check_permission_or_die($pdo, 'factory_products', 'edit');
            $id = intval($input['id'] ?? 0);
            if (!$id) { http_response_code(400); echo json_encode(['success'=>false,'message'=>'id required']); break; }

            $name = trim((string)($input['name'] ?? ''));
            $code = trim((string)($input['code'] ?? ''));
            $type = ($input['type'] ?? 'individual') === 'composite' ? 'composite' : 'individual';
            $description = trim((string)($input['description'] ?? ''));
            $sale_price = isset($input['sale_price']) ? floatval($input['sale_price']) : floatval($input['price'] ?? 0);
            $min_stock = isset($input['min_stock']) ? intval($input['min_stock']) : intval($input['reorder_level'] ?? 0);

            $warehouse_id = intval($input['warehouse_id'] ?? ($input['warehouseId'] ?? 0));
            $qty = isset($input['quantity']) ? intval($input['quantity']) : null;

            $size_ids = is_array($input['size_ids'] ?? null) ? $input['size_ids'] : [];
            $stage_ids = is_array($input['stage_ids'] ?? null) ? $input['stage_ids'] : [];
            $stage_accessories = is_array($input['stage_accessories'] ?? null) ? $input['stage_accessories'] : [];
            $components = is_array($input['components'] ?? null) ? $input['components'] : [];

            if ($name === '' || $warehouse_id <= 0) {
                http_response_code(400);
                echo json_encode(['success'=>false,'message'=>'name and warehouse_id are required']);
                break;
            }

            if ($type === 'individual') {
                if (count($size_ids) === 0) { http_response_code(400); echo json_encode(['success'=>false,'message'=>'At least one size must be selected']); break; }
                if (count($stage_ids) === 0) { http_response_code(400); echo json_encode(['success'=>false,'message'=>'At least one production stage must be selected']); break; }
                // Accessories are optional. If provided, validate quantities.
                foreach ($stage_accessories as $k => $arr) {
                    if (!is_array($arr)) continue;
                    foreach ($arr as $it) {
                        if (is_array($it)) {
                            $aid = intval($it['accessory_id'] ?? 0);
                            $q = intval($it['quantity'] ?? 0);
                            if ($aid > 0 && $q <= 0) {
                                http_response_code(400);
                                echo json_encode(['success'=>false,'message'=>'Accessory quantity must be greater than 0']);
                                break 3;
                            }
                        }
                    }
                }
            } else {
                if (count($components) === 0) { http_response_code(400); echo json_encode(['success'=>false,'message'=>'At least one component product is required']); break; }
            }

            try {
                $pdo->beginTransaction();

                execute_query(
                    $pdo,
                    "UPDATE factory_products SET name = ?, code = ?, type = ?, sale_price = ?, min_stock = ?, description = ? WHERE id = ?",
                    [$name, ($code !== '' ? $code : null), $type, $sale_price, $min_stock, ($description !== '' ? $description : null), $id]
                );

                if ($qty !== null) {
                    $prevQty = 0;
                    $qRow = execute_query($pdo, "SELECT quantity FROM factory_stock WHERE factory_product_id = ? AND warehouse_id = ? FOR UPDATE", [$id, $warehouse_id])->fetch(PDO::FETCH_ASSOC);
                    if ($qRow) $prevQty = intval($qRow['quantity']);
                    execute_query(
                        $pdo,
                        "INSERT INTO factory_stock (factory_product_id, warehouse_id, quantity) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE quantity = VALUES(quantity)",
                        [$id, $warehouse_id, intval($qty)]
                    );
                    $newQty = intval($qty);
                    $diff = $newQty - $prevQty;
                    if (table_exists($pdo, 'factory_product_movements') && $diff != 0) {
                        $notes = json_encode(['reason' => 'manual_set', 'source' => 'factory_products.update']);
                        execute_query(
                            $pdo,
                            "INSERT INTO factory_product_movements (factory_product_id, warehouse_id, movement_type, quantity_change, previous_quantity, new_quantity, reference_id, reference_type, notes, created_by)
                             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                            [$id, $warehouse_id, 'adjustment', $diff, $prevQty, $newQty, $id, 'factory_product', $notes, $current_user]
                        );
                    }
                }

                // Reset links then reinsert based on type
                execute_query($pdo, "DELETE FROM factory_product_stage_accessories WHERE factory_product_id = ?", [$id]);
                execute_query($pdo, "DELETE FROM factory_product_stages WHERE factory_product_id = ?", [$id]);
                execute_query($pdo, "DELETE FROM factory_product_sizes WHERE factory_product_id = ?", [$id]);
                execute_query($pdo, "DELETE FROM composite_product_items WHERE composite_id = ?", [$id]);

                if ($type === 'individual') {
                    foreach ($size_ids as $sid) {
                        $sid = intval($sid);
                        if ($sid <= 0) continue;
                        execute_query($pdo, "INSERT IGNORE INTO factory_product_sizes (factory_product_id, size_id) VALUES (?, ?)", [$id, $sid]);
                    }
                    foreach ($stage_ids as $st) {
                        $st = intval($st);
                        if ($st <= 0) continue;
                        execute_query($pdo, "INSERT IGNORE INTO factory_product_stages (factory_product_id, stage_id) VALUES (?, ?)", [$id, $st]);
                        $key = strval($st);
                        $accArr = $stage_accessories[$key] ?? $stage_accessories[$st] ?? [];
                        if (is_array($accArr)) {
                            $accMap = [];
                            foreach ($accArr as $it) {
                                if (is_array($it)) {
                                    $aid = intval($it['accessory_id'] ?? 0);
                                    $q = intval($it['quantity'] ?? 0);
                                } else {
                                    $aid = intval($it);
                                    $q = 1;
                                }
                                if ($aid <= 0) continue;
                                if ($q <= 0) $q = 1;
                                if (!isset($accMap[$aid])) $accMap[$aid] = 0;
                                $accMap[$aid] += $q;
                            }
                            foreach ($accMap as $aid => $qsum) {
                                if ($fpsa_has_qty) {
                                    execute_query(
                                        $pdo,
                                        "INSERT INTO factory_product_stage_accessories (factory_product_id, stage_id, accessory_id, quantity) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE quantity = VALUES(quantity)",
                                        [$id, $st, intval($aid), intval($qsum)]
                                    );
                                } else {
                                    execute_query(
                                        $pdo,
                                        "INSERT IGNORE INTO factory_product_stage_accessories (factory_product_id, stage_id, accessory_id) VALUES (?, ?, ?)",
                                        [$id, $st, intval($aid)]
                                    );
                                }
                            }
                        }
                    }
                } else {
                    foreach ($components as $c) {
                        $pid = intval($c['product_id'] ?? 0);
                        $cqty = intval($c['quantity'] ?? 1);
                        if ($pid <= 0 || $cqty <= 0) continue;
                        execute_query($pdo, "INSERT INTO composite_product_items (composite_id, product_id, quantity) VALUES (?, ?, ?)", [$id, $pid, $cqty]);
                    }
                }

                $pdo->commit();
                echo json_encode(['success'=>true]);
            } catch (Exception $e) {
                try { $pdo->rollBack(); } catch (Exception $ex) {}
                http_response_code(500);
                error_log('factory_products update failed: ' . $e->getMessage());
                echo json_encode(['success'=>false,'message'=>'Failed to update factory product.','error'=>$e->getMessage()]);
            }
            break;
        }

        if ($action === 'delete') {
            check_permission_or_die($pdo, 'factory_products', 'delete');
            $id = intval($input['id'] ?? 0);
            if (!$id) { http_response_code(400); echo json_encode(['success'=>false,'message'=>'id required']); break; }
            execute_query($pdo, "DELETE FROM factory_products WHERE id = ?", [$id]);
            echo json_encode(['success'=>true]);
            break;
        }

        http_response_code(404);
        echo json_encode(['success'=>false,'message'=>"Action '$action' not supported."]);
        break;

    // -----------------------
    // Cutting Stage (Cut Orders)
    // -----------------------
    case 'cutting_stage':
        $action = $_GET['action'] ?? 'getAll';
        $perm_code = map_action_to_perm($action);
        if ($perm_code) {
            check_permission_or_die($pdo, 'cutting_stage', $perm_code);
        }

        // Runtime migration: cutting_orders table + link column in manufacturing_orders
        try {
            if (!table_exists($pdo, 'cutting_orders')) {
                execute_query($pdo, "CREATE TABLE IF NOT EXISTS cutting_orders (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    code VARCHAR(50) UNIQUE NOT NULL,
                    warehouse_id INT NOT NULL,
                    fabric_id INT NOT NULL,
                    factory_product_id INT NOT NULL,
                    cut_quantity INT NOT NULL,
                    consumption_per_piece DECIMAL(10,4) NOT NULL DEFAULT 0,
                    total_consumption DECIMAL(10,4) NOT NULL DEFAULT 0,
                    available_qty INT NOT NULL DEFAULT 0,
                    in_production_qty INT NOT NULL DEFAULT 0,
                    ready_qty INT NOT NULL DEFAULT 0,
                    created_by INT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    INDEX (warehouse_id),
                    INDEX (fabric_id),
                    INDEX (factory_product_id),
                    INDEX (created_at)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
            }
            if (table_exists($pdo, 'cutting_orders') && !column_exists($pdo, 'cutting_orders', 'warehouse_id')) {
                execute_query($pdo, "ALTER TABLE cutting_orders ADD COLUMN warehouse_id INT NOT NULL DEFAULT 1");
                try {
                    execute_query($pdo, "ALTER TABLE cutting_orders ADD INDEX (warehouse_id)");
                } catch (Exception $e) {
                    // ignore
                }
            }
            if (table_exists($pdo, 'manufacturing_orders') && !column_exists($pdo, 'manufacturing_orders', 'cutting_order_id')) {
                execute_query($pdo, "ALTER TABLE manufacturing_orders ADD COLUMN cutting_order_id INT NULL");
            }

            // Fabric stock should support decimals (meters)
            if (table_exists($pdo, 'fabric_stock')) {
                try {
                    execute_query($pdo, "ALTER TABLE fabric_stock MODIFY quantity DECIMAL(10,4) NOT NULL DEFAULT 0");
                } catch (Exception $e) {
                    // ignore
                }
            }

            if (!table_exists($pdo, 'fabric_movements')) {
                execute_query($pdo, "CREATE TABLE IF NOT EXISTS fabric_movements (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    fabric_id INT NOT NULL,
                    warehouse_id INT NOT NULL,
                    movement_type VARCHAR(50) NOT NULL,
                    quantity_change DECIMAL(10,4) NOT NULL,
                    previous_quantity DECIMAL(10,4) NOT NULL,
                    new_quantity DECIMAL(10,4) NOT NULL,
                    reference_id INT NULL,
                    reference_type VARCHAR(50) NULL,
                    notes TEXT NULL,
                    created_by INT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    INDEX (fabric_id),
                    INDEX (warehouse_id),
                    INDEX (created_at)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
            }
            if (!table_exists($pdo, 'accessory_movements')) {
                execute_query($pdo, "CREATE TABLE IF NOT EXISTS accessory_movements (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    accessory_id INT NOT NULL,
                    warehouse_id INT NOT NULL,
                    movement_type VARCHAR(50) NOT NULL,
                    quantity_change INT NOT NULL,
                    previous_quantity INT NOT NULL,
                    new_quantity INT NOT NULL,
                    reference_id INT NULL,
                    reference_type VARCHAR(50) NULL,
                    notes TEXT NULL,
                    created_by INT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    INDEX (accessory_id),
                    INDEX (warehouse_id),
                    INDEX (created_at)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
            }
        } catch (Exception $e) {
            // ignore migration errors
        }

        $generateCutCode = function() {
            $ts = date('YmdHis');
            $rnd = strval(rand(100, 999));
            return 'CUT-' . $ts . '-' . $rnd;
        };

        if ($action === 'getMeta') {
            check_permission_or_die($pdo, 'cutting_stage', 'view');
            $warehouse_id = intval($_GET['warehouse_id'] ?? 0);
            $fabrics = [];
            $products = [];
            $warehouses = [];
            if (table_exists($pdo, 'warehouses')) {
                $warehouses = execute_query($pdo, "SELECT id, name FROM warehouses ORDER BY name ASC")->fetchAll(PDO::FETCH_ASSOC);
            }
            if (table_exists($pdo, 'fabrics')) {
                $hasFabricStock = table_exists($pdo, 'fabric_stock');
                if ($warehouse_id > 0 && $hasFabricStock) {
                    // Only fabrics that exist in this warehouse with quantity > 0
                    $fabrics = execute_query(
                        $pdo,
                        "SELECT f.id, f.name, f.code
                         FROM fabric_stock fs
                         JOIN fabrics f ON f.id = fs.fabric_id
                         WHERE fs.warehouse_id = ? AND fs.quantity > 0
                         ORDER BY f.name ASC",
                        [$warehouse_id]
                    )->fetchAll(PDO::FETCH_ASSOC);
                } else {
                    $fabrics = execute_query($pdo, "SELECT id, name, code FROM fabrics ORDER BY name ASC")->fetchAll(PDO::FETCH_ASSOC);
                }
            }
            if (table_exists($pdo, 'factory_products')) {
                // Cutting stage should only allow individual products (composite products don't need manufacturing)
                $products = execute_query($pdo, "SELECT id, name, code, type FROM factory_products WHERE type = 'individual' ORDER BY name ASC")->fetchAll(PDO::FETCH_ASSOC);
            }
            echo json_encode(['success'=>true,'data'=>[
                'warehouses' => $warehouses,
                'fabrics' => $fabrics,
                'products' => $products,
            ]]);
            break;
        }

        if ($action === 'getAll') {
            check_permission_or_die($pdo, 'cutting_stage', 'view');
            $hasFabrics = table_exists($pdo, 'fabrics');
            $hasFactoryProducts = table_exists($pdo, 'factory_products');
            $sql = "SELECT
                        co.id,
                        co.code,
                        co.fabric_id," . ($hasFabrics ? "\n                        f.name AS fabric_name," : "\n                        NULL AS fabric_name,") . "
                        co.factory_product_id," . ($hasFactoryProducts ? "\n                        fp.name AS product_name," : "\n                        NULL AS product_name,") . "
                        co.cut_quantity,
                        co.consumption_per_piece,
                        co.total_consumption,
                        co.available_qty,
                        co.in_production_qty,
                        co.ready_qty,
                        co.created_at
                    FROM cutting_orders co" .
                    ($hasFabrics ? "\n                    LEFT JOIN fabrics f ON f.id = co.fabric_id" : "") .
                    ($hasFactoryProducts ? "\n                    LEFT JOIN factory_products fp ON fp.id = co.factory_product_id" : "") .
                    "\n                    ORDER BY co.id DESC";
            $rows = execute_query($pdo, $sql)->fetchAll(PDO::FETCH_ASSOC);
            echo json_encode(['success'=>true,'data'=>$rows]);
            break;
        }

        if ($action === 'add' || $action === 'create') {
            check_permission_or_die($pdo, 'cutting_stage', 'add');
            $code = trim((string)($input['code'] ?? ''));
            $warehouse_id = intval($input['warehouse_id'] ?? 0);
            $fabric_id = intval($input['fabric_id'] ?? 0);
            $factory_product_id = intval($input['factory_product_id'] ?? 0);
            $cut_quantity = intval($input['cut_quantity'] ?? ($input['quantity'] ?? 0));
            $consumption_per_piece = isset($input['consumption_per_piece']) ? floatval($input['consumption_per_piece']) : floatval($input['consumption'] ?? 0);

            if ($warehouse_id <= 0 || $fabric_id <= 0 || $factory_product_id <= 0 || $cut_quantity <= 0) {
                http_response_code(400);
                echo json_encode(['success'=>false,'message'=>'warehouse_id, fabric_id, factory_product_id and cut_quantity are required']);
                break;
            }

            if ($code === '') $code = $generateCutCode();
            $total_consumption = round($cut_quantity * max(0.0, $consumption_per_piece), 4);

            // Validate fabric exists and has enough quantity in selected warehouse
            $availableFabricQty = null;
            if (table_exists($pdo, 'fabric_stock')) {
                $q = execute_query(
                    $pdo,
                    "SELECT quantity FROM fabric_stock WHERE fabric_id = ? AND warehouse_id = ? LIMIT 1",
                    [$fabric_id, $warehouse_id]
                )->fetchColumn();
                $availableFabricQty = ($q === false || $q === null) ? 0.0 : floatval($q);
                if ($availableFabricQty <= 0) {
                    http_response_code(400);
                    echo json_encode(['success'=>false,'message'=>'القماش غير متوفر في المخزن المحدد']);
                    break;
                }
                if ($total_consumption > 0 && $availableFabricQty + 1e-9 < $total_consumption) {
                    http_response_code(400);
                    echo json_encode(['success'=>false,'message'=>'مخزون القماش في المخزن المحدد غير كافٍ']);
                    break;
                }
            }

            try {
                $pdo->beginTransaction();

                $created_by = $_SESSION['user_id'] ?? null;
                execute_query(
                    $pdo,
                    "INSERT INTO cutting_orders (code, warehouse_id, fabric_id, factory_product_id, cut_quantity, consumption_per_piece, total_consumption, available_qty, in_production_qty, ready_qty, created_by)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?)",
                    [$code, $warehouse_id, $fabric_id, $factory_product_id, $cut_quantity, $consumption_per_piece, $total_consumption, $cut_quantity, $created_by]
                );
                $newId = intval($pdo->lastInsertId());

                // Deduct fabric consumption from stock
                if (table_exists($pdo, 'fabric_stock') && $total_consumption > 0) {
                    // Re-check within transaction to avoid race conditions
                    $q2 = execute_query(
                        $pdo,
                        "SELECT quantity FROM fabric_stock WHERE fabric_id = ? AND warehouse_id = ? FOR UPDATE",
                        [$fabric_id, $warehouse_id]
                    )->fetchColumn();
                    $curQty = ($q2 === false || $q2 === null) ? 0.0 : floatval($q2);
                    if ($curQty + 1e-9 < $total_consumption) {
                        throw new Exception('Insufficient fabric stock for deduction');
                    }
                    execute_query(
                        $pdo,
                        "UPDATE fabric_stock SET quantity = quantity - ? WHERE fabric_id = ? AND warehouse_id = ?",
                        [$total_consumption, $fabric_id, $warehouse_id]
                    );

                    if (table_exists($pdo, 'fabric_movements')) {
                        $newQty = $curQty - $total_consumption;
                        $notes = json_encode([
                            'cutting_order_id' => $newId,
                            'cutting_order_code' => $code,
                            'factory_product_id' => $factory_product_id,
                            'cut_quantity' => $cut_quantity,
                            'consumption_per_piece' => $consumption_per_piece,
                            'total_consumption' => $total_consumption
                        ]);
                        execute_query(
                            $pdo,
                            "INSERT INTO fabric_movements (fabric_id, warehouse_id, movement_type, quantity_change, previous_quantity, new_quantity, reference_id, reference_type, notes, created_by)
                             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                            [$fabric_id, $warehouse_id, 'cutting_order', -$total_consumption, $curQty, $newQty, $newId, 'cutting_order', $notes, $created_by]
                        );
                    }
                }

                $pdo->commit();
                audit_log($pdo, 'cutting_stage', 'add', $newId, json_encode(['code'=>$code]));
                echo json_encode(['success'=>true,'data'=>['id'=>$newId,'code'=>$code]]);
            } catch (Exception $e) {
                try { if ($pdo->inTransaction()) $pdo->rollBack(); } catch (Exception $ex) {}
                http_response_code(500);
                error_log('cutting_stage add failed: ' . $e->getMessage());
                echo json_encode(['success'=>false,'message'=>'Failed to create cutting order.','error'=>$e->getMessage()]);
            }
            break;
        }

        if ($action === 'getProduction' || $action === 'getStages') {
            check_permission_or_die($pdo, 'cutting_stage', 'view');
            $cutting_order_id = intval($_GET['id'] ?? ($input['id'] ?? 0));
            if ($cutting_order_id <= 0) { http_response_code(400); echo json_encode(['success'=>false,'message'=>'id required']); break; }

            $order = execute_query($pdo, "SELECT * FROM cutting_orders WHERE id = ? LIMIT 1", [$cutting_order_id])->fetch(PDO::FETCH_ASSOC);
            if (!$order) { http_response_code(404); echo json_encode(['success'=>false,'message'=>'Not found']); break; }

            // Prefer product_tracking as the source of "current quantities distributed to workers"
            $hasMo = table_exists($pdo, 'manufacturing_orders');
            $hasPt = table_exists($pdo, 'product_tracking');
            $hasStages = table_exists($pdo, 'production_stages');
            $hasWorkers = table_exists($pdo, 'workers');

            $rowsOut = [];
            if ($hasMo && $hasPt && $hasStages && column_exists($pdo, 'manufacturing_orders', 'cutting_order_id')) {
                $sql = "SELECT
                            pt.stage_id,
                            ps.name AS stage_name,
                            ps.order_num AS stage_order,
                            pt.worker_id,
                            " . ($hasWorkers ? "w.name" : "CAST(pt.worker_id AS CHAR)") . " AS worker_name,
                            COUNT(*) AS qty
                        FROM product_tracking pt
                        JOIN manufacturing_orders mo ON mo.id = pt.manufacturing_order_id
                        JOIN production_stages ps ON ps.id = pt.stage_id
                        " . ($hasWorkers ? "LEFT JOIN workers w ON w.id = pt.worker_id" : "") . "
                        WHERE mo.cutting_order_id = ?
                          AND pt.started_at IS NOT NULL
                          AND (pt.finished_at IS NULL OR pt.finished_at = '0000-00-00 00:00:00')
                        GROUP BY pt.stage_id, pt.worker_id
                        ORDER BY ps.order_num ASC, ps.name ASC, worker_name ASC";
                $rowsOut = execute_query($pdo, $sql, [$cutting_order_id])->fetchAll(PDO::FETCH_ASSOC);
            }

            echo json_encode(['success'=>true,'data'=>['rows'=>$rowsOut]]);
            break;
        }

        http_response_code(400);
        echo json_encode(['success'=>false,'message'=>'Unknown action']);
        break;

    // -----------------------
    // Manufacturing Work (Operational Stages)
    // -----------------------
    case 'manufacturing_work':
        $action = $_GET['action'] ?? 'getAll';

        // Permissions: reuse cutting_stage module permissions (already seeded in most installs)
        if ($action === 'getAll' || $action === 'getCompleted' || $action === 'getCompletedPieces' || $action === 'getMeta' || $action === 'getAssignMeta' || $action === 'getTransferMeta') {
            check_permission_or_die($pdo, 'cutting_stage', 'view');
        } elseif ($action === 'assign') {
            check_permission_or_die($pdo, 'cutting_stage', 'add');
        } elseif ($action === 'transfer' || $action === 'finish') {
            check_permission_or_die($pdo, 'cutting_stage', 'edit');
        }

        // Runtime migrations (for older DBs)
        try {
            if (!table_exists($pdo, 'manufacturing_orders')) {
                execute_query($pdo, "CREATE TABLE IF NOT EXISTS manufacturing_orders (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    cutting_order_id INT NULL,
                    product_id INT NOT NULL,
                    quantity INT NOT NULL,
                    status ENUM('draft','in_progress','completed','cancelled') DEFAULT 'draft',
                    notes TEXT,
                    created_by INT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    INDEX (cutting_order_id),
                    INDEX (product_id)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
            }
            if (table_exists($pdo, 'manufacturing_orders') && !column_exists($pdo, 'manufacturing_orders', 'cutting_order_id')) {
                execute_query($pdo, "ALTER TABLE manufacturing_orders ADD COLUMN cutting_order_id INT NULL");
                try { execute_query($pdo, "ALTER TABLE manufacturing_orders ADD INDEX (cutting_order_id)"); } catch (Exception $e) {}
            }

            if (!table_exists($pdo, 'product_tracking')) {
                execute_query($pdo, "CREATE TABLE IF NOT EXISTS product_tracking (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    manufacturing_order_id INT NOT NULL,
                    product_id INT NOT NULL,
                    stage_id INT NOT NULL,
                    worker_id INT NULL,
                    size_id INT NULL,
                    piece_uid VARCHAR(32) NULL,
                    is_paid TINYINT(1) NOT NULL DEFAULT 0,
                    piece_rate DECIMAL(10,2) NOT NULL DEFAULT 0.00,
                    started_at DATETIME,
                    finished_at DATETIME,
                    notes TEXT,
                    customer_id INT NULL,
                    delivered_at DATETIME,
                    INDEX (manufacturing_order_id),
                    INDEX (product_id),
                    INDEX (stage_id),
                    INDEX (worker_id),
                    INDEX (piece_uid),
                    INDEX (finished_at)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
            }

            if (table_exists($pdo, 'product_tracking') && !column_exists($pdo, 'product_tracking', 'size_id')) {
                execute_query($pdo, "ALTER TABLE product_tracking ADD COLUMN size_id INT NULL");
                try { execute_query($pdo, "ALTER TABLE product_tracking ADD INDEX (size_id)"); } catch (Exception $e) {}
            }
            if (table_exists($pdo, 'product_tracking') && !column_exists($pdo, 'product_tracking', 'is_paid')) {
                execute_query($pdo, "ALTER TABLE product_tracking ADD COLUMN is_paid TINYINT(1) NOT NULL DEFAULT 0");
            }
            if (table_exists($pdo, 'product_tracking') && !column_exists($pdo, 'product_tracking', 'piece_rate')) {
                execute_query($pdo, "ALTER TABLE product_tracking ADD COLUMN piece_rate DECIMAL(10,2) NOT NULL DEFAULT 0.00");
            }
            if (table_exists($pdo, 'product_tracking') && !column_exists($pdo, 'product_tracking', 'piece_uid')) {
                execute_query($pdo, "ALTER TABLE product_tracking ADD COLUMN piece_uid VARCHAR(32) NULL");
                try { execute_query($pdo, "ALTER TABLE product_tracking ADD INDEX (piece_uid)"); } catch (Exception $e) {}
            }

            if (!table_exists($pdo, 'worker_transactions')) {
                execute_query($pdo, "CREATE TABLE IF NOT EXISTS worker_transactions (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    worker_id INT NOT NULL,
                    amount DECIMAL(10,2) NOT NULL,
                    type ENUM('advance','bonus','penalty','piecework') NOT NULL,
                    date DATE NOT NULL,
                    notes TEXT,
                    status ENUM('pending','paid','deducted') DEFAULT 'pending',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    INDEX (worker_id),
                    INDEX (date)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
            }

            if (!table_exists($pdo, 'factory_stock')) {
                execute_query($pdo, "CREATE TABLE IF NOT EXISTS factory_stock (
                    factory_product_id INT NOT NULL,
                    warehouse_id INT NOT NULL,
                    quantity INT NOT NULL DEFAULT 0,
                    PRIMARY KEY (factory_product_id, warehouse_id),
                    INDEX (warehouse_id)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
            }
            if (!table_exists($pdo, 'factory_product_movements')) {
                execute_query($pdo, "CREATE TABLE IF NOT EXISTS factory_product_movements (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    factory_product_id INT NOT NULL,
                    warehouse_id INT NOT NULL,
                    movement_type VARCHAR(50) NOT NULL,
                    quantity_change INT NOT NULL,
                    previous_quantity INT NOT NULL,
                    new_quantity INT NOT NULL,
                    reference_id INT NULL,
                    reference_type VARCHAR(50) NULL,
                    notes TEXT NULL,
                    created_by INT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    INDEX (factory_product_id),
                    INDEX (warehouse_id),
                    INDEX (created_at)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
            }
            if (!table_exists($pdo, 'accessory_movements')) {
                execute_query($pdo, "CREATE TABLE IF NOT EXISTS accessory_movements (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    accessory_id INT NOT NULL,
                    warehouse_id INT NOT NULL,
                    movement_type VARCHAR(50) NOT NULL,
                    quantity_change INT NOT NULL,
                    previous_quantity INT NOT NULL,
                    new_quantity INT NOT NULL,
                    reference_id INT NULL,
                    reference_type VARCHAR(50) NULL,
                    notes TEXT NULL,
                    created_by INT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    INDEX (accessory_id),
                    INDEX (warehouse_id),
                    INDEX (created_at)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
            }
        } catch (Exception $e) {
            // ignore migration errors
        }

        $created_by = $_SESSION['user_id'] ?? null;

        $gen_piece_uid = function() {
            try {
                return bin2hex(random_bytes(16));
            } catch (Exception $e) {
                return md5(uniqid('', true));
            }
        };

        $deduct_stage_accessories = function($factory_product_id, $stage_id, $warehouse_id, $qty, $reference_id, $reference_type, $extraNotes) use ($pdo, $created_by) {
            if ($qty <= 0) return;
            if (!table_exists($pdo, 'factory_product_stage_accessories')) return;
            if (!table_exists($pdo, 'accessory_stock')) return;

            $items = execute_query(
                $pdo,
                "SELECT fpsa.accessory_id, fpsa.quantity, a.name, a.code
                 FROM factory_product_stage_accessories fpsa
                 LEFT JOIN accessories a ON a.id = fpsa.accessory_id
                 WHERE fpsa.factory_product_id = ? AND fpsa.stage_id = ?",
                [$factory_product_id, $stage_id]
            )->fetchAll(PDO::FETCH_ASSOC);
            if (!$items) return;

            foreach ($items as $it) {
                $accId = intval($it['accessory_id']);
                $perPiece = intval($it['quantity'] ?? 0);
                if ($accId <= 0 || $perPiece <= 0) continue;
                $need = $perPiece * $qty;

                $cur = execute_query(
                    $pdo,
                    "SELECT quantity FROM accessory_stock WHERE accessory_id = ? AND warehouse_id = ? FOR UPDATE",
                    [$accId, $warehouse_id]
                )->fetchColumn();
                $prevQty = ($cur === false || $cur === null) ? 0 : intval($cur);
                if ($prevQty < $need) {
                    throw new Exception('مخزون الاكسسوارات غير كافٍ');
                }
                execute_query(
                    $pdo,
                    "UPDATE accessory_stock SET quantity = quantity - ? WHERE accessory_id = ? AND warehouse_id = ?",
                    [$need, $accId, $warehouse_id]
                );
                $newQty = $prevQty - $need;

                if (table_exists($pdo, 'accessory_movements')) {
                    $notes = json_encode(array_merge([
                        'factory_product_id' => $factory_product_id,
                        'stage_id' => $stage_id,
                        'per_piece' => $perPiece,
                        'qty' => $qty,
                        'accessory_name' => $it['name'] ?? null,
                        'accessory_code' => $it['code'] ?? null
                    ], is_array($extraNotes) ? $extraNotes : []));
                    execute_query(
                        $pdo,
                        "INSERT INTO accessory_movements (accessory_id, warehouse_id, movement_type, quantity_change, previous_quantity, new_quantity, reference_id, reference_type, notes, created_by)
                         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                        [$accId, $warehouse_id, 'manufacturing', -$need, $prevQty, $newQty, $reference_id, $reference_type, $notes, $created_by]
                    );
                }
            }
        };

        if ($action === 'getMeta') {
            $cutting_orders = [];
            if (table_exists($pdo, 'cutting_orders')) {
                $sql = "SELECT co.id, co.code, co.available_qty, co.warehouse_id,
                               f.name AS fabric_name,
                               fp.id AS product_id, fp.name AS product_name
                        FROM cutting_orders co
                        LEFT JOIN fabrics f ON f.id = co.fabric_id
                        LEFT JOIN factory_products fp ON fp.id = co.factory_product_id
                        WHERE co.available_qty > 0
                        ORDER BY co.id DESC";
                $cutting_orders = execute_query($pdo, $sql)->fetchAll(PDO::FETCH_ASSOC);
            }
            $workers = table_exists($pdo, 'workers')
                ? execute_query($pdo, "SELECT id, name FROM workers WHERE status = 'active' OR status IS NULL ORDER BY name ASC")->fetchAll(PDO::FETCH_ASSOC)
                : [];
            $warehouses = table_exists($pdo, 'warehouses')
                ? execute_query($pdo, "SELECT id, name FROM warehouses ORDER BY name ASC")->fetchAll(PDO::FETCH_ASSOC)
                : [];
            echo json_encode(['success'=>true,'data'=>[
                'cutting_orders' => $cutting_orders,
                'workers' => $workers,
                'warehouses' => $warehouses,
            ]]);
            break;
        }

        if ($action === 'getAssignMeta') {
            $cutting_order_id = intval($_GET['cutting_order_id'] ?? 0);
            if ($cutting_order_id <= 0) { http_response_code(400); echo json_encode(['success'=>false,'message'=>'cutting_order_id required']); break; }
            $order = execute_query($pdo, "SELECT * FROM cutting_orders WHERE id = ?", [$cutting_order_id])->fetch(PDO::FETCH_ASSOC);
            if (!$order) { http_response_code(404); echo json_encode(['success'=>false,'message'=>'Not found']); break; }
            $productId = intval($order['factory_product_id']);
            $sizes = [];
            $stages = [];
            if ($productId > 0 && table_exists($pdo, 'factory_product_sizes') && table_exists($pdo, 'sizes')) {
                $sizes = execute_query(
                    $pdo,
                    "SELECT s.id, s.name, s.code
                     FROM factory_product_sizes fps
                     JOIN sizes s ON s.id = fps.size_id
                     WHERE fps.factory_product_id = ?
                     ORDER BY s.name ASC",
                    [$productId]
                )->fetchAll(PDO::FETCH_ASSOC);
            }
            if ($productId > 0 && table_exists($pdo, 'factory_product_stages') && table_exists($pdo, 'production_stages')) {
                $stages = execute_query(
                    $pdo,
                    "SELECT ps.id, ps.name, ps.order_num
                     FROM factory_product_stages fps
                     JOIN production_stages ps ON ps.id = fps.stage_id
                     WHERE fps.factory_product_id = ?
                     ORDER BY ps.order_num ASC, ps.name ASC",
                    [$productId]
                )->fetchAll(PDO::FETCH_ASSOC);
            }
            echo json_encode(['success'=>true,'data'=>[
                'available_qty' => intval($order['available_qty'] ?? 0),
                'product_id' => $productId,
                'stages' => $stages,
                'sizes' => $sizes,
            ]]);
            break;
        }

        if ($action === 'getTransferMeta') {
            $cutting_order_id = intval($_GET['cutting_order_id'] ?? 0);
            $from_stage_id = intval($_GET['from_stage_id'] ?? 0);
            if ($cutting_order_id <= 0 || $from_stage_id <= 0) { http_response_code(400); echo json_encode(['success'=>false,'message'=>'cutting_order_id and from_stage_id required']); break; }
            $order = execute_query($pdo, "SELECT * FROM cutting_orders WHERE id = ?", [$cutting_order_id])->fetch(PDO::FETCH_ASSOC);
            if (!$order) { http_response_code(404); echo json_encode(['success'=>false,'message'=>'Not found']); break; }
            $productId = intval($order['factory_product_id']);
            $fromOrder = intval(execute_query($pdo, "SELECT order_num FROM production_stages WHERE id = ?", [$from_stage_id])->fetchColumn() ?? 0);
            $stages = [];
            if ($productId > 0 && table_exists($pdo, 'factory_product_stages') && table_exists($pdo, 'production_stages')) {
                $stages = execute_query(
                    $pdo,
                    "SELECT ps.id, ps.name, ps.order_num
                     FROM factory_product_stages fps
                     JOIN production_stages ps ON ps.id = fps.stage_id
                     WHERE fps.factory_product_id = ? AND ps.order_num > ?
                     ORDER BY ps.order_num ASC, ps.name ASC",
                    [$productId, $fromOrder]
                )->fetchAll(PDO::FETCH_ASSOC);
            }
            echo json_encode(['success'=>true,'data'=>['stages'=>$stages]]);
            break;
        }

        if ($action === 'getAll') {
            $q = trim((string)($_GET['q'] ?? ''));
            $where = "mo.cutting_order_id IS NOT NULL AND pt.started_at IS NOT NULL";
            $params = [];
            if ($q !== '') {
                $where .= " AND (co.code LIKE ? OR fp.name LIKE ? OR w.name LIKE ?)";
                $like = '%' . $q . '%';
                $params[] = $like;
                $params[] = $like;
                $params[] = $like;
            }

            $sql = "SELECT
                        co.id AS cutting_order_id,
                        co.code,
                        COALESCE(pt.worker_id, 0) AS worker_id,
                        COALESCE(w.name, '-') AS worker_name,
                        pt.stage_id,
                        ps.name AS stage_name,
                        COALESCE(f.name, '-') AS fabric_name,
                        co.factory_product_id AS product_id,
                        COALESCE(fp.name, '-') AS product_name,
                        COUNT(pt.id) AS qty_received,
                        SUM(CASE WHEN pt.finished_at IS NULL OR pt.finished_at = '0000-00-00 00:00:00' THEN 1 ELSE 0 END) AS qty_in_production,
                        (COUNT(pt.id) - SUM(CASE WHEN pt.finished_at IS NOT NULL AND pt.finished_at <> '0000-00-00 00:00:00' THEN 1 ELSE 0 END)) AS qty_remaining,
                        ps.order_num AS stage_order,
                        CASE WHEN ps.order_num = (
                            SELECT MAX(ps2.order_num)
                            FROM factory_product_stages fps2
                            JOIN production_stages ps2 ON ps2.id = fps2.stage_id
                            WHERE fps2.factory_product_id = co.factory_product_id
                        ) THEN 1 ELSE 0 END AS is_last_stage
                    FROM product_tracking pt
                    JOIN manufacturing_orders mo ON mo.id = pt.manufacturing_order_id
                    JOIN cutting_orders co ON co.id = mo.cutting_order_id
                    JOIN production_stages ps ON ps.id = pt.stage_id
                    LEFT JOIN workers w ON w.id = pt.worker_id
                    LEFT JOIN fabrics f ON f.id = co.fabric_id
                    LEFT JOIN factory_products fp ON fp.id = co.factory_product_id
                    WHERE $where
                    GROUP BY co.id, pt.stage_id, pt.worker_id
                    HAVING qty_in_production > 0
                    ORDER BY co.id DESC, ps.order_num ASC, worker_name ASC";

            $rows = execute_query($pdo, $sql, $params)->fetchAll(PDO::FETCH_ASSOC);
            echo json_encode(['success'=>true,'data'=>$rows]);
            break;
        }

        if ($action === 'getCompleted') {
            $q = trim((string)($_GET['q'] ?? ''));
            $where = "mo.cutting_order_id IS NOT NULL AND pt.started_at IS NOT NULL";
            $params = [];
            if ($q !== '') {
                $where .= " AND (co.code LIKE ? OR fp.name LIKE ? OR w.name LIKE ?)";
                $like = '%' . $q . '%';
                $params[] = $like;
                $params[] = $like;
                $params[] = $like;
            }

            $sql = "SELECT
                        co.id AS cutting_order_id,
                        co.code,
                        COALESCE(pt.worker_id, 0) AS worker_id,
                        COALESCE(w.name, '-') AS worker_name,
                        pt.stage_id,
                        ps.name AS stage_name,
                        COALESCE(f.name, '-') AS fabric_name,
                        co.factory_product_id AS product_id,
                        COALESCE(fp.name, '-') AS product_name,
                        COUNT(pt.id) AS qty_received,
                        SUM(CASE WHEN pt.finished_at IS NULL OR pt.finished_at = '0000-00-00 00:00:00' THEN 1 ELSE 0 END) AS qty_in_production,
                        (COUNT(pt.id) - SUM(CASE WHEN pt.finished_at IS NOT NULL AND pt.finished_at <> '0000-00-00 00:00:00' THEN 1 ELSE 0 END)) AS qty_remaining,
                        ps.order_num AS stage_order,
                        CASE WHEN ps.order_num = (
                            SELECT MAX(ps2.order_num)
                            FROM factory_product_stages fps2
                            JOIN production_stages ps2 ON ps2.id = fps2.stage_id
                            WHERE fps2.factory_product_id = co.factory_product_id
                        ) THEN 1 ELSE 0 END AS is_last_stage,
                        MIN(pt.started_at) AS started_at,
                        MAX(pt.finished_at) AS finished_at,
                        TIMESTAMPDIFF(SECOND, MIN(pt.started_at), MAX(pt.finished_at)) AS total_seconds
                    FROM product_tracking pt
                    JOIN manufacturing_orders mo ON mo.id = pt.manufacturing_order_id
                    JOIN cutting_orders co ON co.id = mo.cutting_order_id
                    JOIN production_stages ps ON ps.id = pt.stage_id
                    LEFT JOIN workers w ON w.id = pt.worker_id
                    LEFT JOIN fabrics f ON f.id = co.fabric_id
                    LEFT JOIN factory_products fp ON fp.id = co.factory_product_id
                    WHERE $where
                    GROUP BY co.id, pt.stage_id, pt.worker_id
                    HAVING qty_received > 0 AND qty_in_production = 0
                    ORDER BY finished_at DESC, co.id DESC, ps.order_num ASC, worker_name ASC";

            $rows = execute_query($pdo, $sql, $params)->fetchAll(PDO::FETCH_ASSOC);
            echo json_encode(['success'=>true,'data'=>$rows]);
            break;
        }

        if ($action === 'getCompletedPieces') {
            $cutting_order_id = intval($_GET['cutting_order_id'] ?? 0);
            $stage_id = intval($_GET['stage_id'] ?? 0);
            $worker_id = intval($_GET['worker_id'] ?? 0);
            if ($cutting_order_id <= 0 || $stage_id <= 0 || $worker_id <= 0) {
                http_response_code(400);
                echo json_encode(['success'=>false,'message'=>'cutting_order_id, stage_id, worker_id are required']);
                break;
            }

            $sql = "SELECT
                        pt.piece_uid,
                        pt.size_id,
                        s.name AS size_name,
                        s.code AS size_code,
                        f.color AS fabric_color
                    FROM product_tracking pt
                    JOIN manufacturing_orders mo ON mo.id = pt.manufacturing_order_id
                    JOIN cutting_orders co ON co.id = mo.cutting_order_id
                    LEFT JOIN sizes s ON s.id = pt.size_id
                    LEFT JOIN fabrics f ON f.id = co.fabric_id
                    WHERE mo.cutting_order_id = ?
                      AND pt.stage_id = ?
                      AND pt.worker_id = ?
                      AND pt.piece_uid IS NOT NULL
                      AND pt.piece_uid <> ''
                      AND pt.finished_at IS NOT NULL
                      AND pt.finished_at <> '0000-00-00 00:00:00'
                    ORDER BY pt.id ASC
                    LIMIT 5000";

            $rows = execute_query($pdo, $sql, [$cutting_order_id, $stage_id, $worker_id])->fetchAll(PDO::FETCH_ASSOC);
            echo json_encode(['success'=>true,'data'=>['rows'=>$rows]]);
            break;
        }

        if ($action === 'assign') {
            $cutting_order_id = intval($input['cutting_order_id'] ?? 0);
            $qty = intval($input['quantity'] ?? 0);
            $worker_id = intval($input['worker_id'] ?? 0);
            $stage_id = intval($input['stage_id'] ?? 0);
            $size_id = intval($input['size_id'] ?? 0);
            $is_paid = intval($input['is_paid'] ?? 0) ? 1 : 0;
            $piece_rate = $is_paid ? floatval($input['piece_rate'] ?? 0) : 0.0;

            if ($cutting_order_id <= 0 || $qty <= 0 || $worker_id <= 0 || $stage_id <= 0 || $size_id <= 0) {
                http_response_code(400);
                echo json_encode(['success'=>false,'message'=>'cutting_order_id, quantity, worker_id, stage_id, size_id are required']);
                break;
            }

            $order = execute_query($pdo, "SELECT * FROM cutting_orders WHERE id = ?", [$cutting_order_id])->fetch(PDO::FETCH_ASSOC);
            if (!$order) { http_response_code(404); echo json_encode(['success'=>false,'message'=>'Cutting order not found']); break; }
            $productId = intval($order['factory_product_id']);
            $warehouseId = intval($order['warehouse_id'] ?? 1);

            // Validate stage belongs to product
            if (table_exists($pdo, 'factory_product_stages')) {
                $ok = execute_query($pdo, "SELECT 1 FROM factory_product_stages WHERE factory_product_id = ? AND stage_id = ? LIMIT 1", [$productId, $stage_id])->fetchColumn();
                if (!$ok) { http_response_code(400); echo json_encode(['success'=>false,'message'=>'المرحلة غير مرتبطة بالمنتج']); break; }
            }
            // Validate size belongs to product
            if (table_exists($pdo, 'factory_product_sizes')) {
                $ok2 = execute_query($pdo, "SELECT 1 FROM factory_product_sizes WHERE factory_product_id = ? AND size_id = ? LIMIT 1", [$productId, $size_id])->fetchColumn();
                if (!$ok2) { http_response_code(400); echo json_encode(['success'=>false,'message'=>'المقاس غير مرتبط بالمنتج']); break; }
            }

            try {
                $pdo->beginTransaction();

                // Ensure manufacturing order exists for cutting order
                $moId = execute_query($pdo, "SELECT id FROM manufacturing_orders WHERE cutting_order_id = ? LIMIT 1", [$cutting_order_id])->fetchColumn();
                if (!$moId) {
                    execute_query(
                        $pdo,
                        "INSERT INTO manufacturing_orders (cutting_order_id, product_id, quantity, status, notes, created_by) VALUES (?, ?, ?, 'in_progress', NULL, ?)",
                        [$cutting_order_id, $productId, intval($order['cut_quantity'] ?? $qty), $created_by]
                    );
                    $moId = intval($pdo->lastInsertId());
                } else {
                    $moId = intval($moId);
                }

                // Lock and update cutting order quantities
                $co = execute_query($pdo, "SELECT available_qty, in_production_qty FROM cutting_orders WHERE id = ? FOR UPDATE", [$cutting_order_id])->fetch(PDO::FETCH_ASSOC);
                $available = intval($co['available_qty'] ?? 0);
                if ($available < $qty) {
                    throw new Exception('الكمية المتاحة غير كافية');
                }
                execute_query(
                    $pdo,
                    "UPDATE cutting_orders SET available_qty = available_qty - ?, in_production_qty = in_production_qty + ? WHERE id = ?",
                    [$qty, $qty, $cutting_order_id]
                );

                // Deduct accessories for stage start
                $deduct_stage_accessories($productId, $stage_id, $warehouseId, $qty, $cutting_order_id, 'manufacturing_stage', [
                    'action' => 'assign',
                    'worker_id' => $worker_id,
                    'cutting_order_id' => $cutting_order_id
                ]);

                // Insert per-piece tracking rows (chunked)
                $now = date('Y-m-d H:i:s');
                $chunk = 200;
                $remaining = $qty;
                while ($remaining > 0) {
                    $take = min($chunk, $remaining);
                    $vals = [];
                    $ps = [];
                    for ($i = 0; $i < $take; $i++) {
                        $vals[] = "(?, ?, ?, ?, ?, ?, ?, ?, ?)";
                        $pieceUid = $gen_piece_uid();
                        array_push($ps, $moId, $productId, $stage_id, $worker_id, $size_id, $pieceUid, $is_paid, $piece_rate, $now);
                    }
                    execute_query(
                        $pdo,
                        "INSERT INTO product_tracking (manufacturing_order_id, product_id, stage_id, worker_id, size_id, piece_uid, is_paid, piece_rate, started_at) VALUES " . implode(',', $vals),
                        $ps
                    );
                    $remaining -= $take;
                }

                $pdo->commit();
                echo json_encode(['success'=>true]);
            } catch (Exception $e) {
                try { if ($pdo->inTransaction()) $pdo->rollBack(); } catch (Exception $ex) {}
                http_response_code(500);
                echo json_encode(['success'=>false,'message'=>$e->getMessage()]);
            }
            break;
        }

        if ($action === 'transfer') {
            $cutting_order_id = intval($input['cutting_order_id'] ?? 0);
            $from_stage_id = intval($input['from_stage_id'] ?? 0);
            $from_worker_id = intval($input['from_worker_id'] ?? 0);
            $to_stage_id = intval($input['to_stage_id'] ?? 0);
            $to_worker_id = intval($input['to_worker_id'] ?? 0);
            $qty = intval($input['quantity'] ?? 0);
            $is_paid = intval($input['is_paid'] ?? 0) ? 1 : 0;
            $piece_rate = $is_paid ? floatval($input['piece_rate'] ?? 0) : 0.0;

            if ($cutting_order_id <= 0 || $from_stage_id <= 0 || $from_worker_id <= 0 || $to_stage_id <= 0 || $to_worker_id <= 0 || $qty <= 0) {
                http_response_code(400);
                echo json_encode(['success'=>false,'message'=>'Required fields missing']);
                break;
            }

            $order = execute_query($pdo, "SELECT * FROM cutting_orders WHERE id = ?", [$cutting_order_id])->fetch(PDO::FETCH_ASSOC);
            if (!$order) { http_response_code(404); echo json_encode(['success'=>false,'message'=>'Cutting order not found']); break; }
            $productId = intval($order['factory_product_id']);
            $warehouseId = intval($order['warehouse_id'] ?? 1);

            // Validate to_stage is after from_stage for this product
            $fromOrder = intval(execute_query($pdo, "SELECT order_num FROM production_stages WHERE id = ?", [$from_stage_id])->fetchColumn() ?? 0);
            $toOrder = intval(execute_query($pdo, "SELECT order_num FROM production_stages WHERE id = ?", [$to_stage_id])->fetchColumn() ?? 0);
            if ($toOrder <= $fromOrder) {
                http_response_code(400);
                echo json_encode(['success'=>false,'message'=>'المرحلة الجديدة يجب أن تكون بعد المرحلة الحالية']);
                break;
            }
            if (table_exists($pdo, 'factory_product_stages')) {
                $ok = execute_query($pdo, "SELECT 1 FROM factory_product_stages WHERE factory_product_id = ? AND stage_id = ? LIMIT 1", [$productId, $to_stage_id])->fetchColumn();
                if (!$ok) { http_response_code(400); echo json_encode(['success'=>false,'message'=>'المرحلة الجديدة غير مرتبطة بالمنتج']); break; }
            }

            try {
                $pdo->beginTransaction();

                $moId = execute_query($pdo, "SELECT id FROM manufacturing_orders WHERE cutting_order_id = ? LIMIT 1", [$cutting_order_id])->fetchColumn();
                if (!$moId) {
                    throw new Exception('Manufacturing order not found');
                }
                $moId = intval($moId);

                                $limitQty = max(1, intval($qty));
                                $sel = execute_query(
                                        $pdo,
                                        "SELECT pt.id, pt.size_id, pt.piece_uid, pt.is_paid, pt.piece_rate
                                         FROM product_tracking pt
                                         JOIN manufacturing_orders mo ON mo.id = pt.manufacturing_order_id
                                         WHERE mo.cutting_order_id = ?
                                             AND pt.stage_id = ?
                                             AND pt.worker_id = ?
                                             AND pt.started_at IS NOT NULL
                                             AND (pt.finished_at IS NULL OR pt.finished_at = '0000-00-00 00:00:00')
                                         ORDER BY pt.id ASC
                                         LIMIT $limitQty FOR UPDATE",
                                        [$cutting_order_id, $from_stage_id, $from_worker_id]
                                )->fetchAll(PDO::FETCH_ASSOC);

                if (count($sel) < $qty) {
                    throw new Exception('الكمية المتاحة للنقل غير كافية');
                }

                // Accrue piecework for the completed stage (based on the rows being finished)
                $wage = 0.0;
                foreach ($sel as $r) {
                    $paid = intval($r['is_paid'] ?? 0) ? 1 : 0;
                    $rate = floatval($r['piece_rate'] ?? 0);
                    if ($paid && $rate > 0) $wage += $rate;
                }
                if ($wage > 0 && table_exists($pdo, 'worker_transactions')) {
                    $notes = json_encode([
                        'cutting_order_id' => $cutting_order_id,
                        'product_id' => $productId,
                        'stage_id' => $from_stage_id,
                        'qty' => $qty,
                        'type' => 'stage_complete_transfer'
                    ]);
                    execute_query(
                        $pdo,
                        "INSERT INTO worker_transactions (worker_id, amount, type, date, notes, status) VALUES (?, ?, 'piecework', CURDATE(), ?, 'pending')",
                        [$from_worker_id, $wage, $notes]
                    );
                }

                $ids = array_map(function($r){ return intval($r['id']); }, $sel);
                $in = implode(',', array_fill(0, count($ids), '?'));
                execute_query($pdo, "UPDATE product_tracking SET finished_at = NOW() WHERE id IN ($in)", $ids);

                // Deduct accessories for the new stage
                $deduct_stage_accessories($productId, $to_stage_id, $warehouseId, $qty, $cutting_order_id, 'manufacturing_stage', [
                    'action' => 'transfer',
                    'from_stage_id' => $from_stage_id,
                    'to_stage_id' => $to_stage_id,
                    'from_worker_id' => $from_worker_id,
                    'to_worker_id' => $to_worker_id
                ]);

                // Insert new stage rows (preserve each piece size)
                $now = date('Y-m-d H:i:s');
                $vals = [];
                $ps = [];
                foreach ($sel as $r) {
                    $sid = intval($r['size_id'] ?? 0);
                    $puid = isset($r['piece_uid']) ? trim((string)$r['piece_uid']) : '';
                    $vals[] = "(?, ?, ?, ?, ?, ?, ?, ?, ?)";
                    array_push($ps, $moId, $productId, $to_stage_id, $to_worker_id, $sid ?: null, ($puid !== '' ? $puid : null), $is_paid, $piece_rate, $now);
                }
                execute_query(
                    $pdo,
                    "INSERT INTO product_tracking (manufacturing_order_id, product_id, stage_id, worker_id, size_id, piece_uid, is_paid, piece_rate, started_at) VALUES " . implode(',', $vals),
                    $ps
                );

                $pdo->commit();
                echo json_encode(['success'=>true]);
            } catch (Exception $e) {
                try { if ($pdo->inTransaction()) $pdo->rollBack(); } catch (Exception $ex) {}
                http_response_code(500);
                echo json_encode(['success'=>false,'message'=>$e->getMessage()]);
            }
            break;
        }

        if ($action === 'finish') {
            $cutting_order_id = intval($input['cutting_order_id'] ?? 0);
            $from_stage_id = intval($input['from_stage_id'] ?? 0);
            $from_worker_id = intval($input['from_worker_id'] ?? 0);
            $qty = intval($input['quantity'] ?? 0);
            $warehouse_id = intval($input['warehouse_id'] ?? 0);

            if ($cutting_order_id <= 0 || $from_stage_id <= 0 || $from_worker_id <= 0 || $qty <= 0 || $warehouse_id <= 0) {
                http_response_code(400);
                echo json_encode(['success'=>false,'message'=>'Required fields missing']);
                break;
            }

            $order = execute_query($pdo, "SELECT * FROM cutting_orders WHERE id = ?", [$cutting_order_id])->fetch(PDO::FETCH_ASSOC);
            if (!$order) { http_response_code(404); echo json_encode(['success'=>false,'message'=>'Cutting order not found']); break; }
            $productId = intval($order['factory_product_id']);

            // Must be last stage
            $curOrder = intval(execute_query($pdo, "SELECT order_num FROM production_stages WHERE id = ?", [$from_stage_id])->fetchColumn() ?? 0);
            $lastOrder = intval(execute_query(
                $pdo,
                "SELECT MAX(ps.order_num)
                 FROM factory_product_stages fps
                 JOIN production_stages ps ON ps.id = fps.stage_id
                 WHERE fps.factory_product_id = ?",
                [$productId]
            )->fetchColumn() ?? 0);
            if ($curOrder <= 0 || $lastOrder <= 0 || $curOrder != $lastOrder) {
                http_response_code(400);
                echo json_encode(['success'=>false,'message'=>'لا يمكن إنهاء التصنيع إلا من آخر مرحلة']);
                break;
            }

            try {
                $pdo->beginTransaction();

                $moId = execute_query($pdo, "SELECT id FROM manufacturing_orders WHERE cutting_order_id = ? LIMIT 1", [$cutting_order_id])->fetchColumn();
                if (!$moId) throw new Exception('Manufacturing order not found');
                $moId = intval($moId);

                                $limitQty = max(1, intval($qty));
                                $sel = execute_query(
                                        $pdo,
                                        "SELECT pt.id, pt.size_id, pt.piece_uid, pt.is_paid, pt.piece_rate
                                         FROM product_tracking pt
                                         JOIN manufacturing_orders mo ON mo.id = pt.manufacturing_order_id
                                         WHERE mo.cutting_order_id = ?
                                             AND pt.stage_id = ?
                                             AND pt.worker_id = ?
                                             AND pt.started_at IS NOT NULL
                                             AND (pt.finished_at IS NULL OR pt.finished_at = '0000-00-00 00:00:00')
                                         ORDER BY pt.id ASC
                                         LIMIT $limitQty FOR UPDATE",
                                        [$cutting_order_id, $from_stage_id, $from_worker_id]
                                )->fetchAll(PDO::FETCH_ASSOC);
                if (count($sel) < $qty) throw new Exception('الكمية المتاحة غير كافية');

                // Build piece list for printing (piece_uid + size + color)
                $finishedPieces = [];
                $sizeIds = [];
                foreach ($sel as $r) {
                    $u = isset($r['piece_uid']) ? trim((string)$r['piece_uid']) : '';
                    $sid0 = intval($r['size_id'] ?? 0);
                    if ($u === '') continue;
                    $finishedPieces[] = ['piece_uid' => $u, 'size_id' => $sid0];
                    if ($sid0 > 0) $sizeIds[$sid0] = true;
                }

                $sizeNames = [];
                if (count($sizeIds) > 0 && table_exists($pdo, 'sizes')) {
                    $ids2 = array_keys($sizeIds);
                    $in2 = implode(',', array_fill(0, count($ids2), '?'));
                    $szRows = execute_query($pdo, "SELECT id, name, code FROM sizes WHERE id IN ($in2)", $ids2)->fetchAll(PDO::FETCH_ASSOC);
                    foreach ($szRows as $sr) {
                        $sid = intval($sr['id'] ?? 0);
                        if ($sid > 0) $sizeNames[$sid] = ['name' => $sr['name'] ?? null, 'code' => $sr['code'] ?? null];
                    }
                }

                $fabricColor = '';
                try {
                    if (table_exists($pdo, 'fabrics')) {
                        $fabricId = intval($order['fabric_id'] ?? 0);
                        if ($fabricId > 0) {
                            $fabricColor = trim((string)(execute_query($pdo, "SELECT color FROM fabrics WHERE id = ?", [$fabricId])->fetchColumn() ?? ''));
                        }
                    }
                } catch (Exception $e) {
                    $fabricColor = '';
                }

                // Accrue wage for last stage completion
                $wage = 0.0;
                foreach ($sel as $r) {
                    $paid = intval($r['is_paid'] ?? 0) ? 1 : 0;
                    $rate = floatval($r['piece_rate'] ?? 0);
                    if ($paid && $rate > 0) $wage += $rate;
                }
                if ($wage > 0 && table_exists($pdo, 'worker_transactions')) {
                    $notes = json_encode([
                        'cutting_order_id' => $cutting_order_id,
                        'product_id' => $productId,
                        'stage_id' => $from_stage_id,
                        'qty' => $qty,
                        'type' => 'stage_complete_finish'
                    ]);
                    execute_query(
                        $pdo,
                        "INSERT INTO worker_transactions (worker_id, amount, type, date, notes, status) VALUES (?, ?, 'piecework', CURDATE(), ?, 'pending')",
                        [$from_worker_id, $wage, $notes]
                    );
                }

                $ids = array_map(function($r){ return intval($r['id']); }, $sel);
                $in = implode(',', array_fill(0, count($ids), '?'));
                execute_query($pdo, "UPDATE product_tracking SET finished_at = NOW() WHERE id IN ($in)", $ids);

                // Compute unit cost for these finished pieces (best-effort)
                $fabricUnitCost = 0.0;
                $accessoriesUnitCost = 0.0;
                $wageUnitCost = 0.0;
                try {
                    $cpp = floatval($order['consumption_per_piece'] ?? 0);
                    $fabricCostPrice = 0.0;
                    if (table_exists($pdo, 'fabrics')) {
                        $fabricId = intval($order['fabric_id'] ?? 0);
                        if ($fabricId > 0) {
                            $fabricCostPrice = floatval(execute_query($pdo, "SELECT cost_price FROM fabrics WHERE id = ?", [$fabricId])->fetchColumn() ?? 0);
                        }
                    }
                    $fabricUnitCost = round(max(0.0, $cpp) * max(0.0, $fabricCostPrice), 4);

                    if (table_exists($pdo, 'factory_product_stage_accessories') && table_exists($pdo, 'accessories')) {
                        $accSum = execute_query(
                            $pdo,
                            "SELECT SUM(fpsa.quantity * COALESCE(a.cost_price, 0))
                             FROM factory_product_stage_accessories fpsa
                             JOIN accessories a ON a.id = fpsa.accessory_id
                             WHERE fpsa.factory_product_id = ?",
                            [$productId]
                        )->fetchColumn();
                        $accessoriesUnitCost = floatval($accSum ?? 0);
                    }

                    $uids = [];
                    foreach ($sel as $r) {
                        $u = isset($r['piece_uid']) ? trim((string)$r['piece_uid']) : '';
                        if ($u !== '') $uids[$u] = true;
                    }
                    $uids = array_keys($uids);
                    if (count($uids) > 0) {
                        $inU = implode(',', array_fill(0, count($uids), '?'));
                        $wageTotal = execute_query(
                            $pdo,
                            "SELECT COALESCE(SUM(piece_rate), 0)
                             FROM product_tracking
                             WHERE is_paid = 1 AND piece_uid IN ($inU)",
                            $uids
                        )->fetchColumn();
                        $wageTotal = floatval($wageTotal ?? 0);
                        $wageUnitCost = $qty > 0 ? round($wageTotal / $qty, 4) : 0.0;
                    }
                } catch (Exception $e) {
                    // ignore
                }
                $unitCost = round($fabricUnitCost + $accessoriesUnitCost + $wageUnitCost, 4);

                // Update cutting order quantities
                execute_query(
                    $pdo,
                    "UPDATE cutting_orders SET in_production_qty = GREATEST(in_production_qty - ?, 0), ready_qty = ready_qty + ? WHERE id = ?",
                    [$qty, $qty, $cutting_order_id]
                );

                // Add ready products to factory_stock (selected warehouse)
                $cur = execute_query(
                    $pdo,
                    "SELECT quantity FROM factory_stock WHERE factory_product_id = ? AND warehouse_id = ? FOR UPDATE",
                    [$productId, $warehouse_id]
                )->fetchColumn();
                $prevQty = ($cur === false || $cur === null) ? 0 : intval($cur);
                if ($cur === false || $cur === null) {
                    execute_query($pdo, "INSERT INTO factory_stock (factory_product_id, warehouse_id, quantity) VALUES (?, ?, ?)", [$productId, $warehouse_id, $qty]);
                    $newQty = $qty;
                } else {
                    execute_query($pdo, "UPDATE factory_stock SET quantity = quantity + ? WHERE factory_product_id = ? AND warehouse_id = ?", [$qty, $productId, $warehouse_id]);
                    $newQty = $prevQty + $qty;
                }

                if (table_exists($pdo, 'factory_product_movements')) {
                    $notes = json_encode([
                        'cutting_order_id' => $cutting_order_id,
                        'stage_id' => $from_stage_id,
                        'qty' => $qty,
                        'unit_cost' => $unitCost,
                        'fabric_unit_cost' => $fabricUnitCost,
                        'accessories_unit_cost' => $accessoriesUnitCost,
                        'wage_unit_cost' => $wageUnitCost
                    ]);
                    execute_query(
                        $pdo,
                        "INSERT INTO factory_product_movements (factory_product_id, warehouse_id, movement_type, quantity_change, previous_quantity, new_quantity, reference_id, reference_type, notes, created_by)
                         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                        [$productId, $warehouse_id, 'manufacturing_finish', $qty, $prevQty, $newQty, $cutting_order_id, 'cutting_order', $notes, $created_by]
                    );
                }

                $pdo->commit();

                $outPieces = [];
                foreach ($finishedPieces as $p) {
                    $sid0 = intval($p['size_id'] ?? 0);
                    $sn = $sizeNames[$sid0]['name'] ?? null;
                    $sc = $sizeNames[$sid0]['code'] ?? null;
                    $outPieces[] = [
                        'piece_uid' => $p['piece_uid'],
                        'size_id' => $sid0,
                        'size_name' => $sn,
                        'size_code' => $sc,
                        'color' => $fabricColor,
                    ];
                }

                echo json_encode(['success'=>true,'data'=>['finished_pieces'=>$outPieces]]);
            } catch (Exception $e) {
                try { if ($pdo->inTransaction()) $pdo->rollBack(); } catch (Exception $ex) {}
                http_response_code(500);
                echo json_encode(['success'=>false,'message'=>$e->getMessage()]);
            }
            break;
        }

        http_response_code(404);
        echo json_encode(['success'=>false,'message'=>'Unknown action']);
        break;
    case 'fabrics':
        $action = $_GET['action'] ?? 'getAll';
        if ($action === 'getMovements') {
            check_permission_or_die($pdo, 'fabrics', 'view');
            $fabric_id = intval($_GET['fabric_id'] ?? ($input['fabric_id'] ?? 0));
            $warehouse_id = intval($_GET['warehouse_id'] ?? 0);
            if (!$fabric_id) { http_response_code(400); echo json_encode(['success'=>false,'message'=>'fabric_id required']); break; }

            $rows = [];
            if (table_exists($pdo, 'fabric_movements')) {
                $where = "m.fabric_id = ?";
                $params = [$fabric_id];
                if ($warehouse_id > 0) { $where .= " AND m.warehouse_id = ?"; $params[] = $warehouse_id; }
                $sql = "SELECT m.*, w.name AS warehouse_name, u.name AS created_by_name
                        FROM fabric_movements m
                        LEFT JOIN warehouses w ON w.id = m.warehouse_id
                        LEFT JOIN users u ON u.id = m.created_by
                        WHERE $where";
                $rows = execute_query($pdo, $sql, $params)->fetchAll(PDO::FETCH_ASSOC);
            }

            // Backfill from cutting_orders so cutting deductions appear even when movement logs are missing.
            if (table_exists($pdo, 'cutting_orders')) {
                $existingRefs = [];
                foreach ($rows as $r) {
                    $rt = (string)($r['reference_type'] ?? '');
                    if ($rt === 'cutting_order') {
                        $rid = intval($r['reference_id'] ?? 0);
                        if ($rid > 0) $existingRefs[$rid] = true;
                    }
                }

                $coParams = [$fabric_id];
                $coWhere = "co.fabric_id = ?";
                if ($warehouse_id > 0) { $coWhere .= " AND co.warehouse_id = ?"; $coParams[] = $warehouse_id; }

                $coSql = "SELECT co.id, co.code, co.warehouse_id, co.factory_product_id, co.cut_quantity, co.consumption_per_piece, co.total_consumption, co.created_by, co.created_at,
                                 w.name AS warehouse_name, u.name AS created_by_name
                          FROM cutting_orders co
                          LEFT JOIN warehouses w ON w.id = co.warehouse_id
                          LEFT JOIN users u ON u.id = co.created_by
                          WHERE $coWhere
                          ORDER BY co.created_at DESC, co.id DESC";
                $cos = execute_query($pdo, $coSql, $coParams)->fetchAll(PDO::FETCH_ASSOC);

                foreach ($cos as $co) {
                    $coId = intval($co['id'] ?? 0);
                    if ($coId <= 0) continue;
                    if (isset($existingRefs[$coId])) continue;
                    $total = floatval($co['total_consumption'] ?? 0);
                    if ($total <= 0) continue;

                    $notes = json_encode([
                        'cutting_order_id' => $coId,
                        'cutting_order_code' => (string)($co['code'] ?? ''),
                        'factory_product_id' => intval($co['factory_product_id'] ?? 0),
                        'cut_quantity' => intval($co['cut_quantity'] ?? 0),
                        'consumption_per_piece' => floatval($co['consumption_per_piece'] ?? 0),
                        'total_consumption' => $total
                    ]);

                    $rows[] = [
                        'id' => 'co_' . $coId,
                        'fabric_id' => $fabric_id,
                        'warehouse_id' => intval($co['warehouse_id'] ?? 0),
                        'movement_type' => 'cutting_order',
                        'quantity_change' => -$total,
                        'previous_quantity' => null,
                        'new_quantity' => null,
                        'reference_id' => $coId,
                        'reference_type' => 'cutting_order',
                        'notes' => $notes,
                        'created_by' => $co['created_by'] ?? null,
                        'created_at' => $co['created_at'] ?? null,
                        'warehouse_name' => $co['warehouse_name'] ?? null,
                        'created_by_name' => $co['created_by_name'] ?? null,
                    ];
                }
            }

            usort($rows, function($a, $b) {
                $ta = strtotime((string)($a['created_at'] ?? ''));
                $tb = strtotime((string)($b['created_at'] ?? ''));
                if ($ta === $tb) return 0;
                return ($ta > $tb) ? -1 : 1;
            });

            // Fill missing before/after for backfilled rows (cutting_orders) using current stock as anchor.
            // We iterate newest->oldest (current sort order). For each warehouse:
            // new_quantity = runningQty, previous_quantity = runningQty - quantity_change.
            if (table_exists($pdo, 'fabric_stock') && count($rows) > 0) {
                $stockWhere = "fabric_id = ?";
                $stockParams = [$fabric_id];
                if ($warehouse_id > 0) { $stockWhere .= " AND warehouse_id = ?"; $stockParams[] = $warehouse_id; }
                $stockRows = execute_query(
                    $pdo,
                    "SELECT warehouse_id, quantity FROM fabric_stock WHERE $stockWhere",
                    $stockParams
                )->fetchAll(PDO::FETCH_ASSOC);

                $runningByWh = [];
                foreach ($stockRows as $sr) {
                    $wid = intval($sr['warehouse_id'] ?? 0);
                    if ($wid > 0) $runningByWh[$wid] = floatval($sr['quantity'] ?? 0);
                }

                foreach ($rows as &$r) {
                    $wid = intval($r['warehouse_id'] ?? 0);
                    if ($wid <= 0) continue;

                    $hasPrevNew = array_key_exists('previous_quantity', $r) && array_key_exists('new_quantity', $r)
                        && $r['previous_quantity'] !== null && $r['new_quantity'] !== null;

                    if ($hasPrevNew) {
                        $runningByWh[$wid] = floatval($r['previous_quantity']);
                        continue;
                    }

                    if (!array_key_exists($wid, $runningByWh)) continue;

                    $newQty = floatval($runningByWh[$wid]);
                    $chg = floatval($r['quantity_change'] ?? 0);
                    $prevQty = $newQty - $chg;

                    $r['new_quantity'] = $newQty;
                    $r['previous_quantity'] = $prevQty;
                    $runningByWh[$wid] = $prevQty;
                }
                unset($r);
            }

            echo json_encode(['success'=>true,'data'=>$rows]);
            break;
        }
        if ($action === 'getAll') {
            check_permission_or_die($pdo, 'fabrics', 'view');
            // Multi-warehouse: return aggregated quantity + warehouse display info
            $sql = "SELECT
                        f.*,
                        COALESCE(SUM(fs.quantity), 0) AS quantity,
                        COUNT(DISTINCT fs.warehouse_id) AS warehouse_count,
                        CASE WHEN COUNT(DISTINCT fs.warehouse_id) = 1 THEN MIN(fs.warehouse_id) ELSE NULL END AS one_warehouse_id,
                        GROUP_CONCAT(DISTINCT w.name ORDER BY w.name SEPARATOR '، ') AS warehouse_names
                    FROM fabrics f
                    LEFT JOIN fabric_stock fs ON fs.fabric_id = f.id
                    LEFT JOIN warehouses w ON w.id = fs.warehouse_id
                    GROUP BY f.id
                    ORDER BY f.id DESC";
            $rows = execute_query($pdo, $sql)->fetchAll(PDO::FETCH_ASSOC);
            echo json_encode(['success' => true, 'data' => $rows]);
            break;
        }
        if ($action === 'getByWarehouse') {
            check_permission_or_die($pdo, 'fabrics', 'view');
            $warehouse_id = intval($_GET['warehouse_id'] ?? ($input['warehouse_id'] ?? 0));
            if ($warehouse_id <= 0) { http_response_code(400); echo json_encode(['success'=>false,'message'=>'warehouse_id required']); break; }

            $select = "f.id, f.name, f.code, f.color, f.cost_price";
            if (column_exists($pdo, 'fabrics', 'size')) $select .= ", f.size";
            if (column_exists($pdo, 'fabrics', 'unit')) $select .= ", f.unit";
            $sql = "SELECT $select, fs.quantity
                    FROM fabrics f
                    JOIN fabric_stock fs ON fs.fabric_id = f.id
                    WHERE fs.warehouse_id = ? AND fs.quantity > 0
                    ORDER BY f.id DESC";
            $rows = execute_query($pdo, $sql, [$warehouse_id])->fetchAll(PDO::FETCH_ASSOC);
            echo json_encode(['success'=>true,'data'=>$rows]);
            break;
        }
        if ($action === 'getStock') {
            check_permission_or_die($pdo, 'fabrics', 'view');
            $fabric_id = intval($_GET['fabric_id'] ?? ($input['fabric_id'] ?? 0));
            if (!$fabric_id) { http_response_code(400); echo json_encode(['success'=>false,'message'=>'fabric_id required']); break; }
            $sql = "SELECT fs.warehouse_id, w.name AS warehouse_name, fs.quantity
                    FROM fabric_stock fs
                    LEFT JOIN warehouses w ON w.id = fs.warehouse_id
                    WHERE fs.fabric_id = ?
                    ORDER BY w.name ASC";
            $rows = execute_query($pdo, $sql, [$fabric_id])->fetchAll(PDO::FETCH_ASSOC);
            echo json_encode(['success'=>true,'data'=>$rows]);
            break;
        }
        if ($action === 'getStockQty') {
            check_permission_or_die($pdo, 'fabrics', 'view');
            $fabric_id = intval($_GET['fabric_id'] ?? ($input['fabric_id'] ?? 0));
            $warehouse_id = intval($_GET['warehouse_id'] ?? ($input['warehouse_id'] ?? 0));
            if (!$fabric_id || !$warehouse_id) { http_response_code(400); echo json_encode(['success'=>false,'message'=>'fabric_id and warehouse_id required']); break; }
            $qty = execute_query($pdo, "SELECT quantity FROM fabric_stock WHERE fabric_id = ? AND warehouse_id = ?", [$fabric_id, $warehouse_id])->fetchColumn();
            echo json_encode(['success'=>true,'data'=>['quantity'=>floatval($qty ?: 0)]]);
            break;
        }

        if ($action === 'add' || $action === 'create') {
            check_permission_or_die($pdo, 'fabrics', 'add');
            $name = trim((string)($input['name'] ?? ''));
            $code = trim((string)($input['code'] ?? ''));
            $color = trim((string)($input['color'] ?? ''));
            $cost_price = isset($input['cost_price']) ? floatval($input['cost_price']) : 0;
            $min_stock = isset($input['min_stock']) ? intval($input['min_stock']) : 0;
            $warehouse_id = intval($input['warehouse_id'] ?? 0);
            $qty = isset($input['quantity']) ? floatval($input['quantity']) : 0;
            if ($name === '' || $warehouse_id <= 0) {
                http_response_code(400);
                echo json_encode(['success'=>false,'message'=>'name and warehouse_id are required']);
                break;
            }

            try {
                $pdo->beginTransaction();

                // Insert fabric master
                $fields = ['name','code','color','cost_price','min_stock'];
                $vals = [$name, $code !== '' ? $code : null, $color !== '' ? $color : null, $cost_price, $min_stock];
                // Optional columns
                if (column_exists($pdo, 'fabrics', 'unit') && isset($input['unit'])) { $fields[] = 'unit'; $vals[] = $input['unit']; }
                if (column_exists($pdo, 'fabrics', 'size') && isset($input['size'])) { $fields[] = 'size'; $vals[] = $input['size']; }
                if (column_exists($pdo, 'fabrics', 'material') && isset($input['material'])) { $fields[] = 'material'; $vals[] = $input['material']; }
                if (column_exists($pdo, 'fabrics', 'quantity')) { /* keep 0 in master for compatibility */ }

                $cols = implode(',', $fields);
                $ph = implode(',', array_fill(0, count($fields), '?'));
                execute_query($pdo, "INSERT INTO fabrics ($cols) VALUES ($ph)", $vals);
                $fabricId = intval($pdo->lastInsertId());

                // Insert initial stock for selected warehouse
                execute_query(
                    $pdo,
                    "INSERT INTO fabric_stock (fabric_id, warehouse_id, quantity) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE quantity = VALUES(quantity)",
                    [$fabricId, $warehouse_id, $qty]
                );

                if (table_exists($pdo, 'fabric_movements') && abs($qty) > 1e-9) {
                    $notes = json_encode(['reason' => 'initial_stock', 'source' => 'fabrics.add']);
                    execute_query(
                        $pdo,
                        "INSERT INTO fabric_movements (fabric_id, warehouse_id, movement_type, quantity_change, previous_quantity, new_quantity, reference_id, reference_type, notes, created_by)
                         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                        [$fabricId, $warehouse_id, 'initial_balance', $qty, 0, $qty, $fabricId, 'fabric', $notes, $current_user]
                    );
                }

                $pdo->commit();
                echo json_encode(['success'=>true,'data'=>['id'=>$fabricId]]);
            } catch (Exception $e) {
                try { $pdo->rollBack(); } catch (Exception $ex) {}
                http_response_code(500);
                echo json_encode(['success'=>false,'message'=>'Failed to add fabric.']);
            }
            break;
        }

        if ($action === 'update') {
            check_permission_or_die($pdo, 'fabrics', 'edit');
            $id = intval($input['id'] ?? 0);
            if (!$id) { http_response_code(400); echo json_encode(['success'=>false,'message'=>'id required']); break; }

            $warehouse_id = intval($input['warehouse_id'] ?? 0);
            $qty = isset($input['quantity']) ? floatval($input['quantity']) : null;

            try {
                $pdo->beginTransaction();

                $set = [];
                $vals = [];
                foreach (['name','code','color','cost_price','min_stock','unit','size','material'] as $f) {
                    if (isset($input[$f]) && column_exists($pdo, 'fabrics', $f)) {
                        $set[] = "$f = ?";
                        $vals[] = $input[$f];
                    }
                }
                if (count($set) > 0) {
                    $vals[] = $id;
                    execute_query($pdo, "UPDATE fabrics SET " . implode(', ', $set) . " WHERE id = ?", $vals);
                }

                if ($warehouse_id > 0 && $qty !== null) {
                    $prevQty = 0.0;
                    $qRow = execute_query($pdo, "SELECT quantity FROM fabric_stock WHERE fabric_id = ? AND warehouse_id = ? FOR UPDATE", [$id, $warehouse_id])->fetch(PDO::FETCH_ASSOC);
                    if ($qRow) $prevQty = floatval($qRow['quantity']);
                    execute_query(
                        $pdo,
                        "INSERT INTO fabric_stock (fabric_id, warehouse_id, quantity) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE quantity = VALUES(quantity)",
                        [$id, $warehouse_id, $qty]
                    );
                    $newQty = floatval($qty);
                    $diff = $newQty - $prevQty;
                    if (table_exists($pdo, 'fabric_movements') && abs($diff) > 1e-9) {
                        $notes = json_encode(['reason' => 'manual_set', 'source' => 'fabrics.update']);
                        execute_query(
                            $pdo,
                            "INSERT INTO fabric_movements (fabric_id, warehouse_id, movement_type, quantity_change, previous_quantity, new_quantity, reference_id, reference_type, notes, created_by)
                             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                            [$id, $warehouse_id, 'adjustment', $diff, $prevQty, $newQty, $id, 'fabric', $notes, $current_user]
                        );
                    }
                }

                $pdo->commit();
                echo json_encode(['success'=>true]);
            } catch (Exception $e) {
                try { $pdo->rollBack(); } catch (Exception $ex) {}
                http_response_code(500);
                echo json_encode(['success'=>false,'message'=>'Failed to update fabric.']);
            }
            break;
        }

        if ($action === 'delete') {
            check_permission_or_die($pdo, 'fabrics', 'delete');
            $id = intval($input['id'] ?? 0);
            if (!$id) { http_response_code(400); echo json_encode(['success'=>false,'message'=>'id required']); break; }
            execute_query($pdo, "DELETE FROM fabrics WHERE id = ?", [$id]);
            echo json_encode(['success'=>true]);
            break;
        }

        http_response_code(404);
        echo json_encode(['success'=>false,'message'=>"Action '$action' not supported."]);
        break;
    case 'accessories':
        $action = $_GET['action'] ?? 'getAll';
        if ($action === 'getMovements') {
            check_permission_or_die($pdo, 'accessories', 'view');
            $accessory_id = intval($_GET['accessory_id'] ?? ($input['accessory_id'] ?? 0));
            $warehouse_id = intval($_GET['warehouse_id'] ?? 0);
            if (!$accessory_id) { http_response_code(400); echo json_encode(['success'=>false,'message'=>'accessory_id required']); break; }
            if (!table_exists($pdo, 'accessory_movements')) { echo json_encode(['success'=>true,'data'=>[]]); break; }
            $where = "m.accessory_id = ?";
            $params = [$accessory_id];
            if ($warehouse_id > 0) { $where .= " AND m.warehouse_id = ?"; $params[] = $warehouse_id; }
            $sql = "SELECT m.*, w.name AS warehouse_name, u.name AS created_by_name
                    FROM accessory_movements m
                    LEFT JOIN warehouses w ON w.id = m.warehouse_id
                    LEFT JOIN users u ON u.id = m.created_by
                    WHERE $where
                    ORDER BY m.created_at DESC, m.id DESC";
            $rows = execute_query($pdo, $sql, $params)->fetchAll(PDO::FETCH_ASSOC);
            echo json_encode(['success'=>true,'data'=>$rows]);
            break;
        }
        if ($action === 'getAll') {
            check_permission_or_die($pdo, 'accessories', 'view');
            // Multi-warehouse: return aggregated quantity + warehouse display info
            $sql = "SELECT
                        a.*,
                        COALESCE(SUM(s.quantity), 0) AS quantity,
                        COUNT(DISTINCT s.warehouse_id) AS warehouse_count,
                        CASE WHEN COUNT(DISTINCT s.warehouse_id) = 1 THEN MIN(s.warehouse_id) ELSE NULL END AS one_warehouse_id,
                        GROUP_CONCAT(DISTINCT w.name ORDER BY w.name SEPARATOR '، ') AS warehouse_names
                    FROM accessories a
                    LEFT JOIN accessory_stock s ON s.accessory_id = a.id
                    LEFT JOIN warehouses w ON w.id = s.warehouse_id
                    GROUP BY a.id
                    ORDER BY a.id DESC";
            $rows = execute_query($pdo, $sql)->fetchAll(PDO::FETCH_ASSOC);
            echo json_encode(['success' => true, 'data' => $rows]);
            break;
        }
        if ($action === 'getByWarehouse') {
            check_permission_or_die($pdo, 'accessories', 'view');
            $warehouse_id = intval($_GET['warehouse_id'] ?? ($input['warehouse_id'] ?? 0));
            if ($warehouse_id <= 0) { http_response_code(400); echo json_encode(['success'=>false,'message'=>'warehouse_id required']); break; }

            $select = "a.id, a.name, a.code, a.color, a.cost_price";
            if (column_exists($pdo, 'accessories', 'size')) $select .= ", a.size";
            if (column_exists($pdo, 'accessories', 'unit')) $select .= ", a.unit";
            $sql = "SELECT $select, s.quantity
                    FROM accessories a
                    JOIN accessory_stock s ON s.accessory_id = a.id
                    WHERE s.warehouse_id = ? AND s.quantity > 0
                    ORDER BY a.id DESC";
            $rows = execute_query($pdo, $sql, [$warehouse_id])->fetchAll(PDO::FETCH_ASSOC);
            echo json_encode(['success'=>true,'data'=>$rows]);
            break;
        }
        if ($action === 'getStock') {
            check_permission_or_die($pdo, 'accessories', 'view');
            $accessory_id = intval($_GET['accessory_id'] ?? ($input['accessory_id'] ?? 0));
            if (!$accessory_id) { http_response_code(400); echo json_encode(['success'=>false,'message'=>'accessory_id required']); break; }
            $sql = "SELECT s.warehouse_id, w.name AS warehouse_name, s.quantity
                    FROM accessory_stock s
                    LEFT JOIN warehouses w ON w.id = s.warehouse_id
                    WHERE s.accessory_id = ?
                    ORDER BY w.name ASC";
            $rows = execute_query($pdo, $sql, [$accessory_id])->fetchAll(PDO::FETCH_ASSOC);
            echo json_encode(['success'=>true,'data'=>$rows]);
            break;
        }
        if ($action === 'getStockQty') {
            check_permission_or_die($pdo, 'accessories', 'view');
            $accessory_id = intval($_GET['accessory_id'] ?? ($input['accessory_id'] ?? 0));
            $warehouse_id = intval($_GET['warehouse_id'] ?? ($input['warehouse_id'] ?? 0));
            if (!$accessory_id || !$warehouse_id) { http_response_code(400); echo json_encode(['success'=>false,'message'=>'accessory_id and warehouse_id required']); break; }
            $qty = execute_query($pdo, "SELECT quantity FROM accessory_stock WHERE accessory_id = ? AND warehouse_id = ?", [$accessory_id, $warehouse_id])->fetchColumn();
            echo json_encode(['success'=>true,'data'=>['quantity'=>intval($qty ?: 0)]]);
            break;
        }

        if ($action === 'add' || $action === 'create') {
            check_permission_or_die($pdo, 'accessories', 'add');
            $name = trim((string)($input['name'] ?? ''));
            $code = trim((string)($input['code'] ?? ''));
            $color = trim((string)($input['color'] ?? ''));
            $cost_price = isset($input['cost_price']) ? floatval($input['cost_price']) : 0;
            $min_stock = isset($input['min_stock']) ? intval($input['min_stock']) : 0;
            $warehouse_id = intval($input['warehouse_id'] ?? 0);
            $qty = isset($input['quantity']) ? intval($input['quantity']) : 0;
            if ($name === '' || $warehouse_id <= 0) {
                http_response_code(400);
                echo json_encode(['success'=>false,'message'=>'name and warehouse_id are required']);
                break;
            }
            try {
                $pdo->beginTransaction();
                $fields = ['name','code','color','cost_price','min_stock'];
                $vals = [$name, $code !== '' ? $code : null, $color !== '' ? $color : null, $cost_price, $min_stock];
                if (column_exists($pdo, 'accessories', 'unit') && isset($input['unit'])) { $fields[] = 'unit'; $vals[] = $input['unit']; }
                if (column_exists($pdo, 'accessories', 'type') && isset($input['type'])) { $fields[] = 'type'; $vals[] = $input['type']; }
                if (column_exists($pdo, 'accessories', 'size') && isset($input['size'])) { $fields[] = 'size'; $vals[] = $input['size']; }
                $cols = implode(',', $fields);
                $ph = implode(',', array_fill(0, count($fields), '?'));
                execute_query($pdo, "INSERT INTO accessories ($cols) VALUES ($ph)", $vals);
                $accId = intval($pdo->lastInsertId());
                execute_query(
                    $pdo,
                    "INSERT INTO accessory_stock (accessory_id, warehouse_id, quantity) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE quantity = VALUES(quantity)",
                    [$accId, $warehouse_id, $qty]
                );

                if (table_exists($pdo, 'accessory_movements') && intval($qty) != 0) {
                    $notes = json_encode(['reason' => 'initial_stock', 'source' => 'accessories.add']);
                    execute_query(
                        $pdo,
                        "INSERT INTO accessory_movements (accessory_id, warehouse_id, movement_type, quantity_change, previous_quantity, new_quantity, reference_id, reference_type, notes, created_by)
                         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                        [$accId, $warehouse_id, 'initial_balance', intval($qty), 0, intval($qty), $accId, 'accessory', $notes, $current_user]
                    );
                }
                $pdo->commit();
                echo json_encode(['success'=>true,'data'=>['id'=>$accId]]);
            } catch (Exception $e) {
                try { $pdo->rollBack(); } catch (Exception $ex) {}
                http_response_code(500);
                echo json_encode(['success'=>false,'message'=>'Failed to add accessory.']);
            }
            break;
        }

        if ($action === 'update') {
            check_permission_or_die($pdo, 'accessories', 'edit');
            $id = intval($input['id'] ?? 0);
            if (!$id) { http_response_code(400); echo json_encode(['success'=>false,'message'=>'id required']); break; }
            $warehouse_id = intval($input['warehouse_id'] ?? 0);
            $qty = isset($input['quantity']) ? intval($input['quantity']) : null;
            try {
                $pdo->beginTransaction();
                $set = [];
                $vals = [];
                foreach (['name','code','color','cost_price','min_stock','unit','type','size'] as $f) {
                    if (isset($input[$f]) && column_exists($pdo, 'accessories', $f)) {
                        $set[] = "$f = ?";
                        $vals[] = $input[$f];
                    }
                }
                if (count($set) > 0) {
                    $vals[] = $id;
                    execute_query($pdo, "UPDATE accessories SET " . implode(', ', $set) . " WHERE id = ?", $vals);
                }
                if ($warehouse_id > 0 && $qty !== null) {
                    $prevQty = 0;
                    $qRow = execute_query($pdo, "SELECT quantity FROM accessory_stock WHERE accessory_id = ? AND warehouse_id = ? FOR UPDATE", [$id, $warehouse_id])->fetch(PDO::FETCH_ASSOC);
                    if ($qRow) $prevQty = intval($qRow['quantity']);
                    execute_query(
                        $pdo,
                        "INSERT INTO accessory_stock (accessory_id, warehouse_id, quantity) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE quantity = VALUES(quantity)",
                        [$id, $warehouse_id, intval($qty)]
                    );
                    $newQty = intval($qty);
                    $diff = $newQty - $prevQty;
                    if (table_exists($pdo, 'accessory_movements') && $diff != 0) {
                        $notes = json_encode(['reason' => 'manual_set', 'source' => 'accessories.update']);
                        execute_query(
                            $pdo,
                            "INSERT INTO accessory_movements (accessory_id, warehouse_id, movement_type, quantity_change, previous_quantity, new_quantity, reference_id, reference_type, notes, created_by)
                             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                            [$id, $warehouse_id, 'adjustment', $diff, $prevQty, $newQty, $id, 'accessory', $notes, $current_user]
                        );
                    }
                }
                $pdo->commit();
                echo json_encode(['success'=>true]);
            } catch (Exception $e) {
                try { $pdo->rollBack(); } catch (Exception $ex) {}
                http_response_code(500);
                echo json_encode(['success'=>false,'message'=>'Failed to update accessory.']);
            }
            break;
        }

        if ($action === 'delete') {
            check_permission_or_die($pdo, 'accessories', 'delete');
            $id = intval($input['id'] ?? 0);
            if (!$id) { http_response_code(400); echo json_encode(['success'=>false,'message'=>'id required']); break; }
            execute_query($pdo, "DELETE FROM accessories WHERE id = ?", [$id]);
            echo json_encode(['success'=>true]);
            break;
        }

        http_response_code(404);
        echo json_encode(['success'=>false,'message'=>"Action '$action' not supported."]);
        break;
    case 'production_stages':
        handle_crud($pdo, 'production_stages', $input, ['name', 'order_num', 'description']);
        break;
    case 'colors':
        handle_crud($pdo, 'colors', $input, ['name', 'code']);
        break;
    case 'sizes':
        handle_crud($pdo, 'sizes', $input, ['name', 'code']);
        break;
    case 'customers':
        $action = $_GET['action'] ?? 'getAll';

        if ($action === 'getAll') {
            $include_archived = ($_GET['include_archived'] ?? '') === '1';
            $hasArchived = column_exists($pdo, 'customers', 'is_archived');
            $where = '';
            $params = [];
            if ($hasArchived && !$include_archived) {
                $where = 'WHERE (is_archived = 0 OR is_archived IS NULL)';
            }
            $stmt = execute_query($pdo, "SELECT *, (total_credit - total_debit) as balance FROM customers $where ORDER BY id DESC", $params);
            echo json_encode(['success' => true, 'data' => $stmt->fetchAll(PDO::FETCH_ASSOC)]);
            break;
        }

        if ($action === 'archive' || $action === 'unarchive') {
            check_permission_or_die($pdo, 'customers', 'edit');
            if (!column_exists($pdo, 'customers', 'is_archived')) {
                http_response_code(500);
                echo json_encode(['success'=>false,'message'=>'Archive columns are missing. Run the CRM/SRM migration.']);
                break;
            }
            $id = intval($input['id'] ?? ($_GET['id'] ?? 0));
            if (!$id) { http_response_code(400); echo json_encode(['success'=>false,'message'=>'ID is required.']); break; }
            $isArchived = $action === 'archive' ? 1 : 0;
            $archivedAt = $action === 'archive' ? date('Y-m-d H:i:s') : null;
            try {
                execute_query($pdo, "UPDATE customers SET is_archived = ?, archived_at = ? WHERE id = ?", [$isArchived, $archivedAt, $id]);
                audit_log($pdo, 'customers', $action, $id, null);
                echo json_encode(['success'=>true]);
            } catch (Exception $e) {
                http_response_code(500);
                echo json_encode(['success'=>false,'message'=>'Failed to update archive status.']);
            }
            break;
        }

        if ($action === 'getLedger') {
            check_permission_or_die($pdo, 'customers', 'view');
            $customer_id = intval($_GET['customer_id'] ?? 0);
            $start_date = $_GET['start_date'] ?? date('Y-m-01');
            $end_date = $_GET['end_date'] ?? date('Y-m-t');
            if (!$customer_id) { http_response_code(400); echo json_encode(['success'=>false,'message'=>'customer_id required']); break; }

            $txSql = "SELECT id, transaction_date, type, amount, details FROM transactions WHERE related_to_type = 'customer' AND related_to_id = ? AND transaction_date BETWEEN ? AND ? ORDER BY transaction_date ASC, id ASC";
            $txParams = [$customer_id, $start_date . ' 00:00:00', $end_date . ' 23:59:59'];
            $rows = execute_query($pdo, $txSql, $txParams)->fetchAll(PDO::FETCH_ASSOC);

            $beforeSql = "SELECT id, transaction_date, type, amount, details FROM transactions WHERE related_to_type = 'customer' AND related_to_id = ? AND transaction_date < ?";
            $beforeRows = execute_query($pdo, $beforeSql, [$customer_id, $start_date . ' 00:00:00'])->fetchAll(PDO::FETCH_ASSOC);

            $map_debit_credit = function($row) {
                $type = strtolower((string)($row['type'] ?? ''));
                $amount = floatval($row['amount'] ?? 0);
                $debit = 0.0; $credit = 0.0;
                if ($type === 'sale') { $debit = $amount; }
                elseif ($type === 'return_in') { $credit = $amount; }
                elseif ($type === 'payment_in') { $credit = $amount; }
                elseif ($type === 'payment_out') { $credit = $amount; }
                else { $credit = $amount; }
                return [$debit, $credit];
            };

            $openingDebit = 0.0; $openingCredit = 0.0;
            foreach ($beforeRows as $r) {
                list($d, $c) = $map_debit_credit($r);
                $openingDebit += $d;
                $openingCredit += $c;
            }
            $openingBalance = $openingCredit - $openingDebit;

            $entries = [];
            foreach ($rows as $r) {
                list($debit, $credit) = $map_debit_credit($r);
                $desc = '';
                $details = [];
                if (!empty($r['details'])) {
                    $decoded = json_decode($r['details'], true);
                    if (is_array($decoded)) $details = $decoded;
                }
                if (isset($details['paid_for'])) $desc = 'دفعة على فاتورة #' . $details['paid_for'];
                elseif (isset($details['refund_for'])) $desc = 'استرجاع فاتورة #' . $details['refund_for'];
                elseif (is_array($details) && count($details) > 0 && isset($details[0]['name'])) $desc = 'فاتورة بيع';
                else $desc = $r['type'] ?? '';

                $entries[] = [
                    'id' => $r['id'],
                    'date' => $r['transaction_date'],
                    'type' => $r['type'],
                    'description' => $desc,
                    'debit' => $debit,
                    'credit' => $credit,
                    'details' => $r['details']
                ];
            }

            $balance = $openingBalance;
            foreach ($entries as &$e) {
                $balance += ($e['credit'] - $e['debit']);
                $e['balance'] = $balance;
            }

            echo json_encode([
                'success' => true,
                'data' => [
                    'opening_balance' => $openingBalance,
                    'entries' => $entries
                ]
            ]);
            break;
        }

        if ($action === 'getInteractions') {
            check_permission_or_die($pdo, 'customers', 'view');
            $customer_id = intval($_GET['customer_id'] ?? 0);
            if (!$customer_id) { http_response_code(400); echo json_encode(['success'=>false,'message'=>'customer_id required']); break; }
            $stmt = execute_query($pdo, "SELECT ci.*, u.name as created_by_name FROM customer_interactions ci LEFT JOIN users u ON u.id = ci.created_by WHERE ci.customer_id = ? ORDER BY ci.created_at DESC", [$customer_id]);
            echo json_encode(['success'=>true,'data'=>$stmt->fetchAll(PDO::FETCH_ASSOC)]);
            break;
        }

        if ($action === 'addInteraction') {
            check_permission_or_die($pdo, 'customers', 'add');
            $customer_id = intval($input['customer_id'] ?? 0);
            $type = trim((string)($input['interaction_type'] ?? 'note'));
            $note = trim((string)($input['note'] ?? ''));
            if (!$customer_id || $note === '') { http_response_code(400); echo json_encode(['success'=>false,'message'=>'customer_id and note required']); break; }
            $uid = $_SESSION['user_id'] ?? null;
            execute_query($pdo, "INSERT INTO customer_interactions (customer_id, interaction_type, note, created_by) VALUES (?, ?, ?, ?)", [$customer_id, $type, $note, $uid]);
            echo json_encode(['success'=>true,'id'=>$pdo->lastInsertId()]);
            break;
        }

        if ($action === 'deleteInteraction') {
            check_permission_or_die($pdo, 'customers', 'delete');
            $id = intval($input['id'] ?? ($_GET['id'] ?? 0));
            if (!$id) { http_response_code(400); echo json_encode(['success'=>false,'message'=>'id required']); break; }
            execute_query($pdo, "DELETE FROM customer_interactions WHERE id = ?", [$id]);
            echo json_encode(['success'=>true]);
            break;
        }

        handle_crud($pdo, 'customers', $input, ['name', 'phone1', 'phone2', 'governorate', 'address', 'landmark'], "*, (total_credit - total_debit) as balance");
        break;
    case 'treasuries':
        // Ensure fixed treasury for representatives insurance exists.
        // This keeps older installs working even if the SQL migration wasn't applied yet.
        try {
            if (table_exists($pdo, 'treasuries') && column_exists($pdo, 'treasuries', 'name')) {
                $exists = execute_query($pdo, "SELECT id FROM treasuries WHERE name = ? LIMIT 1", ['تأمين المناديب'])->fetchColumn();
                if (!$exists) {
                    $hasIsFixed = column_exists($pdo, 'treasuries', 'is_fixed');
                    $hasCreatedAt = column_exists($pdo, 'treasuries', 'created_at');

                    if ($hasIsFixed && $hasCreatedAt) {
                        execute_query($pdo, "INSERT INTO treasuries (name, is_fixed, created_at) VALUES (?, 1, NOW())", ['تأمين المناديب']);
                    } elseif ($hasIsFixed && !$hasCreatedAt) {
                        execute_query($pdo, "INSERT INTO treasuries (name, is_fixed) VALUES (?, 1)", ['تأمين المناديب']);
                    } elseif (!$hasIsFixed && $hasCreatedAt) {
                        execute_query($pdo, "INSERT INTO treasuries (name, created_at) VALUES (?, NOW())", ['تأمين المناديب']);
                    } else {
                        execute_query($pdo, "INSERT INTO treasuries (name) VALUES (?)", ['تأمين المناديب']);
                    }
                }
            }
        } catch (Exception $e) {
            // Don't block treasuries API if auto-create fails.
        }

        // If delivery method is not reps, hide the reps insurance treasury.
        // This matches the UX rule: when reps section is hidden, its treasury should also be hidden.
        try {
            $action = $_GET['action'] ?? 'getAll';
            if ($action === 'getAll' && table_exists($pdo, 'settings')) {
                $delivery = execute_query($pdo, "SELECT config_value FROM settings WHERE config_key = 'delivery_method' LIMIT 1")->fetchColumn();
                $delivery = is_string($delivery) ? strtolower(trim($delivery)) : '';
                if ($delivery !== '' && $delivery !== 'reps') {
                    $stmt = execute_query($pdo, "SELECT id, name, COALESCE(current_balance, 0) as balance FROM treasuries WHERE name <> ?", ['تأمين المناديب']);
                    echo json_encode(['success' => true, 'data' => $stmt->fetchAll(PDO::FETCH_ASSOC)]);
                    break;
                }
            }
        } catch (Exception $e) {
            // On any error, fall back to normal behavior.
        }

        // معالجة الخزينة بشكل صحيح
        handle_crud($pdo, 'treasuries', $input, ['name'], "id, name, COALESCE(current_balance, 0) as balance");
        break;    
    case 'suppliers':
        $action = $_GET['action'] ?? 'getAll';

        if ($action === 'getAll') {
            check_permission_or_die($pdo, 'suppliers', 'view');
            $stmt = execute_query($pdo, "SELECT s.*, COALESCE(SUM(
                CASE
                    WHEN LOWER(COALESCE(t.type, '')) = 'purchase' THEN -ABS(COALESCE(t.amount, 0))
                    WHEN LOWER(COALESCE(JSON_UNQUOTE(JSON_EXTRACT(CASE WHEN JSON_VALID(t.details) THEN t.details ELSE NULL END, '$.subtype')), '')) = 'supplier_payment' THEN
                        CASE
                            WHEN CAST(COALESCE(JSON_UNQUOTE(JSON_EXTRACT(CASE WHEN JSON_VALID(t.details) THEN t.details ELSE NULL END, '$.supplier_balance_before')), '0') AS DECIMAL(20,6)) > 0 THEN -ABS(COALESCE(t.amount, 0))
                            WHEN CAST(COALESCE(JSON_UNQUOTE(JSON_EXTRACT(CASE WHEN JSON_VALID(t.details) THEN t.details ELSE NULL END, '$.supplier_balance_before')), '0') AS DECIMAL(20,6)) < 0 THEN ABS(COALESCE(t.amount, 0))
                            WHEN JSON_EXTRACT(CASE WHEN JSON_VALID(t.details) THEN t.details ELSE NULL END, '$.supplier_balance_before') IS NOT NULL THEN ABS(COALESCE(t.amount, 0))
                            ELSE COALESCE(t.amount, 0)
                        END
                    WHEN LOWER(COALESCE(t.type, '')) = 'return_out' THEN ABS(COALESCE(t.amount, 0))
                    WHEN LOWER(COALESCE(t.type, '')) IN ('payment_out', 'supplier_payment', 'payment') THEN COALESCE(t.amount, 0)
                    ELSE COALESCE(t.amount, 0)
                END
            ), 0) AS balance
            FROM suppliers s
            LEFT JOIN transactions t
                ON t.related_to_type = 'supplier'
               AND t.related_to_id = s.id
            GROUP BY s.id
            ORDER BY s.id DESC");
            echo json_encode(['success' => true, 'data' => $stmt->fetchAll(PDO::FETCH_ASSOC)]);
            break;
        }

        if ($action === 'getLedger') {
            check_permission_or_die($pdo, 'suppliers', 'view');
            $supplier_id = intval($_GET['supplier_id'] ?? 0);
            $start_date = $_GET['start_date'] ?? date('Y-m-01');
            $end_date = $_GET['end_date'] ?? date('Y-m-t');
            if (!$supplier_id) { http_response_code(400); echo json_encode(['success'=>false,'message'=>'supplier_id required']); break; }

            $hasTxCreatedBy = column_exists($pdo, 'transactions', 'created_by');
            $hasUsersTable = table_exists($pdo, 'users');
            $hasUsersName = $hasUsersTable ? column_exists($pdo, 'users', 'name') : false;

            $createdBySelect = ($hasTxCreatedBy && $hasUsersTable && $hasUsersName)
                ? "COALESCE(u.name, '') AS created_by_name"
                : "'' AS created_by_name";
            $createdByJoin = ($hasTxCreatedBy && $hasUsersTable && $hasUsersName)
                ? "LEFT JOIN users u ON u.id = t.created_by"
                : "";

                        $txSql = "SELECT t.id, t.transaction_date, t.type, t.amount, t.details, t.treasury_id,
                                                         tr.name AS treasury_name,
                                                         {$createdBySelect}
                                            FROM transactions t
                                            LEFT JOIN treasuries tr ON tr.id = t.treasury_id
                                            {$createdByJoin}
                                            WHERE t.related_to_type = 'supplier' AND t.related_to_id = ?
                                                AND t.transaction_date BETWEEN ? AND ?
                                            ORDER BY t.transaction_date ASC, t.id ASC";
            $txParams = [$supplier_id, $start_date . ' 00:00:00', $end_date . ' 23:59:59'];
            $rows = execute_query($pdo, $txSql, $txParams)->fetchAll(PDO::FETCH_ASSOC);

            $beforeSql = "SELECT id, transaction_date, type, amount, details FROM transactions WHERE related_to_type = 'supplier' AND related_to_id = ? AND transaction_date < ?";
            $beforeRows = execute_query($pdo, $beforeSql, [$supplier_id, $start_date . ' 00:00:00'])->fetchAll(PDO::FETCH_ASSOC);

            $map_debit_credit = function($row) {
                $type = strtolower((string)($row['type'] ?? ''));
                $amount = floatval($row['amount'] ?? 0);
                $absAmount = abs($amount);
                $subtype = '';
                $supplierBalanceBefore = null;
                if (!empty($row['details'])) {
                    $decoded = json_decode((string)$row['details'], true);
                    if (is_array($decoded)) {
                        if (isset($decoded['subtype'])) {
                            $subtype = strtolower((string)$decoded['subtype']);
                        }
                        if (isset($decoded['supplier_balance_before']) && is_numeric($decoded['supplier_balance_before'])) {
                            $supplierBalanceBefore = floatval($decoded['supplier_balance_before']);
                        }
                    }
                }

                $debit = 0.0; $credit = 0.0;
                if ($type === 'purchase') { $debit = $absAmount; }
                elseif ($subtype === 'supplier_payment') {
                    if ($supplierBalanceBefore !== null) {
                        if ($supplierBalanceBefore > 0) $debit = $absAmount;
                        else $credit = $absAmount;
                    } else {
                        // Legacy rows without supplier_balance_before: fallback to signed amount.
                        if ($amount >= 0) $credit = $amount;
                        else $debit = $absAmount;
                    }
                }
                elseif ($type === 'return_out') { $credit = $absAmount; }
                elseif ($type === 'payment_out' || $type === 'supplier_payment' || $type === 'payment') {
                    if ($amount >= 0) $credit = $amount;
                    else $debit = $absAmount;
                }
                else { $credit = $amount; }
                return [$debit, $credit];
            };

            $openingDebit = 0.0; $openingCredit = 0.0;
            foreach ($beforeRows as $r) {
                list($d, $c) = $map_debit_credit($r);
                $openingDebit += $d;
                $openingCredit += $c;
            }
            $openingBalance = $openingCredit - $openingDebit;

            $entries = [];
            foreach ($rows as $r) {
                list($debit, $credit) = $map_debit_credit($r);
                $desc = '';
                $details = [];
                if (!empty($r['details'])) {
                    $decoded = json_decode($r['details'], true);
                    if (is_array($decoded)) $details = $decoded;
                }
                if (isset($details['paid_for'])) $desc = 'دفعة على فاتورة #' . $details['paid_for'];
                elseif (is_array($details) && count($details) > 0 && isset($details[0]['name'])) $desc = 'فاتورة شراء';
                else $desc = $r['type'] ?? '';

                $entries[] = [
                    'id' => $r['id'],
                    'date' => $r['transaction_date'],
                    'type' => $r['type'],
                    'description' => $desc,
                    'debit' => $debit,
                    'credit' => $credit,
                    'details' => $r['details'],
                    'treasury_id' => $r['treasury_id'] ?? null,
                    'treasury_name' => $r['treasury_name'] ?? '',
                    'created_by_name' => $r['created_by_name'] ?? ''
                ];
            }

            $balance = $openingBalance;
            foreach ($entries as &$e) {
                $balance += ($e['credit'] - $e['debit']);
                $e['balance'] = $balance;
            }

            echo json_encode(['success' => true, 'data' => [
                'opening_balance' => $openingBalance,
                'entries' => $entries
            ]]);
            break;
        }

        if ($action === 'recordPayment') {
            check_permission_or_die($pdo, 'suppliers', 'edit');
            $supplier_id = intval($input['supplier_id'] ?? 0);
            $amount = floatval($input['amount'] ?? 0);
            $treasury_id = intval($input['treasury_id'] ?? 0);
            $notes = trim((string)($input['notes'] ?? ''));
            if (!$supplier_id || $amount <= 0 || !$treasury_id) {
                http_response_code(400);
                echo json_encode(['success'=>false,'message'=>'supplier_id, treasury_id, amount required']);
                break;
            }

            try {
                $pdo->beginTransaction();

                $treasuryStmt = execute_query($pdo, "SELECT current_balance FROM treasuries WHERE id = ? FOR UPDATE", [$treasury_id]);
                $treasury = $treasuryStmt->fetch(PDO::FETCH_ASSOC);
                if (!$treasury || floatval($treasury['current_balance']) < $amount) {
                    throw new Exception('رصيد الخزينة غير كافٍ لإتمام العملية.');
                }

                $supplierBeforeRow = execute_query($pdo, "SELECT (COALESCE(total_credit,0) - COALESCE(total_debit,0)) AS balance_before FROM suppliers WHERE id = ? FOR UPDATE", [$supplier_id])->fetch(PDO::FETCH_ASSOC);
                $supplierBalanceBefore = $supplierBeforeRow ? floatval($supplierBeforeRow['balance_before'] ?? 0) : 0;

                $txType_local = pick_allowed_enum($pdo, 'transactions', 'type', 'supplier_payment', ['supplier_payment','payment_out','payment']);
                $rel_local = pick_allowed_enum($pdo, 'transactions', 'related_to_type', 'supplier', ['supplier','rep','customer','none']);
                $details = ['notes' => $notes, 'subtype' => 'supplier_payment', 'supplier_balance_before' => $supplierBalanceBefore];

                execute_query($pdo, "INSERT INTO transactions (type, treasury_id, related_to_type, related_to_id, amount, transaction_date, details) VALUES (?, ?, ?, ?, ?, NOW(), ?)", [$txType_local, $treasury_id, $rel_local, $supplier_id, $amount, json_encode($details)]);
                execute_query($pdo, "UPDATE treasuries SET current_balance = current_balance - ? WHERE id = ?", [$amount, $treasury_id]);
                if ($supplierBalanceBefore > 0) {
                    execute_query($pdo, "UPDATE suppliers SET total_debit = total_debit + ? WHERE id = ?", [$amount, $supplier_id]);
                } else {
                    execute_query($pdo, "UPDATE suppliers SET total_credit = total_credit + ? WHERE id = ?", [$amount, $supplier_id]);
                }

                $pdo->commit();
                echo json_encode(['success'=>true]);
            } catch (Exception $e) {
                if ($pdo->inTransaction()) $pdo->rollBack();
                http_response_code(500);
                echo json_encode(['success'=>false,'message'=>$e->getMessage()]);
            }
            break;
        }

        handle_crud($pdo, 'suppliers', $input, ['name', 'phone', 'address'], "*, (total_credit - total_debit) as balance");
        break;
    case 'warehouses':
        handle_crud($pdo, 'warehouses', $input, ['name', 'location']);
        break;
    case 'sales_offices':
        $action = $_GET['action'] ?? 'getAll';
        $perm_code = map_action_to_perm($action);
        if ($perm_code) {
            check_permission_or_die($pdo, 'sales_offices', $perm_code);
        }
        // Ensure table exists for sales offices
        try {
            execute_query($pdo, "CREATE TABLE IF NOT EXISTS sales_offices (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                phones TEXT NULL,
                created_at DATETIME DEFAULT NOW()
            )");
        } catch (Exception $e) {
            // ignore creation errors; handle_crud will surface problems
        }
        handle_crud($pdo, 'sales_offices', $input, ['name', 'phones']);
        break;
    case 'shipping_companies':
        $action = $_GET['action'] ?? 'getAll';
        $perm_code = map_action_to_perm($action);
        if ($perm_code) {
            check_permission_or_die($pdo, 'shipping_companies', $perm_code);
        }
        // Ensure table exists for shipping companies
        try {
            execute_query($pdo, "CREATE TABLE IF NOT EXISTS shipping_companies (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                phones TEXT NULL,
                created_at DATETIME DEFAULT NOW()
            )");
        } catch (Exception $e) {
            // ignore creation errors; handle_crud will surface problems
        }
        handle_crud($pdo, 'shipping_companies', $input, ['name', 'phones']);
        break;
    case 'stock':
        // Provide a server-side handler for stock availability checks used by the frontend.
        // Expected payload (POST JSON): { warehouse_id: number|null, items: [{ product_id|productId: number, quantity|qty: number, name?: string }] }
        $action = $_GET['action'] ?? 'getAll';
        $perm_code = map_action_to_perm($action);
        if ($perm_code) {
            check_permission_or_die($pdo, 'stock', $perm_code);
        }
        if ($action === 'checkAvailability') {
            $warehouse_id = intval($_GET['warehouse_id'] ?? ($input['warehouse_id'] ?? 0));
            $items = $input['items'] ?? [];
            $unavailable = [];

            foreach ($items as $it) {
                $pid = intval($it['product_id'] ?? $it['productId'] ?? ($it['id'] ?? 0));
                $required = intval($it['quantity'] ?? $it['qty'] ?? 0);
                $name = $it['name'] ?? ($it['product_name'] ?? '');

                if (!$pid) {
                    $unavailable[] = ['product_id' => $pid, 'name' => $name, 'required' => $required, 'available' => 0];
                    continue;
                }

                if ($warehouse_id) {
                    $stmt = execute_query($pdo, "SELECT COALESCE(quantity,0) as q FROM stock WHERE product_id = ? AND warehouse_id = ?", [$pid, $warehouse_id]);
                    $available = floatval($stmt->fetchColumn() ?? 0);
                } else {
                    $stmt = execute_query($pdo, "SELECT COALESCE(SUM(quantity),0) as q FROM stock WHERE product_id = ?", [$pid]);
                    $available = floatval($stmt->fetchColumn() ?? 0);
                }

                if ($available < $required) {
                    $unavailable[] = ['product_id' => $pid, 'name' => $name, 'required' => $required, 'available' => $available];
                }
            }

            if (count($unavailable) > 0) {
                echo json_encode(['success' => false, 'unavailable_items' => $unavailable]);
            } else {
                echo json_encode(['success' => true]);
            }
            break;
        }

        if ($action === 'getByWarehouse') {
            check_permission_or_die($pdo, 'stock', 'view');
            $warehouse_id = intval($_GET['warehouse_id'] ?? 0);
            if ($warehouse_id <= 0) {
                http_response_code(400);
                echo json_encode(['success'=>false,'message'=>'warehouse_id required']);
                break;
            }
            if (!table_exists($pdo, 'product_variants') || !table_exists($pdo, 'stock')) {
                echo json_encode(['success'=>true,'data'=>[]]);
                break;
            }

                 $categorySelect = ', ppar.category';
                 $sql = "SELECT s.product_id, ppar.name, pv.barcode, pv.color, pv.size,
                          pv.cost_price AS cost, pv.sale_price AS price, pv.sale_price AS sale_price,
                          pv.reorder_level AS reorderLevel{$categorySelect},
                          s.quantity
                    FROM stock s
                    JOIN product_variants pv ON pv.id = s.product_id
                    JOIN products ppar ON ppar.id = pv.product_id
                    WHERE s.warehouse_id = ? AND COALESCE(s.quantity,0) > 0
                    ORDER BY ppar.name ASC";
            $rows = execute_query($pdo, $sql, [$warehouse_id])->fetchAll(PDO::FETCH_ASSOC);
            echo json_encode(['success'=>true,'data'=>$rows]);
            break;
        }

        if ($action === 'getAllSummary') {
            check_permission_or_die($pdo, 'stock', 'view');
            if (!table_exists($pdo, 'product_variants') || !table_exists($pdo, 'stock')) {
                echo json_encode(['success'=>true,'data'=>[]]);
                break;
            }

                 $categorySelect = ', ppar.category';
                 $sql = "SELECT pv.id as product_id, ppar.name, pv.barcode, pv.color, pv.size,
                          pv.cost_price AS cost, pv.sale_price AS price, pv.sale_price AS sale_price,
                          pv.reorder_level AS reorderLevel{$categorySelect},
                          COALESCE(SUM(s.quantity),0) as quantity
                    FROM product_variants pv
                    JOIN products ppar ON ppar.id = pv.product_id
                    LEFT JOIN stock s ON s.product_id = pv.id
                    WHERE COALESCE(pv.is_archived,0)=0 AND COALESCE(ppar.is_archived,0)=0
                    GROUP BY pv.id
                    HAVING COALESCE(SUM(s.quantity),0) > 0
                    ORDER BY ppar.name ASC";
            $rows = execute_query($pdo, $sql)->fetchAll(PDO::FETCH_ASSOC);
            echo json_encode(['success'=>true,'data'=>$rows]);
            break;
        }

        // Fallback: allow basic CRUD on the `stock` table for other actions
        handle_crud($pdo, 'stock', $input, ['product_id', 'warehouse_id', 'quantity'], "id, product_id, warehouse_id, quantity");
        break;
    case 'inventory':
        $action = $_GET['action'] ?? 'getAudits';
        if (in_array($action, ['getAudits', 'getAudit'])) {
            check_permission_or_die($pdo, 'inventory', 'view');
        } else {
            check_permission_or_die($pdo, 'inventory', 'edit');
        }

        if ($action === 'getAudits') {
            $status = trim((string)($_GET['status'] ?? ''));
            $warehouse_id = intval($_GET['warehouse_id'] ?? 0);

            $where = "1=1";
            $params = [];
            if ($status !== '' && $status !== 'all') { $where .= " AND a.status = ?"; $params[] = $status; }
            if ($warehouse_id > 0) { $where .= " AND a.warehouse_id = ?"; $params[] = $warehouse_id; }

            $sql = "SELECT a.*, w.name as warehouse_name, u.name as created_by_name, au.name as approved_by_name
                    FROM inventory_audits a
                    LEFT JOIN warehouses w ON a.warehouse_id = w.id
                    LEFT JOIN users u ON a.created_by = u.id
                    LEFT JOIN users au ON a.approved_by = au.id
                    WHERE $where
                    ORDER BY a.id DESC";
            $stmt = execute_query($pdo, $sql, $params);
            echo json_encode(['success' => true, 'data' => $stmt->fetchAll(PDO::FETCH_ASSOC)]);
            break;
        }

        if ($action === 'createAudit') {
            $warehouse_id = intval($input['warehouse_id'] ?? 0);
            $notes = trim((string)($input['notes'] ?? ''));
            if (!$warehouse_id) { http_response_code(400); echo json_encode(['success'=>false,'message'=>'warehouse_id required']); break; }

            $current_user = $_SESSION['user_id'] ?? null;
            execute_query($pdo, "INSERT INTO inventory_audits (warehouse_id, status, notes, created_by) VALUES (?, 'draft', ?, ?)", [$warehouse_id, $notes, $current_user]);
            $id = $pdo->lastInsertId();
            echo json_encode(['success' => true, 'data' => ['id' => $id]]);
            break;
        }

        if ($action === 'getAudit') {
            $id = intval($_GET['id'] ?? 0);
            if (!$id) { http_response_code(400); echo json_encode(['success'=>false,'message'=>'id required']); break; }

            $auditStmt = execute_query($pdo, "SELECT a.*, w.name as warehouse_name FROM inventory_audits a LEFT JOIN warehouses w ON a.warehouse_id = w.id WHERE a.id = ?", [$id]);
            $audit = $auditStmt->fetch(PDO::FETCH_ASSOC);
            if (!$audit) { http_response_code(404); echo json_encode(['success'=>false,'message'=>'Audit not found']); break; }

            $itemsStmt = execute_query($pdo, "SELECT ai.*, ppar.name as product_name, pv.barcode, pv.color, pv.size FROM inventory_audit_items ai JOIN product_variants pv ON ai.product_id = pv.id JOIN products ppar ON pv.product_id = ppar.id WHERE ai.audit_id = ? ORDER BY ai.id", [$id]);
            $items = $itemsStmt->fetchAll(PDO::FETCH_ASSOC);
            echo json_encode(['success' => true, 'data' => ['audit' => $audit, 'items' => $items]]);
            break;
        }

        if ($action === 'saveItems') {
            $audit_id = intval($input['audit_id'] ?? 0);
            $items = $input['items'] ?? [];
            if (!$audit_id || !is_array($items)) { http_response_code(400); echo json_encode(['success'=>false,'message'=>'audit_id and items required']); break; }

            $auditStmt = execute_query($pdo, "SELECT warehouse_id, status FROM inventory_audits WHERE id = ?", [$audit_id]);
            $audit = $auditStmt->fetch(PDO::FETCH_ASSOC);
            if (!$audit) { http_response_code(404); echo json_encode(['success'=>false,'message'=>'Audit not found']); break; }
            if ($audit['status'] !== 'draft') { http_response_code(400); echo json_encode(['success'=>false,'message'=>'Audit is not editable']); break; }

            $warehouse_id = intval($audit['warehouse_id']);

            try {
                $pdo->beginTransaction();
                foreach ($items as $it) {
                    $product_id = intval($it['product_id'] ?? 0);
                    $counted_qty = intval($it['counted_qty'] ?? 0);
                    $notes = trim((string)($it['notes'] ?? ''));
                    if (!$product_id) continue;

                    $sysStmt = execute_query($pdo, "SELECT quantity FROM stock WHERE product_id = ? AND warehouse_id = ?", [$product_id, $warehouse_id]);
                    $system_qty = intval($sysStmt->fetchColumn() ?? 0);
                    $diff_qty = $counted_qty - $system_qty;

                    execute_query($pdo, "INSERT INTO inventory_audit_items (audit_id, product_id, system_qty, counted_qty, diff_qty, notes) VALUES (?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE system_qty = VALUES(system_qty), counted_qty = VALUES(counted_qty), diff_qty = VALUES(diff_qty), notes = VALUES(notes)", [$audit_id, $product_id, $system_qty, $counted_qty, $diff_qty, $notes]);
                }
                $pdo->commit();
            } catch (Exception $e) {
                if ($pdo->inTransaction()) $pdo->rollBack();
                http_response_code(500);
                echo json_encode(['success'=>false,'message'=>$e->getMessage()]);
                break;
            }

            $itemsStmt = execute_query($pdo, "SELECT ai.*, ppar.name as product_name, pv.barcode, pv.color, pv.size FROM inventory_audit_items ai JOIN product_variants pv ON ai.product_id = pv.id JOIN products ppar ON pv.product_id = ppar.id WHERE ai.audit_id = ? ORDER BY ai.id", [$audit_id]);
            echo json_encode(['success' => true, 'data' => ['items' => $itemsStmt->fetchAll(PDO::FETCH_ASSOC)]]);
            break;
        }

        if ($action === 'submitAudit') {
            $id = intval($input['id'] ?? 0);
            if (!$id) { http_response_code(400); echo json_encode(['success'=>false,'message'=>'id required']); break; }

            $auditStmt = execute_query($pdo, "SELECT id, warehouse_id, status FROM inventory_audits WHERE id = ?", [$id]);
            $audit = $auditStmt->fetch(PDO::FETCH_ASSOC);
            if (!$audit) { http_response_code(404); echo json_encode(['success'=>false,'message'=>'Audit not found']); break; }
            if ($audit['status'] !== 'draft') { http_response_code(400); echo json_encode(['success'=>false,'message'=>'Audit is not editable']); break; }

            try {
                $pdo->beginTransaction();
                $itemsStmt = execute_query($pdo, "SELECT id, product_id, counted_qty FROM inventory_audit_items WHERE audit_id = ?", [$id]);
                $items = $itemsStmt->fetchAll(PDO::FETCH_ASSOC);
                foreach ($items as $it) {
                    $product_id = intval($it['product_id']);
                    $counted_qty = intval($it['counted_qty']);
                    $sysStmt = execute_query($pdo, "SELECT quantity FROM stock WHERE product_id = ? AND warehouse_id = ?", [$product_id, intval($audit['warehouse_id'])]);
                    $system_qty = intval($sysStmt->fetchColumn() ?? 0);
                    $diff_qty = $counted_qty - $system_qty;
                    execute_query($pdo, "UPDATE inventory_audit_items SET system_qty = ?, diff_qty = ? WHERE id = ?", [$system_qty, $diff_qty, $it['id']]);
                }
                execute_query($pdo, "UPDATE inventory_audits SET status = 'pending', submitted_at = NOW() WHERE id = ?", [$id]);
                $pdo->commit();
                echo json_encode(['success'=>true]);
            } catch (Exception $e) {
                if ($pdo->inTransaction()) $pdo->rollBack();
                http_response_code(500);
                echo json_encode(['success'=>false,'message'=>$e->getMessage()]);
            }
            break;
        }

        if ($action === 'approveAudit') {
            $id = intval($input['id'] ?? 0);
            if (!$id) { http_response_code(400); echo json_encode(['success'=>false,'message'=>'id required']); break; }

            $auditStmt = execute_query($pdo, "SELECT id, warehouse_id, status FROM inventory_audits WHERE id = ?", [$id]);
            $audit = $auditStmt->fetch(PDO::FETCH_ASSOC);
            if (!$audit) { http_response_code(404); echo json_encode(['success'=>false,'message'=>'Audit not found']); break; }
            if ($audit['status'] !== 'pending') { http_response_code(400); echo json_encode(['success'=>false,'message'=>'Audit is not pending']); break; }

            $current_user = $_SESSION['user_id'] ?? null;
            try {
                $pdo->beginTransaction();
                $itemsStmt = execute_query($pdo, "SELECT product_id, system_qty, counted_qty FROM inventory_audit_items WHERE audit_id = ?", [$id]);
                $items = $itemsStmt->fetchAll(PDO::FETCH_ASSOC);
                foreach ($items as $it) {
                    $product_id = intval($it['product_id']);
                    $new_qty = intval($it['counted_qty']);

                    $stockStmt = execute_query($pdo, "SELECT quantity FROM stock WHERE product_id = ? AND warehouse_id = ?", [$product_id, intval($audit['warehouse_id'])]);
                    $prev_raw = $stockStmt->fetchColumn();
                    $prev_qty = $prev_raw === false ? 0 : intval($prev_raw);

                    if ($prev_raw === false) {
                        execute_query($pdo, "INSERT INTO stock (product_id, warehouse_id, quantity) VALUES (?, ?, ?)", [$product_id, intval($audit['warehouse_id']), $new_qty]);
                    } else {
                        execute_query($pdo, "UPDATE stock SET quantity = ? WHERE product_id = ? AND warehouse_id = ?", [$new_qty, $product_id, intval($audit['warehouse_id'])]);
                    }

                    $diff = $new_qty - $prev_qty;
                    execute_query($pdo, "INSERT INTO product_movements (product_id, warehouse_id, movement_type, quantity_change, previous_quantity, new_quantity, reference_id, reference_type, notes, created_by) VALUES (?, ?, 'adjustment', ?, ?, ?, ?, 'inventory_audit', ?, ?)", [$product_id, intval($audit['warehouse_id']), $diff, $prev_qty, $new_qty, $id, json_encode(['audit_id' => $id, 'system_qty' => $prev_qty, 'counted_qty' => $new_qty]), $current_user]);
                }

                execute_query($pdo, "UPDATE inventory_audits SET status = 'approved', approved_by = ?, approved_at = NOW() WHERE id = ?", [$current_user, $id]);
                $pdo->commit();
                echo json_encode(['success'=>true]);
            } catch (Exception $e) {
                if ($pdo->inTransaction()) $pdo->rollBack();
                http_response_code(500);
                echo json_encode(['success'=>false,'message'=>$e->getMessage()]);
            }
            break;
        }

        if ($action === 'rejectAudit') {
            $id = intval($input['id'] ?? 0);
            $reason = trim((string)($input['reason'] ?? ''));
            if (!$id) { http_response_code(400); echo json_encode(['success'=>false,'message'=>'id required']); break; }
            execute_query($pdo, "UPDATE inventory_audits SET status = 'rejected', rejection_reason = ? WHERE id = ?", [$reason, $id]);
            echo json_encode(['success'=>true]);
            break;
        }

        echo json_encode(['success'=>false,'message'=>'Unsupported inventory action']);
        break;
    case 'employees':
        ensure_hrm_tables($pdo);
        ensure_attendance_tables($pdo);
        try {
            $action = $_GET['action'] ?? 'getAll';
            $perm_code = map_action_to_perm($action);
            if ($perm_code) {
                check_permission_or_die($pdo, 'employees', $perm_code);
            }
            if ($action === 'getFinancialSummary') {
                $employee_id = intval($_GET['id'] ?? 0);
                if (!$employee_id) {
                    throw new Exception('Employee ID is required.');
                }

                // Get employee salary
                $empStmt = execute_query($pdo, "SELECT salary, hire_date FROM employees WHERE id = ?", [$employee_id]);
                $employee = $empStmt->fetch(PDO::FETCH_ASSOC);
                if (!$employee) {
                    throw new Exception('Employee not found.');
                }
                $salary = floatval($employee['salary']);
                
                $month = date('Y-m');
                $month_start = date('Y-m-01');
                $today = date('Y-m-d');
                $days_in_month = date('t');
                $days_so_far = date('j');

                $hire_date_dt = new DateTime($employee['hire_date']);
                $month_start_dt = new DateTime($month_start);

                $days_worked = $days_so_far;
                if ($hire_date_dt > $month_start_dt) {
                    $days_worked = (new DateTime($today))->diff($hire_date_dt)->days + 1;
                }
                
                // to avoid earned salary being > salary
                if ($days_worked > $days_in_month) $days_worked = $days_in_month;

                $earned_salary = ($salary / $days_in_month) * $days_worked;

                // Get sum of transactions this month
                $txStmt = execute_query($pdo, "SELECT type, SUM(amount) as total FROM employee_transactions WHERE employee_id = ? AND DATE_FORMAT(date, '%Y-%m') = ? GROUP BY type", [$employee_id, $month]);
                $monthly_tx = $txStmt->fetchAll(PDO::FETCH_KEY_PAIR);

                $advances_total = floatval($monthly_tx['advance'] ?? 0);
                $bonuses_total = floatval($monthly_tx['bonus'] ?? 0);
                $penalties_total = floatval($monthly_tx['penalty'] ?? 0);

                $withdrawable_balance = $earned_salary - $advances_total - $penalties_total;
                if ($withdrawable_balance < 0) $withdrawable_balance = 0;

                echo json_encode([
                    'success' => true,
                    'data' => [
                        'salary' => $salary,
                        'withdrawn_this_month' => $advances_total,
                        'deductions_this_month' => $penalties_total,
                        'bonuses_this_month' => $bonuses_total,
                        'withdrawable_balance' => $withdrawable_balance,
                        'projected_net_salary' => $salary + $bonuses_total - ($advances_total + $penalties_total),
                    ]
                ]);

            } else {
                handle_crud($pdo, 'employees', $input, ['name', 'job_title', 'salary', 'hire_date', 'phone', 'status', 'fingerprint_device_id', 'fingerprint_user_id']);
            }
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => $e->getMessage()]);
        }
        break;

    case 'dispatch':
        // Send factory products to sales (deduct from factory_stock + log movements)
        $action = $_GET['action'] ?? 'getAll';

        // Backward-compatible alias: allow older frontend to call getDeliveryNote
        // by routing it to the existing getOrderV2 handler which returns
        // the order and its items. Normalize id -> order_id for the handler.
        if ($action === 'getDeliveryNote') {
            $_GET['order_id'] = $_GET['id'] ?? ($_GET['order_id'] ?? null);
            $action = 'getOrderV2';
        }

        // Use factory_products permissions to avoid requiring new permission seeding for older installs
        $perm = map_action_to_perm($action);
        if ($perm) {
            check_permission_or_die($pdo, 'factory_products', $perm);
        }

        // Runtime migration
        try {
            if (!table_exists($pdo, 'dispatches')) {
                execute_query($pdo, "CREATE TABLE IF NOT EXISTS dispatches (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    factory_product_id INT NOT NULL,
                    warehouse_id INT NOT NULL,
                    quantity INT NOT NULL,
                    notes TEXT NULL,
                    created_by INT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
                    INDEX (factory_product_id),
                    INDEX (warehouse_id),
                    INDEX (created_at)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
            }
            if (!table_exists($pdo, 'factory_stock')) {
                execute_query($pdo, "CREATE TABLE IF NOT EXISTS factory_stock (
                    factory_product_id INT NOT NULL,
                    warehouse_id INT NOT NULL,
                    quantity INT NOT NULL DEFAULT 0,
                    PRIMARY KEY (factory_product_id, warehouse_id),
                    INDEX (warehouse_id)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
            }
            if (!table_exists($pdo, 'factory_product_movements')) {
                execute_query($pdo, "CREATE TABLE IF NOT EXISTS factory_product_movements (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    factory_product_id INT NOT NULL,
                    warehouse_id INT NOT NULL,
                    movement_type VARCHAR(50) NOT NULL,
                    quantity_change INT NOT NULL,
                    previous_quantity INT NOT NULL,
                    new_quantity INT NOT NULL,
                    reference_id INT NULL,
                    reference_type VARCHAR(50) NULL,
                    notes TEXT NULL,
                    created_by INT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    INDEX (factory_product_id),
                    INDEX (warehouse_id),
                    INDEX (created_at)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
            }

			// In-app notifications table (used for receive alerts)
			ensure_user_notifications_table($pdo);
        } catch (Exception $e) {
            // ignore migration errors
        }

        $created_by = $_SESSION['user_id'] ?? null;

        // -----------------------
        // V2 workflow: dispatch orders (pending -> receive/confirm -> confirmed/mismatch)
        // -----------------------
        // Note: we keep legacy actions (getAll/add/update/delete) for backward compatibility.

        // Runtime migration for V2 tables
        try {
            if (!table_exists($pdo, 'dispatch_orders')) {
                execute_query($pdo, "CREATE TABLE IF NOT EXISTS dispatch_orders (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    code VARCHAR(50) NULL,
                    from_warehouse_id INT NOT NULL,
                    to_warehouse_id INT NOT NULL,
                    status VARCHAR(20) NOT NULL DEFAULT 'pending',
                    notes TEXT NULL,
                    created_by INT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    confirmed_by INT NULL,
                    confirmed_at DATETIME NULL,
                    updated_at TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
                    UNIQUE KEY ux_dispatch_orders_code (code),
                    INDEX (from_warehouse_id),
                    INDEX (to_warehouse_id),
                    INDEX (status),
                    INDEX (created_at)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
            }
            if (!table_exists($pdo, 'dispatch_order_items')) {
                execute_query($pdo, "CREATE TABLE IF NOT EXISTS dispatch_order_items (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    order_id INT NOT NULL,
                    factory_product_id INT NOT NULL,
                    size_id INT NOT NULL DEFAULT 0,
                    color VARCHAR(100) NOT NULL DEFAULT '',
                    qty_sent INT NOT NULL,
                    qty_received INT NULL,
                    INDEX (order_id),
                    INDEX (factory_product_id),
                    INDEX (size_id),
                    UNIQUE KEY ux_order_variant (order_id, factory_product_id, size_id, color)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
            }

            // Backward-compatible ALTERs for older DBs that already have dispatch_order_items
            if (table_exists($pdo, 'dispatch_order_items') && !column_exists($pdo, 'dispatch_order_items', 'size_id')) {
                execute_query($pdo, "ALTER TABLE dispatch_order_items ADD COLUMN size_id INT NOT NULL DEFAULT 0");
                try { execute_query($pdo, "ALTER TABLE dispatch_order_items ADD INDEX (size_id)"); } catch (Exception $e) {}
            }
            if (table_exists($pdo, 'dispatch_order_items') && !column_exists($pdo, 'dispatch_order_items', 'color')) {
                execute_query($pdo, "ALTER TABLE dispatch_order_items ADD COLUMN color VARCHAR(100) NOT NULL DEFAULT ''");
            }
            // Replace old unique index (if exists) to allow variants per product
            if (table_exists($pdo, 'dispatch_order_items')) {
                try { execute_query($pdo, "ALTER TABLE dispatch_order_items DROP INDEX ux_order_product"); } catch (Exception $e) {}
                try { execute_query($pdo, "ALTER TABLE dispatch_order_items ADD UNIQUE KEY ux_order_variant (order_id, factory_product_id, size_id, color)"); } catch (Exception $e) {}
            }
            if (!table_exists($pdo, 'factory_stock')) {
                execute_query($pdo, "CREATE TABLE IF NOT EXISTS factory_stock (
                    factory_product_id INT NOT NULL,
                    warehouse_id INT NOT NULL,
                    quantity INT NOT NULL DEFAULT 0,
                    PRIMARY KEY (factory_product_id, warehouse_id),
                    INDEX (warehouse_id)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
            }
            if (!table_exists($pdo, 'factory_product_movements')) {
                execute_query($pdo, "CREATE TABLE IF NOT EXISTS factory_product_movements (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    factory_product_id INT NOT NULL,
                    warehouse_id INT NOT NULL,
                    movement_type VARCHAR(50) NOT NULL,
                    quantity_change INT NOT NULL,
                    previous_quantity INT NOT NULL,
                    new_quantity INT NOT NULL,
                    reference_id INT NULL,
                    reference_type VARCHAR(50) NULL,
                    notes TEXT NULL,
                    created_by INT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    INDEX (factory_product_id),
                    INDEX (warehouse_id),
                    INDEX (created_at)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
            }
        } catch (Exception $e) {
            // ignore migration errors
        }

        if ($action === 'getMetaV2') {
            check_permission_or_die($pdo, 'factory_products', 'view');
            $from_warehouse_id = intval($_GET['from_warehouse_id'] ?? 0);

            // Apply user default warehouse restriction (same semantics as legacy dispatch)
            $defaults = get_user_defaults($pdo);
            if ($defaults) {
                $defWid = isset($defaults['default_warehouse_id']) ? intval($defaults['default_warehouse_id']) : null;
                $canChangeW = isset($defaults['can_change_warehouse']) ? boolval($defaults['can_change_warehouse']) : true;
                if (!$canChangeW && $defWid) {
                    $from_warehouse_id = $defWid;
                } else {
                    if (!$from_warehouse_id && $defWid) $from_warehouse_id = $defWid;
                }
            }

            $warehouses = [];
            if (table_exists($pdo, 'warehouses')) {
                $warehouses = execute_query($pdo, "SELECT id, name FROM warehouses ORDER BY name ASC")->fetchAll(PDO::FETCH_ASSOC);
            }

            $products = [];
            if ($from_warehouse_id > 0 && table_exists($pdo, 'factory_products') && table_exists($pdo, 'factory_stock')) {
                $products = execute_query(
                    $pdo,
                    "SELECT fp.id, fp.name, fp.code, fs.quantity AS available_quantity
                     FROM factory_stock fs
                     INNER JOIN factory_products fp ON fp.id = fs.factory_product_id
                     WHERE fs.warehouse_id = ? AND fs.quantity > 0
                     ORDER BY fp.name ASC, fp.id DESC",
                    [$from_warehouse_id]
                )->fetchAll(PDO::FETCH_ASSOC);
            }

            $colors = [];
            if (table_exists($pdo, 'colors')) {
                $colors = execute_query($pdo, "SELECT id, name, code FROM colors ORDER BY name ASC")->fetchAll(PDO::FETCH_ASSOC);
            }

            $sizes = [];
            if (table_exists($pdo, 'sizes')) {
                $sizes = execute_query($pdo, "SELECT id, name, code FROM sizes ORDER BY name ASC")->fetchAll(PDO::FETCH_ASSOC);
            }

            echo json_encode(['success' => true, 'data' => [
                'warehouses' => $warehouses,
                'from_warehouse_id' => $from_warehouse_id,
                'can_change_from_warehouse' => !($defaults && isset($defaults['can_change_warehouse']) && !boolval($defaults['can_change_warehouse'] ?? true)),
                'products' => $products,
                'colors' => $colors,
                'sizes' => $sizes,
            ]]);
            break;
        }

        if ($action === 'resolveBarcodeV2') {
            check_permission_or_die($pdo, 'factory_products', 'view');
            $barcode = trim((string)($_GET['barcode'] ?? ($input['barcode'] ?? '')));
            $from_warehouse_id = intval($_GET['from_warehouse_id'] ?? ($input['from_warehouse_id'] ?? 0));
            if ($barcode === '') {
                http_response_code(400);
                echo json_encode(['success'=>false,'message'=>'barcode required']);
                break;
            }
            if ($from_warehouse_id <= 0) {
                http_response_code(400);
                echo json_encode(['success'=>false,'message'=>'from_warehouse_id required']);
                break;
            }

            // Variant tracking barcode: FPV2-{factory_product_id}-{size_id}-{color_id}
            // This barcode is designed to be typed/scanned in "إرسال إلى المبيعات" and already contains size+color.
            if (preg_match('/^FPV2-(\d+)-(\d+)-(\d+)$/', $barcode, $m)) {
                $pid = intval($m[1]);
                $sid = intval($m[2]);
                $cid = intval($m[3]);
                if ($pid <= 0 || $sid <= 0 || $cid <= 0) {
                    http_response_code(400);
                    echo json_encode(['success'=>false,'message'=>'Invalid FPV2 barcode']);
                    break;
                }

                // Ensure there is available stock in selected warehouse
                $available = 0;
                if (table_exists($pdo, 'factory_stock')) {
                    $cur = execute_query($pdo, "SELECT quantity FROM factory_stock WHERE factory_product_id = ? AND warehouse_id = ?", [$pid, $from_warehouse_id])->fetchColumn();
                    $available = ($cur === false || $cur === null) ? 0 : intval($cur);
                }
                if ($available <= 0) {
                    http_response_code(400);
                    echo json_encode(['success'=>false,'message'=>'لا توجد كمية متاحة لهذا المنتج في المخزن المختار.']);
                    break;
                }

                $fp = table_exists($pdo, 'factory_products')
                    ? execute_query($pdo, "SELECT id, name, code FROM factory_products WHERE id = ? LIMIT 1", [$pid])->fetch(PDO::FETCH_ASSOC)
                    : null;
                if (!$fp) {
                    http_response_code(404);
                    echo json_encode(['success'=>false,'message'=>'لم يتم العثور على المنتج.']);
                    break;
                }

                $colorName = '';
                if (table_exists($pdo, 'colors')) {
                    $cn = execute_query($pdo, "SELECT name FROM colors WHERE id = ? LIMIT 1", [$cid])->fetchColumn();
                    $colorName = $cn ? strval($cn) : '';
                }

                echo json_encode(['success'=>true,'data'=>[
                    'barcode' => $barcode,
                    'factory_product_id' => $pid,
                    'product_name' => $fp['name'] ?? null,
                    'product_code' => $fp['code'] ?? null,
                    'size_id' => $sid,
                    'color' => $colorName,
                    'color_id' => $cid,
                    'available_quantity' => $available,
                    'needs_variant' => 0,
                ]]);
                break;
            }

            // Resolve piece UID -> product + size + color (color from fabric used in cutting order)
            // We intentionally validate that the cutting order warehouse matches the from_warehouse.
            if (!table_exists($pdo, 'product_tracking') || !table_exists($pdo, 'manufacturing_orders') || !table_exists($pdo, 'cutting_orders')) {
                http_response_code(400);
                echo json_encode(['success'=>false,'message'=>'Barcode resolution requires manufacturing tracking tables.']);
                break;
            }
            $sql = "SELECT
                        pt.piece_uid,
                        pt.product_id AS factory_product_id,
                        pt.size_id,
                        fp.name AS product_name,
                        fp.code AS product_code,
                        s.name AS size_name,
                        s.code AS size_code,
                        f.color AS fabric_color,
                        co.warehouse_id AS cutting_warehouse_id
                    FROM product_tracking pt
                    JOIN manufacturing_orders mo ON mo.id = pt.manufacturing_order_id
                    JOIN cutting_orders co ON co.id = mo.cutting_order_id
                    LEFT JOIN factory_products fp ON fp.id = pt.product_id
                    LEFT JOIN sizes s ON s.id = pt.size_id
                    LEFT JOIN fabrics f ON f.id = co.fabric_id
                    WHERE pt.piece_uid = ?
                      AND pt.finished_at IS NOT NULL
                      AND pt.finished_at <> '0000-00-00 00:00:00'
                    ORDER BY pt.id DESC
                    LIMIT 1";
            $row = execute_query($pdo, $sql, [$barcode])->fetch(PDO::FETCH_ASSOC);
            if (!$row) {
                // Fallback: treat barcode as factory product master code (fp.code)
                if (table_exists($pdo, 'factory_products')) {
                    $fp = execute_query($pdo, "SELECT id, name, code FROM factory_products WHERE code = ? LIMIT 1", [$barcode])->fetch(PDO::FETCH_ASSOC);
                    if ($fp) {
                        $pid = intval($fp['id'] ?? 0);
                        if ($pid <= 0) {
                            http_response_code(404);
                            echo json_encode(['success'=>false,'message'=>'لم يتم العثور على المنتج.']);
                            break;
                        }

                        // Ensure there is available stock in selected warehouse
                        $available = 0;
                        if (table_exists($pdo, 'factory_stock')) {
                            $cur = execute_query($pdo, "SELECT quantity FROM factory_stock WHERE factory_product_id = ? AND warehouse_id = ?", [$pid, $from_warehouse_id])->fetchColumn();
                            $available = ($cur === false || $cur === null) ? 0 : intval($cur);
                        }
                        if ($available <= 0) {
                            http_response_code(400);
                            echo json_encode(['success'=>false,'message'=>'لا توجد كمية متاحة لهذا المنتج في المخزن المختار.']);
                            break;
                        }

                        echo json_encode(['success'=>true,'data'=>[
                            'barcode' => $barcode,
                            'factory_product_id' => $pid,
                            'product_name' => $fp['name'] ?? null,
                            'product_code' => $fp['code'] ?? null,
                            'size_id' => 0,
                            'color' => '',
                            'available_quantity' => $available,
                            'needs_variant' => 1,
                        ]]);
                        break;
                    }
                }

                http_response_code(404);
                echo json_encode(['success'=>false,'message'=>'لم يتم العثور على باركود منتج مكتمل.']);
                break;
            }

            // Note: finished stock may be added to a different warehouse than the original cutting order warehouse.
            // We validate availability using factory_stock for the selected from_warehouse instead.

            $pid = intval($row['factory_product_id'] ?? 0);
            $sid = intval($row['size_id'] ?? 0);
            $color = trim((string)($row['fabric_color'] ?? ''));
            if ($pid <= 0 || $sid <= 0 || $color === '') {
                http_response_code(400);
                echo json_encode(['success'=>false,'message'=>'تعذر استخراج المقاس/اللون من الباركود.']);
                break;
            }

            // Best-effort check: ensure some quantity exists in factory_stock
            $available = 0;
            if (table_exists($pdo, 'factory_stock')) {
                $cur = execute_query($pdo, "SELECT quantity FROM factory_stock WHERE factory_product_id = ? AND warehouse_id = ?", [$pid, $from_warehouse_id])->fetchColumn();
                $available = ($cur === false || $cur === null) ? 0 : intval($cur);
            }
            if ($available <= 0) {
                http_response_code(400);
                echo json_encode(['success'=>false,'message'=>'لا توجد كمية متاحة لهذا المنتج في المخزن المختار.']);
                break;
            }

            echo json_encode(['success'=>true,'data'=>[
                'barcode' => $barcode,
                'factory_product_id' => $pid,
                'product_name' => $row['product_name'] ?? null,
                'product_code' => $row['product_code'] ?? null,
                'size_id' => $sid,
                'size_name' => $row['size_name'] ?? null,
                'size_code' => $row['size_code'] ?? null,
                'color' => $color,
                'available_quantity' => $available,
                'needs_variant' => 0,
            ]]);
            break;
        }

        if ($action === 'listOrdersV2') {
            check_permission_or_die($pdo, 'factory_products', 'view');
            $status = trim((string)($_GET['status'] ?? ''));
            $where = '';
            $params = [];
            if ($status !== '') {
                $where = 'WHERE o.status = ?';
                $params[] = $status;
            }
            $sql = "SELECT
                        o.*,
                        wf.name AS from_warehouse_name,
                        wt.name AS to_warehouse_name,
                        uc.name AS created_by_name,
                        uu.name AS confirmed_by_name,
                        COALESCE(SUM(i.qty_sent), 0) AS total_sent,
                        COALESCE(SUM(COALESCE(i.qty_received, 0)), 0) AS total_received
                    FROM dispatch_orders o
                    LEFT JOIN dispatch_order_items i ON i.order_id = o.id
                    LEFT JOIN warehouses wf ON wf.id = o.from_warehouse_id
                    LEFT JOIN warehouses wt ON wt.id = o.to_warehouse_id
                    LEFT JOIN users uc ON uc.id = o.created_by
                    LEFT JOIN users uu ON uu.id = o.confirmed_by
                    $where
                    GROUP BY o.id
                    ORDER BY o.id DESC";
            $rows = execute_query($pdo, $sql, $params)->fetchAll(PDO::FETCH_ASSOC);
            echo json_encode(['success' => true, 'data' => $rows]);
            break;
        }

        if ($action === 'getOrderV2') {
            check_permission_or_die($pdo, 'factory_products', 'view');
            $order_id = intval($_GET['order_id'] ?? ($_GET['id'] ?? 0));
            if ($order_id <= 0) { http_response_code(400); echo json_encode(['success'=>false,'message'=>'order_id required']); break; }

            $order = execute_query(
                $pdo,
                "SELECT o.*, wf.name AS from_warehouse_name, wt.name AS to_warehouse_name, uc.name AS created_by_name, uu.name AS confirmed_by_name
                 FROM dispatch_orders o
                 LEFT JOIN warehouses wf ON wf.id = o.from_warehouse_id
                 LEFT JOIN warehouses wt ON wt.id = o.to_warehouse_id
                 LEFT JOIN users uc ON uc.id = o.created_by
                 LEFT JOIN users uu ON uu.id = o.confirmed_by
                 WHERE o.id = ?",
                [$order_id]
            )->fetch(PDO::FETCH_ASSOC);
            if (!$order) { http_response_code(404); echo json_encode(['success'=>false,'message'=>'Not found']); break; }

            $items = execute_query(
                $pdo,
                "SELECT i.*, fp.name AS product_name, fp.code AS product_code, s.name AS size_name, s.code AS size_code
                 FROM dispatch_order_items i
                 LEFT JOIN factory_products fp ON fp.id = i.factory_product_id
                 LEFT JOIN sizes s ON s.id = i.size_id
                 WHERE i.order_id = ?
                 ORDER BY fp.name ASC, i.id ASC",
                [$order_id]
            )->fetchAll(PDO::FETCH_ASSOC);

            echo json_encode(['success' => true, 'data' => ['order' => $order, 'items' => $items]]);
            break;
        }

        if ($action === 'createOrderV2') {
            check_permission_or_die($pdo, 'factory_products', 'add');
            $from_warehouse_id = intval($input['from_warehouse_id'] ?? 0);
            $to_warehouse_id = intval($input['to_warehouse_id'] ?? 0);
            $notes = trim((string)($input['notes'] ?? ''));
            $itemsIn = is_array($input['items'] ?? null) ? $input['items'] : [];

            $defaults = get_user_defaults($pdo);
            if ($defaults) {
                $defWid = isset($defaults['default_warehouse_id']) ? intval($defaults['default_warehouse_id']) : null;
                $canChangeW = isset($defaults['can_change_warehouse']) ? boolval($defaults['can_change_warehouse']) : true;
                if (!$canChangeW && $defWid) {
                    if ($from_warehouse_id && $from_warehouse_id !== $defWid) {
                        http_response_code(400);
                        echo json_encode(['success'=>false,'message'=>'المخزن المرسل منه مقفل للمستخدم ولا يمكن تغييره.']);
                        break;
                    }
                    $from_warehouse_id = $defWid;
                } else {
                    if (!$from_warehouse_id && $defWid) $from_warehouse_id = $defWid;
                }
            }
            if (!$from_warehouse_id) $from_warehouse_id = 1;

            if ($from_warehouse_id <= 0 || $to_warehouse_id <= 0) {
                http_response_code(400);
                echo json_encode(['success'=>false,'message'=>'from_warehouse_id and to_warehouse_id are required']);
                break;
            }
            if ($from_warehouse_id === $to_warehouse_id) {
                http_response_code(400);
                echo json_encode(['success'=>false,'message'=>'لا يمكن الإرسال إلى نفس المخزن.']);
                break;
            }
            if (count($itemsIn) === 0) {
                http_response_code(400);
                echo json_encode(['success'=>false,'message'=>'يجب اختيار منتج واحد على الأقل.']);
                break;
            }

            // Normalize items: merge duplicates by product+size+color
            $itemsMap = [];
            $totalByProduct = [];
            foreach ($itemsIn as $it) {
                if (!is_array($it)) continue;
                $pid = intval($it['factory_product_id'] ?? ($it['product_id'] ?? 0));
                $sid = intval($it['size_id'] ?? ($it['sizeId'] ?? 0));
                $color = trim((string)($it['color'] ?? ''));
                $qty = intval($it['qty_sent'] ?? ($it['quantity'] ?? ($it['qty'] ?? 0)));
                if ($pid <= 0 || $sid <= 0 || $color === '' || $qty <= 0) continue;
                $key = $pid . '|' . $sid . '|' . mb_strtolower($color, 'UTF-8');
                if (!isset($itemsMap[$key])) $itemsMap[$key] = ['factory_product_id' => $pid, 'size_id' => $sid, 'color' => $color, 'qty_sent' => 0];
                $itemsMap[$key]['qty_sent'] += $qty;
                if (!isset($totalByProduct[$pid])) $totalByProduct[$pid] = 0;
                $totalByProduct[$pid] += $qty;
            }
            if (count($itemsMap) === 0) {
                http_response_code(400);
                echo json_encode(['success'=>false,'message'=>'يجب تحديد المنتج + المقاس + اللون لكل بند.']);
                break;
            }

            try {
                $pdo->beginTransaction();

                // Validation: total per product must cover all variants combined
                foreach ($totalByProduct as $pidKey => $qtyTotal) {
                    $pid = intval($pidKey);
                    $qtySent = intval($qtyTotal);
                    $cur = execute_query(
                        $pdo,
                        "SELECT quantity FROM factory_stock WHERE factory_product_id = ? AND warehouse_id = ? FOR UPDATE",
                        [intval($pid), $from_warehouse_id]
                    )->fetchColumn();
                    $available = ($cur === false || $cur === null) ? 0 : intval($cur);
                    if ($available < intval($qtySent)) {
                        throw new Exception('Insufficient factory stock for product_id=' . intval($pid));
                    }
                }

                execute_query(
                    $pdo,
                    "INSERT INTO dispatch_orders (code, from_warehouse_id, to_warehouse_id, status, notes, created_by)
                     VALUES (NULL, ?, ?, 'pending', ?, ?)",
                    [$from_warehouse_id, $to_warehouse_id, ($notes === '' ? null : $notes), $created_by]
                );
                $orderId = intval($pdo->lastInsertId());
                $code = 'DSP-' . date('Ymd') . '-' . str_pad(strval($orderId), 5, '0', STR_PAD_LEFT);
                execute_query($pdo, "UPDATE dispatch_orders SET code = ? WHERE id = ?", [$code, $orderId]);

                $ins = $pdo->prepare("INSERT INTO dispatch_order_items (order_id, factory_product_id, size_id, color, qty_sent, qty_received)
                                      VALUES (?, ?, ?, ?, ?, NULL)
                                      ON DUPLICATE KEY UPDATE qty_sent = qty_sent + VALUES(qty_sent)");
                foreach ($itemsMap as $k => $rowIt) {
                    $ins->execute([
                        $orderId,
                        intval($rowIt['factory_product_id']),
                        intval($rowIt['size_id']),
                        trim((string)$rowIt['color']),
                        intval($rowIt['qty_sent'])
                    ]);
                }

                // Notify eligible users (receive permission + destination warehouse access)
                try {
                    if (table_exists($pdo, 'user_notifications') && table_exists($pdo, 'users')) {
                        $fromName = null;
                        $toName = null;
                        if (table_exists($pdo, 'warehouses')) {
                            $fromName = execute_query($pdo, "SELECT name FROM warehouses WHERE id = ? LIMIT 1", [$from_warehouse_id])->fetchColumn();
                            $toName = execute_query($pdo, "SELECT name FROM warehouses WHERE id = ? LIMIT 1", [$to_warehouse_id])->fetchColumn();
                        }
                        $fromLabel = $fromName ? strval($fromName) : strval($from_warehouse_id);
                        $toLabel = $toName ? strval($toName) : strval($to_warehouse_id);
                        $title = 'تنبيه استلام';
                        $text = 'يوجد إرسال جديد للاستلام: ' . $code . ' — من: ' . $fromLabel . ' إلى: ' . $toLabel;
                        $data = json_encode([
                            'type' => 'receive_dispatch',
                            'order_id' => $orderId,
                            'code' => $code,
                            'from_warehouse_id' => $from_warehouse_id,
                            'to_warehouse_id' => $to_warehouse_id,
                        ]);

                        $users = execute_query($pdo, "SELECT id, role FROM users")->fetchAll(PDO::FETCH_ASSOC);
                        foreach ($users as $urow) {
                            $uid = intval($urow['id'] ?? 0);
                            if ($uid <= 0) continue;
                            if ($created_by && intval($created_by) === $uid) continue;

                            // Must be allowed to receive (factory_products update)
                            if (!user_has_permission($pdo, $uid, 'factory_products', 'update')) continue;

                            // Destination warehouse access: if user is locked to a warehouse, it must match
                            $defs = get_user_defaults($pdo, $uid);
                            if ($defs && isset($defs['can_change_warehouse']) && boolval($defs['can_change_warehouse']) === false) {
                                $defWid = isset($defs['default_warehouse_id']) ? intval($defs['default_warehouse_id']) : 0;
                                if ($defWid > 0 && $defWid !== $to_warehouse_id) continue;
                            }

                            execute_query(
                                $pdo,
                                "INSERT INTO user_notifications (user_id, type, title, text, data, is_read) VALUES (?, ?, ?, ?, ?, 0)",
                                [$uid, 'receive_dispatch', $title, $text, $data]
                            );
                        }
                    }
                } catch (Exception $e) {
                    // best-effort, don't fail the order
                }

                $pdo->commit();
                echo json_encode(['success' => true, 'data' => ['order_id' => $orderId, 'code' => $code]]);
            } catch (Exception $e) {
                try { if ($pdo->inTransaction()) $pdo->rollBack(); } catch (Exception $ex) {}
                http_response_code(500);
                echo json_encode(['success' => false, 'message' => 'Create dispatch order failed: ' . $e->getMessage()]);
            }
            break;
        }

        if ($action === 'cancelOrderV2') {
            check_permission_or_die($pdo, 'factory_products', 'delete');
            $order_id = intval($input['order_id'] ?? ($input['id'] ?? 0));
            if ($order_id <= 0) { http_response_code(400); echo json_encode(['success'=>false,'message'=>'order_id required']); break; }
            try {
                $pdo->beginTransaction();
                $order = execute_query($pdo, "SELECT * FROM dispatch_orders WHERE id = ? FOR UPDATE", [$order_id])->fetch(PDO::FETCH_ASSOC);
                if (!$order) throw new Exception('Not found');
                if (($order['status'] ?? '') !== 'pending') throw new Exception('Only pending orders can be cancelled');
                execute_query($pdo, "DELETE FROM dispatch_order_items WHERE order_id = ?", [$order_id]);
                execute_query($pdo, "DELETE FROM dispatch_orders WHERE id = ?", [$order_id]);
                $pdo->commit();
                echo json_encode(['success'=>true]);
            } catch (Exception $e) {
                try { if ($pdo->inTransaction()) $pdo->rollBack(); } catch (Exception $ex) {}
                http_response_code(500);
                echo json_encode(['success'=>false,'message'=>'Cancel failed: ' . $e->getMessage()]);
            }
            break;
        }

        if ($action === 'confirmReceiptV2') {
            check_permission_or_die($pdo, 'factory_products', 'update');
            $order_id = intval($input['order_id'] ?? 0);
            $itemsIn = is_array($input['items'] ?? null) ? $input['items'] : [];
            if ($order_id <= 0) { http_response_code(400); echo json_encode(['success'=>false,'message'=>'order_id required']); break; }

            try {
                $pdo->beginTransaction();

                $order = execute_query($pdo, "SELECT * FROM dispatch_orders WHERE id = ? FOR UPDATE", [$order_id])->fetch(PDO::FETCH_ASSOC);
                if (!$order) throw new Exception('Not found');
                $status = strval($order['status'] ?? '');
                if ($status !== 'pending') {
                    throw new Exception('Only pending orders can be confirmed');
                }
                $fromWh = intval($order['from_warehouse_id']);
                $toWh = intval($order['to_warehouse_id']);
                $code = strval($order['code'] ?? '');

                $dbItems = execute_query(
                    $pdo,
                    "SELECT * FROM dispatch_order_items WHERE order_id = ? FOR UPDATE",
                    [$order_id]
                )->fetchAll(PDO::FETCH_ASSOC);
                if (!$dbItems || count($dbItems) === 0) throw new Exception('No items');

                // Map received quantities by product_id (allow payload by item_id or product_id)
                $recvByProduct = [];
                $recvByItemId = [];
                foreach ($itemsIn as $it) {
                    if (!is_array($it)) continue;
                    $iid = intval($it['item_id'] ?? ($it['id'] ?? 0));
                    $pid = intval($it['factory_product_id'] ?? ($it['product_id'] ?? 0));
                    $qty = intval($it['qty_received'] ?? ($it['received'] ?? ($it['quantity_received'] ?? ($it['qty'] ?? 0))));
                    if ($qty < 0) $qty = 0;
                    if ($iid > 0) $recvByItemId[$iid] = $qty;
                    if ($pid > 0) $recvByProduct[$pid] = $qty;
                }

                $anyMismatch = false;

                // First pass: validate and update qty_received
                $upd = $pdo->prepare("UPDATE dispatch_order_items SET qty_received = ? WHERE id = ?");
                foreach ($dbItems as $row) {
                    $iid = intval($row['id']);
                    $pid = intval($row['factory_product_id']);
                    $sent = intval($row['qty_sent']);
                    $received = null;
                    if (isset($recvByItemId[$iid])) $received = intval($recvByItemId[$iid]);
                    else if (isset($recvByProduct[$pid])) $received = intval($recvByProduct[$pid]);
                    else $received = 0;
                    if ($received < 0) $received = 0;
                    if ($received > $sent) throw new Exception('Received quantity cannot exceed sent quantity');
                    if ($received !== $sent) $anyMismatch = true;
                    $upd->execute([$received, $iid]);
                }

                // Second pass: apply stock movements based on received quantities only
                foreach ($dbItems as $row) {
                    $pid = intval($row['factory_product_id']);
                    $sent = intval($row['qty_sent']);
                    $sidRow = intval($row['size_id'] ?? 0);
                    $colorRow = trim((string)($row['color'] ?? ''));
                    // Read back received (after update) to be safe
                    $received = execute_query($pdo, "SELECT qty_received FROM dispatch_order_items WHERE id = ?", [intval($row['id'])])->fetchColumn();
                    $received = ($received === false || $received === null) ? 0 : intval($received);
                    if ($received <= 0) continue;

                    // From warehouse: decrement
                    $curFrom = execute_query(
                        $pdo,
                        "SELECT quantity FROM factory_stock WHERE factory_product_id = ? AND warehouse_id = ? FOR UPDATE",
                        [$pid, $fromWh]
                    )->fetchColumn();
                    $prevFromQty = ($curFrom === false || $curFrom === null) ? 0 : intval($curFrom);
                    if ($prevFromQty < $received) {
                        throw new Exception('Insufficient factory stock to confirm receipt');
                    }
                    execute_query(
                        $pdo,
                        "UPDATE factory_stock SET quantity = quantity - ? WHERE factory_product_id = ? AND warehouse_id = ?",
                        [$received, $pid, $fromWh]
                    );
                    $newFromQty = $prevFromQty - $received;

                    // To warehouse: add to store stock as a product variant (color + size)
                    if (table_exists($pdo, 'product_variants') && table_exists($pdo, 'stock')) {
                        $fp = table_exists($pdo, 'factory_products')
                            ? execute_query($pdo, "SELECT id, name, code, sale_price, min_stock FROM factory_products WHERE id = ? LIMIT 1", [$pid])->fetch(PDO::FETCH_ASSOC)
                            : null;
                        $sizeRow2 = (table_exists($pdo, 'sizes') && $sidRow > 0)
                            ? execute_query($pdo, "SELECT id, name, code FROM sizes WHERE id = ? LIMIT 1", [$sidRow])->fetch(PDO::FETCH_ASSOC)
                            : null;

                        $pName = $fp ? strval($fp['name'] ?? '') : ('منتج تصنيع #' . $pid);
                        $sizeStr = '';
                        if ($sizeRow2) {
                            $sizeStr = trim((string)($sizeRow2['name'] ?? ($sizeRow2['code'] ?? '')));
                        }
                        if ($sizeStr === '') $sizeStr = ($sidRow > 0 ? strval($sidRow) : '-');

                        $colorStr = ($colorRow === '' ? '-' : $colorRow);

                        // Deterministic barcode per (factory_product_id + size_id + color)
                        $colorKey = mb_strtolower($colorStr, 'UTF-8');
                        $barcode = 'FPV-' . $pid . '-' . $sidRow . '-' . substr(md5($colorKey), 0, 6);

                        $storeProductId = 0;
                        $existingPid = execute_query($pdo, "SELECT id FROM product_variants WHERE barcode = ? LIMIT 1", [$barcode])->fetchColumn();
                        if ($existingPid) {
                            $storeProductId = intval($existingPid);
                        } else {
                            $salePrice = $fp ? floatval($fp['sale_price'] ?? 0) : 0.0;
                            $reorder = $fp ? intval($fp['min_stock'] ?? 0) : 0;
                            if ($reorder <= 0) $reorder = 5;
                            $parentId = ensure_product_parent($pdo, $pName, 'تصنيع');

                            // Try to derive a unit cost from the latest factory movement for this factory product
                            $variantCost = 0.0;
                            try {
                                if (table_exists($pdo, 'factory_product_movements')) {
                                    $mv = execute_query($pdo, "SELECT notes FROM factory_product_movements WHERE factory_product_id = ? AND movement_type IN ('assembly_build','manufacturing_finish') ORDER BY id DESC LIMIT 1", [$pid])->fetchColumn();
                                    if (is_string($mv) && trim($mv) !== '') {
                                        $dec = json_decode($mv, true);
                                        if (is_array($dec) && isset($dec['unit_cost'])) {
                                            $variantCost = floatval($dec['unit_cost']);
                                        }
                                    }
                                }
                            } catch (Exception $e) {
                                $variantCost = 0.0;
                            }

                            execute_query(
                                $pdo,
                                "INSERT INTO product_variants (product_id, name, barcode, color, size, cost_price, sale_price, reorder_level) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                                [$parentId, $pName, $barcode, $colorStr, $sizeStr, $variantCost, $salePrice, $reorder]
                            );
                            $storeProductId = intval($pdo->lastInsertId());
                        }

                        // If variant existed but cost is zero, try to update it with latest factory unit cost
                        if ($storeProductId > 0) {
                            try {
                                $existingCost = execute_query($pdo, "SELECT cost_price FROM product_variants WHERE id = ? LIMIT 1", [$storeProductId])->fetchColumn();
                                $existingCost = ($existingCost === false || $existingCost === null) ? 0.0 : floatval($existingCost);
                                if ($existingCost <= 0.0) {
                                    $variantCost = 0.0;
                                    if (table_exists($pdo, 'factory_product_movements')) {
                                        $mv2 = execute_query($pdo, "SELECT notes FROM factory_product_movements WHERE factory_product_id = ? AND movement_type IN ('assembly_build','manufacturing_finish') ORDER BY id DESC LIMIT 1", [$pid])->fetchColumn();
                                        if (is_string($mv2) && trim($mv2) !== '') {
                                            $dec2 = json_decode($mv2, true);
                                            if (is_array($dec2) && isset($dec2['unit_cost'])) {
                                                $variantCost = floatval($dec2['unit_cost']);
                                            }
                                        }
                                    }
                                    if ($variantCost > 0.0) {
                                        execute_query($pdo, "UPDATE product_variants SET cost_price = ? WHERE id = ?", [$variantCost, $storeProductId]);
                                    }
                                }
                            } catch (Exception $e) {
                                // best-effort
                            }
                        }

                        if ($storeProductId > 0) {
                            $curStore = execute_query(
                                $pdo,
                                "SELECT quantity FROM stock WHERE product_id = ? AND warehouse_id = ? FOR UPDATE",
                                [$storeProductId, $toWh]
                            )->fetchColumn();
                            $prevStoreQty = ($curStore === false || $curStore === null) ? 0 : intval($curStore);
                            if ($curStore === false || $curStore === null) {
                                execute_query($pdo, "INSERT INTO stock (product_id, warehouse_id, quantity) VALUES (?, ?, ?)", [$storeProductId, $toWh, $received]);
                                $newStoreQty = $received;
                            } else {
                                execute_query($pdo, "UPDATE stock SET quantity = quantity + ? WHERE product_id = ? AND warehouse_id = ?", [$received, $storeProductId, $toWh]);
                                $newStoreQty = $prevStoreQty + $received;
                            }

                            if (table_exists($pdo, 'product_movements')) {
                                $mNotes = json_encode([
                                    'dispatch_order_id' => $order_id,
                                    'dispatch_code' => $code,
                                    'factory_product_id' => $pid,
                                    'size_id' => $sidRow,
                                    'color' => $colorRow,
                                    'qty_sent' => $sent,
                                    'qty_received' => $received,
                                ]);
                                execute_query(
                                    $pdo,
                                    "INSERT INTO product_movements (product_id, warehouse_id, movement_type, quantity_change, previous_quantity, new_quantity, reference_id, reference_type, notes, created_by)
                                     VALUES (?, ?, 'transfer_in', ?, ?, ?, ?, ?, ?, ?)",
                                    [$storeProductId, $toWh, $received, $prevStoreQty, $newStoreQty, $order_id, 'dispatch_order', $mNotes, $created_by]
                                );
                            }
                        }
                    }

                    // Movements
                    if (table_exists($pdo, 'factory_product_movements')) {
                        $mNotes = json_encode([
                            'dispatch_order_id' => $order_id,
                            'dispatch_code' => $code,
                            'qty_sent' => $sent,
                            'qty_received' => $received,
                        ]);
                        execute_query(
                            $pdo,
                            "INSERT INTO factory_product_movements (factory_product_id, warehouse_id, movement_type, quantity_change, previous_quantity, new_quantity, reference_id, reference_type, notes, created_by)
                             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                            [$pid, $fromWh, 'send_to_sales', -$received, $prevFromQty, $newFromQty, $order_id, 'dispatch_order', $mNotes, $created_by]
                        );
                    }
                }

                $newStatus = $anyMismatch ? 'mismatch' : 'confirmed';
                execute_query(
                    $pdo,
                    "UPDATE dispatch_orders SET status = ?, confirmed_by = ?, confirmed_at = NOW() WHERE id = ?",
                    [$newStatus, $created_by, $order_id]
                );

                $pdo->commit();
                echo json_encode(['success'=>true,'data'=>['status'=>$newStatus]]);
            } catch (Exception $e) {
                try { if ($pdo->inTransaction()) $pdo->rollBack(); } catch (Exception $ex) {}
                http_response_code(500);
                echo json_encode(['success'=>false,'message'=>'Confirm receipt failed: ' . $e->getMessage()]);
            }
            break;
        }

        if ($action === 'getAll') {
            if (!table_exists($pdo, 'dispatches')) {
                echo json_encode(['success' => true, 'data' => []]);
                break;
            }
            $hasFp = table_exists($pdo, 'factory_products');
            $hasW = table_exists($pdo, 'warehouses');
            $hasU = table_exists($pdo, 'users');
            $sql = "SELECT d.*" .
                ($hasFp ? ", fp.name AS product_name, fp.code AS product_code" : ", NULL AS product_name, NULL AS product_code") .
                ($hasW ? ", w.name AS warehouse_name" : ", NULL AS warehouse_name") .
                ($hasU ? ", u.name AS created_by_name" : ", NULL AS created_by_name") .
                "\nFROM dispatches d" .
                ($hasFp ? "\nLEFT JOIN factory_products fp ON fp.id = d.factory_product_id" : "") .
                ($hasW ? "\nLEFT JOIN warehouses w ON w.id = d.warehouse_id" : "") .
                ($hasU ? "\nLEFT JOIN users u ON u.id = d.created_by" : "") .
                "\nORDER BY d.id DESC";
            $rows = execute_query($pdo, $sql)->fetchAll(PDO::FETCH_ASSOC);
            echo json_encode(['success' => true, 'data' => $rows]);
            break;
        }

        if ($action === 'add' || $action === 'create') {
            $factory_product_id = intval($input['factory_product_id'] ?? ($input['product_id'] ?? ($input['productId'] ?? 0)));
            $warehouse_id = intval($input['warehouse_id'] ?? ($input['warehouseId'] ?? 0));
            $quantity = intval($input['quantity'] ?? 0);
            $notes = trim((string)($input['notes'] ?? ''));

            $defaults = get_user_defaults($pdo);
            if ($defaults) {
                $defWid = isset($defaults['default_warehouse_id']) ? intval($defaults['default_warehouse_id']) : null;
                $canChangeW = isset($defaults['can_change_warehouse']) ? boolval($defaults['can_change_warehouse']) : true;
                if (!$canChangeW && $defWid) {
                    if ($warehouse_id && $warehouse_id !== $defWid) { http_response_code(400); echo json_encode(['success'=>false,'message'=>'المستودع مقفل للمستخدم ولا يمكن تغييره.']); break; }
                    if (!$warehouse_id) $warehouse_id = $defWid;
                } else {
                    if (!$warehouse_id && $defWid) $warehouse_id = $defWid;
                }
            }
            if (!$warehouse_id) $warehouse_id = 1;

            if ($factory_product_id <= 0 || $warehouse_id <= 0 || $quantity <= 0) {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'factory_product_id, warehouse_id, quantity are required']);
                break;
            }

            try {
                $pdo->beginTransaction();

                $cur = execute_query(
                    $pdo,
                    "SELECT quantity FROM factory_stock WHERE factory_product_id = ? AND warehouse_id = ? FOR UPDATE",
                    [$factory_product_id, $warehouse_id]
                )->fetchColumn();
                $prevQty = ($cur === false || $cur === null) ? 0 : intval($cur);
                if ($prevQty < $quantity) {
                    throw new Exception('Insufficient factory stock');
                }
                execute_query(
                    $pdo,
                    "UPDATE factory_stock SET quantity = quantity - ? WHERE factory_product_id = ? AND warehouse_id = ?",
                    [$quantity, $factory_product_id, $warehouse_id]
                );
                $newQty = $prevQty - $quantity;

                execute_query(
                    $pdo,
                    "INSERT INTO dispatches (factory_product_id, warehouse_id, quantity, notes, created_by) VALUES (?, ?, ?, ?, ?)",
                    [$factory_product_id, $warehouse_id, $quantity, ($notes === '' ? null : $notes), $created_by]
                );
                $dispatchId = intval($pdo->lastInsertId());

                if (table_exists($pdo, 'factory_product_movements')) {
                    $mNotes = json_encode(['dispatch_id' => $dispatchId, 'notes' => $notes]);
                    execute_query(
                        $pdo,
                        "INSERT INTO factory_product_movements (factory_product_id, warehouse_id, movement_type, quantity_change, previous_quantity, new_quantity, reference_id, reference_type, notes, created_by)
                         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                        [$factory_product_id, $warehouse_id, 'send_to_sales', -$quantity, $prevQty, $newQty, $dispatchId, 'dispatch', $mNotes, $created_by]
                    );
                }

                $pdo->commit();
                echo json_encode(['success' => true, 'data' => ['id' => $dispatchId]]);
            } catch (Exception $e) {
                try { if ($pdo->inTransaction()) $pdo->rollBack(); } catch (Exception $ex) {}
                http_response_code(500);
                echo json_encode(['success' => false, 'message' => 'Dispatch failed: ' . $e->getMessage()]);
            }
            break;
        }

        if ($action === 'update' || $action === 'edit') {
            $id = intval($input['id'] ?? 0);
            $factory_product_id = intval($input['factory_product_id'] ?? ($input['product_id'] ?? ($input['productId'] ?? 0)));
            $warehouse_id = intval($input['warehouse_id'] ?? ($input['warehouseId'] ?? 0));
            $quantity = intval($input['quantity'] ?? 0);
            $notes = trim((string)($input['notes'] ?? ''));
            if ($id <= 0 || $factory_product_id <= 0 || $quantity <= 0) {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'id, factory_product_id, quantity are required']);
                break;
            }

            $defaults = get_user_defaults($pdo);
            if ($defaults) {
                $defWid = isset($defaults['default_warehouse_id']) ? intval($defaults['default_warehouse_id']) : null;
                $canChangeW = isset($defaults['can_change_warehouse']) ? boolval($defaults['can_change_warehouse']) : true;
                if (!$canChangeW && $defWid) {
                    if ($warehouse_id && $warehouse_id !== $defWid) { http_response_code(400); echo json_encode(['success'=>false,'message'=>'المستودع مقفل للمستخدم ولا يمكن تغييره.']); break; }
                    if (!$warehouse_id) $warehouse_id = $defWid;
                } else {
                    if (!$warehouse_id && $defWid) $warehouse_id = $defWid;
                }
            }
            if (!$warehouse_id) $warehouse_id = 1;

            try {
                $pdo->beginTransaction();

                $old = execute_query($pdo, "SELECT * FROM dispatches WHERE id = ? FOR UPDATE", [$id])->fetch(PDO::FETCH_ASSOC);
                if (!$old) throw new Exception('Not found');
                $oldFp = intval($old['factory_product_id']);
                $oldWh = intval($old['warehouse_id']);
                $oldQty = intval($old['quantity']);

                // Reverse old
                $curOld = execute_query(
                    $pdo,
                    "SELECT quantity FROM factory_stock WHERE factory_product_id = ? AND warehouse_id = ? FOR UPDATE",
                    [$oldFp, $oldWh]
                )->fetchColumn();
                $prevOldQty = ($curOld === false || $curOld === null) ? 0 : intval($curOld);
                $newOldQty = $prevOldQty + $oldQty;
                if ($curOld === false || $curOld === null) {
                    execute_query($pdo, "INSERT INTO factory_stock (factory_product_id, warehouse_id, quantity) VALUES (?, ?, ?)", [$oldFp, $oldWh, $newOldQty]);
                } else {
                    execute_query($pdo, "UPDATE factory_stock SET quantity = quantity + ? WHERE factory_product_id = ? AND warehouse_id = ?", [$oldQty, $oldFp, $oldWh]);
                }
                if (table_exists($pdo, 'factory_product_movements') && $oldQty != 0) {
                    $mNotes = json_encode(['dispatch_id' => $id, 'reason' => 'update_reverse']);
                    execute_query(
                        $pdo,
                        "INSERT INTO factory_product_movements (factory_product_id, warehouse_id, movement_type, quantity_change, previous_quantity, new_quantity, reference_id, reference_type, notes, created_by)
                         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                        [$oldFp, $oldWh, 'send_to_sales_return', $oldQty, $prevOldQty, $newOldQty, $id, 'dispatch', $mNotes, $created_by]
                    );
                }

                // Apply new
                $curNew = execute_query(
                    $pdo,
                    "SELECT quantity FROM factory_stock WHERE factory_product_id = ? AND warehouse_id = ? FOR UPDATE",
                    [$factory_product_id, $warehouse_id]
                )->fetchColumn();
                $prevNewQty = ($curNew === false || $curNew === null) ? 0 : intval($curNew);
                if ($prevNewQty < $quantity) throw new Exception('Insufficient factory stock');
                execute_query(
                    $pdo,
                    "UPDATE factory_stock SET quantity = quantity - ? WHERE factory_product_id = ? AND warehouse_id = ?",
                    [$quantity, $factory_product_id, $warehouse_id]
                );
                $newNewQty = $prevNewQty - $quantity;
                if (table_exists($pdo, 'factory_product_movements') && $quantity != 0) {
                    $mNotes = json_encode(['dispatch_id' => $id, 'notes' => $notes]);
                    execute_query(
                        $pdo,
                        "INSERT INTO factory_product_movements (factory_product_id, warehouse_id, movement_type, quantity_change, previous_quantity, new_quantity, reference_id, reference_type, notes, created_by)
                         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                        [$factory_product_id, $warehouse_id, 'send_to_sales', -$quantity, $prevNewQty, $newNewQty, $id, 'dispatch', $mNotes, $created_by]
                    );
                }

                execute_query(
                    $pdo,
                    "UPDATE dispatches SET factory_product_id = ?, warehouse_id = ?, quantity = ?, notes = ? WHERE id = ?",
                    [$factory_product_id, $warehouse_id, $quantity, ($notes === '' ? null : $notes), $id]
                );

                $pdo->commit();
                echo json_encode(['success' => true]);
            } catch (Exception $e) {
                try { if ($pdo->inTransaction()) $pdo->rollBack(); } catch (Exception $ex) {}
                http_response_code(500);
                echo json_encode(['success' => false, 'message' => 'Update failed: ' . $e->getMessage()]);
            }
            break;
        }

        if ($action === 'delete' || $action === 'remove') {
            $id = intval($input['id'] ?? 0);
            if ($id <= 0) { http_response_code(400); echo json_encode(['success' => false, 'message' => 'id required']); break; }
            try {
                $pdo->beginTransaction();
                $old = execute_query($pdo, "SELECT * FROM dispatches WHERE id = ? FOR UPDATE", [$id])->fetch(PDO::FETCH_ASSOC);
                if (!$old) throw new Exception('Not found');
                $fp = intval($old['factory_product_id']);
                $wh = intval($old['warehouse_id']);
                $qty = intval($old['quantity']);

                $cur = execute_query(
                    $pdo,
                    "SELECT quantity FROM factory_stock WHERE factory_product_id = ? AND warehouse_id = ? FOR UPDATE",
                    [$fp, $wh]
                )->fetchColumn();
                $prevQty = ($cur === false || $cur === null) ? 0 : intval($cur);
                $newQty = $prevQty + $qty;
                if ($cur === false || $cur === null) {
                    execute_query($pdo, "INSERT INTO factory_stock (factory_product_id, warehouse_id, quantity) VALUES (?, ?, ?)", [$fp, $wh, $newQty]);
                } else {
                    execute_query($pdo, "UPDATE factory_stock SET quantity = quantity + ? WHERE factory_product_id = ? AND warehouse_id = ?", [$qty, $fp, $wh]);
                }

                if (table_exists($pdo, 'factory_product_movements') && $qty != 0) {
                    $mNotes = json_encode(['dispatch_id' => $id, 'reason' => 'delete_reverse']);
                    execute_query(
                        $pdo,
                        "INSERT INTO factory_product_movements (factory_product_id, warehouse_id, movement_type, quantity_change, previous_quantity, new_quantity, reference_id, reference_type, notes, created_by)
                         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                        [$fp, $wh, 'send_to_sales_return', $qty, $prevQty, $newQty, $id, 'dispatch', $mNotes, $created_by]
                    );
                }

                execute_query($pdo, "DELETE FROM dispatches WHERE id = ?", [$id]);
                $pdo->commit();
                echo json_encode(['success' => true]);
            } catch (Exception $e) {
                try { if ($pdo->inTransaction()) $pdo->rollBack(); } catch (Exception $ex) {}
                http_response_code(500);
                echo json_encode(['success' => false, 'message' => 'Delete failed: ' . $e->getMessage()]);
            }
            break;
        }

        http_response_code(404);
        echo json_encode(['success' => false, 'message' => "Action '$action' not supported."]);
        break;
    case 'attendance_devices':
        ensure_hrm_tables($pdo);
        ensure_attendance_tables($pdo);
        $action = $_GET['action'] ?? 'getAll';
        $perm_code = map_action_to_perm($action);
        if ($perm_code) {
            check_permission_or_die($pdo, 'employees', $perm_code);
        }
        if ($action === 'pullLogs') {
            check_permission_or_die($pdo, 'employees', 'edit');
            $device_id = intval($input['device_id'] ?? ($_GET['device_id'] ?? 0));
            $start = trim((string)($input['start_date'] ?? ($_GET['start_date'] ?? '')));
            $end = trim((string)($input['end_date'] ?? ($_GET['end_date'] ?? '')));
            try {
                $out = attendance_pull_and_store($pdo, $device_id, $start, $end);
                echo json_encode(array_merge(['success' => (bool)($out['success'] ?? true)], $out));
            } catch (Exception $e) {
                http_response_code(500);
                echo json_encode(['success' => false, 'message' => $e->getMessage()]);
            }
            break;
        }
        handle_crud($pdo, 'attendance_devices', $input, ['name', 'vendor', 'protocol', 'driver', 'driver_config', 'ip', 'port', 'serial_number', 'username', 'password', 'location', 'enabled', 'last_sync_at']);
        break;
    case 'attendance_device_users':
        ensure_hrm_tables($pdo);
        ensure_attendance_tables($pdo);
        $action = $_GET['action'] ?? 'getAll';
        $perm_code = map_action_to_perm($action);
        if ($perm_code) {
            check_permission_or_die($pdo, 'employees', $perm_code);
        }
        if ($action === 'setForEmployee') {
            $employee_id = intval($input['employee_id'] ?? 0);
            $device_id = intval($input['device_id'] ?? 0);
            $device_user_id = trim((string)($input['device_user_id'] ?? ''));
            if (!$employee_id || !$device_id || $device_user_id === '') {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'employee_id, device_id and device_user_id are required.']);
                break;
            }
            execute_query($pdo, "DELETE FROM attendance_device_users WHERE employee_id = ?", [$employee_id]);
            execute_query($pdo, "INSERT INTO attendance_device_users (device_id, employee_id, device_user_id) VALUES (?, ?, ?)", [$device_id, $employee_id, $device_user_id]);
            echo json_encode(['success' => true]);
            break;
        }
        handle_crud($pdo, 'attendance_device_users', $input, ['device_id', 'employee_id', 'device_user_id']);
        break;

    case 'attendance_device_workers':
        ensure_workers_tables($pdo);
        ensure_attendance_tables($pdo);
        $action = $_GET['action'] ?? 'getAll';
        $perm_code = map_action_to_perm($action);
        if ($perm_code) {
            check_permission_or_die($pdo, 'workers', $perm_code);
        }
        if ($action === 'setForWorker') {
            $worker_id = intval($input['worker_id'] ?? 0);
            $device_id = intval($input['device_id'] ?? 0);
            $device_user_id = trim((string)($input['device_user_id'] ?? ''));
            if (!$worker_id || !$device_id || $device_user_id === '') {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'worker_id, device_id and device_user_id are required.']);
                break;
            }
            execute_query($pdo, "DELETE FROM attendance_device_workers WHERE worker_id = ?", [$worker_id]);
            execute_query($pdo, "INSERT INTO attendance_device_workers (device_id, worker_id, device_user_id) VALUES (?, ?, ?)", [$device_id, $worker_id, $device_user_id]);
            echo json_encode(['success' => true]);
            break;
        }
        handle_crud($pdo, 'attendance_device_workers', $input, ['device_id', 'worker_id', 'device_user_id']);
        break;
    case 'attendance_shifts':
        ensure_hrm_tables($pdo);
        ensure_attendance_tables($pdo);
        $action = $_GET['action'] ?? 'getAll';
        $perm_code = map_action_to_perm($action);
        if ($perm_code) {
            check_permission_or_die($pdo, 'employees', $perm_code);
        }
        $hasWeekly = column_exists($pdo, 'attendance_shifts', 'weekly_off_days');
        if (!$hasWeekly) {
            try {
                execute_query($pdo, "ALTER TABLE attendance_shifts ADD COLUMN weekly_off_days VARCHAR(50) DEFAULT NULL");
            } catch (Exception $e) {
                // ignore migration errors in runtime
            }
            $hasWeekly = column_exists($pdo, 'attendance_shifts', 'weekly_off_days');
        }
        $fields = ['name', 'start_time', 'end_time', 'break_minutes', 'grace_in_minutes', 'grace_out_minutes', 'late_penalty_per_minute', 'early_leave_penalty_per_minute', 'absence_penalty_per_day', 'overtime_rate_per_hour', 'is_night_shift'];
        if ($hasWeekly) {
            $fields[] = 'weekly_off_days';
        }
        handle_crud($pdo, 'attendance_shifts', $input, $fields);
        break;
    case 'attendance_schedules':
        ensure_hrm_tables($pdo);
        ensure_attendance_tables($pdo);
        $action = $_GET['action'] ?? 'getAll';
        $perm_code = map_action_to_perm($action);
        if ($perm_code) {
            check_permission_or_die($pdo, 'employees', $perm_code);
        }
        handle_crud($pdo, 'attendance_schedules', $input, ['employee_id', 'shift_id', 'day_of_week', 'valid_from', 'valid_to']);
        break;
    case 'attendance_holidays':
        ensure_hrm_tables($pdo);
        ensure_attendance_tables($pdo);
        $action = $_GET['action'] ?? 'getAll';
        $perm_code = map_action_to_perm($action);
        if ($perm_code) {
            check_permission_or_die($pdo, 'employees', $perm_code);
        }
        handle_crud($pdo, 'attendance_holidays', $input, ['name', 'holiday_date', 'is_paid']);
        break;
    case 'attendance_logs':
        ensure_hrm_tables($pdo);
        ensure_attendance_tables($pdo);
        $action = $_GET['action'] ?? 'getAll';
        $perm_code = map_action_to_perm($action);
        if ($perm_code) {
            check_permission_or_die($pdo, 'employees', $perm_code);
        }
        if ($action === 'bulkInsert') {
            $items = $input['items'] ?? [];
            if (!is_array($items) || count($items) === 0) {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'No items provided.']);
                break;
            }
            $pdo->beginTransaction();
            try {
                $stmt = $pdo->prepare("INSERT INTO attendance_logs (employee_id, device_id, device_user_id, check_time, direction, source, raw_payload) VALUES (?, ?, ?, ?, ?, ?, ?)");
                foreach ($items as $it) {
                    $device_id = isset($it['device_id']) ? intval($it['device_id']) : null;
                    $device_user_id = $it['device_user_id'] ?? null;
                    $employee_id = isset($it['employee_id']) ? intval($it['employee_id']) : null;

                    if (!$employee_id && $device_id && $device_user_id) {
                        $mapStmt = execute_query($pdo, "SELECT employee_id FROM attendance_device_users WHERE device_id = ? AND device_user_id = ? LIMIT 1", [$device_id, $device_user_id]);
                        $employee_id = $mapStmt->fetchColumn() ?: null;
                    }

                    $stmt->execute([
                        $employee_id,
                        $device_id,
                        $device_user_id,
                        $it['check_time'] ?? null,
                        $it['direction'] ?? 'unknown',
                        $it['source'] ?? 'import',
                        isset($it['raw_payload']) ? json_encode($it['raw_payload']) : null
                    ]);
                }
                $pdo->commit();
                echo json_encode(['success' => true]);
            } catch (Exception $e) {
                $pdo->rollBack();
                http_response_code(500);
                echo json_encode(['success' => false, 'message' => $e->getMessage()]);
            }
            break;
        }
        if ($action === 'getByRange') {
            $start = $_GET['start_date'] ?? '';
            $end = $_GET['end_date'] ?? '';
            if (!$start || !$end) {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'start_date and end_date required.']);
                break;
            }
            $stmt = execute_query($pdo, "SELECT * FROM attendance_logs WHERE check_time BETWEEN ? AND ? ORDER BY check_time ASC", [$start . ' 00:00:00', $end . ' 23:59:59']);
            echo json_encode(['success' => true, 'data' => $stmt->fetchAll(PDO::FETCH_ASSOC)]);
            break;
        }
        handle_crud($pdo, 'attendance_logs', $input, ['employee_id', 'device_id', 'device_user_id', 'check_time', 'direction', 'source', 'raw_payload']);
        break;
    case 'attendance_summary':
        ensure_hrm_tables($pdo);
        ensure_attendance_tables($pdo);
        $action = $_GET['action'] ?? 'getForRange';
        $perm_code = map_action_to_perm($action);
        if ($perm_code) {
            check_permission_or_die($pdo, 'employees', $perm_code);
        }
        if ($action === 'generateForRange') {
            $start = $input['start_date'] ?? '';
            $end = $input['end_date'] ?? '';
            if (!$start || !$end) {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'start_date and end_date required.']);
                break;
            }
            $pdo->beginTransaction();
            try {
                attendance_generate_summary_range($pdo, $start, $end);
                $pdo->commit();
                echo json_encode(['success' => true]);
            } catch (Exception $e) {
                $pdo->rollBack();
                http_response_code(500);
                echo json_encode(['success' => false, 'message' => $e->getMessage()]);
            }
            break;
        }

        if ($action === 'getForRange') {
            $start = $_GET['start_date'] ?? '';
            $end = $_GET['end_date'] ?? '';
            if (!$start || !$end) {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'start_date and end_date required.']);
                break;
            }
            $stmt = execute_query($pdo, "SELECT s.*, e.name as employee_name FROM attendance_daily_summary s JOIN employees e ON s.employee_id = e.id WHERE s.work_date BETWEEN ? AND ? ORDER BY s.work_date ASC", [$start, $end]);
            echo json_encode(['success' => true, 'data' => $stmt->fetchAll(PDO::FETCH_ASSOC)]);
            break;
        }

        handle_crud($pdo, 'attendance_daily_summary', $input, ['employee_id', 'shift_id', 'work_date', 'first_in', 'last_out', 'late_minutes', 'early_leave_minutes', 'overtime_minutes', 'is_absent', 'status']);
        break;

    case 'attendance_worker_summary':
        ensure_workers_tables($pdo);
        ensure_attendance_tables($pdo);
        $action = $_GET['action'] ?? 'getForRange';
        $perm_code = map_action_to_perm($action);
        if ($perm_code) {
            check_permission_or_die($pdo, 'workers', $perm_code);
        }
        try {
            if ($action === 'generateForRange') {
                $start = $input['start_date'] ?? '';
                $end = $input['end_date'] ?? '';
                attendance_generate_worker_summary_range($pdo, $start, $end);
                echo json_encode(['success' => true]);
                break;
            }
            if ($action === 'getForRange') {
                $start = $_GET['start_date'] ?? '';
                $end = $_GET['end_date'] ?? '';
                if (!$start || !$end) {
                    http_response_code(400);
                    echo json_encode(['success' => false, 'message' => 'start_date and end_date required.']);
                    break;
                }
                $stmt = execute_query(
                    $pdo,
                    "SELECT s.*, w.name as worker_name, sh.name as shift_name
                     FROM attendance_worker_daily_summary s
                     JOIN workers w ON w.id = s.worker_id
                     LEFT JOIN attendance_shifts sh ON sh.id = s.shift_id
                     WHERE s.work_date BETWEEN ? AND ?
                     ORDER BY s.work_date ASC, w.name ASC",
                    [$start, $end]
                );
                echo json_encode(['success' => true, 'data' => $stmt->fetchAll(PDO::FETCH_ASSOC)]);
                break;
            }
            handle_crud($pdo, 'attendance_worker_daily_summary', $input, ['worker_id', 'shift_id', 'work_date', 'first_in', 'last_out', 'late_minutes', 'early_leave_minutes', 'overtime_minutes', 'is_absent', 'status']);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => $e->getMessage()]);
        }
        break;
    case 'dashboard':
        try {
            $action = $_GET['action'] ?? 'overview';
            if ($action !== 'overview') {
                http_response_code(404);
                echo json_encode(['success' => false, 'message' => 'Unknown dashboard action.']);
                break;
            }

            $today = date('Y-m-d');
            $rangeStart = $_GET['start_date'] ?? '';
            $rangeEnd = $_GET['end_date'] ?? '';

            if (!$rangeStart || !$rangeEnd) {
                $rangeStart = date('Y-m-01');
                $rangeEnd = date('Y-m-t');
            }

            $rangeStartObj = new DateTime($rangeStart);
            $rangeEndObj = new DateTime($rangeEnd);
            if ($rangeEndObj < $rangeStartObj) {
                $tmp = $rangeStartObj;
                $rangeStartObj = $rangeEndObj;
                $rangeEndObj = $tmp;
            }
            $rangeStart = $rangeStartObj->format('Y-m-d');
            $rangeEnd = $rangeEndObj->format('Y-m-d');

            $rangeDays = $rangeStartObj->diff($rangeEndObj)->days + 1;
            $prevEndObj = clone $rangeStartObj;
            $prevEndObj->modify('-1 day');
            $prevStartObj = clone $prevEndObj;
            $prevStartObj->modify('-' . ($rangeDays - 1) . ' day');
            $prevStart = $prevStartObj->format('Y-m-d');
            $prevEnd = $prevEndObj->format('Y-m-d');

            $revRangeStmt = execute_query($pdo, "SELECT COALESCE(SUM(total_amount),0) as total FROM orders WHERE DATE(created_at) BETWEEN ? AND ?", [$rangeStart, $rangeEnd]);
            $revenueRange = floatval($revRangeStmt->fetchColumn() ?? 0);

            $revPrevStmt = execute_query($pdo, "SELECT COALESCE(SUM(total_amount),0) as total FROM orders WHERE DATE(created_at) BETWEEN ? AND ?", [$prevStart, $prevEnd]);
            $revenuePrev = floatval($revPrevStmt->fetchColumn() ?? 0);

            $ordersRangeStmt = execute_query($pdo, "SELECT COUNT(*) FROM orders WHERE DATE(created_at) BETWEEN ? AND ?", [$rangeStart, $rangeEnd]);
            $ordersRange = intval($ordersRangeStmt->fetchColumn() ?? 0);

            $ordersPendingStmt = execute_query($pdo, "SELECT COUNT(*) FROM orders WHERE status = 'pending'");
            $ordersPending = intval($ordersPendingStmt->fetchColumn() ?? 0);

            $customersStmt = execute_query($pdo, "SELECT COUNT(*) FROM customers");
            $customersCount = intval($customersStmt->fetchColumn() ?? 0);

            $employeesStmt = execute_query($pdo, "SELECT COUNT(*) FROM employees WHERE status = 'active'");
            $employeesCount = intval($employeesStmt->fetchColumn() ?? 0);

            $stockStmt = execute_query($pdo, "SELECT COALESCE(SUM(quantity),0) FROM stock");
            $stockUnits = intval($stockStmt->fetchColumn() ?? 0);

            $lowStockCount = 0;
            try {
                $lsStmt = execute_query($pdo, "SELECT pv.id, pv.reorder_level, COALESCE(SUM(s.quantity),0) as q FROM product_variants pv LEFT JOIN stock s ON pv.id = s.product_id WHERE COALESCE(pv.is_archived,0)=0 GROUP BY pv.id HAVING q <= pv.reorder_level");
                $lowStockCount = $lsStmt->rowCount();
            } catch (Exception $e) {
                $lowStockCount = 0;
            }

            $profitRange = 0;
            try {
                $profitStmt = execute_query(
                    $pdo,
                    "SELECT COALESCE(SUM((oi.price_per_unit - pv.cost_price) * oi.quantity),0) as profit
                     FROM order_items oi
                     JOIN orders o ON o.id = oi.order_id
                     JOIN product_variants pv ON pv.id = oi.product_id
                     WHERE DATE(o.created_at) BETWEEN ? AND ?",
                    [$rangeStart, $rangeEnd]
                );
                $profitRange = floatval($profitStmt->fetchColumn() ?? 0);
            } catch (Exception $e) {
                $profitRange = 0;
            }

            $profitPrev = 0;
            try {
                $profitPrevStmt = execute_query(
                    $pdo,
                    "SELECT COALESCE(SUM((oi.price_per_unit - pv.cost_price) * oi.quantity),0) as profit
                     FROM order_items oi
                     JOIN orders o ON o.id = oi.order_id
                     JOIN product_variants pv ON pv.id = oi.product_id
                     WHERE DATE(o.created_at) BETWEEN ? AND ?",
                    [$prevStart, $prevEnd]
                );
                $profitPrev = floatval($profitPrevStmt->fetchColumn() ?? 0);
            } catch (Exception $e) {
                $profitPrev = 0;
            }

            $attendanceToday = ['present' => 0, 'absent' => 0];
            try {
                $attStmt = execute_query(
                    $pdo,
                    "SELECT
                        SUM(CASE WHEN status IN ('present','late') THEN 1 ELSE 0 END) as present,
                        SUM(CASE WHEN status = 'absent' THEN 1 ELSE 0 END) as absent
                     FROM attendance_daily_summary
                     WHERE work_date = ?",
                    [$today]
                );
                $attRow = $attStmt->fetch(PDO::FETCH_ASSOC);
                if ($attRow) {
                    $attendanceToday['present'] = intval($attRow['present'] ?? 0);
                    $attendanceToday['absent'] = intval($attRow['absent'] ?? 0);
                }
            } catch (Exception $e) {
                $attendanceToday = ['present' => 0, 'absent' => 0];
            }

            $salesByDate = [];
            $profitByDate = [];
            try {
                $salesStmt = execute_query(
                    $pdo,
                    "SELECT DATE(created_at) as d, COALESCE(SUM(total_amount),0) as total FROM orders WHERE DATE(created_at) BETWEEN ? AND ? GROUP BY d",
                    [$rangeStart, $rangeEnd]
                );
                foreach ($salesStmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
                    $salesByDate[$row['d']] = floatval($row['total'] ?? 0);
                }
            } catch (Exception $e) {
                $salesByDate = [];
            }

            try {
                $profitStmt = execute_query(
                    $pdo,
                    "SELECT DATE(o.created_at) as d, COALESCE(SUM((oi.price_per_unit - pv.cost_price) * oi.quantity),0) as profit
                     FROM order_items oi
                     JOIN orders o ON o.id = oi.order_id
                     JOIN product_variants pv ON pv.id = oi.product_id
                     WHERE DATE(o.created_at) BETWEEN ? AND ?
                     GROUP BY d",
                    [$rangeStart, $rangeEnd]
                );
                foreach ($profitStmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
                    $profitByDate[$row['d']] = floatval($row['profit'] ?? 0);
                }
            } catch (Exception $e) {
                $profitByDate = [];
            }

            $trend = [];
            $cursor = clone $rangeStartObj;
            while ($cursor <= $rangeEndObj) {
                $d = $cursor->format('Y-m-d');
                $trend[] = [
                    'date' => $d,
                    'sales' => floatval($salesByDate[$d] ?? 0),
                    'profit' => floatval($profitByDate[$d] ?? 0)
                ];
                $cursor->modify('+1 day');
            }

            $changePct = null;
            if ($revenuePrev > 0) {
                $changePct = (($revenueRange - $revenuePrev) / $revenuePrev) * 100;
            }

            $latestOrderDate = null;
            try {
                $latestOrderDateRaw = execute_query($pdo, "SELECT MAX(DATE(created_at)) FROM orders")->fetchColumn();
                if ($latestOrderDateRaw) {
                    $latestOrderDate = (new DateTime((string)$latestOrderDateRaw))->format('Y-m-d');
                }
            } catch (Exception $e) {
                $latestOrderDate = null;
            }

            // ── Top Representatives ────────────────────────────────────
            $topReps = [];
            try {
                $repNameExpr = "CONCAT('مندوب #', o.rep_id)";
                $repJoins = [];
                if (table_exists($pdo, 'representatives')) {
                    $repJoins[] = 'LEFT JOIN representatives rep ON rep.id = o.rep_id';
                    $repNameExpr = "COALESCE(NULLIF(TRIM(rep.name), ''), $repNameExpr)";
                }
                if (table_exists($pdo, 'users')) {
                    $repJoins[] = 'LEFT JOIN users rep_user ON rep_user.id = o.rep_id';
                    $repNameExpr = "COALESCE(NULLIF(TRIM(rep_user.name), ''), $repNameExpr)";
                }

                $repSql = "SELECT o.rep_id AS id,
                                  $repNameExpr AS name,
                                  COUNT(o.id) AS orders_count,
                                  COALESCE(SUM(o.total_amount),0) AS total_sales
                           FROM orders o
                           " . implode("\n", $repJoins) . "
                           WHERE DATE(o.created_at) BETWEEN ? AND ?
                             AND o.rep_id IS NOT NULL AND o.rep_id > 0
                           GROUP BY o.rep_id, name
                           ORDER BY total_sales DESC, orders_count DESC
                           LIMIT 10";

                $trStmt = execute_query($pdo, $repSql, [$rangeStart, $rangeEnd]);
                $topReps = $trStmt->fetchAll(PDO::FETCH_ASSOC);
                foreach ($topReps as &$r) {
                    $r['id'] = intval($r['id'] ?? 0);
                    $r['name'] = trim((string)($r['name'] ?? ''));
                    $r['total_sales'] = floatval($r['total_sales'] ?? 0);
                    $r['orders_count'] = intval($r['orders_count'] ?? 0);
                }
                unset($r);
            } catch (Exception $e) { $topReps = []; }

            // ── Top Pages (from orders.page) ───────────────────────────
            $topSalesOffices = [];
            try {
                if (column_exists($pdo, 'orders', 'page')) {
                    $toStmt = execute_query($pdo,
                        "SELECT TRIM(o.page) AS id,
                                TRIM(o.page) AS name,
                                COUNT(o.id) AS orders_count,
                                COALESCE(SUM(o.total_amount),0) AS total_sales
                         FROM orders o
                         WHERE DATE(o.created_at) BETWEEN ? AND ?
                           AND o.page IS NOT NULL
                           AND TRIM(o.page) <> ''
                         GROUP BY TRIM(o.page)
                         ORDER BY total_sales DESC, orders_count DESC
                         LIMIT 10",
                        [$rangeStart, $rangeEnd]
                    );
                    $topSalesOffices = $toStmt->fetchAll(PDO::FETCH_ASSOC);
                } elseif (table_exists($pdo, 'sales_offices') && column_exists($pdo, 'orders', 'sales_office_id')) {
                    $toStmt = execute_query($pdo,
                        "SELECT so.id, so.name,
                                COUNT(o.id) as orders_count,
                                COALESCE(SUM(o.total_amount),0) as total_sales
                         FROM orders o
                         JOIN sales_offices so ON so.id = o.sales_office_id
                         WHERE DATE(o.created_at) BETWEEN ? AND ?
                         GROUP BY so.id, so.name
                         ORDER BY total_sales DESC, orders_count DESC
                         LIMIT 10",
                        [$rangeStart, $rangeEnd]
                    );
                    $topSalesOffices = $toStmt->fetchAll(PDO::FETCH_ASSOC);
                }

                foreach ($topSalesOffices as &$r) {
                    $r['id'] = (string)($r['id'] ?? $r['name'] ?? '');
                    $r['name'] = trim((string)($r['name'] ?? ''));
                    $r['total_sales'] = floatval($r['total_sales'] ?? 0);
                    $r['orders_count'] = intval($r['orders_count'] ?? 0);
                }
                unset($r);
            } catch (Exception $e) { $topSalesOffices = []; }

            // ── Top Employees (from orders.employee) ──────────────────
            $topEmployees = [];
            try {
                if (column_exists($pdo, 'orders', 'employee')) {
                    $teStmt = execute_query($pdo,
                        "SELECT TRIM(o.employee) AS id,
                                TRIM(o.employee) AS name,
                                COUNT(o.id) AS orders_count,
                                COALESCE(SUM(o.total_amount),0) AS total_sales
                         FROM orders o
                         WHERE DATE(o.created_at) BETWEEN ? AND ?
                           AND o.employee IS NOT NULL
                           AND TRIM(o.employee) <> ''
                         GROUP BY TRIM(o.employee)
                         ORDER BY total_sales DESC, orders_count DESC
                         LIMIT 10",
                        [$rangeStart, $rangeEnd]
                    );
                    $topEmployees = $teStmt->fetchAll(PDO::FETCH_ASSOC);
                }

                foreach ($topEmployees as &$r) {
                    $r['id'] = (string)($r['id'] ?? $r['name'] ?? '');
                    $r['name'] = trim((string)($r['name'] ?? ''));
                    $r['total_sales'] = floatval($r['total_sales'] ?? 0);
                    $r['orders_count'] = intval($r['orders_count'] ?? 0);
                }
                unset($r);
            } catch (Exception $e) { $topEmployees = []; }

            // ── Top Products ──────────────────────────────────────────
            $topProducts = [];
            try {
                $tpStmt = execute_query($pdo,
                    "SELECT pp.name as product_name,
                            pv.color, pv.size,
                            SUM(oi.quantity) as qty_sold,
                            COALESCE(SUM(oi.quantity * oi.price_per_unit),0) as revenue
                     FROM order_items oi
                     JOIN orders o ON o.id = oi.order_id
                     JOIN product_variants pv ON pv.id = oi.product_id
                     JOIN products pp ON pp.id = pv.product_id
                     WHERE DATE(o.created_at) BETWEEN ? AND ?
                     GROUP BY pp.id, pp.name, pv.color, pv.size
                     ORDER BY qty_sold DESC
                     LIMIT 10",
                    [$rangeStart, $rangeEnd]
                );
                $topProducts = $tpStmt->fetchAll(PDO::FETCH_ASSOC);
                foreach ($topProducts as &$r) {
                    $r['qty_sold'] = intval($r['qty_sold']);
                    $r['revenue']  = floatval($r['revenue']);
                }
                unset($r);
            } catch (Exception $e) { $topProducts = []; }

            // ── Orders by Status ──────────────────────────────────────
            $ordersByStatus = [];
            try {
                $osStmt = execute_query($pdo,
                    "SELECT status, COUNT(*) as cnt, COALESCE(SUM(total_amount),0) as total
                     FROM orders
                     WHERE DATE(created_at) BETWEEN ? AND ?
                     GROUP BY status",
                    [$rangeStart, $rangeEnd]
                );
                foreach ($osStmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
                    $ordersByStatus[] = [
                        'status' => $row['status'],
                        'count'  => intval($row['cnt']),
                        'total'  => floatval($row['total'])
                    ];
                }
            } catch (Exception $e) { $ordersByStatus = []; }

            echo json_encode([
                'success' => true,
                'data' => [
                    'revenue_month'     => $revenueRange,
                    'profit_month'      => $profitRange,
                    'orders_month'      => $ordersRange,
                    'orders_pending'    => $ordersPending,
                    'customers_count'   => $customersCount,
                    'employees_count'   => $employeesCount,
                    'stock_units'       => $stockUnits,
                    'low_stock_count'   => $lowStockCount,
                    'attendance_today'  => $attendanceToday,
                    'trend'             => $trend,
                    'revenue_change_pct'=> $changePct,
                    'prev_revenue'      => $revenuePrev,
                    'prev_profit'       => $profitPrev,
                    'range_start'       => $rangeStart,
                    'range_end'         => $rangeEnd,
                    'latest_order_date' => $latestOrderDate,
                    'prev_range_start'  => $prevStart,
                    'prev_range_end'    => $prevEnd,
                    'top_reps'          => $topReps,
                    'top_sales_offices' => $topSalesOffices,
                    'top_employees'     => $topEmployees,
                    'top_products'      => $topProducts,
                    'orders_by_status'  => $ordersByStatus,
                ]
            ]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => $e->getMessage()]);
        }
        break;
    case 'users':
        $action = $_GET['action'] ?? 'getAll';
        if ($action === 'getAllWithBalance') {
            check_permission_or_die($pdo, 'users', 'view');
            $rep_related_type = pick_allowed_enum($pdo, 'transactions', 'related_to_type', 'rep', ['rep','employee','none']);
            
            $sql = "SELECT 
                        u.*, 
                        COALESCE(t.balance, 0) as balance 
                    FROM users u
                    LEFT JOIN (
                        SELECT 
                            related_to_id, 
                            SUM(amount) as balance 
                        FROM transactions 
                        WHERE related_to_type = ?
                        GROUP BY related_to_id
                    ) t ON u.id = t.related_to_id
                    WHERE u.role = 'representative'
                    ORDER BY u.name ASC";

            $stmt = execute_query($pdo, $sql, [$rep_related_type]);
            echo json_encode(['success' => true, 'data' => $stmt->fetchAll(PDO::FETCH_ASSOC)]);
            break; 
        }

        // Runtime migration: ensure insurance columns exist on users table.
        // Frontend stores representatives in users (role='representative').
        try {
            if (table_exists($pdo, 'users')) {
                if (!column_exists($pdo, 'users', 'insurance_paid')) {
                    execute_query($pdo, "ALTER TABLE users ADD COLUMN insurance_paid TINYINT(1) NOT NULL DEFAULT 0 COMMENT 'هل دفع تأمين'");
                }
                if (!column_exists($pdo, 'users', 'insurance_amount')) {
                    execute_query($pdo, "ALTER TABLE users ADD COLUMN insurance_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00 COMMENT 'مبلغ التأمين المدفوع'");
                }
            }
        } catch (Exception $e) {
            // If DB user lacks ALTER privileges, ignore and keep API working.
        }

        // If DB has a 'permissions' column, include it in CRUD operations
        $user_fields = ['name', 'username', 'role', 'phone', 'status', 'password'];
        $select_fields = '*';
        if (column_exists($pdo, 'users', 'permissions')) {
            $user_fields[] = 'permissions';
            $select_fields = '*, permissions';
        }

        // Insurance fields (used for representatives)
        if (column_exists($pdo, 'users', 'insurance_paid')) {
            $user_fields[] = 'insurance_paid';
        }
        if (column_exists($pdo, 'users', 'insurance_amount')) {
            $user_fields[] = 'insurance_amount';
        }

        handle_crud($pdo, 'users', $input, $user_fields, $select_fields);
        break;
    case 'profile':
        $action = $_GET['action'] ?? 'get';
        $current_user = $_SESSION['user_id'] ?? null;
        if (!$current_user) {
            http_response_code(403);
            echo json_encode(['success' => false, 'message' => 'Authentication required.']);
            break;
        }

        if ($action === 'get') {
            $stmt = execute_query($pdo, "SELECT id, name, username, phone, role, avatar, created_at FROM users WHERE id = ? LIMIT 1", [$current_user]);
            $user = $stmt->fetch(PDO::FETCH_ASSOC);
            echo json_encode(['success' => true, 'data' => $user]);
            break;
        }

        if ($action === 'update') {
            $name = $input['name'] ?? ($_POST['name'] ?? '');
            $phone = $input['phone'] ?? ($_POST['phone'] ?? '');
            $name = trim((string)$name);
            $phone = trim((string)$phone);
            if ($name === '') {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'الاسم مطلوب.']);
                break;
            }

            execute_query($pdo, "UPDATE users SET name = ?, phone = ? WHERE id = ?", [$name, $phone, $current_user]);
            $stmt = execute_query($pdo, "SELECT id, name, username, phone, role, avatar, created_at FROM users WHERE id = ? LIMIT 1", [$current_user]);
            $user = $stmt->fetch(PDO::FETCH_ASSOC);
            if (isset($_SESSION['user'])) {
                $_SESSION['user']['name'] = $user['name'] ?? $_SESSION['user']['name'];
                $_SESSION['user']['phone'] = $user['phone'] ?? ($_SESSION['user']['phone'] ?? null);
            }
            echo json_encode(['success' => true, 'data' => $user]);
            break;
        }

        if ($action === 'changePassword') {
            $current = $input['current_password'] ?? ($_POST['current_password'] ?? '');
            $next = $input['new_password'] ?? ($_POST['new_password'] ?? '');
            if (!$current || !$next) {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'البيانات غير مكتملة.']);
                break;
            }
            $stmt = execute_query($pdo, "SELECT password FROM users WHERE id = ? LIMIT 1", [$current_user]);
            $row = $stmt->fetch(PDO::FETCH_ASSOC);
            $hash = $row['password'] ?? '';
            if (!$hash || !password_verify($current, $hash)) {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'كلمة المرور الحالية غير صحيحة.']);
                break;
            }
            $newHash = password_hash($next, PASSWORD_DEFAULT);
            execute_query($pdo, "UPDATE users SET password = ? WHERE id = ?", [$newHash, $current_user]);
            echo json_encode(['success' => true]);
            break;
        }

        if ($action === 'uploadAvatar') {
            if (!isset($_FILES['avatar'])) {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'الملف غير موجود.']);
                break;
            }
            $file = $_FILES['avatar'];
            if (($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'تعذر رفع الملف.']);
                break;
            }
            if (($file['size'] ?? 0) > (2 * 1024 * 1024)) {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'الملف كبير جدا.']);
                break;
            }
            $ext = strtolower(pathinfo($file['name'] ?? '', PATHINFO_EXTENSION));
            $allowed = ['jpg', 'jpeg', 'png', 'webp'];
            if (!in_array($ext, $allowed, true)) {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'نوع الملف غير مدعوم.']);
                break;
            }

            $upload_dir = __DIR__ . '/../uploads/avatars';
            if (!is_dir($upload_dir)) {
                mkdir($upload_dir, 0755, true);
            }
            $filename = 'user_' . $current_user . '_' . date('Ymd_His') . '.' . $ext;
            $target = $upload_dir . '/' . $filename;
            if (!move_uploaded_file($file['tmp_name'], $target)) {
                http_response_code(500);
                echo json_encode(['success' => false, 'message' => 'فشل حفظ الملف.']);
                break;
            }

            $public_path = '/uploads/avatars/' . $filename;
            execute_query($pdo, "UPDATE users SET avatar = ? WHERE id = ?", [$public_path, $current_user]);
            if (isset($_SESSION['user'])) {
                $_SESSION['user']['avatar'] = $public_path;
            }
            echo json_encode(['success' => true, 'avatar' => $public_path]);
            break;
        }

        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Invalid profile action.']);
        break;

    case 'notifications':
        $action = $_GET['action'] ?? 'getMy';
        ensure_user_notifications_table($pdo);

        $current_user = $_SESSION['user_id'] ?? 0;
        if (!$current_user) {
            http_response_code(401);
            echo json_encode(['success' => false, 'message' => 'Not authenticated']);
            break;
        }

        if ($action === 'getMy') {
            $limit = intval($_GET['limit'] ?? 50);
            if ($limit <= 0) $limit = 50;
            if ($limit > 200) $limit = 200;

            $rows = execute_query(
                $pdo,
                "SELECT id, type, title, text, data, created_at FROM user_notifications WHERE user_id = ? AND is_read = 0 ORDER BY id DESC LIMIT $limit",
                [$current_user]
            )->fetchAll(PDO::FETCH_ASSOC);
            echo json_encode(['success' => true, 'data' => $rows]);
            break;
        }

        if ($action === 'markRead') {
            $id = intval($input['id'] ?? ($_GET['id'] ?? 0));
            if ($id <= 0) { http_response_code(400); echo json_encode(['success'=>false,'message'=>'id required']); break; }
            execute_query($pdo, "UPDATE user_notifications SET is_read = 1 WHERE id = ? AND user_id = ?", [$id, $current_user]);
            echo json_encode(['success' => true]);
            break;
        }

        if ($action === 'markAllRead') {
            execute_query($pdo, "UPDATE user_notifications SET is_read = 1 WHERE user_id = ?", [$current_user]);
            echo json_encode(['success' => true]);
            break;
        }

        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Invalid notifications action.']);
        break;

    case 'permissions':
        $action = $_GET['action'] ?? 'getModules';
        // Ensure responses for permissions endpoints are never cached by the browser
        // (prevents 304 Not Modified responses returning empty bodies during dev)
        header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
        header('Pragma: no-cache');
        header('Expires: Thu, 01 Jan 1970 00:00:00 GMT');
        header('Content-Type: application/json; charset=utf-8');
        $perm_code = map_action_to_perm($action);

        // Permissions endpoints are used by the UI for non-admin users too.
        // Only restrict management actions; always allow a logged-in user to read
        // their own permissions/pages/modules to avoid accidental lockouts.
        $uid = intval($_SESSION['user_id'] ?? 0);
        if (!can_manage_permissions($pdo)) {
            if (!$uid) {
                http_response_code(403);
                echo json_encode(['success' => false, 'message' => 'Authentication required.']);
                break;
            }

            $selfReadableActions = ['getUserPermissions', 'getUserPages'];
            $alwaysReadableActions = ['getMyModules', 'getUserDefaults'];

            if (in_array($action, $alwaysReadableActions, true)) {
                // OK
            } else if (in_array($action, $selfReadableActions, true)) {
                // If user_id not provided, assume current user.
                $requested_uid = intval($_GET['user_id'] ?? ($input['user_id'] ?? 0));
                if ($requested_uid <= 0) $requested_uid = $uid;
                if ($requested_uid !== $uid) {
                    http_response_code(403);
                    echo json_encode(['success' => false, 'message' => 'Insufficient permissions.']);
                    break;
                }
            } else {
                http_response_code(403);
                echo json_encode(['success' => false, 'message' => 'Insufficient permissions.']);
                break;
            }
        }
        try {
            if ($action === 'getModules') {
                $stmt = execute_query($pdo, "SELECT * FROM permission_modules ORDER BY parent_id IS NULL DESC, parent_id, `order` ASC");
                echo json_encode(['success' => true, 'data' => $stmt->fetchAll(PDO::FETCH_ASSOC)]);
                break;
            }
            if ($action === 'createModule') {
                $name = $input['name'] ?? '';
                $parent = isset($input['parent_id']) ? intval($input['parent_id']) : null;
                $order = isset($input['order']) ? intval($input['order']) : 0;
                if (!$name) { http_response_code(400); echo json_encode(['success'=>false,'message'=>'Name required']); break; }
                // Avoid duplicates (especially after adding UNIQUE(name))
                $existing = execute_query($pdo, "SELECT id FROM permission_modules WHERE name = ? LIMIT 1", [$name])->fetch(PDO::FETCH_ASSOC);
                if ($existing && isset($existing['id'])) {
                    echo json_encode(['success'=>true,'id'=>$existing['id'], 'message'=>'exists']);
                    break;
                }
                try {
                    execute_query($pdo, "INSERT INTO permission_modules (name, parent_id, `order`) VALUES (?, ?, ?)", [$name, $parent, $order]);
                    echo json_encode(['success'=>true,'id'=>$pdo->lastInsertId()]);
                } catch (Exception $e) {
                    // If UNIQUE(name) exists, handle duplicate insert gracefully
                    $existing2 = execute_query($pdo, "SELECT id FROM permission_modules WHERE name = ? LIMIT 1", [$name])->fetch(PDO::FETCH_ASSOC);
                    if ($existing2 && isset($existing2['id'])) {
                        echo json_encode(['success'=>true,'id'=>$existing2['id'], 'message'=>'exists']);
                    } else {
                        throw $e;
                    }
                }
                break;
            }
            if ($action === 'updateModule') {
                $id = intval($input['id'] ?? 0);
                if (!$id) { http_response_code(400); echo json_encode(['success'=>false,'message'=>'Module id required']); break; }
                $parts = [];$vals = [];
                if (isset($input['name'])) { $parts[] = 'name = ?'; $vals[] = $input['name']; }
                if (array_key_exists('parent_id', $input)) { $parts[] = 'parent_id = ?'; $vals[] = $input['parent_id']; }
                if (isset($input['order'])) { $parts[] = '`order` = ?'; $vals[] = intval($input['order']); }
                if (!empty($parts)) { $vals[] = $id; execute_query($pdo, "UPDATE permission_modules SET " . implode(', ', $parts) . " WHERE id = ?", $vals); }
                echo json_encode(['success'=>true]); break;
            }
            if ($action === 'deleteModule') {
                $id = intval($input['id'] ?? $_GET['id'] ?? 0);
                if (!$id) { http_response_code(400); echo json_encode(['success'=>false,'message'=>'Module id required']); break; }
                execute_query($pdo, "DELETE FROM permission_modules WHERE id = ?", [$id]);
                execute_query($pdo, "DELETE FROM user_permissions WHERE module_id = ?", [$id]);
                echo json_encode(['success'=>true]); break;
            }

            if ($action === 'getActions') {
                $stmt = execute_query($pdo, "SELECT * FROM permission_actions ORDER BY id");
                echo json_encode(['success'=>true,'data'=>$stmt->fetchAll(PDO::FETCH_ASSOC)]); break;
            }
            if ($action === 'createAction') {
                $name = $input['name'] ?? '';
                $code = $input['code'] ?? '';
                if (!$name || !$code) { http_response_code(400); echo json_encode(['success'=>false,'message'=>'name and code required']); break; }
                execute_query($pdo, "INSERT INTO permission_actions (name, code) VALUES (?, ?)", [$name, $code]);
                echo json_encode(['success'=>true,'id'=>$pdo->lastInsertId()]); break;
            }
            if ($action === 'updateAction') {
                $id = intval($input['id'] ?? 0);
                if (!$id) { http_response_code(400); echo json_encode(['success'=>false,'message'=>'Action id required']); break; }
                $parts = [];$vals = [];
                if (isset($input['name'])) { $parts[] = 'name = ?'; $vals[] = $input['name']; }
                if (isset($input['code'])) { $parts[] = 'code = ?'; $vals[] = $input['code']; }
                if (!empty($parts)) { $vals[] = $id; execute_query($pdo, "UPDATE permission_actions SET " . implode(', ', $parts) . " WHERE id = ?", $vals); }
                echo json_encode(['success'=>true]); break;
            }
            if ($action === 'deleteAction') {
                $id = intval($input['id'] ?? $_GET['id'] ?? 0);
                if (!$id) { http_response_code(400); echo json_encode(['success'=>false,'message'=>'Action id required']); break; }
                execute_query($pdo, "DELETE FROM permission_actions WHERE id = ?", [$id]);
                execute_query($pdo, "DELETE FROM user_permissions WHERE action_id = ?", [$id]);
                echo json_encode(['success'=>true]); break;
            }

            // User-specific permissions
            if ($action === 'getUserPermissions') {
                $user_id = intval($_GET['user_id'] ?? $input['user_id'] ?? ($_SESSION['user_id'] ?? 0));
                if ($user_id <= 0) {
                    $user_id = intval($_SESSION['user_id'] ?? 0);
                }
                if (!$user_id) { http_response_code(400); echo json_encode(['success'=>false,'message'=>'user_id required']); break; }
                $sql = "SELECT up.user_id, up.module_id, up.action_id, up.allowed, m.name as module_name, a.name as action_name, a.code as action_code
                        FROM user_permissions up
                        LEFT JOIN permission_modules m ON m.id = up.module_id
                        LEFT JOIN permission_actions a ON a.id = up.action_id
                        WHERE up.user_id = ?";
                // Measure query time for troubleshooting slow responses
                $t0 = microtime(true);
                $stmt = execute_query($pdo, $sql, [$user_id]);
                $t1 = microtime(true);
                $dur = $t1 - $t0;
                if ($dur > 0.2) {
                    try {
                        $dbg = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'nexus_perf.log';
                        $entry = "[" . date('c') . "] getUserPermissions user_id={$user_id} duration=" . round($dur,4) . "s SQL=" . str_replace("\n"," ", $sql) . "\n";
                        @file_put_contents($dbg, $entry, FILE_APPEND | LOCK_EX);
                        @error_log("nexus: slow getUserPermissions ({$dur}s) for user {$user_id}");
                    } catch (Exception $e) {}
                }
                echo json_encode(['success'=>true,'data'=>$stmt->fetchAll(PDO::FETCH_ASSOC)]); break;
            }

            // Get per-user page access (top-level pages/menu)
            if ($action === 'getUserPages') {
                $user_id = intval($_GET['user_id'] ?? ($_SESSION['user_id'] ?? 0));
                if ($user_id <= 0) {
                    $user_id = intval($_SESSION['user_id'] ?? 0);
                }
                if (!$user_id) { http_response_code(400); echo json_encode(['success'=>false,'message'=>'user_id required']); break; }
                $stmt = execute_query($pdo, "SELECT page_slug, can_access FROM user_page_permissions WHERE user_id = ?", [$user_id]);
                echo json_encode(['success'=>true,'data'=>$stmt->fetchAll(PDO::FETCH_ASSOC)]); break;
            }

            if ($action === 'setUserPages') {
                $user_id = intval($input['user_id'] ?? 0);
                $pages = $input['pages'] ?? [];
                if (!$user_id || !is_array($pages)) { http_response_code(400); echo json_encode(['success'=>false,'message'=>'user_id and pages[] required']); break; }
                $pdo->beginTransaction();
                foreach ($pages as $p) {
                    $slug = trim($p['page_slug'] ?? '');
                    $allowed = isset($p['can_access']) ? ($p['can_access'] ? 1 : 0) : 0;
                    if ($slug === '') continue;
                    $stmt = execute_query($pdo, "SELECT id FROM user_page_permissions WHERE user_id = ? AND page_slug = ?", [$user_id, $slug]);
                    if ($stmt->rowCount() > 0) {
                        execute_query($pdo, "UPDATE user_page_permissions SET can_access = ? WHERE user_id = ? AND page_slug = ?", [$allowed, $user_id, $slug]);
                    } else {
                        execute_query($pdo, "INSERT INTO user_page_permissions (user_id, page_slug, can_access) VALUES (?, ?, ?)", [$user_id, $slug, $allowed]);
                    }
                }
                $pdo->commit();
                echo json_encode(['success'=>true]); break;
            }

            if ($action === 'getMyModules') {
                $uid = $_SESSION['user_id'] ?? 0;
                if (!$uid) { http_response_code(403); echo json_encode(['success'=>false,'message'=>'Authentication required']); break; }
                $sql = "SELECT DISTINCT m.* FROM permission_modules m JOIN user_permissions up ON up.module_id = m.id WHERE up.user_id = ? AND up.allowed = 1 ORDER BY m.parent_id IS NULL DESC, m.parent_id, m.`order` ASC";
                $stmt = execute_query($pdo, $sql, [$uid]);
                echo json_encode(['success'=>true,'data'=>$stmt->fetchAll(PDO::FETCH_ASSOC)]); break;
            }

            if ($action === 'setUserPermissions') {
                $user_id = intval($input['user_id'] ?? 0);
                $perms = $input['permissions'] ?? [];
                if (!$user_id || !is_array($perms)) { http_response_code(400); echo json_encode(['success'=>false,'message'=>'user_id and permissions[] required']); break; }
                // Batch upsert
                $pdo->beginTransaction();
                foreach ($perms as $p) {
                    $module_id = intval($p['module_id'] ?? 0);
                    $action_id = intval($p['action_id'] ?? 0);
                    $allowed = $p['allowed'] ? 1 : 0;
                    if (!$module_id || !$action_id) continue;
                    // Try update
                    $stmt = execute_query($pdo, "SELECT id FROM user_permissions WHERE user_id = ? AND module_id = ? AND action_id = ?", [$user_id, $module_id, $action_id]);
                    if ($stmt->rowCount() > 0) {
                        execute_query($pdo, "UPDATE user_permissions SET allowed = ? WHERE user_id = ? AND module_id = ? AND action_id = ?", [$allowed, $user_id, $module_id, $action_id]);
                    } else {
                        execute_query($pdo, "INSERT INTO user_permissions (user_id, module_id, action_id, allowed) VALUES (?, ?, ?, ?)", [$user_id, $module_id, $action_id, $allowed]);
                    }
                }
                $pdo->commit();
                echo json_encode(['success'=>true]); break;
            }

            // User defaults (warehouse/treasury + change flags)
            if ($action === 'getUserDefaults') {
                $user_id = intval($_GET['user_id'] ?? $input['user_id'] ?? ($_SESSION['user_id'] ?? 0));
                if (!$user_id) { http_response_code(400); echo json_encode(['success'=>false,'message'=>'user_id required']); break; }
                $hasSalesOfficeDefaults = table_exists($pdo, 'user_defaults') && column_exists($pdo, 'user_defaults', 'default_sales_office_id') && column_exists($pdo, 'user_defaults', 'can_change_sales_office');
                $select = "SELECT user_id, default_warehouse_id, default_treasury_id, can_change_warehouse, can_change_treasury";
                if ($hasSalesOfficeDefaults) {
                    $select .= ", default_sales_office_id, can_change_sales_office";
                } else {
                    $select .= ", NULL as default_sales_office_id, 1 as can_change_sales_office";
                }
                $select .= " FROM user_defaults WHERE user_id = ?";
                $stmt = execute_query($pdo, $select, [$user_id]);
                $row = $stmt->fetch(PDO::FETCH_ASSOC);
                if ($row) {
                    $row['can_change_warehouse'] = isset($row['can_change_warehouse']) ? boolval($row['can_change_warehouse']) : true;
                    $row['can_change_treasury'] = isset($row['can_change_treasury']) ? boolval($row['can_change_treasury']) : true;
                    $row['can_change_sales_office'] = isset($row['can_change_sales_office']) ? boolval($row['can_change_sales_office']) : true;
                }
                echo json_encode(['success'=>true, 'data' => $row]); break;
            }

            if ($action === 'setUserDefaults') {
                $user_id = intval($input['user_id'] ?? 0);
                if (!$user_id) { http_response_code(400); echo json_encode(['success'=>false,'message'=>'user_id required']); break; }
                $dw = isset($input['default_warehouse_id']) ? ($input['default_warehouse_id'] !== '' ? intval($input['default_warehouse_id']) : null) : null;
                $dt = isset($input['default_treasury_id']) ? ($input['default_treasury_id'] !== '' ? intval($input['default_treasury_id']) : null) : null;
                $dso = isset($input['default_sales_office_id']) ? ($input['default_sales_office_id'] !== '' ? intval($input['default_sales_office_id']) : null) : null;
                $cw = isset($input['can_change_warehouse']) ? ($input['can_change_warehouse'] ? 1 : 0) : 0;
                $ct = isset($input['can_change_treasury']) ? ($input['can_change_treasury'] ? 1 : 0) : 0;
                $hasSalesOfficeDefaults = table_exists($pdo, 'user_defaults') && column_exists($pdo, 'user_defaults', 'default_sales_office_id') && column_exists($pdo, 'user_defaults', 'can_change_sales_office');
                if ($hasSalesOfficeDefaults) {
                    $cso = isset($input['can_change_sales_office']) ? ($input['can_change_sales_office'] ? 1 : 0) : 0;
                    execute_query($pdo, "INSERT INTO user_defaults (user_id, default_warehouse_id, default_treasury_id, default_sales_office_id, can_change_warehouse, can_change_treasury, can_change_sales_office)
                        VALUES (?, ?, ?, ?, ?, ?, ?)
                        ON DUPLICATE KEY UPDATE
                          default_warehouse_id = VALUES(default_warehouse_id),
                          default_treasury_id = VALUES(default_treasury_id),
                          default_sales_office_id = VALUES(default_sales_office_id),
                          can_change_warehouse = VALUES(can_change_warehouse),
                          can_change_treasury = VALUES(can_change_treasury),
                          can_change_sales_office = VALUES(can_change_sales_office)", [$user_id, $dw, $dt, $dso, $cw, $ct, $cso]);
                } else {
                    execute_query($pdo, "INSERT INTO user_defaults (user_id, default_warehouse_id, default_treasury_id, can_change_warehouse, can_change_treasury)
                        VALUES (?, ?, ?, ?, ?)
                        ON DUPLICATE KEY UPDATE
                          default_warehouse_id = VALUES(default_warehouse_id),
                          default_treasury_id = VALUES(default_treasury_id),
                          can_change_warehouse = VALUES(can_change_warehouse),
                          can_change_treasury = VALUES(can_change_treasury)", [$user_id, $dw, $dt, $cw, $ct]);
                }
                echo json_encode(['success'=>true]); break;
            }

            // fallback
            echo json_encode(['success'=>false,'message'=>'Unknown permissions action']);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['success'=>false,'message'=>$e->getMessage()]);
        }
        break;
    case 'products':
        $action = $_GET['action'] ?? 'getAll';
        $perm_code = map_action_to_perm($action);
        if ($perm_code) {
            check_permission_or_die($pdo, 'products', $perm_code);
        }

        // --- getAll: عودة بالآباء مع متغيراتهم (nested) ---
        if ($action === 'getAll') {
            if (!table_exists($pdo, 'product_variants')) {
                echo json_encode(['success' => false, 'message' => 'Migration required: run tools/migrate_to_variants.php']);
                break;
            }
            $sql = "SELECT
                        p.id AS parent_id, p.name AS parent_name, p.category, COALESCE(p.is_archived,0) AS parent_archived,
                        pv.id AS variant_id, pv.name AS variant_name, pv.color, pv.size, pv.barcode,
                        pv.cost_price, pv.sale_price, pv.reorder_level, COALESCE(pv.is_archived,0) AS variant_archived,
                        COALESCE(SUM(s.quantity), 0) AS total_stock
                    FROM products p
                    LEFT JOIN product_variants pv ON pv.product_id = p.id AND COALESCE(pv.is_archived,0) = 0
                    LEFT JOIN stock s ON s.product_id = pv.id
                    WHERE COALESCE(p.is_archived,0) = 0
                    GROUP BY pv.id, p.id
                    ORDER BY p.name ASC, pv.color ASC, pv.size ASC";
            $rows = execute_query($pdo, $sql)->fetchAll(PDO::FETCH_ASSOC);
            $parents = [];
            foreach ($rows as $row) {
                $pid = $row['parent_id'];
                if (!isset($parents[$pid])) {
                    $parents[$pid] = [
                        'id'         => intval($row['parent_id']),
                        'name'       => $row['parent_name'],
                        'category'   => $row['category'],
                        'is_archived'=> intval($row['parent_archived']),
                        'variants'   => []
                    ];
                }
                if (!empty($row['variant_id'])) {
                    $parents[$pid]['variants'][] = [
                        'id'          => intval($row['variant_id']),
                        'product_id'  => intval($row['parent_id']),
                        'name'        => $row['variant_name'],
                        'color'       => $row['color'],
                        'size'        => $row['size'],
                        'barcode'     => $row['barcode'],
                        'cost'        => floatval($row['cost_price']),
                        'cost_price'  => floatval($row['cost_price']),
                        'price'       => floatval($row['sale_price']),
                        'sale_price'  => floatval($row['sale_price']),
                        'reorderLevel'=> intval($row['reorder_level']),
                        'stock'       => intval($row['total_stock']),
                        'is_archived' => intval($row['variant_archived'])
                    ];
                }
            }
            echo json_encode(['success' => true, 'data' => array_values($parents)]);
            break;
        }

        // --- getFlat: قائمة مسطّحة من المتغيرات (للاستخدام في POS / طلبات الاستلام) ---
        if ($action === 'getFlat') {
            if (!table_exists($pdo, 'product_variants')) {
                echo json_encode(['success' => true, 'data' => []]); break;
            }
            $stmt = execute_query($pdo,
                "SELECT pv.id, p.name, pv.barcode, pv.cost_price AS cost, pv.sale_price AS price, pv.sale_price AS sale_price,
                        COALESCE(SUM(s.quantity),0) AS stock, pv.color, pv.size, pv.reorder_level AS reorderLevel, p.category
                 FROM product_variants pv
                 JOIN products p ON pv.product_id = p.id
                 LEFT JOIN stock s ON s.product_id = pv.id
                 WHERE COALESCE(pv.is_archived,0)=0 AND COALESCE(p.is_archived,0)=0
                 GROUP BY pv.id ORDER BY p.name ASC"
            );
            echo json_encode(['success' => true, 'data' => $stmt->fetchAll(PDO::FETCH_ASSOC)]);
            break;
        }

        // --- createParent: إنشاء منتج أب جديد ---
        if ($action === 'createParent') {
            $name = trim($input['name'] ?? '');
            $category = $input['category'] ?? null;
            $description = $input['description'] ?? null;
            if (!$name) { http_response_code(400); echo json_encode(['success' => false, 'message' => 'الاسم مطلوب']); break; }
            execute_query($pdo, "INSERT INTO products (name, category, description) VALUES (?, ?, ?)", [$name, $category, $description]);
            $parentId = intval($pdo->lastInsertId());
            echo json_encode(['success' => true, 'data' => ['id' => $parentId, 'name' => $name, 'category' => $category, 'variants' => []]]);
            break;
        }

        // --- updateParent: تعديل منتج أب ---
        if ($action === 'updateParent') {
            $id = intval($input['id'] ?? 0);
            if (!$id) { http_response_code(400); echo json_encode(['success' => false, 'message' => 'ID مطلوب']); break; }
            $set = []; $vals = [];
            if (isset($input['name']))        { $set[] = 'name = ?';        $vals[] = $input['name']; }
            if (isset($input['category']))    { $set[] = 'category = ?';    $vals[] = $input['category']; }
            if (isset($input['description'])) { $set[] = 'description = ?'; $vals[] = $input['description']; }
            if (!empty($set)) { $vals[] = $id; execute_query($pdo, "UPDATE products SET ".implode(', ', $set)." WHERE id = ?", $vals); }
            echo json_encode(['success' => true]);
            break;
        }

        // --- deleteParent: أرشفة منتج أب وجميع متغيراته ---
        if ($action === 'deleteParent') {
            $id = intval($input['id'] ?? 0);
            if (!$id) { http_response_code(400); echo json_encode(['success' => false, 'message' => 'ID مطلوب']); break; }
            execute_query($pdo, "UPDATE products SET is_archived = 1 WHERE id = ?", [$id]);
            if (table_exists($pdo, 'product_variants')) {
                execute_query($pdo, "UPDATE product_variants SET is_archived = 1 WHERE product_id = ?", [$id]);
            }
            echo json_encode(['success' => true, 'message' => 'تم إخفاء المنتج وجميع أصنافه.']);
            break;
        }

        // --- createVariant: إضافة صنف (variant) لمنتج أب ---
        if ($action === 'createVariant') {
            $productId = intval($input['product_id'] ?? ($input['productId'] ?? 0));
            if (!$productId) { http_response_code(400); echo json_encode(['success' => false, 'message' => 'product_id مطلوب']); break; }
            $color      = $input['color']  ?? null;
            $size       = $input['size']   ?? null;
            $barcode    = $input['barcode'] ?? null;
            $cost       = floatval($input['cost']  ?? ($input['cost_price']   ?? 0));
            $price      = floatval($input['price'] ?? ($input['sale_price']   ?? 0));
            $reorder    = intval($input['reorderLevel'] ?? ($input['reorder_level'] ?? 5));
            $quantity   = intval($input['quantity'] ?? 0);
            $warehouseId= intval($input['warehouseId'] ?? ($input['warehouse_id'] ?? 0));
            $parentName = execute_query($pdo, "SELECT name FROM products WHERE id = ? LIMIT 1", [$productId])->fetchColumn();
            if (!$parentName) { http_response_code(404); echo json_encode(['success' => false, 'message' => 'المنتج الأب غير موجود']); break; }
            execute_query($pdo,
                "INSERT INTO product_variants (product_id, name, color, size, barcode, cost_price, sale_price, reorder_level) VALUES (?,?,?,?,?,?,?,?)",
                [$productId, $parentName, $color, $size, $barcode, $cost, $price, $reorder]
            );
            $variantId = intval($pdo->lastInsertId());
            if ($quantity > 0 && $warehouseId > 0) {
                $exists = execute_query($pdo, "SELECT quantity FROM stock WHERE product_id = ? AND warehouse_id = ?", [$variantId, $warehouseId])->fetchColumn();
                if ($exists !== false) {
                    execute_query($pdo, "UPDATE stock SET quantity = quantity + ? WHERE product_id = ? AND warehouse_id = ?", [$quantity, $variantId, $warehouseId]);
                } else {
                    execute_query($pdo, "INSERT INTO stock (product_id, warehouse_id, quantity) VALUES (?,?,?)", [$variantId, $warehouseId, $quantity]);
                }
            }
            echo json_encode(['success' => true, 'data' => [
                'id' => $variantId, 'product_id' => $productId,
                'color' => $color, 'size' => $size, 'barcode' => $barcode,
                'cost' => $cost, 'price' => $price, 'reorderLevel' => $reorder, 'stock' => $quantity
            ]]);
            break;
        }

        // --- updateVariant: تعديل صنف ---
        if ($action === 'updateVariant') {
            $id = intval($input['id'] ?? 0);
            if (!$id) { http_response_code(400); echo json_encode(['success' => false, 'message' => 'ID مطلوب']); break; }
            $set = []; $vals = [];
            $vmap = ['color'=>'color','size'=>'size','barcode'=>'barcode','cost'=>'cost_price','cost_price'=>'cost_price','price'=>'sale_price','sale_price'=>'sale_price','reorderLevel'=>'reorder_level','reorder_level'=>'reorder_level'];
            foreach ($vmap as $k => $col) {
                if (isset($input[$k])) { $set[] = "$col = ?"; $vals[] = $input[$k]; }
            }
            if (!empty($set)) { $vals[] = $id; execute_query($pdo, "UPDATE product_variants SET ".implode(', ',$set)." WHERE id = ?", $vals); }
            echo json_encode(['success' => true]);
            break;
        }

        // --- deleteVariant: أرشفة صنف ---
        if ($action === 'deleteVariant') {
            $id = intval($input['id'] ?? 0);
            if (!$id) { http_response_code(400); echo json_encode(['success' => false, 'message' => 'ID مطلوب']); break; }
            execute_query($pdo, "UPDATE product_variants SET is_archived = 1 WHERE id = ? LIMIT 1", [$id]);
            echo json_encode(['success' => true, 'message' => 'تم إخفاء الصنف (مؤرشف).']);
            break;
        }

        // --- create (legacy compat): إنشاء أب + صنف في خطوة واحدة ---
        if ($action === 'create') {
            $name       = trim($input['name'] ?? '');
            $barcode    = $input['barcode']    ?? null;
            $color      = $input['color']      ?? null;
            $size       = $input['size']       ?? null;
            $cost       = floatval($input['cost']  ?? ($input['cost_price']   ?? 0));
            $price      = floatval($input['price'] ?? ($input['sale_price']   ?? 0));
            $reorder    = intval($input['reorderLevel'] ?? ($input['reorder_level'] ?? 5));
            $quantity   = intval($input['quantity'] ?? 0);
            $warehouseId= intval($input['warehouseId'] ?? ($input['warehouse_id'] ?? 0));
            if (!$name) { http_response_code(400); echo json_encode(['success'=>false,'message'=>'Name required']); break; }
            $parentId  = ensure_product_parent($pdo, $name);
            execute_query($pdo,
                "INSERT INTO product_variants (product_id, name, color, size, barcode, cost_price, sale_price, reorder_level) VALUES (?,?,?,?,?,?,?,?)",
                [$parentId, $name, $color, $size, $barcode, $cost, $price, $reorder]
            );
            $variantId = intval($pdo->lastInsertId());
            if ($quantity > 0 && $warehouseId > 0) {
                $exists = execute_query($pdo, "SELECT quantity FROM stock WHERE product_id=? AND warehouse_id=?", [$variantId,$warehouseId])->fetchColumn();
                if ($exists !== false) {
                    execute_query($pdo, "UPDATE stock SET quantity=quantity+? WHERE product_id=? AND warehouse_id=?", [$quantity,$variantId,$warehouseId]);
                } else {
                    execute_query($pdo, "INSERT INTO stock (product_id,warehouse_id,quantity) VALUES (?,?,?)", [$variantId,$warehouseId,$quantity]);
                }
            }
            $variantData = execute_query($pdo,
                "SELECT pv.id, p.name, pv.barcode, pv.cost_price AS cost, pv.sale_price AS price, pv.sale_price AS sale_price,
                        COALESCE((SELECT SUM(quantity) FROM stock WHERE product_id=pv.id),0) AS stock,
                        pv.color, pv.size, pv.reorder_level AS reorderLevel
                 FROM product_variants pv JOIN products p ON pv.product_id=p.id WHERE pv.id=?", [$variantId]
            )->fetch(PDO::FETCH_ASSOC);
            echo json_encode(['success' => true, 'data' => $variantData]);
            break;
        }

        // --- update (legacy): تعديل صنف (variant) ---
        if ($action === 'update') {
            $id = intval($input['id'] ?? 0);
            if (!$id) { http_response_code(400); echo json_encode(['success'=>false,'message'=>'Product ID required']); return; }
            $set_parts = []; $values = [];
            $mapping = ['barcode'=>'barcode','color'=>'color','size'=>'size','cost'=>'cost_price','price'=>'sale_price','reorderLevel'=>'reorder_level'];
            foreach ($mapping as $in => $col) {
                if (isset($input[$in])) { $set_parts[] = "$col = ?"; $values[] = $input[$in]; }
            }
            if (!empty($set_parts)) { $values[] = $id; execute_query($pdo, "UPDATE product_variants SET ".implode(', ',$set_parts)." WHERE id = ?", $values); }
            if (isset($input['name'])) {
                execute_query($pdo, "UPDATE products SET name=? WHERE id=(SELECT product_id FROM product_variants WHERE id=? LIMIT 1)", [$input['name'],$id]);
                execute_query($pdo, "UPDATE product_variants SET name=? WHERE id=?", [$input['name'],$id]);
            }
            echo json_encode(['success' => true, 'message' => 'Updated successfully.']);
            break;
        }

        // --- delete (legacy): أرشفة صنف ---
        if ($action === 'delete') {
            $id = intval($input['id'] ?? 0);
            if (!$id) { http_response_code(400); echo json_encode(['success'=>false,'message'=>'ID is required for deletion.']); return; }
            execute_query($pdo, "UPDATE product_variants SET is_archived = 1 WHERE id = ? LIMIT 1", [$id]);
            echo json_encode(['success' => true, 'message' => 'تم إخفاء الصنف (مؤرشف).']);
            break;
        }
        break;
    case 'orders':
        $action = $_GET['action'] ?? 'getAll';
        $perm_code = map_action_to_perm($action);
        if ($perm_code) {
            check_permission_or_die($pdo, 'orders', $perm_code);
        }
        // Ensure optional columns exist for newer features: employee and page
        try {
            if (!column_exists($pdo, 'orders', 'employee')) {
                execute_query($pdo, "ALTER TABLE orders ADD COLUMN employee VARCHAR(255) NULL");
            }
        } catch (Exception $e) {
            // ignore migration failure - keep backward compatibility
        }
        try {
            if (!column_exists($pdo, 'orders', 'page')) {
                execute_query($pdo, "ALTER TABLE orders ADD COLUMN page VARCHAR(255) NULL");
            }
        } catch (Exception $e) {
            // ignore migration failure
        }
        if ($action === 'getAll') {
            $statusFilter = isset($_GET['status']) ? $_GET['status'] : null;
            $ordersHasDiscountType = column_exists($pdo, 'orders', 'discount_type');
            $ordersHasDiscountValue = column_exists($pdo, 'orders', 'discount_value');
            $ordersHasDiscountAmount = column_exists($pdo, 'orders', 'discount_amount');
            $ordersHasTaxType = column_exists($pdo, 'orders', 'tax_type');
            $ordersHasTaxValue = column_exists($pdo, 'orders', 'tax_value');
            $ordersHasTaxAmount = column_exists($pdo, 'orders', 'tax_amount');
            $ordersHasEmployee = column_exists($pdo, 'orders', 'employee');
            $ordersHasPage = column_exists($pdo, 'orders', 'page');
            $ordersHasSalesOfficeId = column_exists($pdo, 'orders', 'sales_office_id');
            $ordersHasEmployee = column_exists($pdo, 'orders', 'employee');
            $ordersHasPage = column_exists($pdo, 'orders', 'page');
            $ordersHasShippingCompanyId = column_exists($pdo, 'orders', 'shipping_company_id');
            $ordersHasEmployee = column_exists($pdo, 'orders', 'employee');
            $ordersHasPage = column_exists($pdo, 'orders', 'page');

            $extraCols = [];
            if ($ordersHasDiscountType) $extraCols[] = 'o.discount_type';
            if ($ordersHasDiscountValue) $extraCols[] = 'o.discount_value';
            if ($ordersHasDiscountAmount) $extraCols[] = 'o.discount_amount';
            if ($ordersHasTaxType) $extraCols[] = 'o.tax_type';
            if ($ordersHasTaxValue) $extraCols[] = 'o.tax_value';
            if ($ordersHasTaxAmount) $extraCols[] = 'o.tax_amount';
            if ($ordersHasEmployee) $extraCols[] = 'o.employee';
            if ($ordersHasPage) $extraCols[] = 'o.page';
            if ($ordersHasSalesOfficeId) $extraCols[] = 'o.sales_office_id';
            if ($ordersHasShippingCompanyId) $extraCols[] = 'o.shipping_company_id';
            if ($ordersHasEmployee) $extraCols[] = 'o.employee';
            if ($ordersHasPage) $extraCols[] = 'o.page';
            $extraColsSql = count($extraCols) > 0 ? (', ' . implode(', ', $extraCols)) : '';

            $sql = "SELECT o.id, o.order_number, o.customer_id, o.rep_id, o.status, o.total_amount, o.shipping_fees, o.notes, o.created_at{$extraColsSql}, c.name as customer_name, c.phone1 as phone1, c.phone2 as phone2, c.address as address, c.governorate as governorate, o.id as order_id
                FROM orders o LEFT JOIN customers c ON o.customer_id = c.id";
            if ($statusFilter) {
                $sql .= " WHERE o.status = '" . str_replace("'", "\'", $statusFilter) . "'";
            }
            $sql .= " ORDER BY o.created_at DESC";
            $stmt = $pdo->query($sql);
            $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
            // attach items per order
            $ordersMap = [];
            foreach ($rows as $r) {
                $oid = $r['id'];
                $ordersMap[$oid] = [
                    'id' => $r['id'],
                    'orderNumber' => $r['order_number'],
                    'customerName' => $r['customer_name'],
                    'phone1' => $r['phone1'],
                    'phone2' => $r['phone2'],
                    'address' => $r['address'],
                    'governorate' => $r['governorate'] ?? '',
                    'status' => $r['status'],
                    'total' => $r['total_amount'],
                    'shipping' => $r['shipping_fees'],
                    'notes' => $r['notes'],
                    'discountType' => $r['discount_type'] ?? null,
                    'discountValue' => $r['discount_value'] ?? null,
                    'discountAmount' => $r['discount_amount'] ?? null,
                    'taxType' => $r['tax_type'] ?? null,
                    'taxValue' => $r['tax_value'] ?? null,
                    'taxAmount' => $r['tax_amount'] ?? null,
                    'salesOfficeId' => $r['sales_office_id'] ?? null,
                    'sales_office_id' => $r['sales_office_id'] ?? null,
                    'shipping_company_id' => $r['shipping_company_id'] ?? null,
                    'shippingCompanyId' => $r['shipping_company_id'] ?? null,
                    'created_at' => $r['created_at'],
                    'rep_id' => $r['rep_id'],
                    'repId' => $r['rep_id'],
                    'employee' => $r['employee'] ?? null,
                    'page' => $r['page'] ?? null,
                    'products' => []
                ];
            }
            if (!empty($ordersMap)) {
                $ids = array_keys($ordersMap);
                $in = implode(',', array_map('intval', $ids));
                // Some DB schemas may not have `order_items.total_price` column.
                // Detect column existence and select appropriately to avoid SQL errors.
                $order_items_has_total_col = column_exists($pdo, 'order_items', 'total_price');
                if ($order_items_has_total_col) {
                    $itSql = "SELECT oi.order_id, oi.product_id, oi.quantity, oi.price_per_unit, oi.total_price as line_total, ppar.name, pv.color, pv.size FROM order_items oi LEFT JOIN product_variants pv ON oi.product_id = pv.id LEFT JOIN products ppar ON pv.product_id = ppar.id WHERE oi.order_id IN ($in)";
                } else {
                    $itSql = "SELECT oi.order_id, oi.product_id, oi.quantity, oi.price_per_unit, (oi.quantity * oi.price_per_unit) as line_total, ppar.name, pv.color, pv.size FROM order_items oi LEFT JOIN product_variants pv ON oi.product_id = pv.id LEFT JOIN products ppar ON pv.product_id = ppar.id WHERE oi.order_id IN ($in)";
                }
                $itStmt = $pdo->query($itSql);
                $items = $itStmt->fetchAll(PDO::FETCH_ASSOC);
                foreach ($items as $it) {
                    $ordersMap[$it['order_id']]['products'][] = [
                        'productId' => $it['product_id'],
                        'name' => $it['name'],
                        'color' => $it['color'],
                        'size' => $it['size'],
                        'quantity' => $it['quantity'],
                        'price' => $it['price_per_unit'],
                        'total' => $it['line_total']
                    ];
                }
            }
            echo json_encode(['success' => true, 'data' => array_values($ordersMap)]);
            break;
        }
        if ($action === 'getByIds') {
            try {
                $result = nexus_fetch_orders_by_ids($pdo, $_GET['ids'] ?? '');
                echo json_encode(['success' => true, 'data' => $result]);
            } catch (Exception $e) {
                http_response_code(500);
                echo json_encode(['success' => false, 'message' => 'getByIds error: ' . $e->getMessage()]);
            }
            break;
        }
        if ($action === 'getByNumber') {
            $orderNumber = $_GET['orderNumber'] ?? '';
            if (empty($orderNumber)) {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'Order number is required.']);
                break;
            }

            $ordersHasDiscountType = column_exists($pdo, 'orders', 'discount_type');
            $ordersHasDiscountValue = column_exists($pdo, 'orders', 'discount_value');
            $ordersHasDiscountAmount = column_exists($pdo, 'orders', 'discount_amount');
            $ordersHasTaxType = column_exists($pdo, 'orders', 'tax_type');
            $ordersHasTaxValue = column_exists($pdo, 'orders', 'tax_value');
            $ordersHasTaxAmount = column_exists($pdo, 'orders', 'tax_amount');
            $ordersHasSalesOfficeId = column_exists($pdo, 'orders', 'sales_office_id');
            $ordersHasEmployee = column_exists($pdo, 'orders', 'employee');
            $ordersHasPage = column_exists($pdo, 'orders', 'page');
            $ordersHasShippingCompanyId = column_exists($pdo, 'orders', 'shipping_company_id');
            $ordersHasEmployee = column_exists($pdo, 'orders', 'employee');
            $ordersHasPage = column_exists($pdo, 'orders', 'page');

            $extraCols = [];
            if ($ordersHasDiscountType) $extraCols[] = 'o.discount_type';
            if ($ordersHasDiscountValue) $extraCols[] = 'o.discount_value';
            if ($ordersHasDiscountAmount) $extraCols[] = 'o.discount_amount';
            if ($ordersHasTaxType) $extraCols[] = 'o.tax_type';
            if ($ordersHasTaxValue) $extraCols[] = 'o.tax_value';
            if ($ordersHasTaxAmount) $extraCols[] = 'o.tax_amount';
            if ($ordersHasSalesOfficeId) $extraCols[] = 'o.sales_office_id';
            if ($ordersHasShippingCompanyId) $extraCols[] = 'o.shipping_company_id';
            if ($ordersHasEmployee) $extraCols[] = 'o.employee';
            if ($ordersHasPage) $extraCols[] = 'o.page';
            $extraColsSql = count($extraCols) > 0 ? (', ' . implode(', ', $extraCols)) : '';

            // Fetch the order
                $sql = "SELECT o.id, o.order_number, o.customer_id, o.rep_id, o.status, o.total_amount, o.shipping_fees, o.notes, o.created_at, c.name as customer_name, c.phone1 as phone1, c.phone2 as phone2, c.address as address, c.governorate as governorate
                    {$extraColsSql}
                    FROM orders o LEFT JOIN customers c ON o.customer_id = c.id
                    WHERE o.order_number = ?";
            
            $stmt = execute_query($pdo, $sql, [$orderNumber]);
            $order = $stmt->fetch(PDO::FETCH_ASSOC);

            if (!$order) {
                echo json_encode(['success' => false, 'data' => null]);
                break;
            }

            // Now fetch the items for this order
            $orderId = $order['id'];
                $orderData = [
                'id' => $order['id'],
                'orderNumber' => $order['order_number'],
                'customerName' => $order['customer_name'],
                'phone1' => $order['phone1'],
                'phone2' => $order['phone2'],
                    'address' => $order['address'],
                    'governorate' => $order['governorate'] ?? '',
                'status' => $order['status'],
                'total' => $order['total_amount'],
                'shipping' => $order['shipping_fees'],
                'notes' => $order['notes'],
                'discountType' => $order['discount_type'] ?? null,
                'discountValue' => $order['discount_value'] ?? null,
                'discountAmount' => $order['discount_amount'] ?? null,
                'taxType' => $order['tax_type'] ?? null,
                'taxValue' => $order['tax_value'] ?? null,
                'taxAmount' => $order['tax_amount'] ?? null,
                'salesOfficeId' => $order['sales_office_id'] ?? null,
                'sales_office_id' => $order['sales_office_id'] ?? null,
                'shipping_company_id' => $order['shipping_company_id'] ?? null,
                'shippingCompanyId' => $order['shipping_company_id'] ?? null,
                'created_at' => $order['created_at'],
                'rep_id' => $order['rep_id'],
                'repId' => $order['rep_id'],
                'employee' => $order['employee'] ?? null,
                'page' => $order['page'] ?? null,
                'products' => []
            ];
            
            $order_items_has_total_col = column_exists($pdo, 'order_items', 'total_price');
            if ($order_items_has_total_col) {
                $itSql = "SELECT oi.order_id, oi.product_id, oi.quantity, oi.price_per_unit, oi.total_price as line_total, ppar.name, pv.color, pv.size FROM order_items oi LEFT JOIN product_variants pv ON oi.product_id = pv.id LEFT JOIN products ppar ON pv.product_id = ppar.id WHERE oi.order_id = ?";
            } else {
                $itSql = "SELECT oi.order_id, oi.product_id, oi.quantity, oi.price_per_unit, (oi.quantity * oi.price_per_unit) as line_total, ppar.name, pv.color, pv.size FROM order_items oi LEFT JOIN product_variants pv ON oi.product_id = pv.id LEFT JOIN products ppar ON pv.product_id = ppar.id WHERE oi.order_id = ?";
            }
            
            $itStmt = execute_query($pdo, $itSql, [$orderId]);
            $items = $itStmt->fetchAll(PDO::FETCH_ASSOC);

            foreach ($items as $it) {
                $orderData['products'][] = [
                    'productId' => $it['product_id'],
                    'name' => $it['name'],
                    'color' => $it['color'],
                    'size' => $it['size'],
                    'quantity' => $it['quantity'],
                    'price' => $it['price_per_unit'],
                    'total' => $it['line_total']
                ];
            }
            
            echo json_encode(['success' => true, 'data' => $orderData]);
            break;
        }
        if ($action === 'getCustomerOrders') {
            $customerId = intval($_GET['customerId'] ?? 0);
            if (!$customerId) {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'Customer ID is required.']);
                break;
            }

            // Assumes users table exists if reps table doesn't, following convention in other parts of api.php
            $select_rep_name = ", u.name as repName";
            $join_reps = " LEFT JOIN users u ON o.rep_id = u.id";
            if(column_exists($pdo, 'users', 'role')) {
                $join_reps .= " AND u.role = 'representative'";
            }
            
            $sql = "SELECT o.id, o.order_number as orderNumber, o.status, o.total_amount as total, o.created_at $select_rep_name
                    FROM orders o 
                    $join_reps
                    WHERE o.customer_id = ? 
                    ORDER BY o.created_at DESC";

            $stmt = execute_query($pdo, $sql, [$customerId]);
            $orders = $stmt->fetchAll(PDO::FETCH_ASSOC);

            echo json_encode(['success' => true, 'data' => $orders]);
            break;
        }
        if ($action === 'customersByStatus') {
            // Returns customers grouped by order status with counts.
            // Optional GET param: statuses (comma-separated), default: delivered,returned
            $statusesRaw = trim((string)($_GET['statuses'] ?? ''));
            $statuses = $statusesRaw !== '' ? array_map('trim', explode(',', $statusesRaw)) : ['delivered', 'returned'];
            $startDate = trim((string)($_GET['start_date'] ?? ''));
            $endDate = trim((string)($_GET['end_date'] ?? ''));
            // Ensure statuses are safe (allow only known enum values)
            $allowed = ['pending','with_rep','delivered','returned','partial','postponed','in_delivery'];
            $statuses = array_values(array_intersect($statuses, $allowed));
            if (empty($statuses)) {
                echo json_encode(['success' => false, 'message' => 'No valid statuses specified.']);
                break;
            }

            check_permission_or_die($pdo, 'customers', 'view');

            $in = implode(',', array_fill(0, count($statuses), '?'));
            $whereParts = ["o.status IN ($in)"];
            $params = $statuses;
            if ($startDate !== '') {
                $whereParts[] = 'DATE(o.created_at) >= ?';
                $params[] = $startDate;
            }
            if ($endDate !== '') {
                $whereParts[] = 'DATE(o.created_at) <= ?';
                $params[] = $endDate;
            }

            $sql = "SELECT o.status, o.customer_id, c.name as customer_name, c.phone1, COUNT(*) as orders_count
                    FROM orders o
                    JOIN customers c ON o.customer_id = c.id
                    WHERE " . implode(' AND ', $whereParts) . "
                    GROUP BY o.status, o.customer_id
                    ORDER BY o.status, orders_count DESC";
            $stmt = execute_query($pdo, $sql, $params);
            $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

            $out = [];
            foreach ($rows as $r) {
                $st = $r['status'];
                if (!isset($out[$st])) $out[$st] = [];
                $out[$st][] = [
                    'id' => intval($r['customer_id']),
                    'name' => $r['customer_name'],
                    'phone1' => $r['phone1'],
                    'count' => intval($r['orders_count'])
                ];
            }

            echo json_encode(['success' => true, 'data' => $out]);
            break;
        }
        if ($action === 'getByRep') {
            $repId = intval($_GET['rep_id'] ?? 0);
            if (!$repId) {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'rep_id is required.']);
                break;
            }

            $statusFilter = trim((string)($_GET['status'] ?? ''));
            $startDate = trim((string)($_GET['start_date'] ?? ''));
            $endDate = trim((string)($_GET['end_date'] ?? ''));

            $ordersHasDiscountType = column_exists($pdo, 'orders', 'discount_type');
            $ordersHasDiscountValue = column_exists($pdo, 'orders', 'discount_value');
            $ordersHasDiscountAmount = column_exists($pdo, 'orders', 'discount_amount');
            $ordersHasTaxType = column_exists($pdo, 'orders', 'tax_type');
            $ordersHasTaxValue = column_exists($pdo, 'orders', 'tax_value');
            $ordersHasTaxAmount = column_exists($pdo, 'orders', 'tax_amount');
            // الإضافة الجديدة 1: فحص وجود أعمدة الموظف والبيدج
            $ordersHasEmployee = column_exists($pdo, 'orders', 'employee');
            $ordersHasPage = column_exists($pdo, 'orders', 'page');

            $extraCols = [];
            if ($ordersHasDiscountType) $extraCols[] = 'o.discount_type';
            if ($ordersHasDiscountValue) $extraCols[] = 'o.discount_value';
            if ($ordersHasDiscountAmount) $extraCols[] = 'o.discount_amount';
            if ($ordersHasTaxType) $extraCols[] = 'o.tax_type';
            if ($ordersHasTaxValue) $extraCols[] = 'o.tax_value';
            if ($ordersHasTaxAmount) $extraCols[] = 'o.tax_amount';

            // الإضافة الجديدة 2: سحب الأعمدة دي في جملة الـ SELECT
            if ($ordersHasEmployee) $extraCols[] = 'o.employee';
            if ($ordersHasPage) $extraCols[] = 'o.page';

            $extraColsSql = count($extraCols) > 0 ? (', ' . implode(', ', $extraCols)) : '';

            $where = ['o.rep_id = ?'];
            $params = [$repId];
            if ($statusFilter !== '') {
                $where[] = 'o.status = ?';
                $params[] = $statusFilter;
            }
            if ($startDate !== '') {
                $where[] = 'o.created_at >= ?';
                $params[] = $startDate . ' 00:00:00';
            }
            if ($endDate !== '') {
                $where[] = 'o.created_at <= ?';
                $params[] = $endDate . ' 23:59:59';
            }

                $sql = "SELECT o.id, o.order_number, o.customer_id, o.rep_id, o.status, o.total_amount, o.shipping_fees, o.notes, o.created_at{$extraColsSql}, c.name as customer_name, c.phone1 as phone1, c.phone2 as phone2, c.address as address, c.governorate as governorate, o.id as order_id
                    FROM orders o LEFT JOIN customers c ON o.customer_id = c.id
                    WHERE " . implode(' AND ', $where) . " ORDER BY o.created_at DESC";

            $stmt = execute_query($pdo, $sql, $params);
            $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

            $ordersMap = [];
            foreach ($rows as $r) {
                $oid = $r['id'];
                $ordersMap[$oid] = [
                    'id' => $r['id'],
                    'orderNumber' => $r['order_number'],
                    'customerName' => $r['customer_name'],
                    'phone1' => $r['phone1'],
                    'phone2' => $r['phone2'],
                    'address' => $r['address'],
                    'governorate' => $r['governorate'] ?? '',
                    'status' => $r['status'],
                    'total' => $r['total_amount'],
                    'shipping' => $r['shipping_fees'],
                    'notes' => $r['notes'],
                    'discountType' => $r['discount_type'] ?? null,
                    'discountValue' => $r['discount_value'] ?? null,
                    'discountAmount' => $r['discount_amount'] ?? null,
                    'taxType' => $r['tax_type'] ?? null,
                    'taxValue' => $r['tax_value'] ?? null,
                    'taxAmount' => $r['tax_amount'] ?? null,
                    // الإضافة الجديدة 3: إرسال البيانات إلى React
                    'employee' => $r['employee'] ?? '',
                    'page' => $r['page'] ?? '',
                    'created_at' => $r['created_at'],
                    'rep_id' => $r['rep_id'],
                    'repId' => $r['rep_id'],
                    'products' => []
                ];
            }

            if (!empty($ordersMap)) {
                $ids = array_keys($ordersMap);
                $in = implode(',', array_map('intval', $ids));
                $order_items_has_total_col = column_exists($pdo, 'order_items', 'total_price');
                if ($order_items_has_total_col) {
                    $itSql = "SELECT oi.order_id, oi.product_id, oi.quantity, oi.price_per_unit, oi.total_price as line_total, ppar.name, pv.color, pv.size FROM order_items oi LEFT JOIN product_variants pv ON oi.product_id = pv.id LEFT JOIN products ppar ON pv.product_id = ppar.id WHERE oi.order_id IN ($in)";
                } else {
                    $itSql = "SELECT oi.order_id, oi.product_id, oi.quantity, oi.price_per_unit, (oi.quantity * oi.price_per_unit) as line_total, ppar.name, pv.color, pv.size FROM order_items oi LEFT JOIN product_variants pv ON oi.product_id = pv.id LEFT JOIN products ppar ON pv.product_id = ppar.id WHERE oi.order_id IN ($in)";
                }
                $itStmt = $pdo->query($itSql);
                $items = $itStmt->fetchAll(PDO::FETCH_ASSOC);
                foreach ($items as $it) {
                    $ordersMap[$it['order_id']]['products'][] = [
                        'productId' => $it['product_id'],
                        'name' => $it['name'],
                        'color' => $it['color'],
                        'size' => $it['size'],
                        'quantity' => $it['quantity'],
                        'price' => $it['price_per_unit'],
                        'total' => $it['line_total']
                    ];
                }
            }

            echo json_encode(['success' => true, 'data' => array_values($ordersMap)]);
            break;
        }
        if ($action === 'partialReturn') {
            // Partial return of order items: adjust order_items.quantity, orders.total_amount, and optionally restock warehouse
            $orderId = intval($input['order_id'] ?? 0);
            $repId = intval($input['rep_id'] ?? 0);
            $items = $input['items'] ?? [];
            $warehouseId = isset($input['warehouse_id']) ? intval($input['warehouse_id']) : 0;
            $notes = isset($input['notes']) ? trim($input['notes']) : '';

            if (!$orderId || !is_array($items) || count($items) === 0) {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'order_id and items are required']);
                break;
            }

            // load order
            $ordStmt = execute_query($pdo, "SELECT * FROM orders WHERE id = ? LIMIT 1", [$orderId]);
            $orderRow = $ordStmt->fetch(PDO::FETCH_ASSOC);
            if (!$orderRow) { http_response_code(404); echo json_encode(['success'=>false,'message'=>'Order not found']); break; }

            // optional: ensure rep matches
            if ($repId && intval($orderRow['rep_id'] ?? 0) !== $repId) {
                // allow but warn — for safety, require rep to match if provided
                http_response_code(400); echo json_encode(['success'=>false,'message'=>'rep_id does not match order.rep_id']); break;
            }

            try {
                $pdo->beginTransaction();
                $returnedValue = 0.0;
                $returnedPieces = 0; // track total pieces returned in this operation
                foreach ($items as $it) {
                    // Support multiple naming conventions and per-line targeting
                    $prodId = intval($it['productId'] ?? ($it['product_id'] ?? 0));
                    $retQty = intval($it['returnedQuantity'] ?? ($it['quantity'] ?? ($it['qty'] ?? 0)));
                    $orderItemId = intval($it['orderItemId'] ?? ($it['order_item_id'] ?? 0));
                    $lineIdStr = trim((string)($it['lineId'] ?? ($it['line_id'] ?? '')));
                    if ($prodId <= 0 && $orderItemId <= 0) continue;
                    if ($retQty <= 0) continue;

                    // Locate the specific order_items row. Preference order:
                    // 1) explicit order_item id
                    // 2) client-provided lineId of form "{orderId}-{index}" -> use offset
                    // 3) fallback: first matching product_id row (existing behavior)
                    if ($orderItemId > 0) {
                        $oiStmt = execute_query($pdo, "SELECT id, quantity, price_per_unit, product_id FROM order_items WHERE id = ? AND order_id = ? LIMIT 1", [$orderItemId, $orderId]);
                    } elseif ($lineIdStr !== '' && preg_match('/^' . preg_quote((string)$orderId, '/') . '-(\d+)$/', $lineIdStr, $m)) {
                        $idx = intval($m[1]);
                        // select nth order_item for this order (ordered by id)
                        $offset = max(0, $idx);
                        $sql = "SELECT id, quantity, price_per_unit, product_id FROM order_items WHERE order_id = ? ORDER BY id ASC LIMIT 1 OFFSET " . $offset;
                        $oiStmt = $pdo->prepare($sql);
                        $oiStmt->execute([$orderId]);
                    } else {
                        $oiStmt = execute_query($pdo, "SELECT id, quantity, price_per_unit, product_id FROM order_items WHERE order_id = ? AND product_id = ? LIMIT 1", [$orderId, $prodId]);
                    }
                    $oi = $oiStmt->fetch(PDO::FETCH_ASSOC);
                    if (!$oi) { if ($pdo->inTransaction()) $pdo->rollBack(); http_response_code(400); echo json_encode(['success'=>false,'message'=>'Order item not found for product ' . $prodId]); break 2; }

                    $prevQty = intval($oi['quantity']);
                    if ($retQty > $prevQty) { if ($pdo->inTransaction()) $pdo->rollBack(); http_response_code(400); echo json_encode(['success'=>false,'message'=>'Returned quantity greater than item quantity for product ' . ($oi['product_id'] ?? $prodId)]); break 2; }

                    // DON'T change order items quantity per user request
                    // $newQty = $prevQty - $retQty;
                    // execute_query($pdo, "UPDATE order_items SET quantity = ? WHERE id = ?", [$newQty, $oi['id']]);

                    $linePrice = floatval($oi['price_per_unit'] ?? 0);
                    $lineValue = $retQty * $linePrice;
                    $returnedValue += $lineValue;
                    $returnedPieces += $retQty;

                    // restock if warehouse provided
                    if ($warehouseId) {
                        $prodToRestock = intval($oi['product_id'] ?? $prodId);
                        $sstmt = execute_query($pdo, "SELECT quantity FROM stock WHERE product_id = ? AND warehouse_id = ?", [$prodToRestock, $warehouseId]);
                        $prevStock = 0;
                        if ($srow = $sstmt->fetch(PDO::FETCH_ASSOC)) {
                            $prevStock = intval($srow['quantity']);
                            $newStock = $prevStock + $retQty;
                            execute_query($pdo, "UPDATE stock SET quantity = ? WHERE product_id = ? AND warehouse_id = ?", [$newStock, $prodToRestock, $warehouseId]);
                        } else {
                            $newStock = $retQty;
                            execute_query($pdo, "INSERT INTO stock (product_id, warehouse_id, quantity) VALUES (?, ?, ?)", [$prodToRestock, $warehouseId, $newStock]);
                        }
                        $mt = pick_allowed_enum($pdo, 'product_movements', 'movement_type', 'return_in', ['return_in','return','purchase','transfer','return_out']);
                        $movement_notes = json_encode(['order_id'=>$orderId,'rep_id'=>$repId,'notes'=>$notes]);
                        execute_query($pdo, "INSERT INTO product_movements (product_id, warehouse_id, movement_type, quantity_change, previous_quantity, new_quantity, reference_id, reference_type, notes, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", [$prodToRestock, $warehouseId, $mt, $retQty, $prevStock, $newStock, $orderId, 'order_partial_return', $movement_notes, null]);
                    }
                }

                if ($returnedValue > 0) {
                    // DON'T decrement order total per user request
                    // execute_query($pdo, "UPDATE orders SET total_amount = (COALESCE(total_amount,0) - ?) WHERE id = ?", [$returnedValue, $orderId]);
                    // Record transaction adjusting rep account for the partial return
                    try {
                        // Consignment model: returned goods CREDIT the Rep (decrease debt)
                        $txType = pick_allowed_enum($pdo, 'transactions', 'type', 'rep_return_credit', ['rep_return_credit','rep_settlement','rep_payment_in','payment_in']);
                        $rel_local = pick_allowed_enum($pdo, 'transactions', 'related_to_type', 'rep', ['rep','employee','none']);
                        $relatedRepId = $repId ? intval($repId) : intval($orderRow['rep_id'] ?? 0);
                        execute_query($pdo, "INSERT INTO transactions (type, warehouse_id, treasury_id, related_to_type, related_to_id, amount, transaction_date, details) VALUES (?, ?, ?, ?, ?, ?, NOW(), ?)", [$txType, null, null, $rel_local, $relatedRepId, $returnedValue, json_encode(['subtype'=>'partial_return','order_id'=>$orderId,'notes'=>$notes,'model'=>'consignment'])]);
                    } catch (Exception $e) {
                        // If transaction logging fails, continue but roll back whole op
                        if ($pdo->inTransaction()) $pdo->rollBack();
                        http_response_code(500);
                        echo json_encode(['success'=>false,'message'=>'Failed to record rep transaction: '.$e->getMessage()]);
                        break;
                    }

                    // Update rep_daily_journal returned aggregates on the exact open journal tied to this order.
                    try {
                        if (table_exists($pdo, 'rep_daily_journal') && table_exists($pdo, 'rep_journal_orders')) {
                            $journalLookup = execute_query($pdo,
                                "SELECT journal_id FROM rep_journal_orders WHERE rep_id = ? AND order_id = ? LIMIT 1",
                                [$relatedRepId, $orderId]
                            )->fetch(PDO::FETCH_ASSOC);
                            $targetJournalId = intval($journalLookup['journal_id'] ?? 0);
                            if ($targetJournalId > 0) {
                                execute_query($pdo,
                                    "UPDATE rep_daily_journal
                                     SET pieces_returned = COALESCE(pieces_returned, 0) + ?,
                                         returned_value = COALESCE(returned_value, 0) + ?
                                     WHERE id = ?",
                                    [$returnedPieces, $returnedValue, $targetJournalId]
                                );
                            }
                        }
                    } catch (Exception $e) {
                        try { @file_put_contents(__DIR__ . '/../logs/rep_journal_errors.log', "[".date('Y-m-d H:i:s')."] rep_daily_journal update failed: " . $e->getMessage() . "\n", FILE_APPEND); } catch (Exception $ignore) {}
                    }
                }

                $pdo->commit();

                // After commit: change order status to 'returned' without changing total_amount or order_items per user request
                try {
                    $returnedStatusVal = pick_allowed_enum($pdo, 'orders', 'status', 'returned', ['returned','with_rep','pending']);
                    $updFields = "status = '$returnedStatusVal'";
                    if (column_exists($pdo, 'orders', 'updated_at')) $updFields .= ", updated_at = NOW()";
                    execute_query($pdo, "UPDATE orders SET $updFields WHERE id = ?", [$orderId]);

                    $stmtTotalPieces = execute_query($pdo, "SELECT COALESCE(SUM(quantity), 0) FROM order_items WHERE order_id = ?", [$orderId]);
                    $totalOrderPieces = intval($stmtTotalPieces->fetchColumn());
                    $isFullReturn = ($returnedPieces >= $totalOrderPieces);

                    if (table_exists($pdo, 'rep_journal_orders')) {
                        $journalRepId = $repId ? intval($repId) : intval($orderRow['rep_id'] ?? 0);
                        $journalStatus = $isFullReturn ? 'full_return' : 'partial_return';
                        $journalNow = date('Y-m-d');
                        $journalNowTime = date('H:i:s');
                        $journalEmployee = $_SESSION['user']['name'] ?? null;

                        $journalRow = null;
                        if ($journalRepId > 0) {
                            $journalRow = execute_query($pdo,
                                "SELECT id, journal_id, rep_id FROM rep_journal_orders WHERE rep_id = ? AND order_id = ? ORDER BY id DESC LIMIT 1",
                                [$journalRepId, $orderId]
                            )->fetch(PDO::FETCH_ASSOC);
                        }
                        if (!$journalRow) {
                            $journalRow = execute_query($pdo,
                                "SELECT id, journal_id, rep_id FROM rep_journal_orders WHERE order_id = ? ORDER BY id DESC LIMIT 1",
                                [$orderId]
                            )->fetch(PDO::FETCH_ASSOC);
                        }

                        $targetJournalId = intval($journalRow['journal_id'] ?? 0);
                        if ($targetJournalId <= 0 && $journalRepId > 0 && table_exists($pdo, 'rep_daily_journal')) {
                            $openJournalRow = execute_query($pdo,
                                "SELECT id FROM rep_daily_journal WHERE rep_id = ? AND is_closed = 0 ORDER BY id DESC LIMIT 1",
                                [$journalRepId]
                            )->fetch(PDO::FETCH_ASSOC);
                            $targetJournalId = intval($openJournalRow['id'] ?? 0);
                        }

                        if ($journalRow && intval($journalRow['id'] ?? 0) > 0) {
                            if ($targetJournalId > 0) {
                                execute_query($pdo,
                                    "UPDATE rep_journal_orders
                                     SET rep_id = ?, journal_id = ?, status = ?, event_date = ?, event_time = ?, employee = ?, notes = ?, returned_pieces = ?, returned_value = ?
                                     WHERE id = ?",
                                    [$journalRepId > 0 ? $journalRepId : intval($journalRow['rep_id'] ?? 0), $targetJournalId, $journalStatus, $journalNow, $journalNowTime, $journalEmployee, $notes, $journalStatus === 'partial_return' ? $returnedPieces : 0, $journalStatus === 'partial_return' ? $returnedValue : 0, intval($journalRow['id'])]
                                );
                            } else {
                                execute_query($pdo,
                                    "UPDATE rep_journal_orders
                                     SET rep_id = ?, status = ?, event_date = ?, event_time = ?, employee = ?, notes = ?, returned_pieces = ?, returned_value = ?
                                     WHERE id = ?",
                                    [$journalRepId > 0 ? $journalRepId : intval($journalRow['rep_id'] ?? 0), $journalStatus, $journalNow, $journalNowTime, $journalEmployee, $notes, $journalStatus === 'partial_return' ? $returnedPieces : 0, $journalStatus === 'partial_return' ? $returnedValue : 0, intval($journalRow['id'])]
                                );
                            }
                        } elseif ($journalRepId > 0) {
                            execute_query($pdo,
                                "INSERT INTO rep_journal_orders (journal_id, rep_id, order_id, status, event_date, event_time, employee, notes, returned_pieces, returned_value)
                                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                                [$targetJournalId > 0 ? $targetJournalId : null, $journalRepId, $orderId, $journalStatus, $journalNow, $journalNowTime, $journalEmployee, $notes, $journalStatus === 'partial_return' ? $returnedPieces : 0, $journalStatus === 'partial_return' ? $returnedValue : 0]
                            );
                        }

                        if ($targetJournalId > 0) {
                            refresh_rep_daily_journal_status_counts($pdo, $targetJournalId);
                        }
                    }
                } catch (Exception $e) {}

                // Log lifecycle event for this return so the rep attribution is recorded in history
                try {
                    // prefer explicit repId from payload when provided
                    $histRepId = $repId ? intval($repId) : (isset($orderRow['rep_id']) ? intval($orderRow['rep_id']) : null);
                    log_order_history($pdo, $orderId, 'returned', 'partial_return', $notes ?: null, $histRepId);
                } catch (Exception $e) {
                    // ignore history insertion failures
                }

                // return updated order
                $stmt = execute_query($pdo, "SELECT order_number FROM orders WHERE id = ? LIMIT 1", [$orderId]);
                $orderNumber = $stmt->fetchColumn();
                if ($orderNumber) {
                    // reuse getByNumber behavior
                    $urlOrderNumber = $orderNumber;
                    $orderStmt = execute_query($pdo, "SELECT o.id, o.order_number, o.customer_id, o.rep_id, o.status, o.total_amount, o.shipping_fees, o.notes, o.created_at, c.name as customer_name, c.phone1 as phone1, c.phone2 as phone2, c.address as address FROM orders o LEFT JOIN customers c ON o.customer_id = c.id WHERE o.order_number = ?", [$urlOrderNumber]);
                    $orderData = $orderStmt->fetch(PDO::FETCH_ASSOC);
                    if ($orderData) {
                        $orderId2 = $orderData['id'];
                        $itStmt = execute_query($pdo, "SELECT oi.order_id, oi.product_id, oi.quantity, oi.price_per_unit, (oi.quantity * oi.price_per_unit) as line_total, ppar.name, pv.color, pv.size FROM order_items oi LEFT JOIN product_variants pv ON oi.product_id = pv.id LEFT JOIN products ppar ON pv.product_id = ppar.id WHERE oi.order_id = ?", [$orderId2]);
                        $itemsRes = $itStmt->fetchAll(PDO::FETCH_ASSOC);
                        $orderData['products'] = array_map(function($it){ return ['productId'=>$it['product_id'],'name'=>$it['name'],'color'=>$it['color'],'size'=>$it['size'],'quantity'=>$it['quantity'],'price'=>$it['price_per_unit'],'total'=>$it['line_total']]; }, $itemsRes);
                        echo json_encode(['success'=>true,'returnedValue'=> $returnedValue, 'order' => $orderData]);
                        break;
                    }
                }

                echo json_encode(['success'=>true,'returnedValue'=> $returnedValue]);
                break;
            } catch (Exception $e) {
                if ($pdo->inTransaction()) $pdo->rollBack();
                http_response_code(500);
                echo json_encode(['success'=>false,'message'=>'Failed to process partial return: '.$e->getMessage()]);
                break;
            }
        }
        if ($action === 'getTimeline') {
            $id = intval($_GET['id'] ?? 0);
            if (!$id) { http_response_code(400); echo json_encode(['success'=>false,'message'=>'id required']); break; }
            if (!table_exists($pdo, 'order_status_history')) {
                echo json_encode(['success' => true, 'data' => []]);
                break;
            }
            $stmt = execute_query($pdo, "SELECT h.*, u.name as created_by_name, r.name as rep_name FROM order_status_history h LEFT JOIN users u ON h.created_by = u.id LEFT JOIN users r ON h.rep_id = r.id WHERE h.order_id = ? ORDER BY h.id DESC", [$id]);
            echo json_encode(['success' => true, 'data' => $stmt->fetchAll(PDO::FETCH_ASSOC)]);
            break;
        }
        if ($action === 'getDocuments') {
            $id = intval($_GET['id'] ?? 0);
            if (!$id) { http_response_code(400); echo json_encode(['success'=>false,'message'=>'id required']); break; }
            if (!table_exists($pdo, 'order_documents')) {
                echo json_encode(['success' => true, 'data' => []]);
                break;
            }
            $stmt = execute_query($pdo, "SELECT d.*, u.name as created_by_name FROM order_documents d LEFT JOIN users u ON d.created_by = u.id WHERE d.order_id = ? ORDER BY d.id DESC", [$id]);
            echo json_encode(['success' => true, 'data' => $stmt->fetchAll(PDO::FETCH_ASSOC)]);
            break;
        }
        if ($action === 'addDocument') {
            $order_id = intval($input['order_id'] ?? 0);
            $doc_type = trim((string)($input['doc_type'] ?? 'other'));
            $doc_url = trim((string)($input['doc_url'] ?? ''));
            $notes = trim((string)($input['notes'] ?? ''));
            if (!$order_id || $doc_url === '') { http_response_code(400); echo json_encode(['success'=>false,'message'=>'order_id and doc_url required']); break; }
            if (!table_exists($pdo, 'order_documents')) {
                http_response_code(400); echo json_encode(['success'=>false,'message'=>'order_documents table missing']); break;
            }
            $current_user = $_SESSION['user_id'] ?? null;
            execute_query($pdo, "INSERT INTO order_documents (order_id, doc_type, doc_url, notes, created_by) VALUES (?, ?, ?, ?, ?)", [$order_id, $doc_type, $doc_url, $notes, $current_user]);
            echo json_encode(['success' => true]);
            break;
        }
        if ($action === 'deleteDocument') {
            $id = intval($input['id'] ?? 0);
            if (!$id) { http_response_code(400); echo json_encode(['success'=>false,'message'=>'id required']); break; }
            if (!table_exists($pdo, 'order_documents')) {
                http_response_code(400); echo json_encode(['success'=>false,'message'=>'order_documents table missing']); break;
            }
            execute_query($pdo, "DELETE FROM order_documents WHERE id = ?", [$id]);
            echo json_encode(['success' => true]);
            break;
        }
        if ($action === 'create') {
            $ordersInput = $input['orders'] ?? [];
            if (!is_array($ordersInput) || count($ordersInput) === 0) {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'No orders provided for import.']);
                break;
            }

            $ordersHasDiscountType = column_exists($pdo, 'orders', 'discount_type');
            $ordersHasDiscountValue = column_exists($pdo, 'orders', 'discount_value');
            $ordersHasDiscountAmount = column_exists($pdo, 'orders', 'discount_amount');
            $ordersHasTaxType = column_exists($pdo, 'orders', 'tax_type');
            $ordersHasTaxValue = column_exists($pdo, 'orders', 'tax_value');
            $ordersHasTaxAmount = column_exists($pdo, 'orders', 'tax_amount');
            $ordersHasSalesOfficeId = column_exists($pdo, 'orders', 'sales_office_id');
            $calcOrderSetting = get_setting_value($pdo, 'sales_calc_order', 'discount_then_tax');
            $calcOrderSetting = ($calcOrderSetting === 'tax_then_discount') ? 'tax_then_discount' : 'discount_then_tax';

            try {
                $pdo->beginTransaction();
                $created = [];
                foreach ($ordersInput as $ord) {
                    $customerName = $ord['customerName'] ?? $ord['name'] ?? '';
                    $phone = trim((string)($ord['phone'] ?? $ord['phone1'] ?? ''));
                    $phone2 = trim((string)($ord['phone2'] ?? ''));
                    $gov = $ord['governorate'] ?? '';
                    $address = $ord['address'] ?? '';

                    // find existing customer by phone (phone1 or phone2), then by exact name, otherwise create
                    $customerId = null;
                    if (!empty($phone)) {
                        $stmt = execute_query($pdo, "SELECT id FROM customers WHERE phone1 = ? OR phone2 = ? LIMIT 1", [$phone, $phone]);
                        if ($row = $stmt->fetch(PDO::FETCH_ASSOC)) $customerId = $row['id'];
                    }
                    // if still not found, try exact name match ONLY when no phone provided
                    // (do NOT match by name when a phone was provided — this avoids merging different customers who share names)
                    if (!$customerId && !empty($customerName) && empty($phone)) {
                        $stmt = execute_query($pdo, "SELECT id FROM customers WHERE name = ? LIMIT 1", [$customerName]);
                        if ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
                            $customerId = $row['id'];
                        }
                    }
                    // create customer when none found (we want to persist all customers on import)
                    if (!$customerId) {
                        // Include phone2 when available so both numbers are persisted
                        if ($phone2 !== '') {
                            execute_query($pdo, "INSERT INTO customers (name, phone1, phone2, governorate, address) VALUES (?, ?, ?, ?, ?)", [$customerName, $phone, $phone2, $gov, $address]);
                        } else {
                            execute_query($pdo, "INSERT INTO customers (name, phone1, governorate, address) VALUES (?, ?, ?, ?)", [$customerName, $phone, $gov, $address]);
                        }
                        $customerId = $pdo->lastInsertId();
                    }

                    $orderNumber = $ord['orderNumber'] ?? null;
                    // optional incoming employee/page from import payload - accept several key variants (english, raw, arabic)
                    $employee = null;
                    $employeeKeys = ['employee','employee_raw','created_by','createdBy','employee_name','الموظف','الموظف_name','employeeName'];
                    foreach ($employeeKeys as $k) {
                        if (isset($ord[$k]) && $ord[$k] !== '') { $employee = $ord[$k]; break; }
                    }
                    $page = null;
                    $pageKeys = ['page','page_raw','page_source','pageName','page_name','البيدج','pageSource'];
                    foreach ($pageKeys as $k2) {
                        if (isset($ord[$k2]) && $ord[$k2] !== '') { $page = $ord[$k2]; break; }
                    }
                    $providedTotal = isset($ord['total']) ? floatval($ord['total']) : 0;
                    $providedSubtotal = isset($ord['subTotal']) ? floatval($ord['subTotal']) : (isset($ord['sub_total']) ? floatval($ord['sub_total']) : 0);
                    $shipping = isset($ord['shippingCost']) ? floatval($ord['shippingCost']) : 0;

                    $discountType = normalize_tax_discount_type($ord['discount_type'] ?? ($ord['discountType'] ?? null));
                    $discountValue = isset($ord['discount_value']) ? floatval($ord['discount_value']) : (isset($ord['discountValue']) ? floatval($ord['discountValue']) : 0);
                    if (!$discountType) $discountValue = 0;

                    $taxType = normalize_tax_discount_type($ord['tax_type'] ?? ($ord['taxType'] ?? null));
                    $taxValue = isset($ord['tax_value']) ? floatval($ord['tax_value']) : (isset($ord['taxValue']) ? floatval($ord['taxValue']) : 0);
                    if (!$taxType) $taxValue = 0;

                    // Pre-calculate subtotal from importedProducts when possible
                    $calculatedSubtotal = 0;
                    foreach ($ord['importedProducts'] ?? [] as $prodCalc) {
                        $prodQtyCalc = intval($prodCalc['quantity'] ?? 0);
                        $prodIdCalc = intval($prodCalc['productId'] ?? 0);
                        $priceCalc = isset($prodCalc['price']) ? floatval($prodCalc['price']) : 0;
                        if (($priceCalc === 0 || $priceCalc === null) && $prodIdCalc) {
                            try {
                                $spc = execute_query($pdo, "SELECT sale_price FROM product_variants WHERE id = ? LIMIT 1", [$prodIdCalc]);
                                if ($rr = $spc->fetch(PDO::FETCH_ASSOC)) {
                                    $priceCalc = floatval($rr['sale_price']);
                                }
                            } catch (Exception $e) {}
                        }
                        $calculatedSubtotal += ($prodQtyCalc * $priceCalc);
                    }

                    $subtotalBase = ($providedSubtotal && $providedSubtotal > 0) ? $providedSubtotal : $calculatedSubtotal;
                    $totals = calculate_order_totals($subtotalBase, $shipping, $discountType, $discountValue, $taxType, $taxValue, $calcOrderSetting);
                    $discountAmount = $totals['discount_amount'];
                    $taxAmount = $totals['tax_amount'];

                    // Use provided total only when no adjustments were requested
                    $hasAdjustments = ($discountAmount > 0 || $taxAmount > 0);
                    $total = $hasAdjustments ? $totals['total'] : (($providedTotal && $providedTotal > 0) ? $providedTotal : $totals['total']);
                    $status = $ord['status'] ?? 'pending';
                    $notes = $ord['notes'] ?? null;

                    $salesOfficeId = null;
                    if (isset($ord['sales_office_id'])) {
                        $salesOfficeId = $ord['sales_office_id'] === null ? null : intval($ord['sales_office_id']);
                    } elseif (isset($ord['salesOfficeId'])) {
                        $salesOfficeId = $ord['salesOfficeId'] === null ? null : intval($ord['salesOfficeId']);
                    }

                    // Ensure we use a unique order_number. If the incoming orderNumber is empty
                    // or already exists in the DB, compute the next numeric order_number.
                    $useOrderNumber = null;
                    if (!empty($orderNumber)) {
                        try {
                            $chk = execute_query($pdo, "SELECT COUNT(*) as cnt FROM orders WHERE order_number = ?", [$orderNumber]);
                            $cntRow = $chk->fetch(PDO::FETCH_ASSOC);
                            $cnt = intval($cntRow['cnt'] ?? 0);
                            if ($cnt === 0) $useOrderNumber = $orderNumber;
                        } catch (Exception $e) {
                            // ignore and fall back to computing a new number
                            $useOrderNumber = null;
                        }
                    }
                    if (empty($useOrderNumber)) {
                        // Compute next numeric order_number based on existing max (safe for numeric order_number schemes)
                        try {
                            $mxStmt = $pdo->query("SELECT MAX(CAST(order_number AS UNSIGNED)) as mx FROM orders");
                            $mxRow = $mxStmt->fetch(PDO::FETCH_ASSOC);
                            $next = intval($mxRow['mx'] ?? 0) + 1;
                            $useOrderNumber = (string)$next;
                        } catch (Exception $e) {
                            // Last-resort: timestamp-based fallback
                            $useOrderNumber = (string)time();
                        }
                    }

                    // Attempt insert with retry in case of rare duplicate-key collisions
                    $orderId = null;
                    $maxAttempts = 5;
                    $attempt = 0;
                    while ($attempt < $maxAttempts) {
                            if (!isset($ordersHasEmployee)) { $ordersHasEmployee = column_exists($pdo, 'orders', 'employee'); }
                            if (!isset($ordersHasPage)) { $ordersHasPage = column_exists($pdo, 'orders', 'page'); }
                        try {
                            $insertCols = ['order_number','customer_id','rep_id','status','total_amount','shipping_fees','notes'];
                            $insertVals = [$useOrderNumber, $customerId, null, $status, $total, $shipping, $notes];
                            if ($ordersHasDiscountType) { $insertCols[] = 'discount_type'; $insertVals[] = $discountType; }
                            if ($ordersHasDiscountValue) { $insertCols[] = 'discount_value'; $insertVals[] = $discountValue; }
                            if ($ordersHasDiscountAmount) { $insertCols[] = 'discount_amount'; $insertVals[] = $discountAmount; }
                            if ($ordersHasTaxType) { $insertCols[] = 'tax_type'; $insertVals[] = $taxType; }
                            if ($ordersHasTaxValue) { $insertCols[] = 'tax_value'; $insertVals[] = $taxValue; }
                            if ($ordersHasTaxAmount) { $insertCols[] = 'tax_amount'; $insertVals[] = $taxAmount; }
                            if ($ordersHasSalesOfficeId) { $insertCols[] = 'sales_office_id'; $insertVals[] = $salesOfficeId; }
                            if ($ordersHasEmployee) { $insertCols[] = 'employee'; $insertVals[] = $employee; }
                            if ($ordersHasPage) { $insertCols[] = 'page'; $insertVals[] = $page; }

                            $placeholders = implode(',', array_fill(0, count($insertCols), '?'));
                            $sql = "INSERT INTO orders (" . implode(',', $insertCols) . ") VALUES (" . $placeholders . ")";
                            execute_query($pdo, $sql, $insertVals);
                            $orderId = $pdo->lastInsertId();
                            break; // success
                        } catch (PDOException $pe) {
                            // Duplicate order_number — recompute and retry
                            $errCode = $pe->getCode();
                            if (strpos($pe->getMessage(), 'Duplicate entry') !== false || $errCode == '23000') {
                                $attempt++;
                                try {
                                    $mxStmt = $pdo->query("SELECT MAX(CAST(order_number AS UNSIGNED)) as mx FROM orders");
                                    $mxRow = $mxStmt->fetch(PDO::FETCH_ASSOC);
                                    $next = intval($mxRow['mx'] ?? 0) + 1 + $attempt; // add attempt offset
                                    $useOrderNumber = (string)$next;
                                } catch (Exception $e) {
                                    $useOrderNumber = (string)(time() + $attempt);
                                }
                                // small loop continue to retry
                                continue;
                            }
                            // other DB error — rethrow to outer catch
                            throw $pe;
                        }
                    }
                    if (!$orderId) throw new Exception('Failed to allocate unique order_number after multiple attempts.');

                    log_order_history($pdo, $orderId, $status, 'created', $notes, null);

                    $items_for_sale = [];
                    // detect if order_items table has total_price column in this DB
                    $order_items_has_total = column_exists($pdo, 'order_items', 'total_price');

                    foreach ($ord['importedProducts'] ?? [] as $prod) {
                        $prodName = $prod['name'] ?? '';
                        $prodQty = intval($prod['quantity'] ?? 0);
                        $prodId = intval($prod['productId'] ?? 0);
                        if (!$prodId) {
                            // create placeholder variant when missing
                            $parentId = ensure_product_parent($pdo, $prodName);
                            execute_query($pdo, "INSERT INTO product_variants (product_id, name, cost_price, sale_price) VALUES (?, ?, 0, 0)", [$parentId, $prodName]);
                            $prodId = $pdo->lastInsertId();
                        }

                        $price = isset($prod['price']) ? floatval($prod['price']) : 0;
                        // If no price provided in import and product exists, fall back to product's sale_price
                        if (($price === 0 || $price === null) && $prodId) {
                            try {
                                $sp = execute_query($pdo, "SELECT sale_price FROM product_variants WHERE id = ? LIMIT 1", [$prodId]);
                                if ($r = $sp->fetch(PDO::FETCH_ASSOC)) {
                                    $price = floatval($r['sale_price']);
                                }
                            } catch (Exception $e) {
                                // ignore and keep price as-is
                            }
                        }

                        $lineTotal = $prodQty * $price;

                        if ($order_items_has_total) {
                            execute_query($pdo, "INSERT INTO order_items (order_id, product_id, quantity, price_per_unit, total_price) VALUES (?, ?, ?, ?, ?)", [$orderId, $prodId, $prodQty, $price, $lineTotal]);
                        } else {
                            execute_query($pdo, "INSERT INTO order_items (order_id, product_id, quantity, price_per_unit) VALUES (?, ?, ?, ?)", [$orderId, $prodId, $prodQty, $price]);
                        }

                        // collect for optional sales processing (per-order)
                        $items_for_sale[] = ['product_id' => $prodId, 'qty' => $prodQty, 'price' => $price, 'name' => $prodName];
                    }

                    $created[] = ['order_id' => $orderId, 'order_number' => $useOrderNumber];
                    // Optional: create sale transaction + stock update for this order
                    if (!empty($input['create_sales']) && !empty($input['default_warehouse_id'])) {
                        $whId = intval($input['default_warehouse_id']);
                        $saleTotal = $total;
                        if ($saleTotal > 0) {
                            $txType_local = pick_allowed_enum($pdo, 'transactions', 'type', 'sale', ['sale','payment_in','payment_out','transfer','purchase']);
                            $rel_local = pick_allowed_enum($pdo, 'transactions', 'related_to_type', 'customer', ['customer','rep','supplier','none']);
                            $detailsPayload = [
                                'items' => $items_for_sale,
                                'subtotal' => $subtotalBase,
                                'discount_type' => $discountType,
                                'discount_value' => $discountValue,
                                'discount_amount' => $discountAmount,
                                'tax_type' => $taxType,
                                'tax_value' => $taxValue,
                                'tax_amount' => $taxAmount,
                                'shipping' => $shipping,
                                'total' => $total,
                                'invoice_number' => $useOrderNumber
                            ];
                            execute_query($pdo, "INSERT INTO transactions (type, warehouse_id, treasury_id, related_to_type, related_to_id, amount, transaction_date, details) VALUES (?, ?, ?, ?, ?, ?, NOW(), ?)", [$txType_local, $whId, null, $rel_local, $customerId, $saleTotal, json_encode($detailsPayload)]);
                            $saleId = $pdo->lastInsertId();
                            foreach ($items_for_sale as $it) {
                                $pid = intval($it['product_id']);
                                $qty = intval($it['qty']);
                                if ($qty <= 0 || !$pid) continue;
                                $stmt = execute_query($pdo, "SELECT quantity FROM stock WHERE product_id = ? AND warehouse_id = ?", [$pid, $whId]);
                                $prevQty = 0;
                                if ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
                                    $prevQty = intval($row['quantity']);
                                    $newQty = $prevQty - $qty; if ($newQty < 0) $newQty = 0;
                                    execute_query($pdo, "UPDATE stock SET quantity = ? WHERE product_id = ? AND warehouse_id = ?", [$newQty, $pid, $whId]);
                                } else {
                                    $newQty = 0;
                                    execute_query($pdo, "INSERT INTO stock (product_id, warehouse_id, quantity) VALUES (?, ?, ?)", [$pid, $whId, 0]);
                                }
                                execute_query($pdo, "INSERT INTO product_movements (product_id, warehouse_id, movement_type, quantity_change, previous_quantity, new_quantity, reference_id, reference_type, notes, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", [$pid, $whId, 'sale', -$qty, $prevQty, $newQty, $saleId, 'sale_invoice', json_encode($it), null]);
                            }
                            if ($saleTotal > 0) execute_query($pdo, "UPDATE customers SET total_debit = total_debit + ? WHERE id = ?", [$saleTotal, $customerId]);
                        }
                    }
                }
                $pdo->commit();
                echo json_encode(['success' => true, 'created' => $created]);
            } catch (Exception $e) {
                $pdo->rollBack();
                http_response_code(500);
                echo json_encode(['success' => false, 'message' => 'Import failed: ' . $e->getMessage()]);
            }
            break;
        }

        if ($action === 'update') {
            $id = intval($input['id'] ?? 0);
            $status = array_key_exists('status', $input) ? $input['status'] : null;
            $repIdProvided = (array_key_exists('repId', $input) || array_key_exists('rep_id', $input));
            $repId = $repIdProvided ? ($input['repId'] ?? $input['rep_id']) : null; // may be null to clear
            $shippingCompanyProvided = (array_key_exists('shippingCompanyId', $input) || array_key_exists('shipping_company_id', $input));
            $shippingCompanyId = $shippingCompanyProvided ? ($input['shippingCompanyId'] ?? $input['shipping_company_id']) : null; // may be null to clear
            $statusNote = trim((string)($input['status_note'] ?? ($input['note'] ?? '')));
            $penaltyApply = isset($input['penalty_apply']) ? boolval($input['penalty_apply']) : (isset($input['penaltyApply']) ? boolval($input['penaltyApply']) : (isset($input['with_fine']) ? boolval($input['with_fine']) : false));
            $penaltyAmount = isset($input['penalty_amount']) ? floatval($input['penalty_amount']) : (isset($input['penaltyAmount']) ? floatval($input['penaltyAmount']) : 0);
            if ($penaltyAmount < 0) $penaltyAmount = abs($penaltyAmount);
            if (!$id) {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'Order id is required.']);
                break;
            }
            try {
                // Ensure optional column exists when requested
                if ($shippingCompanyProvided && !column_exists($pdo, 'orders', 'shipping_company_id')) {
                    try {
                        execute_query($pdo, "ALTER TABLE orders ADD COLUMN shipping_company_id INT NULL DEFAULT NULL");
                    } catch (Exception $e) {
                        // ignore; subsequent queries will surface errors if any
                    }
                }

                $hasShipCol = column_exists($pdo, 'orders', 'shipping_company_id');
                $before = execute_query($pdo, "SELECT status, rep_id" . ($hasShipCol ? ", shipping_company_id" : "") . " FROM orders WHERE id = ? LIMIT 1", [$id])->fetch(PDO::FETCH_ASSOC);
                $prevStatus = $before ? ($before['status'] ?? null) : null;
                if ($penaltyApply && $penaltyAmount > 0) {
                    $statusNote = trim($statusNote . ' | غرامة على المندوب: ' . $penaltyAmount);
                }
                $set_parts = [];
                $values = [];
                if ($repIdProvided) {
                    // allow clearing rep by sending null or empty
                    if ($repId === '') $repId = null;
                    $set_parts[] = 'rep_id = ?';
                    $values[] = $repId;
                }
                if ($shippingCompanyProvided && $hasShipCol) {
                    if ($shippingCompanyId === '') $shippingCompanyId = null;
                    $set_parts[] = 'shipping_company_id = ?';
                    $values[] = $shippingCompanyId;
                }
                if ($status !== null) {
                    // Map requested status to an allowed enum value in this installation
                    $allowedStatus = pick_allowed_enum($pdo, 'orders', 'status', $status, ['delivered','returned','in_delivery','pending','with_rep','pending_payment']);
                    $set_parts[] = 'status = ?';
                    $values[] = $allowedStatus;
                }
                if (!empty($set_parts)) {
                    $sql = 'UPDATE orders SET ' . implode(', ', $set_parts);
                    if (column_exists($pdo, 'orders', 'updated_at')) {
                        $sql .= ', updated_at = NOW()';
                    }
                    $sql .= ' WHERE id = ?';
                    $values[] = $id;
                    execute_query($pdo, $sql, $values);
                    audit_log($pdo, 'orders', 'update', $id, json_encode(['status' => $status, 'rep_id' => $repIdProvided ? $repId : null, 'shipping_company_id' => $shippingCompanyProvided ? $shippingCompanyId : null]));
                }

                if ($before) {
                    $prevRep = $before['rep_id'] ?? null;
                    $prevShip = $hasShipCol ? ($before['shipping_company_id'] ?? null) : null;
                    $newStatus = isset($allowedStatus) ? $allowedStatus : $prevStatus;
                    if ($status !== null && $newStatus !== $prevStatus) {
                        // Prefer explicit repId from request; fall back to the rep who owned the order before this change
                        $histRepId = $repId ?: (isset($before['rep_id']) ? (intval($before['rep_id'] ?? 0) ?: null) : null);
                        log_order_history($pdo, $id, $newStatus, 'status', $statusNote, $histRepId);
                    }
                    if ($repIdProvided && $repId !== $prevRep) {
                        $repAction = $repId ? 'rep_assign' : 'rep_clear';
                        log_order_history($pdo, $id, $newStatus, $repAction, null, $repId ?: null);
                    }
                    if ($shippingCompanyProvided && $hasShipCol && $shippingCompanyId !== $prevShip) {
                        $shipAction = $shippingCompanyId ? 'shipping_assign' : 'shipping_clear';
                        log_order_history($pdo, $id, $newStatus, $shipAction, null, $shippingCompanyId ?: null);
                    }
                }

                // After updating order status/rep, perform rep-account adjustments
                if ($status !== null) {
                    try {
                        // fetch order row
                        $ordStmt = execute_query($pdo, "SELECT id, total_amount, shipping_fees, rep_id FROM orders WHERE id = ? LIMIT 1", [$id]);
                        $orderRow = $ordStmt->fetch(PDO::FETCH_ASSOC);

                        // compute subtotal (exclude shipping) from order_items when possible
                        $orderSubtotal = 0;
                        if (column_exists($pdo, 'order_items', 'quantity')) {
                            if (column_exists($pdo, 'order_items', 'total_price')) {
                                $itStmt = execute_query($pdo, "SELECT COALESCE(SUM(total_price),0) as s FROM order_items WHERE order_id = ?", [$id]);
                                $itRow = $itStmt->fetch(PDO::FETCH_ASSOC);
                                $orderSubtotal = floatval($itRow['s'] ?? 0);
                            } else {
                                $itStmt = execute_query($pdo, "SELECT COALESCE(SUM(quantity * price_per_unit),0) as s FROM order_items WHERE order_id = ?", [$id]);
                                $itRow = $itStmt->fetch(PDO::FETCH_ASSOC);
                                $orderSubtotal = floatval($itRow['s'] ?? 0);
                            }
                        } else {
                            $orderSubtotal = floatval((isset($orderRow['total_amount']) ? $orderRow['total_amount'] : 0) - (isset($orderRow['shipping_fees']) ? $orderRow['shipping_fees'] : 0));
                            if ($orderSubtotal < 0) $orderSubtotal = 0;
                        }

                        $repForTx = null;
                        if ($repIdProvided) $repForTx = $repId;
                        if (!$repForTx && isset($orderRow['rep_id'])) $repForTx = $orderRow['rep_id'];
                        // Fallback: order may have had rep_id cleared before this query ran (rep_clear fires first).
                        // Use $before (snapshot taken before the update) to recover the original rep.
                        if (!$repForTx && isset($before['rep_id']) && $before['rep_id']) $repForTx = intval($before['rep_id']);
                        if (!$repForTx) $repForTx = null;

                        if ($repForTx) {
                            $relType = pick_allowed_enum($pdo, 'transactions', 'related_to_type', 'rep', ['rep','employee','none']);

                            if ($penaltyApply && $penaltyAmount > 0) {
                                if (!$repForTx) {
                                    throw new Exception('لا يوجد مندوب مرتبط بهذا الاوردر لتطبيق الغرامة.');
                                }
                                $txTypePenalty = pick_allowed_enum($pdo, 'transactions', 'type', 'rep_settlement', ['payment_out','payment_in','sale']);
                                $penaltyDetails = ['order_id'=>$id,'action'=>'status_penalty','subtype'=>'rep_penalty','amount'=>$penaltyAmount,'status'=>$status];
                                if (!empty($statusNote)) $penaltyDetails['notes'] = $statusNote;
                                execute_query($pdo, "INSERT INTO transactions (type, warehouse_id, treasury_id, related_to_type, related_to_id, amount, transaction_date, details) VALUES (?, ?, ?, ?, ?, ?, NOW(), ?)", [$txTypePenalty, null, null, $relType, $repForTx, -1 * $penaltyAmount, json_encode($penaltyDetails)]);
                            }

                            // Consignment model:
                            // - delivered: NO financial transaction (Rep already took the debt at assignment)
                            // - returned: CREDIT the Rep (decrease debt)

                            if ($status === 'returned') {
                                $amt = $orderSubtotal;
                                if ($amt > 0) {
                                    $txType = pick_allowed_enum($pdo, 'transactions', 'type', 'rep_return_credit', ['rep_return_credit','rep_settlement','payment_in','sale']);
                                    execute_query($pdo, "INSERT INTO transactions (type, warehouse_id, treasury_id, related_to_type, related_to_id, amount, transaction_date, details) VALUES (?, ?, ?, ?, ?, ?, NOW(), ?)", [$txType, null, null, $relType, $repForTx, $amt, json_encode(['order_id'=>$id,'action'=>'returned','model'=>'consignment'])]);
                                }
                                // returned items should be restocked back to warehouse if provided
                                $warehouseIdForReturn = isset($input['warehouseId']) ? intval($input['warehouseId']) : (isset($input['warehouse_id']) ? intval($input['warehouse_id']) : 0);
                                $order_update_reason = isset($input['reason']) ? trim($input['reason']) : (isset($input['notes']) ? trim($input['notes']) : '');
                                if ($warehouseIdForReturn && empty($order_update_reason)) {
                                    // require reason when restocking into a warehouse
                                    throw new Exception('يرجى تحديد سبب إعادة المخزون (reason) عند إرجاع الاوردر إلى المستودع.');
                                }
                                if ($warehouseIdForReturn && column_exists($pdo, 'order_items', 'quantity')) {
                                    $itStmt = execute_query($pdo, "SELECT product_id, quantity FROM order_items WHERE order_id = ?", [$id]);
                                    $items = $itStmt->fetchAll(PDO::FETCH_ASSOC);
                                    $mvType = pick_allowed_enum($pdo, 'product_movements', 'movement_type', 'return', ['return','receiving','in','restock']);
                                    foreach ($items as $it) {
                                        $pid = intval($it['product_id']);
                                        $qty = intval($it['quantity']);
                                        if ($qty <= 0 || !$pid) continue;
                                        $stkStmt = execute_query($pdo, "SELECT quantity FROM stock WHERE product_id = ? AND warehouse_id = ?", [$pid, $warehouseIdForReturn]);
                                        $prevQty = 0;
                                        if ($row = $stkStmt->fetch(PDO::FETCH_ASSOC)) {
                                            $prevQty = intval($row['quantity']);
                                            $newQty = $prevQty + $qty;
                                            execute_query($pdo, "UPDATE stock SET quantity = ? WHERE product_id = ? AND warehouse_id = ?", [$newQty, $pid, $warehouseIdForReturn]);
                                        } else {
                                            $newQty = $qty;
                                            execute_query($pdo, "INSERT INTO stock (product_id, warehouse_id, quantity) VALUES (?, ?, ?)", [$pid, $warehouseIdForReturn, $newQty]);
                                        }
                                        $movement_notes = json_encode(['order_id' => $id, 'reason' => $order_update_reason]);
                                        execute_query($pdo, "INSERT INTO product_movements (product_id, warehouse_id, movement_type, quantity_change, previous_quantity, new_quantity, reference_id, reference_type, notes, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", [$pid, $warehouseIdForReturn, $mvType, $qty, $prevQty, $newQty, $id, 'order_return', $movement_notes, null]);
                                    }
                                }
                            }

                            // partial delivery: accept deliveredAmount in input (numeric)
                            if ($status === 'in_delivery' && isset($input['deliveredAmount'])) {
                                $deliveredAmt = floatval($input['deliveredAmount']);
                                $deliveredAmt = max(0, min($deliveredAmt, $orderSubtotal));
                                $returnedAmt = $orderSubtotal - $deliveredAmt;
                                // Prefer exact returned-items valuation when detailed items are provided.
                                if (!empty($input['returnedItems']) && is_array($input['returnedItems'])) {
                                    $returnedAmtByItems = 0.0;
                                    foreach ($input['returnedItems'] as $rit) {
                                        $pid = intval($rit['productId'] ?? $rit['product_id'] ?? 0);
                                        $rqty = intval($rit['quantity'] ?? $rit['qty'] ?? 0);
                                        if ($pid <= 0 || $rqty <= 0) continue;
                                        $oiRow = execute_query($pdo,
                                            "SELECT price_per_unit FROM order_items WHERE order_id = ? AND product_id = ? ORDER BY id ASC LIMIT 1",
                                            [$id, $pid]
                                        )->fetch(PDO::FETCH_ASSOC);
                                        $unit = floatval($oiRow['price_per_unit'] ?? 0);
                                        $returnedAmtByItems += ($unit * $rqty);
                                    }
                                    if ($returnedAmtByItems > 0) {
                                        $returnedAmt = min($orderSubtotal, $returnedAmtByItems);
                                    }
                                }
                                // delivered portion: no financial transaction
                                if ($returnedAmt > 0) {
                                    $txType = pick_allowed_enum($pdo, 'transactions', 'type', 'rep_return_credit', ['rep_return_credit','rep_settlement','payment_in','sale']);
                                    execute_query($pdo, "INSERT INTO transactions (type, warehouse_id, treasury_id, related_to_type, related_to_id, amount, transaction_date, details) VALUES (?, ?, ?, ?, ?, ?, NOW(), ?)", [$txType, null, null, $relType, $repForTx, $returnedAmt, json_encode(['order_id'=>$id,'action'=>'partial_returned','returned'=>$returnedAmt,'model'=>'consignment'])]);
                                    // handle restocking of returned portion when warehouse provided or per-item returnedItems
                                    $warehouseIdForReturn = isset($input['warehouseId']) ? intval($input['warehouseId']) : (isset($input['warehouse_id']) ? intval($input['warehouse_id']) : 0);
                                    $order_update_reason = isset($input['reason']) ? trim($input['reason']) : (isset($input['notes']) ? trim($input['notes']) : '');
                                    if ($warehouseIdForReturn && empty($order_update_reason)) {
                                        throw new Exception('يرجى تحديد سبب إعادة المخزون (reason) عند إرجاع الاوردر إلى المستودع.');
                                    }
                                    // If detailed returnedItems provided, use them to restock exact quantities
                                    if (!empty($input['returnedItems']) && is_array($input['returnedItems'])) {
                                        $mvType = pick_allowed_enum($pdo, 'product_movements', 'movement_type', 'return', ['return','receiving','in','restock']);
                                        foreach ($input['returnedItems'] as $rit) {
                                            $pid = intval($rit['productId'] ?? $rit['product_id'] ?? 0);
                                            $rqty = intval($rit['quantity'] ?? $rit['qty'] ?? 0);
                                            $wId = isset($rit['warehouseId']) ? intval($rit['warehouseId']) : $warehouseIdForReturn;
                                            if ($pid && $rqty > 0 && $wId) {
                                                $stkStmt = execute_query($pdo, "SELECT quantity FROM stock WHERE product_id = ? AND warehouse_id = ?", [$pid, $wId]);
                                                $prevQty = 0;
                                                if ($row = $stkStmt->fetch(PDO::FETCH_ASSOC)) {
                                                    $prevQty = intval($row['quantity']);
                                                    $newQty = $prevQty + $rqty;
                                                    execute_query($pdo, "UPDATE stock SET quantity = ? WHERE product_id = ? AND warehouse_id = ?", [$newQty, $pid, $wId]);
                                                } else {
                                                    $newQty = $rqty;
                                                    execute_query($pdo, "INSERT INTO stock (product_id, warehouse_id, quantity) VALUES (?, ?, ?)", [$pid, $wId, $newQty]);
                                                }
                                                execute_query($pdo, "INSERT INTO product_movements (product_id, warehouse_id, movement_type, quantity_change, previous_quantity, new_quantity, reference_id, reference_type, notes, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", [$pid, $wId, $mvType, $rqty, $prevQty, $newQty, $id, 'partial_return', json_encode(['order_id'=>$id]), null]);
                                            }
                                        }
                                    } elseif ($warehouseIdForReturn && column_exists($pdo, 'order_items', 'quantity')) {
                                        // fallback: restock remaining items proportionally (use full quantities)
                                        $itStmt = execute_query($pdo, "SELECT product_id, quantity FROM order_items WHERE order_id = ?", [$id]);
                                        $items = $itStmt->fetchAll(PDO::FETCH_ASSOC);
                                        $mvType = pick_allowed_enum($pdo, 'product_movements', 'movement_type', 'return', ['return','receiving','in','restock']);
                                        foreach ($items as $it) {
                                            $pid = intval($it['product_id']);
                                            $qty = intval($it['quantity']);
                                            if ($qty <= 0 || !$pid) continue;
                                            $stkStmt = execute_query($pdo, "SELECT quantity FROM stock WHERE product_id = ? AND warehouse_id = ?", [$pid, $warehouseIdForReturn]);
                                            $prevQty = 0;
                                            if ($row = $stkStmt->fetch(PDO::FETCH_ASSOC)) {
                                                $prevQty = intval($row['quantity']);
                                                $newQty = $prevQty + $qty;
                                                execute_query($pdo, "UPDATE stock SET quantity = ? WHERE product_id = ? AND warehouse_id = ?", [$newQty, $pid, $warehouseIdForReturn]);
                                            } else {
                                                $newQty = $qty;
                                                execute_query($pdo, "INSERT INTO stock (product_id, warehouse_id, quantity) VALUES (?, ?, ?)", [$pid, $warehouseIdForReturn, $newQty]);
                                            }
                                                $movement_notes = json_encode(['order_id' => $id, 'reason' => $order_update_reason]);
                                                execute_query($pdo, "INSERT INTO product_movements (product_id, warehouse_id, movement_type, quantity_change, previous_quantity, new_quantity, reference_id, reference_type, notes, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", [$pid, $warehouseIdForReturn, $mvType, $qty, $prevQty, $newQty, $id, 'partial_return', $movement_notes, null]);
                                        }
                                    }
                                }
                            }
                        }
                    } catch (Exception $e) {
                        error_log('Failed to create rep transaction for order '.$id.': '.$e->getMessage());
                    }
                    // If the status indicates the order is no longer in rep custody, clear rep assignment
                    try {
                        if (in_array($status, ['delivered','returned','in_delivery'])) {
                            // Capture the rep who owned this order BEFORE clearing, for history attribution
                            $oldRepForClear = isset($before['rep_id']) ? (intval($before['rep_id'] ?? 0) ?: null) : null;
                            $clearSql = 'UPDATE orders SET rep_id = NULL';
                            if (column_exists($pdo, 'orders', 'updated_at')) $clearSql .= ', updated_at = NOW()';
                            $clearSql .= ' WHERE id = ?';
                            execute_query($pdo, $clearSql, [$id]);
                            log_order_history($pdo, $id, $status, 'rep_clear', 'auto_clear_after_status', $oldRepForClear);
                        }
                    } catch (Exception $e) {
                        error_log('Failed to clear rep assignment for order '.$id.': '.$e->getMessage());
                    }
                }

                // If update payload includes phone(s) or customer name, persist them to the customer record
                try {
                    $custStmt = execute_query($pdo, "SELECT customer_id FROM orders WHERE id = ? LIMIT 1", [$id]);
                    $ordCust = $custStmt->fetch(PDO::FETCH_ASSOC);
                    if ($ordCust && !empty($ordCust['customer_id'])) {
                        $custId = intval($ordCust['customer_id']);
                        $phone = trim((string)($input['phone'] ?? $input['phone1'] ?? ''));
                        $phone2 = trim((string)($input['phone2'] ?? ''));
                        $custNameProvided = array_key_exists('customerName', $input) || array_key_exists('customer_name', $input) || array_key_exists('name', $input);
                        $custName = $custNameProvided ? trim((string)($input['customerName'] ?? $input['customer_name'] ?? $input['name'])) : null;

                        if ($phone !== '' || $phone2 !== '' || $custName !== null) {
                            $cstmt = execute_query($pdo, "SELECT phone1, phone2, name FROM customers WHERE id = ? LIMIT 1", [$custId]);
                            if ($crow = $cstmt->fetch(PDO::FETCH_ASSOC)) {
                                $existingPhone1 = trim((string)($crow['phone1'] ?? ''));
                                $existingPhone2 = trim((string)($crow['phone2'] ?? ''));
                                $existingName = trim((string)($crow['name'] ?? ''));

                                $updateParts = [];
                                $updateVals = [];

                                if ($custName !== null && $custName !== '' && $custName !== $existingName) {
                                    $updateParts[] = 'name = ?';
                                    $updateVals[] = $custName;
                                }

                                if ($phone !== '') {
                                    if ($existingPhone1 === '') {
                                        $updateParts[] = 'phone1 = ?';
                                        $updateVals[] = $phone;
                                    } elseif ($existingPhone1 !== $phone && $existingPhone2 === '') {
                                        $updateParts[] = 'phone2 = ?';
                                        $updateVals[] = $phone;
                                    }
                                }

                                if ($phone2 !== '') {
                                    if ($existingPhone2 === '' && $phone2 !== $existingPhone1) {
                                        $updateParts[] = 'phone2 = ?';
                                        $updateVals[] = $phone2;
                                    }
                                }

                                if (!empty($updateParts)) {
                                    $updateVals[] = $custId;
                                    execute_query($pdo, "UPDATE customers SET " . implode(', ', $updateParts) . " WHERE id = ?", $updateVals);
                                }
                            }
                        }
                    }
                } catch (Exception $e) {
                    // ignore customer update failures
                }

                echo json_encode(['success' => true, 'message' => 'Order updated.']);
            } catch (Exception $e) {
                http_response_code(500);
                echo json_encode(['success' => false, 'message' => 'Failed to update order: ' . $e->getMessage()]);
            }
            break;
        }

        if ($action === 'setItems') {
            // Replace order items for an existing order. Accepts 'products' or 'importedProducts' array.
            $orderId = intval($input['id'] ?? ($input['order_id'] ?? 0));
            $items = $input['products'] ?? $input['importedProducts'] ?? $input['items'] ?? [];
            if (!$orderId || !is_array($items)) {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'order id and products array are required']);
                break;
            }
            try {
                $pdo->beginTransaction();

                // Ensure order exists
                $ord = execute_query($pdo, "SELECT id FROM orders WHERE id = ? LIMIT 1", [$orderId])->fetch(PDO::FETCH_ASSOC);
                if (!$ord) { http_response_code(404); echo json_encode(['success'=>false,'message'=>'Order not found']); if ($pdo->inTransaction()) $pdo->rollBack(); break; }

                // Delete existing items
                execute_query($pdo, "DELETE FROM order_items WHERE order_id = ?", [$orderId]);

                $order_items_has_total = column_exists($pdo, 'order_items', 'total_price');
                $totalAmount = 0.0;

                foreach ($items as $it) {
                    $prodId = intval($it['productId'] ?? ($it['product_id'] ?? 0));
                    $qty = intval($it['quantity'] ?? ($it['qty'] ?? 0));
                    $price = isset($it['price']) ? floatval($it['price']) : (isset($it['price_per_unit']) ? floatval($it['price_per_unit']) : 0);

                    // Try lookup by product_code if id missing
                    if ($prodId <= 0 && !empty($it['product_code'])) {
                        $stmt = execute_query($pdo, "SELECT id FROM product_variants WHERE barcode = ? LIMIT 1", [trim((string)$it['product_code'])]);
                        $row = $stmt->fetch(PDO::FETCH_ASSOC);
                        if ($row) $prodId = intval($row['id']);
                    }

                    if ($prodId <= 0) {
                        // If product id still missing, create placeholder variant using provided name
                        $name = trim((string)($it['name'] ?? ($it['productName'] ?? '')));
                        if ($name === '') {
                            if ($pdo->inTransaction()) $pdo->rollBack();
                            http_response_code(400);
                            echo json_encode(['success' => false, 'message' => 'Each item requires a productId or product_code or name']);
                            break 2;
                        }
                        $parentId = ensure_product_parent($pdo, $name);
                        execute_query($pdo, "INSERT INTO product_variants (product_id, name, cost_price, sale_price) VALUES (?, ?, 0, 0)", [$parentId, $name]);
                        $prodId = $pdo->lastInsertId();
                    }

                    if ($price === 0 && $prodId) {
                        try {
                            $sp = execute_query($pdo, "SELECT sale_price FROM product_variants WHERE id = ? LIMIT 1", [$prodId]);
                            if ($r = $sp->fetch(PDO::FETCH_ASSOC)) $price = floatval($r['sale_price'] ?? 0);
                        } catch (Exception $e) {}
                    }

                    $lineTotal = $qty * $price;
                    if ($order_items_has_total) {
                        execute_query($pdo, "INSERT INTO order_items (order_id, product_id, quantity, price_per_unit, total_price) VALUES (?, ?, ?, ?, ?)", [$orderId, $prodId, $qty, $price, $lineTotal]);
                    } else {
                        execute_query($pdo, "INSERT INTO order_items (order_id, product_id, quantity, price_per_unit) VALUES (?, ?, ?, ?)", [$orderId, $prodId, $qty, $price]);
                    }
                    $totalAmount += $lineTotal;
                }

                // Optionally accept shipping in payload to compute final total
                $shipping = isset($input['shipping']) ? floatval($input['shipping']) : (isset($input['shipping_fees']) ? floatval($input['shipping_fees']) : (isset($input['shippingCost']) ? floatval($input['shippingCost']) : 0));
                $newTotal = $totalAmount + $shipping;
                // Update orders.total_amount and shipping_fees if present
                execute_query($pdo, "UPDATE orders SET total_amount = ?, shipping_fees = ? WHERE id = ?", [$newTotal, $shipping, $orderId]);

                audit_log($pdo, 'orders', 'set_items', $orderId, json_encode(['items' => $items]));
                if ($pdo->inTransaction()) $pdo->commit();

                echo json_encode(['success' => true, 'order_id' => $orderId, 'total' => $newTotal]);
            } catch (Exception $e) {
                if ($pdo->inTransaction()) $pdo->rollBack();
                http_response_code(500);
                echo json_encode(['success' => false, 'message' => 'Failed to set items: ' . $e->getMessage()]);
            }
            break;
        }

        case 'accounts':
            $action = $_GET['action'] ?? 'getAll';
            $perm_code = map_action_to_perm($action);
            if ($perm_code) {
                check_permission_or_die($pdo, 'finance', $perm_code);
            }
            if (!table_exists($pdo, 'accounts')) {
                http_response_code(500);
                echo json_encode(['success' => false, 'message' => 'accounts table missing']);
                break;
            }
            if ($action === 'getAll') {
                $stmt = execute_query($pdo, "SELECT * FROM accounts ORDER BY code ASC");
                echo json_encode(['success' => true, 'data' => $stmt->fetchAll(PDO::FETCH_ASSOC)]);
                break;
            }
            if ($action === 'create') {
                $code = trim((string)($input['code'] ?? ''));
                $name = trim((string)($input['name'] ?? ''));
                $type = trim((string)($input['type'] ?? ''));
                $parentId = intval($input['parent_id'] ?? 0);
                if ($code === '' || $name === '' || $type === '') {
                    http_response_code(400);
                    echo json_encode(['success' => false, 'message' => 'code, name, type required']);
                    break;
                }
                execute_query($pdo, "INSERT INTO accounts (code, name, type, parent_id, is_active) VALUES (?, ?, ?, ?, 1)", [$code, $name, $type, $parentId ?: null]);
                echo json_encode(['success' => true, 'id' => $pdo->lastInsertId()]);
                break;
            }
            if ($action === 'update') {
                $id = intval($input['id'] ?? 0);
                if (!$id) { http_response_code(400); echo json_encode(['success' => false, 'message' => 'id required']); break; }
                $fields = [];
                $values = [];
                $mapping = ['code' => 'code', 'name' => 'name', 'type' => 'type', 'parent_id' => 'parent_id', 'is_active' => 'is_active'];
                foreach ($mapping as $in => $col) {
                    if (array_key_exists($in, $input)) {
                        $fields[] = "$col = ?";
                        $values[] = $input[$in];
                    }
                }
                if (!empty($fields)) {
                    $values[] = $id;
                    execute_query($pdo, "UPDATE accounts SET " . implode(', ', $fields) . " WHERE id = ?", $values);
                }
                echo json_encode(['success' => true]);
                break;
            }
            if ($action === 'delete') {
                $id = intval($input['id'] ?? 0);
                if (!$id) { http_response_code(400); echo json_encode(['success' => false, 'message' => 'id required']); break; }
                execute_query($pdo, "DELETE FROM accounts WHERE id = ?", [$id]);
                echo json_encode(['success' => true]);
                break;
            }
            break;
        case 'journal':
            $action = $_GET['action'] ?? 'getAll';
            $perm_code = map_action_to_perm($action);
            if ($perm_code) {
                check_permission_or_die($pdo, 'finance', $perm_code);
            }
            if (!table_exists($pdo, 'journal_entries') || !table_exists($pdo, 'journal_lines')) {
                http_response_code(500);
                echo json_encode(['success' => false, 'message' => 'journal tables missing']);
                break;
            }
            if ($action === 'getAll') {
                $stmt = execute_query($pdo, "SELECT * FROM journal_entries ORDER BY entry_date DESC, id DESC");
                echo json_encode(['success' => true, 'data' => $stmt->fetchAll(PDO::FETCH_ASSOC)]);
                break;
            }
            if ($action === 'getById') {
                $id = intval($_GET['id'] ?? 0);
                if (!$id) { http_response_code(400); echo json_encode(['success' => false, 'message' => 'id required']); break; }
                $entry = execute_query($pdo, "SELECT * FROM journal_entries WHERE id = ?", [$id])->fetch(PDO::FETCH_ASSOC);
                $lines = execute_query($pdo, "SELECT l.*, a.name as account_name, a.code as account_code FROM journal_lines l JOIN accounts a ON a.id = l.account_id WHERE l.entry_id = ? ORDER BY l.id ASC", [$id])->fetchAll(PDO::FETCH_ASSOC);
                echo json_encode(['success' => true, 'data' => ['entry' => $entry, 'lines' => $lines]]);
                break;
            }
            if ($action === 'create') {
                $entryDate = $input['entry_date'] ?? date('Y-m-d');
                $memo = $input['memo'] ?? null;
                $posted = isset($input['posted']) ? boolval($input['posted']) : false;
                $lines = $input['lines'] ?? [];
                if (!is_array($lines) || count($lines) < 2) {
                    http_response_code(400);
                    echo json_encode(['success' => false, 'message' => 'lines required']);
                    break;
                }
                $entryId = finance_create_journal_entry($pdo, $entryDate, $memo, 'manual', null, $posted, $lines);
                if (!$entryId) {
                    http_response_code(400);
                    echo json_encode(['success' => false, 'message' => 'entry not balanced or invalid']);
                    break;
                }
                echo json_encode(['success' => true, 'id' => $entryId]);
                break;
            }
            if ($action === 'post') {
                $id = intval($input['id'] ?? 0);
                if (!$id) { http_response_code(400); echo json_encode(['success' => false, 'message' => 'id required']); break; }
                execute_query($pdo, "UPDATE journal_entries SET posted = 1 WHERE id = ?", [$id]);
                echo json_encode(['success' => true]);
                break;
            }
            break;
        case 'transactions':
            $action = $_GET['action'] ?? 'getAll';
            $perm_code = map_action_to_perm($action);
            if ($perm_code) {
                check_permission_or_die($pdo, 'transactions', $perm_code);
            }
            if ($action === 'getByRelated') {
                $related_type = $_GET['related_to_type'] ?? '';
                $related_id = intval($_GET['related_to_id'] ?? 0);
                // If client requests 'rep', map to allowed enum value for this installation
                if ($related_type === 'rep') {
                    $related_type = pick_allowed_enum($pdo, 'transactions', 'related_to_type', 'rep', ['rep','employee','none']);
                }
                $stmt = execute_query($pdo, "SELECT * FROM transactions WHERE related_to_type = ? AND related_to_id = ? ORDER BY transaction_date DESC", [$related_type, $related_id]);
                echo json_encode(['success' => true, 'data' => $stmt->fetchAll(PDO::FETCH_ASSOC)]);
            } elseif ($action === 'getByTreasuryId') {
                $id = intval($_GET['id'] ?? 0);
                if (!$id) { 
                    echo json_encode(['success'=>false,'message'=>'Treasury ID required']); break; 
                }
                // Optional date filters (YYYY-MM-DD)
                $start_date = isset($_GET['start_date']) && $_GET['start_date'] !== '' ? $_GET['start_date'] : null;
                $end_date = isset($_GET['end_date']) && $_GET['end_date'] !== '' ? $_GET['end_date'] : null;

                $sql = "SELECT * FROM transactions WHERE treasury_id = ?";
                $params = [$id];
                if ($start_date && $end_date) {
                    $sql .= " AND DATE(transaction_date) BETWEEN ? AND ?";
                    $params[] = $start_date;
                    $params[] = $end_date;
                } elseif ($start_date) {
                    $sql .= " AND DATE(transaction_date) >= ?";
                    $params[] = $start_date;
                } elseif ($end_date) {
                    $sql .= " AND DATE(transaction_date) <= ?";
                    $params[] = $end_date;
                }
                $sql .= " ORDER BY transaction_date DESC";
                $stmt = execute_query($pdo, $sql, $params);
                echo json_encode(['success' => true, 'data' => $stmt->fetchAll(PDO::FETCH_ASSOC)]);
            } elseif ($action === 'getById') {
                $id = intval($_GET['id'] ?? 0);
                if (!$id) { echo json_encode(['success'=>false,'message'=>'ID required']); break; }
                $stmt = execute_query($pdo, "SELECT * FROM transactions WHERE id = ?", [$id]);
                echo json_encode(['success' => true, 'data' => $stmt->fetch(PDO::FETCH_ASSOC)]);
            } elseif ($action === 'createTransfer') {
                $from_treasury_id = intval($input['from_treasury_id'] ?? 0);
                $to_treasury_id = intval($input['to_treasury_id'] ?? 0);
                $amount = isset($input['amount']) ? floatval($input['amount']) : 0;
                $notes = $input['notes'] ?? 'تحويل بين الخزائن';

                if (!$from_treasury_id || !$to_treasury_id || $amount <= 0 || $from_treasury_id === $to_treasury_id) {
                    http_response_code(400);
                    echo json_encode(['success' => false, 'message' => 'بيانات التحويل غير صحيحة أو غير مكتملة.']);
                    return;
                }

                $txBegan = false;
                try {
                    $txBegan = $pdo->beginTransaction();
                } catch (Exception $e) {
                    $txBegan = false;
                }
                try {
                    // 1. Check balance and lock source treasury
                    $treasuryStmt = execute_query($pdo, "SELECT current_balance FROM treasuries WHERE id = ? FOR UPDATE", [$from_treasury_id]);
                    $from_treasury = $treasuryStmt->fetch(PDO::FETCH_ASSOC);
                    if (!$from_treasury || $from_treasury['current_balance'] < $amount) {
                        if ($pdo->inTransaction()) $pdo->rollBack();
                        http_response_code(400);
                        echo json_encode(['success' => false, 'message' => 'رصيد الخزينة المصدر غير كافٍ.']);
                        return;
                    }

                    execute_query($pdo, "INSERT INTO transactions (type, treasury_id, amount, transaction_date, details) VALUES (?, ?, ?, NOW(), ?)", ['transfer_out', $from_treasury_id, -$amount, json_encode(['notes' => $notes, 'transfer_to' => $to_treasury_id])]);
                    execute_query($pdo, "INSERT INTO transactions (type, treasury_id, amount, transaction_date, details) VALUES (?, ?, ?, NOW(), ?)", ['transfer_in', $to_treasury_id, $amount, json_encode(['notes' => $notes, 'transfer_from' => $from_treasury_id])]);
                    execute_query($pdo, "UPDATE treasuries SET current_balance = current_balance - ? WHERE id = ?", [$amount, $from_treasury_id]);
                    execute_query($pdo, "UPDATE treasuries SET current_balance = current_balance + ? WHERE id = ?", [$amount, $to_treasury_id]);

                    // Journal entry for transfer (cash to cash)
                    $cashAccount = finance_get_account_id_by_code($pdo, '1000') ?: finance_get_account_id_by_type($pdo, 'asset');
                    if ($cashAccount) {
                        finance_create_journal_entry(
                            $pdo,
                            date('Y-m-d'),
                            $notes,
                            'transfer',
                            null,
                            true,
                            [
                                ['account_id' => $cashAccount, 'debit' => $amount, 'credit' => 0, 'memo' => 'تحويل وارد'],
                                ['account_id' => $cashAccount, 'debit' => 0, 'credit' => $amount, 'memo' => 'تحويل صادر']
                            ]
                        );
                    }

                    $pdo->commit();
                    echo json_encode(['success' => true, 'message' => 'تم التحويل بنجاح.']);
                } catch (Exception $e) {
                    if ($pdo->inTransaction()) $pdo->rollBack();
                    http_response_code(500);
                    echo json_encode(['success' => false, 'message' => 'فشل التحويل: ' . $e->getMessage()]);
                }
            } elseif ($action === 'create') {
                // Create transaction record (payments, fines, etc.)
                $type = $input['type'] ?? null;
                $related = $input['related_to_type'] ?? ($input['relatedToType'] ?? null);
                $relatedId = isset($input['related_to_id']) ? intval($input['related_to_id']) : (isset($input['relatedToId']) ? intval($input['relatedToId']) : 0);
                $amount = isset($input['amount']) ? floatval($input['amount']) : 0;
                $treasuryId = isset($input['treasuryId']) ? intval($input['treasuryId']) : (isset($input['treasury_id']) ? intval($input['treasury_id']) : 0);
                $warehouseId = isset($input['warehouseId']) ? intval($input['warehouseId']) : (isset($input['warehouse_id']) ? intval($input['warehouse_id']) : 0);
                $notes = $input['notes'] ?? null;
                $details = isset($input['details']) ? $input['details'] : [];
                $createdBy = isset($_SESSION['user_id']) ? intval($_SESSION['user_id']) : null;
                if (is_string($details)) {
                    try { $details = json_decode($details, true) ?? []; } catch (Exception $e) { $details = []; }
                }
                if ($notes) {
                    $details['notes'] = $notes;
                }
                $direction = isset($input['direction']) ? $input['direction'] : null; // 'in' (company received) | 'out' (company paid)

                // Special-case: insurance deposit for representatives should always go to the fixed insurance treasury,
                // and should not be blocked by user's locked default treasury setting.
                $isInsuranceDeposit = (is_array($details) && isset($details['subtype']) && $details['subtype'] === 'rep_insurance_deposit');

                $resolveInsuranceTreasuryId = function() use ($pdo) {
                    try {
                        if (!table_exists($pdo, 'treasuries') || !column_exists($pdo, 'treasuries', 'name')) return null;
                        $id = execute_query($pdo, "SELECT id FROM treasuries WHERE name = ? LIMIT 1", ['تأمين المناديب'])->fetchColumn();
                        if ($id) return intval($id);

                        // Create if missing (best-effort)
                        $hasIsFixed = column_exists($pdo, 'treasuries', 'is_fixed');
                        $hasCreatedAt = column_exists($pdo, 'treasuries', 'created_at');
                        if ($hasIsFixed && $hasCreatedAt) {
                            execute_query($pdo, "INSERT INTO treasuries (name, is_fixed, created_at) VALUES (?, 1, NOW())", ['تأمين المناديب']);
                        } elseif ($hasIsFixed && !$hasCreatedAt) {
                            execute_query($pdo, "INSERT INTO treasuries (name, is_fixed) VALUES (?, 1)", ['تأمين المناديب']);
                        } elseif (!$hasIsFixed && $hasCreatedAt) {
                            execute_query($pdo, "INSERT INTO treasuries (name, created_at) VALUES (?, NOW())", ['تأمين المناديب']);
                        } else {
                            execute_query($pdo, "INSERT INTO treasuries (name) VALUES (?)", ['تأمين المناديب']);
                        }
                        $newId = execute_query($pdo, "SELECT id FROM treasuries WHERE name = ? LIMIT 1", ['تأمين المناديب'])->fetchColumn();
                        return $newId ? intval($newId) : null;
                    } catch (Exception $e) {
                        return null;
                    }
                };

                if ($isInsuranceDeposit) {
                    $insTid = $resolveInsuranceTreasuryId();
                    if ($insTid) {
                        if (!$treasuryId) $treasuryId = $insTid;
                        // Force insurance treasury only for this subtype
                        if ($treasuryId !== $insTid) {
                            http_response_code(400);
                            echo json_encode(['success' => false, 'message' => 'لا يمكن إيداع التأمين إلا في خزينة "تأمين المناديب".']);
                            return;
                        }
                    }
                }
                // Apply user defaults and enforce locks: if a user has defaults set and cannot change them,
                // either apply the default when omitted, or reject if a different value was provided.
                $defaults = get_user_defaults($pdo);
                if ($defaults) {
                    // Treasury
                    $defTid = isset($defaults['default_treasury_id']) ? intval($defaults['default_treasury_id']) : null;
                    $canChangeT = isset($defaults['can_change_treasury']) ? boolval($defaults['can_change_treasury']) : true;
                    if (!$canChangeT && $defTid) {
                        // Allow the fixed insurance treasury for rep insurance deposits
                        if ($isInsuranceDeposit) {
                            $insTid = $resolveInsuranceTreasuryId();
                            if ($insTid) {
                                if (!$treasuryId) $treasuryId = $insTid;
                                if ($treasuryId !== $insTid) {
                                    http_response_code(400);
                                    echo json_encode(['success' => false, 'message' => 'الخزينة مقفلة للمستخدم الحالي ولا يمكن تغييرها (إلا خزينة التأمين).']);
                                    return;
                                }
                            }
                        } else {
                            if ($treasuryId && $treasuryId !== $defTid) {
                                if ($pdo->inTransaction()) $pdo->rollBack();
                                http_response_code(400);
                                echo json_encode(['success' => false, 'message' => 'الخزينة مقفلة للمستخدم الحالي ولا يمكن تغييرها.']);
                                return;
                            }
                            if (!$treasuryId) $treasuryId = $defTid;
                        }
                    } else {
                        // if user can change but has a default, prefill when not provided
                        if (!$treasuryId && $defTid) $treasuryId = $defTid;
                    }

                    // Warehouse
                    $defWid = isset($defaults['default_warehouse_id']) ? intval($defaults['default_warehouse_id']) : null;
                    $canChangeW = isset($defaults['can_change_warehouse']) ? boolval($defaults['can_change_warehouse']) : true;
                    if (!$canChangeW && $defWid) {
                        if ($warehouseId && $warehouseId !== $defWid) {
                            if ($pdo->inTransaction()) $pdo->rollBack();
                            http_response_code(400);
                            echo json_encode(['success' => false, 'message' => 'المستودع مقفل للمستخدم الحالي ولا يمكن تغييره.']);
                            return;
                        }
                        if (!$warehouseId) $warehouseId = $defWid;
                    } else {
                        if (!$warehouseId && $defWid) $warehouseId = $defWid;
                    }
                }

                $pdo->beginTransaction();
                try {
                    if ($type === 'deposit' || $type === 'expense' || $type === 'supplier_payment') {
                        $details['subtype'] = $type;
                        if ($type === 'deposit') $type = 'payment_in';
                        else $type = 'payment_out';
                    }
                    $typeAllowed = pick_allowed_enum($pdo, 'transactions', 'type', $type ?? 'payment', ['payment_in','payment_out','sale','transfer','rep_payment_in','rep_payment_out','rep_settlement']);
                    // Important: if the DB enum lacks 'rep', do NOT fall back to 'customer'/'supplier'.
                    // Reps are stored in users and their balances are computed using the rep/employee/none mapping.
                    if ($related === 'rep') {
                        $relAllowed = pick_allowed_enum($pdo, 'transactions', 'related_to_type', 'rep', ['rep','employee','none']);
                    } elseif ($related === 'employee') {
                        $relAllowed = pick_allowed_enum($pdo, 'transactions', 'related_to_type', 'employee', ['employee','rep','none']);
                    } else {
                        $relAllowed = $related
                            ? pick_allowed_enum($pdo, 'transactions', 'related_to_type', $related, ['rep','customer','supplier','employee','none'])
                            : pick_allowed_enum($pdo, 'transactions', 'related_to_type', 'rep', ['rep','employee','none']);
                    }
                    
                    // Adjust sign for rep-related transactions based on direction
                    $txAmount = $amount; // Default to signed amount from input
                    if (isset($input['direction'])) { // If direction is explicitly provided, use old logic but make it robust
                        if (in_array($relAllowed, ['rep','employee'])) {
                            $txAmount = ($direction === 'out') ? -abs($amount) : abs($amount);
                        } else {
                            $txAmount = ($direction === 'in') ? abs($amount) : -abs($amount);
                        }
                    }

                    // Consignment rules: certain rep transactions are accounting-only (no treasury impact)
                    // and have enforced sign conventions.
                    if ($relAllowed === 'rep' && in_array($typeAllowed, ['rep_assignment', 'rep_return_credit'], true)) {
                        $treasuryId = 0;
                        if ($typeAllowed === 'rep_assignment') {
                            $txAmount = -abs($amount);
                        } elseif ($typeAllowed === 'rep_return_credit') {
                            $txAmount = abs($amount);
                        }
                    }

                        // Enforce presence of treasury and reason for financial transactions
                        $details_reason = null;
                        if (is_array($details)) {
                            $details_reason = $details['reason'] ?? $details['notes'] ?? null;
                        }

                        $financial_types = ['payment_in','payment_out','deposit','expense','supplier_payment','rep_payment_in','rep_payment_out','rep_assignment','rep_settlement','transfer','transfer_in','transfer_out','payment'];
                        // determine if the intended transaction is financial-like
                        $isFinancial = false;
                        $checkType = $typeAllowed ?? $type;
                        if ($checkType && in_array($checkType, $financial_types)) $isFinancial = true;
                        // also consider subtype set in details
                        if (!$isFinancial && isset($details['subtype']) && in_array($details['subtype'], $financial_types)) $isFinancial = true;

                        // Rep consignment accounting-only types should never require a treasury.
                        if ($checkType && in_array($checkType, ['rep_assignment', 'rep_return_credit'], true)) {
                            $isFinancial = false;
                        }

                        // Allow certain internal rep adjustments to be recorded without affecting treasuries.
                        // These are used for accounting-only moves such as adding a penalty to a rep's debt.
                        if ($isFinancial && is_array($details) && isset($details['subtype']) && in_array($details['subtype'], ['rep_penalty','rep_insurance_apply'])) {
                            $isFinancial = false;
                        }

                        if ($isFinancial) {
                            if (!$treasuryId) {
                                if ($pdo->inTransaction()) $pdo->rollBack();
                                http_response_code(400);
                                echo json_encode(['success' => false, 'message' => 'يجب اختيار الخزينة في المعاملات المالية.']);
                                return;
                            }
                            if (empty($details_reason)) {
                                if ($pdo->inTransaction()) $pdo->rollBack();
                                http_response_code(400);
                                echo json_encode(['success' => false, 'message' => 'يرجى تحديد سبب/بيان المعاملة في حقل "notes" أو details.reason.']);
                                return;
                            }
                        }

                        // If treasury is involved and transaction is outgoing, check balance
                        if ($treasuryId && $txAmount < 0) {
                            $treasuryStmt = execute_query($pdo, "SELECT current_balance FROM treasuries WHERE id = ? FOR UPDATE", [$treasuryId]);
                            $treasury = $treasuryStmt->fetch(PDO::FETCH_ASSOC);
                            $curBal = $treasury ? floatval($treasury['current_balance']) : 0;
                            $need = abs($txAmount);
                            if (!$treasury || $curBal < $need) {
                                if ($pdo->inTransaction()) $pdo->rollBack();
                                http_response_code(400);
                                echo json_encode(['success' => false, 'message' => 'رصيد الخزينة غير كافٍ لإتمام العملية. (الخزينة #' . $treasuryId . ' | المطلوب: ' . $need . ' | الرصيد: ' . $curBal . ')']);
                                return;
                            }
                        }
                    // Stamp supplier balance before payment from stored supplier totals (authoritative source).
                    if ($relatedId && $relAllowed === 'supplier' && is_array($details) && isset($details['subtype']) && strtolower((string)$details['subtype']) === 'supplier_payment') {
                        $supplierBeforeRow = execute_query($pdo, "SELECT (COALESCE(total_credit,0) - COALESCE(total_debit,0)) AS balance_before FROM suppliers WHERE id = ? FOR UPDATE", [$relatedId])->fetch(PDO::FETCH_ASSOC);
                        $details['supplier_balance_before'] = $supplierBeforeRow ? floatval($supplierBeforeRow['balance_before'] ?? 0) : 0;
                    }

                    // Allow optional title/memo fields to be persisted when the DB has matching columns.
                    $title = $input['title'] ?? $input['memo'] ?? ($details['title'] ?? null);
                    $memoField = $input['memo'] ?? $details['memo'] ?? null;
                    // Ensure details contains notes/title for older clients
                    if ($title && is_array($details)) $details['title'] = $details['title'] ?? $title;
                    if ($memoField && is_array($details)) $details['memo'] = $details['memo'] ?? $memoField;

                    // Build INSERT dynamically if DB columns exist
                    $cols = ['type','warehouse_id','treasury_id','related_to_type','related_to_id','amount','transaction_date','details'];
                    $placeholders = ['?','?','?','?','?','?','NOW()', '?'];
                    $values = [$typeAllowed, $warehouseId ?: null, $treasuryId ?: null, $relAllowed, $relatedId ?: null, $txAmount, json_encode($details)];

                    if (column_exists($pdo, 'transactions', 'title') && $title !== null) {
                        array_splice($cols, 1, 0, 'title');
                        array_splice($placeholders, 1, 0, '?');
                        array_splice($values, 1, 0, $title);
                    }
                    if (column_exists($pdo, 'transactions', 'memo') && $memoField !== null) {
                        // place memo after title/warehouse
                        $insertPos = 2; // after title (if present) or after type
                        array_splice($cols, $insertPos, 0, 'memo');
                        array_splice($placeholders, $insertPos, 0, '?');
                        array_splice($values, $insertPos, 0, $memoField);
                    }
                    if (column_exists($pdo, 'transactions', 'created_by') && $createdBy) {
                        $cols[] = 'created_by';
                        $placeholders[] = '?';
                        $values[] = $createdBy;
                    }

                    $sql = "INSERT INTO transactions (" . implode(', ', $cols) . ") VALUES (" . implode(', ', $placeholders) . ")";
                    execute_query($pdo, $sql, $values);
                    $txId = $pdo->lastInsertId();
                    audit_log($pdo, 'transactions', 'create', $txId, json_encode(['type' => $typeAllowed, 'amount' => $txAmount]));
                    $memo = is_array($details) ? ($details['notes'] ?? $details['note'] ?? null) : null;
                    if (function_exists('finance_auto_post_transaction')) {
                        finance_auto_post_transaction($pdo, $txId, $typeAllowed, $txAmount, $relAllowed, $memo);
                    }
                    // Update treasury balance
                    if ($treasuryId && $txAmount != 0) {
                        execute_query($pdo, "UPDATE treasuries SET current_balance = current_balance + ? WHERE id = ?", [$txAmount, $treasuryId]);
                    }
                    // Update related entity's balance if applicable (e.g., user/rep)
                    if ($relatedId && in_array($relAllowed, ['rep', 'employee'])) {
                        // Assumption: reps are stored in the 'users' table.
                        if (column_exists($pdo, 'users', 'balance')) {
                           execute_query($pdo, "UPDATE users SET balance = balance + ? WHERE id = ?", [$txAmount, $relatedId]);
                        }
                    }
                    // Update supplier balance when a payment is made to a supplier
                    // Supplier balance = total_credit - total_debit; payment increases total_credit
                    if ($relatedId && $relAllowed === 'supplier') {
                        $txSubtype = '';
                        if (is_array($details) && isset($details['subtype'])) {
                            $txSubtype = strtolower((string)$details['subtype']);
                        }

                        if ($txSubtype === 'supplier_payment') {
                            $supplierBefore = (is_array($details) && isset($details['supplier_balance_before']) && is_numeric($details['supplier_balance_before']))
                                ? floatval($details['supplier_balance_before'])
                                : null;
                            $payAbs = abs($txAmount);

                            // Move stored supplier balance toward zero based on balance BEFORE this payment.
                            if ($supplierBefore !== null && $supplierBefore > 0) {
                                execute_query($pdo, "UPDATE suppliers SET total_debit = total_debit + ? WHERE id = ?", [$payAbs, $relatedId]);
                            } else {
                                execute_query($pdo, "UPDATE suppliers SET total_credit = total_credit + ? WHERE id = ?", [$payAbs, $relatedId]);
                            }
                        } else {
                            if ($txAmount < 0) {
                                // Outgoing payment to supplier → increases total_credit (reduces debt or adds credit)
                                execute_query($pdo, "UPDATE suppliers SET total_credit = total_credit + ? WHERE id = ?", [abs($txAmount), $relatedId]);
                            } elseif ($txAmount > 0) {
                                // Incoming amount from supplier (rare, e.g. refund) → increases total_debit
                                execute_query($pdo, "UPDATE suppliers SET total_debit = total_debit + ? WHERE id = ?", [$txAmount, $relatedId]);
                            }
                        }
                    }
                    // Update customer balance when payment received/made
                    if ($relatedId && $relAllowed === 'customer') {
                        if ($txAmount > 0) {
                            // Payment received from customer → increases total_credit
                            execute_query($pdo, "UPDATE customers SET total_credit = total_credit + ? WHERE id = ?", [$txAmount, $relatedId]);
                        } elseif ($txAmount < 0) {
                            // Refund to customer → increases total_debit
                            execute_query($pdo, "UPDATE customers SET total_debit = total_debit + ? WHERE id = ?", [abs($txAmount), $relatedId]);
                        }
                    }

                    // Commit only when a transaction is actually active.
                    // Some environments/drivers may return false from beginTransaction() without throwing,
                    // or a nested helper may end the transaction.
                    if ($pdo->inTransaction()) {
                        $pdo->commit();
                    }
                    echo json_encode(['success' => true, 'transaction_id' => $txId]);
                } catch (Exception $e) {
                    if ($pdo->inTransaction()) $pdo->rollBack();
                    http_response_code(500);
                    echo json_encode(['success' => false, 'message' => 'Failed to create transaction: ' . $e->getMessage()]);
                }
            } else {
                $start_date = isset($_GET['start_date']) && $_GET['start_date'] !== '' ? $_GET['start_date'] : null;
                $end_date   = isset($_GET['end_date'])   && $_GET['end_date']   !== '' ? $_GET['end_date']   : null;
                $filter_treasury = isset($_GET['treasury_id']) && $_GET['treasury_id'] !== '' ? intval($_GET['treasury_id']) : null;

                $hasTreasuriesTable = true;
                $hasAuditLogs = true;
                try { $pdo->query("SELECT 1 FROM treasuries LIMIT 1"); } catch(Exception $e) { $hasTreasuriesTable = false; }
                try { $pdo->query("SELECT 1 FROM audit_logs LIMIT 1"); } catch(Exception $e) { $hasAuditLogs = false; }

                $hasRepresentatives = true;
                try { $pdo->query("SELECT 1 FROM representatives LIMIT 1"); } catch(Exception $e) { $hasRepresentatives = false; }
                $repLookup = $hasRepresentatives
                    ? "COALESCE((SELECT r.name FROM representatives r WHERE r.id = t.related_to_id LIMIT 1),(SELECT u.name FROM users u WHERE u.id = t.related_to_id LIMIT 1))"
                    : "(SELECT u.name FROM users u WHERE u.id = t.related_to_id LIMIT 1)";
                $relatedNameExpr = "CASE t.related_to_type
                    WHEN 'customer'  THEN (SELECT c.name FROM customers c WHERE c.id = t.related_to_id LIMIT 1)
                    WHEN 'supplier'  THEN (SELECT s.name FROM suppliers s WHERE s.id = t.related_to_id LIMIT 1)
                    WHEN 'employee'  THEN COALESCE((SELECT e.name FROM employees e WHERE e.id = t.related_to_id LIMIT 1),{$repLookup})
                    WHEN 'rep'       THEN {$repLookup}
                    ELSE NULL END";

                $createdByExpr = $hasAuditLogs
                    ? "(SELECT u2.name FROM audit_logs al JOIN users u2 ON u2.id = al.user_id WHERE al.module='transactions' AND al.action='create' AND al.record_id=t.id ORDER BY al.id ASC LIMIT 1)"
                    : "NULL";

                $sql = "SELECT t.*, tr.name AS treasury_name, ($relatedNameExpr) AS related_name, ($createdByExpr) AS created_by_name
                    FROM transactions t
                    LEFT JOIN treasuries tr ON tr.id = t.treasury_id";

                $conditions = [];
                $params = [];
                if ($start_date) { $conditions[] = "DATE(t.transaction_date) >= ?"; $params[] = $start_date; }
                if ($end_date)   { $conditions[] = "DATE(t.transaction_date) <= ?"; $params[] = $end_date; }
                if ($filter_treasury) { $conditions[] = "t.treasury_id = ?"; $params[] = $filter_treasury; }
                if ($conditions) $sql .= " WHERE " . implode(" AND ", $conditions);
                $sql .= " ORDER BY t.transaction_date DESC, t.id DESC LIMIT 500";
                $stmt = $params ? execute_query($pdo, $sql, $params) : $pdo->query($sql);
                echo json_encode(['success' => true, 'data' => $stmt->fetchAll(PDO::FETCH_ASSOC)]);
            }
            break;
    case 'product_movements':
        $action = $_GET['action'] ?? 'getAll';
        if ($action === 'getByProduct') {
            $pid = intval($_GET['product_id'] ?? $_GET['id'] ?? 0);
            $stmt = execute_query($pdo, "SELECT id, product_id, warehouse_id, movement_type, quantity_change, previous_quantity, new_quantity, reference_id, reference_type, notes, created_by, created_at FROM product_movements WHERE product_id = ? ORDER BY created_at DESC", [$pid]);
            echo json_encode(['success' => true, 'data' => $stmt->fetchAll(PDO::FETCH_ASSOC)]);
        } else {
            $stmt = $pdo->query("SELECT * FROM product_movements ORDER BY created_at DESC");
            echo json_encode(['success' => true, 'data' => $stmt->fetchAll(PDO::FETCH_ASSOC)]);
        }
        break;
    case 'sales':
        $action = $_GET['action'] ?? 'create';
        if ($action === 'getRepDailyStats') {
            $repId = intval($_GET['rep_id'] ?? 0);
            if (!$repId) {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'rep_id required']);
                break;
            }

            try {
                // Determine the best timestamp column we can rely on for daily grouping.
                $dateCol = null;
                if (column_exists($pdo, 'orders', 'updated_at')) $dateCol = 'updated_at';
                elseif (column_exists($pdo, 'orders', 'created_at')) $dateCol = 'created_at';
                elseif (column_exists($pdo, 'orders', 'date')) $dateCol = 'date';

                $orderItemsHasTotal = column_exists($pdo, 'order_items', 'total_price');
                $itemsExpr = $orderItemsHasTotal ? 'SUM(oi.total_price)' : 'SUM(oi.quantity * oi.price_per_unit)';
                $subTotals = "(SELECT oi.order_id, COALESCE($itemsExpr,0) AS total_value FROM order_items oi GROUP BY oi.order_id)";
                // pieces per order (sum of quantities)
                $subPieces = "(SELECT oi.order_id, COALESCE(SUM(oi.quantity),0) AS pieces FROM order_items oi GROUP BY oi.order_id)";

                $whereDate = '';
                // Allow caller to request stats for a specific date (YYYY-MM-DD) or a date range via 'from' and 'to'.
                // Fall back to CURDATE() when not provided.
                $reqDate = isset($_GET['date']) ? trim($_GET['date']) : null;
                $reqFrom = isset($_GET['from']) ? trim($_GET['from']) : null;
                $reqTo = isset($_GET['to']) ? trim($_GET['to']) : null;
                if ($dateCol) {
                    // If both from & to provided and valid, use them as inclusive-from, exclusive-to (to +1 day)
                    if ($reqFrom && $reqTo && preg_match('/^\d{4}-\d{2}-\d{2}$/', $reqFrom) && preg_match('/^\d{4}-\d{2}-\d{2}$/', $reqTo)) {
                        $safeFrom = $reqFrom;
                        $safeTo = $reqTo;
                        $whereDate = " AND o.`$dateCol` >= '$safeFrom 00:00:00' AND o.`$dateCol` < DATE_ADD('$safeTo', INTERVAL 1 DAY)";
                    } elseif ($reqDate && preg_match('/^\d{4}-\d{2}-\d{2}$/', $reqDate)) {
                        // Backwards-compatible: single date requested
                        $safeDate = $reqDate; // validated by regex
                        $whereDate = " AND o.`$dateCol` >= '$safeDate 00:00:00' AND o.`$dateCol` < DATE_ADD('$safeDate', INTERVAL 1 DAY)";
                    } else {
                        // Default to today
                        $whereDate = " AND o.`$dateCol` >= CURDATE() AND o.`$dateCol` < DATE_ADD(CURDATE(), INTERVAL 1 DAY)";
                    }
                }

                // Aggregate orders by rep and also include status-history entries so that
                // orders which had their `rep_id` cleared after delivery/return are still
                // attributed to the rep who performed the status change.
                // Build a safe date predicate for history table (uses its `created_at`).
                $whereHist = '';
                if ($reqFrom && $reqTo && preg_match('/^\d{4}-\d{2}-\d{2}$/', $reqFrom) && preg_match('/^\d{4}-\d{2}-\d{2}$/', $reqTo)) {
                    $whereHist = " AND h.created_at >= '$reqFrom 00:00:00' AND h.created_at < DATE_ADD('$reqTo', INTERVAL 1 DAY)";
                } elseif ($reqDate && preg_match('/^\d{4}-\d{2}-\d{2}$/', $reqDate)) {
                    $whereHist = " AND h.created_at >= '$reqDate 00:00:00' AND h.created_at < DATE_ADD('$reqDate', INTERVAL 1 DAY)";
                } else {
                    $whereHist = " AND h.created_at >= CURDATE() AND h.created_at < DATE_ADD(CURDATE(), INTERVAL 1 DAY)";
                }

                // Helper: build a union-based aggregation that counts distinct order ids
                // coming either from the orders table (current rep/status rows) or from
                // order_status_history (status events performed by the rep).
                $useHistory = table_exists($pdo, 'order_status_history') && column_exists($pdo, 'order_status_history', 'created_at');

                if ($useHistory) {
                    // Use UNION to avoid double-counting an order that appears in both sources.
                    // Join history back to orders so we can match rep attribution via:
                    //   - h.rep_id (history now records who had the order before status change), AND
                    //   - o2.rep_id (orders that still have rep_id set, not yet cleared)
                    $sqlUnion = "SELECT x.order_id, x.total_value, x.pieces FROM (\n" .
                        "  SELECT o.id as order_id, COALESCE(t.total_value,0) as total_value, COALESCE(p.pieces,0) as pieces\n" .
                        "  FROM orders o LEFT JOIN $subTotals t ON t.order_id = o.id LEFT JOIN $subPieces p ON p.order_id = o.id\n" .
                        "  WHERE o.rep_id = ? AND o.status = ? $whereDate\n" .
                        "  UNION\n" .
                        "  SELECT h.order_id, COALESCE(t2.total_value,0) as total_value, COALESCE(p2.pieces,0) as pieces\n" .
                        "  FROM order_status_history h\n" .
                        "  JOIN orders o2 ON o2.id = h.order_id\n" .
                        "  LEFT JOIN $subTotals t2 ON t2.order_id = h.order_id LEFT JOIN $subPieces p2 ON p2.order_id = h.order_id\n" .
                        "  WHERE (h.rep_id = ? OR o2.rep_id = ?) AND h.status = ? $whereHist\n" .
                        ") x";

                    $deliveredStmt = execute_query($pdo, "SELECT COUNT(DISTINCT order_id) AS cnt, COALESCE(SUM(total_value),0) AS val, COALESCE(SUM(pieces),0) AS pieces FROM ($sqlUnion) u", [$repId, 'delivered', $repId, $repId, 'delivered']);
                    $del = $deliveredStmt->fetch(PDO::FETCH_ASSOC) ?: [];

                    $returnedStmt = execute_query($pdo, "SELECT COUNT(DISTINCT order_id) AS cnt, COALESCE(SUM(total_value),0) AS val, COALESCE(SUM(pieces),0) AS pieces FROM ($sqlUnion) u", [$repId, 'returned', $repId, $repId, 'returned']);
                    $ret = $returnedStmt->fetch(PDO::FETCH_ASSOC) ?: [];
                } else {
                    // Fallback when history table missing: use current orders only (legacy behavior)
                    $sqlAgg = "SELECT COUNT(DISTINCT o.id) AS cnt, COALESCE(SUM(t.total_value), 0) AS val\n                           FROM orders o\n                           LEFT JOIN $subTotals t ON t.order_id = o.id\n                           WHERE o.rep_id = ? AND o.status = ? $whereDate";

                    $deliveredStmt = execute_query($pdo, $sqlAgg, [$repId, 'delivered']);
                    $del = $deliveredStmt->fetch(PDO::FETCH_ASSOC) ?: [];

                    $returnedStmt = execute_query($pdo, $sqlAgg, [$repId, 'returned']);
                    $ret = $returnedStmt->fetch(PDO::FETCH_ASSOC) ?: [];
                }

                echo json_encode([
                    'success' => true,
                    'data' => [
                        'deliveredCount' => intval($del['cnt'] ?? 0),
                        'deliveredValue' => floatval($del['val'] ?? 0),
                        'returnedCount' => intval($ret['cnt'] ?? 0),
                        'returnedValue' => floatval($ret['val'] ?? 0)
                    ]
                ]);
            } catch (Exception $e) {
                http_response_code(500);
                echo json_encode(['success' => false, 'message' => 'Failed to load rep daily stats: ' . $e->getMessage()]);
            }
            break;
        }

        // Fetch full order details by IDs — used by journal print / waybills
        // Exposed here so it works without needing 'orders' module permissions.
        if ($action === 'getOrdersByIds') {
            try {
                $result = nexus_fetch_orders_by_ids($pdo, $_GET['ids'] ?? '');
                echo json_encode(['success' => true, 'data' => $result]);
            } catch (Exception $e) {
                http_response_code(500);
                echo json_encode(['success' => false, 'message' => 'getOrdersByIds error: ' . $e->getMessage()]);
            }
            break;
        }

        if ($action === 'getConfirmationAssignments') {
            try {
                ensure_order_confirmation_assignments_table($pdo);
                confirmation_clear_old_assignments($pdo);

                $repId = intval($_GET['rep_id'] ?? 0);
                $where = ["oca.status IN ('assigned','cancelled')", 'o.id IS NOT NULL', 'DATE(oca.assigned_at) = CURDATE()'];
                $params = [];
                if ($repId > 0) {
                    $where[] = 'oca.rep_id = ?';
                    $params[] = $repId;
                }

                $sql = "SELECT oca.*, COALESCE(NULLIF(TRIM(u.name), ''), CONCAT('مندوب #', oca.rep_id)) AS rep_name
                        FROM order_confirmation_assignments oca
                        LEFT JOIN users u ON u.id = oca.rep_id
                        LEFT JOIN orders o ON o.id = oca.order_id
                        WHERE " . implode(' AND ', $where) . "
                        ORDER BY oca.assigned_at DESC, oca.id DESC";
                $rows = execute_query($pdo, $sql, $params)->fetchAll(PDO::FETCH_ASSOC);

                $orderIds = array_values(array_filter(array_map('intval', array_column($rows, 'order_id'))));
                $ordersById = [];
                if (!empty($orderIds)) {
                    $orderRows = nexus_fetch_orders_by_ids($pdo, implode(',', $orderIds));
                    foreach ($orderRows as $orderRow) {
                        $ordersById[intval($orderRow['id'] ?? 0)] = $orderRow;
                    }
                }

                $data = [];
                foreach ($rows as $row) {
                    $orderId = intval($row['order_id'] ?? 0);
                    $data[] = [
                        'id' => intval($row['id'] ?? 0),
                        'order_id' => $orderId,
                        'rep_id' => intval($row['rep_id'] ?? 0),
                        'rep_name' => $row['rep_name'] ?? '',
                        'notes' => $row['notes'] ?? '',
                        'status' => $row['status'] ?? 'assigned',
                        'assigned_at' => $row['assigned_at'] ?? null,
                        'updated_at' => $row['updated_at'] ?? null,
                        'order' => $ordersById[$orderId] ?? ['id' => $orderId]
                    ];
                }

                echo json_encode(['success' => true, 'data' => $data]);
            } catch (Exception $e) {
                http_response_code(500);
                echo json_encode(['success' => false, 'message' => 'Failed to load confirmation assignments: ' . $e->getMessage()]);
            }
            break;
        }

        if ($action === 'getConfirmationRepSummary') {
            try {
                ensure_order_confirmation_assignments_table($pdo);
                confirmation_clear_old_assignments($pdo);
                $repRows = execute_query(
                    $pdo,
                    "SELECT id, name, phone, role
                     FROM users
                     WHERE role = 'representative'
                     ORDER BY name ASC"
                )->fetchAll(PDO::FETCH_ASSOC);

                $counts = [];
                $countRows = execute_query(
                    $pdo,
                    "SELECT oca.rep_id, COUNT(*) AS orders_count
                     FROM order_confirmation_assignments oca
                     JOIN orders o ON o.id = oca.order_id
                     WHERE oca.status = 'assigned'
                       AND DATE(oca.assigned_at) = CURDATE()
                       AND o.status IN ('pending','returned','postponed')
                     GROUP BY oca.rep_id"
                )->fetchAll(PDO::FETCH_ASSOC);
                foreach ($countRows as $countRow) {
                    $counts[intval($countRow['rep_id'] ?? 0)] = intval($countRow['orders_count'] ?? 0);
                }

                $data = [];
                foreach ($repRows as $repRow) {
                    $repId = intval($repRow['id'] ?? 0);
                    $data[] = [
                        'id' => $repId,
                        'name' => $repRow['name'] ?? '',
                        'phone' => $repRow['phone'] ?? '',
                        'role' => $repRow['role'] ?? '',
                        'orders_count' => intval($counts[$repId] ?? 0),
                    ];
                }

                echo json_encode(['success' => true, 'data' => $data]);
            } catch (Exception $e) {
                http_response_code(500);
                echo json_encode(['success' => false, 'message' => 'Failed to load confirmation rep summary: ' . $e->getMessage()]);
            }
            break;
        }

        if ($action === 'resolveConfirmationBarcode') {
            try {
                ensure_order_confirmation_assignments_table($pdo);
                confirmation_clear_old_assignments($pdo);
                $barcode = trim((string)($_GET['barcode'] ?? ''));
                if ($barcode === '') {
                    http_response_code(400);
                    echo json_encode(['success' => false, 'message' => 'barcode is required']);
                    break;
                }

                $order = confirmation_fetch_order_by_barcode($pdo, $barcode);
                if (!$order) {
                    http_response_code(404);
                    echo json_encode(['success' => false, 'message' => 'لم يتم العثور على أوردر بهذا الباركود.']);
                    break;
                }

                $orderId = intval($order['id'] ?? 0);
                $assignment = confirmation_fetch_assignment_row($pdo, $orderId);
                $payload = confirmation_format_order_payload($pdo, $orderId);

                echo json_encode([
                    'success' => true,
                    'data' => [
                        'barcode' => $barcode,
                        'order' => $payload,
                        'raw_status' => $order['status'] ?? '',
                        'is_assignable' => confirmation_is_allowed_order_status($order['status'] ?? ''),
                        'assignment' => $assignment ? [
                            'id' => intval($assignment['id'] ?? 0),
                            'order_id' => intval($assignment['order_id'] ?? 0),
                            'rep_id' => intval($assignment['rep_id'] ?? 0),
                            'rep_name' => $assignment['rep_name'] ?? '',
                            'status' => $assignment['status'] ?? '',
                            'assigned_at' => $assignment['assigned_at'] ?? null,
                        ] : null,
                    ]
                ]);
            } catch (Exception $e) {
                http_response_code(500);
                echo json_encode(['success' => false, 'message' => 'Failed to resolve confirmation barcode: ' . $e->getMessage()]);
            }
            break;
        }

        if ($action === 'getConfirmationStockSummary') {
            try {
                ensure_order_confirmation_assignments_table($pdo);
                confirmation_clear_old_assignments($pdo);

                $warehouseId = intval($input['warehouse_id'] ?? 0);
                $includeAllRepsToday = !empty($input['include_all_reps_today']);
                $rawOrderIds = $input['order_ids'] ?? [];
                $orderIds = [];
                if (is_array($rawOrderIds)) {
                    foreach ($rawOrderIds as $value) {
                        $id = intval($value);
                        if ($id > 0) $orderIds[] = $id;
                    }
                } else {
                    foreach (preg_split('/\s*,\s*/', strval($rawOrderIds)) as $value) {
                        $id = intval($value);
                        if ($id > 0) $orderIds[] = $id;
                    }
                }
                $orderIds = array_values(array_unique($orderIds));

                if ($includeAllRepsToday) {
                    $todayOrderIds = confirmation_get_today_assigned_order_ids($pdo);
                    $orderIds = array_values(array_unique(array_merge($todayOrderIds, $orderIds)));
                }

                $summary = confirmation_validate_stock_for_orders($pdo, $warehouseId, $orderIds);
                if (!$summary['success']) {
                    http_response_code(400);
                    echo json_encode(['success' => false, 'message' => $summary['message'] ?? 'تعذر التحقق من المخزون.']);
                    break;
                }

                echo json_encode([
                    'success' => true,
                    'message' => $summary['message'] ?? '',
                    'data' => [
                        'items' => $summary['items'] ?? [],
                        'shortages' => $summary['shortages'] ?? [],
                        'warehouse_id' => $warehouseId,
                        'scope' => $includeAllRepsToday ? 'all_reps_today' : 'order_ids_only',
                    ]
                ]);
            } catch (Exception $e) {
                http_response_code(500);
                echo json_encode(['success' => false, 'message' => 'Failed to load confirmation stock summary: ' . $e->getMessage()]);
            }
            break;
        }

        if ($action === 'assignOrderConfirmations') {
            try {
                ensure_order_confirmation_assignments_table($pdo);
                confirmation_clear_old_assignments($pdo);

                $repId = intval($input['rep_id'] ?? 0);
                $warehouseId = intval($input['warehouse_id'] ?? 0);
                $notes = trim((string)($input['notes'] ?? ''));
                $rawOrderIds = $input['order_ids'] ?? [];
                $orderIds = [];
                if (is_array($rawOrderIds)) {
                    foreach ($rawOrderIds as $value) {
                        $id = intval($value);
                        if ($id > 0) $orderIds[] = $id;
                    }
                } else {
                    foreach (preg_split('/\s*,\s*/', strval($rawOrderIds)) as $value) {
                        $id = intval($value);
                        if ($id > 0) $orderIds[] = $id;
                    }
                }
                $orderIds = array_values(array_unique($orderIds));

                if ($repId <= 0) {
                    http_response_code(400);
                    echo json_encode(['success' => false, 'message' => 'يجب تحديد المندوب أولاً.']);
                    break;
                }
                if ($warehouseId <= 0) {
                    http_response_code(400);
                    echo json_encode(['success' => false, 'message' => 'يجب تحديد المخزن أولاً.']);
                    break;
                }
                if (empty($orderIds)) {
                    http_response_code(400);
                    echo json_encode(['success' => false, 'message' => 'يجب تحديد الأوردرات أولاً.']);
                    break;
                }

                $repExists = execute_query($pdo, 'SELECT id FROM users WHERE id = ? LIMIT 1', [$repId])->fetch(PDO::FETCH_ASSOC);
                if (!$repExists) {
                    http_response_code(404);
                    echo json_encode(['success' => false, 'message' => 'المندوب غير موجود.']);
                    break;
                }

                $placeholders = implode(',', array_fill(0, count($orderIds), '?'));
                $validRows = execute_query(
                    $pdo,
                    "SELECT id, status, rep_id FROM orders WHERE id IN ($placeholders)",
                    $orderIds
                )->fetchAll(PDO::FETCH_ASSOC);
                if (empty($validRows)) {
                    http_response_code(404);
                    echo json_encode(['success' => false, 'message' => 'الأوردر غير موجود.']);
                    break;
                }

                $validOrderIds = [];
                foreach ($validRows as $validRow) {
                    $orderId = intval($validRow['id'] ?? 0);
                    $orderStatus = strtolower(trim((string)($validRow['status'] ?? '')));
                    if (!confirmation_is_allowed_order_status($orderStatus)) {
                        http_response_code(400);
                        echo json_encode(['success' => false, 'message' => confirmation_describe_blocked_order_status($pdo, $validRow)]);
                        break 2;
                    }
                    $existingAssignment = confirmation_fetch_assignment_row($pdo, $orderId);
                    if ($existingAssignment && ($existingAssignment['status'] ?? '') === 'assigned' && intval($existingAssignment['rep_id'] ?? 0) !== $repId) {
                        http_response_code(409);
                        echo json_encode(['success' => false, 'message' => 'هذا الأوردر يتم تأكيده بواسطة مندوب آخر: ' . ($existingAssignment['rep_name'] ?? ('مندوب #' . intval($existingAssignment['rep_id'] ?? 0)))]);
                        break 2;
                    }
                    $validOrderIds[] = $orderId;
                }
                if (empty($validOrderIds)) {
                    http_response_code(400);
                    echo json_encode(['success' => false, 'message' => 'لا توجد أوردرات صالحة للإسناد.']);
                    break;
                }

                $todayAssignedOrderIds = confirmation_get_today_assigned_order_ids($pdo, $validOrderIds);
                $orderIdsForValidation = array_values(array_unique(array_merge($todayAssignedOrderIds, $validOrderIds)));

                $stockSummary = confirmation_validate_stock_for_orders($pdo, $warehouseId, $orderIdsForValidation);
                if (!$stockSummary['success']) {
                    http_response_code(400);
                    echo json_encode(['success' => false, 'message' => $stockSummary['message'] ?? 'تعذر التحقق من المخزون قبل الإسناد.']);
                    break;
                }
                if (!empty($stockSummary['shortages'])) {
                    http_response_code(409);
                    echo json_encode([
                        'success' => false,
                        'message' => 'المخزون غير كافٍ بعد احتساب أوردرات كل المناديب اليوم بشكل تراكمي.',
                        'data' => [
                            'items' => $stockSummary['items'] ?? [],
                            'shortages' => $stockSummary['shortages'] ?? [],
                            'warehouse_id' => $warehouseId,
                            'scope' => 'all_reps_today',
                        ]
                    ]);
                    break;
                }

                $assignedBy = isset($_SESSION['user_id']) ? intval($_SESSION['user_id']) : null;
                $pdo->beginTransaction();
                foreach ($validOrderIds as $orderId) {
                    execute_query(
                        $pdo,
                        "INSERT INTO order_confirmation_assignments (order_id, rep_id, assigned_by, notes, status, assigned_at, updated_at)
                         VALUES (?, ?, ?, ?, 'assigned', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                         ON DUPLICATE KEY UPDATE
                            rep_id = VALUES(rep_id),
                            assigned_by = VALUES(assigned_by),
                            notes = VALUES(notes),
                            status = 'assigned',
                            assigned_at = CURRENT_TIMESTAMP,
                            updated_at = CURRENT_TIMESTAMP",
                        [$orderId, $repId, $assignedBy, $notes !== '' ? $notes : null]
                    );
                }
                $pdo->commit();

                echo json_encode([
                    'success' => true,
                    'assigned_count' => count($validOrderIds),
                    'skipped_count' => max(0, count($orderIds) - count($validOrderIds)),
                    'message' => 'تم إسناد الأوردرات للمندوب بنجاح.'
                ]);
            } catch (Exception $e) {
                if ($pdo->inTransaction()) $pdo->rollBack();
                http_response_code(500);
                echo json_encode(['success' => false, 'message' => 'Failed to assign confirmation orders: ' . $e->getMessage()]);
            }
            break;
        }

        if ($action === 'assignOrderConfirmationByBarcode') {
            try {
                ensure_order_confirmation_assignments_table($pdo);
                confirmation_clear_old_assignments($pdo);
                $repId = intval($input['rep_id'] ?? 0);
                $warehouseId = intval($input['warehouse_id'] ?? 0);
                $barcode = trim((string)($input['barcode'] ?? ''));
                if ($repId <= 0 || $barcode === '' || $warehouseId <= 0) {
                    http_response_code(400);
                    echo json_encode(['success' => false, 'message' => 'يجب تحديد المندوب والمخزن وإدخال الباركود.']);
                    break;
                }

                $order = confirmation_fetch_order_by_barcode($pdo, $barcode);
                if (!$order) {
                    http_response_code(404);
                    echo json_encode(['success' => false, 'message' => 'لم يتم العثور على أوردر بهذا الباركود.']);
                    break;
                }

                $orderId = intval($order['id'] ?? 0);
                $orderStatus = strtolower(trim((string)($order['status'] ?? '')));
                if (!confirmation_is_allowed_order_status($orderStatus)) {
                    http_response_code(400);
                    echo json_encode(['success' => false, 'message' => confirmation_describe_blocked_order_status($pdo, $order)]);
                    break;
                }

                $existingAssignment = confirmation_fetch_assignment_row($pdo, $orderId);
                if ($existingAssignment && ($existingAssignment['status'] ?? '') === 'assigned' && intval($existingAssignment['rep_id'] ?? 0) !== $repId) {
                    http_response_code(409);
                    echo json_encode(['success' => false, 'message' => 'هذا الأوردر يتم تأكيده بواسطة مندوب آخر: ' . ($existingAssignment['rep_name'] ?? ('مندوب #' . intval($existingAssignment['rep_id'] ?? 0)))]);
                    break;
                }

                $todayAssignedOrderIds = confirmation_get_today_assigned_order_ids($pdo, [$orderId]);
                $orderIdsForValidation = array_values(array_unique(array_filter(array_map('intval', array_merge($todayAssignedOrderIds, [$orderId])), function($id){ return $id > 0; })));

                $stockSummary = confirmation_validate_stock_for_orders($pdo, $warehouseId, $orderIdsForValidation);
                if (!$stockSummary['success']) {
                    http_response_code(400);
                    echo json_encode(['success' => false, 'message' => $stockSummary['message'] ?? 'تعذر التحقق من المخزون قبل الإسناد.']);
                    break;
                }
                if (!empty($stockSummary['shortages'])) {
                    http_response_code(409);
                    echo json_encode([
                        'success' => false,
                        'message' => 'المخزون غير كافٍ بعد احتساب أوردرات كل المناديب اليوم بشكل تراكمي.',
                        'data' => [
                            'items' => $stockSummary['items'] ?? [],
                            'shortages' => $stockSummary['shortages'] ?? [],
                            'warehouse_id' => $warehouseId,
                            'scope' => 'all_reps_today',
                        ]
                    ]);
                    break;
                }

                $_POST = [];
                $input['order_ids'] = [$orderId];
                $input['notes'] = trim((string)($input['notes'] ?? ''));

                $assignedBy = isset($_SESSION['user_id']) ? intval($_SESSION['user_id']) : null;
                execute_query(
                    $pdo,
                    "INSERT INTO order_confirmation_assignments (order_id, rep_id, assigned_by, notes, status, assigned_at, updated_at)
                     VALUES (?, ?, ?, ?, 'assigned', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                     ON DUPLICATE KEY UPDATE
                        rep_id = VALUES(rep_id),
                        assigned_by = VALUES(assigned_by),
                        notes = VALUES(notes),
                        status = 'assigned',
                        assigned_at = CURRENT_TIMESTAMP,
                        updated_at = CURRENT_TIMESTAMP",
                    [$orderId, $repId, $assignedBy, trim((string)($input['notes'] ?? '')) ?: null]
                );

                echo json_encode([
                    'success' => true,
                    'message' => 'تم إسناد الأوردر للمندوب بنجاح.',
                    'data' => [
                        'order' => confirmation_format_order_payload($pdo, $orderId),
                        'assignment' => confirmation_fetch_assignment_row($pdo, $orderId)
                    ]
                ]);
            } catch (Exception $e) {
                http_response_code(500);
                echo json_encode(['success' => false, 'message' => 'Failed to assign confirmation order by barcode: ' . $e->getMessage()]);
            }
            break;
        }

        if ($action === 'updateOrderConfirmationDecision') {
            try {
                ensure_order_confirmation_assignments_table($pdo);
                $repId = intval($input['rep_id'] ?? 0);
                $barcode = trim((string)($input['barcode'] ?? ''));
                $decision = strtolower(trim((string)($input['decision'] ?? '')));
                if ($repId <= 0 || $barcode === '' || !in_array($decision, ['confirm', 'postpone', 'cancel'], true)) {
                    http_response_code(400);
                    echo json_encode(['success' => false, 'message' => 'يجب تحديد المندوب وإدخال الباركود واختيار إجراء صحيح.']);
                    break;
                }

                $order = confirmation_fetch_order_by_barcode($pdo, $barcode);
                if (!$order) {
                    http_response_code(404);
                    echo json_encode(['success' => false, 'message' => 'لم يتم العثور على أوردر بهذا الباركود.']);
                    break;
                }

                $orderId = intval($order['id'] ?? 0);
                $assignment = confirmation_fetch_assignment_row($pdo, $orderId);
                if (!$assignment || ($assignment['status'] ?? '') !== 'assigned') {
                    http_response_code(404);
                    echo json_encode(['success' => false, 'message' => 'هذا الأوردر غير موجود حالياً في قائمة التأكيد.']);
                    break;
                }
                if (intval($assignment['rep_id'] ?? 0) !== $repId) {
                    http_response_code(409);
                    echo json_encode(['success' => false, 'message' => 'هذا الأوردر مسند إلى مندوب آخر: ' . ($assignment['rep_name'] ?? ('مندوب #' . intval($assignment['rep_id'] ?? 0)))]);
                    break;
                }

                if ($decision === 'confirm') {
                    // تأكيد: لا يغير حالة الأوردر — فقط تسجيل قرار التأكيد في جدول التكليفات
                    $nextAssignmentStatus = 'confirmed';
                    $successMessage = 'تم تأكيد الأوردر بنجاح.';
                } elseif ($decision === 'postpone') {
                    // تأجيل: لا يغير حالة الأوردر — فقط تسجيل قرار التأجيل في جدول التكليفات
                    $nextAssignmentStatus = 'postponed';
                    $successMessage = 'تم تأجيل الأوردر بنجاح.';
                } else {
                    // إلغاء: يغير حالة الأوردر إلى ملغي فقط
                    $nextAssignmentStatus = 'cancelled';
                    $successMessage = 'تم إلغاء الأوردر بنجاح.';
                }

                $responseOrderStatus = $order['status'] ?? '';

                $pdo->beginTransaction();
                execute_query(
                    $pdo,
                    "UPDATE order_confirmation_assignments
                     SET status = ?, updated_at = CURRENT_TIMESTAMP
                     WHERE order_id = ? AND rep_id = ? AND status = 'assigned'",
                    [$nextAssignmentStatus, $orderId, $repId]
                );

                if ($decision === 'cancel') {
                    // فقط في حالة الإلغاء يتم تغيير حالة الأوردر
                    ensure_orders_status_has_cancelled($pdo);
                    $cancelStatus = 'cancelled';
                    $updateSql = "UPDATE orders SET status = ?";
                    $updateParams = [$cancelStatus];
                    if (column_exists($pdo, 'orders', 'updated_at')) {
                        $updateSql .= ", updated_at = NOW()";
                    }
                    $updateSql .= " WHERE id = ?";
                    $updateParams[] = $orderId;
                    execute_query($pdo, $updateSql, $updateParams);
                    $responseOrderStatus = $cancelStatus;
                }

                $pdo->commit();

                echo json_encode([
                    'success' => true,
                    'message' => $successMessage,
                    'data' => [
                        'order_id' => $orderId,
                        'order_status' => $responseOrderStatus,
                        'assignment_status' => $nextAssignmentStatus,
                    ]
                ]);
            } catch (Exception $e) {
                if ($pdo->inTransaction()) $pdo->rollBack();
                http_response_code(500);
                echo json_encode(['success' => false, 'message' => 'Failed to update order confirmation decision: ' . $e->getMessage()]);
            }
            break;
        }

        if ($action === 'unassignOrderConfirmations') {
            try {
                ensure_order_confirmation_assignments_table($pdo);

                $rawOrderIds = $input['order_ids'] ?? [];
                $orderIds = [];
                if (is_array($rawOrderIds)) {
                    foreach ($rawOrderIds as $value) {
                        $id = intval($value);
                        if ($id > 0) $orderIds[] = $id;
                    }
                } else {
                    foreach (preg_split('/\s*,\s*/', strval($rawOrderIds)) as $value) {
                        $id = intval($value);
                        if ($id > 0) $orderIds[] = $id;
                    }
                }
                $orderIds = array_values(array_unique($orderIds));
                if (empty($orderIds)) {
                    http_response_code(400);
                    echo json_encode(['success' => false, 'message' => 'order_ids are required']);
                    break;
                }

                $placeholders = implode(',', array_fill(0, count($orderIds), '?'));
                $stmt = execute_query(
                    $pdo,
                    "UPDATE order_confirmation_assignments
                     SET status = 'unassigned', updated_at = CURRENT_TIMESTAMP
                     WHERE order_id IN ($placeholders) AND status = 'assigned'",
                    $orderIds
                );

                echo json_encode([
                    'success' => true,
                    'affected_rows' => $stmt->rowCount(),
                    'message' => 'تم إلغاء إسناد الأوردرات المحددة.'
                ]);
            } catch (Exception $e) {
                http_response_code(500);
                echo json_encode(['success' => false, 'message' => 'Failed to unassign confirmation orders: ' . $e->getMessage()]);
            }
            break;
        }

        if ($action === 'clearAllOrderConfirmationsToday') {
            try {
                ensure_order_confirmation_assignments_table($pdo);
                confirmation_clear_old_assignments($pdo);

                $summaryRows = execute_query(
                    $pdo,
                    "SELECT status, COUNT(*) AS cnt
                     FROM order_confirmation_assignments
                     WHERE DATE(assigned_at) = CURDATE() AND status <> 'unassigned'
                     GROUP BY status"
                )->fetchAll(PDO::FETCH_ASSOC);

                $byStatus = [
                    'assigned' => 0,
                    'cancelled' => 0,
                    'confirmed' => 0,
                    'postponed' => 0,
                ];
                foreach ($summaryRows as $row) {
                    $status = strtolower(trim((string)($row['status'] ?? '')));
                    if (array_key_exists($status, $byStatus)) {
                        $byStatus[$status] += intval($row['cnt'] ?? 0);
                    }
                }

                $stmt = execute_query(
                    $pdo,
                    "UPDATE order_confirmation_assignments
                     SET status = 'unassigned', updated_at = CURRENT_TIMESTAMP
                     WHERE DATE(assigned_at) = CURDATE() AND status <> 'unassigned'"
                );

                echo json_encode([
                    'success' => true,
                    'affected_rows' => $stmt->rowCount(),
                    'data' => [
                        'assigned_count' => intval($byStatus['assigned'] ?? 0),
                        'cancelled_count' => intval($byStatus['cancelled'] ?? 0),
                        'confirmed_count' => intval($byStatus['confirmed'] ?? 0),
                        'postponed_count' => intval($byStatus['postponed'] ?? 0),
                    ],
                    'message' => 'تم مسح كل إسنادات التأكيد لليوم الحالي.'
                ]);
            } catch (Exception $e) {
                http_response_code(500);
                echo json_encode(['success' => false, 'message' => 'Failed to clear today confirmation assignments: ' . $e->getMessage()]);
            }
            break;
        }

        if ($action === 'restoreCancelledOrderConfirmation') {
            try {
                ensure_order_confirmation_assignments_table($pdo);

                $repId = intval($input['rep_id'] ?? 0);
                $orderId = intval($input['order_id'] ?? 0);
                if ($repId <= 0 || $orderId <= 0) {
                    http_response_code(400);
                    echo json_encode(['success' => false, 'message' => 'rep_id و order_id مطلوبان.']);
                    break;
                }

                $assignment = confirmation_fetch_assignment_row($pdo, $orderId);
                if (!$assignment) {
                    http_response_code(404);
                    echo json_encode(['success' => false, 'message' => 'لا يوجد تكليف تأكيد لهذا الأوردر.']);
                    break;
                }
                if (intval($assignment['rep_id'] ?? 0) !== $repId) {
                    http_response_code(409);
                    echo json_encode(['success' => false, 'message' => 'هذا الأوردر مرتبط بمندوب آخر.']);
                    break;
                }
                if (strtolower(trim((string)($assignment['status'] ?? ''))) !== 'cancelled') {
                    http_response_code(400);
                    echo json_encode(['success' => false, 'message' => 'الأوردر ليس في حالة ملغية داخل شاشة التأكيد.']);
                    break;
                }

                $orderRow = execute_query($pdo, "SELECT id, status FROM orders WHERE id = ? LIMIT 1", [$orderId])->fetch(PDO::FETCH_ASSOC);
                if (!$orderRow) {
                    http_response_code(404);
                    echo json_encode(['success' => false, 'message' => 'الأوردر غير موجود.']);
                    break;
                }

                $restoredStatus = 'pending';
                if (table_exists($pdo, 'order_status_history')) {
                    $prevStatus = execute_query(
                        $pdo,
                        "SELECT status
                         FROM order_status_history
                         WHERE order_id = ? AND status IS NOT NULL AND TRIM(status) <> '' AND LOWER(TRIM(status)) <> 'cancelled'
                         ORDER BY id DESC
                         LIMIT 1",
                        [$orderId]
                    )->fetchColumn();
                    if ($prevStatus) {
                        $restoredStatus = strtolower(trim((string)$prevStatus));
                    }
                }

                if ($restoredStatus === 'cancelled' || $restoredStatus === 'delivered' || $restoredStatus === 'with_rep' || $restoredStatus === '') {
                    $restoredStatus = 'pending';
                }

                $pdo->beginTransaction();

                execute_query(
                    $pdo,
                    "UPDATE order_confirmation_assignments
                     SET status = 'assigned', updated_at = CURRENT_TIMESTAMP
                     WHERE order_id = ? AND rep_id = ? AND status = 'cancelled'",
                    [$orderId, $repId]
                );

                $updateSql = "UPDATE orders SET status = ?";
                $updateParams = [$restoredStatus];
                if (column_exists($pdo, 'orders', 'updated_at')) {
                    $updateSql .= ", updated_at = NOW()";
                }
                $updateSql .= " WHERE id = ?";
                $updateParams[] = $orderId;
                execute_query($pdo, $updateSql, $updateParams);

                try {
                    log_order_history($pdo, $orderId, $restoredStatus, 'confirmation_restore_cancel', 'restore_from_cancelled_confirmation', $repId);
                } catch (Exception $historyEx) {}

                $pdo->commit();

                echo json_encode([
                    'success' => true,
                    'message' => 'تم استرجاع الأوردر وإعادته للأوردرات الحالية مع المندوب.',
                    'data' => [
                        'order_id' => $orderId,
                        'rep_id' => $repId,
                        'restored_status' => $restoredStatus,
                    ]
                ]);
            } catch (Exception $e) {
                if ($pdo->inTransaction()) $pdo->rollBack();
                http_response_code(500);
                echo json_encode(['success' => false, 'message' => 'Failed to restore cancelled confirmation order: ' . $e->getMessage()]);
            }
            break;
        }

        if ($action === 'getRepDailyJournal') {
            try {
                ensure_rep_daily_journal_table($pdo);

                $repId = isset($_GET['rep_id']) && is_numeric($_GET['rep_id']) ? intval($_GET['rep_id']) : null;
                $reqFrom = isset($_GET['from']) ? trim((string)$_GET['from']) : null;
                $reqTo = isset($_GET['to']) ? trim((string)$_GET['to']) : null;

                $where = [];
                $params = [];
                if ($repId) {
                    $where[] = 'rep_id = ?';
                    $params[] = $repId;
                }
                if ($reqFrom && preg_match('/^\d{4}-\d{2}-\d{2}$/', $reqFrom)) {
                    $where[] = 'DATE(journal_date) >= ?';
                    $params[] = $reqFrom;
                }
                if ($reqTo && preg_match('/^\d{4}-\d{2}-\d{2}$/', $reqTo)) {
                    $where[] = 'DATE(journal_date) <= ?';
                    $params[] = $reqTo;
                }

                $sql = 'SELECT * FROM rep_daily_journal';
                if (count($where) > 0) $sql .= ' WHERE ' . implode(' AND ', $where);
                $sql .= ' ORDER BY DATE(journal_date) ASC, rep_id ASC';

                $stmt = execute_query($pdo, $sql, $params);
                $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

                $journalIds = array_values(array_filter(array_map('intval', array_column($rows, 'id'))));
                $journalStatsMap = [];
                if (!empty($journalIds) && table_exists($pdo, 'rep_journal_orders')) {
                    $inJournalIds = implode(',', $journalIds);
                    $statsRows = $pdo->query(
                        "SELECT journal_id,
                                COUNT(*) AS orders_count,
                                COALESCE(SUM(CASE WHEN status = 'with_rep' THEN 1 ELSE 0 END), 0) AS active_count,
                                COALESCE(SUM(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END), 0) AS delivered_count,
                                COALESCE(SUM(CASE WHEN status = 'deferred' THEN 1 ELSE 0 END), 0) AS deferred_count,
                                COALESCE(SUM(CASE WHEN status IN ('full_return','partial_return') THEN 1 ELSE 0 END), 0) AS returned_count,
                                COALESCE(SUM(oi.qty_sum), 0) AS pieces_count
                         FROM rep_journal_orders rjo
                         LEFT JOIN (
                             SELECT order_id, COALESCE(SUM(quantity),0) AS qty_sum
                             FROM order_items
                             GROUP BY order_id
                         ) oi ON oi.order_id = rjo.order_id
                         WHERE journal_id IN ($inJournalIds)
                         GROUP BY journal_id"
                    )->fetchAll(PDO::FETCH_ASSOC);
                    foreach ($statsRows as $statsRow) {
                        $journalStatsMap[intval($statsRow['journal_id'])] = $statsRow;
                    }
                }

                foreach ($rows as &$row) {
                    $journalId = intval($row['id'] ?? 0);
                    if (empty($row['daily_code']) && $journalId > 0) {
                        $row['daily_code'] = 'DLY-' . str_pad($journalId, 5, '0', STR_PAD_LEFT);
                    }
                    $row['is_closed'] = intval($row['is_closed'] ?? 0);
                    $row['status'] = $row['is_closed'] ? 'closed' : 'open';
                    $row['status_label'] = $row['is_closed'] ? 'مغلقة' : 'مفتوحة';
                    $statsRow = $journalStatsMap[$journalId] ?? null;
                    $row['journal_orders_count'] = intval($statsRow['orders_count'] ?? 0);
                    $row['journal_pieces_count'] = intval($statsRow['pieces_count'] ?? 0);
                    $row['active_orders_count'] = intval($statsRow['active_count'] ?? 0);
                    $row['delivered_orders_count'] = intval($statsRow['delivered_count'] ?? 0);
                    $row['deferred_orders_count'] = intval($statsRow['deferred_count'] ?? 0);
                    $row['returned_orders_count'] = intval($statsRow['returned_count'] ?? 0);
                }
                unset($row);
                echo json_encode(['success' => true, 'data' => $rows]);
            } catch (Exception $e) {
                http_response_code(500);
                echo json_encode(['success' => false, 'message' => 'Failed to load rep daily journal: ' . $e->getMessage()]);
            }
            break;
        }

        // Aggregate stats from rep_daily_journal for a given rep + date range
        if ($action === 'getJournalStats') {
            try {
                ensure_rep_daily_journal_table($pdo);

                $repId = isset($_GET['rep_id']) && is_numeric($_GET['rep_id']) ? intval($_GET['rep_id']) : null;
                $reqFrom = isset($_GET['from']) ? trim((string)$_GET['from']) : null;
                $reqTo   = isset($_GET['to'])   ? trim((string)$_GET['to'])   : null;

                if (!$repId) {
                    echo json_encode(['success' => false, 'message' => 'rep_id is required']);
                    break;
                }

                $where  = ['rep_id = ?'];
                $params = [$repId];
                if ($reqFrom && preg_match('/^\d{4}-\d{2}-\d{2}$/', $reqFrom)) {
                    $where[] = 'DATE(journal_date) >= ?';
                    $params[] = $reqFrom;
                }
                if ($reqTo && preg_match('/^\d{4}-\d{2}-\d{2}$/', $reqTo)) {
                    $where[] = 'DATE(journal_date) <= ?';
                    $params[] = $reqTo;
                }

                $whereClause = implode(' AND ', $where);

                $sql = "SELECT
                    COUNT(*) AS session_count,
                    COALESCE(SUM(orders_assigned_count),   0) AS assignedCount,
                    COALESCE(SUM(assigned_value),          0) AS assignedValue,
                    COALESCE(SUM(pieces_assigned_count),   0) AS assignedPieces,
                    GROUP_CONCAT(id) AS journalIdsCsv
                FROM rep_daily_journal
                WHERE $whereClause";

                $stmt = execute_query($pdo, $sql, $params);
                $row  = $stmt->fetch(PDO::FETCH_ASSOC) ?: [];

                $sessionCount = intval($row['session_count'] ?? 0);
                $deliveredCount = 0;
                $deliveredValue = 0.0;
                $deliveredPieces = 0;
                $returnedCount = 0;
                $returnedValue = 0.0;
                $returnedPieces = 0;
                $deferredCount = 0;
                $deferredValue = 0.0;
                $deferredPieces = 0;
                $activeCount = 0;
                $activeValue = 0.0;
                $activePieces = 0;

                $journalIdsCsv = trim((string)($row['journalIdsCsv'] ?? ''));
                $journalIds = array_values(array_filter(array_map('intval', preg_split('/\s*,\s*/', $journalIdsCsv)), function($id) {
                    return intval($id) > 0;
                }));

                if (!empty($journalIds) && table_exists($pdo, 'rep_journal_orders')) {
                    $journalIn = implode(',', $journalIds);
                    $statusRows = $pdo->query(
                        "SELECT rjo.status,
                                COUNT(DISTINCT rjo.order_id) AS orders_count,
                                COALESCE(SUM(oi.qty_sum), 0) AS pieces_count,
                                COALESCE(SUM(o.total_amount), 0) AS total_value
                         FROM rep_journal_orders rjo
                         LEFT JOIN orders o ON o.id = rjo.order_id
                         LEFT JOIN (
                             SELECT order_id, COALESCE(SUM(quantity), 0) AS qty_sum
                             FROM order_items
                             GROUP BY order_id
                         ) oi ON oi.order_id = rjo.order_id
                         WHERE rjo.rep_id = " . intval($repId) . "
                           AND rjo.journal_id IN ($journalIn)
                         GROUP BY rjo.status"
                    )->fetchAll(PDO::FETCH_ASSOC);

                    foreach ($statusRows as $statusRow) {
                        $status = trim(strval($statusRow['status'] ?? ''));
                        $ordersCount = intval($statusRow['orders_count'] ?? 0);
                        $piecesCount = intval($statusRow['pieces_count'] ?? 0);
                        $totalValue = floatval($statusRow['total_value'] ?? 0);
                        if ($status === 'delivered') {
                            $deliveredCount += $ordersCount;
                            $deliveredPieces += $piecesCount;
                            $deliveredValue += $totalValue;
                        } elseif ($status === 'deferred') {
                            $deferredCount += $ordersCount;
                            $deferredPieces += $piecesCount;
                            $deferredValue += $totalValue;
                        } elseif ($status === 'full_return' || $status === 'partial_return') {
                            $returnedCount += $ordersCount;
                            $returnedPieces += $piecesCount;
                            $returnedValue += $totalValue;
                        } elseif ($status === 'with_rep') {
                            $activeCount += $ordersCount;
                            $activePieces += $piecesCount;
                            $activeValue += $totalValue;
                        }
                    }
                }

                echo json_encode([
                    'success' => true,
                    'has_journal' => $sessionCount > 0,
                    'data' => [
                        'deliveredCount'  => $deliveredCount,
                        'deliveredValue'  => $deliveredValue,
                        'deliveredPieces' => $deliveredPieces,
                        'returnedCount'   => $returnedCount,
                        'returnedValue'   => $returnedValue,
                        'returnedPieces'  => $returnedPieces,
                        'deferredCount'   => $deferredCount,
                        'deferredValue'   => $deferredValue,
                        'deferredPieces'  => $deferredPieces,
                        'activeCount'     => $activeCount,
                        'activeValue'     => $activeValue,
                        'activePieces'    => $activePieces,
                        'assignedCount'   => intval($row['assignedCount']   ?? 0),
                        'assignedValue'   => floatval($row['assignedValue']   ?? 0),
                        'assignedPieces'  => intval($row['assignedPieces']  ?? 0),
                    ]
                ]);
            } catch (Exception $e) {
                http_response_code(500);
                echo json_encode(['success' => false, 'message' => 'Failed to load journal stats: ' . $e->getMessage()]);
            }
            break;
        }

        if ($action === 'getRepOpenDaily') {
            $repId = intval($_GET['rep_id'] ?? 0);
            if (!$repId) { echo json_encode(['success' => false, 'message' => 'rep_id required']); break; }
            try {
                ensure_rep_daily_journal_table($pdo);
                $row = execute_query($pdo,
                    "SELECT id, daily_code, journal_date, session_seq, is_closed, COALESCE(orders_assigned_count,0) as assigned_count FROM rep_daily_journal WHERE rep_id = ? AND is_closed = 0 ORDER BY id DESC LIMIT 1",
                    [$repId]
                )->fetch(PDO::FETCH_ASSOC);
                // Fallback: if daily_code is NULL (created before this feature), generate it on-the-fly
                if ($row && empty($row['daily_code'])) {
                    $row['daily_code'] = 'DLY-' . str_pad($row['id'], 5, '0', STR_PAD_LEFT);
                }
                echo json_encode(['success' => true, 'data' => $row ?: null]);
            } catch (Exception $e) {
                echo json_encode(['success' => true, 'data' => null]);
            }
            break;
        }

        if ($action === 'closeRepDaily') {
            $repId    = intval($input['rep_id']    ?? 0);
            $jId      = intval($input['journal_id'] ?? 0);
            if (!$repId) { echo json_encode(['success' => false, 'message' => 'rep_id required']); break; }
            try {
                ensure_rep_daily_journal_table($pdo);
                $openRows = [];
                if ($jId > 0) {
                    $openRows = execute_query(
                        $pdo,
                        "SELECT id FROM rep_daily_journal WHERE rep_id = ? AND is_closed = 0 ORDER BY id DESC",
                        [$repId]
                    )->fetchAll(PDO::FETCH_ASSOC);

                    $requestedOpen = execute_query(
                        $pdo,
                        "SELECT id FROM rep_daily_journal WHERE id = ? AND rep_id = ? AND is_closed = 0 LIMIT 1",
                        [$jId, $repId]
                    )->fetch(PDO::FETCH_ASSOC);

                    if (!$requestedOpen) {
                        http_response_code(400);
                        echo json_encode(['success' => false, 'message' => 'اليومية المحددة ليست مفتوحة حالياً.']);
                        break;
                    }
                } else {
                    $openRows = execute_query(
                        $pdo,
                        "SELECT id FROM rep_daily_journal WHERE rep_id = ? AND is_closed = 0 ORDER BY id DESC",
                        [$repId]
                    )->fetchAll(PDO::FETCH_ASSOC);
                }

                if (empty($openRows)) {
                    http_response_code(400);
                    echo json_encode(['success' => false, 'message' => 'المندوب ليس له يومية مفتوحة.']);
                    break;
                }

                execute_query($pdo, "UPDATE rep_daily_journal SET is_closed = 1 WHERE rep_id = ? AND is_closed = 0", [$repId]);

                $closedIds = array_values(array_filter(array_map(function($row) {
                    return intval($row['id'] ?? 0);
                }, $openRows)));

                audit_log($pdo, 'sales', 'close_rep_daily', $repId, json_encode(['journal_id' => $jId, 'closed_ids' => $closedIds]));
                echo json_encode(['success' => true, 'closed_count' => count($closedIds), 'closed_ids' => $closedIds]);
            } catch (Exception $e) {
                http_response_code(500);
                echo json_encode(['success' => false, 'message' => $e->getMessage()]);
            }
            break;
        }

        if ($action === 'startDaily') {
            $repId = intval($input['repId'] ?? 0);
            $treasuryId = isset($input['treasuryId']) ? intval($input['treasuryId']) : null;
            $warehouseId = isset($input['warehouseId']) ? intval($input['warehouseId']) : null;
            $notes = isset($input['notes']) ? trim((string)$input['notes']) : null;
            $employeeInput = isset($input['employee']) && trim((string)$input['employee']) !== '' ? trim((string)$input['employee']) : null;
            $pageInput     = isset($input['page'])     && trim((string)$input['page'])     !== '' ? trim((string)$input['page'])     : null;
            $providedOpening = isset($input['openingAmount']) ? floatval($input['openingAmount']) : null;
            $journalDate = isset($input['date']) && preg_match('/^\d{4}-\d{2}-\d{2}$/', $input['date']) ? $input['date'] : date('Y-m-d');

            if (!$repId) {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'repId required']);
                break;
            }

            try {
                ensure_rep_daily_journal_table($pdo);

                $existingOpen = execute_query($pdo,
                    "SELECT * FROM rep_daily_journal WHERE rep_id = ? AND is_closed = 0 ORDER BY id DESC LIMIT 1",
                    [$repId]
                )->fetch(PDO::FETCH_ASSOC);
                if ($existingOpen) {
                    if (empty($existingOpen['daily_code'])) {
                        $existingOpen['daily_code'] = 'DLY-' . str_pad(intval($existingOpen['id']), 5, '0', STR_PAD_LEFT);
                        try { execute_query($pdo, "UPDATE rep_daily_journal SET daily_code = ? WHERE id = ?", [$existingOpen['daily_code'], intval($existingOpen['id'])]); } catch (Exception $ex) {}
                    }
                    $existingOpen['is_closed'] = intval($existingOpen['is_closed'] ?? 0);
                    $existingOpen['status'] = $existingOpen['is_closed'] ? 'closed' : 'open';
                    echo json_encode(['success' => true, 'data' => $existingOpen]);
                    break;
                }

                // detect orders date column
                $dateCol = null;
                if (column_exists($pdo, 'orders', 'updated_at')) $dateCol = 'updated_at';
                elseif (column_exists($pdo, 'orders', 'created_at')) $dateCol = 'created_at';
                elseif (column_exists($pdo, 'orders', 'date')) $dateCol = 'date';

                // compute opening amount
                if ($providedOpening !== null) {
                    $opening = $providedOpening;
                } else {
                    // try previous day's closing
                    $prev = date('Y-m-d', strtotime($journalDate . ' -1 day'));
                    $prevRow = execute_query($pdo, 'SELECT closing_amount FROM rep_daily_journal WHERE rep_id = ? AND journal_date = ? LIMIT 1', [$repId, $prev])->fetch(PDO::FETCH_ASSOC);
                    if ($prevRow && isset($prevRow['closing_amount'])) {
                        $opening = floatval($prevRow['closing_amount']);
                    } else {
                        // sum transactions before the day
                        $rel = pick_allowed_enum($pdo, 'transactions', 'related_to_type', 'rep', ['rep','employee','none']);
                        $opening = floatval(execute_query($pdo, 'SELECT COALESCE(SUM(amount),0) AS bal FROM transactions WHERE related_to_type = ? AND related_to_id = ? AND transaction_date < ?', [$rel, $repId, $journalDate . ' 00:00:00'])->fetchColumn() ?? 0);
                    }
                }

                // compute opening orders/pieces/value carried forward
                $openingOrdersCount = 0; $openingPieces = 0; $openingOldOrdersValue = 0;
                $openingOrdersList = [];
                if ($dateCol) {
                    $statusList = "'with_rep','partial','postponed'";
                    $stmt = execute_query($pdo, "SELECT id FROM orders WHERE rep_id = ? AND status IN ($statusList) AND DATE(`$dateCol`) < ?", [$repId, $journalDate]);
                    $ids = $stmt->fetchAll(PDO::FETCH_COLUMN);
                    if (count($ids) > 0) {
                        $openingOrdersCount = count($ids);
                        // pieces
                        $in = implode(',', array_map('intval', $ids));
                        if ($in !== '') {
                            if (column_exists($pdo, 'order_items', 'quantity')) {
                                $pstmt = $pdo->query("SELECT COALESCE(SUM(quantity),0) FROM order_items WHERE order_id IN ($in)");
                                $openingPieces = intval($pstmt->fetchColumn() ?? 0);
                            }
                            if (column_exists($pdo, 'order_items', 'total_price')) {
                                $openingOldOrdersValue = floatval($pdo->query("SELECT COALESCE(SUM(total_price),0) FROM order_items WHERE order_id IN ($in)")->fetchColumn() ?? 0);
                            } else {
                                $openingOldOrdersValue = floatval($pdo->query("SELECT COALESCE(SUM(quantity * price_per_unit),0) FROM order_items WHERE order_id IN ($in)")->fetchColumn() ?? 0);
                            }
                            $r = $pdo->query("SELECT id, COALESCE(order_number, id) AS order_number FROM orders WHERE id IN ($in)");
                            while ($rowo = $r->fetch(PDO::FETCH_ASSOC)) {
                                $openingOrdersList[] = ['id' => intval($rowo['id']), 'order_number' => $rowo['order_number'], 'source' => 'old'];
                            }
                        }
                    }
                }

                // compute session sequence (max+1) for this rep/date
                $seqRow = execute_query($pdo, 'SELECT COALESCE(MAX(session_seq),0) as mx FROM rep_daily_journal WHERE rep_id = ? AND journal_date = ?', [$repId, $journalDate])->fetch(PDO::FETCH_ASSOC);
                $seq = intval($seqRow['mx'] ?? 0) + 1;

                // insert a new opening row (allow multiple rows per day)
                $sessionUserName = $_SESSION['user']['name'] ?? null;
                $employeeToSave  = $employeeInput ?? $sessionUserName; // prefer user-supplied value
                $ordersJson = !empty($openingOrdersList) ? json_encode($openingOrdersList, JSON_UNESCAPED_UNICODE) : null;
                execute_query($pdo, "INSERT INTO rep_daily_journal (rep_id, session_seq, journal_date, opening_amount, opening_orders_count, opening_pieces_count, notes, employee, page, treasury_id, warehouse_id, prev_balance, old_orders_value, orders_json, is_closed) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)", [$repId, $seq, $journalDate, $opening, $openingOrdersCount, $openingPieces, $notes, $employeeToSave, $pageInput, $treasuryId ?: null, $warehouseId ?: null, $opening, $openingOldOrdersValue, $ordersJson]);
                $insId = $pdo->lastInsertId();

                $dailyCode = 'DLY-' . str_pad(intval($insId), 5, '0', STR_PAD_LEFT);
                try { execute_query($pdo, "UPDATE rep_daily_journal SET daily_code = ?, is_closed = 0 WHERE id = ?", [$dailyCode, $insId]); } catch (Exception $ex) {}

                // fetch the inserted row back
                $row = execute_query($pdo, 'SELECT * FROM rep_daily_journal WHERE id = ? LIMIT 1', [$insId])->fetch(PDO::FETCH_ASSOC);
                if ($row) {
                    $row['daily_code'] = $row['daily_code'] ?: $dailyCode;
                    $row['is_closed'] = intval($row['is_closed'] ?? 0);
                    $row['status'] = $row['is_closed'] ? 'closed' : 'open';
                }

                // If there's a non-zero opening amount, record a transaction with context 'start_daily'
                try {
                    if (isset($opening) && floatval($opening) !== 0.0) {
                        $txTypeStart = pick_allowed_enum($pdo, 'transactions', 'type', 'rep_payment_in', ['rep_payment_in','payment_in','rep_settlement','payment']);
                        $rel_local_start = pick_allowed_enum($pdo, 'transactions', 'related_to_type', 'rep', ['rep','employee','none']);
                        $detailsStart = json_encode(['context' => 'start_daily', 'journal_id' => $insId, 'rep_id' => $repId]);
                        execute_query($pdo, "INSERT INTO transactions (type, warehouse_id, treasury_id, related_to_type, related_to_id, amount, transaction_date, details) VALUES (?, ?, ?, ?, ?, ?, NOW(), ?)", [$txTypeStart, null, $treasuryId, $rel_local_start, $repId, floatval($opening), $detailsStart]);
                    }
                } catch (Exception $e) {
                    // non-fatal: don't block startDaily if transaction logging fails
                    error_log('startDaily: failed to insert opening transaction: ' . $e->getMessage());
                }

                audit_log($pdo, 'sales', 'start_daily', $repId, json_encode(['journal_date' => $journalDate, 'treasury' => $treasuryId, 'warehouse' => $warehouseId, 'notes' => $notes]));

                echo json_encode(['success' => true, 'data' => $row]);
            } catch (Exception $e) {
                http_response_code(500);
                echo json_encode(['success' => false, 'message' => 'Failed to start daily: ' . $e->getMessage()]);
            }
            break;
        }

        // Create a delivery session snapshot for later retrieval/printing
        if ($action === 'createDeliverySession') {
            try {
                $data = $input; // parsed JSON body

                // create table if missing (safe to run repeatedly)
                execute_query($pdo, "CREATE TABLE IF NOT EXISTS rep_delivery_sessions (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    session_date DATETIME DEFAULT CURRENT_TIMESTAMP,
                    rep_id INT NOT NULL,
                    user_id INT NULL,
                    treasury_id INT NULL,
                    store_id INT NULL,
                    previous_balance DECIMAL(14,2) DEFAULT 0,
                    old_orders_count INT DEFAULT 0,
                    old_pieces_count INT DEFAULT 0,
                    old_orders_value DECIMAL(14,2) DEFAULT 0,
                    today_orders_count INT DEFAULT 0,
                    today_pieces_count INT DEFAULT 0,
                    today_orders_value DECIMAL(14,2) DEFAULT 0,
                    total_orders_count INT DEFAULT 0,
                    total_pieces_count INT DEFAULT 0,
                    total_orders_value DECIMAL(14,2) DEFAULT 0,
                    final_balance_before_pay DECIMAL(14,2) DEFAULT 0,
                    payment_type VARCHAR(50) DEFAULT 'none',
                    paid_amount DECIMAL(14,2) DEFAULT 0,
                    remaining_after_pay DECIMAL(14,2) DEFAULT 0,
                    orders_data JSON NULL
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

                $rep_id = intval($data['rep_id'] ?? 0);
                $treasury_id = isset($data['treasury_id']) ? intval($data['treasury_id']) : null;
                $store_id = isset($data['store_id']) ? intval($data['store_id']) : null;
                $prev_bal = floatval($data['previous_balance'] ?? 0);
                $old_c = intval($data['old_orders_count'] ?? 0);
                $old_p = intval($data['old_pieces_count'] ?? 0);
                $old_v = floatval($data['old_orders_value'] ?? 0);
                $today_c = intval($data['today_orders_count'] ?? 0);
                $today_p = intval($data['today_pieces_count'] ?? 0);
                $today_v = floatval($data['today_orders_value'] ?? 0);
                $total_c = intval($data['total_orders_count'] ?? 0);
                $total_p = intval($data['total_pieces_count'] ?? 0);
                $total_v = floatval($data['total_orders_value'] ?? 0);
                $final_before = floatval($data['final_balance_before_pay'] ?? 0);
                $pay_type = trim(strval($data['payment_type'] ?? 'none'));
                $paid_amt = floatval($data['paid_amount'] ?? 0);
                $rem_after = floatval($data['remaining_after_pay'] ?? 0);
                $orders_data = isset($data['orders_data']) ? json_encode($data['orders_data'], JSON_UNESCAPED_UNICODE) : null;
                $user_id = $_SESSION['user_id'] ?? null;

                $stmt = execute_query($pdo, "INSERT INTO rep_delivery_sessions (rep_id, user_id, treasury_id, store_id, previous_balance, old_orders_count, old_pieces_count, old_orders_value, today_orders_count, today_pieces_count, today_orders_value, total_orders_count, total_pieces_count, total_orders_value, final_balance_before_pay, payment_type, paid_amount, remaining_after_pay, orders_data) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", [$rep_id, $user_id, $treasury_id ?: null, $store_id ?: null, $prev_bal, $old_c, $old_p, $old_v, $today_c, $today_p, $today_v, $total_c, $total_p, $total_v, $final_before, $pay_type, $paid_amt, $rem_after, $orders_data]);

                $lastId = $pdo->lastInsertId();
                echo json_encode(['success' => true, 'session_id' => $lastId]);
            } catch (Exception $e) {
                http_response_code(500);
                echo json_encode(['success' => false, 'message' => 'Failed to create delivery session: ' . $e->getMessage()]);
            }
            exit;
        }
        if ($action === 'settleDaily') {
            $repId = intval($input['repId'] ?? 0);
            $treasuryId = intval($input['treasuryId'] ?? 0);
            $paidAmount = isset($input['paidAmount']) ? floatval($input['paidAmount']) : 0;

            // enforce defaults/locks for treasury when settling
            $defaults = get_user_defaults($pdo);
            if ($defaults) {
                $defTid = isset($defaults['default_treasury_id']) ? intval($defaults['default_treasury_id']) : null;
                $canChangeT = isset($defaults['can_change_treasury']) ? boolval($defaults['can_change_treasury']) : true;
                if (!$canChangeT && $defTid) {
                    if ($treasuryId && $treasuryId !== $defTid) {
                        http_response_code(400);
                        echo json_encode(['success' => false, 'message' => 'الخزينة المقفلة للمستخدم، لا يمكن تغييرها.']);
                        break;
                    }
                    if (!$treasuryId) $treasuryId = $defTid;
                } else {
                    if (!$treasuryId && $defTid) $treasuryId = $defTid;
                }
            }

            if (!$repId || !$treasuryId) {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'repId and treasuryId are required']);
                break;
            }
            if ($paidAmount <= 0) {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'paidAmount must be greater than 0']);
                break;
            }

            try {
                // Validate rep exists (most installs store reps in users table)
                if (table_exists($pdo, 'users') && column_exists($pdo, 'users', 'role')) {
                    $repCheck = execute_query($pdo, "SELECT id, name FROM users WHERE id = ? AND role = 'representative' LIMIT 1", [$repId]);
                    $repRow = $repCheck->fetch(PDO::FETCH_ASSOC);
                    if (!$repRow) {
                        http_response_code(404);
                        echo json_encode(['success' => false, 'message' => 'Representative not found']);
                        break;
                    }
                }

                // Get current rep balance from transactions (canonical source used by getAllWithBalance)
                $repRelatedType = pick_allowed_enum($pdo, 'transactions', 'related_to_type', 'rep', ['rep','employee','none']);
                $balStmt = execute_query($pdo, "SELECT COALESCE(SUM(amount),0) AS bal FROM transactions WHERE related_to_type = ? AND related_to_id = ?", [$repRelatedType, $repId]);
                $balRow = $balStmt->fetch(PDO::FETCH_ASSOC);
                $currentBal = floatval($balRow['bal'] ?? 0);

                // Negative balance means debt (عليه). Settlement is payment-in to reduce debt.
                if ($currentBal >= 0) {
                    http_response_code(400);
                    echo json_encode(['success' => false, 'message' => 'لا توجد مديونية على هذا المندوب لإغلاقها.']);
                    break;
                }
                if ($paidAmount > abs($currentBal)) {
                    http_response_code(400);
                    echo json_encode(['success' => false, 'message' => 'مبلغ التقفيل أكبر من المديونية الحالية.']);
                    break;
                }

                $pdo->beginTransaction();
                try {
                    // Lock treasury and update balance (cash in)
                    execute_query($pdo, "SELECT current_balance FROM treasuries WHERE id = ? FOR UPDATE", [$treasuryId]);

                    $txType = pick_allowed_enum($pdo, 'transactions', 'type', 'rep_settlement', ['rep_settlement','rep_payment_in','payment_in','payment']);
                    $relType = pick_allowed_enum($pdo, 'transactions', 'related_to_type', 'rep', ['rep','employee','none']);
                    $details = [
                        'action' => 'settleDaily',
                        'rep_id' => $repId,
                        'treasury_id' => $treasuryId,
                        'paidAmount' => abs($paidAmount),
                        'model' => 'consignment'
                    ];

                    execute_query(
                        $pdo,
                        "INSERT INTO transactions (type, warehouse_id, treasury_id, related_to_type, related_to_id, amount, transaction_date, details) VALUES (?, ?, ?, ?, ?, ?, NOW(), ?)",
                        [$txType, null, $treasuryId, $relType, $repId, abs($paidAmount), json_encode($details)]
                    );
                    $txId = $pdo->lastInsertId();

                    execute_query($pdo, "UPDATE treasuries SET current_balance = current_balance + ? WHERE id = ?", [abs($paidAmount), $treasuryId]);

                    if ($pdo->inTransaction()) $pdo->commit();

                    // Return updated balance
                    $newBalStmt = execute_query($pdo, "SELECT COALESCE(SUM(amount),0) AS bal FROM transactions WHERE related_to_type = ? AND related_to_id = ?", [$repRelatedType, $repId]);
                    $newBalRow = $newBalStmt->fetch(PDO::FETCH_ASSOC);

                    echo json_encode([
                        'success' => true,
                        'transaction_id' => $txId,
                        'new_balance' => floatval($newBalRow['bal'] ?? 0)
                    ]);
                } catch (Exception $e) {
                    if ($pdo->inTransaction()) $pdo->rollBack();
                    throw $e;
                }
            } catch (Exception $e) {
                if ($pdo->inTransaction()) $pdo->rollBack();
                http_response_code(500);
                echo json_encode(['success' => false, 'message' => 'Settle daily failed: ' . $e->getMessage()]);
            }
            break;
        }

        // ── Log a return event (called from SalesUpdateStatus after partialReturn batch) ──
        if ($action === 'logReturnEvent') {
            try {
                // Ensure table exists
                execute_query($pdo, "CREATE TABLE IF NOT EXISTS rep_return_events (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    rep_id INT NOT NULL,
                    user_id INT NULL,
                    user_name VARCHAR(255) NULL,
                    warehouse_id INT NULL,
                    order_ids JSON NULL,
                    event_date DATE NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

                $rep_id  = intval($input['rep_id'] ?? 0);
                $wh_id   = isset($input['warehouse_id']) ? intval($input['warehouse_id']) : null;
                $ids     = isset($input['order_ids']) && is_array($input['order_ids']) ? $input['order_ids'] : [];
                $ev_date = isset($input['event_date']) ? trim($input['event_date']) : date('Y-m-d');
                $user_id   = $_SESSION['user_id'] ?? null;
                $user_name = $_SESSION['user']['name'] ?? null;

                if (!$rep_id) {
                    http_response_code(400);
                    echo json_encode(['success' => false, 'message' => 'rep_id required']);
                    exit;
                }

                execute_query($pdo, "INSERT INTO rep_return_events (rep_id, user_id, user_name, warehouse_id, order_ids, event_date) VALUES (?, ?, ?, ?, ?, ?)",
                    [$rep_id, $user_id, $user_name, $wh_id ?: null, json_encode($ids, JSON_UNESCAPED_UNICODE), $ev_date]);

                $insId = $pdo->lastInsertId();
                audit_log($pdo, 'sales', 'return_event', $rep_id, json_encode(['warehouse_id' => $wh_id, 'order_ids' => $ids]));
                echo json_encode(['success' => true, 'event_id' => $insId]);
            } catch (Exception $e) {
                http_response_code(500);
                echo json_encode(['success' => false, 'message' => 'logReturnEvent failed: ' . $e->getMessage()]);
            }
            exit;
        }

        // ── Log a close-daily event (called from SalesDailyClose after settlement) ──
        if ($action === 'logCloseDaily') {
            try {
                // Ensure table exists
                execute_query($pdo, "CREATE TABLE IF NOT EXISTS rep_close_events (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    rep_id INT NOT NULL,
                    treasury_id INT NULL,
                    user_id INT NULL,
                    user_name VARCHAR(255) NULL,
                    paid_amount DECIMAL(14,2) DEFAULT 0,
                    direction VARCHAR(32) NULL,
                    event_date DATE NOT NULL,
                    notes TEXT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

                $rep_id      = intval($input['rep_id'] ?? 0);
                $treasury_id = isset($input['treasury_id']) ? intval($input['treasury_id']) : null;
                $paid_amount = floatval($input['paid_amount'] ?? 0);
                $direction   = trim(strval($input['direction'] ?? 'collect'));
                $notes       = isset($input['notes']) ? trim($input['notes']) : null;
                $ev_date     = isset($input['event_date']) ? trim($input['event_date']) : date('Y-m-d');
                $user_id     = $_SESSION['user_id'] ?? null;
                $user_name   = $_SESSION['user']['name'] ?? null;

                if (!$rep_id) {
                    http_response_code(400);
                    echo json_encode(['success' => false, 'message' => 'rep_id required']);
                    exit;
                }

                execute_query($pdo, "INSERT INTO rep_close_events (rep_id, treasury_id, user_id, user_name, paid_amount, direction, event_date, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                    [$rep_id, $treasury_id ?: null, $user_id, $user_name, $paid_amount, $direction, $ev_date, $notes]);

                $insId = $pdo->lastInsertId();
                audit_log($pdo, 'sales', 'close_daily', $rep_id, json_encode(['treasury_id' => $treasury_id, 'paid_amount' => $paid_amount, 'direction' => $direction]));
                echo json_encode(['success' => true, 'event_id' => $insId]);
            } catch (Exception $e) {
                http_response_code(500);
                echo json_encode(['success' => false, 'message' => 'logCloseDaily failed: ' . $e->getMessage()]);
            }
            exit;
        }

        // ── Get journal orders for a rep (from rep_journal_orders table) ──
        if ($action === 'getJournalOrders') {
            $repId = intval($_GET['rep_id'] ?? 0);
            $journalId = intval($_GET['journal_id'] ?? 0);
            $journalIdsRaw = isset($_GET['journal_ids']) ? trim((string)$_GET['journal_ids']) : '';
            $from  = isset($_GET['from']) && preg_match('/^\d{4}-\d{2}-\d{2}$/', $_GET['from']) ? $_GET['from'] : null;
            $to    = isset($_GET['to'])   && preg_match('/^\d{4}-\d{2}-\d{2}$/', $_GET['to'])   ? $_GET['to']   : null;
            if (!$repId) { http_response_code(400); echo json_encode(['success' => false, 'message' => 'rep_id required']); exit; }
            try {
                ensure_rep_journal_orders_table($pdo);
                // Detect order_items schema
                $hasVariants = table_exists($pdo, 'product_variants');
                // Fetch all journal rows for rep
                $where = ['rjo.rep_id = ?'];
                $params = [$repId];
                $journalIds = [];
                if ($journalIdsRaw !== '') {
                    $journalIds = array_values(array_filter(array_map('intval', preg_split('/\s*,\s*/', $journalIdsRaw)), function($id) {
                        return intval($id) > 0;
                    }));
                }

                $selectedJournalIds = !empty($journalIds) ? $journalIds : ($journalId > 0 ? [$journalId] : []);
                if (!empty($selectedJournalIds) && table_exists($pdo, 'rep_daily_journal')) {
                    $selectedJournalIdsIn = implode(',', array_map('intval', $selectedJournalIds));
                    $repairRows = $pdo->query(
                        "SELECT id, rep_id, journal_date, is_closed, orders_json
                         FROM rep_daily_journal
                         WHERE rep_id = " . intval($repId) . " AND id IN ($selectedJournalIdsIn)"
                    )->fetchAll(PDO::FETCH_ASSOC);

                    foreach ($repairRows as $repairRow) {
                        $repairJournalId = intval($repairRow['id'] ?? 0);
                        if ($repairJournalId <= 0) continue;
                        $ordersJsonRaw = trim((string)($repairRow['orders_json'] ?? ''));
                        if ($ordersJsonRaw === '') continue;
                        $decodedOrders = json_decode($ordersJsonRaw, true);
                        if (!is_array($decodedOrders)) continue;

                        foreach ($decodedOrders as $decodedOrder) {
                            $decodedOrderId = intval(is_array($decodedOrder) ? ($decodedOrder['id'] ?? 0) : $decodedOrder);
                            if ($decodedOrderId <= 0) continue;

                            $orderStateRow = execute_query($pdo,
                                "SELECT rep_id, status FROM orders WHERE id = ? LIMIT 1",
                                [$decodedOrderId]
                            )->fetch(PDO::FETCH_ASSOC);
                            if (!$orderStateRow) continue;

                            $orderStatus = trim(strval($orderStateRow['status'] ?? ''));
                            $mappedStatus = 'with_rep';
                            if ($orderStatus === 'returned') {
                                $mappedStatus = 'full_return';
                            } elseif ($orderStatus === 'delivered') {
                                $mappedStatus = 'delivered';
                            } elseif ($orderStatus === 'deferred' || $orderStatus === 'postponed' || $orderStatus === 'pending') {
                                $mappedStatus = 'deferred';
                            }

                            $existingRepairRow = execute_query($pdo,
                                "SELECT id, journal_id, status FROM rep_journal_orders WHERE rep_id = ? AND order_id = ? ORDER BY id DESC LIMIT 1",
                                [$repId, $decodedOrderId]
                            )->fetch(PDO::FETCH_ASSOC);

                            if ($existingRepairRow) {
                                $repairId = intval($existingRepairRow['id'] ?? 0);
                                $existingStatus = trim(strval($existingRepairRow['status'] ?? ''));
                                $finalStatus = $existingStatus;
                                if ($existingStatus === '' || $existingStatus === 'with_rep' || intval($existingRepairRow['journal_id'] ?? 0) <= 0) {
                                    $finalStatus = $mappedStatus;
                                }
                                execute_query($pdo,
                                    "UPDATE rep_journal_orders
                                     SET journal_id = ?, status = ?, event_date = COALESCE(event_date, ?)
                                     WHERE id = ?",
                                    [$repairJournalId, $finalStatus, ($repairRow['journal_date'] ?? date('Y-m-d')), $repairId]
                                );
                            } else {
                                execute_query($pdo,
                                    "INSERT INTO rep_journal_orders (journal_id, rep_id, order_id, status, event_date, event_time, employee)
                                     VALUES (?, ?, ?, ?, ?, ?, ?)",
                                    [$repairJournalId, $repId, $decodedOrderId, $mappedStatus, ($repairRow['journal_date'] ?? date('Y-m-d')), date('H:i:s'), $_SESSION['user']['name'] ?? null]
                                );
                            }
                        }

                        refresh_rep_daily_journal_status_counts($pdo, $repairJournalId);
                    }
                }

                if (!empty($journalIds)) {
                    $where[] = 'rjo.journal_id IN (' . implode(',', $journalIds) . ')';
                } elseif ($journalId > 0) {
                    $where[] = 'rjo.journal_id = ?';
                    $params[] = $journalId;
                }
                $rows = execute_query($pdo,
                    "SELECT rjo.id AS jro_id, rjo.journal_id, rjo.rep_id, rjo.order_id,
                            rjo.status AS journal_status, rjo.event_date, rjo.event_time, rjo.employee,
                            COALESCE(rjo.returned_pieces, 0) AS returned_pieces,
                            COALESCE(rjo.returned_value, 0) AS returned_value,
                            o.order_number, o.total_amount, o.shipping_fees, o.status AS order_status,
                            o.notes AS order_notes, o.created_at,
                            c.name AS customer_name, c.phone1, c.address, c.governorate
                     FROM rep_journal_orders rjo
                     LEFT JOIN orders o ON o.id = rjo.order_id
                     LEFT JOIN customers c ON c.id = o.customer_id
                     WHERE " . implode(' AND ', $where) . "
                     ORDER BY rjo.updated_at DESC",
                    $params)->fetchAll(PDO::FETCH_ASSOC);

                // Fetch order items for all orders
                $orderIds = array_unique(array_filter(array_column($rows, 'order_id'), 'intval'));
                $itemsMap = [];
                $partialReturnedValueFallbackMap = [];
                $partialReturnedPiecesFallbackMap = [];
                if (!empty($orderIds)) {
                    $inStr = implode(',', array_map('intval', $orderIds));
                    if ($hasVariants) {
                        $iRows = $pdo->query(
                            "SELECT oi.order_id, oi.product_id, oi.quantity, oi.price_per_unit,
                                    COALESCE(pv.name, '') AS name,
                                    COALESCE(pv.color, '') AS color, COALESCE(pv.size, '') AS size
                             FROM order_items oi
                             LEFT JOIN product_variants pv ON pv.id = oi.product_id
                             WHERE oi.order_id IN ($inStr)"
                        )->fetchAll(PDO::FETCH_ASSOC);
                    } else {
                        $iRows = $pdo->query(
                            "SELECT oi.order_id, oi.product_id, oi.quantity, oi.price_per_unit,
                                    COALESCE(p.name, '') AS name, '' AS color, '' AS size
                             FROM order_items oi
                             LEFT JOIN products p ON p.id = oi.product_id
                             WHERE oi.order_id IN ($inStr)"
                        )->fetchAll(PDO::FETCH_ASSOC);
                    }
                    foreach ($iRows as $it) {
                        $itemsMap[intval($it['order_id'])][] = [
                            'productId' => intval($it['product_id']),
                            'name'      => $it['name'],
                            'color'     => $it['color'],
                            'size'      => $it['size'],
                            'quantity'  => intval($it['quantity']),
                            'qty'       => intval($it['quantity']),
                            'price'     => floatval($it['price_per_unit']),
                        ];
                    }

                    foreach ($orderIds as $oidRaw) {
                        $oid = intval($oidRaw);
                        if ($oid <= 0) continue;

                        try {
                            $txRow = execute_query($pdo,
                                "SELECT COALESCE(SUM(ABS(amount)),0) AS val
                                 FROM transactions
                                 WHERE related_to_id = ?
                                   AND (
                                         details LIKE ?
                                         OR details LIKE ?
                                   )
                                   AND (
                                         details LIKE '%partial_return%'
                                         OR details LIKE '%partial_returned%'
                                   )",
                                [
                                    $repId,
                                    '%\"order_id\":' . $oid . '%',
                                    '%\"order_id\":\"' . $oid . '\"%'
                                ]
                            )->fetch(PDO::FETCH_ASSOC);
                            $partialReturnedValueFallbackMap[$oid] = floatval($txRow['val'] ?? 0);
                        } catch (Exception $e) {
                            $partialReturnedValueFallbackMap[$oid] = 0;
                        }

                        try {
                            if (table_exists($pdo, 'product_movements')) {
                                $mvRow = execute_query($pdo,
                                    "SELECT COALESCE(SUM(ABS(quantity_change)),0) AS pcs
                                     FROM product_movements
                                     WHERE reference_id = ?
                                       AND reference_type = 'order_partial_return'",
                                    [$oid]
                                )->fetch(PDO::FETCH_ASSOC);
                                $partialReturnedPiecesFallbackMap[$oid] = intval($mvRow['pcs'] ?? 0);
                            } else {
                                $partialReturnedPiecesFallbackMap[$oid] = 0;
                            }
                        } catch (Exception $e) {
                            $partialReturnedPiecesFallbackMap[$oid] = 0;
                        }
                    }
                }

                $active = []; $delivered = []; $deferred = []; $returned = [];
                $allVisible = [];
                foreach ($rows as $r) {
                    $oid = intval($r['order_id']);
                    $order = [
                        'id'           => $oid,
                        'rep_id'       => intval($r['rep_id']),
                        'order_number' => $r['order_number'],
                        'status'       => $r['journal_status'],
                        'order_status' => $r['order_status'],
                        'total_amount' => floatval($r['total_amount'] ?? 0),
                        'total'        => floatval($r['total_amount'] ?? 0),
                        'shipping_fees'=> floatval($r['shipping_fees'] ?? 0),
                        'returned_pieces' => intval($r['returned_pieces'] ?? 0),
                        'returned_value' => floatval($r['returned_value'] ?? 0),
                        'returned_pieces_fallback' => intval($partialReturnedPiecesFallbackMap[$oid] ?? 0),
                        'returned_value_fallback' => floatval($partialReturnedValueFallbackMap[$oid] ?? 0),
                        'customer_name'=> $r['customer_name'],
                        'phone'        => $r['phone1'],
                        'address'      => $r['address'],
                        'governorate'  => $r['governorate'],
                        'created_at'   => $r['created_at'],
                        'event_date'   => $r['event_date'],
                        'event_time'   => $r['event_time'],
                        'employee'     => $r['employee'],
                        'journal_id'   => $r['journal_id'],
                        'products'     => $itemsMap[$oid] ?? [],
                    ];
                    $allVisible[] = $order;
                    $st = $r['journal_status'];
                    if ($st === 'with_rep') {
                        $active[] = $order;
                    } elseif ($st === 'delivered') {
                        if ($from && $to) { $ed = $r['event_date']; if ($ed >= $from && $ed <= $to) $delivered[] = $order; }
                        else $delivered[] = $order;
                    } elseif ($st === 'deferred') {
                        $deferred[] = $order;
                    } elseif ($st === 'full_return' || $st === 'partial_return') {
                        if ($from && $to) { $ed = $r['event_date']; if ($ed >= $from && $ed <= $to) $returned[] = $order; }
                        else $returned[] = $order;
                    }
                }

                $shouldIncludeCurrentCustody = false;
                if (!empty($selectedJournalIds) && table_exists($pdo, 'rep_daily_journal')) {
                    $selectedIdsIn = implode(',', array_map('intval', $selectedJournalIds));
                    $openCount = intval($pdo->query("SELECT COUNT(*) FROM rep_daily_journal WHERE id IN ($selectedIdsIn) AND is_closed = 0")->fetchColumn() ?? 0);
                    $shouldIncludeCurrentCustody = $openCount > 0;
                }

                if ($shouldIncludeCurrentCustody) {
                    $currentOrdersRows = execute_query($pdo,
                        "SELECT o.id, o.rep_id, o.order_number, o.status, o.total_amount, o.shipping_fees, o.created_at,
                                c.name AS customer_name, c.phone1, c.address, c.governorate
                         FROM orders o
                         LEFT JOIN customers c ON c.id = o.customer_id
                         WHERE o.rep_id = ? AND o.status IN ('with_rep', 'partial', 'postponed')
                         ORDER BY o.created_at DESC",
                        [$repId]
                    )->fetchAll(PDO::FETCH_ASSOC);

                    $activeSeen = [];
                    foreach ($active as $activeOrder) {
                        $activeSeen[intval($activeOrder['id'] ?? 0)] = true;
                    }

                    foreach ($currentOrdersRows as $currentOrderRow) {
                        $currentOrderId = intval($currentOrderRow['id'] ?? 0);
                        if ($currentOrderId <= 0 || isset($activeSeen[$currentOrderId])) continue;
                        $active[] = [
                            'id' => $currentOrderId,
                            'rep_id' => intval($currentOrderRow['rep_id'] ?? 0),
                            'order_number' => $currentOrderRow['order_number'],
                            'status' => 'with_rep',
                            'order_status' => $currentOrderRow['status'],
                            'total_amount' => floatval($currentOrderRow['total_amount'] ?? 0),
                            'total' => floatval($currentOrderRow['total_amount'] ?? 0),
                            'shipping_fees' => floatval($currentOrderRow['shipping_fees'] ?? 0),
                            'customer_name' => $currentOrderRow['customer_name'],
                            'phone' => $currentOrderRow['phone1'],
                            'address' => $currentOrderRow['address'],
                            'governorate' => $currentOrderRow['governorate'],
                            'created_at' => $currentOrderRow['created_at'],
                            'event_date' => null,
                            'event_time' => null,
                            'employee' => null,
                            'journal_id' => null,
                            'products' => $itemsMap[$currentOrderId] ?? [],
                        ];
                        $activeSeen[$currentOrderId] = true;
                    }
                }

                $summaryOrders = array_merge($active, $delivered, $deferred, $returned);
                $summaryPieces = 0;
                foreach ($summaryOrders as $summaryOrder) {
                    foreach (($summaryOrder['products'] ?? []) as $product) {
                        $summaryPieces += intval($product['quantity'] ?? $product['qty'] ?? 0);
                    }
                }
                echo json_encode([
                    'success' => true,
                    'journal_id' => $journalId > 0 ? $journalId : null,
                    'journal_ids' => !empty($journalIds) ? $journalIds : ($journalId > 0 ? [$journalId] : []),
                    'active' => $active,
                    'delivered' => $delivered,
                    'deferred' => $deferred,
                    'returned' => $returned,
                    'summary' => [
                        'orders_count' => count($summaryOrders),
                        'pieces_count' => $summaryPieces,
                        'active_count' => count($active),
                        'delivered_count' => count($delivered),
                        'deferred_count' => count($deferred),
                        'returned_count' => count($returned),
                    ],
                ]);
            } catch (Exception $e) {
                http_response_code(500);
                echo json_encode(['success' => false, 'message' => 'getJournalOrders failed: ' . $e->getMessage()]);
            }
            exit;
        }

        // ── Update order status in rep_journal_orders ──
        if ($action === 'updateJournalOrderStatus') {
            $repId    = intval($input['rep_id'] ?? 0);
            $orderIds = $input['order_ids'] ?? [];
            $status   = trim(strval($input['status'] ?? ''));
            $notes    = isset($input['notes']) ? trim($input['notes']) : null;
            $allowed  = ['with_rep', 'delivered', 'deferred', 'full_return', 'partial_return'];
            if (!$repId || !$status || !in_array($status, $allowed, true) || !is_array($orderIds) || count($orderIds) === 0) {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'rep_id, order_ids[], and valid status required']);
                exit;
            }
            try {
                ensure_rep_journal_orders_table($pdo);
                $now      = date('Y-m-d');
                $nowTime  = date('H:i:s');
                $employee = $_SESSION['user']['name'] ?? null;
                $updated  = 0;
                $affectedJournalIds = [];
                foreach ($orderIds as $oid) {
                    $oid = intval($oid);
                    if ($oid <= 0) continue;
                    $journalRow = execute_query($pdo,
                        "SELECT journal_id FROM rep_journal_orders WHERE rep_id = ? AND order_id = ? LIMIT 1",
                        [$repId, $oid]
                    )->fetch(PDO::FETCH_ASSOC);
                    $journalId = intval($journalRow['journal_id'] ?? 0);
                    $res = execute_query($pdo,
                        "UPDATE rep_journal_orders SET status=?, event_date=?, event_time=?, employee=?, notes=? WHERE rep_id=? AND order_id=?",
                        [$status, $now, $nowTime, $employee, $notes, $repId, $oid]
                    );
                    $updated += $res->rowCount();
                    if ($journalId > 0) {
                        $affectedJournalIds[$journalId] = true;
                    }
                }
                foreach (array_keys($affectedJournalIds) as $affectedJournalId) {
                    refresh_rep_daily_journal_status_counts($pdo, intval($affectedJournalId));
                }
                echo json_encode(['success' => true, 'updated' => $updated]);
            } catch (Exception $e) {
                http_response_code(500);
                echo json_encode(['success' => false, 'message' => 'updateJournalOrderStatus failed: ' . $e->getMessage()]);
            }
            exit;
        }

        if ($action === 'recallOrderFromRep') {
            $repId   = intval($input['rep_id']   ?? 0);
            $orderId = intval($input['order_id'] ?? 0);
            if (!$repId || !$orderId) {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'rep_id and order_id are required.']);
                exit;
            }
            try {
                ensure_rep_journal_orders_table($pdo);
                // حذف سجل اليومية
                execute_query($pdo, "DELETE FROM rep_journal_orders WHERE rep_id = ? AND order_id = ?", [$repId, $orderId]);
                // إعادة الأوردر إلى حالة متاح (confirmed) وإزالة ارتباطه بالمندوب
                $confirmedStatus = pick_allowed_enum($pdo, 'orders', 'status', 'confirmed', ['confirmed', 'new', 'pending']);
                if (column_exists($pdo, 'orders', 'updated_at')) {
                    execute_query($pdo, "UPDATE orders SET rep_id = NULL, status = ?, updated_at = NOW() WHERE id = ? AND rep_id = ?", [$confirmedStatus, $orderId, $repId]);
                } else {
                    execute_query($pdo, "UPDATE orders SET rep_id = NULL, status = ? WHERE id = ? AND rep_id = ?", [$confirmedStatus, $orderId, $repId]);
                }
                try { log_order_history($pdo, $orderId, $confirmedStatus, 'rep_recall', 'recalled_from_rep', $repId); } catch (Exception $hEx) {}
                echo json_encode(['success' => true]);
            } catch (Exception $e) {
                http_response_code(500);
                echo json_encode(['success' => false, 'message' => 'recallOrderFromRep failed: ' . $e->getMessage()]);
            }
            exit;
        }

        if ($action === 'completeDaily') {
            $repId = intval($input['repId'] ?? 0);
            $orders = $input['orders'] ?? [];
            $paymentAdjustment = isset($input['paymentAdjustment']) ? floatval($input['paymentAdjustment']) : 0;
            $treasuryId = isset($input['treasuryId']) ? intval($input['treasuryId']) : 0;
            $warehouseId = isset($input['warehouseId']) ? intval($input['warehouseId']) : 0;

            // enforce defaults/locks for this user when completing daily
            $defaults = get_user_defaults($pdo);
            if ($defaults) {
                $defTid = isset($defaults['default_treasury_id']) ? intval($defaults['default_treasury_id']) : null;
                $canChangeT = isset($defaults['can_change_treasury']) ? boolval($defaults['can_change_treasury']) : true;
                if (!$canChangeT && $defTid) {
                    if ($treasuryId && $treasuryId !== $defTid) { http_response_code(400); echo json_encode(['success'=>false,'message'=>'الخزينة المقفلة للمستخدم، لا يمكن تغييرها.']); break; }
                    if (!$treasuryId) $treasuryId = $defTid;
                } else { if (!$treasuryId && $defTid) $treasuryId = $defTid; }

                $defWid = isset($defaults['default_warehouse_id']) ? intval($defaults['default_warehouse_id']) : null;
                $canChangeW = isset($defaults['can_change_warehouse']) ? boolval($defaults['can_change_warehouse']) : true;
                if (!$canChangeW && $defWid) {
                    if ($warehouseId && $warehouseId !== $defWid) { http_response_code(400); echo json_encode(['success'=>false,'message'=>'المستودع المقفل للمستخدم، لا يمكن تغييره.']); break; }
                    if (!$warehouseId) $warehouseId = $defWid;
                } else { if (!$warehouseId && $defWid) $warehouseId = $defWid; }
            }

            if (!$repId || !is_array($orders) || count($orders) === 0) {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'Missing rep or orders for daily completion.']);
                break;
            }

            if ($warehouseId > 0) {
                $stockValidation = confirmation_validate_stock_for_orders($pdo, $warehouseId, $orders);
                if (!($stockValidation['success'] ?? false)) {
                    http_response_code(400);
                    echo json_encode([
                        'success' => false,
                        'message' => $stockValidation['message'] ?? 'فشل التحقق من المخزون.',
                        'data' => [
                            'items' => $stockValidation['items'] ?? [],
                            'shortages' => $stockValidation['shortages'] ?? []
                        ]
                    ]);
                    break;
                }

                $shortages = is_array($stockValidation['shortages'] ?? null) ? $stockValidation['shortages'] : [];
                if (!empty($shortages)) {
                    http_response_code(409);
                    echo json_encode([
                        'success' => false,
                        'message' => 'المخزون غير كافٍ لإتمام اليومية على المخزن المحدد.',
                        'data' => [
                            'items' => $stockValidation['items'] ?? [],
                            'shortages' => $shortages
                        ]
                    ]);
                    break;
                }
            }

            // Consignment model: upfront payment is always Rep -> Company.
            if ($paymentAdjustment > 0 && $treasuryId <= 0) {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'Treasury is required when paymentAdjustment > 0.']);
                break;
            }

            // ── DDL guards: ensure rep_daily_journal exists with all required columns ──
            // Must run OUTSIDE the transaction (MySQL DDL causes implicit commit).
            ensure_rep_daily_journal_table($pdo);

            try {
                $pdo->beginTransaction();

                // Prepare journal values BEFORE assigning orders (so we can capture "old" custody state)
                $journalDate = date('Y-m-d');
                $employeeName = $_SESSION['user']['name'] ?? null;

                // compute previous balance (sum of transactions related to rep)
                $repRel = pick_allowed_enum($pdo, 'transactions', 'related_to_type', 'rep', ['rep','employee','none']);
                $currentBalanceSnapshot = floatval(execute_query($pdo, 'SELECT COALESCE(SUM(amount),0) as bal FROM transactions WHERE related_to_type = ? AND related_to_id = ?', [$repRel, $repId])->fetchColumn() ?? 0);

                $openJournalRow = execute_query($pdo,
                    "SELECT * FROM rep_daily_journal WHERE rep_id = ? AND is_closed = 0 ORDER BY id DESC LIMIT 1",
                    [$repId]
                )->fetch(PDO::FETCH_ASSOC) ?: null;

                $oldIds = [];
                $existingOrdersList = [];
                $existingAssignedCount = 0;
                $existingAssignedPieces = 0;
                $existingAssignedValue = 0.0;
                $existingPaidSigned = 0.0;
                $pageToSave = isset($input['page']) ? trim((string)$input['page']) : null;
                $notesToSave = isset($input['reason']) ? trim((string)$input['reason']) : (isset($input['notes']) ? trim((string)$input['notes']) : null);

                if ($openJournalRow) {
                    $journalId = intval($openJournalRow['id']);
                    $journalDate = !empty($openJournalRow['journal_date']) ? $openJournalRow['journal_date'] : $journalDate;
                    $dailyCode = !empty($openJournalRow['daily_code']) ? $openJournalRow['daily_code'] : ('DLY-' . str_pad($journalId, 5, '0', STR_PAD_LEFT));
                    $prevBalance = floatval($openJournalRow['prev_balance'] ?? $currentBalanceSnapshot);
                    $oldOrdersCount = intval($openJournalRow['opening_orders_count'] ?? 0);
                    $oldPieces = intval($openJournalRow['opening_pieces_count'] ?? 0);
                    $oldOrdersValue = floatval($openJournalRow['old_orders_value'] ?? 0);
                    $existingAssignedCount = intval($openJournalRow['orders_assigned_count'] ?? 0);
                    $existingAssignedPieces = intval($openJournalRow['pieces_assigned_count'] ?? 0);
                    $existingAssignedValue = floatval($openJournalRow['assigned_value'] ?? 0);
                    $existingPaidSigned = abs(floatval($openJournalRow['payment_amount'] ?? 0)) * ((($openJournalRow['payment_action'] ?? 'collect') === 'pay') ? -1 : 1);
                    $employeeName = trim((string)($openJournalRow['employee'] ?? '')) !== '' ? $openJournalRow['employee'] : $employeeName;
                    $pageToSave = trim((string)($openJournalRow['page'] ?? '')) !== '' ? $openJournalRow['page'] : $pageToSave;
                    $treasuryId = intval($openJournalRow['treasury_id'] ?? 0) ?: $treasuryId;
                    $warehouseId = intval($openJournalRow['warehouse_id'] ?? 0) ?: $warehouseId;
                    $notesToSave = trim((string)($openJournalRow['notes'] ?? '')) !== '' ? $openJournalRow['notes'] : $notesToSave;
                    $existingOrdersRaw = $openJournalRow['orders_json'] ?? null;
                    if (!empty($existingOrdersRaw)) {
                        $decoded = json_decode($existingOrdersRaw, true);
                        if (is_array($decoded)) $existingOrdersList = $decoded;
                    }
                } else {
                    // old custody orders (orders already assigned to rep BEFORE this operation)
                    $statusList = "'with_rep','partial','postponed'";
                    $oldStmt = execute_query($pdo, "SELECT id FROM orders WHERE rep_id = ? AND status IN ($statusList)", [$repId]);
                    $oldIds = $oldStmt->fetchAll(PDO::FETCH_COLUMN);
                    $oldOrdersCount = count($oldIds);
                    $oldPieces = 0; $oldOrdersValue = 0;
                    $prevBalance = $currentBalanceSnapshot;
                    if ($oldOrdersCount > 0) {
                        $inOld = implode(',', array_map('intval', $oldIds));
                        $q = column_exists($pdo, 'order_items', 'quantity') ? "SELECT COALESCE(SUM(quantity),0) FROM order_items WHERE order_id IN ($inOld)" : "SELECT 0";
                        $oldPieces = intval($pdo->query($q)->fetchColumn() ?? 0);
                        if (column_exists($pdo, 'order_items', 'total_price')) {
                            $oldOrdersValue = floatval($pdo->query("SELECT COALESCE(SUM(total_price),0) FROM order_items WHERE order_id IN ($inOld)")->fetchColumn() ?? 0);
                        } else {
                            $oldOrdersValue = floatval($pdo->query("SELECT COALESCE(SUM(quantity * price_per_unit),0) FROM order_items WHERE order_id IN ($inOld)")->fetchColumn() ?? 0);
                        }
                        $r = $pdo->query("SELECT id, COALESCE(order_number, id) AS order_number FROM orders WHERE id IN ($inOld)");
                        while ($rowo = $r->fetch(PDO::FETCH_ASSOC)) {
                            $existingOrdersList[] = ['id' => intval($rowo['id']), 'order_number' => $rowo['order_number'], 'source' => 'old'];
                        }
                    }
                }

                // today's assigned orders metrics (from client-provided $orders list)
                $in = implode(',', array_map('intval', $orders));
                $todayOrdersCount = count($orders);
                $todayPieces = 0; $todayOrdersValue = 0;
                if ($in !== '') {
                    if (column_exists($pdo, 'order_items', 'quantity')) {
                        $todayPieces = intval($pdo->query("SELECT COALESCE(SUM(quantity),0) FROM order_items WHERE order_id IN ($in)")->fetchColumn() ?? 0);
                    }
                    if (column_exists($pdo, 'order_items', 'total_price')) {
                        $todayOrdersValue = floatval($pdo->query("SELECT COALESCE(SUM(total_price),0) FROM order_items WHERE order_id IN ($in)")->fetchColumn() ?? 0);
                    } else {
                        $todayOrdersValue = floatval($pdo->query("SELECT COALESCE(SUM(quantity * price_per_unit),0) FROM order_items WHERE order_id IN ($in)")->fetchColumn() ?? 0);
                    }
                }

                $assignedOrdersCountTotal = $existingAssignedCount + $todayOrdersCount;
                $assignedPiecesTotal = $existingAssignedPieces + $todayPieces;
                $assignedValueTotal = $existingAssignedValue + $todayOrdersValue;

                $totalOrdersCount = $oldOrdersCount + $assignedOrdersCountTotal;
                $totalPiecesCount = $oldPieces + $assignedPiecesTotal;
                $totalOrdersValue = $oldOrdersValue + $assignedValueTotal;

                // compute final balance before/after payment
                $finalBeforePayment = $prevBalance - $assignedValueTotal;
                $paymentAction = isset($input['paymentAction']) ? trim(strval($input['paymentAction'])) : 'collect';
                $paymentAmt = abs(floatval($paymentAdjustment));
                $paidNowSigned = $paymentAmt * ($paymentAction === 'collect' ? 1 : -1);
                $netPaidSigned = $existingPaidSigned + $paidNowSigned;
                $paymentActionNet = $netPaidSigned < 0 ? 'pay' : 'collect';
                $paymentAmtNet = abs($netPaidSigned);
                $balanceAfterPayment = $finalBeforePayment + $netPaidSigned;

                // build orders JSON with source (old/today)
                $ordersListMap = [];
                foreach ($existingOrdersList as $existingOrder) {
                    $existingId = intval($existingOrder['id'] ?? 0);
                    if ($existingId > 0) $ordersListMap[$existingId] = $existingOrder;
                }
                if ($todayOrdersCount > 0) {
                    $r2 = $pdo->query("SELECT id, COALESCE(order_number, id) AS order_number FROM orders WHERE id IN ($in)");
                    while ($rowt = $r2->fetch(PDO::FETCH_ASSOC)) {
                        $ordersListMap[intval($rowt['id'])] = ['id' => intval($rowt['id']), 'order_number' => $rowt['order_number'], 'source' => 'today'];
                    }
                }

                $ordersList = array_values($ordersListMap);
                $ordersJson = json_encode($ordersList, JSON_UNESCAPED_UNICODE);

                if ($openJournalRow) {
                    execute_query($pdo, "UPDATE rep_daily_journal SET employee = ?, page = ?, treasury_id = ?, warehouse_id = ?, prev_balance = ?, opening_orders_count = ?, opening_pieces_count = ?, old_orders_value = ?, orders_assigned_count = ?, pieces_assigned_count = ?, assigned_value = ?, total_orders_count = ?, total_pieces_count = ?, total_orders_value = ?, final_before_payment = ?, payment_action = ?, payment_amount = ?, balance_after_payment = ?, orders_json = ?, notes = ?, daily_code = ?, is_closed = 0 WHERE id = ?", [$employeeName, $pageToSave ?: null, $treasuryId ?: null, $warehouseId ?: null, $prevBalance, $oldOrdersCount, $oldPieces, $oldOrdersValue, $assignedOrdersCountTotal, $assignedPiecesTotal, $assignedValueTotal, $totalOrdersCount, $totalPiecesCount, $totalOrdersValue, $finalBeforePayment, $paymentActionNet, $paymentAmtNet, $balanceAfterPayment, $ordersJson, $notesToSave, $dailyCode, $journalId]);
                } else {
                    try {
                        $seqRow2 = execute_query($pdo, 'SELECT COALESCE(MAX(session_seq),0) as mx FROM rep_daily_journal WHERE rep_id = ? AND journal_date = ?', [$repId, $journalDate])->fetch(PDO::FETCH_ASSOC);
                        $seq2 = intval($seqRow2['mx'] ?? 0) + 1;
                    } catch (Exception $ex) { $seq2 = 1; }

                    execute_query($pdo, "INSERT INTO rep_daily_journal (rep_id, session_seq, journal_date, employee, page, treasury_id, warehouse_id, prev_balance, opening_orders_count, opening_pieces_count, old_orders_value, orders_assigned_count, pieces_assigned_count, assigned_value, total_orders_count, total_pieces_count, total_orders_value, final_before_payment, payment_action, payment_amount, balance_after_payment, orders_json, notes, daily_code, is_closed) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)", [$repId, $seq2, $journalDate, $employeeName, $pageToSave ?: null, $treasuryId ?: null, $warehouseId ?: null, $prevBalance, $oldOrdersCount, $oldPieces, $oldOrdersValue, $assignedOrdersCountTotal, $assignedPiecesTotal, $assignedValueTotal, $totalOrdersCount, $totalPiecesCount, $totalOrdersValue, $finalBeforePayment, $paymentActionNet, $paymentAmtNet, $balanceAfterPayment, $ordersJson, $notesToSave, '']);
                    $journalId = intval($pdo->lastInsertId());
                    $dailyCode = 'DLY-' . str_pad($journalId, 5, '0', STR_PAD_LEFT);
                    try { execute_query($pdo, "UPDATE rep_daily_journal SET daily_code = ? WHERE id = ?", [$dailyCode, $journalId]); } catch (Exception $ex) {}
                }

                // determine reason for this stock movement
                $daily_reason = isset($input['reason']) ? trim($input['reason']) : (isset($input['notes']) ? trim($input['notes']) : '');

                // deduct stock from provided warehouse for all order items
                if ($warehouseId) {
                    if (empty($daily_reason)) {
                        $pdo->rollBack();
                        http_response_code(400);
                        echo json_encode(['success' => false, 'message' => 'يرجى تحديد سبب (reason) لتسليم/سحب المنتجات من المستودع.']);
                        break;
                    }
                }

                if ($warehouseId) {
                    $in = implode(',', array_map('intval', $orders));
                    $stmt = $pdo->query("SELECT oi.product_id, oi.quantity, oi.order_id FROM order_items oi WHERE oi.order_id IN ($in)");
                    $items = $stmt->fetchAll(PDO::FETCH_ASSOC);
                    foreach ($items as $it) {
                        $pid = intval($it['product_id']);
                        $qty = intval($it['quantity']);
                        if ($pid <= 0 || $qty <= 0) continue;
                        $sstmt = execute_query($pdo, "SELECT quantity FROM stock WHERE product_id = ? AND warehouse_id = ? FOR UPDATE", [$pid, $warehouseId]);
                        $prevQty = 0;
                        if ($row = $sstmt->fetch(PDO::FETCH_ASSOC)) {
                            $prevQty = intval($row['quantity']);
                            if ($prevQty < $qty) {
                                throw new Exception('Insufficient stock for product #' . $pid);
                            }
                            $newQty = $prevQty - $qty;
                            execute_query($pdo, "UPDATE stock SET quantity = ? WHERE product_id = ? AND warehouse_id = ?", [$newQty, $pid, $warehouseId]);
                        } else {
                            throw new Exception('Insufficient stock for product #' . $pid);
                        }
                        $mt = pick_allowed_enum($pdo, 'product_movements', 'movement_type', 'rep_hand_over', ['transfer_out','sale','transfer','purchase','return_out']);
                        $movement_notes = json_encode(array_merge(is_array($it) ? $it : ['info' => $it], ['reason' => $daily_reason]));
                        execute_query($pdo, "INSERT INTO product_movements (product_id, warehouse_id, movement_type, quantity_change, previous_quantity, new_quantity, reference_id, reference_type, notes, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", [$pid, $warehouseId, $mt, -$qty, $prevQty, $newQty, intval($it['order_id']), 'order_hand_over', $movement_notes, null]);
                    }
                }

                // Consignment model: assigning orders creates DEBT on the Rep.
                // Ensure the assignment amount is computed from order items ONLY (exclude shipping_fees).
                // Do NOT trust client-provided totals which may include shipping; always compute server-side.
                $in = implode(',', array_map('intval', $orders));
                $order_items_has_total_col = column_exists($pdo, 'order_items', 'total_price');
                if ($order_items_has_total_col) {
                    $sumStmt = $pdo->query("SELECT COALESCE(SUM(total_price),0) as s FROM order_items WHERE order_id IN ($in)");
                } else {
                    $sumStmt = $pdo->query("SELECT COALESCE(SUM(quantity * price_per_unit),0) as s FROM order_items WHERE order_id IN ($in)");
                }
                $sumRow = $sumStmt->fetch(PDO::FETCH_ASSOC);
                $totalAmount = floatval($sumRow['s'] ?? 0);

                $detailsArr = ['orders' => $orders, 'rep_id' => $repId, 'reason' => ($daily_reason ?? ''), 'model' => 'consignment'];
                $details = json_encode($detailsArr);
                $assignmentTxId = null;
                if ($totalAmount > 0) {
                    $txType = pick_allowed_enum($pdo, 'transactions', 'type', 'rep_assignment', ['rep_assignment','rep_settlement','sale','payment_in','payment_out']);
                    $rel_local = pick_allowed_enum($pdo, 'transactions', 'related_to_type', 'rep', ['rep','employee','none']);
                    execute_query($pdo, "INSERT INTO transactions (type, warehouse_id, treasury_id, related_to_type, related_to_id, amount, transaction_date, details) VALUES (?, ?, ?, ?, ?, ?, NOW(), ?)", [$txType, $warehouseId ?: null, null, $rel_local, $repId, -1 * abs($totalAmount), $details]);
                    $assignmentTxId = $pdo->lastInsertId();
                }

                // Handle upfront payment adjustment from/to Rep.
                // Client may send `paymentAction` as 'collect' (rep -> company) or 'pay' (company -> rep).
                $paymentAction = isset($input['paymentAction']) ? trim(strval($input['paymentAction'])) : 'collect';
                $amt = abs(floatval($paymentAdjustment));
                if ($amt > 0) {
                    if ($paymentAction === 'collect') {
                        // Rep pays company: credit treasury, reduce rep debt (positive amount)
                        $txType3 = pick_allowed_enum($pdo, 'transactions', 'type', 'rep_payment_in', ['rep_payment_in','payment_in','payment','rep_settlement']);
                        $rel_local3 = pick_allowed_enum($pdo, 'transactions', 'related_to_type', 'rep', ['rep','employee','none']);
                        execute_query($pdo, "INSERT INTO transactions (type, warehouse_id, treasury_id, related_to_type, related_to_id, amount, transaction_date, details) VALUES (?, ?, ?, ?, ?, ?, NOW(), ?)", [$txType3, $warehouseId ?: null, $treasuryId, $rel_local3, $repId, $amt, json_encode(['direction'=>'in','context'=>'close_daily','orders'=>$orders,'rep_id'=>$repId,'assignment_tx_id'=>$assignmentTxId,'model'=>'consignment'])]);
                        if ($treasuryId) execute_query($pdo, "UPDATE treasuries SET current_balance = current_balance + ? WHERE id = ?", [$amt, $treasuryId]);
                    } else {
                        // Company pays rep: decrease treasury and increase rep debt (record as negative amount)
                        $txType3 = pick_allowed_enum($pdo, 'transactions', 'type', 'rep_payment_out', ['rep_payment_out','payment_out','payment','rep_settlement']);
                        $rel_local3 = pick_allowed_enum($pdo, 'transactions', 'related_to_type', 'rep', ['rep','employee','none']);
                        // Use negative amount to reflect increased debt (consistent with assignment insertion using negative amounts)
                        execute_query($pdo, "INSERT INTO transactions (type, warehouse_id, treasury_id, related_to_type, related_to_id, amount, transaction_date, details) VALUES (?, ?, ?, ?, ?, ?, NOW(), ?)", [$txType3, $warehouseId ?: null, $treasuryId, $rel_local3, $repId, -1 * $amt, json_encode(['direction'=>'out','context'=>'close_daily','orders'=>$orders,'rep_id'=>$repId,'assignment_tx_id'=>$assignmentTxId,'model'=>'consignment'])]);
                        if ($treasuryId) execute_query($pdo, "UPDATE treasuries SET current_balance = current_balance - ? WHERE id = ?", [$amt, $treasuryId]);
                    }
                }

                // ── Assign today's orders to the rep in the DB ──
                // Set rep_id + status = 'with_rep' on every newly-selected order so they are
                // locked to this rep and no longer appear as available to other reps.
                if (!empty($orders)) {
                    $inIds = implode(',', array_map('intval', $orders));
                    $withRepAllowed = pick_allowed_enum($pdo, 'orders', 'status', 'with_rep', ['with_rep','in_delivery','pending']);
                    // Also allow reassigning returned/pending orders even if they still carry an old rep_id
                    // from a previous assignment (e.g. the order was returned but rep_id was not cleared).
                    if (column_exists($pdo, 'orders', 'updated_at')) {
                        $pdo->exec("UPDATE orders SET rep_id = $repId, status = '$withRepAllowed', updated_at = NOW() WHERE id IN ($inIds) AND (rep_id IS NULL OR rep_id = $repId OR status IN ('returned', 'pending'))");
                    } else {
                        $pdo->exec("UPDATE orders SET rep_id = $repId, status = '$withRepAllowed' WHERE id IN ($inIds) AND (rep_id IS NULL OR rep_id = $repId OR status IN ('returned', 'pending'))");
                    }
                    // Log history for each newly assigned order
                    foreach ($orders as $oid) {
                        try { log_order_history($pdo, intval($oid), $withRepAllowed, 'rep_assign', 'daily_assignment', $repId); } catch (Exception $ex) {}
                    }
                }

                $pdo->commit();

                // ── Insert/update rep_journal_orders so SalesDailyClose can query from this table ──
                try {
                    ensure_rep_journal_orders_table($pdo);
                    $jNow     = date('Y-m-d');
                    $jNowTime = date('H:i:s');
                    $jEmployee = $_SESSION['user']['name'] ?? null;
                    foreach ($orders as $jOid) {
                        $jOid = intval($jOid);
                        if ($jOid <= 0) continue;
                        $pdo->prepare(
                            "INSERT INTO rep_journal_orders (journal_id, rep_id, order_id, status, event_date, event_time, employee)
                             VALUES (?, ?, ?, 'with_rep', ?, ?, ?)
                             ON DUPLICATE KEY UPDATE
                               journal_id = VALUES(journal_id),
                               status     = IF(status IN ('delivered','full_return','partial_return'), status, 'with_rep'),
                               event_date = IF(status IN ('delivered','full_return','partial_return'), event_date, VALUES(event_date)),
                               event_time = IF(status IN ('delivered','full_return','partial_return'), event_time, VALUES(event_time)),
                               employee   = IF(status IN ('delivered','full_return','partial_return'), employee,   VALUES(employee))"
                        )->execute([$journalId, $repId, $jOid, $jNow, $jNowTime, $jEmployee]);
                    }
                } catch (Exception $jEx) {
                    error_log('rep_journal_orders insert failed (non-critical): ' . $jEx->getMessage());
                }

                audit_log($pdo, 'sales', 'complete_daily', $repId, json_encode(['orders' => $orders, 'total' => $totalAmount]));

                // Prepare print/report data to return to client
                // Some installations keep reps as users with role='representative'.
                if (column_exists($pdo, 'representatives', 'id')) {
                    $repStmt = execute_query($pdo, "SELECT id, name FROM representatives WHERE id = ? LIMIT 1", [$repId]);
                    $repData = $repStmt->fetch(PDO::FETCH_ASSOC);
                } else {
                    $repStmt = execute_query($pdo, "SELECT id, name FROM users WHERE id = ? AND role = 'representative' LIMIT 1", [$repId]);
                    $repData = $repStmt->fetch(PDO::FETCH_ASSOC);
                }
                // Try to compute previous balance from transactions
                $repRelatedType = pick_allowed_enum($pdo, 'transactions', 'related_to_type', 'rep', ['rep','employee','none']);
                $balStmt = execute_query($pdo, "SELECT COALESCE(SUM(CASE WHEN related_to_type = ? THEN amount ELSE 0 END),0) as bal FROM transactions WHERE related_to_type = ? AND related_to_id = ?", [$repRelatedType, $repRelatedType, $repId]);
                $balRow = $balStmt->fetch(PDO::FETCH_ASSOC);
                $prevBalance = floatval($balRow['bal'] ?? 0);

                echo json_encode(['success' => true, 'daily_code' => $dailyCode ?? '', 'journal_id' => $journalId ?? 0, 'printData' => ['repName' => $repData['name'] ?? '', 'employee' => $_SESSION['user']['name'] ?? null, 'prevBalance' => $prevBalance], 'reportData' => ['prevBalance' => $prevBalance]]);
            } catch (Exception $e) {
                try { if ($pdo instanceof PDO && $pdo->inTransaction()) $pdo->rollBack(); } catch (Exception $ex) {}
                http_response_code(500);
                echo json_encode(['success' => false, 'message' => 'Complete daily failed: ' . $e->getMessage()]);
            }
            break;
        } elseif ($action === 'create') {
            $customerId = intval($input['customerId'] ?? 0);
            $warehouseId = intval($input['warehouseId'] ?? 0);
            $treasuryId = intval($input['treasuryId'] ?? 0);
            $items = $input['items'] ?? [];
            $paidAmount = isset($input['paidAmount']) ? floatval($input['paidAmount']) : 0;

            $sale_reason = isset($input['reason']) ? trim($input['reason']) : (isset($input['notes']) ? trim($input['notes']) : '');

            // Enforce/apply user defaults for warehouse/treasury on sale creation
            $defaults = get_user_defaults($pdo);
            if ($defaults) {
                $defWid = isset($defaults['default_warehouse_id']) ? intval($defaults['default_warehouse_id']) : null;
                $canChangeW = isset($defaults['can_change_warehouse']) ? boolval($defaults['can_change_warehouse']) : true;
                if (!$canChangeW && $defWid) {
                    if ($warehouseId && $warehouseId !== $defWid) { http_response_code(400); echo json_encode(['success'=>false,'message'=>'المستودع مقفل للمستخدم الحالي ولا يمكن تغييره.']); break; }
                    if (!$warehouseId) $warehouseId = $defWid;
                } else { if (!$warehouseId && $defWid) $warehouseId = $defWid; }

                $defTid = isset($defaults['default_treasury_id']) ? intval($defaults['default_treasury_id']) : null;
                $canChangeT = isset($defaults['can_change_treasury']) ? boolval($defaults['can_change_treasury']) : true;
                if (!$canChangeT && $defTid) {
                    if ($treasuryId && $treasuryId !== $defTid) { http_response_code(400); echo json_encode(['success'=>false,'message'=>'الخزينة مقفلة للمستخدم ولا يمكن تغييرها.']); break; }
                    if (!$treasuryId) $treasuryId = $defTid;
                } else { if (!$treasuryId && $defTid) $treasuryId = $defTid; }
            }

            if ($paidAmount > 0 && $treasuryId <= 0) {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'Treasury is required when paidAmount > 0.']);
                break;
            }

            if (!$customerId || !$warehouseId || !is_array($items) || count($items) === 0) {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'Missing required sale data.']);
                break;
            }

            if (empty($sale_reason)) {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'يرجى تحديد سبب المعاملة (reason) في حقل "notes" أو "reason" عند تسجيل بيع يؤثر على المخزون.']);
                break;
            }

            try {
                $pdo->beginTransaction();
                $current_user = $_SESSION['user_id'] ?? null;
                $total = 0;
                foreach ($items as $it) {
                    $qty = intval($it['qty'] ?? 0);
                    $price = isset($it['price']) ? floatval($it['price']) : 0;
                    $total += $qty * $price;
                }

                // Create sale transaction
                $txType_local = pick_allowed_enum($pdo, 'transactions', 'type', 'sale', ['sale','payment_in','payment_out','transfer','purchase']);
                $rel_local = pick_allowed_enum($pdo, 'transactions', 'related_to_type', 'customer', ['customer','rep','supplier','none']);
                execute_query($pdo, "INSERT INTO transactions (type, warehouse_id, treasury_id, related_to_type, related_to_id, amount, transaction_date, details) VALUES (?, ?, ?, ?, ?, ?, NOW(), ?)", [$txType_local, $warehouseId, null, $rel_local, $customerId, $total, json_encode($items)]);
                $saleId = $pdo->lastInsertId();

                // Process stock decrement and movements
                foreach ($items as $it) {
                    $qty = intval($it['qty'] ?? 0);
                    if ($qty <= 0) continue;
                    $productId = intval($it['productId'] ?? 0);
                    if (!$productId) continue;

                    $stmt = execute_query($pdo, "SELECT quantity FROM stock WHERE product_id = ? AND warehouse_id = ?", [$productId, $warehouseId]);
                    $prevQty = 0;
                    if ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
                        $prevQty = intval($row['quantity']);
                        $newQty = $prevQty - $qty;
                        if ($newQty < 0) $newQty = 0;
                        execute_query($pdo, "UPDATE stock SET quantity = ? WHERE product_id = ? AND warehouse_id = ?", [$newQty, $productId, $warehouseId]);
                    } else {
                        $newQty = 0;
                        execute_query($pdo, "INSERT INTO stock (product_id, warehouse_id, quantity) VALUES (?, ?, ?)", [$productId, $warehouseId, 0]);
                    }

                    $movement_notes = json_encode(array_merge(is_array($it) ? $it : ['info' => $it], ['reason' => $sale_reason]));
                    execute_query($pdo, "INSERT INTO product_movements (product_id, warehouse_id, movement_type, quantity_change, previous_quantity, new_quantity, reference_id, reference_type, notes, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", [$productId, $warehouseId, 'sale', -$qty, $prevQty, $newQty, $saleId, 'sale_invoice', $movement_notes, $current_user]);
                }

                // Update customer totals (increase debit)
                if ($total > 0) {
                    execute_query($pdo, "UPDATE customers SET total_debit = total_debit + ? WHERE id = ?", [$total, $customerId]);
                }

                // Handle payment received
                if ($paidAmount > 0) {
                    $txType_local = pick_allowed_enum($pdo, 'transactions', 'type', 'payment_in', ['payment_in','payment','payment_out']);
                    $rel_local = pick_allowed_enum($pdo, 'transactions', 'related_to_type', 'customer', ['customer','rep','supplier','none']);
                    execute_query($pdo, "INSERT INTO transactions (type, warehouse_id, treasury_id, related_to_type, related_to_id, amount, transaction_date, details) VALUES (?, ?, ?, ?, ?, ?, NOW(), ?)", [$txType_local, $warehouseId, $treasuryId, $rel_local, $customerId, $paidAmount, json_encode(['paid_for' => $saleId])]);
                    execute_query($pdo, "UPDATE customers SET total_credit = total_credit + ? WHERE id = ?", [$paidAmount, $customerId]);

                    // Update treasury balance (cash in)
                    if ($treasuryId) {
                        execute_query($pdo, "SELECT current_balance FROM treasuries WHERE id = ? FOR UPDATE", [$treasuryId]);
                        execute_query($pdo, "UPDATE treasuries SET current_balance = current_balance + ? WHERE id = ?", [$paidAmount, $treasuryId]);
                    }
                }

                $pdo->commit();
                echo json_encode(['success' => true, 'sale_id' => $saleId, 'total' => $total]);
            } catch (Exception $e) {
                $pdo->rollBack();
                http_response_code(500);
                echo json_encode(['success' => false, 'message' => 'Sale failed: ' . $e->getMessage()]);
            }
        }
        break;
    case 'customer_returns':
        $action = $_GET['action'] ?? 'create';
        if ($action === 'create') {
            $customerId = intval($input['customerId'] ?? 0);
            $warehouseId = intval($input['warehouseId'] ?? 0);
            $items = $input['items'] ?? [];
            $refundAmount = isset($input['refundAmount']) ? floatval($input['refundAmount']) : 0;

            if (!$customerId || !$warehouseId || !is_array($items) || count($items) === 0) {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'Missing required return data.']);
                break;
            }

            $return_reason = isset($input['reason']) ? trim($input['reason']) : (isset($input['notes']) ? trim($input['notes']) : '');
            if (empty($return_reason)) {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'يرجى تحديد سبب عملية الاسترجاع (reason) في حقل "notes" أو "reason".']);
                break;
            }

            try {
                $pdo->beginTransaction();
                $returnTotal = 0;
                foreach ($items as $it) {
                    $qty = intval($it['qty'] ?? 0);
                    $price = isset($it['price']) ? floatval($it['price']) : 0;
                    $returnTotal += $qty * $price;
                }

                $txType_local = pick_allowed_enum($pdo, 'transactions', 'type', 'return_in', ['return_in','return_out','payment_in','sale']);
                $rel_local = pick_allowed_enum($pdo, 'transactions', 'related_to_type', 'customer', ['customer','rep','supplier','none']);
                execute_query($pdo, "INSERT INTO transactions (type, warehouse_id, treasury_id, related_to_type, related_to_id, amount, transaction_date, details) VALUES (?, ?, ?, ?, ?, ?, NOW(), ?)", [$txType_local, $warehouseId, null, $rel_local, $customerId, $returnTotal, json_encode($items)]);
                $returnId = $pdo->lastInsertId();

                foreach ($items as $it) {
                    $qty = intval($it['qty'] ?? 0);
                    if ($qty <= 0) continue;
                    $productId = intval($it['productId'] ?? 0);
                    if (!$productId) continue;

                    $stmt = execute_query($pdo, "SELECT quantity FROM stock WHERE product_id = ? AND warehouse_id = ?", [$productId, $warehouseId]);
                    $prevQty = 0;
                    if ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
                        $prevQty = intval($row['quantity']);
                        $newQty = $prevQty + $qty;
                        execute_query($pdo, "UPDATE stock SET quantity = ? WHERE product_id = ? AND warehouse_id = ?", [$newQty, $productId, $warehouseId]);
                    } else {
                        $newQty = $qty;
                        execute_query($pdo, "INSERT INTO stock (product_id, warehouse_id, quantity) VALUES (?, ?, ?)", [$productId, $warehouseId, $newQty]);
                    }

                    $movement_notes = json_encode(array_merge(is_array($it) ? $it : ['info' => $it], ['reason' => $return_reason]));
                    execute_query($pdo, "INSERT INTO product_movements (product_id, warehouse_id, movement_type, quantity_change, previous_quantity, new_quantity, reference_id, reference_type, notes, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", [$productId, $warehouseId, 'return_in', $qty, $prevQty, $newQty, $returnId, 'customer_return', $movement_notes, null]);
                }

                // Decrease customer debit by returnTotal
                if ($returnTotal > 0) {
                    execute_query($pdo, "UPDATE customers SET total_debit = total_debit - ? WHERE id = ?", [$returnTotal, $customerId]);
                }

                // Handle refund to customer
                if ($refundAmount > 0) {
                    $txType_local = pick_allowed_enum($pdo, 'transactions', 'type', 'payment_out', ['payment_out','payment','payment_in']);
                    $rel_local = pick_allowed_enum($pdo, 'transactions', 'related_to_type', 'customer', ['customer','rep','supplier','none']);
                    execute_query($pdo, "INSERT INTO transactions (type, warehouse_id, treasury_id, related_to_type, related_to_id, amount, transaction_date, details) VALUES (?, ?, ?, ?, ?, ?, NOW(), ?)", [$txType_local, $warehouseId, null, $rel_local, $customerId, $refundAmount, json_encode(['refund_for' => $returnId])]);
                    execute_query($pdo, "UPDATE customers SET total_credit = total_credit + ? WHERE id = ?", [$refundAmount, $customerId]);
                }

                $pdo->commit();
                echo json_encode(['success' => true, 'return_id' => $returnId, 'total' => $returnTotal]);
            } catch (Exception $e) {
                $pdo->rollBack();
                http_response_code(500);
                echo json_encode(['success' => false, 'message' => 'Customer return failed: ' . $e->getMessage()]);
            }
        }
        break;
    case 'employee_transactions':
        ensure_hrm_tables($pdo);
        try {
            $action = $_GET['action'] ?? 'getAll';

            if ($action === 'create') {
                $pdo->beginTransaction();
                try {
                    $employee_id = $input['employee_id'] ?? 0;
                    $treasury_id = $input['treasury_id'] ?? null;
                    $amount = floatval($input['amount'] ?? 0);
                    $type = $input['type'] ?? '';
                    $date = $input['date'] ?? date('Y-m-d');
                    $notes = $input['notes'] ?? '';

                    // apply user defaults for treasury (if set) and enforce lock
                    $defaults = get_user_defaults($pdo);
                    if ($defaults) {
                        $defTid = isset($defaults['default_treasury_id']) ? intval($defaults['default_treasury_id']) : null;
                        $canChangeT = isset($defaults['can_change_treasury']) ? boolval($defaults['can_change_treasury']) : true;
                        if (!$canChangeT && $defTid) {
                            if ($treasury_id && intval($treasury_id) !== $defTid) { throw new Exception('الخزينة مقفلة للمستخدم ولا يمكن تغييرها.'); }
                            if (!$treasury_id) $treasury_id = $defTid;
                        } else { if (!$treasury_id && $defTid) $treasury_id = $defTid; }
                    }

                    if (empty($employee_id) || empty($type) || $amount <= 0) {
                         throw new Exception('Employee, transaction type and a positive amount are required.');
                    }

                    $empStmt = execute_query($pdo, "SELECT salary, hire_date FROM employees WHERE id = ?", [$employee_id]);
                    $employee = $empStmt->fetch(PDO::FETCH_ASSOC);
                    if (!$employee) {
                        throw new Exception('Employee not found.');
                    }
                    $salary = floatval($employee['salary']);

                    if ($type === 'advance' || $type === 'bonus') {
                        if (empty($treasury_id)) {
                            throw new Exception('Treasury is required for this transaction type.');
                        }
                        $treasuryStmt = execute_query($pdo, "SELECT current_balance FROM treasuries WHERE id = ? FOR UPDATE", [$treasury_id]);
                        $treasury = $treasuryStmt->fetch(PDO::FETCH_ASSOC);
                        if (!$treasury || floatval($treasury['current_balance']) < $amount) {
                            throw new Exception('رصيد الخزينه لا يكفي لإتمام هذه العملية.');
                        }
                    }
                    
                    if ($type === 'advance') {
                        $month = date('Y-m', strtotime($date));
                        $month_start = date('Y-m-01', strtotime($date));
                        $days_in_month = date('t', strtotime($date));

                        $hire_date_dt = new DateTime($employee['hire_date']);
                        $transaction_date_dt = new DateTime($date);
                        $month_start_dt = new DateTime($month_start);

                        $days_worked = 0;
                        if($transaction_date_dt >= $month_start_dt){
                            $start_period = ($hire_date_dt > $month_start_dt) ? $hire_date_dt : $month_start_dt;
                            if($transaction_date_dt >= $start_period) {
                               $days_worked = $transaction_date_dt->diff($start_period)->days + 1;
                            }
                        }

                        if ($days_worked > $days_in_month) $days_worked = $days_in_month;
                        
                        $earned_salary = ($salary / $days_in_month) * $days_worked;

                        $txStmt = execute_query($pdo, "SELECT type, SUM(amount) as total FROM employee_transactions WHERE employee_id = ? AND DATE_FORMAT(date, '%Y-%m') = ? AND type IN ('advance', 'penalty') GROUP BY type", [$employee_id, $month]);
                        $monthly_tx = $txStmt->fetchAll(PDO::FETCH_KEY_PAIR);

                        $advances_total = floatval($monthly_tx['advance'] ?? 0);
                        $penalties_total = floatval($monthly_tx['penalty'] ?? 0);

                        $withdrawable_balance = $earned_salary - $advances_total - $penalties_total;

                        if ($amount > $withdrawable_balance) {
                            throw new Exception('Advance amount (' . $amount . ') exceeds the employee\'s available balance (' . number_format($withdrawable_balance,2) . ') for the month.');
                        }
                    }

                    $sql = "INSERT INTO employee_transactions (employee_id, treasury_id, amount, type, date, notes, status) VALUES (?, ?, ?, ?, ?, ?, ?)";
                    $status = 'deducted';
                    
                    execute_query($pdo, $sql, [$employee_id, $treasury_id, $amount, $type, $date, $notes, $status]);

                    if ($type === 'advance' || $type === 'bonus') {
                         execute_query($pdo, "UPDATE treasuries SET current_balance = current_balance - ? WHERE id = ?", [$amount, $treasury_id]);
                    }
                    
                    $pdo->commit();
                    echo json_encode(['success' => true, 'message' => 'Transaction added successfully.']);

                } catch (Exception $e) {
                    if ($pdo->inTransaction()) {
                        $pdo->rollBack();
                    }
                    throw $e;
                }
            } else {
                 handle_crud($pdo, 'employee_transactions', $input, ['employee_id', 'treasury_id', 'amount', 'type', 'date', 'notes', 'status']);
            }
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => 'An error occurred in employee transactions: ' . $e->getMessage()]);
        }
        break;
    case 'employee_salaries':
        ensure_hrm_tables($pdo);
        ensure_attendance_tables($pdo);
        try {
            $action = $_GET['action'] ?? 'getForMonth';
            if ($action === 'getForMonth') {
                $month = $_GET['month'] ?? date('Y-m');
                $stmt = execute_query($pdo,
                    "SELECT s.*, e.name as employee_name FROM employee_salaries s JOIN employees e ON s.employee_id = e.id WHERE s.month = ?",
                    [$month]
                );
                echo json_encode(['success' => true, 'data' => $stmt->fetchAll(PDO::FETCH_ASSOC)]);
            } elseif ($action === 'processPayroll') {
                $month = $input['month'] ?? date('Y-m');
                $includeAttendance = isset($input['include_attendance']) ? boolval($input['include_attendance']) : true;
                $generateAttendance = isset($input['generate_attendance']) ? boolval($input['generate_attendance']) : true;

                $employeesStmt = execute_query($pdo, "SELECT id, name, salary FROM employees WHERE status = 'active'");
                $employees = $employeesStmt->fetchAll(PDO::FETCH_ASSOC);

                $monthStart = $month . '-01';
                $monthEnd = date('Y-m-t', strtotime($monthStart));
                $attendanceMap = [];
                if ($includeAttendance) {
                    try {
                        if ($generateAttendance) {
                            $pdo->beginTransaction();
                            attendance_generate_summary_range($pdo, $monthStart, $monthEnd);
                            $pdo->commit();
                        }
                    } catch (Exception $e) {
                        if ($pdo->inTransaction()) $pdo->rollBack();
                    }

                    try {
                        $attendanceStmt = execute_query(
                            $pdo,
                            "SELECT s.employee_id,
                                    SUM(s.late_minutes * sh.late_penalty_per_minute) AS late_penalty,
                                    SUM(s.early_leave_minutes * sh.early_leave_penalty_per_minute) AS early_penalty,
                                    SUM(s.is_absent * sh.absence_penalty_per_day) AS absence_penalty,
                                    SUM((s.overtime_minutes / 60) * sh.overtime_rate_per_hour) AS overtime_bonus
                             FROM attendance_daily_summary s
                             LEFT JOIN attendance_shifts sh ON sh.id = s.shift_id
                             WHERE s.work_date BETWEEN ? AND ?
                             GROUP BY s.employee_id",
                            [$monthStart, $monthEnd]
                        );
                        foreach ($attendanceStmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
                            $attendanceMap[intval($row['employee_id'])] = [
                                'deductions' => floatval($row['late_penalty'] ?? 0) + floatval($row['early_penalty'] ?? 0) + floatval($row['absence_penalty'] ?? 0),
                                'bonuses' => floatval($row['overtime_bonus'] ?? 0)
                            ];
                        }
                    } catch (Exception $e) {
                        $attendanceMap = [];
                    }
                }

                $pdo->beginTransaction();
                try {
                    foreach ($employees as $employee) {
                        // Get all pending transactions for the employee for the given month or earlier
                        $txStmt = execute_query($pdo,
                            "SELECT type, amount FROM employee_transactions WHERE employee_id = ? AND status = 'pending' AND DATE_FORMAT(date, '%Y-%m') <= ?",
                            [$employee['id'], $month]
                        );
                        $transactions = $txStmt->fetchAll(PDO::FETCH_ASSOC);

                        $advances = 0;
                        $penalties = 0;
                        $bonuses = 0;

                        foreach($transactions as $tx) {
                            if ($tx['type'] === 'advance') {
                                $advances += floatval($tx['amount']);
                            } elseif ($tx['type'] === 'penalty') {
                                $penalties += floatval($tx['amount']);
                            } elseif ($tx['type'] === 'bonus') {
                                $bonuses += floatval($tx['amount']);
                            }
                        }
                        
                        $attendanceDeductions = $attendanceMap[intval($employee['id'])]['deductions'] ?? 0;
                        $attendanceBonuses = $attendanceMap[intval($employee['id'])]['bonuses'] ?? 0;

                        $deductions = $advances + $penalties + $attendanceDeductions;
                        $base_salary = floatval($employee['salary']);
                        $net_salary = $base_salary + $bonuses + $attendanceBonuses - $deductions;

                        $totalBonuses = $bonuses + $attendanceBonuses;

                        $sql = "INSERT INTO employee_salaries (employee_id, month, base_salary, deductions, bonuses, net_salary, status)
                            VALUES (?, ?, ?, ?, ?, ?, 'pending')
                            ON DUPLICATE KEY UPDATE
                            base_salary = VALUES(base_salary),
                            deductions = VALUES(deductions),
                            bonuses = VALUES(bonuses),
                            net_salary = VALUES(net_salary),
                            status = 'pending'";
                        execute_query($pdo, $sql, [$employee['id'], $month, $base_salary, $deductions, $totalBonuses, $net_salary]);
                        
                        // Mark the processed transactions as 'deducted' for the current employee
                        execute_query($pdo, "UPDATE employee_transactions SET status = 'deducted' WHERE employee_id = ? AND status = 'pending' AND DATE_FORMAT(date, '%Y-%m') <= ?", [$employee['id'], $month]);
                    }

                    $pdo->commit();
                    echo json_encode(['success' => true, 'message' => 'Payroll processed successfully for ' . $month]);
                } catch (Exception $e) {
                    $pdo->rollBack();
                    http_response_code(500);
                    echo json_encode(['success' => false, 'message' => 'Payroll processing failed: ' . $e->getMessage()]);
                }
            } elseif ($action === 'getReport') {
                $employee_id = intval($_GET['employee_id'] ?? 0);
                $month = $_GET['month'] ?? date('Y-m');

                if (!$employee_id) {
                    http_response_code(400);
                    echo json_encode(['success' => false, 'message' => 'Employee ID is required.']);
                    break;
                }

                $empStmt = execute_query($pdo, "SELECT id, name, job_title, salary FROM employees WHERE id = ? LIMIT 1", [$employee_id]);
                $employee = $empStmt->fetch(PDO::FETCH_ASSOC);
                if (!$employee) {
                    http_response_code(404);
                    echo json_encode(['success' => false, 'message' => 'Employee not found.']);
                    break;
                }

                $monthStart = $month . '-01';
                $monthEnd = date('Y-m-t', strtotime($monthStart));

                $attendanceStmt = execute_query(
                    $pdo,
                    "SELECT s.*, sh.name as shift_name,
                            sh.late_penalty_per_minute, sh.early_leave_penalty_per_minute,
                            sh.absence_penalty_per_day, sh.overtime_rate_per_hour
                     FROM attendance_daily_summary s
                     LEFT JOIN attendance_shifts sh ON sh.id = s.shift_id
                     WHERE s.employee_id = ? AND s.work_date BETWEEN ? AND ?
                     ORDER BY s.work_date ASC",
                    [$employee_id, $monthStart, $monthEnd]
                );
                $attendanceRows = $attendanceStmt->fetchAll(PDO::FETCH_ASSOC);

                $lateMinutes = 0;
                $earlyMinutes = 0;
                $overtimeMinutes = 0;
                $absentDays = 0;
                $presentDays = 0;
                $lateDays = 0;
                $holidayDays = 0;

                $latePenalty = 0;
                $earlyPenalty = 0;
                $absencePenalty = 0;
                $overtimeBonus = 0;

                foreach ($attendanceRows as $row) {
                    $lateMinutes += intval($row['late_minutes'] ?? 0);
                    $earlyMinutes += intval($row['early_leave_minutes'] ?? 0);
                    $overtimeMinutes += intval($row['overtime_minutes'] ?? 0);
                    $absentDays += intval($row['is_absent'] ?? 0);

                    $status = $row['status'] ?? '';
                    if ($status === 'present') $presentDays++;
                    if ($status === 'late') $lateDays++;
                    if ($status === 'holiday') $holidayDays++;

                    $latePenalty += floatval($row['late_minutes'] ?? 0) * floatval($row['late_penalty_per_minute'] ?? 0);
                    $earlyPenalty += floatval($row['early_leave_minutes'] ?? 0) * floatval($row['early_leave_penalty_per_minute'] ?? 0);
                    $absencePenalty += floatval($row['is_absent'] ?? 0) * floatval($row['absence_penalty_per_day'] ?? 0);
                    $overtimeBonus += (floatval($row['overtime_minutes'] ?? 0) / 60) * floatval($row['overtime_rate_per_hour'] ?? 0);
                }

                $txStmt = execute_query(
                    $pdo,
                    "SELECT id, amount, type, date, notes, status FROM employee_transactions WHERE employee_id = ? AND date BETWEEN ? AND ? ORDER BY date ASC",
                    [$employee_id, $monthStart, $monthEnd]
                );
                $txRows = $txStmt->fetchAll(PDO::FETCH_ASSOC);

                $advances = 0;
                $manualBonuses = 0;
                $manualPenalties = 0;
                $salaryPaid = 0;

                foreach ($txRows as $tx) {
                    if ($tx['type'] === 'advance') $advances += floatval($tx['amount'] ?? 0);
                    if ($tx['type'] === 'bonus') $manualBonuses += floatval($tx['amount'] ?? 0);
                    if ($tx['type'] === 'penalty') $manualPenalties += floatval($tx['amount'] ?? 0);
                    if ($tx['type'] === 'salary') $salaryPaid += floatval($tx['amount'] ?? 0);
                }

                $salaryStmt = execute_query($pdo, "SELECT id, net_salary, status, paid_at FROM employee_salaries WHERE employee_id = ? AND month = ? LIMIT 1", [$employee_id, $month]);
                $salaryRow = $salaryStmt->fetch(PDO::FETCH_ASSOC);

                $attendanceDeductions = $latePenalty + $earlyPenalty + $absencePenalty;
                $bonuses = $manualBonuses + $overtimeBonus;
                $deductions = $manualPenalties + $advances + $attendanceDeductions;
                $baseSalary = floatval($employee['salary'] ?? 0);
                $netEstimate = $baseSalary + $bonuses - $deductions;

                echo json_encode([
                    'success' => true,
                    'data' => [
                        'employee' => $employee,
                        'month' => $month,
                        'attendance' => [
                            'rows' => $attendanceRows,
                            'totals' => [
                                'late_minutes' => $lateMinutes,
                                'early_leave_minutes' => $earlyMinutes,
                                'overtime_minutes' => $overtimeMinutes,
                                'absent_days' => $absentDays,
                                'present_days' => $presentDays,
                                'late_days' => $lateDays,
                                'holiday_days' => $holidayDays
                            ],
                            'penalties' => [
                                'late_penalty' => $latePenalty,
                                'early_penalty' => $earlyPenalty,
                                'absence_penalty' => $absencePenalty,
                                'overtime_bonus' => $overtimeBonus
                            ]
                        ],
                        'transactions' => [
                            'rows' => $txRows,
                            'totals' => [
                                'advances' => $advances,
                                'manual_bonuses' => $manualBonuses,
                                'manual_penalties' => $manualPenalties,
                                'salary_paid' => $salaryPaid
                            ]
                        ],
                        'salary' => $salaryRow,
                        'computed' => [
                            'base_salary' => $baseSalary,
                            'attendance_deductions' => $attendanceDeductions,
                            'bonuses' => $bonuses,
                            'deductions' => $deductions,
                            'net_estimate' => $netEstimate
                        ]
                    ]
                ]);
            } elseif ($action === 'pay') {
                $pdo->beginTransaction();
                try {
                    $salary_id = $input['id'] ?? 0;
                    $treasury_id = $input['treasury_id'] ?? 0;

                    if (!$salary_id || !$treasury_id) {
                        throw new Exception('Salary ID and Treasury ID are required.');
                    }

                    // Get salary details
                    $salaryStmt = execute_query($pdo, "SELECT employee_id, net_salary FROM employee_salaries WHERE id = ? AND status = 'pending'", [$salary_id]);
                    $salary = $salaryStmt->fetch(PDO::FETCH_ASSOC);

                    if (!$salary) {
                        throw new Exception('Salary not found or already paid.');
                    }

                    $net_salary = floatval($salary['net_salary']);
                    $employee_id = $salary['employee_id'];

                    // Check treasury balance
                    $treasuryStmt = execute_query($pdo, "SELECT current_balance FROM treasuries WHERE id = ? FOR UPDATE", [$treasury_id]);
                    $treasury = $treasuryStmt->fetch(PDO::FETCH_ASSOC);

                    if (!$treasury || floatval($treasury['current_balance']) < $net_salary) {
                        throw new Exception('رصيد الخزينه لا يكفي لإتمام هذه العملية.');
                    }

                    // Update salary status
                    execute_query($pdo, "UPDATE employee_salaries SET status = 'paid', paid_at = NOW() WHERE id = ?", [$salary_id]);

                    // Create salary transaction
                    $notes = 'راتب شهر ' . date('Y-m');
                    execute_query($pdo, "INSERT INTO employee_transactions (employee_id, treasury_id, amount, type, date, notes, status) VALUES (?, ?, ?, ?, NOW(), ?, ?)",
                        [$employee_id, $treasury_id, $net_salary, 'salary', $notes, 'deducted']);

                    // Update treasury balance
                    execute_query($pdo, "UPDATE treasuries SET current_balance = current_balance - ? WHERE id = ?", [$net_salary, $treasury_id]);

                    $pdo->commit();
                    echo json_encode(['success' => true, 'message' => 'Salary paid successfully.']);

                } catch (Exception $e) {
                    if ($pdo->inTransaction()) {
                        $pdo->rollBack();
                    }
                    http_response_code(500);
                    echo json_encode(['success' => false, 'message' => $e->getMessage()]);
                }
            }
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => 'An error occurred in salaries module: ' . $e->getMessage()]);
        }
        break;
    case 'receivings':
        $action = $_GET['action'] ?? 'create';
        if ($action === 'create') {
            $supplierId = intval($input['supplierId'] ?? 0);
            $warehouseId = intval($input['warehouseId'] ?? 0);
            $items = $input['items'] ?? [];
            $paidAmount = isset($input['paidAmount']) ? floatval($input['paidAmount']) : 0;
            $notes = trim((string)($input['notes'] ?? ''));
            $treasuryId = null;
            if (isset($input['treasuryId'])) {
                $tmpTid = intval($input['treasuryId']);
                if ($tmpTid > 0) $treasuryId = $tmpTid;
            }
            $defaults = get_user_defaults($pdo);
            if ($defaults) {
                $defWid = isset($defaults['default_warehouse_id']) ? intval($defaults['default_warehouse_id']) : null;
                $canChangeW = isset($defaults['can_change_warehouse']) ? boolval($defaults['can_change_warehouse']) : true;
                if (!$canChangeW && $defWid) {
                    if ($warehouseId && $warehouseId !== $defWid) { http_response_code(400); echo json_encode(['success'=>false,'message'=>'المستودع مقفل للمستخدم ولا يمكن تغييره.']); break; }
                    if (!$warehouseId) $warehouseId = $defWid;
                } else { if (!$warehouseId && $defWid) $warehouseId = $defWid; }
                $defTid = isset($defaults['default_treasury_id']) ? intval($defaults['default_treasury_id']) : null;
                $canChangeT = isset($defaults['can_change_treasury']) ? boolval($defaults['can_change_treasury']) : true;
                if (!$canChangeT && $defTid) {
                    if ($treasuryId && $treasuryId !== $defTid) { http_response_code(400); echo json_encode(['success'=>false,'message'=>'الخزينة مقفلة للمستخدم ولا يمكن تغييرها.']); break; }
                    if (!$treasuryId) $treasuryId = $defTid;
                } else { if (!$treasuryId && $defTid) $treasuryId = $defTid; }
            }
            if (!$supplierId || !$warehouseId || !is_array($items) || count($items) === 0) {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'Missing required receiving data.']);
                break;
            }
            try {
                $pdo->beginTransaction();
                $invoiceTotal = 0;
                $newBarcodes = [];
                $created_by = $_SESSION['user_id'] ?? null;
                foreach ($items as $it) {
                    $itemType_local = $it['itemType'] ?? 'product';
                    $baseType_local = preg_replace('/_(new|existing)$/', '', (string)$itemType_local);
                    if (!in_array($baseType_local, ['product','fabric','accessory'], true)) { $baseType_local = 'product'; }
                    $qty = ($baseType_local === 'fabric') ? floatval($it['qty'] ?? 0) : intval($it['qty'] ?? 0);
                    $cost = isset($it['costPrice']) ? floatval($it['costPrice']) : 0;
                    $vendorPriceForTotal = isset($it['vendorPrice']) ? floatval($it['vendorPrice']) : 0;
                    $invoiceTotal += $qty * ($vendorPriceForTotal > 0 ? $vendorPriceForTotal : $cost);
                }
                $txType_local = pick_allowed_enum($pdo, 'transactions', 'type', 'purchase', ['purchase','sale','transfer']);
                $rel_local = pick_allowed_enum($pdo, 'transactions', 'related_to_type', 'supplier', ['supplier','rep','customer','none']);
                $detailsPayload = $items;
                if ($notes !== '') {
                    $detailsPayload = ['items' => $items, 'notes' => $notes];
                }
                $stmt = execute_query($pdo, "INSERT INTO transactions (type, warehouse_id, treasury_id, related_to_type, related_to_id, amount, transaction_date, details) VALUES (?, ?, ?, ?, ?, ?, NOW(), ?)", [$txType_local, $warehouseId, $treasuryId, $rel_local, $supplierId, $invoiceTotal, json_encode($detailsPayload)]);
                $purchaseId = $pdo->lastInsertId();
                foreach ($items as $it) {
                    $productId = intval($it['productId'] ?? 0);
                    $itemType = $it['itemType'] ?? 'product';
                    $baseType = preg_replace('/_(new|existing)$/', '', (string)$itemType);
                    if (!in_array($baseType, ['product','fabric','accessory'], true)) { $baseType = 'product'; }
                    $qty = ($baseType === 'fabric') ? floatval($it['qty'] ?? 0) : intval($it['qty'] ?? 0);
                    if ($qty <= 0) continue;

                    $barcode = $it['barcode'] ?? null;
                    $name = $it['name'] ?? null;
                    $color = $it['color'] ?? null;
                    $size = $it['size'] ?? null;
                    $cost = isset($it['costPrice']) ? floatval($it['costPrice']) : 0;
                    $price = isset($it['sellingPrice']) ? floatval($it['sellingPrice']) : 0;

                    // Create store product if not provided
                    if (empty($productId) && !empty($name)) {
                        if (!$barcode) {
                            $barcode = 'DRG-' . time() . '-' . rand(1000,9999);
                        }
                        if ($baseType === 'product') {
                            $parentId = ensure_product_parent($pdo, $name, 'product');
                            execute_query($pdo, "INSERT INTO product_variants (product_id, name, barcode, color, size, cost_price, sale_price) VALUES (?, ?, ?, ?, ?, ?, ?)", [$parentId, $name, $barcode, $color, $size, $cost, $price]);
                            $productId = $pdo->lastInsertId();
                            $newBarcodes[] = ['name' => $name, 'barcode' => $barcode, 'type' => 'product'];
                        } elseif ($baseType === 'fabric') {
                            // Create fabric master then add quantity to fabric_stock for the selected warehouse
                            $fFields = ['name', 'code', 'color', 'cost_price', 'min_stock'];
                            $fVals = [$name, $barcode, $color, $cost, 0];
                            if (column_exists($pdo, 'fabrics', 'size')) { $fFields[] = 'size'; $fVals[] = $size; }
                            if (column_exists($pdo, 'fabrics', 'quantity')) { $fFields[] = 'quantity'; $fVals[] = 0; }
                            $fCols = implode(', ', $fFields);
                            $fPh = implode(', ', array_fill(0, count($fFields), '?'));
                            execute_query($pdo, "INSERT INTO fabrics ($fCols) VALUES ($fPh)", $fVals);
                            $productId = $pdo->lastInsertId();
                            $newBarcodes[] = ['name' => $name, 'barcode' => $barcode, 'type' => 'fabric'];
                        } elseif ($baseType === 'accessory') {
                            // Create accessory master then add quantity to accessory_stock for the selected warehouse
                            $aFields = ['name', 'code', 'color', 'cost_price', 'min_stock'];
                            $aVals = [$name, $barcode, $color, $cost, 0];
                            if (column_exists($pdo, 'accessories', 'size')) { $aFields[] = 'size'; $aVals[] = $size; }
                            if (column_exists($pdo, 'accessories', 'quantity')) { $aFields[] = 'quantity'; $aVals[] = 0; }
                            $aCols = implode(', ', $aFields);
                            $aPh = implode(', ', array_fill(0, count($aFields), '?'));
                            execute_query($pdo, "INSERT INTO accessories ($aCols) VALUES ($aPh)", $aVals);
                            $productId = $pdo->lastInsertId();
                            $newBarcodes[] = ['name' => $name, 'barcode' => $barcode, 'type' => 'accessory'];
                        }
                    }

                    if (!$productId) continue;

                    if ($baseType === 'fabric' && table_exists($pdo, 'fabric_stock')) {
                        if ($cost > 0 && column_exists($pdo, 'fabrics', 'cost_price')) {
                            $prevCost = floatval(execute_query($pdo, "SELECT cost_price FROM fabrics WHERE id = ? LIMIT 1", [$productId])->fetchColumn() ?? 0);
                            $prevTotalQty = floatval(execute_query($pdo, "SELECT COALESCE(SUM(quantity),0) FROM fabric_stock WHERE fabric_id = ? FOR UPDATE", [$productId])->fetchColumn() ?? 0);
                            $den = $prevTotalQty + floatval($qty);
                            if ($den > 0) {
                                $avgCost = (($prevCost * $prevTotalQty) + ($cost * floatval($qty))) / $den;
                                execute_query($pdo, "UPDATE fabrics SET cost_price = ? WHERE id = ?", [round($avgCost, 4), $productId]);
                            }
                        }

                        $prevQty = 0.0;
                        $qRow = execute_query(
                            $pdo,
                            "SELECT quantity FROM fabric_stock WHERE fabric_id = ? AND warehouse_id = ? FOR UPDATE",
                            [$productId, $warehouseId]
                        )->fetchColumn();
                        if ($qRow !== false && $qRow !== null) {
                            $prevQty = floatval($qRow);
                            execute_query($pdo, "UPDATE fabric_stock SET quantity = quantity + ? WHERE fabric_id = ? AND warehouse_id = ?", [$qty, $productId, $warehouseId]);
                        } else {
                            execute_query($pdo, "INSERT INTO fabric_stock (fabric_id, warehouse_id, quantity) VALUES (?, ?, ?)", [$productId, $warehouseId, $qty]);
                        }
                        $newQty = $prevQty + $qty;
                        if (table_exists($pdo, 'fabric_movements') && abs($qty) > 1e-9) {
                            execute_query(
                                $pdo,
                                "INSERT INTO fabric_movements (fabric_id, warehouse_id, movement_type, quantity_change, previous_quantity, new_quantity, reference_id, reference_type, notes, created_by)
                                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                                [$productId, $warehouseId, 'purchase', $qty, $prevQty, $newQty, $purchaseId, 'purchase_invoice', json_encode($it), $created_by]
                            );
                        }
                        continue;
                    }

                    if ($baseType === 'accessory' && table_exists($pdo, 'accessory_stock')) {
                        $qtyInt = intval($qty);
                        if ($cost > 0 && column_exists($pdo, 'accessories', 'cost_price')) {
                            $prevCost = floatval(execute_query($pdo, "SELECT cost_price FROM accessories WHERE id = ? LIMIT 1", [$productId])->fetchColumn() ?? 0);
                            $prevTotalQty = floatval(execute_query($pdo, "SELECT COALESCE(SUM(quantity),0) FROM accessory_stock WHERE accessory_id = ? FOR UPDATE", [$productId])->fetchColumn() ?? 0);
                            $den = $prevTotalQty + floatval($qtyInt);
                            if ($den > 0) {
                                $avgCost = (($prevCost * $prevTotalQty) + ($cost * floatval($qtyInt))) / $den;
                                execute_query($pdo, "UPDATE accessories SET cost_price = ? WHERE id = ?", [round($avgCost, 4), $productId]);
                            }
                        }

                        $prevQty = 0;
                        $qRow = execute_query(
                            $pdo,
                            "SELECT quantity FROM accessory_stock WHERE accessory_id = ? AND warehouse_id = ? FOR UPDATE",
                            [$productId, $warehouseId]
                        )->fetchColumn();
                        if ($qRow !== false && $qRow !== null) {
                            $prevQty = intval($qRow);
                            execute_query($pdo, "UPDATE accessory_stock SET quantity = quantity + ? WHERE accessory_id = ? AND warehouse_id = ?", [$qtyInt, $productId, $warehouseId]);
                        } else {
                            execute_query($pdo, "INSERT INTO accessory_stock (accessory_id, warehouse_id, quantity) VALUES (?, ?, ?)", [$productId, $warehouseId, $qtyInt]);
                        }
                        $newQty = $prevQty + $qtyInt;
                        if (table_exists($pdo, 'accessory_movements') && $qtyInt != 0) {
                            execute_query(
                                $pdo,
                                "INSERT INTO accessory_movements (accessory_id, warehouse_id, movement_type, quantity_change, previous_quantity, new_quantity, reference_id, reference_type, notes, created_by)
                                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                                [$productId, $warehouseId, 'purchase', $qtyInt, $prevQty, $newQty, $purchaseId, 'purchase_invoice', json_encode($it), $created_by]
                            );
                        }
                        continue;
                    }

                    // Store products
                    if ($baseType === 'product') {
                        // Update cost by weighted average (based on total on-hand stock) and optionally sale price.
                        if ($cost > 0 || $price > 0) {
                            $setParts = [];
                            $vals = [];

                            if ($cost > 0) {
                                $prevCost = floatval(execute_query($pdo, "SELECT cost_price FROM product_variants WHERE id = ? LIMIT 1", [$productId])->fetchColumn() ?? 0);
                                $prevTotalQty = floatval(execute_query($pdo, "SELECT COALESCE(SUM(quantity),0) FROM stock WHERE product_id = ? FOR UPDATE", [$productId])->fetchColumn() ?? 0);
                                $den = $prevTotalQty + floatval($qty);
                                if ($den > 0) {
                                    $avgCost = (($prevCost * $prevTotalQty) + ($cost * floatval($qty))) / $den;
                                    $setParts[] = 'cost_price = ?';
                                    $vals[] = round($avgCost, 4);
                                } else {
                                    $setParts[] = 'cost_price = ?';
                                    $vals[] = $cost;
                                }
                            }

                            if ($price > 0) {
                                $setParts[] = 'sale_price = ?';
                                $vals[] = $price;
                            }

                            if (count($setParts) > 0) {
                                $vals[] = $productId;
                                execute_query($pdo, "UPDATE product_variants SET " . implode(', ', $setParts) . " WHERE id = ?", $vals);
                            }
                        }

                        $stmtS = execute_query($pdo, "SELECT quantity FROM stock WHERE product_id = ? AND warehouse_id = ? FOR UPDATE", [$productId, $warehouseId]);
                        $prevQty = 0;
                        if ($row = $stmtS->fetch(PDO::FETCH_ASSOC)) {
                            $prevQty = intval($row['quantity']);
                            execute_query($pdo, "UPDATE stock SET quantity = quantity + ? WHERE product_id = ? AND warehouse_id = ?", [$qty, $productId, $warehouseId]);
                        } else {
                            execute_query($pdo, "INSERT INTO stock (product_id, warehouse_id, quantity) VALUES (?, ?, ?)", [$productId, $warehouseId, $qty]);
                        }
                        $newQty = $prevQty + intval($qty);
                        $mt = pick_allowed_enum($pdo, 'product_movements', 'movement_type', 'purchase', ['purchase','sale','return_in','return_out','transfer_in','transfer_out','adjustment','initial_balance']);
                        execute_query($pdo, "INSERT INTO product_movements (product_id, warehouse_id, movement_type, quantity_change, previous_quantity, new_quantity, reference_id, reference_type, notes, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", [$productId, $warehouseId, $mt, intval($qty), $prevQty, $newQty, $purchaseId, 'purchase_invoice', json_encode($it), $created_by]);
                    }
                }
                if ($invoiceTotal > 0) {
                    execute_query($pdo, "UPDATE suppliers SET total_debit = total_debit + ? WHERE id = ?", [$invoiceTotal, $supplierId]);
                }
                if ($paidAmount > 0) {
                    $txType_local = pick_allowed_enum($pdo, 'transactions', 'type', 'payment_out', ['payment_out','payment','payment_in']);
                    $rel_local = pick_allowed_enum($pdo, 'transactions', 'related_to_type', 'supplier', ['supplier','rep','customer','none']);
                    execute_query($pdo, "INSERT INTO transactions (type, warehouse_id, treasury_id, related_to_type, related_to_id, amount, transaction_date, details) VALUES (?, ?, ?, ?, ?, ?, NOW(), ?)", [$txType_local, $warehouseId, $treasuryId, $rel_local, $supplierId, $paidAmount, json_encode(['paid_for' => $purchaseId])]);
                    execute_query($pdo, "UPDATE suppliers SET total_credit = total_credit + ? WHERE id = ?", [$paidAmount, $supplierId]);
                }
                $pdo->commit();
                echo json_encode(['success' => true, 'purchase_id' => $purchaseId, 'total' => $invoiceTotal, 'new_barcodes' => $newBarcodes]);
            } catch (Exception $e) {
                try { if ($pdo->inTransaction()) $pdo->rollBack(); } catch (Exception $_) {}
                http_response_code(500);
                echo json_encode(['success' => false, 'message' => 'Receiving failed: ' . $e->getMessage()]);
            }
        } elseif ($action === 'getLastVendorPrice') {
            $supplierId = intval($_GET['supplierId'] ?? 0);
            $productId  = intval($_GET['productId']  ?? 0);
            if (!$supplierId || !$productId) {
                echo json_encode(['success' => false, 'vendorPrice' => 0]);
            } else {
                try {
                    $stmt = execute_query($pdo,
                        "SELECT details FROM transactions WHERE type = 'purchase' AND related_to_type = 'supplier' AND related_to_id = ? ORDER BY id DESC LIMIT 30",
                        [$supplierId]
                    );
                    $vendorPrice = 0.0;
                    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
                        $details = json_decode($row['details'] ?? '[]', true);
                        $itemsList = (is_array($details) && isset($details['items'])) ? $details['items'] : (is_array($details) ? $details : []);
                        foreach ($itemsList as $it) {
                            if (intval($it['productId'] ?? 0) === $productId && floatval($it['vendorPrice'] ?? 0) > 0) {
                                $vendorPrice = floatval($it['vendorPrice']);
                                break 2;
                            }
                        }
                    }
                    echo json_encode(['success' => true, 'vendorPrice' => $vendorPrice]);
                } catch (Exception $e) {
                    echo json_encode(['success' => false, 'vendorPrice' => 0]);
                }
            }
        }
        break;

    case 'returns':
        // Supplier returns (return goods to supplier): decrement stock in selected warehouse
        $action = $_GET['action'] ?? 'create';
        if ($action === 'create') {
            $supplierId = intval($input['supplierId'] ?? 0);
            $warehouseId = intval($input['warehouseId'] ?? 0);
            $items = $input['items'] ?? [];
            $refundAmount = isset($input['receivedAmount']) ? floatval($input['receivedAmount']) : (isset($input['refundAmount']) ? floatval($input['refundAmount']) : 0);
            $treasuryId = null;
            if (isset($input['treasuryId'])) {
                $tmpTid = intval($input['treasuryId']);
                if ($tmpTid > 0) $treasuryId = $tmpTid;
            }

            // Apply user defaults/locks
            $defaults = get_user_defaults($pdo);
            if ($defaults) {
                $defWid = isset($defaults['default_warehouse_id']) ? intval($defaults['default_warehouse_id']) : null;
                $canChangeW = isset($defaults['can_change_warehouse']) ? boolval($defaults['can_change_warehouse']) : true;
                if (!$canChangeW && $defWid) {
                    if ($warehouseId && $warehouseId !== $defWid) { http_response_code(400); echo json_encode(['success'=>false,'message'=>'المستودع مقفل للمستخدم ولا يمكن تغييره.']); break; }
                    if (!$warehouseId) $warehouseId = $defWid;
                } else { if (!$warehouseId && $defWid) $warehouseId = $defWid; }

                $defTid = isset($defaults['default_treasury_id']) ? intval($defaults['default_treasury_id']) : null;
                $canChangeT = isset($defaults['can_change_treasury']) ? boolval($defaults['can_change_treasury']) : true;
                if (!$canChangeT && $defTid) {
                    if ($treasuryId && $treasuryId !== $defTid) { http_response_code(400); echo json_encode(['success'=>false,'message'=>'الخزينة مقفلة للمستخدم ولا يمكن تغييرها.']); break; }
                    if (!$treasuryId) $treasuryId = $defTid;
                } else { if (!$treasuryId && $defTid) $treasuryId = $defTid; }
            }

            if (!$supplierId || !$warehouseId || !is_array($items) || count($items) === 0) {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'Missing required return data.']);
                break;
            }
            if ($refundAmount > 0 && !$treasuryId) {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'treasuryId is required when receivedAmount > 0']);
                break;
            }

            try {
                $pdo->beginTransaction();
                $returnTotal = 0;
                foreach ($items as $it) {
                    $t = strtolower(trim((string)($it['returnType'] ?? ($it['itemType'] ?? 'product'))));
                    if (!in_array($t, ['product','fabric','accessory'], true)) $t = 'product';
                    $qty = ($t === 'fabric') ? floatval($it['qty'] ?? 0) : intval($it['qty'] ?? 0);
                    $cost = isset($it['costPrice']) ? floatval($it['costPrice']) : (isset($it['cost']) ? floatval($it['cost']) : 0);
                    $vendorPriceForTotal = isset($it['vendorPrice']) ? floatval($it['vendorPrice']) : 0;
                    $returnTotal += $qty * ($vendorPriceForTotal > 0 ? $vendorPriceForTotal : $cost);
                }

                $txType = pick_allowed_enum($pdo, 'transactions', 'type', 'return_out', ['return_out','return_in','purchase','sale','transfer','payment_in','payment_out']);
                $rel_local = pick_allowed_enum($pdo, 'transactions', 'related_to_type', 'supplier', ['supplier','rep','customer','none']);
                execute_query($pdo, "INSERT INTO transactions (type, warehouse_id, treasury_id, related_to_type, related_to_id, amount, transaction_date, details) VALUES (?, ?, ?, ?, ?, ?, NOW(), ?)", [$txType, $warehouseId, null, $rel_local, $supplierId, $returnTotal, json_encode($items)]);
                $returnId = $pdo->lastInsertId();

                $created_by = $_SESSION['user_id'] ?? null;
                foreach ($items as $it) {
                    $t = strtolower(trim((string)($it['returnType'] ?? ($it['itemType'] ?? 'product'))));
                    if (!in_array($t, ['product','fabric','accessory'], true)) $t = 'product';
                    $qty = ($t === 'fabric') ? floatval($it['qty'] ?? 0) : intval($it['qty'] ?? 0);
                    if ($qty <= 0) continue;
                    $productId = intval($it['productId'] ?? 0);
                    if (!$productId) continue;

                    if ($t === 'fabric') {
                        if (!table_exists($pdo, 'fabric_stock')) throw new Exception('fabric_stock table missing');
                        $prevQty = 0.0;
                        $qRow = execute_query($pdo, "SELECT quantity FROM fabric_stock WHERE fabric_id = ? AND warehouse_id = ? FOR UPDATE", [$productId, $warehouseId])->fetchColumn();
                        if ($qRow !== false && $qRow !== null) $prevQty = floatval($qRow);
                        $newQty = $prevQty - floatval($qty);
                        if ($newQty < 0) $newQty = 0;
                        execute_query(
                            $pdo,
                            "INSERT INTO fabric_stock (fabric_id, warehouse_id, quantity) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE quantity = VALUES(quantity)",
                            [$productId, $warehouseId, $newQty]
                        );
                        if (table_exists($pdo, 'fabric_movements') && abs(floatval($qty)) > 1e-9) {
                            execute_query(
                                $pdo,
                                "INSERT INTO fabric_movements (fabric_id, warehouse_id, movement_type, quantity_change, previous_quantity, new_quantity, reference_id, reference_type, notes, created_by)
                                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                                [$productId, $warehouseId, 'return_out', -floatval($qty), $prevQty, $newQty, $returnId, 'supplier_return', json_encode($it), $created_by]
                            );
                        }
                        continue;
                    }

                    if ($t === 'accessory') {
                        if (!table_exists($pdo, 'accessory_stock')) throw new Exception('accessory_stock table missing');
                        $qtyInt = intval($qty);
                        $prevQty = 0;
                        $qRow = execute_query($pdo, "SELECT quantity FROM accessory_stock WHERE accessory_id = ? AND warehouse_id = ? FOR UPDATE", [$productId, $warehouseId])->fetchColumn();
                        if ($qRow !== false && $qRow !== null) $prevQty = intval($qRow);
                        $newQty = $prevQty - $qtyInt;
                        if ($newQty < 0) $newQty = 0;
                        execute_query(
                            $pdo,
                            "INSERT INTO accessory_stock (accessory_id, warehouse_id, quantity) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE quantity = VALUES(quantity)",
                            [$productId, $warehouseId, $newQty]
                        );
                        if (table_exists($pdo, 'accessory_movements') && $qtyInt != 0) {
                            execute_query(
                                $pdo,
                                "INSERT INTO accessory_movements (accessory_id, warehouse_id, movement_type, quantity_change, previous_quantity, new_quantity, reference_id, reference_type, notes, created_by)
                                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                                [$productId, $warehouseId, 'return_out', -$qtyInt, $prevQty, $newQty, $returnId, 'supplier_return', json_encode($it), $created_by]
                            );
                        }
                        continue;
                    }

                    // store product
                    $qtyInt = intval($qty);
                    $stmt = execute_query($pdo, "SELECT quantity FROM stock WHERE product_id = ? AND warehouse_id = ? FOR UPDATE", [$productId, $warehouseId]);
                    $prevQty = 0;
                    if ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
                        $prevQty = intval($row['quantity']);
                        $newQty = $prevQty - $qtyInt;
                        if ($newQty < 0) $newQty = 0;
                        execute_query($pdo, "UPDATE stock SET quantity = ? WHERE product_id = ? AND warehouse_id = ?", [$newQty, $productId, $warehouseId]);
                    } else {
                        $newQty = 0;
                        execute_query($pdo, "INSERT INTO stock (product_id, warehouse_id, quantity) VALUES (?, ?, ?)", [$productId, $warehouseId, 0]);
                    }

                    $mt = pick_allowed_enum($pdo, 'product_movements', 'movement_type', 'return_out', ['purchase','sale','return_in','return_out','transfer_in','transfer_out','adjustment','initial_balance']);
                    execute_query($pdo, "INSERT INTO product_movements (product_id, warehouse_id, movement_type, quantity_change, previous_quantity, new_quantity, reference_id, reference_type, notes, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", [$productId, $warehouseId, $mt, -$qtyInt, $prevQty, $newQty, $returnId, 'supplier_return', json_encode($it), $created_by]);
                }

                // Reduce supplier debit by returned value
                if ($returnTotal > 0) {
                    execute_query($pdo, "UPDATE suppliers SET total_debit = CASE WHEN total_debit - ? < 0 THEN 0 ELSE total_debit - ? END WHERE id = ?", [$returnTotal, $returnTotal, $supplierId]);
                }

                // Refund money from supplier into treasury (optional)
                if ($refundAmount > 0 && $treasuryId) {
                    $txTypePay = pick_allowed_enum($pdo, 'transactions', 'type', 'payment_in', ['payment_in','payment','payment_out','payment_in']);
                    $rel2 = pick_allowed_enum($pdo, 'transactions', 'related_to_type', 'supplier', ['supplier','rep','customer','none']);
                    execute_query($pdo, "INSERT INTO transactions (type, warehouse_id, treasury_id, related_to_type, related_to_id, amount, transaction_date, details) VALUES (?, ?, ?, ?, ?, ?, NOW(), ?)", [$txTypePay, $warehouseId, $treasuryId, $rel2, $supplierId, $refundAmount, json_encode(['refund_for' => $returnId])]);
                    execute_query($pdo, "UPDATE treasuries SET current_balance = current_balance + ? WHERE id = ?", [$refundAmount, $treasuryId]);
                    // Decrease total_credit to reflect net refunds
                    execute_query($pdo, "UPDATE suppliers SET total_credit = CASE WHEN total_credit - ? < 0 THEN 0 ELSE total_credit - ? END WHERE id = ?", [$refundAmount, $refundAmount, $supplierId]);
                }

                $pdo->commit();
                echo json_encode(['success' => true, 'return_id' => $returnId, 'total' => $returnTotal]);
            } catch (Exception $e) {
                if ($pdo->inTransaction()) $pdo->rollBack();
                http_response_code(500);
                echo json_encode(['success' => false, 'message' => 'Return failed: ' . $e->getMessage()]);
            }
        }
        break;

    case 'transfers':
        // Warehouse-to-warehouse stock transfer
        $action = $_GET['action'] ?? 'create';
        if ($action === 'create') {
            $from = intval($input['from'] ?? 0);
            $to = intval($input['to'] ?? 0);
            $items = $input['items'] ?? [];
            if (!$from || !$to || $from === $to || !is_array($items) || count($items) === 0) {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'Missing required transfer data.']);
                break;
            }

            try {
                $pdo->beginTransaction();

                $transferTotal = 0;
                $enrichedItems = [];
                foreach ($items as $it) {
                    $pid = intval($it['productId'] ?? 0);
                    $t = strtolower(trim((string)($it['transferType'] ?? ($it['itemType'] ?? 'product'))));
                    if (!in_array($t, ['product','fabric','accessory'], true)) $t = 'product';
                    $qty = ($t === 'fabric') ? floatval($it['qty'] ?? 0) : intval($it['qty'] ?? 0);
                    if (!$pid || $qty <= 0) continue;
                    $pRow = null;
                    if ($t === 'product') {
                        $pRow = execute_query($pdo, "SELECT name, barcode, cost_price as cost, sale_price as price, color, size FROM product_variants WHERE id = ?", [$pid])->fetch(PDO::FETCH_ASSOC);
                    } elseif ($t === 'fabric') {
                        $sel = "name, code as barcode, cost_price as cost, color";
                        if (column_exists($pdo, 'fabrics', 'size')) $sel .= ", size";
                        $pRow = execute_query($pdo, "SELECT $sel FROM fabrics WHERE id = ?", [$pid])->fetch(PDO::FETCH_ASSOC);
                    } elseif ($t === 'accessory') {
                        $sel = "name, code as barcode, cost_price as cost, color";
                        if (column_exists($pdo, 'accessories', 'size')) $sel .= ", size";
                        $pRow = execute_query($pdo, "SELECT $sel FROM accessories WHERE id = ?", [$pid])->fetch(PDO::FETCH_ASSOC);
                    }

                    $cost = isset($it['costPrice']) ? floatval($it['costPrice']) : floatval(($pRow && isset($pRow['cost'])) ? $pRow['cost'] : 0);
                    $transferTotal += $qty * $cost;
                    $enrichedItems[] = array_merge(is_array($it) ? $it : ['productId' => $pid, 'qty' => $qty], [
                        'transferType' => $t,
                        'productId' => $pid,
                        'qty' => $qty,
                        'name' => $it['name'] ?? (($pRow && isset($pRow['name'])) ? $pRow['name'] : ''),
                        'barcode' => $it['barcode'] ?? (($pRow && isset($pRow['barcode'])) ? $pRow['barcode'] : ''),
                        'color' => $it['color'] ?? (($pRow && isset($pRow['color'])) ? $pRow['color'] : ''),
                        'size' => $it['size'] ?? (($pRow && isset($pRow['size'])) ? $pRow['size'] : ''),
                        'costPrice' => $cost,
                        'sellingPrice' => isset($it['sellingPrice']) ? floatval($it['sellingPrice']) : floatval(($pRow && isset($pRow['price'])) ? $pRow['price'] : 0),
                    ]);
                }

                $txType = pick_allowed_enum($pdo, 'transactions', 'type', 'transfer', ['transfer','purchase','sale','return_in','return_out','payment_in','payment_out']);
                $rel_local = pick_allowed_enum($pdo, 'transactions', 'related_to_type', 'none', ['none','supplier','customer','rep']);
                execute_query($pdo, "INSERT INTO transactions (type, warehouse_id, treasury_id, related_to_type, related_to_id, amount, transaction_date, details) VALUES (?, ?, ?, ?, ?, ?, NOW(), ?)", [$txType, $from, null, $rel_local, null, $transferTotal, json_encode(['from' => $from, 'to' => $to, 'items' => $enrichedItems])]);
                $transferId = $pdo->lastInsertId();

                $created_by = $_SESSION['user_id'] ?? null;
                foreach ($enrichedItems as $it) {
                    $pid = intval($it['productId'] ?? 0);
                    $t = strtolower(trim((string)($it['transferType'] ?? ($it['itemType'] ?? 'product'))));
                    if (!in_array($t, ['product','fabric','accessory'], true)) $t = 'product';
                    $qty = ($t === 'fabric') ? floatval($it['qty'] ?? 0) : intval($it['qty'] ?? 0);
                    if (!$pid || $qty <= 0) continue;

                    if ($t === 'fabric') {
                        if (!table_exists($pdo, 'fabric_stock')) throw new Exception('fabric_stock table missing');

                        // out
                        $prevFrom = floatval(execute_query($pdo, "SELECT quantity FROM fabric_stock WHERE fabric_id = ? AND warehouse_id = ? FOR UPDATE", [$pid, $from])->fetchColumn() ?: 0);
                        $newFrom = $prevFrom - floatval($qty); if ($newFrom < 0) $newFrom = 0;
                        execute_query($pdo, "INSERT INTO fabric_stock (fabric_id, warehouse_id, quantity) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE quantity = VALUES(quantity)", [$pid, $from, $newFrom]);
                        if (table_exists($pdo, 'fabric_movements') && abs(floatval($qty)) > 1e-9) {
                            execute_query($pdo, "INSERT INTO fabric_movements (fabric_id, warehouse_id, movement_type, quantity_change, previous_quantity, new_quantity, reference_id, reference_type, notes, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", [$pid, $from, 'transfer_out', -floatval($qty), $prevFrom, $newFrom, $transferId, 'warehouse_transfer', json_encode(['to' => $to, 'item' => $it]), $created_by]);
                        }

                        // in
                        $prevTo = floatval(execute_query($pdo, "SELECT quantity FROM fabric_stock WHERE fabric_id = ? AND warehouse_id = ? FOR UPDATE", [$pid, $to])->fetchColumn() ?: 0);
                        $newTo = $prevTo + floatval($qty);
                        execute_query($pdo, "INSERT INTO fabric_stock (fabric_id, warehouse_id, quantity) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE quantity = VALUES(quantity)", [$pid, $to, $newTo]);
                        if (table_exists($pdo, 'fabric_movements') && abs(floatval($qty)) > 1e-9) {
                            execute_query($pdo, "INSERT INTO fabric_movements (fabric_id, warehouse_id, movement_type, quantity_change, previous_quantity, new_quantity, reference_id, reference_type, notes, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", [$pid, $to, 'transfer_in', floatval($qty), $prevTo, $newTo, $transferId, 'warehouse_transfer', json_encode(['from' => $from, 'item' => $it]), $created_by]);
                        }
                        continue;
                    }

                    if ($t === 'accessory') {
                        if (!table_exists($pdo, 'accessory_stock')) throw new Exception('accessory_stock table missing');
                        $qtyInt = intval($qty);

                        // out
                        $prevFrom = intval(execute_query($pdo, "SELECT quantity FROM accessory_stock WHERE accessory_id = ? AND warehouse_id = ? FOR UPDATE", [$pid, $from])->fetchColumn() ?: 0);
                        $newFrom = $prevFrom - $qtyInt; if ($newFrom < 0) $newFrom = 0;
                        execute_query($pdo, "INSERT INTO accessory_stock (accessory_id, warehouse_id, quantity) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE quantity = VALUES(quantity)", [$pid, $from, $newFrom]);
                        if (table_exists($pdo, 'accessory_movements') && $qtyInt != 0) {
                            execute_query($pdo, "INSERT INTO accessory_movements (accessory_id, warehouse_id, movement_type, quantity_change, previous_quantity, new_quantity, reference_id, reference_type, notes, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", [$pid, $from, 'transfer_out', -$qtyInt, $prevFrom, $newFrom, $transferId, 'warehouse_transfer', json_encode(['to' => $to, 'item' => $it]), $created_by]);
                        }

                        // in
                        $prevTo = intval(execute_query($pdo, "SELECT quantity FROM accessory_stock WHERE accessory_id = ? AND warehouse_id = ? FOR UPDATE", [$pid, $to])->fetchColumn() ?: 0);
                        $newTo = $prevTo + $qtyInt;
                        execute_query($pdo, "INSERT INTO accessory_stock (accessory_id, warehouse_id, quantity) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE quantity = VALUES(quantity)", [$pid, $to, $newTo]);
                        if (table_exists($pdo, 'accessory_movements') && $qtyInt != 0) {
                            execute_query($pdo, "INSERT INTO accessory_movements (accessory_id, warehouse_id, movement_type, quantity_change, previous_quantity, new_quantity, reference_id, reference_type, notes, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", [$pid, $to, 'transfer_in', $qtyInt, $prevTo, $newTo, $transferId, 'warehouse_transfer', json_encode(['from' => $from, 'item' => $it]), $created_by]);
                        }
                        continue;
                    }

                    // decrement from
                    $stmtFrom = execute_query($pdo, "SELECT quantity FROM stock WHERE product_id = ? AND warehouse_id = ? FOR UPDATE", [$pid, $from]);
                    $prevFrom = 0;
                    if ($rowFrom = $stmtFrom->fetch(PDO::FETCH_ASSOC)) {
                        $prevFrom = intval($rowFrom['quantity']);
                        $newFrom = $prevFrom - $qty; if ($newFrom < 0) $newFrom = 0;
                        execute_query($pdo, "UPDATE stock SET quantity = ? WHERE product_id = ? AND warehouse_id = ?", [$newFrom, $pid, $from]);
                    } else {
                        $newFrom = 0;
                        execute_query($pdo, "INSERT INTO stock (product_id, warehouse_id, quantity) VALUES (?, ?, ?)", [$pid, $from, 0]);
                    }
                    $mtOut = pick_allowed_enum($pdo, 'product_movements', 'movement_type', 'transfer_out', ['purchase','sale','return_in','return_out','transfer_in','transfer_out','adjustment','initial_balance']);
                    execute_query($pdo, "INSERT INTO product_movements (product_id, warehouse_id, movement_type, quantity_change, previous_quantity, new_quantity, reference_id, reference_type, notes, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", [$pid, $from, $mtOut, -$qty, $prevFrom, $newFrom, $transferId, 'warehouse_transfer', json_encode(['to' => $to, 'item' => $it]), $created_by]);

                    // increment to
                    $stmtTo = execute_query($pdo, "SELECT quantity FROM stock WHERE product_id = ? AND warehouse_id = ? FOR UPDATE", [$pid, $to]);
                    $prevTo = 0;
                    if ($rowTo = $stmtTo->fetch(PDO::FETCH_ASSOC)) {
                        $prevTo = intval($rowTo['quantity']);
                        $newTo = $prevTo + $qty;
                        execute_query($pdo, "UPDATE stock SET quantity = ? WHERE product_id = ? AND warehouse_id = ?", [$newTo, $pid, $to]);
                    } else {
                        $newTo = $qty;
                        execute_query($pdo, "INSERT INTO stock (product_id, warehouse_id, quantity) VALUES (?, ?, ?)", [$pid, $to, $newTo]);
                    }
                    $mtIn = pick_allowed_enum($pdo, 'product_movements', 'movement_type', 'transfer_in', ['purchase','sale','return_in','return_out','transfer_in','transfer_out','adjustment','initial_balance']);
                    execute_query($pdo, "INSERT INTO product_movements (product_id, warehouse_id, movement_type, quantity_change, previous_quantity, new_quantity, reference_id, reference_type, notes, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", [$pid, $to, $mtIn, $qty, $prevTo, $newTo, $transferId, 'warehouse_transfer', json_encode(['from' => $from, 'item' => $it]), $created_by]);
                }

                $pdo->commit();
                echo json_encode(['success' => true, 'transfer_id' => $transferId, 'total' => $transferTotal]);
            } catch (Exception $e) {
                if ($pdo->inTransaction()) $pdo->rollBack();
                http_response_code(500);
                echo json_encode(['success' => false, 'message' => 'Transfer failed: ' . $e->getMessage()]);
            }
        }
        break;

    case 'reports':
        $action = $_GET['action'] ?? 'sales';
        check_permission_or_die($pdo, 'reports', 'view');
        $start_date = $_GET['start_date'] ?? date('Y-m-01');
        $end_date = $_GET['end_date'] ?? date('Y-m-t');

        $include_html = ($_GET['include_html'] ?? '') === '1';

        if ($action === 'sales') {
            $status = trim((string)($_GET['status'] ?? ''));
            $customer_id = intval($_GET['customer_id'] ?? 0);
            $rep_id = intval($_GET['rep_id'] ?? 0);

            $salesWhere = "o.created_at BETWEEN ? AND ?";
            $salesParams = [$start_date, $end_date . ' 23:59:59'];
            if ($status !== '') { $salesWhere .= " AND o.status = ?"; $salesParams[] = $status; }
            if ($customer_id > 0) { $salesWhere .= " AND o.customer_id = ?"; $salesParams[] = $customer_id; }
            if ($rep_id > 0) { $salesWhere .= " AND o.rep_id = ?"; $salesParams[] = $rep_id; }

            // salesByProduct
            $stmt = execute_query(
                $pdo,
                "SELECT
                    ppar.name,
                    COALESCE(SUM(oi.quantity), 0) as sales,
                    COALESCE(SUM(oi.quantity * oi.price_per_unit), 0) as sales_amount,
                    COALESCE(SUM(oi.quantity * (oi.price_per_unit - COALESCE(pv.cost_price, 0))), 0) as net_profit
                 FROM order_items oi
                 JOIN product_variants pv ON oi.product_id = pv.id
                 JOIN products ppar ON pv.product_id = ppar.id
                 JOIN orders o ON oi.order_id = o.id
                 WHERE $salesWhere
                 GROUP BY ppar.id, ppar.name
                 ORDER BY sales DESC",
                $salesParams
            );
            $salesByProduct = $stmt->fetchAll(PDO::FETCH_ASSOC);

            // dailySales
            $stmt = execute_query($pdo, "SELECT DATE(o.created_at) as date, SUM(o.total_amount) as total FROM orders o WHERE $salesWhere GROUP BY DATE(o.created_at) ORDER BY date ASC", $salesParams);
            $dailySales = $stmt->fetchAll(PDO::FETCH_ASSOC);

            // invoiceRecords
            $stmt = execute_query($pdo, "SELECT o.order_number, o.created_at as date, c.name as customer, o.total_amount as total, o.status FROM orders o JOIN customers c ON o.customer_id = c.id WHERE $salesWhere ORDER BY o.created_at DESC LIMIT 100", $salesParams);
            $invoiceRecords = $stmt->fetchAll(PDO::FETCH_ASSOC);

            echo json_encode(['success' => true, 'data' => [
                'salesByProduct' => $salesByProduct,
                'dailySales' => $dailySales,
                'invoiceRecords' => $invoiceRecords
            ]]);

        } elseif ($action === 'inventory') {
            $warehouse_id = intval($_GET['warehouse_id'] ?? 0);
            $movement_type = trim((string)($_GET['movement_type'] ?? ''));

            // inventoryStockByWarehouse
            if ($warehouse_id > 0) {
                $stmt = execute_query($pdo, "SELECT w.name, SUM(s.quantity) as quantity FROM stock s JOIN warehouses w ON s.warehouse_id = w.id WHERE w.id = ? GROUP BY w.id", [$warehouse_id]);
            } else {
                $stmt = execute_query($pdo, "SELECT w.name, SUM(s.quantity) as quantity FROM stock s JOIN warehouses w ON s.warehouse_id = w.id GROUP BY w.id");
            }
            $inventoryStockByWarehouse = $stmt->fetchAll(PDO::FETCH_ASSOC);

            // inventoryMovement
            $invWhere = "pm.created_at BETWEEN ? AND ?";
            $invParams = [$start_date, $end_date . ' 23:59:59'];
            if ($warehouse_id > 0) { $invWhere .= " AND pm.warehouse_id = ?"; $invParams[] = $warehouse_id; }
            if ($movement_type !== '') { $invWhere .= " AND pm.movement_type = ?"; $invParams[] = $movement_type; }

            $stmt = execute_query($pdo, "SELECT DATE(pm.created_at) as date, SUM(ABS(pm.quantity_change)) as quantity FROM product_movements pm WHERE $invWhere GROUP BY DATE(pm.created_at) ORDER BY date ASC", $invParams);
            $inventoryMovement = $stmt->fetchAll(PDO::FETCH_ASSOC);

            // inventoryStock
            if ($warehouse_id > 0) {
                $stmt = execute_query($pdo, "SELECT ppar.name as product, pv.barcode, w.name as warehouse, s.quantity, pv.cost_price as purchasePrice FROM stock s JOIN product_variants pv ON s.product_id = pv.id JOIN products ppar ON pv.product_id = ppar.id JOIN warehouses w ON s.warehouse_id = w.id WHERE w.id = ? ORDER BY s.quantity DESC LIMIT 100", [$warehouse_id]);
            } else {
                $stmt = execute_query($pdo, "SELECT ppar.name as product, pv.barcode, w.name as warehouse, s.quantity, pv.cost_price as purchasePrice FROM stock s JOIN product_variants pv ON s.product_id = pv.id JOIN products ppar ON pv.product_id = ppar.id JOIN warehouses w ON s.warehouse_id = w.id ORDER BY s.quantity DESC LIMIT 100");
            }
            $inventoryStock = $stmt->fetchAll(PDO::FETCH_ASSOC);

            // inventoryMovementHistory
            $stmt = execute_query($pdo, "SELECT pm.id, pm.created_at as date, ppar.name as product, pm.movement_type as type, pm.quantity_change as quantity, w.name as sourceDest FROM product_movements pm JOIN product_variants pv ON pm.product_id = pv.id JOIN products ppar ON pv.product_id = ppar.id JOIN warehouses w ON pm.warehouse_id = w.id WHERE $invWhere ORDER BY pm.created_at DESC LIMIT 100", $invParams);
            $inventoryMovementHistory = $stmt->fetchAll(PDO::FETCH_ASSOC);
            
            echo json_encode(['success' => true, 'data' => [
                'inventoryStockByWarehouse' => $inventoryStockByWarehouse,
                'inventoryMovement' => $inventoryMovement,
                'inventoryStock' => $inventoryStock,
                'inventoryMovementHistory' => $inventoryMovementHistory
            ]]);

        } elseif ($action === 'finance') {
            $treasury_id = intval($_GET['treasury_id'] ?? 0);
            $txn_type = trim((string)($_GET['txn_type'] ?? ''));

            // treasuryBalanceHistory
            if ($treasury_id > 0) {
                $stmt_start = execute_query($pdo, "SELECT SUM(amount) as starting_balance FROM transactions WHERE transaction_date < ? AND treasury_id = ?", [$start_date, $treasury_id]);
            } else {
                $stmt_start = execute_query($pdo, "SELECT SUM(amount) as starting_balance FROM transactions WHERE transaction_date < ?", [$start_date]);
            }
            $starting_balance = $stmt_start->fetch(PDO::FETCH_ASSOC)['starting_balance'] ?? 0;

            $financeWhere = "transaction_date BETWEEN ? AND ?";
            $financeParams = [$start_date, $end_date . ' 23:59:59'];
            if ($treasury_id > 0) { $financeWhere .= " AND treasury_id = ?"; $financeParams[] = $treasury_id; }
            if ($txn_type !== '') { $financeWhere .= " AND type = ?"; $financeParams[] = $txn_type; }

            $stmt = execute_query($pdo, "SELECT DATE(transaction_date) as date, SUM(amount) as balance_change FROM transactions WHERE $financeWhere GROUP BY DATE(transaction_date) ORDER BY date ASC", $financeParams);
            $dailyChanges = $stmt->fetchAll(PDO::FETCH_ASSOC);
            
            $balance = floatval($starting_balance);
            $treasuryBalanceHistory = [];
            $changesMap = [];
            foreach($dailyChanges as $change) {
                $changesMap[$change['date']] = floatval($change['balance_change']);
            }

            $currentDate = new DateTime($start_date);
            $endDateObj = new DateTime($end_date);
            while($currentDate <= $endDateObj) {
                $dateStr = $currentDate->format('Y-m-d');
                if(isset($changesMap[$dateStr])) {
                    $balance += $changesMap[$dateStr];
                }
                $treasuryBalanceHistory[] = ['date' => $dateStr, 'balance' => $balance];
                $currentDate->modify('+1 day');
            }

            // expenseCategories
            $expenseWhere = "amount < 0 AND transaction_date BETWEEN ? AND ?";
            $expenseParams = [$start_date, $end_date . ' 23:59:59'];
            if ($treasury_id > 0) { $expenseWhere .= " AND treasury_id = ?"; $expenseParams[] = $treasury_id; }
            if ($txn_type !== '') { $expenseWhere .= " AND type = ?"; $expenseParams[] = $txn_type; }
            $stmt = execute_query($pdo, "SELECT details, amount, type FROM transactions WHERE $expenseWhere", $expenseParams);
            $expenses = $stmt->fetchAll(PDO::FETCH_ASSOC);
            $categoryTotals = [];
            foreach($expenses as $exp) {
                $details = json_decode($exp['details'], true);
                $category = 'غير مصنف';
                if (isset($details['subtype'])) {
                    if ($details['subtype'] === 'expense') $category = 'مصروفات عامة';
                    elseif ($details['subtype'] === 'supplier_payment') $category = 'دفعات موردين';
                } else if ($exp['type'] === 'salary' || (isset($details['notes']) && strpos($details['notes'], 'راتب') !== false)) {
                    $category = 'رواتب';
                } else if ($exp['type'] === 'purchase') {
                    $category = 'مشتريات';
                }
                
                if (!isset($categoryTotals[$category])) $categoryTotals[$category] = 0;
                $categoryTotals[$category] += abs(floatval($exp['amount']));
            }
            $expenseCategoriesData = [];
            foreach($categoryTotals as $name => $value) {
                $expenseCategoriesData[] = ['name' => $name, 'value' => $value];
            }

            // revenueAndExpenseRecords
            $stmt = execute_query($pdo, "SELECT t.transaction_date as date, t.type, t.details, t.amount, tr.name as treasury_name FROM transactions t LEFT JOIN treasuries tr ON t.treasury_id = tr.id WHERE $financeWhere ORDER BY t.transaction_date DESC LIMIT 100", $financeParams);
            $rawRecords = $stmt->fetchAll(PDO::FETCH_ASSOC);
            $revenueAndExpenseRecords = [];
            foreach($rawRecords as $rec) {
                $details = json_decode($rec['details'], true);
                $revenueAndExpenseRecords[] = [
                    'date' => $rec['date'],
                    'type' => floatval($rec['amount']) >= 0 ? 'revenue' : 'expense',
                    'desc' => $details['notes'] ?? $details['note'] ?? $rec['type'],
                    'amount' => floatval($rec['amount']),
                    'treasury' => $rec['treasury_name'] ?? 'غير محدد',
                    'txn_type' => $rec['type'],
                    'raw_details' => $rec['details']
                ];
            }

            echo json_encode(['success' => true, 'data' => [
                'starting_balance' => floatval($starting_balance),
                'treasuryBalanceHistory' => $treasuryBalanceHistory,
                'expenseCategories' => $expenseCategoriesData,
                'revenueAndExpenseRecords' => $revenueAndExpenseRecords
            ]]);
        } elseif ($action === 'compare') {
            $year = intval($_GET['year'] ?? date('Y'));
            $prev_year = $year - 1;

            $months = range(1, 12);
            $sales = array_fill(1, 12, 0.0);
            $sales_prev = array_fill(1, 12, 0.0);
            $profit = array_fill(1, 12, 0.0);
            $profit_prev = array_fill(1, 12, 0.0);
            $expense = array_fill(1, 12, 0.0);
            $expense_prev = array_fill(1, 12, 0.0);

            $stmt = execute_query($pdo, "SELECT MONTH(created_at) as m, COALESCE(SUM(total_amount),0) as total FROM orders WHERE YEAR(created_at) = ? GROUP BY m", [$year]);
            foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
                $sales[intval($row['m'])] = floatval($row['total'] ?? 0);
            }

            $stmt = execute_query($pdo, "SELECT MONTH(created_at) as m, COALESCE(SUM(total_amount),0) as total FROM orders WHERE YEAR(created_at) = ? GROUP BY m", [$prev_year]);
            foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
                $sales_prev[intval($row['m'])] = floatval($row['total'] ?? 0);
            }

            $stmt = execute_query(
                $pdo,
                "SELECT MONTH(o.created_at) as m, COALESCE(SUM((oi.price_per_unit - pv.cost_price) * oi.quantity),0) as profit
                 FROM order_items oi
                 JOIN orders o ON o.id = oi.order_id
                 JOIN product_variants pv ON pv.id = oi.product_id
                 WHERE YEAR(o.created_at) = ?
                 GROUP BY m",
                [$year]
            );
            foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
                $profit[intval($row['m'])] = floatval($row['profit'] ?? 0);
            }

            $stmt = execute_query(
                $pdo,
                "SELECT MONTH(o.created_at) as m, COALESCE(SUM((oi.price_per_unit - pv.cost_price) * oi.quantity),0) as profit
                 FROM order_items oi
                 JOIN orders o ON o.id = oi.order_id
                 JOIN product_variants pv ON pv.id = oi.product_id
                 WHERE YEAR(o.created_at) = ?
                 GROUP BY m",
                [$prev_year]
            );
            foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
                $profit_prev[intval($row['m'])] = floatval($row['profit'] ?? 0);
            }

            $stmt = execute_query($pdo, "SELECT MONTH(transaction_date) as m, COALESCE(SUM(ABS(amount)),0) as total FROM transactions WHERE YEAR(transaction_date) = ? AND amount < 0 GROUP BY m", [$year]);
            foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
                $expense[intval($row['m'])] = floatval($row['total'] ?? 0);
            }

            $stmt = execute_query($pdo, "SELECT MONTH(transaction_date) as m, COALESCE(SUM(ABS(amount)),0) as total FROM transactions WHERE YEAR(transaction_date) = ? AND amount < 0 GROUP BY m", [$prev_year]);
            foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
                $expense_prev[intval($row['m'])] = floatval($row['total'] ?? 0);
            }

            $salesOut = []; $salesPrevOut = []; $profitOut = []; $profitPrevOut = []; $expenseOut = []; $expensePrevOut = [];
            foreach ($months as $m) {
                $salesOut[] = $sales[$m];
                $salesPrevOut[] = $sales_prev[$m];
                $profitOut[] = $profit[$m];
                $profitPrevOut[] = $profit_prev[$m];
                $expenseOut[] = $expense[$m];
                $expensePrevOut[] = $expense_prev[$m];
            }

            echo json_encode(['success' => true, 'data' => [
                'year' => $year,
                'prev_year' => $prev_year,
                'months' => $months,
                'sales' => $salesOut,
                'sales_prev' => $salesPrevOut,
                'profit' => $profitOut,
                'profit_prev' => $profitPrevOut,
                'expense' => $expenseOut,
                'expense_prev' => $expensePrevOut,
                'year_totals' => [
                    'sales' => array_sum($salesOut),
                    'profit' => array_sum($profitOut),
                    'expense' => array_sum($expenseOut)
                ],
                'prev_year_totals' => [
                    'sales' => array_sum($salesPrevOut),
                    'profit' => array_sum($profitPrevOut),
                    'expense' => array_sum($expensePrevOut)
                ]
            ]]);
        } elseif ($action === 'product_delivery') {
            try {
                $params = [$start_date, $end_date . ' 23:59:59'];
                $sql = "SELECT
                            ppar.id AS product_id,
                            ppar.name AS product_name,
                            COALESCE(SUM(oi.quantity),0) AS total_orders,
                            COALESCE(SUM(CASE WHEN o.status = 'delivered' THEN oi.quantity ELSE 0 END),0) AS delivered_qty,
                            COALESCE(SUM(CASE WHEN o.status = 'delivered' THEN (oi.quantity * oi.price_per_unit) ELSE 0 END),0) AS delivered_amount,
                            COALESCE(SUM(CASE WHEN o.status IN ('full_return','partial_return') THEN oi.quantity ELSE 0 END),0) AS returned_qty,
                            COALESCE(SUM(CASE WHEN o.status IN ('full_return','partial_return') THEN (oi.quantity * oi.price_per_unit) ELSE 0 END),0) AS returned_amount
                         FROM order_items oi
                         JOIN product_variants pv ON oi.product_id = pv.id
                         JOIN products ppar ON pv.product_id = ppar.id
                         JOIN orders o ON oi.order_id = o.id
                         WHERE o.created_at BETWEEN ? AND ?
                         GROUP BY ppar.id, ppar.name
                         ORDER BY total_orders DESC";

                $stmt = execute_query($pdo, $sql, $params);
                $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
                echo json_encode(['success' => true, 'data' => $rows]);
            } catch (Exception $e) {
                http_response_code(500);
                echo json_encode(['success' => false, 'message' => 'Failed to compute product delivery report: ' . $e->getMessage()]);
            }

        } elseif ($action === 'getOrderStats') {
            // Fetch real order statistics from the orders table
            try {
                $start = $start_date;
                $end   = $end_date;
                $rep_id = intval($_GET['rep_id'] ?? 0);

                $where = "DATE(o.created_at) BETWEEN ? AND ?";
                $params = [$start, $end];
                if ($rep_id > 0) { $where .= " AND o.rep_id = ?"; $params[] = $rep_id; }

                // Detect delivered / returned status values in DB
                $deliveredStatuses = ['delivered'];
                $returnedStatuses  = ['returned', 'full_return', 'partial_return'];
                $deliveredPlaceholders = implode(',', array_fill(0, count($deliveredStatuses), '?'));
                $returnedPlaceholders  = implode(',', array_fill(0, count($returnedStatuses), '?'));

                // Per-day stats
                $dayStats = [];
                $currentDate = new DateTime($start);
                $endDateObj  = new DateTime($end);
                while ($currentDate <= $endDateObj) {
                    $d = $currentDate->format('Y-m-d');
                    $dayStats[$d] = [
                        'date'               => $d,
                        'delivered_orders'   => 0,
                        'returned_orders'    => 0,
                        'delivered_pieces'   => 0,
                        'returned_pieces'    => 0,
                        'delivered_amount'   => 0.0,
                        'returned_amount'    => 0.0,
                        'pending_orders'     => 0,
                    ];
                    $currentDate->modify('+1 day');
                }

                // Delivered orders per day
                $sql = "SELECT DATE(o.created_at) as d,
                               COUNT(DISTINCT o.id) as cnt,
                               COALESCE(SUM(oi.quantity), 0) as pieces,
                               COALESCE(SUM(oi.quantity * oi.price_per_unit), 0) as amount
                        FROM orders o
                        LEFT JOIN order_items oi ON oi.order_id = o.id
                        WHERE $where AND o.status IN ($deliveredPlaceholders)
                        GROUP BY d";
                $stmtD = execute_query($pdo, $sql, array_merge($params, $deliveredStatuses));
                foreach ($stmtD->fetchAll(PDO::FETCH_ASSOC) as $row) {
                    $d = $row['d'];
                    if (isset($dayStats[$d])) {
                        $dayStats[$d]['delivered_orders'] = intval($row['cnt']);
                        $dayStats[$d]['delivered_pieces'] = intval($row['pieces']);
                        $dayStats[$d]['delivered_amount'] = floatval($row['amount']);
                    }
                }

                // Returned orders per day
                $sql = "SELECT DATE(o.created_at) as d,
                               COUNT(DISTINCT o.id) as cnt,
                               COALESCE(SUM(oi.quantity), 0) as pieces,
                               COALESCE(SUM(oi.quantity * oi.price_per_unit), 0) as amount
                        FROM orders o
                        LEFT JOIN order_items oi ON oi.order_id = o.id
                        WHERE $where AND o.status IN ($returnedPlaceholders)
                        GROUP BY d";
                $stmtR = execute_query($pdo, $sql, array_merge($params, $returnedStatuses));
                foreach ($stmtR->fetchAll(PDO::FETCH_ASSOC) as $row) {
                    $d = $row['d'];
                    if (isset($dayStats[$d])) {
                        $dayStats[$d]['returned_orders'] = intval($row['cnt']);
                        $dayStats[$d]['returned_pieces'] = intval($row['pieces']);
                        $dayStats[$d]['returned_amount'] = floatval($row['amount']);
                    }
                }

                // Pending orders per day
                $sql = "SELECT DATE(o.created_at) as d, COUNT(*) as cnt
                        FROM orders o WHERE $where AND o.status = 'pending' GROUP BY d";
                $stmtP = execute_query($pdo, $sql, $params);
                foreach ($stmtP->fetchAll(PDO::FETCH_ASSOC) as $row) {
                    $d = $row['d'];
                    if (isset($dayStats[$d])) $dayStats[$d]['pending_orders'] = intval($row['cnt']);
                }

                // Totals
                $totals = [
                    'delivered_orders'  => array_sum(array_column($dayStats, 'delivered_orders')),
                    'returned_orders'   => array_sum(array_column($dayStats, 'returned_orders')),
                    'delivered_pieces'  => array_sum(array_column($dayStats, 'delivered_pieces')),
                    'returned_pieces'   => array_sum(array_column($dayStats, 'returned_pieces')),
                    'delivered_amount'  => array_sum(array_column($dayStats, 'delivered_amount')),
                    'returned_amount'   => array_sum(array_column($dayStats, 'returned_amount')),
                    'pending_orders'    => array_sum(array_column($dayStats, 'pending_orders')),
                ];

                // Rep-level stats (if requested without specific rep_id)
                $repStats = [];
                try {
                    $repNameExpr = "CONCAT('مندوب #', o.rep_id)";
                    $repJoins = [];
                    if (table_exists($pdo, 'users')) {
                        $repJoins[] = 'LEFT JOIN users ru ON ru.id = o.rep_id';
                        $repNameExpr = "COALESCE(NULLIF(TRIM(ru.name),''), $repNameExpr)";
                    }
                    $repSql = "SELECT o.rep_id AS id,
                                      $repNameExpr AS name,
                                      COUNT(DISTINCT CASE WHEN o.status IN ($deliveredPlaceholders) THEN o.id END) AS delivered_orders,
                                      COUNT(DISTINCT CASE WHEN o.status IN ($returnedPlaceholders) THEN o.id END) AS returned_orders,
                                      COALESCE(SUM(CASE WHEN o.status IN ($deliveredPlaceholders) THEN oi.quantity ELSE 0 END),0) AS delivered_pieces,
                                      COALESCE(SUM(CASE WHEN o.status IN ($returnedPlaceholders) THEN oi.quantity ELSE 0 END),0) AS returned_pieces,
                                      COALESCE(SUM(CASE WHEN o.status IN ($deliveredPlaceholders) THEN oi.quantity * oi.price_per_unit ELSE 0 END),0) AS delivered_amount,
                                      COALESCE(SUM(CASE WHEN o.status IN ($returnedPlaceholders) THEN oi.quantity * oi.price_per_unit ELSE 0 END),0) AS returned_amount,
                                      COUNT(DISTINCT o.id) AS total_orders
                               FROM orders o
                               " . implode("\n", $repJoins) . "
                               LEFT JOIN order_items oi ON oi.order_id = o.id
                               WHERE DATE(o.created_at) BETWEEN ? AND ?
                                 AND o.rep_id IS NOT NULL AND o.rep_id > 0
                               GROUP BY o.rep_id, name
                               ORDER BY delivered_orders DESC, delivered_amount DESC
                               LIMIT 50";
                    $allStatuses = array_merge($deliveredStatuses, $returnedStatuses, $deliveredStatuses, $returnedStatuses, $deliveredStatuses, $returnedStatuses);
                    $repStmt = execute_query($pdo, $repSql, array_merge($allStatuses, [$start, $end]));
                    $repStats = $repStmt->fetchAll(PDO::FETCH_ASSOC);
                    foreach ($repStats as &$r) {
                        $r['id']               = intval($r['id']);
                        $r['delivered_orders'] = intval($r['delivered_orders']);
                        $r['returned_orders']  = intval($r['returned_orders']);
                        $r['delivered_pieces'] = intval($r['delivered_pieces']);
                        $r['returned_pieces']  = intval($r['returned_pieces']);
                        $r['delivered_amount'] = floatval($r['delivered_amount']);
                        $r['returned_amount']  = floatval($r['returned_amount']);
                        $r['total_orders']     = intval($r['total_orders']);
                    }
                    unset($r);
                } catch (Exception $e) { $repStats = []; }

                echo json_encode(['success' => true, 'data' => [
                    'per_day' => array_values($dayStats),
                    'totals'  => $totals,
                    'rep_stats' => $repStats,
                ]]);
            } catch (Exception $e) {
                http_response_code(500);
                echo json_encode(['success' => false, 'message' => 'Failed to load order stats: ' . $e->getMessage()]);
            }

        } elseif ($action === 'archives') {
            $limit = intval($_GET['limit'] ?? 100);
            if ($limit <= 0) $limit = 100;
            $pdo->exec("CREATE TABLE IF NOT EXISTS report_archives (
                id INT AUTO_INCREMENT PRIMARY KEY,
                report_date DATE NOT NULL,
                report_type VARCHAR(50) NOT NULL,
                sections TEXT NULL,
                html LONGTEXT NULL,
                sent TINYINT(1) DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX(report_date),
                INDEX(report_type),
                INDEX(created_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
            $sql = "SELECT id, report_date, report_type, sections, sent, created_at" . ($include_html ? ", html" : "") . " FROM report_archives WHERE report_date BETWEEN ? AND ? ORDER BY report_date DESC, id DESC LIMIT ?";
            $stmt = execute_query($pdo, $sql, [$start_date, $end_date, $limit]);
            $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
            echo json_encode(['success' => true, 'data' => $rows]);
        }
        break;
    case 'workers':
        ensure_workers_tables($pdo);
        try {
            $action = $_GET['action'] ?? 'getAll';
            $perm_code = map_action_to_perm($action);
            if ($perm_code) {
                check_permission_or_die($pdo, 'workers', $perm_code);
            }

            if ($action === 'getAll') {
                $month = $_GET['month'] ?? date('Y-m');
                $monthStart = $month . '-01';
                $monthEnd = date('Y-m-t', strtotime($monthStart));

                if (table_exists($pdo, 'product_tracking') && column_exists($pdo, 'product_tracking', 'finished_at') && column_exists($pdo, 'product_tracking', 'is_paid') && column_exists($pdo, 'product_tracking', 'piece_rate')) {
                    $stmt = execute_query(
                        $pdo,
                        "SELECT
                            w.*,
                            COALESCE(SUM(CASE WHEN pt.is_paid = 1 AND pt.piece_rate > 0 THEN pt.piece_rate ELSE 0 END), 0) AS manufacturing_extra
                         FROM workers w
                         LEFT JOIN product_tracking pt
                            ON pt.worker_id = w.id
                            AND pt.finished_at IS NOT NULL
                            AND pt.finished_at BETWEEN ? AND ?
                         GROUP BY w.id
                         ORDER BY w.name ASC",
                        [$monthStart . ' 00:00:00', $monthEnd . ' 23:59:59']
                    );
                    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
                } else {
                    $stmt = execute_query($pdo, "SELECT w.*, 0 AS manufacturing_extra FROM workers w ORDER BY w.name ASC", []);
                    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
                }
                echo json_encode(['success' => true, 'data' => $rows]);
                break;
            }

            if ($action === 'getAttendanceSummary') {
                check_permission_or_die($pdo, 'workers', 'view');
                $worker_id = intval($_GET['worker_id'] ?? 0);
                $month = $_GET['month'] ?? date('Y-m');
                if (!$worker_id) {
                    http_response_code(400);
                    echo json_encode(['success' => false, 'message' => 'Worker ID is required.']);
                    break;
                }
                $wStmt = execute_query($pdo, "SELECT id, name, fingerprint_no FROM workers WHERE id = ? LIMIT 1", [$worker_id]);
                $worker = $wStmt->fetch(PDO::FETCH_ASSOC);
                if (!$worker) {
                    http_response_code(404);
                    echo json_encode(['success' => false, 'message' => 'Worker not found.']);
                    break;
                }
                $fp = trim((string)($worker['fingerprint_no'] ?? ''));
                if ($fp === '') {
                    echo json_encode(['success' => true, 'data' => ['worker' => $worker, 'present_days' => 0, 'days' => []]]);
                    break;
                }
                $monthStart = $month . '-01';
                $monthEnd = date('Y-m-t', strtotime($monthStart));
                if (!table_exists($pdo, 'attendance_logs')) {
                    echo json_encode(['success' => true, 'data' => ['worker' => $worker, 'present_days' => 0, 'days' => []]]);
                    break;
                }
                $stmt = execute_query(
                    $pdo,
                    "SELECT DATE(check_time) as day, MIN(check_time) as first_in, MAX(check_time) as last_out, COUNT(*) as punches
                     FROM attendance_logs
                     WHERE device_user_id = ? AND check_time BETWEEN ? AND ?
                     GROUP BY DATE(check_time)
                     ORDER BY day ASC",
                    [$fp, $monthStart . ' 00:00:00', $monthEnd . ' 23:59:59']
                );
                $days = $stmt->fetchAll(PDO::FETCH_ASSOC);
                echo json_encode(['success' => true, 'data' => ['worker' => $worker, 'present_days' => count($days), 'days' => $days]]);
                break;
            }

			if (isset($input['hire_date'])) {
				$input['hire_date'] = normalize_date_ymd($input['hire_date']);
			}

            handle_crud($pdo, 'workers', $input, ['name', 'job_title', 'salary_type', 'salary_amount', 'hire_date', 'phone', 'fingerprint_no', 'attendance_enabled', 'default_shift_id', 'status']);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => 'Workers error: ' . $e->getMessage()]);
        }
        break;
    case 'worker_transactions':
        ensure_workers_tables($pdo);
        try {
            $action = $_GET['action'] ?? 'getAll';
            $perm_code = map_action_to_perm($action);
            if ($perm_code) {
                check_permission_or_die($pdo, 'workers', $perm_code);
            }

			if (isset($input['date'])) {
				$input['date'] = normalize_date_ymd($input['date']);
			}

            handle_crud($pdo, 'worker_transactions', $input, ['worker_id', 'amount', 'type', 'date', 'notes', 'status']);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => 'Worker transactions error: ' . $e->getMessage()]);
        }
        break;
    case 'worker_salaries':
        ensure_workers_tables($pdo);
        try {
            $action = $_GET['action'] ?? 'getForMonth';
            $perm_code = map_action_to_perm($action);
            if ($perm_code) {
                check_permission_or_die($pdo, 'workers', $perm_code);
            }

            if ($action === 'getForMonth') {
                $month = $_GET['month'] ?? date('Y-m');
                $monthStart = $month . '-01';
                $monthEnd = date('Y-m-t', strtotime($monthStart));
                $stmt = execute_query(
                    $pdo,
                    "SELECT
                        s.*,
                        w.name as worker_name,
                        CASE WHEN w.salary_type = 'piecework' THEN 0 ELSE COALESCE(mx.manufacturing_extra, 0) END as manufacturing_extra
                     FROM worker_salaries s
                     JOIN workers w ON w.id = s.worker_id
                     LEFT JOIN (
                        SELECT worker_id, COALESCE(SUM(amount), 0) AS manufacturing_extra
                        FROM worker_transactions
                        WHERE type = 'piecework' AND date BETWEEN ? AND ?
                        GROUP BY worker_id
                     ) mx ON mx.worker_id = s.worker_id
                     WHERE s.period_type = 'month' AND s.period_value = ?
                     ORDER BY w.name ASC",
                    [$monthStart, $monthEnd, $month]
                );
                echo json_encode(['success' => true, 'data' => $stmt->fetchAll(PDO::FETCH_ASSOC)]);
                break;
            }

            if ($action === 'processPayroll') {
                $month = $input['month'] ?? date('Y-m');
                $includeAttendance = isset($input['include_attendance']) ? boolval($input['include_attendance']) : true;
                $generateAttendance = isset($input['generate_attendance']) ? boolval($input['generate_attendance']) : true;
                $monthStart = $month . '-01';
                $monthEnd = date('Y-m-t', strtotime($monthStart));
                $daysInMonth = intval(date('t', strtotime($monthStart)));

                $workersStmt = execute_query($pdo, "SELECT id, name, salary_type, salary_amount, fingerprint_no FROM workers WHERE status = 'active'");
                $workers = $workersStmt->fetchAll(PDO::FETCH_ASSOC);

                $attendanceMap = [];
                if ($includeAttendance) {
                    try {
                        if ($generateAttendance) {
                            $pdo->beginTransaction();
                            attendance_generate_worker_summary_range($pdo, $monthStart, $monthEnd);
                            $pdo->commit();
                        }
                    } catch (Exception $e) {
                        if ($pdo->inTransaction()) $pdo->rollBack();
                    }

                    try {
                        $attStmt = execute_query(
                            $pdo,
                            "SELECT s.worker_id,
                                    SUM(s.late_minutes * sh.late_penalty_per_minute) AS late_penalty,
                                    SUM(s.early_leave_minutes * sh.early_leave_penalty_per_minute) AS early_penalty,
                                    SUM(s.is_absent * sh.absence_penalty_per_day) AS absence_penalty,
                                    SUM((s.overtime_minutes / 60) * sh.overtime_rate_per_hour) AS overtime_bonus
                             FROM attendance_worker_daily_summary s
                             LEFT JOIN attendance_shifts sh ON sh.id = s.shift_id
                             WHERE s.work_date BETWEEN ? AND ?
                             GROUP BY s.worker_id",
                            [$monthStart, $monthEnd]
                        );
                        foreach ($attStmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
                            $attendanceMap[intval($row['worker_id'])] = [
                                'deductions' => floatval($row['late_penalty'] ?? 0) + floatval($row['early_penalty'] ?? 0) + floatval($row['absence_penalty'] ?? 0),
                                'bonuses' => floatval($row['overtime_bonus'] ?? 0)
                            ];
                        }
                    } catch (Exception $e) {
                        $attendanceMap = [];
                    }
                }

                $pdo->beginTransaction();
                try {
                    foreach ($workers as $w) {
                        $wid = intval($w['id']);
                        $salaryType = (string)($w['salary_type'] ?? 'daily');
                        $salaryAmount = floatval($w['salary_amount'] ?? 0);

                        // Manufacturing extra (piecework) for the month: include regardless of status.
                        $manufacturingExtra = 0.0;
                        try {
                            $mStmt = execute_query(
                                $pdo,
                                "SELECT COALESCE(SUM(amount), 0) FROM worker_transactions WHERE worker_id = ? AND type = 'piecework' AND date BETWEEN ? AND ?",
                                [$wid, $monthStart, $monthEnd]
                            );
                            $manufacturingExtra = floatval($mStmt->fetchColumn() ?? 0);
                        } catch (Exception $e) {
                            $manufacturingExtra = 0.0;
                        }

                        // pending tx totals for the month
                        $txStmt = execute_query(
                            $pdo,
                            "SELECT type, SUM(amount) total
                             FROM worker_transactions
                             WHERE worker_id = ? AND status = 'pending' AND date BETWEEN ? AND ?
                             GROUP BY type",
                            [$wid, $monthStart, $monthEnd]
                        );
                        $txMap = [];
                        foreach ($txStmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
                            $txMap[(string)$row['type']] = floatval($row['total'] ?? 0);
                        }

                        $advances = floatval($txMap['advance'] ?? 0);
                        $penalties = floatval($txMap['penalty'] ?? 0);
                        $bonuses = floatval($txMap['bonus'] ?? 0);
                        // NOTE: piecework is computed separately as manufacturingExtra

                        $base = 0.0;
                        if ($salaryType === 'monthly') {
                            $base = $salaryAmount;
                        } elseif ($salaryType === 'weekly') {
                            $base = $salaryAmount * 4;
                        } elseif ($salaryType === 'daily') {
                            $fp = trim((string)($w['fingerprint_no'] ?? ''));
                            $presentDays = 0;
                            $hasIdentifier = false;

                            if (table_exists($pdo, 'attendance_device_workers')) {
                                try {
                                    $m = execute_query($pdo, "SELECT COUNT(*) FROM attendance_device_workers WHERE worker_id = ?", [$wid])->fetchColumn();
                                    if (intval($m) > 0) $hasIdentifier = true;
                                    $pStmt = execute_query(
                                        $pdo,
                                        "SELECT COUNT(DISTINCT DATE(l.check_time))
                                         FROM attendance_logs l
                                         JOIN attendance_device_workers mw ON mw.device_id = l.device_id AND mw.device_user_id = l.device_user_id
                                         WHERE mw.worker_id = ? AND l.check_time BETWEEN ? AND ?",
                                        [$wid, $monthStart . ' 00:00:00', $monthEnd . ' 23:59:59']
                                    );
                                    $presentDays = intval($pStmt->fetchColumn());
                                } catch (Exception $e) {
                                    // ignore
                                }
                            }

                            if ($presentDays === 0 && $fp !== '' && table_exists($pdo, 'attendance_logs')) {
                                $hasIdentifier = true;
                                try {
                                    $pStmt = execute_query(
                                        $pdo,
                                        "SELECT COUNT(DISTINCT DATE(check_time)) FROM attendance_logs WHERE device_user_id = ? AND check_time BETWEEN ? AND ?",
                                        [$fp, $monthStart . ' 00:00:00', $monthEnd . ' 23:59:59']
                                    );
                                    $presentDays = intval($pStmt->fetchColumn());
                                } catch (Exception $e) {
                                    $presentDays = 0;
                                }
                            }

                            // If worker is linked to attendance but has no punches, pay 0 (instead of full month)
                            if ($hasIdentifier) {
                                $base = $salaryAmount * $presentDays;
                            } else {
                                // legacy fallback: no attendance identifier configured
                                $base = $salaryAmount * $daysInMonth;
                            }
                        } elseif ($salaryType === 'piecework') {
                            // Piecework workers: wages are the manufacturing extra itself
                            $base = $manufacturingExtra;
                        } else {
                            $base = $salaryAmount;
                        }

                        $attendanceDeductions = $attendanceMap[$wid]['deductions'] ?? 0;
                        $attendanceBonuses = $attendanceMap[$wid]['bonuses'] ?? 0;

                        $deductions = $advances + $penalties + $attendanceDeductions;
                        $netExtra = ($salaryType === 'piecework') ? 0.0 : $manufacturingExtra;
                        $net = $base + $bonuses + $attendanceBonuses + $netExtra - $deductions;

                        execute_query(
                            $pdo,
                            "INSERT INTO worker_salaries (worker_id, period_type, period_value, base_salary, deductions, bonuses, net_salary, status)
                             VALUES (?, 'month', ?, ?, ?, ?, ?, 'pending')
                             ON DUPLICATE KEY UPDATE
                             base_salary = VALUES(base_salary),
                             deductions = VALUES(deductions),
                             bonuses = VALUES(bonuses),
                             net_salary = VALUES(net_salary),
                             status = 'pending'",
                            [$wid, $month, $base, $deductions, $bonuses, $net]
                        );

                        // Mark processed pending tx as deducted
                        execute_query(
                            $pdo,
                            "UPDATE worker_transactions SET status = 'deducted'
                             WHERE worker_id = ? AND status = 'pending' AND date BETWEEN ? AND ?",
                            [$wid, $monthStart, $monthEnd]
                        );
                    }
                    $pdo->commit();
                    echo json_encode(['success' => true, 'message' => 'Payroll processed successfully for ' . $month]);
                } catch (Exception $e) {
                    if ($pdo->inTransaction()) $pdo->rollBack();
                    throw $e;
                }
                break;
            }

            if ($action === 'pay') {
                $salary_id = intval($input['id'] ?? 0);
                if (!$salary_id) {
                    http_response_code(400);
                    echo json_encode(['success' => false, 'message' => 'Salary ID is required.']);
                    break;
                }
                $pdo->beginTransaction();
                try {
                    $salaryStmt = execute_query($pdo, "SELECT worker_id, net_salary, period_value FROM worker_salaries WHERE id = ? AND status = 'pending'", [$salary_id]);
                    $salary = $salaryStmt->fetch(PDO::FETCH_ASSOC);
                    if (!$salary) throw new Exception('Salary not found or already paid.');
                    $wid = intval($salary['worker_id']);
                    $net = floatval($salary['net_salary']);
                    $period = (string)($salary['period_value'] ?? date('Y-m'));

                    execute_query($pdo, "UPDATE worker_salaries SET status = 'paid', paid_at = NOW() WHERE id = ?", [$salary_id]);
                    $notes = 'راتب شهر ' . $period;
                    execute_query($pdo, "INSERT INTO worker_transactions (worker_id, amount, type, date, notes, status) VALUES (?, ?, 'salary', CURDATE(), ?, 'deducted')", [$wid, $net, $notes]);
                    $pdo->commit();
                    echo json_encode(['success' => true]);
                } catch (Exception $e) {
                    if ($pdo->inTransaction()) $pdo->rollBack();
                    http_response_code(500);
                    echo json_encode(['success' => false, 'message' => $e->getMessage()]);
                }
                break;
            }

            if ($action === 'getReport') {
                $worker_id = intval($_GET['worker_id'] ?? 0);
                $month = $_GET['month'] ?? date('Y-m');
                if (!$worker_id) {
                    http_response_code(400);
                    echo json_encode(['success' => false, 'message' => 'Worker ID is required.']);
                    break;
                }
                $monthStart = $month . '-01';
                $monthEnd = date('Y-m-t', strtotime($monthStart));

                $wStmt = execute_query($pdo, "SELECT id, name, job_title, salary_type, salary_amount FROM workers WHERE id = ? LIMIT 1", [$worker_id]);
                $worker = $wStmt->fetch(PDO::FETCH_ASSOC);
                if (!$worker) {
                    http_response_code(404);
                    echo json_encode(['success' => false, 'message' => 'Worker not found.']);
                    break;
                }

                $txStmt = execute_query(
                    $pdo,
                    "SELECT id, amount, type, date, notes, status
                     FROM worker_transactions
                     WHERE worker_id = ? AND date BETWEEN ? AND ?
                     ORDER BY date ASC",
                    [$worker_id, $monthStart, $monthEnd]
                );
                $txRows = $txStmt->fetchAll(PDO::FETCH_ASSOC);

                $totals = ['advance' => 0, 'bonus' => 0, 'penalty' => 0, 'piecework' => 0, 'salary' => 0];
                foreach ($txRows as $tx) {
                    $t = (string)($tx['type'] ?? '');
                    if (isset($totals[$t])) $totals[$t] += floatval($tx['amount'] ?? 0);
                }

                $salaryStmt = execute_query(
                    $pdo,
                    "SELECT id, base_salary, deductions, bonuses, net_salary, status, paid_at
                     FROM worker_salaries
                     WHERE worker_id = ? AND period_type = 'month' AND period_value = ?
                     LIMIT 1",
                    [$worker_id, $month]
                );
                $salaryRow = $salaryStmt->fetch(PDO::FETCH_ASSOC);

                // Best-effort estimate
                $daysInMonth = intval(date('t', strtotime($monthStart)));
                $salaryType = (string)($worker['salary_type'] ?? 'daily');
                $salaryAmount = floatval($worker['salary_amount'] ?? 0);
                $base = 0.0;
                if ($salaryType === 'monthly') $base = $salaryAmount;
                elseif ($salaryType === 'weekly') $base = $salaryAmount * 4;
                elseif ($salaryType === 'daily') $base = $salaryAmount * $daysInMonth;
                elseif ($salaryType === 'piecework') $base = floatval($totals['piecework']);
                else $base = $salaryAmount;

                $bonuses = floatval($totals['bonus']);
                $deductions = floatval($totals['advance']) + floatval($totals['penalty']);
                $netEstimate = $base + $bonuses - $deductions;

                echo json_encode([
                    'success' => true,
                    'data' => [
                        'worker' => $worker,
                        'month' => $month,
                        'transactions' => ['rows' => $txRows, 'totals' => $totals],
                        'salary' => $salaryRow,
                        'computed' => [
                            'base_salary' => $base,
                            'bonuses' => $bonuses,
                            'deductions' => $deductions,
                            'net_estimate' => $netEstimate,
                            'salary_paid' => floatval($totals['salary'])
                        ]
                    ]
                ]);
                break;
            }

            echo json_encode(['success' => false, 'message' => 'Unsupported worker_salaries action']);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => 'Worker salaries error: ' . $e->getMessage()]);
        }
        break;
    default:
        http_response_code(404);
        echo json_encode(['success' => false, 'message' => "Module '$module' not found."]);
        break;
}

function handle_crud($pdo, $table, $input, $fields, $select_fields = "*") {
    $action = $_GET['action'] ?? 'getAll';
    // Backward compatibility: older frontend uses `add` instead of `create`
    if ($action === 'add') $action = 'create';
    // Also accept a common alias
    if ($action === 'getall') $action = 'getAll';

    // Map CRUD actions to permission action codes
    $perm_map = [
        'getAll' => 'view', 'getBy' => 'view', 'getById' => 'view',
        'create' => 'add', 'add' => 'add', 'update' => 'edit', 'delete' => 'delete'
    ];
    $perm_code = $perm_map[$action] ?? null;
    if ($perm_code) {
        $perm_module = $table;
        if ($table === 'employee_transactions' || $table === 'employee_salaries') {
            $perm_module = 'employees';
        }
        // Use table name as module identifier. Admins bypass inside user_has_permission.
        check_permission_or_die($pdo, $perm_module, $perm_code);
    }

    // Trim fields to only those that exist in the actual table to avoid Unknown column errors
    $available_fields = [];
    foreach ($fields as $f) {
        if (column_exists($pdo, $table, $f)) $available_fields[] = $f;
    }
    // If no available fields, fallback to original fields to avoid breaking read-only operations
    if (empty($available_fields)) {
        $available_fields = $fields;
    }

    switch ($action) {
        case 'getAll':
            // For products, hide archived items by default and ensure column exists
            if ($table === 'products') {
                try {
                    if (!column_exists($pdo, 'product_variants', 'is_archived')) {
                        execute_query($pdo, "ALTER TABLE product_variants ADD COLUMN is_archived TINYINT(1) NOT NULL DEFAULT 0");
                    }
                } catch (Exception $e) {
                    // ignore migration failure
                }
                $stmt = execute_query($pdo, "SELECT $select_fields FROM $table WHERE COALESCE(is_archived,0) = 0 ORDER BY id DESC");
            } else {
                $stmt = execute_query($pdo, "SELECT $select_fields FROM $table ORDER BY id DESC");
            }
            echo json_encode(['success' => true, 'data' => $stmt->fetchAll(PDO::FETCH_ASSOC)]);
            break;

        case 'create':
            // Special handling for users: ensure they have a password (generate if missing)
            $generated_password = null;
            if ($table === 'users' && !isset($input['password'])) {
                try {
                    $plain = bin2hex(random_bytes(4));
                } catch (Exception $ex) {
                    $plain = substr(sha1(uniqid('', true)), 0, 8);
                }
                // Hash password before storing
                if (function_exists('password_hash')) {
                    $input['password'] = password_hash($plain, PASSWORD_DEFAULT);
                } else {
                    $input['password'] = md5($plain);
                }
                $generated_password = $plain;
            }

            // Representatives are not meant to login; allow creating them without providing username/password in the UI.
            // We still must satisfy DB constraints (username is UNIQUE NOT NULL in most schemas), so we generate one.
            if ($table === 'users') {
                $role = strtolower(trim((string)($input['role'] ?? '')));
                $needsUsername = (!isset($input['username']) || trim((string)$input['username']) === '');
                if ($role === 'representative' && $needsUsername && column_exists($pdo, 'users', 'username')) {
                    $candidate = null;
                    for ($i = 0; $i < 12; $i++) {
                        try {
                            $suffix = bin2hex(random_bytes(2));
                        } catch (Exception $ex) {
                            $suffix = substr(sha1(uniqid('', true)), 0, 4);
                        }
                        $cand = 'rep_' . date('ymdHis') . '_' . $suffix;
                        $check = execute_query($pdo, "SELECT id FROM users WHERE username = ? LIMIT 1", [$cand]);
                        if (!$check->fetch(PDO::FETCH_ASSOC)) {
                            $candidate = $cand;
                            break;
                        }
                        usleep(5000);
                    }
                    if (!$candidate) {
                        $candidate = 'rep_' . time();
                    }
                    $input['username'] = $candidate;
                }
            }

            // If a password was provided (e.g., from frontend), ensure it's hashed before storing
            if (isset($input['password']) && is_string($input['password'])) {
                $pw = $input['password'];
                // If it doesn't look like a bcrypt/argon hash, hash it
                if (!preg_match('/^\$2[ayb]\$|^\$argon2/', $pw)) {
                    if (function_exists('password_hash')) {
                        $input['password'] = password_hash($pw, PASSWORD_DEFAULT);
                    } else {
                        $input['password'] = md5($pw);
                    }
                }
            }

            // Build insert using only the available fields that are actually present in the input
            $insertFields = [];
            $values = [];
            foreach ($available_fields as $field) {
                if (isset($input[$field])) {
                    $insertFields[] = $field;
                    $values[] = $input[$field];
                }
            }

            if (count($insertFields) === 0) {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'No fields provided to insert.']);
                return;
            }

            $cols = implode(', ', $insertFields);
            $placeholders = implode(', ', array_fill(0, count($insertFields), '?'));

            try {
                execute_query($pdo, "INSERT INTO $table ($cols) VALUES ($placeholders)", $values);
            } catch (PDOException $e) {
                // Handle common duplicate key errors gracefully (instead of fatal/unhandled exception)
                $errInfo = isset($e->errorInfo) && is_array($e->errorInfo) ? $e->errorInfo : null;
                $mysqlCode = $errInfo && isset($errInfo[1]) ? intval($errInfo[1]) : 0;
                $isDuplicate = ($mysqlCode === 1062) || (strpos($e->getMessage(), 'Duplicate entry') !== false);

                if ($isDuplicate) {
                    http_response_code(409);
                    if ($table === 'users') {
                        echo json_encode(['success' => false, 'message' => 'اسم المستخدم موجود بالفعل. يرجى اختيار اسم مختلف.']);
                        return;
                    }
                    echo json_encode(['success' => false, 'message' => 'القيمة موجودة بالفعل (Duplicate).']);
                    return;
                }

                http_response_code(500);
                echo json_encode(['success' => false, 'message' => 'Database error.']);
                return;
            }

            $lastId = $pdo->lastInsertId();

            // Audit log
            audit_log($pdo, $table, 'create', $lastId, json_encode(['fields' => $insertFields]));

            $stmt = execute_query($pdo, "SELECT $select_fields FROM $table WHERE id = ?", [$lastId]);
            $row = $stmt->fetch(PDO::FETCH_ASSOC);
            $response = ['success' => true, 'data' => $row];
            if ($generated_password) $response['generated_password'] = $generated_password;
            echo json_encode($response);
            break;

        case 'update':
            $id = $input['id'] ?? 0;
            if (!$id) {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'ID is required for update.']);
                return;
            }
            
            $set_parts = [];
            $values = [];
            foreach ($available_fields as $field) {
                if (isset($input[$field])) {
                    $set_parts[] = "$field = ?";
                    $values[] = $input[$field];
                }
            }
            $values[] = $id;
            $set_sql = implode(', ', $set_parts);

            if (!empty($set_sql)) {
                execute_query($pdo, "UPDATE $table SET $set_sql WHERE id = ?", $values);
            }

            // Audit log
            audit_log($pdo, $table, 'update', $id, json_encode(['fields' => $set_parts]));
            
            echo json_encode(['success' => true, 'message' => 'Updated successfully.']);
            break;

        case 'delete':
            $id = $input['id'] ?? 0;
            if (!$id) {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'ID is required for deletion.']);
                return;
            }

            // Special balance check for customers/suppliers
            if ($table === 'customers' || $table === 'suppliers') {
                $stmt = execute_query($pdo, "SELECT (total_credit - total_debit) as balance FROM $table WHERE id = ?", [$id]);
                if ($stmt->fetchColumn() != 0) {
                    http_response_code(400);
                    echo json_encode(['success' => false, 'message' => 'Cannot delete with a non-zero balance.']);
                    return;
                }
            }
             if ($table === 'treasuries') {
                $stmt = execute_query($pdo, "SELECT current_balance FROM $table WHERE id = ?", [$id]);
                if ($stmt->fetchColumn() != 0) {
                    http_response_code(400);
                    echo json_encode(['success' => false, 'message' => 'Cannot delete with a non-zero balance.']);
                    return;
                }
            }

            // If deleting products, perform soft-delete (archive) instead of hard delete
            if ($table === 'products') {
                try {
                    if (!column_exists($pdo, 'products', 'is_archived')) {
                        execute_query($pdo, "ALTER TABLE products ADD COLUMN is_archived TINYINT(1) NOT NULL DEFAULT 0");
                    }
                } catch (Exception $e) {
                    // ignore migration failure
                }
                $stmt = execute_query($pdo, "UPDATE products SET is_archived = 1 WHERE id = ? LIMIT 1", [$id]);
                $affected = is_object($stmt) && method_exists($stmt, 'rowCount') ? $stmt->rowCount() : 0;
                if ($affected === 0) {
                    http_response_code(404);
                    echo json_encode(['success' => false, 'message' => 'لم يتم العثور على المنتج أو لم يتم أرشفته.']);
                } else {
                    audit_log($pdo, $table, 'archive', $id, null);
                    echo json_encode(['success' => true, 'message' => 'تم إخفاء المنتج (مؤرشف).']);
                }
                break;
            }

            execute_query($pdo, "DELETE FROM $table WHERE id = ?", [$id]);
            audit_log($pdo, $table, 'delete', $id, null);
            echo json_encode(['success' => true, 'message' => 'Deleted successfully.']);
            break;

        default:
            http_response_code(404);
            echo json_encode(['success' => false, 'message' => "Action '$action' not found in $table module."]);
            break;
    }
}
?>    