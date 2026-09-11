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

$input = json_decode(file_get_contents('php://input'), true) ?: [];
$network = trim($input['network'] ?? '');
$start = intval($input['start'] ?? 1);
$end = intval($input['end'] ?? 254);
$portsInput = $input['ports'] ?? [80, 8000, 4370];

function detect_local_subnet() {
    $os = strtoupper(substr(PHP_OS, 0, 3));
    if ($os === 'WIN') {
        $ipconfig = @shell_exec('ipconfig');
        if ($ipconfig && preg_match('/IPv4 Address[.\s]+:\s*(\d{1,3}\.\d{1,3}\.\d{1,3})\.\d{1,3}/i', $ipconfig, $m)) {
            if ($m[1] !== '127.0.0') return $m[1];
        }
    }
    $hostIp = gethostbyname(gethostname());
    if (filter_var($hostIp, FILTER_VALIDATE_IP, FILTER_FLAG_IPV4)) {
        $parts = explode('.', $hostIp);
        if (count($parts) === 4 && $parts[0] !== '127') {
            return $parts[0] . '.' . $parts[1] . '.' . $parts[2];
        }
    }
    return '192.168.1';
}

if ($network === '' || $network === 'auto') {
    $network = detect_local_subnet();
}

if ($start < 1) $start = 1;
if ($end > 254) $end = 254;
if ($start > $end) {
    $tmp = $start; $start = $end; $end = $tmp;
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

set_time_limit(20);

// ══════════════════════════════════════════════════════════════════
// 1. Hikvision SADP Discovery Protocol (UDP broadcast on port 37020)
// ══════════════════════════════════════════════════════════════════
function sadp_discover_hikvision($timeoutSeconds = 0.8) {
    $found = [];
    $sock = @stream_socket_server("udp://0.0.0.0:0", $errno, $errstr, STREAM_SERVER_BIND);
    if (!$sock) return $found;

    stream_set_blocking($sock, false);
    $uuid = sprintf('%04x%04x-%04x-%04x-%04x-%04x%04x%04x', mt_rand(0, 0xffff), mt_rand(0, 0xffff), mt_rand(0, 0xffff), mt_rand(0, 0x0fff) | 0x4000, mt_rand(0, 0x3fff) | 0x8000, mt_rand(0, 0xffff), mt_rand(0, 0xffff), mt_rand(0, 0xffff));
    $probe = "<?xml version=\"1.0\" encoding=\"utf-8\"?><Probe><Uuid>$uuid</Uuid><Types>inquiry</Types></Probe>";

    @stream_socket_sendto($sock, $probe, 0, "239.255.255.250:37020");
    @stream_socket_sendto($sock, $probe, 0, "255.255.255.255:37020");

    $start = microtime(true);
    while ((microtime(true) - $start) < $timeoutSeconds) {
        $read = [$sock];
        $write = null;
        $except = null;
        $ready = @stream_select($read, $write, $except, 0, 100000);
        if ($ready > 0) {
            $buf = @stream_socket_recvfrom($sock, 4096, 0, $peer);
            if ($buf && strpos($buf, '<ProbeMatch>') !== false) {
                $xml = @simplexml_load_string($buf);
                if ($xml) {
                    $ip = trim((string)($xml->IPv4Address ?? ''));
                    if ($ip !== '') {
                        $httpPort = intval($xml->HttpPort ?? 80);
                        if ($httpPort <= 0) $httpPort = 80;
                        $cmdPort = intval($xml->CommandPort ?? 8000);
                        $found[$ip] = [
                            'ip' => $ip,
                            'port' => $httpPort, // Use HTTP ISAPI port for DragonPro web requests
                            'ports' => array_values(array_unique([$httpPort, $cmdPort])),
                            'vendor' => 'hikvision',
                            'model' => trim((string)($xml->DeviceDescription ?? $xml->DeviceType ?? 'Hikvision Terminal')),
                            'serial_number' => trim((string)($xml->DeviceSN ?? '')),
                            'firmware' => trim((string)($xml->SoftwareVersion ?? '')),
                            'mac' => trim((string)($xml->MAC ?? '')),
                            'discovered_by' => 'SADP (Hikvision Broadcast)'
                        ];
                    }
                }
            }
        }
    }
    @fclose($sock);
    return $found;
}

// ══════════════════════════════════════════════════════════════════
// 2. Fast Active ARP Discovery (Windows LAN Cache)
// ══════════════════════════════════════════════════════════════════
function get_active_arp_ips($network, $start, $end) {
    $activeIps = [];
    $os = strtoupper(substr(PHP_OS, 0, 3));
    if ($os === 'WIN') {
        $raw = @shell_exec('arp -a');
        if ($raw) {
            $pattern = '/' . preg_quote($network, '/') . '\.(\d{1,3})/';
            if (preg_match_all($pattern, $raw, $matches)) {
                foreach ($matches[1] as $num) {
                    $n = intval($num);
                    if ($n >= $start && $n <= $end && $n !== 255) {
                        $activeIps[] = $network . '.' . $n;
                    }
                }
            }
        }
    }
    return array_values(array_unique($activeIps));
}

// ══════════════════════════════════════════════════════════════════
// 3. Main Scanning Pipeline
// ══════════════════════════════════════════════════════════════════
$results = [];

// A. First run SADP (Hikvision instant discovery)
$sadpResults = sadp_discover_hikvision(0.7);
foreach ($sadpResults as $ip => $dev) {
    $results[$ip] = $dev;
}

// B. Find active IPs from ARP table in this network range
$activeIps = get_active_arp_ips($network, $start, $end);

// If user is scanning a specific small range (<= 15 IPs), include all of them
if (($end - $start + 1) <= 15) {
    for ($i = $start; $i <= $end; $i++) {
        $activeIps[] = $network . '.' . $i;
    }
    $activeIps = array_values(array_unique($activeIps));
}

// C. Fast targeted TCP port check on active IPs that were not already identified by SADP
foreach ($activeIps as $ip) {
    if (isset($results[$ip])) continue; // already identified via SADP

    $openPorts = [];
    foreach ($ports as $port) {
        $port = intval($port);
        if ($port <= 0) continue;
        $errno = 0; $errstr = '';
        $conn = @stream_socket_client("tcp://$ip:$port", $errno, $errstr, 0.15, STREAM_CLIENT_CONNECT);
        if ($conn) {
            fclose($conn);
            $openPorts[] = $port;
        }
    }

    if (count($openPorts) > 0) {
        $vendor = 'other';
        $preferredPort = 80;

        if (in_array(4370, $openPorts)) {
            $vendor = 'zkteco';
            $preferredPort = 4370;
        } elseif (in_array(8000, $openPorts)) {
            $vendor = 'hikvision';
            // Hikvision ISAPI uses port 80 for HTTP API requests even if 8000 SDK is open
            $preferredPort = in_array(80, $openPorts) ? 80 : 8000;
        } elseif (in_array(80, $openPorts)) {
            $preferredPort = 80;
        } else {
            $preferredPort = $openPorts[0];
        }

        $results[$ip] = [
            'ip' => $ip,
            'port' => $preferredPort,
            'ports' => $openPorts,
            'vendor' => $vendor,
            'model' => $vendor === 'hikvision' ? 'Hikvision Terminal' : ($vendor === 'zkteco' ? 'ZKTeco Terminal' : 'Device'),
            'serial_number' => '',
            'firmware' => '',
            'mac' => '',
            'discovered_by' => 'LAN Port Scan'
        ];
    }
}

echo json_encode([
    'success' => true,
    'network' => $network,
    'data' => array_values($results)
]);
