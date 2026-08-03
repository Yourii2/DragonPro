<?php
// ==============================================================================
// DragonPro Telegram AI Service (Gemini / OpenAI API Multimodal Parser)
// Handles Natural Language Order Parsing, Voice Note STT, and Image OCR.
// ==============================================================================

if (!defined('ABSPATH') && !defined('DB_HOST')) {
    $cfg = __DIR__ . '/../config.php';
    if (file_exists($cfg)) require_once $cfg;
}
if (!function_exists('get_setting_value')) {
    function get_setting_value($pdo, $key, $default = '') {
        try {
            $stmt = $pdo->prepare("SELECT config_value FROM settings WHERE config_key = ? LIMIT 1");
            $stmt->execute([$key]);
            $val = $stmt->fetchColumn();
            if ($val !== false) return $val;
        } catch (Exception $e) {}
        return $default;
    }
}

/**
 * Main AI Text Parser: converts informal Arabic order text into structured JSON.
 */
function parse_order_with_ai($pdo, $rawText) {
    $rawText = trim($rawText);
    if ($rawText === '') return null;

    $apiKey = get_setting_value($pdo, 'telegram_ai_api_key', '');
    $provider = get_setting_value($pdo, 'telegram_ai_provider', 'gemini');

    // If AI Key is configured, attempt AI extraction
    if (!empty($apiKey)) {
        if ($provider === 'openai' || strpos($apiKey, 'sk-') === 0) {
            $parsed = parse_order_with_openai($apiKey, $rawText);
            if ($parsed && !empty($parsed['customer_name'])) return $parsed;
        }
        
        // Default to Gemini API
        $parsed = parse_order_with_gemini($apiKey, $rawText);
        if ($parsed && !empty($parsed['customer_name'])) return $parsed;
    }

    // Fallback: Internal Rule-based Parser
    return fallback_parse_order_text($rawText);
}

/**
 * Gemini API Integration for Order Parsing
 */
function parse_order_with_gemini($apiKey, $text) {
    $url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=" . urlencode($apiKey);

    $prompt = "You are an AI order parsing assistant for an Egyptian e-commerce ERP system. " .
              "Extract the customer details, products, shipping fees, employee, page, and notes from the following text in Egyptian Arabic. " .
              "Return ONLY a valid JSON object without any Markdown formatting or code blocks. " .
              "JSON structure required:\n" .
              "{\n" .
              "  \"customer_name\": \"string\",\n" .
              "  \"phone\": \"string\",\n" .
              "  \"phone2\": \"string\",\n" .
              "  \"governorate\": \"string\",\n" .
              "  \"address\": \"string\",\n" .
              "  \"shipping_fees\": number,\n" .
              "  \"employee\": \"string\",\n" .
              "  \"page\": \"string\",\n" .
              "  \"notes\": \"string\",\n" .
              "  \"items\": [\n" .
              "    { \"name\": \"string\", \"quantity\": number, \"price\": number }\n" .
              "  ]\n" .
              "}\n\n" .
              "Text to parse:\n" . $text;

    $payload = [
        'contents' => [
            ['parts' => [['text' => $prompt]]]
        ],
        'generationConfig' => [
            'temperature' => 0.1,
            'responseMimeType' => 'application/json'
        ]
    ];

    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
    curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
    curl_setopt($ch, CURLOPT_TIMEOUT, 12);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
    $response = curl_exec($ch);
    curl_close($ch);

    if (!$response) return null;

    try {
        $json = json_decode($response, true);
        $content = $json['candidates'][0]['content']['parts'][0]['text'] ?? '';
        $cleanJson = preg_replace('/^```(?:json)?\s*|\s*```$/ui', '', trim($content));
        return json_decode($cleanJson, true);
    } catch (Exception $e) {
        return null;
    }
}

/**
 * OpenAI API Integration for Order Parsing
 */
