<?php
session_start();

// CORS for login endpoint - echo origin and allow credentials
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if ($origin) header('Access-Control-Allow-Origin: ' . $origin);
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Access-Control-Allow-Credentials: true');
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit(0);
}

// Include the database configuration
if (!file_exists(__DIR__ . '/../config.php')) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Configuration file not found. Please run setup.']);
    exit;
}
require_once __DIR__ . '/../config.php';

try {
    $pdo = new PDO("mysql:host=" . DB_HOST . ";dbname=" . DB_NAME . ";charset=utf8mb4", DB_USER, DB_PASS);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Database connection failed.']);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true);

if (empty($input['username']) || empty($input['password'])) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Username and password are required.']);
    exit;
}

$username = $input['username'];
$password = $input['password'];

$stmt = $pdo->prepare("SELECT * FROM users WHERE username = ?");
$stmt->execute([$username]);
$user = $stmt->fetch(PDO::FETCH_ASSOC);

if ($user && password_verify($password, $user['password'])) {
    if (isset($user['role']) && strtolower((string)$user['role']) === 'representative') {
        http_response_code(403);
        echo json_encode(['success' => false, 'message' => 'حساب المندوب غير مسموح له بتسجيل الدخول.']);
        exit;
    }

    unset($user['password']); 

    // Store user info in session. Include user_id for compatibility with API checks.
    $_SESSION['user'] = $user;
    $_SESSION['user_id'] = isset($user['id']) ? intval($user['id']) : null;
    $_SESSION['loggedin'] = true;

    echo json_encode(['success' => true, 'user' => $_SESSION['user']]);
} else {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'Invalid username or password.']);
}
