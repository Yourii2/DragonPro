param(
    [string]$InputFile = "998877.sql",
    [string]$OutputFile = "current_schema_struct.sql"
)

if (-not (Test-Path $InputFile)) {
    Write-Error "Input file '$InputFile' not found."
    exit 1
}

$text = Get-Content -Raw -LiteralPath $InputFile

# Regex to capture CREATE TABLE ... ; (multiline, non-greedy)
$pattern = '(?ms)CREATE\s+TABLE.*?;'
$matches = [regex]::Matches($text, $pattern)

if ($matches.Count -eq 0) {
    Write-Error "No CREATE TABLE statements found in $InputFile"
    exit 1
}

$header = "SET NAMES utf8mb4;`r`nSET FOREIGN_KEY_CHECKS = 0;`r`n`r`n"

$out = New-Object System.Text.StringBuilder
$out.Append($header) | Out-Null

foreach ($m in $matches) {
    $out.Append($m.Value) | Out-Null
    $out.Append("`r`n`r`n") | Out-Null
}

[System.IO.File]::WriteAllText($OutputFile, $out.ToString(), [System.Text.Encoding]::UTF8)
Write-Output "Wrote structure-only SQL to $OutputFile"
