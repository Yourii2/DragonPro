# PowerShell script to test partialReturn API locally
# Edit variables below and run in PowerShell on the machine hosting the app.
$apiBase = 'http://localhost/Nexus/components'
$phpSess = '' # e.g. '079qg6itd0tk6ohqr7gg8p0vf7' if you want to pass PHPSESSID

# Example payload: adjust order_id, rep_id, and items accordingly
$payload = @{
    order_id = 123
    rep_id = 45
    warehouse_id = 1
    notes = 'Test partial return via script'
    items = @(
        @{ product_id = 987; quantity = 0; returnedQuantity = 1 }
    )
}

$json = $payload | ConvertTo-Json -Depth 5

$headers = @{
    'Content-Type' = 'application/json'
}
if ($phpSess -ne '') { $headers['Cookie'] = "PHPSESSID=$phpSess" }

try {
    $url = "$apiBase/api.php?module=orders&action=partialReturn"
    Write-Host "Posting to: $url"
    $resp = Invoke-RestMethod -Uri $url -Method Post -Body $json -Headers $headers -TimeoutSec 120
    Write-Host "Response:`n" ($resp | ConvertTo-Json -Depth 5)
} catch {
    Write-Host "Request failed: $_"
}
