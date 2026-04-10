<?php
// Run this script via scheduler: php components/report_run.php

if (!file_exists(__DIR__ . '/../config.php')) {
    echo "Configuration file not found.\n";
    exit(1);
}
require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/smtp_mail.php';

try {
    $pdo = new PDO("mysql:host=" . DB_HOST . ";dbname=" . DB_NAME . ";charset=utf8mb4", DB_USER, DB_PASS);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
} catch (PDOException $e) {
    echo "Database connection failed.\n";
    exit(1);
}

$settings = [];
try {
    $stmt = $pdo->query("SELECT config_key, config_value FROM settings");
    $settings = $stmt->fetchAll(PDO::FETCH_KEY_PAIR);
} catch (Exception $e) { $settings = []; }

$auto = isset($settings['report_auto']) && ($settings['report_auto'] === 'true' || $settings['report_auto'] === '1');
if (!$auto) {
    echo "Auto report disabled.\n";
    exit(0);
}

$email = $settings['report_email'] ?? '';
$verified = ($settings['report_email_verified'] ?? 'false') === 'true';
if (!$email || !$verified) {
    echo "Report email not verified.\n";
    exit(0);
}

$today = date('Y-m-d');
$sections = [];
$report1Rows = [];
$report2Rows = [];
$companyName = $settings['company_name'] ?? '';
$companyLogo = $settings['company_logo'] ?? '';

function column_exists_local($pdo, $table, $column) {
    try {
        $stmt = $pdo->prepare("SHOW COLUMNS FROM `$table` LIKE ?");
        $stmt->execute([$column]);
        return $stmt->rowCount() > 0;
    } catch (Exception $e) {
        return false;
    }
}

function safe_json_decode($raw) {
    if (!$raw) return [];
    if (is_array($raw)) return $raw;
    $txt = (string)$raw;
    if ($txt === '') return [];
    $decoded = json_decode($txt, true);
    return is_array($decoded) ? $decoded : [];
}

function resolve_logo_data_uri($logoPath) {
    $logoPath = trim((string)$logoPath);
    if ($logoPath === '') return '';
    if (stripos($logoPath, 'data:') === 0) return $logoPath;
    if (stripos($logoPath, 'http://') === 0 || stripos($logoPath, 'https://') === 0) return $logoPath;

    $relative = $logoPath;
    if ($relative[0] !== '/') {
        $relative = '/' . $relative;
    }
    $fullPath = __DIR__ . '/..' . $relative;
    if (!file_exists($fullPath)) return '';

    $ext = strtolower(pathinfo($fullPath, PATHINFO_EXTENSION));
    $mime = 'image/png';
    if ($ext === 'jpg' || $ext === 'jpeg') $mime = 'image/jpeg';
    if ($ext === 'webp') $mime = 'image/webp';
    if ($ext === 'gif') $mime = 'image/gif';

    $data = file_get_contents($fullPath);
    if ($data === false) return '';
    return 'data:' . $mime . ';base64,' . base64_encode($data);
}

function ensure_report_archive($pdo) {
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
}

function archive_report($pdo, $reportDate, $reportType, $sections, $html, $sent) {
    try {
        ensure_report_archive($pdo);
        $stmt = $pdo->prepare("INSERT INTO report_archives (report_date, report_type, sections, html, sent) VALUES (?, ?, ?, ?, ?)");
        $stmt->execute([$reportDate, $reportType, json_encode($sections), $html, $sent ? 1 : 0]);
    } catch (Exception $e) {
        // ignore archive failures
    }
}

$ordersHaveUpdated = column_exists_local($pdo, 'orders', 'updated_at');
$ordersDateExpr = $ordersHaveUpdated ? "COALESCE(o.updated_at, o.created_at)" : "o.created_at";

$reportDailySales = ($settings['report_daily_sales'] ?? 'false') === 'true' || ($settings['report_daily_sales'] ?? '') === '1';
$reportDailyTreasury = ($settings['report_daily_treasury'] ?? 'false') === 'true' || ($settings['report_daily_treasury'] ?? '') === '1';

