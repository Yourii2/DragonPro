<?php
// This key should be a random binary string and stored securely.
// For this example, we'll use a hardcoded key.
define('Dragon_ENCRYPTION_KEY', 'a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6'); // 32 bytes for AES-256
define('Dragon_ENCRYPTION_METHOD', 'aes-256-cbc');

function encrypt_data($data) {
    $iv = openssl_random_pseudo_bytes(openssl_cipher_iv_length(Dragon_ENCRYPTION_METHOD));
    $encrypted = openssl_encrypt($data, Dragon_ENCRYPTION_METHOD, Dragon_ENCRYPTION_KEY, 0, $iv);
    // Return IV and encrypted data, base64 encoded to be safe for file storage
    return base64_encode($iv . '::' . $encrypted);
}

function decrypt_data($data) {
    $decoded = base64_decode($data);
    list($iv, $encrypted_data) = explode('::', $decoded, 2);
    if (!$iv || !$encrypted_data) {
        return false;
    }
    return openssl_decrypt($encrypted_data, Dragon_ENCRYPTION_METHOD, Dragon_ENCRYPTION_KEY, 0, $iv);
}

