<?php
// Basic smoke test for permissions endpoints (run from project root with PHP CLI)
echo "Permissions API smoke test\n";
$base = 'http://localhost/Dragon/components/api.php?module=permissions&action=';
$tests = [
    'getModules',
    'getActions',
    'getUserDefaults'
];

foreach ($tests as $t) {
    $url = $base . $t;
    echo "Requesting $url ... ";
    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    $res = curl_exec($ch);
    $err = curl_error($ch);
    curl_close($ch);
    if ($res === false) { echo "FAILED: $err\n"; continue; }
    $j = json_decode($res, true);
    if (!$j) { echo "INVALID JSON\n"; continue; }
    echo (isset($j['success']) && $j['success'] ? "OK\n" : "ERROR: " . ($j['message'] ?? json_encode($j)) . "\n");
}

echo "Done.\n";

?>