$sectionsUsed = [];

if ($reportDailySales) {
    $sectionsUsed[] = 'daily_sales';
    $repStmt = $pdo->query("SELECT id, name FROM users WHERE role = 'representative' ORDER BY name ASC");
    $reps = $repStmt->fetchAll(PDO::FETCH_ASSOC);

    foreach ($reps as $rep) {
        $repId = intval($rep['id']);

        $startBalStmt = $pdo->prepare("SELECT COALESCE(SUM(amount),0) FROM transactions WHERE related_to_type = 'rep' AND related_to_id = ? AND transaction_date < ?");
        $startBalStmt->execute([$repId, $today . ' 00:00:00']);
        $startBal = floatval($startBalStmt->fetchColumn() ?? 0);

        $currentBalStmt = $pdo->prepare("SELECT COALESCE(SUM(amount),0) FROM transactions WHERE related_to_type = 'rep' AND related_to_id = ? AND transaction_date <= ?");
        $currentBalStmt->execute([$repId, $today . ' 23:59:59']);
        $currentBal = floatval($currentBalStmt->fetchColumn() ?? 0);

        $paymentStmt = $pdo->prepare("SELECT COALESCE(SUM(ABS(amount)),0) FROM transactions WHERE related_to_type = 'rep' AND related_to_id = ? AND transaction_date BETWEEN ? AND ? AND type IN ('rep_payment_in','rep_payment_out','payment_in','payment_out','payment')");
        $paymentStmt->execute([$repId, $today . ' 00:00:00', $today . ' 23:59:59']);
        $paidToday = floatval($paymentStmt->fetchColumn() ?? 0);

        $beforeStmt = $pdo->prepare("SELECT COUNT(DISTINCT o.id) as order_count, COALESCE(SUM(oi.quantity),0) as pieces FROM orders o LEFT JOIN order_items oi ON oi.order_id = o.id WHERE o.rep_id = ? AND o.status IN ('with_rep','partial','postponed') AND DATE($ordersDateExpr) < ?");
        $beforeStmt->execute([$repId, $today]);
        $beforeRow = $beforeStmt->fetch(PDO::FETCH_ASSOC);

        $receivedStmt = $pdo->prepare("SELECT COUNT(DISTINCT o.id) as order_count, COALESCE(SUM(oi.quantity),0) as pieces FROM orders o LEFT JOIN order_items oi ON oi.order_id = o.id WHERE o.rep_id = ? AND o.status IN ('with_rep','partial','postponed') AND DATE($ordersDateExpr) = ?");
        $receivedStmt->execute([$repId, $today]);
        $receivedRow = $receivedStmt->fetch(PDO::FETCH_ASSOC);

        $deliveredStmt = $pdo->prepare("SELECT COUNT(DISTINCT o.id) as order_count, COALESCE(SUM(oi.quantity),0) as pieces FROM orders o LEFT JOIN order_items oi ON oi.order_id = o.id WHERE o.rep_id = ? AND o.status = 'delivered' AND DATE($ordersDateExpr) = ?");
        $deliveredStmt->execute([$repId, $today]);
        $deliveredRow = $deliveredStmt->fetch(PDO::FETCH_ASSOC);

        $returnedStmt = $pdo->prepare("SELECT COUNT(DISTINCT o.id) as order_count, COALESCE(SUM(oi.quantity),0) as pieces FROM orders o LEFT JOIN order_items oi ON oi.order_id = o.id WHERE o.rep_id = ? AND o.status = 'returned' AND DATE($ordersDateExpr) = ?");
        $returnedStmt->execute([$repId, $today]);
        $returnedRow = $returnedStmt->fetch(PDO::FETCH_ASSOC);

        $report1Rows[] = [
            'rep_name' => $rep['name'],
            'start_balance' => number_format($startBal, 2, '.', ','),
            'orders_before' => intval($beforeRow['order_count'] ?? 0),
            'pieces_before' => intval($beforeRow['pieces'] ?? 0),
            'orders_received' => intval($receivedRow['order_count'] ?? 0),
            'pieces_received' => intval($receivedRow['pieces'] ?? 0),
            'orders_delivered' => intval($deliveredRow['order_count'] ?? 0),
            'pieces_delivered' => intval($deliveredRow['pieces'] ?? 0),
            'orders_returned' => intval($returnedRow['order_count'] ?? 0),
            'pieces_returned' => intval($returnedRow['pieces'] ?? 0),
            'current_balance' => number_format($currentBal, 2, '.', ','),
            'paid_today' => number_format($paidToday, 2, '.', ','),
            'remaining' => number_format($currentBal, 2, '.', ',')
        ];
    }
}