function parse_order_with_openai($apiKey, $text) {
    $url = "https://api.openai.com/v1/chat/completions";

    $systemPrompt = "You are an order parsing assistant for an Egyptian ERP system. " .
                    "Extract customer name, phone, phone2, governorate, address, shipping_fees, employee, page, notes, and items array from text. " .
                    "Return ONLY raw JSON with keys: customer_name, phone, phone2, governorate, address, shipping_fees, employee, page, notes, items.";

    $payload = [
        'model' => 'gpt-4o-mini',
        'messages' => [
            ['role' => 'system', 'content' => $systemPrompt],
            ['role' => 'user', 'content' => $text]
        ],
        'response_format' => ['type' => 'json_object'],
        'temperature' => 0.1
    ];

    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Content-Type: application/json',
        'Authorization: Bearer ' . $apiKey
    ]);
    curl_setopt($ch, CURLOPT_TIMEOUT, 12);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
    $response = curl_exec($ch);
    curl_close($ch);

    if (!$response) return null;

    try {
        $json = json_decode($response, true);
        $content = $json['choices'][0]['message']['content'] ?? '';
        return json_decode($content, true);
    } catch (Exception $e) {
        return null;
    }
}

/**
 * Process Voice Note File via Gemini / OpenAI Vision & Audio APIs
 */
function process_voice_note_with_ai($pdo, $botToken, $fileId) {
    $apiKey = get_setting_value($pdo, 'telegram_ai_api_key', '');
    if (empty($apiKey)) return null;

    // 1. Get file path from Telegram API
    $getFileUrl = "https://api.telegram.org/bot" . $botToken . "/getFile?file_id=" . urlencode($fileId);
    $ch = curl_init($getFileUrl);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 8);
    $fileRes = curl_exec($ch);
    curl_close($ch);

    $fileData = json_decode($fileRes, true);
    $filePath = $fileData['result']['file_path'] ?? '';
    if (empty($filePath)) return null;

    // 2. Download audio file content
    $downloadUrl = "https://api.telegram.org/file/bot" . $botToken . "/" . $filePath;
    $ch = curl_init($downloadUrl);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 15);
    $audioBytes = curl_exec($ch);
    curl_close($ch);

    if (!$audioBytes) return null;

    // 3. Process Multimodal Gemini Audio
    $url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=" . urlencode($apiKey);
    $base64Audio = base64_encode($audioBytes);

    $prompt = "Transcribe this audio in Egyptian Arabic and extract the order JSON with keys: customer_name, phone, phone2, governorate, address, shipping_fees, employee, page, notes, items.";
    $payload = [
        'contents' => [
            [
                'parts' => [
                    ['text' => $prompt],
                    [
                        'inline_data' => [
                            'mime_type' => 'audio/ogg',
                            'data' => $base64Audio
                        ]
                    ]
                ]
            ]
        ],
        'generationConfig' => [
            'temperature' => 0.1,
            'responseMimeType' => 'application/json'
        ]
    ];

    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
    curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
    curl_setopt($ch, CURLOPT_TIMEOUT, 20);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
    $res = curl_exec($ch);
    curl_close($ch);

    if (!$res) return null;
    try {
        $json = json_decode($res, true);
        $content = $json['candidates'][0]['content']['parts'][0]['text'] ?? '';
        $cleanJson = preg_replace('/^```(?:json)?\s*|\s*```$/ui', '', trim($content));
        return json_decode($cleanJson, true);
    } catch (Exception $e) {
        return null;
    }
}

/**
 * Enhanced Fallback Rule-based Parser (when AI Key is not provided)
 */
