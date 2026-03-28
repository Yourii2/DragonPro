<?php
session_start();

// CORS
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if ($origin) header('Access-Control-Allow-Origin: ' . $origin);
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Access-Control-Allow-Credentials: true');
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit(0); }

$input = json_decode(file_get_contents('php://input'), true);
$network = trim($input['network'] ?? '');
$start = intval($input['start'] ?? 1);
$end = intval($input['end'] ?? 254);
$portsInput = $input['ports'] ?? [80, 8000, 4370];

if ($network === '') {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Network prefix is required.']);
    exit;
}

if ($start < 1 || $end > 254 || $start > $end) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Invalid range.']);
    exit;
}

$ports = [];
if (is_array($portsInput)) {
    $ports = $portsInput;
} else if (is_string($portsInput)) {
    $parts = explode(',', $portsInput);
    foreach ($parts as $p) {
        $p = intval(trim($p));
        if ($p > 0) $ports[] = $p;
    }
}
if (count($ports) === 0) {
    $ports = [80, 8000, 4370];
}

set_time_limit(60);

function guess_vendor_from_ports($ports) {
    if (in_array(4370, $ports)) return 'zkteco';
    if (in_array(8000, $ports)) return 'hikvision';
    if (in_array(80, $ports)) return 'other';
    return 'other';
}

$results = [];
for ($i = $start; $i <= $end; $i++) {
    $ip = $network . '.' . $i;
    $openPorts = [];
    foreach ($ports as $port) {
        $port = intval($port);
        if ($port <= 0) continue;
        $errno = 0;
        $errstr = '';
        $conn = @stream_socket_client("tcp://$ip:$port", $errno, $errstr, 0.2, STREAM_CLIENT_CONNECT);
        if ($conn) {
            fclose($conn);
            $openPorts[] = $port;
        }
    }
    if (count($openPorts) > 0) {
        $preferred = null;
        foreach ([4370, 8000, 80] as $p) {
            if (in_array($p, $openPorts)) { $preferred = $p; break; }
        }
        if ($preferred === null) $preferred = $openPorts[0];
        $results[] = [
            'ip' => $ip,
            'port' => $preferred,
            'ports' => $openPorts,
            'vendor' => guess_vendor_from_ports($openPorts)
        ];
    }
}

echo json_encode(['success' => true, 'data' => $results]);