if ($reportDailyTreasury) {
    $sectionsUsed[] = 'daily_treasury';
    $startBalanceStmt = $pdo->prepare("SELECT COALESCE(SUM(amount),0) as starting_balance FROM transactions WHERE transaction_date < ?");
    $startBalanceStmt->execute([$today . ' 00:00:00']);
    $startBalance = floatval($startBalanceStmt->fetchColumn() ?? 0);

    $txnStmt = $pdo->prepare("SELECT transaction_date, type, details, amount FROM transactions WHERE transaction_date BETWEEN ? AND ?");
    $txnStmt->execute([$today . ' 00:00:00', $today . ' 23:59:59']);
    $txns = $txnStmt->fetchAll(PDO::FETCH_ASSOC);

    $totalRevenue = 0; $totalExpense = 0; $totalDeposits = 0; $totalPayments = 0; $supplierPayments = 0; $expenses = 0;
    foreach ($txns as $tx) {
        $amt = floatval($tx['amount'] ?? 0);
        $type = strtolower((string)($tx['type'] ?? ''));
        $details = safe_json_decode($tx['details'] ?? null);
        $desc = strtolower((string)($details['notes'] ?? $details['note'] ?? ''));

        if ($amt >= 0) $totalRevenue += $amt; else $totalExpense += abs($amt);

        if ($amt > 0 && ($type === 'payment_in' || $type === 'deposit' || strpos($desc, 'ايداع') !== false || ($details['subtype'] ?? '') === 'deposit')) {
            $totalDeposits += $amt;
        }

        if ($amt < 0 && (strpos($type, 'payment') !== false || strpos($desc, 'دفع') !== false || strpos($desc, 'دفعة') !== false)) {
            $totalPayments += abs($amt);
        }

        if ($amt < 0 && (($details['subtype'] ?? '') === 'supplier_payment' || $type === 'supplier_payment')) {
            $supplierPayments += abs($amt);
        }

        if ($amt < 0 && (($details['subtype'] ?? '') === 'expense' || $type === 'expense')) {
            $expenses += abs($amt);
        }
    }

    $endBalance = $startBalance + array_reduce($txns, function($sum, $t){ return $sum + floatval($t['amount'] ?? 0); }, 0.0);

    $deliveredStmt = $pdo->prepare("SELECT COUNT(*) as order_count, COALESCE(SUM(o.total_amount),0) as amount FROM orders o WHERE o.status = 'delivered' AND DATE($ordersDateExpr) = ?");
    $deliveredStmt->execute([$today]);
    $deliveredRow = $deliveredStmt->fetch(PDO::FETCH_ASSOC);

    $returnedStmt = $pdo->prepare("SELECT COUNT(*) as order_count, COALESCE(SUM(o.total_amount),0) as amount FROM orders o WHERE o.status = 'returned' AND DATE($ordersDateExpr) = ?");
    $returnedStmt->execute([$today]);
    $returnedRow = $returnedStmt->fetch(PDO::FETCH_ASSOC);

    $deliveredPiecesStmt = $pdo->prepare("SELECT COALESCE(SUM(oi.quantity),0) as pieces FROM orders o LEFT JOIN order_items oi ON oi.order_id = o.id WHERE o.status = 'delivered' AND DATE($ordersDateExpr) = ?");
    $deliveredPiecesStmt->execute([$today]);
    $deliveredPieces = floatval($deliveredPiecesStmt->fetchColumn() ?? 0);

    $returnedPiecesStmt = $pdo->prepare("SELECT COALESCE(SUM(oi.quantity),0) as pieces FROM orders o LEFT JOIN order_items oi ON oi.order_id = o.id WHERE o.status = 'returned' AND DATE($ordersDateExpr) = ?");
    $returnedPiecesStmt->execute([$today]);
    $returnedPieces = floatval($returnedPiecesStmt->fetchColumn() ?? 0);

    $report2Rows = [
        ['label' => 'رصيد البداية', 'value' => number_format($startBalance, 2, '.', ',')],
        ['label' => 'إجمالي الإيرادات', 'value' => number_format($totalRevenue, 2, '.', ',')],
        ['label' => 'إجمالي المصروفات', 'value' => number_format($totalExpense, 2, '.', ',')],
        ['label' => 'إجمالي الإيداعات', 'value' => number_format($totalDeposits, 2, '.', ',')],
        ['label' => 'إجمالي الدفعات', 'value' => number_format($totalPayments, 2, '.', ',')],
        ['label' => 'رصيد النهاية', 'value' => number_format($endBalance, 2, '.', ',')],
        ['label' => 'عدد الطلبيات المسلمة', 'value' => intval($deliveredRow['order_count'] ?? 0)],
        ['label' => 'عدد الطلبيات المرتجعة', 'value' => intval($returnedRow['order_count'] ?? 0)],
        ['label' => 'إجمالي القطع المسلمة', 'value' => number_format($deliveredPieces, 0, '.', ',')],
        ['label' => 'إجمالي القطع المرتجعة', 'value' => number_format($returnedPieces, 0, '.', ',')],
        ['label' => 'إجمالي المبيعات (مبلغ)', 'value' => number_format(floatval($deliveredRow['amount'] ?? 0), 2, '.', ',')],
        ['label' => 'إجمالي المرتجعات (مبلغ)', 'value' => number_format(floatval($returnedRow['amount'] ?? 0), 2, '.', ',')],
        ['label' => 'إجمالي المصروفات', 'value' => number_format($expenses, 2, '.', ',')],
        ['label' => 'إجمالي دفعات للموردين', 'value' => number_format($supplierPayments, 2, '.', ',')],
        ['label' => 'إجمالي الإيداعات', 'value' => number_format($totalDeposits, 2, '.', ',')]
    ];
}