function fallback_parse_order_text($text) {
    $customerName = '';
    $phone = '';
    $phone2 = '';
    $governorate = '';
    $address = '';
    $shippingFees = 0.0;
    $employee = '';
    $page = '';
    $notes = '';

    $lines = explode("\n", $text);
    foreach ($lines as $line) {
        $line = trim($line);
        if (preg_match('/^(?:الاسم|الاسم الكامل|اسم العميل|الإسم)\s*[:：-]?\s*(.*)/ui', $line, $m)) {
            $customerName = trim($m[1]);
        } elseif (preg_match('/^(?:الهاتف|رقم الهاتف|الموبايل|تليفون|الهاتف1|التليفون)\s*[:：-]?\s*(.*)/ui', $line, $m)) {
            $rawPhones = $m[1];
            $phoneParts = preg_split('/[\s,،\/]+/u', $rawPhones);
            $cleanPhones = [];
            foreach ($phoneParts as $part) {
                $clean = preg_replace('/\D/', '', $part);
                if (strlen($clean) >= 7) $cleanPhones[] = $clean;
            }
            if (isset($cleanPhones[0])) $phone = $cleanPhones[0];
            if (isset($cleanPhones[1])) $phone2 = $cleanPhones[1];
        } elseif (preg_match('/^(?:المافظة|المحافظة|المحافظه)\s*[:：-]?\s*(.*)/ui', $line, $m)) {
            $governorate = trim($m[1]);
        } elseif (preg_match('/^(?:العنوان|العنوان بالتفصيل|عنوان)\s*[:：-]?\s*(.*)/ui', $line, $m)) {
            $address = trim($m[1]);
        } elseif (preg_match('/^(?:الشحن|شحن|مصاريف الشحن)\s*[:：-]?\s*(\d+)/ui', $line, $m)) {
            $shippingFees = floatval($m[1]);
        } elseif (preg_match('/^(?:الموظف|موظف|مدخل البيانات)\s*[:：-]?\s*(.*)/ui', $line, $m)) {
            $employee = trim($m[1]);
        } elseif (preg_match('/^(?:البيدج|الصفحة|الصفحه)\s*[:：-]?\s*(.*)/ui', $line, $m)) {
            $page = trim($m[1]);
        } elseif (preg_match('/^(?:الملاحظات|ملاحظات)\s*[:：-]?\s*(.*)/ui', $line, $m)) {
            $notes .= ' ' . trim($m[1]);
        }
    }

    // Items scanning
    $items = [];
    foreach ($lines as $line) {
        $line = trim($line);
        if (preg_match('/(?:الكميه|الكمية)\s*(\d+)\s+(?:الاسم|اسم)\s+(.+?)\s+(?:اللون|لون)\s+(.+?)\s+(?:المقاس|مقاس)\s+(.+?)\s+(?:السعر|سعر)\s*(\d+)/ui', $line, $m)) {
            $items[] = [
                'name' => trim($m[2]) . ' - اللون: ' . trim($m[3]) . ' - المقاس: ' . trim($m[4]),
                'quantity' => intval($m[1]),
                'price' => floatval($m[5])
            ];
        } elseif (preg_match('/(?:الكميه|الكمية)\s*(\d+)\s+(?:الاسم|اسم)\s+(.+?)\s+(?:السعر|سعر)\s*(\d+)/ui', $line, $m)) {
            $items[] = [
                'name' => trim($m[2]),
                'quantity' => intval($m[1]),
                'price' => floatval($m[3])
            ];
        }
    }

    if (empty($items)) {
        $prodName = ''; $qty = 1; $price = 0;
        foreach ($lines as $line) {
            $line = trim($line);
            if (preg_match('/(?:المنتج|الصنف|اسم المنتج)\s*[:：-]?\s*(.*)/ui', $line, $m)) {
                $prodName = trim($m[1]);
            } elseif (preg_match('/(?:الكمية|الكميه|عدد)\s*[:：-]?\s*(\d+)/ui', $line, $m)) {
                $qty = intval($m[1]);
            } elseif (preg_match('/(?:السعر|سعر)\s*[:：-]?\s*(\d+)/ui', $line, $m)) {
                $price = floatval($m[1]);
            }
        }
        if ($prodName !== '') {
            $items[] = ['name' => $prodName, 'quantity' => $qty, 'price' => $price];
        }
    }

    return [
        'customer_name' => $customerName,
        'phone' => $phone,
        'phone2' => $phone2,
        'governorate' => $governorate,
        'address' => $address,
        'shipping_fees' => $shippingFees,
        'employee' => $employee,
        'page' => $page,
        'notes' => trim($notes),
        'items' => $items
    ];
}
