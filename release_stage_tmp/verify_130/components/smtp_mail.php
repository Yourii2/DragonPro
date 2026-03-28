<?php
require_once __DIR__ . '/smtp_config.php';

function smtp_read($fp) {
    $data = '';
    while (!feof($fp)) {
        $line = fgets($fp, 515);
        if ($line === false) break;
        $data .= $line;
        if (strlen($line) >= 4 && $line[3] === ' ') break;
    }
    return $data;
}

function smtp_send_line($fp, $line) {
    fwrite($fp, $line . "\r\n");
    return smtp_read($fp);
}

function smtp_send_mail($to, $subject, $body, $attachmentPath = null, $attachmentName = null) {
    $host = SMTP_HOST;
    $port = SMTP_PORT;
    $user = SMTP_USER;
    $pass = SMTP_PASS;
    $fromEmail = SMTP_FROM_EMAIL;
    $fromName = SMTP_FROM_NAME;

    $fp = stream_socket_client("tcp://{$host}:{$port}", $errno, $errstr, 20);
    if (!$fp) return false;
    smtp_read($fp);

    smtp_send_line($fp, "EHLO localhost");
    smtp_send_line($fp, "STARTTLS");
    if (!stream_socket_enable_crypto($fp, true, STREAM_CRYPTO_METHOD_TLS_CLIENT)) return false;
    smtp_send_line($fp, "EHLO localhost");
    smtp_send_line($fp, "AUTH LOGIN");
    smtp_send_line($fp, base64_encode($user));
    smtp_send_line($fp, base64_encode($pass));

    smtp_send_line($fp, "MAIL FROM:<{$fromEmail}>");
    smtp_send_line($fp, "RCPT TO:<{$to}>");
    smtp_send_line($fp, "DATA");

    $headers = [];
    $headers[] = "From: {$fromName} <{$fromEmail}>";
    $headers[] = "To: {$to}";
    $headers[] = "Subject: {$subject}";
    $headers[] = "MIME-Version: 1.0";

    $isHtml = preg_match('/<\s*(html|body|div|table|style|thead|tbody|tr|td|th)\b/i', $body) === 1;
    $contentType = $isHtml ? 'text/html; charset=UTF-8' : 'text/plain; charset=UTF-8';

    if ($attachmentPath && file_exists($attachmentPath)) {
        $boundary = "b" . md5(uniqid('', true));
        $headers[] = "Content-Type: multipart/mixed; boundary=\"{$boundary}\"";
        $msg = "--{$boundary}\r\n";
        $msg .= "Content-Type: {$contentType}\r\n\r\n";
        $msg .= $body . "\r\n\r\n";

        $fileData = file_get_contents($attachmentPath);
        $fileData = chunk_split(base64_encode($fileData));
        $name = $attachmentName ?: basename($attachmentPath);

        $msg .= "--{$boundary}\r\n";
        $msg .= "Content-Type: application/sql; name=\"{$name}\"\r\n";
        $msg .= "Content-Transfer-Encoding: base64\r\n";
        $msg .= "Content-Disposition: attachment; filename=\"{$name}\"\r\n\r\n";
        $msg .= $fileData . "\r\n";
        $msg .= "--{$boundary}--\r\n";
    } else {
        $headers[] = "Content-Type: {$contentType}";
        $msg = $body . "\r\n";
    }

    $payload = implode("\r\n", $headers) . "\r\n\r\n" . $msg . "\r\n.";
    fwrite($fp, $payload . "\r\n");
    smtp_read($fp);

    smtp_send_line($fp, "QUIT");
    fclose($fp);
    return true;
}