if (!$reportDailySales && !$reportDailyTreasury) {
    echo "No report sections enabled.\n";
    exit(0);
}

$report1Html = '';
if ($reportDailySales) {
    if (count($report1Rows) === 0) {
        $report1Html = '<p style="margin:0; color:#64748b;">لا توجد بيانات للمندوبين في هذا اليوم.</p>';
    } else {
        $report1Html = '<table class="table report1"><thead><tr>' .
            '<th>اسم المندوب</th><th>المبلغ في بداية الفترة</th><th>عدد الطلبيات قبل الفترة</th><th>عدد القطع قبل الفترة</th>' .
            '<th>عدد الطلبيات المستلمة في اليومية</th><th>عدد القطع المستلمة في اليومية</th><th>عدد الطلبيات المسلمة</th>' .
            '<th>عدد القطع المسلمة</th><th>عدد الطلبيات المرتجعة</th><th>عدد القطع المرتجعة</th><th>المبلغ الحالي</th>' .
            '<th>تم دفع</th><th>المتبقي (له/عليه)</th>' .
            '</tr></thead><tbody>';
        foreach ($report1Rows as $row) {
            $report1Html .= '<tr>' .
                '<td>' . $row['rep_name'] . '</td>' .
                '<td>' . $row['start_balance'] . '</td>' .
                '<td>' . $row['orders_before'] . '</td>' .
                '<td>' . $row['pieces_before'] . '</td>' .
                '<td>' . $row['orders_received'] . '</td>' .
                '<td>' . $row['pieces_received'] . '</td>' .
                '<td>' . $row['orders_delivered'] . '</td>' .
                '<td>' . $row['pieces_delivered'] . '</td>' .
                '<td>' . $row['orders_returned'] . '</td>' .
                '<td>' . $row['pieces_returned'] . '</td>' .
                '<td>' . $row['current_balance'] . '</td>' .
                '<td>' . $row['paid_today'] . '</td>' .
                '<td>' . $row['remaining'] . '</td>' .
                '</tr>';
        }
        $report1Html .= '</tbody></table>';
    }
    $sections[] = '<div class="section"><div class="section-title">التقرير الأول</div>' . $report1Html . '</div>';
}

