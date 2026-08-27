<?php
// This key should be a random binary string and stored securely.
// For this example, we'll use a hardcoded key.
define('Dragon_ENCRYPTION_KEY', 'a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6'); // 32 bytes for AES-256
define('Dragon_ENCRYPTION_METHOD', 'aes-256-cbc');

function encrypt_data($data) {
    $iv = openssl_random_pseudo_bytes(openssl_cipher_iv_length(Dragon_ENCRYPTION_METHOD));
    $encrypted = openssl_encrypt($data, Dragon_ENCRYPTION_METHOD, Dragon_ENCRYPTION_KEY, 0, $iv);
    // Store IV as base64 separately to avoid binary data / delimiter collisions
    return base64_encode(base64_encode($iv) . '::' . $encrypted);
}

function decrypt_data($data) {
    if (empty($data) || !is_string($data)) return false;
    $data = trim($data);

    // Format 1: Direct JSON string check (if stored as plain text JSON)
    if ((substr($data, 0, 1) === '{' && substr($data, -1) === '}') || (substr($data, 0, 1) === '[' && substr($data, -1) === ']')) {
        $testJson = json_decode($data, true);
        if (is_array($testJson)) {
            return $data;
        }
    }

    // Format 2: Single base64-encoded JSON string check
    $decoded = base64_decode($data);
    if ($decoded !== false) {
        $trimmedDecoded = trim($decoded);
        if ((substr($trimmedDecoded, 0, 1) === '{' && substr($trimmedDecoded, -1) === '}') || (substr($trimmedDecoded, 0, 1) === '[' && substr($trimmedDecoded, -1) === ']')) {
            $testJson = json_decode($trimmedDecoded, true);
            if (is_array($testJson)) {
                return $trimmedDecoded;
            }
        }
    }

    // Format 3: Encrypted format with delimiter '::'
    if ($decoded !== false) {
        $parts = explode('::', $decoded, 2);
        if (count($parts) === 2 && $parts[0] !== '' && $parts[1] !== '') {
            $expectedLen = openssl_cipher_iv_length(Dragon_ENCRYPTION_METHOD);

            // Sub-format 3a: New format where IV is base64-encoded separately
            $iv = base64_decode($parts[0], true);
            if ($iv !== false && strlen($iv) === $expectedLen) {
                $result = openssl_decrypt($parts[1], Dragon_ENCRYPTION_METHOD, Dragon_ENCRYPTION_KEY, 0, $iv);
                if ($result !== false) return $result;
            }

            // Sub-format 3b: Fallback where IV was stored as raw binary
            $raw_iv = substr($parts[0], 0, $expectedLen);
            if (strlen($raw_iv) === $expectedLen) {
                $result = openssl_decrypt($parts[1], Dragon_ENCRYPTION_METHOD, Dragon_ENCRYPTION_KEY, 0, $raw_iv);
                if ($result !== false) return $result;
            }
        }
    }

    // Format 4: Raw openssl_decrypt with zero IV (legacy compatibility fallback)
    $expectedLen = openssl_cipher_iv_length(Dragon_ENCRYPTION_METHOD);
    $zeroIv = str_repeat("\0", $expectedLen);
    $result = openssl_decrypt($data, Dragon_ENCRYPTION_METHOD, Dragon_ENCRYPTION_KEY, 0, $zeroIv);
    if ($result !== false) {
        $testJson = json_decode(trim($result), true);
        if (is_array($testJson)) return $result;
    }

    return false;
}


