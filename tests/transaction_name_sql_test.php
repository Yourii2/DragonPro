<?php

require_once __DIR__ . '/../components/transaction_name_sql.php';

$pdo = new PDO('sqlite::memory:');
$pdo->sqliteCreateFunction('JSON_VALID', static function ($json) {
    if ($json === null) return 0;
    json_decode($json);
    return json_last_error() === JSON_ERROR_NONE ? 1 : 0;
}, 1);
$pdo->sqliteCreateFunction('JSON_UNQUOTE', static function ($value) {
    return $value === null ? null : (string)$value;
}, 1);

$pdo->exec('CREATE TABLE transactions (id INTEGER, details TEXT, related_to_type TEXT, related_to_id INTEGER)');
$pdo->exec('CREATE TABLE representatives (id INTEGER, name TEXT)');
$pdo->exec('CREATE TABLE users (id INTEGER, name TEXT)');
$pdo->exec('CREATE TABLE employees (id INTEGER, name TEXT)');
$pdo->exec('CREATE TABLE customers (id INTEGER, name TEXT)');
$pdo->exec('CREATE TABLE suppliers (id INTEGER, name TEXT)');
$pdo->exec("INSERT INTO users VALUES (5, 'Omar')");
$pdo->exec("INSERT INTO users VALUES (7, 'User representative')");
$pdo->exec("INSERT INTO representatives VALUES (7, 'Table representative')");
$pdo->exec("INSERT INTO employees VALUES (5, 'Wrong employee')");
$pdo->exec("INSERT INTO employees VALUES (6, 'Regular employee')");
$pdo->exec("INSERT INTO transactions VALUES (1, '{\"rep_id\":5}', 'employee', 6)");
$pdo->exec("INSERT INTO transactions VALUES (2, '{}', 'employee', 6)");
$pdo->exec("INSERT INTO transactions VALUES (3, '{\"rep_id\":7}', 'employee', 5)");

$expression = build_transaction_related_name_expr(true);
$rows = $pdo->query("SELECT t.id, {$expression} AS related_name FROM transactions t ORDER BY t.id")->fetchAll(PDO::FETCH_KEY_PAIR);

if (($rows[1] ?? null) !== 'Omar') {
    throw new RuntimeException('Rep-linked transactions must resolve the representative name before employee names.');
}
if (($rows[2] ?? null) !== 'Regular employee') {
    throw new RuntimeException('Regular employee transactions must continue to resolve the employee name.');
}
if (($rows[3] ?? null) !== 'Table representative') {
    throw new RuntimeException('Representative table names must take precedence over user fallback names.');
}

$fallbackExpression = build_transaction_related_name_expr(false);
$fallbackName = $pdo->query("SELECT {$fallbackExpression} AS related_name FROM transactions t WHERE t.id = 1")->fetchColumn();
if ($fallbackName !== 'Omar') {
    throw new RuntimeException('Rep-linked transactions must resolve from users when no representatives table exists.');
}

echo "Transaction name SQL test passed.\n";
