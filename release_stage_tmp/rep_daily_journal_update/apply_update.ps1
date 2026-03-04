param(
    [string]$from = (Get-Date).AddDays(-90).ToString('yyyy-MM-dd'),
    [string]$to   = (Get-Date).ToString('yyyy-MM-dd')
)

Write-Output "Running migrations (migrations/run_updates.php)..."
php migrations/run_updates.php
if ($LASTEXITCODE -ne 0) { Write-Error "migrations/run_updates.php failed (exit $LASTEXITCODE)"; exit $LASTEXITCODE }

Write-Output "Recomputing rep_daily_journal from $from to $to..."
php scripts/recompute_rep_daily_journal.php all $from $to
if ($LASTEXITCODE -ne 0) { Write-Error "recompute_rep_daily_journal.php failed (exit $LASTEXITCODE)"; exit $LASTEXITCODE }

Write-Output "Running optional index fix (tools/fix_rep_daily_journal_index.php)..."
php tools/fix_rep_daily_journal_index.php

Write-Output "Update applied successfully."