if ($reportDailyTreasury) {
    $report2Html = '<div class="grid-cards">';
    foreach ($report2Rows as $item) {
        $report2Html .= '<div class="card-item"><div class="card-label">' . $item['label'] . '</div><div class="card-value">' . $item['value'] . '</div></div>';
    }
    $report2Html .= '</div>';
    $sections[] = '<div class="section"><div class="section-title">التقرير الثاني</div>' . $report2Html . '</div>';
}

$logoSrc = resolve_logo_data_uri($companyLogo);
$logoHtml = $logoSrc !== '' ? '<img src="' . $logoSrc . '" alt="logo" class="logo" />' : '';
$companyHtml = $companyName !== '' ? '<div class="company">' . $companyName . '</div>' : '';

$body = '<!doctype html><html><head><meta charset="utf-8">' .
    '<title>تقرير يومي</title>' .
    '<style>' .
    'body{margin:0;padding:0;background:#f8fafc;font-family:Tahoma,Arial,sans-serif;direction:rtl;color:#0f172a;}' .
    '.wrap{max-width:1100px;margin:24px auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;box-shadow:0 10px 25px rgba(15,23,42,0.06);padding:24px;}' .
    '.header{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:16px;border-bottom:1px solid #e2e8f0;padding-bottom:12px;}' .
    '.brand{display:flex;align-items:center;gap:12px;}' .
    '.logo{width:48px;height:48px;object-fit:cover;border-radius:12px;border:1px solid #e2e8f0;background:#fff;}' .
    '.company{font-size:16px;font-weight:700;color:#1e293b;}' .
    '.title{font-size:20px;font-weight:700;margin-bottom:12px;}' .
    '.sub{color:#64748b;font-size:12px;margin-bottom:20px;}' .
    '.section{margin-top:20px;}' .
    '.section-title{font-size:16px;font-weight:700;margin-bottom:12px;color:#1e293b;}' .
    '.table{width:100%;border-collapse:collapse;font-size:12px;}' .
    '.table th,.table td{border:1px solid #e2e8f0;padding:8px;text-align:center;white-space:nowrap;}' .
    '.table th{background:#f1f5f9;font-weight:700;}' .
    '.report1{direction:rtl;}' .
    '.report1 th,.report1 td{text-align:right;}' .
    '.grid-cards{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;}' .
    '.card-item{border:1px solid #e2e8f0;border-radius:12px;padding:10px 12px;background:linear-gradient(135deg,#f8fafc,#ffffff);box-shadow:0 6px 14px rgba(15,23,42,0.04);}' .
    '.card-label{color:#475569;font-size:12px;font-weight:600;margin-bottom:6px;}' .
    '.card-value{color:#0f172a;font-size:16px;font-weight:800;letter-spacing:0.2px;}' .
    '@media(max-width:800px){.grid-cards{grid-template-columns:1fr;}.table{font-size:11px;}.table th,.table td{padding:6px;}}' .
        '</style></head><body><div class="wrap">' .
        '<div class="header">' .
            '<div class="brand">' . $logoHtml . $companyHtml . '</div>' .
            '<div>' .
                '<div class="title">تقرير يومي</div>' .
                '<div class="sub">التاريخ: ' . $today . '</div>' .
            '</div>' .
        '</div>' .
    implode('', $sections) .
    '</div></body></html>';
$sent = smtp_send_mail($email, 'Dragon Daily Report - ' . $today, $body);

archive_report($pdo, $today, 'daily', $sectionsUsed, $body, $sent);

if ($sent) {
    echo "Report sent.\n";
    exit(0);
}

echo "Report failed.\n";
exit(1);
