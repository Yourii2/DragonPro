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
    $decoded = base64_decode($data);
    if ($decoded === false) return false;

    $parts = explode('::', $decoded, 2);
    if (count($parts) !== 2 || $parts[0] === '' || $parts[1] === '') {
        return false;
    }

    $expectedLen = openssl_cipher_iv_length(Dragon_ENCRYPTION_METHOD);

    // Try new format first: IV is base64-encoded separately
    $iv = base64_decode($parts[0], true);
    if ($iv !== false && strlen($iv) === $expectedLen) {
        $result = openssl_decrypt($parts[1], Dragon_ENCRYPTION_METHOD, Dragon_ENCRYPTION_KEY, 0, $iv);
        if ($result !== false) return $result;
    }

    // Fallback: old format where IV was stored as raw binary (may be padded to expectedLen)
    $raw_iv = substr($parts[0], 0, $expectedLen);
    if (strlen($raw_iv) === $expectedLen) {
        // The "encrypted" part in old format was everything after the first ::
        $result = openssl_decrypt($parts[1], Dragon_ENCRYPTION_METHOD, Dragon_ENCRYPTION_KEY, 0, $raw_iv);
        if ($result !== false) return $result;
    }

    return false;
}

