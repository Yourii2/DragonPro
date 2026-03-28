
$file = "c:\xampp\htdocs\Nexus\components\SettingsModule.tsx"
$enc  = [System.Text.Encoding]::UTF8
$lines = [System.IO.File]::ReadAllLines($file, $enc)

# Find insertion point: line BEFORE "Support Section"
$insertBefore = -1
for ($i = 0; $i -lt $lines.Length; $i++) {
    if ($lines[$i] -match '/\* Support Section') { $insertBefore = $i; break }
}
if ($insertBefore -lt 0) { Write-Error "Could not find Support Section marker"; exit 1 }

Write-Host "Inserting Updates Section before line $($insertBefore+1)"

$newSection = @"
          {/* Updates Section */}
          <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm transition-colors">
            <h3 className="font-bold flex items-center gap-2 mb-4 text-slate-800 dark:text-slate-100"><RefreshCw className="text-slate-500" size={18}/> تحديث النظام</h3>
            <div className="flex flex-wrap items-center gap-4">
              <button
                onClick={checkForUpdates}
                disabled={updateLoading}
                className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-bold text-sm transition-all disabled:opacity-60 shadow"
              >
                <RefreshCw className={updateLoading ? 'animate-spin' : ''} size={16} />
                {updateLoading ? 'جارٍ الفحص...' : 'فحص التحديثات'}
              </button>
              <div className="text-sm text-slate-500 dark:text-slate-400">
                {updateInfo?.current_version && (
                  <span>الإصدار الحالي: <span className="font-bold text-slate-700 dark:text-slate-200">{updateInfo.current_version}</span></span>
                )}
                {updateInfo?.new_count != null && (
                  <span className="mr-3">
                    {updateInfo.new_count > 0
                      ? <span className="text-emerald-600 dark:text-emerald-400 font-semibold">● {updateInfo.new_count} تحديث جديد متاح</span>
                      : <span className="text-slate-400">✔ النظام محدَّث</span>}
                  </span>
                )}
                {!updateInfo && <span className="text-xs">اضغط "فحص التحديثات" لعرض جميع الإصدارات.</span>}
              </div>
            </div>
          </div>

"@

$newLines = $newSection -split "`n" | ForEach-Object { $_.TrimEnd("`r") }

$result = [System.Collections.Generic.List[string]]::new()
for ($i = 0; $i -lt $insertBefore; $i++) { $result.Add($lines[$i]) }
foreach ($l in $newLines) { $result.Add($l) }
for ($i = $insertBefore; $i -lt $lines.Length; $i++) { $result.Add($lines[$i]) }

[System.IO.File]::WriteAllLines($file, $result, $enc)
Write-Host "Done. New line count: $($result.Count)"
