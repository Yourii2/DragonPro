<?php
// Simple CLI smoke runner for components/api.php
// Usage: php scripts/smoke_api.php permissions getMyModules

$module = $argv[1] ?? 'permissions';
$action = $argv[2] ?? 'getMyModules';

$_SERVER['REQUEST_METHOD'] = 'GET';
$_GET['module'] = $module;
$_GET['action'] = $action;

ob_start();
include __DIR__ . '/../components/api.php';
$out = ob_get_clean();

echo $out;
