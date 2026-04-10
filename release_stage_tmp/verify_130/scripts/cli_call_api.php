<?php
// Usage: php cli_call_api.php module action [key=value ...]
if (php_sapi_name() !== 'cli') {
    echo "Run from CLI\n";
    exit(1);
}
$argv = $_SERVER['argv'];
if (count($argv) < 3) { echo "Usage: php cli_call_api.php module action [key=value ...]\n"; exit(1); }
$_GET = [];
$_GET['module'] = $argv[1];
$_GET['action'] = $argv[2];
for ($i=3;$i<count($argv);$i++) {
    $p = $argv[$i];
    if (strpos($p,'=')!==false) {
        list($k,$v) = explode('=', $p, 2);
        $_GET[$k] = $v;
    }
}
// include api
require_once __DIR__ . '/../components/api.php';
