<?php
require_once __DIR__ . '/../config.php';
header('Content-Type: application/json; charset=utf-8');
// Accept JSON body or form POST
$input = json_decode(file_get_contents('php://input'), true);
if (!$input) {
    $input = $_POST;
}

$username = trim((string)($input['username'] ?? ''));
$new = (string)($input['new_password'] ?? '');
$dragon = (string)($input['dragon_password'] ?? '');

if ($username === '' || $new === '') {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Missing username or new_password']);
    exit;
}

// Simple guard: require the special Dragon password to authorize resets
if ($dragon !== '22002020') {
    http_response_code(403);
    echo json_encode(['success' => false, 'message' => 'Invalid Dragon password']);
    exit;
}

try {
    $pdo = new PDO('mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=utf8mb4', DB_USER, DB_PASS);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    // Find user by username
    $stmt = $pdo->prepare('SELECT id FROM users WHERE username = ? LIMIT 1');
    $stmt->execute([$username]);
    $u = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$u) {
        http_response_code(404);
        echo json_encode(['success' => false, 'message' => 'User not found']);
        exit;
    }

    $newHash = password_hash($new, PASSWORD_DEFAULT);
    $upd = $pdo->prepare('UPDATE users SET password = ? WHERE id = ?');
    $upd->execute([$newHash, intval($u['id'])]);

    echo json_encode(['success' => true, 'message' => 'Password updated']);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => $e->getMessage()]);
}

?>

