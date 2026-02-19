<?php
// Usage: php scripts/check_api_undefined_functions.php components/api.php
// Reports function calls that are not defined in the file and not available as internal PHP functions.

$path = $argv[1] ?? __DIR__ . '/../components/api.php';
if (!is_string($path) || !file_exists($path)) {
    fwrite(STDERR, "File not found: {$path}\n");
    exit(2);
}

$code = file_get_contents($path);
$tokens = token_get_all($code);

$defined = [];
$calls = [];
$internal = array_flip(get_defined_functions()['internal']);

$skip = [
    'if','for','foreach','while','switch','catch','echo','print','isset','empty','array','list','unset','die','exit',
    'include','include_once','require','require_once','return','throw','clone','eval','function','new'
];

$n = count($tokens);
for ($i = 0; $i < $n; $i++) {
    $tok = $tokens[$i];

    if (is_array($tok) && $tok[0] === T_FUNCTION) {
        for ($j = $i + 1; $j < $n; $j++) {
            $tk = $tokens[$j];
            if (is_array($tk) && $tk[0] === T_STRING) {
                $defined[strtolower($tk[1])] = true;
                break;
            }
        }
        continue;
    }

    if (!is_array($tok) || $tok[0] !== T_STRING) continue;

    $name = $tok[1];
    $lname = strtolower($name);
    if (in_array($lname, $skip, true)) continue;

    // Next non-ws token must be '('
    $k = $i + 1;
    while ($k < $n && is_array($tokens[$k]) && in_array($tokens[$k][0], [T_WHITESPACE, T_COMMENT, T_DOC_COMMENT], true)) $k++;
    if (!($k < $n && $tokens[$k] === '(')) continue;

    // Prev non-ws token must NOT be object/static operator
    $p = $i - 1;
    while ($p >= 0 && is_array($tokens[$p]) && in_array($tokens[$p][0], [T_WHITESPACE, T_COMMENT, T_DOC_COMMENT], true)) $p--;

    $prev = $p >= 0 ? $tokens[$p] : null;
    $isMethod = false;
    if ($prev === '->' || $prev === '::') $isMethod = true;
    if (is_array($prev) && in_array($prev[0], [T_OBJECT_OPERATOR, T_DOUBLE_COLON], true)) $isMethod = true;

    if ($isMethod) continue;

    $calls[$lname] = true;
}

$unknown = [];
foreach ($calls as $c => $_) {
    if (isset($defined[$c])) continue;
    if (isset($internal[$c])) continue;
    $unknown[] = $c;
}

sort($unknown);

echo "File: {$path}\n";
echo "Defined in file: " . count($defined) . "\n";
echo "Function calls found: " . count($calls) . "\n";
echo "Potentially undefined calls: " . count($unknown) . "\n";

foreach (array_slice($unknown, 0, 120) as $u) {
    echo $u . "\n";
}
if (count($unknown) > 120) echo "...\n";
