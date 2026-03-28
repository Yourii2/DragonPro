<?php
require_once __DIR__ . '/../config.php';
header('Content-Type: application/json; charset=utf-8');

$input = json_decode(file_get_contents('php://input'), true);
if (!$input) { $input = $_POST; }

$dragon = isset($input['dragon_password']) ? (string)$input['dragon_password'] : '';
if ($dragon !== '22002020') {
    http_response_code(403);
    echo json_encode(['success' => false, 'message' => 'Invalid Dragon password']);
    exit;
}

$name = isset($input['name']) ? trim((string)$input['name']) : '';
$username = isset($input['username']) ? trim((string)$input['username']) : '';
$password = isset($input['password']) ? (string)$input['password'] : '';

if ($name === '' || $username === '' || $password === '') {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'name, username and password are required']);
    exit;
}

try {
    $pdo = new PDO('mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=utf8mb4', DB_USER, DB_PASS);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    // ensure username unique
    $check = $pdo->prepare('SELECT id FROM users WHERE username = ? LIMIT 1');
    $check->execute([$username]);
    if ($check->fetch(PDO::FETCH_ASSOC)) {
        http_response_code(409);
        echo json_encode(['success' => false, 'message' => 'Username already exists']);
        exit;
    }

    $hash = password_hash($password, PASSWORD_DEFAULT);
    $stmt = $pdo->prepare('INSERT INTO users (name, username, password, role) VALUES (?, ?, ?, ? )');
    $stmt->execute([$name, $username, $hash, 'admin']);
    $user_id = $pdo->lastInsertId();

    // Grant page permissions
    $all_pages = [
        'dashboard','factory-stock','factory-management','manufacturing-management','dispatch','factory-receiving',
        'inventory','orders','sales','crm','srm','reps','hrm','workers','finance','reports','admin','permissions','attendance','sales-offices','barcode-print','settings'
    ];
    $permStmt = $pdo->prepare('INSERT IGNORE INTO user_page_permissions (user_id, page_slug, can_access) VALUES (?, ?, 1)');
    foreach ($all_pages as $p) {
        try { $permStmt->execute([$user_id, $p]); } catch (Exception $e) { /* ignore individual failures */ }
    }

    // Grant action-level permissions if tables exist
    $hasPermTables = true;
    foreach (['permission_modules', 'permission_actions', 'user_permissions'] as $t) {
        $res = $pdo->query("SHOW TABLES LIKE '" . $t . "'");
        if (!$res || $res->rowCount() === 0) { $hasPermTables = false; break; }
    }
    if ($hasPermTables) {
        $pdo->exec("INSERT IGNORE INTO user_permissions (user_id, module_id, action_id, allowed) SELECT " . intval($user_id) . ", m.id, a.id, 1 FROM permission_modules m CROSS JOIN permission_actions a");
    }

    echo json_encode(['success' => true, 'message' => 'Admin user created', 'username' => $username]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => $e->getMessage()]);
}

?>
