
export const PHP_LOGIC = `
<?php
/**
 * Senior Architect Note: Using Native PHP for high-performance direct execution 
 * or Laravel as a wrapper for better developer ergonomics.
 */

session_start();

/**
 * 1. Global Permission Checker
 * Blocks access to unauthorized page slugs
 */
function check_permission($page_slug) {
    global $pdo;
    
    // Admin has override
    if ($_SESSION['user_role'] === 'admin') return true;

    $stmt = $pdo->prepare("SELECT can_access FROM user_page_permissions WHERE user_id = ? AND page_slug = ?");
    $stmt->execute([$_SESSION['user_id'], $page_slug]);
    $result = $stmt->fetch();

    if (!$result || !$result['can_access']) {
        http_response_code(403);
        die("Unauthorized: You do not have permission to access this module.");
    }
    
    return true;
}

/**
 * 2. Data Scoping Snippet
 * How to filter SQL queries based on user restrictions
 */
function get_filtered_stock_query() {
    $userId = $_SESSION['user_id'];
    $restrictedWhId = $_SESSION['restricted_warehouse_id'];

    // Base query
    $sql = "SELECT p.name, s.quantity, w.name as warehouse_name 
            FROM stock s
            JOIN products p ON s.product_id = p.id
            JOIN warehouses w ON s.warehouse_id = w.id";

    // Append Scoping Logic
    if ($restrictedWhId !== null && $restrictedWhId != 0) {
        $sql .= " WHERE s.warehouse_id = " . intval($restrictedWhId);
    }

    return $sql;
}

/**
 * 3. Treasury Scoping for Financials
 */
function fetch_treasury_balance($treasury_id) {
    global $pdo;
    $restrictedTrId = $_SESSION['restricted_treasury_id'];

    if ($restrictedTrId !== null && $restrictedTrId != 0 && $restrictedTrId != $treasury_id) {
        throw new Exception("Security Alert: User attempted to access unauthorized treasury.");
    }

    $stmt = $pdo->prepare("SELECT current_balance FROM treasuries WHERE id = ?");
    $stmt->execute([$treasury_id]);
    return $stmt->fetchColumn();
}
?>
`;
