$stage = "release_stage/DragonPro_v1.10.9"
if (Test-Path $stage) { 
    Remove-Item -Recurse -Force $stage 
}
New-Item -ItemType Directory -Path "$stage/assets" -Force | Out-Null
New-Item -ItemType Directory -Path "$stage/components" -Force | Out-Null
New-Item -ItemType Directory -Path "$stage/migrations" -Force | Out-Null
New-Item -ItemType Directory -Path "$stage/tools" -Force | Out-Null

# 1. Assets from dist
Copy-Item "dist/assets/*" "$stage/assets/" -Recurse

# 2. Components (only PHP and server assets, not TSX)
Get-ChildItem "components" | Where-Object { 
    $_.Extension -in @('.php', '.jpg', '.png', '.htaccess', '.json') -or $_.PSIsContainer 
} | ForEach-Object {
    Copy-Item $_.FullName "$stage/components/" -Recurse -Force
}

# 3. Migrations & Tools
Copy-Item "migrations/*" "$stage/migrations/" -Recurse -Force
Copy-Item "tools/*" "$stage/tools/" -Recurse -Force

# 4. Root files
Copy-Item "dist/index.html" "$stage/index.html" -Force
$rootFiles = @(
    "Dragon.png", "install.bat", "metadata.json", "recreate_license.bat",
    "restart.bat", "start.bat", "stop.bat", "update-config.json",
    "update_and_restart.bat", "version.json"
)
foreach ($f in $rootFiles) {
    if (Test-Path $f) {
        Copy-Item $f "$stage/" -Force
    }
}

# 5. Create zip in releases
if (-not (Test-Path "releases")) { 
    New-Item -ItemType Directory -Path "releases" | Out-Null 
}
$zipPath = "releases/DragonPro_v1.10.9.zip"
if (Test-Path $zipPath) { 
    Remove-Item -Force $zipPath 
}

Compress-Archive -Path "$stage/*" -DestinationPath $zipPath -Force

$item = Get-Item $zipPath
Write-Host "Created release zip: $($item.FullName) ($([math]::Round($item.Length/1KB, 2)) KB)"
